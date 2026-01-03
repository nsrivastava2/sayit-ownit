-- Migration 016: Add target_price_2 and stop_loss_type columns
-- Purpose: Support multiple targets and system-generated stop loss

-- Add target_price_2 for second target price
ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS target_price_2 NUMERIC(12, 2);

-- Add stop_loss_type to indicate if SL was provided by expert or system-generated
-- Values: 'EXPERT' (provided by expert), 'SYSTEM' (auto-calculated)
ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS stop_loss_type VARCHAR(10) DEFAULT 'EXPERT';

-- Update existing records to have 'EXPERT' as stop_loss_type where stop_loss is not null
UPDATE recommendations
SET stop_loss_type = 'EXPERT'
WHERE stop_loss IS NOT NULL AND stop_loss_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN recommendations.target_price_2 IS 'Second target price if expert provides multiple targets';
COMMENT ON COLUMN recommendations.stop_loss_type IS 'EXPERT = provided by expert, SYSTEM = auto-calculated as recommended_price - (target - recommended_price)/2';

-- Create index for faster queries on stop_loss_type
CREATE INDEX IF NOT EXISTS idx_recommendations_stop_loss_type ON recommendations(stop_loss_type);
