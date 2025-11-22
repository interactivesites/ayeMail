import { BrowserWindow, screen } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { Logger } from '../shared/logger'

const logger = Logger.create('WindowState')

interface WindowState {
  width: number
  height: number
  x: number
  y: number
  isMaximized: boolean
}

const getStateFilePath = (): string => {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'window-state.json')
}

const getDefaultState = (): WindowState => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  return {
    width: 1200,
    height: 800,
    x: Math.floor((width - 1200) / 2),
    y: Math.floor((height - 800) / 2),
    isMaximized: false
  }
}

const validateState = (state: Partial<WindowState>): WindowState | null => {
  if (!state || typeof state.width !== 'number' || typeof state.height !== 'number') {
    return null
  }

  // Check if window would be visible on any display
  const displays = screen.getAllDisplays()
  const minWidth = 960
  const minHeight = 600

  // Validate dimensions
  if (state.width < minWidth || state.height < minHeight) {
    return null
  }

  // If position is provided, validate it
  if (typeof state.x === 'number' && typeof state.y === 'number') {
    const isVisible = displays.some(display => {
      const { x, y, width, height } = display.bounds
      return (
        state.x! >= x - 100 && // Allow some margin for off-screen windows
        state.x! < x + width + 100 &&
        state.y! >= y - 100 &&
        state.y! < y + height + 100
      )
    })

    if (!isVisible) {
      // Position is off-screen, center on primary display
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width: displayWidth, height: displayHeight } = primaryDisplay.workAreaSize
      return {
        width: state.width,
        height: state.height,
        x: Math.floor((displayWidth - state.width) / 2),
        y: Math.floor((displayHeight - state.height) / 2),
        isMaximized: state.isMaximized || false
      }
    }
  }

  return {
    width: state.width,
    height: state.height,
    x: state.x ?? Math.floor((screen.getPrimaryDisplay().workAreaSize.width - state.width) / 2),
    y: state.y ?? Math.floor((screen.getPrimaryDisplay().workAreaSize.height - state.height) / 2),
    isMaximized: state.isMaximized || false
  }
}

export function loadWindowState(): WindowState {
  const stateFilePath = getStateFilePath()
  
  if (!existsSync(stateFilePath)) {
    return getDefaultState()
  }

  try {
    const data = readFileSync(stateFilePath, 'utf-8')
    const state = JSON.parse(data) as Partial<WindowState>
    const validatedState = validateState(state)
    
    return validatedState || getDefaultState()
  } catch (error) {
    logger.error('Error loading window state:', error)
    return getDefaultState()
  }
}

export function saveWindowState(window: BrowserWindow, normalBounds?: { width: number; height: number; x: number; y: number } | null): void {
  if (!window || window.isDestroyed()) {
    return
  }

  try {
    const isMaximized = window.isMaximized()
    
    // Use normal bounds if window is maximized, otherwise use current bounds
    let bounds: { width: number; height: number; x: number; y: number }
    
    if (isMaximized && normalBounds) {
      bounds = normalBounds
    } else {
      const currentBounds = window.getBounds()
      bounds = {
        width: currentBounds.width,
        height: currentBounds.height,
        x: currentBounds.x,
        y: currentBounds.y
      }
    }
    
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized
    }

    const stateFilePath = getStateFilePath()
    writeFileSync(stateFilePath, JSON.stringify(state, null, 2), 'utf-8')
  } catch (error) {
    logger.error('Error saving window state:', error)
  }
}

export function setupWindowStateHandlers(window: BrowserWindow, initialState?: WindowState): void {
  if (!window) {
    return
  }

  // Track normal bounds (non-maximized state)
  // Initialize from saved state if window starts maximized
  let normalBounds: { width: number; height: number; x: number; y: number } | null = 
    (initialState && initialState.isMaximized) 
      ? { width: initialState.width, height: initialState.height, x: initialState.x, y: initialState.y }
      : null

  // Debounce save to avoid excessive writes
  let saveTimeout: NodeJS.Timeout | null = null
  const debouncedSave = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }
    saveTimeout = setTimeout(() => {
      saveWindowState(window, normalBounds)
    }, 500) // Save 500ms after last change
  }

  // Track normal bounds when window is not maximized
  const updateNormalBounds = () => {
    if (!window.isMaximized() && !window.isMinimized()) {
      const bounds = window.getBounds()
      normalBounds = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y
      }
    }
  }

  // Save on move (only if not maximized)
  window.on('moved', () => {
    updateNormalBounds()
    debouncedSave()
  })
  
  // Save on resize (only if not maximized)
  window.on('resized', () => {
    updateNormalBounds()
    debouncedSave()
  })
  
  // Save on maximize/unmaximize
  window.on('maximize', () => {
    // Save normal bounds before maximizing (if we have them)
    if (!normalBounds) {
      updateNormalBounds()
    }
    debouncedSave()
  })
  
  window.on('unmaximize', () => {
    // Update normal bounds after unmaximizing
    setTimeout(() => {
      updateNormalBounds()
      debouncedSave()
    }, 100) // Small delay to ensure bounds are updated
  })
  
  // Save on close
  window.on('close', () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }
    saveWindowState(window, normalBounds)
  })

  // Initialize normal bounds
  if (!window.isMaximized()) {
    updateNormalBounds()
  }
}

