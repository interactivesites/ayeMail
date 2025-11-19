<template>
  <div class="experimental-email-viewer flex flex-col h-full overflow-auto">
    <div v-if="!email && !loading" class="flex-1 flex items-center justify-center text-gray-500 dark:text-dark-gray-400">
      Select an email to view
    </div>
    <div v-else-if="loading && !email" class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center space-y-4">
        <div class="w-8 h-8 border-4 border-primary-600 dark:border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-gray-600 dark:text-dark-gray-400">Loading email...</p>
      </div>
    </div>
    <div v-else-if="email" class="flex flex-col h-full p-8">
      <!-- Email Header -->
      <div class="mb-6 pb-6 border-b border-gray-200 dark:border-dark-gray-700">
        <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-dark-gray-100">
          {{ email.subject || '(No subject)' }}
        </h2>
        <div class="text-sm space-y-2 text-gray-600 dark:text-dark-gray-300">
          <div>
            <span class="font-medium">From:</span>
            <span class="ml-2">{{ formatAddresses(email.from) }}</span>
          </div>
          <div v-if="email.to && email.to.length > 0">
            <span class="font-medium">To:</span>
            <span class="ml-2">{{ formatAddresses(email.to) }}</span>
          </div>
          <div v-if="email.cc && email.cc.length > 0">
            <span class="font-medium">CC:</span>
            <span class="ml-2">{{ formatAddresses(email.cc) }}</span>
          </div>
          <div class="text-gray-500 dark:text-dark-gray-400">
            {{ formatDate(email.date) }}
          </div>
        </div>
      </div>

      <!-- Email Body -->
      <div class="flex-1 overflow-auto">
        <iframe
          v-if="email.htmlBody"
          :srcdoc="sanitizedHtml"
          class="w-full border-0 bg-transparent"
          style="min-height: 400px; display: block;"
          sandbox="allow-same-origin"
          scrolling="no"
          ref="emailIframe"
          @load="onIframeLoad"
        ></iframe>
        <div 
          v-else 
          class="whitespace-pre-wrap text-gray-900 dark:text-dark-gray-100 font-mono text-sm"
        >
          {{ email.textBody || email.body || '(No content)' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, nextTick } from 'vue'
import { usePreferencesStore } from '../stores/preferences'
import type { Email } from '@shared/types'

const props = defineProps<{
  email: any | null
  loading?: boolean
}>()

const preferences = usePreferencesStore()
const isDarkMode = computed(() => preferences.darkMode)

const formatAddresses = (addresses: any[] | undefined): string => {
  if (!addresses || !Array.isArray(addresses) || addresses.length === 0) return '—'
  return addresses.map(addr => {
    if (addr.name && addr.address) {
      return `${addr.name} <${addr.address}>`
    }
    return addr.address || addr.name || ''
  }).join(', ')
}

const formatDate = (timestamp: number | string | Date | undefined) => {
  if (!timestamp) return ''
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString()
}

const stripStyles = (html: string): string => {
  if (!html) return ''
  
  // Use DOMParser for better HTML parsing
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  
  // Remove all style attributes
  const allElements = doc.querySelectorAll('*')
  allElements.forEach(el => {
    el.removeAttribute('style')
    el.removeAttribute('bgcolor')
    el.removeAttribute('background')
  })
  
  // Remove style tags
  const styleTags = doc.querySelectorAll('style')
  styleTags.forEach(style => style.remove())
  
  // Remove link tags that might contain stylesheets
  const linkTags = doc.querySelectorAll('link[rel="stylesheet"]')
  linkTags.forEach(link => link.remove())
  
  // Get the body content or the whole document
  const bodyContent = doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML
  
  return bodyContent || html
}

const sanitizedHtml = computed(() => {
  if (!props.email?.htmlBody) return ''
  
  let html = stripStyles(props.email.htmlBody)
  
  // Apply base styles based on dark mode
  const textColor = isDarkMode.value ? '#ffffff' : '#000000'
  const bgColor = isDarkMode.value ? 'transparent' : 'transparent'
  
  // Wrap in a container with base styles that override everything
  const baseStyles = `
    <style>
      html, body, * {
        color: ${textColor} !important;
        background-color: ${bgColor} !important;
        background: ${bgColor} !important;
        background-image: none !important;
      }
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: ${textColor} !important;
        background-color: ${bgColor} !important;
      }
      img {
        max-width: 100%;
        height: auto;
        opacity: 1 !important;
      }
      a {
        color: ${textColor} !important;
        text-decoration: underline;
      }
      a:visited {
        color: ${textColor} !important;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        background-color: ${bgColor} !important;
        border: none !important;
      }
      td, th, tr {
        border: none !important;
        border-width: 0 !important;
        border-color: transparent !important;
        padding: 8px;
        background-color: ${bgColor} !important;
        color: ${textColor} !important;
      }
      table, td, th, tr {
        border-collapse: collapse !important;
        border-spacing: 0 !important;
      }
      div, p, span, h1, h2, h3, h4, h5, h6 {
        color: ${textColor} !important;
        background-color: ${bgColor} !important;
      }
    </style>
  `
  
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${baseStyles}</head><body>${html}</body></html>`
})

const emailIframe = ref<HTMLIFrameElement | null>(null)

const onIframeLoad = () => {
  if (!emailIframe.value) return
  
  try {
    const iframeDoc = emailIframe.value.contentDocument || emailIframe.value.contentWindow?.document
    if (iframeDoc && iframeDoc.body) {
      const height = Math.max(iframeDoc.body.scrollHeight || 400, 400)
      emailIframe.value.style.height = `${height}px`
    }
  } catch (error) {
    // Cross-origin or other security restrictions
    console.warn('Could not access iframe content:', error)
  }
}

// Adjust iframe height when email changes
watch(() => props.email?.htmlBody, async () => {
  if (emailIframe.value && props.email?.htmlBody) {
    await nextTick()
    onIframeLoad()
  }
}, { immediate: true })
</script>

<style scoped>
.experimental-email-viewer {
  background: transparent;
}

.email-content {
  max-width: 100%;
}

.email-content :deep(*) {
  max-width: 100%;
}

.email-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.email-content :deep(table) {
  max-width: 100%;
  overflow-x: auto;
  display: block;
}
</style>

