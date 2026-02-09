export interface Env {
  DB: D1Database;
}

type Role = "SUPERADMIN" | "ADMIN" | "USER";

function json(data: any, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function html(data: string, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(data, { ...init, headers });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, { status });
}

function parseCookie(cookie: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookie) return out;
  for (const part of cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

function base64(bytes: ArrayBuffer) {
  const b = new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64url(bytes: Uint8Array) {
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Base64(str: string) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(str));
  return base64(digest);
}

async function pbkdf2(password: string, saltB64: string) {
  const enc = new TextEncoder();
  const salt = base64ToBytes(saltB64);
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 },
    key,
    256
  );
  return base64(bits);
}

const roleOrder: Role[] = ["USER", "ADMIN", "SUPERADMIN"];
function hasRole(role: Role, min: Role) {
  return roleOrder.indexOf(role) >= roleOrder.indexOf(min);
}

type Me = { id: string; username: string; role: Role; tenant_id: string | null; tenant_name?: string | null; };

async function getMe(request: Request, env: Env): Promise<Me | null> {
  const cookies = parseCookie(request.headers.get("Cookie"));
  const token = cookies["session"];
  if (!token) return null;

  const token_hash = await sha256Base64(token);
  const now = new Date().toISOString();

  const sess = await env.DB.prepare(
    `SELECT s.user_id, u.username, u.role, u.tenant_id, t.name as tenant_name
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1`
  ).bind(token_hash, now).first<any>();

  if (!sess) return null;

  return {
    id: sess.user_id,
    username: sess.username,
    role: sess.role,
    tenant_id: sess.tenant_id,
    tenant_name: sess.tenant_name ?? null
  };
}

function setCookieHeader(token: string, requestUrl: string) {
  const url = new URL(requestUrl);
  const secure = url.protocol === "https:";
  const parts = [
    `session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : ""
  ].filter(Boolean);
  parts.push("Max-Age=2592000");
  return parts.join("; ");
}

function clearCookieHeader() {
  return "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

function uuid() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
}

async function requireAuth(request: Request, env: Env): Promise<Me | Response> {
  const me = await getMe(request, env);
  if (!me) return err("No autenticado", 401);
  return me;
}

function requireTenant(me: Me): string | Response {
  if (!me.tenant_id) return err("Tenant requerido", 400);
  return me.tenant_id;
}

async function requireMinRole(request: Request, env: Env, min: Role): Promise<Me | Response> {
  const meOr = await requireAuth(request, env);
  if (meOr instanceof Response) return meOr;
  if (!hasRole(meOr.role, min)) return err("No autorizado", 403);
  return meOr;
}

async function readJson<T>(request: Request): Promise<T | null> {
  const ct = request.headers.get("Content-Type") || "";
  if (!ct.includes("application/json")) return null;
  return await request.json<T>();
}

function getPathParts(request: Request) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/^\/api\/?/, "");
  const parts = p.split("/").filter(Boolean);
  return { parts, url };
}

async function login(request: Request, env: Env) {
  const body = await readJson<{ username: string; password: string }>(request);
  if (!body?.username || !body?.password) return err("username/password requeridos");

  const u = await env.DB.prepare(
    `SELECT id, username, role, tenant_id, password_salt, password_hash, is_active
     FROM users WHERE username = ? LIMIT 1`
  ).bind(body.username).first<any>();

  if (!u || u.is_active !== 1) return err("Credenciales inválidas", 401);

  const computed = await pbkdf2(body.password, u.password_salt);
  if (computed !== u.password_hash) return err("Credenciales inválidas", 401);

  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const token_hash = await sha256Base64(token);

  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(uuid(), u.id, token_hash, expires).run();

  const headers = new Headers();
  headers.set("Set-Cookie", setCookieHeader(token, request.url));
  return json({ ok: true }, { headers });
}

async function logout(request: Request, env: Env) {
  const cookies = parseCookie(request.headers.get("Cookie"));
  const token = cookies["session"];
  if (token) {
    const token_hash = await sha256Base64(token);
    await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(token_hash).run();
  }
  const headers = new Headers();
  headers.set("Set-Cookie", clearCookieHeader());
  return json({ ok: true }, { headers });
}

async function me(request: Request, env: Env) {
  const m = await getMe(request, env);
  if (!m) return err("No autenticado", 401);
  return json(m);
}

async function dashboard(request: Request, env: Env, me: Me) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;

  const today = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM sales WHERE tenant_id = ? AND date(created_at) = date('now')) as today_sales_count,
      (SELECT COALESCE(SUM(total),0) FROM sales WHERE tenant_id = ? AND currency='COP' AND date(created_at)=date('now')) as today_total_cop,
      (SELECT COALESCE(SUM(total),0) FROM sales WHERE tenant_id = ? AND currency='USD' AND date(created_at)=date('now')) as today_total_usd,
      (SELECT COUNT(*) FROM products WHERE tenant_id = ?) as products_count,
      (SELECT COUNT(*) FROM products WHERE tenant_id = ? AND is_active=1 AND stock <= low_stock_threshold) as low_stock_count
    `
  ).bind(tenant, tenant, tenant, tenant, tenant).first<any>();

  return json(today ?? {
    today_sales_count: 0, today_total_cop: 0, today_total_usd: 0, products_count: 0, low_stock_count: 0
  });
}

