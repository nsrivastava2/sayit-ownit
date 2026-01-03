-- Performance optimization indexes
-- These composite indexes optimize common query patterns

-- Composite index for filtering recommendations by expert + date (common in expert view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_expert_date
ON recommendations(expert_name, recommendation_date DESC);

-- Composite index for filtering by share + date (common in share view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_share_date
ON recommendations(share_name, recommendation_date DESC);

-- Composite index for flagged recommendations with date (admin review page)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_flagged_date
ON recommendations(is_flagged, recommendation_date DESC)
WHERE is_flagged = true;

-- Composite index for action counts by expert (leaderboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_expert_action
ON recommendations(expert_name, action);

-- Analyze tables to update statistics
ANALYZE recommendations;
ANALYZE experts;
ANALYZE videos;
