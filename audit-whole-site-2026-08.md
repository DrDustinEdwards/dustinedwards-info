# Whole-site flagship audit

- **Subject:** DrDustinEdwards/dustinedwards-info at `3e1834d` (`main`)
- **Live origin probed:** `https://dustinedwards.dustin-edwards.workers.dev`
- **Date:** 2026-08-26
- **Auditor:** Grok, read-only on `main`. Report-only commit on `review/whole-site-2026-08`.
- **Finding count:** 28 (0 blockers, 11 serious, 14 minor, 3 taste)
- **Previous 2026-08-25 blog/media findings:** all four confirmed fixed (JSON Feed `content_text`, GitHub 1 MB artifact-read cliff, public-plane hydration, media key-guard mismatch). Not restated.

Every claim below was checked against the repo at `3e1834d` and, where it is a wire claim, against a live fetch on 2026-08-26. A finding without `file:line` or a URL plus observed bytes/headers is not included.

## 1. Verdict table

| Area | Verdict | Comparison target | Top finding |
| --- | --- | --- | --- |
| 1. Public reading plane | flagship | Jake Archibald / web.dev strict CSP (nonce + `strict-dynamic`); IndieWeb feeds and colophon | Shared-cache nonce reuse and plaintext cache HITs remain, both already ruled as cutover work |
| 2. Performance | competent | web.dev Core Web Vitals 2026 (LCP 2.5 s, INP 200 ms, CLS 0.1); Calibre Slow 4G mobile profile | Home LCP 4096 ms / TTFB 2693 ms on throttled miss because the loader runs the full health suite |
| 3. Accessibility | competent | WCAG 2.2 AA | Heading permalinks at `opacity: 0.55` are 2.53:1 light / 3.22:1 dark; gate cannot see this |
| 4. Blog pipeline | flagship | Eleventy content collections + a byte-gated build | Related posts skip `publiclyVisible()`; scheduled or withdrawn titles can leak |
| 5. Media | left field | Cloudflare Images + a markdown `srcset` helper | Full library, trash, queue, width ladder, and ~4,300 lines of admin CSS/route for a corpus with zero body images |
| 6. Search and Ask | flagship | Typesense/Meilisearch for classic; 2026 OpenAI RAG checklists for Ask | Live Ask stream does not re-check citation visibility (cache hits do) |
| 7. Admin and auth | competent | Better Auth 1.6; OWASP ASVS 5 (session / CSRF) | `/admin/*` POSTs rely on `SameSite=Lax` only; `workers.dev` siblings are same-site |
| 8. Operator API | flagship | OWASP API Security 2023 (broken object auth, credential stuffing) | Token compare is constant-time; a leak can unpublish and rewrite git, not first-publish or destroy |
| 9. Health, ship, CI, gates | flagship | Google SRE (error budget, probes that match user pain) | Ship proves HTML 200 on `/colophon`, not `/api/health` |
| 10. Data layer | flagship | Cloudflare D1 FTS5 guidance; per-table export, not `d1 export` | Derived stores rebuild; authored media columns and future R2 originals do not |
| 11. Code quality | competent | TypeScript `strict` shops; kernel-style "comment the invariant" | 22 files over 800 lines; comments narrate session history |
| 12. Dependencies | competent | npm 2026 (`npm ci`, lockfile integrity, pin auth) | `better-auth` and `wrangler` are caret-ranged; lockfile `engines` still says `>=22.22.0` |
| 13. Privacy | deficient | ICO privacy notice; UK GDPR Arts. 13–14 | No privacy page. Analytics Engine, Ask, CSP reports, and the theme cookie are undocumented to the reader |
| 14. Content accuracy | deficient | GOV.UK "keep it accurate" | `/colophon` still indexes `features.json` sentences about a committed byte-gated artifact |
| 15. Bloat | competent | "would the best engineer copy this" | Delete list is small; the fat is an unused upload plane and gate novels |
| 16. AI-defect catalogue | competent | OWASP LLM Top 10; typical agent-coding residue | Few leftover endpoints or weakened auth; residue is slack floors, copied origins, and historical comments |

**Left field, named (area 5).** Cloudflare Images practice is: store originals, transform on request, generate `srcset` from a width list, stop. This repo also has an admin library, trash vs delete, typed empty-trash, a queue consumer, reconciliation (R2 wins), and a media index with authored alt/caption/focal/tags. **Buys:** a template other sites can copy, and a delete path that cannot fail open the way the 2026-08-25 unauthenticated delete did. **Costs:** ~4,300 lines of admin CSS plus `admin.media._index.tsx` (2,141 lines) guarding a production load of zero body images. Keep the architecture; stop growing it until one post cites an R2 original.

## 2. Ranked findings

### Serious

