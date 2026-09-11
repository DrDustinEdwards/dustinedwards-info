# Pre-cutover audit

Read-only. Live host `https://dustinedwards.dustin-edwards.workers.dev`. Site tree `C:\Users\email\dev\worktrees\grok` on `review/grok` at `fac78df`. MCP repo `DrDustinEdwards/dustinedwards-mcp` at `6998956` (main). Date of probes: 2026-09-11.

No finding without a command, URL, or file:line. Things I could not prove are under Unverified.

Severity: **blocks cutover** (the apex toggle will be wrong or unsafe if this is still true), **fix before public** (a stranger or attacker sees it on the current host), **later**.

---

## Part 1. Security, performance, accessibility, SEO, operations

### Public write paths and rate limits

Probed with `curl.exe` against the live host. Code limits read from the route files.

| Path | Method | Live result | Rate limit in code | Origin check |
|---|---|---|---|---|
| `/theme` | POST | 303 + `Set-Cookie` with no Origin; 403 `Cross-origin requests are not accepted.` with `Origin: https://evil.example`; 303 with matching Origin | none | `originVerdict` (`app/routes/theme.ts:31`) |
| `/webmention` | POST | 202 `Accepted. It will be verified and reviewed before it appears.` for `source=https://example.com/` targeting a published post | 20 / 60s (`app/routes/webmention.ts:77`) | target must be this origin + published post |
| `/api/csp-report` | POST | 204 | 60 / 60s (`app/routes/api.csp-report.ts:59`) | none (browsers send reports) |
| `/search/ask` | POST | 403 with foreign Origin; 400 `Missing q.` if the field is wrong; 200 `text/event-stream` `x-ask-cache: miss` with `q=` | 5 / 60s + daily ceiling (`app/lib/search/ask-guard.server.ts:40`) | `originVerdict` first (`app/routes/search.ask.ts:132`) |
| `/login` | POST | 303 to Google OAuth; sets `__Secure-better-auth.state` | 20 / 600s shared with `/api/auth/*` (`app/lib/auth-rate.mjs:47`, `app/routes/login.tsx:100`) | React Router document CSRF + Better Auth `trustedOrigins` |
| `/api/auth/sign-in/social` | POST | 400 `VALIDATION_ERROR` on empty JSON | same 20 / 600s (`app/routes/api.auth.$.ts:32`) | Better Auth |
| `/api/operator` | POST | 401 `Invalid or missing bearer token.` with and without `Origin: https://evil.example` and a 32-byte fake bearer | 30 / 60s after auth (`app/lib/operator/auth.server.ts:20`) | **none** (see P1-03) |
| `/api/health` | GET | 200 JSON in 4.3s | 20 / 60s (`app/routes/api.health.ts:47`) | n/a |
| `/api/health` | POST | 405, body `{"message":"Unexpected Server Error"}` | n/a | n/a |
| `/preview/:token` | GET | 404 same shape as a missing page | 30 / 60s (`app/lib/preview-links.server.ts:193`) | n/a |
| `/admin`, `/admin/posts` | GET | 302 `Location: /login`, `Cache-Control: private, no-store` | session gate (`app/routes/admin.tsx:59`) | `originVerdict` on non-GET (`app/routes/admin.tsx:109`) |

**P1-01.** `app/routes/theme.ts:16`. POST `/theme` sets a cookie and has no rate limit. Command: `curl.exe -X POST -H "Content-Type: application/x-www-form-urlencoded" --data-binary "theme=dark"` with no Origin returned 303 and `Set-Cookie: theme=dark; Path=/; Max-Age=31536000; SameSite=Lax; Secure`. Severity: **later**. Fix: reuse `AskBudget` under `theme:<ip>` the way `/webmention` does, or decide in writing that a preference cookie is not worth a Durable Object.

**P1-02.** `app/lib/theme.ts:165`. Theme cookie is `SameSite=Lax; Secure` and not HttpOnly. Observed on the wire from the same POST. The enhancement in `app/enhance/theme.ts` writes `document.cookie`, so HttpOnly would break it. Severity: **later**. Fix: leave it, or stop the scripted path from writing the cookie and let only `/theme` set it, then add HttpOnly.

**P1-03.** `app/routes/api.operator.ts:35-49`. The operator action authenticates, then meters, then parses JSON. `originVerdict` does not appear in `app/lib/operator/`. Command: POST with `Origin: https://evil.example` and `Authorization: Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` returned 401, not 403. CSRF is weak here because the credential is a bearer header, not a cookie. Severity: **later**. Fix: call `originVerdict` before `authenticateOperator` if a present foreign Origin should never reach the hasher.

