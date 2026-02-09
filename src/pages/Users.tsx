import React, { useEffect, useState } from "react";
import { api } from "../api";
import { Role } from "../auth";

type UserRow = { id: string; username: string; role: Role; is_active: number; };

export default function Users() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const [busy, setBusy] = useState(false);

  async function load(){
    const res = await api<UserRow[]>("/api/users");
    setRows(res);
  }
  useEffect(()=>{ load(); }, []);

  async function create(){
    setBusy(true);
    try{
      await api("/api/users", { method:"POST", body: JSON.stringify({ username, password, role })});
      setUsername(""); setPassword(""); setRole("USER");
      await load();
    } catch(e:any){
      alert(e.message||"Error");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(u: UserRow){
    await api(`/api/users/${u.id}`, { method:"PUT", body: JSON.stringify({ is_active: u.is_active===1 ? 0 : 1 })});
    await load();
  }

  return (
    <div style={{display:"grid", gap:12}}>
      <div className="card">
        <div className="h2">Crear usuario</div>
        <div className="row" style={{alignItems:"flex-end", marginTop:10}}>
          <label className="field">
            <span className="muted">Usuario</span>
            <input className="input" value={username} onChange={e=>setUsername(e.target.value)} />
          </label>
          <label className="field">
            <span className="muted">Contraseña</span>
            <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          </label>
          <label className="field" style={{maxWidth:220}}>
            <span className="muted">Rol</span>
            <select className="select" value={role} onChange={e=>setRole(e.target.value as Role)}>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          <button className="btn primary" disabled={busy || !username || !password} onClick={create}>
            {busy ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="h2">Usuarios</div>
        <table className="table" style={{marginTop:10}}>
          <thead>
            <tr><th>Usuario</th><th>Rol</th><th>Activo</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <tr key={u.id}>
                <td style={{fontWeight:800}}>{u.username}</td>
                <td>{u.role}</td>
                <td>{u.is_active===1 ? "Sí" : "No"}</td>
                <td>
                  <button className="btn" onClick={()=>toggle(u)}>{u.is_active===1 ? "Desactivar" : "Activar"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
