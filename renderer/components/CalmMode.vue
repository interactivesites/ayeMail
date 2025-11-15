<template>
  <div ref="containerRef" tabindex="0" class="flex flex-col h-full bg-gray-50 calm-mode" @keydown="handleKeyDown" @focus="handleFocus">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 bg-white">
      <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <span>Marco Mail</span>
        <span class="text-sm font-normal text-gray-500">🧠 Calm Mode</span>
      </h2>
    </div>

    <!-- Main 3-column layout -->
    <div class="flex-1 flex overflow-hidden">
      <!-- NOW Column -->
      <div
        ref="nowColumnRef"
        class="flex-1 flex flex-col border-r border-gray-200 bg-white overflow-hidden"
        @drop="handleDrop($event, 'now')"
        @dragover.prevent
        @dragenter.prevent="handleDragEnter('now')"
        @dragleave="handleDragLeave('now')"
        :class="{ 'bg-blue-50': dragOverZone === 'now' }"
      >
        <div class="p-3 border-b border-gray-200 bg-gray-50">
          <h3 class="text-sm font-semibold text-gray-900">NOW</h3>
          <p class="text-xs text-gray-500">Needs action</p>
        </div>
        <div class="flex-1 overflow-y-auto p-3 space-y-3">
          <div v-if="loadingNow" class="text-center text-gray-500 py-8">Loading...</div>
          <div v-else-if="nowEmails.length === 0" class="text-center text-gray-400 py-8 text-sm">
            No emails needing action
          </div>
          <EmailCard
            v-for="email in nowEmails"
            :key="email.id"
            :email="email"
            :is-selected="selectedEmailId === email.id"
            :thread-count="email.threadCount || 1"
            @select="handleEmailSelect"
            @reply="handleReply"
            @archive="handleArchive"
            @snooze="handleSnooze"
            @drag-start="handleCardDragStart"
            @drag-end="handleCardDragEnd"
          />
        </div>
      </div>

      <!-- Current Thread Column -->
      <div class="flex-1 flex flex-col border-r border-gray-200 bg-white overflow-hidden">
        <div class="p-3 border-b border-gray-200 bg-gray-50">
          <h3 class="text-sm font-semibold text-gray-900">CURRENT THREAD</h3>
          <p class="text-xs text-gray-500">Email opened</p>
        </div>
        <div class="flex-1 overflow-y-auto">
          <EmailViewer v-if="selectedEmailId" :email-id="selectedEmailId" @reply="handleReply" @forward="handleForward" @set-reminder="handleSetReminder" @delete="handleDeleteEmail" />
          <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">
            Select an email to view
          </div>
        </div>
      </div>

      <!-- LATER Column -->
      <div
        ref="laterColumnRef"
        class="flex-1 flex flex-col bg-white overflow-hidden"
        @drop="handleDrop($event, 'later')"
        @dragover.prevent
        @dragenter.prevent="handleDragEnter('later')"
        @dragleave="handleDragLeave('later')"
        :class="{ 'bg-blue-50': dragOverZone === 'later' }"
      >
        <div class="p-3 border-b border-gray-200 bg-gray-50">
          <h3 class="text-sm font-semibold text-gray-900">LATER</h3>
          <p class="text-xs text-gray-500">Snoozed</p>
        </div>
        <div class="flex-1 overflow-y-auto p-3 space-y-3">
          <div v-if="loadingLater" class="text-center text-gray-500 py-8">Loading...</div>
          <div v-else-if="laterEmails.length === 0" class="text-center text-gray-400 py-8 text-sm">
            No snoozed emails
          </div>
          <EmailCard
            v-for="email in laterEmails"
            :key="email.id"
            :email="email"
            :is-selected="selectedEmailId === email.id"
            :thread-count="email.threadCount || 1"
            @select="handleEmailSelect"
            @reply="handleReply"
            @archive="handleArchive"
            @snooze="handleSnooze"
            @drag-start="handleCardDragStart"
            @drag-end="handleCardDragEnd"
          />
        </div>
      </div>
    </div>

    <!-- Reference and Noise sections (collapsed by default) -->
    <div class="border-t border-gray-200 bg-white">
      <!-- Reference Section -->
      <div class="border-b border-gray-100">
        <button
          @click="referenceExpanded = !referenceExpanded"
          class="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div class="text-left">
            <h3 class="text-sm font-semibold text-gray-900">REFERENCE</h3>
            <p class="text-xs text-gray-500">Read, receipts, FYI, newsletters</p>
          </div>
          <svg
            class="w-5 h-5 text-gray-400 transition-transform"
            :class="{ 'rotate-180': referenceExpanded }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div
          ref="referenceSectionRef"
          class="overflow-hidden"
          :class="{ 'max-h-0': !referenceExpanded, 'max-h-96': referenceExpanded }"
        >
          <div
            ref="referenceColumnRef"
            class="p-3 border-t border-gray-100"
            @drop="handleDrop($event, 'reference')"
            @dragover.prevent
            @dragenter.prevent="handleDragEnter('reference')"
            @dragleave="handleDragLeave('reference')"
            :class="{ 'bg-blue-50': dragOverZone === 'reference' }"
          >
            <div v-if="loadingReference" class="text-center text-gray-500 py-4">Loading...</div>
            <div v-else-if="referenceEmails.length === 0" class="text-center text-gray-400 py-4 text-sm">
              No reference emails
            </div>
            <div v-else class="grid grid-cols-2 gap-2">
              <EmailCard
                v-for="email in referenceEmails"
                :key="email.id"
                :email="email"
                :is-selected="selectedEmailId === email.id"
                :thread-count="email.threadCount || 1"
                @select="handleEmailSelect"
                @reply="handleReply"
                @archive="handleArchive"
                @snooze="handleSnooze"
                @drag-start="handleCardDragStart"
                @drag-end="handleCardDragEnd"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Noise Section -->
      <div>
        <button
          @click="noiseExpanded = !noiseExpanded"
          class="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div class="text-left">
            <h3 class="text-sm font-semibold text-gray-500">NOISE</h3>
            <p class="text-xs text-gray-400">Spam, auto-filtered newsletters</p>
          </div>
          <svg
            class="w-5 h-5 text-gray-400 transition-transform"
            :class="{ 'rotate-180': noiseExpanded }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div
          ref="noiseSectionRef"
          class="overflow-hidden"
          :class="{ 'max-h-0': !noiseExpanded, 'max-h-96': noiseExpanded }"
        >
          <div
            ref="noiseColumnRef"
            class="p-3 border-t border-gray-100"
            @drop="handleDrop($event, 'noise')"
            @dragover.prevent
            @dragenter.prevent="handleDragEnter('noise')"
            @dragleave="handleDragLeave('noise')"
            :class="{ 'bg-blue-50': dragOverZone === 'noise' }"
          >
            <div v-if="loadingNoise" class="text-center text-gray-500 py-4">Loading...</div>
            <div v-else-if="noiseEmails.length === 0" class="text-center text-gray-400 py-4 text-sm">
              No noise emails
            </div>
            <div v-else class="grid grid-cols-2 gap-2 opacity-60">
              <EmailCard
                v-for="email in noiseEmails"
                :key="email.id"
                :email="email"
                :is-selected="selectedEmailId === email.id"
                :thread-count="email.threadCount || 1"
                @select="handleEmailSelect"
                @reply="handleReply"
                @archive="handleArchive"
                @snooze="handleSnooze"
                @drag-start="handleCardDragStart"
                @drag-end="handleCardDragEnd"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reminder Modal -->
    <ReminderModal
      v-if="showReminderModal && reminderEmail"
      :email-id="reminderEmail.id"
      :account-id="reminderEmail.accountId"
      @close="showReminderModal = false; reminderEmail = null"
      @saved="handleReminderSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, nextTick } from 'vue'
