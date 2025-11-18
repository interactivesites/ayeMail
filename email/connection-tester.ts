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

    const imap = new Imap({
      user: account.email,
      password: account.authType === 'password' ? account.password! : 'oauth2', // OAuth2 uses 'oauth2' as password
      host: account.imap.host,
      port: account.imap.port,
      tls: account.imap.secure,
      tlsOptions: { rejectUnauthorized: false }, // Allow self-signed certificates for testing
      xoauth2: account.authType === 'oauth2' ? account.oauth2?.accessToken : undefined
    })

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
        resolve({ success: false, message: `Connection failed: ${err.message}` })
      }
    })

    imap.connect()
  })
}

function testPOP3Connection(account: ConnectionTestAccount): Promise<ConnectionResult> {
  // POP3 testing will be implemented when we create the POP3 client
  return Promise.resolve({ success: false, message: 'POP3 testing not yet implemented' })
}
