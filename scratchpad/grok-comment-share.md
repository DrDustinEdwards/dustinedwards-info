# Comment share, and whether reasoning-in-file should stay

Measured `origin/review/comments-plain-draft` `0e30869` against `origin/main` `5b8007e`. Comment bytes are `total - stripCssComments(css)`, same regex as `.design-sync/build-inputs.mjs`. Share is comment bytes / total bytes. No whitespace normalisation.

Scope: every tracked `app/styles/*.css` plus `app/app.css` (31 files). Admin sheets and `katex*` were not rewritten on this branch; they are included because the glob names them.

## 1. Comment share after the rewrite

| file | total | comment | share |
| --- | ---: | ---: | ---: |
| app/app.css | 60,998 | 40,954 | 67.1% |
| app/styles/admin-editor-feedback.css | 5,595 | 2,763 | 49.4% |
| app/styles/admin-editor.css | 26,255 | 10,883 | 41.5% |
| app/styles/admin-history.css | 2,093 | 884 | 42.2% |
| app/styles/admin-media-later.css | 28,157 | 15,758 | 56.0% |
| app/styles/admin-media.css | 70,704 | 41,967 | 59.4% |
| app/styles/admin-posts.css | 33,473 | 17,618 | 52.6% |
| app/styles/admin-shell.css | 63,785 | 43,245 | 67.8% |
| app/styles/ask.css | 1,654 | 164 | 9.9% |
| app/styles/blog-index-extras.css | 730 | 0 | 0.0% |
| app/styles/blog-index.css | 3,052 | 1,217 | 39.9% |
| app/styles/blog-search.css | 1,293 | 725 | 56.1% |
| app/styles/chrome-nav.css | 5,138 | 3,353 | 65.3% |
| app/styles/katex-overrides.css | 2,408 | 2,295 | 95.3% |
| app/styles/katex.generated.css | 25,202 | 3,173 | 12.6% |
| app/styles/motion-print.css | 2,815 | 1,528 | 54.3% |
| app/styles/page-shell.css | 1,139 | 595 | 52.2% |
| app/styles/palette-dialog.css | 4,544 | 701 | 15.4% |
| app/styles/playground.css | 6,895 | 1,981 | 28.7% |
| app/styles/post-enhancements.css | 6,399 | 2,470 | 38.6% |
| app/styles/post-shell.css | 3,125 | 1,223 | 39.1% |
| app/styles/projects.css | 5,387 | 2,574 | 47.8% |
| app/styles/prose.css | 12,593 | 8,141 | 64.6% |
| app/styles/public-chrome.css | 3,214 | 2,473 | 76.9% |
| app/styles/publications.css | 7,968 | 3,315 | 41.6% |
| app/styles/reset.css | 5,383 | 2,173 | 40.4% |
| app/styles/search-facets.css | 1,467 | 0 | 0.0% |
| app/styles/search-page.css | 2,164 | 145 | 6.7% |
| app/styles/search-trigger.css | 1,237 | 895 | 72.4% |
| app/styles/shell.css | 3,714 | 1,972 | 53.1% |
| app/styles/skip-link.css | 1,246 | 915 | 73.4% |
| **31 files** | **399,827** | **216,100** | **54.0%** |

The 22 public design sheets (the rewrite's subject) total 142,155 bytes, 77,514 comment, **54.5%**. Same share as the glob. The rewrite cut 35,676 bytes of comment from those 22 sheets (20.1% of their previous file size) and left the share still above half.

By lines, using Arafat and Riehle's density (comment lines / (comment lines + code lines), blanks out): **30.2%** over the 31 files (3,325 / 11,027). Byte share is higher than line share because the comments are prose paragraphs and the rules are short declarations.

### What is typical

Arafat and Riehle, "The Comment Density of Open Source Software Code", ICSE NIER 2009, and the accompanying note "The sweet spot of code commenting in open source" (2009): across more than 5,000 active OSS projects, average comment density is about **19%** of non-blank lines (one comment line in five). They call ~20% the sweet spot. By language, JavaScript sat at **16%** (276 projects); CSS was not reported separately. Source: https://dirkriehle.com/2009/02/04/the-sweet-spot-of-code-commenting-in-open-source/ and https://dirkriehle.com/2008/11/10/how-open-source-comments-by-programming-language/

This tree is about 1.5 times that line density after a rewrite whose point was to shorten comments, and about 54% by bytes. That is not a maintained CSS codebase's usual comment rate. It is a design-rationale archive stored inside stylesheets.

Shipped CSS is a different question. Vite production sets `cssMinify` from `build.minify` (esbuild). Readers do not download these comments. Project Wallace's 2026 CSS census (comments in *shipped* CSS, p50 = 729 bytes) is that other question and does not describe source.

## 2. Reasoning-in-file, against "a rule that makes the site worse gets changed"

The rule, as practised: the why sits in the file next to the thing it protects. CLAUDE.md states the hard rules with their gates. `.design-sync/NOTES.md` says the measurements for `stripContrastTier` "stay where the code is" and that NOTES.md itself holds only what the next sync agent needs. Stylesheet comments are the same rule applied to CSS. Capsid vol 10 (2026-08-26) made it explicit for this corpus: "Comment volume stays (both readers found the reasoning load-bearing); only the numbers and tenses go."

The overriding rule is the one vol 10 used to reverse public unhydration (2026-08-27): "the standing rule that a rule that makes the site worse gets changed."

### What it has demonstrably caught or prevented

**Caught, after the damage:** `763688b` restored the header. Build 2 simplified the wordmark `:visited` / `:hover` selectors. The comment in `public-chrome.css` already said they are `(0,2,0)` and "Do not 'simplify' them away." The global `a:visited` at `(0,1,1)` beat the replacement at `(0,1,0)`, and returning readers saw the site name in visited plum on the purple bar. The comment diagnosed the defect. It did not stop the defect.

**Failed as the only delivery path:** ruling 109, `4604baf`. `build-inputs.mjs` stripped comments on the way to the canvas and claimed "nothing is lost by dropping them here." That claim is falsified in the same file's later comment and in `scripts/build-guidelines.mjs`: the canvas never saw the warning, so it could not honour it. The strip stays (the converter greps `@import` without stripping comments, and `app.css`'s prose about removing `@import "tailwindcss"` failed that gate twice). The repair was to stop discarding, not to stop stripping.

