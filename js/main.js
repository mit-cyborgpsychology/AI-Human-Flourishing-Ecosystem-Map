/* App entry point: load the CSV store, build the model + graph, wire the chrome. */

import { S } from './state.js';
import { store } from './store.js';
import { rebuildData } from './model.js';
import { buildGraph } from './graph.js';
import { initView, initInteraction, startLoop, fitRing, zoomStep, ZOOM_MIN, ZOOM_MAX } from './canvas.js';
import { initPanel, select, panelEl } from './panel.js';
import { initEditGate, orgForm } from './forms.js';
import { initOverlay, closeOverlay } from './overlay.js';
import { toast, confirmModal, closeModal, scrim } from './dom.js';
import { refreshOverlay } from './overlay.js';

async function boot() {
  try {
    await store.init();
  } catch (e) {
    document.getElementById('stats').textContent =
      'Could not load data/*.csv — serve this folder over HTTP (e.g. python3 -m http.server).';
    throw e;
  }

  // any change to the CSV tables re-derives the model and the map
  store.onChange = () => {
    rebuildData();
    buildGraph();
    if (S.overlayView) refreshOverlay();
    if (S.selected && !S.nodeById[S.selected.id]) select(null);
  };

  rebuildData();
  initView();
  buildGraph();
  initInteraction();
  initPanel();
  initEditGate();
  initOverlay();
  wireChrome();
  startLoop();
}

/* ---- zoom + full page ---- */
const FS_ICON = {
  enter: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
  exit:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>',
};
const fullscreenEl = () => document.fullscreenElement || document.webkitFullscreenElement;

function wireViewControls() {
  const zin = document.getElementById('zoomInBtn');
  const zout = document.getElementById('zoomOutBtn');
  const full = document.getElementById('fullBtn');

  // grey a button out once the map is already at that end of the zoom range
  let lastZk = null;
  const syncZoom = () => {
    if (S.zk === lastZk) return;
    lastZk = S.zk;
    zin.disabled = S.zk >= ZOOM_MAX - 1e-6;
    zout.disabled = S.zk <= ZOOM_MIN + 1e-6;
  };
  zin.addEventListener('click', () => { zoomStep(1.35); syncZoom(); });
  zout.addEventListener('click', () => { zoomStep(1 / 1.35); syncZoom(); });
  setInterval(syncZoom, 400);   // keeps the buttons honest after wheel/pinch zoom
  syncZoom();

  const syncFull = () => {
    const on = !!fullscreenEl();
    full.innerHTML = on ? FS_ICON.exit : FS_ICON.enter;
    full.title = on ? 'Exit full page' : 'Full page';
    full.setAttribute('aria-label', full.title);
  };
  full.addEventListener('click', async () => {
    try {
      if (fullscreenEl()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else {
        const el = document.documentElement;
        await (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      }
    } catch (e) { toast('Full page not available in this browser'); }
  });
  document.addEventListener('fullscreenchange', syncFull);
  document.addEventListener('webkitfullscreenchange', syncFull);
  syncFull();
}

function wireChrome() {
  wireViewControls();
  document.getElementById('addOrgBtn').addEventListener('click', () => orgForm(null));

  document.getElementById('resetBtn').addEventListener('click', () => {
    confirmModal('Reset the map to the original CSV seed data? Your edits in this browser will be lost.', async () => {
      await store.reset();
      select(null);
      toast('Reset to seed data');
    });
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    store.exportAll();
    toast('orgs.csv, projects.csv, links.csv exported');
  });

  const ringBtn = document.getElementById('ringBtn');
  ringBtn.addEventListener('click', () => {
    S.showRing = !S.showRing;
    ringBtn.textContent = S.showRing ? 'Hide ring' : 'Show ring';
    if (S.showRing) { fitRing(); }
    else {
      S.hoveredArea = null;
      if (S.selectedArea) { S.selectedArea = null; panelEl.classList.remove('open'); }
    }
    toast(S.showRing ? 'Flourishing ring shown' : 'Flourishing ring hidden');
  });

  const projBtn = document.getElementById('projBtn');
  projBtn.addEventListener('click', () => {
    S.showProjects = !S.showProjects;
    projBtn.textContent = S.showProjects ? 'Hide projects' : 'Show projects';
    projBtn.classList.toggle('primary', !S.showProjects);
    toast(S.showProjects ? 'Projects shown' : 'Projects hidden');
  });

  const q = document.getElementById('q');
  q.addEventListener('input', () => { S.query = q.value.trim(); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (scrim.classList.contains('open')) closeModal();
      else if (S.overlayView) closeOverlay();
      else if (S.selected || S.selectedArea) select(null);
      else if (S.query) { q.value = ''; S.query = ''; }
    }
    if (e.key === '/' && document.activeElement !== q && !scrim.classList.contains('open')
        && !e.target.closest?.('#overlay')) {
      e.preventDefault(); q.focus();
    }
  });
}

boot();
