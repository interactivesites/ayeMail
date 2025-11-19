<template>
  <div
    ref="cardRef"
    :data-email-id="email.id"
    :draggable="true"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @click="handleClick"
    class="group relative bg-white dark:bg-dark-gray-800 rounded-lg border border-gray-200 dark:border-dark-gray-700 p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 calm-card email-card"
    :class="{
      'ring-2 ring-primary-500 dark:ring-primary-400 border-primary-500 dark:border-primary-400': isSelected,
      'opacity-60': isDragging
    }"
  >
    <!-- Drag handle (visible on hover) -->
    <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <div class="w-6 h-6 flex items-center justify-center text-gray-400 dark:text-dark-gray-500 hover:text-gray-600 dark:hover:text-dark-gray-300 cursor-grab active:cursor-grabbing">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
        </svg>
      </div>
    </div>

    <!-- Intention hint -->
    <div v-if="intentionHint" class="absolute top-2 left-2 text-lg" :title="intentionHint.label">
      {{ intentionHint.emoji }}
    </div>

    <!-- Email content -->
    <div class="pr-8">
      <!-- Sender -->
      <div class="flex items-center gap-2 mb-1">
        <span class="text-sm font-semibold text-gray-900 dark:text-dark-gray-100 truncate">
          {{ senderName }}
        </span>
        <span v-if="email.encrypted" class="text-xs text-primary-600 dark:text-primary-400" title="Encrypted">🔒</span>
        <span v-if="email.signed" class="text-xs text-green-600 dark:text-green-400" title="Signed">✓</span>
        <span v-if="email.isStarred" class="text-xs text-yellow-500 dark:text-yellow-400">★</span>
      </div>

      <!-- Subject -->
      <div class="mb-2">
        <span class="text-sm text-gray-900 dark:text-dark-gray-100 font-medium line-clamp-1">
          {{ email.subject || '(No subject)' }}
        </span>
      </div>

      <!-- Preview text -->
      <div v-if="previewText" class="mb-2">
        <p class="text-xs text-gray-600 dark:text-dark-gray-400 line-clamp-2">
          {{ previewText }}
        </p>
      </div>

      <!-- Metadata row -->
      <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-dark-gray-700">
        <!-- Thread count badge -->
        <div v-if="threadCount > 1" class="text-xs px-2 py-0.5 bg-gray-100 dark:bg-dark-gray-700 text-gray-600 dark:text-dark-gray-300 rounded">
          {{ threadCount }}
        </div>
        <div v-else></div>

        <!-- Timestamp (hidden by default, shown on hover) -->
        <span class="text-xs text-gray-400 dark:text-dark-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
          {{ formatTime(email.date) }}
        </span>

        <!-- Attachment indicator -->
        <span v-if="email.attachmentCount > 0" class="text-xs text-gray-500 dark:text-dark-gray-400">📎</span>
      </div>
    </div>

    <!-- Action buttons (shown on hover) -->
    <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
      <button
        @click.stop="handleReply"
        class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-dark-gray-700 text-gray-600 dark:text-dark-gray-400 hover:text-gray-900 dark:hover:text-dark-gray-100"
        title="Reply"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>
      <button
        @click.stop="handleArchive"
        class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-dark-gray-700 text-gray-600 dark:text-dark-gray-400 hover:text-gray-900 dark:hover:text-dark-gray-100"
        title="Archive"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </button>
      <button
        @click.stop="handleSnooze"
        class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-dark-gray-700 text-gray-600 dark:text-dark-gray-400 hover:text-gray-900 dark:hover:text-dark-gray-100"
        title="Snooze"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { formatTime } from '../utils/formatters'

const props = defineProps<{
  email: any
  isSelected?: boolean
  threadCount?: number
}>()

const emit = defineEmits<{
  'select': [emailId: string]
  'reply': [email: any]
  'archive': [email: any]
  'snooze': [email: any]
  'drag-start': [event: DragEvent, email: any]
  'drag-end': [event: DragEvent]
}>()

const cardRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)

const senderName = computed(() => {
  if (!props.email.from || props.email.from.length === 0) return 'Unknown'
  const sender = props.email.from[0]
  return sender.name || sender.address || 'Unknown'
})

const previewText = computed(() => {
  const text = props.email.textBody || props.email.body || ''
  if (!text) return ''
  
  // Remove HTML tags and clean up
  const div = document.createElement('div')
  div.innerHTML = text
  let cleanText = div.textContent || div.innerText || ''
  cleanText = cleanText.replace(/\s+/g, ' ').trim()
  
  return cleanText.slice(0, 100)
})

const intentionHint = computed(() => {
  // Simple intention detection based on subject/content
  const subject = (props.email.subject || '').toLowerCase()
  const preview = previewText.value.toLowerCase()
  const combined = `${subject} ${preview}`
  
  // Reply needed indicators
  if (combined.includes('reply') || combined.includes('response') || combined.includes('?')) {
    return { emoji: '🧠', label: 'Reply needed' }
  }
  
  // Receipt/document indicators
  if (combined.includes('receipt') || combined.includes('invoice') || combined.includes('order confirmation')) {
    return { emoji: '📄', label: 'Receipt/Document' }
  }
  
  // Newsletter indicators
  if (combined.includes('newsletter') || combined.includes('unsubscribe') || combined.includes('mailing list')) {
    return { emoji: '📰', label: 'Newsletter' }
  }
  
  // Action needed
  if (combined.includes('action') || combined.includes('required') || combined.includes('please')) {
    return { emoji: '👍', label: 'Action needed' }
  }
  
  // Personal
  if (!props.email.isRead && !combined.includes('noreply') && !combined.includes('no-reply')) {
    return { emoji: '📩', label: 'New email' }
  }
  
  return null
})

const handleClick = () => {
  emit('select', props.email.id)
}

const handleDragStart = (event: DragEvent) => {
  isDragging.value = true
  if (event.dataTransfer && cardRef.value) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('email-id', props.email.id)
    event.dataTransfer.setData('text/plain', props.email.id)
    
    // Create drag image
    if (cardRef.value) {
      event.dataTransfer.setDragImage(cardRef.value, 0, 0)
    }
  }
  emit('drag-start', event, props.email)
}

const handleDragEnd = (event: DragEvent) => {
  isDragging.value = false
  emit('drag-end', event)
}

const handleReply = () => {
  emit('reply', props.email)
}

const handleArchive = () => {
  emit('archive', props.email)
}

const handleSnooze = () => {
  emit('snooze', props.email)
}
</script>

