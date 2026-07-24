# Ecosystem research — staged findings (July 2026)

Eight research agents swept all 69 organizations in `data/orgs.csv`, looking for (a) projects and
initiatives relevant to AI and human flourishing and (b) connections to other organizations already
in the map. Every item traces to a page an agent actually fetched; the `source` column holds that URL.

| File | Rows | Schema |
| --- | --- | --- |
| `proposed-projects.csv` | 91 | `projects.csv` columns + `confidence` + `source` |
| `proposed-links.csv` | 75 | `links.csv` columns + `confidence` + `source` |

Confidence: projects are 66 high / 25 medium. Connections are 44 high / 17 medium / 14 low.

## Merge status

**The 66 high-confidence projects and 44 high-confidence connections have been merged into `data/`**
(projects 88 → 154, connections 47 → 91). Merged rows carry their verification URL in a new `source`
column added to `projects.csv` and `links.csv`; pre-existing rows have it blank, so the column doubles
as a marker of which records are research-backed.

The remaining **25 medium-confidence projects and 31 medium/low-confidence connections were not
merged** and stay here as a review queue. Every weak edge called out below fell into that group.

Do not use the Data editor's **Import CSV** to merge the rest — import *replaces* a table rather than
appending. The merge was done by appending rows and re-validating; ask and the same can be run at a
lower confidence threshold.

## Corrections to existing records

- **`jig-perspective` (Perspective API) is being sunset.** No new sign-ups; existing keys work only
  through 31 December 2026, with no official migration path. The project entry should be marked
  as winding down. Jigsaw's own FAQ page failed to load, so this rests on secondary sources.

## Identity cautions — do not conflate

- **`oxford-wrc`**: the "Flourishing Intelligence Program (FLIP)" that works on AI and flourishing
  belongs to Oxford's *Centre for Eudaimonia and Human Flourishing* (Linacre College), a different
  unit from the *Wellbeing Research Centre* (Harris Manchester College) that `oxford-wrc` represents.
  No AI-specific work was found on the Wellbeing Research Centre's own site.
- **`templeton`**: the John Templeton Foundation is legally distinct from Templeton World Charity
  Foundation and Templeton Religion Trust. Global Flourishing Study money is credited to the group
  collectively and routed mainly through Baylor, so per-entity funding edges are unreliable.
- **`deepmind` / `msr`**: EU GPAI Code of Practice signatories are the corporate entities "Google"
  and "Microsoft", not specifically Google DeepMind or Microsoft Research. The `eu-ai-office →
  deepmind` edge is marked low for this reason; no Microsoft edge was recorded at all.
- **`govtech-sg`**: the May 2026 OpenAI and Google agreements were announced at ministry level
  (MDDI), with GovTech as implementing agency — hence low confidence on `govtech-sg → openai`.
- **`baylor-isr`**: the 2025 "Institute for Global Human Flourishing" may be a rebrand or expansion
  of the existing entry rather than a separate body.

## Weak edges worth scrutiny

The five `oxford-ethics` connections all come from one 2025 summit agenda — they reflect individual
speakers representing those organizations, not institutional partnerships. The three `wef` membership
edges rest on a single secondary source because the official partners page returned 403. The two
`artist-machine` edges come from attendee and sponsor lists. Consider dropping these rather than
merging them.

## Organizations where little or nothing new surfaced

`aha` (already thoroughly documented), `oxford-wrc`, `upenn-ppc`, `uva-csc`, `ai2`, `msr`, `oecd`,
`thrive`, `wwm`, `schmidt`, `5rights` (no org-level ties), `aspen-digital` (no roster ties),
`artist-machine`. For `ai2` and `msr` the agents concluded activity is real but not flourishing-specific.

## Candidate organizations not yet in the map

Recurring names that fall outside the current 69 and may deserve entries: Centre for Eudaimonia and
Human Flourishing (Oxford), Templeton World Charity Foundation, Future of Life Institute, Open
Philanthropy, Chan Zuckerberg Initiative, Digital Public Library of America, Young People's Alliance,
Transluce, Einhorn Collaborative, Preston-Werner Ventures, Center for Democracy and Technology, DAIR
Institute, TechEquity, Pulitzer Center, Thomson Reuters Foundation, Barna Group, LSE (co-runs the
Digital Futures for Children centre), and the Humanity AI funders not yet listed (Mellon, Doris Duke,
Lumina, Kapor, Packard, Siegel Family Endowment).

## Caveat

Findings are as good as the pages the agents reached. Several primary sources returned 403 or failed
to load and were noted as such by the researching agent. Confidence values are the agents' own
judgements, not an independent audit.
