-- Migration: 004_stock_prices.sql
-- Purpose: Create stock_prices table for daily EOD price tracking
-- Phase: 2a - Price Tracking

-- Stock prices table
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

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_stock_prices_stock ON stock_prices(stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_prices_date ON stock_prices(price_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_prices_stock_date ON stock_prices(stock_id, price_date DESC);

-- Comment on table
COMMENT ON TABLE stock_prices IS 'Daily EOD stock prices fetched from Yahoo Finance';
