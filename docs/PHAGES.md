# Phages: the table on /research/phages

The phage table on `/research/phages`, the section for each phage under it, and each phage's PhagesDB link are
files in `content/phages/`, one per phage, the source with its history (job_005b85bf32fc). They were two things in
two places: a markdown table and eighty `###` sections typed into `content/pages/research-phages.md`, and a map of
PhagesDB records in code (`PHAGESDB_RECORDS` in `app/lib/phage-table.mjs`) that a gate held the table to. Now a
phage is ONE record. `npm run sync:content` and the phage save write each file into the D1 `phages` table
(migration 0025), and the page is compiled from those rows, so a phage edit goes live without a build or deploy.
Only a change to the components, the columns or this format goes through a build.

There is ONE write path: Carrel saves a phage through site-api's adapter (`phage.<slug>` in the `/content` group,
handler `app/lib/carrel/phage-handler.server.ts`). There is no admin editor and no operator save tool. The
operator can read: `list_phages` and `get_phage`, which return only what the public table already shows.
`sync_phages` converges D1 to the files.

## The file

`content/phages/<name in lower case>.md`: front matter and nothing else. The key is the name, so a file's name is
its identity and two files cannot be one phage; it is also the id of the phage's heading on the page
(`/research/phages#acorn15`) and what the old `/discovery-of-{name}` addresses redirect to.

```markdown
---
name: Acorn15
year: 2017
host: smegmatis                       # smegmatis, foliorum, or null where no host is on record
county: Hood County                   # a Texas county, "Texas" where only the state is on record, or null
phagesdb: Acorn15                     # the PhagesDB record's name as PhagesDB spells it, or null (no verified record)
paper: 10-1128-mra-01242-18           # optional: the slug of the genome announcement, a paper this site holds
formerly: Jentrie                     # optional: an earlier name
note: A manuscript is submitted.      # optional: one plain sentence, shown after the links
genome_bp: 52960                      # optional: the genome announcement's genome size, a whole number of bases
genes: 96                             # optional: the genome announcement's gene count
---
```

`name`, `year`, `host`, `county` and `phagesdb` are required, with `null` where there is none, so a missing field
is never a silent blank. The two hosts are the two the page's prose names (`HOSTS` in
`app/lib/phages/compile.mjs`); a third host is a code change, because the table's cell and the section's line
spell it. Sorting, filtering and the count line stay in code (`app/lib/phage-table.mjs`, `app/enhance/phages.ts`).

## One validator

`app/lib/phages/compile.mjs` is the only judge. `build:content`, `check:content`, `sync:content`, the gates in
`test/phages.test.mjs`, the page compile and the Carrel save all call `compilePhage`, so a file CI passes is the
file the save accepts and the page draws. It refuses:

- any field that is not one of the ten above. This is the privacy rule: the table carries what the public page
  showed and no more, so no sample, location beyond the county, or other personal data can enter the repository
  or D1;
- a name that is not letters and digits, or whose lower-case form is not the file's name;
- a year outside 2000 to 2099, a host that is not one of the two, a county that is not a Texas county or `Texas`;
- a PhagesDB record that is not in PhagesDB's name format, or that is not this phage's own (it must equal the name
  apart from case, so a same-named phage of another lab cannot be linked; `Softsoap` is PhagesDB's own
  spelling);
- a paper whose file is not in `content/publications/` (the save asks the repository, as CI does), and a note that
  is not one plain sentence with no link or markdown character;
- a body, and a wide dash.

The set is judged too: it cannot be empty, two files cannot be one phage, and two phages cannot claim one PhagesDB
record. The order is not stored: the page lists year, then name (folded, so `DaddyP` sorts before `DJDoc`), which
is exactly the order the old table was typed in.

### What the PhagesDB checks said

Verified 2026-09-29 against `https://phagesdb.org/api/phages/<name>/` (200 JSON for a record, 404 otherwise), one
request at a time. The API matches a name case-insensitively, so a 200 is only this phage's record when PhagesDB's
own spelling, institution and year agree. Dustin's ruling (#291, 2026-10-02) fixed the set at the 75 Tarleton State University phages on PhagesDB, spelled
as PhagesDB spells them, each linked to its record. PhagesDB gives a city and not a county, so a phage whose county
is not already on record (`Fambo`, `Puckett`, `Squally`) carries `county: null` until Dustin supplies one. The site never
calls PhagesDB at runtime; re-verify by hand and edit the file.

## How the page relates to the rows

The page's own file, `content/pages/research-phages.md`, keeps the prose (the introduction, the headings and the
caption) and carries two markers, each alone on its line:

```
## All phages

Sorted by year, then by name.

<!-- phages:table -->

## The phages one by one

<!-- phages:sections -->
```

The page compile (`compilePage`, `app/lib/pages/compile.mjs`) replaces each marker with the markdown the rows
draw (`phageTableMarkdown`, `phageSectionsMarkdown`) BEFORE anything reads the body. The table that was typed is
now generated, byte for byte as it was, so the HTML, the markdown twin, the headings and their ids, the Dataset
JSON-LD (its rows and its year span) and the search record all derive from one text, and none of them has a second
copy to drift. The build, `sync:content`, a page save, `sync_pages` and a phage save all go through that door; a
page that lacks a marker, has one twice, has one inline, or any other page that carries one, is refused.

