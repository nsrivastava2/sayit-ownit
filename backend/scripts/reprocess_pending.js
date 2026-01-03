#!/usr/bin/env node
/**
 * Reprocess Pending Videos
 *
 * Processes all pending videos from the database using the existing services.
 * This avoids CSV dependency and processes directly from DB.
 */

import { db } from '../src/config/index.js';
import geminiVideoService from '../src/services/geminiVideoService.js';
import { youtubeTranscriptService } from '../src/services/youtubeTranscriptService.js';
import { expertService } from '../src/services/expertService.js';
import { recommendationValidator } from '../src/services/recommendationValidator.js';

const args = process.argv.slice(2);
const limit = args.find(a => a.startsWith('--limit='))?.split('=')[1] || null;
const offset = args.find(a => a.startsWith('--offset='))?.split('=')[1] || null;
const dryRun = args.includes('--dry-run');

async function processVideo(video) {
  console.log(`\n📹 Processing: ${video.title?.slice(0, 60)}...`);
  console.log(`   ID: ${video.id} | Duration: ${Math.round(video.duration_seconds / 60)}min`);

  // Step 1: Check for existing transcript in database first
  console.log('   ↳ Checking for stored transcript...');
  let transcript = null;

  // Try to get from database first
  const storedTranscripts = await db.query(
    'SELECT chunk_index, start_time_seconds, end_time_seconds, transcript_text FROM transcripts WHERE video_id = $1 ORDER BY chunk_index',
    [video.id]
  );

  if (storedTranscripts.rows.length > 0) {
    // Use stored transcripts - convert chunks to segments format
    console.log(`   ↳ Found ${storedTranscripts.rows.length} stored transcript chunks`);
    transcript = {
      segments: storedTranscripts.rows.map(row => ({
        text: row.transcript_text,
        offset: row.start_time_seconds,
        start: row.start_time_seconds,
        end: row.end_time_seconds
      })),
      language: 'hi'
    };
  } else {
    // Fetch new transcript if not in database
    console.log('   ↳ No stored transcript, fetching from YouTube...');
    try {
      transcript = await youtubeTranscriptService.fetchTranscript(video.youtube_url);
      if (transcript?.segments?.length > 0) {
        console.log(`   ↳ Got ${transcript.segments.length} segments`);
      } else {
        transcript = null;
      }
    } catch (err) {
      console.log(`   ↳ Transcript failed: ${err.message}`);
    }
  }

  if (!transcript || !transcript.segments?.length) {
    if (video.duration_seconds > 3600) {
      throw new Error(`Video too long (${Math.round(video.duration_seconds/60)}min) and no transcript`);
    }
    throw new Error('No transcript available and video too long for direct analysis');
  }

  // Step 2: Format transcript text with timestamps (same as queueService)
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Batch segments and format as text
  const batchSize = 50;
  let allRecommendations = [];

  for (let i = 0; i < transcript.segments.length; i += batchSize) {
    const batch = transcript.segments.slice(i, i + batchSize);
    const batchText = batch
      .map(s => {
        // Use startTime/endTime from youtubeTranscriptService, fallback to offset/start/end for DB-stored data
        const startTime = s.startTime || s.offset || s.start || 0;
        const endTime = s.endTime || s.end || startTime + 30;
        return `[${formatTime(startTime)}-${formatTime(endTime)}] ${s.text}`;
      })
      .join('\n\n');

    console.log(`   ↳ Analyzing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transcript.segments.length / batchSize)}...`);

    const result = await geminiVideoService.analyzeTranscriptWithGemini(
      batchText,
      video.channel_name,
      video.title,
      'flash-3.0'  // Using Gemini 3.0 Flash - best quality for Hindi
    );

    if (result.recommendations?.length > 0) {
      allRecommendations.push(...result.recommendations);
    }
  }

  const recommendations = allRecommendations;
  console.log(`   ↳ Found ${recommendations.length} recommendations`);

  // Step 3: Get recommendation date
  let recommendationDate;
  if (video.publish_date) {
    const pubDate = new Date(video.publish_date);
    recommendationDate = `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}-${String(pubDate.getDate()).padStart(2, '0')}`;
  } else {
    const today = new Date();
    recommendationDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  // Step 4: Save recommendations
  let savedCount = 0;
  for (const rec of recommendations) {
    try {
      // Resolve expert name
      const expertResolution = await expertService.resolveExpertName(
        rec.expert_name,
        video.id,
        rec.timestamp_seconds
      );

      // Validate
      const flagReasons = recommendationValidator.validate(rec);
      const isFlagged = flagReasons.length > 0;

      // Save
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
      console.log(`   ↳ Failed to save: ${e.message}`);
    }
  }

  // Step 5: Save transcript chunks (only if not already stored)
  if (transcript?.segments && storedTranscripts.rows.length === 0) {
    console.log('   ↳ Saving transcript chunks...');
    const chunkSize = 50;
    for (let i = 0; i < transcript.segments.length; i += chunkSize) {
      const chunk = transcript.segments.slice(i, i + chunkSize);
      const chunkText = chunk.map(s => s.text).join(' ');
      // Use startTime/endTime from youtubeTranscriptService, fallback to offset/start/end for DB-stored data
      const startTime = chunk[0]?.startTime || chunk[0]?.offset || chunk[0]?.start || 0;
      const endTime = chunk[chunk.length - 1]?.endTime || chunk[chunk.length - 1]?.offset || chunk[chunk.length - 1]?.end || startTime;

      await db.createTranscript({
        video_id: video.id,
        chunk_index: Math.floor(i / chunkSize),
        start_time_seconds: startTime,
        end_time_seconds: endTime,
        transcript_text: chunkText,
        language_detected: transcript.language || 'hi'
      });
    }
  }

  // Step 6: Mark as completed
  await db.updateVideo(video.id, {
    status: 'completed',
    model_used: 'flash-3.0'
  });

  return savedCount;
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║        Reprocess Pending Videos - SayIt OwnIt         ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Get pending videos
  let query = 'SELECT * FROM videos WHERE status = $1 ORDER BY publish_date DESC';
  const params = ['pending'];

  const result = await db.query(query, params);
  let videos = result.rows;

  // Apply offset first, then limit
  if (offset) {
    videos = videos.slice(parseInt(offset));
  }
  if (limit) {
    videos = videos.slice(0, parseInt(limit));
  }

  console.log(`Found ${videos.length} pending videos to process${offset ? ` (offset: ${offset})` : ''}${limit ? ` (limit: ${limit})` : ''}`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN - Would process:');
    videos.slice(0, 10).forEach(v => console.log(`  - ${v.title?.slice(0, 60)}...`));
    if (videos.length > 10) console.log(`  ... and ${videos.length - 10} more`);
    return;
  }

  let processed = 0, failed = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    console.log(`\n[${i + 1}/${videos.length}]`);

    // Lock the video by setting status to 'processing'
    const lockResult = await db.query(
      "UPDATE videos SET status = 'processing' WHERE id = $1 AND status = 'pending' RETURNING id",
      [video.id]
    );

    if (lockResult.rows.length === 0) {
      console.log(`   ⏭ Skipped (already being processed)`);
      continue;
    }

    try {
      const count = await processVideo(video);
      console.log(`   ✓ Saved ${count} recommendations`);
      processed++;
    } catch (err) {
      console.log(`   ✗ Failed: ${err.message}`);
      await db.updateVideo(video.id, { status: 'failed' });
      failed++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║                  Processing Complete                  ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`  ✓ Processed: ${processed}`);
  console.log(`  ✗ Failed: ${failed}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
