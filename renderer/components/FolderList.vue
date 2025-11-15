<template>
  <div class="h-full flex flex-col text-slate-100">
    <div class="p-4 border-b border-white/10 flex items-center justify-between">
      <h2 class="text-sm font-semibold tracking-wide uppercase text-white/60">Folders</h2>
      <div class="app-no-drag flex items-center space-x-1 bg-white/5 rounded-full p-0.5 shadow-inner">
        <button
          type="button"
          @click="handleLayoutChange('list')"
          :aria-pressed="preferences.mailLayout === 'list'"
          class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          :class="preferences.mailLayout === 'list' ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white/90'"
          title="List view"
        >
          <ListBulletIcon class="w-4 h-4" />
        </button>
        <button
          type="button"
          @click="handleLayoutChange('grid')"
          :aria-pressed="preferences.mailLayout === 'calm' || preferences.mailLayout === 'grid'"
          class="p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          :class="(preferences.mailLayout === 'calm' || preferences.mailLayout === 'grid') ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white/90'"
          title="Grid / Calm Mode"
        >
          <Squares2X2Icon class="w-4 h-4" />
        </button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="p-4 text-center text-white/70">
        Loading folders...
      </div>
      <div v-else>
        <!-- Unified Folders Section -->
        <div v-if="unifiedFolders.length > 0" class="mb-4">
          <FolderTreeItem
            v-for="folder in unifiedFolders"
            :key="folder.id"
            :folder="folder"
            :selected-folder-id="selectedFolderId"
            :level="0"
            @select="handleFolderSelect"
          />
        </div>
        
        <!-- Account Sections -->
        <div v-for="accountSection in accountSections" :key="accountSection.account.id" class="mb-2">
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
              :level="0"
              @select="handleFolderSelect"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, computed } from 'vue'
import { usePreferencesStore } from '../stores/preferences'
import { ListBulletIcon, Squares2X2Icon } from '@heroicons/vue/24/outline'
import FolderTreeItem from './FolderTreeItem.vue'

const props = defineProps<{
  accountId?: string
  selectedFolderId?: string
}>()

const emit = defineEmits<{
  'select-folder': [folder: any]
}>()

const accounts = ref<any[]>([])
const accountFolders = ref<Map<string, any[]>>(new Map())
const expandedAccounts = ref<Set<string>>(new Set())
const loading = ref(false)
const preferences = usePreferencesStore()

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
  
  // Aside folder (unified) - for reminder emails grouped by reminder date
  folders.push({
    id: 'unified-aside',
    name: 'Aside',
    accountId: null,
    isUnified: true,
    unread_count: 0
  })
  
  return folders
})

const accountSections = computed((): AccountSection[] => {
  return accounts.value.map(account => {
    const folders = accountFolders.value.get(account.id) || []
    // Filter out inbox from account folders since it's in unified section
    const filteredFolders = folders.filter((f: any) => f.name.toLowerCase() !== 'inbox')
    
    // Calculate unread count for account
    const unreadCount = folders.reduce((sum: number, f: any) => sum + (f.unread_count || 0), 0)
    
    return {
      account,
      folders: filteredFolders,
      expanded: expandedAccounts.value.has(account.id),
      unreadCount
    }
  })
})

const loadAllAccounts = async () => {
  try {
    accounts.value = await window.electronAPI.accounts.list()
    
    // Load folders for each account
    for (const account of accounts.value) {
      await loadAccountFolders(account.id)
    }
    
    // Auto-expand account if it has selected folder
    if (props.selectedFolderId) {
      for (const account of accounts.value) {
        const folders = accountFolders.value.get(account.id) || []
        const hasSelectedFolder = folders.some((f: any) => 
          f.id === props.selectedFolderId || 
          (f.children && findFolderInTree(f.children, props.selectedFolderId))
        )
        if (hasSelectedFolder) {
          expandedAccounts.value.add(account.id)
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
  if (expandedAccounts.value.has(accountId)) {
    expandedAccounts.value.delete(accountId)
  } else {
    expandedAccounts.value.add(accountId)
  }
}

const handleFolderSelect = (folder: any) => {
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
  let accountId: string | null = null
  for (const [accId, folders] of accountFolders.value.entries()) {
    if (findFolderInTree(folders, folder.id)) {
      accountId = accId
      break
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
})

watch(() => props.selectedFolderId, () => {
  // Auto-expand accounts with selected folder
  if (props.selectedFolderId) {
    for (const account of accounts.value) {
      const folders = accountFolders.value.get(account.id) || []
      const hasSelectedFolder = folders.some((f: any) => 
        f.id === props.selectedFolderId || 
        (f.children && findFolderInTree(f.children, props.selectedFolderId))
      )
      if (hasSelectedFolder) {
        expandedAccounts.value.add(account.id)
      }
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('refresh-folders', refreshFolders)
})
</script>