**P1-04.** `app/routes/api.health.ts` has a loader and no action. Command: `curl.exe -X POST https://dustinedwards.dustin-edwards.workers.dev/api/health` returned `HTTP/1.1 405 Method Not Allowed` with `Content-Type: application/json` and body `{"message":"Unexpected Server Error"}`. No `Allow` header. Severity: **fix before public**. Fix: export an action that returns 405 with `Allow: GET` and the same `healthJson` helper, so a POST is a method error rather than a framework 500-shaped JSON.

### Session cookies and the login form

**P1-05.** Live `POST /login` (empty form body) returned 303 to `https://accounts.google.com/o/oauth2/v2/auth?...&redirect_uri=https%3A%2F%2Fdustinedwards.dustin-edwards.workers.dev%2Fapi%2Fauth%2Fcallback%2Fgoogle` and `Set-Cookie: __Secure-better-auth.state=...; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=Lax`. GET `/login` set no cookie. `app/lib/auth.server.ts:18-66` does not pass `advanced.defaultCookieAttributes`; Better Auth 1.6 defaults in `node_modules/better-auth/dist/cookies/index.mjs:31-36` are `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `secure` when the prefix is on. Severity: **blocks cutover** for the redirect URI (CUTOVER.md 3.3); cookie flags themselves are **later**. Fix at toggle: add the apex callback in the Google console. Fix later: pin `defaultCookieAttributes` in `createAuth` so a library bump cannot loosen them.

**P1-06.** `app/routes/login.tsx:150-168`. The door is a native `method="post"` form. The `onClick` calls `preventDefault` and `authClient.signIn.social` only when script runs. Confirmed: a scriptless POST still 303s to Google. Severity: not a defect.

### CSP as served

Three routes, `curl.exe -sS -D - -o NUL`:

- `GET /`: `default-src 'self'; script-src 'nonce-<uuid>' 'strict-dynamic'; style-src 'self'; style-src-attr 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; report-uri /api/csp-report; report-to csp-endpoint`
- `GET /login`: same public branch (`style-src 'self'`, no style nonce)
- `GET /admin` (302): admin branch, `style-src 'self' 'nonce-<uuid>'`

HSTS on all three: `max-age=31536000` with no `includeSubDomains` and no `preload`.

**P1-07.** `workers/csp.mjs:84-159` and the live header. Missing as named directives: `frame-src`, `worker-src`, `media-src`, `upgrade-insecure-requests`, `trusted-types`. They fall through to `default-src 'self'`. `style-src-attr 'unsafe-inline'` is on every route. Severity: **later** (the missing names inherit `'self'`; `upgrade-insecure-requests` only starts to matter on the apex). Fix: add `upgrade-insecure-requests` in the same commit as CUTOVER.md 3.10 if any leftover HTTP asset on the zone must be forced up.

**P1-08.** Shared-cache nonce. `GET /` cold: `CF-Cache-Status: MISS`, TTFB 1.006s. Warm: `HIT`, `Age: 171`. The CSP nonce is in that stored HTML. Recorded on `/colophon` as a deliberate trade. Severity: not a new defect; it is live.

**P1-09.** `workers/app.ts:561-567` `isFeed()` is `application/rss+xml` or `application/json`. Live `GET /blog/rss.xml` had no `Content-Security-Policy`. Live `GET /blog/atom.xml` had a full CSP with `nonce-ce327646-...` and `Cache-Control: public, s-maxage=600`. Atom is `application/atom+xml`, so the nonce makes every Atom body unique and the comment that "the two feeds" skip CSP is false. Severity: **fix before public**. Fix: add `application/atom+xml` (and probably `application/xml`) to `isFeed`.

### Admin plane, previews, 404

**P1-10.** `GET /admin` and `GET /admin/posts` are 302 to `/login`, `private, no-store`. The footer on every public page includes `<a class="footer-login" href="/login">Login</a>` (observed on the 404 HTML). Severity: not a hole (Google + `ADMIN_EMAIL` in `app/lib/auth.server.ts:56`). The door is advertised.

**P1-11.** `GET /preview/not-a-real-token` is 404, `private, no-store`, body 6291 bytes vs 6211 for `/this-page-does-not-exist-audit-xyz`. Same ErrorBoundary (`app/root.tsx:474-488`): skip link, header, `h1` 404, footer. `X-Robots-Tag` is set in `app/routes/preview.$token.tsx:75` as `noindex, nofollow`; the 404 path is the unknown-token case and should not differ in status. Severity: not a leak of token existence.

**P1-12.** 404 copy is `h1` "404" and "The requested page could not be found." (`app/root.tsx:443-446`, confirmed live). Unexpected errors still start as `Oops!` / `An unexpected error occurred.` (`app/root.tsx:437-438`). Severity: **fix before public**. Fix: `This page is not here.` and `The page failed to render.`

### Response times

`curl.exe -w "time_starttransfer:%{time_starttransfer}"`, DFW, 2026-09-11.

| URL | Cold TTFB | Warm |
|---|---|---|
| `GET /` | 1.006s, MISS | HIT, Age 171 |
| `GET /blog` | 1.295s, MISS | (not re-timed) |
| `GET /blog/ten-years-on-cloudflare` | first fetch in the warm block was MISS; next HIT Age 55 | HIT |
| `GET /search` | 1.149s, MISS | HIT, Age 169 |
| `GET /colophon` | 0.768s, MISS | HIT, Age 166 |
| `GET /login` | 0.108s, BYPASS | n/a |
| `GET /api/health` | 4.295s, BYPASS | still no-store |
| `POST /search/ask` `q=what+does+this+site+run+on` | 200 SSE, `x-ask-cache: miss` | 200 SSE, `x-ask-cache: hit` (same body, second POST immediately after) |

**P1-13.** `GET /api/health` 4.3s. The loader runs the suite (`app/routes/api.health.ts:114`). Home no longer does; it reads a KV snapshot (`app/routes/home.tsx:151-154`). Severity: **later** for readers (home is cached). It is the number a monitor pays. Fix: none required for cutover; do not put the suite back on `/`.

**P1-14.** Home origin TTFB ~1.0s on a miss. Severity: **later**. The shared cache is the mitigation (`s-maxage=600`).

### Images, keyboard, headings, JSON-LD, sitemap, feeds, llms, dead links

Fetched every sitemap URL plus `/search`, `/login`, 404, and a bogus preview (47 HTML documents). Extracted headings, `img` alts, JSON-LD, then GET every internal `href`/`src` (203 URLs).

**P1-15.** Images without alt: **none** on those public HTML documents. Phage photos carry `alt="Group photo of the YYYY Phage Discovery Program cohort"` (`app/data/phage-hunters.ts:36`). Cover path uses `alt={post.coverAlt ?? ""}` (`app/routes/blog.$slug.tsx:575`); no live published cover was empty in this sweep. Severity: n/a.

**P1-16.** `app/routes/blog.$slug.tsx:565-569`. Cover `<img>` has no width or height. The comment says D1 stores no dimensions. Severity: **fix before public**. Fix: store pixel size with the cover (the media key already carries dimensions) and render `width`/`height`.

**P1-27.** Ten of eleven post `og:image` URLs 404. Command: `curl.exe -sS -D -` of each `/media/og/<slug>-<hash>.png` named in the live HTML. `/media/og/where-should-a-blog-store-its-words-ec381b0d.png` is 200 `image/png` 45 KB immutable. The other ten, including `/media/og/observable-plot-inside-a-worker-8077d878.png` (the `og:image` on that post) and `/media/og/ten-years-on-cloudflare-f3a31b3c.png`, are 404 `Not found`, `private, no-store`. Site default `/og-image.png` is 200. Unfurlers for 10/11 posts get a broken card. Severity: **fix before public** (becomes **blocks cutover** the day scrapers hit the apex). Fix: rebuild the OG bucket (`npm run build:og` through ship) and add a health check that GETs every public post's `og:image` and refuses a 404.

**P1-17.** Heading order: no skipped levels and every HTML page started at `h1`. Command: the heading walker over the 47 documents, `headingSkips: []`. Keyboard of the header, confirmed live with `agent-browser snapshot -i` on `/`: first node is `link "Skip to content"`, then brand, `navigation "Main"` (Blog, Projects, Playground, Roster, Search), then one visible `button "Switch to dark theme"`. Search is still a link (`href="/search"`). Slash and Cmd/Ctrl-K open the palette (`app/enhance/theme.ts:217-229`). The palette is a native `<dialog>` (`app/enhance/palette.ts:8-12`). A live Tab-by-tab walk hung in `agent-browser eval`; Ask-inside-the-palette was not exercised (see Unverified). Severity: not a defect on the header.

**P1-18.** JSON-LD: every `application/ld+json` block parsed. Home: `Person` and `WebSite`. Posts: JSON array of `Article` plus `BreadcrumbList` (confirmed on `/blog/ten-years-on-cloudflare`). Projects: `ItemList`. `/colophon`, `/privacy`, `/playground`, `/phage-discovery`, `/search` emit none. Severity: **later**. Fix: add `WebPage` (or nothing, if that is the decision) rather than leaving four indexable pages without a graph.

**P1-19.** `app/lib/seo.ts:510-517` `webSiteJsonLd` has no `potentialAction` SearchAction. Severity: **later**. Fix: add `SearchAction` targeting `/search?q={search_term_string}` if you want the sitelink search box.

**P1-20.** Sitemap parsed. 7 static pages + 11 posts + 25 tag archives. No series URLs (no post carries `series:` in frontmatter). `/search` is exempt by name in `scripts/check-invariants.mjs:2915`. Feeds: RSS 11 `<item>`, Atom 11 `<entry>`, JSON Feed 1.1 11 items, `home_page_url` and `feed_url` on workers.dev. Command: `node` parse of the three bodies.

**P1-21.** `content/llms.txt` does not list posts. Live `/llms-full.txt` titles, in order: the same 11 published posts as the sitemap (operator `list_posts` shows 15 files, 4 drafts; `sync_status` `d1PubliclyVisible: 11`). Draft `charts-on-workers-fixture` GET is 404. Severity: not a mismatch. The About line is a prose finding (P3).

**P1-22.** Dead-link sweep: 203 internal URLs. Only non-200s: `GET /api/operator` 401 and `GET /search/ask` 405, both linked from `/colophon` as `href`. Severity: **fix before public**. Fix: render those as code, not as anchors, or point them at `/search` and a documented POST.

**P1-23.** `app/data/phage-hunters.ts:19`. `TODO: "Matthew Bristerpostma" (2018) is likely "Brister-Postma"`. That string is on the live roster. Severity: **fix before public**. Fix: confirm the name and correct the one list entry.

**P1-28.** Live `GET /this-page-does-not-exist-audit-xyz` is 404 `private, no-store` with no `X-Robots-Tag`. Command: `curl.exe -sS -D -`. A well-behaved crawler can still index a 404 body that looks like a site page. Severity: **later**. Fix: stamp `noindex` on the ErrorBoundary response, or on every 404 in the Worker exit path.

**P1-29.** `app/root.tsx:141-154`. Feed autodiscovery is RSS and JSON Feed only. Live `/` has `rel="alternate"` for `/blog/rss.xml` and `/blog/feed.json`, not `/blog/atom.xml`. Atom exists and parses (P1-20). Severity: **later**. Fix: add an Atom `rel="alternate"` next to the other two, or stop serving Atom.

**P1-30.** `app/lib/seo.ts:455-460`. Post JSON-LD is `@type: Article`, not `BlogPosting`. Live `/blog/ten-years-on-cloudflare` parses as `[Article, BreadcrumbList]`. Valid JSON-LD; Google's blog features prefer `BlogPosting`. Severity: **later**. Fix: emit `BlogPosting` (a subtype of Article) if you want those features.

**P1-31.** External links from `/projects` and `llms.txt`. Command: `curl.exe --max-redirs 0` on 2026-09-11. `https://foxhoundapp.com`, `https://foxing.app`, `https://germomics.com`, `https://github.com/DrDustinEdwards/capsid-mcp`, `https://github.com/DrDustinEdwards/dustinedwards-mcp` all 200. The AI Search MCP URL `https://2795d719-a4de-4558-9322-8fced66a48e6.search.ai.cloudflare.com/mcp` is GET 405 (MCP is POST). Severity: not a dead link.

