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
a registry, refresh citations, keep a procedure.

## The no-policy law is a gate

`npm run check:wrapper` asserts the no-policy law mechanically and must fail in
both directions. Plant a violation and watch it fail before trusting it
(portfolio rule 3.1).

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

## Not advertised

Absent from `llms.txt`, the sitemap and every public affordance. An authenticated
operator surface is not a public affordance.

## Gate discipline learned in this repo's first session

- **Commit before running anything that reverts.** A revert touches what it was
  told to, and uncommitted work is not in that list.
- **Two strippers, and picking the wrong one silently disables an assertion.**
  `withoutComments` keeps string literals and is for content; `codeOnly` removes
  them and is for code. Four planted violations walked through a gate that used the
  wrong one.
