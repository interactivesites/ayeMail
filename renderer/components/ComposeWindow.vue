<template>
  <div class="h-screen flex flex-col bg-white dark:bg-gray-900 relative">
    <!-- Custom Title Bar -->
    <div class="app-drag-region bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border-b border-white/60 dark:border-gray-700 shadow-sm flex items-center justify-between px-4 py-2 h-12">
      <div class="app-no-drag flex items-center space-x-3 flex-1 min-w-0">
       
        <button
          @click="sendEmail"
          :disabled="sending || !form.to?.trim()"
          class="p-2 rounded-md hover:text-primary-700 hover:-rotate-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors transition-transform"
          :title="sending ? 'Sending...' : (!form.to?.trim() ? 'Please enter a recipient' : 'Send')"
        >
          <PaperAirplaneIcon class="w-5 h-5 text-primary-600" />
        </button>
        <!-- <img src="../../assets/ilogo.png" alt="iMail" class="w-6 h-6 rounded-lg flex-shrink-0" /> -->
        <h2 class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate min-w-0 flex-1" :title="displayTitle">{{ displayTitle }}</h2>
        <div class="border-l border-gray-300 dark:border-gray-600 h-4 mx-4 flex-shrink-0"></div>
        <div class="flex items-center space-x-2">
          <label class="text-xs text-gray-600 dark:text-gray-300">From:</label>
          <select
            v-model="selectedAccountId"
            @change="handleAccountChange"
            class="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-600 focus:border-primary-600"
          >
            <option v-for="account in accounts" :key="account.id" :value="account.id">
              {{ account.name || account.email }}
            </option>
          </select>
        </div>
        <div class="border-l border-gray-300 dark:border-gray-600 h-4 mx-4 flex-shrink-0"></div>
        <label class="flex items-center space-x-1.5 cursor-pointer">
          <input
            v-model="form.encrypt"
            type="checkbox"
            class="toggle-sm"
          />
          <span class="text-xs text-gray-700 dark:text-gray-300">Encrypt</span>
        </label>
        <label class="flex items-center space-x-1.5 cursor-pointer">
          <input
            v-model="form.sign"
            type="checkbox"
            class="toggle-sm"
          />
          <span class="text-xs text-gray-700 dark:text-gray-300">Sign</span>
        </label>
      </div>
      <div class="app-no-drag flex items-center space-x-1">
        <button
          @click="fileInput?.click()"
          class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Attach Files"
        >
          <svg class="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <button
          @click="handleMinimize"
          class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Minimize"
        >
          <MinusIcon class="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
        <button
          @click="handleMaximize"
          class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Maximize"
        >
          <ArrowsPointingOutIcon class="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
        <button
          @click="handleClose"
          class="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          title="Close"
        >
          <XMarkIcon class="w-4 h-4 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400" />
        </button>
      </div>
    </div>

    <!-- Compose Form -->
    <div 
      class="flex-1 flex flex-col overflow-hidden"
      :class="{ 'border-2 border-dashed border-primary-400 dark:border-primary-500 bg-primary-50/30 dark:bg-primary-900/20': isDragging }"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <RecipientAutocomplete
            v-model="form.to"
            placeholder="To"
          />
        </div>
        <div>
          <input
            v-model="form.cc"
            type="text"
            class="w-full px-3 py-2 bg-transparent dark:bg-transparent border-0 border-b border-gray-300 dark:border-gray-600 rounded-none focus:outline-none focus:ring-0 focus:border-primary-600 dark:focus:border-primary-500 transition-colors dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="CC"
          />
        </div>
        <div>
          <input
            v-model="form.subject"
            type="text"
            class="w-full px-3 py-2 bg-transparent dark:bg-transparent border-0 border-b border-gray-300 dark:border-gray-600 rounded-none focus:outline-none focus:ring-0 focus:border-primary-600 dark:focus:border-primary-500 transition-colors dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Subject"
          />
        </div>
        <div>
          <div class=" rounded-md overflow-hidden focus-within:ring-0 relative">
            <EditorContent :editor="editor" class="prose max-w-none" />
            <BubbleMenu
              v-if="editor"
              :editor="editor"
              :tippy-options="{ duration: 100, placement: 'top' }"
              class="bubble-menu"
            >
              <div class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-1 flex items-center space-x-1">
                <button
                  @click="editor.chain().focus().toggleBold().run()"
                  :class="[
                    'p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-bold dark:text-gray-100',
                    editor.isActive('bold') ? 'bg-gray-300 dark:bg-gray-600' : ''
                  ]"
                  title="Bold"
                >
                  <span class="text-xs">B</span>
                </button>
                <button
                  @click="editor.chain().focus().toggleItalic().run()"
                  :class="[
                    'p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors italic dark:text-gray-100',
                    editor.isActive('italic') ? 'bg-gray-300 dark:bg-gray-600' : ''
                  ]"
                  title="Italic"
                >
                  <span class="text-xs">I</span>
                </button>
                <button
                  @click="editor.chain().focus().toggleStrike().run()"
                  :class="[
                    'p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors line-through dark:text-gray-100',
                    editor.isActive('strike') ? 'bg-gray-300 dark:bg-gray-600' : ''
                  ]"
                  title="Strikethrough"
                >
                  <span class="text-xs">S</span>
                </button>
                <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                <button
                  @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
                  :class="[
                    'p-1.5 rounded hover:bg-gray-200 transition-colors',
                    editor.isActive('heading', { level: 1 }) ? 'bg-gray-300' : ''
                  ]"
                  title="Heading 1"
                >
                  <span class="text-xs font-bold">H1</span>
                </button>
                <button
                  @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
                  :class="[
                    'p-1.5 rounded hover:bg-gray-200 transition-colors',
                    editor.isActive('heading', { level: 2 }) ? 'bg-gray-300' : ''
                  ]"
                  title="Heading 2"
                >
                  <span class="text-xs font-bold">H2</span>
                </button>
                <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                <button
                  @click="editor.chain().focus().toggleBulletList().run()"
                  :class="[
                    'p-1.5 rounded hover:bg-gray-200 transition-colors',
                    editor.isActive('bulletList') ? 'bg-gray-300' : ''
                  ]"
                  title="Bullet List"
                >
                  <ListBulletIcon class="w-4 h-4" />
                </button>
                <button
                  @click="editor.chain().focus().toggleOrderedList().run()"
                  :class="[
                    'p-1.5 rounded hover:bg-gray-200 transition-colors',
                    editor.isActive('orderedList') ? 'bg-gray-300' : ''
                  ]"
                  title="Numbered List"
                >
                  <span class="text-xs">1.</span>
                </button>
                <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                <button
                  @click="editor.chain().focus().toggleBlockquote().run()"
                  :class="[
                    'p-1.5 rounded hover:bg-gray-200 transition-colors',
                    editor.isActive('blockquote') ? 'bg-gray-300' : ''
                  ]"
                  title="Quote"
                >
                  <span class="text-xs">"</span>
                </button>
              </div>
            </BubbleMenu>
          </div>
        </div>
        <input
          ref="fileInput"
          type="file"
          multiple
          @change="handleFileSelect"
          class="hidden"
        />
        <div v-if="attachments.length > 0" class="flex items-center border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <span class="text-sm text-gray-600 dark:text-gray-300">
            {{ attachments.length }} file{{ attachments.length > 1 ? 's' : '' }} attached ({{ formatTotalSize() }})
          </span>
        </div>
        <div v-if="attachments.length > 0" class="space-y-2">
          <div
            v-for="(attachment, index) in attachments"
            :key="index"
            class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
            :class="{ 'border-2 border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20': attachment.size > MAX_FILE_SIZE }"
          >
            <div class="flex items-center space-x-2 flex-1 min-w-0">
              <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <div class="flex-1 min-w-0">
                <span class="text-sm text-gray-700 dark:text-gray-300 block truncate">{{ attachment.name }}</span>
                <span class="text-xs" :class="attachment.size > MAX_FILE_SIZE ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'">
                  {{ formatSize(attachment.size) }}
                  <span v-if="attachment.size > MAX_FILE_SIZE"> (exceeds 15MB limit)</span>
                </span>
              </div>
            </div>
            <button
              @click="removeAttachment(index)"
              class="ml-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Remove attachment"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, onUnmounted, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { formatSize } from '../utils/formatters'
