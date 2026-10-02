# Roster: the Phage Discovery Program cohorts

The roster on `/teaching/phage-discovery` and the counts on the home page are files in `content/roster/`,
one per cohort, the source with its history (job_06a07623695b). `npm run sync:content` and the roster save
write each into the D1 `roster` table (migration 0024), and the page and the home page are drawn from those
rows at request time, so a roster edit goes live without a build or deploy. Only a change to the components,
the placement or this format goes through a build.

There is ONE write path: Carrel saves a cohort through site-api's adapter (`roster.<year>` in the `/content`
group, handler `app/lib/carrel/roster-handler.server.ts`). There is no admin editor and no operator save tool.
The operator can read: `list_roster` and `get_roster`, which return only the fields the public page already
shows (the year, the photograph and the names). `sync_roster` converges D1 to the files.

## The file

`content/roster/<year>.md`: front matter and nothing else. The key is the year, so a file's name is its
identity and two files cannot be one cohort.

```markdown
---
year: 2025
photo:
  src: /phage-hunters/example-2025.webp
  width: 1080
  height: 720
  alt: Group photo of the 2025 Phage Discovery Program cohort
researchers:
  - First Last
---
```

`photo` is a mapping, or `null` for a cohort with no photograph. `researchers` is a list of plain names, kept as
given and never respelled; an empty list renders as "Roster to be added".

## One validator

`app/lib/roster/compile.mjs` is the only judge. `build:content`, `check:content`, `sync:content`, the gates in
`test/roster.test.mjs` and the Carrel save all call `compileCohort`, so a file CI passes is the file the save
accepts and the page draws. It refuses:

- any field that is not `year`, `photo` or `researchers`, and any key inside `photo` beyond `src`, `width`,
  `height` and `alt`. This is the privacy rule: the roster carries what the public page showed and no more, so
  no contact detail, location or other personal data can enter the repository or D1;
- a name that is not a plain, single-line string, one that repeats within its cohort, or one longer than 80
  characters;
- a photograph that is not a `.webp` under `/phage-hunters/`, one that is not in the repository, one with no alt
  text, or a width or height that is not a positive integer;
- a year that is not the file's name, a body, and a wide dash.

The set is judged too: it cannot be empty, and cohorts list newest first.

## Photographs

The photographs stay where they were, static assets in `public/phage-hunters/`, referenced by path. A save
checks that the path exists in the repository (through the GitHub directory listing, like a paper's PDF) and
never uploads or moves anything. Each cohort file names its photograph, so the media library reads
`content/roster` as a source of references (`SOURCE_DIRECTORIES`, `app/lib/media/template-refs.mjs`) and
`content/generated/template-refs.json` records them.

## Where it is drawn, and what a save purges

| Reader | Source | Cache tag |
| --- | --- | --- |
| The roster section of `/teaching/phage-discovery` | `listRoster` in `app/db/roster.ts`, by the content page route | `pages,content-pages` |
| The home page's researcher, cohort and since counts | the same rows, counted by `rosterFacts` | `posts` |

Both pages embed the roster, so `purgeRoster` (`app/lib/cache-purge.server.ts`) purges both tags, and
`test/worker/roster.test.ts` holds each page's tags to what a save sends. The placement is one constant,
`ROSTER_PAGE_PATH`, with `ROSTER_ANCHOR` the heading id the old profile paths land on; `test/roster.test.mjs`
holds them to the registered pages, the redirect target and the component.

An empty `roster` table is a fault and never an empty roster: both readers throw, naming the sync, rather than
render a program page with no roster on it. The first release therefore needs the migration and the content sync
before the new Worker serves those two pages.

## Repository first, D1 derived (hard rule 18)

A save validates, commits (`commitUnlessUnchanged`), checks the committed bytes against the bytes compiled, then
writes the D1 row and purges. A failed D1 write never reverts the commit: the error names the commit and the
repair. The `roster-drift` health check compares each file's blob sha with its row, the watchdog repairs through
`sync_roster`, and `sync_roster` refuses an empty file set rather than delete every row. A cohort is removed by
deleting its file in a commit; the next sync removes its row.

A cohort has no draft state: it is public when saved, so Carrel's unpublish is refused and says so.
