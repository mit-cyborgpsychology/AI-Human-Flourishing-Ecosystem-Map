/* Domain adapter: derives the nested object model the map works with
   (S.data = { orgs:[{…, projects:[…]}], links:[…] }) from the raw CSV tables.
   Every derived object keeps a `row` reference to its CSV row, so all edits —
   including the map's legacy forms — write straight into the CSV store.
   Custom CSV columns are exposed via each object's `extra` bag. */

import { store } from './store.js';
import { S } from './state.js';
import { splitList, joinList } from './csv.js';

const CORE_ORG = new Set(['id','name','roles','location','url','description','people','tags','keywords','areas']);
const CORE_PROJ = new Set(['id','org_id','name','description','people','tags','areas','collab','url']);
const CORE_LINK = new Set(['source_id','target_id','type','label']);

function extras(row, coreKeys) {
  const e = {};
  for (const k of Object.keys(row)) if (!coreKeys.has(k)) e[k] = row[k];
  return e;
}

/* store → S.data */
export function rebuildData() {
  const personName = {};
  for (const p of store.tables.people.rows) if (p.id) personName[p.id] = p.name || p.id;
  const resolvePeople = s => splitList(s).map(id => personName[id] || id);
  const orgs = [];
  const byId = {};
  for (const r of store.tables.orgs.rows) {
    if (!r.id) continue;
    const roles = splitList(r.roles);
    const o = {
      id: r.id, name: r.name || r.id,
      role: roles[0] || 'academic', roles: roles.length ? roles : ['academic'],
      location: r.location || '', url: r.url || '', desc: r.description || '',
      people: resolvePeople(r.people), tags: splitList(r.tags),
      keywords: splitList(r.keywords), areas: splitList(r.areas),
      projects: [], extra: extras(r, CORE_ORG), row: r,
    };
    orgs.push(o); byId[o.id] = o;
  }
  for (const r of store.tables.projects.rows) {
    const org = byId[r.org_id];
    if (!org || !r.id) continue;  // orphans stay in the CSV; the Data editor flags them
    org.projects.push({
      id: r.id, name: r.name || r.id, desc: r.description || '',
      people: resolvePeople(r.people), tags: splitList(r.tags),
      areas: splitList(r.areas), collab: splitList(r.collab).filter(c => byId[c]),
      url: r.url || '', extra: extras(r, CORE_PROJ), row: r,
    });
  }
  const links = [];
  for (const r of store.tables.links.rows) {
    if (!r.source_id || !r.target_id) continue;
    links.push({ a: r.source_id, b: r.target_id, type: r.type || 'collaborate',
      label: r.label || '', extra: extras(r, CORE_LINK), row: r });
  }
  S.data = { orgs, links };
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

/* Stable, human-readable slug (used for people ids: "Pattie Maes" → "pattie-maes") */
export const stableSlug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* Map person display names to people.csv ids, creating rows for unknown names.
   Mutates the people table directly; the caller is responsible for store.changed(). */
export function ensurePeople(names) {
  const rows = store.tables.people.rows;
  return joinList(names.map(n => {
    const found = rows.find(r => r.id === n || (r.name || '').toLowerCase() === n.toLowerCase());
    if (found) return found.id;
    let id = stableSlug(n) || 'person';
    while (rows.some(r => r.id === id)) id += '-2';
    const row = {};
    for (const c of store.tables.people.columns) row[c.key] = '';
    row.id = id; row.name = n;
    rows.push(row);
    return id;
  }));
}