**1. Home cache-miss LCP fails Core Web Vitals because the loader runs health.**
- **Evidence:** `app/routes/home.tsx:107-109` (`Promise.all` of `listBlogPosts` and `runHealthChecks`). Live `/api/health` was 2313 ms on this probe. Throttled mobile (Slow 4G, 4x CPU, 390x844): `/` LCP **4096 ms**, TTFB **2693 ms**, FCP 4096 ms, LCP element `P`. `/blog` LCP 748 ms, post LCP 1096 ms, `/search?q=cloudflare` LCP 756 ms on the same profile. Second cookieless GET of `/` was 42 ms, `CF-Cache-Status: HIT`.
- **Severity:** serious
- **Fix:** Stop calling `runHealthChecks` from the home loader. Link `/api/health` (already linked) and render the tile from a short TTL KV snapshot written by the scheduled workflow, or drop the tile from the cached body.

**2. Primed public HTML is still served over plaintext.**
- **Evidence:** `curl.exe` of `http://dustinedwards.dustin-edwards.workers.dev/` on 2026-08-26: `HTTP/1.1 200 OK`, `CF-Cache-Status: HIT`, `Age: 259`, `Cache-Control: public, s-maxage=600, stale-while-revalidate=86400`, body 10163 bytes, CSP nonce in the clear. `http://…/login`, `/admin`, `/api/health`, and a unique query all 301 as designed (`app/lib/https-redirect.mjs:37-44`). Scheme is not in the Workers Cache key.
- **Severity:** serious (accepted residual; no Worker-only close)
- **Fix:** Zone "Always Use HTTPS" at DNS cutover (`CUTOVER.md`). Do not cache a 301 under the shared key.

**3. Shared cache stores one CSP nonce with the HTML for up to ten minutes.**
- **Evidence:** `workers/app.ts:220-257`, `app/lib/seo.ts:226-227`. Live `/` HIT reused the cached nonce (`nonce-c3339220-…` on the first fetch, HIT age 176). `script-src` is `'nonce-…' 'strict-dynamic'` with no `'self'` (`workers/csp.mjs:87`).
- **Severity:** serious (accepted, stated on `/colophon`)
- **Fix:** Keep the ruling, or at cutover add a Cache Rule that does not store the policy with the body. Do not add `'self'`; that was measured to kill public scripts.

**4. Heading permalinks fail WCAG 1.4.3 via opacity the contrast gate cannot see.**
- **Evidence:** `app/styles/post.css:387-389` `@media (hover: none) { .heading-anchor { opacity: 0.55; } }`. Tokens: `--text-muted: #5c5248` on `--bg: #faf7f2` (`app/app.css:129,138`); dark `--text-muted: #b3a99c` on `--bg: #1a1614` (`app/app.css:282` and the dark canvas hex at 192). Composited: **2.53:1 light, 3.22:1 dark**. Declared pair without opacity is 7.13:1 / 7.76:1, which is what `check:contrast` reads (`scripts/check-contrast.mjs:9-12`). Same class as the repaired `.figure-credit` (`post.css:157-169`).
- **Severity:** serious
- **Fix:** Drop opacity; colour the permalink with a token already measured at ≥4.5:1.

**5. No privacy page, no notice, no named processors.**
- **Evidence:** `app/routes.ts` has no privacy or contact route. Footer is colophon / RSS / login (`app/components/site-footer.tsx`). Analytics Engine writes path, referer host, country, device (`workers/app.ts:398-409`). Ask caches answers 7 days (`app/lib/search/ask-guard.server.ts:68`). CSP reports log the body verbatim (`app/routes/api.csp-report.ts:134-142`). Theme cookie is 1 year, `SameSite=Lax; Secure`, not HttpOnly (`app/lib/theme.ts:54-58`).
- **Severity:** serious (UK GDPR / ICO transparency, not a tracker)
- **Fix:** A `/privacy` page that lists those stores, Cloudflare and Google as processors, retention, and how to ask; link it from the footer.

**6. Live colophon still describes a committed byte-gated artifact.**
- **Evidence:** `content/features.json:7` "A generator renders them into a committed artifact… The artifact is byte-compared against a fresh generation on every build". Also `:22` (editor "commits HTML"), `:224` (save lands markdown and artifact as one commit). Live `/colophon` matched `committed artifact` / `byte-compar`. Rule 18 and `content-is-code-building-the-blog.md` (26 Aug update) say git holds markdown only. `check:features` asserts anchors exist, not that the sentence is true.
- **Severity:** serious (public self-description)
- **Fix:** Rewrite those `what` strings to provenance hashes, D1 as the rendered copy, and ship-time drift. The gate cannot do this.

**7. Related posts are a public derived object that does not compose visibility.**
- **Evidence:** `app/lib/content/pipeline.mjs:495-506` filters `!other.draft` only. `app/lib/blog-view.ts:89-92` parses stored JSON with no `publiclyVisibleSlugs`. `app/routes/blog.$slug.tsx:285-293` renders it. A scheduled post is `draft: false` with a future `publish_at`. Unpublishing B does not recompute A's list until the next bulk sync.
- **Severity:** serious (rule 1; dormant while every published post is visible)
- **Fix:** Filter candidates with `isPubliclyVisible` at write, and filter `post.related` at read.

