#!/usr/bin/env node

/**
 * Script to create a test email with a reminder set for 5 minutes from now
 * 
 * Usage: 
 *   1. Build the electron code: npm run build:electron
 *   2. Run: node create-test-reminder.js
 * 
 * Note: This script requires Electron's app module for database path resolution.
 * Make sure you've built the electron code first.
 */

const { app } = require('electron')
const path = require('path')

// Initialize Electron app (required for database path)
if (!app.isReady()) {
  app.whenReady().then(() => {
    runScript()
  })
} else {
  runScript()
}

async function runScript() {
  try {
    // Load compiled modules
    const { getDatabase } = require('./dist-electron/database/index.js')
    const { encryption } = require('./dist-electron/database/encryption.js')
    const { randomUUID } = require('crypto')
    
    await createTestReminder(getDatabase, encryption, randomUUID)
    
    console.log('\n✓ Test email with reminder created successfully!')
    console.log('  The reminder will trigger in 5 minutes.')
    app.quit()
  } catch (error) {
    console.error('\n✗ Error creating test reminder:', error.message)
    console.error(error.stack)
    app.quit()
    process.exit(1)
  }
}

async function createTestReminder(getDatabase, encryption, randomUUID) {
  const db = getDatabase()
  
  // Get the first available account
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC LIMIT 1').all()
  
  if (accounts.length === 0) {
    throw new Error('No accounts found. Please add an account first.')
  }
  
  const account = accounts[0]
  console.log(`Using account: ${account.email} (${account.id})`)
  
  // Find or get inbox folder
  const inboxFolder = db.prepare(`
    SELECT * FROM folders 
    WHERE account_id = ? AND (LOWER(name) = 'inbox' OR LOWER(path) = 'INBOX')
    LIMIT 1
  `).get(account.id)
  
  if (!inboxFolder) {
    throw new Error('Inbox folder not found. Please sync your account first.')
  }
  
  console.log(`Using inbox folder: ${inboxFolder.name} (${inboxFolder.id})`)
  
  // Get the highest UID in the inbox to avoid conflicts
  const maxUidResult = db.prepare(`
    SELECT MAX(uid) as max_uid FROM emails 
    WHERE account_id = ? AND folder_id = ?
  `).get(account.id, inboxFolder.id)
  
  const nextUid = (maxUidResult?.max_uid || 0) + 1
  
  // Create test email
  const emailId = randomUUID()
  const messageId = `<test-${Date.now()}@ayemail.local>`
  const now = Date.now()
  
  const testEmail = {
    subject: 'Test Reminder Email - 5 Minutes',
    from: [{ name: 'Test Sender', address: 'test@example.com' }],
    to: [{ name: account.name || 'You', address: account.email }],
    body: `This is a test email with a reminder set for 5 minutes from now.

The reminder should trigger at: ${new Date(now + 5 * 60 * 1000).toLocaleString()}

This email was created for testing the reminder functionality.`,
    htmlBody: `<p>This is a test email with a reminder set for <strong>5 minutes</strong> from now.</p>
<p>The reminder should trigger at: <strong>${new Date(now + 5 * 60 * 1000).toLocaleString()}</strong></p>
<p>This email was created for testing the reminder functionality.</p>`
  }
  
  // Encrypt email body
  const bodyEncrypted = encryption.encrypt(testEmail.body)
  const htmlBodyEncrypted = encryption.encrypt(testEmail.htmlBody)
  
  // Insert email into database
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
    inboxFolder.id,
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
  
  console.log(`✓ Created test email: ${emailId}`)
  
  // Find or create Reminders folder
  let remindersFolder = db.prepare(`
    SELECT * FROM folders 
    WHERE account_id = ? AND (LOWER(name) = 'reminders' OR LOWER(path) LIKE '%reminders%')
    LIMIT 1
  `).get(account.id)
  
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
    console.log(`✓ Created Reminders folder: ${folderId}`)
  }
  
  // Move email to Reminders folder
  db.prepare(`
    UPDATE emails 
    SET folder_id = ?, updated_at = ?
    WHERE id = ?
  `).run(remindersFolder.id, now, emailId)
  
  console.log(`✓ Moved email to Reminders folder`)
  
  // Create reminder for 5 minutes from now
  const reminderId = randomUUID()
  const reminderDueDate = now + (5 * 60 * 1000) // 5 minutes from now
  
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
  
  console.log(`✓ Created reminder: ${reminderId}`)
  console.log(`  Due date: ${new Date(reminderDueDate).toLocaleString()}`)
  console.log(`  (${Math.round((reminderDueDate - now) / 1000 / 60)} minutes from now)`)
  
  // Update folder counts
  db.prepare(`
    UPDATE folders 
    SET total_count = total_count + 1, updated_at = ?
    WHERE id = ?
  `).run(now, remindersFolder.id)
  
  return {
    emailId,
    reminderId,
    dueDate: reminderDueDate,
    accountEmail: account.email
  }
}

