<template>
  <!-- As composer mode is open, show the compose window -->
  <ComposeWindow v-if="isComposeMode" :account-id="composeAccountId" :reply-to="composeReplyTo" />
  <!-- As composer mode is not open, show the main app -->
  <div v-else class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">

    <main class="flex-1 flex overflow-hidden">

      <aside v-if="hasAccounts" class="border-r border-white/10 dark:border-gray-700 bg-slate-900/70 dark:bg-gray-800 text-slate-100 dark:text-gray-100 backdrop-blur-2xl shadow-xl flex flex-col transition-all duration-200 flex-shrink-0" :style="{ width: sidebarWidth + 'px', minWidth: sidebarWidth + 'px', maxWidth: sidebarWidth + 'px' }">
        <MainNav mode="left" :syncing="syncing" :has-selected-email="Boolean(selectedEmailId)" @sync="syncEmails" @compose="handleCompose" />
        <div class="flex-1 overflow-hidden">
          <FolderList :selected-folder-id="selectedFolderId" :syncing-folder-id="currentSyncFolderId" @select-folder="handleFolderSelect" @open-about="showAbout = true" />
        </div>
        <div v-if="syncProgress.show" class="p-3 border-t border-white/10 bg-white/5">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-slate-200">
              <span v-if="syncProgress.folder === 'folders'">{{ $t('sync.syncingFolders') }}</span>
              <span v-else-if="syncProgress.folder === 'Complete'">{{ $t('sync.syncComplete') }}</span>
              <span v-else-if="syncProgress.folder">
                <span v-if="syncProgress.total === undefined || syncProgress.total === null">
                  <span v-if="syncProgress.current > 0">{{ $t('sync.syncingFolderWithEmails', { folder: syncProgress.folder, current: syncProgress.current }) }}</span>
                  <span v-else>{{ $t('sync.connectingToFolder', { folder: syncProgress.folder }) }}</span>
                </span>
                <span v-else-if="syncProgress.total === 0">{{ $t('sync.syncComplete') }}</span>
                <span v-else>{{ $t('sync.syncingFolderWithCount', { folder: syncProgress.folder, current: syncProgress.current, total: syncProgress.total }) }}</span>
              </span>
              <span v-else>{{ $t('sync.startingSync') }}</span>
            </span>
          </div>
          <div class="w-full bg-white/10 rounded-full h-1.5">
            <div class="bg-primary-500 h-1.5 rounded-full transition-all duration-300" :style="{
              width: syncProgress.total !== undefined && syncProgress.total !== null && syncProgress.total > 0 
                ? `${Math.min(100, (syncProgress.current / syncProgress.total) * 100)}%` 
                : syncProgress.total === 0 
                  ? '100%' 
                  : syncProgress.current > 0
                    ? '50%'
                    : '25%'
            }"></div>
          </div>
        </div>
      </aside>
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Grid/Calm Mode: Use CalmMode component -->
        <template v-if="isGridLayout">
          <CalmMode v-if="!searchQuery" :account-id="selectedAccount?.id" :selected-email-id="selectedEmailId" @select-email="handleEmailSelect" />
          <!-- For search in grid mode, fall back to EmailList -->
          <div v-else-if="searchQuery" class="flex-1 px-2">
            <EmailList :folder-id="''" :folder-name="$t('email.searchResults')" :selected-email-id="selectedEmailId" :account-id="selectedAccount?.id" :search-query="searchQuery" @select-email="handleEmailSelect" @drag-start="handleDragStart" @drag-end="handleDragEnd" />
          </div>
        </template>
        <!-- List Mode: Standard list view with email viewer -->
        <template v-else>
          <div class="flex-1 flex overflow-hidden">
            <div :class="[
              'border-r border-gray-200 dark:border-gray-700 flex-shrink-0',
              !isResizingMailPane ? 'transition-all duration-200' : ''
            ]" :style="{ width: mailPaneWidth + 'px' }">
              <component v-if="selectedFolderId || searchQuery" :is="EmailList" :folder-id="searchQuery ? '' : selectedFolderId" :folder-name="searchQuery ? $t('email.searchResults') : selectedFolderName" :selected-email-id="selectedEmailId" :account-id="selectedAccount?.id" :unified-folder-type="unifiedFolderType" :unified-folder-account-ids="unifiedFolderAccountIds" :search-query="searchQuery" @select-email="handleEmailSelect" @drag-start="handleDragStart" @drag-end="handleDragEnd" />
            </div>
            <div class="w-2 flex-shrink-0 cursor-col-resize relative group bg-transparent hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors" role="separator" aria-orientation="vertical" aria-label="Resize email list" @mousedown.prevent="startMailResize">
              <span class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-300 dark:bg-gray-600 group-hover:bg-gray-500 dark:group-hover:bg-gray-400 transition-colors"></span>
            </div>
            <div class="flex-1 flex flex-col relative">
              <MainNav mode="right" :syncing="false" :has-selected-email="Boolean(selectedEmailId)" @reply="handleNavReply" @forward="handleNavForward" @set-reminder="handleNavReminder" @delete="handleNavDelete" @open-settings="showSettings = true" @search="handleSearch" @clear-search="handleClearSearch" />
              <div class="flex-1 overflow-hidden">
                <EmailDropZone v-if="isDraggingEmail && draggedEmail" :dragged-email="draggedEmail" :account-id="selectedAccount?.id || ''" @action-complete="handleDragActionComplete" @close="handleDragEnd" @drop-start="handleDropStart" @drop-error="handleDropError" />
                <EmailViewer v-else :email-id="selectedEmailId" @reply="handleReply" @forward="handleForward" @set-reminder="handleSetReminder" @delete="handleDeleteEmail" @select-thread-email="handleEmailSelect" />
              </div>
            </div>
          </div>
        </template>
      </div>
    </main>
    <SettingsModal v-if="showSettings" :auto-show-add-account="!hasAccounts" @close="handleSettingsClose" @account-selected="handleAccountSelect" @open-about="showAbout = true; showSettings = false" />
    <AboutModal v-if="showAbout" @close="showAbout = false" />
    <ReminderModal v-if="showReminderModal && reminderEmail" :email-id="reminderEmail.id" :account-id="reminderEmail.accountId" @close="showReminderModal = false; reminderEmail = null" @saved="handleReminderSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import FolderList from './components/FolderList.vue'
