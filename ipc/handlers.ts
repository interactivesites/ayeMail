import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { randomUUID } from 'crypto'
import { writeFileSync } from 'fs'
import { getDatabase, encryption } from '../database'
import { accountManager, getIMAPClient, getSMTPClient } from '../email'
import { emailStorage } from '../email/email-storage'
import { contactManager } from '../email/contact-manager'
import { gpgManager } from '../gpg/manager'
import { autoSyncScheduler } from '../email/auto-sync'
import type { Account, Folder, Email, Reminder, Signature } from '../shared/types'
import { Logger } from '../shared/logger'

const logger = Logger.create('IPC')

function decryptEmailField(value: unknown, emailId: string, fieldLabel: string): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined
  }

  if (!encryption.isValidEncryptedPayload(value)) {
    logger.warn(`Invalid encrypted ${fieldLabel} format for email ${emailId}`)
    return undefined
  }

  try {
    return encryption.decrypt(value)
  } catch (error) {
    logger.error(`Error decrypting ${fieldLabel} for email ${emailId}:`, error)
    return undefined
  }
}

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
    
    // Add default from address for new account
    try {
      const { randomUUID } = await import('crypto')
      const fromAddressId = randomUUID()
      db.prepare(`
        INSERT INTO account_from_addresses (id, account_id, email, name, is_default, created_at)
        VALUES (?, ?, ?, ?, 1, ?)
      `).run(fromAddressId, id, account.email, account.name || null, now)
    } catch (error: any) {
      logger.error('Error adding default from address:', error)
      // Don't fail account creation if from address creation fails
    }
    
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

  ipcMain.handle('accounts:probe', async (_, account: any) => {
    const { testAccountSettings } = await import('../email/connection-tester')
    return testAccountSettings(account)
  })

  // From addresses handlers
  ipcMain.handle('accounts:fromAddresses:list', async (_, accountId: string) => {
    const db = getDatabase()
    const addresses = db.prepare('SELECT * FROM account_from_addresses WHERE account_id = ? ORDER BY is_default DESC, created_at ASC').all(accountId)
    return addresses.map((addr: any) => ({
      id: addr.id,
      accountId: addr.account_id,
      email: addr.email,
      name: addr.name,
      isDefault: addr.is_default === 1,
      createdAt: addr.created_at
    }))
  })

  ipcMain.handle('accounts:fromAddresses:add', async (_, accountId: string, email: string, name?: string, isDefault?: boolean) => {
    const db = getDatabase()
    const { randomUUID } = await import('crypto')
    const id = randomUUID()
    const now = Date.now()

    // If this is set as default, unset other defaults for this account
    if (isDefault) {
      db.prepare('UPDATE account_from_addresses SET is_default = 0 WHERE account_id = ?').run(accountId)
    }

    try {
      db.prepare(`
        INSERT INTO account_from_addresses (id, account_id, email, name, is_default, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, accountId, email, name || null, isDefault ? 1 : 0, now)

      return { success: true, id }
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE')) {
        return { success: false, message: 'This email address already exists for this account' }
      }
      throw error
    }
  })

  ipcMain.handle('accounts:fromAddresses:update', async (_, id: string, updates: { email?: string; name?: string; isDefault?: boolean }) => {
    const db = getDatabase()
    const address = db.prepare('SELECT account_id FROM account_from_addresses WHERE id = ?').get(id) as any
    if (!address) {
      return { success: false, message: 'From address not found' }
    }

    // If setting as default, unset other defaults for this account
    if (updates.isDefault) {
      db.prepare('UPDATE account_from_addresses SET is_default = 0 WHERE account_id = ? AND id != ?').run(address.account_id, id)
    }

    const updatesList: string[] = []
    const values: any[] = []
    if (updates.email !== undefined) {
      updatesList.push('email = ?')
      values.push(updates.email)
    }
    if (updates.name !== undefined) {
      updatesList.push('name = ?')
      values.push(updates.name)
    }
    if (updates.isDefault !== undefined) {
      updatesList.push('is_default = ?')
      values.push(updates.isDefault ? 1 : 0)
    }

    if (updatesList.length === 0) {
      return { success: true }
    }

    values.push(id)
    db.prepare(`UPDATE account_from_addresses SET ${updatesList.join(', ')} WHERE id = ?`).run(...values)

    return { success: true }
  })

  ipcMain.handle('accounts:fromAddresses:remove', async (_, id: string) => {
    const db = getDatabase()
    const address = db.prepare('SELECT account_id, is_default FROM account_from_addresses WHERE id = ?').get(id) as any
    if (!address) {
      return { success: false, message: 'From address not found' }
    }

    // Don't allow removing the last from address for an account
    const count = db.prepare('SELECT COUNT(*) as count FROM account_from_addresses WHERE account_id = ?').get(address.account_id) as any
    if (count.count <= 1) {
      return { success: false, message: 'Cannot remove the last from address for an account' }
    }

    db.prepare('DELETE FROM account_from_addresses WHERE id = ?').run(id)

    // If we removed the default, set the first remaining one as default
    if (address.is_default === 1) {
      const remaining = db.prepare('SELECT id FROM account_from_addresses WHERE account_id = ? ORDER BY created_at ASC LIMIT 1').get(address.account_id) as any
      if (remaining) {
        db.prepare('UPDATE account_from_addresses SET is_default = 1 WHERE id = ?').run(remaining.id)
      }
    }

    return { success: true }
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
        
        logger.log(`[folders:list] Retrieved ${serverFolders.length} folders from server for account ${accountId}`)
        logger.log('[folders:list] Server folders:', serverFolders.map(f => ({ name: f.name, path: f.path, delimiter: f.delimiter })))

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
              logger.log(`[folders:list] Setting parent for ${path}: parent is ${parentPath} (${parent.id})`)
              db.prepare('UPDATE folders SET parent_id = ? WHERE id = ?').run(parent.id, folderData.id)
            } else {
              logger.log(`[folders:list] No parent found for ${path}, expected parent: ${parentPath}`)
            }
          }
        }
        
        // Third pass: remove folders from database that no longer exist on server
        const serverPaths = new Set(allPaths)
        const dbFolders = db.prepare('SELECT id, path FROM folders WHERE account_id = ?').all(accountId) as any[]
        for (const dbFolder of dbFolders) {
          if (!serverPaths.has(dbFolder.path)) {
            logger.log(`Removing folder from database that no longer exists on server: ${dbFolder.path}`)
            db.prepare('DELETE FROM folders WHERE id = ?').run(dbFolder.id)
          }
        }
        
        await imapClient.disconnect()
      } catch (error) {
        logger.error('Error syncing folders:', error)
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

    logger.log('All folders from DB:', allFolders.map(f => ({
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
          logger.log(`Added ${folder.name} as child of ${parent.name}`)
        } else {
          logger.log(`Parent not found for ${folder.name}, parent_id: ${folder.parent_id}`)
          rootFolders.push(folder) // Fallback
        }
      } else {
        rootFolders.push(folder)
        logger.log(`Added ${folder.name} as root folder`)
      }
    }

    logger.log('Final tree structure:', rootFolders.map(f => ({
      name: f.name,
      children: f.children.map((c: any) => c.name)
    })))

    return rootFolders
  })

  ipcMain.handle('folders:sync-only', async (event, accountId: string) => {
    try {
      const account = await accountManager.getAccount(accountId)
      if (!account) {
        return { success: false, message: 'Account not found' }
      }

      // Progress callback
      const progressCallback = (data: { folder?: string; current: number; total?: number; emailUid?: number }) => {
        logger.info(`Folder sync progress: ${data.folder || 'Unknown'} - ${data.current}/${data.total || 'unknown'}`)
        event.sender.send('emails:sync-progress', data)
      }

      const result = await emailStorage.syncFoldersOnly(accountId, progressCallback)
      return {
        success: true,
        synced: result.synced,
        message: `Synced ${result.synced} folders`
      }
    } catch (error: any) {
      logger.error('Folder sync error:', error)
      return { success: false, message: error.message || 'Unknown error during folder sync' }
    }
  })

  ipcMain.handle('folders:create', async (_, accountId: string, name: string) => {
    const db = getDatabase()
    const account = await accountManager.getAccount(accountId)
    if (!account) {
      throw new Error('Account not found')
    }

    // Check if folder already exists
    const existing = db.prepare(`
      SELECT * FROM folders 
      WHERE account_id = ? AND (LOWER(name) = ? OR LOWER(path) = ?)
    `).get(accountId, name.toLowerCase(), name.toLowerCase()) as any

    if (existing) {
      return existing
    }

    // For IMAP accounts, create folder on server
    if (account.type === 'imap') {
      const imapClient = getIMAPClient(account)
      await imapClient.connect()
      try {
        await imapClient.createFolder(name)
      } catch (error: any) {
        // If folder already exists on server, that's fine
        if (!error.message?.includes('already exists') && !error.message?.includes('EXISTS')) {
          await imapClient.disconnect()
          throw error
        }
      }
      await imapClient.disconnect()
    }

    // Create folder in database (for both IMAP and non-IMAP accounts)
    const id = randomUUID()
    const now = Date.now()
    
    db.prepare(`
      INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    `).run(id, accountId, name, name, JSON.stringify([]), now, now)
    
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

  ipcMain.handle('folders:get-learned', async (_, accountId: string, senderEmail: string) => {
    const db = getDatabase()
    
    // Normalize sender email (lowercase, trim)
    const normalizedSenderEmail = senderEmail.toLowerCase().trim()
    
    if (!normalizedSenderEmail) {
      return []
    }
    
    // Query sender_folder_mappings joined with folders to get folder details
    const mappings = db.prepare(`
      SELECT 
        sfm.folder_id,
        f.name as folder_name,
        f.path as folder_path,
        sfm.move_count,
        sfm.last_moved_at
      FROM sender_folder_mappings sfm
      JOIN folders f ON sfm.folder_id = f.id
      WHERE sfm.account_id = ? AND sfm.sender_email = ?
      ORDER BY sfm.move_count DESC, sfm.last_moved_at DESC
      LIMIT 10
    `).all(accountId, normalizedSenderEmail) as Array<{
      folder_id: string
      folder_name: string
      folder_path: string
      move_count: number
      last_moved_at: number
    }>
    
    // Transform to match expected format
    return mappings.map(m => ({
      folderId: m.folder_id,
      folderName: m.folder_name,
      folderPath: m.folder_path,
      moveCount: m.move_count,
      lastMovedAt: m.last_moved_at
    }))
  })

  // Check if spam folders have emails from today
  ipcMain.handle('folders:hasSpamToday', async () => {
    const db = getDatabase()
    
    // Get start of today (midnight) in milliseconds
    const now = Date.now()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const startOfToday = today.getTime()
    
    // Find all spam/junk folders
    const spamFolders = db.prepare(`
      SELECT id FROM folders 
      WHERE (LOWER(name) = 'spam' OR LOWER(name) = 'junk' OR LOWER(path) LIKE '%spam%' OR LOWER(path) LIKE '%junk%')
    `).all() as any[]
    
    if (spamFolders.length === 0) {
      return false
    }
    
    const folderIds = spamFolders.map(f => f.id)
    
    // Check if any spam folder has emails from today
    const hasSpamToday = db.prepare(`
      SELECT COUNT(*) as count FROM emails 
      WHERE folder_id IN (${folderIds.map(() => '?').join(',')})
      AND date >= ?
      LIMIT 1
    `).get(...folderIds, startOfToday) as any
    
    return (hasSpamToday?.count || 0) > 0
  })
}

// Email handlers
export function registerEmailHandlers() {
  ipcMain.handle('emails:list', async (_, folderId: string, page: number = 0, limit: number = 50, threadView: boolean = true) => {
    const db = getDatabase()
    const offset = page * limit
    
    // Debug: Check folder exists and get account info
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId) as any
    if (!folder) {
      logger.warn(`Folder not found: ${folderId}`)
      return []
    }
    logger.log(`Listing emails for folder: ${folder.name} (id: ${folderId}, account: ${folder.account_id}, threadView: ${threadView})`)
    
    // Get emails from database
    const allEmails = db.prepare(`
      SELECT emails.*,
        (SELECT COUNT(*) FROM attachments WHERE email_id = emails.id) as attachmentCount
      FROM emails
      WHERE folder_id = ?
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `).all(folderId, threadView ? limit * 3 : limit, offset) as any[]
    
    let emailsToReturn: any[]
    
    if (threadView) {
      // Group by threadId and keep only the latest email per thread
      const threadMap = new Map<string, any>()
      for (const email of allEmails) {
        const threadId = email.thread_id || email.message_id // Fallback to messageId if no threadId
        if (!threadMap.has(threadId) || email.date > threadMap.get(threadId).date) {
          threadMap.set(threadId, email)
        }
      }
      
      // Get the latest email from each thread, sorted by date
      emailsToReturn = Array.from(threadMap.values())
        .sort((a, b) => b.date - a.date)
        .slice(0, limit)
    } else {
      // Return all emails without grouping
      emailsToReturn = allEmails
    }
    
    // Calculate threadCount for each email (count emails with same threadId in folder)
    const threadCounts = new Map<string, number>()
    const allFolderEmails = db.prepare(`
      SELECT thread_id, message_id FROM emails WHERE folder_id = ?
    `).all(folderId) as any[]
    
    for (const e of allFolderEmails) {
      const threadId = e.thread_id || e.message_id
      threadCounts.set(threadId, (threadCounts.get(threadId) || 0) + 1)
    }
    
    logger.log(`Found ${emailsToReturn.length} emails ${threadView ? '(grouped by thread)' : '(ungrouped)'} in folder ${folder.name} (id: ${folderId})`)
    
    // Get all reminder info for emails in this folder (for showing reminder icons)
    // Include both active and completed reminders - completed reminders indicate emails moved back from Reminders
    const emailIds = emailsToReturn.map(e => e.id)
    const reminderMap = new Map<string, any>()
    if (emailIds.length > 0) {
      const placeholders = emailIds.map(() => '?').join(',')
      const reminders = db.prepare(`
        SELECT email_id, due_date, id, completed
        FROM reminders
        WHERE email_id IN (${placeholders})
      `).all(...emailIds) as any[]
      
      for (const reminder of reminders) {
        reminderMap.set(reminder.email_id, reminder)
      }
    }
    
    // Map to return format with decrypted body content
    const mappedEmails = emailsToReturn.map(e => {
      // Decrypt body with error handling
      const decryptedBody = decryptEmailField(e.body_encrypted, e.id, 'body')
      const decryptedHtmlBody = decryptEmailField(e.html_body_encrypted, e.id, 'htmlBody')
      const decryptedTextBody = decryptEmailField(e.text_body_encrypted, e.id, 'textBody')
      const body = decryptedBody ?? ''
      const htmlBody = decryptedHtmlBody
      const textBody = decryptedTextBody
      
      const threadId = e.thread_id || e.message_id
      const threadCount = threadCounts.get(threadId) || 1
      const reminder = reminderMap.get(e.id)
      
      return {
        id: e.id,
        accountId: e.account_id,
        folderId: e.folder_id,
        uid: e.uid,
        messageId: e.message_id,
        subject: e.subject,
        from: JSON.parse(e.from_addresses),
        to: JSON.parse(e.to_addresses),
        date: e.date,
        body: body,
        textBody: textBody,
        htmlBody: htmlBody,
        isRead: e.is_read === 1,
        isStarred: e.is_starred === 1,
        encrypted: e.encrypted === 1,
        signed: e.signed === 1,
        signatureVerified: e.signature_verified !== null ? e.signature_verified === 1 : undefined,
        status: e.status || null,
        attachmentCount: e.attachmentCount || 0,
        threadId: threadId,
        threadCount: threadCount,
        hasReminder: !!reminder,
        reminderDueDate: reminder?.due_date || null,
        reminderCompleted: reminder?.completed === 1 || false
      }
    })
    
    return mappedEmails
  })

  ipcMain.handle('emails:search', async (_, query: string, limit: number = 100) => {
    if (!query || query.trim().length === 0) {
      return []
    }

    const db = getDatabase()
    const searchTerm = `%${query.trim()}%`
    
    // Get folder IDs to exclude (trash/deleted and spam/junk folders)
    const excludedFolders = db.prepare(`
      SELECT id FROM folders 
      WHERE LOWER(name) IN ('trash', 'deleted', 'deleted items', 'bin', 'spam', 'junk')
         OR LOWER(path) LIKE '%trash%'
         OR LOWER(path) LIKE '%deleted%'
         OR LOWER(path) LIKE '%bin%'
         OR LOWER(path) LIKE '%spam%'
         OR LOWER(path) LIKE '%junk%'
    `).all() as any[]
    
    const excludedFolderIds = excludedFolders.map(f => f.id)
    
    // If no folders to exclude, use a condition that's always false
    const excludeCondition = excludedFolderIds.length > 0 
      ? `AND folder_id NOT IN (${excludedFolderIds.map(() => '?').join(',')})`
      : ''
    
    // Get all emails excluding trash and spam folders - we'll filter in memory after decrypting
    // This is necessary because body content is encrypted
    const allEmails = db.prepare(`
      SELECT emails.*,
        (SELECT COUNT(*) FROM attachments WHERE email_id = emails.id) as attachmentCount
      FROM emails
      WHERE 1=1 ${excludeCondition}
      ORDER BY date DESC
      LIMIT ?
    `).all(...(excludedFolderIds.length > 0 ? excludedFolderIds : []), limit * 3) as any[] // Get more than needed to account for filtering
    
    // Filter emails that match the search query
    const matchingEmails: any[] = []
    
    for (const e of allEmails) {
      if (matchingEmails.length >= limit) break
      
      // Search in subject (case-insensitive)
      const subjectMatch = e.subject && e.subject.toLowerCase().includes(query.toLowerCase())
      
      // Search in from addresses (case-insensitive)
      let fromMatch = false
      try {
        const fromAddresses = JSON.parse(e.from_addresses || '[]') as any[]
        fromMatch = fromAddresses.some((addr: any) => {
          const name = (addr?.name || '').toLowerCase()
          const address = (addr?.address || '').toLowerCase()
          return name.includes(query.toLowerCase()) || address.includes(query.toLowerCase())
        })
      } catch (err) {
        // Ignore parse errors
      }
      
      // Search in body content (decrypt and search)
      let bodyMatch = false
      try {
        const body = encryption.decrypt(e.body_encrypted)
        const textBody = e.text_body_encrypted ? encryption.decrypt(e.text_body_encrypted) : undefined
        const htmlBody = e.html_body_encrypted ? encryption.decrypt(e.html_body_encrypted) : undefined
        
        const bodyText = typeof body === 'string' ? body : String(body || '')
        const textBodyText = typeof textBody === 'string' ? textBody : String(textBody || '')
        const htmlBodyText = typeof htmlBody === 'string' ? htmlBody : String(htmlBody || '')
        
        // Remove HTML tags for searching (simple regex approach)
        const stripHtml = (html: string) => {
          return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        }
        
        const searchableText = (bodyText + ' ' + textBodyText + ' ' + stripHtml(htmlBodyText)).toLowerCase()
        bodyMatch = searchableText.includes(query.toLowerCase())
      } catch (err) {
        // Ignore decryption errors
      }
      
      if (subjectMatch || fromMatch || bodyMatch) {
        matchingEmails.push(e)
      }
    }
    
    // Get all reminder info for emails in search results (for showing reminder icons)
    // Include both active and completed reminders - completed reminders indicate emails moved back from Reminders
    const emailIds = matchingEmails.map(e => e.id)
    const reminderMap = new Map<string, any>()
    if (emailIds.length > 0) {
      const placeholders = emailIds.map(() => '?').join(',')
      const reminders = db.prepare(`
        SELECT email_id, due_date, id, completed
        FROM reminders
        WHERE email_id IN (${placeholders})
      `).all(...emailIds) as any[]
      
      for (const reminder of reminders) {
        reminderMap.set(reminder.email_id, reminder)
      }
    }
    
    // Map to return format with decrypted body content
    const mappedEmails = matchingEmails.map(e => {
      let body: string | undefined
      let htmlBody: string | undefined
      let textBody: string | undefined
      
      try {
        body = encryption.decrypt(e.body_encrypted)
        htmlBody = e.html_body_encrypted ? encryption.decrypt(e.html_body_encrypted) : undefined
        textBody = e.text_body_encrypted ? encryption.decrypt(e.text_body_encrypted) : undefined
      } catch (err) {
        logger.error('Error decrypting email for search:', err)
      }
      
      // Parse addresses
      let from: any[] = []
      let to: any[] = []
      try {
        from = JSON.parse(e.from_addresses || '[]')
        to = JSON.parse(e.to_addresses || '[]')
      } catch (err) {
        // Ignore parse errors
      }
      
      // Limit body content size for list view
      const MAX_BODY_LENGTH = 50000
      const truncateIfNeeded = (str: string | undefined): string | undefined => {
        if (!str) return undefined
        return str.length > MAX_BODY_LENGTH ? str.substring(0, MAX_BODY_LENGTH) + '...' : str
      }
      
      return {
        id: e.id,
        accountId: e.account_id,
        folderId: e.folder_id,
        uid: e.uid,
        messageId: e.message_id,
        subject: e.subject,
        from: from,
        to: to,
        date: e.date,
        body: truncateIfNeeded(typeof body === 'string' ? body : String(body || '')),
        textBody: truncateIfNeeded(typeof textBody === 'string' ? textBody : String(textBody || '')),
        htmlBody: truncateIfNeeded(typeof htmlBody === 'string' ? htmlBody : String(htmlBody || '')),
        isRead: e.is_read === 1,
        isStarred: e.is_starred === 1,
        encrypted: e.encrypted === 1,
        signed: e.signed === 1,
        signatureVerified: e.signature_verified !== null ? e.signature_verified === 1 : undefined,
        status: e.status || null,
        attachmentCount: e.attachmentCount || 0,
        hasReminder: !!reminderMap.get(e.id),
        reminderDueDate: reminderMap.get(e.id)?.due_date || e.reminder_due_date || null
      }
    })
    
    return mappedEmails
  })

  // Unified folder email handlers
  ipcMain.handle('emails:listUnified', async (_, type: string, accountIds: string[], page: number = 0, limit: number = 50) => {
    const db = getDatabase()
    const offset = page * limit
    let query = ''
    let params: any[] = []

    if (type === 'all-inboxes') {
      // Get all inbox folders for the specified accounts
      const inboxFolders = db.prepare(`
        SELECT id FROM folders 
        WHERE account_id IN (${accountIds.map(() => '?').join(',')}) 
        AND LOWER(name) = 'inbox'
      `).all(...accountIds) as any[]
      
      const folderIds = inboxFolders.map(f => f.id)
      if (folderIds.length === 0) {
        return []
      }

      query = `
        SELECT emails.*,
          (SELECT COUNT(*) FROM attachments WHERE email_id = emails.id) as attachmentCount
        FROM emails
        WHERE folder_id IN (${folderIds.map(() => '?').join(',')})
        ORDER BY date DESC
        LIMIT ? OFFSET ?
      `
      params = [...folderIds, limit, offset]
    } else if (type === 'reminders') {
      // Get emails that have reminders (use subquery to prevent duplicates if multiple reminders exist)
      // Get the earliest reminder for each email - grouped by reminder date
      query = `
        SELECT emails.*,
          (SELECT COUNT(*) FROM attachments WHERE email_id = emails.id) as attachmentCount,
          earliest_reminder.due_date as reminder_due_date
        FROM emails
        INNER JOIN (
          SELECT email_id, MIN(due_date) as due_date
          FROM reminders
          WHERE completed = 0
          GROUP BY email_id
        ) earliest_reminder ON emails.id = earliest_reminder.email_id
        ORDER BY earliest_reminder.due_date ASC, emails.date DESC
        LIMIT ? OFFSET ?
      `
      params = [limit, offset]
    } else if (type === 'aside') {
      // Get all Aside folders for the specified accounts (or all accounts if empty)
      // Aside folder shows emails moved to Aside folders (separate from Archive)
      let asideFoldersQuery = `
        SELECT id FROM folders 
        WHERE (LOWER(name) = 'aside' OR LOWER(path) LIKE '%aside%')
          AND LOWER(name) != 'archive'
          AND LOWER(path) NOT LIKE '%archive%'
      `
      let asideFoldersParams: any[] = []
      
      if (accountIds.length > 0) {
        asideFoldersQuery += ` AND account_id IN (${accountIds.map(() => '?').join(',')})`
        asideFoldersParams = [...accountIds]
      }
      
      const asideFolders = db.prepare(asideFoldersQuery).all(...asideFoldersParams) as any[]
      
      const folderIds = asideFolders.map(f => f.id)
      if (folderIds.length === 0) {
        return []
      }

      query = `
        SELECT emails.*,
          (SELECT COUNT(*) FROM attachments WHERE email_id = emails.id) as attachmentCount
        FROM emails
        WHERE folder_id IN (${folderIds.map(() => '?').join(',')})
        ORDER BY date DESC
        LIMIT ? OFFSET ?
      `
      params = [...folderIds, limit, offset]
    } else if (type === 'spam') {
      // Get all spam/junk folders for the specified accounts (or all accounts if empty)
      let spamFoldersQuery = `
        SELECT id FROM folders 
        WHERE (LOWER(name) = 'spam' OR LOWER(name) = 'junk' OR LOWER(path) LIKE '%spam%' OR LOWER(path) LIKE '%junk%')
      `
      let spamFoldersParams: any[] = []
      
      if (accountIds.length > 0) {
        spamFoldersQuery += ` AND account_id IN (${accountIds.map(() => '?').join(',')})`
        spamFoldersParams = [...accountIds]
      }
      
      const spamFolders = db.prepare(spamFoldersQuery).all(...spamFoldersParams) as any[]
      
      const folderIds = spamFolders.map(f => f.id)
      if (folderIds.length === 0) {
        return []
      }

      // Get start of today (midnight) in milliseconds
      const now = Date.now()
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      const startOfToday = today.getTime()

      query = `
        SELECT emails.*,
          (SELECT COUNT(*) FROM attachments WHERE email_id = emails.id) as attachmentCount
        FROM emails
        WHERE folder_id IN (${folderIds.map(() => '?').join(',')})
        AND date >= ?
        ORDER BY date DESC
        LIMIT ? OFFSET ?
      `
      params = [...folderIds, startOfToday, limit, offset]
    } else {
      return []
    }

    const emails = db.prepare(query).all(...params) as any[]
    
    // Get reminder info for all emails (for showing reminder icons)
    // Include both active and completed reminders - completed reminders indicate emails moved back from Reminders
    const emailIds = emails.map(e => e.id)
    const reminderMap = new Map<string, any>()
    if (emailIds.length > 0) {
      const placeholders = emailIds.map(() => '?').join(',')
      const reminders = db.prepare(`
        SELECT email_id, due_date, id, completed
        FROM reminders
        WHERE email_id IN (${placeholders})
      `).all(...emailIds) as any[]
      
      for (const reminder of reminders) {
        reminderMap.set(reminder.email_id, reminder)
      }
    }
    
    // Map to return format with decrypted body content
    // Ensure all values are serializable for IPC
    const mappedEmails = emails.map(e => {
      const body = decryptEmailField(e.body_encrypted, e.id, 'body')
      const htmlBody = decryptEmailField(e.html_body_encrypted, e.id, 'htmlBody')
      const textBody = decryptEmailField(e.text_body_encrypted, e.id, 'textBody')
      
      // Parse addresses with error handling and ensure they're plain objects
      let from: any[] = []
      let to: any[] = []
      try {
        const parsedFrom = JSON.parse(e.from_addresses || '[]')
        // Ensure each item is a plain object
        from = Array.isArray(parsedFrom) ? parsedFrom.map((item: any) => ({
          name: item?.name ? String(item.name) : undefined,
          address: item?.address ? String(item.address) : String(item || '')
        })) : []
      } catch (err) {
        logger.error('Error parsing from_addresses:', err)
        from = []
      }
      
      try {
        const parsedTo = JSON.parse(e.to_addresses || '[]')
        // Ensure each item is a plain object
        to = Array.isArray(parsedTo) ? parsedTo.map((item: any) => ({
          name: item?.name ? String(item.name) : undefined,
          address: item?.address ? String(item.address) : String(item || '')
        })) : []
      } catch (err) {
        logger.error('Error parsing to_addresses:', err)
        to = []
      }
      
      // Create a completely plain object with only serializable values
      // Limit body content size to prevent IPC issues (list view doesn't need full body)
      const MAX_BODY_LENGTH = 50000 // 50KB limit for list view
      const truncateIfNeeded = (str: string | undefined): string | undefined => {
        if (!str) return undefined
        return str.length > MAX_BODY_LENGTH ? str.substring(0, MAX_BODY_LENGTH) + '...' : str
      }
      
      const threadId = e.thread_id || e.message_id
      // Calculate threadCount for unified folders (count emails with same threadId in the same folder)
      const threadCount = db.prepare(`
        SELECT COUNT(*) as count FROM emails 
        WHERE thread_id = ? AND folder_id = ?
      `).get(threadId, e.folder_id) as any
      
      const emailObj = {
        id: String(e.id || ''),
        accountId: String(e.account_id || ''),
        folderId: String(e.folder_id || ''),
        uid: Number(e.uid || 0),
        messageId: String(e.message_id || ''),
        subject: String(e.subject || ''),
        from: from,
        to: to,
        date: Number(e.date || 0),
        body: truncateIfNeeded(body),
        textBody: truncateIfNeeded(textBody),
        htmlBody: truncateIfNeeded(htmlBody),
        isRead: Boolean(e.is_read === 1),
        isStarred: Boolean(e.is_starred === 1),
        encrypted: Boolean(e.encrypted === 1),
        signed: Boolean(e.signed === 1),
        signatureVerified: e.signature_verified !== null && e.signature_verified !== undefined 
          ? Boolean(e.signature_verified === 1) 
          : undefined,
        status: e.status || null,
        attachmentCount: Number(e.attachmentCount || 0),
        threadId: threadId,
        threadCount: Number(threadCount?.count || 1),
        reminder_due_date: e.reminder_due_date ? Number(e.reminder_due_date) : undefined,
        hasReminder: !!reminderMap.get(e.id),
        reminderDueDate: reminderMap.get(e.id)?.due_date || e.reminder_due_date || null,
        reminderCompleted: reminderMap.get(e.id)?.completed === 1 || false
      }
      
      // Force serialization to ensure everything is cloneable
      // If serialization fails, return a minimal version
      try {
        return JSON.parse(JSON.stringify(emailObj))
      } catch (serializationError) {
        logger.error('Serialization error, returning minimal email object:', serializationError)
        // Return minimal version without body content if serialization fails
        return {
          id: emailObj.id,
          accountId: emailObj.accountId,
          folderId: emailObj.folderId,
          uid: emailObj.uid,
          messageId: emailObj.messageId,
          subject: emailObj.subject,
          from: emailObj.from,
          to: emailObj.to,
          date: emailObj.date,
          body: undefined,
          textBody: undefined,
          htmlBody: undefined,
          isRead: emailObj.isRead,
          isStarred: emailObj.isStarred,
          encrypted: emailObj.encrypted,
          signed: emailObj.signed,
          signatureVerified: emailObj.signatureVerified,
          status: emailObj.status,
          attachmentCount: emailObj.attachmentCount,
          threadId: emailObj.threadId,
          threadCount: emailObj.threadCount
        }
      }
    })
    
    return mappedEmails
  })

  ipcMain.handle('emails:fetch-bodies-background', async (_, accountId: string, folderId: string, limit: number = 10) => {
    try {
      const fetched = await emailStorage.fetchEmailBodiesInBackground(accountId, folderId, limit)
      return { success: true, fetched }
    } catch (error: any) {
      logger.error('Error fetching email bodies in background:', error)
      return { success: false, message: error.message, fetched: 0 }
    }
  })

  ipcMain.handle('emails:get', async (_, id: string) => {
    logger.log(`[emails:get] Fetching email ${id} with fetchRemoteBody=true, timeout=60s`)
    const email = await emailStorage.getEmail(id, { fetchRemoteBody: true, fetchTimeoutMs: 60000 })
    if (!email) {
      logger.warn(`[emails:get] Email ${id} not found`)
      return null
    }

    // Check if body was loaded
    const hasBody = email.body && email.body.trim().length > 0
    const hasHtmlBody = email.htmlBody && email.htmlBody.trim().length > 0
    const hasTextBody = email.textBody && email.textBody.trim().length > 0
    logger.log(`[emails:get] Email ${id} body status: hasBody=${hasBody}, hasHtmlBody=${hasHtmlBody}, hasTextBody=${hasTextBody}`)

    // Load attachments
    const db = getDatabase()
    const attachments = db.prepare('SELECT * FROM attachments WHERE email_id = ?').all(id) as any[]
    email.attachments = attachments.map((att: any) => {
      let data: Buffer | null = null
      
      // Try to decrypt attachment data, handle errors gracefully
      if (att.data_encrypted) {
        try {
          // Check if data_encrypted is a Buffer or needs to be converted
          const encryptedBuffer = Buffer.isBuffer(att.data_encrypted) 
            ? att.data_encrypted 
            : Buffer.from(att.data_encrypted)
          
          // Verify buffer has minimum required size (IV + TAG = 32 bytes)
          if (encryptedBuffer.length >= 32) {
            data = encryption.decryptBuffer(encryptedBuffer)
          } else {
            logger.warn(`Attachment ${att.id} has invalid encrypted data size: ${encryptedBuffer.length}`)
          }
        } catch (error) {
          logger.error(`Error decrypting attachment ${att.id} (${att.filename}):`, error)
          // Continue without data - attachment will be unavailable but won't crash the app
        }
      }
      
      return {
        id: att.id,
        emailId: att.email_id,
        filename: att.filename,
        contentType: att.content_type,
        size: att.size,
        contentId: att.content_id,
        data: data
      }
    })

    return email
  })

  ipcMain.handle('emails:getThread', async (_, emailId: string) => {
    const db = getDatabase()
    
    // Get the email to find its threadId
    const email = await emailStorage.getEmail(emailId, { fetchRemoteBody: false })
    if (!email) {
      return []
    }
    
    const threadId = email.threadId || email.messageId
    
    // Get all emails in the thread (by threadId), ordered by date DESC (latest first)
    // Also include emails where message_id matches (for root emails)
    const threadEmails = db.prepare(`
      SELECT emails.*,
        (SELECT COUNT(*) FROM attachments WHERE email_id = emails.id) as attachmentCount
      FROM emails
      WHERE thread_id = ? OR message_id = ?
      ORDER BY date DESC
    `).all(threadId, threadId) as any[]
    
    // Map to return format with decrypted body content
    const mappedEmails = threadEmails.map(e => {
      const decryptedBody = decryptEmailField(e.body_encrypted, e.id, 'body')
      const decryptedHtmlBody = decryptEmailField(e.html_body_encrypted, e.id, 'htmlBody')
      const decryptedTextBody = decryptEmailField(e.text_body_encrypted, e.id, 'textBody')
      const body = decryptedBody ?? ''
      const htmlBody = decryptedHtmlBody
      const textBody = decryptedTextBody
      
      return {
        id: e.id,
        accountId: e.account_id,
        folderId: e.folder_id,
        uid: e.uid,
        messageId: e.message_id,
        subject: e.subject,
        from: JSON.parse(e.from_addresses),
        to: JSON.parse(e.to_addresses),
        cc: e.cc_addresses ? JSON.parse(e.cc_addresses) : undefined,
        bcc: e.bcc_addresses ? JSON.parse(e.bcc_addresses) : undefined,
        replyTo: e.reply_to_addresses ? JSON.parse(e.reply_to_addresses) : undefined,
        date: e.date,
        body: body,
        textBody: textBody,
        htmlBody: htmlBody,
        isRead: e.is_read === 1,
        isStarred: e.is_starred === 1,
        encrypted: e.encrypted === 1,
        signed: e.signed === 1,
        signatureVerified: e.signature_verified !== null ? e.signature_verified === 1 : undefined,
        attachmentCount: e.attachmentCount || 0,
        threadId: e.thread_id || e.message_id,
        inReplyTo: e.in_reply_to || undefined,
        references: e.email_references ? JSON.parse(e.email_references) : undefined
      }
    })
    
    return mappedEmails
  })

  ipcMain.handle('emails:sync-folder', async (event, accountId: string, folderId: string) => {
    try {
      const account = await accountManager.getAccount(accountId)
      if (!account) {
        return { success: false, message: 'Account not found' }
      }

      // Progress callback
      const progressCallback = (data: { folder?: string; current: number; total?: number; emailUid?: number }) => {
        logger.info(`Sync progress: ${data.folder || 'Unknown'} - ${data.current}/${data.total || 'unknown'} (uid: ${data.emailUid || 'N/A'})`)
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
      logger.error('Sync folder error:', error)
      return { success: false, message: error.message || 'Unknown error during folder sync' }
    }
  })

  ipcMain.handle('emails:clear-and-resync-folder', async (event, accountId: string, folderId: string) => {
    try {
      const account = await accountManager.getAccount(accountId)
      if (!account) {
        return { success: false, message: 'Account not found' }
      }

      // Progress callback
      const progressCallback = (data: { folder?: string; current: number; total?: number; emailUid?: number }) => {
        logger.info(`Clear and resync progress: ${data.folder || 'Unknown'} - ${data.current}/${data.total || 'unknown'} (uid: ${data.emailUid || 'N/A'})`)
        event.sender.send('emails:sync-progress', data)
      }

      const result = await emailStorage.clearAndResyncFolder(accountId, folderId, progressCallback)
      return {
        success: true,
        synced: result.synced,
        errors: result.errors,
        message: `Cleared and re-synced ${result.synced} emails with full bodies${result.errors > 0 ? ` with ${result.errors} errors` : ''}`
      }
    } catch (error: any) {
      logger.error('Clear and resync folder error:', error)
      return { success: false, message: error.message || 'Unknown error during clear and resync' }
    }
  })

  ipcMain.handle('emails:sync', async (event, accountId: string) => {
    try {
      const account = await accountManager.getAccount(accountId)
      if (!account) {
        return { success: false, message: 'Account not found' }
      }

      // Cancel any ongoing syncs for this account (including auto-sync)
      emailStorage.cancelSync(accountId)
      
      // Also cancel any auto-sync that might be running
      // The auto-sync uses accountId as cancellation token, so cancelling by accountId should work
      
      // Get inbox folder for tracking unread count
      const db = getDatabase()
      const inboxFolder = db.prepare(
        "SELECT * FROM folders WHERE account_id = ? AND (LOWER(name) = 'inbox' OR LOWER(path) = 'inbox') LIMIT 1"
      ).get(accountId) as any

      // Track new unread emails for notifications
      const newUnreadEmails: any[] = []
      
      // Get count of unread emails in inbox before sync
      const beforeUnreadCount = inboxFolder ? db.prepare(
        'SELECT COUNT(*) as count FROM emails WHERE folder_id = ? AND is_read = 0'
      ).get(inboxFolder.id) as any : { count: 0 }
      const unreadBeforeSync = beforeUnreadCount?.count || 0

      // Progress callback
      const progressCallback = (data: { folder?: string; folderId?: string; accountId?: string; current: number; total?: number; emailUid?: number; email?: any }) => {
        logger.info(`Sync progress: ${data.folder || 'Unknown'} - ${data.current}/${data.total || 'unknown'} (uid: ${data.emailUid || 'N/A'})`)
        event.sender.send('emails:sync-progress', data)
        
        // Track new unread emails for notifications
        if (data.email && !data.email.isRead) {
          newUnreadEmails.push({
            id: data.email.id,
            subject: data.email.subject,
            from: data.email.from,
            folder: data.folder
          })
        }
      }

      // Sync with priority inbox - this will sync only inbox instantly
      const cancellationToken = `manual-sync-${accountId}-${Date.now()}`
      const result = await emailStorage.syncAccount(accountId, progressCallback, {
        priorityInbox: true,
        cancellationToken
      })
      
      // Get count of unread emails in inbox after sync
      const afterUnreadCount = inboxFolder ? db.prepare(
        'SELECT COUNT(*) as count FROM emails WHERE folder_id = ? AND is_read = 0'
      ).get(inboxFolder.id) as any : { count: 0 }
      const unreadAfterSync = afterUnreadCount?.count || 0
      const newUnreadCount = unreadAfterSync - unreadBeforeSync
      
      // Send notification data to renderer for display
      if (newUnreadCount > 0) {
        event.sender.send('emails:new-emails', {
          accountId,
          count: newUnreadCount,
          emails: newUnreadEmails.slice(0, 5) // Send first 5 for preview
        })
      }
      
      return {
        success: true,
        synced: result.synced,
        errors: result.errors,
        newUnread: newUnreadCount,
        message: `Synced ${result.synced} emails${result.errors > 0 ? ` with ${result.errors} errors` : ''}`
      }
    } catch (error: any) {
      logger.error('Sync error:', error)
      return { success: false, message: error.message || 'Unknown error during sync' }
    }
  })

  ipcMain.handle('emails:send', async (_, email: any) => {
    try {
      const account = await accountManager.getAccount(email.accountId)
      if (!account) {
        return { success: false, message: 'Account not found' }
      }

      // Get from address if specified
      let fromAddress: { email: string; name?: string } | undefined
      if (email.fromAddressId) {
        const db = getDatabase()
        const fromAddr = db.prepare('SELECT email, name FROM account_from_addresses WHERE id = ?').get(email.fromAddressId) as any
        if (fromAddr) {
          fromAddress = {
            email: fromAddr.email,
            name: fromAddr.name || undefined
          }
        }
      }
      // Fallback to account email if no from address specified or found
      if (!fromAddress) {
        fromAddress = {
          email: account.email,
          name: account.name || undefined
        }
      }

      // Convert attachment content from Array to Buffer if needed
      const processedAttachments = email.attachments?.map((att: any) => {
        const attachment: any = {
          filename: att.filename,
          contentType: att.contentType,
          content: Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content)
        }
        // Use CID if provided (for inline images), otherwise generate from filename
        if (att.cid) {
          attachment.cid = att.cid
        } else if (att.filename.startsWith('image-')) {
          attachment.cid = att.filename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
        }
        return attachment
      })

      const smtpClient = getSMTPClient(account)
      const result = await smtpClient.sendEmail({
        from: fromAddress,
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        subject: email.subject,
        body: email.body,
        htmlBody: email.htmlBody,
        attachments: processedAttachments,
        encrypted: email.encrypted,
        signed: email.signed
      })

      // Extract and store recipients after successful send
      if (result.success) {
        try {
          if (email.to) {
            contactManager.extractContactsFromAddresses(email.to)
          }
          if (email.cc) {
            contactManager.extractContactsFromAddresses(email.cc)
          }
          if (email.bcc) {
            contactManager.extractContactsFromAddresses(email.bcc)
          }
        } catch (error) {
          logger.error('Error extracting contacts from sent email:', error)
        }
      }

      return result
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('emails:delete', async (_, id: string) => {
    const db = getDatabase()
    
    // Get email details
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as any
    if (!email) {
      return { success: false, message: 'Email not found' }
    }

    // Get current folder to check if email is already in trash
    const currentFolder = db.prepare('SELECT * FROM folders WHERE id = ?').get(email.folder_id) as any
    const isInTrash = currentFolder && (
      currentFolder.name.toLowerCase() === 'trash' ||
      currentFolder.name.toLowerCase() === 'deleted' ||
      currentFolder.name.toLowerCase() === 'deleted items' ||
      currentFolder.name.toLowerCase() === 'bin' ||
      currentFolder.path.toLowerCase().includes('trash') ||
      currentFolder.path.toLowerCase().includes('deleted') ||
      currentFolder.path.toLowerCase().includes('bin')
    )

    // If already in trash, permanently delete
    if (isInTrash) {
      // Delete any reminders for this email
      db.prepare('DELETE FROM reminders WHERE email_id = ?').run(id)
      
      // Try to delete on IMAP server if account is IMAP
      const account = await accountManager.getAccount(email.account_id)
      if (account && account.type === 'imap') {
        try {
          const imapClient = getIMAPClient(account)
          await imapClient.connect()
          
          const folderPath = currentFolder.path === 'INBOX' ? 'INBOX' : currentFolder.path
          // Permanently delete from IMAP server
          await imapClient.deleteEmail(email.uid, folderPath)
          
          await imapClient.disconnect()
        } catch (error) {
          logger.error('Error deleting email on IMAP server:', error)
          // Continue to delete from database anyway
        }
      }
      
      // Permanently delete from database
    db.prepare('DELETE FROM emails WHERE id = ?').run(id)
      return { success: true }
    }

    // Not in trash - move to trash folder
    // Find or create Trash folder
    let trashFolder = db.prepare(`
      SELECT * FROM folders 
      WHERE account_id = ? AND (
        LOWER(name) IN ('trash', 'deleted', 'deleted items', 'bin') OR
        LOWER(path) LIKE '%trash%' OR
        LOWER(path) LIKE '%deleted%' OR
        LOWER(path) LIKE '%bin%'
      )
      LIMIT 1
    `).get(email.account_id) as any

    if (!trashFolder) {
      // Try to find or create Trash folder on IMAP server
      const account = await accountManager.getAccount(email.account_id)
      if (account && account.type === 'imap') {
        try {
          const imapClient = getIMAPClient(account)
          await imapClient.connect()
          const folders = await imapClient.listFolders()
          let trashFolderOnServer = folders.find(
            f => f.name.toLowerCase() === 'trash' ||
                 f.name.toLowerCase() === 'deleted' ||
                 f.name.toLowerCase() === 'deleted items' ||
                 f.name.toLowerCase() === 'bin' ||
                 f.path.toLowerCase().includes('trash') ||
                 f.path.toLowerCase().includes('deleted') ||
                 f.path.toLowerCase().includes('bin')
          )

          // If Trash folder doesn't exist on server, try to create it
          if (!trashFolderOnServer) {
            try {
              // Try common trash folder names
              const trashNames = ['Trash', 'Deleted', 'Deleted Items', 'Bin']
              for (const name of trashNames) {
                try {
                  await imapClient.createFolder(name)
                  // Re-list folders to get the newly created folder
                  const updatedFolders = await imapClient.listFolders()
                  trashFolderOnServer = updatedFolders.find(
                    f => f.name.toLowerCase() === name.toLowerCase() ||
                         f.path.toLowerCase().includes(name.toLowerCase())
                  )
                  if (trashFolderOnServer) break
                } catch (createError) {
                  // Try next name
                  continue
                }
              }
            } catch (createError) {
              logger.error('Error creating Trash folder on IMAP server:', createError)
              // Continue to create local folder
            }
          }

          if (trashFolderOnServer) {
            // Check if folder exists in DB
            trashFolder = db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?')
              .get(email.account_id, trashFolderOnServer.path) as any
            
            if (!trashFolder) {
              // Create folder in DB
              const folderId = randomUUID()
              const now = Date.now()
              db.prepare(`
                INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?, ?)
              `).run(
                folderId,
                email.account_id,
                trashFolderOnServer.name,
                trashFolderOnServer.path,
                JSON.stringify(trashFolderOnServer.attributes || []),
                now,
                now
              )
              trashFolder = { id: folderId, path: trashFolderOnServer.path }
            } else {
              // Folder already exists in DB, use it
              trashFolder = { id: trashFolder.id, path: trashFolder.path }
            }
          }

          await imapClient.disconnect()
        } catch (error) {
          logger.error('Error finding/creating Trash folder:', error)
        }
      }

      // If still no trash folder, create a local one (for non-IMAP accounts or as fallback)
      if (!trashFolder) {
        const folderId = randomUUID()
        const now = Date.now()
        db.prepare(`
          INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, ?, ?, ?)
        `).run(
          folderId,
          email.account_id,
          'Trash',
          'Trash',
          JSON.stringify([]),
          now,
          now
        )
        trashFolder = { id: folderId, path: 'Trash' }
      }
    }

    // Check if email already exists in trash folder with same account_id and uid
    const existingTrashEmail = db.prepare(`
      SELECT id FROM emails 
      WHERE account_id = ? AND folder_id = ? AND uid = ? AND id != ?
    `).get(email.account_id, trashFolder.id, email.uid, id) as any

    const now = Date.now()
    
    if (existingTrashEmail) {
      // Email already exists in trash folder, just delete the current one
      db.prepare('DELETE FROM emails WHERE id = ?').run(id)
    } else {
      // Move email to Trash folder
      try {
        db.prepare(`
          UPDATE emails 
          SET folder_id = ?, updated_at = ?
          WHERE id = ?
        `).run(trashFolder.id, now, id)
      } catch (updateError: any) {
        // Handle UNIQUE constraint violation - email might have been synced to trash
        if (updateError?.code === 'SQLITE_CONSTRAINT' || updateError?.message?.includes('UNIQUE constraint')) {
          const trashEmail = db.prepare(`
            SELECT id FROM emails 
            WHERE account_id = ? AND folder_id = ? AND uid = ?
          `).get(email.account_id, trashFolder.id, email.uid) as any
          
          if (trashEmail) {
            db.prepare('DELETE FROM emails WHERE id = ?').run(id)
          } else {
            throw updateError
          }
        } else {
          throw updateError
        }
      }
    }

    // Try to move on IMAP server if account is IMAP
    const account = await accountManager.getAccount(email.account_id)
    if (account && account.type === 'imap') {
      try {
        const imapClient = getIMAPClient(account)
        await imapClient.connect()
        
        // Get current folder path
        const currentFolderPath = currentFolder.path === 'INBOX' ? 'INBOX' : currentFolder.path
        const trashFolderPath = trashFolder.path === 'INBOX' ? 'INBOX' : trashFolder.path
        
        if (currentFolderPath && trashFolderPath) {
          await imapClient.moveEmail(email.uid, currentFolderPath, trashFolderPath)
          
          // Update folder_id after successful move (in case it changed)
          db.prepare('UPDATE emails SET folder_id = ? WHERE id = ?').run(trashFolder.id, id)
        }
        
        await imapClient.disconnect()
      } catch (error) {
        logger.error('Error moving email to trash on IMAP server:', error)
        // Continue anyway - email is already moved in database
      }
    }

    return { success: true }
  })

  ipcMain.handle('emails:move-to-folder', async (_, emailId: string, folderId: string) => {
    const db = getDatabase()
    
    // Get email details
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId) as any
    if (!email) {
      return { success: false, message: 'Email not found' }
    }

    // Get folder details
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId) as any
    if (!folder) {
      return { success: false, message: 'Folder not found' }
    }

    // Check if email already exists in destination folder with same account_id and uid
    const existingEmail = db.prepare(`
      SELECT id FROM emails 
      WHERE account_id = ? AND folder_id = ? AND uid = ? AND id != ?
    `).get(email.account_id, folderId, email.uid, emailId) as any

    const now = Date.now()
    
    if (existingEmail) {
      // Email already exists in destination folder, just delete the current one
      db.prepare('DELETE FROM emails WHERE id = ?').run(emailId)
    } else {
      // Move email to destination folder
      try {
        db.prepare(`
          UPDATE emails 
          SET folder_id = ?, updated_at = ?
          WHERE id = ?
        `).run(folderId, now, emailId)
      } catch (updateError: any) {
        // Handle UNIQUE constraint violation
        if (updateError?.code === 'SQLITE_CONSTRAINT' || updateError?.message?.includes('UNIQUE constraint')) {
          const destEmail = db.prepare(`
            SELECT id FROM emails 
            WHERE account_id = ? AND folder_id = ? AND uid = ?
          `).get(email.account_id, folderId, email.uid) as any
          
          if (destEmail) {
            db.prepare('DELETE FROM emails WHERE id = ?').run(emailId)
          } else {
            throw updateError
          }
        } else {
          throw updateError
        }
      }
    }

    // Try to move on IMAP server if account is IMAP
    const account = await accountManager.getAccount(email.account_id)
    if (account && account.type === 'imap') {
      try {
        const imapClient = getIMAPClient(account)
        await imapClient.connect()
        
        // Get current folder path
        const currentFolder = db.prepare('SELECT path FROM folders WHERE id = ?').get(email.folder_id) as any
        const destFolderPath = folder.path === 'INBOX' ? 'INBOX' : folder.path
        
        if (currentFolder && destFolderPath) {
          const currentPath = currentFolder.path === 'INBOX' ? 'INBOX' : currentFolder.path
          await imapClient.moveEmail(email.uid, currentPath, destFolderPath)
          
          // Update folder_id after successful move (in case it changed)
          db.prepare('UPDATE emails SET folder_id = ? WHERE id = ?').run(folderId, emailId)
        }
        
        await imapClient.disconnect()
      } catch (error) {
        logger.error('Error moving email on IMAP server:', error)
        // Continue anyway - email is already moved in database
      }
    }

    // Record sender-to-folder mapping for learning
    try {
      const fromAddresses = JSON.parse(email.from_addresses || '[]') as any[]
      if (fromAddresses && fromAddresses.length > 0) {
        const senderEmail = (fromAddresses[0].address || '').toLowerCase().trim()
        if (senderEmail) {
          // Check if mapping exists
          const existingMapping = db.prepare(`
            SELECT id, move_count FROM sender_folder_mappings 
            WHERE account_id = ? AND sender_email = ? AND folder_id = ?
          `).get(email.account_id, senderEmail, folderId) as any

          if (existingMapping) {
            // Increment move count
            db.prepare(`
              UPDATE sender_folder_mappings 
              SET move_count = move_count + 1, last_moved_at = ?
              WHERE id = ?
            `).run(now, existingMapping.id)
          } else {
            // Create new mapping
            const mappingId = randomUUID()
            db.prepare(`
              INSERT INTO sender_folder_mappings 
              (id, account_id, sender_email, folder_id, move_count, last_moved_at, created_at)
              VALUES (?, ?, ?, ?, 1, ?, ?)
            `).run(mappingId, email.account_id, senderEmail, folderId, now, now)
          }
        }
      }
    } catch (learningError) {
      logger.error('Error recording sender-folder mapping:', learningError)
      // Don't fail the move operation if learning fails
    }

    return { success: true }
  })

  ipcMain.handle('emails:download-attachment', async (_, attachmentId: string) => {
    try {
      const db = getDatabase()
      const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId) as any
      
      if (!attachment) {
        return { success: false, message: 'Attachment not found' }
      }

      // Decrypt attachment data
      const decryptedData = encryption.decryptBuffer(attachment.data_encrypted)

      // Show save dialog
      const focusedWindow = BrowserWindow.getFocusedWindow()
      const result = await dialog.showSaveDialog(focusedWindow || undefined, {
        defaultPath: attachment.filename,
        title: 'Save Attachment'
      })

      if (result.canceled) {
        return { success: false, message: 'Save cancelled' }
      }

      // Write file to selected path
      writeFileSync(result.filePath!, decryptedData)

      return { success: true }
    } catch (error: any) {
      logger.error('Error downloading attachment:', error)
      return { success: false, message: error.message || 'Unknown error' }
    }
  })

  ipcMain.handle('emails:archive', async (_, id: string) => {
    const db = getDatabase()
    
    // Get email details
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as any
    if (!email) {
      return { success: false, message: 'Email not found' }
    }

    // Check if email is already in an Archive folder
    const currentFolder = db.prepare('SELECT * FROM folders WHERE id = ?').get(email.folder_id) as any
    const isAlreadyInArchive = currentFolder && (
      currentFolder.name.toLowerCase() === 'archive' || 
      currentFolder.path.toLowerCase().includes('archive')
    )
    
    // If already in Archive, just delete any reminders and return success (no-op)
    if (isAlreadyInArchive) {
      db.prepare('DELETE FROM reminders WHERE email_id = ? AND completed = 0').run(id)
      return { success: true, message: 'Email already in Archive' }
    }

    // Delete any reminders for this email when archiving
    db.prepare('DELETE FROM reminders WHERE email_id = ? AND completed = 0').run(id)

    // Find or create Archive folder
    // Explicitly exclude Aside folders - only look for Archive
    let archiveFolder = db.prepare(`
      SELECT * FROM folders 
      WHERE account_id = ? 
        AND (LOWER(name) = 'archive' OR LOWER(path) LIKE '%archive%')
        AND LOWER(name) != 'aside'
        AND LOWER(path) NOT LIKE '%aside%'
      LIMIT 1
    `).get(email.account_id) as any

    if (!archiveFolder) {
      // Try to find or create Archive folder on IMAP server
      const account = await accountManager.getAccount(email.account_id)
      if (account && account.type === 'imap') {
        try {
          const imapClient = getIMAPClient(account)
          await imapClient.connect()
          const folders = await imapClient.listFolders()
          // Explicitly exclude Aside folders - only look for Archive
          let archiveFolderOnServer = folders.find(
            f => (f.name.toLowerCase() === 'archive' || f.path.toLowerCase().includes('archive'))
              && f.name.toLowerCase() !== 'aside'
              && !f.path.toLowerCase().includes('aside')
          )

          // If Archive folder doesn't exist on server, create it
          if (!archiveFolderOnServer) {
            try {
              await imapClient.createFolder('Archive')
              // Re-list folders to get the newly created folder
              const updatedFolders = await imapClient.listFolders()
              archiveFolderOnServer = updatedFolders.find(
                f => f.name.toLowerCase() === 'archive' || f.path.toLowerCase().includes('archive')
              )
            } catch (createError) {
              logger.error('Error creating Archive folder on IMAP server:', createError)
              // Continue to create local folder
            }
          }

          if (archiveFolderOnServer) {
            // Check if folder exists in DB
            archiveFolder = db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?')
              .get(email.account_id, archiveFolderOnServer.path) as any
            
            if (!archiveFolder) {
              // Create folder in DB
              const folderId = randomUUID()
              const now = Date.now()
              db.prepare(`
                INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?, ?)
              `).run(
                folderId,
                email.account_id,
                archiveFolderOnServer.name,
                archiveFolderOnServer.path,
                JSON.stringify(archiveFolderOnServer.attributes),
                now,
                now
              )
              archiveFolder = { id: folderId, path: archiveFolderOnServer.path }
            }
          }

          await imapClient.disconnect()
        } catch (error) {
          logger.error('Error finding/creating Archive folder:', error)
        }
      }

      // If still no archive folder, create a local one (for non-IMAP accounts or as fallback)
      if (!archiveFolder) {
        const folderId = randomUUID()
        const now = Date.now()
        db.prepare(`
          INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, ?, ?, ?)
        `).run(
          folderId,
          email.account_id,
          'Archive',
          'Archive',
          JSON.stringify([]),
          now,
          now
        )
        archiveFolder = { id: folderId, path: 'Archive' }
      }
    }

    // Check if email already exists in archive folder with same account_id and uid
    const existingArchivedEmail = db.prepare(`
      SELECT id FROM emails 
      WHERE account_id = ? AND folder_id = ? AND uid = ? AND id != ?
    `).get(email.account_id, archiveFolder.id, email.uid, id) as any

    const now = Date.now()
    
    if (existingArchivedEmail) {
      // Email already exists in archive folder, delete the current one (from Aside or wherever it is)
      db.prepare('DELETE FROM emails WHERE id = ?').run(id)
      return { success: true, message: 'Email already in Archive, duplicate removed' }
    } else {
      // Before moving, check if there are any other emails with same uid in Archive or Aside folders
      // and delete them to prevent duplicates
      const otherArchiveEmails = db.prepare(`
        SELECT e.id, f.name, f.path FROM emails e
        JOIN folders f ON e.folder_id = f.id
        WHERE e.account_id = ? 
          AND e.uid = ? 
          AND e.id != ?
          AND (
            LOWER(f.name) = 'archive' OR LOWER(f.path) LIKE '%archive%' OR
            LOWER(f.name) = 'aside' OR LOWER(f.path) LIKE '%aside%'
          )
      `).all(email.account_id, email.uid, id) as any[]
      
      // Delete any duplicates found in Archive or Aside folders
      for (const dup of otherArchiveEmails) {
        db.prepare('DELETE FROM emails WHERE id = ?').run(dup.id)
      }
      // Move email to Archive folder
      try {
    db.prepare(`
      UPDATE emails 
      SET folder_id = ?, updated_at = ?
      WHERE id = ?
    `).run(archiveFolder.id, now, id)
      } catch (updateError: any) {
        // Handle UNIQUE constraint violation - email might have been synced to archive
        if (updateError?.code === 'SQLITE_CONSTRAINT' || updateError?.message?.includes('UNIQUE constraint')) {
          // Check if email exists in archive folder now
          const archivedEmail = db.prepare(`
            SELECT id FROM emails 
            WHERE account_id = ? AND folder_id = ? AND uid = ?
          `).get(email.account_id, archiveFolder.id, email.uid) as any
          
          if (archivedEmail) {
            // Email already in archive, delete the duplicate
            db.prepare('DELETE FROM emails WHERE id = ?').run(id)
          } else {
            // Re-throw if it's a different constraint error
            throw updateError
          }
        } else {
          throw updateError
        }
      }
    }

    // Try to move on IMAP server if account is IMAP
    const account = await accountManager.getAccount(email.account_id)
    if (account && account.type === 'imap') {
      try {
        const imapClient = getIMAPClient(account)
        await imapClient.connect()
        
        // Get current folder path
        const currentFolder = db.prepare('SELECT path FROM folders WHERE id = ?').get(email.folder_id) as any
        // Get archive folder path from database (should have the correct server path)
        const archiveFolderFromDb = db.prepare('SELECT path FROM folders WHERE id = ?').get(archiveFolder.id) as any
        const archivePath = archiveFolderFromDb?.path || archiveFolder.path || 'Archive'
        
        if (currentFolder && archivePath) {
          // Ensure Archive folder exists on server before moving
          // Try to create it if it doesn't exist (idempotent - won't error if it exists)
          try {
            await imapClient.createFolder(archivePath)
          } catch (createError: any) {
            // If folder already exists, that's fine - continue
            if (createError && !createError.message?.includes('already exists') && !createError.message?.includes('EXISTS')) {
              logger.warn('Archive folder may already exist or creation failed:', createError.message)
            }
          }

          // Use IMAP MOVE command if available, otherwise COPY + DELETE
          const currentPath = currentFolder.path === 'INBOX' ? 'INBOX' : currentFolder.path
          await imapClient.moveEmail(email.uid, currentPath, archivePath)
        }
        
        await imapClient.disconnect()
      } catch (error) {
        logger.error('Error moving email on IMAP server:', error)
        // Continue anyway - email is already moved in database
      }
    }

    return { success: true }
  })

  ipcMain.handle('emails:mark-read', async (_, id: string, read: boolean = true) => {
    const db = getDatabase()
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as any
    if (!email) {
      return { success: false, message: 'Email not found' }
    }

    // Update in database
    db.prepare('UPDATE emails SET is_read = ?, updated_at = ? WHERE id = ?')
      .run(read ? 1 : 0, Date.now(), id)

    // Sync to IMAP server if account is IMAP
    const account = await accountManager.getAccount(email.account_id)
    if (account && account.type === 'imap') {
      try {
        const imapClient = getIMAPClient(account)
        await imapClient.connect()
        
        // Get folder path
        const folder = db.prepare('SELECT path FROM folders WHERE id = ?').get(email.folder_id) as any
        if (folder) {
          const folderPath = folder.path === 'INBOX' ? 'INBOX' : folder.path
          await imapClient.markAsRead(email.uid, folderPath, read)
        }
        
        await imapClient.disconnect()
      } catch (error) {
        logger.error('Error marking email as read on IMAP server:', error)
        // Continue anyway - email is already marked as read in database
      }
    }

    return { success: true }
  })

  ipcMain.handle('emails:spam', async (_, id: string) => {
    const db = getDatabase()
    
    // Get email details
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as any
    if (!email) {
      return { success: false, message: 'Email not found' }
    }

    // Find or create Spam/Junk folder
    let spamFolder = db.prepare(`
      SELECT * FROM folders 
      WHERE account_id = ? AND (LOWER(name) = 'spam' OR LOWER(name) = 'junk' OR LOWER(path) LIKE '%spam%' OR LOWER(path) LIKE '%junk%')
      LIMIT 1
    `).get(email.account_id) as any

    if (!spamFolder) {
      // Try to find or create Spam/Junk folder on IMAP server
      const account = await accountManager.getAccount(email.account_id)
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
              // Re-list folders to get the newly created folder
              const updatedFolders = await imapClient.listFolders()
              spamFolderOnServer = updatedFolders.find(
                f => f.name.toLowerCase() === 'spam' || 
                     f.name.toLowerCase() === 'junk' || 
                     f.path.toLowerCase().includes('spam') ||
                     f.path.toLowerCase().includes('junk')
              )
            } catch (createError) {
              logger.error('Error creating Spam folder on IMAP server:', createError)
              // Continue to create local folder
            }
          }

          if (spamFolderOnServer) {
            // Check if folder exists in DB
            spamFolder = db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?')
              .get(email.account_id, spamFolderOnServer.path) as any
            
            if (!spamFolder) {
              // Create folder in DB
              const folderId = randomUUID()
              const now = Date.now()
              db.prepare(`
                INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?, ?)
              `).run(
                folderId,
                email.account_id,
                spamFolderOnServer.name,
                spamFolderOnServer.path,
                JSON.stringify(spamFolderOnServer.attributes),
                now,
                now
              )
              spamFolder = { id: folderId, path: spamFolderOnServer.path }
            }
          }

          await imapClient.disconnect()
        } catch (error) {
          logger.error('Error finding/creating Spam folder:', error)
        }
      }

      // If still no spam folder, create a local one (for non-IMAP accounts or as fallback)
      if (!spamFolder) {
        const folderId = randomUUID()
        const now = Date.now()
        db.prepare(`
          INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, ?, ?, ?)
        `).run(
          folderId,
          email.account_id,
          'Spam',
          'Spam',
          JSON.stringify([]),
          now,
          now
        )
        spamFolder = { id: folderId, path: 'Spam' }
      }
    }

    // Check if email already exists in spam folder with same account_id and uid
    const existingSpamEmail = db.prepare(`
      SELECT id FROM emails 
      WHERE account_id = ? AND folder_id = ? AND uid = ? AND id != ?
    `).get(email.account_id, spamFolder.id, email.uid, id) as any

    const now = Date.now()
    
    if (existingSpamEmail) {
      // Email already exists in spam folder, just delete the current one
      db.prepare('DELETE FROM emails WHERE id = ?').run(id)
    } else {
      // Move email to Spam folder
      try {
        db.prepare(`
          UPDATE emails 
          SET folder_id = ?, updated_at = ?
          WHERE id = ?
        `).run(spamFolder.id, now, id)
      } catch (updateError: any) {
        // Handle UNIQUE constraint violation - email might have been synced to spam
        if (updateError?.code === 'SQLITE_CONSTRAINT' || updateError?.message?.includes('UNIQUE constraint')) {
          // Check if email exists in spam folder now
          const spamEmail = db.prepare(`
            SELECT id FROM emails 
            WHERE account_id = ? AND folder_id = ? AND uid = ?
          `).get(email.account_id, spamFolder.id, email.uid) as any
          
          if (spamEmail) {
            // Email already in spam, delete the duplicate
            db.prepare('DELETE FROM emails WHERE id = ?').run(id)
          } else {
            // Re-throw if it's a different constraint error
            throw updateError
          }
        } else {
          throw updateError
        }
      }
    }

    // Try to move on IMAP server if account is IMAP
    const account = await accountManager.getAccount(email.account_id)
    if (account && account.type === 'imap') {
      try {
        const imapClient = getIMAPClient(account)
        await imapClient.connect()
        
        // Get current folder path
        const currentFolder = db.prepare('SELECT path FROM folders WHERE id = ?').get(email.folder_id) as any
        // Get spam folder path from database (should have the correct server path)
        const spamFolderFromDb = db.prepare('SELECT path FROM folders WHERE id = ?').get(spamFolder.id) as any
        const spamPath = spamFolderFromDb?.path || spamFolder.path || 'Spam'
        
        if (currentFolder && spamPath) {
          // Ensure Spam folder exists on server before moving
          // Try to create it if it doesn't exist (idempotent - won't error if it exists)
          try {
            await imapClient.createFolder(spamPath)
          } catch (createError: any) {
            // If folder already exists, that's fine - continue
            if (createError && !createError.message?.includes('already exists') && !createError.message?.includes('EXISTS')) {
              logger.warn('Spam folder may already exist or creation failed:', createError.message)
            }
          }

          // Use IMAP MOVE command if available, otherwise COPY + DELETE
          const currentPath = currentFolder.path === 'INBOX' ? 'INBOX' : currentFolder.path
          await imapClient.moveEmail(email.uid, currentPath, spamPath)
        }
        
        await imapClient.disconnect()
      } catch (error) {
        logger.error('Error moving email on IMAP server:', error)
        // Continue anyway - email is already moved in database
      }
    }

    return { success: true }
  })

  // Spam detection handlers
  ipcMain.handle('emails:check-spam', async (_, id: string) => {
    const db = getDatabase()
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as any
    if (!email) {
      return { success: false, message: 'Email not found' }
    }

    try {
      // Decrypt headers if available
      let headers: Record<string, string | string[]> | undefined = undefined
      if (email.headers_encrypted) {
        try {
          const headersJson = encryption.decrypt(email.headers_encrypted)
          headers = JSON.parse(headersJson)
        } catch (error) {
          logger.error('Error decrypting headers:', error)
        }
      }

      // Reconstruct email object for spam detection
      const emailObj: any = {
        id: email.id,
        accountId: email.account_id,
        folderId: email.folder_id,
        uid: email.uid,
        messageId: email.message_id,
        subject: email.subject,
        from: JSON.parse(email.from_addresses),
        to: JSON.parse(email.to_addresses),
        cc: email.cc_addresses ? JSON.parse(email.cc_addresses) : undefined,
        bcc: email.bcc_addresses ? JSON.parse(email.bcc_addresses) : undefined,
        replyTo: email.reply_to_addresses ? JSON.parse(email.reply_to_addresses) : undefined,
        date: email.date,
        body: email.body_encrypted ? encryption.decrypt(email.body_encrypted) : '',
        textBody: email.text_body_encrypted ? encryption.decrypt(email.text_body_encrypted) : undefined,
        htmlBody: email.html_body_encrypted ? encryption.decrypt(email.html_body_encrypted) : undefined,
        headers: headers,
        flags: email.flags ? JSON.parse(email.flags) : [],
        isRead: email.is_read === 1,
        isStarred: email.is_starred === 1,
        encrypted: email.encrypted === 1,
        signed: email.signed === 1,
        signatureVerified: email.signature_verified !== null ? email.signature_verified === 1 : undefined,
        createdAt: email.created_at,
        updatedAt: email.updated_at
      }

      const { spamDetector } = await import('../email/spam-detector')
      const spamScore = await spamDetector.calculateSpamScore(emailObj)
      spamDetector.updateSpamScore(id, spamScore)

      return { success: true, spamScore }
    } catch (error: any) {
      logger.error('Error checking spam:', error)
      return { success: false, message: error.message || 'Unknown error' }
    }
  })

  ipcMain.handle('emails:add-to-blacklist', async (_, accountId: string | null, emailAddress: string, domain: string | null, reason?: string) => {
    try {
      const { spamDetector } = await import('../email/spam-detector')
      spamDetector.addToBlacklist(accountId, emailAddress, domain, reason)
      return { success: true }
    } catch (error: any) {
      logger.error('Error adding to blacklist:', error)
      return { success: false, message: error.message || 'Unknown error' }
    }
  })

  ipcMain.handle('emails:remove-from-blacklist', async (_, emailAddress: string, accountId?: string) => {
    try {
      const { spamDetector } = await import('../email/spam-detector')
      spamDetector.removeFromBlacklist(emailAddress, accountId)
      return { success: true }
    } catch (error: any) {
      logger.error('Error removing from blacklist:', error)
      return { success: false, message: error.message || 'Unknown error' }
    }
  })

  // Status management handlers
  ipcMain.handle('emails:setStatus', async (_, emailId: string, status: 'now' | 'later' | 'reference' | 'noise' | 'archived' | null) => {
    const db = getDatabase()
    const now = Date.now()
    
    db.prepare(`
      UPDATE emails 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(status, now, emailId)
    
    return { success: true }
  })

  ipcMain.handle('emails:getByStatus', async (_, accountId: string, status: 'now' | 'later' | 'reference' | 'noise' | 'archived' | null, limit: number = 50) => {
    const db = getDatabase()
    
    // Get emails with attachment count and thread count
    const emails = db.prepare(`
      SELECT emails.*,
        (SELECT COUNT(*) FROM attachments WHERE email_id = emails.id) as attachmentCount,
        (SELECT COUNT(*) FROM emails e2 WHERE e2.thread_id = emails.thread_id AND e2.thread_id IS NOT NULL) as threadCount
      FROM emails
      WHERE account_id = ? AND status = ?
      ORDER BY date DESC
      LIMIT ?
    `).all(accountId, status, limit) as any[]
    
    // Map to return format with decrypted body content
    const mappedEmails = emails.map(e => {
      const decryptedBody = decryptEmailField(e.body_encrypted, e.id, 'body')
      const decryptedHtmlBody = decryptEmailField(e.html_body_encrypted, e.id, 'htmlBody')
      const decryptedTextBody = decryptEmailField(e.text_body_encrypted, e.id, 'textBody')
      const body = decryptedBody ?? ''
      const htmlBody = decryptedHtmlBody
      const textBody = decryptedTextBody
      
      return {
        id: e.id,
        accountId: e.account_id,
        folderId: e.folder_id,
        uid: e.uid,
        messageId: e.message_id,
        subject: e.subject,
        from: JSON.parse(e.from_addresses),
        to: JSON.parse(e.to_addresses),
        date: e.date,
        body: body,
        textBody: textBody,
        htmlBody: htmlBody,
        isRead: e.is_read === 1,
        isStarred: e.is_starred === 1,
        encrypted: e.encrypted === 1,
        signed: e.signed === 1,
        signatureVerified: e.signature_verified !== null ? e.signature_verified === 1 : undefined,
        status: e.status || null,
        threadId: e.thread_id || null,
        attachmentCount: e.attachmentCount || 0,
        threadCount: e.threadCount || 1
      }
    })
    
    return mappedEmails
  })

  // Get uncategorized emails (status is NULL)
  ipcMain.handle('emails:getUncategorized', async (_, accountId: string, limit: number = 50) => {
    const db = getDatabase()
    
    const emails = db.prepare(`
      SELECT emails.*,
        (SELECT COUNT(*) FROM attachments WHERE email_id = emails.id) as attachmentCount,
        (SELECT COUNT(*) FROM emails e2 WHERE e2.thread_id = emails.thread_id AND e2.thread_id IS NOT NULL) as threadCount
      FROM emails
      WHERE account_id = ? AND (status IS NULL OR status = '')
      ORDER BY date DESC
      LIMIT ?
    `).all(accountId, limit) as any[]
    
    const mappedEmails = emails.map(e => {
      const decryptedBody = decryptEmailField(e.body_encrypted, e.id, 'body')
      const decryptedHtmlBody = decryptEmailField(e.html_body_encrypted, e.id, 'htmlBody')
      const decryptedTextBody = decryptEmailField(e.text_body_encrypted, e.id, 'textBody')
      const body = decryptedBody ?? ''
      const htmlBody = decryptedHtmlBody
      const textBody = decryptedTextBody
      
      return {
        id: e.id,
        accountId: e.account_id,
        folderId: e.folder_id,
        uid: e.uid,
        messageId: e.message_id,
        subject: e.subject,
        from: JSON.parse(e.from_addresses),
        to: JSON.parse(e.to_addresses),
        date: e.date,
        body: body,
        textBody: textBody,
        htmlBody: htmlBody,
        isRead: e.is_read === 1,
        isStarred: e.is_starred === 1,
        encrypted: e.encrypted === 1,
        signed: e.signed === 1,
        signatureVerified: e.signature_verified !== null ? e.signature_verified === 1 : undefined,
        status: null,
        threadId: e.thread_id || null,
        attachmentCount: e.attachmentCount || 0,
        threadCount: e.threadCount || 1
      }
    })
    
    return mappedEmails
  })

  ipcMain.handle('emails:update-auto-sync', async (_, enabled: boolean, intervalMinutes: number) => {
    try {
      if (enabled) {
        autoSyncScheduler.start(intervalMinutes)
      } else {
        autoSyncScheduler.stop()
      }
      return { success: true }
    } catch (error: any) {
      logger.error('Error updating auto-sync:', error)
      return { success: false, message: error.message }
    }
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

  ipcMain.handle('reminders:hasReminder', async (_, emailId: string) => {
    const db = getDatabase()
    const reminder = db.prepare(`
      SELECT id FROM reminders 
      WHERE email_id = ? AND completed = 0
      LIMIT 1
    `).get(emailId) as any
    return !!reminder
  })

  ipcMain.handle('reminders:cleanupDuplicates', async () => {
    const db = getDatabase()
    // Find all emails with multiple active reminders
    const duplicates = db.prepare(`
      SELECT email_id, COUNT(*) as count, GROUP_CONCAT(id) as reminder_ids
      FROM reminders
      WHERE completed = 0
      GROUP BY email_id
      HAVING count > 1
    `).all() as any[]

    let cleaned = 0
    for (const dup of duplicates) {
      // Get all reminders for this email, ordered by due_date (earliest first)
      const reminders = db.prepare(`
        SELECT id FROM reminders
        WHERE email_id = ? AND completed = 0
        ORDER BY due_date ASC, created_at ASC
      `).all(dup.email_id) as any[]

      // Keep the first (earliest) reminder, delete the rest
      if (reminders.length > 1) {
        const keepId = reminders[0].id
        const deleteIds = reminders.slice(1).map((r: any) => r.id)
        
        for (const deleteId of deleteIds) {
          db.prepare('DELETE FROM reminders WHERE id = ?').run(deleteId)
          cleaned++
        }
      }
    }

    return { cleaned, duplicatesFound: duplicates.length }
  })

  ipcMain.handle('reminders:create', async (_, reminder: Omit<Reminder, 'id' | 'createdAt'>) => {
    const db = getDatabase()
    const id = randomUUID()
    const now = Date.now()
    
    // Get email details and store original folder before moving
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(reminder.emailId) as any
    if (!email) {
      throw new Error('Email not found')
    }
    const originalFolderId = email.folder_id

    // Find or create Reminders folder
    let remindersFolder = db.prepare(`
      SELECT * FROM folders 
      WHERE account_id = ? AND (LOWER(name) = 'reminders' OR LOWER(path) LIKE '%reminders%')
      LIMIT 1
    `).get(reminder.accountId) as any

    if (!remindersFolder) {
      // Try to find or create Reminders folder on IMAP server
      const account = await accountManager.getAccount(reminder.accountId)
      if (account && account.type === 'imap') {
        try {
          const imapClient = getIMAPClient(account)
          await imapClient.connect()
          const folders = await imapClient.listFolders()
          let remindersFolderOnServer = folders.find(
            f => f.name.toLowerCase() === 'reminders' || f.path.toLowerCase().includes('reminders')
          )

          // If Reminders folder doesn't exist on server, create it
          if (!remindersFolderOnServer) {
            try {
              await imapClient.createFolder('Reminders')
              // Re-list folders to get the newly created folder
              const updatedFolders = await imapClient.listFolders()
              remindersFolderOnServer = updatedFolders.find(
                f => f.name.toLowerCase() === 'reminders' || f.path.toLowerCase().includes('reminders')
              )
            } catch (createError) {
              logger.error('Error creating Reminders folder on IMAP server:', createError)
              // Continue to create local folder
            }
          }

          if (remindersFolderOnServer) {
            // Check if folder exists in DB
            remindersFolder = db.prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?')
              .get(reminder.accountId, remindersFolderOnServer.path) as any
            
            if (!remindersFolder) {
              // Create folder in DB
              const folderId = randomUUID()
              const now = Date.now()
              db.prepare(`
                INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?, ?)
              `).run(
                folderId,
                reminder.accountId,
                remindersFolderOnServer.name,
                remindersFolderOnServer.path,
                JSON.stringify(remindersFolderOnServer.attributes),
                now,
                now
              )
              remindersFolder = { id: folderId, path: remindersFolderOnServer.path }
            }
          }

          await imapClient.disconnect()
        } catch (error) {
          logger.error('Error finding/creating Reminders folder:', error)
        }
      }

      // If still no reminders folder, create a local one (for non-IMAP accounts or as fallback)
      if (!remindersFolder) {
        const folderId = randomUUID()
        const now = Date.now()
        db.prepare(`
          INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, ?, ?, ?)
        `).run(
          folderId,
          reminder.accountId,
          'Reminders',
          'Reminders',
          JSON.stringify([]),
          now,
          now
        )
        remindersFolder = { id: folderId, path: 'Reminders' }
      }
    }

    // Move email to Reminders folder
    // Check if email already exists in reminders folder with same account_id and uid
    const existingRemindersEmail = db.prepare(`
      SELECT id FROM emails 
      WHERE account_id = ? AND folder_id = ? AND uid = ? AND id != ?
    `).get(reminder.accountId, remindersFolder.id, email.uid, reminder.emailId) as any

    if (existingRemindersEmail) {
      // Email already exists in reminders folder, just delete the current one
      db.prepare('DELETE FROM emails WHERE id = ?').run(reminder.emailId)
    } else {
      // Move email to Reminders folder
      try {
        db.prepare(`
          UPDATE emails 
          SET folder_id = ?, updated_at = ?
          WHERE id = ?
        `).run(remindersFolder.id, now, reminder.emailId)
      } catch (updateError: any) {
        // Handle UNIQUE constraint violation - email might have been synced to reminders
        if (updateError?.code === 'SQLITE_CONSTRAINT' || updateError?.message?.includes('UNIQUE constraint')) {
          // Check if email exists in reminders folder now
          const remindersEmail = db.prepare(`
            SELECT id FROM emails 
            WHERE account_id = ? AND folder_id = ? AND uid = ?
          `).get(reminder.accountId, remindersFolder.id, email.uid) as any
          
          if (remindersEmail) {
            // Email already in reminders, delete the duplicate
            db.prepare('DELETE FROM emails WHERE id = ?').run(reminder.emailId)
          } else {
            // Re-throw if it's a different constraint error
            throw updateError
          }
        } else {
          throw updateError
        }
      }
    }

    // Try to move on IMAP server if account is IMAP
    const account = await accountManager.getAccount(reminder.accountId)
    if (account && account.type === 'imap') {
      try {
        const imapClient = getIMAPClient(account)
        await imapClient.connect()
        
        // Get current folder path
        const currentFolder = db.prepare('SELECT path FROM folders WHERE id = ?').get(email.folder_id) as any
        // Get reminders folder path from database (should have the correct server path)
        const remindersFolderFromDb = db.prepare('SELECT path FROM folders WHERE id = ?').get(remindersFolder.id) as any
        const remindersPath = remindersFolderFromDb?.path || remindersFolder.path || 'Reminders'
        
        if (currentFolder && remindersPath) {
          // Ensure Reminders folder exists on server before moving
          // Try to create it if it doesn't exist (idempotent - won't error if it exists)
          try {
            await imapClient.createFolder(remindersPath)
          } catch (createError: any) {
            // If folder already exists, that's fine - continue
            if (createError && !createError.message?.includes('already exists') && !createError.message?.includes('EXISTS')) {
              logger.warn('Reminders folder may already exist or creation failed:', createError.message)
            }
          }

          // Use IMAP MOVE command if available, otherwise COPY + DELETE
          const currentPath = currentFolder.path === 'INBOX' ? 'INBOX' : currentFolder.path
          await imapClient.moveEmail(email.uid, currentPath, remindersPath)
        }
        
        await imapClient.disconnect()
      } catch (error) {
        logger.error('Error moving email on IMAP server:', error)
        // Continue anyway - email is already moved in database
      }
    }
    
    // Check if a reminder already exists for this email (not completed)
    const existingReminder = db.prepare(`
      SELECT id FROM reminders 
      WHERE email_id = ? AND completed = 0
      LIMIT 1
    `).get(reminder.emailId) as any

    if (existingReminder) {
      // Update existing reminder instead of creating a duplicate
      // Preserve original folder from existing reminder message
      const existingReminderData = db.prepare('SELECT message FROM reminders WHERE id = ?').get(existingReminder.id) as any
      let originalFolderIdFromExisting: string | null = null
      try {
        const existingData = JSON.parse(existingReminderData?.message || '{}')
        originalFolderIdFromExisting = existingData.originalFolderId || originalFolderId
      } catch {
        originalFolderIdFromExisting = originalFolderId
      }

      // Update reminder message with original folder
      let reminderMessage = reminder.message || null
      if (!reminderMessage) {
        reminderMessage = JSON.stringify({ originalFolderId: originalFolderIdFromExisting })
      } else {
        try {
          const existingData = JSON.parse(reminderMessage)
          reminderMessage = JSON.stringify({ ...existingData, originalFolderId: originalFolderIdFromExisting })
        } catch {
          reminderMessage = JSON.stringify({ originalFolderId: originalFolderIdFromExisting, customMessage: reminderMessage })
        }
      }

      db.prepare(`
        UPDATE reminders 
        SET due_date = ?, message = ?
        WHERE id = ?
      `).run(reminder.dueDate, reminderMessage, existingReminder.id)
      
      return { id: existingReminder.id, ...reminder, completed: false, createdAt: now }
    }
    
    // Create new reminder if none exists
    // Store original folder_id in message field as JSON (if no custom message) or append to custom message
    let reminderMessage = reminder.message || null
    if (!reminderMessage) {
      // No custom message, store original folder in JSON
      reminderMessage = JSON.stringify({ originalFolderId })
    } else {
      // Has custom message, store both
      try {
        const existingData = JSON.parse(reminderMessage)
        reminderMessage = JSON.stringify({ ...existingData, originalFolderId })
      } catch {
        // Not JSON, create new structure
        reminderMessage = JSON.stringify({ originalFolderId, customMessage: reminderMessage })
      }
    }
    
    db.prepare(`
      INSERT INTO reminders (id, email_id, account_id, due_date, message, completed, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(id, reminder.emailId, reminder.accountId, reminder.dueDate, reminderMessage, now)
    
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
    const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as any
    if (!reminder) {
      throw new Error('Reminder not found')
    }

    // Get email to find original folder
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(reminder.email_id) as any
    if (!email) {
      // Email doesn't exist, just delete reminder
      db.prepare('DELETE FROM reminders WHERE id = ?').run(id)
      return { success: true }
    }

    // Try to extract original folder from message field (if stored)
    let originalFolderId: string | null = null
    try {
      const messageData = JSON.parse(reminder.message || '{}')
      if (messageData.originalFolderId) {
        originalFolderId = messageData.originalFolderId
      }
    } catch {
      // If message is not JSON, it's a custom message, try to find original folder
      // For now, default to Inbox if we can't determine
      const inboxFolder = db.prepare(`
        SELECT id FROM folders 
        WHERE account_id = ? AND LOWER(name) = 'inbox'
        LIMIT 1
      `).get(reminder.account_id) as any
      originalFolderId = inboxFolder?.id || null
    }

    // If we have an original folder, move email back
    if (originalFolderId) {
      const now = Date.now()
      try {
        db.prepare(`
          UPDATE emails 
          SET folder_id = ?, updated_at = ?
          WHERE id = ?
        `).run(originalFolderId, now, reminder.email_id)

        // Try to move on IMAP server if account is IMAP
        const account = await accountManager.getAccount(reminder.account_id)
        if (account && account.type === 'imap') {
          try {
            const imapClient = getIMAPClient(account)
            await imapClient.connect()
            
            // Get current folder (Reminders) and original folder paths
            const currentFolder = db.prepare('SELECT path FROM folders WHERE id = ?').get(email.folder_id) as any
            const originalFolder = db.prepare('SELECT path FROM folders WHERE id = ?').get(originalFolderId) as any
            
            if (currentFolder && originalFolder) {
              const currentPath = currentFolder.path === 'INBOX' ? 'INBOX' : currentFolder.path
              const originalPath = originalFolder.path === 'INBOX' ? 'INBOX' : originalFolder.path
              await imapClient.moveEmail(email.uid, currentPath, originalPath)
            }
            
            await imapClient.disconnect()
          } catch (error) {
            logger.error('Error moving email back on IMAP server:', error)
            // Continue anyway - email is already moved in database
          }
        }
      } catch (error) {
        logger.error('Error moving email back to original folder:', error)
        // Continue to delete reminder anyway
      }
    }

    // Delete the reminder
    db.prepare('DELETE FROM reminders WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('reminders:getByEmail', async (_, emailId: string) => {
    const db = getDatabase()
    const reminder = db.prepare(`
      SELECT * FROM reminders 
      WHERE email_id = ? AND completed = 0
      ORDER BY due_date ASC
      LIMIT 1
    `).get(emailId) as any
    return reminder || null
  })

  ipcMain.handle('reminders:deleteByEmail', async (_, emailId: string) => {
    const db = getDatabase()
    const reminder = db.prepare(`
      SELECT * FROM reminders 
      WHERE email_id = ? AND completed = 0
      ORDER BY due_date ASC
      LIMIT 1
    `).get(emailId) as any
    
    if (!reminder) {
      return { success: false, message: 'No reminder found for this email' }
    }

    // Reuse the delete logic
    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(reminder.email_id) as any
    if (!email) {
      db.prepare('DELETE FROM reminders WHERE id = ?').run(reminder.id)
      return { success: true }
    }

    // Try to extract original folder from message field
    let originalFolderId: string | null = null
    try {
      const messageData = JSON.parse(reminder.message || '{}')
      if (messageData.originalFolderId) {
        originalFolderId = messageData.originalFolderId
      }
    } catch {
      const inboxFolder = db.prepare(`
        SELECT id FROM folders 
        WHERE account_id = ? AND LOWER(name) = 'inbox'
        LIMIT 1
      `).get(reminder.account_id) as any
      originalFolderId = inboxFolder?.id || null
    }

    // Move email back to original folder if we have it
    if (originalFolderId) {
      const now = Date.now()
      try {
        db.prepare(`
          UPDATE emails 
          SET folder_id = ?, updated_at = ?
          WHERE id = ?
        `).run(originalFolderId, now, reminder.email_id)

        const account = await accountManager.getAccount(reminder.account_id)
        if (account && account.type === 'imap') {
          try {
            const imapClient = getIMAPClient(account)
            await imapClient.connect()
            
            const currentFolder = db.prepare('SELECT path FROM folders WHERE id = ?').get(email.folder_id) as any
            const originalFolder = db.prepare('SELECT path FROM folders WHERE id = ?').get(originalFolderId) as any
            
            if (currentFolder && originalFolder) {
              const currentPath = currentFolder.path === 'INBOX' ? 'INBOX' : currentFolder.path
              const originalPath = originalFolder.path === 'INBOX' ? 'INBOX' : originalFolder.path
              await imapClient.moveEmail(email.uid, currentPath, originalPath)
            }
            
            await imapClient.disconnect()
          } catch (error) {
            logger.error('Error moving email back on IMAP server:', error)
          }
        }
      } catch (error) {
        logger.error('Error moving email back to original folder:', error)
      }
    }

    db.prepare('DELETE FROM reminders WHERE id = ?').run(reminder.id)
    return { success: true }
  })
}

// Test handlers
export function registerTestHandlers() {
  ipcMain.handle('test:create-reminder-email', async (_, minutesFromNow: number = 5) => {
    const db = getDatabase()
    const { encryption } = require('../database')
    
    // Get the first available account
    const accounts = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC LIMIT 1').all() as any[]
    
    if (accounts.length === 0) {
      throw new Error('No accounts found. Please add an account first.')
    }
    
    const account = accounts[0]
    
    // Find or get inbox folder
    const inboxFolder = db.prepare(`
      SELECT * FROM folders 
      WHERE account_id = ? AND (LOWER(name) = 'inbox' OR LOWER(path) = 'INBOX')
      LIMIT 1
    `).get(account.id) as any
    
    if (!inboxFolder) {
      throw new Error('Inbox folder not found. Please sync your account first.')
    }
    
    // Find or create Reminders folder first (we'll move email there)
    let remindersFolder = db.prepare(`
      SELECT * FROM folders 
      WHERE account_id = ? AND (LOWER(name) = 'reminders' OR LOWER(path) LIKE '%reminders%')
      LIMIT 1
    `).get(account.id) as any
    
    if (!remindersFolder) {
      // Create local Reminders folder
      const folderId = randomUUID()
      const folderNow = Date.now()
      db.prepare(`
        INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      `).run(
        folderId,
        account.id,
        'Reminders',
        'Reminders',
        JSON.stringify([]),
        folderNow,
        folderNow
      )
      remindersFolder = { id: folderId, path: 'Reminders' }
    }
    
    // Get the highest UID in the Reminders folder to avoid conflicts
    // Use a very high base number (1000000) plus timestamp to ensure uniqueness for test emails
    const maxUidResult = db.prepare(`
      SELECT MAX(uid) as max_uid FROM emails 
      WHERE account_id = ? AND folder_id = ?
    `).get(account.id, remindersFolder.id) as any
    
    // Use timestamp-based UID for test emails to ensure uniqueness
    // This avoids conflicts with real emails
    const testUidBase = 1000000000 // High base number for test emails
    const nextUid = Math.max(
      (maxUidResult?.max_uid || 0) + 1,
      testUidBase + Math.floor(Date.now() / 1000) // Use seconds timestamp to keep it reasonable
    )
    
    // Create test email
    const emailId = randomUUID()
    const messageId = `<test-${Date.now()}@ayemail.local>`
    const now = Date.now()
    
    const testEmail = {
      subject: `Test Reminder Email - ${minutesFromNow} Minutes`,
      from: [{ name: 'Test Sender', address: 'test@example.com' }],
      to: [{ name: account.name || 'You', address: account.email }],
      body: `This is a test email with a reminder set for ${minutesFromNow} minutes from now.

The reminder should trigger at: ${new Date(now + minutesFromNow * 60 * 1000).toLocaleString()}

This email was created for testing the reminder functionality.`,
      htmlBody: `<p>This is a test email with a reminder set for <strong>${minutesFromNow} minutes</strong> from now.</p>
<p>The reminder should trigger at: <strong>${new Date(now + minutesFromNow * 60 * 1000).toLocaleString()}</strong></p>
<p>This email was created for testing the reminder functionality.</p>`
    }
    
    // Encrypt email body
    const bodyEncrypted = encryption.encrypt(testEmail.body)
    const htmlBodyEncrypted = encryption.encrypt(testEmail.htmlBody)
    
    // Insert email directly into Reminders folder (not inbox first)
    db.prepare(`
      INSERT INTO emails (
        id, account_id, folder_id, uid, message_id, subject,
        from_addresses, to_addresses, cc_addresses, bcc_addresses, reply_to_addresses,
        date, body_encrypted, html_body_encrypted, text_body_encrypted, headers_encrypted,
        flags, is_read, is_starred, thread_id, in_reply_to, email_references,
        encrypted, signed, signature_verified, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      emailId,
      account.id,
      remindersFolder.id, // Insert directly into Reminders folder
      nextUid,
      messageId,
      testEmail.subject,
      JSON.stringify(testEmail.from),
      JSON.stringify(testEmail.to),
      null, // cc
      null, // bcc
      null, // reply_to
      now,
      bodyEncrypted,
      htmlBodyEncrypted,
      null, // text_body (we have html_body)
      null, // headers
      JSON.stringify([]), // flags
      0, // is_read
      0, // is_starred
      null, // thread_id
      null, // in_reply_to
      null, // email_references
      0, // encrypted
      0, // signed
      null, // signature_verified
      now,
      now
    )
    
    // Create reminder
    const reminderId = randomUUID()
    const reminderDueDate = now + (minutesFromNow * 60 * 1000)
    
    // Store original folder in message field
    const reminderMessage = JSON.stringify({ originalFolderId: inboxFolder.id })
    
    db.prepare(`
      INSERT INTO reminders (id, email_id, account_id, due_date, message, completed, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(
      reminderId,
      emailId,
      account.id,
      reminderDueDate,
      reminderMessage,
      now
    )
    
    // Update folder counts
    db.prepare(`
      UPDATE folders 
      SET total_count = total_count + 1, updated_at = ?
      WHERE id = ?
    `).run(now, remindersFolder.id)
    
    return {
      success: true,
      emailId,
      reminderId,
      dueDate: reminderDueDate,
      dueDateFormatted: new Date(reminderDueDate).toLocaleString(),
      accountEmail: account.email,
      minutesFromNow
    }
  })
  
  // Test handler to get reminder scheduler status
  ipcMain.handle('test:reminder-scheduler-status', async () => {
    const { reminderScheduler } = require('../reminders/scheduler')
    return reminderScheduler.getStatus()
  })

  // Test handler to trigger reminders immediately (for testing)
  ipcMain.handle('test:trigger-reminders-now', async () => {
    const db = getDatabase()
    const now = Date.now()
    
    // Get all incomplete reminders and set their due_date to now
    const reminders = db.prepare(`
      SELECT id FROM reminders WHERE completed = 0
    `).all() as any[]
    
    if (reminders.length === 0) {
      return { success: false, message: 'No incomplete reminders found' }
    }
    
    // Set all reminders to trigger now
    for (const reminder of reminders) {
      db.prepare('UPDATE reminders SET due_date = ? WHERE id = ?').run(now, reminder.id)
    }
    
    // Manually trigger the scheduler check
    const { reminderScheduler } = require('../reminders/scheduler')
    reminderScheduler.checkNow()
    
    return {
      success: true,
      message: `Triggered ${reminders.length} reminder(s)`,
      count: reminders.length
    }
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

// Window handlers
export function registerWindowHandlers() {
  ipcMain.handle('window:compose:create', async (_, accountId: string, replyTo?: any) => {
    const { createComposeWindow } = await import('../electron/main')
    
    // Create window immediately - don't wait for email fetch
    // This makes the window appear instantly
    const composeWindow = createComposeWindow(accountId, replyTo)
    
    // Helper function to send data when window is ready
    const sendReplyData = (data: any) => {
      if (composeWindow.isDestroyed()) return
      
      const trySend = () => {
        if (!composeWindow.isDestroyed()) {
          composeWindow.webContents.send('compose:reply-data', data)
        }
      }
      
      // If window is still loading, wait for it to finish
      if (composeWindow.webContents.isLoading()) {
        composeWindow.webContents.once('did-finish-load', trySend)
      } else {
        // Window already loaded, but wait a tiny bit to ensure renderer is ready
        setTimeout(trySend, 100)
      }
    }
    
    // If replyTo has emailId, fetch the email asynchronously after window is shown
    if (replyTo?.emailId) {
      // Fetch email in background and send via IPC when ready
      emailStorage.getEmail(replyTo.emailId, { fetchRemoteBody: true, fetchTimeoutMs: 60000 })
        .then((email) => {
          if (email && composeWindow && !composeWindow.isDestroyed()) {
            // Only pass essential fields (exclude attachments to avoid cloning issues)
            const emailData = {
              id: email.id,
              from: email.from,
              to: email.to,
              cc: email.cc,
              subject: email.subject,
              date: email.date,
              htmlBody: email.htmlBody,
              textBody: email.textBody,
              body: email.body,
              forward: replyTo.forward || false
            }
            sendReplyData(emailData)
          }
        })
        .catch((error) => {
          logger.error('Error fetching email for compose:', error)
          // Send error notification if window still exists
          if (composeWindow && !composeWindow.isDestroyed()) {
            sendReplyData({ error: 'Failed to load email' })
          }
        })
    } else if (replyTo) {
      // If replyTo data is already provided (not just emailId), send it immediately
      sendReplyData(replyTo)
    }
    
    return { success: true }
  })

  ipcMain.handle('window:compose:close', async (_, windowId?: number) => {
    const { getAllComposeWindows } = await import('../electron/main')
    if (windowId) {
      const window = BrowserWindow.fromId(windowId)
      if (window) {
        window.close()
      }
    } else {
      // Close focused window or first compose window
      const focused = BrowserWindow.getFocusedWindow()
      if (focused) {
        focused.close()
      } else {
        const windows = getAllComposeWindows()
        if (windows.length > 0) {
          windows[0].close()
        }
      }
    }
    return { success: true }
  })

  ipcMain.handle('window:email-viewer:create', async (_, emailId: string) => {
    const { createEmailViewerWindow } = await import('../electron/main')
    createEmailViewerWindow(emailId)
    return { success: true }
  })

  ipcMain.handle('window:set-title', async (_, windowId: number, title: string) => {
    const window = BrowserWindow.fromId(windowId)
    if (window) {
      window.setTitle(title)
    }
    return { success: true }
  })

  ipcMain.handle('window:minimize', async (_, windowId?: string) => {
    const window = windowId ? BrowserWindow.fromId(parseInt(windowId)) : BrowserWindow.getFocusedWindow()
    if (window) {
      window.minimize()
    }
    return { success: true }
  })

  ipcMain.handle('window:maximize', async (_, windowId?: string) => {
    const window = windowId ? BrowserWindow.fromId(parseInt(windowId)) : BrowserWindow.getFocusedWindow()
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }
    return { success: true }
  })

  ipcMain.handle('window:close', async (_, windowId?: string) => {
    const window = windowId ? BrowserWindow.fromId(parseInt(windowId)) : BrowserWindow.getFocusedWindow()
    if (window) {
      window.close()
    }
    return { success: true }
  })

  ipcMain.handle('window:getId', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return window ? window.id : null
  })
}

// Contact handlers
export function registerContactHandlers() {
  ipcMain.handle('contacts:search', async (_, query: string, limit?: number) => {
    return contactManager.searchRecipients(query, limit || 20)
  })

  ipcMain.handle('contacts:add', async (_, email: string, name?: string) => {
    contactManager.addOrUpdateRecipient(email, name)
    return { success: true }
  })

  ipcMain.handle('contacts:list', async (_, limit?: number) => {
    return contactManager.getRecipients(limit || 20)
  })

  ipcMain.handle('contacts:extract-from-existing', async () => {
    const result = contactManager.extractContactsFromExistingEmails()
    return result
  })

  ipcMain.handle('contacts:remove-from-spam', async () => {
    const result = contactManager.removeContactsFromSpamEmails()
    return result
  })

  // Native contacts handlers
  ipcMain.handle('contacts:native:isAvailable', async () => {
    try {
      const { isNativeContactsAvailable } = await import('../contacts/native-contacts')
      return { available: isNativeContactsAvailable() }
    } catch (error: any) {
      return { available: false, error: error.message }
    }
  })

  ipcMain.handle('contacts:native:get', async () => {
    try {
      const { getNativeContacts } = await import('../contacts/native-contacts')
      const contacts = await getNativeContacts()
      return { success: true, contacts }
    } catch (error: any) {
      logger.error('Error getting native contacts:', error)
      return { success: false, error: error.message, contacts: [] }
    }
  })

  ipcMain.handle('contacts:native:sync', async () => {
    try {
      const { getNativeContacts } = await import('../contacts/native-contacts')
      const nativeContacts = await getNativeContacts()
      
      let synced = 0
      let updated = 0
      
      for (const contact of nativeContacts) {
        if (contact.email && contact.email.includes('@')) {
          const existing = contactManager.searchRecipients(contact.email, 1)
          if (existing.length === 0) {
            // New contact
            contactManager.addOrUpdateRecipient(contact.email, contact.name)
            synced++
          } else {
            // Update existing if name is better
            const existingContact = existing[0]
            if (contact.name && (!existingContact.name || contact.name.length > existingContact.name.length)) {
              contactManager.addOrUpdateRecipient(contact.email, contact.name)
              updated++
            }
          }
        }
      }
      
      return { 
        success: true, 
        synced, 
        updated, 
        total: nativeContacts.length 
      }
    } catch (error: any) {
      logger.error('Error syncing native contacts:', error)
      return { success: false, error: error.message }
    }
  })
}

// Shell handlers
export function registerShellHandlers() {
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    try {
      await shell.openExternal(url)
    } catch (error: any) {
      logger.error('Error opening external URL:', error)
      throw new Error(`Failed to open URL: ${error.message || 'Unknown error'}`)
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
  registerWindowHandlers()
  registerContactHandlers()
  registerShellHandlers()
  registerTestHandlers()
}
