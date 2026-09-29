import { api } from './api.js';
import { setState } from './store.js';
import { showPage } from './nav.js';
import { renderAll } from './render.js';
import {
  openSubjectDetail, closeSubjectDetail,
  confirmTopicOver, addSubject, loadAllSubjects,
} from './pages/subjects.js';
import {
  startChapterTest, startQuickTest, submitTest,
} from './pages/tests.js';
import {
  askAI, explainTopic, toggleVoiceInput, toggleReadAloud,
  toggleAISettingsBox, saveAISettings,
} from './pages/ai.js';
import { addTask, toggleTask, deleteTask } from './pages/tasks.js';
import { saveNote } from './pages/notes.js';
import { addTimetableEntry, deleteTimetableEntry } from './pages/timetable.js';

/* ============== THEME ============== */

function applyThemeIcon() {
  const current = document.documentElement.getAttribute('data-theme');
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effective = current ? current : (dark ? 'dark' : 'light');
  document.getElementById('themeBtn').textContent = effective === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const next = (current ? current : (dark ? 'dark' : 'light')) === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  applyThemeIcon();
  try { localStorage.setItem('studymateTheme', next); } catch (_) { /* private mode */ }
}

/* ============== LOGIN / REGISTER ============== */

const COMMON_WEAK_PASSWORDS = ['123456', 'password', '12345678', 'qwerty', 'abc123', '111111', '123123', 'password1', 'letmein', 'iloveyou', 'admin', 'welcome', 'monkey', 'dragon', 'football', '000000', '123456789', '1234567890'];

let loginMode = 'signin'; // or 'register'

function evaluatePasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: 'var(--danger)' };
  const lower = pw.toLowerCase();
  if (COMMON_WEAK_PASSWORDS.indexOf(lower) > -1 || (pw.length > 0 && /^(.)\1+$/.test(pw))) {
    return { score: 5, label: 'Too common — easily guessed. Try something more unique.', color: 'var(--danger)' };
  }
  let score = 0;
  if (pw.length >= 8) score += 25;
  if (pw.length >= 12) score += 15;
  if (/[a-z]/.test(pw)) score += 10;
  if (/[A-Z]/.test(pw)) score += 15;
  if (/[0-9]/.test(pw)) score += 15;
  if (/[^A-Za-z0-9]/.test(pw)) score += 20;
  score = Math.min(score, 100);

  let label, color;
  if (pw.length < 8) { label = 'Too short — add more characters to make it harder to crack.'; color = 'var(--danger)'; }
  else if (score < 50) { label = 'Weak — add a number, a symbol, or an uppercase letter to make it harder.'; color = 'var(--danger)'; }
  else if (score < 80) { label = 'Getting better — add one more type of character (symbol/number/uppercase) for a strong password.'; color = 'var(--warn)'; }
  else { label = 'Strong password ✅'; color = 'var(--good)'; }
  return { score, label, color };
}

function isPasswordStrongEnough(pw) {
  const lower = pw.toLowerCase();
  if (pw.length < 8) return false;
  if (COMMON_WEAK_PASSWORDS.indexOf(lower) > -1) return false;
  if (/^(.)\1+$/.test(pw)) return false;
  return evaluatePasswordStrength(pw).score >= 50;
}

function setLoginMode(mode) {
  loginMode = mode;
  const isRegister = mode === 'register';
  document.getElementById('tabSignIn').classList.toggle('active', !isRegister);
  document.getElementById('tabRegister').classList.toggle('active', isRegister);
  document.getElementById('registerFields').style.display = isRegister ? 'block' : 'none';
  document.getElementById('generatePwBtn').style.display = isRegister ? 'inline-block' : 'none';
  document.getElementById('loginSubmitBtn').textContent = isRegister ? 'Create Account' : 'Sign In';
  document.getElementById('loginPassword').setAttribute('autocomplete', isRegister ? 'new-password' : 'current-password');
  if (!isRegister) {
    document.getElementById('passwordStrengthWrap').style.display = 'none';
    document.getElementById('pwGeneratedHint').style.display = 'none';
  } else {
    checkPasswordStrength();
  }
  document.getElementById('loginError').textContent = '';
}

