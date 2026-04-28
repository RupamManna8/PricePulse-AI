import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../lib/api';

export type AuthUser = {
  userId: string;
  email: string;
  fullName: string;
  provider: 'local' | 'google' | string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isSignedIn: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  startGoogleOAuth: () => void;
  finishOAuthFromUrl: () => Promise<boolean>;
  signOut: () => void;
};

const USER_KEY = 'pp_auth_user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function saveSession(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(USER_KEY);
}

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const response = await apiClient.get<{ success: boolean; user: AuthUser }>('/api/auth/me');
        if (mounted) {
          setUser(response.data.user);
        }

        try {
          const settings = await apiClient.get<{ success: boolean; settings: { currency?: string } }>('/api/auth/settings');
          localStorage.setItem('pp_currency', settings.data.settings?.currency || 'INR');
        } catch {
          localStorage.setItem('pp_currency', 'INR');
        }
      } catch {
        clearSession();
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  async function signIn(email: string, password: string) {
    const response = await apiClient.post<{ success: boolean; user: AuthUser }>('/api/auth/login', {
      email,
      password
    });

    saveSession(response.data.user);
    setUser(response.data.user);
  }

  async function signUp(fullName: string, email: string, password: string) {
    const response = await apiClient.post<{ success: boolean; user: AuthUser }>('/api/auth/sign-up', {
      fullName,
      email,
      password
    });

    saveSession(response.data.user);
    setUser(response.data.user);
  }

  function startGoogleOAuth() {
    const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
    window.location.href = `${baseURL}/api/auth/oauth2/google`;
  }

  async function finishOAuthFromUrl() {
    try {
      const response = await apiClient.get<{ success: boolean; user: AuthUser }>('/api/auth/me');
      saveSession(response.data.user);
      setUser(response.data.user);
      window.history.replaceState({}, document.title, '/auth/oauth2/callback');
      return true;
    } catch {
      clearSession();
      setUser(null);
      return false;
    }
  }

  function signOut() {
    void apiClient.post('/api/auth/logout').catch(() => undefined);
    clearSession();
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isSignedIn: !!user,
    isLoading,
    signIn,
    signUp,
    startGoogleOAuth,
    finishOAuthFromUrl,
    signOut
  }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
