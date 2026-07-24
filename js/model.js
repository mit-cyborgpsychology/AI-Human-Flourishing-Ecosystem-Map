/* Domain adapter: converts between the raw CSV tables (store) and the nested
   object model the map works with (S.data = { orgs:[{…, projects:[…]}], links:[…] }).
   Custom CSV columns survive the round-trip via each object's `extra` bag. */

import { store } from './store.js';
import { S } from './state.js';
import { splitList, joinList } from './csv.js';

const CORE_ORG = new Set(['id','name','roles','location','url','description','people','tags','keywords','areas']);
const CORE_PROJ = new Set(['id','org_id','name','description','people','tags','areas','collab','url']);
const CORE_LINK = new Set(['source_id','target_id','label']);

function extras(row, coreKeys) {
  const e = {};
  for (const k of Object.keys(row)) if (!coreKeys.has(k)) e[k] = row[k];
  return e;
}

/* store → S.data */
export function rebuildData() {
  const orgs = [];
  const byId = {};
  for (const r of store.tables.orgs.rows) {
    if (!r.id) continue;
    const roles = splitList(r.roles);
    const o = {
      id: r.id, name: r.name || r.id,
      role: roles[0] || 'academic', roles: roles.length ? roles : ['academic'],
      location: r.location || '', url: r.url || '', desc: r.description || '',
      people: splitList(r.people), tags: splitList(r.tags),
      keywords: splitList(r.keywords), areas: splitList(r.areas),
      projects: [], extra: extras(r, CORE_ORG),
    };
    orgs.push(o); byId[o.id] = o;
  }
  for (const r of store.tables.projects.rows) {
    const org = byId[r.org_id];
    if (!org || !r.id) continue;  // orphans stay in the CSV; the Data editor flags them
    org.projects.push({
      id: r.id, name: r.name || r.id, desc: r.description || '',
      people: splitList(r.people), tags: splitList(r.tags),
      areas: splitList(r.areas), collab: splitList(r.collab).filter(c => byId[c]),
      url: r.url || '', extra: extras(r, CORE_PROJ),
    });
  }
  const links = [];
  for (const r of store.tables.links.rows) {
    if (!r.source_id || !r.target_id) continue;
    links.push({ a: r.source_id, b: r.target_id, label: r.label || '', extra: extras(r, CORE_LINK) });
  }
  S.data = { orgs, links };
}

/* S.data → store (after edits made through the map's forms/panel) */
export function syncStoreFromData() {
  const blank = cols => Object.fromEntries(cols.map(c => [c.key, '']));
  const orgT = store.tables.orgs;
  orgT.rows = S.data.orgs.map(o => ({ ...blank(orgT.columns), ...o.extra,
    id: o.id, name: o.name, roles: joinList(o.roles && o.roles.length ? o.roles : [o.role]),
    location: o.location || '', url: o.url || '', description: o.desc || '',
    people: joinList(o.people), tags: joinList(o.tags),
    keywords: joinList(o.keywords), areas: joinList(o.areas) }));

  const projT = store.tables.projects;
  const modeled = new Set();
  const projRows = [];
  for (const o of S.data.orgs) for (const p of o.projects) {
    modeled.add(p.id);
    projRows.push({ ...blank(projT.columns), ...p.extra,
      id: p.id, org_id: o.id, name: p.name, description: p.desc || '',
      people: joinList(p.people), tags: joinList(p.tags), areas: joinList(p.areas),
      collab: joinList(p.collab), url: p.url || '' });
  }
  // keep orphaned project rows (unknown org_id) so audits can fix them in the editor
  for (const r of projT.rows) {
    if (!modeled.has(r.id) && !S.data.orgs.some(o => o.id === r.org_id)) projRows.push(r);
  }
  projT.rows = projRows;

  const linkT = store.tables.links;
  linkT.rows = S.data.links.map(l => ({ ...blank(linkT.columns), ...l.extra,
    source_id: l.a, target_id: l.b, label: l.label || '' }));

  store.persist();
}

/* ---------- shared helpers ---------- */
export function orgRoles(o) { return (o.roles && o.roles.length) ? o.roles : (o.role ? [o.role] : ['academic']); }
export function primaryRole(o) { return orgRoles(o)[0]; }

export function projCount(o) {
  let n = o.projects.length;
  S.data.orgs.forEach(o2 => { if (o2.id !== o.id) o2.projects.forEach(p => { if ((p.collab || []).includes(o.id)) n++; }); });
  return n;
}
export function orgAdjacency() {
  const adj = {};
  S.data.orgs.forEach(o => adj[o.id] = new Set());
  S.data.links.forEach(l => { if (adj[l.a] && adj[l.b]) { adj[l.a].add(l.b); adj[l.b].add(l.a); } });
  S.data.orgs.forEach(o => o.projects.forEach(p => (p.collab || []).forEach(c => {
    if (adj[o.id] && adj[c]) { adj[o.id].add(c); adj[c].add(o.id); }
  })));
  return adj;
}

export const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  + '-' + Date.now().toString(36).slice(-4);
