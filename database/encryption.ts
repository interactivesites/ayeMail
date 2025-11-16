import { safeStorage } from 'electron'
import * as crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16

// Get encryption key - use a stable key derived from app data directory
// This avoids keychain access prompts during initialization
let encryptionKey: Buffer | null = null

function getEncryptionKey(): Buffer {
  if (encryptionKey) {
    return encryptionKey
  }
  
  // Use a stable key derived from the app's user data directory
  // This avoids triggering keychain access prompts on startup
  // The key is consistent per installation but not stored in keychain
  const { app } = require('electron')
  const userDataPath = app.getPath('userData')
  encryptionKey = crypto.scryptSync(userDataPath, 'imail-encryption-key-salt', 32)
  
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
// Only accesses keychain when actually encrypting/decrypting credentials
export function encryptCredential(credential: string): string {
  try {
    // Check if safeStorage is available without triggering keychain prompt
    // isEncryptionAvailable() doesn't trigger the prompt, only encryptString/decryptString do
    if (safeStorage.isEncryptionAvailable()) {
      // This will trigger keychain access, but only when saving credentials
      return safeStorage.encryptString(credential).toString('base64')
    }
  } catch (error) {
    // If keychain access fails or is denied, fall back to our encryption
    console.warn('SafeStorage not available, using fallback encryption:', error)
  }
  // Fallback to our encryption
  return encrypt(credential)
}

export function decryptCredential(encryptedCredential: string): string {
  try {
    // Check if safeStorage is available without triggering keychain prompt
    if (safeStorage.isEncryptionAvailable()) {
      // This will trigger keychain access, but only when loading credentials
      return safeStorage.decryptString(Buffer.from(encryptedCredential, 'base64'))
    }
  } catch (error) {
    // If keychain access fails, try our encryption fallback
    // This handles cases where user denied keychain access
  }
  // Fallback to our encryption
  return decrypt(encryptedCredential)
}

