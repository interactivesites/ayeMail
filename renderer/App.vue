<template>
  <ComposeWindow v-if="isComposeMode" :account-id="composeAccountId" :reply-to="composeReplyTo" />
  <div v-else class="h-screen flex flex-col bg-gray-50">
    <MainNav
      :syncing="syncing"
      :has-selected-email="Boolean(selectedEmailId)"
      @open-settings="showSettings = true"
      @sync="syncEmails"
      @compose="handleCompose"
      @reply="handleNavReply"
      @forward="handleNavForward"
      @set-reminder="handleNavReminder"
      @delete="handleNavDelete"
    />
    <main class="flex-1 flex overflow-hidden">
      <template v-if="selectedAccount">
        <aside class="w-64 border-r border-white/10 bg-slate-900/70 text-slate-100 backdrop-blur-2xl shadow-xl flex flex-col">
        <div class="flex-1 overflow-hidden">
          <FolderList :account-id="selectedAccount.id" :selected-folder-id="selectedFolderId" @select-folder="handleFolderSelect" />
        </div>
          <div v-if="syncProgress.show" class="p-3 border-t border-white/10 bg-white/5">
          <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-slate-200">
              <span v-if="syncProgress.folder === 'folders'">Syncing folders</span>
              <span v-else-if="syncProgress.folder === 'Complete'">Sync complete</span>
              <span v-else-if="syncProgress.folder">
                <span v-if="syncProgress.total === undefined || syncProgress.total === null">Connecting to {{ syncProgress.folder }}</span>
                <span v-else-if="syncProgress.total === 0">No emails in {{ syncProgress.folder }}</span>
                <span v-else>Downloading {{ syncProgress.folder }} ({{ syncProgress.current }}/{{ syncProgress.total }})</span>
              </span>
              <span v-else>Downloading emails</span>
            </span>
          </div>
            <div class="w-full bg-white/10 rounded-full h-1.5">
              <div class="bg-primary-500 h-1.5 rounded-full transition-all duration-300" :style="{
              width: syncProgress.total > 0 ? `${Math.min(100, (syncProgress.current / syncProgress.total) * 100)}%` :
                syncProgress.total === 0 ? '100%' :
                  '25%'
            }"></div>
          </div>
        </div>
      </aside>
        <div class="flex-1 flex overflow-hidden">
          <template v-if="isCalmMode">
            <CalmMode v-if="selectedAccount" :account-id="selectedAccount.id" :selected-email-id="selectedEmailId" @select-email="handleEmailSelect" />
          </template>
          <template v-else>
            <div :class="[
              'transition-all duration-200',
              'border-r border-gray-200 flex-shrink-0'
            ]" :style="{ width: mailPaneWidth + 'px' }">
              <EmailList v-if="selectedFolderId" :folder-id="selectedFolderId" :folder-name="selectedFolderName" :selected-email-id="selectedEmailId" @select-email="handleEmailSelect" />
            </div>
            <div
              class="w-1.5 flex-shrink-0 cursor-col-resize relative group bg-transparent"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize email list"
              @mousedown.prevent="startMailResize"
            >
              <span class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-200 group-hover:bg-gray-400 transition-colors"></span>
            </div>
            <div class="flex-1">
              <EmailViewer :email-id="selectedEmailId" @reply="handleReply" @forward="handleForward" @set-reminder="handleSetReminder" @delete="handleDeleteEmail" />
            </div>
          </template>
        </div>
      </template>
      <template v-else>
        <div class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <p class="text-gray-500 mb-4">No account selected</p>
          <button @click="showSettings = true" class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">
            Add Account
          </button>
        </div>
      </div>
      </template>
    </main>
    <SettingsModal v-if="showSettings" @close="showSettings = false" @account-selected="handleAccountSelect" />
    <ReminderModal v-if="showReminderModal && reminderEmail" :email-id="reminderEmail.id" :account-id="reminderEmail.accountId" @close="showReminderModal = false; reminderEmail = null" @saved="handleReminderSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import FolderList from './components/FolderList.vue'
