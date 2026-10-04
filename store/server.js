require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts');

const db = require('./db');
const csrfMiddleware = require('./middleware/csrf');
const { i18nMiddleware } = require('./config/i18n');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Running behind Nginx/Oracle's load balancer — needed so secure cookies
// and rate-limit client IPs work correctly in production.
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Security headers. CSP is relaxed just enough to allow Google Fonts and
// the "Sign in with Google" widget; everything else stays locked down.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        frameSrc: ['https://accounts.google.com'],
        connectSrc: ["'self'", 'https://accounts.google.com'],
      },
    },
  })
);

// Overall request throttle (on top of the stricter per-route limiters on
// login/register) — blunts simple denial-of-service / scraping bursts.
app.use(rateLimit({ windowMs: 60 * 1000, max: 180, standardHeaders: true, legacyHeaders: false }));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.use(
  session({
    store: new SqliteStore({ client: db, expired: { clear: true, intervalMs: 15 * 60 * 1000 } }),
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd, // requires HTTPS (Nginx + Let's Encrypt) in production
    },
  })
);

app.use(i18nMiddleware);
app.use(csrfMiddleware);

app.use('/admin', adminRoutes);
app.use('/', publicRoutes);

app.use((req, res) => {
  res.status(404).render('404', { title: res.locals.t('error.404_title'), layout: 'layout' });
});

// Global error handler — never leak stack traces to the client; multer's
// fileFilter/size-limit errors land here too (they're thrown mid-upload,
// before any route handler runs).
app.use((err, req, res, next) => {
  if (!isProd) console.error(err);
  res.locals.brand = res.locals.brand || require('./config/brand');
  res.locals.cartCount = res.locals.cartCount || 0;
  res.locals.customer = res.locals.customer || null;
  res.locals.lang = res.locals.lang || 'az';
  res.locals.t = res.locals.t || ((key) => key);
  const message = err && err.message ? err.message : 'Gözlənilməz xəta baş verdi.';
  res.status(err.status || 400).render('error', { title: res.locals.t('error.generic_title'), message, layout: 'layout' });
});

app.listen(PORT, () => {
  console.log(`SaaS Home Store http://localhost:${PORT} ünvanında işə düşdü`);
});
