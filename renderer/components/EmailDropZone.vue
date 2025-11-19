<template>
  <div ref="containerRef" class="flex flex-col h-full bg-gray-50 dark:bg-dark-gray-900 items-center justify-center p-8">
    <h2 class="text-lg font-semibold text-gray-900 mb-8">Move email to...</h2>
    
    <div class="grid grid-cols-2 gap-8 max-w-2xl w-full dark:text-white">
      <!-- Bin -->
      <div
        ref="binZoneRef"
        @dragover.prevent="handleDragOver($event, 'bin')"
        @dragleave="handleDragLeave($event, 'bin')"
        @drop.prevent="handleDrop('bin')"
        class="drop-zone-circle flex flex-col items-center justify-center cursor-pointer relative"
        :class="{
          'hover:scale-105': activeZone !== 'bin',
          'z-50': activeZone === 'bin',
          'z-10': activeZone !== 'bin' && activeZone !== null
        }"
      >
        <div class="relative mb-3">
          <div ref="binHaloRef" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-red-500 opacity-0 pointer-events-none scale-50 z-0 blur-xl"></div>
          <div class="w-32 h-32 rounded-full bg-red-100 flex items-center justify-center transition-all relative overflow-visible z-10"
            :class="{ 'bg-red-200': activeZone === 'bin' }">
            <svg
              v-if="activeZone === 'bin'"
              ref="binBorderRef"
              class="absolute inset-0 w-32 h-32 rounded-full"
              viewBox="0 0 100 100"
              style="transform-origin: center;"
            >
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-dasharray="8 4"
                class="text-red-400"
              />
            </svg>
            <svg class="w-16 h-16 text-red-600 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        </div>
        <h3 class="font-medium text-gray-900 dark:text-white text-sm">Bin</h3>
        <p class="text-xs text-gray-500 dark:text-dark-gray-400 mt-1">Delete</p>
      </div>

      <!-- Archive -->
      <div
        ref="archiveZoneRef"
        @dragover.prevent="handleDragOver($event, 'archive')"
        @dragleave="handleDragLeave($event, 'archive')"
        @drop.prevent="handleDrop('archive')"
        class="drop-zone-circle flex flex-col items-center justify-center cursor-pointer relative"
        :class="{
          'hover:scale-105': activeZone !== 'archive',
          'z-50': activeZone === 'archive',
          'z-10': activeZone !== 'archive' && activeZone !== null
        }"
      >
        <div class="relative mb-3">
          <div ref="archiveHaloRef" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-blue-500 opacity-0 pointer-events-none scale-50 z-0 blur-xl"></div>
          <div class="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center transition-all relative overflow-visible z-10"
            :class="{ 'bg-blue-200': activeZone === 'archive' }">
            <svg
              v-if="activeZone === 'archive'"
              ref="archiveBorderRef"
              class="absolute inset-0 w-32 h-32 rounded-full"
              viewBox="0 0 100 100"
              style="transform-origin: center;"
            >
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-dasharray="8 4"
                class="text-blue-400"
              />
            </svg>
            <svg class="w-16 h-16 text-blue-600 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
        </div>
        <h3 class="font-medium text-gray-900 dark:text-white text-sm">Archive</h3>
        <p class="text-xs text-gray-500 dark:text-dark-gray-400 mt-1">Move to archive</p>
      </div>

      <!-- Set Aside - Tomorrow -->
      <div
        ref="setAsideTomorrowRef"
        @dragover.prevent="handleDragOver($event, 'setAsideTomorrow')"
        @dragleave="handleDragLeave($event, 'setAsideTomorrow')"
        @drop.prevent="handleDrop('setAsideTomorrow')"
        class="drop-zone-circle flex flex-col items-center justify-center cursor-pointer relative"
        :class="{
          'hover:scale-105': activeZone !== 'setAsideTomorrow',
          'z-50': activeZone === 'setAsideTomorrow',
          'z-10': activeZone !== 'setAsideTomorrow' && activeZone !== null
        }"
      >
        <div class="relative mb-3">
          <div ref="setAsideTomorrowHaloRef" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-purple-500 opacity-0 pointer-events-none scale-50 z-0 blur-xl"></div>
          <div class="w-32 h-32 rounded-full bg-purple-100 flex items-center justify-center transition-all relative overflow-visible z-10"
            :class="{ 'bg-purple-200': activeZone === 'setAsideTomorrow' }">
            <svg
              v-if="activeZone === 'setAsideTomorrow'"
              ref="setAsideTomorrowBorderRef"
              class="absolute inset-0 w-32 h-32 rounded-full"
              viewBox="0 0 100 100"
              style="transform-origin: center;"
            >
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-dasharray="8 4"
                class="text-purple-400"
              />
            </svg>
            <svg class="w-16 h-16 text-purple-600 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <h3 class="font-medium text-gray-900 dark:text-white text-sm">Tomorrow</h3>
        <p class="text-xs text-gray-500 dark:text-dark-gray-400 mt-1">{{ getTomorrowDate() }}</p>
      </div>

      <!-- Set Aside - In 3 Days -->
      <div
        ref="setAside3DaysRef"
        @dragover.prevent="handleDragOver($event, 'setAside3Days')"
        @dragleave="handleDragLeave($event, 'setAside3Days')"
        @drop.prevent="handleDrop('setAside3Days')"
        class="drop-zone-circle flex flex-col items-center justify-center cursor-pointer relative"
        :class="{
          'hover:scale-105': activeZone !== 'setAside3Days',
          'z-50': activeZone === 'setAside3Days',
          'z-10': activeZone !== 'setAside3Days' && activeZone !== null
        }"
      >
        <div class="relative mb-3">
          <div ref="setAside3DaysHaloRef" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-purple-500 opacity-0 pointer-events-none scale-50 z-0 blur-xl"></div>
          <div class="w-32 h-32 rounded-full bg-purple-100 flex items-center justify-center transition-all relative overflow-visible z-10"
            :class="{ 'bg-purple-200': activeZone === 'setAside3Days' }">
            <svg
              v-if="activeZone === 'setAside3Days'"
              ref="setAside3DaysBorderRef"
              class="absolute inset-0 w-32 h-32 rounded-full"
              viewBox="0 0 100 100"
              style="transform-origin: center;"
            >
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-dasharray="8 4"
                class="text-purple-400"
              />
            </svg>
            <svg class="w-16 h-16 text-purple-600 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <h3 class="font-medium text-gray-900 dark:text-white text-sm">In 3 days</h3>
        <p class="text-xs text-gray-500 dark:text-dark-gray-400 mt-1">{{ get3DaysDate() }}</p>
      </div>

      <!-- Set Aside - In a Week -->
      <div
        ref="setAsideWeekRef"
        @dragover.prevent="handleDragOver($event, 'setAsideWeek')"
        @dragleave="handleDragLeave($event, 'setAsideWeek')"
        @drop.prevent="handleDrop('setAsideWeek')"
        class="drop-zone-circle flex flex-col items-center justify-center cursor-pointer relative"
        :class="{
          'hover:scale-105': activeZone !== 'setAsideWeek',
          'z-50': activeZone === 'setAsideWeek',
          'z-10': activeZone !== 'setAsideWeek' && activeZone !== null
        }"
      >
        <div class="relative mb-3">
          <div ref="setAsideWeekHaloRef" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-purple-500 opacity-0 pointer-events-none scale-50 z-0 blur-xl"></div>
          <div class="w-32 h-32 rounded-full bg-purple-100 flex items-center justify-center transition-all relative overflow-visible z-10"
            :class="{ 'bg-purple-200': activeZone === 'setAsideWeek' }">
            <svg
              v-if="activeZone === 'setAsideWeek'"
              ref="setAsideWeekBorderRef"
              class="absolute inset-0 w-32 h-32 rounded-full"
              viewBox="0 0 100 100"
              style="transform-origin: center;"
            >
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-dasharray="8 4"
                class="text-purple-400"
              />
            </svg>
            <svg class="w-16 h-16 text-purple-600 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <h3 class="font-medium text-gray-900 dark:text-white text-sm">In a week</h3>
        <p class="text-xs text-gray-500 dark:text-dark-gray-400 mt-1">{{ getWeekDate() }}</p>
      </div>

      <!-- Learned Folders -->
      <template v-for="(learnedFolder, index) in learnedFolders" :key="learnedFolder.folderId">
        <div
          :ref="(el) => { if (el) learnedFolderRefs[index] = el as HTMLElement }"
          @dragover.prevent="handleDragOver($event, `learned-${learnedFolder.folderId}`)"
          @dragleave="handleDragLeave($event, `learned-${learnedFolder.folderId}`)"
          @drop.prevent="handleDrop(`learned-${learnedFolder.folderId}`, learnedFolder.folderId)"
          class="drop-zone-circle flex flex-col items-center justify-center cursor-pointer relative"
          :class="{
            'hover:scale-105': activeZone !== `learned-${learnedFolder.folderId}`,
            'z-50': activeZone === `learned-${learnedFolder.folderId}`,
            'z-10': activeZone !== `learned-${learnedFolder.folderId}` && activeZone !== null
          }"
        >
          <div class="relative mb-3">
            <div :ref="(el) => { if (el) learnedFolderHaloRefs[index] = el as HTMLElement }" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-green-500 opacity-0 pointer-events-none scale-50 z-0 blur-xl"></div>
            <div class="w-32 h-32 rounded-full bg-green-100 flex items-center justify-center transition-all relative overflow-visible z-10"
              :class="{ 'bg-green-200': activeZone === `learned-${learnedFolder.folderId}` }">
              <svg
                v-if="activeZone === `learned-${learnedFolder.folderId}`"
                :ref="(el) => { if (el) learnedFolderBorderRefs[index] = el as SVGElement }"
                class="absolute inset-0 w-32 h-32 rounded-full"
                viewBox="0 0 100 100"
                style="transform-origin: center;"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-dasharray="8 4"
                  class="text-green-400"
                />
              </svg>
              <svg class="w-16 h-16 text-green-600 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
          </div>
          <h3 class="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[100px]">{{ learnedFolder.folderName }}</h3>
          <p class="text-xs text-gray-500 dark:text-dark-gray-400 mt-1">{{ learnedFolder.moveCount }}x</p>
        </div>
      </template>
      
      <!-- No Learned Folders Message -->
      <div
        v-if="learnedFolders.length === 0"
        ref="foldersRef"
        class="drop-zone-circle flex flex-col items-center justify-center opacity-50"
      >
        <div class="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <h3 class="font-medium text-gray-500 dark:text-dark-gray-400 text-sm">Folders</h3>
        <p class="text-xs text-gray-400 dark:text-dark-gray-400 mt-1">No learned folders yet</p>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div
      v-if="isProcessing"
      class="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center"
    >
      <div class="flex flex-col items-center space-y-3">
        <div class="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-gray-700 font-medium">{{ processingMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { gsap } from 'gsap'

const props = defineProps<{
  draggedEmail: any
  accountId: string
}>()

const emit = defineEmits<{
  'action-complete': []
  'close': []
  'drop-start': [emailId: string]
  'drop-error': [emailId: string]
}>()

const containerRef = ref<HTMLElement | null>(null)
const binZoneRef = ref<HTMLElement | null>(null)
const archiveZoneRef = ref<HTMLElement | null>(null)
const setAsideTomorrowRef = ref<HTMLElement | null>(null)
const setAside3DaysRef = ref<HTMLElement | null>(null)
const setAsideWeekRef = ref<HTMLElement | null>(null)
const foldersRef = ref<HTMLElement | null>(null)

const binHaloRef = ref<HTMLElement | null>(null)
const archiveHaloRef = ref<HTMLElement | null>(null)
const setAsideTomorrowHaloRef = ref<HTMLElement | null>(null)
const setAside3DaysHaloRef = ref<HTMLElement | null>(null)
const setAsideWeekHaloRef = ref<HTMLElement | null>(null)
const learnedFolderHaloRefs = ref<HTMLElement[]>([])

const binBorderRef = ref<SVGElement | null>(null)
const archiveBorderRef = ref<SVGElement | null>(null)
const setAsideTomorrowBorderRef = ref<SVGElement | null>(null)
const setAside3DaysBorderRef = ref<SVGElement | null>(null)
const setAsideWeekBorderRef = ref<SVGElement | null>(null)
const learnedFolderRefs = ref<HTMLElement[]>([])
const learnedFolderBorderRefs = ref<SVGElement[]>([])

const activeZone = ref<string | null>(null)
const isProcessing = ref(false)
const processingMessage = ref('')
const learnedFolders = ref<Array<{ folderId: string; folderName: string; moveCount: number }>>([])

let borderAnimations = new Map<string, gsap.core.Tween>()
let zoneScaleAnimations = new Map<string, gsap.core.Tween>()
let haloAnimations = new Map<string, gsap.core.Tween>()

onMounted(async () => {
  // Animate container fade in
  if (containerRef.value) {
    gsap.from(containerRef.value, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.out'
    })
  }
  
  // Load learned folders for this sender
  await loadLearnedFolders()
})

const loadLearnedFolders = async () => {
  if (!props.draggedEmail || !props.accountId) return
  
  try {
    // Extract sender email
    const fromAddresses = props.draggedEmail.from || []
    if (fromAddresses.length === 0) return
    
    const senderEmail = fromAddresses[0].address
    if (!senderEmail) return
    
    // Get learned folders
    const learned = await window.electronAPI.folders.getLearned(props.accountId, senderEmail)
    learnedFolders.value = learned
  } catch (error) {
    console.error('Error loading learned folders:', error)
  }
}

watch(() => props.draggedEmail, () => {
  loadLearnedFolders()
}, { immediate: false })

const handleDragOver = (event: DragEvent, zone: string) => {
  event.preventDefault()
  
  // If already on this zone, don't restart animations
  if (activeZone.value === zone) {
    return
  }
  
  // If switching zones, stop all previous animations and reset
  if (activeZone.value && activeZone.value !== zone) {
    stopAllAnimations(activeZone.value)
    // Reset previous zone to initial state
    const prevZoneElement = getZoneElement(activeZone.value)
    const prevHaloElement = getHaloElement(activeZone.value)
    if (prevZoneElement) {
      gsap.set(prevZoneElement, { scale: 1 })
    }
    if (prevHaloElement) {
      gsap.set(prevHaloElement, { opacity: 0, scale: 0.5 })
    }
  }
  
  activeZone.value = zone
  
  // Animate zone scale - zoom way larger with smooth bounce
  const zoneElement = getZoneElement(zone)
  const haloElement = getHaloElement(zone)
  
  if (zoneElement) {
    // Kill any existing animation for this zone first
    const existingTween = zoneScaleAnimations.get(zone)
    if (existingTween) {
      existingTween.kill()
    }
    const tween = gsap.to(zoneElement, {
      scale: 1.6,
      duration: 0.4,
      ease: 'back.out(2.5)'
    })
    zoneScaleAnimations.set(zone, tween)
  }
  
  if (haloElement) {
    // Kill any existing animation for this halo first
    const existingTween = haloAnimations.get(zone)
    if (existingTween) {
      existingTween.kill()
    }
    const tween = gsap.to(haloElement, {
      opacity: 0.3,
      scale: 1.2,
      duration: 0.4,
      ease: 'back.out(2.5)'
    })
    haloAnimations.set(zone, tween)
  }
  
  // Start rotating border animation
  startBorderAnimation(zone)
}

const stopAllAnimations = (zone: string) => {
  // Kill border animation
  stopBorderAnimation(zone)
  
  // Kill zone scale animation
  const zoneTween = zoneScaleAnimations.get(zone)
  if (zoneTween) {
    zoneTween.kill()
    zoneScaleAnimations.delete(zone)
  }
  
  // Kill halo animation
  const haloTween = haloAnimations.get(zone)
  if (haloTween) {
    haloTween.kill()
    haloAnimations.delete(zone)
  }
}

const handleDragLeave = (event: DragEvent, zone: string) => {
  const relatedTarget = event.relatedTarget as Node | null
  const zoneElement = getZoneElement(zone)
  
  // Only reset if actually leaving the zone (not just moving to child)
  if (zoneElement && (!relatedTarget || !zoneElement.contains(relatedTarget))) {
    if (activeZone.value === zone) {
      activeZone.value = null
      
      // Kill all active animations first
      stopBorderAnimation(zone)
      const zoneTween = zoneScaleAnimations.get(zone)
      if (zoneTween) {
        zoneTween.kill()
        zoneScaleAnimations.delete(zone)
      }
      const haloTween = haloAnimations.get(zone)
      if (haloTween) {
        haloTween.kill()
        haloAnimations.delete(zone)
      }
      
      const haloElement = getHaloElement(zone)
      
      // Reset to initial state with smooth animation
      if (zoneElement) {
        gsap.to(zoneElement, {
          scale: 1,
          duration: 0.3,
          ease: 'back.out(0.7)'
        })
      }
      
      if (haloElement) {
        gsap.to(haloElement, {
          opacity: 0,
          scale: 0.5,
          duration: 0.3,
          ease: 'back.out(0.7)'
        })
      }
    }
  }
}

const startBorderAnimation = (zone: string) => {
  const borderRef = getBorderRef(zone)
  if (!borderRef.value) return
  
  // Stop any existing animation for this zone
  stopBorderAnimation(zone)
  
  // Start rotating animation
  const animation = gsap.to(borderRef.value, {
    rotation: 360,
    duration: 2,
    ease: 'none',
    repeat: -1
  })
  
  borderAnimations.set(zone, animation)
}

const stopBorderAnimation = (zone: string) => {
  const animation = borderAnimations.get(zone)
  if (animation) {
    animation.kill()
    borderAnimations.delete(zone)
  }
  
  // Reset rotation
  const borderRef = getBorderRef(zone)
  if (borderRef.value) {
    gsap.set(borderRef.value, { rotation: 0 })
  }
}

const getBorderRef = (zone: string): { value: SVGElement | null } => {
  if (zone.startsWith('learned-')) {
    const folderId = zone.replace('learned-', '')
    const index = learnedFolders.value.findIndex(f => f.folderId === folderId)
    if (index >= 0 && learnedFolderBorderRefs.value[index]) {
      return { value: learnedFolderBorderRefs.value[index] }
    }
    return { value: null }
  }
  
  switch (zone) {
    case 'bin':
      return binBorderRef
    case 'archive':
      return archiveBorderRef
    case 'setAsideTomorrow':
      return setAsideTomorrowBorderRef
    case 'setAside3Days':
      return setAside3DaysBorderRef
    case 'setAsideWeek':
      return setAsideWeekBorderRef
    default:
      return { value: null }
  }
}

const getZoneElement = (zone: string): HTMLElement | null => {
  if (zone.startsWith('learned-')) {
    const folderId = zone.replace('learned-', '')
    const index = learnedFolders.value.findIndex(f => f.folderId === folderId)
    return index >= 0 ? learnedFolderRefs.value[index] : null
  }
  
  switch (zone) {
    case 'bin':
      return binZoneRef.value
    case 'archive':
      return archiveZoneRef.value
    case 'setAsideTomorrow':
      return setAsideTomorrowRef.value
    case 'setAside3Days':
      return setAside3DaysRef.value
    case 'setAsideWeek':
      return setAsideWeekRef.value
    default:
      return null
  }
}

const getHaloElement = (zone: string): HTMLElement | null => {
  if (zone.startsWith('learned-')) {
    const folderId = zone.replace('learned-', '')
    const index = learnedFolders.value.findIndex(f => f.folderId === folderId)
    return index >= 0 ? learnedFolderHaloRefs.value[index] : null
  }
  
  switch (zone) {
    case 'bin':
      return binHaloRef.value
    case 'archive':
      return archiveHaloRef.value
    case 'setAsideTomorrow':
      return setAsideTomorrowHaloRef.value
    case 'setAside3Days':
      return setAside3DaysHaloRef.value
    case 'setAsideWeek':
      return setAsideWeekHaloRef.value
    default:
      return null
  }
}

const handleDrop = async (action: string, folderId?: string) => {
  if (!props.draggedEmail) return
  
  const emailId = props.draggedEmail.id
  
  // Stop all animations
  if (activeZone.value) {
    stopAllAnimations(activeZone.value)
    // Reset to initial state immediately
    const zoneElement = getZoneElement(activeZone.value)
    const haloElement = getHaloElement(activeZone.value)
    if (zoneElement) {
      gsap.set(zoneElement, { scale: 1 })
    }
    if (haloElement) {
      gsap.set(haloElement, { opacity: 0, scale: 0.5 })
    }
  }
  activeZone.value = null
  
  // Emit drop-start to remove email from list immediately (optimistic update)
  emit('drop-start', emailId)
  
  try {
    isProcessing.value = true
    
    switch (action) {
      case 'bin':
        processingMessage.value = 'Deleting email...'
        await window.electronAPI.emails.delete(props.draggedEmail.id)
        break
        
      case 'archive':
        processingMessage.value = 'Archiving email...'
        await window.electronAPI.emails.archive(props.draggedEmail.id)
        break
        
      case 'setAsideTomorrow':
        processingMessage.value = 'Setting reminder for tomorrow...'
        await createReminder(1)
        break
        
      case 'setAside3Days':
        processingMessage.value = 'Setting reminder for 3 days...'
        await createReminder(3)
        break
        
      case 'setAsideWeek':
        processingMessage.value = 'Setting reminder for a week...'
        await createReminder(7)
        break
        
      default:
        if (action.startsWith('learned-') && folderId) {
          processingMessage.value = 'Moving email...'
          await window.electronAPI.emails.moveToFolder(props.draggedEmail.id, folderId)
          // Reload learned folders after move
          await loadLearnedFolders()
        }
        break
    }
    
    // Refresh email list
    window.dispatchEvent(new CustomEvent('refresh-emails'))
    
    // Animate out and emit complete
    if (containerRef.value) {
      await gsap.to(containerRef.value, {
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in'
      })
    }
    
    emit('action-complete')
  } catch (error: any) {
    console.error('Error handling drop:', error)
    // Emit error to restore email in list
    emit('drop-error', emailId)
    alert(`Failed to ${action}: ${error.message || 'Unknown error'}`)
  } finally {
    isProcessing.value = false
    processingMessage.value = ''
  }
}

const createReminder = async (days: number) => {
  if (!props.draggedEmail || !props.accountId) {
    throw new Error('Missing email or account ID')
  }
  
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + days)
  dueDate.setHours(23, 59, 59, 999)
  
  
  const result = await window.electronAPI.reminders.create({
    emailId: props.draggedEmail.id,
    accountId: props.accountId,
    dueDate: dueDate.getTime()
  })
  
  // Todo: add in-app notification for reminder created
  return result
}

const getTomorrowDate = (): string => {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const get3DaysDate = (): string => {
  const date = new Date()
  date.setDate(date.getDate() + 3)
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const getWeekDate = (): string => {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

onUnmounted(() => {
  // Clean up all animations
  borderAnimations.forEach((animation) => {
    animation.kill()
  })
  borderAnimations.clear()
})
</script>

<style scoped>
/* Transitions removed - GSAP handles all animations */
</style>

