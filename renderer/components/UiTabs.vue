<template>
  <div>
    <div class="flex border-b border-gray-200">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        @click="selectTab(tab.id)"
        class="px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors"
        :class="tabClasses(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="pt-4">
      <slot :active-tab="currentTab"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

const props = defineProps<{
  tabs: Array<{ id: string; label: string }>
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const fallbackTab = computed(() => props.tabs[0]?.id ?? '')
const currentTab = computed({
  get: () => {
    const value = props.modelValue ?? fallbackTab.value
    // Ensure the value exists in tabs, otherwise use fallback
    if (props.tabs.length > 0 && !props.tabs.find(tab => tab.id === value)) {
      return fallbackTab.value
    }
    return value || fallbackTab.value
  },
  set: (value: string) => {
    emit('update:modelValue', value)
  }
})

watch(
  () => props.tabs,
  (newTabs) => {
    if (newTabs.length > 0) {
      const currentValue = props.modelValue ?? newTabs[0]?.id ?? ''
      if (!newTabs.find((tab) => tab.id === currentValue)) {
        const newValue = newTabs[0]?.id ?? ''
        emit('update:modelValue', newValue)
      }
    }
  },
  { immediate: true }
)

const selectTab = (id: string) => {
  if (id === currentTab.value) return
  currentTab.value = id
}

const tabClasses = (id: string) => {
  if (id === currentTab.value) {
    return 'border-primary-600 text-primary-600'
  }
  return 'border-transparent text-gray-500 hover:text-gray-700'
}
</script>


