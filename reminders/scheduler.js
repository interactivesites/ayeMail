"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminderScheduler = exports.ReminderScheduler = void 0;
const electron_1 = require("electron");
const database_1 = require("../database");
class ReminderScheduler {
    constructor() {
        this.checkInterval = null;
        this.checkIntervalMs = 60000; // Check every minute
    }
    start() {
        if (this.checkInterval) {
            return; // Already started
        }
        this.checkInterval = setInterval(() => {
            this.checkReminders();
        }, this.checkIntervalMs);
        // Check immediately on start
        this.checkReminders();
    }
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
    async checkReminders() {
        const db = (0, database_1.getDatabase)();
        const now = Date.now();
        const dueReminders = db.prepare(`
      SELECT r.*, e.subject, e.from_addresses
      FROM reminders r
      JOIN emails e ON r.email_id = e.id
      WHERE r.completed = 0 AND r.due_date <= ?
      ORDER BY r.due_date ASC
    `).all(now);
        for (const reminder of dueReminders) {
            await this.triggerReminder(reminder);
        }
    }
    async triggerReminder(reminder) {
        // Show notification
        if (electron_1.Notification.isSupported()) {
            const notification = new electron_1.Notification({
                title: 'Email Reminder',
                body: reminder.message || `Follow up on: ${reminder.subject || 'email'}`,
                silent: false
            });
            notification.show();
        }
        // Mark reminder as completed (or you could keep it active and reschedule)
        // For now, we'll mark it as completed after showing
        // In a real implementation, you might want to reschedule or keep it active
        const db = (0, database_1.getDatabase)();
        db.prepare('UPDATE reminders SET completed = 1 WHERE id = ?').run(reminder.id);
    }
}
exports.ReminderScheduler = ReminderScheduler;
exports.reminderScheduler = new ReminderScheduler();
