# Phase 1: Stock Master Data

## Overview
**Goal:** Replace free-text share_name with proper stock references
**Priority:** High
**Dependencies:** Phase 0 completed
**Estimated Effort:** 2-3 days

---

## Requirements

### R1.1 Stocks Database
- Import all NSE-listed stocks (~2000)
- Include sector/industry classification
- Include market cap category (Large/Mid/Small)
- Store ISIN for unique identification

### R1.2 Link Recommendations to Stocks
- Add `stock_id` foreign key to recommendations
- Backfill existing recommendations
- Keep `nse_symbol` for backwards compatibility

### R1.3 Stock Detail Pages
- Enhanced stock pages with company info
- Sector information displayed
- Market cap badge

---

## Database Changes

### Migration: `003_stocks_table.sql`
```sql
-- Stocks master table
CREATE TABLE IF NOT EXISTS stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(10) DEFAULT 'NSE',
    company_name VARCHAR(255) NOT NULL,
    isin VARCHAR(20),

    -- Classification
    sector VARCHAR(100),
    industry VARCHAR(100),
    market_cap_category VARCHAR(50),  -- LARGE_CAP, MID_CAP, SMALL_CAP

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_stock_exchange UNIQUE(symbol, exchange)
);

-- Indexes
CREATE INDEX idx_stocks_symbol ON stocks(symbol);
CREATE INDEX idx_stocks_sector ON stocks(sector);
CREATE INDEX idx_stocks_market_cap ON stocks(market_cap_category);
CREATE INDEX idx_stocks_company_name ON stocks USING gin(to_tsvector('english', company_name));

-- Add stock_id to recommendations
ALTER TABLE recommendations ADD COLUMN stock_id UUID REFERENCES stocks(id);
CREATE INDEX idx_recommendations_stock_id ON recommendations(stock_id);

-- Audit log for tracking changes
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    action VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    performed_by VARCHAR(100),
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
```

---

## Backend Implementation