**Predicted, then still happened:** NOTES.md said the hand-maintained `SHEETS` list would go stale. It did. `shell.css` was imported by `root.tsx` and missing from `SHEETS`, so the canvas never saw `.tracks`. Ruling 111 added `check:design-sheets`. The note was right and was not a substitute for a gate.

**False as a truth store:** vol 10, Fable's sample: 10 of 18 load-bearing prose claims were false at HEAD (comments, colophon, posts). That is why rule 17 forbids numbers and tense-bound state in prose. `65181eb` is a small later instance: `site-header.tsx` said `flex-wrap: nowrap` and cited 629px, the number its own table had just discredited, while `public-chrome.css` shipped `wrap`. The comment was copied into `build-guidelines.mjs` and into `singletons.md`. One wrong sentence became three.

**Protected a DELETE path, once an automated cutter ran:** ruling 114 / `scratchpad/code-findings.md`. `aislop fix --safe` deleted eight comments, including "a transient read failure cannot cause a deletion" on a media rebuild DELETE. The audit reverted rather than committed. Ruling 113: two readers tagged 351 stylesheet blocks; KEEP 238, 96% of comment weight survived; 12,821 bytes (6.7%) cut.

So: the comments are useful to a reader of that file, and they are not a control. When the editor does not read the file, they do nothing. When they rot, they spread.

### What it costs

- 216,100 bytes of comment in 399,827 bytes of these sheets, after a shortening pass. Admin is the same shape (admin-shell 67.8%, admin-media 59.4%) and was not in the rewrite.
- A second pipeline so a design agent can see them at all (`build-guidelines.mjs`, `check:guidelines`, README-header prohibitions). Ruling 109 exists because in-file was not enough.
- Maintenance of claims that a gate does not own, which is the defect class vol 10 named as the site's largest.
- Comments that match code assertions (FAILURES.md: "A comment can satisfy an assertion about code, and can fail one"). Hard rule 10 already strips comments before matching, because they lie in both directions.

It does not cost the reader a stylesheet byte in production.

### Help or hurt the site

The site a visitor sees is not helped or hurt by these comments. Vite minifies CSS in production.

The site as a designed object was hurt once by trusting in-file comments to reach a consumer that never reads files: the visited wordmark. It was helped when a later session read those same comments and restored the selectors. The comments are a good log. They are a bad lock.

CLAUDE.md already split this for the hard rules: the file holds rules and gated facts; procedure is in skills; history is in Capsid. NOTES.md already split it for the sync: measurements stay next to the function; the note holds only what a re-sync must not rediscover. The stylesheets did not get that split until the slop audit (cut the rest) and the plain rewrite (shorten what remains). Even then, share is 54%.

### Stay, change, or go

**Change.** Do not delete it, and do not keep it as the only copy of a prohibition.

Keep: a short why or prohibition next to the CSS rule it protects, owned by that sheet (rule 17: one owner). That is what stopped `aislop` from being committed, and what made the header restore possible. The plain rewrite is the right size for that job if the why survives (see `scratchpad/grok-review-comments-plain.md` for five that did not).

Stop treating volume as a virtue. Vol 10's "comment volume stays" was a reaction to a proposed cut of reasoning. It is not a floor. 54% bytes after a shortening pass is still an archive in the stylesheet.

Move delivery out of hope:

- Numbers and tense-bound claims stay in the gate that measures them (rule 17, already).
- Anything a design agent must not break is extracted (`build-guidelines.mjs`) or asserted (`check:logo` on the mark fills, `check:design-sheets` on `SHEETS`). Ruling 109 and 111 are this change, already made, for the two failures the comments did not prevent.
- NOTES.md stays operational. It does not replace a gate. The `SHEETS` drift is the proof.

If a comment cannot be read while editing the rule, it is in the wrong file. Capsid already holds history. The stylesheet should not.
