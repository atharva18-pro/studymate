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

router.post('/tasks', async (req, res) => {
  const text = String((req.body || {}).text || '').trim();
  if (!text) return res.status(400).json({ error: 'validation', message: 'Enter a task.' });
  await db.run('INSERT INTO tasks (user_id, text) VALUES (?,?)', [req.user.id, text]);
  res.status(201).json(await buildState(req.user.id));
});

router.put('/tasks/:id/toggle', async (req, res) => {
  const id = Number(req.params.id);
  const task = await db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (!task) return res.status(404).json({ error: 'not_found' });

  const nowDone = task.done ? 0 : 1;
  await db.run('UPDATE tasks SET done = ? WHERE id = ?', [nowDone, id]);

  // First task completed each day pays the daily-goal bonus.
  if (nowDone === 1) {
    const today = new Date().toISOString().slice(0, 10);
    if (req.user.last_daily_goal_date !== today) {
      await db.run('UPDATE users SET last_daily_goal_date = ? WHERE id = ?', [today, req.user.id]);
      await earnCredits(req.user.id, REWARDS.dailyGoal, 'Completed daily study goal');
    }
  }
  res.json(await buildState(req.user.id));
});

router.delete('/tasks/:id', async (req, res) => {
  await db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
  res.json(await buildState(req.user.id));
});

/* ---------- Notes ---------- */

router.post('/notes', async (req, res) => {
  const { title, text } = req.body || {};
  if (!String(title || '').trim() || !String(text || '').trim()) {
    return res.status(400).json({ error: 'validation', message: 'Add a title and some text to your note.' });
  }
  await db.run('INSERT INTO notes (user_id, title, text) VALUES (?,?,?)',
    [req.user.id, String(title).trim(), String(text).trim()]);
  res.status(201).json(await buildState(req.user.id));
});

router.delete('/notes/:id', async (req, res) => {
  await db.run('DELETE FROM notes WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
  res.json(await buildState(req.user.id));
});

/* ---------- Time table ---------- */

router.post('/timetable', async (req, res) => {
  const { subject, time, date } = req.body || {};
  if (!String(subject || '').trim()) return res.status(400).json({ error: 'validation', message: 'Enter a subject.' });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ''))) return res.status(400).json({ error: 'validation', message: 'Invalid time.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return res.status(400).json({ error: 'validation', message: 'Invalid date.' });

  await db.run('INSERT INTO timetable_entries (user_id, subject, time, date) VALUES (?,?,?,?)',
    [req.user.id, String(subject).trim(), time, date]);
  res.status(201).json(await buildState(req.user.id));
});

router.delete('/timetable/:id', async (req, res) => {
  await db.run('DELETE FROM timetable_entries WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
  res.json(await buildState(req.user.id));
});

module.exports = router;
