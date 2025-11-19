<template>
  <header class="app-drag-region bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border-b border-white/60 dark:border-gray-700 shadow-sm">
    <nav class="ml-2 px-4 py-2 border-t border-white/60 dark:border-gray-700 flex items-center justify-between h-16">
      <!-- Left mode: Show logo and folder actions (sync, compose) -->
      <template v-if="mode === 'left'" >
        <img src="../../assets/ilogo.png" alt="iMail" class="w-8 h-8 rounded-xl mr-8" />
        
        <!-- Folder actions -->
        <div class="app-no-drag flex items-center space-x-3 pl-2">
          <button @click="$emit('sync')" :disabled="syncing" class="text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100 items-center flex flex-col">
            <ArrowPathIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">{{ syncing ? $t('navigation.syncing') : $t('navigation.sync') }}</span>
          </button>
          <button @click="$emit('compose')" class="text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100 items-center flex flex-col">
            <EnvelopeIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">{{ $t('navigation.new') }}</span>
          </button>
        </div>
      </template>

      <!-- Right mode: Show email actions (reply, forward, reminder, delete), search and settings -->
      <template v-else-if="mode === 'right'">
        <div class="app-no-drag flex items-center space-x-1">
          <button type="button" @click="$emit('reply')" :disabled="!hasSelectedEmail" class="p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" :class="hasSelectedEmail
            ? 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            : 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'" title="Reply">
            <ArrowUturnLeftIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">{{ $t('navigation.reply') }}</span>
          </button>
          <button type="button" @click="$emit('forward')" :disabled="!hasSelectedEmail" class="flex items-center flex-col p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" :class="hasSelectedEmail
            ? 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            : 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'" title="Forward">
            <ArrowUpOnSquareIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">{{ $t('navigation.forward') }}</span>
          </button>
          <button type="button" @click="$emit('set-reminder')" :disabled="!hasSelectedEmail" class="flex items-center flex-col p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" :class="hasSelectedEmail
            ? 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            : 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'" title="Set reminder">
            <BellAlertIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">{{ $t('navigation.setReminder') }}</span>
          </button>
          <button type="button" @click="$emit('delete')" :disabled="!hasSelectedEmail" class="flex items-center flex-col p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500" :class="hasSelectedEmail
            ? 'border-transparent text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300'
            : 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'" title="Delete">
            <TrashIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">{{ $t('common.delete') }}</span>
          </button>
        </div>

        <!-- Search and settings -->
        <div class="app-no-drag ml-auto flex items-center space-x-3">
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" />
              <!-- <span v-if="preferences.showActionLabels">Search emails...</span> -->
            </div>
            <input
              ref="searchInputRef"
              type="text"
              v-model="localSearchQuery"
              @keydown.escape="handleClearSearch"
              :placeholder="$t('navigation.searchEmails')"
              class="pl-10 pr-4 py-2 w-64 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <button
              v-if="localSearchQuery"
              @click="handleClearSearch"
              class="absolute inset-y-0 right-0 pr-3 flex items-center"
              :title="$t('navigation.clearSearch')"
            >
              <XMarkIcon class="h-4 w-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" />
            </button>
          </div>
          <button type="button" class="flex items-center flex-col p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" @click="$emit('open-settings')" title="Settings">
            <CogIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">{{ $t('common.settings') }}</span>
            </button>
        </div>
      </template>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { defineProps, toRefs, ref, watch, nextTick } from 'vue'
import { usePreferencesStore } from '../stores/preferences'
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ArrowUpOnSquareIcon,
  CogIcon,
  BellAlertIcon,
  TrashIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps<{
  syncing: boolean
  hasSelectedEmail: boolean
  mode: 'left' | 'right'
}>()

const { syncing, hasSelectedEmail } = toRefs(props)

// Local state for input value - completely independent to prevent focus loss
const localSearchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

// Debounce search to avoid too many updates
let searchTimeout: NodeJS.Timeout | null = null
watch(localSearchQuery, (newValue) => {
  // Clear existing timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  
  // Debounce the search emit
  searchTimeout = setTimeout(() => {
    emit('search', newValue)
  }, 150) // Small delay to prevent excessive updates
})

const emit = defineEmits<{
  'open-settings': []
  sync: []
  compose: []
  reply: []
  forward: []
  'set-reminder': []
  delete: []
  'search': [query: string]
  'clear-search': []
}>()

const handleClearSearch = () => {
  localSearchQuery.value = ''
  emit('clear-search')
  // Maintain focus after clearing
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

const preferences = usePreferencesStore()

</script>