import EmailList from './components/EmailList.vue'
import CalmMode from './components/CalmMode.vue'
import EmailViewer from './components/EmailViewer.vue'
import EmailDropZone from './components/EmailDropZone.vue'
import ComposeWindow from './components/ComposeWindow.vue'
import SettingsModal from './components/SettingsModal.vue'
import AboutModal from './components/AboutModal.vue'
import ReminderModal from './components/ReminderModal.vue'
import MainNav from './components/MainNav.vue'
import { usePreferencesStore } from './stores/preferences'
import { useEmailActions } from './composables/useEmailActions'
import { useEmailCacheStore } from './stores/emailCache'

// Check if we're in compose mode
const urlParams = new URLSearchParams(window.location.search)
const isComposeMode = ref(urlParams.get('compose') === 'true')
const composeAccountId = ref(urlParams.get('accountId') || '')
const composeReplyTo = ref<any>(null)

// Listen for reply data from main process via IPC
let composeReplyListener: (() => void) | null = null
onMounted(() => {
  if (isComposeMode.value) {
    composeReplyListener = (window.electronAPI as any).window?.onComposeReplyData?.((data: any) => {
      composeReplyTo.value = data
    }) || null
  }
})

const selectedAccount = ref<any>(null)
const selectedFolderId = ref<string>('')
const selectedFolderName = ref<string>('')
const selectedEmailId = ref<string>('')
const selectedEmail = ref<any>(null)
const unifiedFolderType = ref<string | null>(null) // 'all-inboxes', 'aside'
const unifiedFolderAccountIds = ref<string[]>([]) // For unified folders that need account context
const showSettings = ref(false)
const hasAccounts = ref(false)
const showAbout = ref(false)
const showReminderModal = ref(false)
const reminderEmail = ref<any>(null)
const syncing = ref(false)
const syncProgress = ref<{ show: boolean; current: number; total: number | undefined; folder: string }>({ show: false, current: 0, total: undefined, folder: '' })
const backgroundSyncing = ref(false)
const currentSyncFolderId = ref<string | null>(null)
const currentSyncRemoveListener = ref<(() => void) | null>(null)
const preferences = usePreferencesStore()
const emailCacheStore = useEmailCacheStore()
const isGridLayout = computed(() => preferences.mailLayout === 'grid' || preferences.mailLayout === 'calm')
const mailPaneWidth = ref(384)
const isResizingMailPane = ref(false)
const mailResizeStartX = ref(0)
const mailResizeStartWidth = ref(384)
const MIN_MAIL_WIDTH = 280
const MAX_MAIL_WIDTH = 640
const isDraggingEmail = ref(false)
const draggedEmail = ref<any>(null)
const searchQuery = ref<string>('')
const windowWidth = ref(window.innerWidth)

