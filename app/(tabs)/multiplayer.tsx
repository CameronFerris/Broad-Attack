import { useDriveTrack } from '@/contexts/DriveTrackContext';
import { 
  createParty, 
  joinPartyByCode, 
  getPartyMembers,
  subscribeToPartyMembers,
  subscribeToRaceResults,
  getPartyRaceResults,
  leaveParty,
  type DbParty,
  type DbPartyMember,
  type DbRaceResult,
} from '@/lib/database-service';
import { Users, Plus, UserPlus, Trophy, Share2, X } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Share,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = '@timeattack_user_id';
const USER_NAME_KEY = '@timeattack_user_name';

export default function MultiplayerScreen() {
  const { checkpoints, setParty } = useDriveTrack();
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [currentParty, setCurrentParty] = useState<DbParty | null>(null);
  const [partyMembers, setPartyMembers] = useState<DbPartyMember[]>([]);
  const [raceResults, setRaceResults] = useState<DbRaceResult[]>([]);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [invitationCode, setInvitationCode] = useState('');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    loadUserInfo();
  }, []);

  useEffect(() => {
    if (!currentParty) return;

    const unsubscribeMembers = subscribeToPartyMembers(currentParty.id, (members) => {
      console.log('Party members updated:', members.length);
      setPartyMembers(members);
    });

    const unsubscribeResults = subscribeToRaceResults(currentParty.id, (results) => {
      console.log('Race results updated:', results.length);
      setRaceResults(results);
    });

    loadPartyData();

    return () => {
      unsubscribeMembers();
      unsubscribeResults();
    };
  }, [currentParty?.id]);

  const loadUserInfo = async () => {
    try {
      let storedUserId = await AsyncStorage.getItem(USER_ID_KEY);
      let storedUserName = await AsyncStorage.getItem(USER_NAME_KEY);

      if (!storedUserId) {
        storedUserId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await AsyncStorage.setItem(USER_ID_KEY, storedUserId);
      }

      if (!storedUserName) {
        storedUserName = `Driver ${Math.floor(Math.random() * 9999)}`;
        await AsyncStorage.setItem(USER_NAME_KEY, storedUserName);
      }

      setUserId(storedUserId);
      setUserName(storedUserName);
      console.log('User ID:', storedUserId);
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const loadPartyData = async () => {
    if (!currentParty) return;

    const members = await getPartyMembers(currentParty.id);
    setPartyMembers(members);

    const results = await getPartyRaceResults(currentParty.id);
    setRaceResults(results);
  };

  const handleCreateParty = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter your display name');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User ID not loaded. Please try again.');
      return;
    }

    console.log('Creating party with userId:', userId, 'displayName:', displayName.trim());
    
    const result = await createParty({
      creatorId: userId,
      displayName: displayName.trim(),
      maxMembers: 2,
    });

    if ('error' in result) {
      console.error('Error creating party:', result.error);
      Alert.alert('Error Creating Party', String(result.error));
      return;
    }

    if (result.party && result.invitationCode) {
      setCurrentParty(result.party);
      setParty(result.party.id);
      await AsyncStorage.setItem(USER_NAME_KEY, displayName.trim());
      setUserName(displayName.trim());
      setIsCreateModalVisible(false);
      setDisplayName('');

      Alert.alert(
        'Party Created!',
        `Invitation Code: ${result.invitationCode}\n\nShare this code with your friend to join the race!`,
        [
          { text: 'Copy Code', onPress: () => copyInvitationCode(result.invitationCode) },
          { text: 'OK' }
        ]
      );
    } else {
      Alert.alert('Error', 'Failed to create party. Please try again.');
    }
  };

  const handleJoinParty = async () => {
    if (!invitationCode.trim()) {
      Alert.alert('Error', 'Please enter an invitation code');
      return;
    }

    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter your display name');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User ID not loaded. Please try again.');
      return;
    }

    console.log('Joining party with code:', invitationCode.trim().toUpperCase(), 'userId:', userId);

    const result = await joinPartyByCode({
      invitationCode: invitationCode.trim().toUpperCase(),
      userId,
      displayName: displayName.trim(),
    });

    if (result && 'party' in result) {
      console.log('Successfully joined party:', result.party.id);
      setCurrentParty(result.party);
      setParty(result.party.id);
      setPartyMembers(result.members);
      await AsyncStorage.setItem(USER_NAME_KEY, displayName.trim());
      setUserName(displayName.trim());
      setIsJoinModalVisible(false);
      setInvitationCode('');
      setDisplayName('');
      Alert.alert('Success', 'Joined party successfully!');
    } else if (result && 'error' in result) {
      console.error('Join party error:', result.error);
      Alert.alert('Error Joining Party', String(result.error));
    } else {
      console.error('Unknown error joining party');
      Alert.alert('Error', 'Failed to join party. Check the code and try again.');
    }
  };

  const handleLeaveParty = () => {
    Alert.alert(
      'Leave Party',
      'Are you sure you want to leave this party?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (currentParty && userId) {
              const result = await leaveParty(currentParty.id, userId);
              if (result.success) {
                setCurrentParty(null);
                setParty(null);
                setPartyMembers([]);
                setRaceResults([]);
                Alert.alert('Success', 'You have left the party');
              } else {
                Alert.alert('Error', result.error || 'Failed to leave party');
              }
            }
          },
        },
      ]
    );
  };

  const copyInvitationCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied!', 'Invitation code copied to clipboard');
  };

  const shareInvitationCode = async (code: string) => {
    try {
      await Share.share({
        message: `Join my TimeAttack GPS race! Use invitation code: ${code}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  };

  if (!currentParty) {
    return (
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Users size={64} color="#007AFF" />
          <Text style={styles.headerTitle}>Multiplayer Racing</Text>
          <Text style={styles.headerSubtitle}>
            Create or join a party to race against your friends
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            style={styles.actionButton}
            onPress={() => {
              setDisplayName(userName);
              setIsCreateModalVisible(true);
            }}
          >
            <Plus size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Create Party</Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.joinButton]}
            onPress={() => {
              setDisplayName(userName);
              setIsJoinModalVisible(true);
            }}
          >
            <UserPlus size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Join Party</Text>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            1. One player creates a party and shares the invitation code{'\n'}
            2. Friend joins using the code (max 2 players){'\n'}
            3. Both players race on the same course{'\n'}
            4. Compare your times and see who&apos;s faster!
          </Text>
        </View>

        <Modal
          visible={isCreateModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIsCreateModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create Party</Text>
                <Pressable onPress={() => setIsCreateModalVisible(false)}>
                  <X size={24} color="#000" />
                </Pressable>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Your display name"
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={20}
              />

              <Pressable
                style={[styles.modalButton, !displayName.trim() && styles.modalButtonDisabled]}
                onPress={handleCreateParty}
                disabled={!displayName.trim()}
              >
                <Text style={styles.modalButtonText}>Create Party</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={isJoinModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIsJoinModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Join Party</Text>
                <Pressable onPress={() => setIsJoinModalVisible(false)}>
                  <X size={24} color="#000" />
                </Pressable>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Invitation code"
                value={invitationCode}
                onChangeText={(text) => setInvitationCode(text.toUpperCase())}
                maxLength={6}
                autoCapitalize="characters"
              />

              <TextInput
                style={styles.input}
                placeholder="Your display name"
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={20}
              />

              <Pressable
                style={[styles.modalButton, (!invitationCode.trim() || !displayName.trim()) && styles.modalButtonDisabled]}
                onPress={handleJoinParty}
                disabled={!invitationCode.trim() || !displayName.trim()}
              >
                <Text style={styles.modalButtonText}>Join Party</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.partyHeader}>
        <View style={styles.partyHeaderContent}>
          <Text style={styles.partyTitle}>Party Race</Text>
          <Text style={styles.partyCode}>Code: {currentParty.invitation_code}</Text>
        </View>
        <View style={styles.partyHeaderActions}>
          <Pressable
            style={styles.iconButton}
            onPress={() => copyInvitationCode(currentParty.invitation_code)}
          >
            <Share2 size={20} color="#007AFF" />
          </Pressable>
          {Platform.OS !== 'web' && (
            <Pressable
              style={styles.iconButton}
              onPress={() => shareInvitationCode(currentParty.invitation_code)}
            >
              <Share2 size={20} color="#007AFF" />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.membersSection}>
        <Text style={styles.sectionTitle}>Members ({partyMembers.length}/2)</Text>
        {partyMembers.map((member) => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>
                {member.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.memberName}>{member.display_name}</Text>
            {member.user_id === currentParty.creator_id && (
              <View style={styles.hostBadge}>
                <Text style={styles.hostBadgeText}>HOST</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {checkpoints.filter(c => c.type === 'start').length > 0 && 
       checkpoints.filter(c => c.type === 'finish').length > 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Ready to Race!</Text>
          <Text style={styles.infoText}>
            Go to the Map tab and complete a run. Your time will automatically be shared with your party!
          </Text>
        </View>
      ) : (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Setup Required</Text>
          <Text style={styles.infoText}>
            Go to the Map tab and place start and finish checkpoints to create a course.
          </Text>
        </View>
      )}

      {raceResults.length > 0 && (
        <View style={styles.resultsSection}>
          <View style={styles.resultsSectionHeader}>
            <Trophy size={24} color="#FFD60A" />
            <Text style={styles.sectionTitle}>Race Results</Text>
          </View>
          <FlatList
            data={raceResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const member = partyMembers.find(m => m.user_id === item.user_id);
              return (
                <View style={[styles.resultCard, index === 0 && styles.firstPlace]}>
                  <View style={styles.resultRank}>
                    <Text style={[styles.resultRankText, index === 0 && styles.firstPlaceText]}>
                      #{index + 1}
                    </Text>
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{member?.display_name || 'Unknown'}</Text>
                    <Text style={styles.resultStats}>
                      Avg: {Math.round(item.average_speed)} km/h • Max: {Math.round(item.max_speed)} km/h
                    </Text>
                  </View>
                  <Text style={[styles.resultTime, index === 0 && styles.firstPlaceText]}>
                    {formatTime(item.duration)}
                  </Text>
                </View>
              );
            }}
          />
        </View>
      )}

      <Pressable style={styles.leaveButton} onPress={handleLeaveParty}>
        <Text style={styles.leaveButtonText}>Leave Party</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  headerContainer: {
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  joinButton: {
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  infoCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
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
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#000',
  },
  modalButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalButtonDisabled: {
    backgroundColor: '#8E8E93',
    opacity: 0.5,
  },
  modalButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  partyHeader: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partyHeaderContent: {
    flex: 1,
  },
  partyTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
  },
  partyCode: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#007AFF',
    marginTop: 4,
  },
  partyHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  membersSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 12,
  },
  memberCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  memberName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
  },
  hostBadge: {
    backgroundColor: '#FFD60A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hostBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#000',
  },
  resultsSection: {
    flex: 1,
    padding: 16,
  },
  resultsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  firstPlace: {
    backgroundColor: '#FFF9E5',
    borderWidth: 2,
    borderColor: '#FFD60A',
  },
  resultRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultRankText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
  },
  firstPlaceText: {
    color: '#000',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 2,
  },
  resultStats: {
    fontSize: 13,
    color: '#8E8E93',
  },
  resultTime: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    fontVariant: ['tabular-nums'] as any,
  },
  leaveButton: {
    margin: 16,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
