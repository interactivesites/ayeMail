import { defineStore } from 'pinia'
import { ref } from 'vue'

type MailLayout = 'list' | 'grid' | 'calm'
type PreviewLevel = 1 | 2 | 3

const ACTION_LABELS_KEY = 'showActionLabels'
const MAIL_LAYOUT_KEY = 'mailLayoutPreference'
const PREVIEW_LEVEL_KEY = 'emailPreviewLevel'
const DARK_MODE_KEY = 'darkMode'
const THREAD_VIEW_KEY = 'threadView'
const EXPANDED_ACCOUNTS_KEY = 'expandedAccounts'
const EXPANDED_FOLDERS_KEY = 'expandedFolders'
const FAVORITE_FOLDERS_KEY = 'favoriteFolders'
const CONFIRM_ARCHIVE_KEY = 'confirmArchive'
const LANGUAGE_KEY = 'language'

const loadLanguage = (): string => {
  if (typeof window === 'undefined') return 'en'
  const stored = window.localStorage.getItem(LANGUAGE_KEY)
  return stored || 'en'
}

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

const loadExpandedAccounts = (): string[] => {
  if (typeof window === 'undefined') return []
  const stored = window.localStorage.getItem(EXPANDED_ACCOUNTS_KEY)
  if (!stored) return []
  try {
    return JSON.parse(stored) as string[]
  } catch {
    return []
  }
}

const loadExpandedFolders = (): string[] => {
  if (typeof window === 'undefined') return []
  const stored = window.localStorage.getItem(EXPANDED_FOLDERS_KEY)
  if (!stored) return []
  try {
    return JSON.parse(stored) as string[]
  } catch {
    return []
  }
}

const loadFavoriteFolders = (): string[] => {
  if (typeof window === 'undefined') return []
  const stored = window.localStorage.getItem(FAVORITE_FOLDERS_KEY)
  if (!stored) return []
  try {
    return JSON.parse(stored) as string[]
  } catch {
    return []
  }
}

const loadConfirmArchive = (): boolean => {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem(CONFIRM_ARCHIVE_KEY)
  return stored === null ? true : stored !== 'false' // Default to true (enabled)
}

export const usePreferencesStore = defineStore('preferences', () => {
  const showActionLabels = ref(loadActionLabelsPreference())
  const mailLayout = ref<MailLayout>(loadMailLayout())
  const previewLevel = ref<PreviewLevel>(loadPreviewLevel())
  const darkMode = ref(loadDarkMode())
  const threadView = ref(loadThreadView())
  const expandedAccounts = ref<string[]>(loadExpandedAccounts())
  const expandedFolders = ref<string[]>(loadExpandedFolders())
  const favoriteFolders = ref<string[]>(loadFavoriteFolders())
  const confirmArchive = ref(loadConfirmArchive())
  const language = ref(loadLanguage())

  const setLanguage = (value: string) => {
    language.value = value
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_KEY, value)
    }
  }

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

  const setConfirmArchive = (value: boolean) => {
    confirmArchive.value = value
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CONFIRM_ARCHIVE_KEY, String(value))
    }
  }

  const showEmailNotifications = ref(
    typeof window !== 'undefined'
      ? window.localStorage.getItem('showEmailNotifications') !== 'false'
      : true
  )

  const setShowEmailNotifications = (value: boolean) => {
    showEmailNotifications.value = value
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('showEmailNotifications', String(value))
    }
  }

  const setExpandedAccounts = (accountIds: string[]) => {
    expandedAccounts.value = accountIds
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(EXPANDED_ACCOUNTS_KEY, JSON.stringify(accountIds))
    }
  }

  const toggleExpandedAccount = (accountId: string) => {
    const current = expandedAccounts.value
    const index = current.indexOf(accountId)
    if (index > -1) {
      const updated = current.filter(id => id !== accountId)
      setExpandedAccounts(updated)
    } else {
      setExpandedAccounts([...current, accountId])
    }
  }

  const setExpandedFolders = (folderIds: string[]) => {
    expandedFolders.value = folderIds
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(EXPANDED_FOLDERS_KEY, JSON.stringify(folderIds))
    }
  }

  const toggleExpandedFolder = (folderId: string) => {
    const current = expandedFolders.value
    const index = current.indexOf(folderId)
    if (index > -1) {
      const updated = current.filter(id => id !== folderId)
      setExpandedFolders(updated)
    } else {
      setExpandedFolders([...current, folderId])
    }
  }

  const isAccountExpanded = (accountId: string): boolean => {
    return expandedAccounts.value.includes(accountId)
  }

  const isFolderExpanded = (folderId: string): boolean => {
    return expandedFolders.value.includes(folderId)
  }

  const setFavoriteFolders = (folderIds: string[]) => {
    favoriteFolders.value = folderIds
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FAVORITE_FOLDERS_KEY, JSON.stringify(folderIds))
    }
  }

  const toggleFavoriteFolder = (folderId: string) => {
    const current = favoriteFolders.value
    const index = current.indexOf(folderId)
    if (index > -1) {
      const updated = current.filter(id => id !== folderId)
      setFavoriteFolders(updated)
    } else {
      setFavoriteFolders([...current, folderId])
    }
  }

  const isFolderFavorite = (folderId: string): boolean => {
    return favoriteFolders.value.includes(folderId)
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
    expandedAccounts,
    setExpandedAccounts,
    toggleExpandedAccount,
    expandedFolders,
    setExpandedFolders,
    toggleExpandedFolder,
    isAccountExpanded,
    isFolderExpanded,
    favoriteFolders,
    setFavoriteFolders,
    toggleFavoriteFolder,
    isFolderFavorite,
    confirmArchive,
    setConfirmArchive,
    showEmailNotifications,
    setShowEmailNotifications,
    language,
    setLanguage,
  }
})


