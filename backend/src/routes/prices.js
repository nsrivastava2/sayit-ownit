import express from 'express';
import priceService from '../services/priceService.js';
import outcomeService from '../services/outcomeService.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

/**
 * GET /api/prices/:stockId/latest
 * Get latest price for a stock
 */
router.get('/:stockId/latest', async (req, res) => {
  try {
    const { stockId } = req.params;
    const price = await priceService.getLatestPrice(stockId);

    if (!price) {
      return res.status(404).json({ error: 'No price data found' });
    }

    res.json({ price });
  } catch (error) {
    console.error('Error fetching latest price:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prices/:stockId/history
 * Get price history for a stock
 */
router.get('/:stockId/history', async (req, res) => {
  try {
    const { stockId } = req.params;
    const { limit = 30 } = req.query;

    const prices = await priceService.getPriceHistory(stockId, parseInt(limit));

    res.json({
      prices,
      count: prices.length
    });
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prices/summary
 * Get price data summary
 */
router.get('/summary', async (req, res) => {
  try {
    const summary = await priceService.getPriceSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching price summary:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prices/fetch/:stockId
 * Fetch and save latest price for a specific stock (admin only)
 */
router.post('/fetch/:stockId', adminAuth, async (req, res) => {
  try {
    const { stockId } = req.params;
    const result = await priceService.updateStockPrice(stockId);

    if (!result) {
      return res.status(404).json({ error: 'Could not fetch price' });
    }

    res.json({
      success: true,
      message: 'Price fetched and saved',
      priceId: result.id
    });
  } catch (error) {
    console.error('Error fetching stock price:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prices/fetch-all
 * Fetch prices for all stocks with active recommendations (admin only)
 */
router.post('/fetch-all', adminAuth, async (req, res) => {
  try {
    const result = await priceService.fetchAllRecommendedStockPrices();

    res.json({
      success: true,
      message: 'Bulk price fetch completed',
      ...result
    });
  } catch (error) {
    console.error('Error in bulk price fetch:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prices/fetch-top
 * Fetch prices for top stocks by recommendation count (admin only)
 */
router.post('/fetch-top', adminAuth, async (req, res) => {
  try {
    const { limit = 50 } = req.body;
    const result = await priceService.fetchTopStockPrices(parseInt(limit));

    res.json({
      success: true,
      message: 'Top stocks price fetch completed',
      ...result
    });
  } catch (error) {
    console.error('Error fetching top stock prices:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prices/detect-outcomes
 * Run outcome detection for all active recommendations (admin only)
 */
router.post('/detect-outcomes', adminAuth, async (req, res) => {
  try {
    const result = await outcomeService.processAllActiveRecommendations();

    res.json({
      success: true,
      message: 'Outcome detection completed',
      ...result
    });
  } catch (error) {
    console.error('Error detecting outcomes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prices/outcomes/stats
 * Get outcome statistics
 */
router.get('/outcomes/stats', async (req, res) => {
  try {
    const stats = await outcomeService.getOutcomeStats();
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching outcome stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prices/outcomes/recent
 * Get recent outcomes
 */
router.get('/outcomes/recent', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const outcomes = await outcomeService.getRecentOutcomes(parseInt(limit));
    res.json({ outcomes });
  } catch (error) {
    console.error('Error fetching recent outcomes:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
