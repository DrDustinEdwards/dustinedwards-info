# Colour system audit against Plate I

Read-only. Branch `review/grok-colour` from `origin/main` at `2c01310`.
Artefact: `C:\Users\email\Downloads\Home page - Plate I, locked system.html`
(1,464,372 bytes, title "Part C re-skinned — home with Plate I").
Counted on disk 2026-09-20. Capsid was unreachable this session.

## What was checked

- The locked HTML's own stylesheet, pulled out of the bundler template. It is not the repo's `home.css`.
- Colour tokens declared in the three palette blocks of `app/app.css` (`:root, [data-theme="light"]`, the dark media block, `[data-theme="dark"]`). First declaration wins, matching `check:contrast`.
- Extra colour declarations in `SHEETS` (`.design-sync/build-inputs.mjs`).
- Paint consumers in `app/` and `workers/` only. Comments stripped first. A consumer is a CSS paint property (`color`, `background`, `border*`, `outline*`, `fill`, `stroke`, `box-shadow`, and the other colour-bearing properties) whose value contains `var(--token)`, or a JS/TS string that paints with that token (`chart.mjs` series fills, diagram theme variables). An alias (`--fig-s1: var(--fig-purple-500)`) is not a paint consumer. A mention in a comment, in `scripts/check-invariants.mjs`'s carried map, or in `check:contrast`'s pair list is not a consumer.
- `workers/` contains zero `var(--*)` colour uses.
- Contrast ratios use `app/lib/contrast.mjs` (WCAG 2.x) against `--paper`.

What was not guessed: live computed styles in a browser; whether OG cards still look right if chrome tokens die (see §2). Admin sheets under `app/styles/admin-*.css` are inside `app/`, so they count.

## The locked page's palette

Eight colour tokens. Light / dark:

| Token | Light | Dark | Job on the plate |
|---|---|---|---|
| `--paper` | `#f4efe6` | `#1c1916` | Page ground, and the fill of every plaque specimen |
| `--text` | `#241f1b` | `#e9e1d6` | Ink: body, wordmark, specimen strokes |
| `--text-secondary` | `#5b5349` | `#b2a898` | Captions, evidence, figure labels at rest |
| `--dust` | `#c9c0b4` | `#6f675c` | Every rule: header, evidence, key strip, footer |
| `--brand` | `#4f2d7f` | `#b7a5e0` | Links, nav hover, the theme-toggle button |
| `--fig-oxide` | `#8f4e3a` | `#c07f66` | Plate/figure numbers, leader lines, `.fl.ox` labels |
| `--fig-dust-300` | `#a89d8d` | `#ab9f8f` | Lawn stipple, dashed plate circle, halo ring |
| `--fig-s1` | `#3a1f5e` | `#e0d7f2` | Declared. Direct `var(--fig-s1)` is not used. `.plum` remaps `--fig-oxide` to this hex |

No `--bg`, `--surface`, `--text-muted`, `--leaf`, lamp, glass, or chrome. Header and footer sit on `--paper` with one `--dust` rule. Wordmark is `--text`, not `--brand`. Hover on a content link is an underline; hover on nav is `--brand`. There is no `--brand-hover`.

`.plum { --fig-oxide: #3a1f5e }` / `.plum.dark { --fig-oxide: #e0d7f2 }` is not a second series. It is the same annotation ink, swapped to the purple hex. Oxide and purple are alternatives on one plate, not two series on one chart.

## 1. Inventory

102 colour tokens in the `app.css` palette blocks. SHEETS add one more colour declaration: `--print-rule: #999` in `app/styles/motion-print.css` (print only, on purpose). `playground-ui.css` declares local aliases (`--alert-accent`, `--pill-ink`, `--hc-accent`) that point at global tokens; those names are not palette tokens.

Lamp geometry (`--lamp-origin`, `--lamp-reach`, `--surface-catch`) is not a colour. It is declared after the palette blocks so `check:contrast` will not demand a hex. Paint consumers in `app/` and `workers/`: **zero**. `--lamp-chroma-on-paper` is in the palette and is also zero.

`paint` is the number of paint rules. `files` is distinct files. `alias` is `:root` (or local) assignments of this token into another custom property.

