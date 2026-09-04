# Relocated from CLAUDE.md, 2026-09-04

**For the seat to move into `dustinedwards/decisions-vol-14.md`.** Sessions never
write Capsid, so this lands in the repo and waits.

CLAUDE.md went from 39,937 characters to under 20,000 in one commit. No rule was
lost and all twenty keep their numbers. What follows is everything that was cut,
kept verbatim where it carried a measurement or a date, filed under the rule it
came from. The rule text now in CLAUDE.md is the operative sentence; this is the
grounds behind it.

The general shape of the cut: the file was not mostly history by paragraph, it
was rules whose grounds had been written inline and never moved. Each rule kept
accreting the story of the defect that widened it.

---

## Preamble and session ritual

**PRECEDENCE, corrected 2026-08-21.** The file read: "Everything durable lives in
Capsid. If a fact is in both places, Capsid wins and this file is the defect."
That was true while Capsid held everything durable, and stopped being true when
the hard rules and `VERIFICATION.md` moved into this repo. The mechanism that
decides it: CAPSID CANNOT BE GATED, BECAUSE EVERY GATE VERIFIES DISK. A count
copied into Capsid rots silently; the same count in `check-all.mjs` is the only
copy that can be wrong and be caught.

**The end-of-session write was removed 2026-08-18.** CLAUDE.md had asked for a
dated episodic at the end of every session, contradicting the standing Capsid
rule outright. Capsid won and this file was the defect. Do not re-add it: if the
standing rule changes, it changes in Capsid first and this file follows.

**THE HARD RULES MOVED INTO THIS FILE 2026-08-21.** They had lived in Capsid and
were pointed at from here. Capsid cannot be gated, so the rules the code cites by
number sat in the one place no assertion could reach. The preamble then carried a
COUNT of citing files, which had more than quadrupled underneath it before anyone
noticed, which is rule 17 happening in the file that states rule 17.

**The `GATED` / `UNGATED` tag replaced older ONE-LINER and PROSE labels**, which
encoded the same axis without naming the instrument. Keeping both would have been
two owners for one fact.

## Rule 1, public visibility

**The draft-card leak.** The rule bypassed itself precisely because an R2 key is
not a row read: the OG card object was live, immutable and reachable while its
post was unpublished. That is why the rule now names its sites explicitly: a rule
that says "everywhere" is checked nowhere.

**Why content-addressed `/media/*` is exempt, by measurement.** Composing
visibility in `app/routes/media.$.ts` would add a D1 read to the hot image path
to protect a fact the key does not carry.

## Rule 4, public payload

**WIDENED 2026-08-24, because as written it succeeded at the small thing and
ignored the large one.** "Keep the Worker lean" was satisfied while `app.css`
imported the admin stylesheets and every visitor to the home page downloaded the
media library and the post editor. The Worker was lean and the page was not. A
rule scoped to one artifact grades that artifact.

**The no-framework-script plane landed 2026-08-26.** `check:invariants` section
24 exists for the defect class the design creates: code that compiles, renders,
and does nothing in the browser. The wire half is `check:browser`'s enhancement
cases and verify-live section 16.

## Rule 7, boundary notes

**Boundary-note presence stopped being gated 2026-08-21.** `check:assertions`
asserted it and was deleted in audit tier 4.1. Presence was all it could ever
assert, and the rule's own sentence is why that was never the valuable half:
nothing can check that a note is still TRUE. Two notes have gone false since
being written, one of them falsified in the same commit that wrote it.

## Rule 8, the shared cache

**The theme-cookie bypass, measured on the wire.** Before 2026-08-26 the `Vary:
Cookie` downgrade cost every reader who had touched the theme toggle, which sets
a cookie for all three choices, and every signed-in reader: `theme=system` and a
stray `_ga=1` both read BYPASS on every HTML page.

**Why the theme is in the KEY and not in a `Vary`.** The platform's cache key is
the entrypoint, the path and query, and the Worker version, and nothing this
Worker sets puts a header into it; `caches.default` is keyed by the Request
handed to it and carries no headers at all. `media.$.ts` records the measured
cost of getting that wrong.

**THE SAME BLINDNESS COST A REPRESENTATION.** A key that cannot carry a header
cannot carry `Accept` either, so the HTML copy of a negotiating route answered
the markdown request, measured in production. The fix is a bypass rather than a
fourth dimension, gated on the wire by `check:browser`, which warms the HTML
entry first and asserts that it did, because the case is vacuous otherwise.

