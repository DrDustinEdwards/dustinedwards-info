---
name: ship
description: How to get work from a clean gate run onto the deployed site on dustinedwards.info. Use whenever a change is ready to land: running the gate tiers, opening the pull request, waiting for CI on the exact sha, the deploy that follows the merge, and writing the report. Covers running the long steps detached on this host and what the ship report must contain.
---

# Shipping dustinedwards.info

The deploy CONTRACT is `.github/workflows/deploy.yml`, devkit's worker-deploy
with this site's pre-deploy guard, live gate (`devkit-verify-deploy`) and
converge job (`scripts/converge.mjs`); what each refuses and why lives there, and
`.claude/hooks/no-direct-deploy.sh` refuses every local way to deploy. This is the
PROCEDURE around it.
Every change lands by pull request; nothing is pushed to main.

## The order

1. On a branch: `npm run check:changed`, the gates covering what the branch touched,
   then `npm run lint` (a separate CI step no gate tier runs). Reach for a local
   `check:all` only when the change touches a network gate's subject.
2. Scoped commits. Push the branch.
3. Open the PR. Its body names the Capsid job it does (`Job: job_<12 hex>`), and that
   job's `complete` (or `block`) names the PR. If no job was posted, post one in the
   `dustinedwards` namespace first. That is how Capsid's merge tick and Dustin's
   Portal see the PR. If it changes anything a visitor would see (copy, layout, a page, a
   color, a menu), label it `visual` (`gh pr edit <n> --add-label visual`) and stop:
   it waits for Dustin's yes on the Worker Preview link or on shots. Say so in the PR.
4. Otherwise, merge it once CI is green on its exact head. Capsid's signed auto-merge or the seat may merge it first.
5. The merge deploys itself: after CI passes on main, `.github/workflows/deploy.yml`
   deploys that exact sha (jobs `site / deploy`, `site / live gate`, `Converge`, then
   the admin MCP's `mcp / deploy` and `mcp / live gate`). Watch that run (`gh run list
   --workflow deploy.yml`) and write the report below from its log. If Dustin has set
   the `AUTO_DEPLOY` variable to `off`, dispatch it by hand:
   `gh workflow run deploy.yml --ref main`.
6. Run `npm run verify-live` against the deploy.

## Running the long steps detached on this host

`check:all` takes about fifteen minutes. When you do run it, run it in the background writing to a log, and watch the LOG rather than
the task:

- `npm run check:all > /tmp/checkall.log 2>&1` with `run_in_background: true`.
- Watch it with a Monitor on `tail -f` filtered to `FAILED|EXIT=|passed, .* failed`.

Two hazards, both measured:

- **A background task that goes silent long enough gets killed.** A gate that
  prints nothing for minutes can be reaped mid-run.
  A killed task is not a failed gate; re-run and read the log.
- **A trailing `echo` after a pipe masks the exit code.** Write the exit code
  into the log itself, or read the log; never trust the notification's status.

## What the report must contain

Every one of these, and no substitutes:

- The deployed **sha** and the **version id** from the `site / deploy` step.
- The **live gate** lines `devkit-verify-deploy` printed.
- The **drift table** line from `sync:content`, verbatim.
- Both **index counts**: Ask converged, media converged.
- **Anything that did not behave as expected**, including a gate that needed a
  re-run, a flake, a converge step that reported a MISS while the deploy stood, or a
  claim you could not verify. A report with nothing under this heading
  should be rare; silence here reads as "nothing went wrong", so it must only
  ever mean that.
