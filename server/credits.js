'use strict';

const db = require('./db');

// Spend credits atomically: the guarded UPDATE is a single statement, so it
// only succeeds if the balance covers the cost. Returns the new balance,
// or throws {code:'not_enough_credits'}.
async function spendCredits(userId, amount, reason) {
  const upd = await db.run(
    'UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ? RETURNING credits',
    [amount, userId, amount]
  );
  if (upd.rows.length === 0) {
    const row = await db.get('SELECT credits FROM users WHERE id = ?', [userId]);
    const err = new Error('Not enough credits');
    err.code = 'not_enough_credits';
    err.credits = row ? row.credits : 0;
    err.required = amount;
    throw err;
  }
  const balance = upd.rows[0].credits;
  await db.run('INSERT INTO credit_ledger (user_id, change, reason, balance_after) VALUES (?,?,?,?)',
    [userId, -amount, reason, balance]);
  return balance;
}

async function earnCredits(userId, amount, reason) {
  const upd = await db.run(
    'UPDATE users SET credits = credits + ? WHERE id = ? RETURNING credits',
    [amount, userId]
  );
  const balance = upd.rows.length ? upd.rows[0].credits : await db.get('SELECT credits FROM users WHERE id = ?', [userId]);
  await db.run('INSERT INTO credit_ledger (user_id, change, reason, balance_after) VALUES (?,?,?,?)',
    [userId, amount, reason, balance]);
  return balance;
}

module.exports = { spendCredits, earnCredits };
