<template>
  <div 
    ref="containerRef"
    class="thin-scrollbar"
    :class="{ scrolling: isScrolling }"
  >
    <div 
      ref="contentRef"
      class="thin-scrollbar-content"
    >
      <slot></slot>
    </div>
    <div 
      ref="trackRef"
      class="thin-scrollbar-track"
      @click="handleTrackClick"
    >
      <div 
        ref="thumbRef"
        class="thin-scrollbar-thumb"
        @mousedown="handleThumbMouseDown"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThinScrollbar } from '../composables/useThinScrollbar'

const containerRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)
const thumbRef = ref<HTMLElement | null>(null)

const { isScrolling, handleThumbMouseDown, handleTrackClick } = useThinScrollbar(
  contentRef,
  trackRef,
  thumbRef
)
</script>

<style scoped>
.thin-scrollbar {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.thin-scrollbar-content {
  height: 100%;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.thin-scrollbar-content::-webkit-scrollbar {
  display: none;
}

.thin-scrollbar-track {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 8px;
  pointer-events: none;
  z-index: 10;
}

.thin-scrollbar-thumb {
  position: absolute;
  right: 2px;
  width: 4px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
  transition: background-color 0.2s ease, opacity 0.2s ease;
  opacity: 0;
  pointer-events: auto;
  cursor: pointer;
}

.thin-scrollbar:hover .thin-scrollbar-thumb,
.thin-scrollbar.scrolling .thin-scrollbar-thumb {
  opacity: 1;
}

.thin-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.3);
}

.thin-scrollbar-thumb:active {
  background-color: rgba(0, 0, 0, 0.4);
}

.dark .thin-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
}

.dark .thin-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

.dark .thin-scrollbar-thumb:active {
  background-color: rgba(255, 255, 255, 0.4);
}
</style>

