#!/usr/bin/env node
/**
 * Process videos that already have transcripts stored in DB
 * Fast path - LLM analysis only, no YouTube fetch needed
 */

import { db } from '../src/config/index.js';
import geminiVideoService from '../src/services/geminiVideoService.js';
import { expertService } from '../src/services/expertService.js';
import { recommendationValidator } from '../src/services/recommendationValidator.js';

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function processVideo(video, transcriptChunks) {
  console.log(`\n📹 Processing: ${video.title?.slice(0, 60)}...`);
  console.log(`   ID: ${video.id} | Chunks: ${transcriptChunks.length}`);

  // Convert DB chunks to segments format
  const segments = transcriptChunks.map(row => ({
    text: row.transcript_text,
    startTime: row.start_time_seconds,
    endTime: row.end_time_seconds
  }));

  // Batch and analyze
  const batchSize = 50;
  let allRecommendations = [];

  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);
    const batchText = batch
      .map(s => {
        const start = s.startTime || 0;
        const end = s.endTime || start + 30;
        return `[${formatTime(start)}-${formatTime(end)}] ${s.text}`;
      })
      .join('\n\n');

    console.log(`   ↳ Analyzing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(segments.length / batchSize)}...`);

    const result = await geminiVideoService.analyzeTranscriptWithGemini(
      batchText,
      video.channel_name,
      video.title,
      'flash-3.0'
    );

    if (result.recommendations?.length > 0) {
      allRecommendations.push(...result.recommendations);
    }
  }

  console.log(`   ↳ Found ${allRecommendations.length} recommendations`);

  // Get recommendation date
  let recommendationDate;
  if (video.publish_date) {
    const pubDate = new Date(video.publish_date);
    recommendationDate = `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}-${String(pubDate.getDate()).padStart(2, '0')}`;
  } else {
    const today = new Date();
    recommendationDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  // Save recommendations
  let savedCount = 0;
  for (const rec of allRecommendations) {
    try {
      const expertResolution = await expertService.resolveExpertName(
        rec.expert_name,
        video.id,
        rec.timestamp_seconds
      );

      const flagReasons = recommendationValidator.validate(rec);
      const isFlagged = flagReasons.length > 0;

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

  // Mark as completed
  await db.updateVideo(video.id, {
    status: 'completed',
    model_used: 'flash-3.0'
  });

  return savedCount;
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║   Process Videos WITH Stored Transcripts (Fast Path)  ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Get videos that have transcripts stored
  const result = await db.query(`
    SELECT DISTINCT v.*
    FROM videos v
    INNER JOIN transcripts t ON t.video_id = v.id
    WHERE v.status = 'pending'
    ORDER BY v.publish_date DESC
  `);

  const videos = result.rows;
  console.log(`Found ${videos.length} videos with stored transcripts\n`);

  let processed = 0, failed = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    console.log(`\n[${i + 1}/${videos.length}]`);

    // Get transcript chunks for this video
    const transcripts = await db.query(
      'SELECT * FROM transcripts WHERE video_id = $1 ORDER BY chunk_index',
      [video.id]
    );

    try {
      const count = await processVideo(video, transcripts.rows);
      console.log(`   ✓ Saved ${count} recommendations`);
      processed++;
    } catch (err) {
      console.log(`   ✗ Failed: ${err.message}`);
      await db.updateVideo(video.id, { status: 'failed' });
      failed++;
    }

    await new Promise(r => setTimeout(r, 500));
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
