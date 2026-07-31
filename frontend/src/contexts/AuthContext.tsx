import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, profileApi, TOKEN_KEY } from "../lib/api";
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

function readStoredUser() {
  try {
    const value = localStorage.getItem(USER_KEY);
    return value ? (JSON.parse(value) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [isLoading, setIsLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const persistUser = useCallback((nextUser: User | null) => {
    setUser(nextUser);
    if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    else localStorage.removeItem(USER_KEY);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setIsLoading(false);
      return;
    }
    profileApi
      .get()
      .then(persistUser)
      .catch(() => {
        // Preserve the locally cached identity when the API is temporarily unavailable.
      })
      .finally(() => setIsLoading(false));
  }, [persistUser]);

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
        localStorage.removeItem(TOKEN_KEY);
        persistUser(null);
      },
      updateUser: persistUser,
    }),
    [isLoading, persistUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
