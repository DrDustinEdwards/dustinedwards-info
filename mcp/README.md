# Dustin Edwards Admin (mcp/)

The admin MCP server for [dustinedwards.info](https://dustinedwards.info): a
wrapper over the site's operator API that **contains no policy of its own**. Its
own Worker, `dustinedwards-admin-mcp`, at `https://admin-mcp.dustinedwards.info/mcp`.

Its history before it moved into this repository is in `git log -- mcp/`.
Governed by Capsid `capsid/rulings/mcp-2026-10-10.md`; the design is
`capsid/research/design-mcp-servers.md` section 6.

## Tools

Ten, each a whole job. Every step of each is an authenticated request to
`POST /api/operator` over the `SITE` service binding; the API owns every rule.
Read tools need `dei.read`; the others need `dei.write`, ticked on the consent page.

| Tool | Does | Hints (read, destructive, idempotent, open world) |
|---|---|---|
| `dei_check_site` | `sync_status` plus `/api/health`, with the failing checks named | read, no, yes, no |
| `dei_repair_drift` | the watchdog's repair plan: each failing drift check's sync, then a re-read of `/api/health` | write, no, yes, no |
| `dei_review_mentions` | the webmention queue, a page at a time, stranger text marked as data | read, no, yes, no |
| `dei_decide_mention` | approve or reject one mention (delete stays in the admin screen) | write, no, yes, no |
| `dei_upload_media` | one image into the media bucket, content-addressed | write, no, yes, yes |
| `dei_backup_media` | copy every media object without a twin into the backup bucket | write, no, yes, no |
| `dei_read_registry` | list or read pages, llms, cv, dictionary, roster, phages, registry, publications | read, no, yes, no |
| `dei_refresh_citations` | fresh OpenAlex citation counts, all or by DOI | write, no, yes, yes |
| `dei_check_publications` | DOIs on ORCID or Crossref the site lacks, and papers ORCID lacks | read, no, yes, yes |
| `dei_manage_procedure` | list, get or save a lab procedure; first publication is admin-only | write, no, no, no |

No post tools: Carrel owns all writing on every site (rule 11). Lists page at 25
by default, at most 100, with `has_more` and `next_offset`.

## Security floor (rules 12 and 13)

- Every tool call goes through `invokeTool`: the caller is re-proved to be the
  administrator (or a configured agent) and to hold the tool's scope, then an
  append-only `ToolCallLog` row is written before and after the call. A call that
  cannot be logged does not run.
- Access tokens are bound to `PUBLIC_ORIGIN/mcp` (RFC 8707); a token for any
  other resource is refused. The API leg is `OPERATOR_TOKEN`, never the client's token.
- CIMD for Claude, Claude Code and ChatGPT. DCR at `/register` for Grok and
  Gemini, tightened: 5 registrations per minute per address, and every redirect
  URI must be listed exactly in `DCR_REDIRECT_URIS`. A refused registration's
  Worker log line `registration-refused` names the URI it asked for; add it to
  `mcp/wrangler.jsonc.example` by PR.
- Agent keys (`AGENT_KEY_<NAME>`) read only unless `AGENT_WRITE` names them. It names `grok`, whose key is its only door.
- Sign-in is Cloudflare Access for SaaS (OIDC), the same login as Capsid,
  Carrel and Foxing Admin, with the redirect URL `PUBLIC_ORIGIN/callback`.

## Deploy

Only `npm run ship:mcp` from the repository root deploys this Worker. It needs
`mcp/wrangler.jsonc` (gitignored: it carries the real `OAUTH_KV` and `PROBE_KV`
ids; fill the example's ids from `npx wrangler kv namespace list`). It refuses
without green CI for the exact sha, runs typecheck, check:wrapper, the tests and
the build, deploys, and then proves `/health` and a `server/discover` call on
`https://admin-mcp.dustinedwards.info`.

## The law

The wrapper contains **no policy, no gates, and no second write path.** Every
tool call becomes an authenticated HTTP request to `POST /api/operator` on the
dustinedwards Worker, where all rules live. If this Worker vanished, nothing
about what is allowed would change.

```
  AI agent
     |  client leg: identifies WHO is operating
     v
  dustinedwards-admin-mcp  (this Worker)       no D1, no R2, no GitHub token
     |  API leg: OPERATOR_TOKEN, identifies WHAT it may do
     v
  POST /api/operator  on the dustinedwards Worker
```

It is a **separate Worker** for a structural reason: the only path from here to
the publish machinery *is* the API. Mounted as a route on the app Worker, the
cheap path would be an in-process call that skips operator authentication and
the rate limiter. Here that call is unreachable.

The contract between wrapper and app is the API's documented payloads, never
shared code. This Worker validates responses at its edge like the outside caller
it is.

The two legs are never the same credential. A client-leg identity failure must
read differently from the API refusing an operation, because an agent that
conflates them cannot correct itself.

## Era targeting

Measured with `scripts/probe-report.mjs`. Claude Code, claude.ai and Grok Build
were all measured opening as **legacy-era** clients (`initialize`, no
`Mcp-Method`/`Mcp-Name`). So `2026-07-28` is the design-center era, and
prior-era support lives in exactly one seam: the call in `src/mcp-handler.ts`
that hands site-runtime's `routeMcpEra` the SDK's `isLegacyRequest`, carrying its
own removal condition: it goes when the probe shows the target clients opening
with `server/discover`.

## Client-leg auth

The spec's OAuth 2.1 resource server story, with no bearer fallback for clients
that can complete it. claude.ai requests the **path-scoped**
`/.well-known/oauth-protected-resource/mcp` first, uses CIMD (its `client_id` is
a URL) and never calls `/register`. Grok Build cannot do CIMD and needs RFC 7591
registration, so the server carries both: `clientIdMetadataDocumentEnabled: true`
(which needs the `global_fetch_strictly_public` flag) and
`clientRegistrationEndpoint: "/register"`. Registration only mints a client
identity; a grant still needs the consent page and the Access sign-in, and
`isAdminUser` admits exactly the configured administrator.

## Agent keys: the door for clients that cannot complete OAuth

Ruling 37. Grok Build takes a well-formed 401 and never starts the discovery
walk, so it reaches this server by key.

**One secret per agent, and the secret's NAME is the principal.**
`AGENT_KEY_GROK` is the key for the principal `grok`. The principal is never
carried in the request, so a caller can prove it holds a key and can never
choose what it is called.

**It buys operator rights and nothing else.** Every tool call still leaves as
one request to the operator API carrying `OPERATOR_TOKEN`. First publication is
refused there for that actor, so **an agent still cannot publish a post for the
first time**.

**It is inert until a secret exists.** With no `AGENT_KEY_*` set, every request
falls through to the OAuth provider.

Generate the key with a real CSPRNG, never by hand, and never paste it into a
chat. Then `npx wrangler secret put AGENT_KEY_GROK` (the name after `AGENT_KEY_`
becomes the principal, lower-cased). The agent sends it as a bearer token
against `/mcp`; for Grok Build, in `~/.grok/config.toml`:

```toml
[[mcp_servers]]
name = "dustinedwards"
type = "http"
url = "https://admin-mcp.dustinedwards.info/mcp"

[mcp_servers.headers]
Authorization = "Bearer PASTE_THE_KEY_HERE"
```

Rotation is `wrangler secret put` again with the same name. Revocation is
`npx wrangler secret delete AGENT_KEY_GROK`, effective on the next request.

Every accepted agent request writes one line,
`{"audit":"agent-key-accepted","principal":"grok","method":"POST","rights":"operator"}`.
No key, key length or Authorization header reaches a log line, and
`check:wrapper` asserts that. The operator API downstream records the same
token label for every agent and for the human operator, so this Worker's log is
the only place that says WHICH agent acted.

## Gates

| Gate | Proves |
|---|---|
| `npm run typecheck` | `wrangler types -c wrangler.jsonc && tsc -b` |
| `npm run build` | a dry-run bundle; typecheck is not a build (a missing runtime dependency passes typecheck when `node_modules` still holds it) |
| `npm test` | the tools, the request layer, ownership, scope and the log against a fake site |
| `npm run check:wrapper` | the no-policy law and the security floor, mechanically |
| `npm run check:wrapper:plant` | that `check:wrapper` actually fails, one planted violation at a time |
| `npm run check:conformance` | the official suite against the real protocol layer, per era, plus the authorization server against the real deploy entry |

`check:conformance` runs against `test/conformance-entry.ts`, which mounts the
real handler and tools with only the client leg and the limiter removed. It is a
**baseline, not a clean sweep**: `server-stateless` scores 24/28 because
`@modelcontextprotocol/server` does not implement
`MissingRequiredClientCapabilityError` (-32021). The gate fails on a regression
**and** on an improvement, so the baseline is tightened when the SDK fixes it.

## Scope exclusions

Considered and deliberately excluded until a measured need exists.

- **MCP Apps** (SEP-1865). A publish wrapper has no UI to host.
- **Tasks** (SEP-2663). The longest operation here is one commit.
- **MRTR / `input_required`** (SEP-2322). Policy decisions belong to the API and
  to the human.
- **Resources and Prompts primitives.** A second surface with no second caller.
- **Response caching, retries, multi-project multiplexing.**
- **Any tool the operator API does not already offer.** That is a policy
  decision, and policy does not live here.

## Operating the probe

The probe has **no HTTP control plane, deliberately**: its capture log should not
be reachable from the internet. Read it through the Cloudflare API:

```sh
node scripts/probe-report.mjs               # the analyzed report
node scripts/probe-report.mjs --phase auth  # force the OAuth discovery walk
node scripts/probe-report.mjs --reset       # clear captures before a real measurement
```

Phase `open` captures the protocol opening; phase `auth` returns `401` and
captures the OAuth discovery walk.

## Not advertised

This endpoint is absent from `llms.txt`, the sitemap, and every public affordance
on dustinedwards.info. An authenticated operator surface is not a public
affordance.