import RecipientAutocomplete from './RecipientAutocomplete.vue'
import {
  ArrowsPointingOutIcon,
  XMarkIcon,
  ListBulletIcon,
  PaperAirplaneIcon,
  MinusIcon
} from '@heroicons/vue/24/outline'

const props = defineProps<{
  accountId: string
  replyTo?: any
}>()

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
  to: '',
  cc: '',
  subject: '',
  encrypt: false,
  sign: false
})

// Update form when replyTo becomes available
const updateFormFromReplyTo = (replyTo: any) => {
  if (!replyTo) return
  
  if (!replyTo.forward && replyTo.from && replyTo.from.length > 0) {
    form.value.to = replyTo.from.map(formatAddressForTo).join(', ')
  } else if (replyTo.to && replyTo.to.length > 0 && !replyTo.subject) {
    form.value.to = replyTo.to.map(formatAddressForTo).join(', ')
  }
  
  if (replyTo.forward) {
    form.value.subject = `Fwd: ${replyTo.subject || ''}`
  } else if (replyTo.subject) {
    form.value.subject = `Re: ${replyTo.subject || ''}`
  }
}

// Initialize form if replyTo is already available
if (props.replyTo) {
  updateFormFromReplyTo(props.replyTo)
}

// Watch for changes in replyTo
watch(() => props.replyTo, (newReplyTo) => {
  if (newReplyTo) {
    updateFormFromReplyTo(newReplyTo)
    updateEditorContent(newReplyTo)
  }
}, { immediate: true })

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB

