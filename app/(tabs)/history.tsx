import { useDriveTrack } from '@/contexts/DriveTrackContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Trash2, Clock, Trophy, MapPin, RotateCcw } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import type { RunRecord } from '@/types/map';

export default function HistoryScreen() {
  const { runs, clearAllRuns, addCheckpoint, clearCheckpoints } = useDriveTrack();
  const { isDarkMode } = useSettings();

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  };

  const handleRestartRun = (run: RunRecord) => {
    Alert.alert(
      'Restart Run',
      `Do you want to set up ${run.startCheckpoint.name} → ${run.finishCheckpoint.name} again?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          onPress: () => {
            clearCheckpoints();
            addCheckpoint(run.startCheckpoint);
            addCheckpoint(run.finishCheckpoint);
            router.push('/(tabs)');
          },
        },
      ]
    );
  };



  const handleClearAll = () => {
    if (runs.length === 0) return;

    Alert.alert(
      'Clear All Runs',
      'Are you sure you want to delete all run records?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: clearAllRuns,
        },
      ]
    );
  };

  const groupedRuns = useMemo(() => {
    const groups = new Map<string, RunRecord[]>();
    runs.forEach(run => {
      const courseId = run.courseId || `${run.startCheckpoint.id}_${run.finishCheckpoint.id}`;
      if (!groups.has(courseId)) {
        groups.set(courseId, []);
      }
      groups.get(courseId)!.push(run);
    });
    
    return Array.from(groups.entries()).map(([courseId, courseRuns]) => {
      const sortedRuns = courseRuns.sort((a, b) => {
        const lapA = a.lapNumber || 0;
        const lapB = b.lapNumber || 0;
        return lapA - lapB;
      });
      
      return {
        courseId,
        runs: sortedRuns,
        courseName: `${sortedRuns[0].startCheckpoint.name} → ${sortedRuns[0].finishCheckpoint.name}`,
        totalLaps: sortedRuns.length,
      };
    });
  }, [runs]);

  const getBestTime = () => {
    if (runs.length === 0) return null;
    return runs.reduce((best, run) =>
      run.duration < best.duration ? run : best
    );
  };

  const getAverageTime = () => {
    if (runs.length === 0) return 0;
    const total = runs.reduce((sum, run) => sum + run.duration, 0);
    return total / runs.length;
  };

  const bestTime = getBestTime();
  const avgTime = getAverageTime();

  const styles = getStyles(isDarkMode);

  if (runs.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Clock size={64} color="#8E8E93" />
        <Text style={styles.emptyTitle}>No Runs Yet</Text>
        <Text style={styles.emptySubtitle}>
          Complete a run between checkpoints to see your times here
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TOTAL RUNS</Text>
          <Text style={styles.statValue}>{runs.length}</Text>
        </View>
        
        {bestTime && (
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>BEST TIME</Text>
            <Text style={styles.statValue}>{formatTime(bestTime.duration)}</Text>
          </View>
        )}
        
        {avgTime > 0 && (
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>AVG TIME</Text>
            <Text style={styles.statValue}>{formatTime(avgTime)}</Text>
          </View>
        )}
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Courses</Text>
        <Pressable style={styles.clearAllButton} onPress={handleClearAll}>
          <Trash2 size={18} color="#FF3B30" />
          <Text style={styles.clearAllText}>Clear All</Text>
        </Pressable>
      </View>

      <FlatList
        data={groupedRuns}
        keyExtractor={(item) => item.courseId}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item: group }) => {
          const bestLap = group.runs.reduce((best, run) => 
            run.duration < best.duration ? run : best
          );
          
          return (
            <View style={styles.courseCard}>
              <View style={styles.courseHeader}>
                <View style={styles.courseNameContainer}>
                  <Text style={styles.courseName}>{group.courseName}</Text>
                  <Text style={styles.courseLapCount}>{group.totalLaps} {group.totalLaps === 1 ? 'Lap' : 'Laps'}</Text>
                </View>
              </View>

              {group.totalLaps > 1 && (
                <View style={styles.bestLapSection}>
                  <View style={styles.bestLapHeader}>
                    <Trophy size={18} color="#FFD60A" />
                    <Text style={styles.bestLapLabel}>Best Lap</Text>
                  </View>
                  <Text style={styles.bestLapTime}>{formatTime(bestLap.duration)}</Text>
                  <Text style={styles.bestLapNumber}>Lap {bestLap.lapNumber}</Text>
                </View>
              )}

              <View style={styles.lapTimesSection}>
                <Text style={styles.lapTimesTitle}>Lap Times</Text>
                {group.runs.map((run) => (
                  <View key={run.id} style={styles.lapTimeRowContainer}>
                    <Pressable 
                      style={styles.lapTimeRow}
                      onPress={() => {
                        router.push({
                          pathname: '/(tabs)',
                          params: {
                            viewRunId: run.id,
                            startLat: String(run.startCheckpoint.latitude),
                            startLon: String(run.startCheckpoint.longitude),
                            finishLat: String(run.finishCheckpoint.latitude),
                            finishLon: String(run.finishCheckpoint.longitude),
                            startName: run.startCheckpoint.name,
                            finishName: run.finishCheckpoint.name,
                          },
                        });
                      }}
                    >
                      <View style={styles.lapTimeContent}>
                        <Text style={styles.lapNumber}>Lap {run.lapNumber}</Text>
                        <Text style={styles.lapTime}>{formatTime(run.duration)}</Text>
                      </View>
                      <MapPin size={18} color="#007AFF" />
                    </Pressable>
                    <Pressable 
                      style={styles.restartButton}
                      onPress={() => handleRestartRun(run)}
                    >
                      <RotateCcw size={16} color="#007AFF" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#000' : '#F2F2F7',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#000' : '#F2F2F7',
    padding: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: isDark ? '#fff' : '#000',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: isDark ? '#1C1C1E' : '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: isDark ? '#fff' : '#000',
    marginTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: isDark ? '#fff' : '#000',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FF3B30',
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  runCard: {
    backgroundColor: isDark ? '#1C1C1E' : '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 16,
  },
  runHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  runDateBadge: {
    backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  runDateText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: isDark ? '#fff' : '#000',
  },
  deleteButton: {
    padding: 8,
  },
  runMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  runTime: {
    fontSize: 40,
    fontWeight: '700' as const,
    color: isDark ? '#fff' : '#000',
    fontVariant: ['tabular-nums'] as any,
  },
  bestBadge: {
    backgroundColor: '#FFD60A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bestBadgeText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#000',
    letterSpacing: 0.5,
  },
  runDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: isDark ? '#fff' : '#000',
  },
  speedStats: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  speedStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  speedLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#8E8E93',
  },
  speedValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: isDark ? '#fff' : '#000',
  },
  courseCard: {
    backgroundColor: isDark ? '#1C1C1E' : '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 16,
  },
  courseHeader: {
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#2C2C2E' : '#F2F2F7',
    paddingBottom: 12,
  },
  courseNameContainer: {
    gap: 4,
  },
  courseName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: isDark ? '#fff' : '#000',
  },
  courseLapCount: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#8E8E93',
  },
  bestLapSection: {
    backgroundColor: isDark ? '#2C2410' : '#FFF9E5',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  bestLapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bestLapLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: isDark ? '#FFD60A' : '#000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bestLapTime: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: isDark ? '#fff' : '#000',
    fontVariant: ['tabular-nums'] as any,
  },
  bestLapNumber: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#8E8E93',
  },
  lapTimesSection: {
    gap: 8,
  },
  lapTimesTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: isDark ? '#fff' : '#000',
    marginBottom: 8,
  },
  lapTimeRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#2C2C2E' : '#F2F2F7',
    paddingVertical: 8,
  },
  lapTimeRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  restartButton: {
    padding: 8,
    backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
    borderRadius: 8,
  },
  lapTimeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  lapNumber: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: isDark ? '#fff' : '#000',
  },
  lapTime: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: isDark ? '#fff' : '#000',
    fontVariant: ['tabular-nums'] as any,
  },
});
