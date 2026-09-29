'use strict';

const db = require('./db');

// Spend credits atomically: only succeeds if the balance covers the cost.
// Returns the new balance, or throws {code:'not_enough_credits'}.
function spendCredits(userId, amount, reason) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const res = db
      .prepare('UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?')
      .run(amount, userId, amount);
    if (res.changes === 0) {
      db.exec('ROLLBACK');
      const row = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
      const err = new Error('Not enough credits');
      err.code = 'not_enough_credits';
      err.credits = row ? row.credits : 0;
      err.required = amount;
      throw err;
    }
    const balance = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId).credits;
    db.prepare('INSERT INTO credit_ledger (user_id, change, reason, balance_after) VALUES (?,?,?,?)')
      .run(userId, -amount, reason, balance);
    db.exec('COMMIT');
    return balance;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) { /* already rolled back */ }
    throw e;
  }
}

function earnCredits(userId, amount, reason) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(amount, userId);
    const balance = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId).credits;
    db.prepare('INSERT INTO credit_ledger (user_id, change, reason, balance_after) VALUES (?,?,?,?)')
      .run(userId, amount, reason, balance);
    db.exec('COMMIT');
    return balance;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) { /* already rolled back */ }
    throw e;
  }
}

module.exports = { spendCredits, earnCredits };
