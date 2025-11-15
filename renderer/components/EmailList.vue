<template>
  <div ref="containerRef" tabindex="0" class="flex flex-col h-full outline-none" @keydown="handleKeyDown" @focus="handleFocus" @click="handleContainerClick">
    <div class="p-4 border-b border-gray-200 flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900">{{ folderName }}</h2>
      <div class="flex items-center space-x-1 bg-gray-100 rounded-full p-0.5">
        <button
          type="button"
          @click="handlePreviewLevelChange(1)"
          :aria-pressed="previewLevel === 1"
          class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          :class="previewLevel === 1 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
          title="Title only"
        >
          <span class="text-xs font-medium w-4 h-4 flex items-center justify-center">1</span>
        </button>
        <button
          type="button"
          @click="handlePreviewLevelChange(2)"
          :aria-pressed="previewLevel === 2"
          class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          :class="previewLevel === 2 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
          title="2 lines preview"
        >
          <span class="text-xs font-medium w-4 h-4 flex items-center justify-center">2</span>
        </button>
        <button
          type="button"
          @click="handlePreviewLevelChange(3)"
          :aria-pressed="previewLevel === 3"
          class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          :class="previewLevel === 3 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
          title="4 lines preview"
        >
          <span class="text-xs font-medium w-4 h-4 flex items-center justify-center">3</span>
        </button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="p-4 text-center text-gray-500">
        Loading emails...
      </div>
      <div v-else-if="emails.length === 0" class="p-4 text-center text-gray-500">
        No emails in this folder
      </div>
      <div v-else>
        <div v-for="group in groupedEmails" :key="group.key" class="mb-6">
          <!-- Date Group Header -->
          <div class="sticky top-0 z-10 flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
            <span class="text-sm font-medium text-primary-600">{{ group.dayName }}</span>
            <span class="text-sm text-gray-500">{{ group.dateString }}</span>
          </div>
          
          <!-- Email Items -->
          <div class="divide-y divide-gray-100 mx-2">
            <button
              v-for="email in group.emails"
              :key="email.id"
              :data-email-id="email.id"
              draggable="true"
              @click="$emit('select-email', email.id)"
              @dragstart="handleDragStart($event, email)"
              @dragend="handleDragEnd"
              class="w-full text-left px-4 py-3 pb-10 my-2 transition-colors rounded-lg relative cursor-grab active:cursor-grabbing group"
              :class="{
                'bg-primary-900 text-white': selectedEmailId === email.id,
                'hover:bg-primary-800/20': selectedEmailId !== email.id,
                'border-l-2 border-primary-600': isEmailUnread(email),
                'opacity-50': isDragging === email.id
              }"
            >
              <!-- Archive Loading Overlay -->
              <div
                v-if="archivingEmailId === email.id"
                class="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg"
              >
                <div class="flex flex-col items-center space-y-2">
                  <div class="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                  <p class="text-gray-700 text-xs font-medium">Archiving...</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <!-- Rounded Checkbox -->
                <div class="flex-shrink-0 self-center relative">
                  <button
                    @click.stop="showArchiveConfirm(email.id)"
                    class="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center transition-colors hover:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-1"
                    :class="{
                      'bg-primary-600 border-primary-600': archiveConfirmId === email.id,
                      'hover:bg-gray-50': archiveConfirmId !== email.id
                    }"
                    title="Archive email"
                  >
                    <svg v-if="archiveConfirmId === email.id" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  
                  <!-- Archive Confirmation Popover -->
                  <Teleport to="body">
                    <div
                      v-if="archiveConfirmId === email.id" 
                      :ref="(el: any) => { if (el) archivePopoverRefs.set(email.id, el as HTMLElement) }"
                      class="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]"
                      @click.stop
                    >
                    <div class="flex items-center gap-2 mb-3">
                      <button
                        @click="cancelArchive"
                        class="px-3 py-1.5 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        @click="confirmArchive(email.id)"
                        class="px-3 py-1.5 text-sm rounded bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                      >
                        Complete
                      </button>
                    </div>
                    <p class="text-xs text-gray-500">Disable confirmation messages in Preferences</p>
                    </div>
                  </Teleport>
                </div>
                
                
                <!-- Email Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 min-w-0">
                      <!-- Sender Name -->
                      <div class="flex items-center gap-2">
                        <span 
                          class="text-sm font-semibold truncate"
                          :class="selectedEmailId === email.id 
                            ? 'text-white' 
                            : (isEmailUnread(email) ? 'text-primary-600' : 'text-gray-900')"
                        >
                          {{ email.from[0]?.name || email.from[0]?.address }}
                        </span>
                        <span 
                          v-if="email.encrypted" 
                          class="text-xs" 
                          :class="selectedEmailId === email.id ? 'text-white/80' : 'text-primary-600'"
                          title="Encrypted"
                        >🔒</span>
                        <span 
                          v-if="email.signed" 
                          class="text-xs" 
                          :class="selectedEmailId === email.id ? 'text-green-300' : 'text-green-600'"
                          title="Signed"
                        >✓</span>
                      </div>
                      
                      <!-- Subject -->
                      <div class="mt-0.5">
                        <span 
                          class="text-sm text-balance break-words whitespace-normal"
                          :class="selectedEmailId === email.id 
                            ? 'text-white' 
                            : (isEmailUnread(email) ? 'text-gray-900 font-medium' : 'text-gray-600')"
                        >
                          {{ email.subject || '(No subject)' }}
                        </span>
                      </div>
                      
                      <!-- Preview Text -->
                      <div 
                        v-if="previewLevel > 1 && getEmailPreview(email)" 
                        class="mt-1 text-xs"
                        :class="[
                          previewLevel === 3 ? 'line-clamp-4' : 'line-clamp-2',
                          selectedEmailId === email.id ? 'text-white/70' : 'text-gray-500'
                        ]"
                      >
                        {{ getEmailPreview(email) }}
                      </div>
                    </div>
                    
                    <!-- Right Side: Time and Status Icons -->
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <!-- Time Display -->
                      <span 
                        class="text-xs"
                        :class="selectedEmailId === email.id ? 'text-white/60' : 'text-gray-500'"
                      >
                        {{ formatTime(email.date) }}
                      </span>
                      
                      <!-- Status Icons - Show only on hover -->
                      <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <span v-if="email.isStarred" class="text-yellow-500 text-sm" title="Starred">★</span>
                        <span 
                          v-if="email.attachmentCount && email.attachmentCount > 0" 
                          class="text-xs"
                          :class="selectedEmailId === email.id ? 'text-white/80' : 'text-gray-500'"
                          title="Has attachments"
                        >📎</span>
                        <span 
                          v-if="email.threadCount && email.threadCount > 1" 
                          class="text-xs"
                          :class="selectedEmailId === email.id ? 'text-white/80' : 'text-gray-500'"
                          title="Thread"
                        >
                          {{ email.threadCount }}
                        </span>
                        <svg 
                          v-if="email.isDraft" 
                          class="w-4 h-4" 
                          :class="selectedEmailId === email.id ? 'text-white/60' : 'text-gray-400'"
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                          title="Draft"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Bottom Action Icons - Right aligned, show only on hover, no circles -->
                <div 
                  class="absolute bottom-2 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  @click.stop
                >
                  <button
                    @click.stop="showArchiveConfirm(email.id)"
                    class="p-1 transition-colors"
                    :class="selectedEmailId === email.id 
                      ? 'text-white/80 hover:text-white' 
                      : 'text-gray-500 hover:text-gray-700'"
                    title="Archive"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </button>
                  <button
                    @click.stop="handleDeleteEmail(email.id)"
                    class="p-1 transition-colors"
                    :class="selectedEmailId === email.id 
                      ? 'text-white/80 hover:text-white' 
                      : 'text-gray-500 hover:text-gray-700'"
                    title="Delete"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <button
                    v-if="email.accountId"
                    @click.stop="showReminderForEmail(email.id)"
                    class="p-1 transition-colors"
                    :class="selectedEmailId === email.id 
                      ? 'text-white/80 hover:text-white' 
                      : 'text-gray-500 hover:text-gray-700'"
                    title="Set Reminder"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button
                    v-if="email.accountId"
                    @click.stop="showFolderPickerForEmail(email.id)"
                    class="p-1 transition-colors"
                    :class="selectedEmailId === email.id 
                      ? 'text-white/80 hover:text-white' 
                      : 'text-gray-500 hover:text-gray-700'"
                    title="Move to Folder (M)"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Reminder Modal as Popover -->
    <Teleport to="body">
      <div
        v-if="showReminderModal && reminderEmail"
        ref="reminderModalRef"
        class="fixed z-[9999]"
        :style="reminderModalStyle"
        style="pointer-events: auto;"
      >
        <ReminderModal
          :email-id="reminderEmail.id"
          :account-id="reminderEmail.accountId"
          :is-popover="true"
          @close="showReminderModal = false; reminderEmail = null"
          @saved="handleReminderSaved"
        />
      </div>
    </Teleport>
    
    <!-- Folder Picker Modal as Popover -->
    <Teleport to="body">
      <div
        v-if="showFolderPicker && folderPickerEmail"
        ref="folderPickerRef"
        class="fixed z-[9999]"
        :style="folderPickerStyle"
        style="pointer-events: auto;"
      >
        <FolderPickerModal
          :account-id="folderPickerEmail.accountId"
          :current-folder-id="folderId"
          :is-popover="true"
          @folder-selected="handleFolderSelected"
          @close="showFolderPicker = false; folderPickerEmail = null"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { usePreferencesStore } from '../stores/preferences'
