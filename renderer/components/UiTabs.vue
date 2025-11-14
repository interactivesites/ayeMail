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
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  tabs: Array<{ id: string; label: string }>
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const fallbackTab = computed(() => props.tabs[0]?.id ?? '')
const currentTab = ref(props.modelValue ?? fallbackTab.value)

watch(
  () => props.modelValue,
  (value) => {
    if (value !== undefined && value !== currentTab.value) {
      currentTab.value = value || fallbackTab.value
    }
  }
)

watch(
  () => props.tabs,
  (newTabs) => {
    if (!newTabs.find((tab) => tab.id === currentTab.value)) {
      currentTab.value = newTabs[0]?.id ?? ''
      emit('update:modelValue', currentTab.value)
    }
  },
  { deep: true }
)

const selectTab = (id: string) => {
  if (id === currentTab.value) return
  currentTab.value = id
  emit('update:modelValue', id)
}

const tabClasses = (id: string) => {
  if (id === currentTab.value) {
    return 'border-blue-600 text-blue-600'
  }
  return 'border-transparent text-gray-500 hover:text-gray-700'
}
</script>


