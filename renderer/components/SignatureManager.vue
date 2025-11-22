<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-md font-semibold text-gray-900">Signatures</h3>
      <button
        @click="showAddSignature = true"
        class="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
      >
        Add Signature
      </button>
    </div>
    <div v-if="signatures.length === 0" class="text-gray-500 text-sm">
      No signatures configured
    </div>
    <div v-else class="space-y-2">
      <div
        v-for="signature in signatures"
        :key="signature.id"
        class="p-3 border border-gray-200 rounded"
        :class="{ 'border-primary-600 bg-primary-50': signature.is_default }"
      >
        <div class="flex items-center justify-between mb-2">
          <div>
            <span class="font-medium text-gray-900">{{ signature.name }}</span>
            <span v-if="signature.is_default" class="ml-2 text-xs bg-primary-600 text-white px-2 py-1 rounded">
              Default
            </span>
          </div>
          <div class="flex items-center space-x-2">
            <button
              @click="setDefault(signature.id)"
              :disabled="signature.is_default"
              class="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              Set Default
            </button>
            <button
              @click="editSignature(signature)"
              class="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Edit
            </button>
            <button
              @click="deleteSignature(signature.id)"
              class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
        <div class="text-sm text-gray-600" v-html="signature.html || signature.text"></div>
      </div>
    </div>
    <AddSignatureForm
      v-if="showAddSignature"
      :account-id="accountId"
      :editing-signature="editingSignature"
      @close="showAddSignature = false; editingSignature = null"
      @saved="handleSignatureSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { Logger } from '@shared/logger'

const logger = Logger.create('Component')
import { ref, onMounted, watch } from 'vue'
import AddSignatureForm from './AddSignatureForm.vue'

const props = defineProps<{
  accountId: string
}>()

const signatures = ref<any[]>([])
const showAddSignature = ref(false)
const editingSignature = ref<any>(null)

const loadSignatures = async () => {
  if (!props.accountId) return
  try {
    signatures.value = await window.electronAPI.signatures.list(props.accountId)
  } catch (error) {
    logger.error('Error loading signatures:', error)
  }
}

const setDefault = async (id: string) => {
  try {
    await window.electronAPI.signatures.update(id, { isDefault: true })
    await loadSignatures()
  } catch (error) {
    logger.error('Error setting default signature:', error)
  }
}

const editSignature = (signature: any) => {
  editingSignature.value = signature
  showAddSignature.value = true
}

const deleteSignature = async (id: string) => {
  if (confirm('Are you sure you want to delete this signature?')) {
    try {
      await window.electronAPI.signatures.delete(id)
      await loadSignatures()
    } catch (error) {
      logger.error('Error deleting signature:', error)
    }
  }
}

const handleSignatureSaved = () => {
  showAddSignature.value = false
  editingSignature.value = null
  loadSignatures()
}

onMounted(() => {
  loadSignatures()
})

watch(() => props.accountId, () => {
  loadSignatures()
})
</script>

