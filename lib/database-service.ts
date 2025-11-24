import { supabase, type DbGhostRace, type DbParty, type DbPartyMember, type DbRaceResult, type DbPartyMemberLocation } from './supabase';
import type { Checkpoint, GhostPoint } from '@/types/map';

export type { DbGhostRace, DbParty, DbPartyMember, DbRaceResult, DbPartyMemberLocation };

function generateInvitationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function uploadGhostRace(params: {
  userId: string;
  courseId: string;
  duration: number;
  ghostPath: GhostPoint[];
  startCheckpoint: Checkpoint;
  finishCheckpoint: Checkpoint;
  averageSpeed: number;
  maxSpeed: number;
}): Promise<DbGhostRace | null> {
  try {
    const { data: existing } = await supabase
      .from('ghost_races')
      .select('*')
      .eq('user_id', params.userId)
      .eq('course_id', params.courseId)
      .single();

    if (existing && existing.duration <= params.duration) {
      console.log('Existing ghost is faster, not updating');
      return existing;
    }

    const ghostData = {
      user_id: params.userId,
      course_id: params.courseId,
      duration: params.duration,
      ghost_path: params.ghostPath,
      start_checkpoint: params.startCheckpoint,
      finish_checkpoint: params.finishCheckpoint,
      average_speed: params.averageSpeed,
      max_speed: params.maxSpeed,
    };

    if (existing) {
      const { data, error } = await supabase
        .from('ghost_races')
        .update(ghostData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      console.log('Updated ghost race:', data?.id);
      return data;
    } else {
      const { data, error } = await supabase
        .from('ghost_races')
        .insert(ghostData)
        .select()
        .single();

      if (error) throw error;
      console.log('Uploaded new ghost race:', data?.id);
      return data;
    }
  } catch (error) {
    console.error('Error uploading ghost race:', error);
    return null;
  }
}

export async function getGhostRacesForCourse(courseId: string): Promise<DbGhostRace[]> {
  try {
    const { data, error } = await supabase
      .from('ghost_races')
      .select('*')
      .eq('course_id', courseId)
      .order('duration', { ascending: true })
      .limit(10);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching ghost races:', error);
    return [];
  }
}

export async function createParty(params: {
  creatorId: string;
  displayName: string;
  maxMembers?: number;
}): Promise<{ party: DbParty; invitationCode: string; error?: string } | { error: string }> {
  try {
    let invitationCode = generateInvitationCode();
    let attempts = 0;
    
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('parties')
        .select('id')
        .eq('invitation_code', invitationCode)
        .single();
      
      if (!existing) break;
      
      invitationCode = generateInvitationCode();
      attempts++;
    }

    if (attempts >= 10) {
      console.error('Failed to generate unique invitation code');
      return { error: 'Failed to generate unique invitation code. Please try again.' };
    }

    const { data: party, error: partyError } = await supabase
      .from('parties')
      .insert({
        invitation_code: invitationCode,
        creator_id: params.creatorId,
        max_members: params.maxMembers || 2,
        status: 'active',
      })
      .select()
      .single();

    if (partyError) {
      console.error('Error creating party:', JSON.stringify(partyError, null, 2));
      return { error: `Failed to create party: ${partyError.message || partyError.hint || JSON.stringify(partyError)}` };
    }

    const { error: memberError } = await supabase
      .from('party_members')
      .insert({
        party_id: party.id,
        user_id: params.creatorId,
        display_name: params.displayName,
      });

    if (memberError) {
      console.error('Error adding member:', JSON.stringify(memberError, null, 2));
      return { error: `Failed to add member: ${memberError.message || memberError.hint || JSON.stringify(memberError)}` };
    }

    console.log('Created party:', party.id, 'Code:', invitationCode);
    return { party, invitationCode };
  } catch (error) {
    console.error('Error creating party (caught):', error);
    if (error instanceof Error) {
      return { error: `Error: ${error.message}` };
    }
    return { error: `Failed to create party: ${JSON.stringify(error)}` };
  }
}

export async function joinPartyByCode(params: {
  invitationCode: string;
  userId: string;
  displayName: string;
}): Promise<{ party: DbParty; members: DbPartyMember[] } | { error: string }> {
  try {
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('*')
      .eq('invitation_code', params.invitationCode)
      .eq('status', 'active')
      .single();

    if (partyError || !party) {
      console.error('Party not found:', JSON.stringify(partyError, null, 2));
      return { error: `Party not found: ${partyError?.message || partyError?.hint || 'No party with this code exists or it may be completed.'}` };
    }

    const { data: members, error: membersError } = await supabase
      .from('party_members')
      .select('*')
      .eq('party_id', party.id);

    if (membersError) throw membersError;

    if (members.length >= party.max_members) {
      console.error('Party is full');
      return { error: 'Party is full. Maximum members reached.' };
    }

    const alreadyMember = members.some(m => m.user_id === params.userId);
    if (alreadyMember) {
      console.log('User already in party');
      return { party, members };
    }

    const { error: joinError } = await supabase
      .from('party_members')
      .insert({
        party_id: party.id,
        user_id: params.userId,
        display_name: params.displayName,
      });

    if (joinError) throw joinError;

    const { data: updatedMembers, error: updatedError } = await supabase
      .from('party_members')
      .select('*')
      .eq('party_id', party.id);

    if (updatedError) throw updatedError;

    console.log('Joined party:', party.id);
    return { party, members: updatedMembers || [] };
  } catch (error) {
    console.error('Error joining party (caught):', error);
    if (error instanceof Error) {
      return { error: `Error: ${error.message}` };
    }
    return { error: `Failed to join party: ${JSON.stringify(error)}` };
  }
}

