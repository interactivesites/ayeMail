<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
      <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ editingAccount ? $t('accounts.editAccount') : $t('accounts.addAccount') }}</h2>
        <button
          @click="$emit('close')"
          class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
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
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
            :placeholder="$t('accounts.emailAddressPlaceholder')"
          />
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
      </div>
      <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
        <button
          @click="$emit('close')"
          class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          @click="saveAccount"
          :disabled="saving"
          class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
        >
          {{ saving ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  accountId?: string
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
const editingAccount = computed(() => !!props.accountId)

const loadAccount = async () => {
  if (!props.accountId) return
  
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
  } catch (error: any) {
    console.error('Error loading account:', error)
    alert(t('accounts.failedToLoadAccount', { message: error.message }))
  }
}

onMounted(() => {
  loadAccount()
})

const saveAccount = async () => {
  if (!form.value.name || !form.value.email || !form.value.smtpHost) {
    alert(t('accounts.fillRequiredFields'))
    return
  }

  if (!editingAccount.value && !form.value.password) {
    alert(t('accounts.enterPassword'))
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
      emit('updated')
    } else {
      await window.electronAPI.accounts.add(account)
      emit('added')
    }
  } catch (error: any) {
    alert(editingAccount.value ? t('accounts.failedToUpdateAccount', { message: error.message }) : t('accounts.failedToAddAccount', { message: error.message }))
  } finally {
    saving.value = false
  }
}
</script>

