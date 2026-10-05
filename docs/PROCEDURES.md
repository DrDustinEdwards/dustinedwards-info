# Procedures: protocols, recipes and computational procedures

One format and one set of components for every procedure on the site (job_86709d790a73). A procedure is
a file in `content/procedures/`, the source with its history. `npm run sync:content` and the operator
API's `save_procedure` write it into the D1 `procedures` table, and its pages are drawn from that row at
request time, so a content edit goes live without a build or deploy. Only a change to the components or
to this format goes through a build.

## The file

`content/procedures/<slug>.md`: a YAML front-matter header, then markdown with Cooklang-style marks.

```markdown
---
profile: protocol                 # protocol | recipe | computational
path: /research/protocols/phage-dna-extraction
title: Phage DNA Extraction Protocol
seo_title: "Phage DNA Extraction Protocol: column-free ZnCl2/TES method"
description: One sentence, at most 155 characters.
draft: false                      # true: never public; a signed-in admin sees it
version: "MISSING: No version has been assigned."
updated: 2026-09-30
based_on:
  - citation: "Santos MA (1991), Nucleic Acids Research 19:5442"
    doi: 10.1093/nar/19.19.5442
    for: the zinc chloride method
materials:
  - name: zinc chloride
    display: ZnCl2
    stock: [2 M]
    final: 40 mM
equipment:
  - name: microcentrifuge
references:
  - id: santos-1991
    text: "Santos MA (1991). ... [doi:10.1093/nar/19.19.5442](https://doi.org/10.1093/nar/19.19.5442)"
---

The summary: what this is, where it came from, who it is for.

## Part A: collect the phage

1. Add @zinc chloride|2 M ZnCl2{20%µl} to each tube. Incubate at 37 °C for ~{5%minutes}.
   > CRITICAL: Remove the supernatant quickly.
   > PAUSE POINT: The prep can wait overnight at 4 °C.
   > WHY: **Why zinc chloride?** Markdown, attached to this step.
   > TROUBLESHOOTING: salty-dna
```

### Marks (Cooklang, https://cooklang.org/docs/spec/)

| Mark | Means | Renders as |
| --- | --- | --- |
| `@name` or `@two words{}` | a material (reagent, ingredient, software, data) | its display name |
| `@name{20%µl}` | a material with an amount | "20 µl of name" |
| `@name|shown{20%µl}` | the alias form (cooklang-rs): `name` is the material, `shown` the words on the page | "20 µl of shown" |
| `@name{=20%µl}` | a fixed amount that scaling leaves alone | as above |
| `#name` or `#two words{}` | equipment | its name |
| `~{10%minutes}` or `~label{10%minutes}` | a timer | "10 minutes" |

A mark starts after a space or at the start of a line, so `(#references)` and an email address are never
marks. Marks inside inline code or a link target are left alone.

Temperatures (`37 °C`, `55 to 60 °C`) and spins (`10,000 rpm`, `12,000 x g`) are read from the step's text,
not marked, so the sentence stays the one a person wrote.

### Steps, sections and flags

- Every `## Heading` starts a section. A section with a numbered list is a method section; its list items
  are steps. Prose before or after the list stays with the section. A section with no list is prose.
- Step numbers are the ones written. A list continues the numbering of the one before it or restarts at 1
  (a separate method, such as a rescue).
- A step's flags are `>` lines indented under it: `CRITICAL:` (with the reason), `PAUSE POINT:`,
  `WHY:` (a "why this" note), `TROUBLESHOOTING:` (a row id in the troubleshooting table), `EXPECT:` (the
  expected result of the step), `CALC:` (protocol only: the calculators to fold under the step, by id from
  `TOOLS` in `app/lib/phage-tools.mjs`, such as `> CALC: dilution, titer`). In the computational profile a fenced code block under a step is the
  command to copy, and a fenced block with the info string `output` right after it is its expected
  output.

### A value nobody has yet

Written `"MISSING: <why it is missing>"`, in place, never filled with a guess. The check and the save tool
accept a recorded gap and print it; a bare `MISSING`, or a required field left out, fails. The page omits
a missing value rather than printing it.

## Front matter by profile

Every profile: `profile`, `path`, `title`, `seo_title`, `description`, `version`, `updated`, `based_on`,
`materials`, `references`, `expected_results`, `limitations`, `method`; optional `draft`, `equipment`,
`troubleshooting`, `time` (`total`, `hands_on`), `first_used`, `organism`, `target`, `course`, `start_here`, `proof_of_use`.

What the protocol library filters and lists by (`app/lib/procedures/taxonomy.mjs`):

