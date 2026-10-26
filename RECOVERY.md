# RECOVERY.md

How to rebuild this site's Cloudflare resources from nothing, given only this
repository and a fresh Cloudflare account.

This document exists because there is no infrastructure-as-code here.
**Terraform was considered and rejected**: it would mean restating `compatibility_date` and every binding in a
second file, which recreates exactly the drift class the example config exists
to avoid, and its real value (multi-person orgs, DNS, account access management)
does not apply to a single-operator account. The gap Terraform would have covered
is documentation. This is that documentation.

The verification status of each part is recorded at the bottom. A runbook
describes an account rather than the disk every gate verifies, so nothing here
is gated: re-measure rather than cite.

---

## Before you start

You need: the repo, a Cloudflare account, and a GitHub account with access to this repo.

```sh
npm ci               # postinstall copies wrangler.jsonc.example into place
npx wrangler login
```

**`npm ci`, NOT `npm install`, and this line was the audit's one real supply-chain
finding.** Section 7 says "a compromised patch release of any of them reaches
production on the next `npm ci`", which is false as written: `npm ci` installs
the exact tree in `package-lock.json` and never re-resolves a range. What was
true is that THIS runbook said `npm install`, which does re-resolve, so the one
documented path a new engineer follows was the one path where a fresh malicious
patch inside an existing `^` range would be picked up. CI already used `npm ci`.

`npm ci` runs `devkit-bootstrap`, which copies
`wrangler.jsonc.example` to `wrangler.jsonc` if and only if no config exists. It
never overwrites. The copy carries **placeholder resource ids**, so it is enough
to typecheck and deliberately not enough to deploy. You will replace two of those
ids below.

**Real resource ids never go in git**. `wrangler.jsonc` is gitignored; the tracked
`wrangler.jsonc.example` differs from it in exactly two values, and the example
never carries a real id.

---

## Recovery order

The order matters. Each step below names what breaks if it is done early.

1. **D1 database** and **KV namespace** and **R2 bucket**. Independent of each
   other. Their ids go into `wrangler.jsonc`.
2. **AI Search instance.** Independent of the above, but its corpus cannot be
   populated until D1 has content, so create it here and fill it at step 8.
3. **`wrangler types`.** Regenerates `worker-configuration.d.ts` from the config.
   *If skipped:* the typecheck fails against bindings it does not know about, and
   the deploy would ship a build that was never type-checked.
4. **D1 migrations.** *If run before step 1:* there is no database to apply to.
   *If skipped:* the first request that touches a table 500s.
5. **Secrets.** *If set after deploy:* the Worker serves, but the editor and the
   operator API fail until `OPERATOR_TOKEN` exists. Admin
   sign-in is not a secret: it is the Access application (section 7).
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

**The migrations reproduce the live schema.** `check:migrations` hashes every
file in `drizzle/` against the manifest in both directions, and
`test/schema-invariants.test.mjs` binds schema to migrations to the live database
(with `SCHEMA_LIVE=1`), so no count is written here.

The live database carries three additional objects created by the D1 platform
itself rather than by any migration: the tables `d1_migrations` and `_cf_KV`,
and `sqlite_autoindex_d1_migrations_1`, the auto-index SQLite creates for the
former's primary key. Excluding the two tables but not that index turns a clean
match into a spurious one-object mismatch.

`drizzle-kit` is deliberately not a dependency. Migrations are hand-written. Add a
new numbered file; never edit an applied one.

`0001_init.sql` seeds a stale `settings` row for `llms.txt`. The source of truth
is the tracked file `content/llms.txt`; `sync:content` writes the row from it, so
the seed is overwritten by step 9 below, and `check:machine-readable` fails if the
two ever disagree.

---

## 2. KV namespace

```sh
npx wrangler kv namespace create "dustinedwards-app-kv"
```

Put the returned `id` into `wrangler.jsonc` under `kv_namespaces[0]`. Binding
`APP_KV`. It holds the Ask answer cache, the health snapshot, draft preview
tokens and a few small counters. All are regenerated or reissued on use, so an
empty namespace is a correct starting state.

---

## 3. R2 buckets

```sh
npx wrangler r2 bucket create dustinedwards-media
npx wrangler r2 bucket create dustinedwards-og
npx wrangler r2 bucket create dustinedwards-media-backup
```

Bindings `MEDIA`, `OG` and `MEDIA_BACKUP`. No id is needed; a bucket is
referenced by name.

