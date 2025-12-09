import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { Audio } from "expo-av";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DriveTrackProvider } from "@/contexts/DriveTrackContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { TrackingPermissionProvider } from "@/contexts/TrackingPermissionContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

const DISCLAIMER_KEY = "disclaimer_accepted";

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const [isLoading, setIsLoading] = useState(true);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  useEffect(() => {
    const checkDisclaimer = async () => {
      try {
        console.log('Checking disclaimer acceptance...');
        const value = await AsyncStorage.getItem(DISCLAIMER_KEY);
        console.log('Disclaimer value:', value);
        const accepted = value === "true";
        setDisclaimerAccepted(accepted);
      } catch (error) {
        console.error("Error checking disclaimer:", error);
        setDisclaimerAccepted(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkDisclaimer();

    const interval = setInterval(() => {
      AsyncStorage.getItem(DISCLAIMER_KEY).then((value) => {
        if (value === "true" && !disclaimerAccepted) {
          console.log('Disclaimer accepted detected via polling');
          setDisclaimerAccepted(true);
        }
      });
    }, 500);

    return () => clearInterval(interval);
  }, [disclaimerAccepted]);

  useEffect(() => {
    if (!isLoading) {
      const inDisclaimer = segments[0] === "disclaimer";
      const inTabs = segments[0] === "(tabs)";
      console.log('Navigation check - accepted:', disclaimerAccepted, 'inDisclaimer:', inDisclaimer, 'inTabs:', inTabs, 'segments:', segments);
      
      if (!disclaimerAccepted && !inDisclaimer) {
        console.log('User has not accepted disclaimer, redirecting to disclaimer page');
        router.replace("/disclaimer");
      } else if (disclaimerAccepted && inDisclaimer) {
        console.log('User accepted disclaimer, redirecting to tabs');
        router.replace("/(tabs)");
      }
    }
  }, [isLoading, disclaimerAccepted, router, segments]);

  useEffect(() => {
    if (!isLoading) {
      const hideSplash = async () => {
        try {
          await SplashScreen.hideAsync();
          console.log('Splash screen hidden');
        } catch (error) {
          console.error('Error hiding splash screen:', error);
        }
      };
      hideSplash();
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="disclaimer" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const isUnsupportedTablet = Platform.OS === "ios" && Platform.isPad === true;

  useEffect(() => {
    const configureAudioMode = async () => {
      try {
        console.log("Configuring background audio mode...");
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
        console.log("Background audio mode configured successfully");
      } catch (error) {
        console.error("Error configuring background audio mode", error);
      }
    };

    configureAudioMode();
  }, []);

  if (isUnsupportedTablet) {
    console.log("Blocked unsupported iPad device");
    return (
      <View style={styles.unsupportedContainer} testID="unsupported-device">
        <Text style={styles.unsupportedTitle}>DriveTrack is iPhone only</Text>
        <Text style={styles.unsupportedCopy}>Open this app on an iPhone to continue.</Text>
      </View>
    );
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <TrackingPermissionProvider>
          <SettingsProvider>
            <DriveTrackProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <RootLayoutNav />
              </GestureHandlerRootView>
            </DriveTrackProvider>
          </SettingsProvider>
        </TrackingPermissionProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const styles = StyleSheet.create({
  unsupportedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#050505",
    paddingHorizontal: 24,
  },
  unsupportedTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  unsupportedCopy: {
    fontSize: 16,
    color: "#E0E0E0",
    textAlign: "center",
  },
});
