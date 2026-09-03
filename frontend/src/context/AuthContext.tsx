import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest } from "../lib/api";

export type AuthUser = {
  id: string; email: string; firstName: string; lastName: string; organizationId: string;
  organization: { id: string; name: string; slug: string }; roles: string[];
};
type AuthContextValue = {
  user: AuthUser | null; loading: boolean; login: (email: string, password: string) => Promise<void>;
  register: (payload: Record<string, string>) => Promise<void>; logout: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("supplyquest_token")) { setLoading(false); return; }
    apiRequest<AuthUser>("/api/v1/auth/me").then(setUser).catch(() => localStorage.removeItem("supplyquest_token")).finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const result = await apiRequest<{ token: string; user: AuthUser }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    localStorage.setItem("supplyquest_token", result.token);
    setUser(result.user);
  };
  const register = async (payload: Record<string, string>) => {
    const result = await apiRequest<{ token: string; user: AuthUser }>("/api/v1/auth/register", { method: "POST", body: JSON.stringify(payload) });
    localStorage.setItem("supplyquest_token", result.token);
    setUser(result.user);
  };
  const logout = async () => {
    try { await apiRequest("/api/v1/auth/logout", { method: "POST" }); } finally { localStorage.removeItem("supplyquest_token"); setUser(null); }
  };
  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}