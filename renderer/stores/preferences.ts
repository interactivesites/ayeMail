import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'showActionLabels'

const loadInitialPreference = () => {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === null) return true
  return stored !== 'false'
}

export const usePreferencesStore = defineStore('preferences', () => {
  const showActionLabels = ref(loadInitialPreference())

  const setShowActionLabels = (value: boolean) => {
    showActionLabels.value = value
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, String(value))
    }
  }

  return {
    showActionLabels,
    setShowActionLabels,
  }
})


