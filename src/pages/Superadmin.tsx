import React, { useEffect, useState } from "react";
import { api } from "../api";

type Tenant = { id: string; name: string; created_at: string; };
type TenantUser = { id: string; username: string; role: string; is_active: number; };

export default function Superadmin() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [uName, setUName] = useState("");
  const [uPass, setUPass] = useState("");
  const [uRole, setURole] = useState("ADMIN");

  async function load(){
    const t = await api<Tenant[]>("/api/super/tenants");
    setTenants(t);
  }
  useEffect(()=>{ load(); }, []);

  async function createTenant(){
    await api("/api/super/tenants", { method:"POST", body: JSON.stringify({ name })});
    setName("");
    await load();
  }

  async function select(t: Tenant){
    setSelected(t);
    const us = await api<TenantUser[]>(`/api/super/tenants/${t.id}/users`);
    setUsers(us);
  }

  async function createUser(){
    if (!selected) return;
    await api(`/api/super/tenants/${selected.id}/users`, { method:"POST", body: JSON.stringify({ username:uName, password:uPass, role:uRole })});
    setUName(""); setUPass(""); setURole("ADMIN");
    await select(selected);
  }

  return (
    <div style={{display:"grid", gap:12}}>
      <div className="card">
        <div className="h2">Crear tenant</div>
        <div className="row" style={{alignItems:"flex-end", marginTop:10}}>
          <label className="field">
            <span className="muted">Nombre (único)</span>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} />
          </label>
          <button className="btn primary" disabled={!name} onClick={createTenant}>Crear</button>
        </div>
      </div>

      <div className="card">
        <div className="h2">Tenants</div>
        <table className="table" style={{marginTop:10}}>
          <thead><tr><th>Nombre</th><th>Creado</th><th></th></tr></thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.id}>
                <td style={{fontWeight:800}}>{t.name}</td>
                <td>{new Date(t.created_at).toLocaleString()}</td>
                <td><button className="btn" onClick={()=>select(t)}>Gestionar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card">
          <div className="row" style={{alignItems:"center"}}>
            <div style={{flex:1}}>
              <div className="h2">Usuarios de tenant: {selected.name}</div>
              <div className="muted">Crea el ADMIN inicial o más usuarios.</div>
            </div>
            <button className="btn" onClick={()=>setSelected(null)}>Cerrar</button>
          </div>

          <div className="row" style={{alignItems:"flex-end", marginTop:10}}>
            <label className="field">
              <span className="muted">Usuario</span>
              <input className="input" value={uName} onChange={e=>setUName(e.target.value)} />
            </label>
            <label className="field">
              <span className="muted">Contraseña</span>
              <input className="input" type="password" value={uPass} onChange={e=>setUPass(e.target.value)} />
            </label>
            <label className="field" style={{maxWidth:220}}>
              <span className="muted">Rol</span>
              <select className="select" value={uRole} onChange={e=>setURole(e.target.value)}>
                <option value="ADMIN">ADMIN</option>
                <option value="USER">USER</option>
              </select>
            </label>
            <button className="btn primary" disabled={!uName || !uPass} onClick={createUser}>Crear</button>
          </div>

          <table className="table" style={{marginTop:10}}>
            <thead><tr><th>Usuario</th><th>Rol</th><th>Activo</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{fontWeight:800}}>{u.username}</td>
                  <td>{u.role}</td>
                  <td>{u.is_active===1 ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
