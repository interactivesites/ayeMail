<template>
  <div class="h-full flex flex-col text-slate-100">
    <div class="p-4 border-b border-white/10 flex items-center justify-between">
      <h2 class="text-sm font-semibold tracking-wide uppercase text-white/60">Folders</h2>
      <div class="app-no-drag flex items-center space-x-1 bg-white/5 rounded-full p-0.5 shadow-inner">
        <button
          type="button"
          @click="handleLayoutChange('list')"
          :aria-pressed="preferences.mailLayout === 'list'"
          class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          :class="preferences.mailLayout === 'list' ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white/90'"
          title="List view"
        >
          <ListBulletIcon class="w-4 h-4" />
        </button>
        <button
          type="button"
          @click="handleLayoutChange('calm')"
          :aria-pressed="preferences.mailLayout === 'calm' || preferences.mailLayout === 'grid'"
          class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          :class="(preferences.mailLayout === 'calm' || preferences.mailLayout === 'grid') ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white/90'"
          title="Calm Mode"
        >
          <Squares2X2Icon class="w-4 h-4" />
        </button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="p-4 text-center text-white/70">
        Loading folders...
      </div>
      <div v-else>
        <FolderTreeItem
          v-for="folder in folders"
          :key="folder.id"
          :folder="folder"
          :selected-folder-id="selectedFolderId"
          :level="0"
          @select="$emit('select-folder', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { usePreferencesStore } from '../stores/preferences'
import { ListBulletIcon, Squares2X2Icon } from '@heroicons/vue/24/outline'
import FolderTreeItem from './FolderTreeItem.vue'

const props = defineProps<{
  accountId: string
  selectedFolderId?: string
}>()

const emit = defineEmits<{
  'select-folder': [folder: any]
}>()

const folders = ref<any[]>([])
const loading = ref(false)
const preferences = usePreferencesStore()

const loadFolders = async () => {
  if (!props.accountId) return
  
  loading.value = true
  try {
    folders.value = await window.electronAPI.folders.list(props.accountId)
  } catch (error) {
    console.error('Error loading folders:', error)
  } finally {
    loading.value = false
  }
}

const refreshFolders = () => {
  loadFolders()
}

const handleLayoutChange = (layout: 'list' | 'calm' | 'grid') => {
  // Map 'grid' to 'calm' for backward compatibility
  if (layout === 'grid') {
    layout = 'calm'
  }
  preferences.setMailLayout(layout)
}

onMounted(() => {
  loadFolders()
  window.addEventListener('refresh-folders', refreshFolders)
})

watch(() => props.accountId, () => {
  loadFolders()
})

onUnmounted(() => {
  window.removeEventListener('refresh-folders', refreshFolders)
})
</script>

