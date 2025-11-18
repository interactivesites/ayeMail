import { describe, it, expect } from 'vitest'
import { getSenderInitials, groupEmailsByThread, getThreadCount } from '../../renderer/utils/email'

describe('email utils', () => {
  describe('getSenderInitials', () => {
    it('should return initials from name', () => {
      expect(getSenderInitials({ name: 'John Doe', address: 'john@example.com' })).toBe('JD')
    })

    it('should return initials from two-word name', () => {
      expect(getSenderInitials({ name: 'Jane Smith', address: 'jane@example.com' })).toBe('JS')
    })

    it('should return first two letters from single word', () => {
      expect(getSenderInitials({ name: 'Alice', address: 'alice@example.com' })).toBe('AL')
    })

    it('should extract from email address if no name', () => {
      expect(getSenderInitials({ address: 'john.doe@example.com' })).toBe('JD')
    })

    it('should handle email-like object', () => {
      expect(getSenderInitials({ from: [{ name: 'Test User', address: 'test@example.com' }] })).toBe('TU')
    })

    it('should return fallback for undefined', () => {
      expect(getSenderInitials(undefined)).toBe('?')
    })

    it('should handle special characters in name', () => {
      expect(getSenderInitials({ name: 'John-Doe Test', address: 'john@example.com' })).toBe('JD')
    })

    it('should handle empty name and address', () => {
      expect(getSenderInitials({ name: '', address: '' })).toBe('?')
    })
  })

  describe('groupEmailsByThread', () => {
    it('should group emails by threadId', () => {
      const emails = [
        { id: '1', threadId: 'thread-1', date: 1000 },
        { id: '2', threadId: 'thread-1', date: 2000 },
        { id: '3', threadId: 'thread-2', date: 1500 }
      ]

      const result = groupEmailsByThread(emails)
      
      expect(result.size).toBe(2)
      expect(result.get('thread-1')).toHaveLength(2)
      expect(result.get('thread-2')).toHaveLength(1)
    })

    it('should use id as threadId if threadId is missing', () => {
      const emails = [
        { id: '1', date: 1000 },
        { id: '2', date: 2000 }
      ]

      const result = groupEmailsByThread(emails)
      
      expect(result.size).toBe(2)
      expect(result.get('1')).toHaveLength(1)
      expect(result.get('2')).toHaveLength(1)
    })

    it('should sort emails within thread by date', () => {
      const emails = [
        { id: '1', threadId: 'thread-1', date: 3000 },
        { id: '2', threadId: 'thread-1', date: 1000 },
        { id: '3', threadId: 'thread-1', date: 2000 }
      ]

      const result = groupEmailsByThread(emails)
      const threadEmails = result.get('thread-1')!
      
      expect(threadEmails[0].date).toBe(1000)
      expect(threadEmails[1].date).toBe(2000)
      expect(threadEmails[2].date).toBe(3000)
    })

    it('should handle empty array', () => {
      const result = groupEmailsByThread([])
      expect(result.size).toBe(0)
    })
  })

  describe('getThreadCount', () => {
    const emails = [
      { id: '1', threadId: 'thread-1' },
      { id: '2', threadId: 'thread-1' },
      { id: '3', threadId: 'thread-1' },
      { id: '4', threadId: 'thread-2' }
    ]

    it('should return count of emails in thread', () => {
      expect(getThreadCount(emails, 'thread-1')).toBe(3)
      expect(getThreadCount(emails, 'thread-2')).toBe(1)
    })

    it('should return 1 for null or undefined threadId', () => {
      expect(getThreadCount(emails, null)).toBe(1)
      expect(getThreadCount(emails, undefined)).toBe(1)
    })

    it('should return 1 for non-existent threadId', () => {
      expect(getThreadCount(emails, 'non-existent')).toBe(1)
    })
  })
})

