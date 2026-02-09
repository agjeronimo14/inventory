import React, { useEffect, useState } from "react";
import { api } from "../api";

type Tenant = { id: string; name: string; business_name: string | null; phone: string | null; address: string | null; logo_url: string | null; };
type PaymentMethod = { id: string; label: string; is_active: number; sort_order: number; };

export default function Settings() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [pm, setPm] = useState<PaymentMethod[]>([]);
  const [saving, setSaving] = useState(false);

  async function load(){
    const [t, p] = await Promise.all([
      api<Tenant>("/api/tenant"),
      api<PaymentMethod[]>("/api/payment-methods")
    ]);
    setTenant(t);
    setPm(p);
  }

  useEffect(()=>{ load(); }, []);

  function setTenantField(k: keyof Tenant, v: any){
    setTenant(prev => prev ? ({...prev, [k]: v}) : prev);
  }

  async function saveTenant(){
    if (!tenant) return;
    setSaving(true);
    try{
      await api("/api/tenant", { method:"PUT", body: JSON.stringify({
        name: tenant.name,
        business_name: tenant.business_name,
        phone: tenant.phone,
        address: tenant.address,
        logo_url: tenant.logo_url
      })});
      await load();
    } catch(e:any){
      alert(e.message||"Error");
    } finally {
      setSaving(false);
    }
  }

  async function savePM(p: PaymentMethod){
    await api(`/api/payment-methods/${p.id}`, { method:"PUT", body: JSON.stringify(p) });
    await load();
  }

  async function createPM(){
    const label = prompt("Nombre del método de pago (ej: Efectivo, Zelle, Transferencia):");
    if (!label) return;
    await api("/api/payment-methods", { method:"POST", body: JSON.stringify({ label }) });
    await load();
  }

  return (
    <div style={{display:"grid", gap:12}}>
      <div className="card">
        <div className="h2">Datos del negocio</div>
        <div className="muted">Esto aparece en la factura.</div>

        {tenant ? (
          <>
            <div className="row" style={{marginTop:10}}>
              <label className="field">
                <span className="muted">Nombre corto (tenant)</span>
                <input className="input" value={tenant.name} onChange={e=>setTenantField("name", e.target.value)} />
              </label>
              <label className="field">
                <span className="muted">Nombre del negocio</span>
                <input className="input" value={tenant.business_name ?? ""} onChange={e=>setTenantField("business_name", e.target.value || null)} />
              </label>
            </div>
            <div className="row">
              <label className="field">
                <span className="muted">Teléfono</span>
                <input className="input" value={tenant.phone ?? ""} onChange={e=>setTenantField("phone", e.target.value || null)} />
              </label>
              <label className="field">
                <span className="muted">Dirección</span>
                <input className="input" value={tenant.address ?? ""} onChange={e=>setTenantField("address", e.target.value || null)} />
              </label>
              <label className="field">
                <span className="muted">Logo URL</span>
                <input className="input" value={tenant.logo_url ?? ""} onChange={e=>setTenantField("logo_url", e.target.value || null)} />
              </label>
            </div>

            <div className="row" style={{justifyContent:"flex-end"}}>
              <button className="btn primary" disabled={saving} onClick={saveTenant}>
                {saving ? "Guardando…" : "Guardar datos"}
              </button>
            </div>
          </>
        ) : <div className="muted" style={{marginTop:10}}>Cargando…</div>}
      </div>

      <div className="card">
        <div className="row" style={{alignItems:"center"}}>
          <div style={{flex:1}}>
            <div className="h2">Métodos de pago</div>
            <div className="muted">Ordena y activa/desactiva.</div>
          </div>
          <button className="btn" onClick={createPM}>Agregar</button>
        </div>

        <table className="table" style={{marginTop:10}}>
          <thead>
            <tr><th>Nombre</th><th>Orden</th><th>Activo</th><th></th></tr>
          </thead>
          <tbody>
            {pm.sort((a,b)=>a.sort_order-b.sort_order).map(p => (
              <tr key={p.id}>
                <td>
                  <input className="input" value={p.label} onChange={e=>setPm(prev => prev.map(x=>x.id===p.id?({...x, label:e.target.value}):x))} />
                </td>
                <td style={{width:120}}>
                  <input className="input" type="number" value={p.sort_order} onChange={e=>setPm(prev => prev.map(x=>x.id===p.id?({...x, sort_order:Number(e.target.value)}):x))} />
                </td>
                <td style={{width:140}}>
                  <select className="select" value={String(p.is_active)} onChange={e=>setPm(prev => prev.map(x=>x.id===p.id?({...x, is_active:Number(e.target.value)}):x))}>
                    <option value="1">Sí</option>
                    <option value="0">No</option>
                  </select>
                </td>
                <td style={{whiteSpace:"nowrap"}}>
                  <button className="btn primary" onClick={()=>savePM(p)}>Guardar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
