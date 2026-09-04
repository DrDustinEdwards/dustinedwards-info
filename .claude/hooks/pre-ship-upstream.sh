#!/usr/bin/env bash
# PreToolUse hook on Bash: refuses `npm run ship` when HEAD is behind its
# upstream, and BLOCKS the command.
#
# ## The defect this replays
#
# 2026-09-03: a seat-side merge landed on the remote, the session's local main
# did not have it, and `npm run ship` deployed local HEAD. Ship's own contract
# (hard rule 16) checks that CI concluded green for the exact HEAD sha, and that
# check PASSED, because the sha it named was a real commit with a real green
# run. It was simply not the tip. Nothing in the contract asks whether the tip
# is the tip, so the wrong commit shipped with every gate green.
#
# The repair belongs here rather than in ship for one reason: ship refuses a
# dirty tree, so it cannot pull for you, and a step that told you to pull would
# be a step you could skip. This blocks before the build starts.
#
# ## Fail direction: toward BLOCKING
#
# Matching scoped-git-add.sh rather than pre-push-content.sh. A push that
# skipped a content gate costs a red CI run; a ship that deploys the wrong
# commit costs a production deploy nobody can explain from the log, and the
# evidence is that it looks entirely normal while it happens. So an unreadable
# payload, a missing interpreter or an unresolvable upstream all block.
#
# ## The fetch
#
# `git fetch` runs before the comparison, because `@{upstream}` is a local
# tracking ref and a stale one is exactly the state this hook exists to catch.
# Comparing against an unfetched ref would agree with the session's own wrong
# belief. The fetch is the whole point and it is why this hook is allowed to be
# slower than the others: it runs only on a ship.
#
# Exit contract, matching this directory: 2 blocks the tool call, 0 allows it.

set -uo pipefail

payload="$(cat 2>/dev/null || true)"

# CHEAP PREFILTER. Registered on every Bash call, so the several hundred
# commands that are not a ship must not spawn an interpreter. Two greps and out.
printf '%s' "$payload" | grep -q 'ship' || exit 0
printf '%s' "$payload" | grep -q 'npm' || exit 0

block() {
  echo "$1" >&2
  exit 2
}

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
cd "$PROJECT_DIR" 2>/dev/null || block "pre-ship-upstream hook: could not enter the project directory, so the upstream check could not run. Blocking rather than shipping unchecked."

# The same interpreter probe the other hooks use: on Windows the bare name
# python3 is often the Microsoft Store stub, which satisfies command -v, prints
# an install notice and exits 49.
PY=""
for cand in python3 python py; do
  command -v "$cand" >/dev/null 2>&1 || continue
  if [ "$("$cand" -c 'print("hookprobe")' 2>/dev/null)" = "hookprobe" ]; then
    PY="$cand"
    break
  fi
done

if [ -z "$PY" ]; then
  block "pre-ship-upstream hook: no working Python found (tried python3, python, py), so the ship command could not be identified. Blocking rather than shipping unchecked."
fi

# Confirm it is really `npm run ship` and not the words appearing apart, and not
# a longer script name that merely starts with ship.
printf '%s' "$payload" | "$PY" -c '
import json, re, sys
raw = sys.stdin.buffer.read().decode("utf-8", "replace")
try:
    d = json.loads(raw)
except Exception:
    sys.exit(4)
cmd = str((d.get("tool_input") or {}).get("command") or "")
sys.exit(0 if re.search(r"\bnpm\b[^|;&]*\brun\b[^|;&]*\bship\b", cmd) else 1)
'
rc=$?

case "$rc" in
  0) ;;                                  # it is a ship, fall through and check
  1) exit 0 ;;                           # positively not a ship
  4) block "pre-ship-upstream hook: the payload on stdin was not valid JSON, so the ship command could not be identified. Failing closed: BLOCKED." ;;
  *) block "pre-ship-upstream hook: the command check exited with unexpected code $rc. Failing closed: BLOCKED. Interpreter used: $PY." ;;
esac

upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
if [ -z "$upstream" ]; then
  block "Blocked: could not resolve @{upstream}, so there is no way to tell whether this branch is behind the remote. Ship deploys local HEAD. Set an upstream, or pull, then retry."
fi

if ! git fetch --quiet 2>/dev/null; then
  block "Blocked: git fetch failed, so the comparison against $upstream would be made against a possibly stale tracking ref, which is the exact state this check exists to catch. Fix the network or the remote, then retry."
fi

behind="$(git rev-list --count "HEAD..$upstream" 2>/dev/null || echo "")"
if [ -z "$behind" ]; then
  block "Blocked: could not count commits between HEAD and $upstream. Failing closed rather than shipping unchecked."
fi

if [ "$behind" -gt 0 ]; then
  {
    echo "Blocked: HEAD is $behind commit(s) behind $upstream, and npm run ship deploys LOCAL HEAD."
    echo "This is the 2026-09-03 shape: ship's CI check passes because the sha it names is real and green, it is just not the tip, so the wrong commit deploys with every gate green."
    echo "Fix: git pull --ff-only, re-run the gates, then ship."
  } >&2
  exit 2
fi

exit 0
