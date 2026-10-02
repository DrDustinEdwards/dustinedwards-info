# Dictionary: the entries that open the named Software pages

The entry that opens each named Software page (what the word means, how it is said, where it comes from, then
what the software is) is a file in `content/dictionary/`, the source with its history (job_06a07623695b). It was
code in `app/lib/dictionary-entries.mjs`. `npm run sync:content` and the dictionary save write each file into
the D1 `dictionary_entries` table, and the page's lead and its DefinedTerm JSON-LD are drawn from that row at
request time, so an entry edit goes live without a build or deploy. The page's markdown twin and its search
record carry the entry too, so a write re-derives them (see "What a write changes").

There is ONE write path: Carrel saves an entry through site-api's adapter (`dictionary.<key>` in the `/content`
group, handler `app/lib/carrel/dictionary-handler.server.ts`). There is no admin editor and no operator save
tool. The operator can read: `list_dictionary` and `get_dictionary`, and `sync_dictionary` repairs drift.

## The file

`content/dictionary/<key>.md`: a YAML front-matter header, then a body that is the editors' notes and is shown
nowhere. The key is the last segment of the page path (`/software/capsid` is `capsid.md`).

```markdown
---
path: /software/capsid          # a registered Software page (CONTENT_PAGE_PATHS); one entry per page
term: Capsid
syllables: "cap·sid"            # the term in lower case, with dots between syllables
ipa: "/ˈkæp.sɪd/"               # between slashes
respelling: KAP-sid             # letters and hyphens
partOfSpeech: noun
plural: [forms]                 # optional
etymology:                      # text, and [language, word] pairs for foreign words, set in italics
  - "From French "
  - [fr, capside]
  - ", from Latin "
senses:                         # exactly two: what the word means, then the software
  - "The protein shell of a virus particle."
  - "A system that stores the instructions and decisions of AI agents."
senseLabels: [null, software]   # sense 2 is the software, labelled "software." in italics
audio: /audio/capsid.mp3        # a clip that exists in public/audio/
draft: true                     # optional. true: the page shows no entry, twin and record carry none
---
Notes for editors: where each sense was verified. Nothing here is shown on the site.
```

## The audio

The pronunciation clips are static assets, `public/audio/<name>.mp3`, tracked in the repository and served by the
Worker's `ASSETS` binding at `/audio/<name>.mp3`; they are not in R2. Their addresses are unchanged. An entry
names its clip by path and a referenced clip must exist: CI reads `public/`, a save asks GitHub's directory
listing. Uploading a new clip is a code change (a file under `public/audio/`), and the entry that names it can
then be saved. A clip is under 32 KB and, in CI, starts with an MPEG audio frame.

## What a save cannot do

An entry's ADDRESS is structure. The page it opens must already be in `CONTENT_PAGE_PATHS`
(`app/lib/content-pages.mjs`) under `/software/`, and the file name must be that page's key. A save refuses
any other path, a second entry for a page, and a clip that is not there.

## What a save is held to

`app/lib/dictionary/compile.mjs` is the one door from a file to everything derived from it. `build:content`,
`sync:content` and the dictionary save all call it, so a file CI passes is the file a save accepts. It checks:

- the front matter: only the fields above; the registered path and the file name; `term`, `syllables` (the term
  in lower case once the dots go), `ipa` between slashes, `respelling`, `partOfSpeech`, `plural`, the shape of
  `etymology` and of `senses` (exactly two) and `senseLabels` (`[null, software]`), `draft`;
- the prose: no wide dash anywhere in the file, and no front matter that names the site's owner;
- the clip: the path shape, that the file exists, that it is small, and in CI that it is MPEG audio;
- what the twin and the JSON-LD say: sense 2 on its own line under the software label, and the DefinedTerm
  describing the software.

`test/dictionary.test.mjs` shows each rule firing on a real entry with one line changed. It carries the two tests
that read the entries when they were code. One pin did not survive: the old test fixed each software sense to
one exact wording, which no Carrel edit could ever change. What stays is the structure around it.

## The save

`app/lib/dictionary/save.server.ts`: validate (the code above) then policy (`decideFileWrite`, so an operator
may edit, unpublish and republish an entry but not publish a new one) then `commitUnlessUnchanged` then verify
the committed bytes then the derived writes through `convergeWithRetry` then a cache purge by tag.

- A byte-identical file is never committed. If D1 already holds its row the save stops; if not it repairs the
  rows from the file without a commit.
- Hard rule 18: the repository file is the source and D1 is derived. A failed derived write never reverts the
  commit; the error says the commit landed and the repair is the content sync, or `sync_dictionary`, which
  converges the rows from the repository.
- The sync reads the same files with the same compile, so it never overwrites a save: a save is a commit on
  `main`, and the sync builds from `main`.

## What a write changes

A page opens with its entry, and its HTML, its markdown twin and its search record all carry it. So one write
re-derives all of them, in an order that keeps the drift check honest:

1. the page's own row (its twin and its search records), compiled from the page's file with the new entry
   through the pages' compile door (`app/lib/pages/save.server.ts`);
2. the entry's row, last, because its blob sha is what `dictionary-drift` reads as current: a failure between
   the two leaves the entry reading stale, and the repair re-runs both;
3. the purge of the `content-pages` tag, which the page's HTML and its twin both carry. This is the pages tag on
   purpose: no route of its own serves an entry, and a page lead embeds it.

`app/lib/pages/save.server.ts` reads the published entry from D1 whenever it compiles a page, and
`scripts/build-content.mjs` reads it from the files, so a page save, `sync_pages` and the build all lead a twin
with the same entry. A draft entry is not read by either.

## Where it goes

| Output | From |
| --- | --- |
| The lead on the page | `app/components/dictionary-entry.tsx`, from the entry the content-page loader reads from D1 |
| The DefinedTerm | `definedTermJsonLd` in `app/lib/dictionary-entries.mjs`, in the page's structured data |
| The markdown twin's lead | `dictionaryEntryMarkdown`, in the page's twin, compiled into the `pages` row |
| Search | `dictionaryEntryText`, leading the page's record in `search_docs`, written by the sync and by the write |
| The check | `dictionary-drift` on `/api/health`, repaired by `sync_dictionary`; `test/dictionary.test.mjs` |

## Known limits

- A Carrel preview of an entry is not offered: the kind has no `preview` handler.
- The first deploy needs the rows in place: apply migration 0023, then `npm run sync:content -- --remote` BEFORE
  the ship, or the three pages carry no entry between the deploy and the sync. The old Worker ignores the table.
