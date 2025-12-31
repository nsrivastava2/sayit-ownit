/**
 * Admin Authentication Routes
 *
 * POST /api/auth/admin-login  - Authenticate with password
 * GET  /api/auth/admin-status - Check authentication status
 * POST /api/auth/admin-logout - Clear session
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../config/index.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = Router();

const logger = {
  info: (msg, data) => console.log(`[AUTH:INFO] ${msg}`, JSON.stringify(data || {})),
  warn: (msg, data) => console.warn(`[AUTH:WARN] ${msg}`, JSON.stringify(data || {})),
  error: (msg, data) => console.error(`[AUTH:ERROR] ${msg}`, JSON.stringify(data || {}))
};

/**
 * POST /api/auth/admin-login
 * Authenticate admin with password
 */
router.post('/admin-login', async (req, res) => {
  const { password } = req.body;
  const ip = req.ip;
  const userAgent = req.get('User-Agent');

  logger.info('Login attempt', { ip });

  if (!password) {
    logger.warn('Login without password', { ip });
    return res.status(400).json({
      error: 'Password required',
      code: 'MISSING_PASSWORD'
    });
  }

  try {
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!passwordHash) {
      logger.error('ADMIN_PASSWORD_HASH not configured');
      return res.status(500).json({
        error: 'Server configuration error',
        code: 'CONFIG_ERROR'
      });
    }

    const isValid = await bcrypt.compare(password, passwordHash);

    if (!isValid) {
      logger.warn('Invalid password attempt', { ip });
      return res.status(401).json({
        error: 'Invalid password',
        code: 'INVALID_PASSWORD'
      });
    }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiryHours = parseInt(process.env.SESSION_EXPIRY_HOURS) || 24;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    await db.createAdminSession({
      session_token: sessionToken,
      expires_at: expiresAt.toISOString(),
      ip_address: ip,
      user_agent: userAgent
    });

    // Set httpOnly cookie
    res.cookie('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: expiryHours * 60 * 60 * 1000
    });

    logger.info('Login successful', { ip });

    return res.json({
      success: true,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    logger.error('Login error', { error: error.message, ip });
    return res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

/**
 * GET /api/auth/admin-status
 * Check if currently authenticated
 */
router.get('/admin-status', async (req, res) => {
  const sessionToken = req.cookies?.admin_session;

  if (!sessionToken) {
    return res.json({ authenticated: false });
  }

  try {
    const session = await db.getAdminSession(sessionToken);

    if (!session || new Date(session.expires_at) < new Date()) {
      return res.json({ authenticated: false });
    }

    return res.json({
      authenticated: true,
      expiresAt: session.expires_at
    });

  } catch (error) {
    logger.error('Status check error', { error: error.message });
    return res.json({ authenticated: false });
  }
});

/**
 * POST /api/auth/admin-logout
 * Clear admin session
 */
router.post('/admin-logout', adminAuth, async (req, res) => {
  const sessionToken = req.cookies?.admin_session;

  try {
    if (sessionToken) {
      await db.deleteAdminSession(sessionToken);
    }

    res.clearCookie('admin_session');
    logger.info('Logout successful', { sessionId: req.adminSession?.id });

    return res.json({ success: true });

  } catch (error) {
    logger.error('Logout error', { error: error.message });
    return res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

export default router;