async function listProducts(env: Env, me: Me) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;

  const rows = await env.DB.prepare(
    `SELECT id, name, category, sku, cost_cop, cost_usd, price_cop, price_usd, stock, low_stock_threshold, is_active
     FROM products WHERE tenant_id = ? ORDER BY is_active DESC, name ASC`
  ).bind(tenant).all<any>();

  return json(rows.results ?? []);
}

async function createProduct(request: Request, env: Env, me: Me) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;

  const body = await readJson<any>(request);
  if (!body?.name || String(body.name).trim().length === 0) return err("Nombre requerido");

  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO products (id, tenant_id, name, category, sku, cost_cop, cost_usd, price_cop, price_usd, stock, low_stock_threshold, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, tenant,
    String(body.name).trim(),
    body.category ?? null,
    body.sku ?? null,
    body.cost_cop ?? null,
    body.cost_usd ?? null,
    body.price_cop ?? null,
    body.price_usd ?? null,
    Number.isFinite(body.stock) ? body.stock : 0,
    Number.isFinite(body.low_stock_threshold) ? body.low_stock_threshold : 2,
    body.is_active === 0 ? 0 : 1
  ).run();

  return json({ ok: true, id });
}

async function updateProduct(request: Request, env: Env, me: Me, id: string) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;

  const body = await readJson<any>(request);
  if (!body) return err("Body requerido");

  const fields = ["name","category","sku","cost_cop","cost_usd","price_cop","price_usd","stock","low_stock_threshold","is_active"] as const;
  const sets: string[] = [];
  const binds: any[] = [];
  for (const f of fields) {
    if (f in body) {
      sets.push(`${f} = ?`);
      binds.push(body[f]);
    }
  }
  if (sets.length === 0) return err("Nada para actualizar");

  binds.push(tenant, id);

  const q = `UPDATE products SET ${sets.join(", ")}, updated_at=datetime('now') WHERE tenant_id = ? AND id = ?`;
  await env.DB.prepare(q).bind(...binds).run();

  return json({ ok: true });
}

async function listPaymentMethods(env: Env, me: Me) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;

  const rows = await env.DB.prepare(
    `SELECT id, label, is_active, sort_order FROM payment_methods WHERE tenant_id = ? ORDER BY sort_order ASC, label ASC`
  ).bind(tenant).all<any>();

  return json(rows.results ?? []);
}

