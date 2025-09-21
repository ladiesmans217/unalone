// Safety settings screen for managing user safety preferences
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Text, Card, Switch, Slider, Button } from 'react-native-elements';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { safetyService, SafetySettings } from '../../services/SafetyService';
import { APP_CONFIG } from '../../utils/constants';

interface Props {
  navigation: any;
}

export const SafetySettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SafetySettings>({
    auto_moderate_content: true,
    block_explicit_content: true,
    require_phone_verification: false,
    minimum_account_age_days: 7,
    enable_ai_content_filtering: true,
  });

  useEffect(() => {
    loadSafetySettings();
  }, []);

  const loadSafetySettings = async () => {
    setLoading(true);
    try {
      const userSettings = await safetyService.getSafetySettings();
      setSettings(userSettings);
    } catch (error) {
      console.log('Using default safety settings');
      // Use default settings if API fails
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await safetyService.updateSafetySettings(settings);
      Alert.alert('Success', 'Safety settings updated successfully');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof SafetySettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  type MaterialIconName = keyof typeof Icon.glyphMap;

  const SettingItem = ({ 
    title, 
    description, 
    icon, 
    children 
  }: { 
    title: string; 
    description: string; 
    icon: MaterialIconName; 
    children: React.ReactNode;
  }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingHeader}>
        <Icon name={icon} size={24} color={APP_CONFIG.COLORS.PRIMARY} />
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>
      </View>
      <View style={styles.settingControl}>
        {children}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading safety settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card containerStyle={styles.headerCard}>
        <View style={styles.header}>
          <Icon name="security" size={40} color={APP_CONFIG.COLORS.PRIMARY} />
          <Text style={styles.title}>Safety Settings</Text>
          <Text style={styles.subtitle}>
            Customize your safety preferences to ensure a secure experience
          </Text>
        </View>
      </Card>

      <Card containerStyle={styles.card}>
        <View>
          <Text style={styles.sectionTitle}>Content Moderation</Text>
          
          <SettingItem
            title="Auto-moderate Content"
            description="Automatically review and filter potentially harmful content"
            icon="policy"
          >
            <Switch
              value={settings.auto_moderate_content}
              onValueChange={(value) => updateSetting('auto_moderate_content', value)}
              color={APP_CONFIG.COLORS.PRIMARY}
            />
          </SettingItem>

          <SettingItem
            title="Block Explicit Content"
            description="Hide content that may contain explicit material"
            icon="block"
          >
            <Switch
              value={settings.block_explicit_content}
              onValueChange={(value) => updateSetting('block_explicit_content', value)}
              color={APP_CONFIG.COLORS.PRIMARY}
            />
          </SettingItem>

          <SettingItem
            title="AI Content Filtering"
            description="Use AI to detect and filter inappropriate content automatically"
            icon="psychology"
          >
            <Switch
              value={settings.enable_ai_content_filtering}
              onValueChange={(value) => updateSetting('enable_ai_content_filtering', value)}
              color={APP_CONFIG.COLORS.PRIMARY}
            />
          </SettingItem>
        </View>
      </Card>

      <Card containerStyle={styles.card}>
        <View>
          <Text style={styles.sectionTitle}>Account Verification</Text>
          
          <SettingItem
            title="Require Phone Verification"
            description="Only interact with users who have verified their phone number"
            icon="verified-user"
          >
            <Switch
              value={settings.require_phone_verification}
              onValueChange={(value) => updateSetting('require_phone_verification', value)}
              color={APP_CONFIG.COLORS.PRIMARY}
            />
          </SettingItem>

          <SettingItem
            title="Minimum Account Age"
            description={`Only interact with accounts older than ${settings.minimum_account_age_days} days`}
            icon="schedule"
          >
            <View style={styles.sliderContainer}>
              <Slider
                value={settings.minimum_account_age_days}
                onValueChange={(value) => updateSetting('minimum_account_age_days', Math.round(value))}
                minimumValue={0}
                maximumValue={30}
                step={1}
                thumbStyle={{ backgroundColor: APP_CONFIG.COLORS.PRIMARY }}
                trackStyle={{ backgroundColor: APP_CONFIG.COLORS.PRIMARY + '30' }}
                minimumTrackTintColor={APP_CONFIG.COLORS.PRIMARY}
              />
              <Text style={styles.sliderValue}>{settings.minimum_account_age_days} days</Text>
            </View>
          </SettingItem>
        </View>
      </Card>

      <Card containerStyle={styles.card}>
        <View>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <View style={styles.actionButtons}>
            <Button
              title="View Blocked Users"
              onPress={() => navigation.navigate('BlockedUsers')}
              buttonStyle={[styles.actionButton, { backgroundColor: APP_CONFIG.COLORS.WARNING }]}
              titleStyle={styles.actionButtonText}
              icon={<Icon name="block" size={16} color="white" style={{ marginRight: 5 }} />}
            />

            <Button
              title="Safety Guidelines"
              onPress={() => {
                Alert.alert(
                  'Safety Guidelines',
                  '• Be respectful to all users\n• Report inappropriate behavior\n• Don\'t share personal information\n• Meet in public places\n• Trust your instincts',
                  [{ text: 'OK' }]
                );
              }}
              buttonStyle={[styles.actionButton, { backgroundColor: APP_CONFIG.COLORS.PRIMARY }]}
              titleStyle={styles.actionButtonText}
              icon={<Icon name="info" size={16} color="white" style={{ marginRight: 5 }} />}
            />

            <Button
              title="Emergency Report"
              onPress={() => {
                Alert.alert(
                  'Emergency Report',
                  'If you are in immediate danger, please contact local emergency services. Use this feature to report serious safety concerns.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Continue', onPress: () => {
                      // Navigate to emergency report screen
                      Alert.alert('Feature Coming Soon', 'Emergency reporting will be available in the next update.');
                    }}
                  ]
                );
              }}
              buttonStyle={[styles.actionButton, { backgroundColor: APP_CONFIG.COLORS.ERROR }]}
              titleStyle={styles.actionButtonText}
              icon={<Icon name="warning" size={16} color="white" style={{ marginRight: 5 }} />}
            />
          </View>
        </View>
      </Card>

      <View style={styles.saveContainer}>
        <Button
          title="Save Settings"
          onPress={handleSaveSettings}
          loading={saving}
          disabled={saving}
          buttonStyle={[styles.saveButton, { backgroundColor: APP_CONFIG.COLORS.SUCCESS }]}
          titleStyle={styles.saveButtonText}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  card: {
    margin: 15,
    marginTop: 5,
    marginBottom: 5,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    marginBottom: 20,
  },
  settingItem: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  settingContent: {
    flex: 1,
    marginLeft: 15,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    lineHeight: 18,
  },
  settingControl: {
    alignItems: 'flex-end',
  },
  sliderContainer: {
    width: 150,
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.PRIMARY,
    marginTop: 5,
  },
  actionButtons: {
    gap: 15,
  },
  actionButton: {
    borderRadius: 8,
    paddingVertical: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveContainer: {
    margin: 15,
    marginTop: 10,
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 15,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
