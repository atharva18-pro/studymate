'use strict';

const express = require('express');
const db = require('../db');
const CURRICULUM = require('../curriculum');
const { requireAuth } = require('../auth');
const { buildState } = require('../state');

const router = express.Router();
router.use(requireAuth);

const SUBJECT_ALIASES = {
  math: 'Mathematics', maths: 'Mathematics', mathematics: 'Mathematics',
  science: 'Science', physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology', bio: 'Biology',
  english: 'English',
  'social science': 'Social Science', sst: 'Social Science', 'social studies': 'Social Science',
  economics: 'Economics', 'business studies': 'Business Studies', accountancy: 'Accountancy', accounts: 'Accountancy',
};

function normalizeSubjectName(name) {
  const key = name.trim().toLowerCase();
  if (SUBJECT_ALIASES[key]) return SUBJECT_ALIASES[key];
  return name.trim().replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getCurriculumChapters(standard, subjectName) {
  if (!standard || !CURRICULUM[standard]) return null;
  return CURRICULUM[standard][normalizeSubjectName(subjectName)] || null;
}

function insertSubjectWithChapters(userId, name, chapterNames) {
  const insertSubject = db.prepare('INSERT OR IGNORE INTO subjects (user_id, name) VALUES (?,?)');
  const insertChapter = db.prepare('INSERT INTO chapters (subject_id, name, position) VALUES (?,?,?)');
  const res = insertSubject.run(userId, name);
  if (res.changes === 0) return null;
  const subjectId = Number(res.lastInsertRowid);
  chapterNames.forEach((chName, i) => insertChapter.run(subjectId, chName, i));
  return subjectId;
}

router.post('/subjects', (req, res) => {
  const rawName = String((req.body || {}).name || '').trim();
  if (!rawName) return res.status(400).json({ error: 'validation', message: 'Enter a subject name.' });

  const displayName = normalizeSubjectName(rawName);
  const curriculumChapters = getCurriculumChapters(req.user.standard, rawName);
  const chapterNames = curriculumChapters || ['Chapter 1', 'Chapter 2', 'Chapter 3'];

  const subjectId = insertSubjectWithChapters(req.user.id, displayName, chapterNames);
  if (subjectId === null) {
    return res.status(409).json({ error: 'duplicate', message: 'You already have a subject called "' + displayName + '".' });
  }
  res.status(201).json(buildState(req.user.id));
});

router.post('/subjects/load-all', (req, res) => {
  const standard = req.user.standard;
  if (!standard || !CURRICULUM[standard]) {
    return res.status(400).json({ error: 'no_curriculum', message: 'No curriculum found for this standard yet.' });
  }
  const existing = new Set(db.prepare('SELECT name FROM subjects WHERE user_id = ?').all(req.user.id).map(r => r.name));
  for (const [name, chapters] of Object.entries(CURRICULUM[standard])) {
    if (!existing.has(name)) insertSubjectWithChapters(req.user.id, name, chapters);
  }
  res.json(buildState(req.user.id));
});

router.delete('/subjects/:id', (req, res) => {
  const id = Number(req.params.id);
  const subject = db.prepare('SELECT id FROM subjects WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!subject) return res.status(404).json({ error: 'not_found' });
  db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
  res.json(buildState(req.user.id));
});

module.exports = router;
