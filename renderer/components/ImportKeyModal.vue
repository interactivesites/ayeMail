<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">Import GPG Key</h2>
        <button
          @click="$emit('close')"
          class="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Key Data (Armored)</label>
          <textarea
            v-model="keyData"
            rows="10"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 font-mono text-sm"
            placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----..."
          ></textarea>
        </div>
        <div>
          <label class="flex items-center">
            <input
              v-model="isPrivate"
              type="checkbox"
              class="mr-2"
            />
            <span class="text-sm text-gray-700">This is a private key</span>
          </label>
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
          @click="importKey"
          :disabled="importing"
          class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
        >
          {{ importing ? 'Importing...' : 'Import' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  'close': []
  'imported': []
}>()

const keyData = ref('')
const isPrivate = ref(false)
const importing = ref(false)

const importKey = async () => {
  if (!keyData.value.trim()) {
    alert('Please enter key data')
    return
  }

  importing.value = true
  try {
    const result = await window.electronAPI.gpg.importKey(keyData.value, isPrivate.value)
    if (result.success) {
      emit('imported')
      emit('close')
    } else {
      alert(`Failed to import key: ${result.message}`)
    }
  } catch (error: any) {
    alert(`Error importing key: ${error.message}`)
  } finally {
    importing.value = false
  }
}
</script>

