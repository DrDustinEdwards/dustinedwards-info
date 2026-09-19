# Retired and merged rulings, September 2026

Ruling 116's record. Every ruling that stopped being standing law on 2026-09-19, with what it said, where it went, and why. **Nothing here is reversed.** A retired ruling was true and may still be true; it is no longer something a cold session is made to read, which is the whole of what retirement means.

The standing law after this cut is CLAUDE.md's twenty numbered hard rules, of which the ten plus HR10 carry the breakage and drift contracts and the rest are one line or a pointer, and `decisions-vol-19.md`'s remaining standing rulings.

**Two readers produced the source tables**, independently: Grok on `review/grok-rule-audit` and Claude on `review/rule-audit-draft`. They agreed on every hard rule (19 KEEP, HR5 merged) and differed on fourteen rulings, each of which the seat ruled in 116.

**On dates.** Rulings 60 to 104 are dated from `decisions-vol-18.md`, which carries a date on each entry. Rulings 1 to 59 are in `decisions-vol-14.md` through `decisions-vol-17.md` (vol 17 froze after 59); their volume is named below and their date is in it. Those dates were **not transcribed** rather than guessed, because a date invented here would read exactly like a measured one.

## Retired as standing law

Kept as history in the volume named. None is reversed.

| id | statement | volume | date | why it stopped being law |
| --- | --- | --- | --- | --- |
| R1 | Split webmentions: H1 schema and queue with no public render, H2 render, send later. | 14-17 | | The work shipped (45f526d, d33958d). A plan is not a rule once it is built. |
| R13 | The newsletter spending objection is gone; the product call stays Dustin's. | 14-17 | | Records that an objection was withdrawn. Nothing binds. |
| R21 | Admin mentions page: one queue, excerpt leads, feedback matches outcome. | 14-17 | | Superseded by the admin design pass, which R54 governs until it lands. |
| R24 | Repo reads the seat cannot do move into Capsid; Cloudflare tokens stay out. | 14-17 | | A working arrangement for the connector 404, not a property of the site. |
| R25 | Cutover waits until everything is built. | 14-17 | | A schedule, and the schedule moved. CUTOVER.md owns the sequence. |
| R28 | Sessions may not deploy, and may not run a second full tier. | 14-17 | | Reversed by R29 at the time. Retired so the reversal is not re-read as live. |
| R31 | The cockpit waits for the admin design spec. | 14-17 | | A dependency, now tracked as work rather than as law. |
| R35 | The state-of-the-art gap list is adopted as the worklist. | 14-17 | | A worklist. It is done or it is queued; neither is a rule. |
| R44 | The drill result does not enter the health snapshot yet. | 14-17 | | A deferral with no deadline and no consumer. |
| R55 | Webmention `readAuthor` is left as is; it never parses this site. | 14-17 | | A decision not to act, recorded once. The code carries its own why. |
| R61 | Nothing is removed from the dependency set, measured rather than argued. | 18 | 2026-09-11 | The measurement is the value and it is in the volume. Renovate owns the set now. |
| R62 | Triage the Grok pre-cutover audit into sessions A and B. | 18 | 2026-09-11 | A triage of one audit. A landed at a2c942d. |
| R76 | Design order: post, then header and home, then phage-discovery; 768 on every page. | 18 | 2026-09-12 | An order of work, and Part B is suspended. |
| R77 | The header stays the solid purple bar, fixed, Inter only. | 18 | 2026-09-12 | **Suspended by Dustin 2026-09-14** and the header restored byte-identical at fb6a988. A suspended ruling is not law. |
| R78 | Standard sentence: no flaw a senior product designer would find. | 18 | 2026-09-12 | A standard of taste, and it lives in the redesign brief. |
| R85 | The UI inventory carries a photo, an OG card and a code block. | 18 | 2026-09-12 | Shipped at 5689c72. The page is the record. |
| R86 | Gate 1 (composited contrast) folds gate 2 (3:1 control boundaries). | 18 | 2026-09-13 | A build instruction for a gate that now exists in check:browser. |
| R87 | Gate 3 a to c; skip 3d until a weight scale exists. | 18 | 2026-09-13 | Built. The skip survives as R88's note. |
| R88 | Skip the off-scale-literal gate until Part A's scales land. | 18 | 2026-09-13 | **The note survives in CLAUDE.md's absence deliberately:** it is a REVISIT, carried in vol 19's open items rather than as law. |
| R90 | Header fit as a check:browser case at five widths. | 18 | 2026-09-13 | Built and repaired (ba832ff). The gate is the rule now. |
| R93 | Where approved handoffs contradict, the later step wins; z-index excepted. | 18 | 2026-09-13 | A conflict rule for a handoff set that is now corrected at source. |
| R97 | Bar control gap `--s-2` below 64rem, load-bearing at 375. | 18 | 2026-09-13 | About the fixed bar, which was deleted 2026-09-14 with `--bar-h`. There is no bar to gap. |
| R98 | Below 64rem the search control is labelled with its input `display:none`. | 18 | 2026-09-13 | Withdrawn the same evening. The header's search control is an icon. |
| R113 | Slop audit: two readers, cut only on agreement. | 19 | 2026-09-16 | The method is now the standing practice for any comment change, recorded in 115. |
| R115 | The reasoning-in-file rule: short why, numbers in gates, history in Capsid, volume is not a floor. | 19 | 2026-09-16 | **The PROGRAM is retired now that wave 4 has merged.** Its sentence is law and moved into HR17. |