### Cutover operations (still true on this host, will break the apex if skipped)

From `CUTOVER.md` plus what the wire still shows.

**P1-24.** `app/lib/seo.ts:18` `SITE_ORIGIN` is `https://dustinedwards.dustin-edwards.workers.dev`. Canonicals, OG, JSON-LD, sitemap, robots, feeds, and the Google `redirect_uri` all use it. Live login 303 confirmed the workers.dev callback. Severity: **blocks cutover**. Fix: change the constant, `BETTER_AUTH_URL`, the Google redirect, AI Search authorized hosts, MCP `OPERATOR_API_URL` (`dustinedwards-mcp/wrangler.jsonc.example` vars), and `content/llms.txt` contact in the order CUTOVER.md states.

**P1-25.** `workers/app.ts` HSTS `max-age=31536000` without `includeSubDomains`. CUTOVER.md 3.10 says to add `includeSubDomains` and not `preload` at the apex. Severity: **blocks cutover**. Fix: edit `workers/app.ts` and `scripts/check-headers.mjs` in the same commit, after confirming no subdomain is on HTTP.

**P1-26.** CUTOVER.md 1.1: existing Web Analytics `auto_install` on the zone. Not probed (needs the dashboard). If it is still on, orange-cloud injects a nonce-less beacon into an enforcing CSP and the page breaks. Severity: **blocks cutover**. Fix: disable or delete `auto_install` before the toggle.

