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

**TESTS verify SHIPPED MODULES.** They import the module the Worker imports and
assert what it does with a given input. `frontmatterSchema` refuses
`javascript:` in `cover.src`; `statusLabel()` throws on an unknown status rather
than returning it. These are claims about BEHAVIOR, they are cheap, and they
are the right home for anything that can be expressed as input in, output out.

**GATES verify the REPO'S SHAPE.** `check:content` validates every post;
`check:migrations` hashes the migrations against their manifest. Each carries an
OBSERVATION BOUNDARY note saying what it cannot see.

**The rules stated twice that cannot merge** live in `visibility-invariants`,
`schema-invariants`, `write-path-invariants` and `control-characters`, with their
shared helpers in `lib/`. The schema test compares the live database only with
`SCHEMA_LIVE=1`, which `check:all` sets. That drafts never reach a public surface,
and that the write paths keep the search indexes consistent, is checked through
behavior in `worker/visibility.test.ts` and `worker/publish.test.ts`.

**PLANTS remain the discipline for NEW assertions**. Exit 1 is not evidence: a
mangled plant can trip a different assertion and look exactly like success.
Plants are an act, not an artifact.

**A plant gets promoted into this directory when it concerns BEHAVIOR.** That
is the rule for what lives here. A plant that proves a gate's own parsing works
stays a plant, because turning it into a test would mean testing the gate rather
than the site.

## The replay rule

Every case here was a real defect or a real plant, not an invented example. A
new gate is tested by replaying the defect it was written for, because plants
get written to match the implementation rather than the bug.

## What does NOT belong here

Anything needing a BINDING. D1, KV, R2, a Durable Object and the Cache API all
have a real local implementation now, and `test/worker/` is where a claim about
one of them goes.

Anything needing the network, a deployed database, a bucket, or a browser.
Those are `check:all --remote` and `verify-live`, and they are separate because
they cannot run on a plane and because `verify-live` bills money per Ask probe.
`test/worker/` is offline too, and structurally so: its setup installs a `fetch`
that THROWS on any outbound call before every case.
