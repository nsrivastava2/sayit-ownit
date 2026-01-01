import express from 'express';
import { db } from '../config/index.js';

const router = express.Router();

/**
 * GET /api/experts
 * List all experts with recommendation counts
 */
router.get('/', async (req, res) => {
  try {
    const experts = await db.getExperts();

    res.json({
      experts,
      total: experts.length
    });
  } catch (error) {
    console.error('Error fetching experts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/experts/:name
 * Get expert details with all their recommendations and profile data
 */
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Fetch expert profile from experts table
    const expertResult = await db.query(
      `SELECT * FROM experts WHERE canonical_name ILIKE $1`,
      [`%${name}%`]
    );
    const expertProfile = expertResult.rows[0] || null;

    const { data, count } = await db.getRecommendations({
      expert: name,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Calculate statistics
    const stats = {
      totalRecommendations: count,
      buyCount: data.filter(r => r.action === 'BUY').length,
      sellCount: data.filter(r => r.action === 'SELL').length,
      holdCount: data.filter(r => r.action === 'HOLD').length,
      avgConfidence: data.length > 0
        ? (data.reduce((sum, r) => sum + (r.confidence_score || 0), 0) / data.length).toFixed(2)
        : 0
    };

    // Get unique shares recommended
    const sharesSet = new Set(data.map(r => r.share_name));

    res.json({
      expert: {
        name: expertProfile?.canonical_name || name,
        stats,
        uniqueShares: sharesSet.size,
        // Profile fields
        profile_picture_url: expertProfile?.profile_picture_url,
        experience_summary: expertProfile?.experience_summary,
        education: expertProfile?.education,
        certifications: expertProfile?.certifications,
        current_associations: expertProfile?.current_associations,
        twitter_handle: expertProfile?.twitter_handle,
        linkedin_url: expertProfile?.linkedin_url,
        youtube_channel: expertProfile?.youtube_channel,
        website_url: expertProfile?.website_url,
        warnings: expertProfile?.warnings,
        enrichment_sources: expertProfile?.enrichment_sources,
        profile_enriched_at: expertProfile?.profile_enriched_at,
        bio: expertProfile?.bio,
        specialization: expertProfile?.specialization
      },
      recommendations: data,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching expert:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/experts/:name/metrics
 * Get expert metrics for the latest calculation date
 */
router.get('/:name/metrics', async (req, res) => {
  try {
    const { name } = req.params;

    // First find the expert by name
    const expertResult = await db.query(
      `SELECT id FROM experts WHERE canonical_name ILIKE $1`,
      [`%${name}%`]
    );

    if (expertResult.rows.length === 0) {
      return res.json({ metrics: null });
    }

    const expertId = expertResult.rows[0].id;

    // Get the latest metrics for this expert
    const metricsResult = await db.query(
      `SELECT * FROM expert_metrics
       WHERE expert_id = $1
       ORDER BY calculation_date DESC
       LIMIT 1`,
      [expertId]
    );

    res.json({
      metrics: metricsResult.rows[0] || null
    });
  } catch (error) {
    console.error('Error fetching expert metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/experts/:name/metrics/history
 * Get historical metrics for performance charts
 */
router.get('/:name/metrics/history', async (req, res) => {
  try {
    const { name } = req.params;
    const { days = 90 } = req.query;

    // First find the expert by name
    const expertResult = await db.query(
      `SELECT id FROM experts WHERE canonical_name ILIKE $1`,
      [`%${name}%`]
    );

    if (expertResult.rows.length === 0) {
      return res.json({ history: [] });
    }

    const expertId = expertResult.rows[0].id;

    // Get historical metrics
    const historyResult = await db.query(
      `SELECT
        calculation_date,
        overall_win_rate,
        last_30d_win_rate,
        avg_return_pct,
        total_recommendations,
        closed_recommendations,
        target_hit_count,
        sl_hit_count,
        rank_position
       FROM expert_metrics
       WHERE expert_id = $1
         AND calculation_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
       ORDER BY calculation_date ASC`,
      [expertId]
    );

    res.json({
      history: historyResult.rows
    });
  } catch (error) {
    console.error('Error fetching expert metrics history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/experts/:name/sectors
 * Get sector-wise performance breakdown
 */
router.get('/:name/sectors', async (req, res) => {
  try {
    const { name } = req.params;

    const sectorsResult = await db.query(
      `SELECT
        COALESCE(s.sector, 'Unknown') as sector,
        COUNT(*) as total_recommendations,
        COUNT(ro.id) FILTER (WHERE ro.outcome_type = 'TARGET_HIT') as wins,
        COUNT(ro.id) FILTER (WHERE ro.outcome_type = 'SL_HIT') as losses,
        COUNT(ro.id) FILTER (WHERE ro.outcome_type = 'EXPIRED') as expired,
        COUNT(ro.id) as closed,
        CASE
          WHEN COUNT(ro.id) FILTER (WHERE ro.outcome_type IN ('TARGET_HIT', 'SL_HIT')) > 0 THEN
            ROUND(
              COUNT(ro.id) FILTER (WHERE ro.outcome_type = 'TARGET_HIT')::numeric * 100 /
              COUNT(ro.id) FILTER (WHERE ro.outcome_type IN ('TARGET_HIT', 'SL_HIT')),
              1
            )
          ELSE NULL
        END as win_rate,
        ROUND(AVG(ro.return_percentage)::numeric, 2) as avg_return
       FROM recommendations r
       LEFT JOIN stocks s ON r.stock_id = s.id
       LEFT JOIN recommendation_outcomes ro ON r.id = ro.recommendation_id
       WHERE r.expert_name ILIKE $1
       GROUP BY COALESCE(s.sector, 'Unknown')
       ORDER BY total_recommendations DESC`,
      [`%${name}%`]
    );

    res.json({
      sectors: sectorsResult.rows
    });
  } catch (error) {
    console.error('Error fetching expert sectors:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/experts/:name/monthly-returns
 * Get monthly return performance
 */
router.get('/:name/monthly-returns', async (req, res) => {
  try {
    const { name } = req.params;
    const { months = 12 } = req.query;

    const monthlyResult = await db.query(
      `SELECT
        TO_CHAR(ro.outcome_date, 'YYYY-MM') as month,
        COUNT(*) as total_closed,
        COUNT(*) FILTER (WHERE ro.outcome_type = 'TARGET_HIT') as wins,
        COUNT(*) FILTER (WHERE ro.outcome_type = 'SL_HIT') as losses,
        ROUND(AVG(ro.return_percentage)::numeric, 2) as avg_return,
        ROUND(SUM(ro.return_percentage)::numeric, 2) as total_return
       FROM recommendations r
       JOIN recommendation_outcomes ro ON r.id = ro.recommendation_id
       WHERE r.expert_name ILIKE $1
         AND ro.outcome_date >= CURRENT_DATE - INTERVAL '${parseInt(months)} months'
       GROUP BY TO_CHAR(ro.outcome_date, 'YYYY-MM')
       ORDER BY month ASC`,
      [`%${name}%`]
    );

    res.json({
      monthlyReturns: monthlyResult.rows
    });
  } catch (error) {
    console.error('Error fetching monthly returns:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
