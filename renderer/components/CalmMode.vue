<template>
  <div class="relative h-full w-full overflow-hidden flex flex-col" ref="containerRef">
    <!-- Email Navigation -->


    <div class="flex-1 relative overflow-hidden flex">
      <div class="absolute top-6 left-8 px-8 py-4 z-10">
        <!-- Meta: current folder / mail count -->
        <div class="flex justify-between text-sm opacity-70">
          <span class="mr-8">{{ currentFolderName }}</span>
          <span class="text-3xl" v-if="mails.length > 0">{{ currentIndex + 1 }}/{{ mails.length }}</span>
          <span v-else>0 emails</span>
        </div>
        <EmailNavigation class="!ml-0 mt-4" :has-selected-email="!!selectedEmail" :selected-email="selectedEmail" :account-id="accountId" @compose="handleCompose" @reply="handleReply" @forward="handleForward" @set-reminder="handleSetReminder" @delete="handleDelete" />
      </div>

      <div ref="mailbox" class="relative w-full max-w-2xl h-full flex items-center" @wheel="handleWheel">
        <div v-for="(mail, index) in mails" :key="mail.id" :ref="el => { mailRefs[index] = el as HTMLElement | null }" class="absolute w-full px-8 cursor-pointer" @click="handleItemClick(index)" :data-email-id="mail.id">
          <span class="email-popover-anchor absolute top-1/2 right-3 w-0 h-0 transform -translate-y-1/2 pointer-events-none" :data-email-anchor="mail.id"></span>
          <div class="dark:text-white flex items-start gap-3">
            <!-- Rounded Checkbox -->
            <div class="flex-shrink-0 self-center relative">
              <button @click.stop="showArchiveConfirm(mail.id)" class="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center transition-colors hover:border-primary-600 dark:hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-1" :class="{
                'bg-primary-600 dark:bg-primary-500 border-primary-600 dark:border-primary-500': archiveConfirmId === mail.id,
                'hover:bg-gray-50 dark:hover:bg-gray-700': archiveConfirmId !== mail.id
              }" title="Archive email">
                <svg v-if="archiveConfirmId === mail.id" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </button>

              <!-- Archive Confirmation Popover -->
              <Teleport to="body">
                <div v-if="archiveConfirmId === mail.id" :ref="el => { if (el) archivePopoverRefs.set(mail.id, el as HTMLElement) }" class="popover-panel fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 min-w-[220px]" @click.stop>
                  <div class="popover-arrow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" :ref="el => { if (el) archiveArrowRefs.set(mail.id, el as HTMLElement) }"></div>
                  <div class="flex items-center gap-2 mb-3">
                    <button @click="cancelArchive" class="px-3 py-1.5 text-sm rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                      Cancel
                    </button>
                    <button @click="confirmArchive(mail.id)" class="px-3 py-1.5 text-sm rounded bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors">
                      Complete
                    </button>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Disable confirmation messages in Preferences</p>
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
      <div ref="mailcontent" class="flex-1 overflow-y-auto p-4">
        <div v-if="loadingEmail" class="flex items-center justify-center h-full">
          <div class="text-gray-500 dark:text-gray-400">Loading email...</div>
        </div>
        <div v-else-if="selectedEmail">
          <div v-if="selectedEmail.htmlBody" class="email-html-container">
            <iframe :srcdoc="sanitizedHtml" class="w-full border-0 bg-white dark:bg-gray-800" style="min-height: 400px; display: block;" sandbox="allow-same-origin" @load="onIframeLoad" ref="emailIframe"></iframe>
          </div>
          <div v-else class="whitespace-pre-wrap text-gray-900 dark:text-gray-100">
            {{ selectedEmail.textBody || selectedEmail.body || 'No content' }}
          </div>
        </div>
        <div v-else class="text-gray-500 dark:text-gray-400 text-center mt-8">
          Click on an email to view its content
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import gsap from 'gsap'
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import { Email } from '@shared/types'
import { useEmailActions } from '../composables/useEmailActions'
import { useEmailCacheStore } from '../stores/emailCache'
import { checkUrlSecurity } from '../utils/url-security'
import EmailNavigation from './EmailNavigation.vue'

const props = defineProps<{
  accountId?: string
  selectedEmailId?: string
}>()

