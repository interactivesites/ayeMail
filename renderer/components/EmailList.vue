<template>
  <div ref="containerRef" tabindex="0" class="flex flex-col h-full outline-none" @keydown="handleKeyDown" @focus="handleFocus" @click="handleContainerClick">
    <EmailListHeader
      :folder-name="folderName"
      :preview-level="previewLevel"
      :thread-view="threadView"
      :show-delete-all-button="showDeleteAllButton"
      :deleting-all-emails="deletingAllEmails"
      :emails-count="emails.length"
      @change-preview-level="handlePreviewLevelChange"
      @toggle-thread-view="toggleThreadView"
      @delete-all="handleDeleteAllEmails"
    />
    <ThinScrollbar class="flex-1">
      <div v-if="loading" class="p-4 text-center text-gray-500 dark:text-dark-gray-400">
        {{ $t('email.loadingEmails') }}
      </div>
      <div v-else-if="emails.length === 0" class="p-4 text-center text-gray-500 dark:text-dark-gray-400">
        {{ $t('email.noEmailsInFolder') }}
      </div>
      <div v-else>
        <div v-for="group in groupedEmails" :key="group.key" class="mb-6">
          <!-- Date Group Header -->
          <div class="sticky top-0 z-10 flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-dark-gray-700 bg-white dark:bg-dark-gray-800">
            <span class="text-sm font-medium text-primary-600 dark:text-primary-400">{{ group.dayName }}</span>
            <span class="text-sm text-gray-500 dark:text-dark-gray-400">{{ group.dateString }}</span>
          </div>

          <!-- Email Items -->
          <div class="mx-2">
            <EmailListItem
              v-for="(email, emailIndex) in group.emails"
              :key="email.id"
              v-memo="[
                email.id,
                selectedEmailIds.has(email.id),
                isEmailUnread(email),
                previewLevel,
                isDragging === email.id,
                selectedEmailId === email.id,
                archiveConfirmId === email.id
              ]"
              :email="email"
              :email-global-index="getEmailGlobalIndex(group.emails, emailIndex, group)"
              :selected="selectedEmailIds.has(email.id)"
              :is-archive-folder="isArchiveFolder"
              :is-spam-folder="isSpamFolder"
              :preview-level="previewLevel"
              :unread="isEmailUnread(email)"
              :is-dragging="isDragging === email.id"
              :is-primary-selected="selectedEmailId === email.id"
              :archive-confirm-active="archiveConfirmId === email.id"
              :preview-text="getEmailPreview(email)"
              :time-text="formatTime(email.date)"
              :set-archive-popover-ref="(id: string, el: HTMLElement | null) => { if (el) { archivePopoverRefs.set(id, el) } else { archivePopoverRefs.delete(id) } }"
              :set-archive-arrow-ref="(id: string, el: HTMLElement | null) => { if (el) { archiveArrowRefs.set(id, el) } else { archiveArrowRefs.delete(id) } }"
              @row-click="(e, payload) => handleEmailClick(e, payload.id, payload.index)"
              @row-dblclick="(payload) => handleEmailDoubleClick(payload.id)"
              @row-dragstart="(e, payload) => handleDragStart(e, payload.email)"
              @row-dragend="handleDragEnd"
              @row-mouseenter="(payload) => handleEmailMouseEnter(payload.id)"
              @row-mouseleave="handleEmailMouseLeave"
              @show-archive-confirm="(payload) => showArchiveConfirm(payload.id)"
              @cancel-archive="cancelArchive"
              @confirm-archive="(payload) => confirmArchive(payload.id)"
              @archive-selected="handleArchiveSelected"
              @delete-selected="handleDeleteSelected"
              @reminder-selected="handleReminderSelected"
              @move-to-aside-selected="handleMoveToAsideSelected"
              @move-to-folder-selected="handleMoveToFolderSelected"
              @unspam-selected="handleUnspamSelected"
            />
          </div>
        </div>
      </div>
    </ThinScrollbar>
    <!-- Reminder Modal as Popover -->
    <Teleport to="body">
      <div v-if="showReminderModal && reminderEmail" ref="reminderModalRef" class="popover-panel fixed z-[9999]" :style="reminderModalStyle" style="pointer-events: auto;">
        <div class="popover-arrow bg-white dark:bg-dark-gray-800 border border-gray-200 dark:border-dark-gray-700" ref="reminderArrowRef"></div>
        <ReminderModal :email-id="reminderEmail.id" :account-id="reminderEmail.accountId" :is-popover="true" @close="closeReminderPopover()" @saved="handleReminderSaved" />
      </div>
    </Teleport>

    <!-- Folder Picker Modal as Popover -->
    <Teleport to="body">
      <div v-if="showFolderPicker && folderPickerEmail" ref="folderPickerRef" class="popover-panel fixed z-[9999]" :style="folderPickerStyle" style="pointer-events: auto;">
        <div class="popover-arrow bg-white dark:bg-dark-gray-800 border border-gray-200 dark:border-dark-gray-700" ref="folderPickerArrowRef"></div>
        <FolderPickerModal :account-id="folderPickerEmail.accountId" :current-folder-id="folderId" :is-popover="true" @folder-selected="handleFolderSelected" @close="closeFolderPickerPopover()" />
      </div>
    </Teleport>

    <!-- Keyboard Shortcuts Popover -->
    <Teleport to="body">
      <div v-if="hoveredEmailId" ref="shortcutsPopoverRef" class="keyboard-shortcuts-popover fixed z-[9998] bg-white dark:bg-dark-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-dark-gray-700 p-3 min-w-[200px]" :style="shortcutsPopoverStyle" @mouseenter="handleEmailMouseEnter(hoveredEmailId)" @mouseleave="handleEmailMouseLeave">
        <div class="text-xs font-semibold text-gray-500 dark:text-dark-gray-400 mb-2 uppercase tracking-wide">Keyboard Shortcuts</div>
        <div class="space-y-1.5 mb-3">
          <div v-for="shortcut in getEmailShortcutsSync(getAllEmailsFlat().find(e => e.id === hoveredEmailId) || {})" :key="shortcut.key" class="flex items-center justify-between gap-3">
            <span class="text-xs text-gray-600 dark:text-dark-gray-300">{{ shortcut.action }}</span>
            <div class="flex items-center gap-1">
              <kbd :class="[
                'keyboard-key',
                {
                  'keyboard-key-arrow': shortcut.key === '↑' || shortcut.key === '↓',
                  'keyboard-key-space': shortcut.key === 'Space',
                  'keyboard-key-delete': shortcut.key === 'Delete'
                }
              ]">
                {{ shortcut.label }}
              </kbd>
            </div>
          </div>
        </div>
        <div class="pt-2 border-t border-gray-200 dark:border-dark-gray-700">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-gray-400 dark:text-dark-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span class="text-xs text-gray-500 dark:text-dark-gray-400">Drag item to the right for more actions</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import EmailListHeader from './email/EmailListHeader.vue'
