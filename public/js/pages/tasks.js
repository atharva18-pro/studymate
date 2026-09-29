import { api } from '../api.js';
import { getState, adoptState } from '../store.js';
import { escapeHTML, showInfoModal, showCreditToast } from '../ui.js';
import { syncChrome } from '../chrome.js';

export function renderTasks() {
  const s = getState();
  if (!s) return;
  const list = document.getElementById('taskList');
  if (s.tasks.length === 0) {
    list.innerHTML = '<p style="color:var(--muted)">No tasks yet.</p>';
    return;
  }
  list.innerHTML = s.tasks.map(task =>
    '<div class="chapter"><span style="display:flex;align-items:center;gap:10px">' +
    '<button class="icon-btn" style="background:#dc2626;color:#fff;padding:6px 10px" data-action="delete-task" data-id="' + task.id + '" title="Delete task">🗑️</button>' +
    '<span style="text-decoration:' + (task.done ? 'line-through' : 'none') + '">' + escapeHTML(task.text) + '</span>' +
    '</span>' +
    '<button data-action="toggle-task" data-id="' + task.id + '">' + (task.done ? 'Undo' : 'Done') + '</button></div>'
  ).join('');
}

export async function addTask() {
  const input = document.getElementById('taskInput');
  const text = input.value.trim();
  if (!text) return;
  try {
    const res = await api('/api/tasks', { method: 'POST', body: { text } });
    adoptState(res);
    input.value = '';
    renderTasks();
  } catch (e) {
    showInfoModal('Could not add task', e.message);
  }
}

export async function toggleTask(id) {
  try {
    const res = await api('/api/tasks/' + id + '/toggle', { method: 'PUT', body: {} });
    const before = getState().user.lastDailyGoalDate;
    adoptState(res);
    syncChrome();
    const after = getState().user.lastDailyGoalDate;
    if (after && before !== after) {
      showCreditToast('+' + getState().constants.REWARDS.dailyGoal + ' credits — Completed daily study goal', 'earn');
    }
    renderTasks();
  } catch (e) {
    showInfoModal('Could not update task', e.message);
  }
}

export async function deleteTask(id) {
  try {
    const res = await api('/api/tasks/' + id, { method: 'DELETE' });
    adoptState(res);
    renderTasks();
  } catch (e) {
    showInfoModal('Could not delete task', e.message);
  }
}
