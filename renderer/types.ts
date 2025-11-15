// Type definitions for renderer process
declare global {
  interface Window {
    electronAPI: {
      accounts: {
        list: () => Promise<any[]>
        get: (id: string) => Promise<any>
        add: (account: any) => Promise<any>
        update: (id: string, account: any) => Promise<any>
        remove: (id: string) => Promise<any>
        test: (account: any) => Promise<{ success: boolean; message: string }>
      }
      emails: {
        list: (folderId: string, page: number, limit: number) => Promise<any[]>
        listUnified: (type: string, accountIds: string[], page: number, limit: number) => Promise<any[]>
        search: (query: string, limit: number) => Promise<any[]>
        get: (id: string) => Promise<any>
        sync: (accountId: string) => Promise<any>
        syncFolder: (accountId: string, folderId: string) => Promise<any>
        send: (email: any) => Promise<any>
        delete: (id: string) => Promise<any>
        archive: (id: string) => Promise<{ success: boolean; message?: string }>
        spam: (id: string) => Promise<{ success: boolean; message?: string }>
        markRead: (id: string, read?: boolean) => Promise<{ success: boolean; message?: string }>
        moveToFolder: (emailId: string, folderId: string) => Promise<{ success: boolean; message?: string }>
        downloadAttachment: (attachmentId: string) => Promise<any>
        onSyncProgress: (callback: (data: any) => void) => () => void
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
    }
  }
}

export {}

