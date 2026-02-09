import React, { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
      await refresh();
      nav("/app");
    } catch (e: any) {
      setErr(e.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{maxWidth:520}}>
      <div className="card">
        <h1 className="h1">Inventory POS</h1>
        <div className="muted">Inicia sesión.</div>

        <form onSubmit={submit} style={{marginTop:14, display:"grid", gap:10}}>
          <label className="field">
            <span className="muted">Usuario</span>
            <input className="input" value={username} onChange={e=>setUsername(e.target.value)} />
          </label>
          <label className="field">
            <span className="muted">Contraseña</span>
            <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          </label>

          {err && <div className="card" style={{borderColor:"rgba(251,113,133,0.6)"}}>{err}</div>}

          <button className="btn primary" disabled={busy || !username || !password}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <hr className="sep" />
        <div className="muted">
          <div><b>Demo:</b> admin / admin123 (ADMIN) o user / user123 (USER)</div>
          <div><b>Superadmin:</b> superadmin / superadmin123</div>
        </div>
      </div>
    </div>
  );
}
