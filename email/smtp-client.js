"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMTPClient = void 0;
exports.getSMTPClient = getSMTPClient;
const nodemailer_1 = __importDefault(require("nodemailer"));
const account_manager_1 = require("./account-manager");
class SMTPClient {
    constructor(account) {
        this.transporter = null;
        this.account = account;
    }
    async initialize() {
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
        const auth = this.account.authType === 'oauth2' && oauth2Token
            ? {
                type: 'OAuth2',
                user: this.account.email,
                clientId: process.env[`${this.account.oauth2?.provider?.toUpperCase()}_CLIENT_ID`] || '',
                clientSecret: process.env[`${this.account.oauth2?.provider?.toUpperCase()}_CLIENT_SECRET`] || '',
                refreshToken: oauth2Token.refreshToken,
                accessToken: oauth2Token.accessToken
            }
            : {
                user: this.account.email,
                pass: password
            };
        this.transporter = nodemailer_1.default.createTransport({
            host: this.account.smtp.host,
            port: this.account.smtp.port,
            secure: this.account.smtp.secure,
            auth: auth,
            tls: {
                rejectUnauthorized: true
            }
        });
        // Verify connection
        await this.transporter.verify();
    }
    async sendEmail(email) {
        if (!this.transporter) {
            await this.initialize();
        }
        try {
            const mailOptions = {
                from: {
                    name: this.account.name,
                    address: this.account.email
                },
                to: email.to.map(addr => addr.address).join(', '),
                subject: email.subject,
                text: email.body,
                html: email.htmlBody || email.body
            };
            if (email.cc && email.cc.length > 0) {
                mailOptions.cc = email.cc.map(addr => addr.address).join(', ');
            }
            if (email.bcc && email.bcc.length > 0) {
                mailOptions.bcc = email.bcc.map(addr => addr.address).join(', ');
            }
            if (email.attachments && email.attachments.length > 0) {
                mailOptions.attachments = email.attachments.map(att => ({
                    filename: att.filename,
                    content: att.content,
                    contentType: att.contentType
                }));
            }
            const info = await this.transporter.sendMail(mailOptions);
            return {
                success: true,
                messageId: info.messageId
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    async testConnection() {
        try {
            await this.initialize();
            return { success: true, message: 'SMTP connection successful' };
        }
        catch (error) {
            return { success: false, message: `SMTP connection failed: ${error.message}` };
        }
    }
}
exports.SMTPClient = SMTPClient;
function getSMTPClient(account) {
    return new SMTPClient(account);
}
