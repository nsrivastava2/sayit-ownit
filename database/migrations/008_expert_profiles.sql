-- Expert Profile Enhancement Migration
-- Adds profile columns to store enriched expert information from web research

-- Add profile columns to experts table
ALTER TABLE experts ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS twitter_handle TEXT;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS youtube_channel TEXT;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS experience_summary TEXT;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS current_associations TEXT[];  -- e.g., ['Zee Business', 'CNBC Awaaz']
ALTER TABLE experts ADD COLUMN IF NOT EXISTS education TEXT;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS certifications TEXT[];  -- e.g., ['CFA', 'SEBI RIA']
ALTER TABLE experts ADD COLUMN IF NOT EXISTS warnings TEXT[];  -- Any flags/warnings about the expert
ALTER TABLE experts ADD COLUMN IF NOT EXISTS profile_enriched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS profile_source TEXT;  -- 'gemini', 'manual', etc.

-- Add research data to pending_experts for admin review before approval
ALTER TABLE pending_experts ADD COLUMN IF NOT EXISTS research_summary TEXT;
ALTER TABLE pending_experts ADD COLUMN IF NOT EXISTS research_data JSONB;
ALTER TABLE pending_experts ADD COLUMN IF NOT EXISTS research_completed_at TIMESTAMP WITH TIME ZONE;

-- Create index for experts with enriched profiles
CREATE INDEX IF NOT EXISTS idx_experts_profile_enriched ON experts(profile_enriched_at) WHERE profile_enriched_at IS NOT NULL;

COMMENT ON COLUMN experts.profile_picture_url IS 'URL to expert profile picture from web search';
COMMENT ON COLUMN experts.warnings IS 'Array of warning flags about the expert (e.g., regulatory issues, controversies)';
COMMENT ON COLUMN pending_experts.research_data IS 'JSON object containing full research data from Gemini';
