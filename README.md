# AI for Human Flourishing Ecosystem Map

The AI and Human Flourishing Ecosystem Map is a living systems map that visualizes the global
network of organizations, research institutions, industry labs, nonprofits, philanthropic
organizations, policymakers, and community leaders working at the intersection of artificial
intelligence and human flourishing. The map reveals how diverse actors across academia, industry,
civil society, policy, philanthropy, measurement, and community engagement are connected through
shared missions and collaborations. Organized around key dimensions of human flourishing, including
physical and mental wellbeing, healthy relationships, comprehension and agency, curiosity and
learning, creativity and expression, and sense of purpose, the map provides a systems-level view of
the emerging ecosystem dedicated to ensuring AI benefits humanity. By making relationships,
collaborations, and gaps in the field visible, the project serves as a strategic resource for
researchers, funders, policymakers, and practitioners to foster cross-sector partnerships, identify
opportunities for collective impact, and advance the development of AI that enhances individual and
societal flourishing.

## Run it

Any static file server works (loading `data/*.csv` needs HTTP, not `file://`):

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
  config.js           roles, flourishing areas, relationship types, palettes
  csv.js              CSV parse/serialize engine
  store.js            the CSV file system: tables, schemas, persistence, import/export
  model.js            CSV rows ↔ nested domain model (orgs → projects, people, links)
  state.js            shared app state + theming
  graph.js            graph construction + force physics
  canvas.js           canvas rendering + pan/zoom/drag interaction
  legend.js           stats line + role filter legend
  panel.js            right-hand detail panel
  forms.js            add/edit modals + edit-mode gate
  editor.js           the CSV Data editor (tags, pickers, audit)
  overlay.js          full-screen overlay infrastructure
  pathway.js          "Pathway to impact" view
  dom.js              esc/toast/modal helpers
data/
  orgs.csv            one row per organization
  projects.csv        one row per project (org_id → orgs.csv)
  people.csv          one row per person (referenced by orgs and projects)
  links.csv           typed connections between organizations
tools/                one-off migration scripts that produced data/
```

## The CSV data layer

All data lives in four auditable CSV files that open in any spreadsheet tool:

| File | Row | Key columns |
| --- | --- | --- |
| `orgs.csv` | an organization | `roles`, `people`, `tags`, `keywords`, `areas` |
| `projects.csv` | a project | `org_id` (lead), `collab` (partner orgs), `people`, `areas` |
| `people.csv` | a person | `id`, `name`, `title`, `url` |
| `links.csv` | a connection | `source_id`, `target_id`, `type`, `label` |

Multi-value cells are `|`-separated. The first entry in `roles` is the organization's primary role.
`people` and `collab` hold IDs that point at `people.csv` and `orgs.csv`.
Connection `type` is one of **fund**, **support**, or **collaborate**.

The app loads these at startup; browser edits are persisted to localStorage *as CSV text*, so what
you edit is exactly what **Export CSV** downloads. Commit exported files back into `data/` to make
edits permanent for everyone.

## The Data editor

Open with **Data (CSV)**. Read-only browsing is available to everyone for auditing; **Edit**
(password: `flourishing`) unlocks changes.

- **Organizations is the hub view.** Alongside every CSV column it carries this organization's
  **projects** and **connections**, so one row covers the whole record.
- **Every multi-value column is tags.** Click **＋** for a dropdown of existing values — roles and
  flourishing areas are fixed vocabularies, while tags, keywords, and people also offer
  *create new*. Click **✕** on a tag to remove it.
- **Connections are typed** (fund · support · collaborate) and color-coded, with an arrow showing
  direction. Click a connection to change its type or label; add one from the dropdown of existing
  organizations, or create and connect a brand-new organization in one step.
- **People are their own table.** Adding a person from an organization creates the `people.csv` row
  automatically; the People tab shows each person's affiliations (organizations and projects) as
  clickable tags.
- **Tags navigate.** Clicking a person, project, or organization tag jumps to that row and
  highlights it for editing.
- **Custom columns** (audit status, sources, notes…) can be added, renamed, and deleted per table.
  They are saved, exported, and searchable; core columns the map depends on are protected.
- **Auditing.** Tags and cells pointing at a nonexistent ID show red, as do duplicate IDs. Renaming
  an organization or person `id` updates every reference across all four files.
- **Import/export** works per table or for the whole dataset.
