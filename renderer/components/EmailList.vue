<template>
  <div class="flex flex-col h-full">
    <div class="p-4 border-b border-gray-200 flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900">{{ folderName }}</h2>
      <div class="flex items-center space-x-1 bg-gray-100 rounded-full p-0.5">
        <button
          type="button"
          @click="handlePreviewLevelChange(1)"
          :aria-pressed="previewLevel === 1"
          class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          :class="previewLevel === 1 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
          title="Title only"
        >
          <span class="text-xs font-medium w-4 h-4 flex items-center justify-center">1</span>
        </button>
        <button
          type="button"
          @click="handlePreviewLevelChange(2)"
          :aria-pressed="previewLevel === 2"
          class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          :class="previewLevel === 2 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
          title="2 lines preview"
        >
          <span class="text-xs font-medium w-4 h-4 flex items-center justify-center">2</span>
        </button>
        <button
          type="button"
          @click="handlePreviewLevelChange(3)"
          :aria-pressed="previewLevel === 3"
          class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
            <span class="text-sm font-medium text-blue-600">{{ group.dayName }}</span>
            <span class="text-sm text-gray-500">{{ group.dateString }}</span>
          </div>
          
          <!-- Email Items -->
          <div class="divide-y divide-gray-100">
            <button
              v-for="email in group.emails"
              :key="email.id"
              @click="$emit('select-email', email.id)"
              class="w-full text-left px-4 py-3 transition-colors"
              :class="{
                'bg-gray-100': selectedEmailId === email.id,
                'hover:bg-gray-50': selectedEmailId !== email.id
              }"
            >
              <div class="flex items-start gap-3">
                <!-- Circle Icon (Unread Indicator) -->
                <div class="flex-shrink-0 mt-1">
                  <div 
                    class="w-2 h-2 rounded-full"
                    :class="isEmailUnread(email) ? 'bg-blue-600' : 'bg-transparent'"
                  ></div>
                </div>
                
                <!-- Email Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 min-w-0">
                      <!-- Sender Name -->
                      <div class="flex items-center gap-2">
                        <span 
                          class="text-sm font-semibold truncate"
                          :class="isEmailUnread(email) ? 'text-blue-600' : 'text-gray-900'"
                        >
                          {{ email.from[0]?.name || email.from[0]?.address }}
                        </span>
                        <span v-if="email.encrypted" class="text-blue-600 text-xs" title="Encrypted">🔒</span>
                        <span v-if="email.signed" class="text-green-600 text-xs" title="Signed">✓</span>
                      </div>
                      
                      <!-- Subject -->
                      <div class="mt-0.5">
                        <span 
                          class="text-sm truncate"
                          :class="isEmailUnread(email) ? 'text-gray-900 font-medium' : 'text-gray-600'"
                        >
                          {{ email.subject || '(No subject)' }}
                        </span>
                      </div>
                      
                      <!-- Preview Text -->
                      <div 
                        v-if="previewLevel > 1 && getEmailPreview(email)" 
                        class="mt-1 text-xs text-gray-500"
                        :class="previewLevel === 3 ? 'line-clamp-4' : 'line-clamp-2'"
                      >
                        {{ getEmailPreview(email) }}
                      </div>
                    </div>
                    
                    <!-- Right Side Icons -->
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <span v-if="email.isStarred" class="text-yellow-500 text-sm">★</span>
                      <span v-if="email.threadCount && email.threadCount > 1" class="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                        {{ email.threadCount }}
                      </span>
                      <svg v-if="email.isDraft" class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

onMounted(() => {
  loadEmails()
  // Listen for refresh event
  window.addEventListener('refresh-emails', refreshEmails)
})

watch(() => props.folderId, () => {
  loadEmails()
})

onUnmounted(() => {
  window.removeEventListener('refresh-emails', refreshEmails)
})
</script>
