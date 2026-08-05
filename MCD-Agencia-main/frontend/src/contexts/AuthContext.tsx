'use client';

/**
 * Authentication Context for MCD-Agencia.
 *
 * This module provides authentication state management:
 *   - User state
 *   - Login/logout functionality
 *   - Token management
 *   - Protected route handling
 *   - Session timeout (15 minutes of inactivity)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  User,
  LoginCredentials,
  RegisterData,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  getProfile,
} from '@/lib/api/auth';
import { clearTokens } from '@/lib/api/client';

// Session timeout configuration
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_TIMEOUT_MS = 2 * 60 * 1000; // Show warning 2 minutes before

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  resetSessionTimer: () => void;
  sessionTimeRemaining: number | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number | null>(null);

  // Session timeout refs
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Clear all session timers
  const clearSessionTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setSessionTimeRemaining(null);
  }, []);

  // Logout with session expired message
  const sessionExpiredLogout = useCallback(() => {
    clearSessionTimers();
    apiLogout();
    setUser(null);
    toast.error('Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.', {
      duration: 5000,
    });
    router.push('/login');
  }, [clearSessionTimers, router]);

  // Reset session timer (called on user activity)
  const resetSessionTimer = useCallback(() => {
    if (!user) return;

    lastActivityRef.current = Date.now();
    clearSessionTimers();

    // Set warning timer (fires 2 minutes before timeout)
    warningRef.current = setTimeout(() => {
      toast('Tu sesión expirará en 2 minutos por inactividad.', {
        icon: '⚠️',
        duration: 10000,
      });

      // Start countdown
      let remaining = WARNING_BEFORE_TIMEOUT_MS;
      setSessionTimeRemaining(remaining);

      countdownRef.current = setInterval(() => {
        remaining -= 1000;
        setSessionTimeRemaining(remaining);

        if (remaining <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
        }
      }, 1000);
    }, SESSION_TIMEOUT_MS - WARNING_BEFORE_TIMEOUT_MS);

    // Set logout timer
    timeoutRef.current = setTimeout(sessionExpiredLogout, SESSION_TIMEOUT_MS);
  }, [user, clearSessionTimers, sessionExpiredLogout]);

  // Track user activity
  useEffect(() => {
    if (!user) {
      clearSessionTimers();
      return;
    }

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

    const handleActivity = () => {
      const now = Date.now();
      // Only reset if at least 1 second has passed (debounce)
      if (now - lastActivityRef.current > 1000) {
        resetSessionTimer();
      }
    };

    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer
    resetSessionTimer();

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearSessionTimers();
    };
  }, [user, resetSessionTimer, clearSessionTimers]);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await getProfile();
        setUser(profile);
      } catch {
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Global auth event listener (token expiration / invalidation)
  useEffect(() => {
    const handleTokensCleared = (event: Event) => {
      const customEvent = event as CustomEvent<{ reason?: 'manual' | 'expired' | 'unauthorized' }>;
      const reason = customEvent.detail?.reason ?? 'manual';

      setUser(null);

      if (reason !== 'manual') {
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
        if (!currentPath.includes('/login')) {
          toast.error('Tu sesión expiró. Inicia sesión nuevamente.');
          router.push('/login');
        }
      }
    };

    window.addEventListener('auth:tokens-cleared', handleTokensCleared as EventListener);
    return () => {
      window.removeEventListener('auth:tokens-cleared', handleTokensCleared as EventListener);
    };
  }, [router]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const { user: loggedInUser } = await apiLogin(credentials);
    setUser(loggedInUser);
    // Session timer will start automatically via useEffect
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    await apiRegister(data);
    // After registration, user needs to verify email before logging in
  }, []);

  const logout = useCallback(() => {
    clearSessionTimers();
    apiLogout();
    setUser(null);
    router.push('/');
  }, [router, clearSessionTimers]);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await getProfile();
      setUser(profile);
    } catch {
      clearTokens();
      setUser(null);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
    resetSessionTimer,
    sessionTimeRemaining,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  redirectTo: string = '/login'
) {
  return function ProtectedRoute(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push(redirectTo);
      }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}

// Hook for admin-only routes
export function useRequireAdmin() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (user?.role?.name !== 'admin') {
        router.push('/');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  const isAdmin = user?.role?.name === 'admin';

  return { isAdmin, isLoading };
}

export default AuthContext;
