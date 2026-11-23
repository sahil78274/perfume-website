import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const AdminAuthContext = createContext(null);

/**
 * Admin session for the /admin area. Enforced server-side on every /api/admin
 * request; this context mirrors /api/admin/auth/me so the SPA can route.
 */
export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/auth/me');
      setAdmin(data.admin || null);
      return data.admin || null;
    } catch {
      setAdmin(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/admin/auth/login', { email, password });
    setAdmin(data.admin || null);
    return data.admin;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/admin/auth/logout'); } catch { /* cookie cleared server-side regardless */ }
    setAdmin(null);
  }, []);

  const value = useMemo(
    () => ({ admin, loading, refresh, login, logout }),
    [admin, loading, refresh, login, logout]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return ctx;
}
