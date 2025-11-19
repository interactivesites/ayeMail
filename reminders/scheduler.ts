import { Notification } from 'electron'
import { getDatabase } from '../database'
import { accountManager } from '../email/account-manager'
import { getIMAPClient } from '../email/imap-client'

export class ReminderScheduler {
  private checkInterval: NodeJS.Timeout | null = null
  private checkIntervalMs = 60000 // Check every minute
  private checkCount = 0 // Track number of checks for logging

  start() {
    if (this.checkInterval) {
      return // Already started
    }

    
    this.checkInterval = setInterval(() => {
      this.checkReminders()
    }, this.checkIntervalMs)

    // Check immediately on start
    this.checkReminders()
  }

  // Public method to manually trigger a check (for testing)
  checkNow() {
    this.checkReminders()
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      this.checkCount = 0
    }
  }

  // Get status for debugging
  getStatus() {
    return {
      isRunning: this.checkInterval !== null,
      checkCount: this.checkCount,
      intervalMs: this.checkIntervalMs
    }
  }

  private async checkReminders() {
    this.checkCount++
    const db = getDatabase()
    const now = Date.now()

    const dueReminders = db.prepare(`
      SELECT r.*, e.subject, e.from_addresses, e.id as email_id, e.account_id, e.uid, e.folder_id
      FROM reminders r
      JOIN emails e ON r.email_id = e.id
      WHERE r.completed = 0 AND r.due_date <= ?
      ORDER BY r.due_date ASC
    `).all(now) as any[]

    for (const reminder of dueReminders) {
      await this.triggerReminder(reminder)
    }
  }

  private async triggerReminder(reminder: any) {
    const db = getDatabase()
    
    // Find inbox folder for the account
    const inboxFolder = db.prepare(`
      SELECT * FROM folders 
      WHERE account_id = ? AND (LOWER(name) = 'inbox' OR LOWER(path) = 'INBOX')
      LIMIT 1
    `).get(reminder.account_id) as any

    if (!inboxFolder) {
      console.error('Inbox folder not found for account:', reminder.account_id)
      // Still mark reminder as completed even if we can't move the email
      db.prepare('UPDATE reminders SET completed = 1 WHERE id = ?').run(reminder.id)
      return
    }

    // Move email back to inbox
    // Check if email already exists in inbox with same account_id and uid
    const existingInboxEmail = db.prepare(`
      SELECT id FROM emails 
      WHERE account_id = ? AND folder_id = ? AND uid = ? AND id != ?
    `).get(reminder.account_id, inboxFolder.id, reminder.uid, reminder.email_id) as any

    const now = Date.now()
    
    if (existingInboxEmail) {
      // Email already exists in inbox, just delete the current one
      db.prepare('DELETE FROM emails WHERE id = ?').run(reminder.email_id)
    } else {
      // Move email to inbox
      try {
        db.prepare(`
          UPDATE emails 
          SET folder_id = ?, updated_at = ?
          WHERE id = ?
        `).run(inboxFolder.id, now, reminder.email_id)
      } catch (updateError: any) {
        // Handle UNIQUE constraint violation - email might have been synced to inbox
        if (updateError?.code === 'SQLITE_CONSTRAINT' || updateError?.message?.includes('UNIQUE constraint')) {
          // Check if email exists in inbox now
          const inboxEmail = db.prepare(`
            SELECT id FROM emails 
            WHERE account_id = ? AND folder_id = ? AND uid = ?
          `).get(reminder.account_id, inboxFolder.id, reminder.uid) as any
          
          if (inboxEmail) {
            // Email already in inbox, delete the duplicate
            db.prepare('DELETE FROM emails WHERE id = ?').run(reminder.email_id)
          } else {
            // Re-throw if it's a different constraint error
            console.error('Error moving email to inbox:', updateError)
          }
        } else {
          console.error('Error moving email to inbox:', updateError)
        }
      }
    }

    // Try to move on IMAP server if account is IMAP
    const account = await accountManager.getAccount(reminder.account_id)
    if (account && account.type === 'imap') {
      try {
        const imapClient = getIMAPClient(account)
        await imapClient.connect()
        
        // Get current folder path
        const currentFolder = db.prepare('SELECT path FROM folders WHERE id = ?').get(reminder.folder_id) as any
        const inboxPath = inboxFolder.path === 'INBOX' ? 'INBOX' : inboxFolder.path
        
        if (currentFolder && inboxPath) {
          // Use IMAP MOVE command if available, otherwise COPY + DELETE
          const currentPath = currentFolder.path === 'INBOX' ? 'INBOX' : currentFolder.path
          await imapClient.moveEmail(reminder.uid, currentPath, inboxPath)
        }
        
        await imapClient.disconnect()
      } catch (error) {
        console.error('Error moving email on IMAP server:', error)
        // Continue anyway - email is already moved in database
      }
    }

    // Show notification
    if (Notification.isSupported()) {
      // Parse reminder message if it's JSON (contains originalFolderId)
      let notificationBody = `Follow up on: ${reminder.subject || 'email'}`
      if (reminder.message) {
        try {
          const messageData = JSON.parse(reminder.message)
          if (messageData.customMessage) {
            notificationBody = messageData.customMessage
          } else {
            notificationBody = `Follow up on: ${reminder.subject || 'email'}`
          }
        } catch {
          // Not JSON, use as-is
          notificationBody = reminder.message
        }
      }
      
      console.log(`[ReminderScheduler] Triggering reminder for email: ${reminder.email_id}, subject: ${reminder.subject}`)
      
      const notification = new Notification({
        title: 'Email Reminder',
        body: notificationBody,
        silent: false
      })
      
      notification.on('click', () => {
        console.log('[ReminderScheduler] Notification clicked')
      })
      
      notification.on('show', () => {
        console.log('[ReminderScheduler] Notification shown')
      })
      
      notification.show()
    } else {
      console.warn('[ReminderScheduler] Notifications not supported on this platform')
    }

    // Mark reminder as completed
    db.prepare('UPDATE reminders SET completed = 1 WHERE id = ?').run(reminder.id)
  }
}

export const reminderScheduler = new ReminderScheduler()

