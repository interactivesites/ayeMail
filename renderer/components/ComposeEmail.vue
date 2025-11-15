<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[80vh] flex flex-col">
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">Compose Email</h2>
        <button
          @click="$emit('close')"
          class="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input
            v-model="form.to"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-600"
            placeholder="recipient@example.com"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">CC</label>
          <input
            v-model="form.cc"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-600"
            placeholder="cc@example.com"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input
            v-model="form.subject"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-600"
            placeholder="Subject"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Body</label>
          <textarea
            v-model="form.body"
            rows="10"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-600"
            placeholder="Email body"
          ></textarea>
        </div>
        <div class="flex items-center space-x-4">
          <label class="flex items-center">
            <input
              v-model="form.encrypt"
              type="checkbox"
              class="mr-2"
            />
            <span class="text-sm text-gray-700">Encrypt</span>
          </label>
          <label class="flex items-center">
            <input
              v-model="form.sign"
              type="checkbox"
              class="mr-2"
            />
            <span class="text-sm text-gray-700">Sign</span>
          </label>
        </div>
      </div>
      <div class="p-4 border-t border-gray-200 flex justify-end space-x-2">
        <button
          @click="$emit('close')"
          class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          @click="sendEmail"
          :disabled="sending"
          class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
        >
          {{ sending ? 'Sending...' : 'Send' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  accountId: string
  replyTo?: any
}>()

const emit = defineEmits<{
  'close': []
  'sent': []
}>()

const form = ref({
  to: '',
  cc: '',
  subject: props.replyTo?.forward ? `Fwd: ${props.replyTo.subject || ''}` : (props.replyTo ? `Re: ${props.replyTo.subject || ''}` : ''),
  body: props.replyTo?.forward 
    ? `\n\n---------- Forwarded message ----------\nFrom: ${props.replyTo.from?.[0]?.address || ''}\nDate: ${new Date(props.replyTo.date).toLocaleString()}\nSubject: ${props.replyTo.subject || ''}\n\n${props.replyTo.body || ''}`
    : (props.replyTo ? `\n\n--- Original Message ---\n${props.replyTo.body || ''}` : ''),
  encrypt: false,
  sign: false
})

// Set recipient for forward
if (props.replyTo?.forward && props.replyTo.from?.[0]?.address) {
  // Forward: leave To empty for user to fill
  // Could also pre-populate with original sender if desired
}

const signatures = ref<any[]>([])
const defaultSignature = ref<any>(null)

onMounted(async () => {
  if (props.accountId) {
    try {
      signatures.value = await window.electronAPI.signatures.list(props.accountId)
      defaultSignature.value = signatures.value.find(s => s.is_default)
      if (defaultSignature.value && !props.replyTo) {
        // Add default signature to body if not replying
        form.value.body += '\n\n' + (defaultSignature.value.html || defaultSignature.value.text)
      }
    } catch (error) {
      console.error('Error loading signatures:', error)
    }
  }
})

const sending = ref(false)

const parseAddresses = (str: string): any[] => {
  if (!str) return []
  return str.split(',').map(addr => {
    const match = addr.trim().match(/^(.+?)\s*<(.+?)>$|^(.+?)$/)
    if (match) {
      return {
        name: match[1] || match[3] || undefined,
        address: match[2] || match[3] || match[1]
      }
    }
    return { address: addr.trim() }
  })
}

const sendEmail = async () => {
  if (!form.value.to) {
    alert('Please enter a recipient')
    return
  }

  sending.value = true
  try {
    const result = await window.electronAPI.emails.send({
      accountId: props.accountId,
      to: parseAddresses(form.value.to),
      cc: form.value.cc ? parseAddresses(form.value.cc) : undefined,
      subject: form.value.subject,
      body: form.value.body,
      htmlBody: form.value.body,
      encrypt: form.value.encrypt,
      sign: form.value.sign
    })

    if (result.success) {
      emit('sent')
      emit('close')
    } else {
      alert(`Failed to send email: ${result.message || result.error}`)
    }
  } catch (error: any) {
    alert(`Error sending email: ${error.message}`)
  } finally {
    sending.value = false
  }
}
</script>

