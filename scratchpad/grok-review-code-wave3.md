# Code-history-out wave 3 review: `review/code-history-out-wave3-draft` vs `main`

Compared merge-base `fda6ef1` (the wave 2 merge, local `main`) to `origin/review/code-history-out-wave3-draft` `fecfdca`. The branch rewrites comments in the 88 TypeScript files under `workers/` and `app/` listed as `WAVE3` in `scratchpad/code-wave3.mjs`, then recuts headers. Four HISTORY blocks are deleted. Executable code is unchanged.

`origin/main` `5689c72` is six playground-ui commits ahead of that merge-base. Two of the 88 files also changed there (`app/routes.ts`, `app/routes/sitemap.ts`). The comment cut is measured against `fda6ef1`, which is the wave's own base.

Dated floor logs that still have their why beside the rule are not listed. Those moved on purpose under ruling 115 and hard rule 17. What follows is meaning a reader of the new comment no longer has.

The four HISTORY deletes (`cookieDowngrade`, the cookieless-only rule, `recordTraffic` moved, `slugifyName`) restated facts the remaining comments or the code still carry, and are not listed.

## Lost or changed meaning

### 1. `app/lib/seo.ts` (`SERP_TITLE_LIMIT` / `SERP_DESCRIPTION_LIMIT`)

**Old:**

> Where a search result stops, which is NOT where the description field's own counter stops.
>
> Google truncates by rendered PIXEL width, roughly 600px of title and 920px of desktop description, so any character count is an approximation of a measure this site cannot take. These are the usual approximations of those widths and they are stated as such: a preview that cut at the field's 160-character counter would show a full description in a result that will actually be clipped, which is the one thing a SERP preview exists to prevent.

**New:** none. The constants sit with no comment.

**Lost:** The why of 60 and 155, and the prohibition on cutting at the description field's 160-character counter. The rewrite tag said the pixel widths stay, because they are what the numbers approximate. They did not. Changing 60 or 155 now looks like a character-count tweak. The editor preview still tells an author the limits are approximate (`social-previews.tsx`); that is UI copy, not a comment on the constants.

### 2. `app/routes/llms-full[.txt].ts` (header)

**Old:**

> Composing here removes the drift rather than gating it: there is no second copy that can disagree. The markdown itself is still gated, because it comes from the same `posts.body` the generator wrote.

**New:**

> Composing here removes the drift rather than gating it.

**Lost:** The boundary that request-time composition is not an ungated document. The leftover sentence now stands alone and can be read as the opposite. Nothing else in the file restates that `posts.body` is still gated.

### 3. `workers/watchdog.ts` (header)

**Old:**

> `.github/workflows/health.yml` has done this since 2026-08-23 and its own docblock explains why an in-Worker watcher was rejected: a watcher that runs inside the thing it watches dies with it. That argument is still correct and this Worker does not contradict it. **A SEPARATE Worker on the same account has the property the rejection wanted** against everything except a Cloudflare-wide outage, in which case the site is down anyway and there is nothing to report.

**New:**

> THE WATCHDOG. A separate Worker whose only job is to notice that this site has stopped being healthy, repair what it can, and wake somebody otherwise.

**Lost:** The prohibition on folding this into the site Worker. The remaining header still names the four boundaries (cannot `fetch()` this site, the binding does not prove internet reachability, nothing may write the snapshot, nothing is decided here). It does not say an in-Worker watcher dies with the thing it watches, which is why this is a separate Worker at all.

### 4. `workers/app.ts` (cookie downgrade)

**Old:**

> WHAT IT IS FOR NOW, since the reason changed with the layer. There is no shared cache in front of the gateway on workers.dev, so this is not protecting the platform cache from itself; it is telling a BROWSER or an intermediary proxy not to hold a document that genuinely differs per reader. One header, and it fails in the safe direction.

**New:**

> THE COOKIE DOWNGRADE, kept as belt and braces, and it cannot live in the Renderer: that response is the one the platform STORES, so writing `private, no-store` there for a cookied reader would mean cookied readers were never cached.
>
> Keyed on the PRESENCE of any cookie, the fail-closed reading, since a request holding only a session cookie must not read as cookieless.

**Lost:** What the header is for now. A reader still knows it cannot live in the Renderer and that presence of any cookie is the fail-closed key. They no longer know there is no shared cache in front of the gateway on workers.dev, so this stamp is not protecting the platform cache from itself; it is telling a browser or an intermediary not to hold a per-reader document.

### 5. `workers/app.ts` (cache key)

**Old:**