import EmailListItem from './email/EmailListItem.vue'
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import type { Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '../stores/preferences'
import { formatTime } from '../utils/formatters'
import ReminderModal from './ReminderModal.vue'
import FolderPickerModal from './FolderPickerModal.vue'
import ThinScrollbar from './ThinScrollbar.vue'
import { computePosition, offset, shift, arrow as floatingArrow } from '@floating-ui/dom'
import type { Placement, MiddlewareData } from '@floating-ui/dom'
import { Logger } from '@shared/logger'

const logger = Logger.create('EmailList')
const { t: $t } = useI18n()

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
  'select-emails': [ids: string[]]
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

// Multi-selection state
const selectedEmailIds = ref<Set<string>>(new Set())
const lastSelectedIndex = ref<number>(-1) // For Shift+click range selection

// Helper to ensure Vue reactivity when mutating the Set
const setSelected = (fn: (current: Set<string>) => Set<string>) => {
  selectedEmailIds.value = fn(new Set(selectedEmailIds.value))
}

// Sync with prop for backward compatibility
watch(() => props.selectedEmailId, (newId) => {
  if (newId) {
    selectedEmailIds.value = new Set([newId])
  } else if (!newId && selectedEmailIds.value.size === 1 && selectedEmailIds.value.has(props.selectedEmailId || '')) {
    setSelected(() => new Set())
  }
}, { immediate: true })

// Check if we're in spam/junk folder
const isSpamFolder = computed(() => {
  const folderNameLower = props.folderName.toLowerCase()
  return folderNameLower === 'spam' || folderNameLower === 'junk' ||
    props.folderId.toLowerCase().includes('spam') ||
    props.folderId.toLowerCase().includes('junk')
})

// Check if we're in Archive folder (including unified Aside view)
const isArchiveFolder = computed(() => {
  const folderNameLower = props.folderName.toLowerCase()
  // Only check for Archive folders, not Aside folders (they are separate)
  return folderNameLower === 'archive' ||
    props.folderId.toLowerCase().includes('archive')
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

// Get global index of an email across all groups
const getEmailGlobalIndex = (groupEmails: any[], emailIndex: number, group: any): number => {
  const flatEmails = getAllEmailsFlat()
  const email = groupEmails[emailIndex]
  return flatEmails.findIndex(e => e.id === email.id)
}

// Handle email click with multi-selection support
const handleEmailClick = (event: MouseEvent, emailId: string, emailIndex: number) => {
  const isCtrlOrCmd = event.ctrlKey || event.metaKey
  const isShift = event.shiftKey

  if (isShift && lastSelectedIndex.value !== -1) {
    // Range selection
    const start = Math.min(lastSelectedIndex.value, emailIndex)
    const end = Math.max(lastSelectedIndex.value, emailIndex)
    const flatEmails = getAllEmailsFlat()

    for (let i = start; i <= end; i++) {
      if (flatEmails[i]) {
        setSelected(set => {
          set.add(flatEmails[i].id)
          return set
        })
      }
    }
    lastSelectedIndex.value = emailIndex
  } else if (isCtrlOrCmd) {
    // Toggle selection
    if (selectedEmailIds.value.has(emailId)) {
      setSelected(set => {
        set.delete(emailId)
        return set
      })
    } else {
      setSelected(set => {
        set.add(emailId)
        return set
      })
    }
    lastSelectedIndex.value = emailIndex
  } else {
    // Single selection
    setSelected(() => new Set([emailId]))
    lastSelectedIndex.value = emailIndex
    // Emit for backward compatibility
    emit('select-email', emailId)
  }

  // Emit multi-selection event
  emit('select-emails', Array.from(selectedEmailIds.value))
}


const handleEmailDoubleClick = async (emailId: string) => {
  try {
    await window.electronAPI.window.emailViewer.create(emailId)
  } catch (error) {
    logger.error('Error opening email in new window:', error)
  }
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
  const archiveButton = emailElement?.querySelector(`button[title="${$t('email.archiveEmail')}"]`) as HTMLElement
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
      logger.error('Error positioning archive popover:', error)
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

// Handle archive for multiple selected emails
const handleArchiveSelected = async () => {
  const idsToArchive = Array.from(selectedEmailIds.value)
  if (idsToArchive.length === 0) return

  // Check if confirmation is enabled
  if (preferences.confirmArchive) {
    // For now, archive first email to show confirmation
    // In future, could show bulk confirmation
    if (idsToArchive.length === 1) {
      showArchiveConfirm(idsToArchive[0])
      return
    }
    // For multiple, skip confirmation and archive all
  }

  // Get flat list and find index before removal
  const flatEmailsBefore = getAllEmailsFlat()
  const firstRemovedIndex = idsToArchive.length > 0
    ? flatEmailsBefore.findIndex(e => e.id === idsToArchive[0])
    : -1

  // Optimistically remove emails instantly
  const emailsToRemove = idsToArchive.map(id => {
    const emailToRemove = emails.value.find(e => e.id === id)
    if (emailToRemove) {
      removedEmails.value.set(id, emailToRemove)
    }
    return { id, emailToRemove }
  })

  emails.value = emails.value.filter(e => !idsToArchive.includes(e.id))

  // Select next email after removal
  selectNextEmailAfterRemoval(idsToArchive, firstRemovedIndex)

  try {
    // Archive all selected emails
    const archivePromises = idsToArchive.map(async (emailId) => {
      try {
        const result = await window.electronAPI.emails.archive(emailId)
        if (result.success) {
          return { success: true, id: emailId }
        } else {
          logger.error('Failed to archive email:', result.message)
          return { success: false, id: emailId }
        }
      } catch (error) {
        logger.error('Error archiving email:', error)
        return { success: false, id: emailId }
      }
    })

    const results = await Promise.all(archivePromises)
    const failed = results.filter(r => !r.success).map(r => r.id)

    // Restore failed emails
    failed.forEach(emailId => {
      const emailToRestore = removedEmails.value.get(emailId)
      if (emailToRestore) {
        emails.value.push(emailToRestore)
        removedEmails.value.delete(emailId)
      }
    })

    emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
    // Avoid global refresh to prevent list flicker; local optimistic update already applied
  } catch (error) {
    logger.error('Error archiving emails:', error)
    // Restore all emails on error
    emailsToRemove.forEach(({ id, emailToRemove }) => {
      if (emailToRemove) {
        removedEmails.value.delete(id)
        emails.value.push(emailToRemove)
      }
    })
    emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
  }
}

const confirmArchive = async (emailId: string) => {
  closeArchivePopover()

  // If multiple emails selected, archive all
  if (selectedEmailIds.value.has(emailId) && selectedEmailIds.value.size > 1) {
    await handleArchiveSelected()
    return
  }

  // Get flat list and find index before removal
  const flatEmailsBefore = getAllEmailsFlat()
  const currentIndex = flatEmailsBefore.findIndex(e => e.id === emailId)

  // Optimistically remove email instantly
  const emailToRemove = emails.value.find(e => e.id === emailId)
  if (emailToRemove) {
    removedEmails.value.set(emailId, emailToRemove)
  }

  emails.value = emails.value.filter(e => e.id !== emailId)

  // Select next email after removal
  if (selectedEmailIds.value.has(emailId)) {
    selectNextEmailAfterRemoval([emailId], currentIndex)
  }

  try {
    const result = await window.electronAPI.emails.archive(emailId)
    if (result.success) {
      // Avoid global refresh to prevent list flicker; local optimistic update already applied
    } else {
      logger.error('Failed to archive email:', result.message)
      // Restore email on failure
      if (emailToRemove) {
        removedEmails.value.delete(emailId)
        emails.value.push(emailToRemove)
        emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
      }
    }
  } catch (error) {
    logger.error('Error archiving email:', error)
    // Restore email on error
    if (emailToRemove) {
      removedEmails.value.delete(emailId)
      emails.value.push(emailToRemove)
      emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
    }
  }
}

// Handle delete for multiple selected emails
const handleDeleteSelected = async () => {
  const idsToDelete = Array.from(selectedEmailIds.value)
  if (idsToDelete.length === 0) return

  // Get flat list and find index before removal
  const flatEmailsBefore = getAllEmailsFlat()
  const firstRemovedIndex = idsToDelete.length > 0
    ? flatEmailsBefore.findIndex(e => e.id === idsToDelete[0])
    : -1

  // Optimistically remove emails instantly
  const emailsToRemove = idsToDelete.map(id => {
    const emailToRemove = emails.value.find(e => e.id === id)
    if (emailToRemove) {
      removedEmails.value.set(id, emailToRemove)
    }
    return { id, emailToRemove }
  })

  emails.value = emails.value.filter(e => !idsToDelete.includes(e.id))

  // Select next email after removal
  selectNextEmailAfterRemoval(idsToDelete, firstRemovedIndex)

  try {
    // Delete all selected emails
    const deletePromises = idsToDelete.map(async (emailId) => {
      try {
        const result = await window.electronAPI.emails.delete(emailId)
        if (result.success) {
          return { success: true, id: emailId }
        } else {
          logger.error('Failed to delete email:', result.message)
          return { success: false, id: emailId }
        }
      } catch (error) {
        logger.error('Error deleting email:', error)
        return { success: false, id: emailId }
      }
    })

    const results = await Promise.all(deletePromises)
    const failed = results.filter(r => !r.success).map(r => r.id)

    // Restore failed emails
    failed.forEach(emailId => {
      const emailToRestore = removedEmails.value.get(emailId)
      if (emailToRestore) {
        emails.value.push(emailToRestore)
        removedEmails.value.delete(emailId)
      }
    })

    emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
    // Avoid global refresh to prevent list flicker; local optimistic update already applied
  } catch (error) {
    logger.error('Error deleting emails:', error)
    // Restore all emails on error
    emailsToRemove.forEach(({ id, emailToRemove }) => {
      if (emailToRemove) {
        removedEmails.value.delete(id)
        emails.value.push(emailToRemove)
      }
    })
    emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
  }
}

const handleDeleteEmail = async (emailId: string) => {
  if (!emailId) return

  // If this email is in selection, delete all selected
  if (selectedEmailIds.value.has(emailId) && selectedEmailIds.value.size > 1) {
    await handleDeleteSelected()
    return
  }

  // Get flat list and find index before removal
  const flatEmailsBefore = getAllEmailsFlat()
  const currentIndex = flatEmailsBefore.findIndex(e => e.id === emailId)

  // Optimistically remove email instantly
  const emailToRemove = emails.value.find(e => e.id === emailId)
  if (emailToRemove) {
    removedEmails.value.set(emailId, emailToRemove)
  }

  emails.value = emails.value.filter(e => e.id !== emailId)

  // Select next email after removal
  if (selectedEmailIds.value.has(emailId)) {
    selectNextEmailAfterRemoval([emailId], currentIndex)
  }

  try {
    const result = await window.electronAPI.emails.delete(emailId)
    if (result.success) {
      // Avoid global refresh to prevent list flicker; local optimistic update already applied
    } else {
      logger.error('Failed to delete email:', result.message)
      // Restore email on failure
      if (emailToRemove) {
        removedEmails.value.delete(emailId)
        emails.value.push(emailToRemove)
        emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
      }
    }
  } catch (error) {
    logger.error('Error deleting email:', error)
    // Restore email on error
    if (emailToRemove) {
      removedEmails.value.delete(emailId)
      emails.value.push(emailToRemove)
      emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
    }
  }
}

// Handle spam for multiple selected emails
const handleSpamSelected = async () => {
  const idsToSpam = Array.from(selectedEmailIds.value)
  if (idsToSpam.length === 0) return

  // Get flat list and find index before removal
  const flatEmailsBefore = getAllEmailsFlat()
  const firstRemovedIndex = idsToSpam.length > 0
    ? flatEmailsBefore.findIndex(e => e.id === idsToSpam[0])
    : -1

  // Optimistically remove emails instantly
  const emailsToRemove = idsToSpam.map(id => {
    const emailToRemove = emails.value.find(e => e.id === id)
    if (emailToRemove) {
      removedEmails.value.set(id, emailToRemove)
    }
    return { id, emailToRemove }
  })

  emails.value = emails.value.filter(e => !idsToSpam.includes(e.id))

  // Select next email after removal
  selectNextEmailAfterRemoval(idsToSpam, firstRemovedIndex)

  try {
    // Spam all selected emails
    const spamPromises = idsToSpam.map(async (emailId) => {
      try {
        const result = await window.electronAPI.emails.spam(emailId)
        if (result.success) {
          return { success: true, id: emailId }
        } else {
          logger.error('Failed to mark email as spam:', result.message)
          return { success: false, id: emailId }
        }
      } catch (error) {
        logger.error('Error marking email as spam:', error)
        return { success: false, id: emailId }
      }
    })

    const results = await Promise.all(spamPromises)
    const failed = results.filter(r => !r.success).map(r => r.id)

    // Restore failed emails
    failed.forEach(emailId => {
      const emailToRestore = removedEmails.value.get(emailId)
      if (emailToRestore) {
        emails.value.push(emailToRestore)
        removedEmails.value.delete(emailId)
      }
    })

    emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
    // Avoid global refresh to prevent list flicker; local optimistic update already applied
  } catch (error) {
    logger.error('Error marking emails as spam:', error)
    // Restore all emails on error
    emailsToRemove.forEach(({ id, emailToRemove }) => {
      if (emailToRemove) {
        removedEmails.value.delete(id)
        emails.value.push(emailToRemove)
      }
    })
    emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
  }
}

const handleSpamEmail = async (emailId: string) => {
  if (!emailId) return

  // If this email is in selection, spam all selected
  if (selectedEmailIds.value.has(emailId) && selectedEmailIds.value.size > 1) {
    await handleSpamSelected()
    return
  }

  // Get flat list and find index before removal
  const flatEmailsBefore = getAllEmailsFlat()
  const currentIndex = flatEmailsBefore.findIndex(e => e.id === emailId)

  // Optimistically remove email instantly
  const emailToRemove = emails.value.find(e => e.id === emailId)
  if (emailToRemove) {
    removedEmails.value.set(emailId, emailToRemove)
  }

  emails.value = emails.value.filter(e => e.id !== emailId)

  // Select next email after removal
  if (selectedEmailIds.value.has(emailId)) {
    selectNextEmailAfterRemoval([emailId], currentIndex)
  }

  try {
    const result = await window.electronAPI.emails.spam(emailId)
    if (result.success) {
      // Avoid global refresh to prevent list flicker; local optimistic update already applied
    } else {
      logger.error('Failed to mark email as spam:', result.message)
      // Restore email on failure
      if (emailToRemove) {
        removedEmails.value.delete(emailId)
        emails.value.push(emailToRemove)
        emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
      }
    }
  } catch (error) {
    logger.error('Error marking email as spam:', error)
    // Restore email on error
    if (emailToRemove) {
      removedEmails.value.delete(emailId)
      emails.value.push(emailToRemove)
      emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
    }
  }
}

// Handle unspam for multiple selected emails
const handleUnspamSelected = async () => {
  const idsToUnspam = Array.from(selectedEmailIds.value)
  if (idsToUnspam.length === 0) return

  const flatEmails = getAllEmailsFlat()
  const emailsToUnspam = idsToUnspam.map(id => flatEmails.find(e => e.id === id)).filter(Boolean)

  // Group by accountId to batch folder lookups
  const emailsByAccount = new Map<string, any[]>()
  emailsToUnspam.forEach(email => {
    if (email && email.accountId) {
      if (!emailsByAccount.has(email.accountId)) {
        emailsByAccount.set(email.accountId, [])
      }
      emailsByAccount.get(email.accountId)!.push(email)
    }
  })

  // Get flat list and find index before removal
  const flatEmailsBefore = getAllEmailsFlat()
  const firstRemovedIndex = idsToUnspam.length > 0
    ? flatEmailsBefore.findIndex(e => e.id === idsToUnspam[0])
    : -1

  // Optimistically remove emails instantly
  const emailsToRemove = idsToUnspam.map(id => {
    const emailToRemove = emails.value.find(e => e.id === id)
    if (emailToRemove) {
      removedEmails.value.set(id, emailToRemove)
    }
    return { id, emailToRemove }
  })

  emails.value = emails.value.filter(e => !idsToUnspam.includes(e.id))

  // Select next email after removal
  selectNextEmailAfterRemoval(idsToUnspam, firstRemovedIndex)

  try {
    // Get inbox folders for all accounts
    const accountFolders = new Map<string, string>()
    for (const [accountId] of emailsByAccount) {
      try {
        const folders = await window.electronAPI.folders.list(accountId)
        const inboxFolder = folders.find((f: any) => f.name.toLowerCase() === 'inbox')
        if (inboxFolder) {
          accountFolders.set(accountId, inboxFolder.id)
        }
      } catch (error) {
        logger.error(`Error getting folders for account ${accountId}:`, error)
      }
    }

    // Move all emails to inbox
    const movePromises = emailsToUnspam.map(async (email) => {
      if (!email || !email.accountId) return { success: false, id: email?.id }

      const inboxFolderId = accountFolders.get(email.accountId)
      if (!inboxFolderId) {
        logger.error('Inbox folder not found for account:', email.accountId)
        return { success: false, id: email.id }
      }

      try {
        const result = await window.electronAPI.emails.moveToFolder(email.id, inboxFolderId)
        if (result.success) {
          return { success: true, id: email.id }
        } else {
          logger.error('Failed to un-spam email:', result.message)
          return { success: false, id: email.id }
        }
      } catch (error) {
        logger.error('Error un-spamming email:', error)
        return { success: false, id: email.id }
      }
    })

    const results = await Promise.all(movePromises)
    const failed = results.filter(r => !r.success).map(r => r.id)

    // Restore failed emails
    failed.forEach(emailId => {
      const emailToRestore = removedEmails.value.get(emailId)
      if (emailToRestore) {
        emails.value.push(emailToRestore)
        removedEmails.value.delete(emailId)
      }
    })

    emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
    // Avoid global refresh to prevent list flicker; local optimistic update already applied
  } catch (error) {
    logger.error('Error un-spamming emails:', error)
    // Restore all emails on error
    emailsToRemove.forEach(({ id, emailToRemove }) => {
      if (emailToRemove) {
        removedEmails.value.delete(id)
        emails.value.push(emailToRemove)
      }
    })
    emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
  }
}

const handleDeleteAllEmails = async () => {
  if (emails.value.length === 0) return

  // Confirm deletion
  const count = emails.value.length
  const confirmMessage = $t('emailList.confirmDeleteAll', {
    count,
    plural: count === 1 ? '' : 's'
  })
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
          logger.error(`Error deleting email ${emailId}:`, error)
          errorCount++
        }
      })

      await Promise.all(promises)

      // Small delay between batches to keep UI responsive
      if (i + batchSize < allEmailIds.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    // Select next email after deletion (or clear if none remain)
    const remainingEmails = getAllEmailsFlat()
    if (remainingEmails.length > 0) {
      // Select first remaining email
      setSelected(() => new Set([remainingEmails[0].id]))
      lastSelectedIndex.value = 0
      emit('select-email', remainingEmails[0].id)
      emit('select-emails', [remainingEmails[0].id])
    } else {
      // No emails left, clear selection
      setSelected(() => new Set())
      lastSelectedIndex.value = -1
      emit('select-email', '')
      emit('select-emails', [])
    }

    // Avoid global refresh to prevent list flicker; local optimistic update already applied

    if (errorCount > 0) {
      alert($t('emailList.deleteAllResult', {
        success: successCount,
        successPlural: successCount === 1 ? '' : 's',
        error: errorCount,
        errorPlural: errorCount === 1 ? '' : 's'
      }))
    }
  } catch (error) {
    logger.error('Error deleting all emails:', error)
    alert($t('emailList.deleteAllError'))
  } finally {
    deletingAllEmails.value = false
  }
}

const handleReminderSaved = async () => {
  closeReminderPopover()

  // Refresh the email list to reflect the move to Reminders folder
  await loadEmails()
}

// Handle reminder for multiple selected emails
const handleReminderSelected = async () => {
  const idsToRemind = Array.from(selectedEmailIds.value)
  if (idsToRemind.length === 0) return

  // For multiple emails, show reminder modal for the first one
  // The reminder modal can handle multiple emails if needed
  const firstEmailId = idsToRemind[0]
  const email = getAllEmailsFlat().find(e => e.id === firstEmailId)
  if (!email || !email.accountId) {
    logger.error('Email not found or missing accountId', { emailId: firstEmailId, email })
    return
  }

  await showReminderForEmail(firstEmailId)
}

const showReminderForEmail = async (emailId: string) => {
  const email = getAllEmailsFlat().find(e => e.id === emailId)
  if (!email || !email.accountId) {
    logger.error('Email not found or missing accountId', { emailId, email })
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
      logger.error('Error positioning reminder modal:', error)
      // Fallback positioning
      const rect = referenceElement.getBoundingClientRect()
      reminderModalStyle.value = {
        top: `${rect.top}px`,
        left: `${rect.right + 12}px`,
        transform: 'none'
      }
    }
  } else {
    logger.warn('Email or modal element not found, keeping centered position')
  }
}

