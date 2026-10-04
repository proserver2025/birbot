const db = require('../db');

function requireCustomer(req, res, next) {
  if (!req.session.customerId) {
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  // Re-check on every request — a customer blocked mid-session shouldn't
  // keep acting on an already-issued cookie.
  const customer = db.prepare('SELECT is_blocked FROM customers WHERE id = ?').get(req.session.customerId);
  if (!customer || customer.is_blocked) {
    req.session.customerId = null;
    return res.redirect('/giris');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.adminId) {
    return res.redirect('/admin/login');
  }
  next();
}

module.exports = { requireCustomer, requireAdmin };
