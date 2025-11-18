<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
      <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ $t('settings.title') }}</h2>
        <button
          @click="$emit('close')"
          class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-4">
        <UiTabs v-model="activeTab" :tabs="settingsTabs">
          <template #default="{ activeTab: currentTab }">
            <div v-if="currentTab === 'accounts'" class="space-y-6">
              <div>
                <h3 class="text-md font-semibold text-gray-900 mb-2">{{ $t('accounts.title') }}</h3>
                <div v-if="accounts.length === 0" class="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  {{ $t('accounts.noAccountsConfigured') }}
                </div>
                <div v-else class="space-y-2 mb-4">
                  <div
                    v-for="account in accounts"
                    :key="account.id"
                    class="p-3 border border-gray-200 dark:border-gray-700 rounded flex items-center justify-between dark:bg-gray-800"
                  >
                    <div class="flex-1">
                      <div class="font-medium text-gray-900 dark:text-gray-100">{{ account.name }}</div>
                      <div class="text-sm text-gray-500 dark:text-gray-400">{{ account.email }}</div>
                    </div>
                    <div class="flex items-center space-x-2">
                      <button
                        @click="selectAccount(account)"
                        class="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
                      >
                        {{ $t('common.select') }}
                      </button>
                      <button
                        @click="editAccount(account)"
                        class="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                      >
                        {{ $t('common.edit') }}
                      </button>
                      <button
                        @click="removeAccount(account.id)"
                        class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        {{ $t('common.remove') }}
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  @click="showAddAccount = true"
                  class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  {{ $t('accounts.addAccount') }}
                </button>
              </div>
            </div>
            <div v-else-if="currentTab === 'signatures'" class="space-y-6">
              <div>
                <h3 class="text-md font-semibold text-gray-900 mb-2">{{ $t('signatures.selectAccount') }}</h3>
                <div v-if="accounts.length === 0" class="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  {{ $t('accounts.noAccountsConfiguredDesc') }}
                </div>
                <div v-else class="space-y-2 mb-4">
                  <div
                    v-for="account in accounts"
                    :key="account.id"
                    class="p-3 border border-gray-200 dark:border-gray-700 rounded flex items-center justify-between dark:bg-gray-800"
                    :class="{ 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-500': selectedAccountId === account.id }"
                  >
                    <div>
                      <div class="font-medium text-gray-900 dark:text-gray-100">{{ account.name }}</div>
                      <div class="text-sm text-gray-500 dark:text-gray-400">{{ account.email }}</div>
                    </div>
                    <button
                      @click="selectAccountForSignatures(account)"
                      class="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
                    >
                      {{ $t('common.select') }}
                    </button>
                  </div>
                </div>
              </div>
              <div v-if="selectedAccountId">
                <SignatureManager :account-id="selectedAccountId" />
              </div>
            </div>
            <div v-else-if="currentTab === 'security'" class="space-y-6">
              <div>
                <h3 class="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ $t('settings.gpgEncryption') }}</h3>
                <div class="p-3 border border-gray-200 dark:border-gray-700 rounded dark:bg-gray-800 opacity-60 pointer-events-none">
                  <div class="flex items-center justify-between mb-2">
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ $t('settings.gpgKeyManagement') }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('settings.notYetImplemented') }}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                      <button
                        disabled
                        class="px-3 py-1 bg-gray-400 text-white text-sm rounded cursor-not-allowed"
                      >
                        {{ $t('settings.importKey') }}
                      </button>
                      <button
                        disabled
                        class="px-3 py-1 bg-gray-400 text-white text-sm rounded cursor-not-allowed"
                      >
                        {{ $t('settings.generateKey') }}
                      </button>
                    </div>
                  </div>
                  <div class="text-gray-500 dark:text-gray-400 text-sm">
                    {{ $t('settings.noGpgKeys') }}
                  </div>
                </div>
              </div>
              <div>
                <h3 class="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ $t('settings.autoLock') }}</h3>
                <div class="space-y-2">
                  <label class="flex items-center">
                    <input
                      v-model="autoLockEnabled"
                      type="checkbox"
                      class="toggle mr-2"
                      @change="updateAutoLock"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">{{ $t('settings.autoLockAfterInactivity') }}</span>
                  </label>
                  <div v-if="autoLockEnabled" class="ml-6">
                    <label class="block text-sm text-gray-700 dark:text-gray-300 mb-1">{{ $t('settings.lockAfterMinutes') }}</label>
                    <input
                      v-model.number="autoLockMinutes"
                      type="number"
                      min="1"
                      class="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
                      @change="updateAutoLock"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="space-y-6">
              <div>
                <h3 class="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ $t('settings.appearance') }}</h3>
                <label class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded dark:bg-gray-800">
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ $t('settings.showActionLabels') }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('settings.showActionLabelsDesc') }}</p>
                  </div>
                  <input
                    v-model="showActionLabels"
                    type="checkbox"
                    class="toggle"
                  />
                </label>
                <label class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded mt-2 dark:bg-gray-800">
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ $t('settings.darkMode') }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('settings.darkModeDesc') }}</p>
                  </div>
                  <input
                    v-model="darkMode"
                    type="checkbox"
                    class="toggle"
                  />
                </label>
                <div class="p-3 border border-gray-200 dark:border-gray-700 rounded mt-2 dark:bg-gray-800">
                  <div class="mb-2">
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ $t('settings.language') }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('settings.languageDesc') }}</p>
                  </div>
                  <select
                    v-model="selectedLanguage"
                    @change="handleLanguageChange"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="en">{{ $t('settings.english') }}</option>
                    <option value="de">{{ $t('settings.german') }}</option>
                  </select>
                </div>
              </div>
              <div>
                <h3 class="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ $t('settings.emailActions') }}</h3>
                <label class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded dark:bg-gray-800">
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ $t('settings.confirmArchiving') }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('settings.confirmArchivingDesc') }}</p>
                  </div>
                  <input
                    v-model="confirmArchive"
                    type="checkbox"
                    class="toggle"
                  />
                </label>
              </div>
              <div>
                <h3 class="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ $t('settings.notifications') }}</h3>
                <label class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded dark:bg-gray-800">
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ $t('settings.showEmailNotifications') }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('settings.showEmailNotificationsDesc') }}</p>
                  </div>
                  <input
                    v-model="showEmailNotifications"
                    type="checkbox"
                    class="toggle"
                  />
                </label>
              </div>
              <div>
                <h3 class="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ $t('settings.autoSync') }}</h3>
                <div class="space-y-2">
                  <label class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded dark:bg-gray-800">
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ $t('settings.enableAutoSync') }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('settings.enableAutoSyncDesc') }}</p>
                    </div>
                    <input
                      v-model="autoSyncEnabled"
                      type="checkbox"
                      class="toggle"
                      @change="updateAutoSync"
                    />
                  </label>
                  <div v-if="autoSyncEnabled" class="ml-6 p-3 border border-gray-200 dark:border-gray-700 rounded dark:bg-gray-800">
                    <label class="block text-sm text-gray-700 dark:text-gray-300 mb-2">{{ $t('settings.checkEveryMinutes') }}</label>
                    <input
                      v-model.number="autoSyncInterval"
                      type="number"
                      min="1"
                      max="60"
                      class="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
                      @change="updateAutoSync"
                    />
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">{{ $t('settings.recommendedInterval') }}</p>
                  </div>
                </div>
              </div>
              <div>
                <h3 class="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ $t('settings.maintenance') }}</h3>
                <div class="p-3 border border-gray-200 dark:border-gray-700 rounded dark:bg-gray-800">
                  <div class="flex items-center justify-between mb-2">
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ $t('settings.rebuildFolders') }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('settings.rebuildFoldersDesc') }}</p>
                    </div>
                    <button
                      @click="handleRebuildFolders"
                      :disabled="rebuildingFolders"
                      class="px-4 py-2 text-sm font-medium rounded transition-colors"
                      :class="rebuildingFolders 
                        ? 'bg-gray-400 text-white cursor-not-allowed' 
                        : 'bg-orange-600 text-white hover:bg-orange-700'"
                    >
                      <span v-if="rebuildingFolders" class="flex items-center gap-2">
                        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {{ $t('settings.rebuilding') }}
                      </span>
                      <span v-else>{{ $t('settings.rebuild') }}</span>
                    </button>
                  </div>
                  <div v-if="rebuildProgress" class="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    {{ rebuildProgress }}
                  </div>
                  <div v-if="rebuildResult" class="text-xs mt-2" :class="rebuildResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                    {{ rebuildResult.message }}
                  </div>
                </div>
              </div>
              <div v-if="nativeContactsAvailable">
                <h3 class="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">Contacts Sync</h3>
                <div class="p-3 border border-gray-200 dark:border-gray-700 rounded dark:bg-gray-800">
                  <div class="flex items-center justify-between mb-2">
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Sync with System Contacts</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Import contacts from {{ isMac ? 'macOS Contacts' : 'Windows Contacts' }} to improve autocomplete suggestions.
                      </p>
                    </div>
                    <button
                      @click="syncNativeContacts"
                      :disabled="syncingContacts"
                      class="px-4 py-2 text-sm font-medium rounded transition-colors"
                      :class="syncingContacts 
                        ? 'bg-gray-400 text-white cursor-not-allowed' 
                        : 'bg-primary-600 text-white hover:bg-primary-700'"
                    >
                      <span v-if="syncingContacts" class="flex items-center gap-2">
                        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Syncing...
                      </span>
                      <span v-else>Sync Now</span>
                    </button>
                  </div>
                  <div v-if="syncResult" class="text-xs mt-2" :class="syncResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                    <span v-if="syncResult.success">
                      Synced {{ syncResult.synced }} new contacts{{ syncResult.updated > 0 ? `, updated ${syncResult.updated}` : '' }}.
                    </span>
                    <span v-else>
                      {{ syncResult.error || 'Sync failed' }}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h3 class="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ $t('common.about') }}</h3>
                <div class="p-3 border border-gray-200 dark:border-gray-700 rounded dark:bg-gray-800">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ $t('app.name') }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $t('settings.learnMoreAboutApp') }}</p>
                    </div>
                    <button
                      @click="$emit('open-about')"
                      class="px-4 py-2 text-sm font-medium rounded transition-colors bg-primary-600 text-white hover:bg-primary-700"
                    >
                      {{ $t('common.about') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </UiTabs>
      </div>
      <AddAccountForm
        v-if="showAddAccount"
        :prevent-close="props.autoShowAddAccount && accounts.length === 0"
        @close="handleAddAccountClose"
        @added="handleAccountAdded"
      />
      <AddAccountForm
        v-if="editingAccountId"
        :account-id="editingAccountId"
        @close="editingAccountId = null"
        @updated="handleAccountUpdated"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AddAccountForm from './AddAccountForm.vue'
import SignatureManager from './SignatureManager.vue'
import UiTabs from './UiTabs.vue'
import { usePreferencesStore } from '../stores/preferences'

const props = defineProps<{
  autoShowAddAccount?: boolean
}>()

const emit = defineEmits<{
  'close': []
  'account-selected': [account: any]
  'open-about': []
}>()

const accounts = ref<any[]>([])
const showAddAccount = ref(false)
const editingAccountId = ref<string | null>(null)
const selectedAccountId = ref<string>('')
const autoLockEnabled = ref(false)
const autoLockMinutes = ref(15)
const autoSyncEnabled = ref(true)
const autoSyncInterval = ref(5)
const rebuildingFolders = ref(false)
const rebuildProgress = ref<string>('')
const rebuildResult = ref<{ success: boolean; message: string } | null>(null)
const nativeContactsAvailable = ref(false)
const syncingContacts = ref(false)
const syncResult = ref<{ success: boolean; synced?: number; updated?: number; error?: string } | null>(null)
const isMac = computed(() => window.electronAPI.platform === 'darwin')
const { t, locale } = useI18n()
const settingsTabs = computed(() => [
  { id: 'general', label: t('settings.general') },
  { id: 'accounts', label: t('settings.accounts') },
  { id: 'signatures', label: t('settings.signatures') },
  { id: 'security', label: t('settings.security') },
])
const activeTab = ref('general')
const preferences = usePreferencesStore()
const showActionLabels = computed({
  get: () => preferences.showActionLabels,
  set: (value: boolean) => preferences.setShowActionLabels(value),
})

const darkMode = computed({
  get: () => preferences.darkMode,
  set: (value: boolean) => preferences.setDarkMode(value),
})

const confirmArchive = computed({
  get: () => preferences.confirmArchive,
  set: (value: boolean) => preferences.setConfirmArchive(value),
})

const showEmailNotifications = computed({
  get: () => preferences.showEmailNotifications,
  set: (value: boolean) => preferences.setShowEmailNotifications(value),
})

const selectedLanguage = computed({
  get: () => preferences.language,
  set: (value: string) => {
    preferences.setLanguage(value)
  }
})

const handleLanguageChange = () => {
  locale.value = selectedLanguage.value
}

const loadAccounts = async () => {
  try {
    accounts.value = await window.electronAPI.accounts.list()
  } catch (error) {
    console.error('Error loading accounts:', error)
  }
}

const selectAccount = (account: any) => {
  selectedAccountId.value = account.id
  emit('account-selected', account)
}

const selectAccountForSignatures = (account: any) => {
  selectedAccountId.value = account.id
}

const removeAccount = async (id: string) => {
  if (confirm(t('accounts.removeAccountConfirm'))) {
    try {
      await window.electronAPI.accounts.remove(id)
      await loadAccounts()
    } catch (error) {
      console.error('Error removing account:', error)
    }
  }
}

const editAccount = (account: any) => {
  editingAccountId.value = account.id
}

const handleAddAccountClose = () => {
  // Don't allow closing if this is a fresh start (no accounts)
  if (props.autoShowAddAccount && accounts.value.length === 0) {
    return
  }
  showAddAccount.value = false
}

const handleAccountAdded = async () => {
  showAddAccount.value = false
  await loadAccounts()
  if (accounts.value.length > 0) {
    if (!selectedAccountId.value) {
      selectedAccountId.value = accounts.value[0].id
    }
    // Emit account-selected so App.vue can update hasAccounts
    emit('account-selected', accounts.value[0])
  }
}

const handleAccountUpdated = () => {
  editingAccountId.value = null
  loadAccounts()
}

const updateAutoLock = () => {
  // Auto-lock configuration would be stored and handled by main process
  // For now, just store in localStorage
  localStorage.setItem('autoLockEnabled', String(autoLockEnabled.value))
  localStorage.setItem('autoLockMinutes', String(autoLockMinutes.value))
}

const updateAutoSync = async () => {
  // Store settings
  localStorage.setItem('autoSyncEnabled', String(autoSyncEnabled.value))
  localStorage.setItem('autoSyncInterval', String(autoSyncInterval.value))
  
  // Notify backend to update auto-sync scheduler
  try {
    await window.electronAPI.emails.updateAutoSync(autoSyncEnabled.value, autoSyncInterval.value)
  } catch (error) {
    console.error('Error updating auto-sync settings:', error)
  }
}

const handleRebuildFolders = async () => {
  if (!confirm('This will clear and re-sync all folders with full email bodies. This may take a while. Continue?')) {
    return
  }

  rebuildingFolders.value = true
  rebuildProgress.value = 'Loading accounts...'
  rebuildResult.value = null

  try {
    const allAccounts = await window.electronAPI.accounts.list()
    let totalFolders = 0
    let processedFolders = 0
    let totalSynced = 0

    for (const account of allAccounts) {
      rebuildProgress.value = `Loading folders for ${account.email}...`
      const folders = await window.electronAPI.folders.list(account.id)
      
      // Flatten folder tree
      const flatFolders: any[] = []
      const flatten = (folderList: any[]) => {
        for (const folder of folderList) {
          if (!folder.isUnified) {
            flatFolders.push(folder)
          }
          if (folder.children) {
            flatten(folder.children)
          }
        }
      }
      flatten(folders)
      
      totalFolders += flatFolders.length

      // Clear and resync each folder
      for (const folder of flatFolders) {
        processedFolders++
        rebuildProgress.value = `Processing ${folder.name} (${processedFolders}/${totalFolders})...`
        
        try {
          const result = await window.electronAPI.emails.clearAndResyncFolder(account.id, folder.id)
          if (result.success) {
            totalSynced += result.synced || 0
          }
        } catch (error: any) {
          console.error(`Error rebuilding folder ${folder.name}:`, error)
        }
      }
    }

    rebuildResult.value = {
      success: true,
      message: `Successfully rebuilt ${totalFolders} folders with ${totalSynced} emails`
    }
    rebuildProgress.value = ''

    // Refresh the email list
    window.dispatchEvent(new CustomEvent('refresh-emails'))
    window.dispatchEvent(new CustomEvent('refresh-folders'))
  } catch (error: any) {
    rebuildResult.value = {
      success: false,
      message: `Error: ${error.message}`
    }
    rebuildProgress.value = ''
  } finally {
    rebuildingFolders.value = false
  }
}

const checkNativeContactsAvailability = async () => {
  try {
    const result = await window.electronAPI.contacts.native.isAvailable()
    nativeContactsAvailable.value = result.available || false
  } catch (error) {
    console.error('Error checking native contacts availability:', error)
    nativeContactsAvailable.value = false
  }
}

const syncNativeContacts = async () => {
  syncingContacts.value = true
  syncResult.value = null
  try {
    const result = await window.electronAPI.contacts.native.sync()
    syncResult.value = result
    // Clear result after 5 seconds
    setTimeout(() => {
      syncResult.value = null
    }, 5000)
  } catch (error: any) {
    syncResult.value = {
      success: false,
      error: error.message || 'Failed to sync contacts'
    }
  } finally {
    syncingContacts.value = false
  }
}

onMounted(async () => {
  await loadAccounts()
  // Sync i18n locale with preferences on mount
  locale.value = preferences.language
  // Load auto-lock settings
  autoLockEnabled.value = localStorage.getItem('autoLockEnabled') === 'true'
  const savedMinutes = localStorage.getItem('autoLockMinutes')
  if (savedMinutes) {
    autoLockMinutes.value = parseInt(savedMinutes, 10)
  }
  
  // Load auto-sync settings
  autoSyncEnabled.value = localStorage.getItem('autoSyncEnabled') !== 'false' // Default enabled
  const savedInterval = localStorage.getItem('autoSyncInterval')
  if (savedInterval) {
    autoSyncInterval.value = parseInt(savedInterval, 10)
  }
  
  // Check native contacts availability
  await checkNativeContactsAvailability()
  
  // Auto-show add account form if prop is set (fresh start)
  if (props.autoShowAddAccount) {
    activeTab.value = 'accounts'
    showAddAccount.value = true
  }
})
</script>