// Handle folder picker for multiple selected emails
const handleMoveToFolderSelected = async () => {
  const idsToMove = Array.from(selectedEmailIds.value)
  if (idsToMove.length === 0) return

  // For multiple emails, show folder picker for the first one
  // The folder picker will move all selected emails
  const firstEmailId = idsToMove[0]
  const email = getAllEmailsFlat().find(e => e.id === firstEmailId)
  if (!email || !email.accountId) {
    logger.error('Email not found or missing accountId', { emailId: firstEmailId, email })
    return
  }

  await showFolderPickerForEmail(firstEmailId)
}

const showFolderPickerForEmail = async (emailId: string) => {
  const email = getAllEmailsFlat().find(e => e.id === emailId)
  if (!email || !email.accountId) {
    logger.error('Email not found or missing accountId', { emailId, email })
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
    logger.error('Error checking account type:', error)
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
      logger.error('Error positioning folder picker:', error)
      const rect = referenceElement.getBoundingClientRect()
      folderPickerStyle.value = {
        top: `${rect.top}px`,
        left: `${rect.right + 12}px`,
        transform: 'none'
      }
    }
  }
}

// Handle move to Aside for multiple selected emails
const handleMoveToAsideSelected = async () => {
  const idsToMove = Array.from(selectedEmailIds.value)
  if (idsToMove.length === 0) return

  const flatEmails = getAllEmailsFlat()
  const emailsToMove = idsToMove.map(id => flatEmails.find(e => e.id === id)).filter(Boolean)

  // Group by accountId to batch folder lookups
  const emailsByAccount = new Map<string, any[]>()
  emailsToMove.forEach(email => {
    if (email && email.accountId) {
      if (!emailsByAccount.has(email.accountId)) {
        emailsByAccount.set(email.accountId, [])
      }
      emailsByAccount.get(email.accountId)!.push(email)
    }
  })

  // Get flat list and find index before removal
  const flatEmailsBefore = getAllEmailsFlat()
  const firstRemovedIndex = idsToMove.length > 0
    ? flatEmailsBefore.findIndex(e => e.id === idsToMove[0])
    : -1

  // Optimistically remove emails instantly
  const emailsToRemove = emailsToMove.map(email => {
    const emailToRemove = emails.value.find(e => e.id === email.id)
    if (emailToRemove) {
      removedEmails.value.set(email.id, emailToRemove)
    }
    return { email, emailToRemove }
  })

  emails.value = emails.value.filter(e => !idsToMove.includes(e.id))

  // Select next email after removal
  selectNextEmailAfterRemoval(idsToMove, firstRemovedIndex)

  try {
    // Get or create Aside folders for all accounts
    const accountAsideFolders = new Map<string, string>()
    for (const [accountId] of emailsByAccount) {
      try {
        const folders = await window.electronAPI.folders.list(accountId)
        const flattenFolders = (folderList: any[]): any[] => {
          const result: any[] = []
          for (const folder of folderList) {
            result.push(folder)
            if (folder.children && folder.children.length > 0) {
              result.push(...flattenFolders(folder.children))
            }
          }
          return result
        }
        const allFolders = flattenFolders(folders)
        let asideFolder = allFolders.find((f: any) =>
          f.name.toLowerCase() === 'aside' || f.path?.toLowerCase().includes('aside')
        )

        // If Aside folder doesn't exist, create it
        if (!asideFolder) {
          asideFolder = await window.electronAPI.folders.create(accountId, 'Aside')
        }

        if (asideFolder) {
          accountAsideFolders.set(accountId, asideFolder.id)
        }
      } catch (error) {
        logger.error(`Error getting/creating Aside folder for account ${accountId}:`, error)
      }
    }

    // Move all emails to Aside
    const movePromises = emailsToMove.map(async (email) => {
      if (!email || !email.accountId) return { success: false, id: email?.id }

      const asideFolderId = accountAsideFolders.get(email.accountId)
      if (!asideFolderId) {
        logger.error('Aside folder not found for account:', email.accountId)
        return { success: false, id: email.id }
      }

      try {
        await window.electronAPI.emails.moveToFolder(email.id, asideFolderId)
        return { success: true, id: email.id }
      } catch (error) {
        logger.error('Error moving email to Aside:', error)
        return { success: false, id: email.id }
      }
    })

    const results = await Promise.all(movePromises)
    const failed = results.filter(r => !r.success).map(r => r.id)

    // Restore failed emails
    failed.forEach(emailId => {
      const emailToRestore = removedEmails.value.get(emailId)
      if (emailToRestore) {
        emails.value.push(emailToRestore)
        removedEmails.value.delete(emailId)
      }
    })

    emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
    // Avoid global refresh to prevent list flicker; local optimistic update already applied
  } catch (error: any) {
    logger.error('Error moving emails to Aside:', error)
    // Restore all emails on error
    emailsToRemove.forEach(({ email, emailToRemove }) => {
      if (emailToRemove) {
        removedEmails.value.delete(email.id)
        emails.value.push(emailToRemove)
      }
    })
    emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
  }
}

