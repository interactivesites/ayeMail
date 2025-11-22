import type { Email, EmailAddress } from '../shared/types'
import { getDatabase } from '../database'
import { Logger } from '../shared/logger'

const logger = Logger.create('ThreadUtils')

/**
 * Normalizes email addresses for comparison (lowercase, trim)
 */
function normalizeAddress(address: string): string {
  return address.toLowerCase().trim()
}

/**
 * Extracts email addresses from EmailAddress array
 */
function extractAddresses(addresses?: EmailAddress[]): string[] {
  if (!addresses || addresses.length === 0) return []
  return addresses.map(addr => normalizeAddress(addr.address))
}

/**
 * Normalizes subject line by removing Re:/Fwd: prefixes and trimming
 */
function normalizeSubject(subject: string): string {
  if (!subject) return ''
  // Remove common reply/forward prefixes (case insensitive)
  let normalized = subject.trim()
  const prefixes = ['re:', 'fwd:', 'fw:', 'aw:']
  for (const prefix of prefixes) {
    if (normalized.toLowerCase().startsWith(prefix)) {
      normalized = normalized.substring(prefix.length).trim()
    }
  }
  return normalized
}

/**
 * Calculates address match score between two emails
 * Higher score = more matching addresses
 */
function calculateAddressMatchScore(email1: Email, email2: Email): number {
  const addresses1 = new Set([
    ...extractAddresses(email1.from),
    ...extractAddresses(email1.to),
    ...extractAddresses(email1.cc)
  ])
  
  const addresses2 = new Set([
    ...extractAddresses(email2.from),
    ...extractAddresses(email2.to),
    ...extractAddresses(email2.cc)
  ])
  
  // Count matching addresses
  let matches = 0
  for (const addr of addresses1) {
    if (addresses2.has(addr)) {
      matches++
    }
  }
  
  // Return score based on number of matches (weighted by total unique addresses)
  const totalUnique = new Set([...addresses1, ...addresses2]).size
  return totalUnique > 0 ? matches / totalUnique : 0
}

/**
 * Checks if two subjects match (after normalization)
 */
function subjectsMatch(subject1: string, subject2: string): boolean {
  const norm1 = normalizeSubject(subject1)
  const norm2 = normalizeSubject(subject2)
  return norm1 === norm2 && norm1.length > 0
}

/**
 * Finds thread ID using standard threading (messageId, inReplyTo, references)
 * Returns the messageId of the root email in the thread, or null if not found
 */
async function findThreadByStandardThreading(
  email: Email,
  db: any
): Promise<string | null> {
  // If this email has inReplyTo or references, try to find the root
  const messageIdsToCheck = new Set<string>()
  
  if (email.inReplyTo) {
    messageIdsToCheck.add(email.inReplyTo)
  }
  
  if (email.references && email.references.length > 0) {
    // References chain: first one is usually the root
    email.references.forEach(ref => messageIdsToCheck.add(ref))
  }
  
  if (messageIdsToCheck.size === 0) {
    return null
  }
  
  // Find emails that match any of these messageIds
  const placeholders = Array.from(messageIdsToCheck).map(() => '?').join(',')
  const existingEmails = db.prepare(`
    SELECT message_id, thread_id, in_reply_to, email_references
    FROM emails
    WHERE message_id IN (${placeholders})
    LIMIT 100
  `).all(...Array.from(messageIdsToCheck)) as any[]
  
  if (existingEmails.length === 0) {
    return null
  }
  
  // Find the root email (one that is not a reply to another)
  // Or use the first messageId in references chain
  const rootMessageId = email.references && email.references.length > 0
    ? email.references[0]
    : email.inReplyTo
  
  if (!rootMessageId) {
    return null
  }
  
  // Check if we already have a threadId for this root
  const rootEmail = existingEmails.find(e => e.message_id === rootMessageId)
  if (rootEmail && rootEmail.thread_id) {
    return rootEmail.thread_id
  }
  
  // Use root messageId as threadId
  return rootMessageId
}

/**
 * Finds thread ID using subject and address matching
 * Returns threadId if found, null otherwise
 */
