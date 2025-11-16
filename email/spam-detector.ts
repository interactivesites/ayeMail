import { getDatabase } from '../database'
import type { Email } from '../shared/types'
import { randomUUID } from 'crypto'
import { promisify } from 'util'
import * as dns from 'dns'

const resolveTxt = promisify(dns.resolveTxt)
const resolve4 = promisify(dns.resolve4)

// Cache for blacklist lookups to avoid excessive DNS queries
const blacklistCache = new Map<string, { result: boolean; timestamp: number }>()
const CACHE_TTL = 3600000 // 1 hour in milliseconds

// Greylist block duration (24 hours)
const GREYLIST_BLOCK_DURATION = 24 * 60 * 60 * 1000

export class SpamDetector {
  private db = getDatabase()

  /**
   * Check if domain is in Spamhaus DBL (Domain Block List)
   */
  private async checkSpamhausDBL(domain: string): Promise<boolean> {
    try {
      const lookupDomain = `${domain}.dbl.spamhaus.org`
      const cacheKey = `dbl:${domain}`
      
      // Check cache first
      const cached = blacklistCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result
      }

      try {
        const records = await resolveTxt(lookupDomain)
        // If we get any TXT records, domain is blacklisted
        const isBlacklisted = records.length > 0 && records[0].length > 0
        blacklistCache.set(cacheKey, { result: isBlacklisted, timestamp: Date.now() })
        return isBlacklisted
      } catch (err: any) {
        // NXDOMAIN means not blacklisted
        if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
          blacklistCache.set(cacheKey, { result: false, timestamp: Date.now() })
          return false
        }
        // Other errors - assume not blacklisted to avoid false positives
        console.warn(`Error checking Spamhaus DBL for ${domain}:`, err.message)
        return false
      }
    } catch (error) {
      console.error('Error in checkSpamhausDBL:', error)
      return false
    }
  }

  /**
   * Check URLs in email body against SURBL (Spam URI Realtime Blocklists)
   */
  private async checkSURBL(email: Email): Promise<boolean> {
    try {
      // Extract URLs from email body
      const urls = this.extractUrls(email.body || email.textBody || '')
      if (urls.length === 0) {
        return false
      }

      // Check each URL domain against SURBL
      for (const url of urls) {
        try {
          const urlObj = new URL(url)
          const domain = urlObj.hostname
          const lookupDomain = `${domain}.multi.surbl.org`
          const cacheKey = `surbl:${domain}`

          // Check cache first
          const cached = blacklistCache.get(cacheKey)
          if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            if (cached.result) return true
            continue
          }

          try {
            const records = await resolve4(lookupDomain)
            // If we get any A records, domain is blacklisted
            const isBlacklisted = records.length > 0
            blacklistCache.set(cacheKey, { result: isBlacklisted, timestamp: Date.now() })
            if (isBlacklisted) return true
          } catch (err: any) {
            // NXDOMAIN means not blacklisted
            if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
              blacklistCache.set(cacheKey, { result: false, timestamp: Date.now() })
            }
          }
        } catch (urlError) {
          // Invalid URL, skip
          continue
        }
      }

      return false
    } catch (error) {
      console.error('Error in checkSURBL:', error)
      return false
    }
  }

  /**
   * Extract URLs from text
   */
  private extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi
    const matches = text.match(urlRegex)
    return matches || []
  }

  /**
   * Check online blacklists (Spamhaus DBL, SURBL)
   */
  async checkBlacklist(email: Email): Promise<boolean> {
    try {
      // Extract sender domain
      const senderEmail = email.from?.[0]?.address
      if (!senderEmail) {
        return false
      }

      const domain = senderEmail.split('@')[1]
      if (!domain) {
        return false
      }

      // Check Spamhaus DBL
      const spamhausResult = await this.checkSpamhausDBL(domain)
      if (spamhausResult) {
        return true
      }

      // Check SURBL for URLs in email
      const surblResult = await this.checkSURBL(email)
      if (surblResult) {
        return true
      }

      return false
    } catch (error) {
      console.error('Error in checkBlacklist:', error)
      return false
    }
  }

  /**
   * Analyze email headers for SPF, DKIM, DMARC
   */
  analyzeHeaders(email: Email): number {
    let score = 0.0
    const headers = email.headers || {}

    // SPF check
    const spfHeader = this.getHeader(headers, 'received-spf') || this.getHeader(headers, 'authentication-results')
    if (spfHeader) {
      const spfStr = Array.isArray(spfHeader) ? spfHeader[0] : spfHeader
      if (spfStr.toLowerCase().includes('pass')) {
        score -= 0.1 // Good sign
      } else if (spfStr.toLowerCase().includes('fail') || spfStr.toLowerCase().includes('softfail')) {
        score += 0.3 // Bad sign
      } else if (spfStr.toLowerCase().includes('none')) {
        score += 0.1 // Neutral but slightly suspicious
      }
    } else {
      score += 0.1 // No SPF record
    }

    // DKIM check
    const dkimHeader = this.getHeader(headers, 'dkim-signature') || this.getHeader(headers, 'authentication-results')
    if (dkimHeader) {
      const dkimStr = Array.isArray(dkimHeader) ? dkimHeader[0] : dkimHeader
      if (dkimStr.toLowerCase().includes('pass')) {
        score -= 0.1 // Good sign
      } else if (dkimStr.toLowerCase().includes('fail')) {
        score += 0.2 // Bad sign
      }
    } else {
      score += 0.05 // No DKIM signature (less suspicious than SPF)
    }

    // DMARC check
    const dmarcHeader = this.getHeader(headers, 'authentication-results')
    if (dmarcHeader) {
      const dmarcStr = Array.isArray(dmarcHeader) ? dmarcHeader[0] : dmarcHeader
      if (dmarcStr.toLowerCase().includes('dmarc=pass')) {
        score -= 0.15 // Very good sign
      } else if (dmarcStr.toLowerCase().includes('dmarc=fail')) {
        score += 0.4 // Very bad sign
      } else if (dmarcStr.toLowerCase().includes('dmarc=none')) {
        score += 0.1 // Neutral
      }
    } else {
      score += 0.05 // No DMARC
    }

    // Check for suspicious headers
    const fromHeader = this.getHeader(headers, 'from')
    if (fromHeader) {
      const fromStr = Array.isArray(fromHeader) ? fromHeader[0] : fromHeader
      // Check for suspicious patterns
      if (fromStr.includes('<>') || fromStr.includes('noreply') || fromStr.includes('no-reply')) {
        score += 0.05
      }
    }

    // Check Return-Path vs From mismatch
    const returnPath = this.getHeader(headers, 'return-path')
    const from = this.getHeader(headers, 'from')
    if (returnPath && from) {
      const returnPathStr = Array.isArray(returnPath) ? returnPath[0] : returnPath
      const fromStr = Array.isArray(from) ? from[0] : from
      const returnPathEmail = returnPathStr.match(/<([^>]+)>/)?.[1] || returnPathStr
      const fromEmail = fromStr.match(/<([^>]+)>/)?.[1] || fromStr
      if (returnPathEmail && fromEmail && returnPathEmail.toLowerCase() !== fromEmail.toLowerCase()) {
        score += 0.1 // Mismatch is suspicious
      }
    }

    return Math.max(0, Math.min(1, score)) // Clamp between 0 and 1
  }

  /**
   * Get header value (case-insensitive)
   */
  private getHeader(headers: Record<string, string | string[]>, name: string): string | string[] | undefined {
    const lowerName = name.toLowerCase()
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lowerName) {
        return value
      }
    }
    return undefined
  }

  /**
   * Check local blacklist
   */
  checkLocalBlacklist(email: Email): boolean {
    try {
      const senderEmail = email.from?.[0]?.address
      if (!senderEmail) {
        return false
      }

      const domain = senderEmail.split('@')[1]

      // Check email address
      const emailMatch = this.db.prepare(`
        SELECT id FROM spam_blacklist 
        WHERE email_address = ? AND (account_id = ? OR account_id IS NULL)
        LIMIT 1
      `).get(senderEmail.toLowerCase(), email.accountId) as any

      if (emailMatch) {
        return true
      }

      // Check domain
      if (domain) {
        const domainMatch = this.db.prepare(`
          SELECT id FROM spam_blacklist 
          WHERE domain = ? AND (account_id = ? OR account_id IS NULL)
          LIMIT 1
        `).get(domain.toLowerCase(), email.accountId) as any

        if (domainMatch) {
          return true
        }
      }

      return false
    } catch (error) {
      console.error('Error in checkLocalBlacklist:', error)
      return false
    }
  }

  /**
   * Check greylist
   */
  checkGreylist(email: Email): boolean {
    try {
      const senderEmail = email.from?.[0]?.address
      if (!senderEmail) {
        return false
      }

      const domain = senderEmail.split('@')[1]
      const now = Date.now()

      // Check if sender is currently blocked
      const blocked = this.db.prepare(`
        SELECT id, block_until FROM spam_greylist 
        WHERE (email_address = ? OR domain = ?) 
        AND (account_id = ? OR account_id IS NULL)
        AND block_until > ?
        LIMIT 1
      `).get(senderEmail.toLowerCase(), domain?.toLowerCase() || '', email.accountId, now) as any

      if (blocked) {
        return true
      }

      // Update or create greylist entry
      const existing = this.db.prepare(`
        SELECT id, first_seen, last_seen FROM spam_greylist 
        WHERE email_address = ? AND (account_id = ? OR account_id IS NULL)
        LIMIT 1
      `).get(senderEmail.toLowerCase(), email.accountId) as any

      if (existing) {
        // Update last_seen
        this.db.prepare(`
          UPDATE spam_greylist 
          SET last_seen = ? 
          WHERE id = ?
        `).run(now, existing.id)
      } else {
        // Create new entry
        const id = randomUUID()
        this.db.prepare(`
          INSERT INTO spam_greylist (id, account_id, email_address, domain, first_seen, last_seen, block_until)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, email.accountId, senderEmail.toLowerCase(), domain?.toLowerCase() || null, now, now, null)
      }

      return false
    } catch (error) {
      console.error('Error in checkGreylist:', error)
      return false
    }
  }

  /**
   * Calculate overall spam score (0.0-1.0)
   */
  async calculateSpamScore(email: Email): Promise<number> {
    let score = 0.0

    // Check online blacklists (weight: 0.5)
    const isBlacklisted = await this.checkBlacklist(email)
    if (isBlacklisted) {
      score += 0.5
    }

    // Check local blacklist (weight: 0.3)
    const isLocalBlacklisted = this.checkLocalBlacklist(email)
    if (isLocalBlacklisted) {
      score += 0.3
    }

    // Analyze headers (weight: 0.2)
    const headerScore = this.analyzeHeaders(email)
    score += headerScore * 0.2

    // Content analysis (basic)
    const contentScore = this.analyzeContent(email)
    score += contentScore * 0.1

    // Check greylist (weight: 0.1)
    const isGreylisted = this.checkGreylist(email)
    if (isGreylisted) {
      score += 0.1
    }

    return Math.max(0, Math.min(1, score)) // Clamp between 0 and 1
  }

  /**
   * Basic content analysis
   */
  private analyzeContent(email: Email): number {
    let score = 0.0
    const subject = (email.subject || '').toLowerCase()
    const body = ((email.body || '') + ' ' + (email.textBody || '')).toLowerCase()

    // Suspicious subject patterns
    const suspiciousSubjects = [
      'urgent', 'act now', 'limited time', 'click here', 'free money',
      'winner', 'congratulations', 'prize', 'claim your', 'verify your account'
    ]
    for (const pattern of suspiciousSubjects) {
      if (subject.includes(pattern)) {
        score += 0.05
      }
    }

    // Suspicious body patterns
    const suspiciousBody = [
      'click here', 'act now', 'limited offer', 'buy now', 'discount',
      'free trial', 'unsubscribe', 'opt out'
    ]
    for (const pattern of suspiciousBody) {
      if (body.includes(pattern)) {
        score += 0.02
      }
    }

    // Excessive capitalization
    if (subject.length > 0) {
      const capsRatio = (subject.match(/[A-Z]/g) || []).length / subject.length
      if (capsRatio > 0.5 && subject.length > 10) {
        score += 0.05
      }
    }

    return Math.min(0.3, score) // Cap content score at 0.3
  }

  /**
   * Determine if email should be auto-moved to spam folder
   */
  async shouldAutoMoveToSpam(email: Email, threshold: number = 0.7): Promise<boolean> {
    const score = await this.calculateSpamScore(email)
    return score >= threshold
  }

  /**
   * Add sender to blacklist
   */
  addToBlacklist(accountId: string | null, emailAddress: string, domain: string | null, reason?: string): void {
    try {
      const id = randomUUID()
      const now = Date.now()
      
      this.db.prepare(`
        INSERT OR REPLACE INTO spam_blacklist (id, account_id, email_address, domain, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, accountId, emailAddress.toLowerCase(), domain?.toLowerCase() || null, reason || null, now)
    } catch (error) {
      console.error('Error adding to blacklist:', error)
      throw error
    }
  }

  /**
   * Remove sender from blacklist
   */
  removeFromBlacklist(emailAddress: string, accountId?: string): void {
    try {
      if (accountId) {
        this.db.prepare(`
          DELETE FROM spam_blacklist 
          WHERE email_address = ? AND account_id = ?
        `).run(emailAddress.toLowerCase(), accountId)
      } else {
        this.db.prepare(`
          DELETE FROM spam_blacklist 
          WHERE email_address = ?
        `).run(emailAddress.toLowerCase())
      }
    } catch (error) {
      console.error('Error removing from blacklist:', error)
      throw error
    }
  }

  /**
   * Update spam score in database
   */
  updateSpamScore(emailId: string, score: number): void {
    try {
      const now = Date.now()
      this.db.prepare(`
        UPDATE emails 
        SET spam_score = ?, spam_checked_at = ?
        WHERE id = ?
      `).run(score, now, emailId)
    } catch (error) {
      console.error('Error updating spam score:', error)
      throw error
    }
  }
}

// Export singleton instance
export const spamDetector = new SpamDetector()

