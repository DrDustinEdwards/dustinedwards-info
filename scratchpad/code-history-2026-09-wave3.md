# Code comment history, 2026-09, wave 3

Extracted under ruling 115, from fda6ef1. Every comment block this wave
deleted or shortened is here VERBATIM, with the file and line it had at
fda6ef1, its tag, and why it moved. Wave 3 takes the 88 files under workers/ and app/.
The files keep only the short why and the contract; this is where the
measurements, dates and the story went.

## workers/app.ts

### workers/app.ts:15 (CONTRACT, shortened)

why the import sits here; the grounds stay on the predicate.

```ts
/*
 * The redirect map, imported here rather than inside the predicate. The
 * grounds are on `slug-redirect.mjs`: a bare JSON import is what compiles in
 * this repo and what Node ESM refuses, so the `.mjs` module that `node --test`
 * loads directly cannot do it and this `.ts` module can.
 */
```

### workers/app.ts:33 (CONTRACT, shortened)

why it is re-exported; the measurement goes to the history document.

```ts
// Re-exported so the runtime can find the class its binding names. The Ask
// spend ceiling lives in a Durable Object rather than KV because it has to be
// exact; the measurement that settled it is in the file.
```

### workers/app.ts:43 (WHY, shortened)

the prohibition and what it guards; the binding's history and the measured cache behaviour go to the history document.

```ts
/**
 * What a response gets when it never said what it wanted.
 *
 * `cache.enabled` in wrangler.jsonc puts Workers Cache in FRONT of this Worker,
 * and it was turned on for one reason: Images binding responses are not cached
 * by Cloudflare, so every `/media/<key>?w=` was paying a full decode and
 * re-encode. But the switch is top level, not per binding, and it governs every
 * response this Worker returns.
 *
 * The trap is that omitting Cache-Control is NOT opting out. Cloudflare applies
 * RFC 9111 heuristic freshness to a response carrying no Cache-Control and no
 * Expires, which caches a 200 for two hours and a 404 for three minutes. The
 * cache key is the path, the entrypoint and the Worker version; COOKIES ARE NOT
 * IN IT. Only three routes on this site export `headers`, so without this the
 * first authenticated /admin render would be stored and then served to anyone
 * who asked for that path for the next two hours. That is an auth bypass, not a
 * performance regression.
 *
 * So the default is the refusal, and a route opts IN by setting the header
 * itself. Fail closed, in one place: a route added later is uncached until
 * somebody decides otherwise, which is the same stance `publiclyVisible()` and
 * the Ask guards take. `private` alone would satisfy Cloudflare's edge;
 * `no-store` is added so intermediaries and the browser treat it the same way.
 */
```

### workers/app.ts:69 (CONTRACT, shortened)

what the key carries and the one prohibition; the deleted layer, its measurements, the rulings and the dates go to the history document.

```ts
/**
 * WHAT THE CACHE KEY IS, now that the platform can hold the whole dimension.
 *
 * ## THE LAYER THIS REPLACES, and the measurement that justified both
 *
 * Until 2026-09-05 this file ran a SECOND cache by hand, in `caches.default`,
 * keyed on a synthetic `__theme` and `__build` query parameter. It existed for
 * one reason, recorded here because the reason is the whole arc: the platform's
 * key was the entrypoint, path, query and Worker version, and nothing this
 * Worker could do put the theme into it. So public HTML declared `Vary: Cookie`,
 * every cookie-bearing reader was downgraded to `private, no-store`, and the
 * platform stored only the cookieless variant.
 *
 * The cost of that, measured on the wire 2026-08-26:
 *
 *     no cookie        HIT
 *     theme=dark       BYPASS   private, no-store
 *     _ga=1            BYPASS   private, no-store
 *
 * A reader who touched the theme toggle, which is the site's own feature, or
 * who carried any analytics cookie at all, paid a full origin render on every
 * click. On the throttled profile the audits used, 1.2 s against 2.0 s to first
 * paint on the home page. The hand-built layer bought that back for cookied
 * readers and could not be tiered, could not collapse concurrent requests, and
 * could not be purged: `caches.default` is per data centre, which is why
 * ruling 7 refused to invalidate on approve at all.
 *
 * ## WHAT CHANGED, 2026-09-05 (decisions vol 14, rulings 10, 11, 15 and 16)
 *
 * Workers Cache now takes `ctx.props` into the key, and a gateway entrypoint
 * can call a renderer entrypoint through `ctx.exports` with an explicit
 * `cf.cacheKey`. So the theme goes in the key the platform itself owns, and
 * every reader, cookied or not, gets the tiered, request-collapsing,
 * PURGEABLE cache. Cloudflare's own guidance is to prefer this over
 * `caches.default`, which does none of those three.
 *
 * **THE PLATFORM CACHE IS NOW THE ONLY CACHE.** `caches.default` is not used
 * anywhere in this file. If you are reading this because you are about to add a
 * second one, the thing to know is that the first one was deleted on purpose.
 *
 * ## THE DIMENSION IS IN BOTH HALVES OF THE KEY, and one of those is enough
 *
 * `ctx.props` is in the key by construction and cannot be dropped; a custom
 * `cf.cacheKey` REPLACES the path and query and is honoured only for
 * same-account loopback calls. So passing the theme in props alone would be
 * sufficient, and the docs say so in as many words. It goes in both because the
 * pair is what this function returns and what the tests read: a key string that
 * did not mention the theme would make the pure function's output a poor
 * description of the real key, and the next reader would have to know the props
 * rule to see the dimension at all.
 *
 * ## The old layer's own measurement is still what licenses this
 *
 * The theme is the ONLY thing read off the cookie. `check:browser` proves, on
 * every route that declares the shared cache headers, that a credentialed
 * reader gets byte-identical HTML and that the theme changes only the
 * `data-theme` attribute and the colour-scheme meta. If that stops being true
 * the gate goes red before this becomes a leak. That assertion did not change
 * with the cache under it, and it is the reason this key is allowed to be as
 * short as it is.
 */
```

### workers/app.ts:132 (CONTRACT, shortened)

what it returns, why pure, and where the dimension is added; the outlived detail goes to the history document.

```ts
/**
 * The cache key and the props for one request. PURE, so it can be tested.
 *
 * `URL` builds the key so the separator is handled: a path that already carries
 * a query string keys correctly instead of producing a second `?`. That detail
 * outlived the layer it was written for.
 *
 * THE THEME DIMENSION IS ADDED ONLY WHERE A DOCUMENT COULD CARRY IT. A GET, not
 * an admin path, not a request negotiating away from HTML. Admin responses are
 * `private, no-store` by their own declaration and are never stored whatever
 * the key says, so this is belt and braces there; the negotiated case is not,
 * and the grounds are on `negotiatesAwayFromHtml`.
 *
 * @param url     the request URL, already parsed by the caller
 * @param request the incoming request, for its method and Accept
 * @param theme   the resolved theme, one of the three `Theme` values
 */
```

### workers/app.ts:166 (WHY, shortened)

the five prohibitions, each in one line; the ratification dates, the sweep and the copied-snippet story go to the history document.

```ts
/**
 * Security headers, on EVERY response. Ratified 2026-08-06 (Phase A).
 *
 * Same shape and the same reason as `UNCACHED`: one constant, applied on the
 * way out, so a route added later is covered without anyone remembering. A
 * per-route opt-in would mean the next route ships bare, which is exactly how
 * the site ended up sending none of these at all.
 *
 * **PHASE A IS THE STATIC SET ONLY.** There is deliberately no
 * Content-Security-Policy here. A useful CSP needs a per-response nonce, which
 * has to exist BEFORE the render so `<Scripts nonce>` can stamp it, so it
 * cannot be a pure exit-path header the way these are. That is Phase B, its own
 * ruling and its own commit. It started in Report-Only and is enforced as of
 * 2026-08-17.
 *
 * Three of these look tightenable and are not. The reasoning is not recoverable
 * from the values, so it is written here rather than left for someone to
 * rediscover by breaking something:
 *
 * - **`Cross-Origin-Resource-Policy: cross-origin`, NOT `same-origin`.**
 *   `same-origin` would block social platforms from fetching `og:image` out of
 *   `/media/og/*`, and link previews would silently stop working. The failure
 *   is off-site and invisible from here, which is the worst combination. This
 *   is the one header where the restrictive value is the WRONG value.
 *
 * - **`Cross-Origin-Opener-Policy: same-origin-allow-popups`. KEPT ON PURPOSE.
 *   Do not tighten to `same-origin`.** Ruled 2026-08-06, after the question was
 *   settled rather than while it was open.
 *
 *   Better Auth's Google flow is the only cross-origin window interaction on
 *   the site, and it is a TOP-LEVEL REDIRECT, not a popup: `redirectPlugin` in
 *   `better-auth/dist/client/fetch-plugins.mjs` sets `window.location.href`,
 *   there is NO `window.open` anywhere in the client package, and `/login`
 *   renders a `<button type="button">` whose onClick calls `signIn.social`.
 *   Established by reading the SHIPPED CLIENT CODE, not by executing sign-in,
 *   which needs credentials.
 *
 *   So `same-origin` would work today, and it is still not what we want. The
 *   permissive notch is insurance against DEPENDENCY DRIFT: Better Auth can
 *   move to a popup on a version bump with nobody re-reading `redirectPlugin`,
 *   and the failure mode would be a silent sign-in break on the one door into
 *   the private plane. Tightening buys nothing measured here and costs that.
 *
 *   **This is a settled question, not an open one.** The earlier note here said
 *   the flow was unverified; that was true when it was written and is false
 *   now. Reopening it needs new evidence about the flow, not a fresh reading of
 *   the same code.
 *
 * - **No `includeSubDomains`, no `preload` on HSTS.** This is a `workers.dev`
 *   subdomain whose parent domain we do not own, and asserting a policy for it
 *   is not ours to make. Revisit for the apex at DNS cutover.
 *
 * - **`X-Frame-Options: DENY` is a LEGACY MIRROR of `frame-ancestors`,** which
 *   does not exist until Phase B ships a CSP. Delete this line only when Phase
 *   B is enforcing, never before, or the site spends that window framable.
 *
 * ## THE PERMISSIONS-POLICY LIST IS DERIVED, and the derivation is the value
 *
 * Widened 2026-08-23 from the original four. The four were right and were also
 * the shape of a copied snippet, which is a bad way for a list like this to be
 * correct: nothing recorded what the site actually uses, so the next person to
 * "improve" it had no way to tell a safe addition from a breaking one.
 *
 * **WHAT THE SITE USES: `clipboard-write`, AND IT MUST NEVER BE DENIED HERE.**
 * Measured across `app/` and `workers/` on 2026-08-23. It is on the PUBLIC
 * plane, not just the admin one: `app/enhance/blog.ts` calls
 * `navigator.clipboard.writeText` three times, for the copy-code button on
 * every fenced block, the copy-link on heading permalinks, and the copy-markdown
 * control. Four admin components use it as well. Denying `clipboard-write`
 * would break the copy button on every blog post, and it would break it
 * SILENTLY, because the enhancement already swallows a refusing clipboard.
 * That is the exact trap a longer copied snippet walks into.
 *
 * **WHAT THE SITE DOES NOT USE, verified by the same sweep and therefore denied:**
 * no `getUserMedia` or `navigator.mediaDevices` (camera, microphone,
 * display-capture), no `navigator.geolocation`, no `PaymentRequest`, no
 * `navigator.usb`, `navigator.serial`, `navigator.bluetooth` or MIDI access.
 * Zero matches for any of them.
 *
 * Kept OUT of the list deliberately, rather than forgotten: the motion sensors,
 * `fullscreen`, `autoplay` and the rest of the registry. They are unused too,
 * but each additional token is a value `check:headers` and `verify-live` must
 * both carry, and denying a feature nothing can reach buys nothing. The five
 * added are the ones where a future dependency reaching for them silently would
 * actually matter.
 */
```

### workers/app.ts:257 (WHY, shortened)

the prohibition and what it would do; the sibling gate's instance goes to the history document.

```ts
// ONE STRING LITERAL, never a concatenation. `check:headers` and
  // `verify-live` both parse this object with a `"name": "value"` regex, so a
  // `+`-joined value would parse as its FIRST fragment only: the gate would
  // compare half a header and the wire check would then fail against the whole
  // one. Same trap `check:invariants` already had to join literals to survive.
```

### workers/app.ts:267 (HISTORY, deleted)

a deleted function's obituary; the principle it carries is stated where the downgrade now lives.

```ts
/*
 * `cookieDowngrade` WAS DELETED HERE, 2026-09-05, and it is worth one note.
 *
 * It answered "does this response have to be downgraded because the request
 * carried a cookie", and it decided by reading the response's own `Vary`. That
 * scoping was the whole function: a route that did not vary on Cookie was never
 * downgraded, which is what kept the feeds public.
 *
 * NOTHING VARIES ON COOKIE NOW, so the predicate could only ever answer false.
 * A guard whose condition cannot be met is worse than no guard: it reads as
 * protection and is not. The downgrade it served survives in the gateway,
 * decided from the response's declared cache-control instead, which is a
 * condition that can actually be true.
 */
```

### workers/app.ts:289 (WHY, shortened)

what is enforced, the live exposure, the two prohibitions and where the builder lives; the eighteen-route walk, the three resolved questions, the falsified option and every date go to the history document.

```ts
/**
 * The Phase B policy, ENFORCED since 2026-08-17. Ratified 2026-08-06.
 *
 * **THIS HEADER NOW BLOCKS.** It is `Content-Security-Policy`, not
 * `-Report-Only`, and reporting stays on beside it. It spent its first eleven
 * days reporting because three questions could not be answered by reading and
 * were deliberately left to the browser rather than to argument.
 *
 * **WHAT WAS DRIVEN BEFORE THE SWITCH, because an enforced policy that blocks
 * something is worse than Report-Only.** Eighteen routes, real navigations,
 * counting the browser's own `report-uri` POSTs: ten public under the ENFORCED
 * header locally (`/`, `/blog`, a post, `/colophon`, `/projects`,
 * `/playground` with all three demos, `/phage-discovery`, `/search` with the
 * palette opened, `/login`, and a 404 through the error boundary) and eight
 * admin on production, where the policy content is byte-identical (`/admin`,
 * media in grid view, posts, the CodeMirror editor, origin-requests, tools,
 * content, sites). **Zero violations on every one, and every one hydrated.**
 * Two apparent image failures were chased down and were lazy loading, not
 * blocking: forced eager, 9 of 9 loaded on both.
 *
 * **ALL THREE ARE NOW ANSWERED. None of them blocks enforcement.** They are kept
 * here with their answers because the answers are the reason the phase split was
 * worth its cost, and because two of them are counter-intuitive enough that
 * somebody will otherwise re-derive them wrongly.
 *
 *   1. **RESOLVED 2026-08-06: `'strict-dynamic'` DOES cover ES module static
 *      imports.** The router's nonced `type="module"` script imports every route
 *      chunk from `/assets/`, MDN documents the case neither way, and if it did
 *      not propagate an enforcing policy would take the whole site's JavaScript
 *      with it. The observation window settled it, and it was EXERCISED rather
 *      than merely silent: no report named an `/assets/` URL, and the app
 *      demonstrably hydrated, with `/__manifest` fetched, the Ask panel
 *      streaming and the palette working. Silence alone would not have been
 *      evidence, because a policy that blocked everything reports once and then
 *      has nothing left to report.
 *      **What would reopen it:** a Vite or React Router change to how the entry
 *      script loads chunks (a dynamic `import()` chain behaves differently from
 *      a static graph), or a browser dropping `'strict-dynamic'` propagation.
 *      Re-run the walk; do not re-reason it.
 *   2. **RESOLVED 2026-08-06: `script-src` does NOT gate
 *      `<script type="application/ld+json">`, and DOES gate
 *      `type="speculationrules"`.** Both are non-executable data blocks, so the
 *      asymmetry is the browser's rather than a mistake here. Established by
 *      CONTRAST, not absence: `/` carries un-nonced `ld+json` on line 1 and line
 *      1 was not reported, while `/blog` carries `ld+json` AND speculationrules
 *      on line 1 and line 1 WAS reported. The JSON-LD stays un-nonced; grounds
 *      are on `BlogSpeculation`.
 *   3. **RESOLVED 2026-08-07: the nonce plumbing lands on every generated
 *      script.** It did not, when this was written: React Router's two streaming
 *      scripts shipped bare on every page, which is what 10 of the 10 reports
 *      were. Fixed by passing `nonce` to `<ServerRouter>`; see `entry.server.tsx`.
 *      Now asserted on the wire.
 *
 * **THE ONLY THING BLOCKING ENFORCEMENT IS THE SHARED-CACHE NONCE LIFETIME
 * BELOW.** Do not cite this list as a reason; it was one until 2026-08-07 and is
 * not one now.
 *
 * `style-src-attr 'unsafe-inline'` is deliberate and must not be "fixed". The
 * measurement and the reasoning are on the directive itself, in `./csp.mjs`,
 * which is the only copy.
 *
 * **THE SOLE ENFORCEMENT BLOCKER: a nonce and a SHARED CACHE. MEASURED.**
 * The shared-cacheable public HTML routes are `public, s-maxage=600` for
 * cookieless readers, so the header and the body are cached together.
 *
 * **THE LIST IS NOT REPEATED HERE, AND THAT IS DELIBERATE.** `check:headers`
 * owns it in both directions: every .tsx route referencing the shared string
 * must be named there, and every name there must still reference it.
 *
 * A count in this paragraph had been wrong three times over, in two files at
 * once, and it also called `/projects` `private, no-store` when that route in
 * fact exported no `headers()` at all and fell through to hard rule 8's
 * uncached default. Hard rule 8 names this habit; this paragraph is where it
 * cost the most.
 *
 * Measured on the live site 2026-08-09, which is the half nothing had ever
 * checked:
 *
 *   4 cookieless requests on a cache HIT   ->  1 DISTINCT NONCE
 *   4 cookie-bearing requests on BYPASS    ->  4 distinct nonces
 *   the cached body carries the cached header's nonce
 *
 * So the per-request generator is working exactly as intended, and the CACHE is
 * what collapses it. The policy stays internally consistent, which is why
 * nothing looks wrong and why this is easy to miss, but **on every
 * shared-cached route an attacker who reads one page holds a valid nonce for up
 * to ten minutes**, which is precisely the guarantee the enforcing policy IS
 * relying on.
 *
 * **RULED 2026-08-17, and the first answer was taken.** The two acceptable
 * answers were to accept the ten-minute window in writing with the reasoning
 * recorded, or to make those routes uncacheable and give back the
 * shared-cache benefit. Accepted, and recorded PUBLICLY rather than in a comment:
 * `app/lib/colophon-sections.mjs` states it in plain language on /colophon, on
 * the grounds that a showcase listing only its wins is an advertisement. The
 * reasoning is that the alternative makes every reader wait for the origin, and
 * that it is acceptable only because these pages carry no writing from anyone
 * but Dustin.
 *
 * **The exposure below is LIVE and accepted, not pending.**
 *
 * **A THIRD ANSWER WAS RULED IN AND THEN FALSIFIED BY MEASUREMENT, 2026-08-17.**
 * The ruling was `script-src 'self'` with `'strict-dynamic'` removed, on the
 * premise that every script here is a first-party bundle under `/assets/`. Half
 * of that is right and the load-bearing half is not:
 *
 *   - RIGHT: `'strict-dynamic'` does cause `'self'` and every allowlist entry
 *     to be IGNORED, so the two genuinely cannot be combined. MDN, verbatim:
 *     "any allowlist or source expressions such as 'self' or 'unsafe-inline'
 *     will be ignored."
 *   - WRONG: there is not one external `<script src>` on this site. MEASURED on
 *     production across `/`, `/blog`, `/playground`, `/search`, `/colophon`,
 *     `/projects` and `/login`: every script element is INLINE, five to seven
 *     per page, and the `/assets/` bundles are reached by an inline `type=module`
 *     script that IMPORTS them. `'self'` does not cover inline script.
 *
 * DRIVEN IN A REAL BROWSER before being rejected, with the current policy as the
 * control on the same page and harness: under `script-src 'self'` enforced,
 * ZERO JavaScript was requested and `window.__reactRouterContext` was undefined,
 * so nothing hydrated; under the current policy the same page fetched 23 scripts
 * and hydrated. Option C would have taken the whole site down.
 *
 * Hashes cannot rescue it either: three of the inline blocks carry per-request
 * loader data, so their content changes every render.
 *
 * **What survives from that ruling and is now GATED: the origin invariant.**
 * Whatever `script-src` becomes, nothing user-writable may serve a script from
 * this origin. `test/upload-contract.test.mjs` refuses an executable type in the
 * upload allowlist, and `check:headers` derives the attachment rule below from
 * that same allowlist so a new script-capable type cannot be added without one. DNS
 * cutover changes the terms, because a proxied zone brings Cache Rules into
 * scope. `verify-live` asserts the measurement above so the number cannot drift
 * unnoticed while the decision is pending.
 *
 * `report-uri` AND `report-to` are both sent, per MDN: "The `report-to`
 * directive is intended to replace `report-uri`, and browsers that support
 * `report-to` ignore the `report-uri` directive. However, until `report-to` is
 * broadly supported you can specify both." `report-to` is Baseline 2026 and
 * `Reporting-Endpoints` Baseline 2024, so both are recent enough that the
 * legacy directive is still carrying real browsers.
 *
 * **THE BUILDER ITSELF NOW LIVES IN `./csp.mjs`, AND THE MOVE IS A GATE
 * REQUIREMENT RATHER THAN TIDYING.** The policy became CONDITIONAL when the
 * admin plane started needing a style nonce, and `check:headers` could only
 * ever read this file's SOURCE TEXT. Source text can see that two branches
 * exist; it cannot see which one a request gets. A shared module can be
 * IMPORTED and CALLED, so the gate now asserts the strings both branches
 * actually return, and the public branch keeping an absolute `style-src` is a
 * failing assertion rather than an intention recorded in a comment.
 *
 * Everything above about enforcement, the resolved report list and the
 * shared-cache nonce lifetime is unchanged and still describes this policy.
 * The grounds for the admin-only branch are on `contentSecurityPolicy` there.
 */
```

### workers/app.ts:444 (CONTRACT, shortened)

what it writes and the structural claim, with the correction that claim already needed; the dates and the guard reasoning go to the history document.

```ts
/**
 * One traffic row per HTML response, into Analytics Engine.
 *
 * NO CLIENT IDENTIFIER, and that is structural rather than a promise. There is
 * no cookie read, no IP, no user agent string, and nothing derived from any of
 * them. Four coarse strings go in and nothing joins two requests together, so
 * the dataset cannot answer "who" even if someone later wants it to.
 *
 * **THAT CLAIM WAS FALSE FOR ONE ROUTE AND THE CORRECTION IS BELOW.** A preview
 * URL carries a capability in its PATH, so `url.pathname` was a per-reviewer
 * identifier and two requests holding the same link did join. Found on
 * production 2026-08-15, on the first real use. The path is redacted before the
 * write now; the sentence above is true again, and it is written down here as a
 * claim that already aged once.
 *
 * WHY THIS CANNOT FAIL A RESPONSE. Two independent guards, because one is not
 * enough. `writeDataPoint` is documented to return immediately with the runtime
 * writing in the background, so it is never awaited and adds no latency; but
 * "returns immediately" is not "never throws", and a missing binding or a
 * malformed point would throw SYNCHRONOUSLY into the request path. The whole
 * body is therefore wrapped, and the catch is deliberately silent: a failed
 * analytics write must never turn a good page into an error, and must never
 * become log noise on every request either.
 *
 * The REFERER is reduced to its host before it is stored. A full referer URL
 * carries paths and query strings from other people's sites, which is exactly
 * the kind of incidental personal data this site has no reason to hold.
 *
 * The DEVICE hint is a single bit off a header the browser volunteers, not a
 * measurement of the client. It is not a fingerprint and cannot be one.
 *
 * @param request  the incoming request
 * @param response the finished response, read for status and content type
 * @param env      the Worker environment carrying the ANALYTICS binding
 * @param url      already parsed by the caller, so this parses nothing twice
 */
```

### workers/app.ts:482 (CONTRACT, shortened)

what is counted; one line already.

```ts
// HTML only. Assets, the feeds, the markdown twins, /media and the API
    // routes are all traffic, and none of them is a page view.
```

### workers/app.ts:488 (WHY, shortened)

the rule and why at write time; one line.

```ts
// THE OPERATOR IS NOT AN AUDIENCE. The admin plane is one string compare
    // away on a URL the caller already parsed, so it is skipped at write time
    // rather than left for a query to filter later. A panel that counts its own
    // author is worse than no panel.
```

### workers/app.ts:507 (WHY, shortened)

what the redaction is and that the old rows cannot be fixed; the date, the token length and the ruling go to the history document.

```ts
/*
     * THE PATH IS REDACTED BEFORE THE WRITE, and this is the one line in the
     * capture that is a security control rather than a data choice.
     *
     * `/preview/<token>` puts a 43-character CAPABILITY in the URL. Writing
     * `url.pathname` verbatim stored it in Analytics Engine and printed it in
     * full on `/admin/origin-requests`, which is exactly what the drawer's
     * six-character truncation exists to prevent. Measured on production
     * 2026-08-15, on the first real use of the feature.
     *
     * **AE ROWS ARE IMMUTABLE.** Rows written before this landed cannot be
     * redacted, deleted or rewritten; they age out with the dataset's
     * retention. The exposure is bounded on two sides and accepted on that
     * basis in decisions vol 6: a token stops working after its seven day TTL
     * whatever the dataset still remembers, and reading the dataset at all
     * needs ANALYTICS_READ_TOKEN, which is a Worker secret.
     *
     * One row per request is unchanged. Only the identifier goes.
     */
```

### workers/app.ts:531 (WHY, shortened)

why path, and why the redacted one; the fragmentation measurement goes to the history document.

```ts
// Indexes are the SAMPLING KEY. Path is the right one: it keeps the
      // per-path counts this exists to produce meaningful under sampling.
      //
      // The REDACTED path, necessarily. A distinct index per token also
      // fragmented the sampling key space into values that each appeared a
      // handful of times, which is the worst possible shape for a sampling key,
      // so this is the same edit paying twice.
```

### workers/app.ts:541 (WHY, shortened)

the rule; one line already.

```ts
/* Analytics must never cost a reader their page. */
```

### workers/app.ts:545 (CONTRACT, shortened)

the export summary, the split, and what it must not do; the ruling, the date and the previous arrangement go to the history document.

```ts
/**
 * THE RENDERER. Everything that produces a document, and the entrypoint the
 * platform is allowed to cache.
 *
 * ## WHY THIS IS A SEPARATE ENTRYPOINT AT ALL
 *
 * Ruled 2026-09-05 (decisions vol 14, ruling 15). Workers Cache is configured
 * per entrypoint, and the two things this Worker does want opposite answers:
 * the traffic row must be written on EVERY request, and the document should be
 * served without running any code at all. One entrypoint cannot do both, and
 * the previous arrangement resolved that by having no cache the Worker could
 * see, which is what the gateway below and this class replace.
 *
 * So `default` is cache DISABLED and runs always; this is cache ENABLED and
 * runs on a miss. The split is the whole design and the config states it in
 * `exports`; the two files cannot drift, because `check:config` compares them.
 *
 * ## WHAT IT MUST NOT DO
 *
 * It must not write the traffic row. On a hit this code does not run, so a
 * count taken here would silently become a count of cache misses, which is a
 * worse instrument than the one item G replaced: it would look like readership
 * and would move with cache behaviour. `recordTraffic` is called by the
 * gateway, after this returns, for exactly that reason.
 *
 * ## WHAT IT STILL OWNS, unchanged from when this was one handler
 *
 * The nonce, the render, the timing header, the security headers, the CSP, the
 * Reporting-Endpoints header, and hard rule 8's uncached default. All of those
 * belong to the DOCUMENT, so they belong in the copy that is stored: a header
 * stamped after the cache would be absent from every hit.
 */
```

### workers/app.ts:581 (CONTRACT, shortened)

parsed once and who reads it; the deleted lookup goes to the history document.

```ts
/*
     * Parsed once. The CSP's `Reporting-Endpoints` and the admin branch of the
     * policy both read it, and it used to be parsed up at the themed cache
     * lookup, which no longer exists.
     */
```

### workers/app.ts:591 (WHY, shortened)

why it is generated here and the failure that looks like success; the grounds pointer stays.

```ts
/*
     * THE NONCE, GENERATED BEFORE THE RENDER. This is the deviation.
     *
     * Everything else in this file is stamped onto a finished response and
     * needs to know nothing about it. A nonce cannot be: the identical value
     * has to reach the header AND every `<script>` in the body, so it is
     * created here, put in the render context, and read back out below to build
     * the policy. Grounds are on `nonceContext` in `app/lib/context.ts`.
     *
     * `crypto.randomUUID()` is fresh per request and never derived from
     * anything stable. **A static or derived nonce is the failure mode that
     * looks exactly like success:** every page renders, nothing reports, and
     * the policy is worth nothing, because an attacker who can read one page
     * can reuse the value. verify-live asserts two responses differ, which is
     * the only place that can be seen.
     */
```

### workers/app.ts:610 (WHY, shortened)

why here and not in a loader; the production samples, the route names and the date go to the history document.

```ts
/*
     * THE TIMING HEADER IS STAMPED HERE, and it has to be, because every other
     * place races.
     *
     * `timings` is ONE array shared through context, and the admin layout's
     * middleware is what creates it. Every loader pushes into that same array,
     * and loaders for a matched route run CONCURRENTLY. So a route that stamped
     * `Server-Timing` from inside its own loader was stamping whatever had
     * accumulated at the instant IT finished.
     *
     * MEASURED on production 2026-08-22, four samples each: /admin.data
     * carried `auth_create|auth_getsession|overview_source|loader_total` and
     * had LOST all four of the layout's marks, because the index route's loader
     * is a stub that finished first. /admin/posts.data carried all twelve,
     * because its loader takes ~314ms and the layout had long since pushed.
     * The header's contents depended on which loader won a race, which makes
     * every breakdown read off it wrong in a way that looks like data.
     *
     * Here is the one point where the array is COMPLETE: the handler has
     * returned, so every loader has finished. The per-route stamps still run
     * and are simply overwritten by this one; they are now redundant rather
     * than wrong, and removing them is a separate tidy.
     *
     * The creation of the array is deliberately NOT moved here. It stays in the
     * admin middleware, which is what confines timing to the admin subtree; a
     * request that never asked carries `undefined` and this whole block is
     * skipped, so a public response is byte-identical to what shipped.
     */
```

### workers/app.ts:641 (WHY, shortened)

what the mark is for and what it is not; the twelve-sample residual goes to the history document.

```ts
/*
     * `worker_total` BOUNDS EVERYTHING, and it is the only mark this file adds.
     *
     * The previous session's criterion was that the response path gets no
     * dedicated instrument unless it owned real time, and it does not: the
     * browser-side residual after `loader_total` and `layout_total` measured
     * 25ms at the median over twelve samples, and that figure still includes a
     * network round trip. This is not that instrument. It is an outer bound, so
     * the residual can be read off the header itself instead of reconstructed
     * from PerformanceResourceTiming in a browser, which is what verifying the
     * fix above requires.
     */
```

### workers/app.ts:657 (HISTORY, deleted)

a deleted rule's obituary; the surviving downgrade states its own reason where it now lives.

```ts
// THE COOKIELESS-ONLY RULE IS GONE, 2026-09-05, and this is what replaced it.
    //
    // What stood here: a route setting `Vary: Cookie` was declaring that its
    // body depends on the Cookie header, and `Vary` alone was not enough to
    // make that safe, because an ABSENT Cookie header is not treated as its own
    // variant. With `theme=dark` warming the entry first, every first-time
    // visitor was served a dark document. Present-but-different cookie values
    // DO separate; absent does not. Full matrix in Capsid
    // `dustinedwards/workers-cache-vary.md`.
    //
    // THAT MEASUREMENT IS STILL TRUE AND NO LONGER APPLIES, because nothing on
    // this site varies on Cookie any more. The theme is in the CACHE KEY, where
    // absence is not a special case: a request with no theme cookie resolves to
    // a theme like any other and keys on it. The whole class of defect the
    // cookieless-only rule was built to avoid was a property of `Vary`, and
    // `Vary` is what went.
    //
    // The downgrade itself SURVIVES and moved to the gateway (ruling 16, kept
    // as belt and braces). It has to be there rather than here: this response
    // is the one the platform STORES, so writing `private, no-store` on it for
    // a cookied reader would mean cookied readers were never cached, which is
    // the regression the whole arc exists to end. The gateway stamps the wire
    // copy after the cache has already stored the public one.
```

### workers/app.ts:680 (WHY, shortened)

the property and why the rebuild is the catch branch.

```ts
/*
     * ALL response-level policy, in ONE place with ONE immutable fallback.
     *
     * `Response.redirect()` and friends return immutable headers, so a `set`
     * throws rather than being quietly ignored, and rebuilding is the only way
     * to stamp them. Rebuilding stays on the catch branch rather than becoming
     * the general path: routing every response through a new one is pointless
     * work on the routes that stream.
     *
     * The property this block exists to have is that the security headers are
     * applied to EVERY response, including one whose headers refuse a `set`.
     * Both branches apply the same set; whatever throws, the rebuild covers it.
     *
     * `/admin` returning 302 is the live case. It is asserted in verify-live
     * anyway, because it is a DIFFERENT code branch from a 200.
     */
```

### workers/app.ts:697 (CONTRACT, shortened)

why absolute and why derived; the parse-once detail goes to the history document.

```ts
// Absolute, because `Reporting-Endpoints` takes a URL and MDN notes that
    // non-secure endpoints are ignored. Derived from the request so it is
    // correct on workers.dev today and on the apex after cutover, with nothing
    // to add to the cutover list. `url` is parsed once, up at the themed cache
    // lookup, because that runs before the render and needs the same value.
```

### workers/app.ts:703 (CONTRACT, shortened)

which plane gets the style nonce; the grounds stay on the predicate.

```ts
/*
     * The style nonce is emitted for the ADMIN PLANE ONLY, keyed on the path.
     * `isAdminPath` owns the exact-or-slash test and the reasoning, including
     * what an unauthenticated request to an admin path gets, which is a
     * bodyless 302 that is never shared-cached.
     */
```

### workers/app.ts:711 (HISTORY, deleted)

an obituary for a call that moved; the gateway states why it lives there now.

```ts
/*
     * `recordTraffic` USED TO BE CALLED HERE AND IS NOW THE GATEWAY'S, 2026-09-05.
     *
     * The old comment argued for this position at length: one call site above
     * two returns, everything it reads already final. All of that was right
     * about this function and is now beside the point, because this function no
     * longer runs on every request. On a cache HIT the platform answers without
     * invoking this entrypoint at all, so a count taken here would have become
     * a count of MISSES the day the cache started working, and would have read
     * like readership while moving with cache behaviour.
     *
     * It moved to the gateway, which is cache disabled and therefore runs
     * always. Ruling 12 is the same observation from the other side: the
     * gateway is what finally makes the count complete.
     */
```

### workers/app.ts:727 (CONTRACT, shortened)

what the platform now answers and the one rule that survives; the deleted block's three conditions and the date go to the history document.

```ts
/*
     * THE STORE BLOCK IS GONE, 2026-09-05, with the layer it wrote to.
     *
     * It hand-wrote the public document into `caches.default` under three
     * conditions, and each of those is now the platform's own answer rather
     * than this file's:
     *
     *   the route declared the shared string   still the rule, and now it is
     *                                          the only rule. The platform
     *                                          stores what the response says
     *                                          is storable, and hard rule 8's
     *                                          default below is what makes a
     *                                          route that says nothing refuse.
     *   GET, not an admin path                 Workers Cache caches GET and
     *                                          HEAD only, per the docs, and an
     *                                          admin response is `private,
     *                                          no-store` by its own headers.
     *   no Set-Cookie                          documented as an AUTOMATIC
     *                                          bypass. A response that mints a
     *                                          session or a theme is per reader
     *                                          by definition, and the platform
     *                                          refuses to store it without
     *                                          being asked.
     *
     * So the guard that used to be written out here survives as configuration
     * plus two documented platform behaviours. That is a real reduction in
     * things this file can get wrong, and it is the reason to prefer the
     * platform cache rather than a preference for less code.
     */
```

### workers/app.ts:787 (CONTRACT, shortened)

the export summary, the four steps and why the order is load bearing; the ruling, the date and the billing argument go to the history document.

```ts
/**
 * THE GATEWAY. Cache disabled, so it runs on every single request.
 *
 * Ruled 2026-09-05 (decisions vol 14, ruling 15). It does only the four things
 * that must not be skipped, and hands everything else to the `Renderer` above
 * through a loopback the platform is allowed to answer from cache.
 *
 *   1. the HTTPS redirect, before anything is parsed
 *   2. the theme cookie read, which becomes the cache key's one dimension
 *   3. the loopback, with that key and those props
 *   4. the traffic row, AFTER the response comes back, hit or miss
 *
 * ## WHY IT COSTS A WORKER INVOCATION ON EVERY REQUEST, AND WHY THAT IS FINE
 *
 * A cache hit no longer skips this Worker entirely; it skips the RENDERER.
 * Cloudflare bills a request either way and bills CPU time only when code runs,
 * so what this costs is the microseconds of the four steps below. What it buys
 * is ruling 12: `recordTraffic` finally sees every page view rather than only
 * the ones that missed, which is the second half of item G answered by
 * construction rather than by a beacon.
 *
 * ## THE ORDER IS LOAD BEARING
 *
 * The redirect is first because a plaintext request must never reach a cache
 * lookup keyed on a path that ignores the scheme. Everything else follows the
 * response, so the traffic row is written from the finished thing rather than
 * from an intention.
 */
```

### workers/app.ts:817 (WHY, shortened)

the rule, why no-store is load bearing and why the header stays; the live measurement and its date go to the history document.

```ts
/*
     * PLAINTEXT GOES TO HTTPS BEFORE ANYTHING ELSE HAPPENS.
     *
     * Measured on the live site 2026-08-23: http:// returned 200 with the
     * full page, and the shared cache did not separate the schemes, so a
     * plaintext request was answered with the byte-identical cached HTTPS
     * response INCLUDING ITS CSP NONCE. The grounds, the three consequences
     * and the part this cannot reach are all on the predicate.
     *
     * `no-store` is load-bearing rather than tidy. The scheme is not in the
     * cache key, so a cacheable redirect stored under a shared key would be
     * handed to HTTPS readers as well and send them to the URL they already
     * asked for. Hard rule 8: an absent Cache-Control is CACHED, so this is
     * stated and not left to a default.
     *
     * IT IS IN THE GATEWAY, which is cache disabled, so the redirect could not
     * be stored even if the header were forgotten. The header stays anyway: it
     * is one string, and the property it asserts should not depend on which
     * entrypoint somebody later moves this to.
     */
```

### workers/app.ts:847 (WHY, shortened)

the position and why; the ruling and the D1-query detail go to the history document. The source's hard rule 8 citation was split across a line break and is restored to one line here.

```ts
/*
     * RENAMED POSTS GO TO THEIR NEW URL, BEFORE ANY DATABASE READ.
     *
     * Ruling 47. Second in the gateway, and the position is the whole design:
     * after the HTTPS redirect, because a plaintext request must reach HTTPS
     * before anything else decides anything, and before the cache loopback,
     * because everything past this line either stores a response or renders
     * one. `blog.$slug.tsx` would answer these with a 404 out of its loader,
     * one D1 query after this line already knew the answer.
     *
     * Both representations, HTML and the `.md` twin, are handled by the
     * predicate. `no-store` for the reason the HTTPS redirect states: hard rule
     * 8 makes an absent Cache-Control a CACHED response, and the gateway is
     * cache disabled, so a stored redirect would be a surprise rather than a
     * saving.
     */
```

### workers/app.ts:868 (CONTRACT, shortened)

what the resolution prevents; one line already.

```ts
// Resolved against this request's own origin, so the Location can
          // never name another host.
```

### workers/app.ts:876 (WHY, shortened)

the ordering rule between the two maps and why neither fires on a live file.

```ts
/*
     * THE PUBLICATION PDFs, WHICH ALL MOVED, AND THE PAPER PAGE'S TRAILING
     * SLASH. Third and fourth in the gateway, beside the post redirects and for
     * the same reasons: before the cache loopback, cache disabled, and resolved
     * against this request's own origin.
     *
     * ORDER MATTERS BETWEEN THESE TWO. The PDF map is consulted FIRST because
     * its keys end in `.pdf`, and `paperSlashTarget` refuses anything with a
     * dot in the final segment precisely so it can never claim an asset path.
     * Checking the map first means that refusal is a second line of defence
     * rather than the only one.
     *
     * Neither fires on a file that still exists: static assets are served by
     * the asset handler ahead of this Worker, so a request for a PDF at its
     * CURRENT path never reaches here.
     */
```

### workers/app.ts:903 (CONTRACT, shortened)

which spelling is canonical and why; one line.

```ts
/*
     * `/publications/<slug>` to `/publications/<slug>/`.
     *
     * Both spellings match the route and both would render, which is two URLs
     * for one document. The slash form is canonical because it is the one that
     * puts the page in the same subdirectory as its PDF, which is Scholar's
     * stated condition for honouring `citation_pdf_url`.
     */
```

### workers/app.ts:922 (CONTRACT, shortened)

what is read and where the grounds are; one line already.

```ts
/*
     * THE ONE THING READ OFF THE COOKIE, and it becomes the key's one dimension.
     * Grounds on `cacheDimensions`, including why the theme is in both the
     * custom key and the props.
     */
```

### workers/app.ts:930 (CONTRACT, shortened)

what the loopback is and what it does on a hit; the compatibility date and the preview measurement go to the history document.

```ts
/*
     * THE LOOPBACK. This is where the platform cache sits.
     *
     * `ctx.exports.Renderer` is a loopback service binding to the class above,
     * which Cloudflare documents as a cacheable invocation. On a hit the
     * Renderer does not run and this line returns a stored response; on a miss
     * it runs and its response is stored under the key given here.
     *
     * `enable_ctx_exports` has been default since compatibility date
     * 2025-11-17 and this Worker is on 2026-07-08, so no flag is needed. It was
     * MEASURED under `vite preview` before this was written, because a design
     * that only works in production is a design nobody can gate.
     */
```

### workers/app.ts:947 (WHY, shortened)

why it cannot live in the Renderer, what it is for now, and the fail-closed key; the ruling goes to the history document.

```ts
/*
     * THE COOKIE DOWNGRADE, kept as belt and braces (ruling 16) and moved here.
     *
     * It cannot live in the Renderer any more: that response is the one the
     * platform STORES, so writing `private, no-store` on it for a cookied
     * reader would mean cookied readers were never cached, which is the exact
     * regression this whole arc exists to end. Stamping it here changes only
     * the copy on the wire.
     *
     * WHAT IT IS FOR NOW, since the reason changed with the layer. There is no
     * shared cache in front of the gateway on workers.dev, so this is not
     * protecting the platform cache from itself; it is telling a BROWSER or an
     * intermediary proxy not to hold a document that genuinely differs per
     * reader. One header, and it fails in the safe direction.
     *
     * Keyed on the PRESENCE of any cookie and on the response having declared
     * the shared string. Presence rather than a theme cookie specifically is
     * the fail-closed reading, and it is the same reasoning the deleted
     * `cookieDowngrade` carried: a request holding only a session cookie must
     * not read as cookieless.
     *
     * Wrapped, because a response from the cache can have immutable headers and
     * a throw here would cost the reader their page for the sake of one header.
     */
```

### workers/app.ts:987 (CONTRACT, shortened)

what it counts and that the refusals are unchanged; the ruling goes to the history document.

```ts
/*
     * THE TRAFFIC ROW, from the gateway, which is the whole of ruling 12.
     *
     * It reads the FINISHED response's status and content type, so it counts
     * what the reader actually got, and it runs whether that came from the
     * cache or from a render. Every refusal it carries is unchanged: HTML only,
     * 200 only, never the admin plane, referer reduced to a host, path
     * redacted. Grounds on the function.
     */
```

### workers/app.ts:1001 (CONTRACT, shortened)

what it consumes and why it is on this entrypoint; the idempotency pointer stays.

```ts
/**
   * R2 event notifications from `dustinedwards-media`, deriving the D1 index.
   *
   * Separate from `fetch` on purpose: no HTTP request ever triggers this, and no
   * reader ever waits on it. The grounds and the idempotency argument are in
   * `media-events.ts`.
   *
   * ON THE GATEWAY rather than the Renderer, and the docs make that the only
   * option: queue invocations bypass the cache entirely, so an entrypoint that
   * exists to be cached is the wrong home for one.
   */
```

## app/lib/search/ask.server.ts

### app/lib/search/ask.server.ts:1 (CONTRACT, shortened)

the off switch and the one-derivation rule; the ruling pointer stays.

```ts
/**
 * Ask mode: search Layer 2, over Cloudflare AI Search.
 *
 * THE RULE THIS FILE EXISTS UNDER. Classic search is D1 and only D1. Nothing
 * here is imported by `search.server.ts`, no classic query awaits anything in
 * this module, and the zero-JS path never reaches it. If `AI_SEARCH` is not
 * bound, `askAvailable()` is false, no Ask affordance is rendered, and /search
 * is byte-identical to what it was before Layer 2 existed. That property is the
 * off switch the cost-review ruling in decisions.md depends on, so it is a
 * requirement rather than a nicety.
 *
 * The corpus is the SAME section-grained records the D1 index uses, derived by
 * the same `records.mjs`. There is one record derivation for the whole site,
 * exactly as there is one markdown renderer.
 */
```

### app/lib/search/ask.server.ts:36 (CONTRACT, shortened)

why re-exported rather than re-implemented; one line.

```ts
/*
 * The pure half, in plain JavaScript so `check:tests` can reach it. Re-exported
 * rather than re-implemented: `search.ask.ts` imports the guard and the refusal
 * from this module, and a second import path would be a second thing to keep in
 * step. Grounds in ask-guard.mjs.
 */
```

### app/lib/search/ask.server.ts:56 (NUMBER, shortened)

why the bound is the answer and not the corpus; the stale basis, the date and the rot go to the history document.

```ts
/**
 * How many chunks the answer may draw on.
 *
 * ## RE-DERIVED 2026-08-28, and the old basis was a corpus size
 *
 * It read "the corpus is 7 records from one post", which was true when it was
 * written and had been false for a month: the index has grown by more than an
 * order of magnitude since, and nothing moved this value or noticed. A ceiling
 * justified by how much there is to retrieve has to be re-derived every time
 * anybody publishes, which is why it went stale.
 *
 * THE BOUND IS THE ANSWER, NOT THE CORPUS, and that is why it does not move.
 * The system prompt below asks for two or three sentences. An answer that
 * length cannot honestly synthesise more sources than this; past it, retrieval
 * widens the net without widening the answer, and the extra chunks only dilute
 * the ranking that chose the good ones. So the corpus growing does not raise
 * this, and shrinking would not lower it.
 *
 * No corpus figure appears here on purpose. This file owns this number and
 * nothing else, per rule 17: the index size is `sync_ask`'s to report and the
 * health check's to watch, and a copy here could only rot.
 */
```

### app/lib/search/ask.server.ts:80 (WHY, shortened)

why a property check and not a catch; one line.

```ts
/**
 * True when the AI Search binding is present.
 *
 * Checked as a property on env rather than in a try/catch, because "the
 * binding was removed" and "the instance errored" are different situations and
 * only the first one should silently remove the feature.
 */
```

### app/lib/search/ask.server.ts:99 (CONTRACT, shortened)

why the stream is untouched; one line.

```ts
/**
 * Streams an answer. Returns the raw SSE stream from AI Search.
 *
 * The stream is handed to the client untouched rather than parsed and
 * re-emitted, so the Worker holds nothing in memory and time-to-first-token is
 * whatever AI Search delivers. The client already has to parse SSE to render
 * tokens as they arrive, so a second envelope would buy nothing.
 */
```

### app/lib/search/ask.server.ts:109 (WHY, shortened)

why composition lives elsewhere; the measurement stays on that function.

```ts
/*
     * COMPOSED IN `askMessages`, not here, because the last message is the
     * retrieval query and a test has to be able to see it. Decorating it costs
     * the whole search: the grounds, and the measurement, are on that function.
     */
```

### app/lib/search/ask.server.ts:123 (CONTRACT, shortened)

what the tee buys and what null means.

```ts
/**
 * Splits the upstream stream in two: one to the reader, one to an accumulator.
 *
 * The reader gets bytes as they arrive, unchanged, so caching costs
 * time-to-first-token nothing. The second copy is parsed after the response has
 * already been sent, inside `waitUntil`, and what it accumulates is what gets
 * cached.
 *
 * Returns the stream to hand to the reader plus a promise of the parsed answer.
 * The promise resolves to null when the generation produced nothing, which must
 * not be cached.
 */
```

### app/lib/search/ask.server.ts:143 (WHY, shortened)

why the frame handling is shared; one line.

```ts
/**
 * Reads a full SSE completion into the pieces the cache needs.
 *
 * Same frame handling as the client, deliberately: if the two disagreed about
 * what a frame means, a cached replay would not match what the reader saw the
 * first time.
 */
```

### app/lib/search/ask.server.ts:197 (CONTRACT, shortened)

why a replay is indistinguishable and why one delta.

```ts
/**
 * Rebuilds a cached answer as the same SSE shape the model produces.
 *
 * The client cannot tell a replay from a generation, which is the point: one
 * parser, one rendering path, and no second code path that could drift. The
 * whole answer arrives as a single delta rather than re-simulating typing,
 * because pretending to think for two seconds over a cached string would be
 * theatre.
 */
```

### app/lib/search/ask.server.ts:226 (WHY, shortened)

the paging rule and the failure it removes; the date and the measured prune go to the history document.

```ts
/**
 * Every item in the index, following pagination to the end.
 *
 * `items.list()` is PAGED: it takes page and per_page and reports total_count,
 * and a bare call returns only the first page. Every caller here used a bare
 * call, which was invisible while the corpus was seven records and became a
 * correctness bug the moment it was not. Measured 2026-07-29: a prune reported
 * "removed 0" for a post whose items were real but sat on a later page, so a
 * draft stayed answerable through the public Ask endpoint after the code that
 * was supposed to remove it had run and reported success.
 *
 * A prune that cannot see an item cannot delete it, and it reports success
 * either way. That is the failure mode this exists to remove.
 */
```

### app/lib/search/ask.server.ts:243 (NUMBER, shortened)

the API maximum, measured; the rejection message goes to the history document.

```ts
// 50 is the API maximum. Measured: per_page 100 is rejected with
  // "Too big: expected number to be <=50".
```

### app/lib/search/ask.server.ts:247 (WHY, shortened)

why a mark per page and why entries not a map; the arithmetic-not-a-reading argument goes to the history document.

```ts
/*
     * ONE MARK PER PAGE, and the COUNT of them is the measurement.
     *
     * The pagination cost has only ever been inferred from the index size:
     * "81 items at 50 a page, so two round trips". That is arithmetic, not a
     * reading. Emitting a mark per iteration means the Server-Timing header
     * carries as many `ask_list_page` entries as there were round trips, each
     * with its own duration, so the page count is COUNTED and the cost is
     * attributed to a specific page rather than to the loop.
     *
     * Entries, not a map: two pages produce two entries with the same name, and
     * anything that collapses them by name reports one. That mistake was made
     * once already in this codebase's own measurement of artifact_load.
     */
```

### app/lib/search/ask.server.ts:275 (WHY, shortened)

the public-surface rule and why the filter is at upload; the leak, its date and the count go to the history document.

```ts
/**
 * The posts that may appear in the Ask index.
 *
 * THE AI INDEX IS A PUBLIC SURFACE. `/search/ask` is unauthenticated and its
 * citations name the post they came from, so anything uploaded here is
 * readable by anyone who asks the right question. That makes this filter the
 * same kind of gate as `publiclyVisible()` on the D1 side, and it must agree
 * with it: a draft is excluded, and so is a post whose publish_at is still in
 * the future.
 *
 * This was missing, and it leaked. Five unpublished drafts staged through the
 * operator path on 2026-07-29 were uploaded unconditionally, and the public Ask
 * endpoint answered from one of them and cited it by slug. The classic index
 * was never affected: it filters at query time. Ask had no equivalent, because
 * AI Search has no per-item status the query can filter on, so the filter has
 * to happen at UPLOAD time. Nothing unpublished may enter the index at all.
 *
 * @param posts
 */
```

### app/lib/search/ask.server.ts:297 (WHY, shortened)

why composed rather than restated; the dates and the hand-rolled copy go to the history document.

```ts
/*
   * COMPOSED, NOT RESTATED, since 2026-08-23. This used to be its own filter:
   * `draft === true` out, `publishAt > now` out. It agreed with
   * `publiclyVisible()` by inspection and by a grep in `check:policy`, and by
   * nothing else. A third hand-rolled copy of the visibility rule is the exact
   * shape that leaked five drafts into Ask on 2026-07-29.
   *
   * `statusForDraft` is the mapping between the artifact's boolean and the row's
   * string, so this asks the SAME predicate the D1 read path asks rather than
   * asking an equivalent question a different way.
   */
```

### app/lib/search/ask.server.ts:319 (CONTRACT, shortened)

why built-in storage and the upsert property; the crawler's schedule details go to the history document.

```ts
/**
 * Uploads every search record to built-in storage.
 *
 * WHY BUILT-IN STORAGE RATHER THAN THE CRAWLER. The crawler only indexes a
 * domain onboarded to this Cloudflare account, and the apex still resolves to
 * the legacy WordPress site, so a crawl would index the wrong site entirely.
 * It would also index whole pages, losing the heading granularity that lets a
 * citation deep-link to the section that answered the question. Built-in
 * storage indexes immediately; external sources run on a 6 hour schedule and
 * pause after 31 days without a query.
 *
 * Upload is an UPSERT keyed by filename, so re-running is idempotent and a
 * retitled section replaces itself rather than accumulating.
 */
```

### app/lib/search/ask.server.ts:334 (CONTRACT, shortened)

where the corpus comes from and the one-owner reason; the arc goes to the history document.

```ts
/*
   * THE CORPUS COMES FROM D1, since the artifact arc. The records were
   * materialised into `search_docs` by the same records.mjs both writers run,
   * and `askCorpusRecords` reads them back with `visibilityClause` composed
   * in the SQL, so drafts and future posts never enter the index for the
   * same one-owner reason `publishableForAsk` protects the per-post path.
   */
```

### app/lib/search/ask.server.ts:345 (WHY, shortened)

the fail-closed rule; one line.

```ts
// Fail closed. A slug or anchor containing the separator would produce a
    // key that resolves back to the wrong URL, and a citation pointing at the
    // wrong section is a worse failure than no citation at all.
```

### app/lib/search/ask.server.ts:355 (CONTRACT, shortened)

why the heading is included; one line already.

```ts
// The heading is included in the uploaded text. The body alone loses what
    // the section is about, and the retrieval model reads this as prose.
```

### app/lib/search/ask.server.ts:362 (CONTRACT, shortened)

the split and why uploading both would be worse; the ruling number and the corpus size go to the history document.

```ts
/*
   * THE PAPERS, FROM THEIR TWINS RATHER THAN FROM `search_docs`.
   *
   * The records above are posts: `askCorpusRecords` scopes to `type = 'post'`,
   * so the 36 paper records in `search_docs` never reach the loop. That is not
   * an oversight being worked around here, it is the split ruling 63 draws.
   *
   * The paper record in `search_docs` carries the abstract, which is what
   * keyword search should match and snippet. What Ask should retrieve over is
   * the PAPER, and the twin is the document that has it: the record, the
   * abstract and the extracted text of the PDF, which is 1.13 MB across the
   * corpus and has no business in an FTS5 index that shows the line it matched.
   *
   * Uploading both would put two documents about one paper in the retrieval
   * index, and the shorter one would sometimes win a question the full text
   * answers better.
   */
```

### app/lib/search/ask.server.ts:381 (WHY, shortened)

why invalidation happens here; one line.

```ts
// The corpus just changed, so every cached answer was written against content
  // that may no longer be true. Dropping them here is what stops a stale answer
  // outliving the post it was drawn from. It happens on publish, which is the
  // moment the change occurs, rather than being checked on every read forever.
```

### app/lib/search/ask.server.ts:386 (WHY, shortened)

why a delete and not a write; one line already.

```ts
// The drift number just changed too. A delete rather than a write, because
  // this path knows the cached value is stale and not what it became.
```

### app/lib/search/ask.server.ts:393 (WHY, shortened)

why the module and not D1; the rule citations stay.

```ts
/**
 * Every paper's Ask item key, derived from the committed corpus.
 *
 * FROM THE MODULE, NOT FROM D1, and the reason is hard rule 1 rather than
 * convenience. Every `search_docs` reader has to compose `visibilityClause`
 * (check:invariants section 8 binds them), and composing it here would be
 * asking a visibility question about a corpus that has no visibility: a paper
 * is committed data, published by existing, with no draft state and no
 * schedule. Reading the module instead adds no reader to that surface and
 * points the index at the repository, which is the direction rule 18 requires.
 */
```

### app/lib/search/ask.server.ts:408 (CONTRACT, shortened)

why the assets binding and why a missing twin is reported; the size trade and hard rule 7's shape stay.

```ts
/**
 * Uploads every paper's markdown twin, and returns the keys it wrote.
 *
 * ## THE TWIN IS FETCHED THROUGH `ASSETS`, WHICH LOOKS INDIRECT AND IS NOT
 *
 * The twins are static assets, generated at build and gitignored, precisely so
 * that 1.13 MB of extracted PDF text stays out of the Worker bundle (the trade
 * is argued in full on `twin.mjs`). A Worker cannot read a file from its own
 * bundle that is not imported into it, so the way to the bytes is the assets
 * binding, and the binding has exactly one method: `fetch`.
 *
 * That has a property worth having anyway. What gets indexed is the document
 * the site actually serves at that URL, on this deployment, rather than a
 * second copy assembled from the same inputs. Hard rule 7's shape: the live
 * claim is verified on the live path.
 *
 * The origin in the URL is arbitrary and never leaves the isolate; the assets
 * binding routes on the path.
 *
 * ## A MISSING TWIN IS REPORTED, NOT INVENTED
 *
 * If the build step did not run, the fetch answers 404 and this uploads
 * nothing for that paper rather than an empty document. The key is still
 * returned, for the reason a failed upload still joins `live` in `syncAskPost`:
 * the caller's prune deletes every key it is not given, so omitting it would
 * turn a missing build into a DELETION of the copy already in the index.
 */
```

### app/lib/search/ask.server.ts:457 (CONTRACT, shortened)

why incremental is sound and what the scoped prune is for.

```ts
/**
 * Syncs ONE post's records into the index, and drops that post's stale items.
 *
 * This is what the editor's save path calls, and it is why Ask does not rot as
 * the blog grows. A full corpus sync on every save is correct at seven records
 * and absurd at seven hundred: it would re-upload every section of every post
 * because one post changed. Section decomposition is a pure function of a
 * single post's markdown, which is exactly the property the section-grained
 * ruling records, so the incremental path is sound rather than a shortcut.
 *
 * Scoped prune: a save that removes or renames a heading leaves an item behind
 * that still answers questions about a section the post no longer has. Only
 * keys belonging to THIS post are considered, so a concurrent post is never
 * touched.
 */
```

### app/lib/search/ask.server.ts:476 (WHY, shortened)

why a draft actively removes; one line.

```ts
// A draft uploads NOTHING, and actively removes anything this post already
  // has in the index. Skipping the upload alone would be a silent leak on the
  // unpublish path: a post published, indexed, then withdrawn would stay
  // answerable forever. The empty `live` set makes the existing prune below do
  // the removal, so there is one removal path rather than two.
```

### app/lib/search/ask.server.ts:484 (WHY, shortened)

the isolation rule and why a failed key still joins live; the measured incident, its date and the count go to the history document.

```ts
/*
   * **ONE FAILING RECORD USED TO ABANDON THE REST, AND THAT IS THE DEFECT THIS
   * LOOP IS SHAPED AROUND.**
   *
   * It was a plain `await` per record with no catch, so the first rejection
   * threw out of this function. MEASURED CONSEQUENCE: on 2026-07-31 the
   * Observable Plot post published with NINE records, the first upload failed,
   * and all nine were missing from the index for three weeks. The caller
   * catches by design (a save must not fail because an index write did), so
   * the failure had nowhere to go but the drift badge.
   *
   * **THE FAILURE CLASS IS TRANSIENT, and that is measured rather than
   * assumed.** Those same nine records uploaded without complaint when the
   * corpus sync was finally run three weeks later, so the records were always
   * uploadable and the original failure was a blip. This stack produces those:
   * `sync-content` hit "transient read failed, retrying once" twice in one week
   * against D1. A transient that costs nine records permanently is worth one
   * retry.
   *
   * So: each record is isolated, retried ONCE, and a record that still fails
   * does not stop the others.
   *
   * ## WHY A FAILED KEY STILL JOINS `live`, WHICH LOOKS WRONG AND IS NOT
   *
   * The prune below deletes every key this post owns that is NOT in `live`.
   * Isolating the loop without this line would turn a transient upload failure
   * into a DELETION of the perfectly good copy already in the index: the old
   * record would be pruned because the new one failed to land. The throw used
   * to prevent that by never reaching the prune at all.
   *
   * `live` means "this key should exist", not "this key was just written". A
   * failed key should exist, so it goes in, and whatever is already there
   * survives until a later sync replaces it.
   */
```

### app/lib/search/ask.server.ts:522 (WHY, shortened)

why this one is not caught; one line.

```ts
// NOT caught below. This is a correctness guard, not a transient: the key
      // would resolve back to the wrong URL and cite the wrong section. Retrying
      // it would produce the same wrong key, so it still throws.
```

### app/lib/search/ask.server.ts:545 (WHY, shortened)

what is matched and the trap avoided; one line.

```ts
// Everything this post owns: `blog/<slug>.md` and `blog/<slug>__<anchor>.md`.
  // Matched on the exact document key or the section prefix, never on a bare
  // `startsWith(slug)`, which would also sweep up a longer slug that happens to
  // begin with this one.
```

### app/lib/search/ask.server.ts:562 (WHY, shortened)

why a delete and not a write; one line already.

```ts
// The drift number just changed. A delete rather than a write, because this
  // path knows the cached value is stale and not what it became.
```

### app/lib/search/ask.server.ts:565 (WHY, shortened)

why the subtraction; the nine-record example goes to the history document.

```ts
// `records.length` MINUS what did not land. It used to return the record
  // count unconditionally, which was accurate only because a failure threw
  // before reaching here; with the loop isolated it would have reported nine
  // uploads on a run that achieved none.
```

### app/lib/search/ask.server.ts:579 (CONTRACT, shortened)

why drift is made visible and the both-directions rule.

```ts
/**
 * Compares what the index holds against what the corpus says it should hold.
 *
 * This exists because the editor's Ask sync is deliberately allowed to fail
 * without failing the save, and the save then redirects, so a failure has
 * nowhere to be reported. Rather than build flash-message machinery to carry a
 * warning that would be read once, drift is made permanently visible on
 * /admin/posts. Silent drift in an index nobody looks at is how Ask would rot.
 *
 * Fails in BOTH directions, the same rule the backup gate follows: an item the
 * corpus does not know about is as much a defect as a record the index lacks.
 */
```

### app/lib/search/ask.server.ts:592 (CONTRACT, shortened)

where the expected set comes from and the binding that keeps the two filters in step; the fetch size goes to the history document.

```ts
/*
   * THE EXPECTED SET COMES FROM D1, NOT FROM THE REPOSITORY ARTIFACT.
   *
   * It used to be `recordsForPosts(publishableForAsk(posts))` over the corpus,
   * which meant a 600KB GitHub fetch on every admin page load to produce one
   * integer for a nav badge. `askExpectedUrls` reads the same records out of
   * `search_docs`, where `sync:content` materialised them from the same
   * `records.mjs`, and applies the same visibility rule through
   * `visibilityClause`. Grounds, the verification, and the behaviour change
   * are all stated at that function.
   *
   * `publishableForAsk` is still the filter the UPLOADERS use, and it must
   * stay in step with the SQL predicate here. `check:policy` binds the two.
   */
```

### app/lib/search/ask.server.ts:606 (WHY, shortened)

why concurrent and where it matters; the median and the mark attribution go to the history document.

```ts
/*
   * CONCURRENT, because the two sides of this comparison share nothing.
   *
   * The expected set is a D1 read and the listing is a paged walk of AI Search;
   * neither reads what the other writes, and they were strictly serial. This
   * function is 182ms at the median on /admin/posts and its `ask_list_page`
   * marks account for ~103ms of that, so the D1 half is most of the remainder
   * and it was pure waiting.
   *
   * It matters on BOTH consumers: /admin/posts calls this uncached on every
   * load, and the nav badge calls it on a drift-cache miss, which is the tail
   * the cache exists to hide.
   */
```

### app/lib/search/ask.server.ts:623 (WHY, shortened)

why the papers are expected and what their absence would cause.

```ts
/*
   * THE PAPERS ARE PART OF WHAT THE INDEX SHOULD HOLD, so they are part of what
   * is expected. `askExpectedUrls` is `type = 'post'` and stays that way: the
   * paper half of the index is the twins, which are uploaded from the committed
   * corpus rather than from `search_docs`, and the same list is what says they
   * should be there.
   *
   * Without this the badge would report 36 permanently stale items and the
   * repair button would delete them, which is the failure the page-record
   * exclusion note in `askExpectedUrls` already describes for pages.
   */
```

### app/lib/search/ask.server.ts:645 (CONTRACT, shortened)

why the value moves rather than the loader, and why a getter; the gate fixture reasoning goes to the history document.

```ts
/**
 * The request-scoped, MEMOIZED reader for the drift status above.
 *
 * Two surfaces want the same fact now: the alert on /admin/posts, which owns
 * the repair, and the count badge on the Posts nav item, which is rendered by
 * the admin LAYOUT on every admin page. A parent cannot read a child's loader
 * data, and moving the computation up to the layout was ruled out for a
 * concrete reason: check:admin-ui fabricates `ask` in the posts route's OWN
 * loader data, and the drift alert carries the `sync-ask` form, so relocating
 * it would have emptied that scenario and moved the gate's fixture.
 *
 * So the VALUE moves rather than the loader: the admin layout's middleware puts
 * this getter on the context, exactly as it already puts the verified session
 * there "so children read it without a second lookup", and both loaders call
 * it. On /admin/posts that is one listing per request instead of two, and the
 * posts route's loader data keeps the shape the gate asserts.
 *
 * It is a getter rather than an awaited value because middleware runs for the
 * whole /admin subtree. A route that never asks never pays.
 */
```

### app/lib/search/ask.server.ts:669 (CONTRACT, shortened)

why null rather than throwing; one line.

```ts
/**
 * Builds that reader. Resolves to null rather than throwing, on the same
 * grounds the posts loader already had: the AI index is an enhancement and it
 * may not take an admin page down with it when it is unbound or unreachable.
 */
```

### app/lib/search/ask.server.ts:691 (CONTRACT, shortened)

what the cache hides, the structural early return, the two failure choices and why waitUntil; the samples, the dates and the loop's four steps go to the history document.

```ts
/**
 * THE DRIFT COUNT FOR THE NAV BADGE, off the read path.
 *
 * **THE CACHE IS THE POINT, AND IT IS HIDING A SLOW PATH, SO HERE IS THE SLOW
 * PATH.** `askIndexStatus` pages the whole AI Search index through
 * `listAllAskItems`. Measured on production 2026-08-19 across 12 direct
 * samples of `/admin.data`: median 208ms, MAXIMUM 2332ms, and the admin layout
 * runs on every admin page load, so that tail was reachable from any click in
 * the admin plane. Grounds for the TTL are at `DRIFT_CACHE_TTL_SECONDS`.
 *
 * ## ON A HIT THIS FUNCTION DOES NOT TOUCH AI SEARCH
 *
 * The early return below is the whole feature, and it is STRUCTURAL rather than
 * conditional: there is one `return` between the KV read and the first mention
 * of the index, so a hit cannot reach the listing. `check:invariants` section
 * 11 asserts that ordering on the source, deliberately not on a timing mark. A
 * mark count already proved unable to see an unmarked read in this codebase
 * (the second `artifact_load`, 2026-08-19), so an instrument-shaped assertion
 * here would be the same mistake with a different name.
 *
 * ## THE FAILURE MODE ON A MISS, CHOSEN RATHER THAN INHERITED
 *
 * A miss must never make the admin plane worse than a missing badge. Two things
 * follow.
 *
 * BOUNDED WAIT. The listing races a budget, and on expiry this returns null and
 * the page renders without a badge. 1000ms is taken from the measurement rather
 * than picked: it admits 11 of the 12 observed samples (168 to 970ms) and cuts
 * only the 2332ms outlier that motivated this change. So a miss costs about
 * what a miss costs, and the pathological case stops being the reader's problem.
 *
 * FAILURE IS NULL, NOT ZERO. An unbound binding, a rejected listing and an
 * expired budget all return null, and `admin.tsx` renders no badge for null.
 * Zero would be a claim that the index agrees with the corpus, made on no
 * evidence, next to a repair the operator would then not perform.
 *
 * **THE LATE WRITE IS NOW A PROMISE, AND THAT IS THIS WINDOW'S FIX. It was the
 * defect that made the cache self-perpetuating.** The paragraph here used to
 * say the late write "may not fire" and left it at that, calling it an
 * optimisation. It was not an optimisation, it was the mechanism, and treating
 * it as optional is what let the following loop run indefinitely:
 *
 *   1. a miss lists the index and the listing outruns the budget
 *   2. the budget wins, the response returns with no badge
 *   3. the write was floating, so it lands only if the isolate happens to
 *      outlive the response, and Workers may cancel pending work once a
 *      response is returned
 *   4. nothing was cached, so the NEXT request misses too, at step 1
 *
 * A slow listing therefore never populated the cache, and the TTL never got a
 * value to expire. MEASURED on production before the fix: 4 misses in 12
 * samples, at 1008, 436, 1009 and 507ms, and the only two that populated the
 * cache were the two that came in UNDER the budget. The cache filled by luck.
 *
 * `ctx.waitUntil` is the fix rather than a longer budget, because the budget is
 * not what is wrong: any budget has a listing slower than it, and raising the
 * number moves the line without removing the loop. `waitUntil` extends the
 * invocation's lifetime for exactly this, so the write lands whether or not the
 * response has already gone. The reader still waits at most `DRIFT_BUDGET_MS`,
 * which is the property the budget was there for.
 *
 * The ExecutionContext is a REQUIRED parameter and not an optional one, so a
 * call site that cannot supply it is a typecheck failure rather than a silent
 * return to the floating write. That is the same reasoning as the ordering
 * assertion above: structure, where structure is available.
 *
 * ## WHAT THIS IS NOT FOR
 *
 * The COUNT only. `/admin/posts` owns the repair and calls
 * `askStatusReader` for the full key lists, uncached, because a page whose job
 * is to fix drift must not act on a number up to five minutes old.
 */
```

### app/lib/search/ask.server.ts:771 (CONTRACT, shortened)

what the early return guarantees; one line already.

```ts
// THE EARLY RETURN. Nothing below this line runs on a hit, and section 11
  // asserts that no AI Search reference precedes it.
```

### app/lib/search/ask.server.ts:775 (WHY, shortened)

why the rejection is folded here; one line.

```ts
// Rejection is folded into the value here rather than caught at the race, so
  // a failing listing and an absent one reach the same null and the caller has
  // one thing to handle instead of two.
```

### app/lib/search/ask.server.ts:783 (WHY, shortened)

why it resolves rather than rejects; one line.

```ts
// The budget. Resolves to undefined rather than rejecting, so the race below
  // reads as "whichever arrives first" rather than as error handling.
```

### app/lib/search/ask.server.ts:792 (WHY, shortened)

why waitUntil and why the catch stays; the before measurement stays on the doc comment.

```ts
/*
     * The budget won. The listing is HANDED TO THE RUNTIME rather than left
     * floating: `waitUntil` is what makes the write land after the response,
     * and without it a listing slower than the budget could never populate the
     * cache, so the next request missed for the same reason and the cache
     * never filled. Grounds and the before measurement are on the doc comment.
     *
     * The `catch` stays. `waitUntil` rejecting is not better than a floating
     * rejection, and a failed listing here is the same non-event it is above:
     * there is no number to cache and the badge is already absent.
     */
```

### app/lib/search/ask.server.ts:820 (NUMBER, shortened)

where the number came from; the sample spread goes to the history document.

```ts
/**
 * How long a cache miss may hold the admin layout before it gives up.
 *
 * From the measurement, not from taste: 11 of 12 observed listings finished
 * inside this and the one it cuts is the 2332ms sample this change exists for.
 */
```

### app/lib/search/ask.server.ts:841 (WHY, shortened)

why a delete and not a write; one line already.

```ts
// The drift number just changed. A delete rather than a write, because this
  // path knows the cached value is stale and not what it became.
```

### app/lib/search/ask.server.ts:847 (CONTRACT, shortened)

what it removes and why; one line.

```ts
/**
 * Removes items that no longer correspond to a record.
 *
 * Upload is an upsert, so a renamed or deleted post leaves its old item behind
 * and it stays answerable forever. Same shape as the both-directions rule the
 * backup gate follows: what is present and should not be is as much a defect as
 * what is missing.
 */
```

### app/lib/search/ask.server.ts:865 (WHY, shortened)

why only on an actual removal; the pre-cache history goes to the history document.

```ts
// Removing items changes what the index holds, so the badge's cached number
  // is stale. This path invalidated NOTHING before the drift cache existed,
  // which was harmless while every read recomputed and is not once a value is
  // stored. Only on an actual removal: a prune that removed nothing changed
  // nothing, and dropping the key anyway would spend the next reader a listing.
```

## app/lib/editor/publish.server.ts

### app/lib/editor/publish.server.ts:1 (CONTRACT, shortened)

the order and why the gates are here; the ruling date goes to the history document.

```ts
/**
 * The editor's write path, end to end.
 *
 *   browser -> action -> gates -> GitHub commit (one markdown file) -> render -> D1
 *
 * The order matters and is the ruling of 2026-07-28: files are the source of
 * truth, so nothing reaches D1 that is not already committed. If GitHub is
 * unreachable the save fails whole and both the repository and the database are
 * left exactly as they were.
 *
 * The gates run here, server side, because a commit created through the GitHub
 * API never touches the local PreToolUse hooks. Without these checks the claim
 * that all prose passes the same gates would be false for everything written in
 * the editor.
 */
```

### app/lib/editor/publish.server.ts:52 (CONTRACT, shortened)

one statement of the rule; the seven restatements and the measurement go to the history document.

```ts
/**
 * Where a post's source file lives, as ONE statement of the rule.
 *
 * Exported since 2026-08-11. It was module-private, and the path was
 * consequently restated in SEVEN other places, including two more `postPath`
 * definitions of its own in the history and revisions routes. Measured with an
 * anchored grep over 92 files before the collapse:
 *
 *   publish.server.ts:64          the definition
 *   operator/api.server.ts:183    get_post
 *   operator/api.server.ts:236    delete_post
 *   admin.posts.$slug.edit.tsx:21 and :59
 *   admin.posts.$slug.history.tsx:32   a second definition
 *   admin.posts.$slug.revisions.tsx:31 a third definition
 *   admin.preview.ts:46
 *
 * Same class as `visibilityClause` and `SLUG_PATTERN` earlier the same week: N
 * statements of one rule with only some of them bound to each other. A bulk
 * retag would have added a ninth.
 */
```

### app/lib/editor/publish.server.ts:72 (CONTRACT, shortened)

why it is re-exported; the date goes to the history document.

```ts
/*
 * RE-EXPORTED, not defined here, since 2026-08-22. The definition moved to
 * `pipeline.mjs` beside `SLUG_PATTERN` because that module built the same path
 * independently for the artifact's `sourcePath`, which made hard rule 6's
 * "stated ONCE" false by one. Re-exporting keeps all eight importers here
 * unchanged; the string now exists in exactly one place.
 */
```

### app/lib/editor/publish.server.ts:93 (CONTRACT, shortened)

why it is not an error and why thrown from here.

```ts
/**
 * A first publication that nobody has confirmed yet.
 *
 * NOT AN ERROR, and it is a distinct class rather than an `EditorError` for
 * that reason: nothing failed and nothing was refused. The write stopped one
 * step short of the commit because the ceremony has not been answered, and the
 * editor turns this into a server-rendered second step exactly as an
 * unconfirmed delete becomes one (`app/lib/destructive.mjs` states the shape).
 *
 * Thrown rather than returned so the ceremony cannot be skipped by a caller
 * that forgets to read a flag, and thrown from `savePost` rather than checked
 * in the route because `savePost` is where the prior file is read, which is the
 * only place that knows whether this IS a first publication.
 */
```

### app/lib/editor/publish.server.ts:119 (WHY, shortened)

the both-writers rule and the three things it forces; the finding keeps its letter, the arc goes to the history document.

```ts
/**
 * Measures an image the editor referenced.
 *
 * BOTH BRANCHES EXIST TO AGREE WITH `scripts/lib/content.mjs`, and finding B002
 * is that neither did. Dimensions are written into the stored HTML by
 * `rehypeImageSources`, so they are part of the rendered HTML the
 * determinism gate compares: whatever this returns, `build:content` has to
 * return too, from a clone, with no bindings and no network.
 *
 * `/media/*` is resolved from the KEY. Those blobs live only in R2, so reading
 * bytes here was something the Node build could never match; the first
 * `/media/` citation would have committed HTML that `build:content` could not
 * reproduce. The key carries `-<w>x<h>` and both resolvers call the same
 * `dimensionsFromKey`, so nothing is fetched and nothing can drift.
 *
 * `public/*` is read from the REPOSITORY at the pinned ref, not from
 * `SITE_ORIGIN`. That was the second half of B002: the origin serves the
 * DEPLOYED asset while the build measures the working tree, so an image
 * retouched and committed but not yet deployed gave the two writers different
 * numbers for the same src. The repo is what a clone builds from, so the repo
 * is what this measures.
 *
 * THE PLACEHOLDER IS READ FROM THE REPOSITORY TOO, and from the same ref, which
 * is the whole reason it is not read from the bundled copy of the manifest this
 * Worker already imports. That copy is the manifest as of the last DEPLOY. The
 * dimensions three lines up come from the repository as of NOW, and a render
 * that mixed the two vintages would bake a placeholder from one commit beside a
 * measurement from another. B002 is exactly that class of mistake, one store
 * further out. One read per render rather than one per image: the manifest does
 * not change between two images in the same document.
 *
 * Exported so the admin preview route resolves images exactly as a save does.
 * There must not be a second implementation: preview's whole claim is that what
 * it renders is what publishes.
 */
```

### app/lib/editor/publish.server.ts:159 (WHY, shortened)

why it does not fail the save and why it is logged.

```ts
// A manifest that is missing or unparseable yields no placeholders rather
      // than failing the save. The value is an enhancement, the gate that keeps
      // it current is `check:content`, and refusing to publish a post because a
      // generated artifact could not be read would be a new way to lose an
      // article. It is logged, because silence here is the drift.
```

### app/lib/editor/publish.server.ts:205 (CONTRACT, shortened)

absent is a real answer; one line already.

```ts
// Absent for anything the manifest does not cover, which is every static
    // asset that is not a content raster. Absent is a real answer: the image
    // renders without a placeholder, exactly as it did before this existed.
```

### app/lib/editor/publish.server.ts:213 (CONTRACT, shortened)

what runs and when; one line already.

```ts
/**
 * Runs both gates against submitted markdown and renders it.
 *
 * Frontmatter validation and the wide-dash check happen before anything is
 * written anywhere. A rejection names the field or the line.
 */
```

### app/lib/editor/publish.server.ts:225 (WHY, shortened)

why by value; one line already.

```ts
// The first offender is guarded by VALUE rather than by the list length: same
  // refusal, and it is what lets the message below read its fields.
```

### app/lib/editor/publish.server.ts:252 (CONTRACT, shortened)

what is computed and what is not; the old path's equivalence goes to the history document.

```ts
/**
 * The saved post's related list, computed against the D1 corpus.
 *
 * Relatedness is a property of the whole corpus, and the corpus now lives in
 * D1: the committed artifact that used to carry it is gone. Only THIS post's
 * list is computed and written, which is exactly what the old save path
 * persisted too: it recomputed `related` across the artifact but synced only
 * the saved post's row, so every other row's copy waited for the next bulk
 * sync then and still does.
 */
```

### app/lib/editor/publish.server.ts:272 (CONTRACT, shortened)

why ISO strings; one line already.

```ts
// ISO strings, matching the shape `withRelated` compares in the build:
      // string order over ISO timestamps IS chronological order.
```

### app/lib/editor/publish.server.ts:276 (WHY, shortened)

why last, and the rule it avoids; one line.

```ts
// The saved post goes LAST, so `withRelated`, which maps in input order,
  // returns its entry at a position that cannot miss. `find` with a fallback
  // would be a substituting fallback on a can't-happen branch (rule 13).
```

### app/lib/editor/publish.server.ts:293 (CONTRACT, shortened)

the one-door rule and what the sha proves.

```ts
/**
 * THE ONLY DOOR TO A RENDERED ROW.
 *
 * Renders one post through the shared pipeline and writes everything a
 * rendered post owns in D1: the posts row (both provenance hashes included),
 * the FTS rebuild, its search_docs records, and its media_refs. `savePost`,
 * the operator API (through `savePost`), the content-drift repair and
 * `regenerateAllFromRepo` all come through here; nothing else may write a
 * rendered row, because two writers of one row shape is the drift the
 * committed artifact used to exist to catch.
 *
 * `blobSha`, when given, is the git blob sha of the file the REPOSITORY
 * holds, from a directory listing, a Contents read, or the commit that just
 * landed. `renderPost` hashes the bytes it rendered into
 * `record.sourceBlobSha`, so the equality check proves the rendered bytes ARE
 * the committed bytes: a truncated fetch or a file changing mid-flight fails
 * here, by name, instead of writing a row whose provenance lies.
 */
```

### app/lib/editor/publish.server.ts:317 (CONTRACT, shortened)

why the widening; one line already.

```ts
// `related` is corpus-scope and is attached below, which the pipeline's
  // inferred record type does not carry; the same widening the artifact
  // writers did implicitly.
```

### app/lib/editor/publish.server.ts:334 (WHY, shortened)

why at the door, why drafts too, and that it cannot fail the write; the ruling and the rate-limit note go to the history document.

```ts
/*
   * THE CACHE PURGE, AT THE ONE DOOR. Ruling 17, 2026-09-05.
   *
   * ## WHY HERE AND NOT AT FIVE CALL SITES
   *
   * Ruling 17 names five writes that purge `posts`: a publish, an unpublish, a
   * save of a published post, a content-drift repair, and the operator's corpus
   * sync. Every one of them reaches D1 through THIS FUNCTION, because hard rule
   * 18 already made it the one door and `regenerateAllFromRepo` the one bulk
   * form. Wiring the purge to the door rather than to the five callers means a
   * sixth writer added later is purged by construction rather than by somebody
   * remembering, which is the same argument that put the door here.
   *
   * ## IT PURGES ON A DRAFT SAVE TOO, AND THAT IS THE ACCEPTED COST
   *
   * A draft save changes nothing a reader can see, so this purge is wasted work
   * on those. The alternative is a condition on the record's status, and the
   * condition is where this gets subtly wrong: an UNPUBLISH writes a row whose
   * status is draft while changing every public listing, so "skip drafts" would
   * skip the one case that most needs the purge. Being right about unpublish is
   * worth a handful of unnecessary purges a day on a single-author site.
   *
   * Purge rate limits are the Free-tier zone limits regardless of plan. If that
   * ever binds, the fix is a condition that reads the PREVIOUS status rather
   * than this one, not a condition on the incoming record.
   *
   * It cannot fail this write: `purgePosts` reads `success`, logs, and returns
   * a boolean. Hard rule 18's second clause, a failed index write never reverts
   * the source, applied to a cache.
   */
```

### app/lib/editor/publish.server.ts:374 (WHY, shortened)

why the render runs twice.

```ts
/**
 * Saves a post: gates, one-file commit, then the render door.
 *
 * The commit carries exactly the markdown. The full render runs TWICE by
 * design: once here as the gate in FRONT of the commit, because a post that
 * fails frontmatter validation or image resolution must never land on main
 * (a committed post the pipeline refuses would redden the next build), and
 * once inside `renderAndWrite` AFTER it, because D1 is written only from a
 * row the one door produced. Rendering is deterministic; the determinism gate
 * in check:content proves that on every run, and one duplicated render costs
 * an admin save less than a second door would cost the repo.
 */
```

### app/lib/editor/publish.server.ts:393 (WHY, shortened)

why required and why there is no safe default; the four call sites and the date go to the history document.

```ts
/**
     * WHO IS WRITING. REQUIRED, with no default, since 2026-08-28.
     *
     * It was `actor?: Actor` defaulting to `{ kind: "admin" }`, which is the
     * most privileged principal on the site: the capability table gives admin
     * `write`, `firstPublish` and `destroy`, and operator and smoke each less.
     * So a call site that forgot to say who was asking was granted everything,
     * silently, and the four call sites that omitted it were all reached from
     * request handlers.
     *
     * They were in fact all admin paths, so nothing was wrong on the wire. That
     * is the point: the default was RIGHT four times out of four and would have
     * been wrong the first time somebody added a fifth caller on a path that
     * was not, with no diagnostic anywhere. A required field turns that into a
     * typecheck failure naming the file.
     *
     * Fail-closed would have been `{ kind: "operator" }`, and that is worse
     * rather than safer: it would quietly downgrade a real admin action and the
     * failure would be a refusal nobody could explain. There is no safe default
     * for an identity, which is why there is none.
     */
```

### app/lib/editor/publish.server.ts:415 (WHY, shortened)

why three-valued and why the check is an identity test.

```ts
/**
     * WHETHER THIS REQUEST CARRIES THE AUTHOR'S CONFIRMATION of a first
     * publication, on a path that HAS a ceremony.
     *
     * Three-valued on purpose, and the third value is the useful one. `true`
     * and `false` are the editor answering; ABSENT means "this caller has no
     * ceremony", which is the truth for the operator API (whom `decide()`
     * refuses a first publication outright, so a confirmation would be a
     * question asked of something that may not answer it) and for the posts
     * index's bulk repair (which publishes nothing).
     *
     * So the check below tests `=== false` rather than falsiness. A caller that
     * says nothing is not a caller that said no, and collapsing the two would
     * make every existing call site start refusing writes it is allowed to
     * make. The only way to reach the ceremony is to opt into it.
     */
```

### app/lib/editor/publish.server.ts:436 (WHY, shortened)

why the read comes first; one line.

```ts
// The existing file is read BEFORE anything is rendered, because it carries
  // the only authoritative answer to "has this post ever been published", and
  // because a write refused by policy should not pay for a render first.
```

### app/lib/editor/publish.server.ts:457 (WHY, shortened)

why here and why after the policy call.

```ts
/*
   * THE CEREMONY, CHECKED AGAINST THE PRIOR FILE AND BEFORE ANY WORK.
   *
   * `decide()` has just read the committed file, so `published-first` is the
   * authoritative answer to "is this the moment this post becomes public",
   * rather than anything the request asserted about itself. Refusing here costs
   * no render and no commit, and nothing has been written when it throws.
   *
   * It sits AFTER `decide()` deliberately, so a policy refusal still wins: a
   * credential that may not publish at all is told that, not asked to confirm.
   */
```

### app/lib/editor/publish.server.ts:472 (CONTRACT, shortened)

why the result is discarded; one line.

```ts
// Rendered from the STAMPED markdown, and rendered BEFORE the commit: this
  // is the gate, and its result is deliberately discarded. The row D1 gets is
  // the one `renderAndWrite` produces after the commit lands.
```

### app/lib/editor/publish.server.ts:483 (WHY, shortened)

the prohibition on compensating reverts and where a failure is recorded; the audit date goes to the history document.

```ts
/*
   * ONLY NOW, WITH THE COMMIT LANDED, DOES THE DATABASE CHANGE, and from here
   * the repo is ahead until the index catches up.
   *
   * **THE ORDER IS THE DESIGN AND IS NOT THE DEFECT.** The repo is the source
   * of truth; D1 is a derived index. So there is no compensating revert, and
   * there must never be one: undoing the commit to tidy the index would destroy
   * the authoritative copy to repair the derived one. A stale index serves
   * slightly old data; a reverted commit is lost writing.
   *
   * What the 2026-08-22 audit actually caught is the other half of its own
   * sentence, "with no record". A transient D1 failure now retries once, and a
   * persistent one is RECORDED where `sync_status` can see it and raised as an
   * error that names the post, the commit and the repair. Grounds on
   * `convergeWithRetry`.
   *
   * The recorder writes to KV, never to D1, because D1 is the store that just
   * failed and a record of that failure kept there is absent exactly when it is
   * wanted.
   */
```

### app/lib/editor/publish.server.ts:518 (WHY, shortened)

why clearing matters and why it cannot throw.

```ts
/*
   * A SUCCESSFUL WRITE CLEARS ANY EARLIER DIVERGENCE FOR THIS SLUG. Without
   * this the status surface would keep reporting a fault that a later save had
   * already repaired, and a stale alarm is how a real one stops being read.
   * It does not throw: failing to clear a record is strictly less bad than
   * failing the save that just succeeded.
   */
```

### app/lib/editor/publish.server.ts:531 (WHY, shortened)

when it fires, why after the sync, and why a survivor is inert.

```ts
/*
   * DRAFT PREVIEW LINKS DIE WHEN THE POST STOPS BEING A DRAFT. Feature G.
   *
   * `decision.published` is the incoming file's `draft: false`, so this fires on
   * a first publication, on a republication, AND on an ordinary save of a post
   * that is already live. The last of those revokes nothing because there is
   * nothing to revoke, and asking costs one KV list.
   *
   * AFTER the D1 sync, deliberately. The read path decides by asking the
   * database for `status = 'draft'`, so revoking BEFORE the row moved would open
   * a window in which the token is already gone and the row still says draft.
   * This order has no window in the direction that matters.
   *
   * IT DOES NOT THROW, and that is safe rather than convenient. A surviving
   * token is INERT: `/preview/:token` re-asks the database on every request
   * rather than trusting that this ran, so a failed revocation costs the author
   * a stale row in the drawer's list, not a leak. That is the same asymmetry the
   * Ask sync below is built on, and it is why the read path re-checks at all.
   */
```

### app/lib/editor/publish.server.ts:555 (WHY, shortened)

why a distinct value; one line already.

```ts
// null already means "not attempted", so a failure needs its own value.
```

### app/lib/editor/publish.server.ts:561 (WHY, shortened)

the asymmetry; one line.

```ts
// The AI index is downstream of D1 and MUST NOT be able to fail a save.
  // A post that is committed, rendered and searchable but briefly missing from
  // Ask is a degraded enhancement; a save that fails after the commit landed
  // would leave the repo and the database disagreeing about whether it
  // happened. Same asymmetry as the OG card gap, and recorded next to it.
```

### app/lib/editor/publish.server.ts:572 (CONTRACT, shortened)

why the flag exists; one line.

```ts
/**
     * True when the first D1 write failed and the retry succeeded. The save is
     * fine; this exists so a retry is visible rather than silent, because a
     * database that needs a second attempt on every save is a fault that would
     * otherwise never surface.
     */
```

### app/lib/editor/publish.server.ts:579 (CONTRACT, shortened)

why three states and not a count.

```ts
/**
     * How many preview links this save revoked. `null` when the post did not
     * move out of draft and nothing was attempted, `-1` when the attempt threw.
     * Three states rather than a count, because "0 revoked" and "never asked"
     * and "asked and failed" are different facts and a bare number tells them
     * apart only by accident.
     */
```

### app/lib/editor/publish.server.ts:589 (CONTRACT, shortened)

why the policy module names it; one line.

```ts
// What the save DID, for the editor to report. Named by the policy module
    // because only it read the prior file, and the prior file is the only thing
    // that can tell a first publication from a republication.
```

### app/lib/editor/publish.server.ts:596 (WHY, shortened)

why the marker names the operator; one line.

```ts
/**
 * Marks who wrote the commit.
 *
 * An operator's commits must be distinguishable in history from Dustin's, so
 * `git log` answers "did an agent write this" without anyone having to
 * cross-reference anything. The marker names the operator id, because "an
 * agent" is not a useful answer once there is more than one.
 */
```

### app/lib/editor/publish.server.ts:609 (CONTRACT, shortened)

what it returns and when null; one line already.

```ts
/**
 * Pushes one post into the Ask index, reporting failure instead of raising.
 *
 * Returns null when Ask is not configured, which is the ordinary state on a
 * deployment with the binding removed.
 */
```

### app/lib/editor/publish.server.ts:619 (WHY, shortened)

why a partial upload is not ok; one line.

```ts
/*
     * A PARTIAL UPLOAD IS NOT `ok`. `syncAskPost` no longer throws when a
     * single record fails, so without this the editor would be told the index
     * write succeeded while some of the post was missing from it, which is the
     * silent half of the defect the retry was added for.
     */
```

### app/lib/editor/publish.server.ts:644 (WHY, shortened)

why required here too; the grounds stay on savePost.

```ts
// `actor` is REQUIRED here for the reason `savePost` records at length: the
  // default was the most privileged principal, and deletion is the capability
  // the table is strictest about.
```

### app/lib/editor/publish.server.ts:651 (WHY, shortened)

the least-privilege rule and why it is the first statement; the date goes to the history document.

```ts
/*
   * **THE POLICY DECISION, BEFORE ANY READ OR WRITE.**
   *
   * Until 2026-08-17 this function took `actor` and used it ONLY to build the
   * commit message below, so there was no policy path at all: an operator token
   * forbidden by `decide()` from making a post public for the FIRST time was
   * permitted to DESTROY that same post, over the network through
   * `/api/operator`. Least privilege says the destructive verb needs more
   * authority than the publishing one, not less.
   *
   * First statement in the function deliberately. Placing it after the file
   * read would still refuse, but it would let an unauthorised caller probe
   * which slugs exist by the difference between two error messages.
   */
```

### app/lib/editor/publish.server.ts:680 (WHY, shortened)

the asymmetry and what matters here; one line.

```ts
// Same asymmetry as the save path: the AI index is downstream and cannot fail
  // the delete. A deleted post still answerable through Ask is the one failure
  // that matters here, so it is reported rather than swallowed.
```

### app/lib/editor/publish.server.ts:695 (CONTRACT, shortened)

why batch and why the rebuild; one line.

```ts
/**
 * Writes one rendered post into D1 and rebuilds the search index.
 *
 * Uses batch() so the row, its tags and the index move together. The FTS index
 * is rebuilt rather than left to the per-row triggers, matching what
 * scripts/sync-content.mjs does for the same reason.
 */
```

### app/lib/editor/publish.server.ts:777 (WHY, shortened)

the scope difference and why it shares the batch.

```ts
/**
 * The media citations this post emitted, replacing whatever it had before.
 *
 * SCOPED TO THIS SLUG, which is the difference from `sync:content`. That writer
 * holds the whole corpus and so replaces every `source_type='post'` row at once;
 * this one re-rendered exactly one post and must not touch another post's refs.
 * Both derive the refs from `renderPost`, so neither can invent a form the other
 * would not, which is the same both-writers rule `records.mjs` and `withRelated`
 * live under.
 *
 * In the same batch as the post write, so a save either records its citations or
 * does not happen. A post whose body no longer references an image, with the ref
 * left behind, would refuse a delete forever for a citation that is gone.
 */
```

### app/lib/editor/publish.server.ts:799 (WHY, shortened)

the separator argument, which is the correctness claim; the date and the dead-function history go to the history document.

```ts
/*
     * The primary key includes form and detail, so the same image cited twice on
     * one line in one form is one row. Deduped rather than left to fail a batch
     * that also carries the post itself.
     *
     * THE SEPARATOR IS THE WHOLE CORRECTNESS ARGUMENT, and it lives here now
     * because this is the LIVE writer. This line joined on a SPACE until
     * 2026-08-25, while the NUL-joined `mediaRefKey` (whose docblock argues the
     * point, and whose test proves it) was reachable only from a dead function.
     * The argument was written down, tested, and attached to nothing that runs.
     *
     * A printable separator COLLIDES: under a space, the refs
     * ("k", "inline", "line 3 alt") and ("k", "inline line", "3 alt") produce
     * the same key, so the second is dropped as a duplicate and a post citing
     * two different images silently records one. Details really do carry
     * spaces; the pipeline emits `detail: "cover image"`. NUL cannot occur in a
     * media key, a form or a detail, so the join is unambiguous.
     *
     * The shapes differ and that is deliberate rather than sloppy: the pipeline
     * emits `key` and the table column is `media_key`, so the adaptation is
     * made here at the one call site rather than by widening the helper to
     * accept two field names, which would make the helper the second owner of
     * a naming difference.
     */
```

### app/lib/editor/publish.server.ts:842 (CONTRACT, shortened)

why per-post replacement is safe here and not for related.

```ts
/**
 * Statements that replace one post's search records.
 *
 * Records are derived per post, so a save only has to replace its own. That is
 * what makes this safe to do incrementally where `related` is not: relatedness
 * is a property of the whole corpus and has to be recomputed across it, whereas
 * a post's sections depend on nothing but that post's own markdown.
 *
 * Derivation goes through the same app/lib/search/records.mjs the build script
 * uses. There is one indexer, for the same reason there is one renderer.
 */
```

### app/lib/editor/publish.server.ts:886 (WHY, shortened)

what the delete prevents; the finding keeps its letter, the repair history goes to the history document.

```ts
/**
 * Removes a post's rows. Tag rows stay, matching the bulk sync's behaviour.
 *
 * THE `media_refs` DELETE IS FINDING B003, and it is the one line here that is
 * not merely tidiness. A save already scope-clears that slug's refs through
 * `mediaRefStatements`, and the bulk sync clears every `source_type='post'` row
 * before rewriting them, so delete was the only lifecycle edge that left them.
 *
 * The consequence was not a stale row, it was a permanently refused delete. The
 * media delete action fails closed on EITHER channel, the refs table or the
 * resolver scan, and it is right to: refs are precise and the scan is a
 * conservative superset, so the union is what makes a refcount safe once blobs
 * are shared. But after a post was deleted the resolver correctly reported zero
 * citations while `media_refs` still claimed one, so the image it had cited
 * could never be removed from the library. `Regenerate all` did not repair it
 * either at the time: it looped the posts that still existed and never issued
 * a scoped delete for a slug that was gone. Only a full `sync:content`, which
 * rewrites the table wholesale, cleared it.
 *
 * In the same batch as the post row, for the reason `mediaRefStatements` gives:
 * a delete either records that the citations are gone or does not happen.
 */
```

### app/lib/editor/publish.server.ts:909 (WHY, shortened)

why both tags and why before the delete.

```ts
// The row is going, so every listing that carried it is stale AND the post's
  // own page must stop being served from cache. Both tags, because the page and
  // the listings are different entries. Purged BEFORE the delete rather than
  // after, deliberately: a purge that lands first can only cost a re-render of
  // a page that still exists, where one that lands after a slow delete could
  // re-store the page it was meant to remove.
```

### app/lib/editor/publish.server.ts:932 (CONTRACT, shortened)

what the door is and the rule it follows.

```ts
/**
 * Re-renders every post in the repository into D1.
 *
 * THE REBUILD DOOR, and the one RECOVERY.md points at: one Contents directory
 * listing (which carries every file's blob sha for free), one read per file,
 * and `renderAndWrite` per post, so every row arrives through the same door a
 * save uses (rule 18: a derived store is repaired through its derivation).
 * The blob sha from the listing rides along so each render proves it rendered
 * the bytes the repository holds.
 *
 * The recovery path for drift between commits made from a clone and commits
 * made in the editor, and the bulk half of the content-drift repair.
 */
```

### app/lib/editor/publish.server.ts:949 (WHY, shortened)

the scope assertion and the destructive reading it refuses.

```ts
// SCOPE, ASSERTED. An empty listing here is a deleted content directory or
  // a broken read, and "sync 0 posts, delete every row" is the destructive
  // reading of both. Refuse rather than converge on an empty corpus.
```

## app/lib/operator/api.server.ts

### app/lib/operator/api.server.ts:1 (CONTRACT, shortened)

the one-implementation rule; the ruling date and the refactor note go to the history document.

```ts
/**
 * The operator publish tools.
 *
 * Every write here calls the SAME functions the browser editor's action calls:
 * `savePost` and `deletePost` in publish.server.ts. Nothing in this file talks
 * to GitHub, to D1, or to the AI index directly, and nothing here re-implements
 * a gate. That is the ruling of 2026-07-28, and it is the reason the refactor
 * this session expected turned out to be unnecessary: `savePost(env, options)`
 * already took a plain env and options rather than a Request, so the editor
 * action was already a thin adapter over a callable module.
 *
 * The read tools go through D1 and per-file repository reads the same way the
 * admin surfaces do, so an operator sees what the editor sees.
 */
```

### app/lib/operator/api.server.ts:60 (WHY, shortened)

the traversal it refuses and why the pattern is imported; the audit date goes to the history document.

```ts
/**
 * A slug, validated against the SAME predicate the write path enforces.
 *
 * Every one of these values is interpolated into `content/posts/<slug>.md` and
 * handed to the GitHub contents API, which builds its URL with `encodeURI`.
 * `encodeURI` does NOT escape `.`, `/` or `?`, so `../../../../user?` walks out
 * of the posts directory and truncates the rest into a query string, on a
 * request that carries the GITHUB_TOKEN bearer header.
 *
 * The WRITE path was always safe: renderPost requires the frontmatter slug to
 * equal the expected one and the schema pins it to kebab-case. The READ paths
 * had no such check and ran first. Found by the external audit of 2026-08-11.
 *
 * SLUG_PATTERN is imported rather than restated, so there is one statement of
 * the rule and not a copy that can drift from the schema's.
 */
```

### app/lib/operator/api.server.ts:82 (WHY, shortened)

why the bound is applied here too; one line.

```ts
/*
   * THE LENGTH BOUND IS APPLIED HERE TOO, and for the reason the pattern is:
   * a read path that accepts what the write schema refuses interpolates a
   * slug the repository can never hold into a GitHub API path. Same constant,
   * imported, never a second number.
   */
```

### app/lib/operator/api.server.ts:126 (CONTRACT, shortened)

the typecheck idiom and why it moved; the drifted copy goes to the history document.

```ts
/**
 * What GET /api/operator says about each tool, beside the dispatch that runs it.
 *
 * KEYED BY `ToolName`, the `WRITE_CAPABILITIES` idiom (hard rule 13): a tool
 * added to `TOOLS` without a descriptor is a TYPECHECK failure, and a
 * descriptor for a tool that does not exist is one too, so the self-description
 * cannot drift from the dispatch in either direction.
 *
 * MOVED HERE 2026-08-25 because the route carried a hand-written copy of this
 * list and it had already drifted the way a second copy does: `sync_ask` and
 * `sync_media` were callable, ship called both on every run, and the
 * description a caller wires itself up from named neither. Rule 17: the
 * dispatch below is the fact, this table is bound to it by the key, and the
 * route renders what it is handed.
 */
```

### app/lib/operator/api.server.ts:257 (CONTRACT, shortened)

why the operator has it and why unfiltered; the proof-by-clicking anecdote goes to the history document.

```ts
/**
 * The moderation queue, over the operator token.
 *
 * WHY THE OPERATOR GETS THIS AT ALL. Approving a mention was the one step in
 * the webmention path that needed a human with a browser, and it was proven on
 * 2026-09-05 by asking Dustin to click a button so a purge could be measured.
 * A step that can only be taken by hand is a step that gets taken late, and
 * this is a moderation queue whose whole value is being read.
 *
 * UNFILTERED BY DEFAULT, which is what `/admin/mentions` shows and for the same
 * reason: an operator triaging a queue has to see the failures as well as the
 * pending rows, or it cannot tell "nothing arrived" from "everything was
 * refused".
 *
 * READS THROUGH THE SAME FUNCTION THE ADMIN PAGE READS. The status filter is
 * applied here rather than in a second query, so there is one statement of what
 * the queue IS and this cannot come to disagree with the page about it. The
 * table is bounded by the endpoint's open-queue cap plus whatever has been
 * approved, so filtering in memory costs nothing worth a second query shape.
 */
```

### app/lib/operator/api.server.ts:286 (WHY, shortened)

why a bad status is a 400; one line.

```ts
/*
     * A STATUS THE COLUMN CANNOT HOLD IS A 400, not an empty list. An agent
     * that typed `pendign` and got `[]` would conclude the queue was empty,
     * which is the wrong repair and is indistinguishable from the right one.
     * The set is the schema's CHECK constraint, stated here because a caller
     * needs to be told what it may ask for.
     */
```

### app/lib/operator/api.server.ts:327 (CONTRACT, shortened)

the one-door rule and where the capability check lives.

```ts
/**
 * Approve, reject or delete one mention, and purge the page it changed.
 *
 * IT CALLS `decideMention` AND NOTHING ELSE, which is the point of that
 * function existing. The write and the purge travel together there, so this
 * cannot ship the half that changes the database without the half that makes
 * the change visible. The admin page's action calls the same door.
 *
 * THE CAPABILITY CHECK IS INSIDE THAT DOOR TOO, reading `WRITE_CAPABILITIES`,
 * so the refusal is the same one whichever caller asks. An operator may
 * approve and reject and may not delete, which is `delete_post`'s shape and
 * `delete_post`'s reason: this removes the only copy of what a stranger sent.
 */
```

### app/lib/operator/api.server.ts:367 (WHY, shortened)

why changed:false is an answer; one line.

```ts
/*
   * `changed: false` IS A REAL ANSWER AND NOT AN ERROR. The row may not exist,
   * or may be `unverified` or `failed`, which the DB layer's `where` refuses
   * because neither has evidence to approve. Reporting that as a 404 would make
   * a caller retry something that will never succeed; reporting it as success
   * with `changed: false` tells it what happened.
   */
```

### app/lib/operator/api.server.ts:386 (CONTRACT, shortened)

why translation is the contract; one line.

```ts
/**
 * Runs one tool.
 *
 * Errors are TRANSLATED here rather than thrown, and the translation is the
 * contract: a gate rejection returns the gate's own message with the field and
 * line it named, verbatim. An agent that gets "invalid frontmatter" and nothing
 * else cannot fix its own mistake, and the whole point of exposing this path is
 * that the caller can.
 */
```

### app/lib/operator/api.server.ts:441 (CONTRACT, shortened)

what it returns and why named; one line already.

```ts
// Policy refusal. 403, and it names the policy so a caller can branch on it
  // rather than string-matching the prose.
```

### app/lib/operator/api.server.ts:463 (WHY, shortened)

why its own branch, why matched on name, and why 500.

```ts
/*
   * DIVERGENCE IS ITS OWN BRANCH, ahead of the generic 500.
   *
   * It is distinguishable from the three failures above in the way that
   * matters to a caller: a PolicyError (403) and an EditorError (422) both mean
   * NOTHING HAPPENED and the request should be corrected and retried. A
   * GitHubError (409/502) means nothing was committed. This one means the
   * OPPOSITE: the commit landed, the writing is safe, and retrying is the one
   * response that does not help.
   *
   * Matched on `name` rather than `instanceof`, because the error is
   * constructed in a `.mjs` module and a cross-module identity check through
   * two build graphs holds only until something duplicates the module.
   *
   * 500 rather than a 4xx: the caller did nothing wrong. Not 502, which this
   * file already uses for GitHub, because the upstream that failed is ours.
   * `detail.code` is the machine-readable half so a client can branch without
   * parsing prose.
   */
```

### app/lib/operator/api.server.ts:508 (CONTRACT, shortened)

why D1 and what the field names mean; the arc goes to the history document.

```ts
/*
   * D1, not the repository, since the artifact arc: the rows are what the
   * site serves, they converge to the repo (rule 18, held by the
   * content-drift health check), and a listing that needed no GitHub call
   * before needs none now. Field names are the tool's contract and are
   * unchanged; `date` derives from publishAt and `updated` is the revision
   * date, both of which is what they always meant.
   */
```

### app/lib/operator/api.server.ts:557 (WHY, shortened)

why it is answered from the file; one line.

```ts
// Whether an operator may publish this post is a question about the FILE,
      // so it is answered from the file and reported rather than left to be
      // discovered by a 403.
```

### app/lib/operator/api.server.ts:585 (WHY, shortened)

why unconditional is deliberate for this caller.

```ts
// Absent expectedHeadSha the save is unconditional. That is a deliberate
  // choice for a non-browser caller: it has no page to reload, and forcing it
  // to read-then-write would make every agent save a two-call dance. A caller
  // that wants the editor's conflict semantics passes the sha from get_post.
```

### app/lib/operator/api.server.ts:608 (CONTRACT, shortened)

why reported not raised; one line already.

```ts
// The AI index cannot fail a save, so its outcome is reported rather than
      // raised. A caller that ignores this still got a correct save.
```

### app/lib/operator/api.server.ts:640 (CONTRACT, shortened)

why it exists, why idempotent and why the counts are read back; the measurement and its date go to the history document.

```ts
/**
 * THE FULL-CORPUS ASK UPLOAD, as an operator operation.
 *
 * ## Why this exists at all
 *
 * `savePost` keeps Ask in step for a post published THROUGH the editor. Nothing
 * kept it in step for a post published by COMMIT, which is how most of this
 * site's writing lands: `ship` runs `sync:content`, which rebuilds D1 and both
 * FTS indexes and does not touch AI Search. So every git-authored change left
 * the answer index behind, silently, until somebody read an alert.
 *
 * Measured 2026-08-23: the scheduled health check went red four polls running
 * with `expected 91, present 90`, and shipping nine post updates widened it to
 * `expected 99, present 90`, tracking `search_docs` growth exactly. The repair
 * was a human clicking sync-ask in the admin, which is a step nobody is holding.
 *
 * ## IDEMPOTENT, and that is what makes it safe as a pipeline step
 *
 * The upload writes every record under a key derived from its URL, so running
 * it twice writes the same keys with the same content; the prune then removes
 * anything in the index that the corpus no longer names. Running it when there
 * is nothing to do is a no-op that costs a listing.
 *
 * ## THE COUNTS ARE READ BACK, NOT ACCUMULATED
 *
 * `uploaded` is what the loop thinks it wrote. `expected` and `present` come
 * from D1 and from AI Search AFTERWARDS, and `converged` is derived from those
 * two. A caller cannot be told this succeeded by an operation that merely ran.
 */
```

### app/lib/operator/api.server.ts:671 (CONTRACT, shortened)

the stance on an absent binding; one line already.

```ts
// Same stance the Ask endpoint takes: absent binding means the feature is
    // not here, rather than here and broken.
```

### app/lib/operator/api.server.ts:679 (WHY, shortened)

why a drift read here can be a moment behind; one line.

```ts
/*
   * READ BACK AFTER BOTH WRITES. Between the upload and this read the index is
   * eventually consistent, so a drift reported here can be a moment behind
   * rather than a fault; ship says exactly that when it refuses, and the next
   * scheduled health poll is the tiebreaker.
   */
```

### app/lib/operator/api.server.ts:699 (CONTRACT, shortened)

the rule-18 shape, why the button stays and why no poll; the ruling, the directive and the OFL row go to the history document.

```ts
/**
 * REBUILDS THE MEDIA INDEX, THROUGH THE DERIVATION, AND PROVES IT AFTERWARDS.
 *
 * The door that lets `ship` and the health workflow do what previously only a
 * human clicking a button in `/admin/media` could do. Ruled 2026-08-24 under
 * the standing AUTOMATE directive: a chore that ends in a person's hands and is
 * not a decision is a defect. The OFL.txt row waited weeks for that click.
 *
 * ## THE BUTTON IS NOT REPLACED, AND THAT IS DELIBERATE
 *
 * `/admin/media`'s rebuild intent calls `rebuildMediaIndex` too, and keeps
 * doing so. It is the MANUAL REPAIR: the thing you reach for when something has
 * gone wrong out of band. What changes is that the routine case, an index that
 * drifts because a ship added or removed an asset, no longer needs it.
 *
 * ## RULE 18, WHICH IS THE WHOLE SHAPE OF THIS FUNCTION
 *
 * The index converges toward the repository and the bucket, never the reverse,
 * and a derived store is repaired THROUGH ITS DERIVATION rather than by a hand
 * written INSERT. So this takes no arguments describing what to write: it calls
 * the same derivation the button calls, and the row arrives the way every other
 * row arrived. There is deliberately no way to ask this endpoint to index one
 * key, because that is the shape that turns an index into a second truth.
 *
 * ## THE VERDICT IS RECONCILED, NEVER SUPPLIED
 *
 * `rebuildMediaIndex` returns what its loops think they wrote. `converged`
 * comes from `mediaIndexStatus`, which re-enumerates both buckets and the
 * manifest and reads D1 back afterwards, and from the failure list. A caller
 * cannot be told this worked by an operation that merely ran.
 *
 * ## NO POLL, AND THE REASON IS STRUCTURAL RATHER THAN OPTIMISTIC
 *
 * `sync_ask` waits out a convergence window because AI Search is a separate,
 * eventually consistent service: its write is visible to a later read on its
 * own schedule. This store is D1, the rebuild AWAITS every upsert and delete
 * before returning, and the read-back happens in the SAME Worker request, which
 * reads its own writes. There is no interval during which a correct rebuild
 * reports drift, so a window would only slow a real failure down. Measured
 * rather than assumed: see the ship report for this batch.
 */
```

### app/lib/operator/api.server.ts:740 (CONTRACT, shortened)

why it is safe unattended and why the verdict is read back.

```ts
/**
 * THE MIRROR REPAIR, as an operator operation. The fourth repairable class.
 *
 * `media-backup-drift` compares MEDIA against MEDIA_BACKUP; this is its repair,
 * and both derive their work from the SAME `backupStatus`, so what the check
 * calls drift is exactly what this copies. That is the same one-owner shape the
 * other three repairs follow.
 *
 * ## WHY THIS ONE IS SAFE TO FIRE UNATTENDED
 *
 * It has no delete branch, in either bucket, and it never writes to MEDIA. The
 * worst a spurious run can do is rewrite a twin with the bytes it already had.
 * Every other repair in the table can remove something; this one cannot, which
 * is the argument recorded in `REPAIRABLE` for allowing self-repair here.
 *
 * ## IDEMPOTENT, AND THE VERDICT IS READ BACK
 *
 * Running it against a converged mirror copies nothing and reports converged.
 * The counts come from a SECOND comparison taken after the writes, on the same
 * rule the three syncs follow: a report assembled from the loop's own counters
 * describes what the loop believed rather than what the store holds.
 */
```

### app/lib/operator/api.server.ts:769 (CONTRACT, shortened)

why it is not an error; one line already.

```ts
// An object that vanished between the comparison and the copy. Not an
      // error: its twin, if it had one, is exactly what the mirror is for.
```

### app/lib/operator/api.server.ts:799 (WHY, shortened)

why parsed and why base64 only.

```ts
/**
 * A `data:` URI's own declaration, or null when this is bare base64.
 *
 * Parsed rather than stripped, because the prefix carries the MIME type and an
 * agent that pasted a whole data URI has already told us what it thinks the
 * bytes are. Only base64 payloads are accepted: a percent-encoded `data:` URI
 * is a different encoding and silently mis-decoding one would store rubbish
 * under a digest that looks perfectly valid.
 */
```

### app/lib/operator/api.server.ts:817 (WHY, shortened)

why whitespace is stripped; one line already.

```ts
// Whitespace is what a base64 blob acquires by travelling through a chat or a
  // YAML block, and `atob` throws on it.
```

### app/lib/operator/api.server.ts:830 (WHY, shortened)

why chunked and abandoned rather than buffered.

```ts
/**
 * The response body, up to a cap, or null if it went past it.
 *
 * READ IN CHUNKS AND ABANDONED AT THE CAP, rather than `arrayBuffer()` then a
 * length check. A `Content-Length` is a claim the far end makes and a body can
 * simply not stop; buffering it whole to discover that is the shape where a
 * remote URL decides how much memory this isolate uses.
 */
```

### app/lib/operator/api.server.ts:863 (CONTRACT, shortened)

the order and why; one line already.

```ts
/**
 * What to record as `original_name` when the caller did not say.
 *
 * The URL's last path segment first, because that is what the file was called
 * at the far end and is the closest thing to a name a person chose. Otherwise
 * `upload.<ext>`, which at least describes the object.
 */
```

### app/lib/operator/api.server.ts:876 (CONTRACT, shortened)

why caught anyway; one line already.

```ts
// An unparseable URL never gets this far; `uploadMediaTool` parsed it to
      // check the protocol. Caught anyway rather than thrown out of a naming
      // helper, and the extension form below is the answer.
```

### app/lib/operator/api.server.ts:882 (WHY, shortened)

why this is not a substituted default; one line.

```ts
// NOT a substituted default (hard rule 13): a type outside the allowlist is
  // one statement away from being refused by `storeUpload`, so this name is
  // never stored. Returning `upload.bin` would be the substitution.
```

### app/lib/operator/api.server.ts:888 (CONTRACT, shortened)

the adapter rule, the two ways in, the three guards and why the declared type wins; the ruling number stays.

```ts
/**
 * THE BUCKET, as an operator operation. Ruling 32d.
 *
 * ## IT IS AN ADAPTER, and `storeUpload` is the write
 *
 * Everything that decides what lands in MEDIA is in `app/lib/media/upload.server.ts`
 * and is the same code `/admin/media/upload` runs: the same allowlist, the same
 * size limit, the same content-addressed key, the same custom metadata and the
 * same non-fatal annotation row. What is here is only how bytes REACH that
 * door over an HTTP tool call, which is the half the editor solves with a
 * multipart form.
 *
 * ## TWO WAYS IN, AND THE URL IS THE LOAD-BEARING ONE
 *
 * `data` is base64, which is the obvious shape and the one that does not scale:
 * a 13 MB photograph is 17 MB of base64 and no agent is carrying that through a
 * conversation. `url` is what makes the tool usable, and it is why the ruling
 * named both.
 *
 * ## WHAT GUARDS THE FETCH
 *
 * The primary control is that this endpoint is behind `OPERATOR_TOKEN` and a
 * rate limiter, so the caller is already trusted. Said plainly because the
 * three checks below are secondary and should not be mistaken for the fence:
 *
 *   HTTPS ONLY   `http:` is refused along with every other scheme. This Worker
 *                holds GITHUB_TOKEN and OPERATOR_TOKEN, and a fetch is the one
 *                place a caller chooses where it goes.
 *   CAPPED READ  `readCapped` abandons the body past MAX_BYTES rather than
 *                buffering it to find out how big it was.
 *   THE SAME CONTRACT  the bytes then meet `validateUpload` exactly as a form
 *                upload does, so a fetched HTML page is refused by the
 *                allowlist and a mislabelled SVG by the markup check.
 *
 * The type the caller declares WINS over the response's own `Content-Type`, and
 * that is deliberate: a perfectly good PNG served as `application/octet-stream`
 * is common, and refusing it would make the URL path useless against half the
 * web. It is safe because the declared type is checked against the allowlist
 * and against the bytes, which is the same treatment `file.type` gets on the
 * form path, where it is equally a claim.
 */
```

### app/lib/operator/api.server.ts:938 (WHY, shortened)

why both is refused rather than resolved.

```ts
/*
   * EXACTLY ONE SOURCE. Both given is refused rather than resolved by a
   * precedence rule, because a caller that supplied both has two different
   * images in mind and silently picking one stores the wrong photograph under a
   * digest that will never look wrong.
   */
```

### app/lib/operator/api.server.ts:976 (WHY, shortened)

why the explicit argument wins; one line already.

```ts
// The URI's own type only when the caller named none: an explicit argument
    // is the more deliberate statement of the two.
```

### app/lib/operator/api.server.ts:980 (WHY, shortened)

why the encoded length and why it is generous.

```ts
/*
     * REFUSED ON THE ENCODED LENGTH, before `atob` allocates anything. Base64
     * is 4 characters per 3 bytes, so this is arithmetic on the string in hand
     * rather than a guess, and it is deliberately GENEROUS: it only has to stop
     * an absurd payload from being decoded, and `validateUpload` states the
     * real limit afterwards against the real byte count.
     */
```

### app/lib/operator/api.server.ts:1028 (WHY, shortened)

why the protocol is re-checked after redirects.

```ts
/*
     * THE PROTOCOL IS CHECKED AGAIN, ON WHERE IT LANDED.
     *
     * `fetch` follows redirects, and a `https://` URL is free to redirect to
     * `http://`. Checking only the URL the caller typed would make the https
     * rule above a check on the caller's typing rather than on where the bytes
     * came from, which is the wrong half of the question.
     *
     * `response.url` is the post-redirect URL; falling back to the request's
     * own href keeps this closed rather than open if it is ever empty.
     */
```

### app/lib/operator/api.server.ts:1078 (WHY, shortened)

why the split; one line already.

```ts
// The response's own claim, only when the caller made none. Split on `;`
    // because `image/svg+xml; charset=utf-8` is one of the two types where a
    // charset parameter is normal, and the allowlist holds bare types.
```

### app/lib/operator/api.server.ts:1086 (WHY, shortened)

the two reasons, and which one would have hurt.

```ts
/*
   * COPIED INTO A FRESH ArrayBuffer rather than handed `bytes.buffer`.
   *
   * Two reasons, and the second is the one that would have hurt. `.buffer` is
   * typed `ArrayBufferLike`, so it does not satisfy the door's parameter at
   * all. And it is the whole underlying allocation, not the view: it happens to
   * be exactly the content today because `decodeBase64` and `readCapped` each
   * size their array to what they read, but that is a property of those two
   * functions rather than of this call. A later change to either would hash and
   * store the wrong bytes under a key that still looks perfectly valid.
   */
```

### app/lib/operator/api.server.ts:1113 (CONTRACT, shortened)

placeholder, replaced by f3.

```ts
// The editors' own two keys, from the same function that builds theirs,
      // so the string an agent puts in markdown and the string the editor
      // inserts are one statement rather than two that agree today.
```

### app/lib/operator/api.server.ts:1120 (CONTRACT, shortened)

placeholder, replaced by f3.

```ts
/*
       * THE ANNOTATION ROW IS REPORTED, not assumed. It is written non-fatally
       * because the object is already in R2 and a D1 hiccup must not report
       * failure for a write that happened, which is right and leaves an
       * operator with no way to see it. `false` here means the object landed
       * and the row did not: the repair is `sync_media`, which re-derives it.
       */
```

### app/lib/operator/api.server.ts:1132 (CONTRACT, shortened)

placeholder, replaced by f3.

```ts
/**
 * THE CONTENT-DRIFT REPAIR, as an operator operation.
 *
 * The third repairable class. The content-drift health check compares
 * `posts.source_blob_sha` against the repository's blob shas; this is its
 * repair, and the two derive their work from the SAME `contentDriftCompare`,
 * so what the check calls drift is exactly what this repairs. It is also what
 * makes a markdown commit from any machine live within one health poll with
 * no deploy: the scheduled workflow calls this through the same door ship's
 * syncs use.
 *
 * ## RULE 18, THE WHOLE SHAPE
 *
 * Scoped, but never hand-written: every drifted slug is re-rendered through
 * `renderAndWrite`, the one door to a rendered row, with the listing's blob
 * sha riding along so the door proves it rendered the bytes the repository
 * holds. A row whose file is gone loses its rows through the same
 * `deletePostFromD1` a delete uses. Nothing here can construct a row.
 *
 * ## IDEMPOTENT, AND THE VERDICT IS READ BACK
 *
 * Running it against a converged corpus repairs nothing and reports
 * converged. `expected`/`present`/`converged` come from a SECOND listing and
 * a second row read taken after the writes, never from the loop's own
 * counters, on the same rule as the other two syncs.
 */
```

### app/lib/operator/api.server.ts:1195 (CONTRACT, shortened)

placeholder, replaced by f3.

```ts
// READ BACK AFTER THE WRITES. D1 reads its own writes in-request, so a
  // correct repair can never report drift here; a reported drift is real.
```

### app/lib/operator/api.server.ts:1214 (CONTRACT, shortened)

placeholder, replaced by f3.

```ts
/**
 * What the operator can see about the state of the pipeline without guessing.
 *
 * Deliberately reports the three stores separately, because they can disagree
 * and the whole design assumes they fail independently.
 */
```

### app/lib/operator/api.server.ts:1220 (CONTRACT, shortened)

placeholder, replaced by f3.

```ts
/**
 * EXPORTED since 2026-08-25, because the cockpit renders it.
 *
 * `/admin` is the human-readable view of the instruments, and rule 17 says the
 * page renders what an instrument reports rather than computing a second
 * answer. So the cockpit calls THIS function, the one the `sync_status`
 * operator tool calls, and there is no admin-side copy of the four store
 * counts to drift from it. The export is the whole change; nothing about the
 * body moved.
 */
```

### app/lib/operator/api.server.ts:1231 (CONTRACT, shortened)

placeholder, replaced by f3.

```ts
/*
   * The repository's post count, from ONE Contents directory listing. The
   * field is still named `artifactPosts` because the field names are the
   * tool's contract; what it has always meant is "how many posts the
   * repository holds", and that is what it still reports now that the
   * committed artifact is gone.
   */
```

### app/lib/operator/api.server.ts:1243 (CONTRACT, shortened)

placeholder, replaced by f3.

```ts
// Counted through DRIZZLE, not by interpolating publiclyVisible() into a
  // template string. It returns a Drizzle expression object, so interpolation
  // stringifies it to "[object Object]" and D1 answers
  //   no such column: object Object at offset 38
  // on every call. That is how this shipped: locally the tool failed earlier,
  // at the missing GITHUB_TOKEN, and never reached the query. Found by the live
  // round trip, which is the only place it could have been found.
  //
  // Hard rule 1 is why the predicate is reused rather than rewritten in SQL:
  // every public read composes publiclyVisible(), and a hand-copied WHERE
  // clause here would be exactly the drift that rule exists to prevent.
```

### app/lib/operator/api.server.ts:1271 (CONTRACT, shortened)

placeholder, replaced by f3.

```ts
// Counted on the docsize shadow table, never COUNT(*) on the index itself:
    // that reads THROUGH to search_docs and can never detect drift.
```

### app/lib/operator/api.server.ts:1276 (CONTRACT, shortened)

placeholder, replaced by f3.

```ts
/*
     * COMMITS THAT LANDED WHILE D1 DID NOT FOLLOW.
     *
     * The fourth store this tool reports on, and the only one whose absence is
     * the interesting state: an empty list is the normal answer. Read from KV
     * rather than D1 on purpose, because a record of a D1 failure kept in D1 is
     * missing exactly when it matters.
     *
     * `known: false` is a distinct answer from an empty list. A status tool
     * that cannot read one of its stores must say so rather than report zero,
     * which is the same distinction `d1Posts` would need if the query threw.
     */
```

## app/lib/seo.ts

### app/lib/seo.ts:1 (WHY, shortened)

why a leaf file has an import; the rejected move of publicationsJsonLd goes to the history document.

```ts
/*
 * THE ONE IMPORT IN THIS FILE, and it is worth a line saying why.
 *
 * `seo.ts` was import-free: a leaf every public route and several build scripts
 * pull from. `publicationsJsonLd` below needs to decode character references so
 * the emitted schema.org `headline` and `name` are the strings a human reads
 * rather than the escaped forms the corpus stores, and a builder that leaves
 * that to its callers emits a wrong VALUE the first time one forgets.
 *
 * The alternative considered and not taken was moving `publicationsJsonLd` out
 * of this file, which is probably where it belongs. That is a bigger change
 * than the bug it would be riding along with.
 */
```

### app/lib/seo.ts:14 (CONTRACT, shortened)

the boundary: which project compiles this file and what that forbids.

```ts
/*
 * RELATIVE, not the `~/` alias every route uses. `tsconfig.node.json` carries
 * no path mapping, and it has to compile this file because `ship.mjs` imports
 * SITE_ORIGIN from it, so an aliased import here fails the build scripts'
 * project while compiling fine for the Worker. Same spelling the other modules
 * that straddle both projects use.
 */
```

### app/lib/seo.ts:23 (CONTRACT, shortened)

what it is, why it is fixed, and the cutover item; the prerendering measurement goes to history.

```ts
/**
 * The canonical public origin. Every absolute URL the site emits (canonical,
 * OG, JSON-LD, RSS, sitemap, robots) derives from this and never from
 * `request.url`.
 *
 * Why a module constant rather than a wrangler var or a binding: prerendering
 * runs in Node at build time, with no request and no Worker env, so anything
 * read off the request context is unavailable there. Deriving from the request
 * is also what baked `http://localhost:<port>` into the prerendered JSON-LD
 * when prerendering was measured on 2026-07-27.
 *
 * A canonical URL should name the canonical origin regardless of which host
 * served the response, so this being fixed is correct rather than a limitation.
 *
 * DNS cutover item: change this to https://dustinedwards.info at the same time
 * as BETTER_AUTH_URL and the Google redirect URI.
 */
```

### app/lib/seo.ts:42 (WHY, shortened)

why it is derived rather than written out; one line.

```ts
/**
 * The default social card, for any page without one of its own.
 *
 * Derived from SITE_ORIGIN rather than written out, so it names workers.dev
 * today and dustinedwards.info the moment the cutover changes the constant
 * above. Hardcoding the apex would point every scraper at the legacy WordPress
 * site until DNS moves, which is a broken card rather than a future-proof one.
 */
```

### app/lib/seo.ts:52 (CONTRACT, shortened)

which fields are structured data and which are copy; the split's date goes to history.

```ts
/**
 * The site's identity, in one place, split by the job each string does.
 *
 * `role` and `affiliation` are STRUCTURED DATA: they are the jobTitle and
 * worksFor a machine reads, so they stay short, literal and true. `eyebrow` and
 * `tagline` are the homepage's own words and are free to be sentences. They
 * were one field until 2026-07-29, when the hero copy stopped being a job
 * title, and a hero line pushed into jobTitle would have made the Person record
 * assert a sentence no schema consumer can use.
 */
```

### app/lib/seo.ts:72 (CONTRACT, shortened)

the one-owner rule and the ratified precedence; the extraction date goes to history.

```ts
/**
 * Everything a post's head tags are built from, in ONE place.
 *
 * Extracted from `blog.$slug.tsx`'s `meta()` on 2026-08-02, unchanged, when the
 * editor gained SERP and social-card previews. A preview whose job is to show
 * what the site emits cannot be allowed to compute it a second way: the moment
 * the two disagree the preview is lying, and it would lie silently, because
 * nothing renders both at once to compare them.
 *
 * So the public route and the admin preview call this and nothing else derives
 * a canonical URL, a page title or a card image. Same rule `records.mjs` and
 * `reading-time.mjs` live under.
 *
 * The precedence here is the ratified one and is not this function's to change:
 * a per-post cover wins, then the card `build:og` generated, then the site mark,
 * so a post whose card has not been built yet shares as the brand rather than
 * as nothing.
 */
```

### app/lib/seo.ts:112 (WHY, shortened)

why the editor shows this rather than a placeholder; one line.

```ts
/**
     * True when the card fell all the way through to the site mark. The editor
     * shows this rather than a placeholder, because "no cover" is not a missing
     * preview, it is a real and correct outcome the author should see.
     */
```

### app/lib/seo.ts:121 (NUMBER, shortened)

why the limits are approximations; the pixel widths stay because they are what the number approximates.

```ts
/**
 * Where a search result stops, which is NOT where the description field's own
 * counter stops.
 *
 * Google truncates by rendered PIXEL width, roughly 600px of title and 920px of
 * desktop description, so any character count is an approximation of a measure
 * this site cannot take. These are the usual approximations of those widths and
 * they are stated as such: a preview that cut at the field's 160-character
 * counter would show a full description in a result that will actually be
 * clipped, which is the one thing a SERP preview exists to prevent.
 */
```

### app/lib/seo.ts:132 (CONTRACT, shortened)

the invocation, the one-builder rule and the card pairing; the five-page audit goes to history.

```ts
/**
 * The COMPLETE social and canonical set for a hand-authored page.
 *
 * ## Why this is a function and not five copies
 *
 * Five pages each hand-assembled part of this list and each stopped at a
 * different point. Measured 2026-08-20: the HOME PAGE, which is the URL people
 * paste, carried `og:image` and `twitter:card` and had NO canonical, no
 * `og:title`, no `og:description`, no `og:url` and no `og:type`. The colophon
 * and the roster carried a title and a description and nothing else. Projects
 * and playground carried canonical and OG text and no image and no card.
 *
 * Every one of those is the same omission with a different edge missing, which
 * is what a copied literal does over time. One builder means a page cannot ship
 * a partial set, and adding a property later reaches every page at once.
 *
 * ## The canonical matters more than it did
 *
 * `SITE_ORIGIN` is still `workers.dev` and the site moves to the apex at DNS
 * cutover. A page with no canonical is a page that will exist at two hostnames
 * with no statement about which is authoritative, which is duplicate content by
 * construction rather than by accident. Emitting it now means the cutover is a
 * change to one constant rather than an SEO incident.
 *
 * ## Twitter card
 *
 * `summary_large_image` on every page, because every page has an image: the
 * argument falls through to the site mark, which is a real 1200x630 card rather
 * than a placeholder. A `twitter:card` without an image renders as a bare link,
 * so the two travel together or neither is worth setting.
 *
 * @param page `path` is site-absolute and starts with a slash.
 */
```

### app/lib/seo.ts:170 (CONTRACT, shortened)

what the two values mean and the prohibition on a hand-assembled set.

```ts
/**
   * The Open Graph type. `website` for every hand-written page, which is what
   * they are, and `article` for a page that IS a work.
   *
   * Added 2026-09-12 for the per-paper publication pages. Those were written
   * with a hand-assembled tag array first, because they need a repeated
   * `citation_author` tag that this helper has no business knowing about, and
   * `check:invariants` section 13 refused it: five pages once ended up with
   * five different partial social sets, and "this page is special" is exactly
   * how the sixth would. The section is right and the repair is to teach the
   * helper the one thing the page actually needed differently, not to exempt
   * it. The citation tags are still appended by the route, which is correct:
   * they are not social metadata and no other page has them.
   */
```

### app/lib/seo.ts:205 (CONTRACT, shortened)

what it does and what the caller can infer; already near the calibration.

```ts
/**
 * Cuts at the last WORD boundary before the limit, the way a search engine
 * does, rather than mid-word. Returns the text unchanged when it fits, so the
 * caller can tell truncation happened by comparing.
 */
```

### app/lib/seo.ts:233 (CONTRACT, shortened)

what the string permits and why HTML needs no Vary; the rename and the seven-route audit go to history.

```ts
/**
 * THE STRING THAT PERMITS SHARED CACHING. Ten minutes at the edge, then a day
 * of stale-while-revalidate, so a deploy or a content sync propagates quickly
 * without every reader paying for an origin hit.
 *
 * ## RENAMED 2026-08-23, because the old name and comment were both wrong
 *
 * It was `PUBLIC_CACHE_CONTROL` and its comment read "Cache policy for public
 * NON-HTML surfaces" and "**Not for HTML.**" That was false on both counts, and
 * it had been false for some time: SEVEN HTML routes set this value. home, the
 * blog index, the post route, colophon, phage-discovery, playground and search
 * all return it from `headers()`.
 *
 * The name now says what the value DOES rather than which surfaces were
 * imagined to use it, because a name that encodes a surface claim goes stale
 * the first time a surface changes its mind, and nothing fails when it does.
 *
 * ## HTML MAY USE IT, AND SINCE 2026-09-05 IT NEEDS NO `Vary` TO BE SAFE
 *
 * The old comment was reaching for something true: an HTML document here
 * embeds reader state, because the theme is read from a cookie and written
 * into `<html data-theme>` in the first byte. A bare `public` on that WOULD
 * serve one reader's theme to another.
 *
 * What used to make it safe was a pairing: the route returned this WITH
 * `Vary: Cookie`, and `workers/app.ts` refused to store any response generated
 * for a cookie-bearing request, so the only variant ever written was the
 * cookieless one.
 *
 * WHAT MAKES IT SAFE NOW IS THE CACHE KEY. The theme is a dimension of the key
 * the platform owns, passed as `ctx.props` and in `cf.cacheKey` by the gateway
 * in `workers/app.ts`. A dark document and a light one are different entries
 * rather than one entry the second reader must be kept away from, which is why
 * every reader can now be served from cache instead of only the cookieless
 * ones. Ruling 16, 2026-09-05.
 *
 * The pairing did not disappear, it changed partners: what travels with this
 * string is now `Cache-Tag`, so a response that can be stored can also be
 * purged. `publicHtmlHeaders` is still the shape that cannot drop half of it.
 */
```

### app/lib/seo.ts:273 (NUMBER, shortened)

why the number is declared here and the prohibition on parsing it back out.

```ts
/**
 * THE LIFETIME ITSELF, and it is the owner rather than a copy of the string.
 *
 * INVERTED 2026-09-04, when `/admin/mentions` had to tell an operator how long
 * an approval takes to reach a reader. That sentence is a statement about this
 * number, and hard rule 17 gives a measured value one owner: a page typing
 * "ten minutes" beside a constant reading 600 is two owners that agree until
 * the day somebody changes one.
 *
 * So the number is declared and the header is built from it. The alternative
 * considered and refused was parsing `s-maxage=(\d+)` back out of the string,
 * which reintroduces the same problem one level down: a parse that stops
 * matching has to substitute something, and a substituted cache lifetime is a
 * false claim rather than a missing one.
 *
 * Nothing compares this header's TEXT against a literal, checked before the
 * inversion: `check:headers`, `check:browser`, `check:features` and
 * `check:page-payload` all test for the IDENTIFIER's presence, and
 * `verify-live` reads the value through this export. Two prose mentions of
 * `s-maxage=600` exist in gate comments and neither is an assertion.
 */
```

### app/lib/seo.ts:299 (CONTRACT, shortened)

why it is exported rather than computed by its reader; one line.

```ts
/**
 * The same lifetime in minutes, for prose that has to state it.
 *
 * ONE READER TODAY: the approval note on `/admin/mentions`. It is exported
 * rather than computed there because the thing being stated is a property of
 * the cache policy, not of the admin page, and a page that derived it itself
 * would be the second owner this constant exists to prevent.
 */
```

### app/lib/seo.ts:309 (WHY, shortened)

the prohibition on re-adding Vary; the 2026-08-02 variant measurement goes to the history document.

```ts
/**
 * `HTML_VARY` WAS `"Cookie"` AND WAS DELETED 2026-09-05. Ruling 16.
 *
 * What it said, and it was true of the arrangement it belonged to: a route
 * carrying it declared that its body depends on the Cookie header, and
 * `workers/app.ts` then refused to store any response generated FOR a
 * cookie-bearing request, so the only variant ever written was the cookieless
 * one. Measured 2026-08-02: an ABSENT Cookie header is not treated as its own
 * variant, so a cookieless request matches whatever variant is already stored,
 * and a reader with `theme=dark` warming the entry served every first-time
 * visitor a dark document. Full matrix: Capsid
 * `dustinedwards/workers-cache-vary.md`.
 *
 * **THAT DEFECT WAS A PROPERTY OF `Vary`, AND `Vary` IS WHAT WENT.** The theme
 * is now a dimension of the cache KEY, where absence is not a special case: a
 * request with no theme cookie resolves to a theme like every other request and
 * keys on it. There is no stored variant for it to match by accident.
 *
 * Nothing replaced it, deliberately. Emitting `Vary: Cookie` now would fragment
 * the cache on every unrelated cookie value, which is the cost the old
 * arrangement paid and this one exists to stop paying.
 */
```

### app/lib/seo.ts:332 (CONTRACT, shortened)

the vocabulary a caller needs and the prohibition behind one owner; the ruling pointer stays.

```ts
/**
 * Cache tags for a public HTML response. ONE OWNER of the tag vocabulary.
 *
 * Ruling 17, 2026-09-05. Every shared-cacheable HTML response carries
 * `Cache-Tag`, so that a write can invalidate exactly what it changed instead
 * of waiting out `s-maxage` or purging everything.
 *
 * ## THE VOCABULARY IS THREE WORDS AND THAT IS ON PURPOSE
 *
 *   `post:<slug>`  one post's page. The only per-document tag.
 *   `posts`        anything whose content is a function of the corpus: the
 *                  post page too, the index, the tag archives, the series
 *                  hubs, the feeds, the sitemap and llms.txt. A publish moves
 *                  all of them at once, so they purge together.
 *   `pages`        the hand-authored pages that do not read the corpus.
 *
 * **`pages` IS INERT TODAY AND IS STILL WORTH SENDING.** Nothing calls a purge
 * for it: those pages change only when the code changes, and the Worker version
 * is in the cache key, so a deploy already invalidates them. It is here so that
 * "every shared-cacheable response is purgeable by name" is a property of the
 * site rather than a description of most of it, and so the gate that asserts
 * the header can be universal rather than carrying an exemption list.
 *
 * A SPELLING MISTAKE HERE IS A PURGE THAT SILENTLY DOES NOTHING, which is why
 * this is a function and not a literal at eleven call sites: `cache.purge`
 * reports `success: true` for a tag that matches no stored response, because
 * there is nothing for it to report. One owner is the only defence.
 *
 * @param slug when present, the post this response IS
 */
```

### app/lib/seo.ts:369 (CONTRACT, shortened)

the pairing and what dropping half of it costs; the /projects defect goes to history.

```ts
/**
 * The `headers()` a public HTML route returns. ONE definition, many callers.
 *
 * ## IT WAS A PAIRING AND IT IS STILL A PAIRING, with a different second half
 *
 * Four routes once returned `Cache-Control` and `Vary` character for character,
 * and /projects returned nothing at all, so it fell through to hard rule 8's
 * uncached default and was the one public page never edge-cached. That is why
 * this helper exists and the reason has not changed.
 *
 * What travels with the shared string now is `Cache-Tag` rather than `Vary`. A
 * copy-paste that dropped the old second half was the measured theme bug; one
 * that drops this one is a response nothing can purge, which fails quietly
 * instead of visibly. `check:headers` asserts the pairing on every route that
 * names the shared string, in both directions.
 *
 * @param tag the cache tag for this response, from `cacheTags` or `PAGES_CACHE_TAG`
 */
```

### app/lib/seo.ts:391 (CONTRACT, shortened)

why Accept stays and Cookie went; the measured wire bytes go to the history document.

```ts
/**
 * For the routes that negotiate on Accept.
 *
 * `Cookie` LEFT THIS STRING 2026-09-05 and `Accept` stays, because the two were
 * never the same kind of claim. The post page and `/search` genuinely serve
 * more than one representation at one URL, and a shared cache that ignored that
 * would hand a markdown request the HTML copy: measured on the wire after
 * `2f0b4d5`, 31,869 bytes of `text/html` answering `Accept: text/markdown`.
 */
```

### app/lib/seo.ts:402 (CONTRACT, shortened)

what it refuses and the two mechanisms that set it; the rename goes to history. The hard rule citation stays.

```ts
/**
 * THE STRING THAT REFUSES STORAGE. Nothing may keep this response: not a
 * shared cache, not an intermediary, not the browser.
 *
 * ## RENAMED 2026-08-23, because the old name named the wrong thing
 *
 * It was `HTML_CACHE_CONTROL`, which read as "the cache policy for HTML". It is
 * not: the HTML routes return the SHARED string above. What actually sets this
 * is the NON-HTML half of the site, the markdown twin and the JSON branch of
 * `/search`, plus two mechanisms rather than routes.
 *
 * Those two are why the value matters more than its callers. It is hard rule
 * 8's default in `workers/app.ts`, applied to every response that declares no
 * `Cache-Control` of its own, and it is what a cookie-bearing request gets on
 * the HTML routes after the downgrade there. Both are the fail-closed
 * direction, and both are invisible from any route file.
 */
```

### app/lib/seo.ts:433 (CONTRACT, shortened)

why both vocabularies read one derivation; the 2026-09-03 gap goes to history.

```ts
/**
 * THE ARTICLE FACTS BOTH VOCABULARIES STATE, derived once.
 *
 * JSON-LD and Open Graph describe the same article to two different readers,
 * and until 2026-09-03 only the first was emitted: a crawler that reads OG and
 * not JSON-LD got a weaker article than the page already knew about.
 *
 * The obvious way to fix that is to write four `article:*` tags in the route,
 * and it is the wrong one. `dateModified` is not `updatedAt`, it is
 * `updatedAt ?? publishAt`, and the author is not a string in the route, it is
 * a shape this file owns. A second derivation would agree on the day it was
 * written and drift on the day either rule changes, which is the exact defect
 * the `image` field above already carries a comment about.
 *
 * So both callers read THIS. `articleJsonLd` spreads it into schema.org names
 * and `articleOpenGraph` maps it to `article:*` names, and neither computes a
 * value of its own. The gate compares the two outputs field by field, so the
 * claim is checked rather than asserted here.
 */
```

### app/lib/seo.ts:463 (CONTRACT, shortened)

why it returns a list and what an absent value must not become.

```ts
/**
 * The `article:*` Open Graph properties, from `articleFacts` and nothing else.
 *
 * `article:tag` REPEATS, one property per tag, which is what the vocabulary
 * says and is why this returns a list rather than an object. The JSON-LD side
 * joins the same array into a single `keywords` string, because that is what
 * schema.org asks for; the two spellings are a property of the vocabularies,
 * not of the data, and they come from one array either way.
 *
 * A tag or a date that is absent yields NO tag rather than an empty one. An
 * `article:published_time` with no content is a claim that the article has no
 * publication date, which is worse than saying nothing.
 */
```

### app/lib/seo.ts:502 (CONTRACT, shortened)

why it asks postSocial rather than restating the chain; the two-statement defect goes to history.

```ts
/*
     * ONE RESOLUTION, SHARED WITH THE CARD.
     *
     * This read `coverImage` alone while `postSocial` falls through cover, then
     * the generated OG card, then the site mark. So a post with a built card and
     * no cover told a social crawler it had a card and told Google it had NO
     * image at all, from two statements about the same post on the same page.
     *
     * Asking `postSocial` rather than restating its chain is the point: the two
     * cannot disagree again, and a fourth fallback added later reaches both.
     * `postSocial` always returns an absolute URL and never null, so this is
     * never undefined, which is also the correct schema.org answer.
     */
```

### app/lib/seo.ts:522 (CONTRACT, shortened)

why the two vocabularies spell one array differently; trimmed to two lines.

```ts
// Same array the OG side emits one property per entry from. Joined here
    // because schema.org wants one string; that difference is the vocabulary's,
    // not a second opinion about which tags this post has.
```

### app/lib/seo.ts:557 (CONTRACT, shortened)

separator keeps its label and the ruling pointer; the dashes and the restoration commit go.

```ts
/* --------------------------------------------------------------- Publications
 *
 * RESTORED 2026-09-12. These left the file at `70dbedc` when PR #3 retired the
 * academic routes, and come back unchanged in behaviour. Ruling 63 is why.
 */
```

### app/lib/seo.ts:569 (CONTRACT, shortened)

what they are; the deletion and restoration go to the history document.

```ts
/**
 * Authority records that identify the site owner, for schema.org sameAs.
 *
 * These were deleted at `f6bf2ac` as orphaned by the route removals, which was
 * true at the time and stopped being true the moment a per-paper page needed to
 * say which Dustin Edwards wrote the paper.
 */
```

### app/lib/seo.ts:587 (WHY, shortened)

why the sameAs array exists and why the two Person nodes are not one; the merge count goes to history.

```ts
/**
 * schema.org Person for the site owner, carrying the authority links.
 *
 * The sameAs array is the point of this node. There is another academic named
 * Dustin Edwards working in writing and rhetoric, and OpenAlex has already
 * merged seven of his works into this author record. Naming the ORCID, the
 * Scholar profile and the faculty page gives a consumer three ways to tell the
 * two apart without guessing from a name string.
 *
 * `personJsonLd` above is the HOME PAGE's Person and carries no `@id` and no
 * sameAs. The two are not a duplication to collapse: that one describes the
 * site owner to a reader arriving at the site, this one exists so a citation
 * graph can join a paper's author to a specific human being.
 */
```

### app/lib/seo.ts:617 (WHY, shortened)

why it matches loosely; the author positions go to the history document.

```ts
/**
 * Match the site owner in an author list.
 *
 * He is last author on some papers and 14th of 108 on others, and the
 * registries return three spellings of his name, so this keys on surname plus
 * a D initial rather than an exact string.
 */
```

### app/lib/seo.ts:631 (CONTRACT, shortened)

what the shape is and what collapsing it would misstate.

```ts
/**
 * One Person node followed by a ScholarlyArticle per publication.
 *
 * Co-authors stay as plain Person objects; only the owner's entry becomes an
 * `@id` reference to the Person node. Replacing the whole author array with a
 * single reference would drop 107 co-authors from one record and misstate
 * authorship on every other.
 *
 * Built from the filtered list, so the structured data always describes what
 * the page actually renders.
 */
```

### app/lib/seo.ts:659 (CONTRACT, shortened)

why the decode is here and why it does not break the escaping invariant.

```ts
/*
       * DECODED HERE RATHER THAN AT THE CALL SITE, because this function is the
       * one owner of the node shape and a caller that forgot would emit
       * `Journal of Microbiology &amp; Biology Education` as a schema.org
       * `name`, which is a wrong VALUE rather than a display glitch: a
       * consumer reading this graph has no reason to suspect the string needs
       * unescaping, and nothing downstream would ever tell it.
       *
       * Safe with respect to the invariant it looks like it breaks. Decoding
       * can produce a literal `<`, and `jsonLd()` escapes `<` and `>` on the
       * way into the script element, so the element still cannot be closed
       * early. The stored corpus keeps its escapes either way.
       */
```

## workers/watchdog.ts

### workers/watchdog.ts:1 (CONTRACT, shortened)

the boundary: which builder reads the path mapping and what that forbids.

```ts
/*
 * RELATIVE IMPORTS, DELIBERATELY, where the rest of workers/ uses `~/`.
 *
 * `workers/app.ts` and `workers/media-events.ts` are built by Vite through the
 * React Router build, which resolves the `~/*` tsconfig path. This Worker is
 * built by `wrangler deploy -c wrangler.watchdog.jsonc`, which bundles with
 * esbuild directly and does not read that mapping. A `~/` specifier here would
 * typecheck and fail at deploy.
 */
```

### workers/watchdog.ts:24 (CONTRACT, shortened)

which Worker it names and why it is not derived; the gate binding stays.

```ts
/**
 * The Worker the error rate is asked about.
 *
 * The SITE, never this watchdog. Written out rather than derived from
 * SITE_ORIGIN, because the origin is a hostname and this is a script name: they
 * are equal today by coincidence of naming and the cutover changes one of them.
 * `check:config` binds it to the site config's `name`.
 */
```

### workers/watchdog.ts:34 (CONTRACT, shortened)

the four boundary statements and the two prohibitions; the 1042 probe table, the schedule counts and the throttle burst go to the history document.

```ts
/**
 * THE WATCHDOG. A separate Worker whose only job is to notice that this site
 * has stopped being healthy, repair what it can, and wake somebody otherwise.
 *
 * Ruled 2026-08-29. `.github/workflows/health.yml` has done this since
 * 2026-08-23 and its own docblock explains why an in-Worker watcher was
 * rejected: a watcher that runs inside the thing it watches dies with it. That
 * argument is still correct and this Worker does not contradict it. **A
 * SEPARATE Worker on the same account has the property the rejection wanted**
 * against everything except a Cloudflare-wide outage, in which case the site is
 * down anyway and there is nothing to report.
 *
 * ## WHY IT EXISTS AT ALL: THE GITHUB SCHEDULE IS NOT RUNNING
 *
 * MEASURED 2026-08-28 over the run history. Against 96 expected firings a day,
 * the every-fifteen-minutes schedule fired **38 times on 08-23 and 2 times on
 * 08-28**. Every run that fires succeeds; the daily browser cron decays the
 * same way. `health.yml`'s own note (2) predicted this in prose ("a 15-minute
 * cadence is a request, not a promise") and note (1) named the failure mode
 * that makes it invisible. Self-repair was effectively not running, and the
 * inbox looked exactly as it does when everything is fine.
 *
 * A Cron Trigger is not best-effort in the same way. It is the platform's own
 * scheduler on the account that runs the site.
 *
 * ## THE MEASUREMENT THAT DECIDED THE TRANSPORT, AND IT IS NOT WHAT WAS SPECCED
 *
 * This was specified as "GET the site's /api/health". **A Worker cannot do
 * that to this site.** Measured 2026-08-29 from a throwaway Worker on the edge,
 * with a control:
 *
 *     fetch("https://example.com/")                    200   <- control
 *     fetch("<site>/")                                 404, Cloudflare 1042
 *     fetch("<site>/api/health")                       404, Cloudflare 1042
 *     env.SITE.fetch("<site>/api/health")              200, the real body
 *
 * Error 1042 is the Worker-to-Worker-on-one-zone restriction, and the docs say
 * the replacement outright: "Using global fetch() to call another Worker on the
 * same zone without service bindings fails. Workers accept requests sent to a
 * Custom Domain." This site is on `*.workers.dev` and has no custom domain
 * until the DNS cutover, so a service binding is the ONLY mechanism available.
 * The control matters: it proves the probe's `fetch` worked, so the two 1042s
 * are a fact about this host rather than about the instrument.
 *
 * **WHAT THAT COSTS, STATED RATHER THAN BURIED.** A service binding invokes the
 * site Worker directly. It therefore proves the health suite RUNS and that
 * every invariant holds; it does NOT prove the site is reachable from the
 * internet. A broken route or a DNS fault with a healthy Worker is invisible
 * here. That coverage is why `health.yml` survives at all: it now runs hourly,
 * off-platform, as the second and slower opinion, and it is the only instrument
 * that speaks from outside Cloudflare. The cutover retires the gap.
 *
 * ## THE HEALTH CALL IS THE LIVENESS SIGNAL, AND IT IS ALREADY ON THE PAGE
 *
 * `/api/health` writes the KV snapshot on the way out, for both verdicts. The
 * home page's health tile renders that snapshot's AGE and nothing else. So
 * **the tile's freshness IS this Worker's liveness**: if the watchdog stops
 * firing, the snapshot ages and the front page says so, with no second timer
 * and nothing new to monitor. That is also what the production freshness
 * assertion in `check:browser` reads, which is why it can prove this Worker
 * fired since a deploy without ever talking to it.
 *
 * The corollary is the part worth remembering: nothing here writes the snapshot
 * itself, and nothing may. The snapshot is a byproduct of a run that happened
 * anyway (`app/lib/health/snapshot.mjs`), and a watchdog that stamped it
 * directly would be manufacturing its own alibi.
 *
 * ## THROTTLING, MEASURED RATHER THAN ASSUMED
 *
 * `/api/health` is rate limited at 20 per 60 seconds per caller identity, and
 * there is NO bypass and no authenticated shape: the endpoint is
 * unauthenticated and takes no credential at all. So this Worker grows neither.
 *
 * Measured 2026-08-29 by bursting the service binding: calls share ONE bucket
 * and the eighteenth was refused. This fires once per 900 seconds against an
 * allowance of 20 per 60, which is roughly three orders of magnitude of
 * headroom, and the bucket is not shared with public traffic because every
 * request off the edge carries its own `cf-connecting-ip`.
 *
 * And the failure is LOUD rather than silent. A refusal answers 429 with a body
 * naming `rate-limited`, which is deliberately not a repairable class, so it
 * reaches the unknown arm and sends mail naming the throttle. A throttled
 * watchdog wakes somebody; it does not quietly report health.
 *
 * ## WHAT IS DECIDED HERE: NOTHING
 *
 * Every decision is in `app/lib/health/repair.mjs`, which is pure, imports
 * nothing and never fetches. This file is the I/O half, on the same split as
 * `scripts/health-repair.mjs`, and for the reason that split exists: a Cron
 * Trigger fires unattended and the only firings whose behaviour matters are the
 * ones nobody is watching. What can be tested is, and this walks an action list
 * rather than branching on a verdict, so a step removed from the list is a step
 * this Worker stops taking.
 *
 * ## THE SECRET
 *
 * `OPERATOR_TOKEN`, a wrangler secret on THIS Worker, set separately from the
 * one on the site. It is the same value and there are now THREE holders of it
 * (the site Worker, this Worker, and the GitHub repository secret), so rotation
 * touches all three; CLAUDE.md's bindings section carries that note.
 *
 * Its absence is a NAMED configuration state, never silence: `repairPlan`
 * returns alert-only and the run still mails. A monitor that quietly lost the
 * ability to act looks exactly like one that never needed to.
 */
```

### workers/watchdog.ts:140 (CONTRACT, shortened)

why it is a var, why it is still out of git, and the gate that reconciles it.

```ts
/**
 * Where the alert goes, and where the repair door is.
 *
 * `ALERT_EMAIL` is a VAR rather than a secret, on the `CLOUDFLARE_ACCOUNT_ID`
 * precedent: an inbox address is not a credential, so making it a secret would
 * spend `check:secrets`' signal on a value that grants nothing. It is still
 * kept out of git, because this repo is meant to be copied as a template and a
 * personal address in a tracked config is the thing that leaks on the day it is
 * copied. Real value in the gitignored `wrangler.watchdog.jsonc`, placeholder
 * in the tracked example, reconciled in both directions by `check:config`.
 */
```

### workers/watchdog.ts:159 (CONTRACT, shortened)

which is a credential and what absence means; the precedent pointer stays.

```ts
/**
   * The account the invocations query is asked of, and the credential for it.
   *
   * `CLOUDFLARE_ACCOUNT_ID` is a VAR on the `ALERT_EMAIL` precedent: an account
   * id is an identifier rather than a credential. `CLOUDFLARE_API_TOKEN` IS a
   * credential and is a wrangler secret, scoped to Account Analytics Read and
   * nothing else, because all it does is run one read-only GraphQL query.
   *
   * BOTH OPTIONAL, and their absence is a NAMED state rather than silence, the
   * same shape `OPERATOR_TOKEN` takes above: `errorRateReading` reports "not
   * configured" and the firing says so, so a watchdog that quietly lost the
   * ability to see errors does not look like one seeing none.
   */
```

### workers/watchdog.ts:176 (WHY, shortened)

why the key is namespaced; one line.

```ts
/**
 * Where the last firing's verdict is kept.
 *
 * Namespaced with a `watchdog:` prefix because this shares the site's KV with
 * Better Auth sessions and the Ask answer cache, and a bare key in a shared
 * namespace is how two subsystems come to own one string.
 */
```

### workers/watchdog.ts:185 (CONTRACT, shortened)

the two answers the signature exists to keep apart.

```ts
/**
 * Reads the last firing's state.
 *
 * **ABSENT AND UNREADABLE ARE DIFFERENT ANSWERS**, and collapsing them is the
 * failure this signature exists to prevent. Absent means nothing has run yet,
 * which is a baseline and mails nothing. Unreadable means the dedupe is blind,
 * and a blind dedupe that stays quiet is a monitor that silently stopped
 * monitoring. `alertTransition` mails on the second and not the first.
 */
```

### workers/watchdog.ts:208 (WHY, shortened)

which failure is the cheap one; one line.

```ts
/**
 * Writes the state. NEVER THROWS.
 *
 * A failed write costs the NEXT firing its dedupe, which at worst means one
 * duplicate mail. Letting it throw would cost THIS firing its alert, which is
 * the thing the whole Worker exists to deliver. The cheap failure is the right
 * one to take.
 */
```

### workers/watchdog.ts:232 (CONTRACT, shortened)

why the sender is not derived; the onboarding measurement goes to history.

```ts
/**
 * The sender. On `dustinedwards.info`, which is onboarded to Email Sending
 * (measured 2026-08-29: `wrangler email sending list` reports it enabled).
 *
 * NOT derived from `SITE_ORIGIN`, and that is deliberate rather than an
 * oversight. `SITE_ORIGIN` is `*.workers.dev` until the cutover, and a
 * `workers.dev` sender would be refused: the from-domain must be one onboarded
 * for sending. The mail domain and the serving origin are separate facts that
 * happen to converge later.
 */
```

### workers/watchdog.ts:247 (CONTRACT, shortened)

never throws, keeps the cause, and why it is exported; the old catch goes to history.

```ts
/**
 * Reads `/api/health` through the service binding.
 *
 * NEVER THROWS. A transport failure is returned as status 0 with a null body,
 * which `watchdogActions` turns into a notify: an endpoint that could not be
 * reached is a reason to wake somebody, and it must not be a reason for this
 * handler to die before it can send the mail saying so.
 *
 * **AND IT KEEPS THE CAUSE**, since 2026-09-11. The catch was
 * `catch { return { status: 0, body: null } }`, which collapsed DNS failure, a
 * timeout and a 1042 into one indistinguishable reading, and the mail that
 * woke somebody said only that no failing check was named. Those are different
 * pages: a timeout is a site problem, a 1042 is this Worker's binding pointed
 * somewhere it may not go, which is a deploy problem. `repair` below has kept
 * `error.message` since it was written; this is the same discipline applied to
 * the read.
 *
 * `cache-control: no-cache` is belt only. The route declares `no-store` and a
 * service binding does not go through the edge cache at all, but a reading that
 * could be served from anywhere is not a health check, and stating it costs a
 * header.
 *
 * EXPORTED FOR ONE REASON: `test/worker/watchdog.test.ts` drives it with a
 * `SITE` binding whose `fetch` throws, which is the only way to observe the
 * catch. A thrown transport error is not something a live probe can arrange
 * on demand, so the alternative to exporting it is not covering it at all.
 * The `scheduled` handler below is still the only caller in the deployed
 * Worker.
 */
```

### workers/watchdog.ts:291 (CONTRACT, shortened)

the verdict rule and what the token may not touch.

```ts
/**
 * One repair call through the operator API. `miss` is empty when it converged;
 * `unrepairable` marks a refusal that repeating this call cannot fix.
 *
 * THE VERDICT IS READ, NEVER INFERRED FROM A 200. Same rule ship applies, and
 * the same four refusals in the same order, because this is an unattended write
 * and "the call returned" is not "the index agrees".
 *
 * The token goes in a header on a request this Worker builds. It is never
 * logged and never echoed into the mail body.
 */
```

### workers/watchdog.ts:327 (CONTRACT, shortened)

where the decision lives; trimmed to two lines.

```ts
// The server's own sentence and the 422 rule live in the decision module,
  // shared with `scripts/health-repair.mjs`, which makes the identical call.
  // Grounds on `refusalMiss`.
```

### workers/watchdog.ts:348 (WHY, shortened)

what the body must carry and why there is no escalation; the 2026-08-23 flap goes to history.

```ts
/**
 * Sends the alert.
 *
 * THE BODY CARRIES THE HEALTH JSON AND WHAT WAS ATTEMPTED, because a
 * notification that says only "unhealthy" costs the reader the entire triage,
 * which is the defect the 2026-08-23 flap was diagnosed as: "which check
 * failed" was all anyone had, and one record apart during a rebuild and a
 * hundred apart are the same alert while only one of them is an incident.
 *
 * `text` only, no `html`. There is one reader, the content is a JSON blob and a
 * list, and an HTML part would be a second copy of the same words to keep in
 * step for no gain.
 *
 * Returns whether it sent, so a failure to notify is at least a log line rather
 * than nothing at all. There is no further escalation to reach for: if the mail
 * cannot go, the remaining signal is the home page's ageing health tile and the
 * hourly GitHub run.
 */
```

### workers/watchdog.ts:386 (CONTRACT, shortened)

why it is not a health check, the fail-closed rule, and what not-configured means; the latency figures go to history.

```ts
/**
 * The site's error rate over the last window, read from Cloudflare's own
 * numbers rather than from anything the site says about itself.
 *
 * ## WHY THIS IS HERE AND NOT A SIXTH HEALTH CHECK
 *
 * `/api/health`'s five checks are all DRIFT checks: a derived store against its
 * source, each one repairable through the operator door. An error rate is a
 * SYMPTOM, it is not repairable, and folding it into that endpoint would have
 * two costs worth refusing. It would add a GraphQL round trip to a route
 * already measured at 1.2 to 4.6 seconds and rate limited at 20 per minute; and
 * because `ship` refuses to proceed unless `/api/health` reports ok, a transient
 * error spike would start blocking DEPLOYS, which is the opposite of useful
 * when the thing you want to ship is the fix.
 *
 * So it lives where the alerting lives. The watchdog already fires every
 * fifteen minutes, already deduplicates its mail, and already knows how to
 * report a failing check by name.
 *
 * NEVER THROWS, on this file's standing rule. Every failure returns a verdict:
 * an unreachable API or a GraphQL error is reported as NOT OK, because an
 * error-rate check that could not read the error rate has not established that
 * it is fine. That is the fail-closed direction, and `errorRateVerdict` takes
 * the same stance about an unreadable body.
 *
 * NOT CONFIGURED IS ITS OWN ANSWER, and it is `ok: true` with a detail saying
 * so. It is a state to report rather than an alert to send: mailing every
 * fifteen minutes about a missing var would train the reader to filter the
 * watchdog, and the run log names it on every firing either way.
 */
```

### workers/watchdog.ts:467 (WHY, shortened)

the trap the API's shape sets; one line.

```ts
/*
   * A GraphQL 200 CARRYING ERRORS IS A FAILURE, and this is the trap that shape
   * of API sets: the transport succeeded and the query did not, so a reader
   * that only checked the status code would go on to sum an absent `data` field
   * to zero errors and report perfect health.
   */
```

### workers/watchdog.ts:500 (WHY, shortened)

why the catch exists and why it rethrows.

```ts
/**
   * One firing.
   *
   * WRAPPED, AND THE THROW IS RE-RAISED. Everything inside is written not to
   * throw, so reaching the catch means an assumption broke rather than a
   * dependency failed. It tries to mail, then rethrows: a Cron Trigger that
   * throws is recorded by the platform as a failed invocation, and swallowing
   * that would trade the last remaining signal for a tidy log.
   */
```

### workers/watchdog.ts:515 (CONTRACT, shortened)

what is deduplicated and what is not.

```ts
/*
       * WHAT THIS FIRING CONCLUDED, decided before anything is mailed.
       *
       * THE REPAIRS STILL RUN EVERY FIRING. Only the MAIL is deduplicated: a
       * condition that can be fixed is fixed on every poll exactly as before,
       * and `alerting` describes where the firing ENDED, after any repair, not
       * what the first reading looked like. Fixing something silently is the
       * behaviour the repair path was built for and is untouched here.
       */
```

### workers/watchdog.ts:541 (CONTRACT, shortened)

the order and where it comes from; the plant note goes to the history document.

```ts
/*
           * THE ACTION LIST IS WALKED, NEVER SECOND-GUESSED. The repairs run in
           * the order the module gave them (content before Ask, because the Ask
           * corpus is read out of what the content repair rewrites), and the
           * recheck runs only because the list asked for one. Deleting it there
           * stops it happening here, which is the coupling that makes the plant
           * meaningful.
           */
```

### workers/watchdog.ts:551 (WHY, shortened)

why a refusal stops the walk.

```ts
/*
           * A REFUSAL ABANDONS THE REST OF THE LIST. The ordering note above is
           * the reason: the Ask corpus is read out of what the content repair
           * rewrites, so once that repair has been REFUSED the corpus is
           * known-stale and uploading it is a write on a premise the previous
           * call just denied.
           */
```

### workers/watchdog.ts:615 (WHY, shortened)

read every firing, joins failing, and is not repairable; the flap counts go to history.

```ts
/*
       * ## THE ERROR RATE, FOLDED IN AS ONE MORE FAILING CHECK
       *
       * READ EVERY FIRING, whatever the health verdict said, because the two
       * are independent: the defect this was written for had all five health
       * checks green while the Worker threw 24 times a day for fifteen days.
       * Reading it only when health was already red would have found nothing.
       *
       * IT JOINS `failing` RATHER THAN MAILING ON ITS OWN. That is what buys
       * the dedupe for free: `alertTransition` mails on the way into red, on
       * recovery, and when the failing set GROWS, so a rate that stays high for
       * an afternoon sends one mail rather than sixteen. A second mail path
       * would have had to reimplement that, and would have got it wrong,
       * because the 27-email flap is exactly what that module exists about.
       *
       * IT IS NOT REPAIRABLE and deliberately not in `REPAIRABLE`. Firing a
       * corpus rebuild at a Worker that is throwing would be acting on a
       * symptom whose cause nobody has classified, which `repairPlan`'s first
       * refusal already says in full.
       */
```

### workers/watchdog.ts:650 (WHY, shortened)

why both are reported; trimmed to two lines.

```ts
// Health already had something to say. Both are reported, on the
          // N-1-of-N rule: a mail naming only the drift would send somebody to
          // re-run a sync while the Worker was crashing.
```

### workers/watchdog.ts:659 (CONTRACT, shortened)

where the decision lives and what this file does not decide.

```ts
/*
       * ONE MAIL PER CHANGE OF STATE. Every decision is in `alert-state.mjs`,
       * which is pure and covered by `check:tests`; this reads KV, writes KV and
       * sends, and decides nothing.
       */
```

## app/lib/search/search.server.ts

### app/lib/search/search.server.ts:1 (CONTRACT, shortened)

what it is, why raw SQL, and the one-dependency rule.

```ts
/**
 * Site search over the two fts5 indexes.
 *
 * Runs the identity index and the prose index as two separate ranked lists and
 * fuses them by reciprocal rank. Raw D1 rather than drizzle, because bm25(),
 * snippet() and MATCH have no drizzle surface and hand-written SQL is what the
 * editor's publish path already uses.
 *
 * NOTHING HERE AWAITS A THIRD PARTY. Classic search is D1 and only D1, so it
 * cannot be slowed or broken by the AI layer sitting above it.
 */
```

### app/lib/search/search.server.ts:24 (NUMBER, shortened)

what the bound governs and what a truncated set must say.

```ts
/**
 * How many rows each index contributes before fusion.
 *
 * Fusion needs enough of each list for rank to mean something, and facet counts
 * are computed over the fused set, so this also bounds facet accuracy. When a
 * result set is truncated the response says so rather than quietly presenting a
 * partial count as a total.
 */
```

### app/lib/search/search.server.ts:37 (WHY, shortened)

the escaping prohibition and why the corpus is not trusted to be markup-free.

```ts
/**
 * Snippet markers.
 *
 * snippet() splices these into text it does not escape, so writing `<mark>`
 * directly would mean rendering unescaped content as HTML. Every indexed string
 * is ours, but "ours" includes a post that legitimately discusses `<script>` or
 * shows HTML in a code block, and that text reaches the index as prose. Control
 * characters cannot occur in the corpus, so the snippet is escaped first and
 * the markers are swapped for real tags afterwards.
 */
```

### app/lib/search/search.server.ts:85 (CONTRACT, shortened)

why there is no score field.

```ts
/**
 * One fused result, decomposed into what each index contributed.
 *
 * There is deliberately NO score field. Within a layer the ordering comes from
 * bm25, but bm25 values from two differently-tokenized indexes are not
 * comparable, which is exactly why fusion is over ranks. Surfacing a per-layer
 * score would invite a reader to compare two numbers that do not share a scale,
 * so the value never leaves SQL: `bm25()` appears only in ORDER BY.
 */
```

### app/lib/search/search.server.ts:97 (WHY, shortened)

why the parent title is carried; one line.

```ts
/**
   * The parent document's title. Records are SECTION-GRAINED, so a row's own
   * title is frequently a bare heading ("Limitations") that means nothing on its
   * own. Carrying the parent is what makes the table readable.
   */
```

### app/lib/search/search.server.ts:183 (CONTRACT, shortened)

the twin rule, why it cannot be collapsed, and the alias parameter; the four-statements measurement goes to the history document.

```ts
/**
 * The visibility predicate, and the SQL twin of publiclyVisible() in
 * app/db/index.ts. Both must stay in step: a scheduled post that is hidden on
 * the blog index and findable in search would be a leak.
 *
 * The two cannot be collapsed into one function: that one is a drizzle
 * condition over the `posts` schema and this is a string spliced into a
 * hand-written query over the `search_docs` alias `d`. So the agreement is
 * asserted instead. `check:invariants` runs both against a fixture of post
 * states and fails if they ever admit different rows, which is why this is
 * exported.
 *
 * THE ALIAS IS A PARAMETER, since 2026-08-11, and that is the whole point of
 * this change. `zeroState` below runs two aliasless queries over the same
 * table, and because this function hardcoded `d.` they could not call it. So
 * they restated the rule inline, and the codebase carried FOUR statements of
 * one predicate while only two of them were bound to each other.
 *
 * Measured before fixing: deleting the entire predicate from the zeroState tag
 * query left check:invariants, check:search, check:content, check:urls and
 * check:policy all green. Section 6 does cover this file (a Drizzle-shaped
 * no-predicate `posts` read here fires by name), but these queries read
 * `search_docs`, not `posts`, so nothing looked at them.
 *
 * Pass NO_ALIAS for an unaliased query.
 */
```

### app/lib/search/search.server.ts:214 (CONTRACT, shortened)

what the extractor assumes and the prohibition on inlining; the two failed attempts go to history.

```ts
/**
 * The unaliased argument, as a NAMED CONSTANT rather than a bare `""`.
 *
 * This is not style. `check:invariants` section 5 extracts raw SQL string
 * literals and binds their column names to the schema. Writing
 * `visibilityClause("")` puts an empty string literal immediately between two
 * SQL literals, and the extractor then reads across the boundary: it reported
 * `now` and `tags.get` as columns of `search_docs`, on a query that has
 * neither. Measured on the first two attempts at this change, in both the
 * `${...}` and the `+` concatenation forms.
 *
 * Passing a named constant keeps every string literal at these call sites SQL,
 * which is what that scan assumes. Do not inline it back.
 */
```

### app/lib/search/search.server.ts:286 (CONTRACT, shortened)

what the path is for, the document-records rule and the ordering; the retired count goes to history.

```ts
/**
 * The browse path: filters with nothing to match on.
 *
 * `tag:cloudflare`, a bare `2026`, and a facet chip clicked from an empty box
 * all parse correctly into filters and leave no text behind, so there is no
 * MATCH expression to give fts5. Routing those to the index returns nothing,
 * which makes the parser's best rule look like a bug to the one reader who used
 * it. The filters are already SQL, so this runs them directly over search_docs.
 *
 * DOCUMENT RECORDS ONLY. Section records exist so that a text query can land on
 * the heading that answers it; a filter has no such heading in mind, and
 * returning every record of one post as a separate result for `2026` would
 * present the corpus as a multiple of its real size.
 *
 * The count was written out as "seven" until 2026-08-28, which was one post's
 * record count on the day the sentence was written and is not a fact about any
 * post now: a post's records are its headings, so the number is per post and
 * moves whenever anybody edits one. The argument never needed a figure.
 *
 * Ordered by date, because with no relevance signal recency is the only
 * defensible ordering, and a bare year or tag reads as browsing rather than
 * searching.
 */
```

### app/lib/search/search.server.ts:324 (WHY, shortened)

why it is computed here rather than asked of fts5.

```ts
/**
 * Works out why a record matched, for the label shown on the result.
 *
 * Computed in app code from the parsed terms rather than asked of fts5, which
 * reports that a row matched but not which column carried it. Cheap, and it is
 * the same question a reader is asking when they wonder why a result is there.
 */
```

### app/lib/search/search.server.ts:357 (CONTRACT, shortened)

what the flag changes and the guarantee that it changes nothing else.

```ts
/**
   * Attach the per-layer rank decomposition to the result. Set by the
   * playground's search anatomy demo and by nothing else.
   *
   * It changes no query, no ordering and no hit. The values are read off what
   * `fuse()` already recorded, so the flag cannot make the demo and the real
   * search disagree: with it off, every other field is byte-identical to what
   * the same call produced before this option existed.
   */
```

### app/lib/search/search.server.ts:414 (WHY, shortened)

why nothing is marked here; trimmed to two lines.

```ts
// No MATCH ran, so there is nothing to highlight. The snippet is the head
      // of the body, escaped, with no <mark> in it. Marking anything here would
      // claim a match that was never made.
```

### app/lib/search/search.server.ts:434 (WHY, shortened)

why the two reads are concurrent; trimmed to two lines.

```ts
// Both indexes are queried concurrently. They are independent reads and
  // waiting for one before starting the other would double the latency of the
  // only part of search that touches the database.
```

### app/lib/search/search.server.ts:486 (CONTRACT, shortened)

nothing is recomputed; trimmed to one line.

```ts
// Read off what fuse() recorded. Nothing is recomputed and no scoring rule
    // is restated: `sources` says which lists the row appeared in and `ranks`
    // and `contributions` are positionally parallel to it.
```

### app/lib/search/search.server.ts:500 (WHY, shortened)

what the ?? null folds together; trimmed.

```ts
// `ranks` and `contributions` are built alongside `sources` by the
              // fuser, so an index found in one is present in the others. The
              // `?? null` folds that unreachable case into the same "this layer
              // did not contribute" the -1 branch already means, which keeps
              // this an explain payload rather than one carrying `undefined`.
```

### app/lib/search/search.server.ts:526 (CONTRACT, shortened)

what the counts promise and what truncation obliges the caller to say.

```ts
/**
 * Facet counts over the whole match set, not the current page.
 *
 * A count that only ever promises what a click would actually return. Computed
 * in app code over the fused set rather than as extra aggregate queries,
 * because the fused set is already in memory and a personal site's match sets
 * are small. If `truncated` is true the caller must present these as a floor.
 */
```

### app/lib/search/search.server.ts:555 (WHY, shortened)

why a zero state offers something; one line.

```ts
/**
 * What to offer when a query returns nothing.
 *
 * A zero state that only says "no results" is a dead end. These are the two
 * cheapest useful things the database can offer: tags that look like what was
 * typed, and the most recent posts.
 */
```

### app/lib/search/search.server.ts:562 (CONTRACT, shortened)

not a second indexer, what the D1 baseline costs, and the composed predicate; the 600KB fetch, the verification counts and the latencies go to the history document. The hard rule citation stays.

```ts
/**
 * Every URL the Ask index is expected to hold, from D1 rather than from git.
 *
 * **WHY THIS EXISTS: the admin layout was fetching 600KB from GitHub to render
 * a nav badge.** `askIndexStatus` built its expected set by running
 * `recordsForPosts(publishableForAsk(posts))` over the committed corpus
 * artifact this repo no longer has, fetched over the GitHub Contents API: an
 * HTTPS round trip off Cloudflare's network for 601,683 bytes, base64 encoded
 * to roughly 802,000 over the wire, then decoded and parsed.
 * Measured on production at 283 to 528ms, on EVERY admin page load, for one
 * integer.
 *
 * **THIS IS NOT A SECOND INDEXER, and that distinction is the whole argument.**
 * `records.mjs` remains the only thing that decides what a record is. These
 * rows were written by `sync:content` from `recordsForPosts`, so this reads
 * the same derivation out of the place it was materialised instead of
 * recomputing it. `keyForUrl` is still the only thing that turns a URL into an
 * Ask key. Nothing here knows the record shape.
 *
 * VERIFIED BEFORE IT WAS BUILT ON, both directions, against live D1 on
 * 2026-08-19: 90 keys from the artifact, 90 from this query, zero in either
 * difference.
 *
 * **WHAT CHANGES, stated because it is a real behaviour change and not a
 * refactor.** The expected set used to come from the repository and now comes
 * from D1. If D1 were stale against the artifact, drift would be measured
 * against a stale baseline and could under-report. Three things bound that: the
 * artifact is byte-gated by `check:content`, `ship` syncs D1 and asserts
 * three-way docsize equality in the same window, and the editor's save path
 * writes both. The window is a deploy-time one. In exchange the badge now
 * answers a more useful question anyway: whether Ask agrees with what the
 * site's own search actually serves.
 *
 * `type = 'post'` because the Ask corpus is posts only. Page records exist in
 * `search_docs` and are deliberately not uploaded, so including them here would
 * report all twenty as permanently stale.
 *
 * The predicate is `visibilityClause(NO_ALIAS)`, composed and never hand
 * copied, which is hard rule 1 and what `check:invariants` section 8 binds
 * every `search_docs` reader to. It also carries the unit: `publish_at` is
 * SECONDS, and an ad-hoc query written against milliseconds during this
 * change's own verification silently matched everything.
 */
```

### app/lib/search/search.server.ts:605 (CONTRACT, shortened)

what it returns, why it takes no posts argument, and the composed predicate.

```ts
/**
 * The Ask corpus itself: every record the index should hold, with the text to
 * upload. The reading twin of `askExpectedUrls` below, and the reason
 * `syncAskCorpus` no longer takes a posts argument: the records were
 * materialised into `search_docs` by the same records.mjs both writers run,
 * so the uploader reads the store both converge to rather than re-deriving a
 * copy from a corpus file that no longer exists.
 *
 * Visibility is COMPOSED, not restated (rule 1): `visibilityClause` is the
 * predicate that kept five drafts out of Ask, and check:invariants section 8
 * holds every search_docs reader to it.
 */
```

### app/lib/search/search.server.ts:649 (CONTRACT, shortened)

the composition rule and the concatenation rule; the first attempt's misreport goes to history.

```ts
// The predicate comes from visibilityClause(NO_ALIAS), not from a hand-copy. This
    // query has no alias, which is why that function now takes one.
    //
    // CONCATENATED, not interpolated. check:invariants section 5 extracts raw
    // SQL string literals to bind their column names to the schema, and a
    // `${...}` inside the template truncates the literal it can see: the first
    // attempt made it report `now` and `tags.get` as columns of search_docs.
    // A `+` keeps the literal whole and parseable.
```

### app/lib/search/search.server.ts:668 (WHY, shortened)

why not a fuzzy distance; trimmed.

```ts
// "Nearest" is a shared-prefix or substring test, deliberately not a fuzzy
  // distance. On a corpus with a handful of tags, edit distance would surface
  // confident nonsense; a substring match either finds something honest or
  // finds nothing and says so.
```

## app/enhance/blog.ts

### app/enhance/blog.ts:1 (CONTRACT, shortened)

the law and the inventory of what degrades to what; the corrected image claim goes to the history document.

```ts
/**
 * Progressive enhancement for blog reading. One file, loaded only on blog
 * routes, and nothing here is required for the page to work.
 *
 * Every public blog route is fully readable, navigable and linkable with
 * JavaScript disabled. This file only upgrades markup that already functions:
 *
 *   progress bar        decorative, absent without script
 *   scroll-spy TOC      the TOC is anchor links either way
 *   code copy + label   the code is already highlighted and selectable
 *   heading copy-link   the anchors are already navigable
 *   footnote previews   the footnote jump links already work
 *   image lightbox      the image is an anchor to the original file
 *   copy as markdown    the button is an anchor to the .md twin
 *
 * Every animation checks prefers-reduced-motion. Nothing here writes to the
 * network or to storage.
 *
 * The image row claimed that anchor from before 2026-08-11, when it was
 * measured FALSE and corrected to say the fallback was the image itself. The
 * anchor now exists, written by the shared pipeline, so the original claim is
 * true for the first time. The machine-readable inventory is
 * content/enhancements.json, gated by check:features.
 */
```

### app/enhance/blog.ts:94 (CONTRACT, shortened)

what the guard tests and why, and what the attribute is for.

```ts
/**
 * Language label and a copy button on one code block.
 *
 * IDEMPOTENT, and the guard tests for the BUTTON rather than for the
 * `data-enhanced` attribute it also sets. The attribute is a proxy for the
 * thing we actually care about, and a proxy can be lost while the thing it
 * stands for survives: strip it alone and this would append a second button to
 * a block that already had one. Asking whether the furniture is there answers
 * the real question and cannot drift from it.
 *
 * `data-enhanced` is then purely the CSS hook. `app.css` reserves the top
 * padding for a `pre` carrying it, so the space and the thing occupying it
 * arrive together and a reader without script is not left with a gap.
 */
```

### app/enhance/blog.ts:108 (CONTRACT, shortened)

why one shared region, why polite, and what stays; the three broken controls go to history.

```ts
/**
 * The ONE live region the three copy controls announce through. WCAG 2.2 4.1.3.
 *
 * ## WHAT WAS WRONG
 *
 * All three said "Copied" VISUALLY and told a screen reader nothing. The code
 * button swapped its own `textContent`, the markdown trigger swapped its own,
 * and the heading permalink set a `data-copied` attribute that CSS renders
 * through `::after`. Generated content is not in the accessibility tree at all,
 * and a button that silently relabels itself is a change of name rather than a
 * status message: a reader who cannot see the swap has no way to learn whether
 * the copy worked.
 *
 * ## WHY A SHARED REGION AND NOT `aria-live` ON EACH CONTROL
 *
 * A live region announces CHANGES to its own contents. Putting one on each
 * control means three regions competing, and it means the announcement is tied
 * to an element whose visible label is changing for a different reason. One
 * region that all three write into is one thing for assistive technology to
 * watch, and it leaves each control's own name alone.
 *
 * `role="status"` rather than `aria-live="assertive"`: this is polite by
 * definition. A copy confirmation must not interrupt whatever is being read.
 *
 * ## THE VISUAL AND THE ANNOUNCED ARE SEPARATE ON PURPOSE
 *
 * The `::after` text and the button relabel STAY. They are the sighted
 * feedback and they work; this adds the half that was missing rather than
 * replacing the half that was not.
 *
 * Created lazily and once, so a page with no copy controls carries no extra
 * element, and the element is visually hidden with the site's own `.sr-only`
 * rather than a second definition of the same idea.
 */
```

### app/enhance/blog.ts:151 (WHY, shortened)

why the region is emptied first.

```ts
/*
   * CLEARED FIRST, and this is not superstition. A live region announces a
   * CHANGE; writing the same string twice in a row is not a change, so copying
   * a second time would be silent. Emptying it and setting it on the next frame
   * makes every copy an announcement, including an identical one.
   */
```

### app/enhance/blog.ts:200 (CONTRACT, shortened)

why the observer is kept and why it terminates; the measured hydration race goes to the history document.

```ts
/**
 * Language label and a copy button on every code block, AND AGAIN AFTERWARDS.
 *
 * **The rewrite this observer was built against is GONE, and the observer is
 * kept anyway.** The post body is injected with `dangerouslySetInnerHTML` in
 * `blog.$slug.tsx`, and while public pages hydrated, react re-rendered the
 * container once after hydration and rewrote every child from the loader's
 * html string, destroying anything script had appended. MEASURED on
 * production, not reasoned: a MutationObserver installed before any page
 * script recorded all six nodes attaching, then `.prose` losing and regaining
 * all 67 of its children 23ms later, leaving zero buttons, with a control run
 * (the enhancement blocked at the network) showing the same replacement.
 * Decorating once was a race this file lost every time.
 *
 * The public plane stopped hydrating on 2026-08-26, so nothing rewrites the
 * subtree any more and a single pass would suffice. The observer stays
 * because it costs nothing at rest, `decorateCodeBlock` is idempotent, and it
 * makes the decoration independent of WHEN this bundle runs relative to any
 * future subtree rewrite, which is exactly the assumption that broke last
 * time.
 *
 * It terminates. Every write happens inside `decorateCodeBlock`, which does
 * nothing to a `pre` already carrying `data-enhanced`, so the mutations this
 * observer causes produce a pass that writes nothing and no further mutations.
 */
```

### app/enhance/blog.ts:244 (WHY, shortened)

both behaviours happen, and why focus rather than scroll; the false boundary note goes to history.

```ts
/*
       * THE COMMENT HERE USED TO SAY "the anchor still navigates for anyone who
       * prefers that", THREE LINES ABOVE A `preventDefault()`. It did not. The
       * copy replaced the navigation rather than joining it, so a reader who
       * clicked a heading permalink got a clipboard write and stayed exactly
       * where they were, with the URL bar changed under them and no focus
       * moved. That is a boundary note that was false in the commit that wrote
       * it, which is hard rule 7's own example.
       *
       * BOTH THINGS HAPPEN NOW. The URL is copied AND the reader lands on the
       * heading, which is what an in-page anchor is for and what 2.4.3 expects
       * of a link that changes the URL: focus follows.
       *
       * `focus()` on the heading rather than `scrollIntoView`, because moving
       * focus is what a screen reader announces and what the next Tab
       * continues from; scrolling alone moves the eye and leaves the keyboard
       * behind. Headings are not focusable by default, so `tabindex="-1"` is
       * set for the duration and removed afterwards: it makes the element
       * programmatically focusable without adding it to the tab order.
       */
```

### app/enhance/blog.ts:317 (WHY, shortened)

the hoverable half of 1.4.13 and why the grace period exists.

```ts
/*
   * WCAG 2.2 1.4.13, all three parts, and all three were missing.
   *
   * HOVERABLE. `mouseleave` on the reference hid the bubble immediately, so the
   * bubble appeared BELOW the reference and vanished the moment the pointer
   * moved toward it. Nobody could ever read a footnote longer than one glance,
   * and nobody could select text from one. The grace period below is the fix:
   * leaving the reference schedules a hide rather than performing one, and
   * entering the bubble cancels it.
   *
   * The delay is short enough not to feel sticky and long enough to cross the
   * eight-pixel gap the bubble is positioned with, which is the distance the
   * pointer actually has to travel.
   */
```

### app/enhance/blog.ts:367 (WHY, shortened)

the dismissible half of 1.4.13.

```ts
/*
   * DISMISSIBLE. Escape removes the bubble WITHOUT moving focus, which is what
   * 1.4.13 asks for: a reader who cannot move the pointer away, or who has the
   * bubble covering the text they were reading, needs a way out that does not
   * cost them their place. There was none.
   */
```

### app/enhance/blog.ts:380 (WHY, shortened)

the persistent half of 1.4.13 and why nothing replaces the scroll listener.

```ts
/*
   * PERSISTENT. A `scroll` listener used to hide the bubble, so any scroll,
   * including the one a reader makes to bring a long footnote into view,
   * destroyed what they were reading. It is gone.
   *
   * Nothing replaces it, and nothing needs to: the bubble is positioned in
   * DOCUMENT coordinates (`window.scrollY` is added when it is placed), so it
   * travels with the reference rather than staying stuck to the viewport.
   */
```

### app/enhance/blog.ts:392 (CONTRACT, shortened)

what it does and why src is passed in.

```ts
/**
 * Opens one image over the page. Returns focus where it came from on close.
 *
 * `src` is passed in rather than read off the image on screen, and that is the
 * whole correction. Reading `currentSrc` returns whichever rung of the `srcset`
 * ladder the browser already downloaded, so the overlay showed the same resized
 * copy at a larger CSS size and called it full size.
 */
```

### app/enhance/blog.ts:401 (CONTRACT, shortened)

what the platform gives and why restoreFocus is still kept; the old div goes to history.

```ts
/*
   * A NATIVE <dialog>, OPENED WITH showModal(), SINCE 2026-08-28.
   *
   * It was a `div` with `tabIndex = -1` and nothing else: no role, no
   * `aria-modal`, no focus trap, no `inert` on the rest of the page and no
   * close button. Escape worked only while focus happened to be inside it,
   * which is until the reader presses Tab once, and a screen reader was never
   * told a dialog had opened at all. The palette next door has been a real
   * `<dialog>` since it was written, so the site had two modal patterns and
   * only one of them was accessible.
   *
   * `showModal()` gives modality, Escape, focus containment and the top layer
   * from the platform, which is four hand-rolled behaviours removed rather
   * than four written correctly. Focus return is also the platform's: it goes
   * back to whatever opened the dialog, and `restoreFocus` is kept because the
   * OPENER here is not always the element focus should land on.
   */
```

### app/enhance/blog.ts:420 (WHY, shortened)

why the label is generic when the alt is empty.

```ts
/*
   * A NAME, because a dialog announces itself and then has nothing to say. The
   * image's alt is the only description there is; when the author left it
   * empty the image is decorative, so the dialog is labelled generically
   * rather than with an empty string, which announces as "dialog" and nothing.
   */
```

### app/enhance/blog.ts:434 (WHY, shortened)

why a visible close button is required.

```ts
/*
   * A VISIBLE CLOSE BUTTON. Escape and a backdrop click are both real ways
   * out and neither is discoverable: one is invisible and the other is a
   * gesture nobody is told about. A touch reader with no keyboard had no
   * announced way to close this at all.
   */
```

### app/enhance/blog.ts:449 (CONTRACT, shortened)

what the target check gives.

```ts
/*
   * The backdrop click, kept. On a `<dialog>` the element itself is the click
   * target for its backdrop, so this checks the target rather than wrapping
   * the content in another element. Clicking the image must NOT close it,
   * which the target check is what gives us.
   */
```

### app/enhance/blog.ts:459 (CONTRACT, shortened)

one teardown and why the element is not reused.

```ts
/*
   * One teardown, on the platform's own `close` event, so every route out
   * lands here: the button, the backdrop, Escape, and anything added later.
   * The element is removed rather than reused because the next open builds a
   * fresh one with its own src and label.
   */
```

### app/enhance/blog.ts:475 (CONTRACT, shortened)

the anchor is the subject, the keyboard path, and the diagram exception.

```ts
/**
 * Lightbox for post images.
 *
 * THE ANCHOR IS THE SUBJECT, not the image. The shared pipeline wraps every
 * body image in `<a class="image-link" href="<original>">`, so the click
 * already did something useful before this file loaded: it navigated to the
 * unsized file. This intercepts that navigation and shows the same URL in an
 * overlay instead, which makes the enhancement a genuine upgrade of a working
 * control rather than the only way to reach the original.
 *
 * Binding the anchor is also what makes the keyboard path free. An anchor is
 * focusable and Enter fires a click on it, so Enter opens the overlay through
 * this same listener with nothing keydown-shaped written here, and close
 * returns focus to the anchor the reader was already on.
 *
 * DIAGRAMS TAKE THE OTHER PATH. Their image pair is deliberately not wrapped
 * (pipeline.mjs says why: one of the two is `display: none` and an anchor
 * around it would be an unnamed focus stop), so they are bound directly. A
 * diagram asset carries no `srcset`, so its `src` IS the original and nothing
 * here has to ask the browser which copy it chose.
 */
```

## app/routes/api.health.ts

### app/routes/api.health.ts:1 (CONTRACT, shortened)

why the header is load bearing and why no-store rather than private; the heuristic-freshness measurement goes to the history document. The hard rule citation stays.

```ts
/**
 * `/api/health`: confirms the `/api/*` plane is wired and the Worker is live.
 *
 * ## WHY THIS FILE HAS A CACHE-CONTROL AND DID NOT
 *
 * It returned `Response.json({ ok: true })` with no `Cache-Control` at all.
 * Under hard rule 8 that is not "uncached", it is CACHED: Workers Cache sits in
 * front of this Worker, `cache.enabled` is on in `wrangler.jsonc`, and
 * Cloudflare applies RFC 9111 heuristic freshness to a 200 carrying neither
 * `Cache-Control` nor `Expires`, which stores it for two hours.
 *
 * So the endpoint could answer "healthy" from a cache entry written up to two
 * hours earlier, and it would answer that identically whether the Worker was
 * fine or on fire. **A health check that can be served from cache is not a
 * health check**, and it is worse than none: it manufactures the reassuring
 * silence that a monitor exists to break.
 *
 * The transport's own default in `workers/app.ts` would NOT have saved this.
 * That default is `if (!headers.has("cache-control"))`, so it does apply here
 * today. Relying on it is still wrong for this route: the default exists to
 * make a FORGOTTEN header safe, and a route whose correctness depends on the
 * header is a route that must state it, or the next person who adds a
 * `headers` export to it removes the protection without knowing it was load
 * bearing. `check:headers` asserts this file's own declaration for that reason.
 *
 * `no-store` rather than the repo's usual `private, no-store`: `private` bounds
 * WHO may store, `no-store` says nobody may, and only the second is what this
 * route needs. Stated as one value so the gate compares one string.
 */
```

### app/routes/api.health.ts:39 (NUMBER, shortened)

what the two values are and why they are not exported.

```ts
/**
 * The per-IP allowance, and the window it is measured over. The only copies.
 *
 * Deliberately NOT exported. Nothing outside this route needs the numbers, and
 * the refusal is asserted over the wire by verify-live rather than by a gate
 * reading them back, so exporting them would create a second reader with no
 * caller.
 */
```

### app/routes/api.health.ts:50 (CONTRACT, shortened)

why the failure path takes the same headers.

```ts
/**
 * The headers on EVERY health response, success and failure alike.
 *
 * One constant, one application site. A 503 that was cacheable would be worse
 * than a cacheable 200: it would keep reporting a failure after the site
 * recovered, and the workflow watching it would keep alerting.
 */
```

### app/routes/api.health.ts:62 (CONTRACT, shortened)

the structural property the gate asserts.

```ts
/**
 * THE ONLY PLACE THIS ROUTE CONSTRUCTS A RESPONSE.
 *
 * That is the property `check:headers` asserts, and it is asserted structurally
 * rather than by looking for the header near each `new Response`. A window
 * around an anchor reads its neighbour's compliance, which this repo has
 * already been bitten by; "exactly one construction, and it is inside this
 * helper" cannot be satisfied by a neighbour.
 */
```

### app/routes/api.health.ts:72 (CONTRACT, shortened)

why it seeds and overlays, and why Headers rather than a spread.

```ts
/*
   * SEEDED FROM THE CONSTANT, then overlaid. The rate-limit refusal needs a
   * `Retry-After` that no other response wants, and the alternative shapes
   * both break the property above: a second `new Response` at the refusal site
   * is a second exit, and spreading the constant into an object literal at
   * each call site is the copy this helper exists to prevent.
   *
   * `Headers` rather than a spread so a caller cannot accidentally shadow
   * `Cache-Control` with a different case. Overlay order is deliberate: the
   * constant goes in first and `extra` may only ADD to it in practice, because
   * nothing passes a name the constant already declares.
   */
```

### app/routes/api.health.ts:89 (CONTRACT, shortened)

the status line is the contract, fail closed, and what the body may not carry.

```ts
/**
 * Runs every health check and answers 200 only if all of them passed.
 *
 * ## THE STATUS CODE IS THE ALERT
 *
 * `.github/workflows/health.yml` polls this and fails its run on any non-200,
 * and a failed scheduled run is what emails the repository owner. So anything
 * this endpoint wants a human to know it must say in the STATUS LINE. A 200
 * carrying `{"ok": false}` is read by `curl --fail` as health and the alert is
 * never sent. That is why the body is not the contract and the code is.
 *
 * 503 rather than 500: the site is serving, a stated invariant is not holding.
 *
 * ## FAIL CLOSED, and the outer catch is the point
 *
 * `runHealthChecks` already turns a throwing or hanging CHECK into a failing
 * check, each under its own timeout, so one wedged binding cannot hang this
 * response or silence the other two. Reaching the catch below therefore means
 * the run itself could not be assembled. An endpoint that cannot run its checks
 * reports unhealthy; it does not report nothing, and it does not report health.
 *
 * The body carries names and booleans only. Every `detail` string is dropped by
 * `publicHealthBody`, because they carry row counts and an R2 object key and
 * this route is unauthenticated. The why lives in Workers Logs.
 */
```

### app/routes/api.health.ts:117 (CONTRACT, shortened)

why the gate is first, which instrument, and the without-the-limiter rule; the measured seconds go to history.

```ts
/*
   * GATE 0, AND IT IS FIRST BECAUSE EVERYTHING BELOW IT COSTS.
   *
   * This endpoint runs five checks against D1, R2 and AI Search. MEASURED
   * 2026-08-26 over four samples: 0.98, 1.18, 1.18 and 2.01 seconds. It was
   * unauthenticated and unrated, which made it the most expensive thing an
   * anonymous caller could ask this site to do, by a wide margin, and it sat
   * next to `/api/csp-report`, an endpoint that only writes a log line and
   * carries THREE limits. The cheap path was guarded and the expensive one
   * was not.
   *
   * Same instrument as that route and as the operator path: one `AskBudget`
   * Durable Object instance, named `health:<ip>`. No new class, no migration.
   *
   * WHY 20 AND NOT 60. Every legitimate caller is far under it. The scheduled
   * workflow polls once every fifteen minutes; ship reads it once per deploy;
   * `check:browser` reads it twice per run; a person refreshing the page reads
   * it a handful of times. Twenty is roughly ten times the busiest of those
   * and it bounds one address to about twenty six seconds of backend work per
   * minute. `/api/csp-report` sits at sixty because its deliverable is the
   * report itself and eating one loses data; here the deliverable is a verdict
   * that is still true thirty seconds later.
   *
   * WITHOUT THE LIMITER THIS DOES NOT SERVE, the stance the Ask guards and the
   * operator path take. It costs nothing here and buys something extra: a
   * missing `ASK_BUDGET` is itself a broken deployment, and answering 503 is
   * exactly how this endpoint reports one, so the monitor alerts rather than
   * quietly losing its guard.
   */
```

### app/routes/api.health.ts:152 (CONTRACT, shortened)

why the call is guarded, why 503, why a separate name, and why neither is repairable; the 283 invocations and the reproduction go to the history document.

```ts
/*
   * THE LIMITER CALL IS INSIDE A TRY, AND IT WAS NOT. Fixed 2026-09-07.
   *
   * MEASURED ON PRODUCTION over the seven days to 2026-09-07: 283 invocations
   * of this route ended in `scriptThrewException`, every one of them carrying
   * NO log line. That is the tell. The `try` below logs `health-run-threw` on
   * anything that fails inside it, so a throw with no message escaped BEFORE
   * that block, and the only awaited work above it was these two lines. A
   * Durable Object call is a network call and can fail; `idFromName` and `hit`
   * were both outside every guard on the route.
   *
   * REPRODUCED BOTH WAYS before this landed, by planting a throw in
   * `AskBudget.hit` and driving the route locally. Before: `HTTP 500`,
   * `content-type: text/plain`, the body `Unexpected Server Error`, and the
   * gateway's `private, no-store` rather than this route's own header, because
   * the route never constructed a response at all. After: the 503 below.
   *
   * WHY 503 AND A NAMED CHECK rather than letting it through to the checks.
   * Hard rule: without the limiter this does not serve. A limiter that THREW
   * is not a limiter that said yes, and treating a failed guard as a pass is
   * the fail-open shape this repo keeps writing down. It is the same stance
   * the `!env.ASK_BUDGET` branch above takes, one line up.
   *
   * A SEPARATE NAME FROM `rate-limiter-unavailable`, deliberately. Absent and
   * BROKEN are different answers and collapsing them costs the reader the
   * triage: one is a deployment missing a binding, the other is a Durable
   * Object failing under load. `workers/watchdog.ts` draws the identical
   * distinction in `readState` and for the identical reason.
   *
   * NEITHER NAME IS IN `REPAIRABLE`, which is correct rather than an omission.
   * `repairPlan` returns alert-only for an unknown class, so a broken limiter
   * wakes somebody instead of firing a corpus rebuild at a site whose failure
   * nobody has classified.
   */
```

### app/routes/api.health.ts:191 (CONTRACT, shortened)

why the log line is the whole record; trimmed.

```ts
// LOGGED BY NAME. The wire body carries names and booleans only, so this
    // console line is the entire record of WHY the limiter failed, and it is
    // the thing that was missing for 283 invocations.
```

### app/routes/api.health.ts:204 (CONTRACT, shortened)

why the refusal keeps the shape and why a 429 is still an alert.

```ts
/*
     * THE SAME BODY SHAPE AS EVERY OTHER ANSWER, so the workflow's parse
     * succeeds and reports a named cause rather than falling into its "body
     * did not parse" branch. The status line is still the alert: a 429 is a
     * non-200 and `curl --fail` treats it as one, which is correct. A rate
     * limited monitor IS a condition worth a human seeing.
     */
```

### app/routes/api.health.ts:223 (CONTRACT, shortened)

where the detail the wire omits is recoverable; trimmed.

```ts
// Logged as well as returned. Workers Logs keeps custom logs for 7 days
      // with observability enabled, and `invocation_logs: false` does not touch
      // them: that setting drops the automatic per-request record, which is a
      // privacy decision, not this. So the DETAIL the wire deliberately omits
      // is still recoverable by the operator.
```

### app/routes/api.health.ts:237 (CONTRACT, shortened)

byproduct not a reason, both verdicts, and why the failure path writes nothing.

```ts
/*
     * THE SNAPSHOT, WRITTEN ON THE WAY OUT. It is a byproduct of a run that
     * happened anyway, never a reason to run.
     *
     * Written for BOTH verdicts, pass and fail. A snapshot that recorded only
     * healthy runs would let the home tile keep showing the last good answer
     * while the site was failing, which is the exact lie the tile's timestamp
     * exists to prevent.
     *
     * `body` rather than `run`, so what is stored is what was answered with.
     * The failure path below deliberately writes NOTHING: reaching it means
     * the run could not be assembled, so there is no verdict to record, and
     * the home tile ages into `stale` rather than being handed a fabricated
     * one. Grounds in `app/lib/health/snapshot.mjs`.
     */
```

### app/routes/api.health.ts:269 (CONTRACT, shortened)

what the framework default gets wrong, the shared shape, no rate limit, and the Allow value; the live measurement goes to history.

```ts
/**
 * Every method that is not GET, answered as a METHOD error rather than as a
 * framework crash.
 *
 * MEASURED ON THE LIVE HOST 2026-09-11: `curl -X POST /api/health` returned
 * `405 Method Not Allowed` with `Content-Type: application/json` and the body
 * `{"message":"Unexpected Server Error"}`, and no `Allow` header. Every part
 * of that is React Router's default for a route with a loader and no action,
 * and every part of it is wrong for this endpoint:
 *
 *   - "Unexpected Server Error" on a 405 says the server broke. It did not.
 *     The caller used the wrong verb, which is the one error a monitor can fix
 *     by itself, and the body is what a person reads first.
 *   - No `Allow` header, which RFC 9110 requires on a 405. A client has to
 *     guess which method to retry with.
 *   - A body shape nothing else on this route produces, so the health
 *     workflow's parse falls into its "body did not parse" branch and reports
 *     a failure whose cause it cannot name.
 *
 * **THE SHAPE IS THE SAME ONE EVERY OTHER ANSWER HERE USES**, through the same
 * `healthJson` helper and therefore the same `no-store`. That is the whole
 * point: a caller that POSTs by mistake gets a parseable verdict naming
 * `method-not-allowed`, not a different contract.
 *
 * NO RATE LIMIT, and that is deliberate rather than an omission. The loader's
 * limiter guards five checks against D1, R2 and AI Search; this function
 * allocates one object and returns. Metering it would mean a Durable Object
 * round trip to refuse a request that costs less than the refusal, and it
 * would make a broken limiter turn a 405 into a 503.
 *
 * `Allow: GET` and not `GET, HEAD`: the platform answers HEAD by running the
 * loader and dropping the body, so HEAD never reaches here, and advertising a
 * method this function does not see is a claim about someone else's behaviour.
 */
```

## app/lib/search/ask-guard.server.ts

### app/lib/search/ask-guard.server.ts:1 (CONTRACT, shortened)

the three gates, their order, and why they are Durable Objects; the four binding measurements go to the history document.

```ts
/**
 * Cost guards for Ask mode.
 *
 * `/search/ask` is public, unauthenticated, and every answer that reaches the
 * model bills Workers AI. Retrieval is free in the AI Search beta; GENERATION
 * IS NOT. So the endpoint needs to be cheap to use honestly and expensive to
 * abuse, and it needs that without a zone WAF, because the site is still on
 * workers.dev and workers.dev has no zone to attach rules to.
 *
 * Three gates, cheapest first, and NOTHING reaches the model until all three
 * have passed:
 *
 * 1. **Per-IP burst limit**, an exact count in a Durable Object instance per
 *    IP. Stops one caller monopolising the endpoint.
 * 2. **Answer cache**, KV. Makes a repeated question a read instead of a bill.
 * 3. **Daily ceiling**, an exact count in one Durable Object. The spend cap.
 *
 * Gates 1 and 3 are Durable Objects rather than the `ratelimit` binding or a KV
 * counter, and that is a measured decision rather than a preference. Both of
 * the cheaper mechanisms were built first and both leaked: the binding refused
 * 1, then 2, then 9, then 0 of twelve concurrent requests against a limit of
 * five, and a KV counter is worse still because concurrent read-modify-writes
 * all read the same stale value. The measurements and the reasoning live in
 * `workers/ask-budget.ts`, next to the code they justify.
 *
 * The ordering matters as much as the mechanisms. A cache hit must not consume
 * budget, so gate 3 sits AFTER the cache, not with gate 1.
 */
```

### app/lib/search/ask-guard.server.ts:32 (NUMBER, shortened)

why this rate, and where the mechanism choice is argued.

```ts
/**
 * Requests per IP per minute.
 *
 * Five questions a minute is more than a reading human asks and far less than a
 * loop wants. Counted exactly, in a Durable Object instance per IP: see
 * `workers/ask-budget.ts` for the four measurements that ruled out the
 * `ratelimit` binding for this job.
 */
```

### app/lib/search/ask-guard.server.ts:43 (NUMBER, shortened)

what the ceiling is for; already short.

```ts
/**
 * Site-wide answers per day before Ask stops answering anyone.
 *
 * A ceiling on the bill, not a fairness mechanism. Deliberately a number a real
 * reader will never reach and a distributed scraper will.
 */
```

### app/lib/search/ask-guard.server.ts:51 (NUMBER, shortened)

why a burst exists at all and what it costs; the observed demand goes to history.

```ts
/**
 * Answers available immediately, on top of the day's paced share.
 *
 * Twenty-five, and the number is chosen so that PACING IS INVISIBLE TO REAL
 * READERS. Observed demand on this site is a handful of questions a day, so a
 * genuine reader arriving at any hour finds headroom well above anything they
 * or the other readers that hour will use. Without a burst the first question
 * after UTC midnight would be refused, because an evenly paced share is zero at
 * 00:00:01, which would be a worse bug than the one being fixed.
 *
 * It is also the size of the outage a burst can still buy: an attacker can take
 * these 25 at any moment, and then moves at the paced rate. That is the trade,
 * and 25 answers is a cheap one.
 */
```

### app/lib/search/ask-guard.server.ts:72 (NUMBER, shortened)

that it is a cache over a slow path, and the freshness constraint that set the value; the samples and the cost arithmetic go to the history document.

```ts
/**
 * THE DRIFT BADGE'S CACHE. One integer, one key, no prefix scan.
 *
 * **THIS IS A CACHE ADDED TO HIDE A SLOW PATH, AND TIER 1.5 REQUIRES SAYING SO
 * RATHER THAN NOT DOING IT.** So: it is hiding `listAllAskItems`, which pages
 * the AI Search index 50 at a time and was measured on production 2026-08-19
 * from 12 direct samples of `/admin.data` at a median of 208ms and a MAXIMUM OF
 * 2332ms. The layout runs on every admin page load, so that tail was reachable
 * from any click anywhere in the admin plane.
 *
 * The fix is removing the call from the read path, not making it cheaper. Both
 * pages cost about 72ms each, so dropping page 2 would buy 72ms and leave the
 * tail exactly where it was: the cost is per-call variance of 46 to 2055ms, not
 * round-trip count.
 *
 * ## WHY 300 SECONDS, and not a round number chosen for looking tidy
 *
 * Three constraints, and the measurement picks the value between them.
 *
 * FLOOR: KV refuses a TTL under 60 seconds, so 60 is the shortest expressible.
 *
 * THE COST SIDE: at 208ms median the call is affordable occasionally and
 * unaffordable per page load. An admin session is a burst of navigation, so
 * what matters is calls per session rather than per request. At 300s a ten
 * minute working session pays the listing about twice however many pages are
 * opened, and can meet the 2332ms tail at most twice rather than on any click.
 * At 60s the same session pays it ten times and meets the tail ten times over,
 * which is most of the problem still present.
 *
 * THE FRESHNESS SIDE, and this is the constraint that set the value rather than
 * the cost. `askExpectedUrls` composes `visibilityClause`, so the expected set
 * is a function of THE CLOCK: a scheduled post whose `publish_at` passes
 * becomes expected and `missing` grows with no write anywhere. TTL expiry is
 * what recomputes on the clock's schedule, and 300s bounds how long the badge
 * can under-report that. Five minutes of an under-reported badge on a page that
 * is not the repair page is not a defect anyone can be harmed by; an hour would
 * start to be.
 *
 * That clock dependency is also exactly why this is a TTL cache and not
 * compute-on-write, which was the agreed plan until the measurement produced
 * this reasoning: a number recomputed only on `savePost` and `sync-ask` would
 * under-report a scheduled post's arrival until the next unrelated save.
 * Dormant today, since no published post record is future-dated, and armed the
 * moment one is scheduled.
 */
```

### app/lib/search/ask-guard.server.ts:129 (WHY, shortened)

what it collapses and the prohibition on collapsing more.

```ts
/**
 * Collapses questions that differ only in shape.
 *
 * "What is the backup asymmetry?" and "what is the backup asymmetry" are one
 * question and must not be two cache entries and two bills. Deliberately does
 * NOT stem, reorder or drop stopwords: two questions that differ in wording are
 * different questions, and answering one with the other's answer would be a
 * quiet correctness bug rather than a saving.
 */
```

### app/lib/search/ask-guard.server.ts:167 (CONTRACT, shortened)

why it runs first and what an absent binding does.

```ts
/**
 * The per-IP burst limit. Runs before anything else, including the cache.
 *
 * A cache hit is cheap but not free, and letting one caller hammer the endpoint
 * for cached answers is still a way to burn the site's resources. So this gate
 * is in front of everything.
 *
 * FAILS CLOSED when the limiter binding is absent. An unprotected metered
 * endpoint must not serve: a guard that silently passes because it could not
 * run is the exact failure mode this project has been caught by three times.
 * Removing `ratelimits` from wrangler.jsonc therefore DISABLES Ask rather than
 * un-protecting it, which is a different thing from removing `ai_search`, and
 * deliberately so.
 */
```

### app/lib/search/ask-guard.server.ts:186 (CONTRACT, shortened)

what the instance is keyed by; trimmed to two lines.

```ts
// One Durable Object instance per IP, so counting is exact per caller and the
  // instances shard naturally instead of funnelling through one object.
  // Keyed by IP alone, not by IP plus question: the point is to cap how often
  // one caller can spend, whatever they are asking.
```

### app/lib/search/ask-guard.server.ts:198 (CONTRACT, shortened)

when it is called, why reserve-then-generate, and why a failure is not refunded.

```ts
/**
 * Reserves one answer against the daily ceiling.
 *
 * Called ONLY on a cache miss, immediately before the model is reached, because
 * a cache hit costs nothing and must not consume budget. Reserve-then-generate
 * rather than generate-then-count: two concurrent requests that both read
 * "199 spent" and both proceed is exactly the race a ceiling must not have, and
 * the only way to avoid it is for the reservation and the decision to be one
 * operation inside the object that owns the number.
 *
 * A reservation is not refunded if generation then fails. Over-counting a
 * failure makes the ceiling slightly strict; under-counting would make it a
 * suggestion.
 */
```

### app/lib/search/ask-guard.server.ts:215 (CONTRACT, shortened)

what the split buys and what pacing fixes.

```ts
/*
   * THE CEILING IS PACED, since 2026-08-23, and the Durable Object is unchanged.
   *
   * `consume` takes the ceiling as an argument, so the policy can live in a
   * pure function that `check:tests` can reach while the object stays a
   * synchronous counter with no clock policy of its own. That split is the
   * reason this needed no migration and no new binding.
   *
   * What it fixes is the SHAPE of the failure rather than the size of the bill.
   * A flat 200 is a cliff: a distributed caller spends it in minutes, every
   * request inside the per-IP limit, and Ask is dead for real readers until UTC
   * midnight. Paced, the same 200 is released across the day, so the denial
   * ends when the abuse does. Full reasoning, and what this does NOT fix, are
   * on `pacedAllowance`.
   */
```

### app/lib/search/ask-guard.server.ts:233 (WHY, shortened)

which value the retry is and why the other one is wrong now.

```ts
/*
     * `secondsPerPacedUnit`, NOT `secondsUntilUtcMidnight`. That value was
     * correct under a flat cap, where nothing changed until the day rolled
     * over. Under pacing it would be wrong by up to a day and would send a
     * reader away from a feature that recovers in minutes.
     */
```

### app/lib/search/ask-guard.server.ts:251 (WHY, shortened)

why a reset exists at all.

```ts
/**
 * Clears today's spend. Admin only.
 *
 * Recovery, not routine: it exists because a ceiling with no way to lift it is
 * a ceiling that turns a bad day into a bad week, and because a guard has to be
 * testable from a known state to be provable at all.
 */
```

### app/lib/search/ask-guard.server.ts:274 (CONTRACT, shortened)

what it is for and why a delete is safe here.

```ts
/**
 * Removes one cached answer.
 *
 * The targeted counterpart to `invalidateAnswerCache`, for finding B010: the
 * replay path finds an entry whose citations are no longer public and deletes
 * exactly that entry. A KV `delete` by name is strongly consistent, unlike the
 * `list` the bulk invalidation walks, so this is not subject to the lag that
 * produced the stale entry in the first place.
 */
```

### app/lib/search/ask-guard.server.ts:300 (CONTRACT, shortened)

null is not zero, and why unparseable is a miss.

```ts
/**
 * The cached drift count, or null when there is none to serve.
 *
 * NULL, NOT ZERO, and the distinction is the whole reason this returns a union.
 * Zero is a real and common answer meaning "the index agrees with the corpus",
 * and a miss that returned zero would render a clean badge on no evidence.
 * Anything unparseable is also a miss: a hand-edited key or a value written by
 * an older shape must not become a number by coercion.
 */
```

### app/lib/search/ask-guard.server.ts:317 (CONTRACT, shortened)

why the stored value is an object.

```ts
/**
 * Stores the drift count for `DRIFT_CACHE_TTL_SECONDS`.
 *
 * An OBJECT rather than a bare number, so a later field can be added without
 * the stored shape being ambiguous between versions, which is the same reason
 * `CachedAnswer` is an object holding one string.
 */
```

### app/lib/search/ask-guard.server.ts:330 (CONTRACT, shortened)

who calls it and why a delete rather than a write.

```ts
/**
 * Drops the cached drift count.
 *
 * Called by the paths that KNOW the number just changed, so the badge does not
 * spend up to the TTL disagreeing with an action the operator just took. A
 * delete rather than a write, because those paths know the number is stale and
 * do not necessarily know what it became.
 */
```

### app/lib/search/ask-guard.server.ts:342 (CONTRACT, shortened)

why invalidation rather than a generation key, and the bounded staleness.

```ts
/**
 * Drops every cached answer.
 *
 * Called when the corpus changes. **This is why the cache is invalidated rather
 * than keyed through a generation number**: a generation in the key would cost
 * a second KV read on every request forever, to handle an event that happens
 * when a post is published. Deleting on publish puts the cost where the change
 * is.
 *
 * KV list is eventually consistent, so an answer written moments before a sync
 * can survive it. The TTL is the backstop, and the staleness window is bounded
 * by how long a stale answer can outlive its content: at worst until the next
 * sync, at absolute worst the TTL. Recorded rather than engineered away,
 * because the corpus changes when Dustin publishes and not otherwise.
 */
```

## app/db/schema.ts

### app/db/schema.ts:67 (CONTRACT, shortened)

why the indexes are modelled here and what the gate compares; the hard rule citation stays.

```ts
/*
     * THE INDEXES, declared here since 2026-08-28 because they were declared
     * NOWHERE a reader of this file could see.
     *
     * Hard rule 11 calls this file the source of truth, and it modelled every
     * posts column and not one of its four indexes. A query planner decision
     * is part of what the table IS: the visibility predicate every public read
     * composes is covered by the first of these, and somebody reading only
     * this file would have concluded it was a table scan.
     *
     * `check:invariants` section 4 now compares index NAMES AND COLUMNS
     * against the migrations in both directions, so these are checked rather
     * than merely written down.
     */
```

### app/db/schema.ts:124 (CONTRACT, shortened)

derived, the conflict rule, and what it does not describe.

```ts
/**
 * The media INDEX. Grounds are in drizzle/0009_media_index.sql.
 *
 * DERIVED, never authoritative. R2 and `public/` are the truth for what exists;
 * this is the queryable surface over them, and `check:media` reconciles the two
 * in both directions. The conflict rule is not negotiable and is stated once:
 * **R2 WINS.** A row with no object is deleted, an object with no row is
 * backfilled, never the reverse.
 *
 * It still describes the ASSET and never the citations. Those live in
 * `mediaRefs`, written by the pipeline at render time, so no row here can
 * authorise a delete that a fresh count would refuse.
 */
```

### app/db/schema.ts:169 (CONTRACT, shortened)

the stored form, why it is wrapped, and the one owner of it.

```ts
/**
     * Admin organisational labels, DELIMITER-WRAPPED: `,alpha,beta,` or "".
     *
     * A column rather than the posts pattern, and the four-point basis is in
     * `drizzle/0011_media_trash_tags.sql`. The wrapping is what lets an exact
     * tag match use LIKE without `art` also matching `chart`. Never written
     * raw: `serialiseTags()` in `app/lib/media/tags.mjs` owns the form, and it
     * strips the delimiter and both LIKE wildcards out of every part.
     */
```

### app/db/schema.ts:180 (CONTRACT, shortened)

library state not object state, one column not two, and what reconciliation does with it.

```ts
/**
     * When the LIBRARY stopped showing this asset. NULL means not trashed.
     *
     * A LIBRARY STATE, NOT AN OBJECT STATE. R2 and the public URL are untouched
     * by trashing: keys are content-addressed and may already be cited, so a
     * trashed asset a post cites keeps rendering for every reader while the
     * library stops offering it to the author.
     *
     * One nullable timestamp rather than a boolean plus a date, because two
     * columns can disagree and one cannot.
     *
     * **Reconciliation is blind to it on purpose.** `check:media` compares rows
     * against R2 in both directions and the object still exists, so the
     * reconciliation readers keep seeing trashed rows. Only library views
     * filter.
     */
```

### app/db/schema.ts:209 (CONTRACT, shortened)

the partial predicate and the boundary: the gate cannot see it.

```ts
/* Partial in the migration (`WHERE trashed_at IS NOT NULL`), because the
       only question asked of it is which rows ARE trashed. Drizzle models the
       index; the partial predicate lives in the SQL, which is the source that
       runs. Section 4 of check:invariants compares columns, not index
       predicates, so this asymmetry is invisible to it and is stated here. */
```

### app/db/schema.ts:218 (CONTRACT, shortened)

who writes it, that usage stays derived, and what writing at render time closes.

```ts
/**
 * Who cites what. Written by the PIPELINE at render time, populated in Phase 3.
 *
 * Usage stays DERIVED (ruling 2, carried forward): this table is a record of
 * what the renderer emitted, not a cache anyone may consult to decide existence.
 * Writing refs at render time is what closes the fail-open, because anything
 * through the pipeline is indexed by construction and anything else is an
 * enumerable gap rather than a silent one.
 */
```

### app/db/schema.ts:248 (CONTRACT, shortened)

why it is modelled, why every read stays raw, and what section 4a asserts; the printed gate line goes to history. Both hard rule citations stay.

```ts
/**
 * The site-wide search index. DERIVED, and the only table drizzle did not model.
 *
 * ## WHY IT IS DECLARED HERE, given that nothing reads it through drizzle
 *
 * Hard rule 11 says this file is the source of truth for the column schema, and
 * `check:invariants` section 4 compares it against the migrations and the live
 * database in both directions. A table absent from this file is absent from that
 * comparison: until 2026-08-28 the gate printed `search_docs` on a line reading
 * "not modelled in drizzle and UNCOVERED", which is an exposure honestly stated
 * and still an exposure. Declaring it closes it. That is the whole benefit and
 * it is a real one: this table's column names live inside hand-written SQL
 * strings, which is exactly the shape that produced the `media.r2_key` defect
 * section 4 was built for.
 *
 * ## AND WHY EVERY READ STAYS IN RAW SQL
 *
 * Hard rule 1 is enforced for this table by section 8, which scans the raw SQL
 * for the composed visibility predicate. Section 6, the drizzle-shaped scan,
 * knows only about `posts`. So a query-builder read of this table would be seen
 * by NEITHER, which is a hole that declaring the table would otherwise open.
 *
 * Section 4a asserts there is no such read, so the property is checked rather
 * than requested. If a drizzle read is ever wanted here, teach section 6 about
 * this table FIRST and delete that assertion in the same commit.
 *
 * The two FTS5 mirrors over this table stay out of drizzle entirely: they are
 * `CREATE VIRTUAL TABLE`, which the query builder cannot express, and section 4
 * excludes them by reading their DDL rather than by matching their names.
 */
```

### app/db/schema.ts:298 (CONTRACT, shortened)

why visibility is carried rather than joined.

```ts
/**
     * Visibility, carried on the record rather than joined from `posts`.
     *
     * A future `publish_at` has to be re-evaluated per request, so an index
     * storing only what was visible at sync time would leak a scheduled post
     * the moment its date passed, or hide it forever.
     */
```

### app/db/schema.ts:320 (CONTRACT, shortened)

neither authored nor derived, no IP column ever, and every string plain text; the hard rule citation stays.

```ts
/**
 * WEBMENTIONS RECEIVED FROM OTHER SITES. Grounds in drizzle/0014_webmentions.sql.
 *
 * ## THE FIRST TABLE HERE THAT IS NEITHER AUTHORED NOR DERIVED
 *
 * Every other content table on this site is one or the other. `posts` is
 * authored in the repository; `media`, `media_refs` and `search_docs` are
 * DERIVED and converge toward the repository and the bucket under hard rule 18.
 * A webmention row is neither: it was written by a stranger's POST, and there
 * is no source to converge it back to. So rule 18 does not reach this table,
 * a rebuild cannot repair it, and the only bound on its size is the one the
 * endpoint enforces on the way in. `app/routes/webmention.ts` states the four
 * bounds and why they are the whole answer.
 *
 * ## NO IP COLUMN, AND THERE NEVER IS ONE
 *
 * The per-IP rate limit is a Durable Object counter keyed on `wm:<ip>`, which
 * expires with its window and stores no row. Nothing about the sender is
 * recorded here beyond what the sender's own PAGE says: a URL they published,
 * a name from their h-card, and a sentence of their own prose. That is what
 * `/privacy` claims, and this absence is what makes the claim true.
 *
 * ## EVERY STRING IS PLAIN TEXT
 *
 * `author_name`, `author_url` and `excerpt` are read out of a document this
 * site does not control. They are stored as text, never as markup, and the H2
 * render is escaped text plus one validated anchor. A column that held HTML
 * would make every reader of this table a potential injection site.
 */
```

### app/db/schema.ts:355 (CONTRACT, shortened)

why a slug and not a URL.

```ts
/**
     * THE POST SLUG, NOT A URL, and the difference is the point.
     *
     * A stored target URL would carry the origin it was received on, and this
     * site answers on workers.dev today and on the apex after cutover. Rows
     * written before the move would then name a host the render no longer
     * uses, and deduplication would treat the two spellings of one post as two
     * targets. The slug is what `posts` is keyed by and it does not move.
     */
```

### app/db/schema.ts:365 (CONTRACT, shortened)

the state machine and what is inert.

```ts
/**
     * unverified -> pending | failed, then pending -> approved | rejected.
     *
     * `unverified` is what the endpoint writes before it has fetched anything,
     * so a row exists for the global cap to count from the first moment. Only
     * `approved` will ever render (H2), which is why an unfetched or refused
     * mention is inert rather than merely unshown.
     */
```

### app/db/schema.ts:393 (CONTRACT, shortened)

what the unique index bounds.

```ts
/**
     * ONE ROW PER (SOURCE, TARGET). The third of the four bounds.
     *
     * A sender re-announcing the same mention updates the row it already has
     * rather than adding one, so a loop against this endpoint cannot grow the
     * table at all: the ceiling is the corpus size times the number of distinct
     * pages on the internet that link to it, which is a real number rather than
     * a function of how fast somebody can POST.
     */
```

## app/lib/editor/frontmatter.ts

### app/lib/editor/frontmatter.ts:6 (CONTRACT, shortened)

what it produces and why scalars are JSON strings.

```ts
/**
 * Turns editor form fields into a markdown file, and back.
 *
 * The file is the artifact of record, so this has to produce something a person
 * would be content to see in a diff and that the build pipeline parses without
 * special cases. Scalars that can carry punctuation (titles, descriptions, alt
 * text) are emitted as JSON strings, which are valid YAML double-quoted scalars
 * and escape quotes and colons correctly without a YAML serializer.
 */
```

### app/lib/editor/frontmatter.ts:27 (CONTRACT, shortened)

why a server-owned field is carried through the form.

```ts
/**
   * Server-owned, carried through the editor untouched.
   *
   * The editor never offers this as a field and never sets it. It is here only
   * so a browser save PRESERVES it: serializePost writes exactly the keys it
   * knows about, so a value it did not carry would be silently dropped on the
   * next edit, and a published post would read as never published.
   */
```

### app/lib/editor/frontmatter.ts:36 (CONTRACT, shortened)

why these keys are carried and not edited; the finding's audit goes to the history document.

```ts
/**
   * CARRIED, NOT EDITED. Finding B004.
   *
   * Everything below is a real key in `frontmatterSchema` that this pair did
   * not know about, and the consequence was silent data loss: `serializePost`
   * writes exactly the keys it is handed, so a post committed by hand or by the
   * operator API with `featured`, `series`/`part`, `further_reading`, an OG
   * override or an explicit `updated` had those keys ERASED by the next browser
   * save. Nothing warned, because the save was valid: the file simply came back
   * smaller. Revision restore lost them the same way, since it loads a
   * historical file through `parsePost`.
   *
   * They are preserved rather than exposed as form controls, which is the same
   * treatment `firstPublished` gets and the smallest change that makes the round
   * trip lossless. Giving them editors is a feature and can be decided on its
   * own; losing them is a bug either way.
   *
   * `furtherReading` is the one that cannot be a scalar. It travels as JSON in a
   * hidden input and is re-emitted as a YAML block, so the editor never has to
   * understand its shape to avoid destroying it.
   */
```

### app/lib/editor/frontmatter.ts:95 (CONTRACT, shortened)

the one transform and the prohibition on a second; the CRLF defect goes to history.

```ts
/**
 * The body, exactly as it will be stored.
 *
 * CRLF to LF, then trimmed. Extracted from `serializePost`, where it was
 * inline, because a SECOND caller needs the identical transform and the two
 * silently disagreeing is not hypothetical: it shipped.
 *
 * The admin preview posts its body with `fetch` and a `FormData`, which encodes
 * as multipart, and multipart serialization normalizes every newline to CRLF.
 * The save path stripped them here and the preview route did not, so the
 * preview rendered CRLF inside paragraph text where the published artifact had
 * LF. Same source, different bytes, which is precisely the claim ruling 3
 * exists to make true. Found on the live deploy 2026-08-01, invisible to the
 * offline parity check because that feeds the renderer straight from the
 * artifact and never crosses a form encoding.
 *
 * Both callers now use this. There is no third way to prepare a body.
 */
```

### app/lib/editor/frontmatter.ts:117 (CONTRACT, shortened)

why parsing is loose here and strict in the schema.

```ts
/**
 * The `further_reading` list a hidden input is carrying, as objects.
 *
 * Tolerant on purpose. This value crosses a form round trip, so the honest
 * failure mode is "the input was empty or malformed", and the schema is what
 * judges the CONTENT: `frontmatterSchema` rejects a bad url with the protocol
 * allowlist, and it runs on the serialized file server side either way. Parsing
 * loosely here and validating strictly there keeps one authority over the rule
 * rather than two that can disagree.
 *
 * Entries missing a title or url are dropped rather than emitted half-formed,
 * because a `- title:` with no `url` is a schema failure that would block the
 * save on data the author never typed.
 */
```

### app/lib/editor/frontmatter.ts:175 (WHY, shortened)

why each key is conditional.

```ts
/*
   * The B004 keys. Each is emitted only when it has a value, so a post that
   * never set one is byte-identical to what it was before this existed: adding
   * `featured: false` to twelve files would have churned the artifact for a
   * default nobody wrote.
   */
```

### app/lib/editor/frontmatter.ts:251 (CONTRACT, shortened)

one owner of the names and which one is load bearing.

```ts
/**
 * THE FIELD NAMES THE FURTHER-READING CONTROLS SUBMIT, stated once.
 *
 * The component renders them and the parser below reads them, so a second
 * spelling would be a control that silently submits into nothing. Rule 17 on a
 * set of names rather than on a number.
 *
 * `FR_CONTROL` is the MARKER, and it is the load-bearing one. See
 * `furtherReadingFromForm`.
 */
```

### app/lib/editor/frontmatter.ts:298 (CONTRACT, shortened)

the marker, why absence cannot mean cleared, and the ordering effect.

```ts
/**
 * REBUILDS `further_reading` FROM THE CONTROLS, or leaves it exactly as it came.
 *
 * ## The marker, and why an absent field cannot mean cleared
 *
 * A list control has a genuinely ambiguous empty state: "the author removed
 * every row" and "this form never rendered the control" both arrive as no
 * fields at all. Collapsing them is the B004 data-loss class the hidden inputs
 * exist to prevent, and it is worse here than for a scalar, because the value
 * being destroyed is a list the author curated.
 *
 * So the control renders a hidden marker alongside itself. The marker present
 * means the control was on the page, so an empty result is the author's
 * emptiness and is honoured. The marker absent means nothing here was offered,
 * so the carried `furtherReading` JSON is passed through untouched, which is
 * exactly what the hidden input did before any of this existed.
 *
 * The marker is a hidden input rather than an inference from the row fields,
 * because inferring it from the rows is the same ambiguity one level down: a
 * control with every row cleared submits empty strings, and a control that was
 * never rendered submits nothing, and both would have to be told apart by a
 * rule that cannot see the difference.
 *
 * ## Ordering
 *
 * External rows in document order, then internal picks in the order the picker
 * renders them. A list mixing the two therefore NORMALISES to externals-first
 * on its first save and is stable after that. Stated because it is a real
 * effect on the author's file: it is a grouping, nothing is dropped or
 * reordered within a group, and the alternative (threading original positions
 * through two separate controls) buys an ordering nobody asked for.
 *
 * Rows with neither a title nor a url are dropped, which is how the spare blank
 * row costs nothing. A row with only one of the two is KEPT, so the schema
 * refuses it by name rather than this silently discarding what the author typed.
 */
```

### app/lib/editor/frontmatter.ts:348 (CONTRACT, shortened)

why one compound value, and that the title is a snapshot.

```ts
/*
   * The picker submits ONE checked box per chosen post, and the box's VALUE
   * carries both the slug and the title as JSON.
   *
   * A parallel hidden `title` field per post was the obvious alternative and it
   * is worse in a way that matters here: it puts one field NAME per corpus post
   * into the submission tuple `check:admin-ui` pins, so the fixture would grow
   * with the blog and a new post would read as an editor payload change. One
   * name, carrying a compound value, keeps the tuple a property of the editor
   * rather than of how much has been written.
   *
   * The title is a SNAPSHOT taken when the box was ticked, exactly as an
   * external link's title is typed once. Retitling the target does not rewrite
   * links that already point at it; `check:content` guards the link resolving,
   * which is the half that can break silently.
   */
```

### app/lib/editor/frontmatter.ts:395 (CONTRACT, shortened)

why the intent comes from the submitter, and the fail-closed default.

```ts
/*
     * FROM THE BUTTON THAT WAS PRESSED, not from a field.
     *
     * This read `form.get("draft") === "on"`, against a hidden input that each
     * transition button flipped in its own `onClick`. That made every
     * publication transition script-dependent: with scripting off no handler
     * ran, the input submitted whatever the server rendered, and the request
     * described the post's CURRENT state rather than the one the author asked
     * for. `publish-transition.mjs` carries the three defects that produced and
     * the argument for the submitter.
     *
     * Fails closed on an intent this table does not know: unknown means draft.
     */
```

### app/lib/editor/frontmatter.ts:415 (CONTRACT, shortened)

why the carried keys use explicit values rather than presence.

```ts
// The B004 keys, all through hidden inputs for the same reason. A checkbox
    // is absent from a FormData when unchecked, so `featured` is carried as an
    // explicit "true"/"false" string rather than by presence: the editor is not
    // offering a control here, it is relaying a committed value, and presence
    // semantics would turn "the form did not carry it" into "the author cleared
    // it", which is the exact class of loss this finding is about.
```

### app/lib/editor/frontmatter.ts:421 (CONTRACT, shortened)

the last-wins rule and why it changes nothing for older payloads.

```ts
/*
     * THE LAST `featured` WINS, and that is what makes a checkbox safe here.
     *
     * The field is submitted TWICE when the box is ticked: a hidden "false"
     * that the form always carries, and the checkbox's own "true" after it. An
     * unticked checkbox submits nothing, so the hidden value stands alone and
     * the answer is "false". That is the standard pairing, and it is used
     * instead of a bare checkbox for the reason the hidden input was introduced
     * for: a bare checkbox makes "the form did not carry it" and "the author
     * cleared it" the same request, which is the B004 class.
     *
     * Reading the LAST value rather than the first is the whole of the change,
     * and it changes nothing for any payload that predates the checkbox: with
     * one value present, first and last are the same value. `form.get()`
     * returns the FIRST, so keeping it would have made the hidden "false"
     * permanently win and the control silently do nothing.
     *
     * Absent entirely still reads false, exactly as before. This parser has one
     * caller and the editor always renders the hidden input, so absence is not
     * reachable from the product; the behaviour is preserved rather than
     * improved because changing it would change an existing field's meaning.
     */
```

## app/routes/media.$.ts

### app/routes/media.$.ts:7 (CONTRACT, shortened)

what it serves, that nothing is written back, why the binding, and why the transform is cached; the 1042 measurement goes to the history document.

```ts
/**
 * Serves editor-uploaded media from R2, and derives thumbnails from it.
 *
 * Keys are immutable by construction, so responses carry a one year immutable
 * cache and an ETag.
 *
 * ## Thumbnails, ruling 3
 *
 * `?w=` returns a transform of the ORIGINAL, computed on request. Nothing is
 * ever written back to the bucket: one object, every size derived from it, which
 * is what keeps R2 free of variant sprawl and is why the bucket needs no
 * lifecycle rules.
 *
 * **It uses the Images BINDING rather than the `/cdn-cgi/image/` URL syntax,
 * and that is forced rather than preferred.** Measured 2026-08-02: the URL
 * interface answers 404 with Cloudflare error 1042 on this hostname, because
 * transformations there require a customer zone and this site is served from
 * `workers.dev`. The binding is not zone-scoped and was verified working
 * against the real edge before any of this was written.
 *
 * The transform is CACHED explicitly through the Cache API. The binding's own
 * responses are not cached by Cloudflare, and every uncached call is a full
 * decode and re-encode, which is both slow and a billed transformation.
 */
```

### app/routes/media.$.ts:31 (CONTRACT, shortened)

the prohibition, why it does not lean on the CSP, and why by stored type; the Report-Only history goes to the history document.

```ts
/**
 * SVG IS SERVED AS AN ATTACHMENT, NEVER INLINE.
 *
 * An SVG is a document, not a picture: it can carry `<script>`, `<foreignObject>`
 * and external references. Anything in this bucket arrived through the upload
 * form, `image/svg+xml` is on the allowed list in `upload-contract.mjs`, and
 * this route serves it from the SITE'S OWN ORIGIN. Inline, a stored SVG is
 * script running as the site.
 *
 * **The CSP now BLOCKS that, and this rule is kept anyway.** Enforcement landed
 * 2026-08-17, and `workers/app.ts` stamps the policy on EVERY response with no
 * early return, so a `/media/*` document is governed by
 * `script-src 'nonce-...' 'strict-dynamic'` and an inline script inside a
 * stored SVG carries no nonce. Until then the comment here read "the CSP is
 * still Report-Only so it would report the execution rather than prevent it",
 * which is why the wording is being replaced rather than deleted: the sentence
 * was true when written and had gone false in the SAFE direction, which is the
 * kind that never announces itself.
 *
 * Defence in depth, deliberately. This rule does not depend on the CSP, does
 * not move if a directive is loosened, and holds for any client that ignores
 * the policy.
 *
 * `attachment` is the fix rather than a sandbox or a nonce because nothing
 * legitimately renders an R2 SVG inline: the brand marks and the diagram pairs
 * are STATIC assets whose keys begin with `/`, served by the assets host and
 * never through here (`thumbUrl` returns such keys untouched, and a grep of
 * app/ and content/ for `/media/*.svg` finds nothing).
 *
 * Applied by the STORED content type, so a file renamed to `.png` on the way in
 * is still caught, and a future allowed type with the same property has one
 * place to be added.
 *
 * @param {Headers} headers Headers already carrying the object's metadata.
 */
```

### app/routes/media.$.ts:84 (CONTRACT, shortened)

why both width sets are closed.

```ts
// TWO closed sets, unioned. An open set lets any caller mint unlimited
    // distinct transforms of one object, each a separately billed unique
    // transformation and a separate cache entry, so both sets stay closed.
```

### app/routes/media.$.ts:110 (CONTRACT, shortened)

where the helper went and what stops it coming back.

```ts
/* `bucketFor` MOVED to `classify.mjs`. It was one of three copies of the same
 * expression, all agreeing, with nothing holding them together;
 * `check:invariants` now fails if a second one reappears. */
```

### app/routes/media.$.ts:115 (CONTRACT, shortened)

the key carries everything the body depends on, and there is no purge door; the per-colo readings and the byte table go to the history document. The hard rule citation stays.

```ts
// Keyed by the full request URL, so each width is its own entry and the
  // original is untouched. Safe to cache forever for the same reason the
  // original is: the key never changes meaning.
  //
  // **THIS KEY CARRIES NO HEADERS, SO `Vary` CANNOT HELP IT.** The lookup
  // presents a synthetic Request built from the URL alone, so there is no
  // `Accept` (or anything else) for a variant to be matched against. Workers
  // Cache in front of the Worker DOES honour `Vary` on any header, but this
  // layer does not and cannot. Any response served from here must therefore
  // depend on nothing but the KEY. See the format note below.
  //
  // ## THE ENCODER SETTINGS ARE IN THE KEY, AND THE OMISSION WAS MEASURED
  //
  // The sentence above used to end "nothing but the URL", and that stopped
  // being true the moment `WEBP_QUALITY` became an input to the body. Adding it
  // changed what this route produces and orphaned NOTHING: every entry stored
  // under the old encoder stayed live, reachable and `immutable` for a year.
  //
  // Measured on production 2026-09-02, hours after the quality fix deployed,
  // on the canonical `srcset` URLs a reader's browser actually requests:
  //
  //     w=320   plain 119,196 B VP8L (HIT)   cold key 28,446 B VP8
  //     w=1408  plain 979,922 B VP8L (HIT)   cold key 198,908 B VP8
  //
  // The code was correct and readers were still being served the pre-fix
  // lossless bodies. Invalidation was per-colo and partial, so reading one URL
  // and generalising said the opposite of the truth. There is no purge door for
  // this cache, and `workers.dev` has no zone to purge through the API, so the
  // key is the only lever.
  //
  // A SYNTHETIC PARAMETER, never served and never linked, exactly the shape
  // `workers/app.ts` uses to get the resolved theme into its own key. Changing
  // the encoder now moves every entry to a new key by construction.
  //
  // Hard rule 20.
  //
  // `caches.default` is the Workers runtime's own cache. The DOM lib's
  // CacheStorage type does not declare it, so the cast is narrowing to the
  // runtime that actually serves this, not papering over an unknown.
```

### app/routes/media.$.ts:164 (CONTRACT, shortened)

why a missing binding is named rather than inferred.

```ts
// The binding is configured in wrangler.jsonc, which this repo does not track
  // (it carries account ids). A clone or a rebuilt config can therefore be
  // missing it, and the failure would otherwise look like a slow grid rather
  // than a missing binding. Named explicitly so it is diagnosable from a
  // response header instead of from a guess.
```

### app/routes/media.$.ts:180 (CONTRACT, shortened)

which shapes crop and the roster exemption.

```ts
// ADMIN TILES CROP, CONTENT DOES NOT.
  //
  // The two width sets serve different shapes. `.media-thumb` is a fixed 10rem
  // strip that already crops in CSS, so cropping server-side as well is strictly
  // better: `gravity: "auto"` uses saliency detection to keep the subject, where
  // CSS `object-fit: cover` blindly keeps the centre, and the smaller body is
  // fewer bytes over the wire. A content image in the prose column has no fixed
  // height and must never be cropped at all: the author chose the framing.
  //
  // ROSTER PHOTOS ARE EXEMPT EVEN AT TILE SIZES. They are group photographs and
  // `fit: "cover"` cuts faces off the edge of the frame, which is the one thing
  // a photo of named people may not do.
```

### app/routes/media.$.ts:195 (CONTRACT, shortened)

one format and why negotiation may not come back; the poisoning incident, the docs audit and the byte comparison go to the history document.

```ts
// ONE FORMAT, UNCONDITIONALLY. WebP, for everyone, regardless of Accept.
  //
  // **This used to negotiate AVIF/WebP/JPEG from `Accept` and set
  // `Vary: Accept`, which was a live cache-poisoning bug.** The `caches.default`
  // key above is built from the URL with no headers, so `put` and `match` both
  // presented an empty `Accept` and every client collapsed onto whichever format
  // the first caller happened to get, for a year, under `immutable`. Found by an
  // external audit 2026-08-02.
  //
  // **A PRECISION THAT MATTERS, because the first write-up of this got it
  // wrong:** the failure was specific to `caches.default`, NOT to `Vary` in
  // general. Only the manual key here could not vary at all.
  //
  // **CORRECTED 2026-08-05, because the correction was itself wrong.** This
  // comment used to claim "Workers Cache honours `Vary` on any request header
  // with no allowlist, so the outer layer would have keyed correctly". That is
  // not what the docs say and it is half wrong by measurement:
  //
  //   - developers.cloudflare.com/workers/cache/cache-keys/ lists the Workers
  //     Caching key as the target entrypoint, the path and query string, the
  //     Worker version and `ctx.props`. `Vary` is NOT part of it.
  //   - developers.cloudflare.com/cache/how-to/cache-rules/settings/#vary makes
  //     origin `Vary` a Cache Rules setting that is OFF unless configured, and
  //     Cache Rules need a proxied zone, which workers.dev does not have.
  //
  // Measured on this site with a paired control: `Accept` DOES separate stored
  // variants, but on a response varying on two headers the `Cookie` dimension
  // collapses once a second variant exists, which is the defect repaired in
  // `search.tsx` and `markdown-twin.ts`. So "keying correctly" was true for the
  // header this route cared about and false in general, and relying on it would
  // have been relying on undocumented behaviour.
  //
  // Keeping the negotiation was therefore possible only in the narrow sense
  // that `Accept` happens to separate. The decision below stands on the
  // measurement, not on this mechanism.
  //
  // It was still dropped, on the measurement rather than the mechanism: AVIF
  // came in at 21797 bytes against WebP's 22072 for the same source, 275 bytes,
  // 1.2%. That is not worth a second cache layer's worth of subtlety, and this
  // layer exists for a real reason (an uncached binding call is a full decode
  // and re-encode, and a billed transformation, on a grid that renders many
  // tiles at once).
  //
  // There is still no <picture> element anywhere in this codebase. Its usual job
  // is exactly this fallback, and there is now nothing to fall back between.
```

### app/routes/media.$.ts:249 (CONTRACT, shortened)

why the fallback is safe here and the prohibition on generalising it.

```ts
// A file the transformer cannot read (an SVG, a corrupt upload) is not an
    // error worth a 500: the grid should still show something. Falling back to
    // the original is safe HERE, where it is one tile, and is exactly what must
    // not happen silently as a general strategy.
```

### app/routes/media.$.ts:264 (CONTRACT, shortened)

why no Vary, and what the header is for.

```ts
// NO `Vary` HEADER, deliberately. The body no longer depends on any request
  // header, so there is nothing to vary on, and advertising a `Vary` the
  // `caches.default` key cannot honour is worse than advertising none: it reads
  // as a guarantee this layer is structurally unable to make.
  // Makes the transform observable from outside, which is what lets a
  // verification prove the grid is not being served full-resolution originals.
```

## app/enhance/theme.ts

### app/enhance/theme.ts:1 (CONTRACT, shortened)

the law, the no-flash rule and why the palette loader lives here; the bundle arithmetic goes to the history document.

```ts
/**
 * Theme toggle enhancement, and the door the search palette comes through.
 *
 * Everything here removes a round trip and nothing here makes the control work:
 * with this file absent the form posts to /theme, the action sets the cookie
 * and the server renders the chosen theme. That is the zero-JS path and it is
 * the same path the enhancement writes to, because both end at the same cookie.
 *
 * There is deliberately no "apply the stored theme on load" step. The server
 * already wrote the attribute from the cookie, so a script that re-applied it
 * could only ever agree, or race. The flash this file does not have is the one
 * it never creates.
 *
 * ## WHY THE PALETTE LOADER LIVES HERE, of all places
 *
 * Two bundles used to be on every document: this one and the search palette.
 * The palette is by far the larger of the two and it exists to answer one
 * gesture, so almost every reader downloaded a search dialog, parsed it, and
 * navigated away without ever opening it. What the shortcut actually needs on
 * page load is a keydown listener, which is a few lines.
 *
 * So the few lines are here, in the module that is on every page anyway, and
 * the dialog arrives on the first gesture. This file is the smallest thing on
 * the site that is genuinely site-wide, which is the whole reason it was
 * chosen: adding the loader to it costs one document nothing extra, while
 * adding a second site-wide bundle costs every document.
 */
```

### app/enhance/theme.ts:32 (CONTRACT, shortened)

why there is no re-run guard and why the listener is on the document.

```ts
// Loaded by a script tag whose module executes once per document, so there
  // is no re-run to guard against: without hydration every navigation is a
  // fresh document. Listening on the document rather than the form keeps the
  // handler working wherever the toggle is placed.
```

### app/enhance/theme.ts:47 (CONTRACT, shortened)

one predicate for both halves of the control.

```ts
/*
     * THE WRITABLE SET, which is exactly what `/theme` accepts. One predicate
     * for both, so the enhancement cannot apply a value its own fallback would
     * reject: the two halves of the control agree about what a legal
     * submission is because they ask the same function.
     */
```

### app/enhance/theme.ts:63 (CONTRACT, shortened)

why an event rather than an import, and why no nonce is needed; the measured helper bytes go to history.

```ts
/**
 * The event `app/enhance/palette.ts` listens for. One spelling, two files.
 *
 * A custom event rather than a module export, and the reason is a
 * measurement rather than a preference. The direct shape is a dynamic
 * `import()` of the bundle and a call to what it exports; vite rewrites every
 * `import()` into a call to its own `__vitePreload` helper, which MEASURED
 * 2026-08-27 added roughly 2.3 KB to this 714-byte bundle in order to manage a
 * preload graph that does not exist here, since build-enhance emits one
 * self-contained chunk per module. That is a large fraction of what taking the
 * palette off every page saved in the first place.
 *
 * A script element inserted by a script that is already trusted is allowed by
 * `script-src 'strict-dynamic'` with no nonce, which is why this needs no
 * access to the request nonce that `EnhancementScript` has and this file does
 * not.
 */
```

### app/enhance/theme.ts:85 (CONTRACT, shortened)

the fallback rule and why the first gesture waits for load.

```ts
/**
 * Opens the palette, fetching it first if this is the first gesture.
 *
 * FAILURE FALLS BACK TO THE PAGE, never to nothing. The caller has already
 * prevented the anchor's default, so a load error would otherwise leave a
 * reader who clicked with no response at all. `/search` is the same
 * destination the anchor carries, so a reader on a broken connection gets the
 * server-rendered search page, which is rule 9's fallback rather than a
 * consolation.
 *
 * The first gesture dispatches from the script's own `load`, because the
 * listener on the other side does not exist until the module has executed.
 * Every later gesture dispatches immediately.
 */
```

### app/enhance/theme.ts:101 (CONTRACT, shortened)

why the URL is read off the element and what its absence means.

```ts
// The URL is hashed by the app build, so it cannot be written down here: the
  // `?url` import in search-trigger.tsx is the one statement of it and it
  // arrives on the element this file upgrades. No attribute means no palette,
  // rather than a broken one.
```

### app/enhance/theme.ts:114 (CONTRACT, shortened)

why the stylesheets travel with the bundle, why awaited, and why a failed sheet resolves.

```ts
/*
     * THE DIALOG'S STYLESHEETS TRAVEL WITH ITS BUNDLE, and they are awaited.
     *
     * The palette's CSS is 861 bytes brotli and the Ask panel inside it another
     * 402, on every document, for markup that does not exist until somebody
     * searches. It comes down here instead, from `data-palette-css`, which the
     * trigger carries as `?url` imports so the hashed names stay the build's
     * business.
     *
     * AWAITED, because the alternative is a visible flash: the bundle builds
     * the dialog and calls showModal the moment it runs, and a stylesheet still
     * in flight at that point means an unstyled modal on screen. Waiting costs
     * nothing a reader can see, since the two fetches are parallel with the
     * script's own.
     *
     * A FAILED STYLESHEET RESOLVES rather than rejecting. An unstyled dialog is
     * a bad dialog and no dialog at all is worse, so only the SCRIPT failing is
     * treated as failure.
     */
```

### app/enhance/theme.ts:168 (WHY, shortened)

why the helper went with its caller.

```ts
/*
 * `isTyping` WENT WITH THE BARE SLASH. It existed so a slash typed into a
 * field stayed a slash, and Cmd/Ctrl-K needs no such guard: it collides with
 * nothing a reader types. A helper kept past its only caller is dead code that
 * reads as load-bearing.
 */
```

### app/enhance/theme.ts:175 (CONTRACT, shortened)

the honesty contract on the hint; the surface change goes to the history document.

```ts
/**
 * Binds the two ways into search and makes the shortcut discoverable.
 *
 * THE HINT IS TOLD HERE AND NOWHERE ELSE, and that is the same promise it has
 * always made: nothing advertises the shortcut until the shortcut works. It
 * used to wait for the palette bundle, because that bundle held the listener;
 * the listener is attached by the line below, so the hint becomes true earlier
 * rather than later, and a reader whose script did not run is still never told
 * about a key that would do nothing for them.
 *
 * WHAT CHANGED 2026-08-29 IS THE SURFACE, NOT THE CONTRACT. It was a visible
 * `<kbd>/</kbd>` inside the control, removed on Dustin's aesthetic ruling. The
 * two surfaces that replace it cost no pixels: `title`, which a pointer user
 * gets on hover, and the `aria-describedby` region, which a screen reader
 * announces after the control's name. Both are set from here, so both inherit
 * the honesty contract for free.
 */
```

### app/enhance/theme.ts:192 (CONTRACT, shortened)

one spelling of the chord, and why the detection may be best-effort; the measured divergence goes to history.

```ts
/**
 * THE CHORD, SPELLED FOR THE PLATFORM, AND THE ONLY PLACE IT IS SPELLED.
 *
 * MEASURED 2026-09-14 on the deployed site: "/" did not open the palette and
 * Ctrl-K did, while the hint announced "Press slash to search" and the tooltip
 * read "Search". The slash was retired in the Part A review and the two
 * surfaces that advertise it were never moved, so the site spent that window
 * telling screen reader users to press a key bound to nothing. Nothing caught
 * it because `check:browser` could not run.
 *
 * Both surfaces are written from this one function for the reason the id is
 * written once: a chord spelled in two places stops agreeing the day one is
 * edited, and the half that rots is the one nobody can see.
 *
 * `userAgentData.platform` first because `navigator.platform` is deprecated;
 * the old property is the fallback rather than the primary, and the userAgent
 * string is the last resort. Getting this wrong costs a reader the wrong
 * modifier name, not a broken control: the listener takes meta OR ctrl either
 * way, which is why the detection may be best-effort here and may not be in
 * the handler.
 */
```

### app/enhance/theme.ts:222 (CONTRACT, shortened)

the order of the two writes.

```ts
/*
   * THE TEXT IS WRITTEN BEFORE THE UNHIDE, not after. The server renders a
   * placeholder that is never announced, and the moment this element becomes
   * visible to assistive technology it must already carry the true chord.
   * Unhiding first would open a window, however short, in which the stale
   * server text is the announced description.
   */
```

### app/enhance/theme.ts:235 (CONTRACT, shortened)

why the tooltip is not server-rendered.

```ts
/*
     * THE TOOLTIP IS SET HERE RATHER THAN SERVER-RENDERED, for the reason the
     * description is hidden until now: a `title` the server wrote would promise
     * a shortcut to a reader who has no script to answer it.
     */
```

### app/enhance/theme.ts:257 (WHY, shortened)

why the slash is gone and why the chord stays.

```ts
/*
     * THE BARE SLASH IS GONE, ruled against in the Part A review and accepted.
     * It collides with find-in-page, which is a browser affordance readers
     * already own, and it was borrowed from application UIs rather than earned
     * by anything this site does. Cmd/Ctrl-K stays: it is the palette
     * convention, it collides with nothing a browser binds, and it is not
     * advertised to a reader who has no script to answer it.
     */
```

### app/enhance/theme.ts:271 (CONTRACT, shortened)

why the attribute is always written and why returning to the default needs no line.

```ts
/*
   * A FLIP, so the attribute is always written. This carried a branch that
   * removed it instead, for a submission the control no longer makes; it was
   * unreachable code on the one path it existed for and still cost every reader
   * its bytes.
   *
   * Returning to the default is not a submission and needs no line here: a
   * reader clears the cookie in their browser and the next render omits the
   * attribute server-side, which is where the default has always been applied.
   */
```

### app/enhance/theme.ts:285 (CONTRACT, shortened)

the cascade owns the redraw, and why focus has to move anyway.

```ts
/*
   * ## THE CONTROL REDRAWS ITSELF FROM THE ATTRIBUTE, so there is nothing here
   *
   * This used to rewrite `aria-pressed` across three buttons. The single
   * control has no pressed state and no label to rewrite: both buttons are in
   * the DOM, `chrome-nav.css` displays whichever matches `data-theme`, and the
   * line above is the only thing that has to change for the right one to
   * appear. Swapping an icon or a label from here would be a second owner of a
   * decision the cascade already makes.
   *
   * ## FOCUS HAS TO MOVE, THOUGH, and that is not cosmetic
   *
   * The button that was just activated is the one the cascade hides, and
   * `display: none` on the focused element drops focus to `<body>`. A keyboard
   * reader would flip the theme and lose their place in the header, which is a
   * worse outcome than the round trip this enhancement exists to avoid.
   *
   * So focus moves to the button that replaced it, but ONLY when the hidden one
   * actually held focus. A pointer click leaves focus wherever the browser put
   * it, and stealing it in that case would be its own defect.
   */
```

## workers/media-events.ts

### workers/media-events.ts:6 (CONTRACT, shortened)

notification not dual write, who the authoritative writer is, idempotence, and why the object is re-read; the cost arithmetic goes to the history document.

```ts
/**
 * The media index write path: R2 emits, a queue delivers, this derives the row.
 *
 * **This is an event notification, NOT a dual write, and the distinction is the
 * whole ruling** (decisions.md, 2026-08-02). Writing R2 and then writing D1 from
 * the same request is the classic dual-write problem: one succeeds, the other
 * fails, and the two systems diverge silently with nothing to detect it. The
 * upload route already swallowed that failure, which was correct while D1 was a
 * mere annotation and becomes a drift generator the moment D1 is the index.
 *
 * So: **R2 is the write that matters, and this consumer is the authoritative
 * row writer.** The upload route does write a D1 row after its put, non-fatally
 * and for immediacy alone, so the library shows a fresh upload without waiting
 * on a queue; that write is allowed to fail precisely because this consumer
 * re-derives the row from the object and overwrites whatever the route managed.
 * The bucket emits an event, this consumer derives the row from what the object
 * IS, the platform retries on failure, and a permanent failure lands in a
 * dead-letter queue rather than a log line nobody reads. R2 wins any
 * disagreement, in both senses: the row is rebuilt from the object, never the
 * reverse, and a row whose object is gone is deleted. (An earlier version of
 * this paragraph claimed R2 was the Worker's only write target, which the
 * upload route's write-through falsified; the originalName note below already
 * admitted it.)
 *
 * **Idempotent, and by construction rather than by checking.** Every message is
 * handled by re-deriving the row from the object as it is RIGHT NOW and
 * upserting it. Replaying a message, delivering it twice, or delivering two
 * messages out of order all converge on the same state, because none of the
 * handling depends on what the message says the object used to be. Queues
 * guarantees at-least-once delivery, so this is a requirement and not a nicety.
 *
 * **The object is re-read rather than trusted from the event.** A notification
 * carries a size and an etag, but by the time it is handled the object may have
 * been replaced or deleted. Reading R2 is what makes the row describe reality
 * instead of describing a moment that has passed, and it is what lets a
 * `PutObject` event for an object that no longer exists correctly delete the row
 * instead of resurrecting it.
 *
 * Cost: Queues includes 1,000,000 operations a month and delivery is 3
 * operations per message, so the first billable operation arrives at roughly
 * 333,000 media writes a month. It never enters the bill at this volume.
 */
```

### workers/media-events.ts:49 (CONTRACT, shortened)

why the message is narrowed rather than typed.

```ts
/**
 * The one thing this consumer needs out of a notification.
 *
 * Read defensively rather than typed as a contract. A queue message is external
 * input: it crosses a process boundary, it may have been produced by a version
 * of R2's notification format this code has never seen, and it may simply be
 * malformed. Declaring `MessageBatch<R2Event>` would assert a shape nothing
 * verified, so the key is NARROWED out of `unknown` instead and anything that
 * fails to yield one is handled as a bad message rather than crashing the batch.
 */
```

### workers/media-events.ts:67 (CONTRACT, shortened)

the prohibition on a second copy and what the wrong bucket does; the A004 defect goes to the history document.

```ts
/*
 * `bucketFor` MOVED to `classify.mjs`, and the history is why it must be one
 * function rather than three that happen to agree.
 *
 * **This must ask, not assume, and the reason is a real defect it once caused.**
 * Until 2026-08-02 `indexOne` read `env.MEDIA` unconditionally while deriving
 * `storage` from `storageOf(key)` four lines later, so the consumer knew the key
 * belonged to OG and read the other bucket anyway. Because a missing object is
 * treated as a deletion, an OG-key event did not merely fail to index: it
 * DELETED the row.
 *
 * It was latent only because the notification rule was configured on
 * `dustinedwards-media` alone, which is safety by dashboard configuration rather
 * than by code. Adding notifications on OG, the obvious next step, would have had
 * every `build:og --remote` run silently strip the index. Since 2026-08-04 both
 * buckets DO notify this queue, so that safety margin is gone and the rule has to
 * hold in code.
 *
 * The asymmetry was invisible from inside: `rebuild.server.ts` already walked
 * both buckets correctly, and each file read correctly on its own. It took an
 * outside reader comparing the two. That is exactly the review this repo cannot
 * rely on, so the copies were collapsed into one and `check:invariants` now fails
 * if a second appears anywhere.
 */
```

### workers/media-events.ts:107 (CONTRACT, shortened)

why a transient failure is not acked.

```ts
// RETRY, explicitly. A transient D1 or R2 failure must not be acked, or
      // the row silently never appears and only check:media would ever notice.
      // After the configured attempts the platform moves it to the DLQ.
```

### workers/media-events.ts:119 (CONTRACT, shortened)

why it does not branch on the action, and what a static key would mean.

```ts
/**
 * Brings the index into line with the object, whatever the event claimed.
 *
 * Deliberately not branching on the action. A `PutObject` for something already
 * deleted and a `DeleteObject` for something already replaced are both handled
 * correctly by asking R2 what is true now, and that is what makes out-of-order
 * delivery safe. Branching on the action would make the answer depend on message
 * ordering, which Queues does not promise.
 *
 * A `static` key can never arrive here: those objects are not in any bucket and
 * emit no notifications. `bucketFor` sends them to MEDIA, where the miss deletes
 * a row that a rebuild would immediately restore, so the failure is loud in
 * check:media rather than silent. If static keys ever DO reach this path, that
 * is the bug to fix, not this line.
 */
```

### workers/media-events.ts:138 (CONTRACT, shortened)

R2 wins, and why the branch is logged.

```ts
// R2 WINS. The object is gone, so the row goes. Never the reverse: nothing
    // in this file writes to the bucket, and there is no import that could.
    //
    // LOGGED, because this branch is indistinguishable from the bug it hides.
    // A genuine delete and a key the consumer looked for in the wrong place, or
    // under the wrong encoding, both land here and both ack silently. That is
    // exactly how A004 stayed invisible: the symptom of reading the wrong bucket
    // was a row quietly not appearing.
```

### workers/media-events.ts:167 (CONTRACT, shortened)

why an unreadable image still gets a row.

```ts
// An unreadable image still gets a row. Dimensions are an enhancement and
      // NULL already means "not measured" in this schema; refusing the row
      // outright would make the index disagree with the bucket, which is the one
      // thing it may never do.
```

### workers/media-events.ts:173 (CONTRACT, shortened)

why it is derived here, why a second get, and that null is a real answer; the deferral defect goes to the history document.

```ts
/*
     * THE PLACEHOLDER, DERIVED HERE, since 2026-09-06.
     *
     * It used to be deferred to the bulk rebuild, on the reasoning that this
     * path runs on every write and a second body read is not free. That
     * reasoning was measured and it was wrong in the direction that matters:
     * the row this consumer writes carried NO placeholder, `upsertDerivedMedia`
     * turned that into NULL, and the upsert then ERASED whatever the last bulk
     * pass had derived. So the deferral did not merely postpone the work, it
     * destroyed the result of the work already done, and an editor upload could
     * never have a placeholder at all without someone running a rebuild by
     * hand. Both halves are fixed: this derives one, and the writer no longer
     * blanks a stored one when a caller has none.
     *
     * A SECOND R2 GET, because a body is a stream and `.info()` above has
     * already consumed the first. Same pattern the rebuild uses for the same
     * reason. The cost is one class B operation and one binding call per
     * uploaded image, against a queue whose first billable operation arrives at
     * roughly 333,000 media writes a month.
     *
     * NULL IS A REAL ANSWER. An SVG, a PDF or a corrupt upload has no
     * placeholder and gets a row anyway, exactly as it gets a row with no
     * dimensions. `placeholderFor` returns null rather than throwing, so this
     * cannot fail a message and send an otherwise good row to the dead-letter
     * queue.
     */
```

### workers/media-events.ts:212 (CONTRACT, shortened)

why the name comes off the object, and what null means downstream.

```ts
// Read off the OBJECT, so this path no longer depends on the upload route's
    // D1 write having succeeded. That write is non-fatal by design, and a
    // content-addressed key cannot yield a filename, so before this the name
    // had one source that was allowed to fail. Null for anything uploaded
    // without it, which `upsertDerivedMedia` treats as "do not touch".
```

### workers/media-events.ts:218 (CONTRACT, shortened)

what null means here; trimmed to two lines.

```ts
// Derived above, from a second read of the same object. Null when the
    // transformer could not read it, which `upsertDerivedMedia` treats as "do
    // not touch" rather than as an instruction to erase.
```

### workers/media-events.ts:226 (CONTRACT, shortened)

same read, MEDIA only, nothing deletes a twin, and why failure is swallowed.

```ts
/*
   * THE SECOND DERIVED ACTION: the mirror. Ruled 2026-09-01, decisions-vol-13.
   *
   * The row and the twin are derived from the SAME object read, by the same
   * "ask R2 what is true now" rule the rest of this function runs on, so the
   * mirror inherits every property that makes this path replay-safe. It is NOT
   * a dual write: the Worker still writes only to MEDIA, the bucket emits, and
   * this derives from what the bucket now holds.
   *
   * MEDIA ONLY. An `r2-derived` key is an OG card in the OG bucket, which is
   * regenerable by `build:og` from the corpus and is deliberately emptiable.
   * Mirroring it would back up the one thing that already has a rebuild door.
   *
   * NOTHING HERE DELETES A TWIN, and the absence is the design. The `!object`
   * branch above deletes the ROW when the object is gone, because D1 is a
   * projection of R2. The backup is not a projection: it is the copy that
   * survives the delete, so a deleted media object keeps its twin and pruning
   * the mirror is a human act. `check:destructive` fails on a delete against
   * MEDIA_BACKUP anywhere in this repository.
   *
   * Failure is LOGGED AND SWALLOWED rather than retried. The row is already
   * written and correct; throwing here would retry the whole message and
   * re-derive a row that was fine, and a missing twin is not lost data. It is
   * drift that `media-backup-drift` sees within one health poll and that
   * `backup_media` repairs by copying, which is the convergence this arrangement
   * is built on.
   */
```

## app/routes/webmention.ts

### app/routes/webmention.ts:11 (CONTRACT, shortened)

the four bounds, the without-the-limiter rule, what it does not do, and the no-IP claim; the argument's provenance goes to the history document.

```ts
/**
 * The webmention receiver. Item H1.
 *
 * **THIS IS THE SECOND PUBLIC, UNAUTHENTICATED POST ENDPOINT ON THIS SITE, and
 * the first one that writes a row.** It has to be public: a webmention is sent
 * by another site's server with no credential to offer, and an endpoint that
 * needs a token is an endpoint nobody sends to.
 *
 * ## THE ARGUMENT IT HAS TO ANSWER
 *
 * `app/routes/api.csp-report.ts` refuses to write rows and says why: "an
 * unauthenticated endpoint that writes rows is a storage-exhaustion primitive
 * handed to the internet". That is correct and it is the reason that endpoint
 * logs instead. This one cannot log instead, because the deliverable IS the
 * stored mention, so the argument has to be answered rather than avoided.
 *
 * ## FOUR BOUNDS, AND THEY ARE THE WHOLE ANSWER
 *
 * 1. **Per-IP rate, 20 per 60 seconds**, on the existing `AskBudget` Durable
 *    Object under a `wm:<ip>` instance name. No new class and no migration,
 *    exactly as the CSP sink, the operator path, the smoke credential and
 *    `/api/health` reuse it. This bounds the RATE.
 * 2. **The target must already be a publicly visible post here.** Not a URL
 *    shape, not a slug that parses: a row that `publiclyVisible()` admits,
 *    read through `webmentionTarget` in the DB chokepoint. So the set of
 *    accepted targets is the published corpus, which is a number this site
 *    controls entirely.
 * 3. **One row per (source, target)**, a unique index, and a re-sent mention
 *    UPDATES rather than inserting. So repetition costs nothing: the table's
 *    size is the corpus times the number of distinct pages that link to it,
 *    not a function of how many times anybody presses send.
 * 4. **A global cap on open rows.** At or above `OPEN_QUEUE_CAP` mentions in
 *    `unverified` or `pending`, this answers 503 and logs one line. This is the
 *    bound that does not depend on the other three being right, and it is the
 *    one that makes the storage claim a fact rather than an argument: the table
 *    cannot pass the cap plus whatever the admin has already approved.
 *
 * Together those are a bounded table filled at a bounded rate from a bounded
 * set of targets. Bound 4 alone would be enough to refuse the exhaustion; the
 * other three are what keep the endpoint USEFUL while it is refusing, which is
 * the property a cap on its own does not have.
 *
 * **Without `ASK_BUDGET` this does not serve.** The stance the Ask guards, the
 * CSP sink, `/api/health` and the operator path all take: an unprotected public
 * write path does not serve unmetered, it does not serve.
 *
 * ## WHAT IT DOES NOT DO
 *
 * It does not render anything. An accepted mention reaches `unverified`, then
 * `pending` if the source really links here, and stops. Approval is a human
 * action in `/admin/mentions`, and even an approved row has no public effect in
 * H1: rendering under the post, cache invalidation on approve, and advertising
 * this endpoint are all H2. A mention cannot reach a reader from this commit.
 *
 * It stores NO IP ADDRESS. The rate limiter's counter is keyed on one and
 * expires with its window; the row carries the sender's published URL, a name
 * from their h-card, and a sentence of their own prose. `/privacy` says exactly
 * that.
 */
```

### app/routes/webmention.ts:80 (NUMBER, shortened)

why the cap is small and why a 503; the corpus size goes to history.

```ts
/**
 * The ceiling on `unverified` plus `pending` rows. The fourth bound.
 *
 * **WHY 500 AND NOT SOMETHING LARGER.** This is a personal site with a corpus
 * in the low dozens. Five hundred unmoderated mentions is already far past what
 * one person will ever work through in a sitting, so a higher number would not
 * buy a real sender anything; it would only raise the amount of storage an
 * attacker who defeats bounds 1 through 3 can take. And the refusal is
 * RECOVERABLE by the one action that was needed anyway: the admin moderating
 * the queue drops the count below the cap.
 *
 * A 503 rather than a 429, because the condition is about this site's state
 * rather than about the caller's rate, and a well-behaved sender retrying later
 * is exactly the right response to it.
 */
```

### app/routes/webmention.ts:100 (CONTRACT, shortened)

one message for four problems, and the oracle it prevents; the hard rule citation stays.

```ts
/**
 * WHAT A REFUSED SENDER IS TOLD, and it is deliberately one string for four
 * different target problems.
 *
 * An unparseable URL, a foreign origin, a path that is not a post, a slug that
 * is not a slug, and a slug that names a DRAFT all answer with this. Especially
 * the draft: a distinct message would turn this endpoint into an oracle for
 * unpublished slugs, which is hard rule 1's leak arriving through a 400 instead
 * of through a page.
 */
```

### app/routes/webmention.ts:114 (CONTRACT, shortened)

why two origins rather than one.

```ts
/**
 * The origins this site answers on, for both the target and the source checks.
 *
 * TWO RATHER THAN ONE, and `app/lib/origin.mjs` makes the argument at length:
 * the site is pre-cutover, `SITE_ORIGIN` is workers.dev today and the apex
 * later, and pinning to a constant refuses every real request from whichever
 * host is not the constant at exactly the moment of the move. `SITE_ORIGIN` is
 * the origin a sender READ off a canonical link; the request's own origin is
 * where their POST arrived.
 */
```

### app/routes/webmention.ts:149 (CONTRACT, shortened)

why the header check refuses but never permits.

```ts
/*
   * 2. CONTENT-LENGTH IS A HINT FROM THE CLIENT, so it refuses early and never
   * permits. An honest oversized header is rejected without touching the body;
   * a missing or lying one falls through to `readCapped` below, which counts
   * the bytes as they arrive. The grounds are `app/lib/read-capped.mjs`, which
   * records the three ways the old Content-Length-only cap failed.
   */
```

### app/routes/webmention.ts:167 (CONTRACT, shortened)

why the limiter precedes the body read; the hard rule citation stays.

```ts
/*
   * 3. THE RATE LIMIT PRECEDES THE BODY READ, which is a change of order from
   * the letters this was specified in and is deliberate. Every check below it
   * costs something: a materialised body, a form parse, a D1 read. The
   * limiter's decision costs one Durable Object call and is the only thing here
   * that bounds how often the rest can be reached at all, so it goes first
   * among the things that can refuse a well-formed request. Same ordering
   * principle as hard rule 19's chain: each stage refuses before the next
   * spends anything.
   *
   * Keyed on the edge-set client IP rather than anything in the body, which the
   * caller controls. One statement of the read: `app/lib/client-ip.ts`.
   */
```

### app/routes/webmention.ts:187 (CONTRACT, shortened)

why one encoding only.

```ts
/*
   * 4. THE FORM ENCODING, checked on the HEADER before the body is read,
   * because it is free there. The webmention protocol specifies this one
   * encoding, so accepting JSON as well would be inventing a dialect nobody
   * sends and giving the parser a second shape to be wrong about.
   */
```

### app/routes/webmention.ts:228 (CONTRACT, shortened)

why the visibility read is last among the refusals.

```ts
/*
   * THE VISIBILITY READ, and it is AFTER the source check on purpose. Both are
   * refusals; only this one costs a query, and a caller sending garbage sources
   * should not be able to make this site read D1 for each one.
   *
   * A draft, a scheduled post and a slug that names nothing are one answer,
   * `BAD_TARGET`, for the reason stated on that constant.
   */
```

### app/routes/webmention.ts:240 (CONTRACT, shortened)

what the cap is and the race it accepts.

```ts
/*
   * 7. THE GLOBAL CAP, the fourth bound, read immediately before the write it
   * guards. It is a count and not a reservation, so two requests arriving
   * together can both pass at the boundary; that is accepted and stated rather
   * than papered over, because the failure it would cause is one row past a cap
   * chosen with an order of magnitude of headroom, and the alternative is a
   * second Durable Object to make a queue length transactional.
   */
```

### app/routes/webmention.ts:260 (CONTRACT, shortened)

why the answer precedes verification and why waitUntil.

```ts
/*
   * 9. VERIFICATION AFTER THE ANSWER. The sender gets 202 immediately, which is
   * what the protocol asks for and what keeps a slow source off the critical
   * path. `waitUntil` rather than a queue: ruled 2026-09-04, a queue would be
   * new infrastructure for a load of zero. What a cut-short `waitUntil` leaves
   * behind, and why that is the safe direction, is on `verifyWebmention`.
   */
```

### app/routes/webmention.ts:272 (CONTRACT, shortened)

why a GET answers, and that it reveals nothing.

```ts
/**
 * A GET says what this is rather than 404ing, so anyone who finds the endpoint
 * knows what they are looking at. It reveals nothing: the text below is true of
 * every webmention receiver on the internet.
 *
 * The same shape as the CSP sink's loader, deliberately. Both are public POST
 * endpoints somebody may arrive at by hand.
 */
```

## app/routes/search.ask.ts

### app/routes/search.ask.ts:1 (CONTRACT, shortened)

resource route, nothing waits on it, and the cheapest-first order.

```ts
/**
 * Ask mode's streaming endpoint. Search Layer 2.
 *
 * A RESOURCE ROUTE, deliberately: it has no default export, so it is allowed to
 * return a raw Response. A document route's loader cannot, which is the same
 * constraint that put /search's JSON negotiation in middleware.
 *
 * NOTHING ELSE ON THE SITE WAITS ON THIS. It is fetched by the Ask panel after
 * classic results have already rendered, and it is only fetched at all when the
 * server said the binding exists. With scripting off nothing requests it.
 *
 * This is the only public endpoint on the site that costs money per request, so
 * it is also the only one with guards in front of it. Order matters and is
 * cheapest-first: refuse before spending, serve a cached answer before
 * generating, and only then reach the model. See ask-guard.server.ts.
 */
```

### app/routes/search.ask.ts:46 (CONTRACT, shortened)

what passes and what must not be replayed.

```ts
/**
 * Whether every post a cached answer cites is still publicly visible.
 *
 * Finding B010. An answer with no resolvable citations passes: it cited nothing
 * this site owns, so there is nothing that could have been withdrawn. An answer
 * citing a post that is now a draft, deleted, or scheduled forward fails and
 * must not be replayed.
 */
```

### app/routes/search.ask.ts:95 (CONTRACT, shortened)

why GET is refused and why 405 rather than 404.

```ts
/**
 * GET IS REFUSED, EXPLICITLY.
 *
 * This endpoint spends money and per-IP budget, so it must not be reachable by
 * anything that follows or fetches a URL on its own initiative: a crawler, a
 * link prefetch, an `<img src>` on any site, a preview unfurler. A GET that
 * bills is a side-effecting GET, and the method is the only part of that a
 * third party cannot choose for us.
 *
 * 405 with `Allow` rather than 404: the endpoint exists, the method is wrong,
 * and saying so is what stops the next caller reinventing the GET.
 */
```

### app/routes/search.ask.ts:115 (CONTRACT, shortened)

why origin is gate 0, what the per-IP limiter cannot see, and why absent is allowed.

```ts
/*
   * GATE 0, AND IT IS FIRST BECAUSE IT IS FREE. One header read, no env, no
   * body, no binding, no Durable Object. Everything below this line either
   * costs a round trip or costs money.
   *
   * A foreign page cannot be allowed to spend the shared Ask budget using its
   * own readers' browsers. The per-IP limiter cannot see that attack at all:
   * a thousand readers of one hostile page are a thousand IPs, each well
   * inside its own allowance. Origin is the one field on a cross-site POST
   * that the attacking page does not control.
   *
   * ABSENT Origin is ALLOWED and the reasoning is on the predicate. Short
   * version: a client that sends none is spending its own IP's allowance,
   * which is already bounded, and refusing it would break the no-script form
   * this route's body parsing was written to accept without buying anything
   * against the attack.
   */
```

### app/routes/search.ask.ts:142 (CONTRACT, shortened)

why 404 rather than 503.

```ts
// 404 rather than 503. With the binding absent this endpoint does not exist,
  // which is the same story the rest of the site tells: Ask is absent, not
  // broken. A 503 would imply something is meant to be here and is down.
```

### app/routes/search.ask.ts:149 (CONTRACT, shortened)

why the body is form-encoded.

```ts
/*
   * The question travels in a FORM-ENCODED BODY, which is what an ordinary
   * `<form method="post">` sends. Ask has no no-script form today (the trigger
   * is a button that does nothing without script, and its declared fallback is
   * the classic results already on the page), but reading the body this way
   * means adding one later is markup and nothing else.
   */
```

### app/routes/search.ask.ts:172 (CONTRACT, shortened)

why the limiter is in front of the cache.

```ts
// Gate 1, per IP. In front of everything, including the cache: a cached
  // answer is cheap but not free, and hammering for cached answers is still
  // abuse. NOTHING past this line has touched Workers AI.
```

### app/routes/search.ask.ts:182 (CONTRACT, shortened)

the replay must prove its citations, and why it is checked on replay; the leak's provenance goes to history.

```ts
// Gate 2, the cache. A hit is one KV read. It does not reach the model and
  // does not consume budget, and it is replayed in the same SSE shape so the
  // client cannot tell a replay from a generation.
  //
  // A HIT MUST STILL PROVE ITS CITATIONS ARE PUBLIC. Finding B010: the cache is
  // dropped on publish by `invalidateAnswerCache`, which enumerates KV with
  // `list`, and KV list is eventually consistent. An answer written moments
  // before a post is unpublished can therefore survive the invalidation meant
  // to remove it, and the TTL is a week. Without this check the endpoint would
  // keep answering from, and linking to, a post that is no longer public, which
  // is the 2026-07-29 draft leak reached by a different road.
  //
  // Checked on REPLAY rather than fixed at write time because the corpus can
  // change after the answer is already in KV, which is the whole problem. One
  // indexed D1 read on a cache hit is the price, and it buys the property that
  // no unpublished post is ever citable from cache.
```

### app/routes/search.ask.ts:208 (CONTRACT, shortened)

there is no single-flight and why the ceiling is the real bound; the generation timings go to the history document.

```ts
/*
   * Gate 3, the exact daily ceiling. Reserved here and nowhere else, because
   * this is the last point before the only line in the file that costs money.
   *
   * THERE IS DELIBERATELY NO SINGLE-FLIGHT, and finding B007 is right that
   * there is none: concurrent misses of the SAME question each reserve budget
   * and each generate. The bound is what makes that acceptable, so it is worth
   * writing down rather than rediscovering.
   *
   * Budget consumed is at most the number of requests that get past gates 1
   * and 2, and each such request generates exactly once. Deduplicating
   * identical questions does not lower the worst case: an attacker with N
   * addresses spends the same N units asking N DIFFERENT questions, which no
   * single-flight can collapse. The ceiling of 200 a day is the real bound and
   * it is exact, held by a synchronous-SQLite Durable Object rather than by
   * this line.
   *
   * What single-flight would recover is duplicated work in the BENIGN case: a
   * link is shared, several readers ask the same suggested question inside the
   * few seconds before the first answer lands in KV. The window is one
   * generation, measured at 2.1 to 7.4 seconds, after which every one of them
   * hits the cache for seven days. The cost of closing it is a Durable Object
   * instance per distinct question, an unbounded namespace, and a follower that
   * must either block for the leader's full generation or be refused an answer
   * it is entitled to. Neither is worth paying to save a handful of calls on a
   * personal site, and the ceiling means the exposure cannot compound.
   */
```

### app/routes/search.ask.ts:241 (CONTRACT, shortened)

the order of the guard and the tee.

```ts
/*
     * GUARD FIRST, THEN TEE, and the order is the whole point. The guard can
     * replace a zero-chunk generation with the no-answer text, and the cache
     * has to accumulate what the READER saw. Teeing first would store the
     * model's original answer while showing the reader the substitution, which
     * is exactly the two-truths shape the replay path exists to avoid.
     */
```

### app/routes/search.ask.ts:260 (CONTRACT, shortened)

the two refusals and what each one bounds; the audit's measurement goes to history.

```ts
/*
         * TWO REFUSALS, and neither is the other's backstop.
         *
         * An answer with NO CHUNKS was not drawn from this site. The guard
         * above has already replaced it for the reader; caching the
         * substitution would make "I could not find anything" the permanent
         * answer to that question for seven days, including after the post
         * that answers it is published.
         *
         * An answer that ECHOES THE PROMPT is a successful injection. Not
         * caching it is what keeps the blast radius at the one request that
         * performed it: measured 2026-08-27, the audit's question returned the
         * system prompt verbatim and the endpoint then served it from KV to
         * anyone who asked the same thing.
         */
```

### app/routes/search.ask.ts:286 (CONTRACT, shortened)

why a stream failure is not a 500.

```ts
// The instance being unreachable must not surface as a 500 on a page that
    // already rendered its real results. The client treats any non-200 as
    // "Ask is unavailable" and removes the panel.
```

## app/lib/media/core.server.ts

### app/lib/media/core.server.ts:6 (CONTRACT, shortened)

content-agnostic by construction and what that buys.

```ts
/**
 * MEDIA CORE. Library listing, upload, thumbnails, metadata and delete mechanics.
 *
 * Shape 1 of media-module-architecture.md: this module knows nothing about what
 * cites an object. Content-agnostic BY CONSTRUCTION, not by convention, which
 * in practice means there is no import of anything post-shaped anywhere in this
 * file and no parameter that could carry one. "Who cites this key?" is asked
 * through the resolver seam in `resolvers.server.ts`, and the answer arrives as
 * data the core never inspects.
 *
 * That is the property that lets an album or a portfolio type register later
 * without this file changing.
 */
```

### app/lib/media/core.server.ts:23 (CONTRACT, shortened)

what the constant was for and why it is gone.

```ts
/* DERIVED_PREFIX is GONE. It existed for `isManagedKey`, which excluded `og/`
 * keys by prefix beside its own copy of the key grammar. The grammar now has
 * one owner, `isContentKey` in classify.mjs, and its pattern admits no slash
 * and no non-hex lead, so an `og/` key fails the shape test itself and the
 * prefix check had nothing left to refuse. */
```

### app/lib/media/core.server.ts:29 (CONTRACT, shortened)

why the set is closed.

```ts
/**
 * Widths the thumbnail route will honour.
 *
 * A closed set, because the width lands in a cache key and an open one lets any
 * caller mint unlimited distinct transforms of the same object, each of which
 * is a billed unique transformation. Three sizes cover the grid thumbnail, the
 * picker tile and a 2x display of either.
 */
```

### app/lib/media/core.server.ts:67 (CONTRACT, shortened)

URL-derived, and nothing written back.

```ts
/**
 * The URL that renders this object at a thumbnail width.
 *
 * URL-DERIVED, per ruling 3: the width is in the URL, the transform happens on
 * request from the single original in R2, and no variant is ever written back.
 * One object, every size derived from it.
 */
```

### app/lib/media/core.server.ts:75 (CONTRACT, shortened)

why a static key is returned untouched and what that costs; the 58 broken rows go to history.

```ts
// A STATIC asset is indexed under its own public path, which already begins
  // with `/`, so prefixing `/media/` yields `/media//publications/x.pdf` and the
  // R2 route 404s on it. That was every one of the 58 static rows, including all
  // nine roster photos: the grid rendered a broken image for the only pictures
  // the page exists to surface.
  //
  // A static asset is served by the assets host directly, so it needs no
  // transform URL and gets none. The cost is that it is delivered at full size
  // into a thumbnail box; these are small files and a correct image beats a
  // resized 404. Serving static transforms would mean teaching /media/* to read
  // through ASSETS, which is a route change rather than a UI one.
```

### app/lib/media/core.server.ts:95 (CONTRACT, shortened)

why the type is derived and what the gate asserts; the twelve-axis defect goes to the history document.

```ts
/**
 * The listing axes, DERIVED from `listMediaPage` rather than restated here.
 *
 * Restating them is what broke `listMedia`. The options type named six of the
 * twelve axes `listMediaPage` implements, the loader passed all twelve through
 * an object SPREAD, and spreads are exempt from excess-property checking, so
 * `sort`, `dir`, `tag`, `lens`, `templateKeys` and `trashed` were accepted by
 * the compiler and dropped on the floor. Live effect, measured on production
 * 2026-08-16: `?sort=size` and `?sort=name&dir=asc` returned byte-identical
 * rows to the default, and `?trash=1` returned 24 NOT-trashed files while the
 * trash count beside it read 0.
 *
 * Deriving the type means a new axis on `listMediaPage` is covered here by
 * construction instead of by somebody remembering. `check:media-axes` asserts
 * both halves: that this stays derived, and that the forwarding stays a spread.
 */
```

### app/lib/media/core.server.ts:113 (CONTRACT, shortened)

why it reads D1 and why reading a derived copy is legitimate here.

```ts
/**
 * Lists one page of the library FROM D1.
 *
 * **It no longer touches R2, and that is the point of the index.** Listing from
 * the bucket could only ever paginate in key order, which stopped meaning
 * anything the moment keys became content-addressed digests. Every question the
 * library actually asks (newest first, images only, which are documents, how
 * many of each) is a query, and none of them can be built on a key-ordered
 * iterator without listing the whole bucket per request.
 *
 * D1 is DERIVED, so this is reading a copy, and that is legitimate here for the
 * one reason the ruling turns on: the copy is exhaustively reconcilable against
 * its source, and `check:media` reconciles it in both directions on every run.
 * R2 remains the truth for what exists.
 */
```

### app/lib/media/core.server.ts:166 (CONTRACT, shortened)

why the measurement comes before the key.

```ts
/**
 * Intrinsic dimensions of bytes in hand, before anything has been stored.
 *
 * The upload path needs the measurement BEFORE it has a key: since finding
 * B002 the key carries `-<w>x<h>`, so the measurement is an INPUT to the key
 * rather than something looked up after the fact. Measuring once and using it for both the key and
 * the row also means those two cannot disagree about the same image.
 */
```

### app/lib/media/core.server.ts:195 (CONTRACT, shortened)

why LQIP, why null is allowed, why the quality is not optional, and why it lives here; the VP8L audit goes to the history document. The rule pointer stays.

```ts
/**
 * A tiny base64 data URI standing in for the image until it loads.
 *
 * LQIP rather than ThumbHash or BlurHash: both of those need client-side
 * decoding, and this site's public plane ships no framework script (rule 4). A
 * data URI is bigger than a hash and renders with no script at all, which is
 * the trade the rule forces. The size it actually costs is MEASURED by
 * `check:image-weight`, which prints the mean over every stored placeholder;
 * the figure that used to sit in this sentence was written before the quality
 * defect below existed and was wrong by roughly a factor of two the whole time.
 *
 * Returns null rather than throwing. A placeholder is an enhancement; an image
 * the transformer cannot read (an SVG, a PDF, a corrupt upload) simply has none,
 * and that must not be able to fail a rebuild or a queue message.
 *
 * **THE QUALITY IS NOT OPTIONAL, and this call omitted it until 2026-09-06.**
 * The binding emits LOSSLESS WebP when no quality is given, so every
 * placeholder ever stored was a VP8L data URI, in the one column whose entire
 * purpose is to be small enough to inline in a document. Measured that day: 26
 * of 26 stored placeholders came back VP8L, across all three storage tiers,
 * which is what proved this was a defect in the derivation rather than in one
 * caller. `WEBP_QUALITY` is a shared constant precisely because there turned
 * out to be two callers of the binding.
 *
 * **IT LIVES HERE, beside `measureDimensions`, because it has two callers of
 * its own.** The bulk rebuild derives it for every object; the queue consumer
 * derives it for the one object an event names. A copy in each would be two
 * placeholder encoders, and the whole reason this file exists is that a
 * measurement with two implementations is two answers.
 */
```

### app/lib/media/core.server.ts:244 (CONTRACT, shortened)

mechanics only, and where the safety belongs.

```ts
/**
 * Deletes one object. MECHANICS ONLY.
 *
 * There is deliberately no reference check in here. This module cannot see
 * citations and must not appear to: a `deleteMedia` that sometimes refused
 * would invite a caller to treat it as the safety, and the safety belongs in
 * the action where the resolver's answer is available and where failing closed
 * can be enforced. This function does what its name says and nothing else.
 */
```

### app/lib/media/core.server.ts:257 (CONTRACT, shortened)

it delegates, and what the shape test refuses; the stale regex goes to history.

```ts
/**
 * True when the key is one this module is willing to touch.
 *
 * DELEGATES TO THE GRAMMAR'S OWNER and carries no pattern of its own. The
 * regex that lived here predated the dimension segment `contentKey` writes
 * into raster keys, so every uploaded raster was refused by delete, set-alt
 * and empty-trash while the guard looked correct. A reader that restates a
 * grammar fails exactly when the writer moves; `isContentKey` sits beside the
 * writer, where a change to one is a change made looking at the other.
 *
 * What the shape test refuses on this module's behalf: anything with a slash
 * (so a traversal segment, a leading `/` static path and an `og/` derived key
 * all fail), and anything that is not a digest-plus-extension a real upload
 * could have produced.
 */
```

## app/enhance/palette.ts

### app/enhance/palette.ts:1 (CONTRACT, shortened)

the law, why a native dialog, the focus rule and where results come from.

```ts
/**
 * Command palette. Site-wide, loaded as its own chunk, and pure enhancement.
 *
 * Nothing on the site depends on this file. The header ships an anchor to
 * /search; this upgrades it into a button that opens a dialog. If the chunk
 * fails to load, fails to parse, or throws on the first line, the anchor is
 * still an anchor and /search still works with no script at all.
 *
 * Built on the NATIVE <dialog> element rather than a hand-rolled overlay,
 * because showModal() already provides the three things a hand-rolled one gets
 * wrong: a real focus trap, Escape to dismiss, and returning focus to whatever
 * opened it. Re-implementing those in application code is how inaccessible
 * modals happen.
 *
 * The listbox follows the ARIA combobox pattern: FOCUS NEVER LEAVES THE INPUT.
 * Arrow keys move `aria-activedescendant`, which is a pointer, not focus. A
 * palette that moves DOM focus to each row breaks typing, which is the one
 * thing the component exists to support.
 *
 * Results come from the Layer 0 JSON endpoint, so the palette and the
 * server-rendered page cannot disagree about what matches.
 */
```

### app/enhance/palette.ts:56 (CONTRACT, shortened)

what the handle is for; the two-answers defect goes to the history document.

```ts
/**
 * The palette's own "All results" escape hatch.
 *
 * It was a static `<a href="/search">`, so it threw away whatever had been
 * typed and landed the reader on an empty search page. Enter-with-no-hit in the
 * same file already did the right thing, going to
 * `/search?q=<typed>`, so the palette contained two answers to one question and
 * only one of them was correct. This handle exists so the link can be kept in
 * step with the input rather than being rebuilt from the text of the anchor.
 */
```

### app/enhance/palette.ts:148 (CONTRACT, shortened)

why Ask is never automatic.

```ts
// Ask is a deliberate second action, never automatic. Results are already on
  // screen when this is pressed, and an answer that generates on every
  // keystroke would bill Workers AI for typing.
```

### app/enhance/palette.ts:161 (CONTRACT, shortened)

why the reset is also synchronous; the observed missing event goes to history.

```ts
// Native Escape fires `cancel`. Let it close, but reset state first so the
  // next open does not flash the previous results.
  // Backstop for any close this code did not initiate. The reset also runs
  // synchronously inside close(), because the `close` event proved unreliable
  // to depend on: it was observed not firing at all for a programmatic
  // dialog.close() on 2026-07-28, so a reset that only lived here would
  // silently never run.
```

### app/enhance/palette.ts:261 (CONTRACT, shortened)

why expanded is set before the early return.

```ts
// Recent searches are presentational buttons, not listbox options, so the
  // combobox is NOT expanded while they are showing. Set before the early
  // return: leaving a stale aria-expanded="true" over an empty listbox tells a
  // screen reader there are options to arrow through when there are none.
```

### app/enhance/palette.ts:308 (CONTRACT, shortened)

why availability comes from the response.

```ts
// Ask's presence is the server's answer, carried on the response the
    // palette already makes. Remove the binding and this goes false, so the
    // affordance disappears without a second switch to remember.
```

### app/enhance/palette.ts:318 (CONTRACT, shortened)

when it is offered and why even on zero results.

```ts
// Offered only once classic results have rendered, and only when the server
    // says Ask exists. Offered even on zero results, because a question the
    // keyword index cannot match is exactly where an answer might help.
```

### app/enhance/palette.ts:334 (CONTRACT, shortened)

why the streaming client is a separate import.

```ts
/**
 * Streams an answer into the palette.
 *
 * The streaming client is a separate dynamic import, so the palette chunk does
 * not carry Ask's weight for readers who only ever search. Loaded on the first
 * press and cached by the browser after that.
 */
```

### app/enhance/palette.ts:395 (CONTRACT, shortened)

why Escape is handled here and must come first; the browser measurement goes to history.

```ts
// Escape is handled here rather than left to the dialog, and it must come
  // before every other branch.
  //
  // `<input type="search">` has a NATIVE Escape behaviour: the first press
  // clears the field and stops there, so the keystroke never reaches the
  // dialog and the palette stays open. A reader pressing Escape once and
  // watching nothing close reasonably concludes the thing is broken. Measured
  // in Chrome 2026-07-28.
```

### app/enhance/palette.ts:453 (CONTRACT, shortened)

why the sequence bump is not optional; the observed race goes to the history document.

```ts
/**
 * Drops every piece of open state.
 *
 * Bumping the sequence is the part that is not optional. Clearing the DOM alone
 * loses a race: a fetch still in flight when the reader closes the palette
 * resolves afterwards and repaints the listbox of a closed dialog, leaving
 * stale options and aria-expanded="true" behind it. Observed 2026-07-28, with
 * the response outliving the close by a few hundred milliseconds.
 */
```

### app/enhance/palette.ts:467 (CONTRACT, shortened)

why the answer is aborted too.

```ts
// Aborts an in-flight answer too. Without this a fetch still streaming when
  // the palette closes goes on writing into a closed dialog, which is the same
  // late-response trap the sequence number exists for on the search side.
```

### app/enhance/palette.ts:486 (CONTRACT, shortened)

one binding, the event rather than an export, and the trigger's own fallback; the helper bytes go to the history document.

```ts
/**
 * THE ONE THING THIS FILE BINDS, and it is not a shortcut.
 *
 * Until 2026-08-27 this module ended by attaching a document keydown listener
 * and upgrading the header trigger, which meant it had to be on every page for
 * the shortcut to exist, which meant every reader downloaded a search dialog in
 * order to be able to press a key. The gestures moved to `theme.ts`, which is
 * already on every page and a fraction of the size: it holds the "/" key, the
 * Cmd-K chord and the trigger click, and it appends a script tag for this
 * bundle the first time one of them fires. So the palette costs its bytes when
 * it is asked for, and nothing before.
 *
 * What is left here is a single listener for the event that loader dispatches.
 * The gesture itself is deliberately NOT re-bound: two copies of the shortcut,
 * one in each module, would both fire and the second would find the dialog
 * already open. One binding makes that impossible rather than guarded against.
 *
 * THE EVENT, NOT AN EXPORT, and the reason is a measurement. The obvious shape
 * is `export { openPalette }` with a dynamic `import()` on the other side, and
 * it was written that way first: vite rewrites every `import()` into a call to
 * its own `__vitePreload` helper, which added roughly 2.3 KB to the 714-byte
 * bundle that is on every page, to manage a preload graph that does not exist
 * here. That is a large fraction of what moving the palette off the page saved.
 * A script element inserted by an already-trusted script is allowed by
 * `strict-dynamic` without a nonce, costs nothing, and needs no change to
 * build-enhance's rule that a bundle carries no imports at all.
 *
 * The trigger's own affordances stay where they always were: the href is left
 * in place, so with script absent, broken or still in flight the element is a
 * working link to /search and middle-click still opens a tab.
 */
```

## app/lib/health/checks.server.ts

### app/lib/health/checks.server.ts:1 (CONTRACT, shortened)

what it watches, the named scope, which are repairable, and the gate boundary; the 2026-07-31 incident goes to the history document.

```ts
/**
 * The health checks, and the I/O that feeds them.
 *
 * MOVED HERE 2026-08-23 from `workers/health.ts`, which kept them while the
 * only caller was the scheduled handler. `/api/health` is now a second caller,
 * and a route cannot reasonably reach into `workers/`. The alternative was a
 * second implementation, which is the shape this repo keeps paying for: two
 * copies of an invariant, one of them wrong, and nobody knows which.
 *
 * ## What this exists for, precisely
 *
 * The Ask index lost nine records on 31 July 2026 and it was noticed on 21
 * August, because a badge on `/admin/posts` said so and somebody happened to
 * open that page. `askIndexStatus` had been computing the number 9 the whole
 * time. Nothing was broken about the detection; there was no PATH from the
 * number to a person.
 *
 * ## THE SCOPE IS DELIBERATELY SMALL
 *
 *   1. `ask-index-drift`    the failure above, by name
 *   2. `media-index-drift`  the media index against R2 and the asset manifest,
 *                           the same reconciliation `sync_media` proves
 *   3. `media-backup-drift` every MEDIA object against its twin in the mirror,
 *                           which is what RECOVERY.md section 3 now rests on.
 *                           REPLACED `media-unbacked` 2026-09-01: that asked
 *                           whether the bucket was still empty, and the
 *                           acceptance it guarded was re-decided when the first
 *                           object arrived (decisions-vol-13.md)
 *   4. `fts-equality`       the docsize equalities the ship asserts after a sync
 *   5. `content-drift`      posts.source_blob_sha against the repository's own
 *                           blob shas, from one Contents directory listing.
 *                           Since the artifact arc D1 is the ONLY rendered
 *                           copy, and this is what watches it converge to git.
 *
 * The FOUR drift checks are the ones the workflow can REPAIR by itself, through
 * the same operator operations ship calls. Everything else here alerts a human.
 * `media-backup-drift` joined them on 2026-09-01 and is the only one whose
 * repair cannot lose anything: it copies, and a copy has no destructive branch.
 * The authoritative list is `REPAIRABLE` in `app/lib/health/repair.mjs`; this
 * sentence describes it and does not restate it.
 *
 * A gate sees disk; these see the LIVE state between commits, which is a
 * different question rather than a second copy of one a gate already answers.
 *
 * ## Every decision lives in `verdicts.mjs`
 *
 * This file reads bindings. What counts as a breach, what a timeout means, and
 * what reaches the wire are next door in a pure module, because `check:tests`
 * runs `node --test` over those and cannot reach anything importing a binding.
 * If it can be wrong, it must be testable.
 *
 * @see app/lib/health/verdicts.mjs
 * @see app/routes/api.health.ts
 * @see .github/workflows/health.yml
 */
```

### app/lib/health/checks.server.ts:77 (CONTRACT, shortened)

what reaches the wire and why.

```ts
/**
   * The two counts a drift check compares, present only when it FAILED.
   *
   * These are the only part of a failing check that reaches the wire besides
   * its name. Grounds are on `publicHealthBody`: a flap that says which check
   * failed and not how far apart the sides were cannot be triaged.
   */
```

### app/lib/health/checks.server.ts:92 (CONTRACT, shortened)

why a throwing check is a failing check.

```ts
/**
 * Runs every check and returns all verdicts, never throwing for a failed check.
 *
 * A check that THROWS is reported as a failed check rather than allowed to
 * abort the run, because the alternative is that one broken check silences
 * every other one. That is the same fail-open-by-accident shape as a listing
 * that errors and returns zero.
 */
```

### app/lib/health/checks.server.ts:107 (CONTRACT, shortened)

why this one is placed here; the addition date goes to history.

```ts
/*
   * ADDED 2026-08-24 with the media sync at ship. Before it, the media index
   * was the one derived store nothing watched between commits: a gate saw it
   * only when somebody ran the gate. It is placed before `media-backup-drift`
   * because the two are easy to confuse and this is the reconciliation of the
   * INDEX; that one is the recovery acceptance, and it compares BYTES.
   */
```

### app/lib/health/checks.server.ts:120 (CONTRACT, shortened)

what question it answers and why both listings are full; the replaced check goes to the history document.

```ts
/*
       * NOT a reconciliation of the INDEX. `check:media --remote` owns that and
       * does it in four directions, and `media-index-drift` above watches it
       * between gate runs. This asks the question neither can: does a second
       * copy of every byte exist?
       *
       * REPLACED `media-unbacked` 2026-09-01 (decisions-vol-13.md). That check
       * asked whether the bucket was still empty, which was the whole of
       * RECOVERY.md section 3's no-backup acceptance. It fired correctly on the
       * first object ever uploaded; the acceptance was re-decided rather than
       * deferred, and the bucket now has a mirror.
       *
       * Both buckets are listed IN FULL, not with `limit: 1`. The old check
       * only needed to know whether any object existed; this one compares two
       * key sets and every etag in them, so a truncated read would report a
       * clean sweep of the part it saw.
       */
```

### app/lib/health/checks.server.ts:143 (CONTRACT, shortened)

what the check makes possible and what its absence surfaces as.

```ts
/*
       * ADDED with the artifact arc, and it is the arrangement's other half:
       * the committed corpus artifact could leave the repository because THIS
       * watches D1 converge to it. A markdown commit from any machine is live
       * within one health poll with NO DEPLOY, by design: the scheduled
       * workflow reads this check, and its repair (`sync_posts`, through the
       * operator door) fetches the drifted files and re-renders them through
       * the one door to a rendered row.
       *
       * One Contents directory listing, which carries every file's git blob
       * sha for free; blob shas are content-addressed, so nothing fetches a
       * file to know whether it changed. Needs the editor's GITHUB_TOKEN,
       * already in env; its absence, a GitHub outage, or the three second
       * timeout all surface as this check failing, which the repair plan then
       * refuses to act on alone (an unreadable repository is not drift).
       */
```

### app/lib/health/checks.server.ts:172 (CONTRACT, shortened)

why the counts are taken on the shadows.

```ts
/*
       * ONE ROUND TRIP, five subqueries. `search_docs` is the real content
       * table and is counted directly; the three index counts are taken on the
       * `_docsize` shadows, because COUNT(*) on an external-content fts5 table
       * reads through to its content table and can never disagree with it.
       * `check:invariants` section 7 enforces that distinction on this source.
       */
```

### app/lib/health/checks.server.ts:196 (CONTRACT, shortened)

what the wrapper adds and what it does not duplicate.

```ts
/**
 * Runs one check under a timeout, turning a throw OR a hang into a failing
 * check rather than into a missing one or a hung response.
 *
 * `withTimeout` already converts a rejection into a failed verdict, so there is
 * no try/catch here: one place decides what a broken check looks like. What
 * this adds is the name, so every path below reports a check that exists.
 */
```

### app/lib/health/checks.server.ts:208 (CONTRACT, shortened)

what the extra wrapper catches.

```ts
// The extra async wrapper turns a SYNCHRONOUS throw inside `run` into a
  // rejection. Without it such a throw escapes before `withTimeout` has a
  // promise to guard, and one broken check would silence every later one.
```

## app/routes.ts

### app/routes.ts:10 (CONTRACT, shortened)

what it is and the ordering rule.

```ts
/*
   * Atom, alongside RSS and from the same rows. RSS stays the advertised feed;
   * this is the dialect most validators and some readers prefer. It sits with
   * the other feeds and, like them, MUST precede `blog/:slug` or "atom.xml"
   * would be read as a post slug and answer 404.
   */
```

### app/routes.ts:17 (CONTRACT, shortened)

why they are grouped and why the feeds come first.

```ts
/*
   * The tag archive and its two feeds.
   *
   * `blog/tags/:tag` is two segments where `blog/:slug` is one, so they cannot
   * collide, but these are grouped with the feeds above rather than after the
   * post routes so that everything under `/blog/` that is NOT a post reads as
   * one block. The two feed children are declared before the page for the same
   * reason the site's other feeds are: it keeps the "more specific first" order
   * true by eye as well as by the matcher.
   */
```

### app/routes.ts:30 (CONTRACT, shortened)

the same grouping and ordering rule.

```ts
/*
   * The series archive and its two feeds, on the tag archive's shape and in the
   * same block for the same reason: everything under `/blog/` that is not a
   * post reads together, and the feed children precede the page so "more
   * specific first" is true by eye as well as by the matcher.
   */
```

### app/routes.ts:41 (CONTRACT, shortened)

the placement is the security design.

```ts
/*
   * Draft previews, TOP LEVEL and never a branch of the post route.
   *
   * The placement is the security design, not a filing preference. The post
   * route exports public cache headers, Workers Cache does not key on cookies,
   * and a reviewer holding a preview link is cookieless, so the downgrade in
   * workers/app.ts never fires for them. Sharing a route would put an
   * unpublished post into a shared cache entry. Full grounds in the route file.
   */
```

### app/routes.ts:51 (CONTRACT, shortened)

why the legacy URL and why the asset prefix differs.

```ts
// Roster, at the LEGACY URL. /phage-discovery is the address the old
  // WordPress page holds and the one that is indexed, so the Worker takes it
  // over at cutover rather than redirecting it. The nine photo assets stay at
  // /phage-hunters/*, which is a static prefix and not a route; the page prefix
  // and the asset prefix differ on purpose. See the route file.
```

### app/routes.ts:57 (CONTRACT, shortened)

why the URL was restored; the dates go to the history document.

```ts
// The publication list. Restored 2026-09-12 under ruling 63, at the URL it
  // held from 2026-07-26 until PR #3 retired it, because that URL was published
  // and a published URL is a promise. The per-paper pages live under it.
```

### app/routes.ts:61 (CONTRACT, shortened)

the trailing slash rule and the ordering.

```ts
/*
   * ONE PAGE PER PAPER, at a DOI-derived slug, WITH A TRAILING SLASH.
   *
   * React Router matches `/publications/x` and `/publications/x/` with the same
   * params (measured, not assumed), and the gateway redirects the slashless
   * form to the slash form so only one is canonical. The slash is what puts the
   * page and its PDF in one subdirectory, which is Google Scholar's stated
   * condition for honouring `citation_pdf_url`.
   *
   * AFTER the index route, which is one segment where this is two, so they
   * cannot collide. The PDFs themselves are static assets under the same
   * prefix and are served by the asset handler ahead of the Worker.
   */
```

### app/routes.ts:74 (CONTRACT, shortened)

why the exports precede the pages and what that keeps true.

```ts
/*
   * THE CITATION EXPORTS, BEFORE THE PAGE ROUTES THEY BELONG TO.
   *
   * `publications.bib` and `publications/<slug>.bib` are one segment and two
   * segments respectively, exactly like the index and the paper page, so each
   * pair could collide on a slug that happened to end in `.bib`. They are
   * declared FIRST for the same reason the blog feeds precede `blog/:slug`:
   * "more specific first" should be true by eye as well as by the matcher.
   *
   * `doiSlug` cannot produce a slug containing a dot (it folds every
   * non-alphanumeric run to a hyphen), so the collision is impossible today.
   * The ordering is what keeps that a fact about the matcher rather than a fact
   * about the slug function, which somebody could change.
   */
```

### app/routes.ts:94 (CONTRACT, shortened)

why it is first; the audit's finding goes to the history document.

```ts
// Who this is, in the first person, from content/about.md. FIRST among the
  // hand-written pages here and FIRST in the header nav, because the audit's
  // fourth part found that the first three questions a stranger has off the
  // home page are who is this, where do they work, and how do I reach them,
  // and nothing on the site answered any of them in visible text.
```

### app/routes.ts:127 (CONTRACT, shortened)

why it is public and why it sits at the root.

```ts
// The webmention receiver. Public and unauthenticated because another site's
  // server sends these with no credential to offer; the four bounds that answer
  // the CSP sink's storage-exhaustion argument are in the route file. AT THE
  // ROOT rather than under /api, because H2 advertises it in a <link> and a
  // Link header and the address is then a published part of this site's
  // surface, which /api is not.
```

### app/routes.ts:141 (CONTRACT, shortened)

why the path makes the narrower claim.

```ts
// Per-path origin requests, read from Analytics Engine. The PATH says
    // origin-requests rather than traffic because a URL is something a reader
    // sees, and the panel spends a caption explaining that these are not reads.
    // A URL making the looser claim would undo that in the address bar.
```

## app/lib/webmention/verify.server.ts

### app/lib/webmention/verify.server.ts:7 (CONTRACT, shortened)

the claim is the sender's, what waitUntil costs, every bound on the fetch, and the no-markup rule.

```ts
/**
 * Does the source page really link to the target?
 *
 * ## THE CLAIM IS THE SENDER'S UNTIL THIS RUNS
 *
 * A webmention POST is an assertion by a stranger that some page of theirs
 * links here. Nothing in the POST is evidence of that: the body is two strings
 * they typed. So the row is written `unverified`, this fetches the page they
 * named, and the row moves to `pending` only if an anchor on it actually
 * resolves to the target. Without that step the endpoint would be a way to
 * publish arbitrary text under an arbitrary URL on someone else's post, which
 * is the whole failure mode webmention verification exists for.
 *
 * ## IT RUNS IN `ctx.waitUntil`, NOT A QUEUE
 *
 * Ruled 2026-09-04. A queue would be new infrastructure for a load of zero, and
 * this repository already has one queue with one consumer. The cost of the
 * choice is stated rather than hidden: a `waitUntil` that is cut short by the
 * runtime leaves the row in `unverified`, where the admin can see it and the
 * global cap still counts it. That is the safe direction. A row stuck in
 * `unverified` renders nothing and expires from nothing, so a systematic
 * failure shows up as a growing open queue rather than as silence.
 *
 * ## EVERY BOUND ON THE OUTBOUND FETCH
 *
 *   protocol       http or https only, and not this origin, not a loopback
 *                  name and not an IP literal. Decided before the row is even
 *                  written, in `sourceVerdict`, which also states what that
 *                  list does and does not buy.
 *   timeout        5 seconds, via `AbortSignal.timeout`. A slow source must not
 *                  hold a `waitUntil` open.
 *   credentials    none. There is nothing to send and nothing to leak.
 *   body           1 MB through `readCapped`, the same counting loop the CSP
 *                  sink uses on incoming bodies, for the same reason: the
 *                  sender's claim about size does not participate.
 *
 * ## NOTHING FROM THE SOURCE IS STORED AS MARKUP
 *
 * The author name, the author URL and the excerpt are read out of a document
 * this site does not control. Every one of them is stored as TEXT: the name and
 * the excerpt come off `textContent`, and the URL is re-parsed and kept only if
 * it is absolute http(s). H2 renders the name and the excerpt as escaped text
 * and the source as a React anchor with a validated href, so there is no path
 * from this function to injected HTML. Ruling 5, restated where the values are
 * produced rather than only where they are rendered.
 */
```

### app/lib/webmention/verify.server.ts:60 (CONTRACT, shortened)

why a fixed set rather than a message.

```ts
/**
 * THE FIXED SET OF FAILURE REASONS. Exported so the admin page and the tests
 * name the same strings.
 *
 * A FIXED SET RATHER THAN A MESSAGE, because the column is shown to the admin
 * and a free-text reason built from an error would put a remote server's prose
 * into this site's own admin plane. These six words are this site's, and every
 * one of them names a different repair: a wrong URL, a slow host, an enormous
 * page, a document that is not HTML, and a page that simply does not link here.
 */
```

### app/lib/webmention/verify.server.ts:81 (CONTRACT, shortened)

the named fallback and where validation happens; both hard rule citations stay.

```ts
/**
 * Best-effort author, from an h-card if the page publishes one.
 *
 * ## BEST EFFORT MEANS THE FALLBACK IS NAMED, NOT INVENTED
 *
 * With no h-card the name is the source's HOSTNAME and the URL is null. That is
 * a fact about where the mention came from rather than a guess about who wrote
 * it, and it is the difference between an honest fallback and hard rule 13's
 * substituted value: a fabricated display name would render on the post as if
 * the sender had claimed it.
 *
 * `u-url` is resolved against the source and then kept only if it is absolute
 * http(s). A relative or `javascript:` value becomes null rather than being
 * stored and refused later at render time, on the same principle hard rule 6
 * applies to frontmatter: validate where the value enters, not where it exits.
 */
```

### app/lib/webmention/verify.server.ts:132 (CONTRACT, shortened)

why the decision is split from the write.

```ts
/**
 * Fetch the source and decide. Pure of the database: the caller records it.
 *
 * Split out so a test can drive the decision over a stubbed fetch without also
 * asserting a row write, which is the same split `runTool` and the route use.
 */
```

### app/lib/webmention/verify.server.ts:142 (CONTRACT, shortened)

why the signal separates the two reasons.

```ts
/*
   * ONE SIGNAL, READ TWICE. `AbortSignal.timeout` fires during the fetch OR
   * during the body read, and the two produce different observable shapes: the
   * first throws out of `fetch`, the second makes `readCapped` return its
   * unreadable sentinel, because that function swallows a stream error by
   * design so a caller never has to distinguish a truncated body from a
   * complete one.
   *
   * So the signal itself is what separates `timeout` from `fetch-error`, at
   * both sites. Reading the sentinel alone would misreport a timed-out read as
   * `no-link`, which is the reason a sender would act on and the wrong one.
   */
```

### app/lib/webmention/verify.server.ts:175 (CONTRACT, shortened)

why the type is checked first and why absent means not-HTML.

```ts
/*
   * THE CONTENT TYPE IS CHECKED BEFORE THE BODY IS READ, so a source that
   * announces a video does not cost a megabyte of transfer to refuse. An
   * ABSENT content-type is treated as not-HTML rather than assumed: a server
   * that will not say what it sent is not a server whose bytes this Worker
   * should hand to a parser.
   */
```

### app/lib/webmention/verify.server.ts:200 (CONTRACT, shortened)

how anchors are compared and which match wins.

```ts
/*
   * EVERY ANCHOR IS RESOLVED AGAINST THE SOURCE before it is compared, because
   * a page linking here almost always does so with an absolute URL and may do
   * so with a relative one; and `sameDocument` compares with and without a
   * trailing slash, because both spell the same post on this site.
   *
   * The FIRST match wins and is also what the excerpt is taken from. A page
   * that links here twice is one mention, and the first link is the one in
   * the prose rather than the one in a footer.
   */
```

### app/lib/webmention/verify.server.ts:227 (CONTRACT, shortened)

what the excerpt is taken from and why it is text.

```ts
/*
   * THE EXCERPT IS THE CONTAINING ELEMENT'S TEXT, not the whole page and not
   * the anchor's own label. The anchor alone is usually the post's title, which
   * tells a reader nothing they cannot see; the page is unbounded. The parent
   * is the paragraph or list item the link sits in, which is the sentence
   * somebody wrote about the post.
   *
   * `textContent`, so the value is plain text at the moment it is produced. A
   * value that were markup here would be markup in the database and the render
   * would be the only thing standing between it and a reader.
   */
```

### app/lib/webmention/verify.server.ts:249 (CONTRACT, shortened)

never throws, and what an unexpected failure becomes.

```ts
/**
 * Verify one received mention and write the verdict.
 *
 * NEVER THROWS. It is handed to `ctx.waitUntil`, and an unhandled rejection
 * there is a log line nobody reads plus a row left in `unverified` with no
 * reason on it. Anything unexpected becomes `fetch-error`, which is honest at
 * the granularity the admin can act on and leaves the detail in Workers Logs.
 */
```

### app/lib/webmention/verify.server.ts:280 (CONTRACT, shortened)

a failed write reverts nothing; the hard rule citation stays.

```ts
/*
     * A FAILED WRITE NEVER REVERTS ANYTHING, per hard rule 18's second clause.
     * The row stays `unverified`, which is a visible state rather than a
     * fabricated verdict, and the failure is reported here.
     */
```

## app/env.d.ts

### app/env.d.ts:1 (CONTRACT, shortened)

why the block exists and what editing it obliges.

```ts
/**
 * Secrets set with `wrangler secret put` are not part of wrangler.jsonc, so they do
 * not appear in the generated Env type. Declare them here. Values never reach the
 * client bundle: they are only read inside .server modules and loaders/actions.
 *
 * **THIS BLOCK IS NOW GATED.** `check:secrets` asserts, in both directions, that
 * every secret the ruling names is declared here and that everything declared
 * here is ratified. Adding a secret means editing this block, the SECRETS list
 * in `scripts/check-secrets.mjs`, and `dustinedwards/core.md`, in one commit.
 */
```

### app/env.d.ts:20 (CONTRACT, shortened)

the optional contract; the omission that motivated the gate goes to the history document.

```ts
/**
     * Bearer token for the operator API. OPTIONAL, and that is the contract
     * rather than an oversight: `POST /api/operator` returns 503 when it is
     * absent or under 32 characters, because not configured means not open.
     *
     * Added 2026-08-09. It was the ONLY one of the seven missing from this
     * block, read by `operator/auth.server.ts` through a local widening, so the
     * shared type never carried it and nothing showed the set in one place.
     * That omission is the defect `check:secrets` was written for, and the gate
     * found it on its first run, before any plant.
     */
```

### app/env.d.ts:32 (CONTRACT, shortened)

optional by contract, and that only the read path needs a credential.

```ts
/**
     * Cloudflare API token for READING Analytics Engine over the SQL API, scoped
     * to Account, Account Analytics, Read. The cockpit's origin-requests panel is
     * its only reader.
     *
     * OPTIONAL BY CONTRACT, on the OPERATOR_TOKEN precedent above rather than as
     * an oversight. It is deliberately not provisioned yet, and a local dev
     * machine will never have it, so the panel must treat absence as an ordinary
     * state: the loader returns its error state and the rest of the cockpit
     * renders untouched. Not configured means not readable, never a thrown
     * loader.
     *
     * The WRITE path needs nothing here. `env.ANALYTICS.writeDataPoint` is a
     * binding and carries its own authorization; only the read path is HTTPS to
     * api.cloudflare.com and only the read path needs a credential.
     */
```

### app/env.d.ts:49 (CONTRACT, shortened)

optional by contract and where the full contract lives.

```ts
/**
     * Bearer token for the READ-ONLY smoke credential that lets `check:browser`
     * drive the real admin plane without the single admin's session cookie.
     *
     * OPTIONAL BY CONTRACT, the third on the `OPERATOR_TOKEN` precedent. Absent
     * or under 32 characters means NOT CONFIGURED, and the middleware refuses a
     * presented token with 503 rather than serving. A deployment without it is
     * an ordinary deployment: the admin plane still answers Dustin's session and
     * nothing else changes.
     *
     * Read in exactly one place, `app/lib/smoke.server.ts`. The full contract,
     * the least-privilege argument and the stated residue are there and on the
     * `smoke` row of `WRITE_CAPABILITIES`.
     */
```

### app/env.d.ts:64 (CONTRACT, shortened)

the two holders, and why the type is required while the contract is optional; the policy change date goes to the history document.

```ts
/**
     * API key for OpenAlex, which is where the per-paper citation counts on
     * `/publications` come from.
     *
     * OPTIONAL BY CONTRACT, the fourth on the `OPERATOR_TOKEN` precedent, and
     * the degradation is the gentlest of the four: `citations.server.ts` serves
     * whatever APP_KV already holds and simply does not schedule a refresh, so
     * an unset key means counts stop ageing forward rather than disappearing.
     * Nothing 503s and nothing renders a zero.
     *
     * It became REQUIRED-to-fetch on 2026-02-13, when OpenAlex made keys
     * mandatory and removed the `mailto` polite pool in the same release. Before
     * that date a keyless request worked, which is why the July code treated the
     * key as a nicety; a keyless request now spends a shared allowance of about
     * 100 credits and is refused after it.
     *
     * Set with `wrangler secret put OPENALEX_API_KEY`. The BUILD side reads the
     * same credential from the gitignored `.dev.vars`, through
     * `scripts/lib/dev-vars.mjs`, because `pubs-pipeline` and the build-time
     * cited-by fetch run on a machine rather than in the Worker. Two holders,
     * one credential: rotate both or neither.
     *
     * ## WHY THIS ONE IS NOT MARKED OPTIONAL, WHEN ITS CONTRACT IS
     *
     * Because `.dev.vars` is also where the build reads it, `wrangler types`
     * SEES IT and generates `OPENALEX_API_KEY: string` into
     * `__BaseEnv_Env`, required. Declaring it `?: string` here widens the
     * merged `Env` and it stops being assignable to `Cloudflare.Env`, which
     * broke `workers/ask-budget.ts` on the first attempt. The three other
     * optional secrets above are never in `.dev.vars`, so none of them collides.
     *
     * The declaration is therefore the one the generator forces, and the
     * OPTIONALITY IS ENFORCED IN CODE INSTEAD: `citations.server.ts` reads the
     * value and checks it for truthiness before spending a request, because an
     * unset secret is `undefined` at runtime whatever the type says. The type is
     * not the contract here; that comment is.
     *
     * On a clean CI checkout there is no `.dev.vars`, wrangler generates
     * nothing, and this line is the only declaration. Same shape either way,
     * which is what stops the two environments disagreeing about whether the
     * Worker compiles.
     */
```

### app/env.d.ts:111 (CONTRACT, shortened)

why vars are not declared here.

```ts
/*
 * WHY THERE IS NO VARS BLOCK HERE, and why adding one would be a defect.
 *
 * `CLOUDFLARE_ACCOUNT_ID` is a plain var in wrangler.jsonc, not a secret, so
 * `wrangler types` already generates it into `__BaseEnv_Env` in
 * worker-configuration.d.ts, AS A STRING LITERAL carrying the id itself.
 * Declaring it again in this file would put the value in a second place and
 * hand a future edit two copies to keep in step, which is the drift the
 * config gate exists to prevent.
 *
 * Measured 2026-08-14 rather than assumed: the generated interface was read
 * back after `wrangler types` and it carries the binding.
 *
 * The rule this file enforces is about SECRETS, which wrangler cannot see
 * because they are set with `wrangler secret put` and are absent from the
 * config. Vars are the opposite case: wrangler owns them, so this file stays
 * out of the way.
 */
```

### app/env.d.ts:148 (CONTRACT, shortened)

what it namespaces and why it is inside declare global.

```ts
/**
 * A value that differs for every build, injected by `define` in vite.config.ts.
 *
 * It namespaces the Worker's own HTML cache and has no other reader. The
 * grounds, and the measurement that made it necessary, are on `BUILD_ID` in
 * that file.
 *
 * Inside `declare global` because this file carries `export {}` and is
 * therefore a module: a bare `declare const` here would be scoped to the
 * module and invisible to workers/app.ts, which is exactly what happened on
 * the first attempt.
 */
```

## app/lib/admin/traffic.server.ts

### app/lib/admin/traffic.server.ts:1 (CONTRACT, shortened)

server only, what the number is and is not, the weighting rule, and fails closed.

```ts
/**
 * The origin-requests source: Analytics Engine, read over the SQL API.
 *
 * SERVER ONLY. `.server.ts` so a leak into the client bundle is a build break
 * rather than a review catch. Nothing Analytics-related reaches the browser
 * except the rendered rows: not the token, not the account id, not the query.
 *
 * WHY THE PANEL SAYS ORIGIN REQUESTS. The dataset is written from the Worker's
 * response path in `workers/app.ts`, and `cache.enabled` means an edge HIT can
 * serve a reader without the Worker running. Every number here is therefore a
 * count of times the origin was reached, which is a floor under readership and
 * not a measure of it. The panel is labelled accordingly, everywhere.
 *
 * EVERY AGGREGATE IS SAMPLING WEIGHTED. Analytics Engine samples, and the
 * documented way to count events is `SUM(_sample_interval)`. A raw `COUNT()`
 * reads correctly at low volume and then silently undercounts the moment
 * sampling engages, which is the worst failure shape available: a number that
 * stays plausible while becoming wrong. The unweighted row count is carried
 * alongside only as the diagnostic for whether sampling is active.
 *
 * IT FAILS CLOSED, AND THAT IS THE ORDINARY CASE. `ANALYTICS_READ_TOKEN` is
 * optional by contract, exactly as `OPERATOR_TOKEN` is, and a development
 * machine will never carry it. Absence therefore returns the error result
 * rather than throwing: a thrown loader would take out the admin route segment
 * and replace the cockpit with an error boundary, which is a far worse outcome
 * than one panel saying it cannot read.
 */
```

### app/lib/admin/traffic.server.ts:35 (CONTRACT, shortened)

why it is exported and the quoted-interval law.

```ts
/**
 * Builds the panel query.
 *
 * Exported so the gate can assert its SHAPE without a network call or a token.
 *
 * `INTERVAL '7' DAY` in the QUOTED form. The unquoted `INTERVAL 7 DAY` is
 * rejected by this API and that is recorded law, not a preference. Verified
 * against the current Analytics Engine SQL API documentation before first use.
 *
 * @param windowDays how far back to look
 * @param limit how many paths to return
 */
```

### app/lib/admin/traffic.server.ts:60 (CONTRACT, shortened)

why a second statement.

```ts
/**
 * Total across every path in the window, so the top N can state what it omits.
 *
 * A separate statement because the SQL API takes one per request. Two cheap
 * aggregates beat presenting a truncated list as if it were the whole picture.
 *
 * @param windowDays how far back to look
 */
```

### app/lib/admin/traffic.server.ts:153 (CONTRACT, shortened)

one derivation, one read for the list, what completeness means, and why a cache but no budget; the samples go to the history document.

```ts
/**
 * THE PER-POST READ, and it adds no query. Roadmap item G, first half.
 *
 * The post list wants origin requests for each post's public route. That is the
 * SAME data the origin-requests panel already reads, windowed the same way, so
 * this composes `trafficQuery` and `trafficTotalQuery` above rather than adding
 * a third statement. A second builder would be a second definition of what a
 * window is and what an origin request counts as, and those two would agree
 * until the day one of them was edited.
 *
 * ## ONE READ FOR THE WHOLE LIST, never one per row
 *
 * Twelve posts must not be twelve HTTP calls to a third party inside a loader
 * that already makes three network reads. The two statements here are the same
 * two the panel makes, issued in parallel, and the route indexes the result by
 * path. Adding a post costs nothing.
 *
 * ## THE LIMIT IS A CUT AND THE CALLER IS TOLD WHEN IT BITES
 *
 * `trafficQuery` orders by origin requests descending and applies a LIMIT, so a
 * path below the limit is absent from the result for a reason that has nothing
 * to do with its count. `pathsReturned` from the total query is the independent
 * measure of how many paths actually had activity, and comparing the two is the
 * only way to know whether the absence of a path means zero. `complete` carries
 * that answer so the column never has to guess, and the guess it would
 * otherwise make is the one ruling 2 forbids: showing a zero for a post whose
 * number simply was not asked for.
 *
 * ## WHY A CACHE, AND WHY THIS TTL
 *
 * Measured against production 2026-09-04, five samples: `ae_fetch_traffic` ran
 * 165 to 244ms. The post list's own loader ran a median of about 145ms over ten
 * samples, so an uncached read here would have been the slowest thing in it.
 * `askDriftCount` solved the identical problem for the nav badge and the same
 * shape is used here.
 *
 * The TTL is not a guess about freshness, it is BELOW a lag this data already
 * has: `CACHE_SENTENCE` records 72 seconds of Analytics Engine ingestion lag,
 * measured. A number this panel could not have shown yet anyway is not made
 * staler by holding it for a minute, so the cache costs no accuracy that
 * existed to lose.
 *
 * NO BUDGET RACE, deliberately, and the difference from `askDriftCount` is that
 * its 1000ms budget came from twelve measurements of a call that had been seen
 * at 2332ms. There is no such measurement here. A budget picked without one
 * would be an invented threshold in a file whose whole subject is not inventing
 * numbers, so the cache is the mitigation and the tail is recorded rather than
 * guarded against.
 */
```

### app/lib/admin/traffic.server.ts:212 (CONTRACT, shortened)

why a stored shape is checked.

```ts
// Shape-checked rather than trusted. A stored object from an older shape
    // must read as a miss, not as a report with undefined fields, because
    // `byPath` being undefined would make every post render as a measured zero.
```

### app/lib/admin/traffic.server.ts:264 (CONTRACT, shortened)

why both halves are needed.

```ts
/*
       * Both halves, and the second is the one that catches a silent cut. The
       * row count proves the limit was not reached; the total proves no path
       * with activity is missing. Either alone can be satisfied while the
       * result is short: a query that returned fewer rows than the limit
       * because the API truncated would pass the first, and a stale total would
       * pass the second.
       */
```

## app/lib/media/rebuild.server.ts

### app/lib/media/rebuild.server.ts:7 (CONTRACT, shortened)

which columns are recoverable, the one-direction conflict rule, and why enumeration precedes writing.

```ts
/**
 * Re-derives the media index from the things that are actually true.
 *
 * **The rule this whole module exists to obey:** hash, mime, bytes, dimensions
 * and the placeholder are RECOMPUTABLE from the object. `alt`, `caption`,
 * `focal_x` and `focal_y` are AUTHORED and recoverable from NOTHING. They are
 * the only media data in this system that can be permanently lost, so a rebuild
 * re-derives the first set and preserves the second. That is why this walks
 * through `upsertDerivedMedia`, whose conflict clause names the derived columns
 * explicitly, and never through a delete-then-insert.
 *
 * **The conflict rule, one direction only: R2 WINS.** A row whose object has
 * disappeared is deleted. An object with no row is indexed. An object is never
 * deleted because a row said so, and this module has no code path that could:
 * it does not import `deleteMediaObject` and takes no bucket-write of any kind.
 *
 * Both sources are enumerated exhaustively before anything is written, because a
 * partial listing would make every absent key look like a deletion. That is the
 * failure this repo has already shipped once, when `items.list()` returned one
 * page and a prune reported "removed 0" for items that were real.
 */
```

### app/lib/media/rebuild.server.ts:54 (CONTRACT, shortened)

one enumeration for both readers, exhaustive, the two buckets, and why static comes from a manifest; the hard rule citation stays.

```ts
/**
 * EVERY ASSET THAT ACTUALLY EXISTS: both buckets, plus the static manifest.
 *
 * Extracted from `rebuildMediaIndex` on 2026-08-24 so that the rebuild and the
 * reconciliation below CANNOT disagree about what the sources are. Before this
 * there was one enumeration, inside the rebuild, and any verdict about whether
 * the rebuild worked had to re-derive the same set by different code. Two
 * enumerations of the same thing is two answers to "what exists", and the one
 * used to grade the other would have been the one nobody checked.
 *
 * Rule 18: the bucket and the repository are the SOURCES; the index is the
 * projection. This function is that sentence in code, and it is why the verdict
 * cannot be supplied by a caller.
 *
 * EXHAUSTIVE, to the end of the cursor. A partial listing makes every absent key
 * look like a deletion, which this repo has already shipped once when
 * `items.list()` returned one page and a prune reported "removed 0" for items
 * that were real. The throw on a truncated page with no cursor is what stops a
 * half-read listing being mistaken for the whole bucket.
 *
 * Two buckets, split on LIFECYCLE: MEDIA is irreplaceable, OG holds cards a
 * command can regenerate. Both are indexed, because the index describes every
 * asset the site has and an OG card that existed but appeared nowhere would be
 * exactly the invisible-object problem the index exists to end.
 *
 * The static half comes from the committed manifest because a Worker CANNOT
 * list its own static assets: the assets binding has exactly one method,
 * `fetch()`, so it can serve any path it is given and discover none of them.
 * `build:assets` walks public/ and commits the list; `check:media` compares that
 * list against the filesystem so a stale one is named as stale.
 */
```

### app/lib/media/rebuild.server.ts:121 (CONTRACT, shortened)

why the verdict is read back and why drift is a sum.

```ts
/**
 * WHAT THE INDEX WOULD HAVE TO HOLD, AGAINST WHAT IT HOLDS.
 *
 * The read-back verdict for a media sync, on exactly the footing
 * `askIndexStatus` has for the answer index: `expected` comes from the SOURCES
 * and `present` from the index, both read AFTER any write, so a caller cannot
 * be told a sync succeeded by an operation that merely ran.
 *
 * `rebuildMediaIndex` returns `indexed` and `removed`, which are what its loop
 * THINKS it wrote. Those are useful for a human and are not evidence: a loop
 * that ran cleanly over a set it enumerated wrongly reports a healthy `indexed`
 * and leaves the index short, and only this comparison can tell.
 *
 * BOTH DIRECTIONS, and `missing` and `extra` are not symmetric in what they
 * mean. A missing key is an asset the site has and the index cannot describe.
 * An extra key is a row for something that no longer exists, which is how a
 * deleted object keeps appearing in the library. Both are drift; neither is
 * allowed to average out against the other, which is why `drift` is computed
 * from their SUM and not from the difference of the two totals.
 */
```

### app/lib/media/rebuild.server.ts:177 (CONTRACT, shortened)

why the read follows the key.

```ts
// An OG card lives in the OG bucket now, so the read has to follow the
      // key rather than assume MEDIA. This was the third inline copy of that
      // expression; it is one shared function since 2026-08-04.
```

### app/lib/media/rebuild.server.ts:191 (CONTRACT, shortened)

why the name is re-derived.

```ts
// The filename, re-derived from the OBJECT rather than preserved by luck.
      // This is what makes `original_name` recomputable and therefore honestly
      // a derived column: before the name rode in custom metadata, a rebuild
      // could only keep whatever D1 already had, and a row that never got one
      // could never acquire it.
```

### app/lib/media/rebuild.server.ts:221 (CONTRACT, shortened)

what is matched; the verification date goes to history.

```ts
// The hostname is ignored; only the pathname is matched. Verified
      // 2026-08-02, which is what makes the static tier first-class rather than
      // a second-class listing with no transforms.
```

### app/lib/media/rebuild.server.ts:249 (CONTRACT, shortened)

why null is the honest value.

```ts
// A static asset has no upload event. Its mtime is a property of the
        // build machine, not of the asset, so recording one would be inventing
        // a fact. Null is the honest value.
```

### app/lib/media/rebuild.server.ts:260 (CONTRACT, shortened)

why removal is last and computed from the same enumeration.

```ts
// ---- 5. Remove rows whose source is gone. R2 and public/ win. -----------
  // Deliberately last, and deliberately computed from the SAME enumerations that
  // were just written from. Anything that failed above is still in `live` only
  // if it was indexed, so a transient read failure cannot cause a deletion.
```

## app/lib/theme.ts

### app/lib/theme.ts:1 (CONTRACT, shortened)

the cookie rule and the absent-attribute rule; the flash mechanics go to history.

```ts
/**
 * Theme choice, and the one place that knows how it is stored.
 *
 * The choice is a COOKIE, not localStorage, and that is the whole anti-flash
 * design. localStorage is unreadable on the server, so a site that stores the
 * theme there has to paint once and correct itself, which is the flash. A
 * cookie arrives with the request, so the server writes the right `data-theme`
 * into the very first byte of HTML and nothing is ever corrected.
 *
 * "system" is stored as a value but rendered as the ABSENCE of the attribute,
 * so the CSS falls through to `prefers-color-scheme`. A reader with no script
 * and no cookie is on that same path already, which is why the zero-JS story
 * costs nothing: it is not a fallback, it is the default branch.
 */
```

### app/lib/theme.ts:21 (CONTRACT, shortened)

the three states and the not-writable rule; the dated addendum and its grep go to history.

```ts
/**
 * The RESOLVED states. Three, and that is not the number of buttons.
 *
 * "system" is what a reader who has chosen nothing is in. It is still a real
 * state, still what `colorSchemeMeta` answers `light dark` for, and still one
 * of the three values the Worker's cache key can carry. What it stopped being
 * on 2026-08-29 is WRITABLE: no control posts it, and `/theme` refuses it.
 *
 * THIS MODULE IS THE ONE PLACE THAT KNOWS "system" WAS EVER POSTED. The
 * addendum of 2026-08-29 asked for exactly that, and the grep in the commit
 * body is the proof. Everywhere else the site has two themes and a default.
 */
```

### app/lib/theme.ts:57 (CONTRACT, shortened)

the legacy-cookie rule and the convergence guarantee; the checking narrative goes to history.

```ts
/**
 * Reads the stored choice off a request. Anything unrecognised, including a
 * hand-edited cookie, reads as "system" rather than throwing: a bad cookie
 * should cost a reader the default theme, never the page.
 *
 * ## A LEGACY `theme=system` COOKIE IS HONOURED, AND IT IS THE NO-COOKIE PATH
 *
 * The three-button control could write `system`, so cookies carrying it exist
 * in readers' browsers and will for a year, which is the cookie's max-age. It
 * still means what it always meant: follow the machine. That is identical to
 * having no cookie at all, so this returns the same value for both and the two
 * readers converge on one cache entry and one document.
 *
 * **NORMALIZING CHANGES NOTHING A READER RECEIVES, and that was checked rather
 * than assumed before collapsing them.** `themeAttribute("system")` returns
 * `undefined`, so the attribute is ABSENT for a legacy-system reader exactly as
 * it is for a first-time one; there is no `[data-theme="system"]` selector in
 * any stylesheet, and the system case is written `:root:not([data-theme])`
 * wherever it appears. So the two documents were already byte-identical and
 * already shared a key. What this comment adds is the guarantee, in the one
 * place that can give it, rather than a coincidence three files had to keep.
 */
```

### app/lib/theme.ts:85 (WHY, shortened)

the throw and where it lands; the finding test and its date go to history.

```ts
/*
     * ## `decodeURIComponent` THROWS ON MALFORMED INPUT, and this used to be
     * unguarded. FOUND BY test/worker/routes.test.ts ON 2026-08-29.
     *
     * `theme=%%%bogus` raises `URIError: URI malformed`. Nothing this site
     * writes can produce that, because `serializeThemeCookie` only ever emits
     * `light` or `dark`, but a cookie is client state: it can be hand-edited,
     * truncated by a proxy, or corrupted in storage.
     *
     * What made it worth fixing rather than noting is WHERE it lands.
     * `workers/app.ts` calls this on EVERY request, before the render, to build
     * the cache key. An exception there is not a wrong theme, it is a 500 on
     * every page for that reader, on every visit, until they find and clear a
     * cookie nothing tells them about.
     *
     * The docblock above has always promised the opposite: a bad cookie costs a
     * reader the default theme, never the page. It is true now.
     */
```

### app/lib/theme.ts:109 (CONTRACT, shortened)

the keying rule, one sentence shorter.

```ts
/*
     * WRITABLE values are honoured as choices; everything else, `system` and
     * junk alike, falls to the default. Keyed on the WRITABLE set rather than
     * on `isTheme` so that "what may be stored" and "what may be posted" are
     * the same question with one answer.
     */
```

### app/lib/theme.ts:128 (CONTRACT, shortened)

what the meta is for and why 'light dark'; the frame capture goes to history.

```ts
/**
 * The `<meta name="color-scheme">` content for a resolved choice.
 *
 * ## WHAT IT IS FOR, measured 2026-08-27
 *
 * `data-theme` tells the STYLESHEET which palette to use. It tells the BROWSER
 * nothing, because the browser cannot know what that attribute means until it
 * has parsed the CSS that gives it meaning. Until then the canvas it paints
 * between and beneath documents is the default one, and the default is light.
 *
 * That is a white frame, and it was measured rather than reasoned about: real
 * Chrome 151, screen capture at about 45 frames a second, a header click from
 * `/` to `/blog` with `theme=dark` and `prefers-color-scheme: light`. The
 * viewport read 253 of 255 for one composited frame between two pages that
 * read 61. With this meta injected into the same bytes and nothing else
 * changed, the same navigation never left the dark range.
 *
 * THE READER THIS AFFECTS is the one whose CHOICE disagrees with their MACHINE:
 * dark site on a light-mode computer. With the two in agreement the browser
 * guesses right by accident and there is no flash at all, which is why holding
 * them equal hid this completely.
 *
 * ## "light dark" IS NOT A DEFAULT, IT IS THE HONEST ANSWER FOR "system"
 *
 * A reader on "system" has not chosen, so the document supports both and the
 * browser should use the machine's preference. Writing a single value there
 * would be asserting a choice nobody made, and would put the flash back for
 * whichever half of those readers guessed wrong.
 */
```

## app/lib/media/upload.server.ts

### app/lib/media/upload.server.ts:6 (CONTRACT, shortened)

the one-door law, the two callers and what it does not own; the ruling and finding go to history.

```ts
/**
 * THE ONE DOOR TO THE MEDIA BUCKET, for bytes a person or an agent supplied.
 *
 * Everything an upload does after the bytes are in hand happens here and
 * nowhere else: refuse, measure, address, put, annotate. Two callers, both thin
 * adapters over this, on the same law the publish tools live under:
 *
 *   `admin.media.upload.ts`  a multipart form from the editors and the library
 *   `upload_media`           base64 or a URL, over the operator token
 *
 * ## WHY IT IS A MODULE AND NOT A SECOND COPY OF THE ROUTE
 *
 * The route's action WAS the upload, which was fine while it was the only
 * writer to MEDIA. Ruling 32d added a second one, and the sequence below is not
 * the kind a second copy stays equal to: the dimensions are measured before the
 * key exists because the key CARRIES them (finding B002), the filename is
 * written to the object's custom metadata as well as to D1, and the D1 write is
 * deliberately non-fatal. A copy that got any of those three wrong would look
 * correct and would produce objects the rebuild cannot fully re-derive.
 *
 * `savePost` is the precedent. The editor action is an adapter over it, the
 * operator's `save_post` is another, and there is one write path underneath.
 *
 * ## WHAT IT STILL DOES NOT OWN
 *
 * The `no-file` refusal, because each caller's missing input is a different
 * thing with a different repair, and the branch between a redirect and a JSON
 * body, because that is a property of who is asking. Both stay in the adapters.
 */
```

### app/lib/media/upload.server.ts:36 (CONTRACT, shortened)

the asserted-type rule; the three sources go to history.

```ts
/**
 * The bytes and what the caller knows about them.
 *
 * `type` is the MIME the caller asserts. It is CHECKED against `ALLOWED` and
 * never sniffed: the form path takes it from the `File`, the operator path
 * takes it from a `data:` prefix, an explicit argument or the fetched
 * response's own `Content-Type`. All three are claims, and the allowlist is
 * what makes a wrong claim harmless rather than the claim being trusted.
 */
```

### app/lib/media/upload.server.ts:76 (WHY, shortened)

the unreachable fallback written as a throw, and the rule that forbids the default.

```ts
/*
   * Present by construction: `validateUpload` refused every type outside
   * ALLOWED one statement ago, and the two read the SAME map. The fallback is
   * unreachable and is written as a throw rather than a default extension,
   * because hard rule 13 says a fallback that substitutes a different value is
   * not failing closed, and `"bin"` here would put an unclassifiable object in
   * the bucket that `classify()` then throws on for every later reader.
   */
```

### app/lib/media/upload.server.ts:92 (CONTRACT, shortened)

the key carries the measurement, and null is a real answer; finding B002 goes to history.

```ts
/**
   * MEASURED BEFORE THE KEY EXISTS, because the key carries the measurement.
   *
   * Finding B002: image dimensions are baked into the gated HTML, and the two
   * writers measured them from two different stores, one of which a clone
   * cannot reach. The key carries `-<w>x<h>` so both resolvers parse rather
   * than fetch. That makes this measurement an input to the key, which is why
   * it happens here rather than by reading the object back after the put.
   *
   * Null is a real answer and not a failure: an SVG has no intrinsic pixel
   * size, so it gets a key with no dimension segment, exactly as the `media`
   * table records a NULL width for the same reason.
   */
```

### app/lib/media/upload.server.ts:112 (CONTRACT, shortened)

idempotent by construction and no existence check.

```ts
// Unconditional, and idempotent BY CONSTRUCTION: the key is a function of the
  // bytes, so re-uploading the same image overwrites an object with a
  // byte-identical one. There is deliberately no "does it exist" check first,
  // which would cost a round trip to save a write that changes nothing.
```

### app/lib/media/upload.server.ts:121 (CONTRACT, shortened)

the filename belongs to the object; the audit that found it goes to history.

```ts
// THE FILENAME LIVES ON THE OBJECT, not only in the row.
    //
    // A content-addressed key is a digest, so the name the author chose is not
    // recoverable from it and a rebuild cannot re-derive what only D1 held. The
    // D1 write below is deliberately non-fatal, and the queue consumer inserts
    // its own row from the event without one, so the name had exactly one
    // source and that source was allowed to fail silently.
    //
    // Custom metadata makes it a property of the OBJECT, which is the same rule
    // the whole module runs on: R2 is the truth, D1 is derived, and anything
    // derived must be re-derivable. Found by audit 2026-08-02.
```

### app/lib/media/upload.server.ts:135 (CONTRACT, shortened)

non-fatal and reported; the backfill's history goes to the document.

```ts
/**
   * The annotation row, created HERE rather than left to the backfill.
   *
   * The backfill exists for objects that predate the table; making it also the
   * only path that measures dimensions would mean every fresh upload showed no
   * dimensions in the library until someone remembered to run it, which is a
   * chore the system can do for itself. Alt starts empty, because nobody has
   * written one yet, and the library is where it gets filled in.
   *
   * Non-fatal, deliberately: the object is already in R2 and the upload has
   * succeeded, so a D1 hiccup must not report failure for a write that
   * happened. The library lists objects from the BUCKET and treats a missing
   * row as empty metadata, so the worst case is an un-annotated object and a
   * backfill button offering to fix it.
   *
   * REPORTED rather than only logged, since this became a door two callers
   * share. A console line is readable by whoever is tailing the Worker; an
   * operator calling this over HTTP is not, and `recorded: false` is what lets
   * it say "the object landed, the row did not, run sync_media" instead of
   * reporting an unqualified success it cannot see behind.
   */
```

### app/lib/media/upload.server.ts:158 (CONTRACT, shortened)

one measurement so the row and the key cannot disagree.

```ts
// `dimensions` is the measurement the key was built from, reused rather
    // than re-read: one measurement means the row and the key cannot disagree,
    // and it drops a round trip back to R2 for bytes we just had in hand.
```

## app/routes/sitemap.ts

### app/routes/sitemap.ts:10 (CONTRACT, shortened)

the derived-by-gate ruling; the rejected derivation and the found-by story go to history.

```ts
/**
 * Static, always-present URLs: the hand-built pages that read typed data files
 * rather than `kind = 'page'` rows, so the D1 filter below cannot find them.
 *
 * ## DERIVED-BY-GATE, which is the ruling the old comment asked for
 *
 * This stayed a literal, and `check:invariants` section 14 now holds it against
 * `routes.ts`: every public page route must be listed here or exempted BY NAME
 * with a reason. So the list is still typed out, and it can no longer be
 * FORGOTTEN, which was the actual defect.
 *
 * Deriving the array at runtime was the other option and was rejected. The
 * route table is a build-time module of nested config objects, so reading it
 * here means either parsing TypeScript inside a Worker or shipping a second
 * generated artifact for four strings. The gate gets the same guarantee at no
 * runtime cost, and it can say WHY a route is absent, which a derivation cannot.
 *
 * FOUND BY THAT GATE, and it is why this comment changed: `/projects` and
 * `/playground` had been missing since they shipped. Both are public,
 * indexable, linked from the header nav, and absent from the sitemap. The old
 * comment predicted exactly this and left it, which is the shape the gate now
 * closes rather than notes.
 */
```

### app/routes/sitemap.ts:49 (CONTRACT, shortened)

why the second read is gone and what keeps it gone; the live count goes to history.

```ts
/*
   * ONE READ, since 2026-08-28. It was two.
   *
   * The second was `listPublicPosts`, filtered below to `kind = 'page'` rows.
   * NO SUCH ROW CAN EXIST: both writers into `posts` hardcode the literal
   * `'post'` for that column, the Worker's in `publish.server.ts` and the
   * build's in `sync-content.mjs`, and rule 18 makes `renderAndWrite` the one
   * door to a rendered row. Measured against the live database on 2026-08-28:
   * twelve rows, all `post`, no `page`.
   *
   * So the filter was a branch nothing could reach, paid for with a D1 read on
   * every crawl. `check:invariants` section 14 asserts the writers still write
   * only 'post', because deleting a dead branch is only safe while the thing
   * that made it dead is still true.
   *
   * The root-level pages are STATIC_PATHS above, which the same section holds
   * against the route table.
   */
```

### app/routes/sitemap.ts:67 (CONTRACT, shortened)

the inherited predicate and the no-lastmod rule.

```ts
/*
   * TAGS RIDE ALONG, since the archives landed.
   *
   * `listBlogTags` is the SAME read the chip list makes and it composes
   * `isBlogPost()`, so a tag carried only by drafts or by future-dated posts is
   * absent from this list for exactly the reason its archive answers 404. That
   * is the visibility rule the spec asks for, and it is inherited rather than
   * restated: a second predicate here would be a second answer to which tags
   * are public, and the one that disagreed would be the one nobody tested.
   *
   * NO `lastmod`. A tag has no modification date of its own, and deriving one
   * from its newest post would be a claim this read cannot support: the tag
   * list carries counts, not dates, and fetching dates for it would be a second
   * query to state something a crawler treats as a hint anyway.
   */
```

### app/routes/sitemap.ts:90 (CONTRACT, shortened)

three rules: the committed corpus, no lastmod, and no showcase filter.

```ts
/*
     * ONE ENTRY PER PAPER, from the committed corpus rather than a query.
     *
     * These are the only sitemap entries on the site that come from a build
     * artifact instead of from D1, and that is what they are: `publications.ts`
     * is generated, gated and committed, so this list is as reproducible as the
     * static paths above and needs no read.
     *
     * NO `lastmod`, deliberately. The obvious candidate is the file's commit
     * date, which would mark all 36 as changing together every time the
     * registry refresh touches one field, and a lastmod that moves for reasons
     * unrelated to the content is worse than none: it teaches a crawler to stop
     * believing the field.
     *
     * The SHOWCASE filter is NOT applied here, and the reason is worth stating:
     * the index hides three conference abstracts because showing both a meeting
     * abstract and the paper it became repeats the same work to a reader. A
     * crawler has no such problem, each is a real page with its own DOI, and a
     * page that exists and is absent from the sitemap is the gap
     * `check:invariants` section 14 exists to refuse.
     */
```

### app/routes/sitemap.ts:154 (CONTRACT, shortened)

the shared constant and the no-Vary rule; the stale-post measurement goes to history.

```ts
/*
       * THE SAME CONSTANT THE FEEDS USE, since 2026-09-02. It was
       * `public, max-age=3600`, written here rather than imported, and that
       * hour was the longest any public surface held a post after it was gone.
       *
       * Measured on the image-path test post: deleted, and the sitemap still
       * listed it while `/blog/<slug>` answered 404 and both feeds had already
       * dropped it. `max-age` with no `Vary` is not bustable by a cookie
       * either, so even a signed-in reload served the stale copy.
       *
       * The shared constant is `s-maxage`, which is the SHARED cache only, plus
       * `stale-while-revalidate`. So the browser revalidates, the edge holds it
       * for ten minutes rather than sixty, and a delete converges on the same
       * schedule as `blog.rss[.xml].ts` and `blog.feed[.json].ts`, which list
       * exactly the same posts from exactly the same projection.
       *
       * NO `Vary`, and that is correct rather than an omission: this document
       * embeds no reader state. `HTML_VARY` exists for routes that put the
       * theme in `<html data-theme>`, and pairing it with this constant is what
       * rule 8 requires THERE. An XML listing of public URLs has no such half.
       */
```

## app/lib/smoke.server.ts

### app/lib/smoke.server.ts:1 (CONTRACT, shortened)

the three properties, the storage law and the residue pointer; the ruling goes to history.

```ts
/**
 * The SMOKE credential: a read-only machine principal for the admin plane.
 *
 * Ruled 2026-08-24 under Dustin's standing automation directive. `check:browser`
 * could only reach the real authenticated admin by being handed the single
 * admin's own session cookie, pasted out of Chrome into a gitignored file, which
 * meant the admin cases had never once run unattended and the plane's layout
 * defects were found by Dustin clicking. This is the credential that moves that
 * sweep into CI.
 *
 * ## IT IS ITS OWN PRINCIPAL, NOT A COPY OF THE ADMIN'S SESSION
 *
 * Three properties, and each one is why this exists rather than a shared cookie:
 *
 *   LEAST PRIVILEGE  it reads and cannot write. Not by convention: `decide()`
 *                    and `decideDelete()` refuse it from the capability table,
 *                    and the `/admin` middleware refuses every non-GET method
 *                    before a single action runs. See `publish-policy.mjs`.
 *   REVOCABLE ALONE  `wrangler secret delete SMOKE_TOKEN` ends it and touches
 *                    nothing else. Revoking a leaked admin session means
 *                    invalidating the only human's login.
 *   STORABLE         a wrangler secret, a GitHub Actions secret, a local file.
 *                    A Better Auth session cookie is none of those: it expires,
 *                    it lives in the production KV namespace, and it cannot be
 *                    minted by a machine at all.
 *
 * Storage and lifecycle are the OPERATOR TOKEN's, deliberately and exactly:
 * `wrangler secret put SMOKE_TOKEN` for the Worker, `SMOKE_TOKEN_FILE` pointing
 * at a local file for a machine that runs the gate, `gh secret set SMOKE_TOKEN`
 * for CI. Never on a command line, never in a log, never in an error body.
 *
 * ## THE RESIDUE IS ON THE ACTOR, WHERE THE ACTOR IS DEFINED
 *
 * What a read still exposes is stated on the `smoke` row of `WRITE_CAPABILITIES`
 * in `app/lib/editor/publish-policy.mjs`, because that is where the kind is
 * defined and a residue filed anywhere else is a residue nobody meets. Short
 * form: the claim this credential supports is BOUNDED, not SAFE.
 */
```

### app/lib/smoke.server.ts:42 (NUMBER, shortened)

why its own prefix and why the ceiling is high; the number's grounds stay beside it.

```ts
/**
 * ITS OWN RATE-LIMIT KEY PREFIX on the existing Durable Object, joining `ip:`,
 * `auth:`, `op:`, `preview:` and `csp:`.
 *
 * Its own, not the operator's, so the two cannot exhaust each other: a CI sweep
 * running flat out must never be able to lock the publish path out, and a
 * runaway agent must never be able to make the browser gate report a layout
 * failure that is really a 429.
 *
 * **THE CEILING IS DELIBERATELY HIGH, and the reason is what the limit is FOR.**
 * This is not a per-visitor throttle on a billed path. Nothing behind it spends
 * money: every request it admits is a D1 read the admin plane already does. Its
 * job is to bound the read volume a LEAKED token could draw before anyone
 * notices, and to stop an infinite loop in a harness. A legitimate sweep is a
 * burst of tens of document loads inside a few seconds, which is exactly the
 * traffic shape a tight limit would refuse, so a tight limit here would buy
 * nothing and break the one caller.
 */
```

### app/lib/smoke.server.ts:143 (CONTRACT, shortened)

the path rule that forces the placement, and the empty string; the gate's finding goes to history.

```ts
/*
   * THE EMAIL IS RESOLVED HERE, INSIDE THE BOUNDARY, and that placement is a
   * gate's finding rather than a preference.
   *
   * The middleware read `env.ADMIN_EMAIL` directly to build the actor, and
   * `check:secrets` refused it by name: `admin.tsx` is a ROUTE, and hard rule 3
   * is a PATH rule, so a route reading a ratified secret is a violation whether
   * or not the value ever leaves the server. The alternative on offer was an
   * allowlist entry, which that gate's own header calls the wrong move.
   *
   * Resolving it here is also the more honest shape: the session path already
   * resolves the admin's address inside `auth.server.ts`, so both kinds of
   * caller now learn who they render as from a `.server` module, and neither
   * route touches the secret.
   *
   * Empty string when unset, matching `getAdminSession`'s own treatment of an
   * unconfigured ADMIN_EMAIL. Not a substituted placeholder: an empty topbar
   * label is visibly wrong, where an invented one would quietly move the
   * layout measurement this credential exists to take.
   */
```

## app/lib/preview-links.server.ts

### app/lib/preview-links.server.ts:16 (CONTRACT, shortened)

the thin split, the two keys and the ordering rule; the test pointer goes to history.

```ts
/**
 * The KV half of draft preview links. Deliberately THIN.
 *
 * Every rule lives in `preview-token.mjs`, which is pure and unit tested. This
 * file only reads and writes: it mints nothing of its own, decides nothing of
 * its own, and parses nothing of its own. That split is what makes the rules
 * testable by `node --test` rather than only by deploying a Worker, and it is
 * the reason a reviewer can read the whole security argument in one pure file.
 *
 * ## Two keys, written together and deleted together
 *
 *   preview:token:<token>          the AUTHORITY. JSON: slug, createdAt,
 *                                  createdBy, note. Deleting it revokes.
 *   preview:post:<slug>:<token>    the INDEX. Empty value. Exists so the two
 *                                  enumerations this feature needs are possible
 *                                  at all: "list this post's links" for the
 *                                  drawer, and "revoke every link" on publish.
 *
 * **They are not transactional and this code does not pretend they are.** Two
 * puts and two deletes, in an order chosen so the failure modes are safe:
 *
 *   CREATE writes the AUTHORITY first. A crash between the two leaves a live
 *   token that no listing shows, so the author cannot see it and cannot revoke
 *   it by name. It still expires with its TTL, and it still stops working the
 *   moment the post leaves draft, because the read path re-checks status.
 *
 *   REVOKE deletes the AUTHORITY first. A crash between the two leaves an
 *   ORPHANED INDEX ENTRY: a listing that mentions a token nobody can use. That
 *   is the harmless direction, and it is why `list` skips an entry whose
 *   authority record is gone rather than rendering it. Covered in
 *   `test/preview-token.test.mjs`.
 *
 * In both cases the dangerous artifact is the AUTHORITY record, so both
 * operations put it at the end of the window they can fail in.
 */
```

### app/lib/preview-links.server.ts:185 (NUMBER, shortened)

why 30 and what it is not for; the grounds stay beside the constant.

```ts
/**
 * Requests one IP may make to the preview path inside {@link PREVIEW_RATE_WINDOW_SECONDS}.
 *
 * 30 per minute, which is loose for a human opening a link and reloading it and
 * tight against anything enumerating. It is NOT the reason the token space is
 * safe: 256 bits is. This is here so the traffic such an attempt would make
 * stops, rather than because the attempt could otherwise succeed.
 */
```

### app/lib/preview-links.server.ts:198 (WHY, shortened)

fails closed on an absent binding; the three past catches go to history.

```ts
/**
 * The per-IP burst limit on the preview path.
 *
 * THE ASK LIMITER'S DURABLE OBJECT, and the same shape: one instance per IP,
 * `hit()` doing a synchronous read-and-write so the count cannot be raced. The
 * measurements that ruled out both the `ratelimit` binding and a KV counter are
 * in `workers/ask-budget.ts` and are not restated here.
 *
 * FAILS CLOSED when the binding is absent, exactly as `checkAskRate` does. An
 * unprotected public path that serves unpublished content must not serve: a
 * guard that silently passes because it could not run is the failure mode this
 * project has been caught by three times.
 */
```

## app/lib/editor/github.server.ts

### app/lib/editor/github.server.ts:1 (CONTRACT, shortened)

one commit, one file, why the Git Data API shape stays, and the token prohibition.

```ts
/**
 * The GitHub half of the editor's write path.
 *
 * Every editor save is one commit on `main`. Since the artifact arc a save
 * carries exactly ONE file, the markdown itself; git holds markdown only and
 * D1 holds the only rendered copy. The Git Data API commit shape (blobs,
 * tree, commit, ref) STAYS even so, because it is what carries the
 * `expectedHeadSha` conflict guard: the head is checked up front and the ref
 * update refuses a non-fast-forward, so a save can never silently replay on
 * top of work nobody looked at. The Contents API write path has no such
 * check-then-update seam.
 *
 * The token is a Worker secret. It is never sent to the client and never
 * logged; failures report status codes and GitHub's message, never the request.
 */
```

### app/lib/editor/github.server.ts:99 (CONTRACT, shortened)

absent versus failed, and the 1 MB cap guard; the would-have-surfaced story goes to history.

```ts
/**
 * Reads a file at a given ref. Returns null for 404 so a caller can tell
 * "absent" from "failed", which is the difference between creating a post and
 * an outage.
 *
 * GUARDED AGAINST THE 1 MB CONTENTS CAP, the same guard `readBinaryFile` has
 * always had. The JSON media type returns a file over 1 MB with `size` set and
 * no base64 content, and this function used to decode that to an empty string:
 * a markdown file crossing the cap would have surfaced downstream as parse
 * garbage rather than as the transport failure it is. The decision lives in
 * `contentsCapMessage` (contents-cap.mjs) so `node:test` can drive it with
 * a stubbed response.
 */
```

### app/lib/editor/github.server.ts:139 (CONTRACT, shortened)

one call for shas, and the not-recursive rule with its cap.

```ts
/**
 * Lists one directory of the repository at a ref.
 *
 * The Contents API on a directory returns every entry with its git blob sha
 * in ONE call, and blob shas are content-addressed, so this is the whole
 * cost of asking "which markdown files exist and what bytes do they hold"
 * without fetching any of them. `regenerateAllFromRepo` walks it to rebuild
 * D1, and the content-drift health check compares its shas against
 * `posts.source_blob_sha`.
 *
 * NOT RECURSIVE, deliberately: `content/posts/` is flat by construction
 * (`postPath` states the one shape a post path can take), and the directory
 * form of this endpoint caps at 1000 entries, which is stated here rather
 * than discovered at post 1001. The refusal below fires long before the cap
 * binds.
 */
```

### app/lib/editor/github.server.ts:175 (CONTRACT, shortened)

why raw bytes, what the pinned ref measures, and the cap; finding B002 goes to history.

```ts
/**
 * Reads a file at a given ref as RAW BYTES.
 *
 * `readFile` decodes to text, which is right for markdown and destroys an
 * image: `TextDecoder` replaces every invalid UTF-8 sequence, so a PNG comes
 * back a different length than it went in and nothing can measure it.
 *
 * Added for finding B002. The editor's image resolver used to measure
 * `public/*` by fetching `SITE_ORIGIN`, which is the DEPLOYED asset, while
 * `build:content` measured the file in the working tree. A retouched image
 * committed but not yet deployed therefore gave the two writers different
 * dimensions for the same src. Reading the repo at the pinned ref measures what
 * the repository says, which is exactly the bytes a clone would build from.
 *
 * The Contents API caps out at 1 MB per file; anything larger comes back with
 * an empty `content` and needs the blob endpoint. Site images are well under
 * that, and the empty-content case is reported rather than measured, so an
 * oversized asset fails the save instead of silently losing its dimensions.
 */
```

### app/lib/editor/github.server.ts:222 (CONTRACT, shortened)

the conflict gate and why it is checked up front.

```ts
/**
 * Lands every change as one commit on main.
 *
 * `expectedHeadSha` is the conflict gate. The caller records the head commit
 * when it loads the editor and passes it back on save; if main has moved since,
 * the update is refused rather than replayed on top of work nobody looked at.
 * GitHub enforces this itself on the ref update (non-fast-forward without
 * force), and it is checked up front so the failure is a clean message rather
 * than a rejected push after blobs have been created.
 */
```

## app/lib/media/backup.server.ts

### app/lib/media/backup.server.ts:1 (CONTRACT, shortened)

the mirror law, what it does not cover, the never-delete prohibition and the never-dual-write rule.

```ts
/**
 * THE MIRROR. Every object in MEDIA has a byte-identical twin in MEDIA_BACKUP.
 *
 * Ruled 2026-09-01 in `decisions-vol-13.md`, after `media-unbacked` fired on the
 * first object ever put in the bucket. That check asked whether MEDIA was still
 * EMPTY, because `RECOVERY.md` section 3 grounded a no-backup acceptance on it
 * holding nothing. The acceptance was going to expire the first time a real
 * image-bearing post was written, so it was re-decided rather than deferred.
 *
 * ## WHAT THIS PROTECTS AGAINST, IN THE RULED ORDER
 *
 * 1. **The site's own code.** The OG prune, the media delete action and the
 *    R2-wins reconciliation can each remove an object with no undo. This is the
 *    realistic loss, and a same-account mirror covers it completely.
 * 2. **Account loss or compromise.** Covered only by a copy outside the
 *    account, which is `check:backup`'s local pull, not this module.
 * 3. **Cloudflare losing an object.** Least likely of the three.
 *
 * ## THE ONE RULE THIS FILE EXISTS TO KEEP
 *
 * **NO SITE CODE PATH EVER DELETES FROM THE BACKUP.** There is no delete in
 * this module and there must never be one anywhere else either; pruning the
 * mirror is a human act, by hand. `check:destructive` fails on a delete against
 * the `MEDIA_BACKUP` binding, which is what makes that sentence enforceable
 * rather than aspirational.
 *
 * Copying is also the only write here, and it is the one write that cannot lose
 * anything. That is precisely why `media-backup-drift` is allowed to self-repair
 * where `media-unbacked` was not: a repair that can only add is safe to fire
 * unattended.
 *
 * ## NEVER A DUAL WRITE
 *
 * The Worker still writes ONLY to MEDIA. The bucket emits an event, and the
 * queue consumer derives BOTH the D1 row and the twin from the object as it is
 * NOW, never from what the message claimed. So the mirror is derived state on
 * exactly the same footing as the index, and replay or out-of-order delivery
 * converge instead of corrupting.
 */
```

### app/lib/media/backup.server.ts:84 (CONTRACT, shortened)

the comparison rule and the multipart escape hatch; the rejected full hash goes to history.

```ts
/**
 * WHETHER TWO OBJECTS ARE THE SAME BYTES, and why this comparison and not
 * another.
 *
 * **ETAG, corroborated by SIZE.** For a single-part R2 object the etag IS the
 * MD5 of the stored bytes, so equal etags mean equal content, and `list()`
 * returns it for free on both sides. `admin.media.upload.ts` caps an upload at
 * 10 MB and every write here is a whole-object `put`, so nothing in this bucket
 * is multipart.
 *
 * **Why not size alone:** a same-length corruption is exactly the case a mirror
 * is for, and size cannot see it.
 *
 * **Why not a full hash:** it would mean reading every object's body on every
 * health poll. The queue consumer already refuses that cost for the LQIP, in
 * this same subsystem, for the same reason.
 *
 * **The multipart escape hatch is stated rather than assumed.** A multipart
 * etag carries a `-<parts>` suffix and is NOT a content digest. If one ever
 * appears the comparison degrades to size and SAYS SO in the reason, so a
 * weaker verdict can never be mistaken for the strong one.
 */
```

### app/lib/media/backup.server.ts:169 (CONTRACT, shortened)

whole-object copy, idempotent by construction, and a gone source is not an error.

```ts
/**
 * Copy ONE object into the mirror, from the object as it is now.
 *
 * The Workers R2 binding has no server-side copy, so this is a `get` and a
 * `put`. Whole-object, which is what keeps the etag a content digest.
 *
 * IDEMPOTENT BY CONSTRUCTION: it re-reads the source and overwrites the twin
 * with the same bytes, so replay converges. It never branches on what a queue
 * message claimed.
 *
 * A source that no longer exists is NOT an error. The object was deleted
 * between the event and this call, and the twin that already exists is exactly
 * what the mirror is for: it stays.
 */
```

## app/lib/cache-purge.server.ts

### app/lib/cache-purge.server.ts:5 (CONTRACT, shortened)

the import form, the never-blocks rule, the success read, and the two boundary statements; the reversal goes to history.

```ts
/**
 * Invalidating what a write just changed. Ruling 17, 2026-09-05.
 *
 * ## THIS REVERSES RULING 7, AND THE REVERSAL IS THE POINT
 *
 * Six weeks ago the answer was that there is no purge. The post page had two
 * caches and neither could be invalidated: the platform's had no purge API on
 * `workers.dev`, and the hand-built `caches.default` layer was PER DATA CENTRE,
 * so a delete on approve would have cleared the admin's own colo and nothing
 * else. An instrument that reads as whole and is partial is worse than none, so
 * ruling 7 chose to wait out `s-maxage` and say so on the admin page in plain
 * words.
 *
 * Workers Cache has `purge` now, with Instant Purge and global propagation, so
 * the reasoning did not change: the measured world did. A mention approved at
 * 10:00 appears under the post at 10:00 instead of by 10:10.
 *
 * ## THE IMPORT FORM, because the write paths do not hold a `ctx`
 *
 * Cloudflare documents two spellings, `ctx.cache.purge` and the `cache` import.
 * Every caller here is a route action, an editor helper or a health repair
 * running well below the request handler, and threading an ExecutionContext
 * down to each of them would be a parameter on a dozen signatures for one
 * optional side effect. The import reaches the same API.
 *
 * ## IT NEVER THROWS AND IT NEVER BLOCKS A WRITE
 *
 * A purge is bookkeeping ABOUT a write that already succeeded. If the row is
 * saved and the invalidation fails, the correct outcome is a stale page for up
 * to ten minutes and a log line, not a 500 handed to the operator who just
 * published. That is hard rule 18's second clause in a new place: a failed
 * index write never reverts the source.
 *
 * `success` IS READ, which is the half that is easy to skip. `purge` resolves
 * with `{ success, errors }` rather than rejecting on a refusal, so a caller
 * that awaited it and looked at nothing would report a purge that never
 * happened. Rate limits are the Free-tier zone limits regardless of plan, which
 * is the realistic way this comes back false.
 *
 * ## LOCAL DEV HAS NO PURGE, AND THAT IS A GUARD RATHER THAN A HOPE
 *
 * Miniflare does not implement Workers Cache: MEASURED 2026-09-05 under
 * `vite preview`, where a response with `public, s-maxage=600` and a fixed
 * `cf.cacheKey` was re-rendered on every one of three fetches and carried no
 * `Cf-Cache-Status` at all. So there is nothing local to purge and the API may
 * be absent entirely. Absence is treated as a no-op with one log line, never as
 * an error, because the alternative is every local save and every worker test
 * failing on an API that production has and the harness does not.
 *
 * **THE PROOF OF THIS MODULE IS THEREFORE LIVE, ON THE WIRE**, in verify-live's
 * measurement (d): approve a mention, fetch the post cookieless within five
 * seconds, and the section is there. Nothing offline can establish it, and
 * saying so is better than a green test that proved the guard works.
 */
```

### app/lib/cache-purge.server.ts:108 (CONTRACT, shortened)

what it purges and why not the corpus.

```ts
/**
 * Invalidate ONE post's page. For a write that changed that page and nothing else.
 *
 * The mention decisions are the whole of this today. Approving, rejecting or
 * deleting a mention changes the rendered list under one post; it does not
 * touch the index, the feeds or any other post, so purging `posts` would throw
 * away the entire corpus's cache to fix one page.
 *
 * @param slug the post whose page changed
 */
```

### app/lib/cache-purge.server.ts:122 (CONTRACT, shortened)

one vocabulary, and the refusal of purgeEverything.

```ts
/**
 * Invalidate everything that lists the corpus, the changed post included.
 *
 * `cacheTags()` with no argument IS the `posts` tag, so this reads the same
 * vocabulary the responses were tagged with rather than a second spelling of
 * it. A publish moves the post page, the index, every tag archive, every series
 * hub, the feeds, the sitemap and llms.txt, and they all carry `posts` for
 * exactly this call.
 *
 * NOT `purgeEverything`. That would take the hand-authored pages with it, which
 * no publish changes, and it is the mode with the least ability to be wrong
 * about what it did.
 */
```

### app/lib/cache-purge.server.ts:139 (CONTRACT, shortened)

why an uncalled export exists, and the standing instruction to delete it.

```ts
/**
 * Invalidate the hand-authored pages. EXPORTED AND UNCALLED, deliberately.
 *
 * `PAGES_CACHE_TAG` is on every shared-cacheable page that does not read the
 * corpus, and nothing purges it because nothing changes those pages except a
 * deploy, which already invalidates every entry through the Worker version in
 * the key. This exists so the tag has a named door rather than being a string
 * with no reader, and so the next person who needs it does not invent a second
 * spelling. If it still has no caller a year from now, delete both.
 */
```

## app/lib/markdown-twin.ts

### app/lib/markdown-twin.ts:35 (CONTRACT, shortened)

the never-stored rule, the per-caller policy and the Vary rule; the measurement and the reversed paragraph go to history.

```ts
/**
 * The markdown representation of a post, with its headers.
 *
 * ## NEVER STORED, and this is not a performance oversight
 *
 * `NO_STORE_CACHE_CONTROL` is `private, no-store`, and it is here to stop a SECOND
 * CACHE VARIANT from existing under `/blog/:slug`. Do not "optimise" this back
 * to `SHARED_CACHE_CONTROL`.
 *
 * **The defect it repairs, measured 2026-08-05 with a paired control on fresh
 * URLs.** `/blog/:slug` sets `Vary: Accept, Cookie`. With only the HTML
 * representation in play, a cookie-bearing request correctly BYPASSes and gets
 * `private, no-store` from the downgrade in `workers/app.ts`. But after ONE
 * request for this markdown representation, the same cookie-bearing request
 * gets a `HIT` and `public`: the edge answers from the stored cookieless
 * variant, the Worker never runs, the downgrade never fires, and a reader with
 * `theme=dark` is served the light document. `Accept` separates storage
 * correctly; it is the `Cookie` dimension that collapses once a second variant
 * exists under the key.
 *
 * A response that is never stored cannot become that second variant. That is
 * the whole mechanism, and it is why the fix is here rather than on the HTML
 * side, which is measured correct in the single-variant case.
 *
 * **The trigger is an advertised path**, not a hypothetical: `llms.txt`
 * documents the `Accept: text/markdown` form, and `linkToMarkdown` puts it in a
 * `Link` header on every post.
 *
 * ## THE SPLIT THIS PARAGRAPH REFUSED IS NOW MADE, 2026-08-26
 *
 * What stood here: "this function also serves `/blog/:slug.md`, a distinct URL
 * that never had the variant problem, so that path loses edge caching too. It
 * is one D1 read, and one rule is worth more than a split that invites the next
 * person to re-enable half of it."
 *
 * The reasoning about the RISK is exactly right and is unchanged below. What
 * changed is the measured cost. `llms.txt` advertises the twin as the path for
 * agents and `linkToMarkdown` puts it in a `Link` header on every post, so this
 * is the machine-readable surface of the whole site, and every fetch of it was
 * a `BYPASS` and an origin render. Measured on the wire: `Cache-Control:
 * private, no-store`, `CF-Cache-Status: BYPASS`, on a document that depends on
 * nothing but its own URL.
 *
 * **The policy is now the CALLER'S**, because the two callers face genuinely
 * different situations and always did:
 *
 *   `/blog/:slug` negotiating on Accept   NEVER STORED. Unchanged, and the
 *                                         whole argument above applies to it.
 *   `/blog/:slug.md` at its own URL       PUBLICLY CACHED. One representation
 *                                         under that key, so there is no second
 *                                         variant for a Cookie dimension to
 *                                         collapse against.
 *
 * That is not "re-enabling half of it". The rule the paragraph above was
 * protecting is "the markdown representation under `/blog/:slug` is never
 * stored", and that rule is intact. The twin's own URL was collateral.
 *
 * **`Vary: Accept` GOES on the twin, and that is the other half.** The old
 * comment called it "still true and still correct to advertise". It is neither,
 * once the response is stored: under `/blog/:slug.md` the body does not depend
 * on Accept at all, because markdown is the only representation that URL has.
 * Advertising a dimension the Workers Cache key cannot honour is the mistake
 * `media.$.ts` records in full, and it is worse than advertising none. It stays
 * on the negotiated response, where it is true.
 */
```

## app/routes/api.csp-report.ts

### app/routes/api.csp-report.ts:7 (CONTRACT, shortened)

the unauthenticated-sink argument, the three limits and the refusal; the window date goes to history.

```ts
/**
 * The CSP violation sink. Phase B.
 *
 * **The Report-Only window closed on 2026-08-17 and this endpoint did not.**
 * `report-uri` and `report-to` are still sent beside the enforcing header, so
 * reports still arrive here: under enforcement a report means something was
 * BLOCKED, which is a live symptom rather than an observation. Everything below
 * about being an unauthenticated sink is unchanged by that.
 *
 * **THIS IS A PUBLIC, UNAUTHENTICATED POST ENDPOINT.** It has to be: browsers
 * send violation reports with no credentials, and a report that needs a token
 * is a report nobody sends. So it is written as a sink that cannot be turned
 * into anything useful by an attacker, and the three limits below are the whole
 * of that argument.
 *
 * ## What it does with a report: LOGS IT
 *
 * Deliberately not D1. An unauthenticated endpoint that writes rows is a
 * storage-exhaustion primitive handed to the internet, and the observation
 * window this exists for is measured in days. `console.log` reaches Workers
 * observability and `wrangler tail`, which is where these are meant to be read.
 * If reports ever need to persist, that is a ruling with its own retention and
 * privacy questions, not a quiet schema change.
 *
 * ## Three limits, cheapest first, same ordering principle as the Ask guards
 *
 * 1. **Method.** Anything but POST is 405 and reads nothing.
 * 2. **Body cap, 8 KB.** Checked against `Content-Length` BEFORE the body is
 *    read, so an oversized report costs no memory. A real CSP report is a few
 *    hundred bytes; 8 KB is generous for the `report-to` batching format, which
 *    can carry several reports in one array.
 * 3. **Per-IP rate limit, 60 per 60 seconds**, on the existing `AskBudget`
 *    Durable Object under a `csp:<ip>` instance name. NO new class and no
 *    migration, exactly as the operator path reuses it under `op:<id>`.
 *
 * **Why 60 and not something tighter.** The deliverable here is the violation
 * report itself, and a page that trips ten rules sends ten reports; a limit
 * that silently ate them would make the observation window lie in the safe
 * direction, which is the worst direction for this particular endpoint. 60 is
 * enough for any real page and still bounds a flood.
 *
 * **Without `ASK_BUDGET` the endpoint refuses**, the same stance the Ask guards
 * and the operator path take: an unprotected public write path does not serve.
 *
 * Always answers 204 on the success path. A browser does not read the body and
 * an error status would only make it retry.
 */
```

### app/routes/api.csp-report.ts:70 (WHY, shortened)

the header refuses early and never permits; the Number(?? '0') defect goes to history.

```ts
/*
   * CONTENT-LENGTH IS A HINT FROM THE CLIENT, so it is used to refuse early and
   * never to permit. An honest oversized header is rejected here without
   * touching the body; a missing or lying one falls through to `readCapped`
   * below, which counts the bytes as they arrive.
   *
   * This used to be the ONLY cap, and it was `Number(header ?? "0")`: a request
   * with no Content-Length became 0, sailed past `> MAX_BODY_BYTES`, and the
   * body was then materialised whole by `request.text()`. A small lie did the
   * same. The endpoint is public, unauthenticated and POST.
   */
```

### app/routes/api.csp-report.ts:113 (WHY, shortened)

the cap is on the stream, not the slice; the previous comment's false claim goes to history.

```ts
/*
   * READ THE STREAM AND STOP AT THE CAP.
   *
   * The previous comment here claimed the cap preceded the read. It did not:
   * `request.text()` materialises the whole body before `.slice()` can shorten
   * it, so the slice bounded what was LOGGED and never what was received.
   *
   * `readCapped` cancels the stream the moment the count crosses the limit, so
   * an oversized body costs the bytes already in flight and nothing more, and a
   * client that omits or understates Content-Length gets the same treatment as
   * one that declares it honestly.
   */
```

### app/routes/api.csp-report.ts:134 (CONTRACT, shortened)

the two rules that survive: JSON-encoded so a body cannot forge log lines, and unparsed so neither report shape is dropped.

```ts
// One line, prefixed so it can be filtered out of the log stream. The report
  // is logged VERBATIM rather than parsed: both the legacy `report-uri` shape
  // and the `report-to` batch shape land here, and a parser that understood
  // only one would silently drop the other.
  // JSON-encoded, so a body containing newlines cannot forge additional log
  // lines past the [csp-report] prefix the stream is filtered on. The body stays
  // UNPARSED, which is deliberate: both the report-uri and report-to shapes land
  // here and this endpoint is not the place to decide between them.
```

## app/lib/bearer.server.ts

### app/lib/bearer.server.ts:1 (CONTRACT, shortened)

why one copy, and the path rule that keeps it a .server module; the extraction and the missing-test story go to history.

```ts
/**
 * The two primitives every static bearer credential in this repo needs.
 *
 * Extracted 2026-08-24 when the SMOKE credential became the second one. Before
 * that both lived privately in `operator/auth.server.ts` and there was one
 * caller, so there was nothing to share. There are two now, and a second copy
 * of a constant-time comparison is the rule 17 defect in the one place it is
 * least affordable: a copy that drifts toward `===` is a token recoverable a
 * byte at a time, and it would drift in silence, because both spellings return
 * the same booleans for every input a test would think to try.
 *
 * BOTH BODIES ARE LIFTED VERBATIM. Nothing here was rewritten or improved while
 * it moved. The equivalence was proven by differential against the pre-move
 * bodies over real inputs, with the comparison shown able to discriminate, per
 * hard rule 12.
 *
 * **THAT SENTENCE NAMED `test/bearer.test.mjs` AND THAT FILE DID NOT EXIST**,
 * found 2026-08-28 by looking rather than by anything failing. The differential
 * was real and was run at the move; what was never true is that a committed
 * test kept it standing. A boundary note is a claim that ages, and this one
 * aged into naming an instrument nobody had written.
 *
 * **THE FILE EXISTS NOW**, written the same day, and it holds the property that
 * matters here rather than the one that sounds most impressive. It does NOT
 * assert constant time: timing a comparison in-process measures the garbage
 * collector, and a flaky assertion in the suite that gates a deploy teaches
 * people to re-run until green. It asserts that a PREFIX is refused, which is
 * the length refusal and the observable consequence of hashing both operands at
 * once, and it carries the naive prefix-bounded implementation as a control so
 * the case is shown able to discriminate. `check:policy` still asserts the
 * ordering below by position.
 *
 * This is a `.server` module because hard rule 3 is a PATH rule and these run
 * only inside the Worker. Neither function reads `env`, so `check:secrets` has
 * nothing to say about the file, and that is not a licence to move it: a helper
 * whose whole job is comparing a secret belongs behind the boundary whether or
 * not the gate can see it there.
 */
```

### app/lib/bearer.server.ts:40 (WHY, shortened)

the timing leak and why both sides are hashed first; trimmed to the two rules.

```ts
/**
 * Compares two strings without leaking where they diverge.
 *
 * A plain `===` on a secret returns as soon as two bytes differ, so the time it
 * takes is a function of how much of the prefix the caller guessed correctly,
 * and that is enough to recover a token a byte at a time over enough requests.
 *
 * Both sides are hashed to a fixed 32 bytes FIRST, then compared. Comparing the
 * raw strings would still leak their LENGTH through the loop bound, and hashing
 * makes both operands the same size whatever was sent.
 */
```

### app/lib/bearer.server.ts:60 (WHY, shortened)

why the length is folded in first and why the loop is branch-free.

```ts
/*
   * THE LENGTH DIFFERENCE IS FOLDED IN FIRST, and that is what makes the read
   * below safe without a non-null assertion.
   *
   * Both operands are SHA-256 digests, so both are the same fixed size and the
   * lengths cannot differ. Seeding `diff` with the XOR of the two lengths says
   * so in code rather than in a comment, costs nothing, and means the `?? 0`
   * that follows can never flip the answer to "equal": if the lengths ever did
   * differ, `diff` is already non-zero before the loop starts.
   *
   * Branch-free on purpose. An early return inside the loop would be a
   * data-dependent exit from a function whose whole job is not to have one.
   */
```

### app/lib/bearer.server.ts:78 (CONTRACT, shortened)

what the label supports and what it does not; the corrected sentence goes to history.

```ts
/**
 * A short, stable, non-reversing label for a token holder.
 *
 * It goes into commit messages and rate-limit keys, so it must identify the
 * caller without being the secret. Eight hex characters of a hash of the token:
 * stable across requests and different after a rotation.
 *
 * **IT DOES NOT "REVEAL NOTHING", and that sentence was here until 2026-08-28.**
 * This is FNV-1a, a 32-bit non-cryptographic hash chosen because it is
 * synchronous and this runs after the token has already been verified. What a
 * 32-bit digest supports is that the label is not the token and cannot be read
 * back into one; what it does NOT support is a claim about an attacker with the
 * label and a guess, who can confirm the guess by hashing it. That is fine for
 * what this is used for and it is not the same sentence.
 *
 * The security boundary is `constantTimeEqual` above. This is a label, and the
 * distinction is the reason a non-cryptographic hash is acceptable here at all.
 */
```

## app/lib/citations.server.ts

### app/lib/citations.server.ts:20 (WHY, shortened)

why a URL and not an address, and why the address is not quoted here either; the removal date goes to history.

```ts
/*
 * THE CALLER'S NAME, AND DELIBERATELY NOT AN ADDRESS.
 *
 * This carried a `mailto:` with a real address until 2026-09-12, on the old
 * convention that a scholarly API caller identifies itself by email. TWO things
 * made that wrong here. OpenAlex removed the `mailto` polite pool on
 * 2026-02-13, so the address bought nothing from the vendor: the API key is the
 * identification now. And `check:config` refuses a real configured value
 * appearing in a tracked file, which that address was, because it is also the
 * watchdog's ALERT_EMAIL. The gate found it on the restore.
 *
 * The address is not written out here either, for the reason it was removed:
 * that gate reads the WHOLE file and does not strip comments, which is correct.
 * A value quoted in a comment is still the value, sitting in git.
 *
 * A URL identifies the caller at least as well, is already public, and is not a
 * value any config holds.
 */
```

### app/lib/citations.server.ts:64 (CONTRACT, shortened)

the key is mandatory, env not globalThis, and never the author endpoint; the vendor change and the old contract go to history.

```ts
/**
 * ONE WORK BY DOI, WITH THE KEY, AND THE KEY IS NOW MANDATORY.
 *
 * ## What changed on 2026-02-13, and what it broke here
 *
 * OpenAlex made an API key required and removed the `mailto` polite-pool
 * parameter in the same release. This function was written in July 2026 against
 * the old contract: it SET `mailto` and treated the key as optional, "sent only
 * when configured, so adding a key later is config and not code". Both halves
 * inverted. `mailto` is now ignored, and a keyless request draws on a shared
 * budget of about 100 credits before every later one is refused, so the
 * optional path is no longer a polite fallback, it is a guaranteed failure with
 * a `4xx` that this function converts to `null` and the page renders as silence.
 *
 * So the key is read and sent, `mailto` is gone from the query, and a missing
 * key SHORT CIRCUITS rather than firing a request that cannot succeed. The
 * User-Agent stays: it identifies the caller, which is still good manners and
 * costs nothing.
 *
 * ## `env`, NOT `globalThis`
 *
 * The July version read `(globalThis as {OPENALEX_API_KEY?}).OPENALEX_API_KEY`,
 * which is never populated on Workers: secrets and bindings arrive on `env`,
 * per request. It was a no-op that looked like a feature flag, and it would
 * have stayed a no-op after the key was set, which is the worst version of
 * this bug: the credential exists, the code claims to use it, and the value
 * read is `undefined` every time. Portfolio rule, and this repo's binding rule:
 * read off the request context, never a global.
 *
 * Singleton lookup, 1 credit. Never the author endpoint, which has seven works
 * by other people merged into it, and never a filter query from here.
 */
```

## app/enhance/ask.ts

### app/enhance/ask.ts:1 (CONTRACT, shortened)

the two load paths, the caller-owned container and the DOM guard; trimmed.

```ts
/**
 * Ask mode's client. Search Layer 2, and the top of the enhancement stack.
 *
 * Loaded two ways, both only on surfaces that already rendered classic
 * results: /search renders a nonced script tag for this module's own bundle,
 * and the palette bundle carries an inlined copy (build-enhance.mjs inlines
 * its lazy import, because a bundle may not import). With scripting off none
 * of this runs and /search is exactly what it was before Layer 2.
 *
 * It renders into a container the caller owns rather than creating its own
 * placement, so /search and the palette can both use it without this module
 * knowing about either. The mount binding at the bottom is the /search half:
 * the server renders the Ask button HIDDEN (an inert control that looks live
 * is worse than no control), and this unhides and binds it. The binding is
 * DOM-guarded because on /search both bundles execute this module's body, and
 * two listeners would stream two billed answers per click.
 */
```

### app/enhance/ask.ts:46 (WHY, shortened)

appendChild never .append, and the compile error it avoids.

```ts
/**
 * Appends children.
 *
 * `appendChild`, never `.append()`. Client chunks in this repo are type-checked
 * with the Workers types in scope, where the global `Element` is HTMLRewriter's
 * and its `append` takes a string or a Response. The DOM spread form therefore
 * fails to compile with an error that talks about `ReadableStream`, which is
 * baffling until you know why. The palette chunk uses `appendChild` for the
 * same reason.
 */
```

### app/enhance/ask.ts:86 (WHY, shortened)

why the wording is this and not a chatbot placeholder; the date goes to history.

```ts
/*
   * `Looking it up.` and not `Thinking...`, which is what this said until
   * 2026-09-11. Two reasons and the second is the one that decided it.
   *
   * It is not thinking; it is retrieving. The request in flight is an AI
   * Search query over this site's own chunks, and the answer that comes back
   * is grounded in them, which is the entire claim the badge and the source
   * list beside this line make. "Thinking" describes a different product.
   *
   * And it is every chatbot's placeholder, three dots included. A reader who
   * has seen it a hundred times reads it as the interface stalling rather than
   * as this site saying what it is doing. A full stop instead of an ellipsis
   * for the same reason: the sentence is a statement, not a trailing-off.
   */
```

### app/enhance/ask.ts:252 (CONTRACT, shortened)

who owns the rule, and why the guard is on the DOM.

```ts
/**
 * Binds the server-rendered Ask affordance on /search.
 *
 * The server renders the button only when the binding exists AND the query is
 * a real question (search.tsx owns that rule), so an empty question here means
 * markup this module does not own; the button stays hidden rather than being
 * wired to do nothing. The guard is on the DOM, not module state, because the
 * palette bundle carries an inlined copy of this module and both copies run on
 * /search; the discipline is decorateCodeBlock's, ask the element itself.
 */
```

## app/lib/editor/action.server.ts

### app/lib/editor/action.server.ts:55 (WHY, shortened)

no default, and why an unknown intent is refused; the audit of submit sites goes to history.

```ts
/**
   * NO DEFAULT. An absent intent is REFUSED, not treated as a save.
   *
   * This was `String(form.get("intent") ?? "save")`, so a malformed POST that
   * carried no intent PERFORMED A WRITE: a commit to GitHub and a D1 sync,
   * from a request that never said what it wanted. Hard rule 13, on the worst
   * possible surface for it, since the substituted value was an action rather
   * than a label.
   *
   * The only caller that ever relied on the default was the editor's Cmd+S,
   * which submits with no submitter. It sends its intent explicitly through a
   * hidden field it enables for one submit, so nothing legitimate reaches this
   * branch. Checked against every submit site before the default was removed:
   * the four save controls, the preview control and the delete control all name
   * their intent already.
   *
   * SINCE 2026-09-03 THE INTENT ALSO CARRIES THE DRAFT FLAG, so an intent this
   * module does not recognise is refused below rather than run as a save. It
   * used to fall through to one, which was survivable while `draft` was its own
   * field and is not now: an unknown intent would be a write whose publication
   * state came from a fallback.
   *
   * The read lives in `intent.mjs` so the rule is testable; this file cannot be
   * imported by `node:test`. Covered in `test/editor-intent.test.mjs`.
   */
```

### app/lib/editor/action.server.ts:105 (CONTRACT, shortened)

the allowlist is derived from the transition table, and refused before the try.

```ts
/*
   * THE ALLOWLIST, and it is derived rather than written out.
   *
   * `DRAFT_BY_INTENT` is built from the transition table itself, so the set of
   * intents that may write is exactly the set of transitions the buttons can
   * send, and a transition added to the table is permitted here without anybody
   * remembering to widen a literal. `preview` is the one write-free intent and
   * is named separately because it is not a transition.
   *
   * Refused BEFORE the try for the same reason the absent intent is: an
   * unrecognised intent is a malformed request, not a save that failed.
   */
```

### app/lib/editor/action.server.ts:138 (CONTRACT, shortened)

the ceremony is always opted into, and only the confirmed intent answers yes.

```ts
/*
       * THE EDITOR OPTS INTO THE CEREMONY, always, with a real boolean.
       *
       * Every save from this module answers the question, so a first
       * publication reached from the editor can never skip it. The confirmed
       * intent is the ONLY thing that answers yes: it is sent by the ceremony's
       * own submits and by the server-rendered second step, and by nothing
       * else, which is what makes a plain `publish` land on the confirmation
       * rather than on the commit.
       */
```

## app/lib/operator/auth.server.ts

### app/lib/operator/auth.server.ts:1 (CONTRACT, shortened)

why a static bearer and not the other two, and the token prohibition; the extraction goes to history.

```ts
/**
 * Authentication for the operator publish path.
 *
 * A static bearer token, held as a wrangler secret. Not Better Auth: that plane
 * is a Google login with a browser session in KV, and an agent has no browser.
 * Not OAuth either, because there is one caller class and one owner, and an
 * authorization-code dance with nobody to click "allow" is theatre.
 *
 * The token is the whole boundary, so it is compared in constant time and it is
 * never echoed, logged, or included in an error.
 *
 * The comparison and the caller label moved to `~/lib/bearer.server` on
 * 2026-08-24 when the SMOKE credential became the second static bearer here.
 * Both bodies went across verbatim; see that file for why a second copy of a
 * constant-time compare is the expensive kind of duplication.
 */
```

### app/lib/operator/auth.server.ts:60 (WHY, shortened)

the length bound, why twice and not equal, and that constant time is unchanged inside it.

```ts
/*
   * REFUSED BEFORE THE HASH, on length alone, above twice the real token.
   *
   * `constantTimeEqual` hashes BOTH operands so that comparison time does not
   * depend on where they diverge. That is the right shape and it has one cost:
   * the input side is whatever the caller sent, so hashing it is work an
   * unauthenticated caller can ask for in any quantity. A megabyte of bearer
   * token is a megabyte of SHA-256 per request, before anything has checked
   * who is asking.
   *
   * TWICE, NOT EQUAL, deliberately. An exact-length gate would turn this into
   * an oracle for the token's length, one request at a time. At twice the
   * length the only thing a caller learns is that the real token is shorter
   * than half of what they sent, which no attack needs, and everything past
   * that bound is refused for free.
   *
   * The constant-time property is UNCHANGED for every candidate that could
   * possibly be right: anything inside the bound still goes through the same
   * hash-and-compare, so a missing header and a wrong token of plausible
   * length still take the same path and the same time.
   */
```

### app/lib/operator/auth.server.ts:97 (CONTRACT, shortened)

the two questions are separate, and the order where both run; the DESCRIBE defect goes to history.

```ts
/**
 * Spends one unit of the caller's rate limit.
 *
 * ## SPLIT OUT OF `authenticateOperator` on 2026-08-28
 *
 * Metering ran unconditionally inside authentication, so every request that
 * proved who it was also spent budget, including `GET /api/operator`, which is
 * the DESCRIBE call: it takes no arguments, changes nothing, and exists so a
 * client can discover the surface. A client that reads the description before
 * each publish therefore halved its own publish allowance, and a client that
 * polled the description could exhaust it without ever writing anything.
 *
 * The two questions are separate and now the code says so: "who is this" is
 * cheap and always asked, "may they spend one" is a Durable Object call and is
 * asked only where something is spent.
 *
 * THE ORDER IS UNCHANGED where both run. Authenticate first, then meter, so
 * the limiter is keyed to a proven identity and an unauthenticated flood
 * cannot exhaust a real operator's budget or reach a Durable Object at all.
 *
 * @param env @param id the authenticated operator label
 */
```

## app/routes/admin.media.upload.ts

### app/routes/admin.media.upload.ts:13 (CONTRACT, shortened)

an adapter over the store, and what is left here; the ruling goes to history.

```ts
/**
 * Image upload for the editor. Sits under /admin so the existing Better Auth
 * middleware gates it; there is no unauthenticated write path to the bucket.
 *
 * ## AN ADAPTER, since 2026-09-07, and the store is `upload.server.ts`
 *
 * Everything this route used to do after the bytes arrived, it now asks
 * `storeUpload` to do: refuse, measure, address, put, annotate. Ruling 32d gave
 * MEDIA a second writer in the operator API's `upload_media`, and the sequence
 * is not one two copies stay equal to, so it moved to a door they share. The
 * grounds are at that function; the content-addressing ruling is at
 * `contentKey` in `classify.mjs`, which is where the key is actually made.
 *
 * WHAT IS LEFT HERE IS EXACTLY WHAT IS THIS ROUTE'S: parsing a multipart form,
 * naming its own missing-input refusal, and choosing between a redirect and a
 * JSON body. All three are properties of who is asking rather than of what is
 * being stored, which is the line the extraction was cut along.
 */
```

### app/routes/admin.media.upload.ts:37 (HISTORY, deleted)

a removed helper and why it went; nothing in the file refers to it, so it goes to the document.

```ts
/* `slugifyName` lived here to build the human-readable half of a key. Content
 * addressing removed the only caller: the key is a digest now, and the filename
 * goes to `original_name` verbatim rather than being mangled into a slug. */
```

### app/routes/admin.media.upload.ts:41 (CONTRACT, shortened)

what stays is that this route is upload-only and where the lister lives; the URL change goes to history.

```ts
/**
 * The listing loader that used to live here MOVED to the media page at
 * /admin/media, so there is one lister and one media surface. This route is now
 * the upload endpoint only, which is why it kept the action and lost the
 * loader. Its URL changed from /admin/media to /admin/media/upload; the editor
 * and the picker both post to the new one.
 */
```

### app/routes/admin.media.upload.ts:58 (CONTRACT, shortened)

the explicit field, and why the editors send nothing new.

```ts
/*
   * WHICH CALLER IS THIS, decided by an EXPLICIT FIELD and by nothing else.
   *
   * The library posts a form and navigates; the two editors `fetch` and read
   * JSON. The library declares itself with a hidden `intent=upload-form`, so
   * the editors keep the JSON path by SENDING NOTHING NEW, which is the whole
   * point: their contract cannot be moved by a header default changing under
   * them. `isFormUpload` is an equality against one token, asserted in
   * test/upload-contract.test.mjs against "1", "true", "" and undefined.
   */
```

### app/routes/admin.media.upload.ts:86 (WHY, shortened)

why read-then-refuse costs nothing and what the old order bought.

```ts
/*
   * READ, THEN REFUSE, and the ordering costs nothing measurable.
   *
   * The type and size checks used to run against `file.type` and `file.size`
   * before the bytes were touched, which reads as the thrifty order and is not:
   * `request.formData()` above has already buffered the entire body into this
   * isolate, so `arrayBuffer()` is a copy out of memory rather than a read off
   * the wire, and an oversized post was oversized in here before any of this
   * ran. What the old order actually bought was a second statement of the size
   * rule living in this file, which is the thing the extraction was for.
   *
   * Read once, too: the bytes are needed to hash and to store, and a File's
   * stream cannot be consumed twice.
   */
```

## workers/ask-budget.ts

### workers/ask-budget.ts:3 (CONTRACT, shortened)

why a Durable Object and why synchronous SQL; both concurrency runs go to history.

```ts
/**
 * The exact spend ceiling for Ask mode.
 *
 * WHY THIS EXISTS RATHER THAN A KV COUNTER, measured on this deployment
 * 2026-07-28 rather than assumed. Twelve concurrent requests against a
 * `ratelimit` binding configured for 5 per 60 seconds produced ELEVEN
 * generations. That is not a defect in the binding: Cloudflare documents it as
 * "permissive, eventually consistent, and intentionally designed to not be used
 * as an accurate accounting system". A KV counter fails the same way and worse,
 * because concurrent read-modify-writes each read the same stale value.
 *
 * WHY THE COUNTER IS SYNCHRONOUS SQL RATHER THAN `storage.get`/`storage.put`,
 * also measured. The first version of this class did an async read, then an
 * async write. A Durable Object is single-threaded but that does NOT make a
 * sequence spanning `await` atomic: fourteen concurrent requests against a
 * ceiling of three produced EIGHT generations, because several of them had
 * already read the old count before any of them wrote. The SQLite storage API
 * is synchronous, so the read and the write below sit in one uninterrupted
 * block and the count cannot be raced. That is the entire reason this class is
 * registered as a `new_sqlite_classes` migration.
 */
```

### workers/ask-budget.ts:69 (WHY, shortened)

why not the binding, and why synchronous; the four-run measurement goes to history.

```ts
/**
   * Per-IP burst counting, on a fixed window. One instance per IP.
   *
   * WHY NOT THE `ratelimit` BINDING, measured across four runs on this
   * deployment 2026-07-28. Twelve concurrent requests against a binding
   * configured for 5 per 60 seconds were refused 1, then 2, then 9, then 0
   * times. Cloudflare documents exactly this ("permissive, eventually
   * consistent"), and it is fine for shedding sustained load. It is not fine as
   * the only thing standing between one abusive client and the entire daily
   * budget, because a client that burns 200 answers in a burst has denied Ask
   * to every other reader for the rest of the day. That is the failure this
   * method exists to prevent, and it needs a real count rather than a hint.
   *
   * Synchronous, for the same reason `consume` is: a read and a write spanning
   * `await` inside a Durable Object is not atomic, and interleaving is what
   * made the first version of this class leak.
   */
```

## app/lib/webmention/decide.server.ts

### app/lib/webmention/decide.server.ts:5 (CONTRACT, shortened)

the pair is one door, the capability table answers two questions, and why the admin page passes no actor.

```ts
/**
 * DECIDING A MENTION, AND PURGING WHAT THAT CHANGED. One door, two callers.
 *
 * ## WHY THIS EXISTS AT ALL
 *
 * The admin page did the write and the purge as two adjacent statements in
 * three branches. That was fine while it was the only caller. The operator API
 * is now a second caller, and copying "write, then purge" into it would be a
 * second place to forget the purge, in the one feature whose whole point this
 * session was proving the purge works.
 *
 * The failure that shape produces is invisible from both ends: the write
 * succeeds and reports success, and a page that is never invalidated simply
 * stays stale for ten minutes. Nothing errors. So the pair is one function and
 * the second caller cannot take only half of it.
 *
 * ## THE CAPABILITY CHECK IS THE EXISTING TABLE, NOT A NEW ONE
 *
 * `WRITE_CAPABILITIES` already answers "may this actor write" and "may this
 * actor destroy", keyed by the actor kind so a new kind is a typecheck failure
 * rather than a silent permission. Both questions are asked here:
 *
 *   approve, reject   need `write`. Reversible: the DB layer's decidable set
 *                     holds approved and rejected alongside pending precisely
 *                     so the pair is a two-way door.
 *   delete            needs `destroy` as well. It removes the only copy of what
 *                     a stranger sent; there is no repository behind this table
 *                     and no derivation that could produce the row again.
 *
 * So the SMOKE actor is refused everything here (write: false), and the
 * OPERATOR may approve and reject and may not delete, which is exactly the
 * shape `delete_post` already has and for the same reason. Nothing about that
 * mapping is new policy; it is the existing table asked two questions.
 *
 * **THE ADMIN PAGE DOES NOT PASS AN ACTOR AND DOES NOT NEED TO.** Every
 * `/admin` write is already refused for the smoke credential by the layout
 * middleware's method allowlist, before any action runs, and the only other
 * caller of that plane is the human admin. Passing an actor there would be a
 * second enforcement point for a rule that already has one. The actor argument
 * is optional and the operator path is what supplies it.
 */
```

## app/data/publications.ts

### app/data/publications.ts:1 (CONTRACT, shortened)

why it is a data file, why access is always carried, and which year wins.

```ts
/**
 * Publication record for the CV and publications surfaces.
 *
 * Structured content edited by commit, so it lives here rather than in the D1
 * `posts` table, following the precedent set by phage-hunters.ts. PDFs are
 * committed under public/publications/ and served as static assets, which are
 * a separate limit from the Worker script size and so cost the bundle nothing.
 *
 * Every record carries `access` even though most are self-hosted, so a single
 * publication can be switched to an external link without a schema change.
 * Year is the Crossref published-print year, which is authoritative here and
 * disagrees with ORCID on four records.
 */
```

### app/data/publications.ts:42 (CONTRACT, shortened)

the precision rule and which field is the grouping key; the record count goes to history.

```ts
/**
   * The deposited date at its own precision: YYYY-MM-DD, YYYY-MM or YYYY.
   * `year` stays the grouping key; this is what `citation_publication_date`
   * needs, and 28 of the 36 records carry a day.
   */
```

### app/data/publications.ts:76 (CONTRACT, shortened)

what the sentence must be, that null is a state, and what the gate cannot enforce.

```ts
/**
   * A PLAIN-LANGUAGE LINE, written by hand, or null.
   *
   * One sentence, under 200 characters, saying what the paper found in words a
   * non-specialist reads. NOT a summary of the abstract: the abstract is already
   * on the page, and a shorter paraphrase of it in the same voice would be
   * noise. This is the sentence somebody would say out loud.
   *
   * Null on every record until Dustin writes one. The page renders it only
   * where it exists, which is why an empty field is a state rather than a gap.
   * `check:publications` enforces the length, the single sentence and the
   * house dash rule; it cannot enforce that the sentence is any good.
   */
```

### app/data/publications.ts:90 (CONTRACT, shortened)

why the field exists before any record needs it, and whose DOI it is; the survey date goes to history.

```ts
/**
   * A RETRACTION, CORRECTION OR EXPRESSION OF CONCERN, or null.
   *
   * Null on every record, and measured rather than assumed: no `updated-by`
   * and no `relation` on any of the 34 Crossref DOIs, read 2026-09-12. The
   * field exists so that the day one arrives is a data change and not a code
   * change, which is the day nobody wants to be writing this. `doi` is the
   * NOTICE's DOI: a paper carries `updated-by` pointing at the notice, and
   * the notice carries `update-to` pointing back.
   *
   * The shape and the sentence belong to `app/lib/publications/update-notice.mjs`,
   * which `check:publications` validates every record through and
   * `test/publication-update-notice.test.mjs` drives with a real retracted DOI.
   */
```

### app/data/publications.ts:109 (CONTRACT, shortened)

read from the data-availability statement only, and why a regex would be wrong.

```ts
/**
   * SEQUENCE ACCESSIONS THIS PAPER DEPOSITED, read from its own
   * data-availability statement and from nowhere else.
   *
   * Empty on every record whose journal requires no such statement. A bare
   * accession regex over a PDF returns the COMPARISON organisms' deposits, which
   * is a wrong citation rather than a missing one: the grounds, and the three
   * measured cases, are on `app/lib/publications/accessions.mjs`.
   * `check:publications` reconciles this against the extracted text in both
   * directions.
   */
```

## app/lib/media/resolvers/posts.server.ts

### app/lib/media/resolvers/posts.server.ts:5 (CONTRACT, shortened)

the coverage statement and the miss list, which is the boundary a delete depends on; the replaced artifact read goes to history.

```ts
/**
 * The POSTS resolver. The one registered content type today.
 *
 * It reads every post's markdown out of D1, drafts included, then scans each
 * body for each key. `posts.body` is the markdown both writers converge to,
 * so this is the corpus scan; the committed artifact it used to fetch from
 * GitHub is gone.
 *
 * ## Coverage, stated rather than assumed (ruling 5)
 *
 * The scan looks for the literal `/media/<key>` substring, then classifies each
 * hit by looking at the text around it. Detection is by SUBSTRING and
 * classification is by pattern, which is the right way round: a form this
 * module has never heard of is still detected, and merely lands in the `other`
 * bucket. The alternative, parsing only known syntaxes, would report an
 * unrecognised citation as no citation, and an "unused" label that is wrong is
 * worse than no label at all.
 *
 * **Detected and classified:**
 *   - `markdown-image`   `![alt](/media/posts/2026/x-1234.png)`
 *   - `figure-directive` `:::figure{src="/media/..." alt="..."}`
 *   - `frontmatter-cover` the post's `cover.src`, from the row's cover column
 *   - `link`             `[the chart](/media/...)`
 *   - `html`             `<img src="/media/...">` written raw in a post
 *   - `other`            any other text containing the URL, counted as a
 *                        citation even though the form is unrecognised
 *
 * Absolute URLs are caught too, because `https://host/media/<key>` contains
 * `/media/<key>`.
 *
 * **What it would MISS**, which is the part that matters for a delete:
 *   - a reference assembled at runtime from pieces. Nothing in this corpus does
 *     that and the markdown pipeline could not render it, but it is not
 *     detectable in principle
 *   - a citation from OUTSIDE the post corpus: another site, an already
 *     scraped social card, an email, a printed link. Nothing in this repo can
 *     know about those. That is precisely why deletion is a considered act
 *     rather than hygiene, and why ruling 2 exists
 *   - a citation COMMITTED FROM A CLONE and not yet synced: D1 lags the
 *     repository until the next sync, save, or content-drift repair, a window
 *     the scheduled health check bounds at its poll interval. The artifact
 *     read this replaces had the mirror-image window: it led D1 and trailed
 *     nothing, at a 600KB GitHub round trip per scan
 *   - the `og/` social cards, which are not scanned because they are not
 *     listed: they are build output keyed by a content hash and no post cites
 *     them by name, so a usage scan would call every one unused
 */
```

## app/lib/admin/secrets.server.ts

### app/lib/admin/secrets.server.ts:1 (CONTRACT, shortened)

presence only, the three never-returns, and the one thing check:secrets cannot see here.

```ts
/**
 * THE RUNTIME SECRETS AUDIT. PRESENCE ONLY, and that is a hard property rather
 * than a habit.
 *
 * `check:secrets` proves secrets are only READ inside the server boundary. It
 * cannot prove they are SET, because it never runs in the Worker. This answers
 * the other half, at runtime, in the one place the bindings actually exist:
 * which of the ratified secrets does this deployment hold.
 *
 * ## WHAT IT MAY RETURN, AND WHY THE SHAPE IS THE GUARANTEE
 *
 * A name and a boolean. Nothing else, ever:
 *
 *   - never a VALUE, which would publish the credential to whoever opens the
 *     page and to any log that captures the loader payload
 *   - never a PARTIAL value, no prefix, no suffix, no masked middle. A masked
 *     value still leaks its shape, and four characters of an OAuth secret is
 *     four characters an attacker no longer has to guess
 *   - never a LENGTH, which narrows a guess for free and is the leak people
 *     forget, because it does not look like the secret
 *
 * The boolean is computed and the value goes out of scope in the same
 * expression. There is no intermediate object holding it, so there is nothing
 * for a later edit to accidentally spread into the payload.
 *
 * `test/secrets-audit.test.mjs` asserts both halves: that a missing secret
 * cannot report present, and that a distinctive value handed in never appears
 * in the serialised result, in whole or in any run of four characters, and that
 * every entry carries exactly the two permitted keys.
 *
 * ## ONE THING check:secrets CANNOT SEE HERE
 *
 * That gate finds reads by matching `env.NAME` for each ratified name. This
 * module reads `env[name]` dynamically, so the scan does not count these as
 * reads. That is not a hole in the boundary: this file is a `.server` module,
 * which is what the boundary rule requires, and the dynamic form is what lets
 * the list be derived rather than restated. It is recorded because a future
 * reader comparing the gate's read count against the code will come up short
 * here and should know why.
 */
```

## app/lib/auth.server.ts

### app/lib/auth.server.ts:83 (CONTRACT, shortened)

why two marks and not one; the diagnosis goes to history.

```ts
/**
   * Optional collector. Absent on every request that did not ask for timing,
   * which is all of them but the ones being diagnosed.
   *
   * SPLIT INTO TWO MARKS ON PURPOSE. `createAuth` and `getSession` are one
   * line together and two completely different costs: the first is CPU
   * building an auth instance and a Drizzle adapter from scratch on every
   * request, the second is IO against KV. A single `auth_total` would have
   * left the next session guessing which, and guessing is what the instrument
   * exists to replace.
   */
```

### app/lib/auth.server.ts:110 (CONTRACT, shortened)

set for the human admin only, and what reading it asserts.

```ts
/**
 * Set by the admin middleware after the gate passes, so loaders under /admin
 * read the session without a second KV round trip.
 *
 * **SET FOR THE HUMAN ADMIN ONLY.** The read-only smoke credential has no
 * Better Auth session and never will, so anything reading this context is
 * asserting a human is present. That is the right failure mode for the one
 * remaining reader on a write path (`admin.posts.$slug.edit.tsx` stamps
 * `createdBy` with the signed-in address): if it were ever reached by a machine
 * actor it would throw rather than attribute a revision to nobody. It cannot be
 * reached, because the middleware refuses the method first, and a second
 * guarantee at the point of use costs nothing.
 *
 * Anything that only needs to know WHO IS ASKING reads `adminActorContext`.
 */
```

### app/lib/auth.server.ts:127 (CONTRACT, shortened)

the split, why it is not decorative, and why both kinds carry the same email.

```ts
/**
 * WHO IS ASKING, for the whole `/admin` subtree. Always set once the gate passes.
 *
 * Split from `adminSessionContext` on 2026-08-24 with the smoke credential.
 * The distinction is not decorative: one of these is a Better Auth session and
 * the other is an identity, the plane now has two kinds of caller, and only one
 * of them has a session. Collapsing them would have meant either synthesising a
 * fake `AdminSession` for the machine, which is the stub this repo refuses on
 * the grounds that it authenticates through a path production does not have, or
 * teaching every reader to handle a null session it can never see.
 *
 * `email` is present for both kinds and is the same address for both, which is
 * deliberate and is part of the stated residue: the smoke render has to be the
 * page Dustin sees, down to the topbar's widest unbreakable token, or the
 * layout numbers taken through it are numbers about a different page.
 */
```

## app/lib/timing.ts

### app/lib/timing.ts:1 (CONTRACT, shortened)

a header not a log, and that it changes no behaviour; the p50 measurement goes to history.

```ts
/**
 * Attribution for a slow route, reported as `Server-Timing`.
 *
 * A real response header rather than a log, because the question being asked is
 * about the LIVE path and a header can be read by whatever is already making
 * the request. Nothing here changes behaviour: the marks are collected and
 * emitted, and a route that never creates a collector pays nothing.
 *
 * **Why this exists.** `/blog` measured 276ms p50 against 35ms for `/` and 99ms
 * for `/phage-discovery`, both of which are also uncacheable HTML. The cause was
 * SUSPECTED to be three D1 queries and that suspicion was wrong in its details:
 * the three calls are already in a `Promise.all`, while `listBlogPosts` performs
 * three SERIAL round trips inside itself. Guessing which of those matters is
 * exactly what this replaces.
 */
```

### app/lib/timing.ts:21 (CONTRACT, shortened)

why a shared collector and why a wrapper object; the unattributed measurement goes to history.

```ts
/**
 * The per-request collector, so a MIDDLEWARE and a child LOADER can write into
 * one list and the route emits a single header.
 *
 * `/blog` needed none of this: one loader owns the whole request and can keep
 * the array in a local. The admin plane cannot, because the auth gate that runs
 * before every admin loader lives in `admin.tsx` and the queries live in child
 * routes. Without a shared collector the session lookup is measurable only by
 * subtracting one route's total from another's, which is how the 1200ms went
 * unattributed in the first place.
 *
 * Held in a WRAPPER OBJECT whose `timings` is optional, rather than as a
 * nullable context value. The context default then describes "nobody asked"
 * without the type having to admit undefined, so a route that reads this before
 * any middleware ran gets the same answer as a request without `?timing=1`.
 */
```

### app/lib/timing.ts:68 (WHY, shortened)

the instrument may not change what it measures.

```ts
/**
 * Runs `fn` and records how long it took, for a SYNCHRONOUS call.
 *
 * `createAuth()` is the reason this exists. It builds a whole Better Auth
 * instance, including the Drizzle adapter, on every admin request, and it is
 * synchronous, so wrapping it in the async `timed` would add an await to the
 * uninstrumented path as well. That would be an instrument changing the thing
 * it measures, which is the one thing an instrument may not do.
 *
 * Same contract as `timed`: no collector, no cost, and the call is returned
 * directly rather than through a promise.
 */
```

## app/lib/admin/types.ts

### app/lib/admin/types.ts:9 (CONTRACT, shortened)

two arms and the prohibition the third one broke; the removed interface goes to history.

```ts
/**
 * What a panel receives from a source that can fail.
 *
 * TWO ARMS SINCE 2026-08-25, and the third is what was removed. It was
 * `{ status: "stub"; data: T; note: string }`, and it existed so a panel could
 * render invented data while announcing that the real integration was pending.
 * Nothing renders invented data any more: the cockpit reads the health run and
 * `sync_status`, and the only remaining source, traffic, was already live or
 * error. An arm that says "this number is not real" is a licence to show a
 * number that is not real.
 *
 * `AdminDataSource` went with it. It was an interface with a `provider` field
 * naming Cloudflare, Vercel, Sentry, Recova, Foxing and Capsid, for a cockpit
 * watching one Worker: typing for a fleet that does not exist, which made the
 * page look designed rather than measured.
 */
```

### app/lib/admin/types.ts:29 (CONTRACT, shortened)

origin requests are a floor not a measure, and the number is sampling weighted; both are boundary statements.

```ts
/**
 * One row of the origin-requests panel.
 *
 * ORIGIN REQUESTS, not reads. Analytics Engine is written from the Worker's
 * response path, and with the Workers cache on, an edge HIT can serve a reader
 * without the Worker running at all. The number is therefore a count of times
 * the origin was reached, which is a floor under readership rather than a
 * measure of it, and every label on this panel says so.
 *
 * `originRequests` is SAMPLING WEIGHTED: it is `SUM(_sample_interval)`, not a
 * row count. Analytics Engine samples under load and a raw count silently
 * undercounts once it does. `rows` carries the unweighted count purely as the
 * diagnostic that shows whether sampling is engaged yet.
 */
```

### app/lib/admin/types.ts:59 (CONTRACT, shortened)

why complete exists: a missing slug is a measured zero or unknown, and the column must render them differently.

```ts
/**
 * Origin requests for the whole window, indexed by path, for the post list.
 *
 * `byPath` carries only paths that HAD activity. A slug missing from it means
 * one of two different things and the difference is why `complete` exists: with
 * `complete` true every path with activity is present, so a missing slug is a
 * measured zero; with it false the query's limit cut the result and a missing
 * slug is UNKNOWN. The column renders those two differently and must.
 *
 * The number is `SUM(_sample_interval)`, the same sampling-weighted aggregate
 * the origin-requests panel reports, and it is a FLOOR under readership rather
 * than a measure of it, for the reason `TrafficRow` states at length.
 */
```

## app/lib/blog-view.ts

### app/lib/blog-view.ts:4 (CONTRACT, shortened)

one projection so the preview's claim cannot go quietly false, and that it is pure.

```ts
/**
 * The loader payload one post page renders from, built in ONE place.
 *
 * Two routes render a post: `/blog/:slug` and `/preview/:token`. They differ in
 * exactly one respect, which is the row they are allowed to fetch; everything
 * after that is identical, and this is the "identical" written down.
 *
 * It exists because the alternative is two projections of the same row that
 * agree today. The preview's whole claim is that a reviewer sees what a reader
 * would see, and a second projection would let that claim go quietly false: a
 * column added to the public page and not to this one would show up as a
 * section missing from the preview, which is precisely the class of drift a
 * preview is supposed to make impossible.
 *
 * Pure, and it reads no clock and no environment, so the two routes cannot
 * differ by timing either.
 */
```

### app/lib/blog-view.ts:25 (CONTRACT, shortened)

why the neighbours are widened, and what disproves the inferred type.

```ts
/**
 * A blog row as either reader hands it over.
 *
 * The neighbours are WIDENED to nullable here rather than taken as `getBlogPost`
 * infers them. That function's `previous ?? null` narrows back to non-null,
 * because the array destructure it comes from is not index-checked, so its
 * inferred type says a post always has a neighbour. Every post at either end of
 * the corpus disproves that, and a draft preview has neither by design.
 */
```

### app/lib/blog-view.ts:72 (CONTRACT, shortened)

why it is top level, what types the name, and why it is derived rather than stored.

```ts
/*
     * AT THE TOP LEVEL OF THE PAYLOAD, not inside `post`, because root reads it
     * with `useRouteLoaderData` and a nested field would make root know the
     * shape of this route's `post` as well as its own name for the flag. The
     * name is the contract between the two files and nothing types it: root
     * casts what the hook returns, so `check:page-payload` asserts both
     * spellings against each other.
     *
     * Derived from the html rather than stored, so nothing has to migrate, sync
     * or stay true; `htmlHasMath` carries the argument for that, and
     * `check:content` makes it argue with the renderer's own AST flag.
     */
```

### app/lib/blog-view.ts:106 (CONTRACT, shortened)

optional because it is a migration, and what an old row degrades to; the date goes to history.

```ts
/**
         * OPTIONAL, and that is the migration rather than sloppiness. The field
         * was added to the stored blob on 2026-09-03; rows written before that
         * carry none until the next sync or save rewrites them. The renderer
         * shows it only when present, so an old row degrades to the bare title
         * it always was instead of rendering "undefined".
         */
```

## app/lib/editor/draft-buffer.ts

### app/lib/editor/draft-buffer.ts:1 (CONTRACT, shortened)

local and only local, never publishes, and the base-commit key rule.

```ts
/**
 * The editor's crash net.
 *
 * Ruling 5 of the redesign spec: save equals commit here, so autosaving to the
 * server would write git history every few seconds. The buffer is therefore
 * local and only local, and it is never the thing that publishes. Nothing in
 * this module touches the network.
 *
 * The key carries the BASE COMMIT the editor loaded against, and that is the
 * interesting part. A buffer written on top of commit A is not safely
 * restorable over content loaded from commit B: main moved, and the text the
 * author was editing may no longer be the text that is there. Rather than
 * offering a restore that would silently revert someone else's change, a buffer
 * from a different base simply does not match the key and is never offered.
 * The editor's own conflict rule refuses the save in that situation anyway, so
 * this keeps the two in step.
 */
```

### app/lib/editor/draft-buffer.ts:93 (CONTRACT, shortened)

the two key schemes and how they are told apart; the three found in a browser go to history.

```ts
/**
 * Removes buffers written under the pre-Session-2 key scheme.
 *
 * That scheme was `post-draft:<slug>` and `post-draft:new`, with no base commit
 * in the key. The current one is `post-draft:<slug>:<headSha>`, so a legacy key
 * can never match a lookup and is never offered: it is dead storage rather than
 * a hazard. Three were still in the browser on 2026-08-01, one of them for a
 * post that no longer exists.
 *
 * A slug is kebab-case and cannot contain a colon, so the two schemes are told
 * apart by counting segments: three means current, two means legacy.
 */
```

## app/lib/media/resolvers.server.ts

### app/lib/media/resolvers.server.ts:1 (CONTRACT, shortened)

the seam's cost stated so it can be judged, and the structured-result rule.

```ts
/**
 * THE RESOLVER SEAM. Shape 2 of media-module-architecture.md.
 *
 * The media core asks "who cites this key?" and content types answer. This is
 * the ONLY part that varies per content type, which is why it is the only
 * pluggable part: everything else about an object is true regardless of what
 * links to it.
 *
 * **What adding a second content type costs, stated so the seam can be judged
 * rather than trusted.** To add albums:
 *
 *   1. write `resolvers/albums.server.ts` exporting one `ReferenceResolver`
 *   2. add one line to `RESOLVERS` below
 *
 * That is the whole list. The core does not change, the media page does not
 * change, the delete action does not change, and the refusal message does not
 * change, because every one of them is written against `MediaCitation` and
 * never against posts. If a future type needed more than those two steps, the
 * seam would be wrong and should be fixed rather than worked around.
 *
 * Ruling 1: resolvers return STRUCTURED results, never booleans. A boolean
 * would have to be widened at every call site the first time a refusal needed
 * to say which post and which reference form; a structure never does.
 */
```

## app/routes/api.operator.ts

### app/routes/api.operator.ts:7 (CONTRACT, shortened)

why a resource route and why one POST taking tool and args; the MCP timing goes to history.

```ts
/**
 * The operator publish endpoint.
 *
 * A RESOURCE ROUTE, no default export, so the action can return a raw Response.
 * A document route's loader hands its return value to a component and 500s on
 * the first property read; the same reason /search/ask and the markdown twins
 * are resource routes.
 *
 * One POST endpoint taking `{ tool, args }` rather than five REST paths. The
 * shape is chosen so an MCP front end can be layered over it later without
 * reshaping anything: `tools/call` carries exactly a name and an argument
 * object. Decided 2026-07-28 to build this first and MCP after, because the MCP
 * spec shipped a breaking revision that same day and the recova precedent has
 * its MCP tools calling an operator HTTP API rather than a database.
 */
```

### app/routes/api.operator.ts:51 (CONTRACT, shortened)

metered here because this is the call that does something; the split date goes to history.

```ts
/*
   * METERED HERE, because this is the call that does something. Authentication
   * and metering split on 2026-08-28; grounds on `meterOperator`. Immediately
   * after the identity is proven, so the limiter is keyed to a real operator
   * and an unauthenticated flood cannot reach a Durable Object.
   */
```

### app/routes/api.operator.ts:98 (CONTRACT, shortened)

authenticated, spends no limit, and derived from the descriptors; the drift story goes to history.

```ts
/**
 * GET describes the tools, behind the same token.
 *
 * It is a convenience for a caller wiring itself up, and it is authenticated
 * like everything else: an unauthenticated caller learns nothing, including
 * whether the endpoint exists in a useful form.
 *
 * IT SPENDS NO RATE LIMIT, since 2026-08-28. Metering used to live inside
 * `authenticateOperator`, so describing the surface cost the same unit as
 * publishing to it: a client that read the description before each publish
 * halved its own allowance, and one that polled the description could exhaust
 * it without ever writing anything. This call takes no arguments and changes
 * nothing, so it authenticates and stops there.
 *
 * DERIVED from `TOOL_DESCRIPTORS`, never written here. This loader used to
 * carry its own copy of the list and the copy drifted exactly as rule 17 says
 * a second copy does: `sync_ask` and `sync_media` were callable and ship
 * called both, while the description a caller reads named neither. The table
 * is keyed by `ToolName`, so a tool this list omits is a typecheck failure in
 * `api.server.ts`, not a silent gap on the wire.
 */
```

## app/lib/editor/divergence.server.ts

### app/lib/editor/divergence.server.ts:1 (CONTRACT, shortened)

why KV, why one key per slug, and the eventual-consistency boundary.

```ts
/**
 * Where a recorded D1 divergence lives, and how the status surface reads it.
 *
 * ## IT IS KV, AND THAT IS THE WHOLE DESIGN DECISION
 *
 * The record says "D1 could not be written". Putting it in D1 would make it
 * absent in exactly the circumstance it exists to describe. KV is the only
 * other durable store this Worker binds that is independent of the failure.
 *
 * ## ONE KEY PER SLUG, not one list
 *
 * A single key holding an array would be a read-modify-write, and two saves
 * failing at once would lose one of the records to the race. A key per slug has
 * no race, is naturally idempotent (a second failure on the same post overwrites
 * its own entry rather than appending a duplicate), and is cleared by the repair
 * touching that slug.
 *
 * ## OBSERVATION BOUNDARY
 *
 * `listDivergences` uses KV `list`, which is EVENTUALLY CONSISTENT. A record
 * written moments ago may not appear in the next listing, so an empty result is
 * "none visible", not "none exist". That is acceptable here because the
 * operator has already been told about the divergence directly, in the error
 * that raised it; this surface is the second reader, not the first. It would
 * NOT be acceptable as the only alarm, and nothing treats it as one.
 */
```

## app/lib/health/snapshot.server.ts

### app/lib/health/snapshot.server.ts:22 (CONTRACT, shortened)

never throws, awaited rather than deferred, no expiry, and the stated degradation.

```ts
/**
 * Stores the verdict. NEVER throws, and never blocks the answer being wrong.
 *
 * A failed snapshot write must not turn a healthy site into a 500 on the one
 * endpoint the alerting workflow reads, and it must not turn an unhealthy site
 * into a different failure that hides which check broke. So the write is
 * wrapped and the catch is silent in the same shape `recordTraffic` uses in
 * `workers/app.ts`: bookkeeping never costs a caller their response.
 *
 * The consequence is stated rather than hidden: if KV is failing, the snapshot
 * ages, and the home tile reports it as stale. That is the correct degradation
 * and it is visible, which is more than the old arrangement offered.
 *
 * Awaited rather than deferred to `waitUntil`. This endpoint is `no-store`,
 * unshared and polled four times an hour, so the few milliseconds buy nothing
 * worth the second code path, and awaiting means a caller that reads the
 * endpoint and then reads the home page sees a consistent pair.
 *
 * NO EXPIRY. A snapshot that expired would report `missing`, which reads as
 * "something is misconfigured"; one that simply ages reports `stale` WITH ITS
 * AGE, which is the more useful sentence when the poller has stopped. One key
 * of about eighty bytes does not need a lifecycle.
 */
```

## app/lib/content/render-snippet.server.ts

### app/lib/content/render-snippet.server.ts:10 (CONTRACT, shortened)

why a named export is what removes it from the client build, and that the resolver refuses.

```ts
/**
 * The playground's markdown demo, as one server-only call.
 *
 * ## WHY THIS MODULE EXISTS AT ALL, measured rather than designed
 *
 * The route did the obvious thing first: `import "~/lib/content/wasm.server"`
 * at the top of `app/routes/playground.tsx`, beside the pipeline import. The
 * build REFUSED it, in as many words:
 *
 *   Server-only module referenced by client. '~/lib/content/wasm.server'
 *   imported by route 'app/routes/playground.tsx'.
 *
 * The reason is worth writing down, because the same file imports
 * `search.server` at the top and has for months. React Router removes
 * server-only code by tracing which route exports USE an import: `search` is
 * referenced only inside `loader`, so the import goes with the loader. A BARE
 * SIDE-EFFECT IMPORT BINDS NO NAME, so there is nothing to trace, nothing to
 * attribute to `loader`, and the only safe conclusion the bundler can draw is
 * that the client needs it.
 *
 * So the side effect moves behind a named export, which is the same mechanism
 * that already worked, applied to the thing that could not use it. The route
 * imports `renderSnippet`, uses it only in its loader, and the whole chain
 * leaves the client build together.
 *
 * ## THE RESOLVER REFUSES, and that is this module's other job
 *
 * `renderBody` takes an image resolver. The playground's snippets cite no
 * media and none may: the alternative is a resolver reaching a bucket from a
 * public page on behalf of committed fixture text, which is a door this demo
 * has no reason to open. Refusing here rather than in the route means the
 * refusal cannot be forgotten by the next caller, and `check:features`
 * asserts the same thing about the snippets themselves so the failure names
 * the snippet rather than the render.
 *
 * @param slug the snippet's slug, used only to label a refusal
 * @param body the committed snippet source
 */
```

## app/lib/editor/feedback.ts

### app/lib/editor/feedback.ts:1 (CONTRACT, shortened)

why the URL carries a success, why a failure cannot, and that everything parsed is untrusted.

```ts
/**
 * The editor's one feedback slot: what it can say, and how a success survives
 * the redirect.
 *
 * A save is post/redirect/get, so the outcome has to cross a navigation. It
 * crosses in the URL rather than in a flash cookie or session store, for three
 * reasons: it needs no server state, it renders identically with scripting off,
 * and a reload re-renders the same message instead of re-posting the form.
 *
 * A FAILURE cannot travel this way, because a redirect would throw away the
 * body the author just typed. Failures stay in the action result. That is the
 * one asymmetry in the slot, and both sources feed the same component, so there
 * is still exactly one place a save can speak from.
 *
 * Everything parsed here is treated as untrusted: the address bar is editable.
 * A value that does not match its shape is dropped rather than rendered, which
 * is why the shas and the date are pattern-checked and the slug is never read
 * from the query at all.
 */
```

### app/lib/editor/feedback.ts:28 (CONTRACT, shortened)

what the two fields are and why they are optional; the date goes to history.

```ts
/**
   * `field` and `line` come from `EditorError`, which has carried both since it
   * was written and had no way to reach a human until 2026-09-03: the routes
   * copied `message` and `conflict` and dropped the two values that say WHERE.
   * Optional because most refusals have neither; the display renders what it is
   * given and says nothing when it is given nothing.
   */
```

## app/routes/theme.ts

### app/routes/theme.ts:17 (WHY, shortened)

origin first, and the absent-Origin allowance the no-script half needs; the measurement goes to history.

```ts
/*
   * ORIGIN FIRST, before the body is even read.
   *
   * A POST here sets a cookie, so it is a mutating route and takes the same
   * predicate `/search/ask` and the admin plane take. Measured 2026-08-27: a
   * POST carrying `Origin: https://evil.example` set the theme cookie.
   *
   * AN ABSENT ORIGIN IS STILL ALLOWED, and that is the whole reason this
   * predicate exists rather than a same-origin comparison written inline: this
   * form is the NO-SCRIPT half of the theme toggle, a scriptless form post
   * carries no `Origin`, and refusing it would break the fallback hard rule 9
   * requires. The literal string "null" is a different thing and is refused;
   * grounds on the predicate.
   */
```

### app/routes/theme.ts:42 (WHY, shortened)

a refusal rather than a default, and why the refusal is no-store; the date goes to history.

```ts
/*
   * ONLY THE WRITABLE THEMES ARE ACCEPTED, since 2026-08-29.
   *
   * This substituted a default for anything it did not recognise, which is the
   * fail-open direction hard rule 13 is about: a malformed request became a
   * silent theme change rather than an error.
   *
   * A REFUSAL RATHER THAN A DEFAULT. Nothing legitimate reaches this branch,
   * because the control posts the value of the button that was visible and both
   * of its buttons carry a writable theme. A request arriving with anything else
   * is hand-made, and 400 tells its author the truth instead of quietly writing
   * a cookie they did not ask for.
   *
   * `no-store` for the same reason the origin refusal above carries it: a
   * refusal that could be cached is a refusal served to somebody else.
   */
```

## app/routes/blog.feed[.json].ts

### app/routes/blog.feed[.json].ts:7 (CONTRACT, shortened)

the shared visibility read, where the shape is asserted, and why the cap is in the query.

```ts
/**
 * JSON Feed 1.1, alongside RSS.
 *
 * Reads through listBlogPostsFullText, so publiclyVisible() applies on exactly
 * the same terms as the index, the RSS feed and llms-full.txt. Each item is
 * built by `feedItem` in app/lib/json-feed.mjs, where `node:test` asserts the
 * shape: this file once promised `content_text` in a comment while the item
 * map emitted no content field at all, which JSON Feed 1.1 forbids, and no
 * gate could see a comment disagreeing with a map three lines under it.
 *
 * The cap is applied in the query, not by slicing a full read, because every
 * item now carries its whole markdown body.
 */
```

### app/routes/blog.feed[.json].ts:44 (NUMBER, shortened)

why the content type is not the SHOULD, with the size that decided it; the grounds stay beside the header.

```ts
/*
       * `application/json`, NOT `application/feed+json`, and the reason is
       * 160 KB.
       *
       * JSON Feed 1.1 says the content type SHOULD be `application/feed+json`.
       * It is a SHOULD, and this is what obeying it cost, measured on
       * production 2026-08-27 with `Accept-Encoding: br, gzip`:
       *
       *     /blog/rss.xml    application/rss+xml    Content-Encoding: br
       *     /blog/feed.json  application/feed+json  none, 160,577 bytes
       *
       * Cloudflare compresses a fixed list of content types and `+json`
       * suffixed types are not on it, so the largest response on the site was
       * the only one shipping raw. Every reader identifies this document by the
       * `version` member inside it, which is unchanged; the content type is how
       * it travels. Trading a SHOULD for what a subscriber actually downloads
       * is the right way round.
       */
```

## app/data/organisms.ts

### app/data/organisms.ts:1 (CONTRACT, shortened)

an allowlist, the ordering and case rules, and the reviewed exclusions, which ARE the decision.

```ts
/**
 * Organism names to italicize when rendering publication titles and abstracts.
 *
 * A reviewed allowlist, not a pattern. Matching on "Capitalized lowercase"
 * pairs would italicize Rio Grande, Cancer Handbook, Phage Therapy and dozens
 * of ordinary sentence openings, so every entry here was read in context first.
 * Derived by auditing the stored titles and abstracts, not from memory.
 *
 * Order matters: longest first. The matcher takes the first alternative that
 * fits, so "Meleagris gallopavo intermedia" has to precede "Meleagris
 * gallopavo" or the subspecies epithet is left upright.
 *
 * Matching is case sensitive, so the genus capital is required. That is what
 * keeps the bare genus "Mycobacterium" from colliding with ordinary prose.
 *
 * Deliberately NOT included:
 *
 * - Virus agent names: reticuloendotheliosis virus, fowlpox virus,
 *   lymphoproliferative disease virus, human T-cell leukemia virus. ICTV
 *   italicizes formal taxa, not vernacular agent names, and these titles use
 *   the agent form throughout.
 * - Phage isolate names: Arlo, Fizzles, Finny, Loca, Godfather, Ryadel,
 *   Zeuska, Tripl3t, IndyLu, MrAaronian, Joy99, Didgeridoo, Quaker, Squash.
 *   Those are strain names, which stay upright.
 * - "Rhesus macaques", a common name rather than a binomial, and "Rho family",
 *   which is a protein family.
 * - "Siphoviridae", which appears 3 times. It is a formal ICTV family-rank
 *   taxon rather than an agent name, so it arguably belongs here, but that is
 *   a judgement call left open rather than made silently.
 */
```

## app/components/admin/disclosure.ts

### app/components/admin/disclosure.ts:3 (CONTRACT, shortened)

why it is shared, why the disclosure stays markup, and the ARIA ruling.

```ts
/**
 * The three behaviours a bare `<details>` disclosure does not have.
 *
 * EXTRACTED 2026-09-10, when the row kebab was added. It was the whole body of
 * `OverflowMenu`'s effect and it is now shared with `RowMenu`, because the
 * alternative was two implementations of Escape, arrow keys and close-on-
 * outside-click that would drift the first time one of them was fixed. Neither
 * component's markup changed, so `check:admin-ui`'s fixture is untouched.
 *
 * The disclosure itself stays markup. What hides behind these controls are
 * REPAIR operations, which is exactly the set you reach for when something is
 * already broken, so opening one must not require script. As markup it opens,
 * closes and reports its own expanded state with nothing loaded; this only adds
 * the keyboard and dismissal manners on top.
 *
 * ARIA: deliberately a DISCLOSURE, not `role="menu"`. Every item is a submit
 * button inside its own form, and a `role="menu"` container owes `menuitem`
 * children it directly owns; interleaving forms breaks that, and the menu roles
 * would suppress the native button semantics the items already have. APG says
 * to use a disclosure once the contents are form controls, so `<summary>`
 * carries the name and the expanded state and nothing overrides it.
 *
 * @param ref The `<details>` element this manages.
 */
```

## app/routes/admin.preview.ts

### app/routes/admin.preview.ts:9 (CONTRACT, shortened)

one renderer, read-only despite the POST, and that it is behind the admin gate.

```ts
/**
 * The exact preview, per ruling 3.
 *
 * It renders a submitted body through `app/lib/content/pipeline.mjs`, the same
 * module the build script and the Worker import. There is one renderer on this
 * site and this route does not become a second one: it calls `renderBody` and
 * returns what comes back, unmodified. The preview is what publishes rather
 * than an approximation of it, which is the only reason a preview is worth
 * having on a site whose two writers must render identically.
 *
 * READ ONLY, and that is worth being precise about because it is a POST. It
 * takes markdown in and hands HTML back. It touches no database, writes no
 * file, commits nothing, and reaches R2 only to MEASURE images the body already
 * references. The redesign ruling names this case: a read-only render route is
 * not a new write path.
 *
 * It sits under `/admin`, so the layout middleware has already required the
 * single-admin session before this runs. There is no unauthenticated way to
 * make the Worker render arbitrary markdown.
 */
```

### app/routes/admin.preview.ts:36 (CONTRACT, shortened)

the same transform from the same module; the 14-byte measurement goes to history.

```ts
// THE SAME transform the save path applies, from the same module, so the two
  // cannot drift again. A multipart body arrives with every newline normalized
  // to CRLF; rendering that raw is what made the preview differ from the
  // published artifact by 14 bytes on the fixture post.
```

### app/routes/admin.preview.ts:53 (WHY, shortened)

why a preview failure is a 200.

```ts
// A preview failure is ordinary: the author is mid-sentence and the
    // directive is half typed. It reports the pipeline's own message and a 200,
    // because the REQUEST succeeded; it is the content that is not ready. A
    // non-2xx here would make the client treat a routine typo as a broken
    // endpoint and stop previewing.
```

## app/lib/webmention/advertise.ts

### app/lib/webmention/advertise.ts:3 (CONTRACT, shortened)

two readers one address, and why SITE_ORIGIN rather than the request's.

```ts
/**
 * WHERE THIS SITE SAYS ITS WEBMENTION ENDPOINT IS. Item H2.
 *
 * ## TWO READERS, ONE ADDRESS
 *
 * A post advertises the endpoint twice, because senders look in two places: a
 * `Link` header, which a sender can read from a HEAD request without parsing
 * anything, and a `<link rel="webmention">` in the head, which is what a sender
 * that already has the document reads. Both are the protocol's own discovery
 * order and neither is optional if the other exists, since a sender that finds
 * one and not the other concludes the site changed its mind.
 *
 * They are one constant here for the ordinary reason: two spellings of an
 * address is an address that goes half-stale. The `Link` header and the meta
 * tag on `/blog/:slug` both read this.
 *
 * ## `SITE_ORIGIN`, AND THAT IS THE TWIN'S CHOICE RATHER THAN A NEW ONE
 *
 * `linkToMarkdown` in `app/lib/markdown-twin.ts` builds the other `Link` value
 * on this route from `SITE_ORIGIN`, so the two values in one header now name
 * the same host by construction. Deriving this one from the REQUEST's origin
 * instead would put two different hosts in one header during the cutover, which
 * is the window where a sender is most likely to be reading it for the first
 * time.
 *
 * The endpoint's own `siteOrigins` accepts both spellings on the way IN, which
 * is the asymmetry that makes this safe: this site advertises one address and
 * answers to two.
 */
```

## app/data/phage-hunters.ts

### app/data/phage-hunters.ts:1 (CONTRACT, shortened)

why it is a data file, the neutral-alt ruling, why alt is not empty, and the names ruling.

```ts
/**
 * Year-by-year roster of the SEA-PHAGES research cohort at Tarleton State.
 *
 * Structured content edited by commit, so it lives here rather than in the D1
 * `posts` table, whose single body column would flatten the structure. Photo
 * dimensions are the real output of scripts/resize-phage-photos.mjs and differ
 * by year, so they are recorded per photo to keep layout shift at zero.
 *
 * ALT TEXT IS DELIBERATELY NEUTRAL, 2026-08-02. It used to name the program
 * ("Tarleton State University phage discovery research group"). Those nine
 * strings were the only subject-matter language rendered anywhere on the public
 * site, on a page whose whole point is that it carries names and nothing else,
 * so they were the last thing left to remove. "For now": if descriptive copy
 * returns to this page, the alt text is part of that decision.
 *
 * It is not emptied, because these photos are half the page's content rather
 * than decoration, and `alt=""` on a content image is a WCAG failure.
 *
 * THE NAMES ARE AS GIVEN, and there is no open question about any of them.
 *
 * A TODO stood here guessing that the 2018 entry "Matthew Bristerpostma" was
 * "likely Brister-Postma, pending confirmation". Removed 2026-09-11 by
 * Dustin's ruling: the name is the name. A speculative respelling of a real
 * person's name, published on the page that lists them, is a worse error than
 * an unhyphenated one, and a comment inviting the next reader to make that
 * edit is the same error with a delay on it.
 */
```

## app/lib/context.ts

### app/lib/context.ts:16 (CONTRACT, shortened)

why a nonce cannot be an exit-path mutation, and why it is its own context.

```ts
/**
 * The per-request CSP nonce.
 *
 * **This is the one piece of response policy that is NOT an exit-path
 * mutation, and that is worth understanding before touching it.** `UNCACHED`
 * and `SECURITY_HEADERS` in `workers/app.ts` are stamped onto a finished
 * response; they need to know nothing about the render. A nonce cannot work
 * that way: the same value has to appear in the `Content-Security-Policy`
 * header AND on every `<script>` in the body, so it must exist BEFORE the
 * render and be readable from inside it.
 *
 * Hence a context, set by the Worker entry beside `cloudflareContext` and read
 * by the root loader, which hands it to `<Scripts nonce>` and
 * `<ScrollRestoration nonce>`. React Router propagates it to the scripts it
 * generates from there.
 *
 * A separate context rather than a field on `cloudflareContext`, because the
 * nonce is not a binding and every existing `getEnv` call site would otherwise
 * have to learn about it.
 */
```

## app/lib/nav.ts

### app/lib/nav.ts:1 (CONTRACT, shortened)

one consumer, and the mirror that is now unrepresentable; the dated second reader goes to history.

```ts
/**
 * THE HEADER'S LINKS, in one place.
 *
 * `site-header.tsx` renders a NavLink per entry. It is the ONLY consumer, and
 * that is a change: from 2026-08-27 until 2026-08-28 `site-speculation.tsx`
 * also read this list, through an exported `HEADER_PATHS`, to build a
 * Speculation Rules `urls` payload.
 *
 * **THAT SECOND CONSUMER IS GONE, AND SO IS THE MIRROR IT CREATED.** The rules
 * are document rules now (`~/lib/speculation.mjs`): they match the links in the
 * rendered document rather than a list of paths, so a header link is covered
 * because it is an `<a href>`, not because someone kept two arrays in step. The
 * drift this module was written to prevent, a nav link with no speculation
 * entry or an entry whose link had been removed, is not merely gated now, it is
 * unrepresentable.
 *
 * `HEADER_PATHS` was deleted with it. A derived export whose only reader has
 * gone is dead configuration that reads as load-bearing, which is worse than
 * either keeping it honest or removing it.
 *
 * Roster's LABEL and its PATH deliberately disagree; see site-header.tsx.
 */
```

## app/routes/publications[.json].ts

### app/routes/publications[.json].ts:6 (CONTRACT, shortened)

why this export is unfiltered, and why it comes from the source file.

```ts
/**
 * The whole corpus as CSL JSON.
 *
 * ## ALL 36, NOT THE SHOWCASE 33
 *
 * The only export that is not filtered, and the reason is what CSL IS. BibTeX
 * and RIS are for putting citations in a document, where listing a conference
 * abstract beside the paper it became double-counts a work. CSL JSON is the
 * BIBLIOGRAPHIC RECORD, and the record is the record: a consumer asking for
 * this file is asking what exists, not what the index chose to display.
 *
 * ## STRAIGHT FROM THE SOURCE FILE
 *
 * `data/publications.csl.json` already IS CSL JSON, so this imports it rather
 * than rebuilding one from `publications.ts`. Rebuilding would be a second,
 * lossier derivation of something the repo holds canonically: the source
 * carries fields the site never renders, and those belong in this file.
 *
 * The one transformation is decoding character references, and `toCslJson`
 * states why: the stored escapes are a property of this site's markup, not of
 * the bibliographic record, and a reference manager importing `p &lt; 0.05`
 * shows a reader those characters.
 */
```

## app/lib/editor/link-targets.server.ts

### app/lib/editor/link-targets.server.ts:5 (CONTRACT, shortened)

one module, every post is offered with its state, and why stateOf is called on the server.

```ts
/**
 * The posts the editor's Cmd+K palette can link to.
 *
 * ONE module, because both the edit route and the new-post route need the same
 * list and a second derivation is how the two would come to disagree about
 * which posts are public.
 *
 * **Every post is offered, including the ones that are not live, and each
 * carries its state.** Offering only published posts would have been the safe
 * default and it is the wrong one: a series links forward to a part that is
 * still scheduled, and an author who cannot find it in the palette will paste
 * the path from memory instead, which is the case that actually produces a typo.
 * What must not happen is inserting a link that 404s WITHOUT SAYING SO, so the
 * state travels with the target and the palette marks it.
 *
 * `stateOf` is the editor's own transition module, the same one the edit route
 * uses to decide what its primary button says, so "published" here means
 * exactly what it means everywhere else on this plane. It reads the clock, so
 * it is called HERE, on the server, and never during a render.
 */
```

## app/lib/auth-rate.server.ts

### app/lib/auth-rate.server.ts:11 (WHY, shortened)

fails closed, what that costs, and the separate key prefix; the three past catches go to history.

```ts
/**
 * True when this request may proceed to Better Auth.
 *
 * ## FAILS CLOSED when the limiter binding is absent
 *
 * Same stance as `checkAskRate` and `authenticateOperator`, and for the same
 * reason: a guard that silently passes because it could not run is the failure
 * this project has been caught by three times. Removing the Durable Object from
 * `wrangler.jsonc` therefore DISABLES sign-in rather than un-protecting it.
 *
 * That is a real cost and it is the right one. The alternative is that the one
 * configuration mistake nobody would notice is the one that removes the guard,
 * and an admin who cannot sign in notices immediately.
 *
 * ## ONE INSTANCE PER IP, under its own key prefix
 *
 * `auth:` rather than the `ip:` that Ask uses, so the two limits are separate
 * counters. Sharing the prefix would let a burst of questions from a reader's
 * network consume the sign-in allowance for that address, which is a coupling
 * nobody would predict from either file.
 */
```

## app/routes/blog.rss[.xml].ts

### app/routes/blog.rss[.xml].ts:7 (CONTRACT, shortened)

one feed policy, the shared visibility read, the cap in the query, and who owns the escaping.

```ts
/**
 * RSS 2.0, and since 2026-08-28 it carries the whole post.
 *
 * ONE FEED POLICY. The JSON feed has served full content since it shipped and
 * this one served a one-line description, so the same corpus reached a
 * subscriber differently depending on which URL they happened to paste. Both
 * now read the same query with the same visibility predicate and the same cap;
 * only the REPRESENTATION differs, markdown for the JSON consumer and rendered
 * HTML for the reader, and `app/lib/rss-feed.mjs` says why.
 *
 * Reads through listBlogPostsRendered, so publiclyVisible() applies to the feed
 * on exactly the same terms as the index. The cap is applied IN THE QUERY, not
 * by slicing a full read, because every item now carries a rendered body.
 *
 * The item markup is built by `rssItem`, where `node:test` can reach it,
 * exactly as `feedItem` is for the JSON feed. That module is also the one owner
 * of the XML escaping, which used to live here and in nothing else, so the two
 * feeds' escaping could not be compared.
 */
```

## app/lib/client-ip.ts

### app/lib/client-ip.ts:1 (CONTRACT, shortened)

one statement of the identity, why the header is trustworthy, and the JUSTIFIED SUBSTITUTION marker a gate counts.

```ts
/**
 * The client IP every rate limiter keys on, stated once.
 *
 * EXTRACTED 2026-08-25 from five identical inline reads (the auth callback,
 * the CSP report sink, the login action, the preview middleware and the Ask
 * endpoint). Five spellings of a rate-limit identity is rule 17's shape in the
 * one place drift is least affordable: an edit to one copy silently changes
 * WHO one door counts, and the other four keep counting someone else, which is
 * the N-1-of-N failure FAILURES.md opens with. Every body was the identical
 * expression, so this is a verbatim lift, not a rewrite.
 *
 * `cf-connecting-ip` is set by the Cloudflare edge on every request that
 * reaches a Worker and cannot be spoofed by the client. Absent only off the
 * edge, where `unknown` funnels every such caller into one shared counter,
 * which is the strict direction rather than the lax one: they share one bucket
 * instead of each getting their own.
 *
 * JUSTIFIED SUBSTITUTION (hard rule 13): the fallback substitutes a value, and
 * the substitution fails CLOSED. A missing header collapses all such traffic
 * into one rate bucket that exhausts quickly, rather than minting each caller
 * a fresh identity.
 */
```

## app/routes/llms-full[.txt].ts

### app/routes/llms-full[.txt].ts:6 (CONTRACT, shortened)

why it is composed at request time: the document depends on the clock.

```ts
/**
 * The full-text companion to llms.txt: every published post's markdown source in
 * one document, so a model can read the whole blog in a single fetch instead of
 * crawling it a page at a time.
 *
 * Composed from D1 at request time rather than emitted as an artifact, for
 * one concrete reason: this document depends on the clock. A post scheduled
 * with a future publish_at must be absent today and present next week. A
 * generated document cannot express that. It would either carry a timestamp,
 * in which case its byte gate would start failing the moment a scheduled post
 * went live, or it would ignore publish_at, in which case it leaks
 * unpublished writing. (The post corpus reached the same conclusion later,
 * for its own reasons: D1 is the only rendered copy site-wide now.)
 *
 * Composing here removes the drift rather than gating it: there is no second
 * copy that can disagree. The markdown itself is still gated, because it comes
 * from the same `posts.body` the generator wrote.
 */
```

## app/routes/robots.ts

### app/routes/robots.ts:16 (CONTRACT, shortened)

robots.txt is advisory and neither line is the control; both boundary statements stay.

```ts
/*
   * `/preview` is HYGIENE, and saying so here matters more than the line does.
   *
   * robots.txt is advisory: it asks well-behaved crawlers not to fetch, and
   * anything that ignores it fetches anyway. The CONTROL on draft previews is
   * `X-Robots-Tag: noindex, nofollow` plus `Cache-Control: private, no-store` on
   * the route itself, which are instructions to whatever actually arrives. This
   * line exists so a compliant crawler that somehow learns a token URL does not
   * spend a request on it, and for no stronger reason than that.
   *
   * `/search/ask` is disallowed for a DIFFERENT reason, and the difference is
   * worth keeping straight. It is not private, it is EXPENSIVE: every answer
   * spends a per-IP allowance and one of a capped number of daily generations.
   * The control is that the endpoint takes POST and refuses GET with a 405, so
   * nothing that merely follows a URL can spend anything. This line is the
   * courtesy on top, and on its own it would be worth very little.
   */
```

## app/routes/llms.ts

### app/routes/llms.ts:7 (CONTRACT, shortened)

the fallback is the content file, and .gitattributes is what keeps it byte-identical; the CRLF drift goes to history.

```ts
/**
 * What to serve when the `llms.txt` settings row is absent.
 *
 * This used to be a 60-line template literal carrying a hand-maintained copy of
 * the row, under a comment reading "If you change one, change the other". It had
 * already drifted: measured 2026-08-02, the literal was byte-identical to the
 * live row EXCEPT that it carried 62 CRs, because this .ts file is CRLF on a
 * Windows checkout while the D1 row is LF. The site therefore served different
 * bytes depending on whether the row existed, and nothing could see it.
 *
 * It is now the content file itself, inlined by Vite at build time, so the
 * fallback cannot drift from what the sync writes. `content/llms.txt` is pinned
 * to LF in .gitattributes, which is what keeps the inlined copy and the row
 * byte-identical on every platform.
 */
```

## app/routes/publications[.bib].ts

### app/routes/publications[.bib].ts:6 (CONTRACT, shortened)

the showcase filter applies here and not per paper, and why there is no attachment disposition.

```ts
/**
 * The whole list as BibTeX.
 *
 * ## THE WHOLE LIST MEANS THE WHOLE RENDERED LIST
 *
 * The showcase filter applies, so this is the 33 works the index shows rather
 * than all 36. The three excluded are conference abstracts whose papers are
 * also in the corpus, and a bibliography carrying both the meeting abstract and
 * the paper it became double-counts the same work in a reference manager, which
 * is a harder mistake to notice than a missing entry.
 *
 * The per-paper exports are NOT filtered, because asking for one record's
 * BibTeX is asking for that record.
 *
 * ## A RESOURCE ROUTE, NOT A DOWNLOAD
 *
 * No `Content-Disposition: attachment`. A citation file is something people
 * look at as often as they save it, and a browser that downloads a 40 KB text
 * file the reader wanted to glance at is a worse outcome than one that shows
 * it. Reference managers key on the content type, not the disposition.
 */
```

## app/lib/content/wasm.server.ts

### app/lib/content/wasm.server.ts:8 (CONTRACT, shortened)

why the Node default cannot be used in a Worker, and why the type is loose.

```ts
/**
 * Teaches the shared pipeline how to load oniguruma inside a Worker.
 *
 * Workers refuse `WebAssembly.instantiate()` on raw bytes ("Wasm code
 * generation disallowed by embedder"), which is what `import("shiki/wasm")`
 * ends up doing, so the Node default cannot be used here. A module imported
 * statically is already compiled, and instantiating one of those is allowed.
 *
 * Import this module for its side effect, before anything renders.
 *
 * Typed loosely on purpose: the Cloudflare Vite plugin resolves the `.wasm`
 * import to a `WebAssembly.Module` at build time, and the Worker tsconfig does
 * not carry DOM's WebAssembly value declarations.
 */
```

## app/routes/api.auth.$.ts

### app/routes/api.auth.$.ts:8 (CONTRACT, shortened)

what the limit actually caps, and why both exports are guarded; the audit date goes to history.

```ts
/**
 * Catch-all for Better Auth. Every `/api/auth/*` request is handed to the auth
 * handler, AFTER the rate limit.
 *
 * The limit was absent until 2026-08-23 and the audit was right about it. What
 * it caps is the outbound call: every hit on the Google callback makes this
 * Worker perform a token exchange against Google before `signIn.before` can
 * reject a non-admin address, so an unbounded endpoint is an amplifier pointed
 * at a third party using our OAuth client. Numbers and reasoning are in
 * `auth-rate.mjs`.
 *
 * BOTH EXPORTS ARE GUARDED, and that is not belt-and-braces. Better Auth routes
 * by method as well as path: the Google callback arrives as a GET and reaches
 * `loader`, while `sign-in/social` and `sign-out` are POSTs and reach `action`.
 * Guarding one would leave the other open, and the callback is the expensive
 * half.
 */
```

## app/routes/blog.series.$series.rss[.xml].ts

### app/routes/blog.series.$series.rss[.xml].ts:10 (CONTRACT, shortened)

the three rules that make a series feed differ: order, no cap, and 404 agreement.

```ts
/**
 * One series' RSS feed, through `rssDocument`, the builder the blog feed and
 * the tag feeds already use. Nothing about the channel, the namespaces or the
 * item markup is restated here.
 *
 * ORDERED BY PART, not by date, which is the one way this differs from every
 * other feed on the site and is the whole point of a series: a subscriber
 * should receive part one first. `listBlogPostsRendered` takes the order from
 * its caller for exactly this case.
 *
 * NO CAP. The other feeds take the newest twenty because a blog is unbounded; a
 * series is a finite thing an author numbered, and truncating it would drop the
 * later parts, which are the ones a reader following along has not read.
 *
 * 404 ON AN UNKNOWN SERIES, through `getBlogSeries`, which is the page's own
 * test: a feed and its page must agree about whether a series exists.
 */
```

## app/routes/blog.$slug[.md].ts

### app/routes/blog.$slug[.md].ts:24 (CONTRACT, shortened)

one representation, so nothing for a Cookie dimension to collapse against; the date and the grounds pointer stay.

```ts
/*
   * PUBLICLY CACHED, since 2026-08-26. This URL has exactly one
   * representation, so there is no second variant under its key and nothing
   * for a Cookie dimension to collapse against. It was `private, no-store`
   * only because it shared a function with the negotiated representation under
   * `/blog/:slug`, which genuinely must not be stored; the grounds and the
   * measurement are on `markdownResponse`.
   *
   * This is the machine-readable surface `llms.txt` advertises and every post
   * announces in a `Link` header, so every agent fetch was an origin render.
   */
```

## app/routes/blog.tags.$tag.rss[.xml].ts

### app/routes/blog.tags.$tag.rss[.xml].ts:10 (CONTRACT, shortened)

the shared builder and the 404 agreement.

```ts
/**
 * One tag's RSS feed. The SAME document builder as `/blog/rss.xml`.
 *
 * Nothing about the channel, the namespaces or the item markup is restated
 * here: `rssDocument` owns all of it and `rssItem` owns the entries, so this
 * route is a query, a title and a self URL. A second feed that copied the
 * wrapper would be a second place the content namespace or the version string
 * could be wrong, and a feed reader is the last surface where that gets noticed.
 *
 * 404 ON AN UNKNOWN TAG, through `getBlogTag`, which is the page's own test.
 * A feed and its page must agree about whether a tag exists, or a subscriber
 * can hold a working feed URL for an archive that answers 404.
 */
```

## app/routes/blog.atom[.xml].ts

### app/routes/blog.atom[.xml].ts:7 (CONTRACT, shortened)

RSS remains advertised, and the two dialects cannot carry different posts.

```ts
/**
 * Atom 1.0 for the blog, from the SAME rendered rows RSS reads.
 *
 * RSS REMAINS THE ADVERTISED FEED. Root's `links` are unchanged and nothing
 * points here yet by default; this exists because Atom is what most
 * feed-validating tooling and a handful of readers prefer, and because the cost
 * is one query it already makes. Same `listBlogPostsRendered`, same visibility
 * predicate, same cap, so the two dialects cannot carry different posts.
 *
 * The dialect differences live entirely in `atom-feed.mjs`, which states which
 * of them the spec requires rather than leaving them as unexplained markup.
 */
```
