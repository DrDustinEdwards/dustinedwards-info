# CUTOVER.md

Taking `dustinedwards.info` off the legacy WordPress origin and onto this Worker.

**This document exists because the checklist was nearly lost.** It lived inside
current-state paragraphs in a Capsid document, and the 2026-08-21 consolidation
that cut that document by 87 percent deleted most of it. What survived did so in
version history. A checklist that is only reachable by knowing which version to
ask for is not a checklist, and Capsid cannot be gated, so it is here.

`check:invariants` section 18 holds this file against the code: every item below
must still be named, and the `SITE_ORIGIN` line must match what `app/lib/seo.ts`
actually says. Change the origin and this document goes red until it follows.

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

## 1. Before the toggle, in this order

**1.1 Disable or delete the existing Web Analytics site's `auto_install`.**
This is the landmine. The site was created 2025-10-20 and is bound to the ZONE
ruleset, so the moment the proxy is on it may inject a **nonce-less beacon
straight into an ENFORCED CSP**. The CSP has blocked rather than reported since
`20c27d6` on 2026-08-17, so the failure mode is a broken page, not a report.

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

**3.2 `BETTER_AUTH_URL`.** A secret, so `wrangler secret put`. Better Auth pins
to it, which is also why no admin session can be minted locally.

**3.3 The Google OAuth redirect URI.** Added in the Google Cloud console. Login
breaks until this lands, and it breaks for the only account that can sign in.

**3.4 AI Search Authorized hosts**, on the Public URL. Ask stops answering
otherwise.

**3.5 `allowedHostnames` on the operator path.** The MCP wrapper and the
operator API both ride it.

**3.6 `content/llms.txt`.** Its contact URL is bound to `SITE_ORIGIN` in both
directions by `check:llms`, so that gate goes RED between 3.1 and this step.
**That is by design and is the reminder**, not a defect to work around.

**3.7 `103 Early Hints` becomes available.** A capability that arrives with the
proxy, not a required step.

**3.8 HTML caching is a DECISION, not a default.** Cache Rules become reachable
on a proxied zone, which is the only way origin `Vary` is honoured here. See
`dustinedwards/workers-cache-vary.md` for what the Workers cache key does and
does not include.

**3.9 `workflow-mainline.md` SUNSETS.** Mainline-only was ratified for this repo
until the DNS cutover and no longer. The PR workflow resumes, and `CLAUDE.md`'s
workflow section becomes wrong on that day.
