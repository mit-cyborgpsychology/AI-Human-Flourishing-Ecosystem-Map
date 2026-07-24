/* Canvas rendering (network, ring, labels) and pointer/zoom interaction. */

import { ROLES, AREAS, AREA_KEYS, RING_R, RING_W, SANS } from './config.js';
import { S, theme } from './state.js';
import { step, colorOf, nodeAreas, arcBounds, arcHit, visible, edgeProminence, edgeAvgProminence } from './graph.js';

/* Connections and project spokes are fully opaque. Connection width ramps along the
   sigmoid prominence of the two organizations it joins; project spokes are uniform. */
const LINK_ALPHA = 1, LINK_W_MIN = 0.4, LINK_W_MAX = 0.9;
const PROJ_ALPHA = 1, PROJ_WIDTH = 0.4;
const ROLE_ALPHA = 1, ROLE_WIDTH = 0.6;
import { select, selectArea } from './panel.js';

const cv = document.getElementById('net'), ctx = cv.getContext('2d');

export function resize() {
  S.dpr = Math.min(devicePixelRatio || 1, 2);
  const oW = S.W, oH = S.H;
  S.W = innerWidth; S.H = innerHeight;
  cv.width = S.W * S.dpr; cv.height = S.H * S.dpr;
  cv.style.width = S.W + 'px'; cv.style.height = S.H + 'px';
  if (oW) { if (S.showRing && !S.userMoved) fitRing(); else { S.tx += (S.W - oW) / 2; S.ty += (S.H - oH) / 2; } }
}
export function fitRing() {
  // pad past the ring itself so its area labels, drawn at RING_R + 64, stay on screen
  S.zk = Math.max(.24, Math.min(.9, Math.min(S.W, S.H) / (2 * (RING_R + 250))));
  S.tx = S.W / 2; S.ty = S.H / 2;
}
export function initView() {
  addEventListener('resize', resize);
  resize();
  S.tx = S.W / 2; S.ty = S.H / 2;
  S.zk = Math.max(.42, Math.min(1, Math.min(S.W, S.H) / 1280));
  if (S.showRing) fitRing();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
function curve(ax, ay, bx, by, bend) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const dx = bx - ax, dy = by - ay, d = Math.sqrt(dx * dx + dy * dy) || 1;
  const ox = -dy / d * d * bend, oy = dx / d * d * bend;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx + ox, my + oy, bx, by); ctx.stroke();
}
const iconCache = {};
function drawIconScreen(d, cx, cy, size, color, alpha) {
  let p = iconCache[d]; if (!p) { p = new Path2D(d); iconCache[d] = p; }
  const s = size / 24;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-12, -12);
  ctx.strokeStyle = color; ctx.lineWidth = 1.7 / s;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.stroke(p);
  ctx.restore();
}

