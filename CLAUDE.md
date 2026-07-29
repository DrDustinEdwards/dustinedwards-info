# CLAUDE.md - dustinedwards.info

Portfolio-wide rules live in Capsid, not here. Read `capsid/conventions.md` first, then `dustinedwards/core.md`. This file holds only what is true of this repo.

## What this is

Personal platform and Cloudflare showcase for Dustin Edwards. React Router 8 (SSR) + Vite + @cloudflare/vite-plugin, native on Cloudflare Workers. Drizzle on D1, Better Auth (Google, single admin) with sessions in KV, R2 for media. Node 24.14.1 (.nvmrc). Also the flagship site and a Capsid CMS consumer.

## Session ritual

Start: read `capsid/conventions.md`, then `dustinedwards/core.md`.
End: write a `session-YYYY-MM-DD.md` episodic (type `episodic`, under ~2KB) to the dustinedwards namespace.

## Bindings

Configured in wrangler.jsonc, read off the request context via `getEnv(context)` from `app/lib/context.ts`. Never import bindings globally.

  DB      D1 database "dustinedwards"
  APP_KV  KV namespace (Better Auth session store)
  MEDIA   R2 bucket "dustinedwards-media"

## Commands

- `npm run dev`
- `npm run build`
- `npx tsc -b` typecheck (`tsc --noEmit` is a no-op here)
- `npm run build:content` regenerate `content/generated/posts.json` from `content/posts/`
- `npm run check:content` gate; fails when the committed artifact differs from a fresh generation
- `npm run sync:content -- --local|--remote` push the artifact into D1 and rebuild the FTS index
- `npm run check:search` gate over the query parser and rank fusion (pure, no database)
- `npm run check:backup -- --local|--remote` proves the per-table export path still covers the schema
- `wrangler d1 migrations apply dustinedwards [--local|--remote]`
- `wrangler deploy` (auto-deploy is not wired; deploy is manual)

## Blog content

Markdown files in `content/posts/` are the source of truth. The generator emits
`content/generated/posts.json` (committed, gated) carrying both the source
markdown and the rendered HTML, and `sync:content` writes both into D1. D1 owns
every read. Ruling and grounds: dustinedwards/decisions.md, 2026-07-27.

Editing a post means editing the markdown, running `build:content`, committing
the artifact alongside it, then `sync:content`. Never hand-edit the artifact and
never write prose straight into a D1 row: both defeat the gate.

## Search index

Two FTS5 tables over one derived table, `search_docs`. `search_identity`
(unicode61, no stemming) carries titles and tags for exact-token lookup;
`search_prose` (porter) carries bodies for relevance. One table cannot serve
both, because an fts5 tokenizer is set per TABLE, not per column. The two ranked
lists are fused by RECIPROCAL RANK at k=60, never by raw bm25 score: scores from
two tokenizers over two average document lengths are not comparable on value.

**Records are section-grained.** One post yields a document record plus one per
heading, so a hit deep-links to the heading that answers it. Derivation lives in
`app/lib/search/records.mjs` and BOTH writers call it, exactly as both call
`withRelated`. Records ride in the gated artifact, so `check:content` covers
them. `app/lib/content/artifact.mjs` owns the artifact's shape so the build
script and the editor cannot disagree about it.

`posts_fts` and its three per-row triggers are untouched and still serve the
editor. `search_docs` has NO triggers: it is rewritten wholesale and both
indexes are then rebuilt.

Two traps, both measured on this database:
- `COUNT(*)` on either search index reads THROUGH to `search_docs` and can never
  detect drift. Count `search_identity_docsize` / `search_prose_docsize`.
  Verified: with the index emptied, `COUNT(*)` still read 7 while docsize read 0
  and `MATCH` returned nothing.
- Never `DELETE FROM` either index. The repair is `('rebuild')`.

`snippet()` splices markers into text it does not escape, so the markers are
control characters, the snippet is HTML-escaped, and only then are they swapped
for `<mark>`. Writing `<mark>` directly would render post prose as markup.

## Search surfaces

Three levels, each usable without the one above it.

1. **`/search`, server rendered.** A GET form, facet chips as links, counts from
   the same query that produced the list. Fully functional with scripting off.
