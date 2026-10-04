require('dotenv').config();
const bcrypt = require('bcryptjs');
const slugify = require('slugify');
const db = require('./index');

function upsertAdmin() {
  const username = process.env.ADMIN_DEFAULT_USERNAME || 'admin';
  const password = process.env.ADMIN_DEFAULT_PASSWORD || 'change_this_password';
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (existing) {
    console.log(`Admin "${username}" artıq mövcuddur, toxunulmadı.`);
    return;
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log(`Admin yaradıldı: ${username} / ${password} (ilk girişdən sonra parolu dəyiş!)`);
}

function seedCategories() {
  const cats = ['Mətbəx əşyaları', 'Elektrik məişət texnikası', 'Gözəllik və qulluq', 'Ev və bağ'];
  const insert = db.prepare('INSERT OR IGNORE INTO categories (name, slug, sort_order) VALUES (?, ?, ?)');
  cats.forEach((name, i) => insert.run(name, slugify(name, { lower: true, strict: true }), i));
  console.log('Kateqoriyalar əlavə olundu.');
}

function seedProducts() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (count > 0) {
    console.log('Məhsullar artıq var, seed keçildi.');
    return;
  }
  const cat = db.prepare('SELECT id FROM categories LIMIT 1').get();
  const sample = [
    { name: 'Elektrik samovar 5L', price: 112.9, compare: 140, stock: 25, cost: 78, supplier: 'Abşeron Ticarət Mərkəzi - nümunə topdançı' },
    { name: 'Saç və saqqal trimmeri', price: 35.9, compare: 192.25, stock: 40, cost: 22, supplier: 'Abşeron Ticarət Mərkəzi - nümunə topdançı' },
    { name: 'Elektrik soba 48L', price: 193.4, compare: 408, stock: 10, cost: 140, supplier: 'Abşeron Ticarət Mərkəzi - nümunə topdançı' },
  ];
  const insert = db.prepare(
    `INSERT INTO products (name, slug, description, price, compare_at_price, stock, category_id, cost_price, supplier_name, is_active, is_featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`
  );
  sample.forEach((p) => {
    insert.run(
      p.name,
      slugify(p.name, { lower: true, strict: true }) + '-' + Math.floor(Math.random() * 10000),
      'Nümunə məhsul təsviri. Admin paneldən redaktə edə bilərsiniz.',
      p.price,
      p.compare,
      p.stock,
      cat ? cat.id : null,
      p.cost,
      p.supplier
    );
  });
  console.log('Nümunə məhsullar əlavə olundu.');
}

upsertAdmin();
seedCategories();
seedProducts();
console.log('Seed tamamlandı.');
