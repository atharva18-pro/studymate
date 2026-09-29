'use strict';

const db = require('./db');
const { AI_COSTS, REWARDS, PASS_MARK } = require('./constants');

// Builds the complete client state bundle: profile, all content,
// stats, achievements and recent history.
function buildState(userId) {
  const user = db.prepare('SELECT id, name, email, standard, division, board, ai_worker_url, credits, last_daily_goal_date FROM users WHERE id = ?').get(userId);

  const subjects = db.prepare('SELECT id, name FROM subjects WHERE user_id = ? ORDER BY id').all(userId)
    .map(s => ({
      id: s.id,
      name: s.name,
      chapters: db.prepare('SELECT id, name, test_passed, level, failed_easy FROM chapters WHERE subject_id = ? ORDER BY position, id').all(s.id)
        .map(c => ({
          id: c.id, name: c.name,
          testPassed: !!c.test_passed,
          level: c.level,
          failedEasy: !!c.failed_easy,
        })),
    }));

  const tasks = db.prepare('SELECT id, text, done FROM tasks WHERE user_id = ? ORDER BY id DESC').all(userId)
    .map(t => ({ id: t.id, text: t.text, done: !!t.done }));

  const notes = db.prepare('SELECT id, title, text, created_at FROM notes WHERE user_id = ? ORDER BY id DESC').all(userId)
    .map(n => ({ id: n.id, title: n.title, text: n.text, createdAt: n.created_at }));

  const timetable = db.prepare('SELECT id, subject, time, date FROM timetable_entries WHERE user_id = ? ORDER BY date, time').all(userId)
    .map(e => ({ id: e.id, subject: e.subject, time: e.time, date: e.date }));

  const testsPassed = db.prepare('SELECT COUNT(*) AS c FROM tests WHERE user_id = ? AND passed = 1').get(userId).c;

  const testResults = db.prepare(`
    SELECT t.score, t.total, t.percentage, t.passed, t.difficulty, t.title, t.submitted_at AS submittedAt
    FROM tests t WHERE t.user_id = ? AND t.status = 'submitted'
    ORDER BY t.id DESC LIMIT 20
  `).all(userId);

  const ledger = db.prepare('SELECT change, reason, balance_after AS balanceAfter, created_at AS createdAt FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(userId);

  const chat = db.prepare('SELECT role, content, created_at AS createdAt FROM chat_messages WHERE user_id = ? ORDER BY id').all(userId);

  let totalChapters = 0, passedChapters = 0;
  for (const s of subjects) {
    for (const c of s.chapters) {
      totalChapters++;
      if (c.testPassed) passedChapters++;
    }
  }
  const progress = totalChapters === 0 ? 0 : Math.round((passedChapters / totalChapters) * 100);

  const hasHard = subjects.some(s => s.chapters.some(c => c.level === 'hard'));

  const achievements = [
    { name: '🌱 First Step', description: 'Create your first subject.', unlocked: subjects.length >= 1 },
    { name: '📝 First Test', description: 'Pass your first test.', unlocked: testsPassed >= 1 },
    { name: '🔥 5 Tests', description: 'Pass five tests.', unlocked: testsPassed >= 5 },
    { name: '⭐ Hard Mode', description: 'Pass a hard-level test.', unlocked: hasHard },
    { name: '📚 50% Progress', description: 'Reach 50% topic progress.', unlocked: progress >= 50 },
    { name: '🏆 Master', description: 'Reach 100% topic progress.', unlocked: progress >= 100 },
  ];

  return {
    user: {
      name: user.name, email: user.email, standard: user.standard,
      division: user.division, board: user.board,
      aiWorkerUrl: user.ai_worker_url, credits: user.credits,
      lastDailyGoalDate: user.last_daily_goal_date,
    },
    subjects, tasks, notes, timetable,
    testsPassed, testResults, progress, achievements,
    ledger, chat,
    constants: { AI_COSTS, REWARDS, PASS_MARK },
  };
}

// Map of chapter name -> subject name, used by the AI engine for topic matching.
function knownTopicsFor(userId) {
  const rows = db.prepare(`
    SELECT c.name AS chapter, s.name AS subject
    FROM chapters c JOIN subjects s ON s.id = c.subject_id
    WHERE s.user_id = ?
  `).all(userId);
  const map = {};
  for (const r of rows) if (!map[r.chapter]) map[r.chapter] = r.subject;
  return map;
}

module.exports = { buildState, knownTopicsFor };
