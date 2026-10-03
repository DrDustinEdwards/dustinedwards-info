# Structured data audit and plan

Job `job_91bd7460d4bf`. Report only: no code, content or configuration is changed by this PR, and nothing here
proceeds until Dustin approves it.

## The rule being audited against

Proposed wording, to add to the project's rules on approval:

> Every fact is stored once as structured data, and every page that shows it renders from that source. That
> covers names, numbers, dates, sequences, sizes, temperatures, citations, DOIs, people, places, IDs and links.
> Values that can be computed are computed, not typed. Prose around the facts stays prose.

Where it would live: a line under "Principles" in `CLAUDE.md`, plus a gate (see "Enforcement" below). It is not
a numbered hard rule, because no code cites a number for it yet.

## How this was made, and how far to trust it

Four read-only audits covered the whole repository in parallel (primers and worked calculations; reagents,
strains and equipment; title, products and `llms.txt`; counts, dated measurements and everything else). I then
re-checked the claims that carry weight against the files. Each finding below is marked:

- **[verified]**: I read the lines or recomputed the value myself.
- **[reported]**: from an audit agent, not re-checked. Line numbers are approximate (some came from search
  output); treat them as pointers.

Ground truth used (counted from the repository at `4639ec6a`): 75 phage files, 36 publication files,
5 procedures, 31 content pages, 15 posts (4 drafts), 26 migrations, 5 secrets in `REQUIRED_SECRETS`.

Not audited: the admin UI copy, the worker tests' fixtures, retired migration seeds (`drizzle/0001`, `0008`),
and whether D1 currently holds the same text as the repository files.

## Part 1. What to convert first

Ordered by value: first the places where copies already disagree or are wrong, then by number of copies, then by
what the conversion unlocks for the ones after it. Effort is a rough size, not a promise.

| # | Conversion | Already wrong today | Touches | Unlocks | Effort |
|---|---|---|---|---|---|
| 1 | Phage facts computed from `content/phages` | "80 phages" typed on two pages and one doc; the true count is 75 | `content/pages/research.md`, `research-bacteriophages.md`, `research-science-education.md`, `docs/PHAGES.md`, `test/phages.test.mjs` | Counts, spans and per-host numbers can never drift; genome tables render from records | Small |
| 2 | Owner title and role derived from the CV | Two different strings for one fact (`role` vs `jobTitle`); pages lead with different roles | `app/lib/seo.ts`, `app/routes/home.tsx`, `content/cv/profile.md`, `content/pages/about.md`, `research.md`, `teaching.md`, `content/llms.txt`, `app/lib/cv/entries.mjs`, two tests | A CV change updates settings, titles, About, JSON-LD and `llms.txt` | Small to medium |
| 3 | Primer database, with cycling, reaction mix and product sizes | Set labels disagree with computed coordinates (label end 8297 is past the 8,286 nt reference); each primer is typed three times | `content/procedures/rev-lpdv-primers.md`, `pan-avian-gapdh.md`, `coi-primers.md`, `test/primers.test.mjs`, `app/lib/procedures/*`, new `/research/primers` | The primers page; protocol tables that cannot drift; a gate that checks sizes against the references | Medium to large |
| 4 | Worked examples rendered from the lab calculators | The same lysate is worked at two precisions (1.1 vs 1.11 x 10^10) and gives two answers | `content/procedures/phage-isolation.md`, `content/pages/teaching-virus-isolation-faq.md`, `research-tools-*.md`, `app/lib/phage-tools.mjs` | One set of numbers on every page; calculator defaults and page examples stop duplicating | Medium |
| 5 | Shared records: host strains, reagents, equipment and rotors | The ATCC and NRRL ids are typed in 11 places; `HOSTS` in code omits them; no rotor is recorded, so no speed can be converted | procedures, teaching and research pages, `app/lib/phages/compile.mjs`, `app/lib/procedures/validate.mjs` | Strain ids and recipes in one place; computed rpm and x g; computed final concentrations | Medium (hosts small, reagents medium, equipment small) |
| 6 | One record per software product | The roster, the software page, `llms.txt` and the nav list four different sets of products; the Capsid repo URL differs between two files | `content/projects.json`, `content/pages/software*.md`, `app/lib/nav.ts`, `app/lib/footer.ts`, `app/lib/seo.ts`, `app/lib/podcast/feed.mjs`, `app/lib/colophon-sections.mjs`, `content/llms.txt`, `scripts/lib/features/projects.mjs` | Product lists, nav, footer and `llms.txt` from one place | Medium |
| 7 | `llms.txt` generated from pages, publications and products | The page lists and the 36 paper links are hand copies of data held elsewhere | `content/llms.txt`, `app/lib/llms/validate.mjs`, `docs/LLMS.md` | The validator's "lists every page" rules become true by construction and are dropped | Medium; needs 2 and 6 first |
| 8 | Nav and footer labels from page titles | The same paths carry different labels in header and footer | `app/lib/nav.ts`, `app/lib/footer.ts` | One label per page | Small |
| 9 | Citations, DOIs, accessions and guide edition registry | Three hand-kept lists of the publication set (page, CV, `llms.txt`); DOIs retyped in procedures | procedures, `content/pages/research.md`, `content/cv/*`, `content/llms.txt` | Citations render by key | Medium |
| 10 | Dated measurements in posts | Figures carry dates but not a way to reproduce them | `content/posts/*.md` | Every figure is an id with a date and a method | Medium, mostly editorial |
| 11 | Small constants | "2006" in two places; GitHub owner typed in eight; "since 2018" typed beside `first_used` | `app/lib/seo.ts`, `app/components/shell-footer.tsx`, `app/lib/colophon-sections.mjs`, `content/projects.json` | Housekeeping | Small |

