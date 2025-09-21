// Edit profile screen for updating user information
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Input, Button, Text, Card, CheckBox, Avatar } from 'react-native-elements';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { useAuth } from '../../contexts/AuthContext';
import { profileService, UpdateProfileRequest } from '../../services/ProfileService';
import { APP_CONFIG } from '../../utils/constants';

interface Props {
  navigation: any;
}

export const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    realName: user?.realName || '',
    nickname: user?.nickname || '',
    bio: user?.bio || '',
    dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth) : new Date(),
    gender: user?.gender || 'prefer-not-to-say',
    interests: user?.interests || [],
  });

  // Update form data when user context changes
  useEffect(() => {
    if (user) {
      setFormData({
        realName: user.realName || '',
        nickname: user.nickname || '',
        bio: user.bio || '',
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth) : new Date(),
        gender: user.gender || 'prefer-not-to-say',
        interests: user.interests || [],
      });
    }
  }, [user]);

  // Available interests
  const availableInterests = [
    'Sports', 'Music', 'Movies', 'Reading', 'Travel', 'Cooking',
    'Gaming', 'Art', 'Photography', 'Technology', 'Nature', 'Fitness',
    'Dancing', 'Volunteering', 'Learning', 'Business'
  ];

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest].slice(0, 10) // Max 10 interests
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.realName.trim() || formData.realName.trim().length < 2) {
      return 'Real name must be at least 2 characters';
    }

    if (!formData.nickname.trim() || formData.nickname.trim().length < 2) {
      return 'Nickname must be at least 2 characters';
    }

    if (formData.bio.length > 500) {
      return 'Bio must be less than 500 characters';
    }

    // Check age (must be 18+)
    const age = new Date().getFullYear() - formData.dateOfBirth.getFullYear();
    if (age < 18) {
      return 'You must be at least 18 years old';
    }

    return null;
  };

  const handleSave = async () => {
    const errorMessage = validateForm();
    if (errorMessage) {
      Alert.alert('Validation Error', errorMessage);
      return;
    }

    setLoading(true);
    try {
      const updateData: UpdateProfileRequest = {
        real_name: formData.realName.trim(),
        nickname: formData.nickname.trim(),
        bio: formData.bio.trim(),
        date_of_birth: formData.dateOfBirth.toISOString(),
        gender: formData.gender as any,
        interests: formData.interests,
        location: {
          latitude: 0,
          longitude: 0,
          city: '',
          country: ''
        }
      };


      await profileService.updateProfile(updateData);
      
      // Refresh user data in AuthContext
      try {
        await refreshUser();
      } catch (refreshError) {
        console.error('Failed to refresh user data:', refreshError);
      }
      
      Alert.alert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      updateField('dateOfBirth', selectedDate);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        <Card containerStyle={styles.card}>
          {/* Profile Picture Section */}
          <View style={styles.avatarContainer}>
            <Avatar
              size="large"
              rounded
              source={{ uri: user?.profileImageURL || 'https://via.placeholder.com/150' }}
              title={user?.nickname?.charAt(0).toUpperCase()}
              containerStyle={styles.avatar}
            />
            <TouchableOpacity style={styles.cameraButton}>
              <Icon name="camera" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Basic Information */}
          <Input
            label="Real Name"
            placeholder="Your real name"
            value={formData.realName}
            onChangeText={(value) => updateField('realName', value)}
            leftIcon={<Icon name="person" size={20} color={APP_CONFIG.COLORS.TEXT_SECONDARY} />}
            inputContainerStyle={styles.inputContainer}
          />

          <Input
            label="Nickname (Public)"
            placeholder="How others will see you"
            value={formData.nickname}
            onChangeText={(value) => updateField('nickname', value)}
            leftIcon={<Icon name="account-circle" size={20} color={APP_CONFIG.COLORS.TEXT_SECONDARY} />}
            inputContainerStyle={styles.inputContainer}
          />

          <Input
            label="Bio"
            placeholder="Tell others about yourself..."
            value={formData.bio}
            onChangeText={(value) => updateField('bio', value)}
            multiline
            numberOfLines={3}
            maxLength={500}
            leftIcon={<Icon name="edit" size={20} color={APP_CONFIG.COLORS.TEXT_SECONDARY} />}
            inputContainerStyle={styles.inputContainer}
          />

          {/* Date of Birth */}
          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateText}>
              {formData.dateOfBirth.toLocaleDateString()}
            </Text>
            <Icon name="event" size={20} color={APP_CONFIG.COLORS.TEXT_SECONDARY} />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={formData.dateOfBirth}
              mode="date"
              display="default"
              onChange={onDateChange}
              maximumDate={new Date()} // Can't be in the future
            />
          )}

          {/* Gender */}
          <Text style={styles.label}>Gender</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.gender}
              onValueChange={(value) => updateField('gender', value)}
              style={styles.picker}
            >
              <Picker.Item label="Male" value="male" />
              <Picker.Item label="Female" value="female" />
              <Picker.Item label="Other" value="other" />
              <Picker.Item label="Prefer not to say" value="prefer-not-to-say" />
            </Picker>
          </View>

          {/* Interests */}
          <Text style={styles.label}>Interests (Max 10)</Text>
          <View style={styles.interestsContainer}>
            {availableInterests.map((interest) => (
              <CheckBox
                key={interest}
                title={interest}
                checked={formData.interests.includes(interest)}
                onPress={() => toggleInterest(interest)}
                containerStyle={styles.checkboxContainer}
                textStyle={styles.checkboxText}
                checkedColor={APP_CONFIG.COLORS.PRIMARY}
              />
            ))}
          </View>

          <Text style={styles.selectedCount}>
            Selected: {formData.interests.length}/10
          </Text>

          {/* Save Button */}
          <Button
            title="Save Changes"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
            buttonStyle={[styles.saveButton, { backgroundColor: APP_CONFIG.COLORS.PRIMARY }]}
            titleStyle={styles.buttonText}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 15,
    borderRadius: 12,
    paddingBottom: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  avatar: {
    backgroundColor: APP_CONFIG.COLORS.PRIMARY,
  },
  cameraButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: APP_CONFIG.COLORS.PRIMARY,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    marginBottom: 8,
    marginTop: 15,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 15,
    marginBottom: 15,
  },
  dateText: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    marginBottom: 15,
  },
  picker: {
    height: 50,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  checkboxContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 5,
    margin: 2,
    width: '48%',
  },
  checkboxText: {
    fontSize: 14,
    fontWeight: 'normal',
  },
  selectedCount: {
    textAlign: 'center',
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 10,
  },
  saveButton: {
    marginTop: 30,
    borderRadius: 8,
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