import { formatTime } from '../utils/formatters'
import ReminderModal from './ReminderModal.vue'
import FolderPickerModal from './FolderPickerModal.vue'
import { computePosition, offset, flip, shift } from '@floating-ui/dom'

const props = defineProps<{
  folderId: string
  folderName: string
  selectedEmailId?: string
  accountId?: string
  unifiedFolderType?: string | null
  unifiedFolderAccountIds?: string[]
}>()

const emit = defineEmits<{
  'select-email': [id: string]
  'drag-start': [email: any]
  'drag-end': []
}>()

const emails = ref<any[]>([])
const loading = ref(false)
const preferences = usePreferencesStore()
const { previewLevel } = storeToRefs(preferences)
const isDragging = ref<string | null>(null)
const removedEmails = ref<Map<string, any>>(new Map()) // Store removed emails for potential restoration

// Grouping mode - can be extended later for other grouping options
const groupingMode = ref<'bydate'>('bydate')

// Archive confirmation state
const archiveConfirmId = ref<string | null>(null)
const archivePopoverRefs = new Map<string, HTMLElement>()
const archivingEmailId = ref<string | null>(null)

// Reminder modal state
const showReminderModal = ref(false)
const reminderEmail = ref<{ id: string; accountId: string } | null>(null)
const reminderModalStyle = ref<{ top?: string; left?: string; right?: string; transform?: string }>({})
const reminderModalRef = ref<HTMLElement | null>(null)

