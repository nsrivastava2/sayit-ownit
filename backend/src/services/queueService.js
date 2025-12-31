import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { db, config } from '../config/index.js';
import videoService from './videoService.js';
import youtubeTranscriptService from './youtubeTranscriptService.js';
import groqTranscriptionService from './groqTranscriptionService.js';
import analysisService from './analysisService.js';

/**
 * Job queue service for processing videos
 * Uses YouTube Transcript API with Groq Whisper fallback
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
   * Process a single job - tries YouTube API first, falls back to Groq
   */
  async processJob(job) {
    console.log(`Processing job ${job.id}: ${job.youtubeUrl}`);

    job.status = 'processing';
    job.currentStep = 'fetching_transcript';
    await db.updateVideo(job.videoId, { status: 'processing' });

    let transcriptData = null;
    let chunks = null;
    let transcriptionMethod = null;

    // Try YouTube Transcript API first
    try {
      job.progress = 10;
      console.log('Trying YouTube Transcript API...');

      transcriptData = await youtubeTranscriptService.fetchTranscript(job.youtubeUrl);
      chunks = youtubeTranscriptService.groupSegmentsIntoChunks(
        transcriptData.segments,
        config.processing.audioChunkSeconds || 30
      );
      transcriptionMethod = 'youtube_api';

      console.log(`YouTube API: Got ${transcriptData.segments.length} segments, grouped into ${chunks.length} chunks`);
      job.progress = 40;

    } catch (ytError) {
      console.log(`YouTube API failed: ${ytError.message}`);
      console.log('Falling back to Groq Whisper transcription...');

      // Fallback to Groq
      job.currentStep = 'transcribing_groq';
      job.progress = 15;

      const tempDir = path.join(config.processing.tempDir, job.id);
      await fs.mkdir(tempDir, { recursive: true });

      try {
        transcriptData = await groqTranscriptionService.transcribeVideo(job.youtubeUrl, tempDir);
        chunks = groqTranscriptionService.groupSegmentsIntoChunks(
          transcriptData.segments,
          config.processing.audioChunkSeconds || 30
        );
        transcriptionMethod = 'groq_whisper';

        console.log(`Groq Whisper: Got ${transcriptData.segments.length} segments, grouped into ${chunks.length} chunks`);
        job.progress = 50;

      } finally {
        // Cleanup temp directory
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }

    if (!chunks || chunks.length === 0) {
      throw new Error('No transcript data available from any source');
    }

    // Save transcript chunks to database
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

    job.progress = 60;

    // Analyze for recommendations
    job.currentStep = 'analyzing';
    console.log('Analyzing transcripts for recommendations...');

    const recommendations = await analysisService.analyzeTranscriptBatch(chunks);
    job.progress = 90;

    // Save recommendations to database
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

    console.log(`Saved ${recommendations.length} recommendations (via ${transcriptionMethod})`);

    // Mark as completed
    job.status = 'completed';
    job.progress = 100;
    job.currentStep = 'completed';
    await db.updateVideo(job.videoId, {
      status: 'completed',
      processed_at: new Date().toISOString()
    });

    console.log(`Job ${job.id} completed successfully using ${transcriptionMethod}`);
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
