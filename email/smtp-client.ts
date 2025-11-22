import nodemailer from 'nodemailer'
import { accountManager } from './account-manager'
import type { Account } from '../shared/types'
import type { EmailAddress } from '../shared/types'

interface EmailToSend {
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  subject: string
  body: string
  htmlBody?: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType?: string
    cid?: string
  }>
  encrypted?: boolean
  signed?: boolean
}

export class SMTPClient {
  private account: Account
  private transporter: any = null

  constructor(account: Account) {
    this.account = account
  }

  async initialize(): Promise<void> {
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

    const auth: any = this.account.authType === 'oauth2' && oauth2Token
      ? {
          type: 'OAuth2',
          user: this.account.email,
          clientId: process.env[`${this.account.oauth2?.provider?.toUpperCase()}_CLIENT_ID`] || '',
          clientSecret: process.env[`${this.account.oauth2?.provider?.toUpperCase()}_CLIENT_SECRET`] || '',
          refreshToken: oauth2Token.refreshToken,
          accessToken: oauth2Token.accessToken
        }
      : {
          user: this.account.email,
          pass: password
        }

    this.transporter = nodemailer.createTransport({
      host: this.account.smtp.host,
      port: this.account.smtp.port,
      secure: this.account.smtp.secure,
      auth: auth as any,
      tls: {
        rejectUnauthorized: this.account.smtp.allowInvalidCerts !== true, // Default: true (secure). Only false if explicitly enabled
        minVersion: 'TLSv1.2',
        ca: this.account.smtp.customCa || undefined
      }
    } as any)

    // Verify connection
    await this.transporter.verify()
  }

  async sendEmail(email: EmailToSend & { from?: { email: string; name?: string } }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.transporter) {
      await this.initialize()
    }

    try {
      // Use provided from address or fallback to account email
      const fromAddress = email.from || {
        email: this.account.email,
        name: this.account.name
      }

      const mailOptions: any = {
        from: {
          name: fromAddress.name || fromAddress.email,
          address: fromAddress.email
        },
        to: email.to.map(addr => addr.address).join(', '),
        subject: email.subject,
        text: email.body,
        html: email.htmlBody || email.body
      }

      if (email.cc && email.cc.length > 0) {
        mailOptions.cc = email.cc.map(addr => addr.address).join(', ')
      }

      if (email.bcc && email.bcc.length > 0) {
        mailOptions.bcc = email.bcc.map(addr => addr.address).join(', ')
      }

      if (email.attachments && email.attachments.length > 0) {
        mailOptions.attachments = email.attachments.map(att => {
          const attachment: any = {
            content: att.content,
            contentType: att.contentType
          }
          // If CID is provided, it's an inline attachment
          if (att.cid) {
            // Nodemailer uses 'cid' for inline attachments
            attachment.cid = att.cid
            // Set as inline to prevent showing in attachment list
            attachment.disposition = 'inline'
            // Filename is optional for inline attachments, but include it for compatibility
            attachment.filename = att.filename
          } else {
            // Regular attachment
            attachment.filename = att.filename
            attachment.disposition = 'attachment'
          }
          return attachment
        })
      }

      const info = await this.transporter.sendMail(mailOptions)

      return {
        success: true,
        messageId: info.messageId
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.initialize()
      return { success: true, message: 'SMTP connection successful' }
    } catch (error: any) {
      return { success: false, message: `SMTP connection failed: ${error.message}` }
    }
  }
}

export function getSMTPClient(account: Account): SMTPClient {
  return new SMTPClient(account)
}

