# dustinedwards-mcp baseline (job_eb5564111e61)

> Superseded in part by job_997c4b5d0f37 (2026-10-10): the repo now has a
> node:test suite and a measured Stryker score. See "Unit tests and Stryker"
> at the end. The sections before it are the original audit, unchanged.

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

## Unit tests and Stryker (job_997c4b5d0f37)

Measured 2026-10-10 in a checkout, Node 22.22.0, by running the commands.

### The suite

`npm test` runs `node --experimental-transform-types --import
./test/resolve-ts.mjs --test "test/**/*.test.ts"`. The script is the one
package.json change. `test/resolve-ts.mjs` lets Node load `src/` as written,
because the source imports siblings without an extension. CI runs `npm test`
after `check:wrapper`.

| File | Tests | What it pins |
|------|-------|--------------|
| `test/api-client.test.ts` | 15 | `callOperator`: POST of `{ tool, args }` to `OPERATOR_API_URL`, the bearer, the token never logged or echoed, the 32-character floor, every `ApiLegError` kind and message, data and refusals returned unchanged |
| `test/tools.test.ts` | 82 | The eleven tools by name and annotation, each tool's exact operator request, 403/409/422 refusals relayed in the API's words with policy, field, line and validator messages, wrapper failures worded apart from refusals, input schemas, and that the wrapper forwards what the API must judge (draft:false, wide dashes, mention delete, both or neither upload source) |
| `test/mcp-handler.test.ts` | 8 | `handleMcp` end to end at 2025-11-25 and 2026-07-28: initialize, tools/list, tools/call to one operator request, the first-publish refusal as a tool result, bad input and unknown tools making no request, no token in any response |

105 tests, about 1 s. Every one runs against a fake operator API that replaces
`fetch` (`test/fake-operator.ts`), so nothing touches the network.

### Each test seen failing

107 breaks were planted in `src/` one at a time, the suite run, and the file
restored byte for byte with the baseline re-checked green between plants. All
105 tests failed against at least one plant. 106 plants were caught. One
survived: routing every request to the legacy shim, which is close to
equivalent, because the shim is `legacy: "stateless"` and answers both eras.

### Stryker 9.6.1

Run with `npm install --no-save @stryker-mutator/core@9.6.1`, the command
runner (`npm test`), `mutate: src/**/*.ts`, coverage analysis off. 985 mutants,
about 7 minutes at concurrency 4. No timeouts, no errors.

| File | Killed / mutants | Score |
|------|------------------|-------|
| `src/api-client.ts` | 60 / 61 | 98.36% |
| `src/tools.ts` | 232 / 414 | 56.04% |
| `src/mcp-handler.ts` | 11 / 22 | 50.00% |
| `src/legacy-era.ts` | 2 / 3 | 66.67% |
| `src/auth.ts` | 0 / 74 | 0% |
| `src/github-handler.ts` | 0 / 149 | 0% |
| `src/index.ts` | 0 / 60 | 0% |
| `src/rate-limit.ts` | 0 / 37 | 0% |
| `src/probe.ts` | 0 / 165 | 0% |
| **All of src** | **305 / 985** | **30.96%** |

The three files this job covers (api-client, tools, mcp-handler) score
303 / 497, 60.97%. A first run before the annotation, slug anchor and
modern-era tests scored 28.32% overall.

What survives in the covered files:

- `tools.ts`: 180 of 182 survivors are string literals in tool descriptions
  and `.describe()` text. The policy names and the "enforced by the API"
  sentences are pinned; the rest of the prose is not, on purpose.
- `tools.ts`: the 2 others turn `args.isNew !== undefined` into `true`. That
  forwards `isNew: undefined`, which `JSON.stringify` drops, so the bytes on the
  wire are identical. Equivalent.
- `api-client.ts`: one sub-condition of the payload shape check
  (`typeof parsed !== "object"` to `false`). A JSON number or string then fails
  the next check with the same error. Equivalent.
- `mcp-handler.ts`: 9 string literals (server title, version, instructions
  prose) and the legacy-routing and route-option mutants described above.
- `legacy-era.ts`: `{ route, legacy: "stateless" }` to `{}`, which is the
  library default.

`auth.ts`, `github-handler.ts`, `index.ts`, `rate-limit.ts` and `probe.ts`
were out of scope for this job and are still untested. The order given under
"For the seat" still holds for them.

No test found a bug in `src/`, so no source file changed.
