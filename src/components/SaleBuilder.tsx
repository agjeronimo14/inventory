import React, { useMemo, useState } from "react";
import { api } from "../api";
import type { Product } from "./ProductFormModal";

type Currency = "COP" | "USD";
type PaymentMethod = { id: string; label: string; is_active: number; sort_order: number; };

type CartLine = {
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
};

function money(n: number, ccy: Currency){
  const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
  if (ccy === "USD") return "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
  return nf.format(n) + " COP";
}

export default function SaleBuilder({
  products,
  paymentMethods,
  onDone
}:{
  products: Product[];
  paymentMethods: PaymentMethod[];
  onDone: (saleId: string, receiptNumber: string) => void;
}) {
  const [q, setQ] = useState("");
  const [currency, setCurrency] = useState<Currency>("COP");
  const [paymentMethodId, setPaymentMethodId] = useState<string>(() => paymentMethods.find(p=>p.is_active)?.id ?? "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return products.filter(p=>p.is_active===1);
    return products.filter(p => (p.is_active===1) && (
      (p.name?.toLowerCase().includes(qq)) ||
      ((p.sku ?? "").toLowerCase().includes(qq)) ||
      ((p.category ?? "").toLowerCase().includes(qq))
    ));
  }, [q, products]);

  function getPrice(p: Product): number | null {
    return currency === "COP" ? (p.price_cop ?? null) : (p.price_usd ?? null);
  }

  function add(p: Product){
    const price = getPrice(p);
    if (price == null) {
      const manual = prompt(`Este producto no tiene precio en ${currency}. Escribe el precio a vender:`);
      const v = manual ? Number(manual) : NaN;
      if (!Number.isFinite(v) || v<=0) return;
      addLine(p.id, p.name, v);
      return;
    }
    addLine(p.id, p.name, price);
  }

  function addLine(product_id: string, name: string, unit_price: number) {
    setCart(prev => {
      const idx = prev.findIndex(x=>x.product_id===product_id && x.unit_price===unit_price);
      if (idx>=0){
        const copy=[...prev];
        copy[idx]={...copy[idx], qty: copy[idx].qty+1};
        return copy;
      }
      return [...prev, {product_id, name, qty:1, unit_price}];
    });
  }

  function setQty(i: number, qty: number){
    setCart(prev => {
      const copy=[...prev];
      copy[i]={...copy[i], qty: Math.max(1, qty)};
      return copy;
    });
  }

  function remove(i: number){
    setCart(prev => prev.filter((_,idx)=>idx!==i));
  }

  const subtotal = useMemo(() => cart.reduce((a,l)=>a + l.qty*l.unit_price, 0), [cart]);
  const total = Math.max(0, subtotal - (discount || 0));

  async function finalize(){
    if (cart.length===0) return;
    setSaving(true);
    try{
      const resp = await api<{id:string; receipt_number:string}>("/api/sales", {
        method:"POST",
        body: JSON.stringify({
          currency,
          payment_method_id: paymentMethodId || null,
          customer_name: customerName.trim() || null,
          customer_phone: customerPhone.trim() || null,
          discount: discount || 0,
          items: cart.map(l => ({
            product_id: l.product_id,
            qty: l.qty,
            unit_price: l.unit_price
          }))
        })
      });
      setCart([]);
      setQ("");
      setDiscount(0);
      onDone(resp.id, resp.receipt_number);
    } catch(e:any){
      alert(e.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="row" style={{alignItems:"flex-end"}}>
        <label className="field" style={{minWidth:260}}>
          <span className="muted">Buscar producto</span>
          <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="nombre, categoría o SKU" />
        </label>
        <label className="field" style={{maxWidth:160}}>
          <span className="muted">Moneda</span>
          <select className="select" value={currency} onChange={e=>setCurrency(e.target.value as Currency)}>
            <option value="COP">COP</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label className="field" style={{minWidth:220}}>
          <span className="muted">Método de pago</span>
          <select className="select" value={paymentMethodId} onChange={e=>setPaymentMethodId(e.target.value)}>
            {paymentMethods.filter(p=>p.is_active===1).sort((a,b)=>a.sort_order-b.sort_order).map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <div style={{flex:1}} />
        <button className="btn primary" disabled={saving || cart.length===0} onClick={finalize}>
          {saving ? "Procesando…" : "Finalizar venta"}
        </button>
      </div>

      <div style={{height:10}} />

      <div className="row">
        <label className="field">
          <span className="muted">Cliente (opcional)</span>
          <input className="input" value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Consumidor final" />
        </label>
        <label className="field">
          <span className="muted">Teléfono (opcional)</span>
          <input className="input" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} />
        </label>
        <label className="field" style={{maxWidth:220}}>
          <span className="muted">Descuento</span>
          <input className="input" type="number" value={discount} onChange={e=>setDiscount(Number(e.target.value))} />
        </label>
      </div>

      <hr className="sep" />

      <div className="row" style={{alignItems:"flex-start"}}>
        <div style={{flex:1, minWidth:340}}>
          <div className="h2">Resultados</div>
          <div className="muted">Toca para agregar al carrito.</div>
          <div style={{height:10}} />
          <div className="grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))"}}>
            {filtered.slice(0, 30).map(p => {
              const price = currency === "COP" ? p.price_cop : p.price_usd;
              const low = p.stock <= p.low_stock_threshold;
              return (
                <button key={p.id} className="card productCard" style={{textAlign:"left", cursor:"pointer"}} onClick={()=>add(p)}>
                  <div className="productTitle">{p.name}</div>
                  <div className="productMeta">
                    {p.category && <span className="badge">{p.category}</span>}
                    {p.sku && <span className="badge">SKU: {p.sku}</span>}
                    <span className="badge">Stock: {p.stock}</span>
                    {low && <span className="badge" style={{borderColor:"rgba(251,113,133,0.55)", color:"rgba(251,113,133,0.95)"}}>Stock bajo</span>}
                  </div>
                  <div style={{marginTop:"auto"}}>
                    <div className="muted">Precio ({currency})</div>
                    <div style={{fontWeight:800, fontSize:16}}>{price == null ? "—" : money(price, currency)}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="muted" style={{marginTop:10}}>Mostrando hasta 30 resultados. Ajusta la búsqueda para más precisión.</div>
        </div>

        <div style={{width:"min(420px, 100%)"}}>
          <div className="card">
            <div className="h2">Carrito</div>
            {cart.length === 0 ? (
              <div className="muted" style={{marginTop:8}}>Agrega productos para generar la factura.</div>
            ) : (
              <>
                <table className="table" style={{marginTop:10}}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cant</th>
                      <th>Precio</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((l, i) => (
                      <tr key={l.product_id + ":" + i}>
                        <td style={{maxWidth:160}}>{l.name}</td>
                        <td>
                          <input className="input" style={{width:72, padding:"6px 8px"}} type="number" value={l.qty} onChange={e=>setQty(i, Number(e.target.value))} />
                        </td>
                        <td>{money(l.unit_price, currency)}</td>
                        <td style={{fontWeight:700}}>{money(l.qty*l.unit_price, currency)}</td>
                        <td><button className="btn danger" onClick={()=>remove(i)}>X</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <hr className="sep" />
                <div style={{display:"grid", gap:6}}>
                  <div className="row" style={{justifyContent:"space-between"}}>
                    <span className="muted">Subtotal</span>
                    <span>{money(subtotal, currency)}</span>
                  </div>
                  <div className="row" style={{justifyContent:"space-between"}}>
                    <span className="muted">Descuento</span>
                    <span>- {money(discount || 0, currency)}</span>
                  </div>
                  <div className="row" style={{justifyContent:"space-between"}}>
                    <span className="muted">Total</span>
                    <span style={{fontWeight:900, fontSize:18}}>{money(total, currency)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
