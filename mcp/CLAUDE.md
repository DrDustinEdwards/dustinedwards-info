# CLAUDE.md - mcp/ (Dustin Edwards Admin)

The site's CLAUDE.md governs this folder too; this
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
