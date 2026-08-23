# RECOVERY.md

How to rebuild this site's Cloudflare resources from nothing, given only this
repository and a fresh Cloudflare account.

This document exists because there is no infrastructure-as-code here.
**Terraform was considered and rejected** (`dustinedwards/decisions.md`,
2026-08-02): it would mean restating `compatibility_date` and every binding in a
second file, which recreates exactly the drift class `check:config` was written
to close, and its real value (multi-person orgs, DNS, account access management)
does not apply to a single-operator account. The gap Terraform would have covered
is documentation. This is that documentation.

Everything below was verified on 2026-08-02 unless a line says otherwise. The
verification status of each part is recorded at the bottom.

---

## Before you start

You need: the repo, a Cloudflare account, a Google Cloud project (for OAuth), and
a GitHub account with access to this repo.

```sh
npm install          # postinstall copies wrangler.jsonc.example into place
npx wrangler login
```

`npm install` runs `scripts/bootstrap-config.mjs`, which copies
`wrangler.jsonc.example` to `wrangler.jsonc` if and only if no config exists. It
never overwrites. The copy carries **placeholder resource ids**, so it is enough
to typecheck and deliberately not enough to deploy. You will replace two of those
ids below.

**Real resource ids never go in git.** `wrangler.jsonc` is gitignored; the tracked
`wrangler.jsonc.example` differs from it in exactly two values. `check:config`
enforces that and fails if the example ever starts carrying a real id.

---

## Recovery order

The order matters. Each step below names what breaks if it is done early.

1. **D1 database** and **KV namespace** and **R2 bucket**. Independent of each
   other. Their ids go into `wrangler.jsonc`.
2. **AI Search instance.** Independent of the above, but its corpus cannot be
   populated until D1 has content, so create it here and fill it at step 8.
3. **`wrangler types`.** Regenerates `worker-configuration.d.ts` from the config.
   *If skipped:* the typecheck fails against bindings it does not know about, and
   `npm run deploy` runs a build that has never been type-checked.
4. **D1 migrations.** *If run before step 1:* there is no database to apply to.
   *If skipped:* the first request that touches a table 500s.
5. **Secrets.** *If set after deploy:* the Worker serves, but Better Auth fails
   with `CLIENT_ID_AND_SECRET_REQUIRED` and nobody can sign in to `/admin`.
6. **Deploy.** The Durable Object migration runs as part of this. *If the DO
   migration block is missing from the config:* the deploy is rejected, because a
   class cannot be bound without having been introduced by a migration.
7. **Sync content into D1.** *If run before step 4:* the tables do not exist.
8. **Sync the Ask corpus.** *If run before step 7:* it uploads an empty corpus,
   reports success, and Ask answers nothing.
9. **Verify.**

Steps 1 to 3 are setup, 4 to 6 make the site serve, 7 to 9 make it correct.

---

## 1. D1 database

```sh
npx wrangler d1 create dustinedwards
```

Put the returned `database_id` into `wrangler.jsonc` under `d1_databases[0]`. The
binding is `DB`, `database_name` is `dustinedwards`, `migrations_dir` is
`drizzle`.

### Schema

```sh
npx wrangler d1 migrations apply dustinedwards --local
npx wrangler d1 migrations apply dustinedwards --remote
```

**The migrations reproduce the live schema exactly, and this was measured rather
than assumed.** Re-derived 2026-08-04: all **ten** migrations (`0001_init`
through `0010_media_role`) were applied to an empty SQLite database and the
result compared against the live remote schema, object by object:
**57 of 57 objects match**, 27 tables, 27 indexes and 3 triggers, with no object
on either side that the other lacks.

The live database carries three additional objects created by the D1 platform
itself rather than by any migration: the tables `d1_migrations` and `_cf_KV`,
and `sqlite_autoindex_d1_migrations_1`, the auto-index SQLite creates for the
former's primary key. Excluding the two tables but not that index is what turns
a clean match into a spurious one-object mismatch, which is worth knowing before
anyone re-runs this and thinks they have found drift.

The earlier form of this paragraph claimed 37 objects across seven migrations,
measured 2026-08-02, and had gone stale in both numbers: three migrations landed
after it (`0008_llms_seed`, `0009_media_index`, `0010_media_role`) and the object
count moved with them. Finding B005.

