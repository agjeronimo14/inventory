import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { hasRole, useAuth } from "../auth";

export default function Layout() {
  const { me, logout } = useAuth();
  return (
    <div className="container">
      <div className="nav">
        <div style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
          <strong>Inventory POS</strong>
          <span className="badge">{me?.tenant_name ?? (me?.role === "SUPERADMIN" ? "Superadmin" : "—")}</span>
          <span className="badge">{me?.username}</span>
          <span className="badge">{me?.role}</span>
        </div>
        <div style={{marginLeft:"auto", display:"flex", gap:8, flexWrap:"wrap"}}>
          <NavLink to="/app" end className={({isActive}) => isActive ? "active" : ""}>Dashboard</NavLink>
          <NavLink to="/app/products" className={({isActive}) => isActive ? "active" : ""}>Productos</NavLink>
          <NavLink to="/app/sales" className={({isActive}) => isActive ? "active" : ""}>Ventas</NavLink>
          {hasRole(me, "ADMIN") && (
            <>
              <NavLink to="/app/users" className={({isActive}) => isActive ? "active" : ""}>Usuarios</NavLink>
              <NavLink to="/app/settings" className={({isActive}) => isActive ? "active" : ""}>Configuración</NavLink>
            </>
          )}
          {me?.role === "SUPERADMIN" && (
            <NavLink to="/app/super" className={({isActive}) => isActive ? "active" : ""}>Super</NavLink>
          )}
          <button className="btn ghost" onClick={logout}>Salir</button>
        </div>
      </div>

      <div style={{height:12}} />

      <Outlet />
    </div>
  );
}
