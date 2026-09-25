import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);

export const ROLE_LABELS = {
  ADMIN: 'Administrador',
  PROFESOR: 'Profesor',
  ESTUDIANTE: 'Estudiante de curso',
  INDEPENDIENTE: 'Estudiante independiente',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));
  const [notice, setNotice] = useState(null);
  const idleMinutes = useRef(30);

  const logout = useCallback((message) => {
    tokenStore.set(null);
    setUser(null);
    if (message) setNotice(message);
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setLoading(false);
      return null;
    }
    try {
      const data = await api.get('/auth/me');
      idleMinutes.current = data.sessionIdleMinutes || 30;
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // El servidor respondió 401 con un token guardado: la sesión caducó.
  useEffect(() => {
    const onExpired = () => logout('Tu sesión expiró por inactividad. Inicia sesión de nuevo.');
    window.addEventListener('session-expired', onExpired);
    return () => window.removeEventListener('session-expired', onExpired);
  }, [logout]);

  // RNF-03: cierre de sesión automático por inactividad también en el navegador.
  useEffect(() => {
    if (!user) return undefined;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => logout('Tu sesión se cerró por inactividad.'), idleMinutes.current * 60_000);
    };
    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user, logout]);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    tokenStore.set(data.token);
    setNotice(null);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const data = await api.post('/auth/register', payload);
    tokenStore.set(data.token);
    setNotice(null);
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, refresh, notice, setNotice }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export const isManager = (user) => user?.role === 'PROFESOR' || user?.role === 'ADMIN';
export const isStudent = (user) => user?.role === 'ESTUDIANTE' || user?.role === 'INDEPENDIENTE';
