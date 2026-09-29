import { getState } from '../store.js';
import { escapeHTML } from '../ui.js';

export function renderProgress() {
  const s = getState();
  if (!s) return;
  document.getElementById('progressNumber').textContent = s.progress + '%';
  document.getElementById('progressBar').style.width = s.progress + '%';
}

export function renderAchievements() {
  const s = getState();
  if (!s) return;
  document.getElementById('achievementList').innerHTML = s.achievements.map(a =>
    '<div class="chapter"><span>' + (a.unlocked ? '🏆' : '🔒') + ' ' + escapeHTML(a.name) +
    '<br><small style="color:var(--muted)">' + escapeHTML(a.description) + '</small></span></div>'
  ).join('');
}
