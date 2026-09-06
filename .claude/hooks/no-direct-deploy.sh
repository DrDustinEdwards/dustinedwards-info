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
# ## SCOPED TO THIS REPO, 2026-09-05, ruling 20
#
# The deploy arms fire only when the command runs INSIDE the site repo. Hard
# rule 16 is a statement about this Worker, not about every repository a session
# happens to touch, and this hook fires on every Bash call in a session started
# here. So `cd ../dustinedwards-mcp && npm run deploy` was refused for a rule
# with nothing to say about it: the admin MCP has no ship pipeline and deploys
# exactly that way by its own README. That block cost a deploy and was recorded
# as owed before it was recognised as a scope bug.
#
# The effective directory is the LAST `cd` in the command resolved against the
# payload's `cwd`, which is what a shell does. Everything unresolvable reads as
# INSIDE, so the failure direction is unchanged: toward blocking.
#
# THE D1 ARMS ARE NOT SCOPED and stay global. Their subject is named in the
# command's own argument (the site's database) rather than by the directory it
# runs in, so a `cd` elsewhere does not make them somebody else's business.
#
# Replayed both directions by `scripts/check-hook-deploy-scope.mjs`, which is in
# the offline tier. Eight cases: the block inside, the allow outside, the
# last-cd rule, an absolute path, a d1 delete still refused outside, a bare
# `cd`, a `--dry-run` allowed inside, and a deploy with no such flag still
# refused beside it.
#
# ## `wrangler deploy --dry-run` IS ALLOWED, 2026-09-06
#
# It bundles and prints; it creates no version and no deployment and changes
# nothing on the account. The arm below therefore reads the flag. Blocking a
# read was the safe direction and was still wrong: it cost a dependency
# session its before-and-after module measurement and pushed that session into
# running deploy commands from outside the guard, which is a worse habit than
# the one the block bought.
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

# THE SITE REPO ROOT, DERIVED FROM THIS FILE rather than hardcoded, so a clone
# at any path is still the thing this hook protects. Two levels up from
# .claude/hooks/ is the directory holding .claude.
#
# `pwd -W` is MSYS asking for the WINDOWS spelling. Without it git bash answers
# `/c/Users/...` while the hook payload's `cwd` carries `C:\Users\...`, and the
# comparison below would find every path outside the repo, which fails toward
# ALLOWING. It falls back to plain `pwd` where the flag does not exist, which is
# already the right answer there.
SITE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && { pwd -W 2>/dev/null || pwd; })"
export SITE_ROOT

printf '%s' "$payload" | "$PY" -c '
import json, os, posixpath, re, sys

raw = sys.stdin.buffer.read().decode("utf-8", "replace")
try:
    d = json.loads(raw)
except Exception:
    sys.exit(4)
cmd = str((d.get("tool_input") or {}).get("command") or "")


def normalise(path):
    """One spelling for two operating systems and three shells.

    Lowercased, forward slashes, and the MSYS drive form folded onto the
    Windows one, because the payload and the shell disagree about which to
    write and a comparison between the two spellings is always false.
    """
    p = path.replace("\\", "/")
    m = re.match(r"^/(?:cygdrive/)?([A-Za-z])/(.*)$", p)
    if m:
        p = m.group(1) + ":/" + m.group(2)
    return posixpath.normpath(p).rstrip("/").lower()


def effective_dir(command, cwd):
    """Where the command actually runs, or None when that cannot be known.

    THE LAST `cd` WINS, which is what a shell does: `cd a && cd b` runs in b.
    Splitting on the separators means a `cd` inside a quoted string is not
    mistaken for one, which is the cheap approximation this needs; the
    expensive alternative is a shell parser, and the failure direction below
    makes the approximation safe.

    NONE IS RETURNED FOR EVERY CASE THIS CANNOT RESOLVE: a bare `cd` (which
    goes home), a `cd -` (which goes wherever the shell was last), a variable,
    or a path that will not resolve. The caller treats None as INSIDE the site
    repo, so an unreadable command fails toward blocking.
    """
    target = None
    for part in re.split(r"&&|\|\||[;|]", command):
        stripped = part.strip()
        if not re.match(r"^cd(\s|$)", stripped):
            continue
        arg = stripped[2:].strip()
        # A bare `cd`, a `cd -`, or anything that reads a variable.
        if not arg or arg.startswith("-") or "$" in arg or "%" in arg:
            return None
        # QUOTE CHARACTERS BY CODE POINT, never written literally. This whole
        # block is inside a single-quoted bash string, so one apostrophe here
        # ends the program and hands the rest of it to bash as commands. That
        # is not hypothetical: it happened while this was being written, and
        # the hook then refused every Bash call in the session with a bash
        # syntax error. Fail-closed, loudly, which is the right direction and
        # still an outage.
        quotes = (chr(34), chr(39))
        if len(arg) > 1 and arg[0] == arg[-1] and arg[0] in quotes:
            arg = arg[1:-1]
        target = arg
    if target is None:
        return cwd or None
    if not cwd and not os.path.isabs(target):
        return None
    try:
        return os.path.normpath(os.path.join(cwd or "", target))
    except Exception:
        return None


