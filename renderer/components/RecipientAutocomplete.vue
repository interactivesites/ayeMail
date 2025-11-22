<template>
  <div class="relative w-full" ref="containerRef">
    <!-- Tags display -->
    <div 
      v-if="tags.length > 0"
      class="flex flex-wrap gap-1.5 mb-2 px-3 pt-2"
    >
      <span
        v-for="(tag, index) in tags"
        :key="index"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-md text-sm border border-primary-200 dark:border-primary-700"
      >
        <span>{{ tag }}</span>
        <button
          @click="removeTag(index)"
          class="hover:bg-primary-100 dark:hover:bg-primary-800 rounded-full p-0.5 transition-colors"
          type="button"
          :aria-label="`Remove ${tag}`"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    </div>

    <!-- Input with autocomplete -->
    <div class="relative">
      <AutocompleteInput
        :model-value="currentInput"
        :items="contactItems"
        item-key="email"
        item-label="display"
        :placeholder="tags.length === 0 ? placeholder : ''"
        :search-keys="['email', 'name', 'display']"
        :max-results="maxResults"
        :input-class="inputClass"
        @update:model-value="handleInputUpdate"
        @select="handleSelect"
        @keydown="handleKeydown"
        @blur="handleBlur"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Logger } from '@shared/logger'

const logger = Logger.create('Component')
import { ref, computed, watch, onMounted } from 'vue'
import AutocompleteInput from './AutocompleteInput.vue'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  maxResults?: number
  inputClass?: string
}>(), {
  placeholder: 'To',
  maxResults: 10,
  inputClass: 'w-full px-3 py-2 bg-transparent border-0 border-b border-gray-300 dark:border-dark-gray-600 rounded-none focus:outline-none focus:ring-0 focus:border-primary-600 dark:focus:border-primary-500 transition-colors dark:text-dark-gray-100 placeholder-gray-400 dark:placeholder-dark-gray-500'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const containerRef = ref<HTMLElement | null>(null)
const contacts = ref<Array<{ email: string; name: string | null }>>([])
const currentInput = ref('')
const currentQuery = ref('')
const isInternalUpdate = ref(false)
const actualTags = ref<string[]>([]) // Track only confirmed tags (not current input)

// Parse modelValue into tags array (excluding current input)
const parseTags = (value: string): string[] => {
  if (!value || !value.trim()) return []
  return value.split(',').map(t => t.trim()).filter(t => t.length > 0)
}

// Tags to display (only confirmed tags, not current input)
const tags = computed(() => actualTags.value)

// Format contacts for autocomplete
const contactItems = computed(() => {
  return contacts.value.map(contact => ({
    email: contact.email,
    name: contact.name,
    display: contact.name 
      ? `${contact.name} <${contact.email}>` 
      : contact.email
  }))
})

const loadContacts = async (query: string = '') => {
  try {
    currentQuery.value = query
    if (query.length >= 2) {
      contacts.value = await window.electronAPI.contacts.search(query, props.maxResults)
    } else {
      // Load recent contacts when query is empty
      contacts.value = await window.electronAPI.contacts.list(props.maxResults)
    }
  } catch (error) {
    logger.error('Error loading contacts:', error)
    contacts.value = []
  }
}

const getModelValue = (): string => {
  let value = actualTags.value.join(', ')
  // Include current input if it has text (even if not yet added as a tag)
  if (currentInput.value.trim()) {
    if (value) {
      value += ', ' + currentInput.value.trim()
    } else {
      value = currentInput.value.trim()
    }
  }
  return value
}

const updateModelValue = () => {
  const value = getModelValue()
  isInternalUpdate.value = true
  emit('update:modelValue', value)
}

const handleInputUpdate = (value: string) => {
  currentInput.value = value
  
  // Update modelValue to include current input so send button can be enabled
  updateModelValue()
  
  // Load contacts based on current input
  if (value.trim().length >= 2) {
    loadContacts(value.trim())
  } else {
    loadContacts('')
  }
}

const addTag = (tagValue: string) => {
  if (!tagValue || !tagValue.trim()) return
  
  const trimmedTag = tagValue.trim()
  
  // Check if tag already exists
  if (!actualTags.value.includes(trimmedTag)) {
    actualTags.value.push(trimmedTag)
  }
  
  // Clear input
  currentInput.value = ''
  
  // Update modelValue with tags only (no current input since it's cleared)
  isInternalUpdate.value = true
  emit('update:modelValue', actualTags.value.join(', '))
  
  loadContacts('')
}

const handleSelect = (item: any) => {
  // Add selected item as a tag
  addTag(item.display)
}

const handleKeydown = (event: KeyboardEvent) => {
  // Handle comma, space, or enter to add tag
  if (event.key === ',' || event.key === 'Enter' || event.key === ' ') {
    if (currentInput.value.trim()) {
      event.preventDefault()
      addTag(currentInput.value)
    }
  }
  // Handle backspace to remove last tag when input is empty
  else if (event.key === 'Backspace' && !currentInput.value && tags.value.length > 0) {
    removeTag(tags.value.length - 1)
  }
}

const handleBlur = () => {
  // Add current input as tag when field loses focus
  if (currentInput.value.trim()) {
    addTag(currentInput.value)
  }
}

const removeTag = (index: number) => {
  actualTags.value.splice(index, 1)
  // Calculate new value: tags + current input
  const value = getModelValue()
  isInternalUpdate.value = true
  emit('update:modelValue', value)
}

// Watch for external changes to modelValue
watch(() => props.modelValue, (newValue) => {
  // Skip if this is our own update
  if (isInternalUpdate.value) {
    isInternalUpdate.value = false
    return
  }
  
  if (!newValue || !newValue.trim()) {
    // If modelValue is empty, clear everything
    actualTags.value = []
    currentInput.value = ''
    loadContacts('')
    return
  }
  
  // Split by comma to get all parts
  const parts = newValue.split(',').map(p => p.trim()).filter(p => p)
  
  // Check if this matches our current state (tags + currentInput)
  const expectedValue = getModelValue()
  if (expectedValue === newValue.trim()) {
    // This matches our current state, no need to update
    return
  }
  
  // External update - separate tags from current input
  // The last part might be the current input (if it's not a confirmed tag)
  const allParts = parseTags(newValue)
  const lastPart = parts[parts.length - 1] || ''
  
  // Check if tags changed by comparing with actualTags
  const newTags = allParts.slice(0, -1) // All but last are confirmed tags
  const isLastPartTag = allParts.length > 0 && allParts[allParts.length - 1] && 
                        (actualTags.value.includes(lastPart) || newTags.includes(lastPart))
  
  if (isLastPartTag || allParts.length === 1) {
    // Last part is a tag (or only one part exists), all parts are tags
    actualTags.value = allParts
    currentInput.value = ''
  } else {
    // Last part is current input
    actualTags.value = newTags
    currentInput.value = lastPart
  }
  
  // Reload contacts if there's a query part
  if (currentInput.value && currentInput.value.length >= 2) {
    loadContacts(currentInput.value)
  } else {
    loadContacts('')
  }
}, { immediate: true })

onMounted(() => {
  loadContacts('')
  
  // Initialize from modelValue if it exists
  if (props.modelValue && props.modelValue.trim()) {
    const parts = props.modelValue.split(',').map(p => p.trim()).filter(p => p)
    if (parts.length > 0) {
      // For initialization, treat all parts as tags (no current input)
      actualTags.value = parts
      currentInput.value = ''
    }
  }
})
</script>


