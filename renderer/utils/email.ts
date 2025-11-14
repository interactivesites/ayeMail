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