| Token | Light | Dark | paint | files | alias | Notes |
|---|---|---|---:|---:|---:|---|
| `--bg` | `#faf7f2` | `#1a1614` | 37 | 17 | 1 | Body ground in `app.css`. Plate uses `--paper`. |
| `--surface` | `#f1ebe1` | `#26201c` | 61 | 17 | 0 | Mostly admin cards; also blog-index, projects, prose code. |
| `--surface-popover` | `#ebe2d3` | `#322a25` | 21 | 6 | 0 | Menus, drawers. |
| `--surface-code` | `#f1ebe1` | `#26201c` | 2 | 1 | 0 | Same hex as `--surface`. |
| `--text` | `#241f1b` | `#e9e1d6` | 147 | 27 | 0 | |
| `--text-heading` | `#2b2320` | `#ede6dc` | 13 | 7 | 0 | Plate uses `--text` for the name. |
| `--text-muted` | `#5c5248` | `#b3a99c` | 162 | 19 | 0 | Duplicate of `--text-secondary`. Majority consumer. |
| `--text-disabled` | `#a09990` | `#6f685e` | 8 | 4 | 0 | Mix recipe follows. |
| `--border` | `#8a7d6e` | `#746a5f` | 12 | 5 | 0 | Same light hex as `--line-strong`. |
| `--border-strong` | `#6e6459` | `#8a8075` | 6 | 2 | 0 | |
| `--brand` | `#4f2d7f` | `#b7a5e0` | 98 | 30 | 0 | Links plus fills. `.page-title` is brand, which the plate forbids. |
| `--brand-hover` | `#412764` | `#b9a6d9` | 19 | 11 | 0 | Plate hover is `--brand` or underline. |
| `--brand-active` | `#2f1a4d` | `#c9baea` | 3 | 2 | 0 | Light hex equals `--brand-pressed`. |
| `--brand-pressed` | `#2f1a4d` | `#a08ecd` | 4 | 1 | 0 | playground-ui only. |
| `--on-brand` | `#ffffff` | `#1a1614` | 16 | 11 | 0 | Needed for a filled primary. |
| `--tint-brand` | `#ede8f5` | `#2b2440` | 21 | 9 | 0 | Selected chips, diagram cluster. |
| `--visited` | `#5a2b63` | `#a898cd` | 6 | 5 | 0 | Plate does not style visited. Site does. |
| `--selection-bg` | `#d9ccee` | `#4a3a6b` | 2 | 2 | 0 | |
| `--focus-ring` | `#4f2d7f` | `#b7a5e0` | 6 | 4 | 0 | Same hex as `--brand`. |
| `--focus-ring-on-brand` | `#f3e3b8` | `#2f2410` | 2 | 2 | 0 | |
| `--surface-chrome` | `#4f2d7f` | `#3d2a5c` | 0 | 0 | 0 | |
| `--on-chrome` | `#ffffff` | `#ede6dc` | 0 | 0 | 0 | |
| `--on-chrome-muted` | `#ede8f5` | `#c9baea` | 0 | 0 | 0 | |
| `--mark-on-chrome` | `#b7a5e0` | `#b7a5e0` | 0 | 0 | 0 | |
| `--focus-ring-on-chrome` | `#f3e3b8` | `#f3e3b8` | 0 | 0 | 0 | |
| `--scrim` | `#1a1614` | `#1a1614` | 13 | 7 | 0 | Lightbox. |
| `--on-scrim` | `#ffffff` | `#ffffff` | 20 | 3 | 0 | |
| `--text-danger` | `#a1122a` | `#ec9aa8` | 4 | 3 | 0 | |
| `--tint-danger` | `#f7e1e1` | `#3a2226` | 7 | 6 | 0 | |
| `--on-tint-danger` | `#7c0e20` | `#f0aeba` | 8 | 5 | 0 | |
| `--border-danger` | `#c4677a` | `#9c5766` | 10 | 6 | 0 | |
| `--fill-danger` | `#8e1024` | `#a62239` | 4 | 3 | 0 | |
| `--fill-danger-hover` | `#75091c` | `#8e1024` | 2 | 1 | 0 | |
| `--on-fill-danger` | `#ffffff` | `#ffffff` | 2 | 1 | 0 | |
| `--text-warning` | `#7a5a08` | `#e2bc6b` | 5 | 3 | 0 | |
| `--tint-warning` | `#f6eac8` | `#3a311a` | 6 | 4 | 0 | |
| `--on-tint-warning` | `#6b4f07` | `#e5c078` | 7 | 4 | 0 | |
| `--border-warning` | `#a67c24` | `#9c8347` | 14 | 7 | 0 | |
| `--fill-warning` | `#e0a428` | `#e9b44c` | 5 | 3 | 0 | |
| `--on-fill-warning` | `#2b2320` | `#1a1614` | 1 | 1 | 0 | |
| `--text-success` | `#3e5d4b` | `#93b29b` | 3 | 3 | 0 | |
| `--tint-success` | `#e3ebdd` | `#252c1e` | 2 | 2 | 0 | |
| `--on-tint-success` | `#31503e` | `#93b29b` | 2 | 2 | 0 | |
| `--border-success` | `#5e7c6a` | `#6e8259` | 6 | 5 | 0 | |
| `--fill-success` | `#3e5d4b` | `#8fac77` | 3 | 3 | 0 | |
| `--on-fill-success` | `#ffffff` | `#1a1614` | 1 | 1 | 0 | |
| `--text-accent` | `#7a3e12` | `#ce7f44` | 6 | 2 | 0 | Decorative terracotta. |
| `--text-destructive` | `#8a3324` | `#e5947f` | 2 | 2 | 0 | Trash, not delete. |
| `--tint-destructive` | `#f5e8e4` | `#3a201b` | 1 | 1 | 0 | |
| `--mark-bg` | `#f3e3b8` | `#4a3d1e` | 2 | 2 | 0 | Search highlight. |
| `--chart-cadet` | `#142b42` | `#5887b5` | 2 | 2 | 0 | Real paint: `chart.mjs`. Playground mentions it in a `<code>` tag. |
| `--chart-purple` | `#4f2d7f` | `#c0b0e6` | 1 | 1 | 0 | Same light hex as `--brand`. |
| `--chart-claret` | `#9b3268` | `#c9699e` | 1 | 1 | 0 | |
| `--chart-sage` | `#55684a` | `#93b29b` | 1 | 1 | 0 | |
| `--chart-gold` | `#9a7a0e` | `#efd99c` | 1 | 1 | 0 | 3.55:1 on `--paper` light. |
| `--chart-rust` | `#8a4a1b` | `#ce7f44` | 1 | 1 | 0 | |
| `--paper` | `#f4efe6` | `#1c1916` | 10 | 4 | 0 | Header, footer, skip-link, playground-ui. Not the body. |
| `--raised` | `#ece6da` | `#232019` | 15 | 2 | 1 | |
| `--text-secondary` | `#5b5349` | `#b2a898` | 54 | 8 | 1 | Home, evidence, publications, playground-ui. |
| `--placeholder` | `#6a6359` | `#a39a8b` | 1 | 1 | 0 | Mix recipe follows. |
| `--dust` | `#c9c0b4` | `#6f675c` | 42 | 10 | 0 | |
| `--line-strong` | `#8a7d6e` | `#8f857a` | 21 | 2 | 2 | playground-ui control edges. |
| `--glass-fill-paper` | `#e7e2ee` | `#2f2a2e` | 0 | 0 | 0 | Mix recipe follows. |
| `--error` | `#8e1024` | `#f0a9b4` | 6 | 1 | 3 | Direct paint in playground-ui; also aliased to `--alert-accent`. |
| `--error-fill` | `#8e1024` | `#e08a98` | 0 | 0 | 0 | |
| `--on-error-fill` | `#ffffff` | `#1a1614` | 0 | 0 | 0 | |
| `--error-tint` | `#f7e4e4` | `#3a2226` | 0 | 0 | 0 | |
| `--warning` | `#6b4f07` | `#cf9f5e` | 0 | 0 | 3 | Alias-mediated in playground-ui only. |
| `--warning-fill` | `#8a4f1e` | `#a97c3f` | 0 | 0 | 0 | |
| `--on-warning-fill` | `#ffffff` | `#1a1614` | 0 | 0 | 0 | |
| `--warning-tint` | `#f6eac8` | `#332619` | 0 | 0 | 0 | |
| `--success` | `#375445` | `#79baa8` | 0 | 0 | 3 | Alias-mediated in playground-ui only. |
| `--success-fill` | `#375445` | `#8fac77` | 0 | 0 | 0 | |
| `--on-success-fill` | `#ffffff` | `#1a1614` | 0 | 0 | 0 | |
| `--success-tint` | `#e6ecdf` | `#1b2b28` | 0 | 0 | 0 | |
| `--fig-ground` | `var(--paper)` | `var(--paper)` | 0 | 0 | 0 | |
| `--fig-purple-100` | `#e3dcf0` | `#e0d7f2` | 0 | 0 | 3 | Alias into `--fig-s1` dark and lamp. |
| `--fig-purple-200` | `#9279b9` | `#c0aee6` | 0 | 0 | 1 | |
| `--fig-purple-300` | `#6b4a9b` | `#a48fd0` | 0 | 0 | 2 | |
| `--fig-purple-400` | `#4f2d7f` | `#7f66a8` | 0 | 0 | 2 | Light hex is `--brand`. |
| `--fig-purple-500` | `#3a1f5e` | `#5a4479` | 0 | 0 | 1 | Plate `--fig-s1` light. |
| `--fig-leaf-100` | `#dfe5e0` | `#dfe5e0` | 0 | 0 | 0 | |
| `--fig-leaf-200` | `#9aa89c` | `#a9b7ab` | 0 | 0 | 2 | |
| `--fig-leaf-300` | `#6b7a70` | `#8b9a8e` | 0 | 0 | 1 | |
| `--fig-leaf-400` | `#5f6d63` | `#6f7e73` | 0 | 0 | 0 | |
| `--fig-leaf-500` | `#3b453e` | `#4a5851` | 0 | 0 | 0 | |
| `--fig-oxide-100` | `#f0ddd4` | `#f0ddd4` | 0 | 0 | 0 | |
| `--fig-oxide-200` | `#c48972` | `#d6a189` | 0 | 0 | 0 | |
| `--fig-oxide-300` | `#a8604a` | `#c07f66` | 0 | 0 | 2 | Dark hex is plate `--fig-oxide`. |
| `--fig-oxide-400` | `#8f4e3a` | `#a3654d` | 0 | 0 | 1 | Light hex is plate `--fig-oxide`. |
| `--fig-oxide-500` | `#5e3125` | `#74422f` | 0 | 0 | 0 | |
| `--fig-dust-100` | `#ece6da` | `#e8e1d5` | 0 | 0 | 0 | |
| `--fig-dust-200` | `#c9c0b4` | `#cfc6ba` | 0 | 0 | 0 | Light hex is `--dust`. |
| `--fig-dust-300` | `#a89d8d` | `#ab9f8f` | 0 | 0 | 0 | Declared. Never painted in the repo. Painted on the plate. |
| `--fig-dust-400` | `#7d7263` | `#82776a` | 0 | 0 | 2 | |
| `--fig-dust-500` | `#4e463c` | `#564e44` | 0 | 0 | 1 | |
| `--fig-s1` | purple-500 / 100 | | 0 | 0 | 0 | Carried. Plate declares it. Repo charts still use `--chart-*`. |
| `--fig-s2` | dust-500 / leaf-200 | | 0 | 0 | 0 | |
| `--fig-s3` | oxide-400 / 300 | | 0 | 0 | 0 | |
| `--fig-s4` | leaf-300 / dust-400 | | 0 | 0 | 0 | |
| `--fig-s5` | purple-200 / 300 | | 0 | 0 | 0 | |
| `--lamp-chroma-on-paper` | purple-100 / 400 | | 0 | 0 | 0 | |

