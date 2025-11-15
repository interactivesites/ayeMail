export type MailSender = {
  name?: string | null
  address?: string | null
}

export type EmailLike = {
  from?: MailSender[]
}

const normalizeSender = (input: EmailLike | MailSender | undefined): MailSender | undefined => {
  if (!input) return undefined
  if (Array.isArray((input as EmailLike).from)) {
    return (input as EmailLike).from?.[0]
  }
  return input as MailSender
}

export const getSenderInitials = (source: EmailLike | MailSender | undefined) => {
  const sender = normalizeSender(source)
  const fallback = '?'
  if (!sender) return fallback

  const raw =
    (typeof sender.name === 'string' && sender.name.trim()) ||
    (typeof sender.address === 'string' && sender.address.split('@')[0]) ||
    ''
  if (!raw) return fallback

  const cleaned = raw.replace(/[^A-Za-z0-9]+/g, ' ').trim()
  if (!cleaned) return fallback

  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }

  const word = parts[0]
  if (!word) return fallback

  return word.slice(0, 2).toUpperCase()
}

export function groupEmailsByThread(emails: any[]): Map<string, any[]> {
  const threadMap = new Map<string, any[]>()
  
  emails.forEach(email => {
    const threadId = email.threadId || email.id
    if (!threadMap.has(threadId)) {
      threadMap.set(threadId, [])
    }
    threadMap.get(threadId)!.push(email)
  })
  
  // Sort emails within each thread by date
  threadMap.forEach((threadEmails) => {
    threadEmails.sort((a, b) => a.date - b.date)
  })
  
  return threadMap
}

export function getThreadCount(emails: any[], threadId: string | null | undefined): number {
  if (!threadId) return 1
  return emails.filter(e => e.threadId === threadId).length || 1
}



