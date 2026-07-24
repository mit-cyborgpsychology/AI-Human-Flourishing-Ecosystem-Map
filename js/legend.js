/* Header stats line + role legend / filter. */

import { ROLES } from './config.js';
import { S, theme } from './state.js';
import { orgRoles } from './model.js';

export function updateStats() {
  const P = S.data.orgs.reduce((s, o) => s + o.projects.length, 0);
  document.getElementById('stats').textContent =
    `${S.data.orgs.length} organizations · ${P} projects · ${S.data.links.length} connections`;
}

export function renderLegend() {
  const el = document.getElementById('legend');
  const counts = {};
  S.data.orgs.forEach(o => orgRoles(o).forEach(rk => counts[rk] = (counts[rk] || 0) + 1));
  el.innerHTML = '<span class="eyebrow">Roles</span>' +
    Object.entries(ROLES).filter(([k]) => counts[k]).map(([k, r]) => `
      <button class="lrow ${S.roleOn[k] ? '' : 'off'}" data-role="${k}">
        <svg class="licon" viewBox="0 0 24 24" fill="none" stroke="${r.c[theme.name]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${r.icon}"/></svg>
        <span>${r.label}</span>
        <span class="n">${counts[k] || 0}</span>
      </button>`).join('') +
    '<div id="legendHint">Click a role to filter</div>';
  el.querySelectorAll('.lrow').forEach(b => b.addEventListener('click', () => {
    const r = b.dataset.role; S.roleOn[r] = !S.roleOn[r]; renderLegend();
  }));
}