Why this order. Item 1 is the cheapest change that fixes visible errors and proves the render-from-data pattern.
Item 2 is small and is the one you named most directly. Items 3 and 4 are the largest groups of copies and share
one mechanism (a record, a compile step, a directive in the procedure body), so the work for 3 carries 4 and 5.
Items 6 to 8 reuse the same compile and gate pattern. Item 7 comes late because it depends on 2 and 6.

Concurrency risk to plan around: operator saves (Carrel and the operator API) edit `content/procedures/*.md`
and commit to `main` directly. One such save renamed a heading and broke two links in the teaching FAQ; CI on
`main` has been red on that since `3c4d1e08`. Procedure migrations (items 3, 4, 5) must be done in a window
where nobody is saving those pages, or rebased over the operator commits.

## Part 2. Findings

### 2.1 Primers, cycling, reaction mixes (all protocols)

Computed with `app/lib/primers.mjs` against `test/fixtures/references/` **[verified for the REV sets by the
test in `test/primers.test.mjs`; LPDV by the same test]**:

| Set | Typed product | Computed | Reference |
|---|---|---|---|
| REV 3' LTR (CATACTGAGCCAATGGTT / AATGTTGTACCGAAGTACT) | 281 bp | 281 bp at 258-538 and 8000-8280; reverse primer has 1 mismatch (no product at 0) | DQ387450 |
| REV pol 2500-3075 | 574 bp | 574 bp at 2492-3065, both primers exact | DQ387450 |
| REV pol 4777-5575 | 801 bp | 801 bp at 4766-5566, reverse primer has 1 mismatch | DQ387450 |
| LPDV p31/CA | 458 bp | 458 bp at 1041-1498, both exact | U09568 |
| COI (LCO1490 / HCO2198) | "about 710" (paper), 708 (lab gel) | not computable | no reference in the repo |
| Pan-avian GAPDH | 534 bp (Olias 2014) | not computable | no reference in the repo |

The REV 3' LTR reverse primer's one mismatch against DQ387450 is unresolved. Per instruction it is kept as
published: the design below records it as an explicit allowance and displays it, and changes nothing about it.

Findings **[reported unless marked]**:

- **Set labels disagree with the computed coordinates [verified].** The labels "PCR REV 3' LTR 8000-8297",
  "pol 2500-3075" and "pol 4777-5575" are the paper's numbering. Computed on DQ387450 the coordinates are
  8000-8280, 2492-3065 and 4766-5566. Only the 8000 start matches, and 8297 is past the end of the 8,286 nt
  reference. The label arithmetic does not give the product sizes either (8297-8000+1 = 298, not 281). The labels
  are used as identity keys in front matter and tests. Product sizes agree with the computed values.
