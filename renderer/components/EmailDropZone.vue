<template>
  <div ref="containerRef" class="flex flex-col h-full bg-gray-50 items-center justify-center p-8">
    <h2 class="text-lg font-semibold text-gray-900 mb-8">Move email to...</h2>
    
    <div class="grid grid-cols-2 gap-8 max-w-2xl w-full">
      <!-- Bin -->
      <div
        ref="binZoneRef"
        @dragover.prevent="handleDragOver($event, 'bin')"
        @dragleave="handleDragLeave($event, 'bin')"
        @drop.prevent="handleDrop('bin')"
        class="drop-zone-circle flex flex-col items-center justify-center cursor-pointer transition-all relative"
        :class="{
          'hover:scale-105': activeZone !== 'bin'
        }"
      >
        <div class="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mb-3 transition-all relative overflow-visible"
          :class="{ 'bg-red-200': activeZone === 'bin' }">
          <svg
            v-if="activeZone === 'bin'"
            ref="binBorderRef"
            class="absolute inset-0 w-24 h-24 rounded-full"
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
          <svg class="w-12 h-12 text-red-600 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 class="font-medium text-gray-900 text-sm">Bin</h3>
        <p class="text-xs text-gray-500 mt-1">Delete</p>
      </div>

      <!-- Archive -->
      <div
        ref="archiveZoneRef"
        @dragover.prevent="handleDragOver($event, 'archive')"
        @dragleave="handleDragLeave($event, 'archive')"
        @drop.prevent="handleDrop('archive')"
        class="drop-zone-circle flex flex-col items-center justify-center cursor-pointer transition-all relative"
        :class="{
          'hover:scale-105': activeZone !== 'archive'
        }"
      >
        <div class="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-3 transition-all relative overflow-visible"
          :class="{ 'bg-blue-200': activeZone === 'archive' }">
          <svg
            v-if="activeZone === 'archive'"
            ref="archiveBorderRef"
            class="absolute inset-0 w-24 h-24 rounded-full"
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
          <svg class="w-12 h-12 text-blue-600 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </div>
        <h3 class="font-medium text-gray-900 text-sm">Archive</h3>
        <p class="text-xs text-gray-500 mt-1">Move to archive</p>
      </div>

      <!-- Set Aside - Tomorrow -->
      <div
        ref="setAsideTomorrowRef"
        @dragover.prevent="handleDragOver($event, 'setAsideTomorrow')"
        @dragleave="handleDragLeave($event, 'setAsideTomorrow')"
        @drop.prevent="handleDrop('setAsideTomorrow')"
        class="drop-zone-circle flex flex-col items-center justify-center cursor-pointer transition-all relative"
        :class="{
          'hover:scale-105': activeZone !== 'setAsideTomorrow'
        }"
      >
        <div class="w-24 h-24 rounded-full bg-purple-100 flex items-center justify-center mb-3 transition-all relative overflow-visible"
          :class="{ 'bg-purple-200': activeZone === 'setAsideTomorrow' }">
          <svg
            v-if="activeZone === 'setAsideTomorrow'"
            ref="setAsideTomorrowBorderRef"
            class="absolute inset-0 w-24 h-24 rounded-full"
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
          <svg class="w-12 h-12 text-purple-600 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="font-medium text-gray-900 text-sm">Tomorrow</h3>
        <p class="text-xs text-gray-500 mt-1">{{ getTomorrowDate() }}</p>
      </div>

      <!-- Set Aside - In 3 Days -->
      <div
        ref="setAside3DaysRef"
        @dragover.prevent="handleDragOver($event, 'setAside3Days')"
        @dragleave="handleDragLeave($event, 'setAside3Days')"
        @drop.prevent="handleDrop('setAside3Days')"
        class="drop-zone-circle flex flex-col items-center justify-center cursor-pointer transition-all relative"
        :class="{
          'hover:scale-105': activeZone !== 'setAside3Days'
        }"
      >
        <div class="w-24 h-24 rounded-full bg-purple-100 flex items-center justify-center mb-3 transition-all relative overflow-visible"
          :class="{ 'bg-purple-200': activeZone === 'setAside3Days' }">
          <svg
            v-if="activeZone === 'setAside3Days'"
            ref="setAside3DaysBorderRef"
            class="absolute inset-0 w-24 h-24 rounded-full"
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
          <svg class="w-12 h-12 text-purple-600 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="font-medium text-gray-900 text-sm">In 3 days</h3>
        <p class="text-xs text-gray-500 mt-1">{{ get3DaysDate() }}</p>
      </div>

      <!-- Set Aside - In a Week -->
      <div
        ref="setAsideWeekRef"
        @dragover.prevent="handleDragOver($event, 'setAsideWeek')"
        @dragleave="handleDragLeave($event, 'setAsideWeek')"
        @drop.prevent="handleDrop('setAsideWeek')"
        class="drop-zone-circle flex flex-col items-center justify-center cursor-pointer transition-all relative"
        :class="{
          'hover:scale-105': activeZone !== 'setAsideWeek'
        }"
      >
        <div class="w-24 h-24 rounded-full bg-purple-100 flex items-center justify-center mb-3 transition-all relative overflow-visible"
          :class="{ 'bg-purple-200': activeZone === 'setAsideWeek' }">
          <svg
            v-if="activeZone === 'setAsideWeek'"
            ref="setAsideWeekBorderRef"
            class="absolute inset-0 w-24 h-24 rounded-full"
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
          <svg class="w-12 h-12 text-purple-600 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="font-medium text-gray-900 text-sm">In a week</h3>
        <p class="text-xs text-gray-500 mt-1">{{ getWeekDate() }}</p>
      </div>

      <!-- Recently Used Folders (Placeholder) -->
      <div
        ref="foldersRef"
        class="drop-zone-circle flex flex-col items-center justify-center opacity-50"
      >
        <div class="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <h3 class="font-medium text-gray-500 text-sm">Folders</h3>
        <p class="text-xs text-gray-400 mt-1">Coming soon</p>
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
import { ref, onMounted, onUnmounted } from 'vue'
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

