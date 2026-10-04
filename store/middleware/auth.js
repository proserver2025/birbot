function requireCustomer(req, res, next) {
  if (!req.session.customerId) {
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
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