**8. Live Ask generation does not re-check chunk visibility.**
- **Evidence:** `app/routes/search.ask.ts:47-58` (`citationsStillPublic`) runs on cache hits only. Misses tee `askStream` untouched (`ask.server.ts:80-91`). Upload filters with `isPubliclyVisible`; AI Search can lag. July 2026 draft leak was this class at ingest.
- **Severity:** serious (window, billed path)
- **Fix:** Drop chunks whose slugs fail `publiclyVisibleSlugs` before the stream is exposed, same as cache replay.

**9. Every public HTML page downloads the command palette.**
- **Evidence:** Live `/`, `/blog`, `/colophon`, `/projects`, `/playground`, `/phage-discovery`, 404 all included `<script type="module" … src="/assets/palette-D7ZZG3fG.js">`. Bundle: 11663 raw / 4026 brotli (`check-script-payload.mjs:73-80`; local `build/client` matches). The palette is unused until `/` or `Ctrl-K`. Home's other enhancement is `theme-DflA-CBR.js` at 349 brotli.
- **Severity:** serious against the "no bloat / public payload" bar
- **Fix:** Load `palette.js` the way `ask.js` loads: only on `/search`, or behind the first keydown / click on the search control (with the `<a href="/search">` fallback already in `search-trigger.tsx:49`).

