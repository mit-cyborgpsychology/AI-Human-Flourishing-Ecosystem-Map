/* Right-hand detail panel: node + flourishing-area views, in-panel edit actions. */

import { ROLES, AREAS } from './config.js';
import { S, roleColor } from './state.js';
import { orgRoles, primaryRole } from './model.js';
import { colorOf } from './graph.js';
import { esc, initials, toast, confirmModal } from './dom.js';
import { toScreen } from './canvas.js';
import { afterMutate } from './mutate.js';
import { orgForm, projForm, linkForm } from './forms.js';

const panel = document.getElementById('panel'), pscroll = document.getElementById('panelScroll');

export function initPanel() {
  document.getElementById('pclose').addEventListener('click', () => select(null));
}

export function selectArea(key) {
  if (!AREAS[key]) return;
  S.selectedArea = key; S.selected = null;
  const A = AREAS[key];
  const members = S.data.orgs.filter(o => (o.areas || []).includes(key));
  const projs = [];
  S.data.orgs.forEach(o => o.projects.forEach(p => { if (p.areas && p.areas.includes(key)) projs.push({ p, o }); }));
  let h = `<span class="chip" style="background:${A.color}">Flourishing area</span>
    <h2>${esc(A.label)}</h2>
    <p class="pdesc">${esc(A.desc)}</p>
    <div class="sect"><span class="eyebrow">Organizations · ${members.length}</span><div class="rowlist">` +
    members.map(o => `<button class="rowitem" data-go="${esc(o.id)}">
      <span class="rdot" style="background:${roleColor(primaryRole(o))}"></span>
      <span><span class="rname">${esc(o.name)}</span><br><span class="rsub">${esc((ROLES[primaryRole(o)] || {}).label || '')}</span></span>
    </button>`).join('') + '</div></div>';
  if (projs.length) h += `<div class="sect"><span class="eyebrow">Flagship projects · ${projs.length}</span><div class="rowlist">` +
    projs.map(({ p, o }) => `<button class="rowitem" data-go="${esc(p.id)}">
      <span class="rdot" style="background:${roleColor(primaryRole(o))}"></span>
      <span><span class="rname">${esc(p.name)}</span><br><span class="rsub">${esc(o.name)}</span></span>
    </button>`).join('') + '</div></div>';
  pscroll.innerHTML = h;
  pscroll.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => {
    const t = S.nodeById[el.dataset.go]; if (t) select(t);
  }));
  panel.classList.add('open');
}

export function select(n) {
  S.selected = n; S.selectedArea = null;
  if (!n) { panel.classList.remove('open'); return; }
  renderPanel(n); panel.classList.add('open');
  const s = toScreen(n);
  const pad = innerWidth > 760 ? 410 : 0;
  if (s.x > S.W - pad - 60 || s.x < 60 || s.y < 80 || s.y > S.H - 80) {
    S.tx += (S.W - pad) / 2 - s.x; S.ty += S.H / 2 - s.y;
  }
}

function chips(list, cls) {
  return (list && list.length)
    ? `<div class="tags">${list.map(t => `<span class="tag ${cls || ''}">${esc(t)}</span>`).join('')}</div>`
    : '<span style="color:var(--faint);font-size:11px">—</span>';
}

