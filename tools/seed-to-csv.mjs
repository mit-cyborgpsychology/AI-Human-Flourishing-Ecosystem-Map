// One-off converter: extracts the SEED dataset from the legacy single-file app
// (git history: flourishing-atlas.html) and writes it out as the CSV tables in data/.
// Kept for reference; the CSV files in data/ are now the source of truth.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const srcFile = process.argv[2] || path.join(root, 'flourishing-atlas.html');
const src = fs.readFileSync(srcFile, 'utf8');

const start = src.indexOf('const SEED =');
const end = src.indexOf('/* ============================== state');
if (start < 0 || end < 0) throw new Error('Could not locate SEED block in ' + srcFile);

const SEED = new Function(src.slice(start, end) + '\nreturn SEED;')();

const LIST_SEP = '|';
const esc = v => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const row = cells => cells.map(esc).join(',');
const list = a => (a || []).join(LIST_SEP);

const orgCols = ['id','name','roles','location','url','description','people','tags','keywords','areas'];
const orgLines = [row(orgCols)];
const projCols = ['id','org_id','name','description','people','tags','areas','collab','url'];
const projLines = [row(projCols)];
for (const o of SEED.orgs) {
  const roles = (o.roles && o.roles.length) ? o.roles : [o.role || 'academic'];
  orgLines.push(row([o.id, o.name, list(roles), o.location || '', o.url || '',
    o.desc || '', list(o.people), list(o.tags), list(o.keywords), list(o.areas)]));
  for (const p of o.projects || []) {
    projLines.push(row([p.id, o.id, p.name, p.desc || '', list(p.people),
      list(p.tags), list(p.areas), list(p.collab), p.url || '']));
  }
}
const linkCols = ['source_id','target_id','label'];
const linkLines = [row(linkCols)];
for (const l of SEED.links) linkLines.push(row([l.a, l.b, l.label || '']));

const out = path.join(root, 'data');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'orgs.csv'), orgLines.join('\n') + '\n');
fs.writeFileSync(path.join(out, 'projects.csv'), projLines.join('\n') + '\n');
fs.writeFileSync(path.join(out, 'links.csv'), linkLines.join('\n') + '\n');
console.log(`Wrote ${SEED.orgs.length} orgs, ${projLines.length - 1} projects, ${SEED.links.length} links to data/`);
