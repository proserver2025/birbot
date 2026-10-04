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
  res.render('admin/product-form', { title: 'Yeni məhsul', product: null, categories, error: null, layout: 'admin/layout' });
});

router.post('/mehsullar/yeni', upload.single('image'), csrfMiddleware.afterUpload, (req, res) => {
  const { name, description, price, compare_at_price, stock, category_id, is_active, is_featured, imported_image_url, cost_price, supplier_name } = req.body;

  // Internal-only fields, but mandatory: every product must record what
  // it actually cost and who it was bought from.
  if (!cost_price || parseFloat(cost_price) <= 0 || !supplier_name || !supplier_name.trim()) {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    return res.status(400).render('admin/product-form', {
      title: 'Yeni məhsul',
      product: { ...req.body, price: parseFloat(price) || 0 },
      categories,
      error: 'Maya dəyəri və təchizatçı/topdançı mağaza adı mütləqdir.',
      layout: 'admin/layout',
    });
  }

  const slug = slugify(name, { lower: true, strict: true }) + '-' + Math.floor(Math.random() * 10000);
  const image_url = req.file ? '/uploads/' + req.file.filename : (imported_image_url || null);
  db.prepare(
    `INSERT INTO products (name, slug, description, price, compare_at_price, stock, category_id, image_url, is_active, is_featured, cost_price, supplier_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    supplier_name.trim()
  );
  res.redirect('/admin/mehsullar');
});

router.get('/mehsullar/:id/redakte', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.redirect('/admin/mehsullar');
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.render('admin/product-form', { title: 'Məhsulu redaktə et', product, categories, error: null, layout: 'admin/layout' });
});

router.post('/mehsullar/:id/redakte', upload.single('image'), csrfMiddleware.afterUpload, (req, res) => {
  const { name, description, price, compare_at_price, stock, category_id, is_active, is_featured, imported_image_url, cost_price, supplier_name } = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.redirect('/admin/mehsullar');

  if (!cost_price || parseFloat(cost_price) <= 0 || !supplier_name || !supplier_name.trim()) {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    return res.status(400).render('admin/product-form', {
      title: 'Məhsulu redaktə et',
      product: { ...existing, ...req.body },
      categories,
      error: 'Maya dəyəri və təchizatçı/topdançı mağaza adı mütləqdir.',
      layout: 'admin/layout',
    });
  }

  const image_url = req.file ? '/uploads/' + req.file.filename : (imported_image_url || existing.image_url);
  db.prepare(
    `UPDATE products SET name=?, description=?, price=?, compare_at_price=?, stock=?, category_id=?, image_url=?, is_active=?, is_featured=?, cost_price=?, supplier_name=?
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
    supplier_name.trim(),
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
      `SELECT o.*, z.name AS zone_name FROM orders o
       LEFT JOIN shipping_zones z ON z.id = o.shipping_zone_id
       WHERE o.id = ?`
    )
    .get(req.params.id);
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
