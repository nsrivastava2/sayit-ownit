/**
 * Stocks API Routes
 *
 * GET  /api/stocks/search   - Search stocks by symbol/name
 * GET  /api/stocks/sectors  - Get all unique sectors
 * GET  /api/stocks          - List all stocks
 * GET  /api/stocks/:symbol  - Get stock by symbol with stats
 * POST /api/stocks/import   - Bulk import stocks (admin only)
 */

import { Router } from 'express';
import stockService from '../services/stockService.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = Router();

const logger = {
  info: (msg, data) => console.log(`[STOCKS:INFO] ${msg}`, JSON.stringify(data || {})),
  error: (msg, data) => console.error(`[STOCKS:ERROR] ${msg}`, JSON.stringify(data || {}))
};

/**
 * GET /api/stocks/search
 * Search stocks by symbol or company name
 */
router.get('/search', async (req, res) => {
  const { q, limit } = req.query;

  if (!q || q.length < 1) {
    return res.json([]);
  }

  try {
    const stocks = await stockService.searchStocks(q, parseInt(limit) || 20);
    res.json(stocks);
  } catch (error) {
    logger.error('Search failed', { query: q, error: error.message });
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/stocks/sectors
 * Get all unique sectors
 */
router.get('/sectors', async (req, res) => {
  try {
    const sectors = await stockService.getAllSectors();
    res.json(sectors);
  } catch (error) {
    logger.error('Get sectors failed', { error: error.message });
    res.status(500).json({ error: 'Failed to get sectors' });
  }
});

/**
 * GET /api/stocks
 * List all stocks with optional filtering
 */
router.get('/', async (req, res) => {
  const { sector, marketCap, limit = 100, offset = 0 } = req.query;

  try {
    const result = await stockService.getAllStocks({
      sector,
      marketCap,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json(result);
  } catch (error) {
    logger.error('List stocks failed', { error: error.message });
    res.status(500).json({ error: 'Failed to list stocks' });
  }
});

/**
 * GET /api/stocks/:symbol
 * Get stock by symbol with statistics
 */
router.get('/:symbol', async (req, res) => {
  const { symbol } = req.params;

  try {
    const stock = await stockService.getStockBySymbol(symbol);

    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    // Get stock stats and recommendations
    const [stats, recommendations] = await Promise.all([
      stockService.getStockStats(stock.id, stock.symbol),
      stockService.getStockRecommendations(stock.id, stock.symbol, 50)
    ]);

    res.json({
      ...stock,
      stats,
      recommendations
    });
  } catch (error) {
    logger.error('Get stock failed', { symbol, error: error.message });
    res.status(500).json({ error: 'Failed to get stock' });
  }
});

/**
 * POST /api/stocks/import (Admin only)
 * Bulk import stocks from array
 */
router.post('/import', adminAuth, async (req, res) => {
  const { stocks } = req.body;

  if (!Array.isArray(stocks) || stocks.length === 0) {
    return res.status(400).json({ error: 'Stocks array required' });
  }

  logger.info('Import request', { count: stocks.length, ip: req.ip });

  try {
    const result = await stockService.bulkImportStocks(stocks);
    res.json(result);
  } catch (error) {
    logger.error('Import failed', { error: error.message });
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;
