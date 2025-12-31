/**
 * Admin Authentication Middleware
 *
 * Validates admin session from httpOnly cookie.
 * Returns 401 if not authenticated or session expired.
 */

import { db } from '../config/index.js';

const logger = {
  info: (msg, data) => console.log(`[AUTH:INFO] ${msg}`, data ? JSON.stringify(data) : ''),
  warn: (msg, data) => console.warn(`[AUTH:WARN] ${msg}`, data ? JSON.stringify(data) : ''),
  error: (msg, data) => console.error(`[AUTH:ERROR] ${msg}`, data ? JSON.stringify(data) : '')
};

export async function adminAuth(req, res, next) {
  const sessionToken = req.cookies?.admin_session;

  logger.info('Auth check', {
    path: req.path,
    hasToken: !!sessionToken,
    ip: req.ip
  });

  if (!sessionToken) {
    logger.warn('No session token', { path: req.path, ip: req.ip });
    return res.status(401).json({
      error: 'Authentication required',
      code: 'NO_SESSION'
    });
  }

  try {
    const session = await db.getAdminSession(sessionToken);

    if (!session) {
      logger.warn('Invalid session token', { ip: req.ip });
      res.clearCookie('admin_session');
      return res.status(401).json({
        error: 'Invalid session',
        code: 'INVALID_SESSION'
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      logger.warn('Expired session', {
        sessionId: session.id,
        expiredAt: session.expires_at
      });
      await db.deleteAdminSession(sessionToken);
      res.clearCookie('admin_session');
      return res.status(401).json({
        error: 'Session expired',
        code: 'SESSION_EXPIRED'
      });
    }

    logger.info('Auth success', { sessionId: session.id });
    req.adminSession = session;
    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error.message });
    return res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
}

export default adminAuth;
