import Imap from 'imap'
import { simpleParser } from 'mailparser'
import { accountManager } from './account-manager'
import type { Account } from '../shared/types'
import type { Email, EmailAddress, Attachment } from '../shared/types'

interface ConnectionPool {
  [accountId: string]: Imap | null
}

const connectionPool: ConnectionPool = {}
const METADATA_HEADER_FIELDS =
  'HEADER.FIELDS (DATE SUBJECT FROM TO CC BCC REPLY-TO MESSAGE-ID REFERENCES IN-REPLY-TO LIST-ID X-PRIORITY X-MAILER)'

export class IMAPClient {
  private account: Account
  private connection: Imap | null = null
  private inboxPath: string | null = null // Cache for discovered inbox path

  constructor(account: Account) {
    this.account = account
  }

  private async getInboxPath(): Promise<string> {
    if (this.inboxPath) return this.inboxPath

    const folders = await this.listFolders()

    // 1) Try special-use flag \Inbox
    const inboxByAttr = folders.find(f =>
      f.attributes?.some(a => a.toUpperCase() === '\\INBOX' || a.toUpperCase() === 'INBOX')
    )
    if (inboxByAttr) {
      this.inboxPath = inboxByAttr.path
      console.log(`Discovered inbox by \\Inbox attribute:`, this.inboxPath)
      return this.inboxPath
    }

    // 2) Fallback: name/path "INBOX" (case insensitive)
    const inboxByName =
      folders.find(f => f.path.toUpperCase() === 'INBOX') ||
      folders.find(f => f.name.toUpperCase() === 'INBOX')
    if (inboxByName) {
      this.inboxPath = inboxByName.path
      console.log(`Discovered inbox by name:`, this.inboxPath)
      return this.inboxPath
    }

    // 3) Ultimate fallback: plain "INBOX"
    this.inboxPath = 'INBOX'
    console.warn(`Could not detect inbox from LIST, falling back to "${this.inboxPath}"`)
    return this.inboxPath
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

  async fetchEmailMetadata(
    folderName: string,
    start: number = 1,
    end: number = 50
  ): Promise<Email[]> {
    await this.ensureConnected()

    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('IMAP fetch timeout'))
      }, 120000) // 120 second timeout for large folders

      try {
        const errorHandler = (err: Error) => {
          clearTimeout(timeout)
          this.connection!.removeListener('error', errorHandler)
          reject(err)
        }
        this.connection!.once('error', errorHandler)

        let targetFolder = folderName
        if (folderName.toUpperCase() === 'INBOX') {
          targetFolder = await this.getInboxPath()
        }

        console.log(`Opening box for metadata: logical="${folderName}", actual path="${targetFolder}"`)

        if (!this.connection || this.connection.state === 'disconnected') {
          clearTimeout(timeout)
          reject(new Error('IMAP connection not available'))
          return
        }

        this.connection.openBox(targetFolder, true, (err, box) => {
          if (err) {
            clearTimeout(timeout)
            if (this.connection) {
              this.connection.removeListener('error', errorHandler)
            }
            reject(err)
            return
          }

          if (!this.connection || this.connection.state === 'disconnected') {
            clearTimeout(timeout)
            if (this.connection) {
              this.connection.removeListener('error', errorHandler)
            }
            reject(new Error('IMAP connection lost while opening box'))
            return
          }

          console.log(`Opened box ${box.name} (path=${targetFolder}): total=${box.messages.total}, unseen=${box.messages.unseen}`)

          if (!box || box.messages.total === 0) {
            clearTimeout(timeout)
            if (this.connection) {
              this.connection.removeListener('error', errorHandler)
            }
            resolve([])
            return
          }

          const totalMessages = box.messages.total || 0
          if (totalMessages === 0) {
            clearTimeout(timeout)
            if (this.connection) {
              this.connection.removeListener('error', errorHandler)
            }
            resolve([])
            return
          }

          const fetchAll = end >= 10000 || end === 999999
          const sequenceRange = fetchAll
            ? '1:*'
            : this.calculateSequenceRange(totalMessages, start, end)

          if (!sequenceRange) {
            clearTimeout(timeout)
            if (this.connection) {
              this.connection.removeListener('error', errorHandler)
            }
            resolve([])
            return
          }

          console.log(`Fetching metadata from ${targetFolder} using sequence range ${sequenceRange}`)

          const emails: Email[] = []

          const fetch = this.connection!.seq.fetch(sequenceRange, {
            bodies: METADATA_HEADER_FIELDS,
            struct: true,
            envelope: true
          })

          fetch.on('message', (msg, seqno) => {
            let uid: number | null = null
            let flags: string[] = []
            let envelope: any = null
            let headers = ''

            msg.on('body', (stream) => {
              const chunks: Buffer[] = []
              stream.on('data', (chunk: Buffer) => chunks.push(chunk))
              stream.once('end', () => {
                headers = Buffer.concat(chunks).toString('utf8')
              })
            })

            msg.on('attributes', (attrs) => {
              uid = attrs.uid
              flags = attrs.flags || []
              envelope = (attrs as any).envelope
            })

            msg.once('end', () => {
              try {
                const email: Email = {
                  id: `${this.account.id}-${folderName}-${uid || seqno}`,
                  accountId: this.account.id,
                  folderId: folderName,
                  uid: uid || seqno,
                  messageId: envelope?.messageId || `msg-${seqno}`,
                  subject: envelope?.subject || `Message ${seqno}`,
                  from: envelope?.from ? this.parseAddresses(envelope.from) : [{ address: 'unknown@example.com' }],
                  to: envelope?.to ? this.parseAddresses(envelope.to) : [],
                  cc: envelope?.cc ? this.parseAddresses(envelope.cc) : undefined,
                  bcc: envelope?.bcc ? this.parseAddresses(envelope.bcc) : undefined,
                  replyTo: envelope?.replyTo ? this.parseAddresses(envelope.replyTo) : undefined,
                  date: envelope?.date ? new Date(envelope.date).getTime() : Date.now(),
                  body: '',
                  htmlBody: undefined,
                  textBody: undefined,
                  attachments: [],
                  flags: flags,
                  isRead: flags.includes('\\Seen'),
                  isStarred: flags.includes('\\Flagged'),
                  threadId: envelope?.inReplyTo || undefined,
                  inReplyTo: envelope?.inReplyTo || undefined,
                  references: envelope?.references
                    ? (Array.isArray(envelope.references) ? envelope.references : [envelope.references])
                    : undefined,
                  encrypted: false,
                  signed: false,
                  signatureVerified: undefined,
                  headers: headers ? this.parseHeaders(headers) : undefined,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                }

                emails.push(email)
              } catch (messageErr) {
                console.error(`Error processing metadata for seq ${seqno}:`, messageErr)
              }
            })
          })

          fetch.once('error', (err) => {
            clearTimeout(timeout)
            if (this.connection) {
              this.connection.removeListener('error', errorHandler)
            }
            reject(err)
          })

          fetch.once('end', () => {
            clearTimeout(timeout)
            if (this.connection) {
              this.connection.removeListener('error', errorHandler)
            }
            // Maintain newest-first ordering for downstream consumers
            const sorted = emails.sort((a, b) => b.uid - a.uid)
            console.log(`Fetched ${sorted.length} metadata entries from ${targetFolder}`)
            resolve(sorted)
          })
        })
      } catch (e) {
        clearTimeout(timeout)
        reject(e)
      }
    })
  }

  private parseHeaders(headersString: string): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {}
    const lines = headersString.split('\r\n')
    let currentKey = ''
    let currentValue = ''

    for (const line of lines) {
      if (line.match(/^[A-Za-z0-9-]+:/)) {
        // New header
        if (currentKey) {
          headers[currentKey.toLowerCase()] = currentValue.trim()
        }
        const colonIndex = line.indexOf(':')
        currentKey = line.substring(0, colonIndex)
        currentValue = line.substring(colonIndex + 1).trim()
      } else if (line.startsWith(' ') || line.startsWith('\t')) {
        // Continuation of previous header
        currentValue += ' ' + line.trim()
      }
    }

    if (currentKey) {
      headers[currentKey.toLowerCase()] = currentValue.trim()
    }

    return headers
  }

  private calculateSequenceRange(totalMessages: number, start: number, end: number): string | null {
    if (totalMessages <= 0) {
      return null
    }

    const normalizedStart = Math.max(1, start)
    const normalizedEnd = Math.max(normalizedStart, end)

    if (normalizedStart > totalMessages) {
      return null
    }

    const clampedStart = Math.min(normalizedStart, totalMessages)
    const clampedEnd = Math.min(normalizedEnd, totalMessages)

    const seqHigh = totalMessages - clampedStart + 1
    const seqLow = Math.max(1, totalMessages - clampedEnd + 1)

    if (seqHigh < seqLow) {
      return null
    }

    return `${seqLow}:${seqHigh}`
  }

  async fetchEmails(
    folderName: string,
    start: number = 1,
    end: number = 50
  ): Promise<Email[]> {
    await this.ensureConnected()

    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('IMAP fetch timeout'))
      }, 120000) // 120 second timeout for large folders

      try {
        // Use a local error handler that won't interfere with other operations
        const errorHandler = (err: Error) => {
          clearTimeout(timeout)
          this.connection!.removeListener('error', errorHandler)
          reject(err)
        }
        this.connection!.once('error', errorHandler)

        // Decide which folder path to use
        let targetFolder = folderName
        // Treat "Inbox" / "Posteingang" / whatever your UI uses as "Inbox" specially
        if (folderName.toUpperCase() === 'INBOX') {
          targetFolder = await this.getInboxPath()
        }

        console.log(`Opening box: logical="${folderName}", actual path="${targetFolder}"`)

        // Check connection before opening box
        if (!this.connection || this.connection.state === 'disconnected') {
          clearTimeout(timeout)
          reject(new Error('IMAP connection not available'))
          return
        }

        this.connection.openBox(targetFolder, true, (err, box) => {
          if (err) {
            clearTimeout(timeout)
            if (this.connection) {
              this.connection.removeListener('error', errorHandler)
            }
            console.error(`Error opening box ${targetFolder} (from ${folderName}):`, err)
            console.error(`Connection state: ${this.connection?.state || 'null'}`)
            // Provide more context for folders starting with '@'
            if (targetFolder.startsWith('@')) {
              console.warn(`Note: Folder "${targetFolder}" starts with '@' - this may be a namespace folder that requires special handling`)
            }
            reject(err)
            return
          }

          // Check connection is still valid before proceeding
          if (!this.connection || this.connection.state === 'disconnected') {
            clearTimeout(timeout)
            if (this.connection) {
              this.connection.removeListener('error', errorHandler)
            }
            reject(new Error('IMAP connection lost while opening box'))
            return
          }

          console.log(`Opened box ${box.name} (path=${targetFolder}): total=${box.messages.total}, unseen=${box.messages.unseen}`)

          if (!box || box.messages.total === 0) {
            clearTimeout(timeout)
            if (this.connection) {
              this.connection.removeListener('error', errorHandler)
            }
            resolve([])
            return
          }

          // Fetch all messages by sequence number to get all UIDs
          // This is more reliable than search which may have limitations
          // Use sequence range 1:* to get all messages
          const seqRange = '1:*'
          console.log(`Fetching UIDs for all ${box.messages.total} messages using sequence range ${seqRange}`)

          const allUids: number[] = []

          // Check connection again before fetch
          if (!this.connection || this.connection.state === 'disconnected') {
            clearTimeout(timeout)
            if (this.connection) {
              this.connection.removeListener('error', errorHandler)
            }
            reject(new Error('IMAP connection lost before fetch'))
            return
          }

          // First, fetch UIDs by fetching sequence numbers and extracting UIDs
          const uidFetch = this.connection.fetch(seqRange, {
            bodies: '',
            struct: false
          })

          uidFetch.on('message', (msg) => {
            msg.on('attributes', (attrs) => {
              if (attrs.uid) {
                allUids.push(attrs.uid)
              }
            })
          })

          uidFetch.once('error', (fetchErr) => {
            clearTimeout(timeout)
            if (this.connection) {
              this.connection.removeListener('error', errorHandler)
            }
            console.error(`Error fetching UIDs:`, fetchErr)
            reject(fetchErr)
          })

          uidFetch.once('end', () => {
            console.log(`Collected ${allUids.length} UIDs from ${box.messages.total} messages`)

            if (allUids.length === 0) {
              clearTimeout(timeout)
              if (this.connection) {
                this.connection.removeListener('error', errorHandler)
              }
              console.warn(`No UIDs found in ${targetFolder} despite ${box.messages.total} messages`)
              resolve([])
              return
            }

            // Check connection again before second fetch
            if (!this.connection || this.connection.state === 'disconnected') {
              clearTimeout(timeout)
              if (this.connection) {
                this.connection.removeListener('error', errorHandler)
              }
              reject(new Error('IMAP connection lost before fetching emails'))
              return
            }

            // Sort UIDs descending (most recent first)
            const sortedUids = allUids.sort((a, b) => b - a)
            
            // Apply pagination: start and end parameters
            // If end >= 10000, fetch all emails, otherwise apply pagination
            let uidsToFetch: number[]
            if (end >= 10000) {
              // Fetch all emails
              uidsToFetch = sortedUids
            } else {
              // Apply pagination: slice from (start-1) to end (0-indexed)
              const startIdx = Math.max(0, start - 1)
              const endIdx = Math.min(sortedUids.length, end)
              uidsToFetch = sortedUids.slice(startIdx, endIdx)
            }
            
            console.log(`Fetching ${uidsToFetch.length} emails (range ${start}-${end}) from ${sortedUids.length} total UIDs in ${targetFolder}`)

          const emails: Email[] = []
          let emailCount = 0
          const totalToFetch = uidsToFetch.length
          const messagePromises: Promise<void>[] = []
          let fetchEnded = false

          const fetch = this.connection.fetch(uidsToFetch, {
            bodies: '',
            struct: true,
            envelope: true
          })

            const checkComplete = () => {
              if (emailCount === totalToFetch && fetchEnded) {
                clearTimeout(timeout)
                if (this.connection) {
                  this.connection.removeListener('error', errorHandler)
                }
                console.log(`Finished fetching emails from ${targetFolder}: got ${emails.length} emails out of ${totalToFetch} requested`)
                resolve(emails)
              }
            }

          fetch.on('message', (msg, seqno) => {
            let uid: number | null = null
            let flags: string[] = []
            let envelope: any = null
            let body = ''
            let bodyPromise: Promise<void> | null = null

            msg.on('body', (stream, info) => {
              let buffer = Buffer.alloc(0)
              bodyPromise = new Promise<void>((resolve) => {
                stream.on('data', (chunk: Buffer) => {
                  buffer = Buffer.concat([buffer, chunk])
                })
                stream.once('end', () => {
                  body = buffer.toString('utf8')
                  resolve()
                })
              })
            })

            msg.on('attributes', (attrs) => {
              uid = attrs.uid
              flags = attrs.flags || []
              envelope = (attrs as any).envelope
            })

            const messagePromise = new Promise<void>(async (resolveMsg) => {
              msg.once('end', async () => {
                try {
                  // Wait for body stream to complete if it exists
                  if (bodyPromise) {
                    await bodyPromise
                  }

                  try {
                    // Parse the email body
                    let parsed: any = null
                    if (body && body.length > 0) {
                      parsed = await simpleParser(body)
                    }

                    // Extract headers from parsed email
                    let headers: Record<string, string | string[]> | undefined = undefined
                    if (parsed?.headers) {
                      // Convert mailparser headers format to simple object
                      headers = {}
                      for (const [key, value] of Object.entries(parsed.headers)) {
                        // mailparser headers can be arrays or single values
                        headers[key.toLowerCase()] = Array.isArray(value) ? value : [value]
                      }
                    }

                    // Create email with parsed content
                    // Use original folderName (not normalized) for folderId since that's what the database expects
                    const email: Email = {
                      id: `${this.account.id}-${folderName}-${uid || seqno}`,
                      accountId: this.account.id,
                      folderId: folderName, // Keep original folderName for database storage
                      uid: uid || seqno,
                      messageId: parsed?.messageId || envelope?.messageId || `msg-${seqno}`,
                      subject: parsed?.subject || envelope?.subject || `Message ${seqno}`,
                      from: parsed?.from ? this.parseAddresses(parsed.from) : (envelope?.from ? this.parseAddresses(envelope.from) : [{ address: 'unknown@example.com' }]),
                      to: parsed?.to ? this.parseAddresses(parsed.to) : (envelope?.to ? this.parseAddresses(envelope.to) : []),
                      cc: parsed?.cc ? this.parseAddresses(parsed.cc) : (envelope?.cc ? this.parseAddresses(envelope.cc) : undefined),
                      bcc: parsed?.bcc ? this.parseAddresses(parsed.bcc) : (envelope?.bcc ? this.parseAddresses(envelope.bcc) : undefined),
                      replyTo: parsed?.replyTo ? this.parseAddresses(parsed.replyTo) : (envelope?.replyTo ? this.parseAddresses(envelope.replyTo) : undefined),
                      date: parsed?.date ? parsed.date.getTime() : (envelope?.date ? new Date(envelope.date).getTime() : Date.now()),
                      body: parsed?.html || parsed?.text || '',
                      htmlBody: parsed?.html || undefined,
                      textBody: parsed?.text,
                      attachments: parsed?.attachments?.map((att: any) => ({
                        id: `${this.account.id}-${uid || seqno}-${att.filename}`,
                        emailId: `${this.account.id}-${uid || seqno}`,
                        filename: att.filename || 'attachment',
                        contentType: att.contentType || 'application/octet-stream',
                        size: att.size || 0,
                        contentId: att.contentId,
                        data: att.content as Buffer
                      })) || [],
                      flags: flags,
                      isRead: flags.includes('\\Seen'),
                      isStarred: flags.includes('\\Flagged'),
                      threadId: parsed?.inReplyTo || envelope?.inReplyTo || undefined,
                      inReplyTo: parsed?.inReplyTo || envelope?.inReplyTo || undefined,
                      references: parsed?.references ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references]) : (envelope?.references ? (Array.isArray(envelope.references) ? envelope.references : [envelope.references]) : undefined),
                      encrypted: false,
                      signed: false,
                      signatureVerified: undefined,
                      headers: headers,
                      createdAt: Date.now(),
                      updatedAt: Date.now()
                    }

                    emails.push(email)
                    emailCount++
                    console.log(`Processed email ${emailCount}/${totalToFetch} (UID: ${uid || seqno}) in ${folderName}`)
                    checkComplete()
                  } catch (parseErr) {
                    console.error(`Error parsing message ${seqno} (UID: ${uid || seqno}):`, parseErr)
                    // Still create email with envelope data if parsing fails
                    // Use original folderName (not normalized) for folderId since that's what the database expects
                    const email: Email = {
                      id: `${this.account.id}-${folderName}-${uid || seqno}`,
                      accountId: this.account.id,
                      folderId: folderName, // Keep original folderName for database storage
                      uid: uid || seqno,
                      messageId: envelope?.messageId || `msg-${seqno}`,
                      subject: envelope?.subject || `Message ${seqno}`,
                      from: envelope?.from ? this.parseAddresses(envelope.from) : [{ address: 'unknown@example.com' }],
                      to: envelope?.to ? this.parseAddresses(envelope.to) : [],
                      cc: envelope?.cc ? this.parseAddresses(envelope.cc) : undefined,
                      bcc: envelope?.bcc ? this.parseAddresses(envelope.bcc) : undefined,
                      replyTo: envelope?.replyTo ? this.parseAddresses(envelope.replyTo) : undefined,
                      date: envelope?.date ? new Date(envelope.date).getTime() : Date.now(),
                      body: '',
                      htmlBody: undefined,
                      textBody: undefined,
                      attachments: [],
                      flags: flags,
                      isRead: flags.includes('\\Seen'),
                      isStarred: flags.includes('\\Flagged'),
                      threadId: envelope?.inReplyTo || undefined,
                      inReplyTo: envelope?.inReplyTo || undefined,
                      references: envelope?.references ? (Array.isArray(envelope.references) ? envelope.references : [envelope.references]) : undefined,
                      encrypted: false,
                      signed: false,
                      signatureVerified: undefined,
                      createdAt: Date.now(),
                      updatedAt: Date.now()
                    }
                    emails.push(email)
                    emailCount++
                    console.log(`Processed email ${emailCount}/${totalToFetch} (UID: ${uid || seqno}, envelope only) in ${folderName}`)
                    checkComplete()
                  }
                } catch (err) {
                  console.error(`Error processing message ${seqno} (UID: ${uid || seqno}):`, err)
                  emailCount++
                  checkComplete()
                } finally {
                  resolveMsg()
                }
              })
            })

            messagePromises.push(messagePromise)
          })

          fetch.once('error', (err) => {
            clearTimeout(timeout)
            if (this.connection) {
              this.connection.removeListener('error', errorHandler)
            }
            console.error('IMAP fetch error:', err)
            reject(err)
          })

            fetch.once('end', async () => {
              fetchEnded = true
              console.log(`Fetch stream ended for ${targetFolder}, waiting for ${messagePromises.length} messages to process...`)
              // Wait for all message handlers to complete
              await Promise.all(messagePromises)
              console.log(`All messages processed for ${targetFolder}: got ${emails.length} emails out of ${totalToFetch} requested`)
              clearTimeout(timeout)
              if (this.connection) {
                this.connection.removeListener('error', errorHandler)
              }
              // Resolve with whatever we got
              resolve(emails)
            })
          })
        })
      } catch (e) {
        clearTimeout(timeout)
        reject(e)
      }
    })
  }

  async fetchEmailByUid(folderName: string, uid: number): Promise<Email | null> {
    await this.ensureConnected()

    console.log(`[IMAPClient.fetchEmailByUid] Starting fetch for UID ${uid} in folder ${folderName}`)

    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(`[IMAPClient.fetchEmailByUid] Timeout after 30s for UID ${uid} in folder ${folderName}`)
        reject(new Error('IMAP fetch timeout'))
      }, 30000) // 30 second timeout

      try {
        const errorHandler = (err: Error) => {
          console.error(`[IMAPClient.fetchEmailByUid] Connection error for UID ${uid}:`, err)
          clearTimeout(timeout)
          this.connection!.removeListener('error', errorHandler)
          reject(err)
        }
        this.connection!.once('error', errorHandler)

        // Decide which folder path to use
        let targetFolder = folderName
        if (folderName.toUpperCase() === 'INBOX') {
          targetFolder = await this.getInboxPath()
        }

        console.log(`[IMAPClient.fetchEmailByUid] Opening folder: ${targetFolder} (original: ${folderName})`)

        this.connection!.openBox(targetFolder, true, (err, box) => {
          if (err) {
            console.error(`[IMAPClient.fetchEmailByUid] Error opening folder ${targetFolder}:`, err)
            clearTimeout(timeout)
            this.connection!.removeListener('error', errorHandler)
            reject(err)
            return
          }

          console.log(`[IMAPClient.fetchEmailByUid] Folder opened: ${box.name}, total messages: ${box.messages.total}`)

          // Directly fetch by UID - skip verification as it's too slow for large folders
          console.log(`[IMAPClient.fetchEmailByUid] Fetching UID ${uid} from ${targetFolder}`)
          
          const fetch = this.connection!.fetch([uid], {
            bodies: '',
            struct: true,
            envelope: true
          })

          console.log(`[IMAPClient.fetchEmailByUid] Fetch started for UID ${uid}`)

          let email: Email | null = null
          let flags: string[] = []
          let envelope: any = null
          let body = ''
          let messageProcessingPromise: Promise<void> | null = null

          fetch.on('message', (msg, seqno) => {
            console.log(`[IMAPClient.fetchEmailByUid] Message event received for UID ${uid}, seqno ${seqno}`)
            
            let bodyPromise: Promise<void> | null = null
            
            msg.on('body', (stream, info) => {
              console.log(`[IMAPClient.fetchEmailByUid] Body stream started for UID ${uid}`)
              let buffer = Buffer.alloc(0)
              bodyPromise = new Promise<void>((resolve) => {
                stream.on('data', (chunk: Buffer) => {
                  buffer = Buffer.concat([buffer, chunk])
                })
                stream.once('end', () => {
                  body = buffer.toString('utf8')
                  console.log(`[IMAPClient.fetchEmailByUid] Body stream ended for UID ${uid}, length: ${body.length}`)
                  resolve()
                })
              })
            })

            msg.on('attributes', (attrs) => {
              flags = attrs.flags || []
              envelope = (attrs as any).envelope
              console.log(`[IMAPClient.fetchEmailByUid] Attributes received for UID ${uid}, actual UID from attrs: ${attrs.uid}`)
            })

            messageProcessingPromise = new Promise<void>(async (resolveProcessing) => {
              msg.once('end', async () => {
              console.log(`[IMAPClient.fetchEmailByUid] Message end event for UID ${uid}, body length: ${body.length}, bodyPromise exists: ${!!bodyPromise}`)
              // Wait for body stream to complete if it exists
              if (bodyPromise) {
                console.log(`[IMAPClient.fetchEmailByUid] Waiting for body promise to complete...`)
                await bodyPromise
                console.log(`[IMAPClient.fetchEmailByUid] Body promise completed, body length: ${body.length}`)
              }

              try {
                // Parse the email body
                console.log(`[IMAPClient.fetchEmailByUid] Starting to parse body for UID ${uid}, length: ${body.length}`)
                let parsed: any = null
                if (body && body.length > 0) {
                  parsed = await simpleParser(body)
                  console.log(`[IMAPClient.fetchEmailByUid] Body parsed successfully for UID ${uid}`)
                } else {
                  console.warn(`[IMAPClient.fetchEmailByUid] No body content to parse for UID ${uid}`)
                }

                // Create email with parsed content
                console.log(`[IMAPClient.fetchEmailByUid] Creating email object for UID ${uid}`)
                email = {
                  id: `${this.account.id}-${folderName}-${uid}`,
                  accountId: this.account.id,
                  folderId: folderName,
                  uid: uid,
                  messageId: parsed?.messageId || envelope?.messageId || `msg-${uid}`,
                  subject: parsed?.subject || envelope?.subject || `Message ${uid}`,
                  from: parsed?.from ? this.parseAddresses(parsed.from) : (envelope?.from ? this.parseAddresses(envelope.from) : [{ address: 'unknown@example.com' }]),
                  to: parsed?.to ? this.parseAddresses(parsed.to) : (envelope?.to ? this.parseAddresses(envelope.to) : []),
                  cc: parsed?.cc ? this.parseAddresses(parsed.cc) : (envelope?.cc ? this.parseAddresses(envelope.cc) : undefined),
                  bcc: parsed?.bcc ? this.parseAddresses(parsed.bcc) : (envelope?.bcc ? this.parseAddresses(envelope.bcc) : undefined),
                  replyTo: parsed?.replyTo ? this.parseAddresses(parsed.replyTo) : (envelope?.replyTo ? this.parseAddresses(envelope.replyTo) : undefined),
                  date: parsed?.date ? parsed.date.getTime() : (envelope?.date ? new Date(envelope.date).getTime() : Date.now()),
                  body: parsed?.html || parsed?.text || '',
                  htmlBody: parsed?.html || undefined,
                  textBody: parsed?.text,
                  attachments: parsed?.attachments?.map((att: any) => ({
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
                  threadId: parsed?.inReplyTo || envelope?.inReplyTo || undefined,
                  inReplyTo: parsed?.inReplyTo || envelope?.inReplyTo || undefined,
                  references: parsed?.references ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references]) : (envelope?.references ? (Array.isArray(envelope.references) ? envelope.references : [envelope.references]) : undefined),
                  encrypted: false,
                  signed: false,
                  signatureVerified: undefined,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                }
                console.log(`[IMAPClient.fetchEmailByUid] Email object created successfully for UID ${uid}, body length: ${email.body?.length || 0}`)
              } catch (parseErr) {
                console.error(`[IMAPClient.fetchEmailByUid] Error parsing message ${uid}:`, parseErr, 'Stack:', (parseErr as any).stack)
                // Still create email with envelope data if parsing fails
                email = {
                  id: `${this.account.id}-${folderName}-${uid}`,
                  accountId: this.account.id,
                  folderId: folderName,
                  uid: uid,
                  messageId: envelope?.messageId || `msg-${uid}`,
                  subject: envelope?.subject || `Message ${uid}`,
                  from: envelope?.from ? this.parseAddresses(envelope.from) : [{ address: 'unknown@example.com' }],
                  to: envelope?.to ? this.parseAddresses(envelope.to) : [],
                  cc: envelope?.cc ? this.parseAddresses(envelope.cc) : undefined,
                  bcc: envelope?.bcc ? this.parseAddresses(envelope.bcc) : undefined,
                  replyTo: envelope?.replyTo ? this.parseAddresses(envelope.replyTo) : undefined,
                  date: envelope?.date ? new Date(envelope.date).getTime() : Date.now(),
                  body: '',
                  htmlBody: undefined,
                  textBody: undefined,
                  attachments: [],
                  flags: flags,
                  isRead: flags.includes('\\Seen'),
                  isStarred: flags.includes('\\Flagged'),
                  threadId: envelope?.inReplyTo || undefined,
                  inReplyTo: envelope?.inReplyTo || undefined,
                  references: envelope?.references ? (Array.isArray(envelope.references) ? envelope.references : [envelope.references]) : undefined,
                  encrypted: false,
                  signed: false,
                  signatureVerified: undefined,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                }
                console.log(`[IMAPClient.fetchEmailByUid] Email object created from envelope fallback for UID ${uid}`)
              }
              
              // Resolve the message processing promise after try/catch
              resolveProcessing()
              })
            })
          })

          fetch.once('error', (err) => {
            clearTimeout(timeout)
            console.error(`[IMAPClient.fetchEmailByUid] Fetch error for UID ${uid}:`, err)
            reject(err)
          })

          fetch.once('end', async () => {
            console.log(`[IMAPClient.fetchEmailByUid] Fetch end event for UID ${uid}, waiting for message processing...`)
            
            // Wait for message processing to complete
            if (messageProcessingPromise) {
              await messageProcessingPromise
            }
            
            clearTimeout(timeout)
            // Safely remove error handler - connection might be null if disconnected
            if (this.connection) {
              this.connection.removeListener('error', errorHandler)
            }
            console.log(`[IMAPClient.fetchEmailByUid] Message processing complete for UID ${uid}, email object: ${email ? 'created' : 'NULL'}`)
            if (!email) {
              console.warn(`[IMAPClient.fetchEmailByUid] No message received for UID ${uid} in folder ${targetFolder}. This could mean the UID doesn't exist in this folder.`)
            }
            resolve(email)
          })
        })
      } catch (e) {
        clearTimeout(timeout)
        reject(e)
      }
    })
  }

  async fetchEnvelopeAddresses(folderPath: string, uid: number): Promise<{
    from: EmailAddress[]
    to: EmailAddress[]
    cc: EmailAddress[]
    bcc: EmailAddress[]
    replyTo: EmailAddress[]
  } | null> {
    await this.ensureConnected()

    return new Promise(async (resolve, reject) => {
      try {
        // Decide which folder path to use
        let targetFolder = folderPath
        if (folderPath.toUpperCase() === 'INBOX') {
          targetFolder = await this.getInboxPath()
        }
        
        this.connection!.openBox(targetFolder, true, (err) => {
          if (err) {
            reject(err)
            return
          }

          let envelope: any = null

          const fetch = this.connection!.fetch(uid, {
            envelope: true
          })

          fetch.on('message', (msg) => {
            msg.on('attributes', (attrs) => {
              envelope = (attrs as any).envelope
            })
          })

          fetch.once('error', (error) => {
            reject(error)
          })

          fetch.once('end', () => {
            if (!envelope) {
              resolve(null)
              return
            }

            resolve({
              from: this.parseAddresses(envelope.from),
              to: this.parseAddresses(envelope.to),
              cc: this.parseAddresses(envelope.cc),
              bcc: this.parseAddresses(envelope.bcc),
              replyTo: this.parseAddresses(envelope.replyTo)
            })
          })
        })
      } catch (e) {
        reject(e)
      }
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

  async moveEmail(uid: number, sourceFolder: string, destinationFolder: string): Promise<void> {
    await this.ensureConnected()

    return new Promise(async (resolve, reject) => {
      try {
        // Decide which folder paths to use
        let targetSource = sourceFolder
        let targetDest = destinationFolder
        
        if (sourceFolder.toUpperCase() === 'INBOX') {
          targetSource = await this.getInboxPath()
        }
        if (destinationFolder.toUpperCase() === 'INBOX') {
          targetDest = await this.getInboxPath()
        }
        
        // Open source folder
        this.connection!.openBox(targetSource, false, (err, box) => {
          if (err) {
            reject(err)
            return
          }

          // Use COPY + DELETE + EXPUNGE
          this.connection!.copy(uid, targetDest, (copyErr) => {
            if (copyErr) {
              reject(copyErr)
              return
            }

            // Mark as deleted in source folder
            this.connection!.addFlags(uid, '\\Deleted', (deleteErr) => {
              if (deleteErr) {
                reject(deleteErr)
                return
              }

              // Expunge to actually delete (expunge doesn't take uid parameter)
              this.connection!.expunge((expungeErr) => {
                if (expungeErr) {
                  reject(expungeErr)
                  return
                }

                resolve()
              })
            })
          })
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  async markAsRead(uid: number, folderName: string, read: boolean = true): Promise<void> {
    await this.ensureConnected()

    return new Promise(async (resolve, reject) => {
      try {
        // Decide which folder path to use
        let targetFolder = folderName
        if (folderName.toUpperCase() === 'INBOX') {
          targetFolder = await this.getInboxPath()
        }
        
        this.connection!.openBox(targetFolder, false, (err) => {
          if (err) {
            reject(err)
            return
          }

          if (read) {
            // Add \Seen flag
            this.connection!.addFlags(uid, '\\Seen', (flagErr) => {
              if (flagErr) {
                reject(flagErr)
                return
              }
              resolve()
            })
          } else {
            // Remove \Seen flag
            this.connection!.delFlags(uid, '\\Seen', (flagErr) => {
              if (flagErr) {
                reject(flagErr)
                return
              }
              resolve()
            })
          }
        })
      } catch (error) {
        reject(error)
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

    const list = Array.isArray(addresses)
      ? addresses
      : Array.isArray(addresses.value)
        ? addresses.value
        : [addresses]

    return list
      .map((addr) => {
        const address =
          addr.address ||
          addr.email ||
          (addr.mailbox && addr.host ? `${addr.mailbox}@${addr.host}` : undefined) ||
          (typeof addr === 'string' ? addr : undefined)

        const rawName =
          addr.name ||
          addr.displayName ||
          (typeof addr === 'object' && addr.text ? addr.text.replace(/<.*?>/g, '').trim() : undefined)

        if (!address) {
          return undefined
        }

        return {
          name: rawName && rawName.length > 0 ? rawName : undefined,
          address,
        }
      })
      .filter((addr): addr is EmailAddress => !!addr)
  }
}

export function getIMAPClient(account: Account): IMAPClient {
  return new IMAPClient(account)
}
