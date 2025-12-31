import { v4 as uuidv4 } from 'uuid';
import { db, config } from '../config/index.js';
import videoService from './videoService.js';
import youtubeTranscriptService from './youtubeTranscriptService.js';
import analysisService from './analysisService.js';

/**
 * Job queue service for processing videos
 * Uses YouTube Transcript API for fetching transcripts
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
   * Process a single job using YouTube Transcript API
   */
  async processJob(job) {
    console.log(`Processing job ${job.id}: ${job.youtubeUrl}`);

    job.status = 'processing';
    job.currentStep = 'fetching_transcript';
    await db.updateVideo(job.videoId, { status: 'processing' });

    try {
      // Step 1: Fetch transcript from API
      job.progress = 10;
      console.log('Fetching transcript from YouTube Transcript API...');

      const transcriptData = await youtubeTranscriptService.fetchTranscript(job.youtubeUrl);
      job.progress = 40;

      console.log(`Fetched transcript with ${transcriptData.segments.length} segments`);

      // Step 2: Group segments into chunks for analysis
      job.currentStep = 'processing_transcript';
      const chunks = youtubeTranscriptService.groupSegmentsIntoChunks(
        transcriptData.segments,
        config.processing.audioChunkSeconds || 30
      );

      console.log(`Grouped into ${chunks.length} chunks`);

      // Step 3: Save transcript chunks to database
      for (const chunk of chunks) {
        await db.createTranscript({
          video_id: job.videoId,
          chunk_index: chunk.chunkIndex,
          start_time_seconds: chunk.startTime,
          end_time_seconds: chunk.endTime,
          transcript_text: chunk.text,
          language_detected: transcriptData.language
        });
      }

      job.progress = 60;

      // Step 4: Analyze for recommendations
      job.currentStep = 'analyzing';
      console.log('Analyzing transcripts for recommendations...');

      const recommendations = await analysisService.analyzeTranscriptBatch(chunks);
      job.progress = 90;

      // Step 5: Save recommendations to database
      const today = new Date().toISOString().split('T')[0];

      for (const rec of recommendations) {
        await db.createRecommendation({
          video_id: job.videoId,
          expert_name: rec.expert_name,
          recommendation_date: today,
          share_name: rec.share_name,
          nse_symbol: rec.nse_symbol || analysisService.mapToNSESymbol(rec.share_name),
          action: rec.action,
          recommended_price: rec.recommended_price,
          target_price: rec.target_price,
          stop_loss: rec.stop_loss,
          reason: rec.reason,
          confidence_score: rec.confidence_score,
          timestamp_in_video: rec.timestamp_seconds,
          raw_extract: JSON.stringify(rec)
        });
      }

      console.log(`Saved ${recommendations.length} recommendations`);

      // Mark as completed
      job.status = 'completed';
      job.progress = 100;
      job.currentStep = 'completed';
      await db.updateVideo(job.videoId, {
        status: 'completed',
        processed_at: new Date().toISOString()
      });

      console.log(`Job ${job.id} completed successfully`);

    } catch (error) {
      // If transcript API fails, mark video as failed
      console.error('Failed to process video:', error.message);
      throw error;
    }
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
