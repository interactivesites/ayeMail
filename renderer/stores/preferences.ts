import { defineStore } from 'pinia'
import { ref } from 'vue'

type MailLayout = 'list' | 'grid'
type PreviewLevel = 1 | 2 | 3

const ACTION_LABELS_KEY = 'showActionLabels'
const MAIL_LAYOUT_KEY = 'mailLayoutPreference'
const PREVIEW_LEVEL_KEY = 'emailPreviewLevel'
const DARK_MODE_KEY = 'darkMode'
const THREAD_VIEW_KEY = 'threadView'

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

const loadPreviewLevel = (): PreviewLevel => {
  if (typeof window === 'undefined') return 1
  const stored = window.localStorage.getItem(PREVIEW_LEVEL_KEY)
  const level = stored ? parseInt(stored, 10) : 1
  return (level === 1 || level === 2 || level === 3) ? level : 1
}

const loadDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false
  const stored = window.localStorage.getItem(DARK_MODE_KEY)
  return stored === 'true'
}

const loadThreadView = (): boolean => {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem(THREAD_VIEW_KEY)
  return stored === null ? true : stored !== 'false' // Default to true (threaded)
}

export const usePreferencesStore = defineStore('preferences', () => {
  const showActionLabels = ref(loadActionLabelsPreference())
  const mailLayout = ref<MailLayout>(loadMailLayout())
  const previewLevel = ref<PreviewLevel>(loadPreviewLevel())
  const darkMode = ref(loadDarkMode())
  const threadView = ref(loadThreadView())

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

  const setPreviewLevel = (level: PreviewLevel) => {
    previewLevel.value = level
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PREVIEW_LEVEL_KEY, String(level))
    }
  }

  const setDarkMode = (value: boolean) => {
    darkMode.value = value
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DARK_MODE_KEY, String(value))
      // Apply dark class to document element
      if (value) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }

  const setThreadView = (value: boolean) => {
    threadView.value = value
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THREAD_VIEW_KEY, String(value))
    }
  }

  return {
    showActionLabels,
    setShowActionLabels,
    mailLayout,
    setMailLayout,
    previewLevel,
    setPreviewLevel,
    darkMode,
    setDarkMode,
    threadView,
    setThreadView,
  }
})


