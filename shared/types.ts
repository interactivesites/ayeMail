export interface Account {
  id: string
  name: string
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
  smtp: {
    host: string
    port: number
    secure: boolean
  }
  authType: 'oauth2' | 'password'
  oauth2?: {
    provider: 'gmail' | 'outlook' | 'custom'
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
  }
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  accountId: string
  name: string
  path: string
  parentId?: string
  subscribed: boolean
  unreadCount: number
  totalCount: number
  attributes: string[]
}

export type EmailStatus = 'now' | 'later' | 'reference' | 'noise' | 'archived' | null

export interface Email {
  id: string
  accountId: string
  folderId: string
  uid: number
  messageId: string
  subject: string
  from: EmailAddress[]
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  replyTo?: EmailAddress[]
  date: number
  body: string
  htmlBody?: string
  textBody?: string
  attachments: Attachment[]
  flags: string[]
  isRead: boolean
  isStarred: boolean
  threadId?: string
  inReplyTo?: string
  references?: string[]
  encrypted?: boolean
  signed?: boolean
  signatureVerified?: boolean
  status?: EmailStatus
  headers?: Record<string, string | string[]>
  createdAt: number
  updatedAt: number
}

export interface EmailAddress {
  name?: string
  address: string
}

export interface Attachment {
  id: string
  emailId: string
  filename: string
  contentType: string
  size: number
  contentId?: string
  data: Buffer
}

export interface Reminder {
  id: string
  emailId: string
  accountId: string
  dueDate: number
  message?: string
  completed: boolean
  createdAt: number
}

export interface Signature {
  id: string
  accountId: string
  name: string
  html?: string
  text?: string
  isDefault: boolean
  createdAt: number
}

export interface GPGKey {
  id: string
  fingerprint: string
  userIds: string[]
  createdAt: number
  expiresAt?: number
  isPrivate: boolean
}