// Sidebar width: default 256px (w-64), but 30% narrower (179px) when email list < 20% of screen width
const sidebarWidth = computed(() => {
  if (isGridLayout.value) return 256 // Grid layout doesn't use email list pane

  const screenWidth = windowWidth.value
  const thresholdPercent = 20 // 20% threshold
  const thresholdPixels = (screenWidth * thresholdPercent) / 100

  // Check if email list width is at or below 20% of screen width
  // Since MIN_MAIL_WIDTH prevents going below 280px, we need to use the higher of:
  // - 20% of screen width, OR
  // - MIN_MAIL_WIDTH + a small buffer (so it triggers when near minimum)
  const effectiveThreshold = Math.max(thresholdPixels, MIN_MAIL_WIDTH + 5) // 5px buffer above minimum
  const shouldShrink = mailPaneWidth.value <= effectiveThreshold

  if (shouldShrink) {
    // 30% narrower: 256px * 0.7 = 179.2px ≈ 179px
    return 179
  }
  return 256 // Default width
})

const handleMailResizeMouseMove = (event: MouseEvent) => {
  if (!isResizingMailPane.value) return
  event.preventDefault()
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
  event.preventDefault()
  event.stopPropagation()
  isResizingMailPane.value = true
  mailResizeStartX.value = event.clientX
  mailResizeStartWidth.value = mailPaneWidth.value
  document.body.classList.add('select-none')
  document.body.style.cursor = 'col-resize'
  document.addEventListener('mousemove', handleMailResizeMouseMove)
  document.addEventListener('mouseup', stopMailResize)
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
  unifiedFolderType.value = null
  unifiedFolderAccountIds.value = []

  // Handle unified folders
  if (folder.isUnified) {
    if (folder.id === 'unified-all-inboxes') {
      unifiedFolderType.value = 'all-inboxes'
      // Get all account IDs that have inboxes
      const accounts = await window.electronAPI.accounts.list()
      unifiedFolderAccountIds.value = accounts.map((a: any) => a.id)
      // For unified all inboxes, we'll load emails from all inboxes
      // The EmailList component will handle this
    } else if (folder.id === 'unified-aside') {
      unifiedFolderType.value = 'aside'
      // Aside shows reminder emails from all accounts, grouped by reminder date
      // Clean up any duplicate reminders when opening the aside folder
      try {
        await window.electronAPI.reminders.cleanupDuplicates()
      } catch (error) {
        console.error('Error cleaning up duplicate reminders:', error)
      }
      // No account IDs needed - reminders are unified across all accounts
      unifiedFolderAccountIds.value = []
    }
    return // Unified folders don't need syncing
  }

  // Handle regular folders - set account and sync
  // Get accountId from folder (could be accountId or account_id)
  const accountId = folder.accountId || folder.account_id
  
  if (accountId && folder.id) {
    const accounts = await window.electronAPI.accounts.list()
    selectedAccount.value = accounts.find((a: any) => a.id === accountId)

    if (selectedAccount.value) {
      try {
        await syncEmailsForFolder(selectedAccount.value.id, folder.id)
      } catch (error) {
        console.error('Error syncing emails for folder:', error)
      }
    } else {
      console.warn(`Account not found for folder ${folder.id}, accountId: ${accountId}`)
    }
  } else {
    console.warn(`Cannot sync folder ${folder.id}: missing accountId (${accountId}) or folder.id (${folder.id})`)
  }
}

