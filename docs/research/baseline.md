# dustinedwards-mcp baseline (job_eb5564111e61)

Measured 2026-10-10 against main by reading the repository through Capsid
(`list_repo_tree`, `read_repo_file`). Nothing was deleted or changed, and no
package.json or lockfile edit was made. This file and `kill-matrix.json` are the
only additions.

## What was and was not measured

The session could not attach a checkout of this repo (the `add_repo` call was
refused by the permission classifier), so no command was run here. Every number
below comes from reading files, not from running them. In particular:

- No test runtime was measured, because there is no test runner to time.
- The gate counts (230 assertions, 15 plants) are quoted from CLAUDE.md. They
  were not re-run.
- Stryker was not run, for the reason in the next section.

## Finding: the repo has no unit test suite

| What | Result |
|------|--------|
| Test runner in package.json | None. No vitest, jest or node:test dependency, no `test` script |
| Test files | 0. `test/` holds one file, `test/conformance-entry.ts`, a test-only Worker entry that mounts the real `handleMcp` and tools with auth removed so the official MCP conformance suite can reach them |
| Source files under `src/` | 9 (api-client, auth, github-handler, index, legacy-era, mcp-handler, probe, rate-limit, tools), about 75 kB |
| it/test declarations | 0 |
| Mutants measured | None |

The job says that when a repo has few or no tests, the report says so plainly and
lists what is untested instead of running Stryker. A mutation run over `src` with
no test would report every mutant as "no coverage" (a score of 0 that carries no
information), so it was not run. The kill matrix is empty for the same reason
(`kill-matrix.json`).

## What verifies the code instead

The repo is guarded by gates, not unit tests (CLAUDE.md, "Commands"):

| Gate | Command | What it covers |
|------|---------|----------------|
| Wrapper law | `npm run check:wrapper` (`scripts/check-wrapper.mjs`, CLAUDE.md says 230 assertions) | Static assertions over source text: no policy, no app imports, no app bindings, `main` is `src/index.ts`, CIMD and DCR both present, and similar |
| Gate proof | `npm run check:wrapper:plant` (`scripts/plant-violations.sh`, 15 violations) | Plants a violation per rule and requires the wrapper gate to fail |
| Conformance | `npm run check:conformance` (`scripts/check-conformance.mjs`) | The official MCP conformance suite per protocol era, plus the authorization server, against `test/conformance-entry.ts` under `wrangler dev` |
| Types and build | `npm run typecheck`, `npm run build` | Compile and `wrangler deploy --dry-run` |

These are real checks, but none of them is a unit test, and Stryker cannot
score them: the wrapper gate reads source text and the conformance suite drives a
running server. A mutant in `src` is killed only if one of those gates happens to
fail on it, and the gates were not wired to Stryker here.

## What is untested

"Untested" means no test exercises the behavior directly. Conformance covers the
protocol surface and the wrapper gate covers structure. The rest is not pinned by
anything that runs the code:

| File | Size | Not directly tested |
|------|------|---------------------|
| `src/auth.ts` | 5.8 kB | `isAdminUser` allow-list logic, `secretsMatch` constant-time comparison, `agentPrincipal` and the `AGENT_KEY_` prefix lookup. Protected: this is the operator and client-leg credential path |
| `src/api-client.ts` | 5.5 kB | `callOperator` bearer attachment, `ApiLegError`, `assertConfigured`, and verbatim relay of API refusals (for example `403 first-publish-requires-admin`). Protected: operator token and first-publish refusal |
| `src/tools.ts` | 25.5 kB | The five tool definitions, the Zod input schemas, `headShaFrom`, and `run` error handling. The first-publish and delete-mention policy text is prose here, not logic. Protected where it carries the first-publish refusal |
| `src/rate-limit.ts` | 4.0 kB | `OperatorRateLimit` Durable Object window and limit (30 per 60 s) and `checkRateLimit` decisions |
| `src/github-handler.ts` | 9.2 kB | GitHub consent flow and admin check on grant. Protected: it decides who is let in |
| `src/legacy-era.ts` | 3.4 kB | `createLegacyEraHandler` shim for pre-2026-07-28 clients. Conformance runs per era, which gives it partial coverage |
| `src/mcp-handler.ts` | 3.3 kB | `handleMcp` routing and `buildServer`. Covered by conformance through the test entry |
| `src/index.ts` | 9.5 kB | The deployed entry with OAuth provider wiring. The conformance entry deliberately bypasses it, so the real client-leg auth and rate limiter are not reached by that suite |
| `src/probe.ts` | 9.4 kB | The client-measurement probe. Not production behavior |

The largest gap is that the conformance gate removes the client-leg auth and the
rate limiter, so `src/index.ts` auth wiring, `src/auth.ts` and
`src/rate-limit.ts` have no executing check at all. The wrapper gate only proves
they are present.

## Removal candidates

None. There are no tests to remove. The three gate scripts are the whole safety
net, and the protected items (operator token handling, first-publish refusal
relay) are guarded only by them.

## For the seat

1. If mutation testing is wanted here, the repo needs unit tests first. The cheap
   starting points, in order of risk: `secretsMatch` and `isAdminUser` in
   `src/auth.ts`; `callOperator` and verbatim refusal relay in
   `src/api-client.ts`; `checkRateLimit` in `src/rate-limit.ts`. A vitest suite
   with a Workers pool, added in a separate job, would let Stryker 9.6.1 run over
   `src` (10.0.0 has a Babel 8 parser bug).
2. Re-run `check:wrapper`, `check:wrapper:plant` and `check:conformance` in a
   session with a checkout if their counts and runtimes are wanted. They are not
   measured here.
3. This repo's CLAUDE.md says mainline only, no branches or PRs. This job asked
   for one PR, which overrides it for this change.
