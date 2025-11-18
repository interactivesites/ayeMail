<template>
  <div ref="containerRef" tabindex="0" class="flex flex-col h-full outline-none" @keydown="handleKeyDown" @focus="handleFocus" @click="handleContainerClick">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ folderName }}</h2>
      <div class="flex items-center space-x-2">
        <div class="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-full p-0.5">
          <button
            type="button"
            @click="handlePreviewLevelChange(1)"
            :aria-pressed="previewLevel === 1"
            class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            :class="previewLevel === 1 ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'"
            title="Title only"
          >
            <span class="text-xs font-medium w-4 h-4 flex items-center justify-center">1</span>
          </button>
          <button
            type="button"
            @click="handlePreviewLevelChange(2)"
            :aria-pressed="previewLevel === 2"
            class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            :class="previewLevel === 2 ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'"
            title="2 lines preview"
          >
            <span class="text-xs font-medium w-4 h-4 flex items-center justify-center">2</span>
          </button>
        </div>
        <button
          type="button"
          @click="toggleThreadView"
          :aria-pressed="threadView"
          class="p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          :class="threadView ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'"
          title="Thread view"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
        <button
          v-if="showDeleteAllButton"
          type="button"
          @click="handleDeleteAllEmails"
          :disabled="deletingAllEmails || emails.length === 0"
          class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          :class="deletingAllEmails || emails.length === 0 
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500' 
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'"
          title="Delete all emails in this folder"
        >
          <span v-if="deletingAllEmails" class="flex items-center gap-2">
            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Deleting...
          </span>
          <span v-else class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete All ({{ emails.length }})
          </span>
        </button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="p-4 text-center text-gray-500 dark:text-gray-400">
        Loading emails...
      </div>
      <div v-else-if="emails.length === 0" class="p-4 text-center text-gray-500 dark:text-gray-400">
        No emails in this folder
      </div>
      <div v-else>
        <div v-for="group in groupedEmails" :key="group.key" class="mb-6">
          <!-- Date Group Header -->
          <div class="sticky top-0 z-10 flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <span class="text-sm font-medium text-primary-600 dark:text-primary-400">{{ group.dayName }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ group.dateString }}</span>
          </div>
          
          <!-- Email Items -->
          <div class="divide-y divide-gray-100 dark:divide-gray-700 mx-2">
            <button
              v-for="email in group.emails"
              :key="email.id"
              :data-email-id="email.id"
              draggable="true"
              @click="$emit('select-email', email.id)"
              @dragstart="handleDragStart($event, email)"
              @dragend="handleDragEnd"
              @mouseenter="handleEmailMouseEnter(email.id)"
              @mouseleave="handleEmailMouseLeave"
              class="w-full text-left px-4 pt-3 pb-3 my-2 transition-all duration-200 rounded-lg relative cursor-grab active:cursor-grabbing group hover:pb-10"
              :class="{
                'bg-primary-900 dark:bg-primary-800 text-white': selectedEmailId === email.id,
                'hover:bg-primary-800/20 dark:hover:bg-primary-900/30': selectedEmailId !== email.id,
                'border-l-2 border-primary-600 dark:border-primary-500': isEmailUnread(email),
                'opacity-50': isDragging === email.id,
                'busy': busyEmailIds.has(email.id)
              }"
            >
              <span
                class="email-popover-anchor absolute top-1/2 right-3 w-0 h-0 transform -translate-y-1/2 pointer-events-none"
                :data-email-anchor="email.id"
              ></span>
              <!-- Archive Loading Overlay -->
              <div
                v-if="archivingEmailId === email.id"
                class="absolute inset-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg"
              >
                <div class="flex flex-col items-center space-y-2">
                  <div class="w-8 h-8 border-4 border-primary-600 dark:border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  <p class="text-gray-700 dark:text-gray-300 text-xs font-medium">Archiving...</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <!-- Rounded Checkbox -->
                <div class="flex-shrink-0 self-center relative">
                  <button
                    @click.stop="showArchiveConfirm(email.id)"
                    class="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center transition-colors hover:border-primary-600 dark:hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-1"
                    :class="{
                      'bg-primary-600 dark:bg-primary-500 border-primary-600 dark:border-primary-500': archiveConfirmId === email.id,
                      'hover:bg-gray-50 dark:hover:bg-gray-700': archiveConfirmId !== email.id
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
                      :ref="(el: HTMLElement | null) => { if (el) { archivePopoverRefs.set(email.id, el) } else { archivePopoverRefs.delete(email.id) } }"
                      class="popover-panel fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 min-w-[220px]"
                      @click.stop
                    >
                      <div
                        class="popover-arrow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                        :ref="(el: HTMLElement | null) => { if (el) { archiveArrowRefs.set(email.id, el) } else { archiveArrowRefs.delete(email.id) } }"
                      ></div>
                      <div class="flex items-center gap-2 mb-3">
                        <button
                          @click="cancelArchive"
                          class="px-3 py-1.5 text-sm rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          @click="confirmArchive(email.id)"
                          class="px-3 py-1.5 text-sm rounded bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors"
                        >
                          Complete
                        </button>
                      </div>
                      <p class="text-xs text-gray-500 dark:text-gray-400">Disable confirmation messages in Preferences</p>
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
                            : (isEmailUnread(email) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-gray-100')"
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
                            : (isEmailUnread(email) ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-600 dark:text-gray-300')"
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
                          selectedEmailId === email.id ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
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
                        :class="selectedEmailId === email.id ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'"
                      >
                        {{ formatTime(email.date) }}
                      </span>
                      
                      <!-- Status Icons - Show only on hover -->
                      <div class="hidden group-hover:flex items-center gap-2 transition-all duration-200">
                        <span v-if="email.isStarred" class="text-yellow-500 text-sm" title="Starred">★</span>
                        <span 
                          v-if="email.attachmentCount && email.attachmentCount > 0" 
                          class="text-xs"
                          :class="selectedEmailId === email.id ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'"
                          title="Has attachments"
                        >📎</span>
                        <span 
                          v-if="email.threadCount && email.threadCount > 1" 
                          class="text-xs"
                          :class="selectedEmailId === email.id ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'"
                          title="Thread"
                        >
                          {{ email.threadCount }}
                        </span>
                        <svg 
                          v-if="email.isDraft" 
                          class="w-4 h-4" 
                          :class="selectedEmailId === email.id ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'"
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
                  v-if="!isSpamFolder"
                  class="hidden group-hover:flex absolute bottom-2 right-4 items-center gap-2 transition-all duration-200"
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
                <!-- Un-spam button - Show only in spam/junk folder -->
                <div 
                  v-if="isSpamFolder"
                  class="hidden group-hover:flex absolute bottom-2 right-4 items-center gap-2 transition-all duration-200"
                  @click.stop
                >
                  <button
                    v-if="email.accountId"
                    @click.stop="handleUnspamEmail(email.id)"
                    class="p-1 transition-colors"
                    :class="selectedEmailId === email.id 
                      ? 'text-white/80 hover:text-white' 
                      : 'text-gray-500 hover:text-gray-700'"
                    title="Move to Inbox (Un-spam)"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
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
        class="popover-panel fixed z-[9999]"
        :style="reminderModalStyle"
        style="pointer-events: auto;"
      >
        <div
          class="popover-arrow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          ref="reminderArrowRef"
        ></div>
        <ReminderModal
          :email-id="reminderEmail.id"
          :account-id="reminderEmail.accountId"
          :is-popover="true"
          @close="closeReminderPopover()"
          @saved="handleReminderSaved"
        />
      </div>
    </Teleport>
    
    <!-- Folder Picker Modal as Popover -->
    <Teleport to="body">
      <div
        v-if="showFolderPicker && folderPickerEmail"
        ref="folderPickerRef"
        class="popover-panel fixed z-[9999]"
        :style="folderPickerStyle"
        style="pointer-events: auto;"
      >
        <div
          class="popover-arrow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          ref="folderPickerArrowRef"
        ></div>
        <FolderPickerModal
          :account-id="folderPickerEmail.accountId"
          :current-folder-id="folderId"
          :is-popover="true"
          @folder-selected="handleFolderSelected"
          @close="closeFolderPickerPopover()"
        />
      </div>
    </Teleport>
    
    <!-- Keyboard Shortcuts Popover -->
    <Teleport to="body">
      <div
        v-if="hoveredEmailId"
        ref="shortcutsPopoverRef"
        class="keyboard-shortcuts-popover fixed z-[9998] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[200px]"
        :style="shortcutsPopoverStyle"
        @mouseenter="handleEmailMouseEnter(hoveredEmailId)"
        @mouseleave="handleEmailMouseLeave"
      >
        <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Keyboard Shortcuts</div>
        <div class="space-y-1.5 mb-3">
          <div
            v-for="shortcut in getEmailShortcutsSync(getAllEmailsFlat().find(e => e.id === hoveredEmailId) || {})"
            :key="shortcut.key"
            class="flex items-center justify-between gap-3"
          >
            <span class="text-xs text-gray-600 dark:text-gray-300">{{ shortcut.action }}</span>
            <div class="flex items-center gap-1">
              <kbd
                :class="[
                  'keyboard-key',
                  { 
                    'keyboard-key-arrow': shortcut.key === '↑' || shortcut.key === '↓',
                    'keyboard-key-space': shortcut.key === 'Space',
                    'keyboard-key-delete': shortcut.key === 'Delete'
                  }
                ]"
              >
                {{ shortcut.label }}
              </kbd>
            </div>
          </div>
        </div>
        <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span class="text-xs text-gray-500 dark:text-gray-400">Drag item to the right for more actions</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import type { Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { usePreferencesStore } from '../stores/preferences'
import { formatTime } from '../utils/formatters'
import ReminderModal from './ReminderModal.vue'
import FolderPickerModal from './FolderPickerModal.vue'
import { computePosition, offset, shift, arrow as floatingArrow } from '@floating-ui/dom'
import type { Placement, MiddlewareData } from '@floating-ui/dom'

const props = defineProps<{
  folderId: string
  folderName: string
  selectedEmailId?: string
  accountId?: string
  unifiedFolderType?: string | null
  unifiedFolderAccountIds?: string[]
  searchQuery?: string
}>()

const emit = defineEmits<{
  'select-email': [id: string]
  'drag-start': [email: any]
  'drag-end': []
}>()

const emails = ref<any[]>([])
const loading = ref(false)
const preferences = usePreferencesStore()
const { previewLevel, threadView } = storeToRefs(preferences)
const isDragging = ref<string | null>(null)
const removedEmails = ref<Map<string, any>>(new Map()) // Store removed emails for potential restoration
const deletingAllEmails = ref(false)
const pendingSyncedEmails = ref<any[]>([])
const syncProgressUnsubscribe = ref<null | (() => void)>(null)

// Check if we're in spam/junk folder
const isSpamFolder = computed(() => {
  const folderNameLower = props.folderName.toLowerCase()
  return folderNameLower === 'spam' || folderNameLower === 'junk' || 
         props.folderId.toLowerCase().includes('spam') || 
         props.folderId.toLowerCase().includes('junk')
})

// Check if we're in deleted/trash folder
const isDeletedFolder = computed(() => {
  const folderNameLower = props.folderName.toLowerCase()
  return folderNameLower === 'trash' || folderNameLower === 'deleted' || 
         folderNameLower === 'deleted items' || folderNameLower === 'bin' ||
         props.folderId.toLowerCase().includes('trash') || 
         props.folderId.toLowerCase().includes('deleted') ||
         props.folderId.toLowerCase().includes('bin')
})

// Check if we should show delete all button
const showDeleteAllButton = computed(() => {
  return isSpamFolder.value || isDeletedFolder.value
})

// Grouping mode - can be extended later for other grouping options
const groupingMode = ref<'bydate'>('bydate')

// Archive confirmation state
const archiveConfirmId = ref<string | null>(null)
const archivePopoverRefs = new Map<string, HTMLElement>()
const archiveArrowRefs = new Map<string, HTMLElement>()
const archivingEmailId = ref<string | null>(null)

// Track busy email IDs for immediate UI feedback
const busyEmailIds = ref<Set<string>>(new Set())

// Reminder modal state
const showReminderModal = ref(false)
const reminderEmail = ref<{ id: string; accountId: string } | null>(null)
const reminderModalStyle = ref<{ top?: string; left?: string; right?: string; transform?: string }>({})
const reminderModalRef = ref<HTMLElement | null>(null)
const reminderArrowRef = ref<HTMLElement | null>(null)

// Folder picker modal state
const showFolderPicker = ref(false)
const folderPickerEmail = ref<{ id: string; accountId: string } | null>(null)
const folderPickerStyle = ref<{ top?: string; left?: string; right?: string; transform?: string }>({})
const folderPickerRef = ref<HTMLElement | null>(null)
const folderPickerArrowRef = ref<HTMLElement | null>(null)

// Container ref for focus management
const containerRef = ref<HTMLElement | null>(null)

// Keyboard shortcuts popover state
const hoveredEmailId = ref<string | null>(null)
const shortcutsPopoverRef = ref<HTMLElement | null>(null)
const shortcutsPopoverStyle = ref<{ top?: string; left?: string; right?: string; transform?: string }>({})
let hoverTimeout: ReturnType<typeof setTimeout> | null = null

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

type StyleRef = Ref<{ top?: string; left?: string; right?: string; transform?: string }>

const getEmailElement = (emailId: string): HTMLElement | null => {
  return document.querySelector(`[data-email-id="${emailId}"]`) as HTMLElement | null
}

const getEmailAnchorElement = (emailId: string): HTMLElement | null => {
  return document.querySelector(`[data-email-anchor="${emailId}"]`) as HTMLElement | null
}

const normalizeSyncedEmail = (incoming: any) => {
  if (!incoming || typeof incoming !== 'object') return null
  const normalized = {
    ...incoming,
    from: Array.isArray(incoming.from) ? incoming.from : [],
    to: Array.isArray(incoming.to) ? incoming.to : [],
    cc: Array.isArray(incoming.cc) ? incoming.cc : incoming.cc || undefined,
    bcc: Array.isArray(incoming.bcc) ? incoming.bcc : incoming.bcc || undefined,
    replyTo: Array.isArray(incoming.replyTo) ? incoming.replyTo : incoming.replyTo || undefined,
    flags: Array.isArray(incoming.flags) ? incoming.flags : [],
    attachments: [],
    attachmentCount: incoming.attachmentCount ?? (Array.isArray(incoming.attachments) ? incoming.attachments.length : 0),
    body: typeof incoming.body === 'string' ? incoming.body : '',
    textBody: typeof incoming.textBody === 'string' ? incoming.textBody : undefined,
    htmlBody: typeof incoming.htmlBody === 'string' ? incoming.htmlBody : undefined,
    date: typeof incoming.date === 'number' ? incoming.date : Date.now()
  }
  return normalized
}

const applyNormalizedSyncEmail = (normalized: any) => {
  if (!normalized?.id) return
  if (removedEmails.value.has(normalized.id)) {
    return
  }

  let updated = [...emails.value]
  const existingIndex = updated.findIndex(email => email.id === normalized.id)

  if (existingIndex !== -1) {
    updated[existingIndex] = { ...updated[existingIndex], ...normalized }
  } else if (threadView.value) {
    const threadKey = normalized.threadId || normalized.messageId || normalized.id
    const threadIndex = updated.findIndex(email => (email.threadId || email.messageId || email.id) === threadKey)
    if (threadIndex !== -1) {
      if ((normalized.date || 0) >= (updated[threadIndex].date || 0)) {
        updated[threadIndex] = { ...updated[threadIndex], ...normalized }
      } else {
        return
      }
    } else {
      updated.push(normalized)
    }
  } else {
    updated.push(normalized)
  }

  updated.sort((a, b) => (b.date || 0) - (a.date || 0))

  if (!props.unifiedFolderType && !props.searchQuery && updated.length > 50) {
    updated = updated.slice(0, 50)
  }

  emails.value = updated
}

const flushPendingSyncedEmails = () => {
  if (!pendingSyncedEmails.value.length) return
  const queued = [...pendingSyncedEmails.value]
  pendingSyncedEmails.value = []
  queued.forEach(applyNormalizedSyncEmail)
}

const handleSyncProgressUpdate = (data: any) => {
  if (!data?.email || !props.folderId || props.unifiedFolderType || props.searchQuery) {
    return
  }

  if (data.folderId !== props.folderId) {
    return
  }

  if (props.accountId && data.email.accountId && data.email.accountId !== props.accountId) {
    return
  }

  const normalized = normalizeSyncedEmail(data.email)
  if (!normalized) return

  if (loading.value) {
    pendingSyncedEmails.value.push(normalized)
  } else {
    applyNormalizedSyncEmail(normalized)
  }
}

const updateArrowStyles = (arrowElement: HTMLElement | null | undefined, placement: Placement, middlewareData: MiddlewareData) => {
  if (!arrowElement || !middlewareData?.arrow) {
    return
  }

  const { x: arrowX, y: arrowY } = middlewareData.arrow as { x?: number | null; y?: number | null }
  const basePlacement = placement.split('-')[0] as 'top' | 'right' | 'bottom' | 'left'
  const staticSideMap: Record<'top' | 'right' | 'bottom' | 'left', 'top' | 'right' | 'bottom' | 'left'> = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right'
  }

  arrowElement.style.left = ''
  arrowElement.style.top = ''
  arrowElement.style.right = ''
  arrowElement.style.bottom = ''

  if (arrowX != null) {
    arrowElement.style.left = `${arrowX}px`
  }
  if (arrowY != null) {
    arrowElement.style.top = `${arrowY}px`
  }

  const staticSide = staticSideMap[basePlacement]
  if (staticSide) {
    arrowElement.style[staticSide] = '-6px'
  }
}

const positionFloatingElement = async ({
  referenceElement,
  floatingElement,
  placement = 'right-end',
  arrowElement,
  styleRef
}: {
  referenceElement: HTMLElement
  floatingElement: HTMLElement
  placement?: Placement
  arrowElement?: HTMLElement | null
  styleRef?: StyleRef
}) => {
  const middleware = [
    offset(12),
    shift({ padding: 12 })
  ]

  if (arrowElement) {
    middleware.push(floatingArrow({ element: arrowElement, padding: 6 }))
  }

  const { x, y, placement: finalPlacement, middlewareData } = await computePosition(referenceElement, floatingElement, {
    placement,
    middleware,
    strategy: 'fixed'
  })

  const style = {
    top: `${y}px`,
    left: `${x}px`,
    transform: 'none'
  }

  if (styleRef) {
    styleRef.value = style
  } else {
    floatingElement.style.top = style.top
    floatingElement.style.left = style.left
    floatingElement.style.transform = style.transform
  }

  updateArrowStyles(arrowElement, finalPlacement, middlewareData)
}

const closeArchivePopover = () => {
  archiveConfirmId.value = null
}

const closeReminderPopover = () => {
  showReminderModal.value = false
  reminderEmail.value = null
}

const closeFolderPickerPopover = () => {
  showFolderPicker.value = false
  folderPickerEmail.value = null
}

const closeOtherPopovers = (except?: 'archive' | 'reminder' | 'folder') => {
  if (except !== 'archive') {
    closeArchivePopover()
  }
  if (except !== 'reminder') {
    closeReminderPopover()
  }
  if (except !== 'folder') {
    closeFolderPickerPopover()
  }
}

const handlePreviewLevelChange = (level: 1 | 2) => {
  preferences.setPreviewLevel(level)
}

const toggleThreadView = () => {
  preferences.setThreadView(!threadView.value)
  // Refresh emails when toggling thread view
  loadEmails()
}

const showArchiveConfirm = async (emailId: string) => {
  closeOtherPopovers('archive')
  // Check if confirmation is enabled
  if (!preferences.confirmArchive) {
    // Skip confirmation and archive directly
    await confirmArchive(emailId)
    return
  }
  
  archiveConfirmId.value = emailId
  
  // Position archive popover using Floating UI
  await nextTick()
  await nextTick() // Double nextTick to ensure Teleport has rendered
  
  // Small delay to ensure popover is fully rendered
  await new Promise(resolve => setTimeout(resolve, 10))
  
  const emailElement = getEmailElement(emailId)
  const anchorElement = getEmailAnchorElement(emailId)
  const archiveButton = emailElement?.querySelector('button[title="Archive email"]') as HTMLElement
  const popoverElement = archivePopoverRefs.get(emailId)
  
  const referenceElement = anchorElement || emailElement || archiveButton
  const arrowElement = archiveArrowRefs.get(emailId) || null
  
  if (referenceElement && popoverElement) {
    try {
      await positionFloatingElement({
        referenceElement,
        floatingElement: popoverElement,
        arrowElement,
        placement: 'right-end'
      })
    } catch (error) {
      console.error('Error positioning archive popover:', error)
      const rect = referenceElement.getBoundingClientRect()
      popoverElement.style.top = `${rect.top}px`
      popoverElement.style.left = `${rect.right + 12}px`
      popoverElement.style.transform = 'none'
    }
  }
}

const cancelArchive = () => {
  closeArchivePopover()
}

const confirmArchive = async (emailId: string) => {
  closeArchivePopover()
  archivingEmailId.value = emailId
  busyEmailIds.value.add(emailId)
  
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
    busyEmailIds.value.delete(emailId)
  }
}