function checkPasswordStrength() {
  const pw = document.getElementById('loginPassword').value;
  const wrap = document.getElementById('passwordStrengthWrap');
  const bar = document.getElementById('passwordStrengthBar');
  const label = document.getElementById('passwordStrengthLabel');
  if (!pw || loginMode !== 'register') { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  const result = evaluatePasswordStrength(pw);
  bar.style.width = result.score + '%';
  bar.style.background = result.color;
  label.textContent = result.label;
  label.style.color = result.color;
}

function togglePasswordVisibility() {
  const input = document.getElementById('loginPassword');
  const btn = document.getElementById('togglePwBtn');
  if (input.type === 'password') { input.type = 'text'; btn.textContent = '🙈'; }
  else { input.type = 'password'; btn.textContent = '👁️'; }
}

function generateStrongPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*()-_=+?';
  const all = upper + lower + digits + symbols;

  function randomInt(max) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] % max;
  }

  const chars = [upper[randomInt(upper.length)], lower[randomInt(lower.length)], digits[randomInt(digits.length)], symbols[randomInt(symbols.length)]];
  while (chars.length < 14) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const t = chars[i]; chars[i] = chars[j]; chars[j] = t;
  }

  const password = chars.join('');
  const input = document.getElementById('loginPassword');
  input.value = password;
  input.type = 'text';
  document.getElementById('togglePwBtn').textContent = '🙈';
  checkPasswordStrength();
  document.getElementById('pwGeneratedHint').style.display = 'block';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(password).catch(() => {});
  }
}

function toggleOtherBoardInput() {
  const select = document.getElementById('loginBoard');
  document.getElementById('otherBoardWrap').style.display = select.value === 'Other' ? 'block' : 'none';
}

async function submitLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const error = document.getElementById('loginError');

  let body;
  if (loginMode === 'register') {
    const name = document.getElementById('loginName').value.trim();
    const standard = document.getElementById('loginStandard').value;
    const division = document.getElementById('loginClass').value.trim();
    const boardSelect = document.getElementById('loginBoard').value;
    const boardOther = document.getElementById('loginBoardOther').value.trim();
    const board = boardSelect === 'Other' ? boardOther : boardSelect;

    if (name === '') { error.textContent = 'Please enter your name.'; return; }
    if (standard === '') { error.textContent = 'Please select your standard.'; return; }
    if (division === '') { error.textContent = 'Please enter your class / division.'; return; }
    if (boardSelect === '') { error.textContent = 'Please select your board.'; return; }
    if (boardSelect === 'Other' && boardOther === '') { error.textContent = 'Please type your board\'s name.'; return; }
    if (!email.includes('@')) { error.textContent = 'Please enter a valid email address.'; return; }
    if (password.length < 8) { error.textContent = 'Password must be at least 8 characters long.'; return; }
    if (!isPasswordStrongEnough(password)) { error.textContent = 'This password is too easy to guess — make it harder (mix uppercase, numbers and a symbol).'; return; }
    body = { name, email, password, standard, division, board };
  } else {
    if (!email.includes('@')) { error.textContent = 'Please enter a valid email address.'; return; }
    if (!password) { error.textContent = 'Please enter your password.'; return; }
    body = { email, password };
  }

  error.textContent = '';
  const btn = document.getElementById('loginSubmitBtn');
  btn.disabled = true;
  try {
    const state = await api('/api/auth/' + (loginMode === 'register' ? 'register' : 'login'), { method: 'POST', body });
    setState(state);
    showApp();
  } catch (e) {
    if (e.code === 'email_taken') error.textContent = 'An account with this email already exists — switch to Sign In.';
    else if (e.code === 'weak_password') error.textContent = e.message;
    else if (e.code === 'bad_credentials') error.textContent = 'Wrong email or password. New here? Switch to Create Account.';
    else error.textContent = e.message || 'Something went wrong — please try again.';
  } finally {
    btn.disabled = false;
  }
}

