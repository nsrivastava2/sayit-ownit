import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { db, config } from '../config/index.js';
import videoService from './videoService.js';
import geminiVideoService from './geminiVideoService.js';
import youtubeTranscriptService from './youtubeTranscriptService.js';
import { expertService } from './expertService.js';

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
   */
  async createJob(youtubeUrl) {
    // Validate URL
    if (!videoService.isValidYouTubeUrl(youtubeUrl)) {
      throw new Error('Invalid YouTube URL');
    }

    // Check if video already exists
    const existingVideo = await db.getVideoByUrl(youtubeUrl);
    if (existingVideo) {
      return {
        jobId: existingVideo.id,
        status: existingVideo.status,
        message: 'Video already exists',
        isExisting: true
      };
    }

    // Get video info from yt-dlp (for metadata)
    console.log('Getting video info...');
    const videoInfo = await videoService.getVideoInfo(youtubeUrl);

    // Create video record
    const video = await db.createVideo({
      youtube_url: youtubeUrl,
      title: videoInfo.title,
      channel_name: videoInfo.channelName,
      video_type: videoInfo.isLive ? 'live' : 'recorded',
      duration_seconds: videoInfo.duration,
      language: videoInfo.language,
      status: 'pending'
    });

    // Create job
    const job = {
      id: video.id,
      videoId: video.id,
      youtubeUrl,
      videoInfo,
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
   * Priority: Gemini Flash (direct video) > YouTube API + LLM > Groq Whisper + LLM
   */
  async processJob(job) {
    console.log(`Processing job ${job.id}: ${job.youtubeUrl}`);

    job.status = 'processing';
    await db.updateVideo(job.videoId, { status: 'processing' });

    let recommendations = [];
    let processingMethod = null;
    const tempDir = path.join(config.processing.tempDir, job.id);

    // Method 1: Try Gemini URL-based analysis (fastest - no download needed)
    // Only for videos under 1 hour (token limit ~1 million ≈ 1-2 hours video)
    const videoDurationMinutes = (job.videoInfo?.duration || 0) / 60;
    const maxUrlMethodDuration = 60; // 1 hour max for URL method

    // Get channel name for channel-specific prompt loading
    const channelName = job.videoInfo?.channelName || null;

    if (process.env.GEMINI_API_KEY && videoDurationMinutes <= maxUrlMethodDuration) {
      try {
        job.currentStep = 'analyzing_gemini_url';
        job.progress = 10;
        console.log(`Trying Gemini URL-based video analysis (Gemini 2.5 Flash)... [${Math.round(videoDurationMinutes)} min video]`);
        console.log(`Using channel-specific prompt for: ${channelName || 'default'}`);

        const result = await geminiVideoService.analyzeYouTubeVideoByUrl(job.youtubeUrl, channelName);
        recommendations = result.recommendations;
        processingMethod = 'gemini_url';

        console.log(`Gemini URL: Found ${recommendations.length} recommendations`);
        job.progress = 80;

      } catch (geminiUrlError) {
        console.log(`Gemini URL method failed: ${geminiUrlError.message}`);
        console.log('Falling back to YouTube Transcript + Gemini...');
      }
    } else if (videoDurationMinutes > maxUrlMethodDuration) {
      console.log(`Video too long (${Math.round(videoDurationMinutes)} min) for Gemini URL method, using YouTube Transcript + Gemini...`);
    }

    // Method 2: YouTube Transcript API + Gemini (primary for long videos, fallback for short)
    if (recommendations.length === 0) {
      try {
        job.currentStep = 'fetching_transcript';
        job.progress = 15;
        console.log('Trying YouTube Transcript API...');

        const transcriptData = await youtubeTranscriptService.fetchTranscript(job.youtubeUrl);
        const chunks = youtubeTranscriptService.groupSegmentsIntoChunks(
          transcriptData.segments,
          config.processing.audioChunkSeconds || 30
        );

        console.log(`YouTube API: Got ${transcriptData.segments.length} segments, grouped into ${chunks.length} chunks`);
        job.progress = 40;

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

        // Analyze with Gemini
        job.currentStep = 'analyzing_gemini';
        job.progress = 50;
        console.log('Analyzing transcript with Gemini...');

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
            const batchRecs = await geminiVideoService.analyzeTranscriptWithGemini(batchText, channelName);
            allRecommendations.push(...batchRecs);
          } catch (batchError) {
            console.log(`Batch ${Math.floor(i / batchSize) + 1} failed: ${batchError.message}`);
          }

          job.progress = 50 + Math.floor((i / chunks.length) * 30);
        }

        recommendations = deduplicateRecommendations(allRecommendations);
        processingMethod = 'youtube_api_gemini';

        console.log(`YouTube + Gemini: Found ${recommendations.length} recommendations`);
        job.progress = 80;

      } catch (ytError) {
        console.log(`YouTube API failed: ${ytError.message}`);
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
    const today = new Date().toISOString().split('T')[0];

    for (const rec of recommendations) {
      // Resolve expert name using expertService (maps aliases to canonical names)
      const expertResolution = await expertService.resolveExpertName(
        rec.expert_name,
        job.videoId,
        rec.timestamp_seconds
      );

      await db.createRecommendation({
        video_id: job.videoId,
        expert_name: expertResolution.name, // Use resolved canonical name
        recommendation_date: today,
        share_name: rec.share_name,
        nse_symbol: rec.nse_symbol || geminiVideoService.mapToNSESymbol(rec.share_name),
        action: rec.action,
        recommended_price: rec.recommended_price,
        target_price: rec.target_price,
        stop_loss: rec.stop_loss,
        reason: rec.reason,
        confidence_score: rec.confidence_score,
        timestamp_in_video: rec.timestamp_seconds,
        raw_extract: JSON.stringify(rec)
      });

      // Log if this is a new expert (added to pending)
      if (expertResolution.isNew) {
        console.log(`New expert detected: "${rec.expert_name}" - added to pending review`);
      }
    }

    console.log(`Saved ${recommendations.length} recommendations (via ${processingMethod})`);

    // Mark as completed
    job.status = 'completed';
    job.progress = 100;
    job.currentStep = 'completed';
    await db.updateVideo(job.videoId, {
      status: 'completed',
      processed_at: new Date().toISOString()
    });

    console.log(`Job ${job.id} completed successfully using ${processingMethod}`);
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