- `method` (required): a list of ids from the closed list: `pcr`, `plating`, `culture`, `extraction`,
  `sequencing`, `annotation`, `media`, `microscopy`. A procedure that is some of two methods lists both.
- `organism`: ids from the closed list, which are the phages' host keys (`smegmatis`, `foliorum`) and `avian`.
- `course`: ids of the courses that teach it (`phage-discovery`, `virus-isolation`, `phage-bioinformatics`).
- `target`: the genes, regions or samples it works on, in words (free text, since targets are as many as the
  experiments).
- `start_here`: a position (1, 2, 3 ...) in the library's "Start here" list, stored and never inferred. The list is
  the procedures that state one, in that order, each with its own `description`; two procedures may not share a
  position (`check:protocols`), and a procedure with none is simply not on the list.
- `proof_of_use`: what shows the method works, stated and never inferred: `papers` (publication slugs of the papers that
  used it) and/or `phages` (phage keys it produced).

  ```yaml
  proof_of_use:
    papers: [10-1128-mra-01242-18]
    phages: [arlo]
  ```

  The file holds slugs only; the page and the twin read each paper's title and each phage's name from their rows
  (`app/lib/procedures/proof.server.ts`), so a corrected title reaches every protocol that names the paper. The section
  appears only when the field is filled; `check:protocols` refuses a slug with no file.

A value outside a closed list is refused with the list in the message. Adding a method, organism or course is a
change to `taxonomy.mjs`, so the filter's words are never `PCR`, `pcr` and `polymerase chain reaction` on three
pages. When the lab registry holds host strains, `organism` reads from it.