// Folder picker modal state
const showFolderPicker = ref(false)
const folderPickerEmail = ref<{ id: string; accountId: string } | null>(null)
const folderPickerStyle = ref<{ top?: string; left?: string; right?: string; transform?: string }>({})
const folderPickerRef = ref<HTMLElement | null>(null)

// Container ref for focus management
const containerRef = ref<HTMLElement | null>(null)

const isEmailUnread = (email: any): boolean => {
  // Handle various formats: boolean, number (0/1), undefined, null
  if (email.isRead === undefined || email.isRead === null) return true
  if (typeof email.isRead === 'number') return email.isRead === 0
  return !email.isRead
}

const sanitizeText = (text: string): string => {
  // Remove HTML tags and decode entities
  const div = document.createElement('div')
  div.innerHTML = text
  let cleanText = div.textContent || div.innerText || ''
  
  // Remove extra whitespace and normalize
  cleanText = cleanText.replace(/\s+/g, ' ').trim()
  
  return cleanText
}

const getEmailPreview = (email: any): string => {
  if (!email) return ''
  
  // Prefer textBody, fallback to body, then htmlBody
  let content = email.textBody || email.body || email.htmlBody || ''
  
  if (!content) return ''
  
  // Sanitize HTML if present
  if (email.htmlBody || (email.body && email.body.includes('<'))) {
    content = sanitizeText(content)
  }
  
  return content
}

const handlePreviewLevelChange = (level: 1 | 2 | 3) => {
  preferences.setPreviewLevel(level)
}

const showArchiveConfirm = async (emailId: string) => {
  archiveConfirmId.value = emailId
  
  // Position archive popover using Floating UI
  await nextTick()
  await nextTick() // Double nextTick to ensure Teleport has rendered
  
  // Small delay to ensure popover is fully rendered
  await new Promise(resolve => setTimeout(resolve, 10))
  
  const emailElement = document.querySelector(`[data-email-id="${emailId}"]`) as HTMLElement
  const archiveButton = emailElement?.querySelector('button[title="Archive email"]') as HTMLElement
  const popoverElement = archivePopoverRefs.get(emailId)
  
  if (archiveButton && popoverElement) {
    try {
      const { x, y } = await computePosition(archiveButton, popoverElement, {
        placement: 'right',
        middleware: [
          offset(10),
          flip(),
          shift({ padding: 10 })
        ]
      })
      
      popoverElement.style.top = `${y}px`
      popoverElement.style.left = `${x}px`
    } catch (error) {
      console.error('Error positioning archive popover:', error)
    }
  }
}