import EmailCard from './EmailCard.vue'
import EmailViewer from './EmailViewer.vue'
import ReminderModal from './ReminderModal.vue'
import { animateSectionExpand, animateSectionCollapse } from '../utils/animations'

const props = defineProps<{
  accountId: string
  selectedEmailId?: string
}>()

const emit = defineEmits<{
  'select-email': [id: string]
}>()

const containerRef = ref<HTMLElement | null>(null)
const nowColumnRef = ref<HTMLElement | null>(null)
const laterColumnRef = ref<HTMLElement | null>(null)
const referenceColumnRef = ref<HTMLElement | null>(null)
const noiseColumnRef = ref<HTMLElement | null>(null)
const referenceSectionRef = ref<HTMLElement | null>(null)
const noiseSectionRef = ref<HTMLElement | null>(null)

const selectedEmailId = ref<string>(props.selectedEmailId || '')
const nowEmails = ref<any[]>([])
const laterEmails = ref<any[]>([])
const referenceEmails = ref<any[]>([])
const noiseEmails = ref<any[]>([])

const loadingNow = ref(false)
const loadingLater = ref(false)
const loadingReference = ref(false)
const loadingNoise = ref(false)

const referenceExpanded = ref(false)
const noiseExpanded = ref(false)

const dragOverZone = ref<string | null>(null)
const draggedEmailId = ref<string | null>(null)

