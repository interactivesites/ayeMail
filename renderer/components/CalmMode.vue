<template>
  <div class="relative h-full w-full overflow-hidden flex" ref="containerRef">

    <div class="px-8 py-4">
      <!-- Meta: current folder / mail count -->
      <div class="flex justify-between text-sm opacity-70">
        <span class="mr-8">{{ currentFolderName }}</span>
        <span class="text-3xl" v-if="mails.length > 0">{{ currentIndex + 1 }}/{{ mails.length }}</span>
        <span v-else>0 emails</span>
      </div>
    </div>

    <div ref="mailbox" class="relative w-full max-w-2xl h-full flex items-center" @wheel="handleWheel">
      <div v-for="(mail, index) in mails" :key="mail.id" :ref="el => { mailRefs[index] = el as HTMLElement | null }" class="absolute w-full px-8 cursor-pointer" @click="handleItemClick(index)">
        <div class="dark:text-white">
          <div class="font-medium">{{ mail.subject || '(No subject)' }}</div>
          <div class="flex justify-between text-sm opacity-70 mt-1">
            <span>{{ formatSender(mail.from) }}</span>
            <div class="flex gap-2">
              <span>{{ formatDate(mail.date) }}</span>
              <!-- Loading spinner for current item -->
              <div v-if="index === currentIndex && loadingEmail" class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0 opacity-70"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div ref="mailcontent" class="flex-1 overflow-y-auto p-4">
      <div v-if="loadingEmail" class="flex items-center justify-center h-full">
        <div class="text-gray-500 dark:text-gray-400">Loading email...</div>
      </div>
      <div v-else-if="selectedEmail">
        <div v-if="selectedEmail.htmlBody" class="email-html-container">
          <div v-html="selectedEmail.htmlBody" class="prose dark:prose-invert max-w-none"></div>
        </div>
        <div v-else class="whitespace-pre-wrap text-gray-900 dark:text-gray-100">
          {{ selectedEmail.textBody || selectedEmail.body || 'No content' }}
        </div>
      </div>
      <div v-else class="text-gray-500 dark:text-gray-400 text-center mt-8">
        Click on an email to view its content
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import gsap from 'gsap'
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Email } from '@shared/types'

const containerRef = ref<HTMLDivElement | null>(null)
const mailbox = ref<HTMLDivElement | null>(null)
const mailcontent = ref<HTMLDivElement | null>(null)
const mailRefs = ref<(HTMLElement | null)[]>([])
const mails = ref<Email[]>([])

const currentIndex = ref(0)
const isScrolling = ref(false)
const selectedEmail = ref<any>(null)
const loadingEmail = ref(false)
const currentFolderName = ref<string>('')
let resizeObserver: ResizeObserver | null = null

// Item spacing and sizing constants
const BASE_SCALE = 1
const BASE_FONT_SIZE = 1.5 // rem (text-2xl = 1.5rem)
const SCALE_DECREASE = 0.1
const BLUR_INCREASE = 2
const ITEM_SPACING = 60 // pixels between items
const FIXED_Y_POSITION = 50 // percentage from top where current item stays

const formatSender = (from: any) => {
  if (!from || !Array.isArray(from) || from.length === 0) return 'Unknown'
  const sender = from[0]
  return sender.name || sender.address || 'Unknown'
}

const formatDate = (timestamp: number | string | Date | undefined) => {
  if (!timestamp) return ''

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  // Today - show time
  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Yesterday
  if (days === 1) {
    return 'Yesterday'
  }

  // This week - show day name
  if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }

  // Older - show date
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}


