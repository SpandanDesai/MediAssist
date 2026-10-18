import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, profileApi, api } from "../lib/api";
import type { User } from "../types";

const USER_KEY = "mediassist.user";
// Non-sensitive hint that a cookie session likely exists, used only to avoid an
// unnecessary bootstrap request. The token itself lives in an httpOnly cookie.
const SESSION_HINT_KEY = "mediassist.session";

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
  // Never trust a cached hint as logged-in until the API verifies the session cookie.
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_HINT_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const persistUser = useCallback((nextUser: User | null) => {
    setUser(nextUser);
    if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    else localStorage.removeItem(USER_KEY);
  }, []);

  useEffect(() => {
    // Without a prior session hint, skip the bootstrap call entirely.
    if (!localStorage.getItem(SESSION_HINT_KEY)) {
      setIsLoading(false);
      return;
    }

    profileApi
      .get()
      .then((profile) => persistUser(profile))
      .catch(() => {
        // Cookie invalid, expired, or API unreachable — require email/password again.
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
        localStorage.setItem(SESSION_HINT_KEY, "1");
        persistUser(result.user);
      },
      signup: async (payload) => {
        const result = await authApi.signup(payload);
        localStorage.setItem(SESSION_HINT_KEY, "1");
        persistUser(result.user);
      },
      logout: async () => {
        await authApi.logout();
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
