# Code-history-out wave 1 review: `review/code-history-out-wave1-draft` vs `main`

Compared `origin/main` `cdb4300` to `origin/review/code-history-out-wave1-draft` `c1472b3`. The branch deletes 52 HISTORY comment blocks in the ten heaviest code files and shortens the rest; executable code is unchanged.

Dated floor logs, plant stories, and session headings that still have their why beside the rule are not listed. Those moved on purpose under ruling 115 and hard rule 17. What follows is meaning a reader of the new comment no longer has.

Three restorations the proofs named, and which this review found still on disk: check-invariants still says to revisit gate 4 and 3d once Part A's scales land (ruling 88); check-browser still says there is no test-only auth bypass; admin.media still says harness seams are capped at three.

## Lost or changed meaning

### 1. `scripts/check-browser.mjs` (header-nav fallback)

**Old:**

> MEASURED 2026-09-14 on the deployed site, at 375, 768, 1024 and 1280: `.site-header-nav` computes `display: none` at EVERY width. `shell.css` declares it hidden under the comment "The six destinations, at 64rem and up only" and no rule anywhere un-hides it, so build 2's desktop nav ships as six links no reader can reach. That is a site defect and it is REPORTED rather than absorbed here.

**New:**

> The header nav is hidden below 64rem, and a hidden link clicks at (0,0).
>
> A hidden element's zero box clicks the document corner, so it fails. Falls back to the overflow menu's copy; fails if neither is laid out.

**Lost:** The live finding. The remaining comments describe the intended 64rem breakpoint. They no longer say the bar is `display: none` at 1280 as well, or that the overflow fallback is covering a desktop defect rather than a mobile one. No tracker.

### 2. `scripts/check-browser.mjs` (`maskTheme` set)

**Old:**

> THE SET SHRANK ON 2026-08-29, and shrinking is the strict direction.
>
> A third entry masked `aria-pressed`, because the theme control was three buttons and the pressed one moved with the theme. The control is one button now and carries no pressed state: BOTH of its buttons ship in every document and the cascade displays whichever matches `data-theme`, so the markup of the control is byte-identical between light and dark and there is nothing about it to mask.
>
> That makes the comparison below STRONGER rather than weaker. Two things are now allowed to differ where three were, so a control that started varying its own markup by theme would fail here instead of being masked.

**New:** (block deleted.) The mask comment is now:

> What the theme may change; after masking, the documents must be identical.

**Lost:** The prohibition on growing the mask. Putting `aria-pressed` back in would hide a control whose markup started varying by theme, and the remaining assertion still passes, because more masking makes two documents more alike. The theme-flip case still fails if a third button returns; it does not fail if the mask grows.

### 3. `scripts/check-browser.mjs` (hover before the header click)

**Old:**

> A REAL CLICK ON THE HEADER LINK, hovered first. This was written when a click with no dwell could activate a PENDING prerender, which puppeteer cannot follow: the page stayed on `/` and the case asserted against a navigation that never happened. The action is `prefetch` now and the guard above forbids prerendering regardless, so the hover is no longer load-bearing; it is kept because a hovered click is the more realistic gesture and costs nothing. The arrival is still checked below.

**New:** (block deleted.) The code still does `mouse.move`, waits 350ms, then `mouse.click`.

**Lost:** Why the hover is still there. It reads as dead prerender-era machinery. The remaining comments explain the zero-box fallback, not the dwell.

### 4. `app/db/index.ts` (default media sort)

**Old** (HISTORY block, deleted because the next block "repeated" it, then the next block was shortened):

> ROLE FIRST, then newest.
>
> `uploaded_at DESC` alone put every static row last, because a build-time asset has no upload event and SQLite sorts NULL below everything. The effect was backwards: the 12 generated cards you can neither insert nor delete came first, and the 9 roster photos, the only insertable images in the corpus, landed on pages 2 and 3.
>
> So content sorts first as a rank, and only then by date. A CASE rather than a second column: the ordering is a property of this VIEW, not of the asset, and storing a sort key would be storing a UI decision in the index.

and, still in the following block:

> That reasoning applies to the DEFAULT ordering and to nothing else: a reader who asked for "largest first" wants the largest file, not the largest content file followed by the largest brand file.

**New:**

> Role rank is the default sort only. `key ASC` keeps offset pagination stable.

**Lost:** Why the CASE exists (NULL `uploaded_at` on static rows inverts the library). Why the rank must not prefix an explicit sort. Why the rank is a CASE in the view and not a stored column.

### 5. `app/db/index.ts` (`mediaTwins`)

**Old:**

> EXACT IDENTITY ONLY, and this is a boundary rather than a first pass. [...] There is no perceptual comparison, no resize detection, no similarity score, and none is coming: a "these look alike" feature would put a judgement call in front of a delete button, and the whole safety argument of this library is that deletion decisions are answerable from facts.
>
> The hash is READ OFF THE KEY, never recomputed. [...]
>
> WHY THIS IS NOT A DUPLICATE-DELETION FEATURE. Two rows sharing bytes are two separate objects at two separate public URLs, and either may be cited. The page offers to TRASH one, which changes what the library shows and leaves both URLs serving.

