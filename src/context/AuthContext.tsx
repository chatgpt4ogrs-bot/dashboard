import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser, LoginInput } from '../../shared/auth';
import { getMessages } from '../i18n';
import { ApiError, AUTH_EXPIRED_EVENT, authApi } from '../services/api';

interface AuthContextValue {
  /** `undefined` enquanto a sessão está sendo verificada. */
  user: AuthUser | null | undefined;
  /** Erro ao verificar a sessão (ex.: servidor fora do ar), diferente de "não logado". */
  sessionError: string | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const checkSession = useCallback(async () => {
    try {
      setUser(await authApi.me());
      setSessionError(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setSessionError(null);
      } else {
        setSessionError(error instanceof Error ? error.message : getMessages().errors.sessionCheck);
      }
    }
  }, []);

  useEffect(() => {
    checkSession();
    const handleExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, [checkSession]);

  const login = useCallback(async (input: LoginInput) => {
    setUser(await authApi.login(input));
    setSessionError(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const retry = useCallback(() => {
    setSessionError(null);
    checkSession();
  }, [checkSession]);

  const value = useMemo(() => ({ user, sessionError, login, logout, retry }), [user, sessionError, login, logout, retry]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return context;
}