const handleDeleteEmail = async (emailId: string) => {
  if (!emailId) return
  
  busyEmailIds.value.add(emailId)
  
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
  } finally {
    busyEmailIds.value.delete(emailId)
  }
}

const handleSpamEmail = async (emailId: string) => {
  if (!emailId) return
  
  busyEmailIds.value.add(emailId)
  
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
  } finally {
    busyEmailIds.value.delete(emailId)
  }
}

const handleUnspamEmail = async (emailId: string) => {
  if (!emailId) return
  
  const email = getAllEmailsFlat().find(e => e.id === emailId)
  if (!email || !email.accountId) {
    console.error('Email not found or missing accountId', { emailId, email })
    return
  }
  
  busyEmailIds.value.add(emailId)
  
  try {
    // Get inbox folder for the account
    const folders = await window.electronAPI.folders.list(email.accountId)
    const inboxFolder = folders.find((f: any) => f.name.toLowerCase() === 'inbox')
    
    if (!inboxFolder) {
      console.error('Inbox folder not found for account:', email.accountId)
      busyEmailIds.value.delete(emailId)
      return
    }
    
    // Move email back to inbox
    const result = await window.electronAPI.emails.moveToFolder(emailId, inboxFolder.id)
    if (result.success) {
      // Get flat list before filtering to find next email
      const flatEmails = getAllEmailsFlat()
      const currentIndex = flatEmails.findIndex(e => e.id === emailId)
      
      // Remove email from list
      emails.value = emails.value.filter(e => e.id !== emailId)
      // Refresh email list
      window.dispatchEvent(new CustomEvent('refresh-emails'))
      
      // Update selection if un-spammed email was selected
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
      console.error('Failed to un-spam email:', result.message)
    }
  } catch (error) {
    console.error('Error un-spamming email:', error)
  } finally {
    busyEmailIds.value.delete(emailId)
  }
}

