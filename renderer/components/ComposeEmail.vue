<template>
  <div 
    class="fixed inset-0 bg-black flex items-center justify-center z-50"
    @dragover="handleDragOver"
    @dragenter="handleDragEnter"
    @drop="handleDrop"
  >
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
      <div 
        class="flex-1 overflow-y-auto p-4 space-y-4 relative"
        :class="{ 'border-2 border-dashed border-primary-400 bg-primary-50/30': isDragging }"
        @dragleave.prevent="handleDragLeave"
      >
        <div>
          <input
            v-model="form.to"
            type="text"
            class="w-full px-3 py-2 bg-transparent border-0 border-b border-gray-300 rounded-none focus:outline-none focus:ring-0 focus:border-primary-600 transition-colors"
            placeholder="To"
          />
        </div>
        <div>
          <input
            v-model="form.cc"
            type="text"
            class="w-full px-3 py-2 bg-transparent border-0 border-b border-gray-300 rounded-none focus:outline-none focus:ring-0 focus:border-primary-600 transition-colors"
            placeholder="CC"
          />
        </div>
        <div>
          <input
            v-model="form.subject"
            type="text"
            class="w-full px-3 py-2 bg-transparent border-0 border-b border-gray-300 rounded-none focus:outline-none focus:ring-0 focus:border-primary-600 transition-colors"
            placeholder="Subject"
          />
        </div>
        <div>
          <textarea
            v-model="form.body"
            rows="10"
            class="w-full px-3 py-2 bg-transparent border-0 rounded-none focus:outline-none focus:ring-0 focus:border-primary-600 transition-colors resize-none"
            placeholder="Email body"
          ></textarea>
        </div>
        <div class="flex items-center space-x-4 ">
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
        <div class="flex items-center justify-between border-t border-gray-200 pt-4 mt-4">
          <div class="flex items-center space-x-2">
            <input
              ref="fileInput"
              type="file"
              multiple
              @change="handleFileSelect"
              class="hidden"
            />
            <button
              @click="fileInput?.click()"
              type="button"
              class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2 font-medium"
              title="Attach Files"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span>Upload Files</span>
            </button>
            <span v-if="attachments.length > 0" class="text-sm text-gray-600">
              {{ attachments.length }} file{{ attachments.length > 1 ? 's' : '' }} attached ({{ formatTotalSize() }})
            </span>
          </div>
        </div>
        <div v-if="attachments.length > 0" class="space-y-2">
          <div
            v-for="(attachment, index) in attachments"
            :key="index"
            class="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
            :class="{ 'border-2 border-red-300 bg-red-50': attachment.size > MAX_FILE_SIZE }"
          >
            <div class="flex items-center space-x-2 flex-1 min-w-0">
              <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <div class="flex-1 min-w-0">
                <span class="text-sm text-gray-700 block truncate">{{ attachment.name }}</span>
                <span class="text-xs" :class="attachment.size > MAX_FILE_SIZE ? 'text-red-600 font-medium' : 'text-gray-500'">
                  {{ formatSize(attachment.size) }}
                  <span v-if="attachment.size > MAX_FILE_SIZE"> (exceeds 15MB limit)</span>
                </span>
              </div>
            </div>
            <button
              @click="removeAttachment(index)"
              class="ml-2 text-gray-400 hover:text-red-600 transition-colors"
              title="Remove attachment"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
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
import { ref, onMounted, onUnmounted } from 'vue'
import { formatSize } from '../utils/formatters'

const props = defineProps<{
  accountId: string
  replyTo?: any
}>()

const emit = defineEmits<{
  'close': []
  'sent': []
}>()

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB

// Get the text content from email, preferring textBody over body, and stripping HTML if needed
const getEmailTextContent = (email: any): string => {
  if (!email) return ''
  // Prefer textBody (plain text), then body, then strip HTML from htmlBody
  if (email.textBody) return email.textBody
  if (email.body) return email.body
  if (email.htmlBody) {
    // Strip HTML tags for plain text display
    const tmp = document.createElement('div')
    tmp.innerHTML = email.htmlBody
    return tmp.textContent || tmp.innerText || ''
  }
  return ''
}

// Format email address for display in To field
const formatAddressForTo = (address: any): string => {
  if (!address) return ''
  if (typeof address === 'string') return address
  if (address.name && address.address) {
    return `${address.name} <${address.address}>`
  }
  return address.address || ''
}

const form = ref({
  to: props.replyTo && !props.replyTo.forward && props.replyTo.from && props.replyTo.from.length > 0
    ? props.replyTo.from.map(formatAddressForTo).join(', ')
    : '',
  cc: '',
  subject: props.replyTo?.forward ? `Fwd: ${props.replyTo.subject || ''}` : (props.replyTo ? `Re: ${props.replyTo.subject || ''}` : ''),
  body: props.replyTo?.forward 
    ? `\n\n---------- Forwarded message ----------\nFrom: ${props.replyTo.from?.[0]?.address || ''}\nDate: ${new Date(props.replyTo.date).toLocaleString()}\nSubject: ${props.replyTo.subject || ''}\n\n${getEmailTextContent(props.replyTo)}`
    : (props.replyTo ? `\n\n--- Original Message ---\n${getEmailTextContent(props.replyTo)}` : ''),
  encrypt: false,
  sign: false
})

