"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.encryptBuffer = encryptBuffer;
exports.decryptBuffer = decryptBuffer;
exports.encryptCredential = encryptCredential;
exports.decryptCredential = decryptCredential;
const electron_1 = require("electron");
const crypto = __importStar(require("crypto"));
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
// Get encryption key from Electron's safeStorage or generate one
let encryptionKey = null;
function getEncryptionKey() {
    if (encryptionKey) {
        return encryptionKey;
    }
    // Try to use Electron's safeStorage if available
    if (electron_1.safeStorage.isEncryptionAvailable()) {
        // For now, we'll generate a key and store it encrypted
        // In production, you'd want to derive this from user input or secure storage
        const keyData = electron_1.safeStorage.encryptString('imail-encryption-key');
        // This is a simplified approach - in production, use proper key derivation
        encryptionKey = crypto.scryptSync(keyData.toString('hex'), 'imail-salt', 32);
    }
    else {
        // Fallback: generate a key (less secure, but works)
        // In production, prompt user for password and derive key
        encryptionKey = crypto.scryptSync('default-key-change-in-production', 'imail-salt', 32);
    }
    return encryptionKey;
}
function encrypt(text) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    // Return: iv:tag:encrypted
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}
function decrypt(encryptedData) {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
function encryptBuffer(buffer) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(buffer),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    // Return: iv + tag + encrypted
    return Buffer.concat([iv, tag, encrypted]);
}
function decryptBuffer(encryptedBuffer) {
    const key = getEncryptionKey();
    const iv = encryptedBuffer.subarray(0, IV_LENGTH);
    const tag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = encryptedBuffer.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);
    return decrypted;
}
// Helper to encrypt credentials using Electron's safeStorage when available
function encryptCredential(credential) {
    if (electron_1.safeStorage.isEncryptionAvailable()) {
        return electron_1.safeStorage.encryptString(credential).toString('base64');
    }
    // Fallback to our encryption
    return encrypt(credential);
}
function decryptCredential(encryptedCredential) {
    if (electron_1.safeStorage.isEncryptionAvailable()) {
        try {
            return electron_1.safeStorage.decryptString(Buffer.from(encryptedCredential, 'base64'));
        }
        catch {
            // If it fails, try our encryption
            return decrypt(encryptedCredential);
        }
    }
    return decrypt(encryptedCredential);
}
