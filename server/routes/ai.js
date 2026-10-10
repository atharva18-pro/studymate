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

/* Optional "real AI" backends, in priority order:
   1. Per-user Gemini API key (saved via /api/ai/settings) — calls Google's
      Gemini API directly (free key from https://aistudio.google.com/apikey).
   2. Per-user or server AI_WORKER_URL: a self-hosted endpoint (e.g. the
      Cloudflare Worker from the original app) that accepts POST {question}
      and returns {answer}.
   3. GEMINI_API_KEY env: same Gemini API for everyone on the server.
   4. OPENROUTER_API_KEY: OpenRouter's OpenAI-compatible API. OPENROUTER_MODEL
      defaults to google/gemini-2.5-flash.
   5. OPENAI_API_KEY: OpenAI chat completions. OPENAI_MODEL defaults to gpt-4o-mini. */

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

function tutorSystemPrompt(user) {
  return 'You are StudyMate, a friendly AI teacher for ' +
    (user.standard ? 'a ' + user.standard + ' standard student' : 'a school student') +
    '. Give clear, encouraging, age-appropriate study help. Keep answers concise (under 250 words) and use plain text.';
}

async function askGemini(apiKey, question, user) {
  // 60s: thinking flash models can take a while on cold start; Render's own
  // request timeout (~100s) stays clear of this.
  const res = await fetchWithTimeout('https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: tutorSystemPrompt(user) }] },
      contents: [{ role: 'user', parts: [{ text: question }] }],
    }),
  }, 60000);
  const json = await res.json();
  if (!res.ok) throw new Error('gemini error: ' + (json.error && json.error.message ? json.error.message : res.status));
  const parts = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts;
  const text = parts ? parts.map(p => p.text || '').join('') : '';
  if (!text.trim()) throw new Error('gemini returned no answer');
  return text.trim();
}

async function askRealAI(question, user) {
  const geminiKey = (user.gemini_api_key || '').trim();
  if (geminiKey) return askGemini(geminiKey, question, user);

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

  const envGeminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (envGeminiKey) return askGemini(envGeminiKey, question, user);

  const openRouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
  if (openRouterKey) {
    const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
    const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + openRouterKey },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: tutorSystemPrompt(user) },
          { role: 'user', content: question },
        ],
        max_tokens: 500,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.choices || !json.choices[0]) throw new Error('openrouter error: ' + (json.error && json.error.message ? json.error.message : res.status));
    return String(json.choices[0].message.content).trim();
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
          { role: 'system', content: tutorSystemPrompt(user) },
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

  const topics = await knownTopicsFor(req.user.id);
  const requestType = classifyAIRequestType(question, topics);
  const cost = AI_COSTS[requestType];

  let balance;
  try {
    balance = await spendCredits(req.user.id, cost, LABELS[requestType] || 'AI question');
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
    if (usedRealAI === false && (req.user.gemini_api_key || req.user.ai_worker_url || process.env.AI_WORKER_URL || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)) {
      answer = "⚠️ Couldn't reach the connected AI, so here's the built-in answer instead:\n\n" + answer;
    }
  }

  await db.batch([
    { sql: 'INSERT INTO chat_messages (user_id, role, content) VALUES (?,?,?)', args: [req.user.id, 'user', question] },
    { sql: 'INSERT INTO chat_messages (user_id, role, content) VALUES (?,?,?)', args: [req.user.id, 'assistant', answer] },
  ], 'write');

  res.json({ answer, requestType, credits: balance });
});

router.post('/ai/settings', async (req, res) => {
  let url = String((req.body || {}).workerUrl || '').trim();
  if (url && !/^https:\/\/.+/.test(url)) {
    return res.status(400).json({ error: 'validation', message: "That doesn't look like a valid https:// URL — double check it." });
  }
  if (url.length > 500) url = url.slice(0, 500);

  let geminiKey = String((req.body || {}).geminiKey || '').trim();
  if (geminiKey && !/^(AIza[0-9A-Za-z_-]{30,}|AQ\.[A-Za-z0-9_-]{20,})$/.test(geminiKey)) {
    return res.status(400).json({ error: 'validation', message: "That doesn't look like a Google AI API key — it should start with \"AIza\" or \"AQ.\"." });
  }

  await db.run('UPDATE users SET ai_worker_url = ?, gemini_api_key = ? WHERE id = ?', [url, geminiKey, req.user.id]);
  res.json({ ok: true, workerUrl: url, hasGeminiKey: !!geminiKey, state: await buildState(req.user.id) });
});

module.exports = router;
