-- Migration: 002_admin_sessions.sql
-- Description: Create admin_sessions table for session-based authentication
-- Created: 2025-01-01

-- Admin sessions table for storing active login sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT
);

-- Index for fast token lookup during auth checks
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);

-- Index for cleanup job to find expired sessions
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

-- Comment for documentation
COMMENT ON TABLE admin_sessions IS 'Stores admin authentication sessions with expiry tracking';
COMMENT ON COLUMN admin_sessions.session_token IS 'Random 64-char hex string for cookie value';
COMMENT ON COLUMN admin_sessions.expires_at IS 'Session expiry timestamp (default 24 hours from creation)';
COMMENT ON COLUMN admin_sessions.ip_address IS 'IP address of login request for audit';
COMMENT ON COLUMN admin_sessions.user_agent IS 'Browser user agent for audit';
