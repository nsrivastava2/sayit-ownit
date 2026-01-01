import express from 'express';
import { db } from '../config/index.js';
import queueService from '../services/queueService.js';
import { adminAuth } from '../middleware/adminAuth.js';
import geminiVideoService from '../services/geminiVideoService.js';

const router = express.Router();

/**
 * GET /api/videos/models
 * Get available Gemini models for analysis
 */
router.get('/models', adminAuth, (req, res) => {
  const models = geminiVideoService.getAvailableModels();
  res.json({ models });
});

/**
 * POST /api/videos/process
 * Start processing a YouTube video
 * Protected: Requires admin authentication
 */
router.post('/process', adminAuth, async (req, res) => {
  try {
    const { youtube_url } = req.body;

    if (!youtube_url) {
      return res.status(400).json({
        error: 'youtube_url is required'
      });
    }

    const result = await queueService.createJob(youtube_url);

    res.json({
      success: true,
      job_id: result.jobId,
      status: result.status,
      message: result.message,
      is_existing: result.isExisting || false
    });
  } catch (error) {
    console.error('Error processing video:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/videos
 * List all videos
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;

    const { data, count } = await db.getVideos({
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      videos: data,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/videos/:id
 * Get video details with transcripts and recommendations
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const video = await db.getVideo(id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const [transcripts, { data: recommendations }] = await Promise.all([
      db.getTranscriptsByVideo(id),
      db.getRecommendations({ limit: 100, offset: 0 })
    ]);

    // Filter recommendations for this video
    const videoRecommendations = recommendations.filter(r => r.video_id === id);

    res.json({
      video,
      transcripts,
      recommendations: videoRecommendations
    });
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/videos/:id/status
 * Get job processing status
 */
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    // Check in-memory job first
    const jobStatus = queueService.getJobStatus(id);
    if (jobStatus) {
      return res.json(jobStatus);
    }

    // Fall back to database
    const video = await db.getVideo(id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({
      id: video.id,
      status: video.status,
      progress: video.status === 'completed' ? 100 : 0,
      currentStep: video.status
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/videos/:id/reprocess
 * Reprocess a video with a specific model
 * Useful when Flash-Lite results are not satisfactory
 */
router.post('/:id/reprocess', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { model = 'flash' } = req.body; // Default to Flash for reprocessing

    // Validate model
    const availableModels = geminiVideoService.getAvailableModels();
    const validModelIds = availableModels.map(m => m.id);
    if (!validModelIds.includes(model)) {
      return res.status(400).json({
        error: `Invalid model. Available: ${validModelIds.join(', ')}`
      });
    }

    // Get video details
    const video = await db.getVideo(id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Delete existing recommendations for this video
    await db.query('DELETE FROM recommendations WHERE video_id = $1', [id]);
    await db.query('DELETE FROM transcripts WHERE video_id = $1', [id]);

    // Reset video status
    await db.updateVideo(id, { status: 'pending', processed_at: null, model_used: null });

    // Create new job with specific model
    const result = await queueService.createJob(video.youtube_url, { modelKey: model });

    res.json({
      success: true,
      message: `Reprocessing started with ${model}`,
      job_id: result.jobId,
      model: model,
      previous_model: video.model_used
    });
  } catch (error) {
    console.error('Error reprocessing video:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/videos/:id
 * Delete a video and its data
 */
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Cancel job if pending
    queueService.cancelJob(id);

    // Delete from database (cascades to transcripts and recommendations)
    await db.query('DELETE FROM videos WHERE id = $1', [id]);

    res.json({ success: true, message: 'Video deleted' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
