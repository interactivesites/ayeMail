import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'

const getDbPath = () => {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'database')
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }
  return join(dbDir, 'ayemail.db')
}

export function createDatabase(): Database.Database {
  const dbPath = getDbPath()
  const db = new Database(dbPath)

  // Enable foreign keys
  db.pragma('foreign_keys = ON')
  const ensureColumn = (table: string, column: string, definition: string) => {
    const existingColumns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    if (!existingColumns.some(col => col.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    }
  }

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

    CREATE TABLE IF NOT EXISTS sender_folder_mappings (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      folder_id TEXT NOT NULL,
      move_count INTEGER DEFAULT 1,
      last_moved_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
      UNIQUE(account_id, sender_email, folder_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sender_folder_account ON sender_folder_mappings(account_id);
    CREATE INDEX IF NOT EXISTS idx_sender_folder_sender ON sender_folder_mappings(sender_email);
    CREATE INDEX IF NOT EXISTS idx_sender_folder_folder ON sender_folder_mappings(folder_id);
    CREATE INDEX IF NOT EXISTS idx_sender_folder_account_sender ON sender_folder_mappings(account_id, sender_email);

    CREATE TABLE IF NOT EXISTS account_from_addresses (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      is_default INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      UNIQUE(account_id, email)
    );

    CREATE INDEX IF NOT EXISTS idx_account_from_addresses_account ON account_from_addresses(account_id);
  `)
  
  // Migration: Add status column if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(emails)").all() as any[]
    const hasStatusColumn = tableInfo.some(col => col.name === 'status')
    
    if (!hasStatusColumn) {
      db.exec(`
        ALTER TABLE emails ADD COLUMN status TEXT CHECK(status IN ('now', 'later', 'reference', 'noise', 'archived', NULL));
        CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
      `)
    } else {
      // Ensure index exists even if column already exists
      db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status)`)
    }
  } catch (error) {
    console.error('Error migrating emails table for status column:', error)
  }
  
  // Migration: Add spam-related columns to emails table
  try {
    const tableInfo = db.prepare("PRAGMA table_info(emails)").all() as any[]
    const hasHeadersColumn = tableInfo.some(col => col.name === 'headers_encrypted')
    const hasSpamScoreColumn = tableInfo.some(col => col.name === 'spam_score')
    const hasSpamCheckedColumn = tableInfo.some(col => col.name === 'spam_checked_at')
    
    if (!hasHeadersColumn) {
      db.exec(`ALTER TABLE emails ADD COLUMN headers_encrypted TEXT`)
    }
    if (!hasSpamScoreColumn) {
      db.exec(`ALTER TABLE emails ADD COLUMN spam_score REAL`)
    }
    if (!hasSpamCheckedColumn) {
      db.exec(`ALTER TABLE emails ADD COLUMN spam_checked_at INTEGER`)
    }
    
    // Create index for spam_score for faster queries
    db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_spam_score ON emails(spam_score)`)
  } catch (error) {
    console.error('Error migrating emails table for spam columns:', error)
  }

  // Create spam_blacklist table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS spam_blacklist (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        email_address TEXT NOT NULL,
        domain TEXT,
        ip_address TEXT,
        reason TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_spam_blacklist_account ON spam_blacklist(account_id)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_spam_blacklist_email ON spam_blacklist(email_address)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_spam_blacklist_domain ON spam_blacklist(domain)`)
  } catch (error) {
    console.error('Error creating spam_blacklist table:', error)
  }

  // Create spam_greylist table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS spam_greylist (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        email_address TEXT NOT NULL,
        domain TEXT,
        ip_address TEXT,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        block_until INTEGER,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_spam_greylist_account ON spam_greylist(account_id)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_spam_greylist_email ON spam_greylist(email_address)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_spam_greylist_block_until ON spam_greylist(block_until)`)
  } catch (error) {
    console.error('Error creating spam_greylist table:', error)
  }

  // Migration: ensure folder sync metadata columns exist on upgraded installs
  try {
    ensureColumn('folders', 'uid_validity', 'INTEGER')
    ensureColumn('folders', 'highest_uid', 'INTEGER DEFAULT 0')
    ensureColumn('folders', 'last_sync_at', 'INTEGER')
  } catch (error) {
    console.error('Error ensuring folder sync metadata columns:', error)
  }

  // Migration: Ensure account_from_addresses table exists and migrate existing accounts
  try {
    const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='account_from_addresses'").get()
    if (!tableInfo) {
      // Table doesn't exist, create it (should already be created above, but ensure it exists)
      db.exec(`
        CREATE TABLE IF NOT EXISTS account_from_addresses (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          email TEXT NOT NULL,
          name TEXT,
          is_default INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
          UNIQUE(account_id, email)
        );
        CREATE INDEX IF NOT EXISTS idx_account_from_addresses_account ON account_from_addresses(account_id);
      `)
    }

    // Migrate existing accounts: add their email as the default from address
    const accounts = db.prepare('SELECT id, email, name FROM accounts').all() as any[]
    for (const account of accounts) {
      const existingFromAddress = db.prepare('SELECT id FROM account_from_addresses WHERE account_id = ? AND email = ?').get(account.id, account.email) as any
      if (!existingFromAddress) {
        const id = randomUUID()
        const now = Date.now()
        db.prepare(`
          INSERT INTO account_from_addresses (id, account_id, email, name, is_default, created_at)
          VALUES (?, ?, ?, ?, 1, ?)
        `).run(id, account.id, account.email, account.name || null, now)
      }
    }
  } catch (error) {
    console.error('Error migrating account_from_addresses table:', error)
  }

  // Migration: Add certificate validation columns to accounts table
  try {
    ensureColumn('accounts', 'imap_allow_invalid_certs', 'INTEGER DEFAULT 0')
    ensureColumn('accounts', 'imap_custom_ca', 'TEXT')
    ensureColumn('accounts', 'pop3_allow_invalid_certs', 'INTEGER DEFAULT 0')
    ensureColumn('accounts', 'pop3_custom_ca', 'TEXT')
    ensureColumn('accounts', 'smtp_allow_invalid_certs', 'INTEGER DEFAULT 0')
    ensureColumn('accounts', 'smtp_custom_ca', 'TEXT')
  } catch (error) {
    console.error('Error migrating accounts table for certificate validation columns:', error)
  }
  
  return db
}

let dbInstance: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = createDatabase()
  }
  return dbInstance
}
