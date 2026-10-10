# mcp/emergency: putting the old admin MCP back

The admin MCP exactly as it was live before the move (dustinedwards-mcp main at
`89fc984`), plus one addition: it exports the `ToolCallLog` Durable Object class
and keeps its binding and migration `v2`. Without them Cloudflare refuses the
deploy, because the cutover registered that class, and `wrangler rollback` cannot
cross a class change
([Cloudflare: Rollbacks, Bindings](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)).
The class is re-exported from `../src/audit-log.ts`, so its stored rows survive.

It goes once a sign-in on https://admin-mcp.dustinedwards.info has been verified
from every client you use, and before the dustinedwards-mcp repository is deleted.

## What it puts back

- The eleven old tools, post tools included, on
  `https://dustinedwards-mcp.dustin-edwards.workers.dev/mcp`.
- The old sign-in: no token audience pinned, so tokens the old connectors still
  hold work again (refresh tokens last 30 days, in the same `OAUTH_KV`).
- The admin-mcp Custom Domain stays attached and serves the same old code, so a
  second try at the cutover recreates nothing.

## How, in order

1. `mcp/emergency/wrangler.jsonc` must exist: copy `wrangler.jsonc.example` beside
   it and put in the same two KV ids `mcp/wrangler.jsonc` holds.
2. From the repository root, on a commit CI passed: `npm run ship:mcp-emergency`.
   It runs ship's preflight, requires green CI for the exact sha, runs the MCP
   tests and this kit's typecheck and build, deploys, waits for five 200s from
   `/health` on the workers.dev address, and checks discovery there.
3. GitHub OAuth App: set the Authorization callback URL back to
   `https://dustinedwards-mcp.dustin-edwards.workers.dev/callback`.
4. Connectors: point them back at
   `https://dustinedwards-mcp.dustin-edwards.workers.dev/mcp`. A connector that was
   never removed may simply work again; one that was removed is added back and
   signs in.

## Gates

`npm run emergency:typecheck` and `npm run emergency:build` in `mcp/`, in CI's mcp
job. `mcp/test/emergency.test.ts` reads both configs and fails when the kit
stops carrying every Durable Object class, migration and KV binding the main
config has, so a migration added to `mcp/` later fails until the kit carries it.
