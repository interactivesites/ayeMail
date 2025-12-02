export interface EmailAddress {
  name?: string
  address: string
}

export interface Email {
  id: string
  accountId?: string
  date: number

  subject?: string
  from: EmailAddress[]
  to?: EmailAddress[]
  cc?: EmailAddress[] | undefined
  bcc?: EmailAddress[] | undefined

  // Flags etc.
  isRead?: boolean | number
  isStarred?: boolean
  isDraft?: boolean
  encrypted?: boolean
  signed?: boolean

  // Threading
  threadId?: string
  messageId?: string
  threadCount?: number

  // Content
  body?: string
  textBody?: string
  htmlBody?: string

  // Attachments
  attachments?: any[]
  attachmentCount?: number

  // Reminders
  hasReminder?: boolean
  reminderCompleted?: boolean
  reminder_due_date?: number

  // For unified folders / extra metadata
  [key: string]: any
}