const handleMoveToAside = async (emailId: string) => {
  const email = getAllEmailsFlat().find(e => e.id === emailId)
  if (!email || !email.accountId) {
    logger.error('Email not found or missing accountId', { emailId, email })
    return
  }

  // If this email is in selection, move all selected
  if (selectedEmailIds.value.has(emailId) && selectedEmailIds.value.size > 1) {
    await handleMoveToAsideSelected()
    return
  }

    // Get flat list and find index before removal
    const flatEmailsBefore = getAllEmailsFlat()
    const currentIndex = flatEmailsBefore.findIndex(e => e.id === emailId)

    // Optimistically remove email instantly
    const emailToRemove = emails.value.find(e => e.id === emailId)
    if (emailToRemove) {
      removedEmails.value.set(emailId, emailToRemove)
      emails.value = emails.value.filter(e => e.id !== emailId)

      // Select next email after removal
      if (selectedEmailIds.value.has(emailId)) {
        selectNextEmailAfterRemoval([emailId], currentIndex)
      }
    }

  try {
    // Find or create Aside folder for this account
    const folders = await window.electronAPI.folders.list(email.accountId)
    const flattenFolders = (folderList: any[]): any[] => {
      const result: any[] = []
      for (const folder of folderList) {
        result.push(folder)
        if (folder.children && folder.children.length > 0) {
          result.push(...flattenFolders(folder.children))
        }
      }
      return result
    }
    const allFolders = flattenFolders(folders)
    let asideFolder = allFolders.find((f: any) =>
      f.name.toLowerCase() === 'aside' || f.path?.toLowerCase().includes('aside')
    )

    // If Aside folder doesn't exist, create it
    if (!asideFolder) {
      asideFolder = await window.electronAPI.folders.create(email.accountId, 'Aside')
    }

    if (asideFolder) {
      await window.electronAPI.emails.moveToFolder(emailId, asideFolder.id)
      // Avoid global refresh to prevent list flicker; local optimistic update already applied
    }
  } catch (error: any) {
    logger.error('Error moving email to Aside folder:', error)
    // Restore email on error
    if (emailToRemove) {
      removedEmails.value.delete(emailId)
      emails.value.push(emailToRemove)
      emails.value.sort((a, b) => (b.date || 0) - (a.date || 0))
    }
  }
}