let markAsReadTimeout: NodeJS.Timeout | null = null

const handleEmailSelect = async (emailId: string) => {
  selectedEmailId.value = emailId

  // Clear any existing timeout
  if (markAsReadTimeout) {
    clearTimeout(markAsReadTimeout)
    markAsReadTimeout = null
  }

  // Load full email details (from cache if available)
  if (emailId) {
    try {
      selectedEmail.value = await emailCacheStore.getEmail(emailId)

      // Mark as read after 3 seconds if email is unread
      if (selectedEmail.value && !selectedEmail.value.isRead) {
        markAsReadTimeout = setTimeout(async () => {
          try {
            await window.electronAPI.emails.markRead(emailId, true)
            // Update local state
            if (selectedEmail.value) {
              selectedEmail.value.isRead = true
            }
            // Refresh email list to update read status
            window.dispatchEvent(new CustomEvent('refresh-emails'))
          } catch (error) {
            console.error('Error marking email as read:', error)
          }
        }, 3000) // 3 seconds delay
      }
    } catch (error) {
      console.error('Error loading email:', error)
    }
  }
}

const handleCompose = () => {
  if (!selectedAccount.value) return
    ; (window.electronAPI as any).window.compose.create(selectedAccount.value.id)
}

const handleReply = (email: any) => {
  if (!email || !selectedAccount.value || !email.id) return
    // Pass only the email ID to avoid cloning issues and URL size limits
    ; (window.electronAPI as any).window.compose.create(selectedAccount.value.id, { emailId: email.id, forward: false })
}

const handleForward = (email: any) => {
  if (!email || !selectedAccount.value || !email.id) return
    // Pass only the email ID to avoid cloning issues and URL size limits
    ; (window.electronAPI as any).window.compose.create(selectedAccount.value.id, { emailId: email.id, forward: true })
}

const handleSetReminder = async (email: any) => {
  if (!email || !email.id) return

  // Check if email already has a reminder
  try {
    const hasReminder = await window.electronAPI.reminders.hasReminder(email.id)
    if (hasReminder) {
      // Still allow setting reminder, but it will update the existing one
      // The backend will handle updating instead of creating a duplicate
    }
  } catch (error) {
    console.error('Error checking for existing reminder:', error)
  }

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
      emailCacheStore.clearEmail(email.id)
    }

    // Refresh the email list
    window.dispatchEvent(new CustomEvent('refresh-emails'))
  } catch (error: any) {
    console.error('Error deleting email:', error)
    alert(`Failed to delete email: ${error.message || error}`)
  }
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

  // Listen for new email notifications
  const removeNewEmailsListener = window.electronAPI.emails.onNewEmails((data: any) => {
    showNewEmailNotification(data)
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
        syncProgress.value = { show: false, current: 0, total: undefined, folder: '' }
        syncProgress.value = { show: false, current: 0, total: undefined, folder: '' }
        removeProgressListener()
        removeNewEmailsListener()
      }, 3000)
    } else {
      alert(`Sync failed: ${result.message}`)
      syncProgress.value = { show: false, current: 0, total: undefined, folder: '' }
      removeProgressListener()
      removeNewEmailsListener()
    }
  } catch (error: any) {
    console.error('Error syncing emails:', error)
    alert(`Error syncing emails: ${error.message}`)
    syncProgress.value.show = false
    removeProgressListener()
    removeNewEmailsListener()
  } finally {
    syncing.value = false
  }
}

