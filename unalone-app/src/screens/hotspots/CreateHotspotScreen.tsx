// Screen for creating new hotspots with form validation and location picker
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { hotspotService } from '../../services/HotspotService';
import { locationService } from '../../services/LocationService';
import { CreateHotspotRequest, HotspotCategory, LocationCoordinates } from '../../types';
import { APP_COLORS } from '../../utils/constants';

interface Props {
  navigation: any;
  route: {
    params?: {
      location?: LocationCoordinates;
    };
  };
}

const CATEGORIES: { value: HotspotCategory; label: string; icon: string }[] = [
  { value: 'cafe', label: 'Cafe', icon: 'cafe' },
  { value: 'restaurant', label: 'Restaurant', icon: 'restaurant' },
  { value: 'park', label: 'Park', icon: 'leaf' },
  { value: 'gym', label: 'Gym', icon: 'fitness' },
  { value: 'library', label: 'Library', icon: 'library' },
  { value: 'beach', label: 'Beach', icon: 'water' },
  { value: 'bar', label: 'Bar', icon: 'wine' },
  { value: 'event', label: 'Event', icon: 'calendar' },
  { value: 'study', label: 'Study', icon: 'school' },
  { value: 'sports', label: 'Sports', icon: 'basketball' },
  { value: 'shopping', label: 'Shopping', icon: 'bag' },
  { value: 'entertainment', label: 'Entertainment', icon: 'musical-notes' },
  { value: 'other', label: 'Other', icon: 'ellipse' },
];

