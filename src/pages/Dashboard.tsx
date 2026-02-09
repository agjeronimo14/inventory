import React, { useEffect, useState } from "react";
import { api } from "../api";

type KPI = {
  today_sales_count: number;
  today_total_cop: number;
  today_total_usd: number;
  products_count: number;
  low_stock_count: number;
};

function fmt(n:number){ return new Intl.NumberFormat("es-CO", {maximumFractionDigits:0}).format(n); }

export default function Dashboard() {
  const [kpi, setKpi] = useState<KPI | null>(null);

  useEffect(() => {
    api<KPI>("/api/dashboard").then(setKpi).catch(()=>setKpi(null));
  }, []);

  return (
    <div className="row">
      <div className="card kpi">
        <div className="muted">Ventas hoy</div>
        <div className="val">{kpi ? kpi.today_sales_count : "—"}</div>
      </div>
      <div className="card kpi">
        <div className="muted">Total hoy (COP)</div>
        <div className="val">{kpi ? fmt(kpi.today_total_cop) : "—"}</div>
      </div>
      <div className="card kpi">
        <div className="muted">Total hoy (USD)</div>
        <div className="val">{kpi ? "$" + new Intl.NumberFormat("en-US", {maximumFractionDigits:2}).format(kpi.today_total_usd) : "—"}</div>
      </div>
      <div className="card kpi">
        <div className="muted">Productos</div>
        <div className="val">{kpi ? kpi.products_count : "—"}</div>
      </div>
      <div className="card kpi">
        <div className="muted">Stock bajo</div>
        <div className="val">{kpi ? kpi.low_stock_count : "—"}</div>
      </div>
    </div>
  );
}
