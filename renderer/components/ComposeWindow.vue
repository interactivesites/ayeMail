<template>
  <div class="h-screen flex flex-col bg-white">
    <!-- Custom Title Bar -->
    <div class="app-drag-region bg-white/70 backdrop-blur-xl border-b border-white/60 shadow-sm flex items-center justify-between px-4 py-2 h-12">
      <div class="flex items-center space-x-2">
        <img src="../../assets/ilogo.png" alt="iMail" class="w-6 h-6 rounded-lg" />
        <h2 class="text-sm font-medium text-gray-900">Compose Email</h2>
      </div>
      <div class="app-no-drag flex items-center space-x-1">
        <button
          @click="handleMinimize"
          class="p-1.5 rounded hover:bg-gray-200 transition-colors"
          title="Minimize"
        >
          <MinusIcon class="w-4 h-4 text-gray-600" />
        </button>
        <button
          @click="handleMaximize"
          class="p-1.5 rounded hover:bg-gray-200 transition-colors"
          title="Maximize"
        >
          <ArrowsPointingOutIcon class="w-4 h-4 text-gray-600" />
        </button>
        <button
          @click="handleClose"
          class="p-1.5 rounded hover:bg-red-100 transition-colors"
          title="Close"
        >
          <XMarkIcon class="w-4 h-4 text-gray-600 hover:text-red-600" />
        </button>
      </div>
    </div>

    <!-- Compose Form -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
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
          <div class=" rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-primary-600 relative">
            <EditorContent :editor="editor" class="prose max-w-none" />
            <BubbleMenu
              v-if="editor"
              :editor="editor"
              :tippy-options="{ duration: 100, placement: 'top' }"
              class="bubble-menu"
            >
              <div class="bg-white border border-gray-300 rounded-lg shadow-lg p-1 flex items-center space-x-1">
                <button
                  @click="editor.chain().focus().toggleBold().run()"
                  :class="[
                    'p-1.5 rounded hover:bg-gray-200 transition-colors font-bold',
                    editor.isActive('bold') ? 'bg-gray-300' : ''
                  ]"
                  title="Bold"
                >
                  <span class="text-xs">B</span>
                </button>
                <button
                  @click="editor.chain().focus().toggleItalic().run()"
                  :class="[
                    'p-1.5 rounded hover:bg-gray-200 transition-colors italic',
                    editor.isActive('italic') ? 'bg-gray-300' : ''
                  ]"
                  title="Italic"
                >
                  <span class="text-xs">I</span>
                </button>
                <button
                  @click="editor.chain().focus().toggleStrike().run()"
                  :class="[
                    'p-1.5 rounded hover:bg-gray-200 transition-colors line-through',
                    editor.isActive('strike') ? 'bg-gray-300' : ''
                  ]"
                  title="Strikethrough"
                >
                  <span class="text-xs">S</span>
                </button>
                <div class="w-px h-6 bg-gray-300 mx-1"></div>
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
                <div class="w-px h-6 bg-gray-300 mx-1"></div>
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
                <div class="w-px h-6 bg-gray-300 mx-1"></div>
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
        <div class="flex items-center space-x-4">
          <label class="flex items-center">
            <input
              v-model="form.encrypt"
              type="checkbox"
              class="mr-2 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
            />
            <span class="text-sm text-gray-700">Encrypt</span>
          </label>
          <label class="flex items-center">
            <input
              v-model="form.sign"
              type="checkbox"
              class="mr-2 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
            />
            <span class="text-sm text-gray-700">Sign</span>
          </label>
        </div>
      </div>
      <div class="p-4 border-t border-gray-200 flex justify-end space-x-2 bg-white/50">
        <button
          @click="handleClose"
          class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="sendEmail"
          :disabled="sending"
          class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ sending ? 'Sending...' : 'Send' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import StarterKit from '@tiptap/starter-kit'
import {
  ArrowsPointingOutIcon,
  XMarkIcon,
  ListBulletIcon
} from '@heroicons/vue/24/outline'

const props = defineProps<{
  accountId: string
  replyTo?: any
}>()

const form = ref({
  to: '',
  cc: '',
  subject: props.replyTo?.forward ? `Fwd: ${props.replyTo.subject || ''}` : (props.replyTo ? `Re: ${props.replyTo.subject || ''}` : ''),
  encrypt: false,
  sign: false
})

const editor = useEditor({
  extensions: [StarterKit],
  content: props.replyTo?.forward 
    ? `<p><br></p><p>---------- Forwarded message ----------</p><p>From: ${props.replyTo.from?.[0]?.address || ''}</p><p>Date: ${new Date(props.replyTo.date).toLocaleString()}</p><p>Subject: ${props.replyTo.subject || ''}</p><p><br></p>${props.replyTo.htmlBody || props.replyTo.body || ''}`
    : (props.replyTo ? `<p><br></p><p>--- Original Message ---</p>${props.replyTo.htmlBody || props.replyTo.body || ''}` : ''),
  editorProps: {
    attributes: {
      class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[300px] p-4',
      'data-placeholder': 'Start typing your email...'
    }
  }
})

const signatures = ref<any[]>([])
const defaultSignature = ref<any>(null)

onMounted(async () => {
  if (props.accountId) {
    try {
      signatures.value = await window.electronAPI.signatures.list(props.accountId)
      defaultSignature.value = signatures.value.find(s => s.is_default)
      if (defaultSignature.value && !props.replyTo && editor.value) {
        const signatureHtml = defaultSignature.value.html || `<p>${defaultSignature.value.text}</p>`
        const currentContent = editor.value.getHTML()
        editor.value.commands.setContent(currentContent + signatureHtml)
      }
    } catch (error) {
      console.error('Error loading signatures:', error)
    }
  }
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

const sendEmail = async () => {
  if (!form.value.to) {
    alert('Please enter a recipient')
    return
  }

  if (!editor.value) {
    alert('Editor not initialized')
    return
  }

  sending.value = true
  try {
    const htmlBody = editor.value.getHTML()
    const textBody = editor.value.getText()

    const result = await window.electronAPI.emails.send({
      accountId: props.accountId,
      to: parseAddresses(form.value.to),
      cc: form.value.cc ? parseAddresses(form.value.cc) : undefined,
      subject: form.value.subject,
      body: textBody,
      htmlBody: htmlBody,
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
  window.electronAPI.window.minimize()
}

const handleMaximize = () => {
  window.electronAPI.window.maximize()
}

const handleClose = () => {
  window.electronAPI.window.close()
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

