const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dns = require('dns').promises;
const net = require('net');
const slugify = require('slugify');
const cheerio = require('cheerio');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const csrfMiddleware = require('../middleware/csrf');
const settings = require('../config/settings');
const affiliates = require('../lib/affiliates');
const bonus = require('../lib/bonus');
const { requireAdmin } = require('../middleware/auth');
const { isLocked, registerFailure, resetFailures, LOCK_MINUTES } = require('../middleware/loginGuard');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
    cb(ok ? null : new Error('Yalnız şəkil faylları (jpg, png, webp, gif) qəbul olunur'), ok);
  },
});

const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false });

// --- Admin auth ---
router.get('/login', (req, res) => res.render('admin/login', { title: 'Admin Giriş', error: null, layout: false }));

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  const fail = (msg) => res.render('admin/login', { title: 'Admin Giriş', error: msg, layout: false });

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin) return fail('İstifadəçi adı və ya parol yanlışdır.');
  if (isLocked(admin)) return fail(`Çox sayda yanlış cəhd. ${LOCK_MINUTES} dəqiqə sonra yenidən sınayın.`);
  if (!bcrypt.compareSync(password, admin.password_hash)) {
    registerFailure(db, 'admins', admin.id, admin.failed_login_count);
    return fail('İstifadəçi adı və ya parol yanlışdır.');
  }
  resetFailures(db, 'admins', admin.id);
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
  affiliates.settleEligibleCommissions();
  bonus.settleEligibleBonus();
  const stats = {
    products: db.prepare('SELECT COUNT(*) c FROM products').get().c,
    orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
    customers: db.prepare('SELECT COUNT(*) c FROM customers').get().c,
    // Taxable sale amount — shipping and warranty are the customer's own
    // cost, collected on top, and excluded from this figure on purpose.
    revenue: db.prepare("SELECT COALESCE(SUM(subtotal),0) s FROM orders WHERE status != 'legv_edildi'").get().s,
    shippingCollected: db.prepare("SELECT COALESCE(SUM(shipping_fee),0) s FROM orders WHERE status != 'legv_edildi'").get().s,
    warrantyCollected: db.prepare("SELECT COALESCE(SUM(warranty_fee),0) s FROM orders WHERE status != 'legv_edildi'").get().s,
    pendingPayouts: db.prepare("SELECT COUNT(*) c FROM payout_requests WHERE status = 'gozleyir'").get().c,
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
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY company_name').all();
  res.render('admin/product-form', { title: 'Yeni məhsul', product: null, categories, suppliers, error: null, layout: 'admin/layout' });
});

// Resolves the form's supplier_id / new_supplier_name combo into a real
// supplier_id, creating the supplier on the fly when a brand-new name was
// typed — so admins never have to leave the product form for a first entry.
function resolveSupplierId(body) {
  if (body.supplier_id) return parseInt(body.supplier_id, 10);
  const name = (body.new_supplier_name || '').trim();
  if (!name) return null;
  const existing = db.prepare('SELECT id FROM suppliers WHERE company_name = ?').get(name);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO suppliers (company_name) VALUES (?)').run(name).lastInsertRowid;
}

