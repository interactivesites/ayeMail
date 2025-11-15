<template>
  <header class="bg-white border-b border-gray-200">
    <div class="px-4 py-2 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-gray-900">iMail</h1>
      <button
        type="button"
        class="p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
        @click="$emit('open-settings')"
        title="Settings"
      >
        <CogIcon class="w-5 h-5" />
      </button>
    </div>
    <nav class="px-4 py-2 border-t border-gray-200 flex items-center space-x-2">
      <button
        @click="$emit('sync')"
        :disabled="syncing"
        class="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
      >
        <ArrowPathIcon class="w-5 h-5" />
        <span>{{ syncing ? 'Syncing...' : 'Get Mail' }}</span>
      </button>
      <button
        @click="$emit('compose')"
        class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-2"
      >
        <PencilSquareIcon class="w-5 h-5" />
        <span v-if="preferences.showActionLabels">Compose</span>
      </button>
      <div class="ml-auto flex items-center space-x-3">
        <div class="flex items-center space-x-1">
          <button
            type="button"
            @click="handleLayoutChange('list')"
            :aria-pressed="preferences.mailLayout === 'list'"
            class="p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            :class="preferences.mailLayout === 'list'
              ? 'border-blue-600 text-blue-600 bg-blue-50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'"
            title="List view"
          >
            <ListBulletIcon class="w-5 h-5" />
          </button>
          <button
            type="button"
            @click="handleLayoutChange('grid')"
            :aria-pressed="preferences.mailLayout === 'grid'"
            class="p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            :class="preferences.mailLayout === 'grid'
              ? 'border-blue-600 text-blue-600 bg-blue-50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'"
            title="Grid view"
          >
            <Squares2X2Icon class="w-5 h-5" />
          </button>
        </div>
        <div class="flex items-center space-x-1 pl-3 border-l border-gray-200">
          <button
            type="button"
            @click="$emit('reply')"
            :disabled="!hasSelectedEmail"
            class="p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            :class="hasSelectedEmail
              ? 'border-transparent text-gray-600 hover:text-gray-900'
              : 'border-transparent text-gray-300 cursor-not-allowed'"
            title="Reply"
          >
            <ArrowUturnLeftIcon class="w-5 h-5" />
          </button>
          <button
            type="button"
            @click="$emit('forward')"
            :disabled="!hasSelectedEmail"
            class="p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            :class="hasSelectedEmail
              ? 'border-transparent text-gray-600 hover:text-gray-900'
              : 'border-transparent text-gray-300 cursor-not-allowed'"
            title="Forward"
          >
            <ArrowUpOnSquareIcon class="w-5 h-5" />
          </button>
          <button
            type="button"
            @click="$emit('set-reminder')"
            :disabled="!hasSelectedEmail"
            class="p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            :class="hasSelectedEmail
              ? 'border-transparent text-gray-600 hover:text-gray-900'
              : 'border-transparent text-gray-300 cursor-not-allowed'"
            title="Set reminder"
          >
            <BellAlertIcon class="w-5 h-5" />
          </button>
          <button
            type="button"
            @click="$emit('delete')"
            :disabled="!hasSelectedEmail"
            class="p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            :class="hasSelectedEmail
              ? 'border-transparent text-red-500 hover:text-red-700'
              : 'border-transparent text-gray-300 cursor-not-allowed'"
            title="Delete"
          >
            <TrashIcon class="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { defineProps, toRefs } from 'vue'
import { usePreferencesStore } from '../stores/preferences'
import {
  ArrowPathIcon,
  PencilSquareIcon,
  ArrowUturnLeftIcon,
  ArrowUpOnSquareIcon,
  ListBulletIcon,
  Squares2X2Icon,
  CogIcon,
  BellAlertIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps<{
  syncing: boolean
  hasSelectedEmail: boolean
}>()

const { syncing, hasSelectedEmail } = toRefs(props)

defineEmits<{
  'open-settings': []
  sync: []
  compose: []
  reply: []
  forward: []
  'set-reminder': []
  delete: []
}>()

const preferences = usePreferencesStore()

const handleLayoutChange = (layout: 'list' | 'grid') => {
  preferences.setMailLayout(layout)
}
</script>


