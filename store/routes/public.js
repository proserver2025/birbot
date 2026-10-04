const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const brand = require('../config/brand');
const { requireCustomer } = require('../middleware/auth');

const router = express.Router();

router.use((req, res, next) => {
  res.locals.brand = brand;
  res.locals.customer = req.session.customerId
    ? db.prepare('SELECT id, full_name, email FROM customers WHERE id = ?').get(req.session.customerId)
    : null;
  res.locals.cartCount = (req.session.cart || []).reduce((sum, i) => sum + i.qty, 0);
  next();
});

// Home
router.get('/', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  const featured = db
    .prepare('SELECT * FROM products WHERE is_active = 1 AND is_featured = 1 ORDER BY created_at DESC LIMIT 8')
    .all();
  const latest = db
    .prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC LIMIT 12')
    .all();
  res.render('home', { categories, featured, latest, title: 'Ana səhifə' });
});

// Category listing
router.get('/kateqoriya/:slug', (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE slug = ?').get(req.params.slug);
  if (!category) return res.status(404).render('404', { title: 'Tapılmadı' });
  const products = db
    .prepare('SELECT * FROM products WHERE category_id = ? AND is_active = 1 ORDER BY created_at DESC')
    .all(category.id);
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.render('category', { category, products, categories, title: category.name });
});

// All products / search
router.get('/mehsullar', (req, res) => {
  const q = (req.query.q || '').trim();
  let products;
  if (q) {
    products = db
      .prepare('SELECT * FROM products WHERE is_active = 1 AND name LIKE ? ORDER BY created_at DESC')
      .all(`%${q}%`);
  } else {
    products = db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC').all();
  }
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.render('products', { products, categories, q, title: 'Məhsullar' });
});

// Product detail
router.get('/mehsul/:slug', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE slug = ?').get(req.params.slug);
  if (!product) return res.status(404).render('404', { title: 'Tapılmadı' });
  const related = db
    .prepare('SELECT * FROM products WHERE category_id = ? AND id != ? AND is_active = 1 LIMIT 4')
    .all(product.category_id, product.id);
  res.render('product', { product, related, title: product.name });
});

// --- Cart (session-based) ---
router.post('/sebet/elave/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.redirect('/mehsullar');
  const qty = Math.max(1, parseInt(req.body.qty, 10) || 1);
  req.session.cart = req.session.cart || [];
  const existing = req.session.cart.find((i) => i.id === product.id);
  if (existing) {
    existing.qty += qty;
  } else {
    req.session.cart.push({ id: product.id, name: product.name, price: product.price, qty });
  }
  res.redirect('/sebet');
});

router.post('/sebet/sil/:id', (req, res) => {
  req.session.cart = (req.session.cart || []).filter((i) => i.id !== parseInt(req.params.id, 10));
  res.redirect('/sebet');
});

router.get('/sebet', (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  res.render('cart', { cart, total, title: 'Səbətim' });
});

router.post('/sifaris', (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/sebet');
  const { name, phone, address } = req.body;
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const insertOrder = db.prepare(
    `INSERT INTO orders (customer_id, customer_name, customer_phone, customer_address, total)
     VALUES (?, ?, ?, ?, ?)`
  );
  const result = insertOrder.run(req.session.customerId || null, name, phone, address, total);
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, product_id, product_name, unit_price, qty) VALUES (?, ?, ?, ?, ?)`
  );
  const decStock = db.prepare('UPDATE products SET stock = MAX(stock - ?, 0) WHERE id = ?');
  cart.forEach((item) => {
    insertItem.run(result.lastInsertRowid, item.id, item.name, item.price, item.qty);
    decStock.run(item.qty, item.id);
  });
  req.session.cart = [];
  res.render('sifaris-tamamlandi', { orderId: result.lastInsertRowid, total, title: 'Sifariş qəbul olundu' });
});

// --- Customer auth ---
router.get('/qeydiyyat', (req, res) => res.render('register', { title: 'Qeydiyyat', error: null }));

router.post('/qeydiyyat', (req, res) => {
  const { full_name, email, phone, password } = req.body;
  if (!full_name || !email || !password) {
    return res.render('register', { title: 'Qeydiyyat', error: 'Bütün vacib sahələri doldurun.' });
  }
  const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
  if (existing) {
    return res.render('register', { title: 'Qeydiyyat', error: 'Bu email ilə artıq hesab var.' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO customers (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)')
    .run(full_name, email, phone || null, hash);
  req.session.customerId = result.lastInsertRowid;
  res.redirect('/hesabim');
});

router.get('/giris', (req, res) => res.render('login', { title: 'Giriş', error: null, redirect: req.query.redirect || '/' }));
router.get('/login', (req, res) => res.redirect('/giris' + (req.query.redirect ? `?redirect=${encodeURIComponent(req.query.redirect)}` : '')));

router.post('/giris', (req, res) => {
  const { email, password } = req.body;
  const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(email);
  if (!customer || !bcrypt.compareSync(password, customer.password_hash)) {
    return res.render('login', { title: 'Giriş', error: 'Email və ya parol yanlışdır.', redirect: req.body.redirect || '/' });
  }
  req.session.customerId = customer.id;
  res.redirect(req.body.redirect || '/hesabim');
});

router.post('/cixis', (req, res) => {
  req.session.customerId = null;
  res.redirect('/');
});

router.get('/hesabim', requireCustomer, (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC')
    .all(req.session.customerId);
  res.render('account', { orders, title: 'Hesabım' });
});

module.exports = router;