const showNewEmailNotification = (data: { accountId: string; count: number; emails: any[] }) => {
  console.log('showNewEmailNotification called:', { count: data.count, emailsLength: data.emails?.length, notificationsEnabled: preferences.showEmailNotifications, permission: 'Notification' in window ? Notification.permission : 'N/A' })
  
  // Check if notifications are enabled
  if (!preferences.showEmailNotifications) {
    console.log('Email notifications disabled in settings')
    return
  }

  const { count, emails } = data
  
  if (!emails || emails.length === 0) {
    console.log('No emails to notify about')
    return
  }
  
  // Create notification
  if ('Notification' in window && Notification.permission === 'granted') {
    console.log('Creating notification for', count, 'new email(s)')
    const title = count === 1 
      ? 'New Email'
      : `${count} New Emails`
    
    let body = ''
    if (count === 1 && emails.length > 0) {
      const email = emails[0]
      const from = email.from?.[0]?.name || email.from?.[0]?.address || 'Unknown'
      body = `From: ${from}\n${email.subject || '(No Subject)'}`
    } else if (count > 1) {
      const emailList = emails.slice(0, 3).map((email: any) => {
        const from = email.from?.[0]?.name || email.from?.[0]?.address || 'Unknown'
        return `• ${from}: ${email.subject || '(No Subject)'}`
      }).join('\n')
      body = emailList + (count > 3 ? `\n... and ${count - 3} more` : '')
    }
    
    // Use absolute path for icon to ensure it works in all contexts
    const iconPath = new URL('/assets/ilogo.png', window.location.origin).href
    
    const notification = new Notification(title, {
      body,
      icon: iconPath,
      tag: 'new-emails', // Groups notifications together
      requireInteraction: false
    })
    
    console.log('Notification created and shown')
    
    // Handle click - focus app and show first new email
    notification.onclick = () => {
      console.log('Notification clicked')
      if (emails.length > 0) {
        // Focus the app window
        window.focus()
        // Select the first new email
        handleEmailSelect(emails[0].id)
      }
    }
  } else if ('Notification' in window && Notification.permission === 'default') {
    // Request permission if not yet granted
    console.log('Requesting notification permission...')
    Notification.requestPermission().then(permission => {
      console.log('Permission result:', permission)
    })
  } else if ('Notification' in window) {
    console.warn('Notifications not granted. Permission:', Notification.permission)
  } else {
    console.warn('Notification API not available in this browser')
  }
}

const syncEmailsForFolder = async (accountId: string, folderId: string) => {
  // Cancel any ongoing sync for a different folder
  if (syncing.value && currentSyncFolderId.value !== folderId) {
    
    // Remove progress listener for old sync
    if (currentSyncRemoveListener.value) {
      currentSyncRemoveListener.value()
      currentSyncRemoveListener.value = null
    }
    // Note: We can't actually cancel the backend operation, but we'll ignore its results
    syncing.value = false
  }
  
  // If already syncing the same folder, don't start again
  if (syncing.value && currentSyncFolderId.value === folderId) {
    return
  }

  syncing.value = true
  currentSyncFolderId.value = folderId
  
  // Get folder name for initial display
  let folderName = selectedFolderName.value || 'folder'
  try {
    const folders = await window.electronAPI.folders.list(accountId)
    const findFolder = (folderList: any[]): any => {
      for (const f of folderList) {
        if (f.id === folderId) return f
        if (f.children && f.children.length > 0) {
          const found = findFolder(f.children)
          if (found) return found
        }
      }
      return null
    }
    const folder = findFolder(folders)
    if (folder) folderName = folder.name
  } catch (error) {
    console.error('Error getting folder name:', error)
  }
  
  syncProgress.value = { show: true, current: 0, total: undefined, folder: folderName }

  // Listen for progress updates
  const removeProgressListener = window.electronAPI.emails.onSyncProgress((data: any) => {
    // Only process progress updates for the current folder being synced
    if (currentSyncFolderId.value !== folderId) {
      
      return
    }
    // console.info('Folder sync progress:', data)
    syncProgress.value = {
      show: true,
      current: data.current || 0,
      total: data.total !== undefined && data.total !== null ? data.total : undefined,
      folder: data.folder || folderName
    }
  })
  
  // Store the remove listener so we can cancel it if needed
  currentSyncRemoveListener.value = removeProgressListener

  try {
    const result = await window.electronAPI.emails.syncFolder(accountId, folderId)

    // Check if this sync was cancelled (user selected a different folder)
    if (currentSyncFolderId.value !== folderId) {
      
      removeProgressListener()
      currentSyncRemoveListener.value = null
      return
    }

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
      
      // Clear syncing folder ID when sync completes (emails will appear)
      if (currentSyncFolderId.value === folderId) {
        currentSyncFolderId.value = null
      }

      // Start background body fetching after sync completes
      if (result.success && selectedAccount.value) {
        scheduleBackgroundBodyFetch(selectedAccount.value.id, folderId)
      }

      // Hide progress after showing completion
      setTimeout(() => {
        if (syncProgress.value.folder === 'Complete') {
          syncProgress.value = { show: false, current: 0, total: undefined, folder: '' }
        }
        removeProgressListener()
        currentSyncRemoveListener.value = null
      }, 2000)
    } else {
      if (currentSyncFolderId.value === folderId) {
        alert(`Folder sync failed: ${result.message}`)
        syncProgress.value = { show: false, current: 0, total: undefined, folder: '' }
      }
      removeProgressListener()
      currentSyncRemoveListener.value = null
    }
  } catch (error: any) {
    // Only show error if this sync wasn't cancelled
    if (currentSyncFolderId.value === folderId) {
      console.error('Error syncing folder:', error)
      alert(`Error syncing folder: ${error.message}`)
      syncProgress.value = { show: false, current: 0, total: undefined, folder: '' }
    }
    removeProgressListener()
    currentSyncRemoveListener.value = null
  } finally {
    // Only clear syncing state if this is still the current sync
    if (currentSyncFolderId.value === folderId) {
      syncing.value = false
      // Don't clear currentSyncFolderId here - let it clear when emails appear
    }
  }
}

