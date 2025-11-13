"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POP3Client = void 0;
exports.getPOP3Client = getPOP3Client;
const account_manager_1 = require("./account-manager");
// Note: The 'poplib' package has limited TypeScript support
// This is a basic implementation - POP3 support is more limited than IMAP
const Poplib = require('poplib');
class POP3Client {
    constructor(account) {
        this.connection = null;
        this.account = account;
    }
    async connect() {
        if (!this.account.pop3) {
            throw new Error('POP3 configuration missing');
        }
        const password = await account_manager_1.accountManager.getPassword(this.account.id);
        if (!password) {
            throw new Error('Password not set for account');
        }
        return new Promise((resolve, reject) => {
            this.connection = new Poplib({
                user: this.account.email,
                password: password,
                host: this.account.pop3.host,
                port: this.account.pop3.port,
                tls: this.account.pop3.secure
            });
            this.connection.on('connect', () => {
                resolve();
            });
            this.connection.on('error', (err) => {
                reject(err);
            });
            this.connection.connect();
        });
    }
    async disconnect() {
        if (this.connection) {
            this.connection.quit();
            this.connection = null;
        }
    }
    async getMessageCount() {
        await this.ensureConnected();
        return new Promise((resolve, reject) => {
            this.connection.stat((err, count) => {
                if (err)
                    reject(err);
                else
                    resolve(count);
            });
        });
    }
    async fetchEmails(start = 1, end = 50) {
        await this.ensureConnected();
        return new Promise((resolve, reject) => {
            this.connection.list((err, list) => {
                if (err) {
                    reject(err);
                    return;
                }
                const emails = [];
                const toFetch = list.slice(start - 1, end);
                let fetched = 0;
                if (toFetch.length === 0) {
                    resolve(emails);
                    return;
                }
                toFetch.forEach((item) => {
                    this.connection.retr(item.number, (retrErr, message) => {
                        if (retrErr) {
                            fetched++;
                            if (fetched === toFetch.length) {
                                resolve(emails);
                            }
                            return;
                        }
                        // Parse message (simplified - would use mailparser in production)
                        // For now, return basic structure
                        const email = {
                            id: `${this.account.id}-${item.number}`,
                            accountId: this.account.id,
                            folderId: 'INBOX',
                            uid: item.number,
                            messageId: '',
                            subject: '',
                            from: [],
                            to: [],
                            date: Date.now(),
                            body: message,
                            attachments: [],
                            flags: [],
                            isRead: false,
                            isStarred: false,
                            createdAt: Date.now(),
                            updatedAt: Date.now()
                        };
                        emails.push(email);
                        fetched++;
                        if (fetched === toFetch.length) {
                            resolve(emails);
                        }
                    });
                });
            });
        });
    }
    async ensureConnected() {
        if (!this.connection) {
            await this.connect();
        }
    }
}
exports.POP3Client = POP3Client;
function getPOP3Client(account) {
    return new POP3Client(account);
}