### New Service: `backend/src/services/stockService.js`
```javascript
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
        SELECT id, symbol, exchange, company_name, sector, market_cap_category
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
    logger.info('Getting stock', { symbol, exchange });

    const result = await db.query(`
      SELECT * FROM stocks
      WHERE symbol = $1 AND exchange = $2 AND is_active = true
    `, [symbol.toUpperCase(), exchange]);

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
   * Resolve stock from recommendation data
   * Attempts to match nse_symbol or share_name to stocks table
   */
  async resolveStock(nseSymbol, shareName) {
    logger.info('Resolving stock', { nseSymbol, shareName });

    // Try nse_symbol first
    if (nseSymbol) {
      const stock = await this.getStockBySymbol(nseSymbol);
      if (stock) {
        logger.info('Resolved by symbol', { nseSymbol, stockId: stock.id });
        return stock;
      }
    }

    // Try fuzzy match on company name
    if (shareName) {
      const result = await db.query(`
        SELECT * FROM stocks
        WHERE is_active = true
          AND (
            company_name ILIKE $1
            OR symbol ILIKE $2
          )
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
   * Bulk import stocks from CSV data
   */
  async bulkImportStocks(stocks) {
    logger.info('Bulk importing stocks', { count: stocks.length });

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const stock of stocks) {
      try {
        await db.query(`
          INSERT INTO stocks (symbol, exchange, company_name, isin, sector, industry, market_cap_category)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (symbol, exchange) DO UPDATE SET
            company_name = EXCLUDED.company_name,
            isin = EXCLUDED.isin,
            sector = EXCLUDED.sector,
            industry = EXCLUDED.industry,
            market_cap_category = EXCLUDED.market_cap_category,
            updated_at = NOW()
        `, [
          stock.symbol,
          stock.exchange || 'NSE',
          stock.company_name,
          stock.isin,
          stock.sector,
          stock.industry,
          stock.market_cap_category
        ]);
        imported++;
      } catch (error) {
        logger.error('Import failed for stock', {
          symbol: stock.symbol,
          error: error.message
        });
        errors++;
      }
    }

    logger.info('Bulk import complete', { imported, skipped, errors });
    return { imported, skipped, errors };
  },

  /**
   * Get stocks by sector
   */
  async getStocksBySector(sector) {
    const result = await db.query(`
      SELECT * FROM stocks
      WHERE sector = $1 AND is_active = true
      ORDER BY symbol
    `, [sector]);
    return result.rows;
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
   * Get stock statistics
   */
  async getStockStats(stockId) {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_recommendations,
        COUNT(CASE WHEN action = 'BUY' THEN 1 END) as buy_count,
        COUNT(CASE WHEN action = 'SELL' THEN 1 END) as sell_count,
        COUNT(DISTINCT expert_name) as unique_experts,
        AVG(target_price) as avg_target,
        AVG(stop_loss) as avg_stop_loss
      FROM recommendations
      WHERE stock_id = $1 OR nse_symbol = (SELECT symbol FROM stocks WHERE id = $1)
    `, [stockId]);

    return result.rows[0];
  }
};

export default stockService;
```

### New Route: `backend/src/routes/stocks.js`
```javascript
/**
 * Stocks API Routes
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

  if (!q || q.length < 2) {
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
 * GET /api/stocks/:symbol
 * Get stock by symbol
 */
router.get('/:symbol', async (req, res) => {
  const { symbol } = req.params;

  try {
    const stock = await stockService.getStockBySymbol(symbol);

    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    // Get stock stats
    const stats = await stockService.getStockStats(stock.id);

    res.json({
      ...stock,
      stats
    });
  } catch (error) {
    logger.error('Get stock failed', { symbol, error: error.message });
    res.status(500).json({ error: 'Failed to get stock' });
  }
});

/**
 * POST /api/stocks/import (Admin only)
 * Bulk import stocks from CSV
 */
router.post('/import', adminAuth, async (req, res) => {
  const { stocks } = req.body;

  if (!Array.isArray(stocks) || stocks.length === 0) {
    return res.status(400).json({ error: 'Stocks array required' });
  }

  try {
    const result = await stockService.bulkImportStocks(stocks);
    res.json(result);
  } catch (error) {
    logger.error('Import failed', { error: error.message });
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;
```

### Backfill Script: `backend/scripts/backfill-stock-ids.js`
```javascript
/**
 * Backfill stock_id for existing recommendations
 */

import { db } from '../src/config/index.js';
import stockService from '../src/services/stockService.js';

async function backfillStockIds() {
  console.log('Starting stock_id backfill...');

  // Get recommendations without stock_id
  const result = await db.query(`
    SELECT id, nse_symbol, share_name
    FROM recommendations
    WHERE stock_id IS NULL
  `);

  console.log(`Found ${result.rows.length} recommendations to backfill`);

  let updated = 0;
  let notFound = 0;

  for (const rec of result.rows) {
    const stock = await stockService.resolveStock(rec.nse_symbol, rec.share_name);

    if (stock) {
      await db.query(
        'UPDATE recommendations SET stock_id = $1 WHERE id = $2',
        [stock.id, rec.id]
      );
      updated++;
    } else {
      notFound++;
      console.log(`Could not resolve: ${rec.nse_symbol || rec.share_name}`);
    }
  }

  console.log(`Backfill complete: ${updated} updated, ${notFound} not found`);
}

backfillStockIds().catch(console.error);
```

---

## Data Import

### NSE Stock Data Source
Download from: https://www.nseindia.com/market-data/securities-available-for-trading

### Import Script: `backend/scripts/import-nse-stocks.js`
```javascript
/**
 * Import NSE stocks from CSV
 *
 * CSV format expected:
 * SYMBOL,NAME OF COMPANY,SERIES,ISIN,SECTOR,INDUSTRY
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import stockService from '../src/services/stockService.js';

async function importNSEStocks(csvPath) {
  console.log(`Reading ${csvPath}...`);

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`Parsed ${records.length} records`);

  const stocks = records.map(record => ({
    symbol: record.SYMBOL?.trim(),
    exchange: 'NSE',
    company_name: record['NAME OF COMPANY']?.trim(),
    isin: record.ISIN?.trim(),
    sector: record.SECTOR?.trim() || null,
    industry: record.INDUSTRY?.trim() || null,
    market_cap_category: determineMarketCap(record)
  })).filter(s => s.symbol && s.company_name);

  console.log(`Importing ${stocks.length} valid stocks...`);

  const result = await stockService.bulkImportStocks(stocks);
  console.log('Import result:', result);
}

function determineMarketCap(record) {
  // This could be enhanced with actual market cap data
  // For now, using common large-cap symbols
  const largeCaps = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR'];
  if (largeCaps.includes(record.SYMBOL)) {
    return 'LARGE_CAP';
  }
  return null; // Will be updated later with actual data
}

// Run
const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node import-nse-stocks.js <path-to-csv>');
  process.exit(1);
}

importNSEStocks(csvPath).catch(console.error);
```

---

## Test Cases (TDD)

### Unit Tests: `backend/tests/stocks.test.js`
```javascript
import { describe, it, expect, beforeAll } from 'vitest';
import stockService from '../src/services/stockService.js';

describe('Stock Service', () => {
  beforeAll(async () => {
    // Seed test data
    await stockService.bulkImportStocks([
      { symbol: 'RELIANCE', company_name: 'Reliance Industries Ltd', sector: 'Oil & Gas' },
      { symbol: 'TCS', company_name: 'Tata Consultancy Services Ltd', sector: 'IT' },
      { symbol: 'INFY', company_name: 'Infosys Ltd', sector: 'IT' }
    ]);
  });

  describe('searchStocks', () => {
    it('should find stocks by symbol prefix', async () => {
      const results = await stockService.searchStocks('REL');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].symbol).toBe('RELIANCE');
    });

    it('should find stocks by company name', async () => {
      const results = await stockService.searchStocks('Tata');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.symbol === 'TCS')).toBe(true);
    });

    it('should return empty for no match', async () => {
      const results = await stockService.searchStocks('ZZZZZ');
      expect(results.length).toBe(0);
    });

    it('should respect limit parameter', async () => {
      const results = await stockService.searchStocks('I', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getStockBySymbol', () => {
    it('should return stock for valid symbol', async () => {
      const stock = await stockService.getStockBySymbol('RELIANCE');
      expect(stock).not.toBeNull();
      expect(stock.symbol).toBe('RELIANCE');
    });

    it('should return null for invalid symbol', async () => {
      const stock = await stockService.getStockBySymbol('INVALID123');
      expect(stock).toBeNull();
    });

    it('should be case-insensitive', async () => {
      const stock = await stockService.getStockBySymbol('reliance');
      expect(stock).not.toBeNull();
    });
  });

  describe('resolveStock', () => {
    it('should resolve by nse_symbol', async () => {
      const stock = await stockService.resolveStock('TCS', null);
      expect(stock).not.toBeNull();
      expect(stock.symbol).toBe('TCS');
    });

    it('should resolve by share_name', async () => {
      const stock = await stockService.resolveStock(null, 'Infosys');
      expect(stock).not.toBeNull();
      expect(stock.symbol).toBe('INFY');
    });

    it('should prefer nse_symbol over share_name', async () => {
      const stock = await stockService.resolveStock('TCS', 'Reliance');
      expect(stock.symbol).toBe('TCS');
    });
  });

  describe('getAllSectors', () => {
    it('should return unique sectors', async () => {
      const sectors = await stockService.getAllSectors();
      expect(sectors).toContain('IT');
      expect(sectors).toContain('Oil & Gas');
      expect(new Set(sectors).size).toBe(sectors.length);
    });
  });
});
```

### Playwright E2E Tests: `e2e/stocks.spec.js`
```javascript
import { test, expect } from '@playwright/test';

test.describe('Stock Features', () => {
  test('should search for stocks with autocomplete', async ({ page }) => {
    await page.goto('/');

    // Assuming there's a stock search input somewhere
    const searchInput = page.locator('[data-testid="stock-search"]');
    await searchInput.fill('REL');

    // Autocomplete dropdown should appear
    const dropdown = page.locator('[data-testid="stock-search-results"]');
    await expect(dropdown).toBeVisible();

    // Should contain RELIANCE
    await expect(dropdown).toContainText('RELIANCE');
  });

  test('should display stock detail page', async ({ page }) => {
    await page.goto('/shares/RELIANCE');

    // Should show stock info
    await expect(page.locator('h1')).toContainText('Reliance');

    // Should show sector
    await expect(page.locator('[data-testid="stock-sector"]')).toBeVisible();

    // Should show recommendations count
    await expect(page.locator('[data-testid="total-recommendations"]')).toBeVisible();
  });

  test('should filter recommendations by sector', async ({ page }) => {
    await page.goto('/recommendations');

    // Select IT sector filter
    await page.selectOption('[data-testid="sector-filter"]', 'IT');

    // Wait for filter to apply
    await page.waitForLoadState('networkidle');

    // Results should only show IT stocks
    const results = page.locator('table tbody tr');
    // Verify at least some results exist
    await expect(results.first()).toBeVisible();
  });

  test('should link recommendation to stock detail page', async ({ page }) => {
    await page.goto('/');

    // Click on first stock in recent recommendations
    const stockLink = page.locator('table tbody tr:first-child a[href^="/shares/"]');
    await stockLink.click();

    // Should navigate to stock detail page
    await expect(page).toHaveURL(/\/shares\//);
  });
});
```

---

## Logging Requirements

### Stock Service Logs
```
[STOCK:INFO] Searching stocks {"query":"REL","limit":20}
[STOCK:INFO] Search results {"query":"REL","count":5}
[STOCK:INFO] Resolving stock {"nseSymbol":"TCS","shareName":null}
[STOCK:INFO] Resolved by symbol {"nseSymbol":"TCS","stockId":"uuid"}
[STOCK:WARN] Could not resolve stock {"nseSymbol":null,"shareName":"Unknown Corp"}
[STOCK:INFO] Bulk importing stocks {"count":2000}
[STOCK:ERROR] Import failed for stock {"symbol":"BAD","error":"Constraint violation"}
```

---

## Acceptance Criteria

- [ ] Stocks table created with indexes
- [ ] 2000+ NSE stocks imported
- [ ] Stock search returns results within 100ms
- [ ] All existing recommendations have stock_id backfilled
- [ ] Stock detail pages show sector and stats
- [ ] Filter by sector works on recommendations page
- [ ] Admin can bulk import new stocks
- [ ] All stock operations are logged

---

## Next Phase

After Phase 1 is complete, proceed to **Phase 2: Recommendation Tracking & Outcomes**.