export function draw() {
  const PAL = theme.pal;
  const { W, H, dpr, tx, ty, zk } = S;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, W, H);
  // subtle dot grid
  const gs = 26 * zk < 12 ? 52 * zk : 26 * zk;
  ctx.fillStyle = PAL.dots;
  const ox = tx % gs, oy = ty % gs;
  for (let x = ox; x < W; x += gs) for (let y = oy; y < H; y += gs) { ctx.fillRect(x, y, 1.5, 1.5); }

  const focus = S.hovered || S.selected;
  const inFocus = id => focus && (id === focus.id || S.adj[focus.id]?.has(id));
  ctx.setTransform(dpr * zk, 0, 0, dpr * zk, dpr * tx, dpr * ty);
  ctx.lineCap = 'round';

  // flourishing ring: six arc segments + node→area threads
  if (S.showRing) {
    ctx.lineCap = 'butt';
    for (let i = 0; i < AREA_KEYS.length; i++) {
      const k = AREA_KEYS[i], [s, e] = arcBounds(i), col = AREAS[k].color;
      const active = S.selectedArea === k || S.hoveredArea === k;
      ctx.beginPath(); ctx.arc(0, 0, RING_R, s, e);
      ctx.strokeStyle = hexA(col, active ? .6 : (S.selectedArea ? .13 : .25));
      ctx.lineWidth = active ? RING_W + 8 : RING_W;
      ctx.stroke();
    }
    ctx.lineCap = 'round';
    for (const n of S.nodes) {
      if (n.kind !== 'org' && n.kind !== 'proj') continue;
      if (n.kind === 'proj' && !S.showProjects) continue;
      const list = nodeAreas(n); if (!list.length) continue;
      const isOrgN = n.kind === 'org';
      for (const k of list) {
        const i = AREA_KEYS.indexOf(k); if (i < 0) continue;
        const [s, e] = arcBounds(i), col = AREAS[k].color;
        // every thread for an area meets the ring at the centre of that segment,
        // so each flourishing area reads as one anchor point rather than a smear
        const t = (s + e) / 2;
        const ax = Math.cos(t) * (RING_R - RING_W / 2 - 2), ay = Math.sin(t) * (RING_R - RING_W / 2 - 2);
        const np = n.prom ?? 1;
        let a = (isOrgN ? .16 : .09) * (.3 + .7 * np), w = isOrgN ? .9 : .6;
        if (S.selectedArea === k) { a = isOrgN ? .5 : .32; w = isOrgN ? 1.2 : .9; }
        else if (S.selectedArea) a = .02;
        if (focus && focus.id === n.id) { a = .85; w = 1.6; }
        else if (focus && !inFocus(n.id)) a = Math.min(a, .03);
        ctx.strokeStyle = hexA(col, a); ctx.lineWidth = w / zk;
        curve(n.x, n.y, ax, ay, .05);
      }
    }
  }

  // edges
  for (const e of S.edges) {
    if (e.kind === 'proj' && !S.showProjects) continue;
    const vis = visible(e.s) && visible(e.t);
    let a, w, col, bend = 0, grad = null;
    if (e.kind === 'proj') { a = .45; w = .8; col = colorOf(e.s); }
    else if (e.kind === 'role') { a = .55; w = 1.15; col = colorOf(e.s); bend = .06; }
    else if (e.kind === 'spine') { a = .5; w = 1.3; col = colorOf(e.t); bend = .04; }
    else { a = .7; w = 1.5; col = PAL.link; bend = .13; grad = [colorOf(e.s), colorOf(e.t)]; }
    // connections and project spokes all read the same; only the role spokes
    // recede with how sparsely connected their ends are
    if (e.kind === 'link') {
      a = LINK_ALPHA;
      w = LINK_W_MIN + (LINK_W_MAX - LINK_W_MIN) * edgeAvgProminence(e);
    }
    else if (e.kind === 'proj') { a = PROJ_ALPHA; w = PROJ_WIDTH; }
    else if (e.kind === 'role') { a = ROLE_ALPHA; w = ROLE_WIDTH; }
    else {
      const ep = edgeProminence(e);
      a *= .25 + .75 * ep;
      w *= .6 + .4 * ep;
    }
    if (!vis) a = .06;
    if (focus) {
      const on = inFocus(e.s.id) && inFocus(e.t.id) && (e.s.id === focus.id || e.t.id === focus.id);
      if (on) { a = 1; w += .7; col = e.kind === 'link' ? PAL.link : colorOf(e.s.kind === 'role' ? e.s : (e.t.kind === 'role' ? e.t : e.s)); grad = null; }
      else a = Math.min(a, .09);
    }
    if (S.selectedArea && !focus) {
      const inA = x => (x.kind === 'org' || x.kind === 'proj') && nodeAreas(x).includes(S.selectedArea);
      if (!(inA(e.s) && inA(e.t))) a = Math.min(a, .07);
    }
    if (grad) {
      const g = ctx.createLinearGradient(e.s.x, e.s.y, e.t.x, e.t.y);
      g.addColorStop(0, hexA(grad[0], a)); g.addColorStop(1, hexA(grad[1], a));
      ctx.strokeStyle = g;
    } else ctx.strokeStyle = hexA(col, a);
    ctx.lineWidth = w / zk;
    if (bend) curve(e.s.x, e.s.y, e.t.x, e.t.y, bend);
    else { ctx.beginPath(); ctx.moveTo(e.s.x, e.s.y); ctx.lineTo(e.t.x, e.t.y); ctx.stroke(); }
  }

  // nodes (projects under orgs under roles under root)
  const order = { proj:0, org:1, role:2, root:3 };
  const sorted = [...S.nodes].sort((a, b) => (order[a.kind] - order[b.kind]) || ((a.ref.role === 'hub') - (b.ref.role === 'hub')));
  for (const n of sorted) {
    if (n.kind === 'proj' && !S.showProjects) continue;
    const c = colorOf(n), vis = visible(n);
    let a = vis ? 1 : 0.12;
    if (focus && !inFocus(n.id)) a = Math.min(a, .15);
    if (S.selectedArea && !focus) {
      if (n.kind === 'org' || n.kind === 'proj') { if (!nodeAreas(n).includes(S.selectedArea)) a = Math.min(a, .12); }
      else a = Math.min(a, .5);
    }
    ctx.globalAlpha = a;
    const hot = n === S.hovered || n === S.selected;
    if (n.kind === 'root') {
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7);
      ctx.fillStyle = hexA(c, .14); ctx.fill();
      ctx.lineWidth = (hot ? 3 : 2.4) / Math.sqrt(zk); ctx.strokeStyle = c; ctx.stroke();
      ctx.beginPath(); ctx.arc(n.x, n.y, 5, 0, 7); ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 6, 0, 7);
      ctx.strokeStyle = hexA(c, .3); ctx.lineWidth = 1.2 / zk; ctx.stroke();
    } else if (n.kind === 'role') {
      const rr = Math.max(n.r, 30 / zk);
      ctx.beginPath(); ctx.arc(n.x, n.y, rr, 0, 7);
      ctx.fillStyle = c; ctx.fill();
      ctx.lineWidth = (hot ? 3 : 2.2) / Math.sqrt(zk); ctx.strokeStyle = PAL.ring; ctx.stroke();
      ctx.beginPath(); ctx.arc(n.x, n.y, rr + 4 / zk, 0, 7);
      ctx.strokeStyle = hexA(c, .5); ctx.lineWidth = 1.2 / zk; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + (hot ? 1.5 : 0), 0, 7);
      ctx.fillStyle = c; ctx.fill();
      ctx.lineWidth = 2 / Math.sqrt(zk); ctx.strokeStyle = PAL.ring; ctx.stroke();
      if (n.ref.role === 'hub' || n.deg >= 4) {
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 5, 0, 7);
        ctx.strokeStyle = hexA(c, .35); ctx.lineWidth = 1.4 / zk; ctx.stroke();
      }
    }
    if (n === S.selected) {
      const er = n.kind === 'role' ? Math.max(n.r, 30 / zk) : n.r;
      ctx.beginPath(); ctx.arc(n.x, n.y, er + (n.kind === 'org' || n.kind === 'proj' ? 5 : 8 / zk), 0, 7);
      ctx.strokeStyle = hexA(c, .9); ctx.lineWidth = 1.6 / zk; ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // labels (screen space) — all visible, sized by hierarchy: root > role > org > project
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textAlign = 'center';
  for (const n of sorted) {
    const kind = n.kind;
    if (kind === 'proj' && !S.showProjects) continue;
    const vis = visible(n);
    let a = vis ? 1 : .12;
    if (focus && !inFocus(n.id)) a = Math.min(a, .12);
    if (S.selectedArea && !focus) {
      if (kind === 'org' || kind === 'proj') { if (!nodeAreas(n).includes(S.selectedArea)) a = Math.min(a, .1); }
      else a = Math.min(a, .55);
    }
    const offset = kind === 'root' ? 26 : kind === 'role' ? 22 : kind === 'org' ? 13 : 9;
    const rEff = kind === 'role' ? Math.max(n.r * zk, 30) : n.r * zk;
    const sx = n.x * zk + tx;
    const sy = kind === 'root' ? n.y * zk + ty - rEff - 16 : n.y * zk + ty + rEff + offset;
    if (sx < -220 || sx > W + 220 || sy < -40 || sy > H + 40) continue;
    if (kind === 'role') {
      const cx = n.x * zk + tx, cy = n.y * zk + ty;
      const sr = Math.max(n.r * zk, 30), isz = Math.min(42, sr * 1.0);
      drawIconScreen(ROLES[n.role].icon, cx, cy, isz, PAL.ring, a);
    }
    let label = n.ref.name, font, fill, boxH = 15;
    if (kind === 'root') {
      font = '800 20px ' + SANS; fill = colorOf(n); ctx.letterSpacing = '0.3px'; boxH = 23; }
    else if (kind === 'role') { label = label.toUpperCase();
      font = '750 16px ' + SANS; fill = colorOf(n); ctx.letterSpacing = '1.6px'; boxH = 20; }
    else if (kind === 'org') {
      const hub = n.ref.role === 'hub';
      const boost = 1.75 * (n.prom ?? 0);
      const zb = Math.min(2, Math.max(1, zk / .55));
      const fs = ((hub ? 7.5 : 6.5) + boost) * zb;
      font = (boost > .9 ? '680 ' : '570 ') + fs.toFixed(1) + 'px ' + SANS;
      fill = PAL.ink; ctx.letterSpacing = '0px'; boxH = fs + 4; }
    else {
      const zb = Math.min(2, Math.max(1, zk / .55));
      const pfs = 4.25 * zb;
      font = '400 ' + pfs.toFixed(1) + 'px ' + SANS; fill = PAL.muted; ctx.letterSpacing = '0px'; boxH = pfs + 4; }
    ctx.font = font;
    const tw = ctx.measureText(label).width;
    ctx.globalAlpha = a;
    ctx.fillStyle = PAL.labelBg;
    ctx.fillRect(sx - tw / 2 - 4, sy - boxH + 4, tw + 8, boxH);
    ctx.fillStyle = fill;
    ctx.fillText(label, sx, sy + 3);
  }
  // ring segment labels
  if (S.showRing) {
    for (let i = 0; i < AREA_KEYS.length; i++) {
      const k = AREA_KEYS[i], [s, e] = arcBounds(i), mid = (s + e) / 2, col = AREAS[k].color;
      const lx = Math.cos(mid) * (RING_R + 64) * zk + tx, ly = Math.sin(mid) * (RING_R + 64) * zk + ty;
      if (lx < -260 || lx > W + 260 || ly < -60 || ly > H + 60) continue;
      const active = S.selectedArea === k || S.hoveredArea === k;
      ctx.font = (active ? '800 13px ' : '750 12.5px ') + SANS; ctx.letterSpacing = '1.1px';
      ctx.globalAlpha = S.selectedArea && !active ? .35 : 1;
      const parts = AREAS[k].label.toUpperCase().split(' & ');
      parts.forEach((ln, li) => {
        const txt = (li === 0 && parts.length > 1) ? ln + ' &' : ln;
        const yy = ly + (li - (parts.length - 1) / 2) * 16;
        const tw = ctx.measureText(txt).width;
        ctx.fillStyle = PAL.labelBg; ctx.fillRect(lx - tw / 2 - 4, yy - 10, tw + 8, 15);
        ctx.fillStyle = col; ctx.fillText(txt, lx, yy + 2);
      });
    }
    ctx.globalAlpha = 1;
  }
  ctx.letterSpacing = '0px';
  ctx.globalAlpha = 1;
}

