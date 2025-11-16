<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
      <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ editingAccount ? 'Edit Account' : 'Add Account' }}</h2>
        <button
          @click="$emit('close')"
          class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Name</label>
          <input
            v-model="form.name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="My Email Account"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
          <input
            v-model="form.email"
            type="email"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Type</label>
          <select
            v-model="form.type"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="imap">IMAP</option>
            <option value="pop3">POP3</option>
          </select>
        </div>
        <div v-if="form.type === 'imap'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IMAP Server</label>
          <div class="flex space-x-2">
            <input
              v-model="form.imapHost"
              type="text"
              class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="imap.example.com"
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
              <span class="text-sm dark:text-gray-300">SSL</span>
            </label>
          </div>
        </div>
        <div v-if="form.type === 'pop3'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">POP3 Server</label>
          <div class="flex space-x-2">
            <input
              v-model="form.pop3Host"
              type="text"
              class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="pop3.example.com"
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
              <span class="text-sm dark:text-gray-300">SSL</span>
            </label>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Server</label>
          <div class="flex space-x-2">
            <input
              v-model="form.smtpHost"
              type="text"
              class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="smtp.example.com"
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
              <span class="text-sm dark:text-gray-300">SSL</span>
            </label>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Password {{ editingAccount ? '(leave blank to keep current)' : '' }}
          </label>
          <input
            v-model="form.password"
            type="password"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-800 dark:text-gray-100"
            :placeholder="editingAccount ? 'Leave blank to keep current password' : 'Password'"
          />
        </div>
      </div>
      <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
        <button
          @click="$emit('close')"
          class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          @click="saveAccount"
          :disabled="saving"
          class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

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
    alert(`Failed to load account: ${error.message}`)
  }
}

onMounted(() => {
  loadAccount()
})

const saveAccount = async () => {
  if (!form.value.name || !form.value.email || !form.value.smtpHost) {
    alert('Please fill in all required fields')
    return
  }

  if (!editingAccount.value && !form.value.password) {
    alert('Please enter a password')
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
    alert(`Failed to ${editingAccount.value ? 'update' : 'add'} account: ${error.message}`)
  } finally {
    saving.value = false
  }
}
</script>