async function logout() {
  try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch (_) { /* session is gone anyway */ }
  window.location.reload();
}

/* ============== APP SHELL ============== */

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  renderAll();
  showPage('dashboard');
}

function openAI() {
  showPage('ai');
  const input = document.getElementById('aiInput');
  if (input) input.focus();
}

/* ============== GLOBAL EVENT DELEGATION ============== */

const ACTIONS = {
  'nav': (el) => showPage(el.dataset.page),
  'open-ai': () => openAI(),
  'logout': () => logout(),
  'add-subject': () => addSubject(),
  'load-all-subjects': () => loadAllSubjects(),
  'open-subject': (el) => openSubjectDetail(el.dataset.id),
  'close-subject-detail': () => closeSubjectDetail(),
  'topic-over': (el) => confirmTopicOver(el.dataset.chapterId, el.dataset.chapterName),
  'start-chapter-test': (el) => startChapterTest(Number(el.dataset.chapterId), el.dataset.difficulty),
  'start-quick-test': () => startQuickTest(),
  'submit-test': (el) => submitTest(el.dataset.testId),
  'quick-ask': (el) => askAI(el.dataset.question),
  'ask-ai': () => askAI(),
  'toggle-voice-input': () => toggleVoiceInput(),
  'toggle-read-aloud': () => toggleReadAloud(),
  'show-ai-settings': () => toggleAISettingsBox(),
  'save-ai-settings': () => saveAISettings(),
  'ai-explain': (el) => explainTopic(el.dataset.topic),
  'add-task': () => addTask(),
  'toggle-task': (el) => toggleTask(el.dataset.id),
  'delete-task': (el) => deleteTask(el.dataset.id),
  'save-note': () => saveNote(),
  'add-timetable': () => addTimetableEntry(),
  'delete-timetable': (el) => deleteTimetableEntry(el.dataset.id),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const handler = ACTIONS[el.dataset.action];
  if (handler) {
    e.preventDefault();
    handler(el);
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openAI();
  }
  if (e.key !== 'Enter') return;
  const id = e.target && e.target.id;
  if (id === 'subjectName') addSubject();
  else if (id === 'taskInput') addTask();
  else if (id === 'aiInput') askAI();
  else if (id === 'loginPassword' || id === 'loginEmail' || id === 'loginName') submitLogin();
});

/* ============== PWA: INSTALL + SERVICE WORKER ============== */

let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('installBtn').style.display = 'inline-block';
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  try { await deferredInstallPrompt.userChoice; } catch (_) { /* dismissed */ }
  deferredInstallPrompt = null;
  document.getElementById('installBtn').style.display = 'none';
});

if ('serviceWorker' in window && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline caching unavailable */ });
  });
}

/* ============== BOOT ============== */

function bindLoginUI() {
  document.getElementById('tabSignIn').addEventListener('click', () => setLoginMode('signin'));
  document.getElementById('tabRegister').addEventListener('click', () => setLoginMode('register'));
  document.getElementById('loginSubmitBtn').addEventListener('click', submitLogin);
  document.getElementById('togglePwBtn').addEventListener('click', togglePasswordVisibility);
  document.getElementById('generatePwBtn').addEventListener('click', generateStrongPassword);
  document.getElementById('loginPassword').addEventListener('input', checkPasswordStrength);
  document.getElementById('loginBoard').addEventListener('change', toggleOtherBoardInput);
  document.getElementById('themeBtn').addEventListener('click', toggleTheme);
}

async function boot() {
  try {
    const savedTheme = localStorage.getItem('studymateTheme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  } catch (_) { /* private mode */ }
  applyThemeIcon();
  bindLoginUI();
  setLoginMode('signin');

  try {
    const state = await api('/api/auth/me');
    setState(state);
    showApp();
  } catch (e) {
    document.getElementById('app').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
  }
}

boot();
