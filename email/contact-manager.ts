import { getDatabase } from '../database'
import type { EmailAddress } from '../shared/types'

export class ContactManager {
  private db = getDatabase()

  /**
   * Check if a folder is a spam/junk folder
   */
  private isSpamFolder(folderId: string): boolean {
    const folder = this.db.prepare('SELECT name, path FROM folders WHERE id = ?').get(folderId) as any
    if (!folder) return false
    
    const nameLower = folder.name?.toLowerCase() || ''
    const pathLower = folder.path?.toLowerCase() || ''
    
    return nameLower === 'spam' || 
           nameLower === 'junk' || 
           pathLower.includes('spam') || 
           pathLower.includes('junk')
  }

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
   * @param addresses - Email addresses to extract
   * @param skipIfSpamFolder - Optional folder ID to check if it's spam (skip extraction if spam)
   */
  extractContactsFromAddresses(addresses: EmailAddress[], skipIfSpamFolder?: string): void {
    if (!addresses || addresses.length === 0) return

    // Skip if folder is spam
    if (skipIfSpamFolder && this.isSpamFolder(skipIfSpamFolder)) {
      return
    }

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
   * Remove contacts that came from spam emails
   * This is a cleanup method to remove contacts that were added before spam filtering was implemented
   */
  removeContactsFromSpamEmails(): { removed: number } {
    // Find all emails in spam folders and get their addresses
    const spamEmails = this.db.prepare(`
      SELECT e.from_addresses, e.to_addresses, e.cc_addresses, e.bcc_addresses
      FROM emails e
      INNER JOIN folders f ON e.folder_id = f.id
      WHERE LOWER(f.name) = 'spam' OR LOWER(f.name) = 'junk' OR LOWER(f.path) LIKE '%spam%' OR LOWER(f.path) LIKE '%junk%'
    `).all() as any[]

    const spamAddresses = new Set<string>()
    
    spamEmails.forEach(email => {
      try {
        // Extract all addresses from spam emails
        if (email.from_addresses) {
          const from = JSON.parse(email.from_addresses) as EmailAddress[]
          from.forEach(addr => {
            if (addr.address) {
              spamAddresses.add(addr.address.toLowerCase().trim())
            }
          })
        }
        if (email.to_addresses) {
          const to = JSON.parse(email.to_addresses) as EmailAddress[]
          to.forEach(addr => {
            if (addr.address) {
              spamAddresses.add(addr.address.toLowerCase().trim())
            }
          })
        }
        if (email.cc_addresses) {
          const cc = JSON.parse(email.cc_addresses) as EmailAddress[]
          cc.forEach(addr => {
            if (addr.address) {
              spamAddresses.add(addr.address.toLowerCase().trim())
            }
          })
        }
        if (email.bcc_addresses) {
          const bcc = JSON.parse(email.bcc_addresses) as EmailAddress[]
          bcc.forEach(addr => {
            if (addr.address) {
              spamAddresses.add(addr.address.toLowerCase().trim())
            }
          })
        }
      } catch (error) {
        console.error('Error parsing spam email addresses:', error)
      }
    })

    // Remove contacts that match spam addresses
    let removed = 0
    spamAddresses.forEach(email => {
      const result = this.db.prepare('DELETE FROM recipients WHERE email = ?').run(email)
      if (result.changes > 0) {
        removed++
      }
    })

    return { removed }
  }

  /**
   * Extract contacts from all existing emails in the database
   * Skips emails in spam folders
   */
  extractContactsFromExistingEmails(): { extracted: number } {
    // Get all emails with their folder_id to check for spam
    const emails = this.db.prepare(`
      SELECT e.from_addresses, e.to_addresses, e.cc_addresses, e.bcc_addresses, e.folder_id, f.name as folder_name, f.path as folder_path
      FROM emails e
      LEFT JOIN folders f ON e.folder_id = f.id
    `).all() as any[]
    let extracted = 0

    emails.forEach(email => {
      try {
        // Skip if email is in a spam folder
        const folderNameLower = email.folder_name?.toLowerCase() || ''
        const folderPathLower = email.folder_path?.toLowerCase() || ''
        const isSpam = folderNameLower === 'spam' || 
                       folderNameLower === 'junk' || 
                       folderPathLower.includes('spam') || 
                       folderPathLower.includes('junk')
        
        if (isSpam) {
          return // Skip this email
        }

        // Extract from addresses
        if (email.from_addresses) {
          const from = JSON.parse(email.from_addresses) as EmailAddress[]
          from.forEach(addr => {
            if (addr.address && !/no[-_]?reply/i.test(addr.address)) {
              this.addOrUpdateRecipient(addr.address, addr.name)
              extracted++
            }
          })
        }

        // Extract to addresses
        if (email.to_addresses) {
          const to = JSON.parse(email.to_addresses) as EmailAddress[]
          to.forEach(addr => {
            if (addr.address && !/no[-_]?reply/i.test(addr.address)) {
              this.addOrUpdateRecipient(addr.address, addr.name)
              extracted++
            }
          })
        }

        // Extract cc addresses
        if (email.cc_addresses) {
          const cc = JSON.parse(email.cc_addresses) as EmailAddress[]
          cc.forEach(addr => {
            if (addr.address && !/no[-_]?reply/i.test(addr.address)) {
              this.addOrUpdateRecipient(addr.address, addr.name)
              extracted++
            }
          })
        }

        // Extract bcc addresses
        if (email.bcc_addresses) {
          const bcc = JSON.parse(email.bcc_addresses) as EmailAddress[]
          bcc.forEach(addr => {
            if (addr.address && !/no[-_]?reply/i.test(addr.address)) {
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

