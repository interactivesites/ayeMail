<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
      <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ editingAccount ? $t('accounts.editAccount') : $t('accounts.addAccount') }}</h2>
        <button
          v-if="!preventClose"
          @click="$emit('close')"
          class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>
      <!-- Error/Message Display -->
      <div v-if="errorMessage || successMessage" class="mx-4 mt-4 p-3 rounded-md" :class="errorMessage ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg v-if="errorMessage" class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <svg v-else class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3 flex-1">
            <p class="text-sm font-medium" :class="errorMessage ? 'text-red-800 dark:text-red-200' : 'text-green-800 dark:text-green-200'">
              {{ errorMessage || successMessage }}
            </p>
          </div>
          <button
            @click="errorMessage = ''; successMessage = ''"
            class="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- Simple mode: Email and Password only -->
        <div v-if="!showAdvanced">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('accounts.emailAddress') }}</label>
            <input
              v-model="form.email"
              type="email"
              @blur="autoDetectSettings"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="your.email@domain.com"
            />
            <p v-if="detectedProvider" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ detectedProvider }}
            </p>
            <div v-if="showAutoConfigFeedback" class="mt-2 space-y-1">
              <div class="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <div
                  v-if="autoConfigState.status === 'finding'"
                  class="h-full w-full bg-primary-500/80 animate-pulse"
                ></div>
                <div
                  v-else-if="autoConfigState.status === 'connecting'"
                  class="h-full w-full bg-primary-500 animate-pulse"
                ></div>
                <div
                  v-else-if="autoConfigState.status === 'success'"
                  class="h-full w-full bg-green-500 transition-all duration-300"
                ></div>
                <div
                  v-else-if="autoConfigState.status === 'failed'"
                  class="h-full w-full bg-red-500 transition-all duration-300"
                ></div>
              </div>
              <p
                class="text-xs"
                :class="autoConfigState.status === 'failed' ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'"
              >
                {{ autoConfigState.error || autoConfigState.message }}
              </p>
            </div>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ editingAccount ? $t('accounts.passwordLeaveBlank') : $t('accounts.password') }}
            </label>
            <input
              v-model="form.password"
              type="password"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
              :placeholder="editingAccount ? $t('accounts.passwordLeaveBlankPlaceholder') : $t('accounts.passwordPlaceholder')"
            />
          </div>
          <button
            @click="showAdvanced = true"
            class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            {{ $t('accounts.advancedSettings') || 'Advanced Settings' }}
          </button>
        </div>

        <!-- Advanced mode: All fields -->
        <template v-else>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('accounts.accountName') }}</label>
          <input
            v-model="form.name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
            :placeholder="$t('accounts.accountNamePlaceholder')"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('accounts.emailAddress') }}</label>
          <input
            v-model="form.email"
            type="email"
              @blur="autoDetectSettings"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="your.email@domain.com"
            />
            <p v-if="detectedProvider" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ detectedProvider }}
            </p>
            <div v-if="showAutoConfigFeedback" class="mt-2 space-y-1">
              <div class="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <div
                  v-if="autoConfigState.status === 'finding'"
                  class="h-full w-full bg-primary-500/80 animate-pulse"
                ></div>
                <div
                  v-else-if="autoConfigState.status === 'connecting'"
                  class="h-full w-full bg-primary-500 animate-pulse"
                ></div>
                <div
                  v-else-if="autoConfigState.status === 'success'"
                  class="h-full w-full bg-green-500 transition-all duration-300"
                ></div>
                <div
                  v-else-if="autoConfigState.status === 'failed'"
                  class="h-full w-full bg-red-500 transition-all duration-300"
                ></div>
              </div>
              <p
                class="text-xs"
                :class="autoConfigState.status === 'failed' ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'"
              >
                {{ autoConfigState.error || autoConfigState.message }}
              </p>
            </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('accounts.accountType') }}</label>
          <select
            v-model="form.type"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="imap">{{ $t('accounts.imap') }}</option>
            <option value="pop3">{{ $t('accounts.pop3') }}</option>
          </select>
        </div>
        <div v-if="form.type === 'imap'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('accounts.imapServer') }}</label>
          <div class="flex space-x-2">
            <input
              v-model="form.imapHost"
              type="text"
              class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
              :placeholder="$t('accounts.imapServerPlaceholder')"
            />
            <input
              v-model.number="form.imapPort"
              type="number"
              class="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="993"
            />
            <label class="flex items-center px-2">
              <input
                v-model="form.imapSecure"
                type="checkbox"
                class="mr-1"
              />
              <span class="text-sm dark:text-gray-300">{{ $t('accounts.ssl') }}</span>
            </label>
          </div>
        </div>
        <div v-if="form.type === 'pop3'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('accounts.pop3Server') }}</label>
          <div class="flex space-x-2">
            <input
              v-model="form.pop3Host"
              type="text"
              class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
              :placeholder="$t('accounts.pop3ServerPlaceholder')"
            />
            <input
              v-model.number="form.pop3Port"
              type="number"
              class="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="995"
            />
            <label class="flex items-center px-2">
              <input
                v-model="form.pop3Secure"
                type="checkbox"
                class="mr-1"
              />
              <span class="text-sm dark:text-gray-300">{{ $t('accounts.ssl') }}</span>
            </label>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ $t('accounts.smtpServer') }}</label>
          <div class="flex space-x-2">
            <input
              v-model="form.smtpHost"
              type="text"
              class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
              :placeholder="$t('accounts.smtpServerPlaceholder')"
            />
            <input
              v-model.number="form.smtpPort"
              type="number"
              class="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="587"
            />
            <label class="flex items-center px-2">
              <input
                v-model="form.smtpSecure"
                type="checkbox"
                class="mr-1"
              />
              <span class="text-sm dark:text-gray-300">{{ $t('accounts.ssl') }}</span>
            </label>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ editingAccount ? $t('accounts.passwordLeaveBlank') : $t('accounts.password') }}
          </label>
          <input
            v-model="form.password"
            type="password"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
            :placeholder="editingAccount ? $t('accounts.passwordLeaveBlankPlaceholder') : $t('accounts.passwordPlaceholder')"
          />
        </div>
          <button
            @click="showAdvanced = false"
            class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            {{ $t('accounts.simpleMode') || 'Simple Mode' }}
          </button>
        </template>
      </div>
      <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
        <button
          v-if="!preventClose"
          @click="$emit('close')"
          class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          @click="connectionTested ? saveAccount() : testConnection()"
          :disabled="saving || testingConnection"
          class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
        >
          <span v-if="testingConnection">{{ $t('accounts.testingConnection') || 'Testing...' }}</span>
          <span v-else-if="connectionTested">{{ saving ? $t('common.saving') : $t('common.save') }}</span>
          <span v-else>{{ $t('accounts.testConnection') || 'Test Connection' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { getServerConfig, getEmailServerConfig } from '../utils/email-providers'

const props = defineProps<{
  accountId?: string
  preventClose?: boolean
}>()

const emit = defineEmits<{
  'close': []
  'added': []
  'updated': []
}>()

const form = ref({
  name: '',
  email: '',
  type: 'imap' as 'imap' | 'pop3',
  imapHost: '',
  imapPort: 993,
  imapSecure: true,
  pop3Host: '',
  pop3Port: 995,
  pop3Secure: true,
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  password: ''
})

const { t } = useI18n()
const saving = ref(false)
const testingConnection = ref(false)
const connectionTested = ref(false)
const editingAccount = computed(() => !!props.accountId)
const showAdvanced = ref(false)
const detectedProvider = ref('')
const errorMessage = ref('')
const successMessage = ref('')

// Provider names for display
const providerNames: Record<string, string> = {
  'gmail.com': 'Gmail',
  'googlemail.com': 'Gmail',
  'outlook.com': 'Outlook',
  'hotmail.com': 'Outlook',
  'live.com': 'Outlook',
  'msn.com': 'Outlook',
  'yahoo.com': 'Yahoo',
  'ymail.com': 'Yahoo',
  'icloud.com': 'iCloud',
  'me.com': 'iCloud',
  'mac.com': 'iCloud',
  'aol.com': 'AOL',
  'protonmail.com': 'ProtonMail',
  'proton.me': 'ProtonMail',
  'fastmail.com': 'FastMail',
  'zoho.com': 'Zoho',
  'yandex.com': 'Yandex',
  'yandex.ru': 'Yandex',
  'all-inkl.com': 'ALL-INKL',
  'all-inkl.de': 'ALL-INKL',
  'kasserver.com': 'Kasserver',
  'kasserver.de': 'Kasserver'
}

type AutoConfigStatus = 'idle' | 'finding' | 'connecting' | 'success' | 'failed'
const autoConfigState = reactive({
  status: 'idle' as AutoConfigStatus,
  message: '',
  error: ''
})
let autoConfigTimeout: ReturnType<typeof setTimeout> | null = null
let autoConfigRequestId = 0

const resetAutoConfigState = () => {
  autoConfigState.status = 'idle'
  autoConfigState.message = ''
  autoConfigState.error = ''
}

const autoDetectSettings = () => {
  if (!form.value.email || !form.value.email.includes('@')) {
    detectedProvider.value = ''
    return false
  }

  const config = getServerConfig(form.value.email)
  const knownConfig = getEmailServerConfig(form.value.email)
  
  // Set detected provider name
  const domain = form.value.email.toLowerCase().split('@')[1]
  detectedProvider.value = knownConfig 
    ? (providerNames[domain] || providerNames[domain.split('.').slice(-2).join('.')] || '')
    : ''

  // Auto-fill account name if empty
  if (!form.value.name && form.value.email) {
    form.value.name = form.value.email.split('@')[0]
  }

  // Apply detected settings
  form.value.type = config.type
  form.value.imapHost = config.imap.host
  form.value.imapPort = config.imap.port
  form.value.imapSecure = config.imap.secure
  form.value.pop3Host = config.imap.host.replace('imap.', 'pop3.') // Fallback for POP3
  form.value.pop3Port = 995
  form.value.pop3Secure = true
  form.value.smtpHost = config.smtp.host
  form.value.smtpPort = config.smtp.port
  form.value.smtpSecure = config.smtp.secure

  return !!knownConfig
}

const buildProbePayload = () => {
  const payload: any = {
    email: form.value.email,
    type: form.value.type,
    authType: 'password',
    password: form.value.password || undefined
  }

  if (form.value.type === 'imap') {
    payload.imap = {
      host: form.value.imapHost,
      port: form.value.imapPort,
      secure: form.value.imapSecure
    }
  } else {
    payload.pop3 = {
      host: form.value.pop3Host,
      port: form.value.pop3Port,
      secure: form.value.pop3Secure
    }
  }

  return payload
}

const attemptAutoConfiguration = async () => {
  if (
    editingAccount.value ||
    !form.value.email ||
    !form.value.email.includes('@')
  ) {
    resetAutoConfigState()
    return
  }

  const requestId = ++autoConfigRequestId
  autoConfigState.status = 'finding'
  autoConfigState.message = t('accounts.autoConfigSearching') || 'Looking up provider settings...'
  autoConfigState.error = ''

  const hasKnownProvider = autoDetectSettings()
  if (requestId !== autoConfigRequestId) {
    return
  }

  if (!hasKnownProvider) {
    autoConfigState.status = 'failed'
    autoConfigState.error = t('accounts.autoConfigNoProvider') || 'No provider preset found. Opening advanced settings.'
    if (form.value.password) {
      showAdvanced.value = true
    }
    return
  }

  if (!form.value.password) {
    autoConfigState.status = 'success'
    autoConfigState.message = t('accounts.autoConfigEnterPassword') || 'Enter your password so we can try connecting.'
    return
  }

  autoConfigState.status = 'connecting'
  autoConfigState.message = t('accounts.autoConfigTesting') || 'Testing the connection...'

  try {
    const result = await window.electronAPI.accounts.probe(buildProbePayload())
    if (requestId !== autoConfigRequestId) {
      return
    }

    if (result?.success) {
      const successKey = detectedProvider.value ? 'accounts.autoConfigSuccessWithProvider' : 'accounts.autoConfigSuccess'
      autoConfigState.status = 'success'
      autoConfigState.message = t(successKey, { provider: detectedProvider.value }) ||
        'Connection successful.'
      showAdvanced.value = false
    } else {
      autoConfigState.status = 'failed'
      autoConfigState.error = result?.message || t('accounts.autoConfigGenericError') ||
        'Automatic setup failed. Opening advanced settings.'
      showAdvanced.value = true
    }
  } catch (error: any) {
    if (requestId !== autoConfigRequestId) {
      return
    }
    autoConfigState.status = 'failed'
    autoConfigState.error = error?.message || t('accounts.autoConfigGenericError') ||
      'Automatic setup failed. Opening advanced settings.'
    showAdvanced.value = true
  }
}

const scheduleAutoConfig = () => {
  if (autoConfigTimeout) {
    clearTimeout(autoConfigTimeout)
  }
  autoConfigTimeout = setTimeout(() => {
    attemptAutoConfiguration()
  }, 400)
}

const showAutoConfigFeedback = computed(() => !editingAccount.value && autoConfigState.status !== 'idle')

watch(
  () => [form.value.email, form.value.password],
  () => {
    if (editingAccount.value) {
      return
    }
    // Clear messages when form fields change
    errorMessage.value = ''
    successMessage.value = ''
    // Reset connection tested status when email or password changes
    connectionTested.value = false
    if (form.value.email && form.value.email.includes('@')) {
      scheduleAutoConfig()
    } else {
      resetAutoConfigState()
    }
  }
)

// Reset connection tested when server settings change
watch(
  () => [form.value.imapHost, form.value.imapPort, form.value.smtpHost, form.value.smtpPort, form.value.type],
  () => {
    if (!editingAccount.value) {
      connectionTested.value = false
    }
  }
)

onBeforeUnmount(() => {
  if (autoConfigTimeout) {
    clearTimeout(autoConfigTimeout)
  }
})

const loadAccount = async () => {
  if (!props.accountId) {
    // For new accounts, start in simple mode
    showAdvanced.value = false
    connectionTested.value = false
    errorMessage.value = ''
    successMessage.value = ''
    return
  }
  
  try {
    const account = await window.electronAPI.accounts.get(props.accountId)
    form.value = {
      name: account.name || '',
      email: account.email || '',
      type: account.type || 'imap',
      imapHost: account.imap?.host || '',
      imapPort: account.imap?.port || 993,
      imapSecure: account.imap?.secure ?? true,
      pop3Host: account.pop3?.host || '',
      pop3Port: account.pop3?.port || 995,
      pop3Secure: account.pop3?.secure ?? true,
      smtpHost: account.smtp?.host || '',
      smtpPort: account.smtp?.port || 587,
      smtpSecure: account.smtp?.secure ?? false,
      password: '' // Never load password for security
    }
    // When editing, show advanced mode and mark as tested (existing account)
    showAdvanced.value = true
    connectionTested.value = true
  } catch (error: any) {
    console.error('Error loading account:', error)
    errorMessage.value = t('accounts.failedToLoadAccount', { message: error.message }) || `Failed to load account: ${error.message}`
  }
}

onMounted(() => {
  loadAccount()
})

const testConnection = async () => {
  // Clear previous messages
  errorMessage.value = ''
  successMessage.value = ''

  // Auto-detect settings if not already done
  if (form.value.email && !form.value.smtpHost) {
    autoDetectSettings()
  }

  // Auto-fill name from email if empty
  if (!form.value.name && form.value.email) {
    form.value.name = form.value.email.split('@')[0]
  }

  if (!form.value.email) {
    errorMessage.value = t('accounts.fillRequiredFields') || 'Please enter your email address'
    return
  }

  if (!form.value.smtpHost) {
    errorMessage.value = t('accounts.fillRequiredFields') || 'Could not detect server settings. Please use Advanced Settings.'
    return
  }

  if (!form.value.password) {
    errorMessage.value = t('accounts.enterPassword') || 'Please enter your password'
    return
  }

  testingConnection.value = true
  try {
    const payload = buildProbePayload()
    const result = await window.electronAPI.accounts.probe(payload)
    
    if (result?.success) {
      connectionTested.value = true
      // Show success message inline
      successMessage.value = detectedProvider.value 
        ? t('accounts.autoConfigSuccessWithProvider', { provider: detectedProvider.value }) || `Connection successful using ${detectedProvider.value} presets.`
        : t('accounts.autoConfigSuccess') || 'Connection successful!'
      errorMessage.value = ''
    } else {
      errorMessage.value = result?.message || t('accounts.testConnectionFailed') || 'Connection test failed. Please check your settings.'
      successMessage.value = ''
    }
  } catch (error: any) {
    errorMessage.value = error?.message || t('accounts.testConnectionFailed') || 'Connection test failed. Please check your settings.'
    successMessage.value = ''
  } finally {
    testingConnection.value = false
  }
}

const saveAccount = async () => {
  // For new accounts, require connection test first
  if (!editingAccount.value && !connectionTested.value) {
    await testConnection()
    if (!connectionTested.value) {
      return // Don't save if test failed
    }
  }

  // Auto-detect settings if not already done
  if (form.value.email && !form.value.smtpHost) {
    autoDetectSettings()
  }

  // Auto-fill name from email if empty
  if (!form.value.name && form.value.email) {
    form.value.name = form.value.email.split('@')[0]
  }

  // Clear previous messages
  errorMessage.value = ''
  successMessage.value = ''

  if (!form.value.email) {
    errorMessage.value = t('accounts.fillRequiredFields') || 'Please enter your email address'
    return
  }

  if (!form.value.smtpHost) {
    errorMessage.value = t('accounts.fillRequiredFields') || 'Could not detect server settings. Please use Advanced Settings.'
    return
  }

  if (!editingAccount.value && !form.value.password) {
    errorMessage.value = t('accounts.enterPassword') || 'Please enter your password'
    return
  }

  saving.value = true
  try {
    const account: any = {
      name: form.value.name,
      email: form.value.email,
      type: form.value.type,
      smtp: {
        host: form.value.smtpHost,
        port: form.value.smtpPort,
        secure: form.value.smtpSecure
      },
      authType: 'password'
    }

    if (form.value.type === 'imap') {
      account.imap = {
        host: form.value.imapHost || 'imap.' + form.value.email.split('@')[1],
        port: form.value.imapPort,
        secure: form.value.imapSecure
      }
    } else {
      account.pop3 = {
        host: form.value.pop3Host || 'pop3.' + form.value.email.split('@')[1],
        port: form.value.pop3Port,
        secure: form.value.pop3Secure
      }
    }

    if (form.value.password) {
      account.password = form.value.password
    }

    if (editingAccount.value) {
      await window.electronAPI.accounts.update(props.accountId!, account)
      successMessage.value = t('accounts.accountUpdated') || 'Account updated successfully!'
      errorMessage.value = ''
      emit('updated')
    } else {
      await window.electronAPI.accounts.add(account)
      successMessage.value = t('accounts.accountAdded') || 'Account added successfully!'
      errorMessage.value = ''
      emit('added')
      // Trigger folder refresh after adding new account
      window.dispatchEvent(new CustomEvent('refresh-folders'))
    }
  } catch (error: any) {
    errorMessage.value = editingAccount.value 
      ? t('accounts.failedToUpdateAccount', { message: error.message }) || `Failed to update account: ${error.message}`
      : t('accounts.failedToAddAccount', { message: error.message }) || `Failed to add account: ${error.message}`
    successMessage.value = ''
  } finally {
    saving.value = false
  }
}
</script>
