import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cadvrekczuimrceddfdj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZHZyZWtjenVpbXJjZWRkZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Mjg1ODMsImV4cCI6MjA3OTAwNDU4M30.P4uAD5G7Fe72FLxVqLMOecp7D-_riIBTeFmoGPzgCsA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface DbGhostRace {
  id: string;
  user_id: string;
  course_id: string;
  duration: number;
  ghost_path: { latitude: number; longitude: number; timestamp: number }[];
  start_checkpoint: {
    id: string;
    type: 'start' | 'finish';
    latitude: number;
    longitude: number;
    name: string;
  };
  finish_checkpoint: {
    id: string;
    type: 'start' | 'finish';
    latitude: number;
    longitude: number;
    name: string;
  };
  average_speed: number;
  max_speed: number;
  created_at: string;
}

export interface DbParty {
  id: string;
  invitation_code: string;
  creator_id: string;
  max_members: number;
  created_at: string;
  status: 'active' | 'completed';
}

export interface DbPartyMember {
  id: string;
  party_id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
}

export interface DbRaceResult {
  id: string;
  party_id: string;
  user_id: string;
  course_id: string;
  duration: number;
  average_speed: number;
  max_speed: number;
  ghost_path: { latitude: number; longitude: number; timestamp: number }[];
  created_at: string;
}

export interface DbPartyMemberLocation {
  id: string;
  party_id: string;
  user_id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  updated_at: string;
}
