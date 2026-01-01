/**
 * Recommendation Validator Service
 *
 * Validates recommendations for logical consistency and completeness.
 * Flags recommendations that have:
 * - Illogical stop loss (SL > entry for BUY, SL < entry for SELL)
 * - Missing critical information (entry price, target, stop loss)
 * - Unusual risk/reward ratios
 */

import { db } from '../config/index.js';

// Flag reason codes
export const FLAG_REASONS = {
  ILLOGICAL_SL_BUY: 'ILLOGICAL_SL_BUY',    // Stop loss above entry for BUY
  ILLOGICAL_SL_SELL: 'ILLOGICAL_SL_SELL',  // Stop loss below entry for SELL
  MISSING_ENTRY: 'MISSING_ENTRY',           // No recommended_price
  MISSING_TARGET: 'MISSING_TARGET',         // No target_price
  MISSING_SL: 'MISSING_SL',                 // No stop_loss
  HIGH_RISK_RATIO: 'HIGH_RISK_RATIO',       // Risk > 2x reward
  SL_EQUALS_ENTRY: 'SL_EQUALS_ENTRY',       // Stop loss equals entry price
  TARGET_WRONG_DIRECTION: 'TARGET_WRONG_DIRECTION' // Target below entry for BUY
};

// Human-readable messages for each flag reason
export const FLAG_MESSAGES = {
  ILLOGICAL_SL_BUY: 'Stop loss is above entry price for a BUY recommendation',
  ILLOGICAL_SL_SELL: 'Stop loss is below entry price for a SELL recommendation',
  MISSING_ENTRY: 'Entry price is missing',
  MISSING_TARGET: 'Target price is missing',
  MISSING_SL: 'Stop loss is missing',
  HIGH_RISK_RATIO: 'Risk is more than 2x the potential reward',
  SL_EQUALS_ENTRY: 'Stop loss equals entry price',
  TARGET_WRONG_DIRECTION: 'Target price is in the wrong direction for this action'
};

