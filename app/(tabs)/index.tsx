import { useDriveTrack } from '@/contexts/DriveTrackContext';
import { useSettings } from '@/contexts/SettingsContext';
import type { Checkpoint, LocationData, SpeedUnit, NavigationInstruction, RallyPacenote, RallyModifier, RallyCrest, RallyWarning, SpeedCamera, RoadSegment, UpcomingTurn, RouteOption, GhostPoint } from '@/types/map';
import { calculateRoutesWithCheckpoints } from '@/lib/route-service';
import { getDisplayRoadName, sanitizeRoadLabel } from '@/lib/road-name';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updatePartyMemberLocation, subscribeToPartyMemberLocations, removePartyMemberLocation, type DbPartyMemberLocation } from '@/lib/database-service';
import { BatchedLocationUploader } from '@/lib/location-tracker';
import PartyResultsModal from '@/components/PartyResultsModal';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { getNearbyPredefinedCameras, isApproachingCamera } from '@/constants/speed-cameras';
import { 
  Flag, 
  MapPin, 
  Play, 
  Trash2,
  Volume2,
  VolumeOff,
  X,
  Navigation,
  Camera,
  AlertTriangle,
  Ghost,
  Clock
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated as RNAnimated,
  Modal,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, Polyline, type MapStyleElement } from 'react-native-maps';

const PROXIMITY_THRESHOLD = 5;
const FINISH_EXIT_THRESHOLD = 50;
const SPEED_CONVERSION_FACTOR = 3.6;
const KMH_TO_MPH = 0.621371;
const SPEED_CAMERA_WARNING_DISTANCE = 500; // Increased warning distance to 500m for earlier alerts
const LOCATION_UPDATE_INTERVAL = 100;
const ROAD_NAME_UPDATE_INTERVAL = 8000;
const ROAD_NAME_MIN_DISTANCE = 80;
const ROAD_ANALYSIS_STEP = 25;
const ROAD_LOOKAHEAD_DISTANCE = 800;
const RALLY_LOOKAHEAD_DISTANCE = 1200;
const TURN_DETECTION_THRESHOLD = 12;
const RALLY_TURN_DETECTION_THRESHOLD = 10;

const MPH_COUNTRIES = [
  'US',
  'UM', // U.S. Minor Outlying Islands
  'PR', // Puerto Rico
  'VI', // U.S. Virgin Islands
  'GU', // Guam
  'AS', // American Samoa
  'MP', // Northern Mariana Islands
  'GB',
  'UK',
  'GG', // Guernsey
  'JE', // Jersey
  'IM', // Isle of Man
  'GI', // Gibraltar
  'LR',
  'MM',
  'BS', // Bahamas
  'BZ', // Belize
  'KY', // Cayman Islands
  'VG', // British Virgin Islands
  'BM', // Bermuda
  'AI', // Anguilla
  'AG', // Antigua and Barbuda
  'DM', // Dominica
  'GD', // Grenada
  'MS', // Montserrat
  'KN', // Saint Kitts and Nevis
  'LC', // Saint Lucia
  'VC', // Saint Vincent and the Grenadines
  'TT', // Trinidad and Tobago
  'TC', // Turks and Caicos Islands
  'PW', // Palau
  'FM', // Micronesia
  'MH', // Marshall Islands
];

const USER_ID_KEY = '@timeattack_user_id';
const USER_NAME_KEY = '@timeattack_user_name';

const MEMBER_COLORS = [
  '#FF3B30',
  '#007AFF',
  '#34C759',
  '#FF9500',
  '#AF52DE',
  '#FF2D55',
  '#5AC8FA',
  '#FFCC00',
];

const LIGHT_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#ebe3cd' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#523735' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f1e6' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9b2a6' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e7e8ea' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#93817c' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#cdeccd' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#447530' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f8c967' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e9bc62' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#f2f2f2' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#d4e4fb' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
];

const DARK_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#1f1f1f' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8f8f8f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3f3f3f' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#b0b0b0' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#383838' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2f3030' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f1f1f' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#d0d0d0' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2b2b2b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6b84' }] },
];

