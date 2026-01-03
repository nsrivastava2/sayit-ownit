#!/usr/bin/env node
/**
 * Batch Video Processor
 *
 * Processes all videos from a CSV file using the existing queueService.
 * Updates the CSV with processing status after each video.
 *
 * Usage: node batch_process_videos.js [csv_path] [--dry-run] [--limit N] [--skip-processed]
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import services from our backend
import { db, config } from '../src/config/index.js';
import videoService from '../src/services/videoService.js';
import geminiVideoService from '../src/services/geminiVideoService.js';
import { youtubeTranscriptService } from '../src/services/youtubeTranscriptService.js';
import { expertService } from '../src/services/expertService.js';
import { recommendationValidator } from '../src/services/recommendationValidator.js';

// Default CSV path
const DEFAULT_CSV = path.resolve(__dirname, '../../zee_business_market_streams_2025.csv');

// Parse command line arguments
const args = process.argv.slice(2);
const csvPath = args.find(a => !a.startsWith('--')) || DEFAULT_CSV;
const dryRun = args.includes('--dry-run');
const skipProcessed = args.includes('--skip-processed');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

// CSV column indices (will be set after reading header)
let COLUMNS = {};

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

/**
 * Convert array back to CSV line
 */
function toCSVLine(fields) {
  return fields.map(field => {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(',');
}

/**
 * Read and parse CSV file
 */
async function readCSV(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Parse header
  const header = parseCSVLine(lines[0]);

  // Create column index map
  header.forEach((col, idx) => {
    COLUMNS[col.trim()] = idx;
  });

  // Add new columns if not present
  const newColumns = ['Process Status', 'Recommendations', 'Model Used', 'Processed At', 'Error'];
  for (const col of newColumns) {
    if (!(col in COLUMNS)) {
      COLUMNS[col] = header.length;
      header.push(col);
    }
  }

  // Parse data rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    // Extend fields to match header length
    while (fields.length < header.length) {
      fields.push('');
    }
    rows.push(fields);
  }

  return { header, rows };
}

/**
 * Write CSV file
 */
async function writeCSV(filePath, header, rows) {
  const lines = [toCSVLine(header)];
  for (const row of rows) {
    lines.push(toCSVLine(row));
  }
  await fs.writeFile(filePath, lines.join('\n') + '\n');
}

/**
 * Process a single video using our existing services
 */
async function processVideo(url, videoId) {
  console.log(`\n  📹 Processing: ${videoId}`);

  // Step 1: Get video info
  console.log('    ↳ Getting video info...');
  const videoInfo = await videoService.getVideoInfo(url);

  // Parse publish date
  let publishDate = null;
  if (videoInfo.uploadDate && videoInfo.uploadDate.length === 8) {
    publishDate = `${videoInfo.uploadDate.slice(0, 4)}-${videoInfo.uploadDate.slice(4, 6)}-${videoInfo.uploadDate.slice(6, 8)}`;
  }

  // Step 2: Check if video exists, or create it
  let video = await db.getVideoByUrl(url);
  if (!video) {
    console.log('    ↳ Creating video record...');
    video = await db.createVideo({
      youtube_url: url,
      title: videoInfo.title,
      channel_name: videoInfo.channelName,
      video_type: videoInfo.isLive ? 'live' : 'recorded',
      duration_seconds: videoInfo.duration,
      language: videoInfo.language,
      status: 'pending',
      publish_date: publishDate
    });
  } else if (video.status === 'completed') {
    // Already processed
    const recCount = await db.query(
      'SELECT COUNT(*) as count FROM recommendations WHERE video_id = $1',
      [video.id]
    );
    return {
      status: 'already_processed',
      recommendations: parseInt(recCount.rows[0].count),
      modelUsed: video.model_used || 'unknown'
    };
  }

  // Step 3: Try to get transcript first (free method)
  console.log('    ↳ Fetching transcript...');
  let transcript = null;
  let analysisMethod = 'transcript';

  try {
    transcript = await youtubeTranscriptService.fetchTranscript(url);
    if (transcript && transcript.segments && transcript.segments.length > 0) {
      console.log(`    ↳ Got transcript: ${transcript.segments.length} segments`);
    } else {
      transcript = null;
    }
  } catch (err) {
    console.log(`    ↳ Transcript fetch failed: ${err.message}`);
    transcript = null;
  }

  // Step 4: Analyze with Gemini
  console.log('    ↳ Analyzing with Gemini Flash-Lite...');
  let recommendations = [];
  let modelUsed = 'flash-lite';

  if (transcript && transcript.segments && transcript.segments.length > 0) {
    // Use transcript analysis (cheaper)
    const result = await geminiVideoService.analyzeTranscriptWithGemini(
      transcript.segments,
      videoInfo.channelName,
      'flash-lite'
    );
    recommendations = result.recommendations || [];
    modelUsed = result.modelKey || 'flash-lite';
  } else {
    // Fall back to video analysis (more expensive, only for shorter videos)
    if (videoInfo.duration > 3600) {
      throw new Error(`Video too long (${Math.round(videoInfo.duration/60)}min) and no transcript available`);
    }
    analysisMethod = 'video';
    const result = await geminiVideoService.analyzeYouTubeVideoByUrl(url, videoInfo.channelName, 'flash');
    recommendations = result.recommendations || [];
    modelUsed = result.modelKey || 'flash';
  }

  console.log(`    ↳ Found ${recommendations.length} recommendations`);

  // Step 5: Get recommendation date from publish date
  let recommendationDate;
  if (publishDate) {
    recommendationDate = publishDate;
  } else {
    const today = new Date();
    recommendationDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  // Step 6: Validate and save recommendations (matching queueService exactly)
  let savedCount = 0;
  for (const rec of recommendations) {
    try {
      // Resolve expert name using expertService (maps aliases to canonical names)
      const expertResolution = await expertService.resolveExpertName(
        rec.expert_name,
        video.id,
        rec.timestamp_seconds
      );

      // Validate recommendation before saving
      const flagReasons = recommendationValidator.validate(rec);
      const isFlagged = flagReasons.length > 0;

      // Save to database (exact same structure as queueService)
      await db.createRecommendation({
        video_id: video.id,
        expert_name: expertResolution.name,
        recommendation_date: recommendationDate,
        share_name: rec.share_name,
        nse_symbol: rec.nse_symbol || geminiVideoService.mapToNSESymbol(rec.share_name),
        action: rec.action,
        recommended_price: rec.recommended_price,
        target_price: rec.target_price,
        stop_loss: rec.stop_loss,
        reason: rec.reason,
        confidence_score: rec.confidence_score,
        timestamp_in_video: rec.timestamp_seconds,
        raw_extract: JSON.stringify(rec),
        is_flagged: isFlagged,
        flag_reasons: isFlagged ? flagReasons : null,
        tags: rec.tags || null,
        timeline: rec.timeline || null
      });
      savedCount++;
    } catch (e) {
      console.log(`    ↳ Failed to save recommendation: ${e.message}`);
    }
  }

  // Step 7: Save transcript chunks (matching queueService format)
  if (transcript && transcript.segments) {
    try {
      const chunkSize = 50;
      for (let i = 0; i < transcript.segments.length; i += chunkSize) {
        const chunk = transcript.segments.slice(i, i + chunkSize);
        const chunkText = chunk.map(s => s.text).join(' ');
        const startTime = chunk[0]?.offset || chunk[0]?.start || 0;
        const endTime = chunk[chunk.length - 1]?.offset || chunk[chunk.length - 1]?.end || startTime;

        await db.createTranscript({
          video_id: video.id,
          chunk_index: Math.floor(i / chunkSize),
          start_time_seconds: startTime,
          end_time_seconds: endTime,
          transcript_text: chunkText,
          language_detected: transcript.language || 'hi'
        });
      }
    } catch (e) {
      console.log(`    ↳ Failed to save transcript: ${e.message}`);
    }
  }

  // Step 8: Update video status
  await db.updateVideo(video.id, {
    status: 'completed',
    model_used: modelUsed
  });

  return {
    status: 'completed',
    recommendations: savedCount,
    modelUsed,
    analysisMethod
  };
}

/**
 * Main batch processing function
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║         Batch Video Processor - SayIt OwnIt            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`📂 CSV File: ${csvPath}`);
  console.log(`🔧 Options: ${dryRun ? 'DRY RUN' : 'LIVE'} | Limit: ${limit || 'none'} | Skip Processed: ${skipProcessed}`);

  // Read CSV
  console.log('\n📖 Reading CSV file...');
  const { header, rows } = await readCSV(csvPath);
  console.log(`   Found ${rows.length} videos in CSV`);
  console.log(`   Columns: ${header.join(', ')}`);

  // Get already processed URLs from database
  const existingResult = await db.query('SELECT youtube_url FROM videos WHERE status = $1', ['completed']);
  const processedUrls = new Set(existingResult.rows.map(r => r.youtube_url));
  console.log(`   ${processedUrls.size} videos already in database`);

  // Filter rows to process
  let toProcess = rows.filter((row, idx) => {
    const url = row[COLUMNS['URL']];
    const status = row[COLUMNS['Process Status']];

    // Skip if already processed in CSV
    if (skipProcessed && status === 'completed') {
      return false;
    }

    // Skip if already in database
    if (processedUrls.has(url)) {
      // Update CSV row to reflect existing status
      row[COLUMNS['Process Status']] = 'completed';
      return false;
    }

    return true;
  });

  // Apply limit
  if (limit && limit > 0) {
    toProcess = toProcess.slice(0, limit);
  }

  console.log(`   ${toProcess.length} videos to process\n`);

  if (dryRun) {
    console.log('🔍 DRY RUN - Would process these videos:');
    for (const row of toProcess.slice(0, 10)) {
      console.log(`   - ${row[COLUMNS['Video ID']]}: ${row[COLUMNS['Title']].slice(0, 60)}...`);
    }
    if (toProcess.length > 10) {
      console.log(`   ... and ${toProcess.length - 10} more`);
    }
    return;
  }

  // Process each video
  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of toProcess) {
    const url = row[COLUMNS['URL']];
    const videoId = row[COLUMNS['Video ID']];
    const title = row[COLUMNS['Title']];

    console.log(`\n[${ processed + failed + skipped + 1}/${toProcess.length}] ${title.slice(0, 50)}...`);

    try {
      const result = await processVideo(url, videoId);

      if (result.status === 'already_processed') {
        skipped++;
        row[COLUMNS['Process Status']] = 'completed';
        row[COLUMNS['Recommendations']] = result.recommendations;
        row[COLUMNS['Model Used']] = result.modelUsed;
        console.log(`    ✓ Already processed (${result.recommendations} recs)`);
      } else {
        processed++;
        row[COLUMNS['Process Status']] = 'completed';
        row[COLUMNS['Recommendations']] = result.recommendations;
        row[COLUMNS['Model Used']] = result.modelUsed;
        row[COLUMNS['Processed At']] = new Date().toISOString();
        console.log(`    ✓ Completed: ${result.recommendations} recommendations (${result.analysisMethod})`);
      }
    } catch (error) {
      failed++;
      row[COLUMNS['Process Status']] = 'failed';
      row[COLUMNS['Error']] = error.message;
      row[COLUMNS['Processed At']] = new Date().toISOString();
      console.log(`    ✗ Failed: ${error.message}`);
    }

    // Save CSV after each video (in case of crash)
    await writeCSV(csvPath, header, rows);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Final summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                   Processing Complete                  ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`   ✓ Processed: ${processed}`);
  console.log(`   ⊘ Skipped:   ${skipped}`);
  console.log(`   ✗ Failed:    ${failed}`);
  console.log(`   📂 CSV updated: ${csvPath}\n`);
}

// Run
main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
