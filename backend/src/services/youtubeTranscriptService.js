/**
 * YouTube Transcript Service
 * Uses yt-dlp to fetch transcripts (free, reliable)
 * Falls back to paid API if yt-dlp fails
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Fallback to paid API if configured
const PAID_API_URL = 'https://www.youtube-transcript.io/api/transcripts';
const PAID_API_KEY = process.env.YOUTUBE_TRANSCRIPT_API_KEY;

export const youtubeTranscriptService = {
  /**
   * Extract video ID from YouTube URL
   */
  extractVideoId(youtubeUrl) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([^&]+)/,
      /(?:youtube\.com\/live\/)([^?]+)/,
      /(?:youtube\.com\/shorts\/)([^?]+)/,
      /(?:youtu\.be\/)([^?]+)/
    ];

    for (const pattern of patterns) {
      const match = youtubeUrl.match(pattern);
      if (match) return match[1];
    }
    return null;
  },

  /**
   * Fetch transcript using yt-dlp (primary method - FREE)
   * @param {string} youtubeUrl - YouTube video URL
   * @param {string[]} preferredLangs - Preferred languages in order (default: Hindi, English)
   * @returns {Object} - Transcript data with timestamps
   */
  async fetchTranscript(youtubeUrl, preferredLangs = ['hi', 'en']) {
    const videoId = this.extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL - could not extract video ID');
    }

    console.log(`Fetching transcript for video ID: ${videoId}`);

    // Try yt-dlp first (free method)
    try {
      const result = await this.fetchWithYtDlp(youtubeUrl, videoId, preferredLangs);
      console.log(`✅ yt-dlp transcript fetched: ${result.segments.length} segments, language: ${result.language}`);
      return result;
    } catch (ytdlpError) {
      console.log(`⚠️ yt-dlp failed: ${ytdlpError.message}`);

      // Fall back to paid API if configured
      if (PAID_API_KEY) {
        console.log('Trying paid API fallback...');
        try {
          return await this.fetchWithPaidApi(videoId);
        } catch (apiError) {
          console.log(`❌ Paid API also failed: ${apiError.message}`);
        }
      }

      throw new Error(`No transcript available: ${ytdlpError.message}`);
    }
  },

  /**
   * Fetch transcript using yt-dlp command
   */
  async fetchWithYtDlp(youtubeUrl, videoId, preferredLangs) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-transcript-'));
    const outputPath = path.join(tempDir, 'transcript');

    try {
      // Build language preference string
      const langStr = preferredLangs.join(',');

      // Try auto-generated subtitles first, then manual subtitles
      // Use --ignore-errors to continue even if some subtitles fail (e.g., 429 rate limit)
      const cmd = `yt-dlp --skip-download --write-auto-sub --write-sub --sub-lang "${langStr}" --sub-format vtt --ignore-errors -o "${outputPath}" "${youtubeUrl}" 2>&1`;

      console.log(`Running: yt-dlp for ${videoId} with langs: ${langStr}`);

      // Don't throw on command failure - check if files were downloaded instead
      let stdout = '';
      try {
        const result = await execAsync(cmd, { timeout: 180000 });
        stdout = result.stdout;
      } catch (cmdError) {
        // yt-dlp may return non-zero exit if some subs fail, but others succeed
        stdout = cmdError.stdout || '';
        console.log('yt-dlp command completed with warnings (checking for files anyway)');
      }

      // Find the downloaded subtitle file (prefer first language in list)
      const files = await fs.readdir(tempDir);
      let vttFile = null;

      // Try to find subtitles in preference order
      for (const lang of preferredLangs) {
        vttFile = files.find(f => f.endsWith(`.${lang}.vtt`));
        if (vttFile) break;
      }

      // If no preferred lang found, take any vtt file
      if (!vttFile) {
        vttFile = files.find(f => f.endsWith('.vtt'));
      }

      if (!vttFile) {
        throw new Error('No subtitles available for this video');
      }

      // Detect language from filename
      const langMatch = vttFile.match(/\.([a-z]{2})\.vtt$/);
      const detectedLang = langMatch ? langMatch[1] : 'unknown';

      // Read and parse VTT file
      const vttContent = await fs.readFile(path.join(tempDir, vttFile), 'utf-8');
      const segments = this.parseVtt(vttContent);

      if (segments.length === 0) {
        throw new Error('Transcript file is empty');
      }

      return {
        videoId,
        title: null, // yt-dlp doesn't provide title in subtitle-only mode
        channelName: null,
        duration: segments.length > 0 ? segments[segments.length - 1].endTime : null,
        language: detectedLang,
        fullText: this.combineTranscriptText(segments),
        segments
      };

    } finally {
      // Cleanup temp directory
      try {
        const files = await fs.readdir(tempDir);
        for (const file of files) {
          await fs.unlink(path.join(tempDir, file));
        }
        await fs.rmdir(tempDir);
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp files:', cleanupError.message);
      }
    }
  },

  /**
   * Parse VTT subtitle format
   */
  parseVtt(vttContent) {
    const segments = [];
    const lines = vttContent.split('\n');

    let currentSegment = null;
    const seenTexts = new Set(); // Deduplicate repeated lines

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip WEBVTT header and metadata
      if (line === 'WEBVTT' || line.startsWith('Kind:') || line.startsWith('Language:') || line === '') {
        continue;
      }

      // Parse timestamp line: "00:00:00.080 --> 00:00:03.190"
      const timestampMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);

      if (timestampMatch) {
        currentSegment = {
          startTime: this.parseTimestamp(timestampMatch[1]),
          endTime: this.parseTimestamp(timestampMatch[2]),
          text: ''
        };
      } else if (currentSegment && line && !line.match(/^align:|^position:/)) {
        // Clean the text line (remove VTT formatting tags)
        let cleanText = line
          .replace(/<[^>]+>/g, '') // Remove HTML-like tags
          .replace(/\{[^}]+\}/g, '') // Remove style tags
          .trim();

        // Skip duplicate/repeated lines (YouTube often duplicates for smooth scrolling)
        if (cleanText && !seenTexts.has(cleanText)) {
          seenTexts.add(cleanText);

          if (currentSegment.text) {
            currentSegment.text += ' ' + cleanText;
          } else {
            currentSegment.text = cleanText;
          }

          // Save segment when we have text
          if (currentSegment.text) {
            segments.push({
              startTime: currentSegment.startTime,
              endTime: currentSegment.endTime,
              duration: currentSegment.endTime - currentSegment.startTime,
              text: currentSegment.text
            });
            currentSegment = null;
          }
        }
      }
    }

    // Merge adjacent segments with same text and deduplicate
    return this.deduplicateSegments(segments);
  },

  /**
   * Deduplicate and merge adjacent segments
   */
  deduplicateSegments(segments) {
    if (segments.length === 0) return [];

    const result = [];
    let lastText = '';

    for (const seg of segments) {
      const cleanText = seg.text.trim();

      // Skip if same as last text (YouTube scroll effect duplicates)
      if (cleanText === lastText) continue;

      // Skip very short repetitive segments
      if (cleanText.length < 2) continue;

      result.push({
        startTime: seg.startTime,
        endTime: seg.endTime,
        duration: seg.duration,
        text: cleanText
      });

      lastText = cleanText;
    }

    return result;
  },

  /**
   * Parse VTT timestamp to seconds
   */
  parseTimestamp(timestamp) {
    const parts = timestamp.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  },

  /**
   * Fetch transcript from paid API (fallback)
   */
  async fetchWithPaidApi(videoId) {
    console.log(`Fetching from paid API for video ID: ${videoId}`);

    const response = await fetch(PAID_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${PAID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids: [videoId] })
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 10;
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    if (!response.ok) {
      throw new Error(`Paid API request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error('No transcript data returned from paid API');
    }

    const videoData = data[0];

    if (!videoData.tracks || videoData.tracks.length === 0) {
      throw new Error('No transcript available from paid API');
    }

    const track = videoData.tracks[0];
    if (!track.transcript || track.transcript.length === 0) {
      throw new Error('Transcript is empty from paid API');
    }

    return {
      videoId,
      title: videoData.title,
      channelName: videoData.microformat?.playerMicroformatRenderer?.ownerChannelName || null,
      duration: parseInt(videoData.microformat?.playerMicroformatRenderer?.lengthSeconds) || null,
      language: track.language || 'unknown',
      fullText: videoData.text || this.combineTranscriptText(this.processApiSegments(track.transcript)),
      segments: this.processApiSegments(track.transcript)
    };
  },

  /**
   * Process segments from paid API format
   */
  processApiSegments(rawSegments) {
    return rawSegments
      .filter(s => s.text && s.text.trim() !== '' && s.text.trim() !== '\n')
      .map(s => ({
        startTime: parseFloat(s.start),
        duration: parseFloat(s.dur) || 0,
        endTime: parseFloat(s.start) + (parseFloat(s.dur) || 0),
        text: s.text.trim()
      }));
  },

  /**
   * Combine all transcript segments into full text
   */
  combineTranscriptText(segments) {
    return segments
      .filter(s => s.text && s.text.trim() !== '' && s.text.trim() !== '\n')
      .map(s => s.text.trim())
      .join(' ');
  },

  /**
   * Group segments into chunks of specified duration for LLM analysis
   * @param {Array} segments - Transcript segments with timestamps
   * @param {number} chunkSeconds - Duration of each chunk in seconds (default 30)
   * @returns {Array} - Chunked transcript data
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
      // Check if segment belongs to current chunk
      if (segment.startTime < currentChunk.endTime) {
        currentChunk.texts.push(segment.text);
      } else {
        // Save current chunk and start new one
        if (currentChunk.texts.length > 0) {
          chunks.push({
            chunkIndex: currentChunk.index,
            startTime: currentChunk.startTime,
            endTime: currentChunk.endTime,
            text: currentChunk.texts.join(' ')
          });
        }

        // Calculate new chunk boundaries
        const newChunkIndex = Math.floor(segment.startTime / chunkSeconds);
        currentChunk = {
          index: newChunkIndex,
          startTime: newChunkIndex * chunkSeconds,
          endTime: (newChunkIndex + 1) * chunkSeconds,
          texts: [segment.text]
        };
      }
    }

    // Don't forget the last chunk
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

export default youtubeTranscriptService;