export default function MapScreen() {
  const params = useLocalSearchParams<{
    viewRunId?: string;
    startLat?: string;
    startLon?: string;
    finishLat?: string;
    finishLon?: string;
    startName?: string;
    finishName?: string;
  }>();
  
  const mapRef = useRef<any>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [currentRoad, setCurrentRoad] = useState<string>('Loading...');
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean>(false);
  const [isAddingCheckpoint, setIsAddingCheckpoint] = useState<'start' | 'finish' | 'checkpoint' | null>(null);

  const [isAddingSpeedCamera, setIsAddingSpeedCamera] = useState<boolean>(false);
  const [nearbySpeedCamera, setNearbySpeedCamera] = useState<{ camera: SpeedCamera; distance: number } | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [passedStartCheckpoint, setPassedStartCheckpoint] = useState<Checkpoint | null>(null);
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState<boolean>(false);
  const [nextInstruction, setNextInstruction] = useState<NavigationInstruction | null>(null);
  const [currentGhostPosition, setCurrentGhostPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeGhostPath, setActiveGhostPath] = useState<GhostPoint[]>([]);
  const [partyMemberLocations, setPartyMemberLocations] = useState<DbPartyMemberLocation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [showPartyResults, setShowPartyResults] = useState<boolean>(false);
  const [completedCourseId, setCompletedCourseId] = useState<string>('');
  const [showFinishModal, setShowFinishModal] = useState<boolean>(false);
  const [finishModalTime, setFinishModalTime] = useState<number>(0);
  const hasAnnouncedStartRef = useRef(false);
  const hasAnnouncedFinishRef = useRef(false);
  const hasLeftFinishPointRef = useRef(false);
  const lastAnnouncedInstruction = useRef<string | null>(null);
  const locationUploader = useRef(new BatchedLocationUploader());
  const announcedCameraDistances = useRef<Map<string, Set<number>>>(new Map());

  const lastHeadingRef = useRef<number | null>(null);
  const lastRoadUpdateTime = useRef<number>(0);
  const lastRoadUpdateLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  const hasUserInteracted = useRef<boolean>(false);
  const lastLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const isUserMoving = useRef<boolean>(false);
  const roadSegmentsRef = useRef<RoadSegment[]>([]);
  const [viewingHistoricalRun, setViewingHistoricalRun] = useState<boolean>(false);
  const [historicalStartCheckpoint, setHistoricalStartCheckpoint] = useState<Checkpoint | null>(null);
  const [historicalFinishCheckpoint, setHistoricalFinishCheckpoint] = useState<Checkpoint | null>(null);
  const [historicalRunPath, setHistoricalRunPath] = useState<{ latitude: number; longitude: number }[]>([]);
  const [historicalRunDuration, setHistoricalRunDuration] = useState<number>(0);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isRouteConfirmed, setIsRouteConfirmed] = useState<boolean>(false);
  
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  const {
    checkpoints,
    runs,
    isTimerActive,
    startTime,
    locationInfo,
    voiceMode,
    speedCameras,
    ghostEnabled,
    currentPartyId,
    activeRunPath,
    addCheckpoint,
    removeCheckpoint,
    clearCheckpoints,
    startTimer,
    stopTimer,
    recordSpeed,
    updateLocationInfo,
    setVoiceNavigationMode,
    addSpeedCamera,
    removeSpeedCamera,
    recordGhostPoint,
    toggleGhost,
    getBestRunForCourse,
  } = useDriveTrack();

  const { showTraffic, mapType, showSpeed, autoZoom, highAccuracyGPS, batterySaver, navigationVolume, mapOrientation, isDarkMode } = useSettings();
  
  const memoizedCheckpoints = useMemo(() => checkpoints, [checkpoints]);
  const [nearbyCameras, setNearbyCameras] = useState<SpeedCamera[]>([]);
  const memoizedSpeedCameras = useMemo(() => {
    const allCameras = [...speedCameras];
    const cameraIds = new Set(speedCameras.map(c => c.id));
    
    nearbyCameras.forEach(cam => {
      if (!cameraIds.has(cam.id)) {
        allCameras.push(cam);
      }
    });
    
    return allCameras;
  }, [speedCameras, nearbyCameras]);

  const mapThemeStyle = useMemo<MapStyleElement[]>(() => {
    if (mapType !== 'standard') {
      return [];
    }
    return isDarkMode ? DARK_MAP_STYLE : LIGHT_MAP_STYLE;
  }, [isDarkMode, mapType]);

  useEffect(() => {
    const init = async () => {
      await setupAudioSession();
      await requestLocationPermission();
      const userId = await AsyncStorage.getItem(USER_ID_KEY);
      const userName = await AsyncStorage.getItem(USER_NAME_KEY);
      if (userId) setCurrentUserId(userId);
      if (userName) setCurrentUserName(userName);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load predefined speed cameras when we have location or on app start
  useEffect(() => {
    // Always load all predefined cameras initially
    const allCameras = getNearbyPredefinedCameras(0, 0, Number.MAX_VALUE);
    setNearbyCameras(allCameras);
    console.log(`Loaded ${allCameras.length} predefined speed cameras globally`);
    
    // When we have user location, prioritize nearby cameras but keep all
    if (location) {
      const sortedCameras = [...allCameras].sort((a, b) => {
        const distA = calculateDistance(location.latitude, location.longitude, a.latitude, a.longitude);
        const distB = calculateDistance(location.latitude, location.longitude, b.latitude, b.longitude);
        return distA - distB;
      });
      setNearbyCameras(sortedCameras);
      console.log(`Sorted ${sortedCameras.length} speed cameras by distance from user`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude]);

  const setupAudioSession = async () => {
    try {
      if (Platform.OS !== 'web') {
        console.log('Setting up audio session for Bluetooth navigation');
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          allowsRecordingIOS: false,
        });
        console.log('Audio session configured for Bluetooth output');
      }
    } catch (error) {
      console.error('Error setting up audio session:', error);
    }
  };

  useEffect(() => {
    if (params.viewRunId && params.startLat && params.startLon && params.finishLat && params.finishLon) {
      console.log('Viewing historical run:', params.viewRunId);
      setViewingHistoricalRun(true);
      
      const startCheckpoint: Checkpoint = {
        id: `history_start_${params.viewRunId}`,
        type: 'start',
        latitude: parseFloat(params.startLat),
        longitude: parseFloat(params.startLon),
        name: params.startName || 'Start',
      };
      
      const finishCheckpoint: Checkpoint = {
        id: `history_finish_${params.viewRunId}`,
        type: 'finish',
        latitude: parseFloat(params.finishLat),
        longitude: parseFloat(params.finishLon),
        name: params.finishName || 'Finish',
      };
      
      setHistoricalStartCheckpoint(startCheckpoint);
      setHistoricalFinishCheckpoint(finishCheckpoint);
      
      const run = runs.find(r => r.id === params.viewRunId);
      if (run) {
        console.log('Found run with', run.ghostPath?.length || 0, 'path points');
        setHistoricalRunDuration(run.duration);
        if (run.ghostPath && run.ghostPath.length > 0) {
          const pathCoordinates = run.ghostPath.map(p => ({
            latitude: p.latitude,
            longitude: p.longitude,
          }));
          setHistoricalRunPath(pathCoordinates);
        } else {
          setHistoricalRunPath([]);
        }
      } else {
        setHistoricalRunPath([]);
        setHistoricalRunDuration(0);
      }
      
      if (mapRef.current) {
        const midLat = (startCheckpoint.latitude + finishCheckpoint.latitude) / 2;
        const midLon = (startCheckpoint.longitude + finishCheckpoint.longitude) / 2;
        
        setTimeout(() => {
          mapRef.current?.animateCamera({
            center: {
              latitude: midLat,
              longitude: midLon,
            },
            pitch: 0,
            heading: 0,
            altitude: 5000,
            zoom: 14,
          }, { duration: 1000 });
        }, 500);
      }
    } else {
      setViewingHistoricalRun(false);
      setHistoricalStartCheckpoint(null);
      setHistoricalFinishCheckpoint(null);
      setHistoricalRunPath([]);
      setHistoricalRunDuration(0);
    }
  }, [params.viewRunId, params.startLat, params.startLon, params.finishLat, params.finishLon, params.startName, params.finishName, runs]);

  useEffect(() => {
    const fetchRoutes = async () => {
      const startCheckpoint = checkpoints.find(c => c.type === 'start');
      const finishCheckpoint = checkpoints.find(c => c.type === 'finish');
      const intermediateCheckpoints = checkpoints
        .filter(c => c.type === 'checkpoint')
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      if (startCheckpoint && finishCheckpoint && !isTimerActive) {
        console.log('Calculating routes with', intermediateCheckpoints.length, 'intermediate checkpoints');
        
        const waypoints = [
          { latitude: startCheckpoint.latitude, longitude: startCheckpoint.longitude },
          ...intermediateCheckpoints.map(c => ({ latitude: c.latitude, longitude: c.longitude })),
          { latitude: finishCheckpoint.latitude, longitude: finishCheckpoint.longitude }
        ];

        const routes = await calculateRoutesWithCheckpoints(waypoints);
        setRouteOptions(routes);
        if (routes.length > 0 && !selectedRouteId) {
          setSelectedRouteId(routes[0].id);
        }
      } else {
        setRouteOptions([]);
        setSelectedRouteId(null);
        setIsRouteConfirmed(false);
      }
    };

    fetchRoutes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpoints, isTimerActive]);

  useEffect(() => {
    if (!currentPartyId || !currentUserId || !currentUserName || !location) return;

    locationUploader.current.add({
      partyId: currentPartyId,
      userId: currentUserId,
      displayName: currentUserName,
      latitude: location.latitude,
      longitude: location.longitude,
      heading: location.heading,
      speed: location.speed,
    });

    const intervalId = setInterval(async () => {
      await locationUploader.current.flush(updatePartyMemberLocation);
    }, LOCATION_UPDATE_INTERVAL);

    return () => clearInterval(intervalId);
  }, [currentPartyId, currentUserId, currentUserName, location]);

  useEffect(() => {
    if (!currentPartyId) {
      setPartyMemberLocations([]);
      return;
    }

    const unsubscribe = subscribeToPartyMemberLocations(currentPartyId, (locations) => {
      const filteredLocations = locations.filter(loc => loc.user_id !== currentUserId);
      setPartyMemberLocations(filteredLocations);
      console.log('Party member locations updated:', filteredLocations.length);
    });

    return () => {
      unsubscribe();
      if (currentUserId) {
        removePartyMemberLocation(currentPartyId, currentUserId);
      }
    };
  }, [currentPartyId, currentUserId]);

  useEffect(() => {
    const startTracking = async () => {
      if (!hasLocationPermission) return;
      try {
        await Location.watchPositionAsync(
          {
            accuracy: batterySaver 
              ? Location.Accuracy.Balanced
              : highAccuracyGPS 
                ? Location.Accuracy.BestForNavigation 
                : Location.Accuracy.High,
            timeInterval: batterySaver ? 1000 : 16,
            distanceInterval: batterySaver ? 10 : 0.1,
          },
          async (loc) => {
            const speedMetersPerSecond = loc.coords?.speed ?? 0;
            const speedInKmh = Math.max(0, speedMetersPerSecond * SPEED_CONVERSION_FACTOR);
            
            const newLocation: LocationData = {
              latitude: loc.coords?.latitude ?? 0,
              longitude: loc.coords?.longitude ?? 0,
              speed: speedInKmh,
              heading: loc.coords?.heading ?? null,
              timestamp: loc.timestamp ?? Date.now(),
            };
            
            setLocation(newLocation);
            setCurrentSpeed(speedInKmh);
            
            if (lastLocationRef.current) {
              const distanceMoved = calculateDistance(
                lastLocationRef.current.latitude,
                lastLocationRef.current.longitude,
                newLocation.latitude,
                newLocation.longitude
              );
              isUserMoving.current = distanceMoved > 2;
            }
            lastLocationRef.current = { latitude: newLocation.latitude, longitude: newLocation.longitude };
            
            const shouldFollowUser = !viewingHistoricalRun && !hasUserInteracted.current && isUserMoving.current;
            
            if (shouldFollowUser && mapRef.current) {
              const heading = newLocation.heading ?? lastHeadingRef.current ?? 0;
              if (newLocation.heading !== null) {
                lastHeadingRef.current = newLocation.heading;
              }
              
              const baseZoom = speedInKmh > 100 ? 16.5 : speedInKmh > 60 ? 17 : speedInKmh > 30 ? 17.5 : 18;
              const zoomLevel = autoZoom ? baseZoom : 18;
              
              const cameraHeading = mapOrientation === 'heading-up' ? heading : 0;
              
              const animationDuration = speedInKmh > 50 ? 50 : speedInKmh > 20 ? 100 : 150;
              
              mapRef.current.animateCamera({
                center: {
                  latitude: newLocation.latitude,
                  longitude: newLocation.longitude,
                },
                pitch: 0,
                heading: cameraHeading,
                altitude: 1000,
                zoom: zoomLevel,
              }, { duration: animationDuration });
            }
            
            if (isTimerActive) {
              recordSpeed(speedInKmh);
              recordGhostPoint(newLocation.latitude, newLocation.longitude, loc.timestamp);
            }
            

            
            if (loc.coords?.latitude && loc.coords?.longitude) {
              getRoadName(loc.coords.latitude, loc.coords.longitude);
            }
            
            checkSpeedCameras(newLocation);
            
            memoizedCheckpoints.forEach(async (checkpoint) => {
              const distance = calculateDistance(
                newLocation.latitude,
                newLocation.longitude,
                checkpoint.latitude,
                checkpoint.longitude
              );

              if (checkpoint.type === 'finish' && hasAnnouncedFinishRef.current && distance > FINISH_EXIT_THRESHOLD) {
                console.log('User has left finish point - ready for new run');
                hasLeftFinishPointRef.current = true;
                // Don't clear checkpoints - they persist until app is fully closed
                setIsRouteConfirmed(false);
              }
              
              if (distance <= PROXIMITY_THRESHOLD) {
                if (checkpoint.type === 'start' && !isTimerActive && !hasAnnouncedStartRef.current && isRouteConfirmed) {
                  console.log('Reached start checkpoint - starting navigation');
                  setPassedStartCheckpoint(checkpoint);
                  startTimer();
                  hasAnnouncedStartRef.current = true;
                  hasAnnouncedFinishRef.current = false;
                  lastAnnouncedInstruction.current = null;
                  
                  const finishCheckpoint = checkpoints.find(c => c.type === 'finish');
                  if (finishCheckpoint) {
                    const courseId = `${checkpoint.id}_${finishCheckpoint.id}`;
                    const bestRun = getBestRunForCourse(courseId);
                    if (bestRun && bestRun.ghostPath && ghostEnabled) {
                      console.log('Loading ghost from best lap:', bestRun.duration, 'ms');
                      setActiveGhostPath(bestRun.ghostPath);
                    } else {
                      setActiveGhostPath([]);
                    }
                  }
                  
                  if (voiceMode !== 'off' && Platform.OS !== 'web' && navigationVolume > 0) {
                    const message = 'Start';
                    console.log('Announcing start via Bluetooth/speaker');
                    
                    try {
                      Speech.speak(message, {
                        language: 'en',
                        pitch: 1.0,
                        rate: 0.9,
                        volume: navigationVolume / 100,
                      });
                    } catch (error) {
                      console.error('Error speaking start message:', error);
                    }
                  }
                } else if (checkpoint.type === 'finish' && isTimerActive && passedStartCheckpoint && !hasAnnouncedFinishRef.current && !hasLeftFinishPointRef.current) {
                  console.log('Reached finish checkpoint - stopping navigation');
                  hasAnnouncedFinishRef.current = true;
                  hasLeftFinishPointRef.current = false;
                  
                  const courseId = `${passedStartCheckpoint.id}_${checkpoint.id}`;
                  const finalElapsedTime = Date.now() - (startTime || Date.now());
                  
                  (async () => {
                    try {
                      await Speech.stop();
                      console.log('Navigation stopped');
                    } catch (error) {
                      console.error('Error stopping navigation:', error);
                    }
                  })();
                  
                  if (voiceMode !== 'off' && Platform.OS !== 'web' && navigationVolume > 0) {
                    const message = 'Finish';
                    console.log('Announcing finish via Bluetooth/speaker');
                    
                    try {
                      Speech.speak(message, {
                        language: 'en',
                        pitch: 1.1,
                        rate: 0.8,
                        volume: navigationVolume / 100,
                      });
                    } catch (error) {
                      console.error('Error speaking finish message:', error);
                    }
                  }
                  stopTimer(passedStartCheckpoint, checkpoint);
                  setPassedStartCheckpoint(null);
                  hasAnnouncedStartRef.current = false;
                  lastAnnouncedInstruction.current = null;
                  setNextInstruction(null);
                  setCurrentGhostPosition(null);
                  setActiveGhostPath([]);
                  announcedCameraDistances.current.clear();
                  
                  setFinishModalTime(finalElapsedTime);
                  setShowFinishModal(true);
                  
                  if (currentPartyId) {
                    setCompletedCourseId(courseId);
                    setTimeout(() => {
                      setShowPartyResults(true);
                    }, 1000);
                  }
                }
              } else {
                if (checkpoint.type === 'start' && hasAnnouncedStartRef.current && !isTimerActive) {
                  hasAnnouncedStartRef.current = false;
                }
              }
            });

            if (isTimerActive && passedStartCheckpoint && newLocation.heading !== null && !hasAnnouncedFinishRef.current) {
              const finishCheckpoint = memoizedCheckpoints.find(c => c.type === 'finish');
              
              if (finishCheckpoint) {
                const distanceToFinish = calculateDistance(
                  newLocation.latitude,
                  newLocation.longitude,
                  finishCheckpoint.latitude,
                  finishCheckpoint.longitude
                );

                const bearingToFinish = calculateBearing(
                  newLocation.latitude,
                  newLocation.longitude,
                  finishCheckpoint.latitude,
                  finishCheckpoint.longitude
                );

                const isRally = voiceMode === 'rally';
                const segments = analyzeRoadAhead(
                  newLocation.latitude,
                  newLocation.longitude,
                  finishCheckpoint.latitude,
                  finishCheckpoint.longitude,
                  isRally
                );
                roadSegmentsRef.current = segments;

                const upcomingTurns = detectUpcomingTurns(segments, newLocation.heading, isRally);

                const instruction = generateNavigationInstruction(
                  newLocation.heading,
                  bearingToFinish,
                  distanceToFinish,
                  upcomingTurns
                );

                setNextInstruction(instruction);

                const instructionKey = generateInstructionKey(instruction);
                
                if (
                  voiceMode !== 'off' &&
                  Platform.OS !== 'web' &&
                  navigationVolume > 0 &&
                  instructionKey !== lastAnnouncedInstruction.current
                ) {
                  announceNavigation(instruction, voiceMode);
                  lastAnnouncedInstruction.current = instructionKey;
                }
              }
            }
          }
        );
      } catch (error) {
        console.error('Error watching location:', error);
      }
    };

    if (hasLocationPermission) {
      startTracking();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLocationPermission, memoizedCheckpoints, memoizedSpeedCameras, isTimerActive, isRouteConfirmed, passedStartCheckpoint, voiceMode, currentPartyId, ghostEnabled, activeGhostPath.length, recordSpeed, recordGhostPoint, startTimer, stopTimer, currentUserId, currentUserName, getBestRunForCourse, mapOrientation, autoZoom, batterySaver, highAccuracyGPS, viewingHistoricalRun, navigationVolume]);

  useEffect(() => {
    if (isTimerActive && startTime) {
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setElapsedTime(elapsed);
        
        if (activeGhostPath.length > 0 && ghostEnabled) {
          const lastPoint = activeGhostPath[activeGhostPath.length - 1];
          const firstPoint = activeGhostPath[0];
          if (!lastPoint || !firstPoint) return;
          
          const totalGhostTime = lastPoint.timestamp - firstPoint.timestamp || 1;
          const progressRatio = elapsed / totalGhostTime;
          
          const targetIndex = Math.floor(progressRatio * (activeGhostPath.length - 1));
          const clampedIndex = Math.max(0, Math.min(activeGhostPath.length - 1, targetIndex));
          
          if (clampedIndex < activeGhostPath.length) {
            const nextIndex = Math.min(clampedIndex + 1, activeGhostPath.length - 1);
            const t = (progressRatio * (activeGhostPath.length - 1)) - clampedIndex;
            
            const current = activeGhostPath[clampedIndex];
            const next = activeGhostPath[nextIndex];
            
            const interpolated = {
              latitude: current.latitude + (next.latitude - current.latitude) * t,
              longitude: current.longitude + (next.longitude - current.longitude) * t,
            };
            
            setCurrentGhostPosition(interpolated);
          }
        }
      }, 100);
      return () => clearInterval(interval);
    } else {
      setElapsedTime(0);
    }
  }, [isTimerActive, startTime, activeGhostPath, ghostEnabled]);

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        RNAnimated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const requestLocationPermission = async () => {
    try {
      console.log('Requesting location permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('Location permission status:', status);
      setHasLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        await detectUserLocation();
      } else {
        console.warn('Location permission not granted');
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setHasLocationPermission(false);
    }
  };

  const detectUserLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const results = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      if (results.length > 0) {
        const result = results[0];
        const rawCountryCode = result.isoCountryCode || null;
        const countryCode = rawCountryCode ? rawCountryCode.toUpperCase() : null;
        const country = result.country || null;
        
        const speedUnit: SpeedUnit = countryCode && MPH_COUNTRIES.includes(countryCode)
          ? 'mph'
          : 'kmh';
        
        console.log('Detected country:', country, countryCode, 'Speed unit:', speedUnit);
        
        updateLocationInfo({
          country,
          countryCode,
          speedUnit,
        });
      }

      await getRoadName(location.coords.latitude, location.coords.longitude);
    } catch (error) {
      console.error('Error detecting user location:', error);
    }
  };

  const getRoadName = async (latitude: number, longitude: number) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastRoadUpdateTime.current;
    
    if (timeSinceLastUpdate < ROAD_NAME_UPDATE_INTERVAL) {
      return;
    }
    
    if (lastRoadUpdateLocation.current) {
      const distance = calculateDistance(
        lastRoadUpdateLocation.current.latitude,
        lastRoadUpdateLocation.current.longitude,
        latitude,
        longitude
      );
      
      if (distance < ROAD_NAME_MIN_DISTANCE) {
        return;
      }
    }
    
    try {
      lastRoadUpdateTime.current = now;
      lastRoadUpdateLocation.current = { latitude, longitude };
      
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const result = results[0];
        const road = getDisplayRoadName(result);
        setCurrentRoad(road);
      }
    } catch (error) {
      console.error('Error getting road name:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('rate limit')) {
        console.log('Rate limit exceeded, will retry in', ROAD_NAME_UPDATE_INTERVAL / 1000, 'seconds');
      } else {
        setCurrentRoad('Unknown Road');
      }
    }
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const calculateBearing = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);

    return ((θ * 180) / Math.PI + 360) % 360;
  };

  const analyzeRoadAhead = useCallback((currentLat: number, currentLon: number, targetLat: number, targetLon: number, isRally: boolean = false): RoadSegment[] => {
    const segments: RoadSegment[] = [];
    const totalDistance = calculateDistance(currentLat, currentLon, targetLat, targetLon);
    
    if (totalDistance < 10) return segments;
    
    const lookaheadDistance = isRally ? RALLY_LOOKAHEAD_DISTANCE : ROAD_LOOKAHEAD_DISTANCE;
    const analysisDistance = Math.min(totalDistance, lookaheadDistance);
    const numSegments = Math.min(Math.floor(analysisDistance / ROAD_ANALYSIS_STEP), isRally ? 48 : 32);
    
    for (let i = 1; i <= numSegments; i++) {
      const fraction = (i / numSegments) * (analysisDistance / totalDistance);
      const segmentLat = currentLat + (targetLat - currentLat) * fraction;
      const segmentLon = currentLon + (targetLon - currentLon) * fraction;
      
      let bearing = 0;
      if (i > 0 && segments.length > 0) {
        const prevSegment = segments[segments.length - 1];
        bearing = calculateBearing(prevSegment.latitude, prevSegment.longitude, segmentLat, segmentLon);
      } else {
        bearing = calculateBearing(currentLat, currentLon, segmentLat, segmentLon);
      }
      
      const distanceFromStart = calculateDistance(currentLat, currentLon, segmentLat, segmentLon);
      
      segments.push({
        latitude: segmentLat,
        longitude: segmentLon,
        bearing,
        distanceFromStart,
      });
    }
    
    return segments;
  }, []);

  const detectUpcomingTurns = useCallback((segments: RoadSegment[], currentHeading: number, isRally: boolean = false): UpcomingTurn[] => {
    const turns: UpcomingTurn[] = [];
    
    if (segments.length < 2) return turns;
    
    const threshold = isRally ? RALLY_TURN_DETECTION_THRESHOLD : TURN_DETECTION_THRESHOLD;
    
    for (let i = 1; i < segments.length; i++) {
      const prevBearing = i === 1 ? currentHeading : segments[i - 1].bearing;
      const currentBearing = segments[i].bearing;
      
      let angleDiff = currentBearing - prevBearing;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;
      
      const absAngle = Math.abs(angleDiff);
      
      if (absAngle > threshold) {
        const direction = angleDiff < 0 ? 'left' : 'right';
        
        let severity = 6;
        if (absAngle >= 150) severity = 1;
        else if (absAngle >= 120) severity = 2;
        else if (absAngle >= 90) severity = 3;
        else if (absAngle >= 60) severity = 4;
        else if (absAngle >= 30) severity = 5;
        
        const distance = segments[i].distanceFromStart;
        
        let description = '';
        if (absAngle >= 150) {
          description = `Sharp ${direction} in ${Math.round(distance)} meters`;
        } else if (absAngle >= 90) {
          description = `${direction.charAt(0).toUpperCase() + direction.slice(1)} turn in ${Math.round(distance)} meters`;
        } else {
          description = `Bear ${direction} in ${Math.round(distance)} meters`;
        }
        
        turns.push({
          type: direction,
          severity,
          distance,
          angle: absAngle,
          description,
        });
      }
    }
    
    return turns;
  }, []);

  const convertDistanceToYards = (meters: number): number => {
    return Math.round(meters * 1.09361);
  };

  const generateRallyPacenote = (
    severity: number,
    direction: 'left' | 'right',
    absAngle: number,
    distance: number,
    currentSpeed: number,
    upcomingTurns?: UpcomingTurn[]
  ): RallyPacenote => {
    const pacenote: RallyPacenote = {
      severity,
      direction,
    };

    if (absAngle >= 150) {
      pacenote.cornerType = 'hairpin';
    } else if (absAngle >= 85 && absAngle <= 95) {
      pacenote.cornerType = 'square';
    } else if (absAngle > 95) {
      pacenote.cornerType = 'acute';
    } else if (absAngle < 18) {
      pacenote.cornerType = 'kink';
    }

    if (severity === 6 && absAngle < 25) {
      if (currentSpeed > 90) {
        pacenote.cornerType = 'flat';
      } else if (currentSpeed > 70) {
        pacenote.cornerType = 'ballistic';
      }
    }

    const modifiers: RallyModifier[] = [];
    const crests: RallyCrest[] = [];
    const warnings: RallyWarning[] = [];

    if (distance > 200 && distance < 400) {
      modifiers.push('long');
    } else if (distance > 400) {
      modifiers.push('very-long');
    } else if (distance < 50) {
      modifiers.push('short');
    } else if (distance < 30) {
      modifiers.push('very-short');
    }

    if (currentSpeed > 85 && severity <= 3) {
      warnings.push('dont-cut');
    } else if (currentSpeed > 100 && severity <= 4) {
      warnings.push('care');
    }

    const crestChance = severity <= 3 ? 0.25 : 0.15;
    if (Math.random() < crestChance) {
      const crestOptions: RallyCrest[] = ['crest', 'small-crest', 'brow', 'dip'];
      crests.push(crestOptions[Math.floor(Math.random() * crestOptions.length)]);
      
      if ((crests.includes('crest') || crests.includes('small-crest')) && severity <= 3) {
        modifiers.push('tightens-over-crest');
      }
    }

    if (upcomingTurns && upcomingTurns.length > 1) {
      const nextTurn = upcomingTurns[1];
      const distanceToNext = nextTurn.distance - distance;
      if (distanceToNext < 100 && distanceToNext > 0) {
        pacenote.distanceToNext = Math.round(distanceToNext);
        if (nextTurn.severity < severity) {
          modifiers.push('tightens-into');
        } else if (nextTurn.severity > severity) {
          modifiers.push('opens');
        }
      }
    }

    if (severity <= 3 && !modifiers.includes('tightens-over-crest') && !modifiers.includes('tightens-into')) {
      if (Math.random() > 0.65) {
        modifiers.push('tightens');
      }
    } else if (severity >= 5 && modifiers.length === 0) {
      if (Math.random() > 0.7) {
        modifiers.push('opens-long');
      }
    }

    if (severity <= 2 && Math.random() > 0.8) {
      warnings.push('caution');
    }

    if (modifiers.length > 0) pacenote.modifier = modifiers[0];
    if (crests.length > 0) pacenote.crest = crests[0];
    if (warnings.length > 0) pacenote.warning = warnings[0];
    
    pacenote.distance = Math.round(distance);

    return pacenote;
  };

  const generateNavigationInstruction = (
    currentHeading: number,
    targetBearing: number,
    distance: number,
    upcomingTurns?: UpcomingTurn[]
  ): NavigationInstruction => {
    let angleDiff = targetBearing - currentHeading;
    
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;

    const absAngle = Math.abs(angleDiff);

    if (absAngle < 10) {
      return {
        type: 'straight',
        distance,
        heading: currentHeading,
      };
    }

    const direction: 'left' | 'right' = angleDiff < 0 ? 'left' : 'right';
    
    let severity = 1;
    if (absAngle >= 150) severity = 1;
    else if (absAngle >= 120) severity = 2;
    else if (absAngle >= 90) severity = 3;
    else if (absAngle >= 60) severity = 4;
    else if (absAngle >= 30) severity = 5;
    else severity = 6;

    const rallyPacenote = generateRallyPacenote(
      severity,
      direction,
      absAngle,
      distance,
      currentSpeed,
      upcomingTurns
    );

    let nextTurnDescription = '';
    if (upcomingTurns && upcomingTurns.length > 0) {
      const nextTurn = upcomingTurns[0];
      if (nextTurn.distance < ROAD_LOOKAHEAD_DISTANCE) {
        const useYards = locationInfo.speedUnit === 'mph';
        const distanceValue = useYards ? convertDistanceToYards(nextTurn.distance) : Math.round(nextTurn.distance);
        const distanceUnit = useYards ? 'yards' : 'meters';
        
        if (nextTurn.angle >= 150) {
          nextTurnDescription = `Take the next ${nextTurn.type} in ${distanceValue} ${distanceUnit}`;
        } else if (nextTurn.angle >= 90) {
          nextTurnDescription = `Turn ${nextTurn.type} in ${distanceValue} ${distanceUnit}`;
        } else {
          nextTurnDescription = `Bear ${nextTurn.type} in ${distanceValue} ${distanceUnit}`;
        }
      }
    }

    return {
      type: 'turn',
      direction,
      severity,
      distance,
      heading: currentHeading,
      rallyPacenote,
      upcomingTurns,
      nextTurnDescription,
    };
  };

  const buildRallyPacenoteMessage = (pacenote: RallyPacenote, nextPacenote?: RallyPacenote): string => {
    const parts: string[] = [];

    if (pacenote.distance && pacenote.distance > 60) {
      parts.push(`${pacenote.distance}`);
    }

    if (pacenote.crest === 'crest') {
      parts.push('crest');
    } else if (pacenote.crest === 'small-crest') {
      parts.push('small crest');
    } else if (pacenote.crest === 'big-crest') {
      parts.push('big crest');
    } else if (pacenote.crest === 'flat-crest') {
      parts.push('flat crest');
    } else if (pacenote.crest === 'jump') {
      parts.push('jump');
    } else if (pacenote.crest === 'jump-maybe') {
      parts.push('jump maybe');
    } else if (pacenote.crest === 'brow') {
      parts.push('brow');
    } else if (pacenote.crest === 'bump') {
      parts.push('bump');
    } else if (pacenote.crest === 'dip') {
      parts.push('dip');
    }

    if (pacenote.warning === 'caution') {
      parts.push('caution');
    } else if (pacenote.warning === 'danger') {
      parts.push('danger');
    } else if (pacenote.warning === 'double-danger') {
      parts.push('double danger');
    } else if (pacenote.warning === 'care') {
      parts.push('care');
    }

    if (pacenote.cornerType === 'hairpin') {
      parts.push('hairpin');
    } else if (pacenote.cornerType === 'square') {
      parts.push('square');
    } else if (pacenote.cornerType === 'acute') {
      parts.push('acute');
    } else if (pacenote.cornerType === 'kink') {
      parts.push('kink');
    } else if (pacenote.cornerType === 'chicane') {
      parts.push('chicane');
    } else if (pacenote.cornerType === 'flat') {
      parts.push('flat');
    } else if (pacenote.cornerType === 'ballistic') {
      parts.push('ballistic');
    } else if (pacenote.cornerType === 'absolute') {
      parts.push('absolute');
    }

    parts.push(`${pacenote.severity} ${pacenote.direction}`);

    if (pacenote.modifier === 'plus') {
      parts.push('plus');
    } else if (pacenote.modifier === 'minus') {
      parts.push('minus');
    } else if (pacenote.modifier === 'tightens') {
      parts.push('tightens');
    } else if (pacenote.modifier === 'opens') {
      parts.push('opens');
    } else if (pacenote.modifier === 'long') {
      parts.push('long');
    } else if (pacenote.modifier === 'short') {
      parts.push('short');
    } else if (pacenote.modifier === 'very-long') {
      parts.push('very long');
    } else if (pacenote.modifier === 'very-short') {
      parts.push('very short');
    } else if (pacenote.modifier === 'tightens-over-crest') {
      parts.push('tightens over crest');
    } else if (pacenote.modifier === 'tightens-into') {
      parts.push('tightens into');
    } else if (pacenote.modifier === 'opens-long') {
      parts.push('opens long');
    }

    if (pacenote.warning === 'dont-cut') {
      parts.push("don't cut");
    } else if (pacenote.warning === 'cut') {
      parts.push('cut');
    } else if (pacenote.warning === 'small-cut') {
      parts.push('small cut');
    } else if (pacenote.warning === 'big-cut') {
      parts.push('big cut');
    } else if (pacenote.warning === 'slippy') {
      parts.push('slippy');
    } else if (pacenote.warning === 'rough') {
      parts.push('rough');
    } else if (pacenote.warning === 'very-rough') {
      parts.push('very rough');
    } else if (pacenote.warning === 'narrow') {
      parts.push('narrow');
    } else if (pacenote.warning === 'very-narrow') {
      parts.push('very narrow');
    }

    if (nextPacenote && pacenote.distanceToNext && pacenote.distanceToNext < 100) {
      parts.push(`into ${nextPacenote.severity} ${nextPacenote.direction}`);
    }

    return parts.join(', ');
  };

  const generateInstructionKey = (instruction: NavigationInstruction): string => {
    if (instruction.type === 'straight') {
      return 'straight';
    }
    
    if (instruction.nextTurnDescription) {
      return instruction.nextTurnDescription;
    }
    
    if (instruction.type === 'turn' && instruction.direction) {
      const roundedDistance = Math.round(instruction.distance / 50) * 50;
      return `${instruction.direction}_${instruction.severity}_${roundedDistance}`;
    }
    
    return 'unknown';
  };

  const announceNavigation = async (instruction: NavigationInstruction, mode: 'normal' | 'rally') => {
    let message = '';

    if (mode === 'rally') {
      if (instruction.type === 'straight') {
        if (instruction.distance > 500) {
          message = 'flat out, long straight';
        } else if (instruction.distance > 200) {
          message = 'keep in it';
        } else {
          const straightMessages = [
            'flat',
            'stay middle',
            'full commit',
          ];
          message = straightMessages[Math.floor(Math.random() * straightMessages.length)];
        }
      } else if (instruction.type === 'turn' && instruction.rallyPacenote) {
        const nextPacenote = instruction.upcomingTurns && instruction.upcomingTurns.length > 1 
          ? generateRallyPacenote(
              instruction.upcomingTurns[1].severity,
              instruction.upcomingTurns[1].type as 'left' | 'right',
              instruction.upcomingTurns[1].angle,
              instruction.upcomingTurns[1].distance,
              currentSpeed
            )
          : undefined;
        
        message = buildRallyPacenoteMessage(instruction.rallyPacenote, nextPacenote);
      }
    } else {
      if (instruction.nextTurnDescription) {
        message = instruction.nextTurnDescription;
      } else if (instruction.type === 'straight') {
        if (instruction.distance > 500) {
          const useYards = locationInfo.speedUnit === 'mph';
          const distanceValue = useYards ? convertDistanceToYards(instruction.distance) : Math.round(instruction.distance);
          const distanceUnit = useYards ? 'yards' : 'meters';
          message = `Continue straight for ${distanceValue} ${distanceUnit}`;
        } else {
          message = 'Continue straight ahead';
        }
      } else if (instruction.type === 'turn' && instruction.direction) {
        const dir = instruction.direction;
        const useYards = locationInfo.speedUnit === 'mph';
        const distanceValue = useYards ? convertDistanceToYards(instruction.distance) : Math.round(instruction.distance);
        const distanceUnit = useYards ? 'yards' : 'meters';
        const distanceText = instruction.distance < 100 
          ? 'ahead' 
          : `in ${distanceValue} ${distanceUnit}`;
        
        message = `Turn ${dir} ${distanceText}`;
      }
    }

    if (message && navigationVolume > 0) {
      console.log('Navigation via Bluetooth/speaker:', message);
      try {
        await Speech.stop();
        
        Speech.speak(message, {
          language: 'en',
          pitch: mode === 'rally' ? 1.1 : 1.0,
          rate: mode === 'rally' ? 1.25 : 0.9,
          volume: navigationVolume / 100,
        });
      } catch (error) {
        console.error('Error speaking navigation:', error);
      }
    }
  };

  const checkSpeedCameras = (currentLocation: LocationData) => {
    // Always check for speed cameras, not just when timer is active
    let closestApproachingCamera: { camera: SpeedCamera; distance: number } | null = null;
    let minDistance = Infinity;

    memoizedSpeedCameras.forEach((camera) => {
      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        camera.latitude,
        camera.longitude
      );

      if (distance <= SPEED_CAMERA_WARNING_DISTANCE) {
        // Check if user is moving towards the camera
        const isApproaching = currentLocation.heading !== null && 
          isApproachingCamera(
            currentLocation.latitude,
            currentLocation.longitude,
            currentLocation.heading,
            camera.latitude,
            camera.longitude,
            90 // Increased tolerance for curves and intersections
          );
        
        // Also check if user is on the same road (speed > 5 km/h indicates movement)
        const isMovingTowardsCamera = (currentLocation.speed || 0) > 5 && isApproaching;
        
        if (isMovingTowardsCamera && distance < minDistance) {
          minDistance = distance;
          closestApproachingCamera = { camera, distance };
        }

        // Enhanced announcement logic with more distance checkpoints
        if (isTimerActive && isMovingTowardsCamera) {
          if (!announcedCameraDistances.current.has(camera.id)) {
            announcedCameraDistances.current.set(camera.id, new Set());
          }
          
          const announcedDistances = announcedCameraDistances.current.get(camera.id)!;
          
          // More granular distance announcements
          if (distance <= 500 && distance > 400 && !announcedDistances.has(500)) {
            announceSpeedCamera(camera, 500);
            announcedDistances.add(500);
          } else if (distance <= 400 && distance > 300 && !announcedDistances.has(400)) {
            announceSpeedCamera(camera, 400);
            announcedDistances.add(400);
          } else if (distance <= 300 && distance > 200 && !announcedDistances.has(300)) {
            announceSpeedCamera(camera, 300);
            announcedDistances.add(300);
          } else if (distance <= 200 && distance > 100 && !announcedDistances.has(200)) {
            announceSpeedCamera(camera, 200);
            announcedDistances.add(200);
          } else if (distance <= 100 && distance > 50 && !announcedDistances.has(100)) {
            announceSpeedCamera(camera, 100);
            announcedDistances.add(100);
          } else if (distance <= 50 && !announcedDistances.has(50)) {
            announceSpeedCamera(camera, 50);
            announcedDistances.add(50);
          }
        }
      } else {
        // Clear announced distances when out of range
        announcedCameraDistances.current.delete(camera.id);
      }
    });

    setNearbySpeedCamera(closestApproachingCamera);
  };

  const announceSpeedCamera = async (camera: SpeedCamera, distance: number) => {
    if (voiceMode === 'off' || Platform.OS === 'web' || !isTimerActive || navigationVolume === 0) return;

    let message = '';

    if (voiceMode === 'rally') {
      message = `Caution, speed camera ${distance} meters`;
    } else {
      message = `Speed camera ahead in ${distance} meters`;
    }

    console.log('Speed camera warning via Bluetooth/speaker:', message);
    try {
      await Speech.stop();
      
      Speech.speak(message, {
        language: 'en',
        pitch: voiceMode === 'rally' ? 1.05 : 1.0,
        rate: voiceMode === 'rally' ? 1.1 : 0.85,
        volume: navigationVolume / 100,
      });
    } catch (error) {
      console.error('Error speaking speed camera warning:', error);
    }
  };

  const snapToNearestRoad = async (latitude: number, longitude: number): Promise<{ latitude: number; longitude: number; roadName?: string | null } | null> => {
    try {
      console.log('Validating location:', latitude, longitude);
      
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      
      if (results.length === 0) {
        console.log('No geocoding results found - trying to snap to nearest road');
        return await trySnapToNearestRoad(latitude, longitude);
      }

      const result = results[0];
      console.log('Geocoding result:', {
        street: result.street,
        name: result.name,
        district: result.district,
        city: result.city,
        region: result.region,
      });
      
      const sanitizedStreet = sanitizeRoadLabel(result.street);
      const sanitizedName = sanitizeRoadLabel(result.name);
      const roadName = sanitizedStreet ?? sanitizedName ?? null;
      const raceTrackLabel = sanitizedName ?? sanitizedStreet ?? '';
      const lowerTrackLabel = raceTrackLabel.toLowerCase();
      
      const isRaceTrack = lowerTrackLabel.includes('circuit') ||
        lowerTrackLabel.includes('track') ||
        lowerTrackLabel.includes('speedway') ||
        lowerTrackLabel.includes('raceway') ||
        lowerTrackLabel.includes('autodrom') ||
        lowerTrackLabel.includes('motorsport') ||
        lowerTrackLabel.includes('racetrack') ||
        lowerTrackLabel.includes('race track');
      
      const hasStreet = Boolean(roadName);
      
      if (!hasStreet && !isRaceTrack) {
        console.log('Location not on a road or race track - trying to snap to nearest road');
        return await trySnapToNearestRoad(latitude, longitude);
      }
      
      const resolvedRoadName = (roadName ?? raceTrackLabel) || 'Unknown Road';
      console.log('✓ Valid road/track location:', resolvedRoadName);
      
      return {
        latitude,
        longitude,
        roadName: resolvedRoadName,
      };
    } catch (error) {
      console.error('Error validating location:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('rate limit')) {
        Alert.alert(
          'Too Many Requests',
          'Please wait a moment before placing another checkpoint. The geocoding service needs a short break.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Validation Error',
          'Unable to validate this location. Please try again or choose a different spot.',
          [{ text: 'OK' }]
        );
      }
      
      return null;
    }
  };

  const trySnapToNearestRoad = async (latitude: number, longitude: number): Promise<{ latitude: number; longitude: number; roadName?: string | null } | null> => {
    console.log('Attempting to snap to nearest road...');
    
    const searchRadii = [0.001, 0.002, 0.005, 0.01];
    const directions = [
      { lat: 0, lon: 1 },
      { lat: 0, lon: -1 },
      { lat: 1, lon: 0 },
      { lat: -1, lon: 0 },
      { lat: 0.707, lon: 0.707 },
      { lat: -0.707, lon: 0.707 },
      { lat: 0.707, lon: -0.707 },
      { lat: -0.707, lon: -0.707 },
    ];
    
    for (const radius of searchRadii) {
      console.log(`Searching for roads within ${radius} degree radius...`);
      
      for (const dir of directions) {
        const testLat = latitude + (dir.lat * radius);
        const testLon = longitude + (dir.lon * radius);
        
        try {
          const testResults = await Location.reverseGeocodeAsync({ 
            latitude: testLat, 
            longitude: testLon 
          });
          
          if (testResults.length === 0) continue;
          
          const testResult = testResults[0];
          const sanitizedStreet = sanitizeRoadLabel(testResult.street);
          const sanitizedName = sanitizeRoadLabel(testResult.name);
          const roadName = sanitizedStreet ?? sanitizedName ?? null;
          const raceTrackLabel = sanitizedName ?? sanitizedStreet ?? '';
          const lowerTrackLabel = raceTrackLabel.toLowerCase();
          
          const isRaceTrack = lowerTrackLabel.includes('circuit') ||
            lowerTrackLabel.includes('track') ||
            lowerTrackLabel.includes('speedway') ||
            lowerTrackLabel.includes('raceway') ||
            lowerTrackLabel.includes('autodrom') ||
            lowerTrackLabel.includes('motorsport') ||
            lowerTrackLabel.includes('racetrack') ||
            lowerTrackLabel.includes('race track');
          
          const hasStreet = Boolean(roadName);
          
          if (hasStreet || isRaceTrack) {
            const resolvedRoadName = (roadName ?? raceTrackLabel) || 'Unknown Road';
            const distanceMeters = calculateDistance(latitude, longitude, testLat, testLon);
            console.log(`✓ Snapped to nearest road: ${resolvedRoadName} (${Math.round(distanceMeters)}m away)`);
            
            Alert.alert(
              'Point Adjusted',
              `The point was automatically placed on the nearest road: ${resolvedRoadName} (${Math.round(distanceMeters)}m away)`,
              [{ text: 'OK' }]
            );
            
            return {
              latitude: testLat,
              longitude: testLon,
              roadName: resolvedRoadName,
            };
          }
        } catch {
          continue;
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log('Unable to find nearby road');
    Alert.alert(
      'No Road Found',
      'Unable to find a nearby road or race track. Please try placing the point on a visible road on the map.',
      [{ text: 'OK' }]
    );
    return null;
  };

  const handleMapPress = useCallback(async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    if (isAddingCheckpoint) {
      const snappedLocation = await snapToNearestRoad(latitude, longitude);
      
      if (snappedLocation) {
        const intermediateCount = checkpoints.filter(c => c.type === 'checkpoint').length;
        const newCheckpoint: Checkpoint = {
          id: `checkpoint_${Date.now()}`,
          type: isAddingCheckpoint,
          latitude: snappedLocation.latitude,
          longitude: snappedLocation.longitude,
          name: isAddingCheckpoint === 'start' 
            ? 'Start' 
            : isAddingCheckpoint === 'finish' 
            ? 'Finish' 
            : `Checkpoint ${intermediateCount + 1}`,
          order: isAddingCheckpoint === 'checkpoint' ? intermediateCount : undefined,
        };

        addCheckpoint(newCheckpoint);
        setIsAddingCheckpoint(null);
        console.log('Added checkpoint:', newCheckpoint);
      }
    } else if (isAddingSpeedCamera) {
      const newCamera: SpeedCamera = {
        id: `camera_${Date.now()}`,
        type: 'fixed',
        latitude,
        longitude,
        name: 'Speed Camera',
      };

      addSpeedCamera(newCamera);
      setIsAddingSpeedCamera(false);
      console.log('Added speed camera:', newCamera);
    }
  }, [isAddingCheckpoint, isAddingSpeedCamera, checkpoints, addCheckpoint, addSpeedCamera, snapToNearestRoad]);

  const centerOnUser = useCallback(() => {
    if (location && mapRef.current) {
      console.log('Re-centering map on user');
      hasUserInteracted.current = false;
      const heading = location.heading ?? lastHeadingRef.current ?? 0;
      const cameraHeading = mapOrientation === 'heading-up' ? heading : 0;
      mapRef.current.animateCamera({
        center: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        pitch: 0,
        heading: cameraHeading,
        altitude: 1000,
        zoom: 18,
      }, { duration: 500 });
    }
  }, [location, mapOrientation]);



  const handleMapTouchStart = useCallback(() => {
    if (!isAddingCheckpoint && !isAddingSpeedCamera && !viewingHistoricalRun) {
      console.log('User panned map - stopping auto-follow');
      hasUserInteracted.current = true;
    }
  }, [isAddingCheckpoint, isAddingSpeedCamera, viewingHistoricalRun]);





  const handleClearCheckpoints = () => {
    if (checkpoints.length === 0) return;
    
    Alert.alert(
      'Clear Checkpoints',
      'Are you sure you want to remove all checkpoints?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => {
          clearCheckpoints();
          setIsRouteConfirmed(false);
        } },
      ]
    );
  };

  const handleStartRun = () => {
    setIsRouteConfirmed(true);
    centerOnUser();
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const getVoiceModeIcon = () => {
    if (voiceMode === 'off') return <VolumeOff size={24} color="#fff" />;
    if (voiceMode === 'rally') return <Navigation size={24} color="#fff" />;
    return <Volume2 size={24} color="#fff" />;
  };

  const getVoiceModeColor = () => {
    if (voiceMode === 'off') return 'rgba(142, 142, 147, 0.95)';
    if (voiceMode === 'rally') return 'rgba(255, 149, 0, 0.95)';
    return 'rgba(52, 199, 89, 0.95)';
  };

  if (!hasLocationPermission) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <MapPin size={48} color="#FF3B30" />
        <Text style={styles.permissionText}>Location permission required</Text>
        <Text style={styles.permissionSubtext}>
          Precise GPS, heading, and speed data let us draw your current road,
          warn about upcoming hazards, and calculate lap timing.
        </Text>
        <Text style={styles.permissionSubtext}>
          Example: we collect your live latitude/longitude to show the road name in
          the top right corner and, if you opt into tracking consent, to share a
          ghost replay with your party leaderboard.
        </Text>
        <Text style={styles.permissionSubtext}>
          Enable location and App Tracking Transparency in system settings to
          continue.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <MapView
        key={`map-${mapType}-${isDarkMode ? 'dark' : 'light'}`}
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        followsUserLocation={false}
        rotateEnabled={true}
        pitchEnabled={false}
        showsTraffic={showTraffic && !isTimerActive}
        mapType={mapType}
        customMapStyle={mapThemeStyle}
        initialCamera={
          location
            ? {
                center: {
                  latitude: location.latitude,
                  longitude: location.longitude,
                },
                pitch: 0,
                heading: location.heading ?? 0,
                altitude: 1000,
                zoom: 18,
              }
            : undefined
        }
        onPress={handleMapPress}
        onTouchStart={handleMapTouchStart}
      >
        {!isTimerActive && !viewingHistoricalRun && !isRouteConfirmed && routeOptions.map((route) => {
          const isSelected = route.id === selectedRouteId;
          const isFastest = route.id === routeOptions[0]?.id;
          
          return (
            <Polyline
              key={route.id}
              coordinates={route.coordinates}
              strokeColor={
                isSelected
                  ? 'rgba(0, 122, 255, 1)'
                  : isFastest
                  ? 'rgba(0, 122, 255, 0.75)'
                  : 'rgba(0, 122, 255, 0.4)'
              }
              strokeWidth={isSelected ? 8 : isFastest ? 7 : 6}
              tappable={true}
              onPress={() => {
                console.log('Selected route:', route.id, 'Duration:', route.duration, 'Distance:', route.distance);
                setSelectedRouteId(route.id);
              }}
            />
          );
        })}

        {isTimerActive && activeRunPath && activeRunPath.coordinates.length > 0 && (
          <>
            <Polyline
              coordinates={activeRunPath.coordinates}
              strokeColor="rgba(255, 255, 255, 0.5)"
              strokeWidth={10}
            />
            <Polyline
              coordinates={activeRunPath.coordinates}
              strokeColor="rgba(0, 122, 255, 1)"
              strokeWidth={6}
            />
          </>
        )}

        {isTimerActive && ghostEnabled && activeGhostPath.length > 0 && (
          <Polyline
            coordinates={activeGhostPath}
            strokeColor="rgba(147, 51, 234, 0.5)"
            strokeWidth={4}
            lineDashPattern={[10, 10]}
          />
        )}
        
        {viewingHistoricalRun && historicalRunPath.length > 0 && (
          <>
            <Polyline
              coordinates={historicalRunPath}
              strokeColor="rgba(255, 255, 255, 0.5)"
              strokeWidth={10}
            />
            <Polyline
              coordinates={historicalRunPath}
              strokeColor="rgba(0, 122, 255, 1)"
              strokeWidth={6}
            />
          </>
        )}
        
        {isTimerActive && ghostEnabled && currentGhostPosition && (
          <Marker
            coordinate={currentGhostPosition}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.ghostMarker}>
              <Ghost size={24} color="#9333EA" />
            </View>
          </Marker>
        )}

        {currentPartyId && partyMemberLocations.map((member, index) => {
          const colorIndex = index % MEMBER_COLORS.length;
          const color = MEMBER_COLORS[colorIndex];
          const initial = member.display_name.charAt(0).toUpperCase();
          
          return (
            <Marker
              key={member.user_id}
              coordinate={{
                latitude: member.latitude,
                longitude: member.longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.partyMemberMarker, { backgroundColor: color }]}>
                <Text style={styles.partyMemberInitial}>{initial}</Text>
              </View>
            </Marker>
          );
        })}
        {memoizedSpeedCameras.map((camera) => (
          <Marker
            key={camera.id}
            coordinate={{
              latitude: camera.latitude,
              longitude: camera.longitude,
            }}
            title={camera.name || 'Speed Camera'}
            onPress={() => {
              Alert.alert(
                camera.name || 'Speed Camera',
                camera.speedLimit
                  ? `Speed limit: ${camera.speedLimit} ${locationInfo.speedUnit}`
                  : 'No speed limit set',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => removeSpeedCamera(camera.id),
                  },
                ]
              );
            }}
          >
            <View style={[styles.cameraMarker, 
              camera.type === 'red-light' && { backgroundColor: '#FF3B30' },
              camera.type === 'average-speed' && { backgroundColor: '#FF9500' },
              camera.type === 'mobile' && { backgroundColor: '#FFCC00' }
            ]}>
              <Camera size={20} color="#fff" />
            </View>
          </Marker>
        ))}

        {viewingHistoricalRun && historicalStartCheckpoint && (
          <React.Fragment key={historicalStartCheckpoint.id}>
            <Marker
              coordinate={{
                latitude: historicalStartCheckpoint.latitude,
                longitude: historicalStartCheckpoint.longitude,
              }}
              title={historicalStartCheckpoint.name}
              pinColor="#34C759"
            />
            <Circle
              center={{
                latitude: historicalStartCheckpoint.latitude,
                longitude: historicalStartCheckpoint.longitude,
              }}
              radius={PROXIMITY_THRESHOLD}
              strokeColor="rgba(52, 199, 89, 0.3)"
              fillColor="rgba(52, 199, 89, 0.1)"
            />
          </React.Fragment>
        )}
        
        {viewingHistoricalRun && historicalFinishCheckpoint && (
          <React.Fragment key={historicalFinishCheckpoint.id}>
            <Marker
              coordinate={{
                latitude: historicalFinishCheckpoint.latitude,
                longitude: historicalFinishCheckpoint.longitude,
              }}
              title={historicalFinishCheckpoint.name}
              pinColor="#FF3B30"
            />
            <Circle
              center={{
                latitude: historicalFinishCheckpoint.latitude,
                longitude: historicalFinishCheckpoint.longitude,
              }}
              radius={PROXIMITY_THRESHOLD}
              strokeColor="rgba(255, 59, 48, 0.3)"
              fillColor="rgba(255, 59, 48, 0.1)"
            />
          </React.Fragment>
        )}

        {!viewingHistoricalRun && checkpoints.map((checkpoint) => (
          <React.Fragment key={checkpoint.id}>
            <Marker
              coordinate={{
                latitude: checkpoint.latitude,
                longitude: checkpoint.longitude,
              }}
              title={checkpoint.name}
              pinColor={
                checkpoint.type === 'start' 
                  ? '#34C759' 
                  : checkpoint.type === 'finish' 
                  ? '#FF3B30' 
                  : '#FF9500'
              }
              onPress={() => {
                Alert.alert(
                  checkpoint.name,
                  'Do you want to remove this checkpoint?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => removeCheckpoint(checkpoint.id),
                    },
                  ]
                );
              }}
            />
            <Circle
              center={{
                latitude: checkpoint.latitude,
                longitude: checkpoint.longitude,
              }}
              radius={PROXIMITY_THRESHOLD}
              strokeColor={
                checkpoint.type === 'start'
                  ? 'rgba(52, 199, 89, 0.3)'
                  : checkpoint.type === 'finish'
                  ? 'rgba(255, 59, 48, 0.3)'
                  : 'rgba(255, 149, 0, 0.3)'
              }
              fillColor={
                checkpoint.type === 'start'
                  ? 'rgba(52, 199, 89, 0.1)'
                  : checkpoint.type === 'finish'
                  ? 'rgba(255, 59, 48, 0.1)'
                  : 'rgba(255, 149, 0, 0.1)'
              }
            />
          </React.Fragment>
        ))}
      </MapView>

      <View style={[styles.topInfoContainer, !showSpeed && styles.roadOnlyContainer]}>
        {showSpeed && (
        <View style={styles.infoCard}>
          <Text style={styles.speedLabel}>SPEED</Text>
          <Text style={styles.speedValue}>
            {Math.round(
              locationInfo.speedUnit === 'mph'
                ? currentSpeed * KMH_TO_MPH
                : currentSpeed
            )}
          </Text>
          <Text style={styles.speedUnit}>
            {locationInfo.speedUnit === 'mph' ? 'mph' : 'km/h'}
          </Text>
        </View>
        )}
        
        <View style={styles.roadCard} testID="current-road-chip">
          <Text style={styles.roadLabel}>ROAD</Text>
          <Text style={styles.roadText} numberOfLines={1}>
            {currentRoad}
          </Text>
        </View>
      </View>

      {nearbySpeedCamera && (
        <View style={styles.speedCameraWarning}>
          <AlertTriangle size={24} color="#FF9500" />
          <View style={styles.speedCameraWarningContent}>
            <Text style={styles.speedCameraWarningTitle}>Speed Camera Ahead</Text>
            <Text style={styles.speedCameraWarningDistance}>
              {Math.round(nearbySpeedCamera.distance)}m away
              {nearbySpeedCamera.camera.speedLimit && 
                ` • Limit: ${Math.round(
                  locationInfo.speedUnit === 'mph'
                    ? nearbySpeedCamera.camera.speedLimit * KMH_TO_MPH
                    : nearbySpeedCamera.camera.speedLimit
                )} ${locationInfo.speedUnit}`
              }
            </Text>
          </View>
        </View>
      )}

      {isTimerActive && nextInstruction && (
        <View style={[styles.navigationCard, nearbySpeedCamera && { top: 220 }]}>
          <View style={styles.navigationContent}>
            {nextInstruction.nextTurnDescription ? (
              <View style={styles.navigationMain}>
                <Text style={styles.navigationText}>
                  {nextInstruction.upcomingTurns?.[0]?.type === 'left' ? '←' : nextInstruction.upcomingTurns?.[0]?.type === 'right' ? '→' : '↑'}
                </Text>
                <View style={styles.navigationTextContainer}>
                  <Text style={styles.navigationDescription}>
                    {nextInstruction.nextTurnDescription}
                  </Text>
                  {nextInstruction.upcomingTurns && nextInstruction.upcomingTurns.length > 1 && (
                    <Text style={styles.navigationSecondary}>
                      Then {nextInstruction.upcomingTurns[1].description}
                    </Text>
                  )}
                </View>
              </View>
            ) : nextInstruction.type === 'straight' ? (
              <Text style={styles.navigationText}>↑ Keep Straight</Text>
            ) : (
              <Text style={styles.navigationText}>
                {nextInstruction.direction === 'left' ? '←' : '→'} 
                {voiceMode === 'rally' 
                  ? ` ${nextInstruction.severity} ${nextInstruction.direction?.toUpperCase()}`
                  : ` Turn ${nextInstruction.direction}`
                }
              </Text>
            )}
            {!nextInstruction.nextTurnDescription && (
              <Text style={styles.navigationDistance}>
                {locationInfo.speedUnit === 'mph' 
                  ? `${convertDistanceToYards(nextInstruction.distance)}yd`
                  : `${Math.round(nextInstruction.distance)}m`
                }
              </Text>
            )}
          </View>
        </View>
      )}

      {!isTimerActive && selectedRouteId && !isRouteConfirmed && (
        <Pressable 
          testID="confirm-route-start-button"
          style={styles.startRunButton}
          onPress={handleStartRun}
        >
          <View style={styles.startRunButtonContent}>
            <Play size={20} color="#fff" fill="#fff" />
            <Text style={styles.startRunButtonText}>START</Text>
          </View>
        </Pressable>
      )}

      {isTimerActive && (
        <View style={styles.timerContainer}>
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>TIME</Text>
            <Text style={styles.timerValue}>{formatTime(elapsedTime)}</Text>
          </View>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Pressable
          testID="toggle-start-checkpoint"
          style={[
            styles.addButton,
            isAddingCheckpoint === 'start' && styles.addButtonActive,
          ]}
          onPress={() => {
            setIsAddingCheckpoint(isAddingCheckpoint === 'start' ? null : 'start');
            setIsAddingSpeedCamera(false);
          }}
        >
          <Play size={18} color="#fff" fill={isAddingCheckpoint === 'start' ? '#fff' : 'transparent'} />
          <Text style={styles.addButtonText} numberOfLines={1}>Start</Text>
        </Pressable>

        <Pressable
          testID="toggle-checkpoint"
          style={[
            styles.addButton,
            styles.checkpointButton,
            isAddingCheckpoint === 'checkpoint' && styles.addButtonActive,
            { backgroundColor: isAddingCheckpoint === 'checkpoint' ? 'rgba(255, 149, 0, 0.95)' : 'rgba(0, 122, 255, 0.95)' },
          ]}
          onPress={() => {
            setIsAddingCheckpoint(isAddingCheckpoint === 'checkpoint' ? null : 'checkpoint');
            setIsAddingSpeedCamera(false);
          }}
        >
          <MapPin size={18} color="#fff" fill={isAddingCheckpoint === 'checkpoint' ? '#fff' : 'transparent'} />
        </Pressable>

        <Pressable
          testID="toggle-finish-checkpoint"
          style={[
            styles.addButton,
            isAddingCheckpoint === 'finish' && styles.addButtonActive,
          ]}
          onPress={() => {
            setIsAddingCheckpoint(isAddingCheckpoint === 'finish' ? null : 'finish');
            setIsAddingSpeedCamera(false);
          }}
        >
          <Flag size={18} color="#fff" />
          <Text style={styles.addButtonText} numberOfLines={1}>Finish</Text>
        </Pressable>

        <Pressable
          testID="toggle-speed-camera"
          style={[
            styles.addButton,
            isAddingSpeedCamera && styles.addButtonActive,
            { backgroundColor: isAddingSpeedCamera ? 'rgba(255, 149, 0, 0.95)' : 'rgba(142, 142, 147, 0.95)' },
          ]}
          onPress={() => {
            setIsAddingSpeedCamera(!isAddingSpeedCamera);
            setIsAddingCheckpoint(null);
          }}
        >
          <Camera size={20} color="#fff" />
        </Pressable>

        <Pressable
          testID="clear-checkpoints-button"
          style={[styles.addButton, styles.clearButton]}
          onPress={handleClearCheckpoints}
        >
          <Trash2 size={20} color="#fff" />
        </Pressable>
      </View>

      <Pressable 
        testID="voice-mode-button"
        style={[styles.voiceButton, { backgroundColor: getVoiceModeColor() }]}
        onPress={() => setIsVoiceModalVisible(true)}
      >
        {getVoiceModeIcon()}
      </Pressable>

      <Pressable testID="recenter-map-button" style={styles.centerButton} onPress={centerOnUser}>
        <MapPin size={24} color="#007AFF" />
      </Pressable>

      {isTimerActive && (
        <Pressable 
          testID="end-run-button"
          style={styles.endRunButton}
          onPress={() => {
            Alert.alert(
              'End Run',
              'Are you sure you want to end this run? Your progress will be saved but the run will be marked as incomplete.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'End Run', 
                  style: 'destructive', 
                  onPress: async () => {
                    if (passedStartCheckpoint) {
                      const finishCheckpoint = checkpoints.find(c => c.type === 'finish');
                      if (finishCheckpoint) {
                        // Announce finish when ending run manually
                        if (voiceMode !== 'off' && Platform.OS !== 'web' && navigationVolume > 0) {
                          const message = 'Finish';
                          console.log('Announcing finish via End button');
                          
                          try {
                            await Speech.stop();
                            Speech.speak(message, {
                              language: 'en',
                              pitch: 1.1,
                              rate: 0.8,
                              volume: navigationVolume / 100,
                            });
                          } catch (error) {
                            console.error('Error speaking finish message:', error);
                          }
                        }
                        
                        const finalElapsedTime = Date.now() - (startTime || Date.now());
                        stopTimer(passedStartCheckpoint, finishCheckpoint);
                        
                        setPassedStartCheckpoint(null);
                        hasAnnouncedStartRef.current = false;
                        hasAnnouncedFinishRef.current = true;
                        lastAnnouncedInstruction.current = null;
                        setNextInstruction(null);
                        setCurrentGhostPosition(null);
                        setActiveGhostPath([]);
                        announcedCameraDistances.current.clear();
                        
                        // Show finish modal with retry option
                        setFinishModalTime(finalElapsedTime);
                        setShowFinishModal(true);
                      }
                    }
                  }
                },
              ]
            );
          }}
        >
          <X size={20} color="#fff" />
          <Text style={styles.endRunButtonText}>End</Text>
        </Pressable>
      )}

      <Pressable 
        testID="toggle-ghost-button"
        style={[
          styles.ghostButton,
          { backgroundColor: ghostEnabled ? 'rgba(147, 51, 234, 0.95)' : 'rgba(142, 142, 147, 0.95)' }
        ]} 
        onPress={toggleGhost}
      >
        <Ghost size={24} color="#fff" />
      </Pressable>

      <Pressable 
        testID="open-history-button"
        style={styles.historyButton} 
        onPress={() => router.push('/(tabs)/history')}
      >
        <Clock size={24} color="#fff" />
        {runs.length > 0 && (
          <View style={styles.historyBadge}>
            <Text style={styles.historyBadgeText}>{runs.length}</Text>
          </View>
        )}
      </Pressable>

      {viewingHistoricalRun && (
        <View style={[styles.instructionBanner, { backgroundColor: 'rgba(52, 199, 89, 0.95)' }]}>
          <Text style={styles.instructionText}>
            {historicalStartCheckpoint?.name} → {historicalFinishCheckpoint?.name}
          </Text>
          <Text style={styles.historicalDurationText}>
            Time: {formatTime(historicalRunDuration)}
          </Text>
          <Pressable
            style={styles.exitViewButton}
            onPress={() => {
              router.push('/(tabs)');
            }}
          >
            <X size={20} color="#fff" />
            <Text style={styles.exitViewButtonText}>Exit View</Text>
          </Pressable>
        </View>
      )}

      {!viewingHistoricalRun && isAddingCheckpoint && (
        <View style={styles.instructionBanner}>
          <Text style={styles.instructionText}>
            Tap on the map to place {isAddingCheckpoint} checkpoint
          </Text>
        </View>
      )}

      {isAddingSpeedCamera && (
        <View style={[styles.instructionBanner, { backgroundColor: 'rgba(255, 149, 0, 0.95)' }]}>
          <Text style={styles.instructionText}>
            Tap on the map to place a speed camera
          </Text>
        </View>
      )}

      <Modal
        visible={isVoiceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsVoiceModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setIsVoiceModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Voice Navigation</Text>
              <Pressable onPress={() => setIsVoiceModalVisible(false)}>
                <X size={24} color="#000" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <Pressable
                style={[
                  styles.voiceModeOption,
                  voiceMode === 'off' && styles.voiceModeOptionActive,
                ]}
                onPress={() => {
                  setVoiceNavigationMode('off');
                  setIsVoiceModalVisible(false);
                }}
              >
                <VolumeOff size={28} color={voiceMode === 'off' ? '#007AFF' : '#8E8E93'} />
                <View style={styles.voiceModeText}>
                  <Text style={[styles.voiceModeTitle, voiceMode === 'off' && styles.voiceModeTitleActive]}>
                    Off
                  </Text>
                  <Text style={styles.voiceModeDescription}>
                    No voice navigation
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={[
                  styles.voiceModeOption,
                  voiceMode === 'normal' && styles.voiceModeOptionActive,
                ]}
                onPress={() => {
                  setVoiceNavigationMode('normal');
                  setIsVoiceModalVisible(false);
                }}
              >
                <Volume2 size={28} color={voiceMode === 'normal' ? '#007AFF' : '#8E8E93'} />
                <View style={styles.voiceModeText}>
                  <Text style={[styles.voiceModeTitle, voiceMode === 'normal' && styles.voiceModeTitleActive]}>
                    Normal Navigation
                  </Text>
                  <Text style={styles.voiceModeDescription}>
                    Standard GPS-style directions
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={[
                  styles.voiceModeOption,
                  voiceMode === 'rally' && styles.voiceModeOptionActive,
                ]}
                onPress={() => {
                  setVoiceNavigationMode('rally');
                  setIsVoiceModalVisible(false);
                }}
              >
                <Navigation size={28} color={voiceMode === 'rally' ? '#007AFF' : '#8E8E93'} />
                <View style={styles.voiceModeText}>
                  <Text style={[styles.voiceModeTitle, voiceMode === 'rally' && styles.voiceModeTitleActive]}>
                    Rally Co-Driver
                  </Text>
                  <Text style={styles.voiceModeDescription}>
                    Pacenotes style: &quot;4 left&quot;, &quot;1 right, don&apos;t cut&quot;
                  </Text>
                </View>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <PartyResultsModal
        visible={showPartyResults}
        onClose={() => setShowPartyResults(false)}
        partyId={currentPartyId || ''}
        courseId={completedCourseId}
        currentUserId={currentUserId}
      />

      <Modal
        visible={showFinishModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.finishModalOverlay}>
          <View style={styles.finishModalContent}>
            <View style={styles.finishModalHeader}>
              <Flag size={48} color="#34C759" />
            </View>
            <Text style={styles.finishModalTitle}>Run Complete!</Text>
            <View style={styles.finishModalTimeContainer}>
              <Text style={styles.finishModalTimeLabel}>YOUR TIME</Text>
              <Text style={styles.finishModalTimeValue}>{formatTime(finishModalTime)}</Text>
            </View>
            <View style={styles.finishModalButtons}>
              <Pressable
                style={styles.finishModalRetryButton}
                onPress={() => {
                  console.log('User selected retry');
                  setShowFinishModal(false);
                  hasAnnouncedFinishRef.current = false;
                  hasLeftFinishPointRef.current = false;
                  setIsRouteConfirmed(true);
                  centerOnUser();
                }}
                testID="finish-modal-retry-button"
              >
                <Play size={20} color="#fff" fill="#fff" />
                <Text style={styles.finishModalRetryText}>Retry</Text>
              </Pressable>
              <Pressable
                style={styles.finishModalExitButton}
                onPress={() => {
                  console.log('User selected exit - clearing all points');
                  setShowFinishModal(false);
                  hasAnnouncedFinishRef.current = false;
                  hasLeftFinishPointRef.current = false;
                  clearCheckpoints();
                  setRouteOptions([]);
                  setSelectedRouteId(null);
                  setIsRouteConfirmed(false);
                  centerOnUser();
                }}
                testID="finish-modal-exit-button"
              >
                <X size={20} color="#fff" />
                <Text style={styles.finishModalExitText}>Exit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    flex: 1,
  },
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
  topInfoContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  roadOnlyContainer: {
    justifyContent: 'flex-end',
  },
  infoCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    minWidth: 110,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  speedLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#8E8E93',
    letterSpacing: 1,
  },
  speedValue: {
    fontSize: 44,
    fontWeight: '700' as const,
    color: '#fff',
    marginVertical: 4,
  },
  speedUnit: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#8E8E93',
  },
  roadCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  roadLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 4,
  },
  roadText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  navigationCard: {
    position: 'absolute',
    top: 160,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  navigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navigationMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  navigationTextContainer: {
    flex: 1,
  },
  navigationText: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#fff',
    flex: 1,
  },
  navigationDescription: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  navigationSecondary: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 4,
  },
  navigationDistance: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  timerContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
  timerCard: {
    backgroundColor: 'rgba(255, 59, 48, 0.95)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: 140,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  timerLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1.5,
  },
  timerValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
    marginTop: 2,
    fontVariant: ['tabular-nums'] as any,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    flex: 1,
    backgroundColor: 'rgba(0, 122, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  checkpointButton: {
    flex: 0.6,
    paddingHorizontal: 12,
  },
  addButtonActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.95)',
    shadowColor: '#34C759',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  clearButton: {
    flex: 0,
    minWidth: 56,
    backgroundColor: 'rgba(255, 59, 48, 0.95)',
    shadowColor: '#FF3B30',
  },
  centerButton: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  voiceButton: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  instructionBanner: {
    position: 'absolute',
    top: 280,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    gap: 12,
  },
  exitViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
  },
  exitViewButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  instructionText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
    textAlign: 'center',
  },
  historicalDurationText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
    textAlign: 'center',
    fontVariant: ['tabular-nums'] as any,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#000',
  },
  modalBody: {
    padding: 20,
  },
  voiceModeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    marginBottom: 12,
    gap: 16,
  },
  voiceModeOptionActive: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  voiceModeText: {
    flex: 1,
  },
  voiceModeTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 4,
  },
  voiceModeTitleActive: {
    color: '#007AFF',
  },
  voiceModeDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  cameraMarker: {
    width: 40,
    height: 40,
    backgroundColor: '#FF9500',
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  speedCameraWarning: {
    position: 'absolute' as const,
    top: 160,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 149, 0, 0.95)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  speedCameraWarningContent: {
    flex: 1,
  },
  speedCameraWarningTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 2,
  },
  speedCameraWarningDistance: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  ghostMarker: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(147, 51, 234, 0.3)',
    borderRadius: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 3,
    borderColor: '#9333EA',
    shadowColor: '#9333EA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  ghostButton: {
    position: 'absolute' as const,
    bottom: 120,
    left: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#9333EA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  partyMemberMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  partyMemberInitial: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#fff',
  },
  historyButton: {
    position: 'absolute' as const,
    bottom: 190,
    right: 20,
    width: 56,
    height: 56,
    backgroundColor: 'rgba(52, 199, 89, 0.95)',
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  historyBadge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: '#fff',
  },
  historyBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
  startRunButton: {
    position: 'absolute' as const,
    bottom: 120,
    left: '50%' as any,
    transform: [{ translateX: -60 }] as any,
    width: 120,
    height: 56,
    backgroundColor: 'rgba(52, 199, 89, 0.95)',
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  startRunButtonContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  startRunButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
  endRunButton: {
    position: 'absolute' as const,
    top: 180,
    right: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.95)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  endRunButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  finishModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 20,
  },
  finishModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  finishModalHeader: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 24,
  },
  finishModalTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 24,
  },
  finishModalTimeContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center' as const,
    marginBottom: 32,
  },
  finishModalTimeLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#8E8E93',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  finishModalTimeValue: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: '#000',
    fontVariant: ['tabular-nums'] as any,
  },
  finishModalButtons: {
    flexDirection: 'row' as const,
    gap: 12,
    width: '100%',
  },
  finishModalRetryButton: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  finishModalRetryText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  finishModalExitButton: {
    flex: 1,
    backgroundColor: '#8E8E93',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    shadowColor: '#8E8E93',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  finishModalExitText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
