-- Run these SQL commands in your Supabase SQL Editor to set up the database schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ghost races table - stores best times for each course
CREATE TABLE IF NOT EXISTS ghost_races (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  duration INTEGER NOT NULL,
  ghost_path JSONB NOT NULL,
  start_checkpoint JSONB NOT NULL,
  finish_checkpoint JSONB NOT NULL,
  average_speed FLOAT NOT NULL,
  max_speed FLOAT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ghost_races_course ON ghost_races(course_id);
CREATE INDEX IF NOT EXISTS idx_ghost_races_user ON ghost_races(user_id);
CREATE INDEX IF NOT EXISTS idx_ghost_races_duration ON ghost_races(course_id, duration);

-- Parties table - for multiplayer racing
CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_code TEXT UNIQUE NOT NULL,
  creator_id TEXT NOT NULL,
  max_members INTEGER DEFAULT 2,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index on invitation code for quick lookups
CREATE INDEX IF NOT EXISTS idx_parties_invitation ON parties(invitation_code);
CREATE INDEX IF NOT EXISTS idx_parties_creator ON parties(creator_id);

-- Party members table
CREATE TABLE IF NOT EXISTS party_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(party_id, user_id)
);

-- Index for faster member lookups
CREATE INDEX IF NOT EXISTS idx_party_members_party ON party_members(party_id);
CREATE INDEX IF NOT EXISTS idx_party_members_user ON party_members(user_id);

-- Race results table - stores race results for parties
CREATE TABLE IF NOT EXISTS race_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  duration INTEGER NOT NULL,
  average_speed FLOAT NOT NULL,
  max_speed FLOAT NOT NULL,
  ghost_path JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster race result lookups
CREATE INDEX IF NOT EXISTS idx_race_results_party ON race_results(party_id);
CREATE INDEX IF NOT EXISTS idx_race_results_user ON race_results(user_id);
CREATE INDEX IF NOT EXISTS idx_race_results_duration ON race_results(party_id, duration);

-- Enable Row Level Security (RLS)
ALTER TABLE ghost_races ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_results ENABLE ROW LEVEL SECURITY;

-- Policies for public access (you may want to restrict this later with auth)
CREATE POLICY "Allow public read access to ghost races" ON ghost_races FOR SELECT USING (true);
CREATE POLICY "Allow public insert to ghost races" ON ghost_races FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to update own ghost races" ON ghost_races FOR UPDATE USING (true);

CREATE POLICY "Allow public read access to parties" ON parties FOR SELECT USING (true);
CREATE POLICY "Allow public insert to parties" ON parties FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow creators to update parties" ON parties FOR UPDATE USING (true);

CREATE POLICY "Allow public read access to party members" ON party_members FOR SELECT USING (true);
CREATE POLICY "Allow public insert to party members" ON party_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to delete own party membership" ON party_members FOR DELETE USING (true);

CREATE POLICY "Allow public read access to race results" ON race_results FOR SELECT USING (true);
CREATE POLICY "Allow public insert to race results" ON race_results FOR INSERT WITH CHECK (true);

-- Party member locations table - stores real-time locations
CREATE TABLE IF NOT EXISTS party_member_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  heading FLOAT,
  speed FLOAT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(party_id, user_id)
);

-- Index for faster location lookups
CREATE INDEX IF NOT EXISTS idx_party_locations_party ON party_member_locations(party_id);
CREATE INDEX IF NOT EXISTS idx_party_locations_updated ON party_member_locations(party_id, updated_at);

-- Enable RLS for locations
ALTER TABLE party_member_locations ENABLE ROW LEVEL SECURITY;

-- Policies for location access
CREATE POLICY "Allow public read access to party locations" ON party_member_locations FOR SELECT USING (true);
CREATE POLICY "Allow public insert to party locations" ON party_member_locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to update own locations" ON party_member_locations FOR UPDATE USING (true);
CREATE POLICY "Allow users to delete own locations" ON party_member_locations FOR DELETE USING (true);