`drizzle-kit` is deliberately not a dependency. Migrations are hand-written. Add a
new numbered file; never edit an applied one.

**One historical caveat, now fixed.** `0001_init.sql` seeds a `settings` row for
`llms.txt` carrying the **retired virology copy**, 247 bytes. That was the only
thing that ever wrote the row, so a rebuild used to produce a stale, wrong
`llms.txt`. Since 2026-08-02 the source of truth is the tracked file
`content/llms.txt` and `sync:content` writes the row from it, so the migration's
seed is overwritten by step 9 below. `check:llms` fails if the two ever disagree.

---

## 2. KV namespace

```sh
npx wrangler kv namespace create "dustinedwards-app-kv"
```

Put the returned `id` into `wrangler.jsonc` under `kv_namespaces[0]`. Binding
`APP_KV`. It holds Better Auth sessions and the Ask answer cache. Both are
regenerated on use, so an empty namespace is a correct starting state.

---

## 3. R2 buckets

```sh
npx wrangler r2 bucket create dustinedwards-media
npx wrangler r2 bucket create dustinedwards-og
```

Bindings `MEDIA` and `OG`. No id is needed; a bucket is referenced by name.

**There are TWO buckets and they are split on LIFECYCLE, not on what the UI
calls them.** `dustinedwards-media` is irreplaceable: it holds uploaded
originals, and nothing can regenerate them. `dustinedwards-og` holds social
cards, every one of which `build:og -- --remote` can rebuild from the artifact,
so it is safe to empty and is deliberately not in the backup path. Creating only
the first, which is what this runbook used to say, produces a Worker that fails
to bind `OG` at deploy. Finding B005.

**Do not enable public access, and do not attach a custom domain.** Verified
2026-08-02 against the live bucket: `r2.dev` public access is **disabled** and
there are **no custom domains connected**. Every object is served through the
Worker's `/media/*` route, which is what allows the thumbnail transforms and the
immutable cache headers. Enabling public access would create a second, unmanaged
read path to the same bytes.

Live buckets for reference, read from the API 2026-08-22: `dustinedwards-media`
is location `ENAM`, `dustinedwards-og` is location `WNAM`, both storage class
`Standard`. This line named one location as though it covered both.

### Backup posture, and why there is no backup

**MEASURED 2026-08-22, and the measurement is the whole answer: there is
nothing in R2 that a restore could not reproduce.**

| Bucket | Objects | Bytes | Recoverable from |
| --- | --- | --- | --- |
| `dustinedwards-media` (`MEDIA`) | **0** | 0 | nothing needed; it is empty |
| `dustinedwards-og` (`OG`) | 12 | 505,712 | `npm run build:og -- --remote` |

Read four independent ways so that a zero is not taken on trust, which is the
failure this repo has already paid for: `listAllObjects` against the live
binding, three times, one of those runs clean of the workerd teardown error;
`check:media --remote`, which reports the same 0 and 12 through its own pipeline;
the D1 `media` table, whose 70 rows are 12 `storage='r2-derived'` and 58
`storage='static'` **and not one `storage='r2'`**, which is the value an uploaded
original would carry; and the corpus, where no post cites `/media/` and no post
carries a `cover`.

So the paragraph above is right about the RULE and was wrong about the FACT.
`dustinedwards-media` is the irreplaceable bucket by design and holds nothing.
Every byte in R2 today is an OG card, and the split this section describes is
what makes that recoverable rather than lucky.

**The decision is therefore ACCEPTANCE, not a backup**, and the basis is that
copying 505,712 bytes of regenerable PNG into a second bucket would buy nothing
a command does not already buy, while adding a bucket, a schedule and a second
thing to go stale. The other candidates were checked rather than assumed:

- **R2 object versioning does not exist.** Not "not enabled here": the R2 API
  has no versioning endpoint at all (checked against the OpenAPI spec
  2026-08-22, which carries lifecycle, lock, CORS, domains and sippy and nothing
  else). Any plan resting on it is resting on a feature that is not there.
- **Lifecycle and lock rules exist and both buckets carry neither.** Read live
  2026-08-22: each bucket has only the default multipart-abort rule and an empty
  lock rule set. A bucket lock is the mechanism if retention is ever wanted, and
  it protects against DELETION, never against loss of the account.