**R54 is NOT retired.** `docs/ADMIN-DESIGN.md` is the admin standard and stays until the admin design pass lands. It is the one ruling ruling 116 named as waiting.

## Merged

The surviving id keeps the text. The duplicate leaves the session preamble.

| id | statement | merged into | why that owner |
| --- | --- | --- | --- |
| R6 | Admin mention actions are scriptless forms; the smoke actor is refused. | HR9 | HR9 is the progressive-enhancement law and `check:features` is its instrument. |
| R66 | The public plane is agent-complete, not script-free. | HR9 | Same law, stated twice. |
| R89 | The public-plane script-dependency gate; `/login` is in scope. | HR9 | HR9 already carries the `/login` clause. |
| R7 | No cache invalidation on approve; a ten-minute lifetime. | R10 | R10 owns the cache arc. |
| R17 | Every shared-cacheable HTML response carries a Cache-Tag; purge at the write. | R10 | Same. |
| R18 | Acceptance is production measurement. | R10 | Same. |
| R14 | Native ActivityPub unscheduled; Bridgy Fed after cutover. | R50 | R50 owns the syndication plan. |
| R83 | The footer is tonal; no social row. | R50 | Design of the same surface. |
| R15 | `workers/app.ts` exports a gateway default and a Renderer; the key is path plus search plus theme. | R11 | R11 owns the entrypoint split. |
| R16 | What goes and what stays after the cache arc. | R11 | Same. |
| R22 | Open-on-Dustin items are decided by the seat where they are best practice. | R12 | R12 owns the decision split. |
| R33 | Renovate, not Dependabot; automerge off for a month. | R42 | R42 owns the dependency channel. |
| R36 | Renovate automerge on for patch, minor and security; the load-bearing six stay human. | R42 | Same. |
| R41 | One writer per mainline at a time. | R60 | R60 is the worktree ruling and states it. |
| R45 | One clone per actor. | R60 | R60 replaced it explicitly, naming where as well as how many. |
| R48 | Deploy readiness skips content-drift and asserts it after the sync. | R56 | R56 owns the deploy contract's deferrals. |
| R58 | fts-equality is deferred; the repair is the sync's FTS rebuild. | R56 | Same. |
| R52 | The deploy trusts CI: a green exact-HEAD sha and a clean tree skip the local tier. | HR16 | HR16 IS the deploy contract. |
| R69 | Glass is for small floating controls, never a reading surface. | R71 | R71 enumerates the controls. |
| R74 | Lamp tokens; semantic states are fills with icon and text. | R70 | R70 is Paper, Glass, Light and R74 amended it. |
| R67 | Motion is CSS-native with a reduced-motion path; nothing delays first paint. | redesign brief | Design law belongs where a design session reads it. |
| R68 | Editorial public plane; light theme leads; no second accent. | redesign brief | Same. |
| R72 | The solid non-Chromium version first; blur at most 12px, never animated. | redesign brief | Same. |
| R73 | Two component kits on one foundation; the home carries one live demonstration. | redesign brief | Same. |
| R82 | Public buttons are text with a rule; one filled primary per page. | redesign brief | Same. |
| R91 | The CARRIED map is a temporary exemption; build 4 must empty it. | R103 | R103 rekeyed the map to an owner and a date, because build 2 was reverted and a build number is not a deadline. |
| R92 | The page-payload ceiling raise is temporary on the same terms. | R103 | Same. |
| R100 | The header is restored to its pre-build-2 form, keeping the Menu overflow. | R77 | Both are suspended together, and R77 is the one Dustin suspended by name. |
| R108 | The canvas is a derived store; the repo wins. | HR18 | HR18 is the derived-store law and the canvas is one more derived store. |
| R112 | The repo link is live against main with a lag of minutes; ask twice. | R108 | A property of the link R108 governs. |
| HR5 | Popover elevation and pinned bars take `--border-strong`, never `--border`. | C:border | Pure taste, and `.design-sync/conventions.md` is where a design session reads it. **The hard rule number is retained** because three stylesheets cite it and `check:invariants` section 15 binds every cited number to a heading. |
| N:preview | A themed wrapper must set `color` as well as `background`. | C:surf | conventions.md already states it in full, for the same reader. |
| N:sheets | `SHEETS` was hand-maintained and went stale. | R111 | R111 made it an instrument (`check:design-sheets`). One line survives in NOTES.md naming the gate. |
| N:cascade | Cascade order is load-bearing and not alphabetical. | R111 | The gate checks cascade order, so the note is the gate's. |
| N:upload | `part-a/`, `part-b/`, `references/`, `uploads/` are never in a plan's deletes. | R110 | **One operative line stays in NOTES.md**, because that file is the only thing a sync agent reads and R110 itself orders the line to be there. The restatement went. |
| N:global | `globalName` is `DustinEdwards`; a rename edits conventions.md too. | C:vocab | The name is used in conventions.md, so the rule goes where the use is. |
| C:links | Links are `--brand` underlined, `--visited` when visited; do not restate per anchor. | R79 | **One line stays in conventions.md**, because it is the canvas's only channel and a Capsid ruling id is not readable from it. |