const handleFolderSelected = async (folderId: string) => {
  if (!folderPickerEmail.value) return

  const emailId = folderPickerEmail.value.id

  // If multiple emails are selected, move all of them
  const idsToMove = selectedEmailIds.value.size > 1
    ? Array.from(selectedEmailIds.value)
    : [emailId]

  // Get flat list and find index before removal
  const flatEmailsBefore = getAllEmailsFlat()
  const firstRemovedIndex = idsToMove.length > 0
    ? flatEmailsBefore.findIndex(e => e.id === idsToMove[0])
    : -1

  // Optimistically remove emails instantly
  const emailsToRemove = idsToMove.map(id => {
    const emailToRemove = emails.value.find(e => e.id === id)
    if (emailToRemove) {
      removedEmails.value.set(id, emailToRemove)
    }
    return { id, emailToRemove }
  })

  emails.value = emails.value.filter(e => !idsToMove.includes(e.id))

  // Select next email after removal
  selectNextEmailAfterRemoval(idsToMove, firstRemovedIndex)

  try {
    // Move all selected emails to the folder
    const movePromises = idsToMove.map(async (id) => {
      try {
        await window.electronAPI.emails.moveToFolder(id, folderId)
        return { success: true, id }
      } catch (error: any) {
        logger.error(`Error moving email ${id} to folder:`, error)
        return { success: false, id, error }
      }
    })

    const results = await Promise.all(movePromises)
    const failed = results.filter(r => !r.success)

    // Restore failed emails
    failed.forEach(({ id }) => {
      const emailToRestore = removedEmails.value.get(id)
      if (emailToRestore) {
        emails.value.push(emailToRestore)
        removedEmails.value.delete(id)
      }
    })

    emails.value.sort((a, b) => b.date - a.date)
    // Avoid global refresh to prevent list flicker; local optimistic update already applied

    if (failed.length > 0) {
      alert($t('emailList.moveFailed', {
        count: failed.length,
        plural: failed.length === 1 ? '' : 's'
      }))
    }
  } catch (error: any) {
    logger.error('Error moving emails to folder:', error)
    // Restore all emails on error
    emailsToRemove.forEach(({ id, emailToRemove }) => {
      if (emailToRemove) {
        removedEmails.value.delete(id)
        emails.value.push(emailToRemove)
      }
    })
    emails.value.sort((a, b) => b.date - a.date)
    alert($t('emailList.moveError', { error: error.message || $t('common.error') }))
  } finally {
    closeFolderPickerPopover()
  }
}

