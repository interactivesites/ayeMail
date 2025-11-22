<template>
  <div class="h-screen flex flex-col bg-gray-50 dark:bg-dark-gray-900">
    <!-- Custom Title Bar -->
    <div class="app-drag-region bg-white/70 dark:bg-dark-gray-800/70 backdrop-blur-xl border-b border-white/60 dark:border-dark-gray-700 shadow-sm flex items-center justify-between px-4 py-2 h-12">
      <div class="app-no-drag flex items-center space-x-3 flex-1 min-w-0">
        <h2 class="text-sm font-medium text-gray-900 dark:text-dark-gray-100 truncate min-w-0 flex-1" :title="emailSubject">{{ emailSubject || 'Email Viewer' }}</h2>
      </div>
      <div class="app-no-drag flex items-center space-x-1">
        <button
          @click="handleMinimize"
          class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Minimize"
        >
          <MinusIcon class="w-4 h-4 text-gray-600 dark:text-dark-gray-300" />
        </button>
        <button
          @click="handleMaximize"
          class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Maximize"
        >
          <ArrowsPointingOutIcon class="w-4 h-4 text-gray-600 dark:text-dark-gray-300" />
        </button>
        <button
          @click="handleClose"
          class="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          title="Close"
        >
          <XMarkIcon class="w-4 h-4 text-gray-600 dark:text-dark-gray-300 hover:text-red-600 dark:hover:text-red-400" />
        </button>
      </div>
    </div>
    <div class="flex-1 overflow-hidden">
      <EmailViewer 
        :email-id="emailId" 
        :show-navigation="true"
        :account-id="accountId"
        @compose="handleCompose"
        @reply="handleReply" 
        @forward="handleForward" 
        @set-reminder="handleSetReminder" 
        @delete="handleDelete" 
        @select-thread-email="handleEmailSelect" 
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Logger } from '@shared/logger'

const logger = Logger.create('Component')
import { ref, watch, computed } from 'vue'
import { MinusIcon, ArrowsPointingOutIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import EmailViewer from './EmailViewer.vue'
import { useEmailActions } from '../composables/useEmailActions'
import { useEmailCacheStore } from '../stores/emailCache'

// Get emailId from URL params
const urlParams = new URLSearchParams(window.location.search)
const emailId = ref(urlParams.get('emailId') || '')
const accountId = ref<string>('')
const emailSubject = ref<string>('')
const windowId = ref<number | null>(null)

const emailCacheStore = useEmailCacheStore()

// Get window ID
window.electronAPI.window.getId().then((id: number | null) => {
  windowId.value = id
})

const {
  replyToEmail,
  forwardEmail,
  setReminderForEmail,
  deleteEmailByObject,
  composeEmail
} = useEmailActions()

// Watch for emailId changes and load accountId from email
watch(emailId, async (newEmailId) => {
  if (newEmailId) {
    try {
      const email = await emailCacheStore.getEmail(newEmailId)
      if (email?.accountId) {
        accountId.value = email.accountId
      }
      if (email?.subject) {
        emailSubject.value = email.subject
      }
    } catch (error) {
      logger.error('Error loading email for accountId:', error)
    }
  }
}, { immediate: true })

const handleMinimize = () => {
  if (windowId.value !== null) {
    window.electronAPI.window.minimize(windowId.value.toString())
  } else {
    window.electronAPI.window.minimize()
  }
}

const handleMaximize = () => {
  if (windowId.value !== null) {
    window.electronAPI.window.maximize(windowId.value.toString())
  } else {
    window.electronAPI.window.maximize()
  }
}

const handleClose = () => {
  window.close()
}

const handleCompose = () => {
  if (accountId.value) {
    composeEmail(accountId.value)
  }
}

const handleReply = async (email: any) => {
  if (!email || !email.id) return
  const emailAccountId = email.accountId || accountId.value
  if (emailAccountId) {
    await replyToEmail(email, emailAccountId)
  }
}

const handleForward = async (email: any) => {
  if (!email || !email.id) return
  const emailAccountId = email.accountId || accountId.value
  if (emailAccountId) {
    await forwardEmail(email, emailAccountId)
  }
}

const handleSetReminder = (email: any) => {
  if (!email || !email.id) return
  setReminderForEmail(email)
}

const handleDelete = async (email: any) => {
  if (!email || !email.id) return
  await deleteEmailByObject(email)
  // Close window after deletion
  window.close()
}

const handleEmailSelect = (selectedEmailId: string) => {
  // Update the emailId to show the selected thread email
  emailId.value = selectedEmailId
}
</script>

