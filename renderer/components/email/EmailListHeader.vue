<template>
  <div class="p-4 border-b border-gray-200 dark:border-dark-gray-700 flex items-center justify-between">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-dark-gray-100">{{ folderName }}</h2>
    <div class="flex items-center space-x-2">
      <div class="flex items-center space-x-1 bg-gray-100 dark:bg-dark-gray-800 rounded-full p-0.5">
        <button
          type="button"
          @click="emit('change-preview-level', 1)"
          :aria-pressed="previewLevel === 1"
          class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          :class="previewLevel === 1 ? 'bg-white dark:bg-dark-gray-700 text-gray-900 dark:text-dark-gray-100 shadow-sm' : 'text-gray-600 dark:text-dark-gray-400 hover:text-gray-900 dark:hover:text-dark-gray-100'"
          :title="$t('email.titleOnly')"
        >
          <span class="text-xs font-medium w-4 h-4 flex items-center justify-center">1</span>
        </button>
        <button
          type="button"
          @click="emit('change-preview-level', 2)"
          :aria-pressed="previewLevel === 2"
          class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          :class="previewLevel === 2 ? 'bg-white dark:bg-dark-gray-700 text-gray-900 dark:text-dark-gray-100 shadow-sm' : 'text-gray-600 dark:text-dark-gray-400 hover:text-gray-900 dark:hover:text-dark-gray-100'"
          :title="$t('email.twoLinesPreview')"
        >
          <span class="text-xs font-medium w-4 h-4 flex items-center justify-center">2</span>
        </button>
      </div>

      <button
        type="button"
        @click="emit('toggle-thread-view')"
        :aria-pressed="threadView"
        class="p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        :class="threadView ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'bg-gray-100 dark:bg-dark-gray-800 text-gray-600 dark:text-dark-gray-400 hover:text-gray-900 dark:hover:text-dark-gray-100'"
        :title="$t('email.threadView')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>

      <button
        v-if="showDeleteAllButton"
        type="button"
        @click="emit('delete-all')"
        :disabled="deletingAllEmails || emailsCount === 0"
        class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
        :class="(deletingAllEmails || emailsCount === 0)
          ? 'bg-gray-200 dark:bg-dark-gray-700 text-gray-400 dark:text-dark-gray-500'
          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'"
        :title="$t('email.deleteAllEmails')"
      >
        <span v-if="deletingAllEmails" class="flex items-center gap-2">
          <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ $t('email.deleting') }}
        </span>
        <span v-else class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {{ $t('email.deleteAll') }} ({{ emailsCount }})
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  folderName: string
  previewLevel: number
  threadView: boolean
  showDeleteAllButton: boolean
  deletingAllEmails: boolean
  emailsCount: number
}>()

const emit = defineEmits<{
  (e: 'change-preview-level', level: 1 | 2 | 3): void
  (e: 'toggle-thread-view'): void
  (e: 'delete-all'): void
}>()
</script>
