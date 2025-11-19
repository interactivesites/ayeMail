<template>
  <div
    v-if="isPopover"
    ref="modalRef"
    class="folder-picker-popover bg-white dark:bg-dark-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-dark-gray-700 relative"
    style="width: 320px; max-height: 400px;"
    @keydown="handleKeyDown"
  >
    <div class="p-3 border-b border-gray-200 dark:border-dark-gray-700">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-dark-gray-100">Move to folder</h3>
        <button
          @click="$emit('close')"
          class="text-gray-400 dark:text-dark-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Close (Esc)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <button
        @click="selectAsideFolder"
        class="w-full mb-2 px-3 py-2 text-sm text-left rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-dark-gray-100 border border-gray-200 dark:border-dark-gray-700 bg-gray-50 dark:bg-dark-gray-800"
      >
        <div class="flex items-center space-x-2">
          <svg class="w-4 h-4 text-gray-400 dark:text-dark-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span class="font-medium">Aside</span>
        </div>
      </button>
      <!-- Favorite Folders -->
      <div v-if="favoriteFoldersForAccount.length > 0" class="mb-2 space-y-1">
        <button
          v-for="folder in favoriteFoldersForAccount"
          :key="folder.id"
          @click="selectFolder(folder.id)"
          class="w-full px-3 py-2 text-sm text-left rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-dark-gray-100 border border-gray-200 dark:border-dark-gray-700 bg-gray-50 dark:bg-dark-gray-800"
        >
          <div class="flex items-center space-x-2">
            <svg class="w-4 h-4 text-gray-400 dark:text-dark-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span class="font-medium truncate">{{ getFolderDisplayName(folder) }}</span>
          </div>
        </button>
      </div>
      <input
        ref="searchInputRef"
        v-model="searchQuery"
        type="text"
        placeholder="Search folders..."
        class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-dark-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-500 bg-white dark:bg-dark-gray-700 text-gray-900 dark:text-dark-gray-100 placeholder-gray-500 dark:placeholder-dark-gray-400"
        @keydown.enter.prevent="selectHighlightedFolder"
      />
    </div>
    <div class="overflow-y-auto max-h-[320px] p-2">
      <div v-if="filteredFolders.length === 0" class="p-4 text-center text-gray-500 dark:text-dark-gray-400 text-sm">
        No folders found
      </div>
      <div v-else>
        <button
          v-for="(folder, index) in filteredFolders"
          :key="folder.id"
          :ref="(el) => { if (el) folderRefs[index] = el as HTMLElement }"
          @click="selectFolder(folder.id)"
          class="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-gray-900 dark:text-dark-gray-100"
          :class="{
            'bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-300': highlightedIndex === index
          }"
        >
          <div class="flex items-center space-x-2">
            <svg class="w-4 h-4 text-gray-400 dark:text-dark-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span class="truncate">{{ getFolderDisplayName(folder) }}</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { gsap } from 'gsap'
import { usePreferencesStore } from '../stores/preferences'

const props = defineProps<{
  accountId: string
  currentFolderId?: string
  isPopover?: boolean
}>()

const emit = defineEmits<{
  'folder-selected': [folderId: string]
  'close': []
}>()

const modalRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const folderRefs = ref<HTMLElement[]>([])

const folders = ref<any[]>([])
const searchQuery = ref('')
const highlightedIndex = ref(0)
const loading = ref(false)
const preferences = usePreferencesStore()

const loadFolders = async () => {
  if (!props.accountId) return
  
  loading.value = true
  try {
    const allFolders = await window.electronAPI.folders.list(props.accountId)
    // Flatten hierarchical structure
    const flattenFolders = (folderList: any[]): any[] => {
      const result: any[] = []
      for (const folder of folderList) {
        // Skip current folder and system folders
        if (folder.id !== props.currentFolderId && 
            !['INBOX', 'Trash', 'Spam', 'Junk'].includes(folder.name)) {
          result.push(folder)
        }
        if (folder.children && folder.children.length > 0) {
          result.push(...flattenFolders(folder.children))
        }
      }
      return result
    }
    folders.value = flattenFolders(allFolders)
  } catch (error) {
    console.error('Error loading folders:', error)
  } finally {
    loading.value = false
  }
}

const getFolderDisplayName = (folder: any): string => {
  // Show path if available, otherwise name
  return folder.path || folder.name || 'Unknown'
}

const favoriteFoldersForAccount = computed(() => {
  const favoriteIds = preferences.favoriteFolders
  if (favoriteIds.length === 0) return []
  
  // Filter folders to only include favorited ones for the current account
  return folders.value.filter(folder => favoriteIds.includes(folder.id))
})

const filteredFolders = computed(() => {
  if (!searchQuery.value.trim()) {
    return folders.value
  }
  
  const query = searchQuery.value.toLowerCase().trim()
  return folders.value.filter(folder => {
    const name = (folder.name || '').toLowerCase()
    const path = (folder.path || '').toLowerCase()
    return name.includes(query) || path.includes(query)
  })
})

const selectFolder = (folderId: string) => {
  emit('folder-selected', folderId)
  emit('close')
}

const selectAsideFolder = async () => {
  // Find or create Aside folder
  const folders = await window.electronAPI.folders.list(props.accountId)
  const flattenFolders = (folderList: any[]): any[] => {
    const result: any[] = []
    for (const folder of folderList) {
      result.push(folder)
      if (folder.children && folder.children.length > 0) {
        result.push(...flattenFolders(folder.children))
      }
    }
    return result
  }
  const allFolders = flattenFolders(folders)
  let asideFolder = allFolders.find((f: any) => 
    f.name.toLowerCase() === 'aside' || f.path?.toLowerCase().includes('aside')
  )
  
  // If Aside folder doesn't exist, create it
  if (!asideFolder) {
    asideFolder = await window.electronAPI.folders.create(props.accountId, 'Aside')
  }
  
  if (asideFolder) {
    selectFolder(asideFolder.id)
  }
}

const selectHighlightedFolder = () => {
  if (filteredFolders.value.length > 0 && highlightedIndex.value >= 0) {
    const folder = filteredFolders.value[highlightedIndex.value]
    if (folder) {
      selectFolder(folder.id)
    }
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      emit('close')
      break
    case 'ArrowDown':
      event.preventDefault()
      highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredFolders.value.length - 1)
      scrollToHighlighted()
      break
    case 'ArrowUp':
      event.preventDefault()
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
      scrollToHighlighted()
      break
    case 'Enter':
      event.preventDefault()
      selectHighlightedFolder()
      break
  }
}

const scrollToHighlighted = () => {
  nextTick(() => {
    const highlightedElement = folderRefs.value[highlightedIndex.value]
    if (highlightedElement && modalRef.value) {
      const container = modalRef.value.querySelector('.overflow-y-auto')
      if (container) {
        highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  })
}

watch(searchQuery, () => {
  highlightedIndex.value = 0
})

onMounted(() => {
  loadFolders()
  // Focus search input
  nextTick(() => {
    searchInputRef.value?.focus()
  })
})
</script>

<style scoped>
.folder-picker-popover {
  z-index: 9999;
}
</style>

