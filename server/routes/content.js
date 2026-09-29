'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { earnCredits } = require('../credits');
const { REWARDS } = require('../constants');
const { buildState } = require('../state');

const router = express.Router();
router.use(requireAuth);

/* ---------- Tasks ---------- */

router.post('/tasks', (req, res) => {
  const text = String((req.body || {}).text || '').trim();
  if (!text) return res.status(400).json({ error: 'validation', message: 'Enter a task.' });
  db.prepare('INSERT INTO tasks (user_id, text) VALUES (?,?)').run(req.user.id, text);
  res.status(201).json(buildState(req.user.id));
});

router.put('/tasks/:id/toggle', (req, res) => {
  const id = Number(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!task) return res.status(404).json({ error: 'not_found' });

  const nowDone = task.done ? 0 : 1;
  db.prepare('UPDATE tasks SET done = ? WHERE id = ?').run(nowDone, id);

  // First task completed each day pays the daily-goal bonus.
  if (nowDone === 1) {
    const today = new Date().toISOString().slice(0, 10);
    if (req.user.last_daily_goal_date !== today) {
      db.prepare('UPDATE users SET last_daily_goal_date = ? WHERE id = ?').run(today, req.user.id);
      earnCredits(req.user.id, REWARDS.dailyGoal, 'Completed daily study goal');
    }
  }
  res.json(buildState(req.user.id));
});

router.delete('/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json(buildState(req.user.id));
});

/* ---------- Notes ---------- */

router.post('/notes', (req, res) => {
  const { title, text } = req.body || {};
  if (!String(title || '').trim() || !String(text || '').trim()) {
    return res.status(400).json({ error: 'validation', message: 'Add a title and some text to your note.' });
  }
  db.prepare('INSERT INTO notes (user_id, title, text) VALUES (?,?,?)')
    .run(req.user.id, String(title).trim(), String(text).trim());
  res.status(201).json(buildState(req.user.id));
});

router.delete('/notes/:id', (req, res) => {
  db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json(buildState(req.user.id));
});

/* ---------- Time table ---------- */

router.post('/timetable', (req, res) => {
  const { subject, time, date } = req.body || {};
  if (!String(subject || '').trim()) return res.status(400).json({ error: 'validation', message: 'Enter a subject.' });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ''))) return res.status(400).json({ error: 'validation', message: 'Invalid time.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return res.status(400).json({ error: 'validation', message: 'Invalid date.' });

  db.prepare('INSERT INTO timetable_entries (user_id, subject, time, date) VALUES (?,?,?,?)')
    .run(req.user.id, String(subject).trim(), time, date);
  res.status(201).json(buildState(req.user.id));
});

router.delete('/timetable/:id', (req, res) => {
  db.prepare('DELETE FROM timetable_entries WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json(buildState(req.user.id));
});

module.exports = router;
