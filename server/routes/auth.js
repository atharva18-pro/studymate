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
  const { name, standard, division, board, email, password } = req.body || {};

  if (!name || !String(name).trim()) return res.status(400).json({ error: 'validation', message: 'Please enter your name.' });
  if (!STANDARDS.includes(standard)) return res.status(400).json({ error: 'validation', message: 'Please select your standard.' });
  if (!division || !String(division).trim()) return res.status(400).json({ error: 'validation', message: 'Please enter your class / division.' });
  if (!board || !String(board).trim()) return res.status(400).json({ error: 'validation', message: 'Please select your board.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ error: 'validation', message: 'Please enter a valid email address.' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'validation', message: 'Password must be at least 8 characters long.' });
  if (!isPasswordStrongEnough(password)) return res.status(400).json({ error: 'weak_password', message: 'This password is too easy to guess — make it harder (mix uppercase, numbers and a symbol).' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).trim());
  if (existing) return res.status(409).json({ error: 'email_taken', message: 'An account with this email already exists — try signing in instead.' });

  const hash = bcrypt.hashSync(password, 10);

  db.exec('BEGIN');
  let userId;
  try {
    const res2 = db.prepare(`
      INSERT INTO users (name, email, password_hash, standard, division, board, credits)
      VALUES (?,?,?,?,?,?,?)
    `).run(String(name).trim(), String(email).trim(), hash, standard, String(division).trim(), String(board).trim(), STARTING_CREDITS);
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

module.exports = { router, KNOWN_BOARDS };