router.post('/mehsullar/yeni', upload.single('image'), csrfMiddleware.afterUpload, (req, res) => {
  const { name, description, name_ru, name_en, description_ru, description_en, price, compare_at_price, stock, category_id, is_active, is_featured, imported_image_url, cost_price } = req.body;
  const supplierId = resolveSupplierId(req.body);

  // Internal-only fields, but mandatory: every product must record what
  // it actually cost and who it was bought from.
  if (!cost_price || parseFloat(cost_price) <= 0 || !supplierId) {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY company_name').all();
    return res.status(400).render('admin/product-form', {
      title: 'Yeni məhsul',
      product: { ...req.body, price: parseFloat(price) || 0 },
      categories,
      suppliers,
      error: 'Maya dəyəri və təchizatçı mütləqdir.',
      layout: 'admin/layout',
    });
  }
  const supplierName = db.prepare('SELECT company_name FROM suppliers WHERE id = ?').get(supplierId).company_name;

  const slug = slugify(name, { lower: true, strict: true }) + '-' + Math.floor(Math.random() * 10000);
  const image_url = req.file ? '/uploads/' + req.file.filename : (imported_image_url || null);
  db.prepare(
    `INSERT INTO products (name, slug, description, price, compare_at_price, stock, category_id, image_url, is_active, is_featured, cost_price, supplier_name, supplier_id, name_ru, name_en, description_ru, description_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    is_featured ? 1 : 0,
    parseFloat(cost_price),
    supplierName,
    supplierId,
    (name_ru || '').trim() || null,
    (name_en || '').trim() || null,
    (description_ru || '').trim() || null,
    (description_en || '').trim() || null
  );
  res.redirect('/admin/mehsullar');
});

router.get('/mehsullar/:id/redakte', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.redirect('/admin/mehsullar');
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY company_name').all();
  res.render('admin/product-form', { title: 'Məhsulu redaktə et', product, categories, suppliers, error: null, layout: 'admin/layout' });
});

router.post('/mehsullar/:id/redakte', upload.single('image'), csrfMiddleware.afterUpload, (req, res) => {
  const { name, description, name_ru, name_en, description_ru, description_en, price, compare_at_price, stock, category_id, is_active, is_featured, imported_image_url, cost_price } = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.redirect('/admin/mehsullar');
  const supplierId = resolveSupplierId(req.body);

  if (!cost_price || parseFloat(cost_price) <= 0 || !supplierId) {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY company_name').all();
    return res.status(400).render('admin/product-form', {
      title: 'Məhsulu redaktə et',
      product: { ...existing, ...req.body },
      categories,
      suppliers,
      error: 'Maya dəyəri və təchizatçı mütləqdir.',
      layout: 'admin/layout',
    });
  }
  const supplierName = db.prepare('SELECT company_name FROM suppliers WHERE id = ?').get(supplierId).company_name;

  const image_url = req.file ? '/uploads/' + req.file.filename : (imported_image_url || existing.image_url);
  db.prepare(
    `UPDATE products SET name=?, description=?, price=?, compare_at_price=?, stock=?, category_id=?, image_url=?, is_active=?, is_featured=?, cost_price=?, supplier_name=?, supplier_id=?, name_ru=?, name_en=?, description_ru=?, description_en=?
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
    parseFloat(cost_price),
    supplierName,
    supplierId,
    (name_ru || '').trim() || null,
    (name_en || '').trim() || null,
    (description_ru || '').trim() || null,
    (description_en || '').trim() || null,
    req.params.id
  );
  res.redirect('/admin/mehsullar');
});

router.post('/mehsullar/:id/sil', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.redirect('/admin/mehsullar');
});

// --- Məhsul idxalı (URL-dən) ---
// SSRF guard: only http/https, and the resolved IP must not be private/
// loopback/link-local, so an admin can't be tricked into making the
// server fetch internal infrastructure.
async function assertSafeUrl(rawUrl) {
  const u = new URL(rawUrl);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Yalnız http/https linkləri dəstəklənir');
  const { address, family } = await dns.lookup(u.hostname);
  if (net.isIP(address) === 0) throw new Error('Host ünvanı həll olunmadı');
  const isPrivateV4 =
    family === 4 &&
    (/^10\./.test(address) || /^192\.168\./.test(address) || /^127\./.test(address) ||
     /^169\.254\./.test(address) || /^172\.(1[6-9]|2\d|3[01])\./.test(address) || address === '0.0.0.0');
  const isPrivateV6 = family === 6 && (address === '::1' || /^fc|^fd|^fe80/i.test(address));
  if (isPrivateV4 || isPrivateV6) throw new Error('Daxili şəbəkə ünvanlarına sorğu qadağandır');
  return u;
}

