'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const CURRICULUM = require('../curriculum');
const { STARTING_CREDITS } = require('../constants');
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

function seedSubjects(userId, standard) {
  const subjects = CURRICULUM[standard];
  if (!subjects) return;
  const insertSubject = db.prepare('INSERT INTO subjects (user_id, name) VALUES (?,?)');
  const insertChapter = db.prepare('INSERT INTO chapters (subject_id, name, position) VALUES (?,?,?)');
  let position = 0;
  for (const [name, chapters] of Object.entries(subjects)) {
    const subjRes = insertSubject.run(userId, name);
    chapters.forEach((chName, i) => insertChapter.run(subjRes.lastInsertRowid, chName, position + i));
    position += chapters.length;
  }
}

router.post('/register', rateLimit, (req, res) => {
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

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).trim());
  if (existing) return res.status(409).json({ error: 'email_taken', message: 'An account with this email already exists — try signing in instead.' });

  const hash = bcrypt.hashSync(password, 10);
  const answerHash = bcrypt.hashSync(String(securityAnswer).trim().toLowerCase(), 10);

  db.exec('BEGIN');
  let userId;
  try {
    const res2 = db.prepare(`
      INSERT INTO users (name, email, password_hash, standard, division, board, credits, security_question, security_answer_hash)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(String(name).trim(), String(email).trim(), hash, standard, String(division).trim(), String(board).trim(), STARTING_CREDITS, String(securityQuestion).trim(), answerHash);
    userId = Number(res2.lastInsertRowid);
    seedSubjects(userId, standard);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const token = createSession(userId);
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.status(201).json(buildState(userId));
});

router.post('/login', rateLimit, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'validation', message: 'Enter your email and password.' });

  const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(String(email).trim());
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'bad_credentials', message: 'Incorrect email or password.' });
  }

  const token = createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.json(buildState(user.id));
});

router.post('/logout', (req, res) => {
  destroySession(req.sessionToken);
  res.setHeader('Set-Cookie', expiredCookie());
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(buildState(req.user.id));
});

/* Password recovery via the security question set at registration. */

router.post('/forgot-password', rateLimit, (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ error: 'validation', message: 'Please enter a valid email address.' });
  }
  const user = db.prepare('SELECT id, security_question FROM users WHERE email = ?').get(String(email).trim());
  if (!user) {
    return res.status(404).json({ error: 'no_recovery', message: 'No account found with this email — check the spelling, or create a new account.' });
  }
  if (!user.security_question) {
    return res.status(404).json({ error: 'no_recovery', message: 'This account was created without a security question, so its password cannot be reset this way.' });
  }
  res.json({ question: user.security_question });
});

router.post('/reset-password', rateLimit, (req, res) => {
  const { email, answer, newPassword } = req.body || {};
  if (!email || !answer || !newPassword) return res.status(400).json({ error: 'validation', message: 'Please fill in every field.' });
  if (typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ error: 'validation', message: 'Password must be at least 8 characters long.' });
  if (!isPasswordStrongEnough(newPassword)) return res.status(400).json({ error: 'weak_password', message: 'This password is too easy to guess — make it harder (mix uppercase, numbers and a symbol).' });

  const user = db.prepare('SELECT id, password_hash, security_answer_hash FROM users WHERE email = ?').get(String(email).trim());
  if (!user || !user.security_answer_hash) {
    return res.status(404).json({ error: 'no_recovery', message: 'This account cannot be reset with a security question.' });
  }
  if (!bcrypt.compareSync(String(answer).trim().toLowerCase(), user.security_answer_hash)) {
    return res.status(400).json({ error: 'wrong_answer', message: "That answer doesn't match — try again (capital letters don't matter)." });
  }
  if (bcrypt.compareSync(newPassword, user.password_hash)) {
    return res.status(400).json({ error: 'same_password', message: 'That is your current password — choose a different one.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
    // A reset password must log the account out everywhere.
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.json({ ok: true });
});

router.post('/change-password', rateLimit, requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'validation', message: 'Please fill in every field.' });
  if (typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ error: 'validation', message: 'Password must be at least 8 characters long.' });
  if (!isPasswordStrongEnough(newPassword)) return res.status(400).json({ error: 'weak_password', message: 'This password is too easy to guess — make it harder (mix uppercase, numbers and a symbol).' });

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(currentPassword), user.password_hash)) {
    return res.status(400).json({ error: 'wrong_password', message: 'Your current password is not correct.' });
  }
  if (bcrypt.compareSync(newPassword, user.password_hash)) {
    return res.status(400).json({ error: 'same_password', message: 'That is your current password — choose a different one.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
    // Keep this session alive, end all others.
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(req.user.id, req.sessionToken);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.json({ ok: true });
});

module.exports = { router, KNOWN_BOARDS };
