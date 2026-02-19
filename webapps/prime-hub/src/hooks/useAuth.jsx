import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const data = await api.authStatus();
      if (data.authenticated) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const loginWithTelegram = useCallback(async (telegramUser) => {
    const data = await api.telegramLogin(telegramUser);
    if (data.authenticated && data.registered) {
      setUser(data.user);
      return { success: true };
    }
    return { success: false, ...data };
  }, []);

  const loginWithEmail = useCallback(async (email, password, rememberMe = false) => {
    const data = await api.emailLogin(email, password, rememberMe);
    if (data.authenticated) {
      setUser(data.user);
      return { success: true };
    }
    return { success: false, ...data };
  }, []);

  const registerWithEmail = useCallback(async (firstName, email, password, lastName = '') => {
    const data = await api.emailRegister(firstName, email, password, lastName);
    if (data.authenticated) {
      setUser(data.user);
      return { success: true };
    }
    return { success: false, ...data };
  }, []);

  const loginWithX = useCallback(async () => {
    const data = await api.xLoginStart();
    if (data.success && data.url) {
      window.location.href = data.url;
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    window.location.replace('/');
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      loginWithTelegram,
      loginWithEmail,
      registerWithEmail,
      loginWithX,
      logout,
      checkAuth,
    }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
