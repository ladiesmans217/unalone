// Detailed view of a specific hotspot with join/leave functionality
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Share,
  Linking,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { hotspotService } from '../../services/HotspotService';
import { locationService } from '../../services/LocationService';
import { Hotspot, HotspotCategory } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { APP_COLORS } from '../../utils/constants';

interface Props {
  navigation: any;
  route: {
    params: {
      hotspotId: string;
    };
  };
}

const CATEGORY_ICONS: Record<HotspotCategory, string> = {
  cafe: 'cafe',
  restaurant: 'restaurant',
  park: 'leaf',
  gym: 'fitness',
  library: 'library',
  beach: 'water',
  bar: 'wine',
  event: 'calendar',
  study: 'school',
  sports: 'basketball',
  shopping: 'bag',
  entertainment: 'musical-notes',
  other: 'ellipse',
};

const HotspotDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { hotspotId } = route.params;
  const { user } = useAuth();
  
  // State
  const [hotspot, setHotspot] = useState<Hotspot | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);

  // Load hotspot data
  useEffect(() => {
    loadHotspot();
    calculateDistance();
  }, [hotspotId]);

  // Refresh on screen focus
  useFocusEffect(
    React.useCallback(() => {
      loadHotspot();
      return () => {};
    }, [hotspotId])
  );

  const loadHotspot = async () => {
    try {
      // Bypass cache to ensure latest attendees state for chat visibility
      const hotspotData = await hotspotService.getHotspot(hotspotId, false);
      setHotspot(hotspotData);
    } catch (error) {
      console.error('Error loading hotspot:', error);
      Alert.alert('Error', 'Failed to load hotspot details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = async () => {
    try {
      const currentLocation = await locationService.getCurrentLocation();
      if (currentLocation && hotspot) {
        const dist = locationService.calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          hotspot.location.latitude,
          hotspot.location.longitude
        );
        setDistance(dist);
      }
    } catch (error) {
      console.error('Error calculating distance:', error);
    }
  };

  const handleJoinHotspot = async () => {
    if (!hotspot || !user) return;

    // Check if user is already in the hotspot
    if (hotspot.attendees.includes(user.id)) {
      Alert.alert('Already Joined', 'You are already in this hotspot');
      return;
    }

    // Check capacity
    if (hotspot.maxCapacity && hotspot.currentOccupancy >= hotspot.maxCapacity) {
      Alert.alert('Full Capacity', 'This hotspot is at maximum capacity');
      return;
    }

    setActionLoading(true);
    try {
      const updatedHotspot = await hotspotService.joinHotspot(hotspotId);
      setHotspot(updatedHotspot);
      Alert.alert('Success', `You've joined ${hotspot.name}!`);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to join hotspot');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveHotspot = async () => {
    if (!hotspot || !user) return;

    Alert.alert(
      'Leave Hotspot',
      'Are you sure you want to leave this hotspot?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const updatedHotspot = await hotspotService.leaveHotspot(hotspotId);
              setHotspot(updatedHotspot);
              Alert.alert('Left', 'You have left the hotspot');
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to leave hotspot');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    navigation.navigate('EditHotspot', { hotspotId });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Hotspot',
      'Are you sure you want to delete this hotspot? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await hotspotService.deleteHotspot(hotspotId);
              Alert.alert('Deleted', 'Hotspot has been deleted', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete hotspot');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    if (!hotspot) return;

    try {
      await Share.share({
        message: `Check out this hotspot: ${hotspot.name}\n${hotspot.description}`,
        title: hotspot.name,
      });
    } catch (error) {
      console.error('Error sharing hotspot:', error);
    }
  };

  const handleDirections = async () => {
    if (!hotspot) return;

    // Open in default maps app (prefer geo: if supported, else https fallback)
    const lat = hotspot.location.latitude;
    const lon = hotspot.location.longitude;
    const geoUrl = `geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent(hotspot.name)})`;
    const httpUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

    try {
      const supported = await Linking.canOpenURL(geoUrl);
      const url = supported ? geoUrl : httpUrl;
      await Linking.openURL(url);
    } catch (e) {
      console.error('Failed to open maps', e);
      Alert.alert('Error', 'Could not open the maps app');
    }
  };

  const formatDistance = (dist: number): string => {
    if (dist < 1) {
      return `${Math.round(dist * 1000)}m away`;
    }
    return `${dist.toFixed(1)}km away`;
  };

  const formatTime = (date: string | undefined): string => {
    if (!date) return '';
    
    const now = new Date();
    const hotspotDate = new Date(date);
    const diffMs = hotspotDate.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 0) return 'Started';
    if (diffHours === 0) return 'Starting now';
    if (diffHours < 24) return `Starts in ${diffHours}h`;
    
    const diffDays = Math.round(diffHours / 24);
    return `Starts in ${diffDays}d`;
  };

  const getOccupancyColor = (current: number, max: number): string => {
    if (!max) return APP_COLORS.success;
    
    const ratio = current / max;
    if (ratio < 0.5) return APP_COLORS.success;
    if (ratio < 0.8) return APP_COLORS.warning;
    return APP_COLORS.error;
  };

  const isUserJoined = (): boolean => {
    return hotspot?.attendees.includes(user?.id || '') || false;
  };

  const isCreator = (): boolean => {
    return hotspot?.createdBy === user?.id;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={APP_COLORS.primary} />
        <Text style={styles.loadingText}>Loading hotspot...</Text>
      </View>
    );
  }

  if (!hotspot) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color={APP_COLORS.error} />
        <Text style={styles.errorTitle}>Hotspot not found</Text>
        <TouchableOpacity 
          style={styles.errorButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const occupancyColor = getOccupancyColor(hotspot.currentOccupancy, hotspot.maxCapacity ?? 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleShare}
          >
            <Ionicons name="share" size={24} color="white" />
          </TouchableOpacity>
          
          {isCreator() && (
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={handleEdit}
            >
              <Ionicons name="create" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Info */}
        <View style={styles.mainInfo}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={CATEGORY_ICONS[hotspot.category] as any} 
              size={32} 
              color={APP_COLORS.primary} 
            />
          </View>
          
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{hotspot.name}</Text>
            <Text style={styles.category}>{hotspot.category}</Text>
            {distance && (
              <Text style={styles.distance}>{formatDistance(distance)}</Text>
            )}
          </View>
          
          <View style={[styles.occupancyBadge, { backgroundColor: occupancyColor }]}>
            <Text style={styles.occupancyText}>
              {hotspot.currentOccupancy}/{hotspot.maxCapacity && hotspot.maxCapacity > 0 ? hotspot.maxCapacity : '∞'}
            </Text>
          </View>
        </View>

        {/* Status */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: hotspot.isActive ? APP_COLORS.success : APP_COLORS.textSecondary }]}>
            <Text style={styles.statusText}>
              {hotspot.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
          
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {hotspot.isPublic ? 'Public' : 'Private'}
            </Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{hotspot.description}</Text>
        </View>

        {/* Time Info */}
        {(hotspot.scheduledTime || hotspot.endTime) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule</Text>
            {hotspot.scheduledTime && (
              <View style={styles.timeRow}>
                <Ionicons name="play" size={16} color={APP_COLORS.primary} />
                <Text style={styles.timeText}>
                  Starts: {new Date(hotspot.scheduledTime).toLocaleString()}
                </Text>
              </View>
            )}
            {hotspot.endTime && (
              <View style={styles.timeRow}>
                <Ionicons name="stop" size={16} color={APP_COLORS.error} />
                <Text style={styles.timeText}>
                  Ends: {new Date(hotspot.endTime).toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tags */}
        {hotspot.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagsContainer}>
              {hotspot.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              region={{
                latitude: hotspot.location.latitude,
                longitude: hotspot.location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker coordinate={hotspot.location} />
            </MapView>
            
            <TouchableOpacity 
              style={styles.directionsButton}
              onPress={handleDirections}
            >
              <Ionicons name="navigate" size={20} color="white" />
              <Text style={styles.directionsText}>Directions</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Creator Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Created by</Text>
          <View style={styles.creatorInfo}>
            <View style={styles.creatorAvatar}>
              {(() => {
                const nick = hotspot.createdByNickname || hotspot.createdBy || 'U';
                const initial = typeof nick === 'string' && nick.length > 0 ? nick.charAt(0).toUpperCase() : 'U';
                return <Text style={styles.creatorInitial}>{initial}</Text>;
              })()}
            </View>
            <Text style={styles.creatorName}>{hotspot.createdByNickname || 'Unknown user'}</Text>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        {isUserJoined() ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Open Chat */}
            <TouchableOpacity 
              style={[styles.primaryButton, actionLoading && styles.disabledButton, { flex: 1 }]}
              onPress={() => navigation.navigate('ChatRoom', { hotspotId, hotspotName: hotspot.name })}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="chatbubbles" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Open Chat</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Leave or Delete */}
            {isCreator() ? (
              <TouchableOpacity 
                style={[styles.deleteButton, actionLoading && styles.disabledButton, { flex: 1 }]}
                onPress={handleDelete}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="trash" size={20} color="white" />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.leaveButton, actionLoading && styles.disabledButton, { flex: 1 }]}
                onPress={handleLeaveHotspot}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="exit" size={20} color="white" />
                    <Text style={styles.actionButtonText}>Leave</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.joinButton, actionLoading && styles.disabledButton]}
            onPress={handleJoinHotspot}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="enter" size={20} color="white" />
                <Text style={styles.actionButtonText}>Join</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_COLORS.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: APP_COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: APP_COLORS.background,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: APP_COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: APP_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  errorButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: APP_COLORS.primary,
  },
  backButton: {
    padding: 5,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 10,
  },
  content: {
    flex: 1,
  },
  mainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.border,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: APP_COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: APP_COLORS.textPrimary,
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    color: APP_COLORS.textSecondary,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  distance: {
    fontSize: 12,
    color: APP_COLORS.primary,
  },
  occupancyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  occupancyText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  statusContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.border,
  },
  statusBadge: {
    backgroundColor: APP_COLORS.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: APP_COLORS.textPrimary,
  },
  section: {
    backgroundColor: 'white',
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: APP_COLORS.textPrimary,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: APP_COLORS.textSecondary,
    lineHeight: 20,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
    color: APP_COLORS.textSecondary,
    marginLeft: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: APP_COLORS.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  directionsButton: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    backgroundColor: APP_COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  directionsText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: APP_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  creatorInitial: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  creatorName: {
    fontSize: 14,
    color: APP_COLORS.textPrimary,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 100,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: APP_COLORS.border,
  },
  joinButton: {
    backgroundColor: APP_COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButton: {
    backgroundColor: APP_COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  secondaryButton: {
    backgroundColor: APP_COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  leaveButton: {
    backgroundColor: APP_COLORS.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  deleteButton: {
    backgroundColor: APP_COLORS.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default HotspotDetailsScreen;
