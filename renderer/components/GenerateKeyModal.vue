<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">Generate GPG Key</h2>
        <button
          @click="$emit('close')"
          class="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      <div class="p-4 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">User ID (Name & Email)</label>
          <input
            v-model="userId"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-600"
            placeholder="John Doe <john@example.com>"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Passphrase (optional)</label>
          <input
            v-model="passphrase"
            type="password"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-600"
            placeholder="Passphrase"
          />
        </div>
      </div>
      <div class="p-4 border-t border-gray-200 flex justify-end space-x-2">
        <button
          @click="$emit('close')"
          class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          @click="generateKey"
          :disabled="generating"
          class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {{ generating ? 'Generating...' : 'Generate' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  'close': []
  'generated': []
}>()

const userId = ref('')
const passphrase = ref('')
const generating = ref(false)

const generateKey = async () => {
  if (!userId.value.trim()) {
    alert('Please enter a user ID')
    return
  }

  generating.value = true
  try {
    // Note: This would need to be implemented in IPC handlers
    // For now, just show a message
    alert('Key generation not yet fully implemented in IPC handlers')
    emit('generated')
    emit('close')
  } catch (error: any) {
    alert(`Error generating key: ${error.message}`)
  } finally {
    generating.value = false
  }
}
</script>

