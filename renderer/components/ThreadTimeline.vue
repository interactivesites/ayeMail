<template>
  <div class="thread-timeline">
    <div v-if="emails.length === 0" class="text-sm text-gray-500 dark:text-gray-400 p-4 text-center">
      No thread emails
    </div>
    <div v-else class="space-y-4">
      <div
        v-for="(email, index) in sortedEmails"
        :key="email.id"
        class="relative"
      >
        <!-- Timeline line connector -->
        <div
          v-if="index < sortedEmails.length - 1"
          class="absolute left-3.5 top-10 w-0.5 h-full bg-gray-200 dark:bg-gray-700"
          :style="{ height: `${getTimeGapHeight(email, sortedEmails[index + 1])}px` }"
        ></div>
        
        <!-- Email card -->
        <button
          @click="handleEmailClick(email.id)"
          class="relative max-w-md text-left p-2.5 rounded-lg border transition-all duration-200 hover:shadow-md"
          :class="{
            'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700': email.id === currentEmailId,
            'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700': email.id !== currentEmailId,
            'ring-2 ring-primary-500 dark:ring-primary-400': isRootEmail(email),
            'ml-8': !isRootEmail(email)
          }"
        >
          <!-- Timeline dot -->
          <div
            class="absolute left-2.5 top-3.5 w-2 h-2 rounded-full border-2 transition-colors"
            :class="{
              'bg-primary-600 dark:bg-primary-400 border-primary-600 dark:border-primary-400': email.id === currentEmailId,
              'bg-white dark:bg-gray-800 border-gray-400 dark:border-gray-500': email.id !== currentEmailId,
              'ring-2 ring-primary-500 dark:ring-primary-400': isRootEmail(email)
            }"
          ></div>
          
          <div class="ml-5">
            <!-- Header: Sender and Date -->
            <div class="flex items-start justify-between gap-2 mb-1">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <span
                  class="text-sm font-medium truncate"
                  :class="{
                    'text-primary-700 dark:text-primary-300': email.id === currentEmailId,
                    'text-gray-900 dark:text-gray-100': email.id !== currentEmailId
                  }"
                >
                  {{ email.from[0]?.name || email.from[0]?.address }}
                </span>
                <span
                  v-if="isRootEmail(email)"
                  class="text-xs px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                >
                  Root
                </span>
                <span
                  v-if="email.id === currentEmailId"
                  class="text-xs px-1.5 py-0.5 rounded bg-primary-600 dark:bg-primary-500 text-white"
                >
                  Current
                </span>
              </div>
              <span
                class="text-xs flex-shrink-0"
                :class="{
                  'text-primary-600 dark:text-primary-400': email.id === currentEmailId,
                  'text-gray-500 dark:text-gray-400': email.id !== currentEmailId
                }"
              >
                {{ formatDate(email.date) }}
              </span>
            </div>
            
            <!-- Subject -->
            <div class="mb-1">
              <span
                class="text-sm"
                :class="{
                  'text-primary-900 dark:text-primary-100 font-medium': email.id === currentEmailId,
                  'text-gray-700 dark:text-gray-300': email.id !== currentEmailId
                }"
              >
                {{ email.subject || '(No subject)' }}
              </span>
            </div>
            
            <!-- Preview -->
            <div
              v-if="getPreview(email)"
              class="text-xs line-clamp-2 mt-1"
              :class="{
                'text-primary-700/80 dark:text-primary-300/80': email.id === currentEmailId,
                'text-gray-500 dark:text-gray-400': email.id !== currentEmailId
              }"
            >
              {{ getPreview(email) }}
            </div>
            
            <!-- Metadata icons -->
            <div class="flex items-center gap-2 mt-2">
              <span
                v-if="email.encrypted"
                class="text-xs text-primary-600 dark:text-primary-400"
                title="Encrypted"
              >
                🔒
              </span>
              <span
                v-if="email.signed"
                class="text-xs"
                :class="{
                  'text-green-600 dark:text-green-400': email.signatureVerified,
                  'text-yellow-600 dark:text-yellow-400': !email.signatureVerified
                }"
                :title="email.signatureVerified ? 'Signed & Verified' : 'Signed'"
              >
                ✓
              </span>
              <span
                v-if="email.isStarred"
                class="text-xs text-yellow-500"
                title="Starred"
              >
                ★
              </span>
              <span
                v-if="email.attachmentCount && email.attachmentCount > 0"
                class="text-xs text-gray-500 dark:text-gray-400"
                title="Has attachments"
              >
                📎
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDate } from '../utils/formatters'
import type { Email } from '../../shared/types'
import { buildThreadStructure, isRootEmail as checkIsRootEmail } from '../utils/thread-structure'

const props = defineProps<{
  emails: Email[]
  currentEmailId?: string
}>()

const emit = defineEmits<{
  'select-email': [emailId: string]
}>()

// Build thread structure to identify root emails
const threadStructure = computed(() => {
  return buildThreadStructure(props.emails)
})

// Sort emails chronologically (oldest first for timeline)
const sortedEmails = computed(() => {
  return [...props.emails].sort((a, b) => a.date - b.date)
})

const isRootEmail = (email: Email): boolean => {
  return checkIsRootEmail(threadStructure.value, email.messageId || '')
}

const handleEmailClick = (emailId: string) => {
  if (emailId !== props.currentEmailId) {
    emit('select-email', emailId)
  }
}

const getPreview = (email: Email): string => {
  const text = email.textBody || email.body || ''
  if (!text) return ''
  
  // Remove HTML tags and clean up
  const div = document.createElement('div')
  div.innerHTML = text
  let cleanText = div.textContent || div.innerText || ''
  cleanText = cleanText.replace(/\s+/g, ' ').trim()
  
  return cleanText.substring(0, 100)
}

const getTimeGapHeight = (email1: Email, email2: Email): number => {
  const gap = email2.date - email1.date
  const hours = gap / (1000 * 60 * 60)
  
  // Base height of 60px, add more for longer gaps
  // Max 200px for very long gaps
  if (hours < 1) return 60
  if (hours < 24) return 80
  if (hours < 168) return 100 // 1 week
  return 120
}
</script>

<style scoped>
.thread-timeline {
  position: relative;
}
</style>

