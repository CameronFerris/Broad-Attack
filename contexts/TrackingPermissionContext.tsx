import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

type TrackingAuthorizationStatus = 'granted' | 'denied' | 'undetermined';

interface TrackingPermissionContextValue {
  status: TrackingAuthorizationStatus;
  hasConsent: boolean;
  isReady: boolean;
  isRequesting: boolean;
  requestPermission: () => Promise<TrackingAuthorizationStatus>;
}

const INITIAL_STATUS: TrackingAuthorizationStatus = Platform.OS === 'ios' ? 'undetermined' : 'granted';

export const [TrackingPermissionProvider, useTrackingPermission] = createContextHook<TrackingPermissionContextValue>(() => {
  const [status, setStatus] = useState<TrackingAuthorizationStatus>(INITIAL_STATUS);
  const [hasConsent, setHasConsent] = useState<boolean>(Platform.OS !== 'ios');
  const [isReady, setIsReady] = useState<boolean>(Platform.OS !== 'ios');
  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  const applyPermissionResponse = useCallback((permissionStatus: TrackingAuthorizationStatus, granted: boolean) => {
    setStatus(permissionStatus);
    setHasConsent(granted);
  }, []);

  const requestPermission = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      applyPermissionResponse('granted', true);
      setIsReady(true);
      return 'granted';
    }

    if (isRequesting) {
      return status;
    }

    setIsRequesting(true);
    try {
      console.log('Requesting App Tracking Transparency permission');
      const response = await requestTrackingPermissionsAsync();
      const normalizedStatus = response.status as TrackingAuthorizationStatus;
      applyPermissionResponse(normalizedStatus, response.granted);
      if (response.granted) {
        console.log('Tracking permission granted by user');
      } else {
        console.warn('Tracking permission denied by user');
      }
      return normalizedStatus;
    } catch (error) {
      console.error('Error requesting tracking permission:', error);
      applyPermissionResponse('denied', false);
      return 'denied';
    } finally {
      setIsRequesting(false);
      setIsReady(true);
    }
  }, [applyPermissionResponse, isRequesting, status]);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      console.log('Tracking permission automatically granted on non-iOS platform');
      return;
    }

    let isMounted = true;

    const initializePermission = async () => {
      try {
        const permission = await getTrackingPermissionsAsync();
        if (!isMounted) return;

        const normalizedStatus = permission.status as TrackingAuthorizationStatus;
        console.log('Initial tracking permission status:', normalizedStatus, 'granted:', permission.granted);
        applyPermissionResponse(normalizedStatus, permission.granted);

        if (normalizedStatus === 'undetermined' && permission.canAskAgain) {
          await requestPermission();
        } else {
          setIsReady(true);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to load tracking permission status:', error);
        applyPermissionResponse('denied', false);
        setIsReady(true);
      }
    };

    initializePermission();

    return () => {
      isMounted = false;
    };
  }, [applyPermissionResponse, requestPermission]);

  return useMemo(
    () => ({
      status,
      hasConsent,
      isReady,
      isRequesting,
      requestPermission,
    }),
    [hasConsent, isReady, isRequesting, requestPermission, status]
  );
});
