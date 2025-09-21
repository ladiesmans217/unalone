import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hotspotService } from '../../services/HotspotService';
import { Hotspot, UpdateHotspotRequest } from '../../types';
import { APP_COLORS } from '../../utils/constants';

interface Props {
  navigation: any;
  route: { params: { hotspotId: string } };
}

const EditHotspotScreen: React.FC<Props> = ({ navigation, route }) => {
  const { hotspotId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hotspot, setHotspot] = useState<Hotspot | null>(null);

  // Minimal editable fields for now
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await hotspotService.getHotspot(hotspotId, false);
        setHotspot(data);
        setName(data.name || '');
        setDescription(data.description || '');
        setMaxCapacity(
          data.maxCapacity !== undefined && data.maxCapacity !== null && data.maxCapacity > 0
            ? String(data.maxCapacity)
            : ''
        );
        setIsPublic(Boolean(data.isPublic));
      } catch (e) {
        console.error('Failed to load hotspot', e);
        Alert.alert('Error', 'Failed to load hotspot to edit');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [hotspotId]);

  const handleSave = async () => {
    if (!hotspot) return;
    // Basic validation
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      Alert.alert('Validation', 'Description must be at least 10 characters');
      return;
    }
    if (maxCapacity) {
      const n = Number(maxCapacity);
      if (!Number.isFinite(n) || n < 1 || n > 1000) {
        Alert.alert('Validation', 'Capacity must be between 1 and 1000');
        return;
      }
    }

    setSaving(true);
    try {
      const payload: UpdateHotspotRequest = {
        id: hotspot.id,
        name,
        description,
        isPublic,
        ...(maxCapacity ? { maxCapacity: Number(maxCapacity) } : { maxCapacity: 0 }),
      };

      const updated = await hotspotService.updateHotspot(hotspot.id, payload);
      Alert.alert('Saved', 'Hotspot updated successfully', [
        {
          text: 'OK',
          onPress: () => {
            // Replace to ensure details reloads fresh
            navigation.replace('HotspotDetails', { hotspotId: updated.id });
          },
        },
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update hotspot');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={APP_COLORS.primary} />
        <Text style={styles.loadingText}>Loading hotspot...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Edit Hotspot</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Max Capacity</Text>
        <TextInput
          style={styles.input}
          value={maxCapacity}
          onChangeText={setMaxCapacity}
          placeholder="e.g. 60 (leave blank for ∞)"
          keyboardType="numeric"
        />

        <View style={styles.switchRow}>
          <Text style={styles.labelInline}>Public</Text>
          <TouchableOpacity
            style={[styles.toggle, isPublic ? styles.toggleOn : styles.toggleOff]}
            onPress={() => setIsPublic(v => !v)}
          >
            <Ionicons name={isPublic ? 'checkmark' : 'close'} size={18} color="white" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.saveButton, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: APP_COLORS.textPrimary,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: APP_COLORS.textSecondary,
    marginBottom: 6,
  },
  labelInline: {
    fontSize: 14,
    color: APP_COLORS.textSecondary,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: 12,
    color: APP_COLORS.textPrimary,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: APP_COLORS.success },
  toggleOff: { backgroundColor: APP_COLORS.textSecondary },
  saveButton: {
    backgroundColor: APP_COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  saveText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});

export default EditHotspotScreen;
