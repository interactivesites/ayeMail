<template>
  <div class="relative" ref="containerRef">
    <input
      :value="modelValue"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeydown"
      type="text"
      :placeholder="placeholder"
      :class="inputClass"
      ref="inputRef"
    />
    
    <!-- Dropdown/Popover -->
    <div
      v-if="showSuggestions && filteredItems.length > 0"
      :class="[
        'absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden',
        popover ? 'mt-1' : 'mt-0 border-t-0 rounded-t-none',
        popover ? 'min-w-full' : 'w-full'
      ]"
      :style="popover ? popoverStyle : {}"
      ref="dropdownRef"
    >
      <div class="max-h-60 overflow-y-auto">
        <button
          v-for="(item, index) in filteredItems"
          :key="index"
          @mousedown.prevent="selectItem(item)"
          :class="[
            'w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
            index === selectedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
          ]"
        >
          <div class="text-sm text-gray-900 dark:text-gray-100" v-html="highlightMatch(getItemLabel(item), searchQuery)"></div>
          <div v-if="getItemValue(item) !== getItemLabel(item)" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {{ getItemValue(item) }}
          </div>
        </button>
      </div>
    </div>
    
    <!-- No results -->
    <div
      v-if="showSuggestions && filteredItems.length === 0 && searchQuery.length >= 2"
      :class="[
        'absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg',
        popover ? 'mt-1' : 'mt-0 border-t-0 rounded-t-none',
        popover ? 'min-w-full' : 'w-full'
      ]"
      :style="popover ? popoverStyle : {}"
    >
      <div class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No results found</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

interface AutocompleteItem {
  [key: string]: any
}

const props = withDefaults(defineProps<{
  modelValue: string
  items: AutocompleteItem[]
  itemKey?: string
  itemLabel?: string
  placeholder?: string
  searchKeys?: string[]
  popover?: boolean
  maxResults?: number
  inputClass?: string
}>(), {
  itemKey: 'value',
  itemLabel: 'label',
  placeholder: '',
  searchKeys: () => ['label', 'value'],
  popover: false,
  maxResults: 10,
  inputClass: 'w-full px-3 py-2 bg-transparent border-0 border-b border-gray-300 dark:border-gray-600 rounded-none focus:outline-none focus:ring-0 focus:border-primary-600 dark:focus:border-primary-500 transition-colors dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'select': [item: AutocompleteItem]
  'keydown': [event: KeyboardEvent]
  'blur': [event: FocusEvent]
}>()

const containerRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const showSuggestions = ref(false)
const selectedIndex = ref(-1)
const searchQuery = ref('')
const popoverStyle = ref<{ top?: string; left?: string; width?: string }>({})

const getItemValue = (item: AutocompleteItem): string => {
  return item[props.itemKey] || ''
}

const getItemLabel = (item: AutocompleteItem): string => {
  return item[props.itemLabel] || getItemValue(item) || ''
}

const filterItems = (query: string): AutocompleteItem[] => {
  // If items are already filtered by parent (like RecipientAutocomplete), just return them
  // Otherwise, filter locally
  if (!query || query.trim().length < 2) {
    // Show recent items when query is short
    return props.items.slice(0, props.maxResults)
  }

  const lowerQuery = query.toLowerCase().trim()
  const filtered = props.items.filter(item => {
    return props.searchKeys.some(key => {
      const value = item[key]
      if (!value) return false
      return String(value).toLowerCase().includes(lowerQuery)
    })
  })

  return filtered.slice(0, props.maxResults)
}

const filteredItems = computed(() => {
  // Use items directly - parent component (like RecipientAutocomplete) handles filtering via API
  // For static lists, can filter locally if needed
  return props.items.slice(0, props.maxResults)
})

const highlightMatch = (text: string, query: string): string => {
  if (!query || query.length < 2) return text
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>')
}

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  searchQuery.value = target.value
  selectedIndex.value = -1
  showSuggestions.value = true
  emit('update:modelValue', target.value)
}

const handleFocus = () => {
  showSuggestions.value = true
  updatePopoverPosition()
}

const handleBlur = (event: FocusEvent) => {
  // Delay to allow click events on dropdown items
  setTimeout(() => {
    const relatedTarget = event.relatedTarget as Node | null
    if (containerRef.value && !containerRef.value.contains(relatedTarget)) {
      showSuggestions.value = false
      selectedIndex.value = -1
      // Emit blur event after dropdown is closed
      emit('blur', event)
    }
  }, 150)
}

const selectItem = (item: AutocompleteItem) => {
  const value = getItemValue(item)
  searchQuery.value = value
  selectedIndex.value = -1
  showSuggestions.value = false
  emit('update:modelValue', value)
  emit('select', item)
  inputRef.value?.blur()
}

const handleKeydown = (event: KeyboardEvent) => {
  // Handle Enter key for selecting from dropdown
  if (showSuggestions.value && filteredItems.value.length > 0) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        selectedIndex.value = (selectedIndex.value + 1) % filteredItems.value.length
        scrollToSelected()
        return
      case 'ArrowUp':
        event.preventDefault()
        selectedIndex.value = selectedIndex.value <= 0 
          ? filteredItems.value.length - 1 
          : selectedIndex.value - 1
        scrollToSelected()
        return
      case 'Enter':
        if (selectedIndex.value >= 0 && selectedIndex.value < filteredItems.value.length) {
          event.preventDefault()
          selectItem(filteredItems.value[selectedIndex.value])
          return
        }
        // If no item selected, let parent handle (for adding tag)
        break
      case 'Escape':
        event.preventDefault()
        showSuggestions.value = false
        selectedIndex.value = -1
        return
    }
  } else if (event.key === 'ArrowDown' && props.items.length > 0) {
    showSuggestions.value = true
    selectedIndex.value = 0
    event.preventDefault()
    return
  }
  
  // Emit keydown event for parent component handling (comma, backspace, etc.)
  emit('keydown', event)
}

const scrollToSelected = () => {
  if (dropdownRef.value && selectedIndex.value >= 0) {
    const buttons = dropdownRef.value.querySelectorAll('button')
    if (buttons[selectedIndex.value]) {
      buttons[selectedIndex.value].scrollIntoView({ block: 'nearest' })
    }
  }
}

const updatePopoverPosition = () => {
  if (!props.popover || !inputRef.value || !containerRef.value) return

  const inputRect = inputRef.value.getBoundingClientRect()
  const containerRect = containerRef.value.getBoundingClientRect()
  
  popoverStyle.value = {
    top: `${inputRect.height}px`,
    left: '0',
    width: `${inputRect.width}px`
  }
}

const handleClickOutside = (event: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    showSuggestions.value = false
    selectedIndex.value = -1
  }
}

watch(() => props.items, () => {
  if (showSuggestions.value) {
    updatePopoverPosition()
  }
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  if (props.popover) {
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  if (props.popover) {
    window.removeEventListener('resize', updatePopoverPosition)
    window.removeEventListener('scroll', updatePopoverPosition, true)
  }
})
</script>

<style scoped>
mark {
  background-color: rgb(254 240 138);
  padding: 0;
}
</style>

