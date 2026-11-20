/**
 * Centralized Structured Logging Utility
 * Ensures consistent log formatting across Server Actions and API Routes.
 */
import { isAbortError } from './error-utils';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private format(level: LogLevel, context: string, message: string, data?: Record<string, unknown>, error?: unknown): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
    };

    if (data) entry.data = data;
    
    if (error) {
      if (isAbortError(error)) {
        entry.error = {
          name: 'AbortError',
          message: 'Operation aborted (expected)',
        };
      } else if (error instanceof Error) {
        entry.error = {
          name: error.name,
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        };
      } else {
        entry.error = { name: 'UnknownError', message: String(error) };
      }
    }

    return JSON.stringify(entry);
  }

  info(context: string, message: string, data?: Record<string, unknown>) {
    console.info(this.format('INFO', context, message, data));
  }

  warn(context: string, message: string, data?: Record<string, unknown>) {
    console.warn(this.format('WARN', context, message, data));
  }

  error(context: string, message: string, data?: Record<string, unknown>, error?: unknown) {
    console.error(this.format('ERROR', context, message, data, error));
  }

  debug(context: string, message: string, data?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.format('DEBUG', context, message, data));
    }
  }
}

export const logger = new Logger();
