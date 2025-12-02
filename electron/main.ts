// Load environment variables from .env file
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../../.env') })

import { app, BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import { join } from 'path'
import { registerAllHandlers } from '../ipc/handlers'
import { getDatabase } from '../database'
import { reminderScheduler } from '../reminders/scheduler'
import { autoLockManager } from '../security/auto-lock'
import { autoSyncScheduler } from '../email/auto-sync'
import { loadWindowState, setupWindowStateHandlers } from './window-state'
import { Logger } from '../shared/logger'

const logger = Logger.create('Main')

// Handle uncaught exceptions and unhandled promise rejections
// This prevents the app from crashing on network errors like ETIMEDOUT
process.on('uncaughtException', (error: Error) => {
  // Suppress ETIMEDOUT and other network timeout errors
  const errorCode = (error as any).code
  if (error.message?.includes('ETIMEDOUT') || 
      error.message?.includes('timeout') ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ECONNRESET' ||
      errorCode === 'ECONNREFUSED') {
    logger.warn('Suppressed network timeout error:', error.message)
    return
  }
  
  // Log other uncaught exceptions but don't crash
  logger.error('Uncaught exception:', error)
})

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  // Suppress ETIMEDOUT and other network timeout errors
  const errorMessage = reason?.message || String(reason)
  const errorCode = reason?.code
  
  if (errorMessage?.includes('ETIMEDOUT') || 
      errorMessage?.includes('timeout') ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ECONNRESET' ||
      errorCode === 'ECONNREFUSED') {
    logger.warn('Suppressed unhandled promise rejection (network timeout):', errorMessage)
    return
  }
  
  // Log other unhandled rejections but don't crash
  logger.error('Unhandled promise rejection:', reason)
})

// In CommonJS, __dirname is automatically available
// TypeScript needs this declaration for type checking, but it won't be emitted
declare const __dirname: string

let mainWindow: BrowserWindow | null = null
const composeWindows = new Set<BrowserWindow>()
const emailViewerWindows = new Set<BrowserWindow>()
const isMac = process.platform === 'darwin'

function createWindow() {
  // Load saved window state
  const savedState = loadWindowState()
  
  const windowOptions: BrowserWindowConstructorOptions = {
    width: savedState.width,
    height: savedState.height,
    x: savedState.x,
    y: savedState.y,
    minWidth: 960,
    minHeight: 600,
    frame: false, // No frame on all platforms - using custom controls
    backgroundColor: isMac ? '#00000000' : '#0f172a',
    transparent: isMac,
    show: false, // Don't show until ready
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  }

  if (isMac) {
    Object.assign(windowOptions, {
      vibrancy: 'under-window',
      visualEffectState: 'active'
    })
  }

  mainWindow = new BrowserWindow(windowOptions)

  if (isMac) {
    mainWindow.setVibrancy('under-window')
    mainWindow.setBackgroundColor('#00000000')
  }

  // Setup window state persistence handlers (pass initial state for normal bounds tracking)
  setupWindowStateHandlers(mainWindow, savedState)

  // Prevent white/black flash during load
  mainWindow.once('ready-to-show', () => {
    // Restore maximized state after window is ready
    if (savedState.isMaximized) {
      mainWindow?.maximize()
    }
    mainWindow?.show()
  })

  // Fallback: Show window after 5 seconds even if ready-to-show doesn't fire
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
    }
  }, 5000)

  // Always use dev server in development, fallback to file in production
  // Only check app.isPackaged - this is the most reliable indicator
  const isDev = !app.isPackaged
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // In production, __dirname is in dist-electron/electron/, so we need to go up two levels
    const appPath = app.getAppPath()
    const indexPath = join(appPath, 'dist', 'index.html')
    
    mainWindow.loadFile(indexPath).catch((err) => {
      logger.error('Failed to load index.html:', err)
      // Fallback path
      const fallbackPath = join(__dirname, '../../dist/index.html')
      mainWindow.loadFile(fallbackPath).catch((fallbackErr) => {
        logger.error('Fallback also failed:', fallbackErr)
        // Show window anyway so user can see error
        mainWindow?.show()
      })
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createComposeWindow(accountId: string, replyTo?: any) {
  const windowOptions: BrowserWindowConstructorOptions = {
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    frame: false,
    backgroundColor: isMac ? '#00000000' : '#ffffff',
    transparent: isMac,
    show: false, // Don't show until ready
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  }

  if (isMac) {
    Object.assign(windowOptions, {
      vibrancy: 'under-window',
      visualEffectState: 'active'
    })
  }

  const composeWindow = new BrowserWindow(windowOptions)
  composeWindows.add(composeWindow)

  if (isMac) {
    composeWindow.setVibrancy('under-window')
    composeWindow.setBackgroundColor('#00000000')
  }

  // Show window immediately for faster perceived performance
  composeWindow.show()

  // Prevent navigation to file:// URLs (prevents opening files when dragged)
  composeWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) {
      event.preventDefault()
    }
  })

  // Prevent new window from opening files
  composeWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  // Store compose data in window
  ;(composeWindow as any).composeData = { accountId, replyTo }

  const isDev = !app.isPackaged
  
  if (isDev) {
    composeWindow.loadURL(`http://localhost:5173?compose=true&accountId=${accountId}`)
  } else {
    const indexPath = join(app.getAppPath(), 'dist', 'index.html')
    composeWindow.loadFile(indexPath, { query: { compose: 'true', accountId } }).catch((err) => {
      logger.error('Failed to load index.html:', err)
      const fallbackPath = join(__dirname, '../../dist/index.html')
      composeWindow.loadFile(fallbackPath, { query: { compose: 'true', accountId } })
    })
  }

  composeWindow.on('closed', () => {
    composeWindows.delete(composeWindow)
  })
  
  return composeWindow
}