---

## Part 2. Code quality, both repos

Worktree has no `node_modules`. knip is not in `package.json`. Reachability pass: `rg` of export names against `app/`, `test/`, and `improve/holdout/dustinedwards/imports.txt` (17 names). MCP cloned read-only to `.tmp-mcp-audit/dustinedwards-mcp` @ `6998956`.

**P2-01.** Unused exports (no caller in `app/`, `test/`, or holdout). Command: `rg <name>` returned only the definition.

| Export | File:line |
|---|---|
| `SHARED_CACHE_MINUTES` | `app/lib/seo.ts:270` (comment still names `/admin/mentions` as the reader; that sentence is gone) |
| `isRoutableSeriesSlug` | `app/lib/series-path.mjs:57` |
| `CardGrid`, `StatCard` | `app/components/admin/panel.tsx:85-110` (`EmptyState` in the same file is used) |
| `MarkdownEditorHandle` | `app/components/admin/markdown-editor.tsx:241` |
| `EditorProblem` | `app/components/admin/post-editor.tsx:112` |
| `SearchDoc` | `app/db/schema.ts:413` |

`purgePages` in `app/lib/cache-purge.server.ts:140-150` is documented uncalled on purpose. MCP had no unused exports. Severity: **later**. Fix: delete the unused exports. Do not touch holdout names.

