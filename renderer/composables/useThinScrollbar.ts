import { ref, onMounted, onBeforeUnmount, nextTick, type Ref } from 'vue'

export function useThinScrollbar(contentRef: Ref<HTMLElement | null>, trackRef: Ref<HTMLElement | null>, thumbRef: Ref<HTMLElement | null>) {
  const isScrolling = ref(false)
  const scrollTimeout = ref<NodeJS.Timeout | null>(null)
  const isDragging = ref(false)
  const dragStartY = ref(0)
  const dragStartScrollTop = ref(0)
  let resizeObserver: ResizeObserver | null = null

  const updateScrollbar = () => {
    if (!contentRef.value || !thumbRef.value || !trackRef.value) return

    const content = contentRef.value
    const thumb = thumbRef.value
    const track = trackRef.value

    const scrollHeight = content.scrollHeight
    const clientHeight = content.clientHeight
    const scrollTop = content.scrollTop

    // Calculate thumb height and position
    const trackHeight = track.clientHeight
    const thumbHeight = Math.max(20, (clientHeight / scrollHeight) * trackHeight)
    const maxScroll = scrollHeight - clientHeight
    
    if (maxScroll <= 0) {
      thumb.style.display = 'none'
      if (trackRef.value) {
        trackRef.value.style.display = 'none'
      }
      return
    }
    
    if (trackRef.value) {
      trackRef.value.style.display = 'block'
    }
    
    const thumbTop = (scrollTop / maxScroll) * (trackHeight - thumbHeight)

    thumb.style.height = `${thumbHeight}px`
    thumb.style.top = `${thumbTop}px`
    thumb.style.display = 'block'
  }

  const handleScroll = () => {
    updateScrollbar()
    
    // Show scrollbar when scrolling
    if (!isScrolling.value) {
      isScrolling.value = true
    }

    // Hide scrollbar after scrolling stops
    if (scrollTimeout.value) {
      clearTimeout(scrollTimeout.value)
    }
    scrollTimeout.value = setTimeout(() => {
      isScrolling.value = false
    }, 1000)
  }

  const handleThumbMouseMove = (e: MouseEvent) => {
    if (!isDragging.value || !contentRef.value || !trackRef.value) return

    const track = trackRef.value
    const content = contentRef.value
    const deltaY = e.clientY - dragStartY.value
    const trackHeight = track.clientHeight
    const scrollHeight = content.scrollHeight
    const clientHeight = content.clientHeight
    const maxScroll = scrollHeight - clientHeight

    const scrollDelta = (deltaY / trackHeight) * scrollHeight
    const newScrollTop = Math.max(0, Math.min(maxScroll, dragStartScrollTop.value + scrollDelta))

    content.scrollTop = newScrollTop
  }

  const handleThumbMouseUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', handleThumbMouseMove)
    document.removeEventListener('mouseup', handleThumbMouseUp)
  }

  const handleThumbMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!contentRef.value || !thumbRef.value) return

    isDragging.value = true
    dragStartY.value = e.clientY
    dragStartScrollTop.value = contentRef.value.scrollTop

    document.addEventListener('mousemove', handleThumbMouseMove)
    document.addEventListener('mouseup', handleThumbMouseUp)
  }

  const handleTrackClick = (e: MouseEvent) => {
    if (!contentRef.value || !trackRef.value || !thumbRef.value) return
    if (e.target === thumbRef.value) return

    const track = trackRef.value
    const content = contentRef.value
    const rect = track.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const trackHeight = track.clientHeight
    const scrollHeight = content.scrollHeight
    const clientHeight = content.clientHeight
    const maxScroll = scrollHeight - clientHeight

    if (maxScroll <= 0) return

    const scrollRatio = clickY / trackHeight
    const newScrollTop = scrollRatio * maxScroll

    content.scrollTop = newScrollTop
  }

  onMounted(() => {
    if (!contentRef.value) return

    const content = contentRef.value
    content.addEventListener('scroll', handleScroll)
    
    // Initial update
    nextTick(() => {
      updateScrollbar()
    })

    // Update on resize
    resizeObserver = new ResizeObserver(() => {
      updateScrollbar()
    })
    resizeObserver.observe(content)
  })

  onBeforeUnmount(() => {
    if (contentRef.value) {
      contentRef.value.removeEventListener('scroll', handleScroll)
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
    if (scrollTimeout.value) {
      clearTimeout(scrollTimeout.value)
    }
    document.removeEventListener('mousemove', handleThumbMouseMove)
    document.removeEventListener('mouseup', handleThumbMouseUp)
  })

  return {
    isScrolling,
    isDragging,
    updateScrollbar,
    handleThumbMouseDown,
    handleTrackClick
  }
}
