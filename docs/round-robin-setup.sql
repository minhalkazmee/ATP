-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)
-- Creates the table that tracks the round-robin counter for lead assignment.

CREATE TABLE IF NOT EXISTS round_robin_state (
  id           TEXT PRIMARY KEY DEFAULT 'default',
  current_index INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Seed the initial row
INSERT INTO round_robin_state (id, current_index)
VALUES ('default', 0)
ON CONFLICT (id) DO NOTHING;

-- Grant access to the service role (used by Vercel serverless functions)
ALTER TABLE round_robin_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON round_robin_state
  FOR ALL
  USING (true)
  WITH CHECK (true);
