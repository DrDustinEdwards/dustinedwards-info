# CUTOVER.md

Taking `dustinedwards.info` off the legacy WordPress origin and onto this Worker.

**This document exists because the checklist was nearly lost.** It lived inside
current-state paragraphs in a Capsid document, and the 2026-08-21 consolidation
that cut that document by 87 percent deleted most of it. What survived did so in
version history. A checklist that is only reachable by knowing which version to
ask for is not a checklist, and Capsid cannot be gated, so it is here.

No gate holds this file against the code any more (ruling 150): when the origin
changes, re-read every item below against `app/lib/seo.ts` by hand.

---

## The premise, corrected by measurement 2026-08-12

**This is a PROXY TOGGLE, not zone onboarding.** An earlier reading had it as a
migration onto Cloudflare, which would have been days of work and a different
plan entirely.

`dustinedwards.info` is an ACTIVE FULL ZONE on this account and has been
delegated to Cloudflare nameservers since **2017-03-20**. It is merely
**gray-clouded**: the `A` record points at `50.116.84.36` and both it and `www`
are `proxied: false`, with zero Worker routes. Every zone-gated capability
arrives the moment those records go orange.

---

## What was actually done (2026-10-03), which replaces sections 2 and the premise above

The domain moved from GoDaddy to Cloudflare Registrar (expires 2027-12-27). Dustin deleted the apex `A`
(`50.116.84.36`) and the `www` CNAME and attached `dustinedwards.info` and `www.dustinedwards.info` to this
Worker as **Custom Domains**, so there was no orange-clouding and no route pattern. The zone holds 18 records: 11
email (MX, SPF, DKIM, DMARC) and 7 proxied Workers (`abscissa`, `capsomer`, `carrel`, `carrel-mcp`, `enarratio`,
`mcp`, `portal`), with no other subdomain, so `includeSubDomains` (3.10) has nothing to break. Email forwarding was
tested after the move and works. The WordPress host keeps running; the way back is `docs/RUNBOOK.md`, "2b".

The domains are in `wrangler.jsonc.example` as `custom_domain` routes, because `wrangler deploy` overrides dashboard
routes with the config's. Deploying them needs the deploy token to carry Zone > Workers Routes > Write on
`dustinedwards.info`.

---

## 1. Before the toggle, in this order

**1.1 Cloudflare Web Analytics, resolved 2026-10-03 by allowing it, not by switching it off.**
This was written as a landmine: the site's Web Analytics setting is bound to the ZONE ruleset, so
the moment the proxy was on it injected a **nonce-less beacon into an ENFORCED CSP** and the policy
blocked it. Dustin's call was to keep the automatic injection and allow the one file
(`APPROVED_SCRIPTS` in `workers/csp.mjs`; `strict-dynamic` was dropped for it, because browsers ignore
every host source while it is present, and the beacon's `integrity` value moves whenever Cloudflare
ships a new build, so a hash would silently expire). Its report goes to the site's own `/cdn-cgi/rum`,
which `connect-src 'self'` already allowed. Adding any other outside script is the same one-line
approval, and `check:headers` holds the list.

**1.2 Enumerate the legacy WordPress pages**, so nothing that currently ranks
disappears without a decision. `/phage-discovery/` specifically needs NO
redirect: the Worker takes that path over, which is why the roster lives at that
URL rather than at a tidier one.

## 2. At the toggle

Orange-cloud the `A` record and `www`, then add the Worker route.

## 3. After the toggle

**3.1 `SITE_ORIGIN` in `app/lib/seo.ts`.** It is currently
`https://dustinedwards.dustin-edwards.workers.dev`. It is stated ONCE and
everything else derives from it, including `DEFAULT_OG_IMAGE`, every canonical
and every social URL.

**3.2 `BETTER_AUTH_URL`.** No longer applicable: Better Auth was removed, and the secret with it.
Admin sign-in is Cloudflare Access (docs/RUNBOOK.md 5b).

