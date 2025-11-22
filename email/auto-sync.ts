import { emailStorage } from './email-storage'
import { accountManager } from './account-manager'
import { getDatabase } from '../database'
import { Logger } from '../shared/logger'

const logger = Logger.create('AutoSync')

export class AutoSyncScheduler {
  private syncInterval: NodeJS.Timeout | null = null
  private syncIntervalMs = 300000 // 5 minutes by default
  private isSyncing = false
  private mainWindow: Electron.BrowserWindow | null = null

  setMainWindow(window: Electron.BrowserWindow) {
    this.mainWindow = window
  }

  start(intervalMinutes: number = 5) {
    if (this.syncInterval) {
      return // Already started
    }

    this.syncIntervalMs = intervalMinutes * 60000
    logger.log(`Starting auto-sync with interval: ${intervalMinutes} minutes`)

    this.syncInterval = setInterval(() => {
      this.performAutoSync()
    }, this.syncIntervalMs)

    // Perform initial sync after 30 seconds
    setTimeout(() => {
      this.performAutoSync()
    }, 30000)
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      logger.log('Auto-sync stopped')
    }
  }

  updateInterval(intervalMinutes: number) {
    this.stop()
    if (intervalMinutes > 0) {
      this.start(intervalMinutes)
    }
  }

  private async performAutoSync() {
    if (this.isSyncing) {
      logger.log('Auto-sync: Already syncing, skipping this cycle')
      return
    }

    try {
      this.isSyncing = true
      logger.log('Auto-sync: Starting automatic sync...')

      const accounts = await accountManager.getAllAccounts()
      if (accounts.length === 0) {
        logger.log('Auto-sync: No accounts configured, skipping')
        return
      }

      const db = getDatabase()
      let totalNewUnread = 0
      const newEmailsForNotification: any[] = []

      // Sync inbox for each account (prioritized)
      for (const account of accounts) {
        try {
          // Check if sync was cancelled for this account
          const cancelToken = (emailStorage as any).cancellationTokens?.get(account.id)
          if (cancelToken?.cancelled) {
            logger.log(`Auto-sync: Sync cancelled for account ${account.email}, skipping`)
            continue
          }

          logger.log(`Auto-sync: Syncing inbox for account ${account.email}`)
          
          let inboxFolder = db.prepare(
            "SELECT * FROM folders WHERE account_id = ? AND (LOWER(name) = 'inbox' OR LOWER(path) = 'inbox') LIMIT 1"
          ).get(account.id) as any

          if (!inboxFolder) {
            logger.warn(`Auto-sync: No inbox found for account ${account.email}, attempting to sync folders`)
            try {
              await emailStorage.syncFoldersOnly(account.id)
              inboxFolder = db.prepare(
                "SELECT * FROM folders WHERE account_id = ? AND (LOWER(name) = 'inbox' OR LOWER(path) = 'inbox') LIMIT 1"
              ).get(account.id) as any
            } catch (folderSyncError) {
              logger.error(`Auto-sync: Failed to sync folders for ${account.email}:`, folderSyncError)
            }
          }

          if (!inboxFolder) {
            logger.warn(`Auto-sync: Still no inbox found for account ${account.email} after attempting folder sync`)
            continue
          }

          // Get unread count before sync
          const beforeCount = db.prepare(
            'SELECT COUNT(*) as count FROM emails WHERE folder_id = ? AND is_read = 0'
          ).get(inboxFolder.id) as any
          const unreadBefore = beforeCount?.count || 0

          // Sync inbox folder with progress callback that tracks new emails
          const newEmailsThisFolder: any[] = []
          const progressCallback = (data: any) => {
            // Check if sync was cancelled
            const cancelToken = (emailStorage as any).cancellationTokens?.get(account.id)
            if (cancelToken?.cancelled) {
              return
            }
            
            // Send progress to renderer for UI updates
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('emails:sync-progress', data)
            }
            
            // Track new unread emails
            if (data.email && !data.email.isRead) {
              newEmailsThisFolder.push({
                id: data.email.id,
                subject: data.email.subject,
                from: data.email.from,
                folder: 'Inbox'
              })
            }
          }

          await emailStorage.syncFolder(account.id, inboxFolder.id, progressCallback)

          // Get unread count after sync
          const afterCount = db.prepare(
            'SELECT COUNT(*) as count FROM emails WHERE folder_id = ? AND is_read = 0'
          ).get(inboxFolder.id) as any
          const unreadAfter = afterCount?.count || 0
          const newUnread = unreadAfter - unreadBefore

          totalNewUnread += newUnread
          newEmailsForNotification.push(...newEmailsThisFolder)

          if (newUnread > 0) {
            logger.log(`Auto-sync: ${newUnread} new unread emails in ${account.email} inbox`)
          }
        } catch (error) {
          logger.error(`Auto-sync: Error syncing account ${account.email}:`, error)
        }
      }

      // Notify renderer about new emails if any
      if (totalNewUnread > 0 && this.mainWindow && !this.mainWindow.isDestroyed()) {
        // Send new emails event for notifications
        this.mainWindow.webContents.send('emails:new-emails', {
          accountId: 'all',
          count: totalNewUnread,
          emails: newEmailsForNotification.slice(0, 5)
        })
        
        // Refresh email list in renderer
        this.mainWindow.webContents.send('auto-sync:refresh-needed')
        logger.log(`Auto-sync: Complete. ${totalNewUnread} new unread emails across all accounts`)
      } else {
        logger.log('Auto-sync: Complete. No new emails')
      }
    } catch (error) {
      logger.error('Auto-sync: Error during automatic sync:', error)
    } finally {
      this.isSyncing = false
    }
  }

  // Force an immediate sync
  async forceSyncNow() {
    logger.log('Auto-sync: Force sync requested')
    await this.performAutoSync()
  }
}

export const autoSyncScheduler = new AutoSyncScheduler()
