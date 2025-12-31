-- Migration: 005_recommendation_outcomes.sql
-- Purpose: Track recommendation outcomes (target hit, stop-loss hit, expired)
-- Phase: 2b - Outcome Detection

-- Recommendation outcomes table
CREATE TABLE IF NOT EXISTS recommendation_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID REFERENCES recommendations(id) ON DELETE CASCADE,
    outcome_type VARCHAR(50) NOT NULL,  -- TARGET_HIT, SL_HIT, EXPIRED
    outcome_date DATE NOT NULL,
    outcome_price DECIMAL(15,2) NOT NULL,
    return_percentage DECIMAL(10,4),
    days_held INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_rec_outcome UNIQUE(recommendation_id)
);

-- Add status column to recommendations
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendation_outcomes_type ON recommendation_outcomes(outcome_type);
CREATE INDEX IF NOT EXISTS idx_recommendation_outcomes_date ON recommendation_outcomes(outcome_date DESC);

-- Comments
COMMENT ON TABLE recommendation_outcomes IS 'Tracks when recommendations hit target/SL or expire';
COMMENT ON COLUMN recommendations.status IS 'ACTIVE = still tracking, CLOSED = outcome determined';
