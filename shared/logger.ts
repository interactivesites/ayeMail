export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export class Logger {
  private static instance: Logger
  private logLevel: LogLevel = LogLevel.INFO
  private context?: string

  private constructor(context?: string) {
    this.context = context
  }

  static getInstance(context?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(context)
    }
    return Logger.instance
  }

  static create(context?: string): Logger {
    return new Logger(context)
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }

  getLogLevel(): LogLevel {
    return this.logLevel
  }

  private formatMessage(level: string, ...args: unknown[]): unknown[] {
    const timestamp = new Date().toISOString()
    const contextPrefix = this.context ? `[${this.context}]` : ''
    const prefix = `[${timestamp}] [${level}]${contextPrefix}`
    
    return [prefix, ...args]
  }

  debug(...args: unknown[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.debug(...this.formatMessage('DEBUG', ...args))
    }
  }

  info(...args: unknown[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.info(...this.formatMessage('INFO', ...args))
    }
  }

  log(...args: unknown[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.log(...this.formatMessage('LOG', ...args))
    }
  }

  warn(...args: unknown[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(...this.formatMessage('WARN', ...args))
    }
  }

  error(...args: unknown[]): void {
    if (this.logLevel <= LogLevel.ERROR) {
      console.error(...this.formatMessage('ERROR', ...args))
    }
  }
}

// Default logger instance for convenience
export const logger = Logger.getInstance()

