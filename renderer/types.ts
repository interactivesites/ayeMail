// Type definitions for renderer process
declare global {
  interface Window {
    electronAPI: {
      platform: string
      accounts: {
        list: () => Promise<any[]>
        get: (id: string) => Promise<any>
        add: (account: any) => Promise<any>
        update: (id: string, account: any) => Promise<any>
        remove: (id: string) => Promise<any>
        test: (account: any) => Promise<{ success: boolean; message: string }>
      }
      emails: {
        list: (folderId: string, page: number, limit: number, threadView?: boolean) => Promise<any[]>
        listUnified: (type: string, accountIds: string[], page: number, limit: number) => Promise<any[]>
        search: (query: string, limit: number) => Promise<any[]>
        get: (id: string) => Promise<any>
        getThread: (emailId: string) => Promise<any[]>
        sync: (accountId: string) => Promise<any>
        syncFolder: (accountId: string, folderId: string) => Promise<any>
        clearAndResyncFolder: (accountId: string, folderId: string) => Promise<any>
        send: (email: any) => Promise<any>
        delete: (id: string) => Promise<any>
        archive: (id: string) => Promise<{ success: boolean; message?: string }>
        spam: (id: string) => Promise<{ success: boolean; message?: string }>
        checkSpam: (id: string) => Promise<{ success: boolean; spamScore?: number; message?: string }>
        addToBlacklist: (accountId: string | null, emailAddress: string, domain: string | null, reason?: string) => Promise<{ success: boolean; message?: string }>
        removeFromBlacklist: (emailAddress: string, accountId?: string) => Promise<{ success: boolean; message?: string }>
        markRead: (id: string, read?: boolean) => Promise<{ success: boolean; message?: string }>
        moveToFolder: (emailId: string, folderId: string) => Promise<{ success: boolean; message?: string }>
        downloadAttachment: (attachmentId: string) => Promise<any>
        onSyncProgress: (callback: (data: any) => void) => () => void
        onNewEmails: (callback: (data: any) => void) => () => void
        onAutoSyncRefresh: (callback: () => void) => () => void
        updateAutoSync: (enabled: boolean, intervalMinutes: number) => Promise<any>
      }
      folders: {
        list: (accountId: string) => Promise<any[]>
        syncOnly: (accountId: string) => Promise<{ success: boolean; synced: number; message?: string }>
        create: (accountId: string, name: string) => Promise<any>
        delete: (accountId: string, name: string) => Promise<any>
        rename: (accountId: string, oldName: string, newName: string) => Promise<any>
        subscribe: (accountId: string, name: string, subscribed: boolean) => Promise<any>
        getLearned: (accountId: string, senderEmail: string) => Promise<Array<{ folderId: string; folderName: string; folderPath: string; moveCount: number; lastMovedAt: number }>>
      }
      reminders: {
        list: () => Promise<any[]>
        hasReminder: (emailId: string) => Promise<boolean>
        create: (reminder: any) => Promise<any>
        update: (id: string, reminder: any) => Promise<any>
        delete: (id: string) => Promise<any>
        cleanupDuplicates: () => Promise<{ cleaned: number; duplicatesFound: number }>
      }
      signatures: {
        list: (accountId: string) => Promise<any[]>
        create: (accountId: string, signature: any) => Promise<any>
        update: (id: string, signature: any) => Promise<any>
        delete: (id: string) => Promise<any>
      }
      gpg: {
        listKeys: () => Promise<any[]>
        importKey: (keyData: string) => Promise<any>
        encrypt: (data: string, recipientKeys: string[]) => Promise<any>
        decrypt: (encryptedData: string) => Promise<any>
        sign: (data: string, keyId: string) => Promise<any>
        verify: (data: string, signature: string) => Promise<any>
      }
      contacts: {
        search: (query: string, limit?: number) => Promise<any[]>
        add: (email: string, name?: string) => Promise<any>
        list: (limit?: number) => Promise<any[]>
        extractFromExisting: () => Promise<any>
      }
      window: {
        compose: {
          create: (accountId: string, replyTo?: any) => Promise<any>
          close: (windowId?: number) => Promise<any>
        }
        minimize: (windowId?: string) => Promise<any>
        maximize: (windowId?: string) => Promise<any>
        close: (windowId?: string) => Promise<any>
        setTitle: (windowId: number, title: string) => Promise<any>
        getId: () => Promise<number>
        onComposeReplyData: (callback: (data: any) => void) => () => void
      }
      shell: {
        openExternal: (url: string) => Promise<void>
      }
    }
  }
}

export {}

