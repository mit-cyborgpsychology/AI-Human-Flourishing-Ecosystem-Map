/* CSV data editor: a spreadsheet-style interface over the internal CSV tables.

   - Every multi-value column (roles, people, tags, keywords, areas, collab) renders
     as removable tags with a "＋" that opens a dropdown of existing options — and,
     where a free vocabulary makes sense, a "create new" entry.
   - The Organizations view is the hub: it also carries virtual Projects and
     Connections columns, so an organization's projects, people, and relationships
     are all editable from its single row.
   - Connections carry a type (fund | support | collaborate) shown as colored tags;
     links.csv remains one row per connection and stays editable on its own tab.
   - Clicking a person / project / organization tag jumps to that row for editing. */

import { S } from './state.js';
import { store, TABLE_DEFS, TABLE_NAMES } from './store.js';
import { LIST_SEP, splitList, joinList, downloadFile } from './csv.js';
import { slug, stableSlug } from './model.js';
import { ROLES, AREAS, LINK_TYPES } from './config.js';
import { esc, toast, openModal, closeModal, modal, confirmModal } from './dom.js';

let tab = 'orgs';
let filter = '';
let flashIdx = null;    // row index to highlight after a tag jump
let countText = '';

const rowName = (table, id) => {
  const r = store.tables[table].rows.find(x => x.id === id);
  return r ? (r.name || r.id) : null;
};
const orgName = id => rowName('orgs', id);

/* ============================== vocabularies ============================== */
/* What can go in a multi-value cell, how it's labelled, and whether new values
   can be invented on the spot. */
