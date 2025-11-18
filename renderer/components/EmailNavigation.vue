<template>
  <div class="app-no-drag flex items-center space-x-1 ml-8">
    <!-- <button 
      type="button" 
      @click="handleCompose" 
      class="flex items-center flex-col p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100" 
      title="New email"
    >
      <EnvelopeIcon class="w-5 h-5" />
      <span v-if="preferences.showActionLabels">{{ $t('navigation.new') }}</span>
    </button> -->
    
    <button 
      type="button" 
      @click="handleReply" 
      :disabled="!hasSelectedEmail" 
      class="p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" 
      :class="hasSelectedEmail
        ? 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
        : 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'" 
      title="Reply"
    >
      <ArrowUturnLeftIcon class="w-5 h-5" />
      <span v-if="preferences.showActionLabels">{{ $t('navigation.reply') }}</span>
    </button>
    
    <button 
      type="button" 
      @click="handleForward" 
      :disabled="!hasSelectedEmail" 
      class="flex items-center flex-col p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" 
      :class="hasSelectedEmail
        ? 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
        : 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'" 
      title="Forward"
    >
      <ArrowUpOnSquareIcon class="w-5 h-5" />
      <span v-if="preferences.showActionLabels">{{ $t('navigation.forward') }}</span>
    </button>
    
    <button 
      type="button" 
      @click="handleSetReminder" 
      :disabled="!hasSelectedEmail" 
      class="flex items-center flex-col p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" 
      :class="hasSelectedEmail
        ? 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
        : 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'" 
      title="Set reminder"
    >
      <BellAlertIcon class="w-5 h-5" />
      <span v-if="preferences.showActionLabels">{{ $t('navigation.setReminder') }}</span>
    </button>
    
    <button 
      type="button" 
      @click="handleDelete" 
      :disabled="!hasSelectedEmail" 
      class="flex items-center flex-col p-2 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500" 
      :class="hasSelectedEmail
        ? 'border-transparent text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300'
        : 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'" 
      title="Delete"
    >
      <TrashIcon class="w-5 h-5" />
      <span v-if="preferences.showActionLabels">{{ $t('common.delete') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { usePreferencesStore } from '../stores/preferences'
import { useEmailActions } from '../composables/useEmailActions'
import {
  ArrowUturnLeftIcon,
  ArrowUpOnSquareIcon,
  BellAlertIcon,
  TrashIcon,
  EnvelopeIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps<{
  hasSelectedEmail: boolean
  selectedEmail?: any
  accountId?: string
}>()

const emit = defineEmits<{
  'compose': []
  'reply': [email: any]
  'forward': [email: any]
  'set-reminder': [email: any]
  'delete': [email: any]
}>()

const preferences = usePreferencesStore()
const { composeEmail, replyToEmail, forwardEmail, deleteEmailByObject } = useEmailActions()

const handleCompose = () => {
  if (props.accountId) {
    composeEmail(props.accountId)
  } else {
    emit('compose')
  }
}

const handleReply = () => {
  if (props.selectedEmail) {
    if (props.accountId && props.selectedEmail.accountId) {
      replyToEmail(props.selectedEmail, props.accountId)
    } else {
      emit('reply', props.selectedEmail)
    }
  }
}

const handleForward = () => {
  if (props.selectedEmail) {
    if (props.accountId && props.selectedEmail.accountId) {
      forwardEmail(props.selectedEmail, props.accountId)
    } else {
      emit('forward', props.selectedEmail)
    }
  }
}

const handleSetReminder = () => {
  if (props.selectedEmail) {
    // Just emit the event - let parent component handle showing the popover
    emit('set-reminder', props.selectedEmail)
  }
}

const handleDelete = async () => {
  if (props.selectedEmail) {
    // Always emit the event - let parent component handle the deletion
    // This allows parent to update UI state properly
    emit('delete', props.selectedEmail)
  }
}
</script>