async function createPaymentMethod(request: Request, env: Env, me: Me) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;
  const body = await readJson<any>(request);
  if (!body?.label) return err("label requerido");
  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO payment_methods (id, tenant_id, label, is_active, sort_order) VALUES (?, ?, ?, 1, 10)`
  ).bind(id, tenant, String(body.label).trim()).run();
  return json({ ok: true, id });
}

async function updatePaymentMethod(request: Request, env: Env, me: Me, id: string) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;
  const body = await readJson<any>(request);
  if (!body) return err("Body requerido");

  await env.DB.prepare(
    `UPDATE payment_methods SET label=?, is_active=?, sort_order=? WHERE tenant_id=? AND id=?`
  ).bind(
    String(body.label ?? "").trim(),
    body.is_active === 0 ? 0 : 1,
    Number.isFinite(body.sort_order) ? body.sort_order : 0,
    tenant,
    id
  ).run();
  return json({ ok: true });
}

async function getTenant(env: Env, me: Me) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;
  const t = await env.DB.prepare(
    `SELECT id, name, business_name, phone, address, logo_url FROM tenants WHERE id=?`
  ).bind(tenant).first<any>();
  if (!t) return err("Tenant no encontrado", 404);
  return json(t);
}

async function updateTenant(request: Request, env: Env, me: Me) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;
  const body = await readJson<any>(request);
  if (!body?.name) return err("name requerido");
  await env.DB.prepare(
    `UPDATE tenants SET name=?, business_name=?, phone=?, address=?, logo_url=? WHERE id=?`
  ).bind(
    String(body.name).trim(),
    body.business_name ?? null,
    body.phone ?? null,
    body.address ?? null,
    body.logo_url ?? null,
    tenant
  ).run();
  return json({ ok: true });
}

async function listUsers(env: Env, me: Me) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;
  const rows = await env.DB.prepare(
    `SELECT id, username, role, is_active
     FROM users
     WHERE tenant_id = ?
     ORDER BY role DESC, username ASC`
  ).bind(tenant).all<any>();
  return json(rows.results ?? []);
}

async function createUser(request: Request, env: Env, me: Me) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;
  const body = await readJson<any>(request);
  if (!body?.username || !body?.password || !body?.role) return err("username/password/role requeridos");
  const role: Role = body.role;
  if (!["ADMIN","USER"].includes(role)) return err("Rol inválido");

  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = base64(saltBytes.buffer);
  const hashB64 = await pbkdf2(String(body.password), saltB64);

  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO users (id, tenant_id, username, role, password_salt, password_hash, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).bind(id, tenant, String(body.username).trim(), role, saltB64, hashB64).run();

  return json({ ok: true, id });
}

async function updateUser(request: Request, env: Env, me: Me, id: string) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;
  const body = await readJson<any>(request);
  if (!body) return err("Body requerido");
  const is_active = body.is_active === 0 ? 0 : 1;
  await env.DB.prepare(
    `UPDATE users SET is_active=? WHERE tenant_id=? AND id=?`
  ).bind(is_active, tenant, id).run();
  return json({ ok: true });
}

async function nextReceiptNumber(env: Env, tenant_id: string) {
  const upd = await env.DB.prepare(
    `UPDATE counters SET value = value + 1 WHERE tenant_id = ? AND key = 'receipt_seq' RETURNING value`
  ).bind(tenant_id).first<any>();

  let seq: number | null = upd?.value ?? null;

  if (seq == null) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO counters (tenant_id, key, value) VALUES (?, 'receipt_seq', 0)`
    ).bind(tenant_id).run();

    const upd2 = await env.DB.prepare(
      `UPDATE counters SET value = value + 1 WHERE tenant_id = ? AND key = 'receipt_seq' RETURNING value`
    ).bind(tenant_id).first<any>();

    seq = upd2?.value ?? 1;
  }

  const num = String(seq).padStart(6, "0");
  return `R-${num}`;
}

