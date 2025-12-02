<template>
  <button
    :data-email-id="email.id"
    :data-email-index="emailGlobalIndex"
    draggable="true"
    @click="(e) => emit('row-click', e, { id: email.id, index: emailGlobalIndex })"
    @dblclick="emit('row-dblclick', { id: email.id })"
    @dragstart="(e) => emit('row-dragstart', e, { email, id: email.id, index: emailGlobalIndex })"
    @dragend="emit('row-dragend')"
    @mouseenter="emit('row-mouseenter', { id: email.id })"
    @mouseleave="emit('row-mouseleave')"
    class="w-full text-left px-4 pt-3 pb-3 my-0.5 transition-all duration-200 rounded-lg relative cursor-grab active:cursor-grabbing group hover:pb-10"
    :class="{
      'bg-primary-900 dark:bg-primary-800 text-white': selected,
      'hover:bg-primary-800/20 dark:hover:bg-primary-900/30': !selected,
      'border-l-2 border-primary-600 dark:border-primary-500': unread,
      'opacity-50': isDragging
    }"
  >
    <span
      class="email-popover-anchor absolute top-1/2 right-3 w-0 h-0 transform -translate-y-1/2 pointer-events-none"
      :data-email-anchor="email.id"
    ></span>
    <div class="flex items-start gap-3">
      <!-- Checked Circle (shown in Archive folder) -->
      <div v-if="isArchiveFolder" class="flex-shrink-0 self-center relative">
        <div
          class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
          :class="selected
            ? 'bg-white dark:bg-white border-white dark:border-white'
            : 'bg-primary-600 dark:bg-primary-500 border-primary-600 dark:border-primary-500'"
          :title="$t('emailList.archived')"
        >
          <svg
            class="w-3 h-3"
            :class="selected ? 'text-primary-600 dark:text-primary-500' : 'text-white'"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      <!-- Archive Button (shown when email is selected) -->
      <div v-else-if="selected" class="flex-shrink-0 self-center relative">
        <button
          @click.stop="emit('show-archive-confirm', { id: email.id })"
          class="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-dark-gray-600 flex items-center justify-center transition-colors hover:border-primary-600 dark:hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-1"
          :class="{
            'bg-primary-600 dark:bg-primary-500 border-primary-600 dark:border-primary-500': archiveConfirmActive,
            'hover:bg-gray-50 dark:hover:bg-dark-gray-700': !archiveConfirmActive
          }"
          :title="$t('email.archiveEmail')"
        >
          <svg v-if="archiveConfirmActive" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </button>

        <!-- Archive Confirmation Popover -->
        <Teleport to="body">
          <div
            v-if="archiveConfirmActive"
            :ref="(el: HTMLElement | null) => setArchivePopoverRef(email.id, el)"
            class="popover-panel fixed z-50 bg-white dark:bg-dark-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-gray-700 p-3 min-w-[220px]"
            @click.stop
          >
            <div
              class="popover-arrow bg-white dark:bg-dark-gray-800 border border-gray-200 dark:border-dark-gray-700 absolute -z-10 -mt-6"
              :ref="(el: HTMLElement | null) => setArchiveArrowRef(email.id, el)"
            ></div>
            <div class="flex items-center gap-2 relative z-10">
              <button @click="emit('cancel-archive')" class="px-3 py-1.5 text-sm rounded bg-gray-200 dark:bg-dark-gray-700 text-gray-700 dark:text-dark-gray-200 hover:bg-gray-300 dark:hover:bg-dark-gray-600 transition-colors">
                {{ $t('common.cancel') }}
              </button>
              <button @click="emit('confirm-archive', { id: email.id })" class="px-3 py-1.5 text-sm rounded bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors w-full">
                {{ $t('common.complete') }}
              </button>
            </div>
          </div>
        </Teleport>
      </div>

      <!-- Email Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-1">
          <div class="flex-1 min-w-0">
            <!-- Sender Name -->
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold truncate" :class="selected
                ? 'text-white'
                : (unread ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-gray-400')">
                {{ email.from[0]?.name || email.from[0]?.address }}
              </span>
              <span v-if="email.encrypted" class="text-xs" :class="selected ? 'text-white/80' : 'text-primary-600'" :title="$t('email.encrypted')">🔒</span>
              <span v-if="email.signed" class="text-xs" :class="selected ? 'text-green-300' : 'text-green-600'" :title="$t('email.signed')">✓</span>
            </div>

            <!-- Subject -->
            <div class="mt-0.5">
              <span class="text-sm text-balance break-words whitespace-normal" :class="selected
                ? 'text-white'
                : (unread ? 'text-gray-900 dark:text-dark-gray-100 font-medium' : 'text-gray-600 dark:text-dark-gray-300')">
                {{ email.subject || '(No subject)' }}
              </span>
            </div>

            <!-- Preview Text -->
            <div v-if="previewLevel > 1 && previewText" class="mt-1 text-xs" :class="[
              previewLevel === 3 ? 'line-clamp-4' : 'line-clamp-2',
              selected ? 'text-white/70' : 'text-gray-500 dark:text-dark-gray-400'
            ]">
              {{ previewText }}
            </div>
          </div>

          <!-- Right Side: Reminder Icon or Time and Status Icons -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Reminder Icon (if email has reminder - active or completed) -->
            <!-- Shows for active reminders (in Reminders folder) and completed reminders (moved back to inbox) -->
            <svg v-if="email.hasReminder" class="w-4 h-4" :class="selected ? 'text-white/80' : 'text-primary-600 dark:text-primary-400'" fill="none" stroke="currentColor" viewBox="0 0 24 24" :title="email.reminderCompleted ? $t('emailList.reminderCompleted') : $t('reminder.reminderSet')">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <!-- Time Display (if no reminder) -->
            <span v-else class="text-xs" :class="selected ? 'text-white/60' : 'text-gray-500 dark:text-dark-gray-400'">
              {{ timeText }}
            </span>

            <!-- Attachment Icon - Always visible when email has attachments -->
            <EmailAttachmentIcon
              :count="email.attachmentCount"
              :selected="selected"
              :title="$t('emailList.hasAttachments')"
            />

            <!-- Status Icons - Show only on hover -->
            <div class="hidden group-hover:flex items-center gap-2 transition-all duration-200">
              <span v-if="email.isStarred" class="text-yellow-500 text-sm" :title="$t('emailList.starred')">★</span>
              <span v-if="email.threadCount && email.threadCount > 1" class="text-xs" :class="isPrimarySelected ? 'text-white/80' : 'text-gray-500 dark:text-dark-gray-400'" :title="$t('emailList.thread')">
                {{ email.threadCount }}
              </span>
              <svg v-if="email.isDraft" class="w-4 h-4" :class="isPrimarySelected ? 'text-white/60' : 'text-gray-400 dark:text-dark-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24" :title="$t('emailList.draft')">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Action Icons - Right aligned, show only on hover, no circles -->
      <div v-if="!isSpamFolder" class="hidden group-hover:flex absolute bottom-2 right-4 items-center gap-2 transition-all duration-200" @click.stop>
        <button @click.stop="emit('archive-selected')" class="p-1 transition-colors" :class="selected
          ? 'text-white/80 hover:text-white'
          : 'text-gray-500 hover:text-gray-700'" :title="$t('navigation.archive')">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </button>
        <button @click.stop="emit('delete-selected')" class="p-1 transition-colors" :class="selected
          ? 'text-white/80 hover:text-white'
          : 'text-gray-500 hover:text-gray-700'" :title="$t('common.delete')">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        <button v-if="email.accountId" @click.stop="emit('reminder-selected')" class="p-1 transition-colors" :class="selected
          ? 'text-white/80 hover:text-white'
          : 'text-gray-500 hover:text-gray-700'" :title="$t('navigation.setReminder')">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button v-if="email.accountId" @click.stop="emit('move-to-aside-selected')" class="p-1 transition-colors" :class="selected
          ? 'text-white/80 hover:text-white'
          : 'text-gray-500 hover:text-gray-700'" :title="$t('emailList.moveToAsideShort')">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </button>
        <button v-if="email.accountId" @click.stop="emit('move-to-folder-selected')" class="p-1 transition-colors" :class="selected
          ? 'text-white/80 hover:text-white'
          : 'text-gray-500 hover:text-gray-700'" :title="$t('navigation.moveToFolder') + ' (M)'
        ">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>
      </div>
      <!-- Un-spam button - Show only in spam/junk folder -->
      <div v-if="isSpamFolder" class="hidden group-hover:flex absolute bottom-2 right-4 items-center gap-2 transition-all duration-200" @click.stop>
        <button v-if="email.accountId" @click.stop="emit('unspam-selected')" class="p-1 transition-colors" :class="selected
          ? 'text-white/80 hover:text-white'
          : 'text-gray-500 hover:text-gray-700'" :title="$t('emailList.moveToInbox')">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import EmailAttachmentIcon from '../email-list/EmailAttachmentIcon.vue'
