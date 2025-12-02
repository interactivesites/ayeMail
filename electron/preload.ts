import { contextBridge, ipcRenderer } from 'electron'
import { platform } from 'os'

// Type definitions for window.electronAPI
declare global {
  interface Window {
    electronAPI: any
  }
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: platform(),
  // Account management
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    get: (id: string) => ipcRenderer.invoke('accounts:get', id),
    add: (account: any) => ipcRenderer.invoke('accounts:add', account),
    update: (id: string, account: any) => ipcRenderer.invoke('accounts:update', id, account),
    remove: (id: string) => ipcRenderer.invoke('accounts:remove', id),
    test: (account: any) => ipcRenderer.invoke('accounts:test', account),
    probe: (account: any) => ipcRenderer.invoke('accounts:probe', account),
    fromAddresses: {
      list: (accountId: string) => ipcRenderer.invoke('accounts:fromAddresses:list', accountId),
      add: (accountId: string, email: string, name?: string, isDefault?: boolean) =>
        ipcRenderer.invoke('accounts:fromAddresses:add', accountId, email, name, isDefault),
      update: (id: string, updates: { email?: string; name?: string; isDefault?: boolean }) =>
        ipcRenderer.invoke('accounts:fromAddresses:update', id, updates),
      remove: (id: string) => ipcRenderer.invoke('accounts:fromAddresses:remove', id)
    }
  },
  
  // Email operations
  emails: {
    list: (folderId: string, page: number, limit: number, threadView?: boolean) =>
      ipcRenderer.invoke('emails:list', folderId, page, limit, threadView ?? true),
    listUnified: (type: string, accountIds: string[], page: number, limit: number) =>
      ipcRenderer.invoke('emails:listUnified', type, accountIds, page, limit),
    search: (query: string, limit: number) =>
      ipcRenderer.invoke('emails:search', query, limit),
    get: (id: string) => ipcRenderer.invoke('emails:get', id),
    getThread: (emailId: string) => ipcRenderer.invoke('emails:getThread', emailId),
    sync: (accountId: string) => ipcRenderer.invoke('emails:sync', accountId),
    syncFolder: (accountId: string, folderId: string) => ipcRenderer.invoke('emails:sync-folder', accountId, folderId),
    clearAndResyncFolder: (accountId: string, folderId: string) => ipcRenderer.invoke('emails:clear-and-resync-folder', accountId, folderId),
    fetchBodiesBackground: (accountId: string, folderId: string, limit?: number) =>
      ipcRenderer.invoke('emails:fetch-bodies-background', accountId, folderId, limit),
    send: (email: any) => ipcRenderer.invoke('emails:send', email),
    delete: (id: string) => ipcRenderer.invoke('emails:delete', id),
    archive: (id: string) => ipcRenderer.invoke('emails:archive', id),
    spam: (id: string) => ipcRenderer.invoke('emails:spam', id),
    checkSpam: (id: string) => ipcRenderer.invoke('emails:check-spam', id),
    addToBlacklist: (accountId: string | null, emailAddress: string, domain: string | null, reason?: string) =>
      ipcRenderer.invoke('emails:add-to-blacklist', accountId, emailAddress, domain, reason),
    removeFromBlacklist: (emailAddress: string, accountId?: string) =>
      ipcRenderer.invoke('emails:remove-from-blacklist', emailAddress, accountId),
    markRead: (id: string, read?: boolean) => ipcRenderer.invoke('emails:mark-read', id, read),
    moveToFolder: (emailId: string, folderId: string) => ipcRenderer.invoke('emails:move-to-folder', emailId, folderId),
    downloadAttachment: (attachmentId: string) => ipcRenderer.invoke('emails:download-attachment', attachmentId),
    setStatus: (emailId: string, status: 'now' | 'later' | 'reference' | 'noise' | 'archived' | null) =>
      ipcRenderer.invoke('emails:setStatus', emailId, status),
    getByStatus: (accountId: string, status: 'now' | 'later' | 'reference' | 'noise' | 'archived' | null, limit?: number) =>
      ipcRenderer.invoke('emails:getByStatus', accountId, status, limit),
    getUncategorized: (accountId: string, limit?: number) =>
      ipcRenderer.invoke('emails:getUncategorized', accountId, limit),
    onSyncProgress: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data)
      ipcRenderer.on('emails:sync-progress', listener)
      return () => ipcRenderer.removeListener('emails:sync-progress', listener)
    },
    onNewEmails: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data)
      ipcRenderer.on('emails:new-emails', listener)
      return () => ipcRenderer.removeListener('emails:new-emails', listener)
    },
    onAutoSyncRefresh: (callback: () => void) => {
      ipcRenderer.on('auto-sync:refresh-needed', () => callback())
      return () => ipcRenderer.removeAllListeners('auto-sync:refresh-needed')
    },
    updateAutoSync: (enabled: boolean, intervalMinutes: number) =>
      ipcRenderer.invoke('emails:update-auto-sync', enabled, intervalMinutes)
  },
  
  // Folder operations
  folders: {
    list: (accountId: string) => ipcRenderer.invoke('folders:list', accountId),
    syncOnly: (accountId: string) => ipcRenderer.invoke('folders:sync-only', accountId),
    create: (accountId: string, name: string) => 
      ipcRenderer.invoke('folders:create', accountId, name),
    delete: (accountId: string, name: string) => 
      ipcRenderer.invoke('folders:delete', accountId, name),
    rename: (accountId: string, oldName: string, newName: string) => 
      ipcRenderer.invoke('folders:rename', accountId, oldName, newName),
    subscribe: (accountId: string, name: string, subscribed: boolean) => 
      ipcRenderer.invoke('folders:subscribe', accountId, name, subscribed),
    getLearned: (accountId: string, senderEmail: string) => 
      ipcRenderer.invoke('folders:get-learned', accountId, senderEmail),
    hasSpamToday: () => ipcRenderer.invoke('folders:hasSpamToday')
  },
  
  // Reminders
  reminders: {
    list: () => ipcRenderer.invoke('reminders:list'),
    hasReminder: (emailId: string) => ipcRenderer.invoke('reminders:hasReminder', emailId),
    getByEmail: (emailId: string) => ipcRenderer.invoke('reminders:getByEmail', emailId),
    create: (reminder: any) => ipcRenderer.invoke('reminders:create', reminder),
    update: (id: string, reminder: any) => 
      ipcRenderer.invoke('reminders:update', id, reminder),
    delete: (id: string) => ipcRenderer.invoke('reminders:delete', id),
    deleteByEmail: (emailId: string) => ipcRenderer.invoke('reminders:deleteByEmail', emailId),
    cleanupDuplicates: () => ipcRenderer.invoke('reminders:cleanupDuplicates'),
    onSelectEmail: (callback: (emailId: string) => void) => {
      ipcRenderer.on('reminders:select-email', (_, emailId) => callback(emailId))
      return () => ipcRenderer.removeAllListeners('reminders:select-email')
    }
  },
  
  // Signatures
  signatures: {
    list: (accountId: string) => ipcRenderer.invoke('signatures:list', accountId),
    create: (accountId: string, signature: any) => 
      ipcRenderer.invoke('signatures:create', accountId, signature),
    update: (id: string, signature: any) => 
      ipcRenderer.invoke('signatures:update', id, signature),
    delete: (id: string) => ipcRenderer.invoke('signatures:delete', id)
  },
  
  // GPG operations
  gpg: {
    listKeys: () => ipcRenderer.invoke('gpg:listKeys'),
    importKey: (keyData: string) => ipcRenderer.invoke('gpg:importKey', keyData),
    encrypt: (data: string, recipientKeys: string[]) => 
      ipcRenderer.invoke('gpg:encrypt', data, recipientKeys),
    decrypt: (encryptedData: string) => 
      ipcRenderer.invoke('gpg:decrypt', encryptedData),
    sign: (data: string, keyId: string) => 
      ipcRenderer.invoke('gpg:sign', data, keyId),
    verify: (data: string, signature: string) => 
      ipcRenderer.invoke('gpg:verify', data, signature)
  },
  
  // Contact operations
  contacts: {
    search: (query: string, limit?: number) => ipcRenderer.invoke('contacts:search', query, limit),
    add: (email: string, name?: string) => ipcRenderer.invoke('contacts:add', email, name),
    list: (limit?: number) => ipcRenderer.invoke('contacts:list', limit),
    extractFromExisting: () => ipcRenderer.invoke('contacts:extract-from-existing'),
    removeFromSpam: () => ipcRenderer.invoke('contacts:remove-from-spam'),
    native: {
      isAvailable: () => ipcRenderer.invoke('contacts:native:isAvailable'),
      get: () => ipcRenderer.invoke('contacts:native:get'),
      sync: () => ipcRenderer.invoke('contacts:native:sync')
    }
  },
  
  // Window operations
  window: {
    compose: {
      create: (accountId: string, replyTo?: any) => 
        ipcRenderer.invoke('window:compose:create', accountId, replyTo),
      close: (windowId?: number) => ipcRenderer.invoke('window:compose:close', windowId)
    },
    emailViewer: {
      create: (emailId: string) => 
        ipcRenderer.invoke('window:email-viewer:create', emailId)
    },
    minimize: (windowId?: string) => ipcRenderer.invoke('window:minimize', windowId),
    maximize: (windowId?: string) => ipcRenderer.invoke('window:maximize', windowId),
    close: (windowId?: string) => ipcRenderer.invoke('window:close', windowId),
    setTitle: (windowId: number, title: string) => ipcRenderer.invoke('window:set-title', windowId, title),
    getId: () => ipcRenderer.invoke('window:getId'),
    onComposeReplyData: (callback: (data: any) => void) => {
      ipcRenderer.on('compose:reply-data', (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('compose:reply-data')
    }
  },
  
  // System operations
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },
  
  // Test utilities
  test: {
    createReminderEmail: (minutesFromNow?: number) => ipcRenderer.invoke('test:create-reminder-email', minutesFromNow),
    triggerRemindersNow: () => ipcRenderer.invoke('test:trigger-reminders-now'),
    reminderSchedulerStatus: () => ipcRenderer.invoke('test:reminder-scheduler-status')
  }
})
