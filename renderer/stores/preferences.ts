import { defineStore } from 'pinia'
import { ref } from 'vue'

type MailLayout = 'list' | 'grid' | 'calm'
type PreviewLevel = 1 | 2 | 3

const ACTION_LABELS_KEY = 'showActionLabels'
const MAIL_LAYOUT_KEY = 'mailLayoutPreference'
const PREVIEW_LEVEL_KEY = 'emailPreviewLevel'

const loadActionLabelsPreference = () => {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem(ACTION_LABELS_KEY)
  if (stored === null) return true
  return stored !== 'false'
}

const loadMailLayout = (): MailLayout => {
  if (typeof window === 'undefined') return 'list'
  const stored = window.localStorage.getItem(MAIL_LAYOUT_KEY)
  if (stored === 'grid' || stored === 'calm') return stored as MailLayout
  return 'list'
}

const loadPreviewLevel = (): PreviewLevel => {
  if (typeof window === 'undefined') return 1
  const stored = window.localStorage.getItem(PREVIEW_LEVEL_KEY)
  const level = stored ? parseInt(stored, 10) : 1
  return (level === 1 || level === 2 || level === 3) ? level : 1
}

export const usePreferencesStore = defineStore('preferences', () => {
  const showActionLabels = ref(loadActionLabelsPreference())
  const mailLayout = ref<MailLayout>(loadMailLayout())
  const previewLevel = ref<PreviewLevel>(loadPreviewLevel())

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

  return {
    showActionLabels,
    setShowActionLabels,
    mailLayout,
    setMailLayout,
    previewLevel,
    setPreviewLevel,
  }
})


