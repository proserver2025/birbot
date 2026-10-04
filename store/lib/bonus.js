const db = require('../db');
const settings = require('../config/settings');

// Cashback bonus — every order earns the BUYER (not a referrer) a % of
// the product subtotal back, on hold for the same kind of return-window
// period as affiliate commissions, then usable toward a future order.
function earnBonus(orderId, customerId, orderSubtotal) {
  if (!customerId) return; // guests can't earn (registration is required to check out anyway)
  const pct = settings.getNumber('bonus_cashback_percent', 5);
  const holdDays = settings.getNumber('bonus_hold_days', 15);
  const amount = Math.round(orderSubtotal * (pct / 100) * 100) / 100;
  if (amount <= 0) return;
  const eligibleAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  db.prepare(
    `UPDATE orders SET bonus_earned = ?, bonus_status = 'gozleyir', bonus_eligible_at = ? WHERE id = ?`
  ).run(amount, eligibleAt, orderId);
}

// Deducts bonus balance the customer chose to spend on an order, right
// away (spending isn't held — only earning is). Returns the amount
// actually applied (clamped to what they have and what the order needs).
function spendBonus(customerId, requestedAmount, orderTotal) {
  if (!customerId || !requestedAmount) return 0;
  const customer = db.prepare('SELECT bonus_balance FROM customers WHERE id = ?').get(customerId);
  if (!customer) return 0;
  const used = Math.max(0, Math.min(requestedAmount, customer.bonus_balance, orderTotal));
  if (used > 0) {
    db.prepare('UPDATE customers SET bonus_balance = bonus_balance - ? WHERE id = ?').run(used, customerId);
  }
  return Math.round(used * 100) / 100;
}

// Same "promote after the hold, drop if cancelled" sweep as affiliate
// commissions, just for the bonus_* columns.
function settleEligibleBonus() {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const toClear = db
    .prepare(
      `SELECT id, customer_id, bonus_earned FROM orders
       WHERE bonus_status = 'gozleyir' AND bonus_eligible_at <= ?
         AND status NOT IN ('legv_edildi')`
    )
    .all(now);
  const clearOrder = db.prepare(`UPDATE orders SET bonus_status = 'temizlendi' WHERE id = ?`);
  const addBalance = db.prepare('UPDATE customers SET bonus_balance = bonus_balance + ? WHERE id = ?');
  const tx = db.transaction((rows) => {
    for (const row of rows) {
      clearOrder.run(row.id);
      addBalance.run(row.bonus_earned, row.customer_id);
    }
  });
  if (toClear.length) tx(toClear);

  const toVoid = db.prepare(`SELECT id FROM orders WHERE bonus_status = 'gozleyir' AND status = 'legv_edildi'`).all();
  const voidOrder = db.prepare(`UPDATE orders SET bonus_status = 'legv_edildi' WHERE id = ?`);
  for (const row of toVoid) voidOrder.run(row.id);
}

function getBonusSummary(customerId) {
  settleEligibleBonus();
  const customer = db.prepare('SELECT id, bonus_balance FROM customers WHERE id = ?').get(customerId);
  const pendingTotal =
    db.prepare(`SELECT COALESCE(SUM(bonus_earned),0) s FROM orders WHERE customer_id = ? AND bonus_status = 'gozleyir'`).get(customerId).s;
  const holdDays = settings.getNumber('bonus_hold_days', 15);
  return { balance: customer ? customer.bonus_balance : 0, pendingTotal, holdDays };
}

module.exports = { earnBonus, spendBonus, settleEligibleBonus, getBonusSummary };
