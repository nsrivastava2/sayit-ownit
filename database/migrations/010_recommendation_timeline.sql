-- Migration: Add timeline/investment horizon to recommendations
-- Timeline indicates the expected holding period for the recommendation

-- Add timeline column
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS timeline VARCHAR(50);

-- Common timeline values:
-- INTRADAY - Same day trade (exit before market close)
-- BTST - Buy Today Sell Tomorrow
-- SHORT_TERM - Few days to 2 weeks
-- POSITIONAL - 2 weeks to 2 months
-- MEDIUM_TERM - 2-6 months
-- LONG_TERM - 6+ months / Investment pick

-- Add index for filtering by timeline
CREATE INDEX IF NOT EXISTS idx_recommendations_timeline ON recommendations(timeline);

-- Add comment
COMMENT ON COLUMN recommendations.timeline IS 'Investment horizon: INTRADAY, BTST, SHORT_TERM, POSITIONAL, MEDIUM_TERM, LONG_TERM';
