import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { db, config } from '../config/index.js';
import videoService from './videoService.js';
import geminiVideoService from './geminiVideoService.js';
import youtubeTranscriptService from './youtubeTranscriptService.js';
import { expertService } from './expertService.js';
import { recommendationValidator } from './recommendationValidator.js';

/**
 * Job queue service for processing videos
 * Priority: Gemini URL (≤1hr videos) > YouTube Transcript API + Gemini
 */

// In-memory job store
const jobs = new Map();
const processingQueue = [];
let isProcessing = false;

export const queueService = {
  /**
   * Create a new job for processing a video
   * @param {string} youtubeUrl - YouTube URL
   * @param {Object} options - Optional settings
   * @param {string} options.modelKey - Gemini model to use: 'flash-lite', 'flash', or 'flash-25'
   * @param {boolean} options.skipExistingCheck - Skip check for existing video (for reprocessing)
   */
  async createJob(youtubeUrl, options = {}) {
    const { modelKey, skipExistingCheck = false } = options;

    // Validate URL
    if (!videoService.isValidYouTubeUrl(youtubeUrl)) {
      throw new Error('Invalid YouTube URL');
    }

    // Check if video already exists (unless reprocessing)
    if (!skipExistingCheck) {
      const existingVideo = await db.getVideoByUrl(youtubeUrl);
      if (existingVideo) {
        return {
          jobId: existingVideo.id,
          status: existingVideo.status,
          message: 'Video already exists',
          isExisting: true
        };
      }
    }

    // Get video info from yt-dlp (for metadata)
    console.log('Getting video info...');
    const videoInfo = await videoService.getVideoInfo(youtubeUrl);

    // Parse publish date from yt-dlp format (YYYYMMDD) to YYYY-MM-DD
    let publishDate = null;
    if (videoInfo.uploadDate && videoInfo.uploadDate.length === 8) {
      publishDate = `${videoInfo.uploadDate.slice(0, 4)}-${videoInfo.uploadDate.slice(4, 6)}-${videoInfo.uploadDate.slice(6, 8)}`;
    }

    // Check if video exists (for reprocessing case)
    let video = await db.getVideoByUrl(youtubeUrl);

    if (video) {
      // Update existing video status for reprocessing
      await db.updateVideo(video.id, { status: 'pending' });
    } else {
      // Create video record
      video = await db.createVideo({
        youtube_url: youtubeUrl,
        title: videoInfo.title,
        channel_name: videoInfo.channelName,
        video_type: videoInfo.isLive ? 'live' : 'recorded',
        duration_seconds: videoInfo.duration,
        language: videoInfo.language,
        status: 'pending',
        publish_date: publishDate
      });
    }

    // Create job
    const job = {
      id: video.id,
      videoId: video.id,
      youtubeUrl,
      videoInfo,
      modelKey, // Pass model choice to job
      status: 'pending',
      progress: 0,
      currentStep: 'queued',
      createdAt: new Date(),
      error: null
    };

    jobs.set(job.id, job);
    processingQueue.push(job.id);

    // Start processing if not already
    this.processNextJob();

    return {
      jobId: job.id,
      status: 'pending',
      message: 'Video queued for processing'
    };
  },

  /**
   * Get job status
   */
  getJobStatus(jobId) {
    const job = jobs.get(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      error: job.error,
      videoInfo: job.videoInfo
    };
  },

  /**
   * Process the next job in the queue
   */
  async processNextJob() {
    if (isProcessing || processingQueue.length === 0) {
      return;
    }

    isProcessing = true;
    const jobId = processingQueue.shift();
    const job = jobs.get(jobId);

    if (!job) {
      isProcessing = false;
      this.processNextJob();
      return;
    }

    try {
      await this.processJob(job);
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);
      job.status = 'failed';
      job.error = error.message;
      await db.updateVideo(job.videoId, { status: 'failed' });
    }

    isProcessing = false;
    this.processNextJob();
  },

  /**
   * Process a single job
   * Priority: YouTube Transcript (FREE) > Gemini Video (fallback)
   *
   * Optimized flow:
   * 1. Try YouTube Transcript API first (free, instant if available)
   * 2. If transcript exists → Analyze text with Gemini (cheaper)
   * 3. If no transcript → Fall back to Gemini video analysis
   */
  async processJob(job) {
    console.log(`Processing job ${job.id}: ${job.youtubeUrl}`);

    job.status = 'processing';
    await db.updateVideo(job.videoId, { status: 'processing' });

    let recommendations = [];
    let processingMethod = null;
    const tempDir = path.join(config.processing.tempDir, job.id);

    // Get channel name for channel-specific prompt loading
    const channelName = job.videoInfo?.channelName || null;
    console.log(`Using channel-specific prompt for: ${channelName || 'default'}`);

    // Method 1: Try YouTube Transcript API first (FREE and instant)
    try {
      job.currentStep = 'fetching_transcript';
      job.progress = 10;
      console.log('Checking for available YouTube transcript (free method)...');

      const transcriptData = await youtubeTranscriptService.fetchTranscript(job.youtubeUrl);
      const chunks = youtubeTranscriptService.groupSegmentsIntoChunks(
        transcriptData.segments,
        config.processing.audioChunkSeconds || 30
      );

      console.log(`YouTube Transcript found! ${transcriptData.segments.length} segments, ${chunks.length} chunks`);
      job.progress = 30;

      // Save transcript chunks
      job.currentStep = 'saving_transcript';
      for (const chunk of chunks) {
        await db.createTranscript({
          video_id: job.videoId,
          chunk_index: chunk.chunkIndex,
          start_time_seconds: chunk.startTime,
          end_time_seconds: chunk.endTime,
          transcript_text: chunk.text,
          language_detected: transcriptData.language || 'unknown'
        });
      }

      // Analyze transcript text with Gemini (much cheaper than video)
      job.currentStep = 'analyzing_transcript';
      job.progress = 40;
      console.log('Analyzing transcript with Gemini (text-only, cost-effective)...');

      // Combine chunks into batches for Gemini analysis
      const batchSize = 50; // ~25 minutes per batch
      const allRecommendations = [];

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchText = batch
          .map(c => `[${formatTime(c.startTime)}-${formatTime(c.endTime)}] ${c.text}`)
          .join('\n\n');

        console.log(`Analyzing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}...`);

        try {
          const result = await geminiVideoService.analyzeTranscriptWithGemini(batchText, channelName, job.videoInfo?.title, job.modelKey);
          allRecommendations.push(...result.recommendations);
          job.modelUsed = result.model; // Track which model was used
        } catch (batchError) {
          console.log(`Batch ${Math.floor(i / batchSize) + 1} failed: ${batchError.message}`);
        }

        job.progress = 40 + Math.floor((i / chunks.length) * 40);
      }

      recommendations = deduplicateRecommendations(allRecommendations);
      processingMethod = 'youtube_transcript';

      console.log(`YouTube Transcript + Gemini: Found ${recommendations.length} recommendations`);
      job.progress = 80;

    } catch (ytError) {
      console.log(`YouTube Transcript not available: ${ytError.message}`);
      console.log('Falling back to Gemini video analysis...');

      // Method 2: Gemini Video Analysis (fallback when no transcript)
      const videoDurationMinutes = (job.videoInfo?.duration || 0) / 60;
      const maxUrlMethodDuration = 60; // 1 hour max for URL method

      if (process.env.GEMINI_API_KEY && videoDurationMinutes <= maxUrlMethodDuration) {
        try {
          job.currentStep = 'analyzing_video';
          job.progress = 20;
          console.log(`Using Gemini video analysis... [${Math.round(videoDurationMinutes)} min video]`);

          const result = await geminiVideoService.analyzeYouTubeVideoByUrl(job.youtubeUrl, channelName, job.modelKey);
          recommendations = result.recommendations;
          processingMethod = 'gemini_video';
          job.modelUsed = result.model; // Track which model was used

          console.log(`${result.model}: Found ${recommendations.length} recommendations`);
          job.progress = 80;

        } catch (geminiError) {
          console.log(`Gemini video analysis failed: ${geminiError.message}`);
        }
      } else if (videoDurationMinutes > maxUrlMethodDuration) {
        console.log(`Video too long (${Math.round(videoDurationMinutes)} min) for Gemini video analysis and no transcript available`);
      }
    }

    // Helper function to format time
    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Helper function to deduplicate recommendations
    function deduplicateRecommendations(recs) {
      const seen = new Map();
      for (const rec of recs) {
        const key = `${(rec.share_name || '').toLowerCase()}-${rec.action}`;
        if (!seen.has(key) || rec.confidence_score > seen.get(key).confidence_score) {
          seen.set(key, rec);
        }
      }
      return Array.from(seen.values());
    }

    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    // Check if we got any results
    if (recommendations.length === 0 && !processingMethod) {
      throw new Error('All processing methods failed - no recommendations extracted');
    }

    // Save recommendations to database with expert name resolution
    job.currentStep = 'saving_recommendations';
    job.progress = 90;

    // Get video's publish date for recommendation_date (fallback to today if not available)
    const videoRecord = await db.getVideo(job.videoId);
    let recommendationDate;
    if (videoRecord?.publish_date) {
      // PostgreSQL returns Date in local timezone, use local date methods to avoid UTC shift
      const pubDate = videoRecord.publish_date instanceof Date
        ? videoRecord.publish_date
        : new Date(videoRecord.publish_date);
      // Use local date components to get correct date string
      recommendationDate = `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}-${String(pubDate.getDate()).padStart(2, '0')}`;
    } else {
      const today = new Date();
      recommendationDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    let flaggedCount = 0;
    for (const rec of recommendations) {
      // Resolve expert name using expertService (maps aliases to canonical names)
      const expertResolution = await expertService.resolveExpertName(
        rec.expert_name,
        job.videoId,
        rec.timestamp_seconds
      );

      // Validate recommendation before saving
      const flagReasons = recommendationValidator.validate(rec);
      const isFlagged = flagReasons.length > 0;

      await db.createRecommendation({
        video_id: job.videoId,
        expert_name: expertResolution.name, // Use resolved canonical name
        recommendation_date: recommendationDate,
        share_name: rec.share_name,
        nse_symbol: rec.nse_symbol || geminiVideoService.mapToNSESymbol(rec.share_name),
        action: rec.action,
        recommended_price: rec.recommended_price,
        target_price: rec.target_price,
        stop_loss: rec.stop_loss,
        reason: rec.reason,
        confidence_score: rec.confidence_score,
        timestamp_in_video: rec.timestamp_seconds,
        raw_extract: JSON.stringify(rec),
        is_flagged: isFlagged,
        flag_reasons: isFlagged ? flagReasons : null,
        tags: rec.tags || null,
        timeline: rec.timeline || null
      });

      if (isFlagged) {
        flaggedCount++;
        console.log(`Flagged recommendation: ${rec.share_name} - ${flagReasons.join(', ')}`);
      }

      // Log if this is a new expert (added to pending)
      if (expertResolution.isNew) {
        console.log(`New expert detected: "${rec.expert_name}" - added to pending review`);
      }
    }

    console.log(`Saved ${recommendations.length} recommendations (${flaggedCount} flagged) via ${processingMethod}`);

    // Mark as completed
    job.status = 'completed';
    job.progress = 100;
    job.currentStep = 'completed';
    await db.updateVideo(job.videoId, {
      status: 'completed',
      processed_at: new Date().toISOString(),
      model_used: job.modelUsed || null
    });

    console.log(`Job ${job.id} completed successfully using ${processingMethod} (model: ${job.modelUsed || 'unknown'})`);
  },

  /**
   * Get all jobs
   */
  getAllJobs() {
    return Array.from(jobs.values()).map(job => ({
      id: job.id,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      title: job.videoInfo?.title,
      createdAt: job.createdAt
    }));
  },

  /**
   * Cancel a job
   */
  cancelJob(jobId) {
    const job = jobs.get(jobId);
    if (job && job.status === 'pending') {
      job.status = 'cancelled';
      const index = processingQueue.indexOf(jobId);
      if (index > -1) {
        processingQueue.splice(index, 1);
      }
      return true;
    }
    return false;
  }
};

export default queueService;
