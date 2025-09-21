// Simple map screen showing hotspots from the same list API as "Find Hotspots"
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_GOOGLE, AnimatedRegion, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { hotspotService } from '../../services/HotspotService';
import { HotspotWithDistance as HotspotWithDistanceType } from '../../types';
import { locationService, LocationData } from '../../services/LocationService';
import { 
  Hotspot, 
  HotspotCategory, 
  HotspotSearchFilters 
} from '../../types';
import { APP_COLORS } from '../../utils/constants';

interface Props {
  navigation: any;
}

const INITIAL_REGION = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const CATEGORY_COLORS: Record<HotspotCategory, string> = {
  cafe: '#8B4513',
  restaurant: '#FF6347',
  park: '#32CD32',
  gym: '#FF4500',
  library: '#4169E1',
  beach: '#00CED1',
  bar: '#FFD700',
  event: '#FF69B4',
  study: '#9370DB',
  sports: '#FF8C00',
  shopping: '#DA70D6',
  entertainment: '#FF1493',
  other: '#808080',
};

const HotspotMapScreen: React.FC<Props> = ({ navigation }) => {
  const mapRef = useRef<MapView>(null);
  
  // State
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [hotspots, setHotspots] = useState<HotspotWithDistanceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [region, setRegion] = useState<Region>(INITIAL_REGION);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<HotspotSearchFilters>({
    radius: 10,
    limit: 50,
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Load current location and initial hotspots
  useFocusEffect(
    useCallback(() => {
      loadCurrentLocation();
      loadCachedHotspots();
    }, [])
  );

  const loadCurrentLocation = async () => {
    try {
      const location = await locationService.getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        
        const newRegion = {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 1000);
        
  // Load nearby hotspots
  loadNearbyHotspotsLegacy(location);
      }
    } catch (error) {
      console.error('Error loading current location:', error);
      Alert.alert('Location Error', 'Could not get your current location. Please check your location settings.');
    }
  };

  const loadCachedHotspots = async () => {
    try {
      await hotspotService.loadCacheFromDisk();
    } catch (error) {
      console.error('Error loading cached hotspots:', error);
    }
  };

  // Use the same legacy list API as Find Hotspots for consistency
  const loadNearbyHotspotsLegacy = async (location: LocationData) => {
    try {
      setSearching(true);
      const legacy = await hotspotService.searchHotspots(
        { latitude: location.latitude, longitude: location.longitude },
        { radius: filters.radius || 10, limit: filters.limit || 50 }
      );
      setHotspots(legacy.hotspots);
      await hotspotService.saveCacheToDisk();
    } catch (error) {
      console.error('Error loading nearby hotspots:', error);
      const message = error instanceof Error ? error.message : 'Failed to load nearby hotspots';
      Alert.alert('Failed to load nearby hotspots', message);
    } finally {
      setSearching(false);
      setLoading(false);
    }
  };

  // Debounce timer for region-based searches
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRegionChangeComplete = useCallback((newRegion: Region) => {
    setRegion(newRegion);
    // Throttle API calls - only search when user stops moving map for 1 second
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      searchHotspotsInRegionLegacy(newRegion);
    }, 1000);
  }, [filters]);


  const searchHotspotsInRegionLegacy = async (searchRegion: Region) => {
    try {
      setSearching(true);
      const radius = Math.max(filters.radius || 10, getRegionRadius(searchRegion));
      const legacy = await hotspotService.searchHotspots(
        { latitude: searchRegion.latitude, longitude: searchRegion.longitude },
        { radius, limit: filters.limit || 50 }
      );
      setHotspots(legacy.hotspots);
      await hotspotService.saveCacheToDisk();
    } catch (error) {
      console.error('Error searching hotspots in region:', error);
      const message = error instanceof Error ? error.message : 'Search failed';
      Alert.alert('Search failed', message);
    } finally {
      setSearching(false);
    }
  };

  // Helpers

  const getRegionRadius = (searchRegion: Region): number => {
    // Calculate approximate radius from region delta
    const latRadius = searchRegion.latitudeDelta * 111; // 1 degree ≈ 111 km
    const lonRadius = searchRegion.longitudeDelta * 111 * Math.cos(searchRegion.latitude * Math.PI / 180);
    return Math.max(latRadius, lonRadius) / 2;
  };

  const formatDistance = (distance: number): string => {
    if (distance < 1) return `${Math.round(distance * 1000)}m`;
    return `${distance.toFixed(1)}km`;
  };

  const getFirstLine = (text?: string): string => {
    if (!text) return '';
    const firstLine = text.split(/\r?\n/)[0];
    return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
  };

  const handleMarkerPress = (hotspot: Hotspot) => {
    navigation.navigate('HotspotDetails', { hotspotId: hotspot.id });
  };

  const handleCreateHotspot = () => {
    // Allow creation using current map center even if GPS hasn't resolved yet
    const target = {
      latitude: region.latitude,
      longitude: region.longitude,
    };

    if (!currentLocation) {
      // Soft notice only; proceed
      console.log('Proceeding to create hotspot using map center since GPS is not yet available');
    }

    navigation.navigate('CreateHotspot', { location: target });
  };

  const handleMyLocation = () => {
    if (currentLocation) {
      const newRegion = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
    } else {
      loadCurrentLocation();
    }
  };

  const applyFilters = (newFilters: HotspotSearchFilters) => {
    setFilters(newFilters);
    setShowFilters(false);
    
    if (currentLocation) {
      loadNearbyHotspotsLegacy(currentLocation);
    }
  };

  const renderMarker = (item: HotspotWithDistanceType) => {
    const { hotspot } = item;
    const color = CATEGORY_COLORS[hotspot.category as HotspotCategory] || CATEGORY_COLORS.other;
    const base = currentLocation
      ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude }
      : { latitude: region.latitude, longitude: region.longitude };
    const distance = item.distance && item.distance > 0
      ? item.distance
      : hotspotService.calculateDistance(
          base.latitude,
          base.longitude,
          hotspot.location.latitude,
          hotspot.location.longitude
        );
    
    return (
      <Marker
        key={hotspot.id}
        coordinate={{
          latitude: hotspot.location.latitude,
          longitude: hotspot.location.longitude,
        }}
        pinColor={color}
        onPress={() => handleMarkerPress(hotspot)}
      >
        <View style={[styles.customMarker, { backgroundColor: color }]}>
          <Text style={styles.markerText}>{hotspot.currentOccupancy}</Text>
        </View>
      </Marker>
    );
  };

  const FilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.filterModal}>
          <Text style={styles.modalTitle}>Filter Hotspots</Text>
          
          {/* Radius slider would go here */}
          <Text>Radius: {filters.radius}km</Text>
          
          {/* Category picker would go here */}
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalButton, styles.primaryButton]}
              onPress={() => applyFilters(filters)}
            >
              <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search hotspots..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="filter" size={20} color={APP_COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        loadingEnabled={true}
      >
        {/* Render individual hotspots from legacy list */}
        {hotspots.map(renderMarker)}
      </MapView>

      {/* Loading Indicator */}
      {searching && (
        <View style={styles.searchingIndicator}>
          <ActivityIndicator size="small" color={APP_COLORS.primary} />
          <Text style={styles.searchingText}>Searching...</Text>
        </View>
      )}

      {/* Performance Stats removed for simplicity */}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleMyLocation}
        >
          <Ionicons name="location" size={24} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('HotspotList')}
        >
          <Ionicons name="list" size={24} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.createButton]}
          onPress={handleCreateHotspot}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      </View>

      <FilterModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: APP_COLORS.textSecondary,
  },
  searchContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 1,
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
  },
  filterButton: {
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    flex: 1,
  },
  customMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  markerText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  clusterMarker: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  clusterText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  calloutContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    maxWidth: 240,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: APP_COLORS.textPrimary,
  },
  calloutSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  calloutMeta: {
    marginTop: 6,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  calloutMore: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  calloutMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: APP_COLORS.primary,
  },
  searchingIndicator: {
    position: 'absolute',
    top: 120,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  searchingText: {
    marginLeft: 8,
    fontSize: 14,
    color: APP_COLORS.textSecondary,
  },
  performanceStats: {
    position: 'absolute',
    top: 155,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  statsText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  actionButtons: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    alignItems: 'center',
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: APP_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  createButton: {
    backgroundColor: APP_COLORS.accent,
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModal: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    backgroundColor: APP_COLORS.lightGray,
  },
  primaryButton: {
    backgroundColor: APP_COLORS.primary,
  },
  modalButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: 'white',
  },
});

export default HotspotMapScreen;
