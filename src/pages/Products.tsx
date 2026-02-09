import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Product, ProductFormModal } from "../components/ProductFormModal";
import { hasRole, useAuth } from "../auth";

export default function Products() {
  const { me } = useAuth();
  const canEdit = hasRole(me, "ADMIN");
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Product | null>(null);

  async function load(){
    const res = await api<Product[]>("/api/products");
    setItems(res);
  }

  useEffect(()=>{ load(); }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter(p =>
      p.name.toLowerCase().includes(qq) ||
      ((p.sku ?? "").toLowerCase().includes(qq)) ||
      ((p.category ?? "").toLowerCase().includes(qq))
    );
  }, [q, items]);

  async function save(payload: Partial<Product>){
    if (edit) {
      await api(`/api/products/${edit.id}`, { method:"PUT", body: JSON.stringify(payload) });
    } else {
      await api(`/api/products`, { method:"POST", body: JSON.stringify(payload) });
    }
    await load();
  }

  async function toggleActive(p: Product){
    await api(`/api/products/${p.id}`, {
      method:"PUT",
      body: JSON.stringify({ is_active: p.is_active === 1 ? 0 : 1 })
    });
    await load();
  }

  return (
    <div className="card">
      <div className="row" style={{alignItems:"flex-end"}}>
        <div style={{flex:1}}>
          <div className="h2">Productos</div>
          <div className="muted">Gestiona tu inventario y precios por moneda.</div>
        </div>
        <label className="field" style={{maxWidth:340}}>
          <span className="muted">Buscar</span>
          <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="nombre, categoría o SKU" />
        </label>
        {canEdit && (
          <button className="btn primary" onClick={()=>{setEdit(null); setOpen(true);}}>Nuevo</button>
        )}
      </div>

      <div style={{height:10}} />

      <table className="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>SKU</th>
            <th>Stock</th>
            <th>Precio COP</th>
            <th>Precio USD</th>
            <th>Activo</th>
            {canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map(p => {
            const low = p.stock <= p.low_stock_threshold;
            return (
              <tr key={p.id}>
                <td style={{fontWeight:700}}>{p.name}</td>
                <td>{p.category ?? "—"}</td>
                <td>{p.sku ?? "—"}</td>
                <td>
                  {p.stock}
                  {low && <span className="badge" style={{marginLeft:8, borderColor:"rgba(251,113,133,0.55)", color:"rgba(251,113,133,0.95)"}}>bajo</span>}
                </td>
                <td>{p.price_cop == null ? "—" : new Intl.NumberFormat("es-CO", {maximumFractionDigits:0}).format(p.price_cop)}</td>
                <td>{p.price_usd == null ? "—" : "$" + new Intl.NumberFormat("en-US", {maximumFractionDigits:2}).format(p.price_usd)}</td>
                <td>{p.is_active === 1 ? "Sí" : "No"}</td>
                {canEdit && (
                  <td style={{whiteSpace:"nowrap"}}>
                    <button className="btn" onClick={()=>{setEdit(p); setOpen(true);}}>Editar</button>{" "}
                    <button className="btn" onClick={()=>toggleActive(p)}>{p.is_active===1 ? "Desactivar" : "Activar"}</button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <ProductFormModal
        open={open}
        onClose={()=>setOpen(false)}
        onSave={save}
        initial={edit}
      />
    </div>
  );
}
