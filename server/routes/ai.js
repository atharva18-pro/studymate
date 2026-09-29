'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { spendCredits } = require('../credits');
const { AI_COSTS } = require('../constants');
const { getAIResponse, classifyAIRequestType } = require('../ai-engine');
const { knownTopicsFor, buildState } = require('../state');

const router = express.Router();
router.use(requireAuth);

const LABELS = { simple: 'AI question', detailed: 'Detailed explanation', studyPlan: 'AI study plan', test: 'AI-generated test' };

/* Optional "real AI" backends, configured server-side:
   - AI_WORKER_URL: a self-hosted endpoint (e.g. the Cloudflare Worker from
     the original app) that accepts POST {question} and returns {answer}.
   - OPENAI_API_KEY: uses the OpenAI chat completions API with a study-tutor
     system prompt. OPENAI_MODEL defaults to gpt-4o-mini.
   A per-user worker URL (saved via /api/ai/settings) takes precedence. */

async function askRealAI(question, user) {
  const workerUrl = (user.ai_worker_url || process.env.AI_WORKER_URL || '').trim();
  if (workerUrl) {
    const res = await fetchWithTimeout(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const json = await res.json();
    if (!res.ok || !json.answer) throw new Error('worker returned no answer');
    return String(json.answer);
  }

  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (apiKey) {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are StudyMate, a friendly AI teacher for ' +
              (user.standard ? 'a ' + user.standard + ' standard student' : 'a school student') +
              '. Give clear, encouraging, age-appropriate study help. Keep answers concise (under 250 words) and use plain text.',
          },
          { role: 'user', content: question },
        ],
        max_tokens: 500,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.choices || !json.choices[0]) throw new Error('openai error: ' + (json.error && json.error.message ? json.error.message : res.status));
    return String(json.choices[0].message.content).trim();
  }

  return null; // no real AI configured
}

function fetchWithTimeout(url, options, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

router.post('/ai/ask', async (req, res) => {
  const question = String((req.body || {}).question || '').trim();
  if (!question) return res.status(400).json({ error: 'validation', message: 'Ask a question first.' });
  if (question.length > 2000) return res.status(400).json({ error: 'validation', message: 'Question is too long.' });

  const topics = knownTopicsFor(req.user.id);
  const requestType = classifyAIRequestType(question, topics);
  const cost = AI_COSTS[requestType];

  let balance;
  try {
    balance = spendCredits(req.user.id, cost, LABELS[requestType] || 'AI question');
  } catch (e) {
    if (e.code === 'not_enough_credits') {
      return res.status(402).json({
        error: 'not_enough_credits', credits: e.credits, required: e.required,
        message: 'This costs ' + e.required + ' credit' + (e.required === 1 ? '' : 's') + ', but you only have ' + e.credits + ' left. Earn more by passing tests, completing chapters, or hitting your daily study goal.',
      });
    }
    throw e;
  }

  let answer;
  let usedRealAI = false;
  try {
    const real = await askRealAI(question, req.user);
    if (real) { answer = real; usedRealAI = true; }
  } catch (e) {
    answer = null;
  }
  if (!answer) {
    answer = getAIResponse(question, topics, req.user.standard);
    if (usedRealAI === false && (req.user.ai_worker_url || process.env.AI_WORKER_URL || process.env.OPENAI_API_KEY)) {
      answer = "⚠️ Couldn't reach the connected AI, so here's the built-in answer instead:\n\n" + answer;
    }
  }

  const insertMsg = db.prepare('INSERT INTO chat_messages (user_id, role, content) VALUES (?,?,?)');
  insertMsg.run(req.user.id, 'user', question);
  insertMsg.run(req.user.id, 'assistant', answer);

  res.json({ answer, requestType, credits: balance });
});

router.post('/ai/settings', (req, res) => {
  let url = String((req.body || {}).workerUrl || '').trim();
  if (url && !/^https:\/\/.+/.test(url)) {
    return res.status(400).json({ error: 'validation', message: "That doesn't look like a valid https:// URL — double check it." });
  }
  if (url.length > 500) url = url.slice(0, 500);
  db.prepare('UPDATE users SET ai_worker_url = ? WHERE id = ?').run(url, req.user.id);
  res.json({ ok: true, workerUrl: url, state: buildState(req.user.id) });
});

module.exports = router;
