# The logo

Moved from Capsid (`dustinedwards/logo-spec.md`) on 2026-10-13. Ratified by Dustin 2026-07-29: the frame-locked microscope-e. Values are law. Every asset is rebuilt from the path data at the end of this file by `npm run build:icons` (`scripts/build-icons.mjs`, tracked, which also rebuilds the asset manifest). Never hand-edit path data.

## The system

Every element hangs off one center point O and one axis angle (59.5 deg): straight edges run in the frame's two perpendicular directions, and every curve is an arc of one of seven circles.

## The frame

viewBox 0 0 375 375. O = (192.2, 227.1). u = (cos 59.5, sin 59.5) is the tube direction; av = (sin 59.5, -cos 59.5) the barrel direction. point(p, q) = O + p*av + q*u.

## Primitives

- **Tube** (purple): strip p in [0, 39.6], left edge through O, from q = -163 to q = -17.5.
- **Cap** (purple): 40x40, frame aligned, centered on the tube axis (p = 19.8) at q = -200.5. Rhythm: cap / 17.5 / tube / 17.5 / barrel.
- **Barrel**: a rectangle with a corner at O. Pale p in [0, 39.3] x q in [0, 36]; amber p in [39.3, 75.4] x q in [0, 36], authored with a 0.4px underlap to prevent anti-aliasing hairlines.
- **Arc** (rust): between circles about O at r 75.4 and 111.6, turning tangentially at -30.5 deg into the strip p in [75.4, 111.6], q in [0, 36]; the top end is bounded by p = 39.6.
- **Master cut**: the line q = 36 ends pale, amber and rust in one straight edge.
- **Ring** (purple): between circle (O, r 112.5) and the counter circle (186.9, 228.0, r 69.2), spanning 45 to 257.5 deg about O; both end cuts are hidden.
- **Bowl** (purple): the bottom half-disc of circle (251.4, 273.2, r 39.4). The e's aperture is the crescent where it overlaps the counter circle, closing at (216.0, 290.8).
- **Base** (purple): baseline y = 341.7 plus shoulder circles r 44.9 at (123.5, 357.3) and (267.2, 357.3), mirrored about x = 195.35, rising to meet the ring at y about 312.6.

Families: about 39.5 (tube 39.6, bowl 39.4, cap 40); 36 (barrel width, arc thickness, master cut); gap 17.5 at both tube ends.

Ink box: x from 79.7 (ring) to 309.3 (base), y from 16.91 (cap corner) to 341.7 (baseline). A control-point box crops the ring.

Paint order: ring, bowl, base, arc, tube, amber, pale, cap.

## Color

The five purple paths take the `--brand` token, #4F2D7F light and #B7A5E0 dark (7.9:1 on the dark paper; the light purple is about 1.7:1 there). The warm paths are constant: rust #CE7F44, amber #E0A428, pale #E2BC6B.

On the site the mark is `app/components/site-logo.tsx`, path data generated verbatim from `public/dustin-edwards-logo.svg`, with the purple paths on `.site-logo-brand { fill: var(--brand) }`. That class is the whole dark-mode story: the token resolves through the theme selectors, so nothing flashes. The four public SVGs (`dustin-edwards-logo`, `-logo-header`, `-logo-dark`, `-logo-header-dark`) are canonical; the header copies its viewBox and size from `-logo-header`.

## Idealizations (deliberate deviations from the source PNG)

1. The arc's outer flare is removed; the edge is parallel at 111.6.
2. The bowl's left side is the disc's own circle.
3. The cap is exactly on the tube axis (the source was 1.7px off).
4. The ring's end cut is retracted under the tube.

## Assets

- **`dustin-edwards-favicon.svg`**: a #4F2D7F full-bleed tile, mark #EDE8F5, same `square()` helper and padding as the ICO, no media query. A `prefers-color-scheme` query resolves against the OS scheme while the tab strip is painted by the browser theme, and nothing bridges the two.
- **`favicon.ico`**: purple tile, mark #EDE8F5, 16/32/48, PNG encoded. The lavender mark halved small-size contrast (4.70 versus 10.43).
- **Large tiles** (`dustin-edwards-apple-touch-icon` 180, `dustin-edwards-android-chrome` 192/512, `dustin-edwards-maskable-icon` 512): purple tile, lavender #B7A5E0 mark. Maskable padding 0.19.
- **`site.webmanifest`** background and theme color: #4F2D7F.
- **`dustin-edwards-og-image.png`**, the default social card: purple tile, lavender mark. Per-post cards are `build:og`'s (`docs/PUBLISHING.md`).
- No check covers the mark or icons. A regenerated asset is verified by looking at it and by the served bytes; browsers cache favicons past a hard refresh, so the tab is not evidence.

## The mark

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 375">
  <path fill="#4F2D7F" d="M 271.75 306.65 A 112.5 112.5 0 1 1 167.85 117.27 L 177.21 159.48 A 69.2 69.2 0 1 0 238.83 273.73 L 271.75 306.65 Z"/>
  <path fill="#4F2D7F" d="M 212.00 273.20 L 290.80 273.20 A 39.4 39.4 0 0 1 212.00 273.20 Z"/>
  <path fill="#4F2D7F" d="M 81.40 341.70 A 44.9 44.9 0 0 1 119.10 312.62 L 271.60 312.62 A 44.9 44.9 0 0 1 309.30 341.70 L 81.40 341.70 Z"/>
  <path fill="#CE7F44" d="M 173.37 117.10 A 111.6 111.6 0 0 1 288.36 170.46 L 306.63 201.48 L 275.44 219.85 L 257.17 188.83 A 75.4 75.4 0 0 0 193.75 151.72 Z"/>
  <path fill="#4F2D7F" d="M 109.47 86.65 L 143.59 66.56 L 217.44 191.92 L 183.32 212.02 Z"/>
  <path fill="#E0A428" d="M 225.72 207.36 L 257.51 188.63 L 275.78 219.65 L 243.99 238.38 Z"/>
  <path fill="#E2BC6B" d="M 192.20 227.10 L 226.06 207.15 L 244.33 238.17 L 210.47 258.12 Z"/>
  <path fill="#4F2D7F" d="M 134.88 51.38 L 100.42 71.68 L 80.12 37.21 L 114.58 16.91 Z"/>
</svg>
```
