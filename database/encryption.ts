import { safeStorage } from 'electron'
import * as crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16

// Get encryption key from Electron's safeStorage or generate one
let encryptionKey: Buffer | null = null

function getEncryptionKey(): Buffer {
  if (encryptionKey) {
    return encryptionKey
  }
  
  // Try to use Electron's safeStorage if available
  if (safeStorage.isEncryptionAvailable()) {
    // For now, we'll generate a key and store it encrypted
    // In production, you'd want to derive this from user input or secure storage
    const keyData = safeStorage.encryptString('imail-encryption-key')
    // This is a simplified approach - in production, use proper key derivation
    encryptionKey = crypto.scryptSync(keyData.toString('hex'), 'imail-salt', 32)
  } else {
    // Fallback: generate a key (less secure, but works)
    // In production, prompt user for password and derive key
    encryptionKey = crypto.scryptSync('default-key-change-in-production', 'imail-salt', 32)
  }
  
  return encryptionKey
}

export function encrypt(text: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const tag = cipher.getAuthTag()
  
  // Return: iv:tag:encrypted
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey()
  const parts = encryptedData.split(':')
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }
  
  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

export function encryptBuffer(buffer: Buffer): Buffer {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  const encrypted = Buffer.concat([
    cipher.update(buffer),
    cipher.final()
  ])
  
  const tag = cipher.getAuthTag()
  
  // Return: iv + tag + encrypted
  return Buffer.concat([iv, tag, encrypted])
}

export function decryptBuffer(encryptedBuffer: Buffer): Buffer {
  const key = getEncryptionKey()
  
  const iv = encryptedBuffer.subarray(0, IV_LENGTH)
  const tag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = encryptedBuffer.subarray(IV_LENGTH + TAG_LENGTH)
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ])
  
  return decrypted
}

// Helper to encrypt credentials using Electron's safeStorage when available
export function encryptCredential(credential: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(credential).toString('base64')
  }
  // Fallback to our encryption
  return encrypt(credential)
}

export function decryptCredential(encryptedCredential: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(encryptedCredential, 'base64'))
    } catch {
      // If it fails, try our encryption
      return decrypt(encryptedCredential)
    }
  }
  return decrypt(encryptedCredential)
}

