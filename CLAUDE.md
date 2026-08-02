# CLAUDE.md - dustinedwards.info

Portfolio-wide rules live in Capsid, not here. Read `capsid/conventions.md` first, then `dustinedwards/core.md`. This file holds only what is true of this repo.

## What this is

Personal platform and Cloudflare showcase for Dustin Edwards. React Router 8 (SSR) + Vite + @cloudflare/vite-plugin, native on Cloudflare Workers. Drizzle on D1, Better Auth (Google, single admin) with sessions in KV, R2 for media. Node 24.14.1 (.nvmrc). Also the flagship site and a Capsid CMS consumer.

## Session ritual

Start: read `capsid/conventions.md`, then `dustinedwards/core.md`.
End: write a `session-YYYY-MM-DD.md` episodic (type `episodic`, under ~2KB) to the dustinedwards namespace.

## Workflow: mainline only, until launch

Ratified 2026-07-29. Full ruling and grounds: `dustinedwards/workflow-mainline.md`.
Scope is THIS REPO ONLY, and only until the DNS cutover; at launch the ruling
sunsets and the PR workflow in `capsid/conventions.md` resumes.

No feature branches and no PRs. Everything lands directly on `main`, committed
and pushed immediately. Never leave work uncommitted and never leave a commit
unpushed. **The gates are the review now**, so they run before every push:
typecheck, build, and whichever of the check family the change touches.

The site is pre-production on the workers.dev hostname, there is no CI, and
pushing `main` deploys nothing on its own, so `main` IS the staging environment
and a PR was ceremony without a second reviewer. Every recurring hazard this
repo has actually suffered came from divergence: a branch deploy leaving `main`
behind production, uncommitted work wiped by a one-file `git checkout`, PRs
sitting unmerged while production ran their code. This also matches the content
write path, where the editor and the operator API already commit straight to
`main`.

Unchanged by it: scoped `git add` of named paths, docs in the same commit,
destructive operations stay with Dustin, and anything touching money paths or
auth secrets is still flagged before it lands.

## Bindings

Read off the request context via `getEnv(context)` from `app/lib/context.ts`.
Never import bindings globally.

  DB          D1 database "dustinedwards"
  APP_KV      KV namespace (Better Auth session store)
  MEDIA       R2 bucket "dustinedwards-media"
  AI_SEARCH   AI Search instance "dustinedwards" (Ask, search Layer 2)
  ASK_BUDGET  Durable Object, class AskBudget (Ask per-IP limit, daily ceiling)
  IMAGES      Images binding (media thumbnails, transforms on request)

### Where the config lives, and why it is split

**`wrangler.jsonc` is gitignored and `wrangler.jsonc.example` is tracked.** That
is a PORTFOLIO rule, not this repo's choice: capsid/conventions.md, "Public-repo
hygiene", says real config never goes in git and an example with placeholder ids
does. Three other repos commit the real file and are tracked there as convention
violations, so do not "fix" this one by committing it.

The two files differ in exactly **two values**, `database_id` and the KV
namespace `id`. Every binding, the compat date and flags, and the durable object
migrations are identical, which is what makes the example a real description of
this Worker rather than a stub. `postinstall` copies it into place on a fresh
clone via `scripts/bootstrap-config.mjs`, which never overwrites an existing
config.

Neither file has ever held a secret. All seven live secrets are in
`wrangler secret`, confirmed by `wrangler versions view`.

**The failure mode this has already had.** On 2026-08-02 the `images` binding
was added to the real config and not mirrored into the example, so a fresh clone
would have built a site whose media thumbnails silently fell back to
full-resolution originals. Nothing compared the two files.

`npm run check:config` now does, failing in both directions and failing if the
example ever starts carrying a real id. **Adding a binding means editing both
files in the same commit.**

## Commands

