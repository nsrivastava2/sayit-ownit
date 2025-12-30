import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'sayitownit',
    user: process.env.DB_USER || 'sayitownit',
    password: process.env.DB_PASSWORD || 'sayitownit123'
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

export { db } from './database.js';
export { ollama } from './ollama.js';