function vocab(tableName, col) {
  if (col.key === 'roles') return Object.entries(ROLES).map(([id, r]) => ({ id, label: r.label }));
  if (col.key === 'areas') return Object.entries(AREAS).map(([id, a]) => ({ id, label: a.label }));
  if (col.type === 'reflist' && col.ref) {
    return store.tables[col.ref].rows.filter(r => r.id)
      .map(r => ({ id: r.id, label: r.name || r.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  const set = new Set();
  for (const r of store.tables[tableName].rows) splitList(r[col.key]).forEach(v => set.add(v));
  return [...set].sort((a, b) => a.localeCompare(b)).map(v => ({ id: v, label: v }));
}
/* roles/areas are fixed vocabularies; orgs must already exist (use ＋ New org);
   people and free-text lists can be created inline. */
const allowsNew = col =>
  col.key !== 'roles' && col.key !== 'areas' &&
  (col.type !== 'reflist' || col.ref === 'people');

function tagLabel(col, v) {
  if (col.key === 'roles') return (ROLES[v] || {}).label || v;
  if (col.key === 'areas') return (AREAS[v] || {}).label || v;
  if (col.type === 'reflist' && col.ref) return rowName(col.ref, v) || v;
  return v;
}
function tagBad(col, v) {
  if (col.key === 'roles') return !ROLES[v];
  if (col.key === 'areas') return !AREAS[v];
  if (col.type === 'reflist' && col.ref) return !store.idsOf(col.ref).has(v);
  return false;
}
function tagStyle(col, v) {
  if (col.key === 'roles' && ROLES[v]) {
    const c = ROLES[v].c[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'];
    return `color:#fff;background:${c}`;
  }
  if (col.key === 'areas' && AREAS[v]) return `color:${AREAS[v].color};background:${AREAS[v].color}1A`;
  return '';
}
/* which table a tag navigates to, if any */
const navTarget = col => (col.type === 'reflist' && col.ref) ? col.ref : null;

/* ============================== render ============================== */
export function renderEditor() {
  document.getElementById('ovEyebrow').textContent = 'Internal CSV file system';
  document.getElementById('ovTitle').textContent = 'Data Editor';
  document.getElementById('overlayTools').innerHTML =
    `<button class="btn" id="csvImport">⬆ Import CSV</button>
     <button class="btn" id="csvExportOne">⬇ Export table</button>
     <button class="btn" id="csvExportAll">⬇ Export all</button>
     ${S.editMode ? '' : '<button class="btn" id="csvUnlock">🔓 Unlock editing</button>'}
     <input type="file" id="csvFile" accept=".csv,text/csv" style="display:none">`;

  const note = tab === 'orgs'
    ? `The organization view is the hub: every CSV column plus this org’s <strong>people</strong>,
       <strong>projects</strong>, and <strong>connections</strong>. Multi-value cells are tags — ${
       S.editMode ? 'click ＋ to pick from existing options or create a new one, ✕ to remove.'
                  : 'unlock editing to change them.'}
       Click a person, project, or organization tag to jump to its row. Connections are typed
       (${Object.values(LINK_TYPES).map(t => t.label.toLowerCase()).join(' · ')}); the tags are a view of links.csv.`
    : `Each tab is one CSV file — exactly what you get with Export and what Import expects.
       Multi-value cells are stored “${LIST_SEP}”-separated and edited as tags. Core columns drive the map
       and can’t be removed; add your own columns for notes, audit status, sources, etc.
       ${S.editMode ? 'Cells save when you leave them. Red tags and cells reference an ID that doesn’t exist.'
                    : 'Unlock editing to change cells.'}`;

  let html = `<div class="tabs">${TABLE_NAMES.map(n =>
      `<button class="tab ${n === tab ? 'on' : ''}" data-tab="${n}">${TABLE_DEFS[n].label} · ${store.tables[n].rows.length}</button>`).join('')}
    </div>
    <p class="csvnote">${note}</p>
    <div class="tbar">
      <input id="csvSearch" type="search" placeholder="Filter rows…" value="${esc(filter)}" style="min-width:220px">
      ${S.editMode ? `<button class="btn" id="csvAddRow">＋ Row</button>
      <button class="btn" id="csvAddCol">＋ Column</button>` : ''}
      <span class="tcount" id="csvCount"></span>
    </div>${buildGrid()}`;

  const body = document.getElementById('overlayBody');
  const prevWrap = body.querySelector('.csvwrap');
  const scroll = prevWrap ? { top: prevWrap.scrollTop, left: prevWrap.scrollLeft } : null;
  body.innerHTML = html;
  const countEl = body.querySelector('#csvCount');
  if (countEl) countEl.textContent = countText;
  if (scroll) { const w = body.querySelector('.csvwrap'); w.scrollTop = scroll.top; w.scrollLeft = scroll.left; }

  wire(body);

  if (flashIdx !== null) {
    const tr = body.querySelector(`tr[data-idx="${flashIdx}"]`);
    if (tr) { tr.classList.add('flash'); tr.scrollIntoView({ block: 'center' }); }
    flashIdx = null;
  }
}

function buildGrid() {
  const t = store.tables[tab];
  const def = TABLE_DEFS[tab];
  const idCounts = {};
  if (def.key) for (const r of t.rows) idCounts[r[def.key]] = (idCounts[r[def.key]] || 0) + 1;

  const rows = t.rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => {
      if (!filter) return true;
      const q = filter.toLowerCase();
      if (Object.values(row).some(v => String(v).toLowerCase().includes(q))) return true;
      // match on resolved tag labels too (person names, org names, role labels…)
      return t.columns.some(c => (c.type === 'list' || c.type === 'reflist') &&
        splitList(row[c.key]).some(v => tagLabel(c, v).toLowerCase().includes(q)));
    });

  let html = `<div class="csvwrap"><table class="csvgrid"><thead><tr>${S.editMode ? '<th class="rowctl"></th>' : ''}`;
  for (const c of t.columns) {
    html += `<th title="${esc(c.hint || c.key)}"><div class="colhead">
      <span class="colname">${esc(c.label)}</span>
      <span class="coltype">${esc(c.type)}</span>
      ${(S.editMode && !c.core) ? `<button class="colbtn" data-rename="${esc(c.key)}" title="Rename column">✎</button>
        <button class="colbtn del" data-delcol="${esc(c.key)}" title="Delete column">✕</button>` : ''}
    </div></th>`;
  }
  if (tab === 'orgs') html += `
    <th><div class="colhead"><span class="colname">Projects</span><span class="coltype">view</span></div></th>
    <th><div class="colhead"><span class="colname">Connections</span><span class="coltype">view of links.csv</span></div></th>`;
  if (tab === 'people') html += `<th><div class="colhead"><span class="colname">Affiliations</span><span class="coltype">view</span></div></th>`;
  html += '</tr></thead><tbody>';

  for (const { row, idx } of rows) {
    html += `<tr data-idx="${idx}">${S.editMode ? `<td class="rowctl"><button class="rowdel" data-delrow="${idx}" title="Delete row">✕</button></td>` : ''}`;
    for (const c of t.columns) {
      if (c.type === 'list' || c.type === 'reflist') { html += `<td>${tagCell(row, idx, c)}</td>`; continue; }
      const v = row[c.key] ?? '';
      let bad = '', badTitle = '';
      if (c.type === 'ref' && v && !store.idsOf(c.ref).has(v.trim())) { bad = ' badref'; badTitle = `Unknown ${c.ref} ID`; }
      if (def.key && c.key === def.key && v && idCounts[v] > 1) { bad = ' badref'; badTitle = 'Duplicate ID'; }
      const idCls = (c.key === def.key || c.type === 'ref') ? ' idcell' : '';
      html += `<td><textarea class="cell${idCls}${bad}" rows="1" data-idx="${idx}" data-key="${esc(c.key)}"
        ${S.editMode ? '' : 'disabled'} ${badTitle ? `title="${esc(badTitle)}"` : ''} spellcheck="false">${esc(v)}</textarea></td>`;
    }
    if (tab === 'orgs') html += `<td>${projectsCell(row)}</td><td>${connectionsCell(row)}</td>`;
    if (tab === 'people') html += `<td>${affiliationsCell(row)}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  countText = `${rows.length} of ${t.rows.length} rows · ${t.columns.length} columns`;
  return html;
}

/* ---------- generic multi-value tag cell ---------- */
function tagCell(row, idx, col) {
  const vals = splitList(row[col.key]);
  const nav = navTarget(col);
  let h = '<div class="tagcell">';
  h += vals.map(v => {
    const bad = tagBad(col, v);
    const st = tagStyle(col, v);
    return `<span class="gtag${bad ? ' badtag' : ''}" style="${st}"
      ${nav && !bad ? `data-goto="${esc(nav)}" data-gotoid="${esc(v)}"` : ''}
      title="${esc(bad ? 'Unknown ID: ' + v : tagLabel(col, v))}">
      <span class="tlabel">${esc(tagLabel(col, v))}</span>
      ${S.editMode ? `<span class="x" data-untag="${esc(v)}" data-idx="${idx}" data-key="${esc(col.key)}" title="Remove">✕</span>` : ''}
    </span>`;
  }).join('');
  if (!vals.length && !S.editMode) h += '<span style="color:var(--faint);font-size:11px">—</span>';
  if (S.editMode) h += `<button class="addtag" data-addtag="${esc(col.key)}" data-idx="${idx}" title="Add">＋</button>`;
  h += '</div>';
  return h;
}

/* ---------- org row: projects ---------- */
function projectsCell(orgRow) {
  const projs = store.tables.projects.rows;
  const own = projs.filter(r => r.org_id === orgRow.id);
  const shared = projs.filter(r => r.org_id !== orgRow.id && splitList(r.collab).includes(orgRow.id));
  let h = '<div class="tagcell">';
  h += own.map(r => `<span class="gtag" data-goto="projects" data-gotoid="${esc(r.id)}" title="${esc(r.name || r.id)}">
      <span class="tlabel">${esc(r.name || r.id)}</span>
      ${S.editMode ? `<span class="x" data-xproj="${esc(r.id)}" title="Delete project">✕</span>` : ''}</span>`).join('');
  h += shared.map(r => `<span class="gtag shared" data-goto="projects" data-gotoid="${esc(r.id)}" title="Shared — led by ${esc(orgName(r.org_id) || r.org_id)}">
      <span class="tlabel">${esc(r.name || r.id)}</span>
      ${S.editMode ? `<span class="x" data-xshared="${esc(r.id)}" data-org="${esc(orgRow.id)}" title="Remove from this org">✕</span>` : ''}</span>`).join('');
  if (!own.length && !shared.length && !S.editMode) h += '<span style="color:var(--faint);font-size:11px">—</span>';
  if (S.editMode) h += `<button class="addtag" data-addproj="${esc(orgRow.id)}" title="Add project">＋</button>`;
  h += '</div>';
  return h;
}

/* ---------- org row: typed connections ---------- */
function connectionsCell(orgRow) {
  const links = store.tables.links.rows;
  const cs = links.map((r, i) => ({ r, i })).filter(({ r }) => r.source_id === orgRow.id || r.target_id === orgRow.id);
  let h = '<div class="tagcell">';
  h += cs.map(({ r, i }) => {
    const outgoing = r.source_id === orgRow.id;
    const other = outgoing ? r.target_id : r.source_id;
    const name = orgName(other);
    const ty = LINK_TYPES[r.type] ? r.type : 'collaborate';
    const col = LINK_TYPES[ty].color;
    const verb = outgoing ? LINK_TYPES[ty].outLabel : LINK_TYPES[ty].inLabel;
    const dir = outgoing ? '→' : '←';
    return `<span class="gtag conn${name ? '' : ' badtag'}" style="${name ? `color:${col};background:${col}1A;box-shadow:inset 0 0 0 1px ${col}55` : ''}"
      ${S.editMode ? `data-editlink="${i}"` : `data-goto="orgs" data-gotoid="${esc(other)}"`}
      title="${esc(verb)} ${esc(name || other)}${r.label ? ' — ' + esc(r.label) : ''}${name ? '' : ' — unknown org ID: ' + esc(other)}">
      <span class="ttype" style="${name ? `background:${col}` : ''}">${esc(verb)}</span>
      <span class="tlabel">${dir} ${esc(name || other)}</span>
      ${S.editMode ? `<span class="x" data-dellink="${i}" title="Remove connection">✕</span>` : ''}</span>`;
  }).join('');
  if (!cs.length && !S.editMode) h += '<span style="color:var(--faint);font-size:11px">—</span>';
  if (S.editMode) h += `<button class="addtag" data-addlink="${esc(orgRow.id)}" title="Add connection">＋</button>`;
  h += '</div>';
  return h;
}

/* ---------- people row: where they appear ---------- */
function affiliationsCell(personRow) {
  const orgs = store.tables.orgs.rows.filter(r => splitList(r.people).includes(personRow.id));
  const projs = store.tables.projects.rows.filter(r => splitList(r.people).includes(personRow.id));
  let h = '<div class="tagcell">';
  h += orgs.map(r => `<span class="gtag" data-goto="orgs" data-gotoid="${esc(r.id)}"><span class="tlabel">${esc(r.name || r.id)}</span></span>`).join('');
  h += projs.map(r => `<span class="gtag shared" data-goto="projects" data-gotoid="${esc(r.id)}" title="Project"><span class="tlabel">${esc(r.name || r.id)}</span></span>`).join('');
  if (!orgs.length && !projs.length) h += '<span style="color:var(--faint);font-size:11px">—</span>';
  h += '</div>';
  return h;
}

/* ============================== navigation ============================== */
function gotoRow(targetTab, id) {
  const idx = store.tables[targetTab].rows.findIndex(r => r.id === id);
  if (idx < 0) return;
  tab = targetTab; filter = ''; flashIdx = idx;
  renderEditor();
}

/* ============================== wiring ============================== */
function wire(body) {
  const t = store.tables[tab];
  const def = TABLE_DEFS[tab];

  body.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => {
    tab = el.dataset.tab; filter = ''; renderEditor();
  }));

  const si = body.querySelector('#csvSearch');
  si.addEventListener('input', () => {
    filter = si.value;
    const pos = si.selectionStart;
    renderEditor();
    const n = document.querySelector('#csvSearch');
    if (n) { n.focus(); n.setSelectionRange(pos, pos); }
  });

  /* plain cells */
  body.querySelectorAll('textarea.cell').forEach(el => el.addEventListener('change', () => {
    const row = t.rows[+el.dataset.idx], key = el.dataset.key;
    const val = el.value.replace(/\r/g, '');
    if (!row || row[key] === val) return;
    if ((tab === 'orgs' || tab === 'people') && key === 'id' && row.id && val.trim() && val.trim() !== row.id) {
      const oldId = row.id, newId = val.trim();
      renameId(tab, oldId, newId);
      toast(`Renamed ID “${oldId}” → “${newId}” everywhere`);
      return;
    }
    store.setCell(tab, row, key, val);
  }));

  /* tag navigation */
  body.querySelectorAll('[data-goto]').forEach(el => el.addEventListener('click', ev => {
    if (ev.target.closest('.x')) return;
    gotoRow(el.dataset.goto, el.dataset.gotoid);
  }));

  /* tag remove + add */
  body.querySelectorAll('[data-untag]').forEach(el => el.addEventListener('click', ev => {
    ev.stopPropagation();
    const row = t.rows[+el.dataset.idx], key = el.dataset.key;
    row[key] = joinList(splitList(row[key]).filter(v => v !== el.dataset.untag));
    store.changed();
  }));
  body.querySelectorAll('[data-addtag]').forEach(el => el.addEventListener('click', () => {
    openTagPicker(el, t.rows[+el.dataset.idx], t.columns.find(c => c.key === el.dataset.addtag));
  }));

  /* rows & columns */
  body.querySelectorAll('[data-delrow]').forEach(el => el.addEventListener('click', () => {
    const row = t.rows[+el.dataset.delrow];
    if (!row) return;
    const label = row.name || row[def.key] || `${row.source_id || ''} → ${row.target_id || ''}`;
    const cascade = tab === 'orgs' ? ' Its projects and connections will be removed too.'
      : tab === 'people' ? ' They will be removed from every organization and project.' : '';
    confirmModal(`Delete row “${label}”?${cascade}`, () => { store.deleteRow(tab, row); toast('Row deleted'); });
  }));
  const addRow = body.querySelector('#csvAddRow');
  if (addRow) addRow.addEventListener('click', () => {
    const values = {};
    if (def.key) values[def.key] = 'new-' + Date.now().toString(36).slice(-5);
    if (tab === 'projects') { const first = store.tables.orgs.rows[0]; if (first) values.org_id = first.id; }
    if (tab === 'links') { const first = store.tables.orgs.rows[0]; if (first) { values.source_id = first.id; values.type = 'collaborate'; } }
    store.addRow(tab, values);
    toast('Row added — fill in the cells');
    const w = document.querySelector('.csvwrap'); if (w) w.scrollTop = w.scrollHeight;
  });
  const addCol = body.querySelector('#csvAddCol');
  if (addCol) addCol.addEventListener('click', () => columnModal());
  body.querySelectorAll('[data-rename]').forEach(el => el.addEventListener('click', () => {
    const col = t.columns.find(c => c.key === el.dataset.rename);
    if (col) columnModal(col);
  }));
  body.querySelectorAll('[data-delcol]').forEach(el => el.addEventListener('click', () => {
    const key = el.dataset.delcol;
    confirmModal(`Delete column “${key}” and all its data in ${TABLE_DEFS[tab].label}?`, () => {
      store.deleteColumn(tab, key); toast('Column deleted');
    });
  }));

  /* org row: projects */
  body.querySelectorAll('[data-xproj]').forEach(el => el.addEventListener('click', ev => {
    ev.stopPropagation();
    const row = store.tables.projects.rows.find(r => r.id === el.dataset.xproj);
    if (!row) return;
    confirmModal(`Delete project “${row.name || row.id}”?`, () => { store.deleteRow('projects', row); toast('Project deleted'); });
  }));
  body.querySelectorAll('[data-xshared]').forEach(el => el.addEventListener('click', ev => {
    ev.stopPropagation();
    const row = store.tables.projects.rows.find(r => r.id === el.dataset.xshared);
    if (!row) return;
    row.collab = joinList(splitList(row.collab).filter(x => x !== el.dataset.org));
    store.changed(); toast('Removed from shared project');
  }));
  body.querySelectorAll('[data-addproj]').forEach(el => el.addEventListener('click', () => openProjectPicker(el, el.dataset.addproj)));

  /* org row: connections */
  body.querySelectorAll('[data-editlink]').forEach(el => el.addEventListener('click', ev => {
    if (ev.target.closest('.x')) return;
    linkModal(+el.dataset.editlink);
  }));
  body.querySelectorAll('[data-dellink]').forEach(el => el.addEventListener('click', ev => {
    ev.stopPropagation();
    const row = store.tables.links.rows[+el.dataset.dellink];
    if (row) { store.deleteRow('links', row); toast('Connection removed'); }
  }));
  body.querySelectorAll('[data-addlink]').forEach(el => el.addEventListener('click', () => openLinkPicker(el, el.dataset.addlink)));

  /* toolbar */
  const tools = document.getElementById('overlayTools');
  const unlock = tools.querySelector('#csvUnlock');
  if (unlock) unlock.addEventListener('click', () => document.getElementById('editBtn').click());
  tools.querySelector('#csvExportAll').addEventListener('click', () => { store.exportAll(); toast('All CSV files exported'); });
  tools.querySelector('#csvExportOne').addEventListener('click', () => {
    const file = TABLE_DEFS[tab].file.split('/').pop();
    downloadFile(file, store.toCSV(tab));
    toast(`${file} exported`);
  });
  const fileInput = tools.querySelector('#csvFile');
  tools.querySelector('#csvImport').addEventListener('click', () => {
    if (!S.editMode) { toast('Unlock editing to import'); return; }
    fileInput.click();
  });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    const text = await f.text();
    confirmModal(`Replace the ${TABLE_DEFS[tab].label} table with “${f.name}”? Current rows in this table will be overwritten.`, () => {
      try { store.importCSV(tab, text); toast(`${TABLE_DEFS[tab].label} imported`); }
      catch (e) { toast('Import failed: not valid CSV'); }
    });
    fileInput.value = '';
  });
}

/* ============================== inline pickers ============================== */
/* Replaces the ＋ button with a dropdown built on demand, so the grid stays light. */
function inlinePicker(btn, options, { newLabel, onPick, onNew }) {
  const sel = document.createElement('select');
  sel.className = 'tagsel';
  sel.innerHTML = `<option value="">choose…</option>` +
    options.map(o => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join('') +
    (newLabel ? `<option data-new="1">${esc(newLabel)}</option>` : '');
  btn.replaceWith(sel);
  sel.focus();
  try { sel.showPicker?.(); } catch (e) { /* not supported — the select is open-able manually */ }
  sel.addEventListener('change', () => {
    const opt = sel.selectedOptions[0];
    if (opt && opt.dataset.new) onNew();
    else if (sel.value) onPick(sel.value);
    else renderEditor();
  });
  sel.addEventListener('blur', () => setTimeout(() => { if (sel.isConnected) renderEditor(); }, 150));
}

function openTagPicker(btn, row, col) {
  if (!row || !col) return;
  const current = new Set(splitList(row[col.key]));
  const options = vocab(tab, col).filter(o => !current.has(o.id));
  const isPeople = col.type === 'reflist' && col.ref === 'people';
  inlinePicker(btn, options, {
    newLabel: allowsNew(col) ? (isPeople ? '＋ New person…' : '＋ New value…') : '',
    onPick: v => { row[col.key] = joinList([...splitList(row[col.key]), v]); store.changed(); },
    onNew: () => newValueModal(col, v => { row[col.key] = joinList([...splitList(row[col.key]), v]); store.changed(); }),
  });
}

function openProjectPicker(btn, orgId) {
  const projs = store.tables.projects.rows;
  const options = projs
    .filter(r => r.id && r.org_id !== orgId && !splitList(r.collab).includes(orgId))
    .map(r => ({ id: r.id, label: `${r.name || r.id} · ${orgName(r.org_id) || '⚠ unassigned'}` }));
  inlinePicker(btn, options, {
    newLabel: '＋ New project…',
    onPick: id => {
      const row = projs.find(r => r.id === id);
      if (!row) return;
      if (!store.orgIds().has(row.org_id)) {
        row.org_id = orgId; store.changed();
        toast(`Adopted “${row.name || row.id}” — this org is now its lead`);
      } else {
        row.collab = joinList([...splitList(row.collab), orgId]); store.changed();
        toast(`Added “${row.name || row.id}” as a shared project`);
      }
    },
    onNew: () => newProjectModal(orgId),
  });
}

function openLinkPicker(btn, orgId) {
  const links = store.tables.links.rows;
  const already = new Set(links.filter(r => r.source_id === orgId || r.target_id === orgId)
    .map(r => r.source_id === orgId ? r.target_id : r.source_id));
  const options = store.tables.orgs.rows
    .filter(r => r.id && r.id !== orgId && !already.has(r.id))
    .map(r => ({ id: r.id, label: r.name || r.id }))
    .sort((a, b) => a.label.localeCompare(b.label));
  inlinePicker(btn, options, {
    newLabel: '＋ New organization…',
    onPick: otherId => connectionModal(orgId, otherId),
    onNew: () => newOrgModal(orgId),
  });
}

/* ============================== id renaming ============================== */
function renameId(table, oldId, newId) {
  if (table === 'orgs') {
    for (const r of store.tables.orgs.rows) if (r.id === oldId) r.id = newId;
    for (const r of store.tables.projects.rows) {
      if (r.org_id === oldId) r.org_id = newId;
      if (r.collab) r.collab = joinList(splitList(r.collab).map(x => x === oldId ? newId : x));
    }
    for (const r of store.tables.links.rows) {
      if (r.source_id === oldId) r.source_id = newId;
      if (r.target_id === oldId) r.target_id = newId;
    }
  } else if (table === 'people') {
    for (const r of store.tables.people.rows) if (r.id === oldId) r.id = newId;
    for (const name of ['orgs', 'projects']) {
      for (const r of store.tables[name].rows) {
        if (r.people) r.people = joinList(splitList(r.people).map(x => x === oldId ? newId : x));
      }
    }
  }
  store.changed();
}

/* ============================== modals ============================== */
function newValueModal(col, apply) {
  const isPeople = col.type === 'reflist' && col.ref === 'people';
  openModal(`<span class="eyebrow">New ${isPeople ? 'person' : col.label.toLowerCase()}</span>
    <h3>${isPeople ? 'Add a person' : `Add a new ${col.label.toLowerCase()} value`}</h3>
    <p class="sub">${isPeople
      ? 'Creates a row in people.csv and tags them here. You can add their title and link on the People tab.'
      : `The value is added to this cell and becomes available in the dropdown for every other row.`}</p>
    <div class="field"><label>${isPeople ? 'Full name' : col.label} *</label><input id="vName" placeholder="${isPeople ? 'e.g. Ada Lovelace' : 'e.g. open science'}"></div>
    <div class="ferr" id="vErr">A value is required.</div>
    <div class="mrow"><button class="btn" id="mNo">Cancel</button>
    <button class="btn primary" id="mGo">Add</button></div>`);
  modal.querySelector('#mNo').onclick = () => { closeModal(); renderEditor(); };
  modal.querySelector('#vName').addEventListener('keydown', e => { if (e.key === 'Enter') modal.querySelector('#mGo').click(); });
  modal.querySelector('#mGo').onclick = () => {
    const name = modal.querySelector('#vName').value.trim();
    if (!name) { modal.querySelector('#vErr').style.display = 'block'; return; }
    let value = name;
    if (isPeople) {
      const rows = store.tables.people.rows;
      const existing = rows.find(r => (r.name || '').toLowerCase() === name.toLowerCase());
      if (existing) value = existing.id;
      else {
        let id = stableSlug(name) || 'person';
        while (rows.some(r => r.id === id)) id += '-2';
        const row = {};
        for (const c of store.tables.people.columns) row[c.key] = '';
        row.id = id; row.name = name;
        rows.push(row);
        value = id;
      }
    }
    closeModal();
    apply(value);
    toast(isPeople ? `“${name}” added` : `“${name}” added`);
  };
}

function connectionModal(orgId, otherId) {
  openModal(`<span class="eyebrow">New connection</span>
    <h3>${esc(orgName(orgId) || orgId)} → ${esc(orgName(otherId) || otherId)}</h3>
    <p class="sub">Adds a row to links.csv. The type sets how this relationship is shown across the atlas.</p>
    <div class="field"><label>Relationship type</label><select id="cType">${
      Object.entries(LINK_TYPES).map(([k, v]) => `<option value="${k}" ${k === 'collaborate' ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
    <div class="field"><label>Label</label><input id="cLbl" placeholder="e.g. Joint research, Program support"></div>
    <div class="mrow"><button class="btn" id="mNo">Cancel</button>
    <button class="btn primary" id="mGo">Connect</button></div>`);
  modal.querySelector('#mNo').onclick = () => { closeModal(); renderEditor(); };
  modal.querySelector('#mGo').onclick = () => {
    const type = modal.querySelector('#cType').value;
    store.addRow('links', { source_id: orgId, target_id: otherId, type,
      label: modal.querySelector('#cLbl').value.trim() || LINK_TYPES[type].label.toLowerCase() });
    closeModal();
    toast(`Connected to ${orgName(otherId) || otherId}`);
  };
}

function linkModal(idx) {
  const r = store.tables.links.rows[idx];
  if (!r) return;
  const a = orgName(r.source_id) || r.source_id, b = orgName(r.target_id) || r.target_id;
  const ty = LINK_TYPES[r.type] ? r.type : 'collaborate';
  openModal(`<span class="eyebrow">Connection · links.csv row ${idx + 2}</span>
    <h3>${esc(a)} → ${esc(b)}</h3>
    <div class="field"><label>Relationship type</label><select id="lType">${
      Object.entries(LINK_TYPES).map(([k, v]) => `<option value="${k}" ${k === ty ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
    <div class="field"><label>Label</label><input id="lLbl" value="${esc(r.label || '')}" placeholder="e.g. Joint research, Funding"></div>
    <div class="mrow">
      <button class="btn danger" id="mDel">Remove connection</button>
      <button class="btn" id="mNo">Cancel</button>
      <button class="btn primary" id="mGo">Save</button></div>`);
  modal.querySelector('#mNo').onclick = closeModal;
  modal.querySelector('#mDel').onclick = () => { closeModal(); store.deleteRow('links', r); toast('Connection removed'); };
  modal.querySelector('#mGo').onclick = () => {
    r.type = modal.querySelector('#lType').value;
    r.label = modal.querySelector('#lLbl').value.trim();
    store.changed(); closeModal(); toast('Connection saved');
  };
}

function newProjectModal(orgId) {
  openModal(`<span class="eyebrow">New project · ${esc(orgName(orgId) || orgId)}</span>
    <h3>Add a project</h3>
    <p class="sub">Creates a new row in projects.csv led by this organization, then jumps to it so you can fill in the details.</p>
    <div class="field"><label>Project name *</label><input id="pName" placeholder="e.g. Flourishing Benchmark"></div>
    <div class="ferr" id="pErr">Name is required.</div>
    <div class="mrow"><button class="btn" id="mNo">Cancel</button>
    <button class="btn primary" id="mGo">Create & open row</button></div>`);
  modal.querySelector('#mNo').onclick = () => { closeModal(); renderEditor(); };
  modal.querySelector('#pName').addEventListener('keydown', e => { if (e.key === 'Enter') modal.querySelector('#mGo').click(); });
  modal.querySelector('#mGo').onclick = () => {
    const name = modal.querySelector('#pName').value.trim();
    if (!name) { modal.querySelector('#pErr').style.display = 'block'; return; }
    const id = slug(name);
    store.addRow('projects', { id, org_id: orgId, name });
    closeModal(); gotoRow('projects', id); toast('Project created — fill in the row');
  };
}

function newOrgModal(connectTo) {
  openModal(`<span class="eyebrow">New organization${connectTo ? ' · connects to ' + esc(orgName(connectTo) || connectTo) : ''}</span>
    <h3>Add an organization</h3>
    <p class="sub">Creates a new row in orgs.csv${connectTo ? ' and a typed connection to it in links.csv' : ''}. You can fill in the rest of its columns afterwards.</p>
    <div class="field"><label>Name *</label><input id="oName" placeholder="Organization name"></div>
    <div class="field"><label>Primary role</label><select id="oRole">${
      Object.entries(ROLES).filter(([k]) => k !== 'hub')
        .map(([k, r]) => `<option value="${k}">${r.label}</option>`).join('')}</select></div>
    ${connectTo ? `<div class="field"><label>Relationship type</label><select id="oType">${
      Object.entries(LINK_TYPES).map(([k, v]) => `<option value="${k}" ${k === 'collaborate' ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
    <div class="field"><label>Connection label</label><input id="oLbl" placeholder="e.g. Joint research, Funding"></div>` : ''}
    <div class="ferr" id="oErr">Name is required.</div>
    <div class="mrow"><button class="btn" id="mNo">Cancel</button>
    <button class="btn primary" id="mGo">Create</button></div>`);
  modal.querySelector('#mNo').onclick = () => { closeModal(); renderEditor(); };
  modal.querySelector('#mGo').onclick = () => {
    const name = modal.querySelector('#oName').value.trim();
    if (!name) { modal.querySelector('#oErr').style.display = 'block'; return; }
    const id = slug(name);
    store.addRow('orgs', { id, name, roles: modal.querySelector('#oRole').value });
    if (connectTo) {
      const type = modal.querySelector('#oType').value;
      store.addRow('links', { source_id: connectTo, target_id: id, type,
        label: (modal.querySelector('#oLbl')?.value || '').trim() || LINK_TYPES[type].label.toLowerCase() });
    }
    closeModal();
    toast(`“${name}” created${connectTo ? ' and connected' : ''}`);
  };
}

function columnModal(existing) {
  openModal(`<span class="eyebrow">${existing ? 'Rename column' : 'New column'} · ${TABLE_DEFS[tab].label}</span>
    <h3>${existing ? `Rename “${esc(existing.label)}”` : 'Add a column'}</h3>
    <p class="sub">${existing ? 'The CSV header and all row data move to the new name.'
      : 'The column is added to this table’s CSV — use it for notes, audit status, sources, funding, or anything else worth tracking.'}</p>
    <div class="field"><label>Column name</label><input id="cName" value="${esc(existing ? existing.label : '')}" placeholder="e.g. Audit status"></div>
    ${existing ? '' : `<div class="field"><label>Type</label><select id="cType">
      <option value="text">Text</option>
      <option value="multiline">Long text</option>
      <option value="list">Tags (multiple values)</option>
      <option value="url">URL</option>
    </select></div>`}
    <div class="ferr" id="cErr">Name is required.</div>
    <div class="mrow"><button class="btn" id="mNo">Cancel</button>
    <button class="btn primary" id="mGo">${existing ? 'Rename' : 'Add column'}</button></div>`);
  modal.querySelector('#mNo').onclick = closeModal;
  modal.querySelector('#mGo').onclick = () => {
    const name = modal.querySelector('#cName').value.trim();
    if (!name) { modal.querySelector('#cErr').style.display = 'block'; return; }
    if (existing) { store.renameColumn(tab, existing.key, name); toast('Column renamed'); }
    else { store.addColumn(tab, name, modal.querySelector('#cType').value); toast(`Column “${name}” added`); }
    closeModal();
  };
}