// Clear sync loader when emails appear in the list
const handleEmailsLoaded = async () => {
  // Small delay to ensure emails are actually loaded
  await new Promise(resolve => setTimeout(resolve, 200))
  
  if (currentSyncFolderId.value && selectedFolderId.value === currentSyncFolderId.value) {
    // Check if emails exist for this folder
    try {
      // The EmailList component will have loaded emails by now
      // We'll clear the loader - if emails didn't load, the loader will show again on next sync
      currentSyncFolderId.value = null
    } catch (error) {
      // Ignore errors
    }
  }
}

// Background body fetching - fetch email bodies when idle
let bodyFetchTimeout: NodeJS.Timeout | null = null
const scheduleBackgroundBodyFetch = (accountId: string, folderId: string) => {
  // Clear any existing timeout
  if (bodyFetchTimeout) {
    clearTimeout(bodyFetchTimeout)
  }

  // Use requestIdleCallback with fallback
  const requestIdleCallback = (window as any).requestIdleCallback || ((callback: (deadline?: any) => void) => {
    setTimeout(() => callback(), 2000)
  })

  // Schedule body fetching when idle (after 3 seconds of inactivity)
  bodyFetchTimeout = setTimeout(() => {
    requestIdleCallback(async () => {
      try {
        if (selectedAccount.value && selectedAccount.value.id === accountId && selectedFolderId.value === folderId) {
          // Only fetch if this folder is still selected
          const result = await (window.electronAPI as any).emails.fetchBodiesBackground(accountId, folderId, 10)
          if (result.success && result.fetched > 0) {
            
            // Refresh email list to show updated emails
            window.dispatchEvent(new CustomEvent('refresh-emails'))
            // Schedule next batch if there might be more
            scheduleBackgroundBodyFetch(accountId, folderId)
          }
        }
      } catch (error) {
        console.error('Error in background body fetch:', error)
      }
    })
  }, 3000) // Wait 3 seconds after sync completes
}

const handleAccountSelect = async (account: any) => {
  selectedAccount.value = account
  // Update hasAccounts when an account is selected/added
  if (account) {
    hasAccounts.value = true
    // Refresh accounts list to ensure we have the latest
    try {
      const accounts = await window.electronAPI.accounts.list()
      if (accounts.length > 0) {
        hasAccounts.value = true
        // Auto-select "All Inboxes" unified folder
        selectedFolderId.value = 'unified-all-inboxes'
        selectedFolderName.value = 'All Inboxes'
        unifiedFolderType.value = 'all-inboxes'
        unifiedFolderAccountIds.value = accounts.map((a: any) => a.id)
      }
    } catch (error) {
      console.error('Error refreshing accounts:', error)
    }
  }
  showSettings.value = false
  // Note: FolderList now loads all accounts, so we don't need to load folders here
  // But we can still select the account's inbox if needed
}

const handleSettingsClose = () => {
  // Don't allow closing settings if there are no accounts (fresh start)
  if (!hasAccounts.value) {
    return
  }
  showSettings.value = false
}