async function findThreadBySubjectAndAddresses(
  email: Email,
  db: any,
  accountId: string
): Promise<string | null> {
  const normalizedSubject = normalizeSubject(email.subject)
  if (!normalizedSubject || normalizedSubject.length < 3) {
    return null // Subject too short or empty
  }
  
  // Find emails with matching normalized subject
  const candidateEmails = db.prepare(`
    SELECT id, message_id, thread_id, subject, from_addresses, to_addresses, cc_addresses, date
    FROM emails
    WHERE account_id = ?
      AND subject LIKE ?
    ORDER BY date ASC
    LIMIT 50
  `).all(accountId, `%${normalizedSubject}%`) as any[]
  
  if (candidateEmails.length === 0) {
    return null
  }
  
  // Parse and check each candidate
  let bestMatch: { email: any; score: number } | null = null
  
  for (const candidate of candidateEmails) {
    // Parse addresses
    const candidateFrom = JSON.parse(candidate.from_addresses || '[]')
    const candidateTo = JSON.parse(candidate.to_addresses || '[]')
    const candidateCc = candidate.cc_addresses ? JSON.parse(candidate.cc_addresses) : []
    
    // Create Email-like object for comparison
    const candidateEmail: Partial<Email> = {
      from: candidateFrom,
      to: candidateTo,
      cc: candidateCc,
      subject: candidate.subject
    }
    
    // Check if subjects match exactly (after normalization)
    if (!subjectsMatch(email.subject, candidate.subject)) {
      continue
    }
    
    // Calculate address match score
    const score = calculateAddressMatchScore(email, candidateEmail as Email)
    
    // Require at least some address overlap for subject-based matching
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { email: candidate, score }
    }
  }
  
  if (!bestMatch || bestMatch.score < 0.1) {
    // Require at least 10% address match
    return null
  }
  
  // Use existing threadId if available, otherwise use messageId
  return bestMatch.email.thread_id || bestMatch.email.message_id
}

/**
 * Calculates thread ID for an email
 * Uses standard threading first, falls back to subject/address matching
 */
export async function calculateThreadId(email: Email): Promise<string> {
  const db = getDatabase()
  
  // First, try standard threading (messageId, inReplyTo, references)
  const standardThreadId = await findThreadByStandardThreading(email, db)
  if (standardThreadId) {
    return standardThreadId
  }
  
  // If no standard threading found, try subject + address matching
  const subjectThreadId = await findThreadBySubjectAndAddresses(email, db, email.accountId)
  if (subjectThreadId) {
    return subjectThreadId
  }
  
  // If this is a root email (no inReplyTo), use its own messageId as threadId
  if (!email.inReplyTo && (!email.references || email.references.length === 0)) {
    return email.messageId
  }
  
  // Fallback: use messageId as threadId
  return email.messageId
}

/**
 * Recalculates thread IDs for all emails in the database
 * Useful for migration or fixing thread associations
 */
export async function recalculateAllThreadIds(accountId?: string): Promise<{ updated: number }> {
  const db = getDatabase()
  
  // Get all emails (optionally filtered by account)
  const query = accountId
    ? 'SELECT * FROM emails WHERE account_id = ? ORDER BY date ASC'
    : 'SELECT * FROM emails ORDER BY date ASC'
  
  const emails = db.prepare(query).all(...(accountId ? [accountId] : [])) as any[]
  
  let updated = 0
  
  for (const dbEmail of emails) {
    try {
      // Map to Email type
      const email: Email = {
        id: dbEmail.id,
        accountId: dbEmail.account_id,
        folderId: dbEmail.folder_id,
        uid: dbEmail.uid,
        messageId: dbEmail.message_id,
        subject: dbEmail.subject,
        from: JSON.parse(dbEmail.from_addresses),
        to: JSON.parse(dbEmail.to_addresses),
        cc: dbEmail.cc_addresses ? JSON.parse(dbEmail.cc_addresses) : undefined,
        bcc: dbEmail.bcc_addresses ? JSON.parse(dbEmail.bcc_addresses) : undefined,
        replyTo: dbEmail.reply_to_addresses ? JSON.parse(dbEmail.reply_to_addresses) : undefined,
        date: dbEmail.date,
        body: '',
        htmlBody: undefined,
        textBody: undefined,
        attachments: [],
        flags: dbEmail.flags ? JSON.parse(dbEmail.flags) : [],
        isRead: dbEmail.is_read === 1,
        isStarred: dbEmail.is_starred === 1,
        threadId: dbEmail.thread_id || undefined,
        inReplyTo: dbEmail.in_reply_to || undefined,
        references: dbEmail.email_references ? JSON.parse(dbEmail.email_references) : undefined,
        encrypted: dbEmail.encrypted === 1,
        signed: dbEmail.signed === 1,
        signatureVerified: dbEmail.signature_verified !== null ? dbEmail.signature_verified === 1 : undefined,
        createdAt: dbEmail.created_at,
        updatedAt: dbEmail.updated_at
      }
      
      const newThreadId = await calculateThreadId(email)
      
      // Update if threadId changed
      if (newThreadId !== dbEmail.thread_id) {
        db.prepare('UPDATE emails SET thread_id = ?, updated_at = ? WHERE id = ?')
          .run(newThreadId, Date.now(), dbEmail.id)
        updated++
      }
    } catch (error) {
      logger.error(`Error recalculating thread ID for email ${dbEmail.id}:`, error)
    }
  }
  
  return { updated }
}