const cancelArchive = () => {
  archiveConfirmId.value = null
}

const confirmArchive = async (emailId: string) => {
  archiveConfirmId.value = null
  archivingEmailId.value = emailId
  
  try {
    const result = await window.electronAPI.emails.archive(emailId)
    if (result.success) {
      // Remove email from list
      emails.value = emails.value.filter(e => e.id !== emailId)
      // Refresh email list
      window.dispatchEvent(new CustomEvent('refresh-emails'))
      // Clear selection if deleted email was selected
      if (props.selectedEmailId === emailId) {
        emit('select-email', '')
      }
    } else {
      console.error('Failed to archive email:', result.message)
    }
  } catch (error) {
    console.error('Error archiving email:', error)
  } finally {
    archivingEmailId.value = null
  }
}

const handleDeleteEmail = async (emailId: string) => {
  if (!emailId) return
  
  try {
    const result = await window.electronAPI.emails.delete(emailId)
    if (result.success) {
      // Get flat list before filtering to find next email
      const flatEmails = getAllEmailsFlat()
      const currentIndex = flatEmails.findIndex(e => e.id === emailId)
      
      // Remove email from list
      emails.value = emails.value.filter(e => e.id !== emailId)
      // Refresh email list
      window.dispatchEvent(new CustomEvent('refresh-emails'))
      
      // Update selection if deleted email was selected
      if (props.selectedEmailId === emailId) {
        const remainingEmails = getAllEmailsFlat()
        if (remainingEmails.length > 0) {
          // Select next email, or previous if at end, or first if we were at first
          const nextIndex = currentIndex < remainingEmails.length ? currentIndex : remainingEmails.length - 1
          emit('select-email', remainingEmails[nextIndex].id)
        } else {
          emit('select-email', '')
        }
      }
    } else {
      console.error('Failed to delete email:', result.message)
    }
  } catch (error) {
    console.error('Error deleting email:', error)
  }
}

const handleSpamEmail = async (emailId: string) => {
  if (!emailId) return
  
  try {
    const result = await window.electronAPI.emails.spam(emailId)
    if (result.success) {
      // Get flat list before filtering to find next email
      const flatEmails = getAllEmailsFlat()
      const currentIndex = flatEmails.findIndex(e => e.id === emailId)
      
      // Remove email from list
      emails.value = emails.value.filter(e => e.id !== emailId)
      // Refresh email list
      window.dispatchEvent(new CustomEvent('refresh-emails'))
      
      // Update selection if spammed email was selected
      if (props.selectedEmailId === emailId) {
        const remainingEmails = getAllEmailsFlat()
        if (remainingEmails.length > 0) {
          // Select next email, or previous if at end, or first if we were at first
          const nextIndex = currentIndex < remainingEmails.length ? currentIndex : remainingEmails.length - 1
          emit('select-email', remainingEmails[nextIndex].id)
        } else {
          emit('select-email', '')
        }
      }
    } else {
      console.error('Failed to mark email as spam:', result.message)
    }
  } catch (error) {
    console.error('Error marking email as spam:', error)
  }
}

const handleReminderSaved = async () => {
  showReminderModal.value = false
  reminderEmail.value = null
  
  // Refresh the email list to reflect the move to Aside folder
  await loadEmails()
}

