import { contextBridge, ipcRenderer } from 'electron'

// Type definitions for window.electronAPI
declare global {
  interface Window {
    electronAPI: any
  }
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Account management
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    get: (id: string) => ipcRenderer.invoke('accounts:get', id),
    add: (account: any) => ipcRenderer.invoke('accounts:add', account),
    update: (id: string, account: any) => ipcRenderer.invoke('accounts:update', id, account),
    remove: (id: string) => ipcRenderer.invoke('accounts:remove', id),
    test: (account: any) => ipcRenderer.invoke('accounts:test', account)
  },
  
  // Email operations
  emails: {
    list: (folderId: string, page: number, limit: number) =>
      ipcRenderer.invoke('emails:list', folderId, page, limit),
    get: (id: string) => ipcRenderer.invoke('emails:get', id),
    sync: (accountId: string) => ipcRenderer.invoke('emails:sync', accountId),
    syncFolder: (accountId: string, folderId: string) => ipcRenderer.invoke('emails:sync-folder', accountId, folderId),
    send: (email: any) => ipcRenderer.invoke('emails:send', email),
    delete: (id: string) => ipcRenderer.invoke('emails:delete', id),
    archive: (id: string) => ipcRenderer.invoke('emails:archive', id),
    downloadAttachment: (attachmentId: string) => ipcRenderer.invoke('emails:download-attachment', attachmentId),
    onSyncProgress: (callback: (data: any) => void) => {
      ipcRenderer.on('emails:sync-progress', (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('emails:sync-progress')
    }
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
      ipcRenderer.invoke('folders:subscribe', accountId, name, subscribed)
  },
  
  // Reminders
  reminders: {
    list: () => ipcRenderer.invoke('reminders:list'),
    create: (reminder: any) => ipcRenderer.invoke('reminders:create', reminder),
    update: (id: string, reminder: any) => 
      ipcRenderer.invoke('reminders:update', id, reminder),
    delete: (id: string) => ipcRenderer.invoke('reminders:delete', id)
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
  
  // Window operations
  window: {
    compose: {
      create: (accountId: string, replyTo?: any) => 
        ipcRenderer.invoke('window:compose:create', accountId, replyTo),
      close: (windowId?: number) => ipcRenderer.invoke('window:compose:close', windowId)
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
  }
})

