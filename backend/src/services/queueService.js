import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { db, config } from '../config/index.js';
import videoService from './videoService.js';
import transcriptionService from './transcriptionService.js';
import analysisService from './analysisService.js';

/**
 * Job queue service for processing videos
 * Uses in-memory queue for MVP - can be replaced with Redis/Bull for production
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

    // Get video info
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
   */
  async processJob(job) {
    console.log(`Processing job ${job.id}: ${job.youtubeUrl}`);

    job.status = 'processing';
    job.currentStep = 'downloading';
    await db.updateVideo(job.videoId, { status: 'processing' });

    // Create temp directory for this job
    const tempDir = path.join(config.processing.tempDir, job.id);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      if (job.videoInfo.isLive) {
        await this.processLiveStream(job, tempDir);
      } else {
        await this.processRecordedVideo(job, tempDir);
      }

      // Mark as completed
      job.status = 'completed';
      job.progress = 100;
      job.currentStep = 'completed';
      await db.updateVideo(job.videoId, {
        status: 'completed',
        processed_at: new Date().toISOString()
      });

      console.log(`Job ${job.id} completed successfully`);
    } finally {
      // Clean up temp files
      await videoService.cleanup(tempDir);
    }
  },

  /**
   * Process a recorded video
   */
  async processRecordedVideo(job, tempDir) {
    // Step 1: Download audio
    job.currentStep = 'downloading';
    job.progress = 10;
    console.log('Downloading audio...');

    const audioPath = await videoService.downloadAudio(job.youtubeUrl, tempDir);
    job.progress = 30;

    // Step 2: Split into chunks
    job.currentStep = 'splitting';
    console.log('Splitting audio into chunks...');

    const chunks = await videoService.splitAudioIntoChunks(
      audioPath,
      path.join(tempDir, 'chunks'),
      config.processing.audioChunkSeconds
    );
    job.progress = 40;

    // Step 3: Transcribe chunks
    job.currentStep = 'transcribing';
    console.log(`Transcribing ${chunks.length} chunks...`);

    const transcriptions = await transcriptionService.transcribeChunks(chunks, {
      onProgress: ({ current, total }) => {
        job.progress = 40 + Math.floor((current / total) * 30);
      }
    });

    // Save transcripts to database
    for (const transcript of transcriptions) {
      await db.createTranscript({
        video_id: job.videoId,
        chunk_index: transcript.chunkIndex,
        start_time_seconds: transcript.startTime,
        end_time_seconds: transcript.endTime,
        transcript_text: transcript.text,
        language_detected: transcript.language
      });
    }

    job.progress = 70;

    // Step 4: Analyze for recommendations
    job.currentStep = 'analyzing';
    console.log('Analyzing transcripts for recommendations...');

    const recommendations = await analysisService.analyzeTranscriptBatch(transcriptions);
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
        raw_extract: JSON.stringify(rec)
      });
    }

    console.log(`Saved ${recommendations.length} recommendations`);
  },

  /**
   * Process a live stream (continuous processing)
   */
  async processLiveStream(job, tempDir) {
    job.currentStep = 'streaming';
    console.log('Processing live stream...');

    const chunksDir = path.join(tempDir, 'chunks');
    let transcriptBuffer = [];
    let chunkIndex = 0;

    // Start streaming and processing
    for await (const chunk of videoService.streamLiveAudio(
      job.youtubeUrl,
      chunksDir,
      config.processing.audioChunkSeconds
    )) {
      job.progress = Math.min(50, job.progress + 5);

      // Transcribe this chunk
      try {
        const transcription = await transcriptionService.transcribe(chunk.filePath);

        // Save transcript
        await db.createTranscript({
          video_id: job.videoId,
          chunk_index: chunkIndex,
          start_time_seconds: chunk.timestamp,
          end_time_seconds: chunk.timestamp + config.processing.audioChunkSeconds,
          transcript_text: transcription.text,
          language_detected: transcription.language
        });

        transcriptBuffer.push({
          chunkIndex,
          text: transcription.text,
          timestamp: chunk.timestamp
        });

        chunkIndex++;

        // Analyze every N chunks
        if (transcriptBuffer.length >= config.processing.analysisBatchChunks) {
          job.currentStep = 'analyzing';
          console.log('Analyzing batch of transcripts...');

          const recommendations = await analysisService.analyzeTranscriptBatch(transcriptBuffer);

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
              raw_extract: JSON.stringify(rec)
            });
          }

          console.log(`Saved ${recommendations.length} recommendations from live stream`);
          transcriptBuffer = []; // Reset buffer
          job.currentStep = 'streaming';
        }
      } catch (error) {
        console.error(`Failed to process chunk ${chunkIndex}:`, error.message);
      }

      // Clean up processed chunk
      await fs.unlink(chunk.filePath).catch(() => {});
    }

    // Process any remaining transcripts
    if (transcriptBuffer.length > 0) {
      const recommendations = await analysisService.analyzeTranscriptBatch(transcriptBuffer);
      const today = new Date().toISOString().split('T')[0];

      for (const rec of recommendations) {
        await db.createRecommendation({
          video_id: job.videoId,
          expert_name: rec.expert_name,
          recommendation_date: today,
          share_name: rec.share_name,
          nse_symbol: rec.nse_symbol,
          action: rec.action,
          recommended_price: rec.recommended_price,
          target_price: rec.target_price,
          stop_loss: rec.stop_loss,
          reason: rec.reason,
          confidence_score: rec.confidence_score,
          raw_extract: JSON.stringify(rec)
        });
      }
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
