<template>
  <div class="relative h-full w-full overflow-hidden flex flex-col" ref="containerRef">
    <!-- Email Navigation -->


    <div class="flex-1 relative overflow-hidden flex">
      <div class="absolute top-6 left-8 px-8 py-4 z-10">
        <!-- Meta: current folder / mail count -->
        <div class="flex justify-between text-sm opacity-70 dark:text-dark-gray-400 uppercase">
          <span class="mr-8">{{ currentFolderName }}</span>
          <span class="text-3xl" v-if="mails.length > 0">{{ currentIndex + 1 }}/{{ mails.length }}</span>
          <span v-else>0 emails</span>
        </div>
        <EmailNavigation class="!ml-0 mt-4" :has-selected-email="!!selectedEmailId" :selected-email="selectedEmail" :account-id="accountId" @compose="handleCompose" @reply="handleReply" @forward="handleForward" @set-reminder="handleSetReminder" @archive="handleArchive" @move-to-folder="handleMoveToFolder" @delete="handleDelete" />
      </div>

      <div ref="mailbox" class="relative w-full max-w-2xl flex-shrink-0 h-full flex items-center" @wheel="handleWheel">
        <div v-for="(mail, index) in mails" :key="mail.id" :ref="el => { mailRefs[index] = el as HTMLElement | null }" class="absolute w-full px-8 cursor-pointer" @click="handleItemClick(index)" @dblclick="handleEmailDoubleClick(mail.id)" :data-email-id="mail.id">
          <span class="email-popover-anchor absolute top-1/2 right-3 w-0 h-0 transform -translate-y-1/2 pointer-events-none" :data-email-anchor="mail.id"></span>
          <div class="dark:text-white flex items-start gap-3">
            <!-- Rounded Checkbox -->
            <div class="flex-shrink-0 self-center relative">
              <button @click.stop="showArchiveConfirm(mail.id)" class="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-dark-gray-600 flex items-center justify-center transition-colors hover:border-primary-600 dark:hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-1" :class="{
                'bg-primary-600 dark:bg-primary-500 border-primary-600 dark:border-primary-500': archiveConfirmId === mail.id,
                'hover:bg-gray-50 dark:hover:bg-gray-700': archiveConfirmId !== mail.id
              }" title="Archive email">
                <svg v-if="archiveConfirmId === mail.id" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </button>

              <!-- Archive Confirmation Popover -->
              <Teleport to="body">
                <div v-if="archiveConfirmId === mail.id" :ref="el => { if (el) archivePopoverRefs.set(mail.id, el as HTMLElement) }" class="popover-panel fixed z-50 bg-white dark:bg-dark-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-gray-700 p-3 min-w-[220px]" @click.stop>
                  <div class="popover-arrow bg-white dark:bg-dark-gray-800 border border-gray-200 dark:border-dark-gray-700" :ref="el => { if (el) archiveArrowRefs.set(mail.id, el as HTMLElement) }"></div>
                  <div class="flex items-center gap-2 mb-3">
                    <button @click="cancelArchive" class="px-3 py-1.5 text-sm rounded bg-gray-200 dark:bg-dark-gray-700 text-gray-700 dark:text-dark-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                      Cancel
                    </button>
                    <button @click="confirmArchive(mail.id)" class="px-3 py-1.5 text-sm rounded bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors">
                      Complete
                    </button>
                  </div>
                  <!-- <p class="text-xs text-gray-500 dark:text-dark-gray-400">Disable confirmation messages in Preferences</p> -->
                </div>
              </Teleport>
            </div>

            <div class="flex-1">
              <div class="font-medium">{{ mail.subject || '(No subject)' }}</div>
              <div class="flex justify-between text-sm opacity-70 mt-1">
                <span>{{ formatSender(mail.from) }}</span>
                <div class="flex gap-2">
                  <span>{{ formatDate(mail.date) }}</span>
                  <!-- Loading spinner for current item -->
                  <div v-if="index === currentIndex && loadingEmail" class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0 opacity-70"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div ref="mailcontent" class="flex-1 min-w-0 overflow-hidden">
        <!-- <EmailViewer 
          :email-id="selectedEmailId" 
          @reply="handleReply" 
          @forward="handleForward" 
          @set-reminder="handleSetReminder" 
          @delete="handleDelete" 
          @select-thread-email="handleThreadEmailSelect" 
        /> -->
        <ExperimentalEmailViewer 
          :email="selectedEmail"
          :loading="loadingEmail"
        />
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
          class="popover-arrow bg-white dark:bg-dark-gray-800 border border-gray-200 dark:border-dark-gray-700"
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
          class="popover-arrow bg-white dark:bg-dark-gray-800 border border-gray-200 dark:border-dark-gray-700"
          ref="folderPickerArrowRef"
        ></div>
        <FolderPickerModal
          :account-id="folderPickerEmail.accountId"
          :current-folder-id="folderId"
          :is-popover="true"
          @close="closeFolderPicker()"
          @folder-selected="handleFolderSelected"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">

