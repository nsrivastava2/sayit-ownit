-- Migration: 006_expert_metrics.sql
-- Purpose: Create expert_metrics table for tracking performance and rankings
-- Dependencies: 001_expert_management.sql (experts table)

-- Expert Metrics table - stores daily performance snapshots
CREATE TABLE IF NOT EXISTS expert_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id UUID REFERENCES experts(id) ON DELETE CASCADE,
    calculation_date DATE NOT NULL,

    -- Recommendation counts
    total_recommendations INT DEFAULT 0,
    active_recommendations INT DEFAULT 0,
    closed_recommendations INT DEFAULT 0,
    target_hit_count INT DEFAULT 0,
    sl_hit_count INT DEFAULT 0,
    expired_count INT DEFAULT 0,

    -- Performance rates (stored as percentage, e.g., 75.50 for 75.5%)
    overall_win_rate DECIMAL(5,2),      -- Target hits / Closed recommendations
    last_30d_win_rate DECIMAL(5,2),     -- Win rate for last 30 days
    last_90d_win_rate DECIMAL(5,2),     -- Win rate for last 90 days

    -- Return metrics
    avg_return_pct DECIMAL(10,4),       -- Average return across all closed recommendations
    avg_winning_return_pct DECIMAL(10,4), -- Avg return on winning trades
    avg_losing_return_pct DECIMAL(10,4),  -- Avg return on losing trades (negative)
    total_return_pct DECIMAL(10,4),     -- Sum of all returns

    -- Timing metrics
    avg_holding_days DECIMAL(10,2),     -- Average days held before outcome

    -- Ranking
    ranking_score DECIMAL(10,4),        -- Composite score for ranking
    rank_position INT,                  -- Current rank (1 = best)

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(expert_id, calculation_date)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_expert_metrics_expert_date
    ON expert_metrics(expert_id, calculation_date DESC);

CREATE INDEX IF NOT EXISTS idx_expert_metrics_rank
    ON expert_metrics(calculation_date, rank_position);

-- Function to get latest metrics for an expert
CREATE OR REPLACE FUNCTION get_latest_expert_metrics(p_expert_id UUID)
RETURNS TABLE (
    total_recommendations INT,
    win_rate DECIMAL(5,2),
    avg_return DECIMAL(10,4),
    rank_position INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        em.total_recommendations,
        em.overall_win_rate,
        em.avg_return_pct,
        em.rank_position
    FROM expert_metrics em
    WHERE em.expert_id = p_expert_id
    ORDER BY em.calculation_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- View for current expert rankings (latest date only)
CREATE OR REPLACE VIEW expert_rankings AS
SELECT
    e.id as expert_id,
    e.canonical_name as expert_name,
    em.total_recommendations,
    em.closed_recommendations,
    em.target_hit_count,
    em.sl_hit_count,
    em.overall_win_rate,
    em.avg_return_pct,
    em.ranking_score,
    em.rank_position,
    em.calculation_date
FROM experts e
LEFT JOIN expert_metrics em ON e.id = em.expert_id
WHERE em.calculation_date = (
    SELECT MAX(calculation_date) FROM expert_metrics
)
ORDER BY em.rank_position NULLS LAST;

COMMENT ON TABLE expert_metrics IS 'Daily snapshots of expert performance metrics for ranking and analytics';
