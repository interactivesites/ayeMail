import { getDatabase } from '../database'
import type { EmailAddress } from '../shared/types'

export class ContactManager {
  private db = getDatabase()

  /**
   * Add or update a recipient contact
   */
  addOrUpdateRecipient(email: string, name?: string): void {
    const normalizedEmail = email.toLowerCase().trim()
    const now = Date.now()

    // Check if recipient exists
    const existing = this.db.prepare('SELECT * FROM recipients WHERE email = ?').get(normalizedEmail) as any

    if (existing) {
      // Update existing recipient
      const newUseCount = (existing.use_count || 1) + 1
      const updateName = name && name.trim() ? name.trim() : existing.name
      
      this.db.prepare(`
        UPDATE recipients 
        SET name = ?,
            last_used = ?,
            use_count = ?,
            updated_at = ?
        WHERE email = ?
      `).run(updateName, now, newUseCount, now, normalizedEmail)
    } else {
      // Insert new recipient
      this.db.prepare(`
        INSERT INTO recipients (email, name, last_used, use_count, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
      `).run(normalizedEmail, name?.trim() || null, now, now, now)
    }
  }

  /**
   * Extract and store contacts from email addresses
   */
  extractContactsFromAddresses(addresses: EmailAddress[]): void {
    if (!addresses || addresses.length === 0) return

    addresses.forEach(addr => {
      if (
        addr.address &&
        !/no[-_]?reply/i.test(addr.address)
      ) {
        this.addOrUpdateRecipient(addr.address, addr.name)
      }
    })
  }

  /**
   * Search recipients by email or name
   */
  searchRecipients(query: string, limit: number = 20): Array<{ email: string; name: string | null }> {
    if (!query || query.trim().length === 0) {
      // Return most recently used if no query
      return this.db.prepare(`
        SELECT email, name 
        FROM recipients 
        ORDER BY last_used DESC, use_count DESC 
        LIMIT ?
      `).all(limit) as Array<{ email: string; name: string | null }>
    }

    const searchTerm = `%${query.toLowerCase().trim()}%`
    
    return this.db.prepare(`
      SELECT email, name 
      FROM recipients 
      WHERE email LIKE ? OR name LIKE ?
      ORDER BY use_count DESC, last_used DESC 
      LIMIT ?
    `).all(searchTerm, searchTerm, limit) as Array<{ email: string; name: string | null }>
  }

  /**
   * Get most recently used recipients
   */
  getRecipients(limit: number = 20): Array<{ email: string; name: string | null }> {
    return this.db.prepare(`
      SELECT email, name 
      FROM recipients 
      ORDER BY last_used DESC, use_count DESC 
      LIMIT ?
    `).all(limit) as Array<{ email: string; name: string | null }>
  }

  /**
   * Extract contacts from all existing emails in the database
   */
  extractContactsFromExistingEmails(): { extracted: number } {
    const emails = this.db.prepare('SELECT from_addresses, to_addresses, cc_addresses, bcc_addresses, date FROM emails').all() as any[]
    let extracted = 0

    emails.forEach(email => {
      try {
        // Extract from addresses
        if (email.from_addresses) {
          const from = JSON.parse(email.from_addresses) as EmailAddress[]
          from.forEach(addr => {
            if (addr.address) {
              this.addOrUpdateRecipient(addr.address, addr.name)
              extracted++
            }
          })
        }

        // Extract to addresses
        if (email.to_addresses) {
          const to = JSON.parse(email.to_addresses) as EmailAddress[]
          to.forEach(addr => {
            if (addr.address) {
              this.addOrUpdateRecipient(addr.address, addr.name)
              extracted++
            }
          })
        }

        // Extract cc addresses
        if (email.cc_addresses) {
          const cc = JSON.parse(email.cc_addresses) as EmailAddress[]
          cc.forEach(addr => {
            if (addr.address) {
              this.addOrUpdateRecipient(addr.address, addr.name)
              extracted++
            }
          })
        }

        // Extract bcc addresses
        if (email.bcc_addresses) {
          const bcc = JSON.parse(email.bcc_addresses) as EmailAddress[]
          bcc.forEach(addr => {
            if (addr.address) {
              this.addOrUpdateRecipient(addr.address, addr.name)
              extracted++
            }
          })
        }
      } catch (error) {
        console.error('Error extracting contacts from email:', error)
      }
    })

    return { extracted }
  }
}

export const contactManager = new ContactManager()

