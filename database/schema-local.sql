-- Stock Market TV Recommendation Tracker - Local PostgreSQL Schema

-- Videos table to track processed videos
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_url TEXT NOT NULL UNIQUE,
  title TEXT,
  channel_name TEXT,
  video_type TEXT CHECK (video_type IN ('live', 'recorded')),
  duration_seconds INTEGER,
  language TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transcripts table
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  chunk_index INTEGER,
  start_time_seconds FLOAT,
  end_time_seconds FLOAT,
  transcript_text TEXT,
  language_detected TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recommendations table - main output
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  expert_name TEXT NOT NULL,
  recommendation_date DATE NOT NULL,
  share_name TEXT NOT NULL,
  nse_symbol TEXT,
  action TEXT CHECK (action IN ('BUY', 'SELL', 'HOLD')),
  recommended_price DECIMAL(10,2),
  target_price DECIMAL(10,2),
  stop_loss DECIMAL(10,2),
  reason TEXT,
  confidence_score DECIMAL(3,2),
  timestamp_in_video TEXT,
  raw_extract TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
CREATE INDEX IF NOT EXISTS idx_transcripts_video_id ON transcripts(video_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_expert ON recommendations(expert_name);
CREATE INDEX IF NOT EXISTS idx_recommendations_share ON recommendations(share_name);
CREATE INDEX IF NOT EXISTS idx_recommendations_nse_symbol ON recommendations(nse_symbol);
CREATE INDEX IF NOT EXISTS idx_recommendations_date ON recommendations(recommendation_date);
CREATE INDEX IF NOT EXISTS idx_recommendations_action ON recommendations(action);
CREATE INDEX IF NOT EXISTS idx_recommendations_video_id ON recommendations(video_id);
