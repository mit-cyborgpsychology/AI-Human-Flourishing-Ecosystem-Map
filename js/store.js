/* The internal CSV file system.
   Every piece of atlas data lives in one of three CSV tables (orgs, projects, links).
   Seed CSVs are fetched from data/*.csv; browser edits are persisted back to
   localStorage as CSV text, so what you edit is exactly what you export. */

import { parseCSV, serializeCSV, downloadFile } from './csv.js';

const STORE_KEY = 'ahf-ecosystem-map-csv-v2';

/* Core columns are the ones the map itself understands. They can be edited row-by-row
   but not renamed or deleted. Extra columns added in the Data editor are preserved,
   persisted, exported, and searchable. Types: text · multiline · list · ref · url. */
export const TABLE_DEFS = {
  orgs: {
    label: 'Organizations', file: 'data/orgs.csv', key: 'id',
    columns: [
      { key:'id',          label:'ID',          type:'text',      core:true },
      { key:'name',        label:'Name',        type:'text',      core:true },
      { key:'roles',       label:'Roles',       type:'list',      core:true, hint:'First role is primary. hub|academic|industry|civil|measure|funder|policy|community' },
      { key:'location',    label:'Location',    type:'text',      core:true },
      { key:'url',         label:'URL',         type:'url',       core:true },
      { key:'description', label:'Description', type:'multiline', core:true },
      { key:'people',      label:'People',      type:'reflist', ref:'people', core:true },
      { key:'tags',        label:'Tags',        type:'list',      core:true },
      { key:'keywords',    label:'Keywords',    type:'list',      core:true },
      { key:'areas',       label:'Areas',       type:'list',      core:true, hint:'agency|wellbeing|learning|creativity|purpose|social' },
    ],
  },
  projects: {
    label: 'Projects', file: 'data/projects.csv', key: 'id',
    columns: [
      { key:'id',          label:'ID',          type:'text',      core:true },
      { key:'org_id',      label:'Org ID',      type:'ref', ref:'orgs', core:true },
      { key:'name',        label:'Name',        type:'text',      core:true },
      { key:'description', label:'Description', type:'multiline', core:true },
      { key:'people',      label:'People',      type:'reflist', ref:'people', core:true },
      { key:'tags',        label:'Tags',        type:'list',      core:true },
      { key:'areas',       label:'Areas',       type:'list',      core:true },
      { key:'collab',      label:'Collab orgs', type:'reflist', ref:'orgs', core:true },
      { key:'url',         label:'URL',         type:'url',       core:true },
    ],
  },
  people: {
    label: 'People', file: 'data/people.csv', key: 'id',
    columns: [
      { key:'id',    label:'ID',    type:'text', core:true },
      { key:'name',  label:'Name',  type:'text', core:true },
      { key:'title', label:'Title', type:'text', core:true },
      { key:'url',   label:'URL',   type:'url',  core:true },
    ],
  },
  links: {
    label: 'Connections', file: 'data/links.csv', key: null,
    columns: [
      { key:'source_id', label:'From org', type:'ref', ref:'orgs', core:true },
      { key:'target_id', label:'To org',   type:'ref', ref:'orgs', core:true },
      { key:'type',      label:'Type',     type:'text', core:true, hint:'fund | support | collaborate' },
      { key:'label',     label:'Label',    type:'text', core:true },
    ],
  },
};
export const TABLE_NAMES = Object.keys(TABLE_DEFS);

