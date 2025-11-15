import { app, BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import { join } from 'path'
import { registerAllHandlers } from '../ipc/handlers'
import { getDatabase } from '../database'
import { reminderScheduler } from '../reminders/scheduler'
import { autoLockManager } from '../security/auto-lock'

// In CommonJS, __dirname is automatically available
// TypeScript needs this declaration for type checking, but it won't be emitted
declare const __dirname: string

let mainWindow: BrowserWindow | null = null
const composeWindows = new Set<BrowserWindow>()
const isMac = process.platform === 'darwin'

function createWindow() {
  const windowOptions: BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: isMac ? true : false,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    backgroundColor: isMac ? '#00000000' : '#0f172a',
    transparent: isMac,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  }

  if (isMac) {
    Object.assign(windowOptions, {
      trafficLightPosition: { x: 16, y: 18 },
      titleBarOverlay: {
        color: '#00000000',
        symbolColor: '#0f172a',
        height: 56
      },
      vibrancy: 'under-window',
      visualEffectState: 'active'
    })
  }

  mainWindow = new BrowserWindow(windowOptions)

  if (isMac) {
    mainWindow.setVibrancy('under-window')
    mainWindow.setBackgroundColor('#00000000')
  }

  // Always use dev server in development, fallback to file in production
  // In dev mode, NODE_ENV is not set or is 'development', and app is not packaged
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development'
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = join(__dirname, '../dist/index.html')
    mainWindow.loadFile(indexPath)
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

  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development'
  
  if (isDev) {
    composeWindow.loadURL(`http://localhost:5173?compose=true&accountId=${accountId}`)
  } else {
    const indexPath = join(__dirname, '../dist/index.html')
    composeWindow.loadFile(indexPath, { query: { compose: 'true', accountId } })
  }
  
  // Send replyTo data via IPC after window loads
  composeWindow.webContents.once('did-finish-load', () => {
    if (replyTo) {
      composeWindow?.webContents.send('compose:reply-data', replyTo)
    }
  })

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
        const result = contactManager.extractContactsFromExistingEmails()
        console.log(`Extracted ${result.extracted} contacts from existing emails`)
      } catch (error) {
        console.error('Error extracting contacts from existing emails:', error)
      }
    }, 2000) // Delay to not block app startup
  }
  
  // Start reminder scheduler
  reminderScheduler.start()
  
  // Start auto-lock manager
  autoLockManager.start()
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})


