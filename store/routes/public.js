const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const brand = require('../config/brand');
const google = require('../config/google');
const settings = require('../config/settings');
const shipping = require('../lib/shipping');
const affiliates = require('../lib/affiliates');
const { requireCustomer } = require('../middleware/auth');
const { isLocked, registerFailure, resetFailures, LOCK_MINUTES } = require('../middleware/loginGuard');

const router = express.Router();

// At most 10 login/register attempts per IP per 10 minutes, on top of the
// per-account lockout below — slows down distributed brute-force attempts.
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Çox sayda cəhd edildi. Bir az sonra yenidən sınayın.',
});

router.use((req, res, next) => {
  res.locals.brand = brand;
  res.locals.customer = req.session.customerId
    ? db.prepare('SELECT id, full_name, email FROM customers WHERE id = ?').get(req.session.customerId)
    : null;
  res.locals.cartCount = (req.session.cart || []).reduce((sum, i) => sum + i.qty, 0);
  next();
});

// Referral capture — a link like /mehsullar?ref=A7K2PQ tags the visitor's
// session so the eventual order (even days later) is attributed to that
// partner. Self-referral is blocked at checkout time, not here.
router.use((req, res, next) => {
  if (req.query.ref) {
    const partner = affiliates.findByReferralCode(String(req.query.ref).toUpperCase());
    if (partner) req.session.refCode = partner.referral_code;
  }
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

// About
router.get('/haqqimizda', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.render('about', { categories, title: 'Haqqımızda' });
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
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const zones = shipping.listZones();
  const warrantyEnabled = settings.get('warranty_enabled', '1') === '1';
  const warrantyPrice = settings.getNumber('warranty_price', 0);
  const warrantyTerms = settings.get('warranty_terms', '');
  res.render('cart', { cart, subtotal, zones, warrantyEnabled, warrantyPrice, warrantyTerms, title: 'Səbətim' });
});

router.post('/sifaris', (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/sebet');
  const { name, phone, address, shipping_zone_id, warranty } = req.body;

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  // Shipping is one flat fee for the whole order (all items go out
  // together in as few boxes as possible), never multiplied per item.
  const shippingFee = shipping.feeForZone(shipping_zone_id ? parseInt(shipping_zone_id, 10) : null);
  const warrantyEnabled = settings.get('warranty_enabled', '1') === '1';
  const warrantySelected = warrantyEnabled && warranty === 'on';
  const warrantyFee = warrantySelected ? settings.getNumber('warranty_price', 0) : 0;
  // Shipping + warranty are the customer's own cost, outside our taxable
  // revenue — kept in separate columns so any future receipt only
  // reports `subtotal` as the sale amount.
  const total = subtotal + shippingFee + warrantyFee;

  const insertOrder = db.prepare(
    `INSERT INTO orders (customer_id, customer_name, customer_phone, customer_address, subtotal, shipping_zone_id, shipping_fee, warranty_selected, warranty_fee, total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = insertOrder.run(
    req.session.customerId || null,
    name,
    phone,
    address,
    subtotal,
    shipping_zone_id || null,
    shippingFee,
    warrantySelected ? 1 : 0,
    warrantyFee,
    total
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, product_id, product_name, unit_price, qty) VALUES (?, ?, ?, ?, ?)`
  );
  const decStock = db.prepare('UPDATE products SET stock = MAX(stock - ?, 0) WHERE id = ?');
  cart.forEach((item) => {
    insertItem.run(result.lastInsertRowid, item.id, item.name, item.price, item.qty);
    decStock.run(item.qty, item.id);
  });

  // Attribute the order to a referring partner, if any — never to oneself.
  if (req.session.refCode) {
    const partner = affiliates.findByReferralCode(req.session.refCode);
    if (partner && partner.id !== req.session.customerId) {
      affiliates.attributeOrder(result.lastInsertRowid, partner.id, subtotal);
    }
  }

  req.session.cart = [];
  res.render('sifaris-tamamlandi', {
    orderId: result.lastInsertRowid,
    subtotal,
    shippingFee,
    warrantyFee,
    total,
    title: 'Sifariş qəbul olundu',
  });
});

// --- Customer auth ---
router.get('/qeydiyyat', (req, res) =>
  res.render('register', { title: 'Qeydiyyat', error: null, googleClientId: google.GOOGLE_CLIENT_ID })
);

router.post('/qeydiyyat', authLimiter, (req, res) => {
  const { full_name, email, phone, password } = req.body;
  if (!full_name || !email || !password) {
    return res.render('register', { title: 'Qeydiyyat', error: 'Bütün vacib sahələri doldurun.', googleClientId: google.GOOGLE_CLIENT_ID });
  }
  if (password.length < 6) {
    return res.render('register', { title: 'Qeydiyyat', error: 'Parol ən azı 6 simvol olmalıdır.', googleClientId: google.GOOGLE_CLIENT_ID });
  }
  const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
  if (existing) {
    return res.render('register', { title: 'Qeydiyyat', error: 'Bu email ilə artıq hesab var.', googleClientId: google.GOOGLE_CLIENT_ID });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO customers (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)')
    .run(full_name, email, phone || null, hash);
  req.session.customerId = result.lastInsertRowid;
  res.redirect('/hesabim');
});

router.get('/giris', (req, res) =>
  res.render('login', { title: 'Giriş', error: null, redirect: req.query.redirect || '/', googleClientId: google.GOOGLE_CLIENT_ID })
);
router.get('/login', (req, res) => res.redirect('/giris' + (req.query.redirect ? `?redirect=${encodeURIComponent(req.query.redirect)}` : '')));

router.post('/giris', authLimiter, (req, res) => {
  const { email, password } = req.body;
  const redirect = req.body.redirect || '/';
  const fail = (msg) => res.render('login', { title: 'Giriş', error: msg, redirect, googleClientId: google.GOOGLE_CLIENT_ID });

  const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(email);
  if (!customer) return fail('Email və ya parol yanlışdır.');
  if (isLocked(customer)) return fail(`Çox sayda yanlış cəhd. ${LOCK_MINUTES} dəqiqə sonra yenidən sınayın.`);
  if (!customer.password_hash) return fail('Bu hesab Google ilə qeydiyyatdan keçib. "Google ilə daxil ol" düyməsini istifadə edin.');

  if (!bcrypt.compareSync(password, customer.password_hash)) {
    registerFailure(db, 'customers', customer.id, customer.failed_login_count);
    return fail('Email və ya parol yanlışdır.');
  }
  resetFailures(db, 'customers', customer.id);
  req.session.customerId = customer.id;
  res.redirect(redirect);
});

// --- Google ilə giriş/qeydiyyat ---
// The front-end Google button posts an ID token here (Google Identity
// Services); we verify it server-side and never trust the client's claim.
router.post('/auth/google', authLimiter, async (req, res) => {
  const redirect = req.body.redirect || '/';
  try {
    const { email, name, googleId } = await google.verifyGoogleToken(req.body.credential);
    let customer = db.prepare('SELECT * FROM customers WHERE google_id = ? OR email = ?').get(googleId, email);
    if (!customer) {
      const result = db
        .prepare('INSERT INTO customers (full_name, email, google_id) VALUES (?, ?, ?)')
        .run(name, email, googleId);
      customer = { id: result.lastInsertRowid };
    } else if (!customer.google_id) {
      db.prepare('UPDATE customers SET google_id = ? WHERE id = ?').run(googleId, customer.id);
    }
    req.session.customerId = customer.id;
    res.redirect(redirect);
  } catch (err) {
    res.render('login', { title: 'Giriş', error: 'Google ilə giriş alınmadı: ' + err.message, redirect, googleClientId: google.GOOGLE_CLIENT_ID });
  }
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

// --- Tərəfdaşlıq (həvalə / referral) proqramı ---
router.get('/tereflik', requireCustomer, (req, res) => {
  affiliates.ensureReferralCode(req.session.customerId);
  const summary = affiliates.getAffiliateSummary(req.session.customerId);
  const commissionPercent = settings.getNumber('affiliate_commission_percent', 10);
  const holdDays = settings.getNumber('affiliate_hold_days', 15);
  res.render('partner', { ...summary, commissionPercent, holdDays, title: 'Tərəfdaşlıq proqramı', error: null, success: null });
});

router.post('/tereflik/cek', requireCustomer, (req, res) => {
  const summary = affiliates.getAffiliateSummary(req.session.customerId);
  const commissionPercent = settings.getNumber('affiliate_commission_percent', 10);
  const holdDays = settings.getNumber('affiliate_hold_days', 15);
  if (!summary.canRequestPayout) {
    return res.render('partner', {
      ...summary,
      commissionPercent,
      holdDays,
      title: 'Tərəfdaşlıq proqramı',
      error: `Minimum çıxarış həddi ${summary.threshold} ₼-dir, hələ ona çatmamısınız.`,
      success: null,
    });
  }
  db.prepare('INSERT INTO payout_requests (affiliate_id, amount) VALUES (?, ?)').run(req.session.customerId, summary.customer.affiliate_balance);
  db.prepare('UPDATE customers SET affiliate_balance = 0 WHERE id = ?').run(req.session.customerId);
  const updated = affiliates.getAffiliateSummary(req.session.customerId);
  res.render('partner', {
    ...updated,
    commissionPercent,
    holdDays,
    title: 'Tərəfdaşlıq proqramı',
    error: null,
    success: 'Çıxarış sorğusu göndərildi. Admin təsdiqlədikdən sonra ödəniş ediləcək.',
  });
});

module.exports = router;