export const store = {
  /* tables[name] = { columns:[colDef…], rows:[{key:value…}…] } */
  tables: {},
  onChange: null, // set by main.js: called after any mutation

  async init() {
    const saved = this._loadLocal();
    for (const name of TABLE_NAMES) {
      if (saved && saved[name]) {
        this.tables[name] = saved[name];
      } else {
        this.tables[name] = await this._fetchSeed(name);
      }
    }
  },

  async _fetchSeed(name) {
    const def = TABLE_DEFS[name];
    const res = await fetch(def.file, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load ${def.file}: ${res.status}`);
    return this._fromCSV(name, await res.text());
  },

  _fromCSV(name, text) {
    const def = TABLE_DEFS[name];
    const { columns, records } = parseCSV(text);
    // core columns always exist, in canonical order; unknown headers become extra text columns
    const cols = def.columns.map(c => ({ ...c }));
    for (const h of columns) {
      if (h && !cols.some(c => c.key === h)) {
        cols.push({ key: h, label: h, type: 'text', core: false });
      }
    }
    const rows = records.map(r => {
      const o = {};
      for (const c of cols) o[c.key] = r[c.key] ?? '';
      return o;
    });
    return { columns: cols, rows };
  },

  toCSV(name) {
    const t = this.tables[name];
    return serializeCSV(t.columns.map(c => c.key), t.rows);
  },

  /* ---------- persistence ---------- */
  _loadLocal() {
    try {
      const s = localStorage.getItem(STORE_KEY);
      if (!s) return null;
      const parsed = JSON.parse(s);
      const out = {};
      for (const name of TABLE_NAMES) {
        if (!parsed[name]) return null;
        const table = this._fromCSV(name, parsed[name].csv);
        // restore user column metadata (labels/types for non-core columns)
        for (const meta of parsed[name].columns || []) {
          const col = table.columns.find(c => c.key === meta.key);
          if (col && !col.core) Object.assign(col, meta);
        }
        out[name] = table;
      }
      return out;
    } catch (e) { return null; }
  },

  persist() {
    try {
      const payload = {};
      for (const name of TABLE_NAMES) {
        payload[name] = {
          csv: this.toCSV(name),
          columns: this.tables[name].columns.filter(c => !c.core)
            .map(({ key, label, type }) => ({ key, label, type })),
        };
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(payload));
    } catch (e) { /* storage full / private mode — edits stay in memory */ }
  },

  changed() { this.persist(); if (this.onChange) this.onChange(); },

  async reset() {
    localStorage.removeItem(STORE_KEY);
    for (const name of TABLE_NAMES) this.tables[name] = await this._fetchSeed(name);
    if (this.onChange) this.onChange();
  },

  /* ---------- row operations ---------- */
  addRow(name, values = {}) {
    const t = this.tables[name];
    const row = {};
    for (const c of t.columns) row[c.key] = values[c.key] ?? '';
    t.rows.push(row);
    this.changed();
    return row;
  },

  deleteRow(name, row) {
    const t = this.tables[name];
    const i = t.rows.indexOf(row);
    if (i >= 0) t.rows.splice(i, 1);
    if (name === 'orgs' && row.id) this._cascadeOrgDelete(row.id);
    if (name === 'people' && row.id) this._cascadePersonDelete(row.id);
    this.changed();
  },

  _cascadeOrgDelete(orgId) {
    const projects = this.tables.projects, links = this.tables.links;
    projects.rows = projects.rows.filter(r => r.org_id !== orgId);
    for (const r of projects.rows) {
      const collab = (r.collab || '').split('|').map(s => s.trim()).filter(x => x && x !== orgId);
      r.collab = collab.join('|');
    }
    links.rows = links.rows.filter(r => r.source_id !== orgId && r.target_id !== orgId);
  },

  _cascadePersonDelete(personId) {
    for (const name of ['orgs', 'projects']) {
      for (const r of this.tables[name].rows) {
        r.people = (r.people || '').split('|').map(s => s.trim())
          .filter(x => x && x !== personId).join('|');
      }
    }
  },

  setCell(name, row, key, value) {
    row[key] = value;
    this.changed();
  },

  /* ---------- column operations ---------- */
  addColumn(name, label, type = 'text') {
    const t = this.tables[name];
    let key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'column';
    while (t.columns.some(c => c.key === key)) key += '_2';
    t.columns.push({ key, label, type, core: false });
    for (const r of t.rows) r[key] = '';
    this.changed();
    return key;
  },

  renameColumn(name, key, newLabel) {
    const t = this.tables[name];
    const col = t.columns.find(c => c.key === key);
    if (!col || col.core) return;
    let newKey = newLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || key;
    if (newKey !== key && t.columns.some(c => c.key === newKey)) newKey = key;
    col.label = newLabel;
    if (newKey !== key) {
      col.key = newKey;
      for (const r of t.rows) { r[newKey] = r[key]; delete r[key]; }
    }
    this.changed();
  },

  deleteColumn(name, key) {
    const t = this.tables[name];
    const i = t.columns.findIndex(c => c.key === key);
    if (i < 0 || t.columns[i].core) return;
    t.columns.splice(i, 1);
    for (const r of t.rows) delete r[key];
    this.changed();
  },

  /* ---------- import / export ---------- */
  importCSV(name, text) {
    this.tables[name] = this._fromCSV(name, text);
    this.changed();
  },

  exportAll() {
    for (const name of TABLE_NAMES) {
      downloadFile(TABLE_DEFS[name].file.split('/').pop(), this.toCSV(name));
    }
  },

  /* set of valid ids in a table, for reference auditing */
  idsOf(name) { return new Set(this.tables[name].rows.map(r => r.id).filter(Boolean)); },
  orgIds() { return this.idsOf('orgs'); },
};
