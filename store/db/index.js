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
  "ALTER TABLE admins ADD COLUMN failed_login_count INTEGER DEFAULT 0",
  "ALTER TABLE admins ADD COLUMN locked_until DATETIME",
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (e) { /* column already exists */ }
}
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_google_id ON customers(google_id) WHERE google_id IS NOT NULL');
} catch (e) { /* ignore */ }

module.exports = db;
