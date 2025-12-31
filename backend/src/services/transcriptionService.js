import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { ollama } from '../config/index.js';

const execAsync = promisify(exec);

/**
 * Transcription service using Whisper
 *
 * Note: Ollama doesn't natively support Whisper audio transcription.
 * This service tries multiple approaches:
 * 1. Local whisper CLI (if installed via `pip install openai-whisper`)
 * 2. whisper.cpp (if installed)
 * 3. Faster-whisper (if installed)
 */
export const transcriptionService = {
  /**
   * Check which transcription backend is available
   */
  async detectBackend() {
    // Try whisper (OpenAI's implementation)
    try {
      await execAsync('which whisper');
      return 'whisper';
    } catch {}

    // Try whisper.cpp
    try {
      await execAsync('which whisper-cpp');
      return 'whisper-cpp';
    } catch {}

    // Try faster-whisper (Python library)
    try {
      await execAsync('python3 -c "from faster_whisper import WhisperModel"');
      return 'faster-whisper';
    } catch {}

    // Try insanely-fast-whisper (uses transformers)
    try {
      await execAsync('python3 -c "import insanely_fast_whisper"');
      return 'insanely-fast-whisper';
    } catch {}

    console.warn('No local Whisper installation found. Using placeholder transcription.');
    return 'none';
  },

  /**
   * Transcribe an audio file
   * @param {string} audioPath - Path to the audio file
   * @param {object} options - Transcription options
   * @returns {object} - { text, language, segments }
   */
  async transcribe(audioPath, options = {}) {
    const backend = options.backend || await this.detectBackend();
    const language = options.language || 'auto'; // 'en', 'hi', or 'auto'

    console.log(`Transcribing ${audioPath} using ${backend} backend`);

    switch (backend) {
      case 'whisper':
        return this.transcribeWithWhisper(audioPath, language);
      case 'whisper-cpp':
        return this.transcribeWithWhisperCpp(audioPath, language);
      case 'faster-whisper':
        return this.transcribeWithFasterWhisper(audioPath, language);
      case 'insanely-fast-whisper':
        return this.transcribeWithInsanelyFastWhisper(audioPath, language);
      default:
        console.warn('Using LLM-based audio description as fallback');
        return this.transcribeWithLLMFallback(audioPath);
    }
  },

  /**
   * Transcribe using OpenAI's Whisper CLI
   */
  async transcribeWithWhisper(audioPath, language) {
    const outputDir = path.dirname(audioPath);
    const baseName = path.basename(audioPath, path.extname(audioPath));

    const langArg = language === 'auto' ? '' : `--language ${language}`;

    try {
      await execAsync(
        `whisper "${audioPath}" --model large-v3 --output_dir "${outputDir}" --output_format json ${langArg}`,
        { timeout: 600000 } // 10 minute timeout
      );

      // Read the JSON output
      const jsonPath = path.join(outputDir, `${baseName}.json`);
      const jsonContent = await fs.readFile(jsonPath, 'utf-8');
      const result = JSON.parse(jsonContent);

      return {
        text: result.text,
        language: result.language || language,
        segments: result.segments?.map(s => ({
          start: s.start,
          end: s.end,
          text: s.text
        })) || []
      };
    } catch (error) {
      console.error('Whisper transcription failed:', error.message);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  },

  /**
   * Transcribe using whisper.cpp
   */
  async transcribeWithWhisperCpp(audioPath, language) {
    const langArg = language === 'auto' ? '' : `-l ${language}`;

    try {
      const { stdout } = await execAsync(
        `whisper-cpp -m /usr/share/whisper/models/ggml-medium.bin -f "${audioPath}" ${langArg} -oj`,
        { timeout: 600000 }
      );

      const result = JSON.parse(stdout);
      const text = result.transcription?.map(t => t.text).join(' ') || '';

      return {
        text,
        language: result.result?.language || language,
        segments: result.transcription?.map(t => ({
          start: t.timestamps?.from ? parseTimestamp(t.timestamps.from) : 0,
          end: t.timestamps?.to ? parseTimestamp(t.timestamps.to) : 0,
          text: t.text
        })) || []
      };
    } catch (error) {
      console.error('whisper.cpp transcription failed:', error.message);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  },

  /**
   * Transcribe using faster-whisper via Python script
   */
  async transcribeWithFasterWhisper(audioPath, language) {
    const scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../../scripts/transcribe.py');
    const langArg = language === 'auto' ? '' : `--language ${language}`;

    try {
      console.log(`Running faster-whisper transcription on ${audioPath}`);
      const { stdout, stderr } = await execAsync(
        `python3 "${scriptPath}" "${audioPath}" --model large-v3 ${langArg}`,
        { timeout: 600000, maxBuffer: 50 * 1024 * 1024 }
      );

      if (stderr) {
        console.log('Transcription progress:', stderr);
      }

      const result = JSON.parse(stdout);

      if (result.error) {
        throw new Error(result.error);
      }

      return {
        text: result.text || '',
        language: result.language || language,
        segments: result.segments || []
      };
    } catch (error) {
      console.error('faster-whisper transcription failed:', error.message);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  },

  /**
   * Transcribe using insanely-fast-whisper
   */
  async transcribeWithInsanelyFastWhisper(audioPath, language) {
    const langArg = language === 'auto' ? '' : `--language ${language}`;
    const outputPath = audioPath.replace(/\.[^.]+$/, '.json');

    try {
      await execAsync(
        `insanely-fast-whisper --file_name "${audioPath}" --device_id 0 --model openai/whisper-medium ${langArg} --output ${outputPath}`,
        { timeout: 600000 }
      );

      const jsonContent = await fs.readFile(outputPath, 'utf-8');
      const result = JSON.parse(jsonContent);

      return {
        text: result.text || '',
        language: language,
        segments: result.chunks?.map(c => ({
          start: c.timestamp?.[0] || 0,
          end: c.timestamp?.[1] || 0,
          text: c.text
        })) || []
      };
    } catch (error) {
      console.error('insanely-fast-whisper transcription failed:', error.message);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  },

  /**
   * Fallback using LLM to describe what a transcription system would output
   * This is only for development/testing when no Whisper is available
   */
  async transcribeWithLLMFallback(audioPath) {
    console.warn('Using LLM fallback - no actual transcription. Install whisper for real transcription.');

    // Read audio file size to estimate duration
    const stats = await fs.stat(audioPath);
    const estimatedDuration = stats.size / (16000 * 2); // 16kHz, 16-bit audio

    return {
      text: `[Audio file: ${path.basename(audioPath)}, estimated ${Math.round(estimatedDuration)}s. Install whisper for actual transcription.]`,
      language: 'unknown',
      segments: [],
      isPlaceholder: true
    };
  },

  /**
   * Batch transcribe a directory of chunks using GPU (loads model once)
   * This is much faster than transcribing each chunk individually
   */
  async transcribeChunksBatch(chunksDir, options = {}) {
    const scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../../scripts/transcribe_batch.py');
    const language = options.language || 'auto';
    const langArg = language === 'auto' ? '' : `--language ${language}`;

    try {
      console.log(`Batch transcribing chunks in ${chunksDir} using GPU...`);
      const { stdout, stderr } = await execAsync(
        `python3 "${scriptPath}" "${chunksDir}" --model large-v3 ${langArg}`,
        { timeout: 3600000, maxBuffer: 100 * 1024 * 1024 } // 1 hour timeout for long videos
      );

      if (stderr) {
        console.log('Transcription progress:', stderr);
      }

      const result = JSON.parse(stdout);

      if (result.error) {
        throw new Error(result.error);
      }

      // Convert to expected format
      return result.chunks.map(chunk => ({
        chunkIndex: chunk.chunk_index,
        startTime: chunk.chunk_index * 30, // Assuming 30s chunks
        endTime: (chunk.chunk_index + 1) * 30,
        text: chunk.text || '',
        language: chunk.language || 'unknown',
        segments: chunk.segments || [],
        error: chunk.error
      }));
    } catch (error) {
      console.error('Batch transcription failed:', error.message);
      throw new Error(`Batch transcription failed: ${error.message}`);
    }
  },

  /**
   * Transcribe multiple chunks and merge results
   * Uses batch mode when faster-whisper is available for 10x+ speedup
   */
  async transcribeChunks(chunks, options = {}) {
    const backend = options.backend || await this.detectBackend();

    // Use batch mode for faster-whisper (GPU optimized, loads model once)
    if (backend === 'faster-whisper' && chunks.length > 0) {
      const chunksDir = path.dirname(chunks[0].path);
      try {
        console.log(`Using batch transcription mode for ${chunks.length} chunks`);
        const results = await this.transcribeChunksBatch(chunksDir, options);

        // Update startTime/endTime from actual chunk info
        return results.map((result, i) => ({
          ...result,
          startTime: chunks[i]?.startTime ?? result.startTime,
          endTime: chunks[i]?.endTime ?? result.endTime
        }));
      } catch (error) {
        console.error('Batch transcription failed, falling back to individual:', error.message);
        // Fall through to individual transcription
      }
    }

    // Fallback: individual chunk transcription
    const results = [];

    for (const chunk of chunks) {
      try {
        console.log(`Transcribing chunk ${chunk.index + 1}/${chunks.length}`);

        const result = await this.transcribe(chunk.path, { ...options, backend });

        results.push({
          chunkIndex: chunk.index,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          text: result.text,
          language: result.language,
          segments: result.segments
        });

        // Report progress
        if (options.onProgress) {
          options.onProgress({
            current: chunk.index + 1,
            total: chunks.length,
            text: result.text
          });
        }
      } catch (error) {
        console.error(`Failed to transcribe chunk ${chunk.index}:`, error.message);
        results.push({
          chunkIndex: chunk.index,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          text: '',
          language: 'unknown',
          error: error.message
        });
      }
    }

    return results;
  },

  /**
   * Merge transcription results into a single text
   */
  mergeTranscriptions(transcriptions) {
    const fullText = transcriptions
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map(t => t.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const detectedLanguages = transcriptions
      .map(t => t.language)
      .filter(l => l && l !== 'unknown');

    const primaryLanguage = detectedLanguages.length > 0
      ? mode(detectedLanguages)
      : 'unknown';

    return {
      text: fullText,
      language: primaryLanguage,
      chunkCount: transcriptions.length
    };
  }
};

/**
 * Parse timestamp string like "00:01:23,456" to seconds
 */
function parseTimestamp(ts) {
  if (typeof ts === 'number') return ts;
  const match = ts.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (match) {
    return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 1000;
  }
  return 0;
}

/**
 * Find the most common element in an array
 */
function mode(arr) {
  const counts = arr.reduce((acc, val) => {
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
}

export default transcriptionService;
