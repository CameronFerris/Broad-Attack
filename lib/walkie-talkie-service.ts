import { supabase } from './supabase';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export type WalkieTalkieMessage = {
  userId: string;
  displayName: string;
  audioData: string;
  timestamp: number;
};

export function subscribeToWalkieTalkie(
  partyId: string,
  currentUserId: string,
  onMessage: (message: WalkieTalkieMessage) => void
) {
  console.log('Subscribing to walkie talkie channel:', partyId);
  
  const channel = supabase.channel(`walkie-talkie:${partyId}`, {
    config: {
      broadcast: {
        self: false,
      },
    },
  });

  channel
    .on('broadcast', { event: 'audio' }, async (payload) => {
      const message = payload.payload as WalkieTalkieMessage;
      
      if (message.userId !== currentUserId) {
        console.log('Received audio from:', message.displayName);
        onMessage(message);
      }
    })
    .subscribe((status) => {
      console.log('Walkie talkie channel status:', status);
    });

  return () => {
    console.log('Unsubscribing from walkie talkie channel');
    channel.unsubscribe();
  };
}

export async function broadcastAudio(
  partyId: string,
  userId: string,
  displayName: string,
  audioData: string
): Promise<void> {
  try {
    const channel = supabase.channel(`walkie-talkie:${partyId}`);
    
    await channel.subscribe();

    const message: WalkieTalkieMessage = {
      userId,
      displayName,
      audioData,
      timestamp: Date.now(),
    };

    await channel.send({
      type: 'broadcast',
      event: 'audio',
      payload: message,
    });

    console.log('Broadcasted audio to party:', partyId);
  } catch (error) {
    console.error('Error broadcasting audio:', error);
    throw error;
  }
}

export async function playReceivedAudio(audioData: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      const audio = new window.Audio(`data:audio/m4a;base64,${audioData}`);
      await audio.play();
    } catch (error) {
      console.error('Error playing audio on web:', error);
    }
    return;
  }

  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: `data:audio/m4a;base64,${audioData}` },
      { shouldPlay: true, volume: 1.0 },
      null
    );

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    console.error('Error playing received audio:', error);
  }
}
