#!/usr/bin/env bash
# PreToolUse hook on Bash: blocks unscoped git adds (git add -A / --all / .).
# Canon: capsid/conventions.md, scoped commits with explicit named paths only.
#
# PreToolUse plus exit 2 is the only combination that blocks the tool call, and
# jq is not guaranteed on macOS, so the check is written in Python.
#
# Token-based, so paths that merely START with a dot (.claude/settings.json)
# pass; only the bare tokens -A, --all, . and ./ block.
#
# FAILS CLOSED (2026-08-11), and until that date it did NOT. The header used to
# claim "same pattern and rationale as no-em-dash.sh". That was false in the
# three ways that matter, and the claim is why nobody looked:
#
#   1. The interpreter was probed with `command -v python3`. On Windows that
#      name resolves to the Microsoft Store stub, which SATISFIES command -v,
#      prints an install notice and exits 49. The guard never fired.
#   2. When the guard did fire it ran `exit 1`. Only exit 2 blocks a tool call,
#      so a missing interpreter PASSED the git add through while printing a
#      warning nobody reads. That is the fail-open recorded in hard rule 15.
#   3. Invalid JSON exited 0, and any unexpected checker exit fell through to
#      exit 0. Both passed the call.
#
# So the enforcement could be entirely absent while the file sat there looking
# like a guard. no-em-dash.sh had already been repaired for exactly this on
# 2026-07-27; this file was left behind because its header said it was fine.
#
# The interpreter is therefore probed by RUNNING it, not by command -v, and
# stdin is decoded from sys.stdin.buffer as UTF-8 rather than trusting the text
# layer, which is cp1252 on Windows.
#
# CONTRACT, matching no-em-dash.sh exactly: checker exit 3 blocks, exit 0
# passes, EVERY other outcome blocks and names the code.
#
# KNOWN AND ACCEPTED FALSE POSITIVE: the scan reads the whole command string, so
# a command that merely CONTAINS the forbidden token sequence is blocked even
# when nothing is being staged. Writing a commit message that quotes the rule is
# the way to meet this, and it happened on the very commit that landed this
# hardening. The fix is to reword, not to loosen the matcher: parsing shell well
# enough to tell a heredoc from an argument is not something a guard should
# attempt, and for a blocking safety hook a false positive costs a rewording
# while a false negative costs the thing the hook exists to prevent.
#
# Verified 2026-08-11 by planting all three arms: `git add -A` blocks naming the
# rule, a scoped add passes, and a stripped PATH blocks with the named
# interpreter message rather than the old fail-open. The earlier "Functionally
# tested 2026-07-17: 10/10 cases" note covered the token matching only; it
# predates the fail-open findings above and never exercised them.
set -uo pipefail

block() {
  echo "$1" >&2
  exit 2
}

PY=""
for cand in python3 python py; do
  command -v "$cand" >/dev/null 2>&1 || continue
  if [ "$("$cand" -c 'print("hookprobe")' 2>/dev/null)" = "hookprobe" ]; then
    PY="$cand"
    break
  fi
done

if [ -z "$PY" ]; then
  block "scoped-git-add hook: no working Python found (tried python3, python, py). On Windows the bare name python3 is often the Microsoft Store stub, which is not an interpreter. The scoped-add check could not run, so this command is BLOCKED rather than passed silently. Put a real Python on PATH."
fi

"$PY" -c '
import json, re, sys
raw = sys.stdin.buffer.read().decode("utf-8", "replace")
try:
    d = json.loads(raw)
except Exception:
    sys.exit(4)
cmd = str((d.get("tool_input") or {}).get("command") or "")
for m in re.finditer(r"git\s+add\s+([^|;&]*)", cmd):
    toks = m.group(1).split()
    if any(t in ("-A", "--all", ".", "./") for t in toks):
        sys.exit(3)
sys.exit(0)
'
rc=$?

case "$rc" in
  0)
    exit 0
    ;;
  3)
    {
      echo "Blocked: unscoped git add (-A, --all, or .)."
      echo "Canon (capsid/conventions.md): scoped commits only. git add the named paths you changed."
      echo "Run git diff on each path first: a named path is not a scoped change if the file carries edits you did not write."
    } >&2
    exit 2
    ;;
  4)
    block "scoped-git-add hook: the payload on stdin was not valid JSON, so the scoped-add check could not run. Failing closed: this command is BLOCKED (checker exit 4)."
    ;;
  *)
    block "scoped-git-add hook: the scoped-add check exited with unexpected code $rc. Failing closed rather than passing silently, so this command is BLOCKED. Interpreter used: $PY."
    ;;
esac
