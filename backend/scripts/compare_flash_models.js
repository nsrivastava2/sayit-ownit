/**
 * Compare Gemini Flash vs Flash-Lite for Hindi transcript analysis
 * Tests both models on the same Hindi/Hinglish stock market transcript
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Extraction prompt (same for both models)
const EXTRACTION_PROMPT = `You are an expert at extracting stock recommendations from Hindi/Hinglish financial TV transcripts.

Analyze this transcript and extract ALL stock recommendations mentioned.
For each recommendation, identify:
- Stock name (in English if possible)
- Expert name who gave the recommendation
- Action (BUY/SELL/HOLD)
- Entry price (if mentioned)
- Target price (if mentioned)
- Stop loss (if mentioned)
- Any time horizon mentioned

IMPORTANT:
- The text is Hindi/Hinglish (Hindi written in Devanagari with some English words)
- Stock names are often in English even in Hindi sentences
- Expert names like "Anil Singhvi", "Siddharth Sedani" etc.
- Look for keywords: खरीदें (buy), बेचें (sell), टारगेट (target), स्टॉप लॉस (stop loss)

Return a JSON array of recommendations. If no specific stock recommendations found, return empty array [].

Example output format:
[
  {
    "stock_name": "HDFC Bank",
    "expert_name": "Anil Singhvi",
    "action": "BUY",
    "entry_price": 1650,
    "target_price": 1750,
    "stop_loss": 1600,
    "horizon": "1-2 weeks",
    "reasoning": "Strong support at current levels"
  }
]

Transcript to analyze:
`;

async function analyzeWithModel(modelName, text) {
  const startTime = Date.now();

  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await model.generateContent(EXTRACTION_PROMPT + text);
  const response = result.response.text();

  const duration = Date.now() - startTime;

  // Try to parse JSON from response
  let recommendations = [];
  try {
    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      recommendations = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.log(`  Warning: Could not parse JSON from ${modelName}`);
  }

  return {
    model: modelName,
    duration,
    rawResponse: response,
    recommendations,
    tokenEstimate: Math.ceil(text.length / 4) // rough estimate
  };
}

async function main() {
  console.log('═'.repeat(70));
  console.log('  GEMINI FLASH vs FLASH-LITE: Hindi Transcript Comparison Test');
  console.log('═'.repeat(70));

  // Read sample transcript
  const sampleText = await fs.readFile('/tmp/hindi_transcript_sample.txt', 'utf-8');
  console.log(`\nSample text length: ${sampleText.length} chars (~${Math.ceil(sampleText.length/4)} tokens)`);
  console.log('\nSample preview (first 500 chars):');
  console.log('─'.repeat(70));
  console.log(sampleText.substring(0, 500));
  console.log('─'.repeat(70));

  // Test both models
  console.log('\n\n📊 Running comparison...\n');

  const models = [
    'gemini-2.0-flash',      // Flash 2.0 (current stable)
    'gemini-2.0-flash-lite'  // Flash-Lite 2.0
  ];

  const results = [];

  for (const modelName of models) {
    console.log(`\n🔄 Testing ${modelName}...`);
    try {
      const result = await analyzeWithModel(modelName, sampleText);
      results.push(result);
      console.log(`   ✅ Completed in ${result.duration}ms`);
      console.log(`   📋 Found ${result.recommendations.length} recommendations`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({
        model: modelName,
        error: error.message,
        recommendations: []
      });
    }
  }

  // Display comparison
  console.log('\n\n' + '═'.repeat(70));
  console.log('  RESULTS COMPARISON');
  console.log('═'.repeat(70));

  for (const result of results) {
    console.log(`\n\n📱 MODEL: ${result.model}`);
    console.log('─'.repeat(70));

    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
      continue;
    }

    console.log(`⏱️  Response time: ${result.duration}ms`);
    console.log(`📊 Recommendations found: ${result.recommendations.length}`);

    if (result.recommendations.length > 0) {
      console.log('\nExtracted recommendations:');
      for (let i = 0; i < result.recommendations.length; i++) {
        const rec = result.recommendations[i];
        console.log(`\n  [${i + 1}] ${rec.stock_name || 'Unknown'}`);
        console.log(`      Expert: ${rec.expert_name || 'Not mentioned'}`);
        console.log(`      Action: ${rec.action || 'N/A'}`);
        if (rec.entry_price) console.log(`      Entry: ₹${rec.entry_price}`);
        if (rec.target_price) console.log(`      Target: ₹${rec.target_price}`);
        if (rec.stop_loss) console.log(`      Stop Loss: ₹${rec.stop_loss}`);
        if (rec.horizon) console.log(`      Horizon: ${rec.horizon}`);
        if (rec.reasoning) console.log(`      Reasoning: ${rec.reasoning}`);
      }
    }

    console.log('\n\nRaw response:');
    console.log('─'.repeat(70));
    console.log(result.rawResponse.substring(0, 2000));
    if (result.rawResponse.length > 2000) {
      console.log(`... (${result.rawResponse.length - 2000} more chars)`);
    }
  }

  // Summary comparison
  console.log('\n\n' + '═'.repeat(70));
  console.log('  SUMMARY');
  console.log('═'.repeat(70));

  const flash = results.find(r => r.model.includes('flash') && !r.model.includes('lite'));
  const lite = results.find(r => r.model.includes('lite'));

  if (flash && lite && !flash.error && !lite.error) {
    console.log('\n┌─────────────────────┬──────────────┬──────────────┐');
    console.log('│ Metric              │ Flash        │ Flash-Lite   │');
    console.log('├─────────────────────┼──────────────┼──────────────┤');
    console.log(`│ Response Time       │ ${String(flash.duration + 'ms').padEnd(12)} │ ${String(lite.duration + 'ms').padEnd(12)} │`);
    console.log(`│ Recommendations     │ ${String(flash.recommendations.length).padEnd(12)} │ ${String(lite.recommendations.length).padEnd(12)} │`);
    console.log('└─────────────────────┴──────────────┴──────────────┘');

    // Check if recommendations match
    const flashStocks = flash.recommendations.map(r => r.stock_name?.toLowerCase()).sort();
    const liteStocks = lite.recommendations.map(r => r.stock_name?.toLowerCase()).sort();

    console.log('\n📈 Stock extraction comparison:');
    console.log(`   Flash stocks: ${flashStocks.join(', ') || 'None'}`);
    console.log(`   Lite stocks:  ${liteStocks.join(', ') || 'None'}`);

    const matching = flashStocks.filter(s => liteStocks.includes(s));
    console.log(`   Matching: ${matching.length}/${Math.max(flashStocks.length, liteStocks.length)}`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('  TEST COMPLETE');
  console.log('═'.repeat(70) + '\n');
}

main().catch(console.error);
