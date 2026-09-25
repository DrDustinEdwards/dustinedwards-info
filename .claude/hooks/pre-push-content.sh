#!/usr/bin/env bash
# PreToolUse hook on Bash: runs npm run lint before EVERY push, and
# check:content before a push that touched app/ or content/. Blocks on either.
#
# ## The second defect, added 2026-09-04: lint
#
# `npm run lint` is a separate CI step and NO gate tier runs it. check:all can
# report twenty eight gates green and CI still goes red on oxlint, which is
# exactly what happened on 2026-09-03. The two facts are as far apart as the two
# below: a green local tier reads as "everything passed", and the one thing it
# does not cover is the one thing that failed.
#
# It runs on every push rather than on a path prefilter, because lint covers
# app, scripts, workers and test, which is nearly every file anyone edits, and a
# prefilter matching all of them is a prefilter that does nothing except add a
# way to be wrong. It is fast enough to pay for unconditionally.
#
# ## The defect this replays
#
# Two CI-red pushes in two days, both the same shape and neither a content edit.
# A new file landed under app/, which moved the count of source files citing a
# template asset, which moved content/generated/template-refs.json, which
# check:content byte-compares against a fresh scan. Nobody re-ran check:content
# because nobody had touched content. CI found it, on the push, after the fact.
#
# The gate was never wrong and the author was never careless. The two facts were
# just too far apart to connect by memory: an addition under app/ is not what
# anyone calls a content change.
#
# ## Why a Claude Code hook and not a git pre-push hook
#
# There is no git hook mechanism in this repository. `.git/hooks` is empty,
# `core.hooksPath` is unset, and there is no `prepare` script. The mechanism
# that exists is this directory plus its registration in .claude/settings.json,
# which is where scoped-git-add.sh and no-em-dash.sh live. Adding `.githooks`
# would be a SECOND mechanism, with two places to look when a guard does not
# fire and two things to keep installed.
#
# The cost of that choice is stated rather than hidden: this fires on a push
# made through the agent's Bash tool and CANNOT fire on a push typed straight
# into a terminal. It narrows the window that produced both red pushes; it does
# not close it. CI remains the backstop and is the thing that actually cannot be
# bypassed.
#
# ## The range
#
# `<upstream>..HEAD`, from `@{upstream}`, which is what the local tracking ref
# says the remote has. That ref can be stale, so this can miss a path that
# changed on the remote since the last fetch. For a mainline-only repo where the
# session is the pusher that is close enough, and the failure direction is
# toward running the gate anyway: if the upstream cannot be resolved, the check
# RUNS rather than being skipped.
#
# ## Fail direction: toward RUNNING the check
#
# Unlike scoped-git-add.sh, and deliberately. scoped-git-add guards against an
# irreversible staging mistake, so an unreadable payload there blocks the command. This one guards against a red CI
# run, so an unreadable payload here runs a five-second gate. Blocking every
# Bash call in the session because one JSON payload was malformed would be a
# worse outcome than the thing being guarded against.
#
# ## Known false positive, accepted
#
# The prefilter reads the whole command string, so a commit message or heredoc
# containing the words git and push makes this run check:content. That costs a
# few seconds and blocks nothing unless the gate genuinely fails. The same
# reasoning as scoped-git-add.sh: for a guard, a false positive costs time and a
# false negative costs the thing the guard exists for.
#
# Exit contract, matching this directory: 2 blocks the tool call, 0 allows it.

set -uo pipefail

payload="$(cat 2>/dev/null || true)"

# CHEAP PREFILTER, and it has to be. This hook is registered on every Bash call,
# so the path taken by the other several hundred commands in a session must not
# spawn an interpreter. Two greps and out.
printf '%s' "$payload" | grep -q 'git' || exit 0
printf '%s' "$payload" | grep -q 'push' || exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
cd "$PROJECT_DIR" 2>/dev/null || exit 0

# Now confirm it is really a push rather than the two words appearing apart.
# Python for the JSON, on the same reasoning and with the same interpreter probe
# as scoped-git-add.sh: on Windows the bare name python3 is often the Microsoft
# Store stub, which satisfies command -v and is not an interpreter.
PY=""
for cand in python3 python py; do
  command -v "$cand" >/dev/null 2>&1 || continue
  if [ "$("$cand" -c 'print("hookprobe")' 2>/dev/null)" = "hookprobe" ]; then
    PY="$cand"
    break
  fi
done

is_push=1
if [ -n "$PY" ]; then
  printf '%s' "$payload" | "$PY" -c '
