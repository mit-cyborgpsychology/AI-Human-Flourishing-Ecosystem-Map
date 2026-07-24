/* Graph construction from the domain model, force-directed physics, visibility rules. */

import { ROLES, AREA_KEYS, RING_R, RING_W } from './config.js';
import { S, roleColor } from './state.js';
import { orgRoles, primaryRole } from './model.js';
import { updateStats, renderLegend } from './legend.js';

export const rand = (a, b) => a + Math.random() * (b - a);

/* Organization node size scales from 0.5x (barely connected) to 3x (the busiest hub)
   of R_BASE, along a sigmoid so the sparse tail stays small, the crowded middle
   separates quickly, and the few dominant organizations read as clearly dominant. */
const R_BASE = 8, MIN_SCALE = 0.5, MAX_SCALE = 3;
const SIG_MID = 0.3, SIG_K = 8;
const logistic = t => 1 / (1 + Math.exp(-SIG_K * (t - SIG_MID)));
const S0 = logistic(0), S1 = logistic(1);
/* normalized 0..1 sigmoid over the weight range */
export const sigmoid01 = t => (logistic(t) - S0) / (S1 - S0);

/* How strongly an edge reads, given how connected the organizations at its ends are.
   Peripheral organizations' links recede so the dense core of the ecosystem stands out. */
export function edgeProminence(e) {
  if (e.kind === 'spine') return 1;
  const ps = [e.s, e.t].map(n => n.prom).filter(p => p !== undefined);
  return ps.length ? Math.min(...ps) : 1;
}

