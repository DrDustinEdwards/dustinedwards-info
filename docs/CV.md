# CV: the files in content/cv/

The CV is files in `content/cv/`, the source with its history (job_06a07623695b). `npm run sync:content` and the
CV save write each into the D1 `cv` table, and the page at `/cv`, its charts at `/cv/charts.json`, its markdown
twin at `/cv.md` and its search records are drawn from those rows at request time, so a CV edit goes live without
a build or deploy. Only a change to the components, the registry or this format goes through a build.

There is ONE write path: Carrel saves a file through site-api's adapter (`cv.<slug>` in the `/content` group,
handler `app/lib/carrel/cv-handler.server.ts`). There is no admin editor and no operator save tool. The operator
can read: `list_cv` and `get_cv`. `sync_cv` and the `cv-drift` health check keep D1 converged to the files, as the
pages' and publications' do. `sync_cv_pdf` and the `cv-pdf-drift` check keep the PDF converged to D1.

## The files

One markdown file per section, plus the profile. The slug is the file name without `.md`, and the set is
`CV_FILES` (`app/lib/cv/parse.mjs`), in the order the CV prints them:

| File | Holds |
| --- | --- |
| `profile.md` | the edition stamp, the person, the presentation totals |
| `appointments.md` | positions, and administrative and leadership roles (`section`) |
| `education.md` | degrees |
| `publications.md` | papers: a DOI reference, or an inline citation for a paper the site holds no record of |
| `grants.md` | grants, newest first |
| `honors.md` | fellowships and awards |
| `talks.md` | invited talks Dustin leads |
| `courses.md` | courses taught |
| `mentoring.md` | counts of students mentored, by cohort, level and program |
| `service.md` | service, in sections |
| `development.md` | professional development |

A section file is YAML front matter and nothing after it. The file states its `type` once, and each entry omits it:

```markdown
---
type: grant
entries:
  - year: 2026
    amount: 3000
    title: Student Research Grant
    funder: Tarleton State University
    note: with a student researcher
    areas: []
    role: recipient
---
```

Every dated entry carries `year` (a whole year, or `null` for an undated line), optional `endYear` (a year, or
`present`), `areas` (a list, empty when no area can be defended from the entry) and `role` (or `null`). The fields
of each type are `SHAPES` in `app/lib/cv/validate.mjs`; a field the type does not have is refused, so a typo is an
error and not a silently dropped line.

A paper the site holds is named by its DOI alone, and its title, authors, venue, year, abstract and identifiers
come from the publications table at read time:

```yaml
entries:
  - doi: 10.1128/mra.00888-24
  - year: 2001          # an inline paper the site has no record for carries its whole citation
    areas: []
    role: co-author
    title: ...
    authors: [A. Author, D. Edwards]
    journal: ...
```

The profile:

```yaml
edition: Fall 2026
person: { name: Dustin Edwards, degree: Ph.D., title: ..., department: ..., org: ... }
presentations: { international: 26, national: 170, from: 2004, to: 2026 }
```

## Privacy

No student is named anywhere in these files. Mentoring is a count by cohort, year, level and program; students
appear only inside the published author lists of papers. No phone, room, email or home location, and no private
community group. The validator refuses an entry with a field it does not know (a `student` field on a mentoring
line is an error) and a value that looks like an email, a phone number or a room.

## What a save cannot do

A file's ADDRESS is structure. `CV_FILES`, the page's path and its SEO text (`CV_PAGE`, `app/lib/cv/entries.mjs`),
the section list and the filter vocabulary (`app/lib/cv/view.mjs`) stay in code. A save cannot create a file: an id
no entry in `CV_FILES` names is refused, and the refusal says so. The CV has no draft state, so it cannot be
unpublished.

## What a save is held to

`app/lib/cv/validate.mjs` and `app/lib/cv/compile.mjs` are the one door from a file to everything derived from it.
`build:content`, `sync:content`, the CV save and `sync_cv` all call them, so a file CI passes is the file a save
accepts. The rules that were tests reading `app/data/cv.ts` are these:

