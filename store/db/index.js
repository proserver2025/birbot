const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'store.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Lightweight migrations for databases created before a column existed.
// SQLite has no "ADD COLUMN IF NOT EXISTS" in older builds, so we just
// ignore "duplicate column" errors on a fresh install.
const migrations = [
  "ALTER TABLE customers ADD COLUMN google_id TEXT",
  "ALTER TABLE customers ADD COLUMN failed_login_count INTEGER DEFAULT 0",
  "ALTER TABLE customers ADD COLUMN locked_until DATETIME",
  "ALTER TABLE customers ADD COLUMN referral_code TEXT",
  "ALTER TABLE customers ADD COLUMN affiliate_balance REAL DEFAULT 0",
  "ALTER TABLE admins ADD COLUMN failed_login_count INTEGER DEFAULT 0",
  "ALTER TABLE admins ADD COLUMN locked_until DATETIME",
  "ALTER TABLE orders ADD COLUMN subtotal REAL NOT NULL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN shipping_zone_id INTEGER",
  "ALTER TABLE orders ADD COLUMN shipping_fee REAL NOT NULL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN warranty_selected INTEGER DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN warranty_fee REAL NOT NULL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN affiliate_id INTEGER",
  "ALTER TABLE orders ADD COLUMN commission_amount REAL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN commission_status TEXT DEFAULT 'none'",
  "ALTER TABLE orders ADD COLUMN commission_eligible_at DATETIME",
  "ALTER TABLE customers ADD COLUMN bonus_balance REAL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN bonus_earned REAL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN bonus_status TEXT DEFAULT 'none'",
  "ALTER TABLE orders ADD COLUMN bonus_eligible_at DATETIME",
  "ALTER TABLE orders ADD COLUMN bonus_used REAL DEFAULT 0",
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (e) { /* column already exists */ }
}
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_google_id ON customers(google_id) WHERE google_id IS NOT NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_referral_code ON customers(referral_code) WHERE referral_code IS NOT NULL');
} catch (e) { /* ignore */ }

// Default tunables — admin can change these later from /admin/ayarlar.
const defaultSettings = {
  affiliate_commission_percent: '10',
  affiliate_hold_days: '15',
  affiliate_payout_threshold: '50',
  warranty_enabled: '1',
  warranty_price: '5',
  warranty_terms: 'Zəmanət talonu seçildikdə məhsula 12 ay əlavə təmir zəmanəti verilir. Şərtlər admin tərəfindən sonradan dəqiqləşdiriləcək.',
  bonus_cashback_percent: '5',
  bonus_hold_days: '15',
};
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(defaultSettings)) insertSetting.run(k, v);

// Seed delivery zones, ordered by distance from the Sədərək / Abşeron
// Ticarət Mərkəzi dispatch point, as given by the business owner.
const zoneCount = db.prepare('SELECT COUNT(*) c FROM shipping_zones').get().c;
if (zoneCount === 0) {
  const insertZone = db.prepare('INSERT INTO shipping_zones (name, kind, price, sort_order) VALUES (?, ?, ?, ?)');
  const cityZones = [
    ['Yeni Yasamal və Sədərəyə yaxın ərazilər', 6],
    ['Memar Əcəmi tərəfi', 7],
    ['Şəhər içi (mərkəz)', 8],
    ['Əhmədli tərəfi', 9],
    ['Günəşli, Qaraçuxur', 10],
    ['Buzovna və Bakı kəndləri', 13],
  ];
  cityZones.forEach(([name, price], i) => insertZone.run(name, 'city', price, i));
  const regionZones = [
    ['Abşeron rayonu', 5],
    ['Sumqayıt', 7],
    ['Yaxın rayonlar (Xırdalan, Saray və s.)', 7],
    ['Orta məsafəli rayonlar', 10],
    ['Uzaq rayonlar', 15],
  ];
  regionZones.forEach(([name, price], i) => insertZone.run(name, 'region', price, 100 + i));
}

module.exports = db;
