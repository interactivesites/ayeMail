<template>
  <div class="email-viewer flex flex-col h-full">
    <div v-if="!props.emailId && !email" class="flex-1 flex items-center justify-center text-gray-500 dark:text-dark-gray-400">
      Select an email to view
    </div>
    <div v-else-if="loading && !email" class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center space-y-4">
        <div class="w-8 h-8 border-4 border-primary-600 dark:border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-gray-600 dark:text-dark-gray-400">Loading email...</p>
      </div>
    </div>
    <div v-else-if="email" class="flex flex-col h-full">
      <!-- Email Navigation - shown in window mode -->
      <div v-if="showNavigation" class="p-4 border-b border-gray-200 dark:border-dark-gray-700">
        <EmailNavigation 
          :has-selected-email="!!email" 
          :selected-email="email" 
          :account-id="accountId" 
          @compose="handleCompose" 
          @reply="handleReply" 
          @forward="handleForward" 
          @set-reminder="handleSetReminder" 
          @delete="handleDelete" 
        />
      </div>
      <div class="p-4 border-b border-gray-200 dark:border-dark-gray-700">
        <div class="flex items-start justify-between mb-2">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-dark-gray-100">{{ email.subject || '(No subject)' }}</h2>
          <div class="flex items-center space-x-2">
            <span v-if="email.encrypted" class="text-primary-600 dark:text-primary-400" title="Encrypted">🔒</span>
            <span v-if="email.signed" class="text-green-600 dark:text-green-400" :title="email.signatureVerified ? 'Signature verified' : 'Signed'">
              {{ email.signatureVerified ? '✓' : '?' }}
            </span>
          </div>
        </div>
        <div class="text-sm text-gray-600 dark:text-dark-gray-300 space-y-1">
          <div>
            <span class="font-medium">{{ $t('email.from') }}</span>
            <span class="ml-2">
              <template v-if="email.from && (email.from as EmailAddress[]).length > 0">
                <template v-for="(addr, index) in (email.from as EmailAddress[])" :key="index">
                  <button
                    v-if="addr.address"
                    @click="handleComposeToAddress(addr.address)"
                    class="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 hover:underline cursor-pointer"
                    :title="`Compose email to ${addr.address}`"
                  >
                    {{ addr.name ? `${addr.name} <${addr.address}>` : addr.address }}
                  </button>
                  <span v-else>{{ addr.name || addr.address || '' }}</span>
                  <span v-if="index < (email.from as EmailAddress[]).length - 1">, </span>
                </template>
              </template>
              <span v-else>—</span>
            </span>
          </div>
          <div v-if="email.to && email.to.length > 0">
            <span class="font-medium">{{ $t('email.to') }}</span>
            <span class="ml-2">{{ formatAddresses(email.to) }}</span>
          </div>
          <div v-if="email.cc && email.cc.length > 0">
            <span class="font-medium">{{ $t('email.cc') }}</span>
            <span class="ml-2">{{ formatAddresses(email.cc) }}</span>
          </div>
          <div class="text-gray-500 dark:text-dark-gray-400">
            {{ formatDate(email.date) }}
          </div>
        </div>
       
      </div>
      <ThinScrollbar class="flex-1">
        <div class="p-4">
          <div v-if="email.htmlBody" class="email-html-container">
          <iframe
            :srcdoc="sanitizedHtml"
            class="w-full border-0 bg-white dark:bg-dark-gray-800"
            style="min-height: 400px; display: block;"
            sandbox="allow-same-origin"
            scrolling="no"
            @load="onIframeLoad"
            ref="emailIframe"
          ></iframe>
        </div>
        <div 
          v-else 
          class="whitespace-pre-wrap text-gray-900 dark:text-dark-gray-100" 
          v-html="formatTextWithLinks(email.textBody || email.body)"
          @click="handleTextLinkClick"
        ></div>
        
        <!-- Inline Images -->
        <div v-if="imageAttachments.length > 0" class="mt-4 space-y-4">
          <div
            v-for="attachment in imageAttachments"
            :key="attachment.id"
            class="inline-block"
          >
            <img
              :src="getImageDataUrl(attachment)"
              :alt="attachment.filename"
              class="max-w-full h-auto rounded-lg shadow-sm"
              style="max-height: 400px;"
            />
          </div>
        </div>
        
        <!-- Other Attachments -->
        <div v-if="nonImageAttachments.length > 0" class="mt-4 pt-4 border-t border-gray-200 dark:border-dark-gray-700">
          <h3 class="font-medium text-gray-900 dark:text-dark-gray-100 mb-2">Attachments</h3>
          <div class="space-y-2">
            <button
              v-for="attachment in nonImageAttachments"
              :key="attachment.id"
              @click="downloadAttachment(attachment.id)"
              class="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group"
            >
              <div class="flex items-center space-x-3 flex-1 min-w-0">
                <svg class="w-5 h-5 text-gray-400 dark:text-dark-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <div class="flex-1 min-w-0">
                  <span class="text-sm text-gray-700 dark:text-dark-gray-300 block truncate">{{ attachment.filename }}</span>
                  <span class="text-xs text-gray-500 dark:text-dark-gray-400">{{ formatSize(attachment.size) }}</span>
                </div>
              </div>
              <svg class="w-5 h-5 text-gray-400 dark:text-dark-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Thread Emails -->
        <div v-if="threadEmails.length > 1" class="mt-6 pt-6 border-t border-gray-200 dark:border-dark-gray-700">
          <ThreadView
            :emails="threadEmails"
            :current-email-id="email?.id"
            @select-email="handleThreadEmailClick"
          />
        </div>
        </div>
      </ThinScrollbar>
    </div>
    
    <!-- Link Preview Popover -->
    <LinkPreviewPopover
      :show="showLinkPreview"
      :url="linkPreviewUrl"
      :display-text="linkPreviewDisplayText"
      :reference-element="linkPreviewReferenceElement"
      :iframe-element="emailIframe"
      @open="handleLinkPreviewOpen"
      @close="handleLinkPreviewClose"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { formatDate, formatSize, formatAddresses } from '../utils/formatters'
