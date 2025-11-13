import { BrowserWindow } from 'electron'
import { randomBytes } from 'crypto'

interface OAuth2Config {
  clientId: string
  clientSecret: string
  authUrl: string
  tokenUrl: string
  redirectUri: string
  scopes: string[]
}

const OAUTH2_CONFIGS: Record<string, OAuth2Config> = {
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID || '',
    clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    redirectUri: 'http://localhost:5173/oauth2/callback',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify'
    ]
  },
  outlook: {
    clientId: process.env.OUTLOOK_CLIENT_ID || '',
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET || '',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    redirectUri: 'http://localhost:5173/oauth2/callback',
    scopes: [
      'https://outlook.office.com/IMAP.AccessAsUser.All',
      'https://outlook.office.com/SMTP.Send',
      'offline_access'
    ]
  }
}

export async function initiateOAuth2Flow(provider: 'gmail' | 'outlook'): Promise<{
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}> {
  const config = OAUTH2_CONFIGS[provider]
  if (!config) {
    throw new Error(`Unsupported OAuth2 provider: ${provider}`)
  }

  const state = randomBytes(16).toString('hex')
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = require('crypto')
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  const authUrl = new URL(config.authUrl)
  authUrl.searchParams.set('client_id', config.clientId)
  authUrl.searchParams.set('redirect_uri', config.redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', config.scopes.join(' '))
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  return new Promise((resolve, reject) => {
    const authWindow = new BrowserWindow({
      width: 500,
      height: 600,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    authWindow.loadURL(authUrl.toString())

    const handleCallback = (url: string) => {
      try {
        const urlObj = new URL(url)
        if (urlObj.pathname === '/oauth2/callback') {
          const code = urlObj.searchParams.get('code')
          const returnedState = urlObj.searchParams.get('state')
          const error = urlObj.searchParams.get('error')

          if (error) {
            authWindow.close()
            reject(new Error(`OAuth2 error: ${error}`))
            return
          }

          if (code && returnedState === state) {
            authWindow.close()
            exchangeCodeForToken(config, code, codeVerifier)
              .then(resolve)
              .catch(reject)
          }
        }
      } catch (err) {
        // Not our callback URL
      }
    }

    authWindow.webContents.on('will-redirect', (event, url) => {
      handleCallback(url)
    })

    authWindow.webContents.on('did-redirect-navigation' as any, (event: any, newUrl: string) => {
      handleCallback(newUrl)
    })

    authWindow.on('closed', () => {
      reject(new Error('OAuth2 window closed'))
    })
  })
}

async function exchangeCodeForToken(
  config: OAuth2Config,
  code: string,
  codeVerifier: string
): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: number }> {
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const data: any = await response.json()
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined
  }
}

export async function refreshOAuth2Token(
  provider: 'gmail' | 'outlook',
  refreshToken: string
): Promise<{ accessToken: string; expiresAt?: number }> {
  const config = OAUTH2_CONFIGS[provider]
  if (!config) {
    throw new Error(`Unsupported OAuth2 provider: ${provider}`)
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  const data: any = await response.json()
  
  return {
    accessToken: data.access_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined
  }
}

