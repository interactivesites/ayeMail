<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">Set Reminder</h2>
        <button
          @click="$emit('close')"
          class="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      <div class="p-4 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Reminder Date & Time</label>
          <input
            v-model="form.dueDate"
            type="datetime-local"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
          <textarea
            v-model="form.message"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Reminder message"
          ></textarea>
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
          @click="saveReminder"
          :disabled="saving"
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  emailId: string
  accountId: string
}>()

const emit = defineEmits<{
  'close': []
  'saved': []
}>()

const form = ref({
  dueDate: '',
  message: ''
})

const saving = ref(false)

const saveReminder = async () => {
  if (!form.value.dueDate) {
    alert('Please select a date and time')
    return
  }

  saving.value = true
  try {
    const dueDate = new Date(form.value.dueDate).getTime()
    await window.electronAPI.reminders.create({
      emailId: props.emailId,
      accountId: props.accountId,
      dueDate,
      message: form.value.message || undefined
    })
    emit('saved')
    emit('close')
  } catch (error: any) {
    alert(`Failed to create reminder: ${error.message}`)
  } finally {
    saving.value = false
  }
}
</script>

