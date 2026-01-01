-- Migration: 014_session_store.sql
-- Description: Create session table for PostgreSQL session store
-- Date: 2026-01-01

-- Session table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);

-- Primary key on session ID
ALTER TABLE "session"
  ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
  NOT DEFERRABLE INITIALLY IMMEDIATE;

-- Index for cleanup of expired sessions
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
