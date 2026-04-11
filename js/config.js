// js/config.js — Supabase configuration
// Fill in your Supabase project URL and anon (public) key below.
// Get these from: https://supabase.com/dashboard → Project Settings → API
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/*
  TABLE SETUP — Run this SQL in Supabase SQL Editor:

  CREATE TABLE scores (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    score INTEGER NOT NULL DEFAULT 0,
    round INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Index for fast leaderboard queries
  CREATE INDEX idx_scores_score ON scores (score DESC);

  -- Enable Row Level Security (RLS) but allow public read/write via anon key
  ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Allow public read" ON scores FOR SELECT USING (true);
  CREATE POLICY "Allow public insert" ON scores FOR INSERT WITH CHECK (true);
  CREATE POLICY "Allow public update" ON scores FOR UPDATE USING (true);
*/
