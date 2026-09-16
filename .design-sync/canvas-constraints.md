# What is already decided

Read this before designing anything for dustinedwards.info. Everything below is
ruled, measured or load-bearing, and none of it is yours to re-decide. It is
short on purpose: it rides in the README the design agent is guaranteed to read,
and every line here is one that has already been broken once.

Where this file and a stylesheet disagree, **the stylesheet is right**. It is the
owner; this is a summary.

## The header is not a design problem

The header is restored byte-identical to a specific commit by Dustin's order, and
two standing design rulings are SUSPENDED for it rather than applied. It is not
redesigned, not modernised, not tidied. If a brief seems to ask for a new header,
the brief is stale and the answer is no.

## Never invent a token

Every colour, space, radius, weight and layer already has a custom property, and
the token table in the conventions header lists the families. A new name is not a
shortcut: it is a value with no owner, nothing painting it and no gate watching
it.

This is not hypothetical. The 2026-09 redesign invented `--bar-fill` while
`--surface-chrome` already existed and was already documented, and that single
substitution invalidated every colour in the header at once, because the
surrounding tokens were still measured against the token it replaced.

- **The bar is `--surface-chrome`.** Its text is `--on-chrome`, its secondary
  text `--on-chrome-muted`, its logo fill `--mark-on-chrome`, its focus ring
  `--focus-ring-on-chrome`.
- **Those pairings are MEASURED and their numbers are owned by `check:contrast`.**
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

Limestone and dust are neutrals. Leaf and iron oxide are atmosphere and figure
palette. None of the three ever lands on a control. If something is interactive,
it is purple or it is not signalling interactivity.

Light is atmosphere, never meaning: nothing may depend on a glow to be
understood. Glass is for small floating controls only (theme toggle, search
trigger, overflow menus, the Ask frame). The header, sidebar, toolbars, chips,
form dialogs and the Ask body are solid, and glass is never a reading surface.

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
  `background: var(--surface)` and `color: var(--text)`; setting only the
  background inherits the other theme's text colour and has already shipped a
  preview with invisible body copy.
- Focus is always visible, and the ring token differs by surface: on the bar it
  is `--focus-ring-on-chrome`, not the default ring.
- An icon-only control needs an accessible name and an `aria-hidden` icon.
- Contrast is measured, not eyeballed, and the thresholds belong to the gate.
