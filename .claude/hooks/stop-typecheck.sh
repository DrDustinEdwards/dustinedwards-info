#!/usr/bin/env bash
# Stop hook: runs the repo's typecheck when a turn ends, EXCEPT when this stop
# was itself caused by a stop hook.
#
# WHY THIS FILE EXISTS. The Stop hook was the bare command `npm run -s typecheck`
# in .claude/settings.json. It never inspected its own input, so it ran on every
# stop including an idle one, and each run surfaced feedback that ended the turn
# again. Recorded in dustinedwards/core.md as looping nine times at an idle stop.
# Observed live on 2026-08-20 for roughly a dozen consecutive stops, with the
# typecheck passing every single time: the repetition was the wiring, never a
# finding about the code.
#
# THE GUARD IS `stop_hook_active`. Claude Code sets it true on the stdin payload
# when the turn is already continuing because of a stop hook. Returning success
# in that case is what breaks the cycle. It is not a debounce and not a timer:
# it is the one field that distinguishes "the session stopped" from "the session
# stopped because I made it".
#
# ## WHY A SCRIPT RATHER THAN A LONGER COMMAND STRING
#
# The guard has to read JSON from stdin, and a JSON test written inline in a
# JSON file is quoting inside quoting. The precise pattern below needs double
# quotes, which would have to be escaped into settings.json, and the tempting
# escape-free alternative is a glob like *stop_hook_active*true*, which matches
# a payload carrying `"stop_hook_active":false` followed by any other true field
# anywhere. That is a guard that silently stops guarding, which is the exact
# failure no-em-dash.sh documents at length in this same directory. In a script
# the pattern is single-quoted and unambiguous.
#
# ## FAIL DIRECTION: TOWARD RUNNING THE TYPECHECK
#
# If the payload is unreadable, absent, or does not carry the field, this runs
# the typecheck. Skipping it would silently drop the guard that catches a broken
# build at the end of a turn, which is the whole reason the hook exists. Running
# it redundantly costs seconds and cannot loop, because a passing typecheck
# exits 0 and a stop is allowed.
#
# Exit codes are the hook contract, not this script's opinion: 0 allows the stop,
# and the typecheck's own non-zero propagates unchanged so a broken build still
# blocks. Nothing here invents a code.
#
# THE COMMAND IT RUNS IS `npm run -s typecheck` AND MUST STAY THAT WAY. This
# repo has already been bitten by a Stop hook running a bare `npx tsc -b` while
# `npm run typecheck` runs `wrangler types` and `react-router typegen` first, so
# it typechecked against stale generated types. package.json is the one place
# that defines what a typecheck is.
#
# NOTHING ASSERTS THAT ANY MORE. check:hooks did, and was deleted on 2026-08-21
# in the audit's tier 4.1 sweep, because it could only ever read what a file
# DECLARED and never whether a hook ran. So this paragraph is the enforcement
# now. If you change the command here, you are the only check.

set -uo pipefail

payload="$(cat 2>/dev/null || true)"

# Precise, so `"stop_hook_active": false` cannot match. Optional whitespace on
# both sides of the colon, because the payload's formatting is not this script's
# to assume.
if printf '%s' "$payload" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

npm run -s typecheck
