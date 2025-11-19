<template>
  <div v-if="show" class="fixed inset-0 bg-white/50 dark:bg-dark-gray-900/50 backdrop-blur-xl z-50 flex items-center justify-center">
    <div class="flex flex-col items-center space-y-4">
      <div class="w-12 h-12 border-4 border-primary-600 dark:border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      <p v-if="text" class="text-gray-700 dark:text-dark-gray-300 text-sm font-medium">{{ text }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean
  text?: string
}>()
</script>