const emit = defineEmits<{
  'select-email': [emailId: string]
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const mailbox = ref<HTMLDivElement | null>(null)
const mailcontent = ref<HTMLDivElement | null>(null)
const emailIframe = ref<HTMLIFrameElement | null>(null)
const mailRefs = ref<(HTMLElement | null)[]>([])
const mails = ref<Email[]>([])

const currentIndex = ref(0)
const isScrolling = ref(false)
const selectedEmail = ref<any>(null)
const loadingEmail = ref(false)
const currentFolderName = ref<string>('')
let resizeObserver: ResizeObserver | null = null

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
  setReminderForEmail,
  deleteEmailByObject
} = useEmailActions()

// Email cache store
const emailCacheStore = useEmailCacheStore()
const CACHE_RANGE = 3 // Number of emails to cache before and after current

const confirmArchive = async (emailId: string) => {
  const result = await archiveEmail(emailId)
  if (result.success) {
    // Clear content view if this email was selected
    if (selectedEmail.value?.id === emailId) {
      selectedEmail.value = null
    }
    
    // Remove email from list
    const emailIndex = mails.value.findIndex(e => e.id === emailId)
    if (emailIndex !== -1) {
      mails.value.splice(emailIndex, 1)
      
      // Adjust currentIndex and select next email if available
      if (mails.value.length === 0) {
        currentIndex.value = 0
        selectedEmail.value = null
      } else if (currentIndex.value >= mails.value.length) {
        // Was at end, select last email
        currentIndex.value = mails.value.length - 1
        updateMailPositions()
        // Load the new current email
        await nextTick()
        loadCurrentEmail()
      } else if (emailIndex === currentIndex.value) {
        // Archived the current email, select the one at same index (which is now the next one)
        // currentIndex stays the same, but now points to next email
        updateMailPositions()
        // Load the new current email
        await nextTick()
        loadCurrentEmail()
      } else if (emailIndex < currentIndex.value) {
        // Archived email before current, adjust index
        currentIndex.value = currentIndex.value - 1
        updateMailPositions()
      } else {
        // Archived email after current, no index change needed
        updateMailPositions()
      }
    }
  }
}

const sanitizedHtml = computed(() => {
  if (!selectedEmail.value?.htmlBody) return ''

  let html = selectedEmail.value.htmlBody

  // Remove <style> tags that could affect the parent page
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  // Remove <script> tags for security
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')

  // Check if dark mode is active
  const isDark = document.documentElement.classList.contains('dark')

  // Wrap in a container to ensure isolation
  // Add base styles for better rendering
  const baseStyles = `
    <style>
      body {
        margin: 0;
        padding: 16px;
        font-family: 'Albert Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-weight: 200;
        line-height: 1.6;
        color: ${isDark ? '#e5e7eb' : '#1f2937'};
        background: ${isDark ? '#111827' : '#ffffff'};
      }
      img {
        max-width: 100%;
        height: auto;
      }
      table {
        border-collapse: collapse;
        width: 100%;
      }
      a {
        color: ${isDark ? '#60a5fa' : '#2563eb'};
        text-decoration: underline;
        cursor: pointer;
      }
      a:hover {
        text-decoration: underline;
      }
    </style>
  `

  return `<!DOCTYPE html><html><head>${baseStyles}</head><body>${html}</body></html>`
})

const onIframeLoad = () => {
  // Optionally adjust iframe height to content
  if (emailIframe.value) {
    try {
      const iframe = emailIframe.value
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (iframeDoc) {
        const height = Math.max(
          iframeDoc.body?.scrollHeight || 400,
          iframeDoc.documentElement?.scrollHeight || 400
        )
        iframe.style.height = `${height}px`

        // Intercept link clicks to open externally with security checks
        const links = iframeDoc.querySelectorAll('a[href]')
        links.forEach((link: Element) => {
          const anchor = link as HTMLAnchorElement
          const originalHref = anchor.href
          const displayText = anchor.textContent || anchor.innerText

          anchor.addEventListener('click', async (e) => {
            e.preventDefault()
            e.stopPropagation()

            await handleLinkClick(originalHref, displayText)
          })

          // Add visual indicator that link opens externally
          anchor.style.cursor = 'pointer'
          anchor.title = `Open ${originalHref} in browser`
        })
      }
    } catch (error) {
      // Cross-origin or other security restrictions
      // Keep default min-height
    }
  }
}

