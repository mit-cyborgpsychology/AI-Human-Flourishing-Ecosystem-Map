/* Modal forms (org / project / connection), edit-mode gate. */

import { ROLES, AREAS } from './config.js';
import { S } from './state.js';
import { orgRoles, primaryRole, slug } from './model.js';
import { esc, toast, openModal, closeModal, modal } from './dom.js';
import { afterMutate } from './mutate.js';
import { select, renderPanel } from './panel.js';
import { refreshOverlay } from './overlay.js';

const splitCommas = s => s.split(',').map(x => x.trim()).filter(Boolean);
const areaChecks = sel => `<div class="field"><label>Flourishing areas</label><div class="checks">${
  Object.entries(AREAS).map(([k, a]) => `<label class="check"><input type="checkbox" data-area="${k}" ${
    (sel || []).includes(k) ? 'checked' : ''}> ${a.label}</label>`).join('')}</div></div>`;
const readAreas = () => [...modal.querySelectorAll('[data-area]:checked')].map(c => c.dataset.area);

export function orgForm(existing) {
  const o = existing || {};
  openModal(`<span class="eyebrow">${existing ? 'Edit organization' : 'New organization'}</span>
    <h3>${existing ? esc(o.name) : 'Add an organization'}</h3>
    <div class="field"><label>Name *</label><input id="fName" value="${esc(o.name || '')}"></div>
    <div class="field"><label>Primary role</label><select id="fRole">${
      Object.entries(ROLES).filter(([k]) => k !== 'hub' || primaryRole(o) === 'hub')
      .map(([k, rr]) => `<option value="${k}" ${primaryRole(o) === k ? 'selected' : ''}>${rr.label}</option>`).join('')}</select></div>
    <div class="field"><label>Additional roles (an org can play several)</label><div class="checks">${
      Object.entries(ROLES).filter(([k]) => k !== 'hub').map(([k, rr]) => `<label class="check"><input type="checkbox" data-role="${k}" ${
        orgRoles(o).slice(1).includes(k) ? 'checked' : ''}> ${rr.label}</label>`).join('')}</div></div>
    <div class="field"><label>Location</label><input id="fLoc" value="${esc(o.location || '')}" placeholder="City, Country"></div>
    <div class="field"><label>Website</label><input id="fUrl" value="${esc(o.url || '')}" placeholder="https://…"></div>
    <div class="field"><label>Description</label><textarea id="fDesc">${esc(o.desc || '')}</textarea></div>
    <div class="field"><label>People (comma-separated)</label><input id="fPeople" value="${esc((o.people || []).join(', '))}"></div>
    <div class="field"><label>Tags (comma-separated)</label><input id="fTags" value="${esc((o.tags || []).join(', '))}"></div>
    <div class="field"><label>Keywords (comma-separated)</label><input id="fKw" value="${esc((o.keywords || []).join(', '))}"></div>
    ${areaChecks(o.areas)}
    <div class="ferr" id="fErr">Name is required.</div>
    <div class="mrow"><button class="btn" id="mNo">Cancel</button>
    <button class="btn primary" id="mGo">${existing ? 'Save changes' : 'Add to map'}</button></div>`);
  modal.querySelector('#mNo').onclick = closeModal;
  modal.querySelector('#mGo').onclick = () => {
    const name = modal.querySelector('#fName').value.trim();
    if (!name) { modal.querySelector('#fErr').style.display = 'block'; return; }
    const primary = modal.querySelector('#fRole').value;
    const extra = [...modal.querySelectorAll('[data-role]:checked')].map(c => c.dataset.role).filter(k => k !== primary);
    const v = { name, role: primary, roles: [primary, ...extra],
      location: modal.querySelector('#fLoc').value.trim(),
      url: modal.querySelector('#fUrl').value.trim(),
      desc: modal.querySelector('#fDesc').value.trim(),
      people: splitCommas(modal.querySelector('#fPeople').value),
      tags: splitCommas(modal.querySelector('#fTags').value),
      keywords: splitCommas(modal.querySelector('#fKw').value),
      areas: readAreas() };
    if (existing) Object.assign(existing, v);
    else S.data.orgs.push({ id: slug(name), projects: [], extra: {}, ...v });
    closeModal(); afterMutate();
    const node = S.nodeById[existing ? existing.id : S.data.orgs[S.data.orgs.length - 1].id];
    if (node) select(node);
    toast(existing ? 'Saved' : 'Organization added');
  };
}