const showReminderForEmail = async (emailId: string) => {
  const email = getAllEmailsFlat().find(e => e.id === emailId)
  if (!email || !email.accountId) {
    console.error('Email not found or missing accountId', { emailId, email })
    return
  }
  
  console.log('Setting reminder modal state')
  reminderEmail.value = { id: emailId, accountId: email.accountId }
  
  // Set initial position first (centered) so modal is visible immediately
  reminderModalStyle.value = {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  }
  
  // Show modal first, then position it
  showReminderModal.value = true
  console.log('showReminderModal set to true', showReminderModal.value)
  
  // Wait for modal to render - need multiple ticks for Teleport + component mount
  await nextTick()
  await nextTick()
  await nextTick()
  
  // Additional small delay to ensure calendar component has rendered
  await new Promise(resolve => setTimeout(resolve, 50))
  
  const emailElement = document.querySelector(`[data-email-id="${emailId}"]`) as HTMLElement
  const modalElement = reminderModalRef.value
  
  console.log('Positioning modal', { 
    emailElement: !!emailElement, 
    modalElement: !!modalElement,
    emailElementRect: emailElement?.getBoundingClientRect(),
    modalElementRect: modalElement?.getBoundingClientRect(),
    modalElementChildren: modalElement?.children.length,
    modalElementInnerHTML: modalElement?.innerHTML.substring(0, 100)
  })
  
  if (emailElement && modalElement) {
    try {
      const { x, y } = await computePosition(emailElement, modalElement, {
        placement: 'bottom-start',
        middleware: [
          offset(10),
          flip(),
          shift({ padding: 10 })
        ]
      })
      
      console.log('Computed position', { x, y })
      reminderModalStyle.value = {
        top: `${y}px`,
        left: `${x}px`,
        transform: 'none'
      }
    } catch (error) {
      console.error('Error positioning reminder modal:', error)
      // Fallback positioning
      const rect = emailElement.getBoundingClientRect()
      reminderModalStyle.value = {
        top: `${rect.bottom + 10}px`,
        left: `${rect.left}px`,
        transform: 'none'
      }
    }
  } else {
    console.warn('Email or modal element not found, keeping centered position')
  }
  
  console.log('Final modal state', {
    showReminderModal: showReminderModal.value,
    reminderEmail: reminderEmail.value,
    style: reminderModalStyle.value
  })
}

const showFolderPickerForEmail = async (emailId: string) => {
  const email = getAllEmailsFlat().find(e => e.id === emailId)
  if (!email || !email.accountId) {
    console.error('Email not found or missing accountId', { emailId, email })
    return
  }
  
  // Use the email's accountId, not props.accountId (which might be from unified folder)
  const emailAccountId = email.accountId
  
  // Check if account is IMAP (only IMAP supports folders)
  try {
    const account = await window.electronAPI.accounts.get(emailAccountId)
    if (!account || account.type !== 'imap') {
      return // Don't show folder picker for non-IMAP accounts
    }
  } catch (error) {
    console.error('Error checking account type:', error)
    return
  }
  
  folderPickerEmail.value = { id: emailId, accountId: emailAccountId }
  
  // Set initial position (centered)
  folderPickerStyle.value = {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  }
  
  showFolderPicker.value = true
  
  // Wait for modal to render
  await nextTick()
  await nextTick()
  await nextTick()
  
  await new Promise(resolve => setTimeout(resolve, 50))
  
  const emailElement = document.querySelector(`[data-email-id="${emailId}"]`) as HTMLElement
  const modalElement = folderPickerRef.value
  
  if (emailElement && modalElement) {
    try {
      const { x, y } = await computePosition(emailElement, modalElement, {
        placement: 'bottom-start',
        middleware: [
          offset(10),
          flip(),
          shift({ padding: 10 })
        ]
      })
      
      folderPickerStyle.value = {
        top: `${y}px`,
        left: `${x}px`,
        transform: 'none'
      }
    } catch (error) {
      console.error('Error positioning folder picker:', error)
      const rect = emailElement.getBoundingClientRect()
      folderPickerStyle.value = {
        top: `${rect.bottom + 10}px`,
        left: `${rect.left}px`,
        transform: 'none'
      }
    }
  }
}

const handleFolderSelected = async (folderId: string) => {
  if (!folderPickerEmail.value) return
  
  const emailId = folderPickerEmail.value.id
  
  // Optimistically remove email
  const emailToRemove = emails.value.find(e => e.id === emailId)
  if (emailToRemove) {
    removedEmails.value.set(emailId, emailToRemove)
    emails.value = emails.value.filter(e => e.id !== emailId)
    
    if (props.selectedEmailId === emailId) {
      emit('select-email', '')
    }
  }
  
  try {
    await window.electronAPI.emails.moveToFolder(emailId, folderId)
    // Refresh email list
    window.dispatchEvent(new CustomEvent('refresh-emails'))
  } catch (error: any) {
    console.error('Error moving email to folder:', error)
    // Restore email on error
    const emailToRestore = removedEmails.value.get(emailId)
    if (emailToRestore) {
      emails.value.push(emailToRestore)
      emails.value.sort((a, b) => b.date - a.date)
      removedEmails.value.delete(emailId)
    }
    alert(`Failed to move email: ${error.message || 'Unknown error'}`)
  }
  
  showFolderPicker.value = false
  folderPickerEmail.value = null
}

