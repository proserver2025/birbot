const db = require('../db');

function listZones() {
  return db.prepare('SELECT * FROM shipping_zones WHERE is_active = 1 ORDER BY sort_order').all();
}

function getZone(id) {
  if (!id) return null;
  return db.prepare('SELECT * FROM shipping_zones WHERE id = ? AND is_active = 1').get(id);
}

// Shipping is charged once per order, never per item — the whole cart is
// consolidated into as few boxes as possible before dispatch from the
// Sədərək / Abşeron Ticarət Mərkəzi warehouse, so the fee only depends on
// the delivery zone, not on how many products/qty are in the cart.
function feeForZone(zoneId) {
  const zone = getZone(zoneId);
  return zone ? zone.price : 0;
}

module.exports = { listZones, getZone, feeForZone };