// Track window width for responsive sidebar
let resizeHandler: (() => void) | null = null

// Listen for email refresh to clear sync loader
const handleEmailRefresh = () => {
  handleEmailsLoaded()
}

onMounted(async () => {
  // Request notification permission if not already granted
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      const permission = await Notification.requestPermission()
      console.log('Notification permission:', permission)
    } catch (error) {
      console.error('Error requesting notification permission:', error)
    }
  } else if ('Notification' in window) {
    console.log('Notification permission already set:', Notification.permission)
  }

  // Listen for new email notifications (global - for both manual sync and auto-sync)
  window.electronAPI.emails.onNewEmails((data: any) => {
    console.log('Received new emails event:', data)
    showNewEmailNotification(data)
  })

  // Listen for auto-sync refresh events
  window.electronAPI.emails.onAutoSyncRefresh(() => {
    console.log('Auto-sync: Refresh triggered, updating email list')
    window.dispatchEvent(new CustomEvent('refresh-emails'))
    window.dispatchEvent(new CustomEvent('refresh-folders'))
  })

  // Listen for email refresh events to clear sync loader
  window.addEventListener('refresh-emails', handleEmailRefresh)
  // Initialize dark mode
  if (preferences.darkMode) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }

  // Track window width for responsive sidebar
  resizeHandler = () => {
    windowWidth.value = window.innerWidth
  }
  window.addEventListener('resize', resizeHandler)

  // Note: FolderList now handles loading all accounts and folders
  // Check if this is a fresh start (no accounts)
  try {
    const accounts = await window.electronAPI.accounts.list()
    hasAccounts.value = accounts.length > 0

    if (accounts.length > 0) {
      selectedAccount.value = accounts[0]

      // Auto-select "All Inboxes" unified folder
      selectedFolderId.value = 'unified-all-inboxes'
      selectedFolderName.value = 'All Inboxes'
      unifiedFolderType.value = 'all-inboxes'
      unifiedFolderAccountIds.value = accounts.map((a: any) => a.id)
    } else {
      // Fresh start: show settings modal with add account form
      showSettings.value = true
    }
  } catch (error) {
    console.error('Error loading accounts:', error)
    // On error, assume no accounts and show settings
    hasAccounts.value = false
    showSettings.value = true
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('refresh-emails', handleEmailRefresh)
  // Cleanup resize listener
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }
  // Cleanup compose reply listener if in compose mode
  if (composeReplyListener) {
    composeReplyListener()
  }
  stopMailResize()
})

const handleDragStart = (email: any) => {
  isDraggingEmail.value = true
  draggedEmail.value = email
}

const handleDragEnd = () => {
  isDraggingEmail.value = false
  draggedEmail.value = null
}

const handleDragActionComplete = () => {
  // Action completed, close drop zone
  handleDragEnd()
  // Clear selected email if it was the dragged one
  if (selectedEmailId.value === draggedEmail.value?.id) {
    if (draggedEmail.value?.id) {
      emailCacheStore.clearEmail(draggedEmail.value.id)
    }
    selectedEmailId.value = ''
    selectedEmail.value = null
  }
}

const handleDropStart = (emailId: string) => {
  // Emit event to EmailList to remove email optimistically
  window.dispatchEvent(new CustomEvent('remove-email-optimistic', { detail: { emailId } }))
}

const handleDropError = (emailId: string) => {
  // Emit event to EmailList to restore email on error
  window.dispatchEvent(new CustomEvent('restore-email', { detail: { emailId } }))
  // Refresh email list to ensure consistency
  window.dispatchEvent(new CustomEvent('refresh-emails'))
}

const handleSearch = (query: string) => {
  searchQuery.value = query
  // Clear selected email when searching
  if (query) {
    if (selectedEmailId.value) {
      emailCacheStore.clearEmail(selectedEmailId.value)
    }
    selectedEmailId.value = ''
    selectedEmail.value = null
  }
}

const handleClearSearch = () => {
  searchQuery.value = ''
  // Restore folder selection if we had one before
  if (!selectedFolderId.value && selectedAccount.value) {
    // Try to select the account's inbox
    // This will be handled by FolderList if needed
  }
}
</script>
