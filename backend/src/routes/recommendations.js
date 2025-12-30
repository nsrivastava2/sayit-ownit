import express from 'express';
import { db } from '../config/index.js';

const router = express.Router();

/**
 * GET /api/recommendations
 * List all recommendations with filters
 */
router.get('/', async (req, res) => {
  try {
    const {
      expert,
      share,
      date_from,
      date_to,
      action,
      limit = 50,
      offset = 0
    } = req.query;

    const { data, count } = await db.getRecommendations({
      expert,
      share,
      dateFrom: date_from,
      dateTo: date_to,
      action,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      recommendations: data,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recommendations/by-expert
 * Group recommendations by expert
 */
router.get('/by-expert', async (req, res) => {
  try {
    const experts = await db.getRecommendationsByExpert();

    res.json({
      experts,
      total: experts.length
    });
  } catch (error) {
    console.error('Error fetching recommendations by expert:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recommendations/by-share
 * Group recommendations by share/stock
 */
router.get('/by-share', async (req, res) => {
  try {
    const shares = await db.getRecommendationsByShare();

    res.json({
      shares,
      total: shares.length
    });
  } catch (error) {
    console.error('Error fetching recommendations by share:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recommendations/recent
 * Get recent recommendations
 */
router.get('/recent', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const { data } = await db.getRecommendations({
      limit: parseInt(limit),
      offset: 0
    });

    res.json({
      recommendations: data
    });
  } catch (error) {
    console.error('Error fetching recent recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recommendations/export
 * Export recommendations as CSV
 */
router.get('/export', async (req, res) => {
  try {
    const {
      expert,
      share,
      date_from,
      date_to,
      action
    } = req.query;

    const { data } = await db.getRecommendations({
      expert,
      share,
      dateFrom: date_from,
      dateTo: date_to,
      action,
      limit: 10000,
      offset: 0
    });

    // Generate CSV
    const headers = [
      'Date',
      'Expert',
      'Stock',
      'NSE Symbol',
      'Action',
      'Entry Price',
      'Target Price',
      'Stop Loss',
      'Reason',
      'Confidence',
      'Source Video'
    ];

    const rows = data.map(rec => [
      rec.recommendation_date,
      rec.expert_name,
      rec.share_name,
      rec.nse_symbol || '',
      rec.action,
      rec.recommended_price || '',
      rec.target_price || '',
      rec.stop_loss || '',
      (rec.reason || '').replace(/"/g, '""'),
      rec.confidence_score,
      rec.videos?.youtube_url || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=recommendations.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
