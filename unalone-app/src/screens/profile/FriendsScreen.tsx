import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { friendsService } from '../../services/FriendsService';
import { APP_COLORS } from '../../utils/constants';
import { PublicUser, FriendRequests } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const FriendsScreen: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [requests, setRequests] = useState<FriendRequests>({ received: [], sent: [] });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [f, r] = await Promise.all([
        friendsService.listFriends(),
        friendsService.listRequests(),
      ]);
      setFriends(f); setRequests(r);
    } catch (e: any) {
      console.warn('Friends load failed', e?.message || e);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const accept = async (id: string) => {
    try {
      await friendsService.accept(id);
      await load();
      await refreshUser();
      Alert.alert('Friend added', 'You earned +50 points for making a friend!');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed');
    }
  };
  const reject = async (id: string) => {
    try { await friendsService.reject(id); await load(); } catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
  };
  const remove = async (id: string) => {
    Alert.alert('Remove friend', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await friendsService.remove(id); await load(); } catch (e: any) { Alert.alert('Error', e?.message || 'Failed'); }
      }},
    ]);
  };

  const renderUser = (u: PublicUser, right?: React.ReactNode) => (
    <View key={u.id} style={styles.itemRow}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{u.nickname.charAt(0).toUpperCase()}</Text></View>
      <Text style={styles.nick}>{u.nickname}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <Text style={styles.headerStat}>Level: {user?.level ?? 1}</Text>
              <Text style={styles.headerStat}>Points: {user?.points ?? 0}</Text>
            </View>
            <Text style={styles.section}>Pending Requests</Text>
            {requests.received.length === 0 && requests.sent.length === 0 ? (
              <Text style={styles.empty}>No pending requests</Text>
            ) : null}
            {requests.received.map((u) => renderUser(u, (
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, styles.accept]} onPress={() => accept(u.id)}><Text style={styles.btnText}>Accept</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.reject]} onPress={() => reject(u.id)}><Text style={styles.btnText}>Reject</Text></TouchableOpacity>
              </View>
            )))}
            {requests.sent.length > 0 && <Text style={styles.subsection}>Sent</Text>}
            {requests.sent.map((u) => renderUser(u, (
              <Text style={styles.sent}>Sent</Text>
            )))}

            <Text style={styles.section}>Friends</Text>
          </>
        }
        data={friends}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => renderUser(item, (
          <TouchableOpacity style={[styles.btn, styles.remove]} onPress={() => remove(item.id)}><Text style={styles.btnText}>Remove</Text></TouchableOpacity>
        ))}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.empty}>No friends yet</Text>}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  section: { fontSize: 18, fontWeight: 'bold', marginTop: 8, marginBottom: 6 },
  subsection: { fontSize: 14, fontWeight: '600', marginTop: 4, marginBottom: 6, color: APP_COLORS.textSecondary },
  empty: { color: APP_COLORS.textSecondary, marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: APP_COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { color: 'white', fontWeight: 'bold' },
  nick: { fontSize: 16 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  accept: { backgroundColor: '#22C55E' },
  reject: { backgroundColor: '#EF4444' },
  remove: { backgroundColor: '#F59E0B' },
  btnText: { color: 'white', fontWeight: 'bold' },
  sent: { color: APP_COLORS.textSecondary },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  headerStat: { fontSize: 14, fontWeight: '600' },
});

export default FriendsScreen;
