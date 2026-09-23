# core.md changes

Draft for the seat. The lines in `dustinedwards/core.md` (as of 2026-09-22) that should change once `design-law.md` and `standing-rulings.md` are filed. Current text first, then the replacement.

## 1. "The design" section

Current:
> **Paper and Plate** (ruling 123, internal name only): warm limestone paper, brown-black ink, 1px dust hairlines, Source Serif for reading, Inter for names and UI, mono for values. Purple means clickable; oxide belongs to figures; leaf and cadet are figure series (ruling 122). Drawings are flat plates in the taxonomic-key tradition; light touches only glass (124). Header: logo in full color, sticky, labelled Menu on mobile (126). Public file names start `dustin-edwards-` (127). American spelling everywhere.

Replace with:
> **Paper and Plate** (internal name only). The whole design law is **`design-law.md`**, one page with each line citing its ruling. Read it before any job that changes what a reader sees. American spelling everywhere.

## 2. "Where the rulings live" section

Current, first three bullets:
> - **`decisions-vol-20.md`** is the ACTIVE volume. New rulings go there.
> - **`decisions-vol-19.md`** is FROZEN (2026-09-22): the Paper and Plate redesign, rulings 106 to 128. Read a ruling there by number when a job cites it; never read the whole volume cold.
> - **`retired-2026-09.md`** records the rulings 116 retired.

Replace with:
> - **`design-law.md`**: every standing design ruling, merged. **`standing-rulings.md`**: every other standing ruling, one line each with its enforcer, plus the pending list. Together these are the rulings in force; a job cites a line from them.
> - **`history-index.md`**: every done, superseded and stale ruling, with its evidence. The volumes (`decisions-vol-14.md` to `-19.md`, frozen) are history behind it.
> - **`decisions-vol-20.md`** is the ACTIVE volume. A new ruling goes there AND updates the line it changes in `design-law.md` or `standing-rulings.md` in the same filing, or the two drift.

Keep the `awards-2026-2027.md` and "hard rules are CLAUDE.md" bullets as they are.

## 3. The reading rule

Current:
> **Reading rule (ruling 129):** a job names the rulings it needs; a session reads core.md, CLAUDE.md, the job, and those rulings. Nothing else is required reading.

Replace with:
> **Reading rule (ruling 129):** a session reads core.md, CLAUDE.md, the job, and the lines of `design-law.md` or `standing-rulings.md` the job cites. It opens a volume only when a job cites a ruling by number for its history.

## 4. "What this is"

Current:
> ...so there are no external links yet and renames need no redirects.

Replace with:
> ...so there are no external links yet. Renames still ship with their redirect (ruling 53, applied again by 127 and 130).

This sentence contradicts ruling 53, and what shipped follows 53.

## 5. Pending

Current:
> - Queue: plate redraw, color collapse (128), file prefix (127), American spelling, design sync.

That queue has landed: 128 in PR #75, 127 in PR #76, the plate redraw in PR #82, American spelling in PR #81. Replace with the "Pending" list at the end of `standing-rulings.md`, which is what is actually open.

Keep "Dustin's open decisions" as written.
