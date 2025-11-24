import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Trophy, X, Medal } from 'lucide-react-native';
import { getPartyRaceResults, getPartyMembers, type DbRaceResult, type DbPartyMember } from '@/lib/database-service';

interface PartyResultsModalProps {
  visible: boolean;
  onClose: () => void;
  partyId: string;
  courseId: string;
  currentUserId: string;
}

interface ResultWithName extends DbRaceResult {
  displayName: string;
  isCurrentUser: boolean;
}

export default function PartyResultsModal({
  visible,
  onClose,
  partyId,
  courseId,
  currentUserId,
}: PartyResultsModalProps) {
  const [results, setResults] = useState<ResultWithName[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, partyId, courseId]);

  const loadResults = async () => {
    setLoading(true);
    try {
      const [allResults, members] = await Promise.all([
        getPartyRaceResults(partyId),
        getPartyMembers(partyId),
      ]);

      const courseResults = allResults
        .filter(r => r.course_id === courseId)
        .map(result => {
          const member = members.find(m => m.user_id === result.user_id);
          return {
            ...result,
            displayName: member?.display_name || 'Unknown',
            isCurrentUser: result.user_id === currentUserId,
          };
        })
        .sort((a, b) => a.duration - b.duration);

      setResults(courseResults);
    } catch (error) {
      console.error('Error loading party results:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  };

  const getMedalColor = (index: number): string => {
    switch (index) {
      case 0: return '#FFD700';
      case 1: return '#C0C0C0';
      case 2: return '#CD7F32';
      default: return '#8E8E93';
    }
  };

  const getRankLabel = (index: number): string => {
    switch (index) {
      case 0: return '1st';
      case 1: return '2nd';
      case 2: return '3rd';
      default: return `${index + 1}th`;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Trophy size={32} color="#FFD700" />
              <Text style={styles.title}>Race Results</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#000" />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading results...</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No results yet</Text>
              <Text style={styles.emptySubtext}>
                Waiting for other party members to complete the race
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              renderItem={({ item, index }) => (
                <View
                  style={[
                    styles.resultCard,
                    index === 0 && styles.firstPlace,
                    item.isCurrentUser && styles.currentUserCard,
                  ]}
                >
                  <View style={styles.rankContainer}>
                    {index < 3 ? (
                      <Medal size={32} color={getMedalColor(index)} />
                    ) : (
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>{index + 1}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.resultInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, index === 0 && styles.winnerName]}>
                        {item.displayName}
                      </Text>
                      {item.isCurrentUser && (
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeText}>YOU</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.stats}>
                      Avg: {Math.round(item.average_speed)} km/h • Max: {Math.round(item.max_speed)} km/h
                    </Text>
                  </View>

                  <View style={styles.timeContainer}>
                    <Text style={styles.rankLabel}>{getRankLabel(index)}</Text>
                    <Text style={[styles.time, index === 0 && styles.winnerTime]}>
                      {formatTime(item.duration)}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}

          <Pressable style={styles.closeButtonLarge} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#000',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  listContainer: {
    padding: 20,
    gap: 12,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  firstPlace: {
    backgroundColor: '#FFF9E5',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  currentUserCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  rankContainer: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
  },
  resultInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#000',
  },
  winnerName: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  youBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  youBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
  stats: {
    fontSize: 14,
    color: '#8E8E93',
  },
  timeContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rankLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  time: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#000',
    fontVariant: ['tabular-nums'] as any,
  },
  winnerTime: {
    fontSize: 26,
    color: '#000',
  },
  closeButtonLarge: {
    margin: 20,
    marginTop: 0,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
