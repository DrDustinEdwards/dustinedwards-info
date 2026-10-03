# Admin retirement and redesign — Phase 1 report

Phase 1 only: an inventory and a map, no code moved, no hub touched. Written by a Capsid
driver session (job job_a94ed0916377) on 2026-10-03, from this repo's checkout plus the
seat evidence given in the job body. Everything marked **seat evidence** came from the job
body, not from this runner reading another repo; everything else cites a path in this
checkout. Where neither could settle a question, it says "not verifiable from the runner."

Standing decisions this report maps against (job body, restated 2026-10-03): Carrel is the
hub for writing and everything after publication; Capsid is the hub for operations; there
is no third hub; each site's own editor and media code is to be removed; sites draw on
Capsomer (design) and Enarratio (charts and figures).

## A and B. Inventory, destination, and whether the hub already does it

### Admin pages (under `app/routes/admin.*`)

| Page | What it does | Destination | Does the hub do it today? |
|---|---|---|---|
| `admin.tsx` (shell, nav, Access/smoke auth middleware) | Sidebar, topbar, sign-out, Cloudflare Access gate, a read-only "smoke" bearer for synthetic checks, Ask-drift nav badge | Carrel for the editor's shell; Capsid for nothing (it has no per-site UI shell); **some stays** — Cloudflare Access is this site's own front door and is itself slated for removal per the job body ("Better Auth and Google sign-in are to be removed"), which does not include Access. Access is the thing every other admin page in this inventory depends on for "who may write"; no replacement is named here. | Partly. Carrel has its own Reader/Editor/Owner roles (seat evidence, Carrel README "Who may do what") but only for its own screens — it has nothing for this site's Overview, Tools or Mentions pages, so Access-gated pages stay here until those pages move. |
| `admin._index.tsx` (Overview) | Runs `runHealthChecks` (`app/lib/health/checks.server.ts`) and `syncStatus` (`app/lib/operator/sync-tools.server.ts`): D1-vs-repository post counts, Ask index doc count, divergences the site failed to pick up, one repair button per failing check | Capsid (operations) | Partly. Capsid Portal's Sites view has uptime, deploys and CI (seat evidence, `docs/portal.md`) but nothing about D1-vs-repository convergence for THIS site's content types (posts, procedures, pages, CV, dictionary, phages, roster) — that check is specific to this site's own sync pipeline. |
| `admin.posts._index.tsx` + `app/lib/admin/posts-actions.server.ts` | List/filter/search posts; bulk delete, bulk tag, duplicate, unpublish, regenerate all from repo, sync/reset the Ask index and its budget | Carrel (posts list is explicitly a Carrel feature) | Yes for the list and filters (seat evidence: "Posts: one view of a site's posts with status and kind filters and FTS5 search"). No for bulk delete/tag/duplicate/regenerate/Ask-sync — not in the seat evidence's description of Carrel, and Carrel's "Follow-up features, not built" list names no bulk post actions. |
| `admin.posts.new.tsx`, `admin.posts.$slug.edit.tsx` (+ `PostEditor`, `handleEditorAction`) | The markdown editor: toolbar, link palette, autosave, preview, publish/schedule/unpublish, delete | Carrel | Yes, in outline (seat evidence: toolbar, link palette, slash menu, autosave to D1, Cmd+S, Owner-only publish). Carrel's editor is Capsomer's, in a prose layout; this site's is its own component tree (`app/components/admin/post-editor.tsx`, `markdown-editor.tsx`, `md-editor-toolbar.tsx`, `md-editor-commands.ts`, `use-link-palette.ts`, `use-draft-buffer.ts`, `use-live-preview.ts`). Two concrete gaps block the swap even once Carrel is pointed at this site: this site pins site-api v0.1.0 while Carrel's media needs v0.2.0 (seat evidence), and revision compare (see below) is on Carrel's not-yet-built list. |
| `admin.posts.$slug.history.tsx` | Full commit history for a post's file, with a diff viewer (`app/components/admin/revision-list.tsx`) | Carrel | No. Seat evidence lists "version history and draft compare" under Carrel's "Follow-up features, not built." |
| `admin.posts.$slug.revisions.tsx` | JSON resource route: commit list, a commit's rendered fields, or its patch, by sha — the data the editor's revisions drawer reads | Carrel (goes with history/compare) | No, same gap as above. |
| `admin.preview.ts` | POST: renders markdown through the same pipeline a publish would use (`loadPipeline().renderBody`), returns HTML and a heading count; writes nothing | Carrel | Yes in spirit (seat evidence: "Preview: the site's own render in a sandboxed iframe"), but Carrel's preview is described as rendering the site's own page, not necessarily reusing THIS exact content pipeline function; not verifiable from the runner whether Carrel's preview calls an equivalent render path for this site today. |
| `admin.media._index.tsx` | Browse/search/facet/sort media, bulk tag, trash/restore/empty-trash, set alt text, rebuild from R2, resolve which posts cite a file, an inspector drawer | Carrel | Partly. Seat evidence: Carrel's media (site-api v0.2.0) has browse, search, details, "where used," upload, delete. NOT in Carrel per the same evidence: bulk actions, trash, tags, folders, alt-text editing after upload — all of which this page has. And this site is pinned to site-api v0.1.0, so even the "partly" does not work yet (seat evidence names job_b47a6cf0ee20 as the pinning upgrade). |
| `admin.media.upload.ts` | POST endpoint the editor's paste/drop-to-upload and the media page's uploader call; stores to R2 via `app/lib/media/upload.server.ts` | Carrel | Yes for the capability (seat evidence: "upload" is in Carrel's v0.2.0 media group), blocked by the same v0.1.0 pin. |
| `admin.mentions.tsx` | Webmention queue: approve/reject/delete one, sweep expired failed/rejected, filter by status | **Decision for Dustin** — not described as moving anywhere in the job body | No. Seat evidence: "Carrel has nothing for webmentions, site settings, or operations views." Capsid Portal also has nothing webmention-shaped (seat evidence, `docs/portal.md` feature list). This is the clearest "stays, or needs a decision" item in the inventory. |
| `admin.tools.tsx` | Three unrelated things on one page: secret-presence audit (name + set/not-set, no values), a "remove expired zero-result search queries" button, and the home page's featured-podcast-episode picker | Capsid for the secrets audit (an operations concern); **stays on the site, undecided** for zero-result purge and the podcast picker — neither is operations (Capsid) nor writing/publication (Carrel) | No for all three. Capsid Portal has a Settings section for "sites and packages" (seat evidence) but nothing described as a per-secret presence audit, and nothing like a search-miss log or a podcast-slot picker exists in either hub per the seat evidence. |
| `admin.logout.tsx` | Redirects to `/cdn-cgi/access/logout`, clearing the Cloudflare Access cookie | Stays on the site | N/A — this is Cloudflare Access's own endpoint, not a hub concern. Moves only if Access itself is replaced, which is out of scope here. |

A stray not worth its own job: `admin.tsx` defines a `traffic` nav icon (`ICONS.traffic`,
`app/routes/admin.tsx:196-201`) that no `NAV` entry uses — the traffic-tracking admin page
is already gone from this checkout, consistent with the already-decided removal of the
self-built traffic tracking (job body, "ALREADY DECIDED ELSEWHERE"), but the dead icon
constant was left behind. Worth a one-line cleanup whenever this file is next touched.

### Admin APIs, operator tools, and non-page pieces (item A: "anything under admin that is
not a page")

`app/routes/api.operator.ts` is the one HTTP surface; `app/lib/operator/api.server.ts`
(`runTool`, 641 lines) dispatches 30+ tool names, far more than the eight the admin MCP
wraps. By destination:

| Tool group (in `runTool`'s switch) | What it covers | Destination | Hub today |
|---|---|---|---|
| `list_posts`, `get_post`, `save_post`, `delete_post` | The four the admin MCP wraps (seat evidence, `operator-mcp-wrapper.md`) for posts | Carrel, via its own MCP door once Carrel talks to this site (seat evidence: "AI work through Carrel's MCP door: read, search, preview, AI drafts... publish only in the Owner's own sessions") | Partly — Carrel's MCP door covers read/search/preview/draft/publish-on-instruction, which overlaps these four in intent but is a different surface (Carrel's own door, not this site's `dustinedwards-mcp`). Not verifiable from the runner whether Carrel's door, once pointed at this site, calls equivalent site-api endpoints or re-implements them. |
| `sync_status` | The convergence numbers Overview and the MCP's `sync_status` both read | Capsid | No — same gap as Overview above. |
| `list_mentions`, `decide_mention` | What `admin.mentions.tsx` and `dustinedwards-mcp` both call | Same open decision as the Mentions page | No, in either hub (seat evidence). |
| `upload_media` | What the media page and Carrel's future media group would call | Carrel (blocked on the v0.1.0→v0.2.0 pin, seat evidence) | Partly, blocked. |
| `sync_ask`, `sync_media`, `sync_posts`, `sync_procedures`, `sync_dictionary`, `sync_pages`, `sync_cv`, `sync_cv_pdf`, `sync_publications`, `sync_llms`, `sync_roster`, `sync_phages`, `backup_media` | Repository-to-D1/R2/Ask convergence for every content type this site has, one tool per type, all funneling through hard rule 18 (indexes converge toward the repo) | Capsid (operations) for the repair/monitoring surface; the convergence logic itself stays site-specific, since it is this site's own schema and content pipeline | No. Capsid Portal's Queue and Incidents views (seat evidence) track jobs and watcher findings generically, not per-content-type repo convergence for this site. These are exactly the kind of thing Overview's repair buttons call (`app/lib/admin/check-copy.mjs` wires a check to a repair intent and action), so Capsid picking this up means Capsid gaining a per-site "run this repair tool" affordance, not just a read-only status view. |
| `list_procedures`/`get_procedure`/`save_procedure`, `list_publications`/`get_publication`, `refresh_citations`, `list_pages`/`get_page`, `get_llms`, `list_cv`/`get_cv`, `list_dictionary`/`get_dictionary`, `list_roster`/`get_roster`, `list_phages`/`get_phage` | Read/write for every OTHER content type this site has besides posts: procedures, publications, pages, CV, the dictionary, the phage roster, the researcher roster | Carrel in principle (it is writing), but **none of this has an admin PAGE** — there is no `admin.procedures.tsx` etc. in this checkout; these exist only as operator-API tools, reachable today solely through the `dustinedwards-mcp` Worker or a direct POST. | Not verifiable from the runner whether Carrel's current scope (seat evidence describes it purely in terms of "posts") extends to these other content types at all. This is a real gap to flag for Dustin: these content types have no UI anywhere today, admin or Carrel — only an API. |

`workers/watchdog.ts` (separate Worker, `wrangler.jsonc.example`) has no admin PAGE of its
own — it is a scheduled job that calls `GET /api/health` (`readHealth`, line 87) and
`POST /api/operator` with tool names `refresh_citations` and whatever `watchdogActions`
(`app/lib/health/repair.mjs`) returns for a failing check, then e-mails on a red/green
transition. It is the automated version of clicking Overview's repair buttons. Destination:
Capsid (operations) — seat evidence shows Capsid Portal already reads "live deploy and
errors from Cloudflare" and "Incidents (watcher findings)" for every roster repo, which is
the same job this Worker does for one repo today; the gap is that Capsid's watcher does not
yet call this site's repair tools (`sync_*`, `refresh_citations`) the way this bespoke
Worker does, and Capsid has no per-site e-mail-alert equivalent described in the seat
evidence (it has Incidents, which is a different shape — a read surface, not an alerter).

Other non-page admin-adjacent code, for completeness (item A):

- `app/lib/cache-purge.server.ts` — purges the CDN cache for a content type after a write;
  called from almost every write path above (posts, mentions, procedures, pages, CV, roster,
  phages, publications, llms). Stays with whichever hub does the write, since a write and its
  purge are described everywhere in this codebase as one unit (e.g. `admin.mentions.tsx`'s
  comment: "the write and the purge together").
- `app/lib/admin/secrets.server.ts` (`auditSecrets`) — presence-only secret audit backing
  the Tools page. Capsid (operations), per above.
- `app/lib/search/zero-result.server.ts` — records and purges searches that found nothing.
  No hub home named in the job body; a site-specific content-quality signal, closest in kind
  to Carrel's "flags" concept (seat evidence) but not the same thing. Flagged as a decision.
- `app/lib/webmention/decide.server.ts` — the write path both the Mentions page and
  `decide_mention` call. Travels with wherever mentions end up.
- `app/lib/media/actions.server.ts`, `app/lib/media/upload.server.ts` — the media write
  paths. Travel with Carrel's media once v0.2.0 lands (seat evidence names job_b47a6cf0ee20).
- `app/lib/podcast/podcast.server.ts`, `podcast/feed.mjs` — the home-page featured-episode
  picker backing Tools. No hub named; flagged as a decision below.

## C. What each hub needs before a "partly"/"no" piece can move

Worded so the seat (or Dustin) can post each as one job in the hub named.

1. **capsid job** — add a per-site content-convergence view: for each content type this
   site has (posts, procedures, pages, CV, dictionary, phages, roster, publications), show
   the repository count vs. the D1/R2/Ask count and any named divergence, reading the same
   `sync_status`-shaped tool this site's `/api/operator` already exposes. Without this,
   Overview (`admin._index.tsx`) cannot retire.
2. **capsid job** — give Capsid Portal a "run this repair" action per site, scoped to a
   named allowlist of operator tools (`sync_posts`, `sync_media`, ... `refresh_citations`),
   so a failing check can be repaired from the portal the way Overview's repair buttons do
   today (`app/lib/admin/check-copy.mjs`). Without this, Overview's repair buttons have
   nowhere to move to — Capsid's Queue/Incidents are read-only per the seat evidence.
3. **capsid job** — extend Capsid's watcher to call a site's repair tools and the weekly
   `refresh_citations` tool the way `workers/watchdog.ts` does, plus a per-site e-mail alert
   on a health transition, so this Worker and its `ALERT_EMAIL`/`EMAIL` binding can retire.
4. **capsid job** — add a secret-presence audit (name + set/not-set, never a value) to
   Capsid's Settings so `admin.tools.tsx`'s secrets section can retire.
5. **carrel job** — this site's `package.json` pins site-api v0.1.0; upgrading to v0.2.0 is
   already tracked as job_b47a6cf0ee20 per the seat evidence and is the gate on ANY of
   Carrel's media features working for this site, not just the ones Carrel already has.
6. **carrel job** — add bulk media actions (tag, trash, delete), folders, and alt-text
   editing after upload. Named explicitly as missing in the seat evidence's Carrel README
   quote. Without these, `admin.media._index.tsx` cannot retire even after the v0.2.0 pin.
7. **carrel job** — add version history and a diff viewer for a post's commits, plus draft
   compare (a human draft against an AI draft). Named explicitly as "Follow-up features, not
   built" in the seat evidence. Without this, `admin.posts.$slug.history.tsx` and
   `admin.posts.$slug.revisions.tsx` cannot retire.
8. **carrel job** — add bulk post actions: delete, tag, duplicate, regenerate-from-source,
   and a visible Ask-index sync/reset control. Not mentioned at all in the seat evidence, so
   treat as a genuine gap rather than a "not built yet" item already on Carrel's list.
9. **carrel job, scope question for Dustin first** — decide whether procedures, publications,
   pages, CV, dictionary, phages and the researcher roster are in Carrel's scope at all. They
   are real content types this site publishes, each with full operator-API read/write
   already, and zero UI anywhere today.

## D. Charts and figures

Compared against Enarratio 0.1.0-alpha.8, the version pinned in `package.json` and installed
at `node_modules/enarratio` — a newer version may already close some of these gaps; not
verifiable from the runner.

| Where | What it draws | From Enarratio? | Evidence |
|---|---|---|---|
| `app/lib/cv/charts.ts` (`timelineSvg`, `sparklineSvg`) | The CV page's stacked-by-year output timeline and headline sparklines | **Yes.** Calls `barChart` and `sparkline` directly from `enarratio` | `app/lib/cv/charts.ts:13` imports `{ barChart, sparkline } from "enarratio"`; rendered again for the client filter at `app/routes/cv.charts[.json].ts` |
| `app/styles/enarratio.css` | The stylesheet every Enarratio figure on the site uses | **Yes**, generated | `scripts/build-chart-css.mjs` calls `stylesheet(dustinedwardsTheme, ...)` from `enarratio` and writes the file verbatim; a comment there says "Do not edit." |
| `app/lib/content/chart.mjs` (`buildChartModel`, `marksFor`, `renderChartHast`) — the blog post `:::chart` directive (bar/line/dot/area from an authored CSV table) | Every data chart embedded in a post | **No.** Imports `@observablehq/plot` and `linkedom` directly (`app/lib/content/chart.mjs:4-5`) and hand-builds the `Plot.plot()` call, the mark selection, a 6-color series palette (`CHART_SERIES_TOKENS`, distinct from Enarratio's `dustinedwardsTheme` palette), the accessible SVG labeling, and a `<details>` data table — all of which Enarratio's own chart functions already provide as part of their returned `<figure>` (per Enarratio's own package description, "Accessible, server-rendered charts... every chart function returns HTML... include a data table"). | `app/lib/content/chart.mjs` (388 lines); `app/lib/content/chart-types.mjs` names the four types `bar`, `line`, `dot`, `area`, which map directly onto Enarratio's exported `barChart`, `lineChart`, `scatterPlot`, `areaChart` (`node_modules/enarratio/dist/index.d.ts`) |
| `app/lib/content/diagram.mjs` + `scripts/build-diagrams.mjs` — the blog post `:::diagram` directive (mermaid flowcharts/sequence diagrams, pre-rendered to SVG at build time) | Structural diagrams, not data charts | **No**, and not applicable — renders via `@mermaid-js/mermaid-cli`'s `renderMermaid` (`scripts/build-diagrams.mjs:5`), a different kind of figure than anything in Enarratio's export list (bar/heatmap/area/line/network/scatter/progress-ring/sparkline/uptime-strip/genome-track/geometric-summary/titer-plot — no flowchart/sequence primitive). | `scripts/build-diagrams.mjs`; `node_modules/enarratio/dist/index.d.ts` |

**What Enarratio needs, if anything (worded as enarratio jobs):**

- **No enarratio job needed for `:::chart`.** Enarratio 0.1.0-alpha.8 already exports
  `barChart`, `lineChart`, `scatterPlot` and `areaChart` with options shaped like what
  `buildChartModel` already produces (`x`, `series`/`fill`, numeric `y` values, a `colors`
  map, an `alt` string — see `app/lib/cv/charts.ts`'s own `barChart` call for the pattern
  this site already uses). This is a **site job**, not an Enarratio job: replace
  `app/lib/content/chart.mjs`'s hand-rolled `Plot.plot()`/`marksFor`/`renderChartHast` with
  calls to Enarratio's exported chart functions, keeping only the CSV-parsing and
  `:::chart`-attribute-validation parts, which are specific to this site's authoring format
  and have no reason to live in a general-purpose charts package.
- **Possible enarratio job, not urgent:** Enarratio has no mermaid-style structural-diagram
  primitive. If Dustin wants `:::diagram` unified under Enarratio too (rather than staying on
  `mermaid-cli`), that is new scope for Enarratio, not a gap in an existing feature — flagged
  as a decision below rather than written up as a job, since the job body's standing
  decisions describe Enarratio as "charts and figures," and a mermaid flowchart is arguably a
  figure. Not verifiable from the runner whether Enarratio's maintainers already consider
  this in scope.

No other chart, plot, or generated-figure code was found outside these three locations
(`app/lib/cv/`, `app/lib/content/chart.mjs`, `app/lib/content/diagram.mjs` and their
scripts); a repo-wide search for `@observablehq/plot`, `d3-*`, and similar direct rendering
turned up only `app/lib/content/chart.mjs` outside `node_modules`.

## E. Decisions for Dustin

- **Mentions** (`admin.mentions.tsx`, `list_mentions`/`decide_mention`): neither hub has
  anything for webmentions today (seat evidence). Does this stay on the site permanently, or
  is it a feature to request in Carrel (as part of "everything after publication") or Capsid
  (as an operations queue)?
- **Procedures, publications, pages, CV, dictionary, phages, roster**: these have full
  operator-API read/write and zero UI anywhere — not in this site's admin, not in Carrel.
  Is Carrel meant to grow to cover them, or do they stay as API-only, agent-edited content?
- **Tools page's zero-result-search purge and home-podcast picker**: two unrelated, small,
  site-specific controls with no obvious hub home. Fold into Capsid as misc "site settings,"
  leave on the site permanently, or something else?
- **Convergence repair (the `sync_*` tools and Overview's repair buttons)**: moving the
  read-only status view to Capsid is a clear fit; moving the ability to TRIGGER a repair from
  Capsid is a bigger step (Capsid "never merges and never mints," per the seat evidence, so
  giving it a repair-trigger button is new scope, not a status read). Confirm that is wanted
  before C.2 above is posted as a job.
- **Diagrams and Enarratio**: should `:::diagram` eventually move under Enarratio alongside
  `:::chart`, or is mermaid-via-build-script the intended permanent split between "data
  charts" and "structural diagrams"?

---
*Marked PARTIAL: no. This covers every admin route, every operator tool, the watchdog
Worker, and every chart/figure/diagram builder found in the checkout. What it could not do —
verify Carrel's or Capsid's CURRENT shipped behavior beyond the seat evidence quoted in the
job body, or check an Enarratio version newer than 0.1.0-alpha.8 — is marked inline above as
"not verifiable from the runner" or "seat evidence," not guessed at.*