// Get all emails as a flat array (for navigation)
const getAllEmailsFlat = (): any[] => {
  return groupedEmails.value.flatMap(group => group.emails)
}

// Navigate to next/previous email
const navigateEmail = (direction: 'up' | 'down') => {
  const flatEmails = getAllEmailsFlat()
  if (flatEmails.length === 0) return
  
  const currentIndex = props.selectedEmailId 
    ? flatEmails.findIndex(e => e.id === props.selectedEmailId)
    : -1
  
  let newIndex: number
  if (currentIndex === -1) {
    // No selection, start at first email
    newIndex = 0
  } else if (direction === 'down') {
    // Move to next, wrap to first if at end
    newIndex = currentIndex < flatEmails.length - 1 ? currentIndex + 1 : 0
  } else {
    // Move to previous, wrap to last if at start
    newIndex = currentIndex > 0 ? currentIndex - 1 : flatEmails.length - 1
  }
  
  const newEmail = flatEmails[newIndex]
  if (newEmail) {
    // Ensure container is focused before selecting
    containerRef.value?.focus()
    emit('select-email', newEmail.id)
    // Scroll selected email into view
    nextTick(() => {
      const emailElement = document.querySelector(`[data-email-id="${newEmail.id}"]`) as HTMLElement
      if (emailElement) {
        emailElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        // Keep focus on container
        containerRef.value?.focus()
      }
    })
  }
}

// Keyboard handler - handle globally when EmailList is active
const handleKeyDown = (event: KeyboardEvent) => {
  // Only handle if EmailList is mounted and has emails
  if (!containerRef.value || emails.value.length === 0) return
  
  // Don't handle shortcuts when typing in inputs/textareas
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
  
  // Handle Escape to close modals
  if (event.key === 'Escape') {
    if (showReminderModal.value) {
      event.preventDefault()
      event.stopPropagation()
      showReminderModal.value = false
      reminderEmail.value = null
      return
    }
    if (showFolderPicker.value) {
      event.preventDefault()
      event.stopPropagation()
      showFolderPicker.value = false
      folderPickerEmail.value = null
      return
    }
  }
  
  // Check if user is actively interacting with calendar or folder picker
  const isInCalendar = target.closest('.reminder-calendar-popover') || 
                       target.closest('.dp__calendar') ||
                       target.closest('.dp__calendar_wrap') ||
                       target.closest('.dp__inner_nav') ||
                       target.closest('.dp__cell_inner')
  const isInFolderPicker = target.closest('.folder-picker-popover')
  
  // Don't handle shortcuts if actively clicking/interacting with calendar or folder picker (but allow Escape)
  if ((isInCalendar || isInFolderPicker) && event.key !== 'Escape') {
    return
  }
  
  // If reminder modal is open but user is NOT interacting with calendar, allow shortcuts
  // (they will close the modal and execute the action)
  if (showReminderModal.value && event.key !== 'Escape' && !isInCalendar) {
    // Close modal first, then continue to handle the key
    showReminderModal.value = false
    reminderEmail.value = null
  }
  
  // If folder picker is open but user is NOT interacting with it, allow shortcuts
  if (showFolderPicker.value && event.key !== 'Escape' && !isInFolderPicker) {
    showFolderPicker.value = false
    folderPickerEmail.value = null
  }
  
  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      event.stopPropagation()
      navigateEmail('up')
      break
    case 'ArrowDown':
      event.preventDefault()
      event.stopPropagation()
      navigateEmail('down')
      break
    case 'Delete':
      if (props.selectedEmailId) {
        event.preventDefault()
        event.stopPropagation()
        handleDeleteEmail(props.selectedEmailId)
      }
      break
    case ' ':
      if (props.selectedEmailId) {
        event.preventDefault()
        event.stopPropagation()
        confirmArchive(props.selectedEmailId)
      }
      break
    case 't':
    case 'T':
      if (props.selectedEmailId) {
        event.preventDefault()
        event.stopPropagation()
        showReminderForEmail(props.selectedEmailId)
      }
      break
    case 's':
    case 'S':
      if (props.selectedEmailId) {
        event.preventDefault()
        event.stopPropagation()
        handleSpamEmail(props.selectedEmailId)
      }
      break
    case 'm':
    case 'M':
      if (props.selectedEmailId) {
        event.preventDefault()
        event.stopPropagation()
        showFolderPickerForEmail(props.selectedEmailId)
      }
      break
  }
}

