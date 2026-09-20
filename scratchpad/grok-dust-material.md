# Dust as material and effect

Public lock: Swiss editorial, limestone paper, ink text, `--brand` as ink only, `--dust` as structure, Light as `--lamp-chroma` atmosphere. Radius 0, no blur, no cards, public routes ship no framework script, CSS-only motion with a reduced-motion equivalent. `--dust` vs paper measures **1.57:1** and cannot carry text. Figure ramps stay leaf / iron oxide / dust.

---

## 1. Dust as material

Dust is already a colour. As material it may only thicken an existing edge or empty field. It may not become a second sheet.

**Grain on paper.** A 1% opacity noise wash on `html`/`body`, tiled, `pointer-events: none`. Mechanism: one tiny inline SVG `feTurbulence` (`baseFrequency` ~0.8, `numOctaves` 1) as `background-image`, or a 32–64px data-URI PNG. Cost: ~0.4–1.2 KB once; paint is cheap if the tile is small and not `background-attachment: fixed`. Reduced-motion: keep (static). Print: `@media print { background-image: none }`. Stop: if grain is visible at arm’s length or reads as film grain / craft paper stock.

**Softened hairlines.** Keep `1px` `--dust` rules. Soften with a *second* 2–3px `box-shadow: 0 1px 0 color-mix(in oklab, var(--dust) 35%, transparent)` — spread, not blur filter. Cost: ~0 B extra tokens; extra layer on header/footer/wells only. Reduced-motion: keep. Print: drop the shadow, keep the 1px rule. Stop: if the edge looks airbrushed or like glass.

**Settling gradients.** Footer top and figure bottom only: `linear-gradient(to top, color-mix(in oklab, var(--dust) 18%, var(--paper)), transparent 48px)`. Same mix with `--lamp-chroma` at ≤8% if Light is on. Cost: ~80 B CSS, one extra paint per footer/figure. Reduced-motion: keep (static). Print: none. Stop: if the page looks vignetted or the column yellows.

**Empty-state grounds.** Index empty and 404 only. Same 48px settling gradient *or* the grain tile at half strength. No illustration, no mote field. Cost: reuse grain SVG. Print: none. Stop: a full-bleed dusty rectangle behind the column.

**Chart furniture.** Axes, grid, ticks: `--dust` at 1px. No grain in the plot. Zero extra bytes if charts already tokenise. Print: keep lines. Stop: area fills in `--dust` or iron oxide as decoration.

**Dark-theme inversion.** `--dust` lightens against the ink sheet so contrast stays ~1.5–1.7:1, never text-capable. Grain opacity halves (noise on dark reads as dirt). Settling gradients invert direction only if the footer still needs a join. Stop: light grain on dark that looks like noise-dither or CRT.

**Do not use:** `filter: blur()`, `backdrop-filter`, `mix-blend-mode` on type or chrome (blend + limestone becomes mud; blend + `--brand` becomes a stain). `feTurbulence` on a full-viewport layer every frame is the texture-pack line.

**The texture-pack line.** Dust stops being limestone when (a) grain is the first thing you notice, (b) more than one surface is noisy, (c) a rule is thicker than 1px *and* soft, or (d) empty states look illustrated.

---

## 2. Dust as effect, with Light

No-script rule: CSS only. No canvas motes, no JS particles.

**Haze where light falls.** A `::after` on `body` or the figure wrap: radial gradient from `color-mix(in oklab, var(--lamp-chroma) 12%, transparent)` to transparent, 40–60vh, fixed to the figure or the top third of home. Feasible everywhere. Support: gradients + `color-mix` (all current engines). Reduced-motion: keep, static. Reading pages: **one figure max**, or skip. Build this first and judge live — it is the only Light+Dust join that does not move.

**Motes in the beam.** CSS-only means 3–6 `box-shadow` dots on a 1×1 pseudo, `opacity` 0.2–0.35, optional `@keyframes` opacity (not translation). Support: fine. Reduced-motion: freeze opacity, or remove. **Home or playground only.** On an essay it is theatre. Do not ship until haze is judged.

**Scroll-driven light angle.** `animation-timeline: scroll()` shifting `--lamp-chroma` mix on a figure overlay. Support: Chrome/Edge; Safari/Firefox incomplete — must degrade to static haze. Reduced-motion: static. **Home figures / playground only.** Reading pages keep static Light. Do not combine with motes.

**Dust-toned view transitions.** `::view-transition-old/new` with a `--dust` or `--lamp-chroma` wash. Support: Chromium; others snap. Reduced-motion / no VT: instant swap. Optional later; not a first instance. Public no-hydrate still allows the CSS API.

**Build first:** footer settling gradient + optional figure haze using `--dust` and `--lamp-chroma` only. Judge at 375 and 1280, light and dark, `prefers-reduced-motion`, print. No motes, no scroll timeline, no view transition until that pass is boring.

---

## 3. The line

1. Dust never carries text, icons, or focus. Cap remains **1.57:1** against paper (±0.2 in dark). If a dust element exceeds ~2:1, it is ink. Demote it.
2. Maximum **two** atmospheric elements on one page: (hairline system, which is structure, does not count) + at most one of {grain tile, settling gradient, haze}. Motes and scroll-light count as a third and are forbidden on reading pages.
3. Kill if: anything blurs; a pill or card appears to “hold” dust; grain is visible in a screenshot at 100%; Light moves on an essay; more than one gradient settles; dark grain looks dirty; print still shows atmosphere; motion has no `prefers-reduced-motion` kill.
4. Structure stays 1px `--dust`. Atmosphere may use `color-mix` of `--dust` or `--lamp-chroma` at ≤20% against `--paper`. Iron oxide and leaf stay inside figures, not on chrome.
5. If you have to explain the dust, remove it.
