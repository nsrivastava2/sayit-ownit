/**
 * Portfolio Simulation Service
 *
 * Simulates "What if I followed Expert X with ₹Y capital?"
 * Calculates returns, XIRR, and generates trade logs.
 */

import pool from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Calculate XIRR (Extended Internal Rate of Return) using Newton-Raphson method
 *
 * XIRR finds the rate 'r' where: SUM(cashflow_i / (1+r)^(days_i/365)) = 0
 *
 * @param {Array<{date: Date, amount: number}>} cashFlows - Array of cash flows (negative = outflow, positive = inflow)
 * @param {number} guess - Initial guess for rate (default 0.1 = 10%)
 * @param {number} maxIterations - Maximum iterations (default 100)
 * @param {number} tolerance - Convergence tolerance (default 1e-7)
 * @returns {number|null} - XIRR as decimal (0.15 = 15%) or null if no convergence
 */
export function calculateXIRR(cashFlows, guess = 0.1, maxIterations = 100, tolerance = 1e-7) {
  if (!cashFlows || cashFlows.length < 2) return null;

  // Need at least one positive and one negative cash flow
  const hasPositive = cashFlows.some(cf => cf.amount > 0);
  const hasNegative = cashFlows.some(cf => cf.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  // Sort by date
  const sorted = [...cashFlows].sort((a, b) => new Date(a.date) - new Date(b.date));
  const firstDate = new Date(sorted[0].date);

  // Calculate days from first date for each cash flow
  const flows = sorted.map(cf => ({
    amount: cf.amount,
    days: (new Date(cf.date) - firstDate) / (1000 * 60 * 60 * 24)
  }));

  let rate = guess;

  for (let i = 0; i < maxIterations; i++) {
    // Calculate NPV and its derivative at current rate
    let npv = 0;
    let npvDerivative = 0;

    for (const flow of flows) {
      const years = flow.days / 365;
      const discountFactor = Math.pow(1 + rate, years);

      npv += flow.amount / discountFactor;
      npvDerivative -= (flow.amount * years) / (discountFactor * (1 + rate));
    }

    // Check for convergence
    if (Math.abs(npv) < tolerance) {
      return rate;
    }

    // Newton-Raphson update
    if (Math.abs(npvDerivative) < 1e-10) {
      // Derivative too small, adjust guess slightly
      rate += 0.01;
      continue;
    }

    const newRate = rate - npv / npvDerivative;

    // Rate must be > -1 (otherwise (1+rate)^n is undefined for non-integers)
    if (newRate <= -1) {
      rate = (rate + -0.99) / 2; // Move towards -0.99
      continue;
    }

    rate = newRate;
  }

  // Did not converge, return best estimate if reasonable
  if (rate > -1 && rate < 10) { // Between -100% and 1000%
    return rate;
  }

  return null;
}

/**
 * Run a portfolio simulation for an expert
 *
 * @param {Object} params - Simulation parameters
 * @param {string} params.expertId - Expert UUID
 * @param {number} params.initialCapital - Starting capital (default 100000)
 * @param {Date|string} params.startDate - Simulation start date
 * @param {Date|string} params.endDate - Simulation end date
 * @param {string} params.positionSizingMethod - EQUAL_WEIGHT, FIXED_AMOUNT, or PERCENTAGE
 * @param {number} params.positionSizeValue - Amount or percentage per trade
 * @param {number} params.maxConcurrentPositions - Max simultaneous positions
 * @param {string} [params.userId] - Optional user ID to save simulation
 * @returns {Object} - Simulation results
 */
export async function runSimulation({
  expertId,
  initialCapital = 100000,
  startDate,
  endDate,
  positionSizingMethod = 'FIXED_AMOUNT',
  positionSizeValue = 10000,
  maxConcurrentPositions = 10,
  userId = null
}) {
  logger.info(`Running simulation for expert ${expertId}`, {
    initialCapital,
    startDate,
    endDate,
    positionSizingMethod
  });

  // Get expert details
  const expertResult = await pool.query(
    'SELECT id, canonical_name FROM experts WHERE id = $1',
    [expertId]
  );

  if (expertResult.rows.length === 0) {
    throw new Error('Expert not found');
  }

  const expert = expertResult.rows[0];

  // Get all recommendations with outcomes in date range
  const recsResult = await pool.query(`
    SELECT
      r.id,
      r.nse_symbol,
      r.share_name,
      r.action,
      r.recommendation_date,
      r.recommended_price,
      r.target_price,
      r.stop_loss,
      ro.outcome_type,
      ro.outcome_date,
      ro.outcome_price,
      ro.return_percentage,
      ro.days_held
    FROM recommendations r
    LEFT JOIN recommendation_outcomes ro ON r.id = ro.recommendation_id
    WHERE r.expert_name = $1
      AND r.recommendation_date >= $2
      AND r.recommendation_date <= $3
      AND r.action IN ('BUY', 'SELL')
    ORDER BY r.recommendation_date ASC
  `, [expert.canonical_name, startDate, endDate]);

  const recommendations = recsResult.rows;

  if (recommendations.length === 0) {
    return {
      expertId,
      expertName: expert.canonical_name,
      initialCapital,
      startDate,
      endDate,
      finalValue: initialCapital,
      totalReturnPct: 0,
      xirr: null,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      activeTrades: 0,
      winRate: null,
      avgReturnPerTrade: null,
      tradeLog: [],
      cashFlows: [],
      message: 'No recommendations found in the specified date range'
    };
  }

  // Initialize simulation state
  let cashBalance = initialCapital;
  let portfolioValue = initialCapital;
  const tradeLog = [];
  const cashFlows = [
    { date: startDate, amount: -initialCapital, type: 'INITIAL' } // Initial investment (outflow)
  ];
  const activePositions = new Map(); // symbol -> { shares, entryPrice, entryDate, recId }

  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let activeTrades = 0;
  let totalReturn = 0;

  // Process each recommendation
  for (const rec of recommendations) {
    const symbol = rec.nse_symbol || rec.share_name;
    const entryPrice = rec.recommended_price;

    // Skip if no entry price
    if (!entryPrice || entryPrice <= 0) continue;

    // Calculate position size
    let positionAmount;
    switch (positionSizingMethod) {
      case 'EQUAL_WEIGHT':
        positionAmount = cashBalance / maxConcurrentPositions;
        break;
      case 'PERCENTAGE':
        positionAmount = portfolioValue * (positionSizeValue / 100);
        break;
      case 'FIXED_AMOUNT':
      default:
        positionAmount = positionSizeValue;
    }

    // Don't exceed available cash or take tiny positions
    positionAmount = Math.min(positionAmount, cashBalance);
    if (positionAmount < 100) continue; // Minimum position size

    // Check if we have room for more positions
    if (activePositions.size >= maxConcurrentPositions && !activePositions.has(symbol)) {
      continue; // Skip if at max concurrent positions
    }

    // For BUY recommendations
    if (rec.action === 'BUY') {
      const shares = Math.floor(positionAmount / entryPrice);
      if (shares < 1) continue;

      const actualCost = shares * entryPrice;

      // Record the buy
      cashBalance -= actualCost;
      cashFlows.push({
        date: rec.recommendation_date,
        amount: -actualCost,
        type: 'BUY'
      });

      // If we have an outcome, process the exit
      if (rec.outcome_type && rec.outcome_type !== 'ACTIVE' && rec.outcome_price) {
        const exitValue = shares * rec.outcome_price;
        const pnl = exitValue - actualCost;
        const returnPct = ((rec.outcome_price - entryPrice) / entryPrice) * 100;

        cashBalance += exitValue;
        cashFlows.push({
          date: rec.outcome_date || rec.recommendation_date,
          amount: exitValue,
          type: 'SELL'
        });

        totalTrades++;
        totalReturn += returnPct;

        if (pnl > 0) {
          winningTrades++;
        } else {
          losingTrades++;
        }

        tradeLog.push({
          recId: rec.id,
          symbol,
          action: rec.action,
          entryDate: rec.recommendation_date,
          entryPrice: parseFloat(entryPrice),
          exitDate: rec.outcome_date,
          exitPrice: parseFloat(rec.outcome_price),
          shares,
          pnl: parseFloat(pnl.toFixed(2)),
          returnPct: parseFloat(returnPct.toFixed(2)),
          outcome: rec.outcome_type,
          daysHeld: rec.days_held
        });
      } else {
        // Position still active
        activePositions.set(symbol, {
          recId: rec.id,
          shares,
          entryPrice: parseFloat(entryPrice),
          entryDate: rec.recommendation_date,
          cost: actualCost
        });
        activeTrades++;
      }
    }

    // For SELL recommendations (short selling - simplified as inverse BUY)
    if (rec.action === 'SELL') {
      // Simplified: treat SELL as expecting price to go down
      // If target hit (price went down to target) = win
      // If SL hit (price went up to SL) = loss
      const shares = Math.floor(positionAmount / entryPrice);
      if (shares < 1) continue;

      const actualCost = shares * entryPrice;

      if (rec.outcome_type && rec.outcome_type !== 'ACTIVE' && rec.outcome_price) {
        // For shorts: profit when price drops, loss when price rises
        const pnl = (entryPrice - rec.outcome_price) * shares;
        const returnPct = ((entryPrice - rec.outcome_price) / entryPrice) * 100;

        totalTrades++;
        totalReturn += returnPct;

        // For display, show as if we received the profit/loss
        cashFlows.push({
          date: rec.recommendation_date,
          amount: -actualCost,
          type: 'SHORT_ENTRY'
        });
        cashFlows.push({
          date: rec.outcome_date || rec.recommendation_date,
          amount: actualCost + pnl,
          type: 'SHORT_EXIT'
        });

        if (pnl > 0) {
          winningTrades++;
        } else {
          losingTrades++;
        }

        tradeLog.push({
          recId: rec.id,
          symbol,
          action: rec.action,
          entryDate: rec.recommendation_date,
          entryPrice: parseFloat(entryPrice),
          exitDate: rec.outcome_date,
          exitPrice: parseFloat(rec.outcome_price),
          shares,
          pnl: parseFloat(pnl.toFixed(2)),
          returnPct: parseFloat(returnPct.toFixed(2)),
          outcome: rec.outcome_type,
          daysHeld: rec.days_held
        });
      } else {
        activeTrades++;
      }
    }
  }

  // Calculate final portfolio value (cash + active positions at entry price)
  let activePositionsValue = 0;
  for (const [symbol, pos] of activePositions) {
    activePositionsValue += pos.shares * pos.entryPrice; // Use entry price as conservative estimate
  }
  portfolioValue = cashBalance + activePositionsValue;

  // Add final value as cash flow (inflow at end date)
  cashFlows.push({
    date: endDate,
    amount: portfolioValue,
    type: 'FINAL'
  });

  // Calculate metrics
  const totalReturnPct = ((portfolioValue - initialCapital) / initialCapital) * 100;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : null;
  const avgReturnPerTrade = totalTrades > 0 ? totalReturn / totalTrades : null;

  // Calculate XIRR
  const xirr = calculateXIRR(cashFlows);

  const results = {
    expertId,
    expertName: expert.canonical_name,
    initialCapital,
    startDate,
    endDate,
    positionSizingMethod,
    positionSizeValue,
    maxConcurrentPositions,
    finalValue: parseFloat(portfolioValue.toFixed(2)),
    totalReturnPct: parseFloat(totalReturnPct.toFixed(2)),
    xirr: xirr !== null ? parseFloat((xirr * 100).toFixed(2)) : null, // Convert to percentage
    totalTrades,
    winningTrades,
    losingTrades,
    activeTrades,
    winRate: winRate !== null ? parseFloat(winRate.toFixed(2)) : null,
    avgReturnPerTrade: avgReturnPerTrade !== null ? parseFloat(avgReturnPerTrade.toFixed(2)) : null,
    tradeLog,
    cashFlows: cashFlows.map(cf => ({
      ...cf,
      amount: parseFloat(cf.amount.toFixed(2))
    }))
  };

  // Save simulation if user is provided
  if (userId) {
    try {
      await saveSimulation(userId, results);
    } catch (err) {
      logger.warn('Failed to save simulation', { error: err.message });
    }
  }

  return results;
}

/**
 * Save simulation results to database
 */
async function saveSimulation(userId, results) {
  const query = `
    INSERT INTO portfolio_simulations (
      user_id, expert_id, initial_capital, start_date, end_date,
      position_sizing_method, position_size_value, max_concurrent_positions,
      final_value, total_return_pct, xirr,
      total_trades, winning_trades, losing_trades, active_trades,
      win_rate, avg_return_per_trade,
      trade_log, cash_flows
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
    )
    RETURNING id
  `;

  const values = [
    userId,
    results.expertId,
    results.initialCapital,
    results.startDate,
    results.endDate,
    results.positionSizingMethod,
    results.positionSizeValue,
    results.maxConcurrentPositions,
    results.finalValue,
    results.totalReturnPct,
    results.xirr,
    results.totalTrades,
    results.winningTrades,
    results.losingTrades,
    results.activeTrades,
    results.winRate,
    results.avgReturnPerTrade,
    JSON.stringify(results.tradeLog),
    JSON.stringify(results.cashFlows)
  ];

  const result = await pool.query(query, values);
  return result.rows[0].id;
}

/**
 * Get user's saved simulations
 */
export async function getUserSimulations(userId, limit = 20) {
  const result = await pool.query(`
    SELECT * FROM simulation_summaries
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [userId, limit]);

  return result.rows;
}

/**
 * Get simulation details by ID
 */
export async function getSimulationById(simulationId) {
  const result = await pool.query(`
    SELECT
      ps.*,
      e.canonical_name AS expert_name
    FROM portfolio_simulations ps
    JOIN experts e ON ps.expert_id = e.id
    WHERE ps.id = $1
  `, [simulationId]);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export default {
  calculateXIRR,
  runSimulation,
  getUserSimulations,
  getSimulationById
};
