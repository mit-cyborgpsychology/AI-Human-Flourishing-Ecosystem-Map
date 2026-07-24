/* Relationship direction.

   links.csv stores a connection one way — source_id → target_id — but people
   describe it from whichever end they happen to be standing at: an organization
   is "funded by" as often as it "funds". Every picker therefore offers both
   directions, and choosing an incoming one simply swaps the row's two ends.
   Nothing downstream has to know: the stored row stays a plain source → target. */

import { LINK_TYPES } from './config.js';

const IN = ':in';
const symmetric = t => LINK_TYPES[t].inLabel === LINK_TYPES[t].outLabel;

/* "fund" → funds · "fund:in" → funded by */
export function parseDirection(value) {
  const raw = String(value || '');
  const type = raw.replace(IN, '');
  return { type: LINK_TYPES[type] ? type : 'collaborate', incoming: raw.endsWith(IN) };
}

export const directionValue = (type, incoming) =>
  (incoming && LINK_TYPES[type] && !symmetric(type)) ? type + IN : type;

/* the picker, phrased from `subject`'s point of view */
export function directionField(id, selected = 'collaborate') {
  const opts = [];
  for (const [type, t] of Object.entries(LINK_TYPES)) {
    opts.push([type, t.outLabel]);
    if (!symmetric(type)) opts.push([type + IN, t.inLabel]);
  }
  return `<div class="field"><label>Relationship</label><select id="${id}">${
    opts.map(([v, l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`).join('')
  }</select></div>`;
}

/* "Mozilla Foundation is funded by MacArthur Foundation" */
export function sentence(subjectName, otherName, value) {
  const { type, incoming } = parseDirection(value);
  const t = LINK_TYPES[type];
  return `${subjectName} ${incoming ? t.inPhrase : t.outPhrase} ${otherName}`;
}

/* the row ends for a connection between `subject` and `other`, given the direction */
export function orient(subjectId, otherId, value) {
  const { type, incoming } = parseDirection(value);
  return incoming
    ? { source_id: otherId, target_id: subjectId, type }
    : { source_id: subjectId, target_id: otherId, type };
}

/* default text label when the curator leaves the label blank */
export const defaultLabel = value => LINK_TYPES[parseDirection(value).type].label.toLowerCase();