## Gate changes in the same ruling

| gate | change | note |
| --- | --- | --- |
| `check:slop` | To the **report** tier. | Not a CI blocker: the ci.yml step now carries `continue-on-error`, and the gate left `check:ci`. The comment there had claimed it was already out of `check:ci` and was wrong, so it had been running twice and blocking. All 83 in-scope findings were false positives when the audit opened them. |
| `check:volumes` | To the **report** tier. | A decisions volume is a Capsid document; its length is the seat's business, not a condition on deploying the site. |
| `check:mail` | To the **report** tier. | Returns to a tier at the cutover, recorded in CUTOVER.md beside the DNS step that makes mail a live path. |
| `check:diagrams` | **Kept.** | The plant ruling 116 asked for already exists inside it, as a negative unit test against `buildDiagramModel` (a diagram with no alt, and a blank alt). A corpus plant was written and proved nothing: the gate reads `content/generated/posts.json`, and `build:content` refuses to regenerate that artifact when an alt is missing, so the gate read the stale copy and passed. The rule is enforced, by the build, which runs first in the tier. |
| `check:media-axes` | **Kept, plant replayed.** | The spread in `listMedia` was replaced with a hand-copied key list, the plant proved applied on disk, and the gate went red naming the assertion and the axes lost. Reverted; green. |
| `check:image-weight` | **Kept, and NOT removed.** | Ruling 116 said to remove it if no plant can be written. No plant can be written, but the premise does not hold: the plant it asks for is "an image over the weight floor" and the gate has no weight floor, its own header stating that none of its assertions carries a number. Every assertion reads remote D1 plus the deployed origin, so a plant is a production change rather than an impossible one. Removing a working gate on a misdescription is the failure ruling 101 named. **For the seat to rule.** |

**Report tier is a third value, not a weaker one.** A report gate is run by name and by no tier, which is what "leaves CI" plus "leaves check:all" required; moving a gate to `network` would have left `check:all` still running it.