2. **JSON at the same URL** via `Accept: application/json`, `Vary: Accept`.
   Same query, same index, not a second API. Negotiation runs in MIDDLEWARE,
   never the loader: a document route's loader cannot return a raw Response, it
   is handed to the component as `loaderData` and 500s on the first property
   read. Same mechanism `/blog/:slug` uses for its markdown twin.
   `app/lib/negotiate.ts` holds the one q-value parser both routes use.
3. **The command palette**, `app/enhance/palette.ts`, its own chunk, site-wide
   and separate from the blog bundle. 6.06 kB raw, 2.32 kB gzip. The blog
   bundle is unchanged at 3.96 kB raw, 1.59 kB gzip.

The header ships an `<a href="/search">`. The palette upgrades it in place; with
no script it stays a link. Built on native `<dialog>.showModal()` for a real
focus trap and focus return.

### Two query paths, not one

A query carrying filters but no text (`2026`, `tag:cloudflare`, a facet chip
clicked from an empty box) has nothing to give fts5, so `toMatchExpression`
returns null. Those go to the BROWSE path: the same filter SQL run straight over
`search_docs`, date ordered, **document records only**. Returning all seven
records of one post for `2026` would present the corpus as seven times its size,
and there is no heading a bare filter had in mind.

`hasFilters()` in `query.mjs` is the dispatch predicate and lives there, not in
`search.server.ts`, so `check:search` can assert it. The browse snippet is the
head of the body with NO `<mark>` in it: nothing was matched, so highlighting
anything would claim a match that never happened. The label is `filter`.

Found on the live deploy 2026-07-28, not by typecheck: every filter-only query
returned zero. The parser was correct the whole time. Note this also means
`isEmpty` on a parsed query means "no matchable TEXT", which is not the same
question as "did the reader ask for anything".

Three palette traps, all found in a browser and none visible to typecheck:
- `<input type="search">` has a NATIVE Escape-to-clear, so the first Escape
  never reaches the dialog. Escape is handled explicitly in the keydown handler.
- A fetch in flight when the palette closes resolves afterwards and repaints a
  closed dialog. Closing bumps a sequence number; clearing the DOM alone is not
  enough.
- Do not name a module-level variable `status`: it collides with `window.status`.

## Ask mode (Layer 2): BUILT and live, 2026-07-28

Streamed AI answer with citations that deep-link to heading anchors. It sits
strictly above classic search and is removable without touching it.

**The credential gate, recorded because it blocked two sessions.**
`wrangler ai-search create` calls `listTokens(config, accountId)` and refuses
when the account holds zero AI Search API tokens. It reads NO environment
variable, so there is nothing a session can export, and wrangler never mints one
itself: the interactive branch only loops on "Have you created a token?" while
polling the same endpoint. Read commands work on ordinary OAuth, which is why
the CLI looks authenticated right up until the first write. Mint at
`/ai/ai-search/tokens` in the dashboard.

**Data source: BUILT-IN STORAGE with uploaded markdown, not the crawler.**

1. The crawler indexes **a domain onboarded to this Cloudflare account**. The
   apex still resolves to the legacy WordPress site, so a crawl would index the
   OLD site, and `workers.dev` is not an onboarded zone.
2. **Citations must deep-link to heading anchors.** Records are section-grained;
   one uploaded file per section record keeps the anchor. A crawler indexes
   whole pages and loses it.
3. Built-in storage indexes **immediately**. External sources sync on a schedule
   (6 hours default) and pause after 31 days without a query.

Created with:

    npx wrangler ai-search create dustinedwards \
      --type builtin --hybrid-search --reranking

Confirmed by reading the instance back rather than trusting the create output:
`hybrid_search_enabled: true`, `reranking: true`,
`index_method: {vector: true, keyword: true}`, `fusion_method: "rrf"`,
`score_threshold: 0.4`, porter keyword tokenizer. AI Search fuses by reciprocal
rank and stems with porter, which is what the classic layer chose independently.

**Sync story.** `Sync Ask corpus` on `/admin/posts` uploads every section record
through the Items binding, then prunes items no longer in the corpus. Upload is
an upsert keyed by filename, so it is idempotent; the prune exists because an
upsert alone leaves a deleted post answerable forever. Content reaches the index
in seconds, not on a schedule. It is a SEPARATE button from `Regenerate all`
because D1 and the AI index must fail independently: the site's own search must
never be held hostage to the AI index.

