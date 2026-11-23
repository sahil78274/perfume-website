import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';

const AdminAuthContext = createContext(null);

/**
 * Admin session state is a UI mirror of the server-owned HttpOnly cookie.
 * The cookie is never copied into browser storage; /admin/auth/me verifies it
 * on app startup and every protected API independently enforces adminAuth.
 */
export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const adminRef = useRef(null);

  const updateAdmin = useCallback((value) => {
    adminRef.current = value;
    setAdmin(value);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/auth/me');
      const verifiedAdmin = data.admin || null;
      updateAdmin(verifiedAdmin);
      setAuthError('');
      return verifiedAdmin;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        // A definitive rejection means the cookie is expired/invalid/deactivated.
        updateAdmin(null);
        setAuthError('');
        return null;
      }
      // Network/5xx errors are not proof that a previously valid session is invalid.
      // Preserve it and let the route show a retryable verification error.
      setAuthError(error.message || 'Could not verify the admin session. Check the connection and retry.');
      return adminRef.current;
    } finally {
      setLoading(false);
    }
  }, [updateAdmin]);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (email, password) => {
    await api.post('/admin/auth/login', { email, password });
    // Confirm the browser accepted and returned the HttpOnly cookie before entering the console.
    const { data } = await api.get('/admin/auth/me');
    const loggedInAdmin = data.admin || null;
    updateAdmin(loggedInAdmin);
    setAuthError('');
    return loggedInAdmin;
  }, [updateAdmin]);

  const logout = useCallback(async () => {
    // Do not discard the local authenticated view if the server failed to clear its cookie.
    await api.post('/admin/auth/logout');
    updateAdmin(null);
    setAuthError('');
  }, [updateAdmin]);

  const value = useMemo(
    () => ({ admin, loading, authError, refresh, login, logout }),
    [admin, loading, authError, refresh, login, logout]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return ctx;
}
