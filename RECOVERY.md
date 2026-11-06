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
   operator API fail until `OPERATOR_TOKEN` exists, and /admin refuses every person
   until `ADMIN_EMAILS` exists (sign-in itself is the Access application, section 7).
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
npx wrangler r2 bucket create dustinedwards-media-revisions
npx wrangler r2 bucket create dustinedwards-backups
```

Bindings `MEDIA`, `OG`, `MEDIA_REVISIONS` and `BACKUPS`. No id is needed; a bucket is
referenced by name.

**The buckets are split on LIFECYCLE, not on what the UI calls them.**
`dustinedwards-media` is irreplaceable: it holds uploaded originals, and nothing
can regenerate them. `dustinedwards-og` holds social cards, every one of which
`build:og -- --remote` can rebuild from the artifact, so it is safe to empty and
is deliberately not in the backup path. A missing bucket is a Worker that fails
to bind at deploy.

`dustinedwards-media-revisions` is the REVISION STORE: every earlier set of a
file's bytes, kept under `replaced/<time>/<key>` (or `resized/<time>/<key>` for
an upload the library shrank) before a replace, turn or revert overwrites it, and
read back by a revert. It is application data, irreplaceable like `MEDIA`, and
**no site code path ever deletes from it**; `check:destructive` sweeps `app/`,
`workers/` and `scripts/` and fails on a delete against the `MEDIA_REVISIONS`
binding.

**Do not enable public access, and do not attach a custom domain.** `r2.dev`
public access is **disabled** and there are **no custom domains connected**
(`r2 bucket dev-url get`, `r2 bucket domain list`). Every object is served through the
Worker's `/media/*` route, which is what allows the thumbnail transforms and the
immutable cache headers. Enabling public access would create a second, unmanaged
read path to the same bytes.

Live buckets for reference: `dustinedwards-media` is location `ENAM`,
`dustinedwards-og` is location `WNAM`, both storage class `Standard`.

### Backup posture: the network's files backup, copied to Amazon

**The same backup every site with media has** (d1-dump `backupFiles`).

- **Nightly, in BACKUPS.** The site cron's `media-backup` job, at the 05:00 UTC
  firing beside the D1 dump (app/lib/backup/d1-backup.server.ts), copies `MEDIA`
  to `files/media/<key>` and `MEDIA_REVISIONS` to `files/revisions/<key>` in
  `dustinedwards-backups`. A pass copies only new and changed objects (it
  compares etags), stops at 1,000 writes or five minutes, and the next night
  goes on from where it stopped. A copy whose source is gone is kept 30 days,
  then removed. `backup_media` on the operator API (`dei_backup_media`) runs the
  same pass by hand.
- **Off the account, nightly.** capsid-backups' `offaccount.yml` (11:23 UTC)
  syncs all of `files/` to `files/dustinedwards/` in the Amazon S3 backup
  bucket. Its writer can add files and place a delete marker but never remove a
  version, and a removed or replaced file's old version stays 90 days. So a file
  this site deletes, whether by the OG prune, the media delete action or the
  R2-wins reconciliation, can be brought back for 90 days.
- **Watched.** `/health`'s `backup` field carries `files.media` and
  `files.revisions` beside the dump's age, and warns past 26 hours. Capsid's
  watcher alerts on a stale Amazon copy. A complete pass compared every object
  in the bucket with its copy, and devkit's weekly restore drill restores a
  sample of the copies and checks their bytes.
- **Never the reverse by code.** Nothing copies the backup back to media. A
  restore is a deliberate `restoreFiles` (a dry run unless `apply` is set, and it
  never overwrites a file that differs unless told to), or the wrangler
  get-and-put in the d1-dump README.

The `check:backup --remote` local pull stays a third copy, on the seat.

### The backups bucket

`dustinedwards-backups` (`BACKUPS`) holds the nightly D1 dumps, created 2026-10-11 with
`npx wrangler r2 bucket create dustinedwards-backups`, and the files backups above. The dumps
are pruned by retention and the files copies by backupFiles' 30-day rule; `check:destructive`
lets only the d1-dump functions touch the bucket. The runbook (docs/RUNBOOK.md, 4-pre) has the
schedule, the health fields and the restore.

#### The rest of R2

Every class of thing this site stores, and where its second copy is:

| Class | Where it lives | Second copy |
| --- | --- | --- |
| Uploaded originals | `dustinedwards-media` (`MEDIA`) | **backed up nightly**: `files/media/` in `dustinedwards-backups`, then Amazon S3; plus the local pull from `check:backup --remote`. The age lives in `/health` `backup.files.media` |
| Earlier file versions | `dustinedwards-media-revisions` (`MEDIA_REVISIONS`) | **backed up nightly**: `files/revisions/` in `dustinedwards-backups`, then Amazon S3. The age lives in `/health` `backup.files.revisions` |
| Social cards | `dustinedwards-og` (`OG`), all under `og/` | **regenerable**: `npm run build:og -- --remote` |
| Static assets | `public/`, not R2 at all | **git** |
| Roster photo WebPs | the media library (`dustinedwards-media`, `MEDIA`) | **backed up nightly** with the other media |

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
4. **Uploaded originals and earlier versions**: `restoreFiles` from `files/media/` into `MEDIA` and
   from `files/revisions/` into `MEDIA_REVISIONS` (d1-dump README, Restore files), or, with the
   account gone, from the Amazon copy's `files/dustinedwards/`; then let `media-index-drift` confirm.

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
7), sign in to `/admin/tools` and press **Rebuild the answer index**. That uploads every
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

It powers `/media/<key>?w=<width>` (the closed set in `app/lib/media/images.mjs`), which transforms the single original in R2
on request and stores no variants. It is the **binding** rather than the
`/cdn-cgi/image/` URL syntax because the URL interface needs a customer zone:
measured 2026-08-02, it answers 404 with Cloudflare error 1042 on `workers.dev`.
The binding is account-scoped and works without a zone.

If the binding is absent the thumbnail route falls back to serving the full
original and says so in an `x-image: unavailable-no-images-binding` header,
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

`/admin` is guarded by a Cloudflare Access application, and the Worker verifies the signed token Access
attaches and checks its email against the `ADMIN_EMAILS` secret (`app/lib/access.server.ts`). To recreate
it on a new account:

1. Zero Trust > Access > Applications > Add > Self-hosted. Name `dustinedwards-login`. Destinations
   `<domain>/admin` and `<domain>/admin/*`.
2. A policy (`dustinedwards-admin`) with action Allow and Include: Emails, one per administrator, the
   same people as `ADMIN_EMAILS` (`npx wrangler secret put ADMIN_EMAILS`, comma-separated).
3. Copy the application's AUD tag and the team domain (`<team>.cloudflareaccess.com`) into the
   `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` vars in `wrangler.jsonc` (and the example), then deploy.

Neither value is a credential. If the application is lost, the site is still safe: with no valid Access
token the admin refuses everyone, except the read-only smoke bearer. See docs/RUNBOOK.md 5b.

---

## 8. Deploy

A merge to main deploys: once CI passes, `.github/workflows/deploy.yml` runs
devkit's worker-deploy (D1 bookmark, pre-deploy guard, deploy, live gate,
rollback), then its converge job (`scripts/converge.mjs`) and the admin MCP.
`gh workflow run deploy.yml --ref main` runs it by hand. Never run `npm run
deploy` or bare `wrangler deploy`: they skip the live gate and the converge job,
and `.claude/hooks/no-direct-deploy.sh` refuses both in a session. On a rebuilt
account where the workflow cannot pass yet (no CI run, no secrets), stop: how
the first deploy goes is Dustin's decision.

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

Finally, sign in to `/admin/tools` and press **Rebuild the answer index**.

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
- `/admin` redirects to the Cloudflare Access login and then admits only the people in its policy and `ADMIN_EMAILS`
- `/media/<some key>?w=320` returns `image/webp` with `x-image: w=320 webp`
- `/search/ask` answers, once the corpus is synced

---

## 11. Alerting: Capsid's watcher and the uptime monitors email Dustin

Ruling 151. A failing check needs a path to a person, or it is found by a badge
on a page somebody happened to open. Three paths exist, and each reaches
Dustin's inbox by email:

- **Capsid's watcher** (capsid `src/site-watch.ts`, every five minutes, inside
  Cloudflare but in another Worker), the same for every site in the network.
  It reads `/health`, runs the repairs this site's `ops_sites.operator` row maps
  (sync_* tools in repair order, posts first and the Ask upload last), re-reads, and opens the
  finding `site-health-dustinedwards` in the Portal when the site is still
  unhealthy. It mails Dustin once when health goes red and once when it
  recovers, never per pass. It also watches the Worker's error rate (more than 1
  percent of an hour's requests, over at least 100) and runs the weekly
  `refresh_citations`. The dustinedwards-watchdog Worker that did this here was
  retired on 2026-11-06.
- **The external uptime monitors** (UptimeRobot, `scripts/uptime-monitors.json`,
  reconciled by every local ship; a ship on a GitHub runner, which holds no
  `UPTIMEROBOT_API_KEY` by design, records the step as SKIPPED, leaves the
  monitors where they were, and does not end red; they are reconciled at the
  domain move by hand or by a local ship. A local ship missing the key is a
  MISS). Two monitors, the home page and `/health`,
  from OUTSIDE Cloudflare. `/health` answers 503 only when
  D1 does not answer and reports drift as a warning, so the second monitor pages
  for an outage, not for drift the watcher repairs; it keys on `"ok":true`. They mail the account's active email contact once on down and once on
  up; `uptime-ensure` refuses to create a monitor with no such contact.
- **The browser test** (`.github/workflows/browser.yml`), started by ship after
  every deploy and weekly as a backstop. A failed run emails the account that
  started it.

The site's own cron (`workers/app.ts`, `app/lib/cron-jobs.mjs`) runs what is
the site's alone: the colophon's health snapshot every fifteen minutes, the
zero-result purge daily and the publication check daily, which mails each new
DOI once to the `ALERT_EMAIL` secret through the `EMAIL` binding. Each job is
recorded in `cron_runs`, and `/health`'s cron check warns when one fails or
stops, which the watcher then reports.

The checks and their order are owned by `runHealthChecks` in
`app/lib/health/checks.server.ts`; this paragraph points at it rather than
restating a list. What is stable enough to state: it covers
the Ask index, the media index, the corpus against
git, and the FTS docsize equalities a ship asserts after a sync. Each is
individually timed out, so one wedged binding cannot hang the response. The body carries check NAMES and BOOLEANS
only; the numbers behind a failure are in Workers Logs, because the endpoint is
unauthenticated.

**Why a watcher outside the site Worker.** A watcher that runs inside the thing
it watches dies with it, and its silence then looks exactly like health. Capsid's
watcher is a separate Worker, and the uptime monitors are outside Cloudflare
entirely, so a broken site Worker is still reported.

### WHAT IT DOES NOT COVER

Read this before treating a quiet inbox as good news.

- **A watcher that stops firing is silent here.** Capsid's Portal shows when its
  last pass ran; `verify-live` checks the colophon's health verdict is under two
  snapshot intervals old. The uptime monitors still cover an outage.
- **An email the provider fails to deliver is silent.** A send that errors is
  retried, but a message accepted and then lost is not seen.
- **The health checks see no reader.** A page that renders wrongly but returns
  200 passes them. That is the browser test and `verify-live`.
- **Nothing here sees the bill.**
- **Between polls it sees nothing.** Worst case five minutes for the watcher,
  the monitor interval for UptimeRobot.

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

**R2 objects.** An uploaded original is lost only if `MEDIA`, its copy under
`files/media/` in `dustinedwards-backups`, the Amazon copy and the local pull all lose it
(section 3); a file deleted on purpose stays in the Amazon copy 90 days. OG cards
regenerate. An editor upload that is lost would leave a post rendering a broken
image while the markdown kept the URL.

**The `media` table rows** (alt text, captions, dimensions) go with the objects.
Alt already written into post markdown survives, because that copy lives in the
post; the record's copy, which pre-fills future insertions, does not.

**KV contents.** Cached Ask answers, the health snapshot and small counters. All
regenerate on use, so this is a loss without consequence.

**The Access application and its policy.** Account configuration, not in this repo.
The team domain and AUD tag are in `wrangler.jsonc`, and the administrator emails are
the `ADMIN_EMAILS` secret as well as the policy. Recreate it as in section 7.

**Resource ids.** By design. The D1 `database_id` and KV namespace `id` are not in
git, so a rebuild creates new resources with new ids. That is the intended
behavior, not a gap.

**Deployed version history.** Every prior Worker version and the ability to roll
back to one. The code is in git; the deployment ledger is not.

---

## Verification status

Checked against the live account or the installed toolchain, not rehearsed:

- Resource names and existence: D1 `dustinedwards`, KV `dustinedwards-app-kv`,
  R2 `dustinedwards-media`, `dustinedwards-og`, `dustinedwards-media-revisions` and
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
