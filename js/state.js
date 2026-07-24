/* Shared mutable app state (single object so modules stay in sync) + theme handling. */

import { ROLES, PALETTES } from './config.js';

export const S = {
  data: { orgs: [], links: [] },   // domain model derived from the CSV store
  editMode: false,
  selected: null, hovered: null,
  query: '',
  showProjects: true, showRing: true,
  selectedArea: null, hoveredArea: null,
  userMoved: false,
  roleOn: Object.fromEntries(Object.keys(ROLES).map(r => [r, true])),
  // graph
  nodes: [], edges: [], nodeById: {}, adj: {},
  dragNode: null,
  // camera / viewport
  W: 0, H: 0, dpr: 1, tx: 0, ty: 0, zk: 1,
  // overlay
  overlayView: null,
};

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- theme ---------- */
function themeName() {
  const dt = document.documentElement.dataset.theme;
  if (dt === 'dark' || dt === 'light') return dt;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export const theme = { name: themeName(), pal: PALETTES[themeName()] };
export function roleColor(role) { return (ROLES[role] || ROLES.community).c[theme.name]; }

function refreshTheme() { theme.name = themeName(); theme.pal = PALETTES[theme.name]; }
new MutationObserver(refreshTheme)
  .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshTheme);
