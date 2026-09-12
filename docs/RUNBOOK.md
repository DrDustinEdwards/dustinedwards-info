# RUNBOOK.md

For Dustin, alone, at 2am. Plain words, exact commands, no reading required
first. Every command runs in PowerShell from the repo root.

**This is not RECOVERY.md.** That one rebuilds the whole account from nothing
and takes an afternoon. This one gets a broken site working again and takes
minutes. If the account itself is gone, stop reading this and open RECOVERY.md.

**A number in this file is a pointer, never a value.** Counts, secret lists and
gate results live in the code that measures them, and are named here so you can
run the thing rather than trust a sentence someone wrote months ago.

---

## 0. First, thirty seconds

```powershell
curl.exe -s https://dustinedwards.dustin-edwards.workers.dev/api/health
```

`{"ok":true,...}` means the Worker is up and every check passed. Anything else,
read the `checks` array: the failing check names itself. A 503 with
`{"ok":false}` is the site telling you what is wrong, which is better than
silence. No response at all is section 1.

---

## 1. The site is down

In this order. Stop at the first one that explains it.

**1. Is it just you?** Open the URL on your phone on cell data. If it loads,
the problem is your network or DNS cache, not the site.

**2. Is Cloudflare down?** <https://www.cloudflarestatus.com>. If Workers or D1
is degraded in your region, there is nothing to fix here. Wait, and say so in
the incident note.

**3. Is the Worker deployed and healthy?**

```powershell
npx wrangler deployments status
npx wrangler versions list
```

If the newest version is not the one you expect, go to section 2.

**4. Is it throwing?** Section 6 has the logs. Look at the last five minutes.

**5. Is it D1?**

```powershell
npx wrangler d1 info dustinedwards
npx wrangler d1 execute dustinedwards --remote --command "SELECT COUNT(*) FROM posts"
```

A D1 that answers is not the problem. A D1 that refuses is section 4.

**6. Is it the data rather than the code?** If pages render but the content is
wrong, missing or stale, that is drift, not an outage: section 3.

---

## 2. Roll back a deploy

The fastest fix there is. It takes about fifteen seconds and needs no build.

```powershell
npx wrangler versions list
npx wrangler rollback <VERSION-ID> --message "2am rollback, <one line why>"
```

`<VERSION-ID>` is the version you want to go BACK to, not the broken one.
`versions list` prints them newest first, so it is usually the second row.

Then check the site is actually better:

```powershell
curl.exe -s https://dustinedwards.dustin-edwards.workers.dev/api/health
```

**Rollback can refuse, and the reason is not obvious.** If a secret was changed
after that version was deployed, wrangler refuses with error 10220 rather than
silently reverting the secret too. Deploy forward instead, or use
`npx wrangler versions secret put <NAME>`, which changes a secret without a
deploy.

**Rolling back does not change the repo.** The code that broke it is still on
`main` and the next `npm run ship` will put it back. So once the site is stable,
revert it for real:

```powershell
git log --oneline -5
git revert <SHA>
git push
```

Then ship normally when you are awake. Do not ship at 2am.

---

## 3. Rebuild D1 from git

Use this when the CONTENT is wrong: a post missing, a stale render, search
returning nothing. D1 is a derived store (hard rule 18); the repository is the
source, so rebuilding is safe and repeatable rather than a last resort.

**First, just ask it to converge.** The health check does this by itself every
fifteen minutes, so if content drift is the problem it may already be repairing:

```powershell
curl.exe -s https://dustinedwards.dustin-edwards.workers.dev/api/health
```

Look for `content-drift` in the `checks` array.

**To force it now**, through the operator door, which is the only door:

```powershell
$token = Get-Content $env:OPERATOR_TOKEN_FILE -Raw
curl.exe -s -X POST https://dustinedwards.dustin-edwards.workers.dev/api/operator `
  -H "Authorization: Bearer $($token.Trim())" `
  -H "Content-Type: application/json" `
  -d '{\"tool\":\"sync_posts\",\"args\":{}}'
