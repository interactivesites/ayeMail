<template>
  <div>
    <button
      @click="handleClick"
      class="w-full text-left flex items-center px-4 py-2 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      :class="[
        selectedFolderId === folder.id ? 'bg-white/15 text-white shadow-inner' : 'text-white/80 hover:bg-white/5'
      ]"
      :style="{ paddingLeft: `${16 + level * 20}px` }"
    >
      <!-- Expand/collapse icon -->
      <div v-if="folder.children && folder.children.length > 0" class="mr-2 w-4 h-4 flex items-center justify-center">
        <svg
          class="w-3 h-3 text-white/60 transition-transform"
          :class="{ 'rotate-90': expanded }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </div>
      <!-- Spacer for non-expandable items -->
      <div v-else class="mr-2 w-4 h-4"></div>

      <!-- Folder icon -->
      <svg class="w-4 h-4 mr-2 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z"></path>
      </svg>

      <!-- Folder name -->
      <span class="text-sm font-medium truncate flex-1">{{ folder.name }}</span>

      <!-- Unread count badge -->
      <span v-if="folder.unread_count > 0" class="text-xs bg-white/15 text-white px-2 py-0.5 rounded-full ml-2 border border-white/20">
        {{ folder.unread_count }}
      </span>
    </button>

    <!-- Children -->
    <div v-if="expanded && folder.children && folder.children.length > 0">
      <FolderTreeItem
        v-for="child in folder.children"
        :key="child.id"
        :folder="child"
        :selected-folder-id="selectedFolderId"
        :level="level + 1"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  folder: any
  selectedFolderId?: string
  level: number
}>()

const emit = defineEmits<{
  select: [folder: any]
}>()

// Start collapsed for unified folders, expanded for others
const expanded = ref(!props.folder.isUnified)

const handleClick = (event: MouseEvent) => {
  // If clicking on the expand/collapse area, toggle expansion
  const target = event.target as HTMLElement
  if (target.tagName === 'svg' || target.closest('svg')) {
    expanded.value = !expanded.value
    return
  }

  // Otherwise, select the folder
  emit('select', props.folder)
}

// Auto-expand if this folder or any child is selected
// But keep unified folders collapsed unless a child is selected
const shouldAutoExpand = computed(() => {
  // For unified folders, only expand if a child is selected, not the root
  if (props.folder.isUnified) {
    const checkChildren = (children: any[]): boolean => {
      return children.some(child => {
        if (child.id === props.selectedFolderId) return true
        if (child.children && child.children.length > 0) {
          return checkChildren(child.children)
        }
        return false
      })
    }
    return props.folder.children && checkChildren(props.folder.children)
  }
  
  // For regular folders, expand if folder or any child is selected
  if (props.selectedFolderId === props.folder.id) {
    return true
  }

  const checkChildren = (children: any[]): boolean => {
    return children.some(child => {
      if (child.id === props.selectedFolderId) return true
      if (child.children && child.children.length > 0) {
        return checkChildren(child.children)
      }
      return false
    })
  }

  return props.folder.children && checkChildren(props.folder.children)
})

// Watch for changes and auto-expand when needed
import { watch } from 'vue'
watch(shouldAutoExpand, (newVal) => {
  if (newVal) {
    expanded.value = true
  }
}, { immediate: true })
</script>
