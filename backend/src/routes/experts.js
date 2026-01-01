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

export default router;
