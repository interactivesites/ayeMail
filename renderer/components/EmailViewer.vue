<template>
  <div class="flex flex-col h-full">
    <div v-if="!email" class="flex-1 flex items-center justify-center text-gray-500">
      Select an email to view
    </div>
    <div v-else class="flex flex-col h-full">
      <div class="p-4 border-b border-gray-200">
        <div class="flex items-start justify-between mb-2">
          <h2 class="text-lg font-semibold text-gray-900">{{ email.subject || '(No subject)' }}</h2>
          <div class="flex items-center space-x-2">
            <span v-if="email.encrypted" class="text-blue-600" title="Encrypted">🔒</span>
            <span v-if="email.signed" class="text-green-600" :title="email.signatureVerified ? 'Signature verified' : 'Signed'">
              {{ email.signatureVerified ? '✓' : '?' }}
            </span>
          </div>
        </div>
        <div class="text-sm text-gray-600 space-y-1">
          <div>
            <span class="font-medium">From:</span>
            <span class="ml-2">{{ formatAddresses(email.from) }}</span>
          </div>
          <div v-if="email.to && email.to.length > 0">
            <span class="font-medium">To:</span>
            <span class="ml-2">{{ formatAddresses(email.to) }}</span>
          </div>
          <div v-if="email.cc && email.cc.length > 0">
            <span class="font-medium">CC:</span>
            <span class="ml-2">{{ formatAddresses(email.cc) }}</span>
          </div>
          <div class="text-gray-500">
            {{ formatDate(email.date) }}
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            @click="$emit('reply', email)"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <ArrowUturnLeftIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">Reply</span>
          </button>
          <button
            @click="$emit('forward', email)"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            <ArrowUpOnSquareIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">Forward</span>
          </button>
          <button
            @click="$emit('set-reminder', email)"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <BellAlertIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">Set Reminder</span>
          </button>
          <button
            @click="handleDelete"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            <TrashIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">Delete</span>
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-4">
        <div v-if="email.htmlBody" v-html="email.htmlBody" class="prose max-w-none"></div>
        <div v-else class="whitespace-pre-wrap text-gray-900">{{ email.textBody || email.body }}</div>
        <div v-if="email.attachments && email.attachments.length > 0" class="mt-4 pt-4 border-t border-gray-200">
          <h3 class="font-medium text-gray-900 mb-2">Attachments</h3>
          <div class="space-y-2">
            <div
              v-for="attachment in email.attachments"
              :key="attachment.id"
              class="flex items-center space-x-2 p-2 bg-gray-50 rounded"
            >
              <span class="text-sm text-gray-700">{{ attachment.filename }}</span>
              <span class="text-xs text-gray-500">({{ formatSize(attachment.size) }})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ArrowUturnLeftIcon, ArrowUpOnSquareIcon, BellAlertIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { usePreferencesStore } from '../stores/preferences'

const props = defineProps<{
  emailId?: string
}>()

const emit = defineEmits<{
  'reply': [email: any]
  'forward': [email: any]
  'set-reminder': [email: any]
  'delete': [email: any]
}>()

const email = ref<any>(null)
const loading = ref(false)
const preferences = usePreferencesStore()

const loadEmail = async () => {
  if (!props.emailId) {
    email.value = null
    return
  }

  loading.value = true
  try {
    email.value = await window.electronAPI.emails.get(props.emailId)
  } catch (error) {
    console.error('Error loading email:', error)
    email.value = null
  } finally {
    loading.value = false
  }
}

const formatAddresses = (addresses?: any[]) => {
  if (!addresses || addresses.length === 0) return '—'

  const formatted = addresses
    .map((addr) => {
      if (!addr) return ''
      const name = typeof addr.name === 'string' ? addr.name.trim() : ''
      const address = typeof addr.address === 'string' ? addr.address.trim() : ''

      if (name && address) return `${name} <${address}>`
      if (address) return address
      if (name) return name
      return ''
    })
    .filter((value) => value && value.length > 0)

  return formatted.length ? formatted.join(', ') : '—'
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

watch(() => props.emailId, () => {
  loadEmail()
}, { immediate: true })

const handleDelete = () => {
  if (!email.value) return

  const confirmed = confirm('Delete this email? This cannot be undone.')
  if (!confirmed) return

  emit('delete', email.value)
}
</script>