**New:**

> Twins by the key's content hash, exact only. The page offers trash, not delete.
> Static rows are excluded: their keys are paths.

**Lost:** The prohibition on a look-alike feature in front of delete. The contract that the hash is read off the key, never by fetching R2. That trash leaves both URLs serving, so this is not a duplicate-deletion feature.

### 6. `scripts/check-features.mjs` (file header)

**Old:**

> The consequence to know about BEFORE it happens: the next feature that anchors to a nested PUBLIC route will fail here, and the failure will read like rot in the anchors file when it is really this parser's limit. Either anchor it to the child segment as declared, or teach the parser to compose prefixes. Do not "fix" it by hardcoding a path list, which is the mirror this whole family of gates exists to prevent.
>
> Four anchor kinds. Three are verifiable here and one is not: route / gate / assertion / decision [...].
>
> No route path, gate name or script filename appears in this file as a literal.

**New:**

> The route parser does not compose nested prefixes: anchor a nested route to its declared segment, never to a hardcoded path list. Every feature needs a route, gate or assertion anchor; a decision anchor lives in Capsid and proves nothing offline.

**Lost:** The next nested public route will fail in a way that looks like a bad anchors file. The file-wide contract that this gate names no path, gate, or script as a literal (the four kind names survive; that contract does not).

### 7. `scripts/check-features.mjs` (WCAG 3 string ban)

**Old:**

> DELETED 2026-08-21: the assertion banning the string "WCAG 3" from this page.
>
> THE LABELING RULING ABOVE STAYS [...]. Banning a two-word string said what the page may not SAY, which is a different and worse thing. [...] The ban made the next TRUE sentence fail the build, which is a gate holding a page back from being more correct rather than stopping it being wrong.
>
> The failure it guarded, a page claiming conformance to a level that has none, is already impossible: the assertion above requires WCAG 2.2 to be named as THE target.

**New:** (block deleted.) The two labeling assertions remain (WCAG 2.2 as the target; APCA not part of any standard).

**Lost:** The prohibition on restoring a string ban. The remaining assertions still require the honest claims; they do not say why a `/WCAG 3/` refusal was the wrong instrument.

### 8. `scripts/ship.mjs` (deleted step 1b)

**Old:**

> STEP 1b, THE STATED-ABSENCE PLACEHOLDER CHECK, WAS DELETED 2026-08-21.
>
> It iterated `const PLACEHOLDERS = []` and printed "no stated-absence placeholders are declared, so nothing was checked here." [...]
>
> A dead loop kept for a hypothetical successor is not a mechanism, it is a shape. Re-adding it when a second stated absence appears is six lines and a comment, and writing those six lines with a real subject in hand produces a better check than reviving a generalisation drawn from one case.
>
> The property it guarded is NOT lost. `check:admin-ui` asserts both halves on the rendered page.

**New:** (block deleted.)

**Lost:** The prohibition on putting an empty PLACEHOLDERS loop back in ship, and the pointer that the property lives in check:admin-ui.

### 9. `scripts/verify-live.mjs` (Ask probe cap)

**Old:**

> Billed per answer and rate limited to five per minute per IP, so this is capped and the cap is printed. A silent cap reads as full coverage.

**New:**

> Billed, so capped, and the cap is printed.

**Lost:** The rate-limit arm of the why. `ASK_PROBE_LIMIT` is 3; `ASK_RATE_LIMIT` is 5 elsewhere. The remaining comment reads as if billing is the only reason the loop is sliced, so raising the probe count looks like a coverage improvement rather than a collision with the per-IP limit. "A silent cap reads as full coverage" is also gone; the print is still in the code.

## Comment-stripped source

The stripper is `stripComments` from `scripts/lib/strip-comments.mjs` (the gates' tokenizer), default options: each comment becomes a space, no `preserveLines`. All ten files were compared from `origin/main` to the draft.

Raw strip is not byte-identical. Every file is smaller on the draft side, by leftover empty lines: a deleted or shortened own-line comment leaves a whitespace-only line in the stripped original and no line in the stripped draft. Deltas: check-browser -170, check-invariants -256, check-admin-ui -762, check-features -108, verify-live -680, admin.media._index -524, app/db/index -878, ship -10, check-contrast -602, check-all -130.

Dropping whitespace-only lines (and trailing blanks on remaining lines), all ten files are byte-identical. Mismatch count on that comparison: 0. A one-character mutation of code in the original is detected, so the comparison can tell two things apart.

No inserts. Pairing comments by non-whitespace code offset: 52 deletes, 1309 rewrites, 652 keeps (the apply TSV counts 52 / 1306 / 655; the three-count gap is adjacent comments sharing an offset).
