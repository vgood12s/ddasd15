import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Fonts, FontSizes, Spacing } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState('');

  const passwordRef = useRef<TextInput>(null);

  async function handleLogin() {
    Keyboard.dismiss();
    setError('');
    if (!loginValue.trim()) {
      setError('Введите никнейм или email');
      return;
    }
    if (!password) {
      setError('Введите пароль');
      return;
    }

    setLoading(true);
    try {
      await login(loginValue.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg.main }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + Spacing.m, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <TouchableOpacity
            testID="login-back-btn"
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Header */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.header}>
          <View style={styles.emblem}>
            <MaterialCommunityIcons name="fleur-de-lis" size={48} color={Colors.accent.gold} />
          </View>
          <Text style={styles.title}>Вход в Гильдию</Text>
          <Text style={styles.subtitle}>Добро пожаловать, путник</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.form}>
          {/* Error */}
          {error ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle" size={18} color={Colors.status.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Login field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Никнейм или Email</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'login' && styles.inputFocused,
              ]}
            >
              <MaterialCommunityIcons
                name="account-outline"
                size={20}
                color={focusedField === 'login' ? Colors.accent.gold : Colors.text.muted}
                style={styles.inputIcon}
              />
              <TextInput
                testID="login-input"
                style={styles.input}
                value={loginValue}
                onChangeText={setLoginValue}
                placeholder="Введите никнейм или email"
                placeholderTextColor={Colors.text.muted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                onFocus={() => setFocusedField('login')}
                onBlur={() => setFocusedField('')}
              />
            </View>
          </View>

          {/* Password field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Пароль</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'password' && styles.inputFocused,
              ]}
            >
              <MaterialCommunityIcons
                name="lock-outline"
                size={20}
                color={focusedField === 'password' ? Colors.accent.gold : Colors.text.muted}
                style={styles.inputIcon}
              />
              <TextInput
                ref={passwordRef}
                testID="password-input"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Введите пароль"
                placeholderTextColor={Colors.text.muted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField('')}
              />
              <TouchableOpacity
                testID="toggle-password-btn"
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.text.muted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Login button */}
          <TouchableOpacity
            testID="login-submit-btn"
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.bg.main} />
            ) : (
              <>
                <MaterialCommunityIcons name="login-variant" size={20} color={Colors.bg.main} style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>Войти</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Footer */}
        <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.footer}>
          <Text style={styles.footerText}>Нет аккаунта?{' '}</Text>
          <TouchableOpacity testID="go-to-register-btn" onPress={() => router.replace('/register')}>
            <Text style={styles.footerLink}>Зарегистрироваться</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.l,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  header: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  emblem: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.bg.card,
    borderWidth: 2,
    borderColor: Colors.accent.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.m,
    shadowColor: Colors.accent.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.accent.gold,
    textAlign: 'center',
    marginBottom: Spacing.s,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.muted,
    textAlign: 'center',
  },
  form: {
    gap: Spacing.m,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(199, 72, 72, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(199, 72, 72, 0.3)',
    borderRadius: 8,
    padding: Spacing.m,
    gap: Spacing.s,
  },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.status.danger,
    flex: 1,
  },
  fieldContainer: {
    gap: Spacing.s,
  },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.primary,
    marginLeft: Spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.input,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: 12,
    minHeight: 52,
  },
  inputFocused: {
    borderColor: Colors.accent.gold,
    shadowColor: Colors.accent.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  inputIcon: {
    marginLeft: Spacing.m,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.highlight,
    paddingVertical: 14,
    paddingHorizontal: Spacing.m,
  },
  eyeBtn: {
    padding: Spacing.m,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    backgroundColor: Colors.accent.gold,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: Spacing.s,
    borderWidth: 1,
    borderColor: Colors.accent.goldLight,
    shadowColor: Colors.accent.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    color: Colors.bg.main,
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.muted,
  },
  footerLink: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.accent.gold,
    textDecorationLine: 'underline',
  },
});
