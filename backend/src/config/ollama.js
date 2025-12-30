import dotenv from 'dotenv';

dotenv.config();

const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const username = process.env.OLLAMA_USERNAME;
const password = process.env.OLLAMA_PASSWORD;

// Create Basic Auth header only if credentials are provided
const authHeader = (username && password)
  ? 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
  : null;

/**
 * Ollama API client with retry logic
 */
export const ollama = {
  /**
   * Make a request to Ollama API with retry logic
   */
  async request(endpoint, body, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const timeout = options.timeout || 120000; // 2 minutes default

    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const headers = { 'Content-Type': 'application/json' };
        if (authHeader) headers['Authorization'] = authHeader;

        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Ollama API error (${response.status}): ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        console.error(`Ollama request attempt ${attempt} failed:`, error.message);

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Ollama request failed after ${maxRetries} attempts: ${lastError.message}`);
  },

  /**
   * Generate text using LLM
   */
  async generate(prompt, options = {}) {
    const model = options.model || process.env.LLM_MODEL || 'llama3.1';

    const response = await this.request('/api/generate', {
      model,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature || 0.3,
        num_predict: options.maxTokens || 4096
      }
    }, {
      timeout: options.timeout || 180000 // 3 minutes for generation
    });

    return response.response;
  },

  /**
   * Chat with LLM
   */
  async chat(messages, options = {}) {
    const model = options.model || process.env.LLM_MODEL || 'llama3.1';

    const response = await this.request('/api/chat', {
      model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature || 0.3,
        num_predict: options.maxTokens || 4096
      }
    }, {
      timeout: options.timeout || 180000
    });

    return response.message.content;
  },

  /**
   * Transcribe audio using Whisper model
   * Note: This depends on how Ollama exposes Whisper.
   * We may need to use a different endpoint or approach.
   */
  async transcribe(audioBase64, options = {}) {
    const model = options.model || process.env.WHISPER_MODEL || 'whisper';

    // Ollama's Whisper integration - adjust based on actual API
    const response = await this.request('/api/generate', {
      model,
      prompt: '', // Whisper doesn't need a prompt
      images: [audioBase64], // Some Ollama versions accept audio as images
      stream: false
    }, {
      timeout: options.timeout || 300000 // 5 minutes for transcription
    });

    return response.response;
  },

  /**
   * Test connection to Ollama API
   */
  async testConnection() {
    try {
      const headers = {};
      if (authHeader) headers['Authorization'] = authHeader;

      const response = await fetch(`${baseUrl}/api/tags`, { headers });

      if (!response.ok) {
        throw new Error(`Connection test failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Ollama connection successful. Available models:', data.models?.map(m => m.name) || []);
      return true;
    } catch (error) {
      console.error('Ollama connection test failed:', error.message);
      return false;
    }
  }
};

export default ollama;