function extractProductData(html, baseUrl) {
  const $ = cheerio.load(html);
  const meta = (name) => $(`meta[property="${name}"]`).attr('content') || $(`meta[name="${name}"]`).attr('content');

  let name = meta('og:title') || $('title').first().text() || '';
  name = name.trim().slice(0, 200);

  let description = meta('og:description') || meta('description') || '';
  description = description.trim().slice(0, 1000);

  let image = meta('og:image');
  if (image) {
    try { image = new URL(image, baseUrl).href; } catch (e) { image = null; }
  }

  let price = null;
  let comparePrice = null;

  // Try schema.org JSON-LD first — most e-commerce sites include it.
  $('script[type="application/ld+json"]').each((i, el) => {
    if (price) return;
    try {
      let data = JSON.parse($(el).contents().text());
      if (Array.isArray(data)) data = data.find((d) => d && (d['@type'] === 'Product' || d.offers)) || data[0];
      const offers = data && (data.offers || (data['@graph'] && data['@graph'].find((g) => g.offers)?.offers));
      const offer = Array.isArray(offers) ? offers[0] : offers;
      if (offer && offer.price) price = parseFloat(offer.price);
      if (data && data.name && !name) name = String(data.name).slice(0, 200);
    } catch (e) { /* not valid JSON-LD, ignore */ }
  });

  // Fallback: look for a ₼ price pattern in the raw text.
  if (!price) {
    const text = $('body').text();
    const match = text.match(/(\d{1,6}(?:[.,]\d{1,2})?)\s*₼/);
    if (match) price = parseFloat(match[1].replace(',', '.'));
    const allMatches = [...text.matchAll(/(\d{1,6}(?:[.,]\d{1,2})?)\s*₼/g)].map((m) => parseFloat(m[1].replace(',', '.')));
    if (allMatches.length >= 2) {
      const sorted = [...allMatches].sort((a, b) => b - a);
      comparePrice = sorted[0];
      price = sorted[sorted.length - 1];
      if (comparePrice === price) comparePrice = null;
    }
  }

  return { name, description, price, comparePrice, image };
}

router.post('/mehsullar/idxal', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL tələb olunur' });
    const safeUrl = await assertSafeUrl(url);

    const pageRes = await fetch(safeUrl.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SaasHomeImport/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!pageRes.ok) return res.status(400).json({ error: `Səhifə açılmadı (HTTP ${pageRes.status})` });
    const html = await pageRes.text();

    const data = extractProductData(html, safeUrl.href);
    let savedImageUrl = null;

    if (data.image) {
      try {
        const safeImgUrl = await assertSafeUrl(data.image);
        const imgRes = await fetch(safeImgUrl.href, { signal: AbortSignal.timeout(15000) });
        const contentType = imgRes.headers.get('content-type') || '';
        if (imgRes.ok && /^image\//.test(contentType)) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          if (buf.length <= 8 * 1024 * 1024) {
            const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : contentType.includes('gif') ? '.gif' : '.jpg';
            const filename = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
            fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
            savedImageUrl = '/uploads/' + filename;
          }
        }
      } catch (e) { /* image import failed — not fatal, carry on without it */ }
    }

    res.json({
      name: data.name,
      description: data.description,
      price: data.price,
      compare_at_price: data.comparePrice,
      image_url: savedImageUrl,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'İdxal alınmadı' });
  }
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
  const order = db
    .prepare(
      `SELECT o.*, z.name AS zone_name, c.full_name AS courier_name FROM orders o
       LEFT JOIN shipping_zones z ON z.id = o.shipping_zone_id
       LEFT JOIN couriers c ON c.id = o.courier_id
       WHERE o.id = ?`
    )
    .get(req.params.id);
  if (!order) return res.redirect('/admin/sifarisler');
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const couriers = db.prepare('SELECT * FROM couriers WHERE is_active = 1 ORDER BY full_name').all();
  const trackingEvents = db.prepare('SELECT * FROM order_tracking_events WHERE order_id = ? ORDER BY id DESC').all(order.id);
  const messages = db.prepare('SELECT * FROM order_messages WHERE order_id = ? ORDER BY id ASC').all(order.id);
  db.prepare("UPDATE order_messages SET is_read_by_admin = 1 WHERE order_id = ? AND sender_type = 'customer'").run(order.id);
  res.render('admin/order-detail', {
    title: `Sifariş #${order.id}`,
    order,
    items,
    couriers,
    trackingEvents,
    messages,
    layout: 'admin/layout',
  });
});

router.post('/sifarisler/:id/status', (req, res) => {
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
  res.redirect('/admin/sifarisler/' + req.params.id);
});

router.post('/sifarisler/:id/kuryer', (req, res) => {
  const courierId = req.body.courier_id ? parseInt(req.body.courier_id, 10) : null;
  db.prepare('UPDATE orders SET courier_id = ? WHERE id = ?').run(courierId, req.params.id);
  res.redirect('/admin/sifarisler/' + req.params.id);
});

router.post('/sifarisler/:id/izleme', (req, res) => {
  const { status, note } = req.body;
  if (status) {
    db.prepare('INSERT INTO order_tracking_events (order_id, status, note) VALUES (?, ?, ?)').run(req.params.id, status, note || null);
  }
  res.redirect('/admin/sifarisler/' + req.params.id);
});

