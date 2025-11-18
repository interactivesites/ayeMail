import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEmailCacheStore = defineStore('emailCache', () => {
  // Cache storage: Map preserves insertion order for LRU
  const cache = ref<Map<string, any>>(new Map())
  const maxSize = 50

  /**
   * Get email from cache or load from API
   * Implements LRU: moves accessed email to end of Map
   */
  const getEmail = async (emailId: string): Promise<any | null> => {
    if (!emailId) return null

    // Check cache first
    if (cache.value.has(emailId)) {
      // LRU: Move to end by deleting and re-inserting
      const email = cache.value.get(emailId)
      cache.value.delete(emailId)
      cache.value.set(emailId, email)
      return email
    }

    // Load from API
    try {
      const email = await window.electronAPI.emails.get(emailId)
      if (email) {
        // Add to cache
        cache.value.set(emailId, email)
        
        // Evict oldest entries if cache exceeds max size
        while (cache.value.size > maxSize) {
          // Map preserves insertion order, so first entry is least recently used
          const firstKey = cache.value.keys().next().value
          if (firstKey) {
            cache.value.delete(firstKey)
          }
        }
      }
      return email
    } catch (error) {
      console.error('Error loading email content:', error)
      return null
    }
  }

  /**
   * Preload multiple emails in background
   */
  const preloadEmails = (emailIds: string[]): void => {
    if (!emailIds || emailIds.length === 0) return

    // Preload emails in background (don't await, just fire and forget)
    emailIds.forEach(emailId => {
      if (emailId && !cache.value.has(emailId)) {
        getEmail(emailId).catch(error => {
          console.error(`Error preloading email ${emailId}:`, error)
        })
      }
    })
  }

  /**
   * Remove specific email from cache
   */
  const clearEmail = (emailId: string): void => {
    if (emailId) {
      cache.value.delete(emailId)
    }
  }

  /**
   * Clear entire cache
   */
  const clearAll = (): void => {
    cache.value.clear()
  }

  /**
   * Remove emails not in valid set (cleanup)
   */
  const cleanup = (validEmailIds: Set<string>): void => {
    for (const [emailId] of cache.value.entries()) {
      if (!validEmailIds.has(emailId)) {
        cache.value.delete(emailId)
      }
    }
  }

  return {
    cache,
    getEmail,
    preloadEmails,
    clearEmail,
    clearAll,
    cleanup
  }
})

