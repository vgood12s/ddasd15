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

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState('');

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  function validateUsername(val: string): string | null {
    if (val.length < 3) return 'Минимум 3 символа';
    if (!/^[a-zA-Z0-9_]+$/.test(val)) return 'Только латиница, цифры и _';
    return null;
  }

  async function handleRegister() {
    Keyboard.dismiss();
    setError('');

    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(`Никнейм: ${usernameError}`);
      return;
    }
    if (!email.trim()) {
      setError('Введите email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Некорректный формат email');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть минимум 6 символов');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  const usernameHint = username.length > 0 ? validateUsername(username) : null;

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
        {/* Back */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <TouchableOpacity
            testID="register-back-btn"
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Header */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.header}>
          <View style={styles.emblem}>
            <MaterialCommunityIcons name="fleur-de-lis" size={44} color={Colors.accent.gold} />
          </View>
          <Text style={styles.title}>Вступить в Гильдию</Text>
          <Text style={styles.subtitle}>Создайте аккаунт, чтобы записываться на сессии</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.form}>
          {error ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle" size={18} color={Colors.status.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Username */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Никнейм *</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'username' && styles.inputFocused,
                usernameHint && username.length > 0 && styles.inputError,
              ]}
            >
              <MaterialCommunityIcons
                name="account-outline"
                size={20}
                color={focusedField === 'username' ? Colors.accent.gold : Colors.text.muted}
                style={styles.inputIcon}
              />
              <TextInput
                testID="register-username-input"
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="hero_name"
                placeholderTextColor={Colors.text.muted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField('')}
              />
              {username.length > 0 && !usernameHint && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color={Colors.status.success}
                  style={{ marginRight: Spacing.m }}
                />
              )}
            </View>
            <Text style={styles.hint}>Латиница, цифры и _ (минимум 3 символа)</Text>
          </View>

          {/* Email */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Email *</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'email' && styles.inputFocused,
              ]}
            >
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color={focusedField === 'email' ? Colors.accent.gold : Colors.text.muted}
                style={styles.inputIcon}
              />
              <TextInput
                ref={emailRef}
                testID="register-email-input"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="adventurer@guild.com"
                placeholderTextColor={Colors.text.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField('')}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Пароль *</Text>
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
                testID="register-password-input"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Минимум 6 символов"
                placeholderTextColor={Colors.text.muted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField('')}
              />
              <TouchableOpacity
                testID="register-toggle-password"
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

          {/* Confirm Password */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Повторите пароль *</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'confirm' && styles.inputFocused,
                confirmPassword.length > 0 && password !== confirmPassword && styles.inputError,
              ]}
            >
              <MaterialCommunityIcons
                name="lock-check-outline"
                size={20}
                color={focusedField === 'confirm' ? Colors.accent.gold : Colors.text.muted}
                style={styles.inputIcon}
              />
              <TextInput
                ref={confirmRef}
                testID="register-confirm-password-input"
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Повторите пароль"
                placeholderTextColor={Colors.text.muted}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                onFocus={() => setFocusedField('confirm')}
                onBlur={() => setFocusedField('')}
              />
              <TouchableOpacity
                testID="register-toggle-confirm"
                onPress={() => setShowConfirm(!showConfirm)}
                style={styles.eyeBtn}
              >
                <MaterialCommunityIcons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.text.muted}
                />
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={styles.errorHint}>Пароли не совпадают</Text>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            testID="register-submit-btn"
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.bg.main} />
            ) : (
              <>
                <MaterialCommunityIcons name="shield-plus" size={20} color={Colors.bg.main} style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>Зарегистрироваться</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Footer */}
        <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.footer}>
          <Text style={styles.footerText}>Уже есть аккаунт?{' '}</Text>
          <TouchableOpacity testID="go-to-login-btn" onPress={() => router.replace('/login')}>
            <Text style={styles.footerLink}>Войти</Text>
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
    marginTop: Spacing.l,
    marginBottom: Spacing.l,
  },
  emblem: {
    width: 76,
    height: 76,
    borderRadius: 38,
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
    fontSize: FontSizes.h2,
    color: Colors.accent.gold,
    textAlign: 'center',
    marginBottom: Spacing.s,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
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
    gap: Spacing.xs,
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
  inputError: {
    borderColor: Colors.status.danger,
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
  hint: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.small,
    color: Colors.text.muted,
    marginLeft: Spacing.xs,
  },
  errorHint: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.small,
    color: Colors.status.danger,
    marginLeft: Spacing.xs,
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
    fontSize: 17,
    color: Colors.bg.main,
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
    paddingBottom: Spacing.l,
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
