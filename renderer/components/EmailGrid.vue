<template>
  <div class="flex flex-col h-full">
    <div class="p-4 border-b border-gray-200">
      <h2 class="text-lg font-semibold text-gray-900 flex items-center justify-between">
        <span>{{ folderName }}</span>
        <span class="text-sm text-gray-500 uppercase tracking-wide">Grid</span>
      </h2>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="p-4 text-center text-gray-500">
        Loading emails...
      </div>
      <div v-else-if="emails.length === 0" class="p-4 text-center text-gray-500">
        No emails in this folder
      </div>
      <div v-else class="p-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="email in emails"
          :key="email.id"
          @click="$emit('select-email', email.id)"
          class="relative rounded-2xl border p-4 text-left transition-all bg-white hover:-translate-y-0.5 hover:shadow"
          :class="{
            'border-blue-500 shadow-lg shadow-blue-100': selectedEmailId === email.id,
            'border-gray-200 hover:border-gray-300': selectedEmailId !== email.id
          }"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-3">
              <div
                class="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-semibold uppercase flex items-center justify-center"
                aria-hidden="true"
              >
                {{ getSenderInitials(email) }}
              </div>
              <div>
                <p class="font-medium text-gray-900">
                  {{ email.from[0]?.name || email.from[0]?.address }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ formatDate(email.date) }}
                </p>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <span v-if="email.encrypted" class="text-blue-600" title="Encrypted">🔒</span>
              <span
                v-if="email.signed"
                class="text-green-600"
                :title="email.signatureVerified ? 'Signature verified' : 'Signed'"
              >
                {{ email.signatureVerified ? '✓' : '?' }}
              </span>
              <span v-if="email.isStarred" class="text-yellow-500">★</span>
            </div>
          </div>
          <div class="mt-3">
            <p class="text-base font-semibold text-gray-900 truncate">
              {{ email.subject || '(No subject)' }}
            </p>
            <p class="mt-2 text-sm text-gray-600 h-12 overflow-hidden">
              {{ getSnippet(email) }}
            </p>
          </div>
          <div class="mt-4 flex items-center justify-between text-xs text-gray-500">
            <span>
              {{ email.isRead ? 'Read' : 'Unread' }}
            </span>
            <span>
              {{ email.attachments?.length ? `${email.attachments.length} attachment${email.attachments.length === 1 ? '' : 's'}` : 'No attachments' }}
            </span>
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
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const getSnippet = (email: any) => {
  const source =
    (typeof email.preview === 'string' && email.preview) ||
    (typeof email.textBody === 'string' && email.textBody) ||
    (typeof email.body === 'string' && email.body) ||
    ''
  return source.length > 120 ? `${source.slice(0, 117)}...` : source || '—'
}

const refreshEmails = () => {
  loadEmails()
}

onMounted(() => {
  loadEmails()
  window.addEventListener('refresh-emails', refreshEmails)
})

watch(
  () => props.folderId,
  () => {
    loadEmails()
  }
)

onUnmounted(() => {
  window.removeEventListener('refresh-emails', refreshEmails)
})
</script>


