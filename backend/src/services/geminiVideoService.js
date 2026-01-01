/**
 * Gemini Flash Video Analysis Service
 * Directly analyzes YouTube videos for stock recommendations
 * using Gemini's multimodal capabilities (sees audio + visual)
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { promptService } from './promptService.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_FILE_API_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const GEMINI_FILE_STATUS_URL = 'https://generativelanguage.googleapis.com/v1beta/files';

// Model configurations - Flash-Lite is default (3x cheaper, same quality for Hindi)
const GEMINI_MODELS = {
  'flash-lite': {
    name: 'gemini-2.0-flash-lite',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',
    description: 'Flash-Lite 2.0 - Fast, cost-effective, great for Hindi (default)',
    costPerMillion: 0.10
  },
  'flash': {
    name: 'gemini-2.0-flash',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    description: 'Flash 2.0 - Standard model, slightly better reasoning',
    costPerMillion: 0.30
  },
  'flash-25': {
    name: 'gemini-2.5-flash',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    description: 'Flash 2.5 - Latest model, best quality',
    costPerMillion: 0.30
  }
};

// Default model - Flash-Lite for cost efficiency
const DEFAULT_MODEL = process.env.GEMINI_DEFAULT_MODEL || 'flash-lite';

export const geminiVideoService = {
  /**
   * Get available models for admin UI
   */
  getAvailableModels() {
    return Object.entries(GEMINI_MODELS).map(([key, model]) => ({
      id: key,
      name: model.name,
      description: model.description,
      costPerMillion: model.costPerMillion,
      isDefault: key === DEFAULT_MODEL
    }));
  },

  /**
   * Get model configuration by key
   */
  getModel(modelKey = DEFAULT_MODEL) {
    return GEMINI_MODELS[modelKey] || GEMINI_MODELS[DEFAULT_MODEL];
  },

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
   * @param {string} channelName - Channel name for loading channel-specific prompt
   * @returns {Array} - Extracted recommendations
   */
  async analyzeVideo(fileInfo, channelName = null) {
    console.log('Sending video to Gemini for analysis...');

    const prompt = await this.buildAnalysisPrompt(channelName);

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
   * @param {string} channelName - Channel name for loading channel-specific prompt
   * @returns {Promise<string>} - The prompt content
   */
  async buildAnalysisPrompt(channelName = null) {
    // Load channel-specific prompt from markdown file
    const promptContent = await promptService.loadPrompt(channelName);
    return promptContent;
  },

  /**
   * Parse Gemini response into recommendations
   * Handles truncated JSON responses gracefully
   */
  parseRecommendations(responseText) {
    // Items to exclude (commodities, indices, derivatives)
    const excludePatterns = [
      /\bgold\b/i, /\bsilver\b/i, /\bcrude\b/i, /\bnatural gas\b/i,
      /\bcopper\b/i, /\bzinc\b/i, /\baluminium\b/i, /\blead\b/i,
      /\bnifty\b/i, /\bsensex\b/i, /\bbank nifty\b/i, /\bnifty\s*(50|100|it|bank|fin)/i,
      /\b(call|put)\s*option/i, /\bfutures?\b/i, /\b(ce|pe)\b/i,
      /\bdollar\b/i, /\brupee\b/i, /\beur\b/i, /\bbitcoin\b/i, /\bethererum\b/i,
      /\bbullion\b/i, /\bcommodity\b/i, /\bcommodities\b/i
    ];

    const validateAndClean = (recommendations) => {
      if (!Array.isArray(recommendations)) return [];

      return recommendations
        .filter(r => {
          if (!r || !r.share_name || !r.action) return false;

          const hasPrice = r.recommended_price || r.target_price || r.stop_loss;
          if (!hasPrice) return false;

          const shareName = r.share_name.toLowerCase();
          for (const pattern of excludePatterns) {
            if (pattern.test(shareName) || pattern.test(r.nse_symbol || '')) {
              return false;
            }
          }

          const action = (r.action || '').toUpperCase().trim();
          if (action === 'HOLD' && !r.target_price) return false;

          return true;
        })
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
          confidence_score: this.confidenceToScore(r.confidence),
          tags: Array.isArray(r.tags) ? r.tags : null,
          timeline: this.normalizeTimeline(r.timeline)
        }));
    };

    // Strategy 1: Try direct parse
    try {
      const recommendations = JSON.parse(responseText);
      if (Array.isArray(recommendations)) {
        return validateAndClean(recommendations);
      }
    } catch (e) {
      // Continue to recovery strategies
    }

    // Strategy 2: Extract individual complete JSON objects from truncated response
    // This handles cases where response is cut off mid-array
    const extractedRecs = [];
    const objectRegex = /\{[^{}]*"share_name"\s*:\s*"[^"]+\"[^{}]*\}/g;
    let match;

    while ((match = objectRegex.exec(responseText)) !== null) {
      try {
        const obj = JSON.parse(match[0]);
        if (obj.share_name && obj.action) {
          extractedRecs.push(obj);
        }
      } catch (e) {
        // Skip malformed objects
      }
    }

    if (extractedRecs.length > 0) {
      console.log(`Recovered ${extractedRecs.length} recommendations from truncated JSON`);
      return validateAndClean(extractedRecs);
    }

    // Strategy 3: Try to repair truncated JSON
    let repairedText = responseText.trim();

    // Remove markdown code blocks if present
    repairedText = repairedText.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');

    // Try to fix common truncation issues
    // Count brackets to see what's missing
    const openBrackets = (repairedText.match(/\[/g) || []).length;
    const closeBrackets = (repairedText.match(/\]/g) || []).length;
    const openBraces = (repairedText.match(/\{/g) || []).length;
    const closeBraces = (repairedText.match(/\}/g) || []).length;

    // If truncated mid-string, try to close it
    const lastQuote = repairedText.lastIndexOf('"');
    const lastColon = repairedText.lastIndexOf(':');
    if (lastColon > lastQuote) {
      // Likely truncated after a key, add null value
      repairedText += 'null';
    }

    // Add missing closing braces and brackets
    for (let i = 0; i < openBraces - closeBraces; i++) {
      repairedText += '}';
    }
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      repairedText += ']';
    }

    // Remove trailing commas before closing brackets
    repairedText = repairedText.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');

    try {
      const recommendations = JSON.parse(repairedText);
      if (Array.isArray(recommendations)) {
        console.log(`Repaired truncated JSON, found ${recommendations.length} items`);
        return validateAndClean(recommendations);
      }
    } catch (e) {
      console.log('JSON repair failed:', e.message);
    }

    // Strategy 4: Last resort - try to find any valid array in the text
    const arrayMatch = responseText.match(/\[[\s\S]*?\]/);
    if (arrayMatch) {
      try {
        const arr = JSON.parse(arrayMatch[0]);
        if (Array.isArray(arr)) {
          return validateAndClean(arr);
        }
      } catch (e) {
        // Give up
      }
    }

    console.log('Could not parse Gemini response after all recovery attempts');
    return [];
  },

  /**
   * Analyze YouTube video directly by URL (no download/upload needed)
   * Uses Gemini models which accept YouTube URLs directly
   * @param {string} youtubeUrl - YouTube video URL
   * @param {string} channelName - Channel name for loading channel-specific prompt
   * @param {string} modelKey - Model to use: 'flash-lite' (default), 'flash', or 'flash-25'
   * @returns {Object} - Analysis results
   */
  async analyzeYouTubeVideoByUrl(youtubeUrl, channelName = null, modelKey = DEFAULT_MODEL) {
    const model = this.getModel(modelKey);
    console.log(`Analyzing YouTube video directly via URL with ${model.name}...`);
    console.log(`Video: ${youtubeUrl}`);

    const prompt = await this.buildAnalysisPrompt(channelName);

    const response = await fetch(`${model.url}?key=${GEMINI_API_KEY}`, {
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
      throw new Error(`Gemini URL analysis failed (${model.name}): ${response.status} - ${error}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const recommendations = this.parseRecommendations(text);
    console.log(`Found ${recommendations.length} recommendations via ${model.name} URL method`);

    return {
      recommendations,
      method: 'gemini_url',
      model: model.name,
      modelKey
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
   * @param {string} channelName - Channel name for loading channel-specific prompt
   * @param {string} videoTitle - Video title (helps identify expert from title like "Anil Singhvi's Pick")
   * @param {string} modelKey - Model to use: 'flash-lite' (default), 'flash', or 'flash-25'
   * @returns {Object} - { recommendations: Array, model: string }
   */
  async analyzeTranscriptWithGemini(transcriptText, channelName = null, videoTitle = null, modelKey = DEFAULT_MODEL) {
    const model = this.getModel(modelKey);
    console.log(`Analyzing transcript with ${model.name}...`);

    // Load channel-specific prompt
    const basePrompt = await promptService.loadPrompt(channelName);

    // Add video title context if available (helps identify expert from title)
    const videoContext = videoTitle
      ? `VIDEO TITLE: "${videoTitle}"
IMPORTANT: If the video title contains an expert's name (e.g., "Anil Singhvi's Pick", "Sandeep Jain's Stock"), use that person as the expert_name for recommendations in this video, unless a DIFFERENT expert is explicitly introduced in the transcript speaking about a specific stock.

`
      : '';

    // Add transcript-specific context
    const prompt = `${basePrompt}

${videoContext}TRANSCRIPT (Hindi/Hinglish - timestamps in [MM:SS-MM:SS] format):
---
${transcriptText}
---

Extract ONLY actionable stock recommendations. Convert MM:SS to seconds (05:30 = 330).`;

    const response = await fetch(`${model.url}?key=${GEMINI_API_KEY}`, {
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
      throw new Error(`Gemini transcript analysis failed (${model.name}): ${response.status} - ${error}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    const recommendations = this.parseRecommendations(text);

    return {
      recommendations,
      model: model.name,
      modelKey
    };
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

  normalizeTimeline(timeline) {
    if (!timeline) return 'SHORT_TERM';
    const normalized = timeline.toUpperCase().trim().replace(/\s+/g, '_');
    const validTimelines = ['INTRADAY', 'BTST', 'SHORT_TERM', 'POSITIONAL', 'MEDIUM_TERM', 'LONG_TERM'];
    if (validTimelines.includes(normalized)) {
      return normalized;
    }
    // Handle common variations
    if (normalized.includes('INTRA') || normalized.includes('DAY')) return 'INTRADAY';
    if (normalized.includes('SHORT')) return 'SHORT_TERM';
    if (normalized.includes('MEDIUM')) return 'MEDIUM_TERM';
    if (normalized.includes('LONG') || normalized.includes('INVEST')) return 'LONG_TERM';
    if (normalized.includes('POSITION') || normalized.includes('SWING')) return 'POSITIONAL';
    return 'SHORT_TERM';
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
