---
name: ship
description: How to get work from a clean gate run onto the deployed site on dustinedwards.info. Use whenever a change is ready to land: running the gate tiers, making scoped commits, pushing, waiting for CI on the exact sha, running npm run ship, and writing the report. Covers running the long steps detached on this host and what the ship report must contain.
---

# Shipping dustinedwards.info

The deploy CONTRACT is hard rule 16 in `CLAUDE.md`, and it is not restated
here: what ship refuses and why lives there. This is the PROCEDURE around it.

## The order

1. `git pull --ff-only`. Ship deploys local HEAD, so a seat-side merge you do
   not have is a deploy nobody asked for.
2. `npm run check:changed`, the gates covering what the branch touched. Ship
   runs the offline tier again itself and CI runs the full suite, so a local
   `check:all` is a third derivation of the same answer: reach for it when the
   change touches a network gate's subject, not by habit (ruling 129).
3. `npm run lint`. It is a separate CI step and no gate tier runs it.
4. Scoped commits, one concern each, named paths only.
5. `git push origin main`.
6. Wait for CI to conclude SUCCESS for the exact pushed sha. Ship refuses
   otherwise and there is no override.
7. `npm run ship`.
8. Write the report below.

## Running the long steps detached on this host

`check:all` takes about fifteen minutes and `ship` about ten. When you do run
one, run it in the background writing to a log, and watch the LOG rather than
the task:

- `npm run check:all > /tmp/checkall.log 2>&1` with `run_in_background: true`.
- Watch it with a Monitor on `tail -f` filtered to `FAILED|EXIT=|passed, .* failed`.

Two hazards, both measured:

- **A background task that goes silent long enough gets killed.** `check:head`
  runs for over three minutes printing nothing, and a run was reaped there.
  A killed task is not a failed gate; re-run and read the log.
- **A trailing `echo` after a pipe masks the exit code.** Write the exit code
  into the log itself, or read the log; never trust the notification's status.

`ship` needs `OPERATOR_TOKEN_FILE`, which `.claude/settings.json` sets for the
project. If it is absent ship refuses before the build, by design.

## What the report must contain

Every one of these, and no substitutes:

- The deployed **sha** and the **version id** from the deploy step.
- The **gate count**, as the tier printed it (`N passed, M failed`).
- The **drift table** line from `sync:content`, verbatim.
- Both **index counts**: Ask converged, media converged.
- **Anything that did not behave as expected**, including a gate that needed a
  re-run, a flake, a step that reported a MISS while the deploy stood, or a
  claim you could not verify. A ship report with nothing under this heading
  should be rare; silence here reads as "nothing went wrong", so it must only
  ever mean that.
