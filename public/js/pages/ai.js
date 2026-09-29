import { api } from '../api.js';
import { getState } from '../store.js';
import { escapeHTML, showInfoModal, showCreditToast } from '../ui.js';
import { showPage } from '../nav.js';
import { syncChrome } from '../chrome.js';

let readAloud = false;
let recognition = null;
let listening = false;
let greetingShown = false;

const SPEND_LABELS = {
  simple: 'simple question',
  detailed: 'detailed explanation',
  studyPlan: 'study plan',
};

export function renderChat() {
  const s = getState();
  const box = document.getElementById('chatBox');
  if (!s || s.chat.length === 0) {
    box.innerHTML = '<div class="message ai-msg">Hi! I\'m your StudyMate AI Teacher. 📚 Ask me to explain any chapter, make a study plan, give revision tips, or help with a subject like Maths, Science, Social Science or English.</div>';
    greetingShown = true;
    return;
  }
  greetingShown = false;
  box.innerHTML = s.chat.map(m =>
    '<div class="message ' + (m.role === 'user' ? 'user-msg' : 'ai-msg') + '">' + escapeHTML(m.content) + '</div>'
  ).join('');
  box.scrollTop = box.scrollHeight;
}

export function appendChatBubble(role, text) {
  const box = document.getElementById('chatBox');
  if (greetingShown) { box.innerHTML = ''; greetingShown = false; }
  const div = document.createElement('div');
  div.className = 'message ' + (role === 'user' ? 'user-msg' : 'ai-msg');
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

export function updateAIPageCredits() {
  const s = getState();
  if (s) document.getElementById('aiPageCredits').textContent = s.user.credits;
}

export function refreshAISettingsUI() {
  const s = getState();
  if (!s) return;
  const hasWorker = !!s.user.aiWorkerUrl;
  document.getElementById('aiConnectBanner').style.display = hasWorker ? 'none' : 'block';
  const input = document.getElementById('aiWorkerUrlInput');
  if (input && !input.value) input.value = s.user.aiWorkerUrl || '';
}

export function toggleAISettingsBox() {
  const box = document.getElementById('aiSettingsBox');
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

export async function askAI(question) {
  const s = getState();
  const input = document.getElementById('aiInput');
  const q = (question !== undefined ? question : input.value).trim();
  if (!q) return;
  if (question === undefined) input.value = '';

  appendChatBubble('user', q);
  const thinking = appendChatBubble('assistant', '🤔 Thinking...');

  let res;
  try {
    res = await api('/api/ai/ask', { method: 'POST', body: { question: q } });
  } catch (e) {
    thinking.remove();
    if (e.code === 'not_enough_credits') {
      showInfoModal('Not enough AI credits', e.message);
      appendChatBubble('assistant', 'You\'re out of AI credits for now — pass tests, complete chapters or finish a task to earn more!');
    } else {
      showInfoModal('AI Teacher error', e.message);
      appendChatBubble('assistant', 'Something went wrong answering that — please try again.');
    }
    return;
  }

  s.user.credits = res.credits;
  syncChrome();

  const label = SPEND_LABELS[res.requestType] || 'question';
  const cost = s.constants.AI_COSTS[res.requestType] || 1;
  showCreditToast('-' + cost + ' credits — ' + label, 'spend');

  thinking.textContent = res.answer;
  document.getElementById('chatBox').scrollTop = document.getElementById('chatBox').scrollHeight;
  if (readAloud) speak(res.answer);
}

export function explainTopic(topic) {
  showPage('ai');
  document.getElementById('aiInput').value = 'Explain ' + topic;
  askAI('Explain ' + topic);
}

/* ----- Read answers aloud ----- */

export function toggleReadAloud() {
  readAloud = !readAloud;
  const btn = document.getElementById('readAloudToggle');
  btn.textContent = (readAloud ? '🔊' : '🔈') + ' Read Answers Aloud: ' + (readAloud ? 'On' : 'Off');
  btn.classList.toggle('active', readAloud);
  const status = document.getElementById('voiceStatus');
  if (readAloud && !('speechSynthesis' in window)) {
    status.textContent = 'Read-aloud is not supported by this browser.';
    readAloud = false;
    btn.textContent = '🔈 Read Answers Aloud: Off';
    btn.classList.remove('active');
    return;
  }
  status.textContent = readAloud ? 'AI answers will be spoken out loud.' : '';
  if (!readAloud && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '');
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

/* ----- Voice input ----- */

export function toggleVoiceInput() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const status = document.getElementById('voiceStatus');
  const micBtn = document.getElementById('micBtn');
  if (!SR) {
    status.textContent = 'Voice input is not supported by this browser — please type your question.';
    return;
  }
  if (listening) {
    recognition.stop();
    return;
  }
  recognition = new SR();
  recognition.lang = 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    micBtn.classList.add('listening');
    status.textContent = 'Listening... speak now.';
  };
  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    document.getElementById('aiInput').value = transcript;
    status.textContent = '';
    askAI();
  };
  recognition.onerror = (e) => {
    status.textContent = e.error === 'not-allowed'
      ? 'Microphone access was blocked — allow it in the browser to use voice input.'
      : 'Voice input failed — please type instead.';
  };
  recognition.onend = () => {
    listening = false;
    micBtn.classList.remove('listening');
    if (status.textContent === 'Listening... speak now.') status.textContent = '';
  };
  recognition.start();
}

/* ----- AI backend settings ----- */

export async function saveAISettings() {
  const url = document.getElementById('aiWorkerUrlInput').value.trim();
  const status = document.getElementById('aiSettingsStatus');
  try {
    const res = await api('/api/ai/settings', { method: 'POST', body: { workerUrl: url } });
    getState().user.aiWorkerUrl = res.workerUrl;
    status.textContent = res.workerUrl ? 'Connected — the AI Teacher will use your worker.' : 'Cleared — using the built-in study assistant.';
    refreshAISettingsUI();
  } catch (e) {
    status.textContent = e.message;
  }
}