> `ctx.props` is in the key by construction and cannot be dropped; a custom `cf.cacheKey` REPLACES the path and query and is honoured only for same-account loopback calls. So passing the theme in props alone would be sufficient, and the docs say so in as many words. It goes in both because the pair is what this function returns and what the tests read: a key string that did not mention the theme would make the pure function's output a poor description of the real key, and the next reader would have to know the props rule to see the dimension at all.

**New:**

> WHAT THE CACHE KEY IS: the path, and the theme, which is the only thing read off the cookie and rides in both the props and the custom key.

**Lost:** That a custom `cf.cacheKey` replaces the platform's path and query, and is honoured only for same-account loopback. The remaining comment still says the key carries the path and the theme. It does not say why the path has to be written into that string, or that the custom key is a loopback-only override. A key of `theme=dark` would collapse every page.

### 6. `app/lib/operator/api.server.ts` (`uploadMediaTool`)

**Old:**

> TWO WAYS IN, AND THE URL IS THE LOAD-BEARING ONE
>
> `data` is base64, which is the obvious shape and the one that does not scale: a 13 MB photograph is 17 MB of base64 and no agent is carrying that through a conversation. `url` is what makes the tool usable, and it is why the ruling named both.

**New:**

> IT IS AN ADAPTER and `storeUpload` is the write: the allowlist, the size limit and the key are the same code the admin upload runs. What is here is only how bytes REACH that door.

**Lost:** That `url` is the load-bearing door, and why `data` cannot be the only one. The adapter rule, the three guards, "exactly one source", and "the declared type wins" remain.

### 7. `app/lib/search/ask-guard.server.ts` (drift-cache TTL)

**Old:**

> WHY 300 SECONDS, and not a round number chosen for looking tidy
>
> Three constraints, and the measurement picks the value between them.
>
> FLOOR: KV refuses a TTL under 60 seconds, so 60 is the shortest expressible.
>
> [...]
>
> THE FRESHNESS SIDE, and this is the constraint that set the value rather than the cost. [...] 300s bounds how long the badge can under-report that. Five minutes of an under-reported badge on a page that is not the repair page is not a defect anyone can be harmed by; an hour would start to be.

**New:**

> THE FRESHNESS SIDE SET THE VALUE, not the cost. `askExpectedUrls` composes `visibilityClause`, so the expected set is a function of THE CLOCK: a scheduled post whose `publish_at` passes becomes expected and `missing` grows with no write anywhere. TTL expiry is what recomputes on the clock's schedule, and the TTL bounds how long the badge can under-report that.

**Lost:** Why the value is 300 rather than 60 or 3600. KV's 60-second floor is gone, and so is the harm bound (five minutes of an under-reported badge is harmless; an hour would start not to be). `DRIFT_CACHE_TTL_SECONDS = 300` still sits next to "stated here and repeated to the reader"; changing it now looks like a preference.

### 8. `app/routes/search.ask.ts` (form body)

**Old:**

> The question travels in a FORM-ENCODED BODY, which is what an ordinary `<form method="post">` sends. Ask has no no-script form today (the trigger is a button that does nothing without script, and its declared fallback is the classic results already on the page), but reading the body this way means adding one later is markup and nothing else.

**New:**

> The question travels in a FORM-ENCODED BODY, which is what an ordinary `<form method="post">` sends. Ask has no no-script form today, but reading the body this way means adding one later is markup and nothing else.

**Lost:** The declared fallback: the trigger is a button that does nothing without script, and the page already showing classic results is the no-script path. "Has no no-script form today" now reads as a gap rather than as a fallback that already exists.

### 9. `app/enhance/blog.ts` (heading permalink focus)

**Old:**

> `focus()` on the heading rather than `scrollIntoView`, because moving focus is what a screen reader announces and what the next Tab continues from; scrolling alone moves the eye and leaves the keyboard behind. Headings are not focusable by default, so `tabindex="-1"` is set for the duration and removed afterwards: it makes the element programmatically focusable without adding it to the tab order.

**New:**

> `focus()` on the heading rather than `scrollIntoView`, because moving focus is what a screen reader announces and what the next Tab continues from; scrolling alone moves the eye and leaves the keyboard behind. Headings are not focusable by default, so `tabindex="-1"` is set for the duration and removed afterwards.

**Lost:** Why `-1` and not `0`: programmatic focus without putting the heading in the tab order. A later edit that "fixes" focusability with `tabindex="0"` now has no prohibition sitting next to the attribute.

### 10. `app/lib/search/search.server.ts` (snippet markers)

**Old:**

