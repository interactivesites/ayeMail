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
            <span v-if="email.encrypted" class="text-primary-600" title="Encrypted">🔒</span>
            <span v-if="email.signed" class="text-green-600" :title="email.signatureVerified ? 'Signature verified' : 'Signed'">
              {{ email.signatureVerified ? '✓' : '?' }}
            </span>
          </div>
        </div>
        <div class="text-sm text-gray-600 space-y-1">
          <div>
            <span class="font-medium">From:</span>
            <span class="ml-2">{{ formatAddresses(email.from as EmailAddress[]) }}</span>
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
import { formatDate, formatSize, formatAddresses } from '../utils/formatters'
import { EmailAddress } from '../../shared/types'

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


watch(() => props.emailId, () => {
  loadEmail()
}, { immediate: true })


</script>

