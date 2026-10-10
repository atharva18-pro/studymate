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

// Subject + its chapters as one atomic batch; chapter rows find their subject
// through the UNIQUE (user_id, name) key.
function subjectBatchStatements(userId, name, chapterNames) {
  return [
    { sql: 'INSERT INTO subjects (user_id, name) VALUES (?,?)', args: [userId, name] },
    ...chapterNames.map((chName, i) => ({
      sql: 'INSERT INTO chapters (subject_id, name, position) VALUES ((SELECT id FROM subjects WHERE user_id = ? AND name = ?), ?, ?)',
      args: [userId, name, chName, i],
    })),
  ];
}

router.post('/subjects', async (req, res) => {
  const rawName = String((req.body || {}).name || '').trim();
  if (!rawName) return res.status(400).json({ error: 'validation', message: 'Enter a subject name.' });

  const displayName = normalizeSubjectName(rawName);
  const curriculumChapters = getCurriculumChapters(req.user.standard, rawName);
  const chapterNames = curriculumChapters || ['Chapter 1', 'Chapter 2', 'Chapter 3'];

  const existing = await db.get('SELECT id FROM subjects WHERE user_id = ? AND name = ?', [req.user.id, displayName]);
  if (existing) {
    return res.status(409).json({ error: 'duplicate', message: 'You already have a subject called "' + displayName + '".' });
  }

  try {
    await db.batch(subjectBatchStatements(req.user.id, displayName, chapterNames), 'write');
  } catch (e) {
    if (/UNIQUE constraint failed: subjects/i.test(e.message || '')) {
      return res.status(409).json({ error: 'duplicate', message: 'You already have a subject called "' + displayName + '".' });
    }
    throw e;
  }
  res.status(201).json(await buildState(req.user.id));
});

router.post('/subjects/load-all', async (req, res) => {
  const standard = req.user.standard;
  if (!standard || !CURRICULUM[standard]) {
    return res.status(400).json({ error: 'no_curriculum', message: 'No curriculum found for this standard yet.' });
  }
  const existing = new Set((await db.all('SELECT name FROM subjects WHERE user_id = ?', [req.user.id])).map(r => r.name));

  // One batch for everything missing. INSERT OR IGNORE + "subject has no
  // chapters yet" keep this idempotent even if it's clicked twice at once.
  const stmts = [];
  for (const [name, chapters] of Object.entries(CURRICULUM[standard])) {
    if (existing.has(name)) continue;
    stmts.push({ sql: 'INSERT OR IGNORE INTO subjects (user_id, name) VALUES (?,?)', args: [req.user.id, name] });
    chapters.forEach((chName, i) => {
      stmts.push({
        sql: `INSERT INTO chapters (subject_id, name, position)
              SELECT s.id, ?, ? FROM subjects s
              WHERE s.user_id = ? AND s.name = ? AND NOT EXISTS (SELECT 1 FROM chapters WHERE subject_id = s.id)`,
        args: [chName, i, req.user.id, name],
      });
    });
  }
  if (stmts.length) await db.batch(stmts, 'write');
  res.json(await buildState(req.user.id));
});

router.delete('/subjects/:id', async (req, res) => {
  const id = Number(req.params.id);
  const subject = await db.get('SELECT id FROM subjects WHERE id = ? AND user_id = ?', [id, req.user.id]);
  if (!subject) return res.status(404).json({ error: 'not_found' });

  await db.batch([
    { sql: 'UPDATE tests SET chapter_id = NULL WHERE chapter_id IN (SELECT id FROM chapters WHERE subject_id = ?)', args: [id] },
    { sql: 'DELETE FROM chapters WHERE subject_id = ?', args: [id] },
    { sql: 'DELETE FROM subjects WHERE id = ? AND user_id = ?', args: [id, req.user.id] },
  ], 'write');
  res.json(await buildState(req.user.id));
});

module.exports = router;
