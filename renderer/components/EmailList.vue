<template>
  <div class="flex flex-col h-full">
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
              @click="$emit('select-email', email.id)"
              class="w-full text-left px-4 py-3 my-2 transition-colors rounded-lg"
              :class="{
                'bg-primary-900 text-white': selectedEmailId === email.id,
                'hover:bg-primary-800/20': selectedEmailId !== email.id,
                'border-l-2 border-primary-600': isEmailUnread(email)
              }"
            >
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
                  <div
                    v-if="archiveConfirmId === email.id"
                    class="absolute left-8 top-0 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]"
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
                    
                    <!-- Right Side: Time and Icons -->
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <!-- Time Display -->
                      <span 
                        class="text-xs"
                        :class="selectedEmailId === email.id ? 'text-white/60' : 'text-gray-500'"
                      >
                        {{ formatTime(email.date) }}
                      </span>
                      
                      <span v-if="email.isStarred" class="text-yellow-500 text-sm">★</span>
                      <span 
                        v-if="email.attachmentCount && email.attachmentCount > 0" 
                        class="text-xs"
                        :class="selectedEmailId === email.id ? 'text-white/80' : 'text-gray-500'"
                        title="Has attachments"
                      >📎</span>
                      <span 
                        v-if="email.threadCount && email.threadCount > 1" 
                        class="text-xs px-1.5 py-0.5 rounded"
                        :class="selectedEmailId === email.id ? 'text-white/80 bg-white/20' : 'text-gray-500 bg-gray-200'"
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
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { usePreferencesStore } from '../stores/preferences'
import { formatTime } from '../utils/formatters'

const props = defineProps<{
  folderId: string
  folderName: string
  selectedEmailId?: string
}>()

const emit = defineEmits<{
  'select-email': [id: string]
}>()

const emails = ref<any[]>([])
const loading = ref(false)
const preferences = usePreferencesStore()
const { previewLevel } = storeToRefs(preferences)

// Grouping mode - can be extended later for other grouping options
const groupingMode = ref<'bydate'>('bydate')

// Archive confirmation state
const archiveConfirmId = ref<string | null>(null)

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

const showArchiveConfirm = (emailId: string) => {
  archiveConfirmId.value = emailId
}

const cancelArchive = () => {
  archiveConfirmId.value = null
}

const confirmArchive = async (emailId: string) => {
  archiveConfirmId.value = null
  
  try {
    const result = await window.electronAPI.emails.archive(emailId)
    if (result.success) {
      // Remove email from list
      emails.value = emails.value.filter(e => e.id !== emailId)
      // Refresh email list
      window.dispatchEvent(new CustomEvent('refresh-emails'))
    } else {
      console.error('Failed to archive email:', result.message)
    }
  } catch (error) {
    console.error('Error archiving email:', error)
  }
}

const loadEmails = async () => {
  if (!props.folderId) return

  loading.value = true
  try {
    emails.value = await window.electronAPI.emails.list(props.folderId, 0, 50)
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
  loadEmails()
}

// Close popover when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (archiveConfirmId.value) {
    const target = event.target as HTMLElement
    // Close if click is outside the checkbox container and popover
    if (!target.closest('.relative') && !target.closest('.absolute')) {
      archiveConfirmId.value = null
    }
  }
}

onMounted(() => {
  loadEmails()
  // Listen for refresh event
  window.addEventListener('refresh-emails', refreshEmails)
  // Listen for clicks outside to close popover
  document.addEventListener('click', handleClickOutside)
})

watch(() => props.folderId, () => {
  loadEmails()
  archiveConfirmId.value = null // Close popover when folder changes
})

onUnmounted(() => {
  window.removeEventListener('refresh-emails', refreshEmails)
  document.removeEventListener('click', handleClickOutside)
})
</script>
