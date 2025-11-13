import Imap from 'imap'
import { simpleParser } from 'mailparser'
import { accountManager } from './account-manager'
import type { Account } from '../shared/types'
import type { Email, EmailAddress, Attachment } from '../shared/types'

interface ConnectionPool {
  [accountId: string]: Imap | null
}

const connectionPool: ConnectionPool = {}

export class IMAPClient {
  private account: Account
  private connection: Imap | null = null

  constructor(account: Account) {
    this.account = account
  }

  async connect(): Promise<void> {
    if (this.connection && this.connection.state !== 'disconnected') {
      return
    }

    if (!this.account.imap) {
      throw new Error('IMAP configuration missing')
    }

    let password: string | null = null
    if (this.account.authType === 'password') {
      password = await accountManager.getPassword(this.account.id)
      if (!password) {
        throw new Error('Password not set for account')
      }
    }

    const oauth2Token = this.account.authType === 'oauth2'
      ? await accountManager.getOAuth2Token(this.account.id)
      : null

    return new Promise((resolve, reject) => {
      this.connection = new Imap({
        user: this.account.email,
        password: password || 'oauth2',
        host: this.account.imap.host,
        port: this.account.imap.port,
        tls: this.account.imap.secure,
        tlsOptions: { rejectUnauthorized: true },
        xoauth2: oauth2Token?.accessToken
      })

      this.connection.once('ready', () => {
        connectionPool[this.account.id] = this.connection
        // Ensure connection is fully ready before resolving
        if (this.connection && this.connection.state === 'authenticated') {
          resolve()
        } else {
          // Wait a bit for authentication to complete
          setTimeout(() => {
            if (this.connection && this.connection.state !== 'disconnected') {
              resolve()
            } else {
              reject(new Error('Connection failed to authenticate'))
            }
          }, 100)
        }
      })

      this.connection.once('error', (err: Error) => {
        reject(err)
      })

      this.connection.connect()
    })
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.end()
      this.connection = null
      delete connectionPool[this.account.id]
    }
  }

  async listFolders(): Promise<Array<{ name: string; path: string; attributes: string[]; delimiter: string }>> {
    await this.ensureConnected()

    if (!this.connection) {
      throw new Error('IMAP connection not established')
    }

    // Ensure connection is authenticated
    if (this.connection.state !== 'authenticated' && this.connection.state !== 'ready') {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('IMAP authentication timeout'))
        }, 10000)

        if (this.connection!.state === 'authenticated' || this.connection!.state === 'ready') {
          clearTimeout(timeout)
          resolve()
          return
        }

        this.connection!.once('ready', () => {
          clearTimeout(timeout)
          resolve()
        })

        this.connection!.once('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('IMAP list timeout'))
      }, 30000)

      this.connection!.once('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      try {
        const getBoxesMethod = (this.connection as any).getBoxes
        if (typeof getBoxesMethod !== 'function') {
          clearTimeout(timeout)
          reject(new Error(`IMAP connection does not have getBoxes method. Connection state: ${this.connection.state}`))
          return
        }

        getBoxesMethod.call(this.connection, (err: Error | null, boxes: any) => {
          clearTimeout(timeout)
          if (err) {
            reject(err)
            return
          }

          if (!boxes) {
            resolve([])
            return
          }

          const flattenBoxes = (namespace: any, prefix = ''): Array<{ name: string; path: string; attributes: string[]; delimiter: string }> => {
            const result: Array<{ name: string; path: string; attributes: string[]; delimiter: string }> = []

            for (const key of Object.keys(namespace)) {
              const box = namespace[key]
              const delimiter = box.delimiter || '/'
              const name = box.name || key
              const path = prefix ? `${prefix}${delimiter}${key}` : key

              result.push({
                name,
                path,
                attributes: box.attributes || box.attrib || [],
                delimiter
              })

              if (box.children) {
                result.push(...flattenBoxes(box.children, path))
              }
            }

            return result
          }

          resolve(flattenBoxes(boxes))
        })
      } catch (error: any) {
        clearTimeout(timeout)
        reject(new Error(`Failed to list folders: ${error.message}`))
      }
    })
  }

  async getFolderStatus(folderName: string): Promise<{ messages: number; unseen: number }> {
    await this.ensureConnected()

    return new Promise((resolve, reject) => {
      this.connection!.once('error', reject)
      this.connection!.status(folderName, (err, status) => {
        if (err) {
          reject(err)
          return
        }
        const statusObj = status as any
        resolve({
          messages: typeof statusObj.messages === 'object' ? (statusObj.messages?.total || 0) : (statusObj.messages || 0),
          unseen: statusObj.unseen || statusObj.messages?.unseen || 0
        })
      })
    })
  }

  async fetchEmails(
    folderName: string,
    start: number = 1,
    end: number = 50
  ): Promise<Email[]> {
    await this.ensureConnected()

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('IMAP fetch timeout'))
      }, 60000) // 60 second timeout

      this.connection!.once('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      this.connection!.openBox(folderName, true, (err, box) => {
        if (err) {
          clearTimeout(timeout)
          reject(err)
          return
        }

        if (!box || box.messages.total === 0) {
          clearTimeout(timeout)
          resolve([])
          return
        }

        // Use proper IMAP sequence numbers (1-based)
        const seqStart = Math.max(1, start)
        const seqEnd = Math.min(box.messages.total, end)
        
        if (seqStart > seqEnd) {
          clearTimeout(timeout)
          resolve([])
          return
        }

        const fetch = this.connection!.fetch(`${seqStart}:${seqEnd}`, {
          bodies: '',
          struct: true
        })

        const emails: Email[] = []
        let emailCount = 0
        const totalToFetch = seqEnd - seqStart + 1

        fetch.on('message', (msg, seqno) => {
          let uid: number | null = null
          let flags: string[] = []
          let body = ''
          let headers: any = {}

          msg.on('body', (stream, info) => {
            let buffer = Buffer.alloc(0)
            stream.on('data', (chunk: Buffer) => {
              buffer = Buffer.concat([buffer, chunk])
            })
            stream.on('end', () => {
              // Convert buffer to string, handling encoding properly
              body = buffer.toString('utf8')
            })
          })

          msg.on('attributes', (attrs) => {
            uid = attrs.uid
            flags = attrs.flags || []
          })

          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(body)
              
              const email: Email = {
                id: `${this.account.id}-${folderName}-${uid}`,
                accountId: this.account.id,
                folderId: folderName, // Will be mapped to folder ID later
                uid: uid!,
                messageId: parsed.messageId || '',
                subject: parsed.subject || '',
                from: this.parseAddresses(parsed.from),
                to: this.parseAddresses(parsed.to || []),
                cc: parsed.cc ? this.parseAddresses(parsed.cc) : undefined,
                bcc: parsed.bcc ? this.parseAddresses(parsed.bcc) : undefined,
                replyTo: parsed.replyTo ? this.parseAddresses(parsed.replyTo) : undefined,
                date: parsed.date ? parsed.date.getTime() : Date.now(),
                body: parsed.html || parsed.text || '',
                htmlBody: parsed.html || undefined,
                textBody: parsed.text,
                attachments: parsed.attachments?.map(att => ({
                  id: `${this.account.id}-${uid}-${att.filename}`,
                  emailId: `${this.account.id}-${uid}`,
                  filename: att.filename || 'attachment',
                  contentType: att.contentType || 'application/octet-stream',
                  size: att.size || 0,
                  contentId: att.contentId,
                  data: att.content as Buffer
                })) || [],
                flags: flags,
                isRead: flags.includes('\\Seen'),
                isStarred: flags.includes('\\Flagged'),
                threadId: parsed.inReplyTo || undefined,
                inReplyTo: parsed.inReplyTo || undefined,
                references: parsed.references ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references]) : undefined,
                encrypted: false, // Will be determined by GPG parsing
                signed: false,
                signatureVerified: undefined,
                createdAt: Date.now(),
                updatedAt: Date.now()
              }

              emails.push(email)
              emailCount++

              if (emailCount === totalToFetch) {
                clearTimeout(timeout)
                resolve(emails)
              }
            } catch (parseErr) {
              console.error('Error parsing email:', parseErr)
              emailCount++
              if (emailCount === totalToFetch) {
                clearTimeout(timeout)
                resolve(emails)
              }
            }
          })
        })

        fetch.once('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })

        fetch.once('end', () => {
          // In case we didn't get all messages, resolve with what we have
          if (emailCount < totalToFetch && emails.length > 0) {
            clearTimeout(timeout)
            resolve(emails)
          }
        })
      })
    })
  }

  async createFolder(folderName: string): Promise<void> {
    await this.ensureConnected()

    return new Promise((resolve, reject) => {
      this.connection!.addBox(folderName, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async deleteFolder(folderName: string): Promise<void> {
    await this.ensureConnected()

    return new Promise((resolve, reject) => {
      this.connection!.delBox(folderName, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async renameFolder(oldName: string, newName: string): Promise<void> {
    await this.ensureConnected()

    return new Promise((resolve, reject) => {
      this.connection!.renameBox(oldName, newName, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async subscribeFolder(folderName: string, subscribed: boolean): Promise<void> {
    await this.ensureConnected()

    return new Promise((resolve, reject) => {
      if (subscribed) {
        this.connection!.subscribeBox(folderName, (err) => {
          if (err) reject(err)
          else resolve()
        })
      } else {
        this.connection!.unsubscribeBox(folderName, (err) => {
          if (err) reject(err)
          else resolve()
        })
      }
    })
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connection || this.connection.state === 'disconnected') {
      await this.connect()
    }
  }

  private parseAddresses(addresses: any): EmailAddress[] {
    if (!addresses) return []
    if (Array.isArray(addresses)) {
      return addresses.map(addr => ({
        name: addr.name,
        address: addr.address
      }))
    }
    return [{
      name: addresses.name,
      address: addresses.address
    }]
  }
}

export function getIMAPClient(account: Account): IMAPClient {
  return new IMAPClient(account)
}

