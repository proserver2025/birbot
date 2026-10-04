const crypto = require('crypto');
const brand = require('../config/brand');

// Lightweight CSRF protection (double-submit style, tied to the session).
// Every GET request gets a token in res.locals.csrfToken (render it as a
// hidden field in every POST form). Every state-changing request is
// verified against the token stored in the session.

function rejectCsrf(res) {
  // Runs before the public/admin routers set their own render locals
  // (brand, categories, ...), so provide safe fallbacks here.
  res.locals.brand = res.locals.brand || brand;
  res.locals.cartCount = res.locals.cartCount || 0;
  res.locals.customer = res.locals.customer || null;
  res.locals.lang = res.locals.lang || 'az';
  res.locals.t = res.locals.t || ((key) => key);
  return res.status(403).render('403', { title: res.locals.t('error.403_title'), layout: 'layout' });
}

function csrfMiddleware(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;

  const stateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!stateChanging) return next();

  // Multipart bodies (file uploads) aren't parsed yet at this point in the
  // middleware chain — multer runs later, per-route. Those routes verify
  // CSRF themselves via csrfMiddleware.afterUpload, once req.body exists.
  if (req.is('multipart/form-data')) return next();

  const sent = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  if (!sent || sent !== req.session.csrfToken) return rejectCsrf(res);
  next();
}

// Use as the middleware right after multer on a multipart route, e.g.:
//   router.post('/x', upload.single('image'), csrfMiddleware.afterUpload, handler)
csrfMiddleware.afterUpload = function (req, res, next) {
  const sent = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  if (!sent || sent !== req.session.csrfToken) return rejectCsrf(res);
  next();
};

module.exports = csrfMiddleware;
