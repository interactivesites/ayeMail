import { accountManager } from './account-manager'
import type { Account } from '../shared/types'
import type { Email } from '../shared/types'

// Note: The 'poplib' package has limited TypeScript support
// This is a basic implementation - POP3 support is more limited than IMAP
const Poplib = require('poplib')

export class POP3Client {
  private account: Account
  private connection: any = null

  constructor(account: Account) {
    this.account = account
  }

  async connect(): Promise<void> {
    if (!this.account.pop3) {
      throw new Error('POP3 configuration missing')
    }

    const password = await accountManager.getPassword(this.account.id)
    if (!password) {
      throw new Error('Password not set for account')
    }

    return new Promise((resolve, reject) => {
      this.connection = new Poplib({
        user: this.account.email,
        password: password,
        host: this.account.pop3.host,
        port: this.account.pop3.port,
        tls: this.account.pop3.secure
      })

      this.connection.on('connect', () => {
        resolve()
      })

      this.connection.on('error', (err: Error) => {
        reject(err)
      })

      this.connection.connect()
    })
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.quit()
      this.connection = null
    }
  }

  async getMessageCount(): Promise<number> {
    await this.ensureConnected()

    return new Promise((resolve, reject) => {
      this.connection.stat((err: Error | null, count: number) => {
        if (err) reject(err)
        else resolve(count)
      })
    })
  }

  async fetchEmails(start: number = 1, end: number = 50): Promise<Email[]> {
    await this.ensureConnected()

    return new Promise((resolve, reject) => {
      this.connection.list((err: Error | null, list: Array<{ number: number; size: number }>) => {
        if (err) {
          reject(err)
          return
        }

        const emails: Email[] = []
        const toFetch = list.slice(start - 1, end)
        let fetched = 0

        if (toFetch.length === 0) {
          resolve(emails)
          return
        }

        toFetch.forEach((item) => {
          this.connection.retr(item.number, (retrErr: Error | null, message: string) => {
            if (retrErr) {
              fetched++
              if (fetched === toFetch.length) {
                resolve(emails)
              }
              return
            }

            // Parse message (simplified - would use mailparser in production)
            // For now, return basic structure
            const email: Email = {
              id: `${this.account.id}-${item.number}`,
              accountId: this.account.id,
              folderId: 'INBOX',
              uid: item.number,
              messageId: '',
              subject: '',
              from: [],
              to: [],
              date: Date.now(),
              body: message,
              attachments: [],
              flags: [],
              isRead: false,
              isStarred: false,
              createdAt: Date.now(),
              updatedAt: Date.now()
            }

            emails.push(email)
            fetched++

            if (fetched === toFetch.length) {
              resolve(emails)
            }
          })
        })
      })
    })
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connection) {
      await this.connect()
    }
  }
}

export function getPOP3Client(account: Account): POP3Client {
  return new POP3Client(account)
}

