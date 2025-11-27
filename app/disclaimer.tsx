import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AlertTriangle } from "lucide-react-native";

const DISCLAIMER_KEY = "disclaimer_accepted";

export default function DisclaimerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log('Disclaimer screen mounted');
  }, []);

  const handleAgree = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      console.log('Saving disclaimer acceptance...');
      await AsyncStorage.setItem(DISCLAIMER_KEY, "true");
      console.log('Disclaimer acceptance saved successfully');
      
      const verification = await AsyncStorage.getItem(DISCLAIMER_KEY);
      console.log('Verification - stored value:', verification);
      
      if (verification === "true") {
        console.log('Navigating to tabs...');
        router.replace("/(tabs)");
      } else {
        console.error('Failed to save disclaimer - verification failed');
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error saving disclaimer acceptance:", error);
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <AlertTriangle size={48} color="#FF3B30" />
          <Text style={styles.title}>
            Confidential User Agreement &amp; Responsibility Disclaimer
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <Text style={styles.bodyText}>
            Before using this app, you must read and agree to the following
            terms:
          </Text>

          <Text style={styles.bodyText}>
            This application is provided for personal use only. By continuing,
            you acknowledge and agree that any actions, decisions, or behaviours
            you take while using the app are made entirely by you and are your
            sole responsibility.
          </Text>

          <Text style={styles.bodyText}>
            The creators, developers, and owners of this app are not responsible
            or liable for any outcomes, consequences, or results that may arise
            from your use of the app, whether directly or indirectly. All
            information, features, and tools within the app are intended to
            assist you, but you remain fully accountable for how you choose to
            use them.
          </Text>

          <Text style={styles.sectionTitle}>
            How we use protected data
          </Text>

          <Text style={styles.bodyText}>
            We collect precise location, speed, heading, and device identifiers
            to power live navigation, speed monitoring, ghost laps, and party
            leaderboards. This data may be stored locally on your device and,
            with your App Tracking Transparency consent, securely uploaded so you
            can compare laps with friends. Example: we capture your latitude,
            longitude, and current road name to render the road label in the top
            right corner and to replay your ghost car for future sessions.
          </Text>

          <Text style={styles.bodyText}>
            We never sell personal information. Data is only used to deliver the
            in-app driving experience, surface safety alerts, and share results
            with parties you explicitly join.
          </Text>

          <Text style={styles.sectionTitle}>
            By tapping &quot;I Agree,&quot; you confirm that:
          </Text>

          <View style={styles.bulletContainer}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              You understand and accept full responsibility for your actions.
            </Text>
          </View>

          <View style={styles.bulletContainer}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              You understand that the app does not control or influence your
              decisions.
            </Text>
          </View>

          <View style={styles.bulletContainer}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              You release the app and its creators from any liability relating
              to your use.
            </Text>
          </View>

          <Text style={[styles.bodyText, styles.warningText]}>
            If you do not agree to these terms, you must exit the app
            immediately.
          </Text>
        </ScrollView>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.agreeButton, isLoading && styles.buttonDisabled]}
            onPress={handleAgree}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.agreeButtonText}>I Agree</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: "#1C1C1E",
    textAlign: "center",
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
  },
  scrollContent: {
    padding: 20,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#3A3A3C",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#1C1C1E",
    marginTop: 8,
    marginBottom: 12,
  },
  bulletContainer: {
    flexDirection: "row",
    marginBottom: 12,
    paddingLeft: 8,
  },
  bullet: {
    fontSize: 15,
    color: "#3A3A3C",
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: "#3A3A3C",
  },
  warningText: {
    fontWeight: "600" as const,
    color: "#FF3B30",
    marginTop: 8,
  },
  buttonContainer: {
    paddingTop: 8,
  },
  agreeButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  agreeButtonText: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: "#fff",
  },
});