const loadEmails = async () => {
  if (!props.folderId) return

  loading.value = true
  try {
    // Handle unified folders
    if (props.unifiedFolderType && props.unifiedFolderAccountIds) {
      // Ensure we pass a plain array, not a Vue ref
      const accountIds = Array.isArray(props.unifiedFolderAccountIds) 
        ? [...props.unifiedFolderAccountIds] 
        : []
      emails.value = await window.electronAPI.emails.listUnified(
        String(props.unifiedFolderType),
        accountIds,
        0,
        50
      )
    } else {
      // Regular folder
      emails.value = await window.electronAPI.emails.list(props.folderId, 0, 50)
    }
  } catch (error) {
    console.error('Error loading emails:', error)
  } finally {
    loading.value = false
  }
}

// Group emails by date
const getDateKey = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  // Same day
  if (days === 0) {
    return `day-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  }
  // Within 6 days - group by day
  else if (days <= 6) {
    return `day-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  }
  // More than 6 days but less than ~4 weeks - group by week
  else if (days <= 28) {
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay()) // Start of week (Sunday)
    return `week-${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`
  }
  // More than 4 weeks - group by month
  else {
    return `month-${date.getFullYear()}-${date.getMonth()}`
  }
}

const getGroupHeader = (key: string, emails: any[]): { dayName: string; dateString: string } => {
  if (!emails || emails.length === 0) {
    return { dayName: '', dateString: '' }
  }

  const firstEmail = emails[0]
  const date = new Date(firstEmail.date)
  const now = new Date()
  
  // Compare date components (year, month, day) instead of time difference
  const isToday = date.getFullYear() === now.getFullYear() &&
                  date.getMonth() === now.getMonth() &&
                  date.getDate() === now.getDate()
  
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.getFullYear() === yesterday.getFullYear() &&
                      date.getMonth() === yesterday.getMonth() &&
                      date.getDate() === yesterday.getDate()

  if (key.startsWith('day-')) {
    if (isToday) {
      return {
        dayName: 'Today',
        dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
      }
    } else if (isYesterday) {
      return {
        dayName: 'Yesterday',
        dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
      }
    } else {
      return {
        dayName: date.toLocaleDateString([], { weekday: 'long' }),
        dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
      }
    }
  } else if (key.startsWith('week-')) {
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    
    // If same month, show "Week of [date] - [date]"
    if (weekStart.getMonth() === weekEnd.getMonth()) {
      return {
        dayName: 'Week of',
        dateString: `${weekStart.toLocaleDateString([], { month: 'long', day: 'numeric' })} - ${weekEnd.toLocaleDateString([], { day: 'numeric', year: 'numeric' })}`
      }
    } else {
      return {
        dayName: 'Week of',
        dateString: `${weekStart.toLocaleDateString([], { month: 'long', day: 'numeric' })} - ${weekEnd.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}`
      }
    }
  } else if (key.startsWith('month-')) {
    return {
      dayName: date.toLocaleDateString([], { month: 'long' }),
      dateString: date.toLocaleDateString([], { year: 'numeric' })
    }
  }

  return { dayName: '', dateString: '' }
}

const groupedEmails = computed(() => {
  if (groupingMode.value !== 'bydate' || emails.value.length === 0) {
    return []
  }

  // Group emails by date key
  const groups = new Map<string, any[]>()
  
  emails.value.forEach(email => {
    const key = getDateKey(email.date)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(email)
  })

  // Convert to array and sort by date (newest first)
  const groupArray = Array.from(groups.entries()).map(([key, groupEmails]) => {
    // Sort emails within group by date (newest first)
    groupEmails.sort((a, b) => b.date - a.date)
    
    const header = getGroupHeader(key, groupEmails)
    return {
      key,
      emails: groupEmails,
      dayName: header.dayName,
      dateString: header.dateString,
      sortDate: groupEmails[0]?.date || 0
    }
  })

  // Sort groups by date (newest first)
  groupArray.sort((a, b) => b.sortDate - a.sortDate)

  return groupArray
})

