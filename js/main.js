/* App entry point: load the CSV store, build the model + graph, wire the chrome. */

import { S } from './state.js';
import { store } from './store.js';
import { rebuildData } from './model.js';
import { buildGraph } from './graph.js';
import { initView, initInteraction, startLoop, fitRing } from './canvas.js';
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

function wireChrome() {
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
