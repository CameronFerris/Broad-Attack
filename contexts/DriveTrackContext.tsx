import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Checkpoint, RunRecord, UserLocationInfo, VoiceMode, SpeedCamera, GhostPoint, ActiveRunPath } from '@/types/map';
import { submitRaceResult, uploadGhostRace } from '@/lib/database-service';
import { DEFAULT_PARTY_ID } from '@/constants/appLink';
import { useTrackingPermission } from '@/contexts/TrackingPermissionContext';

const CHECKPOINTS_KEY = '@drivetrack_checkpoints';
const RUNS_KEY = '@drivetrack_runs';
const SPEED_CAMERAS_KEY = '@drivetrack_speed_cameras';
const USER_ID_KEY = '@timeattack_user_id';
const CURRENT_PARTY_KEY = '@drivetrack_party_id';

export const [DriveTrackProvider, useDriveTrack] = createContextHook(() => {
  const { hasConsent: hasTrackingConsent } = useTrackingPermission();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentRunSpeeds, setCurrentRunSpeeds] = useState<number[]>([]);
  const [maxSpeedInRun, setMaxSpeedInRun] = useState<number>(0);
  const [currentGhostPath, setCurrentGhostPath] = useState<GhostPoint[]>([]);
  const [ghostEnabled, setGhostEnabled] = useState<boolean>(true);
  const [activeRunPath, setActiveRunPath] = useState<ActiveRunPath | null>(null);
  const [locationInfo, setLocationInfo] = useState<UserLocationInfo>({
    country: null,
    countryCode: null,
    speedUnit: 'kmh',
  });
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('normal');
  const [speedCameras, setSpeedCameras] = useState<SpeedCamera[]>([]);
  const [currentPartyId, setCurrentPartyId] = useState<string | null>(DEFAULT_PARTY_ID);

  useEffect(() => {
    loadCheckpoints();
    loadRuns();
    loadSpeedCameras();
    loadCurrentParty();
    console.log('DriveTrack context mounted - checkpoints will persist in background');
  }, []);

  const loadCheckpoints = async () => {
    try {
      const stored = await AsyncStorage.getItem(CHECKPOINTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCheckpoints(parsed);
        } else {
          console.warn('Invalid checkpoints data format, clearing');
          await AsyncStorage.removeItem(CHECKPOINTS_KEY);
        }
      }
    } catch (error) {
      console.error('Error loading checkpoints:', error);
      await AsyncStorage.removeItem(CHECKPOINTS_KEY).catch(e => console.error('Failed to clear corrupted data:', e));
    }
  };

  const loadRuns = async () => {
    try {
      const stored = await AsyncStorage.getItem(RUNS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRuns(parsed);
        } else {
          console.warn('Invalid runs data format, clearing');
          await AsyncStorage.removeItem(RUNS_KEY);
        }
      }
    } catch (error) {
      console.error('Error loading runs:', error);
      await AsyncStorage.removeItem(RUNS_KEY).catch(e => console.error('Failed to clear corrupted data:', e));
    }
  };

  const loadSpeedCameras = async () => {
    try {
      const stored = await AsyncStorage.getItem(SPEED_CAMERAS_KEY);
      if (stored) {
        setSpeedCameras(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading speed cameras:', error);
    }
  };

  const loadCurrentParty = async () => {
    try {
      const storedPartyId = await AsyncStorage.getItem(CURRENT_PARTY_KEY);
      if (storedPartyId) {
        setCurrentPartyId(storedPartyId);
      } else if (DEFAULT_PARTY_ID) {
        await AsyncStorage.setItem(CURRENT_PARTY_KEY, DEFAULT_PARTY_ID);
        setCurrentPartyId(DEFAULT_PARTY_ID);
      }
    } catch (error) {
      console.error('Error loading current party link:', error);
    }
  };

  const saveCheckpoints = async (newCheckpoints: Checkpoint[]) => {
    try {
      if (!Array.isArray(newCheckpoints)) {
        console.error('Invalid checkpoint data type');
        return;
      }
      await AsyncStorage.setItem(CHECKPOINTS_KEY, JSON.stringify(newCheckpoints));
      setCheckpoints(newCheckpoints);
    } catch (error) {
      console.error('Error saving checkpoints:', error);
      if (error instanceof Error && error.message.includes('quota')) {
        console.error('Storage quota exceeded');
      }
    }
  };

  const saveRuns = async (newRuns: RunRecord[]) => {
    try {
      if (!Array.isArray(newRuns)) {
        console.error('Invalid runs data type');
        return;
      }
      const dataSize = JSON.stringify(newRuns).length;
      if (dataSize > 5000000) {
        console.warn('Runs data is very large:', dataSize, 'bytes. Consider cleanup.');
        const limitedRuns = newRuns.slice(0, 100);
        await AsyncStorage.setItem(RUNS_KEY, JSON.stringify(limitedRuns));
        setRuns(limitedRuns);
      } else {
        await AsyncStorage.setItem(RUNS_KEY, JSON.stringify(newRuns));
        setRuns(newRuns);
      }
    } catch (error) {
      console.error('Error saving runs:', error);
      if (error instanceof Error && error.message.includes('quota')) {
        console.error('Storage quota exceeded, keeping only recent 50 runs');
        const limitedRuns = newRuns.slice(0, 50);
        await AsyncStorage.setItem(RUNS_KEY, JSON.stringify(limitedRuns)).catch(e => console.error('Failed to save limited runs:', e));
        setRuns(limitedRuns);
      }
    }
  };

  const saveSpeedCameras = async (newSpeedCameras: SpeedCamera[]) => {
    try {
      await AsyncStorage.setItem(SPEED_CAMERAS_KEY, JSON.stringify(newSpeedCameras));
      setSpeedCameras(newSpeedCameras);
    } catch (error) {
      console.error('Error saving speed cameras:', error);
    }
  };

  const addCheckpoint = useCallback((checkpoint: Checkpoint) => {
    setCheckpoints(prev => {
      const newCheckpoints = [...prev, checkpoint];
      saveCheckpoints(newCheckpoints);
      return newCheckpoints;
    });
  }, []);

  const removeCheckpoint = useCallback((id: string) => {
    setCheckpoints(prev => {
      const newCheckpoints = prev.filter(c => c.id !== id);
      saveCheckpoints(newCheckpoints);
      return newCheckpoints;
    });
  }, []);

  const clearCheckpoints = useCallback(() => {
    saveCheckpoints([]);
  }, []);

  const startTimer = useCallback(() => {
    console.log('Timer started');
    setIsTimerActive(true);
    const now = Date.now();
    setStartTime(now);
    setCurrentRunSpeeds([]);
    setMaxSpeedInRun(0);
    setCurrentGhostPath([]);
    setActiveRunPath({
      coordinates: [],
      startTime: now,
    });
  }, []);

  const stopTimer = useCallback(async (startCheckpoint: Checkpoint, finishCheckpoint: Checkpoint) => {
    if (!startTime) return;
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const averageSpeed = currentRunSpeeds.length > 0
      ? currentRunSpeeds.reduce((a, b) => a + b, 0) / currentRunSpeeds.length
      : 0;

    const courseId = `${startCheckpoint.id}_${finishCheckpoint.id}`;
    
    setRuns(prevRuns => {
      const courseLaps = prevRuns.filter(r => r.courseId === courseId);
      const lapNumber = courseLaps.length + 1;

      const newRun: RunRecord = {
      id: `run_${Date.now()}`,
      startTime,
      endTime,
      duration,
      startCheckpoint,
      finishCheckpoint,
      averageSpeed,
      maxSpeed: maxSpeedInRun,
      date: new Date().toISOString(),
      courseId,
      lapNumber,
      ghostPath: currentGhostPath,
    };

      console.log('Timer stopped. Duration:', duration, 'ms', 'Lap:', lapNumber);
      const newRuns = [newRun, ...prevRuns];
      saveRuns(newRuns);
      return newRuns;
    });
    
    // Upload ghost race
    if (hasTrackingConsent) {
      try {
        const userId = await AsyncStorage.getItem(USER_ID_KEY);
        if (userId) {
          await uploadGhostRace({
            userId,
            courseId,
            duration,
            ghostPath: currentGhostPath,
            startCheckpoint,
            finishCheckpoint,
            averageSpeed,
            maxSpeed: maxSpeedInRun,
          });
          console.log('Uploaded ghost race to database');
        }
      } catch (error) {
        console.error('Error uploading ghost race:', error);
      }
    } else {
      console.warn('Tracking consent not granted. Skipping ghost race upload.');
    }

    // Submit to party if in one
    if (currentPartyId) {
      if (!hasTrackingConsent) {
        console.warn('Tracking consent not granted. Skipping party submission.');
      } else {
        try {
          const userId = await AsyncStorage.getItem(USER_ID_KEY);
          if (userId) {
            await submitRaceResult({
              partyId: currentPartyId,
              userId,
              courseId,
              duration,
              averageSpeed,
              maxSpeed: maxSpeedInRun,
              ghostPath: currentGhostPath,
            });
            console.log('Submitted race result to party:', currentPartyId);
          }
        } catch (error) {
          console.error('Error submitting race result:', error);
        }
      }
    }
    
    setIsTimerActive(false);
    setStartTime(null);
    setCurrentRunSpeeds([]);
    setMaxSpeedInRun(0);
    setCurrentGhostPath([]);
    setActiveRunPath(null);
  }, [startTime, currentRunSpeeds, maxSpeedInRun, currentGhostPath, currentPartyId, hasTrackingConsent]);

  const recordSpeed = useCallback((speed: number) => {
    if (isTimerActive) {
      setCurrentRunSpeeds(prev => [...prev, speed]);
      setMaxSpeedInRun(prev => Math.max(prev, speed));
    }
  }, [isTimerActive]);

  const deleteRun = useCallback((id: string) => {
    setRuns(prev => {
      const newRuns = prev.filter(r => r.id !== id);
      saveRuns(newRuns);
      return newRuns;
    });
  }, []);

  const clearAllRuns = useCallback(() => {
    saveRuns([]);
  }, []);

  const updateLocationInfo = useCallback((info: UserLocationInfo) => {
    setLocationInfo(info);
  }, []);

  const setVoiceNavigationMode = useCallback((mode: VoiceMode) => {
    setVoiceMode(mode);
  }, []);

  const addSpeedCamera = useCallback((camera: SpeedCamera) => {
    setSpeedCameras(prev => {
      const newSpeedCameras = [...prev, camera];
      saveSpeedCameras(newSpeedCameras);
      return newSpeedCameras;
    });
  }, []);

  const removeSpeedCamera = useCallback((id: string) => {
    setSpeedCameras(prev => {
      const newSpeedCameras = prev.filter(c => c.id !== id);
      saveSpeedCameras(newSpeedCameras);
      return newSpeedCameras;
    });
  }, []);

  const clearSpeedCameras = useCallback(() => {
    saveSpeedCameras([]);
  }, []);

  const recordGhostPoint = useCallback((latitude: number, longitude: number, timestamp: number) => {
    if (isTimerActive) {
      setCurrentGhostPath(prev => [...prev, { latitude, longitude, timestamp }]);
      setActiveRunPath(prev => {
        if (!prev) return null;
        return {
          ...prev,
          coordinates: [...prev.coordinates, { latitude, longitude }],
        };
      });
    }
  }, [isTimerActive]);

  const toggleGhost = useCallback(() => {
    setGhostEnabled(prev => !prev);
  }, []);

  const setParty = useCallback((partyId: string | null) => {
    setCurrentPartyId(partyId);
    (async () => {
      try {
        if (partyId) {
          await AsyncStorage.setItem(CURRENT_PARTY_KEY, partyId);
        } else {
          await AsyncStorage.removeItem(CURRENT_PARTY_KEY);
        }
      } catch (error) {
        console.error('Error persisting party link:', error);
      }
    })();
  }, []);

  const getBestRunForCourse = useCallback((courseId: string): RunRecord | null => {
    const courseRuns = runs.filter(r => r.courseId === courseId);
    if (courseRuns.length === 0) return null;
    return courseRuns.reduce((best, run) => 
      run.duration < best.duration ? run : best
    );
  }, [runs]);

  return useMemo(() => ({
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
    deleteRun,
    clearAllRuns,
    updateLocationInfo,
    setVoiceNavigationMode,
    addSpeedCamera,
    removeSpeedCamera,
    clearSpeedCameras,
    recordGhostPoint,
    toggleGhost,
    getBestRunForCourse,
    setParty,
  }), [checkpoints, runs, isTimerActive, startTime, locationInfo, voiceMode, speedCameras, ghostEnabled, currentPartyId, activeRunPath, addCheckpoint, removeCheckpoint, clearCheckpoints, startTimer, stopTimer, recordSpeed, deleteRun, clearAllRuns, updateLocationInfo, setVoiceNavigationMode, addSpeedCamera, removeSpeedCamera, clearSpeedCameras, recordGhostPoint, toggleGhost, getBestRunForCourse, setParty]);
});
