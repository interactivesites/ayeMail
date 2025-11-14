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
          class="w-full text-left p-4 hover:bg-gray-50 transition-colors"
          :class="{ 'bg-blue-50': selectedEmailId === email.id }"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-start flex-1 min-w-0 space-x-4">
              <div
                class="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-semibold uppercase flex items-center justify-center"
                aria-hidden="true"
              >
                {{ getSenderInitials(email) }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2">
                  <span class="font-medium text-gray-900 truncate">
                    {{ email.from[0]?.name || email.from[0]?.address }}
                  </span>
                  <span v-if="email.encrypted" class="text-blue-600" title="Encrypted">🔒</span>
                  <span v-if="email.signed" class="text-green-600" title="Signed">✓</span>
                </div>
                <div class="mt-1 flex items-center space-x-2">
                  <span class="text-sm font-medium text-gray-900 truncate">
                    {{ email.subject || '(No subject)' }}
                  </span>
                  <span v-if="!email.isRead" class="w-2 h-2 bg-blue-600 rounded-full"></span>
                </div>
                <div class="mt-1 text-sm text-gray-500">
                  {{ formatDate(email.date) }}
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

const getSenderInitials = (email: any) => {
  const sender = email.from?.[0]
  const fallback = '?'
  if (!sender) return fallback

  const raw =
    (typeof sender.name === 'string' && sender.name.trim()) ||
    (typeof sender.address === 'string' && sender.address.split('@')[0]) ||
    ''
  if (!raw) return fallback

  const cleaned = raw.replace(/[^A-Za-z0-9]+/g, ' ').trim()
  if (!cleaned) return fallback

  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }

  const word = parts[0]
  if (!word) return fallback

  return word.slice(0, 2).toUpperCase()
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

