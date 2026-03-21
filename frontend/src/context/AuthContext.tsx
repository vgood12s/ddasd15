import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  id: string;
  username: string;
  first_name: string | null;
  email: string;
  phone: string | null;
  balance: number;
  prepaid_hours: number;
  status_name: string;
  status_emoji: string;
  cashback_rate: number;
  sessions_count: number;
  avatar: string | null;
  achievements: any[];
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (loginStr: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      if (storedToken) {
        const res = await fetch(`${BACKEND_URL}/api/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (res.ok) {
          const userData = await res.json();
          setToken(storedToken);
          setUser(userData);
        } else {
          await AsyncStorage.removeItem('auth_token');
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function login(loginStr: string, password: string) {
    const res = await fetch(`${BACKEND_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginStr, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Ошибка входа');
    }
    await AsyncStorage.setItem('auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function register(username: string, email: string, password: string) {
    const res = await fetch(`${BACKEND_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Ошибка регистрации');
    }
    await AsyncStorage.setItem('auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function logout() {
    await AsyncStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }

  async function refreshUser() {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUser(await res.json());
      }
    } catch (e) {
      // ignore
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
