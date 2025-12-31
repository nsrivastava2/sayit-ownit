/**
 * YouTube Transcript API Service
 * Uses youtube-transcript.io API to fetch transcripts
 */

const API_URL = 'https://www.youtube-transcript.io/api/transcripts';
const API_KEY = '69549434ad7691e8b9471601';

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
   * Fetch transcript from YouTube Transcript API
   * @param {string} youtubeUrl - YouTube video URL
   * @returns {Object} - Transcript data with timestamps
   */
  async fetchTranscript(youtubeUrl) {
    const videoId = this.extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL - could not extract video ID');
    }

    console.log(`Fetching transcript for video ID: ${videoId}`);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids: [videoId] })
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 10;
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error('No transcript data returned');
    }

    const videoData = data[0];

    // Check if transcript is available
    if (!videoData.tracks || videoData.tracks.length === 0) {
      throw new Error('No transcript available for this video');
    }

    const track = videoData.tracks[0];
    if (!track.transcript || track.transcript.length === 0) {
      throw new Error('Transcript is empty');
    }

    return {
      videoId,
      title: videoData.title,
      channelName: videoData.microformat?.playerMicroformatRenderer?.ownerChannelName || null,
      duration: parseInt(videoData.microformat?.playerMicroformatRenderer?.lengthSeconds) || null,
      language: track.language || 'unknown',
      fullText: videoData.text || this.combineTranscriptText(track.transcript),
      segments: this.processSegments(track.transcript)
    };
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
   * Process raw transcript segments into clean format
   */
  processSegments(rawSegments) {
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
