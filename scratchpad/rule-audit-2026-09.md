# Rule audit, second reader, 2026-09-19

Claude's independent reading, against Grok's `scratchpad/grok-rule-audit-2026-09.md`
(branch `review/grok-rule-audit`, commits 7965040 and 521937d). Report only: no PR,
no Capsid write, no merge, no comment wave, no `aislop fix`.

Ids are Grok's so the two tables diff: `R1`-`R115` Capsid, `HR1`-`HR20` CLAUDE.md,
`G:*` gates, `N:*` NOTES.md, `C:*` conventions.md.

Dustin's standard governs: a rule that does not make the website better is changed
or deleted. Two weeks of sessions produced one page.

## 1. The ten, and where I differ from Grok

**HR1, HR3, HR4, HR6, HR8, HR16, HR18, HR19, G:invariants, G:browser.** Drafts must
not be nameable by a public URL; secrets stay inside the server boundary; the public
plane ships no framework script; URL protocols are allowlisted at schema and render;
silence is cached so the Worker stamps refusal unless a route opts in; ship is the
only deploy and refuses a sha CI has not passed; derived stores are repaired through
derivation; money paths refuse a present foreign Origin and spend in a named order;
`check:invariants` is the instrument that binds the first of those to the schema and
the helper classes; and `check:browser` is the only instrument in the set that has
caught defects a visitor could see, twelve of them between 09-09 and 09-19.

**Differences from Grok's ten (HR1, HR3, HR8, HR16, HR19, HR4, HR9, HR18,
G:invariants, R34).** I drop **HR9** and **R34** and add **HR6** and **G:browser**.
HR9's public-plane law is HR4's subject and its operative remainder is the `/login`
door, which protects one operator rather than a reader, so it is a KEEP outside the
ten. R34 is a real live-origin defect and stays a KEEP, but it is one instance of
"never trust declared metadata", and the broader public-facing injection class with
its own proven catch is HR6 (the `javascript:` cover, 2026-08-07). Ten slots should
hold classes, not instances. G:browser is the harder disagreement: Grok's own report
calls the nightly browser check "the only visitor-visible catch stream" and then
leaves it out of the ten, which I read as an internal tension in that report. By
Dustin's standard the instrument that catches what a reader sees outranks four of
the gates Grok keeps. **HR10 is my strongest near-miss**; see section 3.

## 2. Where this reading adds evidence rather than opinion

I did not redo Grok's Capsid extraction or its 30-day CI log pass, as the job
instructs. I re-measured what is cheap, and I have first-hand evidence from executing
`job_210a4dd8b269` (ruling 115 wave 3) on this host today.

**Grok's measurements reproduce exactly.** 43 gates (`check:*` in package.json minus
`check`, `check:all`, `check:ci`; the raw `check:*` count is 45). CLAUDE.md 24,453
bytes, NOTES.md 10,616, conventions.md 3,998. I found nothing to refute.

**One accounting nit, not a defect.** `check-all.mjs` prints "CI tier: 31 of 35
offline gate(s)" and then names five `CI_EXCLUDED` entries. The arithmetic is right
and the list is misleading: `check:browser` is tiered `network`, so it was never in
the offline 35 and its `CI_EXCLUDED` entry does not reduce the count. Four entries do.
Line 385 prints `Object.keys(CI_EXCLUDED)` rather than the ones that applied.

**Wave 3 is the R115 program's own cost, measured.** 88 files, 1017 comment blocks
decided, 495,697 comment bytes to 292,442, 568 blocks extracted verbatim to a 518,706
byte history document. It consumed this session end to end and changed no public page.
**The number that should decide R115 is not the cost but the harm rate:** Grok's own
review of wave 3 found **13 places where the cut removed load-bearing meaning**, each
restored at c5308ef (why 60 and 155 approximate pixel widths; that a false purge
`success` is the Free-tier limit; why `tabindex` is -1 and not 0; that an in-Worker
watcher dies with the thing it watches). A program whose review step finds thirteen
regressions in one wave is manufacturing both work and risk. Wave 1 produced six
restorations on the same pattern.