**There are THREE buckets and they are split on LIFECYCLE, not on what the UI
calls them.** `dustinedwards-media` is irreplaceable: it holds uploaded
originals, and nothing can regenerate them. `dustinedwards-og` holds social
cards, every one of which `build:og -- --remote` can rebuild from the artifact,
so it is safe to empty and is deliberately not in the backup path. A missing
bucket is a Worker that fails to bind at deploy.

`dustinedwards-media-backup` is the MIRROR of the first. It is
written only by copy, and **no site code path ever deletes from it**;
`check:destructive` sweeps `app/`, `workers/` and `scripts/` and fails on a
delete against the `MEDIA_BACKUP` binding. Restoring it is never necessary to
bring the site up: it is a source for a hand-copy back into `MEDIA`, not a thing
the Worker reads.

**Do not enable public access, and do not attach a custom domain.** `r2.dev`
public access is **disabled** and there are **no custom domains connected**
(`r2 bucket dev-url get`, `r2 bucket domain list`). Every object is served through the
Worker's `/media/*` route, which is what allows the thumbnail transforms and the
immutable cache headers. Enabling public access would create a second, unmanaged
read path to the same bytes.

Live buckets for reference: `dustinedwards-media` is location `ENAM`,
`dustinedwards-og` is location `WNAM`, both storage class `Standard`.

### Backup posture: the media bucket is mirrored

**A mirror, plus a local pull.** The alternatives weighed are in git history for this file.

#### What actually threatens these bytes, in the ruled order

1. **The site's own code.** The OG prune, the media delete action and the
   R2-wins reconciliation can each remove an object with no undo. This is the
   realistic loss, and the same-account mirror covers it completely.
2. **Account loss or compromise.** A second bucket in the same account is worth
   nothing here. The answer is `check:backup --remote`, which pulls every
   `MEDIA` object to the local backup root beside the D1 table exports. That is
   the only copy outside the account.
3. **Cloudflare losing an object.** Least likely of the three, and covered by
   the same local pull.

#### How the mirror is kept

- **On write.** R2 emits an object-create notification, the queue consumer
  derives the D1 row and the TWIN as well, from the
  object as it is now. This keeps the never-a-dual-write rule: the Worker still
  writes only to `MEDIA`.
- **On drift.** `media-backup-drift` in `/api/health` compares every `MEDIA`
  object against its twin and reports `objects`, `twins` and `missing`, so zero
  missing cannot be mistaken for zero examined. The watchdog cron polls that
  endpoint every fifteen minutes and self-repairs the class through
  `backup_media` on the operator API, which is why a lost queue message
  converges instead of leaving a hole nobody sees.
- **Never the reverse.** Nothing copies backup to media by code. A stale mirror
  overwriting a live object is the one way a backup can destroy what it exists
  to protect, so restoring from it is a deliberate hand-copy.
- **Deleting a media object leaves its twin.** That is the point rather than an
  oversight, and it is why pruning the mirror is a human act.

### The D1 dump bucket

`dustinedwards-backups` (`BACKUPS`) holds the nightly D1 dumps, created 2026-10-11 with
`npx wrangler r2 bucket create dustinedwards-backups`. It is not the media mirror: the dumps are
pruned by retention, the mirror is never deleted from, and `check:destructive` holds both rules.
The runbook (docs/RUNBOOK.md, 4-pre) has the schedule, the health fields and the restore.

#### Comparison rule

Byte identity is judged by **etag, corroborated by size**. For a single-part R2
object the etag is the MD5 of the stored bytes, and the upload route caps an
upload at 10 MB, so nothing here is multipart. Size alone cannot see a
same-length corruption, which is exactly the case a mirror is for; a full hash
would mean reading every object body on every health poll. If a multipart etag
ever appears the comparison degrades to size and says so, so a weaker verdict is
never mistaken for the strong one.

#### The rest of R2

Every class of thing this site stores, and where its second copy is:

| Class | Where it lives | Second copy |
| --- | --- | --- |
| Uploaded originals | `dustinedwards-media` (`MEDIA`) | **mirrored**: a twin in `dustinedwards-media-backup`, plus the local pull from `check:backup --remote`. The count lives in `media-backup-drift` |
| Social cards | `dustinedwards-og` (`OG`), all under `og/` | **regenerable**: `npm run build:og -- --remote` |
| Static assets | `public/`, not R2 at all | **git** |
| Roster photo WebPs | `public/phage-hunters/` | **git** |
| Roster photo JPG SOURCES | gitignored, would be `public/phage-hunters/*.jpg` | **nowhere, if any existed** |

The last row is the one to watch: `.gitignore` excludes those sources, so a JPG
dropped there would exist on one machine and in no clone.

