export function escapeHTML(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function showCreditToast(message, kind) {
  const existing = document.getElementById('creditToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'creditToast';
  toast.className = kind === 'earn' ? 'earn' : 'spend';
  toast.textContent = (kind === 'earn' ? '🎉 ' : '⚡ ') + message;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2600);
}

function openModal(title, message, buttonsHTML) {
  const existing = document.getElementById('confirmModalOverlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'confirmModalOverlay';
  const card = document.createElement('div');
  card.className = 'modal-card';
  card.innerHTML = '<h3>' + escapeHTML(title) + '</h3>' +
    '<p>' + escapeHTML(message) + '</p>' + buttonsHTML;
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  return overlay;
}

export function showInfoModal(title, message) {
  const overlay = openModal(title, message, "<button class='btn' data-modal='ok' style='width:100%'>OK</button>");
  overlay.querySelector('[data-modal=ok]').addEventListener('click', () => overlay.remove());
}

export function showConfirmModal(title, message, onYes) {
  const overlay = openModal(title, message,
    "<button class='btn' data-modal='yes' style='width:100%;margin-bottom:8px'>Yes, start test</button>" +
    "<button class='btn secondary' data-modal='no' style='width:100%'>Not yet</button>");
  overlay.querySelector('[data-modal=yes]').addEventListener('click', () => { overlay.remove(); onYes(); });
  overlay.querySelector('[data-modal=no]').addEventListener('click', () => overlay.remove());
}
