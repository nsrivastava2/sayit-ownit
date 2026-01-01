/**
 * Simple logger utility
 * Wraps console methods with timestamps and log levels
 */

const logger = {
  info: (message, data = {}) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, Object.keys(data).length ? data : '');
  },

  warn: (message, data = {}) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, Object.keys(data).length ? data : '');
  },

  error: (message, data = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, Object.keys(data).length ? data : '');
  },

  debug: (message, data = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, Object.keys(data).length ? data : '');
    }
  }
};

export default logger;
