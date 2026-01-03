import express from 'express';
import { db } from '../config/index.js';
import stockService from '../services/stockService.js';
import { sanitizeError } from '../utils/errorHandler.js';

const router = express.Router();

/**
 * GET /api/shares
 * List all shares with recommendation counts
 */
router.get('/', async (req, res) => {
  try {
    const shares = await db.getShares();

    res.json({
      shares,
      total: shares.length
    });
  } catch (error) {
    console.error('Error fetching shares:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

/**
 * GET /api/shares/:symbol
 * Get share details with all recommendations
 * Now includes stock master data (sector, market cap, company name)
 */
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Try to get stock from master table first
    const stock = await stockService.getStockBySymbol(symbol);

    const { data, count } = await db.getRecommendations({
      share: symbol,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Calculate statistics
    const stats = {
      totalRecommendations: count,
      buyCount: data.filter(r => r.action === 'BUY').length,
      sellCount: data.filter(r => r.action === 'SELL').length,
      holdCount: data.filter(r => r.action === 'HOLD').length,
      avgTargetPrice: data.filter(r => r.target_price).length > 0
        ? (data.filter(r => r.target_price).reduce((sum, r) => sum + r.target_price, 0) / data.filter(r => r.target_price).length).toFixed(2)
        : null,
      avgStopLoss: data.filter(r => r.stop_loss).length > 0
        ? (data.filter(r => r.stop_loss).reduce((sum, r) => sum + r.stop_loss, 0) / data.filter(r => r.stop_loss).length).toFixed(2)
        : null
    };

    // Get unique experts who recommended this
    const expertsSet = new Set(data.map(r => r.expert_name));

    res.json({
      share: {
        // From stock master table (if available)
        name: stock?.company_name || data[0]?.share_name || symbol,
        symbol: stock?.symbol || data[0]?.nse_symbol || symbol,
        sector: stock?.sector || null,
        industry: stock?.industry || null,
        marketCapCategory: stock?.market_cap_category || null,
        isin: stock?.isin || null,
        // Computed stats
        stats,
        uniqueExperts: expertsSet.size,
        experts: Array.from(expertsSet)
      },
      recommendations: data,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching share:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

export default router;
