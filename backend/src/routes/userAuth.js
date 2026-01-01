/**
 * User Authentication Routes (Google OAuth)
 *
 * GET  /api/auth/google          - Initiate Google OAuth
 * GET  /api/auth/google/callback - Google OAuth callback
 * GET  /api/auth/user            - Get current user
 * POST /api/auth/logout          - Logout user
 */

import { Router } from 'express';
import passport from 'passport';

const router = Router();

const logger = {
  info: (msg, data) => console.log(`[USER_AUTH:INFO] ${msg}`, JSON.stringify(data || {})),
  error: (msg, data) => console.error(`[USER_AUTH:ERROR] ${msg}`, JSON.stringify(data || {}))
};

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login?error=auth_failed'
  }),
  (req, res) => {
    // Successful authentication
    logger.info('OAuth callback success', { userId: req.user?.id });

    // Redirect to frontend (dashboard or previous page)
    const redirectTo = req.session?.returnTo || '/dashboard';
    delete req.session?.returnTo;
    res.redirect(redirectTo);
  }
);

/**
 * GET /api/auth/user
 * Get current authenticated user
 */
router.get('/user', (req, res) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.json({ authenticated: false, user: null });
  }

  // Return user info (exclude sensitive fields)
  const user = {
    id: req.user.id,
    email: req.user.email,
    fullName: req.user.full_name,
    profilePicture: req.user.profile_picture_url,
    subscriptionTier: req.user.subscription_tier,
    createdAt: req.user.created_at,
    lastLoginAt: req.user.last_login_at
  };

  res.json({ authenticated: true, user });
});

/**
 * POST /api/auth/logout
 * Logout current user
 */
router.post('/logout', (req, res) => {
  const userId = req.user?.id;

  req.logout((err) => {
    if (err) {
      logger.error('Logout error', { error: err.message, userId });
      return res.status(500).json({ error: 'Logout failed' });
    }

    req.session?.destroy((err) => {
      if (err) {
        logger.error('Session destroy error', { error: err.message });
      }
      res.clearCookie('connect.sid');
      logger.info('User logged out', { userId });
      res.json({ success: true });
    });
  });
});

/**
 * Middleware: Require user authentication
 */
export function requireAuth(req, res, next) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'NOT_AUTHENTICATED'
    });
  }
  next();
}

/**
 * Middleware: Require Pro subscription
 */
export function requirePro(req, res, next) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'NOT_AUTHENTICATED'
    });
  }

  if (req.user.subscription_tier !== 'PRO') {
    return res.status(403).json({
      error: 'Pro subscription required',
      code: 'PRO_REQUIRED'
    });
  }

  next();
}

/**
 * Helper: Get tier limits
 */
export function getTierLimits(tier) {
  const limits = {
    FREE: {
      maxFollows: 5,
      maxWatchlists: 1,
      maxStocksPerWatchlist: 20
    },
    PRO: {
      maxFollows: Infinity,
      maxWatchlists: Infinity,
      maxStocksPerWatchlist: Infinity
    }
  };
  return limits[tier] || limits.FREE;
}

export default router;