// --- Sifariş çatı (müştəri ⇄ mağaza, "hevale et" — konum paylaşımı daxil) ---
router.get('/sifarisler/:id/mesajlar', (req, res) => {
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  db.prepare('UPDATE order_messages SET is_read_by_admin = 1 WHERE order_id = ? AND sender_type = ?').run(order.id, 'customer');
  const afterId = parseInt(req.query.after || '0', 10) || 0;
  const messages = db
    .prepare('SELECT * FROM order_messages WHERE order_id = ? AND id > ? ORDER BY id ASC')
    .all(order.id, afterId);
  res.json({ messages });
});

router.post('/sifarisler/:id/mesaj', (req, res) => {
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  const message = (req.body.message || '').toString().trim().slice(0, 2000);
  const lat = req.body.lat !== undefined && req.body.lat !== null ? parseFloat(req.body.lat) : null;
  const lng = req.body.lng !== undefined && req.body.lng !== null ? parseFloat(req.body.lng) : null;
  if (!message && (lat === null || lng === null)) return res.status(400).json({ error: 'empty' });
  const result = db
    .prepare('INSERT INTO order_messages (order_id, sender_type, message, lat, lng, is_read_by_customer) VALUES (?, ?, ?, ?, ?, 0)')
    .run(order.id, 'admin', message || null, isNaN(lat) ? null : lat, isNaN(lng) ? null : lng);
  const saved = db.prepare('SELECT * FROM order_messages WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: saved });
});

// --- Kuryerlər ---
router.get('/kuryerler', (req, res) => {
  const couriers = db
    .prepare(
      `SELECT c.*, COUNT(o.id) AS active_order_count FROM couriers c
       LEFT JOIN orders o ON o.courier_id = c.id AND o.status NOT IN ('tamamlandi', 'legv_edildi')
       GROUP BY c.id ORDER BY c.full_name`
    )
    .all();
  res.render('admin/couriers', { title: 'Kuryerlər', couriers, layout: 'admin/layout' });
});

router.post('/kuryerler/yeni', (req, res) => {
  const { full_name, phone } = req.body;
  if (full_name && full_name.trim()) {
    db.prepare('INSERT INTO couriers (full_name, phone) VALUES (?, ?)').run(full_name.trim(), phone || null);
  }
  res.redirect('/admin/kuryerler');
});

router.post('/kuryerler/:id/redakte', (req, res) => {
  const { full_name, phone, is_active } = req.body;
  db.prepare('UPDATE couriers SET full_name = ?, phone = ?, is_active = ? WHERE id = ?').run(
    full_name.trim(),
    phone || null,
    is_active ? 1 : 0,
    req.params.id
  );
  res.redirect('/admin/kuryerler');
});

router.post('/kuryerler/:id/sil', (req, res) => {
  const inUse = db.prepare("SELECT COUNT(*) c FROM orders WHERE courier_id = ?").get(req.params.id).c;
  if (inUse > 0) return res.redirect('/admin/kuryerler'); // refuse — sifarişlər hələ ona bağlıdır
  db.prepare('DELETE FROM couriers WHERE id = ?').run(req.params.id);
  res.redirect('/admin/kuryerler');
});

// --- Kuryer izləmə paneli — bütün aktiv sifarişlər, kuryer və son status ---
router.get('/kuryer-izleme', (req, res) => {
  const orders = db
    .prepare(
      `SELECT o.*, c.full_name AS courier_name, c.phone AS courier_phone,
         (SELECT status FROM order_tracking_events WHERE order_id = o.id ORDER BY id DESC LIMIT 1) AS last_tracking_status,
         (SELECT created_at FROM order_tracking_events WHERE order_id = o.id ORDER BY id DESC LIMIT 1) AS last_tracking_at,
         (SELECT COUNT(*) FROM order_messages WHERE order_id = o.id AND sender_type = 'customer' AND is_read_by_admin = 0) AS unread_count
       FROM orders o
       LEFT JOIN couriers c ON c.id = o.courier_id
       WHERE o.status NOT IN ('legv_edildi')
       ORDER BY (o.status = 'tamamlandi') ASC, o.created_at DESC`
    )
    .all();
  const couriers = db.prepare('SELECT * FROM couriers WHERE is_active = 1 ORDER BY full_name').all();
  res.render('admin/courier-tracking', { title: 'Kuryer izləmə', orders, couriers, layout: 'admin/layout' });
});

// --- Customers (sifariş verənlər — full 360° profile) ---
router.get('/musteriler', (req, res) => {
  const customers = db
    .prepare(
      `SELECT c.*, COUNT(o.id) AS order_count, COALESCE(SUM(o.total),0) AS lifetime_spend
       FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
       GROUP BY c.id ORDER BY c.created_at DESC`
    )
    .all();
  res.render('admin/customers', { title: 'Müştərilər', customers, layout: 'admin/layout' });
});

router.get('/musteriler/:id', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.redirect('/admin/musteriler');
  const orders = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC').all(customer.id);
  const lifetimeSpend = orders.reduce((s, o) => s + (o.status !== 'legv_edildi' ? o.total : 0), 0);
  const addresses = [...new Set(orders.map((o) => o.customer_address).filter(Boolean))];
  const asAffiliate = customer.referral_code
    ? db
        .prepare(
          `SELECT COUNT(*) order_count, COALESCE(SUM(commission_amount),0) total_commission
           FROM orders WHERE affiliate_id = ?`
        )
        .get(customer.id)
    : null;
  res.render('admin/customer-detail', { title: customer.full_name, customer, orders, lifetimeSpend, addresses, asAffiliate, layout: 'admin/layout' });
});

