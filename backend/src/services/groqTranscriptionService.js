import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { config } from '../config/index.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit

export const groqTranscriptionService = {
  /**
   * Download audio from YouTube video
   */
  async downloadAudio(youtubeUrl, outputDir) {
    await fs.mkdir(outputDir, { recursive: true });
    const outputTemplate = path.join(outputDir, '%(id)s.%(ext)s');

    return new Promise((resolve, reject) => {
      const args = [
        '--js-runtimes', 'node',
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '5', // Medium quality to keep file size down
        '-o', outputTemplate,
        '--no-playlist',
        youtubeUrl
      ];

      const ytdlp = spawn('yt-dlp', args);
      let stderr = '';

      ytdlp.stdout.on('data', (data) => {
        console.log('[yt-dlp]', data.toString().trim());
      });

      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytdlp.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp failed: ${stderr}`));
          return;
        }

        try {
          const files = await fs.readdir(outputDir);
          const audioFile = files.find(f => f.endsWith('.mp3'));
          if (audioFile) {
            resolve(path.join(outputDir, audioFile));
          } else {
            reject(new Error('Audio file not found'));
          }
        } catch (err) {
          reject(err);
        }
      });

      ytdlp.on('error', reject);
    });
  },

  /**
   * Split audio into chunks if larger than 25MB
   */
  async splitAudioIfNeeded(audioPath, outputDir) {
    const stats = await fs.stat(audioPath);

    if (stats.size <= MAX_FILE_SIZE) {
      return [{ path: audioPath, startTime: 0 }];
    }

    console.log(`Audio file is ${(stats.size / 1024 / 1024).toFixed(1)}MB, splitting into chunks...`);

    // Calculate chunk duration based on file size
    // Rough estimate: 1MB ≈ 1 minute of MP3 at medium quality
    const fileSizeMB = stats.size / (1024 * 1024);
    const estimatedMinutes = fileSizeMB;
    const chunksNeeded = Math.ceil(stats.size / (MAX_FILE_SIZE * 0.9)); // 90% of max to be safe
    const chunkDuration = Math.floor((estimatedMinutes * 60) / chunksNeeded);

    await fs.mkdir(outputDir, { recursive: true });

    return new Promise((resolve, reject) => {
      const outputPattern = path.join(outputDir, 'chunk_%03d.mp3');
      const args = [
        '-i', audioPath,
        '-f', 'segment',
        '-segment_time', chunkDuration.toString(),
        '-c', 'copy',
        outputPattern
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg split failed: ${stderr}`));
          return;
        }

        try {
          const files = await fs.readdir(outputDir);
          const chunks = files
            .filter(f => f.startsWith('chunk_') && f.endsWith('.mp3'))
            .sort()
            .map((file, index) => ({
              path: path.join(outputDir, file),
              startTime: index * chunkDuration
            }));

          console.log(`Split into ${chunks.length} chunks of ~${chunkDuration}s each`);
          resolve(chunks);
        } catch (err) {
          reject(err);
        }
      });

      ffmpeg.on('error', reject);
    });
  },

  /**
   * Transcribe audio file using Groq Whisper API
   */
  async transcribeFile(audioPath, language = null) {
    const fileBuffer = await fs.readFile(audioPath);
    const fileName = path.basename(audioPath);

    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer]), fileName);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    if (language) {
      formData.append('language', language);
    }

    console.log(`Transcribing ${fileName} via Groq API...`);

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    return result;
  },

  /**
   * Transcribe YouTube video using Groq
   * @param {string} youtubeUrl - YouTube video URL
   * @param {string} tempDir - Temporary directory for files
   * @returns {Object} - Transcript data with timestamps
   */
  async transcribeVideo(youtubeUrl, tempDir) {
    const audioDir = path.join(tempDir, 'audio');
    const chunksDir = path.join(tempDir, 'chunks');

    try {
      // Step 1: Download audio
      console.log('Downloading audio for Groq transcription...');
      const audioPath = await this.downloadAudio(youtubeUrl, audioDir);

      // Step 2: Split if needed
      const audioChunks = await this.splitAudioIfNeeded(audioPath, chunksDir);

      // Step 3: Transcribe each chunk
      const allSegments = [];
      let fullText = '';

      for (let i = 0; i < audioChunks.length; i++) {
        const chunk = audioChunks[i];
        console.log(`Transcribing chunk ${i + 1}/${audioChunks.length}...`);

        const result = await this.transcribeFile(chunk.path);

        // Adjust timestamps based on chunk start time
        if (result.segments) {
          for (const segment of result.segments) {
            allSegments.push({
              startTime: chunk.startTime + segment.start,
              endTime: chunk.startTime + segment.end,
              text: segment.text.trim()
            });
          }
        }

        fullText += (fullText ? ' ' : '') + result.text;

        // Rate limiting: wait between chunks
        if (i < audioChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return {
        fullText,
        segments: allSegments,
        language: 'hi' // Assuming Hindi for this use case
      };

    } finally {
      // Cleanup audio files
      try {
        await fs.rm(audioDir, { recursive: true, force: true });
        await fs.rm(chunksDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  },

  /**
   * Group segments into chunks for LLM analysis
   */
  groupSegmentsIntoChunks(segments, chunkSeconds = 30) {
    if (!segments || segments.length === 0) return [];

    const chunks = [];
    let currentChunk = {
      index: 0,
      startTime: 0,
      endTime: chunkSeconds,
      texts: []
    };

    for (const segment of segments) {
      if (segment.startTime < currentChunk.endTime) {
        currentChunk.texts.push(segment.text);
      } else {
        if (currentChunk.texts.length > 0) {
          chunks.push({
            chunkIndex: currentChunk.index,
            startTime: currentChunk.startTime,
            endTime: currentChunk.endTime,
            text: currentChunk.texts.join(' ')
          });
        }

        const newChunkIndex = Math.floor(segment.startTime / chunkSeconds);
        currentChunk = {
          index: newChunkIndex,
          startTime: newChunkIndex * chunkSeconds,
          endTime: (newChunkIndex + 1) * chunkSeconds,
          texts: [segment.text]
        };
      }
    }

    if (currentChunk.texts.length > 0) {
      chunks.push({
        chunkIndex: currentChunk.index,
        startTime: currentChunk.startTime,
        endTime: currentChunk.endTime,
        text: currentChunk.texts.join(' ')
      });
    }

    return chunks;
  }
};

export default groqTranscriptionService;
