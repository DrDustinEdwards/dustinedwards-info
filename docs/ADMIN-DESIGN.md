# Admin design

The rules the admin plane's pages follow. It is a specification, not a record of
what is built: where the repo disagrees with this file today, the repo is the
thing that changes. Nothing here adds a write path, a route or a gate.

One reader, one screen at a time, deciding something. That is the whole audience,
and it is the test every rule below answers to.

## The page shell

Every admin page opens with a title and one sentence of status. The title is the
section's name in the sidebar, spelled identically. The sentence says what the
page currently holds and whether anything is wrong: "16 posts, 11 published. Ask
index in agreement." It is a fact about right now, never a description of what
the page is for.

If nothing is wrong the sentence still appears. A status line that only shows up
in trouble teaches the reader to stop looking at it.

Every page uses the shell. A page with no title is a page the reader cannot name
when something goes wrong on it.

## Content widths

One column. Text and controls sit in a measure of `72ch`, capped at `64rem`; a
table or a media grid may use the full width of the main column and nothing else
may. The body inset is `--site-inset`, already declared once on `body`, and the
admin never restates it.

At 375px the sidebar is a drawer and the main column is the whole viewport minus
the inset. Nothing is hidden at that width. A control that does not fit moves
into the row's actions menu; it does not disappear.

## Filters: one pattern

Underline tabs, each carrying a count.

They are links carrying a query parameter, so the filtered view is a URL: it
survives a reload, it is linkable, the back button restores it, and it works with
no script. The active tab takes `aria-current="page"` and a 2px underline in
`--brand`. The count is a plain numeral beside the label, and it is derived from
the same array the list below is drawn from, never from a second query.

A count of zero renders. Zero is a real answer to "how many are pending".

Free-text search, where a section needs it, is one input to the left of the tabs
in a GET form. Selects are not a second filter pattern; a facet with a fixed
vocabulary is tabs.

## Tables: one pattern

Dense rows: 40px minimum row height at 1280, `0.9375rem`, one line of text per
cell. At most one column in a table may wrap, and it is the column carrying the
sentence the reader is there to read. Every column heading is a noun the reader
would say out loud. The first column after any selection checkbox is the thing's
name, and the name is the link.

One actions menu per row, at the right edge, holding every action for that row.
No row shows a row of loose buttons: three verbs across eighteen rows is
fifty-four controls competing with the eighteen names the reader came for. The
menu is a `<details>` popover, so it opens with no script and its items are real
submit buttons.

State is a word first. A pill carries the word, and colour and border style are
the second and third channels, so it still reads three ways under forced-colors.

Wide tables scroll inside their own `overflow-x: auto` region with `tabindex="0"`
and a label. The document never scrolls sideways.

## Three button weights, and there is no fourth

- **Primary**: filled `--brand`, `--on-brand` text. One per page, and it is the
  thing the page exists to do. New post. Save.
- **Secondary**: `--border-strong` outline, `--text` label, transparent fill.
  Everything else that acts.
- **Danger**: filled `--fill-danger`, `--on-fill-danger` text. Only on a control
  that destroys, and only inside a confirmation.

A destructive verb outside a confirmation takes the secondary weight. Nine red
buttons on a list page are nine alarms, and the reader stops seeing red.

Row-menu items and overflow-menu items are not a fourth weight: they are the
secondary weight without a border, because the menu's own edge is the border.

Disabled means the action exists and cannot run now. Its label does not change.

## One notice pattern

A rectangle: `--surface` fill, 1px `--border` edge, `0.5rem` radius, one glyph,
one heading line, one sentence, and the control that fixes it if there is one.

Three variants, and the variant is the border and the glyph, never the fill:

- **Neutral** for what happened. "Deleted 2 of 2."
- **Warning** `--border-warning` for a state that needs attention but is not
  broken. Drift.
- **Error** `--border-danger` for a thing that failed.

A result is announced with `role="status"`. A standing condition is not: it is a
`<section>` with an accessible name, so it is in the landmark list and silent
until the reader goes to it. A state the page is in on every load is not news.

The box matches the outcome. A success in an error box is the defect this rule
exists to stop.

## One destructive confirmation

A native `<dialog>`, opened by the action refusing an unconfirmed POST. The
refusal is the confirmation step, not an error, so the no-script path reaches the
same dialog by re-render rather than hitting a dead end.

Inside it:

- A title naming the count and the thing. "Delete 2 posts".
- One sentence on what is lost and what is not.
- The list of what is at stake, each item re-carried as a hidden field.
- A text field, focused on open, asking for the count to be typed.
- Cancel, returning to the view the reader was in, filters intact.
- The danger button, **disabled until the typed value matches exactly**.

Two things make that work and both are requirements, not details. **The intent
travels as a hidden input, never on the submit button**, because a disabled
button contributes no name and no value, and a confirmation whose intent rides on
the submitter cannot ever be disabled. And **the server checks the same typed
count**, because a handler does not run for a reader without JavaScript and the
deletion does. The disabled button is earlier feedback; the action is the gate.

`window.confirm` and `window.prompt` are not confirmations. They are script-only
ceremony in front of destruction that is not script-only.

## Explanations

An explanation goes in a `<details>` whose summary is the question the reader
would ask. It never goes in a paragraph inside a table, and it never goes in a
`<caption>`: a caption is read before every row, so a five-sentence caveat is a
five-sentence caveat fifty-four times.

The closed summary must be enough to act on. The open body is for the person who
wants to know why the number is what it is.

**Every sentence on an admin page is for the person deciding.** Not for the
person who built it, not for the next engineer. Reasons for a design belong in a
source comment. A caveat that changes what the reader would do belongs in the
`<details>`. A sentence that changes neither belongs nowhere.

## Spacing

A 4px scale: 4, 8, 12, 16, 24, 32, 48. In rem: `0.25`, `0.5`, `0.75`, `1`,
`1.5`, `2`, `3`. Nothing else. No `0.375rem`, no `0.4rem`, no `0.3125rem`.

Gaps inside a control use 4 or 8. Gaps between controls in a row use 8 or 12.
Panel padding is 16 at 375 and 24 at 1280. Space between panels is 24.

## Tokens, themes, and the two widths

Tokens only. No hardcoded hex, and no inline style except a runtime numeric value
no token could name, such as a bar's width percentage.

Every surface, border and text colour is declared in both theme blocks. A token
declared in light and forgotten in dark keeps its light value under a dark theme
and no contrast check would see it. Popover elevation and pinned bars take
`--border-strong`, never `--border`.

Under `prefers-contrast: more`, muted text promotes and every default border
promotes to strong. Under `forced-colors: active` the palette yields entirely:
every fill carries a transparent outline so controls keep their shape, no meaning
is carried by background alone, and focus is an outline rather than a shadow.

Every page is designed at 1280 and at 375, in both themes, and all four are the
design rather than one design and three adaptations. Targets are 24px minimum.
Focus is always visible and never obscured by a pinned bar.
