import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EmailStorage } from '../../email/email-storage'
import type { Email } from '../../shared/types'
import { getDatabase } from '../../database'

// Mock encryption functions - must be defined before vi.mock
const mockEncrypt = vi.fn((text: string) => `encrypted:${text}`)
const mockDecrypt = vi.fn((encrypted: string) => encrypted.replace('encrypted:', ''))

// Mock the database module
vi.mock('../../database', () => {
  const mockGet = vi.fn()
  const mockRun = vi.fn(() => ({ changes: 1 }))
  const mockAll = vi.fn(() => [])
  const mockPrepare = vi.fn((query: string) => ({
    get: mockGet,
    run: mockRun,
    all: mockAll
  }))

  const mockDb = {
    prepare: mockPrepare,
    mockGet,
    mockRun,
    mockAll
  }

  return {
    getDatabase: vi.fn(() => mockDb),
    encryption: {
      encrypt: (text: string) => mockEncrypt(text),
      decrypt: (encrypted: string) => mockDecrypt(encrypted),
      encryptBuffer: vi.fn((buf: Buffer) => buf)
    }
  }
})

// Mock thread-utils
vi.mock('../../email/thread-utils', () => ({
  calculateThreadId: vi.fn(async () => 'thread-123')
}))

// Mock account manager
vi.mock('../../email/index', () => ({
  accountManager: {
    getAccount: vi.fn()
  },
  getIMAPClient: vi.fn(),
  getPOP3Client: vi.fn()
}))

describe('EmailStorage - Body Preservation', () => {
  let emailStorage: EmailStorage
  let mockDb: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = getDatabase()
    emailStorage = new EmailStorage()
  })

  it('should preserve email body when folder refresh happens after body download', async () => {
    const accountId = 'test-account-1'
    const folderId = 'test-folder-1'
    const uid = 123
    const emailId = `${accountId}-${folderId}-${uid}`

    // Step 1: Mail is loaded (metadata only)
    const metadataEmail: Email = {
      id: emailId,
      accountId,
      folderId,
      uid,
      messageId: 'msg-123',
      subject: 'Test Subject',
      from: [{ name: 'Sender', address: 'sender@example.com' }],
      to: [{ name: 'Recipient', address: 'recipient@example.com' }],
      date: Date.now(),
      body: '', // No body in metadata
      attachments: [],
      flags: [],
      isRead: false,
      isStarred: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // Mock: Email doesn't exist yet (first insert)
    mockDb.mockGet.mockReturnValueOnce(null)

    // Store metadata-only email
    await emailStorage.storeEmail(metadataEmail)

    // Verify email was inserted
    expect(mockDb.prepare).toHaveBeenCalled()
    expect(mockDb.mockRun).toHaveBeenCalled()
    
    // Step 2: Mail body is downloaded (simulate getEmail with fetchRemoteBody)
    const downloadedBody = 'This is the downloaded email body content'
    const downloadedHtmlBody = '<p>This is the HTML body</p>'
    const downloadedTextBody = 'This is the plain text body'

    // Mock: Email exists with downloaded body (simulating what happens after body download)
    mockDb.mockGet.mockReturnValueOnce({
      id: emailId,
      body_encrypted: mockEncrypt(downloadedBody), // Body is now present
      html_body_encrypted: mockEncrypt(downloadedHtmlBody),
      text_body_encrypted: mockEncrypt(downloadedTextBody),
      headers_encrypted: null
    })

    // Step 3: Folder refresh - same mail metadata loads again
    // Store email again with metadata only (folder refresh scenario)
    const refreshEmail: Email = {
      ...metadataEmail,
      subject: 'Test Subject Updated', // Subject might change
      date: Date.now() + 1000, // Date might be slightly different
      body: '', // Still no body in metadata
      htmlBody: undefined,
      textBody: undefined
    }

    // Capture the update call - store all arguments as an array
    const updateCallArgs: any[][] = []
    mockDb.mockRun.mockImplementation((...args: any[]) => {
      updateCallArgs.push([...args])
      return { changes: 1 }
    })

    await emailStorage.storeEmail(refreshEmail)

    // Step 4: Verify body is NOT overwritten
    // The update should preserve the existing encrypted body
    expect(mockDb.mockRun).toHaveBeenCalled()
    
    // Find the body_encrypted parameter in the update call
    // Based on the UPDATE query structure: 
    // subject(0), from(1), to(2), cc(3), bcc(4), reply_to(5), date(6), 
    // body_encrypted(7), html_body_encrypted(8), text_body_encrypted(9), ...
    const lastUpdateCall = updateCallArgs[updateCallArgs.length - 1]
    
    const bodyEncryptedIndex = 7 // body_encrypted is the 8th parameter (0-indexed)
    const preservedBodyEncrypted = lastUpdateCall[bodyEncryptedIndex]
    
    // The preserved body should be the encrypted version of the downloaded body
    expect(preservedBodyEncrypted).toBe(`encrypted:${downloadedBody}`)
    expect(preservedBodyEncrypted).not.toBe(`encrypted:`) // Should not be empty
    
    // Verify HTML and text bodies are also preserved
    const htmlBodyEncryptedIndex = 8
    const textBodyEncryptedIndex = 9
    expect(lastUpdateCall[htmlBodyEncryptedIndex]).toBe(`encrypted:${downloadedHtmlBody}`)
    expect(lastUpdateCall[textBodyEncryptedIndex]).toBe(`encrypted:${downloadedTextBody}`)
  })

  it('should preserve body when storeEmail is called multiple times with metadata only', async () => {
    const accountId = 'test-account-2'
    const folderId = 'test-folder-2'
    const uid = 456
    const emailId = `${accountId}-${folderId}-${uid}`

    const originalBody = 'Original body content'
    const originalHtmlBody = '<p>Original HTML</p>'

    // First: Store email with body
    const emailWithBody: Email = {
      id: emailId,
      accountId,
      folderId,
      uid,
      messageId: 'msg-456',
      subject: 'Test',
      from: [{ address: 'test@example.com' }],
      to: [{ address: 'recipient@example.com' }],
      date: Date.now(),
      body: originalBody,
      htmlBody: originalHtmlBody,
      attachments: [],
      flags: [],
      isRead: false,
      isStarred: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    mockDb.mockGet.mockReturnValueOnce(null)
    await emailStorage.storeEmail(emailWithBody)

    // Second: Store same email with metadata only (no body)
    const metadataOnlyEmail: Email = {
      ...emailWithBody,
      body: '', // Empty body
      htmlBody: undefined,
      textBody: undefined
    }

    // Mock: Email exists with original body
    mockDb.mockGet.mockReturnValueOnce({
      id: emailId,
      body_encrypted: mockEncrypt(originalBody),
      html_body_encrypted: mockEncrypt(originalHtmlBody),
      text_body_encrypted: null,
      headers_encrypted: null
    })

    const updateCallArgs: any[][] = []
    mockDb.mockRun.mockImplementation((...args: any[]) => {
      updateCallArgs.push([...args])
      return { changes: 1 }
    })

    await emailStorage.storeEmail(metadataOnlyEmail)

    // Verify body was preserved
    expect(mockDb.mockRun).toHaveBeenCalled()
    const lastUpdateCall = updateCallArgs[updateCallArgs.length - 1]
    const bodyIndex = 7
    const preservedBody = lastUpdateCall[bodyIndex]
    expect(preservedBody).toBe(`encrypted:${originalBody}`)
    expect(preservedBody).not.toBe(`encrypted:`)
  })
})