import gsap from 'gsap'
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import { Email } from '@shared/types'
import { useEmailActions } from '../composables/useEmailActions'
import { useEmailCacheStore } from '../stores/emailCache'
import EmailNavigation from './EmailNavigation.vue'
// import EmailViewer from './EmailViewer.vue'
import ReminderModal from './ReminderModal.vue'
import FolderPickerModal from './FolderPickerModal.vue'
import ExperimentalEmailViewer from './ExperimentalEmailViewer.vue'
import { computePosition, offset, shift, arrow as floatingArrow, flip } from '@floating-ui/dom'
import type { Placement, MiddlewareData } from '@floating-ui/dom'

const props = defineProps<{
  accountId?: string
  selectedEmailId?: string
  folderId?: string
  folderName?: string
  unifiedFolderType?: string
  unifiedFolderAccountIds?: string[]
}>()

const emit = defineEmits<{
  'select-email': [emailId: string]
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const mailbox = ref<HTMLDivElement | null>(null)
const mailcontent = ref<HTMLDivElement | null>(null)
const mailRefs = ref<(HTMLElement | null)[]>([])
const mails = ref<Email[]>([])

const currentIndex = ref(0)
const isScrolling = ref(false)
const selectedEmail = ref<any>(null)
const loadingEmail = ref(false)
const currentFolderName = ref<string>('')
let resizeObserver: ResizeObserver | null = null

// Reminder modal state
const showReminderModal = ref(false)
const reminderEmail = ref<{ id: string; accountId: string } | null>(null)
const reminderModalStyle = ref<{ top?: string; left?: string; right?: string; transform?: string }>({})
const reminderModalRef = ref<HTMLElement | null>(null)
const reminderArrowRef = ref<HTMLElement | null>(null)

// Folder picker state
const showFolderPicker = ref(false)
const folderPickerEmail = ref<{ id: string; accountId: string } | null>(null)
const folderPickerStyle = ref<{ top?: string; left?: string; right?: string; transform?: string }>({})
const folderPickerRef = ref<HTMLElement | null>(null)
const folderPickerArrowRef = ref<HTMLElement | null>(null)

// Email actions composable
const {
  archiveConfirmId,
  archivePopoverRefs,
  archiveArrowRefs,
  showArchiveConfirm,
  cancelArchive,
  archiveEmail,
  composeEmail,
  replyToEmail,
  forwardEmail,
  deleteEmailByObject,
  moveToFolder
} = useEmailActions()

// Email cache store
const emailCacheStore = useEmailCacheStore()
const CACHE_RANGE = 3 // Number of emails to cache before and after current

// Computed property for selectedEmailId
const selectedEmailId = computed(() => {
  return props.selectedEmailId || (mails.value[currentIndex.value]?.id)
})

const confirmArchive = async (emailId: string) => {
  // Always clear email view first
  selectedEmail.value = null
  
  const result = await archiveEmail(emailId)
  if (result.success) {
    // Remove email from list
    const emailIndex = mails.value.findIndex(e => e.id === emailId)
    if (emailIndex !== -1) {
      mails.value.splice(emailIndex, 1)
      
      // Adjust currentIndex and select next email if available
      if (mails.value.length === 0) {
        currentIndex.value = 0
      } else if (emailIndex <= currentIndex.value) {
        // Archived current email or one before it
        if (currentIndex.value >= mails.value.length) {
          // Was at end, select last email
          currentIndex.value = mails.value.length - 1
        }
        // currentIndex now points to next email (or stays same if archived one before)
        updateMailPositions()
        // Load the new current email
        await nextTick()
        loadCurrentEmail()
      } else {
        // Archived email after current, no index change needed
        updateMailPositions()
      }
    }
  }
}


// Item spacing and sizing constants
const BASE_SCALE = 1
const BASE_FONT_SIZE = 1.5 // rem (text-2xl = 1.5rem)
const SCALE_DECREASE = 0.1
const BLUR_INCREASE = 2
const ITEM_SPACING = 90 // pixels between items
const FIXED_Y_POSITION = 50 // percentage from top where current item stays

const formatSender = (from: any) => {
  if (!from || !Array.isArray(from) || from.length === 0) return 'Unknown'
  const sender = from[0]
  return sender.name || sender.address || 'Unknown'
}

const formatDate = (timestamp: number | string | Date | undefined) => {
  if (!timestamp) return ''

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  // Today - show time
  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Yesterday
  if (days === 1) {
    return 'Yesterday'
  }

  // This week - show day name
  if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }

  // Older - show date
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}


