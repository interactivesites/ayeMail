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
        class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-md text-sm border border-primary-200"
      >
        <span>{{ tag }}</span>
        <button
          @click="removeTag(index)"
          class="hover:bg-primary-100 rounded-full p-0.5 transition-colors"
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
      />
    </div>
  </div>
</template>

<script setup lang="ts">
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
  inputClass: 'w-full px-3 py-2 bg-transparent border-0 border-b border-gray-300 rounded-none focus:outline-none focus:ring-0 focus:border-primary-600 transition-colors'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const containerRef = ref<HTMLElement | null>(null)
const contacts = ref<Array<{ email: string; name: string | null }>>([])
const currentInput = ref('')
const currentQuery = ref('')

// Parse modelValue into tags array
const parseTags = (value: string): string[] => {
  if (!value || !value.trim()) return []
  return value.split(',').map(t => t.trim()).filter(t => t.length > 0)
}

// Tags from modelValue
const tags = computed(() => parseTags(props.modelValue))

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
    console.error('Error loading contacts:', error)
    contacts.value = []
  }
}

const updateModelValue = () => {
  const allTags = [...tags.value]
  if (currentInput.value.trim()) {
    // Don't add current input if it's being typed
  }
  emit('update:modelValue', allTags.join(', '))
}

const handleInputUpdate = (value: string) => {
  currentInput.value = value
  
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
  const currentTags = [...tags.value]
  
  // Check if tag already exists
  if (!currentTags.includes(trimmedTag)) {
    currentTags.push(trimmedTag)
    emit('update:modelValue', currentTags.join(', '))
  }
  
  // Clear input
  currentInput.value = ''
  loadContacts('')
}

const handleSelect = (item: any) => {
  // Add selected item as a tag
  addTag(item.display)
}

const handleKeydown = (event: KeyboardEvent) => {
  // Handle comma or enter to add tag
  if (event.key === ',' || event.key === 'Enter') {
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

const removeTag = (index: number) => {
  const newTags = [...tags.value]
  newTags.splice(index, 1)
  emit('update:modelValue', newTags.join(', '))
}

// Watch for external changes to modelValue
watch(() => props.modelValue, (newValue) => {
  const parsedTags = parseTags(newValue)
  // If the last part doesn't match current input, it might be a new tag
  const lastPart = parsedTags[parsedTags.length - 1] || ''
  
  // Only update input if it's different from what we have
  if (lastPart !== currentInput.value && parsedTags.length > tags.value.length) {
    // New tag was added externally, clear input
    currentInput.value = ''
  }
  
  // Reload contacts if there's a query part
  const queryPart = newValue.split(',').pop()?.trim() || ''
  if (queryPart && queryPart !== currentQuery.value && queryPart.length >= 2) {
    loadContacts(queryPart)
  } else if (!queryPart) {
    loadContacts('')
  }
})

onMounted(() => {
  loadContacts('')
  
  // Initialize currentInput if modelValue has a trailing comma or partial input
  const parts = props.modelValue.split(',')
  const lastPart = parts[parts.length - 1]?.trim()
  if (lastPart && !tags.value.includes(lastPart)) {
    currentInput.value = lastPart
  }
})
</script>


