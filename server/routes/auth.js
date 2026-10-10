'use strict';

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const CURRICULUM = require('../curriculum');
const { STARTING_CREDITS } = require('../constants');
const { isEmailConfigured, sendEmail, resetCodeEmail } = require('../email');
const {
  createSession, destroySession, sessionCookie, expiredCookie,
  requireAuth, isPasswordStrongEnough,
} = require('../auth');
const { buildState } = require('../state');

const router = express.Router();

const STANDARDS = Object.keys(CURRICULUM);
const KNOWN_BOARDS = ['CBSE', 'ICSE', 'Maharashtra State Board'];

/* Tiny in-memory rate limiter for auth endpoints. */
const attempts = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const rec = attempts.get(ip) || { count: 0, resetAt: now + 10 * 60 * 1000 };
  if (now > rec.resetAt) { rec.count = 0; rec.resetAt = now + 10 * 60 * 1000; }
  rec.count += 1;
  attempts.set(ip, rec);
  if (rec.count > 30) return res.status(429).json({ error: 'too_many_attempts', message: 'Too many attempts — please wait a few minutes and try again.' });
  next();
}

// Seed statements for a brand-new account, all in one atomic batch with the
// user INSERT. Rows find each other through the unique email / (user_id, name).
function buildSeedStatements(email, standard) {
  const subjects = CURRICULUM[standard];
  if (!subjects) return [];
  const stmts = [];
  let position = 0;
  for (const [name, chapters] of Object.entries(subjects)) {
    stmts.push({
      sql: 'INSERT INTO subjects (user_id, name) VALUES ((SELECT id FROM users WHERE email = ?), ?)',
      args: [email, name],
    });
    chapters.forEach((chName, i) => {
      stmts.push({
        sql: `INSERT INTO chapters (subject_id, name, position)
              VALUES ((SELECT id FROM subjects WHERE user_id = (SELECT id FROM users WHERE email = ?) AND name = ?), ?, ?)`,
        args: [email, name, chName, position + i],
      });
    });
    position += chapters.length;
  }
  return stmts;
}