export function startLoop() {
  for (let i = 0; i < 600; i++) step();
  const loop = () => { step(); draw(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  setTimeout(() => { const h = document.getElementById('hint'); if (h) h.style.opacity = 0; }, 7000);
}

/* ---------- interaction ---------- */
export const toScreen = n => ({ x: n.x * S.zk + S.tx, y: n.y * S.zk + S.ty });

function hitTest(px, py) {
  const wx = (px - S.tx) / S.zk, wy = (py - S.ty) / S.zk;
  let best = null, bd = 1e9;
  for (const n of S.nodes) {
    if (n.kind === 'proj' && !S.showProjects) continue;
    const er = n.kind === 'role' ? Math.max(n.r, 30 / S.zk) : n.r;
    const d = Math.hypot(n.x - wx, n.y - wy), lim = er + 7 / S.zk;
    if (d < lim && d < bd) { best = n; bd = d; }
  }
  return best;
}

const pointers = new Map();
let panStart = null, dragMoved = 0, pinch0 = null;

export function initInteraction() {
  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      pinch0 = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), k: S.zk, mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2, tx: S.tx, ty: S.ty };
      S.dragNode = null; panStart = null; return;
    }
    dragMoved = 0;
    const n = hitTest(e.clientX, e.clientY);
    if (n) { S.dragNode = n; }
    else { panStart = { x: e.clientX, y: e.clientY, tx: S.tx, ty: S.ty }; cv.classList.add('grabbing'); }
  });
  cv.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) {
      const p = pointers.get(e.pointerId);
      dragMoved += Math.hypot(e.clientX - p.x, e.clientY - p.y);
      p.x = e.clientX; p.y = e.clientY;
    }
    if (pointers.size === 2 && pinch0) {
      const [p1, p2] = [...pointers.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      S.userMoved = true;
      const nk = Math.min(3, Math.max(.3, pinch0.k * d / pinch0.d));
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      S.tx = mx - (pinch0.mx - pinch0.tx) * nk / pinch0.k;
      S.ty = my - (pinch0.my - pinch0.ty) * nk / pinch0.k;
      S.zk = nk; return;
    }
    if (S.dragNode) {
      S.userMoved = true;
      S.dragNode.x = (e.clientX - S.tx) / S.zk; S.dragNode.y = (e.clientY - S.ty) / S.zk;
      return;
    }
    if (panStart) {
      if (dragMoved > 4) S.userMoved = true;
      S.tx = panStart.tx + (e.clientX - panStart.x);
      S.ty = panStart.ty + (e.clientY - panStart.y); return;
    }
    const n = hitTest(e.clientX, e.clientY);
    S.hovered = n;
    S.hoveredArea = n ? null : arcHit(e.clientX, e.clientY);
    cv.classList.toggle('pointing', !!n || !!S.hoveredArea);
  });
  const endPointer = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch0 = null;
    cv.classList.remove('grabbing');
    if (S.dragNode && dragMoved < 5) { select(S.dragNode); }
    else if (!S.dragNode && panStart && dragMoved < 5) {
      const ah = arcHit(e.clientX, e.clientY);
      if (ah) selectArea(ah); else select(null);
    }
    S.dragNode = null; panStart = null;
  };
  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('pointercancel', endPointer);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * .0013), e.clientX, e.clientY);
  }, { passive: false });
}

export const ZOOM_MIN = .3, ZOOM_MAX = 3;

/* Scale by `factor`, keeping the screen point (px,py) fixed. */
export function zoomAt(factor, px, py) {
  const nk = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, S.zk * factor));
  if (nk === S.zk) return;
  S.tx = px - (px - S.tx) * nk / S.zk;
  S.ty = py - (py - S.ty) * nk / S.zk;
  S.zk = nk;
  S.userMoved = true;
}

/* Button zoom: anchor on the centre of the map area still visible beside the panel. */
export function zoomStep(factor) {
  const panelOpen = document.getElementById('panel').classList.contains('open');
  const pad = (panelOpen && innerWidth > 760) ? Math.min(400, innerWidth) : 0;
  zoomAt(factor, (S.W - pad) / 2, S.H / 2);
}
