# Commit 3, the code pass: reviewed, and almost nothing is real

83 in-scope ai-slop findings outside `scratchpad/`. Every one I opened is a
false positive on this codebase, and two of the tool's own repairs are
defects. No code changed. The evidence is below so the next session does not
re-derive it, and so commit 5's thresholds are set against what is true.

## `aislop fix --safe` is NOT safe here, and was reverted

Run and reverted rather than committed. Two classes of damage:

**It edits code inside string literals.** `scripts/check-charts.mjs` builds a
worker module as a template string. The fix deleted

    import rehypeStringify from "rehype-stringify";
    import { unified } from "unified";

from inside that string, reading them as duplicate imports of the host file.
They are the generated worker's own imports. `check:charts` passes today and
would not have.

**It deletes load-bearing comments**, eight of them, under the same
decorative-separator heuristic that my own `reset.css` rule got wrong:

- `app/lib/media/rebuild.server.ts` lost "Deliberately last, and deliberately
  computed from the SAME enumerations that were just written from ... a
  transient read failure cannot cause a deletion." That guards a DELETE path.
- `app/lib/editor/draft-buffer.ts` lost the module doc explaining that the
  buffer key carries the BASE COMMIT, and that a buffer from a different base
  is never offered because restoring it "would silently revert someone else's
  change".
- `app/routes/admin.posts._index.tsx` lost "Retag ADDS or REMOVES one tag. It
  never replaces the set, so a post's other tags are untouched and a mistake
  costs one tag rather than all."
- Also: the media picker's architecture note, the markdown editor's guard
  rationale, a search API doc, a sign-in one-owner note, and an `ask-budget`
  method doc.

Each states a prohibition or a why. The audit's own definition keeps all of
them.

## console-leftover, 17, all legitimate

Six are in Workers, where `console.log` IS the logging API that Workers
Observability reads. `workers/watchdog.ts` emits
`console.log(JSON.stringify({ watchdog: "repaired", ... }))`, which is the
watchdog's audit trail. `workers/media-events.ts` carries a comment saying
the log exists because without it "A004 stayed invisible". Deleting these
re-creates a recorded defect.

The other eleven are `.design-sync/measure-chip.mjs`, a local measurement
CLI whose console output is its entire product.

## todo-stub, 12, none of them stubs

The rule matches the words TODO and PLACEHOLDER in prose. Four read:

- `app/data/phage-hunters.ts:21` is a comment RECORDING that a TODO was
  removed by Dustin's ruling, so the rule fires on a note about its own
  absence.
- `check-invariants.mjs:438`, `publish.server.ts:141` and
  `scripts/lib/content.mjs:62` all match "THE PLACEHOLDER", prose about image
  placeholders.

## swallowed-exception, 2, neither swallowed

`app/routes/admin.tsx:361` is `catch(e){}` inside the `NO_FLASH` inline
script, which is a STRING. Same class as the check-charts defect. The catch
is also correct: localStorage unavailable means no stored preference.

`scripts/ship.mjs:934` logs and continues, but `status` stays 0, `streak`
resets, and the run refuses at `streak !== POLL_COUNT`. It fails closed; the
rule cannot see the control flow.

## hidden-fallback, 3, each already argued in place

`app/db/index.ts:308` carries "A COUNT(*) with no GROUP BY always returns
exactly one row, so the zero is unreachable." `contents-cap.mjs:31` defaults
a missing size to 0 in a pure message-builder.

`app/lib/blog-view.ts:52` is the one with a case to answer: `parseJson`
returns a fallback on malformed stored JSON, which hard rule 13 calls
substituting a different value. The repo's remedy is a
`JUSTIFIED SUBSTITUTION` marker, and adding one HERE needs a ruling rather
than a repair: rule 13 says the class is resolved at exactly two instances,
`REMOTE_ARGS ?? []` and the rate-limit client IP, and `check:invariants`
section 15b counts them. A third marker is a decision, not a cleanup.

## What this means for commit 5

Setting `todo-stub`, `console-leftover`, `narrative-comment` and
`meta-comment` to error would make CI permanently red on prose and on the
Workers logging API. The gate still earns its place as a ratchet on NEW code;
it cannot be pointed at this repo's existing conventions.