**The key is the citation.** A chunk carries `item.key` and nothing else about
where it came from, so the key has to round-trip to a URL. `app/lib/search/
ask-keys.mjs` owns that mapping and BOTH the uploader and the client import it,
exactly as both writers import `records.mjs`. Scheme is
`blog/<slug>.md` and `blog/<slug>__<anchor>.md`. The separator is a DOUBLE
underscore because a single one occurs naturally in headings on this blog
(`posts_fts`), and the upload path fails closed if a URL contains it.

**Measured 2026-07-28, on the real 7 record corpus.**

- Time to first token, warm: 2149 ms, 3133 ms, 6489 ms. First call after idle
  was 7441 ms. Chunks arrive ~100 ms before the first token, so sources render
  before the answer starts.
- All 7 item keys round-trip to URLs whose anchors exist on the live page.
- Ask chunk 2.54 kB raw / 1.30 kB gzip, its own chunk. Blog bundle unchanged at
  3.96 kB / 1.55 kB. Palette 6.26 kB to 7.00 kB for the Ask row.

**The finding worth keeping: the two layers fail on OPPOSITE inputs.** Same
corpus, same live site:

    query                    classic   AI chunks
    verdict                        1           0
    enforcement                    1           0
    "How do enforcement hooks reach files but not rows?"
                                   0           1
    "Why are deterministic pages provable?"
                                   0           1
    "What does option A still win?"
                                   0           1

Classic found 2 things AI retrieval missed; AI found 3 things classic missed.
Single-token queries that name a heading almost verbatim can return zero chunks
under a 0.4 score threshold, while long natural-language questions return zero
rows under AND-by-default keyword matching. **Neither layer subsumes the other**,
which is the empirical case for keeping classic first and Ask on top rather than
replacing one with the other. Results also vary between runs: the instance has
`cache: true` with a `close_enough` threshold, and `backup asymmetry` returned 0
chunks on one run and 1 on another.

**Removability is verified, not asserted.** With the `ai_search` block deleted
from wrangler.jsonc and redeployed: `/search/ask` returns 404, the Ask mount is
absent from the HTML, `askAvailable` is false in the JSON, and the classic
payload is byte-identical (same 6 results, snippets, marks, anchors, facets and
scores). That property is what the cost-review ruling depends on.

**Rules this layer lives under.**
- No classic query waits on Ask. `search.server.ts` does not import
  `ask.server.ts`, and the loader only computes a boolean.
- The zero-JS path never reaches it. The trigger is rendered after mount, so a
  reader without script never sees a control that cannot work.
- The answer is written with `textContent`, never as HTML. It is generated text
  and the one thing known about it is that we did not write it.
- Ask never fires on keystroke. It is a deliberate press, because every answer
  bills Workers AI.

### The index sync story

**An editor save uploads that post's records itself.** `savePost` calls
`syncAskPost` after the D1 sync, which uploads the post's section records and
deletes any of ITS OWN keys that no longer exist. Incremental, not a full corpus
sync: section decomposition is a pure function of one post's markdown, so a save
never needs to touch another post. Lag is seconds, because built-in storage
indexes on upload.

**The AI index cannot fail a save.** It runs after the commit has landed and its
failure is logged and reported, never thrown. A post that is committed, rendered
and keyword-searchable but briefly missing from Ask is a degraded enhancement; a
save that failed at that point would leave the repo and D1 disagreeing about
whether it happened.

Because a save then redirects, a failure has nowhere to be announced, so
`/admin/posts` shows **Ask index drift** computed in both directions (records
missing from the index, items the corpus does not know about) and today's budget
use. `Sync Ask corpus` is the repair.

**No credential is needed at runtime.** The AI Search API token was required
only by `wrangler ai-search create`, a control-plane call. The Worker reaches
the instance through the binding and there is no AI Search secret in
`wrangler secret list`. Verified 2026-07-28.

### Drafts must never reach the Ask index (leak, fixed 2026-07-29)

