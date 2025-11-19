<template>
  <div class="thread-tree">
    <div v-if="emails.length === 0" class="text-sm text-gray-500 dark:text-dark-gray-400 p-4 text-center">
      No thread emails
    </div>
    <div v-else class="space-y-2">
      <ThreadTreeNode
        v-if="threadStructure.root"
        :node="threadStructure.root"
        :current-email-id="currentEmailId"
        :expanded-nodes="expandedNodes"
        @select-email="handleEmailClick"
        @toggle-expand="toggleExpand"
      />
      <!-- Handle orphaned emails (emails without parent relationships) -->
      <div v-for="email in orphanedEmails" :key="email.id" class="ml-0">
        <ThreadTreeNode
          :node="getNodeForEmail(email)"
          :current-email-id="currentEmailId"
          :expanded-nodes="expandedNodes"
          @select-email="handleEmailClick"
          @toggle-expand="toggleExpand"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { Email } from '../../shared/types'
import { buildThreadStructure, type ThreadNode } from '../utils/thread-structure'
import ThreadTreeNode from './ThreadTreeNode.vue'

const props = defineProps<{
  emails: Email[]
  currentEmailId?: string
}>()

const emit = defineEmits<{
  'select-email': [emailId: string]
}>()

const expandedNodes = ref<Set<string>>(new Set())

// Build thread structure
const threadStructure = computed(() => {
  return buildThreadStructure(props.emails)
})

// Find orphaned emails (emails not connected to the root)
const orphanedEmails = computed(() => {
  if (!threadStructure.value.root) return []
  
  const rootMessageId = threadStructure.value.root.email.messageId
  const connectedMessageIds = new Set<string>()
  
  // Collect all connected message IDs
  const collectConnected = (node: ThreadNode) => {
    if (node.email.messageId) {
      connectedMessageIds.add(node.email.messageId)
    }
    node.children.forEach(collectConnected)
  }
  
  collectConnected(threadStructure.value.root)
  
  // Find emails not in the connected set
  return props.emails.filter(email => {
    if (!email.messageId) return false
    return !connectedMessageIds.has(email.messageId)
  })
})

const getNodeForEmail = (email: Email): ThreadNode => {
  const node = threadStructure.value.nodes.get(email.messageId || '')
  if (node) return node
  
  // Create a temporary node for orphaned email
  return {
    email,
    children: [],
    depth: 0,
    parent: null
  }
}

const handleEmailClick = (emailId: string) => {
  emit('select-email', emailId)
}

const toggleExpand = (messageId: string) => {
  if (expandedNodes.value.has(messageId)) {
    expandedNodes.value.delete(messageId)
  } else {
    expandedNodes.value.add(messageId)
  }
}

// Auto-expand nodes up to current email
const autoExpandToCurrent = () => {
  if (!props.currentEmailId) return
  
  const currentEmail = props.emails.find(e => e.id === props.currentEmailId)
  if (!currentEmail || !currentEmail.messageId) return
  
  // Expand all ancestors
  let node = threadStructure.value.nodes.get(currentEmail.messageId)
  while (node?.parent) {
    if (node.parent.email.messageId) {
      expandedNodes.value.add(node.parent.email.messageId)
    }
    node = node.parent
  }
}

// Auto-expand on mount or when current email changes
watch(() => props.currentEmailId, () => {
  autoExpandToCurrent()
}, { immediate: true })

onMounted(() => {
  autoExpandToCurrent()
})
</script>

<style scoped>
.thread-tree {
  position: relative;
}
</style>