**10. Admin cookie POSTs have no Origin check; `workers.dev` siblings are same-site.**
- **Evidence:** `app/routes/admin.tsx` middleware authenticates the session and refuses smoke writes; it does not inspect `Origin`. Better Auth `trustedOrigins` covers `/api/auth/*` only (`app/lib/auth.server.ts:24`). Session cookie is `__Secure-better-auth.session_token`, `SameSite=Lax` (Better Auth default). eTLD+1 of this host is `dustin-edwards.workers.dev`.
- **Severity:** serious pre-cutover; Lax is enough against a foreign site
- **Fix:** Refuse a present foreign `Origin` on mutating `/admin` requests (rule 19's Ask stance). Absent `Origin` stays allowed for no-script forms.

**11. Ship proves liveness, not readiness.**
- **Evidence:** `scripts/ship.mjs:69` `POLL_PATH = "/colophon"`; `:472` five 200s. `/api/health` is not consulted. A Worker that serves the colophon while Ask/media/content-drift is red still syncs D1.
- **Severity:** serious
- **Fix:** After the 200 streak, require `ok: true` from `/api/health` before sync.

### Minor

**12. Post pages omit `twitter:image`.**
- **Evidence:** `app/routes/blog.$slug.tsx:88-99` sets `og:image` and `twitter:card` / title / description, not `twitter:image`. `pageMeta` in `app/lib/seo.ts:161` always emits it. The blog index comment at `blog._index.tsx:207` already names this class.
- **Fix:** Emit `{ name: "twitter:image", content: image }` from `postSocial`.

**13. RSS autodiscovery is only on `/blog`.**
- **Evidence:** `app/routes/blog._index.tsx:214-227`. Home `links` in `app/root.tsx:37-52` has icons, no feeds. `/` is the URL people paste.
- **Fix:** Put both `rel="alternate"` entries in root `links`.

**14. RSS is teaser-only; JSON Feed is full markdown.**
- **Evidence:** `app/routes/blog.rss[.xml].ts:31-34` vs `app/lib/json-feed.mjs:38`. Live JSON Feed 160577 bytes, 11 items, first item keys `id,url,title,content_text,summary,date_published,date_modified,tags`; `id === url`; `content_text` length 11826. Live RSS 9648 bytes.
- **Fix:** Add full content to RSS, or state on the colophon that RSS is headlines.

**15. Public CSS is one 45.5 kB sheet that includes post, search, palette, and playground on every page.**
- **Evidence:** `app/app.css:974-982` imports all nine public sheets. Live `/` CSS is `/assets/root-Dhhz26dV.css` (45580 raw / 9679 gzip / 8538 brotli locally; 11049 transfer on Slow 4G). Admin was split out on 2026-08-23 (comment at 942-948); the public remainder was not split by route. Source CSS totals 9738 lines, of which public sheets are ~3500.
- **Fix:** Route-level CSS imports for post, search, palette, playground. Home then ships chrome + home only.

**16. JSON-LD is `JSON.stringify` with no `<` escape.**
- **Evidence:** `app/routes/home.tsx:269-276`, `blog.$slug.tsx:134-154`. A title containing `</script>` breaks the HTML parser. Enforcing CSP still blocks execution (no nonce on `ld+json`).
- **Fix:** One helper: `JSON.stringify(data).replace(/</g, "\\u003c")`.

**17. `/search` HTML has no canonical / OG.**
- **Evidence:** `app/routes/search.tsx:168-176` (title, description, `noindex, follow` only). Query URLs are shareable.
- **Fix:** `pageMeta` plus robots, canonical to `/search`.

**18. Lightbox is not a dialog.**
- **Evidence:** `app/enhance/blog.ts:245-266` creates a focused `div.lightbox` with no `role="dialog"`, no `aria-modal`, no labelled close, no focus trap. Escape and click-to-close exist. Corpus has zero body images; diagrams bind click only (`:303-310`).
- **Fix:** `role="dialog"`, trap, labelled close. Diagrams keep the visible image as the no-script fallback.

**19. `savePost` / `deletePost` default `actor` to admin.**
- **Evidence:** `app/lib/editor/publish.server.ts` (defaults at the function signatures the admin explore cited). Smoke cannot POST today because of `admin.tsx` method gate. A new caller that omits `actor` first-publishes as Dustin.
- **Fix:** Make `actor` required; pass `{ kind: "admin" }` from the two editor routes.

**20. Operator token length is unbounded before the digest.**
- **Evidence:** `app/lib/bearer.server.ts:35-47`; `app/lib/operator/auth.server.ts:57-62`. Invalid tokens are not rate-limited (intentional).
- **Fix:** Reject `presented.length` above a fixed ceiling (for example 256) before `digest`.

**21. Claimed `test/bearer.test.mjs` is absent.**
- **Evidence:** `app/lib/bearer.server.ts:13-15`. `test/` has no `bearer.test.mjs`.
- **Fix:** Add the differential test the comment describes, or delete the claim.

**22. `check:tests` floors do not match their own comment.**
- **Evidence:** `scripts/check-tests.mjs:71-80`. Comment: "losing the smallest test file still trips the file floor." Constants: `MINIMUM_FILES = 44`, measured 47. 47 − 1 = 46, still green. `MINIMUM_TESTS = 433` against 461 (28 tests can vanish).
- **Fix:** Set `MINIMUM_FILES` to 47 (or 46 if the claim is "two files"). Re-measure tests and set the floor to measured minus the smallest file.

**23. README restates gate counts and an artifact that left git.**
- **Evidence:** `README.md:128` "the twelve that need no network"; `MINIMUM_GATES` is 26 (`scripts/check-all.mjs:53`). `README.md:166` "Seven" secrets; the table lists nine. `README.md:214` "`content/generated/` committed, gated artifacts"; line 72 of the same file says gitignored. `README.md:138` `check:content` "committed artifacts match fresh scans".
- **Fix:** Point at `check-all.mjs`. Delete the digits. Fix the layout line.

**24. `ten-years-on-cloudflare.md` lede still says 1.59 kB.**
- **Evidence:** `content/posts/ten-years-on-cloudflare.md:12,28`. `bells-and-whistles-zero-js.md:11` is 1.67 kB on 2026-08-26. Worker size 4.87 MB is dated 2026-08-04; local `build/server/assets/server-build-BR0XzWzJ.js` is 5,382,287 bytes.
- **Fix:** Align the lede with the 26 Aug measurement, or date 1.59 kB as first-publish.

**25. `observable-plot-cloudflare-workers.md` has no August update.**
- **Evidence:** line 17 still says the SVG is "embedded in a generated artifact that a build gate byte-compares".
- **Fix:** Add the same provenance-hash note the pipeline post already has.

### Taste

**26. Blog index loads `blog.js` (4254 raw) for a page with no `.post .prose`.**
- **Evidence:** Live `/blog` scripts include `blog-Cwlky3TQ.js`. `app/enhance/blog.ts` early-returns without `.post .prose`.
- **Fix:** Keep `BlogSpeculation`; drop `BlogEnhancements` on the index.

**27. Print CSS uses `#999`.**
- **Evidence:** `app/styles/blog-enhancements.css:381`.
- **Fix:** `var(--border-strong)`.

**28. Historical comments still describe hydration on public routes.**
- **Evidence:** `app/routes/playground.tsx:44-49`, `app/lib/playground-page.mjs:23-28`, `workers/app.ts:265-279` (inline framework scripts on public pages). False since 2026-08-26.
- **Fix:** Retarget to `handle.hydrate` and enhancement tags.

### Previous 2026-08-25 items (not findings)

| Item | Status | Evidence |
| --- | --- | --- |
| JSON Feed missing `content_html` / `content_text` | Fixed | Live item has `content_text`; `app/lib/json-feed.mjs:29-38`; `test/json-feed.test.mjs` |
| 1 MB GitHub Contents cliff on the corpus artifact | Fixed | Ask/status/citations read D1; `content/generated/posts.json` is gitignored |
| Public plane hydration payload | Fixed | Live public HTML: `hydrateManifest: false`; scripts are palette/theme/blog/ask only. Opt-in is `admin.tsx` and `login.tsx` |
| `isManagedKey` regex predating `-<w>x<h>` | Fixed | `app/lib/media/classify.mjs:408-409`; `isManagedKey` delegates to `isContentKey` |

## 3. Delete list (area 15)

| Item | Est. lines | Why it is safe |
| --- | --- | --- |
| Stale `@see workers/health.ts` comments | ~20 | File is gone; I/O is `app/lib/health/checks.server.ts` |
| `CUTOVER.md` sentence that the operator API has `allowedHostnames` | ~5 | `app/routes/api.operator.ts` has no hostname allowlist; the word is a `check:invariants` needle on CUTOVER only |
| Claim of `test/bearer.test.mjs` | 3 | File does not exist |
| README "twelve" / "Seven" / "committed, gated artifacts" | ~8 | Digits and a false layout line; not a feature |
| `isbot` | 1 import + dep | Public plane has no Suspense boundary. Only `entry.server.tsx:92` waits on `allReady` for bots. Measure whether any public path still streams a late boundary; if not, the package can go. **Not deleted in this audit.** |

**Do not delete:** the media library (it also indexes `public/`; OFL.txt was a measured miss), `ae-probe.mjs`, `operator-roundtrip.mjs`, `build-icons.mjs`, `posts_fts` (health watchdog, not the MATCH index), enhancement bundles, gates.

**Machinery that guards a load of zero**

1. **R2 MEDIA originals.** `mediaUnbackedVerdict` is green because the bucket is empty. `/media/*?w=` transforms nothing production-authored. Admin media CSS 2199 + 942 lines and `admin.media._index.tsx` 2141 lines sit on top.
2. **Body-image pipeline.** No `![…]`, no `:::figure`, no `/media/` in `content/posts/*.md`. `contentSrcSet`, lightbox-on-anchors, and `mediaRefs` from body are fixture-only.
3. **`check:browser` on the deploy path.** 2629-line Puppeteer gate. Ship does not run it. Daily `browser.yml` is after the fact.
4. **`palette.js` on every public page.** 11.6 kB raw for a control whose no-script form is a link to `/search`.

## 4. Variables list

Literals that should be a named constant or a design token. Not every number in the tree; the ones that already have an owner are omitted.

| Literal | Where | Owner it should share |
| --- | --- | --- |
| `"https://dustinedwards.dustin-edwards.workers.dev"` | `scripts/ship.mjs:67` | `SITE_ORIGIN` in `app/lib/seo.ts:18` (health.yml already parses it) |
| `opacity: 0.55` | `app/styles/post.css:388` | A colour token, not an alpha (see finding 4) |
| `opacity: 0.5` | `app/styles/search.css:194` (`.search-why-sep`) | Same class; incidental punctuation or a token |
| `min-height: 1.5rem` | `app/styles/search.css:213` (`.ask-trigger`) | `1.75rem` / 28 px already named on `.theme-option` (`blog-index.css:145-146`) |
| `#999` | `app/styles/blog-enhancements.css:381` | `--border-strong` |
| `POLL_PATH = "/colophon"` | `scripts/ship.mjs:69` | Should be `/api/health` or a named readiness URL |
| `MINIMUM_FILES = 44`, `MINIMUM_TESTS = 433` | `scripts/check-tests.mjs:77-80` | Re-measure; floors are 94% of a dated count and do not match the comment |
| `"@cf/meta/llama-3.3-70b-instruct-fp8-fast"` | `app/lib/search/ask.server.ts:36` | Already a constant (`ASK_MODEL`). Fine. |
| `2000` / `2100` / `6000` / `550` | `scripts/check-script-payload.mjs:87-92` | Already the one owner. Fine. |
| Lockfile `"node": ">=22.22.0"` | `package-lock.json` root `engines` | `.nvmrc` / `package.json:6` `>=24.14.1` |

CSS custom properties are the rule on the public plane. The print `#999` and the two opacities are the exceptions that matter.

## 5. Measurements

### Live HTTPS (2026-08-26, this session)

| Path | Status | ms | Bytes | CF-Cache-Status | Cache-Control | Scripts |
| --- | ---: | ---: | ---: | --- | --- | --- |
| `/` | 200 | 592 | 10163 | HIT (age 176) | `public, s-maxage=600, stale-while-revalidate=86400` | palette, theme, speculationrules, 2× ld+json. No framework |
| `/` second | 200 | 42 | 10163 | HIT (age 185) | same | same |
| `/` + `Cookie: theme=dark` | 200 | 928 | 10181 | BYPASS | `private, no-store` | `data-theme="dark"` |
| `/blog` | 200 | 606 | 19589 | MISS | shared + `Vary: Cookie` | palette, theme, blog, 2× speculationrules |
| `/blog/content-is-code-building-the-blog` | 200 | 718 | 37241 | MISS | shared + `Vary: Accept, Cookie` | palette, theme, blog |
| same + `Accept: text/markdown` | 200 | — | 18557 | BYPASS | `private, no-store` | `text/markdown` |
| `/blog/…md` | 200 | 568 | 18557 | BYPASS | `private, no-store` | markdown |
| `/blog/rss.xml` | 200 | 44 | 9648 | HIT | shared | RSS 2.0 |
| `/blog/feed.json` | 200 | 233 | 160577 | MISS | shared | JSON Feed 1.1, `content_text` present |
| `/search` | 200 | 146 | 6005 | HIT | shared + `Vary: Accept, Cookie` | palette, theme. No ask.js |
| `/search?q=cloudflare` | 200 | 511 | 19073 | MISS | same | palette, theme, ask |
| `/colophon` | 200 | 48 | 46273 | HIT | shared | palette, theme |
| `/projects` | 200 | 427 | 16705 | MISS | shared | palette, theme, ld+json |
| `/playground` | 200 | 465 | 17771 | MISS | shared | palette, theme |
| `/phage-discovery` | 200 | 395 | 12034 | MISS | shared | palette, theme |
| `/login` | 200 | 98 | 7168 | BYPASS | `private, no-store` | hydrates; `root-*.css` + `admin-*.css` |
| `/admin` | 302 | 113 | 0 | BYPASS | `private, no-store` | Location `/login`; style nonce on CSP |
| `/api/health` | 200 | 2313 | 203 | BYPASS | `no-store` | `ok: true`, three named checks in the body |
| `/search/ask` GET | 405 | 162 | 15 | BYPASS | `no-store` | `Allow: POST` |
| `/theme` GET | 303 | 404 | 0 | BYPASS | `private, no-store` | Location `/` |
| 404 post slug | 404 | 136 | 5355 | BYPASS | `private, no-store` | palette, theme; no ld+json |
| `http://` `/` | 200 | — | 10163 | HIT | shared | plaintext, nonce in header |
| `http://` `/login` | 301 | — | 0 | BYPASS | `no-store` | Location https |

Security headers on every HTTPS response probed: `Strict-Transport-Security: max-age=31536000` (no `includeSubDomains` / `preload`), `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), display-capture=()`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, CSP `script-src 'nonce-…' 'strict-dynamic'`, public `style-src 'self'`, `style-src-attr 'unsafe-inline'`.

### Core Web Vitals, Slow 4G + 4× CPU, 390×844 (Puppeteer, this session)

| Page | LCP ms | LCP tag | CLS | INP | TTFB ms | FCP ms | Transfer kB | Resources |
| --- | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: |
| `/` | 4096 | P | 0.0004 | not observed | 2693 | 4096 | 89 | 6 |
| `/blog` | 748 | P | 0 | not observed | 522 | 748 | 2 (warm cache) | 6 |
| `/blog/content-is-code-building-the-blog` | 1096 | H1 | 0 | not observed | 917 | 1096 | 0 (warm) | 6 |
| `/search?q=cloudflare` | 756 | H2 | 0 | not observed | 494 | 756 | 2 (warm) | 6 |

web.dev "good": LCP ≤ 2500, INP ≤ 200, CLS ≤ 0.1. Home miss fails LCP. Other three pass LCP and CLS. INP: the `event` PerformanceObserver recorded nothing on a theme-button click; not treated as a pass.

### Build artifacts on this disk

| Artifact | Raw | Gzip | Brotli |
| --- | ---: | ---: | ---: |
| `root-Dhhz26dV.css` (public CSS) | 45580 | 9679 | 8538 |
| `admin-iEWJMMUU.css` | 63666 | 10645 | 9511 |
| `palette-D7ZZG3fG.js` | 11663 | 4558 | 4026 |
| `blog-Cwlky3TQ.js` | 4514 | 1732 | 1477 |
| `ask-JLyI7ooH.js` | 3010 | 1528 | 1342 |
| `theme-DflA-CBR.js` | 714 | 441 | 349 |
| Inter latin normal woff2 | 72920 | (woff2) | |
| Inter latin italic woff2 | 79716 | (woff2) | |
| `build/server/assets/server-build-*.js` | 5,382,287 | | |
| `build/server` total | 8599 kB | | |

Home public payload, cookieless, first view: HTML ~10 kB + CSS ~11 kB gzip + font 73 kB + palette 4.6 kB gzip + theme 0.4 kB ≈ **89 kB transfer** (matches the Puppeteer home run). No React, no router manifest.

### Contrast (computed this session)

| Pair | Ratio | AA 4.5:1 |
| --- | ---: | --- |
| `--text-muted` / `--bg` light | 7.13 | pass (what the gate sees) |
| same at `opacity: 0.55` | 2.53 | fail |
| `--text-muted` / `--bg` dark | 7.76 | pass |
| same at `opacity: 0.55` | 3.22 | fail |

### Repo shape

- 22 files ≥ 800 lines (largest: `scripts/check-invariants.mjs` 4578, `scripts/check-admin-ui.mjs` 4243, `scripts/check-browser.mjs` 2629).
- CSS source 9738 lines.
- `MINIMUM_GATES = 26`.
- Sitemap live: 17 URLs, all existing routes. No `kind=page` phantoms on the wire today.

### D1 / Worker work per page (from source, not traced live)

| Page | Loader work |
| --- | --- |
| Home (miss) | `listBlogPosts` + `runHealthChecks` (Ask list, media reconcile, GitHub Contents, FTS counts). Documented 0.7–2.7 s; measured health 2.3 s |
| Home (HIT) | none at origin |
| Blog index | `listBlogPosts` + tags + years |
| Post | `getBlogPost` + optional `listSeriesParts` |
| Search empty | no MATCH; zero-state from `search_docs` |
| Search with `q` | two FTS MATCH + RRF; Ask bundle only, no Ask call until POST |

## 6. What could not be verified

- **INP.** Event Timing did not fire on the theme click in Puppeteer. Not a pass, not a fail.
- **Admin keyboard walk and screen-reader names.** No `SMOKE_TOKEN` in this session; did not sign in. Admin a11y is source-only (sticky topbar / editor command bar vs WCAG 2.4.11).
- **Real-device hover / coarse pointer.** `matchMedia("(hover: none)")` emulation has failed in this repo before (`VERIFICATION.md`). Heading-anchor opacity is asserted from CSS bytes and contrast arithmetic, not from a phone.
- **`dustinedwards-mcp` source.** Not in this repo. Operator HTTP door was audited here. Hostname allowlisting claimed in `CUTOVER.md:64` is not implemented on `/api/operator`.
- **Whether live D1 currently holds a scheduled or withdrawn post that would leak through `related`.** The hole is in source; the live corpus sitemap is 11 published posts, all visible.
- **Whether any `kind=page` D1 row exists.** Sitemap did not emit any today; the arm in `sitemap.ts:54-59` remains.
- **Better Auth cookie flags on a real Set-Cookie.** Inferred from Better Auth 1.6 defaults and `check-browser.mjs:181` (`__Secure-better-auth.session_token`). Did not complete a Google login.
- **Ask injection against the live model.** Did not POST to `/search/ask` (task: at most three billed clicks; this pass used zero). Guards were read in source (`ask-origin.mjs`, rate, budget, 500-char cap).
- **EU reader share.** Analytics Engine stores `cf.country`; this session did not query it.
- **Every gate plant history.** Could not rerun plants. Slack floors in `check:tests` were read from the constants and the comment, which disagree.
- **Lockfile integrity of every package beyond `better-auth` and `wrangler`.** Those two have `integrity` hashes. Names in `package.json` resolve on the registry via the lockfile; no hallucinated names.
- **Chrome UX Report / field CWV.** Lab only, one run, one POP (DFW/ATL).

## 7. If built fresh today

**Keep verbatim**

- Fail-closed cache default (`private, no-store` unless a route opts in) plus `Vary: Cookie` paired with the cookie-bearing downgrade.
- Public plane that does not hydrate; four prebuilt nonced enhancement bundles; `/login` as a real form.
- One markdown renderer, provenance hashes, ship-time drift table, content-drift repair through the operator door.
- `publiclyVisible()` / `visibilityClause()` as the visibility gate, with the JSON Feed, `.md` twin, OG, and Ask upload already on it.
- Capability table keyed by actor kind; smoke read-only by construction; operator first-publish reservation; `constantTimeEqual` on both bearers.
- CSP nonce + `strict-dynamic`, style nonce admin-only, speculationrules nonced, JSON-LD not.
- Gate family that derives its list, fails closed on empty scope, and plants the defect it was written for. CI on a clean checkout. Ship that refuses a dirty tree and a red CI sha.
- Per-table D1 backup; FTS repair via `('rebuild')`; R2 wins media conflicts.

**Three things I would do differently**

1. **Home is a document, not a dashboard.** Do not run Ask listing, GitHub Contents, and R2 reconciliation on the site's most-cached HTML. The 4.1 s LCP on a throttled miss is that decision, not the Worker runtime.
2. **Pay for script and CSS per page, not per site.** Palette on every document and one CSS bundle that includes post/search/playground on `/` are the opposite of the unhydration win. Load palette like Ask: on demand. Import post and playground CSS from those routes.
3. **Tell the truth on the live colophon, and put a privacy page next to it.** `features.json` is still the committed-artifact world. A reader in the EEA/UK gets Analytics Engine, Ask, and a theme cookie with no notice. Neither is a code defect in the Worker. Both fail the "would the best engineer copy this" test for a 2026 public site.

## Appendix: WCAG 2.2 nine, EAA, AI catalogue

### WCAG 2.2 new criteria (source + what was walked)

| Criterion | Result |
| --- | --- |
| 2.4.11 Focus Not Obscured (Minimum) | Public header is not sticky. Admin topbar and editor command bar are sticky; no `scroll-padding-top` on `.admin-content`. |
| 2.4.12 Focus Not Obscured (Enhanced) | AAA, skipped |
| 2.4.13 Focus Appearance | AAA. 2 px outline + 2 px offset, outline not box-shadow (`app/app.css:882-911`). Not required for AA. |
| 2.5.7 Dragging Movements | No public drag-only control. Admin insert has picker / paste / toolbar as well as drop. |
| 2.5.8 Target Size (Minimum) | Theme buttons 1.75 rem (28 px). `.ask-trigger` 1.5 rems (24 px only at 16 px root). Heading permalinks are inline (exempt). |
| 3.2.6 Consistent Help | N/A: no help mechanism. Adding `/privacy` on one page only would then need it everywhere. |
| 3.3.7 Redundant Entry | N/A: no multi-step public forms |
| 3.3.8 Accessible Authentication (Minimum) | Pass on this origin: Google OAuth, no password, no transcription puzzle. Native POST at `login.tsx:150`. |
| 3.3.9 Accessible Authentication (Enhanced) | AAA, skipped |

Keyboard on public pages, script off: skip link, theme POST `/theme` (Referer origin-checked), search GET form, login POST, blog filters as query params. Confirmed in source; theme and search forms present in live HTML. Screen-reader names: theme `aria-label="Colour theme"` plus `sr-only` text; search trigger `aria-label="Search"`; nav `aria-label="Main"`.

**European Accessibility Act.** Not legal advice. Directive (EU) 2019/882 Annex I lists consumer computers, e-commerce, banking, e-books, passenger transport, and similar. A personal blog that does not conclude a consumer contract is generally outside that list. Do not claim compliance or a legal exemption. UK PSBAR does not apply to a private personal site.

### AI-assisted-development catalogue (area 16)

| Class | Result |
| --- | --- |
| Auth/authz weakened during iteration | Smoke is a new principal, all capabilities false, method gate before `next()`. Operator cannot first-publish or delete. |
| Endpoints left active after UI changes | History restore is gone; route is GET-only and still linked. Tools no longer POST. `delete_post` on the operator API is reachable and always 403 for that actor. |
| Injection through generated input | Pipeline: no raw HTML, URL allowlist, unknown directives fail. Search: user tokens quoted into FTS MATCH; filters bound. Table names interpolated from a two-value union. |
| Secrets in code / client / responses | `check:secrets` path rule. `auth-client.ts` has no secret. Theme cookie is a preference. Operator token never echoed. |
| Hallucinated packages | None in `package.json`. Lockfile resolves `isbot`, `better-auth`, `wrangler`. |
| Copy-paste divergence | `SITE_ORIGIN` copied into `ship.mjs`. Related-post visibility vs every other public derived object. RSS vs JSON Feed content. |
| Defensive code around impossible states | `theme.ts` `//` pathname guard: measured unreachable, kept. Smoke `absent` vs `refused` is a real split. |
| Over-commenting that narrates history | Dominant pattern in `ship.mjs`, `check-all.mjs`, all four workflows, `workers/app.ts`, `tsconfig.node.json`. |
| Abstractions with one caller | `health-repair.mjs`, `bearer.server.ts` (two callers: operator and smoke). Justified. |
| Tests asserting the code's own output | `test/README.md` forbids testing gates. `check:tests` cannot see empty bodies. |
| Inconsistent conventions | Two SITE_ORIGIN parsers; skip footer always says "network"; lockfile engines vs `.nvmrc`. |
| Error paths never exercised | `check:browser` not in ship; empty-trash and body-image paths have no production objects; Ask live visibility on miss untested here. |
| Hardcoded values | See variables list. |
| String-built queries | FTS SQL templates with bound user values. Health FTS counts are literals. |
| Permissive defaults | Cache default is refuse. Ask without limiter is 503. Operator without token is 503. `trustedOrigins: []` if `BETTER_AUTH_URL` unset. |
| Unused exports | Not proven (`noUnusedLocals` off). |
| Files grown by accretion | `check-invariants` 4578, `check-admin-ui` 4243, `admin-media.css` 2199, `admin.media._index.tsx` 2141. |

### Checkable-error note

This repo's own post (`ten-years-on-cloudflare.md` August update) recorded that prior external audits were wrong on roughly half of their checkable claims. This pass treated that as a method, not a score to beat: every finding above has a path or a URL. Four 2026-08-25 claims were re-checked and found fixed. Three claims from source comments were found false in the comment itself (`test/bearer.test.mjs` missing; `check:tests` floor comment; playground "Scripts on every route").
