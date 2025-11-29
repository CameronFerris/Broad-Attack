import { useDriveTrack } from '@/contexts/DriveTrackContext';
import { getDisplayRoadName } from '@/lib/road-name';
import * as Location from 'expo-location';
import { MapPin } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import type { LocationData } from '@/types/map';

const SPEED_CONVERSION_FACTOR = 3.6;

export default function MapScreen() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [currentRoad, setCurrentRoad] = useState<string>('Loading...');
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean>(false);

  const { isTimerActive, recordSpeed } = useDriveTrack();

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (!hasLocationPermission) return;

    const startTracking = async () => {
      try {
        await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 5,
          },
          (loc) => {
            const speedInKmh = (loc.coords.speed ?? 0) * SPEED_CONVERSION_FACTOR;
            
            const newLocation: LocationData = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              speed: speedInKmh,
              heading: loc.coords.heading,
              timestamp: loc.timestamp,
            };
            
            setLocation(newLocation);
            setCurrentSpeed(speedInKmh);
            
            if (isTimerActive) {
              recordSpeed(speedInKmh);
            }
            
            getRoadName(loc.coords.latitude, loc.coords.longitude);
          }
        );
      } catch (error) {
        console.error('Error watching location:', error);
      }
    };

    startTracking();
  }, [hasLocationPermission, isTimerActive, recordSpeed]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasLocationPermission(status === 'granted');
      console.log('Location permission:', status);
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const getRoadName = async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const result = results[0];
        const road = getDisplayRoadName(result);
        setCurrentRoad(road);
      }
    } catch (error) {
      console.error('Error getting road name:', error);
    }
  };

  if (!hasLocationPermission) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <MapPin size={48} color="#FF3B30" />
        <Text style={styles.permissionText}>Location permission required</Text>
        <Text style={styles.permissionSubtext}>
          Please enable location access to use this app
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.centerContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <MapPin size={64} color="#007AFF" />
      <Text style={styles.permissionText}>Web Version</Text>
      <Text style={styles.permissionSubtext}>
        Map features are only available on iOS and Android.
        {location && `\n\nCurrent Location:\n${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`}
        {location && `\n\nSpeed: ${Math.round(currentSpeed)} km/h`}
        {currentRoad !== 'Loading...' && `\nRoad: ${currentRoad}`}
      </Text>
      <Text style={styles.webInstructionText}>
        Scan the QR code to run this app on your mobile device
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 20,
    gap: 12,
  },
  permissionText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginTop: 16,
  },
  permissionSubtext: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  webInstructionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 40,
  },
});
