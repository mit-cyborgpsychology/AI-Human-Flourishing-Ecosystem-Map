# AI × Human Flourishing — Ecosystem Atlas

An interactive network map of the organizations, projects, funders, and policy bodies
working on AI and human flourishing — with an **internal CSV file system** as its data
layer, so the whole dataset can be audited and edited like a spreadsheet.

## Run it

Any static file server works (fetch of `data/*.csv` needs HTTP, not `file://`):

```bash
python3 -m http.server 8471
# → http://localhost:8471
```

## Structure

```
index.html            page shell
css/styles.css        all styling (light/dark aware)
js/
  main.js             entry point: loads the store, wires the UI
  config.js           roles, flourishing areas, palettes, constants
  csv.js              CSV parse/serialize engine
  store.js            the CSV file system: tables, schemas, persistence, import/export
  model.js            CSV rows ↔ nested domain model (orgs → projects, links)
  state.js            shared app state + theming
  graph.js            graph construction + force physics
  canvas.js           canvas rendering + pan/zoom/drag interaction
  legend.js           stats line + role filter legend
  panel.js            right-hand detail panel
  forms.js            add/edit modals + edit-mode gate
  editor.js           spreadsheet-style CSV Data editor (audit + edit)
  overlay.js          full-screen overlay infrastructure
  pathway.js          "Pathway to impact" view
  dom.js              esc/toast/modal helpers
data/
  orgs.csv            one row per organization
  projects.csv        one row per project (org_id links to orgs.csv)
  links.csv           cross-organization connections
tools/seed-to-csv.mjs one-off converter that produced data/ from the legacy app
```

## The CSV data layer

- `data/*.csv` is the seed dataset — the source of truth in the repo. Edit it in any
  spreadsheet tool or in the app's **Data (CSV)** editor.
- Multi-value cells (roles, people, tags, areas, collab) are `|`-separated.
  The first role in `roles` is the organization's primary role.
- Browser edits are persisted to localStorage *as CSV* and can be exported with
  **Export CSV** (three files) or per-table from the Data editor. To make edits
  permanent for everyone, commit the exported files back into `data/`.
- The Data editor supports adding rows, adding/renaming/deleting **custom columns**
  (audit status, notes, sources, …) which are preserved, exported, and searchable;
  core columns the map depends on are protected.
- Reference auditing: cells pointing at a non-existent organization ID (project
  `org_id`, `collab`, link endpoints) and duplicate IDs are highlighted in red.
  Renaming an organization's `id` in the editor updates every reference to it.
- **Edit** (password: `flourishing`) unlocks editing, both in the map UI
  (add organization / project / connection forms) and in the Data editor.
