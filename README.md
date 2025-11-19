# ayeMail - Secure Electron Email Client

A secure, feature-rich email client built with Electron, Vue 3, TypeScript, and Tailwind CSS.

## Features

- **Multi-account Support**: Manage multiple IMAP/POP3 email accounts
- **IMAP Folder Management**: Create, delete, rename, and subscribe to folders
- **Email Reminders**: Set follow-up reminders for specific emails with notifications
- **Email Signatures**: Multiple signatures per account with HTML and plain text support
- **GPG Encryption**: Full GPG support for encrypting, decrypting, signing, and verifying emails
- **Security Features**:
  - Encrypted credential storage using Electron's safeStorage
  - Encrypted local database for email storage
  - Certificate validation for all connections
  - Secure IPC communication
  - Auto-lock after inactivity

## Tech Stack

- **Electron**: Desktop application framework
- **Vue 3**: Frontend framework with TypeScript
- **Tailwind CSS**: Utility-first CSS framework
- **SQLite (better-sqlite3)**: Local encrypted database
- **OpenPGP.js**: GPG encryption support
- **node-imap**: IMAP client
- **nodemailer**: SMTP client
- **mailparser**: Email parsing

## Project Structure

```
iMail/
├── electron/          # Electron main process
│   ├── main.ts       # Main entry point
│   └── preload.ts    # Preload script for secure IPC
├── renderer/         # Vue frontend
│   ├── components/   # Vue components
│   ├── App.vue       # Root component
│   └── main.ts       # Vue app entry
├── shared/           # Shared TypeScript types
├── database/         # SQLite schema and encryption
├── email/            # Email client implementations
│   ├── imap-client.ts
│   ├── pop3-client.ts
│   ├── smtp-client.ts
│   └── account-manager.ts
├── gpg/              # GPG integration
├── ipc/              # IPC handlers
├── reminders/        # Reminder scheduler
└── security/         # Security features
```

## Development

### Prerequisites

- Node.js 18+
- yarn

### Installation

```bash
yarn install
```

### Development Mode

```bash
yarn dev
```

This will start:
- Vite dev server on http://localhost:5173
- Electron app

### Building

```bash
yarn build
```

## Security Notes

- Credentials are encrypted using Electron's safeStorage API
- Email bodies and attachments are encrypted at rest in the database
- All TLS connections validate certificates (rejectUnauthorized: true)
- IPC communication uses context isolation for security
- GPG keys are encrypted before storage

## License

MIT