import EmailList from './components/EmailList.vue'
import CalmMode from './components/CalmMode.vue'
import EmailViewer from './components/EmailViewer.vue'
import ComposeWindow from './components/ComposeWindow.vue'
import SettingsModal from './components/SettingsModal.vue'
import ReminderModal from './components/ReminderModal.vue'
import MainNav from './components/MainNav.vue'
import { usePreferencesStore } from './stores/preferences'

// Check if we're in compose mode
const urlParams = new URLSearchParams(window.location.search)
const isComposeMode = ref(urlParams.get('compose') === 'true')
const composeAccountId = ref(urlParams.get('accountId') || '')
const composeReplyTo = ref<any>(null)

// Listen for reply data from main process via IPC
onMounted(() => {
  if (isComposeMode.value) {
    const removeListener = (window.electronAPI as any).window?.onComposeReplyData?.((data: any) => {
      composeReplyTo.value = data
    })
    
    // Cleanup listener on unmount
    if (removeListener) {
      onBeforeUnmount(() => {
        removeListener()
      })
    }
  }
})

const selectedAccount = ref<any>(null)
const selectedFolderId = ref<string>('')
const selectedFolderName = ref<string>('')
const selectedEmailId = ref<string>('')
const selectedEmail = ref<any>(null)
const showSettings = ref(false)
const showReminderModal = ref(false)
const reminderEmail = ref<any>(null)
const syncing = ref(false)
const syncProgress = ref({ show: false, current: 0, total: 0, folder: '' })
const backgroundSyncing = ref(false)
const preferences = usePreferencesStore()
const isCalmMode = computed(() => preferences.mailLayout === 'calm' || preferences.mailLayout === 'grid')
const mailPaneWidth = ref(384)
const isResizingMailPane = ref(false)
const mailResizeStartX = ref(0)
const mailResizeStartWidth = ref(384)
const MIN_MAIL_WIDTH = 280
const MAX_MAIL_WIDTH = 640

const handleMailResizeMouseMove = (event: MouseEvent) => {
  if (!isResizingMailPane.value) return
  const nextWidth = mailResizeStartWidth.value + (event.clientX - mailResizeStartX.value)
  mailPaneWidth.value = Math.min(Math.max(nextWidth, MIN_MAIL_WIDTH), MAX_MAIL_WIDTH)
}

const stopMailResize = () => {
  if (!isResizingMailPane.value) return
  isResizingMailPane.value = false
  document.body.classList.remove('select-none')
  document.body.style.removeProperty('cursor')
  document.removeEventListener('mousemove', handleMailResizeMouseMove)
  document.removeEventListener('mouseup', stopMailResize)
}

const startMailResize = (event: MouseEvent) => {
  isResizingMailPane.value = true
  mailResizeStartX.value = event.clientX
  mailResizeStartWidth.value = mailPaneWidth.value
  document.body.classList.add('select-none')
  document.body.style.cursor = 'col-resize'
  document.addEventListener('mousemove', handleMailResizeMouseMove)
  document.addEventListener('mouseup', stopMailResize)
}

const clearSelectedEmail = () => {
  selectedEmailId.value = ''
  selectedEmail.value = null
}

const handleNavReply = () => {
  if (!selectedEmail.value) return
  handleReply(selectedEmail.value)
}

const handleNavForward = () => {
  if (!selectedEmail.value) return
  handleForward(selectedEmail.value)
}

const handleNavReminder = () => {
  if (!selectedEmail.value) return
  handleSetReminder(selectedEmail.value)
}

const handleNavDelete = () => {
  if (!selectedEmail.value) return
  handleDeleteEmail(selectedEmail.value)
}

const handleFolderSelect = async (folder: any) => {
  selectedFolderId.value = folder.id
  selectedFolderName.value = folder.name
  selectedEmailId.value = ''

  // Sync emails for the selected folder
  if (selectedAccount.value && folder.id) {
    try {
      await syncEmailsForFolder(selectedAccount.value.id, folder.id)
    } catch (error) {
      console.error('Error syncing emails for folder:', error)
    }
  }
}

const handleEmailSelect = async (emailId: string) => {
  selectedEmailId.value = emailId
  // Load full email details
  if (emailId) {
    try {
      selectedEmail.value = await window.electronAPI.emails.get(emailId)
    } catch (error) {
      console.error('Error loading email:', error)
    }
  }
}

