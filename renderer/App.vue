<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <header class="bg-white border-b border-gray-200">
      <div class="px-4 py-2 flex items-center justify-between">
        <h1 class="text-xl font-semibold text-gray-900">iMail</h1>
        <div class="flex items-center space-x-2">
          <button
            @click="showSettings = true"
            class="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Settings
          </button>
        </div>
      </div>
      <nav class="px-4 py-2 border-t border-gray-200 flex items-center space-x-2">
        <button
          @click="syncEmails"
          :disabled="syncing"
          class="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <ArrowPathIcon class="w-5 h-5" />
          <span>{{ syncing ? 'Syncing...' : 'Get Mail' }}</span>
        </button>
        <button
          @click="handleCompose"
          class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-2"
        >
          <PencilSquareIcon class="w-5 h-5" />
          <span>Compose</span>
        </button>
        <button
          v-if="selectedEmailId"
          @click="handleReply(selectedEmail)"
          class="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center space-x-2"
        >
          <ArrowUturnLeftIcon class="w-5 h-5" />
          <span>Reply</span>
        </button>
        <button
          v-if="selectedEmailId"
          @click="handleForward(selectedEmail)"
          class="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center space-x-2"
        >
          <ArrowUpOnSquareIcon class="w-5 h-5" />
          <span>Forward</span>
        </button>
      </nav>
    </header>
    <main class="flex-1 flex overflow-hidden">
      <aside v-if="selectedAccount" class="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div class="flex-1 overflow-hidden">
          <FolderList
            :account-id="selectedAccount.id"
            :selected-folder-id="selectedFolderId"
            @select-folder="handleFolderSelect"
          />
        </div>
        <div v-if="syncProgress.show" class="p-2 border-t border-gray-200 bg-gray-50">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-gray-600">
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
          <div class="w-full bg-gray-200 rounded-full h-1.5">
            <div
              class="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              :style="{
                width: syncProgress.total > 0 ? `${Math.min(100, (syncProgress.current / syncProgress.total) * 100)}%` :
                       syncProgress.total === 0 ? '100%' :
                       '25%'
              }"
            ></div>
          </div>
        </div>
      </aside>
      <div v-if="!selectedAccount" class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <p class="text-gray-500 mb-4">No account selected</p>
          <button
            @click="showSettings = true"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Account
          </button>
        </div>
      </div>
      <div v-else class="flex-1 flex overflow-hidden">
        <div class="w-1/3 border-r border-gray-200">
          <EmailList
            v-if="selectedFolderId"
            :folder-id="selectedFolderId"
            :folder-name="selectedFolderName"
            :selected-email-id="selectedEmailId"
            @select-email="handleEmailSelect"
          />
        </div>
        <div class="flex-1">
          <EmailViewer
            :email-id="selectedEmailId"
            @reply="handleReply"
            @forward="handleForward"
            @set-reminder="handleSetReminder"
            @delete="handleDeleteEmail"
          />
        </div>
      </div>
    </main>
    <ComposeEmail
      v-if="showCompose"
      :account-id="selectedAccount?.id || ''"
      :reply-to="replyToEmail"
      @close="showCompose = false; replyToEmail = undefined"
      @sent="handleEmailSent"
    />
    <SettingsModal
      v-if="showSettings"
      @close="showSettings = false"
      @account-selected="handleAccountSelect"
    />
    <ReminderModal
      v-if="showReminderModal && reminderEmail"
      :email-id="reminderEmail.id"
      :account-id="reminderEmail.accountId"
      @close="showReminderModal = false; reminderEmail = null"
      @saved="handleReminderSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ArrowPathIcon, PencilSquareIcon, ArrowUturnLeftIcon, ArrowUpOnSquareIcon } from '@heroicons/vue/24/outline'
import FolderList from './components/FolderList.vue'
import EmailList from './components/EmailList.vue'
import EmailViewer from './components/EmailViewer.vue'
import ComposeEmail from './components/ComposeEmail.vue'
import SettingsModal from './components/SettingsModal.vue'
import ReminderModal from './components/ReminderModal.vue'

const selectedAccount = ref<any>(null)
const selectedFolderId = ref<string>('')
const selectedFolderName = ref<string>('')
const selectedEmailId = ref<string>('')
const selectedEmail = ref<any>(null)
const showCompose = ref(false)
const showSettings = ref(false)
const showReminderModal = ref(false)
const replyToEmail = ref<any>(undefined)
const reminderEmail = ref<any>(null)
const syncing = ref(false)
const syncProgress = ref({ show: false, current: 0, total: 0, folder: '' })

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
  replyToEmail.value = undefined
  showCompose.value = true
}

const handleReply = (email: any) => {
  if (!email) return
  replyToEmail.value = email
  showCompose.value = true
}

const handleForward = (email: any) => {
  if (!email) return
  // For forward, we'll use the same compose but with forward flag
  replyToEmail.value = { ...email, forward: true }
  showCompose.value = true
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
    console.info('Sync progress:', data)
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
    console.info('Folder sync progress:', data)
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
    const folders = await window.electronAPI.folders.list(accountId)
    const inbox = folders.find((f: any) => f.name.toLowerCase() === 'inbox')
    if (inbox) {
      selectedFolderId.value = inbox.id
      selectedFolderName.value = inbox.name
      selectedEmailId.value = ''

      // Sync emails for the initially selected INBOX
      try {
        await syncEmailsForFolder(accountId, inbox.id)
      } catch (error) {
        console.error('Error syncing INBOX:', error)
      }
    }
  } catch (error) {
    console.error('Error loading folders:', error)
  }
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
</script>

