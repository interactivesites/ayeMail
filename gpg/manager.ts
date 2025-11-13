import * as openpgp from 'openpgp'
import { getDatabase, encryption } from '../database'
import type { GPGKey } from '../shared/types'

export class GPGManager {
  private db = getDatabase()

  async listKeys(): Promise<GPGKey[]> {
    const keys = this.db.prepare('SELECT * FROM gpg_keys ORDER BY created_at DESC').all() as any[]
    return keys.map(key => ({
      id: key.id,
      fingerprint: key.fingerprint,
      userIds: JSON.parse(key.user_ids),
      createdAt: key.created_at,
      expiresAt: key.expires_at || undefined,
      isPrivate: key.is_private === 1
    }))
  }

  async importKey(keyData: string, isPrivate: boolean = false): Promise<GPGKey> {
    try {
      const keys = await openpgp.readKeys({ armoredKeys: keyData })
      if (keys.length === 0) {
        throw new Error('No keys found in key data')
      }

      const key = keys[0]
      const fingerprint = key.getFingerprint()
      const userIds = key.getUserIDs()

      // Check if key already exists
      const existing = this.db.prepare('SELECT id FROM gpg_keys WHERE fingerprint = ?')
        .get(fingerprint) as any

      if (existing) {
        // Update existing key
        const keyDataEncrypted = encryption.encrypt(keyData)
        this.db.prepare(`
          UPDATE gpg_keys 
          SET user_ids = ?, key_data_encrypted = ?, is_private = ?, updated_at = ?
          WHERE id = ?
        `).run(
          JSON.stringify(userIds),
          keyDataEncrypted,
          isPrivate ? 1 : 0,
          Date.now(),
          existing.id
        )
        return {
          id: existing.id,
          fingerprint,
          userIds,
          createdAt: Date.now(),
          isPrivate
        }
      } else {
        // Insert new key
        const id = crypto.randomUUID()
        const keyDataEncrypted = encryption.encrypt(keyData)
        // @ts-ignore - openpgp API
        const expiresAt = (await key.getExpirationTime())?.getTime() || null

        this.db.prepare(`
          INSERT INTO gpg_keys (id, fingerprint, user_ids, key_data_encrypted, created_at, expires_at, is_private)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          fingerprint,
          JSON.stringify(userIds),
          keyDataEncrypted,
          Date.now(),
          expiresAt,
          isPrivate ? 1 : 0
        )

        return {
          id,
          fingerprint,
          userIds,
          createdAt: Date.now(),
          expiresAt: expiresAt || undefined,
          isPrivate
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to import key: ${error.message}`)
    }
  }

  async encrypt(data: string, recipientFingerprints: string[]): Promise<string> {
    if (recipientFingerprints.length === 0) {
      throw new Error('At least one recipient key is required')
    }

    // Load recipient keys from database
    const placeholders = recipientFingerprints.map(() => '?').join(',')
    const keys = this.db.prepare(`
      SELECT key_data_encrypted FROM gpg_keys 
      WHERE fingerprint IN (${placeholders}) AND is_private = 0
    `).all(...recipientFingerprints) as any[]

    if (keys.length === 0) {
      throw new Error('No valid recipient keys found')
    }

    // Decrypt and parse keys
    const publicKeys = await Promise.all(
      keys.map(async (key) => {
        const keyData = encryption.decrypt(key.key_data_encrypted)
        const parsed = await openpgp.readKey({ armoredKey: keyData })
        return parsed
      })
    )

    // Encrypt message
    const encrypted = await openpgp.encrypt({
      message: await openpgp.createMessage({ text: data }),
      encryptionKeys: publicKeys
    })

    return encrypted as string
  }

  async decrypt(encryptedData: string, privateKeyFingerprint: string, passphrase?: string): Promise<string> {
    // Load private key from database
    const keyData = this.db.prepare(`
      SELECT key_data_encrypted FROM gpg_keys 
      WHERE fingerprint = ? AND is_private = 1
    `).get(privateKeyFingerprint) as any

    if (!keyData) {
      throw new Error('Private key not found')
    }

    const privateKeyArmored = encryption.decrypt(keyData.key_data_encrypted)
    const privateKey = await openpgp.readPrivateKey({ 
      armoredKey: privateKeyArmored,
      config: { allowInsecureDecryptionWithSigningKeys: true }
    })

    if (passphrase) {
      // @ts-ignore - openpgp types may not be complete
      await privateKey.decrypt(passphrase)
    }

    const message = await openpgp.readMessage({ armoredMessage: encryptedData })
    const { data: decrypted } = await openpgp.decrypt({
      message,
      decryptionKeys: privateKey
    })

    return decrypted as string
  }

  async sign(data: string, privateKeyFingerprint: string, passphrase?: string): Promise<string> {
    // Load private key from database
    const keyData = this.db.prepare(`
      SELECT key_data_encrypted FROM gpg_keys 
      WHERE fingerprint = ? AND is_private = 1
    `).get(privateKeyFingerprint) as any

    if (!keyData) {
      throw new Error('Private key not found')
    }

    const privateKeyArmored = encryption.decrypt(keyData.key_data_encrypted)
    const privateKey = await openpgp.readPrivateKey({ 
      armoredKey: privateKeyArmored,
      config: { allowInsecureDecryptionWithSigningKeys: true }
    })

    if (passphrase) {
      // @ts-ignore - openpgp types may not be complete
      await privateKey.decrypt(passphrase)
    }

    const message = await openpgp.createMessage({ text: data })
    const signature = await openpgp.sign({
      message,
      signingKeys: privateKey
    })

    return signature as string
  }

  async verify(data: string, signature: string, publicKeyFingerprint?: string): Promise<{
    verified: boolean
    keyId?: string
    userIds?: string[]
  }> {
    try {
      let publicKeys: openpgp.Key[] = []

      if (publicKeyFingerprint) {
        // Load specific public key
        const keyData = this.db.prepare(`
          SELECT key_data_encrypted FROM gpg_keys 
          WHERE fingerprint = ? AND is_private = 0
        `).get(publicKeyFingerprint) as any

        if (!keyData) {
          return { verified: false }
        }

        const keyArmored = encryption.decrypt(keyData.key_data_encrypted)
        const key = await openpgp.readKey({ armoredKey: keyArmored })
        publicKeys = [key]
      } else {
        // Try to verify with any available public key
        const keys = this.db.prepare('SELECT key_data_encrypted FROM gpg_keys WHERE is_private = 0')
          .all() as any[]

        publicKeys = await Promise.all(
          keys.map(async (key) => {
            const keyArmored = encryption.decrypt(key.key_data_encrypted)
            return await openpgp.readKey({ armoredKey: keyArmored })
          })
        )
      }

      const message = await openpgp.createMessage({ text: data })
      const signatureObj = await openpgp.readSignature({ armoredSignature: signature })

      const verificationResult = await openpgp.verify({
        message,
        signature: signatureObj,
        verificationKeys: publicKeys
      })

      const verification = await verificationResult.signatures[0].verified
      const verified = verification === true

      if (verified) {
        const keyID = verificationResult.signatures[0].keyID
        const key = publicKeys.find(k => k.getKeyID().equals(keyID))
        return {
          verified: true,
          keyId: keyID.toHex(),
          userIds: key ? key.getUserIDs() : undefined
        }
      }

      return { verified: false }
    } catch (error) {
      return { verified: false }
    }
  }

  async generateKey(userId: string, passphrase?: string): Promise<GPGKey> {
    const { privateKey, publicKey } = await openpgp.generateKey({
      type: 'rsa',
      rsaBits: 4096,
      userIDs: [{ name: userId }],
      passphrase: passphrase
    })

    // Import both keys
    await this.importKey(privateKey, true)
    return await this.importKey(publicKey, false)
  }
}

export const gpgManager = new GPGManager()