**P2-02.** Duplicated rate-limit wrapper. Same Durable Object `hit(limit, window)` pattern in: `app/lib/auth-rate.server.ts`, `app/lib/search/ask-guard.server.ts`, `app/routes/api.csp-report.ts:101`, `app/routes/webmention.ts:182`, `app/routes/api.health.ts:189`, `app/lib/preview-links.server.ts:222`, `app/lib/operator/auth.server.ts:134`, `app/lib/smoke.server.ts:133`, and MCP `src/rate-limit.ts`. Severity: **later**. Fix: one helper that takes the instance name, limit, and window, if a fourth copy starts to drift.

**P2-02b.** Slug contract split. Site `SLUG_PATTERN` in `app/lib/content/pipeline.mjs:148` is kebab-case with no length cap; `frontmatterSchema` at `:212` is `z.string().regex(SLUG_PATTERN)`. MCP `src/tools.ts:30-33` is the same regex plus `.min(1).max(120)`. An admin can save a slug the operator tools cannot name. Severity: **fix before public**. Fix: put `.max(120)` on the site schema, or drop the MCP max.

**P2-03.** Feed builders. `app/lib/atom-feed.mjs:31` imports `absolutiseUrls, cdata, escapeXml, mathToTex` from `app/lib/rss-feed.mjs`. JSON Feed is a third representation (`app/lib/json-feed.mjs`). Not a clone of the function; the visibility query is shared by the routes. Severity: n/a.

**P2-04.** Functions over 80 lines (brace-count scan, noisy on object literals; these are real):

| Name | File | Lines | Count |
|---|---|---|---|
| `PostEditor` | `app/components/admin/post-editor.tsx:119` | 119-1150 | 1032 |
| `MediaGrid` | `app/components/admin/media-grid.tsx:37` | 37-638 | 602 |
| `MediaInspector` | `app/components/admin/media-inspector.tsx:34` | 34-607 | 574 |
| `action` | `app/routes/admin.media._index.tsx:703` | 703-1152 | 450 |
| `action` | `app/routes/admin.posts._index.tsx:299` | 299-649 | 351 |
| `AdminMedia` | `app/routes/admin.media._index.tsx:1207` | 1207-2128 | 922 |
| `AdminPosts` | `app/routes/admin.posts._index.tsx:665` | 665-1519 | 855 |
| `savePost` | `app/lib/editor/publish.server.ts:386` | 386-641 | 255 |
| `loader` | `app/routes/playground.tsx:221` | 221-481 | 261 |

Severity: **later**. Fix: split `savePost` along commit / D1 / index, and split the two admin actions by verb.

**P2-05.** `any`. `app/routes/playground.tsx:218-219` `children: any[]` and `as any`. `app/lib/editor/publish.server.ts:262,320,702,791,853` `record: any`. `app/lib/projects-page.mjs:79,102` JSDoc `any`. Severity: **later**. Fix: type the publish record as the validate-and-render return.

