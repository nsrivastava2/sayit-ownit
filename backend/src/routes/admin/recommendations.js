import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { recommendationValidator, FLAG_MESSAGES } from '../../services/recommendationValidator.js';

const router = express.Router();

// All routes require admin authentication
router.use(adminAuth);

/**
 * GET /api/admin/recommendations/flagged
 * Get all flagged recommendations for review
 */
router.get('/flagged', async (req, res) => {
  try {
    const recommendations = await recommendationValidator.getFlaggedRecommendations();

    // Add human-readable messages for each flag reason
    const enriched = recommendations.map(rec => ({
      ...rec,
      flag_messages: (rec.flag_reasons || []).map(reason => ({
        code: reason,
        message: FLAG_MESSAGES[reason] || reason
      }))
    }));

    res.json({
      recommendations: enriched,
      count: enriched.length
    });
  } catch (error) {
    console.error('Error fetching flagged recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/recommendations/stats
 * Get flag statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await recommendationValidator.getFlagStats();
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching flag stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/recommendations/:id/approve
 * Approve a flagged recommendation (clear the flag)
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    await recommendationValidator.approveRecommendation(id, notes);

    res.json({
      success: true,
      message: 'Recommendation approved'
    });
  } catch (error) {
    console.error('Error approving recommendation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/recommendations/:id
 * Edit a recommendation and clear the flag
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { recommended_price, target_price, stop_loss, action, notes } = req.body;

    const updates = {};
    if (recommended_price !== undefined) updates.recommended_price = recommended_price;
    if (target_price !== undefined) updates.target_price = target_price;
    if (stop_loss !== undefined) updates.stop_loss = stop_loss;
    if (action !== undefined) updates.action = action;

    await recommendationValidator.editRecommendation(id, updates, notes);

    res.json({
      success: true,
      message: 'Recommendation updated and approved'
    });
  } catch (error) {
    console.error('Error updating recommendation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/recommendations/validate-all
 * Re-validate all existing recommendations
 */
router.post('/validate-all', async (req, res) => {
  try {
    const result = await recommendationValidator.validateAllRecommendations();

    res.json({
      success: true,
      message: `Validated ${result.total} recommendations, ${result.flagged} flagged`,
      ...result
    });
  } catch (error) {
    console.error('Error validating recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
