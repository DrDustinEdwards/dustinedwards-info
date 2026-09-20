# Process rules vs “a rule that does not make the site better is changed or deleted”

Visual law is rulings 117–118. This note is how a page gets made and shipped. Sources: `CLAUDE.md` (standing law, ruling 116), `package.json` scripts, `README.md`, `.design-sync/conventions.md`, `VERIFICATION.md` / `FAILURES.md` as cited in commits. `NOTES.md` is not in this repo; procedure lives in `.claude/skills/` and Capsid. Sessions read Capsid and do not write it.

Standard: keep what has caught breakage or made a reader’s page true. Narrow what doubles a cycle without changing the page. Delete what only protects a process from itself.

---

## Hard rules (`CLAUDE.md` 1–20)

### 1. Every public read through `publiclyVisible()` — **stay**
Requires: HTML, feeds, search, Ask, OG never name a draft. `/media/*` out (digest cannot name a draft).
Caught: the class exists because a public URL that names a draft is a visibility bug whether or not it is HTML (`CLAUDE.md` 1). `9331467` wired home tiles through the same predicate `/blog` uses.
Cost: every new derived surface must join the predicate. Cheap vs leaking a draft.
**Stay.** Replacement not needed.

### 2. `wrangler d1 export` is broken; per-table backups; FTS `rebuild` — **stay**
Caught: export path is named broken in law so nobody “just exports.” `check:backup` is the instrument.
Cost: custom backup scripts. The alternative is an unrestorable D1.
**Stay.**

### 3. Secrets only inside the server boundary — **stay**
`check:secrets`, both directions, per-root floors.
Cost: none a page feels. **Stay.**

### 4. Public plane ships no framework script — **stay**
Requires: no React hydrate on public routes; only `app/enhance/` nonced modules. `/login` is public. Admin exempt.
Caught: `b098b49` found every public page hydrating React with no floor (331 KB raw / 95 KB brotli). `f9aecb5` nearly shipped a shell with *zero* bundles (theme gone) and nearly shipped the 3921-byte palette on every route; `check:page-payload` refused both. `e84b7a8` refused importing `post-enhancements.css` into a fixture at 10,689 vs 10,600.
Cost: no SPA transitions, no client router on public pages, enhancements must be vanilla modules. That *is* the site (rule 9 + Swiss document).
**Stay.** Wording is already right. Do not “narrow” to let one public route hydrate “just this once.”

### 5. Popover / pinned bar `--border-strong` — **stay as design law, not ship law**
UNGATED here; lives in `.design-sync/conventions.md`.
Cost: a preview cycle when a themed box forgot `--text` (conventions.md records it).
**Stay** where design sessions read it. Do not re-inflate CLAUDE.md.

### 6. URL allowlist, schema and render — **stay**
`check:urls`. Slug pattern once, `postPath()` once.
**Stay.**

### 7. A gate that feeds itself its stored output cannot see transport — **stay**
UNGATED method. `0454d401` proved verify-live was asserting cold after every deploy and missed a theme-cache bug for four sessions. Rule 10’s worked case.
**Stay.**

### 8. Workers cache is on; Worker stamp is the statement — **stay**
`check:headers`. Silent heuristic cache if no `Cache-Control`. `private, no-store` default. `Vary: Cookie` + any cookie bypasses shared cache.
Caught: theme served to the wrong readers from cache (`0454d401`, `0ceb52a`).
Cost: HTML is uncacheable at the edge; `.md` / `llms.txt` / RSS stay public 600s. Correct split.
**Stay.**

### 9. Progressive enhancement, not “zero JS” — **stay**
`check:features`. Admin exempt; `/login` is not.
Caught: README records the old name was untrue at the door (a button that did nothing without script).
Cost: every public feature needs a server form. That is the reading-experience post’s own law.
**Stay.**

### 10. A pass count is not coverage — **stay**
Ten vacuity classes. Re-measure carried claims.
Caught: auditors and the ruling log (`CLAUDE.md` 10). Floor moves when the map shrinks (`f9aecb5`: invariants 422/461 re-measured, not derived).
**Stay.**

### 11. `schema.ts` is source of truth — **stay**
Migrations and live DB bound by `check:invariants` §4.
**Stay.**

### 12. New gates replay the defect — **stay**
Plant proven applied before the result is read. `bdb7632` plants (font preload→prefetch; palette tag back) and `b098b49` (minifier folded the first plant).
Cost: extra hours per gate. Those hours are why the gates work.
**Stay.**

### 13. Fallback that substitutes a different value is not failing closed — **stay**
Two marked `JUSTIFIED SUBSTITUTION` instances. Class resolved.
**Stay** as a class; no new instances without a mark.

