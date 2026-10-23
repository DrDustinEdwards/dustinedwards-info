# Publish pipeline

Moved from Capsid (`dustinedwards/publish-pipeline.md`) on 2026-10-13 and trimmed to what still holds. Search and Ask: `docs/SEARCH.md`. Media: `docs/MEDIA.md`.

## The model

Markdown in `content/posts/` is the source of truth. `app/lib/content/pipeline.mjs` renders it, `renderAndWrite` writes the rendered row, and D1 owns every read. Git holds markdown only: `content/generated/posts.json` is a gitignored build output.

Build order: `build:stack` (build:content reads its output), `build:content`, then `build:og` and `build:diagrams` (both read the build output), then `sync:content`.

`content/features.json` feeds the colophon twice: the page imports it directly, and `build-content.mjs` turns it into search records, so search catches up only after `build:content` and `sync:content`.

## One renderer

The pipeline module is imported by both the build scripts and the Worker, and there is never a second renderer: if the two could disagree, a save would publish HTML the next build would not reproduce. The pipeline itself is Prelum's (`@drdustinedwards/site-helpers/render`, with its `editorialPack` and `createHighlight`); `pipeline.mjs` adds the site's frontmatter, media rules and post record. The cost is Worker size, accepted: highlighting is `shiki/core` with an explicit grammar list, because full `shiki` took the Worker to 14 MB.

Anything derived that both callers need lives in one module both import: `withRelated`, `withBacklinks`, `records.mjs`, `ask-keys.mjs`, `colophon-sections.mjs`. That also lets a plain Node check import exactly what the Worker runs.

`renderAndWrite` is the only writer of a rendered row. Rows carry the source blob sha and a render hash. `check:content` renders the corpus twice and byte-compares the runs, because a nondeterministic render would make every writer disagree with every other.

Git dates stay out of the render; `sync-content.mjs` applies them at sync time. Explicit `updated` frontmatter overrides the derived date.

## The checks

What covers this pipeline: `check:content` (render determinism), `check:policy` (the first-publish policy, with forgery cases), `check:urls` (the protocol allowlist), `check:diagrams`, `check:links` and `check:destructive` (reads the operator descriptors). `check-all.mjs` derives the list from `package.json`, refuses to run below `MINIMUM_GATES` (19) and refuses an untiered gate. CI runs on every push; a merge to main deploys through `deploy.yml` once CI is green on that sha. `verify-live` is outside the `check:` namespace on purpose: it needs a deploy and its Ask probes are billed.

## The writers

All three call the same `savePost`. Gates (zod frontmatter, the wide-dash check) run server side inside it, because API commits bypass local hooks.

    caller -> gates -> GitHub commit -> renderAndWrite -> D1 -> cache purge -> Ask index

- One save is one commit through the Git Data API, carrying the markdown file only.
- D1 is written only after the commit lands; GitHub unreachable fails the save whole. There is no compensating revert: undoing the commit would destroy the source to repair a derived index.
- Pages showing the post are purged by Cache-Tag. Ask is written last and cannot fail the save.
- Conflict detection compares the head of `main` recorded at load; the ref update is never forced.

**Carrel** (`/api/carrel/v1`, `app/routes/api.carrel.v1.$.ts`) is where posts are written. Its own key reaches only that prefix, it is limited to 120 per 60 s, and each commit carries a change id joining it to Carrel's authorship record. It is a resource route inside the site Worker, so a save's cache purge reaches the cache the public pages live in.

**The operator API** (`POST /api/operator`, bearer `OPERATOR_TOKEN`) serves the admin MCP in `mcp/`, ship and the watchdog. `GET /api/operator` returns the descriptors from `app/lib/operator/descriptors.ts`, which is the tool list; do not copy it here. The token is compared in constant time after both sides are hashed to 32 bytes; absent or under 32 characters, the endpoint returns 503. Limited 30 per 60 s through the site's Durable Object limiter on an `op:<id>` instance, keyed after authentication. Commits carry `[operator:<id>]`. `savePost(env, options)` took a plain env rather than a Request, so exposing it needed no refactor: check whether a seam exists before budgeting to cut one.

**The admin editor** (`/admin/posts`, history, `/admin/media`) re-serializes frontmatter in its own key order, so a save with no edits still commits. The save outcome (saved, published-first, republished, unpublished, failed) is named by `publish-policy.mjs`, not the UI, because only the policy reads the prior file. Version history restores by putting an old file back through `savePost`: a new commit, gates run again, never a force push.

Published posts live at `/writing/<slug>`; the route modules keep their `blog.*` names. The old `/blog` feed addresses still answer with the feed; no other `/blog` address redirects (Dustin, 2026-10-20).

## The first-publish policy

Capabilities per actor are one table, `WRITE_CAPABILITIES` in `publish-policy.mjs`: the admin may do everything; an operator may write but not first-publish or delete (403 `first-publish-requires-admin`, `delete-requires-admin`); Carrel may write and first-publish but not delete; the smoke credential is read only. The first-publish rule: a first publication is Dustin's, in the admin or through Carrel.

The durable fact is `first_published` in frontmatter, not a D1 column, because D1 is rebuilt from the repo and a column would be silently dropped, failing open. The value is read only from the committed file and always overwritten on the way out; otherwise a caller could publish any draft by asserting it in its payload. `check:policy` has paired forgery tests. A backfill must be a direct commit, never a save.

## Ask on the direct-commit path

`syncAskPost` runs only on saves, and `sync:content --remote` writes D1 and the classic index only. A direct commit is covered by convergence: ship converges Ask last, the watchdog runs `sync_ask` on schedule, and `sync_ask` is on the operator API for a manual repair.

## Social cards

`build:og` renders a 1200x630 PNG per post with satori, on paper, uploaded to the `OG` bucket at `og/dustin-edwards-<slug>-<hash>.png`; the hash is FNV-1a over the card's inputs plus `OG_TEMPLATE_VERSION` (`app/lib/content/og-card-text.mjs`, now 5), so the key changes exactly when the card would and the object serves immutable. Any restyle bumps the version. Build time only, in Node: `workers-og` is 1.87 MB on an already large Worker, and resvg in a Worker needs WASM the runtime refuses to compile from bytes.

A post created or retitled through a save has no card until `build:og` and `sync:content` run. Precedence: per-post cover, then the `build:og` card, then `DEFAULT_OG_IMAGE` (`app/lib/seo.ts`, derived from `SITE_ORIGIN`). Nothing about the card enters the render.

React Router merges `links` across matched routes but a child's `meta` replaces the parent's. So icons and the manifest live in root's `links`, and each public route names the default card in its own `meta`.

## Directives

Prelum's core (`figure`, `details`) and its `editorialPack` (`chart`, `diagram`, `pullquote`, `sidenote`, `swatch`). Anything else is a build error naming the post, line, name and known list, because an unhandled directive renders as a silent empty `<div>`. A new directive is a pack, and a pack lists its names. `remarkNumericTextDirectives` turns inline "directives" starting with a digit (`12:30`, `localhost:8080`) back into text.

## Frontmatter URL fields

`rehypeUrlProtocols` walks the rendered tree and cannot see frontmatter, so two fields carry their own guard: `further_reading[].url` (URL check plus `.refine(isAllowedUrl)`) and `cover.src` (a site-absolute regex, which also catches protocol-relative `//host`, composed with `.refine(isAllowedUrl)`). The regex alone once blocked `javascript:` only as a side effect; relaxing the path rule would have reopened it with no test failing. `check:urls` therefore asserts the refinement against the parsed source, not only by behaviour.
