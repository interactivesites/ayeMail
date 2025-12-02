<template>
  <svg
    v-if="visible"
    class="w-4 h-4"
    :class="selected ? 'text-white/80' : 'text-gray-500 dark:text-dark-gray-400'"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    :title="title"
    aria-hidden="true"
  >
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
  </svg>
  <span v-else style="display:none" />
  <!-- spacer to keep a single root -->
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  count?: number | null
  selected?: boolean
  title?: string
}>()

const visible = computed(() => {
  const c = props.count ?? 0
  return Number(c) > 0
})

const selected = computed(() => !!props.selected)
const title = computed(() => props.title ?? 'Attachments')
</script>
