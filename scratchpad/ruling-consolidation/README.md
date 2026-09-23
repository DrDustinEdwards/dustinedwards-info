# Ruling consolidation, 2026-09-23 (job_b2f26057a2dd)

This is a report, not code. Nothing here is wired into the site, and Capsid was not written. The seat files the four drafts:

- `design-law.md`: one page of Paper and Plate law, merged from every STANDING design ruling.
- `standing-rulings.md`: the non-design STANDING rulings with their enforcers, plus the PENDING and UNSURE lists.
- `history-index.md`: every ruling that is not standing, with its class and evidence (generated from the tables).
- `core-md-changes.md`: the lines in core.md that should point at the new files instead of the volumes.

`classification/` holds the six evidence tables: one per slice for rulings 1 to 133, plus `old-log.md` for volumes 1 to 13. Every DONE cites a commit or PR confirmed in git at ce1dea4. Open PRs #83 and #84 are not counted as done.

## Counts

There are 133 numbered rulings and no gaps. Two items need a note:
- Vol 19 has two rulings numbered 117 (the direction lock, 117L, and Direction D, 117D).
- Ruling 39 has two parts.

Rulings with independent items are split into rows, which gives 198 rows.

| class | rows | rulings (one class each) |
|---|---|---|
| STANDING | 101 | 55 |
| SUPERSEDED | 58 | 40 |
| DONE | 18 | 17 |
| STALE | 7 | 7 |
| PENDING | 11 | 6 |
| UNSURE | 3 | 0 |
| MIXED (items differ) | | 8 |

Rulings 35, 44 and 55 are counted as SUPERSEDED (by 116), but ruling 116 retired them with nothing replacing them, so they are STALE in all but name.

## Findings the seat should act on

**Records that are false**
1. retired-2026-09.md says ruling 86's composited-contrast gate "exists in check:browser". It does not. The ruling is PENDING.
2. retired-2026-09.md says ruling 90 was "built and repaired, ba832ff". check:browser has no header-fit case. The ruling is STALE: rulings 117 and 126 changed its premise.
3. Four gates credit "fixture independence" to hard rule 10: check-features.mjs:1632, check-floors.mjs:9, check-hook-matchers.mjs:181 and check-urls.mjs:231. Neither CLAUDE.md nor VERIFICATION.md contains that rule. It is a vol 5 binding with no numbered home. See `classification/old-log.md`.

**Old-log bindings with no numbered home (10)**
These are cited as binding by gates:
- fixture independence
- enforced CSP (not Report-Only)
- the security-header set
- prefetch, never prerender
- one moderate speculation rule
- refcount-guarded empty-trash
- no shortcut without an island
- ICO at 16, 32 and 48
- invocation logs off
- the scoped-git-add canonical properties

Each needs a line in `standing-rulings.md` or a hard rule. Details are in `classification/old-log.md`.

**Standing rulings that contradict something**
- **58 (merged into 56)** defers `fts-equality` at readiness. The code keeps it gating on purpose: ship.mjs:1061 and 9a401ce. Build it or record it as declined.
- **12** says readership counts every request, cache hits included. The admin CACHE_SENTENCE says cached responses never reach the Worker, and check:admin-ui asserts that sentence verbatim. One of the two is wrong; nobody has re-measured.
- **9** says the endpoint URL is derived from the request origin. The code uses `SITE_ORIGIN` deliberately.
- **53** says renames ship with their redirects. core.md says renames need no redirects.
- **6 (merged into HR9, which exempts admin)** is where "admin mention actions work without script" was lost. The mentions page's delete now needs a script dialog.
- **Glass radius:** 117D.5 against 118.3.
- **Glass placement:** 117D.5 against 124.3.
- **Home numerals:** vol 19's Plate I entry against 133.
- **View transitions:** vol 16 turned them off; 67 and 125.3 allow them.

`design-law.md` resolves each design conflict toward the later ruling and lists them at its end.

**The repo breaks standing design law.** Each of these is a job, not a ruling:
- **Pills (999px radius):** post-enhancements.css:177 and :264, projects.css:104, search-facets.css:38, search-page.css:98.
- **Tracked caps:** ask.css, palette-dialog.css, projects.css, search-page.css, search-facets.css.
- **/projects:** still an auto-fit grid of `.project-card` (117L.5, 118.7).
- **Login:** still a rounded `.gate-card` with a filled `.btn-brand` (117L.10).
- **Ask panel:** fills with `--tint-brand` and a `--brand` badge (118.2, 122.1).
- **Four posts** open with "This article describes how to" (46).
- **conventions.md:108 and canvas-constraints.md:17** still teach the pre-126 header ("no breakpoint, no menu").
- **Tokens:** `--fig-s1` is still declared, although vol 19 says it is gone. 122.2's series names (`--fig-oxide`, `--fig-leaf`, `--fig-cadet`) are declared nowhere. The carried map's lamp rows still name ruling 74 as owner.

**Deadline pressure.** The carried token map (about 40 rows) and the payload uplift both expire on 2026-11-30 (rulings 103, 119.8, 120.6 and 122.5).
