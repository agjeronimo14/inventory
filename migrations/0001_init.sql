PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  business_name TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('SUPERADMIN','ADMIN','USER')),
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  sku TEXT,
  cost_cop REAL,
  cost_usd REAL,
  price_cop REAL,
  price_usd REAL,
  stock INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 2,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  label TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON payment_methods(tenant_id);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  receipt_number TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('COP','USD')),
  payment_method_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  subtotal REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_created ON sales(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

CREATE TABLE IF NOT EXISTS counters (
  tenant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO tenants (id, name, business_name, phone, address, logo_url)
VALUES ('t_demo', 'demo', 'Demo Store', NULL, NULL, NULL);

INSERT OR IGNORE INTO users (id, tenant_id, username, role, password_salt, password_hash, is_active)
VALUES ('u_super', NULL, 'superadmin', 'SUPERADMIN',
        'oaGhoaGhoaGhoaGhoaGhoQ==',
        'zM+xyUGCVJNdhE76JOhp7zipXOrTVN8HEurZjec1FIo=',
        1);

INSERT OR IGNORE INTO users (id, tenant_id, username, role, password_salt, password_hash, is_active)
VALUES ('u_admin', 't_demo', 'admin', 'ADMIN',
        'srKysrKysrKysrKysrKysg==',
        'piuIvmAhwxQIG44hS5RH2qJk/4OuCddDyFGwP4TlclI=',
        1);

INSERT OR IGNORE INTO users (id, tenant_id, username, role, password_salt, password_hash, is_active)
VALUES ('u_user', 't_demo', 'user', 'USER',
        'w8PDw8PDw8PDw8PDw8PDww==',
        'TqseGPcFKUtKCHMGbE8dYp1kChIj6+o35jwhUjWjc0Q=',
        1);

INSERT OR IGNORE INTO payment_methods (id, tenant_id, label, is_active, sort_order)
VALUES
 ('pm_cash', 't_demo', 'Efectivo', 1, 1),
 ('pm_zelle', 't_demo', 'Zelle', 1, 2),
 ('pm_transfer', 't_demo', 'Transferencia', 1, 3);

INSERT OR IGNORE INTO products (id, tenant_id, name, category, sku, cost_cop, price_cop, cost_usd, price_usd, stock, low_stock_threshold, is_active)
VALUES
 ('p1', 't_demo', 'Coca-Cola 355ml', 'Bebidas', 'CC355', 2200, 3500, 0.55, 0.99, 24, 6, 1),
 ('p2', 't_demo', 'Harina PAN 1kg', 'Abarrotes', 'PAN1KG', 12000, 17000, 2.70, 3.50, 12, 3, 1),
 ('p3', 't_demo', 'Papel Toalla', 'Hogar', 'PT001', 8000, 12000, 1.80, 2.60, 8, 2, 1);

INSERT OR IGNORE INTO counters (tenant_id, key, value) VALUES ('t_demo', 'receipt_seq', 0);
