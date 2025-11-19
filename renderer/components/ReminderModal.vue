<template>
  <!-- Full-screen modal version -->
  <div v-if="!isPopover" class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-dark-gray-900 rounded-lg shadow-xl w-full max-w-md">
      <div class="p-4 border-b border-gray-200 dark:border-dark-gray-700 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-dark-gray-100">Set Reminder</h2>
        <button
          @click="$emit('close')"
          class="text-gray-500 dark:text-dark-gray-400 hover:text-gray-700 dark:hover:text-dark-gray-200"
        >
          ✕
        </button>
      </div>
      <div class="p-4 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-dark-gray-300 mb-1">Reminder Date & Time</label>
          <input
            v-model="form.dueDate"
            type="datetime-local"
            class="w-full px-3 py-2 border border-gray-300 dark:border-dark-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-dark-gray-800 dark:text-dark-gray-100"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-dark-gray-300 mb-1">Message (optional)</label>
          <textarea
            v-model="form.message"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 dark:border-dark-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-dark-gray-800 dark:text-dark-gray-100 placeholder-gray-400 dark:placeholder-dark-gray-500"
            placeholder="Reminder message"
          ></textarea>
        </div>
      </div>
      <div class="p-4 border-t border-gray-200 dark:border-dark-gray-700 flex justify-end space-x-2">
        <button
          @click="$emit('close')"
          class="px-4 py-2 bg-gray-200 dark:bg-dark-gray-700 text-gray-700 dark:text-dark-gray-200 rounded hover:bg-gray-300 dark:hover:bg-dark-gray-600"
        >
          Cancel
        </button>
        <button
          @click="saveReminder"
          :disabled="saving"
          class="px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
  
  <!-- Popover version - calendar only -->
  <div v-else class="reminder-calendar-popover bg-white dark:bg-dark-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-dark-gray-700 relative p-3">
    <!-- Clear reminder button if reminder exists -->
    <div v-if="existingReminder" class="mb-2 flex items-center justify-between px-2">
      <span class="text-xs text-gray-600 dark:text-dark-gray-400">Reminder set</span>
      <button
        @click="clearReminder"
        :disabled="clearing"
        class="flex items-center gap-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 transition-colors"
        title="Remove reminder and move email back to original folder"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Clear Reminder
      </button>
    </div>
    <div class="flex items-start gap-4">
      <div class="w-40 flex flex-col gap-2 border border-dashed border-gray-200 dark:border-dark-gray-700 rounded-lg p-2">
        <p class="text-[11px] uppercase tracking-wide text-gray-500 dark:text-dark-gray-400">Quick picks</p>
        <button
          v-for="shortcut in quickShortcuts"
          :key="shortcut.label"
          type="button"
          class="text-left text-sm px-3 py-2 rounded-md border transition-colors"
          :class="isShortcutActive(shortcut.days)
            ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
            : 'border-gray-200 dark:border-dark-gray-700 text-gray-700 dark:text-dark-gray-200 hover:border-primary-500 hover:text-primary-600'"
          @click="applyShortcut(shortcut.days)"
        >
          {{ shortcut.label }}
        </button>
      </div>
      <div class="flex-1 min-w-[320px]">
        <VueTailwindDatepicker
          class="w-full"
          v-model="selectedDate"
          :start-from="new Date()"
          @update:model-value="handleDateSelect"
          :no-input="true"
          :as-single="true"
          :overlay="false"
          i18n="en"
          :shortcuts="false"
          :auto-apply="true"
          :highlight-dates="highlightCurrentDay"
          :disable-date="disablePastDates"
        />
      </div>
    </div>
    <div v-if="saving" class="absolute inset-0 bg-white/50 dark:bg-dark-gray-900/50 backdrop-blur-xl z-50 flex items-center justify-center rounded-lg">
      <div class="flex flex-col items-center space-y-4">
        <div class="w-12 h-12 border-4 border-primary-600 dark:border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-gray-700 dark:text-dark-gray-300 text-sm font-medium">Putting aside...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import VueTailwindDatepicker from 'vue-tailwind-datepicker'

const props = defineProps<{
  emailId: string
  accountId: string
  isPopover?: boolean
}>()

const emit = defineEmits<{
  'close': []
  'saved': []
}>()

const form = ref({
  dueDate: '',
  message: ''
})

const selectedDate = ref<[Date, Date]>([new Date(), new Date()])
const saving = ref(false)
const clearing = ref(false)
const existingReminder = ref<any>(null)
const quickShortcuts = [
  { label: 'tomorrow', days: 1 },
  { label: 'in 3 days', days: 3 },
  { label: 'next week', days: 7 },
  { label: 'sometime (about 2 weeks)', days: 14 }
]

