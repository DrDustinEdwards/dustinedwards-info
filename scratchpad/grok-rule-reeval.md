# Seven lock rules against “if it does not make the site better, change or delete it”

Public plane only. Admin stays the forked kit. Evidence is commit history on this repo plus the live footer rename, not the direction-D prose.

Standard used: a rule that only prevents a 2025 look, without making a page easier to read or operate, is narrowed or deleted.

---

## 1. No purple or dark footer band — **keep, narrowed to “no second surface”**

**Where it came from.** Not from Swiss theory. From undoing a shipped identity. `1861560` (2026-08-13) ratified chrome-purple-v4 after visual review: header *and* footer became `--surface-chrome` (light `#4f2d7f`, dark hero `#3d2a5c`) with five role tokens. That made every public page a branded frame. Later the live footer stopped being that frame: `433c947` / `#38` deleted dead `.site-footer` rules that still carried the chrome fill; `root.tsx` and all 14 routes emit `ShellFooter` as `.site-shell-footer` on `--paper` (`shell.css`). Print then leaked the footer until `39a537f` hid `.site-shell-footer` the way `.site-footer` used to be hidden.

**Does the page need a terminal?** Yes. End-of-page is a real job. A purple or dark *band* is not required for it. A 1px `--dust` rule, sentence-case links, and the colophon line already close the document. A second surface at the bottom restates the header and fights the paper plane the rest of D is built on.

**Keep:** footer is paper. No `--surface-chrome`, no dark slab.
**Narrow:** the rule is “no second surface at the foot,” not “no footer.” The terminator is the dust rule plus links. That *does* make the site better: you can tell the article ended without a product chrome bar.

---

## 2. No fills anywhere — **narrow**

**History.** The lock wrote this to kill filled Search / Playground Compute / blog Search pills and the standing “one filled primary per page” law that kept reproducing them. Admin already ships status pills (`08d86ef`, posts index). Public anatomy already chose an ink underline for the current nav item, not a colour change.

**Does a selected filter or tab need a fill?** Rarely. In a short exclusive set (year filter, two tabs), a 1px ink underline or a change to `--text` weight is enough and stays a document. In a long roster of mutually exclusive chips, a fill is easier to scan — and that is the moment the control has become product UI. Do not solve that by filling; solve it by not making a chip set.

**Underline cost.** Cheaper than a fill on paper. Worse than a fill only when the control is 8+ siblings and the underline is 2px from the next row. Then the set is wrong, not the underline.

**Narrow to:** no filled public *surface* (header, footer, button, well, search, login). Selected state is ink + underline or ink weight. Error may fill when the state is real. Admin may fill. The mark’s purple/gold fills are the mark, not a page fill.

---

## 3. Radius 0 everywhere — **narrow**

**History.** Live public CSS mixed `0.375rem`, `0.5rem`, `0.75rem`, and `999px` (search/theme pills, chips, login card, playground wells). Admin floating selection bar was explicitly kept at `13px` radius (`109a997`, 2026-08-16). The lock’s “0 including controls” was to stop that mix reading as unfinished product UI on sharp paper.

**Should overlays get a radius?** Yes, a small one. A square tooltip or image viewer on square paper does not separate “floating thing” from “page.” A 4–8px radius on something that *leaves* makes the page feel more square, not less. `999px` and the login card radius do the opposite.

**Narrow to:** radius 0 on the page, wells, login, inputs, public buttons, header icons. Overlays that float and leave (dialog, image viewer, tooltip) may use one named token, small, never a pill. Admin keeps `--radius-control`.

---

## 4. One 60–72ch column — **narrow (prose rule, not page rule)**

**History.** `--measure` is the live token. `--col-full` was deleted in `b1e7bc3` (ruling 2) because its only consumer was build 2’s dead shell; `shell.css` `.tracks` reads `--measure` and gutters. `6f259704` found every public page scrolled horizontally at 320 because the text track used `min(--measure, 100%)` against a grid that already summed fixed tracks — the measure was applied as a *page* width and broke the chassis.

**Tables, roster, charts.** They want the track, not 64ch. D’s own anatomy already allows a table, bibliography, or roster photo-plus-names as not-a-card-grid.

**Narrow to:** 60–72ch is the *reading* measure (posts, about, dek). Indexes, publications, roster, playground wells, and figures/charts use the full text track inside `.tracks`. Do not invent `--col-full` again; use the track that already exists.

---

## 5. No atmosphere yet — **narrow (judge one static move; do not defer forever)**

**History.** `scratchpad/grok-dust-material.md` (`51e619f` on `review/grok-dust`) already named the first live experiment: footer settling gradient and/or one static figure haze, CSS only, print and reduced-motion off. Direction D then froze atmosphere at zero so the mocks would not become a texture pack. That freeze was a sequencing rule, not a finding that atmosphere makes the site worse.

**Defer again?** Not as law. Deferring a *second* time without a live judge does not make the site better; it only keeps the question open. Building motes, scroll-light, or view-transition dust still makes it worse.

**Narrow to:** no atmosphere on reading pages in this pass. One static footer settle *or* one figure haze may be built on home (page 2) and judged at 375/1280, both themes, print, `prefers-reduced-motion`. If it is visible in a 100% screenshot, delete it. No motes, no scroll timeline.

---

## 6. Mono for all machine data — **keep, with a density cap**

**History.** A’s keep-list (dates, DOIs, IDs, evidence, code, colophon) is the only part of direction A that survived. The rail is where that list lives. Nothing in the repo contradicts it. The failure mode is not “mono is ugly”; it is a rail that restates the essay in small caps.

**When is it a terminal readout?** When the rail holds more than about six mono lines above the fold on a reading page, or when a sentence is set in mono because it contains a number. Playground and phage tool pages may run denser — that is the instrument.

**Keep:** mono only on dates, DOIs, IDs, hashes, byte counts, `n=`, code, colophon.
**Cap:** reading-page rail ≤ 6 mono facts before the first paragraph. Extra facts go in history / colophon, not stacked in the rail. Prose stays Inter or serif.

---

## 7. Kill list as word bans — **narrow (rewrite as conditions)**

Word bans teach models to hide the class name and keep the object. Conditions survive a rename.

| Word | Condition |
|---|---|
| Card | A public block that is a raised or bordered rectangle around a title + summary + action, with radius or shadow, used as a repeating unit. Index rows and head-block grids are not this. |
| Bento | Equal-tile or auto-fit card grid on a public page. A table, bibliography, or roster of photo + name + mono id is not this. |
| Pill | `border-radius` ≥ 999px or a capsule whose height ≈ width of its text. Header icon buttons are squares or 0-radius, not capsules. |
| Chip | A compact selectable token whose selected state is a filled capsule. A filter that is a text link or an underlined tab is not this. |
| Tracked caps | `letter-spacing` used with `text-transform: uppercase` on labels, eyebrows, or section indexes. Mono dates are not this. Sentence case is the public label case. |

Do not ban the English words in copy (“this paper,” “a chip in the protocol”).

---

## What changes in the lock if this is stamped

- Footer: paper + dust rule. No chrome fill. (Already how `.site-shell-footer` ships.)
- Fill: none on public surfaces; selected = underline or weight; error/admin exempt.
- Radius: 0 on the page; small named radius only on overlays that leave.
- Measure: prose 60–72ch; data uses the track.
- Atmosphere: one static experiment on home, judged live; else none.
- Mono: keep-list + 6-fact cap on reading rails.
- Kill list: the five conditions above, not the words.