const handleCompose = () => {
  if (!selectedAccount.value) return
  ;(window.electronAPI as any).window.compose.create(selectedAccount.value.id)
}

const handleReply = (email: any) => {
  if (!email || !selectedAccount.value || !email.id) return
  // Pass only the email ID to avoid cloning issues and URL size limits
  ;(window.electronAPI as any).window.compose.create(selectedAccount.value.id, { emailId: email.id, forward: false })
}

const handleForward = (email: any) => {
  if (!email || !selectedAccount.value || !email.id) return
  // Pass only the email ID to avoid cloning issues and URL size limits
  ;(window.electronAPI as any).window.compose.create(selectedAccount.value.id, { emailId: email.id, forward: true })
}

const handleSetReminder = (email: any) => {
  reminderEmail.value = email
  showReminderModal.value = true
}

const handleDeleteEmail = async (email: any) => {
  if (!email) return

  try {
    await window.electronAPI.emails.delete(email.id)
    if (selectedEmailId.value === email.id) {
      selectedEmailId.value = ''
      selectedEmail.value = null
    }

    // Refresh the email list
    window.dispatchEvent(new CustomEvent('refresh-emails'))
  } catch (error: any) {
    console.error('Error deleting email:', error)
    alert(`Failed to delete email: ${error.message || error}`)
  }
}

const handleEmailSent = () => {
  // Refresh email list if needed
}

const handleReminderSaved = () => {
  // Reminder saved successfully
}

const syncEmails = async () => {
  if (!selectedAccount.value || syncing.value) return

  syncing.value = true
  syncProgress.value = { show: true, current: 0, total: 0, folder: '' }

  // Listen for progress updates
  const removeProgressListener = window.electronAPI.emails.onSyncProgress((data: any) => {
    // console.info('Sync progress:', data)
    if (data.folder === 'folders') {
      syncProgress.value = { show: true, current: data.current, total: data.total || 0, folder: data.folder }
    } else if (data.folder) {
      // For email folders, show current/total for that folder
      syncProgress.value = {
        show: true,
        current: data.current,
        total: data.total || 0,
        folder: data.folder
      }
    }
  })

  try {
    // Show initial progress
    syncProgress.value = { show: true, current: 0, total: 0, folder: '' }

    // Start sync
    const result = await window.electronAPI.emails.sync(selectedAccount.value.id)

    if (result.success) {
      const syncedCount = result.synced || 0
      syncProgress.value = {
        show: true,
        current: syncedCount,
        total: syncedCount,
        folder: 'Complete'
      }

      // Refresh folders and email list
      window.dispatchEvent(new CustomEvent('refresh-folders'))
      if (selectedFolderId.value) {
        // Small delay to ensure folders are updated first
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('refresh-emails'))
        }, 100)
      }

      // Hide progress after showing completion
      setTimeout(() => {
        syncProgress.value = { show: false, current: 0, total: 0, folder: '' }
        syncProgress.value = { show: false, current: 0, total: 0, folder: '' }
        removeProgressListener()
      }, 3000)
    } else {
      alert(`Sync failed: ${result.message}`)
      syncProgress.value = { show: false, current: 0, total: 0, folder: '' }
      removeProgressListener()
    }
  } catch (error: any) {
    console.error('Error syncing emails:', error)
    alert(`Error syncing emails: ${error.message}`)
    syncProgress.value.show = false
    removeProgressListener()
  } finally {
    syncing.value = false
  }
}

const syncEmailsForFolder = async (accountId: string, folderId: string) => {
  if (syncing.value) return

  syncing.value = true
  syncProgress.value = { show: true, current: 0, total: 0, folder: '' }

  // Listen for progress updates
  const removeProgressListener = window.electronAPI.emails.onSyncProgress((data: any) => {
    // console.info('Folder sync progress:', data)
    syncProgress.value = {
      show: true,
      current: data.current,
      total: data.total || 0,
      folder: data.folder || ''
    }
  })

  try {
    const result = await window.electronAPI.emails.syncFolder(accountId, folderId)

    if (result.success) {
      const syncedCount = result.synced || 0
      syncProgress.value = {
        show: true,
        current: syncedCount,
        total: syncedCount,
        folder: 'Complete'
      }

      // Refresh email list for this folder
      window.dispatchEvent(new CustomEvent('refresh-emails'))

      // Hide progress after showing completion
      setTimeout(() => {
        syncProgress.value = { show: false, current: 0, total: 0, folder: '' }
        removeProgressListener()
      }, 2000)
    } else {
      alert(`Folder sync failed: ${result.message}`)
      syncProgress.value = { show: false, current: 0, total: 0, folder: '' }
      removeProgressListener()
    }
  } catch (error: any) {
    console.error('Error syncing folder:', error)
    alert(`Error syncing folder: ${error.message}`)
    syncProgress.value = { show: false, current: 0, total: 0, folder: '' }
    removeProgressListener()
  } finally {
    syncing.value = false
  }
}

