const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const slugify = require('slugify');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', 'public', 'uploads'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// --- Admin auth ---
router.get('/login', (req, res) => res.render('admin/login', { title: 'Admin Giriş', error: null, layout: false }));

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.render('admin/login', { title: 'Admin Giriş', error: 'İstifadəçi adı və ya parol yanlışdır.', layout: false });
  }
  req.session.adminId = admin.id;
  res.redirect('/admin');
});

router.post('/logout', (req, res) => {
  req.session.adminId = null;
  res.redirect('/admin/login');
});

router.use(requireAdmin);

// --- Dashboard ---
router.get('/', (req, res) => {
  const stats = {
    products: db.prepare('SELECT COUNT(*) c FROM products').get().c,
    orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
    customers: db.prepare('SELECT COUNT(*) c FROM customers').get().c,
    revenue: db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status != 'ləğv edildi'").get().s,
  };
  const recentOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 10').all();
  res.render('admin/dashboard', { title: 'Admin Panel', stats, recentOrders, layout: 'admin/layout' });
});

// --- Products ---
router.get('/mehsullar', (req, res) => {
  const products = db
    .prepare(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.created_at DESC`
    )
    .all();
  res.render('admin/products', { title: 'Məhsullar', products, layout: 'admin/layout' });
});

router.get('/mehsullar/yeni', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.render('admin/product-form', { title: 'Yeni məhsul', product: null, categories, layout: 'admin/layout' });
});

router.post('/mehsullar/yeni', upload.single('image'), (req, res) => {
  const { name, description, price, compare_at_price, stock, category_id, is_active, is_featured } = req.body;
  const slug = slugify(name, { lower: true, strict: true }) + '-' + Math.floor(Math.random() * 10000);
  const image_url = req.file ? '/uploads/' + req.file.filename : null;
  db.prepare(
    `INSERT INTO products (name, slug, description, price, compare_at_price, stock, category_id, image_url, is_active, is_featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name,
    slug,
    description || '',
    parseFloat(price),
    compare_at_price ? parseFloat(compare_at_price) : null,
    parseInt(stock, 10) || 0,
    category_id || null,
    image_url,
    is_active ? 1 : 0,
    is_featured ? 1 : 0
  );
  res.redirect('/admin/mehsullar');
});

router.get('/mehsullar/:id/redakte', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.redirect('/admin/mehsullar');
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.render('admin/product-form', { title: 'Məhsulu redaktə et', product, categories, layout: 'admin/layout' });
});

router.post('/mehsullar/:id/redakte', upload.single('image'), (req, res) => {
  const { name, description, price, compare_at_price, stock, category_id, is_active, is_featured } = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.redirect('/admin/mehsullar');
  const image_url = req.file ? '/uploads/' + req.file.filename : existing.image_url;
  db.prepare(
    `UPDATE products SET name=?, description=?, price=?, compare_at_price=?, stock=?, category_id=?, image_url=?, is_active=?, is_featured=?
     WHERE id=?`
  ).run(
    name,
    description || '',
    parseFloat(price),
    compare_at_price ? parseFloat(compare_at_price) : null,
    parseInt(stock, 10) || 0,
    category_id || null,
    image_url,
    is_active ? 1 : 0,
    is_featured ? 1 : 0,
    req.params.id
  );
  res.redirect('/admin/mehsullar');
});

router.post('/mehsullar/:id/sil', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.redirect('/admin/mehsullar');
});

// --- Categories ---
router.get('/kateqoriyalar', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.render('admin/categories', { title: 'Kateqoriyalar', categories, layout: 'admin/layout' });
});

router.post('/kateqoriyalar/yeni', (req, res) => {
  const { name } = req.body;
  const slug = slugify(name, { lower: true, strict: true });
  db.prepare('INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)').run(name, slug);
  res.redirect('/admin/kateqoriyalar');
});

router.post('/kateqoriyalar/:id/sil', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.redirect('/admin/kateqoriyalar');
});

// --- Orders ---
router.get('/sifarisler', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.render('admin/orders', { title: 'Sifarişlər', orders, layout: 'admin/layout' });
});

router.get('/sifarisler/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.redirect('/admin/sifarisler');
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.render('admin/order-detail', { title: `Sifariş #${order.id}`, order, items, layout: 'admin/layout' });
});

router.post('/sifarisler/:id/status', (req, res) => {
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
  res.redirect('/admin/sifarisler/' + req.params.id);
});

// --- Customers ---
router.get('/musteriler', (req, res) => {
  const customers = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
  res.render('admin/customers', { title: 'Müştərilər', customers, layout: 'admin/layout' });
});

module.exports = router;