### Zero paint consumers in `app/` and `workers/`

44 colour tokens, plus the three lamp geometry tokens.

**Nothing reads them, even as an alias:**
`--error-fill`, `--error-tint`, `--on-error-fill`, `--warning-fill`, `--warning-tint`, `--on-warning-fill`, `--success-fill`, `--success-tint`, `--on-success-fill`, `--glass-fill-paper`, `--lamp-chroma-on-paper`, `--surface-chrome`, `--on-chrome`, `--on-chrome-muted`, `--mark-on-chrome`, `--focus-ring-on-chrome`, `--fig-ground`, `--fig-leaf-100`, `--fig-leaf-400`, `--fig-leaf-500`, `--fig-oxide-100`, `--fig-oxide-200`, `--fig-oxide-500`, `--fig-dust-100`, `--fig-dust-200`, `--fig-dust-300`, `--fig-s1`, `--fig-s2`, `--fig-s3`, `--fig-s4`, `--fig-s5`, `--lamp-origin`, `--lamp-reach`, `--surface-catch`.

**Alias only (pointed at by another token, never painted):**
`--fig-purple-100` … `--fig-purple-500`, `--fig-leaf-200`, `--fig-leaf-300`, `--fig-oxide-300`, `--fig-oxide-400`, `--fig-dust-400`, `--fig-dust-500`. `--warning` and `--success` are alias-mediated through playground-ui local names; they have a visual job there, but no direct paint property.

