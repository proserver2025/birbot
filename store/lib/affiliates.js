const crypto = require('crypto');
const db = require('../db');
const settings = require('../config/settings');

// Short, URL-friendly referral code (e.g. "A7K2PQ"), unique per customer.
function generateReferralCode() {
  for (let i = 0; i < 20; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
    const exists = db.prepare('SELECT id FROM customers WHERE referral_code = ?').get(code);
    if (!exists) return code;
  }
  throw new Error('Referral kodu yaradıla bilmədi');
}

// Every customer can become a "partner" — this just assigns them a code,
// no separate approval step (matches "istənilən şəxs paylaşa bilsin").
function ensureReferralCode(customerId) {
  const customer = db.prepare('SELECT id, referral_code FROM customers WHERE id = ?').get(customerId);
  if (!customer) throw new Error('Müştəri tapılmadı');
  if (customer.referral_code) return customer.referral_code;
  const code = generateReferralCode();
  db.prepare('UPDATE customers SET referral_code = ? WHERE id = ?').run(code, customerId);
  return code;
}

function findByReferralCode(code) {
  if (!code) return null;
  return db.prepare('SELECT id, full_name, referral_code FROM customers WHERE referral_code = ?').get(code);
}

// Called once, right when an order is created: records who referred the
// buyer (if anyone) and how much commission is at stake, on hold for the
// return window.
function attributeOrder(orderId, affiliateId, orderSubtotal) {
  if (!affiliateId) return;
  const pct = settings.getNumber('affiliate_commission_percent', 10);
  const holdDays = settings.getNumber('affiliate_hold_days', 15);
  const commission = Math.round(orderSubtotal * (pct / 100) * 100) / 100;
  const eligibleAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  db.prepare(
    `UPDATE orders SET affiliate_id = ?, commission_amount = ?, commission_status = 'gozleyir', commission_eligible_at = ? WHERE id = ?`
  ).run(affiliateId, commission, eligibleAt, orderId);
}

// Promotes commissions whose 15-day hold has passed into "cleared" (added
// to the affiliate's withdrawable balance) — unless the order was
// cancelled or returned in the meantime, in which case it's dropped.
// Cheap enough to call at the top of any affiliate-facing page.
function settleEligibleCommissions() {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const toClear = db
    .prepare(
      `SELECT id, affiliate_id, commission_amount FROM orders
       WHERE commission_status = 'gozleyir' AND commission_eligible_at <= ?
         AND status NOT IN ('legv_edildi')`
    )
    .all(now);
  const clearOrder = db.prepare(`UPDATE orders SET commission_status = 'temizlendi' WHERE id = ?`);
  const addBalance = db.prepare('UPDATE customers SET affiliate_balance = affiliate_balance + ? WHERE id = ?');
  const settleTx = db.transaction((rows) => {
    for (const row of rows) {
      clearOrder.run(row.id);
      addBalance.run(row.commission_amount, row.affiliate_id);
    }
  });
  if (toClear.length) settleTx(toClear);

  // Cancelled orders never pay out, whatever stage they were at.
  const toVoid = db
    .prepare(`SELECT id FROM orders WHERE commission_status = 'gozleyir' AND status = 'legv_edildi'`)
    .all();
  const voidOrder = db.prepare(`UPDATE orders SET commission_status = 'legv_edildi' WHERE id = ?`);
  for (const row of toVoid) voidOrder.run(row.id);
}

function getAffiliateSummary(customerId) {
  settleEligibleCommissions();
  const customer = db.prepare('SELECT id, full_name, referral_code, affiliate_balance FROM customers WHERE id = ?').get(customerId);
  const pendingTotal =
    db.prepare(`SELECT COALESCE(SUM(commission_amount),0) s FROM orders WHERE affiliate_id = ? AND commission_status = 'gozleyir'`).get(customerId).s;
  const clearedTotal =
    db.prepare(`SELECT COALESCE(SUM(commission_amount),0) s FROM orders WHERE affiliate_id = ? AND commission_status = 'temizlendi'`).get(customerId).s;
  const paidTotal =
    db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM payout_requests WHERE affiliate_id = ? AND status = 'odenildi'`).get(customerId).s;
  const referredOrders = db
    .prepare('SELECT * FROM orders WHERE affiliate_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(customerId);
  const payoutRequests = db
    .prepare('SELECT * FROM payout_requests WHERE affiliate_id = ? ORDER BY requested_at DESC LIMIT 20')
    .all(customerId);
  const threshold = settings.getNumber('affiliate_payout_threshold', 50);
  return {
    customer,
    pendingTotal,
    clearedTotal,
    paidTotal,
    referredOrders,
    payoutRequests,
    threshold,
    canRequestPayout: customer.affiliate_balance >= threshold,
  };
}

module.exports = { ensureReferralCode, findByReferralCode, attributeOrder, settleEligibleCommissions, getAffiliateSummary };
