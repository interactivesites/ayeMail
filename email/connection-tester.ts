import Imap from 'imap'
import { accountManager } from './account-manager'
import type { Account } from '../shared/types'

export async function testAccountConnection(accountId: string): Promise<{ success: boolean; message: string }> {
  const account = await accountManager.getAccount(accountId)
  if (!account) {
    return { success: false, message: 'Account not found' }
  }

  if (account.type === 'imap') {
    return testIMAPConnection(account)
  } else if (account.type === 'pop3') {
    return testPOP3Connection(account)
  }

  return { success: false, message: 'Unsupported account type' }
}

function testIMAPConnection(account: Account): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    if (!account.imap) {
      resolve({ success: false, message: 'IMAP configuration missing' })
      return
    }

    let password: string | null = null
    if (account.authType === 'password') {
      accountManager.getPassword(account.id).then(pwd => {
        password = pwd
        if (!password) {
          resolve({ success: false, message: 'Password not set' })
          return
        }
        performIMAPTest()
      })
    } else {
      performIMAPTest()
    }

    function performIMAPTest() {
      const imap = new Imap({
        user: account.email,
        password: password || 'oauth2', // OAuth2 uses 'oauth2' as password
        host: account.imap!.host,
        port: account.imap!.port,
        tls: account.imap!.secure,
        tlsOptions: { rejectUnauthorized: true },
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
    }
  })
}

function testPOP3Connection(account: Account): Promise<{ success: boolean; message: string }> {
  // POP3 testing will be implemented when we create the POP3 client
  return Promise.resolve({ success: false, message: 'POP3 testing not yet implemented' })
}