**G:slop cost a session today and caught one latent defect.** CI run **35450703502**
(sha b9993ca) failed with `Slop` as its only failing step: 10 errors, every one
`changeContext: existing-file-context`, meaning not one sat on a line the diff
touched. Three were `hallucinated-import` on `cloudflare:workers`, which is a Workers
runtime built-in and not a package, so they are a tool false positive. Repairing the
seven type assertions (8bad914) did surface **one real latent defect**: `readAuthor`
in `app/lib/webmention/verify.server.ts` declared a DOM `Document` while every caller
passes linkedom's, which is what forced the double assertion. Nothing had broken, and
a refactor against the declared type would have. So G:slop's 30-day record moves from
"0 real" to **0 visitor-visible, 1 latent type defect, 3 own-bugs**.

**HR10 earned its place three times in one session.** The blocked job's summary
carried "10 errors"; re-measuring found 11, and the eleventh was an assertion `main`
had already deleted. The task prompt asserted "comments do not survive the build, so
the bundle must be byte-identical"; measuring found 37,615 of this branch's 88,201
bundle bytes are comments, and the whole 18,457-byte difference was comment bytes.
My own first verification script reported two restorations missing and four
ambiguous, which was my needles, not the code: one comment had wrapped across lines
and one came back in capitals. Three carried claims, three wrong.

**A third class of gate-own red, not in Grok's table.** Grok classes the 30-day
`check:contrast` and `check:headers` reds as floor arithmetic. Today `check:contrast`
went red for a different reason: the merge brought in a stylesheet newer than
`build/`, and the gate refused a build it could see was stale. Correct behaviour,
zero product signal. Stale-build reds belong beside floor reds in the "not a real
red" column.

## 3. HR10, and why I would promote it

Grok keeps HR10 and leaves it out of the ten as PROCESS. I would put it eleventh and
argue for tenth over HR18. Every other rule in the ten is enforced by an instrument,
and HR10 is the only rule that says an instrument can be green and vacuous. Its
disciplines are what make the other nine believable: prove scope non-empty, anchor
the needle, measure floors through the gate's own pipeline, re-measure carried
claims. The 30-day log supports this indirectly. Four of Grok's real-red clusters are
floor remeasures, which exist only because HR10 made counting gates declare a floor.

I leave it out of my ten only because the ten should be rules a visitor's experience
depends on, and HR10's dependent is the gate set. If the seat reads the ten as "the
ten that keep the project honest" rather than "the ten that keep the site correct",
HR10 displaces HR18.

## 4. The thesis that separates this reading from Grok's

**Grok's cuts fall mostly on cheap gates and spare the expensive process.** Its
RETIRE list includes `G:diagrams` (0.8 s), `G:media-axes` (0.2 s), `G:image-weight`,
`G:volumes`, `G:mail`. Grok's own measurements say the whole Gates step is about 120 s
in CI and that a session pays nothing for it, while the session preamble is 64,215
bytes plus a 141 KB brief, and the recut program costs whole sessions.

Retiring fifteen gates buys back a few seconds of CI. Retiring the recut program and
cutting the preamble buys back sessions. I therefore **retire fewer gates and cut
harder on process**, and for cheap gates with no catch and no plant I recommend KEEP
with the plant written, because HR12 already says a gate is tested by replaying the
defect it was written for. An unproven gate is an evidence problem, not a cost
problem, and 0.2 s is not what is hurting this project.

**One live consequence the seat should settle before it is overtaken.**
`job_cd443bdd04e6`, ruling 115 wave 4, 67 `.tsx` files, is QUEUED right now at
priority 90. Both readers recommend retiring the program that job implements. If the
seat agrees, that job should be cancelled before it is claimed, not after.

## 5. Disagreements with Grok

Only rows where my recommendation or class differs.

