import type { Email, EmailAddress } from '../../shared/types'

/**
 * Creates a mock Email object for testing
 */
export function createMockEmail(overrides?: Partial<Email>): Email {
  return {
    id: 'test-email-1',
    accountId: 'test-account-1',
    folderId: 'inbox',
    uid: 1,
    messageId: 'test-message-id-1',
    subject: 'Test Subject',
    from: [{ name: 'Test Sender', address: 'sender@example.com' }],
    to: [{ name: 'Test Recipient', address: 'recipient@example.com' }],
    date: Date.now(),
    body: 'Test email body',
    attachments: [],
    flags: [],
    isRead: false,
    isStarred: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  }
}

/**
 * Creates a mock EmailAddress object for testing
 */
export function createMockEmailAddress(overrides?: Partial<EmailAddress>): EmailAddress {
  return {
    name: 'Test User',
    address: 'test@example.com',
    ...overrides
  }
}

/**
 * Creates a mock Account object for testing
 */
export function createMockAccount(overrides?: any) {
  return {
    id: 'test-account-1',
    name: 'Test Account',
    email: 'test@example.com',
    type: 'imap' as const,
    imap: {
      host: 'imap.example.com',
      port: 993,
      secure: true
    },
    smtp: {
      host: 'smtp.example.com',
      port: 465,
      secure: true
    },
    authType: 'password' as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  }
}

/**
 * Waits for a specified amount of time (useful for async tests)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

