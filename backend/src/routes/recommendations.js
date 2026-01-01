import express from 'express';
import { db } from '../config/index.js';

const router = express.Router();

/**
 * Format seconds to HH:MM:SS
 */
function formatTimestamp(seconds) {
  if (!seconds) return null;
  const s = parseInt(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Add video reference fields to recommendation
 */
function enrichRecommendation(rec) {
  const timestamp = parseInt(rec.timestamp_in_video) || 0;
  const youtubeUrl = rec.videos?.youtube_url;

  return {
    ...rec,
    timestamp_formatted: formatTimestamp(timestamp),
    video_link_at_timestamp: youtubeUrl ? `${youtubeUrl}&t=${timestamp}s` : null
  };
}

/**
 * GET /api/recommendations
 * List all recommendations with filters
 * Supports: expert, share, date_from, date_to, action, status, outcome, tag
 */
router.get('/', async (req, res) => {
  try {
    const {
      expert,
      share,
      date_from,
      date_to,
      action,
      status,
      outcome,
      tag,
      limit = 50,
      offset = 0
    } = req.query;

    const { data, count } = await db.getRecommendations({
      expert,
      share,
      dateFrom: date_from,
      dateTo: date_to,
      action,
      status,
      outcome,
      tag,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      recommendations: data.map(enrichRecommendation),
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
 * GET /api/recommendations/tags
 * Get all unique tags with counts
 */
router.get('/tags', async (req, res) => {
  try {
    const tags = await db.getTags();

    res.json({
      tags,
      total: tags.length
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
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
      recommendations: data.map(enrichRecommendation)
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
      'Video Timestamp',
      'Video Link'
    ];

    const rows = data.map(rec => {
      const enriched = enrichRecommendation(rec);
      return [
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
        enriched.timestamp_formatted || '',
        enriched.video_link_at_timestamp || ''
      ];
    });

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
