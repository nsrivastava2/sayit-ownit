-- Phase 5: User Accounts with Google OAuth
-- Run: PGPASSWORD=sayitownit123 psql -h localhost -p 5433 -U sayitownit -d sayitownit -f database/migrations/012_user_accounts.sql

-- Users table (Google OAuth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    profile_picture_url VARCHAR(500),
    subscription_tier VARCHAR(50) DEFAULT 'FREE',  -- FREE or PRO
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_subscription_tier CHECK (subscription_tier IN ('FREE', 'PRO'))
);

-- User following experts
CREATE TABLE IF NOT EXISTS user_expert_following (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    expert_id UUID REFERENCES experts(id) ON DELETE CASCADE,
    notify_on_new_rec BOOLEAN DEFAULT TRUE,
    notify_on_outcome BOOLEAN DEFAULT TRUE,
    followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, expert_id)
);

-- User watchlists
CREATE TABLE IF NOT EXISTS user_watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Watchlist stocks
CREATE TABLE IF NOT EXISTS watchlist_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watchlist_id UUID REFERENCES user_watchlists(id) ON DELETE CASCADE,
    stock_id UUID REFERENCES stocks(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    UNIQUE(watchlist_id, stock_id)
);

-- User notifications
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,  -- NEW_RECOMMENDATION, TARGET_HIT, SL_HIT, EXPIRED
    title VARCHAR(255) NOT NULL,
    message TEXT,
    link VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_tier);

CREATE INDEX IF NOT EXISTS idx_user_following_user ON user_expert_following(user_id);
CREATE INDEX IF NOT EXISTS idx_user_following_expert ON user_expert_following(expert_id);

CREATE INDEX IF NOT EXISTS idx_watchlists_user ON user_watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_stocks_watchlist ON watchlist_stocks(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_stocks_stock ON watchlist_stocks(stock_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON user_notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON user_notifications(created_at DESC);

-- Tier limits (for reference in application code)
COMMENT ON TABLE users IS 'FREE: 5 follows, 1 watchlist. PRO: unlimited (free in Beta)';
