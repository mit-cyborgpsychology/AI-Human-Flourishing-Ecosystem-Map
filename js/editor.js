/* CSV data editor: a spreadsheet-style interface over the internal CSV tables.
   Anyone can browse/audit every column of every table; in edit mode cells are
   editable inline and rows/columns can be added, renamed, and removed. */

import { S } from './state.js';
import { store, TABLE_DEFS, TABLE_NAMES } from './store.js';
import { LIST_SEP, splitList, downloadFile } from './csv.js';
import { esc, toast, openModal, closeModal, modal, confirmModal } from './dom.js';

let tab = 'orgs';
let filter = '';

export function renderEditor() {
  document.getElementById('ovEyebrow').textContent = 'Internal CSV file system';
  document.getElementById('ovTitle').textContent = 'Data Editor';
  document.getElementById('overlayTools').innerHTML =
    `<button class="btn" id="csvImport">⬆ Import CSV</button>
     <button class="btn" id="csvExportOne">⬇ Export table</button>
     <button class="btn" id="csvExportAll">⬇ Export all</button>
     ${S.editMode ? '' : '<button class="btn" id="csvUnlock">🔓 Unlock editing</button>'}
     <input type="file" id="csvFile" accept=".csv,text/csv" style="display:none">`;

  const t = store.tables[tab];
  const def = TABLE_DEFS[tab];
  const orgIds = store.orgIds();
  const idCounts = {};
  if (def.key) for (const r of t.rows) idCounts[r[def.key]] = (idCounts[r[def.key]] || 0) + 1;

  const rows = t.rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => {
      if (!filter) return true;
      const q = filter.toLowerCase();
      return Object.values(row).some(v => String(v).toLowerCase().includes(q));
    });

  const listHint = `Multi-value cells are separated by “${LIST_SEP}”.`;
  let html = `<div class="tabs">${TABLE_NAMES.map(n =>
      `<button class="tab ${n === tab ? 'on' : ''}" data-tab="${n}">${TABLE_DEFS[n].label} · ${store.tables[n].rows.length}</button>`).join('')}
    </div>
    <p class="csvnote">Each tab is one CSV file — exactly what you get with Export and what Import expects.
      ${listHint} Core columns drive the map and can’t be removed; add your own columns for notes,
      audit status, sources, etc. — they’re saved, exported, and searchable.
      ${S.editMode ? 'Cells save when you leave them. Red cells reference an organization ID that doesn’t exist.' : 'Unlock editing to change cells.'}</p>
    <div class="tbar">
      <input id="csvSearch" type="search" placeholder="Filter rows…" value="${esc(filter)}" style="min-width:220px">
      ${S.editMode ? `<button class="btn" id="csvAddRow">＋ Row</button>
      <button class="btn" id="csvAddCol">＋ Column</button>` : ''}
      <span class="tcount">${rows.length} of ${t.rows.length} rows · ${t.columns.length} columns</span>
    </div>
    <div class="csvwrap"><table class="csvgrid"><thead><tr>${S.editMode ? '<th class="rowctl"></th>' : ''}`;

  for (const c of t.columns) {
    html += `<th title="${esc(c.hint || c.key)}"><div class="colhead">
      <span class="colname">${esc(c.label)}</span>
      <span class="coltype">${esc(c.type)}</span>
      ${(S.editMode && !c.core) ? `<button class="colbtn" data-rename="${esc(c.key)}" title="Rename column">✎</button>
        <button class="colbtn del" data-delcol="${esc(c.key)}" title="Delete column">✕</button>` : ''}
    </div></th>`;
  }
  html += '</tr></thead><tbody>';

  for (const { row, idx } of rows) {
    html += `<tr data-idx="${idx}">${S.editMode ? `<td class="rowctl"><button class="rowdel" data-delrow="${idx}" title="Delete row">✕</button></td>` : ''}`;
    for (const c of t.columns) {
      const v = row[c.key] ?? '';
      let bad = '';
      let badTitle = '';
      if (c.type === 'ref' && v && !orgIds.has(v.trim())) { bad = ' badref'; badTitle = 'Unknown organization ID'; }
      if (c.type === 'reflist' && v) {
        const missing = splitList(v).filter(x => !orgIds.has(x));
        if (missing.length) { bad = ' badref'; badTitle = 'Unknown organization ID: ' + missing.join(', '); }
      }
      if (def.key && c.key === def.key && v && idCounts[v] > 1) { bad = ' badref'; badTitle = 'Duplicate ID'; }
      const idCls = (c.key === def.key || c.type === 'ref') ? ' idcell' : '';
      html += `<td><textarea class="cell${idCls}${bad}" rows="1" data-idx="${idx}" data-key="${esc(c.key)}"
        ${S.editMode ? '' : 'disabled'} ${badTitle ? `title="${esc(badTitle)}"` : ''} spellcheck="false">${esc(v)}</textarea></td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';

  const body = document.getElementById('overlayBody');
  const prevWrap = body.querySelector('.csvwrap');
  const scroll = prevWrap ? { top: prevWrap.scrollTop, left: prevWrap.scrollLeft } : null;
  body.innerHTML = html;
  if (scroll) { const w = body.querySelector('.csvwrap'); w.scrollTop = scroll.top; w.scrollLeft = scroll.left; }

  wire(body);
}

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

  // cell edits commit on change (blur / Enter-out)
  body.querySelectorAll('textarea.cell').forEach(el => el.addEventListener('change', () => {
    const row = t.rows[+el.dataset.idx];
    const key = el.dataset.key;
    const val = el.value.replace(/\r/g, '');
    if (!row || row[key] === val) return;
    if (tab === 'orgs' && key === 'id' && row.id && val.trim() && val.trim() !== row.id) {
      const oldId = row.id, newId = val.trim();
      renameOrgId(oldId, newId);
      toast(`Renamed ID “${oldId}” → “${newId}” everywhere`);
      return;
    }
    store.setCell(tab, row, key, val);
  }));

  body.querySelectorAll('[data-delrow]').forEach(el => el.addEventListener('click', () => {
    const row = t.rows[+el.dataset.delrow];
    if (!row) return;
    const label = row.name || row[def.key] || `${row.source_id || ''} → ${row.target_id || ''}`;
    const cascade = tab === 'orgs' ? ' Its projects and connections will be removed too.' : '';
    confirmModal(`Delete row “${label}”?${cascade}`, () => { store.deleteRow(tab, row); toast('Row deleted'); });
  }));

  const addRow = body.querySelector('#csvAddRow');
  if (addRow) addRow.addEventListener('click', () => {
    const values = {};
    if (def.key) values[def.key] = 'new-' + Date.now().toString(36).slice(-5);
    if (tab === 'projects') {
      const first = store.tables.orgs.rows[0];
      if (first) values.org_id = first.id;
    }
    store.addRow(tab, values);
    toast('Row added — fill in the cells');
    // jump to the new row
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

  /* overlay toolbar */
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

/* Renaming an org ID updates every reference to it across the tables. */
function renameOrgId(oldId, newId) {
  const orgs = store.tables.orgs, projects = store.tables.projects, links = store.tables.links;
  for (const r of orgs.rows) if (r.id === oldId) r.id = newId;
  for (const r of projects.rows) {
    if (r.org_id === oldId) r.org_id = newId;
    if (r.collab) r.collab = splitList(r.collab).map(x => x === oldId ? newId : x).join(LIST_SEP);
  }
  for (const r of links.rows) {
    if (r.source_id === oldId) r.source_id = newId;
    if (r.target_id === oldId) r.target_id = newId;
  }
  store.changed();
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
      <option value="list">List (${LIST_SEP}-separated)</option>
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
