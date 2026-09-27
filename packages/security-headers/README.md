# @dustinedwards/security-headers

The standard security header set for the portfolio's sites, the Content-Security-Policy helpers, and
the check that proves a site's responses carry them. Ruled by Dustin on 2026-09-27
(capsid/decisions.md, "shared functions across the sites", point 5); design in
capsid/research/design-shared-functions.md. dustinedwards.info adopts it first; foxing and txasm
adopt it in their own jobs.

No dependencies, plain ES modules with JSDoc types, Web Crypto only: it runs unchanged in a Worker and
in Node 20+.

## What it gives a site

| Export | What it does |
| --- | --- |
| `STANDARD_SECURITY_HEADERS` | The floor every site sends: HSTS (one year), `nosniff`, a strict Referrer-Policy, `X-Frame-Options: DENY`, and a Permissions-Policy denying camera, microphone, geolocation and payment. |
| `applyHeaderSet(headers, set?, { overwrite? })` | Stamps a set onto a Headers object. `overwrite: true` (default) makes the set authoritative; `false` keeps a value a route already set. |
| `generateNonce()` | A fresh per-request nonce, for responses that are never shared-cached. |
| `scriptHash(text)` | The `sha256-...` source for an inline script, for responses that are edge-cached and so must not carry a nonce. |
| `buildPolicy(directives)` | The policy string from a list of directives, in the order given. |
| `checkSecurityHeaders(headers, { standard?, csp? })` | Grades a real response. Returns one result per check. |
| `bin/check-security-headers.mjs <url>...` | The same check against live URLs, for CI. Exits 1 on a failure, 2 if a URL cannot be fetched. |

## What the check requires

- Every header in the standard, at least as strict: HSTS at least a year, a strict Referrer-Policy,
  framing refused, every standard feature denied. A site's own extra headers are not graded.
- An **enforced** Content-Security-Policy. A Report-Only policy alone fails: it blocks nothing.
- A script source list (`script-src`, or `default-src`) with no `'unsafe-inline'`, no
  `'unsafe-eval'`, and no `*` or bare scheme.
- `object-src 'none'`, `base-uri 'none'` or `'self'`, and `frame-ancestors` set.
- A report sink: `report-uri` or `report-to`. A policy nobody hears from hides the page it breaks.

`style-src 'unsafe-inline'` is allowed: several sites need inline style attributes, and styles cannot
run code.

## Adopting it

1. Apply the standard set, plus your own extras, on every response your Worker returns, including
   redirects (rebuild an immutable Response first).
2. Build your policy with `buildPolicy`, nonce or hash as above.
3. In CI, run `checkSecurityHeaders` on your rendered responses (a Worker test), or the CLI against a
   preview origin. See dustinedwards.info's `test/worker/public-csp.test.ts` and
   `test/security-headers-package.test.mjs`.

## Where it came from

- **dustinedwards.info** (`workers/csp.mjs`, `workers/app.ts`, `scripts/lib/headers/`): the hash
  source (`scriptHash`), the policy join, the rule that edge-cached pages carry no nonce, the
  Permissions-Policy floor, and the checks themselves (enforced not report-only, the script source
  rules, `object-src`, `base-uri`, `frame-ancestors`, a report sink).
- **foxhound** (`app/lib/http/security-headers.ts`): `generateNonce`, applying a set without
  overwriting a route's own value, and the five-header floor it shares with dustinedwards.info.