`--fig-dust-300` is the important zero: the locked plate paints it, the repo does not.

## 2. Against the ruled division of labour

Ruled: `--brand #4f2d7f` for links, focus and the mark only; `--fig-oxide` for figure labels, leaders, plate and figure numbers and figure strokes only; `--dust` for every rule; paper and ink for ground and text.

### Survivors

Keep, under the plate's names:

- `--paper`, `--text`, `--text-secondary`, `--dust`, `--brand`
- `--fig-oxide` as a single pair, not a five-step ramp. Light `#8f4e3a` (`--fig-oxide-400`), dark `#c07f66` (`--fig-oxide-300`).
- `--visited` (site styles it; the plate does not; still a link role)
- `--on-brand` (one filled primary remains legal: Search, Compute, sign in)
- `--scrim` / `--on-scrim` (lightbox is a real painter)
- `--selection-bg`, `--placeholder`, `--text-disabled`, `--mark-bg`
- `--surface-popover` (menus; not a second page ground)
- `--line-strong` (control edges; `--dust` is 1.57:1 on limestone and cannot identify a field)
- One state family for error, warning, success. The Hill Country `--text-danger` / `--fill-danger` set is the one that actually paints. The Paper `--error-fill` set is dead. Collapse to one family in a later pass; do not keep both.

