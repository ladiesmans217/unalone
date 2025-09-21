// Phone verification screen for verifying phone numbers
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text as RNText,
} from 'react-native';
import { Input, Button, Text, Card } from 'react-native-elements';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { profileService } from '../../services/ProfileService';
import { APP_CONFIG } from '../../utils/constants';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  navigation: any;
  route: {
    params?: {
      phoneNumber?: string;
    };
  };
}

export const PhoneVerificationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { refreshUser } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState(route.params?.phoneNumber || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout>();

  // Code input refs for auto-focus
  const codeRefs = useRef<any[]>([]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeLeft]);

  const validatePhoneNumber = (phone: string): boolean => {
    // Basic phone number validation
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      await profileService.sendPhoneVerification(phoneNumber.replace(/\s/g, ''));
      setCodeSent(true);
      setTimeLeft(300); // 5 minutes
      Alert.alert('Success', 'Verification code sent to your phone');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await profileService.verifyPhone(phoneNumber.replace(/\s/g, ''), verificationCode);
      
      // Refresh user data to update verification status
      try {
        await refreshUser();
      } catch (refreshError) {
        console.error('Failed to refresh user data:', refreshError);
      }
      
      Alert.alert('Success', 'Phone number verified successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Verification failed');
      setVerificationCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (timeLeft > 0) {
      return;
    }
    await handleSendCode();
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const onCodeChange = (text: string, index: number) => {
    // Only allow digits
    const sanitizedText = text.replace(/[^0-9]/g, '');
    
    const newCode = verificationCode.split('');
    newCode[index] = sanitizedText.slice(-1); // Take only the last character
    const updatedCode = newCode.join('');
    setVerificationCode(updatedCode);

    // Auto-focus next input
    if (sanitizedText && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const onCodeKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Card containerStyle={styles.card}>
          <View style={styles.iconContainer}>
            <Icon name="phone" size={60} color={APP_CONFIG.COLORS.PRIMARY} />
          </View>

          <Text style={styles.title}>Verify Phone Number</Text>
          <Text style={styles.subtitle}>
            {codeSent 
              ? `Enter the 6-digit code sent to ${phoneNumber}`
              : 'Enter your phone number to receive a verification code'
            }
          </Text>

          {!codeSent ? (
            <>
              <Input
                label="Phone Number"
                placeholder="+1234567890"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                leftIcon={<Icon name="phone" size={20} color={APP_CONFIG.COLORS.TEXT_SECONDARY} />}
                inputContainerStyle={styles.inputContainer}
                autoFocus
              />

              <Button
                title="Send Verification Code"
                onPress={handleSendCode}
                loading={loading}
                disabled={loading}
                buttonStyle={[styles.button, { backgroundColor: APP_CONFIG.COLORS.PRIMARY }]}
                titleStyle={styles.buttonText}
              />
            </>
          ) : (
            <>
              <Text style={styles.codeLabel}>Verification Code</Text>
              <View style={styles.codeContainer}>
                {[...Array(6)].map((_, index) => (
                  <Input
                    key={index}
                    ref={(ref) => (codeRefs.current[index] = ref)}
                    value={verificationCode[index] || ''}
                    onChangeText={(text) => onCodeChange(text, index)}
                    onKeyPress={({ nativeEvent }) => onCodeKeyPress(nativeEvent.key, index)}
                    keyboardType="numeric"
                    maxLength={1}
                    textAlign="center"
                    containerStyle={styles.codeInputContainer}
                    inputContainerStyle={styles.codeInputInner}
                    inputStyle={styles.codeInput}
                  />
                ))}
              </View>

              {timeLeft > 0 && (
                <Text style={styles.timerText}>
                  Resend code in {formatTime(timeLeft)}
                </Text>
              )}

              <Button
                title="Verify Phone Number"
                onPress={handleVerifyCode}
                loading={loading}
                disabled={loading || verificationCode.length !== 6}
                buttonStyle={[styles.button, { backgroundColor: APP_CONFIG.COLORS.PRIMARY }]}
                titleStyle={styles.buttonText}
              />

              <Button
                title="Resend Code"
                onPress={handleResendCode}
                disabled={timeLeft > 0 || loading}
                type="outline"
                buttonStyle={[styles.resendButton, { borderColor: APP_CONFIG.COLORS.PRIMARY }]}
                titleStyle={[styles.buttonText, { color: APP_CONFIG.COLORS.PRIMARY }]}
              />

              <Button
                title="Change Phone Number"
                onPress={() => {
                  setCodeSent(false);
                  setVerificationCode('');
                  setTimeLeft(0);
                }}
                type="clear"
                titleStyle={[styles.buttonText, { color: APP_CONFIG.COLORS.TEXT_SECONDARY }]}
              />
            </>
          )}
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 12,
    padding: 30,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginBottom: 30,
  },
  inputContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  codeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 20,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  codeInputContainer: {
    width: 45,
    height: 55,
  },
  codeInputInner: {
    borderBottomWidth: 2,
    borderBottomColor: APP_CONFIG.COLORS.PRIMARY,
    borderRadius: 8,
  },
  codeInput: {
    fontSize: 18,
    fontWeight: 'bold',
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
  },
  timerText: {
    textAlign: 'center',
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    fontSize: 14,
    marginBottom: 15,
  },
  button: {
    marginTop: 20,
    borderRadius: 8,
    paddingVertical: 12,
  },
  resendButton: {
    marginTop: 15,
    borderRadius: 8,
    paddingVertical: 12,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
