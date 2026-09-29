import { api } from '../api.js';
import { getState, adoptState } from '../store.js';
import { escapeHTML, showInfoModal } from '../ui.js';

const TT_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function populateTimetableDropdowns() {
  const hourSel = document.getElementById('ttHour');
  const minSel = document.getElementById('ttMinute');
  const daySel = document.getElementById('ttDay');
  const monthSel = document.getElementById('ttMonth');
  const yearSel = document.getElementById('ttYear');
  if (!hourSel || hourSel.options.length > 0) return;

  for (let h = 1; h <= 12; h++) {
    const opt = document.createElement('option');
    opt.value = String(h).padStart(2, '0');
    opt.textContent = h;
    hourSel.appendChild(opt);
  }
  ['00', '15', '30', '45'].forEach(m => {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = m;
    minSel.appendChild(opt);
  });
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement('option');
    opt.value = String(d).padStart(2, '0');
    opt.textContent = d;
    daySel.appendChild(opt);
  }
  TT_MONTHS.forEach((name, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx + 1).padStart(2, '0');
    opt.textContent = name;
    monthSel.appendChild(opt);
  });
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y <= thisYear + 3; y++) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = y;
    yearSel.appendChild(opt);
  }
}

export function renderTimetable() {
  populateTimetableDropdowns();
  const s = getState();
  if (!s) return;
  const body = document.getElementById('timetableBody');
  if (s.timetable.length === 0) {
    body.innerHTML = '<tr><td colspan="4" style="padding:14px;color:var(--muted)">No time table entries yet. Add your first one above.</td></tr>';
    return;
  }
  body.innerHTML = s.timetable.map(entry =>
    '<tr style="border-bottom:1px solid var(--line)">' +
    '<td style="padding:10px">' + escapeHTML(entry.subject) + '</td>' +
    '<td style="padding:10px">' + escapeHTML(formatTimetableTime(entry.time)) + '</td>' +
    '<td style="padding:10px">' + escapeHTML(formatTimetableDate(entry.date)) + '</td>' +
    '<td style="padding:10px"><button class="btn danger" style="padding:5px 10px;font-size:13px" data-action="delete-timetable" data-id="' + entry.id + '">Delete</button></td>' +
    '</tr>'
  ).join('');
}

export async function addTimetableEntry() {
  const subject = document.getElementById('ttSubject').value.trim();
  if (!subject) return;
  const hour = document.getElementById('ttHour').value;
  const minute = document.getElementById('ttMinute').value;
  const ampm = document.getElementById('ttAmPm').value;
  const day = document.getElementById('ttDay').value;
  const month = document.getElementById('ttMonth').value;
  const year = document.getElementById('ttYear').value;

  let h24 = parseInt(hour, 10);
  if (ampm === 'PM' && h24 !== 12) h24 += 12;
  if (ampm === 'AM' && h24 === 12) h24 = 0;
  const time = String(h24).padStart(2, '0') + ':' + minute;
  const date = year + '-' + month + '-' + day;

  try {
    const res = await api('/api/timetable', { method: 'POST', body: { subject, time, date } });
    adoptState(res);
    document.getElementById('ttSubject').value = '';
    renderTimetable();
  } catch (e) {
    showInfoModal('Could not add entry', e.message);
  }
}

export async function deleteTimetableEntry(id) {
  try {
    const res = await api('/api/timetable/' + id, { method: 'DELETE' });
    adoptState(res);
    renderTimetable();
  } catch (e) {
    showInfoModal('Could not delete entry', e.message);
  }
}

function formatTimetableTime(t) {
  if (!t) return '-';
  const parts = t.split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(h) || !m) return '-';
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return h12 + ':' + m + ' ' + ampm;
}

function formatTimetableDate(d) {
  if (!d) return '-';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  const y = parts[0], m = parseInt(parts[1], 10) - 1, day = parseInt(parts[2], 10);
  if (isNaN(day) || !TT_MONTHS[m]) return '-';
  return day + ' ' + TT_MONTHS[m].slice(0, 3) + ' ' + y;
}