// Get all emails as a flat array (for navigation)
const getAllEmailsFlat = (): any[] => {
  return groupedEmails.value.flatMap(group => group.emails)
}

// Helper function to select next email after removal
// removedEmailIds: array of email IDs that were removed
// originalIndex: optional index of the first removed email BEFORE removal (for better positioning)
const selectNextEmailAfterRemoval = (removedEmailIds: string[], originalIndex?: number) => {
  const flatEmails = getAllEmailsFlat()

  // Use provided index or try to find from lastSelectedIndex
  let currentIndex = originalIndex !== undefined ? originalIndex : lastSelectedIndex.value

  // If we still don't have an index, try to find the first removed email's position
  // by checking if any selected email matches (for single selection cases)
  if (currentIndex === -1 && removedEmailIds.length > 0) {
    // For single removal, we can estimate: if we had a selection, it was likely at lastSelectedIndex
    // But since emails are already removed, we'll just use 0 or lastSelectedIndex if valid
    currentIndex = lastSelectedIndex.value >= 0 ? lastSelectedIndex.value : 0
  }

  // Select next email, or previous if at end, or first if we were at first
  if (flatEmails.length > 0) {
    // Clamp index to valid range
    const nextIndex = currentIndex >= 0 && currentIndex < flatEmails.length
      ? currentIndex
      : flatEmails.length - 1
    const nextId = flatEmails[nextIndex].id
    setSelected(() => new Set([nextId]))
    lastSelectedIndex.value = nextIndex
    emit('select-email', nextId)
    emit('select-emails', [nextId])
  } else {
    // No emails left, clear selection
    setSelected(() => new Set())
    lastSelectedIndex.value = -1
    emit('select-email', '')
    emit('select-emails', [])
  }
}

