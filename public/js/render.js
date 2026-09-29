import { syncChrome } from './chrome.js';
import { renderSubjects } from './pages/subjects.js';
import { renderTasks } from './pages/tasks.js';
import { renderNotes } from './pages/notes.js';
import { renderTimetable } from './pages/timetable.js';
import { renderProgress, renderAchievements } from './pages/stats.js';
import { renderChat, refreshAISettingsUI } from './pages/ai.js';
import { resetTestArea } from './pages/tests.js';

export { syncChrome };

export function renderAll() {
  syncChrome();
  renderSubjects();
  renderTasks();
  renderNotes();
  renderTimetable();
  renderProgress();
  renderAchievements();
  renderChat();
  refreshAISettingsUI();
  resetTestArea();
}
