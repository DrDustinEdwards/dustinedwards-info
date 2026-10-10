# The Knowledge Base: design

Job job_898286365026 (it replaces job_07897d6982f5, whose six points all stand). A design, written before any of it is
built: it says what the Knowledge Base is, what each finding of the seat's research
(`dustinedwards/research/knowledge-base-flagship.md`) becomes, the order of the build, and what Dustin decides first.
Nothing here is built yet. Where the repo and this document disagree after the build starts, the build changes this
document in the same pull request.

It builds on what exists and redesigns none of it: one procedure format with three profiles, versions and frozen
copies, the printed sheet and its QR code, calculators in steps, the protocol library on Capsomer's catalog, run mode,
the JSON-LD (docs/PROCEDURES.md), and the lab registry's four kinds and 41 records (docs/REGISTRY.md).

## What it is

A Knowledge Base is a set of procedures of one profile, with its own library page, its own addresses and its own
panel in the admin. Three to start:

| Knowledge base | Profile | Library | Entry addresses (kept as they are) | Entries today |
| --- | --- | --- | --- | --- |
| Protocols | `protocol` | `/research/protocols` (exists) | `/research/protocols/<slug>` | 5 |
| Software how-tos | `computational` | `/software/how-tos` (DECIDE 4) | `/software/how-tos/<slug>` (moved from the unused `/research/methods`) | 0 |
| Recipes | `recipe` | `/recipes` | `/recipes/<slug>` | 0 |

The Protocols knowledge base also owns the lab inventory: the registry's items and, new, their lots.

**Shared, written once:** the file format and compile, the D1 rows and frozen versions, the entry page, sheet and twin,
the library page (the catalog over the rows, driven by a per-base `LIBRARY` declaration as the protocol library is now),
the admin panel (list, search, edit), search records, run mode and its record, and the item pages.

**Per knowledge base, and only the differences:** protocol (biosafety, strains, primers, reagents, equipment,
calculators, lots, the Key Resources Table), recipe (servings, scaling, substitutions, photos, the unit switch, cook
view, shopping view), computational (environment, commands with expected output, the Diátaxis type, platform tabs,
challenges).

**The knowledge bases are declared as data in code**, one frozen list in `app/kb/bases.mjs` (`id`, `name`, `profile`,
`entryRoot` today; the library and admin panel settings join it with the steps that use them), read by the routes and
the procedure validator, and later the admin nav and the libraries. A fourth base of an existing profile is one entry there. A D1 table of bases is not worth it: a base without
its profile's components is nothing, and profiles are code, so a table would only move the list somewhere a gate cannot
read it (DECIDE 2).

**One folder.** Knowledge Base code lives in `app/kb/`: the procedures in `app/kb/procedures/`, the lab registry in
`app/kb/registry/` (both moved there from `app/lib/` in step 1, with no behaviour change) and the list of bases in
`app/kb/bases.mjs`. New routes go in `app/routes/kb.*`. The whole thing could later be lifted out; nothing is built for
that (DECIDE 6).

## The admin

One rail entry, **Knowledge Base**, at `/admin/kb`. It opens on a panel per knowledge base, drawn from `bases.mjs`, as
Capsomer's links-form tabs with counts (docs/ADMIN-DESIGN.md: tabs are links, the state is the address). Each panel is
the one table pattern: title first with its status pill (draft, published, version, gaps), a search box that submits on
Enter, the per-base facets as tabs, a kebab per row (edit, view, sheet, history). Beside the bases is **Needs info**:
every `MISSING` gap across entries and registry items, with its field and reason, which is today's `get_procedure` and
`get_registry` gap lists on one screen. It is a tab of its own, not a part of Protocols, because its gaps span every
base and the registry. The Protocols panel's **Inventory** tab (items and lots) waits with step 4.