- `npm run dev`
- `npm run build`
- `npx tsc -b` typecheck (`tsc --noEmit` is a no-op here)
- `npm run build:content` regenerate `content/generated/posts.json` from `content/posts/`
- `npm run check:content` gate; fails when the committed artifact differs from a fresh generation
- `npm run check:config` gate; fails when wrangler.jsonc and wrangler.jsonc.example
  declare different bindings, or when the example carries a real resource id
- `npm run sync:content -- --local|--remote` push the artifact into D1 and rebuild the FTS index
- `npm run check:search` gate over the query parser and rank fusion (pure, no database)
- `npm run check:backup -- --local|--remote` proves the per-table export path still covers the schema
- `npm run check:logo` gate; proves the inline mark still reproduces the four SVG fixtures (pure)
- `npm run check:charts` gate over chart determinism, Node-vs-Worker byte parity, and the directive's accessibility contract
- `npm run build:diagrams [-- --force]` render `:::diagram` sources to `public/diagrams/`; skips what is current, prunes what the corpus no longer references
- `npm run check:diagrams` gate over the diagram contract, asset coverage, and the tokens-only colour audit (pure, no Chromium)
- `wrangler d1 migrations apply dustinedwards [--local|--remote]`
- `npm run deploy` (build then `wrangler deploy`). Auto-deploy is not wired, and
  bare `wrangler deploy` is not the deploy path: it would ship whatever `build/`
  already held.

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

### The feedback slot (built 2026-07-29)

**A first publication used to complete in silence.** A save redirected to
`/admin/posts` and said nothing, so the one act the system reserves to the human
looked exactly like nothing having happened. That is a design failure by this
architecture's own logic, not a missing nicety.

ONE slot, four states, `app/components/admin/post-editor.tsx`:

    saved             success tint. "Saved. Commit <sha>."
    published-first   success tint, heavier edge, larger heading, the live link.
    republished       success tint, the live link.
    unpublished       warning tint, the URL that now 404s.
    failed            danger tint, the gate's own prose, same prominence.

**The transition is named by `publish-policy.mjs`, not by the UI**, because only
the policy module read the prior FILE, and current state cannot tell a first
publication from a republication: a post at `draft: true` is either brand new or
withdrawn. `decide()` returns `outcome` alongside the permission it was already
computing, and `check:policy` asserts all four transitions with their negatives
(a live post edited again is NOT a republication; a draft re-saved is NOT a
second unpublish).

**Success travels in the URL, failure does not.** A save is post/redirect/get,
so the outcome crosses a navigation as `?saved=<outcome>&sha=<short>&at=<date>`,
parsed server side in the loader. No flash cookie, no session store, renders in
the first byte of HTML with scripting off, and a reload repeats the message
instead of re-posting the form. A FAILURE cannot redirect, because that would
throw away the body the author just typed, so it stays in the action result.
`app/lib/editor/feedback.ts` owns both directions and treats the query string as
untrusted: the shas and the date are pattern-matched, the slug is taken from the
route rather than the query, and a first publication with no valid date degrades
to the plain saved message rather than claiming a ceremony it cannot date.

Persistence is "until the next action", and the next action is anything that
produces an `actionData`: a failure replaces the message and a preview clears
it, because by then the URL is describing a save two steps ago.

**The slot is always in the DOM, empty when there is nothing to say.** It is the
`aria-live="polite"` region, and a container that appears at the same moment as
its text announces nothing. Polite rather than assertive because every message
follows a submit the author just made and none of them vanishes.

**The draft checkbox area carries a Live/Draft chip**, the same `.chip` the post
list uses, so the page state is legible without reading the message. Bordered
rather than tinted: binding rule 4 allows one semantic tint per view and the
slot is where it is spent. The same rule is why the "Saving unavailable" banner
moved off `--tint-danger` onto the neutral `.editor-notice`; two tinted banners
would otherwise stack in that spot.

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
Pure: no GitHub, no database, no network. **45 assertions**, every rule paired
with its negative. It covers three things: the first-publish permission, the
Ask-publishability filter that keeps drafts out of the AI index, and the save
OUTCOME the editor reports back.

