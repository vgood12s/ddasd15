import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, FontSizes } from '../../src/constants/theme';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export function useApi() {
  return {
    get: async (path: string, token?: string | null) => {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${BACKEND_URL}${path}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      return res.json();
    },
    post: async (path: string, body: any, token?: string | null) => {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${BACKEND_URL}${path}`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
      if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
      return data;
    },
    del: async (path: string, token?: string | null) => {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${BACKEND_URL}${path}`, { method: 'DELETE', headers });
      const data = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
      if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
      return data;
    },
  };
}

export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: 8,
  },
});
