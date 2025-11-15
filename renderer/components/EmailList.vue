<template>
  <div class="flex flex-col h-full">
    <div class="p-4 border-b border-gray-200">
      <h2 class="text-lg font-semibold text-gray-900">{{ folderName }}</h2>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="p-4 text-center text-gray-500">
        Loading emails...
      </div>
      <div v-else-if="emails.length === 0" class="p-4 text-center text-gray-500">
        No emails in this folder
      </div>
      <div v-else class="divide-y divide-gray-200">
        <button
          v-for="email in emails"
          :key="email.id"
          @click="$emit('select-email', email.id)"
          class="w-full text-left p-4 transition-colors border-l-4"
          :class="{
            'bg-blue-500/20': selectedEmailId === email.id,
            'hover:bg-gray-50': selectedEmailId !== email.id,
            'border-l-blue-600': isEmailUnread(email),
            'border-l-transparent': !isEmailUnread(email)
          }"
          :style="{ borderLeftColor: isEmailUnread(email) ? '#2563eb' : 'transparent' }"
        >
          <div class="flex items-start justify-between" >
            <div class="flex items-start flex-1 min-w-0 space-x-4">
              
              <div class="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-semibold uppercase flex items-center justify-center" aria-hidden="true">
                {{ getSenderInitials(email) }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2 justify-between">
                  <span class="truncate text-gray-500" >
                    {{ email.from[0]?.name || email.from[0]?.address }}
                  </span>
                  <span v-if="email.encrypted" class="text-blue-600" title="Encrypted">🔒</span>
                  <span v-if="email.signed" class="text-green-600" title="Signed">✓</span>
                  <div class="mt-1 text-sm text-gray-500 self-end">
                    {{ formatDate(email.date) }}
                  </div>
                </div>
                <div class="mt-1 flex items-center space-x-2">
                  <span class="text-sm text-gray-900 truncate" :class="isEmailUnread(email) ? 'font-medium' : 'font-extralight'">
                    {{ email.subject || '(No subject)' }}
                  </span>
                  
                </div>

              </div>
            </div>
            <div class="ml-4 flex-shrink-0">
              <span v-if="email.isStarred" class="text-yellow-500">★</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { getSenderInitials } from '../utils/email'

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

const isEmailUnread = (email: any): boolean => {
  // Handle various formats: boolean, number (0/1), undefined, null
  if (email.isRead === undefined || email.isRead === null) return true
  if (typeof email.isRead === 'number') return email.isRead === 0
  return !email.isRead
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

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
}

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
