import express from 'express';
import { db } from '../config/index.js';
import queueService from '../services/queueService.js';

const router = express.Router();

/**
 * GET /api/stats
 * Get dashboard statistics
 */
router.get('/', async (req, res) => {
  try {
    const stats = await db.getStats();

    // Get top experts
    const experts = await db.getExperts();
    const topExperts = experts.slice(0, 5);

    // Get top shares
    const shares = await db.getShares();
    const topShares = shares.slice(0, 5);

    // Get recent recommendations
    const { data: recentRecommendations } = await db.getRecommendations({
      limit: 5,
      offset: 0
    });

    // Get processing jobs
    const jobs = queueService.getAllJobs();
    const processingJobs = jobs.filter(j => j.status === 'processing' || j.status === 'pending');

    res.json({
      overview: {
        totalVideos: stats.totalVideos,
        completedVideos: stats.completedVideos,
        totalRecommendations: stats.totalRecommendations,
        uniqueExperts: stats.uniqueExperts,
        uniqueShares: stats.uniqueShares
      },
      actionBreakdown: stats.actionCounts,
      topExperts,
      topShares,
      recentRecommendations,
      processingJobs
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stats/jobs
 * Get all processing jobs
 */
router.get('/jobs', async (req, res) => {
  try {
    const jobs = queueService.getAllJobs();

    res.json({
      jobs,
      total: jobs.length
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
