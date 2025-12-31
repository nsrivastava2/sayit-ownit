-- Migration: 003_stocks_table.sql
-- Description: Create stocks master table and link to recommendations
-- Created: 2025-01-01

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

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_stocks_sector ON stocks(sector);
CREATE INDEX IF NOT EXISTS idx_stocks_market_cap ON stocks(market_cap_category);
CREATE INDEX IF NOT EXISTS idx_stocks_isin ON stocks(isin);

-- Full-text search index on company name
CREATE INDEX IF NOT EXISTS idx_stocks_company_name ON stocks USING gin(to_tsvector('english', company_name));

-- Add stock_id foreign key to recommendations
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS stock_id UUID REFERENCES stocks(id);
CREATE INDEX IF NOT EXISTS idx_recommendations_stock_id ON recommendations(stock_id);

-- Comments for documentation
COMMENT ON TABLE stocks IS 'Master table of NSE/BSE listed stocks';
COMMENT ON COLUMN stocks.symbol IS 'Stock ticker symbol (e.g., RELIANCE, TCS)';
COMMENT ON COLUMN stocks.isin IS 'International Securities Identification Number';
COMMENT ON COLUMN stocks.market_cap_category IS 'LARGE_CAP, MID_CAP, SMALL_CAP, or null';
COMMENT ON COLUMN stocks.stock_id IS 'Foreign key linking recommendation to master stock record';
