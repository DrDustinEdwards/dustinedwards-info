# Colour system audit, second reader

Report only. Nothing in this branch changes a token, and no recommendation here
is a decision: Dustin has not ruled on any deletion or collapse.

Read-only pass on `feat/ruling-118` at `180d414`, whose tree matches `main` at
`2c01310` for every file this audit reads. Counted on disk 2026-09-21. The first
reader is Grok at `scratchpad/grok-colour-system.md` on `review/grok-colour`
(`1a61dca`); this pass measured everything independently first and then compared,
which is why the disagreements below are worth something.

## Method, stated before any number

A **paint consumer** is a declaration whose PROPERTY paints and whose VALUE
reads the token: `color`, `background*`, `border*`, `outline*`, `fill`,
`stroke`, `box-shadow`, `text-decoration*`, `caret-color`, `accent-color`,
`column-rule*`, `scrollbar-color`. Comments are stripped before anything is
counted, because a token named in a comment is a mention, not a painter (hard
rule 10's tenth class).

An **alias** is `--a: var(--b)`. It is counted separately and never as paint: a
token that is only ever assigned into another name paints nothing by itself.

`app/` and `workers/` are read, 291 files. `scripts/` is not: a file whose name
says it checks is asserting about a token rather than painting with it (ruling
104). Where a script matters anyway, it is named in section 2.

A **palette token** is a custom property in `app.css`'s three theme blocks whose
value resolves to a literal colour, directly or through pointers. That last
clause is load-bearing: a first cut of the census counted 116 tokens because the
type scale is full of `--t-body-family: var(--font-sans)`, which matches a naive
"points at another token" test. Resolving the pointers to see whether they land
on a hex brings it to 102, and that is the number below.

## 1. Inventory, and the headline numbers checked

| Claim | Verdict | This pass measured |
|---|---|---|
| 102 colour tokens declared | **CONFIRMED** | 102 |
| 44 with no paint consumer | **CONFIRMED** | 44 |
| `--text-muted` 54 against `--text-secondary` 162 | **REFUTED AS WRITTEN** | The two are the wrong way round in the job body. `--text-muted` is 161 in 19 files; `--text-secondary` is 55 in 9. Grok's own table has them in the right order (162 and 54), so this is a transcription slip in the job, not a finding, but it inverts the argument: the name the plate uses is the MINORITY one. |
| body paints `--bg` while the plate's ground is `--paper` | **CONFIRMED** | `app/app.css:935` sets `background: var(--bg)`. `--paper` is painted 10 times in 4 files: the header, the footer, the skip link and playground-ui. |

Two independent methods landing on 102 and 44 is the strongest thing in this
document. Everything else is one reader's judgement.

**A number nobody has written down: the two page grounds are 1.072:1 apart in
light and 1.027:1 in dark.** `--bg` and `--paper` are not a visible defect, they
are a maintenance one. Nobody will ever see the difference; what they will do is
pick the wrong one.

### The disagreement that matters: `--border`

Grok records `--border` at 12 paint consumers in 5 files. **This pass measures
115 in 21 files**, and a direct grep of `app/**/*.css` confirms 110 CSS
declarations on its own:

```
border          69      border-bottom   14      border-top      12
border-left      5      border-color     5      box-shadow       3
background       2
```

The gap is the shorthand. `border: 1px solid var(--border)` is the overwhelming
form in this repo and a count that only sees `border-color` misses 69 of 110.
This is not a footnote: Grok's table proposes collapsing `--border` into
`--line-strong` because the two share a light hex, and a 12-site rewrite and a
115-site rewrite are different decisions. Any collapse table is only as good as
the property list behind it.

Smaller variances, all within counting method and none changing a recommendation:
`--brand` 96 here against 98, `--dust` 44 against 42, `--surface` 58 against 61,
`--bg` 39 against 37, `--text-secondary` 55 against 54, `--text-muted` 161
against 162.

### Where the weight actually sits

The palette looks like one system and is two. Paint declarations, split by plane
(`admin-*` sheets, admin routes and components, and playground-ui as the admin
kit's inventory page, against everything else):

| Token | Admin | Public |
|---|---:|---:|
| `--text-muted` | 96 | 59 |
| `--border` | 70 | 40 |
| `--border-strong` | 51 | 3 |
| `--surface` | 36 | 15 |
| `--brand` | 43 | 49 |
| `--text-secondary` | 33 | 22 |
| `--bg` | 26 | 8 |
| `--dust` | 20 | 24 |
| `--tint-brand` | 14 | 5 |
| `--surface-popover` | 17 | 1 |
| `--line-strong` | 20 | **0** |
| `--raised` | 14 | **0** |
| `--text-heading` | 9 | 1 |
| `--paper` | 7 | 3 |

**`--line-strong` and `--raised` have no public consumer at all.** Both are in
Grok's final 24-token list, `--line-strong` as "control edges on paper" and
`--raised` as "code, fields, wells". Those are descriptions of a page that has
not been built: today both are playground-ui only. They are not deletions, but
they are not survivors on the strength of current paint either, and the final
list should say which of the two it is.

**`--text-muted` is not an admin-only problem.** 59 public paints is a real
migration on the public plane, not a rename inside admin.

### Contrast, recomputed

Every ratio in the first reader's figure table reproduced exactly through
`app/lib/contrast.mjs`, against `--paper`:

| Colour | Light | Dark |
|---|---:|---:|
| oxide (400 light / 300 dark) | 5.52 | 5.39 |
| leaf 400 light, 300-dark pair | 4.76 | 5.93 |
| leaf 300 light, the alternative | 3.95 | |
| cadet | 12.61 | 4.62 |
| `--fig-dust-300` | 2.33 | 6.74 |
| `--chart-gold`, for comparison | 3.55 | |
| `--chart-purple` light, which is `--brand` | 9.10 | |

The leaf-400-over-leaf-300 recommendation holds on the measurement: 4.76 passes
text contrast and 3.95 does not.

### The full inventory

102 tokens, ordered by paint count. `Alias` is assignments of this token into
another custom property, which is not paint.

| Token | Light | Dark | Paint | Files | Alias |
|---|---|---|---:|---:|---:|
| `--text-muted` | `#5c5248` | `#b3a99c` | 161 | 19 | 0 |
| `--text` | `#241f1b` | `#e9e1d6` | 137 | 27 | 0 |
| `--border` | `#8a7d6e` | `#746a5f` | 115 | 21 | 0 |
| `--brand` | `#4f2d7f` | `#b7a5e0` | 96 | 30 | 0 |
| `--border-strong` | `#6e6459` | `#8a8075` | 62 | 9 | 0 |
| `--surface` | `#f1ebe1` | `#26201c` | 58 | 17 | 0 |
| `--text-secondary` | `#5b5349` | `#b2a898` | 55 | 9 | 1 |
| `--dust` | `#c9c0b4` | `#6f675c` | 44 | 11 | 0 |
| `--bg` | `#faf7f2` | `#1a1614` | 39 | 17 | 1 |
| `--surface-popover` | `#ebe2d3` | `#322a25` | 21 | 6 | 0 |
| `--tint-brand` | `#ede8f5` | `#2b2440` | 21 | 9 | 0 |
| `--on-scrim` | `#ffffff` | `#ffffff` | 20 | 3 | 0 |
| `--line-strong` | `#8a7d6e` | `#8f857a` | 20 | 1 | 2 |
| `--brand-hover` | `#412764` | `#b9a6d9` | 19 | 11 | 0 |
| `--on-brand` | `#ffffff` | `#1a1614` | 15 | 10 | 0 |
| `--border-warning` | `#a67c24` | `#9c8347` | 14 | 7 | 0 |
| `--raised` | `#ece6da` | `#232019` | 14 | 1 | 0 |
| `--text-heading` | `#2b2320` | `#ede6dc` | 13 | 7 | 0 |
| `--scrim` | `#1a1614` | `#1a1614` | 13 | 7 | 0 |
| `--border-danger` | `#c4677a` | `#9c5766` | 10 | 6 | 0 |
| `--paper` | `#f4efe6` | `#1c1916` | 10 | 4 | 4 |
| `--text-disabled` | `#a09990` | `#6f685e` | 9 | 4 | 0 |
| `--on-tint-danger` | `#7c0e20` | `#f0aeba` | 8 | 5 | 0 |
| `--tint-danger` | `#f7e1e1` | `#3a2226` | 7 | 6 | 0 |
| `--on-tint-warning` | `#6b4f07` | `#e5c078` | 7 | 4 | 0 |
| `--visited` | `#5a2b63` | `#a898cd` | 6 | 5 | 0 |
| `--focus-ring` | `#4f2d7f` | `#b7a5e0` | 6 | 4 | 0 |
| `--tint-warning` | `#f6eac8` | `#3a311a` | 6 | 4 | 0 |
| `--border-success` | `#5e7c6a` | `#6e8259` | 6 | 5 | 0 |
| `--text-accent` | `#7a3e12` | `#ce7f44` | 6 | 2 | 0 |
| `--error` | `#8e1024` | `#f0a9b4` | 6 | 1 | 3 |
| `--text-warning` | `#7a5a08` | `#e2bc6b` | 5 | 3 | 0 |
| `--fill-warning` | `#e0a428` | `#e9b44c` | 5 | 3 | 0 |
| `--text-danger` | `#a1122a` | `#ec9aa8` | 4 | 3 | 0 |
| `--fill-danger` | `#8e1024` | `#a62239` | 4 | 3 | 0 |
| `--brand-pressed` | `#2f1a4d` | `#a08ecd` | 4 | 1 | 0 |
| `--brand-active` | `#2f1a4d` | `#c9baea` | 3 | 2 | 0 |
| `--text-success` | `#3e5d4b` | `#93b29b` | 3 | 3 | 0 |
| `--fill-success` | `#3e5d4b` | `#8fac77` | 3 | 3 | 0 |
| `--surface-code` | `#f1ebe1` | `#26201c` | 2 | 1 | 0 |
| `--selection-bg` | `#d9ccee` | `#4a3a6b` | 2 | 2 | 0 |
| `--focus-ring-on-brand` | `#f3e3b8` | `#2f2410` | 2 | 2 | 0 |
| `--fill-danger-hover` | `#75091c` | `#8e1024` | 2 | 1 | 0 |
| `--on-fill-danger` | `#ffffff` | `#ffffff` | 2 | 1 | 0 |
| `--tint-success` | `#e3ebdd` | `#252c1e` | 2 | 2 | 0 |
| `--on-tint-success` | `#31503e` | `#93b29b` | 2 | 2 | 0 |
| `--text-destructive` | `#8a3324` | `#e5947f` | 2 | 2 | 0 |
| `--mark-bg` | `#f3e3b8` | `#4a3d1e` | 2 | 2 | 0 |
| `--chart-cadet` | `#142b42` | `#5887b5` | 2 | 2 | 0 |
| `--on-fill-warning` | `#2b2320` | `#1a1614` | 1 | 1 | 0 |
| `--on-fill-success` | `#ffffff` | `#1a1614` | 1 | 1 | 0 |
| `--tint-destructive` | `#f5e8e4` | `#3a201b` | 1 | 1 | 0 |
| `--chart-purple` | `#4f2d7f` | `#c0b0e6` | 1 | 1 | 0 |
| `--chart-claret` | `#9b3268` | `#c9699e` | 1 | 1 | 0 |
| `--chart-sage` | `#55684a` | `#93b29b` | 1 | 1 | 0 |
| `--chart-gold` | `#9a7a0e` | `#efd99c` | 1 | 1 | 0 |
| `--chart-rust` | `#8a4a1b` | `#ce7f44` | 1 | 1 | 0 |
| `--placeholder` | `#6a6359` | `#a39a8b` | 1 | 1 | 0 |
| `--surface-chrome` | `#4f2d7f` | `#3d2a5c` | 0 | 0 | 0 |
| `--on-chrome` | `#ffffff` | `#ede6dc` | 0 | 0 | 0 |
| `--on-chrome-muted` | `#ede8f5` | `#c9baea` | 0 | 0 | 0 |
| `--mark-on-chrome` | `#b7a5e0` | `#b7a5e0` | 0 | 0 | 0 |
| `--focus-ring-on-chrome` | `#f3e3b8` | `#f3e3b8` | 0 | 0 | 0 |
| `--glass-fill-paper` | `#e7e2ee` | `#2f2a2e` | 0 | 0 | 0 |
| `--error-fill` | `#8e1024` | `#e08a98` | 0 | 0 | 0 |
| `--on-error-fill` | `#ffffff` | `#1a1614` | 0 | 0 | 0 |
| `--error-tint` | `#f7e4e4` | `#3a2226` | 0 | 0 | 0 |
| `--warning` | `#6b4f07` | `#cf9f5e` | 0 | 0 | 3 |
| `--warning-fill` | `#8a4f1e` | `#a97c3f` | 0 | 0 | 0 |
| `--on-warning-fill` | `#ffffff` | `#1a1614` | 0 | 0 | 0 |
| `--warning-tint` | `#f6eac8` | `#332619` | 0 | 0 | 0 |
| `--success` | `#375445` | `#79baa8` | 0 | 0 | 3 |
| `--success-fill` | `#375445` | `#8fac77` | 0 | 0 | 0 |
| `--on-success-fill` | `#ffffff` | `#1a1614` | 0 | 0 | 0 |
| `--success-tint` | `#e6ecdf` | `#1b2b28` | 0 | 0 | 0 |
| `--fig-ground` | `var(--paper)` | `var(--paper)` | 0 | 0 | 0 |
| `--fig-purple-100` | `#e3dcf0` | `#e0d7f2` | 0 | 0 | 3 |
| `--fig-purple-200` | `#9279b9` | `#c0aee6` | 0 | 0 | 1 |
| `--fig-purple-300` | `#6b4a9b` | `#a48fd0` | 0 | 0 | 2 |
| `--fig-purple-400` | `#4f2d7f` | `#7f66a8` | 0 | 0 | 2 |
| `--fig-purple-500` | `#3a1f5e` | `#5a4479` | 0 | 0 | 1 |
| `--fig-leaf-100` | `#dfe5e0` | `#dfe5e0` | 0 | 0 | 0 |
| `--fig-leaf-200` | `#9aa89c` | `#a9b7ab` | 0 | 0 | 2 |
| `--fig-leaf-300` | `#6b7a70` | `#8b9a8e` | 0 | 0 | 1 |
| `--fig-leaf-400` | `#5f6d63` | `#6f7e73` | 0 | 0 | 0 |
| `--fig-leaf-500` | `#3b453e` | `#4a5851` | 0 | 0 | 0 |
| `--fig-oxide-100` | `#f0ddd4` | `#f0ddd4` | 0 | 0 | 0 |
| `--fig-oxide-200` | `#c48972` | `#d6a189` | 0 | 0 | 0 |
| `--fig-oxide-300` | `#a8604a` | `#c07f66` | 0 | 0 | 2 |
| `--fig-oxide-400` | `#8f4e3a` | `#a3654d` | 0 | 0 | 1 |
| `--fig-oxide-500` | `#5e3125` | `#74422f` | 0 | 0 | 0 |
| `--fig-dust-100` | `#ece6da` | `#e8e1d5` | 0 | 0 | 0 |
| `--fig-dust-200` | `#c9c0b4` | `#cfc6ba` | 0 | 0 | 0 |
| `--fig-dust-300` | `#a89d8d` | `#ab9f8f` | 0 | 0 | 0 |
| `--fig-dust-400` | `#7d7263` | `#82776a` | 0 | 0 | 2 |
| `--fig-dust-500` | `#4e463c` | `#564e44` | 0 | 0 | 1 |
| `--fig-s1` | `var(--fig-purple-500)` | `var(--fig-purple-100)` | 0 | 0 | 0 |
| `--fig-s2` | `var(--fig-dust-500)` | `var(--fig-leaf-200)` | 0 | 0 | 0 |
| `--fig-s3` | `var(--fig-oxide-400)` | `var(--fig-oxide-300)` | 0 | 0 | 0 |
| `--fig-s4` | `var(--fig-leaf-300)` | `var(--fig-dust-400)` | 0 | 0 | 0 |
| `--fig-s5` | `var(--fig-purple-200)` | `var(--fig-purple-300)` | 0 | 0 | 0 |
| `--lamp-chroma-on-paper` | `var(--fig-purple-100)` | `var(--fig-purple-400)` | 0 | 0 | 0 |

## 2. A recommendation per token

Four buckets. The reason is the measurement where there is one, and DUSTIN
DECIDES wherever taste settles it rather than a count.

### The rulings move two of Grok's deletions

Ruling 124 was written after that audit and it reverses two of its confident
deletes. Both are recorded here because a reader comparing the two documents
will otherwise think this one is careless.

- **The lamp set is NOT a deletion candidate.** `--lamp-origin`,
  `--lamp-reach`, `--surface-catch`, `--lamp-chroma-on-paper`. Grok is right
  that they paint nothing today, and this pass confirms zero. Ruling 124 gives
  them their first real consumer: the lit edge on a glass pane at 124 degrees,
  brightest at the leading corner. They are KEEP AS IS, waiting on one build.
- **`--glass-fill-paper` is NOT a deletion candidate either**, and the job does
  not mention it. Grok deletes it on the grounds that glass is retired. Ruling
  124 names it directly: "The pane is `--glass-fill-paper` at 82% with a 12px
  backdrop blur." Glass shrank; it did not go. KEEP AS IS.

This is also the honest answer to "a token with no consumer is bait" (ruling
122): the bait test is about tokens whose owner will never arrive, and the test
for that is whether a ruling names the owner. These four plus the pane now have
one. The carried map's stated owner for the lamp set, "the lamp on the glass
controls, ruling 74", is wrong in a second way under 124: the light is on the
PANE, not on a control. Whichever job builds the pane should correct that row
rather than delete it.

### KEEP AS IS

`--paper`, `--text`, `--text-secondary`, `--dust`, `--brand`, `--visited`,
`--on-brand`, `--tint-brand`, `--selection-bg`, `--placeholder`,
`--text-disabled`, `--mark-bg`, `--scrim`, `--on-scrim`, `--surface-popover`,
the lamp set, `--glass-fill-paper`.

The first five are the plate's own palette and are not in question. `--visited`
stays because the site styles it and the plate simply does not draw one.
`--scrim` and `--on-scrim` have a real painter in the lightbox. `--mark-bg` is
the search hit highlight, which is meaning, not decoration.

### COLLAPSE INTO

Each row gives both consumer counts, because the count is the cost.

| Dead name | Into | Counts | What a rewrite touches |
|---|---|---|---|
| `--text-muted` 161 (96 admin, 59 public) | `--text-secondary` 55 | one RGB step apart in both themes | 19 files. The public 59 is the real work; the plate and ruling 123 both say "secondary", so the majority name is the one that goes. |
| `--bg` 39 | `--paper` 10 | 1.072:1 apart in light | `body` is the important one. 17 files, mostly admin. |
| `--surface` 58 | `--raised` 14 or `--paper` | identical hexes to `--surface-code` | 17 files. Admin-dominated; the public uses are prose code and a few wells. |
| `--surface-code` 2 | `--raised` | `#f1ebe1`/`#26201c`, identical to `--surface` in both themes | 1 file, `prose.css`. The cheapest collapse on the list. |
| `--focus-ring` 6 | `--brand` | identical in both themes | 4 files. Costs nothing and removes a name that implies a separate decision. |
| `--brand-active` 3 | `--brand-pressed` 4 | same light hex `#2f1a4d` | 2 files. Note PR #52 gave `--brand-active` a measured contrast pair; whichever name survives keeps the pair. |
| `--chart-purple` 1 | delete with the `--chart-*` family | light hex IS `--brand` | 1 file, `chart.mjs`. A series that is the link colour is the defect ruling 122 names. |
| `--fig-ground` 0 | `--paper` | it is literally `var(--paper)` | nothing. |
| `--fig-purple-400` 0 | `--brand` | same light hex | nothing painted; two aliases. |
| `--fig-dust-200` 0 | `--dust` | same light hex | nothing. |

**`--border` into `--line-strong` is NOT recommended on this reading.** The
shared light hex is real, but `--border` is 115 paints in 21 files against
`--line-strong`'s 20 in one, the dark hexes already differ, and `--line-strong`
has zero public consumers. Collapsing the 115 into the 20 renames the majority
into a token whose only painter is the inventory page. If the two must become
one, the survivor should be `--border` on the count, and then the public plane
needs a ruling on whether a control edge on paper is `--dust` (1.57:1, rules
only) or something stronger, which is the next bullet.

### DELETE

With what breaks, named.

- **Chrome role tokens**, `--surface-chrome`, `--on-chrome`, `--on-chrome-muted`,
  `--mark-on-chrome`, `--focus-ring-on-chrome`. Zero paint in `app/` and
  `workers/`, confirmed twice. **What breaks:** `scripts/build-og.mjs:57-60`
  resolves all four of the first as the social card's ground, text, muted text
  and accent, deliberately from the dark block so the measured pairs hold; and
  `scripts/check-logo.mjs:378` asserts the embedded mark is painted in
  `--mark-on-chrome`. Deleting the CSS without retargeting those two either
  fails the build step or freezes whatever hex was last resolved. The card needs
  its own named pair in the same commit; do not keep five public tokens alive to
  feed a build script.
- **The `--fig-*` ramps and the `--fig-s*` slots.** Twenty ramp steps and five
  slots, all zero paint, several alias-only. Keep three named figure colours and
  the texture; delete the ramp. **What breaks:** nothing today, and that is the
  point. `--fig-s1` is also gone from the canvas already ("Figure series
  corrected on the canvas", vol 19).
- **The Paper state fills that never painted**, `--error-fill`,
  `--on-error-fill`, `--error-tint`, `--warning-fill`, `--on-warning-fill`,
  `--warning-tint`, `--success-fill`, `--on-success-fill`, `--success-tint`.
  Zero paint each. The Hill Country family (`--text-danger`, `--fill-danger`,
  `--tint-danger` and their satellites) is what admin actually uses. **What
  breaks:** nothing in `app/`. Two state families is the defect; which one
  survives is a naming choice, and the counts say the one that paints.
- **`--chart-*`**, six tokens, replaced by the three figure series. **What
  breaks:** `app/lib/content/chart.mjs:47` is the single owner via
  `CHART_SERIES_TOKENS`, and `check:charts` reads its output. One list, one
  edit, and the gold slot at 3.55:1 goes with it, which is a contrast
  improvement rather than a loss.

### DUSTIN DECIDES

Measurement cannot settle these.

1. **Whether a control edge on paper exists at all.** `--dust` is 1.57:1 and is
   rules only by ruling 122. `--line-strong` is the candidate and has no public
   painter. Either the public plane gets a control edge token with a measured
   pair, or public controls are identified by type and rule alone.
2. **`--text-heading`.** 13 paints, 9 of them admin, not a hex duplicate of
   `--text`. The plate sets the home name in `--text`. Keeping it is a taste
   call about whether headings are a different ink.
3. **Which state family name survives**, the Paper names or the Hill Country
   names. The counts say Hill Country; the names say Paper. That is a naming
   preference, not a measurement.
4. **`--brand-hover` at 19 paints.** The plate's hover is an underline or
   `--brand` itself. Deleting it makes every hover an underline, which is a
   visible change on 11 files, not a token cleanup.
5. **Whether `--raised` and `--surface-popover` are public tokens or admin
   tokens.** Today they are admin (0 and 1 public paints). The final list should
   put them in one kit or the other rather than describing a public job they do
   not have.
6. **`--visited`.** Kept here, but the plate does not draw it and a site that
   never shows visited state is a defensible choice.

## 3. What a closed-name-list gate would assert, and what it costs

**`check:design-vocabulary` cannot carry this, and should not be extended to.**
Two reasons, one of them structural.

It reads `.design-sync/conventions.md` and asserts that every token and class
that PROSE names exists in the stylesheets. It is deliberately one-directional,
and its own header records why: the sheets define 211 tokens and the brief
rations what the design agent reads to a few dozen, so the reverse direction
would fail on every token the vocabulary correctly leaves out. A closed-list
gate is exactly that reverse direction, plus rules about where a token may be
used. Different input, different question, and folding them together would make
one gate that fails for two unrelated reasons.

It is also not on `main` yet: it is in PR #56.

So: **its own gate.** Call it `check:colour-system`. What it asserts, in the
order the cost rises:

1. **Closed set.** The theme blocks declare exactly the names on the list. An
   extra colour name fails; a missing one fails. A LIST, never a count floor, as
   the first reader says: a floor of 24 lets a rename through.
   *Cost: trivial.* The palette parser is about 40 lines and this audit's census
   already contains it, including the pointer resolution that keeps the type
   scale out.
2. **Paint, not alias.** Every name on the list has at least one paint-property
   consumer in `app/`, with comments stripped and `scripts/` not read.
   *Cost: low, and already written.* The census script in this branch does it in
   about 60 lines. The only judgement in it is the paint-property list, and the
   `--border` disagreement above is the warning: that list IS the gate, and a
   missing `border` shorthand is a 10x error.
3. **No silent duplicate.** No two public tokens share both hexes.
   *Cost: trivial*, about 8 lines, and it finds 13 pairs today. Most are the
   `#ffffff` / `#1a1614` "on-fill" family, which is a legitimate collision of
   different jobs landing on white, so the assertion needs a small allowlist of
   pairs that are permitted to coincide, each with its reason. Without that it
   is noise.
4. **`--fig-dust-300` is not a series, and the series list is exact.**
   `CHART_SERIES_TOKENS` equals the three names in order.
   *Cost: trivial*, 5 lines, one import.
5. **Division of labour by selector family.** `--brand` as a fill only on an
   allowlisted class; `--dust` never as `color` or `fill`; the figure colours
   only inside figure, caption, chart and diagram output.
   *Cost: this is the expensive one, and it is where an honest estimate matters.*
   Everything above works on declarations alone. This needs the SELECTOR each
   declaration sits under, which means tracking brace depth and the selector
   stack through nested at-rules, or taking a CSS parser as a dependency, which
   ruling 61's posture makes a decision rather than an import. A hand-rolled
   block scanner is maybe 120 lines and is the part most likely to be subtly
   wrong; it should be written with a plant per rule, since rule 12 wants the
   named defect replayed and there are four different defects here.
6. **Pair matrix matches the list.** Every text or series token has a measured
   pair against `--paper`; `--dust` has no text pair; `--fig-dust-300` has no
   series pair.
   *Cost: low, but it belongs to `check:contrast`*, which already owns hexes and
   pairs (rule 17, one owner per fact). The new gate should assert that the two
   lists agree and leave the ratios where they are.

**Sequencing.** Items 1 to 4 are a real gate in an afternoon and would hold the
list the day Dustin rules. Item 5 is a second commit with its own plants. Item 6
is a line in `check:contrast`. Writing 5 first, which is the tempting order
because it is the interesting one, would delay the assertion that actually stops
drift.

**And the carried map does not survive this.** Section 31 of `check:invariants`
lets a declared-but-unpainted token sit until 2026-11-30. A closed list with a
paint requirement says the same thing, sooner and by name. They should not both
exist: two owners for one fact.

## 4. The one-page version

The list Dustin would be approving. One line, one job. Names marked (admin) do
the work only on the admin plane today, on the counts above.

```
PAGE
  --paper            the ground: page, header, footer
  --text             ink: body, titles, the wordmark, specimen strokes
  --text-secondary   quiet ink: captions, dates, labels at rest
  --text-disabled    inactive control text, below the floor on purpose
  --placeholder      field placeholder
  --dust             rules only, never type, never a control edge
  --selection-bg     text selection
  --mark-bg          search hit highlight

CLICKABLE
  --brand            links, focus, the mark. Never a fill, never a series
  --visited          followed links
  --on-brand         text on the one filled primary a page may have
  --tint-brand       selected well, never a page slab

SURFACES
  --raised           one step off paper: code, fields, wells       (admin today)
  --surface-popover  menus and drawers                             (admin today)
  --line-strong      control edges                                 (admin today)
  --scrim            lightbox band
  --on-scrim         text on the scrim

FIGURES
  --fig-oxide        figure numbers, leaders, labels, series 1
  --fig-leaf         series 2
  --fig-cadet        series 3
  --fig-dust-300     texture only: lawn, halo, dashed plate. Never a series

GLASS
  --glass-fill-paper the pane, 82%
  --lamp-origin      where the light falls on the pane
  --lamp-reach       how far it carries
  --surface-catch    how strongly it catches, zero under reduced transparency
  --lamp-chroma-on-paper  the light's colour

STATE
  --fill-danger + --text-danger + --tint-danger + their satellites
  --fill-warning + --text-warning + --tint-warning + their satellites
  --fill-success + --text-success + --tint-success + their satellites
      one family, not two. Error may fill on the public plane; warning and
      success are admin.
```

That is 24 names plus one state family, which is the same shape the first reader
arrived at. The three differences, all from ruling 124 or from the counts:

- The five glass and lamp names are IN, not deleted.
- `--border` is not collapsed into `--line-strong`.
- `--raised`, `--surface-popover` and `--line-strong` are marked as admin-only
  today rather than described as public jobs.

## What this branch did not do

No token was deleted, collapsed, renamed or rewritten. No source file changed.
The only files in this branch beyond the report are the census script that
produced the numbers, so the next reader can re-run them rather than trust them.