| id | Grok | Claude | why |
|---|---|---|---|
| HR6 | KEEP | KEEP, **in the ten** | The `javascript:` cover is a proven public-page injection catch. The ten should hold the class; R34 is one instance of it. |
| HR9 | KEEP, in the ten | KEEP, **not in the ten** | Its public-plane law is HR4's subject; the remainder is the `/login` door, which protects one operator, not a reader. |
| HR10 | KEEP | KEEP, **eleventh, tenth on another reading** | Three carried claims refuted in one session today. It is the only rule that says a green gate can be vacuous. |
| R34 | KEEP, in the ten | KEEP, **not in the ten** | A real live-origin defect, already gated. One instance of "never trust declared metadata"; HR6 is the class. |
| G:browser | KEEP | KEEP, **in the ten** | Grok's own text calls it the only visitor-visible catch stream: 12 real reds in 10 days. That outranks four gates Grok keeps. |
| G:diagrams | RETIRE | KEEP, plant unwritten | Missing diagram alt text is visitor harm to screen-reader readers. 0.8 s is not the cost that hurts. HR12 says write the plant. |
| G:media-axes | RETIRE | KEEP, plant unwritten | Same: 0.2 s, real harm class, never proven. Prove it or retire it on evidence, not on a zero. |
| G:image-weight | RETIRE | KEEP, plant unwritten | Replay of pre-fix bytes is a plant in all but name. Cost is network on a schedule, not session time. |
| G:contrast | KEEP, reds are floor arithmetic | KEEP, **two gate-own red classes** | Today's red was a stale build, not a floor. Both belong in the not-a-real-red column. |
| G:slop | RETIRE from CI blocking | **RETIRE from CI blocking**, agreed, with a correction | Record is 0 visitor-visible but **1 latent type defect** (readAuthor's parameter), not 0 real. Its false positives cannot be fixed in config: the schema has no known-module key. |
| R54 | RETIRE | KEEP until the admin pass lands | `core.md` names an admin design pass as NEXT, and R109 exists because `guidelinesGlob` suppressed ADMIN-DESIGN for the whole redesign. Retiring the standard the moment before its pass is the wrong order. |
| R112 | RETIRE | MERGE INTO R108 | It has a proven catch (TRACKGRID-SENTINEL-7Q42, fec78c9). A rule with a catch should merge into its class, not vanish. |
| R113 | RETIRE | KEEP while any comment wave lives | Two readers is what found the 13 wave-3 restorations. Its fate is coupled to R115's: retire the program and R113 goes with it, keep wave 4 and R113 is the only control on it. |
| R115 | MERGE INTO HR17 | **RETIRE the program**, MERGE the sentence INTO HR17 | Agreed on the sentence. Strengthened: the program's own review found 13 losses of load-bearing meaning in 88 files, after 6 in wave 1. That is the argument, not the byte count. |

## 6. CI clusters

I did not repeat the 30-day pass, and I can refute none of Grok's numbers. One new
sample, from today, which extends rather than corrects the table:

| run id | sha | result | class |
|---|---|---|---|
| 35450703502 | b9993ca | failure, `Slop` the only failing step | **not a real red.** 10 errors, all `existing-file-context`; 3 a false positive on the `cloudflare:workers` built-in. Fired because 88 files entered the diff at once. |
| (superseded) | fc6dbda | cancelled | concurrency cancel on push, matching Grok's 8 cancelled runs |
| (tip) | f15c89a | success | after the assertions were repaired and 3 scoped overrides added |

Grok's `check:slop` row reads "0 real; 2 own-bugs". With today's run it is **3
own-bug or false-positive reds and 0 visitor-visible catches**, with the single
latent type defect noted in section 2 found by following a finding rather than by
the gate refusing a defect. I would keep Grok's RETIRE-from-blocking either way: a
gate that blocks a correct diff for a session, whose false positives its own config
cannot express an exception for, is a report and not a blocker.

## 7. Full table

Class and recommendation are mine. "=" means I concur with Grok's row after reading
the evidence; rows carrying a note are in section 5.

### Capsid rulings

| id | class | rec | note |
|---|---|---|---|
| R1 | PROCESS | RETIRE | = |
| R2 | BREAKAGE | KEEP | = |
| R3 | BREAKAGE | KEEP | = |
| R4 | BREAKAGE | KEEP | = |
| R5 | BREAKAGE | KEEP | = |
| R6 | BREAKAGE | MERGE INTO HR9 | = |
| R7 | DRIFT | MERGE INTO R10 | = |
| R8 | BREAKAGE | KEEP | = |
| R9 | DRIFT | KEEP | = |
| R10 | DRIFT | KEEP | = |
| R11 | DRIFT | KEEP | = |
| R12 | TASTE | KEEP | = |
| R13 | TASTE | RETIRE | = |
| R14 | TASTE | MERGE INTO R50 | = |
| R15 | DRIFT | MERGE INTO R11 | = |
| R16 | DRIFT | MERGE INTO R11 | = |
| R17 | DRIFT | MERGE INTO R10 | = |
| R18 | DRIFT | MERGE INTO R10 | = |
| R19 | BREAKAGE | KEEP | = |
| R20 | PROCESS | KEEP | = |
| R21 | TASTE | RETIRE | = |
| R22 | PROCESS | MERGE INTO R12 | = |
| R23 | DRIFT | KEEP | = |
| R24 | PROCESS | RETIRE | = |
| R25 | PROCESS | RETIRE | = |
| R26 | DRIFT | KEEP | = |
| R27 | TASTE | KEEP | = |
| R28 | PROCESS | RETIRE | = |
| R29 | PROCESS | KEEP | = |
| R30 | DRIFT | KEEP | = |
| R31 | PROCESS | RETIRE | = |
| R32 | DRIFT | KEEP | = |
| R33 | PROCESS | MERGE INTO R42 | = |
| R34 | BREAKAGE | KEEP | not in my ten, section 5 |
| R35 | PROCESS | RETIRE | = |
| R36 | PROCESS | MERGE INTO R42 | = |
| R37 | BREAKAGE | KEEP | = |
| R38 | PROCESS | KEEP | = |
| R39 | DRIFT | KEEP | = |
| R40 | BREAKAGE | KEEP | Grok lists R40's class as least-sure; traces-off is BREAKAGE because the alternative puts `/preview/<token>` in a third party |
| R41 | PROCESS | MERGE INTO R60 | = |
| R42 | PROCESS | KEEP | = |
| R43 | DRIFT | KEEP | = |
| R44 | PROCESS | RETIRE | = |
| R45 | PROCESS | MERGE INTO R60 | = |
| R46 | TASTE | KEEP | = |
| R47 | TASTE | KEEP | = |
| R48 | PROCESS | MERGE INTO R56 | = |
| R49 | PROCESS | KEEP | = |
| R50 | TASTE | KEEP | = |
| R51 | PROCESS | KEEP | = |
| R52 | PROCESS | MERGE INTO HR16 | = |
| R53 | DRIFT | KEEP | = |
| R54 | TASTE | KEEP until the admin pass | section 5 |
| R55 | PROCESS | RETIRE | = |
| R56 | PROCESS | KEEP | = |
| R57 | BREAKAGE | KEEP | = |
| R58 | PROCESS | MERGE INTO R56 | = |
| R59 | BREAKAGE | KEEP | Grok flags open-or-retired as least-sure; still open, so KEEP |
| R60 | PROCESS | KEEP | = |
| R61 | PROCESS | RETIRE | = |
| R62 | PROCESS | RETIRE | = |
| R63 | TASTE | KEEP | = |
| R64 | DRIFT | KEEP | = |
| R65 | TASTE | KEEP | = |
| R66 | TASTE | MERGE INTO HR9 | = |
| R67 | TASTE | MERGE INTO brief | = |
| R68 | TASTE | MERGE INTO brief | = |
| R69 | TASTE | MERGE INTO R71 | = |
| R70 | TASTE | KEEP | = |
| R71 | TASTE | KEEP | = |
| R72 | TASTE | MERGE INTO brief | = |
| R73 | TASTE | MERGE INTO brief | = |
| R74 | TASTE | MERGE INTO R70 | = |
| R75 | TASTE | KEEP | = |
| R76 | PROCESS | RETIRE | = |
| R77 | TASTE | RETIRE | = |
| R78 | TASTE | RETIRE | = |
| R79 | TASTE | KEEP | = |
| R80 | TASTE | KEEP | = |
| R81 | TASTE | KEEP | = |
| R82 | TASTE | MERGE INTO brief | = |
| R83 | TASTE | MERGE INTO R50 | = |
| R84 | DRIFT | KEEP | = |
| R85 | TASTE | RETIRE | = |
| R86 | DRIFT | RETIRE | = |
| R87 | DRIFT | RETIRE | = |
| R88 | DRIFT | RETIRE | = |
| R89 | BREAKAGE | MERGE INTO HR9 | = |
| R90 | DRIFT | RETIRE | = |
| R91 | DRIFT | MERGE INTO R103 | = |
| R92 | DRIFT | MERGE INTO R103 | = |
| R93 | PROCESS | RETIRE | = |
| R94 | DRIFT | KEEP | = |
| R95 | TASTE | KEEP | = |
| R96 | TASTE | KEEP | = |
| R97 | TASTE | RETIRE | = |
| R98 | TASTE | RETIRE | = |
| R99 | DRIFT | KEEP | = |
| R100 | BREAKAGE | MERGE INTO R77 | = |
| R101 | DRIFT | KEEP | = |
| R102 | PROCESS | KEEP | = |
| R103 | DRIFT | KEEP | = |
| R104 | DRIFT | KEEP | = |
| R105 | DRIFT | KEEP | = |
| R106 | PROCESS | KEEP | = |
| R107 | PROCESS | KEEP | = |
| R108 | DRIFT | MERGE INTO HR18 | = |
| R109 | DRIFT | KEEP | = |
| R110 | DRIFT | KEEP | = |
| R111 | DRIFT | KEEP | = |
| R112 | DRIFT | MERGE INTO R108 | section 5 |
| R113 | PROCESS | KEEP while a wave lives | section 5 |
| R114 | PROCESS | KEEP | strengthened: aislop's narrative-comment rule targets exactly the comments HR17 requires |
| R115 | PROCESS | RETIRE the program, MERGE the sentence INTO HR17 | section 5 |

### Hard rules

| id | class | rec | note |
|---|---|---|---|
| HR1 | BREAKAGE | KEEP, in the ten | = |
| HR2 | BREAKAGE | KEEP | = |
| HR3 | BREAKAGE | KEEP, in the ten | = |
| HR4 | BREAKAGE | KEEP, in the ten | = |
| HR5 | TASTE | MERGE INTO C:border | = |
| HR6 | BREAKAGE | KEEP, **in the ten** | section 5 |
| HR7 | PROCESS | KEEP | strengthened: today's bundle premise was false at source level and true only on the live path |
| HR8 | BREAKAGE | KEEP, in the ten | = |
| HR9 | BREAKAGE | KEEP, **not in the ten** | section 5 |
| HR10 | PROCESS | KEEP, **eleventh** | sections 3 and 5 |
| HR11 | DRIFT | KEEP | = |
| HR12 | PROCESS | KEEP | the basis for my KEEP-with-plant recommendations |
| HR13 | BREAKAGE | KEEP | = |
| HR14 | DRIFT | KEEP | = |
| HR15 | PROCESS | KEEP | = |
| HR16 | BREAKAGE | KEEP, in the ten | its upstream hook caught the main checkout 6 commits behind today |
| HR17 | PROCESS | KEEP | receives R115's sentence |
| HR18 | BREAKAGE | KEEP, in the ten | tenth slot yields to HR10 on the honesty reading |
| HR19 | BREAKAGE | KEEP, in the ten | = |
| HR20 | BREAKAGE | KEEP | = |

### Gates

| id | class | rec | note |
|---|---|---|---|
| G:types | BREAKAGE | KEEP | = |
| G:content | DRIFT | KEEP | = |
| G:publications | DRIFT | KEEP | = |
| G:config | DRIFT | KEEP | = |
| G:search | DRIFT | KEEP | = |
| G:policy | BREAKAGE | KEEP | = |
| G:contrast | DRIFT | KEEP | two gate-own red classes, section 5 |
| G:fonts | DRIFT | KEEP | = |
| G:design-sheets | DRIFT | KEEP | = |
| G:slop | PROCESS | RETIRE from CI blocking | corrected record, sections 2 and 6 |
| G:guidelines | DRIFT | KEEP | = |
| G:logo | BREAKAGE | KEEP | = |
| G:charts | DRIFT | KEEP | = |
| G:diagrams | DRIFT | KEEP, plant unwritten | section 5 |
| G:admin-ui | DRIFT | KEEP | = |
| G:urls | BREAKAGE | KEEP | instrument for HR6 |
| G:volumes | DRIFT | RETIRE | = |
| G:media-axes | DRIFT | KEEP, plant unwritten | section 5 |
| G:page-payload | BREAKAGE | KEEP | 150 checks, 0 failures on wave 3 today |
| G:destructive | BREAKAGE | KEEP | = |
| G:hook-matchers | BREAKAGE | KEEP | = |
| G:hook-scope | BREAKAGE | KEEP | = |
| G:hook-syntax | DRIFT | KEEP | = |
| G:floors | DRIFT | KEEP | = |
| G:stack | DRIFT | KEEP | = |
| G:features | DRIFT | KEEP | = |
| G:headers | BREAKAGE | KEEP | = |
| G:secrets | BREAKAGE | KEEP | = |
| G:migrations | DRIFT | KEEP | = |
| G:tests | BREAKAGE | KEEP | 787 tests green on wave 3 today |
| G:worker | BREAKAGE | KEEP | = |
| G:invariants | BREAKAGE | KEEP, in the ten | = |
| G:llms | DRIFT | KEEP | = |
| G:backup | DRIFT | KEEP | = |
| G:browser | BREAKAGE | KEEP, **in the ten** | section 5 |
| G:media | DRIFT | KEEP | = |
| G:image-weight | DRIFT | KEEP, plant unwritten | section 5 |
| G:uptime | DRIFT | KEEP | = |
| G:mail | DRIFT | RETIRE until cutover | a knowingly red gate trains readers to ignore reds |
| G:restore | DRIFT | KEEP | = |
| G:head | DRIFT | KEEP | = |
| G:microformats | DRIFT | KEEP | = |
| G:d1-address | BREAKAGE | KEEP | = |

### NOTES.md and conventions.md

| id | class | rec | note |
|---|---|---|---|
| N:scope | PROCESS | KEEP | = |
| N:build | DRIFT | KEEP | = |
| N:tsconfig | DRIFT | KEEP | = |
| N:fontface | BREAKAGE | KEEP | = |
| N:import | DRIFT | KEEP | = |
| N:contrast | DRIFT | KEEP | = |
| N:chrome | BREAKAGE | KEEP | = |
| N:warns | PROCESS | KEEP | = |
| N:preview | BREAKAGE | MERGE INTO C:surf | = |
| N:pw | PROCESS | KEEP | = |
| N:sheets | DRIFT | MERGE INTO R111 | = |
| N:cascade | DRIFT | MERGE INTO R111 | = |
| N:upload | DRIFT | MERGE INTO R110 | = |
| N:global | DRIFT | MERGE INTO C:vocab | = |
| C:theme | TASTE | KEEP | = |
| C:surf | BREAKAGE | KEEP | = |
| C:router | BREAKAGE | KEEP | = |
| C:idiom | TASTE | KEEP | = |
| C:tokens | DRIFT | KEEP | = |
| C:border | TASTE | KEEP | receives HR5 |
| C:page | TASTE | KEEP | = |
| C:li | BREAKAGE | KEEP | = |
| C:links | TASTE | MERGE INTO R79 | = |
| C:truth | PROCESS | KEEP | = |

## 8. What I would cut first

Grok's list, reordered by what it actually buys back, with one addition and two
removals.

1. **The R115 recut program.** Keep the sentence in HR17. Wave 4 is queued now.
   Thirteen losses of load-bearing meaning in wave 3, six in wave 1, and no public
   page changed in either.
2. **The session preamble beyond CLAUDE.md.** 64,215 bytes plus a 141 KB brief, paid
   by every session on every cold start. `core.md` is stale since 2026-09-05 and is
   the first thing read. This is the largest recurring cost in the audit and the
   only one paid per session rather than per run.
3. **R66-R90 as standing law.** Keep R70, R71, R75, R79, R99; the rest belong in the
   redesign brief a design session reads when doing design.
4. **G:slop as a CI blocker.** Keep it as a report.
5. **Local `check:ci` as a ritual on this host.** 837 s here against 177-217 s in CI,
   and HR16 already says ship trusts CI for the exact sha.
6. **G:volumes and G:mail.** A Capsid freeze-point check does not change a page, and
   a knowingly red gate teaches people to ignore red.

Not on my list, against Grok: `G:diagrams`, `G:media-axes`, `G:image-weight`. They
are sub-second, they guard real harm classes, and they have never been proven. HR12
says the answer to an unproven gate is a plant, not a deletion.

## 9. Sources

- Grok's audit: `review/grok-rule-audit`, `scratchpad/grok-rule-audit-2026-09.md`,
  commits 7965040, 521937d.
- Re-measured on this host at 5689c72: gate count 43, CLAUDE.md 24,453,
  NOTES.md 10,616, conventions.md 3,998, `TIERS`/`CI_EXCLUDED` in
  `scripts/check-all.mjs`.
- First-hand, `job_210a4dd8b269` today: CI runs 35450703502 (b9993ca, failure),
  f15c89a (success); commits c5308ef (13 restorations), 8bad914 (assertions),
  fc6dbda (3 scoped overrides); PR #45.
- Sessions read Capsid and never write it. Nothing here was written to Capsid.
