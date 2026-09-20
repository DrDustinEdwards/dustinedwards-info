# Lock reeval against “a rule that does not make the website better is changed or deleted”

Independent pass. Public plane only. Admin stays the forked kit.

First pass on this branch is `5d4e67f`. This file replaces it. Where the two disagree, the reason is in the row.

Standard: keep, narrow, or delete. Evidence is this repo’s history and what ships on `origin/main` at `0b9fe7b` (post page D in `435b288`, evidence row in `edf461a`). Not guessed from the lock prose.

---

## 1. No purple or dark footer band — **keep**

**Where it came from.** Chrome-purple-v4 (`1861560`, 2026-08-13) painted header *and* footer `--surface-chrome`. Every public page was a branded frame. `app.css` still says “the header and footer are a brand surface.” The brief already reversed the footer: limestone, 1px dust, no purple fill. Live `ShellFooter` is `.site-shell-footer` on `--paper` (`shell.css`). `433c947` deleted the dead `.site-footer` block that still carried the chrome fill. `39a537f` hid the shipped footer in print.

Body is `--bg` (`#faf7f2` / `#1a1614`). Paper is a hair off that. A paper footer is a faint join, not a band.

**Does the page need a terminal?** Yes. A filled band is not required. The dust rule, sentence-case links, copyright, and the machine links already say the document ended. A purple or charcoal slab restates the header. `shell-footer.tsx` already names that failure: a footer that repeats the header’s brand is a second header.

**Keep:** footer is paper. No `--surface-chrome`, no dark slab.
**Do not add** a settling gradient on the footer in the same pass. That is atmosphere, question 5.

Agrees with `5d4e67f` on the keep.

---

## 2. No fills anywhere — **narrow**

“No fills” is right for paper, cards, and slabs. It is the wrong rule for *state*.

Researched rule (`design-rules-researched-2026-09.md`): a selected chip gets a toned container plus a non-colour cue, never the full brand fill, never colour alone. Brief: `aria-current` plus weight, dust border, no purple outline.

Live public code still uses the product fill the lock is trying to kill:

- `.tag-chip[aria-current="true"]` and `.pub-chip-active`: full `--brand` fill.
- `.search-chip[aria-current]`: `--tint-brand` plus brand border plus weight. That is the three-channel pattern admin already documents.
- Header current page: a colour step, no fill.
- Year archive: colour plus weight, no fill.

Chips already opt out of the link underline because they have a border (`app.css` rule 2). Putting the underline back as “selected” makes the current chip look hovered, not on. In a row of topic chips, a 2px underline is easy to miss. Weight plus a stronger edge is not. A light `--tint-brand` is the researched extra channel and still is not a purple pill.

`5d4e67f` said “do not make a chip set” and “selected = underline.” Publications, blog tags, and search already *are* chip sets, and they work without script because they are links. Delete the fill, not the control.

**Narrow to:** no filled public *surface* (header, footer, well, card, login). Selected filter or tab: `aria-current`, weight, dust-to-brand edge. Tint allowed. Full `--brand` fill is not. Underline stays for prose links, not for chip state. Error may fill. Admin may fill.

---

## 3. Radius 0 everywhere — **narrow**

Radius 0 on paper, wells, and cards is the Swiss language. Radius 0 on a dialog sitting on a scrim is a torn rectangle. Those are different objects.

Live public CSS still mixes `0.375rem`, `0.5rem`, `0.75rem`, and `999px` pills (`chrome-nav.css`, `search-trigger.css`, `blog-search.css`, `.gate-card`). `fb6a988` restored the header pills on Dustin’s instruction; the shots refuted “the circles are old.” `--radius-control` is already `0.125rem`. Palette dialog is `0.625rem`. Footnote preview is `0.5rem`. Lightbox image is `0.375rem`. Lightbox close is a `999px` pill, which is the thing to refuse. Hard rule 5 already treats popovers as a different elevation (`--border-strong`).

A small radius on an overlay is how you tell “this is a layer,” the same way a dust rule tells “this is paper.”