const CreateHotspotScreen: React.FC<Props> = ({ navigation, route }) => {
  const mapRef = useRef<MapView>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'cafe' as HotspotCategory,
    maxCapacity: '',
    isPublic: true,
    tags: '',
    scheduledTime: null as Date | null,
    endTime: null as Date | null,
    imageUrl: '',
  });

  // Location state
  const [location, setLocation] = useState<LocationCoordinates>({
    latitude: route.params?.location?.latitude || 37.78825,
    longitude: route.params?.location?.longitude || -122.4324,
  });
  const [address, setAddress] = useState('');
  // Track picker center without re-rendering on every drag
  const pickerCenterRef = useRef<LocationCoordinates | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize with current location if not provided
  useEffect(() => {
    if (!route.params?.location) {
      getCurrentLocation();
    } else {
      getAddressFromLocation(location);
    }
  }, []);

  // When opening the location picker, initialize the picker center from current location
  useEffect(() => {
    if (showLocationPicker) {
      pickerCenterRef.current = { latitude: location.latitude, longitude: location.longitude };
    }
  }, [showLocationPicker]);

  const getCurrentLocation = async () => {
    try {
      const currentLocation = await locationService.getCurrentLocation();
      if (currentLocation) {
        const newLocation = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        };
        setLocation(newLocation);
        getAddressFromLocation(newLocation);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
    }
  };

  const getAddressFromLocation = async (coords: LocationCoordinates) => {
    try {
      const addressString = await locationService.getAddressFromCoordinates(
        coords.latitude,
        coords.longitude
      );
      if (addressString) {
        setAddress(addressString);
      }
    } catch (error) {
      console.error('Error getting address:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Name must be less than 100 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    } else if (formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    // Backend requires min=1,max=1000 (not optional)
    if (!formData.maxCapacity.trim()) {
      newErrors.maxCapacity = 'Capacity is required (1-1000)';
    } else {
      const capacity = parseInt(formData.maxCapacity, 10);
      if (isNaN(capacity) || capacity < 1 || capacity > 1000) {
        newErrors.maxCapacity = 'Capacity must be between 1 and 1000';
      }
    }

    if (formData.scheduledTime && formData.endTime) {
      if (formData.endTime <= formData.scheduledTime) {
        newErrors.endTime = 'End time must be after start time';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Cross-platform date picker openers
  const openStartDatePicker = () => {
    if (Platform.OS === 'android') {
      // Android: open date, then time, then combine
      const start = formData.scheduledTime || new Date();
      DateTimePickerAndroid.open({
        value: start,
        mode: 'date',
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type !== 'set' || !date) return;
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            onChange: (event2: DateTimePickerEvent, time?: Date) => {
              if (event2.type !== 'set' || !time) return;
              const combined = new Date(
                date.getFullYear(), date.getMonth(), date.getDate(),
                time.getHours(), time.getMinutes(), 0, 0
              );
              setFormData(prev => ({ ...prev, scheduledTime: combined }));
            },
          });
        },
      });
    } else {
      setShowDatePicker(true);
    }
  };

  const openEndDatePicker = () => {
    if (Platform.OS === 'android') {
      const base = formData.endTime || formData.scheduledTime || new Date();
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type !== 'set' || !date) return;
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            onChange: (event2: DateTimePickerEvent, time?: Date) => {
              if (event2.type !== 'set' || !time) return;
              const combined = new Date(
                date.getFullYear(), date.getMonth(), date.getDate(),
                time.getHours(), time.getMinutes(), 0, 0
              );
              setFormData(prev => ({ ...prev, endTime: combined }));
            },
          });
        },
      });
    } else {
      setShowEndDatePicker(true);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before submitting');
      return;
    }

    setLoading(true);
    try {
      const tagsArray = formData.tags
        ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
        : [];

      const createRequest: CreateHotspotRequest = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        location,
        address: {
          street: '',
          city: (address.split(',')[0] || '').trim() || 'Unknown City',
          region: (address.split(',')[1] || '').trim(),
          country: (address.split(',')[2] || '').trim() || 'Unknown Country',
          postalCode: '',
        },
  maxCapacity: parseInt(formData.maxCapacity, 10),
        isPublic: formData.isPublic,
        tags: tagsArray,
  scheduledTime: formData.scheduledTime || undefined,
  endTime: formData.endTime || undefined,
        imageUrl: formData.imageUrl || undefined,
      };

      await hotspotService.createHotspot(createRequest);
      
      Alert.alert('Success', 'Hotspot created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create hotspot');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (region: Region) => {
    const newLocation = {
      latitude: region.latitude,
      longitude: region.longitude,
    };
    setLocation(newLocation);
    getAddressFromLocation(newLocation);
  };

  const CategoryPicker = () => (
    <Modal
      visible={showCategoryPicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowCategoryPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.pickerModal}>
          <Text style={styles.pickerTitle}>Select Category</Text>
          
          <ScrollView style={styles.categoryList}>
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.value}
                style={[
                  styles.categoryItem,
                  formData.category === category.value && styles.selectedCategory
                ]}
                onPress={() => {
                  setFormData(prev => ({ ...prev, category: category.value }));
                  setShowCategoryPicker(false);
                }}
              >
                <Ionicons 
                  name={category.icon as any} 
                  size={24} 
                  color={formData.category === category.value ? 'white' : APP_COLORS.primary} 
                />
                <Text style={[
                  styles.categoryLabel,
                  formData.category === category.value && styles.selectedCategoryLabel
                ]}>
                  {category.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setShowCategoryPicker(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const LocationPicker = () => (
    <Modal
      visible={showLocationPicker}
      animationType="slide"
      onRequestClose={() => setShowLocationPicker(false)}
    >
      <View style={styles.locationModal}>
        <View style={styles.locationHeader}>
          <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.locationTitle}>Select Location</Text>
          <TouchableOpacity onPress={() => {
            // Commit the selection only when user taps Done
            const center = pickerCenterRef.current || location;
            setLocation(center);
            getAddressFromLocation(center);
            setShowLocationPicker(false);
          }}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
        
        <MapView
          ref={mapRef}
          style={styles.locationMap}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          // Update only the ref so no re-render happens while dragging
          onRegionChangeComplete={(region) => {
            pickerCenterRef.current = { latitude: region.latitude, longitude: region.longitude };
          }}
        >
          {/* Deliberately no marker while choosing; we show a crosshair overlay */}
        </MapView>
        
        <View style={styles.crosshair}>
          <Ionicons name="location" size={30} color={APP_COLORS.primary} />
        </View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={APP_COLORS.primary} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Create Hotspot</Text>
        
        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        {/* Name */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={formData.name}
            onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
            placeholder="Enter hotspot name"
            maxLength={100}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        {/* Description */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.textArea, errors.description && styles.inputError]}
            value={formData.description}
            onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
            placeholder="Describe your hotspot"
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
        </View>

        {/* Category */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Category *</Text>
          <TouchableOpacity 
            style={styles.picker}
            onPress={() => setShowCategoryPicker(true)}
          >
            <View style={styles.pickerContent}>
              <Ionicons 
                name={CATEGORIES.find(c => c.value === formData.category)?.icon as any} 
                size={20} 
                color={APP_COLORS.primary} 
              />
              <Text style={styles.pickerText}>
                {CATEGORIES.find(c => c.value === formData.category)?.label}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={APP_COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Location */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Location *</Text>
          <TouchableOpacity 
            style={styles.picker}
            onPress={() => setShowLocationPicker(true)}
          >
            <View style={styles.pickerContent}>
              <Ionicons name="location" size={20} color={APP_COLORS.primary} />
              <Text style={styles.pickerText} numberOfLines={1}>
                {address || 'Select location'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={APP_COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Max Capacity (Required by backend) */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Max Capacity *</Text>
          <TextInput
            style={[styles.input, errors.maxCapacity && styles.inputError]}
            value={formData.maxCapacity}
            onChangeText={(text) => setFormData(prev => ({ ...prev, maxCapacity: text }))}
            placeholder="Enter max capacity (1-1000)"
            keyboardType="numeric"
            maxLength={4}
          />
          {errors.maxCapacity && <Text style={styles.errorText}>{errors.maxCapacity}</Text>}
        </View>

        {/* Tags */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Tags (Optional)</Text>
          <TextInput
            style={styles.input}
            value={formData.tags}
            onChangeText={(text) => setFormData(prev => ({ ...prev, tags: text }))}
            placeholder="Enter tags separated by commas"
          />
          <Text style={styles.helperText}>e.g. coffee, wifi, quiet, outdoor</Text>
        </View>

        {/* Scheduled Time */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Scheduled Time (Optional)</Text>
          <TouchableOpacity 
            style={styles.picker}
            onPress={openStartDatePicker}
          >
            <View style={styles.pickerContent}>
              <Ionicons name="time" size={20} color={APP_COLORS.primary} />
              <Text style={styles.pickerText}>
                {formData.scheduledTime 
                  ? formData.scheduledTime.toLocaleString()
                  : 'Select start time'
                }
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={APP_COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* End Time */}
        {formData.scheduledTime && (
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>End Time (Optional)</Text>
            <TouchableOpacity 
              style={styles.picker}
              onPress={openEndDatePicker}
            >
              <View style={styles.pickerContent}>
                <Ionicons name="time" size={20} color={APP_COLORS.primary} />
                <Text style={styles.pickerText}>
                  {formData.endTime 
                    ? formData.endTime.toLocaleString()
                    : 'Select end time'
                  }
                </Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={APP_COLORS.textSecondary} />
            </TouchableOpacity>
            {errors.endTime && <Text style={styles.errorText}>{errors.endTime}</Text>}
          </View>
        )}

        {/* Public/Private Toggle */}
        <View style={styles.fieldContainer}>
          <View style={styles.toggleContainer}>
            <View>
              <Text style={styles.label}>Visibility</Text>
              <Text style={styles.helperText}>
                {formData.isPublic ? 'Anyone can find and join' : 'Only people you invite can join'}
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.toggle, formData.isPublic && styles.toggleActive]}
              onPress={() => setFormData(prev => ({ ...prev, isPublic: !prev.isPublic }))}
            >
              <View style={[styles.toggleThumb, formData.isPublic && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Date Pickers (iOS only as inline component; Android uses DateTimePickerAndroid.open) */}
      {Platform.OS === 'ios' && showDatePicker && (
        <DateTimePicker
          value={formData.scheduledTime || new Date()}
          mode="datetime"
          display="inline"
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            // Delay hiding to avoid internal dismiss timing issues
            setTimeout(() => setShowDatePicker(false), 0);
            if (event.type === 'set' && selectedDate) {
              setFormData(prev => ({ ...prev, scheduledTime: selectedDate }));
            }
          }}
        />
      )}

      {Platform.OS === 'ios' && showEndDatePicker && (
        <DateTimePicker
          value={formData.endTime || (formData.scheduledTime || new Date())}
          mode="datetime"
          display="inline"
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            setTimeout(() => setShowEndDatePicker(false), 0);
            if (event.type === 'set' && selectedDate) {
              setFormData(prev => ({ ...prev, endTime: selectedDate }));
            }
          }}
        />
      )}

      <CategoryPicker />
      <LocationPicker />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
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
  submitButton: {
    backgroundColor: APP_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  form: {
    flex: 1,
    paddingHorizontal: 20,
  },
  fieldContainer: {
    marginTop: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_COLORS.textPrimary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  inputError: {
    borderColor: APP_COLORS.error,
  },
  errorText: {
    color: APP_COLORS.error,
    fontSize: 12,
    marginTop: 4,
  },
  helperText: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  picker: {
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pickerText: {
    fontSize: 16,
    color: APP_COLORS.textPrimary,
    marginLeft: 8,
    flex: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: APP_COLORS.lightGray,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: APP_COLORS.primary,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'white',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  bottomSpacing: {
    height: 50,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModal: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    maxHeight: '70%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  categoryList: {
    maxHeight: 400,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: APP_COLORS.lightGray,
  },
  selectedCategory: {
    backgroundColor: APP_COLORS.primary,
  },
  categoryLabel: {
    fontSize: 16,
    color: APP_COLORS.textPrimary,
    marginLeft: 12,
  },
  selectedCategoryLabel: {
    color: 'white',
  },
  closeButton: {
    backgroundColor: APP_COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  locationModal: {
    flex: 1,
    backgroundColor: 'white',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.border,
  },
  cancelText: {
    color: APP_COLORS.textSecondary,
    fontSize: 16,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: APP_COLORS.textPrimary,
  },
  doneText: {
    color: APP_COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationMap: {
    flex: 1,
  },
  crosshair: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -15,
    marginTop: -15,
    zIndex: 1,
  },
});

export default CreateHotspotScreen;