The OG cards are regenerable in the strong sense: the object key is a hash of the
template version, slug, title and description, all tracked in `content/`, so a
rebuild writes the SAME keys rather than new ones beside the old.

**R2 has no object versioning** (the R2 API has no versioning endpoint at all),
so no plan can rest on it. A bucket lock is the mechanism if retention is ever
wanted, and it protects against DELETION, never against loss of the account.

### What restoring actually involves

In the order it would be done, and none of it is a restore from a backup:

1. **Static assets** (`public/`): `git clone`.
2. **OG cards**: `npm run build:og -- --remote`, after step 9's
   content sync, because it renders from the artifact.
3. **The `media` index rows**: rebuilt from R2 and `public/`, then compared by
   the health endpoint's `media-index-drift` check, which would report any of the
   above being incomplete.
4. **Uploaded originals**: a deliberate hand-copy from `dustinedwards-media-backup`
   (or the local pull) back into `MEDIA`, then let `media-index-drift` confirm.

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

## 3b. Webmention verification queue

**Without this the Worker does not deploy**, because the `WEBMENTION_VERIFY`
producer names a queue that must exist. `/webmention` writes the `unverified` row,
answers 202 and sends the row id here; the consumer fetches the source and records
the verdict, 3 attempts and then the DLQ. Nothing else feeds it.

```sh
npx wrangler queues create dustinedwards-webmention-verify
npx wrangler queues create dustinedwards-webmention-verify-dlq
```

Consumer settings live in `wrangler.jsonc`, from the example file. A dead letter
is a row left `unverified`, visible in /admin/mentions; the sender re-sending the
webmention resets the row and queues it again.

---

## 4. AI Search instance

```sh
npx wrangler ai-search create dustinedwards --type builtin --hybrid-search --reranking
```

Binding `AI_SEARCH`, `instance_name` `dustinedwards`. Flags confirmed against
`wrangler ai-search create --help` on wrangler 4.107.0.

`--type builtin` is load-bearing and not a default worth changing. The crawler
type would index the live domain instead (a **domain onboarded to this
account**), not the repository's content. Built-in storage also indexes on
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
`publishableForAsk()` is the gate and `check:ask-guards` covers it.

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

By name only. Never commit values; never paste one into chat.

**THE LIST IS `REQUIRED_SECRETS` in `app/lib/secrets.mjs`, and no count is
written here on purpose**: `check:secrets` reads the array, and a prose count
reads nothing. Set one `wrangler secret put` per name in that array:

```sh
npx wrangler secret put OPERATOR_TOKEN
npx wrangler secret put SMOKE_TOKEN
```

| Secret | What it is for | Where a new one comes from |
| --- | --- | --- |
| `OPERATOR_TOKEN` | Bearer token for `POST /api/operator` | Generate one, minimum 32 characters. Compared in constant time after hashing, so neither contents nor length leak |
| `SMOKE_TOKEN` | Bearer token for the READ-ONLY smoke credential `check:browser` renders `/admin/*` with | `node scripts/mint-smoke-token.mjs`, piped straight into `wrangler secret put`. Absent, the admin cases of `check:browser` fail and say so. Revocable on its own: `wrangler secret delete SMOKE_TOKEN` ends it and touches nothing else |

**No secret has ever lived in `wrangler.jsonc`.** Until `SMOKE_TOKEN` is set the
tools page reports it absent.

**MINTING AND SETTING THE SMOKE TOKEN, in full.** It goes to three places and
never onto a command line; every one of these reads stdin:

```sh
node scripts/mint-smoke-token.mjs > .smoke-token   # gitignored, 64 chars, one line
npx wrangler secret put SMOKE_TOKEN < .smoke-token # the deployed Worker
gh secret set SMOKE_TOKEN < .smoke-token           # CI, so the browser gate runs unattended
```

Then `SMOKE_TOKEN_FILE=.smoke-token` in the shell that runs `check:browser`, or
leave the file at the repo root where the gate looks for it by default.

There is no AI Search secret and none is needed. The Worker reaches the instance
through the binding. An AI Search API token is required only by
`wrangler ai-search create`, a control-plane call, and is minted in the dashboard
at **AI > AI Search > Tokens**. Without one, that create command refuses even
though the CLI otherwise looks authenticated.

**There is no `.dev.vars` in this repo.** A local `npm run dev` therefore has zero
secrets. `vite dev` on localhost is admitted to `/admin` as `dev@localhost`
without Access (a development build on a localhost host only), so admin work
needs no secret. Saving writes the local D1 source, so the editor needs none either. `.dev.vars` stays gitignored, always.

