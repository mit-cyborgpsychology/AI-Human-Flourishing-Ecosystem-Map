// One-off migration: extract people out of orgs.csv / projects.csv into data/people.csv
// (people columns now hold person IDs), and add a `type` column to links.csv
// (fund | support | collaborate, inferred from the label; audit and correct as needed).
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

/* Minimal CSV helpers (mirrors js/csv.js, which is an untyped browser ES module). */
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  const src = String(text ?? '').replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i+1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i+1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  while (rows.length && rows[rows.length-1].every(c => c === '')) rows.pop();
  const columns = rows[0].map(c => c.trim());
  const records = rows.slice(1).map(r => Object.fromEntries(columns.map((c, j) => [c, r[j] ?? ''])));
  return { columns, records };
}
const escCell = v => /[",\n\r]/.test(String(v ?? '')) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v ?? '');
const serializeCSV = (cols, recs) =>
  [cols.map(escCell).join(','), ...recs.map(r => cols.map(c => escCell(r[c])).join(','))].join('\n') + '\n';
const splitList = s => String(s ?? '').split('|').map(x => x.trim()).filter(Boolean);
const joinList = a => (a || []).join('|');

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const dataDir = path.join(root, 'data');
const read = f => parseCSV(fs.readFileSync(path.join(dataDir, f), 'utf8'));
const write = (f, cols, recs) => fs.writeFileSync(path.join(dataDir, f), serializeCSV(cols, recs));

const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const orgs = read('orgs.csv');
const projects = read('projects.csv');
const links = read('links.csv');

const people = new Map(); // id → name, in order of first appearance
const toIds = s => joinList(splitList(s).map(n => {
  const id = slug(n) || 'person';
  if (!people.has(id)) people.set(id, n);
  return id;
}));
orgs.records.forEach(r => { r.people = toIds(r.people); });
projects.records.forEach(r => { r.people = toIds(r.people); });

const typeOf = label =>
  /fund|grant|philanthrop/i.test(label) ? 'fund' :
  /support|coalition|member/i.test(label) ? 'support' : 'collaborate';
links.records.forEach(r => { r.type = r.type || typeOf(r.label || ''); });

write('orgs.csv', orgs.columns, orgs.records);
write('projects.csv', projects.columns, projects.records);
write('links.csv', ['source_id', 'target_id', 'type', 'label'], links.records);
write('people.csv', ['id', 'name', 'title', 'url'],
  [...people.entries()].map(([id, name]) => ({ id, name, title: '', url: '' })));
console.log(`people.csv: ${people.size} people · links.csv: typed ${links.records.length} rows`);
