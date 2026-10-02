# CV: the files in content/cv/

The CV is files in `content/cv/`, the source with its history (job_06a07623695b). `npm run sync:content` and the
CV save write each into the D1 `cv` table, and the page at `/cv`, its charts at `/cv/charts.json`, its markdown
twin at `/cv.md` and its search records are drawn from those rows at request time, so a CV edit goes live without
a build or deploy. Only a change to the components, the registry or this format goes through a build.

There is ONE write path: Carrel saves a file through site-api's adapter (`cv.<slug>` in the `/content` group,
handler `app/lib/carrel/cv-handler.server.ts`). There is no admin editor and no operator save tool. The operator
can read: `list_cv` and `get_cv`. `sync_cv` and the `cv-drift` health check keep D1 converged to the files, as the
pages' and publications' do.

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
| The PDF | still `public/dustin-edwards-cv.pdf`, rendered by hand (see below) |
| The check | `build:content` compiles every file with the save's own validator; `check:links` judges every link |

The page, the charts and the twin carry the `cv` cache tag (the HTML keeps its long-standing `pages` tag beside it),
which `purgeCv` clears.

A static file at `/cv.md` would win over the route, so `build:content` deletes any left from an earlier build.

## The PDF

The PDF is NOT drawn from D1. It is `public/dustin-edwards-cv.pdf`, committed, rendered by `npm run build:cv-pdf`
(headless Chrome through puppeteer, from the same markdown as the twin), with `build:assets` and
`build:template-refs` following it. `test/cv.test.mjs` reads the CV's fingerprint back out of the committed PDF.

So a CV save, which is a commit to `main`, leaves the PDF stale, and the fingerprint test then fails in CI until
someone re-renders it. Until the PDF follows a save on its own, a CV edit through Carrel is followed by
`npm run build:cv-pdf`, `npm run build:assets`, `npm run build:template-refs` and a commit of the three.

`renderHtml(CV)` and `renderPdf(CV)` in `scripts/build-cv-pdf.mjs` take a resolved CV, so whatever holds one can
render it. The follow-up that makes the PDF follow a save is described in the job's report: a render on each save
into one R2 object, served at the same address.

## Known limits

- The first deploy needs the rows in place: apply migration 0022, then `npm run sync:content -- --remote` BEFORE the
  ship, or `/cv`, `/cv/charts.json` and `/cv.md` fail between the deploy and the sync. The old Worker ignores the
  table.
- The CV's search records depend on every file and on the papers it cites. The CV save, `sync_cv` and a save of a
  cited paper rewrite them; a paper changed through git alone reaches them at the next sync.
- A filter that leaves nothing to chart (no entry matches, or none is a publication, grant, talk or award, as with `?type=service`) shows one sentence in place of the timeline and answers 200. Enarratio's bar chart refuses empty data ("data is empty"), so app/lib/cv/charts.ts draws the sentence and never calls it; the headline lines still draw.
