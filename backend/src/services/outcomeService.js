/**
 * Outcome Service
 * Detects and tracks recommendation outcomes (target hit, stop-loss hit, expired)
 */

import { db } from '../config/index.js';
import priceService from './priceService.js';

const logger = {
  info: (msg, data) => console.log(`[OUTCOME:INFO] ${msg}`, JSON.stringify(data || {})),
  warn: (msg, data) => console.warn(`[OUTCOME:WARN] ${msg}`, JSON.stringify(data || {})),
  error: (msg, data) => console.error(`[OUTCOME:ERROR] ${msg}`, JSON.stringify(data || {}))
};

// Default expiry period in days
const DEFAULT_EXPIRY_DAYS = 90;

// Outcome types
const OUTCOME_TYPES = {
  TARGET_HIT: 'TARGET_HIT',
  SL_HIT: 'SL_HIT',
  EXPIRED: 'EXPIRED'
};

export const outcomeService = {
  /**
   * Check if a recommendation has hit its outcome
   * Returns outcome object if hit, null if still active
   */
  async checkOutcome(recommendation) {
    const { id, stock_id, target_price, stop_loss, recommended_price, recommendation_date, action } = recommendation;

    if (!stock_id) {
      logger.warn('No stock_id for recommendation', { id });
      return null;
    }

    // Get the latest price after recommendation date
    const latestPrice = await priceService.getLatestPrice(stock_id);

    if (!latestPrice) {
      logger.warn('No price data for stock', { id, stock_id });
      return null;
    }

    const entryPrice = recommended_price || latestPrice.close_price;
    const recDate = new Date(recommendation_date);
    const priceDate = new Date(latestPrice.price_date);
    const daysHeld = Math.floor((priceDate - recDate) / (1000 * 60 * 60 * 24));

    logger.info('Checking outcome', {
      id,
      target: target_price,
      stopLoss: stop_loss,
      high: latestPrice.high_price,
      low: latestPrice.low_price,
      daysHeld
    });

    // For BUY recommendations:
    // - Target hit when high >= target
    // - Stop loss hit when low <= stop_loss
    if (action === 'BUY') {
      // Check if we need to look at price history for accurate outcome
      const priceHistory = await this.getPricesSinceRecommendation(stock_id, recommendation_date);

      for (const price of priceHistory) {
        const priceDate = new Date(price.price_date);
        const daysSinceRec = Math.floor((priceDate - recDate) / (1000 * 60 * 60 * 24));

        // Check target hit
        if (target_price && price.high_price >= target_price) {
          return {
            outcome_type: OUTCOME_TYPES.TARGET_HIT,
            outcome_date: price.price_date,
            outcome_price: target_price,
            return_percentage: this.calculateReturn(entryPrice, target_price),
            days_held: daysSinceRec
          };
        }

        // Check stop loss hit
        if (stop_loss && price.low_price <= stop_loss) {
          return {
            outcome_type: OUTCOME_TYPES.SL_HIT,
            outcome_date: price.price_date,
            outcome_price: stop_loss,
            return_percentage: this.calculateReturn(entryPrice, stop_loss),
            days_held: daysSinceRec
          };
        }
      }

      // Check expiry
      if (daysHeld >= DEFAULT_EXPIRY_DAYS) {
        return {
          outcome_type: OUTCOME_TYPES.EXPIRED,
          outcome_date: latestPrice.price_date,
          outcome_price: latestPrice.close_price,
          return_percentage: this.calculateReturn(entryPrice, latestPrice.close_price),
          days_held: daysHeld
        };
      }
    }

    // For SELL recommendations (inverse logic):
    // - Target hit when low <= target (price went down)
    // - Stop loss hit when high >= stop_loss (price went up)
    if (action === 'SELL') {
      const priceHistory = await this.getPricesSinceRecommendation(stock_id, recommendation_date);

      for (const price of priceHistory) {
        const priceDate = new Date(price.price_date);
        const daysSinceRec = Math.floor((priceDate - recDate) / (1000 * 60 * 60 * 24));

        // For SELL, target is lower price
        if (target_price && price.low_price <= target_price) {
          return {
            outcome_type: OUTCOME_TYPES.TARGET_HIT,
            outcome_date: price.price_date,
            outcome_price: target_price,
            return_percentage: this.calculateReturn(entryPrice, target_price, true),
            days_held: daysSinceRec
          };
        }

        // For SELL, stop loss is higher price
        if (stop_loss && price.high_price >= stop_loss) {
          return {
            outcome_type: OUTCOME_TYPES.SL_HIT,
            outcome_date: price.price_date,
            outcome_price: stop_loss,
            return_percentage: this.calculateReturn(entryPrice, stop_loss, true),
            days_held: daysSinceRec
          };
        }
      }

      // Check expiry
      if (daysHeld >= DEFAULT_EXPIRY_DAYS) {
        return {
          outcome_type: OUTCOME_TYPES.EXPIRED,
          outcome_date: latestPrice.price_date,
          outcome_price: latestPrice.close_price,
          return_percentage: this.calculateReturn(entryPrice, latestPrice.close_price, true),
          days_held: daysHeld
        };
      }
    }

    return null; // Still active
  },

  /**
   * Get prices since recommendation date
   */
  async getPricesSinceRecommendation(stockId, recommendationDate) {
    const result = await db.query(`
      SELECT * FROM stock_prices
      WHERE stock_id = $1 AND price_date >= $2
      ORDER BY price_date ASC
    `, [stockId, recommendationDate]);

    return result.rows;
  },

  /**
   * Calculate return percentage
   */
  calculateReturn(entryPrice, exitPrice, isShort = false) {
    if (!entryPrice || entryPrice === 0) return 0;

    if (isShort) {
      // For short/sell positions, profit when price goes down
      return ((entryPrice - exitPrice) / entryPrice * 100).toFixed(4);
    }

    // For long/buy positions
    return ((exitPrice - entryPrice) / entryPrice * 100).toFixed(4);
  },

  /**
   * Save outcome to database
   */
  async saveOutcome(recommendationId, outcome) {
    logger.info('Saving outcome', { recommendationId, outcome });

    try {
      // Insert outcome
      await db.query(`
        INSERT INTO recommendation_outcomes (
          recommendation_id, outcome_type, outcome_date, outcome_price, return_percentage, days_held
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (recommendation_id) DO UPDATE SET
          outcome_type = EXCLUDED.outcome_type,
          outcome_date = EXCLUDED.outcome_date,
          outcome_price = EXCLUDED.outcome_price,
          return_percentage = EXCLUDED.return_percentage,
          days_held = EXCLUDED.days_held
      `, [
        recommendationId,
        outcome.outcome_type,
        outcome.outcome_date,
        outcome.outcome_price,
        outcome.return_percentage,
        outcome.days_held
      ]);

      // Update recommendation status
      await db.query(`
        UPDATE recommendations SET status = 'CLOSED' WHERE id = $1
      `, [recommendationId]);

      logger.info('Outcome saved', { recommendationId, type: outcome.outcome_type });
      return true;
    } catch (error) {
      logger.error('Save outcome failed', { recommendationId, error: error.message });
      throw error;
    }
  },

  /**
   * Process all active recommendations
   * This is the main job that runs after price updates
   */
  async processAllActiveRecommendations() {
    logger.info('Processing all active recommendations');

    const result = await db.query(`
      SELECT r.*, s.symbol
      FROM recommendations r
      LEFT JOIN stocks s ON s.id = r.stock_id
      WHERE r.status = 'ACTIVE'
        AND r.stock_id IS NOT NULL
        AND (r.target_price IS NOT NULL OR r.stop_loss IS NOT NULL)
      ORDER BY r.recommendation_date DESC
    `);

    const recommendations = result.rows;
    logger.info('Active recommendations to process', { count: recommendations.length });

    let processed = 0;
    let closedTargetHit = 0;
    let closedSlHit = 0;
    let closedExpired = 0;
    let stillActive = 0;
    let errors = 0;

    for (const rec of recommendations) {
      try {
        const outcome = await this.checkOutcome(rec);

        if (outcome) {
          await this.saveOutcome(rec.id, outcome);

          switch (outcome.outcome_type) {
            case OUTCOME_TYPES.TARGET_HIT: closedTargetHit++; break;
            case OUTCOME_TYPES.SL_HIT: closedSlHit++; break;
            case OUTCOME_TYPES.EXPIRED: closedExpired++; break;
          }
        } else {
          stillActive++;
        }

        processed++;
      } catch (error) {
        logger.error('Processing error', { recId: rec.id, error: error.message });
        errors++;
      }
    }

    const summary = {
      processed,
      closedTargetHit,
      closedSlHit,
      closedExpired,
      stillActive,
      errors
    };

    logger.info('Processing complete', summary);
    return summary;
  },

  /**
   * Get outcome for a specific recommendation
   */
  async getOutcome(recommendationId) {
    const result = await db.query(`
      SELECT * FROM recommendation_outcomes
      WHERE recommendation_id = $1
    `, [recommendationId]);

    return result.rows[0] || null;
  },

  /**
   * Get outcome statistics
   */
  async getOutcomeStats() {
    const result = await db.query(`
      SELECT
        outcome_type,
        COUNT(*) as count,
        AVG(return_percentage) as avg_return,
        AVG(days_held) as avg_days_held
      FROM recommendation_outcomes
      GROUP BY outcome_type
    `);

    return result.rows;
  },

  /**
   * Get outcome statistics for an expert
   */
  async getExpertOutcomeStats(expertName) {
    const result = await db.query(`
      SELECT
        ro.outcome_type,
        COUNT(*) as count,
        AVG(ro.return_percentage) as avg_return,
        AVG(ro.days_held) as avg_days_held
      FROM recommendation_outcomes ro
      INNER JOIN recommendations r ON r.id = ro.recommendation_id
      WHERE r.expert_name = $1
      GROUP BY ro.outcome_type
    `, [expertName]);

    return result.rows;
  },

  /**
   * Get recent outcomes
   */
  async getRecentOutcomes(limit = 20) {
    const result = await db.query(`
      SELECT
        ro.*,
        r.expert_name,
        r.action,
        r.recommended_price,
        r.target_price,
        r.stop_loss,
        s.symbol,
        s.company_name
      FROM recommendation_outcomes ro
      INNER JOIN recommendations r ON r.id = ro.recommendation_id
      LEFT JOIN stocks s ON s.id = r.stock_id
      ORDER BY ro.outcome_date DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  }
};

export default outcomeService;
