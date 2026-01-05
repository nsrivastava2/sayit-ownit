#!/usr/bin/env node
/**
 * Process videos without YouTube transcripts using whisper.cpp
 *
 * Usage: node scripts/process_with_whisper.js [--limit N] [--video-id UUID]
 */

import { execSync, spawn } from 'child_process';
import { existsSync, unlinkSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const WHISPER_CLI = join(process.env.HOME, 'whisper.cpp/build/bin/whisper-cli');
const WHISPER_MODEL = join(process.env.HOME, 'whisper.cpp/models/ggml-large-v3-turbo.bin');
const TEMP_DIR = join(__dirname, '../temp/whisper');
const CHUNK_DURATION = 30; // seconds per transcript chunk

// Database config
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'sayitownit',
  user: process.env.DB_USER || 'sayitownit',
  password: process.env.DB_PASSWORD || 'sayitownit123',
});

// Ensure temp directory exists
if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Get and lock a single video for processing (for parallel workers)
 */
async function getAndLockNextVideo() {
  const client = await pool.connect();
  try {
    // Use UPDATE ... RETURNING with row-level locking to prevent duplicate processing
    const result = await client.query(`
      UPDATE videos
      SET status = 'processing'
      WHERE id = (
        SELECT v.id
        FROM videos v
        WHERE v.status = 'pending'
          AND NOT EXISTS (
            SELECT 1 FROM transcripts t
            WHERE t.video_id = v.id AND t.source = 'whisper'
          )
        ORDER BY v.duration_seconds ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, title, youtube_url, duration_seconds
    `);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Get videos that need whisper transcription (for counting/planning)
 */
async function getVideosNeedingTranscription(limit = 10, specificVideoId = null) {
  const client = await pool.connect();
  try {
    let query, params;

    if (specificVideoId) {
      query = `SELECT id, title, youtube_url, duration_seconds FROM videos WHERE id = $1`;
      params = [specificVideoId];
    } else {
      query = `
        SELECT v.id, v.title, v.youtube_url, v.duration_seconds
        FROM videos v
        LEFT JOIN transcripts t ON v.id = t.video_id
        WHERE t.video_id IS NULL
          AND v.status = 'pending'
        ORDER BY v.duration_seconds ASC
        LIMIT $1
      `;
      params = [limit];
    }

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Download audio from YouTube
 */
function downloadAudio(youtubeUrl, outputPath) {
  console.log(`  Downloading audio...`);
  // Use Firefox cookies to bypass bot detection
  const cmd = `yt-dlp --cookies-from-browser firefox -x --audio-format mp3 --audio-quality 0 -o "${outputPath}.%(ext)s" "${youtubeUrl}"`;

  try {
    execSync(cmd, { stdio: 'pipe', timeout: 1800000 }); // 30 min timeout for long videos
    return `${outputPath}.mp3`;
  } catch (error) {
    throw new Error(`Download failed: ${error.message}`);
  }
}

/**
 * Convert MP3 to 16kHz WAV for whisper.cpp
 */
function convertToWav(mp3Path, wavPath) {
  console.log(`  Converting to 16kHz WAV...`);
  const cmd = `ffmpeg -i "${mp3Path}" -ar 16000 -ac 1 -y "${wavPath}"`;

  try {
    execSync(cmd, { stdio: 'pipe', timeout: 300000 }); // 5 min timeout
    return wavPath;
  } catch (error) {
    throw new Error(`Conversion failed: ${error.message}`);
  }
}

/**
 * Transcribe audio using whisper.cpp with GPU
 */
function transcribeWithWhisper(wavPath) {
  console.log(`  Transcribing with whisper.cpp (GPU)...`);

  return new Promise((resolve, reject) => {
    const args = [
      '-m', WHISPER_MODEL,
      '-f', wavPath,
      '-l', 'hi',  // Hindi
      '-t', '8',   // 8 threads
    ];

    const whisper = spawn(WHISPER_CLI, args);
    let stdout = '';
    let stderr = '';

    whisper.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    whisper.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    whisper.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Whisper exited with code ${code}: ${stderr}`));
        return;
      }

      // Parse output
      const output = stdout + stderr;
      const lines = output.split('\n');
      const segments = [];

      // Parse timestamp lines: [00:00:00.000 --> 00:00:16.860]   Text here
      const timestampRegex = /\[(\d{2}):(\d{2}):(\d{2}\.\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}\.\d{3})\]\s*(.+)/;

      for (const line of lines) {
        const match = line.match(timestampRegex);
        if (match) {
          const startSeconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
          const endSeconds = parseInt(match[4]) * 3600 + parseInt(match[5]) * 60 + parseFloat(match[6]);
          const text = match[7].trim();

          if (text) {
            segments.push({ start: startSeconds, end: endSeconds, text });
          }
        }
      }

      // Extract timing info
      const timingMatch = output.match(/total time\s*=\s*([\d.]+)\s*ms/);
      const processingTime = timingMatch ? parseFloat(timingMatch[1]) / 1000 : null;

      resolve({ segments, processingTime });
    });
  });
}

/**
 * Group segments into 30-second chunks and save to database
 */
async function saveTranscriptChunks(videoId, segments) {
  console.log(`  Saving ${segments.length} segments to database...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Group segments into 30-second chunks
    const chunks = [];
    let currentChunk = { index: 0, start: 0, end: CHUNK_DURATION, texts: [] };

    for (const segment of segments) {
      const chunkIndex = Math.floor(segment.start / CHUNK_DURATION);
      const chunkStart = chunkIndex * CHUNK_DURATION;
      const chunkEnd = (chunkIndex + 1) * CHUNK_DURATION;

      if (chunkIndex > currentChunk.index) {
        // Save current chunk
        if (currentChunk.texts.length > 0) {
          chunks.push({
            index: currentChunk.index,
            start: currentChunk.start,
            end: currentChunk.end,
            text: currentChunk.texts.join(' ')
          });
        }
        // Start new chunk
        currentChunk = { index: chunkIndex, start: chunkStart, end: chunkEnd, texts: [segment.text] };
      } else {
        currentChunk.texts.push(segment.text);
      }
    }

    // Don't forget last chunk
    if (currentChunk.texts.length > 0) {
      chunks.push({
        index: currentChunk.index,
        start: currentChunk.start,
        end: currentChunk.end,
        text: currentChunk.texts.join(' ')
      });
    }

    // Insert chunks into database
    for (const chunk of chunks) {
      await client.query(`
        INSERT INTO transcripts (video_id, chunk_index, start_time_seconds, end_time_seconds, transcript_text, source)
        VALUES ($1, $2, $3, $4, $5, 'whisper')
      `, [videoId, chunk.index, chunk.start, chunk.end, chunk.text]);
    }

    await client.query('COMMIT');
    console.log(`  Saved ${chunks.length} chunks`);
    return chunks.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update video status
 */
async function updateVideoStatus(videoId, status) {
  const client = await pool.connect();
  try {
    await client.query('UPDATE videos SET status = $1 WHERE id = $2', [status, videoId]);
  } finally {
    client.release();
  }
}

/**
 * Process a single video
 */
async function processVideo(video) {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${video.title.substring(0, 50)}...`);
  console.log(`Duration: ${(video.duration_seconds / 3600).toFixed(1)} hours`);
  console.log(`${'='.repeat(60)}`);

  const mp3Path = join(TEMP_DIR, `${video.id}.mp3`);
  const wavPath = join(TEMP_DIR, `${video.id}.wav`);

  try {
    // Mark as processing
    await updateVideoStatus(video.id, 'processing');

    // Step 1: Download audio
    const audioFile = downloadAudio(video.youtube_url, join(TEMP_DIR, video.id));

    // Step 2: Convert to WAV
    convertToWav(audioFile, wavPath);

    // Step 3: Transcribe with whisper
    const { segments, processingTime } = await transcribeWithWhisper(wavPath);
    console.log(`  Transcription completed in ${processingTime?.toFixed(1) || '?'}s`);
    console.log(`  Got ${segments.length} segments`);

    if (segments.length === 0) {
      throw new Error('No segments extracted from audio');
    }

    // Step 4: Save to database
    await saveTranscriptChunks(video.id, segments);

    // Step 5: Mark as ready for Gemini processing (back to pending)
    await updateVideoStatus(video.id, 'pending');

    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`  ✅ Completed in ${totalTime.toFixed(1)}s`);

    return { success: true, videoId: video.id, time: totalTime };

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    await updateVideoStatus(video.id, 'failed');
    return { success: false, videoId: video.id, error: error.message };

  } finally {
    // Cleanup temp files
    try {
      if (existsSync(mp3Path)) unlinkSync(mp3Path);
      if (existsSync(wavPath)) unlinkSync(wavPath);
    } catch (e) {
      console.warn(`  Warning: Could not clean up temp files: ${e.message}`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=' .repeat(60));
  console.log('WHISPER BATCH PROCESSOR');
  console.log('=' .repeat(60));

  // Parse arguments
  const args = process.argv.slice(2);
  let limit = 10;
  let specificVideoId = null;
  let workerMode = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--video-id' && args[i + 1]) {
      specificVideoId = args[i + 1];
      i++;
    } else if (args[i] === '--worker') {
      workerMode = true;
    }
  }

  // Check whisper.cpp
  if (!existsSync(WHISPER_CLI)) {
    console.error(`Error: whisper.cpp not found at ${WHISPER_CLI}`);
    process.exit(1);
  }
  if (!existsSync(WHISPER_MODEL)) {
    console.error(`Error: Whisper model not found at ${WHISPER_MODEL}`);
    process.exit(1);
  }

  console.log(`Whisper CLI: ${WHISPER_CLI}`);
  console.log(`Whisper Model: ${WHISPER_MODEL}`);
  console.log(`Temp Directory: ${TEMP_DIR}`);
  console.log(`Worker Mode: ${workerMode}`);
  console.log();

  // Worker mode: continuously grab and process videos with locking
  if (workerMode) {
    console.log('Starting worker mode (will process until no more videos)...\n');
    const results = { success: 0, failed: 0 };
    let processed = 0;

    while (true) {
      const video = await getAndLockNextVideo();
      if (!video) {
        console.log('\nNo more videos to process.');
        break;
      }

      processed++;
      console.log(`\n[Worker processed: ${processed}]`);
      const result = await processVideo(video);

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('WORKER SUMMARY');
    console.log('='.repeat(60));
    console.log(`Successful: ${results.success}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Total: ${processed}`);
    await pool.end();
    return;
  }

  // Normal mode: get list of videos and process them
  const videos = await getVideosNeedingTranscription(limit, specificVideoId);

  if (videos.length === 0) {
    console.log('No videos need transcription.');
    await pool.end();
    return;
  }

  console.log(`Found ${videos.length} videos to process`);
  const totalHours = videos.reduce((sum, v) => sum + v.duration_seconds, 0) / 3600;
  console.log(`Total duration: ${totalHours.toFixed(1)} hours`);
  console.log(`Estimated time: ${(totalHours / 14).toFixed(1)} hours (at 14x real-time)`);

  // Process videos
  const results = { success: 0, failed: 0 };

  for (let i = 0; i < videos.length; i++) {
    console.log(`\n[${i + 1}/${videos.length}]`);
    const result = await processVideo(videos[i]);

    if (result.success) {
      results.success++;
    } else {
      results.failed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Successful: ${results.success}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total: ${videos.length}`);

  await pool.end();
}

main().catch(console.error);
