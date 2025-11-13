import { randomUUID } from 'crypto'
import { getDatabase, encryption } from '../database'
import { accountManager, getIMAPClient, getPOP3Client } from './index'
import type { Email, Attachment } from '../shared/types'

export class EmailStorage {
  private db = getDatabase()

  async storeEmail(email: Email): Promise<string> {
    const existing = this.db.prepare(`
      SELECT id FROM emails WHERE account_id = ? AND folder_id = ? AND uid = ?
    `).get(email.accountId, email.folderId, email.uid) as any

    if (existing) {
      // Update existing email
      return this.updateEmail(existing.id, email)
    }

    // Insert new email
    const id = email.id || `${email.accountId}-${email.folderId}-${email.uid}`
    const now = Date.now()

    // Encrypt body
    const bodyEncrypted = encryption.encrypt(email.body)
    const htmlBodyEncrypted = email.htmlBody ? encryption.encrypt(email.htmlBody) : null
    const textBodyEncrypted = email.textBody ? encryption.encrypt(email.textBody) : null

    this.db.prepare(`
      INSERT INTO emails (
        id, account_id, folder_id, uid, message_id, subject,
        from_addresses, to_addresses, cc_addresses, bcc_addresses, reply_to_addresses,
        date, body_encrypted, html_body_encrypted, text_body_encrypted,
        flags, is_read, is_starred, thread_id, in_reply_to, email_references,
        encrypted, signed, signature_verified, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      JSON.stringify(email.flags),
      email.isRead ? 1 : 0,
      email.isStarred ? 1 : 0,
      email.threadId || null,
      email.inReplyTo || null,
      email.references ? JSON.stringify(email.references) : null,
      email.encrypted ? 1 : 0,
      email.signed ? 1 : 0,
      email.signatureVerified !== undefined ? (email.signatureVerified ? 1 : 0) : null,
      now,
      now
    )

    // Store attachments
    if (email.attachments && email.attachments.length > 0) {
      for (const attachment of email.attachments) {
        await this.storeAttachment(id, attachment)
      }
    }

    return id
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

  async getEmail(id: string): Promise<Email | null> {
    const email = this.db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as any
    if (!email) return null

    return this.mapDbEmailToEmail(email)
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

  async syncAccount(accountId: string, progressCallback?: (data: { folder?: string; current: number; total?: number; emailUid?: number }) => void): Promise<{ synced: number; errors: number }> {
    const account = await accountManager.getAccount(accountId)
    if (!account) {
      throw new Error('Account not found')
    }

    let synced = 0
    let errors = 0

    try {
      if (account.type === 'imap') {
        const imapClient = getIMAPClient(account)
        await imapClient.connect()

        // First, ensure folders are synced
        const serverFolders = await imapClient.listFolders()
        const dbFolders = this.db.prepare('SELECT * FROM folders WHERE account_id = ?').all(accountId) as any[]
        const now = Date.now()

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
            dbFolders.push({ id, name: serverFolder.name, path: serverFolder.path })
          }
          progressCallback?.({ folder: 'folders', current: i + 1, total: serverFolders.length })
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

        for (const folder of foldersToSync) {
          try {
            progressCallback?.({ folder: folder.name, current: 0, total: undefined })

            // Fetch recent emails (limit to 100 for performance)
            const emails = await imapClient.fetchEmails(folder.path, 1, 100)

            progressCallback?.({ folder: folder.name, current: 0, total: emails.length })

            if (emails.length === 0) {
              progressCallback?.({ folder: folder.name, current: 0, total: 0 })
              continue
            }

            for (let i = 0; i < emails.length; i++) {
              const email = emails[i]
              try {
                email.folderId = folder.id
                await this.storeEmail(email)
                synced++
                progressCallback?.({ folder: folder.name, current: i + 1, total: emails.length, emailUid: email.uid })
              } catch (err) {
                console.error(`Error storing email ${email.uid}:`, err)
                errors++
                progressCallback?.({ folder: folder.name, current: i + 1, total: emails.length, emailUid: email.uid })
              }
            }
          } catch (err) {
            console.error(`Error syncing folder ${folder.name}:`, err)
            errors++
          }
        }

        await imapClient.disconnect()
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

  private mapDbEmailToEmail(dbEmail: any): Email {
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
      body: encryption.decrypt(dbEmail.body_encrypted),
      htmlBody: dbEmail.html_body_encrypted ? encryption.decrypt(dbEmail.html_body_encrypted) : undefined,
      textBody: dbEmail.text_body_encrypted ? encryption.decrypt(dbEmail.text_body_encrypted) : undefined,
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
}

export const emailStorage = new EmailStorage()