const updateMailPositions = () => {
  if (!mailbox.value || !containerRef.value) return

  const containerHeight = containerRef.value.clientHeight

  mailRefs.value.forEach((el, index) => {
    if (!el) return

    const offset = index - currentIndex.value
    const absOffset = Math.abs(offset)

    // Calculate Y position - current item stays at fixed position, others slide vertically
    const baseY = (FIXED_Y_POSITION / 100) * containerHeight
    const yPosition = baseY + (offset * ITEM_SPACING)

    // Calculate scale (smaller for items further away)
    const scale = Math.max(0.5, BASE_SCALE - (absOffset * SCALE_DECREASE))

    // Calculate blur (more blur for items further away)
    const blur = absOffset * BLUR_INCREASE

    // Calculate opacity (fade out items further away)
    const opacity = Math.max(0.3, 1 - (absOffset * 0.2))

    // Calculate font size
    const fontSize = BASE_FONT_SIZE * scale

    // Set initial transform origin - center so items stay aligned when scaled
    gsap.set(el, {
      transformOrigin: 'center center',
      left: '50%',
      xPercent: -50,
      yPercent: -50
    })

    // Animate position and visual effects
    gsap.to(el, {
      top: `${yPosition}px`,
      scale: scale,
      filter: `blur(${blur}px)`,
      opacity: opacity,
      fontSize: `${fontSize}rem`,
      duration: 0.5,
      ease: 'power2.out'
    })
  })
}

const loadCurrentEmail = async () => {
  if (mails.value.length === 0 || currentIndex.value < 0 || currentIndex.value >= mails.value.length) {
    return
  }

  const mail = mails.value[currentIndex.value]
  if (!mail || !mail.id) {
    return
  }

  loadingEmail.value = true
  try {
    // Load current email (from cache if available)
    selectedEmail.value = await emailCacheStore.getEmail(mail.id)

    // Preload nearby emails in background
    const startIndex = Math.max(0, currentIndex.value - CACHE_RANGE)
    const endIndex = Math.min(mails.value.length - 1, currentIndex.value + CACHE_RANGE)
    const emailIdsToPreload = mails.value
      .slice(startIndex, endIndex + 1)
      .map(m => m.id)
      .filter(Boolean) as string[]
    
    emailCacheStore.preloadEmails(emailIdsToPreload)
  } catch (error) {
    console.error('Error loading email content:', error)
    selectedEmail.value = null
  } finally {
    loadingEmail.value = false
  }
}

// Watch for mail changes to update refs array and positions
watch(() => mails.value.length, async () => {
  mailRefs.value = new Array(mails.value.length).fill(null)

  // Clean up cache - remove entries for emails that no longer exist
  const currentEmailIds = new Set(mails.value.map(m => m.id).filter(Boolean))
  emailCacheStore.cleanup(currentEmailIds)

  await nextTick()
  updateMailPositions()
  // Load the first email automatically
  if (mails.value.length > 0 && currentIndex.value < mails.value.length) {
    loadCurrentEmail()
    // Emit select-email event for the first email
    const emailId = mails.value[currentIndex.value]?.id
    if (emailId) {
      emit('select-email', emailId)
    }
  }
})

// Watch for currentIndex changes to automatically load email content
watch(() => currentIndex.value, () => {
  loadCurrentEmail()
  // Emit select-email event to update parent
  const emailId = mails.value[currentIndex.value]?.id
  if (emailId) {
    emit('select-email', emailId)
  }
})