**WHAT MAKES THIS ACCEPTANCE SAFE IS THAT IT IS DATED AND CONDITIONAL.** It holds
exactly while `MEDIA` is empty. The first upload through the admin media drawer
makes the unrecoverable set non-zero, and nothing in this repo announces that.
Whoever lands the first upload owns re-deciding this section; until then there is
no backup because there is nothing to back up.

### What restoring actually involves

In the order it would be done, and none of it is a restore from a backup:

1. **Static assets** (58 rows, `public/`): `git clone`. All 60 files under
   `public/` are tracked, verified 2026-08-22 by `git ls-files public`.
2. **OG cards** (12 objects): `npm run build:og -- --remote`, after step 9's
   content sync, because it renders from the artifact.
3. **The `media` index rows**: rebuilt from R2 and `public/`, then reconciled by
   `check:media --remote`, which is the gate that would report any of the above
   being incomplete.
4. **Uploaded originals**: none exist. If that has changed since 2026-08-22, this
   step is a real gap and this section is stale.

---

## 3a. Media events queue, and the notifications that feed it

**Without this the media index is never written.** The module's write path is an
R2 event notification into a Queue, never a dual write: the Worker writes only to
R2, the bucket emits, and the consumer derives the D1 row. A rebuild with no
queue leaves every upload invisible to the library until someone runs the
backfill by hand, and nothing announces that. It was missing from this runbook
entirely. Finding B005.

```sh
npx wrangler queues create dustinedwards-media-events
npx wrangler queues create dustinedwards-media-events-dlq
```

Then point BOTH buckets at the first queue. Verified live 2026-08-04: each
bucket carries one rule, all prefixes, all suffixes, and they share one queue.

```sh
npx wrangler r2 bucket notification create dustinedwards-media \
  --queue dustinedwards-media-events \
  --event-type object-create --event-type object-delete
npx wrangler r2 bucket notification create dustinedwards-og \
  --queue dustinedwards-media-events \
  --event-type object-create --event-type object-delete
```

The live rules resolve to the event list
`PutObject,CompleteMultipartUpload,CopyObject,DeleteObject,LifecycleDeletion`.
Confirm with `wrangler r2 bucket notification list <bucket>` rather than trusting
the create output. Consumer settings (`max_batch_size` 10, `max_batch_timeout` 5,
`max_retries` 3, DLQ) live in `wrangler.jsonc` and come from the example file, so
they need no separate command.

The consumer is idempotent by construction: it re-derives the row from the object
as it is now and never branches on what the message claimed, so replay and
out-of-order delivery converge. That is why a dead letter after 3 attempts is a
signal to read rather than data to reconcile.

---

## 4. AI Search instance

```sh
npx wrangler ai-search create dustinedwards --type builtin --hybrid-search --reranking
```

Binding `AI_SEARCH`, `instance_name` `dustinedwards`. Flags confirmed against
`wrangler ai-search create --help` on wrangler 4.107.0.

`--type builtin` is load-bearing and not a default worth changing. The crawler
type would index a **domain onboarded to this account**, and until DNS cutover the
apex still resolves to the legacy WordPress site. Built-in storage also indexes on
upload rather than on a schedule, and keeps one item per section record, which is
what lets a citation deep-link to a heading anchor.

Settings not passed on the command line are defaults and were confirmed present on
the live instance: response caching on, `score_threshold` 0.4, reciprocal-rank
fusion, porter keyword tokenizer. The live embedding model is
`@cf/qwen/qwen3-embedding-0.6b`.

### Authorized hosts

The public endpoint and its MCP URL are enabled in the **dashboard**, not by CLI:
**AI > AI Search > your instance > Settings > Public Endpoint**. Set Authorized
hosts to the origin that will call it. Today that is the `workers.dev` origin; at
DNS cutover the apex is added. This is a dashboard-only step and there is no
wrangler command for it.

### Corpus

The corpus is **not** populated by any build step. After content is in D1 (step
7), sign in to `/admin/posts` and press **Sync Ask corpus**. That uploads every
section record through the Items binding and then prunes items the corpus no
longer contains. The prune matters: upload alone is an upsert, so a deleted post
would stay answerable forever.

**Drafts must never reach this index.** It is a public, unauthenticated surface.
`publishableForAsk()` is the gate and `check:policy` covers it.

