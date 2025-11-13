<template>
  <div class="h-full flex flex-col">
    <div class="p-4 border-b border-gray-200">
      <h2 class="text-lg font-semibold text-gray-900">Folders</h2>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="p-4 text-center text-gray-500">
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

