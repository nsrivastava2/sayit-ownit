-- Migration: Expert Management & Channel-Specific Prompts
-- Created: 2025-12-31

-- ============================================
-- CHANNELS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,                    -- "Zee Business", "CNBC Awaaz"
  slug TEXT NOT NULL UNIQUE,                    -- "zee-business", "cnbc-awaaz"
  prompt_file TEXT,                             -- "zee-business.md" (null = use default)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- EXPERTS TABLE (Canonical Names)
-- ============================================
CREATE TABLE IF NOT EXISTS experts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL UNIQUE,          -- "Anil Singhvi"
  bio TEXT,                                     -- Optional bio
  specialization TEXT,                          -- "Technical Analysis", "Fundamentals"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- EXPERT ALIASES TABLE (Many-to-One with Experts)
-- ============================================
CREATE TABLE IF NOT EXISTS expert_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id UUID NOT NULL REFERENCES experts(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,                          -- "Anil ji", "Anil", "Anil Singhvi ji"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(alias)                                 -- Each alias can only map to one expert
);

-- ============================================
-- PENDING EXPERTS TABLE (For Review)
-- ============================================
CREATE TABLE IF NOT EXISTS pending_experts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_name TEXT NOT NULL,                       -- The name as extracted
  video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  timestamp_in_video INTEGER,                   -- Seconds where name appeared
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_expert_id UUID REFERENCES experts(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_channels_slug ON channels(slug);
CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name);
CREATE INDEX IF NOT EXISTS idx_experts_canonical_name ON experts(canonical_name);
CREATE INDEX IF NOT EXISTS idx_expert_aliases_alias ON expert_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_expert_aliases_alias_lower ON expert_aliases(LOWER(alias));
CREATE INDEX IF NOT EXISTS idx_expert_aliases_expert_id ON expert_aliases(expert_id);
CREATE INDEX IF NOT EXISTS idx_pending_experts_status ON pending_experts(status);
CREATE INDEX IF NOT EXISTS idx_pending_experts_raw_name ON pending_experts(raw_name);
CREATE INDEX IF NOT EXISTS idx_pending_experts_raw_name_lower ON pending_experts(LOWER(raw_name));

-- ============================================
-- SEED DATA: Common Channels
-- ============================================
INSERT INTO channels (name, slug, prompt_file) VALUES
  ('Zee Business', 'zee-business', 'zee-business.md'),
  ('CNBC Awaaz', 'cnbc-awaaz', 'cnbc-awaaz.md'),
  ('CNBC TV18', 'cnbc-tv18', NULL),
  ('ET Now', 'et-now', NULL),
  ('NDTV Profit', 'ndtv-profit', NULL)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- SEED DATA: Known Experts
-- ============================================
INSERT INTO experts (canonical_name, specialization) VALUES
  ('Anil Singhvi', 'Market Overview'),
  ('Prakash Gaba', 'Technical Analysis'),
  ('Sanjiv Bhasin', 'Technical Analysis'),
  ('Ashwani Gujral', 'Technical Analysis'),
  ('Ashish Chaturmohta', 'Technical Analysis'),
  ('Sudarshan Sukhani', 'Technical Analysis'),
  ('Mitesh Thakkar', 'Technical Analysis'),
  ('Vijay Chopra', 'Fundamentals'),
  ('Rajat Bose', 'Technical Analysis'),
  ('Sandeep Jain', 'Fundamentals'),
  ('Vikas Sethi', 'Technical Analysis'),
  ('Gaurav Bissa', 'Technical Analysis'),
  ('Ruchit Jain', 'Technical Analysis'),
  ('Shrikant Chouhan', 'Technical Analysis'),
  ('Kunal Bothra', 'Technical Analysis')
ON CONFLICT (canonical_name) DO NOTHING;

-- ============================================
-- SEED DATA: Common Aliases
-- ============================================
DO $$
DECLARE
  expert_record RECORD;
BEGIN
  -- Anil Singhvi aliases
  SELECT id INTO expert_record FROM experts WHERE canonical_name = 'Anil Singhvi';
  IF expert_record.id IS NOT NULL THEN
    INSERT INTO expert_aliases (expert_id, alias) VALUES
      (expert_record.id, 'Anil ji'),
      (expert_record.id, 'Anil'),
      (expert_record.id, 'Anil Singhvi ji'),
      (expert_record.id, 'Singhvi ji'),
      (expert_record.id, 'Singhvi')
    ON CONFLICT (alias) DO NOTHING;
  END IF;

  -- Vikas Sethi aliases
  SELECT id INTO expert_record FROM experts WHERE canonical_name = 'Vikas Sethi';
  IF expert_record.id IS NOT NULL THEN
    INSERT INTO expert_aliases (expert_id, alias) VALUES
      (expert_record.id, 'Sethi Saab'),
      (expert_record.id, 'Sethi Sahab'),
      (expert_record.id, 'Sethi ji'),
      (expert_record.id, 'Sethi'),
      (expert_record.id, 'Vikas ji')
    ON CONFLICT (alias) DO NOTHING;
  END IF;

  -- Prakash Gaba aliases
  SELECT id INTO expert_record FROM experts WHERE canonical_name = 'Prakash Gaba';
  IF expert_record.id IS NOT NULL THEN
    INSERT INTO expert_aliases (expert_id, alias) VALUES
      (expert_record.id, 'Gaba ji'),
      (expert_record.id, 'Prakash'),
      (expert_record.id, 'Gaba')
    ON CONFLICT (alias) DO NOTHING;
  END IF;

  -- Sanjiv Bhasin aliases
  SELECT id INTO expert_record FROM experts WHERE canonical_name = 'Sanjiv Bhasin';
  IF expert_record.id IS NOT NULL THEN
    INSERT INTO expert_aliases (expert_id, alias) VALUES
      (expert_record.id, 'Bhasin'),
      (expert_record.id, 'Bhasin ji'),
      (expert_record.id, 'Sanjiv Bhasin ji')
    ON CONFLICT (alias) DO NOTHING;
  END IF;

  -- Sandeep Jain aliases
  SELECT id INTO expert_record FROM experts WHERE canonical_name = 'Sandeep Jain';
  IF expert_record.id IS NOT NULL THEN
    INSERT INTO expert_aliases (expert_id, alias) VALUES
      (expert_record.id, 'Sandeep ji'),
      (expert_record.id, 'Jain ji'),
      (expert_record.id, 'Sandeep Jain ji')
    ON CONFLICT (alias) DO NOTHING;
  END IF;

  -- Ashwani Gujral aliases
  SELECT id INTO expert_record FROM experts WHERE canonical_name = 'Ashwani Gujral';
  IF expert_record.id IS NOT NULL THEN
    INSERT INTO expert_aliases (expert_id, alias) VALUES
      (expert_record.id, 'Gujral'),
      (expert_record.id, 'Gujral ji'),
      (expert_record.id, 'Ashwani ji')
    ON CONFLICT (alias) DO NOTHING;
  END IF;
END $$;

-- ============================================
-- TRIGGER: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_channels_updated_at ON channels;
CREATE TRIGGER update_channels_updated_at
    BEFORE UPDATE ON channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_experts_updated_at ON experts;
CREATE TRIGGER update_experts_updated_at
    BEFORE UPDATE ON experts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