### Admin sign-in (Cloudflare Access)

There is no sign-in secret. `/admin` is guarded by a Cloudflare Access application, and the Worker
verifies the signed token Access attaches (`app/lib/access.server.ts`). To recreate it on a new account:

1. Zero Trust > Access > Applications > Add > Self-hosted. Name `dustinedwards-login`. Destinations
   `<domain>/admin` and `<domain>/admin/*`.
2. A policy (`dustinedwards-admin`) with action Allow and Include: Emails, one per administrator. That
   policy is the only list of who may administer the site.
3. Copy the application's AUD tag and the team domain (`<team>.cloudflareaccess.com`) into the
   `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` vars in `wrangler.jsonc` (and the example), then deploy.

Neither value is a credential. If the application is lost, the site is still safe: with no valid Access
token the admin refuses everyone, except the read-only smoke bearer. See docs/RUNBOOK.md 5b.

---

## 8. Deploy

`npm run typecheck`, then `npm run ship`, run by Dustin once CI is green for that
exact sha. After a merge to main,
`.github/workflows/deploy.yml` runs the same ship. Only `npm run ship` deploys;
never run `npm run deploy` by hand (ship runs it) or bare `wrangler deploy`:
they skip ship's refusals, and `.claude/hooks/no-direct-deploy.sh` refuses both
in a session. On a rebuilt account where ship cannot pass yet (no CI run, no
token file), stop: how the first deploy goes is Dustin's decision.

---

## 9. Content and search

