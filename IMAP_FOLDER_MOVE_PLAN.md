# IMAP Folder Moving Implementation Plan

## Overview
This document outlines the plan for implementing email moving functionality to IMAP folders, including a learning mechanism that suggests folders based on sender email addresses.

## Current State

### ✅ Already Implemented
1. **Database Schema**: `sender_folder_mappings` table exists to track sender-to-folder mappings
2. **Move Handler**: `emails:move-to-folder` IPC handler exists and already records learning data
3. **IMAP Client**: `moveEmail()` method exists in `IMAPClient` class
4. **UI Component**: `EmailDropZone.vue` has placeholder for learned folders
5. **Drag & Drop**: Basic drag-and-drop infrastructure is in place

### ❌ Missing Implementation
1. **`folders:get-learned` IPC handler**: Not implemented in `ipc/handlers.ts`
2. **Folder selection UI**: No way to select/choose IMAP folders for moving
3. **Keybinding support**: No keyboard shortcut to trigger folder move

## Proposed Solution

### Phase 1: Complete Learning Infrastructure (Required)

#### 1.1 Implement `folders:get-learned` Handler
**File**: `ipc/handlers.ts`

Add handler to `registerFolderHandlers()`:
```typescript
ipcMain.handle('folders:get-learned', async (_, accountId: string, senderEmail: string) => {
  const db = getDatabase()
  
  // Query sender_folder_mappings for this account and sender
  // Join with folders table to get folder names
  // Order by move_count DESC, last_moved_at DESC
  // Return: Array<{ folderId, folderName, folderPath, moveCount, lastMovedAt }>
})
```

**Purpose**: Retrieve learned folder suggestions for a given sender email address.

#### 1.2 Update EmailDropZone to Load Learned Folders
**File**: `renderer/components/EmailDropZone.vue`

- Already partially implemented (lines 324-345)
- Ensure it properly calls `folders:get-learned` when email is dragged
- Display learned folders as circular drop zones (already implemented)

### Phase 2: Initial Folder Selection Method (Choose One)

#### Option A: Popover with Keybinding (Recommended for MVP)
**Rationale**: 
- Cleaner UX - doesn't clutter the drag-and-drop interface
- Allows browsing/searching all folders, not just learned ones
- Keyboard shortcut ('M') is fast and discoverable
- Can show folder hierarchy

**Implementation**:
1. **New Component**: `MoveToFolderModal.vue` or `MoveToFolderPopover.vue`
   - Triggered by 'M' key when email is selected
   - Shows folder tree (similar to `FolderList.vue`)
   - Search/filter functionality
   - Highlights learned folders
   - Shows move count for learned folders

2. **Keybinding Handler**: Add to `EmailList.vue` or `EmailViewer.vue`
   - Listen for 'M' key when email is selected
   - Open modal/popover
   - Pass selected email and account ID

3. **Move Action**: 
   - Call `emails:moveToFolder(emailId, folderId)`
   - Optimistic UI update (remove from list)
   - Restore on error

**Pros**:
- ✅ Works for all folders, not just learned ones
- ✅ Can show folder hierarchy
- ✅ Searchable/filterable
- ✅ Doesn't interfere with existing drag-and-drop

**Cons**:
- ❌ Requires keyboard interaction (but can add button too)
- ❌ Modal overlay might feel heavy

#### Option B: Enhanced Drag-and-Drop
**Rationale**:
- Consistent with existing drag-and-drop pattern
- Visual and intuitive

**Implementation**:
1. **Expand EmailDropZone**: Add section for "All Folders"
   - Show learned folders first (already implemented)
   - Add expandable section for browsing all folders
   - Or show all folders in a scrollable grid

2. **Folder Selection in Drop Zone**:
   - When dragging over "Folders" zone, show folder picker
   - Could be a nested dropdown or expandable list

**Pros**:
- ✅ Consistent with existing UX
- ✅ Visual feedback

**Cons**:
- ❌ Clutters the drop zone interface
- ❌ Hard to show full folder hierarchy
- ❌ Limited space for many folders

#### Option C: Drag to Sidebar Folders
**Rationale**:
- Most intuitive - drag directly to folder in sidebar
- No modal/popover needed

