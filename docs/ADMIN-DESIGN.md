# Admin design

The rules the admin plane's pages follow. A specification, not a record of what
is built: where the repo disagrees with it, the repo changes. Nothing here adds a
write path or changes what a save means.

One reader, one screen at a time, deciding something. That is the whole audience
and the test every rule below answers to. **The reader is the operator, not the
person who built this.** Internal names stay off the page: not "Private plane",
not "Ask index", not "origin requests", not `sync_posts`, not "sha-changed".

## The page shell

The topbar and the rail are `--surface` with a `--border` seam and no brand fill.
Brand is reserved for one thing per page, the primary action, so the eye lands on
the thing the page is for rather than on its own furniture.

Every page opens with a title and one sentence of status. The title is the rail's
name for the section, spelled identically. The sentence says what the page holds
and whether anything is wrong.

**The status sentence and the notice never disagree.** With a notice on the page,
the sentence says the same thing in fewer words. With nothing wrong there is no
notice and the sentence still appears, because a status line that shows up only
in trouble teaches the reader to stop looking at it.

## Content widths, and 375

One column. Text and controls sit in a measure of `72ch` capped at `64rem`; a
table may use the full main column and nothing else may. The body inset is
`--site-inset`, declared once on `body` and never restated here.

**At 375 the rail becomes the drawer the shell already has**, never
`display: none`: `.admin-menu-button` opens it, `--z-drawer` puts it over the
page, `--z-drawer-scrim` and `--scrim` dim what is behind, and Escape and the
backdrop close it and hand focus back. That mechanism is used, not redesigned.

Nothing else is hidden at 375. A control that does not fit moves into the row's
actions menu; it does not disappear.

## Radius

`0.25rem` on controls: buttons, inputs, pills, menu items. `0.5rem` on
containers: panels, notices, dialogs, the table frame. Only those two, and no
`0.375rem` anywhere.

## One filter row

One row: the search input on the left, then underline tabs each carrying a count.

**No submit button.** The input submits on Enter. Tabs are links carrying a query
parameter, so the filtered view is a URL: it survives a reload, it is linkable,
the back button restores it, and it works with no script. The active tab takes
`aria-current="page"` and a 2px underline in `--brand`.

The count is a plain numeral beside the label, derived from the same array the
list is drawn from, never from a second query. Zero renders: it is a real answer
to "how many are pending". Selects are not a second filter pattern; a facet with
a fixed vocabulary is tabs.

**A menu with nothing in it is not rendered.** An overflow labelled Maintenance
holding no items teaches the reader that menus here are not worth opening.

## One table pattern

Dense rows: 40px minimum at 1280, `0.9375rem`. At most one column wraps, and it
is the one carrying the sentence the reader came to read. Every column heading is
a noun they would say out loud.

**The title comes first and the status pill sits on the title row**, because the
reader scans names and wants the state of the name they found. The pill carries
the word first; colour and border style are the second and third channels, so it
reads three ways under forced-colors.

One actions menu per row, at the right edge, holding every action for that row.
It is a **borderless kebab**: a bordered box on every row draws eighteen
rectangles to look past. No row shows loose buttons. The menu is a `<details>`
popover, so it opens with no script and its items are real submit buttons.

**No paragraph inside a table.** An explanation there is read before every row.

**At 375 the rows stack** into blocks, with the kebab sticky at the right in a
`--surface` column so the one control stays in the thumb's reach while the text
scrolls under it. Wide tables scroll inside their own `overflow-x: auto` region
with `tabindex="0"` and a label. The document never scrolls sideways.

## Three button weights, and there is no fourth

- **Primary**: filled `--brand`, `--on-brand` text. One per page, the thing the
  page exists to do.
- **Secondary**: `--border-strong` outline, `--text` label, transparent fill.
  Everything else that acts, sign out included.
- **Danger**: filled `--fill-danger`, `--on-fill-danger` text. Only on a control
  that destroys, and only inside a confirmation. A destructive verb outside one
  takes the secondary weight.