const showReminderModal = ref(false)
const reminderEmail = ref<{ id: string; accountId: string } | null>(null)

const loadEmailsByStatus = async (status: 'now' | 'later' | 'reference' | 'noise', loadingRef: any, emailsRef: any) => {
  loadingRef.value = true
  try {
    emailsRef.value = await window.electronAPI.emails.getByStatus(props.accountId, status, 50)
  } catch (error) {
    console.error(`Error loading ${status} emails:`, error)
  } finally {
    loadingRef.value = false
  }
}

const loadAllEmails = async () => {
  // Load status-based emails
  await Promise.all([
    loadEmailsByStatus('later', loadingLater, laterEmails),
    loadEmailsByStatus('reference', loadingReference, referenceEmails),
    loadEmailsByStatus('noise', loadingNoise, noiseEmails)
  ])
  
  // Load NOW emails (status = 'now') and uncategorized emails
  loadingNow.value = true
  try {
    const [nowStatusEmails, uncategorizedEmails] = await Promise.all([
      window.electronAPI.emails.getByStatus(props.accountId, 'now', 50),
      window.electronAPI.emails.getUncategorized(props.accountId, 50)
    ])
    // Merge: show both 'now' status emails and uncategorized emails in NOW column
    nowEmails.value = [...nowStatusEmails, ...uncategorizedEmails]
  } catch (error) {
    console.error('Error loading NOW emails:', error)
  } finally {
    loadingNow.value = false
  }
}

const handleEmailSelect = (emailId: string) => {
  selectedEmailId.value = emailId
  emit('select-email', emailId)
}

const handleDrop = async (event: DragEvent, targetStatus: 'now' | 'later' | 'reference' | 'noise') => {
  event.preventDefault()
  dragOverZone.value = null
  
  const emailId = event.dataTransfer?.getData('email-id') || draggedEmailId.value
  if (!emailId) return

  try {
    await window.electronAPI.emails.setStatus(emailId, targetStatus)
    await loadAllEmails()
    
    // If email was selected, keep it selected
    if (selectedEmailId.value === emailId) {
      // Email still exists, just status changed
    }
  } catch (error) {
    console.error('Error setting email status:', error)
  }
}

const handleDragEnter = (zone: string) => {
  dragOverZone.value = zone
}

const handleDragLeave = (zone: string) => {
  // Only clear if we're actually leaving (not just moving to child element)
  setTimeout(() => {
    if (dragOverZone.value === zone) {
      dragOverZone.value = null
    }
  }, 100)
}

const handleCardDragStart = (event: DragEvent, email: any) => {
  draggedEmailId.value = email.id
}

const handleCardDragEnd = () => {
  draggedEmailId.value = null
  dragOverZone.value = null
}