**What licenses reading the cookie for the theme alone is a MEASUREMENT, not an
argument.** `check:browser` asserts on every route declaring the shared headers
that a credentialed reader receives byte-identical HTML and that the theme
changes only the enumerated set the gate carries. The themed cache is sound only
while that holds, so the gate is the precondition rather than a regression test,
and it landed first.

**The enumeration moved to the gate 2026-08-28.** CLAUDE.md used to name the
members, went stale the day the set grew, and at one point carried a COUNT that
disagreed with the gate beside it.

## Rule 9, progressive enhancement

**Login shipped script-only until 2026-08-23.** The rule kept being compressed to
its slogan and the exemption kept being read as covering the sign-in page: the
seat's translation flattened it, README asserted the flattened version, and the
door was script-only in production. That is why the door now has its own sentence
in the rule.

## Rule 10, coverage

**THE DISCIPLINES were restored 2026-08-21** from Capsid `core.md` version 1684,
whose rewrite that day dropped them.

Measurements attached to individual disciplines:

- **An EMPTY needle matches every line and returns a plausible number**, measured
  2026-08-20.
- `check:head`/`check:headers` and `check:content`/`check:contrast` are prefix
  pairs, which is why every needle is anchored.
- **Fixture independence** is what justifies `check:logo` and `check:contrast` in
  the shape they take: `scripts/fixtures/icon-suite.json` is deliberately NOT
  generator output.
- **The byte-level needle case.** A `\b` written into a script arrived as an
  actual backspace, 0x08; `grep` and `sed` DISPLAYED it correctly while the regex
  matched nothing.
- **The scripted-edit case.** A deletion script whose end anchor matched the
  newline inside its own start anchor joined lines rather than removing them, and
  EXITED ZERO.
- **The truncation case.** A truncated importer search reported a clean answer
  about the part it printed and nothing about the part it dropped.
- **Re-measuring carried claims has corrected an AUDITOR, a PROMPT, and the
  RULING LOG ITSELF.**

## Rule 11, schema

**Corrected 2026-08-28 to what the gate actually does.** It compares columns with
their types and index names with their column order. SQLite reports a partial
predicate, a collation and a direction as DDL text and drizzle models none of
them.

**Section 5 was DELETED on 2026-08-16**: its regex could desync on a regex
literal and examine nothing while printing a clean result. Do not rebuild it as
regex.

## Rule 12, replaying the defect

**A green run after a failed plant proves nothing.** A mangled path once made a
plant a silent no-op and the gate went green.

**The skip-link-on-purple-chrome defect** is how the surface-recolor discipline
was classified: a recolor ruling that lists the components it repaints misses
anything whose only appearance is over the recolored surface.

**The targeted-revert discipline** was paid for once: skipping it duplicated a
lint rule whose stale copy then mis-guarded a plant.

## Rule 13, substituting fallbacks

**The instances, with their dates.** `REMOTE_ARGS ?? []`, and `?? "unknown"` on
the rate-limit client IP, stated once in `app/lib/client-ip.ts` since 2026-08-25
where it had been unmarked spellings across five routes; that substitution pools
every off-edge caller into one shared bucket, which is the closed direction. The
theme's `?? "system"` was the third and is GONE since 2026-08-29, with the header
that needed it.

**The lint form is GONE since 2026-08-21**: `check:assertions` rule (e) enforced
it and the gate was deleted in audit tier 4.1.

## Rule 15, settings.json

**UNGATED since 2026-08-21, and that is the rule's natural state.**
`check:hooks` read the file and never wrote it, and was deleted in tier 4.1: it
could not see whether a hook RAN, only what the file declared, so a green run was
compatible with enforcement being off entirely.

**RESTORED, THEN FALSIFIED BY MEASUREMENT, both on 2026-08-21.** A clause
recovered verbatim from Capsid said several repos still carried a fail-open
`scoped-git-add.sh`; it was true when written, and measuring at origin by blob
sha found one. The lesson is the clause, not the count: a claim inherited from a
document gets the same treatment as one from memory.

## Rule 16, ship

**The watchdog step landed 2026-08-29.** It deploys after the site deploy and
after readiness, because it binds to the site and must not be pointed at a build
this run has not proven. The previous watchdog keeps firing meanwhile, so a
failure degrades the WATCHER and never the site.

**The ship-window rule was paid for.** A prior ship deployed and then refused
mid-run because the session deleted a file underneath it, and the deploy was
coherent only because the build had already finished. It is deliberately not
folded into the numbered steps, so a session never learns to fail a deploy over
it.

## Rule 17, one owner per fact

