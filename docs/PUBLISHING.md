# Publish pipeline

Moved from Capsid (`dustinedwards/publish-pipeline.md`) on 2026-10-13 and trimmed to what still holds. Search and Ask: `docs/SEARCH.md`. Media: `docs/MEDIA.md`.

## The model

The content's source is D1, as on the other sites: `source_files` holds every file a save writes (posts, pages, the CV, dictionary, phages, procedures, publications, registry, roster and `llms.txt`), keyed by its repository path, and `source_revisions` holds every version each has had (`drizzle/0032_source_files.sql`, `app/lib/source/store.server.ts`). Carrel's history is the record of who changed what. An item's version is the git blob sha of its file, as it was when the repository was the source, so a draft opened before the move still saves. `app/lib/content/pipeline.mjs` renders the source, `renderAndWrite` writes the rendered row, and D1 owns every read.

The files under those paths in the repository are the seed and CI's test corpus, not the source. `scripts/seed-sources.mjs` (run by `sync:content`) copies a file into D1, with its git history, only when D1 has never held its path, so a new page arrives with the code that registers it and an edit is made through Carrel. Static files under `public/` stay in the repository and ship with the deploy; the Worker reads them through the assets binding.

A deploy builds from D1: ship seeds, then `scripts/pull-sources.mjs --remote` writes D1's files over the checkout (and removes any file a save deleted), and puts the checkout back when it exits. The clean-tree checks accept exactly the files the pull wrote. Because a save starts no CI run, `deploy.yml` also ships main's tip every six hours, which rebuilds the header facts, the footer's pages, the sitemap dates and new posts' social cards from D1.

Build order: `build:stack` (build:content reads its output), `build:content`, then `build:og` and `build:diagrams` (both read the build output), then `sync:content`.

`content/features.json` feeds the colophon twice: the page imports it directly, and `build-content.mjs` turns it into search records, so search catches up only after `build:content` and `sync:content`.

## One renderer

The pipeline module is imported by both the build scripts and the Worker, and there is never a second renderer: if the two could disagree, a save would publish HTML the next build would not reproduce. The pipeline itself is Prelum's (`@drdustinedwards/site-helpers/render`, with its `editorialPack` and `createHighlight`); `pipeline.mjs` adds the site's frontmatter, media rules and post record. The cost is Worker size, accepted: highlighting is `shiki/core` with an explicit grammar list, because full `shiki` took the Worker to 14 MB.

Anything derived that both callers need lives in one module both import: `withRelated`, `withBacklinks`, `records.mjs`, `ask-keys.mjs`, `colophon-sections.mjs`. That also lets a plain Node check import exactly what the Worker runs.

`renderAndWrite` is the only writer of a rendered row. Rows carry the source blob sha and a render hash. `check:content` renders the corpus twice and byte-compares the runs, because a nondeterministic render would make every writer disagree with every other.

Dates stay out of the render; `sync-content.mjs` applies them at sync time, from the day D1 last changed the file (the pull records it) or, for a file not pulled, its last commit. Explicit `updated` frontmatter overrides the derived date.

## The checks

What covers this pipeline: `check:content` (render determinism), `check:policy` (the first-publish policy, with forgery cases), `check:urls` (the protocol allowlist), `check:diagrams`, `check:links` and `check:destructive` (reads the operator descriptors). `check-all.mjs` derives the list from `package.json`, refuses to run below `MINIMUM_GATES` (19) and refuses an untiered gate. CI runs on every push; a merge to main deploys through `deploy.yml` once CI is green on that sha. `verify-live` is outside the `check:` namespace on purpose: it needs a deploy and its Ask probes are billed.

## The writers

Both call the same `savePost`. Gates (zod frontmatter, the wide-dash check) run server side inside it, because a save is the only door into the source.

    caller -> gates -> source write -> renderAndWrite -> D1 rows -> cache purge -> Ask index

- One save is one D1 batch writing the file and its revision, carrying the markdown file only.
- The rows are written only after the source write lands. There is no compensating revert: undoing the source write would destroy the source to repair a derived index.
- Pages showing the post are purged by Cache-Tag. Ask is written last and cannot fail the save.
- A save names the version it loaded: the file's blob sha. A file changed since is refused, and the same check runs inside the batch, so a write that lands in between still cannot be overwritten.

**Carrel** (`/api/carrel/v1`, `app/routes/api.carrel.v1.$.ts`) is where posts are written. Its own key reaches only that prefix, it is limited to 120 per 60 s, and each revision carries a change id joining it to Carrel's authorship record and names the person (the site's owner). Its answers keep the package's own `Cache-Control: no-store`. An accepted content write purges the stored post pages after its answer (site-runtime `purgeAfterWrite`, through the Renderer's `purgePages`), and a failed purge stays on `/health` as `cache-purge` until one succeeds.