async function createSale(request: Request, env: Env, me: Me) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;

  const body = await readJson<any>(request);
  if (!body?.currency || !Array.isArray(body.items) || body.items.length === 0) return err("Datos de venta inválidos");

  const currency = body.currency as "COP" | "USD";
  if (!["COP","USD"].includes(currency)) return err("Moneda inválida");

  const items = body.items.map((x:any)=>({
    product_id: String(x.product_id),
    qty: Number(x.qty),
    unit_price: Number(x.unit_price)
  })).filter((x:any)=>x.product_id && Number.isFinite(x.qty) && x.qty>0 && Number.isFinite(x.unit_price) && x.unit_price>0);

  if (items.length === 0) return err("Items inválidos");

  const ids = items.map(i=>i.product_id);
  const placeholders = ids.map(()=>"?").join(",");
  const prodRes = await env.DB.prepare(
    `SELECT id, name, stock FROM products WHERE tenant_id=? AND id IN (${placeholders})`
  ).bind(tenant, ...ids).all<any>();

  const prods = new Map<string, any>();
  for (const p of (prodRes.results ?? [])) prods.set(p.id, p);

  if (prods.size !== ids.length) return err("Uno o más productos no existen");

  const subtotal = items.reduce((a,i)=>a + i.qty*i.unit_price, 0);
  const discount = Number.isFinite(body.discount) ? Number(body.discount) : 0;
  const total = Math.max(0, subtotal - discount);

  const receipt_number = await nextReceiptNumber(env, tenant);
  const saleId = uuid();

  await env.DB.prepare(
    `INSERT INTO sales (id, tenant_id, receipt_number, currency, payment_method_id, customer_name, customer_phone, subtotal, discount, total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    saleId, tenant, receipt_number, currency,
    body.payment_method_id ?? null,
    body.customer_name ?? null,
    body.customer_phone ?? null,
    subtotal, discount, total
  ).run();

  for (const i of items) {
    const line_total = i.qty * i.unit_price;
    await env.DB.prepare(
      `INSERT INTO sale_items (id, sale_id, product_id, qty, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(uuid(), saleId, i.product_id, i.qty, i.unit_price, line_total).run();

    await env.DB.prepare(
      `UPDATE products SET stock = stock - ?, updated_at=datetime('now') WHERE tenant_id=? AND id=?`
    ).bind(i.qty, tenant, i.product_id).run();
  }

  return json({ id: saleId, receipt_number });
}

async function listSales(request: Request, env: Env, me: Me) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

  const res = await env.DB.prepare(
    `SELECT s.id, s.receipt_number, s.created_at, s.currency, s.total, s.customer_name,
            pm.label as payment_method_label
     FROM sales s
     LEFT JOIN payment_methods pm ON pm.id = s.payment_method_id
     WHERE s.tenant_id = ?
     ORDER BY s.created_at DESC
     LIMIT ?`
  ).bind(tenant, limit).all<any>();

  return json(res.results ?? []);
}