const binBorderRef = ref<SVGElement | null>(null)
const archiveBorderRef = ref<SVGElement | null>(null)
const setAsideTomorrowBorderRef = ref<SVGElement | null>(null)
const setAside3DaysBorderRef = ref<SVGElement | null>(null)
const setAsideWeekBorderRef = ref<SVGElement | null>(null)

const activeZone = ref<string | null>(null)
const isProcessing = ref(false)
const processingMessage = ref('')

let borderAnimations = new Map<string, gsap.core.Tween>()

onMounted(() => {
  // Animate container fade in
  if (containerRef.value) {
    gsap.from(containerRef.value, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.out'
    })
  }
})

const handleDragOver = (event: DragEvent, zone: string) => {
  event.preventDefault()
  
  // If switching zones, stop previous animation
  if (activeZone.value && activeZone.value !== zone) {
    stopBorderAnimation(activeZone.value)
  }
  
  activeZone.value = zone
  
  // Animate zone scale - zoom way larger
  const zoneElement = getZoneElement(zone)
  if (zoneElement) {
    gsap.to(zoneElement, {
      scale: 1.5,
      duration: 0.2,
      ease: 'power2.out'
    })
  }
  
  // Start rotating border animation
  startBorderAnimation(zone)
}

const handleDragLeave = (event: DragEvent, zone: string) => {
  const relatedTarget = event.relatedTarget as Node | null
  const zoneElement = getZoneElement(zone)
  
  // Only reset if actually leaving the zone (not just moving to child)
  if (zoneElement && (!relatedTarget || !zoneElement.contains(relatedTarget))) {
    if (activeZone.value === zone) {
      activeZone.value = null
      stopBorderAnimation(zone)
    }
    
    if (zoneElement) {
      gsap.to(zoneElement, {
        scale: 1,
        duration: 0.2,
        ease: 'power2.out'
      })
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

const handleDrop = async (action: string) => {
  if (!props.draggedEmail) return
  
  const emailId = props.draggedEmail.id
  
  // Stop border animation
  if (activeZone.value) {
    stopBorderAnimation(activeZone.value)
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
  
  console.log('Creating reminder:', {
    emailId: props.draggedEmail.id,
    accountId: props.accountId,
    dueDate: dueDate.toISOString(),
    days
  })
  
  const result = await window.electronAPI.reminders.create({
    emailId: props.draggedEmail.id,
    accountId: props.accountId,
    dueDate: dueDate.getTime()
  })
  
  console.log('Reminder created successfully:', result)
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
.drop-zone-circle {
  transition: all 0.2s ease;
}
</style>

