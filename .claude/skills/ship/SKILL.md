---
name: ship
description: How to get work from a clean gate run onto the deployed site on dustinedwards.info. Use whenever a change is ready to land: running the gate tiers, opening the pull request, waiting for CI on the exact sha, the deploy that follows the merge, and writing the report. Covers running the long steps detached on this host and what the ship report must contain.
---

# Shipping dustinedwards.info

The deploy CONTRACT is hard rule 16 in `CLAUDE.md`, and it is not restated
here: what ship refuses and why lives there. This is the PROCEDURE around it.
Every change lands by pull request (portfolio rule 5.4); nothing is pushed to main.

## The order

1. On a branch: `npm run check:changed`, the gates covering what the branch touched,
   then `npm run lint` (a separate CI step no gate tier runs). Reach for a local
   `check:all` only when the change touches a network gate's subject (ruling 129).
2. Scoped commits, one concern each, named paths only. Push the branch.
3. Open the PR. If it changes anything a visitor would see (copy, layout, a page, a
   color, a menu), label it `visual` (`gh pr edit <n> --add-label visual`) and stop:
   it waits for Dustin's yes on the Worker Preview link or on shots. Say so in the PR.
4. Otherwise, stop there: a session never merges. Capsid's signed auto-merge
   policy merges the PR once CI is green on its exact head and the policy's checks
   pass, or the seat merges it (capsid/decisions.md, 2026-10-04).
5. The merge deploys itself: after CI passes on main, `.github/workflows/deploy.yml`
   runs `npm run ship` on that exact sha. Watch that run (`gh run list --workflow
   deploy.yml`) and write the report below from its log. If Dustin has set the
   `AUTO_DEPLOY` variable to `off`, dispatch it by hand:
   `gh workflow run deploy.yml --ref main -f ref=<main tip sha>`.
6. Run `npm run verify-live` against the deploy.

## Shipping by hand (Dustin)

When Dustin ships from this machine instead of the workflow: `git checkout main`,
`git pull --ff-only` (ship deploys local HEAD, so a merge you do not have is a deploy
nobody asked for), confirm CI concluded SUCCESS for that exact sha (ship refuses
otherwise, with no override), then `npm run ship` and write the report below.

## Running the long steps detached on this host

`check:all` takes about fifteen minutes and `ship` about ten. When you do run
one, run it in the background writing to a log, and watch the LOG rather than
the task:

- `npm run check:all > /tmp/checkall.log 2>&1` with `run_in_background: true`.
- Watch it with a Monitor on `tail -f` filtered to `FAILED|EXIT=|passed, .* failed`.

Two hazards, both measured:

- **A background task that goes silent long enough gets killed.** A gate that
  prints nothing for minutes can be reaped mid-run.
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
