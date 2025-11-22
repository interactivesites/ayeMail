import Imap from 'imap'
import { simpleParser } from 'mailparser'
import { accountManager } from './account-manager'
import type { Account } from '../shared/types'
import type { Email, EmailAddress, Attachment } from '../shared/types'

interface ClientPool {
  [accountId: string]: IMAPClient | null
}

const clientPool: ClientPool = {}
const METADATA_HEADER_FIELDS =
  'HEADER.FIELDS (DATE SUBJECT FROM TO CC BCC REPLY-TO MESSAGE-ID REFERENCES IN-REPLY-TO LIST-ID X-PRIORITY X-MAILER)'

export class IMAPClient {
  private account: Account
  private connection: Imap | null = null
  private inboxPath: string | null = null // Cache for discovered inbox path

  constructor(account: Account) {
    this.account = account
  }

  /**
   * Check if the client has a valid, connected IMAP connection
   */
  isConnected(): boolean {
    return this.connection !== null && this.connection.state !== 'disconnected'
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

    // TypeScript: we've checked imap exists above, so it's safe to use non-null assertion
    const imapSettings = this.account.imap!

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

    // For OAuth2, we need to format the XOAUTH2 token properly
    // Gmail requires: user=email\1auth=Bearer TOKEN\1\1
    let xoauth2Token: string | undefined = undefined
    if (oauth2Token?.accessToken) {
      xoauth2Token = `user=${this.account.email}\x01auth=Bearer ${oauth2Token.accessToken}\x01\x01`
    }

    const isGmail = this.account.email.toLowerCase().includes('@gmail.com') || 
                    this.account.email.toLowerCase().includes('@googlemail.com')

    return new Promise((resolve, reject) => {
      // Build IMAP config - for OAuth2, don't set password
      const imapConfig: any = {
        user: this.account.email,
        host: imapSettings.host,
        port: imapSettings.port,
        tls: imapSettings.secure,
        tlsOptions: { 
          rejectUnauthorized: imapSettings.allowInvalidCerts !== true, // Default: true (secure). Only false if explicitly enabled
          minVersion: 'TLSv1.2',
          ca: imapSettings.customCa || undefined
        }
      }

      if (this.account.authType === 'oauth2' && xoauth2Token) {
        // OAuth2 authentication - use xoauth2 only
        imapConfig.xoauth2 = xoauth2Token
        // Some IMAP libraries require a password placeholder for OAuth2
        imapConfig.password = 'oauth2'
      } else if (this.account.authType === 'password' && password) {
        // Password authentication
        imapConfig.password = password
      } else {
        reject(new Error('Authentication credentials not available'))
        return
      }

      this.connection = new Imap(imapConfig)

      const onReady = () => {
        this.connection!.removeListener('error', onError)
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
      }

      const onError = (err: Error) => {
        this.connection!.removeListener('ready', onReady)
        // Provide better error messages for Gmail
        let errorMessage = err.message
        const errLower = err.message.toLowerCase()
        
        if (isGmail && this.account.authType === 'password') {
          // Catch various forms of authentication failure
          if (errLower.includes('authentication failed') || 
              errLower.includes('invalid credentials') ||
              errLower.includes('login failed') ||
              errLower.includes('invalid password') ||
              errLower.includes('authentication failure') ||
              errLower.includes('wrong password') ||
              errLower.includes('incorrect password')) {
            errorMessage = `Gmail authentication failed.\n\n` +
              `IMPORTANT: As of May 2022, Google requires ALL Gmail accounts to use App Passwords for email clients (IMAP/SMTP). Regular passwords no longer work.\n\n` +
              `To fix this:\n` +
              `1. Enable 2-Step Verification on your Google Account (required by Google)\n` +
              `   • Go to: https://myaccount.google.com/security\n` +
              `   • Find "2-Step Verification" and turn it on\n\n` +
              `2. Generate an App Password:\n` +
              `   • Go to: https://myaccount.google.com/apppasswords\n` +
              `   • Copy the generated 16-character password\n\n` +
              `3. Use the App Password (not your regular password) in ayeMail\n\n` +
              `Note: Google discontinued "Less Secure Apps" access. App Passwords are now required for all accounts.`
          } else if (errLower.includes('less secure') || errLower.includes('blocked') || errLower.includes('access denied')) {
            errorMessage = `Gmail has blocked this login attempt.\n\n` +
              `Google no longer allows regular passwords for email clients. You must:\n\n` +
              `1. Enable IMAP in Gmail: Settings > See all settings > Forwarding and POP/IMAP > Enable IMAP\n` +
              `2. Enable 2-Step Verification: https://myaccount.google.com/security\n` +
              `3. Generate an App Password: https://myaccount.google.com/apppasswords\n` +
              `4. Use the App Password in ayeMail (not your regular Gmail password)\n\n` +
              `Google requires this for all accounts - regular passwords no longer work with third-party email apps.`
          }
        }
        reject(new Error(errorMessage))
      }

      this.connection.once('ready', onReady)
      this.connection.once('error', onError)

      this.connection.connect()
    })
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.end()
      this.connection = null
    }
    // Remove from pool when disconnecting
    if (clientPool[this.account.id] === this) {
      clientPool[this.account.id] = null
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

        const onReady = () => {
          clearTimeout(timeout)
          this.connection!.removeListener('error', onError)
          resolve()
        }

        const onError = (err: Error) => {
          clearTimeout(timeout)
          this.connection!.removeListener('ready', onReady)
          reject(err)
        }

        this.connection!.once('ready', onReady)
        this.connection!.once('error', onError)
      })
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('IMAP list timeout'))
      }, 30000)

      const onError = (err: Error) => {
        cleanup()
        reject(err)
      }

      const cleanup = () => {
        clearTimeout(timeout)
        this.connection!.removeListener('error', onError)
      }

      this.connection!.once('error', onError)

      try {
        const getBoxesMethod = (this.connection as any).getBoxes
        if (typeof getBoxesMethod !== 'function') {
          cleanup()
          reject(new Error(`IMAP connection does not have getBoxes method. Connection state: ${this.connection.state}`))
          return
        }

        getBoxesMethod.call(this.connection, (err: Error | null, boxes: any) => {
          cleanup()
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

              console.log(`[IMAP listFolders] Processing box: ${key}, name: ${name}, path: ${path}, delimiter: ${delimiter}, hasChildren: ${!!box.children}`)

              result.push({
                name,
                path,
                attributes: box.attributes || box.attrib || [],
                delimiter
              })

              if (box.children) {
                console.log(`[IMAP listFolders] Box ${key} has children:`, Object.keys(box.children))
                result.push(...flattenBoxes(box.children, path))
              }
            }

            return result
          }

          const folders = flattenBoxes(boxes)
          console.log(`[IMAP listFolders] Total folders found: ${folders.length}`, folders.map(f => ({ name: f.name, path: f.path })))
          resolve(folders)
        })
      } catch (error: any) {
        clearTimeout(timeout)
        reject(new Error(`Failed to list folders: ${error.message}`))
      }
    })
  }

  async getFolderStatus(folderName: string): Promise<{ messages: number; unseen: number; uidnext?: number; uidvalidity?: number }> {
    await this.ensureConnected()

    return new Promise((resolve, reject) => {
      const onError = (err: Error) => {
        this.connection!.removeListener('error', onError)
        reject(err)
      }

      this.connection!.once('error', onError)
      this.connection!.status(folderName, (err, status) => {
        this.connection!.removeListener('error', onError)
        if (err) {
          reject(err)
          return
        }
        const statusObj = status as any
        resolve({
          messages: typeof statusObj.messages === 'object' ? (statusObj.messages?.total || 0) : (statusObj.messages || 0),
          unseen: statusObj.unseen || statusObj.messages?.unseen || 0,
          uidnext: statusObj.uidnext || statusObj.uidNext,
          uidvalidity: statusObj.uidvalidity || statusObj.uidValidity
        })
      })
    })
  }

  async listMessageUids(folderName: string): Promise<number[]> {
    return this.withMailbox(folderName, true, () => {
      const connection = this.getConnectionOrThrow()
      return new Promise((resolve, reject) => {
        connection.search(['ALL'], (err, results) => {
          if (err) {
            reject(err)
            return
          }
          const uids = (results || []).map((value: any) => Number(value)).filter((value) => Number.isFinite(value))
          resolve(uids)
        })
      })
    })
  }

  async fetchEmailMetadata(
    folderName: string,
    start: number = 1,
    end: number = 50,
    options?: { uids?: number[] }
  ): Promise<Email[]> {
    return this.withMailbox(folderName, true, ({ box, path }) => {
      return new Promise((resolve, reject) => {
        const connection = this.getConnectionOrThrow()
        const timeout = setTimeout(() => {
          cleanup()
          reject(new Error('IMAP fetch timeout'))
        }, 120000) // 120 second timeout for large folders

        const errorHandler = (err: Error) => {
          cleanup()
          reject(err)
        }

        const cleanup = () => {
          clearTimeout(timeout)
          connection.removeListener('error', errorHandler)
        }

        connection.once('error', errorHandler)

        console.log(`Opened box ${box.name} (path=${path}): total=${box.messages.total}, unseen=${box.messages.unseen}`)

        const explicitUids = (options?.uids || []).filter((value) => Number.isFinite(value))
        const hasExplicitUids = explicitUids.length > 0

        const totalMessages = hasExplicitUids ? explicitUids.length : (box.messages.total || 0)
        if (totalMessages === 0) {
          cleanup()
          resolve([])
          return
        }

        const fetchAll = !hasExplicitUids && (end >= 10000 || end === 999999)
        const sequenceRange = hasExplicitUids
          ? null
          : fetchAll
            ? '1:*'
            : this.calculateSequenceRange(totalMessages, start, end)

        if (!hasExplicitUids && !sequenceRange) {
          cleanup()
          resolve([])
          return
        }

        if (hasExplicitUids) {
          console.log(`Fetching metadata for ${explicitUids.length} explicit UIDs from ${path}`)
        } else {
          console.log(`Fetching metadata from ${path} using sequence range ${sequenceRange}`)
        }

        const uidsOrSequence = hasExplicitUids ? explicitUids : sequenceRange
        this.fetchAndBuildEmails(connection, folderName, uidsOrSequence, {
          fullBody: false
        })
          .then((emails) => {
            cleanup()
            console.log(`Fetched ${emails.length} metadata entries from ${path}`)
            resolve(emails)
          })
          .catch((err) => {
            cleanup()
            reject(err)
          })
      })
    })
  }

  /**
   * Unified helper for fetching and building Email objects from IMAP
   * @param connection - IMAP connection
   * @param folderName - Folder name for email IDs
   * @param uidsOrSequence - UIDs array or sequence range string (null for sequence)
   * @param options - Fetch options
   * @param options.fullBody - Whether to fetch and parse full body (true) or just headers (false)
   * @param options.verbose - Whether to log verbose messages (for single email fetches)
   * @returns Promise resolving to array of Email objects
   */
  private async fetchAndBuildEmails(
    connection: Imap,
    folderName: string,
    uidsOrSequence: number[] | string | null,
    options: { fullBody: boolean; verbose?: boolean }
  ): Promise<Email[]> {
    const { fullBody, verbose = false } = options
    const isUids = Array.isArray(uidsOrSequence)
    const logPrefix = verbose ? `[IMAPClient.fetchEmailByUid]` : ''

    return new Promise((resolve, reject) => {
      const emails: Email[] = []
        const fetchOptions = {
        bodies: fullBody ? '' : METADATA_HEADER_FIELDS,
          struct: true,
          envelope: true
        }

      const fetch = isUids
        ? connection.fetch(uidsOrSequence as number[], fetchOptions)
        : connection.seq.fetch(uidsOrSequence as string, fetchOptions)

        fetch.on('message', (msg, seqno) => {
          let uid: number | null = null
          let flags: string[] = []
          let envelope: any = null
        let body = ''
          let headers = ''
        let bodyPromise: Promise<void> | null = null

        if (verbose) {
          console.log(`${logPrefix} Message event received, seqno ${seqno}`)
        }

          msg.on('body', (stream) => {
          if (verbose) {
            console.log(`${logPrefix} Body stream started`)
          }

          if (fullBody) {
            // Full body parsing
            let buffer = Buffer.alloc(0)
            bodyPromise = new Promise<void>((resolveBody) => {
              stream.on('data', (chunk: Buffer) => {
                buffer = Buffer.concat([buffer, chunk])
              })
              stream.once('end', () => {
                body = buffer.toString('utf8')
                if (verbose) {
                  console.log(`${logPrefix} Body stream ended, length: ${body.length}`)
                }
                resolveBody()
              })
            })
          } else {
            // Header-only parsing
            const chunks: Buffer[] = []
            stream.on('data', (chunk: Buffer) => chunks.push(chunk))
            stream.once('end', () => {
              headers = Buffer.concat(chunks).toString('utf8')
            })
          }
          })

          msg.on('attributes', (attrs) => {
            uid = attrs.uid
            flags = attrs.flags || []
            envelope = (attrs as any).envelope
          if (verbose) {
            console.log(`${logPrefix} Attributes received, UID: ${attrs.uid}`)
          }
        })

        const processMessage = async () => {
          if (bodyPromise) {
            if (verbose) {
              console.log(`${logPrefix} Waiting for body promise to complete...`)
            }
            await bodyPromise
            if (verbose) {
              console.log(`${logPrefix} Body promise completed, length: ${body.length}`)
            }
          }

          try {
            let parsed: any = null
            let emailHeaders: Record<string, string | string[]> | undefined = undefined

            if (fullBody && body && body.length > 0) {
              if (verbose) {
                console.log(`${logPrefix} Starting to parse body, length: ${body.length}`)
              }
              try {
                parsed = await simpleParser(body)
                if (verbose) {
                  console.log(`${logPrefix} Body parsed successfully`)
                }

                // Extract headers from parsed result
                if (parsed?.headers) {
                  emailHeaders = {}
                  for (const [key, value] of Object.entries(parsed.headers)) {
                    emailHeaders[key.toLowerCase()] = Array.isArray(value) ? value : [value]
                  }
                }
              } catch (parseErr) {
                if (verbose) {
                  console.error(`${logPrefix} Error parsing body:`, parseErr)
                }
                // Fall through to envelope-only fallback
              }
            } else if (!fullBody && headers) {
              emailHeaders = this.parseHeaders(headers)
            }

            const emailId = `${this.account.id}-${folderName}-${uid || seqno}`
            const emailUid = uid || seqno

            // Build email object with parsed data or fallback to envelope
              const email: Email = {
              id: emailId,
                accountId: this.account.id,
                folderId: folderName,
              uid: emailUid,
              messageId: parsed?.messageId || envelope?.messageId || `msg-${emailUid}`,
              subject: parsed?.subject || envelope?.subject || `Message ${emailUid}`,
              from: parsed?.from
                ? this.parseAddresses(parsed.from)
                : envelope?.from
                  ? this.parseAddresses(envelope.from)
                  : [{ address: 'unknown@example.com' }],
              to: parsed?.to
                ? this.parseAddresses(parsed.to)
                : envelope?.to
                  ? this.parseAddresses(envelope.to)
                  : [],
              cc: parsed?.cc
                ? this.parseAddresses(parsed.cc)
                : envelope?.cc
                  ? this.parseAddresses(envelope.cc)
                  : undefined,
              bcc: parsed?.bcc
                ? this.parseAddresses(parsed.bcc)
                : envelope?.bcc
                  ? this.parseAddresses(envelope.bcc)
                  : undefined,
              replyTo: parsed?.replyTo
                ? this.parseAddresses(parsed.replyTo)
                : envelope?.replyTo
                  ? this.parseAddresses(envelope.replyTo)
                  : undefined,
              date: parsed?.date
                ? parsed.date.getTime()
                : envelope?.date
                  ? new Date(envelope.date).getTime()
                  : Date.now(),
              body: fullBody
                ? parsed?.html || parsed?.text || body || ''
                : '',
              htmlBody: fullBody ? parsed?.html || undefined : undefined,
              textBody: fullBody ? parsed?.text : undefined,
              attachments: fullBody && parsed?.attachments
                ? parsed.attachments.map((att: any) => ({
                    id: `${emailId}-${att.filename}`,
                    emailId: emailId,
                    filename: att.filename || 'attachment',
                    contentType: att.contentType || 'application/octet-stream',
                    size: att.size || 0,
                    contentId: att.contentId,
                    data: att.content as Buffer
                  }))
                : [],
              flags: flags,
              isRead: flags.includes('\\Seen'),
              isStarred: flags.includes('\\Flagged'),
              threadId: parsed?.inReplyTo || envelope?.inReplyTo || undefined,
              inReplyTo: parsed?.inReplyTo || envelope?.inReplyTo || undefined,
              references: parsed?.references
                ? Array.isArray(parsed.references)
                  ? parsed.references
                  : [parsed.references]
                : envelope?.references
                  ? Array.isArray(envelope.references)
                    ? envelope.references
                    : [envelope.references]
                  : undefined,
              encrypted: false,
              signed: false,
              signatureVerified: undefined,
              headers: emailHeaders,
              createdAt: Date.now(),
              updatedAt: Date.now()
            }

            if (verbose) {
              console.log(`${logPrefix} Email object created`)
            }
            return email
          } catch (err) {
            // Fallback to envelope-only email
            if (verbose) {
              console.error(`${logPrefix} Error processing message, using envelope fallback:`, err)
            }
            const emailId = `${this.account.id}-${folderName}-${uid || seqno}`
            const emailUid = uid || seqno

            return {
              id: emailId,
              accountId: this.account.id,
              folderId: folderName,
              uid: emailUid,
              messageId: envelope?.messageId || `msg-${emailUid}`,
              subject: envelope?.subject || `Message ${emailUid}`,
                from: envelope?.from ? this.parseAddresses(envelope.from) : [{ address: 'unknown@example.com' }],
                to: envelope?.to ? this.parseAddresses(envelope.to) : [],
                cc: envelope?.cc ? this.parseAddresses(envelope.cc) : undefined,
                bcc: envelope?.bcc ? this.parseAddresses(envelope.bcc) : undefined,
                replyTo: envelope?.replyTo ? this.parseAddresses(envelope.replyTo) : undefined,
                date: envelope?.date ? new Date(envelope.date).getTime() : Date.now(),
              body: fullBody ? body : '',
                htmlBody: undefined,
                textBody: undefined,
                attachments: [],
                flags: flags,
                isRead: flags.includes('\\Seen'),
                isStarred: flags.includes('\\Flagged'),
                threadId: envelope?.inReplyTo || undefined,
                inReplyTo: envelope?.inReplyTo || undefined,
                references: envelope?.references
                ? Array.isArray(envelope.references)
                  ? envelope.references
                  : [envelope.references]
                  : undefined,
                encrypted: false,
                signed: false,
                signatureVerified: undefined,
              headers: undefined,
                createdAt: Date.now(),
                updatedAt: Date.now()
            } as Email
          }
        }

        // Store message promise for fullBody mode to await in fetch end handler
        if (fullBody) {
          const messagePromise = new Promise<Email>(async (resolveMsg) => {
            msg.once('end', async () => {
              try {
                const email = await processMessage()
                emails.push(email)
                resolveMsg(email)
              } catch (err) {
                // Already handled in processMessage fallback
                const email = await processMessage().catch(() => {
                  // If processMessage fails completely, create minimal email
                  const emailId = `${this.account.id}-${folderName}-${uid || seqno}`
                  const emailUid = uid || seqno
                  return {
                    id: emailId,
                    accountId: this.account.id,
                    folderId: folderName,
                    uid: emailUid,
                    messageId: envelope?.messageId || `msg-${emailUid}`,
                    subject: envelope?.subject || `Message ${emailUid}`,
                    from: envelope?.from ? this.parseAddresses(envelope.from) : [{ address: 'unknown@example.com' }],
                    to: envelope?.to ? this.parseAddresses(envelope.to) : [],
                    date: Date.now(),
                    body: '',
                    flags: flags || [],
                    isRead: false,
                    isStarred: false,
                    attachments: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                  } as Email
                })
                emails.push(email)
                resolveMsg(email)
              }
            })
          })
          ;(fetch as any)._messagePromises = (fetch as any)._messagePromises || []
          ;(fetch as any)._messagePromises.push(messagePromise)
        } else {
          // For metadata-only, synchronous processing
          msg.once('end', async () => {
            try {
              const email = await processMessage()
              emails.push(email)
            } catch (messageErr) {
              if (verbose) {
                console.error(`${logPrefix} Error processing metadata:`, messageErr)
              }
            }
          })
        }
      })

      const onFetchError = (err: Error) => {
        fetch.removeListener('error', onFetchError)
        fetch.removeListener('end', onFetchEnd)
        if (verbose) {
          console.error(`${logPrefix} Fetch error:`, err)
        }
          reject(err)
      }

      const onFetchEnd = async () => {
        fetch.removeListener('error', onFetchError)
        fetch.removeListener('end', onFetchEnd)

        if (fullBody && (fetch as any)._messagePromises) {
          if (verbose) {
            console.log(`${logPrefix} Waiting for message processing...`)
          }
          await Promise.all((fetch as any)._messagePromises)
        }

          // Maintain newest-first ordering for downstream consumers
          const sorted = emails.sort((a, b) => b.uid - a.uid)
        if (verbose) {
          console.log(`${logPrefix} Message processing complete, got ${sorted.length} email(s)`)
        }
          resolve(sorted)
      }

      fetch.once('error', onFetchError)
      fetch.once('end', onFetchEnd)
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
    end: number = 50,
    options?: { uids?: number[] }
  ): Promise<Email[]> {
    return this.withMailbox(folderName, true, ({ box, path }) => {
      return new Promise((resolve, reject) => {
        const connection = this.getConnectionOrThrow()
        const timeout = setTimeout(() => {
          reject(new Error('IMAP fetch timeout'))
        }, 120000)

        const errorHandler = (err: Error) => {
          cleanup()
          reject(err)
        }

        const cleanup = () => {
          clearTimeout(timeout)
          connection.removeListener('error', errorHandler)
        }

        connection.once('error', errorHandler)

        console.log(`Opened box ${box.name} (path=${path}): total=${box.messages.total}, unseen=${box.messages.unseen}`)

        const explicitUids = (options?.uids || []).filter((value) => Number.isFinite(value))
        const hasExplicitUids = explicitUids.length > 0
        const fetchAll = end >= 10000 || end === 999999

        const getUidsToFetch = async (): Promise<number[]> => {
          if (hasExplicitUids) {
            return explicitUids
          }

          if (!box || box.messages.total === 0) {
            return []
          }

          const allUids = await new Promise<number[]>((resolveUids, rejectUids) => {
            connection.search(['ALL'], (err, results) => {
              if (err) {
                rejectUids(err)
                return
              }
              const normalized = (results || [])
                .map((value: any) => Number(value))
                .filter((value) => Number.isFinite(value))
              resolveUids(normalized)
            })
          })

          if (allUids.length === 0) {
            return []
          }

          const sortedUids = allUids.sort((a, b) => b - a)
          if (fetchAll) {
            return sortedUids
          }

          const startIdx = Math.max(0, start - 1)
          const endIdx = Math.min(sortedUids.length, end)
          return sortedUids.slice(startIdx, endIdx)
        }

        const beginFetch = async () => {
          try {
            const uidsToFetch = await getUidsToFetch()
            if (uidsToFetch.length === 0) {
              cleanup()
              resolve([])
              return
            }

            console.log(`Fetching ${uidsToFetch.length} emails from ${path}${hasExplicitUids ? ' (explicit UID list)' : ''}`)

            this.fetchAndBuildEmails(connection, folderName, uidsToFetch, {
              fullBody: true
            })
              .then((emails) => {
                cleanup()
                console.log(`Finished fetching emails from ${path}: got ${emails.length} emails out of ${uidsToFetch.length} requested`)
                resolve(emails)
              })
              .catch((err) => {
              cleanup()
              console.error('IMAP fetch error:', err)
              reject(err)
            })
          } catch (err) {
            cleanup()
            reject(err)
          }
        }

        beginFetch().catch((err) => {
          cleanup()
          reject(err)
        })
      })
    })
  }
  async fetchEmailByUid(folderName: string, uid: number): Promise<Email | null> {
    console.log(`[IMAPClient.fetchEmailByUid] Starting fetch for UID ${uid} in folder ${folderName}`)

    return this.withMailbox(folderName, true, ({ box, path }) => {
      console.log(`[IMAPClient.fetchEmailByUid] Folder opened: ${box.name}, total messages: ${box.messages.total}`)

      return new Promise((resolve, reject) => {
        const connection = this.getConnectionOrThrow()
        const timeout = setTimeout(() => {
          console.error(`[IMAPClient.fetchEmailByUid] Timeout after 30s for UID ${uid} in folder ${folderName}`)
          cleanup()
          reject(new Error('IMAP fetch timeout'))
        }, 30000)

        const cleanup = () => {
          clearTimeout(timeout)
          connection.removeListener('error', errorHandler)
        }

        const errorHandler = (err: Error) => {
          console.error(`[IMAPClient.fetchEmailByUid] Connection error for UID ${uid}:`, err)
          cleanup()
          reject(err)
        }

        connection.once('error', errorHandler)

        console.log(`[IMAPClient.fetchEmailByUid] Fetching UID ${uid} from ${path}`)

        this.fetchAndBuildEmails(connection, folderName, [uid], {
          fullBody: true,
          verbose: true
        })
          .then((emails) => {
          cleanup()
            const email = emails[0] ?? null
          console.log(`[IMAPClient.fetchEmailByUid] Message processing complete for UID ${uid}, email object: ${email ? 'created' : 'NULL'}`)
          if (!email) {
            console.warn(`[IMAPClient.fetchEmailByUid] No message received for UID ${uid} in folder ${path}. This could mean the UID doesn't exist in this folder.`)
          }
          resolve(email)
        })
          .catch((err) => {
            cleanup()
            console.error(`[IMAPClient.fetchEmailByUid] Fetch error for UID ${uid}:`, err)
            reject(err)
          })
      })
    })
  }
  async fetchEnvelopeAddresses(folderPath: string, uid: number): Promise<{
    from: EmailAddress[]
    to: EmailAddress[]
    cc: EmailAddress[]
    bcc: EmailAddress[]
    replyTo: EmailAddress[]
  } | null> {
    return this.withMailbox(folderPath, true, () => {
      return new Promise((resolve, reject) => {
        const connection = this.getConnectionOrThrow()
        let envelope: any = null

        const fetch = connection.fetch(uid, {
          envelope: true
        })

        fetch.on('message', (msg) => {
          msg.on('attributes', (attrs) => {
            envelope = (attrs as any).envelope
          })
        })

        const onFetchError = (error: Error) => {
          fetch.removeListener('error', onFetchError)
          fetch.removeListener('end', onFetchEnd)
          reject(error)
        }

        const onFetchEnd = () => {
          fetch.removeListener('error', onFetchError)
          fetch.removeListener('end', onFetchEnd)
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
        }

        fetch.once('error', onFetchError)
        fetch.once('end', onFetchEnd)
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

  async moveEmail(uid: number, sourceFolder: string, destinationFolder: string): Promise<void> {
    const targetDest = await this.resolveFolderPath(destinationFolder)

    return this.withMailbox(sourceFolder, false, async () => {
      const connection = this.getConnectionOrThrow()

      await this.promisifyImapCallback<void>((done) => connection.copy(uid, targetDest, done))
      await this.promisifyImapCallback<void>((done) => connection.addFlags(uid, '\\Deleted', done))
      await this.promisifyImapCallback<void>((done) => connection.expunge(done))
    })
  }

  async markAsRead(uid: number, folderName: string, read: boolean = true): Promise<void> {
    return this.withMailbox(folderName, false, async () => {
      const connection = this.getConnectionOrThrow()

      if (read) {
        await this.promisifyImapCallback<void>((done) => connection.addFlags(uid, '\\Seen', done))
      } else {
        await this.promisifyImapCallback<void>((done) => connection.delFlags(uid, '\\Seen', done))
      }
    })
  }

  async deleteEmail(uid: number, folderName: string): Promise<void> {
    return this.withMailbox(folderName, false, async () => {
      const connection = this.getConnectionOrThrow()

      await this.promisifyImapCallback<void>((done) => connection.addFlags(uid, '\\Deleted', done))
      await this.promisifyImapCallback<void>((done) => connection.expunge(done))
    })
  }

  private async resolveFolderPath(folderName: string): Promise<string> {
    if (!folderName) {
      throw new Error('Folder name is required')
    }

    if (folderName.toUpperCase() === 'INBOX') {
      return this.getInboxPath()
    }

    return folderName
  }

  private getConnectionOrThrow(): Imap {
    if (!this.connection) {
      throw new Error('IMAP connection not established')
    }

    return this.connection
  }

  private async withMailbox<T>(
    folderName: string,
    readOnly: boolean,
    handler: (context: { box: Imap.Box; path: string }) => Promise<T> | T
  ): Promise<T> {
    await this.ensureConnected()
    const connection = this.getConnectionOrThrow()
    const path = await this.resolveFolderPath(folderName)

    return new Promise<T>((resolve, reject) => {
      connection.openBox(path, readOnly, async (err, box) => {
        if (err) {
          reject(err)
          return
        }

        try {
          const result = await handler({ box, path })
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  private promisifyImapCallback<T = void>(executor: (done: (err: Error | null, result?: T) => void) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      executor((err, result) => {
        if (err) {
          reject(err)
        } else {
          resolve(result as T)
        }
      })
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
  // Reuse existing client instance for this account if available and connection is still valid
  const existingClient = clientPool[account.id]
  if (existingClient && existingClient.isConnected()) {
    return existingClient
  }

  // Create new client instance and add to pool
  const client = new IMAPClient(account)
  clientPool[account.id] = client
  return client
}
