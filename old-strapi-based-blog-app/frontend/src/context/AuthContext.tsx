'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { api } from '@/lib/api';
import { getToken, setToken, removeToken, isTokenExpired, refreshCookie } from '@/lib/auth';
import { showGoodbye } from '@/lib/welcomeToast';
import type { User, AuthResponse } from '@/types';

// Only a real auth failure (401/403) means the token is invalid. Network errors,
// timeouts, and 5xx from a restarting Strapi must NOT log the user out — we
// retry instead. Otherwise every `npm run develop` restart logs everyone out.
function isAuthFailure(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  return status === 401 || status === 403;
}

async function fetchMeWithRetry(
  jwt: string,
  onSuccess: (user: User) => void
): Promise<'ok' | 'auth-failed' | 'gave-up'> {
  const delays = [0, 1000, 2000, 4000, 8000]; // ~15s of retry while Strapi comes back
  for (const delay of delays) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await api.get<User>('/auth/me', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      onSuccess(res.data);
      return 'ok';
    } catch (err) {
      if (isAuthFailure(err)) return 'auth-failed';
      // network / 5xx — keep trying
    }
  }
  return 'gave-up';
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  // login/register resolve with the freshly fetched user so callers can
  // greet them by name (used by the welcome-island toast).
  login: (identifier: string, password: string) => Promise<User>;
  register: (username: string, email: string, password: string, accountType: 'viewer' | 'blogger') => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAdmin: () => boolean;
  isBlogger: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async (jwt?: string) => {
    const res = await api.get<User>('/auth/me', {
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
    });
    setUser(res.data);
    return res.data;
  }, []);

  useEffect(() => {
    const stored = getToken();
    if (stored && !isTokenExpired(stored)) {
      // Re-stamp the cookie with a fresh 30-day window every time we boot with
      // a valid token — turns it into a sliding session.
      refreshCookie(stored);
      setTokenState(stored);
      fetchMeWithRetry(stored, setUser)
        .then((outcome) => {
          // Only clear the token on a real 401/403. Network errors and 5xx
          // (Strapi still restarting) leave the session intact — a later focus
          // or navigation will re-fetch /auth/me once the API is reachable.
          if (outcome === 'auth-failed') {
            removeToken();
            setTokenState(null);
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      if (stored) removeToken();
      setIsLoading(false);
    }
  }, []);

  // ── Cross-tab auth sync ──────────────────────────────────────────────
  // The browser fires a `storage` event on every OTHER tab of the same origin
  // when localStorage changes. We use it to mirror login / logout across tabs:
  //   - another tab logs in  → this tab pulls the new JWT and fetches /auth/me
  //   - another tab logs out → this tab clears user + token
  // Also listen to the tab regaining focus: if the stored token changed while
  // the tab was backgrounded, resync. (storage events don't fire in the tab
  // that wrote them, so same-tab login/logout continues to work normally.)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncFromStorage = async (incoming: string | null) => {
      if (incoming && !isTokenExpired(incoming)) {
        // Only refetch if the token actually changed
        if (incoming === token) return;
        setTokenState(incoming);
        try {
          await fetchMe(incoming);
        } catch {
          removeToken();
          setTokenState(null);
          setUser(null);
        }
      } else {
        // Either cleared or expired in the other tab → log out here too
        if (incoming) removeToken();
        setTokenState(null);
        setUser(null);
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'jwt' && e.key !== null) return;
      // e.key === null happens on localStorage.clear() — treat as logout
      if (e.key === null) {
        setTokenState(null);
        setUser(null);
        return;
      }
      syncFromStorage(e.newValue);
    };

    const onFocus = () => {
      const current = getToken();
      // Only resync when the token on disk differs from what we have in memory
      if ((current || null) !== (token || null)) {
        syncFromStorage(current);
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [token, fetchMe]);

  const login = async (identifier: string, password: string): Promise<User> => {
    const res = await api.post<AuthResponse>('/auth/local', { identifier, password });
    const { jwt } = res.data;
    setToken(jwt);
    setTokenState(jwt);
    return await fetchMe(jwt);
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    accountType: 'viewer' | 'blogger'
  ): Promise<User> => {
    const res = await api.post<AuthResponse>('/auth/register-public', {
      username,
      email,
      password,
      accountType,
    });
    const { jwt } = res.data;
    setToken(jwt);
    setTokenState(jwt);
    return await fetchMe(jwt);
  };

  const logout = () => {
    // Greet the user out BEFORE we clear state — once `user` is null we've
    // lost the display name. The toast lives outside this provider's render
    // tree, so it keeps animating even if the page navigates immediately.
    const farewellName = user?.displayName || user?.username;
    if (farewellName) showGoodbye(farewellName);
    removeToken();
    setTokenState(null);
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchMe();
  };

  const isAdmin = () => user?.role?.type === 'admin';
  const isBlogger = () => user?.role?.type === 'blogger';

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout, refreshUser, isAdmin, isBlogger }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
