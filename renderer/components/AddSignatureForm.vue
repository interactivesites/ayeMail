<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">
          {{ editingSignature ? 'Edit Signature' : 'Add Signature' }}
        </h2>
        <button
          @click="$emit('close')"
          class="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            v-model="form.name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-600"
            placeholder="Personal"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">HTML Signature</label>
          <textarea
            v-model="form.html"
            rows="6"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 font-mono text-sm"
            placeholder="<p>Your signature here</p>"
          ></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Plain Text Signature</label>
          <textarea
            v-model="form.text"
            rows="4"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 font-mono text-sm"
            placeholder="Your signature here"
          ></textarea>
        </div>
        <div>
          <label class="flex items-center">
            <input
              v-model="form.isDefault"
              type="checkbox"
              class="mr-2"
            />
            <span class="text-sm text-gray-700">Set as default signature</span>
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
          @click="saveSignature"
          :disabled="saving"
          class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  accountId: string
  editingSignature?: any
}>()

const emit = defineEmits<{
  'close': []
  'saved': []
}>()

const form = ref({
  name: '',
  html: '',
  text: '',
  isDefault: false
})

const saving = ref(false)

onMounted(() => {
  if (props.editingSignature) {
    form.value = {
      name: props.editingSignature.name,
      html: props.editingSignature.html || '',
      text: props.editingSignature.text || '',
      isDefault: props.editingSignature.is_default
    }
  }
})

const saveSignature = async () => {
  if (!form.value.name) {
    alert('Please enter a name for the signature')
    return
  }

  saving.value = true
  try {
    if (props.editingSignature) {
      await window.electronAPI.signatures.update(props.editingSignature.id, {
        name: form.value.name,
        html: form.value.html || undefined,
        text: form.value.text || undefined,
        isDefault: form.value.isDefault
      })
    } else {
      await window.electronAPI.signatures.create(props.accountId, {
        name: form.value.name,
        html: form.value.html || undefined,
        text: form.value.text || undefined,
        isDefault: form.value.isDefault
      })
    }
    emit('saved')
    emit('close')
  } catch (error: any) {
    alert(`Failed to save signature: ${error.message}`)
  } finally {
    saving.value = false
  }
}
</script>

