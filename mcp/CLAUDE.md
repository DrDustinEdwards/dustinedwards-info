# CLAUDE.md - mcp/ (Dustin Edwards Admin)

The site's CLAUDE.md and `capsid/conventions.md` govern this folder too; this
file holds only what is true of the MCP server. The design is
`capsid/research/design-mcp-servers.md` section 6.

## What this is

Dustin Edwards Admin: the admin MCP server for dustinedwards.info, a wrapper over
the site's operator API. Its own Cloudflare Worker, `dustinedwards-mcp`, at
https://admin-mcp.dustinedwards.info/mcp. It moved here from the
DrDustinEdwards/dustinedwards-mcp repo by `git subtree add` (history kept) on
2026-10-10: an app's MCP lives in the app's repo. It keeps the Worker name, so its secrets, KV namespaces and Durable Object stayed
where they were. Own package.json and lockfile, because its SDK and OAuth
versions are not the site's. Node is the site's `.nvmrc`.

The tools are listed in `src/tools.ts`, `dei_` prefixed, each a whole job: check
the site, repair drift, review and decide mentions, upload and back up media, read
a registry, refresh citations, keep a procedure. NO POST TOOLS: Carrel owns all
writing on every site, so nothing here
writes a post, a page, the CV or a publication.

## How it lands and deploys

By pull request, like everything in this repo, with the `mcp/` CI job. Only
`npm run ship:mcp` from the repository root deploys it (site rule 16): it refuses
without green CI for the exact sha, runs this folder's gates, deploys, and
proves `/health` and the `server/discover` call on the live address.
`.claude/hooks/no-direct-deploy.sh` refuses a bare `wrangler deploy` here.

## The law, and it is not negotiable

NO policy, NO gates, NO second write path. Every tool call becomes authenticated
HTTP to `POST /api/operator` on the dustinedwards Worker, over the `SITE` service
binding. If this Worker vanished, nothing about what is allowed would change.

Concretely, things that must never appear in this folder:

- An import from the site app, with ONE named exception: `src/tools.ts` imports
  the watchdog's pure repair plan, `app/lib/health/repair.mjs`, because which
  repair converges which drift is a fact stored once. check:wrapper asserts that
  module stays pure and that nothing else is imported.
- A D1, R2, KV-for-app-data, or AI binding, or a service binding other than
  `SITE`. A `GITHUB_TOKEN`. Anything that could reach the publish machinery
  other than the operator API.
- A gate, a validation rule, or a policy decision that duplicates one the API
  already makes. Schema validation on tool INPUT is allowed and wanted, because
  it fails a bad call before a round trip; re-implementing the first-publish rule
  is not, because then there are two of it.
- A tool the operator API does not offer.

`npm run check:wrapper` asserts this mechanically and must fail in both
directions. Plant a violation and watch it fail before trusting it (portfolio
rule 3.1). It reads the
operator API's tool list from `app/lib/operator/descriptors.ts`, so a tool the
API does not offer fails here.

## The security floor (ruling mcp-2026-10-10, rules 12 and 13)

- **Ownership on every call (12.1).** Every id names a record whose owner is the
  site's one administrator, so `authorizeCall` re-proves the caller is that
  administrator (or a configured agent) on every tool call, in `invokeTool`.
  `test/tools.test.ts` fails when the check is removed.
- **Audience (12.2).** The provider's `resourceMetadata.resource` is
  `PUBLIC_ORIGIN/mcp`, which pins every grant and token to this server. No token
  passthrough: the API leg is `OPERATOR_TOKEN`.
- **Least scope (12.3).** `dei.read` always; `dei.write` only when ticked on the
  consent page (or, for an agent key, named in `AGENT_WRITE`).
- **Append-only log (12.4).** `ToolCallLog`, a SQLite Durable Object with one
  INSERT and nothing else. Read it in the dashboard's Durable Object data view.
- **Outside content is data (12.5).** Mention text is marked so in the tool output.
- **Risky actions (12.6).** Mention delete stays in the admin screen.
- **Tightened DCR (13).** `/register` is rate limited per address and refuses any
  redirect URI not listed exactly in `DCR_REDIRECT_URIS`. The consent POST is
  bound to the consent page by a SameSite=Strict token.

## Two legs, two credentials

- CLIENT LEG (agent to wrapper): identifies WHO is operating.
- API LEG (wrapper to app): `OPERATOR_TOKEN` bearer, the same token any raw
  caller would present. Identifies WHAT the wrapper may do.

Never the same value, never conflated in docs or error messages. A client-leg
failure must read differently from an API refusal.

## Era targeting is a MEASUREMENT, never an assumption

`2026-07-28` is the primary and design-center era. Prior-era support lives in
exactly ONE seam, `src/legacy-era.ts`, carrying its removal condition in a
comment.

Do not change the targeted era from a release note, an announcement, or a
changelog. Re-run `scripts/probe-report.mjs` against a real client and change it
from the capture. The probe exists for this and stays in the repo.

Current captures: `mcp/README.md`, Era targeting.

## Client leg is settled, and the two traps in it

