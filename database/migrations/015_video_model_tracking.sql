-- Migration 015: Add model tracking to videos table
-- Tracks which Gemini model was used for analysis

-- Add model_used column to videos table
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS model_used VARCHAR(50) DEFAULT NULL;

-- Add index for filtering by model
CREATE INDEX IF NOT EXISTS idx_videos_model_used ON videos(model_used);

-- Add comment
COMMENT ON COLUMN videos.model_used IS 'Gemini model used for analysis: gemini-2.0-flash-lite, gemini-2.0-flash, gemini-2.5-flash';
