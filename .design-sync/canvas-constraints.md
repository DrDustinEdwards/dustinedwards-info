# What is already decided

Read this before designing anything for dustinedwards.info. Everything below is
ruled, measured or load-bearing, and none of it is yours to re-decide. It is
short on purpose: it rides in the README the design agent is guaranteed to read,
and every line here is one that has already been broken once.

Where this file and a stylesheet disagree, **the stylesheet is right**. It is the
owner; this is a summary.

## The header is paper, and that is recent

For a month the header was a purple bar restored byte-identical to a specific
commit by Dustin's order, with two design rulings SUSPENDED for it rather than
applied. **Ruling 117 lifted that suspension and the paper header shipped:**
wordmark plus icon-only search and theme on the first line, destinations wrapping
as text beneath, one dust rule under the whole thing, no breakpoint and no menu
panel. Both controls are glyphs in `--brand` with no border, no radius and no
fill in any state.

What survives from the bar is the lesson below, not the bar.

## Never invent a token

Every colour, space, radius, weight and layer already has a custom property, and
the token table in the conventions header lists the families. A new name is not a
shortcut: it is a value with no owner, nothing painting it and no gate watching
it.

This is not hypothetical. The 2026-09 redesign invented `--bar-fill` while
`--surface-chrome` already existed and was already documented, and that single
substitution invalidated every colour in the header at once, because the
surrounding tokens were still measured against the token it replaced.

- The five chrome role tokens still exist for the social cards and are no longer
  painted by any public sheet, because the header is paper. They are not a
  surface to reach for.
- **Token pairings are MEASURED and their numbers are owned by `check:contrast`.**
  Use the tokens and the measurement holds. Compute a colour yourself, or swap
  one side of a pair, and it does not, and the gate will say so after you have
  done the work rather than before.
- Popover elevation and pinned bars take `--border-strong`, never `--border`.

## The wordmark outranks, deliberately

`.site-header-brand` carries its own `:visited` and `:hover` rules at a higher
specificity than the base anchor rules, and that is the fix rather than the
mess. The base `a:visited` outranks the plain class, so without those rules the
site's own name turns visited-coloured for every returning reader. The comment in
`app/styles/public-chrome.css` says, in the file: do not "simplify" them away.

An identity element is not somewhere the reader has been. It is who the site is.

## Layering has an order, and one trap in it

The layer tokens are named and ordered, and the trap is that **the dropdown layer
sits BELOW the pinned bar**. An overlay menu on the dropdown layer renders
underneath the bar that opened it. The overlay menu takes the overlay layer,
which sits above the bar and below the skip link.

Never write a raw `z-index`. The scale exists because the sheets once carried
values one apart, which is a record of somebody adding one to whatever was there.

## The grid is `.tracks`, not `.page`

Both exist and they are different things. `.tracks` is the redesign's track grid,
where the TRACK is the measure, so a full-bleed figure and a paragraph share one
source of truth. `.page` is the older shell, still live on public routes, retiring
page by page. Using one where the other belongs is the exact drift the gates
exist to catch, which is why the new grid took a distinct name instead of
redefining the old one.

## Purple is the only accent a user can click

Limestone and dust are neutrals. **Iron oxide and leaf are FIGURE SERIES, not
atmosphere** (ruling 122): oxide is series 1 and carries every annotation, the
figure and plate numbers, leaders, labels and strokes; leaf is series 2; cadet
is series 3; and the dust step used for lawn and halo texture is never a series
at all. None of them ever lands on a control, and purple never lands in a
figure: in light `--brand` IS the link colour, so a purple series reads as a row
of links. If something is interactive, it is purple or it is not signalling
interactivity.

**The system is Paper and Plate** (ruling 123), internal only, never printed on
the site. The page is paper; the drawings are plates, which are flat line work
in the taxonomic-key tradition: outline rather than shading, mono labels on
leaders, a scale bar.

**Light touches only glass, and a figure is never lit** (ruling 124). No
gradient, no field, no shadowed rim, no haze behind a figure, because a lit
diagram is a diagram pretending to be a photograph. Glass is the thing
physically over the page, briefly: a modal dialog, the image viewer, and a
readout held over a figure. Never the header, a well, a panel, live results, the
rail, or anything sticky. Solid first, blur 12px at most, no brand fill, radius
0, opaque under `prefers-reduced-transparency` and in print. `conventions.md`
carries the pane's own values; this file does not restate them.

## The kill list is five conditions, not five words

A word ban teaches the next session to rename the class and keep the object, so
ruling 118 replaced the bans with conditions naming the object: CARD, BENTO,
PILL, CHIP, TRACKED CAPS. They are written out in `conventions.md`, which also
carries the narrowed rules on fills, radius, the measure and mono density. That
file is the owner and a gate binds it to the stylesheets; this one does not
restate its values.

## The public plane does not hydrate

Public routes ship no framework script. Every fact on a public page is in the
server HTML, and JavaScript may enhance anything but is never the only path to
it. A design that only works once script has run is not a design this site can
ship.

So: no component that needs mount-time measurement to look right, no interaction
whose only affordance is a JavaScript handler, and no state that exists only in a
client store. Enhancements arrive as separate nonced script tags, never as
framework effects.

## Caching, which is in no stylesheet

Worth knowing because it constrains what a page may contain, and no CSS comment
will ever tell you:

- A response that declares no cache policy is **refused**, not cached: the Worker
  stamps `private, no-store` on anything that does not opt in. Sharing is opt-in
  and refusal is the default.
- Any route that varies by cookie and receives a request carrying **any** cookie
  is downgraded to `private, no-store`. Presence of a cookie, not a particular
  cookie.
- Cached public pages are stored per resolved theme, so a page's HTML may not
  encode anything else that varies per reader. If a design needs per-reader
  content in the HTML, it has left the cacheable plane and should be an
  enhancement instead.

## Accessibility floors that are not negotiable

- Both themes are first class. A themed container owes **both**
  `background: var(--paper)` and `color: var(--text)`; setting only the
  background inherits the other theme's text colour and has already shipped a
  preview with invisible body copy. `--paper` is the ground of BOTH planes: ruling 128 collapsed the four creams
  into it, so there is no second ground to pick by mistake.
- Focus is always visible: `--brand`, 2px, 2px offset, square corners. The
  ring token differs by surface, and now that the header is paper the only
  non-default ring left is `--focus-ring-on-brand`, on a filled brand control,
  which the public plane no longer has.
- An icon-only control needs an accessible name and an `aria-hidden` icon.
- Contrast is measured, not eyeballed, and the thresholds belong to the gate.
