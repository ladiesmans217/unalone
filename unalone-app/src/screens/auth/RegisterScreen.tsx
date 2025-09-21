// Registration screen for new users
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Input, Button, Text, Card } from 'react-native-elements';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { AuthStackParamList } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { APP_CONFIG } from '../../utils/constants';

type RegisterScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Register'>;

interface Props {
  navigation: RegisterScreenNavigationProp;
}

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    realName: '',
    nickname: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const { register, isLoading } = useAuth();

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    const { email, password, confirmPassword, realName, nickname } = formData;

    if (!email.trim() || !password.trim() || !realName.trim() || !nickname.trim()) {
      return 'Please fill in all fields';
    }

    if (!isValidEmail(email)) {
      return 'Please enter a valid email address';
    }

    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }

    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }

    if (realName.trim().length < 2) {
      return 'Real name must be at least 2 characters';
    }

    if (nickname.trim().length < 2) {
      return 'Nickname must be at least 2 characters';
    }

    if (nickname.trim().length > 20) {
      return 'Nickname must be less than 20 characters';
    }

    return null;
  };

  const handleRegister = async () => {
    const errorMessage = validateForm();
    if (errorMessage) {
      Alert.alert('Validation Error', errorMessage);
      return;
    }

    try {
      await register(
        formData.email.trim().toLowerCase(),
        formData.password,
        formData.realName.trim(),
        formData.nickname.trim()
      );
      // Navigation will be handled by AuthContext
    } catch (error) {
      Alert.alert('Registration Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const navigateToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Join Unalone</Text>
          <Text style={styles.subtitle}>Create your account to start connecting</Text>
        </View>

        <Card containerStyle={styles.card}>
          <Input
            placeholder="Full Name"
            value={formData.realName}
            onChangeText={(value) => updateField('realName', value)}
            autoCapitalize="words"
            leftIcon={<Icon name="person" size={20} color={APP_CONFIG.COLORS.TEXT_SECONDARY} />}
            inputContainerStyle={styles.inputContainer}
          />

          <Input
            placeholder="Nickname (Public)"
            value={formData.nickname}
            onChangeText={(value) => updateField('nickname', value)}
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={<Icon name="account-circle" size={20} color={APP_CONFIG.COLORS.TEXT_SECONDARY} />}
            inputContainerStyle={styles.inputContainer}
          />

          <Input
            placeholder="Email Address"
            value={formData.email}
            onChangeText={(value) => updateField('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={<Icon name="email" size={20} color={APP_CONFIG.COLORS.TEXT_SECONDARY} />}
            inputContainerStyle={styles.inputContainer}
          />

          <Input
            placeholder="Password (8+ characters)"
            value={formData.password}
            onChangeText={(value) => updateField('password', value)}
            secureTextEntry={!showPassword}
            leftIcon={<Icon name="lock" size={20} color={APP_CONFIG.COLORS.TEXT_SECONDARY} />}
            rightIcon={
              <Icon
                name={showPassword ? 'visibility' : 'visibility-off'}
                size={20}
                color={APP_CONFIG.COLORS.TEXT_SECONDARY}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            inputContainerStyle={styles.inputContainer}
          />

          <Input
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChangeText={(value) => updateField('confirmPassword', value)}
            secureTextEntry={!showPassword}
            leftIcon={<Icon name="lock" size={20} color={APP_CONFIG.COLORS.TEXT_SECONDARY} />}
            inputContainerStyle={styles.inputContainer}
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={isLoading}
            disabled={isLoading}
            buttonStyle={[styles.button, { backgroundColor: APP_CONFIG.COLORS.PRIMARY }]}
            titleStyle={styles.buttonText}
          />

          <View style={styles.loginSection}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Text style={styles.loginLink} onPress={navigateToLogin}>
              Sign In
            </Text>
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: APP_CONFIG.COLORS.TEXT_PRIMARY,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  card: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    marginBottom: 10,
  },
  button: {
    marginTop: 20,
    borderRadius: 8,
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loginSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    fontSize: 16,
  },
  loginLink: {
    color: APP_CONFIG.COLORS.PRIMARY,
    fontSize: 16,
    fontWeight: '600',
  },
});