**P2-06.** Non-null assertions. `app/routes/blog._index.tsx:214` `loaderData!.activeTag!` behind a `tagOnly` guard. MCP `src/auth.ts` `x[i]! ^ y[i]!` on equal-length SHA-256 arrays. Severity: **later**.

**P2-07.** Swallowed catches. `app/lib/theme.ts:106` `catch { return "system"; }` (URIError on a bad cookie; measured). `workers/app.ts:534` `catch { /* Analytics must never cost a reader their page. */ }`. `app/enhance/palette.ts:78,91` localStorage. `app/routes/admin.tsx:361` `catch(e){}` inside the sidebar flash inline script. `app/enhance/ask.ts` JSON.parse of an SSE frame `catch { continue; }`. MCP `src/github-handler.ts` `lookupClient(...).catch(() => null)`. `workers/watchdog.ts:266-268` `readHealth` `catch { return { status: 0, body: null } }` drops DNS vs timeout vs 1042, so the alert cannot say why SITE fetch failed (the repair path at `:300` keeps `error.message`). Severity: **fix before public** for the watchdog catch; **later** for the rest. Fix: put `error.message` on the health reading.

**P2-08.** Tests whose assertions cannot fail. `scripts/check-tests.mjs:11-12` states it cannot see empty `test("x", () => {})` bodies and names `check:assertions` as the owner of that class. There is no `check-assertions.mjs` and no `check:assertions` script in `package.json` (`rg check-assertions` over the tree is comments only). Grep of `test/` found no `assert.ok(true)` and no empty `it()` callbacks. Severity: **later**. Fix: add the script, or stop citing it.

**P2-09.** Names that mean different things. `ASK_BUDGET` is the Ask spend ceiling *and* the process-wide Durable Object used as `auth:`, `op:`, `wm:`, `health:`, `csp:`, smoke, and preview (`app/lib/auth-rate.server.ts:35` and the other `hit` call sites). Removing the Ask binding would disable sign-in. `status`: post draft/published, mention queue, HTTP, health, colophon not-adopted. `origin`: Origin header, `SITE_ORIGIN`, request host, Analytics Engine origin-requests, MCP worker host. `token`: operator, smoke, preview, OAuth. Severity: **later** for the words; **fix before public** for the `ASK_BUDGET` binding name. Fix: rename the class to a limiter, or state in `wrangler.jsonc.example` that this object is the site limiter, not an Ask-only budget.

**P2-10.** Error paths that drop the cause. MCP `src/api-client.ts` JSON parse catch throws `ApiLegError` with status and "body that is not JSON" and drops the parse message. `app/routes/api.operator.ts:69` `catch { return json({ error: "Body must be JSON." }, 400); }`. Severity: **later**. Fix: include `cause` on `ApiLegError`.

**P2-11.** Config drift, example vs the code that names bindings. Parsed CLAUDE.md's `getEnv` list and every `"binding"` / `"name"` in `wrangler.jsonc.example`. Both sides: `AI_SEARCH ANALYTICS APP_KV ASK_BUDGET ASSETS DB IMAGES MEDIA MEDIA_BACKUP OG`. Missing: none. Extra: none. `check:config` still binds the example to the gitignored real file; that half was not run (no `node_modules` here). MCP `wrangler.jsonc.example` `OPERATOR_API_URL` is the workers.dev operator URL; `src/index.ts` `Env` matches the example's KV and Durable Object names. Severity: the workers.dev URL is **blocks cutover** (P1-24), not a silent name drift.

**P2-12.** MCP `src/index.ts`: `/probe` is outside OAuth on purpose. `/mcp` accepts either an OAuth grant or an `AGENT_KEY_*` bearer. Rate limit 30/60s per principal (`src/rate-limit.ts`). `allowedHostnames` is absent; CUTOVER.md 3.5 already says the site repo has no such setting and the wrapper uses `OPERATOR_API_URL`. Severity: covered by P1-24.

---

## Part 3. AI-written residue

### Code

House style is long comments with dates and measurements. Those are not residue.

**P3-01.** `app/routes/home.tsx` (comment above the JSON-LD script): "schema.org data for search and language models". The `type="application/ld+json"` already says this. Severity: **later**. Fix: delete the sentence.

**P3-02.** `app/routes/search.tsx:418` "fail more gracefully" is an argument *against* graceful failure. Keep.

**P3-03.** `app/enhance/ask.ts:176-180` `JSON.parse` catch continues. Severity: **later**. Fix: count skipped frames.

