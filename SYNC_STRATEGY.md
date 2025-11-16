# Email Sync Strategy

## Overview
iMail uses a hybrid sync approach that balances speed with functionality.

## Three-Tier Sync Approach

### 1. Metadata-Only Sync (Default - Fast)
**When**: Regular folder syncs when opening folders
**What**: Fetches only email headers and metadata (subject, from, to, date, flags)
**Why**: Ultra-fast sync, typically 10-50x faster than full sync
**Drawback**: Email bodies are empty until viewed

```typescript
// Default behavior
syncFolder(accountId, folderId) 
// Uses fetchFullBodies: false by default
```

### 2. On-Demand Body Fetching (Automatic)
**When**: User clicks on an email to view it
**What**: Detects missing body and fetches from IMAP server
**Why**: Only fetches bodies for emails actually being read
**Implementation**: `getEmail()` with `fetchRemoteBody: true` (default)

```typescript
// In email-storage.ts getEmail()
if (fetchRemoteBody && bodyMissing) {
  // Fetch body from IMAP server
  const fetchedEmail = await imapClient.fetchEmailByUid(folderName, uid)
  // Update database and return with body
}
```

### 3. Background Body Fetching (Progressive)
**When**: After folder sync completes, during idle time
**What**: Gradually fetches bodies for 10 emails at a time
**Why**: Pre-loads bodies for faster viewing, runs when system is idle
**Implementation**: `scheduleBackgroundBodyFetch()` in App.vue

```typescript
// Triggered after successful folder sync
scheduleBackgroundBodyFetch(accountId, folderId)
// Waits 3 seconds, then fetches 10 bodies, then repeats
```

## Manual Operations

### Rebuild Folders (Full Sync)
**When**: User clicks "Rebuild" in Settings → General → Maintenance
**What**: Clears all emails and re-syncs with full bodies
**Why**: Fixes corrupted data or stale metadata-only emails
**Usage**: One-time fix for existing folders

```typescript
clearAndResyncFolder(accountId, folderId)
// Explicitly uses fetchFullBodies: true
```

## Performance Characteristics

| Operation | Speed | Body Content | Use Case |
|-----------|-------|--------------|----------|
| Metadata-only sync | ⚡⚡⚡ Very Fast | ❌ No | Initial folder load |
| On-demand fetch | ⚡ Fast | ✅ Yes | Viewing specific email |
| Background fetch | ⚡⚡ Fast | ✅ Yes | Idle pre-loading |
| Full sync (rebuild) | 🐌 Slow | ✅ Yes | Manual fix/rebuild |

## Example: Opening a Folder with 657 Emails

1. **Metadata sync**: ~2-5 seconds - folder shows all 657 emails
2. **Click email #1**: ~0.5-1 second - body fetches and displays
3. **Background**: Fetches 10 bodies every 3 seconds during idle time
4. **After 3 minutes**: ~60 emails pre-loaded with bodies

## Benefits

✅ **Fast initial load** - Users see email list immediately
✅ **Efficient bandwidth** - Only fetch what's needed
✅ **Progressive enhancement** - Bodies load in background
✅ **Reliable viewing** - On-demand fetch ensures content always available
✅ **Manual fix available** - Rebuild folders for corrupted data

## Code Locations

- **Metadata sync**: `email-storage.ts` → `syncFolderEmails()` (default `fetchFullBodies: false`)
- **On-demand fetch**: `email-storage.ts` → `getEmail()` (detects `bodyMissing`)
- **Background fetch**: `email-storage.ts` → `fetchEmailBodiesInBackground()`
- **Rebuild**: `email-storage.ts` → `clearAndResyncFolder()` (uses `fetchFullBodies: true`)
- **UI trigger**: `renderer/components/SettingsModal.vue` → `handleRebuildFolders()`

## Detection Logic

Body is considered missing if:
```typescript
const bodyMissing = !hasBody && !hasHtmlBody && !hasTextBody
// Where has* checks decrypted value is non-empty string
```

This handles:
- Metadata-only emails (encrypted empty strings)
- NULL body fields (never stored)
- Corrupted/invalid encrypted data

