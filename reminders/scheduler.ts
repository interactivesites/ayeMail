import { Notification } from 'electron'
import { getDatabase } from '../database'

export class ReminderScheduler {
  private checkInterval: NodeJS.Timeout | null = null
  private checkIntervalMs = 60000 // Check every minute

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

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  private async checkReminders() {
    const db = getDatabase()
    const now = Date.now()

    const dueReminders = db.prepare(`
      SELECT r.*, e.subject, e.from_addresses
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
    // Show notification
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'Email Reminder',
        body: reminder.message || `Follow up on: ${reminder.subject || 'email'}`,
        silent: false
      })
      notification.show()
    }

    // Mark reminder as completed (or you could keep it active and reschedule)
    // For now, we'll mark it as completed after showing
    // In a real implementation, you might want to reschedule or keep it active
    const db = getDatabase()
    db.prepare('UPDATE reminders SET completed = 1 WHERE id = ?').run(reminder.id)
  }
}

export const reminderScheduler = new ReminderScheduler()