const handleDeleteAllEmails = async () => {
  if (emails.value.length === 0) return
  
  // Confirm deletion
  const confirmMessage = `Are you sure you want to permanently delete all ${emails.value.length} email${emails.value.length === 1 ? '' : 's'} in this folder? This action cannot be undone.`
  if (!confirm(confirmMessage)) {
    return
  }
  
  deletingAllEmails.value = true
  
  try {
    const allEmailIds = getAllEmailsFlat().map(e => e.id)
    let successCount = 0
    let errorCount = 0
    
    // Delete emails in batches to avoid blocking the UI
    const batchSize = 10
    for (let i = 0; i < allEmailIds.length; i += batchSize) {
      const batch = allEmailIds.slice(i, i + batchSize)
      const promises = batch.map(async (emailId) => {
        try {
          const result = await window.electronAPI.emails.delete(emailId)
          if (result.success) {
            successCount++
            // Remove from local list immediately
            emails.value = emails.value.filter(e => e.id !== emailId)
          } else {
            errorCount++
          }
        } catch (error) {
          console.error(`Error deleting email ${emailId}:`, error)
          errorCount++
        }
      })
      
      await Promise.all(promises)
      
      // Small delay between batches to keep UI responsive
      if (i + batchSize < allEmailIds.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    
    // Clear selection
    emit('select-email', '')
    
    // Refresh email list
    window.dispatchEvent(new CustomEvent('refresh-emails'))
    
    if (errorCount > 0) {
      alert(`Deleted ${successCount} email${successCount === 1 ? '' : 's'}. ${errorCount} email${errorCount === 1 ? '' : 's'} could not be deleted.`)
    }
  } catch (error) {
    console.error('Error deleting all emails:', error)
    alert('An error occurred while deleting emails. Please try again.')
  } finally {
    deletingAllEmails.value = false
  }
}

const handleReminderSaved = async () => {
  closeReminderPopover()
  
  // Refresh the email list to reflect the move to Aside folder
  await loadEmails()
}

const showReminderForEmail = async (emailId: string) => {
  const email = getAllEmailsFlat().find(e => e.id === emailId)
  if (!email || !email.accountId) {
    console.error('Email not found or missing accountId', { emailId, email })
    return
  }
  
  closeOtherPopovers('reminder')
  reminderEmail.value = { id: emailId, accountId: email.accountId }
  
  // Set initial position first (centered) so modal is visible immediately
  reminderModalStyle.value = {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  }
  
  // Show modal first, then position it
  showReminderModal.value = true
  
  // Wait for modal to render - need multiple ticks for Teleport + component mount
  await nextTick()
  await nextTick()
  await nextTick()
  
  // Additional small delay to ensure calendar component has rendered
  await new Promise(resolve => setTimeout(resolve, 50))
  
  const emailElement = getEmailElement(emailId)
  const anchorElement = getEmailAnchorElement(emailId)
  const modalElement = reminderModalRef.value
  
  const referenceElement = anchorElement || emailElement
  
  if (referenceElement && modalElement) {
    try {
      await positionFloatingElement({
        referenceElement,
        floatingElement: modalElement,
        arrowElement: reminderArrowRef.value,
        styleRef: reminderModalStyle,
        placement: 'right-end'
      })
    } catch (error) {
      console.error('Error positioning reminder modal:', error)
      // Fallback positioning
      const rect = referenceElement.getBoundingClientRect()
      reminderModalStyle.value = {
        top: `${rect.top}px`,
        left: `${rect.right + 12}px`,
        transform: 'none'
      }
    }
  } else {
    console.warn('Email or modal element not found, keeping centered position')
  }
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
  closeOtherPopovers('folder')
  
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
  
  const emailElement = getEmailElement(emailId)
  const anchorElement = getEmailAnchorElement(emailId)
  const modalElement = folderPickerRef.value
  
  const referenceElement = anchorElement || emailElement
  
  if (referenceElement && modalElement) {
    try {
      await positionFloatingElement({
        referenceElement,
        floatingElement: modalElement,
        arrowElement: folderPickerArrowRef.value,
        styleRef: folderPickerStyle,
        placement: 'right-end'
      })
    } catch (error) {
      console.error('Error positioning folder picker:', error)
      const rect = referenceElement.getBoundingClientRect()
      folderPickerStyle.value = {
        top: `${rect.top}px`,
        left: `${rect.right + 12}px`,
        transform: 'none'
      }
    }
  }
}

const handleFolderSelected = async (folderId: string) => {
  if (!folderPickerEmail.value) return
  
  const emailId = folderPickerEmail.value.id
  
  busyEmailIds.value.add(emailId)
  
  // Optimistically remove email
  const emailToRemove = emails.value.find(e => e.id === emailId)
  if (emailToRemove) {
    // Get flat list before filtering to find next email
    const flatEmails = getAllEmailsFlat()
    const currentIndex = flatEmails.findIndex(e => e.id === emailId)
    
    removedEmails.value.set(emailId, emailToRemove)
    emails.value = emails.value.filter(e => e.id !== emailId)
    
    // Update selection if moved email was selected
    if (props.selectedEmailId === emailId) {
      const remainingEmails = getAllEmailsFlat()
      if (remainingEmails.length > 0) {
        // Select next email, or previous if at end
        const nextIndex = currentIndex < remainingEmails.length ? currentIndex : remainingEmails.length - 1
        emit('select-email', remainingEmails[nextIndex].id)
      } else {
        emit('select-email', '')
      }
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
  } finally {
    busyEmailIds.value.delete(emailId)
    closeFolderPickerPopover()
  }
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
  
  // Don't handle shortcuts when typing in inputs/textareas/contenteditable
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
  
  // Don't handle shortcuts if settings modal is open
  // Check if target is within the settings modal overlay (z-50) or if settings modal exists in DOM
  const modalOverlay = target.closest('.fixed.inset-0')
  const isInSettingsModal = (modalOverlay !== null && modalOverlay.classList.contains('z-50')) ||
                            document.querySelector('.fixed.inset-0.z-50') !== null
  
  // Block M/T/Space keys when settings modal is open (but allow Escape to close modals)
  if (isInSettingsModal && (event.key === 'm' || event.key === 'M' || event.key === 't' || event.key === 'T' || event.key === ' ')) {
    return
  }
  
  // Handle Escape to close modals
  if (event.key === 'Escape') {
    let closed = false
    if (archiveConfirmId.value) {
      closeArchivePopover()
      closed = true
    }
    if (showReminderModal.value) {
      closeReminderPopover()
      closed = true
    }
    if (showFolderPicker.value) {
      closeFolderPickerPopover()
      closed = true
    }
    if (closed) {
      event.preventDefault()
      event.stopPropagation()
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
    closeReminderPopover()
  }
  
  // If folder picker is open but user is NOT interacting with it, allow shortcuts
  if (showFolderPicker.value && event.key !== 'Escape' && !isInFolderPicker) {
    closeFolderPickerPopover()
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
        showArchiveConfirm(props.selectedEmailId)
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
    case 'j':
    case 'J':
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
  // Handle search query
  if (props.searchQuery && props.searchQuery.trim().length > 0) {
    loading.value = true
    try {
      emails.value = await window.electronAPI.emails.search(props.searchQuery.trim(), 100)
    } catch (error) {
      console.error('Error searching emails:', error)
    } finally {
      loading.value = false
    }
    return
  }

  if (!props.folderId) return

  loading.value = true
  try {
    // Handle unified folders
    if (props.unifiedFolderType) {
      // Ensure we pass a plain array, not a Vue ref
      // For Aside folder, unifiedFolderAccountIds is empty array, which is valid
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
      // Regular folder - pass threadView preference
      emails.value = await window.electronAPI.emails.list(props.folderId, 0, 50, threadView.value)
    }
  } catch (error) {
    console.error('Error loading emails:', error)
  } finally {
    loading.value = false
    flushPendingSyncedEmails()
  }
}

// Group emails by date
const getDateKey = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  // For future dates (reminders), use absolute value
  const absDays = Math.abs(days)

  // Same day
  if (absDays === 0) {
    return `day-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  }
  // Within 6 days - group by day
  else if (absDays <= 6) {
    return `day-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  }
  // More than 6 days but less than ~4 weeks - group by week
  else if (absDays <= 28) {
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay()) // Start of week (Sunday)
    return `week-${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`
  }
  // More than 4 weeks - group by month
  else {
    return `month-${date.getFullYear()}-${date.getMonth()}`
  }
}

const getGroupHeader = (key: string, emails: any[], isFutureDate: boolean = false): { dayName: string; dateString: string } => {
  if (!emails || emails.length === 0) {
    return { dayName: '', dateString: '' }
  }

  const firstEmail = emails[0]
  const date = new Date(firstEmail.date)
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  // Compare date components (year, month, day) instead of time difference
  const isToday = date.getFullYear() === now.getFullYear() &&
                  date.getMonth() === now.getMonth() &&
                  date.getDate() === now.getDate()
  
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.getFullYear() === yesterday.getFullYear() &&
                      date.getMonth() === yesterday.getMonth() &&
                      date.getDate() === yesterday.getDate()

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow = date.getFullYear() === tomorrow.getFullYear() &&
                     date.getMonth() === tomorrow.getMonth() &&
                     date.getDate() === tomorrow.getDate()

  // Handle future dates (reminders) with relative labels
  // For Aside folder, always use relative labels for reminders (even if overdue)
  if (isFutureDate) {
    if (key.startsWith('day-')) {
      if (isToday) {
        return {
          dayName: 'Today',
          dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
        }
      } else if (isTomorrow) {
        return {
          dayName: 'Tomorrow',
          dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
        }
      } else if (daysDiff === 2) {
        return {
          dayName: 'In 2 Days',
          dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
        }
      } else if (daysDiff === 3) {
        return {
          dayName: 'In 3 Days',
          dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
        }
      } else if (daysDiff > 0 && daysDiff <= 6) {
        return {
          dayName: `In ${daysDiff} Days`,
          dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
        }
      } else if (daysDiff < 0 && daysDiff >= -6) {
        // Overdue reminders
        const absDays = Math.abs(daysDiff)
        if (absDays === 1) {
          return {
            dayName: 'Overdue (Yesterday)',
            dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
          }
        } else {
          return {
            dayName: `Overdue (${absDays} Days Ago)`,
            dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
          }
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
      
      // Check if this is next week
      const nextWeekStart = new Date(now)
      nextWeekStart.setDate(now.getDate() + (7 - now.getDay())) // Next Sunday
      const isNextWeek = weekStart.getTime() === nextWeekStart.getTime()
      
      if (isNextWeek) {
        return {
          dayName: 'Next Week',
          dateString: `${weekStart.toLocaleDateString([], { month: 'long', day: 'numeric' })} - ${weekEnd.toLocaleDateString([], { day: 'numeric', year: 'numeric' })}`
        }
      } else {
        return {
          dayName: 'Week of',
          dateString: `${weekStart.toLocaleDateString([], { month: 'long', day: 'numeric' })} - ${weekEnd.toLocaleDateString([], { day: 'numeric', year: 'numeric' })}`
        }
      }
    } else if (key.startsWith('month-')) {
      // Check if this is next month
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const isNextMonth = date.getFullYear() === nextMonth.getFullYear() &&
                          date.getMonth() === nextMonth.getMonth()
      
      if (isNextMonth) {
        return {
          dayName: 'Next Month',
          dateString: date.toLocaleDateString([], { month: 'long', year: 'numeric' })
        }
      } else {
        return {
          dayName: date.toLocaleDateString([], { month: 'long' }),
          dateString: date.toLocaleDateString([], { year: 'numeric' })
        }
      }
    }
  }

  // Handle past dates (regular email view)
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

  // Check if we're viewing Aside folder (reminder emails) - group by reminder date instead of email date
  const isAsideFolder = props.unifiedFolderType === 'aside'

  // Group emails by date key
  const groups = new Map<string, any[]>()
  
  emails.value.forEach(email => {
    // For Aside folder, use reminder_due_date if available, otherwise fall back to email date
    const dateToUse = isAsideFolder && email.reminder_due_date ? email.reminder_due_date : email.date
    const key = getDateKey(dateToUse)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(email)
  })

  // Convert to array and sort by date
  const groupArray = Array.from(groups.entries()).map(([key, groupEmails]) => {
    // For Aside folder, sort by reminder date (earliest first), otherwise by email date (newest first)
    if (isAsideFolder) {
      groupEmails.sort((a, b) => {
        const aDate = a.reminder_due_date || a.date
        const bDate = b.reminder_due_date || b.date
        return aDate - bDate // Earliest reminder first
      })
    } else {
      groupEmails.sort((a, b) => b.date - a.date) // Newest first
    }
    
    // Use reminder date for header if available in Aside folder
    const headerEmails = groupEmails.map(e => ({
      ...e,
      date: isAsideFolder && e.reminder_due_date ? e.reminder_due_date : e.date
    }))
    // Check if this group contains future dates (reminders)
    // For Aside folder, always use relative labels for reminders (even if overdue)
    const hasReminderDate = isAsideFolder && headerEmails[0]?.reminder_due_date
    const isFutureDate = hasReminderDate ? true : false
    const header = getGroupHeader(key, headerEmails, isFutureDate)
    
    // Use reminder date for sorting if available in Aside folder
    const sortDate = isAsideFolder && groupEmails[0]?.reminder_due_date 
      ? groupEmails[0].reminder_due_date 
      : groupEmails[0]?.date || 0
    
    return {
      key,
      emails: groupEmails,
      dayName: header.dayName,
      dateString: header.dateString,
      sortDate
    }
  })

  // Sort groups: for Aside folder, earliest reminder first; otherwise newest first
  if (isAsideFolder) {
    groupArray.sort((a, b) => a.sortDate - b.sortDate) // Earliest first
  } else {
    groupArray.sort((a, b) => b.sortDate - a.sortDate) // Newest first
  }

  return groupArray
})

const refreshEmails = async () => {
  // Clear removed emails cache on refresh since we're getting fresh data
  removedEmails.value.clear()
  pendingSyncedEmails.value = []
  shortcutsCache.clear() // Clear shortcuts cache
  
  // Store current selected email ID before refresh
  const previousSelectedId = props.selectedEmailId
  
  await loadEmails()
  
  // After refresh, check if selected email still exists
  // This handles cases where email was removed externally (e.g., from EmailViewer or another component)
  // Note: EmailList's own delete handlers already handle selection, so this is a fallback
  if (previousSelectedId) {
    await nextTick()
    const flatEmails = getAllEmailsFlat()
    const emailStillExists = flatEmails.some(e => e.id === previousSelectedId)
    
    if (!emailStillExists) {
      if (flatEmails.length > 0) {
        // Selected email was removed externally, select the first email
        emit('select-email', flatEmails[0].id)
      } else {
        // No emails left, clear selection
        emit('select-email', '')
      }
    }
  }
}

const handleRemoveEmailOptimistic = (event: CustomEvent) => {
  const { emailId } = event.detail
  const emailToRemove = emails.value.find(e => e.id === emailId)
  
  if (emailToRemove) {
    // Get flat list before filtering to find next email
    const flatEmails = getAllEmailsFlat()
    const currentIndex = flatEmails.findIndex(e => e.id === emailId)
    
    // Store email for potential restoration
    removedEmails.value.set(emailId, emailToRemove)
    // Remove from list immediately
    emails.value = emails.value.filter(e => e.id !== emailId)
    
    // Update selection if removed email was selected
    if (props.selectedEmailId === emailId) {
      const remainingEmails = getAllEmailsFlat()
      if (remainingEmails.length > 0) {
        // Select next email, or previous if at end
        const nextIndex = currentIndex < remainingEmails.length ? currentIndex : remainingEmails.length - 1
        emit('select-email', remainingEmails[nextIndex].id)
      } else {
        emit('select-email', '')
      }
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
      closeArchivePopover()
    }
  }
  
  if (showReminderModal.value) {
    // Close reminder modal if clicking outside
    const reminderModalElement = target.closest('.bg-white.rounded-lg.shadow-xl')
    if (!reminderModalElement) {
      closeReminderPopover()
    }
  }
  
  if (showFolderPicker.value) {
    // Close folder picker if clicking outside
    const folderPickerElement = target.closest('.folder-picker-popover')
    if (!folderPickerElement) {
      closeFolderPickerPopover()
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
  if (window?.electronAPI?.emails?.onSyncProgress) {
    syncProgressUnsubscribe.value = window.electronAPI.emails.onSyncProgress(handleSyncProgressUpdate)
  }
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

watch([() => props.folderId, () => props.unifiedFolderType, () => props.unifiedFolderAccountIds, () => props.searchQuery, () => threadView.value], () => {
  pendingSyncedEmails.value = []
  loadEmails()
  closeArchivePopover() // Close popover when folder changes
  archivingEmailId.value = null // Clear archiving state when folder changes
  closeReminderPopover()
  closeFolderPickerPopover()
  // Re-focus container when folder changes, but not when search query changes
  // (to avoid stealing focus from search input)
  if (!props.searchQuery) {
    nextTick(() => {
      containerRef.value?.focus()
    })
  }
}, { deep: true })

// Also watch for when emails are loaded to ensure focus
watch(() => emails.value.length, () => {
  if (emails.value.length > 0) {
    nextTick(() => {
      // Don't steal focus if user is typing in search input
      const activeElement = document.activeElement
      const isSearchInput = activeElement?.tagName === 'INPUT' && (activeElement as HTMLInputElement).placeholder?.includes('Search')
      
      if (!isSearchInput) {
        containerRef.value?.focus()
      }
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

// Get keyboard shortcuts for an email
const getEmailShortcuts = async (email: any): Promise<Array<{ key: string; label: string; action: string }>> => {
  const shortcuts: Array<{ key: string; label: string; action: string }> = []
  
  // Always available
  shortcuts.push({ key: '↑', label: '↑', action: 'Previous email' })
  shortcuts.push({ key: '↓', label: '↓', action: 'Next email' })
  
  // Only if email has accountId
  if (email?.accountId) {
    if (!isSpamFolder.value) {
      shortcuts.push({ key: 'Space', label: 'Space', action: 'Archive' })
      shortcuts.push({ key: 'S', label: 'S', action: 'Mark spam' })
    }
    
    shortcuts.push({ key: 'T', label: 'T', action: 'Set reminder' })
    
    // Check if account is IMAP for move to folder
    try {
      const account = await window.electronAPI.accounts.get(email.accountId)
      if (account && account.type === 'imap') {
        shortcuts.push({ key: 'M', label: 'M', action: 'Move to folder' })
      }
    } catch (error) {
      // If we can't check, don't show the shortcut
    }
  }
  
  shortcuts.push({ key: 'Delete', label: 'Delete', action: 'Delete' })
  
  return shortcuts
}

// Cached shortcuts to avoid repeated async calls
const shortcutsCache = new Map<string, Array<{ key: string; label: string; action: string }>>()
const getEmailShortcutsSync = (email: any): Array<{ key: string; label: string; action: string }> => {
  if (!email?.id) return []
  
  // Return cached shortcuts if available
  if (shortcutsCache.has(email.id)) {
    return shortcutsCache.get(email.id)!
  }
  
  // Return basic shortcuts synchronously, will be updated async
  const shortcuts: Array<{ key: string; label: string; action: string }> = []
  shortcuts.push({ key: '↑', label: '↑', action: 'Previous email' })
  shortcuts.push({ key: '↓', label: '↓', action: 'Next email' })
  
  if (email.accountId) {
    if (!isSpamFolder.value) {
      shortcuts.push({ key: 'Space', label: 'Space', action: 'Archive' })
      shortcuts.push({ key: 'S', label: 'S', action: 'Mark spam' })
    }
    shortcuts.push({ key: 'T', label: 'T', action: 'Set reminder' })
    shortcuts.push({ key: 'M', label: 'M', action: 'Move to folder' })
  }
  
  shortcuts.push({ key: 'Delete', label: 'Delete', action: 'Delete' })
  
  // Cache and update async
  shortcutsCache.set(email.id, shortcuts)
  getEmailShortcuts(email).then(updated => {
    shortcutsCache.set(email.id, updated)
  })
  
  return shortcuts
}

// Handle email hover
const handleEmailMouseEnter = async (emailId: string) => {
  // Clear any existing timeout
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }
  
  // Show popover only after 5 seconds of hovering
  hoverTimeout = setTimeout(async () => {
    hoveredEmailId.value = emailId
    
    await nextTick()
    await nextTick()
    
    const emailElement = getEmailElement(emailId)
    const popoverElement = shortcutsPopoverRef.value
    
    if (emailElement && popoverElement) {
      try {
        await positionFloatingElement({
          referenceElement: emailElement,
          floatingElement: popoverElement,
          styleRef: shortcutsPopoverStyle,
          placement: 'right-start'
        })
      } catch (error) {
        console.error('Error positioning shortcuts popover:', error)
        const rect = emailElement.getBoundingClientRect()
        shortcutsPopoverStyle.value = {
          top: `${rect.top}px`,
          left: `${rect.right + 12}px`,
          transform: 'none'
        }
      }
    }
  }, 5000) // 5 second delay
}

const handleEmailMouseLeave = () => {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }
  hoveredEmailId.value = null
}

onUnmounted(() => {
  window.removeEventListener('refresh-emails', refreshEmails)
  window.removeEventListener('remove-email-optimistic', handleRemoveEmailOptimistic as EventListener)
  window.removeEventListener('restore-email', handleRestoreEmail as EventListener)
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('keydown', handleKeyDown)
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }
  if (syncProgressUnsubscribe.value) {
    syncProgressUnsubscribe.value()
    syncProgressUnsubscribe.value = null
  }
})
</script>

<style scoped>
.popover-panel {
  pointer-events: auto;
}

.popover-arrow {
  width: 12px;
  height: 12px;
  position: absolute;
  transform: rotate(45deg);
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.keyboard-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  color: #374151;
  background: linear-gradient(to bottom, #ffffff, #f3f4f6);
  border: 1px solid #d1d5db;
  border-bottom-color: #9ca3af;
  border-radius: 4px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dark .keyboard-key {
  color: #e5e7eb;
  background: linear-gradient(to bottom, #374151, #1f2937);
  border-color: #4b5563;
  border-bottom-color: #6b7280;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}

/* Special styling for arrow keys */
.keyboard-key-arrow {
  font-size: 14px;
  padding: 0 4px;
  text-transform: none;
}

/* Special styling for Space key */
.keyboard-key-space {
  min-width: 50px;
  padding: 0 8px;
}

/* Special styling for Delete key */
.keyboard-key-delete {
  min-width: 45px;
  padding: 0 8px;
}

.keyboard-shortcuts-popover {
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.busy {
  opacity: 0.5;
  pointer-events: none;
}
</style>