const handleLinkClick = async (url: string, displayText?: string) => {
  // Check URL security
  const securityCheck = checkUrlSecurity(url, displayText)

  // If high risk, show warning and require confirmation
  if (securityCheck.riskLevel === 'high' || !securityCheck.isSafe) {
    const warningMessage = [
      `Warning: This link may be unsafe.`,
      ...securityCheck.warnings,
      '',
      `URL: ${securityCheck.actualUrl}`,
      '',
      'Do you want to open it anyway?'
    ].join('\n')

    if (!confirm(warningMessage)) {
      return
    }
  } else if (securityCheck.warnings.length > 0) {
    // Medium/low risk - show info but allow proceed
    const infoMessage = [
      `Security Notice:`,
      ...securityCheck.warnings,
      '',
      `URL: ${securityCheck.actualUrl}`,
      '',
      'Do you want to continue?'
    ].join('\n')

    if (!confirm(infoMessage)) {
      return
    }
  }

  // Open URL externally
  window.electronAPI.shell.openExternal(securityCheck.actualUrl)
}

// Item spacing and sizing constants
const BASE_SCALE = 1
const BASE_FONT_SIZE = 1.5 // rem (text-2xl = 1.5rem)
const SCALE_DECREASE = 0.1
const BLUR_INCREASE = 2
const ITEM_SPACING = 60 // pixels between items
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
  if (mails.value.length > 0) {
    loadCurrentEmail()
  }
})

// Watch for currentIndex changes to automatically load email content
watch(() => currentIndex.value, () => {
  loadCurrentEmail()
})

const handleItemClick = (index: number) => {
  // If clicking the current item, do nothing (already loaded)
  if (index === currentIndex.value) {
    return
  }

  // If clicking a different item, move it to center
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

const handleSetReminder = (email: any) => {
  if (!email || !email.id) return
  setReminderForEmail(email)
}

const handleDelete = async (email: any) => {
  if (!email || !email.id) return
  const result = await deleteEmailByObject(email)
  if (result.success) {
    // Clear content view if this email was selected
    if (selectedEmail.value?.id === email.id) {
      selectedEmail.value = null
    }
    
    // Remove email from list
    const emailIndex = mails.value.findIndex(e => e.id === email.id)
    if (emailIndex !== -1) {
      mails.value.splice(emailIndex, 1)
      
      // Adjust currentIndex and select next email if available
      if (mails.value.length === 0) {
        currentIndex.value = 0
        selectedEmail.value = null
      } else if (currentIndex.value >= mails.value.length) {
        // Was at end, select last email
        currentIndex.value = mails.value.length - 1
        updateMailPositions()
        // Load the new current email
        await nextTick()
        loadCurrentEmail()
      } else if (emailIndex === currentIndex.value) {
        // Deleted the current email, select the one at same index (which is now the next one)
        // currentIndex stays the same, but now points to next email
        updateMailPositions()
        // Load the new current email
        await nextTick()
        loadCurrentEmail()
      } else if (emailIndex < currentIndex.value) {
        // Deleted email before current, adjust index
        currentIndex.value = currentIndex.value - 1
        updateMailPositions()
      } else {
        // Deleted email after current, no index change needed
        updateMailPositions()
      }
    }
  }
}

onMounted(async () => {
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

    // Get folders for the account
    const folders = await window.electronAPI.folders.list(accountId)

    // Find the inbox folder
    const inboxFolder = folders.find((f: any) => f.name.toLowerCase() === 'inbox')

    if (!inboxFolder) {
      console.warn('Inbox folder not found')
      return
    }

    // Store folder name
    currentFolderName.value = inboxFolder.name || 'Inbox'

    // Load emails from inbox
    mails.value = await window.electronAPI.emails.list(inboxFolder.id, 0, 100, false)

    // Wait for DOM to update
    await nextTick()

    // Initialize positions
    updateMailPositions()

    // Add resize observer to update positions on container resize
    if (containerRef.value) {
      resizeObserver = new ResizeObserver(() => {
        updateMailPositions()
      })
      resizeObserver.observe(containerRef.value)
    }
  } catch (error) {
    console.error('Error loading inbox emails:', error)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
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
</style>