- **Primer sequences typed three times**: front matter `primers:` (`rev-lpdv-primers.md:52-59`), the body tables
  under each set heading in the same file, and string literals in `test/primers.test.mjs`. The test never reads the
  front matter, so editing the front matter cannot fail it. COI and GAPDH have no test.
- **Product sizes typed three or more times per set** in `rev-lpdv-primers.md`: `expected_results`, the "where the
  amplicons sit" table, and "Product: N bp." under each heading. Plus `content/pages/research-protocols.md:18-20`
  (708, 534 and the three REV labels), `pan-avian-gapdh.md` (description, `expected_results`, body) and
  `coi-primers.md` (four places).
- **Cycling typed twice per set** (front matter `cycling:` and a body table), for every set in all three files.
  The two REV pol sets have identical programs, so that program is typed four times. Stage labels such as
  "35 cycles" are typed strings next to a `cycles:` number. Prose repeats the numbers ("60 to 50 over 15 cycles"
  in `rev-lpdv-primers.md` limitations and in the pol sections; the COI touchdown in `coi-primers.md`).
- **Reaction mix typed three times** in `rev-lpdv-primers.md` and `pan-avian-gapdh.md`: front matter `materials:`
  amounts, the body table, and the step text marks (`@x{5.5%uL}`). The "25 uL reaction" total is typed and equals
  the sum of the five parts, so it is computable.
- **Citations and links typed three ways**: `based_on:`, `references:` and inline links, for the same three papers
  (Stewart 2019, Cox 2022, Allison 2014). `gapdh` cites "Cox et al. 2022" without the volume that `rev` carries.
  The site slugs (`/research/publications/10-7589-2018-08-187/`) are derived from the DOI and typed six or more
  times.
- **Accession details typed twice in one file**: "DQ387450 (REV strain APC-566, 8,286 nt)" at two places in
  `rev-lpdv-primers.md`, while the fixture (and a test) holds the true length.
- **Typed lengths only for LPDV** (`24 nt`, `21 nt`); every length is derivable from the sequence.

### 2.2 Worked calculations (protocol and teaching pages)

