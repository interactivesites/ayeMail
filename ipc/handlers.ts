import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getDatabase, encryption } from '../database'
import { accountManager, getIMAPClient, getSMTPClient } from '../email'
import { emailStorage } from '../email/email-storage'
import { gpgManager } from '../gpg/manager'
import type { Account, Folder, Email, Reminder, Signature } from '../shared/types'

// Account handlers
export function registerAccountHandlers() {
  ipcMain.handle('accounts:list', async () => {
    const db = getDatabase()
    const accounts = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all()
    return accounts.map((acc: any) => ({
      ...acc,
      password_encrypted: undefined, // Don't send encrypted passwords
      oauth2_access_token_encrypted: undefined,
      oauth2_refresh_token_encrypted: undefined
    }))
  })

  ipcMain.handle('accounts:get', async (_, id: string) => {
    const account = await accountManager.getAccount(id)
    if (!account) {
      throw new Error('Account not found')
    }
    // Return account without sensitive data
    const { oauth2, ...safeAccount } = account
    return {
      ...safeAccount,
      oauth2: oauth2 ? { provider: oauth2.provider } : undefined
    }
  })

  ipcMain.handle('accounts:add', async (_, account: Account & { password?: string }) => {
    const db = getDatabase()
    const id = randomUUID()
    const now = Date.now()
    
    const stmt = db.prepare(`
      INSERT INTO accounts (
        id, name, email, type, imap_host, imap_port, imap_secure,
        pop3_host, pop3_port, pop3_secure, smtp_host, smtp_port, smtp_secure,
        auth_type, oauth2_provider, oauth2_access_token_encrypted,
        oauth2_refresh_token_encrypted, oauth2_expires_at, password_encrypted,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const passwordEncrypted = (account as any).password && account.authType === 'password'
      ? encryption.encryptCredential((account as any).password)
      : null
    
    stmt.run(
      id,
      account.name,
      account.email,
      account.type,
      account.imap?.host || null,
      account.imap?.port || null,
      account.imap?.secure ? 1 : 0,
      account.pop3?.host || null,
      account.pop3?.port || null,
      account.pop3?.secure ? 1 : 0,
      account.smtp.host,
      account.smtp.port,
      account.smtp.secure ? 1 : 0,
      account.authType,
      account.oauth2?.provider || null,
      account.oauth2?.accessToken ? encryption.encryptCredential(account.oauth2.accessToken) : null,
      account.oauth2?.refreshToken ? encryption.encryptCredential(account.oauth2.refreshToken) : null,
      account.oauth2?.expiresAt || null,
      passwordEncrypted,
      now,
      now
    )
    
    return { id, ...account }
  })

  ipcMain.handle('accounts:update', async (_, id: string, account: Partial<Account> & { password?: string }) => {
    const db = getDatabase()
    const now = Date.now()
    
    // Build dynamic update query
    const updates: string[] = []
    const values: any[] = []
    
    if (account.name !== undefined) {
      updates.push('name = ?')
      values.push(account.name)
    }
    if (account.email !== undefined) {
      updates.push('email = ?')
      values.push(account.email)
    }
    if (account.type !== undefined) {
      updates.push('type = ?')
      values.push(account.type)
    }
    if (account.imap) {
      updates.push('imap_host = ?', 'imap_port = ?', 'imap_secure = ?')
      values.push(account.imap.host || null, account.imap.port || null, account.imap.secure ? 1 : 0)
    }
    if (account.pop3) {
      updates.push('pop3_host = ?', 'pop3_port = ?', 'pop3_secure = ?')
      values.push(account.pop3.host || null, account.pop3.port || null, account.pop3.secure ? 1 : 0)
    }
    if (account.smtp) {
      updates.push('smtp_host = ?', 'smtp_port = ?', 'smtp_secure = ?')
      values.push(account.smtp.host, account.smtp.port, account.smtp.secure ? 1 : 0)
    }
    if (account.authType !== undefined) {
      updates.push('auth_type = ?')
      values.push(account.authType)
    }
    if (account.oauth2?.provider !== undefined) {
      updates.push('oauth2_provider = ?')
      values.push(account.oauth2.provider || null)
    }
    if (account.oauth2?.accessToken) {
      updates.push('oauth2_access_token_encrypted = ?')
      values.push(encryption.encryptCredential(account.oauth2.accessToken))
    }
    if (account.oauth2?.refreshToken) {
      updates.push('oauth2_refresh_token_encrypted = ?')
      values.push(encryption.encryptCredential(account.oauth2.refreshToken))
    }
    if (account.oauth2?.expiresAt !== undefined) {
      updates.push('oauth2_expires_at = ?')
      values.push(account.oauth2.expiresAt || null)
    }
    if ((account as any).password !== undefined && account.authType === 'password') {
      updates.push('password_encrypted = ?')
      values.push(encryption.encryptCredential((account as any).password))
    }
    
    if (updates.length === 0) {
      return { success: true }
    }
    
    updates.push('updated_at = ?')
    values.push(now)
    values.push(id)
    
    const stmt = db.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`)
    stmt.run(...values)
    
    return { success: true }
  })

  ipcMain.handle('accounts:remove', async (_, id: string) => {
    const db = getDatabase()
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('accounts:test', async (_, account: Account) => {
    const { testAccountConnection } = await import('../email/connection-tester')
    return testAccountConnection(account.id)
  })
}

// Folder handlers
export function registerFolderHandlers() {
  ipcMain.handle('folders:list', async (_, accountId: string) => {
    const db = getDatabase()
    const account = await accountManager.getAccount(accountId)
    if (!account) {
      throw new Error('Account not found')
    }

    // Sync folders from IMAP server
    if (account.type === 'imap') {
      try {
        const imapClient = getIMAPClient(account)
        await imapClient.connect()
        const serverFolders = await imapClient.listFolders()

        // Build folder hierarchy and update database
        const now = Date.now()
        const folderMap = new Map<string, any>()

        // First pass: collect all unique folder paths and create parent folders
        const allPaths = new Set<string>()
        for (const folder of serverFolders) {
          allPaths.add(folder.path)
          // Add all parent paths
          const delimiter = folder.delimiter || '/'
          const pathParts = folder.path.split(delimiter)
          let currentPath = ''
          for (let i = 0; i < pathParts.length - 1; i++) {
            currentPath = currentPath ? `${currentPath}${delimiter}${pathParts[i]}` : pathParts[i]
            allPaths.add(currentPath)
          }
        }

        // Create all folders (parents first, then children)
        const sortedPaths = Array.from(allPaths).sort((a, b) => {
          // Simple depth comparison - count path separators
          const depthA = (a.match(/[\/\\]/g) || []).length + 1
          const depthB = (b.match(/[\/\\]/g) || []).length + 1
          return depthA - depthB
        })

        for (const path of sortedPaths) {
          // Find the original folder data (may be undefined for parent folders we created)
          const originalFolder = serverFolders.find(f => f.path === path)
          const delimiter = originalFolder?.delimiter || '/'
          const pathParts = path.split(delimiter)
          const name = pathParts[pathParts.length - 1]

          // Check if this folder already exists
          const existing = db.prepare('SELECT id FROM folders WHERE account_id = ? AND path = ?').get(accountId, path) as any
          let folderId: string

          if (!existing) {
            folderId = randomUUID()
            db.prepare(`
              INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
              VALUES (?, ?, ?, ?, 1, ?, ?, ?)
            `).run(folderId, accountId, name, path, JSON.stringify(originalFolder?.attributes || []), now, now)
          } else {
            folderId = existing.id
            if (originalFolder) {
              db.prepare('UPDATE folders SET name = ?, attributes = ?, updated_at = ? WHERE id = ?')
                .run(originalFolder.name, JSON.stringify(originalFolder.attributes), now, existing.id)
            }
          }

          folderMap.set(path, {
            id: folderId,
            name: name,
            path: path,
            delimiter: delimiter,
            attributes: originalFolder?.attributes || [],
            children: []
          })
        }

        // Second pass: set parent-child relationships
        for (const [path, folderData] of folderMap) {
          const delimiter = folderData.delimiter
          const pathParts = path.split(delimiter)

          if (pathParts.length > 1) {
            const parentPath = pathParts.slice(0, -1).join(delimiter)
            const parent = folderMap.get(parentPath)

            if (parent) {
              db.prepare('UPDATE folders SET parent_id = ? WHERE id = ?').run(parent.id, folderData.id)
            }
          }
        }
        
        await imapClient.disconnect()
      } catch (error) {
        console.error('Error syncing folders:', error)
      }
    }

    // Build hierarchical folder structure
    const allFolders = db.prepare(`
      SELECT f.*, p.name as parent_name
      FROM folders f
      LEFT JOIN folders p ON f.parent_id = p.id
      WHERE f.account_id = ?
      ORDER BY CASE WHEN LOWER(f.name) = 'inbox' THEN 0 ELSE 1 END, f.name
    `).all(accountId) as any[]

    console.log('All folders from DB:', allFolders.map(f => ({
      id: f.id,
      name: f.name,
      path: f.path,
      parent_id: f.parent_id
    })))

    // Build tree structure
    const folderMap = new Map()
    const rootFolders: any[] = []

    // First pass: create folder objects
    for (const folder of allFolders) {
      folder.children = []
      folderMap.set(folder.id, folder)
    }

    // Second pass: build hierarchy
    for (const folder of allFolders) {
      if (folder.parent_id) {
        const parent = folderMap.get(folder.parent_id)
        if (parent) {
          parent.children.push(folder)
          console.log(`Added ${folder.name} as child of ${parent.name}`)
        } else {
          console.log(`Parent not found for ${folder.name}, parent_id: ${folder.parent_id}`)
          rootFolders.push(folder) // Fallback
        }
      } else {
        rootFolders.push(folder)
        console.log(`Added ${folder.name} as root folder`)
      }
    }

    console.log('Final tree structure:', rootFolders.map(f => ({
      name: f.name,
      children: f.children.map((c: any) => c.name)
    })))

    return rootFolders
  })

  ipcMain.handle('folders:create', async (_, accountId: string, name: string) => {
    const db = getDatabase()
    const account = await accountManager.getAccount(accountId)
    if (!account || account.type !== 'imap') {
      throw new Error('Account not found or not IMAP')
    }

    const imapClient = getIMAPClient(account)
    await imapClient.connect()
    await imapClient.createFolder(name)
    await imapClient.disconnect()

    const id = randomUUID()
    const now = Date.now()
    
    db.prepare(`
      INSERT INTO folders (id, account_id, name, path, subscribed, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(id, accountId, name, name, now, now)
    
    return { id, accountId, name, path: name, subscribed: true }
  })

  ipcMain.handle('folders:delete', async (_, accountId: string, name: string) => {
    const db = getDatabase()
    const account = await accountManager.getAccount(accountId)
    if (!account || account.type !== 'imap') {
      throw new Error('Account not found or not IMAP')
    }

    const imapClient = getIMAPClient(account)
    await imapClient.connect()
    await imapClient.deleteFolder(name)
    await imapClient.disconnect()

    db.prepare('DELETE FROM folders WHERE account_id = ? AND name = ?').run(accountId, name)
    return { success: true }
  })

  ipcMain.handle('folders:rename', async (_, accountId: string, oldName: string, newName: string) => {
    const db = getDatabase()
    const account = await accountManager.getAccount(accountId)
    if (!account || account.type !== 'imap') {
      throw new Error('Account not found or not IMAP')
    }

    const imapClient = getIMAPClient(account)
    await imapClient.connect()
    await imapClient.renameFolder(oldName, newName)
    await imapClient.disconnect()

    db.prepare('UPDATE folders SET name = ?, path = ?, updated_at = ? WHERE account_id = ? AND name = ?')
      .run(newName, newName, Date.now(), accountId, oldName)
    return { success: true }
  })

  ipcMain.handle('folders:subscribe', async (_, accountId: string, name: string, subscribed: boolean) => {
    const db = getDatabase()
    const account = await accountManager.getAccount(accountId)
    if (!account || account.type !== 'imap') {
      throw new Error('Account not found or not IMAP')
    }

    const imapClient = getIMAPClient(account)
    await imapClient.connect()
    await imapClient.subscribeFolder(name, subscribed)
    await imapClient.disconnect()

    db.prepare('UPDATE folders SET subscribed = ?, updated_at = ? WHERE account_id = ? AND name = ?')
      .run(subscribed ? 1 : 0, Date.now(), accountId, name)
    return { success: true }
  })
}

// Email handlers
export function registerEmailHandlers() {
  ipcMain.handle('emails:list', async (_, folderId: string, page: number = 0, limit: number = 50) => {
    const emails = await emailStorage.listEmails(folderId, page, limit)
    // Return simplified list without full body
    return emails.map(email => ({
      id: email.id,
      accountId: email.accountId,
      folderId: email.folderId,
      uid: email.uid,
      messageId: email.messageId,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      isRead: email.isRead,
      isStarred: email.isStarred,
      encrypted: email.encrypted,
      signed: email.signed,
      signatureVerified: email.signatureVerified
    }))
  })

  ipcMain.handle('emails:get', async (_, id: string) => {
    const email = await emailStorage.getEmail(id)
    if (!email) {
      return null
    }

    // Load attachments
    const db = getDatabase()
    const attachments = db.prepare('SELECT * FROM attachments WHERE email_id = ?').all(id) as any[]
    email.attachments = attachments.map((att: any) => ({
      id: att.id,
      emailId: att.email_id,
      filename: att.filename,
      contentType: att.content_type,
      size: att.size,
      contentId: att.content_id,
      data: encryption.decryptBuffer(att.data_encrypted)
    }))

    return email
  })

  ipcMain.handle('emails:sync-folder', async (event, accountId: string, folderId: string) => {
    try {
      const account = await accountManager.getAccount(accountId)
      if (!account) {
        return { success: false, message: 'Account not found' }
      }

      // Progress callback
      const progressCallback = (data: { folder?: string; current: number; total?: number; emailUid?: number }) => {
        console.info(`Sync progress: ${data.folder || 'Unknown'} - ${data.current}/${data.total || 'unknown'} (uid: ${data.emailUid || 'N/A'})`)
        event.sender.send('emails:sync-progress', data)
      }

      const result = await emailStorage.syncFolder(accountId, folderId, progressCallback)
      return {
        success: true,
        synced: result.synced,
        errors: result.errors,
        message: `Synced ${result.synced} emails${result.errors > 0 ? ` with ${result.errors} errors` : ''}`
      }
    } catch (error: any) {
      console.error('Sync folder error:', error)
      return { success: false, message: error.message || 'Unknown error during folder sync' }
    }
  })

  ipcMain.handle('emails:sync', async (event, accountId: string) => {
    try {
      const account = await accountManager.getAccount(accountId)
      if (!account) {
        return { success: false, message: 'Account not found' }
      }

      // Progress callback
      const progressCallback = (data: { folder?: string; current: number; total?: number; emailUid?: number }) => {
        console.info(`Sync progress: ${data.folder || 'Unknown'} - ${data.current}/${data.total || 'unknown'} (uid: ${data.emailUid || 'N/A'})`)
        event.sender.send('emails:sync-progress', data)
      }

      // Ensure folders are synced first (this is handled in syncAccount, but we can also do it here)
      const result = await emailStorage.syncAccount(accountId, progressCallback)
      return {
        success: true,
        synced: result.synced,
        errors: result.errors,
        message: `Synced ${result.synced} emails${result.errors > 0 ? ` with ${result.errors} errors` : ''}`
      }
    } catch (error: any) {
      console.error('Sync error:', error)
      return { success: false, message: error.message || 'Unknown error during sync' }
    }
  })

  ipcMain.handle('emails:send', async (_, email: any) => {
    try {
      const account = await accountManager.getAccount(email.accountId)
      if (!account) {
        return { success: false, message: 'Account not found' }
      }

      const smtpClient = getSMTPClient(account)
      const result = await smtpClient.sendEmail({
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        subject: email.subject,
        body: email.body,
        htmlBody: email.htmlBody,
        attachments: email.attachments,
        encrypted: email.encrypted,
        signed: email.signed
      })

      return result
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('emails:delete', async (_, id: string) => {
    const db = getDatabase()
    db.prepare('DELETE FROM emails WHERE id = ?').run(id)
    return { success: true }
  })
}

// Reminder handlers
export function registerReminderHandlers() {
  ipcMain.handle('reminders:list', async () => {
    const db = getDatabase()
    return db.prepare(`
      SELECT r.*, e.subject, e.from_addresses
      FROM reminders r
      JOIN emails e ON r.email_id = e.id
      WHERE r.completed = 0
      ORDER BY r.due_date ASC
    `).all()
  })

  ipcMain.handle('reminders:create', async (_, reminder: Omit<Reminder, 'id' | 'createdAt'>) => {
    const db = getDatabase()
    const id = randomUUID()
    const now = Date.now()
    
    db.prepare(`
      INSERT INTO reminders (id, email_id, account_id, due_date, message, completed, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(id, reminder.emailId, reminder.accountId, reminder.dueDate, reminder.message || null, now)
    
    return { id, ...reminder, completed: false, createdAt: now }
  })

  ipcMain.handle('reminders:update', async (_, id: string, reminder: Partial<Reminder>) => {
    const db = getDatabase()
    const updates: string[] = []
    const values: any[] = []
    
    if (reminder.dueDate !== undefined) {
      updates.push('due_date = ?')
      values.push(reminder.dueDate)
    }
    if (reminder.message !== undefined) {
      updates.push('message = ?')
      values.push(reminder.message)
    }
    if (reminder.completed !== undefined) {
      updates.push('completed = ?')
      values.push(reminder.completed ? 1 : 0)
    }
    
    values.push(id)
    db.prepare(`UPDATE reminders SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    
    return { success: true }
  })

  ipcMain.handle('reminders:delete', async (_, id: string) => {
    const db = getDatabase()
    db.prepare('DELETE FROM reminders WHERE id = ?').run(id)
    return { success: true }
  })
}

// Signature handlers
export function registerSignatureHandlers() {
  ipcMain.handle('signatures:list', async (_, accountId: string) => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM signatures WHERE account_id = ? ORDER BY is_default DESC, created_at DESC').all(accountId)
  })

  ipcMain.handle('signatures:create', async (_, accountId: string, signature: Omit<Signature, 'id' | 'accountId' | 'createdAt'>) => {
    const db = getDatabase()
    const id = randomUUID()
    const now = Date.now()
    
    // If this is default, unset other defaults
    if (signature.isDefault) {
      db.prepare('UPDATE signatures SET is_default = 0 WHERE account_id = ?').run(accountId)
    }
    
    db.prepare(`
      INSERT INTO signatures (id, account_id, name, html, text, is_default, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, accountId, signature.name, signature.html || null, signature.text || null, signature.isDefault ? 1 : 0, now)
    
    return { id, accountId, ...signature, createdAt: now }
  })

  ipcMain.handle('signatures:update', async (_, id: string, signature: Partial<Signature>) => {
    const db = getDatabase()
    const updates: string[] = []
    const values: any[] = []
    
    if (signature.name) {
      updates.push('name = ?')
      values.push(signature.name)
    }
    if (signature.html !== undefined) {
      updates.push('html = ?')
      values.push(signature.html)
    }
    if (signature.text !== undefined) {
      updates.push('text = ?')
      values.push(signature.text)
    }
    if (signature.isDefault !== undefined) {
      if (signature.isDefault) {
        // Unset other defaults for this account
        const sig = db.prepare('SELECT account_id FROM signatures WHERE id = ?').get(id) as any
        if (sig) {
          db.prepare('UPDATE signatures SET is_default = 0 WHERE account_id = ?').run(sig.account_id)
        }
      }
      updates.push('is_default = ?')
      values.push(signature.isDefault ? 1 : 0)
    }
    
    values.push(id)
    db.prepare(`UPDATE signatures SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    
    return { success: true }
  })

  ipcMain.handle('signatures:delete', async (_, id: string) => {
    const db = getDatabase()
    db.prepare('DELETE FROM signatures WHERE id = ?').run(id)
    return { success: true }
  })
}

// GPG handlers
export function registerGPGHandlers() {
  ipcMain.handle('gpg:listKeys', async () => {
    try {
      return await gpgManager.listKeys()
    } catch (error: any) {
      throw new Error(`Failed to list keys: ${error.message}`)
    }
  })

  ipcMain.handle('gpg:importKey', async (_, keyData: string, isPrivate: boolean = false) => {
    try {
      const key = await gpgManager.importKey(keyData, isPrivate)
      return { success: true, key }
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('gpg:encrypt', async (_, data: string, recipientKeys: string[]) => {
    try {
      const encrypted = await gpgManager.encrypt(data, recipientKeys)
      return { success: true, encrypted }
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('gpg:decrypt', async (_, encryptedData: string, privateKeyFingerprint: string, passphrase?: string) => {
    try {
      const decrypted = await gpgManager.decrypt(encryptedData, privateKeyFingerprint, passphrase)
      return { success: true, decrypted }
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('gpg:sign', async (_, data: string, keyId: string, passphrase?: string) => {
    try {
      const signature = await gpgManager.sign(data, keyId, passphrase)
      return { success: true, signature }
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('gpg:verify', async (_, data: string, signature: string, publicKeyFingerprint?: string) => {
    try {
      const result = await gpgManager.verify(data, signature, publicKeyFingerprint)
      return { success: true, ...result }
    } catch (error: any) {
      return { success: false, verified: false, message: error.message }
    }
  })
}

// Register all handlers
export function registerAllHandlers() {
  registerAccountHandlers()
  registerFolderHandlers()
  registerEmailHandlers()
  registerReminderHandlers()
  registerSignatureHandlers()
  registerGPGHandlers()
}

