import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';

const execAsync = promisify(exec);

/**
 * Video service for handling YouTube video downloads and metadata extraction
 */
export const videoService = {
  /**
   * Validate if a URL is a valid YouTube URL
   */
  isValidYouTubeUrl(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|live\/|shorts\/)|youtu\.be\/)/;
    return youtubeRegex.test(url);
  },

  /**
   * Get video metadata using yt-dlp
   */
  async getVideoInfo(youtubeUrl) {
    try {
      const { stdout } = await execAsync(
        `yt-dlp --js-runtimes node --dump-json --no-download "${youtubeUrl}"`,
        { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer for large metadata
      );

      const info = JSON.parse(stdout);

      return {
        title: info.title,
        channelName: info.channel || info.uploader,
        duration: info.duration,
        isLive: info.is_live || false,
        language: info.language || 'unknown',
        thumbnail: info.thumbnail,
        description: info.description,
        uploadDate: info.upload_date,
        viewCount: info.view_count
      };
    } catch (error) {
      console.error('Error getting video info:', error.message);
      throw new Error(`Failed to get video info: ${error.message}`);
    }
  },

  /**
   * Detect if video is a live stream
   */
  async isLiveStream(youtubeUrl) {
    try {
      const info = await this.getVideoInfo(youtubeUrl);
      return info.isLive;
    } catch (error) {
      console.error('Error detecting live stream:', error.message);
      return false;
    }
  },

  /**
   * Download audio from a recorded video
   * Returns path to downloaded audio file
   */
  async downloadAudio(youtubeUrl, outputDir) {
    await fs.mkdir(outputDir, { recursive: true });

    const outputTemplate = path.join(outputDir, '%(id)s.%(ext)s');

    return new Promise((resolve, reject) => {
      const args = [
        '--js-runtimes', 'node',
        '-x', // Extract audio
        '--audio-format', 'wav',
        '--audio-quality', '0',
        '--postprocessor-args', 'ffmpeg:-ar 16000 -ac 1', // 16kHz mono for Whisper
        '-o', outputTemplate,
        '--no-playlist',
        youtubeUrl
      ];

      const ytdlp = spawn('yt-dlp', args);

      let stdout = '';
      let stderr = '';

      ytdlp.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('[yt-dlp]', data.toString().trim());
      });

      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('[yt-dlp error]', data.toString().trim());
      });

      ytdlp.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
          return;
        }

        // Find the downloaded file
        try {
          const files = await fs.readdir(outputDir);
          const audioFile = files.find(f => f.endsWith('.wav'));
          if (audioFile) {
            resolve(path.join(outputDir, audioFile));
          } else {
            reject(new Error('Audio file not found after download'));
          }
        } catch (err) {
          reject(err);
        }
      });

      ytdlp.on('error', (err) => {
        reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
      });
    });
  },

  /**
   * Stream audio from a live stream in chunks
   * Returns an async generator that yields audio chunk file paths
   */
  async *streamLiveAudio(youtubeUrl, outputDir, chunkDurationSeconds = 30) {
    await fs.mkdir(outputDir, { recursive: true });

    let chunkIndex = 0;
    let isRunning = true;

    // Start yt-dlp to pipe audio
    const ytdlpArgs = [
      '--js-runtimes', 'node',
      '-f', 'bestaudio',
      '-o', '-', // Output to stdout
      youtubeUrl
    ];

    const ytdlp = spawn('yt-dlp', ytdlpArgs);

    // Pipe to ffmpeg for chunking
    const ffmpegArgs = [
      '-i', 'pipe:0', // Read from stdin
      '-f', 'segment',
      '-segment_time', chunkDurationSeconds.toString(),
      '-ar', '16000',
      '-ac', '1',
      '-acodec', 'pcm_s16le',
      path.join(outputDir, 'chunk_%03d.wav')
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    // Pipe yt-dlp output to ffmpeg
    ytdlp.stdout.pipe(ffmpeg.stdin);

    ytdlp.stderr.on('data', (data) => {
      console.log('[yt-dlp live]', data.toString().trim());
    });

    ffmpeg.stderr.on('data', (data) => {
      console.log('[ffmpeg]', data.toString().trim());
    });

    // Monitor for new chunks
    const checkInterval = 5000; // Check every 5 seconds
    let lastCheckedFiles = new Set();

    while (isRunning) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));

      try {
        const files = await fs.readdir(outputDir);
        const wavFiles = files.filter(f => f.startsWith('chunk_') && f.endsWith('.wav'));
        wavFiles.sort();

        for (const file of wavFiles) {
          if (!lastCheckedFiles.has(file)) {
            // Check if file is complete (ffmpeg has moved on to next chunk)
            const nextChunkIndex = parseInt(file.match(/chunk_(\d+)/)[1]) + 1;
            const nextChunkFile = `chunk_${String(nextChunkIndex).padStart(3, '0')}.wav`;

            if (wavFiles.includes(nextChunkFile)) {
              // Previous chunk is complete
              lastCheckedFiles.add(file);
              const filePath = path.join(outputDir, file);

              // Check file size to ensure it's not empty
              const stats = await fs.stat(filePath);
              if (stats.size > 1000) { // More than 1KB
                yield { chunkIndex, filePath, timestamp: chunkIndex * chunkDurationSeconds };
                chunkIndex++;
              }
            }
          }
        }
      } catch (err) {
        console.error('Error checking for chunks:', err.message);
      }

      // Check if processes are still running
      if (ytdlp.exitCode !== null || ffmpeg.exitCode !== null) {
        isRunning = false;
      }
    }

    // Clean up
    ytdlp.kill();
    ffmpeg.kill();
  },

  /**
   * Split audio file into chunks using ffmpeg
   */
  async splitAudioIntoChunks(audioPath, outputDir, chunkDurationSeconds = 30) {
    await fs.mkdir(outputDir, { recursive: true });

    const outputPattern = path.join(outputDir, 'chunk_%03d.wav');

    return new Promise((resolve, reject) => {
      const args = [
        '-i', audioPath,
        '-f', 'segment',
        '-segment_time', chunkDurationSeconds.toString(),
        '-ar', '16000',
        '-ac', '1',
        '-acodec', 'pcm_s16le',
        outputPattern
      ];

      const ffmpeg = spawn('ffmpeg', args);

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
          return;
        }

        // List all generated chunks
        try {
          const files = await fs.readdir(outputDir);
          const chunks = files
            .filter(f => f.startsWith('chunk_') && f.endsWith('.wav'))
            .sort()
            .map((file, index) => ({
              index,
              path: path.join(outputDir, file),
              startTime: index * chunkDurationSeconds,
              endTime: (index + 1) * chunkDurationSeconds
            }));

          resolve(chunks);
        } catch (err) {
          reject(err);
        }
      });

      ffmpeg.on('error', (err) => {
        reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
      });
    });
  },

  /**
   * Get audio duration in seconds using ffprobe
   */
  async getAudioDuration(audioPath) {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
      );
      return parseFloat(stdout.trim());
    } catch (error) {
      console.error('Error getting audio duration:', error.message);
      return null;
    }
  },

  /**
   * Clean up temporary files
   */
  async cleanup(directory) {
    try {
      await fs.rm(directory, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up:', error.message);
    }
  }
};

export default videoService;
