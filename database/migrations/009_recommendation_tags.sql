-- Add tags column to recommendations for segment/show categorization
-- Examples: '10 ki kamai', 'Jain Sahab ke Gems', 'Diwali Pick', 'New Year Pick'

ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Create GIN index for efficient array searches
CREATE INDEX IF NOT EXISTS idx_recommendations_tags ON recommendations USING GIN (tags);

-- Add comment for documentation
COMMENT ON COLUMN recommendations.tags IS 'Array of tags identifying show segment, occasion, or category (e.g., 10 ki kamai, Diwali Pick)';
