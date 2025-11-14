import { defineStore } from 'pinia'
import { ref } from 'vue'

type MailLayout = 'list' | 'grid'

const ACTION_LABELS_KEY = 'showActionLabels'
const MAIL_LAYOUT_KEY = 'mailLayoutPreference'

const loadActionLabelsPreference = () => {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem(ACTION_LABELS_KEY)
  if (stored === null) return true
  return stored !== 'false'
}

const loadMailLayout = (): MailLayout => {
  if (typeof window === 'undefined') return 'list'
  const stored = window.localStorage.getItem(MAIL_LAYOUT_KEY)
  return stored === 'grid' ? 'grid' : 'list'
}

export const usePreferencesStore = defineStore('preferences', () => {
  const showActionLabels = ref(loadActionLabelsPreference())
  const mailLayout = ref<MailLayout>(loadMailLayout())

  const setShowActionLabels = (value: boolean) => {
    showActionLabels.value = value
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACTION_LABELS_KEY, String(value))
    }
  }

  const setMailLayout = (layout: MailLayout) => {
    mailLayout.value = layout
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MAIL_LAYOUT_KEY, layout)
    }
  }

  return {
    showActionLabels,
    setShowActionLabels,
    mailLayout,
    setMailLayout,
  }
})


