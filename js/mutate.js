/* Single write-back point for edits made through the map UI (forms, panel actions):
   pushes S.data into the CSV store, rebuilds the graph, refreshes any open overlay. */

import { S } from './state.js';
import { syncStoreFromData } from './model.js';
import { buildGraph } from './graph.js';
import { refreshOverlay } from './overlay.js';

export function afterMutate() {
  syncStoreFromData();
  buildGraph();
  if (S.overlayView) refreshOverlay();
}