```

**To rebuild from your machine instead**, which also prints a drift table by
slug:

```powershell
npm run sync:content -- --remote
```

**How long:** under a minute for this corpus. **What it proves:** every post
row's rendered body came from the markdown at the repository's current blob sha,
through the one render door. **What it does NOT do:** touch media, webmentions
or the Ask index. Webmentions have no repository behind them and cannot be
rebuilt from anything. That is the one table where a restore is the only option.

---

## 4. Restore D1 from a backup

Two paths. Try them in this order.

### 4a. Time Travel, first, always

D1 keeps a rolling window of your database and can put it back without any
export existing. This is the fastest and least lossy option and it needs
nothing from this repo.

```powershell
npx wrangler d1 time-travel info dustinedwards
npx wrangler d1 time-travel restore dustinedwards --timestamp "2026-09-08T18:00:00Z"
```

Or restore to a specific bookmark, which `info` prints:

```powershell
npx wrangler d1 time-travel restore dustinedwards --bookmark <BOOKMARK>
```

**It restores IN PLACE and it is destructive.** Everything written after that
timestamp is gone. Before running it, take an export (4b, step 1) so you can
get back whatever you are about to overwrite.

**It cannot be rehearsed.** There is no form of Time Travel that restores into a
different database, which is why `check:restore` cannot drill this path and
drills the export path instead. The first time you run this command will be for
real. That is a known and accepted gap.

### 4b. From a per-table export

`wrangler d1 export` does not work on this database as a whole: it refuses while
any fts5 virtual table exists, and search needs them permanently (hard rule 2).
So the backup is per table.

**1. Take an export of what is there now**, whatever state it is in. Two minutes,
and it is what you fall back to if the restore makes things worse:

```powershell
npm run check:backup -- --remote
```

It prints the directory it wrote to. Copy that directory somewhere you will
find it again before doing anything else.

**2. Rebuild the schema.** If the database is intact and only the data is wrong,
skip this.

```powershell
npx wrangler d1 migrations apply dustinedwards --remote
```

**2a. If you just ran the migrations, EMPTY THE TABLES FIRST.**

A migrated database is not an empty one. `drizzle/0001_init.sql` seeds a
`settings` row, so a restore into a freshly migrated database dies with
`UNIQUE constraint failed: settings.key` and looks exactly like a corrupt
backup. Measured 2026-09-08 by `check:restore`.

Empty children before parents:

```powershell
npx wrangler d1 execute dustinedwards --remote --command "DELETE FROM webmentions; DELETE FROM verification; DELETE FROM settings; DELETE FROM session; DELETE FROM search_docs; DELETE FROM post_tags; DELETE FROM tags; DELETE FROM posts; DELETE FROM media_refs; DELETE FROM media; DELETE FROM account; DELETE FROM \"user\";"
```

Never `DELETE FROM` a search index (`posts_fts`, `search_identity`,
`search_prose`). Hard rule 2: the repair there is `('rebuild')`, which is
step 4.

**3. Load the tables back, IN ONE FILE, PARENTS FIRST.**

Do not load them in alphabetical order. `account` references `user` and
`post_tags` references `posts` and `tags`, and alphabetically every child comes
before its parent. Wrangler splits a `--file` across more than one transaction
and `PRAGMA defer_foreign_keys` resets at each commit, so deferring does not
save you. Order does. Measured 2026-09-08, twice, by `check:restore` failing
both other ways first.

```powershell
$dir = "<DIR>"
$order = "user","account","media","media_refs","posts","tags","post_tags",
         "search_docs","session","settings","verification","webmentions"