### Duplicates of a survivor

Merge now, do not wait for 2026-11-30. Same job, two names, and in several cases the same hex.

| Dead name | Survivor | Why |
|---|---|---|
| `--text-muted` (`#5c5248` / `#b3a99c`) | `--text-secondary` (`#5b5349` / `#b2a898`) | One RGB step apart. 162 muted consumers vs 54 secondary. The plate and the ruling use secondary. Migrate muted, then delete it. |
| `--bg` (`#faf7f2` / `#1a1614`) | `--paper` | Plate ground is paper. Body still paints `--bg`. Two page grounds is the defect. |
| `--surface` (`#f1ebe1` / `#26201c`) | `--paper` or `--raised` | Admin cards and a few public wells. Not a public page ground. |
| `--surface-code` | `--raised` | Identical to `--surface` in both themes. |
| `--brand-active` | `--brand-pressed` if a press colour is kept, else `--brand` | Light hex is already the same `#2f1a4d`. Plate has neither. |
| `--brand-hover` | `--brand` | Plate hover is `--brand` or underline. |
| `--focus-ring` | `--brand` | Identical hex in both themes. |
| `--border` (light `#8a7d6e`) | `--line-strong` (light `#8a7d6e`) | Same light hex. Dark already differs. Dust for rules, line-strong for controls. |
| `--chart-purple` | `--brand` | Same light hex. A chart series must not be the link colour. |
| `--fig-ground` | `--paper` | It is already `var(--paper)`. |
| `--fig-purple-400` | `--brand` | Same light hex. |
| `--fig-dust-200` | `--dust` | Same light hex. |
| `--error` / `--fill-danger` / `--error-fill` | one name | All `#8e1024` in light. |
| `--tint-warning` / `--warning-tint` | one name | Same light hex. |
| `--on-chrome` / `--on-brand` / `--on-scrim` | context-specific survivors | Several are just `#ffffff`. |

`--text-heading` is not a hex duplicate of `--text`, but the plate does not use it. The home name is `--text`. Delete it if headings can take `--text` plus the serif level.

### Delete now, not at 2026-11-30

