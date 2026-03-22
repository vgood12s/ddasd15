import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { Colors, Fonts, FontSizes, Spacing } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { useApi } from '../src/utils/api';

const { width } = Dimensions.get('window');

function GoldParticle({ delay, x }: { delay: number; x: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-200, { duration: 4000, easing: Easing.linear }),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1500 }),
          withTiming(0, { duration: 2500 })
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 100,
          left: x,
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: Colors.accent.gold,
        },
        style,
      ]}
    />
  );
}

function PulsingEmblem() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.emblemContainer, animStyle]}>
      <MaterialCommunityIcons name="fleur-de-lis" size={72} color={Colors.accent.gold} />
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const api = useApi();
  const [stats, setStats] = useState({ users: 0, games: 0 });

  useEffect(() => {
    // AuthGate handles navigation - no auto-redirect needed here
  }, [loading, user]);

  useEffect(() => {
    (async () => {
      try {
        const [leaderboard, games] = await Promise.all([
          api.get('/api/leaderboard'),
          api.get('/api/games'),
        ]);
        setStats({
          users: Array.isArray(leaderboard) ? leaderboard.length : 0,
          games: Array.isArray(games) ? games.length : 0,
        });
      } catch (e) {}
    })();
  }, []);

  const particles = Array.from({ length: 8 }, (_, i) => ({
    delay: i * 500,
    x: Math.random() * (width - 20) + 10,
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.l }]}>
      {/* Particles */}
      {particles.map((p, i) => (
        <GoldParticle key={i} delay={p.delay} x={p.x} />
      ))}

      {/* Content */}
      <View style={styles.content}>
        <PulsingEmblem />

        <Animated.Text
          entering={FadeInDown.delay(200).duration(800)}
          style={styles.title}
        >
          ГИЛЬДИЯ
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.delay(400).duration(800)}
          style={styles.subtitle}
        >
          Настольные ролевые приключения{'\n'}для тех, кто ищет больше, чем просто игру
        </Animated.Text>

        {/* Divider */}
        <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.divider}>
          <View style={styles.dividerLine} />
          <MaterialCommunityIcons name="diamond-stone" size={16} color={Colors.accent.gold} />
          <View style={styles.dividerLine} />
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(600).duration(800)} style={styles.statsRow}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="account-group" size={24} color={Colors.accent.gold} />
            <Text style={styles.statValue}>{stats.users || '...'}</Text>
            <Text style={styles.statLabel}>Искателей</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="sword-cross" size={24} color={Colors.accent.gold} />
            <Text style={styles.statValue}>{stats.games || '...'}</Text>
            <Text style={styles.statLabel}>Приключений</Text>
          </View>
        </Animated.View>
      </View>

      {/* Buttons */}
      <Animated.View entering={FadeInDown.delay(800).duration(800)} style={styles.buttonsContainer}>
        <TouchableOpacity
          testID="join-guild-btn"
          style={styles.primaryBtn}
          onPress={() => router.push('/register')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="shield-plus" size={20} color={Colors.bg.main} style={{ marginRight: 8 }} />
          <Text style={styles.primaryBtnText}>Присоединиться</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="login-btn"
          style={styles.secondaryBtn}
          onPress={() => router.push('/login')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="login-variant" size={20} color={Colors.text.highlight} style={{ marginRight: 8 }} />
          <Text style={styles.secondaryBtnText}>Уже есть аккаунт</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.main,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.l,
  },
  emblemContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.bg.card,
    borderWidth: 2,
    borderColor: Colors.accent.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.l,
    shadowColor: Colors.accent.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 42,
    color: Colors.accent.gold,
    letterSpacing: 6,
    textAlign: 'center',
    marginBottom: Spacing.m,
    textShadowColor: 'rgba(201, 169, 110, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.l,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.l,
  },
  dividerLine: {
    width: 40,
    height: 1,
    backgroundColor: Colors.border.gold,
    marginHorizontal: Spacing.s,
    opacity: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 110, 0.15)',
    paddingVertical: Spacing.m,
    paddingHorizontal: Spacing.xl,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: Spacing.m,
  },
  statValue: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    color: Colors.accent.goldLight,
    marginTop: Spacing.xs,
  },
  statLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 48,
    backgroundColor: Colors.border.default,
  },
  buttonsContainer: {
    paddingHorizontal: Spacing.l,
    gap: Spacing.m,
  },
  primaryBtn: {
    backgroundColor: Colors.accent.gold,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 52,
    borderWidth: 1,
    borderColor: Colors.accent.goldLight,
    shadowColor: Colors.accent.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    color: Colors.bg.main,
    letterSpacing: 1,
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 52,
    borderWidth: 1,
    borderColor: Colors.accent.violet,
  },
  secondaryBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    color: Colors.text.highlight,
    letterSpacing: 0.5,
  },
});