### 14. Migrations hand-written; applied file never edited — **stay**
`check:migrations` hashes both ways. drizzle-kit absent on purpose.
**Stay.**

### 15. Do not edit `.claude/settings.json` without instruction — **stay**
An agent can silence every other rule.
**Stay.**

### 16. Ship contract: CI for this sha, token before build, Ask converged last — **stay, do not add an override**
`scripts/ship.mjs`, no override flag. Watchdog deployed by ship, never `npm run deploy`.
Cost: cannot “just wrangler deploy.” README: bare deploy would ship whatever `build/` held.
**Stay.**

### 17. One owner per fact — **stay**
Measured value lives in its gate. Prose points; does not restate. Posts are dated records and may keep numbers with dates.
Caught: `9331467` added invariants §22 so home tiles cannot hard-code `25`. `28d0009` stripped restated contrast ratios from comments.
Cost: comments get shorter; agents want to write history into them.
**Stay.** The last sentence of the rule *is* this standard.

### 18. Indexes converge toward the repo — **stay**
D1, FTS, Ask, media, OG are derived. Repair through derivation. Failed index write never reverts source.
**Stay.**

### 19. Money paths: origin, rate, cache, budget, model — **stay**
`check:policy`. Absent Origin allowed (scriptless POST). Foreign Origin refused.
**Stay.**

### 20. Manual cache key carries everything the body depends on — **stay**
No purge door on `workers.dev`.
**Stay.**

---

## Gates and payload ceilings

`package.json` owns the list. `check-all.mjs` refuses an untiered gate. Offline `check` (~110s) is what ship runs; `check:ci` is the clean-checkout tier; `check:all` needs deployed DB/bucket. `check:browser` is network-tier and was ruled to stay there (`6f259704`) because a ship gate that fails on laptop load teaches people to re-run it.

**`check:page-payload` + uplift — stay, narrow the *uplift* not the gate.**

Requires: every public HTML route has a measured ceiling; new route arrives with one or the gate stops (`8dc084f` /about). Refuses missing preload, over-ceiling CSS, over-ceiling cold load, enhancement reachable without markup.

Caught: palette on every route; theme bundle silently dropped; fixture CSS on a public ceiling (`e84b7a8` dropped drawing the reading-progress specimen rather than raise `/blog/:slug` by 89 bytes).

Cost: redesign raised home from 4655 → 6701 CSS (`f9aecb5`). `REDESIGN_UPLIFT` still holds pre-redesign figures and **expires 2026-11-30**. Pull quotes fitted under 11,600 without a raise (`b61ba82`).

**Narrow the uplift, not the gate.** Replacement: *Ceilings are measured. A raise is a dated, named decision in the payload table with a reason. The redesign uplift expires 2026-11-30 and is not renewed as a blanket; leftover slack is cut back to ~20% over the then-measured figure. A fixture must not import a public sheet to draw one bar.*

Other gates that earn their place on a *page*: `check:contrast`, `check:features`, `check:headers`, `check:llms`, `check:content`, `check:microformats`. `check:floors` has caught under-floor test counts three times on the same floor (`6c578bd` note). Keep floors; re-measure by running, never by arithmetic.

`check:slop` (aislop on changes vs `origin/main`) — **stay as CI opinion, not as design veto.** It does not know Swiss bars from slop.

---

## Suspension of rulings

Evidence: ruling 100 (header restore) *suspended* the redesign header; `d99e6be` then had to retarget `check:browser` theme cases from `.bar-theme button` to `form.theme-toggle` (7 FAIL / 1 SKIP because the brief and the ship had diverged).

Suspension is the escape hatch when a ruling made the live site worse. **Stay**, with wording: *A suspension is a dated commit that names the ruling, the live selector it restores, and the gates that must be retargeted in the same commit. A suspended ruling is not a secret second brief.*

---

## Two-reader review

`README.md`: “There is no second reviewer, so the gates are the review.” CI since 2026-08-20 is “the closest thing here to a second opinion.” `CLAUDE.md`: site session owns the main checkout and commits to `main`; every other actor works in a worktree and lands by **PR on green CI**. Renovate PRs are reports, not merge fodder.

Caught: gates caught payload and cache defects no human reviewer would have measured. Missed: design and process can still fork (purple chrome ratified, then paper footer; header restored while jobs still described the bar).

**Narrow.** Replacement: *Gates review machinery. A second human (or a named design pass) reviews anything that changes what a stranger sees in the first screen. Worktree PRs stay. Mainline commits by the site session stay. Do not invent a standing two-agent literary review for every gate repair.*

---

## Job-and-handoff workflow

Observed hops from an approved direction to a page a reader can see:

1. Direction / canvas (Claude Design or equivalent)  
2. Handoff written (anatomy, lock, Capsid task)  
3. Capsid job posted  
4. Worktree branch + implement  
5. Local `check` / typecheck  
6. PR  
7. `check:ci`  
8. Merge to `main`  
9. `ship` (CI for sha, token, Ask converge last)  
10. Deploy (site Worker + watchdog)  
11. `verify-live` (twice if cache-related)

What earns its place: 1 (so the page is intended), 4–5 (the page exists), 7 and 9–11 (the page is true and cache-safe).  
What often does not: 2+3 as *separate* artifacts when the handoff already is the job; a second design pass that re-asks the four families.

`e84b7a8` records a job posted 2026-09-13 22:12Z whose five amendments described a header that ruling 100 had already restored — three of five unbuildable. That is process as constraint: the job lagged the ruling.

**Narrow.** Replacement: *One written handoff is the job. If the ruling log moves after the job is posted, the job is stale and is rewritten or killed before build. Do not keep a parallel “canvas law” and “ship law.”*

`.design-sync/conventions.md` still documents `PostCard`, `tag-chip`, `gate-card`, `--surface-chrome`, 48rem `page-inner`. That file is what a design session reads. It is **behind the lock** and will recreate cards if left as the brief.

**Change conventions.md** (not CLAUDE.md) to the Swiss/public vocabulary: paper, dust rule, rows, no `PostCard` on the public plane. Leave admin cards in `docs/ADMIN-DESIGN.md`.

---

## Mainline vs worktree

Site session: main, commit and push immediately, gates are review.  
Others: worktree + PR.  
**Stay.** The cost is two landing paths. The benefit is agents cannot silent-push secrets or ship. Destructive / money / auth stay with Dustin — **stay.**

---

## What NOTES.md used to hold

Not in tree. Ruling 116 cut CLAUDE.md to gated/ungated hard rules; retired text is `dustinedwards/retired-2026-09.md` in Capsid. Skills hold procedure. **Do not bring NOTES.md back** as a third law file.

---

## Direct answers

### 1. Which rules would stop the best version of this site?

Almost none of the *hard* rules. The site is trying to be a document that also runs instruments, readable with script off, true to its numbers, cheap on the wire.

What *can* stop a better page:

- **`REDESIGN_UPLIFT` treated as permanent slack** — hides CSS growth until 2026-11-30, then a cliff. Cut slack on purpose; don’t let Swiss type + a measured poster band die because a fixture imported a 17-family sheet (`e84b7a8`).
- **`conventions.md` still teaching PostCard / chips / chrome surfaces** — a design agent will rebuild the 2025 site.
- **Stale Capsid jobs after a suspension** — implements the previous header.
- **Reading “no framework script” as “no poster geometry / no enhancement.”** Rule 4 does not forbid a CSS-only bar figure. Rule 9 wants the enhancement to have a named fallback.

Rule 4 itself does not stop the best version. Hydrating public React would make a different, worse site.

### 2. Where is the process the constraint?

The hop count is **eleven** if you count canvas → live. About **six earn their keep** (intent, implement, CI, ship, deploy, verify-live). The tax is **handoff and job as two documents**, plus design-sync conventions that disagree with the lock.

A direction can be approved on Sunday and still not be a URL until a job, a worktree, green CI, and a ship window. That is correct for cache, Ask spend, and drafts. It is excessive for “change the home type scale by 2px.” Split: *copy/token tweaks ride the site session on main; anything that changes first-screen chrome or payload uses the full hop list.*

### 3. What is missing (pages are read by agents too)?

Already present and should stay: `.md` twins, `llms.txt` / `llms-full.txt`, `check:llms`, JSON-LD Person owned once (`6900cb8` refused two Person objects), microformats, one owner per fact so agents cannot quote a stale digit from prose.

Missing or weak:

1. **`llms.txt` does not describe the visual lock** (paper, ink, no-hydrate). Agents designing *from* the site will read conventions.md and draw cards.
2. **No gate that conventions.md matches the public lock.** Design-sync can ship a brief that the public CSS has left.
3. **No “stale job” check** against the ruling log / suspension list.
4. **Ask answers are visibility-gated (rule 1) but not required to cite the `.md` twin.** An agent-facing page should prefer the twin URL.
5. **`verify-live` is not a ship-blocker in CI** (needs deploy, Ask probes billed). That is correct; the missing piece is a short *post-ship* checklist skill that always runs the warm pass after cache changes (`0454d401`).

Add (small): a `check:brief` or a section in `check:design-sheets` that fails if conventions.md still names `PostCard` / `tag-chip` as public vocabulary. Put one paragraph in `llms.txt`: public pages are HTML+CSS documents; do not infer a component library from `/admin`.