// Watch for folder changes and reload emails
watch([() => props.folderId, () => props.unifiedFolderType, () => props.unifiedFolderAccountIds], () => {
  loadEmails()
}, { deep: true })

const handleItemClick = (index: number) => {
  // If clicking the current item, still emit select-email to ensure parent is updated
  if (index === currentIndex.value) {
    const emailId = mails.value[index]?.id
    if (emailId) {
      emit('select-email', emailId)
    }
    return
  }

  // If clicking a different item, move it to center
  // The watch on currentIndex will emit the select-email event
  if (isScrolling.value) return

  isScrolling.value = true
  currentIndex.value = index
  updateMailPositions()

  setTimeout(() => {
    isScrolling.value = false
  }, 500)
}

const handleWheel = (event: WheelEvent) => {
  if (isScrolling.value || mails.value.length === 0) return

  event.preventDefault()

  const delta = event.deltaY > 0 ? 1 : -1
  const newIndex = Math.max(0, Math.min(mails.value.length - 1, currentIndex.value + delta))

  if (newIndex !== currentIndex.value) {
    isScrolling.value = true
    currentIndex.value = newIndex
    // The watch on currentIndex will emit the select-email event
    updateMailPositions()

    setTimeout(() => {
      isScrolling.value = false
    }, 500)
  }
}

// Email action handlers
const handleCompose = () => {
  if (props.accountId) {
    composeEmail(props.accountId)
  } else {
    // Fallback: get first account
    window.electronAPI.accounts.list().then(accounts => {
      if (accounts.length > 0) {
        composeEmail(accounts[0].id)
      }
    })
  }
}

const handleReply = (email: any) => {
  if (!email || !email.id) return
  const accountId = props.accountId || email.accountId
  if (accountId) {
    replyToEmail(email, accountId)
  }
}

const handleForward = (email: any) => {
  if (!email || !email.id) return
  const accountId = props.accountId || email.accountId
  if (accountId) {
    forwardEmail(email, accountId)
  }
}

const getEmailElement = (emailId: string): HTMLElement | null => {
  return document.querySelector(`[data-email-id="${emailId}"]`) as HTMLElement | null
}

const getEmailAnchorElement = (emailId: string): HTMLElement | null => {
  return document.querySelector(`[data-email-anchor="${emailId}"]`) as HTMLElement | null
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
  styleRef?: typeof reminderModalStyle
}) => {
  const middleware = [
    offset(12),
    shift({ padding: 12 }),
    flip()
  ]

  if (arrowElement) {
    middleware.push(floatingArrow({ element: arrowElement }))
  }

  const { x, y, placement: finalPlacement, middlewareData } = await computePosition(
    referenceElement,
    floatingElement,
    {
      placement,
      middleware
    }
  )

  if (styleRef) {
    styleRef.value = {
      top: `${y}px`,
      left: `${x}px`,
      transform: 'none'
    }
  }

  if (arrowElement && middlewareData?.arrow) {
    updateArrowStyles(arrowElement, finalPlacement, middlewareData)
  }
}

const closeReminderPopover = () => {
  showReminderModal.value = false
  reminderEmail.value = null
}

const handleReminderSaved = async () => {
  closeReminderPopover()
  // Reload emails to reflect any changes
  await loadEmails()
}