Recomputed with `app/lib/phage-tools.mjs` (the lab calculators' code):

- **Agree exactly with the calculators**: titer 111 plaques, 10 ul, 10^-6 = 1.11 x 10^10; the spot titer example;
  the five titer table rows; the 4-tube dilution plan; the lysate-volume example; MOI 0.4 and 33%; EOP 0.02; the
  flood-yield and plates-needed examples. **[reported]**
- **Same lysate at two precisions [verified].** `content/procedures/phage-isolation.md:253` and `:305` give the
  titer of 111 plaques at 10^-6 as `1.1 x 10^10`; the FAQ at `content/pages/teaching-virus-isolation-faq.md:24`
  and the calculator pages give `1.11 x 10^10`. The FAQ's worked example at `:66` and `:68` starts from `1.1 x
  10^10` and gets `1.01 x 10^-3 ul` per plate, while `research-tools-webbed-plate.md:23` starts from `1.11 x
  10^10` and gets `1 x 10^-3 ul`. One lysate, two answers.
- **The same results are typed several times**: the titer table in the FAQ (`:32-36`) and in
  `phage-isolation.md` (`:247-255`); the 4-tube dilution plan in `research-tools-dilution.md` and
  `research-tools-webbed-plate.md`; the bracketing examples (pfu per plate from a given titer) in about four
  places each.
- **Calculator defaults duplicate page examples.** `app/lib/phage-tools.mjs` (the `TOOLS` entries, about
  `:669-770`) hold the same inputs the pages work through (111/10/6, 1.11e10, 11100, 2e8, 1e10 and so on).
  `resultView` already generates the same steps the pages type.
- **Lab constants typed in many places.** `LAB` in `phage-tools.mjs:50-70` (10 ul plated, 8 ml flood, 5 to 7 ml
  yield, 6 plates, 25 ul maximum lysate, 250 ul host) is retyped in about 15 prose locations across
  `research-tools-*.md`, the FAQ and `phage-isolation.md`. `maxLysateUl` is 10 percent of the host volume and is
  typed.
- **Not computable by current code.** The notebook scheme "1 ul into 999 ul, then 7 ul into 63 ul" (FAQ `:70`,
  `:84`; `research-tools-dilution.md:29`; `phage-isolation.md:305`) is arithmetically right but
  `planDilution` always carries 10 ul into 90 ul, so it cannot produce it. Adding a fewer-tubes mode would make
  the example computed.
- **Observations are not computable and should be stored once.** The notebook outcomes (the 2.2 x 10^11 pooled
  titer; yields of 27, 40 and 50 ml from 4, 7 and 8 plates; and similar) belong in records with an id, date,
  plates, volume and titer, cited by id.
- **Illustrative wrong values are not defects.** `phage-isolation.md:260` lists deliberate errors ("not 4.2 x
  10^-8") to teach the exponent sign. They should stay prose.
- **Not verified**: the "40 mM final" for zinc chloride (`phage-dna-extraction.md`). 20 ul of 2 M in 1,020 ul is
  about 39 mM, so "40 mM" is the cited figure (Santos 1991) rounded, not computed. This needs a decision on
  whether the page shows the cited or the computed value.

### 2.3 Reagents and buffers

No reagent has a shared record. The `solutions:` mechanism exists (`app/lib/procedures/validate.mjs`,
`render.mjs`) but only TES uses it, and a material's `solution:` is only a link to that block. **[reported]**

- **TES** (0.1 M Tris-HCl pH 8, 0.1 M EDTA, 0.5% SDS): typed as prose in the material note, as the `solutions:`
  block (the only structured copy), and in the step text; blurbs in `content/pages/research.md` and
  `research-protocols.md` and in `docs/PROCEDURES.md` repeat "ZnCl2/TES". Storage and shelf life are recorded as
  MISSING, which is honest.
- **Phage buffer**: never defined (no recipe anywhere) but its volumes are typed twelve or more times in
  `phage-isolation.md`, the three calculator pages, the FAQ and `phage-tools.mjs`. A plaque pick is written as
  90 or 100 ul, while `phage-isolation.md:225` warns that 10 ul into 100 ul is 11-fold **[verified]**.
- **PYCa**: typed amounts but no recipe or vendor; `phage-isolation.md` also mentions "Enrichment Broth" and
  "10X media" without defining them or relating them to PYCa.
- **Nuclease mix, zinc chloride, proteinase K, potassium acetate, isopropanol, ethanol, sodium acetate, glycogen**:
  each typed in the materials list and again in the steps of `phage-dna-extraction.md`. Worked sums (the Qubit
  working mix 597+3, 995+5, 796+4; the sodium acetate and ethanol volumes) are correct but typed. Proteinase K
  volumes per stock are computable from the final concentration and are typed twice.
- **Gels, ladder, master mix**: "1% agarose gel in TBE" and "2% agarose gel in TBE" typed in each protocol; the NEB
  ladder URL typed three times; the One*Taq* master mix URL four times.
- **Conflict in form**: one wash is "10,000 to 15,000 x g" while the neighbouring steps say "top speed".

### 2.4 Host strains

- **ATCC 700084 typed in six places and NRRL B-24224 in five**, across `phage-isolation.md`,
  `content/pages/research-bacteriophages.md`, `research-phages.md`, `teaching-phage-discovery.md` and
  `teaching-virus-isolation.md`. **[reported]**
- **Several spellings**: "mc2 155", "mc2155" and "mc 2 155" in publication texts (source text, to be quoted
  verbatim); `NRRL-24224` without the B three times in `content/publications/10-1128-mra-00783-22.md`
  **[verified]**, also source text.
- **The code omits the id.** `HOSTS` in `app/lib/phages/compile.mjs` names the two hosts without ATCC or NRRL, so
  the phage table's host cell can never carry the id. The `biosafety` schema already allows `organism`, `strain`
  and `atcc` (`validate.mjs`, `render.mjs`), but `phage-isolation.md` types both strains inside a MISSING string
  instead.
- **Host-era facts** ("2017 used smegmatis, 2018 on foliorum") restated in prose on four pages and in the host
  table in `phage-isolation.md`.

### 2.5 Equipment, rotors and speed conversions

- No equipment record exists. Items are typed as strings (`phage-dna-extraction.md` equipment list;
  `phage-isolation.md` incubators, bath, filter units, pipettors), with no models, no rotors, no thermocycler, and
  no vendors for the Qubit or NanoDrop. Temperatures (29, 37, 55 C) are repeated through `phage-isolation.md`.
  **[reported]**
- **Speeds are typed in mixed units with no rotor.** `phage-isolation.md:162-166` says 2,000 rpm for the 15 ml
  tubes and for a microcentrifuge spin; `:183` tabulates "Guide: 2,000 x g, 10 minutes | this lab: 3,110 rpm";
  `:191` uses 9,607 rpm **[verified: the lines read this way]**. At a swing-bucket radius of about 18.5 cm, 3,110
  rpm is 2,000 x g, which makes the 2,000 rpm lines about 830 x g, and 9,607 rpm cannot be that rotor. Whether
  these are inconsistent or simply different rotors cannot be decided without a rotor record. **[inference from
  the agent's arithmetic; RCF = 1.118e-5 x r(cm) x rpm^2]**
- `phage-dna-extraction.md` has 10,000 rpm and 12,000 rpm spins with their SPIN flags recorded as MISSING (rotor
  unknown). The validator requires "x g" for step flags, but speeds in tables and prose get no check.

### 2.6 Owner title and role

- **CV truth** (`content/cv/appointments.md`): Professor (2025 to present) and Department Head (2025 to present).
  `content/cv/profile.md:7` has a second typed copy ("Professor and Virologist") and is the only home of
  "Virologist", which is a discipline and not an appointment. **[reported]**
- **Typed copies**: `app/lib/seo.ts` (`role`, `jobTitle`, `affiliation`, `department`, `eyebrow`, `tagline`,
  `description`, and the Person node's `honorificSuffix` and `worksFor.url`); `app/routes/home.tsx` (title
  template); `app/lib/cv/entries.mjs` (CV title and description); `content/pages/about.md` (meta and body);
  `content/pages/research.md` and `teaching.md`; `content/llms.txt:3`; `test/site-identity.test.mjs` and
  `test/worker/about.test.ts` assert the literals.
- **Disagreements that exist now**: `seo.ts` has `role` "Professor and Virologist" and `jobTitle` "Virologist,
  Professor, and Department Head" (deliberate per a comment, but two strings for one fact; the JSON-LD says
  Department Head, the visible line and title do not). About, research and teaching lead with the headship and
  omit Professor and Virologist. The CV's `org` adds "Texas A&M University System" while `SITE.affiliation` does
  not. The home title template retypes the role instead of using `SITE.role` **[verified: I edited it today]**.

### 2.7 Software products and URLs

- **Four different sets** of products: the roster `content/projects.json` (dustinedwards-info, capsid,
  dustinedwards-mcp, foxhound, foxing, germomics), the software page (eight), `llms.txt` (seven plus TXASM) and the
  nav (three). Foxing Edu, Enarratio, Carrel, Capsomer and TXASM are not in the roster. **[reported]**
- **Capsomer** appears only as exported constants in `app/lib/colophon-sections.mjs` (`CAPSOMER_NAME`,
  `CAPSOMER_URL`, `CAPSOMER_SENTENCE`), the colophon route and `CUTOVER.md`. It is in no product list, nav, footer,
  page or `llms.txt`.
- **Capsid repo URL differs [verified]**: `content/pages/software-capsid.md:7` says `.../capsid-mcp` while
  `app/lib/colophon-sections.mjs:175` says `.../capsid`.
- **Descriptions typed four times per product** (roster, page front matter, software page bullet, `llms.txt`
  note), each worded differently.
- **Germomics URL typed twice** (`app/lib/seo.ts` with a trailing slash, `app/lib/podcast/feed.mjs`) and a third
  time without it in the roster. Gates in `scripts/lib/features/projects.mjs` and
  `test/worker/structured-data.test.ts` hard-code the same literals.

### 2.8 llms.txt

`content/llms.txt` (about 265 lines) is hand-written and held to the data only by the validator in
`app/lib/llms/validate.mjs` (`docs/LLMS.md`). **[reported]**

- **Duplicates data held elsewhere**: the summary (equals `SITE.description`); about 30 page links whose titles and
  notes repeat page front matter; the software list with typed URLs; the About group (not checked against any
  list); the contact URL (equals `SITE_ORIGIN`, checked); every absolute origin prefix (about 100); the 36 paper
  links (title, year and slug from the publications records); the search endpoint id (from config).
- **Genuine prose to keep hand-written**: the route patterns, the markdown-twin explanation, the colophon and
  "how it looks" text, the publications explanation, the search and MCP text.
- **Shape of a generated version**: a prose template in git with markers for generated lists; the lists, origin
  and links assembled from the pages, procedures, publications, products and config. The validator then drops its
  both-ways page rules, the paper-twin rule, the contact rule and the absolute-link rule on generated lines, and
  keeps the size, LF, H1, blockquote, wide-dash and required-mentions rules plus a check that the generated file
  equals the committed one.

### 2.9 Counts written in prose

- **Wrong [verified]**: "all 80 bacteriophages" at `content/pages/research.md:20`; "80 phages ... 19 on M.
  smegmatis ... 2 that have no host" at `content/pages/research-bacteriophages.md:19`; `docs/PHAGES.md:100` quotes an
  intro that says 80 while `docs/PHAGES.md:66` says the set was fixed at 75. The data has 75 phages, 16 smegmatis
  and 59 foliorum, none without a host. `research-phages.md:10` has 75, correct but typed. `test/phages.test.mjs`
  guards only that one intro, which is how the other two drifted.
- **Correct but typed [reported]**: "five secrets" in `content/posts/ten-years-on-cloudflare.md:181`; "the five
  tools" (not checked against the registry) in `mcp-server-on-workers-with-oauth.md:70`; the publication set held as
  three hand lists (36 bullets in `research.md`, 33 DOI entries in `content/cv/publications.md`, 36 in
  `content/llms.txt`; the CV may exclude the conference abstracts on purpose, which needs confirming);
  "2006" typed in the footer and in `COLOPHON_VERSIONS`.
- **No typed counts found** for migrations, bindings, gates, products or participants in the README, `CLAUDE.md`,
  docs, `features.json` or app copy.

### 2.10 Dated measurements in posts

Every measured figure below carries a date or "as of" in the text, but none is reproducible from a script or data
file in the repository (the chart CSVs are inline in the posts). **[reported]**

- `blog-reading-without-javascript.md`: 1.59 kB gzipped (2026-07-30), re-measured 1.67 kB (2026-08-26); the 1.87 MB
  Worker figure is undated.
- `posts-in-git-served-from-d1.md`: bundle sizes 14 MB, 3.55 MB, 1.49 MB; "648 KB for twelve posts at 283 to
  528 ms" undated.
- `ten-years-on-cloudflare.md`: upload 8.4 MiB measured 2026-09-08; the "as of September 2026" date is typed five
  times; it also holds 3.78 MB from an earlier date, which differs in kind from the 3.55 MB in the posts post.
- `observable-plot-inside-a-worker.md`: 254 / 412 / 634 KiB, with wrangler version; the probe is not in the repo.
- `ai-answer-mode-on-site-search.md` and `charts-on-workers-fixture.md`: the same rate-limit run data (1, 2, 9, 0 of
  12) typed in both; time-to-first-token ranges undated.
- `site-search-on-d1.md`: median 6 ms, p95 15 ms over 25 runs (undated); the chart's weights are a formula typed by
  hand and are computable.
- Nine posts carry an "Update, <month> 2026" heading whose month is typed and derivable from the changelog
  front matter.

### 2.11 Other duplicated facts

- **Per-phage genome facts typed in three pages** against the phage and publication records: Loca 17,475 bp and
  25 genes; Joy99 59,837 bp and 97 genes; Godfather, Fizzles, IndyLu, Finny, Ryadel and Arlo sizes; Tripl3t and
  Zeuska as "about 53,600 bp each" in one page and as 53,565 and 53,598 in another. Pages:
  `content/pages/research.md`, `research-bacteriophages.md`, `research-science-education.md`. **[reported]**
- **Phage to paper links**: `content/phages/<name>.md` holds `paper: <slug>`, while the three pages above hand-type
  about 30 links to the same papers. The slug is the DOI folded to hyphens, so it is computable.
- **Citations in procedures**: `phage-dna-extraction.md` types its citation strings and DOIs; where the work is in
  `content/publications` it should reference by id.
- **GitHub owner** typed in eight places (`app/lib/editor/github.server.ts`, `app/lib/colophon-sections.mjs`,
  `content/projects.json`, `software-capsid.md`, `software-enarratio.md`, `content/llms.txt`,
  `app/lib/pages/invariants.mjs`) while `app/lib/seo.ts:307` is the one structured source.
- **ORCID and Scopus** are single-sourced in `app/lib/seo.ts` (good; the footer and CV PDF import them).
- **Header and footer navigation** hand-type the same paths with different labels (`app/lib/nav.ts`,
  `app/lib/footer.ts`), while each page's own title lives in `content/pages/*.md`.
- **Guide edition** ("July 2025 edition") typed in `teaching-phage-discovery.md` three times and in two procedures.
- **"Since 2018"** in `research-protocols.md` is typed beside `first_used: fall 2018` in the procedure.

## Part 3. Primer database design

### Record

One record per primer, stored once, in a file in the repository (the source). Fields:

| Field | Notes |
|---|---|
| `id` | stable slug, e.g. `rev-ltr-3-f`; never a coordinate label |
| `name` | the published name where there is one (LCO1490, HCO2198); otherwise `null`, with the display derived from set and direction. Names are never invented |
| `set` | a set id; a set has one forward and one reverse primer |
| `target` | gene or region, and organism |
| `direction` | forward or reverse |
| `sequence` | IUPAC, upper case; length is derived |
| `reference` | accession (DQ387450, U09568), or none |
| `source` | a site paper slug where it is on this site, else a citation with DOI or URL |
| `allowed_mismatches` | per set, default 0. REV 3' LTR and REV pol 4777-5575 each record 1, so the allowance is explicit and displayed |
| `paper_coords` | the published set label ("8000-8297"), kept as the paper's numbering and never presented as a position |

Derived, never typed: length, product size, start and end on the reference, mismatches and indels (from
`app/lib/primers.mjs`), and "protocols that use it" (computed from each protocol's primer list).

### Storage and compute

Recommended: source files in `content/primers/`, compiled at `build:content` into `content/generated/primers.json`
and bundled into the Worker. No migration, no D1 table, no Carrel kind. Primer changes need a deploy, which is
acceptable for data that changes rarely. Reference FASTAs move from `test/fixtures/references/` to
`content/references/` (tests read the same files), and each is pinned by SHA-256. Product sizes are computed at
build, so the Worker never runs the aligner.

Alternative: the phages pattern (files, a D1 table, a Carrel adapter, sync, drift health and operator tools),
about 15 touch points, which makes a primer edit live without a deploy. Not recommended for this data.

### Gate

A new `check:primers` (tiered, since `check-all.mjs` refuses an untiered gate) recomputes every product from its
reference and fails if the generated file is stale. It refuses: a typed product size where a reference is named,
an unknown accession, a duplicate sequence, a set without exactly one forward and one reverse, and a product that
does not exist at the set's `allowed_mismatches`. `test/primers.test.mjs` reads the records instead of retyping
sequences.

### Protocol pages

A protocol's `primers:` becomes a list of set ids. A directive in the body (for example `:::primers
set=rev-ltr-3`) renders the table and the product line from data. Product sizes in prose and `expected_results`
become tokens. The existing rule that a front-matter sequence must be printed in the body goes away, because the
table is rendered. Cycling stays per protocol, but the stage names ("35 cycles"), the touchdown ranges and totals
render from `cycles` and `temperature_c`, and identical programs (the two pol sets) share one program by id.
Reaction-mix tables render from `materials`, with the 25 uL total computed.

### Product sizes by set

REV 3' LTR 281 bp (two products, 258-538 and 8000-8280, reverse mismatch shown); REV pol 574 bp; REV pol 801 bp
(reverse mismatch shown); LPDV 458 bp. COI and GAPDH have no reference in the repository, so they are shown as
"published, not computed" with their source (Folmer 1994, about 710; Olias 2014, 534) until a reference is chosen.
The COI lab-gel 708 is a separate observation, not a duplicate, and is stored as one.

### /research/primers

Grouped by set with anchors per set. Columns: name, direction, sequence, length, target, product (computed, with
coordinates and a GenBank link), source (on-site link or citation) and protocols (links). Needs: a route, a
markdown twin, JSON-LD, a sitemap entry, an `llms.txt` entry (the validator requires every Research page to be
listed), search records, a nav link and `check:links` coverage. Because this is a new visible page it carries the
`visual` label and waits for Dustin's yes.

## Part 4. Reagents, host strains and equipment as shared records

Same pattern: one JSON file per kind in `content/data/`, a compile and validate module in `app/lib/data/`, built
into `content/generated/`, bundled, with procedures and pages referencing records by id.

- **Hosts** (do first; the schema is already half there). `id` (`smegmatis`, `foliorum`), genus, species, strain,
  collection (ATCC or NRRL), accession (700084, B-24224), a display string, a short form, the guide URL, first and
  last year used, medium and temperature. `HOSTS` in `compile.mjs`, `host_strain:`, `biosafety.atcc` and every prose
  mention read from it. Counts per host are computed from `content/phages`.
- **Reagents**. `id`, name, display, kind (stock, buffer, medium, kit, enzyme), components with final
  concentrations, stock concentrations, storage, shelf life, vendor, catalog number, URL, and a source. A
  procedure's `materials:` entry becomes `ref: tes-buffer` plus `amount` and `per`; step amounts draw from the same
  place. Final concentrations and per-batch component volumes are computed. Phage buffer and PYCa are defined
  first, since they are typed most often and defined nowhere. Gels (percent, buffer, ladder) and the ladder and
  master-mix URLs become records.
- **Equipment and rotors**. `id`, kind, make, model; for a rotor, `radius_cm` and `max_rpm`; for an incubator, its
  setpoint. A step's speed becomes `{rpm or g, rotor, minutes}`; the renderer computes RCF = 1.118e-5 x r x rpm^2 (or
  the inverse) and prints both. The validator requires a rotor for any rpm.

## Part 5. Enforcement

- A **repeated-fact gate** rather than a policy: any digit adjacent to "phages" in a page must be a token; any
  literal `NNN bp` that equals a computed product size fails; any ATCC or NRRL id outside the host record fails.
  These are narrow on purpose; a broad scan of all numbers would flag "100 bp ladder".
- A **measurement rule for posts**: every figure with a unit resolves to a record id or carries an "as of" date.
- Each new compile step follows the existing pattern: one validator shared by build, check, save and sync, so a file
  CI passes is a file the save accepts.
- Checks scale with the change (existing ruling 129): each conversion adds one gate to its tier and the matching
  `check:changed` mapping.

## Part 6. Decisions needed

1. **Storage**: build-time generated data (recommended) or the phages pattern with D1.
2. **Where "Virologist" lives** (a discipline label in `content/cv/profile.md`, since it is not an appointment) and
   whether the headship appears in the one-line role or only in the structured title.
3. **COI and GAPDH references**: add accessions and fixtures (accessions need choosing and verifying), or keep the
   published numbers as cited, uncomputed facts.
4. **Set labels**: keep "8000-8297" and similar as `paper_coords` beside the computed coordinates (recommended), or
   drop them.
5. **Zinc chloride "40 mM"**: show the cited figure or the computed 39 mM.
6. **Publication lists**: whether the CV deliberately omits the three conference abstracts (33 vs 36).
7. **Procedure edit window**: when operator saves to procedures can pause during items 3 to 5.
8. **Unrelated but blocking CI**: two links in `content/pages/teaching-virus-isolation-faq.md` point at a heading an
   operator save renamed; repoint them to `#troubleshooting-when-every-groups-plates-fail-at-once`. CI on `main`
   is red until then, and so will be this PR's.

## What approval would start

Item 1 (small, fixes visible errors), then item 2, each as its own PR with the checks that cover it. Nothing else
starts until the report is approved, and anything a visitor would see waits for Dustin's yes under hard rule 16.
