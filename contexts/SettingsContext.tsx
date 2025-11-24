import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

const THEME_KEY = '@timeattack_theme';
const NAVIGATION_VOLUME_KEY = '@timeattack_navigation_volume';
const MAP_ORIENTATION_KEY = '@timeattack_map_orientation';
const SHOW_TRAFFIC_KEY = '@timeattack_show_traffic';
const SHOW_SPEED_LIMIT_KEY = '@timeattack_show_speed_limit';
const MAP_TYPE_KEY = '@timeattack_map_type';
const AUTO_ZOOM_KEY = '@timeattack_auto_zoom';
const DISTANCE_UNIT_KEY = '@timeattack_distance_unit';
const SHOW_SPEED_KEY = '@timeattack_show_speed';
const ALERT_SOUNDS_KEY = '@timeattack_alert_sounds';
const SAVE_HISTORY_KEY = '@timeattack_save_history';
const BATTERY_SAVER_KEY = '@timeattack_battery_saver';
const HIGH_ACCURACY_GPS_KEY = '@timeattack_high_accuracy_gps';

export type ThemeMode = 'light' | 'dark' | 'system';
export type MapOrientation = 'north-up' | 'heading-up';
export type MapType = 'standard' | 'satellite' | 'hybrid';
export type DistanceUnit = 'kilometers' | 'miles';