**Implementation**:
1. **Make FolderList Items Droppable**:
   - Add `@drop` handlers to `FolderTreeItem.vue`
   - Visual feedback when dragging over folder

2. **Move Logic**:
   - Same as other methods - call `emails:moveToFolder`

**Pros**:
- ✅ Most intuitive
- ✅ No extra UI needed
- ✅ Works with existing folder structure

**Cons**:
- ❌ Requires dragging across screen (might be awkward)
- ❌ Hard to see folder hierarchy when dragging

### Phase 3: Learning Mechanism Enhancement

#### 3.1 Learning Algorithm (Already Implemented)
The `emails:move-to-folder` handler already:
- Extracts sender email from `from_addresses`
- Records mapping in `sender_folder_mappings`
- Increments `move_count` for existing mappings
- Updates `last_moved_at` timestamp

#### 3.2 Display Learned Folders
- Show in `EmailDropZone` when dragging (already implemented)
- Show in folder selection modal/popover with visual indicators
- Sort by `move_count DESC, last_moved_at DESC`

#### 3.3 Future Enhancements
- Consider sender domain (not just full email)
- Consider subject keywords
- Consider time-based decay (older moves count less)
- Consider folder hierarchy (suggest parent folders)

## Recommended Implementation Path

### Step 1: Complete Learning Infrastructure
1. ✅ Implement `folders:get-learned` handler
2. ✅ Test learned folder loading in `EmailDropZone`
3. ✅ Verify learning data is recorded correctly

### Step 2: Implement Option A (Popover with Keybinding)
1. ✅ Create `MoveToFolderModal.vue` component
2. ✅ Add keybinding handler ('M' key)
3. ✅ Integrate with email selection
4. ✅ Add button/icon as alternative trigger
5. ✅ Test move functionality

### Step 3: Polish & Enhance
1. ✅ Add visual indicators for learned folders
2. ✅ Add search/filter in folder modal
3. ✅ Add keyboard navigation (arrow keys, enter)
4. ✅ Add loading states
5. ✅ Add error handling

### Step 4: Future Considerations
1. ⏳ Option C (drag to sidebar) as enhancement
2. ⏳ Enhanced learning algorithm
3. ⏳ Folder creation from move dialog
4. ⏳ Batch move multiple emails

## Technical Details

### Database Query for Learned Folders
```sql
SELECT 
  sfm.folder_id,
  f.name as folder_name,
  f.path as folder_path,
  sfm.move_count,
  sfm.last_moved_at
FROM sender_folder_mappings sfm
JOIN folders f ON sfm.folder_id = f.id
WHERE sfm.account_id = ? AND sfm.sender_email = ?
ORDER BY sfm.move_count DESC, sfm.last_moved_at DESC
LIMIT 10
```

### IPC Handler Signature
```typescript
folders:get-learned(accountId: string, senderEmail: string)
  => Promise<Array<{
    folderId: string
    folderName: string
    folderPath: string
    moveCount: number
    lastMovedAt: number
  }>>
```

### Component Props
```typescript
// MoveToFolderModal.vue
interface Props {
  emailId: string
  accountId: string
  senderEmail: string
  visible: boolean
}
```

## UX Considerations

1. **Discoverability**: 
   - Show keyboard shortcut hint in UI
   - Add tooltip/help text
   - Consider adding button in email toolbar

2. **Feedback**:
   - Optimistic UI update (remove email immediately)
   - Loading state during move
   - Success/error notifications
   - Restore email on error

3. **Accessibility**:
   - Keyboard navigation in folder list
   - ARIA labels
   - Focus management

4. **Performance**:
   - Lazy load folder list if large
   - Debounce search input
   - Cache learned folders

## Testing Checklist

- [ ] Learned folders appear in EmailDropZone when dragging
- [ ] Learned folders are sorted correctly (by move count, then date)
- [ ] Moving email records learning data correctly
- [ ] Keybinding 'M' opens folder selection modal
- [ ] Folder selection modal shows all folders
- [ ] Learned folders are highlighted in modal
- [ ] Search/filter works in modal
- [ ] Move operation works correctly
- [ ] Optimistic UI update works
- [ ] Error handling restores email on failure
- [ ] IMAP server move is performed correctly
- [ ] Database is updated correctly

