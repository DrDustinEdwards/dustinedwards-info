# test/

`node:test`, no dependencies. Run with `npm test`, or as `check:tests` inside
`npm run check`.

**`test/worker/` IS A DIFFERENT INSTRUMENT and does not belong to the split
below.** It is vitest inside workerd, run by `npm run test:worker` and gated by
`check:worker`, and it exists because there was NOTHING between the pure
functions here and the real browser: no test ran a loader, an action, D1, KV,
R2, the Cache API or the Worker entry, so every route-level fact had to be
established by probing production. Its own boundary, and why the React Router
route table is a stub there, are stated in `vitest.config.ts`. Nothing in it
imports from this directory and nothing here imports from it.

The rule for which one a new case goes in: **if it needs a BINDING, it is a
worker test; if input in, output out is the whole claim, it is a test here.**
The cheaper instrument wins ties, because `check:tests` runs in seconds and
`check:worker` boots a runtime.

## Three instruments, three jobs

This repo already had two ways of knowing something is true, and they were
being asked to do a third job they are bad at. Naming the split is the point of
this directory.

**TESTS verify SHIPPED MODULES.** They import the module the Worker imports and
assert what it does with a given input. `frontmatterSchema` refuses
`javascript:` in `cover.src`; `statusLabel()` throws on an unknown status rather
than returning it. These are claims about BEHAVIOUR, they are cheap, and they
are the right home for anything that can be expressed as input in, output out.

**GATES verify the REPO'S SHAPE.** `check:content` byte-compares an artifact.
`check:invariants` section 15 measures CLAUDE.md's size and section order.
`check:config` compares two config files to each other. `check:invariants` binds raw SQL column
names to `schema.ts`. None of these is a behavioural claim, none would fit in a
test, and each carries an OBSERVATION BOUNDARY note saying what it cannot see.

**PLANTS remain the discipline for NEW assertions.** Before trusting any new
check, break the thing it watches and confirm it goes red, and confirm the
assertion you EXPECTED is the one that fired. Exit 1 is not evidence: on
2026-08-07 a plant was shell-mangled twice, tripped a different assertion both
times, and looked exactly like success. Plants are an act, not an artifact.

**A plant gets promoted into this directory when it concerns BEHAVIOUR.** That
is the rule for what lives here. A plant that proves a gate's own parsing works
stays a plant, because turning it into a test would mean testing the gate rather
than the site.

## What is here, and which defect each replays

Every case in these files was a real defect or a real plant, not an invented
example. Hard rule 12: a new gate must be tested by replaying the defect it was
written for, because plants get written to match the implementation rather than
the bug.

- **`frontmatter-urls.test.mjs`** the ten-case cover / further_reading table.
  Replays the 2026-08-07 finding that `cover.src` refused `javascript:` only as
  a SIDE EFFECT of a site-absolute path regex, so the mechanism was wrong while
  every behavioural case passed. The three accepted cover paths are the half
  that would have caught a fix that broke legitimate input.
- **`status-label.test.mjs`** `statusLabel()` throws and does not substitute.
  Replays the colophon defect where `STATUS_LABEL[s] ?? s` rendered the raw enum
  on the page and in the index at once, looking like working output in both.
- **`sql-literals.test.mjs`** `joinConcatenatedLiterals()` against `og_titl` and
  `titl`. Replays the two defects that made `check:invariants` section 5 blind
  to `sync-content.mjs`, which builds its SQL by concatenation.

## What does NOT belong here

Anything needing a BINDING. D1, KV, R2, a Durable Object and the Cache API all
have a real local implementation now, and `test/worker/` is where a claim about
one of them goes.

Anything needing the network, a deployed database, a bucket, or a browser.
Those are `check:all --remote` and `verify-live`, and they are separate because
they cannot run on a plane and because `verify-live` bills money per Ask probe.
`test/worker/` is offline too, and structurally so: its setup installs a `fetch`
that THROWS on any outbound call, and one of its own cases proves that stub is
installed. It found its first violation of that rule on its first run, when
`/api/health`'s content-drift check reached `api.github.com` for real.