router.post('/musteriler/:id/blok', (req, res) => {
  db.prepare('UPDATE customers SET is_blocked = 1 WHERE id = ?').run(req.params.id);
  res.redirect('/admin/musteriler/' + req.params.id);
});

router.post('/musteriler/:id/blok-qaldir', (req, res) => {
  db.prepare('UPDATE customers SET is_blocked = 0 WHERE id = ?').run(req.params.id);
  res.redirect('/admin/musteriler/' + req.params.id);
});

router.post('/musteriler/:id/qeyd', (req, res) => {
  db.prepare('UPDATE customers SET admin_notes = ? WHERE id = ?').run(req.body.admin_notes || '', req.params.id);
  res.redirect('/admin/musteriler/' + req.params.id);
});

// --- Təchizatçılar / Satıcılar (suppliers — structured, ERP-ready) ---
router.get('/saticilar', (req, res) => {
  const suppliers = db
    .prepare(
      `SELECT s.*, COUNT(p.id) AS product_count FROM suppliers s
       LEFT JOIN products p ON p.supplier_id = s.id
       GROUP BY s.id ORDER BY s.company_name`
    )
    .all();
  res.render('admin/suppliers', { title: 'Təchizatçılar', suppliers, layout: 'admin/layout' });
});

router.get('/saticilar/yeni', (req, res) => {
  res.render('admin/supplier-form', { title: 'Yeni təchizatçı', supplier: null, layout: 'admin/layout' });
});

