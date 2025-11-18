import { randomUUID } from 'crypto'
import { getDatabase, encryption } from '../database'
import { accountManager, getIMAPClient, getPOP3Client } from './index'
import type { Email, Attachment, EmailAddress } from '../shared/types'
import { calculateThreadId } from './thread-utils'
import { spamDetector } from './spam-detector'

type SyncProgressCallback = (data: {
  folder?: string
  folderId?: string
  accountId?: string
  current: number
  total?: number
  emailUid?: number
  email?: Email
}) => void

const SYNC_BODY_PREVIEW_LIMIT = 4096
const SYNC_YIELD_INTERVAL = 25

export class EmailStorage {
  private db = getDatabase()
  private cancellationTokens = new Map<string, { cancelled: boolean }>()

  private isMailboxNotExistError(err: any): boolean {
    // Check for IMAP "mailbox doesn't exist" errors
    // Error can have type: 'no' or message containing "doesn't exist" or "Mailbox doesn't exist"
    return err?.type === 'no' || 
           err?.message?.toLowerCase().includes("doesn't exist") ||
           err?.message?.toLowerCase().includes("mailbox doesn't exist")
  }

  hasFolders(accountId: string): boolean {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM folders WHERE account_id = ?').get(accountId) as any
    return (result?.count || 0) > 0
  }

  async syncFoldersOnly(accountId: string, progressCallback?: (data: { folder?: string; current: number; total?: number; emailUid?: number }) => void): Promise<{ synced: number }> {
    const account = await accountManager.getAccount(accountId)
    if (!account) {
      throw new Error('Account not found')
    }

    // Only works for IMAP accounts
    if (account.type !== 'imap') {
      return { synced: 0 }
    }

    const imapClient = getIMAPClient(account)
    await imapClient.connect()

    try {
      const serverFolders = await imapClient.listFolders()
      const dbFolders = this.db.prepare('SELECT * FROM folders WHERE account_id = ?').all(accountId) as any[]
      const now = Date.now()
      let synced = 0

      // Update/create folders in database
      progressCallback?.({ folder: 'folders', current: 0, total: serverFolders.length })
      for (let i = 0; i < serverFolders.length; i++) {
        const serverFolder = serverFolders[i]
        const existing = dbFolders.find(f => f.path === serverFolder.path)
        if (!existing) {
          const id = randomUUID()
          this.db.prepare(`
            INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, ?, ?)
          `).run(id, accountId, serverFolder.name, serverFolder.path, JSON.stringify(serverFolder.attributes), now, now)
          synced++
        }
        progressCallback?.({ folder: 'folders', current: i + 1, total: serverFolders.length })
      }

      return { synced }
    } finally {
      await imapClient.disconnect()
    }
  }

