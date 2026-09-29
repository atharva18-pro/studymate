import { api } from '../api.js';
import { getState, adoptState } from '../store.js';
import { escapeHTML, showInfoModal } from '../ui.js';

export async function saveNote() {
  const title = document.getElementById('noteTitle').value.trim();
  const text = document.getElementById('noteText').value.trim();
  if (!title || !text) return;
  try {
    const res = await api('/api/notes', { method: 'POST', body: { title, text } });
    adoptState(res);
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteText').value = '';
    renderNotes();
  } catch (e) {
    showInfoModal('Could not save note', e.message);
  }
}

export function renderNotes() {
  const s = getState();
  if (!s) return;
  document.getElementById('notesList').innerHTML = s.notes.map(note =>
    '<div class="section"><h3>' + escapeHTML(note.title) + '</h3>' +
    '<p style="margin-top:10px;white-space:pre-wrap">' + escapeHTML(note.text) + '</p></div>'
  ).join('');
}