```sh
npm run build:content                  # regenerate the artifact from content/posts
npm run check:content                  # gate: every post validates
npm run sync:content -- --remote       # posts, the llms.txt row, both FTS indexes
npm run check:machine-readable -- --remote  # gate: the row must match content/llms.txt
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

- `/` renders and the mark is brand-colored in both themes
- `/blog` lists posts and page 2 exists
- `/search?q=cloudflare` returns results (D1, no AI involved)
- `/admin` redirects to the Cloudflare Access login and then admits only the people in its policy
- `/media/<some key>?w=320` returns `image/webp` with `x-media-thumb: w=320`
- `/search/ask` answers, once the corpus is synced

---

## 11. Alerting: the watchdog and the uptime monitors email Dustin

Ruling 151. A failing check needs a path to a person, or it is found by a badge
on a page somebody happened to open. Three paths exist, and each reaches
Dustin's inbox by email:

- **The watchdog Worker** (`workers/watchdog.ts`, every 15 minutes, inside
  Cloudflare). It reads `/api/health` through a service binding, runs the
  repairs `app/lib/health/repair.mjs` allows, re-reads, and also reads the site
  Worker's error rate. It mails `ALERT_EMAIL` through Cloudflare Email Sending
  ONCE when health goes red and once when it recovers, never per firing. The
  mail is sent before the state that suppresses the next one is stored, so a
  failed send is retried on the next firing, and the firing records as failed.
- **The external uptime monitors** (UptimeRobot, `scripts/uptime-monitors.json`,
  reconciled by every local ship; a ship on a GitHub runner, which holds no
  `UPTIMEROBOT_API_KEY` by design, records the step as SKIPPED, leaves the
  monitors where they were, and does not end red; they are reconciled at the
  domain move by hand or by a local ship. A local ship missing the key is a
  MISS). Two monitors, the home page and `/api/health`,
  from OUTSIDE Cloudflare, which the watchdog cannot be (a Worker cannot make an
  ordinary request to a Worker on its own zone). `/api/health` answers 503 when
  any check fails, so the second monitor catches a failing check as well as an
  outage. They mail the account's active email contact once on down and once on
  up; `uptime-ensure` refuses to create a monitor with no such contact.
- **The browser test** (`.github/workflows/browser.yml`), started by ship after
  every deploy and weekly as a backstop. A failed run emails the account that
  started it.

The checks and their order are owned by `runHealthChecks` in
`app/lib/health/checks.server.ts`; this paragraph points at it rather than
restating a list. What is stable enough to state: it covers
the Ask index, the media index, the media MIRROR (section 3), the corpus against
git, and the FTS docsize equalities a ship asserts after a sync. Each is
individually timed out, so one wedged binding cannot hang the response. The body carries check NAMES and BOOLEANS
only; the numbers behind a failure are in Workers Logs, because the endpoint is
unauthenticated.

**Why a watcher outside the site Worker.** A watcher that runs inside the thing
it watches dies with it, and its silence then looks exactly like health. The
watchdog is a separate Worker, and the uptime monitors are outside Cloudflare
entirely, so a broken site Worker is still reported.

### WHAT IT DOES NOT COVER

Read this before treating a quiet inbox as good news.

- **A watchdog that stops firing is silent.** `verify-live` checks the home
  page's health verdict is under two poll intervals old; nothing checks it
  between deploys. The uptime monitors still cover an outage in that case.
- **An email the provider fails to deliver is silent.** The watchdog retries a
  send that errors, but a message accepted and then lost is not seen.
- **The health checks see no reader.** A page that renders wrongly but returns
  200 passes them. That is the browser test and `verify-live`.
- **Nothing here sees the bill.**
- **Between polls it sees nothing.** Worst case fifteen minutes for the
  watchdog, the monitor interval for UptimeRobot.

### Removed alerting secrets

`ALERT_WEBHOOK_URL` and `ALERT_HEARTBEAT_URL` were never set and are not in
`REQUIRED_SECRETS`. If `wrangler secret list` ever shows either, delete it:

```sh
npx wrangler secret delete ALERT_WEBHOOK_URL
npx wrangler secret delete ALERT_HEARTBEAT_URL
```

---

## What is NOT recoverable from this repo

Rebuilding gives a working site. It does not give the same site. Be explicit about
the difference.

### Recovered, from markdown

**Posts, tags and the search index.** `content/posts/*.md` is the source of
truth and the only committed form; `content/generated/posts.json` is a
gitignored local build product `build:content` writes. `sync:content` rewrites
`posts`, `post_tags`, `posts_fts`, `search_docs` and both FTS5 indexes from it
(run `build:content` first). Inside the Worker the same rebuild is
`regenerateAllFromRepo`, reachable as the admin's "Regenerate all" and as
`sync_posts` on the operator API: one Contents directory listing, then every
post re-rendered through the one door to a rendered row.
Live counts for comparison: 12 posts, 29 tags, 54 post-tag links, 93 search
records.

`updated_at` is derived from the last git commit touching each post file at sync
time, so it is recovered as long as git history is intact. `first_published` lives
in frontmatter and is recovered with the file.

**The `llms.txt` settings row.** Source of truth is `content/llms.txt`, tracked
and pinned to LF. `sync:content` writes the row from it and `check:machine-readable` fails if
they disagree.

### Permanently lost

**R2 objects.** An uploaded original is lost only if `MEDIA`, its twin in
`dustinedwards-media-backup` and the local pull all lose it (section 3). OG cards
regenerate. An editor upload that is lost would leave a post rendering a broken
image while the markdown kept the URL.

**The `media` table rows** (alt text, captions, dimensions) go with the objects.
Alt already written into post markdown survives, because that copy lives in the
post; the record's copy, which pre-fills future insertions, does not.

**KV contents.** Cached Ask answers, the health snapshot, draft preview tokens and
small counters. All regenerate or are reissued on use, so this is a loss without
consequence (an outstanding draft preview link stops working).

**The Access application and its policy.** Account configuration, not in this repo.
The team domain and AUD tag are in `wrangler.jsonc`, but the list of administrator
emails lives only in the policy. Recreate it as in section 7.

**Resource ids.** By design. The D1 `database_id` and KV namespace `id` are not in
git, so a rebuild creates new resources with new ids. That is the intended
behavior, not a gap.

**Deployed version history.** Every prior Worker version and the ability to roll
back to one. The code is in git; the deployment ledger is not.

---

## Verification status

Checked against the live account or the installed toolchain, not rehearsed:

- Resource names and existence: D1 `dustinedwards`, KV `dustinedwards-app-kv`,
  R2 `dustinedwards-media`, `dustinedwards-og`, `dustinedwards-media-backup` and
  `dustinedwards-backups`, AI Search `dustinedwards`, and the queues
  `dustinedwards-media-events` and `dustinedwards-media-events-dlq` with each
  bucket's event notification rule. Read from `wrangler d1 list`,
  `kv namespace list`, `r2 bucket list`, `queues list`,
  `r2 bucket notification list` and `ai-search get`.
- Command syntax: read from `--help` on the installed wrangler.
- Migrations reproduce the schema: the schema test compares them with the live
  database under `SCHEMA_LIVE=1` (`check:all`).
- The secret names: `check:secrets` holds `REQUIRED_SECRETS` against the code.
- Durable Object wiring: the config block, `workers/ask-budget.ts` and the
  re-export in `workers/app.ts`.

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
- **`build:og` and `build:diagrams` as recovery steps** are listed from the
  project's own documented flow, not run as part of a rebuild.
