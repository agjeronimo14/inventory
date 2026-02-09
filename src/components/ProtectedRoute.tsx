import React from "react";
import { Navigate } from "react-router-dom";
import { Role, hasRole, useAuth } from "../auth";

export default function ProtectedRoute({ minRole, children }: { minRole: Role, children: React.ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <div className="card">Cargando…</div>;
  if (!me) return <Navigate to="/login" replace />;
  if (!hasRole(me, minRole)) return <div className="card">No tienes permisos.</div>;
  return <>{children}</>;
}