// Strip images from HTML content to prevent re-attaching them in replies
const stripImagesFromHtml = (html: string): string => {
  if (!html) return html
  // Remove img tags (both with data URLs and CID references)
  return html.replace(/<img[^>]*>/gi, '')
}

// Get HTML content from email, preferring htmlBody, then converting textBody to HTML, then body
const getEmailHtmlContent = (email: any): string => {
  if (!email) return ''
  if (email.htmlBody) return email.htmlBody
  if (email.textBody) return email.textBody.replace(/\n/g, '<br>')
  if (email.body) return email.body
  return ''
}

// Update editor content when replyTo becomes available
const updateEditorContent = (replyTo: any) => {
  if (!replyTo || !editor.value) return
  
  const content = replyTo.forward 
    ? `<p><br></p><p>---------- Forwarded message ----------</p><p>From: ${replyTo.from?.[0]?.address || ''}</p><p>Date: ${new Date(replyTo.date).toLocaleString()}</p><p>Subject: ${replyTo.subject || ''}</p><p><br></p>${stripImagesFromHtml(getEmailHtmlContent(replyTo))}`
    : `<p><br></p><p>--- Original Message ---</p>${stripImagesFromHtml(getEmailHtmlContent(replyTo))}`
  
  editor.value.commands.setContent(content)
}

const editor = useEditor({
  extensions: [
    StarterKit,
    Image.configure({
      inline: true,
      allowBase64: true
    })
  ],
  content: '',
  editorProps: {
    attributes: {
      class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[300px] p-4',
      'data-placeholder': 'Start typing your email...'
    },
    // Handle file drops - insert images inline, add others as attachments
    handleDrop: (_view, event, _slice, _moved) => {
      if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
        const files = Array.from(event.dataTransfer.files)
        const imageFiles = files.filter(file => file.type.startsWith('image/'))
        const otherFiles = files.filter(file => !file.type.startsWith('image/'))
        
        // Insert images inline into editor
        if (imageFiles.length > 0 && editor.value) {
          imageFiles.forEach(file => {
            const reader = new FileReader()
            reader.onload = () => {
              const dataUrl = reader.result as string
              editor.value?.chain().focus().setImage({ src: dataUrl }).run()
            }
            reader.readAsDataURL(file)
          })
        }
        
        // Add other files as attachments
        if (otherFiles.length > 0) {
          addFiles(otherFiles)
        }
        
        return true // Handled
      }
      return false // Use default behavior
    }
  }
})