const handleAccountSelect = (account: any) => {
  selectedAccount.value = account
  showSettings.value = false
  // Load folders for the account
  if (account) {
    loadFolders(account.id)
  }
}

const loadFolders = async (accountId: string) => {
  try {
    // Get account to check type (should be in selectedAccount, but fallback to list if needed)
    let account = selectedAccount.value
    if (!account || account.id !== accountId) {
      const accounts = await window.electronAPI.accounts.list()
      account = accounts.find((a: any) => a.id === accountId)
    }
    
    // Load folders first
    let folders = await window.electronAPI.folders.list(accountId)
    
    // Check if folders exist and account is IMAP
    if (folders.length === 0 && account && account.type === 'imap') {
      // No folders exist, sync them first
      try {
        const result = await window.electronAPI.folders.syncOnly(accountId)
        if (result.success) {
          // Reload folders after sync
          folders = await window.electronAPI.folders.list(accountId)
        }
      } catch (error) {
        console.error('Error syncing folders:', error)
      }
    }
    
    // Find INBOX folder (should always exist for both IMAP and POP3)
    const inbox = folders.find((f: any) => f.name.toLowerCase() === 'inbox')
    if (inbox) {
      selectedFolderId.value = inbox.id
      selectedFolderName.value = inbox.name
      selectedEmailId.value = ''

      // Sync emails for the initially selected INBOX
      try {
        await syncEmailsForFolder(accountId, inbox.id)
        
        // After INBOX sync completes, trigger background sync of other folders (IMAP only)
        if (account && account.type === 'imap') {
          syncOtherFoldersInBackground(accountId, folders)
        }
      } catch (error) {
        console.error('Error syncing INBOX:', error)
      }
    }
  } catch (error) {
    console.error('Error loading folders:', error)
  }
}

const syncOtherFoldersInBackground = async (accountId: string, folders: any[]) => {
  // Skip if already syncing in background
  if (backgroundSyncing.value) {
    return
  }
  
  // Get all folders except INBOX
  const otherFolders = folders.filter((f: any) => f.name.toLowerCase() !== 'inbox')
  
  if (otherFolders.length === 0) {
    return
  }
  
  backgroundSyncing.value = true
  
  // Use requestIdleCallback with fallback
  const requestIdleCallback = (window as any).requestIdleCallback || ((callback: (deadline?: any) => void) => {
    setTimeout(() => callback(), 2000)
  })
  
  const syncNextFolder = async (index: number) => {
    if (index >= otherFolders.length) {
      backgroundSyncing.value = false
      return
    }
    
    const folder = otherFolders[index]
    
    // Wait for idle time before syncing next folder
    requestIdleCallback(async () => {
      try {
        // Only sync if folder is not currently selected (to avoid conflicts)
        if (selectedFolderId.value !== folder.id) {
          await window.electronAPI.emails.syncFolder(accountId, folder.id)
        }
      } catch (error) {
        console.error(`Error syncing folder ${folder.name} in background:`, error)
      }
      
      // Sync next folder
      await syncNextFolder(index + 1)
    }, { timeout: 2000 })
  }
  
  // Start syncing first folder
  await syncNextFolder(0)
}

onMounted(async () => {
  // Load accounts and select first one
  try {
    const accounts = await window.electronAPI.accounts.list()
    if (accounts.length > 0) {
      selectedAccount.value = accounts[0]
      await loadFolders(accounts[0].id)
    }
  } catch (error) {
    console.error('Error loading accounts:', error)
  }
})

onBeforeUnmount(() => {
  stopMailResize()
})
</script>
