import { getState } from '../store.js';

export function renderDashboard() {
  const s = getState();
  if (!s) return;
  const topicsTotal = s.subjects.reduce((n, sub) => n + sub.chapters.length, 0);
  const topicsDone = s.subjects.reduce((n, sub) => n + sub.chapters.filter(c => c.testPassed).length, 0);

  document.getElementById('dashSubjects').textContent = s.subjects.length;
  document.getElementById('dashTopics').textContent = topicsDone + '/' + topicsTotal;
  document.getElementById('dashTests').textContent = s.testsPassed;
  document.getElementById('dashProgress').textContent = s.progress + '%';
  document.getElementById('dashCredits').textContent = s.user.credits;
  document.getElementById('dashboardProgress').style.width = s.progress + '%';
}
