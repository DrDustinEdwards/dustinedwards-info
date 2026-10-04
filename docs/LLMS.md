# llms.txt: the first document an agent reads

`content/llms.txt` is the source, with its history. `/llms.txt` is served from a row in the existing D1
`settings` table (key `llms.txt`), falling back to a copy bundled into the Worker (`app/routes/llms.ts`). There
is no table of its own and no migration. `npm run sync:content` and the llms.txt save write the row, so an edit
goes live without a build or deploy.

There is ONE write path: Carrel saves the document through site-api's adapter (the id `document.llms` in the
`/content` group, handler `app/lib/carrel/document-handler.server.ts`, the "document" kind beside post,
publication and page). There is no admin editor and no operator save tool. The operator can read `get_llms`
and converge with `sync_llms`.

## What the kind does

A document has no draft state, so it is always published:

| Carrel call | What it does |
| --- | --- |
| list, get | the one record: title `llms.txt`, path `/llms.txt`, the file as `source`, the blob sha of the file as `version` |
| saveDraft, publish | the same save: a save to a live document edits it live. `publish` may carry a `source` |
| unpublish | refused: it is the file agents read first |
| a save with no version, or an id other than `llms` | a version conflict, or refused: a save does not create a document |
| revisions | the file's git history (`listCommitsForPath`), as the other kinds read it |
| preview | none: the kind has no preview, and the response is plain text |

## What a save is held to

`app/lib/llms/validate.mjs` is the one judgement. `check:machine-readable` (`scripts/machine-readable/llms.mjs`)
and the save both call `llmsChecks`, so a file CI passes is the file a save accepts:

- not empty, longer than 200 bytes (the retired seed was 247), at most 64 KiB, LF only, ends with a newline,
  opens with the `# dustinedwards.info` title, followed by a `> ` blockquote summary (the llmstxt.org shape,
  which PageSpeed's agent-discoverability audit reads);
- every markdown link is absolute: a page is a list item `- [Title](https://dustinedwards.info/path): note`,
  and a relative link is refused. The Contact section is a list link to `SITE_ORIGIN`. The long explanations
  and the paper twin list sit under `## Optional`, as the spec allows;
- no wide dash;
- it documents each URL pattern and header an agent acts on (`LLMS_REQUIRED_MENTIONS`: the `/llms-full.txt`
  file, the feeds, the `.md` twin patterns, `Accept: text/markdown`, the paper page and export patterns,
  `/colophon`);
- it lists every Research, Teaching and Software page, the procedures included, and lists none the site does
  not have (the paths a save reads are `CONTENT_PAGE_PATHS` and the published procedures' rows in D1);
- it lists no paper twin that no published paper produces (the save reads the publications table;
  `check:machine-readable` reads the compiled corpus, through the same `overAdvertisedTwins`);
- its Contact URL is `SITE_ORIGIN`, so the cutover turns CI red until the file follows.

`test/llms.test.mjs` shows each rule firing on the real file with one thing changed.

A page or paper twin is read as listed only from a list-item link (`- [Title](https://host/path)`); a bare
indented path no longer counts. A paper added later is NOT in the file until its line is written there: the
list is by hand, and a missing line is not a rule (only an extra one is).

## The save

`app/lib/llms/save.server.ts`: judge, then policy (`decideFileWrite`, so a read-only credential is refused),
then `commitUnlessUnchanged`, then verify the committed bytes, then the row write through `convergeWithRetry`,
read back, then a cache purge by the tag `llms` (the route carries it as its `Cache-Tag`).

- A byte-identical file is never committed. If the row already holds it the save stops; if not it rewrites the
  row from the file without a commit.
- Hard rule 18: the repository file is the source and D1 is derived. A failed row write never reverts the
  commit; the error says the commit landed and the repair is `sync_llms`.
- The edge holds `/llms.txt` for the route's `max-age=3600`, so the purge is what makes an edit visible at once.
  A browser that already holds it keeps it until its own hour is up.

## Drift

`llms-drift` (`/api/health`) compares the file's git blob sha, read from the repository directory listing,
with the blob sha of the bytes in the settings row. A missing row counts as drift, because `/llms.txt` would
then serve the bundled copy. The watchdog repairs it through `sync_llms`, the same loop the other kinds use
(`convergeKind`): re-judge the file, write the row, read it back, purge. It refuses a repository with no
`llms.txt` rather than deleting the row, and it answers 422 naming the rules a file fails without touching the
row. The ship defers the check until the D1 sync, as it does the others.

## Known limits

- `/llms.txt` has no `updatedAt` in Carrel's list: the settings row carries no timestamp, and the file's last
  change is in its revisions.
- The paper twin list is by hand. Deriving it from the publications table at request time would change the
  served bytes (the file groups it by hand), so it is not built here.