export function getComposeWindow() {
  // Return the most recently focused compose window, or first one if none focused
  const focused = BrowserWindow.getFocusedWindow()
  if (focused && composeWindows.has(focused)) {
    return focused
  }
  return composeWindows.size > 0 ? Array.from(composeWindows)[0] : null
}

export function getAllComposeWindows(): BrowserWindow[] {
  return Array.from(composeWindows)
}

export { createComposeWindow }

function createEmailViewerWindow(emailId: string) {
  const windowOptions: BrowserWindowConstructorOptions = {
    width: 1000,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: isMac ? '#00000000' : '#ffffff',
    transparent: isMac,
    show: false, // Don't show until ready
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  }

  if (isMac) {
    Object.assign(windowOptions, {
      vibrancy: 'under-window',
      visualEffectState: 'active'
    })
  }

  const emailViewerWindow = new BrowserWindow(windowOptions)
  emailViewerWindows.add(emailViewerWindow)

  if (isMac) {
    emailViewerWindow.setVibrancy('under-window')
    emailViewerWindow.setBackgroundColor('#00000000')
  }

  // Prevent white/black flash during load
  emailViewerWindow.once('ready-to-show', () => {
    emailViewerWindow.show()
  })

  // Prevent navigation to file:// URLs
  emailViewerWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) {
      event.preventDefault()
    }
  })

  // Prevent new window from opening files
  emailViewerWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  // Store email ID in window
  ;(emailViewerWindow as any).emailId = emailId

  const isDev = !app.isPackaged
  
  if (isDev) {
    emailViewerWindow.loadURL(`http://localhost:5173?emailViewer=true&emailId=${emailId}`)
  } else {
    const indexPath = join(app.getAppPath(), 'dist', 'index.html')
    emailViewerWindow.loadFile(indexPath, { query: { emailViewer: 'true', emailId } }).catch((err) => {
      logger.error('Failed to load index.html:', err)
      const fallbackPath = join(__dirname, '../../dist/index.html')
      emailViewerWindow.loadFile(fallbackPath, { query: { emailViewer: 'true', emailId } })
    })
  }

  emailViewerWindow.on('closed', () => {
    emailViewerWindows.delete(emailViewerWindow)
  })
  
  return emailViewerWindow
}

export { createEmailViewerWindow }

app.whenReady().then(async () => {
  // Initialize database
  getDatabase()
  
  // Register IPC handlers
  registerAllHandlers()
  
  // Extract contacts from existing emails (one-time, runs in background)
  // Check if recipients table has any data, if not, extract from emails
  const { contactManager } = await import('../email/contact-manager')
  const db = getDatabase()
  const recipientCount = db.prepare('SELECT COUNT(*) as count FROM recipients').get() as { count: number }
  if (recipientCount.count === 0) {
    // Run extraction in background
    setTimeout(() => {
      try {
        contactManager.extractContactsFromExistingEmails()
      } catch (error) {
        logger.error('Error extracting contacts from existing emails:', error)
      }
    }, 2000) // Delay to not block app startup
  }
  
  // Start reminder scheduler
  reminderScheduler.start()
  
  // Start auto-lock manager
  autoLockManager.start()
  
  createWindow()
  
  // Start auto-sync after window is created (wait 2 seconds for window to be ready)
  setTimeout(() => {
    const mainWin = BrowserWindow.getAllWindows()[0]
    if (mainWin) {
      reminderScheduler.setMainWindow(mainWin)
      autoSyncScheduler.setMainWindow(mainWin)
      // Check if auto-sync is enabled (default 5 minutes)
      const autoSyncEnabled = mainWin.webContents.executeJavaScript(
        `localStorage.getItem('autoSyncEnabled') !== 'false'`
      )
      const autoSyncInterval = mainWin.webContents.executeJavaScript(
        `parseInt(localStorage.getItem('autoSyncInterval') || '5', 10)`
      )
      
      Promise.all([autoSyncEnabled, autoSyncInterval]).then(([enabled, interval]) => {
        if (enabled) {
          logger.log(`Starting auto-sync with ${interval} minute interval`)
          autoSyncScheduler.start(interval)
        } else {
          logger.log('Auto-sync disabled in settings')
        }
      })
    }
  }, 2000)

  app.on('activate', () => {
    // On macOS, re-create window if all windows are closed
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      // If windows exist but are hidden, show and focus the main window
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore()
        }
        if (!mainWindow.isVisible()) {
          mainWindow.show()
        }
        mainWindow.focus()
      } else {
        // Main window reference lost, find and restore it
        const windows = BrowserWindow.getAllWindows()
        if (windows.length > 0) {
          const firstWindow = windows[0]
          if (firstWindow.isMinimized()) {
            firstWindow.restore()
          }
          if (!firstWindow.isVisible()) {
            firstWindow.show()
          }
          firstWindow.focus()
          // Update mainWindow reference
          mainWindow = firstWindow
        }
      }
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})