Remove-Item "$dir\_restore.sql" -ErrorAction Ignore
$order | ForEach-Object {
  if (Test-Path "$dir\$_.sql") { Get-Content "$dir\$_.sql" | Add-Content -Encoding utf8 "$dir\_restore.sql" }
}
npx wrangler d1 execute dustinedwards --remote --file "$dir\_restore.sql"
```

That order is parents before children. `check:restore` derives it from the
`REFERENCES` clauses in `drizzle/` on every run and prints it as `load order`,
so if a migration adds a relation, run the drill and copy the line it prints
rather than trusting this snippet.

wrangler asks you to confirm. **Read the database name in that prompt before you
say yes.** This is the one moment in this runbook where a typo is unrecoverable.

**4. Rebuild the search indexes.** They cannot be restored, only derived. Never
`DELETE FROM` any of them (hard rule 2):

```powershell
npx wrangler d1 execute dustinedwards --remote --command "INSERT INTO posts_fts (posts_fts) VALUES ('rebuild'); INSERT INTO search_identity (search_identity) VALUES ('rebuild'); INSERT INTO search_prose (search_prose) VALUES ('rebuild');"
```

**5. Converge from the repository** so the rendered bodies match the markdown:
section 3.

**6. Check it.**

```powershell
curl.exe -s https://dustinedwards.dustin-edwards.workers.dev/api/health
```

**This whole path is rehearsed weekly** by `npm run check:restore`, which does
exactly these steps against a scratch database and compares the result to
production. If it has been green, these commands work.

### 4c. Media

Media is mirrored, not backed up on a schedule. Every object in `MEDIA` has a
byte-identical twin in `MEDIA_BACKUP`, maintained by the queue consumer and
repaired by the `media-backup-drift` health check. Nothing in the site's code
can delete from the mirror.

To copy a lost object back, do it by hand from the backup bucket. There is
deliberately no scripted restore in that direction, because a script that writes
to `MEDIA` from `MEDIA_BACKUP` is one bug away from writing the other way.

---

## 5. Rotate a secret

**The list is `REQUIRED_SECRETS` in `app/lib/secrets.mjs`.** No count is written
here on purpose. To see what the Worker actually carries:

```powershell
npx wrangler secret list
```

To set one (it prompts, so the value never reaches your shell history):

```powershell
npx wrangler secret put <NAME>
```

Where each one lives, and what breaks if you rotate it and stop there:

| Secret | Also lives in | Rotate it alone and... |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Google Cloud Console | Sign-in breaks. Must match the OAuth client. |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | Sign-in breaks until the console copy matches. |
| `BETTER_AUTH_SECRET` | nowhere else | Every existing session is invalidated. You sign in again. Nothing else breaks. Safe to rotate. |
| `BETTER_AUTH_URL` | must match Google's redirect URI | Sign-in redirects to the wrong origin and fails. Change both together. |
| `ADMIN_EMAIL` | nowhere else | You lock yourself out of `/admin`. Nobody else gets in. |
| `GITHUB_TOKEN` | GitHub fine-grained token | The editor and `sync_posts` stop committing. Reads still work, so it looks fine until you save a post. |
| `OPERATOR_TOKEN` | **three holders, see below** | Silent partial failure. Read the box. |
| `ANALYTICS_READ_TOKEN` | Cloudflare API token | The cockpit's origin-requests panel fails closed and says so. Nothing public degrades. |
| `SMOKE_TOKEN` | `gh secret set SMOKE_TOKEN`, and `.smoke-token` locally | `check:browser`'s admin cases lose their credential and say so. Nothing public degrades. |
| `OPENALEX_API_KEY` | `OPENALEX_API_KEY` in the gitignored `.dev.vars`, read by the build | Citation counts on `/publications` stop ageing forward. Whatever APP_KV holds keeps serving, so the page looks normal and the dates quietly stop moving. The loudest symptom is the secrets audit. |

Where a new value comes from is RECOVERY.md section 7, which has a column for
exactly that.

### `OPERATOR_TOKEN` has THREE holders. Rotate all three or none.

1. The site Worker: `npx wrangler secret put OPERATOR_TOKEN`
2. The watchdog Worker: `npx wrangler secret put OPERATOR_TOKEN --config wrangler.watchdog.jsonc`
3. The GitHub repository secret: `gh secret set OPERATOR_TOKEN`

And your local file, wherever `$env:OPERATOR_TOKEN_FILE` points, or `npm run
ship` refuses.

**Rotating only the site is the worst outcome, not the safest.** The watchdog
keeps polling health, keeps alerting, and can no longer repair anything it
finds, so you get a watcher that reports problems and silently stops fixing
them. No gate can see this: nothing can read a secret's value to compare two
copies.

Do them in one sitting, then prove it:

```powershell
curl.exe -s https://dustinedwards.dustin-edwards.workers.dev/api/health
```

and confirm the next scheduled watchdog run repairs rather than reports.

---

## 6. Where the logs are

**Workers Logs**, live tail, the first place to look:

```powershell
npx wrangler tail
npx wrangler tail --config wrangler.watchdog.jsonc
```

Add `--status error` to see only throws. This is a live stream, so it shows
what is happening NOW and nothing about ten minutes ago.

**Workers Observability**, in the dashboard, for anything already past:
Cloudflare dashboard > Workers & Pages > `dustinedwards` > Logs. Query by
timestamp there; the tail cannot go backwards.

**Sentry**: logs only, no traces, by ruling. Traces stay off deliberately
because spans carry `url.full` and that would put `/preview/<token>` into a
third party. **Not wired up yet**: the project has to be created before this
line means anything. Until then this row is a plan, not a destination.

**UptimeRobot** is the outside opinion: <https://uptimerobot.com>. Two monitors,
the home page and `/api/health`. If UptimeRobot says up and you say down, the
problem is between you and the site rather than in it.

**The health snapshot** is what the home page tile reads, and its AGE is the
watchdog's liveness. A tile saying "stale" means the poller stopped, which is a
different problem from a check failing.

---

## 7. Who to email at Cloudflare

There is no email address. Support on this account is a dashboard ticket:
**dash.cloudflare.com > Support > Contact Support**.

Have these ready, because the first reply always asks for them:

- The account id, in `wrangler.jsonc` (gitignored) or the dashboard URL.
- The Worker name: `dustinedwards`. The D1 name: `dustinedwards`.
- The D1 database id from `npx wrangler d1 info dustinedwards`.
- A Ray ID from a failing request, in the response headers as `cf-ray`.
- The exact UTC timestamp and what you expected instead.

For a platform-wide problem, check <https://www.cloudflarestatus.com> and
subscribe to the incident before opening a ticket. A ticket about a known
incident is slower than the incident page.

**Response time depends on the plan tier and this file does not claim to know
it.** Check the Support screen, which states the entitlement for the account you
are actually logged into.