const showReminderForEmail = async (emailIdOrEmail: string | any) => {
  // Handle both emailId string or email object
  let emailId: string
  let accountId: string
  
  if (typeof emailIdOrEmail === 'string') {
    emailId = emailIdOrEmail
    const email = mails.value.find(e => e.id === emailId) || selectedEmail.value
    if (!email || !email.accountId) {
      console.error('Email not found or missing accountId', { emailId, email })
      return
    }
    accountId = email.accountId
  } else {
    // It's an email object
    if (!emailIdOrEmail || !emailIdOrEmail.id || !emailIdOrEmail.accountId) {
      console.error('Invalid email object', { email: emailIdOrEmail })
      return
    }
    emailId = emailIdOrEmail.id
    accountId = emailIdOrEmail.accountId
  }
  
  reminderEmail.value = { id: emailId, accountId }
  
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

const handleSetReminder = async (email: any) => {
  if (!email || !email.id) return
  // Pass the email object directly so we can use its accountId
  await showReminderForEmail(email)
}

const handleEmailDoubleClick = async (emailId: string) => {
  try {
    await (window.electronAPI.window as any).emailViewer.create(emailId)
  } catch (error) {
    console.error('Error opening email in new window:', error)
  }
}

const handleThreadEmailSelect = (emailId: string) => {
  // When a thread email is selected, emit the select-email event
  emit('select-email', emailId)
}

const handleArchive = async (email: any) => {
  if (!email || !email.id) return
  
  // Always clear email view first
  selectedEmail.value = null
  
  const result = await archiveEmail(email.id)
  if (result.success) {
    // Remove email from list
    const emailIndex = mails.value.findIndex(e => e.id === email.id)
    if (emailIndex !== -1) {
      mails.value.splice(emailIndex, 1)
      
      // Adjust currentIndex and select next email if available
      if (mails.value.length === 0) {
        currentIndex.value = 0
      } else if (emailIndex <= currentIndex.value) {
        // Archived current email or one before it
        if (currentIndex.value >= mails.value.length) {
          // Was at end, select last email
          currentIndex.value = mails.value.length - 1
        }
        // currentIndex now points to next email (or stays same if archived one before)
        updateMailPositions()
        // Load the new current email
        await nextTick()
        loadCurrentEmail()
      } else {
        // Archived email after current, no index change needed
        updateMailPositions()
      }
    }
  }
}

const showFolderPickerForEmail = async (emailIdOrEmail: string | any) => {
  // Handle both emailId string or email object
  let emailId: string
  let accountId: string
  
  if (typeof emailIdOrEmail === 'string') {
    emailId = emailIdOrEmail
    const email = mails.value.find(e => e.id === emailId) || selectedEmail.value
    if (!email || !email.accountId) {
      console.error('Email not found or missing accountId', { emailId, email })
      return
    }
    accountId = email.accountId
  } else {
    // It's an email object
    if (!emailIdOrEmail || !emailIdOrEmail.id || !emailIdOrEmail.accountId) {
      console.error('Invalid email object', { email: emailIdOrEmail })
      return
    }
    emailId = emailIdOrEmail.id
    accountId = emailIdOrEmail.accountId
  }
  
  // Check if account is IMAP (only IMAP supports folders)
  try {
    const account = await window.electronAPI.accounts.get(accountId)
    if (!account || account.type !== 'imap') {
      return // Don't show folder picker for non-IMAP accounts
    }
  } catch (error) {
    console.error('Error checking account type:', error)
    return
  }
  
  folderPickerEmail.value = { id: emailId, accountId }
  
  // Set initial position first (centered) so modal is visible immediately
  folderPickerStyle.value = {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  }
  
  // Show modal first, then position it
  showFolderPicker.value = true
  
  // Wait for modal to render - need multiple ticks for Teleport + component mount
  await nextTick()
  await nextTick()
  await nextTick()
  
  // Additional small delay to ensure component has rendered
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
      console.error('Error positioning folder picker modal:', error)
      // Fallback positioning
      const rect = referenceElement.getBoundingClientRect()
      folderPickerStyle.value = {
        top: `${rect.top}px`,
        left: `${rect.right + 12}px`,
        transform: 'none'
      }
    }
  } else {
    console.warn('Email or modal element not found, keeping centered position')
  }
}

const handleMoveToFolder = async (email: any) => {
  if (!email || !email.id) return
  await showFolderPickerForEmail(email)
}

const closeFolderPicker = () => {
  showFolderPicker.value = false
  folderPickerEmail.value = null
}

const handleFolderSelected = async (folderId: string) => {
  if (!folderPickerEmail.value) return
  
  const emailId = folderPickerEmail.value.id
  closeFolderPicker()
  
  // Always clear email view first
  selectedEmail.value = null
  
  const result = await moveToFolder(emailId, folderId)
  if (result.success) {
    // Remove email from list
    const emailIndex = mails.value.findIndex(e => e.id === emailId)
    if (emailIndex !== -1) {
      mails.value.splice(emailIndex, 1)
      
      // Adjust currentIndex and select next email if available
      if (mails.value.length === 0) {
        currentIndex.value = 0
      } else if (emailIndex <= currentIndex.value) {
        // Moved current email or one before it
        if (currentIndex.value >= mails.value.length) {
          // Was at end, select last email
          currentIndex.value = mails.value.length - 1
        }
        // currentIndex now points to next email (or stays same if moved one before)
        updateMailPositions()
        // Load the new current email
        await nextTick()
        loadCurrentEmail()
      } else {
        // Moved email after current, no index change needed
        updateMailPositions()
      }
    }
  }
}