router.post('/saticilar/yeni', (req, res) => {
  const { company_name, contact_person, phone, email, address, tax_id, bank_info, notes } = req.body;
  if (!company_name || !company_name.trim()) return res.redirect('/admin/saticilar/yeni');
  db.prepare(
    `INSERT INTO suppliers (company_name, contact_person, phone, email, address, tax_id, bank_info, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(company_name.trim(), contact_person || null, phone || null, email || null, address || null, tax_id || null, bank_info || null, notes || null);
  res.redirect('/admin/saticilar');
});

router.get('/saticilar/:id/redakte', (req, res) => {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.redirect('/admin/saticilar');
  const products = db.prepare('SELECT id, name, price, stock FROM products WHERE supplier_id = ?').all(supplier.id);
  res.render('admin/supplier-form', { title: 'Təchizatçını redaktə et', supplier, products, layout: 'admin/layout' });
});

router.post('/saticilar/:id/redakte', (req, res) => {
  const { company_name, contact_person, phone, email, address, tax_id, bank_info, notes, is_active } = req.body;
  db.prepare(
    `UPDATE suppliers SET company_name=?, contact_person=?, phone=?, email=?, address=?, tax_id=?, bank_info=?, notes=?, is_active=? WHERE id=?`
  ).run(
    company_name.trim(),
    contact_person || null,
    phone || null,
    email || null,
    address || null,
    tax_id || null,
    bank_info || null,
    notes || null,
    is_active ? 1 : 0,
    req.params.id
  );
  // Keep the legacy display column in sync on every product using this supplier.
  db.prepare('UPDATE products SET supplier_name = ? WHERE supplier_id = ?').run(company_name.trim(), req.params.id);
  res.redirect('/admin/saticilar');
});

router.post('/saticilar/:id/sil', (req, res) => {
  const inUse = db.prepare('SELECT COUNT(*) c FROM products WHERE supplier_id = ?').get(req.params.id).c;
  if (inUse > 0) return res.redirect('/admin/saticilar'); // refuse — products still reference it
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.redirect('/admin/saticilar');
});

// --- Çatdırılma zonaları ---
router.get('/zonalar', (req, res) => {
  const zones = db.prepare('SELECT * FROM shipping_zones ORDER BY kind, sort_order').all();
  res.render('admin/zones', { title: 'Çatdırılma zonaları', zones, layout: 'admin/layout' });
});

router.post('/zonalar/yeni', (req, res) => {
  const { name, kind, price } = req.body;
  if (name && price) {
    db.prepare('INSERT INTO shipping_zones (name, kind, price, sort_order) VALUES (?, ?, ?, ?)').run(
      name,
      kind === 'region' ? 'region' : 'city',
      parseFloat(price),
      999
    );
  }
  res.redirect('/admin/zonalar');
});

router.post('/zonalar/:id/redakte', (req, res) => {
  const { name, price, is_active } = req.body;
  db.prepare('UPDATE shipping_zones SET name = ?, price = ?, is_active = ? WHERE id = ?').run(
    name,
    parseFloat(price),
    is_active ? 1 : 0,
    req.params.id
  );
  res.redirect('/admin/zonalar');
});

router.post('/zonalar/:id/sil', (req, res) => {
  db.prepare('DELETE FROM shipping_zones WHERE id = ?').run(req.params.id);
  res.redirect('/admin/zonalar');
});

// --- Tərəfdaşlar (affiliate) ---
router.get('/tereflik', (req, res) => {
  affiliates.settleEligibleCommissions();
  const partners = db
    .prepare(
      `SELECT c.id, c.full_name, c.email, c.referral_code, c.affiliate_balance,
              COUNT(o.id) AS order_count, COALESCE(SUM(o.commission_amount),0) AS total_commission
       FROM customers c
       LEFT JOIN orders o ON o.affiliate_id = c.id
       WHERE c.referral_code IS NOT NULL
       GROUP BY c.id
       ORDER BY total_commission DESC`
    )
    .all();
  const payoutRequests = db
    .prepare(
      `SELECT p.*, c.full_name, c.email FROM payout_requests p
       JOIN customers c ON c.id = p.affiliate_id
       ORDER BY (p.status = 'gozleyir') DESC, p.requested_at DESC`
    )
    .all();
  res.render('admin/affiliates', { title: 'Tərəfdaşlar', partners, payoutRequests, layout: 'admin/layout' });
});

router.post('/tereflik/:id/ode', (req, res) => {
  const payout = db.prepare('SELECT * FROM payout_requests WHERE id = ?').get(req.params.id);
  if (payout && payout.status === 'gozleyir') {
    db.prepare("UPDATE payout_requests SET status = 'odenildi', resolved_at = CURRENT_TIMESTAMP WHERE id = ?").run(payout.id);
  }
  res.redirect('/admin/tereflik');
});

router.post('/tereflik/:id/legv', (req, res) => {
  const payout = db.prepare('SELECT * FROM payout_requests WHERE id = ?').get(req.params.id);
  if (payout && payout.status === 'gozleyir') {
    // Refund the requested amount back onto the affiliate's balance.
    db.prepare("UPDATE payout_requests SET status = 'legv_edildi', resolved_at = CURRENT_TIMESTAMP WHERE id = ?").run(payout.id);
    db.prepare('UPDATE customers SET affiliate_balance = affiliate_balance + ? WHERE id = ?').run(payout.amount, payout.affiliate_id);
  }
  res.redirect('/admin/tereflik');
});

// --- Ayarlar ---
router.get('/ayarlar', (req, res) => {
  res.render('admin/settings', { title: 'Ayarlar', settings: settings.all(), layout: 'admin/layout' });
});

router.post('/ayarlar', (req, res) => {
  const fields = [
    'affiliate_commission_percent',
    'affiliate_hold_days',
    'affiliate_payout_threshold',
    'bonus_cashback_percent',
    'bonus_hold_days',
    'warranty_price',
    'warranty_terms',
  ];
  fields.forEach((key) => {
    if (req.body[key] !== undefined) settings.set(key, req.body[key]);
  });
  settings.set('warranty_enabled', req.body.warranty_enabled ? '1' : '0');
  res.redirect('/admin/ayarlar');
});

module.exports = router;
