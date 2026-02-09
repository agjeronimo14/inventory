import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

export type Role = "SUPERADMIN" | "ADMIN" | "USER";

export type Me = {
  id: string;
  username: string;
  role: Role;
  tenant_id: string | null;
  tenant_name?: string | null;
};

type AuthCtx = {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const m = await api<Me>("/api/me");
      setMe(m);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await api("/api/logout", { method: "POST" });
    setMe(null);
  }

  useEffect(() => { refresh(); }, []);

  const value = useMemo(() => ({ me, loading, refresh, logout }), [me, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}

export function hasRole(me: Me | null, role: Role) {
  if (!me) return false;
  const order: Role[] = ["USER", "ADMIN", "SUPERADMIN"];
  return order.indexOf(me.role) >= order.indexOf(role);
}