Verified by planting five violations and confirming a real exit 1 for each:
trusting the caller's `first_published` (the forgery hole, exactly 2 failures),
removing the operator refusal (4), clearing `first_published` on unpublish,
which would lock an operator out of republishing its own post (2), and, for the
outcome classification, collapsing republish into an ordinary save (1) and
collapsing unpublish into one (1).

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

Order matters: `build:content`, then `build:og` and `build:diagrams`, then
`sync:content`. Both generators read the artifact, so both need it fresh; neither
writes to it, so they do not care about each other.
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
- **Identity elements never take `:visited`** (Dustin's ruling 2026-07-30). The
  public header wordmark is brand at rest in both themes; hover feedback is kept.
  This is a SPECIFICITY rule: a class-only rule is (0,1,0) and the base
  `a:visited` is (0,1,1), so the base rule wins and the wordmark turns claret.
  Identity rules carry an explicit `:visited` selector at (0,2,0). It is invisible
  in review because it only appears once `/` is in history. The mark needs no rule,
  because `.site-logo-brand` sets `fill` and no colour pseudo-class reaches it.
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

## check:logo (gate)

`npm run check:logo` proves `app/components/site-logo.tsx`, the module the Worker
renders, still reproduces the ratified SVGs. Pure: no network, no database, no
build. **80 assertions over 4 fixtures.**

**The four `public/*.svg` files are FIXTURES, not dead assets, and that is why
they stay.** They are not what the site renders; the component is. Two
independent sources argue, exactly as in `check:contrast`: the expected path data
and fills come from the files, the actual ones from the component, and nothing in
the script restates a path. Delete them and the gate has nothing to check
against.

The component collapses four files into one path list plus a viewBox, because the
four differ in exactly two ways: the viewBox, and whether the five purple paths
carry `#4F2D7F` or `#B7A5E0`. Those five carry NO fill in the component; they
take `.site-logo-brand`, which is `var(--brand)`. This gate is what keeps that
collapse honest.

It fails in BOTH directions, verified by planting five violations and confirming
a real exit 1 for each: a digit of path data hand-edited in the component (4
failures), a purple path hardcoded to the light hex instead of the token (3), an
altered viewBox (2), a FIXTURE regenerated that the component did not follow (1),
and a fixture deleted, which fails closed on ENOENT rather than passing on an
empty read. Coverage of the script itself was proven the same way: a planted type
error made `tsc -b` exit 2 naming `scripts/check-logo.mjs`.

Block comments are stripped before anything is located, because this file's own
header names `viewBox` and both hexes. That is the trap `check:contrast` already
hit, where the parser found the prose in a comment first.

Construction spec: Capsid `dustinedwards/logo-spec.md`, amended 2026-07-29 to
record the brand binding. A variant is a rebuild from those values, never a hand
edit of path data.

## check:contrast (gate)

`npm run check:contrast` reads the token values back out of `app/app.css` and
recomputes the whole matrix. **Two independent sources argue:** the hexes come
from the stylesheet, the pairs and thresholds are transcribed from
design-tokens.md as token NAMES. Nothing in the script restates a hex, so a
tuned hex moves one side of the comparison and fails.

It also verifies every shiki token against both code surfaces, and, when a build
is present, that all 106 light and dark values survived into the shipped CSS.
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
Highlighting is `shiki/core` with an explicit grammar list, because the full
shiki bundle ships every grammar and took the Worker to 14 MB; a fenced block in
an unlisted language renders as plain text in published output as well as
preview.

**`LANGUAGES` is DERIVED from the `GRAMMARS` map, not maintained beside it.**
There used to be two hand-kept lists, an exported array of names that
`check:contrast` reads and a separate array of imported grammars handed to shiki,
and adding python meant editing both. Editing only one is invisible in review:
naming a language shiki was never given makes the gate assert about a grammar
that is not loaded, and loading one the array omits leaves it unasserted. Same
class as the backup table list, so it gets the same treatment.

`python` was added 2026-07-30, measured at **+75.41 KiB raw / +8.59 KiB gzip** on
the Worker.

## Charts

Ruling and probe numbers: Capsid `dustinedwards/chart-stack.md`. Charts are
**content**, not a widget: the SVG is rendered at build time into the gated
artifact, so `check:content` byte-compares it like prose and a reader with
JavaScript off sees the same chart everyone else does.

Authoring is a `:::chart` container directive whose body is one fenced block of
CSV plus an optional caption:

    :::chart{type=bar x=mechanism y=allowed,ceiling labels="Allowed,Ceiling"
             title="..." alt="..."}
    ```csv
    mechanism,allowed,ceiling
    async DO storage,8,3
    sync SQLite DO,3,3
    ```
    An optional caption, rendered as markdown.
    :::

`type` is bar, line, dot or area. `alt` is MANDATORY, exactly as it is on
`:::figure`. Multiple `y` columns make it multi-series; `labels` overrides the
column headers for display and every series label must be present and unique.

**Colours come from the ratified chart ladder as CSS custom properties**, never
hexes: `var(--chart-cadet)`, `-purple`, `-claret`, `-sage`, `-gold`, and the
extended `-rust`. The custom property passes into the SVG verbatim and resolves
per theme in the browser, which is why ONE stored SVG serves light and dark with
nothing to flash and no second render. More series than there are tokens is a
build failure rather than a repeated colour.

**Multi-series charts label series directly and never emit a legend**, because
design-tokens.md rule 3 says hue is never the sole channel. Line, dot and area
put the label at the last point of the series; bar facets by x so the series name
sits under its own bar.

**The accessible name goes on the `<svg>`, never on the `<figure>`.** This is the
one thing to get right here and it is easy to get wrong: `role="img"` makes its
descendants presentational and the WAI-ARIA spec says user agents SHOULD NOT
expose them, so naming the figure would generate a caption and a data table and
then hide both from exactly the readers they exist for. The contract in
chart-stack.md originally said figure and was corrected against the spec.
Structure is `<figure class="chart-figure">` holding an optional
`<p class="chart-title">`, the named SVG, `<figcaption>` when captioned, and the
generated table in `<details>`.

The title is a `<p>`, deliberately not a heading: `rehypeCollectToc` scans h2 and
h3, so a heading would inject chart titles into the post's table of contents.

**Plot's injected `<style>` block is stripped.** It carried
`--plot-background: white`, the one colour literal in Plot's output, and N charts
on a page would otherwise ship N copies of it. The equivalent rules live once in
`app.css` under `.chart-figure`.

Dependencies are PINNED to exact versions (`@observablehq/plot` 0.6.17,
`linkedom` 0.18.13). A bump reruns `check:charts`, because the determinism and
parity properties are properties of those versions and nothing else proves them.

## check:charts (gate)

`npm run check:charts` imports `app/lib/content/chart.mjs`, the module the Worker
imports. **141 assertions.**

`check:content` already catches a hand-edited or stale chart SVG. What it cannot
catch is a renderer that is not deterministic, which would make the byte
comparison fail at random. That is not hypothetical here: it is exactly what the
shiki JavaScript regex engine did, and why oniguruma is a dependency. This gate
proves the property that makes `check:content` mean anything for charts.

- **Determinism in-process**: 8 fixtures (4 mark types, single and multi-series)
  rendered 200 times each, one distinct output apiece.
- **Determinism across processes**: three separate node processes must agree with
  the parent. Module-level state only shows up across a process boundary.
- **Node vs Worker parity**: the same module is bundled for workerd with esbuild
  and run under miniflare, and every fixture must be SHA-256 identical to the
  Node render. The two writers must agree or the editor commits HTML the next
  build will not reproduce.
- **The contract**: tokens only, an accessible name on the SVG and not the
  figure, the data table present and after the chart, no legend, no heading, and
  a paired negative for every validation rule.

**Scope, stated rather than implied:** the parity run bundles `chart.mjs`, which
is the whole new rendering surface and the only part whose workerd behaviour was
in question. It does not re-bundle the markdown pipeline, which would test the
Vite plugin's WASM handling rather than the chart renderer.

Verified by planting nine violations and confirming a real exit 1 for each: the
alt rule removed, the multi-series label rule removed, a hex literal in the
ladder, `role="img"` removed, the accessible name removed, the name moved onto
the figure, the colon-digit fix removed, `Math.random()` in the render, and a
`typeof WebSocketPair` branch to force a Node/Worker divergence. `check:content`
was separately observed failing on a hand-edited chart SVG in the artifact and on
python removed from the grammar list.

## Directive names and prose that looks like markup

`remark-directive` accepts digits in a directive name, so ordinary prose parsed
as markup: `4.5:1` became a text directive named `1`, and so did `12:30` and
`localhost:8080`, each rendering as an empty `<div>` that ate the rest of the
token. The palette article shipped with its contrast ratios in code spans to work
around it.

`remarkNumericTextDirectives` turns any INLINE directive whose name starts with a
digit back into text, reconstructed by slicing the original source at the node's
offsets so a directive that also carried a label or attributes comes back exactly
as written. Nothing legitimate is lost: every directive this pipeline defines is
a word.

Measured rather than assumed: `::30` does not parse as a leaf directive at all,
and a numeric CONTAINER needs a deliberate `:::99` at the start of a line, so
neither is reachable from prose and neither is rewritten.

**Any other unrecognized directive is a BUILD ERROR** (ruled 2026-07-30).
`KNOWN_DIRECTIVES` in `pipeline.mjs` is the list, and `remarkUnknownDirectives`
throws a `ContentError` naming the post, the line, the unknown name and the known
list. An unhandled directive is not inert: remark-rehype renders it as a bare
`<div>`, so `:::figrue` would publish a silent empty element where a figure was
meant to be and drop the author's caption with it. Silent wrong output is the
class this repo forbids everywhere else, and a typo is precisely the case nobody
catches in review.

The list is `chart`, `diagram`, `figure`. **Adding a directive means adding it
here in the same commit**, or the new syntax fails the build under this rule.
That is the rule working, not a conflict, and it was observed: `diagram` removed
from the list makes `build:content` reject the very posts that use it.

Switched on only after a corpus scan: all 11 posts carried 2 directives in total,
both `:::chart`, and zero unknown ones, so nothing existing had to be fixed.

The cost is that genuine prose containing a colon followed by a word (`note:this`)
now fails the build. That is the intended trade. The error message advertises the
escape, `\:` or a code span, and `check:charts` asserts the escape actually works,
because advice in an error message that has never been run is just a guess.

## Diagrams

Ruling: Capsid `dustinedwards/chart-stack.md`. Authoring: the same skill charts
use. Renderer: `app/lib/content/diagram.mjs` plus `scripts/build-diagrams.mjs`.
Gate: `npm run check:diagrams`.

`:::diagram` is a container directive whose body is one fenced `mermaid` block
plus an optional caption, with a MANDATORY `alt` and an optional `title`, exactly
like `:::chart`. The fence language is checked, because the fence is also what
makes the source render as a diagram in the `.md` twin and on GitHub.

**The SVG is NOT in the gated artifact, and that is the whole difference from
charts.** Diagram layout needs real font metrics, so mermaid needs a real browser
engine and cannot run in a Worker; charts pass the both-writers rule and diagrams
cannot. So diagrams take the social-card pattern: `build:diagrams` renders them
into `public/diagrams/` under a content-hashed key, and the artifact carries the
KEY and the SOURCE. `check:content` still byte-compares everything the pipeline
produced, while bytes that came out of a browser engine stay out of a
byte-comparison gate. The mermaid source rides in the artifact because
`build:diagrams` reads it from there rather than parsing markdown a second time.

**Nothing preserves a reference on save, because nothing stores one.** The key is
`FNV-1a(DIAGRAM_TEMPLATE_VERSION + normalized source)`, so an unchanged diagram
computes the same key on every writer and an editor or operator save reproduces
it for free. The gap is the card gap, restated: a NEW or CHANGED diagram has no
asset until `build:diagrams` runs from a clone. `check:diagrams` goes red in
exactly that window, on purpose, the same way `check:backup` is red between a
migration being committed and applied.

**`DIAGRAM_TEMPLATE_VERSION` is part of the key**, for the reason
`OG_TEMPLATE_VERSION` is. The key is what makes the asset safe to serve immutable
and what lets the build skip work, so a restyle that did not change the key would
leave every asset at the old colours while the build reported nothing to do. Bump
it when the token map, the values those tokens resolve to, or mermaid changes.
Recovery for a token retune is `build:diagrams -- --force`, whose git diff is the
review.

### Two renders per diagram, and both halves are measured

An `<img>`-embedded SVG cannot be themed the way a chart is. Measured 2026-07-30:

- **mermaid rejects a custom property outright.**
  `themeVariables: { primaryColor: "var(--surface)" }` fails the render with
  `Error: Unsupported color format: "var(--surface-2)"`, because khroma parses
  every value in order to derive the ones it was not given.
- **An SVG behind an `<img>` is an independent document**, so even an embedded
  `var()` would resolve against nothing, and a `prefers-color-scheme` block
  inside the asset would be wrong anyway: this site resolves its theme from a
  COOKIE, so a reader who chose light under a dark OS would get the dark drawing.

So both are rendered and `app.css` shows one. `display: none` rather than opacity
or visibility, because it is the only one of the three that also removes the
hidden image from the accessibility tree, which is what lets both carry the same
`alt` without a screen reader announcing the diagram twice. The cost is honest
and measured: both images are fetched, about 25 kB each.

Two more things that are settings rather than preferences:

- **`htmlLabels: false`.** mermaid's default wraps flowchart labels in
  `<foreignObject>`, and foreignObject is NOT rendered when an SVG is loaded
  through `<img>`. Every node would come out blank on the page while looking
  correct in a standalone viewer.
- **The root gets an explicit width and height, copied from the viewBox.**
  mermaid emits `width="100%"`, which inside an `<img>` is an SVG with no
  intrinsic size, and the browser falls back to the 300x150 replaced-element
  default. Done by rewriting the root TAG rather than by re-serialising: an
  `.svg` is parsed as XML, so a serialiser that emits one unclosed tag produces a
  file that renders as nothing.

**The accessible name is `alt` on the `<img>`, not `role="img"` plus
`aria-label`.** The corrected contract in chart-stack.md is about naming the
element that IS the graphic rather than its figure; for an `<img>` that element
is named by `alt`, and the ARIA pair would be a redundant override of a working
native mechanism. There is also no generated equivalent the way a chart has a
data table: the `.md` twin already serves the mermaid source verbatim, which is
the machine-readable form, and the alt is the human one.

**No width or height on the `<img>`**, and `rehypeImageDimensions` skips anything
classed `diagram-image`. The pipeline may not touch the filesystem and the asset
legitimately may not exist yet, so there is nothing honest to measure. Checked by
class rather than by plugin order, so moving the plugin cannot silently
re-enable it.

**There is no colour vocabulary for authors, deliberately.** A diagram says what
it means with shape and label, which is design-tokens.md rule 3 taken to its
conclusion: a refusal is an edge labelled `403`, not a red arrow. The same
deliberate first cut as `:::chart` shipping four mark types.

**Sequence spacing is tightened from mermaid's defaults, for layout not taste.**
The prose column is 44rem, so a drawing wider than about 700px is scaled down and
takes its type with it. A default five-participant sequence diagram came out
1210px, which lands 16px text at an effective 9px.

**Font, recorded as a limitation rather than a solved problem.** The site's prose
is Inter, loaded as a webfont, and an SVG inside an `<img>` may not load external
resources, so a diagram is set in the system sans instead. That also means the
viewer's font is not guaranteed to be the one the build measured text with, since
mermaid bakes box sizes from the metrics it sees. Node padding is generous rather
than default to absorb it. Closing this properly means embedding a subsetted font
per asset, which was not built.

## check:diagrams (gate)

`npm run check:diagrams` imports `app/lib/content/diagram.mjs`, the module the
Worker imports, on the same principle as `check:search` and `query.mjs`. No
Chromium, no network, no database: mermaid is not run, because rendering is not
the property this gate protects. **409 assertions** over the current corpus.

`check:content` already catches a diagram REFERENCE that drifted, because the key
is a pure function of the source and rides in the artifact. What it cannot catch
is the thing that reference points at. A key that changed while the asset did not
is a broken image in the middle of an article and is invisible to every other
gate: the artifact is internally consistent, the typecheck passes, the page
renders. Three sections: the contract (mandatory alt, deterministic keys, the
emitted structure, the token map naming only tokens that exist in BOTH theme
blocks and agree across the two dark blocks), coverage (every referenced key has
both assets, and no asset is unreferenced), and colour.

**The colour audit models the CASCADE rather than hunting for hexes**, and
`scripts/lib/diagram-audit.mjs` is one implementation with two callers so that an
asset written before a rule existed cannot survive by having been written first.
mermaid ships a stylesheet inside every diagram covering every feature it can
draw, most of which this pipeline never emits, so reachability is computed:

- A CSS rule counts when its selector matches an element in that document.
- A colour attribute counts unless it sits in a `<defs>` subtree nothing
  references by `url(#id)`, or unless a rule matching THAT element sets the same
  property. An inline `style` always counts.

That last clause is not a convenience, it is the cascade, and it was found by
measurement: mermaid writes a literal `fill="#eaeaea"` onto every sequence actor
and then paints it from `.actor { fill: … }`. Reading the attribute as shipped
reported four violations on a diagram that was entirely correct; reading it as
dead without checking for the rule that kills it would let a real one through.
Values are validated by being a palette hex or a keyword that names no colour, so
`white`, `rgb(12.6, 10.1, 5.9)` and `hsl(-82.5, 36.4%, 91.4%)` are all caught,
which a hex-hunting regex would miss. Shadow colours inside `filter` and
`box-shadow` are out of scope and every rule carrying one in current output is
unreachable. Unreachable rules and overridden attributes are COUNTED and printed,
so "0 problems" can never quietly mean "0 things examined".

**Twelve planted violations, each observed exiting 1**, 2026-07-30: a diagram
with no alt; `diagram` removed from `KNOWN_DIRECTIVES`, caught separately by
`build:content` and by the gate; the mandatory-alt check removed from
`diagram.mjs`; a fence that is not `mermaid`; a rendered asset deleted; a colour
hand-edited inside a committed asset; an unreferenced asset left on disk; a key
hand-edited in the gated artifact; a hex written into the token map instead of a
token name; a token the stylesheet does not declare; and a colour left unmapped
so mermaid derived one of its own.

## The chart and diagram authoring skill

`.claude/skills/charts/SKILL.md` encodes both directive contracts for authors.

Note the PATH. `chart-stack.md` named it `.claude/skills/charts.md`, but skills
are discovered as `<name>/SKILL.md`; a flat file at that path is never loaded, and
advertising a skill that does not resolve is a defect by the house structure rule.
Verified before choosing: all 202 installed skills use the directory form, and
flat `.md` files appear only inside a skill's `references/`.

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
