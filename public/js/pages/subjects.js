import { api } from '../api.js';
import { getState, adoptState } from '../store.js';
import { escapeHTML, showInfoModal, showConfirmModal } from '../ui.js';
import { startChapterTest } from './tests.js';

let openSubjectId = null;

export function renderSubjects() {
  const s = getState();
  if (!s) return;
  const container = document.getElementById('subjectList');
  container.innerHTML = '';

  if (s.subjects.length === 0) {
    container.innerHTML = '<p style="color:var(--muted)">No subjects yet. Add your first subject above.</p>';
    return;
  }

  s.subjects.forEach(subject => {
    const completed = subject.chapters.filter(c => c.testPassed).length;
    const div = document.createElement('div');
    div.className = 'subject';
    div.style.cursor = 'pointer';
    div.dataset.action = 'open-subject';
    div.dataset.id = subject.id;
    div.innerHTML = '<div class="subject-header">' +
      '<h3>📚 ' + escapeHTML(subject.name) +
      ' <span style="font-size:13px;color:var(--muted);font-weight:normal">(' + completed + '/' + subject.chapters.length + ' topics done)</span></h3>' +
      '<button class="subject-toggle" title="Open topics">▶</button>' +
      '</div>';
    container.appendChild(div);
  });

  if (openSubjectId !== null) renderSubjectDetail(openSubjectId);
}

export function openSubjectDetail(id) {
  openSubjectId = Number(id);
  document.getElementById('subjectListWrap').style.display = 'none';
  document.getElementById('subjectDetailView').style.display = 'block';
  renderSubjectDetail(openSubjectId);
}

export function closeSubjectDetail() {
  openSubjectId = null;
  document.getElementById('subjectDetailView').style.display = 'none';
  document.getElementById('subjectListWrap').style.display = 'block';
}

export function renderSubjectDetail(subjectId) {
  const s = getState();
  const subject = s && s.subjects.find(x => x.id === Number(subjectId));
  if (!subject) { closeSubjectDetail(); return; }

  document.getElementById('subjectDetailTitle').textContent = '📚 ' + subject.name;

  const html = subject.chapters.map(chapter => {
    let badge = '';
    if (chapter.testPassed) {
      badge = '<span class="badge ' + (chapter.level || 'medium') + '">' + (chapter.level || 'medium') + ' ✅</span>';
    } else if (chapter.failedEasy) {
      badge = '<span class="badge">needs review</span>';
    }

    let buttons = '<button data-action="topic-over" data-chapter-id="' + chapter.id + '" data-chapter-name="' + escapeHTML(chapter.name) + '">' +
      (chapter.testPassed ? 'Retake' : 'Topic Over?') + '</button>';

    if (chapter.testPassed && chapter.level === 'easy') {
      buttons += '<button style="background:#a16207" data-action="start-chapter-test" data-chapter-id="' + chapter.id + '" data-difficulty="medium">Try Medium</button>';
    }
    if (chapter.testPassed && chapter.level === 'medium') {
      buttons += '<button style="background:#a16207" data-action="start-chapter-test" data-chapter-id="' + chapter.id + '" data-difficulty="hard">Try Hard</button>';
    }
    if (chapter.failedEasy) {
      buttons += '<button style="background:#7c3aed" data-action="ai-explain" data-topic="' + escapeHTML(chapter.name) + '">AI Explain (-' + s.constants.AI_COSTS.detailed + ' ⚡)</button>';
    }

    return '<div class="chapter"><span>' + escapeHTML(chapter.name) + badge + '</span>' +
      '<div class="cbtns">' + buttons + '</div></div>';
  }).join('');

  document.getElementById('subjectDetailChapters').innerHTML =
    html || '<p style="color:var(--muted)">No topics in this subject yet.</p>';
}

export function confirmTopicOver(chapterId, chapterName) {
  const s = getState();
  showConfirmModal(
    "Is '" + chapterName + "' over?",
    'StudyMate will start you on an easy-level test (-' + s.constants.AI_COSTS.test + ' ⚡ AI credits). Pass it and you can choose to try medium, then hard, whenever you\'re ready.',
    () => startChapterTest(Number(chapterId), 'easy')
  );
}

export async function addSubject() {
  const input = document.getElementById('subjectName');
  const name = input.value.trim();
  if (!name) return;
  try {
    const res = await api('/api/subjects', { method: 'POST', body: { name } });
    adoptState(res);
    input.value = '';
    renderSubjects();
  } catch (e) {
    if (e.code === 'duplicate') showInfoModal('Subject already exists', e.message);
    else showInfoModal('Could not add subject', e.message);
  }
}

export async function loadAllSubjects() {
  try {
    const res = await api('/api/subjects/load-all', { method: 'POST', body: {} });
    adoptState(res);
    renderSubjects();
  } catch (e) {
    showInfoModal('Could not load subjects', e.message);
  }
}
