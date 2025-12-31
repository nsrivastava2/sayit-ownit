/**
 * Gemini Flash Video Analysis Service
 * Directly analyzes YouTube videos for stock recommendations
 * using Gemini's multimodal capabilities (sees audio + visual)
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_FILE_API_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const GEMINI_GENERATE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_GENERATE_URL_25 = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GEMINI_FILE_STATUS_URL = 'https://generativelanguage.googleapis.com/v1beta/files';

export const geminiVideoService = {
  /**
   * Download video from YouTube
   * @param {string} youtubeUrl - YouTube video URL
   * @param {string} outputDir - Directory to save video
   * @returns {string} - Path to downloaded video
   */
  async downloadVideo(youtubeUrl, outputDir) {
    await fs.mkdir(outputDir, { recursive: true });
    const outputTemplate = path.join(outputDir, '%(id)s.%(ext)s');

    return new Promise((resolve, reject) => {
      // Download video with audio merged into mp4
      // Priority: 720p mp4, then 480p, then best available under 720p
      const args = [
        '--js-runtimes', 'node',
        '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best',
        '--merge-output-format', 'mp4',
        '--recode-video', 'mp4',
        '-o', outputTemplate,
        '--no-playlist',
        youtubeUrl
      ];

      const ytdlp = spawn('yt-dlp', args);
      let stderr = '';
      let lastOutput = '';

      ytdlp.stdout.on('data', (data) => {
        lastOutput = data.toString().trim();
        console.log('[yt-dlp]', lastOutput);
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
          // Look for video files, also accept audio-only as Gemini can process those too
          const videoFile = files.find(f =>
            f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv') ||
            f.endsWith('.m4a') || f.endsWith('.mp3') || f.endsWith('.mov')
          );
          if (videoFile) {
            console.log(`Downloaded: ${videoFile}`);
            resolve(path.join(outputDir, videoFile));
          } else {
            reject(new Error('Video file not found after download'));
          }
        } catch (err) {
          reject(err);
        }
      });

      ytdlp.on('error', reject);
    });
  },

  /**
   * Upload video file to Gemini File API
   * @param {string} videoPath - Path to video file
   * @returns {Object} - Uploaded file info with URI
   */
  async uploadToGemini(videoPath) {
    const fileName = path.basename(videoPath);
    const fileBuffer = await fs.readFile(videoPath);
    const fileSize = fileBuffer.length;
    const mimeType = this.getMimeType(fileName);

    console.log(`Uploading ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)}MB) to Gemini...`);

    // Step 1: Initialize resumable upload
    const initResponse = await fetch(`${GEMINI_FILE_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': fileSize.toString(),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        file: {
          display_name: fileName
        }
      })
    });

    if (!initResponse.ok) {
      const error = await initResponse.text();
      throw new Error(`Gemini upload init failed: ${initResponse.status} - ${error}`);
    }

    const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL');
    if (!uploadUrl) {
      throw new Error('No upload URL received from Gemini');
    }

    // Step 2: Upload the file data
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
        'Content-Type': mimeType
      },
      body: fileBuffer
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`Gemini upload failed: ${uploadResponse.status} - ${error}`);
    }

    const fileInfo = await uploadResponse.json();
    console.log(`Upload complete. File: ${fileInfo.file.name}, State: ${fileInfo.file.state}`);

    return fileInfo.file;
  },

  /**
   * Wait for Gemini to process the video file
   * @param {Object} uploadedFile - File info from upload response
   * @returns {Object} - Processed file info
   */
  async waitForProcessing(uploadedFile) {
    const maxWaitTime = 10 * 60 * 1000; // 10 minutes max
    const startTime = Date.now();
    let consecutiveErrors = 0;

    // If already ACTIVE from upload, return immediately
    if (uploadedFile.state === 'ACTIVE') {
      console.log('Video already processed!');
      return uploadedFile;
    }

    const fileName = uploadedFile.name.replace('files/', '');
    console.log('Waiting for Gemini to process video (this may take a few minutes)...');

    // For large files, wait at least 2 minutes before first check
    const fileSizeMB = parseInt(uploadedFile.sizeBytes) / (1024 * 1024);
    const initialWait = Math.min(fileSizeMB * 1000, 120000); // 1 second per MB, max 2 minutes
    console.log(`Waiting ${Math.round(initialWait/1000)}s for initial processing...`);
    await new Promise(resolve => setTimeout(resolve, initialWait));

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await fetch(
          `${GEMINI_FILE_STATUS_URL}/${fileName}?key=${GEMINI_API_KEY}`
        );

        if (!response.ok) {
          consecutiveErrors++;
          console.log(`Gemini API error ${response.status} (${consecutiveErrors} consecutive errors)`);

          // After many consecutive errors, wait longer before trying to use the file
          if (consecutiveErrors >= 10) {
            console.log('Status API appears broken. Waiting 60s then trying to use file...');
            await new Promise(resolve => setTimeout(resolve, 60000));
            return { ...uploadedFile, state: 'ACTIVE', uri: uploadedFile.uri };
          }

          await new Promise(resolve => setTimeout(resolve, 10000));
          continue;
        }

        consecutiveErrors = 0;
        const fileInfo = await response.json();

        if (fileInfo.state === 'ACTIVE') {
          console.log('Video processing complete!');
          return fileInfo;
        }

        if (fileInfo.state === 'FAILED') {
          throw new Error(`Video processing failed: ${fileInfo.error?.message || 'Unknown error'}`);
        }

        console.log(`Processing... (state: ${fileInfo.state})`);
        await new Promise(resolve => setTimeout(resolve, 15000)); // Check every 15 seconds
      } catch (error) {
        if (error.message.includes('fetch') || error.message.includes('network')) {
          consecutiveErrors++;
          console.log(`Network error (${consecutiveErrors}): ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 10000));
          continue;
        }
        throw error;
      }
    }

    // If we timed out but file was uploaded, try to use it
    console.log('Timeout reached, attempting to use file anyway...');
    return { ...uploadedFile, state: 'ACTIVE', uri: uploadedFile.uri };
  },

  /**
   * Analyze video with Gemini for stock recommendations
   * @param {Object} fileInfo - Uploaded file info from Gemini
   * @returns {Array} - Extracted recommendations
   */
  async analyzeVideo(fileInfo) {
    console.log('Sending video to Gemini for analysis...');

    const prompt = this.buildAnalysisPrompt();

    const response = await fetch(`${GEMINI_GENERATE_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                file_data: {
                  mime_type: fileInfo.mimeType,
                  file_uri: fileInfo.uri
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini analysis failed: ${response.status} - ${error}`);
    }

    const result = await response.json();

    // Extract text from response
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return this.parseRecommendations(text);
  },

  /**
   * Build the prompt for Gemini video analysis
   */
  buildAnalysisPrompt() {
    return `You are an expert at analyzing Indian stock market TV channel videos.
Watch this entire video carefully, paying attention to BOTH:
1. AUDIO: What experts are saying about stocks
2. VISUAL: Text on screen showing expert names, stock tickers, prices, targets

This is from an Indian financial TV channel where market experts discuss and recommend stocks.
Languages: English and/or Hindi/Hinglish (mixed Hindi-English).

Extract ALL stock recommendations from this video. For each recommendation, identify:

1. **Expert Name** - Who is giving the recommendation. Look for:
   - Names displayed on screen (title cards, lower thirds)
   - Names mentioned verbally
   - Common experts: Anil Singhvi, Prakash Gaba, Sanjiv Bhasin, Ashish Chaturmohta, etc.

2. **Share/Stock Name** - Which stock is being recommended
   - Look at text on screen showing stock names/tickers
   - Listen for stock names mentioned
   - Use NSE symbol if visible (e.g., RELIANCE, TATAMOTORS, HDFCBANK)

3. **Action** - BUY, SELL, or HOLD
   - Hindi terms: "kharidna/kharido/buy karo" = BUY, "becho/sell karo" = SELL

4. **Prices** - Look carefully at screen graphics showing:
   - Entry/Buy Price
   - Target Price (lakshya)
   - Stop Loss (stoploss/SL)

5. **Timestamp** - When in the video this recommendation appears (in seconds from start)

6. **Reason** - Brief reasoning if given

7. **Confidence** - Your confidence in this extraction:
   - "high" = Clearly visible on screen AND spoken
   - "medium" = Either visible OR spoken clearly
   - "low" = Partially heard/seen

IMPORTANT:
- Extract EVERY stock recommendation you can find
- Pay special attention to text overlays showing prices and targets
- Include recommendations even if some fields are missing
- DO NOT include general market commentary without specific stocks
- Return empty array if no recommendations found

Respond with a JSON array in this exact format:
[
  {
    "expert_name": "string or null",
    "share_name": "string",
    "nse_symbol": "string or null",
    "action": "BUY|SELL|HOLD",
    "recommended_price": number or null,
    "target_price": number or null,
    "stop_loss": number or null,
    "reason": "string or null",
    "timestamp_seconds": number,
    "confidence": "low|medium|high"
  }
]`;
  },

  /**
   * Parse Gemini response into recommendations
   */
  parseRecommendations(responseText) {
    try {
      // Try to parse as JSON directly
      let recommendations = JSON.parse(responseText);

      if (!Array.isArray(recommendations)) {
        console.warn('Gemini response is not an array');
        return [];
      }

      // Validate and clean each recommendation
      return recommendations
        .filter(r => r && r.share_name && r.action)
        .map(r => ({
          expert_name: r.expert_name || 'Unknown Expert',
          share_name: this.normalizeShareName(r.share_name),
          nse_symbol: r.nse_symbol ? r.nse_symbol.toUpperCase().trim() : null,
          action: this.normalizeAction(r.action),
          recommended_price: this.parsePrice(r.recommended_price),
          target_price: this.parsePrice(r.target_price),
          stop_loss: this.parsePrice(r.stop_loss),
          reason: r.reason || null,
          timestamp_seconds: typeof r.timestamp_seconds === 'number' ? Math.floor(r.timestamp_seconds) : 0,
          confidence_score: this.confidenceToScore(r.confidence)
        }));
    } catch (error) {
      console.error('Failed to parse Gemini response:', error.message);
      console.error('Response was:', responseText.substring(0, 1000));

      // Try to extract JSON from text
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          return this.parseRecommendations(jsonMatch[0]);
        } catch (e) {
          return [];
        }
      }
      return [];
    }
  },

  /**
   * Analyze YouTube video directly by URL (no download/upload needed)
   * Uses Gemini 2.5 Flash which accepts YouTube URLs directly
   * @param {string} youtubeUrl - YouTube video URL
   * @returns {Object} - Analysis results
   */
  async analyzeYouTubeVideoByUrl(youtubeUrl) {
    console.log('Analyzing YouTube video directly via URL...');
    console.log(`Video: ${youtubeUrl}`);

    const prompt = this.buildAnalysisPrompt();

    const response = await fetch(`${GEMINI_GENERATE_URL_25}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                file_data: {
                  file_uri: youtubeUrl
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini URL analysis failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const recommendations = this.parseRecommendations(text);
    console.log(`Found ${recommendations.length} recommendations via Gemini URL method`);

    return {
      recommendations,
      method: 'gemini_url'
    };
  },

  /**
   * Full pipeline: Download, upload, analyze (fallback method)
   * @param {string} youtubeUrl - YouTube video URL
   * @param {string} tempDir - Temporary directory for files
   * @returns {Object} - Analysis results
   */
  async analyzeYouTubeVideo(youtubeUrl, tempDir) {
    const videoDir = path.join(tempDir, 'video');

    try {
      // Step 1: Download video
      console.log('Step 1: Downloading video...');
      const videoPath = await this.downloadVideo(youtubeUrl, videoDir);
      console.log(`Downloaded: ${videoPath}`);

      // Step 2: Upload to Gemini
      console.log('Step 2: Uploading to Gemini...');
      const uploadedFile = await this.uploadToGemini(videoPath);

      // Step 3: Wait for processing
      console.log('Step 3: Waiting for Gemini processing...');
      const processedFile = await this.waitForProcessing(uploadedFile);

      // Step 4: Analyze video
      console.log('Step 4: Analyzing video for recommendations...');
      const recommendations = await this.analyzeVideo(processedFile);

      console.log(`Found ${recommendations.length} recommendations via Gemini`);

      // Step 5: Delete file from Gemini (cleanup)
      await this.deleteFile(uploadedFile.name.replace('files/', '')).catch(() => {});

      return {
        recommendations,
        method: 'gemini_flash'
      };

    } finally {
      // Cleanup local files
      try {
        await fs.rm(videoDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  },

  /**
   * Analyze transcript text using Gemini (for YouTube Transcript API fallback)
   * Much more accurate than local Ollama for Hindi/Hinglish content
   * @param {string} transcriptText - Combined transcript text with timestamps
   * @returns {Array} - Extracted recommendations
   */
  async analyzeTranscriptWithGemini(transcriptText) {
    console.log('Analyzing transcript with Gemini...');

    const prompt = `You are an expert at analyzing Indian stock market TV channel transcripts.
Extract ALL stock recommendations from the following transcript.

The transcript is from a financial TV channel where market experts discuss stocks.
Languages: English and/or Hindi/Hinglish (mixed Hindi-English).

Timestamps are in format [MM:SS-MM:SS] before each segment. Use the START time for timestamp_seconds.

Extract EVERY stock recommendation. For each, identify:
1. **Expert Name** - Look for names like Anil Singhvi, Prakash Gaba, Sanjiv Bhasin, etc.
2. **Share/Stock Name** - Use NSE symbol if known (RELIANCE, TATAMOTORS, HDFCBANK)
3. **Action** - BUY, SELL, or HOLD
   - Hindi: "kharidna/kharido/buy karo" = BUY, "becho/sell karo" = SELL
4. **Prices** - Entry price, target price, stop loss (if mentioned)
5. **Timestamp** - START time in SECONDS (convert MM:SS to seconds, e.g., 05:30 = 330)
6. **Confidence** - high/medium/low based on clarity

IMPORTANT:
- timestamp_seconds MUST be a NUMBER (e.g., 330), NOT a string like "05:30"
- All price fields MUST be numbers or null, NOT strings or ranges
- Return valid JSON only

TRANSCRIPT:
---
${transcriptText}
---

Return ONLY a JSON array:
[
  {
    "expert_name": "string or null",
    "share_name": "string",
    "nse_symbol": "string or null",
    "action": "BUY",
    "recommended_price": 850.50,
    "target_price": 920,
    "stop_loss": 820,
    "reason": "string or null",
    "timestamp_seconds": 330,
    "confidence": "high"
  }
]

If no recommendations, return: []`;

    const response = await fetch(`${GEMINI_GENERATE_URL_25}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini transcript analysis failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    return this.parseRecommendations(text);
  },

  /**
   * Delete file from Gemini after analysis
   */
  async deleteFile(fileName) {
    await fetch(`${GEMINI_FILE_STATUS_URL}/${fileName}?key=${GEMINI_API_KEY}`, {
      method: 'DELETE'
    });
  },

  // Utility functions
  getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.m4a': 'audio/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };
    return mimeTypes[ext] || 'video/mp4';
  },

  normalizeShareName(name) {
    if (!name) return 'Unknown';
    return name.trim().replace(/\s+/g, ' ');
  },

  normalizeAction(action) {
    if (!action) return 'BUY';
    const normalized = action.toUpperCase().trim();
    if (['BUY', 'SELL', 'HOLD'].includes(normalized)) {
      return normalized;
    }
    return 'BUY';
  },

  parsePrice(price) {
    if (price === null || price === undefined) return null;
    if (typeof price === 'number') return price;

    const cleaned = String(price).replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  },

  confidenceToScore(confidence) {
    const scores = {
      'high': 0.9,
      'medium': 0.7,
      'low': 0.5
    };
    return scores[confidence?.toLowerCase()] || 0.5;
  },

  /**
   * Map common stock names to NSE symbols
   */
  mapToNSESymbol(shareName) {
    const symbolMap = {
      'reliance': 'RELIANCE',
      'reliance industries': 'RELIANCE',
      'tata motors': 'TATAMOTORS',
      'tata steel': 'TATASTEEL',
      'hdfc bank': 'HDFCBANK',
      'hdfc': 'HDFCBANK',
      'icici bank': 'ICICIBANK',
      'icici': 'ICICIBANK',
      'infosys': 'INFY',
      'tcs': 'TCS',
      'tata consultancy': 'TCS',
      'wipro': 'WIPRO',
      'sbi': 'SBIN',
      'state bank': 'SBIN',
      'bharti airtel': 'BHARTIARTL',
      'airtel': 'BHARTIARTL',
      'itc': 'ITC',
      'asian paints': 'ASIANPAINT',
      'maruti': 'MARUTI',
      'maruti suzuki': 'MARUTI',
      'axis bank': 'AXISBANK',
      'kotak': 'KOTAKBANK',
      'kotak mahindra': 'KOTAKBANK',
      'larsen': 'LT',
      'l&t': 'LT',
      'sun pharma': 'SUNPHARMA',
      'bajaj finance': 'BAJFINANCE',
      'bajaj finserv': 'BAJAJFINSV',
      'hul': 'HINDUNILVR',
      'hindustan unilever': 'HINDUNILVR',
      'ongc': 'ONGC',
      'ntpc': 'NTPC',
      'power grid': 'POWERGRID',
      'adani ports': 'ADANIPORTS',
      'adani enterprises': 'ADANIENT',
      'adani green': 'ADANIGREEN'
    };

    const normalized = shareName.toLowerCase().trim();
    return symbolMap[normalized] || null;
  }
};

export default geminiVideoService;
