/* Minimal RFC-4180-style CSV engine: parse text ↔ serialize rows.
   Cell values are always strings; multi-value fields use LIST_SEP within a cell. */

export const LIST_SEP = '|';

export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  const src = String(text ?? '').replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  // drop fully empty trailing rows
  while (rows.length && rows[rows.length - 1].every(c => c === '')) rows.pop();
  if (!rows.length) return { columns: [], records: [] };
  const columns = rows[0].map(c => c.trim());
  const records = rows.slice(1).map(r => {
    const o = {};
    columns.forEach((c, j) => { o[c] = r[j] ?? ''; });
    return o;
  });
  return { columns, records };
}

export function escapeCell(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function serializeCSV(columns, records) {
  const lines = [columns.map(escapeCell).join(',')];
  for (const r of records) lines.push(columns.map(c => escapeCell(r[c])).join(','));
  return lines.join('\n') + '\n';
}

export const splitList = s => String(s ?? '').split(LIST_SEP).map(x => x.trim()).filter(Boolean);
export const joinList = a => (a || []).join(LIST_SEP);

export function downloadFile(filename, text, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