  async storeEmail(email: Email): Promise<string> {
    // Always generate ID from current folderId (database ID) to ensure consistency
    // Don't use pre-generated email.id which might have been created with folder name
    const id = `${email.accountId}-${email.folderId}-${email.uid}`
    
    // Calculate threadId if not already set or if we need to recalculate
    const threadId = email.threadId || await calculateThreadId(email)
    
    const existing = this.db.prepare(`
      SELECT
        id,
        body_encrypted,
        html_body_encrypted,
        text_body_encrypted,
        headers_encrypted
      FROM emails
      WHERE account_id = ? AND folder_id = ? AND uid = ?
    `).get(email.accountId, email.folderId, email.uid) as any

    if (existing) {
      // Update existing email including body content
      const existingId = existing.id
      const now = Date.now()
      
      // Only overwrite body fields when real content is provided to avoid nuking stored bodies
      const hasBodyContent = typeof email.body === 'string' && email.body.trim().length > 0
      const hasHtmlContent = typeof email.htmlBody === 'string' && email.htmlBody.trim().length > 0
      const hasTextContent = typeof email.textBody === 'string' && email.textBody.trim().length > 0
      const hasHeaders = email.headers && Object.keys(email.headers).length > 0

      const bodyEncrypted = hasBodyContent
        ? encryption.encrypt(email.body || '')
        : existing.body_encrypted
      const htmlBodyEncrypted = hasHtmlContent
        ? (email.htmlBody ? encryption.encrypt(email.htmlBody) : null)
        : existing.html_body_encrypted
      const textBodyEncrypted = hasTextContent
        ? (email.textBody ? encryption.encrypt(email.textBody) : null)
        : existing.text_body_encrypted
      const headersEncrypted = hasHeaders
        ? encryption.encrypt(JSON.stringify(email.headers))
        : existing.headers_encrypted
      
      this.db.prepare(`
        UPDATE emails SET
          subject = ?,
          from_addresses = ?,
          to_addresses = ?,
          cc_addresses = ?,
          bcc_addresses = ?,
          reply_to_addresses = ?,
          date = ?,
          body_encrypted = ?,
          html_body_encrypted = ?,
          text_body_encrypted = ?,
          headers_encrypted = ?,
          flags = ?,
          is_read = ?,
          is_starred = ?,
          thread_id = ?,
          in_reply_to = ?,
          email_references = ?,
          encrypted = ?,
          signed = ?,
          signature_verified = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        email.subject,
        JSON.stringify(email.from),
        JSON.stringify(email.to),
        email.cc ? JSON.stringify(email.cc) : null,
        email.bcc ? JSON.stringify(email.bcc) : null,
        email.replyTo ? JSON.stringify(email.replyTo) : null,
        email.date,
        bodyEncrypted,
        htmlBodyEncrypted,
        textBodyEncrypted,
        headersEncrypted,
        JSON.stringify(email.flags),
        email.isRead ? 1 : 0,
        email.isStarred ? 1 : 0,
        threadId || null,
        email.inReplyTo || null,
        email.references ? JSON.stringify(email.references) : null,
        email.encrypted ? 1 : 0,
        email.signed ? 1 : 0,
        email.signatureVerified !== undefined ? (email.signatureVerified ? 1 : 0) : null,
        now,
        existingId
      )
      
      return existingId
    }

    // Insert new email
    const now = Date.now()

    // Encrypt body
    const bodyEncrypted = encryption.encrypt(email.body || '')
    const htmlBodyEncrypted = email.htmlBody ? encryption.encrypt(email.htmlBody) : null
    const textBodyEncrypted = email.textBody ? encryption.encrypt(email.textBody) : null
    const headersEncrypted = email.headers ? encryption.encrypt(JSON.stringify(email.headers)) : null

    try {
      this.db.prepare(`
        INSERT INTO emails (
          id, account_id, folder_id, uid, message_id, subject,
          from_addresses, to_addresses, cc_addresses, bcc_addresses, reply_to_addresses,
          date, body_encrypted, html_body_encrypted, text_body_encrypted, headers_encrypted,
          flags, is_read, is_starred, thread_id, in_reply_to, email_references,
          encrypted, signed, signature_verified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        email.accountId,
        email.folderId,
        email.uid,
        email.messageId,
        email.subject,
        JSON.stringify(email.from),
        JSON.stringify(email.to),
        email.cc ? JSON.stringify(email.cc) : null,
        email.bcc ? JSON.stringify(email.bcc) : null,
        email.replyTo ? JSON.stringify(email.replyTo) : null,
        email.date,
        bodyEncrypted,
        htmlBodyEncrypted,
        textBodyEncrypted,
        headersEncrypted,
        JSON.stringify(email.flags),
        email.isRead ? 1 : 0,
        email.isStarred ? 1 : 0,
        threadId || null,
        email.inReplyTo || null,
        email.references ? JSON.stringify(email.references) : null,
        email.encrypted ? 1 : 0,
        email.signed ? 1 : 0,
        email.signatureVerified !== undefined ? (email.signatureVerified ? 1 : 0) : null,
        now,
        now
      )
    } catch (err: any) {
      // Handle race condition: if UNIQUE constraint fails, the email was inserted
      // by another concurrent operation, so update it instead
      if (err?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || err?.code === 'SQLITE_CONSTRAINT') {
        // Email with this ID already exists, update it instead
        const updateNow = Date.now()
        
        this.db.prepare(`
          UPDATE emails SET
            subject = ?,
            from_addresses = ?,
            to_addresses = ?,
            cc_addresses = ?,
            bcc_addresses = ?,
            reply_to_addresses = ?,
            date = ?,
            body_encrypted = ?,
            html_body_encrypted = ?,
            text_body_encrypted = ?,
            headers_encrypted = ?,
            flags = ?,
            is_read = ?,
            is_starred = ?,
            thread_id = ?,
            in_reply_to = ?,
            email_references = ?,
            encrypted = ?,
            signed = ?,
            signature_verified = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          email.subject,
          JSON.stringify(email.from),
          JSON.stringify(email.to),
          email.cc ? JSON.stringify(email.cc) : null,
          email.bcc ? JSON.stringify(email.bcc) : null,
          email.replyTo ? JSON.stringify(email.replyTo) : null,
          email.date,
          bodyEncrypted,
          htmlBodyEncrypted,
          textBodyEncrypted,
          headersEncrypted,
          JSON.stringify(email.flags),
          email.isRead ? 1 : 0,
          email.isStarred ? 1 : 0,
          threadId || null,
          email.inReplyTo || null,
          email.references ? JSON.stringify(email.references) : null,
          email.encrypted ? 1 : 0,
          email.signed ? 1 : 0,
          email.signatureVerified !== undefined ? (email.signatureVerified ? 1 : 0) : null,
          updateNow,
          id
        )
      } else {
        // Re-throw if it's a different error
        throw err
      }
    }

    // Store attachments
    if (email.attachments && email.attachments.length > 0) {
      for (const attachment of email.attachments) {
        await this.storeAttachment(id, attachment)
      }
    }

    // Check if folder is spam before spam detection
    const folder = this.db.prepare('SELECT name, path FROM folders WHERE id = ?').get(email.folderId) as any
    const folderNameLower = folder?.name?.toLowerCase() || ''
    const folderPathLower = folder?.path?.toLowerCase() || ''
    const folderIsSpam = folderNameLower === 'spam' || 
                         folderNameLower === 'junk' || 
                         folderPathLower.includes('spam') || 
                         folderPathLower.includes('junk')

    // Run spam detection after storing email
    let movedToSpam = false
    try {
      const spamScore = await spamDetector.calculateSpamScore(email)
      spamDetector.updateSpamScore(id, spamScore)

      // Auto-move to spam folder if score exceeds threshold (0.7)
      if (spamScore >= 0.7) {
        await this.moveToSpamFolder(id, email.accountId, email.folderId)
        movedToSpam = true
      }
    } catch (spamError) {
      // Don't fail email storage if spam detection fails
      console.error('Error in spam detection:', spamError)
    }

    // Extract contacts from non-spam emails only
    // Skip if original folder was spam or email was moved to spam
    if (!folderIsSpam && !movedToSpam) {
      try {
        const { contactManager } = await import('./contact-manager')
        // Extract contacts from non-spam emails
        contactManager.extractContactsFromAddresses(email.from, email.folderId)
        contactManager.extractContactsFromAddresses(email.to, email.folderId)
        if (email.cc) {
          contactManager.extractContactsFromAddresses(email.cc, email.folderId)
        }
        if (email.bcc) {
          contactManager.extractContactsFromAddresses(email.bcc, email.folderId)
        }
      } catch (contactError) {
        // Don't fail email storage if contact extraction fails
        console.error('Error extracting contacts from email:', contactError)
      }
    }

    return id
  }

  /**
   * Find or create spam/junk folder for an account
   */
  private async findOrCreateSpamFolder(accountId: string): Promise<string | null> {
    const db = this.db
    
    // Find existing spam folder
    let spamFolder = db.prepare(`
      SELECT * FROM folders 
      WHERE account_id = ? AND (LOWER(name) = 'spam' OR LOWER(name) = 'junk' OR LOWER(path) LIKE '%spam%' OR LOWER(path) LIKE '%junk%')
      LIMIT 1
    `).get(accountId) as any

    if (spamFolder) {
      return spamFolder.id
    }

    // Try to find or create on IMAP server
    const account = await accountManager.getAccount(accountId)
    if (account && account.type === 'imap') {
      try {
        const imapClient = getIMAPClient(account)
        await imapClient.connect()
        const folders = await imapClient.listFolders()
        let spamFolderOnServer = folders.find(
          f => f.name.toLowerCase() === 'spam' || 
               f.name.toLowerCase() === 'junk' || 
               f.path.toLowerCase().includes('spam') ||
               f.path.toLowerCase().includes('junk')
        )

        // If Spam folder doesn't exist on server, create it
        if (!spamFolderOnServer) {
          try {
            await imapClient.createFolder('Spam')
            const updatedFolders = await imapClient.listFolders()
            spamFolderOnServer = updatedFolders.find(
              f => f.name.toLowerCase() === 'spam' || 
                   f.name.toLowerCase() === 'junk' || 
                   f.path.toLowerCase().includes('spam') ||
                   f.path.toLowerCase().includes('junk')
            )
          } catch (createError) {
            console.error('Error creating Spam folder on IMAP server:', createError)
          }
        }

        if (spamFolderOnServer) {
          // Check if folder exists in DB
          spamFolder = db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?')
            .get(accountId, spamFolderOnServer.path) as any
          
          if (!spamFolder) {
            // Create folder in DB
            const folderId = randomUUID()
            const now = Date.now()
            db.prepare(`
              INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
              VALUES (?, ?, ?, ?, 1, ?, ?, ?)
            `).run(
              folderId,
              accountId,
              spamFolderOnServer.name,
              spamFolderOnServer.path,
              JSON.stringify(spamFolderOnServer.attributes),
              now,
              now
            )
            spamFolder = { id: folderId }
          }

          await imapClient.disconnect()
          return spamFolder.id
        }
      } catch (error) {
        console.error('Error finding/creating Spam folder:', error)
      }
    }

    // Create local spam folder as fallback
    const folderId = randomUUID()
    const now = Date.now()
    db.prepare(`
      INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      folderId,
      accountId,
      'Spam',
      'Spam',
      JSON.stringify([]),
      now,
      now
    )
    return folderId
  }

  /**
   * Move email to spam folder
   */
  private async moveToSpamFolder(emailId: string, accountId: string, currentFolderId: string): Promise<void> {
    try {
      const spamFolderId = await this.findOrCreateSpamFolder(accountId)
      if (!spamFolderId) {
        console.warn('Could not find or create spam folder for account:', accountId)
        return
      }

      // Don't move if already in spam folder
      if (currentFolderId === spamFolderId) {
        return
      }

      const now = Date.now()
      
      // Update folder_id in database
      this.db.prepare(`
        UPDATE emails 
        SET folder_id = ?, updated_at = ?
        WHERE id = ?
      `).run(spamFolderId, now, emailId)

      // Try to move on IMAP server if account is IMAP
      const account = await accountManager.getAccount(accountId)
      if (account && account.type === 'imap') {
        try {
          const email = this.db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId) as any
          if (email) {
            const imapClient = getIMAPClient(account)
            await imapClient.connect()
            
            const currentFolder = this.db.prepare('SELECT path FROM folders WHERE id = ?').get(currentFolderId) as any
            const spamFolder = this.db.prepare('SELECT path FROM folders WHERE id = ?').get(spamFolderId) as any
            
            if (currentFolder && spamFolder) {
              const currentPath = currentFolder.path === 'INBOX' ? 'INBOX' : currentFolder.path
              const spamPath = spamFolder.path || 'Spam'
              
              // Ensure Spam folder exists on server
              try {
                await imapClient.createFolder(spamPath)
              } catch (createError: any) {
                // Folder may already exist, that's fine
                if (createError && !createError.message?.includes('already exists') && !createError.message?.includes('EXISTS')) {
                  console.warn('Spam folder may already exist or creation failed:', createError.message)
                }
              }

              await imapClient.moveEmail(email.uid, currentPath, spamPath)
            }
            
            await imapClient.disconnect()
          }
        } catch (error) {
          console.error('Error moving email on IMAP server:', error)
          // Continue anyway - email is already moved in database
        }
      }
    } catch (error) {
      console.error('Error moving email to spam folder:', error)
    }
  }

  async updateEmail(id: string, updates: Partial<Email>): Promise<string> {
    const dbUpdates: string[] = []
    const values: any[] = []

    if (updates.isRead !== undefined) {
      dbUpdates.push('is_read = ?')
      values.push(updates.isRead ? 1 : 0)
    }
    if (updates.isStarred !== undefined) {
      dbUpdates.push('is_starred = ?')
      values.push(updates.isStarred ? 1 : 0)
    }
    if (updates.flags) {
      dbUpdates.push('flags = ?')
      values.push(JSON.stringify(updates.flags))
    }
    if (updates.folderId) {
      dbUpdates.push('folder_id = ?')
      values.push(updates.folderId)
    }

    dbUpdates.push('updated_at = ?')
    values.push(Date.now())
    values.push(id)

    this.db.prepare(`UPDATE emails SET ${dbUpdates.join(', ')} WHERE id = ?`).run(...values)
    return id
  }

  async storeAttachment(emailId: string, attachment: Attachment): Promise<void> {
    const existing = this.db.prepare('SELECT id FROM attachments WHERE email_id = ? AND filename = ?')
      .get(emailId, attachment.filename) as any

    if (existing) {
      return // Attachment already exists
    }

    const id = attachment.id || `${emailId}-${attachment.filename}`
    const dataEncrypted = encryption.encryptBuffer(attachment.data)

    this.db.prepare(`
      INSERT INTO attachments (id, email_id, filename, content_type, size, content_id, data_encrypted, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      emailId,
      attachment.filename,
      attachment.contentType,
      attachment.size,
      attachment.contentId || null,
      dataEncrypted,
      Date.now()
    )
  }

  async getEmail(
    id: string,
    options?: { fetchRemoteBody?: boolean; fetchTimeoutMs?: number }
  ): Promise<Email | null> {
    const fetchRemoteBody = options?.fetchRemoteBody !== false
    const fetchTimeoutMs = options?.fetchTimeoutMs ?? 45000

    console.log(`[EmailStorage.getEmail] Fetching email ${id}, fetchRemoteBody=${fetchRemoteBody}, timeout=${fetchTimeoutMs}ms`)

    const email = this.db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as any
    if (!email) {
      console.warn(`[EmailStorage.getEmail] Email ${id} not found in database`)
      return null
    }

    console.log(`[EmailStorage.getEmail] Found email ${id} in DB: account=${email.account_id}, folder=${email.folder_id}, uid=${email.uid}`)

    const mappedEmail = this.mapDbEmailToEmail(email)
    
    // Check if body is missing or empty
    // Metadata-only emails may have encrypted empty strings stored, so we check the decrypted values
    const hasBody = mappedEmail.body && typeof mappedEmail.body === 'string' && mappedEmail.body.trim().length > 0
    const hasHtmlBody = mappedEmail.htmlBody && typeof mappedEmail.htmlBody === 'string' && mappedEmail.htmlBody.trim().length > 0
    const hasTextBody = mappedEmail.textBody && typeof mappedEmail.textBody === 'string' && mappedEmail.textBody.trim().length > 0
    
    // Body is missing if no actual content exists (empty strings don't count)
    // This handles both cases:
    // 1. Metadata-only emails with encrypted empty strings (decrypts to empty)
    // 2. Emails where body fields are NULL (never stored)
    const bodyMissing = !hasBody && !hasHtmlBody && !hasTextBody
    
    // Log for debugging when body is missing
    if (bodyMissing) {
      const hasBodyEncrypted = !!(email.body_encrypted && email.body_encrypted.trim().length > 0)
      const hasHtmlBodyEncrypted = !!(email.html_body_encrypted && email.html_body_encrypted.trim().length > 0)
      const hasTextBodyEncrypted = !!(email.text_body_encrypted && email.text_body_encrypted.trim().length > 0)
      console.log(`Email ${id} body check: decrypted hasBody=${hasBody}, hasHtmlBody=${hasHtmlBody}, hasTextBody=${hasTextBody} | encrypted hasBody=${hasBodyEncrypted}, hasHtmlBody=${hasHtmlBodyEncrypted}, hasTextBody=${hasTextBodyEncrypted}`)
    }
    
    if (fetchRemoteBody && bodyMissing) {
      // Body is missing, try to fetch from server
      console.log(`Email ${id} has no body content, fetching from server...`)
      try {
        const account = await accountManager.getAccount(email.account_id)
        if (!account) {
          console.warn(`Account not found for email ${id}, cannot fetch body from server`)
          return mappedEmail
        }

        // Get folder information
        const folder = this.db.prepare('SELECT * FROM folders WHERE id = ?').get(email.folder_id) as any
        if (!folder) {
          console.warn(`Folder not found for email ${id}, cannot fetch body from server`)
          return mappedEmail
        }

        // Only fetch from IMAP (POP3 doesn't support fetching by UID)
        if (account.type === 'imap') {
          const imapClient = getIMAPClient(account)
          
          // Add timeout to prevent hanging when sync is running
          const fetchWithTimeout = async () => {
            try {
              await imapClient.connect()
              
              // Use folder name for IMAP operations, ensure INBOX is uppercase
              const imapFolderName = folder.name.toUpperCase() === 'INBOX' ? 'INBOX' : folder.path
              
              console.log(`Fetching body for email ${id} (UID: ${email.uid}) from folder ${imapFolderName}`)
              const fetchedEmail = await imapClient.fetchEmailByUid(imapFolderName, email.uid)
              
              console.log(`fetchEmailByUid completed for ${id}: fetchedEmail=${!!fetchedEmail}, body=${fetchedEmail?.body?.length || 0}, html=${fetchedEmail?.htmlBody?.length || 0}, text=${fetchedEmail?.textBody?.length || 0}`)
              
              if (!fetchedEmail) {
                console.warn(`fetchEmailByUid returned null for email ${id} (UID: ${email.uid})`)
              } else if (!fetchedEmail.body && !fetchedEmail.htmlBody && !fetchedEmail.textBody) {
                console.warn(`Fetched email ${id} but it has no body content (fetchedEmail exists but all body fields are empty)`)
              } else {
                // Update the email in database with the fetched body
                console.log(`Encrypting and updating body for email ${id}...`)
                const bodyEncrypted = encryption.encrypt(fetchedEmail.body || '')
                const htmlBodyEncrypted = fetchedEmail.htmlBody ? encryption.encrypt(fetchedEmail.htmlBody) : null
                const textBodyEncrypted = fetchedEmail.textBody ? encryption.encrypt(fetchedEmail.textBody) : null
                
                const result = this.db.prepare(`
                  UPDATE emails SET
                    body_encrypted = ?,
                    html_body_encrypted = ?,
                    text_body_encrypted = ?,
                    updated_at = ?
                  WHERE id = ?
                `).run(bodyEncrypted, htmlBodyEncrypted, textBodyEncrypted, Date.now(), id)
                
                console.log(`Database update result for ${id}: changes=${result.changes}`)
                
                // Update the mapped email with the fetched body
                mappedEmail.body = fetchedEmail.body || ''
                mappedEmail.htmlBody = fetchedEmail.htmlBody
                mappedEmail.textBody = fetchedEmail.textBody
                
                console.log(`Successfully fetched and updated body for email ${id} (body length: ${mappedEmail.body.length}, html: ${!!mappedEmail.htmlBody}, text: ${!!mappedEmail.textBody})`)
              }
            } catch (fetchErr) {
              console.error(`Error during fetch operation for email ${id}:`, fetchErr)
              throw fetchErr
            } finally {
              try {
                await imapClient.disconnect()
              } catch (disconnectErr) {
                console.error(`Error disconnecting IMAP client for email ${id}:`, disconnectErr)
              }
            }
          }
          
          try {
            await Promise.race([
              fetchWithTimeout(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Server fetch timeout')), fetchTimeoutMs)
              )
            ])
          } catch (fetchError: any) {
            if (fetchError.message === 'Server fetch timeout') {
              console.warn(`Timeout fetching email body from server for ${id} after ${fetchTimeoutMs}ms (sync may be running)`)
            } else {
              console.error(`Error fetching email body from server for ${id}:`, fetchError)
            }
            // Continue and return email without body - don't fail completely
          }
        } else {
          console.warn(`Account type ${account.type} does not support fetching email body by UID`)
        }
      } catch (error) {
        console.error(`Error attempting to fetch email body from server for ${id}:`, error)
        // Return the email without body rather than failing completely
      }
    }

    if (this.needsAddressRepair(mappedEmail)) {
      const repaired = await this.repairEmailAddresses(mappedEmail)
      if (repaired) {
        return repaired
      }
    }

    return mappedEmail
  }

  async listEmails(folderId: string, page: number = 0, limit: number = 50): Promise<Email[]> {
    const offset = page * limit
    const emails = this.db.prepare(`
      SELECT * FROM emails
      WHERE folder_id = ?
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `).all(folderId, limit, offset) as any[]

    return emails.map(e => this.mapDbEmailToEmail(e))
  }

  async syncFolderEmails(imapClient: any, accountId: string, folder: any, progressCallback?: SyncProgressCallback, fetchFullBodies: boolean = false, cancelToken?: { cancelled: boolean }): Promise<{ synced: number; errors: number }> {
    let synced = 0
    let errors = 0

    try {
      // Check cancellation before starting
      if (cancelToken?.cancelled) {
        return { synced: 0, errors: 0 }
      }

      // Use folder name for IMAP operations, ensure INBOX is uppercase
      const imapFolderName = folder.name.toUpperCase() === 'INBOX' ? 'INBOX' : folder.path
      console.log(`Fetching emails for folder: ${folder.name}, path: ${folder.path}, using IMAP name: ${imapFolderName}, id: ${folder.id}, fetchFullBodies: ${fetchFullBodies}`)

      // Default: metadata-only for fast initial sync, bodies loaded on-demand when viewing
      // Full bodies only when explicitly requested (e.g., rebuild operation)
      // Using 999999 to ensure we fetch all emails
      const emails = fetchFullBodies 
        ? await imapClient.fetchEmails(imapFolderName, 1, 999999)
        : await imapClient.fetchEmailMetadata(imapFolderName, 1, 999999)

      // Check cancellation after fetching emails list
      if (cancelToken?.cancelled) {
        return { synced: 0, errors: 0 }
      }

      console.log(`Found ${emails.length} emails in ${folder.name}`)
      if (emails.length === 0) {
        console.log(`No emails found. Folder details:`, {
          name: folder.name,
          path: folder.path,
          id: folder.id
        })
        // Don't send progress callback for empty folders - just return silently
        return { synced: 0, errors: 0 }
      }

      progressCallback?.({ folder: folder.name, folderId: folder.id, accountId, current: 0, total: emails.length })

      for (let i = 0; i < emails.length; i++) {
        // Check cancellation during loop
        if (cancelToken?.cancelled) {
          return { synced, errors }
        }

        const email = emails[i]
        try {
          // Ensure accountId matches the account being synced (in case IMAP client set wrong one)
          email.accountId = accountId
          email.folderId = folder.id
          console.log(`Storing email: accountId=${email.accountId}, folderId=${folder.id} (${folder.name}), uid=${email.uid}, subject=${email.subject?.substring(0, 50)}`)
          const storedId = await this.storeEmail(email)
          console.log(`Successfully stored email with id: ${storedId}`)
          synced++
          const emailSummary = this.buildSyncEmailSummary(email, storedId, folder)
          progressCallback?.({
            folder: folder.name,
            folderId: folder.id,
            accountId,
            current: i + 1,
            total: emails.length,
            emailUid: email.uid,
            email: emailSummary
          })
        } catch (err) {
          console.error(`Error storing email ${email.uid} for account ${email.accountId} in folder ${folder.id} (${folder.name}):`, err)
          errors++
          progressCallback?.({ folder: folder.name, folderId: folder.id, accountId, current: i + 1, total: emails.length, emailUid: email.uid })
        }

        await this.yieldForSync(i)
      }
    } catch (err: any) {
      // Check if this is a "mailbox doesn't exist" error
      if (this.isMailboxNotExistError(err)) {
        console.warn(`Folder ${folder.name} (path: ${folder.path}) no longer exists on server, removing from database`)
        try {
          // Remove the folder from database since it no longer exists on server
          this.db.prepare('DELETE FROM folders WHERE id = ?').run(folder.id)
          console.log(`Removed folder ${folder.name} from database`)
        } catch (dbErr) {
          console.error(`Error removing folder ${folder.name} from database:`, dbErr)
        }
        // Don't count this as an error since we've handled it
        return { synced: 0, errors: 0 }
      }
      console.error(`Error syncing folder ${folder.name}:`, err)
      errors++
    }

    return { synced, errors }
  }

  async syncFolder(accountId: string, folderId: string, progressCallback?: SyncProgressCallback, options?: { fetchFullBodies?: boolean }): Promise<{ synced: number; errors: number }> {
    const account = await accountManager.getAccount(accountId)
    if (!account) {
      throw new Error('Account not found')
    }

    // Check if sync was cancelled
    const cancelToken = this.cancellationTokens.get(accountId)
    if (cancelToken?.cancelled) {
      return { synced: 0, errors: 0 }
    }

    const folder = this.db.prepare('SELECT * FROM folders WHERE id = ? AND account_id = ?').get(folderId, accountId) as any
    if (!folder) {
      throw new Error('Folder not found')
    }

    let synced = 0
    let errors = 0

    try {
      if (account.type === 'imap') {
        const imapClient = getIMAPClient(account)
        await imapClient.connect()

        // Check cancellation again after connection
        if (cancelToken?.cancelled) {
          await imapClient.disconnect()
          return { synced: 0, errors: 0 }
        }

        // Show connecting status
        progressCallback?.({ folder: folder.name, folderId: folder.id, accountId, current: 0, total: undefined })

        // Get total count before fetching emails
        try {
          const imapFolderName = folder.name.toUpperCase() === 'INBOX' ? 'INBOX' : folder.path
          const status = await imapClient.getFolderStatus(imapFolderName)
          if (status.messages > 0) {
            // Send progress update with total count
            progressCallback?.({ folder: folder.name, folderId: folder.id, accountId, current: 0, total: status.messages })
          }
        } catch (statusError) {
          console.warn(`Could not get folder status for ${folder.name}, will get total from fetch:`, statusError)
          // Continue without total - will be set when emails are fetched
        }

        // Default to metadata-only for fast sync - bodies fetched on-demand when viewing emails
        const result = await this.syncFolderEmails(imapClient, accountId, folder, progressCallback, options?.fetchFullBodies ?? false, cancelToken)
        synced += result.synced
        errors += result.errors

        await imapClient.disconnect()
      }
    } catch (error) {
      console.error('Error syncing folder:', error)
      errors++
      // Don't send progress callback on error - let the frontend handle the error from the return value
    }

    return { synced, errors }
  }

  async clearAndResyncFolder(accountId: string, folderId: string, progressCallback?: SyncProgressCallback): Promise<{ synced: number; errors: number }> {
    console.log(`Clearing emails from folder ${folderId} and re-syncing with full bodies...`)
    
    // Delete all emails from this folder
    this.db.prepare('DELETE FROM emails WHERE folder_id = ?').run(folderId)
    console.log(`Cleared emails from folder ${folderId}`)
    
    // Re-sync with full bodies
    return await this.syncFolder(accountId, folderId, progressCallback, { fetchFullBodies: true })
  }

  cancelSync(accountId: string) {
    const token = this.cancellationTokens.get(accountId)
    if (token) {
      token.cancelled = true
    }
  }

  async syncAccount(accountId: string, progressCallback?: SyncProgressCallback, options?: { priorityInbox?: boolean; cancellationToken?: string }): Promise<{ synced: number; errors: number }> {
    const account = await accountManager.getAccount(accountId)
    if (!account) {
      throw new Error('Account not found')
    }

    // Create cancellation token if provided
    const cancellationToken = options?.cancellationToken || accountId
    const cancelToken = { cancelled: false }
    this.cancellationTokens.set(cancellationToken, cancelToken)

    let synced = 0
    let errors = 0

    try {
      if (account.type === 'imap') {
        const imapClient = getIMAPClient(account)
        await imapClient.connect()

        // Only sync folders if none exist (first time setup)
        if (!this.hasFolders(accountId)) {
          const serverFolders = await imapClient.listFolders()
          const dbFolders = this.db.prepare('SELECT * FROM folders WHERE account_id = ?').all(accountId) as any[]
          const now = Date.now()

          // Update/create folders in database
          progressCallback?.({ folder: 'folders', accountId, current: 0, total: serverFolders.length })
          for (let i = 0; i < serverFolders.length; i++) {
            if (cancelToken.cancelled) {
              await imapClient.disconnect()
              this.cancellationTokens.delete(cancellationToken)
              return { synced, errors }
            }
            const serverFolder = serverFolders[i]
            const existing = dbFolders.find(f => f.path === serverFolder.path)
            if (!existing) {
              const id = randomUUID()
              this.db.prepare(`
                INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?, ?)
              `).run(id, accountId, serverFolder.name, serverFolder.path, JSON.stringify(serverFolder.attributes), now, now)
              dbFolders.push({ id, name: serverFolder.name, path: serverFolder.path })
            }
            progressCallback?.({ folder: 'folders', accountId, current: i + 1, total: serverFolders.length })
          }
        }

        // Get folders from database for email syncing
        const dbFolders = this.db.prepare('SELECT * FROM folders WHERE account_id = ?').all(accountId) as any[]

        // If priority inbox is requested, sync only inbox
        if (options?.priorityInbox) {
          const inbox = dbFolders.find(f => f.name.toLowerCase() === 'inbox' || f.path.toLowerCase() === 'inbox')
          if (inbox) {
            try {
              if (cancelToken.cancelled) {
                await imapClient.disconnect()
                this.cancellationTokens.delete(cancellationToken)
                return { synced, errors }
              }
              progressCallback?.({ folder: inbox.name, folderId: inbox.id, accountId, current: 0, total: undefined })

              const imapFolderName = inbox.name.toUpperCase() === 'INBOX' ? 'INBOX' : inbox.path
              const emails = await imapClient.fetchEmails(imapFolderName, 1, 999999)

              if (emails.length > 0) {
                progressCallback?.({ folder: inbox.name, folderId: inbox.id, accountId, current: 0, total: emails.length })

                for (let i = 0; i < emails.length; i++) {
                  if (cancelToken.cancelled) {
                    await imapClient.disconnect()
                    this.cancellationTokens.delete(cancellationToken)
                    return { synced, errors }
                  }
                  const email = emails[i]
                  try {
                    email.accountId = accountId
                    email.folderId = inbox.id
                    const storedId = await this.storeEmail(email)
                    synced++
                    const emailSummary = this.buildSyncEmailSummary(email, storedId, inbox)
                    progressCallback?.({
                      folder: inbox.name,
                      folderId: inbox.id,
                      accountId,
                      current: i + 1,
                      total: emails.length,
                      emailUid: email.uid,
                      email: emailSummary
                    })
                  } catch (err) {
                    console.error(`Error storing email ${email.uid}:`, err)
                    errors++
                    progressCallback?.({ folder: inbox.name, folderId: inbox.id, accountId, current: i + 1, total: emails.length, emailUid: email.uid })
                  }
                  await this.yieldForSync(i)
                }
              }
            } catch (err: any) {
              if (this.isMailboxNotExistError(err)) {
                console.warn(`Folder ${inbox.name} no longer exists on server`)
                this.db.prepare('DELETE FROM folders WHERE id = ?').run(inbox.id)
                // Inbox doesn't exist, return with what we've synced so far
              } else {
                console.error(`Error syncing inbox:`, err)
                errors++
              }
            }
          }
          await imapClient.disconnect()
          this.cancellationTokens.delete(cancellationToken)
          return { synced, errors }
        }

        // Sync emails from subscribed folders (or all if none subscribed)
        const foldersToSync = dbFolders.filter(f => f.subscribed === 1)
        if (foldersToSync.length === 0) {
          // If no folders are subscribed, sync INBOX by default
          const inbox = dbFolders.find(f => f.name.toLowerCase() === 'inbox')
          if (inbox) {
            foldersToSync.push(inbox)
          } else if (dbFolders.length > 0) {
            foldersToSync.push(dbFolders[0])
          }
        }

        // Prioritize inbox - move it to the front if it exists
        const inboxIndex = foldersToSync.findIndex(f => f.name.toLowerCase() === 'inbox' || f.path.toLowerCase() === 'inbox')
        if (inboxIndex > 0) {
          const inbox = foldersToSync.splice(inboxIndex, 1)[0]
          foldersToSync.unshift(inbox)
        }

        for (const folder of foldersToSync) {
          if (cancelToken.cancelled) {
            await imapClient.disconnect()
            this.cancellationTokens.delete(cancellationToken)
            return { synced, errors }
          }
          try {
            progressCallback?.({ folder: folder.name, folderId: folder.id, accountId, current: 0, total: undefined })

            // Use folder name for IMAP operations, ensure INBOX is uppercase
            const imapFolderName = folder.name.toUpperCase() === 'INBOX' ? 'INBOX' : folder.path

            // Fetch all emails (use a very large number to get all emails)
            // For INBOX, we want to sync all emails, not just recent ones
            // Using 999999 to ensure we fetch all emails (fetchEmails treats >= 10000 as "fetch all")
            const emails = await imapClient.fetchEmails(imapFolderName, 1, 999999)

            if (emails.length === 0) {
              // Skip empty folders silently during account sync
              continue
            }

            progressCallback?.({ folder: folder.name, folderId: folder.id, accountId, current: 0, total: emails.length })

            for (let i = 0; i < emails.length; i++) {
              if (cancelToken.cancelled) {
                await imapClient.disconnect()
                this.cancellationTokens.delete(cancellationToken)
                return { synced, errors }
              }
              const email = emails[i]
              try {
                // Ensure accountId matches the account being synced (in case IMAP client set wrong one)
                email.accountId = accountId
                email.folderId = folder.id
                console.log(`Storing email: accountId=${email.accountId}, folderId=${folder.id} (${folder.name}), uid=${email.uid}, subject=${email.subject?.substring(0, 50)}`)
                const storedId = await this.storeEmail(email)
                console.log(`Successfully stored email with id: ${storedId}`)
                synced++
                const emailSummary = this.buildSyncEmailSummary(email, storedId, folder)
                progressCallback?.({
                  folder: folder.name,
                  folderId: folder.id,
                  accountId,
                  current: i + 1,
                  total: emails.length,
                  emailUid: email.uid,
                  email: emailSummary
                })
              } catch (err) {
                console.error(`Error storing email ${email.uid} for account ${email.accountId} in folder ${folder.id} (${folder.name}):`, err)
                errors++
                progressCallback?.({ folder: folder.name, folderId: folder.id, accountId, current: i + 1, total: emails.length, emailUid: email.uid })
              }

              await this.yieldForSync(i)
            }
          } catch (err: any) {
            // Check if this is a "mailbox doesn't exist" error
            if (this.isMailboxNotExistError(err)) {
              console.warn(`Folder ${folder.name} (path: ${folder.path}) no longer exists on server, removing from database`)
              try {
                // Remove the folder from database since it no longer exists on server
                this.db.prepare('DELETE FROM folders WHERE id = ?').run(folder.id)
                console.log(`Removed folder ${folder.name} from database`)
              } catch (dbErr) {
                console.error(`Error removing folder ${folder.name} from database:`, dbErr)
              }
              // Don't count this as an error since we've handled it
              continue
            }
            console.error(`Error syncing folder ${folder.name}:`, err)
            errors++
          }
        }

        await imapClient.disconnect()
        this.cancellationTokens.delete(cancellationToken)
      } else if (account.type === 'pop3') {
        const pop3Client = getPOP3Client(account)
        await pop3Client.connect()

        try {
          const emails = await pop3Client.fetchEmails(1, 100)
          for (const email of emails) {
            try {
              // Find or create INBOX folder
              let inboxFolder = this.db.prepare('SELECT id FROM folders WHERE account_id = ? AND name = ?')
                .get(accountId, 'INBOX') as any

              if (!inboxFolder) {
                const folderId = crypto.randomUUID()
                const now = Date.now()
                this.db.prepare(`
                  INSERT INTO folders (id, account_id, name, path, subscribed, created_at, updated_at)
                  VALUES (?, ?, ?, ?, 1, ?, ?)
                `).run(folderId, accountId, 'INBOX', 'INBOX', now, now)
                inboxFolder = { id: folderId }
              }

              email.folderId = inboxFolder.id
              await this.storeEmail(email)
              synced++
            } catch (err) {
              console.error(`Error storing email ${email.uid}:`, err)
              errors++
            }
          }
        } catch (err) {
          console.error('Error fetching POP3 emails:', err)
          errors++
        }

        await pop3Client.disconnect()
      }
    } catch (err) {
      console.error('Error syncing account:', err)
      errors++
    }

    return { synced, errors }
  }

  private async yieldForSync(index: number): Promise<void> {
    if ((index + 1) % SYNC_YIELD_INTERVAL === 0) {
      await new Promise<void>((resolve) => setImmediate(resolve))
    }
  }

  private buildSyncEmailSummary(email: Email, storedId: string, folder: any): Email {
    const baseBody = typeof email.body === 'string' ? email.body : ''
    const safeBody = baseBody.length > SYNC_BODY_PREVIEW_LIMIT
      ? baseBody.slice(0, SYNC_BODY_PREVIEW_LIMIT)
      : baseBody
    const safeText = typeof email.textBody === 'string'
      ? (email.textBody.length > SYNC_BODY_PREVIEW_LIMIT ? email.textBody.slice(0, SYNC_BODY_PREVIEW_LIMIT) : email.textBody)
      : undefined
    const safeHtml = typeof email.htmlBody === 'string'
      ? (email.htmlBody.length > SYNC_BODY_PREVIEW_LIMIT ? email.htmlBody.slice(0, SYNC_BODY_PREVIEW_LIMIT) : email.htmlBody)
      : undefined

    return {
      ...email,
      id: storedId,
      accountId: email.accountId,
      folderId: folder.id,
      body: safeBody,
      htmlBody: safeHtml,
      textBody: safeText,
      attachments: [],
      headers: undefined,
      createdAt: email.createdAt || Date.now(),
      updatedAt: Date.now()
    }
  }

  private mapDbEmailToEmail(dbEmail: any): Email {
    // Decrypt body with error handling
    let body = ''
    if (dbEmail.body_encrypted && typeof dbEmail.body_encrypted === 'string' && dbEmail.body_encrypted.trim().length > 0) {
      try {
        if (encryption.isValidEncryptedPayload(dbEmail.body_encrypted)) {
          body = encryption.decrypt(dbEmail.body_encrypted)
        } else {
          console.warn(`Invalid encrypted body format for email ${dbEmail.id}`)
        }
      } catch (error) {
        console.error(`Error decrypting body for email ${dbEmail.id}:`, error)
        // Continue with empty body - email metadata will still be available
      }
    }
    
    // Decrypt HTML body with error handling
    let htmlBody: string | undefined = undefined
    if (dbEmail.html_body_encrypted && typeof dbEmail.html_body_encrypted === 'string' && dbEmail.html_body_encrypted.trim().length > 0) {
      try {
        if (encryption.isValidEncryptedPayload(dbEmail.html_body_encrypted)) {
          htmlBody = encryption.decrypt(dbEmail.html_body_encrypted)
        } else {
          console.warn(`Invalid encrypted htmlBody format for email ${dbEmail.id}`)
        }
      } catch (error) {
        console.error(`Error decrypting HTML body for email ${dbEmail.id}:`, error)
        // Continue without HTML body
      }
    }
    
    // Decrypt text body with error handling
    let textBody: string | undefined = undefined
    if (dbEmail.text_body_encrypted && typeof dbEmail.text_body_encrypted === 'string' && dbEmail.text_body_encrypted.trim().length > 0) {
      try {
        if (encryption.isValidEncryptedPayload(dbEmail.text_body_encrypted)) {
          textBody = encryption.decrypt(dbEmail.text_body_encrypted)
        } else {
          console.warn(`Invalid encrypted textBody format for email ${dbEmail.id}`)
        }
      } catch (error) {
        console.error(`Error decrypting text body for email ${dbEmail.id}:`, error)
        // Continue without text body
      }
    }
    
    return {
      id: dbEmail.id,
      accountId: dbEmail.account_id,
      folderId: dbEmail.folder_id,
      uid: dbEmail.uid,
      messageId: dbEmail.message_id,
      subject: dbEmail.subject,
      from: JSON.parse(dbEmail.from_addresses),
      to: JSON.parse(dbEmail.to_addresses),
      cc: dbEmail.cc_addresses ? JSON.parse(dbEmail.cc_addresses) : undefined,
      bcc: dbEmail.bcc_addresses ? JSON.parse(dbEmail.bcc_addresses) : undefined,
      replyTo: dbEmail.reply_to_addresses ? JSON.parse(dbEmail.reply_to_addresses) : undefined,
      date: dbEmail.date,
      body: body,
      htmlBody: htmlBody,
      textBody: textBody,
      flags: dbEmail.flags ? JSON.parse(dbEmail.flags) : [],
      isRead: dbEmail.is_read === 1,
      isStarred: dbEmail.is_starred === 1,
      threadId: dbEmail.thread_id || undefined,
      inReplyTo: dbEmail.in_reply_to || undefined,
      references: dbEmail.email_references ? JSON.parse(dbEmail.email_references) : undefined,
      attachments: [], // Will be loaded separately if needed
      encrypted: dbEmail.encrypted === 1,
      signed: dbEmail.signed === 1,
      signatureVerified: dbEmail.signature_verified !== null ? dbEmail.signature_verified === 1 : undefined,
      createdAt: dbEmail.created_at,
      updatedAt: dbEmail.updated_at
    }
  }

  private needsAddressRepair(email: Email): boolean {
    const hasMissingAddress = (list?: EmailAddress[]) =>
      !list || list.some(addr => !addr || !addr.address)

    return hasMissingAddress(email.from) ||
      hasMissingAddress(email.to) ||
      hasMissingAddress(email.cc) ||
      hasMissingAddress(email.bcc) ||
      hasMissingAddress(email.replyTo)
  }

  private async repairEmailAddresses(email: Email): Promise<Email | null> {
    try {
      const account = await accountManager.getAccount(email.accountId)
      if (!account || account.type !== 'imap') {
        return null
      }

      const folder = this.db.prepare('SELECT path FROM folders WHERE id = ?').get(email.folderId) as any
      if (!folder?.path) {
        return null
      }

      const imapClient = getIMAPClient(account)
      await imapClient.connect()

      try {
        const addresses = await imapClient.fetchEnvelopeAddresses(folder.path, email.uid)
        if (!addresses) {
          return null
        }

        const updatedEmail: Email = {
          ...email,
          from: addresses.from.length ? addresses.from : email.from,
          to: addresses.to && addresses.to.length ? addresses.to : email.to,
          cc: addresses.cc && addresses.cc.length ? addresses.cc : email.cc,
          bcc: addresses.bcc && addresses.bcc.length ? addresses.bcc : email.bcc,
          replyTo: addresses.replyTo && addresses.replyTo.length ? addresses.replyTo : email.replyTo
        }

        this.db.prepare(`
          UPDATE emails
          SET from_addresses = ?,
              to_addresses = ?,
              cc_addresses = ?,
              bcc_addresses = ?,
              reply_to_addresses = ?,
              updated_at = ?
          WHERE id = ?
        `).run(
          JSON.stringify(updatedEmail.from || []),
          JSON.stringify(updatedEmail.to || []),
          updatedEmail.cc ? JSON.stringify(updatedEmail.cc) : null,
          updatedEmail.bcc ? JSON.stringify(updatedEmail.bcc) : null,
          updatedEmail.replyTo ? JSON.stringify(updatedEmail.replyTo) : null,
          Date.now(),
          email.id
        )

        return updatedEmail
      } finally {
        await imapClient.disconnect()
      }
    } catch (error) {
      console.error('Failed to repair email addresses', error)
      return null
    }
  }

  /**
   * Fetch email bodies for emails that only have metadata
   * This is called in the background when idle
   */
  async fetchEmailBodiesInBackground(accountId: string, folderId: string, limit: number = 10): Promise<number> {
    try {
      const account = await accountManager.getAccount(accountId)
      if (!account || account.type !== 'imap') {
        return 0
      }

      const folder = this.db.prepare('SELECT * FROM folders WHERE id = ? AND account_id = ?').get(folderId, accountId) as any
      if (!folder) {
        return 0
      }

      // Find emails without bodies (metadata only)
      const emailsWithoutBodies = this.db.prepare(`
        SELECT id, uid, account_id, folder_id 
        FROM emails 
        WHERE account_id = ? 
          AND folder_id = ?
          AND (body_encrypted IS NULL OR body_encrypted = '')
          AND (html_body_encrypted IS NULL OR html_body_encrypted = '')
          AND (text_body_encrypted IS NULL OR text_body_encrypted = '')
        ORDER BY date DESC
        LIMIT ?
      `).all(accountId, folderId, limit) as any[]

      if (emailsWithoutBodies.length === 0) {
        return 0
      }

      const imapClient = getIMAPClient(account)
      await imapClient.connect()

      try {
        const imapFolderName = folder.name.toUpperCase() === 'INBOX' ? 'INBOX' : folder.path
        let fetched = 0

        // Fetch bodies for each email
        for (const emailRow of emailsWithoutBodies) {
          try {
            const fetchedEmail = await imapClient.fetchEmailByUid(imapFolderName, emailRow.uid)
            
            if (fetchedEmail && (fetchedEmail.body || fetchedEmail.htmlBody || fetchedEmail.textBody)) {
              // Update the email in database with the fetched body
              const bodyEncrypted = encryption.encrypt(fetchedEmail.body || '')
              const htmlBodyEncrypted = fetchedEmail.htmlBody ? encryption.encrypt(fetchedEmail.htmlBody) : null
              const textBodyEncrypted = fetchedEmail.textBody ? encryption.encrypt(fetchedEmail.textBody) : null
              
              this.db.prepare(`
                UPDATE emails SET
                  body_encrypted = ?,
                  html_body_encrypted = ?,
                  text_body_encrypted = ?,
                  updated_at = ?
                WHERE id = ?
              `).run(bodyEncrypted, htmlBodyEncrypted, textBodyEncrypted, Date.now(), emailRow.id)
              
              fetched++
              console.log(`Background: Fetched body for email ${emailRow.id}`)
            }
          } catch (err) {
            console.error(`Background: Error fetching body for email ${emailRow.id}:`, err)
            // Continue with next email
          }
        }

        return fetched
      } finally {
        await imapClient.disconnect()
      }
    } catch (error) {
      console.error(`Background: Error fetching email bodies for folder ${folderId}:`, error)
      return 0
    }
  }
}

export const emailStorage = new EmailStorage()
