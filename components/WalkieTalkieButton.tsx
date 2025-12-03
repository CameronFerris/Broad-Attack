import React, { useState, useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet, Text, Platform, Animated as RNAnimated } from 'react-native';
import { Mic } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { subscribeToWalkieTalkie, broadcastAudio, playReceivedAudio, type WalkieTalkieMessage } from '@/lib/walkie-talkie-service';

type WalkieTalkieButtonProps = {
  partyId: string;
  userId: string;
  displayName: string;
};

export default function WalkieTalkieButton({ partyId, userId, displayName }: WalkieTalkieButtonProps) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isReceiving, setIsReceiving] = useState<boolean>(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const receivePulseAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    requestPermissions();
    setupAudioMode();
  }, []);

  useEffect(() => {
    if (!partyId || !userId) return;

    const unsubscribe = subscribeToWalkieTalkie(partyId, userId, async (message: WalkieTalkieMessage) => {
      console.log('Playing audio from:', message.displayName);
      setIsReceiving(true);
      
      try {
        await playReceivedAudio(message.audioData);
      } catch (error) {
        console.error('Error playing audio:', error);
      } finally {
        setTimeout(() => {
          setIsReceiving(false);
        }, 500);
      }
    });

    return unsubscribe;
  }, [partyId, userId]);

  useEffect(() => {
    if (isRecording) {
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 500,
            useNativeDriver: true,
          }),
          RNAnimated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  useEffect(() => {
    if (isReceiving) {
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(receivePulseAnim, {
            toValue: 1.2,
            duration: 300,
            useNativeDriver: true,
          }),
          RNAnimated.timing(receivePulseAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      receivePulseAnim.setValue(1);
    }
  }, [isReceiving, receivePulseAnim]);

  const requestPermissions = async () => {
    if (Platform.OS === 'web') {
      setHasPermission(true);
      return;
    }

    try {
      const { status } = await Audio.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      console.log('Audio permission status:', status);
    } catch (error) {
      console.error('Error requesting audio permission:', error);
    }
  };

  const setupAudioMode = async () => {
    if (Platform.OS === 'web') return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Error setting audio mode:', error);
    }
  };

  const startRecording = async () => {
    if (!hasPermission) {
      console.log('No audio permission');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      console.log('Starting recording...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      console.log('Stopping recording...');
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        console.log('Recording saved to:', uri);
        await sendAudio(uri);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const sendAudio = async (uri: string) => {
    try {
      console.log('Reading audio file...');
      const file = new File(uri);
      const base64 = await file.base64();

      console.log('Broadcasting audio... Size:', base64.length);
      await broadcastAudio(partyId, userId, displayName, base64);
      console.log('Audio sent successfully');
    } catch (error) {
      console.error('Error sending audio:', error);
    }
  };

  const handlePressIn = () => {
    startRecording();
  };

  const handlePressOut = () => {
    stopRecording();
  };

  return (
    <View style={styles.container}>
      {isReceiving && (
        <RNAnimated.View 
          style={[
            styles.receiveIndicator,
            {
              transform: [{ scale: receivePulseAnim }],
            },
          ]}
        >
          <Text style={styles.receiveText}>📻</Text>
        </RNAnimated.View>
      )}
      <Pressable
        testID="walkie-talkie-button"
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.button,
          isRecording && styles.buttonActive,
          pressed && styles.buttonPressed,
        ]}
      >
        <RNAnimated.View
          style={[
            styles.buttonInner,
            {
              transform: [{ scale: isRecording ? pulseAnim : 1 }],
            },
          ]}
        >
          {isRecording ? (
            <Mic size={28} color="#fff" fill="#fff" />
          ) : (
            <Mic size={28} color="#fff" />
          )}
        </RNAnimated.View>
      </Pressable>
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute' as const,
    bottom: 200,
    left: 20,
    alignItems: 'center' as const,
    gap: 12,
  },
  button: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 122, 255, 0.95)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.95)',
    shadowColor: '#FF3B30',
    borderColor: '#fff',
  },
  buttonPressed: {
    transform: [{ scale: 0.95 }] as any,
  },
  buttonInner: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  recordingIndicator: {
    position: 'absolute' as const,
    top: -30,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255, 59, 48, 0.95)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  recordingText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
  receiveIndicator: {
    position: 'absolute' as const,
    top: -40,
    backgroundColor: 'rgba(52, 199, 89, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  receiveText: {
    fontSize: 20,
  },
});