export function projForm(org, existing) {
  const p = existing || {};
  openModal(`<span class="eyebrow">${existing ? 'Edit project' : 'New project'} · ${esc(org.name)}</span>
    <h3>${existing ? esc(p.name) : 'Add a project'}</h3>
    <div class="field"><label>Name *</label><input id="fName" value="${esc(p.name || '')}"></div>
    <div class="field"><label>Description</label><textarea id="fDesc">${esc(p.desc || '')}</textarea></div>
    <div class="field"><label>People (comma-separated)</label><input id="fPeople" value="${esc((p.people || []).join(', '))}"></div>
    <div class="field"><label>Tags (comma-separated)</label><input id="fTags" value="${esc((p.tags || []).join(', '))}"></div>
    <div class="field"><label>Link</label><input id="fUrl" value="${esc(p.url || '')}" placeholder="https://…"></div>
    ${areaChecks(p.areas)}
    <div class="field"><label>Collaborating organizations (⌘/Ctrl-click for multiple)</label>
      <select id="fCollab" multiple size="5">${
        S.data.orgs.filter(o => o.id !== org.id).map(o => `<option value="${esc(o.id)}" ${
          (p.collab || []).includes(o.id) ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div>
    <div class="ferr" id="fErr">Name is required.</div>
    <div class="mrow"><button class="btn" id="mNo">Cancel</button>
    <button class="btn primary" id="mGo">${existing ? 'Save changes' : 'Add project'}</button></div>`);
  modal.querySelector('#mNo').onclick = closeModal;
  modal.querySelector('#mGo').onclick = () => {
    const name = modal.querySelector('#fName').value.trim();
    if (!name) { modal.querySelector('#fErr').style.display = 'block'; return; }
    const v = { name, desc: modal.querySelector('#fDesc').value.trim(),
      people: splitCommas(modal.querySelector('#fPeople').value),
      tags: splitCommas(modal.querySelector('#fTags').value),
      url: modal.querySelector('#fUrl').value.trim(),
      areas: readAreas(),
      collab: [...modal.querySelector('#fCollab').selectedOptions].map(op => op.value) };
    if (existing) Object.assign(existing, v);
    else org.projects.push({ id: slug(name), extra: {}, ...v });
    closeModal(); afterMutate(); select(S.nodeById[org.id]);
    toast(existing ? 'Saved' : 'Project added');
  };
}

export function linkForm(org) {
  const others = S.data.orgs.filter(o => o.id !== org.id);
  openModal(`<span class="eyebrow">New connection · ${esc(org.name)}</span>
    <h3>Connect to another organization</h3>
    <div class="field"><label>Organization</label><select id="fTo">${
      others.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Relationship label</label><input id="fLbl" placeholder="e.g. Joint research, Funding"></div>
    <div class="mrow"><button class="btn" id="mNo">Cancel</button>
    <button class="btn primary" id="mGo">Connect</button></div>`);
  modal.querySelector('#mNo').onclick = closeModal;
  modal.querySelector('#mGo').onclick = () => {
    S.data.links.push({ a: org.id, b: modal.querySelector('#fTo').value,
      label: modal.querySelector('#fLbl').value.trim() || 'connection', extra: {} });
    closeModal(); afterMutate(); select(S.nodeById[org.id]); toast('Connection added');
  };
}

/* ---- edit-mode password gate ---- */
export function initEditGate() {
  document.getElementById('editBtn').addEventListener('click', () => {
    if (S.editMode) { setEdit(false); toast('Edit mode off'); return; }
    openModal(`<span class="eyebrow">Curator access</span>
      <h3>Enter password to edit</h3>
      <p class="sub">Editing lets you add, modify, and remove organizations, projects, and connections — directly or through the CSV data editor. Changes are stored in this browser as CSV.</p>
      <div class="field"><label>Password</label><input id="pw" type="password" autocomplete="off"></div>
      <div class="ferr" id="pwErr">Incorrect password — hint: what this whole map is about.</div>
      <div class="mrow"><button class="btn" id="mNo">Cancel</button>
      <button class="btn primary" id="mGo">Unlock</button></div>`);
    const tryPw = () => {
      const v = modal.querySelector('#pw').value.trim().toLowerCase();
      if (v === 'flourishing') { closeModal(); setEdit(true); toast('Edit mode unlocked'); }
      else {
        modal.querySelector('#pwErr').style.display = 'block';
        modal.classList.remove('shake'); void modal.offsetWidth; modal.classList.add('shake');
      }
    };
    modal.querySelector('#mNo').onclick = closeModal;
    modal.querySelector('#mGo').onclick = tryPw;
    modal.querySelector('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') tryPw(); });
  });
}

export function setEdit(on) {
  S.editMode = on;
  document.getElementById('editLbl').textContent = on ? 'Editing ✓' : 'Edit';
  document.getElementById('editBtn').classList.toggle('primary', on);
  document.getElementById('editDock').classList.toggle('on', on);
  if (S.overlayView) refreshOverlay();
  if (S.selected) renderPanel(S.selected);
}