- **protocol** adds `biosafety` (`organism`, `strain`, `atcc`, or `not applicable`; the agent only, per
  protocols.md), `biosafety_level` (`BSL-1` or `BSL-2`: Dustin sets it, no agent fills or infers it, and it is
  written `MISSING: <why>` until he does; required, so a forgotten one fails. It shows among the facts at the top of
  the page and the sheet, in the twin and in the structured data only once set; the operator API's `list_procedures`
  shows `MISSING` so he can find the ones left, and `get_procedure` lists it among the gaps), `host_strain`, `status`, `last_run`, `scale` (`count` and `unit`, such as 5 tubes),
  `solutions` (sub-recipes: `id`, `name`, `components`, `storage`, `shelf_life`), `primers` (a list of `{ primer: <id> }`, each the id
  of a primer in the lab registry, docs/REGISTRY.md: the sequence is stored there once and the protocol holds none; the page, sheet
  and twin draw a Primers section from the registry's facts), `cycling`.
  A material may carry `stock` (one or more), `final`, `amount` and `per`, and `solution` (the id of its
  sub-recipe). A spin in rpm needs its `g` (or a recorded gap), and a touchdown annealing its step size.
- **recipe** adds `servings`, `cuisine`, `category`, `diet`, `prep_time`, `cook_time`, `substitutions`
  (`for`, `use`, `note`), and step photos (`![alt](/media/...)` on a step's own line). Amounts in steps
  scale with the servings.
- **computational** adds `environment` and `prerequisites`. Its materials are software (with `version`),
  data and input files. Every command has its expected output. It does not scale.

## Versions, history and citing

`version` is the version the page is at; it stays `MISSING` until one is assigned, and when set it sits in a URL, so it
is letters, digits, dots, hyphens and underscores (`2`, `1.1`). An optional `history` lists the versions newest first,
each with `version`, `date`, `summary` and, once Zenodo has minted one, `doi`:

```yaml
version: "2"
history:
  - version: "2"
    date: 2026-10-01
    summary: Added the spin speed.
    doi: 10.5281/zenodo.200
  - version: "1"
    date: 2026-09-01
    summary: First version.
```

The first entry must be the current version, so a version is written once; dates may not rise going down the list. The
page draws "Version history" from it, each version linked to its frozen copy, and, for any assigned version, "Cite this
procedure": a citation line and BibTeX, derived in `app/lib/procedures/cite.mjs`. A procedure with no version has
nothing to cite and draws neither. The DOI of a version is written once, on its history entry. A citation points at the
version's DOI once it has one, and until then at the version's frozen copy.

### Frozen copies

Every published version keeps a rendered copy at `<page>/v/<version>` (and its twin at `<page>/v/<version>.md`), so the
QR code on a printed sheet and a citation open the words they were made from (protocols.md; the 2026-10-04 ruling in
dustinedwards/decisions.md). The newest version also answers at its `/v/` address and at the plain page. The page of an
older version says which version is current and links to it, and every `/v/` page puts its canonical on the plain
page, so the copies never compete with it in search.

- **Stored once, then never changed.** The copy is the compiled record and twin the live row held, written into
  `procedure_versions` (`drizzle/0027_procedure_versions.sql`) in the same batch as the live row by `writeRow`, and by
  `sync:content` at ship (`freezeSql`, which appends a large copy in pieces under D1's statement cap and seals it last).
  Two triggers make the database refuse an UPDATE or DELETE of a sealed row. The page for a version is drawn from the
  frozen record by the shared components, so the words are frozen and the page chrome is not. This table is the one
  store here that is not derived from the file (hard rule 18).
- **A published version's words cannot change.** A file that changes the words of a version that already has a copy
  does not compile: `save_procedure` refuses it before anything is committed, `get_procedure` shows the error, and
  `sync_procedures` and `sync:content` name the file. The fix is a new `version` with a `history` entry that says what
  changed. A draft, and a procedure with no version, are never frozen.
- **Drift covers it.** A published, versioned row with no sealed copy reads as drifted, and the sync that repairs
  drift freezes the copy.

### The printed sheet

`<page>/sheet` is the method without the reasoning, compact enough to print and work from. Its head carries the version id
and the version's date, and a QR code beside them (`app/lib/procedures/qr.mjs`: an inline SVG drawn on the server, black on
white, so it needs no script). The code opens the frozen copy of that version, `<page>/v/<version>`, so a sheet printed now
still opens the words it was printed from after the page has moved on (`sheetAddress` in `cite.mjs`). A frozen version has
its own sheet at `<page>/v/<version>/sheet`, drawn from the copy, so a sheet reprinted from an old version says, and links
to, the version it is. A sheet for a procedure with no published version points at the page and says no version is assigned.

`npm run zenodo:metadata -- <slug>` prints the Zenodo deposit metadata for the current version (title, version, date,
creator and affiliation from the CV, keywords from the method words, the frozen copy and the source DOIs as related
identifiers) for `.zenodo.json` or the upload form. It leaves out the license, which is Dustin's to choose, and a DOI is
minted only for a version being cited (protocols.md), never for the collection.

## Calculators in steps

A step that needs arithmetic names the calculators it uses: `> CALC: webbed-plate`. Each is folded under the step as
a `<details>` holding the same form and the same `runTool` the `/research/tools` pages use (`StepCalculators` in
`app/components/phage-tool.tsx`), so there is no second copy of the arithmetic. Its fields start on the lab's worked
example, except a value the step itself states: `> CALC: webbed-plate volume=10` fills `volume` with 10, and the
validator refuses it unless the step's own words contain 10, and refuses a field the calculator does not have, so a
number is never filled in that the record does not back. The server draws the worked example, so the page reads
complete with script off, where the form submits to the calculator's own page; with script `app/enhance/tools.ts`
recomputes in place and, for a calculator inside a step, leaves the address bar alone. It works in run mode, which
adds its controls beside these and touches neither. The printable sheet omits the calculators, and the markdown
twin links each one. The ids are checked against `TOOLS`; the cases are `test/procedure-calc.test.mjs`.

## The library

`/research/protocols` is the protocol library (`app/routes/protocols.tsx`): the page's own introduction, then every
published protocol in Capsomer's catalog, then the page's sections. The rows are the procedure records in D1, so a
protocol saved is listed at the next request with no deploy, and no second list of protocols exists to keep.

- **Fields are declared once** in `app/lib/procedures/library.mjs` (`LIBRARY`): the search box and its weights, the
  facets (method, organism, target, course), the columns, the sort menu, the CSV and JSON and the twin's table all read
  it. A new thing to filter by is one entry there, and a new method, organism or course is one entry in `taxonomy.mjs`.
- **The key fact is computed**, never typed: the protocol's targets, else its total time (`keyFact`). A computed value
  such as a product size comes from the lab registry when it exists.
- **The state is the address**, as the catalog defines it: `?q=pcr&method=pcr&sort=-updated`. It is a GET form, so with
  script off every control works and every state is a link; `app/enhance/catalog.ts` then updates the page in place.
- **The overview above the catalog is counted, not typed** (`libraryOverview`): a count sentence, "Start here"
  (the procedures that state a `start_here` position, in order, each with its description), the phage
  workflow (`PHAGE_PIPELINE` in `taxonomy.mjs`, each stage the methods that carry it out, linked to the library
  narrowed to them, and drawn without a link while it has no protocol; each stage's `tools` are calculator ids from
  `TOOLS` in `phage-tools.mjs`, linked under it with the form's own name, and an id the registry lacks is an error),
  and tiles to browse by method, by course and by organism, one for each id of that closed list (`taxonomy.mjs`) that
  has a protocol; a course's tile also links the page that describes the course. Every tile is an address of the
  filtered library. The twin carries the same figures, calculator links and course links.
- **Tabs are links** (`libraryTabs`, Capsomer's links form): All, then each kind of work in `LIBRARY_TABS` (`taxonomy.mjs`) with its count from the
  rows. A tab is the library narrowed to its methods, so it is also what the method facet gives, and it is current when
  the address's method filter is exactly its methods. The Calculators tab is a link to `/research/tools`
  (`CALCULATORS_PATH`) with the number of calculator pages in the registry (`calculatorCount`); calculators are not rows
  of this catalog, so it is never the current tab here. The lab registry's kinds (docs/REGISTRY.md) follow it: a tab for each
  kind with a published item (`registryTabs`), such as Primers, linking to the kind's page under `/research/lab` and counted
  from the registry, and never the current tab here either.
- **Machines get the same rows**: `/research/protocols.md` (the introduction and a table of every protocol),
  `.json` and `.csv` (every fact, ids with their words, for the filter state in the query string), and a
  `CollectionPage` with an `ItemList` in the page.
- **Download and cite is generated** (`LibraryCite`, `libraryCitation`, `libraryDownloads`, `citeMarkdown`): the CSV and
  JSON links carry the filter state of the view shown, the citation is built from the site's identity and the library's
  address (the date of access is the reader's to add), and the twin ends with the same section. The page's own markdown
  holds none of it, so no address or name is typed twice.
- **Capsomer's colours are the site's**: `app/styles/library.css` maps each of its colour names onto a site token, so the
  library follows the light and dark themes with no second palette. The site's reset is imported into Capsomer's
  lowest layer (`cap.reset`, in `app.css`), because an unlayered reset would beat every layered component rule.

## A protocol in the phage workflow

A protocol's page says where it sits in the phage workflow (`workflowContext`, `ProtocolWorkflow`): its stage (the first
`PHAGE_PIPELINE` stage whose methods it carries out), the protocols of the nearest earlier and later stage that has any
("Before this", "After this"), and the calculators of its stage. None of it is stored on the protocol: it is read from the
other published protocols and the stages, so a protocol saved changes its neighbours' links with no edit to them. A
protocol outside the workflow (a primer set) shows nothing. The markdown twin ends with the same lines
(`workflowMarkdown`), added when the twin is served because the neighbours are other rows. A protocol's primers are
linked to their registry pages from its Primers section; reagents and strains will be as their kinds land.

## Run mode

Every procedure page offers "Run this procedure". The page is complete as served; run mode is an enhancement
(`app/enhance/run.ts`, styled by `app/styles/run.css`) that puts a checklist over the steps the page already has,
for a person working it at the bench, on a phone:

- **Each step** gets a Done check, a note, and a button for every timer the step states (`~{5%minutes}`). A
  timer's length is the longer end of a range, so it never rings early; it is stored as the moment it ends, so a
  sleeping phone or a reload still knows what is left. When one finishes it vibrates, beeps, announces itself in an
  alert region and changes the tab title.
- **Critical steps** keep their flag in view and their edge in the danger colour until done; **pause points** stay
  marked. The current step is `aria-current="step"`; "Go to step N" in the bar jumps to it.
- **Scale** (a tube count, or servings) changes in place: the page is fetched at the new scale and the materials
  table and each step's words are swapped in, so the server stays the one place amounts are computed. The run's
  checks and notes are kept. If the fetch fails the browser navigates to the scaled page.
- **The screen stays on** while a run is open (the Wake Lock API), and the bar says so if the browser refuses.
- **The record**: finishing shows the run's record, which downloads as Markdown or JSON and prints (the print
  stylesheet drops the controls and keeps the checks and notes). It names the procedure, its path and its version,
  the scale, when it started and finished, and each step with its time and note.
- **It never leaves the device.** A run lives in `localStorage` under `dustinedwards.run:<path>`; nothing is sent to
  the server. If storage is unavailable the bar says "This run cannot be saved on this device" and the download is
  the only copy.

The pure half (what a run is, how timers count, the record and its Markdown, and parsing a stored run, which accepts
only the shape this module writes) is `app/lib/procedures/run.mjs`, tested in `test/run.test.mjs`; the browser
behaviour is the run-mode case of `check:browser`.

## Where it goes

| Output | From |
| --- | --- |
| The page | `app/routes/procedure.tsx`, drawn from the D1 row |
| The printable sheet | the page's `/sheet` address |
| The markdown twin | the page's `.md` address, generated from the same record |
| JSON-LD | Bioschemas LabProtocol, schema.org Recipe, or HowTo for a computational procedure |
| Search | `search_docs`, written by the sync and by `save_procedure` |
| The check | `npm run check:protocols` validates every file with the save tool's own validator |