import json, re, sys
raw = sys.stdin.buffer.read().decode("utf-8", "replace")
try:
    d = json.loads(raw)
except Exception:
    sys.exit(0)   # unreadable: fall through to running the check
cmd = str((d.get("tool_input") or {}).get("command") or "")
sys.exit(0 if re.search(r"\bgit\b[^|;&]*\bpush\b", cmd) else 1)
'
  is_push=$?
fi
# is_push is 0 when it is a push OR when the payload could not be read, and 1
# only when Python positively decided it was not one. No interpreter means no
# decision, which is not a reason to skip.
[ "$is_push" -eq 0 ] || exit 0

# LINT FIRST, and unconditionally. Nothing below narrows it by path: see the
# header. Same fail direction as check:content below, which is to block.
# A LINT THAT FOUND PROBLEMS AND A LINT THAT NEVER RAN ARE DIFFERENT FACTS, and
# this said "lint FAILED" for both until 2026-09-06.
#
# Told "lint FAILED", a reader goes looking for lint errors in a diff that has
# none, which is the direction that wastes the most time. check-all.mjs already
# refuses the same conflation for gates: a gate that could not run is not a gate
# that failed.
#
# THE EXIT CODE CANNOT TELL THEM APART, MEASURED. The obvious test is "oxlint
# exits 1 on findings, so anything else is a tool that never ran". It is wrong
# here: with the binary moved away, `npm run -s lint` returns 1, not 127, because
# npm collapses the shell's not-found into its own failure code. The first
# version of this block used that test, and its own plant printed "lint FAILED"
# for a lint that had never run.
#
# So the OUTPUT is what discriminates, and the signatures are taken from running
# it rather than guessed. Windows cmd says `'oxlint' is not recognized as an
# internal or external command`; a POSIX shell says `command not found`; an
# execvp failure says `No such file or directory` or ENOENT.
#
# A NEEDLE ON OUTPUT IS FRAGILE and that is accepted here, because the fail
# direction is safe: BOTH branches block the push. A misread costs the reader a
# wrong explanation, never a wrong verdict, and the alternative is testing for
# the binary directly, which would be a second statement of what "lint" is when
# package.json is supposed to be the only one.
lint_out="$(npm run -s lint 2>&1)"
lint_rc=$?
if [ "$lint_rc" -ne 0 ] && printf '%s' "$lint_out" | grep -qE "is not recognized as an internal or external command|command not found|No such file or directory|ENOENT"; then
  {
    echo "$lint_out"
    echo
    echo "Blocked: npm run lint COULD NOT RUN (exit $lint_rc). This is NOT a lint finding."
    echo "The output above is a shell or npm refusal, not oxlint's. Usual causes: the binary is missing (run npm ci), the script was renamed, or a config or flag is wrong."
    echo "Blocking anyway: a lint that did not run covers nothing, and CI is the only thing behind this push."
  } >&2
  exit 2
elif [ "$lint_rc" -ne 0 ]; then
  {
    echo "$lint_out"
    echo
    echo "Blocked: npm run lint FAILED."
    echo "lint is a separate CI step and no gate tier runs it, so a green check:all does not cover it. That is how CI went red on 2026-09-03 after a clean twenty eight gate run."
    echo "Fix: resolve the lint errors above, then push."
  } >&2
  exit 2
fi

upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"

changed=""
range_known=0
if [ -n "$upstream" ]; then
  if changed="$(git diff --name-only "$upstream" HEAD -- app content 2>/dev/null)"; then
    range_known=1
  fi
fi

if [ "$range_known" -eq 1 ] && [ -z "$changed" ]; then
  # THE FAST PATH, and the reason this hook is tolerable at all: a push that
  # touched neither tree runs nothing and says nothing.
  exit 0
fi

if [ "$range_known" -eq 1 ]; then
  echo "pre-push: ${upstream}..HEAD touches app/ or content/, running check:content" >&2
else
  echo "pre-push: could not resolve @{upstream}, so running check:content rather than skipping it" >&2
fi

if ! out="$(npm run -s check:content 2>&1)"; then
  {
    echo "$out"
    echo
    echo "Blocked: check:content FAILED, and this push touches app/ or content/."
    echo "This is the shape that turned CI red twice in two days: a new file under app/ moves the template-refs count, and nothing about that looks like a content change."
    echo "Fix: npm run build:content, then git add the regenerated file under content/generated/ and amend or add a commit."
  } >&2
  exit 2
fi

exit 0
