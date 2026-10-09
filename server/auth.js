'use strict';

const crypto = require('crypto');
const db = require('./db');
const { SESSION_DAYS } = require('./constants');

const COOKIE_NAME = 'studymate_session';

/* Password policy — same rules as the original single-file app. */

const COMMON_WEAK_PASSWORDS = ['123456', 'password', '12345678', 'qwerty', 'abc123', '111111', '123123', 'password1', 'letmein', 'iloveyou', 'admin', 'welcome', 'monkey', 'dragon', 'football', '000000', '123456789', '1234567890'];

function evaluatePasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', ok: false };

  const lower = pw.toLowerCase();
  if (COMMON_WEAK_PASSWORDS.includes(lower) || (pw.length > 0 && /^(.)\1+$/.test(pw))) {
    return { score: 5, label: 'Too common — easily guessed. Try something more unique.', ok: false };
  }

  let score = 0;
  if (pw.length >= 8) score += 25;
  if (pw.length >= 12) score += 15;
  if (/[a-z]/.test(pw)) score += 10;
  if (/[A-Z]/.test(pw)) score += 15;
  if (/[0-9]/.test(pw)) score += 15;
  if (/[^A-Za-z0-9]/.test(pw)) score += 20;
  score = Math.min(score, 100);

  let label;
  if (pw.length < 8) label = 'Too short — add more characters to make it harder to crack.';
  else if (score < 50) label = 'Weak — add a number, a symbol, or an uppercase letter to make it harder.';
  else if (score < 80) label = 'Getting better — add one more type of character (symbol/number/uppercase) for a strong password.';
  else label = 'Strong password';

  return { score, label, ok: score >= 50 && pw.length >= 8 };
}

function isPasswordStrongEnough(pw) {
  return evaluatePasswordStrength(pw).ok;
}

/* Sessions */

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,datetime('now', '+${SESSION_DAYS} days'))`)
    .run(token, userId);
  return token;
}

function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

// A cross-origin frontend (FRONTEND_ORIGIN set) only receives the session
// cookie if it's SameSite=None, and None requires the Secure flag.
function cookieSameSite() {
  return process.env.FRONTEND_ORIGIN ? 'None; Secure' : 'Lax';
}

function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=${cookieSameSite()}; Max-Age=${SESSION_DAYS * 24 * 3600}`;
}

function expiredCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=${cookieSameSite()}; Max-Age=0`;
}

// Populates req.sessionToken / req.user when a valid session cookie is present.
function attachUser(req, _res, next) {
  req.user = null;
  req.sessionToken = null;
  const token = parseCookies(req)[COOKIE_NAME];
  if (token) {
    const row = db.prepare(`
      SELECT u.id, u.name, u.email, u.standard, u.division, u.board, u.ai_worker_url,
             u.gemini_api_key, u.credits, u.last_daily_goal_date
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at >= datetime('now')
    `).get(token);
    if (row) {
      req.user = row;
      req.sessionToken = token;
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'not_authenticated' });
  next();
}

module.exports = {
  COOKIE_NAME, parseCookies, createSession, destroySession,
  sessionCookie, expiredCookie, attachUser, requireAuth,
  evaluatePasswordStrength, isPasswordStrongEnough,
};
