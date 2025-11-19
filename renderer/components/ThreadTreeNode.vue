<template>
  <div class="thread-tree-node">
    <div class="flex items-start gap-2">
      <!-- Indentation spacer -->
      <div :style="{ width: `${node.depth * 24}px` }" class="flex-shrink-0"></div>
      
      <!-- Connector lines -->
      <div class="relative flex-shrink-0 w-6">
        <!-- Vertical line -->
        <div
          v-if="node.depth > 0"
          class="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-dark-gray-700"
        ></div>
        <!-- Horizontal line to parent -->
        <div
          v-if="node.depth > 0"
          class="absolute left-3 top-4 w-3 h-0.5 bg-gray-200 dark:bg-dark-gray-700"
        ></div>
        <!-- Expand/collapse button -->
        <button
          v-if="node.children.length > 0"
          @click.stop="handleToggleExpand"
          class="absolute left-0 top-3 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          :class="{
            'text-gray-600 dark:text-dark-gray-400': isExpanded,
            'text-gray-400 dark:text-dark-gray-500': !isExpanded
          }"
        >
          <svg
            class="w-3 h-3 transition-transform"
            :class="{ 'rotate-90': isExpanded }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      
      <!-- Email card -->
      <button
        @click="handleEmailClick"
        class="max-w-md text-left p-2.5 rounded-lg border transition-all duration-200 hover:shadow-md"
        :class="{
          'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 ring-2 ring-primary-500 dark:ring-primary-400': email.id === currentEmailId,
          'bg-white dark:bg-dark-gray-800 border-gray-200 dark:border-dark-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700': email.id !== currentEmailId,
          'border-l-4 border-l-primary-500 dark:border-l-primary-400': isRoot
        }"
      >
        <!-- Header: Sender and Date -->
        <div class="flex items-start justify-between gap-2 mb-1">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <span
              class="text-sm font-medium truncate"
              :class="{
                'text-primary-700 dark:text-primary-300': email.id === currentEmailId,
                'text-gray-900 dark:text-dark-gray-100': email.id !== currentEmailId
              }"
            >
              {{ email.from[0]?.name || email.from[0]?.address }}
            </span>
            <span
              v-if="isRoot"
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
              'text-gray-500 dark:text-dark-gray-400': email.id !== currentEmailId
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
              'text-gray-700 dark:text-dark-gray-300': email.id !== currentEmailId
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
            'text-gray-500 dark:text-dark-gray-400': email.id !== currentEmailId
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
            class="text-xs text-gray-500 dark:text-dark-gray-400"
            title="Has attachments"
          >
            📎
          </span>
          <span
            v-if="node.children.length > 0"
            class="text-xs text-gray-500 dark:text-dark-gray-400"
            title="Has replies"
          >
            {{ node.children.length }} {{ node.children.length === 1 ? 'reply' : 'replies' }}
          </span>
        </div>
      </button>
    </div>
    
    <!-- Children (recursive) -->
    <div
      v-if="node.children.length > 0 && isExpanded"
      class="mt-2 ml-0"
    >
      <ThreadTreeNode
        v-for="child in node.children"
        :key="child.email.id"
        :node="child"
        :current-email-id="currentEmailId"
        :expanded-nodes="expandedNodes"
        @select-email="$emit('select-email', $event)"
        @toggle-expand="$emit('toggle-expand', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDate } from '../utils/formatters'
import type { Email } from '../../shared/types'
import type { ThreadNode } from '../utils/thread-structure'

const props = defineProps<{
  node: ThreadNode
  currentEmailId?: string
  expandedNodes: Set<string>
}>()

const emit = defineEmits<{
  'select-email': [emailId: string]
  'toggle-expand': [messageId: string]
}>()

const email = computed(() => props.node.email)
const isRoot = computed(() => props.node.depth === 0)
const isExpanded = computed(() => {
  const messageId = email.value.messageId
  if (!messageId) return false
  return props.expandedNodes.has(messageId)
})

const handleEmailClick = () => {
  emit('select-email', email.value.id)
}

const handleToggleExpand = () => {
  const messageId = email.value.messageId
  if (messageId) {
    emit('toggle-expand', messageId)
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
</script>

<style scoped>
.thread-tree-node {
  position: relative;
}
</style>

