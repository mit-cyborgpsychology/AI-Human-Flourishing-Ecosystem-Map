/* Small DOM utilities shared everywhere: escaping, toast, modal. */

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function initials(name) {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}

export const scrim = document.getElementById('scrim');
export const modal = document.getElementById('modal');

export function openModal(html) {
  scrim.classList.add('open');
  modal.innerHTML = html;
  const f = modal.querySelector('input,textarea,select');
  if (f) setTimeout(() => f.focus(), 60);
}
export function closeModal() { scrim.classList.remove('open'); }
scrim.addEventListener('click', e => { if (e.target === scrim) closeModal(); });

export function confirmModal(msg, onYes) {
  openModal(`<span class="eyebrow">Confirm</span><h3>${esc(msg)}</h3>
    <div class="mrow"><button class="btn" id="mNo">Cancel</button>
    <button class="btn danger" id="mYes">Delete</button></div>`);
  modal.querySelector('#mNo').onclick = closeModal;
  modal.querySelector('#mYes').onclick = () => { closeModal(); onYes(); };
}
