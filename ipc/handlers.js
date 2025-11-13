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
exports.registerAccountHandlers = registerAccountHandlers;
exports.registerFolderHandlers = registerFolderHandlers;
exports.registerEmailHandlers = registerEmailHandlers;
exports.registerReminderHandlers = registerReminderHandlers;
exports.registerSignatureHandlers = registerSignatureHandlers;
exports.registerGPGHandlers = registerGPGHandlers;
exports.registerAllHandlers = registerAllHandlers;
const electron_1 = require("electron");
const crypto_1 = require("crypto");
const database_1 = require("../database");
const email_1 = require("../email");
// Account handlers
function registerAccountHandlers() {
    electron_1.ipcMain.handle('accounts:list', async () => {
        const db = (0, database_1.getDatabase)();
        const accounts = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all();
        return accounts.map((acc) => ({
            ...acc,
            password_encrypted: undefined, // Don't send encrypted passwords
            oauth2_access_token_encrypted: undefined,
            oauth2_refresh_token_encrypted: undefined
        }));
    });
    electron_1.ipcMain.handle('accounts:add', async (_, account) => {
        const db = (0, database_1.getDatabase)();
        const id = (0, crypto_1.randomUUID)();
        const now = Date.now();
        const stmt = db.prepare(`
      INSERT INTO accounts (
        id, name, email, type, imap_host, imap_port, imap_secure,
        pop3_host, pop3_port, pop3_secure, smtp_host, smtp_port, smtp_secure,
        auth_type, oauth2_provider, oauth2_access_token_encrypted,
        oauth2_refresh_token_encrypted, oauth2_expires_at, password_encrypted,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, account.name, account.email, account.type, account.imap?.host || null, account.imap?.port || null, account.imap?.secure ? 1 : 0, account.pop3?.host || null, account.pop3?.port || null, account.pop3?.secure ? 1 : 0, account.smtp.host, account.smtp.port, account.smtp.secure ? 1 : 0, account.authType, account.oauth2?.provider || null, account.oauth2?.accessToken ? database_1.encryption.encryptCredential(account.oauth2.accessToken) : null, account.oauth2?.refreshToken ? database_1.encryption.encryptCredential(account.oauth2.refreshToken) : null, account.oauth2?.expiresAt || null, null, // Password will be handled separately if needed
        now, now);
        return { id, ...account };
    });
    electron_1.ipcMain.handle('accounts:update', async (_, id, account) => {
        const db = (0, database_1.getDatabase)();
        const now = Date.now();
        // Build dynamic update query
        const updates = [];
        const values = [];
        if (account.name) {
            updates.push('name = ?');
            values.push(account.name);
        }
        if (account.email) {
            updates.push('email = ?');
            values.push(account.email);
        }
        if (account.oauth2?.accessToken) {
            updates.push('oauth2_access_token_encrypted = ?');
            values.push(database_1.encryption.encryptCredential(account.oauth2.accessToken));
        }
        if (account.oauth2?.refreshToken) {
            updates.push('oauth2_refresh_token_encrypted = ?');
            values.push(database_1.encryption.encryptCredential(account.oauth2.refreshToken));
        }
        updates.push('updated_at = ?');
        values.push(now);
        values.push(id);
        const stmt = db.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`);
        stmt.run(...values);
        return { success: true };
    });
    electron_1.ipcMain.handle('accounts:remove', async (_, id) => {
        const db = (0, database_1.getDatabase)();
        db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
        return { success: true };
    });
    electron_1.ipcMain.handle('accounts:test', async (_, account) => {
        const { testAccountConnection } = await Promise.resolve().then(() => __importStar(require('../email/connection-tester')));
        return testAccountConnection(account.id);
    });
}
// Folder handlers
function registerFolderHandlers() {
    electron_1.ipcMain.handle('folders:list', async (_, accountId) => {
        const db = (0, database_1.getDatabase)();
        const account = await email_1.accountManager.getAccount(accountId);
        if (!account) {
            throw new Error('Account not found');
        }
        // Sync folders from IMAP server
        if (account.type === 'imap') {
            try {
                const imapClient = (0, email_1.getIMAPClient)(account);
                await imapClient.connect();
                const serverFolders = await imapClient.listFolders();
                // Update database with server folders
                const now = Date.now();
                for (const folder of serverFolders) {
                    const existing = db.prepare('SELECT id FROM folders WHERE account_id = ? AND path = ?').get(accountId, folder.path);
                    if (!existing) {
                        const id = (0, crypto_1.randomUUID)();
                        db.prepare(`
              INSERT INTO folders (id, account_id, name, path, subscribed, attributes, created_at, updated_at)
              VALUES (?, ?, ?, ?, 1, ?, ?, ?)
            `).run(id, accountId, folder.name, folder.path, JSON.stringify(folder.attributes), now, now);
                    }
                    else {
                        db.prepare('UPDATE folders SET name = ?, attributes = ?, updated_at = ? WHERE id = ?')
                            .run(folder.name, JSON.stringify(folder.attributes), now, existing.id);
                    }
                }
                await imapClient.disconnect();
            }
            catch (error) {
                console.error('Error syncing folders:', error);
            }
        }
        return db.prepare('SELECT * FROM folders WHERE account_id = ? ORDER BY name').all(accountId);
    });
    electron_1.ipcMain.handle('folders:create', async (_, accountId, name) => {
        const db = (0, database_1.getDatabase)();
        const account = await email_1.accountManager.getAccount(accountId);
        if (!account || account.type !== 'imap') {
            throw new Error('Account not found or not IMAP');
        }
        const imapClient = (0, email_1.getIMAPClient)(account);
        await imapClient.connect();
        await imapClient.createFolder(name);
        await imapClient.disconnect();
        const id = (0, crypto_1.randomUUID)();
        const now = Date.now();
        db.prepare(`
      INSERT INTO folders (id, account_id, name, path, subscribed, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(id, accountId, name, name, now, now);
        return { id, accountId, name, path: name, subscribed: true };
    });
    electron_1.ipcMain.handle('folders:delete', async (_, accountId, name) => {
        const db = (0, database_1.getDatabase)();
        const account = await email_1.accountManager.getAccount(accountId);
        if (!account || account.type !== 'imap') {
            throw new Error('Account not found or not IMAP');
        }
        const imapClient = (0, email_1.getIMAPClient)(account);
        await imapClient.connect();
        await imapClient.deleteFolder(name);
        await imapClient.disconnect();
        db.prepare('DELETE FROM folders WHERE account_id = ? AND name = ?').run(accountId, name);
        return { success: true };
    });
    electron_1.ipcMain.handle('folders:rename', async (_, accountId, oldName, newName) => {
        const db = (0, database_1.getDatabase)();
        const account = await email_1.accountManager.getAccount(accountId);
        if (!account || account.type !== 'imap') {
            throw new Error('Account not found or not IMAP');
        }
        const imapClient = (0, email_1.getIMAPClient)(account);
        await imapClient.connect();
        await imapClient.renameFolder(oldName, newName);
        await imapClient.disconnect();
        db.prepare('UPDATE folders SET name = ?, path = ?, updated_at = ? WHERE account_id = ? AND name = ?')
            .run(newName, newName, Date.now(), accountId, oldName);
        return { success: true };
    });
    electron_1.ipcMain.handle('folders:subscribe', async (_, accountId, name, subscribed) => {
        const db = (0, database_1.getDatabase)();
        const account = await email_1.accountManager.getAccount(accountId);
        if (!account || account.type !== 'imap') {
            throw new Error('Account not found or not IMAP');
        }
        const imapClient = (0, email_1.getIMAPClient)(account);
        await imapClient.connect();
        await imapClient.subscribeFolder(name, subscribed);
        await imapClient.disconnect();
        db.prepare('UPDATE folders SET subscribed = ?, updated_at = ? WHERE account_id = ? AND name = ?')
            .run(subscribed ? 1 : 0, Date.now(), accountId, name);
        return { success: true };
    });
}
// Email handlers
function registerEmailHandlers() {
    electron_1.ipcMain.handle('emails:list', async (_, folderId, page = 0, limit = 50) => {
        const emails = await emailStorage.listEmails(folderId, page, limit);
        // Return simplified list without full body
        return emails.map(email => ({
            id: email.id,
            accountId: email.accountId,
            folderId: email.folderId,
            uid: email.uid,
            messageId: email.messageId,
            subject: email.subject,
            from: email.from,
            to: email.to,
            date: email.date,
            isRead: email.isRead,
            isStarred: email.isStarred,
            encrypted: email.encrypted,
            signed: email.signed,
            signatureVerified: email.signatureVerified
        }));
    });
    electron_1.ipcMain.handle('emails:get', async (_, id) => {
        const email = await emailStorage.getEmail(id);
        if (!email) {
            return null;
        }
        // Load attachments
        const db = (0, database_1.getDatabase)();
        const attachments = db.prepare('SELECT * FROM attachments WHERE email_id = ?').all(id);
        email.attachments = attachments.map((att) => ({
            id: att.id,
            emailId: att.email_id,
            filename: att.filename,
            contentType: att.content_type,
            size: att.size,
            contentId: att.content_id,
            data: database_1.encryption.decryptBuffer(att.data_encrypted)
        }));
        return email;
    });
    electron_1.ipcMain.handle('emails:sync', async (_, accountId) => {
        try {
            const result = await emailStorage.syncAccount(accountId);
            return {
                success: true,
                synced: result.synced,
                errors: result.errors,
                message: `Synced ${result.synced} emails${result.errors > 0 ? ` with ${result.errors} errors` : ''}`
            };
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    });
    electron_1.ipcMain.handle('emails:send', async (_, email) => {
        try {
            const account = await email_1.accountManager.getAccount(email.accountId);
            if (!account) {
                return { success: false, message: 'Account not found' };
            }
            const smtpClient = getSMTPClient(account);
            const result = await smtpClient.sendEmail({
                to: email.to,
                cc: email.cc,
                bcc: email.bcc,
                subject: email.subject,
                body: email.body,
                htmlBody: email.htmlBody,
                attachments: email.attachments,
                encrypted: email.encrypted,
                signed: email.signed
            });
            return result;
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    });
    electron_1.ipcMain.handle('emails:delete', async (_, id) => {
        const db = (0, database_1.getDatabase)();
        db.prepare('DELETE FROM emails WHERE id = ?').run(id);
        return { success: true };
    });
}
// Reminder handlers
function registerReminderHandlers() {
    electron_1.ipcMain.handle('reminders:list', async () => {
        const db = (0, database_1.getDatabase)();
        return db.prepare(`
      SELECT r.*, e.subject, e.from_addresses
      FROM reminders r
      JOIN emails e ON r.email_id = e.id
      WHERE r.completed = 0
      ORDER BY r.due_date ASC
    `).all();
    });
    electron_1.ipcMain.handle('reminders:create', async (_, reminder) => {
        const db = (0, database_1.getDatabase)();
        const id = (0, crypto_1.randomUUID)();
        const now = Date.now();
        db.prepare(`
      INSERT INTO reminders (id, email_id, account_id, due_date, message, completed, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(id, reminder.emailId, reminder.accountId, reminder.dueDate, reminder.message || null, now);
        return { id, ...reminder, completed: false, createdAt: now };
    });
    electron_1.ipcMain.handle('reminders:update', async (_, id, reminder) => {
        const db = (0, database_1.getDatabase)();
        const updates = [];
        const values = [];
        if (reminder.dueDate !== undefined) {
            updates.push('due_date = ?');
            values.push(reminder.dueDate);
        }
        if (reminder.message !== undefined) {
            updates.push('message = ?');
            values.push(reminder.message);
        }
        if (reminder.completed !== undefined) {
            updates.push('completed = ?');
            values.push(reminder.completed ? 1 : 0);
        }
        values.push(id);
        db.prepare(`UPDATE reminders SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        return { success: true };
    });
    electron_1.ipcMain.handle('reminders:delete', async (_, id) => {
        const db = (0, database_1.getDatabase)();
        db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
        return { success: true };
    });
}
// Signature handlers
function registerSignatureHandlers() {
    electron_1.ipcMain.handle('signatures:list', async (_, accountId) => {
        const db = (0, database_1.getDatabase)();
        return db.prepare('SELECT * FROM signatures WHERE account_id = ? ORDER BY is_default DESC, created_at DESC').all(accountId);
    });
    electron_1.ipcMain.handle('signatures:create', async (_, accountId, signature) => {
        const db = (0, database_1.getDatabase)();
        const id = (0, crypto_1.randomUUID)();
        const now = Date.now();
        // If this is default, unset other defaults
        if (signature.isDefault) {
            db.prepare('UPDATE signatures SET is_default = 0 WHERE account_id = ?').run(accountId);
        }
        db.prepare(`
      INSERT INTO signatures (id, account_id, name, html, text, is_default, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, accountId, signature.name, signature.html || null, signature.text || null, signature.isDefault ? 1 : 0, now);
        return { id, accountId, ...signature, createdAt: now };
    });
    electron_1.ipcMain.handle('signatures:update', async (_, id, signature) => {
        const db = (0, database_1.getDatabase)();
        const updates = [];
        const values = [];
        if (signature.name) {
            updates.push('name = ?');
            values.push(signature.name);
        }
        if (signature.html !== undefined) {
            updates.push('html = ?');
            values.push(signature.html);
        }
        if (signature.text !== undefined) {
            updates.push('text = ?');
            values.push(signature.text);
        }
        if (signature.isDefault !== undefined) {
            if (signature.isDefault) {
                // Unset other defaults for this account
                const sig = db.prepare('SELECT account_id FROM signatures WHERE id = ?').get(id);
                if (sig) {
                    db.prepare('UPDATE signatures SET is_default = 0 WHERE account_id = ?').run(sig.account_id);
                }
            }
            updates.push('is_default = ?');
            values.push(signature.isDefault ? 1 : 0);
        }
        values.push(id);
        db.prepare(`UPDATE signatures SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        return { success: true };
    });
    electron_1.ipcMain.handle('signatures:delete', async (_, id) => {
        const db = (0, database_1.getDatabase)();
        db.prepare('DELETE FROM signatures WHERE id = ?').run(id);
        return { success: true };
    });
}
// GPG handlers
function registerGPGHandlers() {
    electron_1.ipcMain.handle('gpg:listKeys', async () => {
        try {
            return await gpgManager.listKeys();
        }
        catch (error) {
            throw new Error(`Failed to list keys: ${error.message}`);
        }
    });
    electron_1.ipcMain.handle('gpg:importKey', async (_, keyData, isPrivate = false) => {
        try {
            const key = await gpgManager.importKey(keyData, isPrivate);
            return { success: true, key };
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    });
    electron_1.ipcMain.handle('gpg:encrypt', async (_, data, recipientKeys) => {
        try {
            const encrypted = await gpgManager.encrypt(data, recipientKeys);
            return { success: true, encrypted };
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    });
    electron_1.ipcMain.handle('gpg:decrypt', async (_, encryptedData, privateKeyFingerprint, passphrase) => {
        try {
            const decrypted = await gpgManager.decrypt(encryptedData, privateKeyFingerprint, passphrase);
            return { success: true, decrypted };
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    });
    electron_1.ipcMain.handle('gpg:sign', async (_, data, keyId, passphrase) => {
        try {
            const signature = await gpgManager.sign(data, keyId, passphrase);
            return { success: true, signature };
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    });
    electron_1.ipcMain.handle('gpg:verify', async (_, data, signature, publicKeyFingerprint) => {
        try {
            const result = await gpgManager.verify(data, signature, publicKeyFingerprint);
            return { success: true, ...result };
        }
        catch (error) {
            return { success: false, verified: false, message: error.message };
        }
    });
}
// Register all handlers
function registerAllHandlers() {
    registerAccountHandlers();
    registerFolderHandlers();
    registerEmailHandlers();
    registerReminderHandlers();
    registerSignatureHandlers();
    registerGPGHandlers();
}