`app/lib/pages/invariants.mjs` still holds the page to what code depends on, now against the rows: the first
table lists every phage in order with the six columns, a PhagesDB link for exactly the phages with a record, a
`###` heading for each phage exactly once, and no PhagesDB link that no phage owns (a link typed into the prose is
refused).

## Facts the pages state: tokens, not typed numbers

A fact the records hold is stated on a page by a token, and the page compile fills it from the rows (the build
from `content/phages`, a page save and `sync_pages` from D1), in the body and in `title`, `seo_title` and
`description`. Nothing types a count: the "80 phages" that once sat on two pages while the records held 75 is why.

| Token | Reads |
| --- | --- |
| `{{phages.count}}`, `{{phages.firstYear}}`, `{{phages.lastYear}}` | the whole set |
| `{{phages.host.smegmatis.count}}`, `.firstYear`, `.lastYear`, `.years` | one host (`years` is "2017" or "2018 to 2025") |
| `{{phage.loca.bp}}`, `.genes`, `.county`, `.year` | one phage, by file key; `bp` takes thousands separators |
| `{{phages.commonCounty(godfather,fizzles)}}` | the county they share; an error if they differ |

A token that names nothing (a misspelt key, a phage with no `genome_bp`) fails the compile, never prints blank.
Prose around the facts stays prose, and the facts about phages with no record of their own (the partner schools'
phages in the genome-paper tables) stay typed until those phages are records.

Every page that uses a token is listed in `PHAGE_FACT_PAGES` (`app/lib/phages/compile.mjs`), because a phage write
re-derives each of them, as it does the table's page. `test/phages.test.mjs` fails if that list and the pages
disagree, and fails if any page types a count of phages.

## The save

`app/lib/phages/save.server.ts`: validate (the code above) then the set (`phageSetErrors`) then policy
(`decideFileWrite`) then `commitUnlessUnchanged` then verify the committed bytes then the derived writes through
`convergeWithRetry` then a cache purge by tag.

- A byte-identical file is never committed. If D1 already holds its row the save stops; if not it repairs the
  rows from the file without a commit.
- Hard rule 18: the repository file is the source and D1 is derived. A failed derived write never reverts the
  commit; the error says the commit landed and the repair is the content sync, or `sync_phages`.
- A phage has no draft state: it is public when saved, so Carrel's unpublish is refused and says so. A phage is
  removed by deleting its file in a commit; the next sync removes its row and redraws the table.
- A save cannot add a column or a host: those are the page's structure, and code.

## What a write changes

The page is compiled from the rows, and its HTML row, twin and search records live in its own `pages` row. So one
write re-derives them in an order that keeps the drift check honest:

1. the page's own row, compiled from the page's file with the phage set as it will stand (D1's other rows and
   this phage) through the pages' compile door, then the row of each page in `PHAGE_FACT_PAGES` the same way,
   because each states counts or genome facts drawn from the same rows;
2. the phage's row, last, because its blob sha is what `phage-drift` reads as current: a failure between the two
   leaves the phage reading stale, and the repair re-runs both;
3. the purge of the `content-pages` tag (`purgePhages`, `app/lib/cache-purge.server.ts`), which the page's HTML and
   its twin both carry, and which the token pages carry too, so no other tag is purged.

`sync_phages` does the same for the set: it re-derives the page ONCE from the final set (the files that compile,
D1's row for one that does not, minus the files that are gone) before any row moves, then writes the rows, then
purges. If the page cannot be drawn the repair stops with every phage still reading drifted, so the next run
retries it. The page compile reads the rows from D1 (`listPhages`, `app/db/phages.ts`); an empty table is a fault
that names the sync, never a page with no phages.

## Where it goes

| Output | From |
| --- | --- |
| The table and the sections on the page | `phageTableMarkdown` and `phageSectionsMarkdown`, in `compilePage`, compiled into the `pages` row |
| The markdown twin | the same text, in the `pages` row's `markdown` |
| The Dataset JSON-LD | `markdownTableFacts` over that text (rows, year span), in the page's structured data |
| Search | the page's record in `search_docs`, written by the sync and by the write |
| Sort and filter | `app/lib/phage-table.mjs` and `app/enhance/phages.ts`, reading the rendered table in the browser |
| The old `/discovery-of-{name}` addresses | `app/lib/wordpress-redirects.mjs`, to the heading each file's name gives |
| The check | `phage-drift` on `/api/health`, repaired by `sync_phages` (before `sync_pages`); `test/phages.test.mjs` |

## Known limits

- A Carrel preview of a phage is not offered: the kind has no `preview` handler.
- The first deploy needs the rows in place: apply migration 0025, then `npm run sync:content -- --remote` BEFORE
  the ship, or a phage save is refused (the table is empty) until the sync. The page itself needs nothing: its
  row is written by the same sync, and an old Worker ignores the table.