import type { Email } from './types'

const props = defineProps<{
  email: Email | any
  emailGlobalIndex: number
  selected: boolean
  isArchiveFolder: boolean
  isSpamFolder: boolean
  previewLevel: number
  unread: boolean
  isDragging: boolean
  isPrimarySelected: boolean
  archiveConfirmActive: boolean
  previewText?: string
  timeText: string
  setArchivePopoverRef: (id: string, el: HTMLElement | null) => void
  setArchiveArrowRef: (id: string, el: HTMLElement | null) => void
}>()

const emit = defineEmits<{
  (e: 'row-click', ev: MouseEvent, payload: { id: string; index: number }): void
  (e: 'row-dblclick', payload: { id: string }): void
  (e: 'row-dragstart', ev: DragEvent, payload: { email: Email | any; id: string; index: number }): void
  (e: 'row-dragend'): void
  (e: 'row-mouseenter', payload: { id: string }): void
  (e: 'row-mouseleave'): void
  (e: 'show-archive-confirm', payload: { id: string }): void
  (e: 'cancel-archive'): void
  (e: 'confirm-archive', payload: { id: string }): void
  (e: 'archive-selected'): void
  (e: 'delete-selected'): void
  (e: 'reminder-selected'): void
  (e: 'move-to-aside-selected'): void
  (e: 'move-to-folder-selected'): void
  (e: 'unspam-selected'): void
}>()
</script>