const updateMailPositions = () => {
  if (!mailbox.value || !containerRef.value) return

  const containerHeight = containerRef.value.clientHeight

  mailRefs.value.forEach((el, index) => {
    if (!el) return

    const offset = index - currentIndex.value
    const absOffset = Math.abs(offset)

    // Calculate Y position - current item stays at fixed position, others slide vertically
    const baseY = (FIXED_Y_POSITION / 100) * containerHeight
    const yPosition = baseY + (offset * ITEM_SPACING)

    // Calculate scale (smaller for items further away)
    const scale = Math.max(0.5, BASE_SCALE - (absOffset * SCALE_DECREASE))

    // Calculate blur (more blur for items further away)
    const blur = absOffset * BLUR_INCREASE

    // Calculate opacity (fade out items further away)
    const opacity = Math.max(0.3, 1 - (absOffset * 0.2))

    // Calculate font size
    const fontSize = BASE_FONT_SIZE * scale

    // Set initial transform origin - center so items stay aligned when scaled
    gsap.set(el, {
      transformOrigin: 'center center',
      left: '50%',
      xPercent: -50,
      yPercent: -50
    })

    // Animate position and visual effects
    gsap.to(el, {
      top: `${yPosition}px`,
      scale: scale,
      filter: `blur(${blur}px)`,
      opacity: opacity,
      fontSize: `${fontSize}rem`,
      duration: 0.5,
      ease: 'power2.out'
    })
  })
}

const loadCurrentEmail = async () => {
  if (mails.value.length === 0 || currentIndex.value < 0 || currentIndex.value >= mails.value.length) {
    return
  }

  const mail = mails.value[currentIndex.value]
  if (!mail || !mail.id) {
    return
  }

  loadingEmail.value = true
  try {
    selectedEmail.value = await window.electronAPI.emails.get(mail.id)
  } catch (error) {
    console.error('Error loading email content:', error)
    selectedEmail.value = null
  } finally {
    loadingEmail.value = false
  }
}

// Watch for mail changes to update refs array and positions
watch(() => mails.value.length, async () => {
  mailRefs.value = new Array(mails.value.length).fill(null)
  await nextTick()
  updateMailPositions()
  // Load the first email automatically
  if (mails.value.length > 0) {
    loadCurrentEmail()
  }
})

// Watch for currentIndex changes to automatically load email content
watch(() => currentIndex.value, () => {
  loadCurrentEmail()
})

const handleItemClick = (index: number) => {
  // If clicking the current item, do nothing (already loaded)
  if (index === currentIndex.value) {
    return
  }

  // If clicking a different item, move it to center
  if (isScrolling.value) return

  isScrolling.value = true
  currentIndex.value = index
  updateMailPositions()

  setTimeout(() => {
    isScrolling.value = false
  }, 500)
}

const handleWheel = (event: WheelEvent) => {
  if (isScrolling.value || mails.value.length === 0) return

  event.preventDefault()

  const delta = event.deltaY > 0 ? 1 : -1
  const newIndex = Math.max(0, Math.min(mails.value.length - 1, currentIndex.value + delta))

  if (newIndex !== currentIndex.value) {
    isScrolling.value = true
    currentIndex.value = newIndex
    updateMailPositions()

    setTimeout(() => {
      isScrolling.value = false
    }, 500)
  }
}

onMounted(async () => {
  try {
    // Get all accounts
    const accounts = await window.electronAPI.accounts.list()

    if (accounts.length === 0) {
      console.warn('No accounts found')
      return
    }

    // Get folders for the first account
    const folders = await window.electronAPI.folders.list(accounts[0].id)

    // Find the inbox folder
    const inboxFolder = folders.find((f: any) => f.name.toLowerCase() === 'inbox')

    if (!inboxFolder) {
      console.warn('Inbox folder not found')
      return
    }

    // Store folder name
    currentFolderName.value = inboxFolder.name || 'Inbox'

    // Load emails from inbox
    mails.value = await window.electronAPI.emails.list(inboxFolder.id, 0, 100, false)

    // Wait for DOM to update
    await nextTick()

    // Initialize positions
    updateMailPositions()

    // Add resize observer to update positions on container resize
    if (containerRef.value) {
      resizeObserver = new ResizeObserver(() => {
        updateMailPositions()
      })
      resizeObserver.observe(containerRef.value)
    }
  } catch (error) {
    console.error('Error loading inbox emails:', error)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})


</script>

<style scoped></style>
