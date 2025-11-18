import Imap from 'imap'
import { accountManager } from './account-manager'
import type { Account } from '../shared/types'

type ConnectionResult = { success: boolean; message: string }

type ConnectionTestAccount = {
  email: string
  type: 'imap' | 'pop3'
  imap?: {
    host: string
    port: number
    secure: boolean
  }
  pop3?: {
    host: string
    port: number
    secure: boolean
  }
  authType: 'oauth2' | 'password'
  oauth2?: Account['oauth2']
  password?: string
}

export async function testAccountConnection(accountId: string): Promise<ConnectionResult> {
  const account = await accountManager.getAccount(accountId)
  if (!account) {
    return { success: false, message: 'Account not found' }
  }

  let password: string | undefined
  if (account.authType === 'password') {
    password = await accountManager.getPassword(account.id) || undefined
  }

  return testAccountSettings({
    email: account.email,
    type: account.type,
    imap: account.imap,
    pop3: account.pop3,
    authType: account.authType,
    oauth2: account.oauth2,
    password
  })
}

export function testAccountSettings(account: ConnectionTestAccount): Promise<ConnectionResult> {
  if (account.type === 'imap') {
    return testIMAPConnection(account)
  } else if (account.type === 'pop3') {
    return testPOP3Connection(account)
  }

  return Promise.resolve({ success: false, message: 'Unsupported account type' })
}

function testIMAPConnection(account: ConnectionTestAccount): Promise<ConnectionResult> {
  return new Promise((resolve) => {
    if (!account.imap) {
      resolve({ success: false, message: 'IMAP configuration missing' })
      return
    }

    if (account.authType === 'password' && !account.password) {
      resolve({ success: false, message: 'Password not set' })
      return
    }

    if (account.authType === 'oauth2' && !account.oauth2?.accessToken) {
      resolve({ success: false, message: 'OAuth2 token not available' })
      return
    }

    const isGmail = account.email.toLowerCase().includes('@gmail.com') || 
                    account.email.toLowerCase().includes('@googlemail.com')

    // Format XOAUTH2 token properly for Gmail
    let xoauth2Token: string | undefined = undefined
    if (account.authType === 'oauth2' && account.oauth2?.accessToken) {
      xoauth2Token = `user=${account.email}\x01auth=Bearer ${account.oauth2.accessToken}\x01\x01`
    }

    const imapConfig: any = {
      user: account.email,
      host: account.imap.host,
      port: account.imap.port,
      tls: account.imap.secure,
      tlsOptions: { rejectUnauthorized: false } // Allow self-signed certificates for testing
    }

    if (account.authType === 'oauth2' && xoauth2Token) {
      imapConfig.xoauth2 = xoauth2Token
      imapConfig.password = 'oauth2'
    } else if (account.authType === 'password' && account.password) {
      imapConfig.password = account.password
    }

    const imap = new Imap(imapConfig)

    let resolved = false

    imap.once('ready', () => {
      if (!resolved) {
        resolved = true
        imap.end()
        resolve({ success: true, message: 'Connection successful' })
      }
    })

    imap.once('error', (err: Error) => {
      if (!resolved) {
        resolved = true
        let errorMessage = `Connection failed: ${err.message}`
        const errLower = err.message.toLowerCase()
        
        // Provide better error messages for Gmail
        if (isGmail && account.authType === 'password') {
          // Catch various forms of authentication failure
          if (errLower.includes('authentication failed') || 
              errLower.includes('invalid credentials') ||
              errLower.includes('login failed') ||
              errLower.includes('invalid password') ||
              errLower.includes('authentication failure') ||
              errLower.includes('wrong password') ||
              errLower.includes('incorrect password')) {
            errorMessage = `Gmail authentication failed. Since you have 2-Step Verification enabled, you MUST use an App Password instead of your regular Gmail password.\n\n` +
              `Steps to fix:\n` +
              `1. Go to https://myaccount.google.com/apppasswords\n` +
              `2. Sign in and select "Mail" and "Other (Custom name)"\n` +
              `3. Enter "ayeMail" as the app name\n` +
              `4. Click "Generate" and copy the 16-character password\n` +
              `5. Use this App Password (not your regular password) in the password field\n\n` +
              `Note: App Passwords are required for all email clients when 2FA is enabled.`
          } else if (errLower.includes('less secure') || errLower.includes('blocked') || errLower.includes('access denied')) {
            errorMessage = `Gmail has blocked this login attempt. Please check:\n` +
              `1. Enable IMAP in Gmail settings: Settings > See all settings > Forwarding and POP/IMAP > Enable IMAP\n` +
              `2. Use an App Password (required with 2FA): https://myaccount.google.com/apppasswords\n` +
              `3. Make sure you're using the App Password, not your regular Gmail password`
          }
        }
        
        resolve({ success: false, message: errorMessage })
      }
    })

    imap.connect()
  })
}

function testPOP3Connection(account: ConnectionTestAccount): Promise<ConnectionResult> {
  // POP3 testing will be implemented when we create the POP3 client
  return Promise.resolve({ success: false, message: 'POP3 testing not yet implemented' })
}
