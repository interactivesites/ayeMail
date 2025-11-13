"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMAPClient = void 0;
exports.getIMAPClient = getIMAPClient;
const imap_1 = __importDefault(require("imap"));
const mailparser_1 = require("mailparser");
const account_manager_1 = require("./account-manager");
const connectionPool = {};
class IMAPClient {
    constructor(account) {
        this.connection = null;
        this.account = account;
    }
    async connect() {
        if (this.connection && this.connection.state !== 'disconnected') {
            return;
        }
        if (!this.account.imap) {
            throw new Error('IMAP configuration missing');
        }
        let password = null;
        if (this.account.authType === 'password') {
            password = await account_manager_1.accountManager.getPassword(this.account.id);
            if (!password) {
                throw new Error('Password not set for account');
            }
        }
        const oauth2Token = this.account.authType === 'oauth2'
            ? await account_manager_1.accountManager.getOAuth2Token(this.account.id)
            : null;
        return new Promise((resolve, reject) => {
            this.connection = new imap_1.default({
                user: this.account.email,
                password: password || 'oauth2',
                host: this.account.imap.host,
                port: this.account.imap.port,
                tls: this.account.imap.secure,
                tlsOptions: { rejectUnauthorized: true },
                xoauth2: oauth2Token?.accessToken
            });
            this.connection.once('ready', () => {
                connectionPool[this.account.id] = this.connection;
                resolve();
            });
            this.connection.once('error', (err) => {
                reject(err);
            });
            this.connection.connect();
        });
    }
    async disconnect() {
        if (this.connection) {
            this.connection.end();
            this.connection = null;
            delete connectionPool[this.account.id];
        }
    }
    async listFolders() {
        await this.ensureConnected();
        return new Promise((resolve, reject) => {
            this.connection.once('error', reject);
            this.connection.list((err, boxes) => {
                if (err) {
                    reject(err);
                    return;
                }
                const folders = Object.keys(boxes).map(name => ({
                    name: boxes[name].name,
                    path: boxes[name].name,
                    attributes: boxes[name].attributes,
                    delimiter: boxes[name].delimiter
                }));
                resolve(folders);
            });
        });
    }
    async getFolderStatus(folderName) {
        await this.ensureConnected();
        return new Promise((resolve, reject) => {
            this.connection.once('error', reject);
            this.connection.status(folderName, (err, status) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({
                    messages: status.messages || 0,
                    unseen: status.unseen || 0
                });
            });
        });
    }
    async fetchEmails(folderName, start = 1, end = 50) {
        await this.ensureConnected();
        return new Promise((resolve, reject) => {
            this.connection.once('error', reject);
            this.connection.openBox(folderName, true, (err, box) => {
                if (err) {
                    reject(err);
                    return;
                }
                const fetch = this.connection.fetch(`${start}:${end}`, {
                    bodies: '',
                    struct: true
                });
                const emails = [];
                let emailCount = 0;
                const totalToFetch = Math.min(end - start + 1, box.messages.total);
                fetch.on('message', (msg, seqno) => {
                    let uid = null;
                    let flags = [];
                    let body = '';
                    let headers = {};
                    msg.on('body', (stream) => {
                        let buffer = '';
                        stream.on('data', (chunk) => {
                            buffer += chunk.toString('utf8');
                        });
                        stream.on('end', () => {
                            body = buffer;
                        });
                    });
                    msg.on('attributes', (attrs) => {
                        uid = attrs.uid;
                        flags = attrs.flags || [];
                    });
                    msg.once('end', async () => {
                        try {
                            const parsed = await (0, mailparser_1.simpleParser)(body);
                            const email = {
                                id: `${this.account.id}-${uid}`,
                                accountId: this.account.id,
                                folderId: folderName, // Will be mapped to folder ID later
                                uid: uid,
                                messageId: parsed.messageId || '',
                                subject: parsed.subject || '',
                                from: this.parseAddresses(parsed.from),
                                to: this.parseAddresses(parsed.to || []),
                                cc: parsed.cc ? this.parseAddresses(parsed.cc) : undefined,
                                bcc: parsed.bcc ? this.parseAddresses(parsed.bcc) : undefined,
                                replyTo: parsed.replyTo ? this.parseAddresses(parsed.replyTo) : undefined,
                                date: parsed.date ? parsed.date.getTime() : Date.now(),
                                body: parsed.html || parsed.text || '',
                                htmlBody: parsed.html,
                                textBody: parsed.text,
                                attachments: parsed.attachments?.map(att => ({
                                    id: `${this.account.id}-${uid}-${att.filename}`,
                                    emailId: `${this.account.id}-${uid}`,
                                    filename: att.filename || 'attachment',
                                    contentType: att.contentType || 'application/octet-stream',
                                    size: att.size || 0,
                                    contentId: att.contentId,
                                    data: att.content
                                })) || [],
                                flags: flags,
                                isRead: flags.includes('\\Seen'),
                                isStarred: flags.includes('\\Flagged'),
                                threadId: parsed.inReplyTo || undefined,
                                inReplyTo: parsed.inReplyTo || undefined,
                                references: parsed.references ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references]) : undefined,
                                encrypted: false, // Will be determined by GPG parsing
                                signed: false,
                                signatureVerified: undefined,
                                createdAt: Date.now(),
                                updatedAt: Date.now()
                            };
                            emails.push(email);
                            emailCount++;
                            if (emailCount === totalToFetch) {
                                resolve(emails);
                            }
                        }
                        catch (parseErr) {
                            console.error('Error parsing email:', parseErr);
                            emailCount++;
                            if (emailCount === totalToFetch) {
                                resolve(emails);
                            }
                        }
                    });
                });
                fetch.once('error', reject);
            });
        });
    }
    async createFolder(folderName) {
        await this.ensureConnected();
        return new Promise((resolve, reject) => {
            this.connection.addBox(folderName, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async deleteFolder(folderName) {
        await this.ensureConnected();
        return new Promise((resolve, reject) => {
            this.connection.delBox(folderName, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async renameFolder(oldName, newName) {
        await this.ensureConnected();
        return new Promise((resolve, reject) => {
            this.connection.renameBox(oldName, newName, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async subscribeFolder(folderName, subscribed) {
        await this.ensureConnected();
        return new Promise((resolve, reject) => {
            if (subscribed) {
                this.connection.subscribeBox(folderName, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            }
            else {
                this.connection.unsubscribeBox(folderName, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            }
        });
    }
    async ensureConnected() {
        if (!this.connection || this.connection.state === 'disconnected') {
            await this.connect();
        }
    }
    parseAddresses(addresses) {
        if (!addresses)
            return [];
        if (Array.isArray(addresses)) {
            return addresses.map(addr => ({
                name: addr.name,
                address: addr.address
            }));
        }
        return [{
                name: addresses.name,
                address: addresses.address
            }];
    }
}
exports.IMAPClient = IMAPClient;
function getIMAPClient(account) {
    return new IMAPClient(account);
}