**The AI index is a PUBLIC surface.** `/search/ask` is unauthenticated and its
citations name the post they came from, so anything uploaded is readable by
anyone who asks the right question.

The classic index filters at QUERY time. Ask cannot: AI Search has no per-item
status a query can filter on, so the exclusion has to happen at UPLOAD time.
`publishableForAsk()` in `ask.server.ts` is that gate and it must agree with
`publiclyVisible()`: no drafts, and nothing whose `publish_at` is in the future.

**It leaked.** Five unpublished drafts staged through the operator path on
2026-07-29 were uploaded unconditionally, and the live Ask endpoint answered
from one and cited it by slug. `syncAskPost` had no draft check at all.

A draft now uploads NOTHING and actively REMOVES anything the post already has,
because skipping the upload alone leaks on the unpublish path: a post published,
indexed, then withdrawn would stay answerable forever. `check:policy` covers it,
verified by planting the removal of each filter.

**`items.list()` is PAGED and every call site ignored it.** It takes `page` and
`per_page` (max 50, measured: 100 is rejected with "Too big: expected number to
be <=50") and reports `total_count`. All four call sites made a bare call and so
saw only the first page. Invisible at seven records; a correctness bug the
moment it was not. Measured: a prune reported "removed 0" for a post whose items
were real but sat on a later page, so a draft stayed answerable after the code
meant to remove it had run and reported success. `listAllAskItems()` pages to
the end and is the only listing path.

**A prune that cannot see an item cannot delete it, and reports success either
way.** That is the shape of this whole class of bug.

### Guards on /search/ask

It is the only public endpoint on the site that costs money per request. Three
gates, cheapest first, in `app/lib/search/ask-guard.server.ts`:

1. **Per-IP burst limit**, exactly 5 per 60 second window.
2. **Answer cache** in KV, keyed by a SHA-256 of the normalized question.
3. **Daily ceiling**, exactly 200 answers, site-wide.

Ordering is load-bearing: the ceiling sits AFTER the cache, so a cache hit costs
nothing and consumes no budget. A refusal is a 429 with `Retry-After` and makes
no AI call at all. Responses carry `x-ask-cache: hit|miss`, which is what makes
the cache testable from outside rather than by reading the code.

**Gates 1 and 3 are Durable Objects, and that is measured rather than
preferred.** Both cheaper mechanisms were built first and both leaked:

- The GA `ratelimit` binding refused **1, then 2, then 9, then 0** of twelve
  concurrent requests against a limit of five. Cloudflare documents it as
  "permissive, eventually consistent"; it sheds sustained load and does not
  count.
- A Durable Object using `storage.get` then `storage.put` allowed **8** through a
  ceiling of 3, because a read and a write spanning `await` inside a DO is not
  atomic.
- The **synchronous SQLite** API inside a DO allowed exactly **3 of 14**, and
  exactly **5 of 14** for the per-IP limit. This is why the class is registered
  as `new_sqlite_classes`: the whole point is that `sql.exec` has no await.

A fixed window still permits up to 2x across a boundary (measured: 10 of 12).
That is the ordinary property of a fixed window, not a leak.

Cache invalidation is **explicit on publish**, not keyed through a generation
number: a generation would cost a second KV read on every request forever to
handle an event that happens when Dustin publishes. `syncAskPost` and
`syncAskCorpus` both drop every cached answer.

**Removing the `durable_objects` block DISABLES Ask** rather than un-protecting
it, and that is deliberate: an unprotected metered endpoint must not serve. This
differs from removing `ai_search`, which removes the feature cleanly.

**Cost.** Retrieval is free in open beta; generation is Workers AI and bills per
answer today. The ceiling bounds the worst case at 200 answers a day.

### The public and MCP endpoints

Enabled in the dashboard, verified externally with no account auth 2026-07-28,
and only then written into `llms.txt`. The MCP URL is
`https://<INSTANCE_ID>.search.ai.cloudflare.com/mcp` and it exposes one tool,
`search`, returning the same section-grained keys.

It shows the same retrieval characteristic as Ask: `d1` engaged both vector and
keyword and returned 6 chunks, while "What is the backup asymmetry?" returned 0
under the 0.4 score threshold despite a section of that name. Advertised with
that caveat stated rather than hidden.

**Follow-up, not done:** the MCP tool description is still Cloudflare's default,
"Finds exactly what you're looking for". An MCP client reads that to decide when
to call the tool, so it should say what this site covers. Dashboard field,
Settings > Public Endpoint > Tool Description.

## Admin editor (second writer)

`/admin/posts` is a second writer onto the same pipeline. It never writes rows
directly. The path is:

    browser -> action -> gates -> GitHub commit -> generate -> D1

1. **Gates, server side, before anything is written.** The same zod frontmatter
   schema and a wide-dash check run inside the action. API commits bypass the
   local PreToolUse hooks entirely, so without these the style and schema rules
   would not reach anything written in the editor. A rejection names the field
   or the line.
2. **One commit per save, via the Git Data API.** A save changes both
   `content/posts/<slug>.md` and the regenerated `content/generated/posts.json`
   and they land together. The Contents API cannot do this (one file per call),
   and splitting it into two commits leaves `check:content` red in between.
3. **D1 is written only after the commit lands.** If GitHub is unreachable the
   save fails whole. There is no D1-only write and no reconcile-later queue.
4. **Conflict rule.** The editor records the head commit of `main` when it loads
   and sends it back on save. If `main` moved, the save is refused with a
   conflict and the author reloads. The editor never overwrites a change it did
   not see, and the ref update is never forced.
5. **Deleting** removes the file, its artifact entry, and its rows, in that order.

`Regenerate all` on `/admin/posts` re-syncs D1 from the committed artifact. It is
the recovery path when rows drift from what the repo says.

Requires the `GITHUB_TOKEN` wrangler secret (fine-grained, Contents read/write on
this repo). Without it the editor still renders and previews, and saving reports
that it is unavailable rather than half-working.

## Operator publish path (agents)

`POST /api/operator`, a bearer-token JSON endpoint exposing the editor's save
machinery to non-browser callers. Ruling: `dustinedwards/decisions.md`,
2026-07-28. Tools: `list_posts`, `get_post`, `save_post`, `delete_post`,
`sync_status`. `GET` on the same URL describes them, behind the same token.

**There is exactly one write path.** `app/lib/operator/api.server.ts` calls the
same `savePost` and `deletePost` in `publish.server.ts` that the browser action
calls, so an agent gets the same zod gates, the same wide-dash check, the same
single atomic Git Data commit carrying markdown plus artifact, one renderer, the
same D1 sync and the same Ask sync. Nothing in the operator layer touches
GitHub, D1 or the AI index directly.

**No refactor was needed and that is worth knowing.** `savePost(env, options)`
already took a plain env and an options object rather than a Request, so
`handleEditorAction` was already a 55-line FormData adapter over a callable
module. The browser editor is unchanged apart from one hidden input.

**Why a bearer API and not MCP.** Decided 2026-07-28. The router is not a
blocker (a JSON-RPC body with MCP headers passes through a resource route
untouched, measured). Two other reasons decided it: MCP shipped a BREAKING spec
revision stable that same day, whose compatibility matrix has legacy-client to
modern-server failing with no fall-forward and which no shipped client speaks
yet; and the recova precedent has its MCP publish tools calling an operator HTTP
API rather than a database. The API is the durable contract. MCP is a later
front end, and the `{tool, args}` request shape is chosen so `tools/call` maps
onto it with no reshaping.

### The first-publish policy

An operator may create, edit, unpublish and republish. It may NOT perform a
post's FIRST transition to `draft: false`. Refused with 403 and
`policy: first-publish-requires-admin`.

The durable fact is `first_published` in FRONTMATTER, server-owned, stamped once
by the save path the first time a post is committed with `draft: false`. Current
state cannot answer the question on its own: a post at `draft: true` is either
brand new (refuse) or previously published and withdrawn (allow).

**The security-critical part is that the value is read only from the COMMITTED
FILE and always overwritten on the way out.** Without that, an agent could
publish any draft by submitting `first_published` in its own payload, asserting
the very fact the gate checks. `check:policy` has a paired forgery test for
exactly this, and it was observed failing.

Chosen over a D1 column because D1 is derived: `Regenerate all` rebuilds rows
from the artifact and would silently drop the fact. It is declared in the zod
schema but deliberately NOT copied into the record by `renderPost`, so the gated
artifact does not churn and the file stays the only place it lives.

The editor carries it through a hidden input. `serializePost` writes exactly the
keys it is handed, so a value the form did not carry would be dropped on the
next browser edit and a published post would read as never published.

### Auth and limits

`OPERATOR_TOKEN`, a wrangler secret, minimum 32 characters. Compared in constant
time after both sides are hashed to a fixed 32 bytes, so neither the contents
nor the LENGTH of the presented token leaks through the comparison. Absent or
too short, the endpoint returns 503: not configured means not open.

Rate limited to 30 per 60 seconds, reusing the existing `AskBudget` Durable
Object with an `op:<id>` instance name. No new class and no migration. Authenticate
first, then rate limit, so an unauthenticated flood cannot exhaust a real
operator's budget. Without `ASK_BUDGET` the endpoint refuses rather than serving
unprotected, the same stance the Ask guards take.

Commits carry `[operator:<id>]`, where the id is eight hex characters of a hash
of the token: stable, changes on rotation, reveals nothing.

**Verifying the limiter needs a CONCURRENT burst.** A sequential loop of 36
requests produced zero refusals, because it straddled the fixed-window boundary,
and that reads exactly like a dead limiter. 45 concurrent requests produced 19
refusals. Same trap already recorded for the Ask guards.

## check:policy (gate)

`npm run check:policy` imports `app/lib/editor/publish-policy.mjs`, the module
the Worker imports, on the same principle as `check:search` and `query.mjs`.
Pure: no GitHub, no database, no network. 29 assertions, every rule paired with
its negative.

Verified by planting three violations and confirming a real exit 1 for each:
trusting the caller's `first_published` (the forgery hole, exactly 2 failures),
removing the operator refusal (4), and clearing `first_published` on unpublish,
which would lock an operator out of republishing its own post (2).

## Social cards

`npm run build:og -- --remote` renders a 1200x630 PNG per post with satori and
uploads it to R2 at `og/<slug>-<hash>.png`, where the hash is FNV-1a over slug,
title and description. The key changes exactly when the card would, so the
object is served immutable and regeneration is idempotent.

**Build time only, in Node.** Running satori in the Worker means workers-og
(1.87 MB) on top of a Worker already at 3.46 MB plus a WASM binary, for code
that would only ever run on the admin save path. **The gap:** a post created or
retitled in the editor has no card until `build:og` runs and `sync:content`
follows. The editor stores no card URL rather than one that would 404.

Neither the key nor the image goes in the gated artifact. The key is
deterministic, but whether the object exists is a fact about R2, and PNG bytes
from font rasterisation are exactly the kind of input a byte-comparison gate
must never be handed.

Order matters: `build:content` then `build:og` then `sync:content`.
Fonts live in `assets/fonts/` and are build assets, not public ones.

**The gap is now floored, not closed.** `DEFAULT_OG_IMAGE` in `app/lib/seo.ts` is
the site mark, and card precedence is cover, then the `build:og` card, then that
default, so a post whose card has not been built shares as the brand rather than
as nothing. It is DERIVED from `SITE_ORIGIN`, never written out: the apex still
resolves to the legacy WordPress site, so a hardcoded apex URL would ship a
broken card until DNS cutover. Deriving it adds no new item to the cutover list.

**Icons and the manifest live in root's `links` export, not `meta`.** `links`
from every matched route are MERGED; `meta` is not. A root-level `og:image`
would therefore be dropped by every route that exports its own meta, which is
why the default card is a constant each public route names for itself. Grounds:
`dustinedwards/session-2026-07-29-logo.md`.

`.site-logo-brand { fill: var(--brand) }` is the whole dark-mode story for the
mark. The token resolves through the same three theme selectors as everything
else, so a chosen theme, a light default and system mode all land on the right
mark with no media query of the mark's own and nothing to flash.

## Version history

`/admin/posts/:slug/history` lists commits for the post's file, shows a diff per
commit, and restores by reading the file at an old commit and putting it back
through `savePost`. That is the ordinary atomic path, so a restore is a NEW
commit. Never force push, never rewrite, never a second write path. The gates
run again on restored content, so an old commit cannot bypass a newer rule.

## Design tokens and theming

The Hill Country token system, ratified 2026-07-28. The authoritative colour
spec is `dustinedwards/design-tokens.md`; the ruling pointer is in
`dustinedwards/decisions.md`. **Every hex in `app/app.css` is copied from that
doc.** Do not re-derive, re-tune or improve one without a new ruling.

Tokens are named for the ROLE a component asks for, never the hue: `--fill-danger`,
not crimson. Six families (brand, danger, warning, success, info, accent) plus
neutrals, marks and charts.

**Theme resolution, and why there is no flash.**

    :root, [data-theme="light"]   light
    :root:not([data-theme])       dark, under a dark OS preference
    [data-theme="dark"]           dark, chosen

"System" is the ABSENCE of the attribute, not a third value. The choice lives in
a COOKIE, read in the root loader, so the server writes the right attribute into
the first byte of HTML. There is no inline script and nothing is corrected after
paint. Verified: no cookie and `theme=system` both render `<html lang="en">`,
`theme=dark` renders `data-theme="dark"`, a junk cookie degrades to system with a
200. This RESOLVED the recorded theming divergence.

Both theme blocks land on the same element, so they do not cascade into one
another: **a token declared in light and forgotten in dark keeps its LIGHT
value**. `check:contrast` asserts name parity for exactly this.

The toggle is a real `<form method="post" action="/theme">` with three submit
buttons carrying `aria-pressed`, so it works with scripting off; `app/enhance/theme.ts`
only removes the round trip. Not a `role="radio"` group, because a real
radiogroup owes arrow-key roving focus that cannot be delivered without script.

**Six binding usage rules** live in design-tokens.md and are part of the ruling.
Two shape this repo directly:
- **Links are underlined.** Base rule on `a`. The only exemptions are elements
  already carrying a non-colour affordance (a border or a fill): `.tag-chip`,
  `.post-action`, `.search-chip`, `.btn`/`.btn-danger`, and the two wordmarks.
  Decided with Dustin 2026-07-28.
- **Interactive semantics take fills, never pastel text on the page.** Delete is
  `--fill-danger`. Pastels are for banners and text (`.editor-problem`).

Documented exceptions, both for the same reason (the colour is carrying DATA,
not decoration): the version-history diff uses success and danger tints
adjacently, against the one-tint-per-view rule, and each line keeps its literal
`+`/`-` prefix as the second channel.

Code blocks sit on `--surface-code`, NOT on a shiki theme's own background:
github-dark ships a blue-black that fights the warm palette. Syntax themes are
`github-light-high-contrast` / `github-dark-high-contrast`, chosen by
measurement after that change voided the previous verification. The plain github
themes failed four light tokens (comments 4.06, strings 3.90, keywords 3.86,
constants 2.94) and dark comments at 3.34. Comments are repointed at the
ratified `--text-muted`, the one hand-set syntax colour.

**`OG_TEMPLATE_VERSION` in `pipeline.mjs` is part of the card's hash key.** The
card key is what makes the R2 object safe to serve immutable, so a template
restyle that did not change the key would never reach a cached reader. Bump it
whenever card colours, type or layout change. It is at 2 for these tokens.

## check:contrast (gate)

`npm run check:contrast` reads the token values back out of `app/app.css` and
recomputes the whole matrix. **Two independent sources argue:** the hexes come
from the stylesheet, the pairs and thresholds are transcribed from
design-tokens.md as token NAMES. Nothing in the script restates a hex, so a
tuned hex moves one side of the comparison and fails.

It also verifies every shiki token against both code surfaces, and, when a build
is present, that all 104 light and dark values survived into the shipped CSS.
WCAG 2.x is what fails a run; APCA Lc prints as advisory, because APCA is what
produced the fills-over-pastels rule.

Verified by planting three violation classes and confirming a real exit 1 each
time (a tuned hex, a token missing from the dark block, the two dark blocks
disagreeing). **Check the exit code directly, never through a pipe:** `tail`
masked it and reported exit 0 on a failing run during this work.

Two traps it already caught, both real:
- The token block's own comment spells out the three selectors, so the parser
  found the PROSE first and read the light block three times, passing every dark
  row for the wrong reason. Comments are stripped before anything is located.
- Lightning CSS rewrites `#ffffff` to `#fff`, so a substring match reported
  three tokens missing from a stylesheet that carried all of them. Values are
  compared normalised.

Three low-contrast tokens in `github-dark-high-contrast` are reported as
unreachable rather than failed: they are diff scopes and `diff` is not a loaded
grammar. **That exemption fails closed**, conditioned on `LANGUAGES` not
containing `diff`.

## Zero-JS rule (gate, not preference)

Every public blog route must be fully functional with JavaScript disabled.
All client JS is one chunk, `app/enhance/blog.ts`, loaded by dynamic import
from `BlogEnhancements` and therefore only on blog routes. It is 3.87 kB raw,
1.55 kB gzip. Everything in it upgrades markup that already works: the TOC is
anchor links, footnotes are jump links, images are images, and Copy as Markdown
is an anchor to the .md twin.

Do not load it with a `?url` import. That copies the file verbatim as an asset
and serves the browser raw TypeScript. Measured 2026-07-28.

Line highlighting comes from fence meta (```ts {2,5-7}) and is applied in the
PIPELINE, so it is in the stored HTML rather than painted on by script.

## Revision dates

`updated_at` is derived from the last git commit touching the post file, at
SYNC time. Never put a git date in `content/generated/posts.json`: the artifact
is generated before the commit that contains it, so it records the previous
commit and the next build computes a different one, leaving `check:content` red
after every ordinary content commit. Explicit `updated` frontmatter overrides.

## Cross-post data

`related` is computed over the whole corpus by `withRelated`, which BOTH callers
run. Relatedness is a property of the set: adding or retagging one post changes
the related list of every post sharing a tag, so an editor save that spliced one
entry would make the artifact disagree with the next build.

Markdown rendering lives in `app/lib/content/pipeline.mjs` so the Worker and the
build scripts import the same module. There must never be a second renderer.
Highlighting is `shiki/core` with the explicit `LANGUAGES` list, because the full
shiki bundle ships every grammar and took the Worker to 14 MB; a fenced block in
an unlisted language renders as plain text in published output as well as
preview.

## Hard rules

1. Every public read goes through `publiclyVisible()`. It hides drafts and future publish_at rows. Do not query posts for public output without it.
2. Migrations are hand-written in `drizzle/`. drizzle-kit is intentionally not a dependency (esbuild advisory). Add a new numbered file, never edit an applied one.
3. Keep the worker lean. No heavy dependencies. Client bundles stay small; auth code loads only on admin and login routes. This is the repo's bundle-leanness rule, and it is why inline SVG is preferred here over an icon library.
4. Secrets are wrangler secrets, read only in `.server` modules and in loaders/actions: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BETTER_AUTH_SECRET, BETTER_AUTH_URL, ADMIN_EMAIL, GITHUB_TOKEN, OPERATOR_TOKEN.
5. Do not modify `.claude/settings.json` without explicit instruction. Two PreToolUse hooks block on exit 2: `no-em-dash.sh` on Write and Edit, and `scoped-git-add.sh` on Bash. A Stop hook runs `npx tsc -b`. That enforcement is deliberate. PreToolUse plus exit 2 is the only blocking combination; the older PostToolUse `.mjs` registration could not block a write and was retired in d36dbf2.
6. `wrangler d1 export` does NOT work on this database: it fails outright on the
   `posts_fts` virtual table (measured 2026-07-27). Back up per table instead,
   `--no-schema --table <name>`, never the FTS table or its shadow tables.
   Related: `COUNT(*)` on `posts_fts` reads through to `posts` and so can never
   detect index drift. Count `posts_fts_docsize` instead. Never run
   `DELETE FROM posts_fts`; it corrupts the index, and the repair is
   `INSERT INTO posts_fts (posts_fts) VALUES ('rebuild')`.
7. `public/publications/` and `public/phage-hunters/` hold 31 PDFs and 9 photos from retired content. They are orphaned on purpose, reachable by direct URL and linked from nowhere, kept for citation integrity in other people's published work. Do not delete them as hygiene, and never write a redirect or gone rule that matches `/publications/*` or `/phage-hunters/*` as a prefix.