const fileInput = ref<HTMLInputElement | null>(null)
const attachments = ref<Array<{ name: string; size: number; file: File }>>([])
const isDragging = ref(false)
const windowId = ref<number | null>(null)

const accounts = ref<any[]>([])
const selectedAccountId = ref<string>(props.accountId)
const signatures = ref<any[]>([])
const defaultSignature = ref<any>(null)

// Parse recipient name from To field
const getRecipientName = (toField: string): string => {
  if (!toField || !toField.trim()) return ''
  
  // Parse first recipient
  const firstRecipient = toField.split(',')[0].trim()
  
  // Try to extract name from "Name <email@example.com>" format
  const nameMatch = firstRecipient.match(/^(.+?)\s*<(.+?)>$/)
  if (nameMatch && nameMatch[1]) {
    return nameMatch[1].trim()
  }
  
  // If no name, return email address (or empty if invalid)
  const emailMatch = firstRecipient.match(/^(.+?@.+?)$/)
  if (emailMatch) {
    return emailMatch[1].trim()
  }
  
  return firstRecipient
}

// Computed title for display in title bar
const displayTitle = computed(() => {
  const recipient = getRecipientName(form.value.to)
  const subject = form.value.subject?.trim() || ''
  
  if (recipient) {
    if (subject) {
      return `${recipient} - ${subject}`
    }
    return recipient
  } else if (subject) {
    return `Compose Email - ${subject}`
  }
  
  return 'Compose Email'
})

// Update window title based on recipient and subject
const updateWindowTitle = () => {
  if (!windowId.value) return
  ;(window.electronAPI as any).window?.setTitle?.(windowId.value, displayTitle.value)
}

// Watch form fields to update title
watch(() => form.value.to, () => {
  updateWindowTitle()
})

watch(() => form.value.subject, () => {
  updateWindowTitle()
})

// Prevent browser default file drag behavior at document level
const preventDocumentDragOver = (e: DragEvent) => {
  if (e.dataTransfer?.types.some(type => type === 'Files' || type === 'application/x-moz-file')) {
    e.preventDefault()
    e.stopPropagation()
  }
}

const preventDocumentDrop = (e: DragEvent) => {
  if (e.dataTransfer?.types.some(type => type === 'Files' || type === 'application/x-moz-file')) {
    const target = e.target as HTMLElement
    if (!target.closest('.flex-1.flex.flex-col')) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
  }
}

// Load accounts and signatures for an account
const loadAccountSignatures = async (accountId: string) => {
  if (!accountId) return
  try {
    signatures.value = await window.electronAPI.signatures.list(accountId)
    defaultSignature.value = signatures.value.find(s => s.is_default)
  } catch (error) {
    console.error('Error loading signatures:', error)
    signatures.value = []
    defaultSignature.value = null
  }
}

// Append signature to editor
const appendSignature = () => {
  if (!defaultSignature.value || !editor.value || props.replyTo) return
  
  const signatureHtml = defaultSignature.value.html || `<p>${defaultSignature.value.text}</p>`
  const currentContent = editor.value.getHTML()
  
  // Check if signature is already in the content (simple check)
  if (currentContent.includes(signatureHtml)) return
  
  // Append signature at the end using TipTap's insertContent
  if (currentContent.trim()) {
    // Move cursor to end and insert signature
    editor.value.chain().focus().setTextSelection(editor.value.state.doc.content.size).insertContent(signatureHtml).run()
  } else {
    // If editor is empty, just set the signature
    editor.value.chain().focus().setContent(signatureHtml, false).run()
  }
}

// Handle account change
const handleAccountChange = async () => {
  await loadAccountSignatures(selectedAccountId.value)
  appendSignature()
}

