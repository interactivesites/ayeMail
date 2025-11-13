"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoLockManager = exports.AutoLockManager = void 0;
const electron_1 = require("electron");
class AutoLockManager {
    constructor() {
        this.lockTimer = null;
        this.inactivityTimer = null;
        this.isLocked = false;
        this.lastActivity = Date.now();
        this.lockTimeout = 15 * 60 * 1000; // 15 minutes default
    }
    start() {
        // Reset inactivity timer on user activity
        this.setupActivityListeners();
        // Check for lock periodically
        this.lockTimer = setInterval(() => {
            this.checkLock();
        }, 1000); // Check every second
    }
    stop() {
        if (this.lockTimer) {
            clearInterval(this.lockTimer);
            this.lockTimer = null;
        }
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
    }
    setLockTimeout(minutes) {
        this.lockTimeout = minutes * 60 * 1000;
        this.resetInactivityTimer();
    }
    setupActivityListeners() {
        // Listen for window focus/blur and mouse/keyboard events
        electron_1.app.on('browser-window-focus', () => {
            this.recordActivity();
        });
        // Global mouse and keyboard listeners would be set up per window
        // This is a simplified version
    }
    recordActivity() {
        if (this.isLocked) {
            return; // Don't record activity when locked
        }
        this.lastActivity = Date.now();
        this.resetInactivityTimer();
    }
    resetInactivityTimer() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }
        this.inactivityTimer = setTimeout(() => {
            this.lock();
        }, this.lockTimeout);
    }
    checkLock() {
        const enabled = this.getAutoLockEnabled();
        if (!enabled || this.isLocked) {
            return;
        }
        const timeSinceActivity = Date.now() - this.lastActivity;
        if (timeSinceActivity >= this.lockTimeout) {
            this.lock();
        }
    }
    lock() {
        if (this.isLocked) {
            return;
        }
        this.isLocked = true;
        // Hide all windows or show lock screen
        const windows = electron_1.BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.hide();
            // In a real implementation, you'd show a lock screen window
            // For now, we'll just hide the windows
        });
        // Emit lock event that renderer can listen to
        windows.forEach(window => {
            window.webContents.send('app:locked');
        });
    }
    unlock() {
        if (!this.isLocked) {
            return;
        }
        this.isLocked = false;
        this.lastActivity = Date.now();
        this.resetInactivityTimer();
        // Show windows again
        const windows = electron_1.BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.show();
            window.webContents.send('app:unlocked');
        });
    }
    isAppLocked() {
        return this.isLocked;
    }
    getAutoLockEnabled() {
        // In a real implementation, this would read from settings/preferences
        // For now, check localStorage via main process or use a settings file
        return true; // Default to enabled
    }
}
exports.AutoLockManager = AutoLockManager;
exports.autoLockManager = new AutoLockManager();
