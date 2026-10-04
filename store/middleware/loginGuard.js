// Simple brute-force guard: locks an account for a growing cooldown after
// repeated failed logins. Works for both the `customers` and `admins`
// tables, which share the same failed_login_count / locked_until columns.

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function isLocked(row) {
  if (!row || !row.locked_until) return false;
  return new Date(row.locked_until + 'Z').getTime() > Date.now();
}

function registerFailure(db, table, id, currentCount) {
  const next = (currentCount || 0) + 1;
  if (next >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    db.prepare(`UPDATE ${table} SET failed_login_count = ?, locked_until = ? WHERE id = ?`).run(next, lockedUntil, id);
  } else {
    db.prepare(`UPDATE ${table} SET failed_login_count = ? WHERE id = ?`).run(next, id);
  }
}

function resetFailures(db, table, id) {
  db.prepare(`UPDATE ${table} SET failed_login_count = 0, locked_until = NULL WHERE id = ?`).run(id);
}

module.exports = { isLocked, registerFailure, resetFailures, MAX_ATTEMPTS, LOCK_MINUTES };
