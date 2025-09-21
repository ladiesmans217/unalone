// Report user screen for reporting inappropriate behavior
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Input, Button, Text, Card, CheckBox } from 'react-native-elements';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { profileService, ReportUserRequest } from '../../services/ProfileService';
import { APP_CONFIG } from '../../utils/constants';

interface Props {
  navigation: any;
  route: {
    params: {
      userId: string;
      userName: string;
    };
  };
}

export const ReportUserScreen: React.FC<Props> = ({ navigation, route }) => {
  const { userId, userName } = route.params;
  const [loading, setLoading] = useState(false);
  
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [description, setDescription] = useState('');

  const reportReasons = [
    { key: 'harassment', label: 'Harassment or bullying', icon: 'report-problem' },
    { key: 'spam', label: 'Spam or unwanted messages', icon: 'block' },
    { key: 'inappropriate', label: 'Inappropriate content', icon: 'warning' },
    { key: 'fake-profile', label: 'Fake profile or impersonation', icon: 'person-off' },
    { key: 'other', label: 'Other reason', icon: 'more-horiz' },
  ];

  const handleSubmitReport = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for reporting');
      return;
    }

    if (selectedReason === 'other' && !description.trim()) {
      Alert.alert('Error', 'Please provide a description for "Other" reason');
      return;
    }

    Alert.alert(
      'Confirm Report',
      `Are you sure you want to report ${userName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Report', 
          style: 'destructive',
          onPress: () => submitReport()
        }
      ]
    );
  };

  const submitReport = async () => {
    setLoading(true);
    try {
      const reportData: ReportUserRequest = {
        reported_user_id: userId,
        reason: selectedReason as any,
        description: description.trim(),
      };

      await profileService.reportUser(reportData);
      
      Alert.alert(
        'Report Submitted',
        'Thank you for your report. Our team will review it and take appropriate action.',
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        <Card containerStyle={styles.card}>
          <View style={styles.header}>
            <Icon name="report" size={50} color={APP_CONFIG.COLORS.ERROR} />
            <Text style={styles.title}>Report User</Text>
            <Text style={styles.subtitle}>
              Help us keep Unalone safe by reporting {userName}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Why are you reporting this user?</Text>
          
          {reportReasons.map((reason) => (
            <CheckBox
              key={reason.key}
              title={
                <View style={styles.reasonContainer}>
                  <Icon 
                    name={reason.icon} 
                    size={20} 
                    color={selectedReason === reason.key ? APP_CONFIG.COLORS.PRIMARY : APP_CONFIG.COLORS.TEXT_SECONDARY}
                    style={styles.reasonIcon}
                  />
                  <Text style={[
                    styles.reasonText,
                    selectedReason === reason.key && styles.selectedReasonText
                  ]}>
                    {reason.label}
                  </Text>
                </View>
              }
              checked={selectedReason === reason.key}
              onPress={() => setSelectedReason(reason.key)}
              checkedIcon="radio-button-checked"
              uncheckedIcon="radio-button-unchecked"
              containerStyle={styles.radioContainer}
              checkedColor={APP_CONFIG.COLORS.PRIMARY}
            />
          ))}

          <Input
            label="Additional Details (Optional)"
            placeholder="Please provide more details about why you're reporting this user..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={1000}
            inputContainerStyle={styles.inputContainer}
            labelStyle={styles.inputLabel}
          />

          <Text style={styles.charCount}>
            {description.length}/1000 characters
          </Text>

          <View style={styles.infoBox}>
            <Icon name="info" size={20} color={APP_CONFIG.COLORS.PRIMARY} />
            <Text style={styles.infoText}>
              Reports are anonymous and reviewed by our moderation team. 
              False reports may result in restrictions on your account.
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              title="Submit Report"
              onPress={handleSubmitReport}
              loading={loading}
              disabled={loading || !selectedReason}
              buttonStyle={[styles.submitButton, { backgroundColor: APP_CONFIG.COLORS.ERROR }]}
              titleStyle={styles.buttonText}
              icon={<Icon name="send" size={20} color="white" style={{ marginRight: 8 }} />}
            />

            <Button
              title="Cancel"
              onPress={() => navigation.goBack()}
              type="outline"
              buttonStyle={[styles.cancelButton, { borderColor: APP_CONFIG.COLORS.TEXT_SECONDARY }]}
              titleStyle={[styles.buttonText, { color: APP_CONFIG.COLORS.TEXT_SECONDARY }]}
            />
          </View>
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
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    marginTop: 15,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    marginBottom: 20,
  },
  reasonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  reasonIcon: {
    marginRight: 12,
  },
  reasonText: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    flex: 1,
  },
  selectedReasonText: {
    color: APP_CONFIG.COLORS.PRIMARY,
    fontWeight: '600',
  },
  radioContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginLeft: 0,
    marginRight: 0,
    paddingVertical: 12,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    marginBottom: 8,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginTop: 5,
    marginBottom: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: APP_CONFIG.COLORS.PRIMARY + '10',
    padding: 15,
    borderRadius: 8,
    marginBottom: 30,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 15,
  },
  submitButton: {
    borderRadius: 8,
    paddingVertical: 12,
  },
  cancelButton: {
    borderRadius: 8,
    paddingVertical: 12,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