**Every second copy of a number found in August had already drifted**, in both
directions and often within the same day: gate counts in three places disagreeing
with `check-all.mjs`, floors declared under what their own gate ran, a
cached-route count wrong in two directions across two sentences, and the count of
citing files in CLAUDE.md's own preamble.

**EXTENDED 2026-08-28, because the number was never the whole class.** An audit
of this repo's prose found ten of eighteen checkable claims FALSE, and most
carried no digits. They were TENSE-BOUND STATE CLAIMS. "The artifact is
byte-compared against a fresh generation on every build" owns no number and was
as false as any count, because that artifact left git on 2026-08-26.

## Rule 18, derived indexes

**`OFL.txt`'s missing row waits for the media rebuild rather than an `INSERT`**,
which is the worked example of repairing through the derivation.

**D1 became the only rendered copy at the artifact arc, 2026-08-26.** The
committed corpus artifact is gone and `content/generated/posts.json` is a
gitignored local build product.

## Rule 20, manual cache keys

**`media.$.ts` served pre-fix bodies for hours after the fix**, measured at that
cache key, because `WEBP_QUALITY` became an input to the body and was not in the
key. `workers/app.ts` had already done this correctly for the theme. Second
occurrence of the class.

## Numbering

**Numbering was FROZEN and is no longer.** It was frozen because one comment
cited a rule by FILE AND LINE, so renumbering broke a line reference. That
comment cites the rule by number alone now, and `check:invariants` section 15
binds the number to the file. Renumbering is still a bad idea and nothing needs
it.

## Workflow and commands

**The pre-push hook's two defects.** Two CI-red pushes in two days were the same
shape and neither was a content edit: a new file under `app/` moves the count of
sources citing a template asset, which moves `content/generated/template-refs.json`.
Separately, `npm run lint` is a CI step no gate tier runs, and CI went red on it
on 2026-09-03 after a clean twenty eight gate run.

**Why there is no `.githooks`.** This repo has no git hook mechanism, and adding
one would be a SECOND mechanism with two places to look when a guard does not
fire. Recorded in the hook file itself.

**The Commands section used to restate `package.json`.** Measured 2026-08-28, the
restated block silently omitted a quarter of the scripts, among them `ship`,
`test`, `check:types` and `check:browser`, which is most of what a session runs.

## Bindings

**`check:config` cannot run in CI**, and the reason is measured rather than "there
is no CI": a checkout has no real config, `postinstall` bootstraps one by COPYING
the example, so real equals example by construction and the gate cannot fail.
Hence its `CI_EXCLUDED` entry. It stays load-bearing on exactly one machine.

**A Worker cannot `fetch()` this site**, measured with a control: Cloudflare error
1042. That is why `SITE` is a service binding, and why the watchdog proves the
health suite RUNS while only the hourly `health.yml` proves the site is
REACHABLE.

**THE BINDING LIST WAS ALREADY STALE BY TWO, found by the gate written to
replace it.** `check:invariants` section 26 landed in the consolidation commit
and failed on its first run: `MEDIA_BACKUP` and `ANALYTICS` were declared in
`wrangler.jsonc.example` and absent from CLAUDE.md. MEDIA_BACKUP is the media
mirror bound on 2026-09-01. Nothing had compared the two lists, so the table a
session read to learn what this Worker holds had been wrong for days. That is
the case for gating a fact rather than trusting prose, made by the fact itself.

**The watchdog's redacted var is `ALERT_EMAIL`**, an inbox rather than an id, so
its placeholder is the reserved `example.com`.

## Document index

The full annotated list of Capsid documents (search-architecture, publish-pipeline,
operator-mcp-wrapper, media-module-architecture, colophon-page, design-tokens,
logo-spec, chart-stack, progressive-enhancement, workers-cache-vary,
workflow-mainline, blog-content, seo-targets, admin-cockpit, admin-ux-backlog,
concept-repo-operations) was a hand-maintained mirror of the namespace with a
one-line gloss each. It is removed from CLAUDE.md rather than relocated in full:
`list` on the namespace derives the same thing and cannot go stale. The glosses
were the only part not derivable, and they described documents a session reaches
through `core.md` anyway.

**Security headers** are live with the CSP ENFORCED rather than Report-Only,
since `20c27d6`, 2026-08-17. Full subsystem in `security-headers.md`: both
phases, the nonce chain, the report sink, and the nonce-versus-shared-cache
tradeoff accepted to get here.

**`CUTOVER.md` was harvested back 2026-08-21** from a Capsid cut that had deleted
most of it. **`VERIFICATION.md` moved out of Capsid 2026-08-20.**