export function buildGraph() {
  const old = {}; S.nodes.forEach(n => old[n.id] = n);
  S.nodes = []; S.edges = []; S.nodeById = {}; S.adj = {};
  const nodes = S.nodes, edges = S.edges, nodeById = S.nodeById, adj = S.adj;
  const data = S.data;
  const add = n => { nodes.push(n); nodeById[n.id] = n; adj[n.id] = adj[n.id] || new Set(); };
  const connect = (a, b) => { adj[a.id].add(b.id); adj[b.id].add(a.id); };

  // central concept node
  {
    const prev = old['root'];
    add({ id:'root', kind:'root', ref:{
      name:'AI × Human Flourishing',
      desc:'The movement to understand — and deliberately design — how artificial intelligence can support human wellbeing, agency, meaning, and connection. This atlas maps the research hubs, universities, labs, nonprofits, funders, and policy bodies shaping it.' },
      r:15, ax:0, ay:0,
      x: prev ? prev.x : 0, y: prev ? prev.y : 0, vx:0, vy:0 });
  }
  const rootNode = nodeById['root'];

  // role anchor nodes (skip 'hub' — the hub org links directly to the center)
  const roleKeys = Object.keys(ROLES).filter(k => k !== 'hub' && data.orgs.some(o => orgRoles(o).includes(k)));
  const R = 470;
  roleKeys.forEach((k, i) => {
    const ang = (i / roleKeys.length) * Math.PI * 2 - Math.PI / 2;
    const id = 'role:' + k;
    const prev = old[id];
    add({ id, kind:'role', role:k, ref:{ name:ROLES[k].label, desc:ROLES[k].desc }, r:19,
      ax: Math.cos(ang) * R, ay: Math.sin(ang) * R,
      x: prev ? prev.x : Math.cos(ang) * R, y: prev ? prev.y : Math.sin(ang) * R, vx:0, vy:0 });
  });

  // Prominence drives node size and how strongly an organization's edges read.
  // Weight = projects it leads + projects it collaborates on + cross-org connections.
  const degree = {};
  data.links.forEach(l => { degree[l.a] = (degree[l.a] || 0) + 1; degree[l.b] = (degree[l.b] || 0) + 1; });
  const shared = {};
  data.orgs.forEach(o => o.projects.forEach(p => (p.collab || []).forEach(c => { shared[c] = (shared[c] || 0) + 1; })));
  const weightOf = o => o.projects.length + (shared[o.id] || 0) + (degree[o.id] || 0);
  const maxW = Math.max(1, ...data.orgs.map(weightOf));
  data.orgs.forEach(o => {
    const prev = old[o.id], pr = primaryRole(o), hub = pr === 'hub';
    const deg = (degree[o.id] || 0) + Math.max(0, orgRoles(o).length - 1);
    const weight = weightOf(o);
    const prom = sigmoid01(weight / maxW);
    const r = R_BASE * (MIN_SCALE + (MAX_SCALE - MIN_SCALE) * prom);
    const roleNode = nodeById['role:' + pr];
    const bx = hub ? 60 : (roleNode ? roleNode.ax : 0), by = hub ? -60 : (roleNode ? roleNode.ay : 0);
    add({ id:o.id, kind:'org', ref:o, r, deg, weight, prom,
      x: prev ? prev.x : bx * .9 + rand(-120, 120), y: prev ? prev.y : by * .9 + rand(-120, 120), vx:0, vy:0 });
  });

  // root ↔ role spokes, root ↔ hub org
  roleKeys.forEach(k => {
    const rn = nodeById['role:' + k];
    if (rn) { edges.push({ s:rootNode, t:rn, rest:R * .92, kind:'spine' }); connect(rootNode, rn); }
  });
  const hubNode = nodeById[data.orgs.find(o => primaryRole(o) === 'hub')?.id];
  if (hubNode) { edges.push({ s:rootNode, t:hubNode, rest:150, kind:'spine' }); connect(rootNode, hubNode); }
  // role ↔ org (every role an org belongs to)
  data.orgs.forEach(o => {
    const n = nodeById[o.id];
    orgRoles(o).forEach((rk, ri) => {
      const rn = nodeById['role:' + rk];
      if (n && rn) { edges.push({ s:rn, t:n, rest: ri > 0 ? 320 : 150, kind:'role', secondary: ri > 0 }); connect(rn, n); }
    });
  });
  // org ↔ project
  data.orgs.forEach(o => {
    const n = nodeById[o.id];
    o.projects.forEach((p, j) => {
      const prev = old[p.id];
      const pa = Math.atan2(n.y, n.x) + (j / (o.projects.length || 1)) * Math.PI * 2;
      add({ id:p.id, kind:'proj', ref:p, org:o, r:4, prom:n.prom,
        x: prev ? prev.x : n.x + Math.cos(pa) * (n.r + 40) + rand(-6, 6),
        y: prev ? prev.y : n.y + Math.sin(pa) * (n.r + 40) + rand(-6, 6), vx:0, vy:0 });
      edges.push({ s:n, t:nodeById[p.id], rest:n.r + 30 + (j % 3) * 8, kind:'proj' });
      connect(n, nodeById[p.id]);
    });
  });
  // shared projects: extra edges to collaborating orgs
  data.orgs.forEach(o => {
    o.projects.forEach(p => {
      (p.collab || []).forEach(cid => {
        const cn = nodeById[cid], pn = nodeById[p.id];
        if (cn && pn && cid !== o.id) { edges.push({ s:cn, t:pn, rest:cn.r + 42, kind:'proj' }); connect(cn, pn); }
      });
    });
  });
  // cross-org links
  data.links.forEach(l => {
    const a = nodeById[l.a], b = nodeById[l.b];
    if (!a || !b) return;
    connect(a, b);
    edges.push({ s:a, t:b, rest:340, kind:'link', label:l.label });
  });
  updateStats(); renderLegend();
}

