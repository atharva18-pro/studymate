import { getState } from './store.js';
import { renderDashboard } from './pages/dashboard.js';
import { updateAIPageCredits } from './pages/ai.js';

// Top-bar credits badge, dashboard cards and profile chip.
export function syncChrome() {
  const s = getState();
  if (!s) return;
  document.getElementById('creditsCount').textContent = s.user.credits;
  document.getElementById('dashCredits').textContent = s.user.credits;
  updateAIPageCredits();
  document.getElementById('profileName').textContent = s.user.name;
  document.getElementById('profileClass').textContent =
    (s.user.standard ? s.user.standard + ' Std' : '') +
    (s.user.division ? ' · Div ' + s.user.division : '') +
    (s.user.board ? ' · ' + s.user.board : '');
  renderDashboard();
}