import { EmailAddress } from '../../shared/types'
import { checkUrlSecurity } from '../utils/url-security'
import { filterTrackingPixels } from '../utils/tracking-pixel-filter'
import { useEmailCacheStore } from '../stores/emailCache'
import ThreadView from './ThreadView.vue'
import LinkPreviewPopover from './LinkPreviewPopover.vue'
import EmailNavigation from './EmailNavigation.vue'
import ThinScrollbar from './ThinScrollbar.vue'

const props = defineProps<{
  emailId?: string
  showNavigation?: boolean
  accountId?: string
}>()

const emit = defineEmits<{
  'compose': []
  'reply': [email: any]
  'forward': [email: any]
  'set-reminder': [email: any]
  'delete': [email: any]
  'select-thread-email': [emailId: string]
}>()

const emailCacheStore = useEmailCacheStore()
const email = ref<any>(null)
const loading = ref(false)
const downloading = ref<string | null>(null)
const emailIframe = ref<HTMLIFrameElement | null>(null)
const threadEmails = ref<any[]>([])
const loadingThread = ref(false)

// Link preview popover state
const showLinkPreview = ref(false)
const linkPreviewUrl = ref('')
const linkPreviewDisplayText = ref('')
const linkPreviewReferenceElement = ref<HTMLElement | null>(null)

