<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-md font-semibold text-gray-900">GPG Keys</h3>
      <div class="flex items-center space-x-2">
        <button
          @click="showImportKey = true"
          class="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
        >
          Import Key
        </button>
        <button
          @click="showGenerateKey = true"
          class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
        >
          Generate Key
        </button>
      </div>
    </div>
    <div v-if="keys.length === 0" class="text-gray-500 text-sm">
      No GPG keys configured
    </div>
    <div v-else class="space-y-2">
      <div
        v-for="key in keys"
        :key="key.id"
        class="p-3 border border-gray-200 rounded"
      >
        <div class="flex items-center justify-between mb-2">
          <div>
            <div class="font-medium text-gray-900">{{ key.userIds.join(', ') }}</div>
            <div class="text-xs text-gray-500 font-mono">{{ key.fingerprint }}</div>
            <div class="text-xs text-gray-500 mt-1">
              <span v-if="key.isPrivate" class="text-primary-600">Private Key</span>
              <span v-else class="text-green-600">Public Key</span>
            </div>
          </div>
          <button
            @click="deleteKey(key.id)"
            class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
    <ImportKeyModal
      v-if="showImportKey"
      @close="showImportKey = false"
      @imported="handleKeyImported"
    />
    <GenerateKeyModal
      v-if="showGenerateKey"
      @close="showGenerateKey = false"
      @generated="handleKeyGenerated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ImportKeyModal from './ImportKeyModal.vue'
import GenerateKeyModal from './GenerateKeyModal.vue'

const keys = ref<any[]>([])
const showImportKey = ref(false)
const showGenerateKey = ref(false)

const loadKeys = async () => {
  try {
    keys.value = await window.electronAPI.gpg.listKeys()
  } catch (error) {
    console.error('Error loading GPG keys:', error)
  }
}

const deleteKey = async (id: string) => {
  // Note: Delete functionality would need to be added to IPC handlers
  console.log('Delete key:', id)
}

const handleKeyImported = () => {
  showImportKey.value = false
  loadKeys()
}

const handleKeyGenerated = () => {
  showGenerateKey.value = false
  loadKeys()
}

onMounted(() => {
  loadKeys()
})
</script>

