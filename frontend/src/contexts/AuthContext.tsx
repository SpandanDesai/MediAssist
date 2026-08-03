import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, profileApi, TOKEN_KEY, api } from "../lib/api";
import type { User } from "../types";

const USER_KEY = "mediassist.user";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  signup: (payload: { name: string; email: string; password: string; age?: number; gender?: string }) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Never treat a cached localStorage user as logged-in until the API verifies the token.
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const persistUser = useCallback((nextUser: User | null) => {
    setUser(nextUser);
    if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    else localStorage.removeItem(USER_KEY);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      localStorage.removeItem(USER_KEY);
      setIsLoading(false);
      return;
    }

    profileApi
      .get()
      .then((profile) => persistUser(profile))
      .catch(() => {
        // Token invalid, expired, or API unreachable — require email/password again.
        clearSession();
      })
      .finally(() => setIsLoading(false));
  }, [clearSession, persistUser]);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error?.response?.status === 401) {
          clearSession();
        }
        return Promise.reject(error);
      },
    );
    return () => api.interceptors.response.eject(interceptor);
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      login: async (payload) => {
        const result = await authApi.login(payload);
        localStorage.setItem(TOKEN_KEY, result.token);
        persistUser(result.user);
      },
      signup: async (payload) => {
        const result = await authApi.signup(payload);
        localStorage.setItem(TOKEN_KEY, result.token);
        persistUser(result.user);
      },
      logout: () => {
        clearSession();
      },
      updateUser: persistUser,
    }),
    [clearSession, isLoading, persistUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