export const recommendationValidator = {
  /**
   * Validate a recommendation and return flag reasons
   * @param {Object} rec - Recommendation object
   * @returns {string[]} Array of flag reason codes (empty if valid)
   */
  validate(rec) {
    const flags = [];
    const action = (rec.action || '').toUpperCase();
    const entryPrice = parseFloat(rec.recommended_price);
    const targetPrice = parseFloat(rec.target_price);
    const stopLoss = parseFloat(rec.stop_loss);

    // Check for missing critical fields
    if (!rec.recommended_price || isNaN(entryPrice)) {
      flags.push(FLAG_REASONS.MISSING_ENTRY);
    }
    if (!rec.target_price || isNaN(targetPrice)) {
      flags.push(FLAG_REASONS.MISSING_TARGET);
    }
    if (!rec.stop_loss || isNaN(stopLoss)) {
      flags.push(FLAG_REASONS.MISSING_SL);
    }

    // If we have all prices, validate logic
    if (!isNaN(entryPrice) && !isNaN(stopLoss)) {
      // Check if SL equals entry (always wrong)
      if (stopLoss === entryPrice) {
        flags.push(FLAG_REASONS.SL_EQUALS_ENTRY);
      }

      if (action === 'BUY') {
        // For BUY: SL should be BELOW entry (you lose if price drops)
        if (stopLoss > entryPrice) {
          flags.push(FLAG_REASONS.ILLOGICAL_SL_BUY);
        }

        // For BUY: Target should be ABOVE entry
        if (!isNaN(targetPrice) && targetPrice < entryPrice) {
          flags.push(FLAG_REASONS.TARGET_WRONG_DIRECTION);
        }
      } else if (action === 'SELL') {
        // For SELL: SL should be ABOVE entry (you lose if price rises)
        if (stopLoss < entryPrice) {
          flags.push(FLAG_REASONS.ILLOGICAL_SL_SELL);
        }

        // For SELL: Target should be BELOW entry
        if (!isNaN(targetPrice) && targetPrice > entryPrice) {
          flags.push(FLAG_REASONS.TARGET_WRONG_DIRECTION);
        }
      }
    }

    // Check risk/reward ratio
    if (!isNaN(entryPrice) && !isNaN(targetPrice) && !isNaN(stopLoss)) {
      let risk, reward;
      if (action === 'BUY') {
        risk = entryPrice - stopLoss;
        reward = targetPrice - entryPrice;
      } else if (action === 'SELL') {
        risk = stopLoss - entryPrice;
        reward = entryPrice - targetPrice;
      }

      // Only flag if risk > 2x reward AND both are positive
      if (risk > 0 && reward > 0 && risk > 2 * reward) {
        flags.push(FLAG_REASONS.HIGH_RISK_RATIO);
      }
    }

    return flags;
  },

  /**
   * Validate and flag a recommendation, saving to database
   * @param {string} recommendationId - UUID of the recommendation
   * @returns {Object} { isFlagged, reasons }
   */
  async validateAndFlag(recommendationId) {
    // Get the recommendation
    const result = await db.query(
      'SELECT * FROM recommendations WHERE id = $1',
      [recommendationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Recommendation not found');
    }

    const rec = result.rows[0];
    const flagReasons = this.validate(rec);
    const isFlagged = flagReasons.length > 0;

    // Update the recommendation
    await db.query(
      `UPDATE recommendations
       SET is_flagged = $1, flag_reasons = $2
       WHERE id = $3`,
      [isFlagged, flagReasons.length > 0 ? flagReasons : null, recommendationId]
    );

    return { isFlagged, reasons: flagReasons };
  },

  /**
   * Validate all existing recommendations and flag them
   * Used for backfilling flags on existing data
   */
  async validateAllRecommendations() {
    const result = await db.query('SELECT * FROM recommendations');
    const recommendations = result.rows;

    let flaggedCount = 0;
    const flaggedIds = [];

    for (const rec of recommendations) {
      const flagReasons = this.validate(rec);
      const isFlagged = flagReasons.length > 0;

      await db.query(
        `UPDATE recommendations
         SET is_flagged = $1, flag_reasons = $2
         WHERE id = $3`,
        [isFlagged, flagReasons.length > 0 ? flagReasons : null, rec.id]
      );

      if (isFlagged) {
        flaggedCount++;
        flaggedIds.push({
          id: rec.id,
          share: rec.share_name,
          reasons: flagReasons
        });
      }
    }

    console.log(`[Validator] Checked ${recommendations.length} recommendations, flagged ${flaggedCount}`);
    return {
      total: recommendations.length,
      flagged: flaggedCount,
      flaggedDetails: flaggedIds
    };
  },

  /**
   * Get all flagged recommendations for admin review
   */
  async getFlaggedRecommendations() {
    const result = await db.query(`
      SELECT
        r.id,
        r.recommendation_date,
        r.expert_name,
        r.share_name,
        r.nse_symbol,
        r.action,
        r.recommended_price,
        r.target_price,
        r.stop_loss,
        r.reason,
        r.flag_reasons,
        r.reviewed_at,
        r.reviewer_notes,
        r.created_at,
        r.timestamp_in_video,
        v.title as video_title,
        v.youtube_url,
        v.id as video_id
      FROM recommendations r
      LEFT JOIN videos v ON r.video_id = v.id
      WHERE r.is_flagged = TRUE
      ORDER BY r.created_at DESC
    `);
    return result.rows;
  },

  /**
   * Approve a flagged recommendation (clear the flag)
   */
  async approveRecommendation(recommendationId, notes = null) {
    await db.query(
      `UPDATE recommendations
       SET is_flagged = FALSE,
           reviewed_at = NOW(),
           reviewer_notes = $1
       WHERE id = $2`,
      [notes, recommendationId]
    );

    // Log to history
    await db.query(
      `INSERT INTO recommendation_flag_history
       (recommendation_id, action, notes, created_at)
       VALUES ($1, 'APPROVED', $2, NOW())`,
      [recommendationId, notes]
    );

    return { success: true };
  },

  /**
   * Edit and approve a flagged recommendation
   */
  async editRecommendation(recommendationId, updates, notes = null) {
    // Get current values for history
    const current = await db.query(
      'SELECT recommended_price, target_price, stop_loss, action FROM recommendations WHERE id = $1',
      [recommendationId]
    );

    if (current.rows.length === 0) {
      throw new Error('Recommendation not found');
    }

    const previousValues = current.rows[0];

    // Build update query
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.recommended_price !== undefined) {
      updateFields.push(`recommended_price = $${paramIndex}`);
      values.push(updates.recommended_price);
      paramIndex++;
    }
    if (updates.target_price !== undefined) {
      updateFields.push(`target_price = $${paramIndex}`);
      values.push(updates.target_price);
      paramIndex++;
    }
    if (updates.stop_loss !== undefined) {
      updateFields.push(`stop_loss = $${paramIndex}`);
      values.push(updates.stop_loss);
      paramIndex++;
    }
    if (updates.action !== undefined) {
      updateFields.push(`action = $${paramIndex}`);
      values.push(updates.action.toUpperCase());
      paramIndex++;
    }

    // Clear flag and set review info
    updateFields.push(`is_flagged = FALSE`);
    updateFields.push(`reviewed_at = NOW()`);
    updateFields.push(`reviewer_notes = $${paramIndex}`);
    values.push(notes);
    paramIndex++;

    values.push(recommendationId);

    await db.query(
      `UPDATE recommendations SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    // Log to history
    await db.query(
      `INSERT INTO recommendation_flag_history
       (recommendation_id, action, previous_values, new_values, notes, created_at)
       VALUES ($1, 'EDITED', $2, $3, $4, NOW())`,
      [recommendationId, JSON.stringify(previousValues), JSON.stringify(updates), notes]
    );

    return { success: true };
  },

  /**
   * Get flag statistics
   */
  async getFlagStats() {
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_flagged = TRUE) as flagged_count,
        COUNT(*) FILTER (WHERE is_flagged = FALSE OR is_flagged IS NULL) as clean_count,
        COUNT(*) as total_count
      FROM recommendations
    `);

    const reasonCounts = await db.query(`
      SELECT reason, COUNT(*) as count
      FROM (
        SELECT unnest(flag_reasons) as reason
        FROM recommendations
        WHERE is_flagged = TRUE
      ) AS reasons
      GROUP BY reason
      ORDER BY count DESC
    `);

    return {
      ...result.rows[0],
      reasonBreakdown: reasonCounts.rows
    };
  }
};

export default recommendationValidator;
