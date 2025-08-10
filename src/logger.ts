/**
 * Structured logging infrastructure for GitHub MCP Server
 * 
 * Provides centralized logging with correlation IDs, log levels,
 * and structured data for better observability.
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogContext {
  correlationId?: string;
  userId?: string;
  tool?: string;
  operation?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Structured logger implementation
 */
export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private correlationIdGenerator: () => string;

  private constructor() {
    // Set log level from environment
    const envLogLevel = process.env.LOG_LEVEL?.toLowerCase();
    if (envLogLevel && Object.values(LogLevel).includes(envLogLevel as LogLevel)) {
      this.logLevel = envLogLevel as LogLevel;
    }

    // Simple correlation ID generator
    this.correlationIdGenerator = () => {
      return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Generate a new correlation ID for request tracking
   */
  public generateCorrelationId(): string {
    return this.correlationIdGenerator();
  }

  /**
   * Set the minimum log level
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get the current log level
   */
  public getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  /**
   * Format and output a log entry
   */
  private log(level: LogLevel, message: string, context: LogContext = {}, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Output to stderr for non-info logs, stdout for info
    const output = level === LogLevel.INFO ? console.log : console.error;
    output(JSON.stringify(entry));
  }

  /**
   * Log debug messages
   */
  public debug(message: string, context: LogContext = {}): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info messages
   */
  public info(message: string, context: LogContext = {}): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning messages
   */
  public warn(message: string, context: LogContext = {}): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error messages
   */
  public error(message: string, context: LogContext = {}, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Create a child logger with additional context
   */
  public child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger that inherits context from parent
 */
export class ChildLogger {
  constructor(
    private parent: Logger,
    private childContext: LogContext
  ) {}

  private mergeContext(context: LogContext = {}): LogContext {
    return { ...this.childContext, ...context };
  }

  public debug(message: string, context: LogContext = {}): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  public info(message: string, context: LogContext = {}): void {
    this.parent.info(message, this.mergeContext(context));
  }

  public warn(message: string, context: LogContext = {}): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  public error(message: string, context: LogContext = {}, error?: Error): void {
    this.parent.error(message, this.mergeContext(context), error);
  }

  public child(context: LogContext): ChildLogger {
    return new ChildLogger(this.parent, this.mergeContext(context));
  }
}

// Export singleton instance
export const logger = Logger.getInstance();