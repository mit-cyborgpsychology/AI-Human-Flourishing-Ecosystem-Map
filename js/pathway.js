/* Pathway-to-impact overlay: the ecosystem as stages from funding to impact. */

import { ROLES, PATHWAY } from './config.js';
import { S, roleColor } from './state.js';
import { orgRoles, primaryRole, projCount, orgAdjacency } from './model.js';
import { esc } from './dom.js';
import { openNodeFromOverlay } from './overlay.js';

export function renderPathway() {
  document.getElementById('ovEyebrow').textContent = 'Systemic view';
  document.getElementById('ovTitle').textContent = 'Pathway to Impact';
  document.getElementById('overlayTools').innerHTML = '';
  const adj = orgAdjacency();
  let html = `<p class="pathnote">How work on AI &amp; human flourishing flows from funding to lasting impact. Each column is a stage in the ecosystem; the number on each organization is how many projects it runs on AI &amp; human flourishing. Hover an organization to trace its connections across stages; click to open it in the map.</p><div style="overflow-x:auto"><div class="pathgrid">`;
  PATHWAY.forEach((stage, si) => {
    const rk = stage.roles[0], col = roleColor(rk), ic = ROLES[rk].icon;
    let orgs = S.data.orgs.filter(o => stage.roles.some(r => orgRoles(o).includes(r)));
    orgs.sort((a, b) => projCount(b) - projCount(a));
    const totalProj = orgs.reduce((s, o) => s + projCount(o), 0);
    html += `<div class="pathcol">
      <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ic}"/></svg>${esc(stage.title)}</h3>
      <div class="stagesub">${esc(stage.sub)}</div>
      <div class="stagestat">${orgs.length} orgs · ${totalProj} projects</div>
      <div class="pathlist">` +
      orgs.map(o => `<button class="pathitem" data-id="${esc(o.id)}">
        <span class="pdot" style="background:${roleColor(primaryRole(o))}"></span>
        <span class="pnm">${esc(o.name)}</span>
        <span class="pj" title="Projects on AI &amp; human flourishing">${projCount(o)}</span>
      </button>`).join('') + `</div></div>`;
    if (si < PATHWAY.length - 1) html += `<div class="pathstep"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>`;
  });
  html += '</div></div>';
  const body = document.getElementById('overlayBody'); body.innerHTML = html;
  const items = [...body.querySelectorAll('.pathitem')];
  items.forEach(el => {
    el.addEventListener('click', () => openNodeFromOverlay(el.dataset.id));
    el.addEventListener('mouseenter', () => {
      const id = el.dataset.id, near = adj[id] || new Set();
      items.forEach(it => {
        const iid = it.dataset.id;
        if (iid === id) it.classList.add('hot');
        else if (near.has(iid)) it.classList.add('hot');
        else it.classList.add('dim');
      });
    });
    el.addEventListener('mouseleave', () => items.forEach(it => it.classList.remove('hot', 'dim')));
  });
}
