/**
 * Prompt Service
 * Loads and manages channel-specific prompts from markdown files
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROMPTS_DIR = path.join(__dirname, '../../prompts');
const DEFAULT_PROMPT_FILE = 'default.md';

// In-memory cache for prompts
const promptCache = new Map();
let cacheLastUpdated = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Database connection for channel lookups
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'sayitownit',
  user: process.env.DB_USER || 'sayitownit',
  password: process.env.DB_PASSWORD || 'sayitownit123',
});

export const promptService = {
  /**
   * Load prompt for a given channel name
   * Uses fuzzy matching to find the best channel match
   * @param {string} channelName - Raw channel name from video metadata
   * @returns {string} - Prompt content
   */
  async loadPrompt(channelName) {
    // Get channel from database using fuzzy match
    const channel = await this.matchChannel(channelName);
    const promptFile = channel?.prompt_file || DEFAULT_PROMPT_FILE;

    console.log(`Loading prompt for channel "${channelName}" -> using ${promptFile}`);

    // Check cache
    if (this.isCacheValid(promptFile)) {
      return promptCache.get(promptFile);
    }

    // Load from file
    const promptPath = path.join(PROMPTS_DIR, promptFile);
    try {
      const content = await fs.readFile(promptPath, 'utf-8');
      promptCache.set(promptFile, content);
      cacheLastUpdated = Date.now();
      return content;
    } catch (error) {
      console.warn(`Prompt file not found: ${promptFile}, using default`);
      return this.loadDefaultPrompt();
    }
  },

  /**
   * Load the default prompt
   * @returns {string} - Default prompt content
   */
  async loadDefaultPrompt() {
    const defaultPath = path.join(PROMPTS_DIR, DEFAULT_PROMPT_FILE);

    if (promptCache.has(DEFAULT_PROMPT_FILE)) {
      return promptCache.get(DEFAULT_PROMPT_FILE);
    }

    try {
      const content = await fs.readFile(defaultPath, 'utf-8');
      promptCache.set(DEFAULT_PROMPT_FILE, content);
      cacheLastUpdated = Date.now();
      return content;
    } catch (error) {
      console.error('Failed to load default prompt:', error.message);
      // Return a minimal fallback prompt
      return this.getFallbackPrompt();
    }
  },

  /**
   * Fallback prompt if files are not accessible
   * @returns {string} - Minimal prompt
   */
  getFallbackPrompt() {
    return `Extract stock recommendations from this Indian financial TV content.
Return JSON array with: expert_name, share_name, nse_symbol, action (BUY/SELL),
recommended_price, target_price, stop_loss, reason, timestamp_seconds, confidence.
Only include actionable equity stock recommendations with price targets.
Return [] if none found.`;
  },

  /**
   * Check if cached prompt is still valid
   * @param {string} key - Cache key
   * @returns {boolean} - True if cache is valid
   */
  isCacheValid(key) {
    return promptCache.has(key) &&
           cacheLastUpdated &&
           (Date.now() - cacheLastUpdated) < CACHE_TTL;
  },

  /**
   * Clear the prompt cache
   */
  clearCache() {
    promptCache.clear();
    cacheLastUpdated = null;
    console.log('Prompt cache cleared');
  },

  /**
   * Fuzzy match channel name to find database channel
   * @param {string} rawChannelName - Raw channel name from video metadata
   * @returns {Object|null} - Channel record or null
   */
  async matchChannel(rawChannelName) {
    if (!rawChannelName) return null;

    // Normalize the input: lowercase, remove special chars
    const normalized = this.normalizeChannelName(rawChannelName);

    try {
      // First try exact slug match
      let result = await pool.query(
        'SELECT * FROM channels WHERE slug = $1 AND is_active = true',
        [normalized]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Try exact name match (case-insensitive)
      result = await pool.query(
        'SELECT * FROM channels WHERE LOWER(name) = LOWER($1) AND is_active = true',
        [rawChannelName]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Fuzzy match: check if normalized name contains any channel slug
      result = await pool.query(
        'SELECT * FROM channels WHERE is_active = true'
      );

      for (const channel of result.rows) {
        // Remove hyphens from slug for comparison
        const slugNormalized = channel.slug.replace(/-/g, '');

        // Check if input contains the channel identifier
        if (normalized.includes(slugNormalized) || slugNormalized.includes(normalized)) {
          return channel;
        }
      }

      return null;
    } catch (error) {
      console.error('Error matching channel:', error.message);
      return null;
    }
  },

  /**
   * Normalize channel name for matching
   * @param {string} name - Raw channel name
   * @returns {string} - Normalized name
   */
  normalizeChannelName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')  // Remove all non-alphanumeric
      .trim();
  },

  /**
   * Create slug from channel name
   * @param {string} name - Channel name
   * @returns {string} - URL-friendly slug
   */
  slugify(name) {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .trim();
  },

  /**
   * List all available prompt files
   * @returns {Array} - List of prompt file names
   */
  async listPromptFiles() {
    try {
      const files = await fs.readdir(PROMPTS_DIR);
      return files.filter(f => f.endsWith('.md'));
    } catch (error) {
      console.error('Error listing prompt files:', error.message);
      return [];
    }
  },

  /**
   * Get all channels with their prompt assignments
   * @returns {Array} - Channels with prompt info
   */
  async getAllChannels() {
    try {
      const result = await pool.query(
        'SELECT * FROM channels ORDER BY name'
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting channels:', error.message);
      return [];
    }
  },

  /**
   * Create a new channel
   * @param {Object} data - Channel data
   * @returns {Object} - Created channel
   */
  async createChannel(data) {
    const { name, prompt_file } = data;
    const slug = this.slugify(name);

    const result = await pool.query(
      `INSERT INTO channels (name, slug, prompt_file)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, slug, prompt_file]
    );

    return result.rows[0];
  },

  /**
   * Update a channel
   * @param {string} id - Channel ID
   * @param {Object} data - Update data
   * @returns {Object} - Updated channel
   */
  async updateChannel(id, data) {
    const { name, prompt_file, is_active } = data;

    const result = await pool.query(
      `UPDATE channels
       SET name = COALESCE($2, name),
           prompt_file = COALESCE($3, prompt_file),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, name, prompt_file, is_active]
    );

    this.clearCache();
    return result.rows[0];
  }
};

export default promptService;