const refreshEmails = () => {
  // Clear removed emails cache on refresh since we're getting fresh data
  removedEmails.value.clear()
  loadEmails()
}

const handleRemoveEmailOptimistic = (event: CustomEvent) => {
  const { emailId } = event.detail
  const emailToRemove = emails.value.find(e => e.id === emailId)
  
  if (emailToRemove) {
    // Store email for potential restoration
    removedEmails.value.set(emailId, emailToRemove)
    // Remove from list immediately
    emails.value = emails.value.filter(e => e.id !== emailId)
    
    // Clear selection if removed email was selected
    if (props.selectedEmailId === emailId) {
      emit('select-email', '')
    }
  }
}

const handleRestoreEmail = (event: CustomEvent) => {
  const { emailId } = event.detail
  const emailToRestore = removedEmails.value.get(emailId)
  
  if (emailToRestore) {
    // Restore email to list
    emails.value.push(emailToRestore)
    // Sort emails by date (newest first) to maintain order
    emails.value.sort((a, b) => b.date - a.date)
    // Remove from removed emails map
    removedEmails.value.delete(emailId)
  }
}

// Close popover when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  
  if (archiveConfirmId.value) {
    // Close if click is outside the checkbox container and popover
    if (!target.closest('.relative') && !target.closest('.absolute')) {
      archiveConfirmId.value = null
    }
  }
  
  if (showReminderModal.value) {
    // Close reminder modal if clicking outside
    const reminderModalElement = target.closest('.bg-white.rounded-lg.shadow-xl')
    if (!reminderModalElement) {
      showReminderModal.value = false
      reminderEmail.value = null
    }
  }
  
  if (showFolderPicker.value) {
    // Close folder picker if clicking outside
    const folderPickerElement = target.closest('.folder-picker-popover')
    if (!folderPickerElement) {
      showFolderPicker.value = false
      folderPickerEmail.value = null
    }
  }
}

const handleFocus = () => {
  // Ensure container stays focused when clicking on it
  containerRef.value?.focus()
}

const handleContainerClick = (event: MouseEvent) => {
  // Focus container when clicking in empty space
  const target = event.target as HTMLElement
  if (target === containerRef.value || target.closest('.flex-1.overflow-y-auto')) {
    containerRef.value?.focus()
  }
}

onMounted(() => {
  loadEmails()
  // Listen for refresh event
  window.addEventListener('refresh-emails', refreshEmails)
  // Listen for optimistic email removal
  window.addEventListener('remove-email-optimistic', handleRemoveEmailOptimistic as EventListener)
  // Listen for email restoration on error
  window.addEventListener('restore-email', handleRestoreEmail as EventListener)
  // Listen for clicks outside to close popover
  document.addEventListener('click', handleClickOutside)
  // Listen for global keyboard events when EmailList is active
  window.addEventListener('keydown', handleKeyDown)
  // Auto-focus the container
  nextTick(() => {
    containerRef.value?.focus()
  })
})

watch([() => props.folderId, () => props.unifiedFolderType, () => props.unifiedFolderAccountIds], () => {
  loadEmails()
  archiveConfirmId.value = null // Close popover when folder changes
  archivingEmailId.value = null // Clear archiving state when folder changes
  showReminderModal.value = false // Close reminder modal when folder changes
  reminderEmail.value = null
  // Re-focus container when folder changes
  nextTick(() => {
    containerRef.value?.focus()
  })
}, { deep: true })

// Also watch for when emails are loaded to ensure focus
watch(() => emails.value.length, () => {
  if (emails.value.length > 0) {
    nextTick(() => {
      containerRef.value?.focus()
      // Auto-select first email if none selected
      if (!props.selectedEmailId) {
        const flatEmails = getAllEmailsFlat()
        if (flatEmails.length > 0) {
          emit('select-email', flatEmails[0].id)
        }
      }
    })
  }
})

const handleDragStart = (event: DragEvent, email: any) => {
  isDragging.value = email.id
  emit('drag-start', email)
  
  // Set drag data
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', email.id)
  }
}

const handleDragEnd = () => {
  isDragging.value = null
  emit('drag-end')
}

onUnmounted(() => {
  window.removeEventListener('refresh-emails', refreshEmails)
  window.removeEventListener('remove-email-optimistic', handleRemoveEmailOptimistic as EventListener)
  window.removeEventListener('restore-email', handleRestoreEmail as EventListener)
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>
