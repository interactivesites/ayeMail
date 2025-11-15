<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
      <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
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
                <h3 class="text-md font-semibold text-gray-900 mb-2">Accounts</h3>
                <div v-if="accounts.length === 0" class="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  No accounts configured
                </div>
                <div v-else class="space-y-2 mb-4">
                  <div
                    v-for="account in accounts"
                    :key="account.id"
                    class="p-3 border border-gray-200 dark:border-gray-700 rounded flex items-center justify-between dark:bg-gray-800"
                  >
                    <div>
                      <div class="font-medium text-gray-900 dark:text-gray-100">{{ account.name }}</div>
                      <div class="text-sm text-gray-500 dark:text-gray-400">{{ account.email }}</div>
                    </div>
                    <div class="flex items-center space-x-2">
                      <button
                        @click="selectAccount(account)"
                        class="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
                      >
                        Select
                      </button>
                      <button
                        @click="editAccount(account)"
                        class="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                      >
                        Edit
                      </button>
                      <button
                        @click="removeAccount(account.id)"
                        class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  @click="showAddAccount = true"
                  class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  Add Account
                </button>
              </div>
            </div>
            <div v-else-if="currentTab === 'signatures'" class="space-y-6">
              <div>
                <h3 class="text-md font-semibold text-gray-900 mb-2">Select Account</h3>
                <div v-if="accounts.length === 0" class="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  No accounts configured. Please add an account first.
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
                      Select
                    </button>
                  </div>
                </div>
              </div>
              <div v-if="selectedAccountId">
                <SignatureManager :account-id="selectedAccountId" />
              </div>
            </div>
            <div v-else class="space-y-6">
              <div>
                <h3 class="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">Appearance</h3>
                <label class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded dark:bg-gray-800">
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Show action button labels</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Hide labels for an icon-only toolbar</p>
                  </div>
                  <input
                    v-model="showActionLabels"
                    type="checkbox"
                    class="toggle"
                  />
                </label>
                <label class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded mt-2 dark:bg-gray-800">
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Dark mode</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Toggle dark theme</p>
                  </div>
                  <input
                    v-model="darkMode"
                    type="checkbox"
                    class="toggle"
                  />
                </label>
              </div>
              <div>
                
                <GPGKeyManager />
              </div>
              <div>
                <h3 class="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">Security</h3>
                <div class="space-y-2">
                  <label class="flex items-center">
                    <input
                      v-model="autoLockEnabled"
                      type="checkbox"
                      class="toggle mr-2"
                      @change="updateAutoLock"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">Auto-lock after inactivity</span>
                  </label>
                  <div v-if="autoLockEnabled" class="ml-6">
                    <label class="block text-sm text-gray-700 dark:text-gray-300 mb-1">Lock after (minutes)</label>
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
          </template>
        </UiTabs>
      </div>
      <AddAccountForm
        v-if="showAddAccount"
        @close="showAddAccount = false"
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
import AddAccountForm from './AddAccountForm.vue'
import SignatureManager from './SignatureManager.vue'
import GPGKeyManager from './GPGKeyManager.vue'
import UiTabs from './UiTabs.vue'
import { usePreferencesStore } from '../stores/preferences'

const emit = defineEmits<{
  'close': []
  'account-selected': [account: any]
}>()

const accounts = ref<any[]>([])
const showAddAccount = ref(false)
const editingAccountId = ref<string | null>(null)
const selectedAccountId = ref<string>('')
const autoLockEnabled = ref(false)
const autoLockMinutes = ref(15)
const settingsTabs = [
  { id: 'general', label: 'General' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'signatures', label: 'Signatures' },
]
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
  if (confirm('Are you sure you want to remove this account?')) {
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

const handleAccountAdded = () => {
  showAddAccount.value = false
  loadAccounts().then(() => {
    if (accounts.value.length > 0 && !selectedAccountId.value) {
      selectedAccountId.value = accounts.value[0].id
    }
  })
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

onMounted(() => {
  loadAccounts()
  // Load auto-lock settings
  autoLockEnabled.value = localStorage.getItem('autoLockEnabled') === 'true'
  const savedMinutes = localStorage.getItem('autoLockMinutes')
  if (savedMinutes) {
    autoLockMinutes.value = parseInt(savedMinutes, 10)
  }
})
</script>

