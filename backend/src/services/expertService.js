/**
 * Expert Resolution Service
 * Maps raw expert names to canonical names via aliases
 * Manages expert CRUD and pending expert review
 */
import pg from 'pg';

// Database connection
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'sayitownit',
  user: process.env.DB_USER || 'sayitownit',
  password: process.env.DB_PASSWORD || 'sayitownit123',
});

// In-memory cache for alias lookups
let aliasCache = new Map();
let aliasCacheLastUpdated = null;
const ALIAS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export const expertService = {
  /**
   * Resolve a raw expert name to canonical name
   * @param {string} rawName - Name as extracted from video
   * @param {string} videoId - Video ID for pending expert tracking
   * @param {number} timestamp - Timestamp in seconds
   * @returns {Object} - { name: string, isNew: boolean, expertId: string|null }
   */
  async resolveExpertName(rawName, videoId = null, timestamp = null) {
    if (!rawName || rawName === 'Unknown Expert') {
      return { name: rawName, isNew: false, expertId: null };
    }

    const normalizedName = this.normalize(rawName);

    // Refresh cache if stale
    await this.refreshCacheIfNeeded();

    // Check cache for canonical name or alias
    if (aliasCache.has(normalizedName)) {
      const cached = aliasCache.get(normalizedName);
      return { name: cached.canonicalName, isNew: false, expertId: cached.expertId };
    }

    // Check database directly (in case cache is outdated)
    try {
      // Check if it's a canonical name
      let result = await pool.query(
        `SELECT id, canonical_name FROM experts
         WHERE LOWER(canonical_name) = $1 AND is_active = true`,
        [normalizedName]
      );

      if (result.rows.length > 0) {
        const expert = result.rows[0];
        aliasCache.set(normalizedName, {
          canonicalName: expert.canonical_name,
          expertId: expert.id
        });
        return { name: expert.canonical_name, isNew: false, expertId: expert.id };
      }

      // Check aliases
      result = await pool.query(
        `SELECT e.id, e.canonical_name
         FROM expert_aliases ea
         JOIN experts e ON ea.expert_id = e.id
         WHERE LOWER(ea.alias) = $1 AND e.is_active = true`,
        [normalizedName]
      );

      if (result.rows.length > 0) {
        const expert = result.rows[0];
        aliasCache.set(normalizedName, {
          canonicalName: expert.canonical_name,
          expertId: expert.id
        });
        return { name: expert.canonical_name, isNew: false, expertId: expert.id };
      }

      // Not found - add to pending experts
      await this.addPendingExpert(rawName, videoId, timestamp);

      return { name: rawName, isNew: true, expertId: null };
    } catch (error) {
      console.error('Error resolving expert name:', error.message);
      return { name: rawName, isNew: true, expertId: null };
    }
  },

  /**
   * Normalize name for comparison
   * @param {string} name - Raw name
   * @returns {string} - Normalized name
   */
  normalize(name) {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  },

  /**
   * Add a new pending expert for review
   * @param {string} rawName - Name as extracted
   * @param {string} videoId - Source video ID
   * @param {number} timestamp - Timestamp in seconds
   */
  async addPendingExpert(rawName, videoId, timestamp) {
    try {
      // Check if already pending
      const existing = await pool.query(
        `SELECT id FROM pending_experts
         WHERE LOWER(raw_name) = $1 AND status = 'pending'`,
        [this.normalize(rawName)]
      );

      if (existing.rows.length > 0) {
        return; // Already pending
      }

      await pool.query(
        `INSERT INTO pending_experts (raw_name, video_id, timestamp_in_video)
         VALUES ($1, $2, $3)`,
        [rawName, videoId, timestamp]
      );

      console.log(`Added pending expert: "${rawName}"`);
    } catch (error) {
      console.error('Error adding pending expert:', error.message);
    }
  },

  /**
   * Refresh alias cache if stale
   */
  async refreshCacheIfNeeded() {
    if (aliasCacheLastUpdated &&
        (Date.now() - aliasCacheLastUpdated) < ALIAS_CACHE_TTL) {
      return;
    }

    try {
      // Load all experts and aliases into cache
      const result = await pool.query(`
        SELECT e.id, e.canonical_name, LOWER(e.canonical_name) as normalized
        FROM experts e WHERE e.is_active = true
        UNION ALL
        SELECT e.id, e.canonical_name, LOWER(ea.alias) as normalized
        FROM experts e
        JOIN expert_aliases ea ON e.id = ea.expert_id
        WHERE e.is_active = true
      `);

      aliasCache.clear();
      for (const row of result.rows) {
        aliasCache.set(row.normalized, {
          canonicalName: row.canonical_name,
          expertId: row.id
        });
      }
      aliasCacheLastUpdated = Date.now();

      console.log(`Expert cache refreshed: ${aliasCache.size} entries`);
    } catch (error) {
      console.error('Error refreshing alias cache:', error.message);
    }
  },

  /**
   * Clear the alias cache
   */
  clearCache() {
    aliasCache.clear();
    aliasCacheLastUpdated = null;
    console.log('Expert alias cache cleared');
  },

  // ============================================
  // CRUD Operations for Admin
  // ============================================

  /**
   * Get all experts with aliases and recommendation counts
   * @returns {Array} - Experts with metadata
   */
  async getAllExperts() {
    const result = await pool.query(`
      SELECT
        e.*,
        COALESCE(
          json_agg(
            json_build_object('id', ea.id, 'alias', ea.alias)
          ) FILTER (WHERE ea.id IS NOT NULL),
          '[]'
        ) as aliases,
        (SELECT COUNT(*) FROM recommendations r WHERE r.expert_name = e.canonical_name) as recommendation_count
      FROM experts e
      LEFT JOIN expert_aliases ea ON e.id = ea.expert_id
      GROUP BY e.id
      ORDER BY e.canonical_name
    `);

    return result.rows;
  },

  /**
   * Get a single expert by ID
   * @param {string} id - Expert ID
   * @returns {Object} - Expert with aliases
   */
  async getExpert(id) {
    const result = await pool.query(`
      SELECT
        e.*,
        COALESCE(
          json_agg(
            json_build_object('id', ea.id, 'alias', ea.alias)
          ) FILTER (WHERE ea.id IS NOT NULL),
          '[]'
        ) as aliases
      FROM experts e
      LEFT JOIN expert_aliases ea ON e.id = ea.expert_id
      WHERE e.id = $1
      GROUP BY e.id
    `, [id]);

    return result.rows[0] || null;
  },

  /**
   * Create a new expert
   * @param {Object} data - Expert data
   * @returns {Object} - Created expert
   */
  async createExpert(data) {
    const { canonical_name, bio, specialization, aliases = [] } = data;

    // Insert expert
    const expertResult = await pool.query(
      `INSERT INTO experts (canonical_name, bio, specialization)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [canonical_name, bio || null, specialization || null]
    );
    const expert = expertResult.rows[0];

    // Insert aliases
    for (const alias of aliases) {
      if (alias && alias.trim()) {
        await pool.query(
          `INSERT INTO expert_aliases (expert_id, alias)
           VALUES ($1, $2)
           ON CONFLICT (alias) DO NOTHING`,
          [expert.id, alias.trim()]
        );
      }
    }

    this.clearCache();
    return expert;
  },

  /**
   * Update an expert
   * @param {string} id - Expert ID
   * @param {Object} data - Update data
   * @returns {Object} - Updated expert
   */
  async updateExpert(id, data) {
    const { canonical_name, bio, specialization, is_active } = data;

    const result = await pool.query(
      `UPDATE experts
       SET canonical_name = COALESCE($2, canonical_name),
           bio = COALESCE($3, bio),
           specialization = COALESCE($4, specialization),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, canonical_name, bio, specialization, is_active]
    );

    this.clearCache();
    return result.rows[0];
  },

  /**
   * Delete an expert
   * @param {string} id - Expert ID
   */
  async deleteExpert(id) {
    await pool.query('DELETE FROM experts WHERE id = $1', [id]);
    this.clearCache();
  },

  /**
   * Add an alias to an expert
   * @param {string} expertId - Expert ID
   * @param {string} alias - Alias to add
   * @returns {Object} - Created alias
   */
  async addAlias(expertId, alias) {
    const result = await pool.query(
      `INSERT INTO expert_aliases (expert_id, alias)
       VALUES ($1, $2)
       RETURNING *`,
      [expertId, alias.trim()]
    );

    this.clearCache();
    return result.rows[0];
  },

  /**
   * Remove an alias
   * @param {string} aliasId - Alias ID
   */
  async removeAlias(aliasId) {
    await pool.query('DELETE FROM expert_aliases WHERE id = $1', [aliasId]);
    this.clearCache();
  },

  // ============================================
  // Pending Expert Management
  // ============================================

  /**
   * Get all pending experts for review
   * @returns {Array} - Pending experts with video info
   */
  async getPendingExperts() {
    const result = await pool.query(`
      SELECT
        pe.*,
        v.title as video_title,
        v.youtube_url,
        v.channel_name
      FROM pending_experts pe
      LEFT JOIN videos v ON pe.video_id = v.id
      WHERE pe.status = 'pending'
      ORDER BY pe.created_at DESC
    `);

    return result.rows;
  },

  /**
   * Resolve a pending expert
   * @param {string} pendingId - Pending expert ID
   * @param {string} action - 'create_new', 'assign_existing', or 'reject'
   * @param {string} expertId - Expert ID (for assign_existing)
   * @param {string} canonicalName - Name to use when creating new
   * @returns {Object} - Result
   */
  async resolvePendingExpert(pendingId, action, expertId = null, canonicalName = null) {
    // Get pending expert
    const pending = await pool.query(
      'SELECT * FROM pending_experts WHERE id = $1',
      [pendingId]
    );

    if (pending.rows.length === 0) {
      throw new Error('Pending expert not found');
    }

    const pendingExpert = pending.rows[0];

    if (action === 'create_new') {
      // Create new expert with pending name or provided canonical name
      const name = canonicalName || pendingExpert.raw_name;
      const expert = await this.createExpert({
        canonical_name: name,
        aliases: canonicalName ? [pendingExpert.raw_name] : []
      });

      // Update pending status
      await pool.query(
        `UPDATE pending_experts
         SET status = 'approved', resolved_expert_id = $2, resolved_at = NOW()
         WHERE id = $1`,
        [pendingId, expert.id]
      );

      // Update historical recommendations
      await this.updateHistoricalRecommendations(pendingExpert.raw_name, name);

      return { success: true, expert, action: 'created' };

    } else if (action === 'assign_existing' && expertId) {
      // Get the expert's canonical name
      const expertResult = await pool.query(
        'SELECT canonical_name FROM experts WHERE id = $1',
        [expertId]
      );

      if (expertResult.rows.length === 0) {
        throw new Error('Expert not found');
      }

      const canonicalExpertName = expertResult.rows[0].canonical_name;

      // Add as alias
      await this.addAlias(expertId, pendingExpert.raw_name);

      // Update pending status
      await pool.query(
        `UPDATE pending_experts
         SET status = 'approved', resolved_expert_id = $2, resolved_at = NOW()
         WHERE id = $1`,
        [pendingId, expertId]
      );

      // Update historical recommendations
      await this.updateHistoricalRecommendations(pendingExpert.raw_name, canonicalExpertName);

      return { success: true, action: 'assigned', expertId };

    } else if (action === 'reject') {
      await pool.query(
        `UPDATE pending_experts
         SET status = 'rejected', resolved_at = NOW()
         WHERE id = $1`,
        [pendingId]
      );

      return { success: true, action: 'rejected' };

    } else {
      throw new Error('Invalid action');
    }
  },

  /**
   * Update historical recommendations to use canonical name
   * @param {string} rawName - Original name to replace
   * @param {string} canonicalName - New canonical name
   */
  async updateHistoricalRecommendations(rawName, canonicalName) {
    try {
      const result = await pool.query(
        `UPDATE recommendations
         SET expert_name = $2
         WHERE LOWER(expert_name) = LOWER($1)`,
        [rawName, canonicalName]
      );

      console.log(`Updated ${result.rowCount} historical recommendations: "${rawName}" -> "${canonicalName}"`);
    } catch (error) {
      console.error('Error updating historical recommendations:', error.message);
    }
  }
};

export default expertService;