**P3-04.** Last 60 commit subjects (`git log -60 --format="%h %s"`). Sampled subjects match their diffs (`de14ac0` Remove two dead status guards; `1f91c31` Ruling 57 featured post; `57bbdef` Ship trusts CI). No sampled message described a security fix that was only a comment. Severity: n/a.

### Public prose (posts' bodies skipped; descriptions included)

**P3-05.** `app/root.tsx:437-438`. `Oops!` / `An unexpected error occurred.` Remix scaffold. Live 404 uses the other branch. Severity: **fix before public**. Replacement: `Something broke.` / `The page failed to render.`

**P3-06.** `app/root.tsx:445` and live 404. "The requested page could not be found." Severity: **fix before public**. Replacement: `This page is not here.`

**P3-07.** `content/projects.json` descriptions. Six of seven start "It demonstrates". Live `/projects` shows the same sentences. The phage card does not, which is how the template shows. Severity: **fix before public**. Replacement: drop "It demonstrates" and keep the fact that follows.

**P3-08.** `app/enhance/ask.ts:86`. Status text `Thinking...`. Severity: **fix before public**. Replacement: `Looking it up.`

**P3-09.** `app/routes/search.tsx:203`. `Search the writing and pages on ${SITE.name}'s site.` Severity: **later**. Replacement: `Search this site.`

**P3-10.** `app/routes/blog.tags.$tag.tsx:133`. `Every post on ${SITE.name}'s blog tagged ${tag.name}.` Severity: **later**. Replacement: `Posts tagged ${tag.name}.`

**P3-11.** `content/llms.txt:7`. `Writing, projects, and notes.` Severity: **later**. Replacement: `Writing about building this site, and the projects around it.`

**P3-12.** `content/posts/policy-in-the-api-not-the-mcp.md` description: "A practical rule for architects: ..." Severity: **later**. Replacement: drop "A practical rule for architects" and keep the sentence about putting policy in the HTTP API.

**P3-13.** `app/routes/login.tsx:138`. `Access is limited to the site owner.` Severity: **later**. Replacement: `Only I can sign in.`

**P3-14.** `content/stack-notes.json:76-78`. "Continuous integration", status `accepted-gap`, reason "with no CI, any gate can be skipped indefinitely". `.github/workflows/ci.yml` exists, `on: push branches: [main]`, and `57bbdef` is "Ship trusts CI". Live `/colophon` still prints that paragraph under "What was not adopted". Severity: **fix before public**. Fix: move the entry to a dated refusal or delete it; CI is not an accepted gap.

Looked at and not flagged: privacy, colophon measurements, playground intro, roster (bare on purpose, `app/routes/phage-discovery.tsx:21-23`), Ask `No answer for that one.`, other post descriptions. Admin empty states, quoted: `No posts yet.` (`admin.posts._index.tsx:1143`), `No posts match …` (`:1135`), `Nothing here yet` / `Every file passes this check` (`media-empty-state.tsx:59,84`), `No origin requests recorded in this window.` (`admin.origin-requests.tsx:82`). Those are sentences a person would say.

---

## Part 4. What a stranger does not understand

Opened `/`, `/projects`, `/colophon` as HTML. No about page exists (`app/routes.ts` has no about route).

### Home

The hero is a name, "Full-stack engineer", and "Professor by training. I build on Cloudflare and publish the numbers." Tarleton State University is in `Person` JSON-LD (`app/lib/seo.ts:189-192`) and not in the hero. The next block is "The evidence, read when this page rendered": 36 automated checks, a health fraction, 11 posts.

1. Who is this, and where do they work? The page never names the university in human-visible text.
2. What should I read if I do not care how the site is built? Everything "Start here" is about this site's own machinery.
3. How do I contact you? There is no email, no about page, and the footer is Colophon / Privacy / llms.txt / RSS / Login.

### Projects

Every card is a number, a stack list, and a paragraph that starts "It demonstrates" except the roster. Foxhound, Foxing, Germomics have visit links; Capsid and the MCP wrapper have GitHub; the site card's visit URL is the workers.dev origin.

1. Are these products I can use, or write-ups of things you built for yourself?
2. What is your relationship to Foxhound / Foxing / Germomics beyond "Sole author" or "Author and host"? Who is the customer?
3. Why does the first card tell me to visit dustinedwards.info while I am already on a workers.dev host that is that site?

### Colophon

The page is a generated inventory of bindings, migrations, gates, and refusals, then an AI disclosure that names Claude.

1. Is this for me, or is it the build's own log published at a URL?
2. What do I do with `ASK_BUDGET` and `new_sqlite_classes` if I just wanted to know what the site is?
3. The "Continuous integration (Accepted gap)" paragraph says there is no CI. Why is that still on a page that claims every sentence is checked against the repository?

