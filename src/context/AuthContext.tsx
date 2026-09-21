import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Bearer API key for control-plane calls (empty in mock/demo mode). */
  apiKey: string;
  setApiKey: (key: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("aa_user");
      return saved ? (JSON.parse(saved) as User) : null;
    } catch {
      // Corrupted persisted user — clear it and fall back to signed-out
      try { localStorage.removeItem("aa_user"); } catch { /* noop */ }
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKeyState] = useState<string>(() => localStorage.getItem("aa_api_key") ?? "");

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    if (key) localStorage.setItem("aa_api_key", key);
    else localStorage.removeItem("aa_api_key");
  }, []);

  const signIn = useCallback(async (email: string, _password: string) => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const newUser = { id: "user_001", email, name: email.split("@")[0] };
    setUser(newUser);
    localStorage.setItem("aa_user", JSON.stringify(newUser));
    setIsLoading(false);
  }, []);

  const signUp = useCallback(async (email: string, _password: string, name: string) => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const newUser = { id: "user_001", email, name };
    setUser(newUser);
    localStorage.setItem("aa_user", JSON.stringify(newUser));
    setIsLoading(false);
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem("aa_user");
    setApiKeyState("");
    localStorage.removeItem("aa_api_key");
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, apiKey, setApiKey, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