The editor writes through the save that exists (`save_procedure`'s validator and commit path, `saveRegistryItem`), so
the admin adds no write path and no second validator. It starts as the whole file in Capsomer's markdown editor, with
Check (every check a save runs, nothing committed) and Save; a row of a base's list and a row of Needs info open their
file in it. A structured form for the front matter the profile declares, with the live preview the post editor already
has, comes after it.

## Where the facts live (DECIDE 1)

Two kinds of fact, two homes:

- **Reference facts stay files**, with D1 their served copy (hard rule 18): every entry, and every item's public
  facts (name, specs, supplier, catalog number, RRID, which protocols use it). They are cited, frozen into versions,
  printed on sheets and reviewed by pull request, and they change rarely.
- **Inventory state and runs start in D1**, with an audit table: lots (lot number, expiry, amount, location, received,
  opened), locations, run records, members and roles. They change daily, are edited by students and staff, are
  private, and must never be committed to a public repository. Every write appends an `kb_audit` row (who, when,
  what, the row before and after), so the history a file would have given is kept. The backup the bucket already
  takes covers the tables (`check:backup`).

Making D1 the source for the item definitions as well was weighed and is not recommended: the protocols bake an item's
facts into their records and frozen versions at compile time, from the repository, and that chain (and its drift
checks) would have to be rebuilt for no gain a reader would see.

## Roles (DECIDE 3: waits for job_4acb6ae89b9f)

**Not approved.** Who signs in and what lab people may do is its own job, job_4acb6ae89b9f (one roles model across the
family; likely a separate `/lab` workspace for operational lab data, `/admin` owner-only, levels Owner, Lab manager and
Lab worker). Until it is answered this build adds no non-owner sign-in, no roles and no members page, puts no
lab-member feature in `/admin`, and keeps the names and paths that design reserves (`/lab`) free. What follows is the
proposal that was put to Dustin, kept for that job to read.

Today every person Cloudflare Access admits to `/admin` is the admin (`app/routes/admin.tsx`). Students and staff
cannot simply be added to that Access policy. The design: a `kb_members` table (email, role, added by, added at) and
three roles. **Owner** (Dustin, named in config): everything. **Staff**: edit entries as drafts, manage items and lots,
record runs. **Student**: read private procedure fields, record their own runs, mark a lot used or empty. The admin
middleware reads the role after Access verifies the person; an Access-admitted email with no row gets a refusal
naming who to ask. Only the owner publishes, and only the owner sees Posts, Media and the rest of the admin.

## The research, item by item

Each finding of the seat's research, with keep (exists already), build, or skip, and why. Ordered by value within each
knowledge base; the build order below interleaves them. Claims were checked against primary sources on 2026-10-09
(see Sources).

### Protocols

| # | Finding | Verdict | Why |
| --- | --- | --- | --- |
| P1 | Key Resources Table from the inventory (catalog numbers, RRIDs), grouped as STAR Methods groups it | **Build** | The facts are already in the registry; a table drawn from them is cheap and is what a methods section and a reviewer ask for. Columns are Reagent or resource, Source, Identifier. The identifier is the catalog or collection number the registry holds (`ATCC 700084`); an `rrid` field is added for the kinds RRIDs cover (antibodies, cell lines, plasmids, software), written only from the RRID portal. The lab's two strains have none to cite: published tables give mc²155 as `ATCC: 700084`. The group headings are taken from Cell Press's template when built (see Sources). |
| P2 | Run records for lab members that record which lots were used, so a bad lot traces to every run | **Build** | The one thing the inventory makes possible that protocols.io cannot do. Run mode already makes the record; this saves it to D1 for a signed-in member, with lot ids per material. A lot's page lists its runs. Private. |
| P3 | Fork a protocol into a variant with its lineage | **Build, small** | A `forked_from: { slug, version }` field, validated against the frozen copy, shown as "Based on X v2" and in the JSON-LD `isBasedOn`. The admin's "Fork" copies the file under a new slug. No merge-back. |
| P4 | JSON-LD on Bioschemas LabProtocol 0.9-DRAFT, runs as LabProcess | **Build the version bump; LabProcess only in a run's own download** | The site states 0.8-DRAFT today (`app/kb/procedures/json-ld.mjs`). 0.9-DRAFT adds `parameter` (PropertyValue, a condition such as temperature or time) on the protocol as a whole, not per step, so the bump fills it from the temperatures and spins the compile already reads. Runs are private, so a public LabProcess (0.1-DRAFT: `executesLabProtocol`, `agent`, `object`, `result`, `instrument`) would publish nothing; it is the shape of a run record's JSON download. |
| P5 | Versions, frozen copies, DOIs, scaling, structured steps | **Keep** | Built (docs/PROCEDURES.md). |

### Recipes

| # | Finding | Verdict | Why |
| --- | --- | --- | --- |
| R1 | Recipe JSON-LD | **Keep** | Built; Recipe is still a supported rich result (no 2025 deprecation names it), with HowToStep instructions as Google recommends. Per-step ingredients would need HowToDirection with `supply` inside each step, which schema.org allows and Google does not read, so the step's text (which carries its amounts) stays the machine's per-step list. |
| R2 | Ingredients both ways: a step's ingredients, and every step an ingredient is used in | **Build** | The marks already link each amount to its step, so both lists are computed from the record with no new data. Rendered on the server; with script, tapping toggles. |
| R3 | Metric and imperial, weight and volume switch | **Build, metric/imperial only; volume to weight where the record states a density** | Unit conversion is arithmetic; volume to weight needs a density per ingredient, which is a fact the recipe must state (`grams_per_cup`), never a table guessed from the web. A recipe without it shows no weight. The server renders each state at its address (`?units=imperial`), as scaling does. |
| R4 | One step at a time cook view, large text, timers, screen kept awake | **Build, on run mode** | Run mode already has timers that survive sleep and the Wake Lock; the cook view is a presentation of it, not a second engine. The Wake Lock works in Chrome, Firefox 126 and Safari (iOS 18.4 and later also from the Home Screen), and the bar already says when it is refused. |
| R5 | Shopping and mise-en-place view | **Build, mise-en-place; shopping list as copy text** | A checklist of every ingredient at the chosen scale and units, the same list R2 computes. Merging across several recipes is skipped (one cook, one recipe at a time). |
| R6 | Voice next and previous | **Skip** | Browser speech recognition is uneven and a large tap target serves gloved or wet hands as well. |

### Software how-tos

| # | Finding | Verdict | Why |
| --- | --- | --- | --- |
| S1 | Tutorial or how-to, labelled per Diátaxis; explanation in linked pages | **Build** | A required `type: tutorial \| how-to` field, shown as a label and a library facet; `explanation:` links to pages. The check refuses a `WHY:` flag longer than a few sentences in a how-to and says to link instead. |
| S2 | Objectives and a time estimate at the top | **Build** | `questions`, `objectives` and `time` (which every profile already has) shown first, key points at the end, as a Carpentries episode orders them; required for a tutorial. |
| S3 | Verify steps | **Keep** | `EXPECT:` and the expected output block are this; rename nothing. |
| S4 | Platform tabs where commands differ | **Build** | A fenced block may carry `platform=windows\|macos\|linux`; the page shows tabs (links with no script, the reader's choice remembered with script), the twin and the sheet list all. |
| S5 | Challenges with hidden solutions for teaching entries | **Build, tutorials only** | `> CHALLENGE:` and `> SOLUTION:` flags under a step (the Carpentries challenge with a nested solution), the solution in a `<details>`, so it works with no script and machines get both (the AI-first rule). |
| S6 | HowTo JSON-LD | **Keep, for machines only** | Google stopped showing HowTo rich results on 13 September 2023; it is still the closest schema.org type and machines read it. |

### Across all three

| # | Finding | Verdict | Why |
| --- | --- | --- | --- |
| A1 | Item pages that list every entry using the item | **Build** | Primers and strains have pages and already list their protocols; reagents and equipment become pages (their `itemPages: false` is reversed), ingredients and software become items of their bases. |
| A2 | One search across knowledge bases, plus each one's facets | **Keep the one search; build the facet** | `/search` already covers procedures and registry items. Add a knowledge base facet to it; each library keeps its own facets. |
| A3 | Offline at the bench or in the kitchen | **Build last, scoped** | A service worker that caches only the pages a reader saves ("Keep on this device") and the assets they need, never the whole site. It touches caching and the CSP, so it goes last and alone. |
| A4 | Large-text run view, timers that survive a sleeping phone | **Keep** | Run mode has both. |

## Addresses

Every current address keeps answering: the five protocol pages, their sheets, twins and `/v/` routes, the library and
its `.md`, `.json` and `.csv`, and `/research/lab` with its kinds. No version is assigned yet, so no frozen copy or
printed QR code exists to break, and the build keeps the routes that would serve them. New: `/recipes` and the software
how-to library (DECIDE 4), item pages for reagents and equipment, and lot and run pages under `/admin/kb` (private,
never public).

## Carrel

Carrel stops listing procedures and registry kinds (carrel job_0654e10f7100). The site side removes the two handlers
(`procedure-handler.server.ts`, `registry-handler.server.ts`) from `content-kinds.server.ts` only after the admin
editor is live, so there is never a week with no editor. The operator API's procedure and registry tools stay.

## The build, in order

Each step is one pull request, labelled `visual` where a reader sees it, and names job_898286365026.

1. **Move** `app/lib/procedures/` and `app/lib/registry/` into `app/kb/`, add `bases.mjs`. No behaviour change. (Done.)
2. **Admin Knowledge Base**: the rail entry, a panel per base, list and search, Needs info. Read-only. (Done:
   `/admin/kb`, `app/routes/admin.kb.tsx` over `app/kb/admin.mjs`; the Inventory tab waits with step 4.)
3. **Admin editor** for entries and registry items through the existing saves; then Carrel's handlers go. (Editor
   done: `/admin/kb/entry/<slug>` and `/admin/kb/item/<kind>/<id>`, `app/kb/editor.server.ts`, the whole file in
   Capsomer's markdown editor with Check, which runs every check a save runs and commits nothing, and Save, refused
   when the file moved since it was opened. The structured form for each profile's fields comes after it, and
   Carrel's two handlers go in their own pull request once this editor is live.)
3b. **Form editor** (Dustin, 2026-10-09, before step 8): the admin editor becomes a form, as protocols.io and Benchling
   edit protocols. Every field its own input (`app/kb/form-fields.mjs`: text, dropdowns for method, course and status,
   a BSL-1/BSL-2 choice, date pickers), the fields that hold `MISSING` at the top as Needs info, and the method as step
   cards in their sections, reordered by dragging or with Move up and Move down (Alt+Up and Alt+Down), each card with
   inserts for a reagent, equipment, a primer or a strain from the registry, and a timer, a temperature and an amount.
   Registry items edit as plain forms. Duplicate makes a new draft variant recording `forked_from` (P3). The file stays
   the source: the form is read from it and written back over it (`app/kb/form.mjs`), an untouched field or step byte for
   byte, through the same Check and Save; the raw file is behind Advanced (`?view=file`), which needs no script.
   After Dustin's review of the first screenshots (2026-10-10): a step's marks show as chips in its text, as protocols.io
   shows a step's components (`app/kb/step-marks.mjs` reads them with the same `markSpans` the compile tokenizes with;
   `kb-step-text.tsx` edits each in a popover and deletes it as one unit, and a chip nobody changed keeps its exact
   text). Needs info says each gap in words ("TES buffer: storage", "Step 4: rotor"), from the `where` the compile
   records beside its path (`app/kb/gap-labels.mjs`), and links to the input it is filled in at, in the editor and from
   the Knowledge Base list. A troubleshooting or calculator note, and a reagent made as a lab solution, are picked by
   name. A live preview of the public page sits beside the form on a wide screen and is a tab on a phone: the form's
   file compiled by the save's compile and drawn by the page's own component (`/admin/kb/preview/<slug>`, read only),
   in a sandboxed frame with the public page's stylesheets. The status list stays In use, In development, Retired.
4. **Inventory**: migration for `kb_lots`, `kb_locations`, `kb_audit`. The 41 registry records are already rows (their
   files are the source), so the import is of lots, which start empty; every `MISSING` field of the records is on the
   Needs info list.
5. **Roles**: waits for job_4acb6ae89b9f (DECIDE 3); not built here.
6. **Key Resources Table** (P1) and the RRID field. (Table done: `app/kb/procedures/key-resources.mjs`, on every protocol's
   page after Equipment and in its twin, computed from the record. No RRID field yet: none of the registry's four kinds
   is a resource RRIDs cover, so the field arrives with the first kind that is, such as an antibody or a plasmid.)
7. **Run records with lots** (P2), lot and run pages, the trace from a lot to its runs. Recorded by lab members, so it
   waits for job_4acb6ae89b9f too.
8. **Public libraries** for Recipes and Software how-tos, item pages for reagents and equipment (A1), the search facet (A2).
   In three pull requests, in that order. (Libraries done: `/recipes` and `/software/how-tos`, one module over
   `app/kb/libraries.mjs`, each base's catalog with its markdown twin, JSON and CSV; the protocol library keeps only
   protocols. A library with no published entry is not a page yet: a visitor gets a 404, the signed-in admin sees it
   empty, and it joins the sitemap with its first entry. Neither has intro prose: a page's words are Dustin's, so a
   `content/pages` file for each can come when he writes one.)
   (Item pages done: every reagent and item of equipment has a page at `/research/lab/<kind>/<id>`, with its twin, search
   record and sitemap entry, listing the protocols that use it; the kind tables and each protocol's Reagents and Equipment
   tables, page and twin, link to them. Ingredients and software become items with the first recipe and how-to.)
   (Search facet done: `/search` counts its hits by knowledge base, read from each record's address
   (`app/kb/search-bases.mjs`: each base's entry root, and `/research/lab/` for the registry), and `?base=` or a typed
   `base:` narrows to one; its JSON carries the same facet. Each library keeps its own facets.)
9. **Recipe views**: both-way ingredients (R2), units (R3), mise-en-place (R5), cook view (R4).
10. **How-to format**: type, objectives, platform tabs, challenges (S1, S2, S4, S5).
11. **JSON-LD**: LabProtocol 0.9-DRAFT and fork lineage (P3, P4).
12. **Offline** (A3).

## DECIDE

Answered by Dustin on 2026-10-09: 1, 2, 4, 5, 6, 7 and 8 as recommended; 3 is not approved and waits for
job_4acb6ae89b9f (see Roles).

1. Entries and item facts stay files with D1 as the served copy; lots, locations, runs, members and the audit start in
   D1. Recommend: yes.
2. Knowledge bases are a list in code, not a D1 table. Recommend: code.
3. Students and staff sign in through Access to the same `/admin`, with a role table limiting them to the Knowledge Base;
   only Dustin publishes. Recommend: yes, roles staff and student.
4. The software how-to library and its entries live at `/software/how-tos` (with `/research/methods/<slug>` kept as the
   entry root, since no entry exists there yet the root could move too). Recommend: `/software/how-tos` for both, and
   drop the unused `/research/methods` route.
5. Run records are private to lab members and never published, including as JSON-LD. Recommend: yes.
6. Move the existing procedure and registry code into `app/kb/` first, as one mechanical pull request. Recommend: yes.
7. Volume to weight in recipes only where the recipe states a density. Recommend: yes.
8. Skip voice control and multi-recipe shopping lists. Recommend: skip.

## Sources

Checked 2026-10-09. Most primary hosts could not be reached from the build container, so where a site keeps its source
on GitHub that was read instead, and the others rest on search results and are marked.

| Claim | Status | Source |
| --- | --- | --- |
| LabProtocol 0.9-DRAFT is current, with `labEquipment` and a protocol-level `parameter` | Read | BioSchemas/specifications PR 719 (merged 2026-03-18) and `LabProtocol/jsonld/LabProtocol_v0.9-DRAFT.json` |
| LabProcess 0.1-DRAFT, an execution of a protocol | Read | `LabProcess/jsonld/LabProcess_v0.1-DRAFT.json`, same repository |
| Recipe still a rich result; HowTo gone from 13 September 2023 | Search results only | developers.google.com recipe guide; Search Central blog 2023-08 (updated 2023-09-14), 2025-06 and 2025-11 |
| Recipe `recipeIngredient`, `recipeInstructions`; `supply` on HowToDirection, not HowToStep | Read | schemaorg/schemaorg `data/schema.ttl` (release 30.1) |
| Key Resources Table columns; the strains heading | Search results only; group list to confirm | published tables on PMC; cell.com STAR Methods guide not reached |
| RRID types; no RRID for mc²155 found | Search results only | scicrunch.org and rrid.site not reached |
| protocols.io runs and forks | Search results only | protocols.io help pages not reached |
| Diátaxis: four forms; a how-to links to explanation | Read | evildmp/diataxis-documentation-framework `how-to-guides.rst` |
| Carpentries episode: questions, objectives, timing, key points, challenge with solution | Read | carpentries/sandpaper-docs `episodes/episodes.Rmd` |
| Screen Wake Lock support | Read | mdn/browser-compat-data `api/WakeLock.json` |