onMounted(async () => {
  // Add document-level handlers to prevent browser/Electron from opening files
  document.addEventListener('dragover', preventDocumentDragOver, true)
  document.addEventListener('drop', preventDocumentDrop, true)
  
  // Get window ID for title updates
  try {
    windowId.value = await (window.electronAPI as any).window?.getId?.() || null
  } catch (error) {
    console.error('Error getting window ID:', error)
  }
  
  // Load all accounts
  try {
    accounts.value = await window.electronAPI.accounts.list()
    if (!selectedAccountId.value && accounts.value.length > 0) {
      selectedAccountId.value = accounts.value[0].id
    }
  } catch (error) {
    console.error('Error loading accounts:', error)
  }
  
  // Initialize editor content if replyTo is already available
  if (props.replyTo && editor.value) {
    updateEditorContent(props.replyTo)
  }
  
  // Load signatures for initial account
  await loadAccountSignatures(selectedAccountId.value)
  
  // Append signature if not replying
  if (!props.replyTo) {
    // Wait a bit for editor to be fully initialized
    setTimeout(() => {
      appendSignature()
    }, 100)
  }
  
  // Initial title update
  updateWindowTitle()
})

onUnmounted(() => {
  document.removeEventListener('dragover', preventDocumentDragOver, true)
  document.removeEventListener('drop', preventDocumentDrop, true)
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

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

const sending = ref(false)

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    const fileArray = Array.from(target.files)
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'))
    const otherFiles = fileArray.filter(file => !file.type.startsWith('image/'))
    
    // Insert images inline into editor
    if (imageFiles.length > 0 && editor.value) {
      imageFiles.forEach(file => {
        if (file.size > MAX_FILE_SIZE) {
          alert(`Image ${file.name} exceeds 15MB limit and was not inserted.`)
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          editor.value?.chain().focus().setImage({ src: dataUrl }).run()
        }
        reader.readAsDataURL(file)
      })
    }
    
    // Add non-image files as attachments
    if (otherFiles.length > 0) {
      addFiles(otherFiles)
    }
    
    // If images were added as attachments (fallback), add them too
    if (imageFiles.length > 0 && !editor.value) {
      addFiles(imageFiles)
    }
  }
  if (target) {
    target.value = ''
  }
}

const handleDragEnter = (event: DragEvent) => {
  const hasFiles = event.dataTransfer?.types.some(type => type === 'Files' || type === 'application/x-moz-file')
  if (hasFiles) {
    event.preventDefault()
    event.stopPropagation()
    isDragging.value = true
  }
}

const handleDragOver = (event: DragEvent) => {
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
  if (event.dataTransfer?.types.includes('Files')) {
    event.preventDefault()
    event.stopPropagation()
    const currentTarget = event.currentTarget as HTMLElement
    const relatedTarget = event.relatedTarget as Node | null
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      isDragging.value = false
    }
  }
}

const handleDrop = (event: DragEvent) => {
  // Check if this was already handled by TipTap's handleDrop
  const target = event.target as HTMLElement
  const isEditorArea = target.closest('.ProseMirror') || target.closest('[contenteditable]')
  
  // If dropped on editor, TipTap's handleDrop will handle it, so don't process here
  if (isEditorArea) {
    isDragging.value = false
    return false
  }
  
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  
  isDragging.value = false
  
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const fileArray = Array.from(files)
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'))
    const otherFiles = fileArray.filter(file => !file.type.startsWith('image/'))
    
    // If dropped outside editor, add images as attachments (not inline)
    if (imageFiles.length > 0) {
      addFiles(imageFiles)
    }
    
    // Add non-image files as attachments
    if (otherFiles.length > 0) {
      addFiles(otherFiles)
    }
  }
  
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

const fileToArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer)
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