**3.3 The Google OAuth redirect URI.** No longer applicable: there is no Google sign-in.

**3.4 AI Search Authorized hosts**, on the Public URL. Ask stops answering
otherwise.

**3.5 `allowedHostnames` on the MCP wrapper.** The wrapper is a separate
deployment and that setting is its own; it names the hosts it will call.

**CORRECTED 2026-08-28. This item used to say the operator API rode it too,
and this repository has no such setting at all**: `allowedHostnames` appears
nowhere in the tree except in this line. What the operator path actually
enforces is `originVerdict()` in `app/lib/origin.mjs`, which compares a present
`Origin` against THE REQUEST'S OWN origin rather than against a configured
list, and that is deliberate: pinning it to a constant would refuse every real
request from whichever host is not the constant, at the moment of the cutover,
when everything else is also moving. So the operator API needs NO edit at this
step, and the checklist saying it did was the kind of false work that turns a
cutover into a search.

**3.6 `content/llms.txt`.** Its contact URL is bound to `SITE_ORIGIN` in both
directions by `check:machine-readable`, so that gate goes RED between 3.1 and this step.
**That is by design and is the reminder**, not a defect to work around.

**3.7 `103 Early Hints` becomes available.** A capability that arrives with the
proxy, not a required step.

**3.8 HTML caching is a DECISION, not a default.** Cache Rules become reachable
on a proxied zone, which is the only way origin `Vary` is honored here. The
Workers cache key is entrypoint, path and query, Worker version and `ctx.props`;
`Vary` is not part of it (VERIFICATION.md).

**3.9 The mainline workflow SUNSETS.** Mainline-only was ratified for this repo
until the DNS cutover and no longer. The PR workflow resumes, and `CLAUDE.md`'s
workflow section becomes wrong on that day.

**3.10 `Strict-Transport-Security` gains `includeSubDomains`, and DOES NOT gain
`preload`.** **DONE 2026-10-03.** The subdomains are abscissa, capsomer,
carrel, carrel-mcp, enarratio, mcp, portal and www; each answers valid HTTPS (certificate verified). capsomer,
carrel-mcp and mcp also answer on plain HTTP without redirecting, which `includeSubDomains` makes moot for any
browser that has seen the header; Cloudflare's Always Use HTTPS would close it for everyone else. The header has shipped since 2026-08-06 as bare
`max-age=31536000`; `workers/app.ts` says to revisit it here and this is that
revisit, written down before the day rather than on it.

*Why it changes at all:* the current value omits `includeSubDomains` because
`dustinedwards.dustin-edwards.workers.dev` sits under a parent domain we do not
own, and asserting a transport policy across someone else's namespace is not
ours to do. At the apex that objection disappears, because we own
`dustinedwards.info` and every name under it.

*What `includeSubDomains` commits us to:* every subdomain of the apex becomes
HTTPS-only in any browser that has seen the header, for a year from its last
visit. **Confirm before adding it that no subdomain is serving plain HTTP**,
including anything left over from the legacy WordPress host. Reversal is
untidy but possible: drop the token and wait out `max-age`.

*Why NOT `preload`, decided rather than deferred:* preload is a ONE-WAY DOOR.
It is baked into browser binaries, removal takes months and a release cycle, and
there is no way to hurry it. It also requires `includeSubDomains` and a
`max-age` of at least a year, so it is strictly the larger commitment. Weigh
that against what it buys, which is protection on a visitor's very FIRST request
only, before any header has been seen. This site has no accounts, no payments and
one admin login; the `max-age` header already covers every request after the
first. Committing every future subdomain of a personal domain to HTTPS in
shipped browser binaries, permanently, is not a trade worth making for that.

Changing the value means editing `RATIFIED` in
`scripts/lib/headers/static-set-and-cache.mjs` in the same commit, by design:
the gate holds the ratified value against the source in both directions, and
`verify-live` section 14 then asserts it on the wire.