const handleReply = (email: any) => {
  if (!email || !email.accountId) return
  ;(window.electronAPI as any).window.compose.create(email.accountId, { emailId: email.id, forward: false })
}

const handleForward = (email: any) => {
  if (!email || !email.accountId) return
  ;(window.electronAPI as any).window.compose.create(email.accountId, { emailId: email.id, forward: true })
}

const handleArchive = async (email: any) => {
  if (!email) return
  try {
    await window.electronAPI.emails.setStatus(email.id, 'archived')
    await loadAllEmails()
    if (selectedEmailId.value === email.id) {
      selectedEmailId.value = ''
      emit('select-email', '')
    }
  } catch (error) {
    console.error('Error archiving email:', error)
  }
}

const handleSnooze = (email: any) => {
  if (!email || !email.accountId) return
  reminderEmail.value = { id: email.id, accountId: email.accountId }
  showReminderModal.value = true
}

const handleSetReminder = (email: any) => {
  if (!email || !email.accountId) return
  reminderEmail.value = { id: email.id, accountId: email.accountId }
  showReminderModal.value = true
}

const handleDeleteEmail = async (email: any) => {
  if (!email) return
  try {
    await window.electronAPI.emails.delete(email.id)
    await loadAllEmails()
    if (selectedEmailId.value === email.id) {
      selectedEmailId.value = ''
      emit('select-email', '')
    }
  } catch (error) {
    console.error('Error deleting email:', error)
  }
}

const handleReminderSaved = async () => {
  showReminderModal.value = false
  reminderEmail.value = null
  // Move email to 'later' status when reminder is set
  await loadAllEmails()
}

const handleKeyDown = (event: KeyboardEvent) => {
  // Don't handle shortcuts when typing in inputs/textareas
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

  if (!selectedEmailId.value) return

  switch (event.key) {
    case ' ':
      event.preventDefault()
      // Mark done (move to reference)
      handleArchive({ id: selectedEmailId.value })
      break
    case 'd':
    case 'D':
      event.preventDefault()
      // Snooze/remind later
      const laterEmail = [...nowEmails.value, ...laterEmails.value, ...referenceEmails.value, ...noiseEmails.value]
        .find(e => e.id === selectedEmailId.value)
      if (laterEmail) {
        handleSnooze(laterEmail)
      }
      break
    case 'a':
    case 'A':
      event.preventDefault()
      // Archive
      handleArchive({ id: selectedEmailId.value })
      break
    case 'u':
    case 'U':
      event.preventDefault()
      // Unsubscribe/filter (move to noise)
      window.electronAPI.emails.setStatus(selectedEmailId.value, 'noise')
        .then(() => loadAllEmails())
      break
    case 'ArrowUp':
    case 'ArrowDown':
      // Navigation handled by parent
      break
  }
}

const handleFocus = () => {
  containerRef.value?.focus()
}

watch(() => referenceExpanded.value, (expanded) => {
  nextTick(() => {
    if (referenceSectionRef.value) {
      if (expanded) {
        animateSectionExpand(referenceSectionRef.value)
      } else {
        animateSectionCollapse(referenceSectionRef.value)
      }
    }
  })
})

watch(() => noiseExpanded.value, (expanded) => {
  nextTick(() => {
    if (noiseSectionRef.value) {
      if (expanded) {
        animateSectionExpand(noiseSectionRef.value)
      } else {
        animateSectionCollapse(noiseSectionRef.value)
      }
    }
  })
})

watch(() => props.selectedEmailId, (newId) => {
  selectedEmailId.value = newId || ''
})

watch(() => props.accountId, () => {
  loadAllEmails()
})

const refreshEmails = () => {
  loadAllEmails()
}

onMounted(() => {
  loadAllEmails()
  window.addEventListener('refresh-emails', refreshEmails)
  nextTick(() => {
    containerRef.value?.focus()
  })
})

onUnmounted(() => {
  window.removeEventListener('refresh-emails', refreshEmails)
})
</script>

