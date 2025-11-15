<template>
  <header class="app-drag-region bg-white/70 backdrop-blur-xl border-b border-white/60 shadow-sm">

    <nav class="ml-20 px-4 py-2 border-t border-white/60 flex items-center justify-between">
      <img src="../../assets/ilogo.png" alt="iMail" class="w-8 h-8 rounded-xl mr-8" />
      
      <!-- Folder actions -->
      <div class="app-no-drag flex items-center space-x-3 mr-12">
        <button @click="$emit('sync')" :disabled="syncing" class="flex items-center space-x-2">
          <ArrowPathIcon class="w-5 h-5" />
          <span v-if="preferences.showActionLabels">{{ syncing ? 'Syncing...' : 'Get Mail' }}</span>
        </button>
        <button @click="$emit('compose')" >
          <EnvelopeIcon class="w-5 h-5" />
          <span v-if="preferences.showActionLabels">Compose</span>
        </button>
      </div>

      <div 
        class="app-no-drag"
        :style="{
          width: emailListWidth && emailListWidth > 0 ? emailListWidth + 'px' : '0px',
          transition: isResizing ? 'none' : 'width 0.15s ease-out'
        }"
      >
        
      </div>

      <!-- Mail actions -->

      <div class="app-no-drag flex items-center space-x-1 pl-3 border-l border-gray-200">
        <button type="button" @click="$emit('reply')" :disabled="!hasSelectedEmail" class="p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" :class="hasSelectedEmail
          ? 'border-transparent text-gray-600 hover:text-gray-900'
          : 'border-transparent text-gray-300 cursor-not-allowed'" title="Reply">
          <ArrowUturnLeftIcon class="w-5 h-5" />
        </button>
        <button type="button" @click="$emit('forward')" :disabled="!hasSelectedEmail" class="p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" :class="hasSelectedEmail
          ? 'border-transparent text-gray-600 hover:text-gray-900'
          : 'border-transparent text-gray-300 cursor-not-allowed'" title="Forward">
          <ArrowUpOnSquareIcon class="w-5 h-5" />
        </button>
        <button type="button" @click="$emit('set-reminder')" :disabled="!hasSelectedEmail" class="p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" :class="hasSelectedEmail
          ? 'border-transparent text-gray-600 hover:text-gray-900'
          : 'border-transparent text-gray-300 cursor-not-allowed'" title="Set reminder">
          <BellAlertIcon class="w-5 h-5" />
        </button>
        <button type="button" @click="$emit('delete')" :disabled="!hasSelectedEmail" class="p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500" :class="hasSelectedEmail
          ? 'border-transparent text-red-500 hover:text-red-700'
          : 'border-transparent text-gray-300 cursor-not-allowed'" title="Delete">
          <TrashIcon class="w-5 h-5" />
        </button>
      </div>

      <!-- end -->
      <div class="app-no-drag ml-auto flex items-center space-x-3">
        <button type="button" class="p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors" @click="$emit('open-settings')" title="Settings">
          <CogIcon class="w-5 h-5" />
        </button>
      </div>


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
  CogIcon,
  BellAlertIcon,
  TrashIcon,
  EnvelopeIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps<{
  syncing: boolean
  hasSelectedEmail: boolean
  emailListWidth?: number
  isResizing?: boolean
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

</script>
