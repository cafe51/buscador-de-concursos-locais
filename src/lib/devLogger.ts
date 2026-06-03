import { EventEmitter } from 'events';

export type LogType = 'log' | 'info' | 'warn' | 'error';

export interface LogMessage {
  id: string;
  type: LogType;
  args: any[];
  timestamp: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __DEV_LOGGER_EMITTER: EventEmitter | undefined;
  // eslint-disable-next-line no-var
  var __DEV_LOGGER_HISTORY: LogMessage[] | undefined;
  // eslint-disable-next-line no-var
  var __DEV_LOGGER_PATCHED: boolean | undefined;
}

export const getDevEmitter = (): EventEmitter => {
  if (!global.__DEV_LOGGER_EMITTER) {
    global.__DEV_LOGGER_EMITTER = new EventEmitter();
    global.__DEV_LOGGER_EMITTER.setMaxListeners(50);
  }
  return global.__DEV_LOGGER_EMITTER;
};

export const getDevHistory = (): LogMessage[] => {
  if (!global.__DEV_LOGGER_HISTORY) {
    global.__DEV_LOGGER_HISTORY = [];
  }
  return global.__DEV_LOGGER_HISTORY;
};

export const initDevLogger = () => {
  if (process.env.NODE_ENV !== 'development' || typeof window !== 'undefined') return;
  if (global.__DEV_LOGGER_PATCHED) return;

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  const emitter = getDevEmitter();
  const history = getDevHistory();

  const emitLog = (type: LogType, ...args: any[]) => {
    const parsedArgs = args.map(arg => {
      if (arg instanceof Error) {
        return arg.stack || arg.message;
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return '[Unserializable Object]';
        }
      }
      return String(arg);
    });

    const message: LogMessage = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      args: parsedArgs,
      timestamp: new Date().toISOString()
    };

    history.push(message);
    if (history.length > 200) {
      history.shift(); // Keep last 200 logs
    }

    emitter.emit('log', message);
  };

  console.log = (...args: any[]) => {
    originalLog.apply(console, args as [any, ...any[]]);
    emitLog('log', ...args);
  };

  console.info = (...args: any[]) => {
    originalInfo.apply(console, args as [any, ...any[]]);
    emitLog('info', ...args);
  };

  console.warn = (...args: any[]) => {
    originalWarn.apply(console, args as [any, ...any[]]);
    emitLog('warn', ...args);
  };

  console.error = (...args: any[]) => {
    originalError.apply(console, args as [any, ...any[]]);
    emitLog('error', ...args);
  };

  global.__DEV_LOGGER_PATCHED = true;
};