**Narrow to:** public paper, wells, inputs, buttons, chips, and login stay 0. Dialogs, the image viewer, tooltips, and the palette may use one small named token (`--radius-control` to `0.5rem`). No pills. Admin keeps its radii.

Agrees with `5d4e67f` on overlays. Differs on chips: they stay 0, not capsules.

---

## 4. One 60 to 72ch column — **narrow (prose rule, not page rule)**

`--measure` is `42rem`, about 66 characters (Bringhurst; researched rules). The token comment is the answer: the track is the measure, so a full-bleed figure and a paragraph share one source. `.tracks` already has `text`, `wide`, and `full`. Almost nobody uses it. Only the footer sits on `.tracks`.

Roster photos live in `.page-inner` at `48rem` and `.prose`. Posts were `44rem`. Post page D now sets `--measure: 64ch` on `.post-tracks` *in the reading face*, because `ch` resolves against the element’s font (`post-rail.css`). Charts skill: a drawing wider than about 700px scales down and takes its type with it. `6f259704` is the history of applying the measure as a page width: every public page scrolled sideways at 320.

Writing “one 60 to 72ch column” as a *page* rule freezes that trap. A roster photo, a publications table, and a chart are not prose.

**Narrow to:** 60 to 72ch is the measure of running text. Figures, tables, roster photos, and charts use the wide or full track. Other public pages do not become bento because they went wide. Do not bring back `--col-full`.

Agrees with `5d4e67f` on the narrowing.

---

## 5. No atmosphere yet — **delete as a lock rule. Build figure haze on the post. Do not put it on the footer or on home first.**

“No atmosphere yet” is a sequencing note. It does not make a page better. It keeps Light, the one element Dustin ruled to keep and grow, as tokens nobody paints.

**What ships.** `--lamp-origin`, `--lamp-reach`, `--surface-catch`, `--lamp-chroma-on-paper` are declared and carried (`check:invariants` still labels them “the lamp on the glass controls, ruling 74”). `prefers-reduced-transparency` already zeros `--surface-catch`. There is no `radial-gradient` consumer. `/playground/ui` says it in words: “The lamp on the search field. The glass fill is legal on /search over paper and nowhere else, and the utility that applies it does not exist yet.” `--lamp-chroma-on-bar` left with the bar (`ff4241f` / ruling 6). Header glass is gone. Paper lamp was never applied.

**Defer again?** No, not as law. The tokens have been specified since ruling 65. Deferring a second time without a live surface is how they stay a contrast-matrix row about no reader’s screen (hard rule 10, same shape as the dead `--bar-fill` pairs).

**Footer settle?** The footer has already settled: paper plus a 1px dust rule. Do not add a settling gradient or a lamp on that join in the same pass. That stacks two unjudged changes on a surface that just stopped being chrome. Judge the paper footer first, on every page, because the footer is a singleton.

**Figure haze on page 2 (home)?** Home is the wrong first surface. The lock is removing home’s wells and metric tiles. Part B page 1 is `/blog/:slug`, and it has already landed (`435b288`) with figures, a rail, and an evidence row. Figure haze belongs where a figure already argues. The brief’s candidate list was: search field, Ask panel, home name area, figure containers, footer edge. Search is late in Part B. Footer just became paper. Home name-area lamp is a later candidate, not page 2’s job if page 2 is an emptied home.

**Build this:** one static haze on a post figure (`::after` or the figure wrap, `--lamp-chroma-on-paper` mixed into transparent, `--surface-catch` at the token values that already exist). CSS only. Print off. `prefers-reduced-motion` keeps it static. `prefers-reduced-transparency` already goes to zero. Judge at 375 and 1280, both themes, on a real post. If it is the first thing you notice in a 100% screenshot, delete it.

Stay out: grain on `html`/`body`, motes, scroll-driven light, view-transition dust (`scratchpad/grok-dust-material.md` on `review/grok-dust`, `51e619f`). Those are the texture pack. Haze is the only Light join that does not move.

