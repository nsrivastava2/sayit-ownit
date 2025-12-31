/**
 * Stock Service
 * Manages stock master data and lookups
 */

import { db } from '../config/index.js';

const logger = {
  info: (msg, data) => console.log(`[STOCK:INFO] ${msg}`, JSON.stringify(data || {})),
  warn: (msg, data) => console.warn(`[STOCK:WARN] ${msg}`, JSON.stringify(data || {})),
  error: (msg, data) => console.error(`[STOCK:ERROR] ${msg}`, JSON.stringify(data || {}))
};

export const stockService = {
  /**
   * Search stocks by symbol or company name
   */
  async searchStocks(query, limit = 20) {
    logger.info('Searching stocks', { query, limit });

    try {
      const result = await db.query(`
        SELECT id, symbol, exchange, company_name, sector, industry, market_cap_category
        FROM stocks
        WHERE is_active = true
          AND (
            symbol ILIKE $1
            OR company_name ILIKE $2
          )
        ORDER BY
          CASE WHEN symbol ILIKE $1 THEN 0 ELSE 1 END,
          symbol
        LIMIT $3
      `, [`${query}%`, `%${query}%`, limit]);

      logger.info('Search results', { query, count: result.rows.length });
      return result.rows;
    } catch (error) {
      logger.error('Search failed', { query, error: error.message });
      throw error;
    }
  },

  /**
   * Get stock by symbol
   */
  async getStockBySymbol(symbol, exchange = 'NSE') {
    const result = await db.query(`
      SELECT * FROM stocks
      WHERE UPPER(symbol) = UPPER($1) AND exchange = $2 AND is_active = true
    `, [symbol, exchange]);

    return result.rows[0] || null;
  },

  /**
   * Get stock by ID
   */
  async getStockById(id) {
    const result = await db.query(
      'SELECT * FROM stocks WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Get all stocks with optional filtering
   */
  async getAllStocks({ sector, marketCap, limit = 100, offset = 0 } = {}) {
    let query = `
      SELECT id, symbol, exchange, company_name, sector, industry, market_cap_category
      FROM stocks
      WHERE is_active = true
    `;
    const params = [];
    let paramIndex = 1;

    if (sector) {
      query += ` AND sector = $${paramIndex}`;
      params.push(sector);
      paramIndex++;
    }

    if (marketCap) {
      query += ` AND market_cap_category = $${paramIndex}`;
      params.push(marketCap);
      paramIndex++;
    }

    query += ` ORDER BY symbol LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM stocks WHERE is_active = true';
    const countParams = [];
    if (sector) {
      countQuery += ' AND sector = $1';
      countParams.push(sector);
    }
    if (marketCap) {
      countQuery += countParams.length ? ' AND market_cap_category = $2' : ' AND market_cap_category = $1';
      countParams.push(marketCap);
    }

    const countResult = await db.query(countQuery, countParams);

    return {
      stocks: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  },

  /**
   * Resolve stock from recommendation data
   * Attempts to match nse_symbol or share_name to stocks table
   */
  async resolveStock(nseSymbol, shareName) {
    logger.info('Resolving stock', { nseSymbol, shareName });

    // Try nse_symbol first (exact match)
    if (nseSymbol) {
      const stock = await this.getStockBySymbol(nseSymbol);
      if (stock) {
        logger.info('Resolved by symbol', { nseSymbol, stockId: stock.id });
        return stock;
      }
    }

    // Try fuzzy match on company name or symbol
    if (shareName) {
      const result = await db.query(`
        SELECT * FROM stocks
        WHERE is_active = true
          AND (
            company_name ILIKE $1
            OR UPPER(symbol) = UPPER($2)
          )
        ORDER BY
          CASE WHEN UPPER(symbol) = UPPER($2) THEN 0 ELSE 1 END
        LIMIT 1
      `, [`%${shareName}%`, shareName]);

      if (result.rows[0]) {
        logger.info('Resolved by name', { shareName, stockId: result.rows[0].id });
        return result.rows[0];
      }
    }

    logger.warn('Could not resolve stock', { nseSymbol, shareName });
    return null;
  },

  /**
   * Bulk import stocks
   */
  async bulkImportStocks(stocks) {
    logger.info('Bulk importing stocks', { count: stocks.length });

    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const stock of stocks) {
      try {
        const result = await db.query(`
          INSERT INTO stocks (symbol, exchange, company_name, isin, sector, industry, market_cap_category)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (symbol, exchange) DO UPDATE SET
            company_name = EXCLUDED.company_name,
            isin = EXCLUDED.isin,
            sector = EXCLUDED.sector,
            industry = EXCLUDED.industry,
            market_cap_category = EXCLUDED.market_cap_category,
            updated_at = NOW()
          RETURNING (xmax = 0) AS inserted
        `, [
          stock.symbol?.toUpperCase(),
          stock.exchange || 'NSE',
          stock.company_name,
          stock.isin || null,
          stock.sector || null,
          stock.industry || null,
          stock.market_cap_category || null
        ]);

        if (result.rows[0]?.inserted) {
          imported++;
        } else {
          updated++;
        }
      } catch (error) {
        logger.error('Import failed for stock', {
          symbol: stock.symbol,
          error: error.message
        });
        errors++;
      }
    }

    logger.info('Bulk import complete', { imported, updated, errors });
    return { imported, updated, errors, total: stocks.length };
  },

  /**
   * Get all unique sectors
   */
  async getAllSectors() {
    const result = await db.query(`
      SELECT DISTINCT sector
      FROM stocks
      WHERE sector IS NOT NULL AND is_active = true
      ORDER BY sector
    `);
    return result.rows.map(r => r.sector);
  },

  /**
   * Get stock statistics (recommendations count, etc.)
   */
  async getStockStats(stockId, symbol) {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_recommendations,
        COUNT(CASE WHEN action = 'BUY' THEN 1 END) as buy_count,
        COUNT(CASE WHEN action = 'SELL' THEN 1 END) as sell_count,
        COUNT(CASE WHEN action = 'HOLD' THEN 1 END) as hold_count,
        COUNT(DISTINCT expert_name) as unique_experts,
        AVG(target_price) as avg_target,
        AVG(stop_loss) as avg_stop_loss,
        MIN(recommendation_date) as first_recommendation,
        MAX(recommendation_date) as last_recommendation
      FROM recommendations
      WHERE stock_id = $1 OR UPPER(nse_symbol) = UPPER($2) OR UPPER(share_name) = UPPER($2)
    `, [stockId, symbol]);

    return result.rows[0];
  },

  /**
   * Get recommendations for a stock
   */
  async getStockRecommendations(stockId, symbol, limit = 50) {
    const result = await db.query(`
      SELECT r.*,
             json_build_object(
               'id', v.id,
               'youtube_url', v.youtube_url,
               'title', v.title,
               'channel_name', v.channel_name
             ) as video
      FROM recommendations r
      LEFT JOIN videos v ON r.video_id = v.id
      WHERE r.stock_id = $1 OR UPPER(r.nse_symbol) = UPPER($2) OR UPPER(r.share_name) = UPPER($2)
      ORDER BY r.recommendation_date DESC, r.created_at DESC
      LIMIT $3
    `, [stockId, symbol, limit]);

    return result.rows;
  }
};

export default stockService;