export async function getPartyMembers(partyId: string): Promise<DbPartyMember[]> {
  try {
    const { data, error } = await supabase
      .from('party_members')
      .select('*')
      .eq('party_id', partyId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching party members:', error);
    return [];
  }
}

export async function submitRaceResult(params: {
  partyId: string;
  userId: string;
  courseId: string;
  duration: number;
  averageSpeed: number;
  maxSpeed: number;
  ghostPath: GhostPoint[];
}): Promise<DbRaceResult | null> {
  try {
    const { data, error } = await supabase
      .from('race_results')
      .insert({
        party_id: params.partyId,
        user_id: params.userId,
        course_id: params.courseId,
        duration: params.duration,
        average_speed: params.averageSpeed,
        max_speed: params.maxSpeed,
        ghost_path: params.ghostPath,
      })
      .select()
      .single();

    if (error) throw error;
    console.log('Submitted race result:', data?.id);
    return data;
  } catch (error) {
    console.error('Error submitting race result:', error);
    return null;
  }
}

export async function getPartyRaceResults(partyId: string): Promise<DbRaceResult[]> {
  try {
    const { data, error } = await supabase
      .from('race_results')
      .select('*')
      .eq('party_id', partyId)
      .order('duration', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching race results:', error);
    return [];
  }
}

export async function closeParty(partyId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('parties')
      .update({ status: 'completed' })
      .eq('id', partyId);

    if (error) throw error;
    console.log('Closed party:', partyId);
    return true;
  } catch (error) {
    console.error('Error closing party:', error);
    return false;
  }
}

export function subscribeToPartyMembers(
  partyId: string,
  onUpdate: (members: DbPartyMember[]) => void
) {
  const channel = supabase
    .channel(`party_members:${partyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'party_members',
        filter: `party_id=eq.${partyId}`,
      },
      async () => {
        const members = await getPartyMembers(partyId);
        onUpdate(members);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

export function subscribeToRaceResults(
  partyId: string,
  onUpdate: (results: DbRaceResult[]) => void
) {
  const channel = supabase
    .channel(`race_results:${partyId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'race_results',
        filter: `party_id=eq.${partyId}`,
      },
      async () => {
        const results = await getPartyRaceResults(partyId);
        onUpdate(results);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

let locationUpdateQueue: Promise<any> = Promise.resolve();
const MAX_RETRIES = 3;
const RETRY_DELAY = 500;

async function retryOperation<T>(
  operation: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return retryOperation(operation, retries - 1);
    }
    throw error;
  }
}

export async function updatePartyMemberLocation(params: {
  partyId: string;
  userId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
}): Promise<boolean> {
  locationUpdateQueue = locationUpdateQueue.then(async () => {
    try {
      return await retryOperation(async () => {
        const { error } = await supabase
          .from('party_member_locations')
          .upsert(
            {
              party_id: params.partyId,
              user_id: params.userId,
              display_name: params.displayName,
              latitude: params.latitude,
              longitude: params.longitude,
              heading: params.heading,
              speed: params.speed,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'party_id,user_id',
            }
          );

        if (error) throw error;
        return true;
      });
    } catch (error) {
      console.error('Error updating party member location after retries:', error);
      return false;
    }
  });

  return locationUpdateQueue;
}

export async function getPartyMemberLocations(partyId: string): Promise<DbPartyMemberLocation[]> {
  try {
    const { data, error } = await supabase
      .from('party_member_locations')
      .select('*')
      .eq('party_id', partyId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching party member locations:', error);
    return [];
  }
}

export function subscribeToPartyMemberLocations(
  partyId: string,
  onUpdate: (locations: DbPartyMemberLocation[]) => void
) {
  const channel = supabase
    .channel(`party_locations:${partyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'party_member_locations',
        filter: `party_id=eq.${partyId}`,
      },
      async () => {
        const locations = await getPartyMemberLocations(partyId);
        onUpdate(locations);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

export async function removePartyMemberLocation(partyId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('party_member_locations')
      .delete()
      .eq('party_id', partyId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error removing party member location:', error);
    return false;
  }
}

export async function leaveParty(partyId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Remove from party_members
    const { error: memberError } = await supabase
      .from('party_members')
      .delete()
      .eq('party_id', partyId)
      .eq('user_id', userId);

    if (memberError) {
      console.error('Error removing party member:', JSON.stringify(memberError, null, 2));
      return { success: false, error: `Failed to leave party: ${memberError.message || memberError.hint || JSON.stringify(memberError)}` };
    }

    // Remove location data
    await removePartyMemberLocation(partyId, userId);

    console.log('Left party:', partyId);
    return { success: true };
  } catch (error) {
    console.error('Error leaving party (caught):', error);
    if (error instanceof Error) {
      return { success: false, error: `Error: ${error.message}` };
    }
    return { success: false, error: `Failed to leave party: ${JSON.stringify(error)}` };
  }
}