export const [SettingsProvider, useSettings] = createContextHook(() => {
  const systemColorScheme = useColorScheme() || 'light';
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [navigationVolume, setNavigationVolumeState] = useState<number>(70);
  const [mapOrientation, setMapOrientationState] = useState<MapOrientation>('heading-up');
  const [showTraffic, setShowTrafficState] = useState<boolean>(true);
  const [showSpeedLimit, setShowSpeedLimitState] = useState<boolean>(true);
  const [mapType, setMapTypeState] = useState<MapType>('standard');
  const [autoZoom, setAutoZoomState] = useState<boolean>(true);
  const [distanceUnit, setDistanceUnitState] = useState<DistanceUnit>('kilometers');
  const [showSpeed, setShowSpeedState] = useState<boolean>(true);
  const [alertSounds, setAlertSoundsState] = useState<boolean>(true);
  const [saveHistory, setSaveHistoryState] = useState<boolean>(true);
  const [batterySaver, setBatterySaverState] = useState<boolean>(false);
  const [highAccuracyGPS, setHighAccuracyGPSState] = useState<boolean>(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [
        storedTheme,
        storedVolume,
        storedMapOrientation,
        storedShowTraffic,
        storedShowSpeedLimit,
        storedMapType,
        storedAutoZoom,
        storedDistanceUnit,
        storedShowSpeed,
        storedAlertSounds,
        storedSaveHistory,
        storedBatterySaver,
        storedHighAccuracyGPS,
      ] = await Promise.all([
        AsyncStorage.getItem(THEME_KEY),
        AsyncStorage.getItem(NAVIGATION_VOLUME_KEY),
        AsyncStorage.getItem(MAP_ORIENTATION_KEY),
        AsyncStorage.getItem(SHOW_TRAFFIC_KEY),
        AsyncStorage.getItem(SHOW_SPEED_LIMIT_KEY),
        AsyncStorage.getItem(MAP_TYPE_KEY),
        AsyncStorage.getItem(AUTO_ZOOM_KEY),
        AsyncStorage.getItem(DISTANCE_UNIT_KEY),
        AsyncStorage.getItem(SHOW_SPEED_KEY),
        AsyncStorage.getItem(ALERT_SOUNDS_KEY),
        AsyncStorage.getItem(SAVE_HISTORY_KEY),
        AsyncStorage.getItem(BATTERY_SAVER_KEY),
        AsyncStorage.getItem(HIGH_ACCURACY_GPS_KEY),
      ]);

      if (storedTheme) setThemeState(storedTheme as ThemeMode);
      if (storedVolume) setNavigationVolumeState(parseInt(storedVolume, 10));
      if (storedMapOrientation) setMapOrientationState(storedMapOrientation as MapOrientation);
      if (storedShowTraffic !== null) setShowTrafficState(storedShowTraffic === 'true');
      if (storedShowSpeedLimit !== null) setShowSpeedLimitState(storedShowSpeedLimit === 'true');
      if (storedMapType) setMapTypeState(storedMapType as MapType);
      if (storedAutoZoom !== null) setAutoZoomState(storedAutoZoom === 'true');
      if (storedDistanceUnit) setDistanceUnitState(storedDistanceUnit as DistanceUnit);
      if (storedShowSpeed !== null) setShowSpeedState(storedShowSpeed === 'true');
      if (storedAlertSounds !== null) setAlertSoundsState(storedAlertSounds === 'true');
      if (storedSaveHistory !== null) setSaveHistoryState(storedSaveHistory === 'true');
      if (storedBatterySaver !== null) setBatterySaverState(storedBatterySaver === 'true');
      if (storedHighAccuracyGPS !== null) setHighAccuracyGPSState(storedHighAccuracyGPS === 'true');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const setTheme = useCallback(async (newTheme: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_KEY, newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  }, []);

  const setNavigationVolume = useCallback(async (volume: number) => {
    try {
      const clampedVolume = Math.max(0, Math.min(100, volume));
      await AsyncStorage.setItem(NAVIGATION_VOLUME_KEY, String(clampedVolume));
      setNavigationVolumeState(clampedVolume);
    } catch (error) {
      console.error('Error saving navigation volume:', error);
    }
  }, []);

  const setMapOrientation = useCallback(async (orientation: MapOrientation) => {
    try {
      await AsyncStorage.setItem(MAP_ORIENTATION_KEY, orientation);
      setMapOrientationState(orientation);
    } catch (error) {
      console.error('Error saving map orientation:', error);
    }
  }, []);

  const setShowTraffic = useCallback(async (show: boolean) => {
    try {
      await AsyncStorage.setItem(SHOW_TRAFFIC_KEY, String(show));
      setShowTrafficState(show);
    } catch (error) {
      console.error('Error saving show traffic:', error);
    }
  }, []);

  const setShowSpeedLimit = useCallback(async (show: boolean) => {
    try {
      await AsyncStorage.setItem(SHOW_SPEED_LIMIT_KEY, String(show));
      setShowSpeedLimitState(show);
    } catch (error) {
      console.error('Error saving show speed limit:', error);
    }
  }, []);

  const setMapType = useCallback(async (type: MapType) => {
    try {
      await AsyncStorage.setItem(MAP_TYPE_KEY, type);
      setMapTypeState(type);
    } catch (error) {
      console.error('Error saving map type:', error);
    }
  }, []);

  const setAutoZoom = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(AUTO_ZOOM_KEY, String(enabled));
      setAutoZoomState(enabled);
    } catch (error) {
      console.error('Error saving auto zoom:', error);
    }
  }, []);

  const setDistanceUnit = useCallback(async (unit: DistanceUnit) => {
    try {
      await AsyncStorage.setItem(DISTANCE_UNIT_KEY, unit);
      setDistanceUnitState(unit);
    } catch (error) {
      console.error('Error saving distance unit:', error);
    }
  }, []);

  const setShowSpeed = useCallback(async (show: boolean) => {
    try {
      await AsyncStorage.setItem(SHOW_SPEED_KEY, String(show));
      setShowSpeedState(show);
    } catch (error) {
      console.error('Error saving show speed:', error);
    }
  }, []);

  const setAlertSounds = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(ALERT_SOUNDS_KEY, String(enabled));
      setAlertSoundsState(enabled);
    } catch (error) {
      console.error('Error saving alert sounds:', error);
    }
  }, []);

  const setSaveHistory = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(SAVE_HISTORY_KEY, String(enabled));
      setSaveHistoryState(enabled);
    } catch (error) {
      console.error('Error saving save history:', error);
    }
  }, []);

  const setBatterySaver = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(BATTERY_SAVER_KEY, String(enabled));
      setBatterySaverState(enabled);
    } catch (error) {
      console.error('Error saving battery saver:', error);
    }
  }, []);

  const setHighAccuracyGPS = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(HIGH_ACCURACY_GPS_KEY, String(enabled));
      setHighAccuracyGPSState(enabled);
    } catch (error) {
      console.error('Error saving high accuracy GPS:', error);
    }
  }, []);

  const isDarkMode = useMemo(() => {
    if (theme === 'system') {
      return systemColorScheme === 'dark';
    }
    return theme === 'dark';
  }, [theme, systemColorScheme]);

  return useMemo(
    () => ({
      theme,
      setTheme,
      navigationVolume,
      setNavigationVolume,
      isDarkMode,
      mapOrientation,
      setMapOrientation,
      showTraffic,
      setShowTraffic,
      showSpeedLimit,
      setShowSpeedLimit,
      mapType,
      setMapType,
      autoZoom,
      setAutoZoom,
      distanceUnit,
      setDistanceUnit,
      showSpeed,
      setShowSpeed,
      alertSounds,
      setAlertSounds,
      saveHistory,
      setSaveHistory,
      batterySaver,
      setBatterySaver,
      highAccuracyGPS,
      setHighAccuracyGPS,
    }),
    [
      theme,
      setTheme,
      navigationVolume,
      setNavigationVolume,
      isDarkMode,
      mapOrientation,
      setMapOrientation,
      showTraffic,
      setShowTraffic,
      showSpeedLimit,
      setShowSpeedLimit,
      mapType,
      setMapType,
      autoZoom,
      setAutoZoom,
      distanceUnit,
      setDistanceUnit,
      showSpeed,
      setShowSpeed,
      alertSounds,
      setAlertSounds,
      saveHistory,
      setSaveHistory,
      batterySaver,
      setBatterySaver,
      highAccuracyGPS,
      setHighAccuracyGPS,
    ]
  );
});
