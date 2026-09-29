'use strict';

const path = require('path');
const express = require('express');

const { attachUser } = require('./auth');
const { router: authRouter } = require('./routes/auth');
const subjectsRouter = require('./routes/subjects');
const testsRouter = require('./routes/tests');
const contentRouter = require('./routes/content');
const aiRouter = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.set('trust proxy', true);

// Security headers (CSP allows inline styles for the UI's style attributes,
// but scripts must come from files — the frontend uses ES modules).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
  ].join('; '));
  next();
});

// CORS — only active when the frontend is hosted on a different origin
// (static site on Vercel + this API on another host). FRONTEND_ORIGIN is a
// comma-separated list; when unset, requests stay same-origin as before.
const ALLOWED_ORIGINS = (process.env.FRONTEND_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type');
      return res.status(204).end();
    }
  }
  next();
});

app.use(express.json({ limit: '256kb' }));
app.use(attachUser);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api', subjectsRouter);
app.use('/api', testsRouter);
app.use('/api', contentRouter);
app.use('/api', aiRouter);

// Static frontend + PWA files.
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, { maxAge: '1h', index: 'index.html' }));
app.get('/manifest.webmanifest', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'manifest.webmanifest')));
app.get('/sw.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(PUBLIC_DIR, 'sw.js'));
});

// SPA fallback (non-API GET requests serve the app shell).
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// JSON 404 for unknown API routes.
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// Central error handler — never leak stack traces to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'bad_json', message: 'Invalid JSON body.' });
  }
  console.error('[server error]', err);
  res.status(500).json({ error: 'server_error', message: 'Something went wrong on our side — please try again.' });
});

app.listen(PORT, () => {
  console.log('📚 StudyMate server running at http://localhost:' + PORT);
});