const handleDelete = async (email: any) => {
  if (!email || !email.id) return
  
  // Always clear email view first
  selectedEmail.value = null
  
  const result = await deleteEmailByObject(email)
  if (result.success) {
    // Remove email from list
    const emailIndex = mails.value.findIndex(e => e.id === email.id)
    if (emailIndex !== -1) {
      mails.value.splice(emailIndex, 1)
      
      // Adjust currentIndex and select next email if available
      if (mails.value.length === 0) {
        currentIndex.value = 0
      } else if (emailIndex <= currentIndex.value) {
        // Deleted current email or one before it
        if (currentIndex.value >= mails.value.length) {
          // Was at end, select last email
          currentIndex.value = mails.value.length - 1
        }
        // currentIndex now points to next email (or stays same if deleted one before)
        updateMailPositions()
        // Load the new current email
        await nextTick()
        loadCurrentEmail()
      } else {
        // Deleted email after current, no index change needed
        updateMailPositions()
      }
    }
  }
}

const loadEmails = async () => {
  try {
    // Use provided accountId or get first account
    let accountId: string = props.accountId || ''
    if (!accountId) {
      const accounts = await window.electronAPI.accounts.list()
      if (accounts.length === 0) {
        console.warn('No accounts found')
        return
      }
      accountId = accounts[0].id
    }

    // Handle unified folders
    if (props.unifiedFolderType) {
      const accountIds = Array.isArray(props.unifiedFolderAccountIds) 
        ? [...props.unifiedFolderAccountIds] 
        : []
      mails.value = await window.electronAPI.emails.listUnified(
        String(props.unifiedFolderType),
        accountIds,
        0,
        100
      )
      // Set folder name based on unified folder type
      const folderNames: Record<string, string> = {
        'inbox': 'Inbox',
        'sent': 'Sent',
        'drafts': 'Drafts',
        'spam': 'Spam',
        'trash': 'Trash',
        'archive': 'Archive'
      }
      currentFolderName.value = folderNames[props.unifiedFolderType] || props.unifiedFolderType
    } else if (props.folderId) {
      // Regular folder - load emails
      mails.value = await window.electronAPI.emails.list(props.folderId, 0, 100, false)
      
      // Get folder name
      if (props.folderName) {
        currentFolderName.value = props.folderName
      } else {
        // Fetch folder name if not provided
        const folders = await window.electronAPI.folders.list(accountId)
        const folder = folders.find((f: any) => f.id === props.folderId)
        currentFolderName.value = folder?.name || 'Folder'
      }
    } else {
      // Fallback to inbox if no folder specified
      const folders = await window.electronAPI.folders.list(accountId)
      const inboxFolder = folders.find((f: any) => f.name.toLowerCase() === 'inbox')
      
      if (!inboxFolder) {
        console.warn('Inbox folder not found')
        return
      }

      currentFolderName.value = inboxFolder.name || 'Inbox'
      mails.value = await window.electronAPI.emails.list(inboxFolder.id, 0, 100, false)
    }

    // Reset to first email when folder changes
    currentIndex.value = 0
    selectedEmail.value = null

    // Wait for DOM to update
    await nextTick()

    // Initialize positions
    updateMailPositions()
  } catch (error) {
    console.error('Error loading emails:', error)
  }
}

// Handle click outside to close reminder and folder picker popovers
const handleClickOutside = (event: MouseEvent) => {
  if (showReminderModal.value && reminderModalRef.value && !reminderModalRef.value.contains(event.target as Node)) {
    closeReminderPopover()
  }
  if (showFolderPicker.value && folderPickerRef.value && !folderPickerRef.value.contains(event.target as Node)) {
    closeFolderPicker()
  }
}

onMounted(async () => {
  await loadEmails()

  // Add resize observer to update positions on container resize
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateMailPositions()
    })
    resizeObserver.observe(containerRef.value)
  }
  
  // Listen for clicks outside to close reminder popover
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  document.removeEventListener('click', handleClickOutside)
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
</style>
