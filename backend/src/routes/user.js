/**
 * User API Routes (Protected)
 *
 * Following:
 *   GET    /api/user/following           - Get followed experts
 *   POST   /api/user/following/:expertId - Follow an expert
 *   DELETE /api/user/following/:expertId - Unfollow an expert
 *
 * Watchlists:
 *   GET    /api/user/watchlists              - Get user's watchlists
 *   POST   /api/user/watchlists              - Create a watchlist
 *   PUT    /api/user/watchlists/:id          - Update watchlist
 *   DELETE /api/user/watchlists/:id          - Delete watchlist
 *   POST   /api/user/watchlists/:id/stocks   - Add stock to watchlist
 *   DELETE /api/user/watchlists/:id/stocks/:stockId - Remove stock
 *
 * Notifications:
 *   GET    /api/user/notifications           - Get notifications
 *   POST   /api/user/notifications/:id/read  - Mark as read
 *   POST   /api/user/notifications/read-all  - Mark all as read
 *
 * Dashboard:
 *   GET    /api/user/dashboard               - Get personalized dashboard data
 */

import { Router } from 'express';
import { db } from '../config/index.js';
import { requireAuth, getTierLimits } from './userAuth.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ============================================
// Following Experts
// ============================================

/**
 * GET /api/user/following
 * Get list of experts the user is following
 */
