# Phase 2a: Price Tracking

## Overview
**Branch:** `phase-2a-prices`
**Goal:** Fetch and store daily stock prices
**Dependencies:** Phase 1 (stocks table exists)
**Estimated Effort:** 1 day

---

## Scope (Small & Focused)

### In Scope
- Create `stock_prices` table
- Fetch EOD prices from Yahoo Finance
- Store prices in database
- Manual trigger endpoint for testing
- Scheduled job (6 PM IST)

### Out of Scope (Phase 2b)
- Outcome detection (target/SL hit)
- Return calculations
- UI changes

---

## Database Changes

### Migration: `004_stock_prices.sql`
```sql
CREATE TABLE IF NOT EXISTS stock_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id UUID REFERENCES stocks(id) ON DELETE CASCADE,
    price_date DATE NOT NULL,
    open_price DECIMAL(15,2),
    high_price DECIMAL(15,2),
    low_price DECIMAL(15,2),
    close_price DECIMAL(15,2),
    volume BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_stock_date UNIQUE(stock_id, price_date)
);

CREATE INDEX idx_stock_prices_stock ON stock_prices(stock_id);
CREATE INDEX idx_stock_prices_date ON stock_prices(price_date);
```

---

## Backend Implementation

### New Files
1. `backend/src/services/priceService.js` - Yahoo Finance API integration
2. `backend/src/jobs/priceUpdateJob.js` - Scheduled job

### API Endpoints
```
GET  /api/prices/:stockId/latest        # Get latest price
GET  /api/prices/:stockId/history       # Get price history
POST /api/admin/prices/fetch-all        # Manual trigger (admin)
```

---

## Test Cases

### Unit Tests
```javascript
describe('PriceService', () => {
  it('should fetch price from Yahoo Finance');
  it('should handle API errors gracefully');
  it('should save price to database');
  it('should get latest price for stock');
});
```

### E2E Tests
```javascript
test('admin can trigger price fetch');
test('latest price displayed on stock page');
```

---

## Logging
```
[PRICE:INFO] Fetching price {"symbol":"RELIANCE.NS"}
[PRICE:INFO] Price saved {"stockId":"...","date":"2024-01-15"}
[PRICE:ERROR] Fetch failed {"symbol":"...","error":"..."}
```

---

## Acceptance Criteria
- [ ] stock_prices table created
- [ ] Price fetching works for any NSE stock
- [ ] Manual trigger works (admin only)
- [ ] Prices stored correctly
- [ ] Errors logged properly
- [ ] Site still fully functional

---

## Commands

```bash
# Create branch
git checkout main && git pull
git checkout -b phase-2a-prices

# Install dependency
npm install yahoo-finance2

# Run migration
psql -p 5433 -U sayitownit -d sayitownit -f database/migrations/004_stock_prices.sql

# Test
npm test -- --grep "PriceService"

# Merge when complete
git push origin phase-2a-prices
gh pr create --base main
```
