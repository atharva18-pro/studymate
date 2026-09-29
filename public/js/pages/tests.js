import { api } from '../api.js';
import { getState, adoptState } from '../store.js';
import { escapeHTML, showInfoModal, showCreditToast } from '../ui.js';
import { showPage } from '../nav.js';
import { syncChrome } from '../chrome.js';

// The test currently being taken (server-side row id + answer-stripped questions).
let currentTest = null;

const IDLE_HTML = '<p>Select a topic from Subjects to automatically start its adaptive test, or choose a quick test below.</p>' +
  '<br><button class="btn" data-action="start-quick-test">Start Quick Test (-5 ⚡)</button>';

export function resetTestArea() {
  currentTest = null;
  document.getElementById('testArea').innerHTML = IDLE_HTML;
}

function notEnoughCreditsModal(err) {
  showInfoModal('Not enough AI credits', err.message);
}

export async function startChapterTest(chapterId, difficulty) {
  let res;
  try {
    res = await api('/api/tests/start', { method: 'POST', body: { chapterId, difficulty } });
  } catch (e) {
    if (e.code === 'not_enough_credits') return notEnoughCreditsModal(e);
    return showInfoModal('Could not start test', e.message);
  }
  beginTest(res);
}

export async function startQuickTest() {
  let res;
  try {
    res = await api('/api/tests/start', { method: 'POST', body: { difficulty: 'easy' } });
  } catch (e) {
    if (e.code === 'not_enough_credits') return notEnoughCreditsModal(e);
    return showInfoModal('Could not start test', e.message);
  }
  beginTest(res);
}

function beginTest(res) {
  currentTest = res;
  const s = getState();
  // The server already charged the credits — reflect the new balance + toast.
  if (s) {
    s.user.credits = s.user.credits - s.constants.AI_COSTS.test;
    syncChrome();
    showCreditToast('-' + s.constants.AI_COSTS.test + ' credits — AI-generated test', 'spend');
  }

  let html = '<span class="difficulty-tag ' + res.difficulty + '">' + res.difficulty + ' level</span>' +
    '<h2>' + escapeHTML(res.title) + '</h2>' +
    '<p style="margin:10px 0 20px;color:var(--muted)">Answer all questions and submit the test.</p>';

  res.questions.forEach((question, index) => {
    html += '<div class="question"><h4>' + (index + 1) + '. ' + escapeHTML(question.q) + '</h4>';
    question.options.forEach((option, i) => {
      html += '<label class="option"><input type="radio" name="q' + index + '" value="' + i + '">' + escapeHTML(option) + '</label>';
    });
    html += '</div>';
  });

  html += '<button class="btn" data-action="submit-test" data-test-id="' + res.testId + '">Submit Test</button>';
  document.getElementById('testArea').innerHTML = html;
  showPage('tests');
}

export async function submitTest(testId) {
  if (!currentTest || currentTest.testId !== Number(testId)) {
    return showInfoModal('Test expired', 'This test is no longer active. Start a new one from the Subjects page.');
  }
  const answers = currentTest.questions.map((_q, index) => {
    const selected = document.querySelector('input[name="q' + index + '"]:checked');
    return selected ? Number(selected.value) : null;
  });

  let res;
  try {
    res = await api('/api/tests/' + testId + '/submit', { method: 'POST', body: { answers } });
  } catch (e) {
    if (e.code === 'already_submitted') {
      resetTestArea();
      return showInfoModal('Already submitted', e.message);
    }
    return showInfoModal('Could not submit test', e.message);
  }

  adoptState(res);
  syncChrome();
  renderResult(res.result);
}

