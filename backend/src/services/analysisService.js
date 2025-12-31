import { ollama } from '../config/index.js';

/**
 * Analysis service for extracting stock recommendations from transcripts
 */
export const analysisService = {
  /**
   * Extract stock recommendations from transcript text
   * @param {string} transcriptText - The transcript to analyze
   * @param {object} options - Analysis options
   * @returns {Array} - Array of extracted recommendations
   */
  async extractRecommendations(transcriptText, options = {}) {
    if (!transcriptText || transcriptText.trim().length < 50) {
      console.log('Transcript too short for analysis');
      return [];
    }

    const prompt = this.buildPrompt(transcriptText);

    try {
      console.log('Sending transcript to LLM for analysis...');
      const response = await ollama.generate(prompt, {
        temperature: 0.2, // Low temperature for more consistent extraction
        maxTokens: 4096
      });

      const recommendations = this.parseResponse(response);
      console.log(`Extracted ${recommendations.length} recommendations`);

      return recommendations;
    } catch (error) {
      console.error('LLM analysis failed:', error.message);
      throw new Error(`Analysis failed: ${error.message}`);
    }
  },

  /**
   * Build the prompt for LLM analysis
   * @param {string} transcriptText - Transcript text (may include [MM:SS-MM:SS] timestamps)
   */
  buildPrompt(transcriptText) {
    return `You are an expert at analyzing Indian stock market TV channel transcripts.
Your task is to extract stock recommendations from the following transcript.

The transcript is from a financial TV channel where market experts discuss stocks.
Languages used: English and/or Hindi (may contain Hinglish - mixed Hindi-English).

IMPORTANT: The transcript includes timestamps in format [MM:SS-MM:SS] before each segment.
When you find a recommendation, note the timestamp of the segment where it appears.

Extract ALL stock recommendations mentioned. For each recommendation, identify:
1. Expert Name - Who is giving the recommendation (look for names like Anil Singhvi, Prakash Gaba, etc.)
2. Share/Stock Name - Which stock (use NSE symbol if possible, e.g., RELIANCE, TATAMOTORS, HDFCBANK)
3. Action - BUY, SELL, or HOLD
4. Recommended Buy Price - Entry price (if mentioned)
5. Target Price - Expected price target (if mentioned)
6. Stop Loss - Stop loss level (if mentioned)
7. Reason - Brief reason for the recommendation (if given)
8. Timestamp - The START time in seconds where this recommendation appears (from the [MM:SS-...] marker)
9. Confidence - Your confidence in this extraction (low/medium/high)

Common Hindi/Hinglish terms to look for:
- "kharidna" / "kharido" / "buy karo" = BUY
- "becho" / "sell karo" / "nikal jao" = SELL
- "hold karo" / "rakho" = HOLD
- "target" / "lakshya" = target price
- "stoploss" / "stop loss" / "rok" = stop loss
- "stock" / "share" / "scrip" = stock name

If any field is not clearly mentioned, mark it as null.
ONLY extract clear, actionable stock recommendations. Do not extract:
- General market commentary
- Sector discussions without specific stocks
- Historical mentions

TRANSCRIPT:
---
${transcriptText}
---

Respond ONLY in valid JSON format as an array of recommendations. No explanations, just JSON:
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
    "timestamp_seconds": number or null,
    "confidence": "low|medium|high"
  }
]

If no recommendations found, return empty array: []`;
  },

  /**
   * Parse the LLM response into structured recommendations
   */
  parseResponse(response) {
    try {
      // Try to extract JSON from the response
      let jsonStr = response.trim();

      // Handle cases where LLM adds extra text
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const recommendations = JSON.parse(jsonStr);

      if (!Array.isArray(recommendations)) {
        console.warn('LLM response is not an array');
        return [];
      }

      // Validate and clean each recommendation
      return recommendations
        .filter(r => r && r.share_name && r.action)
        .map(r => ({
          expert_name: r.expert_name || 'Unknown Expert',
          share_name: this.normalizeShareName(r.share_name),
          nse_symbol: r.nse_symbol ? r.nse_symbol.toUpperCase() : null,
          action: this.normalizeAction(r.action),
          recommended_price: this.parsePrice(r.recommended_price),
          target_price: this.parsePrice(r.target_price),
          stop_loss: this.parsePrice(r.stop_loss),
          reason: r.reason || null,
          timestamp_seconds: typeof r.timestamp_seconds === 'number' ? Math.floor(r.timestamp_seconds) : null,
          confidence_score: this.confidenceToScore(r.confidence)
        }));
    } catch (error) {
      console.error('Failed to parse LLM response:', error.message);
      console.error('Response was:', response.substring(0, 500));
      return [];
    }
  },

  /**
   * Normalize share name
   */
  normalizeShareName(name) {
    if (!name) return 'Unknown';
    return name.trim().replace(/\s+/g, ' ');
  },

  /**
   * Normalize action to uppercase
   */
  normalizeAction(action) {
    if (!action) return 'BUY';
    const normalized = action.toUpperCase().trim();
    if (['BUY', 'SELL', 'HOLD'].includes(normalized)) {
      return normalized;
    }
    return 'BUY'; // Default to BUY for ambiguous cases
  },

  /**
   * Parse price from various formats
   */
  parsePrice(price) {
    if (price === null || price === undefined) return null;
    if (typeof price === 'number') return price;

    // Handle string prices like "850.50" or "Rs 850"
    const cleaned = String(price).replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  },

  /**
   * Convert confidence string to numeric score
   */
  confidenceToScore(confidence) {
    const scores = {
      'high': 0.9,
      'medium': 0.7,
      'low': 0.5
    };
    return scores[confidence?.toLowerCase()] || 0.5;
  },

  /**
   * Format seconds as MM:SS
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },

  /**
   * Analyze multiple transcript chunks and aggregate recommendations
   */
  async analyzeTranscriptBatch(transcripts, options = {}) {
    // Combine transcripts with timestamps for context
    const combinedText = transcripts
      .map(t => {
        const text = t.text || t.transcript_text || '';
        const startTime = t.startTime ?? t.start_time_seconds ?? 0;
        const endTime = t.endTime ?? t.end_time_seconds ?? startTime + 30;
        return `[${this.formatTime(startTime)}-${this.formatTime(endTime)}] ${text}`;
      })
      .join('\n\n');

    if (combinedText.trim().length < 100) {
      return [];
    }

    // For very long texts, split into chunks
    const maxChunkSize = 8000; // Characters
    const recommendations = [];

    if (combinedText.length <= maxChunkSize) {
      const results = await this.extractRecommendations(combinedText, options);
      recommendations.push(...results);
    } else {
      // Split into overlapping chunks
      const chunks = this.splitIntoChunks(combinedText, maxChunkSize, 500);

      for (let i = 0; i < chunks.length; i++) {
        console.log(`Analyzing text chunk ${i + 1}/${chunks.length}`);
        try {
          const results = await this.extractRecommendations(chunks[i], options);
          recommendations.push(...results);
        } catch (error) {
          console.error(`Failed to analyze chunk ${i + 1}:`, error.message);
        }
      }
    }

    // Deduplicate recommendations
    return this.deduplicateRecommendations(recommendations);
  },

  /**
   * Split text into chunks with overlap
   */
  splitIntoChunks(text, chunkSize, overlap) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end - overlap;

      if (start >= text.length - overlap) break;
    }

    return chunks;
  },

  /**
   * Remove duplicate recommendations
   */
  deduplicateRecommendations(recommendations) {
    const seen = new Map();

    for (const rec of recommendations) {
      // Create a key based on share name and action
      const key = `${rec.share_name.toLowerCase()}-${rec.action}`;

      if (!seen.has(key)) {
        seen.set(key, rec);
      } else {
        // Keep the one with higher confidence
        const existing = seen.get(key);
        if (rec.confidence_score > existing.confidence_score) {
          seen.set(key, rec);
        }
      }
    }

    return Array.from(seen.values());
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

export default analysisService;
