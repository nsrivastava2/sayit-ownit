-- Expert Enrichment Sources Migration
-- Adds columns to store enrichment sources and raw data for transparency

-- Add enrichment_sources to store list of URLs/references used
ALTER TABLE experts ADD COLUMN IF NOT EXISTS enrichment_sources TEXT[];

-- Add enrichment_raw_data to store full JSON response from Gemini for reference
ALTER TABLE experts ADD COLUMN IF NOT EXISTS enrichment_raw_data JSONB;

COMMENT ON COLUMN experts.enrichment_sources IS 'Array of source URLs/references used to gather enrichment data';
COMMENT ON COLUMN experts.enrichment_raw_data IS 'Full JSON response from Gemini for reference and debugging';
