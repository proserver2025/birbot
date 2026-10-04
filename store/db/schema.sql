-- SaaS Home Store schema

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  failed_login_count INTEGER DEFAULT 0,
  locked_until DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  failed_login_count INTEGER DEFAULT 0,
  locked_until DATETIME,
  referral_code TEXT UNIQUE,
  affiliate_balance REAL DEFAULT 0,
  bonus_balance REAL DEFAULT 0,
  is_blocked INTEGER DEFAULT 0,
  admin_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Structured supplier/vendor registry — like a marketplace's seller panel
-- (Trendyol/Umico-style), so this is ready to feed into an ERP later:
-- full contact + tax/bank details, not just a free-text name.
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_id TEXT, -- VÖEN
  bank_info TEXT,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  compare_at_price REAL,
  stock INTEGER DEFAULT 0,
  category_id INTEGER,
  image_url TEXT,
  is_active INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0,
  -- Internal-only, never shown to customers: cost price and where it was
  -- bought, so margin (price - cost_price) can be tracked per product.
  cost_price REAL NOT NULL DEFAULT 0,
  supplier_name TEXT NOT NULL DEFAULT '', -- kept for display/legacy; supplier_id is the real link now
  supplier_id INTEGER,
  -- Optional Russian/English translations; `name`/`description` (above) are
  -- the required Azerbaijani source of truth and the fallback when a
  -- translation is left blank.
  name_ru TEXT,
  name_en TEXT,
  description_ru TEXT,
  description_en TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  status TEXT DEFAULT 'yeni',
  subtotal REAL NOT NULL DEFAULT 0,
  shipping_zone_id INTEGER,
  shipping_fee REAL NOT NULL DEFAULT 0,
  warranty_selected INTEGER DEFAULT 0,
  warranty_fee REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  affiliate_id INTEGER,
  commission_amount REAL DEFAULT 0,
  commission_status TEXT DEFAULT 'none',
  commission_eligible_at DATETIME,
  bonus_earned REAL DEFAULT 0,
  bonus_status TEXT DEFAULT 'none',
  bonus_eligible_at DATETIME,
  bonus_used REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (affiliate_id) REFERENCES customers(id),
  FOREIGN KEY (shipping_zone_id) REFERENCES shipping_zones(id)
);

-- Delivery zones, priced by distance from the Abşeron Ticarət Mərkəzi /
-- Sədərək dispatch point. Flat fee per order (not per item) — multiple
-- products in one order are consolidated into as few boxes as possible.
CREATE TABLE IF NOT EXISTS shipping_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'city', -- 'city' (Bakı daxili) | 'region' (rayonlar)
  price REAL NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

-- Affiliate/referral commission ledger — one row per order that came
-- through a referral link, so the 15-day return-window hold and the 50 AZN
-- payout threshold can be computed without touching orders directly.
CREATE TABLE IF NOT EXISTS payout_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'gozleyir', -- gozleyir | odenildi | legv_edildi
  note TEXT,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  FOREIGN KEY (affiliate_id) REFERENCES customers(id)
);

-- Site-wide tunables an admin can change without touching code: affiliate
-- commission %, payout threshold, return-window length, warranty add-on.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  unit_price REAL NOT NULL,
  qty INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Couriers (kuryerlər) an admin assigns to an order for delivery.
CREATE TABLE IF NOT EXISTS couriers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Delivery timeline per order (hazırlanır → kuryerə verildi → yolda →
-- çatdırıldı), logged by admin so the customer can see where their order is.
CREATE TABLE IF NOT EXISTS order_tracking_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- WhatsApp-style per-order chat between customer and the store, so a
-- customer can share a GPS pin that the admin then passes on to the
-- courier, instead of having to call or guess an address.
CREATE TABLE IF NOT EXISTS order_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  sender_type TEXT NOT NULL, -- 'customer' | 'admin'
  message TEXT,
  lat REAL,
  lng REAL,
  is_read_by_admin INTEGER DEFAULT 0,
  is_read_by_customer INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_order ON order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_order ON order_tracking_events(order_id);