Carrel's v0.17.0 contract on posts (`app/lib/carrel`): a write sent again under its change id answers what the first did (the store, `drizzle/0037`); a trash (a draft listed only with `trashed=true`, emptied for good by the cron after 30 days), a rename (the file and its revisions move, and the old address of a post ever public answers a 301 from `post_redirects`), a publish under a date Carrel names, and preview links at `/preview/<token>`. The per-minute cron (`workers/app.ts`, site-runtime's `runJobs`) puts schedules live and, for a post scheduled before it was ever live, which goes live by its `publish_at` with no write, announces it once from `scheduled_publishes` (`drizzle/0038`), so IndexNow, the page purge (through the Renderer's `purgePages`) and the outgoing webmentions hear it.

Area 5, round 2: the post fields `excerpt`, `authors`, `series` and `seriesPart`. The pipeline reads both spellings of the two this site named first (`description` and `part`); Carrel reads a post under the package's keys and every write through Carrel stores them, so a file moves to them on its next save and no file was rewritten (a rewrite would move every post's revised date). `authors` defaults to the owner and is rendered in the hidden h-card and the JSON-LD (`drizzle/0039`). The list filters by `author`, matches `q` in the body too, sorts by `sort` and `dir` and counts a `total`; tags are set with `PUT /content/:id/tags`; a renamed post's `.md` twin redirects as its page does, and deleting a post drops the redirects to it. Webmentions are received at `/webmention` and moderated in Carrel (site-api's mentions group, `app/lib/carrel/mentions-adapter.server.ts`); a source that answers 410 removes its mention.

**The operator API** (`POST /api/operator`, bearer `OPERATOR_TOKEN`) serves the admin MCP in `mcp/`, ship and the watchdog. `GET /api/operator` returns the descriptors from `app/lib/operator/descriptors.ts`, which is the tool list; do not copy it here. The token is compared in constant time after both sides are hashed to 32 bytes; absent or under 32 characters, the endpoint returns 503. Limited 30 per 60 s through the site's Durable Object limiter on an `op:<id>` instance, keyed after authentication. Revisions carry `[operator:<id>]`. `savePost(env, options)` took a plain env rather than a Request, so exposing it needed no refactor: check whether a seam exists before budgeting to cut one.

There is no post editor in the site's admin (removed 2026-10-29: every post was being written in Carrel, and two editors meant two sets of save and publish rules). The save outcome (saved, published-first, republished, unpublished, failed) is named by `publish-policy.mjs`, because only the policy reads the prior file. The upkeep that page held is on `/admin/tools`: rebuild the answer index, re-render every post and reset the day's answer budget.

Published posts live at `/writing/<slug>`; the route modules keep their `blog.*` names. The old `/blog` feed addresses still answer with the feed; no other `/blog` address redirects (Dustin, 2026-10-20).

## The first-publish policy

Capabilities per actor are one table, `WRITE_CAPABILITIES` in `publish-policy.mjs`: the admin may do everything; an operator may write but not first-publish or delete (403 `first-publish-requires-admin`, `delete-requires-admin`); Carrel may write and first-publish but not delete; the smoke credential is read only. The first-publish rule: a first publication is Dustin's, in the admin or through Carrel.

The durable fact is `first_published` in frontmatter, not a rows column, because the rows are rebuilt from the source and a column would be silently dropped, failing open. The value is read only from the stored file and always overwritten on the way out; otherwise a caller could publish any draft by asserting it in its payload. `check:policy` has paired forgery tests.

## Ask outside a save

`syncAskPost` runs only on saves, and `sync:content --remote` writes D1 and the classic index only. A row written any other way is covered by convergence: ship converges Ask last, the watchdog runs `sync_ask` on schedule, and `sync_ask` is on the operator API for a manual repair.

## Social cards

`build:og` renders a 1200x630 PNG per post with satori, on paper, uploaded to the `OG` bucket at `og/dustin-edwards-<slug>-<hash>.png`; the hash is FNV-1a over the card's inputs plus `OG_TEMPLATE_VERSION` (`app/lib/content/og-card-text.mjs`, now 5), so the key changes exactly when the card would and the object serves immutable. Any restyle bumps the version. Build time only, in Node: `workers-og` is 1.87 MB on an already large Worker, and resvg in a Worker needs WASM the runtime refuses to compile from bytes.

A post created or retitled through a save has no card until `build:og` and `sync:content` run. Precedence: per-post cover, then the `build:og` card, then `DEFAULT_OG_IMAGE` (`app/lib/seo.ts`, derived from `SITE_ORIGIN`). Nothing about the card enters the render.

React Router merges `links` across matched routes but a child's `meta` replaces the parent's. So icons and the manifest live in root's `links`, and each public route names the default card in its own `meta`.

## Directives

Prelum's core (`figure`, `details`) and its `editorialPack` (`chart`, `diagram`, `pullquote`, `sidenote`, `swatch`). Anything else is a build error naming the post, line, name and known list, because an unhandled directive renders as a silent empty `<div>`. A new directive is a pack, and a pack lists its names. `remarkNumericTextDirectives` turns inline "directives" starting with a digit (`12:30`, `localhost:8080`) back into text.

## Frontmatter URL fields

`rehypeUrlProtocols` walks the rendered tree and cannot see frontmatter, so two fields carry their own guard: `further_reading[].url` (URL check plus `.refine(isAllowedUrl)`) and `cover.src` (a site-absolute regex, which also catches protocol-relative `//host`, composed with `.refine(isAllowedUrl)`). The regex alone once blocked `javascript:` only as a side effect; relaxing the path rule would have reopened it with no test failing. `check:urls` therefore asserts the refinement against the parsed source, not only by behavior.
