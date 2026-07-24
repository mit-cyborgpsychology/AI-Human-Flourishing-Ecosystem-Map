/* Full-screen overlay infrastructure shared by the CSV data editor and pathway views. */

import { S } from './state.js';
import { renderEditor } from './editor.js';
import { renderPathway } from './pathway.js';
import { select } from './panel.js';

const overlayEl = document.getElementById('overlay');

export function openOverlay(view) {
  S.overlayView = view;
  overlayEl.classList.add('open');
  refreshOverlay();
}
export function closeOverlay() {
  overlayEl.classList.remove('open');
  S.overlayView = null;
}
export function refreshOverlay() {
  if (S.overlayView === 'data') renderEditor();
  else if (S.overlayView === 'pathway') renderPathway();
}
export function openNodeFromOverlay(id) {
  closeOverlay();
  const t = S.nodeById[id];
  if (t) select(t);
}

export function initOverlay() {
  document.getElementById('ovClose').addEventListener('click', closeOverlay);
  document.getElementById('dataBtn').addEventListener('click', () => openOverlay('data'));
  document.getElementById('pathwayBtn').addEventListener('click', () => openOverlay('pathway'));
}
