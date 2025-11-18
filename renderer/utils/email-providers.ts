// Common email provider server configurations
export interface EmailServerConfig {
  imap: {
    host: string
    port: number
    secure: boolean
  }
  smtp: {
    host: string
    port: number
    secure: boolean
  }
  type: 'imap' | 'pop3'
}

const providerConfigs: Record<string, EmailServerConfig> = {
  // Gmail
  'gmail.com': {
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 587, secure: false },
    type: 'imap'
  },
  'googlemail.com': {
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 587, secure: false },
    type: 'imap'
  },
  
  // Outlook / Hotmail / Live
  'outlook.com': {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    type: 'imap'
  },
  'hotmail.com': {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    type: 'imap'
  },
  'live.com': {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    type: 'imap'
  },
  'msn.com': {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    type: 'imap'
  },
  
  // Yahoo
  'yahoo.com': {
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 587, secure: false },
    type: 'imap'
  },
  'yahoo.co.uk': {
    imap: { host: 'imap.mail.yahoo.co.uk', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.co.uk', port: 587, secure: false },
    type: 'imap'
  },
  'ymail.com': {
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 587, secure: false },
    type: 'imap'
  },
  
  // iCloud
  'icloud.com': {
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    type: 'imap'
  },
  'me.com': {
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    type: 'imap'
  },
  'mac.com': {
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    type: 'imap'
  },
  
  // AOL
  'aol.com': {
    imap: { host: 'imap.aol.com', port: 993, secure: true },
    smtp: { host: 'smtp.aol.com', port: 587, secure: false },
    type: 'imap'
  },
  
  // ProtonMail (requires ProtonMail Bridge)
  'protonmail.com': {
    imap: { host: '127.0.0.1', port: 1143, secure: false },
    smtp: { host: '127.0.0.1', port: 1025, secure: false },
    type: 'imap'
  },
  'proton.me': {
    imap: { host: '127.0.0.1', port: 1143, secure: false },
    smtp: { host: '127.0.0.1', port: 1025, secure: false },
    type: 'imap'
  },
  
  // FastMail
  'fastmail.com': {
    imap: { host: 'imap.fastmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.fastmail.com', port: 587, secure: false },
    type: 'imap'
  },
  
  // Zoho
  'zoho.com': {
    imap: { host: 'imap.zoho.com', port: 993, secure: true },
    smtp: { host: 'smtp.zoho.com', port: 587, secure: false },
    type: 'imap'
  },
  'zoho.eu': {
    imap: { host: 'imap.zoho.eu', port: 993, secure: true },
    smtp: { host: 'smtp.zoho.eu', port: 587, secure: false },
    type: 'imap'
  },
  
  // Yandex
  'yandex.com': {
    imap: { host: 'imap.yandex.com', port: 993, secure: true },
    smtp: { host: 'smtp.yandex.com', port: 465, secure: true },
    type: 'imap'
  },
  'yandex.ru': {
    imap: { host: 'imap.yandex.ru', port: 993, secure: true },
    smtp: { host: 'smtp.yandex.ru', port: 465, secure: true },
    type: 'imap'
  },

  // All-inkl / Kasserver
  'all-inkl.com': {
    imap: { host: 'imap.all-inkl.com', port: 993, secure: true },
    smtp: { host: 'smtp.all-inkl.com', port: 587, secure: false },
    type: 'imap'
  },
  'all-inkl.de': {
    imap: { host: 'imap.all-inkl.com', port: 993, secure: true },
    smtp: { host: 'smtp.all-inkl.com', port: 587, secure: false },
    type: 'imap'
  },
  'kasserver.com': {
    imap: { host: 'imap.kasserver.com', port: 993, secure: true },
    smtp: { host: 'smtp.kasserver.com', port: 587, secure: false },
    type: 'imap'
  },
  'kasserver.de': {
    imap: { host: 'imap.kasserver.com', port: 993, secure: true },
    smtp: { host: 'smtp.kasserver.com', port: 587, secure: false },
    type: 'imap'
  }
}

/**
 * Get email server configuration based on email domain
 * Returns null if no known configuration found
 */
export function getEmailServerConfig(email: string): EmailServerConfig | null {
  if (!email || !email.includes('@')) {
    return null
  }
  
  const domain = email.toLowerCase().split('@')[1]
  
  // Check exact match first
  if (providerConfigs[domain]) {
    return providerConfigs[domain]
  }
  
  // Check for subdomain matches (e.g., mail.example.com -> example.com)
  const parts = domain.split('.')
  if (parts.length > 2) {
    const baseDomain = parts.slice(-2).join('.')
    if (providerConfigs[baseDomain]) {
      return providerConfigs[baseDomain]
    }
  }
  
  return null
}

/**
 * Generate default server configuration for unknown domains
 * Uses common conventions: imap.domain.com and smtp.domain.com
 */
export function getDefaultServerConfig(email: string): EmailServerConfig {
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email address')
  }
  
  const domain = email.toLowerCase().split('@')[1]
  
  return {
    imap: {
      host: `imap.${domain}`,
      port: 993,
      secure: true
    },
    smtp: {
      host: `smtp.${domain}`,
      port: 587,
      secure: false
    },
    type: 'imap'
  }
}

/**
 * Get server configuration for an email, with fallback to defaults
 */
export function getServerConfig(email: string): EmailServerConfig {
  return getEmailServerConfig(email) || getDefaultServerConfig(email)
}