# WHERE THIS COMMAND RUNS, and whether that is this repo. Ruling 20, 2026-09-05.
#
# Hard rule 16 is a statement about THE SITE: `npm run ship` is the only
# reproducible way to deploy this Worker. It is not a statement about every
# repository a session happens to touch, and this hook fires on every Bash call
# in a session started here, so `cd ../dustinedwards-mcp && npm run deploy` was
# refused for a rule that has nothing to say about it. The admin MCP has no ship
# pipeline and deploys exactly that way by its own README.
#
# So the deploy arms below are scoped: outside this repo they do not fire. The
# d1 arms are NOT scoped and stay global, because they name the site database in
# an argument the command itself carries, so their subject travels with the
# command rather than with the directory.
#
# NO APOSTROPHE APPEARS ANYWHERE BELOW THIS LINE, and that is a constraint
# rather than a style. Every line from here to the closing quote is inside a
# single-quoted bash string, so one apostrophe ends the program and hands the
# remainder to bash. Write "the command itself carries" rather than the
# possessive, and quote characters by code point.
#
# THE FAILURE DIRECTION IS TOWARD BLOCKING. A `cd` this cannot resolve, a
# missing cwd, or an unreadable site root all read as INSIDE, which is the
# answer that refuses. The old behaviour is what a broken parse falls back to.
site_root = os.environ.get("SITE_ROOT") or ""
where = effective_dir(cmd, str(d.get("cwd") or ""))
if not site_root or where is None:
    outside_site = False
else:
    root = normalise(site_root)
    here = normalise(where)
    outside_site = here != root and not here.startswith(root + "/")

# `npm run ship` is the one door and is never blocked, even though it deploys.
# Checked first so a compound command that ships is not caught by a later arm.
if re.search(r"\bnpm\b[^|;&]*\brun\b[^|;&]*\bship\b", cmd):
    sys.exit(0)

if not outside_site and re.search(r"\bnpm\b[^|;&]*\brun\b[^|;&]*\bdeploy\b", cmd):
    sys.exit(5)

# Every wrangler invocation in the string, with the words that follow it up to
# the next command separator. Whole-string, not command-position anchored, for
# the reason scoped-git-add.sh records: the anchored form let three real
# bypasses through.
for m in re.finditer(r"\bwrangler\b([^|;&]*)", cmd):
    flags = [a for a in m.group(1).split() if a.startswith("-")]
    args = [a for a in m.group(1).split() if not a.startswith("-")]
    if not args:
        continue
    # A DRY RUN UPLOADS NOTHING, so it is not the act this hook exists to
    # refuse. It bundles, prints the module table and exits; no version is
    # created, no deployment is made, and nothing on the account changes.
    #
    # Ruled 2026-09-06 after the block cost a measurement: a dependency session
    # needed the module set and sizes before and after a wrangler upgrade,
    # which is exactly what --dry-run answers, and had to run it from outside
    # the repo to get it. Blocking a read is the safe direction and is still
    # wrong, because the workaround it forces is a session routinely running
    # deploy commands from outside the guard.
    #
    # THE FLAG IS READ FROM THE SAME SEGMENT as the verb, so a --dry-run
    # belonging to some other command in a compound line cannot license this
    # one. Nothing else here is loosened: without the flag, exit 6 as before.
    dry_run = "--dry-run" in flags
    if not outside_site and args[0] == "deploy" and not dry_run:
        sys.exit(6)
    if not outside_site and args[0] == "versions" and len(args) > 1 and args[1] == "upload":
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