const sendEmail = async () => {
  if (!form.value.to) {
    alert('Please enter a recipient')
    return
  }

  if (!editor.value) {
    alert('Editor not initialized')
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
    let htmlBody = editor.value.getHTML()
    const textBody = editor.value.getText()

    // Extract inline images from HTML and convert to attachments
    const imageAttachments: Array<{ filename: string; content: number[]; contentType: string; cid?: string }> = []
    const imageRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"/g
    let match
    let imageIndex = 0
    const replacements: Array<{ original: string; replacement: string }> = []
    
    while ((match = imageRegex.exec(htmlBody)) !== null) {
      const contentType = `image/${match[1]}`
      const base64Data = match[2]
      
      // Convert base64 to array
      const binaryString = atob(base64Data)
      const bytes = Array.from(binaryString, char => char.charCodeAt(0))
      
      const imageNum = ++imageIndex
      const filename = `image-${imageNum}.${match[1]}`
      const contentId = `image-${imageNum}`
      
      imageAttachments.push({
        filename: filename,
        content: bytes,
        contentType: contentType,
        cid: contentId // Add CID for inline attachment
      })
      
      // Store replacement - replace only the src attribute, preserve other attributes
      const srcMatch = match[0].match(/src="([^"]+)"/)
      if (srcMatch) {
        replacements.push({
          original: srcMatch[0],
          replacement: `src="cid:${contentId}"`
        })
      }
    }
    
    // Apply replacements in reverse order to avoid index shifting
    replacements.reverse().forEach(({ original, replacement }) => {
      htmlBody = htmlBody.replace(original, replacement)
    })

    // Convert File objects to ArrayBuffer format (will be converted to Buffer in main process)
    const fileAttachments = await Promise.all(
      attachments.value.map(async (att) => ({
        filename: att.name,
        content: Array.from(new Uint8Array(await fileToArrayBuffer(att.file))),
        contentType: att.file.type || 'application/octet-stream'
      }))
    )
    
    // Combine inline images and file attachments
    const attachmentBuffers = [...imageAttachments, ...fileAttachments]

    const result = await window.electronAPI.emails.send({
      accountId: selectedAccountId.value,
      to: parseAddresses(form.value.to),
      cc: form.value.cc ? parseAddresses(form.value.cc) : undefined,
      subject: form.value.subject,
      body: textBody,
      htmlBody: htmlBody,
      attachments: attachmentBuffers.length > 0 ? attachmentBuffers : undefined,
      encrypt: form.value.encrypt,
      sign: form.value.sign
    })

    if (result.success) {
      handleClose()
    } else {
      alert(`Failed to send email: ${result.message || result.error}`)
    }
  } catch (error: any) {
    alert(`Error sending email: ${error.message}`)
  } finally {
    sending.value = false
  }
}

const handleMinimize = () => {
  if (windowId.value !== null) {
    ;(window.electronAPI as any).window?.minimize?.(windowId.value.toString())
  } else {
    ;(window.electronAPI as any).window?.minimize?.()
  }
}

const handleMaximize = () => {
  if (windowId.value !== null) {
    ;(window.electronAPI as any).window?.maximize?.(windowId.value.toString())
  } else {
    ;(window.electronAPI as any).window?.maximize?.()
  }
}

const handleClose = () => {
  if (windowId.value !== null) {
    ;(window.electronAPI as any).window?.compose?.close?.(windowId.value)
  } else {
    ;(window.electronAPI as any).window?.close?.()
  }
}
</script>

<style>
.ProseMirror {
  outline: none;
  min-height: 300px;
  padding: 1rem;
  
}

.ProseMirror p.is-editor-empty:first-child::before {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  
}

.ProseMirror p {
  margin: 0.5rem 0;
}

.ProseMirror h1 {
  font-size: 2em;
  font-weight: bold;
  margin: 0.67em 0;
}

.ProseMirror h2 {
  font-size: 1.5em;
  font-weight: bold;
  margin: 0.75em 0;
}

.ProseMirror ul, .ProseMirror ol {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.ProseMirror blockquote {
  border-left: 3px solid #e5e7eb;
  padding-left: 1em;
  margin: 0.5em 0;
  font-style: italic;
}

.bubble-menu {
  z-index: 50;
}
</style>

