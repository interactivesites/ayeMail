
## Functionality

- language (i18n) / - formatters (date, time, etc.) - try to get from system
- GPG: plan, check, implement.
- Auto-Updater?

## Bugs


## UI
- Threads: visualise with connections
- add loading anims for load / send / refresh


## Feat


- ai to summarize, answer?
- Folder management: rename, order, delete, create?


## NEW UX
- make the grid a new view. 
- check: https://www.mailpilot.app/ 
- 





## GPG

### Current


Current GPG Surface

gpg/manager.ts (lines 5-220) already wraps OpenPGP.js for listing/importing keys, encrypt/decrypt, sign/verify, and even has generateKey, but there’s no delete/export and the methods expect explicit fingerprints/passphrases that the UI never supplies.
database/schema.ts (lines 148-164) defines a gpg_keys table, so persistence exists, but nothing links keys to accounts/contacts to know which key to use for whom.
ipc/handlers.ts (lines 2618-2671) registers IPC handlers that simply proxy to gpgManager, yet the renderer never provides the isPrivate flag on import nor fingerprints/passphrases for decrypt/sign, so these handlers cannot succeed as-is.
electron/preload.ts (lines 98-110) and renderer/types.ts (lines 56-63) expose the GPG API, but the contract omits isPrivate, fingerprints, and passphrases, so decrypt/sign hooks are unusable and type definitions lie about required arguments.
renderer/components/GPGKeyManager.vue (lines 1-95), ImportKeyModal.vue (lines 5-85), and GenerateKeyModal.vue (lines 5-82) expose UI to list/import/generate keys, yet delete/generate actions are placeholders and there’s no per-account selection or passphrase prompts.
renderer/components/ComposeWindow.vue (lines 31-46) shows Encrypt/Sign toggles and sendEmail forwards encrypt/sign flags (renderer/components/ComposeWindow.vue (lines 823-833)), but the backend never reads them; ipc/handlers.ts (lines 1171-1205) just passes plaintext to SMTPClient.sendEmail, which likewise ignores the flags (email/smtp-client.ts (lines 19-86)).
Incoming mail is always marked encrypted: false/signed: false inside email/imap-client.ts (lines 445-495), so EmailViewer.vue (lines 12-45) shows the icons but never offers decryption/verification.
README and Todo already claim “Full GPG support” (README.md (line 11), Todo.md (line 5)), so there’s a gap between documentation and reality.
Implementation Plan

Key management plumbing

Extend gpg/manager.ts with delete/export helpers and a way to tag keys with metadata (account ID, email address, trust state). Consider a new table (e.g., gpg_key_links) for mapping accounts or contacts to key fingerprints plus default signing key per account.
Finish GenerateKeyModal.vue by calling a new IPC gpg:generateKey (wraps gpgManager.generateKey) and surface errors/passphrase prompts. Add delete/export buttons that call new IPC handlers; update renderer/components/GPGKeyManager.vue accordingly.
IPC/preload contract fixes

Update electron/preload.ts (lines 98-110) and renderer/types.ts (lines 56-63) so each method accepts the required parameters (importKey(keyData, isPrivate), decrypt(encrypted, fingerprint, passphrase?), etc.).
Expand registerGPGHandlers (ipc/handlers.ts (lines 2618-2671)) with handlers for delete/export/generate plus meaningful error messages. Ensure all handlers validate input and return shapes the renderer can rely on.
Account-level preferences

Add columns or a new table to store each account’s default signing key fingerprint, optional encryption key/passphrase hint, and per-recipient public key associations (auto-learn from contacts or manual override). Surface selectors inside the Settings modal (e.g., new section under GPGKeyManager in renderer/components/SettingsModal.vue) so the user can choose which private key signs which account.
Outgoing encryption/signing

Before SMTPClient.sendEmail runs, augment ipc/handlers.ts (lines 1171-1205) to:
Fetch recipient addresses from email.to/cc/bcc.
Resolve their public key fingerprints from the mapping store or prompt the user if missing.
Build a full MIME body (text, HTML, attachments) and pass it to the GPG layer.
Decide on PGP/MIME vs inline PGP: for full-feature mails with attachments, generate a multipart/encrypted structure (OpenPGP encrypt with binary: true into a MIME part) so attachments remain protected. Use OpenPGP.js’ encrypt with signingKeys simultaneously when “Sign” is enabled.
Replace the plaintext body/htmlBody/attachments fields passed to SMTPClient with the already-encrypted MIME payload plus correct headers (Content-Type: multipart/encrypted; protocol="application/pgp-encrypted"). For signed-only emails, wrap with multipart/signed and include the detached signature.
Incoming detection/decryption

Enhance email/imap-client.ts parsing to detect:
Content-Type: multipart/encrypted or inline -----BEGIN PGP MESSAGE-----.
multipart/signed or inline -----BEGIN PGP SIGNED MESSAGE-----.
Store the raw encrypted blob/signature separately (new columns like pgp_encrypted_body, pgp_signature) and set encrypted/signed flags plus metadata (which key IDs were referenced).
Provide a new IPC route emails:decrypt that accepts an email ID and the private key fingerprint/passphrase; on success cache the decrypted result (optionally encrypted-at-rest via existing DB encryption) for faster future loads while tracking whether decryption succeeded.
Renderer UX for decrypt/verify

In EmailViewer.vue, when email.encrypted is true, show a “Decrypt” CTA that opens a passphrase dialog, then call emails:decrypt and replace the displayed body with decrypted HTML/text. Cache decrypted content in Pinia/local state so the UI doesn’t prompt repeatedly.
When email.signed is true, call a new IPC emails:verifySignature (wrapping gpgManager.verify) and update email.signatureVerified; display success/failure and, if unknown, offer to import the signer’s public key using information from the signature block.
Passphrase handling and security

Implement a secure prompt flow: store passphrases only in memory, possibly using Electron’s session storage, and wipe after use. Consider caching decrypted private keys per session with a timeout.
Audit logging/error handling so failures (missing key, wrong passphrase, corrupted message) surface meaningful UI feedback.
Testing & validation

Add unit tests for gpg/manager.ts operations (importing, encrypt/decrypt round-trips, signing) and integration tests for the IPC handlers.
Create end-to-end scenarios (could be scripted) that send a signed/encrypted email between two local accounts to ensure MIME generation and parsing work together.