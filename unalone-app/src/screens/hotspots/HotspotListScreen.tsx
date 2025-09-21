// List view for browsing hotspots with filtering and sorting
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { hotspotService } from '../../services/HotspotService';
import { HotspotWithDistance } from '../../types';
import { locationService, LocationData } from '../../services/LocationService';
import { Hotspot, HotspotCategory, HotspotSearchFilters } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { APP_COLORS } from '../../utils/constants';

interface Props {
  navigation: any;
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

const HotspotListScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  // State
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [hotspots, setHotspots] = useState<HotspotWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<HotspotSearchFilters>({
    radius: 10,
    limit: 20,
    offset: 0,
  });
  const [hasMore, setHasMore] = useState(true);

  // Load initial data
  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [])
  );

  const loadInitialData = async () => {
    try {
      // Load current location
      const location = await locationService.getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        await loadHotspots(location, { ...filters, offset: 0 });
      } else {
        Alert.alert('Location Required', 'Please enable location services to see nearby hotspots');
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load hotspots');
    } finally {
      setLoading(false);
    }
  };

  const loadHotspots = async (
    location: LocationData, 
    searchFilters: HotspotSearchFilters,
    append: boolean = false
  ) => {
    try {
      const response = await hotspotService.searchHotspots(
        { latitude: location.latitude, longitude: location.longitude },
        searchFilters
      );

      if (append) {
        setHotspots(prev => [...prev, ...response.hotspots]);
      } else {
        setHotspots(response.hotspots);
      }
      
      setHasMore(response.hasMore);
      
      // Save cache
      await hotspotService.saveCacheToDisk();
    } catch (error) {
      console.error('Error loading hotspots:', error);
      Alert.alert('Error', 'Failed to load hotspots');
    }
  };

  const handleRefresh = async () => {
    if (!currentLocation) return;
    
    setRefreshing(true);
    try {
      await loadHotspots(currentLocation, { ...filters, offset: 0 });
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (!currentLocation || !hasMore || loading) return;

    const newFilters = { ...filters, offset: hotspots.length };
    await loadHotspots(currentLocation, newFilters, true);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!currentLocation) return;

    // Simple client-side filtering for now
    // In production, you'd want server-side search
    if (!query.trim()) {
      await loadHotspots(currentLocation, { ...filters, offset: 0 });
      return;
    }

    const filtered = hotspots.filter(item =>
      item.hotspot.name.toLowerCase().includes(query.toLowerCase()) ||
      item.hotspot.description.toLowerCase().includes(query.toLowerCase()) ||
      item.hotspot.category.toLowerCase().includes(query.toLowerCase())
    );
    
    setHotspots(filtered);
  };

  const handleHotspotPress = (hotspot: Hotspot) => {
    navigation.navigate('HotspotDetails', { hotspotId: hotspot.id });
  };

  const handleJoinHotspot = async (hotspot: Hotspot) => {
    try {
      await hotspotService.joinHotspot(hotspot.id);
      Alert.alert('Success', `You've joined ${hotspot.name}!`);
      
      // Refresh the list
      if (currentLocation) {
        await loadHotspots(currentLocation, { ...filters, offset: 0 });
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to join hotspot');
    }
  };

  const formatDistance = (distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  const formatTime = (date: string | undefined): string => {
    if (!date) return '';
    
    const now = new Date();
    const hotspotDate = new Date(date);
    const diffMs = hotspotDate.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 0) return 'Started';
    if (diffHours === 0) return 'Starting now';
    if (diffHours < 24) return `In ${diffHours}h`;
    
    const diffDays = Math.round(diffHours / 24);
    return `In ${diffDays}d`;
  };

  const getOccupancyColor = (current: number, max: number): string => {
    if (!max) return APP_COLORS.success;
    
    const ratio = current / max;
    if (ratio < 0.5) return APP_COLORS.success;
    if (ratio < 0.8) return APP_COLORS.warning;
    return APP_COLORS.error;
  };

  const renderHotspotItem = ({ item }: { item: HotspotWithDistance }) => {
    const { hotspot, distance } = item;
  const occupancyColor = getOccupancyColor(hotspot.currentOccupancy, hotspot.maxCapacity ?? 0);
    const alreadyJoined = user ? (hotspot.attendees || []).includes(user.id) : false;
    
    return (
      <TouchableOpacity 
        style={styles.hotspotItem}
        onPress={() => handleHotspotPress(hotspot)}
      >
        <View style={styles.hotspotHeader}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={CATEGORY_ICONS[hotspot.category] as any} 
              size={24} 
              color={APP_COLORS.primary} 
            />
          </View>
          
          <View style={styles.hotspotInfo}>
            <Text style={styles.hotspotName}>{hotspot.name}</Text>
            <Text style={styles.hotspotCategory}>{hotspot.category}</Text>
            <Text style={styles.hotspotDescription} numberOfLines={2}>
              {hotspot.description}
            </Text>
          </View>
          
          <View style={styles.hotspotMeta}>
            <Text style={styles.distance}>{formatDistance(distance)}</Text>
            <View style={[styles.occupancyBadge, { backgroundColor: occupancyColor }]}>
              <Text style={styles.occupancyText}>
                {hotspot.currentOccupancy}/{hotspot.maxCapacity && hotspot.maxCapacity > 0 ? hotspot.maxCapacity : '∞'}
              </Text>
            </View>
          </View>
        </View>

        {hotspot.scheduledTime && (
          <View style={styles.timeContainer}>
            <Ionicons name="time" size={16} color={APP_COLORS.textSecondary} />
            <Text style={styles.timeText}>
              {formatTime(hotspot.scheduledTime)}
            </Text>
          </View>
        )}

        <View style={styles.hotspotFooter}>
          <View style={styles.tagsContainer}>
            {hotspot.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {hotspot.tags.length > 3 && (
              <Text style={styles.moreTagsText}>+{hotspot.tags.length - 3}</Text>
            )}
          </View>
          
          {alreadyJoined ? (
            <View style={[styles.joinButton, { backgroundColor: APP_COLORS.lightGray }]}> 
              <Text style={[styles.joinButtonText, { color: APP_COLORS.textSecondary }]}>Joined</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.joinButton}
              onPress={() => handleJoinHotspot(hotspot)}
            >
              <Text style={styles.joinButtonText}>Join</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="location-outline" size={64} color={APP_COLORS.textSecondary} />
      <Text style={styles.emptyTitle}>No hotspots found</Text>
      <Text style={styles.emptyDescription}>
        Try adjusting your search or check back later
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={APP_COLORS.primary} />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={APP_COLORS.primary} />
        <Text style={styles.loadingText}>Loading hotspots...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={APP_COLORS.primary} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Nearby Hotspots</Text>
        
        <TouchableOpacity 
          style={styles.mapButton}
          onPress={() => navigation.navigate('HotspotMap')}
        >
          <Ionicons name="map" size={24} color={APP_COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={APP_COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search hotspots..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close" size={20} color={APP_COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Hotspots List */}
      <FlatList
        data={hotspots}
        renderItem={renderHotspotItem}
        keyExtractor={(item) => item.hotspot.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[APP_COLORS.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={hotspots.length === 0 ? styles.emptyListContainer : styles.listContainer}
      />

      {/* Create Button */}
      <TouchableOpacity 
        style={styles.createButton}
        onPress={() => navigation.navigate('CreateHotspot')}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.border,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: APP_COLORS.textPrimary,
  },
  mapButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: APP_COLORS.textPrimary,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  hotspotItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  hotspotHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: APP_COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hotspotInfo: {
    flex: 1,
  },
  hotspotName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: APP_COLORS.textPrimary,
    marginBottom: 2,
  },
  hotspotCategory: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  hotspotDescription: {
    fontSize: 14,
    color: APP_COLORS.textSecondary,
    lineHeight: 18,
  },
  hotspotMeta: {
    alignItems: 'flex-end',
  },
  distance: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginBottom: 4,
  },
  occupancyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  occupancyText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeText: {
    marginLeft: 6,
    fontSize: 14,
    color: APP_COLORS.textSecondary,
  },
  hotspotFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tag: {
    backgroundColor: APP_COLORS.lightGray,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  tagText: {
    fontSize: 10,
    color: APP_COLORS.textSecondary,
  },
  moreTagsText: {
    fontSize: 10,
    color: APP_COLORS.textSecondary,
  },
  joinButton: {
    backgroundColor: APP_COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  joinButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: APP_COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: APP_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  createButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: APP_COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

export default HotspotListScreen;
