import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { 
  Moon, 
  Sun, 
  Volume2, 
  User, 
  Info, 
  Smartphone, 
  Compass, 
  TrafficCone, 
  Gauge, 
  Map, 
  ZoomIn, 
  Ruler, 
  BellRing, 
  History, 
  Battery, 
  MapPin 
} from 'lucide-react-native';
import { useSettings } from '@/contexts/SettingsContext';

const USER_NAME_KEY = '@timeattack_user_name';

export default function SettingsScreen() {
  const systemColorScheme = useColorScheme();
  const { 
    theme, 
    setTheme, 
    navigationVolume, 
    setNavigationVolume,
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
  } = useSettings();
  const [userName, setUserName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [tempName, setTempName] = useState<string>('');

  useEffect(() => {
    loadUserName();
  }, []);

  const loadUserName = async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_NAME_KEY);
      if (stored) {
        setUserName(stored);
        setTempName(stored);
      } else {
        setUserName('Driver');
        setTempName('Driver');
      }
    } catch (error) {
      console.error('Error loading user name:', error);
    }
  };

  const saveUserName = async () => {
    if (!tempName.trim()) {
      Alert.alert('Invalid Name', 'Please enter a valid name');
      return;
    }

    try {
      await AsyncStorage.setItem(USER_NAME_KEY, tempName.trim());
      setUserName(tempName.trim());
      setIsEditingName(false);
      Alert.alert('Success', 'Your name has been updated');
    } catch (error) {
      console.error('Error saving user name:', error);
      Alert.alert('Error', 'Failed to save your name');
    }
  };

  const isDark = theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark');

  const styles = getStyles(isDark);

  const ThemeOption = ({ value, icon: Icon, label }: { value: 'light' | 'dark' | 'system'; icon: any; label: string }) => (
    <Pressable
      style={[
        styles.themeOption,
        theme === value && styles.themeOptionActive,
      ]}
      onPress={() => setTheme(value)}
    >
      <Icon size={24} color={theme === value ? '#007AFF' : (isDark ? '#8E8E93' : '#8E8E93')} />
      <Text style={[
        styles.themeOptionLabel,
        theme === value && styles.themeOptionLabelActive,
      ]}>
        {label}
      </Text>
    </Pressable>
  );

  const ToggleRow = ({ 
    icon: Icon, 
    label, 
    value, 
    onValueChange, 
    subtitle 
  }: { 
    icon: any; 
    label: string; 
    value: boolean; 
    onValueChange: (value: boolean) => void;
    subtitle?: string;
  }) => (
    <View style={styles.settingRowColumn}>
      <Pressable 
        style={styles.settingRow}
        onPress={() => onValueChange(!value)}
      >
        <View style={styles.settingLeft}>
          <Icon size={24} color={isDark ? '#fff' : '#000'} />
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>{label}</Text>
            {subtitle && <Text style={styles.settingSubtext}>{subtitle}</Text>}
          </View>
        </View>
        <View style={[styles.toggle, value && styles.toggleActive]}>
          <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
        </View>
      </Pressable>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <User size={24} color={isDark ? '#fff' : '#000'} />
              <Text style={styles.settingLabel}>Display Name</Text>
            </View>
            {!isEditingName ? (
              <Pressable onPress={() => {
                setIsEditingName(true);
                setTempName(userName);
              }}>
                <Text style={styles.settingValue}>{userName}</Text>
              </Pressable>
            ) : (
              <View style={styles.nameEditContainer}>
                <TextInput
                  style={styles.nameInput}
                  value={tempName}
                  onChangeText={setTempName}
                  placeholder="Enter your name"
                  placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
                  maxLength={20}
                  autoFocus
                />
                <Pressable style={styles.saveButton} onPress={saveUserName}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </Pressable>
                <Pressable 
                  style={styles.cancelButton} 
                  onPress={() => {
                    setIsEditingName(false);
                    setTempName(userName);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.card}>
          <Text style={styles.cardSubtitle}>Theme</Text>
          <View style={styles.themeOptionsContainer}>
            <ThemeOption value="light" icon={Sun} label="Light" />
            <ThemeOption value="dark" icon={Moon} label="Dark" />
            <ThemeOption value="system" icon={Smartphone} label="System" />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Map & Display</Text>
        <View style={styles.card}>
          <View style={styles.settingRowColumn}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Compass size={24} color={isDark ? '#fff' : '#000'} />
                <Text style={styles.settingLabel}>Map Orientation</Text>
              </View>
            </View>
            <View style={styles.segmentedControl}>
              <Pressable
                style={[
                  styles.segmentButton,
                  mapOrientation === 'north-up' && styles.segmentButtonActive,
                ]}
                onPress={() => setMapOrientation('north-up')}
              >
                <Text style={[
                  styles.segmentButtonText,
                  mapOrientation === 'north-up' && styles.segmentButtonTextActive,
                ]}>
                  North Up
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.segmentButton,
                  mapOrientation === 'heading-up' && styles.segmentButtonActive,
                ]}
                onPress={() => setMapOrientation('heading-up')}
              >
                <Text style={[
                  styles.segmentButtonText,
                  mapOrientation === 'heading-up' && styles.segmentButtonTextActive,
                ]}>
                  Heading Up
                </Text>
              </Pressable>
            </View>
          </View>
          
          <View style={styles.separator} />
          
          <View style={styles.settingRowColumn}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Map size={24} color={isDark ? '#fff' : '#000'} />
                <Text style={styles.settingLabel}>Map Type</Text>
              </View>
            </View>
            <View style={styles.segmentedControl}>
              <Pressable
                style={[
                  styles.segmentButton,
                  mapType === 'standard' && styles.segmentButtonActive,
                ]}
                onPress={() => setMapType('standard')}
              >
                <Text style={[
                  styles.segmentButtonText,
                  mapType === 'standard' && styles.segmentButtonTextActive,
                ]}>
                  Standard
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.segmentButton,
                  mapType === 'satellite' && styles.segmentButtonActive,
                ]}
                onPress={() => setMapType('satellite')}
              >
                <Text style={[
                  styles.segmentButtonText,
                  mapType === 'satellite' && styles.segmentButtonTextActive,
                ]}>
                  Satellite
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.segmentButton,
                  mapType === 'hybrid' && styles.segmentButtonActive,
                ]}
                onPress={() => setMapType('hybrid')}
              >
                <Text style={[
                  styles.segmentButtonText,
                  mapType === 'hybrid' && styles.segmentButtonTextActive,
                ]}>
                  Hybrid
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.separator} />

          <ToggleRow
            icon={TrafficCone}
            label="Show Traffic"
            subtitle="Display real-time traffic conditions"
            value={showTraffic}
            onValueChange={setShowTraffic}
          />

          <View style={styles.separator} />

          <ToggleRow
            icon={Gauge}
            label="Show Speed Limit"
            subtitle="Display current road speed limit"
            value={showSpeedLimit}
            onValueChange={setShowSpeedLimit}
          />

          <View style={styles.separator} />

          <ToggleRow
            icon={ZoomIn}
            label="Auto Zoom"
            subtitle="Automatically adjust zoom level"
            value={autoZoom}
            onValueChange={setAutoZoom}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Navigation & Audio</Text>
        <View style={styles.card}>
          <View style={styles.settingRowColumn}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ruler size={24} color={isDark ? '#fff' : '#000'} />
                <Text style={styles.settingLabel}>Distance Unit</Text>
              </View>
            </View>
            <View style={styles.segmentedControl}>
              <Pressable
                style={[
                  styles.segmentButton,
                  distanceUnit === 'kilometers' && styles.segmentButtonActive,
                ]}
                onPress={() => setDistanceUnit('kilometers')}
              >
                <Text style={[
                  styles.segmentButtonText,
                  distanceUnit === 'kilometers' && styles.segmentButtonTextActive,
                ]}>
                  Kilometers
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.segmentButton,
                  distanceUnit === 'miles' && styles.segmentButtonActive,
                ]}
                onPress={() => setDistanceUnit('miles')}
              >
                <Text style={[
                  styles.segmentButtonText,
                  distanceUnit === 'miles' && styles.segmentButtonTextActive,
                ]}>
                  Miles
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.separator} />

          <ToggleRow
            icon={Gauge}
            label="Show Speed"
            subtitle="Display current speed on map"
            value={showSpeed}
            onValueChange={setShowSpeed}
          />

          <View style={styles.separator} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Volume2 size={24} color={isDark ? '#fff' : '#000'} />
              <Text style={styles.settingLabel}>Voice Volume</Text>
            </View>
            <Text style={styles.volumeValue}>{navigationVolume}%</Text>
          </View>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>0</Text>
            <Slider
              style={{ flex: 1, height: 40 }}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={navigationVolume}
              onValueChange={setNavigationVolume}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor={isDark ? '#2C2C2E' : '#E5E5EA'}
              thumbTintColor="#007AFF"
            />
            <Text style={styles.sliderLabel}>100</Text>
          </View>
          <View style={styles.volumeButtons}>
            <Pressable 
              style={styles.volumeButton}
              onPress={() => setNavigationVolume(Math.max(0, navigationVolume - 10))}
            >
              <Text style={styles.volumeButtonText}>-10</Text>
            </Pressable>
            <Pressable 
              style={styles.volumeButton}
              onPress={() => setNavigationVolume(0)}
            >
              <Text style={styles.volumeButtonText}>Mute</Text>
            </Pressable>
            <Pressable 
              style={styles.volumeButton}
              onPress={() => setNavigationVolume(50)}
            >
              <Text style={styles.volumeButtonText}>50%</Text>
            </Pressable>
            <Pressable 
              style={styles.volumeButton}
              onPress={() => setNavigationVolume(100)}
            >
              <Text style={styles.volumeButtonText}>100%</Text>
            </Pressable>
            <Pressable 
              style={styles.volumeButton}
              onPress={() => setNavigationVolume(Math.min(100, navigationVolume + 10))}
            >
              <Text style={styles.volumeButtonText}>+10</Text>
            </Pressable>
          </View>
          <Text style={styles.volumeHint}>
            {navigationVolume === 0 ? 'Voice navigation is muted' : `Voice navigation will play at ${navigationVolume}% volume`}
          </Text>

          <View style={styles.separator} />

          <ToggleRow
            icon={BellRing}
            label="Alert Sounds"
            subtitle="Audio alerts for hazards and events"
            value={alertSounds}
            onValueChange={setAlertSounds}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Data</Text>
        <View style={styles.card}>
          <ToggleRow
            icon={History}
            label="Save Route History"
            subtitle="Store your routes for later viewing"
            value={saveHistory}
            onValueChange={setSaveHistory}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.card}>
          <ToggleRow
            icon={Battery}
            label="Battery Saver Mode"
            subtitle="Reduce GPS accuracy to save battery"
            value={batterySaver}
            onValueChange={setBatterySaver}
          />

          <View style={styles.separator} />

          <ToggleRow
            icon={MapPin}
            label="High Accuracy GPS"
            subtitle="Use highest precision location tracking"
            value={highAccuracyGPS}
            onValueChange={setHighAccuracyGPS}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Info size={24} color={isDark ? '#fff' : '#000'} />
              <View>
                <Text style={styles.settingLabel}>Time Attack Racing</Text>
                <Text style={styles.settingSubtext}>Version 1.0.0</Text>
              </View>
            </View>
          </View>
          <Text style={styles.aboutText}>
            A precision racing app designed for competitive time trials. Track your performance, compete with friends, and push your limits on every course.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Made for racers, by racers</Text>
      </View>
    </ScrollView>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#000' : '#F2F2F7',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: isDark ? '#fff' : '#000',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: isDark ? '#1C1C1E' : '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: isDark ? '#8E8E93' : '#8E8E93',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: isDark ? '#fff' : '#000',
  },
  settingValue: {
    fontSize: 17,
    fontWeight: '500' as const,
    color: '#007AFF',
  },
  settingSubtext: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: isDark ? '#8E8E93' : '#8E8E93',
    marginTop: 2,
  },
  themeOptionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  themeOption: {
    flex: 1,
    backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeOptionActive: {
    backgroundColor: isDark ? '#1C3A5C' : '#E3F2FD',
    borderColor: '#007AFF',
  },
  themeOptionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: isDark ? '#8E8E93' : '#8E8E93',
  },
  themeOptionLabelActive: {
    color: '#007AFF',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: isDark ? '#8E8E93' : '#8E8E93',
    width: 30,
  },
  sliderTrack: {
    flex: 1,
    height: 8,
    backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
    borderRadius: 4,
    position: 'relative',
  },
  sliderFill: {
    height: 8,
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  sliderThumb: {
    position: 'absolute',
    top: -8,
    width: 24,
    height: 24,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    marginLeft: -12,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  volumeValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#007AFF',
  },
  volumeButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  volumeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  volumeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  volumeHint: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: isDark ? '#8E8E93' : '#8E8E93',
    marginTop: 12,
    textAlign: 'center',
  },
  nameEditContainer: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  nameInput: {
    flex: 1,
    backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: '500' as const,
    color: isDark ? '#fff' : '#000',
    maxWidth: 150,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  cancelButton: {
    backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: isDark ? '#8E8E93' : '#8E8E93',
  },
  aboutText: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: isDark ? '#8E8E93' : '#8E8E93',
    lineHeight: 22,
    marginTop: 12,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: isDark ? '#8E8E93' : '#8E8E93',
  },
  settingRowColumn: {
    gap: 12,
  },
  separator: {
    height: 1,
    backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
    marginVertical: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#007AFF',
  },
  segmentButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: isDark ? '#8E8E93' : '#8E8E93',
  },
  segmentButtonTextActive: {
    color: '#fff',
  },
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 15.5,
    backgroundColor: isDark ? '#39393D' : '#E5E5EA',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#34C759',
  },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
});