router.get('/following', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        uef.id as follow_id,
        uef.followed_at,
        uef.notify_on_new_rec,
        uef.notify_on_outcome,
        e.id as expert_id,
        e.canonical_name,
        e.profile_picture_url,
        e.specialization,
        em.overall_win_rate,
        em.rank_position
      FROM user_expert_following uef
      JOIN experts e ON uef.expert_id = e.id
      LEFT JOIN expert_metrics em ON e.id = em.expert_id
        AND em.calculation_date = (SELECT MAX(calculation_date) FROM expert_metrics)
      WHERE uef.user_id = $1
      ORDER BY uef.followed_at DESC`,
      [req.user.id]
    );

    res.json({
      following: result.rows,
      count: result.rows.length,
      limit: getTierLimits(req.user.subscription_tier).maxFollows
    });
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/following/:expertId
 * Follow an expert
 */
router.post('/following/:expertId', async (req, res) => {
  const { expertId } = req.params;
  const limits = getTierLimits(req.user.subscription_tier);

  try {
    // Check follow limit
    const countResult = await db.query(
      'SELECT COUNT(*) FROM user_expert_following WHERE user_id = $1',
      [req.user.id]
    );

    if (parseInt(countResult.rows[0].count) >= limits.maxFollows) {
      return res.status(403).json({
        error: `Follow limit reached (${limits.maxFollows})`,
        code: 'FOLLOW_LIMIT_REACHED',
        upgradeRequired: req.user.subscription_tier === 'FREE'
      });
    }

    // Check if expert exists
    const expertResult = await db.query(
      'SELECT id, canonical_name FROM experts WHERE id = $1',
      [expertId]
    );

    if (expertResult.rows.length === 0) {
      return res.status(404).json({ error: 'Expert not found' });
    }

    // Follow expert
    const result = await db.query(
      `INSERT INTO user_expert_following (user_id, expert_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, expert_id) DO NOTHING
      RETURNING *`,
      [req.user.id, expertId]
    );

    res.json({
      success: true,
      following: result.rows[0],
      expert: expertResult.rows[0]
    });
  } catch (error) {
    console.error('Error following expert:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/user/following/:expertId
 * Unfollow an expert
 */
router.delete('/following/:expertId', async (req, res) => {
  const { expertId } = req.params;

  try {
    await db.query(
      'DELETE FROM user_expert_following WHERE user_id = $1 AND expert_id = $2',
      [req.user.id, expertId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error unfollowing expert:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Watchlists
// ============================================

/**
 * GET /api/user/watchlists
 * Get user's watchlists with stocks
 */
router.get('/watchlists', async (req, res) => {
  try {
    const watchlistsResult = await db.query(
      `SELECT * FROM user_watchlists WHERE user_id = $1 ORDER BY is_default DESC, created_at`,
      [req.user.id]
    );

    // Get stocks for each watchlist
    const watchlists = await Promise.all(watchlistsResult.rows.map(async (wl) => {
      const stocksResult = await db.query(
        `SELECT
          ws.id as entry_id,
          ws.added_at,
          ws.notes,
          s.id as stock_id,
          s.symbol,
          s.company_name,
          s.sector
        FROM watchlist_stocks ws
        JOIN stocks s ON ws.stock_id = s.id
        WHERE ws.watchlist_id = $1
        ORDER BY ws.added_at DESC`,
        [wl.id]
      );

      return {
        ...wl,
        stocks: stocksResult.rows
      };
    }));

    res.json({
      watchlists,
      count: watchlists.length,
      limit: getTierLimits(req.user.subscription_tier).maxWatchlists
    });
  } catch (error) {
    console.error('Error fetching watchlists:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/watchlists
 * Create a new watchlist
 */
router.post('/watchlists', async (req, res) => {
  const { name } = req.body;
  const limits = getTierLimits(req.user.subscription_tier);

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Watchlist name is required' });
  }

  try {
    // Check watchlist limit
    const countResult = await db.query(
      'SELECT COUNT(*) FROM user_watchlists WHERE user_id = $1',
      [req.user.id]
    );

    if (parseInt(countResult.rows[0].count) >= limits.maxWatchlists) {
      return res.status(403).json({
        error: `Watchlist limit reached (${limits.maxWatchlists})`,
        code: 'WATCHLIST_LIMIT_REACHED',
        upgradeRequired: req.user.subscription_tier === 'FREE'
      });
    }

    const result = await db.query(
      `INSERT INTO user_watchlists (user_id, name)
      VALUES ($1, $2)
      RETURNING *`,
      [req.user.id, name.trim()]
    );

    res.json({ watchlist: result.rows[0] });
  } catch (error) {
    console.error('Error creating watchlist:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/user/watchlists/:id
 * Update a watchlist
 */
router.put('/watchlists/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  try {
    const result = await db.query(
      `UPDATE user_watchlists SET name = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING *`,
      [name, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    res.json({ watchlist: result.rows[0] });
  } catch (error) {
    console.error('Error updating watchlist:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/user/watchlists/:id
 * Delete a watchlist
 */
router.delete('/watchlists/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Don't allow deleting default watchlist
    const checkResult = await db.query(
      'SELECT is_default FROM user_watchlists WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    if (checkResult.rows[0].is_default) {
      return res.status(400).json({ error: 'Cannot delete default watchlist' });
    }

    await db.query(
      'DELETE FROM user_watchlists WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting watchlist:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/watchlists/:id/stocks
 * Add a stock to watchlist
 */
router.post('/watchlists/:id/stocks', async (req, res) => {
  const { id } = req.params;
  const { stockId, notes } = req.body;
  const limits = getTierLimits(req.user.subscription_tier);

  try {
    // Verify watchlist ownership
    const wlResult = await db.query(
      'SELECT id FROM user_watchlists WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (wlResult.rows.length === 0) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    // Check stock limit per watchlist
    const countResult = await db.query(
      'SELECT COUNT(*) FROM watchlist_stocks WHERE watchlist_id = $1',
      [id]
    );

    if (parseInt(countResult.rows[0].count) >= limits.maxStocksPerWatchlist) {
      return res.status(403).json({
        error: `Stock limit reached (${limits.maxStocksPerWatchlist} per watchlist)`,
        code: 'STOCK_LIMIT_REACHED'
      });
    }

    const result = await db.query(
      `INSERT INTO watchlist_stocks (watchlist_id, stock_id, notes)
      VALUES ($1, $2, $3)
      ON CONFLICT (watchlist_id, stock_id) DO UPDATE SET notes = $3
      RETURNING *`,
      [id, stockId, notes || null]
    );

    res.json({ entry: result.rows[0] });
  } catch (error) {
    console.error('Error adding stock to watchlist:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/user/watchlists/:id/stocks/:stockId
 * Remove a stock from watchlist
 */
router.delete('/watchlists/:id/stocks/:stockId', async (req, res) => {
  const { id, stockId } = req.params;

  try {
    // Verify watchlist ownership
    const wlResult = await db.query(
      'SELECT id FROM user_watchlists WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (wlResult.rows.length === 0) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    await db.query(
      'DELETE FROM watchlist_stocks WHERE watchlist_id = $1 AND stock_id = $2',
      [id, stockId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing stock from watchlist:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Notifications
// ============================================

/**
 * GET /api/user/notifications
 * Get user's notifications
 */
router.get('/notifications', async (req, res) => {
  const { unreadOnly = false, limit = 50, offset = 0 } = req.query;

  try {
    let query = `
      SELECT * FROM user_notifications
      WHERE user_id = $1
      ${unreadOnly === 'true' ? 'AND is_read = FALSE' : ''}
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [req.user.id, limit, offset]);

    // Get unread count
    const unreadResult = await db.query(
      'SELECT COUNT(*) FROM user_notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );

    res.json({
      notifications: result.rows,
      unreadCount: parseInt(unreadResult.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/notifications/:id/read
 * Mark a notification as read
 */
router.post('/notifications/:id/read', async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
      `UPDATE user_notifications SET is_read = TRUE, read_at = NOW()
      WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/notifications/read-all
 * Mark all notifications as read
 */
router.post('/notifications/read-all', async (req, res) => {
  try {
    await db.query(
      `UPDATE user_notifications SET is_read = TRUE, read_at = NOW()
      WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Dashboard
// ============================================

/**
 * GET /api/user/dashboard
 * Get personalized dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get followed experts' recent recommendations
    const recentRecsResult = await db.query(
      `SELECT
        r.id,
        r.recommendation_date,
        r.share_name,
        r.nse_symbol,
        r.action,
        r.recommended_price,
        r.target_price,
        r.stop_loss,
        r.expert_name,
        e.profile_picture_url as expert_picture,
        s.sector
      FROM recommendations r
      JOIN user_expert_following uef ON r.expert_name = (
        SELECT canonical_name FROM experts WHERE id = uef.expert_id
      )
      LEFT JOIN experts e ON r.expert_name = e.canonical_name
      LEFT JOIN stocks s ON r.stock_id = s.id
      WHERE uef.user_id = $1
      ORDER BY r.recommendation_date DESC, r.created_at DESC
      LIMIT 20`,
      [userId]
    );

    // Get watchlist alerts (stocks in watchlist that have new recommendations)
    const watchlistAlertsResult = await db.query(
      `SELECT DISTINCT
        r.id,
        r.recommendation_date,
        r.share_name,
        r.nse_symbol,
        r.action,
        r.expert_name,
        r.recommended_price,
        r.target_price,
        uw.name as watchlist_name
      FROM recommendations r
      JOIN watchlist_stocks ws ON r.stock_id = ws.stock_id
      JOIN user_watchlists uw ON ws.watchlist_id = uw.id
      WHERE uw.user_id = $1
        AND r.recommendation_date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY r.recommendation_date DESC
      LIMIT 10`,
      [userId]
    );

    // Get unread notification count
    const unreadResult = await db.query(
      'SELECT COUNT(*) FROM user_notifications WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );

    // Get following count
    const followingResult = await db.query(
      'SELECT COUNT(*) FROM user_expert_following WHERE user_id = $1',
      [userId]
    );

    res.json({
      recentRecommendations: recentRecsResult.rows,
      watchlistAlerts: watchlistAlertsResult.rows,
      unreadNotifications: parseInt(unreadResult.rows[0].count),
      followingCount: parseInt(followingResult.rows[0].count),
      tier: req.user.subscription_tier,
      limits: getTierLimits(req.user.subscription_tier)
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
