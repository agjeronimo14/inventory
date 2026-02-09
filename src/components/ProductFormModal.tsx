import React, { useEffect, useState } from "react";

export type Product = {
  id: string;
  name: string;
  category: string | null;
  sku: string | null;
  cost_cop: number | null;
  cost_usd: number | null;
  price_cop: number | null;
  price_usd: number | null;
  stock: number;
  low_stock_threshold: number;
  is_active: number;
};

export function ProductFormModal({
  open,
  onClose,
  onSave,
  initial
}:{
  open: boolean;
  onClose: () => void;
  onSave: (p: Partial<Product>) => Promise<void>;
  initial?: Product | null;
}) {
  const [form, setForm] = useState<Partial<Product>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial ?? { is_active: 1, stock: 0, low_stock_threshold: 2 });
  }, [initial, open]);

  if (!open) return null;

  function set<K extends keyof Product>(k: K, v: any) {
    setForm(prev => ({...prev, [k]: v}));
  }

  async function submit() {
    setSaving(true);
    try{
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"grid", placeItems:"center", padding:16, zIndex:50}}>
      <div className="card" style={{width:"min(820px, 96vw)"}}>
        <div className="row" style={{alignItems:"center"}}>
          <div style={{flex:1}}>
            <div className="h2">{initial ? "Editar producto" : "Nuevo producto"}</div>
            <div className="muted">Costo y precio por moneda (COP/USD). Si no vendes en una moneda, déjalo vacío.</div>
          </div>
          <button className="btn" onClick={onClose}>Cerrar</button>
        </div>

        <hr className="sep" />

        <div className="row">
          <label className="field">
            <span className="muted">Nombre *</span>
            <input className="input" value={form.name ?? ""} onChange={e=>set("name", e.target.value)} />
          </label>
          <label className="field">
            <span className="muted">Categoría</span>
            <input className="input" value={form.category ?? ""} onChange={e=>set("category", e.target.value || null)} />
          </label>
          <label className="field">
            <span className="muted">SKU/Código</span>
            <input className="input" value={form.sku ?? ""} onChange={e=>set("sku", e.target.value || null)} />
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span className="muted">Costo COP</span>
            <input className="input" type="number" value={form.cost_cop ?? ""} onChange={e=>set("cost_cop", e.target.value === "" ? null : Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="muted">Precio COP</span>
            <input className="input" type="number" value={form.price_cop ?? ""} onChange={e=>set("price_cop", e.target.value === "" ? null : Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="muted">Costo USD</span>
            <input className="input" type="number" value={form.cost_usd ?? ""} onChange={e=>set("cost_usd", e.target.value === "" ? null : Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="muted">Precio USD</span>
            <input className="input" type="number" value={form.price_usd ?? ""} onChange={e=>set("price_usd", e.target.value === "" ? null : Number(e.target.value))} />
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span className="muted">Stock actual</span>
            <input className="input" type="number" value={form.stock ?? 0} onChange={e=>set("stock", Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="muted">Stock mínimo (alerta)</span>
            <input className="input" type="number" value={form.low_stock_threshold ?? 2} onChange={e=>set("low_stock_threshold", Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="muted">Activo</span>
            <select className="select" value={String(form.is_active ?? 1)} onChange={e=>set("is_active", Number(e.target.value))}>
              <option value="1">Sí</option>
              <option value="0">No</option>
            </select>
          </label>
        </div>

        <hr className="sep" />

        <div className="row" style={{justifyContent:"flex-end"}}>
          <button className="btn primary" disabled={saving || !(form.name && String(form.name).trim().length>0)} onClick={submit}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
