<template>
  <div class="h-full flex flex-col text-slate-100">
    <div class="p-4 border-b border-white/10 flex items-center justify-between">
      <h2 class="text-sm font-semibold tracking-wide uppercase text-white/60">{{ $t('folders.title') }}</h2>
      <div class="app-no-drag flex items-center space-x-1 bg-white/5 rounded-full p-0.5 shadow-inner">
        <button
          type="button"
          @click="handleLayoutChange('list')"
          :aria-pressed="preferences.mailLayout === 'list'"
          class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          :class="preferences.mailLayout === 'list' ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white/90'"
          :title="$t('folders.listView')"
        >
          <ListBulletIcon class="w-4 h-4" />
        </button>
        <button
          type="button"
          @click="handleLayoutChange('grid')"
          :aria-pressed="preferences.mailLayout === 'calm' || preferences.mailLayout === 'grid'"
          class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          :class="(preferences.mailLayout === 'calm' || preferences.mailLayout === 'grid') ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white/90'"
          :title="$t('folders.gridView')"
        >
          <Squares2X2Icon class="w-4 h-4" />
        </button>
      </div>
    </div>
    <ThinScrollbar class="flex-1">
      <div v-if="loading" class="p-4 text-center text-white/70">
        {{ $t('folders.loadingFolders') }}
      </div>
      <div v-else>
        <!-- Favorites Section -->
        <div v-if="favoriteFolders.length > 0" class="mb-4 pb-4">
          <FolderTreeItem
            v-for="folder in favoriteFolders"
            :key="folder.id"
            :folder="folder"
            :selected-folder-id="selectedFolderId"
            :syncing-folder-id="syncingFolderId"
            :level="0"
            @select="handleFolderSelect"
          />
        </div>
        
        <!-- Unified Folders Section -->
        <div v-if="displayedUnifiedFolders.length > 0" class="mb-4">
          <FolderTreeItem
            v-for="folder in displayedUnifiedFolders"
            :key="folder.id"
            :folder="folder"
            :selected-folder-id="selectedFolderId"
            :syncing-folder-id="syncingFolderId"
            :level="0"
            @select="handleFolderSelect"
          />
        </div>
        
        <!-- Account Sections -->
        
        <div v-for="accountSection in accountSections" :key="accountSection.account.id" class="mb-2 border-t border-white/10">
          <button
            @click="toggleAccount(accountSection.account.id)"
            class="w-full text-left flex items-center justify-between px-4 py-2 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 text-white/80 hover:bg-white/5"
          >
            <div class="flex items-center gap-2">
              <svg
                class="w-3 h-3 text-white/60 transition-transform"
                :class="{ 'rotate-90': accountSection.expanded }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
              <span class="text-sm font-medium">{{ accountSection.account.name || accountSection.account.email }}</span>
            </div>
            <span v-if="accountSection.unreadCount > 0" class="text-xs bg-white/15 text-white px-2 py-0.5 rounded-full border border-white/20">
              {{ accountSection.unreadCount }}
            </span>
          </button>
          
          <div v-if="accountSection.expanded && accountSection.folders.length > 0" class="ml-4 mt-1">
            <FolderTreeItem
              v-for="folder in accountSection.folders"
              :key="folder.id"
              :folder="folder"
              :selected-folder-id="selectedFolderId"
              :syncing-folder-id="syncingFolderId"
              :level="0"
              @select="handleFolderSelect"
            />
          </div>
        </div>
      </div>
    </ThinScrollbar>
    <div class="border-t border-white/10 p-4 space-y-2">
      <!-- <a
        v-if="!preferences.isSupporter"
        href="https://buymeacoffee.com/interactivesites"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg transition-colors text-white/80 hover:text-white text-sm font-medium"
        @click="handleSupporterClick"
      >
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.5 3H6c-1.1 0-2 .9-2 2v5.71c0 3.83 2.95 7.18 6.78 7.29 3.96.12 7.22-3.06 7.22-7v-1h.5c1.38 0 2.5-1.12 2.5-2.5S19.88 3 18.5 3zm-2 6v-4h2v1h.5c.28 0 .5.22.5.5s-.22.5-.5.5H16.5zm-13 0V5h10v4H5.5zM4 19h16v2H4v-2z"/>
        </svg>
        <span>Buy me a coffee</span>
      </a> -->
      <button
        @click="handleAboutClick"
        class="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg transition-colors text-white/80 hover:text-white text-sm font-medium"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>{{ $t('common.about') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, computed } from 'vue'
import { usePreferencesStore } from '../stores/preferences'
import { ListBulletIcon, Squares2X2Icon } from '@heroicons/vue/24/outline'
import FolderTreeItem from './FolderTreeItem.vue'
import ThinScrollbar from './ThinScrollbar.vue'

const props = defineProps<{
  accountId?: string
  selectedFolderId?: string
  syncingFolderId?: string | null
}>()

const emit = defineEmits<{
  'select-folder': [folder: any]
  'open-about': []
}>()

const accounts = ref<any[]>([])
const accountFolders = ref<Map<string, any[]>>(new Map())
const loading = ref(false)
const preferences = usePreferencesStore()
const hasSpamToday = ref(false)


const handleAboutClick = () => {
  emit('open-about')
}



interface AccountSection {
  account: any
  folders: any[]
  expanded: boolean
  unreadCount: number
}

const unifiedFolders = computed(() => {
  const folders: any[] = []
  
  // All Inboxes - tree structure
  const allInboxesChildren: any[] = []
  let totalUnread = 0
  
  accounts.value.forEach(account => {
    const accountFoldersList = accountFolders.value.get(account.id) || []
    const inbox = accountFoldersList.find((f: any) => f.name.toLowerCase() === 'inbox')
    if (inbox) {
      allInboxesChildren.push({
        ...inbox,
        accountId: account.id,
        name: `Inbox (${account.email})`,
        isUnifiedChild: true
      })
      totalUnread += inbox.unread_count || 0
    }
  })
  
  if (allInboxesChildren.length > 0) {
    folders.push({
      id: 'unified-all-inboxes',
      name: 'All Inboxes',
      accountId: null,
      isUnified: true,
      unread_count: totalUnread,
      children: allInboxesChildren
    })
  }
  
  // Spam folder (unified) - show spam from all accounts, only if spam received today
  // Note: Spam, Reminders, and Aside are now shown in favorites section, not here
  if (hasSpamToday.value) {
    const spamFolders: any[] = []
    let totalSpamUnread = 0
    
    accounts.value.forEach(account => {
      const accountFoldersList = accountFolders.value.get(account.id) || []
      const spam = accountFoldersList.find((f: any) => 
        f.name.toLowerCase() === 'spam' || 
        f.name.toLowerCase() === 'junk' ||
        f.path?.toLowerCase().includes('spam') ||
        f.path?.toLowerCase().includes('junk')
      )
      if (spam) {
        spamFolders.push({
          ...spam,
          accountId: account.id,
          name: `Spam (${account.email})`,
          isUnifiedChild: true
        })
        totalSpamUnread += spam.unread_count || 0
      }
    })
    
    if (spamFolders.length > 0) {
      folders.push({
        id: 'unified-spam',
        name: 'Spam',
        accountId: null,
        isUnified: true,
        unread_count: totalSpamUnread,
        children: spamFolders
      })
    }
  }
  
  // Reminders folder (unified) - for reminder emails grouped by reminder date
  folders.push({
    id: 'unified-reminders',
    name: 'Reminders',
    accountId: null,
    isUnified: true,
    unread_count: 0
  })
  
  // Aside folder (unified) - show all archived emails from all accounts
  folders.push({
    id: 'unified-aside',
    name: 'Aside',
    accountId: null,
    isUnified: true,
    unread_count: 0
  })
  
  return folders
})

// Unified folders to display (excluding always-favorites which are shown in favorites section)
const displayedUnifiedFolders = computed(() => {
  const alwaysFavoriteIds = ['unified-all-inboxes', 'unified-reminders', 'unified-aside', 'unified-spam']
  return unifiedFolders.value.filter(folder => !alwaysFavoriteIds.includes(folder.id))
})

const favoriteFolders = computed(() => {
  const favoriteIds = preferences.favoriteFolders
  const allFolders: any[] = []
  
  // Helper function to flatten folder tree
  const flattenFolders = (folderList: any[]): any[] => {
    const result: any[] = []
    for (const folder of folderList) {
      result.push(folder)
      if (folder.children && folder.children.length > 0) {
        result.push(...flattenFolders(folder.children))
      }
    }
    return result
  }
  
  // Collect unified folders
  const unified = unifiedFolders.value
  allFolders.push(...flattenFolders(unified))
  
  // Collect account folders
  accounts.value.forEach(account => {
    const accountFoldersList = accountFolders.value.get(account.id) || []
    allFolders.push(...flattenFolders(accountFoldersList))
  })
  
  // Always include all inboxes, reminders, aside, and spam in favorites section
  const alwaysFavoriteIds = ['unified-all-inboxes', 'unified-reminders', 'unified-aside', 'unified-spam']
  const alwaysFavorites = allFolders.filter(folder => alwaysFavoriteIds.includes(folder.id))
  
  // Add user-selected favorites (excluding always-favorites to avoid duplicates)
  const userFavorites = allFolders.filter(folder => {
    const isAlwaysFavorite = alwaysFavoriteIds.includes(folder.id)
    return !isAlwaysFavorite && favoriteIds.includes(folder.id)
  })
  
  // Combine always-favorites and user favorites
  return [...alwaysFavorites, ...userFavorites]
})

const accountSections = computed((): AccountSection[] => {
  return accounts.value.map(account => {
    const folders = accountFolders.value.get(account.id) || []
    // Filter out inbox and aside from account folders since they're in unified section
    let filteredFolders = folders.filter((f: any) => 
      f.name.toLowerCase() !== 'inbox' && 
      f.name.toLowerCase() !== 'aside' &&
      !f.path?.toLowerCase().includes('aside')
    )
    
    // Calculate unread count for account
    const unreadCount = folders.reduce((sum: number, f: any) => sum + (f.unread_count || 0), 0)
    
    return {
      account,
      folders: filteredFolders,
      expanded: preferences.isAccountExpanded(account.id),
      unreadCount
    }
  })
})

const checkSpamToday = async () => {
  try {
    hasSpamToday.value = await window.electronAPI.folders.hasSpamToday()
  } catch (error) {
    console.error('Error checking spam today:', error)
    hasSpamToday.value = false
  }
}

const loadAllAccounts = async () => {
  try {
    accounts.value = await window.electronAPI.accounts.list()
    
    // Load folders for each account
    for (const account of accounts.value) {
      await loadAccountFolders(account.id)
    }
    
    // Check if spam folders have emails from today
    await checkSpamToday()
    
    // Auto-expand account if it has selected folder
    if (props.selectedFolderId) {
      const selectedId = props.selectedFolderId
      for (const account of accounts.value) {
        const folders = accountFolders.value.get(account.id) || []
        const hasSelectedFolder = folders.some((f: any) => 
          f.id === selectedId || 
          (f.children && findFolderInTree(f.children, selectedId))
        )
        if (hasSelectedFolder && !preferences.isAccountExpanded(account.id)) {
          preferences.toggleExpandedAccount(account.id)
        }
      }
    }
  } catch (error) {
    console.error('Error loading accounts:', error)
  }
}

const findFolderInTree = (folders: any[], folderId: string): boolean => {
  for (const folder of folders) {
    if (folder.id === folderId) return true
    if (folder.children && findFolderInTree(folder.children, folderId)) return true
  }
  return false
}

const loadAccountFolders = async (accountId: string) => {
  try {
    const folders = await window.electronAPI.folders.list(accountId)
    accountFolders.value.set(accountId, folders)
  } catch (error) {
    console.error(`Error loading folders for account ${accountId}:`, error)
    accountFolders.value.set(accountId, [])
  }
}

const toggleAccount = (accountId: string) => {
  preferences.toggleExpandedAccount(accountId)
}

const handleFolderSelect = async (folder: any) => {
  // If it's a unified folder child (like individual inbox), find the actual folder
  if (folder.isUnifiedChild && folder.accountId) {
    const accountFoldersList = accountFolders.value.get(folder.accountId) || []
    const actualFolder = accountFoldersList.find((f: any) => f.id === folder.id)
    if (actualFolder) {
      emit('select-folder', { ...actualFolder, accountId: folder.accountId })
      return
    }
  }
  
  // For unified folders, emit with special handling
  if (folder.isUnified) {
    emit('select-folder', { ...folder, accountId: null })
    return
  }
  
  // For regular folders, find the account
  // First try to get accountId from folder itself (account_id from database)
  let accountId: string | null = folder.accountId || folder.account_id || null
  
  // If not found, search through folder tree
  if (!accountId) {
    for (const [accId, folders] of accountFolders.value.entries()) {
      if (findFolderInTree(folders, folder.id)) {
        accountId = accId
        break
      }
    }
  }
  
  emit('select-folder', { ...folder, accountId })
}

const refreshFolders = async () => {
  loading.value = true
  try {
    await loadAllAccounts()
  } finally {
    loading.value = false
  }
}

const handleLayoutChange = (layout: 'list' | 'calm' | 'grid') => {
  // Map 'grid' to 'calm' for backward compatibility
  if (layout === 'grid') {
    layout = 'calm'
  }
  preferences.setMailLayout(layout)
}

onMounted(() => {
  loading.value = true
  loadAllAccounts().finally(() => {
    loading.value = false
  })
  window.addEventListener('refresh-folders', refreshFolders)
  window.addEventListener('refresh-emails', checkSpamToday)
})

watch(() => props.selectedFolderId, () => {
  // Auto-expand accounts with selected folder
  if (props.selectedFolderId) {
    const selectedId = props.selectedFolderId
    for (const account of accounts.value) {
      const folders = accountFolders.value.get(account.id) || []
      const hasSelectedFolder = folders.some((f: any) => 
        f.id === selectedId || 
        (f.children && findFolderInTree(f.children, selectedId))
      )
      if (hasSelectedFolder && !preferences.isAccountExpanded(account.id)) {
        preferences.toggleExpandedAccount(account.id)
      }
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('refresh-folders', refreshFolders)
  window.removeEventListener('refresh-emails', checkSpamToday)
})
</script>