const sanitizedHtml = computed(() => {
  if (!email.value?.htmlBody) return ''
  
  let html = email.value.htmlBody
  
  // Remove <style> tags that could affect the parent page
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  
  // Remove <script> tags for security
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  
  // Filter out tracking pixels
  html = filterTrackingPixels(html)
  
  // Wrap in a container to ensure isolation
  // Add base styles for better rendering
  const baseStyles = `
    <style>
      * {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      *::-webkit-scrollbar {
        display: none;
      }
      html {
        margin: 0;
        padding: 0;
        overflow: hidden;
        height: auto;
      }
      body {
        margin: 0;
        padding: 16px;
        font-family: 'Albert Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-weight: 200;
        line-height: 1.6;
        color: #1f2937;
        background: #ffffff;
        overflow: visible;
        height: auto;
        min-height: auto;
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
        color: #2563eb;
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

const loadEmail = async () => {
  if (!props.emailId) {
    // Clear email content when emailId is empty/null
    email.value = null
    threadEmails.value = []
    loading.value = false
    return
  }

  // Set loading state immediately to show loading indicator
  loading.value = true
  email.value = null // Clear previous email immediately
  
  try {
    // Add timeout to prevent hanging (30 seconds)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email loading timeout')), 30000)
    )
    
    // Race between email loading (from cache or API) and timeout
    email.value = await Promise.race([
      emailCacheStore.getEmail(props.emailId),
      timeoutPromise
    ]) as any
    
    // Load thread emails after loading the main email (don't block on this)
    loadThreadEmails().catch(error => {
      console.error('Error loading thread emails:', error)
      // Don't fail the whole email load if thread loading fails
    })
  } catch (error) {
    console.error('Error loading email:', error)
    email.value = null
    threadEmails.value = []
  } finally {
    loading.value = false
  }
}

const loadThreadEmails = async () => {
  if (!props.emailId) {
    threadEmails.value = []
    return
  }

  loadingThread.value = true
  try {
    const emails = await window.electronAPI.emails.getThread(props.emailId)
    // Sort by date DESC (latest first) - include all emails including current
    threadEmails.value = emails.sort((a: any, b: any) => b.date - a.date)
  } catch (error) {
    console.error('Error loading thread emails:', error)
    threadEmails.value = []
  } finally {
    loadingThread.value = false
  }
}

const handleThreadEmailClick = (emailId: string) => {
  // Don't navigate if clicking on current email
  if (emailId === props.emailId) {
    return
  }
  // Emit event to parent to select this email
  // The parent component should handle navigation
  emit('select-thread-email', emailId)
}

const isImage = (attachment: any): boolean => {
  return attachment.contentType?.startsWith('image/') || false
}

const imageAttachments = computed(() => {
  if (!email.value?.attachments) return []
  return email.value.attachments.filter((att: any) => isImage(att))
})

const nonImageAttachments = computed(() => {
  if (!email.value?.attachments) return []
  return email.value.attachments.filter((att: any) => !isImage(att))
})

const getImageDataUrl = (attachment: any): string => {
  if (!attachment.data) return ''
  
  // Convert Buffer/Uint8Array to base64
  let base64: string
  if (attachment.data instanceof Uint8Array) {
    const binary = Array.from(attachment.data).map(byte => String.fromCharCode(byte)).join('')
    base64 = btoa(binary)
  } else if (Buffer.isBuffer && Buffer.isBuffer(attachment.data)) {
    base64 = attachment.data.toString('base64')
  } else if (typeof attachment.data === 'string') {
    base64 = attachment.data
  } else {
    // Try to convert array to base64
    const arr = Array.isArray(attachment.data) ? attachment.data : Array.from(new Uint8Array(attachment.data))
    const binary = arr.map((byte: number) => String.fromCharCode(byte)).join('')
    base64 = btoa(binary)
  }
  
  return `data:${attachment.contentType || 'image/png'};base64,${base64}`
}

const downloadAttachment = async (attachmentId: string) => {
  if (downloading.value === attachmentId) return
  
  downloading.value = attachmentId
  try {
    await window.electronAPI.emails.downloadAttachment(attachmentId)
  } catch (error: any) {
    console.error('Error downloading attachment:', error)
    alert(`Failed to download attachment: ${error.message || 'Unknown error'}`)
  } finally {
    downloading.value = null
  }
}

const onIframeLoad = () => {
  // Adjust iframe height to content and handle dynamic content changes
  if (emailIframe.value) {
    try {
      const iframe = emailIframe.value
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (iframeDoc) {
        const updateHeight = () => {
          const height = Math.max(
            iframeDoc.body?.scrollHeight || 400,
            iframeDoc.documentElement?.scrollHeight || 400
          )
          iframe.style.height = `${height}px`
        }
        
        // Initial height calculation
        updateHeight()
        
        // Recalculate height when images load (for async image loading)
        const images = iframeDoc.querySelectorAll('img')
        let loadedImages = 0
        const totalImages = images.length
        
        if (totalImages > 0) {
          images.forEach((img: HTMLImageElement) => {
            if (img.complete) {
              loadedImages++
            } else {
              img.addEventListener('load', () => {
                loadedImages++
                if (loadedImages === totalImages) {
                  updateHeight()
                }
              })
              img.addEventListener('error', () => {
                loadedImages++
                if (loadedImages === totalImages) {
                  updateHeight()
                }
              })
            }
          })
          
          // If all images are already loaded
          if (loadedImages === totalImages) {
            updateHeight()
          }
        }
        
        // Intercept link clicks to open externally with security checks
        const links = iframeDoc.querySelectorAll('a[href]')
        links.forEach((link: Element) => {
          const anchor = link as HTMLAnchorElement
          const originalHref = anchor.href
          const displayText = anchor.textContent || anchor.innerText
          
          anchor.addEventListener('click', async (e) => {
            e.preventDefault()
            e.stopPropagation()
            
            // Store reference element and iframe for popover positioning
            // We need both to calculate correct position (iframe element for offset)
            linkPreviewReferenceElement.value = anchor
            linkPreviewUrl.value = originalHref
            linkPreviewDisplayText.value = displayText
            showLinkPreview.value = true
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

const handleLinkPreviewOpen = async (url: string) => {
  // Check URL security
  const securityCheck = checkUrlSecurity(url, linkPreviewDisplayText.value)
  
  // Open the URL externally
  try {
    await window.electronAPI.shell.openExternal(securityCheck.actualUrl)
  } catch (error: any) {
    console.error('Error opening external URL:', error)
    alert(`Failed to open URL: ${error.message || 'Unknown error'}`)
  }
  
  // Close popover
  showLinkPreview.value = false
  linkPreviewReferenceElement.value = null
}

const handleLinkPreviewClose = () => {
  showLinkPreview.value = false
  linkPreviewReferenceElement.value = null
}

const formatTextWithLinks = (text: string): string => {
  if (!text) return ''
  
  // Escape HTML to prevent XSS
  const escapeHtml = (str: string) => {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }
  
  // URL regex pattern
  const urlRegex = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s<>"']*)/g
  
  return escapeHtml(text).replace(urlRegex, (url) => {
    // Ensure URL has protocol
    const href = url.startsWith('http') ? url : `https://${url}`
    return `<a href="${href}" class="text-primary-600 hover:text-primary-800 hover:underline cursor-pointer" data-external-link="${href}">${url}</a>`
  })
}

const handleTextLinkClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const link = target.closest('a[data-external-link]') as HTMLAnchorElement
  
  if (link) {
    event.preventDefault()
    const url = link.getAttribute('data-external-link') || link.href
    const displayText = link.textContent || ''
    handleLinkClick(url, displayText)
  }
}

const handleComposeToAddress = (address: string) => {
  if (!email.value || !email.value.accountId || !address) return
  
  // Create a minimal email object with just the "to" field set
  const composeData = {
    to: [{ address }]
  }
  
  // Open compose window with the email address pre-filled
  window.electronAPI.window.compose.create(email.value.accountId, composeData)
}

const handleCompose = () => {
  emit('compose')
}

const handleReply = () => {
  if (email.value) {
    emit('reply', email.value)
  }
}

const handleForward = () => {
  if (email.value) {
    emit('forward', email.value)
  }
}

const handleSetReminder = () => {
  if (email.value) {
    emit('set-reminder', email.value)
  }
}

const handleDelete = () => {
  if (email.value) {
    emit('delete', email.value)
  }
}

watch(() => props.emailId, (newId, oldId) => {
  // Only load if email ID actually changed
  if (newId !== oldId) {
    loadEmail()
  }
}, { immediate: true })


</script>

