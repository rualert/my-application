import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loginWithGoogle, logout as logoutRequest, refresh } from "../api/authApi";
import { setOnSessionExpired } from "../api/client";
import { setAccessToken } from "./tokenStore";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Держит состояние сессии (access token — в памяти, см. tokenStore) и на
 * монтировании пытается тихо восстановить её через refresh (httpOnly cookie),
 * чтобы обновление страницы не разлогинивало пользователя.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    setOnSessionExpired(() => {
      setAccessToken(null);
      setIsAuthenticated(false);
      queryClient.clear();
    });
    return () => setOnSessionExpired(null);
  }, [queryClient]);

  useEffect(() => {
    refresh()
      .then((auth) => {
        setAccessToken(auth.accessToken);
        setIsAuthenticated(true);
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function login(idToken: string): Promise<void> {
    const auth = await loginWithGoogle(idToken);
    setAccessToken(auth.accessToken);
    setIsAuthenticated(true);
  }

  async function logout(): Promise<void> {
    try {
      await logoutRequest();
    } finally {
      setAccessToken(null);
      setIsAuthenticated(false);
      queryClient.clear();
    }
  }

  return <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth должен использоваться внутри AuthProvider.");
  }
  return context;
}
