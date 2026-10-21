# CLAUDE.md - mcp/ (Dustin Edwards Admin)

The site's CLAUDE.md governs this folder too; this
file holds only what is true of the MCP server. The design is
`capsid/research/design-mcp-servers.md` section 6.

## What this is

Dustin Edwards Admin: the admin MCP server for dustinedwards.info, a wrapper over
the site's operator API. Its own Cloudflare Worker, `dustinedwards-mcp`, at
https://admin-mcp.dustinedwards.info/mcp. Own package.json and lockfile, because
its SDK and OAuth versions are not the site's. Node is the site's `.nvmrc`.

The tools are listed in `src/tools.ts`, `dei_` prefixed, each a whole job: check
the site, repair drift, review and decide mentions, upload and back up media, read
a registry, refresh citations, keep a procedure.

## Commands

Deploy is `npm run ship:mcp` from the repository root, never `wrangler deploy`.
`package.json` lists the rest; README.md says what each gate proves.
