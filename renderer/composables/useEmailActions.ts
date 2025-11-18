import { ref, nextTick } from 'vue'
import { usePreferencesStore } from '../stores/preferences'
import { computePosition, offset, shift, arrow as floatingArrow } from '@floating-ui/dom'
import type { Placement, MiddlewareData } from '@floating-ui/dom'
import type { Ref } from 'vue'

// Shared email cache across all components
const emailCache = new Map<string, any>()
const CACHE_RANGE = 3 // Number of emails to cache before and after current

export function useEmailActions() {
  const preferences = usePreferencesStore()
  const archiveConfirmId = ref<string | null>(null)
  const archivePopoverRefs = new Map<string, HTMLElement>()
  const archiveArrowRefs = new Map<string, HTMLElement>()
  const archivingEmailId = ref<string | null>(null)
  const busyEmailIds = ref<Set<string>>(new Set())

  const updateArrowStyles = (arrowElement: HTMLElement | null | undefined, placement: Placement, middlewareData: MiddlewareData) => {
    if (!arrowElement || !middlewareData?.arrow) {
      return
    }

    const { x: arrowX, y: arrowY } = middlewareData.arrow as { x?: number | null; y?: number | null }
    const basePlacement = placement.split('-')[0] as 'top' | 'right' | 'bottom' | 'left'
    const staticSideMap: Record<'top' | 'right' | 'bottom' | 'left', 'top' | 'right' | 'bottom' | 'left'> = {
      top: 'bottom',
      right: 'left',
      bottom: 'top',
      left: 'right'
    }

    arrowElement.style.left = ''
    arrowElement.style.top = ''
    arrowElement.style.right = ''
    arrowElement.style.bottom = ''

    if (arrowX != null) {
      arrowElement.style.left = `${arrowX}px`
    }
    if (arrowY != null) {
      arrowElement.style.top = `${arrowY}px`
    }

    const staticSide = staticSideMap[basePlacement]
    if (staticSide) {
      arrowElement.style[staticSide] = '-6px'
    }
  }

  const positionFloatingElement = async ({
    referenceElement,
    floatingElement,
    placement = 'right-end',
    arrowElement,
    styleRef
  }: {
    referenceElement: HTMLElement
    floatingElement: HTMLElement
    placement?: Placement
    arrowElement?: HTMLElement | null
    styleRef?: Ref<{ top?: string; left?: string; right?: string; transform?: string }>
  }) => {
    const middleware = [
      offset(12),
      shift({ padding: 12 })
    ]

    if (arrowElement) {
      middleware.push(floatingArrow({ element: arrowElement, padding: 6 }))
    }

    const { x, y, placement: finalPlacement, middlewareData } = await computePosition(referenceElement, floatingElement, {
      placement,
      middleware,
      strategy: 'fixed'
    })

    const style = {
      top: `${y}px`,
      left: `${x}px`,
      transform: 'none'
    }

    if (styleRef) {
      styleRef.value = style
    } else {
      floatingElement.style.top = style.top
      floatingElement.style.left = style.left
      floatingElement.style.transform = style.transform
    }

    updateArrowStyles(arrowElement, finalPlacement, middlewareData)
  }

  const getEmailElement = (emailId: string): HTMLElement | null => {
    return document.querySelector(`[data-email-id="${emailId}"]`) as HTMLElement | null
  }

  const getEmailAnchorElement = (emailId: string): HTMLElement | null => {
    return document.querySelector(`[data-email-anchor="${emailId}"]`) as HTMLElement | null
  }

  const showArchiveConfirm = async (emailId: string) => {
    archiveConfirmId.value = emailId

    // Check if confirmation is enabled
    if (!preferences.confirmArchive) {
      // Skip confirmation and archive directly
      await archiveEmail(emailId)
      return
    }

    // Position archive popover using Floating UI
    await nextTick()
    await nextTick() // Double nextTick to ensure Teleport has rendered

    // Small delay to ensure popover is fully rendered
    await new Promise(resolve => setTimeout(resolve, 10))

    const emailElement = getEmailElement(emailId)
    const anchorElement = getEmailAnchorElement(emailId)
    const archiveButton = emailElement?.querySelector('button[title="Archive email"]') as HTMLElement
    const popoverElement = archivePopoverRefs.get(emailId)

    const referenceElement = anchorElement || emailElement || archiveButton
    const arrowElement = archiveArrowRefs.get(emailId) || null

    if (referenceElement && popoverElement) {
      try {
        await positionFloatingElement({
          referenceElement,
          floatingElement: popoverElement,
          arrowElement,
          placement: 'right-end'
        })
      } catch (error) {
        console.error('Error positioning archive popover:', error)
        const rect = referenceElement.getBoundingClientRect()
        popoverElement.style.top = `${rect.top}px`
        popoverElement.style.left = `${rect.right + 12}px`
        popoverElement.style.transform = 'none'
      }
    }
  }

  const cancelArchive = () => {
    archiveConfirmId.value = null
  }

  const archiveEmail = async (emailId: string) => {
    archiveConfirmId.value = null
    archivingEmailId.value = emailId
    busyEmailIds.value.add(emailId)

    try {
      const result = await window.electronAPI.emails.archive(emailId)
      if (result.success) {
        // Clear cache for archived email
        emailCache.delete(emailId)
        // Refresh email list
        window.dispatchEvent(new CustomEvent('refresh-emails'))
        return { success: true }
      } else {
        console.error('Failed to archive email:', result.message)
        return { success: false, message: result.message }
      }
    } catch (error) {
      console.error('Error archiving email:', error)
      return { success: false, message: 'Unknown error' }
    } finally {
      archivingEmailId.value = null
      busyEmailIds.value.delete(emailId)
    }
  }

  const deleteEmail = async (emailId: string) => {
    if (!emailId) return { success: false }

    busyEmailIds.value.add(emailId)

    try {
      const result = await window.electronAPI.emails.delete(emailId)
      if (result.success) {
        // Clear cache for deleted email
        emailCache.delete(emailId)
        // Refresh email list
        window.dispatchEvent(new CustomEvent('refresh-emails'))
        return { success: true }
      } else {
        console.error('Failed to delete email:', result.message)
        return { success: false, message: result.message }
      }
    } catch (error) {
      console.error('Error deleting email:', error)
      return { success: false, message: 'Unknown error' }
    } finally {
      busyEmailIds.value.delete(emailId)
    }
  }

  const moveToFolder = async (emailId: string, folderId: string) => {
    if (!emailId || !folderId) return { success: false }

    busyEmailIds.value.add(emailId)

    try {
      await window.electronAPI.emails.moveToFolder(emailId, folderId)
      // Refresh email list
      window.dispatchEvent(new CustomEvent('refresh-emails'))
      return { success: true }
    } catch (error: any) {
      console.error('Error moving email to folder:', error)
      return { success: false, message: error.message || 'Unknown error' }
    } finally {
      busyEmailIds.value.delete(emailId)
    }
  }

  const spamEmail = async (emailId: string) => {
    if (!emailId) return { success: false }

    busyEmailIds.value.add(emailId)

    try {
      const result = await window.electronAPI.emails.spam(emailId)
      if (result.success) {
        // Refresh email list
        window.dispatchEvent(new CustomEvent('refresh-emails'))
        return { success: true }
      } else {
        console.error('Failed to mark email as spam:', result.message)
        return { success: false, message: result.message }
      }
    } catch (error) {
      console.error('Error marking email as spam:', error)
      return { success: false, message: 'Unknown error' }
    } finally {
      busyEmailIds.value.delete(emailId)
    }
  }

  // Email content caching functions
  const loadEmailContent = async (emailId: string): Promise<any | null> => {
    // Check cache first
    if (emailCache.has(emailId)) {
      return emailCache.get(emailId)
    }

    // Load from API
    try {
      const email = await window.electronAPI.emails.get(emailId)
      emailCache.set(emailId, email)
      return email
    } catch (error) {
      console.error('Error loading email content:', error)
      return null
    }
  }

  const preloadNearbyEmails = async (emails: any[], centerIndex: number) => {
    if (!emails || emails.length === 0) return

    const startIndex = Math.max(0, centerIndex - CACHE_RANGE)
    const endIndex = Math.min(emails.length - 1, centerIndex + CACHE_RANGE)
    
    // Preload emails in background (don't await, just fire and forget)
    for (let i = startIndex; i <= endIndex; i++) {
      const mail = emails[i]
      if (mail && mail.id && !emailCache.has(mail.id)) {
        // Load in background without blocking
        loadEmailContent(mail.id).catch(error => {
          console.error(`Error preloading email ${mail.id}:`, error)
        })
      }
    }
    
    // Clean up cache entries that are too far away
    const cacheStartIndex = Math.max(0, centerIndex - CACHE_RANGE * 2)
    const cacheEndIndex = Math.min(emails.length - 1, centerIndex + CACHE_RANGE * 2)
    const validEmailIds = new Set()
    
    for (let i = cacheStartIndex; i <= cacheEndIndex; i++) {
      const mail = emails[i]
      if (mail && mail.id) {
        validEmailIds.add(mail.id)
      }
    }
    
    // Remove entries that are too far away
    for (const [emailId] of emailCache.entries()) {
      if (!validEmailIds.has(emailId)) {
        emailCache.delete(emailId)
      }
    }
  }

  const clearEmailCache = (emailId?: string) => {
    if (emailId) {
      emailCache.delete(emailId)
    } else {
      emailCache.clear()
    }
  }

  const cleanupEmailCache = (validEmailIds: Set<string>) => {
    // Remove entries for emails that no longer exist
    for (const [emailId] of emailCache.entries()) {
      if (!validEmailIds.has(emailId)) {
        emailCache.delete(emailId)
      }
    }
  }

  // Email action methods
  const composeEmail = (accountId: string) => {
    if (!accountId) return
    ;(window.electronAPI as any).window.compose.create(accountId)
  }

  const replyToEmail = (email: any, accountId: string) => {
    if (!email || !accountId || !email.id) return
    ;(window.electronAPI as any).window.compose.create(accountId, { emailId: email.id, forward: false })
  }

  const forwardEmail = (email: any, accountId: string) => {
    if (!email || !accountId || !email.id) return
    ;(window.electronAPI as any).window.compose.create(accountId, { emailId: email.id, forward: true })
  }

  const setReminderForEmail = async (email: any) => {
    if (!email || !email.id) return
    
    // Check if email already has a reminder
    try {
      await window.electronAPI.reminders.hasReminder(email.id)
      // Still allow setting reminder, but it will update the existing one
      // The backend will handle updating instead of creating a duplicate
    } catch (error) {
      console.error('Error checking for existing reminder:', error)
    }

    // Emit event to show reminder modal
    window.dispatchEvent(new CustomEvent('show-reminder-modal', { detail: { email } }))
  }

  const deleteEmailByObject = async (email: any) => {
    if (!email || !email.id) return { success: false }

    // Use the existing deleteEmail function
    return await deleteEmail(email.id)
  }

  return {
    archiveConfirmId,
    archivePopoverRefs,
    archiveArrowRefs,
    archivingEmailId,
    busyEmailIds,
    showArchiveConfirm,
    cancelArchive,
    archiveEmail,
    deleteEmail,
    moveToFolder,
    spamEmail,
    // Email caching functions
    loadEmailContent,
    preloadNearbyEmails,
    clearEmailCache,
    cleanupEmailCache,
    // Email action methods
    composeEmail,
    replyToEmail,
    forwardEmail,
    setReminderForEmail,
    deleteEmailByObject
  }
}

