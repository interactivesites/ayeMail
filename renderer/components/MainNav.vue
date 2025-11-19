<template>
  <header class="app-drag-region bg-white/70 dark:bg-dark-gray-800/70 backdrop-blur-xl border-b border-white/60 dark:border-dark-gray-700 shadow-sm">
    <nav class="ml-2 px-4 py-2 border-t border-white/60 dark:border-dark-gray-700 flex items-center justify-between h-16">
      <!-- Left mode: Show logo and folder actions (sync, compose) -->
      <template v-if="mode === 'left'" >
        <!-- <img src="../../assets/ilogo.png" alt="iMail" class="w-8 h-8 rounded-xl mr-8" /> -->
        
        <!-- Folder actions -->
        <div class="app-no-drag flex space-x-6">
          <button @click="$emit('sync')" :disabled="syncing" class="text-gray-700 dark:text-dark-gray-200 hover:text-gray-900 dark:hover:text-gray-100 items-center flex flex-col">
            <ArrowPathIcon 
              class="w-5 h-5"
              :class="{ 'animate-spin': syncing }"
            />
            <span v-if="preferences.showActionLabels">{{ syncing ? $t('navigation.syncing') : $t('navigation.sync') }}</span>
          </button>
          <button @click="$emit('compose')" class="text-gray-700 dark:text-dark-gray-200 hover:text-gray-900 dark:hover:text-gray-100 items-center flex flex-col">
            <EnvelopeIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">{{ $t('navigation.new') }}</span>
          </button>
        </div>
      </template>

      <!-- Right mode: Show email actions (reply, forward, reminder, delete) -->
      <template v-else-if="mode === 'right'">
        <div class="app-no-drag flex items-center space-x-1">
          <button type="button" @click="$emit('reply')" :disabled="!hasSelectedEmail" class="p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" :class="hasSelectedEmail
            ? 'border-transparent text-gray-600 dark:text-dark-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            : 'border-transparent text-gray-300 dark:text-dark-gray-600 cursor-not-allowed'" title="Reply">
            <ArrowUturnLeftIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">{{ $t('navigation.reply') }}</span>
          </button>
          <button type="button" @click="$emit('forward')" :disabled="!hasSelectedEmail" class="flex items-center flex-col p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" :class="hasSelectedEmail
            ? 'border-transparent text-gray-600 dark:text-dark-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            : 'border-transparent text-gray-300 dark:text-dark-gray-600 cursor-not-allowed'" title="Forward">
            <ArrowUpOnSquareIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">{{ $t('navigation.forward') }}</span>
          </button>
          <button type="button" @click="$emit('set-reminder')" :disabled="!hasSelectedEmail" class="flex items-center flex-col p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" :class="hasSelectedEmail
            ? 'border-transparent text-gray-600 dark:text-dark-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            : 'border-transparent text-gray-300 dark:text-dark-gray-600 cursor-not-allowed'" title="Set reminder">
            <BellAlertIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">{{ $t('navigation.setReminder') }}</span>
          </button>
          <button type="button" @click="$emit('delete')" :disabled="!hasSelectedEmail" class="flex items-center flex-col p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500" :class="hasSelectedEmail
            ? 'border-transparent text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300'
            : 'border-transparent text-gray-300 dark:text-dark-gray-600 cursor-not-allowed'" title="Delete">
            <TrashIcon class="w-5 h-5" />
            <span v-if="preferences.showActionLabels">{{ $t('common.delete') }}</span>
          </button>
        </div>
      </template>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { defineProps, toRefs } from 'vue'
import { usePreferencesStore } from '../stores/preferences'
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ArrowUpOnSquareIcon,
  BellAlertIcon,
  TrashIcon,
  EnvelopeIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps<{
  syncing: boolean
  hasSelectedEmail: boolean
  mode: 'left' | 'right'
}>()

const { syncing, hasSelectedEmail } = toRefs(props)

const emit = defineEmits<{
  sync: []
  compose: []
  reply: []
  forward: []
  'set-reminder': []
  delete: []
}>()

const preferences = usePreferencesStore()

</script>