> snippet() splices these into text it does not escape, so writing `<mark>` directly would mean rendering unescaped content as HTML. Every indexed string is ours, but "ours" includes a post that legitimately discusses `<script>` or shows HTML in a code block, and that text reaches the index as prose. Control characters cannot occur in the corpus, so the snippet is escaped first and the markers are swapped for real tags afterwards.

**New:**

> snippet() splices these into text it does not escape, so writing `<mark>` directly would mean rendering unescaped content as HTML: a post may legitimately show `<script>` in a code block, and that text reaches the index as prose. The snippet is escaped first and the markers are swapped for real tags afterwards.

**Lost:** Why SOH/STX are usable as markers: they cannot occur in the corpus. The neighbouring line still says the bytes are built at runtime so no control byte is written into this source file; that is a grep/diff concern, not the corpus invariant that makes the swap safe.

### 11. `app/env.d.ts` (`OPENALEX_API_KEY`)

**Old:**

> On a clean CI checkout there is no `.dev.vars`, wrangler generates nothing, and this line is the only declaration. Same shape either way, which is what stops the two environments disagreeing about whether the Worker compiles.

**New:**

> WHY THIS ONE IS NOT MARKED OPTIONAL, WHEN ITS CONTRACT IS. Because `.dev.vars` is also where the build reads it, `wrangler types` SEES IT and generates it as required. Declaring it `?: string` here widens the merged `Env` so it stops being assignable to `Cloudflare.Env`. THE OPTIONALITY IS ENFORCED IN CODE INSTEAD: `citations.server.ts` checks the value before spending a request, because an unset secret is `undefined` at runtime whatever the type says. The type is not the contract here; this comment is.

**Lost:** Why the declaration must exist here at all: on CI there is no `.dev.vars`, so wrangler generates nothing and this line is the only one. The remaining comment still says why it cannot be marked `?:`. It does not say removing the line would compile locally and fail on a clean checkout.

### 12. `app/lib/cache-purge.server.ts` (header)

**Old:**

> `success` IS READ, which is the half that is easy to skip. `purge` resolves with `{ success, errors }` rather than rejecting on a refusal, so a caller that awaited it and looked at nothing would report a purge that never happened. Rate limits are the Free-tier zone limits regardless of plan, which is the realistic way this comes back false.

**New:**

> `success` IS READ, because `purge` resolves with `{ success, errors }` rather than rejecting on a refusal, so a caller that awaited it and looked at nothing would report a purge that never happened.

**Lost:** That a false `success` is the Free-tier zone purge limit, and that those limits apply regardless of plan. Remaining comments still require reading `success`. They no longer say what actually returns it false. The same Free-tier sentence, plus the repair ("if that ever binds, the fix is a condition that reads the PREVIOUS status"), also left `app/lib/editor/publish.server.ts`.

### 13. `app/lib/media/rebuild.server.ts` (static manifest)

**Old:**

> The static half comes from the committed manifest because a Worker CANNOT list its own static assets: the assets binding has exactly one method, `fetch()`, so it can serve any path it is given and discover none of them. `build:assets` walks public/ and commits the list; `check:media` compares that list against the filesystem so a stale one is named as stale.

**New:**

> The static half comes from the committed manifest because A WORKER CANNOT LIST ITS OWN STATIC ASSETS: the assets binding has exactly one method, `fetch()`.

**Lost:** How the committed list stays honest: `build:assets` writes it from `public/`, and `check:media` compares it to the filesystem so a stale manifest is named as stale. The remaining comment still says why a Worker cannot discover the files. It does not say what names a list that has drifted.

## Comment-stripped source

The stripper is `stripComments` from `scripts/lib/strip-comments.mjs` (the gates' tokenizer), default options: each comment becomes a space, no `preserveLines`. All 88 files in `WAVE3` were compared from `fda6ef1` to the draft `fecfdca`.

Raw strip is not byte-identical in 22 of the 88. Those 22 are smaller on the draft side, by leftover empty lines: a deleted or shortened own-line comment leaves a whitespace-only line in the stripped original and no line in the stripped draft. In every one of those 22, the count of lines that still carry code is the same on both sides.

Dropping whitespace-only lines, all 88 files are byte-identical. The same holds after also stripping trailing blanks on remaining lines. Mismatch count on either comparison: 0.

A control that changes one code character in `workers/app.ts` is detected, so the comparison can tell two things apart (hard rule 12).

86 of the 88 files are the same bytes on `origin/main` as on `fda6ef1`. The other two are `app/routes.ts` and `app/routes/sitemap.ts`, which playground-ui also edited.

Tag table on the draft: CONTRACT 810, WHY 178, NUMBER 25, HISTORY 4; rewrite 564, keep 449, delete 4.