router.post('/register', rateLimit, async (req, res) => {
  const { name, standard, division, board, email, password, securityQuestion, securityAnswer } = req.body || {};

  if (!name || !String(name).trim()) return res.status(400).json({ error: 'validation', message: 'Please enter your name.' });
  if (!STANDARDS.includes(standard)) return res.status(400).json({ error: 'validation', message: 'Please select your standard.' });
  if (!division || !String(division).trim()) return res.status(400).json({ error: 'validation', message: 'Please enter your class / division.' });
  if (!board || !String(board).trim()) return res.status(400).json({ error: 'validation', message: 'Please select your board.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ error: 'validation', message: 'Please enter a valid email address.' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'validation', message: 'Password must be at least 8 characters long.' });
  if (!isPasswordStrongEnough(password)) return res.status(400).json({ error: 'weak_password', message: 'This password is too easy to guess — make it harder (mix uppercase, numbers and a symbol).' });
  if (!securityQuestion || !String(securityQuestion).trim()) return res.status(400).json({ error: 'validation', message: 'Please choose a security question.' });
  if (!securityAnswer || String(securityAnswer).trim().length < 2) return res.status(400).json({ error: 'validation', message: 'Please type an answer to your security question.' });

  const cleanEmail = String(email).trim();
  const existing = await db.get('SELECT id FROM users WHERE email = ?', [cleanEmail]);
  if (existing) return res.status(409).json({ error: 'email_taken', message: 'An account with this email already exists — try signing in instead.' });

  const hash = bcrypt.hashSync(password, 10);
  const answerHash = bcrypt.hashSync(String(securityAnswer).trim().toLowerCase(), 10);

  try {
    await db.batch([
      {
        sql: `INSERT INTO users (name, email, password_hash, standard, division, board, credits, security_question, security_answer_hash)
              VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [String(name).trim(), cleanEmail, hash, standard, String(division).trim(), String(board).trim(), STARTING_CREDITS, String(securityQuestion).trim(), answerHash],
      },
      ...buildSeedStatements(cleanEmail, standard),
    ], 'write');
  } catch (e) {
    if (/UNIQUE constraint failed: users\.email/i.test(e.message || '')) {
      return res.status(409).json({ error: 'email_taken', message: 'An account with this email already exists — try signing in instead.' });
    }
    throw e;
  }

  const userId = (await db.get('SELECT id FROM users WHERE email = ?', [cleanEmail])).id;
  const token = await createSession(userId);
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.status(201).json(await buildState(userId));
});

router.post('/login', rateLimit, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'validation', message: 'Enter your email and password.' });

  const user = await db.get('SELECT id, password_hash FROM users WHERE email = ?', [String(email).trim()]);
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'bad_credentials', message: 'Incorrect email or password.' });
  }

  const token = await createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.json(await buildState(user.id));
});

router.post('/logout', async (req, res) => {
  await destroySession(req.sessionToken);
  res.setHeader('Set-Cookie', expiredCookie());
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json(await buildState(req.user.id));
});

/* Password recovery — email code (Brevo) when configured, otherwise the
   security question set at registration. */

const RESET_CODE_MINUTES = 15;
const RESET_CODE_MAX_ATTEMPTS = 5;

router.post('/forgot-password', rateLimit, async (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ error: 'validation', message: 'Please enter a valid email address.' });
  }
  const user = await db.get('SELECT id, email, security_question FROM users WHERE email = ?', [String(email).trim()]);
  if (!user) {
    return res.status(404).json({ error: 'no_recovery', message: 'No account found with this email — check the spelling, or create a new account.' });
  }

  let emailFailed = false;
  if (isEmailConfigured()) {
    // One email a minute max — silently ignore double-clicks.
    const existing = await db.get('SELECT created_at FROM reset_codes WHERE user_id = ?', [user.id]);
    const nowRow = await db.get(`SELECT datetime('now', '-60 seconds') AS t`);
    const tooSoon = existing && existing.created_at > nowRow.t;
    if (tooSoon) return res.json({ method: 'email', email: user.email });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const sent = await sendEmail(user.email, 'StudyMate password reset code', resetCodeEmail(code));
    if (sent) {
      await db.run(`
        INSERT INTO reset_codes (user_id, code_hash, expires_at, attempts)
        VALUES (?,?,datetime('now', '+${RESET_CODE_MINUTES} minutes'),0)
        ON CONFLICT(user_id) DO UPDATE SET code_hash = excluded.code_hash,
          expires_at = excluded.expires_at, attempts = 0, created_at = datetime('now')
      `, [user.id, bcrypt.hashSync(code, 10)]);
      return res.json({ method: 'email', email: user.email });
    }
    emailFailed = true;
  }

  // No email service (or the send failed) — use the security question instead.
  if (!user.security_question) {
    return res.status(404).json({
      error: 'no_recovery',
      message: emailFailed
        ? 'We could not send the reset email right now — please try again in a minute.'
        : 'Password reset is not set up for this account yet — ask the app owner for help.',
    });
  }
  res.json({ method: 'question', question: user.security_question });
});

router.post('/reset-password', rateLimit, async (req, res) => {
  const { email, answer, code, newPassword } = req.body || {};
  if (!email || (!answer && !code) || !newPassword) return res.status(400).json({ error: 'validation', message: 'Please fill in every field.' });
  if (typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ error: 'validation', message: 'Password must be at least 8 characters long.' });
  if (!isPasswordStrongEnough(newPassword)) return res.status(400).json({ error: 'weak_password', message: 'This password is too easy to guess — make it harder (mix uppercase, numbers and a symbol).' });

  const user = await db.get('SELECT id, password_hash, security_answer_hash FROM users WHERE email = ?', [String(email).trim()]);
  if (!user) {
    return res.status(404).json({ error: 'no_recovery', message: 'No account found with this email.' });
  }

  if (code) {
    const row = await db.get(`SELECT code_hash, attempts, expires_at < datetime('now') AS expired FROM reset_codes WHERE user_id = ?`, [user.id]);
    const valid = row && !row.expired && row.attempts < RESET_CODE_MAX_ATTEMPTS && bcrypt.compareSync(String(code), row.code_hash);
    if (!valid) {
      if (row && row.expired) {
        return res.status(400).json({ error: 'wrong_code', message: 'That code has expired — ask for a new code.' });
      }
      if (row && row.attempts + 1 >= RESET_CODE_MAX_ATTEMPTS) {
        await db.run('DELETE FROM reset_codes WHERE user_id = ?', [user.id]);
        return res.status(400).json({ error: 'wrong_code', message: 'Too many wrong tries — ask for a new code.' });
      }
      if (row) await db.run('UPDATE reset_codes SET attempts = attempts + 1 WHERE user_id = ?', [user.id]);
      return res.status(400).json({ error: 'wrong_code', message: "That code doesn't match — check the email again, or ask for a new code." });
    }
  } else {
    if (!user.security_answer_hash) {
      return res.status(404).json({ error: 'no_recovery', message: 'This account cannot be reset with a security question.' });
    }
    if (!bcrypt.compareSync(String(answer).trim().toLowerCase(), user.security_answer_hash)) {
      return res.status(400).json({ error: 'wrong_answer', message: "That answer doesn't match — try again (capital letters don't matter)." });
    }
  }

  if (bcrypt.compareSync(newPassword, user.password_hash)) {
    return res.status(400).json({ error: 'same_password', message: 'That is your current password — choose a different one.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  const statements = [
    { sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [newHash, user.id] },
    // A reset password must log the account out everywhere.
    { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [user.id] },
  ];
  if (code) statements.push({ sql: 'DELETE FROM reset_codes WHERE user_id = ?', args: [user.id] });
  await db.batch(statements, 'write');

  res.json({ ok: true });
});

router.post('/change-password', rateLimit, requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'validation', message: 'Please fill in every field.' });
  if (typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ error: 'validation', message: 'Password must be at least 8 characters long.' });
  if (!isPasswordStrongEnough(newPassword)) return res.status(400).json({ error: 'weak_password', message: 'This password is too easy to guess — make it harder (mix uppercase, numbers and a symbol).' });

  const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!bcrypt.compareSync(String(currentPassword), user.password_hash)) {
    return res.status(400).json({ error: 'wrong_password', message: 'Your current password is not correct.' });
  }
  if (bcrypt.compareSync(newPassword, user.password_hash)) {
    return res.status(400).json({ error: 'same_password', message: 'That is your current password — choose a different one.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  await db.batch([
    { sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [newHash, req.user.id] },
    // Keep this session alive, end all others.
    { sql: 'DELETE FROM sessions WHERE user_id = ? AND token != ?', args: [req.user.id, req.sessionToken] },
  ], 'write');

  res.json({ ok: true });
});

module.exports = { router, KNOWN_BOARDS };