const fileInput = ref<HTMLInputElement | null>(null)
const attachments = ref<Array<{ name: string; size: number; file: File }>>([])
const isDragging = ref(false)

// Set recipient for forward
if (props.replyTo?.forward && props.replyTo.from?.[0]?.address) {
  // Forward: leave To empty for user to fill
  // Could also pre-populate with original sender if desired
}

const signatures = ref<any[]>([])
const defaultSignature = ref<any>(null)

// Prevent browser default file drag behavior at document level
// This MUST prevent default to stop Electron from opening files
const preventDocumentDragOver = (e: DragEvent) => {
  // Always prevent default for file drags to stop browser/Electron from opening files
  if (e.dataTransfer?.types.some(type => type === 'Files' || type === 'application/x-moz-file')) {
    e.preventDefault()
    e.stopPropagation()
  }
}

const preventDocumentDrop = (e: DragEvent) => {
  // Always prevent default for file drops unless handled by our component
  if (e.dataTransfer?.types.some(type => type === 'Files' || type === 'application/x-moz-file')) {
    const target = e.target as HTMLElement
    // Only allow if dropping on our compose component
    if (!target.closest('.fixed.inset-0')) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
  }
}

onMounted(async () => {
  // Add document-level handlers to prevent browser/Electron from opening files
  // Use capture phase to catch events before they bubble
  document.addEventListener('dragover', preventDocumentDragOver, true)
  document.addEventListener('drop', preventDocumentDrop, true)
  
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

onUnmounted(() => {
  // Remove document-level handlers
  document.removeEventListener('dragover', preventDocumentDragOver, true)
  document.removeEventListener('drop', preventDocumentDrop, true)
})

const sending = ref(false)

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    addFiles(Array.from(target.files))
  }
  // Reset input so same file can be selected again
  if (target) {
    target.value = ''
  }
}

const handleDragEnter = (event: DragEvent) => {
  // Check if dragging files
  const hasFiles = event.dataTransfer?.types.some(type => type === 'Files' || type === 'application/x-moz-file')
  if (hasFiles) {
    event.preventDefault()
    event.stopPropagation()
    isDragging.value = true
  }
}

const handleDragOver = (event: DragEvent) => {
  // Check if dragging files - MUST preventDefault to allow drop
  const hasFiles = event.dataTransfer?.types.some(type => type === 'Files' || type === 'application/x-moz-file')
  if (hasFiles) {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
    isDragging.value = true
  }
}

const handleDragLeave = (event: DragEvent) => {
  // Only handle file drags
  if (event.dataTransfer?.types.includes('Files')) {
    event.preventDefault()
    event.stopPropagation()
    // Only set to false if we're leaving the container (not just moving between child elements)
    const currentTarget = event.currentTarget as HTMLElement
    const relatedTarget = event.relatedTarget as Node | null
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      isDragging.value = false
    }
  }
}

const handleDrop = (event: DragEvent) => {
  // Always prevent default to stop browser from opening/navigating to file
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  
  isDragging.value = false
  
  // Check if we have files
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    console.log('Dropped files:', files.length)
    addFiles(Array.from(files))
  }
  
  // Clear the data transfer to prevent any further processing
  if (event.dataTransfer) {
    event.dataTransfer.clearData()
  }
  
  return false
}

const addFiles = (files: File[]) => {
  const newFiles: Array<{ name: string; size: number; file: File }> = []
  const oversizedFiles: string[] = []
  
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      oversizedFiles.push(file.name)
    } else {
      newFiles.push({
        name: file.name,
        size: file.size,
        file: file
      })
    }
  }
  
  if (oversizedFiles.length > 0) {
    alert(`The following files exceed the 15MB limit and were not added:\n${oversizedFiles.join('\n')}\n\nFiles larger than 15MB will use a dropbox implementation (not yet implemented).`)
  }
  
  if (newFiles.length > 0) {
    attachments.value.push(...newFiles)
  }
}

const removeAttachment = (index: number) => {
  attachments.value.splice(index, 1)
}

const formatTotalSize = (): string => {
  const total = attachments.value.reduce((sum, att) => sum + att.size, 0)
  return formatSize(total)
}

const fileToBuffer = (file: File): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer
      resolve(Buffer.from(arrayBuffer))
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

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

  // Check for oversized attachments
  const oversized = attachments.value.filter(att => att.size > MAX_FILE_SIZE)
  if (oversized.length > 0) {
    alert('Cannot send email with attachments exceeding 15MB. Please remove oversized files or use the dropbox implementation.')
    return
  }

  sending.value = true
  try {
    // Convert File objects to Buffer format
    const attachmentBuffers = await Promise.all(
      attachments.value.map(async (att) => ({
        filename: att.name,
        content: await fileToBuffer(att.file),
        contentType: att.file.type || 'application/octet-stream'
      }))
    )

    const result = await window.electronAPI.emails.send({
      accountId: props.accountId,
      to: parseAddresses(form.value.to),
      cc: form.value.cc ? parseAddresses(form.value.cc) : undefined,
      subject: form.value.subject,
      body: form.value.body,
      htmlBody: form.value.body,
      attachments: attachmentBuffers.length > 0 ? attachmentBuffers : undefined,
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