The carried map in `scripts/check-invariants.mjs` expires 2026-11-30. That date is for tokens whose owner has not been built yet. The tokens below have no owner in `app/` or `workers/` and no prospect of one that matches the locked plate. Waiting on the date keeps a second, retired system in the stylesheet the plate does not use.

**Lamp set. Confirmed zero consumers.** `--lamp-origin`, `--lamp-reach`, `--surface-catch`, `--lamp-chroma-on-paper`. Ruling 74's glass lamp was never painted. `prefers-reduced-transparency` zeros a token nothing reads. Delete the `@property` block with them.

**`--glass-fill-paper`. Confirmed zero consumers.** Glass is retired as a material. No `var(--glass)` either.

**Chrome role tokens. Confirmed zero consumers in `app/` and `workers/`.** `--surface-chrome`, `--on-chrome`, `--on-chrome-muted`, `--mark-on-chrome`, `--focus-ring-on-chrome`. Public header is `--paper` plus `--dust`. Skip-link is `--paper`. The mark is `currentColor` from `--text`.

Caveat, outside the requested scope: `scripts/build-og.mjs` still resolves the dark chrome block for social cards, and `scripts/check-logo.mjs` still names `--mark-on-chrome`. Those are scripts, not paint on a page. Deleting the CSS tokens without retargeting `build-og` will either fail that script or freeze the last resolved hex. Retarget OG to `--paper` / `--text` (or a dedicated card pair) in the same commit. Do not keep five public tokens alive for a build script.

**Figure ramps and series slots. Confirmed zero paint.** Twenty `--fig-*-N` steps, five `--fig-s*` slots, `--fig-ground`. Charts still paint `--chart-*`. The carried rows that say "the `--fig-*` palette that replaces `--chart-*`" have not landed. Keep three named figure colours (next section), delete the rest now.

**Paper state fills that never painted:** `--error-fill`, `--on-error-fill`, `--error-tint`, `--warning-fill`, `--on-warning-fill`, `--warning-tint`, `--success-fill`, `--on-success-fill`, `--success-tint`. The Hill Country `--fill-danger` family is what the admin actually uses.

## 3. Figure colours

The site needs **three series colours plus one texture**, not a 4×5 ramp and not the six `--chart-*` hues.

Plate I is not a multi-series chart. Specimen strokes are `--text`. Annotation is `--fig-oxide`. Lawn, halo and the dashed plate circle are `--fig-dust-300`. A plum variant remaps oxide to `#3a1f5e` / `#e0d7f2`. That is two figure inks (oxide, optional plum) and one texture.

Charts are the reason a second and third hue exist. `chart.mjs` currently emits six `--chart-*` tokens. Gold in light is 3.55:1 on `--paper`, which is a weak series stroke. Purple in light is `--brand`, so a series looks like a link.

**Leaf survives as series 2, as one pair, not a ramp.** It is absent from Plate I, so it is not a plate token. It is the best existing second series on warm limestone: cool grey-green, not success (`#375445`), not brand, not oxide. Use the **400** step in light, not 300. Leaf-300 light is 3.95:1 on `--paper` (UI pass, text fail). Leaf-400 light is 4.76:1.

| Role | Light | on `--paper` `#f4efe6` | Dark | on `--paper` `#1c1916` |
|---|---|---:|---|---:|
| `--fig-oxide` (annotation + series 1) | `#8f4e3a` | 5.52 | `#c07f66` | 5.39 |
| `--fig-leaf` (series 2) | `#5f6d63` | 4.76 | `#8b9a8e` | 5.93 |
| `--fig-cadet` (series 3) | `#142b42` | 12.61 | `#5887b5` | 4.62 |
| `--fig-dust-300` (texture, grid, halo) | `#a89d8d` | 2.33 | `#ab9f8f` | 6.74 |

`--fig-dust-300` in light fails 3:1. That is acceptable only as lawn stipple and a dashed circle, which is how the plate uses it. It must not label a series and must not be body text. Axis lines that carry meaning take `--fig-oxide` or `--line-strong`, not dust-300.

Do not use `--fig-s1` / purple as a series colour. It is the plum remap of oxide, and in light it sits in the brand family. A chart series in purple reads as a set of links.