---

## 5. Durable Object

No creation command. The class ships in the Worker bundle
(`workers/ask-budget.ts`, exported from `workers/app.ts`) and is created by the
**deploy**, driven by the config:

```jsonc
"durable_objects": { "bindings": [{ "name": "ASK_BUDGET", "class_name": "AskBudget" }] },
"migrations": [{ "tag": "v1", "new_sqlite_classes": ["AskBudget"] }]
```

### Why the order matters

The `migrations` array is a **cumulative, ordered ledger**, not a description of
the current state. Each entry has a `tag`, and Cloudflare applies only the tags it
has not seen for this Worker, in order. Two consequences:

- **A class must be introduced by a migration before it can be bound.** Deploying
  with the `durable_objects` binding present and the `migrations` entry missing is
  rejected.
- **Never edit or reorder an applied tag.** On a rebuilt account nothing has been
  applied yet, so `v1` runs and creates the class. On the existing account `v1` is
  already recorded and is skipped. Renaming or renumbering it makes the two
  accounts diverge permanently.

`new_sqlite_classes`, not `new_classes`. The guards use the **synchronous** SQLite
storage API, and that is the entire point: a read and a write spanning an `await`
inside a Durable Object is not atomic. Measured, the async storage API allowed 8
requests through a ceiling of 3; the synchronous SQLite API allowed exactly 3.

Removing the `durable_objects` block **disables Ask** rather than un-protecting it.
That is deliberate: an unprotected metered endpoint must not serve.

---

## 6. Images binding

```jsonc
"images": { "binding": "IMAGES" }
```

No resource to create and no id. It is enabled per Worker by the config alone.

It powers `/media/<key>?w=160|320|640`, which transforms the single original in R2
on request and stores no variants. It is the **binding** rather than the
`/cdn-cgi/image/` URL syntax because the URL interface needs a customer zone:
measured 2026-08-02, it answers 404 with Cloudflare error 1042 on `workers.dev`.
The binding is account-scoped and works without a zone.

If the binding is absent the thumbnail route falls back to serving the full
original and says so in an `x-media-thumb: unavailable-no-images-binding` header,
so the failure is diagnosable rather than merely slow.

Note: the Images binding requires an **Images-enabled account**. On a genuinely
fresh account this may need enabling before the binding resolves at runtime.

---

## 7. Secrets

Seven, by name only. Never commit values; never paste one into chat.

```sh
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put OPERATOR_TOKEN
```

| Secret | What it is for | Where a new one comes from |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Better Auth Google sign-in | Google Cloud Console, APIs and Services > Credentials > OAuth 2.0 Client ID (Web application) |
| `GOOGLE_CLIENT_SECRET` | The same client's secret | Same screen as above |
| `BETTER_AUTH_SECRET` | Signs session tokens | Generate one: `openssl rand -base64 32`. Rotating it invalidates every session |
| `BETTER_AUTH_URL` | The origin Better Auth builds callbacks against | Not a credential. The deployed origin, e.g. the `workers.dev` URL. Must match the Google redirect URI |
| `ADMIN_EMAIL` | The single address allowed into `/admin` | Your own address. Any other Google account authenticates and is then refused |
| `GITHUB_TOKEN` | The editor and operator API commit posts | GitHub > Settings > Developer settings > Fine-grained token, **Contents: read and write** on this repo only |
| `OPERATOR_TOKEN` | Bearer token for `POST /api/operator` | Generate one, minimum 32 characters. Compared in constant time after hashing, so neither contents nor length leak |

Verified 2026-08-02 with `wrangler secret list`: exactly these seven exist on the
live Worker, and **no secret has ever lived in `wrangler.jsonc`**.

There is no AI Search secret and none is needed. The Worker reaches the instance
through the binding. An AI Search API token is required only by
`wrangler ai-search create`, a control-plane call, and is minted in the dashboard
at **AI > AI Search > Tokens**. Without one, that create command refuses even
though the CLI otherwise looks authenticated.

**There is no `.dev.vars` in this repo.** A local `npm run dev` therefore has zero
secrets and nobody can sign in to `/admin` locally. Admin work needs a deploy, or
a `.dev.vars` you create yourself. `.dev.vars` stays gitignored, always.

### Google OAuth redirect URI

