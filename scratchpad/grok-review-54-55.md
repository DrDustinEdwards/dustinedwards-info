# Review: PR #54 and PR #55 against their handoffs and rulings 117 to 121

Read-only. Nothing in either PR was changed by this review.

**Refs.** Line numbers are at `origin/feat/sidenotes` (`d51cd9e` plus #55's four commits), which
contains both PRs. #54 is `origin/main..origin/feat/home-page`; #55 is
`origin/feat/home-page..origin/feat/sidenotes`.

**Sources read.** `part-b/02-home.html` and `part-b/01-post.html` off the canvas over the MCP read
surface; `decisions-vol-19.md` rulings 117 to 121 from Capsid.

**Method.** Every layout and paint claim below is measured on a local preview build of
`feat/sidenotes`, not read off the source or off a screenshot.

---

## PR #54, home, header and footer

### What the handoff asks for that the build does not do

**1. The name does not break over two lines.** `02-home.html` §2: "The name breaks over two lines
at both widths, which is why the leading is 0.92: two tightly stacked words read as one mark rather
than as a headline." The frame markup is `<h1 class="hname">Dustin<br>Edwards</h1>`.

Measured on the built page:

| width | box | font | line-height | lines | `<br>` present |
| --- | --- | --- | --- | --- | --- |
| 1280 | 1136 x 70 | 76px | 69.92px | **1** | no |
| 375 | 327 x 40 | 44px | 40.48px | **1** | no |

`app/routes/home.tsx:139` renders `{SITE.name}` with no break, and `app/styles/home.css:24` sets no
`max-width`, so the name cannot wrap at either width. The `line-height: 0.92` at `home.css:32` is
therefore painting nothing, and it is the one declaration the handoff justifies by the two-line
break. Either the break is intended and needs a `<br>` or a `max-width`, or the leading should go.

**2. Four writing rows, not five.** §4: "Five rows, then 'All writing'." The page renders **four**.
`app/lib/blog-listing.mjs:19` sets `HOME_CARDS = 4`, and `startHere` (`blog-listing.mjs:136`)
returns the lead plus `cards - 1`, so `app/routes/home.tsx:201` maps four posts. Neither #52 nor
#54 touched the constant. One-character fix, but it is a handoff number the build does not meet.

### What the build does that no handoff asks for

**3. A visited exemption on the evidence row.** `app/styles/evidence-row.css:34`,
`.evidence a:visited { color: var(--brand) }`. Ruling 117 grants the `a:visited` exemption to the
wordmark only. No handoff states the visited colour of the evidence figures, which on home are
links (§8 item 5). The reasoning in the comment is sound, but it is a rule this build invented.

**4. A visited exemption on the search control.** `app/styles/search-trigger.css:29`,
`.search-trigger:visited`. New in this PR, asked for nowhere.

**5. One media query in the header.** `app/styles/chrome-nav.css:30`,
`@media (max-width: 49.0625rem)`. §5 says "Natural flex wrapping. No media query but `print`" and,
four lines later, "At small widths the nav takes `order:3` and `flex-basis:100%`". Those cannot both
hold. The PR body reports this and chose the behaviour the frames draw. Flagged again here because
it is the one breakpoint on a header whose whole §5 claims to have none.

### Rules in the lock it breaks

**6. `.eyebrow` survives as dead tracked caps.** `app/app.css:981`:

```
.eyebrow {
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
```

Ruling 118 item 7 defines TRACKED CAPS as exactly that pair "on a label or eyebrow". **This PR
removed the markup that used it** (`<p className="eyebrow">` is gone from `home.tsx`) and deleted
`.home-section-heading`, which ruling 118 names by class, in the same commit, but left this one.
Zero consumers remain in `app/routes` or `app/components`.

**7. Three more orphans in the same block.** All dead after this PR, all still shipping:

| line | class | note |
| --- | --- | --- |
| `app/app.css:989` | `.hero-name` | sets `color: var(--brand)`, a purple display name, against 117's ink rule |
| `app/app.css:997` | `.hero-role` | dead |
| `app/app.css:1006` | `.hero-affiliation` | dead |

The PR deleted 86 lines of the legacy home block and stopped four rules short.

**8. Mono labels where ruling 118 item 6 asks for sans.** 118.6: "One mono channel per row, the
value; labels stay sans and muted." Two places put the label in mono too:

- `app/styles/post-rail.css:71` `.post-machine` sets `--font-mono` on the whole chronology, so
  "first published" and "Updated" are mono, not just the dates.
- `app/styles/post-shell.css:145` `.post-history b`, the "Post history" label, is mono.

This is a genuine conflict, not a simple miss: `01-post.html` §2 specifies "`--font-mono` 12px" for
the chronology row, and 118.6 is the later step. Ruling 93 says the later step wins and both values
are reported, so **this needs Dustin, not a unilateral fix**. Note 118.6 explicitly blesses "the
rail's dates" as mono; it is only the label channel in dispute.

### Clean, measured

No glass, blur, shadow or non-`--paper` fill anywhere in the sheets this PR touches. On the live
home page: **zero** elements with an opaque background among header, links, buttons and rows;
**zero** non-zero border radii; **zero** elements with `backdrop-filter`; **one** module script
(`theme.js`), so no framework on the public plane. Every `var(--…)` in `home.css`,
`evidence-row.css` and `post-rail.css` resolves to a token defined in `app.css` or `shell.css`.
Footer is paper with a single `--dust` top rule, no band, no gradient, no purple, satisfying 118.1.
Rows are ruled list items, which 118.7 explicitly exempts from CARD.

**This PR also resolves three objects ruling 118 names by name:** home's proof tiles (BENTO), the
header search and theme controls (PILL), and `.home-section-heading` (TRACKED CAPS).

---

## PR #55, sidenotes and head blocks

### What the handoff asks for that the build does not do

**9. The note is not in the rail, and carries no id.** `01-post.html` §1 puts
`<aside class="post-note" id="sn-1">` inside `.post-rail`. The build leaves it in the prose and
floats it (`app/styles/post-rail.css:141`). The PR body argues this at length and the argument
holds: alignment from the rail container requires measuring a paragraph's position, which is script
on a plane that does not hydrate. **The consequence it does not mention is the `id`.** The handoff's
sketch gives each note an anchor; `app/lib/content/pipeline.mjs:1383` emits none, so nothing can
link to a note and a footnote-style reference is not possible later without a migration of existing
notes.

Alignment itself is met. Measured at 1280: note left edge **72**, width **120**; rail left edge
**72**, width **120**. At 375: `float: none`, full width, inline in reading order.

### What the build does that no handoff asks for

**10. It refuses a heading inside a note.** `pipeline.mjs:1404`. Borrowed from `:::details`, and
defensible for the same reason, but it is a new authoring restriction no handoff states.

### Rules and correctness

**11. A fabricated date.** `content/posts/policy-in-the-api-not-the-mcp.md:14` sets
`date: 2026-08-26`. The post states only `## Update, August 2026` (line 77). **No day appears
anywhere in the post.** The 26th is invented. This is the substitution hard rule 13 forbids, in
published content, where it would read as a fact.

**12. An incoherent date.** `content/posts/ten-years-on-cloudflare.md` sets changelog
`date: 2026-07-30`. That is the post's own `date:` **and** the publication date of the earlier
version it says it replaced ("This post replaced an earlier version, published 2026-07-30"). The
post-history line would render "2026-07-30 first published · 2026-07-30 Replaced an earlier
version". The date the replacement happened is not stated in the post and was not available.

Both entries should either carry a date the post supports or be dropped until Dustin supplies one.

**13. The sidenote kind label is mono.** `app/styles/post-rail.css:159` `.post-note-kind` uses
`--font-mono`. Same conflict as finding 8: §2 says "A mono label names what kind of note it is",
118.6 says labels stay sans and muted. Later step wins, so this is Dustin's call.

**14. `writing_status: finished` on a living survey.** `ten-years-on-cloudflare.md` describes itself
as a dated product survey that replaced an earlier version and carries measurements forward. It is
also `featured: true`, so this is the post leading "Start here". "finished" is a defensible reading
but it is an authorial judgement made by an agent.

---

## Adjacent: two fail conditions ship on the post page today

Not introduced by either PR, and `post-enhancements.css` is untouched by both. Recorded because
#55 modifies that page and because PR #52 claimed these sections were restyled to Direction D.

Measured on the live post page: **five filled public controls** and **two non-zero radii,
including a 999px pill**.

- `app/styles/post-enhancements.css:187` `.post-action { border-radius: 999px; background: var(--surface) }`
- the same pair again at `post-enhancements.css:263`
- `app/styles/post-enhancements.css:74` `.code-copy { border-radius: 0.25rem; background: var(--bg) }`

The controls affected are Copy as Markdown, Open in Claude, Open in ChatGPT and Permalink.

**Why PR #52's restyle did not take.** `app/styles/post-shell.css:163` sets `.post-action` with a
colour and no background or radius. Both selectors are `(0,1,0)`. `blog.$slug.tsx` imports
`post-shell.css` at line 43 and `post-enhancements.css` at line 45, so the later import wins the tie
and the pill survives. PR #52's statement that the kept sections were "restyled into the column in
Direction D terms" is **false for `.post-actions`**; the claim was never measured.

Ruling 117's fail conditions list "any filled public control" and the kill list names "pill chips or
buttons". Ruling 118 item 3 says "Never a pill". This is a one-rule fix in `post-shell.css`, but it
belongs to whoever owns the post page, not to a review.

---

## Every sentence PR #55 writes into a published post

Verbatim, for Dustin to read before they ship. All three files are real published posts.

### `content/posts/observable-plot-inside-a-worker.md`

Frontmatter:

> writing_status: finished

> assumed_audience: "People rendering charts on the server who have hit a DOM dependency, and anyone weighing a library against workerd's limits."

> key_takeaways:
> - "Observable Plot renders inside a Worker with linkedom as the DOM: 930 KiB raw, 226 KiB gzipped, and byte-identical SVG in Node and workerd."
> - "The three configurations that failed define the boundary as precisely as the one that works, and two of the failures generalise well beyond charts."
> - "Accessibility is enforced by the build rather than promised in the prose."

Body, a new sidenote after the paragraph ending "what eliminated most of the field":

> :::sidenote{kind="Constraint"}
> Byte-identical is the word that decides this. Two writers producing *equivalent* SVG would still fail the build's comparison, because the gate compares bytes rather than rendered pictures.
> :::

### `content/posts/ten-years-on-cloudflare.md`

> writing_status: finished

> assumed_audience: "Developers choosing among Cloudflare's products, who want the refusals listed beside the adoptions."

> key_takeaways:
> - "Every Cloudflare developer product as of September 8, 2026, what each does in plain words, and whether this site uses it."
> - "The refusals sit in the table with everything else, because a survey that lists only what worked is an advertisement."
> - "The pages, database, uploads, search, AI answers, alert mail and publishing pipeline all run on Cloudflare, and nothing else is in the stack."

> changelog:
> - date: 2026-07-30
>   note: "Replaced an earlier version that surveyed the same rebuild before the product table existed; its dated measurements are carried forward."

### `content/posts/policy-in-the-api-not-the-mcp.md`

> writing_status: finished

> assumed_audience: "Architects deciding whether to build an API or an MCP server, and where authorization should live once they have both."

> key_takeaways:
> - "An API and an MCP server answer different questions and compose as layers; asking which to build is the wrong question."
> - "Authentication, authorization and business policy belong in the HTTP API, implemented exactly once."
> - "An MCP server should be a thin translation layer that contains none of that policy."

> changelog:
> - date: 2026-08-26
>   note: "Added the August update section, reporting how the rule held in the second production implementation."

**Provenance.** Every takeaway paraphrases a claim the post already makes, and both changelog notes
describe revisions the posts mention. The two `date:` values are the problem, findings 11 and 12:
`2026-08-26` appears nowhere in its post, and `2026-07-30` is the wrong date for the event it
describes. Nothing else here is drawn from outside the posts.

---

## Summary

Neither PR matches its handoff cleanly.

- **#54:** two handoff items unmet (name wrap, row count), three additions no handoff asks for, four
  dead rules left behind including a named tracked-caps object, and one later-ruling conflict to
  settle. Everything the lock can be measured against on home and the header is clean.
- **#55:** the mechanism is sound and the alignment is exact, but it ships **two wrong dates in
  published posts**, one of them invented outright, and inherits the same mono-label conflict.

The single most serious item is finding 11: a date that does not exist in the source, written into a
published post by an agent.