// Navigate to next/previous email
const navigateEmail = (direction: 'up' | 'down') => {
  const flatEmails = getAllEmailsFlat()
  if (flatEmails.length === 0) return

  // Get the first selected email or use the prop for backward compatibility
  const currentEmailId = selectedEmailIds.value.size > 0
    ? Array.from(selectedEmailIds.value)[0]
    : props.selectedEmailId

  const currentIndex = currentEmailId
    ? flatEmails.findIndex(e => e.id === currentEmailId)
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
    // Clear selection and select new email
    setSelected(() => new Set([newEmail.id]))
    lastSelectedIndex.value = newIndex
    emit('select-email', newEmail.id)
    emit('select-emails', [newEmail.id])
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

  // Don't handle shortcuts when Ctrl/Cmd modifiers are pressed (only plain keys)
  if (event.ctrlKey || event.metaKey) {
    return
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
    case 'Backspace':
      if (selectedEmailIds.value.size > 0) {
        event.preventDefault()
        event.stopPropagation()
        if (selectedEmailIds.value.size > 1) {
          handleDeleteSelected()
        } else {
          const emailId = Array.from(selectedEmailIds.value)[0]
          handleDeleteEmail(emailId)
        }
      }
      break
    case ' ':
      if (selectedEmailIds.value.size > 0) {
        event.preventDefault()
        event.stopPropagation()
        if (selectedEmailIds.value.size > 1) {
          handleArchiveSelected()
        } else {
          const emailId = Array.from(selectedEmailIds.value)[0]
          showArchiveConfirm(emailId)
        }
      }
      break
    case 't':
    case 'T':
    case 'r':
    case 'R':
      if (selectedEmailIds.value.size > 0) {
        event.preventDefault()
        event.stopPropagation()
        if (selectedEmailIds.value.size > 1) {
          handleReminderSelected()
        } else {
          const emailId = Array.from(selectedEmailIds.value)[0]
          showReminderForEmail(emailId)
        }
      }
      break
    case 's':
    case 'S':
    case 'j':
    case 'J':
      if (selectedEmailIds.value.size > 0) {
        event.preventDefault()
        event.stopPropagation()
        if (selectedEmailIds.value.size > 1) {
          handleSpamSelected()
        } else {
          const emailId = Array.from(selectedEmailIds.value)[0]
          handleSpamEmail(emailId)
        }
      }
      break
    case 'a':
    case 'A':
      if (selectedEmailIds.value.size > 0) {
        event.preventDefault()
        event.stopPropagation()
        if (selectedEmailIds.value.size > 1) {
          handleMoveToAsideSelected()
        } else {
          const emailId = Array.from(selectedEmailIds.value)[0]
          handleMoveToAside(emailId)
        }
      }
      break
    case 'm':
    case 'M':
      if (selectedEmailIds.value.size > 0) {
        event.preventDefault()
        event.stopPropagation()
        if (selectedEmailIds.value.size > 1) {
          handleMoveToFolderSelected()
        } else {
          const emailId = Array.from(selectedEmailIds.value)[0]
          showFolderPickerForEmail(emailId)
        }
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
      logger.error('Error searching emails:', error)
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
      // For Reminders folder, unifiedFolderAccountIds is empty array, which is valid
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
    logger.error('Error loading emails:', error)
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
  // For Reminders folder, always use relative labels for reminders (even if overdue)
  if (isFutureDate) {
    if (key.startsWith('day-')) {
      if (isToday) {
        return {
          dayName: $t('emailList.today'),
          dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
        }
      } else if (isTomorrow) {
        return {
          dayName: $t('emailList.tomorrow'),
          dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
        }
      } else if (daysDiff === 2) {
        return {
          dayName: $t('emailList.in2Days'),
          dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
        }
      } else if (daysDiff === 3) {
        return {
          dayName: $t('emailList.in3Days'),
          dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
        }
      } else if (daysDiff > 0 && daysDiff <= 6) {
        return {
          dayName: $t('emailList.inDays', { count: daysDiff }),
          dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
        }
      } else if (daysDiff < 0 && daysDiff >= -6) {
        // Overdue reminders
        const absDays = Math.abs(daysDiff)
        if (absDays === 1) {
          return {
            dayName: $t('emailList.overdueYesterday'),
            dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
          }
        } else {
          return {
            dayName: $t('emailList.overdueDaysAgo', { count: absDays }),
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
          dayName: $t('emailList.nextWeek'),
          dateString: `${weekStart.toLocaleDateString([], { month: 'long', day: 'numeric' })} - ${weekEnd.toLocaleDateString([], { day: 'numeric', year: 'numeric' })}`
        }
      } else {
        return {
          dayName: $t('emailList.weekOf'),
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
          dayName: $t('emailList.nextMonth'),
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
        dayName: $t('emailList.today'),
        dateString: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
      }
    } else if (isYesterday) {
      return {
        dayName: $t('emailList.yesterday'),
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

  // Check if we're viewing Reminders folder (reminder emails) - group by reminder date instead of email date
  const isRemindersFolder = props.unifiedFolderType === 'reminders'

  // Group emails by date key
  const groups = new Map<string, any[]>()

  emails.value.forEach(email => {
    // For Reminders folder, use reminder_due_date if available, otherwise fall back to email date
    const dateToUse = isRemindersFolder && email.reminder_due_date ? email.reminder_due_date : email.date
    const key = getDateKey(dateToUse)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(email)
  })

  // Convert to array and sort by date
  const groupArray = Array.from(groups.entries()).map(([key, groupEmails]) => {
    // For Reminders folder, sort by reminder date (earliest first), otherwise by email date (newest first)
    if (isRemindersFolder) {
      groupEmails.sort((a, b) => {
        const aDate = a.reminder_due_date || a.date
        const bDate = b.reminder_due_date || b.date
        return aDate - bDate // Earliest reminder first
      })
    } else {
      groupEmails.sort((a, b) => b.date - a.date) // Newest first
    }

    // Use reminder date for header if available in Reminders folder
    const headerEmails = groupEmails.map(e => ({
      ...e,
      date: isRemindersFolder && e.reminder_due_date ? e.reminder_due_date : e.date
    }))
    // Check if this group contains future dates (reminders)
    // For Reminders folder, always use relative labels for reminders (even if overdue)
    const hasReminderDate = isRemindersFolder && headerEmails[0]?.reminder_due_date
    const isFutureDate = hasReminderDate ? true : false
    const header = getGroupHeader(key, headerEmails, isFutureDate)

    // Use reminder date for sorting if available in Reminders folder
    const sortDate = isRemindersFolder && groupEmails[0]?.reminder_due_date
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

  // Sort groups: for Reminders folder, earliest reminder first; otherwise newest first
  if (isRemindersFolder) {
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

  // Store current selected email IDs before refresh
  const previousSelectedIds = Array.from(selectedEmailIds.value)
  const previousSelectedId = props.selectedEmailId || (previousSelectedIds.length > 0 ? previousSelectedIds[0] : null)

  await loadEmails()

  // After refresh, check if selected emails still exist
  // This handles cases where emails were removed externally (e.g., from EmailViewer or another component)
  // Note: EmailList's own delete handlers already handle selection, so this is a fallback
  await nextTick()
  const flatEmails = getAllEmailsFlat()

  if (previousSelectedIds.length > 0) {
    // Filter out emails that no longer exist
    const validSelectedIds = previousSelectedIds.filter(id => flatEmails.some(e => e.id === id))

    if (validSelectedIds.length > 0) {
      // Restore valid selections
      selectedEmailIds.value = new Set(validSelectedIds)
      emit('select-email', validSelectedIds[0])
      emit('select-emails', validSelectedIds)
    } else {
      // No valid selections, select first email if available
      if (flatEmails.length > 0) {
        selectedEmailIds.value = new Set([flatEmails[0].id])
        emit('select-email', flatEmails[0].id)
        emit('select-emails', [flatEmails[0].id])
      } else {
        setSelected(() => new Set())
        emit('select-email', '')
        emit('select-emails', [])
      }
    }
  } else if (previousSelectedId) {
    // Backward compatibility: check single selected email
    const emailStillExists = flatEmails.some(e => e.id === previousSelectedId)

    if (!emailStillExists) {
      if (flatEmails.length > 0) {
        // Selected email was removed externally, select the first email
        selectedEmailIds.value = new Set([flatEmails[0].id])
        emit('select-email', flatEmails[0].id)
        emit('select-emails', [flatEmails[0].id])
      } else {
        // No emails left, clear selection
        setSelected(() => new Set())
        emit('select-email', '')
        emit('select-emails', [])
      }
    }
  }
}

const handleRemoveEmailOptimistic = (event: CustomEvent) => {
  const { emailId } = event.detail
  const emailToRemove = emails.value.find(e => e.id === emailId)

  if (emailToRemove) {
    // Get flat list and find index before removal
    const flatEmailsBefore = getAllEmailsFlat()
    const currentIndex = flatEmailsBefore.findIndex(e => e.id === emailId)

    // Store email for potential restoration
    removedEmails.value.set(emailId, emailToRemove)
    // Remove from list immediately
    emails.value = emails.value.filter(e => e.id !== emailId)

    // Update selection if removed email was selected
    if (selectedEmailIds.value.has(emailId)) {
      // If this was the only selected email, select next
      if (selectedEmailIds.value.size === 1) {
        selectNextEmailAfterRemoval([emailId], currentIndex)
      } else {
        // Multiple selections - remove this one and keep others
        setSelected(set => {
          set.delete(emailId)
          return set
        })
        const firstId = Array.from(selectedEmailIds.value)[0]
        emit('select-email', firstId)
        emit('select-emails', Array.from(selectedEmailIds.value))
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
  if (target === containerRef.value || target.closest('.thin-scrollbar')) {
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

  // Auto-focus the container
  nextTick(() => {
    containerRef.value?.focus()
  })
})

watch([() => props.folderId, () => props.unifiedFolderType, () => props.unifiedFolderAccountIds, () => props.searchQuery, () => threadView.value], () => {
  pendingSyncedEmails.value = []
  loadEmails()
  closeArchivePopover() // Close popover when folder changes
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
      if (selectedEmailIds.value.size === 0 && !props.selectedEmailId) {
        const flatEmails = getAllEmailsFlat()
        if (flatEmails.length > 0) {
          setSelected(set => {
            set.add(flatEmails[0].id)
            return set
          })
          lastSelectedIndex.value = 0
          emit('select-email', flatEmails[0].id)
          emit('select-emails', [flatEmails[0].id])
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

  // Only if email has accountId
  if (email?.accountId) {
    if (!isSpamFolder.value) {
      shortcuts.push({ key: 'Space', label: 'Space', action: 'Archive' })
      shortcuts.push({ key: 'S', label: 'S', action: 'Mark spam' })
    }

    shortcuts.push({ key: 'T', label: 'T', action: $t('navigation.setReminder') })
    shortcuts.push({ key: 'A', label: 'A', action: $t('emailList.moveToAside') })

    // Check if account is IMAP for move to folder
    try {
      const account = await window.electronAPI.accounts.get(email.accountId)
      if (account && account.type === 'imap') {
        shortcuts.push({ key: 'M', label: 'M', action: $t('navigation.moveToFolder') })
      }
    } catch (error) {
      // If we can't check, don't show the shortcut
    }
  }

  shortcuts.push({ key: 'Delete', label: 'Delete', action: $t('common.delete') })

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
  // shortcuts.push({ key: '↑', label: '↑', action: 'Previous email' })
  // shortcuts.push({ key: '↓', label: '↓', action: 'Next email' })

  if (email.accountId) {
    shortcuts.push({ key: 'A', label: 'A', action: $t('emailList.moveToAside') })
    shortcuts.push({ key: 'T', label: 'T', action: $t('navigation.setReminder') })
    shortcuts.push({ key: 'M', label: 'M', action: $t('navigation.moveToFolder') })
    if (!isSpamFolder.value) {
      shortcuts.push({ key: 'Space', label: 'Space', action: $t('navigation.archive') })
      shortcuts.push({ key: 'S', label: 'S', action: $t('emailList.markSpam') })
    }
  }

  shortcuts.push({ key: 'Delete', label: 'Delete', action: $t('common.delete') })

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
        logger.error('Error positioning shortcuts popover:', error)
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
</style>
