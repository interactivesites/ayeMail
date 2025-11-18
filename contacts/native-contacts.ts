import type { EmailAddress } from '../shared/types'

export interface NativeContact {
  email: string
  name?: string
  phone?: string
}

/**
 * Get native contacts from macOS Contacts app
 */
async function getMacContacts(): Promise<NativeContact[]> {
  try {
    // Dynamic import to avoid errors on non-macOS platforms
    const macContacts = await import('node-mac-contacts')
    
    // Request access permission
    const authorized = await macContacts.requestAccess()
    if (!authorized) {
      console.warn('macOS Contacts access denied')
      return []
    }

    // Get all contacts
    const contacts = await macContacts.getAllContacts()
    const result: NativeContact[] = []

    for (const contact of contacts) {
      // Extract email addresses
      if (contact.emailAddresses && contact.emailAddresses.length > 0) {
        for (const email of contact.emailAddresses) {
          if (email && typeof email === 'string') {
            result.push({
              email: email.toLowerCase().trim(),
              name: contact.firstName || contact.lastName 
                ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || undefined
                : undefined,
              phone: contact.phoneNumbers?.[0] || undefined
            })
          }
        }
      }
    }

    return result
  } catch (error) {
    console.error('Error getting macOS contacts:', error)
    return []
  }
}

/**
 * Get native contacts from Windows Contacts
 */
async function getWindowsContacts(): Promise<NativeContact[]> {
  try {
    const { readdir, readFile } = await import('fs/promises')
    const { join } = await import('path')
    const { homedir } = await import('os')
    const { parseStringPromise } = await import('xml2js')

    const contactsPath = join(homedir(), 'Contacts')
    const result: NativeContact[] = []

    try {
      const files = await readdir(contactsPath)
      const contactFiles = files.filter(f => f.endsWith('.contact'))

      for (const file of contactFiles) {
        try {
          const filePath = join(contactsPath, file)
          const xmlContent = await readFile(filePath, 'utf-8')
          const parsed = await parseStringPromise(xmlContent, {
            explicitArray: false,
            mergeAttrs: true
          })

          // Windows .contact files have a specific XML structure
          // The root element is usually "Contact" or "contact"
          const contact = parsed.Contact || parsed.contact || parsed
          if (!contact) continue

          const emails: string[] = []
          let name: string | undefined

          // Extract email addresses - can be in EmailAddress or EmailAddressCollection
          const extractEmail = (emailData: any): void => {
            if (!emailData) return
            if (typeof emailData === 'string') {
              const email = emailData.toLowerCase().trim()
              if (email && email.includes('@')) {
                emails.push(email)
              }
            } else if (Array.isArray(emailData)) {
              emailData.forEach(extractEmail)
            } else if (emailData._) {
              extractEmail(emailData._)
            } else if (emailData.Address) {
              extractEmail(emailData.Address)
            }
          }

          if (contact.EmailAddress) {
            extractEmail(contact.EmailAddress)
          }
          if (contact.EmailAddressCollection) {
            const collection = Array.isArray(contact.EmailAddressCollection)
              ? contact.EmailAddressCollection
              : [contact.EmailAddressCollection]
            collection.forEach((item: any) => {
              if (item.EmailAddress) {
                extractEmail(item.EmailAddress)
              } else {
                extractEmail(item)
              }
            })
          }

          // Extract name - try DisplayName first, then FirstName/LastName
          if (contact.DisplayName) {
            const displayName = Array.isArray(contact.DisplayName) 
              ? contact.DisplayName[0] 
              : contact.DisplayName
            if (typeof displayName === 'string' && displayName.trim()) {
              name = displayName.trim()
            } else if (displayName && typeof displayName === 'object' && displayName._) {
              name = displayName._.trim()
            }
          }
          
          if (!name && (contact.FirstName || contact.LastName)) {
            const firstName = Array.isArray(contact.FirstName) 
              ? contact.FirstName[0] 
              : contact.FirstName
            const lastName = Array.isArray(contact.LastName)
              ? contact.LastName[0]
              : contact.LastName
            const firstNameStr = typeof firstName === 'string' 
              ? firstName 
              : (firstName?._ || '')
            const lastNameStr = typeof lastName === 'string'
              ? lastName
              : (lastName?._ || '')
            const fullName = `${firstNameStr} ${lastNameStr}`.trim()
            if (fullName) {
              name = fullName
            }
          }

          // Create contact entries for each email
          if (emails.length > 0) {
            emails.forEach(email => {
              result.push({
                email,
                name: name || undefined
              })
            })
          }
        } catch (fileError) {
          console.error(`Error parsing contact file ${file}:`, fileError)
          // Continue with next file
        }
      }
    } catch (dirError: any) {
      // Contacts directory might not exist
      if (dirError.code !== 'ENOENT') {
        console.error('Error reading Windows Contacts directory:', dirError)
      }
    }

    return result
  } catch (error) {
    console.error('Error getting Windows contacts:', error)
    return []
  }
}

/**
 * Get native contacts from the system (platform-specific)
 */
export async function getNativeContacts(): Promise<NativeContact[]> {
  const platform = process.platform

  if (platform === 'darwin') {
    return getMacContacts()
  } else if (platform === 'win32') {
    return getWindowsContacts()
  } else {
    // Linux or other platforms - not supported yet
    console.warn(`Native contacts not supported on platform: ${platform}`)
    return []
  }
}

/**
 * Check if native contacts are available on this platform
 */
export function isNativeContactsAvailable(): boolean {
  return process.platform === 'darwin' || process.platform === 'win32'
}