- the shape of each file and entry: the type, its fields, no unknown field, text with no space at either end, a
  non-empty list where a list is required;
- dates: a year from 1950 to 2100, an `endYear` not before it, `null` only for an undated line with no `endYear`;
- the vocabulary: `areas` and `role` come from the site's lists, grant amounts are dollars to the cent;
- the edition stamp is a season and a year (`Fall 2026`), and the person's name is the site's one name for him;
- the house style: no wide dash anywhere in a file;
- privacy, as above;
- paper references: each DOI exists as a PUBLISHED record, appears once, and lists Dustin among its authors;
- order: each section of the appointments, education, publications, grants, honors, talks, courses and
  development reads newest first, undated lines last. Service and mentoring keep the CV's own order within a
  section, so the rule does not reach them;
- the whole: every file is present, and the assembled CV compiles through the same pipeline every page does.

`test/cv-validate.test.mjs` shows each rule firing. A save runs every rule over D1's other files with its own in
place, so a change that breaks the whole is refused even when its own file is sound. It also compiles the page, so
a save that would make the search records fail is refused before anything is committed.

## The save

`app/lib/cv/save.server.ts`, mirroring the pages' save: validate (the code above) then policy then
`commitUnlessUnchanged` then verify the committed bytes then the D1 row and the CV's search records through
`convergeWithRetry` then a cache purge by tag (`cv`).

- A byte-identical file is never committed. If D1 already holds its row the save stops; if not it repairs the row
  from the file without a commit.
- Hard rule 18: the repository file is the source and D1 is derived. A failed D1 write never reverts the commit;
  the error says the commit landed and the repair is the content sync (`sync_cv` or `npm run sync:content`).
- A paper the CV cites cannot be unpublished, or have its DOI changed, from the publication save: that save refuses,
  naming the CV, because the CV would cite a paper no record answers for. A save of a cited paper refreshes the CV's
  search records and purges the `cv` tag, so the CV follows a corrected paper with no deploy.

## Where it goes

| Output | From |
| --- | --- |
| `/cv`, the filters, the counts | `app/routes/cv.tsx`, drawn from the rows joined to the publications (`readCv`, `app/db/cv.ts`) |
| `/cv/charts.json` | `app/routes/cv.charts[.json].ts`, the same CV; the page script reads the entries back out of the DOM, so the server and the browser never hold two copies |
| The markdown twin | `app/routes/cv[.md].ts`, `cvTwin` over the same resolved entries; no static file |
| JSON-LD | `cvJsonLd` in the route: the Person's page and a ScholarlyArticle per paper the CV cites |
| Search | `search_docs` `page:cv`, written by the sync and by the save, from the same compile |
| The social card | `build:og`, from `CV_PAGE`'s title and description |
| The PDF | `/dustin-edwards-cv.pdf`, one R2 object the Worker renders after each CV save (see below) |
| The check | `build:content` compiles every file with the save's own validator; `check:links` judges every link |

The page, the charts and the twin carry the `cv` cache tag (the HTML keeps its long-standing `pages` tag beside it),
which `purgeCv` clears.

A static file at `/cv.md` would win over the route, so `build:content` deletes any left from an earlier build.

## The PDF

The PDF follows every CV save on its own. It is DERIVED (hard rule 18): the CV rows in D1 are the source, and the
PDF is a function of them.

