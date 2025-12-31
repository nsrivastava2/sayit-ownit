import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'sayitownit',
  user: process.env.DB_USER || 'sayitownit',
  password: process.env.DB_PASSWORD || 'sayitownit123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log('PostgreSQL connected successfully'))
  .catch(err => console.error('PostgreSQL connection error:', err.message));

// Helper functions for database operations
export const db = {
  // Videos
  async createVideo(videoData) {
    const { youtube_url, title, channel_name, video_type, duration_seconds, language, status, publish_date } = videoData;
    const result = await pool.query(
      `INSERT INTO videos (youtube_url, title, channel_name, video_type, duration_seconds, language, status, publish_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [youtube_url, title, channel_name, video_type, duration_seconds, language, status || 'pending', publish_date]
    );
    return result.rows[0];
  },

  async updateVideo(id, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE videos SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async getVideo(id) {
    const result = await pool.query('SELECT * FROM videos WHERE id = $1', [id]);
    return result.rows[0];
  },

  async getVideos({ status, limit = 20, offset = 0 }) {
    let query = 'SELECT * FROM videos';
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` WHERE status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM videos';
    if (status) {
      countQuery += ' WHERE status = $1';
    }
    const countResult = await pool.query(countQuery, status ? [status] : []);
    const count = parseInt(countResult.rows[0].count);

    return { data: result.rows, count };
  },

  async getVideoByUrl(youtubeUrl) {
    const result = await pool.query(
      'SELECT * FROM videos WHERE youtube_url = $1',
      [youtubeUrl]
    );
    return result.rows[0] || null;
  },

  // Transcripts
  async createTranscript(transcriptData) {
    const { video_id, chunk_index, start_time_seconds, end_time_seconds, transcript_text, language_detected } = transcriptData;
    const result = await pool.query(
      `INSERT INTO transcripts (video_id, chunk_index, start_time_seconds, end_time_seconds, transcript_text, language_detected)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [video_id, chunk_index, start_time_seconds, end_time_seconds, transcript_text, language_detected]
    );
    return result.rows[0];
  },

  async getTranscriptsByVideo(videoId) {
    const result = await pool.query(
      'SELECT * FROM transcripts WHERE video_id = $1 ORDER BY chunk_index ASC',
      [videoId]
    );
    return result.rows;
  },

  async getRecentTranscripts(videoId, count) {
    const result = await pool.query(
      'SELECT * FROM transcripts WHERE video_id = $1 ORDER BY chunk_index DESC LIMIT $2',
      [videoId, count]
    );
    return result.rows.reverse();
  },

  // Recommendations
  async createRecommendation(recommendationData) {
    const {
      video_id, expert_name, recommendation_date, share_name, nse_symbol,
      action, recommended_price, target_price, stop_loss, reason,
      confidence_score, timestamp_in_video, raw_extract
    } = recommendationData;

    const result = await pool.query(
      `INSERT INTO recommendations
       (video_id, expert_name, recommendation_date, share_name, nse_symbol, action,
        recommended_price, target_price, stop_loss, reason, confidence_score, timestamp_in_video, raw_extract)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [video_id, expert_name, recommendation_date, share_name, nse_symbol, action,
       recommended_price, target_price, stop_loss, reason, confidence_score, timestamp_in_video, raw_extract]
    );
    return result.rows[0];
  },

  async createRecommendations(recommendations) {
    if (!recommendations.length) return [];

    const results = [];
    for (const rec of recommendations) {
      const created = await this.createRecommendation(rec);
      results.push(created);
    }
    return results;
  },

  async getRecommendations({ expert, share, dateFrom, dateTo, action, status, outcome, limit = 50, offset = 0 }) {
    // Build WHERE conditions
    const conditions = ['1=1'];
    const params = [];
    let paramIndex = 1;

    if (expert) {
      conditions.push(`expert_name ILIKE $${paramIndex}`);
      params.push(`%${expert}%`);
      paramIndex++;
    }
    if (share) {
      conditions.push(`(share_name ILIKE $${paramIndex} OR nse_symbol ILIKE $${paramIndex})`);
      params.push(`%${share}%`);
      paramIndex++;
    }
    if (dateFrom) {
      conditions.push(`recommendation_date >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`recommendation_date <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }
    if (action) {
      conditions.push(`action = $${paramIndex}`);
      params.push(action.toUpperCase());
      paramIndex++;
    }
    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status.toUpperCase());
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count first
    const countQuery = `SELECT COUNT(*) FROM recommendations WHERE ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const count = parseInt(countResult.rows[0].count);

    // Get paginated data with video info and outcome (need r. prefix for joined query)
    const dataWhereClause = whereClause.replace(/expert_name/g, 'r.expert_name')
      .replace(/share_name/g, 'r.share_name')
      .replace(/nse_symbol/g, 'r.nse_symbol')
      .replace(/recommendation_date/g, 'r.recommendation_date')
      .replace(/action(?![_])/g, 'r.action')
      .replace(/status/g, 'r.status');

    // Build outcome filter if specified
    let outcomeJoin = 'LEFT JOIN recommendation_outcomes ro ON r.id = ro.recommendation_id';
    let outcomeCondition = '';
    if (outcome) {
      outcomeCondition = ` AND ro.outcome_type = $${paramIndex}`;
      params.push(outcome.toUpperCase());
      paramIndex++;
    }

    const dataQuery = `
      SELECT r.*,
             json_build_object(
               'id', v.id,
               'youtube_url', v.youtube_url,
               'title', v.title,
               'channel_name', v.channel_name
             ) as videos,
             json_build_object(
               'outcome_type', ro.outcome_type,
               'outcome_date', ro.outcome_date,
               'outcome_price', ro.outcome_price,
               'return_percentage', ro.return_percentage,
               'days_held', ro.days_held
             ) as outcome
      FROM recommendations r
      LEFT JOIN videos v ON r.video_id = v.id
      ${outcomeJoin}
      WHERE ${dataWhereClause}${outcomeCondition}
      ORDER BY r.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(dataQuery, params);
    return { data: result.rows, count };
  },

  async getRecommendationsByExpert() {
    const result = await pool.query(`
      SELECT expert_name as name, COUNT(*) as count
      FROM recommendations
      GROUP BY expert_name
      ORDER BY count DESC
    `);
    return result.rows.map(row => ({ name: row.name, count: parseInt(row.count) }));
  },

  async getRecommendationsByShare() {
    const result = await pool.query(`
      SELECT share_name as name, nse_symbol as symbol, COUNT(*) as count
      FROM recommendations
      GROUP BY share_name, nse_symbol
      ORDER BY count DESC
    `);
    return result.rows.map(row => ({ name: row.name, symbol: row.symbol, count: parseInt(row.count) }));
  },

  async getExperts() {
    return this.getRecommendationsByExpert();
  },

  async getShares() {
    return this.getRecommendationsByShare();
  },

  async getStats() {
    const [videosResult, recommendationsResult] = await Promise.all([
      pool.query('SELECT id, status FROM videos'),
      pool.query('SELECT id, expert_name, share_name, action FROM recommendations')
    ]);

    const videos = videosResult.rows;
    const recommendations = recommendationsResult.rows;
    const uniqueExperts = new Set(recommendations.map(r => r.expert_name));
    const uniqueShares = new Set(recommendations.map(r => r.share_name));
    const actionCounts = recommendations.reduce((acc, r) => {
      acc[r.action] = (acc[r.action] || 0) + 1;
      return acc;
    }, {});

    return {
      totalVideos: videos.length,
      completedVideos: videos.filter(v => v.status === 'completed').length,
      totalRecommendations: recommendations.length,
      uniqueExperts: uniqueExperts.size,
      uniqueShares: uniqueShares.size,
      actionCounts
    };
  },

  // Get expert details with all recommendations
  async getExpertRecommendations(expertName) {
    const result = await pool.query(`
      SELECT r.*,
             json_build_object(
               'id', v.id,
               'youtube_url', v.youtube_url,
               'title', v.title,
               'channel_name', v.channel_name
             ) as videos,
             json_build_object(
               'outcome_type', ro.outcome_type,
               'outcome_date', ro.outcome_date,
               'outcome_price', ro.outcome_price,
               'return_percentage', ro.return_percentage,
               'days_held', ro.days_held
             ) as outcome
      FROM recommendations r
      LEFT JOIN videos v ON r.video_id = v.id
      LEFT JOIN recommendation_outcomes ro ON r.id = ro.recommendation_id
      WHERE r.expert_name ILIKE $1
      ORDER BY r.recommendation_date DESC
    `, [`%${expertName}%`]);
    return result.rows;
  },

  // Get share details with all recommendations
  async getShareRecommendations(shareName) {
    const result = await pool.query(`
      SELECT r.*,
             json_build_object(
               'id', v.id,
               'youtube_url', v.youtube_url,
               'title', v.title,
               'channel_name', v.channel_name
             ) as videos,
             json_build_object(
               'outcome_type', ro.outcome_type,
               'outcome_date', ro.outcome_date,
               'outcome_price', ro.outcome_price,
               'return_percentage', ro.return_percentage,
               'days_held', ro.days_held
             ) as outcome
      FROM recommendations r
      LEFT JOIN videos v ON r.video_id = v.id
      LEFT JOIN recommendation_outcomes ro ON r.id = ro.recommendation_id
      WHERE r.share_name ILIKE $1 OR r.nse_symbol ILIKE $1
      ORDER BY r.recommendation_date DESC
    `, [`%${shareName}%`]);
    return result.rows;
  },

  // Raw query access for complex operations
  async query(text, params) {
    return pool.query(text, params);
  },

  // ============================================
  // Admin Session Management
  // ============================================

  async createAdminSession(data) {
    const result = await pool.query(
      `INSERT INTO admin_sessions (session_token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.session_token, data.expires_at, data.ip_address, data.user_agent]
    );
    return result.rows[0];
  },

  async getAdminSession(token) {
    const result = await pool.query(
      'SELECT * FROM admin_sessions WHERE session_token = $1',
      [token]
    );
    return result.rows[0];
  },

  async deleteAdminSession(token) {
    await pool.query(
      'DELETE FROM admin_sessions WHERE session_token = $1',
      [token]
    );
  },

  async cleanupExpiredSessions() {
    const result = await pool.query(
      'DELETE FROM admin_sessions WHERE expires_at < NOW()'
    );
    return result.rowCount;
  }
};

export default db;