// Function to highlight the current day
const highlightCurrentDay = (date: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const compareDate = new Date(date)
  compareDate.setHours(0, 0, 0, 0)
  return compareDate.getTime() === today.getTime()
}

// Function to disable dates before tomorrow
const disablePastDates = (date: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const compareDate = new Date(date)
  compareDate.setHours(0, 0, 0, 0)
  return compareDate.getTime() < tomorrow.getTime()
}

// Track if component is mounted to prevent initial trigger
let isMounted = false
// Initialize lastSelectedValue to prevent watch from triggering on mount
let lastSelectedValue: any = [new Date(), new Date()]

// Check for existing reminder and reset selected date when popover opens
onMounted(async () => {
  if (props.isPopover) {
    // Check if email already has a reminder
    try {
      existingReminder.value = await window.electronAPI.reminders.getByEmail(props.emailId)
      if (existingReminder.value) {
        // Set selected date to reminder date
        const reminderDate = new Date(existingReminder.value.due_date)
        selectedDate.value = [reminderDate, reminderDate]
        lastSelectedValue = [reminderDate, reminderDate]
      } else {
        // Initialize with tomorrow (minimum selectable date)
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(0, 0, 0, 0)
        selectedDate.value = [tomorrow, tomorrow]
        lastSelectedValue = [tomorrow, tomorrow]
      }
    } catch (error) {
      console.error('Error checking for existing reminder:', error)
      // Initialize with tomorrow (minimum selectable date)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      selectedDate.value = [tomorrow, tomorrow]
      lastSelectedValue = [tomorrow, tomorrow]
    }
    // Set mounted flag after a short delay to allow initial value to settle
    setTimeout(() => {
      isMounted = true
    }, 100)
  } else {
    isMounted = true
  }
})

// Watch for changes in selectedDate (backup handler in case @update:model-value doesn't fire)
watch(selectedDate, (newValue) => {
  // Don't trigger on initial mount or if already processing
  if (!isMounted || !props.isPopover || !newValue || saving.value || isProcessing) {
    return
  }
  
  // Only trigger if it's a meaningful change (not just initialization)
  const valueStr = JSON.stringify(newValue)
  const lastStr = JSON.stringify(lastSelectedValue)
  if (valueStr !== lastStr && Array.isArray(newValue) && newValue.length > 0) {
    // Check if dates are actually different (not just same date in array)
    const newDate = newValue[0]
    const lastDate = lastSelectedValue?.[0]
    if (!lastDate || newDate.getTime() !== lastDate.getTime()) {
      lastSelectedValue = newValue
      // Small delay to avoid double-triggering with @update:model-value
      setTimeout(() => {
        if (!saving.value && !isProcessing && isMounted) {
          handleDateSelect(newValue)
        }
      }, 200)
    }
  }
}, { deep: true })

let isProcessing = false

const isShortcutActive = (days: number): boolean => {
  if (!selectedDate.value?.[0]) return false
  const current = new Date(selectedDate.value[0])
  current.setHours(0, 0, 0, 0)
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() + days)
  return current.getTime() === base.getTime()
}

const applyShortcut = async (days: number) => {
  if (saving.value || clearing.value) return
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  const target = new Date(base)
  target.setDate(base.getDate() + days)
  const tomorrow = new Date(base)
  tomorrow.setDate(base.getDate() + 1)
  if (target.getTime() < tomorrow.getTime()) {
    target.setTime(tomorrow.getTime())
  }
  // Set default reminder time to 10 AM for shortcuts
  target.setHours(10, 0, 0, 0)
  const normalizedTarget = new Date(target)
  isProcessing = true
  selectedDate.value = [normalizedTarget, normalizedTarget]
  lastSelectedValue = [normalizedTarget, normalizedTarget]
  await nextTick()
  isProcessing = false
  await handleDateSelect([normalizedTarget, normalizedTarget])
}