OAuth 2.1 resource server per the spec, because claude.ai was measured completing
the whole flow: RFC 9728, RFC 8414, RFC 8707 audience binding, PKCE S256. No
bearer fallback and no dated debt; the standard only permits those where the
measured client CANNOT complete the flow.

- **CIMD AND DCR, both, each on a measurement.** claude.ai (2026-07-30) sends
  `client_id` as the URL `https://claude.ai/oauth/mcp-oauth-client-metadata` and
  never calls `/register`, so `clientIdMetadataDocumentEnabled: true` plus the
  `global_fetch_strictly_public` compatibility flag stay. Grok Build 1.0.13
  (2026-09-07, rmcp) CANNOT do CIMD and requires RFC 7591 dynamic registration;
  without a `registration_endpoint` it stops at "OAuth authorization required"
  and never opens a browser, so `clientRegistrationEndpoint: "/register"` exists
  for it. Registration mints an identity only: a grant still goes through the GitHub
  consent flow and `isAdminUser`, so DCR widens who may ask, never who is let in.
  Both paths are pinned by `check:wrapper` and by the conformance gate's
  authorization section, in both directions.
- **PRM must answer the PATH-SCOPED route.** claude.ai requests
  `/.well-known/oauth-protected-resource/mcp` BEFORE the bare
  `/.well-known/oauth-protected-resource`. A server handling only the bare form
  misses its first request.

## Errors are relayed VERBATIM

The API's refusal prose is returned unchanged: never summarized, wrapped, or
softened. A `403 first-publish-requires-admin` must reach the agent as the API
wrote it, because the agent's next move depends on reading it as policy rather
than as a transport error.

## Commands

- `npm run dev`
- deploy: `npm run ship:mcp` from the repository root, never `wrangler deploy`
- `npm run typecheck` (`wrangler types -c wrangler.jsonc && tsc -b`)
- `npm run build` (`wrangler deploy --dry-run`). NOT the same check as typecheck.
- `npm test` unit tests against a fake site
- `npm run check:wrapper` gate over the no-policy law
- `npm run check:wrapper:plant` proves that gate actually fails (the cases are in
  `scripts/plant-violations.sh`)
- `npm run check:conformance` official MCP suite, per era, plus the
  authorization server against the real deploy entry. A BASELINE, not a sweep.
- `node scripts/probe-report.mjs` read the client measurement
- `node scripts/probe-report.mjs --reset` clear captures before a real measurement

Check a gate's exit code DIRECTLY, never through a pipe. `tail` masks it and has
already reported exit 0 on a failing run elsewhere in this portfolio.

## The probe has no control plane, deliberately

Its capture log describes a client's auth behaviour, so it is not reachable over
HTTP. Read it with `wrangler kv` through the Cloudflare API. This also means
there is no probe credential to exist or leak. Do not add an HTTP control
endpoint back.

## Dependencies and `npm audit`

`agents` pins `@modelcontextprotocol/sdk` and `@modelcontextprotocol/client` exactly, so
`overrides` raise them to patched versions; drop the overrides when `agents` pins patched
ones.

Install scripts: core-js-pure (a funding banner), esbuild and workerd (both only link the
platform binary a bundled optional package already carries) are denied in `allowScripts`.
typecheck, check:wrapper, test, build and check:conformance all pass with every install
script off, so none is approved. Add one to `allowScripts` only when a gate shows it needed.

## Not advertised

Absent from `llms.txt`, the sitemap and every public affordance. An authenticated
operator surface is not a public affordance.

## Gate discipline learned in this repo's first session

- **Typecheck is not a build.** Two commits shipped with runtime deps absent from
  `package.json` while `npx tsc -b` stayed green, because `node_modules` still had
  them. Run `npm run build`.
- **A gate never observed failing has not been verified, and that includes the
  HARNESS.** The first plant harness reverted with `git checkout -- .`, which does
  not touch untracked files, so residue accumulated and every result after the
  first was contaminated. It also destroyed uncommitted work. `plant-violations.sh`
  snapshots and restores the exact files it edits and re-checks the baseline
  between plants.
- **Commit before running anything that reverts.** A revert touches what it was
  told to, and uncommitted work is not in that list.
- **Two strippers, and picking the wrong one silently disables an assertion.**
  `withoutComments` keeps string literals and is for content; `codeOnly` removes
  them and is for code. Four planted violations walked through a gate that used the
  wrong one.
- **Check exit codes directly, never through a pipe**, and beware the reverse: on
  Windows the conformance suite aborts on a libuv `UV_HANDLE_CLOSING` assertion
  AFTER printing results, so a passing scenario exits non-zero. Judge the parsed
  count and surface the crash.
- **Write a commit message through a file.** Backticks inside `git commit -m "..."`
  are command-substituted by bash and silently delete words, so write the message
  with an editor tool and commit with `git commit -F <file>`.
- **Post-deploy readings are unstable.** A `POST` returned Cloudflare **error 1104**
  while `/health` was already 200. Same trap core.md records as 404s, different
  code. Poll until stable.