function renderResult(r) {
  const s = getState();
  let html = '<div class="result">' +
    '<span class="difficulty-tag ' + r.difficulty + '">' + r.difficulty + ' level</span>' +
    '<h2>' + (r.passed ? '🎉 Test Passed' : '📖 Not Cleared Yet') + '</h2>' +
    '<h3>Score: ' + r.score + '/' + r.total + ' (' + r.percentage + '%)</h3>' +
    '<p style="margin-top:8px">Passing mark for ' + r.difficulty + ' level: ' + r.passMark + '%</p>';

  let nextButtons = '';
  const chapter = r.chapterId ? findChapter(r.chapterId) : null;

  if (chapter) {
    if (r.difficulty === 'easy') {
      if (r.passed) {
        html += '<p style="margin-top:10px">Nice work — this topic is marked complete and your dashboard progress has been updated. Want to challenge yourself further?</p>';
        nextButtons = '<button class="btn gold" data-action="start-chapter-test" data-chapter-id="' + chapter.id + '" data-difficulty="medium">Try Medium Test (optional)</button>' +
          '<button class="btn secondary" data-action="nav" data-page="subjects">Back to Subjects</button>' +
          '<button class="btn secondary" data-action="nav" data-page="dashboard">View Dashboard</button>';
      } else {
        html += '<p style="margin-top:10px">Let\'s go through the topic from the start before trying again.</p>';
        nextButtons = '<button class="btn" data-action="start-chapter-test" data-chapter-id="' + chapter.id + '" data-difficulty="easy">Retry Easy Test</button>' +
          '<button class="btn secondary" data-action="ai-explain" data-topic="' + escapeHTML(chapter.name) + '">AI Explain (-' + s.constants.AI_COSTS.detailed + ' ⚡)</button>';
      }
    } else if (r.difficulty === 'medium') {
      if (r.passed) {
        html += '<p style="margin-top:10px">Great — you\'ve leveled up to medium on this topic. Want to go further?</p>';
        nextButtons = '<button class="btn gold" data-action="start-chapter-test" data-chapter-id="' + chapter.id + '" data-difficulty="hard">Try Hard Test (optional)</button>' +
          '<button class="btn secondary" data-action="nav" data-page="subjects">Back to Subjects</button>' +
          '<button class="btn secondary" data-action="nav" data-page="dashboard">View Dashboard</button>';
      } else {
        html += '<p style="margin-top:10px">No worries — the medium test is optional, so your easy-level pass still stands. Try again whenever you like.</p>';
        nextButtons = '<button class="btn" data-action="start-chapter-test" data-chapter-id="' + chapter.id + '" data-difficulty="medium">Retry Medium Test</button>' +
          '<button class="btn secondary" data-action="nav" data-page="subjects">Back to Subjects</button>';
      }
    } else {
      if (r.passed) {
        html += '<p style="margin-top:10px">Excellent — you\'ve mastered this topic at hard level too.</p>';
      } else {
        html += '<p style="margin-top:10px">The hard test is optional — your medium-level pass already counts. Good attempt!</p>';
      }
      nextButtons = '<button class="btn secondary" data-action="nav" data-page="subjects">Back to Subjects</button>' +
        '<button class="btn secondary" data-action="nav" data-page="dashboard">View Dashboard</button>';
    }
  } else {
    nextButtons = '<button class="btn" data-action="start-quick-test">Try Again</button>' +
      '<button class="btn secondary" data-action="open-ai">Ask AI Teacher</button>';
    if (r.passed) {
      html += '<p style="margin-top:10px">Your dashboard has been updated with this result.</p>';
      nextButtons += '<button class="btn secondary" data-action="nav" data-page="dashboard">View Dashboard</button>';
    }
  }

  html += '</div>' + nextButtons;
  document.getElementById('testArea').innerHTML = html;
  currentTest = null;

  if (r.passed && r.rewards) {
    r.rewards.forEach(rew => showCreditToast('+' + rew.amount + ' credits — ' + rew.reason, 'earn'));
  }
}

function findChapter(chapterId) {
  const s = getState();
  for (const sub of (s ? s.subjects : [])) {
    const ch = sub.chapters.find(c => c.id === Number(chapterId));
    if (ch) return ch;
  }
  return null;
}
