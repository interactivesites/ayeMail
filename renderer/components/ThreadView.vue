<template>
  <div class="thread-view">
    <!-- Header with view mode toggle -->
    <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-dark-gray-700">
      <h3 class="text-sm font-medium text-gray-900 dark:text-dark-gray-100">
        Thread ({{ emails.length }} {{ emails.length === 1 ? 'email' : 'emails' }})
      </h3>
      <div class="flex items-center gap-1 bg-gray-100 dark:bg-dark-gray-800 rounded-lg p-0.5">
        <button
          @click="viewMode = 'timeline'"
          :aria-pressed="viewMode === 'timeline'"
          class="px-3 py-1.5 text-xs font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          :class="viewMode === 'timeline'
            ? 'bg-white dark:bg-dark-gray-700 text-gray-900 dark:text-dark-gray-100 shadow-sm'
            : 'text-gray-600 dark:text-dark-gray-400 hover:text-gray-900 dark:hover:text-gray-100'"
          title="Timeline view"
        >
          Timeline
        </button>
        <button
          @click="viewMode = 'tree'"
          :aria-pressed="viewMode === 'tree'"
          class="px-3 py-1.5 text-xs font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          :class="viewMode === 'tree'
            ? 'bg-white dark:bg-dark-gray-700 text-gray-900 dark:text-dark-gray-100 shadow-sm'
            : 'text-gray-600 dark:text-dark-gray-400 hover:text-gray-900 dark:hover:text-gray-100'"
          title="Tree view"
        >
          Tree
        </button>
      </div>
    </div>
    
    <!-- View content -->
    <div class="thread-view-content">
      <ThreadTimeline
        v-if="viewMode === 'timeline'"
        :emails="emails"
        :current-email-id="currentEmailId"
        @select-email="handleSelectEmail"
      />
      <ThreadTree
        v-else-if="viewMode === 'tree'"
        :emails="emails"
        :current-email-id="currentEmailId"
        @select-email="handleSelectEmail"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Email } from '../../shared/types'
import ThreadTimeline from './ThreadTimeline.vue'
import ThreadTree from './ThreadTree.vue'
import { usePreferencesStore } from '../stores/preferences'

const props = defineProps<{
  emails: Email[]
  currentEmailId?: string
}>()

const emit = defineEmits<{
  'select-email': [emailId: string]
}>()

const preferences = usePreferencesStore()

// Load view mode from preferences or default to 'timeline'
const THREAD_VIEW_MODE_KEY = 'threadViewMode'
const loadViewMode = (): 'timeline' | 'tree' => {
  if (typeof window === 'undefined') return 'timeline'
  const stored = window.localStorage.getItem(THREAD_VIEW_MODE_KEY)
  return (stored === 'tree' || stored === 'timeline') ? stored : 'timeline'
}

const viewMode = ref<'timeline' | 'tree'>(loadViewMode())

// Save view mode preference
watch(viewMode, (newMode) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THREAD_VIEW_MODE_KEY, newMode)
  }
})

const handleSelectEmail = (emailId: string) => {
  emit('select-email', emailId)
}
</script>

<style scoped>
.thread-view {
  width: 100%;
}

.thread-view-content {
  min-height: 200px;
  max-height: 600px;
  overflow-y: auto;
}
</style>

