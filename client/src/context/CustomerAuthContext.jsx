import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const CustomerAuthContext = createContext(null);

/**
 * Customer session. The server is authoritative (httpOnly JWT cookie);
 * this context only mirrors /api/auth/me for the UI.
 */
export function CustomerAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user || null);
      return data.user || null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (phone, password) => {
    const { data } = await api.post('/auth/login', { phone, password });
    setUser(data.user || null);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setUser(data.user || null);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* cookie is cleared server-side regardless */ }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, login, register, logout }),
    [user, loading, refresh, login, register, logout]
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used inside <CustomerAuthProvider>');
  return ctx;
}
