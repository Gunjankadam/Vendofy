import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { getApiUrl } from '@/lib/api';

export type UserRole = 'admin' | 'distributor' | 'customer';

interface User {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  isSuperAdmin?: boolean;
  token?: string;
  expiresAt?: number;
  avatarUrl?: string;
  mustChangePassword?: boolean;
  uid?: string;
  businessName?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  updateUser: (partial: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Optimize initial state - use lazy initialization
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const logoutTimerRef = useRef<number | null>(null);

  const scheduleLogout = (expiresAt?: number) => {
    if (logoutTimerRef.current) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }

    if (!expiresAt) return;

    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      logout();
      return;
    }

    logoutTimerRef.current = window.setTimeout(() => {
      logout();
    }, delay);
  };

  useEffect(() => {
    if (user?.expiresAt) {
      scheduleLogout(user.expiresAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string, role: UserRole) => {
    const response = await fetch(getApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, role }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();

    const loggedInUser: User = {
      id: data.id,
      email: data.email,
      role: data.role as UserRole,
      name: data.name,
      isSuperAdmin: data.isSuperAdmin,
      token: data.token,
      expiresAt: data.expiresAt,
      avatarUrl: data.avatarUrl,
      mustChangePassword: data.mustChangePassword || false,
      uid: data.uid,
      businessName: data.businessName,
    };

    setUser(loggedInUser);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    scheduleLogout(data.expiresAt);
  };

  const logout = () => {
    const currentToken = user?.token;
    if (currentToken) {
      void fetch(getApiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to notify server about logout', error);
      });
    }

    setUser(null);
    localStorage.removeItem('user');
    if (logoutTimerRef.current) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  };

  const updateUser = (partial: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
