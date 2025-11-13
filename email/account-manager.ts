import { getDatabase, encryption } from '../database'
import type { Account } from '../shared/types'

export class AccountManager {
  private db = getDatabase()

  async getAccount(id: string): Promise<Account | null> {
    const account = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any
    if (!account) return null

    return this.mapDbAccountToAccount(account)
  }

  async getAllAccounts(): Promise<Account[]> {
    const accounts = this.db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all() as any[]
    return accounts.map(acc => this.mapDbAccountToAccount(acc))
  }

  async createAccount(account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<Account> {
    const id = crypto.randomUUID()
    const now = Date.now()

    const stmt = this.db.prepare(`
      INSERT INTO accounts (
        id, name, email, type, imap_host, imap_port, imap_secure,
        pop3_host, pop3_port, pop3_secure, smtp_host, smtp_port, smtp_secure,
        auth_type, oauth2_provider, oauth2_access_token_encrypted,
        oauth2_refresh_token_encrypted, oauth2_expires_at, password_encrypted,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

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
      null, // Password handled separately
      now,
      now
    )

    return { id, ...account, createdAt: now, updatedAt: now }
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<void> {
    const now = Date.now()
    const dbUpdates: string[] = []
    const values: any[] = []

    if (updates.name) {
      dbUpdates.push('name = ?')
      values.push(updates.name)
    }
    if (updates.email) {
      dbUpdates.push('email = ?')
      values.push(updates.email)
    }
    if (updates.oauth2?.accessToken) {
      dbUpdates.push('oauth2_access_token_encrypted = ?')
      values.push(encryption.encryptCredential(updates.oauth2.accessToken))
    }
    if (updates.oauth2?.refreshToken) {
      dbUpdates.push('oauth2_refresh_token_encrypted = ?')
      values.push(encryption.encryptCredential(updates.oauth2.refreshToken))
    }
    if (updates.oauth2?.expiresAt !== undefined) {
      dbUpdates.push('oauth2_expires_at = ?')
      values.push(updates.oauth2.expiresAt)
    }

    dbUpdates.push('updated_at = ?')
    values.push(now)
    values.push(id)

    this.db.prepare(`UPDATE accounts SET ${dbUpdates.join(', ')} WHERE id = ?`).run(...values)
  }

  async deleteAccount(id: string): Promise<void> {
    this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
  }

  async setPassword(id: string, password: string): Promise<void> {
    const encrypted = encryption.encryptCredential(password)
    this.db.prepare('UPDATE accounts SET password_encrypted = ?, updated_at = ? WHERE id = ?')
      .run(encrypted, Date.now(), id)
  }

  async getPassword(id: string): Promise<string | null> {
    const account = this.db.prepare('SELECT password_encrypted FROM accounts WHERE id = ?').get(id) as any
    if (!account || !account.password_encrypted) return null
    return encryption.decryptCredential(account.password_encrypted)
  }

  async getOAuth2Token(id: string): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: number } | null> {
    const account = this.db.prepare(`
      SELECT oauth2_access_token_encrypted, oauth2_refresh_token_encrypted, oauth2_expires_at
      FROM accounts WHERE id = ?
    `).get(id) as any

    if (!account || !account.oauth2_access_token_encrypted) return null

    return {
      accessToken: encryption.decryptCredential(account.oauth2_access_token_encrypted),
      refreshToken: account.oauth2_refresh_token_encrypted
        ? encryption.decryptCredential(account.oauth2_refresh_token_encrypted)
        : undefined,
      expiresAt: account.oauth2_expires_at || undefined
    }
  }

  private mapDbAccountToAccount(dbAccount: any): Account {
    return {
      id: dbAccount.id,
      name: dbAccount.name,
      email: dbAccount.email,
      type: dbAccount.type,
      imap: dbAccount.imap_host ? {
        host: dbAccount.imap_host,
        port: dbAccount.imap_port,
        secure: dbAccount.imap_secure === 1
      } : undefined,
      pop3: dbAccount.pop3_host ? {
        host: dbAccount.pop3_host,
        port: dbAccount.pop3_port,
        secure: dbAccount.pop3_secure === 1
      } : undefined,
      smtp: {
        host: dbAccount.smtp_host,
        port: dbAccount.smtp_port,
        secure: dbAccount.smtp_secure === 1
      },
      authType: dbAccount.auth_type,
      oauth2: dbAccount.oauth2_provider ? {
        provider: dbAccount.oauth2_provider,
        accessToken: dbAccount.oauth2_access_token_encrypted
          ? encryption.decryptCredential(dbAccount.oauth2_access_token_encrypted)
          : undefined,
        refreshToken: dbAccount.oauth2_refresh_token_encrypted
          ? encryption.decryptCredential(dbAccount.oauth2_refresh_token_encrypted)
          : undefined,
        expiresAt: dbAccount.oauth2_expires_at || undefined
      } : undefined,
      createdAt: dbAccount.created_at,
      updatedAt: dbAccount.updated_at
    }
  }
}

export const accountManager = new AccountManager()