**A disabled danger button keeps its fill at `opacity: 0.4`**, never grey and
outlined: the reader has to see that the red button is the one they are being
stopped from pressing. Its label does not change. Menu items are not a fourth
weight, they are secondary without a border, because the menu's edge is the
border.

## One notice pattern

`--surface` fill, `0.5rem` radius, `var(--s4)` block padding and `var(--s6)`
inline padding, and a `0.25rem` left edge in the semantic colour. The edge is the
variant; the fill never is.

- **Neutral** `--border` for what happened.
- **Warning** `--border-warning` for a state that needs attention.
- **Error** `--border-danger` for a thing that failed.

One glyph, one heading line, one sentence, and the control that fixes it if there
is one. A result is announced with `role="status"`. A standing condition is a
`<section>` with an accessible name instead: in the landmark list, silent until
the reader goes to it. The box matches the outcome, because a success in an error
box is the defect this rule exists to stop.

## One destructive confirmation

A real `<dialog>` opened with `showModal()` over the platform scrim, reached when
the action refuses an unconfirmed POST. With no script the same step renders
inline on the page, so the reader gets there either way. Inside it:

- A title naming the count and the thing.
- One sentence on what is lost and what is not.
- What is at stake, each item re-carried as a hidden field.
- A text field, `required` and focused on open, asking for the count to be typed.
- Cancel, returning to the view the reader was in, filters intact.
- The danger button, **disabled until the typed value matches exactly**.

Two requirements make that work. **The intent travels as a hidden input, never on
the submit button**: a disabled button contributes no name and no value, so a
confirmation whose intent rides on the submitter can never be disabled. And **the
server checks the same typed count**, because a handler does not run for a reader
without JavaScript and the deletion does. The disabled button is earlier
feedback; the action is the gate.

`window.confirm` and `window.prompt` are not confirmations. They are script-only
ceremony in front of destruction that is not script-only.

## The overview

**No tabs.** Five checks is a list, not a filtered set; a tab row over five rows
is furniture.

Checks are named in words the operator uses and the finding is plain English, not
the verdict function's output. Failing ones sort first. A kebab appears only on a
row that has a repair; an empty menu on every row is the Maintenance defect.

**Stores are two figures**: what the repository holds and what the site is
serving. Those two can disagree, and the disagreement is why the panel exists.
The search index and the bindings go under a `<details>`; nobody opens this page
to read them. One primary action, Sync, and only when there is a repair.

## Explanations

An explanation goes in a `<details>` whose summary is the question the reader
would ask. The closed summary must be enough to act on; the open body is for
whoever wants to know why the number is what it is.

**Every sentence on an admin page is for the person deciding.** Reasons for a
design belong in a source comment. A caveat that changes what the reader would do
belongs in the `<details>`. A sentence that changes neither belongs nowhere.

## Spacing

A 4px scale: 4, 8, 12, 16, 24, 32, 48. In rem: `0.25`, `0.5`, `0.75`, `1`,
`1.5`, `2`, `3`. Nothing else.

## Tokens, themes, and the two widths

Tokens only. No hardcoded hex, and no inline style except a runtime numeric value
no token could name.

**Every token a page uses is declared in both theme blocks.** One declared in
light and forgotten in dark keeps its light value under a dark theme, and no
contrast check would see it. Popover elevation and pinned bars take
`--border-strong`, never `--border`.

Under `prefers-contrast: more`, muted text promotes and default borders promote
to strong. Under `forced-colors: active` the palette yields: every fill carries a
transparent outline so controls keep their shape, no meaning rides on background
alone, and focus is an outline rather than a shadow. A notice's left edge is a
border, not a background, so the variant survives there.

Every page is designed at 1280 and at 375 in both themes, and all four are the
design rather than one design and three adaptations. Targets are 24px minimum.
Focus is always visible and never obscured by a pinned bar.