In the same Google credential, set the authorized redirect URI to
`<BETTER_AUTH_URL>/api/auth/callback/google`. This is not in this repo and is not
recoverable from it; see below.

---

## 8. Deploy

```sh
npm run typecheck     # wrangler types && react-router typegen && tsc -b
npm run deploy        # build, then wrangler deploy
```

**Never bare `wrangler deploy`.** It ships whatever `build/` already held.
`npm run deploy` builds first, and since 2026-08-20 it also REFUSES A DIRTY
TREE, because a deploy built from uncommitted files is a deploy nobody can
reproduce.

**Deploying is manual.** CI exists as of 2026-08-20 and runs the gates on every
push to `main`, but it has no Cloudflare credentials and deploys nothing.
Pushing `main` still ships nothing on its own. That sentence used to read "there
is no CI", which stopped being true while its conclusion stayed true.

---

## 9. Content and search

```sh
npm run build:content                  # regenerate the artifact from content/posts
npm run check:content                  # gate: artifact must match a fresh generation
npm run sync:content -- --remote       # posts, the llms.txt row, both FTS indexes
npm run check:llms -- --remote         # gate: the row must match content/llms.txt
```

`sync:content` writes three things: the posts and their tags, the `llms.txt`
settings row from `content/llms.txt`, and the search index. The `llms.txt` row is
**derived**, exactly like the post rows: the tracked file is the source of truth
and the row is overwritten from it on every sync, including over the stale seed
`0001_init.sql` leaves behind.

Then, optionally, the derived assets:

```sh
npm run build:og -- --remote           # social cards into R2
npm run build:diagrams                 # mermaid renders into public/diagrams
```

Finally, sign in to `/admin/posts` and press **Sync Ask corpus**.

---

## 10. Verify

```sh
node scripts/verify-live.mjs
```

The live sweep. It covers the public routes, the stylesheet asset and the search
surfaces. A healthy run on the current site is **92 passed, 0 failed**.

Poll a deploy to **stability, not to first success**: four consecutive fully green
rounds, every request cache-bypassed. A single failure straight after a deploy is
propagation, not a bug.

Then check by hand:

- `/` renders and the mark is brand-coloured in both themes
- `/blog` lists posts and page 2 exists
- `/search?q=cloudflare` returns results (D1, no AI involved)
- `/admin` redirects to Google and then admits only `ADMIN_EMAIL`
- `/media/<some key>?w=320` returns `image/webp` with `x-media-thumb: w=320`
- `/search/ask` answers, once the corpus is synced

---

## What is NOT recoverable from this repo

Rebuilding gives a working site. It does not give the same site. Be explicit about
the difference.

### Recovered, from markdown

**Posts, tags and the search index.** `content/posts/*.md` is the source of truth
and `content/generated/posts.json` is the gated artifact. `sync:content` rewrites
`posts`, `post_tags`, `posts_fts`, `search_docs` and both FTS5 indexes from it.
Live counts for comparison: 12 posts, 29 tags, 54 post-tag links, 93 search
records.

`updated_at` is derived from the last git commit touching each post file at sync
time, so it is recovered as long as git history is intact. `first_published` lives
in frontmatter and is recovered with the file.

**The `llms.txt` settings row.** Source of truth is `content/llms.txt`, tracked
and pinned to LF. `sync:content` writes the row from it and `check:llms` fails if
they disagree. Until 2026-08-02 this was a permanent loss, because the only
writer was a migration seeding copy retired in July; that is what prompted this
document's own gap analysis to be turned into a fix.

### Permanently lost

**R2 objects: NOTHING, as measured 2026-08-22.** This entry read "15 objects,
848 kB, in two groups" and named `posts/` editor uploads as not regenerable. Both
halves are now false. There are 12 objects, 505,712 bytes, all of them `og/`
social cards, and there is no `posts/` group: `dustinedwards-media` is empty and
the D1 index carries no `storage='r2'` row. The census and the four ways it was
read are in section 3.

The CLASS stays described here because it is the thing that will come back. An
editor upload would be not regenerable, would exist only in the bucket, and would
leave a post rendering a broken image while the markdown kept the URL. None exist
yet. When one does, this entry becomes true again and section 3's acceptance
stops holding.