const handleDateSelect = async (value: string | string[] | Date | Date[] | any) => {
  // Prevent multiple simultaneous calls
  if (isProcessing || saving.value) {
    return
  }
  
  if (!value) {
    return
  }
  
  isProcessing = true
  
  try {
    let selected: Date | null = null
    
    // Handle different return types from vue-tailwind-datepicker
    if (Array.isArray(value)) {
      // Date array: [Date, Date] for range, or single date
      if (value.length > 0) {
        const firstValue = value[0]
        if (firstValue instanceof Date) {
          selected = firstValue
        } else if (typeof firstValue === 'string') {
          selected = new Date(firstValue)
        } else if (firstValue && typeof firstValue === 'object' && 'toDate' in firstValue) {
          // Dayjs object
          selected = firstValue.toDate()
        } else {
          selected = new Date(firstValue)
        }
      }
    } else if (value instanceof Date) {
      // Direct Date object
      selected = value
    } else if (typeof value === 'string') {
      // String date
      selected = new Date(value)
    } else if (value && typeof value === 'object') {
      // Object with start/end or startDate/endDate
      if (value.start) {
        selected = value.start instanceof Date ? value.start : new Date(value.start)
      } else if (value.startDate) {
        selected = value.startDate instanceof Date ? value.startDate : new Date(value.startDate)
      } else if (value.toDate) {
        // Dayjs object
        selected = typeof value.toDate === 'function' ? value.toDate() : new Date(value.toDate)
      }
    }
    
    if (!selected || isNaN(selected.getTime())) {
      isProcessing = false
      return
    }

    // Validate that selected date is not before tomorrow
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const selectedDateOnly = new Date(selected)
    selectedDateOnly.setHours(0, 0, 0, 0)
    
    if (selectedDateOnly.getTime() < tomorrow.getTime()) {
      alert('Please select a date from tomorrow onwards')
      isProcessing = false
      return
    }
    
    saving.value = true
    
    // Set default reminder time to 10 AM if time is midnight (from calendar selection)
    // Otherwise preserve the time (e.g., 10 AM from shortcuts)
    const dueDateObj = new Date(selected)
    if (dueDateObj.getHours() === 0 && dueDateObj.getMinutes() === 0 && dueDateObj.getSeconds() === 0) {
      dueDateObj.setHours(10, 0, 0, 0)
    }
    const dueDate = dueDateObj.getTime()
    
    await window.electronAPI.reminders.create({
      emailId: props.emailId,
      accountId: props.accountId,
      dueDate,
      message: props.isPopover ? undefined : form.value.message || undefined
    })
    
    emit('saved')
    emit('close')
  } catch (error: any) {
    alert(`Failed to create reminder: ${error.message}`)
  } finally {
    saving.value = false
    isProcessing = false
  }
}

const clearReminder = async () => {
  if (!existingReminder.value) return
  
  clearing.value = true
  try {
    const result = await window.electronAPI.reminders.deleteByEmail(props.emailId)
    if (result.success) {
      existingReminder.value = null
      emit('saved')
      emit('close')
    } else {
      alert(result.message || 'Failed to clear reminder')
    }
  } catch (error: any) {
    alert(`Failed to clear reminder: ${error.message}`)
  } finally {
    clearing.value = false
  }
}

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

<style scoped>
.reminder-calendar-popover {
  min-width: 520px;
  max-width: 580px;
  min-height: 300px;
}

/* Hide input elements for popover mode */
.reminder-calendar-popover :deep(input) {
  display: none !important;
}

.reminder-calendar-popover :deep(.dp__input_wrap) {
  display: none !important;
}

.reminder-calendar-popover :deep(.dp__input_container) {
  display: none !important;
}

/* Ensure calendar takes full width */
.reminder-calendar-popover :deep(.dp__calendar) {
  width: 100%;
  display: block;
}

.reminder-calendar-popover :deep(.dp__calendar_wrap) {
  width: 100%;
  display: block;
}

/* Vue Tailwind Datepicker will automatically use dark mode via Tailwind's dark: classes
   based on the vtd-primary and vtd-secondary colors configured in tailwind.config.js */

/* Highlight today with primary color circle */
.reminder-calendar-popover :deep(.dp__today) {
  @apply border-2 border-primary-600 dark:border-primary-500;
  background-color: rgb(154 52 18 / 0.1) !important; /* primary-600 with opacity */
}

.dark .reminder-calendar-popover :deep(.dp__today) {
  background-color: rgb(154 52 18 / 0.2) !important;
}

/* Ensure today has a circular highlight */
.reminder-calendar-popover :deep(.dp__today .dp__cell_inner) {
  @apply rounded-full;
  background-color: rgb(154 52 18 / 0.15) !important;
  border: 2px solid rgb(154 52 18) !important; /* primary-600 */
}

.dark .reminder-calendar-popover :deep(.dp__today .dp__cell_inner) {
  background-color: rgb(154 52 18 / 0.25) !important;
  border-color: rgb(124 45 18) !important; /* primary-700 */
}

/* Disable past dates styling */
.reminder-calendar-popover :deep(.dp__cell_disabled) {
  @apply opacity-40 cursor-not-allowed;
}

.reminder-calendar-popover :deep(.dp__cell_disabled .dp__cell_inner) {
  @apply opacity-40 cursor-not-allowed;
}

</style>
