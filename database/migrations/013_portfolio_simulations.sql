-- Migration: Portfolio Simulations
-- Phase 6: "What if I followed Expert X with ₹1 lakh?"

-- Portfolio Simulations Table
-- Stores the configuration and results of each simulation run
CREATE TABLE IF NOT EXISTS portfolio_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who ran this simulation (NULL = anonymous/demo)
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Which expert was simulated
    expert_id UUID NOT NULL REFERENCES experts(id) ON DELETE CASCADE,

    -- Simulation parameters
    initial_capital DECIMAL(15,2) NOT NULL DEFAULT 100000,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    position_sizing_method VARCHAR(50) DEFAULT 'EQUAL_WEIGHT',  -- EQUAL_WEIGHT, FIXED_AMOUNT, PERCENTAGE
    position_size_value DECIMAL(15,2) DEFAULT 10000,  -- Amount per trade or percentage
    max_concurrent_positions INT DEFAULT 10,

    -- Results summary
    final_value DECIMAL(15,2),
    total_return_pct DECIMAL(10,4),
    xirr DECIMAL(10,4),  -- Annualized return accounting for cash flow timing

    -- Trade statistics
    total_trades INT DEFAULT 0,
    winning_trades INT DEFAULT 0,
    losing_trades INT DEFAULT 0,
    active_trades INT DEFAULT 0,
    win_rate DECIMAL(5,2),
    avg_return_per_trade DECIMAL(10,4),
    max_drawdown DECIMAL(10,4),

    -- Detailed trade log stored as JSONB
    -- Format: [{ rec_id, symbol, action, entry_date, entry_price, exit_date, exit_price, return_pct, outcome }]
    trade_log JSONB DEFAULT '[]',

    -- Cash flow history for XIRR calculation
    -- Format: [{ date, amount, type: 'INITIAL'|'BUY'|'SELL'|'FINAL' }]
    cash_flows JSONB DEFAULT '[]',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_date_range CHECK (end_date >= start_date),
    CONSTRAINT valid_capital CHECK (initial_capital > 0),
    CONSTRAINT valid_position_sizing CHECK (position_sizing_method IN ('EQUAL_WEIGHT', 'FIXED_AMOUNT', 'PERCENTAGE'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_simulations_user ON portfolio_simulations(user_id);
CREATE INDEX IF NOT EXISTS idx_simulations_expert ON portfolio_simulations(expert_id);
CREATE INDEX IF NOT EXISTS idx_simulations_created ON portfolio_simulations(created_at DESC);

-- View for simulation summaries with expert names
CREATE OR REPLACE VIEW simulation_summaries AS
SELECT
    ps.id,
    ps.user_id,
    ps.expert_id,
    e.canonical_name AS expert_name,
    ps.initial_capital,
    ps.start_date,
    ps.end_date,
    ps.final_value,
    ps.total_return_pct,
    ps.xirr,
    ps.total_trades,
    ps.win_rate,
    ps.created_at
FROM portfolio_simulations ps
JOIN experts e ON ps.expert_id = e.id;