- **Render.** After a save has committed and written D1, the Worker renders ONCE in the background (`ctx.waitUntil`,
  so the save's answer does not wait for it) through Browser Run, `env.BROWSER.quickAction("pdf", ...)`
  (`app/lib/cv/pdf.server.ts`). The HTML is `renderCvHtml` in `app/lib/cv/pdf-html.mjs`, the same function
  `scripts/build-cv-pdf.mjs` calls, so there is one copy of the print document. The pipeline runs in the Worker; the
  three fonts are read through the `ASSETS` binding and inlined as base64, as Cloudflare documents for
  `addStyleTag`.
- **Store.** One object, one key, `derived/dustin-edwards-cv.pdf` in the OG bucket (`OG`), replaced by each render:
  `Content-Type: application/pdf` and the fingerprint of the data it was drawn from (`cvFingerprint`, eight hex
  characters of the twin's source) in custom metadata and on the PDF's last line. OG is the derived-and-regenerable
  bucket; MEDIA is the irreplaceable one, whose every put queues a backup copy. The key is under `derived/` and not
  `og/` because `build:og` prunes every `og/` key no post references.
- **Serve.** `app/routes/cv-pdf.ts` answers `/dustin-edwards-cv.pdf` from that object: `application/pdf`, inline, an
  ETag (304), byte ranges (206), HEAD, `Cache-Tag: cv` (purged on each regenerate with the page, the twin and the
  charts), and a 404 that says the PDF has not been rendered yet when the object is missing. There is no committed PDF,
  because a static file at that address would win over the route. `application/pdf` is exempt from the CSP
  (`workers/feed-types.mjs`): a PDF is shown by the browser's own viewer, and the static file carried no policy.
- **A later save is never overwritten by an earlier render.** `ensureCvPdf` reads D1's CV, renders, reads D1's CV
  again and discards the render if its fingerprint moved, then puts with `onlyIf` the object is still the one it
  read. A render that loses either compare starts over, up to three times.
- **A failed render never undoes the save.** The commit and the D1 row stand. The failure is logged as
  `{"alert":"cv-pdf-render-failed"}` and rethrown into the `waitUntil` task, the stored object is left as it was, and
  the `cv-pdf-drift` health check (the stored fingerprint against D1's CV) goes red. The watchdog repairs it through
  the operator's `sync_cv_pdf`, which renders only when the stored object is not current, then reads back.
- **What does not trigger a render.** A cited paper changed through the publication save, or a CV file changed through
  git and `sync:content`, moves the CV's text without a CV save: `cv-pdf-drift` reports it, and `sync_cv_pdf` (the
  watchdog, or the operator) renders it.
- **Ship converges it.** A deploy that changes the CV's text or the print document leaves the stored PDF stale until
  the deployed Worker renders it, so `cv-pdf-drift` is a DEFERRED readiness check (`scripts/lib/readiness.mjs`) and
  `npm run ship` calls `sync_cv_pdf` after the D1 sync and before the media converge (a first render adds a
  `derived/` key the media index must count). A render that does not converge is a miss in the ship report, not a
  refusal: the deploy stands.

Offline, `npm run build:cv-pdf [-- --out <path>]` renders the same document with headless Chrome to
`build/dustin-edwards-cv.pdf`, to look at a layout or font change without a save. It never writes under `public/`.

Browser Run is a Worker binding (`"browser": {"binding": "BROWSER"}`, `wrangler.jsonc.example`), with no token and no
dashboard opt-in. `quickAction` has no local emulation, so the Worker tests mock the binding
(`test/worker/cv-pdf.test.ts`); the real one is exercised only on a deployed Worker.

## Known limits

- The first deploy needs the rows in place: apply migration 0022, then `npm run sync:content -- --remote` BEFORE the
  ship, or `/cv`, `/cv/charts.json` and `/cv.md` fail between the deploy and the sync. The old Worker ignores the
  table.
- The CV's search records depend on every file and on the papers it cites. The CV save, `sync_cv` and a save of a
  cited paper rewrite them; a paper changed through git alone reaches them at the next sync.
- A filter that leaves nothing to chart (no entry matches, or none is a publication, grant, talk or award, as with `?type=service`) shows one sentence in place of the timeline and answers 200. Enarratio's bar chart refuses empty data ("data is empty"), so app/lib/cv/charts.ts draws the sentence and never calls it; the headline lines still draw.
