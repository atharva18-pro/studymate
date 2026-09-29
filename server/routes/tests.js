'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { spendCredits, earnCredits } = require('../credits');
const { getQuestionsForTopic, publicQuestions } = require('../questions');
const { AI_COSTS, REWARDS, PASS_MARK } = require('../constants');
const { buildState } = require('../state');

const router = express.Router();
router.use(requireAuth);

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

function notEnoughCredits(res, err) {
  return res.status(402).json({
    error: 'not_enough_credits',
    credits: err.credits,
    required: err.required,
    message: 'Generating a test costs ' + err.required + ' credits, but you only have ' + err.credits + ' left. Earn more by passing tests, completing chapters, or hitting your daily study goal.',
  });
}

// Start a test: charges credits, generates questions server-side and stores
// them (with answers) in a pending row the client never sees.
router.post('/tests/start', (req, res) => {
  const body = req.body || {};
  const difficulty = String(body.difficulty || 'easy');
  if (!VALID_DIFFICULTIES.includes(difficulty)) {
    return res.status(400).json({ error: 'validation', message: 'Unknown difficulty.' });
  }

  const chapterId = body.chapterId ? Number(body.chapterId) : null;
  let chapter = null, subject = null;

  if (chapterId) {
    const row = db.prepare(`
      SELECT c.id AS chapter_id, c.name AS chapter_name, s.id AS subject_id, s.name AS subject_name
      FROM chapters c JOIN subjects s ON s.id = c.subject_id
      WHERE c.id = ? AND s.user_id = ?
    `).get(chapterId, req.user.id);
    if (!row) return res.status(404).json({ error: 'not_found', message: 'Topic not found.' });
    chapter = row;
  }

  const effectiveDifficulty = chapter ? difficulty : 'easy';
  const title = chapter ? chapter.subject_name + ' — ' + chapter.chapter_name : 'Quick Study Test';
  const topicName = chapter ? chapter.chapter_name : 'your recent topics';

  try {
    spendCredits(req.user.id, AI_COSTS.test, 'AI-generated test — ' + title);
  } catch (e) {
    if (e.code === 'not_enough_credits') return notEnoughCredits(res, e);
    throw e;
  }

  const questions = getQuestionsForTopic(topicName, effectiveDifficulty);
  const res2 = db.prepare(`
    INSERT INTO tests (user_id, chapter_id, title, difficulty, questions_json)
    VALUES (?,?,?,?,?)
  `).run(req.user.id, chapterId, title, effectiveDifficulty, JSON.stringify(questions));

  res.status(201).json({
    testId: Number(res2.lastInsertRowid),
    title,
    difficulty: effectiveDifficulty,
    passMark: PASS_MARK[effectiveDifficulty],
    questions: publicQuestions(questions),
  });
});

// Grade a pending test, then apply chapter progress and rewards atomically.
router.post('/tests/:id/submit', (req, res) => {
  const testId = Number(req.params.id);
  const answers = (req.body || {}).answers;
  if (!Array.isArray(answers)) return res.status(400).json({ error: 'validation', message: 'answers must be an array.' });

  const test = db.prepare('SELECT * FROM tests WHERE id = ? AND user_id = ?').get(testId, req.user.id);
  if (!test) return res.status(404).json({ error: 'not_found', message: 'Test not found.' });
  if (test.status !== 'pending') return res.status(409).json({ error: 'already_submitted', message: 'This test was already submitted.' });

  const questions = JSON.parse(test.questions_json);
  let score = 0;
  questions.forEach((q, i) => {
    if (Number(answers[i]) === q.answer) score++;
  });
  const percentage = Math.round((score / questions.length) * 100);
  const passed = percentage >= PASS_MARK[test.difficulty] ? 1 : 0;

  const rewards = [];
  let wasAlreadyComplete = false;

  db.exec('BEGIN IMMEDIATE');
  try {
    const upd = db.prepare(`UPDATE tests SET status='submitted', submitted_at=datetime('now'), score=?, total=?, percentage=?, passed=? WHERE id=? AND status='pending'`)
      .run(score, questions.length, percentage, passed, testId);
    if (upd.changes === 0) {
      const err = new Error('This test was already submitted.');
      err.code = 'already_submitted';
      throw err;
    }

    if (test.chapter_id) {
      const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(test.chapter_id);
      if (chapter) {
        if (test.difficulty === 'easy') {
          if (passed) {
            wasAlreadyComplete = !!chapter.test_passed;
            db.prepare(`UPDATE chapters SET test_passed=1, level='easy', failed_easy=0 WHERE id=?`).run(chapter.id);
          } else {
            db.prepare('UPDATE chapters SET failed_easy=1 WHERE id=?').run(chapter.id);
          }
        } else if (test.difficulty === 'medium' && passed) {
          db.prepare(`UPDATE chapters SET level='medium', failed_easy=0 WHERE id=?`).run(chapter.id);
        } else if (test.difficulty === 'hard' && passed) {
          db.prepare(`UPDATE chapters SET level='hard', failed_easy=0 WHERE id=?`).run(chapter.id);
          // Re-passing hard still counts as a passed test (matches original behaviour).
        }
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) { /* ignore */ }
    if (e.code === 'already_submitted') {
      return res.status(409).json({ error: 'already_submitted', message: 'This test was already submitted.' });
    }
    throw e;
  }

  // Credits live outside the grading transaction; each entry is itself atomic.
  if (passed) {
    if (test.difficulty === 'easy') {
      earnCredits(req.user.id, REWARDS.passEasy, 'Passed easy test — ' + test.title);
      rewards.push({ amount: REWARDS.passEasy, reason: 'Passed easy test' });
      if (test.chapter_id && !wasAlreadyComplete) {
        earnCredits(req.user.id, REWARDS.completeChapter, 'Completed chapter — ' + test.title);
        rewards.push({ amount: REWARDS.completeChapter, reason: 'Completed chapter' });
      }
    } else if (test.difficulty === 'medium') {
      earnCredits(req.user.id, REWARDS.passMedium, 'Passed medium test — ' + test.title);
      rewards.push({ amount: REWARDS.passMedium, reason: 'Passed medium test' });
    }
  }

  res.json({
    result: {
      testId, title: test.title, difficulty: test.difficulty,
      score, total: questions.length, percentage, passed: !!passed,
      chapterId: test.chapter_id, passMark: PASS_MARK[test.difficulty],
      wasAlreadyComplete, rewards,
    },
    state: buildState(req.user.id),
  });
});

module.exports = router;
