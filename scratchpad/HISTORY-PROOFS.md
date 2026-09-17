# Ruling 115: proofs (job_327e4af58a67)

Base: 9b769c8 (PR #39's merge). Pristine sheets are in
`scratchpad/history-before/` (gitignored, made by `node
scratchpad/history-apply.mjs snapshot`). Reproduce the cut with `node
scratchpad/history-apply.mjs apply && npm run build:katex`.

## What moved

700 comment blocks in the 31 hand-written sheets (katex.generated.css is
derived; its override half is edited at katex-overrides.css and regenerated).

- 372 blocks changed: 4 deleted as HISTORY, 368 rewritten. The other 328 are
  at most three lines and kept byte-identical.
- Tags (`history-tags.tsv`): WHY 683, NUMBER 13, HISTORY 4. Most history sat
  inside a block that also carried a why, so those are WHY with the history
  moved; 113 reasons say so.
- `sheet-history-2026-09.md` (202,749 bytes) holds every deleted or shortened
  block VERBATIM with its sheet and line at 9b769c8, its tag and why it moved.
  Of the 58 line-number pointers left by the slop audit, 47 no longer resolved
  to a block. The 49 pointing into app.css's light block ("See exact copy of
  app/app.css:886") now name no line and are not in the history file; the 9
  "app/app.css:1885" pointers (a line that does not exist) are replaced by the
  cascade rule they pointed at, and are in it.
- Rewritten blocks by line count: 1 line 25, 2 lines 225, 3 lines 66,
  4 lines 3 (app.css token resolution, motion-print.css view transitions,
  public-chrome.css wordmark: each is a rule plus its mechanism and a shorter
  form lost one of them). One line is 111 characters; the rest are 110 or less.

## 1. CSS unchanged

`node scratchpad/history-proofs.mjs css`, using the regex of
`stripCssComments` in `.design-sync/build-inputs.mjs`:

- raw strip identical: 29 of 32 sheets
- strip with whitespace-only lines dropped, identical: 32 of 32

The three raw differences are the lines the four deleted comments sat alone
on. Stronger than either: `history-shots.mjs` builds both arms and the built
CSS assets are identical by name (content-hashed) and size, all 14 of them.

## 2. Prohibitions

`node scratchpad/history-proofs.mjs modals`; the list and the manual review
are in `history-modals.txt`. 249 (block, modal) cases in rewritten blocks,
99 where the same word is absent after. All 99 were read: the rest are
history or the same rule under another modal ("never takes" for "must not
take"). 15 blocks that had lost a real rule were restored before the list was
taken; they are named in that file.

## 3. Generator blocks

`guide-list` before and after, then `guide`. The job says 63; the real
baseline at 9b769c8 is 56 (PR #39's proofs already recorded 56).

- before 56, after 57: kept 56, removed as HISTORY 0, vanished 0
- gained 1: the prefers-contrast tier note (app.css), which no longer reads
  as build talk
- 15 vanished on the first pass (shorter than the generator's 120-byte floor,
  or now naming a gate with only one design needle, or "pinned bar" routing a
  z-index note into the chrome file); each was reworded so its needle is real
  prose, not padding
- generated guidelines: 45.1 KB -> 29.7 KB across the same five files

## 4. Gates

On this tree after `npm run build`:

- check:design-sheets 7/0, check:contrast pass, check:content 145/0,
  check:page-payload pass, check:fonts 224/0, check:logo 132/0
- check:features 938/0, check:invariants --local 518/0, lint pass,
  check:types pass
- check:guidelines 9/0 (after `build-capsid-guidelines.mjs`, via
  `run-with-capsid.mjs`)
- check:slop pass, score 100 (re-run after commit, since it scores the diff)
- check:floors 41 of 42: the failure is check:config, which fails in every
  worktree because the bootstrapped config is the example (`CLOUDFLARE_ACCOUNT_ID
  ... is NOT the real value`). Run inside the batch, check:floors was killed
  for low memory; run alone it completed.

## 5. Header shots

`node scratchpad/history-shots.mjs` (all 32 sheets swapped): 10 pairs (/,
/blog, a post, /projects, /search; light and dark; 1280 wide) at 0.000%.
Control, light home against dark home: 99.772%. The local D1 needed
`wrangler d1 migrations apply --local` and `sync:content --local` first.

## 6. Bytes

`history-bytes.txt`. All 32 sheets: 402,888 -> 293,463 bytes; comment
218,889 -> 109,468; share **54.3% -> 37.3%**. The 22 SHEETS alone: 54.7% ->
39.2%.

**The 20% target is not met.** The 401 blocks of three lines or fewer were
already 50 KB at 9b769c8, and 20% of these sheets allows about 46 KB of
comment in total. Reaching it would mean deleting short whys and
prohibitions, which the job forbids ("nothing load-bearing lost"). The next
lever is volume per rule, not history: app.css (48.2%), admin-shell.css
(47.7%) and admin-media.css (41.3%) hold half the remaining comment bytes.

## 7. CLAUDE.md

Hard rule 17 keeps its number (check:invariants section 15 binds citations to
the heading) and its heading. Its reasoning paragraph is replaced with ruling
115's text, and the dated-observation sentence now sends the observation to
Capsid rather than into the file.
