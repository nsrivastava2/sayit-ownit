/**
 * Expert Metrics Calculation Service
 *
 * Calculates performance metrics for all experts:
 * - Win rate (targets hit / closed recommendations)
 * - Average return percentage
 * - Rolling 30/90 day performance
 * - Composite ranking score
 *
 * Ranking Algorithm (v1):
 *   Score = (0.50 × Win_Rate) + (0.30 × Avg_Return_Normalized) + (0.20 × Volume_Credibility)
 *   Volume_Credibility = MIN(100, total_recommendations * 10)
 */

import { db } from '../config/index.js';

export const metricsService = {
  /**
   * Calculate metrics for all experts and save to expert_metrics table
   */
  async calculateAllExpertMetrics() {
    const today = new Date().toISOString().split('T')[0];
    console.log(`[MetricsService] Calculating metrics for ${today}`);

    // Get all active experts
    const expertsResult = await db.query(
      'SELECT id, canonical_name FROM experts WHERE is_active = true'
    );
    const experts = expertsResult.rows;
    console.log(`[MetricsService] Found ${experts.length} active experts`);

    const metricsResults = [];

    for (const expert of experts) {
      try {
        const metrics = await this.calculateExpertMetrics(expert.id, expert.canonical_name);
        if (metrics) {
          metricsResults.push(metrics);
        }
      } catch (err) {
        console.error(`[MetricsService] Error calculating metrics for ${expert.canonical_name}:`, err.message);
      }
    }

    // Calculate rankings based on composite score
    metricsResults.sort((a, b) => b.ranking_score - a.ranking_score);
    for (let i = 0; i < metricsResults.length; i++) {
      metricsResults[i].rank_position = i + 1;
    }

    // Save all metrics to database
    for (const metrics of metricsResults) {
      await this.saveMetrics(metrics, today);
    }

    console.log(`[MetricsService] Saved metrics for ${metricsResults.length} experts`);
    return metricsResults;
  },

  /**
   * Calculate metrics for a single expert
   */
  async calculateExpertMetrics(expertId, expertName) {
    // Get all recommendations for this expert
    const recsResult = await db.query(`
      SELECT
        r.id,
        r.action,
        r.recommendation_date,
        r.recommended_price,
        r.target_price,
        r.stop_loss,
        r.status,
        ro.outcome_type,
        ro.outcome_date,
        ro.return_percentage,
        ro.days_held
      FROM recommendations r
      LEFT JOIN recommendation_outcomes ro ON r.id = ro.recommendation_id
      WHERE r.expert_name = $1
    `, [expertName]);

    const recommendations = recsResult.rows;

    if (recommendations.length === 0) {
      return null; // No recommendations, skip this expert
    }

    // Calculate counts
    const total = recommendations.length;
    const active = recommendations.filter(r => !r.outcome_type).length;
    const closed = total - active;
    const targetHits = recommendations.filter(r => r.outcome_type === 'TARGET_HIT').length;
    const slHits = recommendations.filter(r => r.outcome_type === 'SL_HIT').length;
    const expired = recommendations.filter(r => r.outcome_type === 'EXPIRED').length;

    // Calculate win rate (only on closed recommendations)
    const overallWinRate = closed > 0 ? (targetHits / closed) * 100 : null;

    // Calculate rolling win rates
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);

    const last30dRecs = recommendations.filter(r =>
      r.outcome_type && new Date(r.outcome_date) >= thirtyDaysAgo
    );
    const last90dRecs = recommendations.filter(r =>
      r.outcome_type && new Date(r.outcome_date) >= ninetyDaysAgo
    );

    const last30dWinRate = last30dRecs.length > 0
      ? (last30dRecs.filter(r => r.outcome_type === 'TARGET_HIT').length / last30dRecs.length) * 100
      : null;
    const last90dWinRate = last90dRecs.length > 0
      ? (last90dRecs.filter(r => r.outcome_type === 'TARGET_HIT').length / last90dRecs.length) * 100
      : null;

    // Calculate return metrics
    const closedWithReturn = recommendations.filter(r =>
      r.outcome_type && r.return_percentage !== null
    );

    let avgReturn = null;
    let avgWinningReturn = null;
    let avgLosingReturn = null;
    let totalReturn = null;

    if (closedWithReturn.length > 0) {
      const returns = closedWithReturn.map(r => parseFloat(r.return_percentage));
      totalReturn = returns.reduce((a, b) => a + b, 0);
      avgReturn = totalReturn / returns.length;

      const winningReturns = returns.filter(r => r > 0);
      const losingReturns = returns.filter(r => r < 0);

      if (winningReturns.length > 0) {
        avgWinningReturn = winningReturns.reduce((a, b) => a + b, 0) / winningReturns.length;
      }
      if (losingReturns.length > 0) {
        avgLosingReturn = losingReturns.reduce((a, b) => a + b, 0) / losingReturns.length;
      }
    }

    // Calculate average holding days
    const withHoldingDays = closedWithReturn.filter(r => r.days_held !== null);
    const avgHoldingDays = withHoldingDays.length > 0
      ? withHoldingDays.reduce((sum, r) => sum + r.days_held, 0) / withHoldingDays.length
      : null;

    // Calculate ranking score
    const rankingScore = this.calculateRankingScore(
      overallWinRate,
      avgReturn,
      total
    );

    return {
      expert_id: expertId,
      total_recommendations: total,
      active_recommendations: active,
      closed_recommendations: closed,
      target_hit_count: targetHits,
      sl_hit_count: slHits,
      expired_count: expired,
      overall_win_rate: overallWinRate,
      last_30d_win_rate: last30dWinRate,
      last_90d_win_rate: last90dWinRate,
      avg_return_pct: avgReturn,
      avg_winning_return_pct: avgWinningReturn,
      avg_losing_return_pct: avgLosingReturn,
      total_return_pct: totalReturn,
      avg_holding_days: avgHoldingDays,
      ranking_score: rankingScore
    };
  },

  /**
   * Calculate composite ranking score
   *
   * Components:
   * - Win Rate (50%): Higher win rate = better
   * - Avg Return Normalized (30%): Normalize avg return to 0-100 scale
   * - Volume Credibility (20%): More recommendations = more credible
   */
  calculateRankingScore(winRate, avgReturn, totalRecs) {
    // Default to 0 if missing data
    const winRateScore = winRate ?? 0;

    // Normalize avg return: assume -20% to +50% range maps to 0-100
    let returnScore = 0;
    if (avgReturn !== null) {
      // Clamp to reasonable range
      const clampedReturn = Math.max(-20, Math.min(50, avgReturn));
      // Map -20 to 50 => 0 to 100
      returnScore = ((clampedReturn + 20) / 70) * 100;
    }

    // Volume credibility: 10 recommendations = 100% credibility, capped at 100
    const volumeScore = Math.min(100, totalRecs * 10);

    // Weighted composite
    const score = (0.50 * winRateScore) + (0.30 * returnScore) + (0.20 * volumeScore);

    return Math.round(score * 100) / 100; // Round to 2 decimals
  },

  /**
   * Save metrics to database (upsert)
   */
  async saveMetrics(metrics, date) {
    const result = await db.query(`
      INSERT INTO expert_metrics (
        expert_id, calculation_date,
        total_recommendations, active_recommendations, closed_recommendations,
        target_hit_count, sl_hit_count, expired_count,
        overall_win_rate, last_30d_win_rate, last_90d_win_rate,
        avg_return_pct, avg_winning_return_pct, avg_losing_return_pct,
        total_return_pct, avg_holding_days, ranking_score, rank_position
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (expert_id, calculation_date)
      DO UPDATE SET
        total_recommendations = EXCLUDED.total_recommendations,
        active_recommendations = EXCLUDED.active_recommendations,
        closed_recommendations = EXCLUDED.closed_recommendations,
        target_hit_count = EXCLUDED.target_hit_count,
        sl_hit_count = EXCLUDED.sl_hit_count,
        expired_count = EXCLUDED.expired_count,
        overall_win_rate = EXCLUDED.overall_win_rate,
        last_30d_win_rate = EXCLUDED.last_30d_win_rate,
        last_90d_win_rate = EXCLUDED.last_90d_win_rate,
        avg_return_pct = EXCLUDED.avg_return_pct,
        avg_winning_return_pct = EXCLUDED.avg_winning_return_pct,
        avg_losing_return_pct = EXCLUDED.avg_losing_return_pct,
        total_return_pct = EXCLUDED.total_return_pct,
        avg_holding_days = EXCLUDED.avg_holding_days,
        ranking_score = EXCLUDED.ranking_score,
        rank_position = EXCLUDED.rank_position,
        updated_at = NOW()
      RETURNING *
    `, [
      metrics.expert_id, date,
      metrics.total_recommendations, metrics.active_recommendations, metrics.closed_recommendations,
      metrics.target_hit_count, metrics.sl_hit_count, metrics.expired_count,
      metrics.overall_win_rate, metrics.last_30d_win_rate, metrics.last_90d_win_rate,
      metrics.avg_return_pct, metrics.avg_winning_return_pct, metrics.avg_losing_return_pct,
      metrics.total_return_pct, metrics.avg_holding_days, metrics.ranking_score, metrics.rank_position
    ]);

    return result.rows[0];
  },

  /**
   * Get latest metrics for an expert
   */
  async getExpertMetrics(expertName) {
    const result = await db.query(`
      SELECT em.*
      FROM expert_metrics em
      JOIN experts e ON em.expert_id = e.id
      WHERE e.canonical_name = $1
      ORDER BY em.calculation_date DESC
      LIMIT 1
    `, [expertName]);

    return result.rows[0] || null;
  },

  /**
   * Get leaderboard (ranked experts with metrics)
   */
  async getLeaderboard(limit = 50) {
    const result = await db.query(`
      SELECT
        e.canonical_name as expert_name,
        em.total_recommendations,
        em.closed_recommendations,
        em.target_hit_count,
        em.sl_hit_count,
        em.overall_win_rate,
        em.avg_return_pct,
        em.ranking_score,
        em.rank_position,
        em.calculation_date
      FROM expert_metrics em
      JOIN experts e ON em.expert_id = e.id
      WHERE em.calculation_date = (
        SELECT MAX(calculation_date) FROM expert_metrics
      )
      ORDER BY em.rank_position ASC
      LIMIT $1
    `, [limit]);

    return result.rows;
  },

  /**
   * Get metrics history for trend analysis
   */
  async getMetricsHistory(expertName, days = 30) {
    const result = await db.query(`
      SELECT em.calculation_date, em.overall_win_rate, em.avg_return_pct, em.rank_position
      FROM expert_metrics em
      JOIN experts e ON em.expert_id = e.id
      WHERE e.canonical_name = $1
        AND em.calculation_date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY em.calculation_date ASC
    `, [expertName]);

    return result.rows;
  }
};

export default metricsService;