function escapeHtml(s: any) {
  const str = String(s ?? "");
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

async function receipt(request: Request, env: Env, me: Me, saleId: string) {
  const tenant = requireTenant(me);
  if (tenant instanceof Response) return tenant;

  const sale = await env.DB.prepare(
    `SELECT s.*, pm.label as payment_method_label
     FROM sales s
     LEFT JOIN payment_methods pm ON pm.id = s.payment_method_id
     WHERE s.tenant_id=? AND s.id=?`
  ).bind(tenant, saleId).first<any>();

  if (!sale) return err("Venta no encontrada", 404);

  const t = await env.DB.prepare(
    `SELECT name, business_name, phone, address, logo_url FROM tenants WHERE id=?`
  ).bind(tenant).first<any>();

  const itemsRes = await env.DB.prepare(
    `SELECT si.qty, si.unit_price, si.line_total, p.name
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     WHERE si.sale_id = ?`
  ).bind(saleId).all<any>();

  const items = itemsRes.results ?? [];

  const fmtCop = (n:number)=> new Intl.NumberFormat("es-CO", {maximumFractionDigits:0}).format(n) + " COP";
  const fmtUsd = (n:number)=> "$" + new Intl.NumberFormat("en-US", {maximumFractionDigits:2}).format(n);
  const fmt = sale.currency === "USD" ? fmtUsd : fmtCop;

  const logo = t?.logo_url ? `<img src="${t.logo_url}" style="height:56px;object-fit:contain" />` : "";
  const rows = items.map((it:any)=>`
    <tr>
      <td>${escapeHtml(it.name)}</td>
      <td style="text-align:right">${it.qty}</td>
      <td style="text-align:right">${fmt(it.unit_price)}</td>
      <td style="text-align:right"><b>${fmt(it.line_total)}</b></td>
    </tr>
  `).join("");

  const businessLine = (t?.business_name || t?.name || "");
  const htmlStr = `<!doctype html>
  <html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Factura ${sale.receipt_number}</title>
    <style>
      body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin:20px; color:#111;}
      .wrap{max-width:720px;margin:0 auto;}
      .top{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
      .muted{color:#555;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:14px}
      th,td{padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:left;font-size:14px}
      th{font-size:12px;color:#555}
      .totals{margin-top:14px;display:grid;gap:6px}
      .totals .row{display:flex;justify-content:space-between}
      .btn{display:inline-block;padding:10px 12px;border:1px solid #ddd;border-radius:10px;text-decoration:none;color:#111}
      @media print { .noprint{display:none} body{margin:0} }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="top">
        <div>
          ${logo}
          <h2 style="margin:6px 0 2px">${escapeHtml(businessLine)}</h2>
          <div class="muted">${escapeHtml(t?.address || "")}</div>
          <div class="muted">${escapeHtml(t?.phone || "")}</div>
        </div>
        <div style="text-align:right">
          <div class="muted">Factura</div>
          <div style="font-size:18px;font-weight:800">${escapeHtml(sale.receipt_number)}</div>
          <div class="muted">${new Date(sale.created_at).toLocaleString()}</div>
          <div class="muted">Moneda: ${sale.currency}</div>
          <div class="muted">Pago: ${escapeHtml(sale.payment_method_label || "—")}</div>
        </div>
      </div>

      <div style="margin-top:10px">
        <div class="muted">Cliente: ${escapeHtml(sale.customer_name || "Consumidor final")}</div>
        <div class="muted">Teléfono: ${escapeHtml(sale.customer_phone || "—")}</div>
      </div>

      <table>
        <thead>
          <tr><th>Producto</th><th style="text-align:right">Cant</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="totals">
        <div class="row"><span class="muted">Subtotal</span><span>${fmt(sale.subtotal)}</span></div>
        <div class="row"><span class="muted">Descuento</span><span>- ${fmt(sale.discount)}</span></div>
        <div class="row" style="font-size:16px;font-weight:900"><span>Total</span><span>${fmt(sale.total)}</span></div>
      </div>

      <div class="noprint" style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end">
        <a class="btn" href="#" onclick="window.print();return false;">Imprimir</a>
        <a class="btn" href="/" onclick="window.close();return false;">Cerrar</a>
      </div>

      <div class="muted" style="margin-top:16px">Gracias por su compra.</div>
    </div>
  </body>
  </html>`;

  return html(htmlStr);
}

// SUPERADMIN minimal
async function superListTenants(env: Env) {
  const res = await env.DB.prepare(
    `SELECT id, name, created_at FROM tenants ORDER BY created_at DESC`
  ).all<any>();
  return json(res.results ?? []);
}

async function superCreateTenant(request: Request, env: Env) {
  const body = await readJson<any>(request);
  if (!body?.name) return err("name requerido");
  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO tenants (id, name, business_name) VALUES (?, ?, ?)`
  ).bind(id, String(body.name).trim(), String(body.name).trim()).run();

  await env.DB.prepare(
    `INSERT OR IGNORE INTO counters (tenant_id, key, value) VALUES (?, 'receipt_seq', 0)`
  ).bind(id).run();

  return json({ ok: true, id });
}

async function superTenantUsers(env: Env, tenantId: string) {
  const res = await env.DB.prepare(
    `SELECT id, username, role, is_active FROM users WHERE tenant_id=? ORDER BY role DESC, username ASC`
  ).bind(tenantId).all<any>();
  return json(res.results ?? []);
}

async function superCreateTenantUser(request: Request, env: Env, tenantId: string) {
  const body = await readJson<any>(request);
  if (!body?.username || !body?.password || !body?.role) return err("username/password/role requeridos");
  const role: Role = body.role;
  if (!["ADMIN","USER"].includes(role)) return err("Rol inválido");

  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = base64(saltBytes.buffer);
  const hashB64 = await pbkdf2(String(body.password), saltB64);
  const id = uuid();

  await env.DB.prepare(
    `INSERT INTO users (id, tenant_id, username, role, password_salt, password_hash, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).bind(id, tenantId, String(body.username).trim(), role, saltB64, hashB64).run();

  return json({ ok: true, id });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") return new Response("", { status: 204 });

  const { parts } = getPathParts(request);
  const [root, id, sub, sub2] = parts;

  if (request.method === "POST" && root === "login") return login(request, env);
  if (request.method === "POST" && root === "logout") return logout(request, env);
  if (request.method === "GET" && root === "me") return me(request, env);

  const meOr = await requireAuth(request, env);
  if (meOr instanceof Response) return meOr;
  const me = meOr;

  if (request.method === "GET" && root === "dashboard") return dashboard(request, env, me);

  if (root === "products") {
    if (request.method === "GET") return listProducts(env, me);
    const adminOr = await requireMinRole(request, env, "ADMIN");
    if (adminOr instanceof Response) return adminOr;
    if (request.method === "POST") return createProduct(request, env, me);
    if (request.method === "PUT" && id) return updateProduct(request, env, me, id);
    return err("Ruta inválida", 404);
  }

  if (root === "payment-methods") {
    if (request.method === "GET") return listPaymentMethods(env, me);
    const adminOr = await requireMinRole(request, env, "ADMIN");
    if (adminOr instanceof Response) return adminOr;
    if (request.method === "POST") return createPaymentMethod(request, env, me);
    if (request.method === "PUT" && id) return updatePaymentMethod(request, env, me, id);
    return err("Ruta inválida", 404);
  }

  if (root === "tenant") {
    const adminOr = await requireMinRole(request, env, "ADMIN");
    if (adminOr instanceof Response) return adminOr;
    if (request.method === "GET") return getTenant(env, me);
    if (request.method === "PUT") return updateTenant(request, env, me);
    return err("Ruta inválida", 404);
  }

  if (root === "users") {
    const adminOr = await requireMinRole(request, env, "ADMIN");
    if (adminOr instanceof Response) return adminOr;
    if (request.method === "GET") return listUsers(env, me);
    if (request.method === "POST") return createUser(request, env, me);
    if (request.method === "PUT" && id) return updateUser(request, env, me, id);
    return err("Ruta inválida", 404);
  }

  if (root === "sales") {
    if (request.method === "GET") return listSales(request, env, me);
    if (request.method === "POST") return createSale(request, env, me);
    return err("Ruta inválida", 404);
  }

  if (root === "receipt" && id && request.method === "GET") return receipt(request, env, me, id);

  if (root === "super") {
    const superOr = await requireMinRole(request, env, "SUPERADMIN");
    if (superOr instanceof Response) return superOr;

    if (id === "tenants") {
      if (request.method === "GET") return superListTenants(env);
      if (request.method === "POST") return superCreateTenant(request, env);
    }

    if (id === "tenants" && sub && sub2 === "users") {
      if (request.method === "GET") return superTenantUsers(env, sub);
      if (request.method === "POST") return superCreateTenantUser(request, env, sub);
    }

    return err("Ruta inválida", 404);
  }

  return err("Ruta no encontrada", 404);
};