Three series cover the multi-series fixtures in `check:charts` (two columns besides the label). A fourth series is not required by anything this repo draws today. If one appears, add it with a measured pair and a name, do not reopen a five-step ramp.

Migrate `CHART_SERIES_TOKENS` to `--fig-oxide`, `--fig-leaf`, `--fig-cadet` and delete `--chart-*`.

## 4. Final token list

Public colour tokens, one job each. 24 names. Print `--print-rule` stays in `motion-print.css` and is not a theme token.

1. `--paper` — page ground, including header and footer.
2. `--text` — ink: body, headings, wordmark, specimen strokes.
3. `--text-secondary` — muted copy: captions, evidence, labels at rest.
4. `--text-disabled` — inactive control text, below the floor on purpose.
5. `--placeholder` — field placeholder, below the value that replaces it.
6. `--dust` — rules only. Never text, never a control edge.
7. `--line-strong` — control edges on paper.
8. `--brand` — links, focus ring, and the mark when it is a link. Not a fill, not a heading, not a chart series.
9. `--visited` — followed links.
10. `--on-brand` — text on the one legal filled primary.
11. `--tint-brand` — selected chip well, never a page slab.
12. `--selection-bg` — text selection.
13. `--raised` — one step off paper: code, fields, wells.
14. `--surface-popover` — elevated menus and drawers.
15. `--scrim` — opaque lightbox band.
16. `--on-scrim` — text on the scrim.
17. `--mark-bg` — search hit highlight.
18. `--fig-oxide` — figure numbers, leaders, labels, series 1.
19. `--fig-leaf` — chart series 2.
20. `--fig-cadet` — chart series 3.
21. `--fig-dust-300` — figure texture only (lawn, halo, dashed plate).
22. `--fill-danger` (or renamed `--error-fill`) — irreversible danger fill, with `--text-danger` / `--tint-danger` as its text and well. One family, not two.
23. `--fill-warning` — warning fill, with its text and tint.
24. `--fill-success` — success fill, with its text and tint.

State families may keep the existing Hill Country satellite names (`--text-danger`, `--tint-danger`, `--on-tint-danger`, `--border-danger`, `--on-fill-danger`, and the warning/success equivalents) until admin is restyled. They are not duplicates of the plate; they are the admin kit. They must not leak onto public paper except a retraction notice and an error on a field.

Delete everything else in the palette blocks.

### What a gate would need

`check:contrast` already owns hexes and pairs. `check:invariants` section 31 already owns "declared implies consumed", but it counts any `var()` including aliases, and it lets the carried map hide zeros until 2026-11-30. To hold a 24-token public list, the gate needs all of these, and the carried map empty:

1. **Closed set.** The three palette blocks declare exactly the named public tokens (plus the admin state satellites, listed). An extra `--*` colour name fails. A missing name fails. The assertion is a list of names, not a count floor: a floor of 24 lets a rename pass.
2. **Paint, not alias.** Every name in that list has at least one paint-property `var()` in `app/` after comment strip, or a JS paint string in `app/lib/content/`. `:root { --a: var(--b) }` does not count. A mention in `scripts/check-*.mjs` does not count.
3. **No silent duplicate.** No two public tokens share both the light hex and the dark hex. That is what `--brand-active` / `--brand-pressed` in light, `--border` / `--line-strong` in light, and `--chart-purple` / `--brand` in light are.
4. **Division of labour, by selector family.** `--brand` as `background` or `fill` is legal only on an allowlisted primary class (today: `.btn-brand`, `.search-submit`, and the playground Compute control). `--dust` as `color` or `fill` fails. `--fig-oxide`, `--fig-leaf`, `--fig-cadet`, `--fig-dust-300` appear only in figure, caption `.fnum`, chart, and diagram output.
5. **`--fig-dust-300` is not a series.** `CHART_SERIES_TOKENS` must be the three series names above, in order, and must not contain `--fig-dust-300` or `--brand`.
6. **Pair matrix matches the list.** Every public token that is text or a series stroke has a measured pair against `--paper`. `--dust` has no text pair. `--fig-dust-300` has no series pair. Lamp and chrome names, if they reappear, fail by (1).

Do not keep a carried map beside this. A token with no painter is deleted in the same commit, or it is not declared.
