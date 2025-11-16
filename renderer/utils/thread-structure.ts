import type { Email } from '../../shared/types'

export interface ThreadNode {
  email: Email
  children: ThreadNode[]
  depth: number
  parent: ThreadNode | null
}

export interface ThreadStructure {
  root: ThreadNode | null
  nodes: Map<string, ThreadNode>
  flatList: ThreadNode[]
}

/**
 * Builds a hierarchical thread structure from a flat list of emails
 * Uses inReplyTo and references fields to determine parent-child relationships
 */
export function buildThreadStructure(emails: Email[]): ThreadStructure {
  if (emails.length === 0) {
    return {
      root: null,
      nodes: new Map(),
      flatList: []
    }
  }

  // Create a map of messageId -> email for quick lookup
  const emailMap = new Map<string, Email>()
  emails.forEach(email => {
    if (email.messageId) {
      emailMap.set(email.messageId, email)
    }
  })

  // Create nodes for all emails
  const nodes = new Map<string, ThreadNode>()
  emails.forEach(email => {
    if (!email.messageId) return
    
    nodes.set(email.messageId, {
      email,
      children: [],
      depth: 0,
      parent: null
    })
  })

  // Build parent-child relationships
  let rootNode: ThreadNode | null = null
  
  emails.forEach(email => {
    if (!email.messageId) return
    
    const node = nodes.get(email.messageId)
    if (!node) return

    // Find parent using inReplyTo or references
    let parentMessageId: string | undefined
    
    if (email.inReplyTo) {
      // Direct reply - use inReplyTo
      parentMessageId = email.inReplyTo
    } else if (email.references && email.references.length > 0) {
      // Use the last reference (most immediate parent) or first (root)
      // RFC 5322: references chain goes from root to immediate parent
      // Last reference is usually the immediate parent
      parentMessageId = email.references[email.references.length - 1]
    }

    if (parentMessageId && nodes.has(parentMessageId)) {
      const parentNode = nodes.get(parentMessageId)!
      parentNode.children.push(node)
      node.parent = parentNode
    } else {
      // This is a root email (no parent found)
      if (!rootNode || email.date < rootNode.email.date) {
        rootNode = node
      }
    }
  })

  // If no root found by relationships, use the oldest email
  if (!rootNode && nodes.size > 0) {
    const sortedEmails = Array.from(nodes.values())
      .sort((a, b) => a.email.date - b.email.date)
    rootNode = sortedEmails[0]
  }

  // Calculate depths starting from root
  if (rootNode) {
    calculateDepths(rootNode, 0)
  } else {
    // Fallback: if we can't find a root, treat all as depth 0
    nodes.forEach(node => {
      node.depth = 0
    })
  }

  // Sort children chronologically within each level
  nodes.forEach(node => {
    node.children.sort((a, b) => a.email.date - b.email.date)
  })

  // Build flat list sorted chronologically
  const flatList = Array.from(nodes.values())
    .sort((a, b) => a.email.date - b.email.date)

  return {
    root: rootNode,
    nodes,
    flatList
  }
}

/**
 * Recursively calculate depth for all nodes in the tree
 */
function calculateDepths(node: ThreadNode, depth: number): void {
  node.depth = depth
  node.children.forEach(child => {
    calculateDepths(child, depth + 1)
  })
}

/**
 * Get all descendants of a node (including the node itself)
 */
export function getAllDescendants(node: ThreadNode): ThreadNode[] {
  const result: ThreadNode[] = [node]
  node.children.forEach(child => {
    result.push(...getAllDescendants(child))
  })
  return result
}

/**
 * Find the root email in a thread structure
 */
export function findRootEmail(structure: ThreadStructure): Email | null {
  return structure.root?.email || null
}

/**
 * Get the path from root to a specific email
 */
export function getPathToEmail(structure: ThreadStructure, messageId: string): ThreadNode[] {
  const node = structure.nodes.get(messageId)
  if (!node) return []

  const path: ThreadNode[] = []
  let current: ThreadNode | null = node
  
  // Walk up to root
  while (current) {
    path.unshift(current)
    current = current.parent
  }
  
  return path
}

/**
 * Get siblings of an email (emails with the same parent)
 */
export function getSiblings(structure: ThreadStructure, messageId: string): ThreadNode[] {
  const node = structure.nodes.get(messageId)
  if (!node || !node.parent) return []

  return node.parent.children.filter(child => child.email.messageId !== messageId)
}

/**
 * Check if an email is a root email
 */
export function isRootEmail(structure: ThreadStructure, messageId: string): boolean {
  return structure.root?.email.messageId === messageId
}

