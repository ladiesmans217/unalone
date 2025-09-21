// Blocked users management screen
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import { Text, Card, Button, ListItem, Avatar } from 'react-native-elements';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { profileService } from '../../services/ProfileService';
import { APP_CONFIG } from '../../utils/constants';

interface BlockedUser {
  id: string;
  nickname: string;
  profileImageURL?: string;
  blockedDate: Date;
}

interface Props {
  navigation: any;
}

export const BlockedUsersScreen: React.FC<Props> = ({ navigation }) => {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Mock data for now (in production, this would come from API)
  const mockBlockedUsers: BlockedUser[] = [
    {
      id: 'user1',
      nickname: 'user_example',
      profileImageURL: 'https://via.placeholder.com/150',
      blockedDate: new Date('2025-09-10'),
    },
    {
      id: 'user2',
      nickname: 'another_user',
      blockedDate: new Date('2025-09-08'),
    },
  ];

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const users = await profileService.getBlockedUsers();
      setBlockedUsers(mockBlockedUsers);
    } catch (error) {
      Alert.alert('Error', 'Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblockUser = async (userId: string, userName: string) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${userName}? They will be able to interact with you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Unblock', 
          onPress: () => unblockUser(userId)
        }
      ]
    );
  };

  const unblockUser = async (userId: string) => {
    try {
      await profileService.unblockUser(userId);
      
      // Remove from local state
      setBlockedUsers(prev => prev.filter(user => user.id !== userId));
      
      Alert.alert('Success', 'User has been unblocked');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to unblock user');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBlockedUsers();
    setRefreshing(false);
  };

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => (
    <ListItem containerStyle={styles.listItem} key={item.id}>
      <Avatar
        key="avatar"
        size="medium"
        rounded
        source={{ uri: item.profileImageURL || 'https://via.placeholder.com/150' }}
        title={item.nickname.charAt(0).toUpperCase()}
        containerStyle={styles.avatar}
      />
      
      <ListItem.Content key="content">
        <View>
          <ListItem.Title style={styles.userName}>{item.nickname}</ListItem.Title>
          <ListItem.Subtitle style={styles.blockedDate}>
            Blocked on {item.blockedDate.toLocaleDateString()}
          </ListItem.Subtitle>
        </View>
      </ListItem.Content>

      <Button
        key="action"
        title="Unblock"
        onPress={() => handleUnblockUser(item.id, item.nickname)}
        buttonStyle={styles.unblockButton}
        titleStyle={styles.unblockButtonText}
        type="outline"
      />
    </ListItem>
  );

  const EmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Icon name="block" size={80} color={APP_CONFIG.COLORS.TEXT_SECONDARY} />
      <Text style={styles.emptyTitle}>No Blocked Users</Text>
      <Text style={styles.emptySubtitle}>
        Users you block will appear here. You can unblock them anytime.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Card containerStyle={styles.headerCard}>
        <View style={styles.header}>
          <Icon name="block" size={30} color={APP_CONFIG.COLORS.ERROR} />
          <Text style={styles.title}>Blocked Users</Text>
          <Text style={styles.subtitle}>
            Manage users you've blocked. Blocked users cannot see your profile or send you messages.
          </Text>
        </View>
      </Card>

      <FlatList
        data={blockedUsers}
        renderItem={renderBlockedUser}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={blockedUsers.length === 0 ? styles.emptyListContainer : undefined}
        ListEmptyComponent={EmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[APP_CONFIG.COLORS.PRIMARY]}
            tintColor={APP_CONFIG.COLORS.PRIMARY}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {blockedUsers.length > 0 && (
        <View style={styles.infoBox}>
          <Icon name="info" size={20} color={APP_CONFIG.COLORS.PRIMARY} />
          <Text style={styles.infoText}>
            Tap "Unblock" to allow users to interact with you again. 
            This action is immediate and cannot be undone.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
  },
  headerCard: {
    margin: 15,
    marginBottom: 10,
    borderRadius: 12,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    marginTop: 10,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    flex: 1,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
  },
  listItem: {
    backgroundColor: APP_CONFIG.COLORS.SURFACE,
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 8,
    paddingVertical: 15,
  },
  avatar: {
    backgroundColor: APP_CONFIG.COLORS.PRIMARY,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
  },
  blockedDate: {
    fontSize: 14,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  unblockButton: {
    borderColor: APP_CONFIG.COLORS.PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  unblockButtonText: {
    color: APP_CONFIG.COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 15,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: APP_CONFIG.COLORS.PRIMARY + '10',
    margin: 15,
    padding: 15,
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    lineHeight: 20,
  },
});
