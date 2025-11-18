import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateThreadId } from '../../email/thread-utils'
import type { Email } from '../../shared/types'

// Mock the database module
vi.mock('../../database', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn((query: string) => ({
      all: vi.fn(() => []),
      get: vi.fn(() => null),
      run: vi.fn(() => ({ changes: 0 }))
    }))
  }))
}))

describe('thread-utils', () => {
  describe('calculateThreadId', () => {
    it('should use messageId for root email without references', async () => {
      const email: Email = {
        id: '1',
        accountId: 'account-1',
        folderId: 'inbox',
        uid: 1,
        messageId: 'msg-123',
        subject: 'Test Subject',
        from: [{ name: 'Test', address: 'test@example.com' }],
        to: [{ name: 'Recipient', address: 'recipient@example.com' }],
        date: Date.now(),
        body: 'Test body',
        attachments: [],
        flags: [],
        isRead: false,
        isStarred: false
      }

      const threadId = await calculateThreadId(email)
      expect(threadId).toBe('msg-123')
    })

    it('should use messageId when no threading information available', async () => {
      const email: Email = {
        id: '1',
        accountId: 'account-1',
        folderId: 'inbox',
        uid: 1,
        messageId: 'msg-456',
        subject: 'Another Subject',
        from: [{ name: 'Sender', address: 'sender@example.com' }],
        to: [{ name: 'Recipient', address: 'recipient@example.com' }],
        date: Date.now(),
        body: 'Body',
        attachments: [],
        flags: [],
        isRead: false,
        isStarred: false,
        inReplyTo: 'non-existent-id',
        references: ['non-existent-ref']
      }

      const threadId = await calculateThreadId(email)
      expect(threadId).toBe('msg-456')
    })
  })
})