**The `media` table rows** (alt text, captions, dimensions) go with the objects.
Alt already written into post markdown survives, because that copy lives in the
post; the record's copy, which pre-fills future insertions, does not.

**KV contents.** Sessions and cached Ask answers. Both regenerate on use, so this
is a loss without consequence: everyone signs in again.

**Auth tables.** `user`, `account`, `session`, `verification`. Live: 1 user, 1
account, 0 sessions. Better Auth recreates them on first sign-in, so this is also
a loss without consequence at single-admin scale.

**The Google OAuth client.** Client id, secret and the authorized redirect URI are
configuration in a Google Cloud project, not in this repo. A rebuild means
creating a new OAuth client and setting a new redirect URI. Nothing here records
which Google project the current one lives in.

**Resource ids.** By design. The D1 `database_id` and KV namespace `id` are not in
git, so a rebuild creates new resources with new ids. That is the intended
behaviour, not a gap.

**Deployed version history.** Every prior Worker version and the ability to roll
back to one. The code is in git; the deployment ledger is not.

---

## Verification status

Verified on 2026-08-02 against the live account or the installed toolchain
(`compatibility_date` was bumped to 2026-08-02 the same day):

- Resource names and existence: D1 `dustinedwards`, KV `dustinedwards-app-kv`,
  R2 `dustinedwards-media`, AI Search `dustinedwards`. Read from
  `wrangler d1 list`, `kv namespace list`, `r2 bucket list`, `ai-search get`.
- **Re-verified 2026-08-04 (finding B005):** R2 `dustinedwards-og` exists, the
  queues `dustinedwards-media-events` and `dustinedwards-media-events-dlq` exist,
  and both buckets carry one event notification rule each pointing at the first
  queue. Read from `wrangler queues list` and
  `wrangler r2 bucket notification list`. None of these were in this runbook.
- R2 public access disabled and no custom domains: `r2 bucket dev-url get` and
  `r2 bucket domain list`.
- Command syntax for `d1 create`, `kv namespace create`, `r2 bucket create`,
  `secret put`, `d1 migrations apply`, `deploy` and `types`: read from
  `--help` on the installed wrangler 4.107.0.
- `ai-search create` flags `--type builtin`, `--hybrid-search`, `--reranking`:
  read from `wrangler ai-search create --help` on the same version.
- Migrations reproduce the schema: **re-measured 2026-08-04** by applying all
  **ten** to an empty database with `node:sqlite` and diffing object by object
  against the live schema. **57 of 57 match**, nothing extra on either side. The
  previous entry said seven migrations and 37 objects and had gone stale in both.
- The seven secret names: `wrangler secret list`.
- **R2 contents, measured 2026-08-22**, four independent ways: `dustinedwards-media`
  is EMPTY and `dustinedwards-og` holds 12 regenerable OG cards. Section 3 carries
  the census, the reads behind it, and the acceptance that follows.
- **R2 has no versioning to enable**, checked against the R2 API surface
  2026-08-22; both buckets carry no lifecycle rule beyond the default
  multipart-abort and no lock rules.
- The `llms.txt` divergence, since FIXED: the live row was captured byte-exact
  into `content/llms.txt` and is now written by `sync:content` and gated by
  `check:llms`.
- Durable Object wiring: the config block, `workers/ask-budget.ts` and the
  re-export in `workers/app.ts`.
- Row counts: queried directly.

**Not verified, and why:**

- **No step here was executed end to end on a fresh account.** Every command was
  checked for syntax and every name for accuracy, but the sequence has not been
  rehearsed. The order in "Recovery order" is derived from the dependencies, not
  from a rebuild that was performed.
- **The AI Search dashboard steps** (Authorized hosts, the public endpoint, the
  API token for `ai-search create`) are recorded from `CLAUDE.md` and the
  dashboard's own layout. There is no CLI to confirm them against.
- **Whether the Images binding needs an Images subscription on a fresh account.**
  It works on this account, which already has whatever entitlement it needs. The
  Cloudflare documentation for the binding states a paid Images plan is required
  for hosted-image operations; the transform path used here may differ. Untested
  on an account without it.
- **Google Cloud Console menu paths** are from memory of that console, not
  verified this session.
- **`build:og` and `build:diagrams` as recovery steps** are listed from the
  project's own documented flow; they were not run during this session.
