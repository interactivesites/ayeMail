import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'

const getDbPath = () => {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'database')
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }
  return join(dbDir, 'imail.db')
}

export function createDatabase(): Database.Database {
  const dbPath = getDbPath()
  const db = new Database(dbPath)
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON')
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('imap', 'pop3')),
      imap_host TEXT,
      imap_port INTEGER,
      imap_secure INTEGER DEFAULT 1,
      pop3_host TEXT,
      pop3_port INTEGER,
      pop3_secure INTEGER DEFAULT 1,
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER NOT NULL,
      smtp_secure INTEGER DEFAULT 1,
      auth_type TEXT NOT NULL CHECK(auth_type IN ('oauth2', 'password')),
      oauth2_provider TEXT,
      oauth2_access_token_encrypted TEXT,
      oauth2_refresh_token_encrypted TEXT,
      oauth2_expires_at INTEGER,
      password_encrypted TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      parent_id TEXT,
      subscribed INTEGER DEFAULT 1,
      unread_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0,
      attributes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL,
      UNIQUE(account_id, path)
    );

    CREATE INDEX IF NOT EXISTS idx_folders_account ON folders(account_id);
    CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);

    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      folder_id TEXT NOT NULL,
      uid INTEGER NOT NULL,
      message_id TEXT NOT NULL,
      subject TEXT,
      from_addresses TEXT NOT NULL,
      to_addresses TEXT NOT NULL,
      cc_addresses TEXT,
      bcc_addresses TEXT,
      reply_to_addresses TEXT,
      date INTEGER NOT NULL,
      body_encrypted TEXT NOT NULL,
      html_body_encrypted TEXT,
      text_body_encrypted TEXT,
      flags TEXT,
      is_read INTEGER DEFAULT 0,
      is_starred INTEGER DEFAULT 0,
      thread_id TEXT,
      in_reply_to TEXT,
      email_references TEXT,
      encrypted INTEGER DEFAULT 0,
      signed INTEGER DEFAULT 0,
      signature_verified INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
      UNIQUE(account_id, folder_id, uid)
    );

    CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(account_id);
    CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder_id);
    CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC);
    CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
    CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      content_id TEXT,
      data_encrypted BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_email ON attachments(email_id);

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      due_date INTEGER NOT NULL,
      message TEXT,
      completed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);
    CREATE INDEX IF NOT EXISTS idx_reminders_completed ON reminders(completed);

    CREATE TABLE IF NOT EXISTS signatures (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      html TEXT,
      text TEXT,
      is_default INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_signatures_account ON signatures(account_id);

    CREATE TABLE IF NOT EXISTS gpg_keys (
      id TEXT PRIMARY KEY,
      fingerprint TEXT NOT NULL UNIQUE,
      user_ids TEXT NOT NULL,
      key_data_encrypted TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      is_private INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_gpg_keys_fingerprint ON gpg_keys(fingerprint);

    CREATE TABLE IF NOT EXISTS recipients (
      email TEXT PRIMARY KEY,
      name TEXT,
      last_used INTEGER NOT NULL,
      use_count INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recipients_email ON recipients(email);
    CREATE INDEX IF NOT EXISTS idx_recipients_name ON recipients(name);
    CREATE INDEX IF NOT EXISTS idx_recipients_last_used ON recipients(last_used DESC);
  `)
  
  return db
}

export function getDatabase(): Database.Database {
  return createDatabase()
}

