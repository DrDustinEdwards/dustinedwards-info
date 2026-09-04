#!/usr/bin/env bash
# PreToolUse hook on Bash: production writes go through `npm run ship` and
# nothing else. Blocks wrangler deploy, wrangler versions upload, npm run
# deploy, and any wrangler d1 execute that is not a plain SELECT.
#
# ## Why a hook and not a permission rule
#
# `permissions.deny` matches a command prefix. Every bypass here is a different
# spelling of the same act: `npx wrangler deploy`, `npm run deploy`,
# `wrangler versions upload`, a d1 execute carrying an UPDATE. A prefix list
# would have to enumerate them and would still miss `env FOO=1 wrangler deploy`.
# This reads the whole command string, which is the same choice
# scoped-git-add.sh made and for the same measured reason.
#
# ## What it protects
#
# Hard rule 16 is the deploy contract: CI green for the exact HEAD sha, the
# operator token checked before the build, the indexes converged after. A bare
# `wrangler deploy` satisfies none of it and looks like it worked. The
# `dustin-workflow` skill was found telling every Cloudflare session to deploy
# with `npx wrangler deploy` (fixed 2026-09-04); this is the enforcement half of
# that correction, because a skill can be re-edited and a hook refuses.
#
# `npm run deploy` is included deliberately, and it is one command wider than
# the three that were asked for. It runs `wrangler deploy` from package.json, so
# a guard that blocked the wrangler spellings and allowed this one could be
# satisfied by accident, which is the "a fix in N-1 of N sites is not a fix"
# shape in FAILURES.md. `npm run ship` is untouched: it invokes wrangler as a
# child process, which no PreToolUse hook sees or should see.
#
# ## Read-only wrangler stays allowed
#
# `wrangler tail`, `whoami`, `d1 info`, `r2 object get`, `secret list`,
# `d1 migrations apply` and everything else pass. Migrations are applied through
# wrangler directly by design (CLAUDE.md, Commands), so `d1 migrations` is not
# `d1 execute` and is not touched.
#
# `d1 execute` is allowed ONLY when every statement it carries begins with
# SELECT. A `--file` is refused: its contents are not on the command line, so
# the check cannot see them, and an unverifiable write is not a read.
#
# ## Fail direction: toward BLOCKING
#
# scoped-git-add.sh's contract, for the same reason: the thing on the other side
# is irreversible. A missing interpreter, unreadable JSON or an unexpected
# checker code all block.
#
# Exit contract, matching this directory: 2 blocks the tool call, 0 allows it.

set -uo pipefail

payload="$(cat 2>/dev/null || true)"

# CHEAP PREFILTER. Registered on every Bash call. One grep for either of the two
# words that can reach a deploy, and out.
printf '%s' "$payload" | grep -qE 'wrangler|deploy' || exit 0

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
  block "no-direct-deploy hook: no working Python found (tried python3, python, py). The deploy check could not run, so this command is BLOCKED rather than passed silently."
fi

printf '%s' "$payload" | "$PY" -c '
import json, re, sys

raw = sys.stdin.buffer.read().decode("utf-8", "replace")
try:
    d = json.loads(raw)
except Exception:
    sys.exit(4)
cmd = str((d.get("tool_input") or {}).get("command") or "")

# `npm run ship` is the one door and is never blocked, even though it deploys.
# Checked first so a compound command that ships is not caught by a later arm.
if re.search(r"\bnpm\b[^|;&]*\brun\b[^|;&]*\bship\b", cmd):
    sys.exit(0)

if re.search(r"\bnpm\b[^|;&]*\brun\b[^|;&]*\bdeploy\b", cmd):
    sys.exit(5)

# Every wrangler invocation in the string, with the words that follow it up to
# the next command separator. Whole-string, not command-position anchored, for
# the reason scoped-git-add.sh records: the anchored form let three real
# bypasses through.
for m in re.finditer(r"\bwrangler\b([^|;&]*)", cmd):
    args = [a for a in m.group(1).split() if not a.startswith("-")]
    if not args:
        continue
    if args[0] == "deploy":
        sys.exit(6)
    if args[0] == "versions" and len(args) > 1 and args[1] == "upload":
        sys.exit(7)
    # `wrangler d1 execute <database>`, so the verb is args[1] and the database
    # name is args[2]. This read args[2] for one revision and the replay caught
    # it: an UPDATE ran against the local database because the check compared
    # the verb slot against the database name and never matched.
    if args[0] == "d1" and len(args) > 1 and args[1] == "execute":
        tail = m.group(1)
        if re.search(r"--file\b|-f\b", tail):
            sys.exit(9)
        # The SQL, from --command / -c, in either quoting style.
        sql = None
        q = re.search(r"(?:--command|-c)[=\s]+(\"([^\"]*)\"|\x27([^\x27]*)\x27)", tail)
        if q:
            sql = q.group(2) if q.group(2) is not None else q.group(3)
        if sql is None:
            sys.exit(9)   # no readable SQL: unverifiable, so refused
        for stmt in sql.split(";"):
            s = stmt.strip().lstrip("(").strip()
            if not s:
                continue
            if not re.match(r"(?i)^select\b", s):
                sys.exit(8)

sys.exit(0)
'
rc=$?

rule16="Hard rule 16 is the deploy contract: CI green for the exact HEAD sha, the operator token checked before the build, both indexes converged after. Use: npm run ship"

case "$rc" in
  0) exit 0 ;;
  5) block "Blocked: npm run deploy. It runs wrangler deploy from the working tree, which is a deploy nobody can reproduce. $rule16" ;;
  6) block "Blocked: wrangler deploy. $rule16" ;;
  7) block "Blocked: wrangler versions upload. It puts a version on the account outside the ship contract. $rule16" ;;
  8) block "Blocked: wrangler d1 execute carrying something other than a SELECT. D1 is a DERIVED store (hard rule 18) and is repaired THROUGH its derivation, never by a hand-written statement. A hand-written row makes the index a second truth. Read-only SELECT is allowed." ;;
  9) block "Blocked: wrangler d1 execute whose SQL this check cannot read (a --file, or no --command). An unverifiable statement is not a read. Pass the SQL inline as --command \"SELECT ...\" if it is a read." ;;
  4) block "no-direct-deploy hook: the payload on stdin was not valid JSON, so the deploy check could not run. Failing closed: BLOCKED (checker exit 4)." ;;
  *) block "no-direct-deploy hook: the deploy check exited with unexpected code $rc. Failing closed rather than passing silently, so this command is BLOCKED. Interpreter used: $PY." ;;
esac