---

## Unverified

| Claim | What would verify it |
|---|---|
| Web Analytics `auto_install` still bound to the zone | Cloudflare dashboard / API for the dustinedwards.info zone ruleset (CUTOVER.md 1.1) |
| AI Search Authorized hosts still workers.dev only | AI Search dashboard Public URL host list (CUTOVER.md 3.4) |
| `BETTER_AUTH_URL` secret value | `wrangler secret` / dashboard; I did not read secrets. Live Google `redirect_uri` is workers.dev |
| Session cookie after a completed Google login | Sign in as the admin and read `Set-Cookie` on the callback. State cookie flags were observed; the session cookie was not |
| Command palette focus trap, Escape, and Ask field by keyboard | `agent-browser snapshot` showed the header; a Tab/`/` walk hung in `eval`. Source: native `<dialog>`, `/` and Cmd-K in `theme.ts:217-229` |
| knip (tool) unused files | knip is not a dependency; the reachability pass in P2-01 is the substitute |
| `check:config` example-vs-real `wrangler.jsonc` | `npm run check:config` (needs the gitignored file). Example vs CLAUDE.md names already match (P2-11) |
| JSON-LD accepted by Google's Rich Results Test | Paste a post graph; local `JSON.parse` succeeded (P1-18, P1-30) |
| MCP `/authorize` cookie flags on the live wrapper | GET/POST the deployed MCP worker; cookie string is in `src/github-handler.ts` as `HttpOnly; Secure; SameSite=Lax; Path=/callback` |
| Draft leak through the public AI Search MCP URL in `llms.txt` | Call that MCP with a draft slug. Colophon claims drafts never upload. GET of the URL is 405 |

---

## Counts

| Part | Numbered items | blocks cutover | fix before public | later |
|---|---|---|---|---|
| 1 Security / perf / a11y / SEO / ops | 31 | 4 (P1-05 redirect URI, P1-24, P1-25, P1-26 unverified on the zone) | 7 (P1-04, P1-09, P1-12, P1-16, P1-22, P1-23, P1-27) | 11 (P1-01, P1-02, P1-03, P1-07, P1-13, P1-14, P1-18, P1-19, P1-28, P1-29, P1-30) |
| 2 Code quality | 14 | 0 (MCP URL folded into P1-24) | 3 (P2-02b slug cap, P2-07 watchdog, P2-09 `ASK_BUDGET` name) | 9 |
| 3 AI residue | 14 | 0 | 5 (P3-05, P3-06, P3-07, P3-08, P3-14) | 7 (P3-01, P3-03, P3-09, P3-10, P3-11, P3-12, P3-13) |
| 4 Stranger questions | 9 questions, 0 defects | 0 | 0 | 0 |

Numbered defects that carry a severity: **46** (4 + 7 + 11 + 3 + 9 + 5 + 7). Unverified rows: **10**.

Part 1 "blocks cutover" is the toggle list, not a claim that the current workers.dev host is misconfigured.

---

## Ten to fix first

1. **Ten of eleven post social cards 404** (P1-27). Live `og:image` for `/blog/observable-plot-inside-a-worker` is `/media/og/observable-plot-inside-a-worker-8077d878.png`, which answers 404. Only `where-should-a-blog-store-its-words` has a card. Rebuild OG and gate it.
2. **Disable Web Analytics `auto_install` on the zone** before orange-cloud (P1-26). If it is still on, enforcing CSP blocks the injected beacon and the public page is blank.
3. **The cutover constant set** (P1-24, P1-25, P1-05): `SITE_ORIGIN`, `BETTER_AUTH_URL`, Google redirect URI, AI Search authorized hosts, MCP `OPERATOR_API_URL`, `content/llms.txt` contact, HSTS `includeSubDomains`.
4. **Colophon still says CI is an accepted gap** (P3-14). It is a false sentence on the page that claims it cannot be.
5. **`isFeed()` misses Atom** (P1-09). RSS has no CSP; Atom has a per-request nonce on a cacheable feed.
6. **POST `/api/health` is a framework "Unexpected Server Error"** (P1-04).
7. **404 / 500 copy** (P3-05, P3-06, P1-12): `Oops!` and `The requested page could not be found.`
8. **Six project cards start "It demonstrates"** (P3-07).
9. **Cover images have no width/height** (P1-16).
10. **Roster name TODO is live** (P1-23). A person's name.

Ask `Thinking...` (P3-08) is eleventh if the ten above land in one pass.
