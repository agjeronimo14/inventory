import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import SaleBuilder from "../components/SaleBuilder";
import type { Product } from "../components/ProductFormModal";

type PaymentMethod = { id: string; label: string; is_active: number; sort_order: number; };
type SaleRow = { id: string; receipt_number: string; created_at: string; currency: "COP"|"USD"; total: number; customer_name: string | null; payment_method_label: string | null; };

export default function Sales() {
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [q, setQ] = useState("");
  const [receipt, setReceipt] = useState<{id:string; number:string} | null>(null);

  async function load(){
    const [p, pm, s] = await Promise.all([
      api<Product[]>("/api/products"),
      api<PaymentMethod[]>("/api/payment-methods"),
      api<SaleRow[]>("/api/sales?limit=50")
    ]);
    setProducts(p);
    setPaymentMethods(pm);
    setRows(s);
  }

  useEffect(()=>{ load(); }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter(r =>
      r.receipt_number.toLowerCase().includes(qq) ||
      (r.customer_name ?? "").toLowerCase().includes(qq) ||
      (r.payment_method_label ?? "").toLowerCase().includes(qq)
    );
  }, [q, rows]);

  function fmtMoney(n:number, ccy:"COP"|"USD"){
    if (ccy==="USD") return "$" + new Intl.NumberFormat("en-US", {maximumFractionDigits:2}).format(n);
    return new Intl.NumberFormat("es-CO", {maximumFractionDigits:0}).format(n) + " COP";
  }

  async function openReceipt(saleId: string){
    const html = await api<string>(`/api/receipt/${saleId}`, { headers: { "Accept": "text/html" } });
    const w = window.open("", "_blank");
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  }

  return (
    <div style={{display:"grid", gap:12}}>
      <SaleBuilder
        products={products}
        paymentMethods={paymentMethods}
        onDone={(id, number)=>{ setReceipt({id, number}); load(); }}
      />

      {receipt && (
        <div className="card">
          <div className="row" style={{alignItems:"center"}}>
            <div style={{flex:1}}>
              <div className="h2">Factura lista</div>
              <div className="muted">N° {receipt.number}</div>
            </div>
            <button className="btn primary" onClick={()=>openReceipt(receipt.id)}>Abrir / imprimir</button>
            <button className="btn" onClick={()=>setReceipt(null)}>Cerrar</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="row" style={{alignItems:"flex-end"}}>
          <div style={{flex:1}}>
            <div className="h2">Historial de ventas</div>
            <div className="muted">Últimas 50 ventas.</div>
          </div>
          <label className="field" style={{maxWidth:360}}>
            <span className="muted">Buscar</span>
            <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="recibo, cliente o método" />
          </label>
        </div>

        <div style={{height:10}} />

        <table className="table">
          <thead>
            <tr>
              <th>Recibo</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Método</th>
              <th>Moneda</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td style={{fontWeight:800}}>{r.receipt_number}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.customer_name ?? "—"}</td>
                <td>{r.payment_method_label ?? "—"}</td>
                <td>{r.currency}</td>
                <td style={{fontWeight:800}}>{fmtMoney(r.total, r.currency)}</td>
                <td><button className="btn" onClick={()=>openReceipt(r.id)}>Factura</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