`5d4e67f` put the experiment on home and allowed a footer gradient. That is the disagreement.

---

## 6. Mono for all machine data — **keep, with the density the post page already named**

Mono is for tokens a machine would emit: dates, DOIs, IDs, hashes, byte counts, gate names, `n=`, code. It is not for sentences about those tokens.

**What ships.** `edf461a` made the evidence row a site object: exactly three facts, or nothing, all `--font-mono` at `0.75rem`, two dust hairlines (`evidence-row.css`). Home, the post, and the colophon each pass a different three. `post-rail.css` sets chronology in mono (“the date the row carries, not prose about it”) and the contents list in sans (“navigation a reader reads”). `bf7ba5f` had to return the rail to the text track at one column because a zero-width rail overlapped the article. Project metric values and home `.proof-value` are still Inter at 2rem in `--brand`, which is the old tile voice, not the keep-list.

**When does a rail become a terminal readout?** When a second column is also mono (label + value, or value + unit + as-of), or when a sentence is set in mono because it contains a number, or when the contents list is mono. One mono channel per row: the value. The label stays sans and muted. The evidence row of three is the cap that already shipped. Chronology dates in the rail are the same channel, stacked, still values. Past that, extra facts go in the changelog or the colophon.

`5d4e67f` capped “about six mono lines above the fold.” That number is not measured. The measured cap is three in the evidence row, plus the rail’s dates, with TOC kept sans on purpose.

**Keep:** the keep-list.
**Cap:** one mono channel per row. Evidence row stays three computed facts. Reading-page TOC and labels stay sans. Playground and the colophon’s *values* may be denser; their *prose* may not.

---

## 7. Kill list as word bans — **narrow. Rewrite each as a condition.**

A word ban teaches the next session to rename the class and keep the object. A condition survives a rename. Do not ban the English words in copy.

| Word | Condition (public plane) |
|---|---|
| Card | A repeating public unit that groups title, summary, and a metric or action inside a raised or filled rectangle (radius or shadow counts). A list item with a dust rule is not this. `.post-card` as a class name on a row is not this if it is only type and a rule. `.project-card` with fill, radius `0.75rem`, and a metric tile *is* this. |
| Bento | An equal-tile or auto-fit grid of peer cells used as the page language. A table, a bibliography, a roster of photo plus names, or `.tracks` wide/full is not this. Home `.proof-list` `auto-fit minmax(13rem, 1fr)` of filled tiles *is* this, which is why those tiles go. |
| Pill | `border-radius: 999px` or a capsule whose ends are full semicircles. Header search and theme are this today and the restore in `fb6a988` kept them; under the lock they become square icon buttons, not capsules. A `0.5rem` overlay corner is not this. |
| Chip | A compact selectable token whose *selected* state is a filled capsule of `--brand`. A filter that is a text link with a dust border, `aria-current`, and weight is allowed; the class name may stay. `.pub-chip-active` and `.tag-chip[aria-current="true"]` as they ship *are* this. |
| Tracked caps | `letter-spacing` plus `text-transform: uppercase` on a label, eyebrow, or section index. `.eyebrow` and `.home-section-heading` (`0.08em`, uppercase) *are* this. Mono dates are not. An acronym in a sentence is not. Sentence-case is the public label case. |

`5d4e67f` wrote conditions in the same direction. Differences: chips are allowed as unfilled filter links; pills are banned as a shape even on header icons; “card” is the raised repeating unit, not the word in a class name.

---

## If this is stamped

- Footer stays paper plus a dust rule. No chrome fill, no settling gradient in this pass.
- No filled public surfaces. Selected = weight + edge, tint allowed, no brand pill.
- Page radius 0. Overlays may take one small named radius. No `999px`.
- 60–72ch is prose. Data uses the track.
- Delete “no atmosphere yet.” Build one static figure haze on a post and judge it. Not on the footer, not on home first.
- Mono keep-list, one channel per row, evidence row stays three.
- Kill list is the five conditions, not the words.