export function colorOf(n) {
  if (n.kind === 'root') return roleColor('hub');
  if (n.kind === 'role') return roleColor(n.role);
  const o = n.kind === 'org' ? n.ref : n.org;
  return roleColor(primaryRole(o));
}
export function rolesOfNode(n) { return n.kind === 'role' ? [n.role] : (n.kind === 'org' ? orgRoles(n.ref) : orgRoles(n.org)); }
export function nodeAreas(n) {
  if (n.kind === 'org') return n.ref.areas || [];
  if (n.kind === 'proj') return (n.ref.areas && n.ref.areas.length) ? n.ref.areas : (n.org.areas || []);
  return [];
}
export function arcBounds(i) {
  const gap = .05, span = Math.PI * 2 / AREA_KEYS.length;
  return [-Math.PI / 2 + i * span + gap, -Math.PI / 2 + (i + 1) * span - gap];
}
export function arcHit(px, py) {
  if (!S.showRing) return null;
  const wx = (px - S.tx) / S.zk, wy = (py - S.ty) / S.zk, d = Math.hypot(wx, wy);
  if (Math.abs(d - RING_R) > RING_W) return null;
  const th = Math.atan2(wy, wx);
  for (let i = 0; i < AREA_KEYS.length; i++) {
    const [s, e] = arcBounds(i);
    let t = th; while (t < s) t += Math.PI * 2;
    if (t <= e) return AREA_KEYS[i];
  }
  return null;
}

export function matches(n) {
  if (!S.query) return true;
  const q = S.query.toLowerCase(), r = n.ref;
  const pool = [r.name, r.desc, (r.people || []).join(' '), (r.tags || []).join(' '),
    (r.keywords || []).join(' '), r.location || '',
    Object.values(r.extra || {}).join(' ')].join(' ').toLowerCase();
  return pool.includes(q);
}
export function visible(n) {
  if (n.kind === 'root') return true;
  if (!rolesOfNode(n).some(r => S.roleOn[r])) return false;
  if (!S.query) return true;
  if (n.kind === 'role') return S.data.orgs.some(o => orgRoles(o).includes(n.role) && matches(S.nodeById[o.id]));
  if (n.kind === 'org') return matches(n) || n.ref.projects.some(p => matches(S.nodeById[p.id]));
  return matches(n) || matches(S.nodeById[n.org.id]);
}

/* ---------- physics ---------- */
export function step() {
  const nodes = S.nodes, edges = S.edges;
  const N = nodes.length;
  for (let i = 0; i < N; i++) { const a = nodes[i];
    for (let j = i + 1; j < N; j++) { const b = nodes[j];
      let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = rand(-1, 1); dy = rand(-1, 1); d2 = 1; }
      if (d2 > 300000) continue;
      const d = Math.sqrt(d2), rep = 210 * (a.r + b.r) / d2, fx = dx / d * rep, fy = dy / d * rep;
      a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
    } }
  for (const e of edges) {
    let dx = e.t.x - e.s.x, dy = e.t.y - e.s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const k = e.kind === 'proj' ? 0.05 : e.kind === 'role' ? (e.secondary ? 0.006 : 0.025) : e.kind === 'spine' ? 0.02 : 0.004;
    const f = (d - e.rest) * k, fx = dx / d * f * .5, fy = dy / d * f * .5;
    e.s.vx += fx; e.s.vy += fy; e.t.vx -= fx; e.t.vy -= fy;
  }
  for (const n of nodes) {
    if (n.kind === 'root') { n.vx += (n.ax - n.x) * 0.09; n.vy += (n.ay - n.y) * 0.09; }
    else if (n.kind === 'role') { n.vx += (n.ax - n.x) * 0.05; n.vy += (n.ay - n.y) * 0.05; }
    else if (n.kind === 'org') {
      const g = n.ref.role === 'hub' ? 0.008 : 0.0016;
      n.vx -= n.x * g; n.vy -= n.y * g;
    } else { n.vx -= n.x * 0.0004; n.vy -= n.y * 0.0004; }
    if (S.showRing && n.kind !== 'root') {
      const d = Math.hypot(n.x, n.y);
      if (d > RING_R - 90) { const f = (d - (RING_R - 90)) * 0.004; n.vx -= n.x / d * f; n.vy -= n.y / d * f; }
    }
    if (n === S.dragNode) { n.vx = 0; n.vy = 0; continue; }
    n.vx *= 0.84; n.vy *= 0.84; n.x += n.vx; n.y += n.vy;
  }
}