export function renderPanel(n) {
  const isOrg = n.kind === 'org', isRole = n.kind === 'role';
  const color = colorOf(n);
  let h = '';
  if (n.kind === 'root') {
    const P = S.data.orgs.reduce((s, o) => s + o.projects.length, 0);
    const counts = {}; S.data.orgs.forEach(o => orgRoles(o).forEach(rk => counts[rk] = (counts[rk] || 0) + 1));
    h += `<span class="chip" style="background:${color}">Ecosystem</span>
      <h2>${esc(n.ref.name)}</h2>
      <p class="pdesc">${esc(n.ref.desc)}</p>
      <div class="sect"><span class="eyebrow">At a glance</span>
        <p class="pdesc" style="margin-top:4px">${S.data.orgs.length} organizations · ${P} projects · ${S.data.links.length} cross-connections, anchored by the MIT Media Lab’s AHA program.</p></div>
      <div class="sect"><span class="eyebrow">Roles</span><div class="rowlist">` +
      Object.entries(ROLES).filter(([k]) => counts[k] && k !== 'hub').map(([k, r]) => `
        <button class="rowitem" data-go="role:${k}">
          <span class="rdot" style="background:${roleColor(k)}"></span>
          <span><span class="rname">${esc(r.label)}</span><br><span class="rsub">${counts[k]} organizations</span></span>
        </button>`).join('') + '</div></div>';
    pscroll.innerHTML = h;
    pscroll.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => {
      const t = S.nodeById[el.dataset.go]; if (t) select(t);
    }));
    return;
  }
  if (isRole) {
    const members = S.data.orgs.filter(o => orgRoles(o).includes(n.role));
    h += `<span class="chip" style="background:${color}">Ecosystem role</span>
      <h2>${esc(n.ref.name)}</h2>
      <p class="pdesc">${esc(n.ref.desc)}</p>
      <div class="sect"><span class="eyebrow">Organizations · ${members.length}</span><div class="rowlist">` +
      members.map(o => `<button class="rowitem" data-go="${esc(o.id)}">
        <span class="rdot" style="background:${roleColor(primaryRole(o))}"></span>
        <span><span class="rname">${esc(o.name)}</span><br><span class="rsub">${orgRoles(o).length > 1 ? esc(orgRoles(o).map(rk => (ROLES[rk] || {}).label).join(' · ')) : esc(o.location || '')}</span></span>
      </button>`).join('') + '</div></div>';
    pscroll.innerHTML = h;
    pscroll.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => {
      const t = S.nodeById[el.dataset.go]; if (t) select(t);
    }));
    return;
  }
  const org = isOrg ? n.ref : n.org;
  const role = ROLES[primaryRole(org)] || ROLES.community;
  const r = n.ref;
  if (!isOrg) h += `<button class="crumb" data-go="${esc(org.id)}">← ${esc(org.name)}</button>`;
  if (isOrg) h += `<div class="chiprow">${orgRoles(org).map(rk => `<span class="chip" style="background:${roleColor(rk)}">${esc((ROLES[rk] || {}).label || rk)}</span>`).join('')}</div>`;
  else h += `<span class="chip" style="background:${color}">Project · ${esc(role.label)}</span>`;
  h += `<h2>${esc(r.name)}</h2>`;
  if (isOrg && r.location) h += `<div class="ploc"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${esc(r.location)}</div>`;
  h += `<p class="pdesc">${esc(r.desc || '')}</p>`;
  if (r.people && r.people.length) h += `<div class="sect"><span class="eyebrow">People</span>
    <div class="people">${r.people.map(p => `<span class="person"><span class="avatar" style="background:${color}">${initials(p)}</span>${esc(p)}</span>`).join('')}</div></div>`;
  h += `<div class="sect"><span class="eyebrow">Tags</span>${chips(r.tags)}</div>`;
  if (isOrg) h += `<div class="sect"><span class="eyebrow">Keywords</span>${chips(r.keywords, 'kw')}</div>`;
  const myAreas = isOrg ? (r.areas || []) : ((r.areas && r.areas.length) ? r.areas : (org.areas || []));
  if (myAreas.length) h += `<div class="sect"><span class="eyebrow">Flourishing areas</span><div class="tags">${
    myAreas.map(k => AREAS[k] ? `<button class="tag areatag" data-areago="${k}" style="color:${AREAS[k].color};background:${AREAS[k].color}1A">${esc(AREAS[k].label)}</button>` : '').join('')}</div></div>`;
  // custom CSV columns show up here so audits can see the whole record
  const extraEntries = Object.entries(r.extra || {}).filter(([, v]) => String(v).trim() !== '');
  if (extraEntries.length) h += extraEntries.map(([k, v]) => `<div class="sect"><span class="eyebrow">${esc(k.replace(/_/g, ' '))}</span><p class="pdesc" style="margin-top:2px">${esc(v)}</p></div>`).join('');
  if (!isOrg) {
    const partners = [org, ...(r.collab || []).map(id => S.data.orgs.find(o => o.id === id)).filter(Boolean)];
    if (partners.length > 1) h += `<div class="sect"><span class="eyebrow">Organizations · ${partners.length}</span><div class="rowlist">${
      partners.map(o => `<button class="rowitem" data-go="${esc(o.id)}">
        <span class="rdot" style="background:${roleColor(primaryRole(o))}"></span>
        <span><span class="rname">${esc(o.name)}</span><br><span class="rsub">${o.id === org.id ? 'Lead organization' : 'Collaborator'}</span></span>
      </button>`).join('')}</div></div>`;
  }
  const linkUrl = r.url || (!isOrg ? org.url : '');
  if (linkUrl) h += `<div class="sect"><span class="eyebrow">Link${r.url ? '' : ' · via organization'}</span><a class="plink" href="${esc(linkUrl)}" target="_blank" rel="noopener">${esc(linkUrl.replace(/^https?:\/\//, ''))}</a></div>`;

  if (isOrg) {
    const shared = [];
    S.data.orgs.forEach(o2 => { if (o2.id !== r.id) o2.projects.forEach(p => { if ((p.collab || []).includes(r.id)) shared.push({ p, o: o2 }); }); });
    if (r.projects.length || shared.length || S.editMode) {
      h += `<div class="sect"><span class="eyebrow">Projects · ${r.projects.length + shared.length}</span><div class="rowlist">` +
        r.projects.map(p => `<button class="rowitem" data-go="${esc(p.id)}">
          <span class="rdot" style="background:${color}"></span>
          <span><span class="rname">${esc(p.name)}</span>${(p.collab && p.collab.length) ? `<br><span class="rsub">with ${esc(p.collab.map(id => (S.data.orgs.find(o => o.id === id) || {}).name).filter(Boolean).join(', '))}</span>` : ''}</span>
          ${S.editMode ? `<span class="rx" data-delproj="${esc(p.id)}" title="Delete project">✕</span>` : ''}
        </button>`).join('') +
        shared.map(({ p, o }) => `<button class="rowitem" data-go="${esc(p.id)}">
          <span class="rdot" style="background:${roleColor(primaryRole(o))}"></span>
          <span><span class="rname">${esc(p.name)}</span><br><span class="rsub">shared · led by ${esc(o.name)}</span></span>
        </button>`).join('') + '</div></div>';
    }
    const conns = S.data.links.map((l, i) => ({ l, i })).filter(({ l }) => l.a === r.id || l.b === r.id);
    if (conns.length || S.editMode) {
      h += `<div class="sect"><span class="eyebrow">Connections · ${conns.length}</span><div class="rowlist">` +
        conns.map(({ l, i }) => {
          const otherId = l.a === r.id ? l.b : l.a;
          const other = S.data.orgs.find(o => o.id === otherId);
          if (!other) return '';
          return `<button class="rowitem" data-go="${esc(other.id)}">
            <span class="rdot" style="background:${roleColor(primaryRole(other))}"></span>
            <span><span class="rname">${esc(other.name)}</span><br><span class="rsub">${esc(l.label || 'connection')}</span></span>
            ${S.editMode ? `<span class="rx" data-dellink="${i}" title="Remove connection">✕</span>` : ''}
          </button>`; }).join('') + '</div></div>';
    }
  }
  if (S.editMode) {
    h += `<div class="pactions">`;
    h += `<button class="btn" data-edit="1">✎ Edit</button>`;
    if (isOrg) {
      h += `<button class="btn" data-addproj="1">＋ Project</button>
          <button class="btn" data-addlink="1">＋ Connection</button>`;
      if (primaryRole(r) !== 'hub') h += `<button class="btn danger" data-del="1">Delete</button>`;
    } else h += `<button class="btn danger" data-del="1">Delete</button>`;
    h += `</div>`;
  }
  pscroll.innerHTML = h;

  pscroll.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', ev => {
    if (ev.target.closest('.rx')) return;
    const t = S.nodeById[el.dataset.go]; if (t) select(t);
  }));
  pscroll.querySelectorAll('[data-areago]').forEach(el => el.addEventListener('click', () => selectArea(el.dataset.areago)));
  pscroll.querySelectorAll('[data-delproj]').forEach(el => el.addEventListener('click', ev => {
    ev.stopPropagation();
    confirmModal(`Delete project?`, () => {
      r.projects = r.projects.filter(p => p.id !== el.dataset.delproj);
      afterMutate(); select(S.nodeById[r.id]); toast('Project deleted');
    });
  }));
  pscroll.querySelectorAll('[data-dellink]').forEach(el => el.addEventListener('click', ev => {
    ev.stopPropagation();
    S.data.links.splice(+el.dataset.dellink, 1);
    afterMutate(); select(S.nodeById[r.id]); toast('Connection removed');
  }));
  const eb = pscroll.querySelector('[data-edit]');
  if (eb) eb.addEventListener('click', () => isOrg ? orgForm(r) : projForm(org, r));
  const ap = pscroll.querySelector('[data-addproj]');
  if (ap) ap.addEventListener('click', () => projForm(r, null));
  const al = pscroll.querySelector('[data-addlink]');
  if (al) al.addEventListener('click', () => linkForm(r));
  const del = pscroll.querySelector('[data-del]');
  if (del) del.addEventListener('click', () => {
    confirmModal(`Delete “${r.name}” and all its ${isOrg ? 'projects and connections' : 'data'}?`, () => {
      if (isOrg) {
        S.data.orgs = S.data.orgs.filter(o => o.id !== r.id);
        S.data.links = S.data.links.filter(l => l.a !== r.id && l.b !== r.id);
      } else org.projects = org.projects.filter(p => p.id !== r.id);
      afterMutate(); select(isOrg ? null : S.nodeById[org.id]); toast('Deleted');
    });
  });
}

export function closePanel() { panel.classList.remove('open'); }
export const panelEl = panel;
