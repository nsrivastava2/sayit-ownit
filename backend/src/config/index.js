import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY
  },

  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL,
    username: process.env.OLLAMA_USERNAME,
    password: process.env.OLLAMA_PASSWORD,
    whisperModel: process.env.WHISPER_MODEL || 'whisper',
    llmModel: process.env.LLM_MODEL || 'llama3.1'
  },

  processing: {
    audioChunkSeconds: parseInt(process.env.AUDIO_CHUNK_SECONDS) || 30,
    analysisBatchChunks: parseInt(process.env.ANALYSIS_BATCH_CHUNKS) || 5,
    tempDir: process.env.TEMP_DIR || './temp'
  }
};

export { db, supabase } from './database.js';
export { ollama } from './ollama.js';
