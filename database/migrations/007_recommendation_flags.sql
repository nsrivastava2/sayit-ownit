-- Migration: 007_recommendation_flags.sql
-- Purpose: Add flagging system for recommendation validation and moderation
-- Flags recommendations with illogical data (e.g., SL > entry for BUY) or missing critical info

-- Add flag columns to recommendations table
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS flag_reasons TEXT[]; -- Array of reasons
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;

-- Index for quick lookup of flagged recommendations
CREATE INDEX IF NOT EXISTS idx_recommendations_flagged ON recommendations(is_flagged) WHERE is_flagged = TRUE;

-- Create a table to track flag history (for audit purposes)
CREATE TABLE IF NOT EXISTS recommendation_flag_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID REFERENCES recommendations(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'FLAGGED', 'APPROVED', 'EDITED'
    previous_values JSONB, -- Store old values before edit
    new_values JSONB, -- Store new values after edit
    flag_reasons TEXT[],
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flag_history_rec ON recommendation_flag_history(recommendation_id);

-- View for easily querying flagged recommendations with details
CREATE OR REPLACE VIEW flagged_recommendations AS
SELECT
    r.id,
    r.recommendation_date,
    r.expert_name,
    r.share_name,
    r.nse_symbol,
    r.action,
    r.recommended_price,
    r.target_price,
    r.stop_loss,
    r.flag_reasons,
    r.reviewed_at,
    r.reviewer_notes,
    r.created_at,
    v.title as video_title,
    v.youtube_url
FROM recommendations r
LEFT JOIN videos v ON r.video_id = v.id
WHERE r.is_flagged = TRUE
ORDER BY r.created_at DESC;

COMMENT ON COLUMN recommendations.is_flagged IS 'True if recommendation has validation issues needing review';
COMMENT ON COLUMN recommendations.flag_reasons IS 'Array of reason codes: ILLOGICAL_SL, MISSING_ENTRY, MISSING_TARGET, MISSING_SL, HIGH_RISK_RATIO';
