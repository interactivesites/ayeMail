<template>
  <Teleport to="body">
    <div
      v-if="show"
      ref="popoverRef"
      class="link-preview-popover fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 min-w-[320px] max-w-[480px]"
      :style="popoverStyle"
    >
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <img
            v-if="faviconUrl"
            :src="faviconUrl"
            alt=""
            class="w-5 h-5 flex-shrink-0"
            @error="faviconUrl = null"
          />
          <span class="font-semibold text-gray-900 dark:text-gray-100 truncate">{{ domain }}</span>
        </div>
        <button
          @click="close"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 ml-2"
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="mb-3">
        <div class="text-sm text-gray-600 dark:text-gray-400 break-all mb-2">{{ url }}</div>
        <button
          @click="copyUrl"
          class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
        >
          Copy URL
        </button>
      </div>

      <div
        v-if="securityCheck && (securityCheck.warnings.length > 0 || securityCheck.riskLevel !== 'safe')"
        class="mb-3 p-2 rounded"
        :class="{
          'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800': securityCheck.riskLevel === 'low' || securityCheck.riskLevel === 'medium',
          'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800': securityCheck.riskLevel === 'high'
        }"
      >
        <div class="flex items-start gap-2">
          <svg
            v-if="securityCheck.riskLevel === 'high'"
            class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <svg
            v-else
            class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <div class="text-sm font-medium mb-1" :class="{
              'text-yellow-800 dark:text-yellow-200': securityCheck.riskLevel === 'low' || securityCheck.riskLevel === 'medium',
              'text-red-800 dark:text-red-200': securityCheck.riskLevel === 'high'
            }">
              {{ securityCheck.riskLevel === 'high' ? 'Security Warning' : 'Security Notice' }}
            </div>
            <ul class="text-xs space-y-1" :class="{
              'text-yellow-700 dark:text-yellow-300': securityCheck.riskLevel === 'low' || securityCheck.riskLevel === 'medium',
              'text-red-700 dark:text-red-300': securityCheck.riskLevel === 'high'
            }">
              <li v-for="(warning, index) in securityCheck.warnings" :key="index">
                • {{ warning }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="openLink"
          class="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
        >
          Open
        </button>
        <button
          @click="close"
          class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { PropType } from 'vue'
import { checkUrlSecurity, type UrlSecurityCheck } from '../utils/url-security'

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  displayText: {
    type: String,
    required: false
  },
  referenceElement: {
    type: Object as PropType<HTMLElement | null>,
    required: false,
    default: null
  },
  iframeElement: {
    type: Object as PropType<HTMLIFrameElement | null>,
    required: false,
    default: null
  }
})

const emit = defineEmits<{
  'open': [url: string]
  'close': []
}>()

const popoverRef = ref<HTMLElement | null>(null)
const popoverStyle = ref<{ top?: string; left?: string; transform?: string }>({})
const securityCheck = ref<UrlSecurityCheck | null>(null)
const domain = ref('')
const faviconUrl = ref<string | null>(null)

const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const loadFavicon = (domainName: string) => {
  // Use Google's favicon service as a proxy
  faviconUrl.value = `https://www.google.com/s2/favicons?domain=${domainName}&sz=32`
}

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(props.url)
    // Could show a toast notification here
  } catch (error) {
    console.error('Failed to copy URL:', error)
  }
}

const openLink = () => {
  emit('open', props.url)
}

const close = () => {
  emit('close')
}

const updatePosition = async () => {
  if (!props.show || !popoverRef.value || !props.referenceElement) return

  try {
    const { computePosition, offset, shift, flip } = await import('@floating-ui/dom')
    
    // Get the bounding rect of the reference element (relative to iframe viewport)
    const elementRect = props.referenceElement.getBoundingClientRect()
    
    // If we have an iframe element, adjust for iframe position in main document
    let referenceRect = elementRect
    if (props.iframeElement) {
      const iframeRect = props.iframeElement.getBoundingClientRect()
      // Adjust coordinates to be relative to main document viewport
      referenceRect = {
        ...elementRect,
        top: iframeRect.top + elementRect.top,
        left: iframeRect.left + elementRect.left,
        bottom: iframeRect.top + elementRect.bottom,
        right: iframeRect.left + elementRect.right,
        width: elementRect.width,
        height: elementRect.height,
        x: iframeRect.left + elementRect.left,
        y: iframeRect.top + elementRect.top,
        toJSON: elementRect.toJSON
      } as DOMRect
    }
    
    // Create a virtual reference element for positioning
    const virtualReference = {
      getBoundingClientRect: () => referenceRect
    }
    
    const { x, y } = await computePosition(virtualReference as any, popoverRef.value, {
      placement: 'bottom-start',
      middleware: [
        offset(8),
        shift({ padding: 8 }),
        flip()
      ]
    })

    popoverStyle.value = {
      top: `${y}px`,
      left: `${x}px`,
      transform: 'none'
    }
  } catch (error) {
    console.error('Error positioning popover:', error)
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    // Extract domain and load favicon
    domain.value = extractDomain(props.url)
    loadFavicon(domain.value)
    
    // Run security check
    securityCheck.value = checkUrlSecurity(props.url, props.displayText)
    
    // Update position
    nextTick(() => {
      updatePosition()
    })
  }
})

watch(() => props.referenceElement, () => {
  if (props.show) {
    updatePosition()
  }
})

const handleClickOutside = (event: MouseEvent) => {
  if (props.show && popoverRef.value && !popoverRef.value.contains(event.target as Node)) {
    close()
  }
}

onMounted(() => {
  if (props.show) {
    updatePosition()
  }
  window.addEventListener('click', handleClickOutside)
  window.addEventListener('scroll', updatePosition, true)
  window.addEventListener('resize', updatePosition)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})
</script>

<style scoped>
.link-preview-popover {
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

