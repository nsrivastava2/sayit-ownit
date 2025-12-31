/**
 * Price Service
 * Fetches and manages stock prices from Yahoo Finance
 */

import yahooFinance from 'yahoo-finance2';
import { db } from '../config/index.js';

const logger = {
  info: (msg, data) => console.log(`[PRICE:INFO] ${msg}`, JSON.stringify(data || {})),
  warn: (msg, data) => console.warn(`[PRICE:WARN] ${msg}`, JSON.stringify(data || {})),
  error: (msg, data) => console.error(`[PRICE:ERROR] ${msg}`, JSON.stringify(data || {}))
};

// Yahoo Finance symbol suffix for NSE stocks
const NSE_SUFFIX = '.NS';
const BSE_SUFFIX = '.BO';

export const priceService = {
  /**
   * Get Yahoo Finance symbol for a stock
   */
  getYahooSymbol(symbol, exchange = 'NSE') {
    const suffix = exchange === 'BSE' ? BSE_SUFFIX : NSE_SUFFIX;
    return `${symbol}${suffix}`;
  },

  /**
   * Fetch current/latest price for a stock from Yahoo Finance
   */
  async fetchPrice(symbol, exchange = 'NSE') {
    const yahooSymbol = this.getYahooSymbol(symbol, exchange);
    logger.info('Fetching price', { symbol, yahooSymbol });

    try {
      const quote = await yahooFinance.quote(yahooSymbol);

      if (!quote || !quote.regularMarketPrice) {
        logger.warn('No price data', { symbol, yahooSymbol });
        return null;
      }

      return {
        symbol,
        exchange,
        // regularMarketTime is already a Date object in yahoo-finance2 v2
        date: quote.regularMarketTime instanceof Date
          ? quote.regularMarketTime
          : new Date(quote.regularMarketTime * 1000),
        open: quote.regularMarketOpen,
        high: quote.regularMarketDayHigh,
        low: quote.regularMarketDayLow,
        close: quote.regularMarketPrice,
        previousClose: quote.regularMarketPreviousClose,
        volume: quote.regularMarketVolume,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent
      };
    } catch (error) {
      logger.error('Fetch failed', { symbol, yahooSymbol, error: error.message });
      return null;
    }
  },

  /**
   * Fetch historical prices for a stock
   */
  async fetchHistoricalPrices(symbol, exchange = 'NSE', period = '1mo') {
    const yahooSymbol = this.getYahooSymbol(symbol, exchange);
    logger.info('Fetching historical prices', { symbol, yahooSymbol, period });

    try {
      const result = await yahooFinance.historical(yahooSymbol, {
        period1: this.getPeriodStartDate(period),
        period2: new Date()
      });

      return result.map(day => ({
        date: day.date,
        open: day.open,
        high: day.high,
        low: day.low,
        close: day.close,
        volume: day.volume
      }));
    } catch (error) {
      logger.error('Historical fetch failed', { symbol, error: error.message });
      return [];
    }
  },

  /**
   * Get period start date based on period string
   */
  getPeriodStartDate(period) {
    const now = new Date();
    switch (period) {
      case '1w': return new Date(now.setDate(now.getDate() - 7));
      case '1mo': return new Date(now.setMonth(now.getMonth() - 1));
      case '3mo': return new Date(now.setMonth(now.getMonth() - 3));
      case '6mo': return new Date(now.setMonth(now.getMonth() - 6));
      case '1y': return new Date(now.setFullYear(now.getFullYear() - 1));
      default: return new Date(now.setMonth(now.getMonth() - 1));
    }
  },

  /**
   * Save price to database
   */
  async savePrice(stockId, priceData) {
    const { date, open, high, low, close, volume } = priceData;
    const priceDate = new Date(date).toISOString().split('T')[0];

    try {
      const result = await db.query(`
        INSERT INTO stock_prices (stock_id, price_date, open_price, high_price, low_price, close_price, volume)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (stock_id, price_date) DO UPDATE SET
          open_price = EXCLUDED.open_price,
          high_price = EXCLUDED.high_price,
          low_price = EXCLUDED.low_price,
          close_price = EXCLUDED.close_price,
          volume = EXCLUDED.volume
        RETURNING id, (xmax = 0) AS inserted
      `, [stockId, priceDate, open, high, low, close, volume]);

      logger.info('Price saved', { stockId, date: priceDate, inserted: result.rows[0]?.inserted });
      return result.rows[0];
    } catch (error) {
      logger.error('Save failed', { stockId, date: priceDate, error: error.message });
      throw error;
    }
  },

  /**
   * Get latest price for a stock from database
   */
  async getLatestPrice(stockId) {
    const result = await db.query(`
      SELECT sp.*, s.symbol, s.exchange
      FROM stock_prices sp
      JOIN stocks s ON s.id = sp.stock_id
      WHERE sp.stock_id = $1
      ORDER BY sp.price_date DESC
      LIMIT 1
    `, [stockId]);

    return result.rows[0] || null;
  },

  /**
   * Get price history for a stock from database
   */
  async getPriceHistory(stockId, limit = 30) {
    const result = await db.query(`
      SELECT * FROM stock_prices
      WHERE stock_id = $1
      ORDER BY price_date DESC
      LIMIT $2
    `, [stockId, limit]);

    return result.rows;
  },

  /**
   * Get price on a specific date (or closest date before)
   */
  async getPriceOnDate(stockId, date) {
    const result = await db.query(`
      SELECT * FROM stock_prices
      WHERE stock_id = $1 AND price_date <= $2
      ORDER BY price_date DESC
      LIMIT 1
    `, [stockId, date]);

    return result.rows[0] || null;
  },

  /**
   * Fetch and save price for a stock by ID
   */
  async updateStockPrice(stockId) {
    // Get stock details
    const stockResult = await db.query('SELECT symbol, exchange FROM stocks WHERE id = $1', [stockId]);
    const stock = stockResult.rows[0];

    if (!stock) {
      logger.error('Stock not found', { stockId });
      return null;
    }

    // Fetch price from Yahoo
    const priceData = await this.fetchPrice(stock.symbol, stock.exchange);
    if (!priceData) {
      return null;
    }

    // Save to database
    return this.savePrice(stockId, priceData);
  },

  /**
   * Fetch prices for all stocks with recommendations
   * This is the main job that runs daily
   */
  async fetchAllRecommendedStockPrices() {
    logger.info('Starting bulk price fetch for recommended stocks');

    // Get unique stock IDs from active recommendations
    const stocksResult = await db.query(`
      SELECT DISTINCT s.id, s.symbol, s.exchange
      FROM stocks s
      INNER JOIN recommendations r ON r.stock_id = s.id
      WHERE r.status = 'ACTIVE'
      ORDER BY s.symbol
    `);

    const stocks = stocksResult.rows;
    logger.info('Stocks to fetch', { count: stocks.length });

    let success = 0;
    let failed = 0;
    const errors = [];

    for (const stock of stocks) {
      try {
        const priceData = await this.fetchPrice(stock.symbol, stock.exchange);

        if (priceData) {
          await this.savePrice(stock.id, priceData);
          success++;
        } else {
          failed++;
          errors.push({ symbol: stock.symbol, error: 'No price data' });
        }

        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        failed++;
        errors.push({ symbol: stock.symbol, error: error.message });
      }
    }

    const result = { total: stocks.length, success, failed, errors: errors.slice(0, 10) };
    logger.info('Bulk price fetch complete', result);
    return result;
  },

  /**
   * Fetch prices for top stocks (by recommendation count)
   * Useful for initial data population
   */
  async fetchTopStockPrices(limit = 50) {
    logger.info('Fetching prices for top stocks', { limit });

    const stocksResult = await db.query(`
      SELECT s.id, s.symbol, s.exchange, COUNT(r.id) as rec_count
      FROM stocks s
      INNER JOIN recommendations r ON r.stock_id = s.id
      GROUP BY s.id, s.symbol, s.exchange
      ORDER BY rec_count DESC
      LIMIT $1
    `, [limit]);

    const stocks = stocksResult.rows;
    let success = 0;
    let failed = 0;

    for (const stock of stocks) {
      try {
        const priceData = await this.fetchPrice(stock.symbol, stock.exchange);
        if (priceData) {
          await this.savePrice(stock.id, priceData);
          success++;
        } else {
          failed++;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        failed++;
        logger.error('Price fetch error', { symbol: stock.symbol, error: error.message });
      }
    }

    return { total: stocks.length, success, failed };
  },

  /**
   * Get price summary for dashboard
   */
  async getPriceSummary() {
    const result = await db.query(`
      SELECT
        COUNT(DISTINCT stock_id) as stocks_with_prices,
        COUNT(*) as total_price_records,
        MAX(price_date) as latest_price_date,
        MIN(price_date) as earliest_price_date
      FROM stock_prices
    `);

    return result.rows[0];
  }
};

export default priceService;
