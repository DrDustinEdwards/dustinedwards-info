# Code comment history, 2026-09, wave 1

Extracted by job_2cec82881996 under ruling 115, from cdb4300. Every comment
block the job deleted or shortened in the ten heaviest code files is here
VERBATIM, with the file and line it had at cdb4300, its tag, and why it moved.
The files keep only the short why and the contract; this is where the
measurements, dates and the story went.

## scripts/check-browser.mjs

### scripts/check-browser.mjs:3 (CONTRACT, shortened)

usage and observation boundary kept; audit story, tool choice and dev-server measurement moved.

```js
/**
 * Gate: the site as a BROWSER LAYS IT OUT, not as markup.
 *
 *   npm run check:browser
 *   npm run check:browser -- --keep    leave the preview server running
 *
 * ## OBSERVATION BOUNDARY
 *
 * **ONE BROWSER, ONE ENGINE.** Chromium, via the Puppeteer already installed in
 * this repo. Nothing here says anything about Firefox, Safari or WebKit on iOS,
 * and the layout defects this repo has shipped were engine-agnostic, so that is
 * a real limit rather than a theoretical one.
 *
 * **TWO VIEWPORTS**, 1280x900 and 320x800. A defect that appears only at 768 or
 * only at 1440 is invisible here. 320 is the narrowest commonly cited phone
 * width and the one the recorded defects were about; 1280 is where the column
 * layout is supposed to be at its widest.
 *
 * **IT LOADS A LOCAL PREVIEW BUILD, not the deployed Worker.** So it proves what
 * the working tree renders, which is the point, and proves nothing about what is
 * live. `verify-live` owns that and needs the wire. **The admin cases are the
 * one exception and they invert this**, for a reason measured below.
 *
 * **UNLESS `PUBLIC_ORIGIN` IS SET, WHICH INVERTS THE SENTENCE ABOVE.** With it,
 * the public cases drive a deployed site, nothing is built and no server is
 * started, and the whole gate speaks about one live build. That is what the
 * daily CI schedule runs, and it is a DIFFERENT question: a green run there
 * proves nothing about uncommitted work, exactly as a green local run proves
 * nothing about what is live. The banner names which one ran, every run,
 * because these two are easy to confuse and expensive to confuse.
 *
 * **IT DOES NOT LOOK.** Every assertion is a number from `getBoundingClientRect`
 * or an attribute from the DOM. A page that lays out correctly and is unreadable,
 * mis-coloured, or has its z-order inverted passes here. Screenshots would need a
 * human or a baseline, and a baseline is a fixture that drifts.
 *
 * **THE ADMIN CASES ARE OPT-IN, AND THERE ARE NOW TWO WAYS TO OPT IN.**
 * Preferred: the read-only SMOKE credential, a bearer token in `.smoke-token`
 * or at `SMOKE_TOKEN_FILE`, which authenticates as its own machine principal
 * and is the one a CI run can hold. Fallback: a real admin session cookie in
 * `.admin-session`, pasted out of Chrome by a human. Either way, ABSENT they
 * skip loudly, and SUPPLIED AND UNUSABLE they FAIL, because a file on disk is a
 * request for them.
 *
 * **WHICH ONE RAN DECIDES WHAT A GREEN RESULT MEANS, and the run says so.** The
 * smoke actor is read-only by construction, so under it these cases prove what
 * a machine can RENDER and nothing about any write surface. Under the cookie
 * they run as Dustin, which proves more and proves it only when Dustin is
 * sitting there. The banner names the credential and the residue.
 *
 * **NOTHING HERE SUBMITS ANYTHING, under either credential.** The interaction
 * cases click client state and read numbers back; the destructive ladder is
 * asserted by whether its button is ENABLED, never by pressing it.
 *
 * **THE ADMIN CASES DO NOT OBSERVE THE PREVIEW BUILD.** They cannot, and that is
 * measured rather than assumed: sessions live in the PRODUCTION KV namespace,
 * the preview server runs against local miniflare storage, and a real session
 * cookie presented to the preview lands on /login every time. So when they run
 * at all they run against `ADMIN_ORIGIN`, a DEPLOYED Worker, which means they
 * prove what is live and prove nothing about the working tree. That is the
 * opposite of every other case in this file. It is the price of the "cannot be
 * faked" rule below, and the banner says so at runtime.
 *
 * ## Why this exists
 *
 * Audit 2.3. Twenty-seven gates and none of them had ever laid out a page:
 * `check:admin-ui` renders routes with `.server` imports stubbed AND NO
 * STYLESHEET, and says so in its own header. Five layout defects shipped
 * invisible to the whole suite, and a sixth class, a component that renders in
 * markup and fails to MOUNT, took the editor down for two days with every gate
 * green.
 *
 * ## Why Puppeteer rather than Playwright
 *
 * Playwright is the better tool in the abstract: three engines, better tracing,
 * better waiting primitives. It was rejected on cost that is specific to this
 * repo. **Puppeteer 25.4.0 is ALREADY a declared devDependency** and its Chrome
 * is already downloaded, because `build:diagrams` renders mermaid through
 * `@mermaid-js/mermaid-cli`, which drives Puppeteer. Adding Playwright means a
 * second browser stack, a second ~150MB download in `npm ci`, and two automation
 * APIs in one repo, to gain engines this gate's own boundary already says it is
 * not testing. Verified before choosing: `puppeteer.launch()` succeeded headless
 * on Chrome/151.0.7922.47 with no install step.
 *
 * ## Why a PREVIEW build and not the dev server
 *
 * MEASURED, and it nearly produced a spec that asserted nothing. Against
 * `npm run dev` the page came back with `document.styleSheets.length === 1`,
 * `0` total CSS rules, `getComputedStyle(.page-head).maxWidth === "none"` and an
 * 8px body margin: the app stylesheet was not applied at all, so `.blog-search`
 * and `.page-head` measured identical full-bleed widths and every column
 * assertion would have passed on an unstyled page. That is exactly the
 * `check:admin-ui` failure this gate exists to replace, reproduced by accident.
 * The preview build serves `assets/root-*.css` as a real stylesheet and the same
 * measurement immediately separated 1216px from 768px.
 */
```

### scripts/check-browser.mjs:110 (WHY, shortened)

trimmed.

```js
/*
 * The profile the /blog layout shift was found on, named rather than restated
 * so it cannot drift from the measurement that set the ceiling below.
 */
```

### scripts/check-browser.mjs:116 (WHY, shortened)

trimmed.

```js
/*
 * IMPORTED, NEVER RESTATED. The home tile's freshness assertion compares
 * against the same constant the tile itself decides with, so a schedule change
 * moves the gate and the page together. A digit here would be a third copy of
 * a number that already has two owners bound by check:invariants section 25.
 */
```

### scripts/check-browser.mjs:135 (WHY, shortened)

placement reason kept; 2026-09-03 measurement moved.

```js
/**
 * What a live command line must STILL contain before this gate is allowed to
 * kill the process holding it.
 *
 * DECLARED HERE rather than beside the spawn that uses it, because the port
 * preflight further down runs BEFORE anything is spawned and needs the same
 * needles. One spelling, one owner: two lists would drift and the drift would
 * show up as a refusal to clean up the gate's own leftover.
 *
 * MEASURED against the real holder 2026-09-03. The process that binds 4173 is
 * `node .../vite/bin/vite.js preview --port 4173`, not the npx or cmd wrappers
 * above it, so all three needles are satisfied by the listener itself.
 */
```

### scripts/check-browser.mjs:150 (WHY, shortened)

purpose and gitignore reason kept; 2026-08-31 measurement moved.

```js
/**
 * WHAT THIS GATE STARTED, so the next run can clear what a kill left behind.
 *
 * Gitignored, for the reason `/.ship-logs/` is: `npm run ship` refuses on any
 * dirty tree, untracked files included, so a file the gate writes about itself
 * would make the next ship refuse because of the last check:browser.
 *
 * The registry exists because THE ORDERLY CLEANUP BELOW CANNOT COVER A HARD
 * KILL. On Windows a `taskkill /F` is not deliverable as a signal: no handler
 * runs, no `finally` runs, and `browser.close()` never happens. Measured
 * 2026-08-31, that leaves the vite side holding port 4173 with no owner and no
 * way for anything in THIS process to have prevented it. So the repair belongs
 * to the next run, which is what this file is for.
 */
```

### scripts/check-browser.mjs:166 (CONTRACT, shortened)

two modes kept; narrative moved.

```js
/**
 * WHERE THE PUBLIC CASES LOOK, and it changes what a green run MEANS.
 *
 * Unset, which is every local run: the gate builds the working tree, serves it
 * with `vite preview`, and the public cases observe THIS DISK. That is the
 * whole reason the preview exists, and it is the instrument that can see a
 * layout defect before it ships.
 *
 * Set, which is the CI schedule: the public cases observe the DEPLOYED site
 * instead, no build and no preview server. That is a different question with a
 * different answer, and the banner says which one ran, because a green run
 * against production proves nothing about uncommitted work and a green run
 * against the preview proves nothing about what is live.
 *
 * The ADMIN cases have always observed the deployment (the smoke credential is
 * a wrangler secret and no local server can answer for it), so under this
 * variable the whole gate speaks about one build for the first time.
 */
```

### scripts/check-browser.mjs:189 (WHY, shortened)

no-fake prohibition and cookie-name trap kept; three-session and 2026-08-21 story moved.

```js
/**
 * A real admin session, read from a FILE first and the environment second.
 *
 * **THE ADMIN CASES CANNOT BE FAKED AND ARE NOT.** Better Auth holds the session
 * in KV, the single admin signs in through Google, and this repo has NO
 * `.dev.vars` by design, so no local server can mint a session. A test-only
 * bypass would mean the spec authenticates through a path production does not
 * have, and the defect it exists to catch, the editor's Suspense boundary
 * failing under the enforced CSP, lives in the real authenticated render. A
 * stub would have passed while the editor was broken in production.
 *
 * ## WHY A FILE, AND NOT THE ENVIRONMENT VARIABLE ALONE
 *
 * `ADMIN_SESSION_COOKIE` has to be exported in the SAME SHELL the gate runs in,
 * and it was absent in three consecutive sessions. That is not bad luck, it is
 * the design: a variable that lives in one shell cannot survive the next one,
 * and nothing in the repo can carry it forward. The cost is recorded rather
 * than theoretical. The admin block's executed-count floor is DERIVED instead
 * of measured, and its sideways-scroll plant is still owed, both because the
 * cases have never once run.
 *
 * A gitignored file at the repo root survives shells, survives sessions, and is
 * checked by `git check-ignore` rather than by assumption. `.admin-session.example`
 * is tracked beside it and carries the five Chrome clicks that refill it.
 *
 * THE ENVIRONMENT STILL WINS where it is set, so nothing that works today stops
 * working. It is not free: the variable now has to carry the same `name=value`
 * form the file does, because the old leniency is the defect below.
 *
 * ## WHAT THE VALUE HAS TO BE, AND WHY GUESSING FAILED
 *
 * MEASURED 2026-08-21: `ADMIN_SESSION_COOKIE` held the cookie's VALUE with no
 * `name=` segment, was passed whole to a `Cookie:` header, and produced a header
 * with no name that no server can parse. The repair at the time was to ask
 * whether the string contained an `=` and to prepend the canonical name when it
 * did not.
 *
 * **THAT TEST CANNOT WORK AND IS REPLACED HERE.** A Better Auth token is
 * `<id>.<base64 hmac>`, and base64 pads with `=`. So a bare value carrying
 * padding contains an `=`, is read as already-named, and gets split at the
 * padding: the name becomes the token and the value becomes the empty string.
 * Silently, and the failure that follows blames the session.
 *
 * There is no string test that separates those two cases, so the gate stops
 * guessing and states the requirement instead: the pair, with its name. The one
 * unambiguous case is kept, because it cannot be misread: a value with NO `=`
 * anywhere is a bare token and is given the canonical name here.
 */
```

### scripts/check-browser.mjs:241 (CONTRACT, shortened)

trimmed.

```js
/**
 * Reads the session file, or null when there is none.
 *
 * `key = value`, `#` comments, blank lines ignored. A non-comment line whose key
 * is not one this understands is taken as the cookie itself, so a bare
 * `name=value` pasted straight out of DevTools works without the `cookie = `
 * prefix. Forgiving about the shape of the line, exact about the cookie, which
 * is the half that cannot be guessed at.
 *
 * @param {string} path
 */
```

### scripts/check-browser.mjs:270 (CONTRACT, shortened)

never-print-values rule kept.

```js
/**
 * Turns whatever was supplied into the one `name=value` pair to send, or names
 * what was wrong with it.
 *
 * Accepts a whole `Cookie:` header, so pasting from the Network tab works: the
 * session cookie is picked out by name and everything else is dropped, because
 * `applySession` sets ONE cookie and the wire check sends one pair.
 *
 * **RETURNS NAMES, NEVER VALUES.** The diagnostic says which cookie names were
 * found and how long the string was. A gate that echoes a live session token
 * into a terminal, a CI log or a report has published it.
 *
 * @param {string} raw
 * @returns {{ pair: string, error: string }}
 */
```

### scripts/check-browser.mjs:289 (WHY, shortened)

ordering reason kept; plant story moved.

```js
/*
   * THE PLACEHOLDER IS CHECKED FIRST, and the plant is why.
   *
   * `__Secure-better-auth.session_token=PASTE_THE_VALUE_HERE` is a WELL FORMED
   * pair carrying the right name, so every structural test below passes it and
   * the request goes out and is refused. That reached the "almost certainly
   * EXPIRED" branch and told an operator who had never pasted anything that
   * their session had run out. The repair it named happened to be right; the
   * diagnosis was invented.
   *
   * A file copied and not filled in is its own state and gets its own sentence.
   */
```

### scripts/check-browser.mjs:325 (WHY, shortened)

redaction reason kept; plant story moved.

```js
/*
   * REDACTED BY DEFAULT, because the thing being described might be the secret.
   *
   * The malformed case that matters most is a bare token pasted with no name.
   * Parsed as pairs, its "name" IS the session token, so a diagnostic that
   * helpfully lists the names it found would print a live credential into the
   * terminal, and into any CI log the gate ever runs in. Measured on the first
   * plant, which is how this exists.
   *
   * So a segment is echoed only when it LOOKS like a cookie name: short, and
   * built from the characters names actually use. A Better Auth token is
   * neither, so it redacts to its length. This heuristic decides only what to
   * PRINT, never what to accept, and it errs toward printing nothing.
   */
```

### scripts/check-browser.mjs:362 (WHY, shortened)

trimmed.

```js
/**
 * Where to go and refill, named after WHICH source was actually read.
 *
 * The environment wins when it is set, so a stale variable in the shell makes
 * the file irrelevant, and "refill .admin-session" would send the reader to edit
 * a file the gate is not reading. Naming the wrong repair is the exact failure
 * this block was rewritten to remove.
 */
```

### scripts/check-browser.mjs:375 (WHY, shortened)

trimmed.

```js
/**
 * The origin the admin cases drive, which is NOT the preview server.
 *
 * MEASURED, and it is why this exists at all: a valid production session
 * presented to `vite preview` renders the login page, because the preview's
 * APP_KV is local miniflare storage and the session is a key in the production
 * namespace. Nothing about the cookie is wrong in that case, so the gate must
 * not report it as a rejected session.
 *
 * Comes from the same file as the cookie, so setting the session up is one file
 * and not a file plus a variable. The environment overrides it, on the same
 * footing as the cookie above.
 */
```

### scripts/check-browser.mjs:390 (CONTRACT, shortened)

states and never-print kept; dated narrative moved.

```js
/**
 * THE SMOKE CREDENTIAL, and it is the preferred way in since 2026-08-24.
 *
 * A read-only bearer token that authenticates as its own machine principal
 * rather than as Dustin. It is what moves these cases out of his hands: a
 * session cookie has to be pasted out of Chrome by a human, expires, and cannot
 * be minted by CI, so the admin block had NEVER RUN unattended and the header
 * above still records its floor as derived rather than measured because of it.
 *
 * Read from a FILE, on the `.admin-session` precedent and for the same reason:
 * a variable exported in one shell cannot survive the next one, and that cost
 * three consecutive sessions. `SMOKE_TOKEN_FILE` names the path; absent, the
 * gitignored `.smoke-token` at the repo root is used if it is there.
 *
 * **THE VALUE IS NEVER PRINTED, and no diagnostic below quotes it.** The
 * failures report the SOURCE and the LENGTH only, which is everything needed to
 * repair a bad token and nothing that helps anyone use a good one.
 *
 * ## THREE STATES, AND THE MIDDLE ONE IS A FAILURE
 *
 *   env set, file missing   FAILURE. Naming a path is a request for this path,
 *                           and falling back to the cookie silently would run a
 *                           different credential than the one CI asked for.
 *   nothing anywhere        absent. Fall back to the cookie, saying so.
 *   file present, unusable  FAILURE, exactly as a malformed cookie is.
 */
```

### scripts/check-browser.mjs:442 (WHY, shortened)

trimmed.

```js
/**
 * WHICH CREDENTIAL THE ADMIN CASES USE, decided once, here.
 *
 * Smoke wins when it is present, because it is the one that runs unattended.
 * The cookie remains a complete fallback rather than a deprecated path: a
 * machine credential proves what a machine can reach, and there are things only
 * a real signed-in session can (see the remaining-human list at the end).
 */
```

### scripts/check-browser.mjs:455 (WHY, shortened)

jar-over-header reason kept; navigation counts moved.

```js
/**
 * Puts the session in the browser's COOKIE JAR rather than on a pinned header.
 *
 * MEASURED, 40 navigations: `setExtraHTTPHeaders({ cookie })` bounced to /login
 * on 6 of 16, while the jar bounced on 0 of 20 and 0 of 4 more in the full
 * render sweep. A pinned header is also sent in place of whatever the server
 * most recently Set-Cookie'd, so it fights Better Auth's own session refresh.
 * The jar is what a real browser does and it is what the gate does now.
 *
 * `url` rather than `domain` so the browser derives the host and the secure
 * attribute from the origin, which keeps this correct for http and https alike.
 *
 * @param {import("puppeteer").Page} page
 * @param {string} origin
 */
```

### scripts/check-browser.mjs:482 (WHY, shortened)

trimmed; counts moved.

```js
/**
 * Puts the smoke credential on the page as a pinned `Authorization` header.
 *
 * **A PINNED HEADER IS WRONG FOR THE COOKIE AND RIGHT FOR THIS**, and the
 * difference is worth stating because the note above says the opposite. The
 * cookie was measured bouncing to /login on 6 of 16 navigations when pinned,
 * because a pinned `Cookie` is sent INSTEAD of whatever the server most
 * recently `Set-Cookie`d and therefore fights Better Auth's session refresh. A
 * bearer token has no refresh and no server-side counterpart: it is a constant,
 * so there is nothing for a pin to fight.
 *
 * @param {import("puppeteer").Page} page
 */
```

### scripts/check-browser.mjs:510 (CONTRACT, shortened)

trimmed.

```js
/**
 * Does this origin accept the supplied session? Answered over the WIRE, before
 * a browser is driven at it.
 *
 * A redirect to the login page is the whole signal, and it is read with
 * `redirect: "manual"` on purpose: a browser follows the 302 and reports 200 for
 * the login page it lands on, so a status check after following would call a
 * rejected session a success.
 *
 * @param {string} origin
 */
```

### scripts/check-browser.mjs:531 (WHY, shortened)

trimmed.

```js
/*
     * THE STATUS IS THE ANSWER, and for the smoke path it is a RICHER answer
     * than for the cookie. The middleware refuses a PRESENTED bearer token with
     * a status that names the repair rather than redirecting: 401 wrong token,
     * 503 not configured on that deployment, 429 rate limited. Those need three
     * different fixes, so the status is carried out of here rather than
     * collapsed into a boolean the caller cannot interpret.
     */
```

### scripts/check-browser.mjs:579 (WHY, shortened)

trimmed.

```js
/**
 * Whether the admin block actually got past authentication and ran its cases.
 *
 * NOT derived from `skipped.length`, which cannot tell the difference between
 * "the admin cases ran" and "the session was rejected, so one assertion failed
 * and the other fifteen never happened". Those need different floors and the
 * second must not be reported as a collapsed run on top of its real failure.
 */
```

### scripts/check-browser.mjs:589 (CONTRACT, shortened)

trimmed.

```js
/**
 * The wire pre-check's full result, kept so the failure branch can name a
 * repair from the STATUS rather than from a boolean that discarded it.
 *
 * @type {{ ok: boolean, status: number, error?: string }}
 */
```

### scripts/check-browser.mjs:606 (CONTRACT, shortened)

fail-soft reason kept; 2026-09-14 rename incident moved.

```js
/**
 * CLICK A SELECTOR, AND FAIL SOFTLY WHEN IT IS NOT THERE.
 *
 * RULED 2026-09-14. `page.click` asserts internally and THROWS on a missing
 * selector, which ends the whole run. MEASURED: build 2 renamed the theme
 * control from `.theme-toggle` to `.bar-theme` and the footer from
 * `.site-footer` to `.site-shell-footer`; the first stale click threw and
 * voided every case after it, so one rename cost 34 results where two were
 * actually wrong.
 *
 * A selector that has moved is a REAL finding and belongs in the failure count
 * beside the others. It is not a reason to stop measuring everything else, and
 * a gate that dies on its first surprise cannot report the second one.
 *
 * @param {any} target a Page or a Frame
 * @param {string} selector
 * @param {string} label what the click is for, used in the failure line
 * @returns {Promise<boolean>} whether the click happened
 */
```

### scripts/check-browser.mjs:646 (CONTRACT, shortened)

trimmed.

```js
/**
 * A measured fact worth printing that is NOT a pass or a failure.
 *
 * Distinct from `skip`, which says a case could not run. This says a case ran,
 * observed something true, and that the thing observed is not the gate's to
 * enforce. Counted in neither total, so it can never make a red run look green
 * or a green one look red.
 *
 * @param {string} what
 */
```

### scripts/check-browser.mjs:664 (WHY, shortened)

reporting and never-kill-a-stranger rules kept.

```js
/*
 * PREFLIGHT: clear what the LAST run left behind, before this one needs the
 * port it is probably still holding.
 *
 * REPORTED EVERY RUN, INCLUDING ZERO. A silent cleanup is indistinguishable
 * from one that is not running, which is the same argument the executed-count
 * floors make further down this file: a check that can pass by doing nothing
 * has to say how much it did.
 *
 * `reused` is the line worth reading. A pid is not an identity, Windows hands
 * them out again, and the registry entry is a claim about the past. Anything
 * still alive whose command line no longer matches what this gate launches is
 * DROPPED rather than killed. Dustin runs his own Chrome, and that branch is
 * the only thing standing between a stale pid and his tabs.
 */
```

### scripts/check-browser.mjs:688 (WHY, shortened)

kill-only-on-needle rule kept; 2026-09-03 measurements and strictPort story moved.

```js
/*
 * PREFLIGHT, SECOND HALF: ask the OS who is holding the port, INDEPENDENTLY of
 * the registry above.
 *
 * ## WHY THE FIRST HALF IS NOT ENOUGH, measured rather than reasoned about
 *
 * The registry is written by the process that dies. A hard kill early enough
 * leaves a `vite preview` on 4173 with NO ENTRY NAMING IT, and the sweep above
 * then reports `0 cleared, 0 stale, 0 reused` while the port is occupied.
 * Measured 2026-09-03 with pid 21108: a preview server survived its parent's
 * death, the registry file was empty, and preflight said zero of everything.
 * The registry's own docblock calls the leftover the case it exists for, and
 * this is the shape of leftover it cannot see.
 *
 * ## WHAT AN UNCLEARED PORT COST BEFORE `--strictPort`, which was worse than a
 * failure
 *
 * `vite preview` DEFAULTS to falling back. Measured 2026-09-03: it printed
 * "Port 4173 is in use, trying another one..." and bound 4174. The gate then
 * polled 4173, was answered from LAST RUN'S BUILD, and would have run every
 * public case against a build nobody asked about while reporting on the working
 * tree. A refusal is loud. That was a silent wrong answer, which is the failure
 * this file spends the most words guarding against elsewhere.
 *
 * The spawn passes `--strictPort` now, so the fallback cannot happen. This
 * probe still runs first and still does the useful half: strictPort turns a
 * held port into a crash, and this turns the gate's OWN leftover into a
 * cleanup, which is the difference between a run that works and one that
 * refuses until somebody reads a pid.
 *
 * ## KILLING IS STILL EARNED, NEVER ASSUMED
 *
 * The OS names a pid. That is not permission. The pid's live command line is
 * read and has to satisfy the same needles the registry uses, and anything else
 * REFUSES THE RUN and names the pid rather than killing it. The needles cannot
 * tell this gate's leftover from a `vite preview` Dustin started by hand on the
 * same port, and that is accepted: the gate is about to bind that port either
 * way, and the server it would find there is serving a build this run did not
 * make. What the needles DO exclude is everything that is not a vite preview
 * on this port, which is every process whose loss would cost him something.
 *
 * Only when this run is going to bind the port. Under PUBLIC_ORIGIN nothing is
 * served locally, so a holder is somebody else's business.
 */
```

### scripts/check-browser.mjs:735 (WHY, shortened)

trimmed to one line.

```js
// Not collapsed into "free". A probe that cannot read a listing reports
    // that it could not, and the run continues, because refusing here would
    // make an unreadable netstat a hard stop for a port that is usually free.
```

### scripts/check-browser.mjs:772 (WHY, shortened)

trimmed.

```js
/*
     * THE KILL REPORTING SUCCESS IS NOT THE PORT BEING FREE, so the freeing is
     * what gets asserted. `taskkill` returns before the socket is released, and
     * "I killed it" is exactly the class of claim this gate does not accept
     * from itself anywhere else. The probe is re-run until the port is clear or
     * the bound runs out, and the bound expiring is a REFUSAL, not a shrug:
     * binding after a held port is what produced the silent wrong answer above.
     */
```

### scripts/check-browser.mjs:799 (WHY, shortened)

trimmed; 2026-08-31 measurement moved.

```js
/*
 * This process is registered FIRST, and it is not the obvious entry.
 *
 * The measured shape on 2026-08-31: killing the npm and cmd wrappers ABOVE this
 * process leaves THIS process orphaned and still running, holding a browser and
 * a preview server. It finishes and cleans up if it is left alone, and becomes
 * a permanent leak the moment somebody kills it too, which is what a supervisor
 * retrying a kill does. Nothing inside a stranded process can fix that, so the
 * next run inherits it, exactly like the children below.
 */
```

### scripts/check-browser.mjs:811 (WHY, shortened)

trimmed; timing moved.

```js
/*
 * IT BUILDS, rather than trusting whatever is in build/.
 *
 * A stale build is the disk-versus-HEAD class wearing a different hat: the gate
 * would lay out code nobody is looking at and report on it confidently. 24s
 * measured, which is the price of the assertions below meaning anything.
 */
```

### scripts/check-browser.mjs:820 (WHY, shortened)

trimmed.

```js
// The enhancement bundles first: the app build's ?url imports name files
  // under the gitignored app/enhance/dist/, and this gate runs standalone as
  // well as inside check:all, so it cannot assume a runner already built them.
```

### scripts/check-browser.mjs:832 (WHY, shortened)

trimmed.

```js
// Nothing has been started yet, so the only entry is this process's own.
    // Cleared directly rather than through cleanupChildren, which reads a
    // `const` that is still in its temporal dead zone this early.
```

### scripts/check-browser.mjs:851 (WHY, shortened)

trimmed.

```js
// Nothing is built and nothing is served: the subject is already running
  // somewhere else. Said out loud, because "building ..." missing from the log
  // is exactly the kind of silence a reader fills in wrongly.
```

### scripts/check-browser.mjs:857 (WHY, shortened)

purpose and hand-written reason kept; item H2 narrative moved.

```js
/*
 * THE SEEDED APPROVED MENTION, and it exists because the byte-identity case
 * below would otherwise be asserting nothing about this feature.
 *
 * `/blog/ten-years-on-cloudflare` is already in THEME_CACHED, where two
 * documents are compared for a credentialed reader and a cookieless one. That
 * comparison is what licenses caching the page on path plus theme, and item H2
 * added a section to it whose contents come out of D1. A post with NO approved
 * mention renders no section at all, so the comparison would keep passing while
 * saying nothing about the markup the feature actually emits: the clean-sweep
 * shape, over an empty scope, on the one case that matters.
 *
 * So two rows are written first, and their presence in the rendered document is
 * asserted before the comparison is believed.
 *
 * ## WHY THE ROWS ARE HAND-WRITTEN AND NOT SENT THROUGH THE ENDPOINT
 *
 * The endpoint cannot produce either of them. `sourceVerdict` refuses a
 * `javascript:` source and `readAuthor` keeps an `author_url` only when it
 * parses as absolute http(s), so the hostile row below is unreachable through
 * `POST /webmention` by construction. That is exactly why it is worth
 * rendering: `safeHttpHref` is a render-time check on a value two earlier
 * checks should already have refused, and the only way to exercise it is to
 * write the row those checks cannot produce.
 *
 * ## LOCAL ONLY, AND IT SAYS SO WHEN IT SKIPS
 *
 * Under PUBLIC_ORIGIN this gate observes the deployed site, where nothing here
 * may write a row and no approved mention exists. The assertions SKIP with the
 * reason rather than passing quietly, on the same grounds the series-route
 * exemption below gives.
 */
```

### scripts/check-browser.mjs:902 (WHY, shortened)

trimmed.

```js
/*
   * DELETE THEN INSERT, so a re-run is idempotent and the count below means
   * "this run wrote them" rather than "some earlier run did". The delete names
   * only rows this seed could have written.
   */
```

### scripts/check-browser.mjs:921 (WHY, shortened)

trap kept; learning story moved.

```js
/*
   * ONE COMMAND STRING, NOT AN ARGV ARRAY, and this cost a run to learn.
   *
   * `spawnSync(cmd, args, { shell: true })` on Windows joins the array into a
   * command line WITHOUT quoting it, so every space in the SQL became an
   * argument boundary and cmd answered "The system cannot find the file
   * specified" about a program named after the first word of the statement.
   *
   * The repair is the shape `check-worker.mjs` already uses for the same
   * reason: build the line, quote the one argument that needs it. The SQL below
   * contains single quotes only, so the double quotes here cannot be closed
   * from inside it, and the angle brackets in the hostile author name are
   * inside those quotes where cmd does not read them as redirection.
   */
```

### scripts/check-browser.mjs:949 (WHY, shortened)

preview-door reason, hard rule 7 and --file reason kept; narrative moved.

```js
/*
 * THE MATH PAGE, REACHED THROUGH A SEEDED PREVIEW TOKEN.
 *
 * ## THE PROBLEM THIS SOLVES
 *
 * The math fixture is `draft: true`, on the same footing as the chart fixture,
 * because nothing in it is written for a reader. A draft has no public URL: the
 * candidate list this gate builds from the artifact filters `draft !== true`,
 * and `/blog/math-typesetting-fixture` answers 404 by design. So the one page
 * on this site with an equation on it is the one page a browser gate cannot
 * visit, and every claim about how math RENDERS would have to be made offline
 * against markup, which is the class hard rule 7 is about.
 *
 * `/preview/:token` is the door that already exists. It re-exports
 * `blog.$slug`'s component and shares `blogPostView`, so what it renders IS the
 * published page for everything this section measures. Two rows are written to
 * make it resolve: the post itself, and the KV record the token names.
 *
 * ## THE POST ROW IS SEEDED FROM THE ARTIFACT, NOT ASSUMED PRESENT
 *
 * The local database is whatever the last `sync:content --local` left, which on
 * this machine predates the fixture and on a colleague's may predate the
 * corpus. Seeding it from `content/generated/posts.json` makes the page a
 * function of the build this gate is grading rather than of somebody's sync
 * history, which is the same reason the mention rows above are written here.
 *
 * ## `--file`, NOT `--command`, AND THAT IS NOT A STYLE CHOICE
 *
 * The mention seed above records why its SQL is one quoted command string. That
 * shape cannot carry this one: the value is rendered post HTML, it is full of
 * double quotes (`class="katex"` alone appears seventeen times), and every one
 * of them would close the quote cmd is holding the statement in. A file has no
 * shell in the path at all, so the only escaping left is SQL's own, which is
 * doubling single quotes.
 *
 * ## LOCAL ONLY
 *
 * Under `PUBLIC_ORIGIN` this gate observes the deployed site, where nothing
 * here may write a row and no preview token of ours exists. The assertions SKIP
 * with the reason, exactly as the mention cases do.
 */
```

### scripts/check-browser.mjs:991 (WHY, shortened)

trimmed.

```js
/**
 * A FIXED token, not a minted one, and the fixed-ness is the point twice over.
 *
 * A re-run overwrites one KV record instead of leaving a trail of live preview
 * links behind it, and a failure names a URL somebody can open by hand. It is
 * 43 base64url characters because `isWellFormedToken` is length-exact and
 * anchored, which the route checks BEFORE it spends a KV read.
 */
```

### scripts/check-browser.mjs:1012 (WHY, shortened)

trimmed.

```js
/*
   * FAILS RATHER THAN SKIPS. A missing fixture is not a mode this gate runs in:
   * `check:content` already refuses a corpus with no math in it, so by the time
   * anything gets here the post exists or the build is broken.
   */
```

### scripts/check-browser.mjs:1077 (WHY, shortened)

trimmed.

```js
/*
   * The KV record is the AUTHORITY: the token is a lookup key carrying no
   * claims, so this JSON is what decides which post the link opens. Its shape
   * is `preview-links.server.ts`'s, and `resolvePreview` re-reads the post's
   * status afterwards regardless, which is why a stale record cannot leak a
   * published post.
   */
```

### scripts/check-browser.mjs:1105 (WHY, shortened)

purpose kept; 2026-08-24 story moved.

```js
/*
 * THE SERVER'S OUTPUT IS KEPT, and until 2026-08-24 it was thrown away.
 *
 * `stdio: "ignore"` meant that when the startup poll timed out, the gate could
 * say only that nothing answered on the port. The server had usually said
 * exactly what was wrong on its own stderr (a port already bound, a config it
 * could not read, a crash on boot) and the gate discarded it and then reported
 * a symptom with no cause. That cost a session, which is why this is here.
 *
 * A RING BUFFER, not a transcript. `vite preview` is quiet, but a crash loop is
 * not, and a gate that prints an unbounded server log buries its own result.
 * The last 40 non-empty lines are what a startup failure needs.
 */
```

### scripts/check-browser.mjs:1131 (WHY, shortened)

trap kept; 2026-09-03 measurement moved.

```js
/*
 * `--strictPort`, and it is the difference between a failure and a WRONG ANSWER.
 *
 * Measured 2026-09-03: without it `vite preview` does not refuse an occupied
 * port. It prints "Port 4173 is in use, trying another one..." and binds 4174.
 * The gate then polls 4173, is answered by whatever is still sitting there,
 * and runs every public case against LAST RUN'S BUILD while its banner says it
 * is observing the working tree. Every assertion below would be true of a build
 * nobody asked about.
 *
 * The port preflight above already clears or refuses a holder, so this is the
 * belt rather than the braces. It is worth having anyway: the preflight can
 * only act on what it can see, and a process that binds 4173 in the seconds
 * between the probe and this spawn is invisible to it. This makes that race a
 * loud crash instead of a confident wrong answer.
 */
```

### scripts/check-browser.mjs:1159 (WHY, shortened)

trimmed; 2026-08-31 measurement moved.

```js
/*
 * The pid `spawn()` hands back is the SHELL, and on the kill path it is the one
 * process guaranteed to be gone.
 *
 * `shell: true` plus npx puts a chain between this gate and the vite process
 * that actually binds the port. Measured 2026-08-31, when the gate node is
 * killed, that shell dies with it because its stdio pipe breaks, and its
 * descendants survive: the npx node, an inner cmd, and vite itself, holding
 * 4173 with nobody left who knows they exist.
 *
 * So the shell is recorded here for the orderly case, and the SURVIVORS are
 * recorded separately once the server answers. Recording only this pid would
 * produce a registry that always looks correct and never clears anything.
 */
```

### scripts/check-browser.mjs:1175 (WHY, shortened)

trimmed.

```js
/*
 * WHETHER THE SERVER PROCESS IS STILL ALIVE, which is the half the poll could
 * not see.
 *
 * A process that exited immediately and a process still booting look identical
 * to a fetch that refuses to connect. The old loop treated both as "not up
 * yet" and waited out the entire bound before saying anything, so the single
 * commonest startup failure, the server dying on boot, took a full minute to
 * report and reported the wrong thing.
 */
```

### scripts/check-browser.mjs:1190 (WHY, shortened)

bound reasoning kept; dated samples and corrections moved.

```js
/**
 * Polls until the server answers, rather than sleeping a guessed interval.
 *
 * ## THE BOUND, AND A CORRECTION TO WHAT THIS COMMENT FIRST CLAIMED
 *
 * The 2026-08-24 watch item asked whether the 60s bound was the real problem,
 * given the gate's own `npm run build` completes first. This comment answered
 * "`vite preview` answers in about a second" and cut the bound to 30s.
 *
 * **THAT NUMBER WAS A PREDICTION WRITTEN AS A MEASUREMENT, and the very first
 * run refuted it: 17,277ms.** Not one second, seventeen. So the 30s bound this
 * file briefly carried had 1.7x of headroom, which is TIGHTER than the 60s it
 * replaced and would have started failing on a loaded machine. Restored to 60s,
 * which against the worst reading is about 3.5x and is the honest bound.
 *
 * THREE SAMPLES, 2026-08-24, same machine, each after the gate's own build:
 * **17,277ms, 13,782ms, 12,040ms.** A dated observation, not a maintained
 * value: `npx` resolving through a shell on Windows is most of it, and the
 * spread across three consecutive runs is already 5 seconds, which is the
 * argument against a tight bound on its own. The gate PRINTS the figure every
 * run, so the next reader has a current number rather than this sentence.
 *
 * **AND THE BOUND WAS NEVER THE PROBLEM ANYWAY.** The recorded overrun was a
 * startup that never happened, and against that a tighter bound only shortens
 * the wait before an undiagnosed message. What actually fixes it is below: the
 * wait now ENDS EARLY when the process dies, and whatever the server said is
 * printed either way.
 *
 * ## 180s SINCE 2026-08-29, BECAUSE THE 3.5x HEADROOM HAD BECOME 1.1x
 *
 * The gate failed twice on a quiet machine with "the preview server process was
 * still alive and never answered", which is the message for a bound that
 * expired rather than for anything being wrong. RE-MEASURED THE SAME DAY, three
 * ways: a hand-started `vite preview` first answered at **53s**, and the gate
 * itself, with the bound temporarily raised, printed **46,119ms** and then went
 * on to pass 207 checks with 0 failures.
 *
 * So the startup has got roughly three times slower than the samples above,
 * and 60s against 46 to 53s is not a bound, it is a coin flip. What dominates
 * now is visible in the server's own first line, `Establishing remote
 * connection...`: the `AI_SEARCH` binding reaches a real instance even in local
 * dev, which is also why this gate is tiered NETWORK. That latency is not ours
 * and will not be steady.
 *
 * **RAISING IT COSTS NOTHING, and that is the paragraph above's own argument
 * used forwards.** A long bound is only ever paid when the server is alive and
 * slow. A server that DIES is reported immediately by the `serverExit` early
 * exit, which is the case the short bound was protecting, and that protection
 * is structural rather than a function of the number. So the number can be
 * generous without making any failure slower to diagnose.
 *
 * NOT a fix for the slowness, and deliberately not disguised as one. The
 * measurement is recorded so the next reader can see the trend rather than
 * rediscover it; `remote: true` on the binding, which the server's own warning
 * suggests, is the thing that would actually address it and is a ruling about
 * billing rather than a gate change.
 */
```

### scripts/check-browser.mjs:1249 (WHY, shortened)

purpose kept; 2026-09-14 ruling narrative moved.

```js
/**
 * THE LAST THING THE READINESS PROBE SAW, and the reason this exists at all.
 *
 * RULED 2026-09-14. The old loop returned a bare false and the caller printed
 * "the preview server process stayed alive and never answered", which is ONE
 * sentence for four different situations: nothing bound yet, something bound
 * and wedged, something answering with a non-ok status, and a process that had
 * already died. Two runs failed at 261s and 310s and that message could not say
 * which of the four they were, so this gate was called "broken on this host"
 * for weeks when the measured answer was a slow boot on a loaded machine: 51s
 * to first answer on a clear one, past the 180s ceiling on a busy one.
 *
 * A TIMEOUT THAT CANNOT SAY WHAT IT WAS WAITING FOR is what makes this gate
 * unusable on ship, not the minutes it costs. Ruled the same day: it stays on
 * the network tier, because a busy machine reported as a red is worse on ship
 * than no gate at all.
 */
```

### scripts/check-browser.mjs:1275 (WHY, shortened)

trimmed.

```js
/*
   * A DEPLOYED ORIGIN IS NOT BOOTING, so it gets ONE attempt and no loop.
   *
   * The retry above exists for a process that has been started and needs a
   * moment; none of that is true of a site that is already serving. A 404 from
   * a live origin is a WRONG PATH, and asking it again 85 times over a minute
   * cannot turn it into a right one: it would spend 60 seconds converting an
   * answer the origin gave immediately into a timeout, and a timeout is the
   * one diagnosis that names nothing. So the status is captured and reported.
   */
```

### scripts/check-browser.mjs:1300 (WHY, shortened)

reason kept; 2026-09-06 measurement moved.

```js
/*
   * THE SURVIVORS ARE RECORDED WHILE WAITING, NOT ONLY ONCE THE SERVER ANSWERS.
   *
   * MEASURED 2026-09-06 by hard-killing the gate node mid-startup. The registry
   * held two entries, the gate and the pid `spawn()` returned, and `taskkill /F`
   * on the gate took both: they are npx wrappers and they die with the parent
   * whose stdio they hold. What SURVIVED was the real vite (a node running
   * vite.js preview) plus its esbuild and workerd, five processes, and the real
   * vite's parent was an intermediate that was already gone, so it was not a
   * descendant of anything recorded.
   *
   * The next run then reported `0 cleared, 5 stale, 0 reused, 1 FAILED TO KILL`:
   * every recorded pid was gone, and the tree that was still standing had never
   * been written down. The port probe could not see it either, because vite had
   * not bound 4173 yet, which is exactly the window the probe cannot cover.
   *
   * So the capture happens on every poll of the wait loop, not once at the end.
   * The whole point of the registry is the case where the gate dies without
   * warning, and recording only at the moment of success leaves the entire
   * startup uncovered, which is when a slow or wedged start makes a kill most
   * likely.
   *
   * `record` is idempotent enough for this: a repeated pid appends a line, and
   * `preflight` verifies the live command line before killing anything, so a
   * duplicate costs a string comparison rather than a wrong kill. Reading the
   * process table is the expensive half, so it is throttled rather than run on
   * every iteration of a tight loop.
   */
```

### scripts/check-browser.mjs:1342 (WHY, shortened)

trimmed to one line.

```js
// It ANSWERED and said no. A different fact from silence, and the one a
      // wrong probe path produces, so it is kept rather than folded into
      // "not up yet".
```

### scripts/check-browser.mjs:1347 (CONTRACT, shortened)

trimmed.

```js
/*
       * WHICH KIND OF SILENCE. The three are different diagnoses and the old
       * loop reported all of them as "never answered":
       *
       *   ECONNREFUSED  nothing is listening yet, so it is still booting
       *   a timeout     something is listening and not replying, a wedge
       *   anything else recorded verbatim rather than guessed at
       */
```

### scripts/check-browser.mjs:1364 (WHY, shortened)

trimmed.

```js
// The process is gone, so no amount of further waiting will help. Reported
    // in the caller with the output, which is the point of not waiting here.
```

### scripts/check-browser.mjs:1378 (CONTRACT, shortened)

trimmed.

```js
/**
 * What to print when the server never answered. THE SERVER'S OWN LAST WORDS.
 *
 * Named rather than inlined so the failure carries its diagnosis in one place,
 * and so a run that captured NOTHING says that explicitly instead of printing
 * an empty region that reads like a clean log.
 */
```

### scripts/check-browser.mjs:1386 (WHY, shortened)

trimmed.

```js
/*
   * THE STATE FIRST, because it is the half that decides what to do next.
   * "Still booting" means the ceiling or the machine; "wedged" means the
   * server; "exited" means read its last words. One sentence for all three is
   * what made two real runs unreadable.
   */
```

### scripts/check-browser.mjs:1407 (WHY, shortened)

trimmed.

```js
// No server was started, so there is nothing to diagnose ABOUT one: the
  // subject is a deployed origin that did not answer, and saying "the preview
  // server exited" would name a process this run never had.
```

### scripts/check-browser.mjs:1435 (CONTRACT, shortened)

trimmed.

```js
/**
 * Record the preview processes that OUTLIVE this gate when it is killed.
 *
 * Called once, at the moment the server answers, because that is the first
 * moment the chain exists and is stable. It is one process listing in a gate
 * that takes minutes, and it buys the only registry entries that are still
 * alive on the path this whole mechanism exists for.
 *
 * Each survivor has to satisfy the same needles a later run will re-check it
 * against, so anything in the subtree that does not name itself as this
 * preview server is not recorded at all. workerd and esbuild are the deliberate
 * omissions: they say nothing about vite on their own command lines, and
 * `taskkill /T` from the vite process reaches them anyway.
 */
```

### scripts/check-browser.mjs:1449 (WHY, shortened)

trimmed; duplicate-count incident moved.

```js
/**
 * Pids already written, so a repeated capture does not append them again.
 *
 * The capture now runs on every poll of the startup wait, and without this the
 * same three pids are appended each time: one killed run wrote twelve lines for
 * four processes and the next preflight reported `20 stale`, which is a count of
 * duplicates rather than of anything that happened. In memory rather than by
 * re-reading the file, because the file is append-only ON PURPOSE (a rewritten
 * one would be empty in exactly the case it exists for) and this only needs to
 * be right for the life of the process doing the writing.
 */
```

### scripts/check-browser.mjs:1476 (WHY, shortened)

trimmed.

```js
/**
 * Stop the preview server, and everything npx put underneath it.
 *
 * `/T` rather than a bare kill, for the reason recorded at the registration
 * site: the pid `spawn()` returned is a shell, and the process holding the port
 * is two levels below it.
 */
```

### scripts/check-browser.mjs:1489 (CONTRACT, shortened)

trimmed.

```js
/**
 * Every long-running child, on every ORDERLY exit path.
 *
 * `browser.close()` stays and runs first: it is the graceful stop, it lets
 * Puppeteer flush what it is holding, and it is what should normally do the
 * job. The tree kill after it is the BACKSTOP for when it does not run or does
 * not finish, which is a case this gate has actually been in.
 *
 * What this function CANNOT cover is the case that produced the leftovers:
 * `taskkill /F` on Windows delivers no signal, so nothing here executes. That
 * is not a gap in the handlers, it is the reason the registry exists.
 *
 * @param {import("puppeteer").Browser | undefined} openBrowser
 */
```

### scripts/check-browser.mjs:1510 (WHY, shortened)

trimmed.

```js
// With `--keep` the operator wants the server left standing, so the entries
  // stay too: the next run's preflight is then the thing that frees the port,
  // which is what it is for.
```

### scripts/check-browser.mjs:1516 (WHY, shortened)

trimmed.

```js
/**
 * Declared HERE rather than beside its first use, because the signal handlers
 * below close over it and a handler is reachable from the moment it is
 * registered. Left further down, an interrupt during the build would hit the
 * temporal dead zone and replace the gate's diagnosis with a ReferenceError.
 *
 * @type {import("puppeteer").Browser | undefined}
 */
```

### scripts/check-browser.mjs:1526 (WHY, shortened)

trimmed.

```js
/*
 * THE SIGNALS THAT ARE DELIVERABLE, which is a smaller set than it looks.
 *
 * Ctrl+C and a console close arrive as signals and are worth handling: they are
 * how a person stops this gate. A `taskkill /F`, which is how a supervisor
 * stops it, arrives as nothing at all. So these handlers narrow the window and
 * do not close it, and saying which is the point: the registry above is what
 * covers the rest.
 *
 * `process.exit` here rather than a set exit code, because a signal handler that
 * returns hands control back to a gate whose children are now gone.
 */
```

### scripts/check-browser.mjs:1557 (WHY, shortened)

trap kept; plant measurement moved.

```js
/*
     * `process.exitCode`, NOT `process.exit()`, and this is the recorded
     * Windows class at a new site.
     *
     * MEASURED here on the origin plant: `process.exit(1)` on this path left
     * the undici handle from the probe above in flight, libuv aborted with
     * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c`,
     * and the process died 127 with a C-level assertion printed UNDER the
     * gate's own diagnosis. The refusal was correct and the last thing on
     * screen was a crash, which is the one way to make a clear diagnosis
     * unreadable. Setting the code and letting the loop drain exits 1 cleanly.
     */
```

### scripts/check-browser.mjs:1575 (WHY, shortened)

trimmed.

```js
/*
   * The needle is the PUPPETEER CACHE PATH, not "chrome".
   *
   * Dustin runs his own Chrome, and a needle that matched on the browser name
   * would let a reused pid point this gate's cleanup at his tabs. Puppeteer's
   * binary lives under its own download cache and nothing else on the machine
   * runs from there, so the path is the part that says whose browser it is.
   */
```

### scripts/check-browser.mjs:1586 (WHY, shortened)

trimmed.

```js
/*
   * WHICH BUILD THE PUBLIC CASES ARE ABOUT, stated on the same footing as the
   * admin credential below. Two runs of this gate can now disagree while both
   * are correct, because they are answering about different artifacts, and a
   * reader who does not know which one ran cannot tell a shipped defect from an
   * unshipped one.
   */
```

### scripts/check-browser.mjs:1601 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE, ASSERTED FIRST, and it is the assertion that makes the rest mean
   * anything. Against the dev server this gate measured an unstyled page and
   * every column assertion below passed on it. If the stylesheet is not applied
   * the numbers are about the browser's defaults, not about this site.
   */
```

### scripts/check-browser.mjs:1618 (WHY, shortened)

intent kept; re-measurement history and counts moved.

```js
/*
   * RE-MEASURED 2026-08-24, AND THE FLOOR WAS THE THING THAT WAS WRONG.
   *
   * This read `> 500` and went RED when `app/admin.css` was split out of
   * `app/app.css`. Nothing about the page had broken: the public bundle simply
   * stopped carrying the admin plane's seven stylesheets, which is what the
   * split was FOR. Measured on the preview build: 351 rules from `root-*.css`,
   * and the page is genuinely styled (body background resolves to the token
   * colour, not to white).
   *
   * So this was a floor set against a stylesheet that no longer exists, and it
   * had been failing ever since. It is the unfailable-floor class inverted: a
   * threshold ABOVE its subject cannot pass rather than cannot fail, and it is
   * just as useless, because a red that is always red stops being read.
   *
   * Floored at 320, about eight percent under the measurement.
   *
   * **AND THIS ASSERTION IS ABOUT THE PUBLIC PLANE ONLY.** It runs on `/blog`.
   * It never said anything about the admin pages, which load a second sheet;
   * they now have their own scope check where they are measured.
   *
   * ## RE-MEASURED AGAIN 2026-08-27, FOR THE SAME REASON IN A SMALLER FORM
   *
   * Public CSS stopped being one site-wide bundle: a route now loads the sheets
   * its own markup needs. `/blog` fell from 351 rules to 157, and this floor
   * went red on a page that is perfectly styled, which is the identical shape
   * the 2026-08-24 entry above records. Floored at 144, about eight percent
   * under 157.
   *
   * **THE NUMBER IS NOW ROUTE-SPECIFIC AND THIS ASSERTION SAYS SO.** Before the
   * split, "the public plane" had one answer; now every route has its own, and
   * a floor measured on `/blog` says nothing about `/playground`. It is kept
   * because its job is unchanged and crude on purpose: catch a page that
   * arrived with no stylesheet at all, so that the layout assertions below are
   * not quietly measuring browser defaults. Per-route BYTE ceilings are
   * `check:page-payload`'s subject, not this one's.
   */
```

### scripts/check-browser.mjs:1665 (WHY, shortened)

prime and cache-bust reasons kept; 2026-08-26 timings moved.

```js
/*
   * THE FRONT DOOR REPORTS A STORED VERDICT, AND IT IS RECENT.
   *
   * `home.tsx` used to run the whole health suite in its loader. Measured
   * 2026-08-26 against a control: this page rendered at origin in 1.07 to
   * 3.48 s while `/blog` took 0.32 to 0.90 s, and `/api/health` alone took
   * 0.98 to 2.01 s. The suite was the gap. It now reads a snapshot `/api/health`
   * writes to KV.
   *
   * THE RISK THE REPLACEMENT INTRODUCES is the one this case is about: a
   * snapshot that is never written, or written and never read, leaves a cached
   * front page showing no verdict or an ancient one. `check:invariants`
   * section 22 can see that the loader CALLS the reader; only a browser can
   * see what the reader returned.
   *
   * ## THE ENDPOINT IS HIT FIRST, ON PURPOSE
   *
   * This is a fresh preview or a fresh deploy, so nothing has polled yet and
   * KV is legitimately empty. Priming through `/api/health` is not the gate
   * arranging its own pass: it is the gate exercising the ACTUAL WRITE PATH,
   * and the assertion that follows fails unless that write reached KV and the
   * loader read it back. A gate that skipped the prime would be asserting that
   * the scheduled workflow had run, which is a claim about GitHub.
   *
   * ## AND THE READ IS CACHE-BUSTED
   *
   * The home page is `public, s-maxage=600`, so a plain fetch can be answered
   * from an entry rendered before the prime and the assertion would measure a
   * snapshot that predates the write. A unique query string is a distinct cache
   * key, which forces the origin render this case is about.
   */
```

### scripts/check-browser.mjs:1714 (WHY, shortened)

trimmed.

```js
/* The wall clock at the moment of the read, so an AGE can be turned into
         a fixed point. Two ages measured at different moments are not
         comparable; the write times they imply are. */
```

### scripts/check-browser.mjs:1720 (CONTRACT, shortened)

trimmed.

```js
/**
     * WHEN THE SNAPSHOT THIS TILE IS SHOWING WAS WRITTEN, on the local clock.
     *
     * The tile carries an AGE, which grows on its own, so comparing two ages
     * needs the elapsed time between them subtracted back out, and that is what
     * the old `before + WAIT_SECONDS` arithmetic was doing. Deriving the write
     * time instead makes the comparison independent of how long anything took,
     * which is what lets the poll below run for as many seconds as it needs.
     *
     * @param {{age: number|null, readAtMs: number}} t
     */
```

### scripts/check-browser.mjs:1733 (WHY, shortened)

discrimination and poll reasons kept; plant and 2026-08-28 story moved.

```js
/*
     * ## A BEFORE AND AN AFTER, BECAUSE THE OBVIOUS ASSERTION DOES NOT
     * ## DISCRIMINATE. This is the plant's finding, not a precaution.
     *
     * The first version of this case primed `/api/health` and then asserted the
     * tile's age was under one poll interval. PLANTED by deleting the snapshot
     * write, PROVEN APPLIED in the artifact this gate builds (`writeHealthSnapshot`
     * absent from build/server, `readHealthTile` still present as the control),
     * and the gate went GREEN: 83 checks, 0 failures.
     *
     * The reason is that the preview's miniflare KV PERSISTS between runs. An
     * earlier green run had left a snapshot behind, it was a few minutes old,
     * and "a few minutes" is comfortably under fifteen. The assertion was
     * measuring that a snapshot EXISTS, which a leftover satisfies, and not
     * that this run's request wrote one.
     *
     * So the tile is read before and after, and the comparison is between the
     * two WRITE TIMES the ages imply. A snapshot that is not being rewritten
     * keeps its write time; one that is rewritten moves it forward. A leftover
     * of ANY age fails and no absolute threshold has to be guessed.
     *
     * ## AND THE SECOND READ IS A POLL, BECAUSE A KV READ IS NOT A KV WRITE
     *
     * The read used to be a single fetch four seconds after the call, and
     * against production that FAILED while the write was working perfectly.
     * Measured 2026-08-28: `/api/health` answered 200 with five passing checks,
     * `wrangler kv key get health:snapshot --remote` showed the new timestamp
     * already stored, and the home page kept rendering the previous one.
     * Polling the page every two seconds after the call, the age read 118, 121,
     * 123, 126, then 10, 13, then 133, 135, then 19, 22.
     *
     * It ALTERNATES, which is the signature and rules out a simple delay:
     * Workers KV serves `get` from an edge cache, entries expire independently,
     * and for about a minute after a write some reads are answered from a
     * cached copy of the old value and some are not. A one-shot read four
     * seconds later is a coin toss, and the gate lost it on the 2026-08-28
     * scheduled run and reported a write failure that had not happened.
     *
     * THE ASSERTION IS UNCHANGED IN WHAT IT REFUSES. A snapshot nobody wrote
     * never moves its write time, so the poll spends its whole budget and
     * fails, which is the defect this case was built for. What the poll removes
     * is a failure caused by the READER's cache, which is not a fact about this
     * site. The budget is longer than that cache's lifetime for that reason.
     */
```

### scripts/check-browser.mjs:1789 (WHY, shortened)

trimmed.

```js
/*
     * Longer than the KV read cache, and the poll stops the moment it sees a
     * newer write time, so the budget is a ceiling rather than a cost. The
     * tolerance absorbs the age's one-second quantisation plus network jitter;
     * a rewrite moves the write time by far more than that.
     */
```

### scripts/check-browser.mjs:1838 (WHY, shortened)

trimmed.

```js
/*
     * THE DISCRIMINATING ASSERTION. Skipped, loudly, when there was nothing to
     * compare against: on a genuinely fresh deploy the first read is `missing`,
     * and a comparison against an absent number would pass vacuously.
     */
```

### scripts/check-browser.mjs:1877 (WHY, shortened)

trap kept; incident moved.

```js
/*
     * BACK TO /blog, AND THIS LINE IS LOAD-BEARING.
     *
     * Every assertion below reuses this one `page` and was written after a
     * `goto` to /blog four screens up. Landing this case in front of them
     * without restoring the page left them measuring the HOME document:
     * `.blog-search` and `.page-head` came back null and the column comparison
     * failed, while `.post-list` resolved because the home page has one too.
     * That is a case passing on the wrong subject, which is the shape this
     * repository keeps getting bitten by, and the gate caught it on the first
     * run rather than reporting a clean column measurement of a page with no
     * columns.
     */
```

### scripts/check-browser.mjs:1893 (CONTRACT, shortened)

section marker shortened.

```js
/* ------- 0b. a public document depends on the THEME and nothing else ---- */
```

### scripts/check-browser.mjs:1895 (WHY, shortened)

cache-key precondition and run-mode limits kept; measurements moved.

```js
/*
   * THE PRECONDITION FOR KEYING THE PUBLIC CACHE ON PATH PLUS THEME.
   *
   * Today every public HTML route sends `Vary: Cookie` and `workers/app.ts`
   * downgrades any cookie-bearing request to `private, no-store`, so the only
   * variant that can ever be stored is the cookieless one. Measured: no cookie
   * HITs, `theme=dark` BYPASSes, and an unrelated `_ga=1` BYPASSes too. The
   * cost is that a reader who has ever touched the theme toggle, or who is
   * signed in, gets an origin render on every page for ever.
   *
   * Replacing that with a cache key of path plus theme is only sound if a
   * public document's bytes depend on the theme AND ON NOTHING ELSE ABOUT THE
   * REQUESTER. If any public page carries session-dependent bytes, the key is
   * wrong and one reader's page would be served to another. So this asserts
   * the property FIRST, and it is written to keep asserting it afterwards:
   * the day somebody renders a signed-in affordance into the public header,
   * this goes red rather than the cache quietly becoming a leak.
   *
   * ## WHAT THE COMPARISON CAN AND CANNOT SEE, stated because it changes
   * ## between the two run modes
   *
   * With PUBLIC_ORIGIN set, the smoke bearer is a REAL credential against that
   * deployment and the comparison is the strong one: a document rendered for
   * an authenticated principal against one rendered for a stranger.
   *
   * Locally, against the preview, no credential authenticates. The case then
   * proves the weaker but still useful property: a public route does not
   * BRANCH on a credential being presented at all. Both are worth running and
   * the banner already says which origin this is.
   *
   * The nonce is masked before comparing. It is supposed to differ per
   * request, it is the one field documented to do so, and leaving it in would
   * drown every real difference.
   */
```

### scripts/check-browser.mjs:1930 (CONTRACT, shortened)

short; subject set bound to source.

```js
/*
     * THE SUBJECT SET, bound to the source rather than restated. Every route
     * that exports the shared cache headers is here, and the assertion below
     * fails if the two lists ever disagree, in either direction.
     */
```

### scripts/check-browser.mjs:1945 (WHY, shortened)

tag choice kept, shortened.

```js
/*
       * The tag archive, which IS HTML and therefore carries the theme
       * dimension every other case here is checked for. `cloudflare` is used
       * because it is the corpus's most-carried tag, so the case survives any
       * single post being retagged; a tag with one post would make this case
       * vanish the day that post changed.
       */
```

### scripts/check-browser.mjs:1953 (HISTORY, deleted)

efc0dab drift narrative.

```js
/*
       * THE THREE HTML PUBLICATION PAGES, which drifted in efc0dab: they took
       * `publicHtmlHeaders()` and nothing added them here, so from that commit
       * until 2026-09-14 three shared-cacheable documents were never byte-
       * compared. The list assertion below is what found them, which is the
       * whole reason it reads the source rather than trusting this array.
       */
```

### scripts/check-browser.mjs:1962 (WHY, shortened)

canonical slash kept, shortened.

```js
/*
       * THE TRAILING SLASH IS THE CANONICAL FORM, not a typo. `paths.mjs` says
       * so and the gateway redirects the slashless spelling to it; fetching the
       * slashless one here would byte-compare two redirects. The slug is the
       * DOI fold of 10.1128/mra.00888-24, which is a registered DOI and cannot
       * be re-decided, so this URL is as stable as the corpus entry itself.
       */
```

### scripts/check-browser.mjs:1972 (WHY, shortened)

exemption reason kept; tutorial cut.

```js
/*
     * SHARED-CACHED HTML WITH NOTHING IN THE CORPUS TO POINT AT, named with the
     * reason, on the same rule as every other exemption map in this repo.
     *
     * A case here would need a real URL, and a URL that 404s would byte-compare
     * two renders of the ERROR page: green, and asserting nothing about the
     * route it names. This gate already SKIPs on the same grounds where the
     * corpus cannot exercise a case, for footnote previews and for post images,
     * and says so in its own output rather than passing quietly.
     *
     * The moment a series is published this entry is deleted and the route
     * joins THEME_CACHED with its path, which is a one-line change the closure
     * assertion below will demand rather than allow.
     */
```

### scripts/check-browser.mjs:1997 (WHY, shortened)

comment-stripping trap kept, shortened.

```js
// The two idioms: the helper, and the constant used directly by the
        // routes that also negotiate on Accept. `preview.$token.tsx` names the
        // constant in PROSE only and must not be caught, so comments go first.
```

### scripts/check-browser.mjs:2003 (WHY, shortened)

exemption grounds kept; dated join history moved.

```js
/*
       * SHARED-CACHED BUT NOT HTML, so they carry no theme dimension and are
       * out of this case's subject. The markdown twin joined this list on
       * 2026-08-26 when it stopped being `private, no-store`; it is one
       * representation under its own URL and has no `<html>` element to carry
       * a `data-theme` attribute at all.
       *
       * `sitemap` joined 2026-09-02, when it stopped being `max-age=3600` and
       * took the same constant the feeds use. It lists exactly the posts those
       * feeds list, from the same projection, and is XML: there is no
       * `<html data-theme>` for a theme to leak into and no cookie it reads.
       * The membership assertion above is what makes this an EXEMPTION rather
       * than an omission, because a route that quietly gained the shared
       * headers still fails until somebody classifies it here.
       *
       * THE ATOM FEED AND THE TWO TAG FEEDS joined 2026-09-03, on exactly the
       * same grounds as the two feeds above them: each is a feed document under
       * its own URL, XML or JSON, with no `<html>` element for a theme to reach
       * and no cookie read on the way. The tag PAGE is not exempt and is a case
       * in the list above, because it is HTML and does carry the dimension.
       *
       * THE FIVE CITATION EXPORTS joined 2026-09-14, on identical grounds and
       * found the same way: `publications[.bib|.ris|.json]` and the two
       * per-paper twins serve `application/x-bibtex`,
       * `application/x-research-info-systems` and CSL JSON through
       * `exportHeaders(..., SHARED_CACHE_CONTROL)`. Each is one representation
       * under its own URL with no `<html data-theme>` to carry the dimension
       * and no cookie read on the way. The two HTML pages beside them,
       * `publications.tsx` and `publications.$slug.tsx`, are NOT exempt and are
       * cases in the list above.
       */
```

### scripts/check-browser.mjs:2062 (CONTRACT, shortened)

mask intent kept; measurement moved.

```js
/**
     * Everything documented to differ between two renders of the same page.
     *
     * The nonce and the report endpoint are per REQUEST by design. The health
     * tile's age is per RENDER: it is a count of seconds and it ticks whether
     * or not anything about the reader changed, so two fetches a second apart
     * differ by one. MEASURED here on the first run of this case, at byte 5870
     * of `/`, reading 2 against 3.
     *
     * Masking it is correct rather than convenient. This case is about whether
     * the document depends on the COOKIE, and the age depends on the clock. A
     * value that differs between two identical requests cannot tell you
     * anything about a cache key, and leaving it in would make `/` permanently
     * unassertable while proving nothing.
     *
     * @param {string} html
     */
```

### scripts/check-browser.mjs:2084 (WHY, shortened)

why here and not maskTheme kept; incident moved.

```js
/*
         * THE SENTENCE BESIDE THE AGE, added 2026-08-28. The attribute above
         * was masked from this case's first run and the prose spelling of the
         * same fact was not, so the comparison still failed on it.
         *
         * MEASURED on production 2026-08-28, in the theme comparison below: the
         * cookieless copy read "Read under a minute ago, at 18:48 UTC" and the
         * dark copy, fetched seconds later, read "Read 7 minutes ago, at 18:41
         * UTC". The case failed at byte 7365 and neither render was wrong.
         *
         * SEVEN MINUTES APART IS NOT A SLOW CLOCK, and the mechanism is worth
         * stating because it is the reason a wait would not have fixed it:
         * Workers KV serves `get` from an edge cache, so two renders taken
         * seconds apart can legitimately read snapshots up to a minute apart,
         * and the age is recomputed against the wall clock at each render on
         * top of that. Diagnosed by reading the stored value directly with
         * `wrangler kv key get` while the page still showed the older one.
         *
         * IT IS HERE AND NOT IN `maskTheme` because the difference is not one
         * the theme is allowed to make. Two requests carrying the SAME cookie
         * can differ by it, so the credentialed-reader comparison has the same
         * exposure, and `maskTheme` is not applied to that one.
         *
         * WHAT STOPS THIS FROM HIDING A DEFECT: the health-tile case at the top
         * of this gate asserts, against the same deployment, that the attribute
         * is present, numeric and inside one poll interval, and that the
         * verdict gets NEWER across a call to `/api/health`.
         *
         * The tile's VALUE is deliberately NOT masked. A `5/5` against a `--`
         * is a verdict disagreeing with a verdict, and two renders seconds
         * apart that disagree about whether the site is healthy is a finding.
         */
```

### scripts/check-browser.mjs:2140 (CONTRACT, shortened)

enumeration intent kept, shortened.

```js
/*
     * WHAT THE THEME IS ALLOWED TO CHANGE, enumerated. Masking both of these
     * must make the documents identical; anything left over is a byte that
     * depends on the reader for some other reason, which is the finding.
     */
```

### scripts/check-browser.mjs:2148 (WHY, shortened)

why the meta is masked kept; date moved.

```js
/*
         * THE COLOUR-SCHEME META JOINED THIS SET on 2026-08-28, and it is the
         * third thing the theme is allowed to change. It has to be here: it
         * carries the resolved theme by design, so leaving it out would make
         * the enumeration below fail on every route for a difference that is
         * the point of the meta rather than a leak. Its own case asserts the
         * value, which is what stops this mask from hiding a defect.
         */
```

### scripts/check-browser.mjs:2157 (HISTORY, deleted)

aria-pressed removal narrative.

```js
/*
     * THE SET SHRANK ON 2026-08-29, and shrinking is the strict direction.
     *
     * A third entry masked `aria-pressed`, because the theme control was three
     * buttons and the pressed one moved with the theme. The control is one
     * button now and carries no pressed state: BOTH of its buttons ship in
     * every document and the cascade displays whichever matches `data-theme`,
     * so the markup of the control is byte-identical between light and dark and
     * there is nothing about it to mask.
     *
     * That makes the comparison below STRONGER rather than weaker. Two things
     * are now allowed to differ where three were, so a control that started
     * varying its own markup by theme would fail here instead of being masked.
     */
```

### scripts/check-browser.mjs:2171 (WHY, shortened)

hard rule 8 citation kept; reasoning shortened.

```js
/*
     * THE HOME TILE'S AGE SENTENCE IS NOT IN THIS SET, and the omission is the
     * ruling rather than an oversight.
     *
     * It was going to be added here under hard rule 8, which names `maskTheme`
     * the one owner of the enumeration. The rule 8 tag is about what the THEME
     * may change, and the sentence is not that: it varies with the clock, it
     * varies between two requests that carry the same cookie, and it therefore
     * has exactly the same exposure in the credentialed-reader comparison
     * above, which `maskTheme` is not applied to. It lives in `mask`, with the
     * nonce and the age attribute it is a second spelling of. See the comment
     * there for the measurement.
     */
```

### scripts/check-browser.mjs:2186 (WHY, shortened)

shortened.

```js
/*
       * The footer assertions below need a RENDERED page, and `fetchDoc` reads
       * bytes rather than driving the browser. One navigation per route, before
       * the byte comparisons, which the comparisons do not disturb: they fetch
       * their own copies with their own cache-busting query.
       */
```

### scripts/check-browser.mjs:2193 (CONTRACT, shortened)

section marker shortened.

```js
/* ---- consistent help: the privacy link is on every public page ------ */
```

### scripts/check-browser.mjs:2195 (WHY, shortened)

3.2.6 order requirement kept, shortened.

```js
/*
     * WCAG 2.2 3.2.6. A help mechanism that appears on some pages and not
     * others is worse than one that appears nowhere: a reader who found it once
     * and cannot find it again concludes it moved, or that they misremembered.
     *
     * ASSERTED ACROSS THE WHOLE SET, in the same loop that proves these routes
     * are byte-identical for a credentialed reader, so the subject is the same
     * derived list rather than a second one that could drift from it. The
     * relative ORDER is asserted too, not just presence: 3.2.6 is about the
     * mechanism being in the same relative order, and a link that moves between
     * the colophon and the feed on different pages satisfies presence while
     * failing the criterion.
     */
```

### scripts/check-browser.mjs:2249 (WHY, shortened)

shortened.

```js
/*
       * THE THEME MUST ACTUALLY CHANGE THE DOCUMENT. Without this the two
       * assertions below would both pass on a site that had stopped rendering
       * the theme server-side altogether, which is the failure that makes the
       * whole cache key pointless.
       */
```

### scripts/check-browser.mjs:2263 (WHY, shortened)

same-document and scope-first kept.

```js
/*
       * THE MENTIONS SECTION, ON THE DOCUMENT THE COMPARISON ABOVE JUST RAN ON.
       *
       * Deliberately not a fetch of its own. The property being established is
       * that the page carrying this section is the page proven byte-identical
       * for a credentialed reader, and a second fetch would be a second
       * document that only probably matches the first.
       *
       * THE FIRST ASSERTION IS THE SCOPE ASSERTION. Without the section
       * present, everything below it passes by examining nothing and the
       * comparison above says nothing about the feature, which is the shape
       * this repository has been bitten by more than any other.
       */
```

### scripts/check-browser.mjs:2349 (CONTRACT, shortened)

section marker shortened.

```js
/* ------ the cache itself moved to verify-live, and here is why --------- */
```

### scripts/check-browser.mjs:2351 (WHY, shortened)

why skipped kept; port history moved.

```js
/*
     * THREE CACHE ASSERTIONS USED TO LIVE HERE AND CANNOT ANY MORE, 2026-09-05.
     *
     * They reused one key across four requests and read `x-theme-cache`, the
     * marker the hand-built `caches.default` layer set: a miss then a hit on the
     * same theme, a cookied reader never receiving a public cache-control, and a
     * light reader not being served the warmed dark document. Three more did the
     * same for the negotiated representations.
     *
     * ## WHY THEY CANNOT BE PORTED, AND IT IS MEASURED RATHER THAN ASSUMED
     *
     * The layer is gone (rulings 11, 15, 16) and the platform cache replaced it.
     * MINIFLARE DOES NOT IMPLEMENT WORKERS CACHE. Measured 2026-09-05 under this
     * gate's own `vite preview`, before the split was written: a response
     * carrying `public, s-maxage=600` and a fixed `cf.cacheKey` was re-rendered
     * on all three fetches, the body's timestamp changed every time, and no
     * `Cf-Cache-Status` header appeared at all. The same is true in the worker
     * test pool, which is the same runtime.
     *
     * So there is no local cache to warm, no marker to read, and a ported
     * assertion would be green on a site whose cache was completely broken.
     * That is worse than no assertion, which is why this is a SKIP that names
     * the instrument rather than a quiet deletion.
     *
     * ## WHAT STILL COVERS IT
     *
     * `verify-live` owns all six wire measurements now (ruling 18), against
     * production, reading `Cf-Cache-Status` and the theme attribute. What THIS
     * gate still owns is the half that licenses the key being short: the
     * byte-identity and theme-only-difference assertions in the loop above,
     * which are untouched and are what would catch the document starting to
     * depend on the cookie for some other reason.
     */
```

### scripts/check-browser.mjs:2392 (CONTRACT, shortened)

section marker shortened.

```js
/* ------ the negotiated ROUTING half, which needs no cache -------------- */
```

### scripts/check-browser.mjs:2394 (WHY, shortened)

scope limit kept; incident moved.

```js
/*
     * WHAT SURVIVES THE MOVE, and it is the half that was actually broken.
     *
     * The defect this replays reached production: after the deploy of 2f0b4d5,
     * `Accept: text/markdown` on a post returned 31,869 bytes of `text/html`.
     * The CACHE was the mechanism, but the property a reader cares about is
     * simply that asking for markdown gets markdown, and that property is
     * testable with no cache at all.
     *
     * The old version warmed the HTML entry first and asserted the warming,
     * because without a warm entry the alternate representation rendered fresh
     * for the boring reason and the case passed on a broken site. THAT
     * PRECONDITION IS GONE WITH THE CACHE and is not reconstructible here, so
     * this case is deliberately weaker than the one it replaces: it proves the
     * routing and says nothing about what the cache would have answered.
     * `verify-live` measurement (a) is where the cache half is established.
     */
```

### scripts/check-browser.mjs:2442 (WHY, shortened)

shortened.

```js
/*
       * AND IT DECLARES ITSELF UNSTORABLE. This is the part of the old
       * three-assertion block that survives without a cache: the negotiated
       * response must say `no-store` on its own, which is what keeps the
       * platform from holding it under a key the HTML reader also matches.
       */
```

### scripts/check-browser.mjs:2458 (CONTRACT, shortened)

section marker shortened.

```js
/* ---- the BROWSER is told the colour scheme, before it fetches CSS ---- */
```

### scripts/check-browser.mjs:2460 (WHY, shortened)

cause and why-not-pixels kept; measurements moved.

```js
/*
     * THE WHITE FRAME BETWEEN TWO PAGES, and why this is the assertion.
     *
     * ## WHAT WAS MEASURED
     *
     * Real Chrome 151, headed, sampling the SCREEN at about 45 frames a
     * second, against production. A header click from `/` to `/blog` with
     * `theme=dark` and `prefers-color-scheme: light`: one composited frame at
     * 253 of 255 between two pages that settle at 61. Same click with
     * `<meta name="color-scheme" content="dark">` injected into the same bytes
     * and nothing else changed: never leaves the dark range. Peak 253 against
     * peak 61 is the whole finding.
     *
     * `data-theme` tells the STYLESHEET which palette to use. Nothing in the
     * document told the BROWSER, so the canvas it paints between and beneath
     * documents was its default, which is light.
     *
     * THE READER IT HAPPENS TO is the one whose choice disagrees with their
     * machine. With `theme=dark` AND a dark OS there is no flash on any
     * navigation, which is why every earlier attempt to reproduce it failed:
     * the instrument had been setting both from one variable.
     *
     * ## WHY THIS IS NOT A PIXEL ASSERTION, stated because the pixel form was
     * ## asked for and was BUILT before being rejected on measurement
     *
     * Nothing available to a headless gate can see this flash:
     *
     *   - `Page.startScreencast` carries frames the RENDERER composites. The
     *     white is painted by the BROWSER compositor. Measured headless AND
     *     headed on the reproducing click: brightest cast frame 34 of 255
     *     while the screen was 253. With a stylesheet delayed 2,500 ms the
     *     cast emits NOTHING between 34 ms and 2,792 ms, so it does not merely
     *     miss the flash, it reports nothing at all about that interval.
     *   - `Page.captureScreenshot({ fromSurface: true })` does see it, once,
     *     by luck. It BLOCKS while the renderer has no frame, which is exactly
     *     the interval in question, so it samples the moments the flash is not
     *     there. Two runs of the same condition: one caught a 255, the next
     *     caught nothing.
     *
     * A "zero flash frames" case built on either would have passed with the
     * fix removed. That is the unfailable-threshold class, and it is worse
     * than no gate because it reads as coverage.
     *
     * What DID see it is a PowerShell screen-capture loop over a headed
     * window, and that is not a gate: it is Windows-only, it needs an unlocked
     * desktop at fixed coordinates, it took ten minutes for sixty runs, and it
     * rejected about a third of its own runs as not looking at the browser. A
     * gate that can silently degrade into a pass is the failure mode this repo
     * has paid for most.
     *
     * So the assertion is the document property the experiment proved causal,
     * on every public route and every reader state. It cannot silently pass:
     * remove the meta and every route fails by name.
     */
```

### scripts/check-browser.mjs:2518 (CONTRACT, shortened)

why both-values kept, shortened.

```js
/**
       * The four reader states, and the value each one must produce.
       *
       * "system" and no-cookie both resolve to `light dark` because the reader
       * has not chosen: the document supports both and the machine decides.
       * Asserting a single value there would put the flash back for whichever
       * half of those readers the guess went against.
       */
```

### scripts/check-browser.mjs:2529 (WHY, shortened)

legacy cookie kept; date moved.

```js
/* THE LEGACY COOKIE. No control writes `system` since 2026-08-29, and
         * `/theme` refuses it, but cookies carrying it are in readers' browsers
         * for a year. It still means "follow the machine", so it must resolve
         * exactly as no cookie does. */
```

### scripts/check-browser.mjs:2559 (WHY, shortened)

position rationale kept, shortened.

```js
/*
         * POSITION, because a signal that arrives after the stylesheet has
         * already been requested is a signal that arrived too late to matter.
         * Asserted against the FIRST stylesheet link rather than against
         * charset: React 19 hoists document metadata and owns the order among
         * the metas, so pinning an exact index would be asserting React's
         * internals rather than the property that makes this work.
         */
```

### scripts/check-browser.mjs:2580 (WHY, shortened)

rule 17 pairing kept, shortened.

```js
/*
       * AND THE MARKUP AGREES WITH THE CASCADE. The meta and the stylesheet
       * are two statements of one fact, which rule 17 tolerates only while
       * something checks they still say the same thing: a palette moved in CSS
       * with the meta left behind would restore the flash while every byte
       * assertion above still passed.
       */
```

### scripts/check-browser.mjs:2608 (CONTRACT, shortened)

section marker shortened.

```js
/* ---- a public navigation does not run a view transition -------------- */
```

### scripts/check-browser.mjs:2610 (WHY, shortened)

cause and two-half assertion kept; measurements moved.

```js
/*
   * THE NAVIGATION BLINK, and why the assertion is the ViewTransition object.
   *
   * ## WHAT WAS MEASURED, production, `/` to `/blog`, three runs per cell
   *
   * Compositor frames, each scored against the settled origin page and the
   * settled destination page, so a frame that is NEITHER shows up as a spike
   * over a measured noise floor:
   *
   *   as-is    12 to 14 intermediate frames, 214-220 ms dark and 245-259 ms
   *            light, peak 33 to 66 times the floor
   *   reduce   two frames after the click, nothing in between
   *   none     one frame after the click, nothing in between
   *
   * Chrome's default root crossfade animates both snapshots through partial
   * opacity for a quarter of a second. On a plane that navigates by full
   * document load, that ran on every header click, and TWO EARLIER SESSIONS
   * HERE RECORDED THE ViewTransition OBJECT'S PRESENCE AS HEALTH. It was the
   * disease. This case exists so that reading cannot be made again.
   *
   * ## WHY THE PROPERTY AND NOT THE PIXELS
   *
   * A pixel assertion would need the frames above, and a gate cannot have
   * them: the crossfade is renderer paint so `Page.startScreencast` does carry
   * it, but the measurement needs a settled reference on both sides plus a
   * noise floor per run, and the cast emits only on change, so a clean
   * navigation yields one or two frames and no floor at all. The object is the
   * cause, it is one boolean, and it cannot be true while the fade is absent.
   *
   * `pagereveal` fires on EVERY document load, with a null `viewTransition`
   * when no transition is running. So the assertion has two halves and needs
   * both: the event fired at all, which proves the probe ran, and the object
   * was null, which is the property. Asserting only the second would pass on a
   * page where the listener never attached.
   */
```

### scripts/check-browser.mjs:2649 (WHY, shortened)

binding choice kept; first-version story moved.

```js
/*
     * THE EVENT IS REPORTED TO NODE, not stashed in sessionStorage.
     *
     * The first version wrote a record in `pagereveal` and read it back after
     * the navigation. It came back null on every run while a standalone script
     * doing the same thing returned it fine, so the read was answering about
     * something other than the document under test. An exposed binding is
     * re-installed on every document by puppeteer and fires in Node at the
     * moment the event does, which removes the round trip and the question of
     * when it is safe to read.
     */
```

### scripts/check-browser.mjs:2678 (WHY, shortened)

trap kept; attempt narrative moved.

```js
/*
     * PRERENDERING OFF, and this is the whole reason the first three attempts
     * at this case failed while a standalone script doing the same thing
     * worked.
     *
     * The rules were `prerender` when this was written, so hovering the link
     * prerendered it and the click ACTIVATED that document. A prerendered
     * document is a separate target: the script injected here never ran in it,
     * so no listener existed to fire. Measured: the initial load on `/`
     * recorded {"path":"/","hasTransition":false} and the click recorded
     * nothing at all, while `location.pathname` read `/blog`. That reads
     * exactly like "the event did not fire" and is really "the probe was not
     * in that document".
     *
     * **The site now speculates `prefetch`, so it can no longer produce a
     * document this probe is absent from.** The guard is KEPT anyway, and
     * deliberately: it costs one CDP call, it is what makes this case a
     * statement about an ordinary document load whatever the rules say, and the
     * failure it prevents presents as a silent absence rather than an error.
     * The action itself is asserted in the speculation case below.
     */
```

### scripts/check-browser.mjs:2702 (WHY, shortened)

breakpoint trap kept; incident moved.

```js
/*
     * A DESKTOP VIEWPORT, BECAUSE THE LINK THIS CASE CLICKS HAS A BREAKPOINT.
     *
     * MEASURED 2026-09-14 on the deployed site. This page took puppeteer's
     * default 800x600, narrower than the 64rem at which `.site-header-nav` is
     * supposed to appear. The link was still in the DOM, so the precondition
     * below passed; its rect was all zeros, so the click landed at the document
     * corner and the page stayed on `/`. Three assertions failed and NONE of
     * them was about the subject: the arrival, `pagereveal`, and the
     * view-transition assertion that is the point of the whole case.
     */
```

### scripts/check-browser.mjs:2725 (HISTORY, deleted)

hover rationale narrative.

```js
/*
     * A REAL CLICK ON THE HEADER LINK, hovered first. This was written when a
     * click with no dwell could activate a PENDING prerender, which puppeteer
     * cannot follow: the page stayed on `/` and the case asserted against a
     * navigation that never happened. The action is `prefetch` now and the
     * guard above forbids prerendering regardless, so the hover is no longer
     * load-bearing; it is kept because a hovered click is the more realistic
     * gesture and costs nothing. The arrival is still checked below.
     */
```

### scripts/check-browser.mjs:2734 (WHY, shortened)

zero-box trap and fallback kept; defect report moved.

```js
/*
     * PRESENT IS NOT THE SAME AS CLICKABLE, and the difference cost this case
     * three results. `getBoundingClientRect` returns a zero box for an element
     * that exists and is hidden, and the midpoint of a zero box is the corner
     * of the document, so the gesture silently became "click at (0,0)". The box
     * is returned here so the assertion can refuse that, on the same rule the
     * restored search control's width measurement follows: a control that is
     * present and measures zero is a harness fault, not a reading.
     *
     * ## WHY THIS LOOKS IN TWO PLACES, WHICH IS NOT THE GATE GIVING GROUND
     *
     * MEASURED 2026-09-14 on the deployed site, at 375, 768, 1024 and 1280:
     * `.site-header-nav` computes `display: none` at EVERY width. `shell.css`
     * declares it hidden under the comment "The six destinations, at 64rem and
     * up only" and no rule anywhere un-hides it, so build 2's desktop nav ships
     * as six links no reader can reach. That is a site defect and it is
     * REPORTED rather than absorbed here.
     *
     * The subject of this case is what a CROSS-DOCUMENT NAVIGATION does, not
     * which control the reader started from. The overflow menu carries the same
     * six destinations and is the only visible route to them today, so the
     * gesture falls back to it and the strength of the assertion below is
     * unchanged. What is NOT relaxed is the requirement itself: if neither copy
     * of the link is laid out, this fails and the navigation cases do not run.
     */
```

### scripts/check-browser.mjs:2853 (CONTRACT, shortened)

section marker shortened.

```js
/* ---- the speculation rules, as CHROME parses them -------------------- */
```

### scripts/check-browser.mjs:2855 (WHY, shortened)

never assert activation kept; measurements moved.

```js
/*
   * THE OTHER HALF OF THE NAVIGATION BLINK, and the assertion is the CANDIDATE
   * LIST because the activation cannot be observed at all.
   *
   * ## WHAT THIS IS FOR
   *
   * Dustin still saw a blink after the view-transition fix above, on clicks to
   * destinations nothing had speculated. Measured on production 2026-08-28: a
   * footer click to `/colophon` reported `deliveryType` empty and produced no
   * preloading attempt of any kind, while every header and post click reported
   * `navigational-prefetch`. The rules covered the header's five paths and
   * `/blog/*` and nothing else, so `/colophon`, `/privacy`, `/search` and a post
   * linked from anywhere but a blog page were cold document loads.
   *
   * ## WHY A GATE CAN NEVER ASSERT THAT A PRERENDER ACTIVATED
   *
   * **CHROME REFUSES TO PRERENDER WHILE CDP IS ATTACHED.** Measured 2026-08-28
   * against production: `Preload.prerenderStatusUpdated` reports every single
   * attempt as `Failure [PrerenderingDisabledByDevTools]`, Chrome falls back to
   * prefetch, and the destination reports `deliveryType: navigational-prefetch`
   * with `activationStart: 0`. It is CDP itself and not the Preload domain,
   * confirmed by running the same navigation with the domain never enabled and
   * getting an identical result.
   *
   * So `activationStart > 0` is unfalsifiable here in the worst way: it is
   * always 0, and a gate asserting it would fail forever while the site was
   * correct. Do not add it. What IS observable is everything upstream of the
   * activation: that the block is on the page, that Chrome ACCEPTED the rule
   * set, and which URLs it resolved as candidates. A candidate list is the
   * browser's own reading of the payload, which is strictly more than a source
   * match can give, and it is where a malformed `href_matches` shows up: a
   * rejected rule set renders identically and speculates nothing.
   *
   * ## THE EXCLUSIONS ARE ASSERTED AGAINST THE LINKS THAT ACTUALLY EXIST
   *
   * `/blog` renders a `?tag=` chip per tag, a `?page=` link, the `.md` twin's
   * cousin `rss.xml`, and `/login` in the header. So the exclusion assertions
   * below have a live subject rather than a hypothetical one, and the case
   * proves that subject non-empty before reading anything into a zero.
   */
```

### scripts/check-browser.mjs:3028 (WHY, shortened)

shortened.

```js
/*
     * THE COVERAGE HALF. `/colophon` is the exact destination measured cold on
     * production, and it is reached from the FOOTER, which is why a rule scoped
     * to the header or to `/blog/*` never covered it.
     */
```

### scripts/check-browser.mjs:3050 (WHY, shortened)

shortened.

```js
/*
     * THE EXCLUSION HALF, each one asserted against links the page really
     * renders. The counts are proven non-empty first, because "no excluded
     * candidate" and "no such link on the page" are the same reading otherwise.
     */
```

### scripts/check-browser.mjs:3059 (WHY, shortened)

stripComments trap kept; measurement moved.

```js
/*
         * NOTE THE PHRASING, and it is not stylistic. This detail cannot spell
         * the wrong glob out, because a slash-star inside a string literal in a
         * gate file opens a BLOCK COMMENT as far as `stripComments` is
         * concerned: it is not string-aware, and it then runs to the next
         * close-comment anywhere in the file. Written literally here, this
         * string hid 74 of this gate's own `ok()` calls from
         * `check:invariants` section 17, which is what caught it: 97 calls
         * examined before, 23 after. Measured 2026-08-28.
         */
```

### scripts/check-browser.mjs:3109 (WHY, shortened)

reason kept; incident moved.

```js
/*
   * THE PAGE GOES BACK TO /blog BEFORE THE COLUMN CASE.
   *
   * Everything from here down reads the CURRENT page, and it has always been
   * /blog because the stylesheet case near the top navigated there and nothing
   * between moved it. The consistent-help assertions added on 2026-08-28 need a
   * rendered page per route, so they navigate, and the last route in that list
   * is /privacy: the column case then measured a page with no `.blog-search`
   * and reported "a missing element makes the comparison below vacuous".
   *
   * That is the third time in this file that adding a navigating case broke a
   * later case reading the page it left behind, and the second time in one
   * session. Restoring here rather than making the case below navigate for
   * itself, because the case below is not mine and its assumption was correct
   * until this block existed.
   */
```

### scripts/check-browser.mjs:3127 (CONTRACT, shortened)

section marker shortened.

```js
/* ---- the layout does not shift while the font arrives ----------------- */
```

### scripts/check-browser.mjs:3129 (WHY, shortened)

placement, throttle and null-observer kept; measurements moved.

```js
/*
   * WHY THIS LIVES HERE AND NOT IN check:page-payload OR verify-live.
   *
   * The audit asked for a CLS ceiling in `check:page-payload`, falling back to
   * verify-live. Neither can hold one: `check:page-payload` is offline and
   * reads the build on disk, and verify-live is a fetch client with no
   * rendering engine. CLS is a rendering measurement, and this file is the only
   * gate that renders.
   *
   * ## WHAT IT IS FOR
   *
   * MEASURED on /blog at 390x844 on Slow 4G with a cold cache: CLS 0.0674, one
   * shift at about six seconds, the tag-chip row re-wrapping when the web font
   * replaced the fallback and moving everything below it by a line. Blocking
   * the woff2 and changing nothing else gave 0.0000, which is the
   * single-variable experiment that named the cause. The repair was
   * `font-display: optional` on the normal face; this is what stops it coming
   * back.
   *
   * ## THROTTLED, BECAUSE OTHERWISE IT CANNOT FAIL
   *
   * Against a localhost preview the font arrives in single-digit milliseconds,
   * inside any block period, so an unthrottled run reports 0.0000 whatever
   * `font-display` says. That is the unfailable-threshold class: a ceiling
   * nothing can breach is not a ceiling. Slow 4G is the profile the shift was
   * found on and the one that can still expose it.
   *
   * ## AND A ZERO IS ONLY BELIEVED IF THE OBSERVER RAN
   *
   * A missing PerformanceObserver reports the same 0.0000 a stable page does.
   * The probe therefore returns null when it never installed, and null fails
   * rather than passing. That distinction is exactly what made an earlier
   * reading of this shift wrong: disabling JavaScript to test whether script
   * caused it also disabled the observer measuring it, so "no script, no shift"
   * was a statement about the instrument.
   */
```

### scripts/check-browser.mjs:3210 (CONTRACT, shortened)

section marker shortened.

```js
/* ------------------------------------- 1. the search field and the column */
```

### scripts/check-browser.mjs:3212 (WHY, shortened)

alignment-not-literal kept; measurement moved.

```js
/*
   * THE DEFECT: `.blog-search` carries no max-width while `.page-head`,
   * `.tag-chips` and `.post-list` are each `max-width: 48rem; margin: 0 auto`.
   * MEASURED at 1280: search 1216px against a 768px column, left 32 against 256.
   *
   * Asserted as ALIGNMENT against a sibling rather than against the literal
   * 48rem. A hardcoded 768 would be a second statement of a value app.css owns,
   * and it would go red the day the column is deliberately widened, which is a
   * design decision and not a defect.
   */
```

### scripts/check-browser.mjs:3249 (CONTRACT, shortened)

section marker shortened.

```js
/* ------------------------------------------------ 2. the skip link target */
```

### scripts/check-browser.mjs:3251 (WHY, shortened)

shortened.

```js
/*
   * Both halves. A skip link whose target does not exist is a keyboard trap
   * dressed as an affordance, and the audit records it as a dead hash on the
   * login page and the error boundary. The public pages are checked here; login
   * is checked below because it is a different layout entirely.
   */
```

### scripts/check-browser.mjs:3276 (CONTRACT, shortened)

section marker shortened.

```js
/* ------------------------------- 3. aria-current is not on Blog on a post */
```

### scripts/check-browser.mjs:3278 (WHY, shortened)

shortened.

```js
/*
   * THE DEFECT: `<NavLink to="/blog">` has no `end`, so React Router marks it
   * active for every `/blog/*` descendant and stamps `aria-current="page"` on a
   * link that is not the current page. The admin nav already uses `end: true`,
   * so the repo disagrees with itself.
   */
```

### scripts/check-browser.mjs:3311 (CONTRACT, shortened)

section marker shortened.

```js
/* --------------------------------------- 4. no horizontal scroll at 320px */
```

### scripts/check-browser.mjs:3313 (WHY, shortened)

why every page and named element kept; measurement moved.

```js
/*
   * THE WIDEST-REACHING OF THE FIVE. Measured on every public page rather than
   * one, because the culprit turned out to be shared chrome: `.site-header-nav`
   * is `display: flex` with no `flex-wrap` and no narrow media query, so four
   * links plus the search control plus the theme toggle measure 414px inside a
   * 320px viewport and every public page scrolls sideways.
   *
   * The offending element is NAMED in the failure, not just the page, because
   * "something overflows" sends the next reader hunting through 8,700 lines of
   * CSS.
   */
```

### scripts/check-browser.mjs:3324 (WHY, shortened)

shortened; date moved.

```js
/*
   * `/playground` JOINED THIS LIST on 2026-08-30, and it is the page with most
   * to lose from being absent. It carries the widest content on the public
   * plane: the fusion table's six columns, the rendered markdown pane and now
   * the key demo's nine-cell grid. Each of those scrolls inside its own box by
   * design, and this case is the only instrument that can tell a box that
   * scrolls from a page that does.
   */
```

### scripts/check-browser.mjs:3363 (CONTRACT, shortened)

section marker shortened.

```js
/* ------------------- 4a. MATH: the one page that must not drag the doc --- */
```

### scripts/check-browser.mjs:3365 (WHY, shortened)

paired control and hard rule 4 kept, shortened.

```js
/*
   * WHY 375 AND NOT 320. The loop above runs at 320, which is the narrowest
   * width this site claims, and this case runs at 375 because that is the width
   * the ruling names and the one a phone actually has. Both are in the admin
   * loop's list for the same reason. A display equation is wider than the
   * column at EVERY width, so the case is not width-sensitive in the way the
   * chrome above is: what it proves is that the box scrolls and the document
   * does not, and 375 is where a person would see it fail.
   *
   * ## THE PAIRED CONTROL IS THE HALF THAT MAKES IT A MEASUREMENT
   *
   * "The document does not scroll sideways" is true of a page whose equation
   * failed to render at all, and true of a page where the stylesheet never
   * loaded and every expression collapsed to unstyled text. So the overflow
   * assertion is bracketed: the display box must itself be WIDER than its own
   * client width (there is really something overflowing), and the stylesheet
   * must be linked (it is really being styled). Neither alone means anything.
   *
   * ## AND A MATHLESS POST LINKS NOTHING, which is hard rule 4's half
   *
   * `check:page-payload` proves the sheet is in no route manifest, offline,
   * from the build. This proves the OTHER direction on the wire: the document a
   * reader of a mathless post receives carries no link to it. Two instruments,
   * two artifacts, one claim.
   */
```

### scripts/check-browser.mjs:3404 (WHY, shortened)

shortened.

```js
/*
     * THE DOOR OPENED, ASSERTED FIRST. `/preview/:token` answers one 404 for
     * every refusal it has, so a stale KV record, a revoked token and a
     * published post are indistinguishable from here. Reading anything into the
     * assertions below without this would be reading it out of an error page.
     */
```

### scripts/check-browser.mjs:3418 (WHY, shortened)

hoisting trap kept; incident moved.

```js
/*
     * THE HEAD ORDER ON THIS PAGE, and it is here because the defect that
     * forced it was invisible everywhere else.
     *
     * The colour-scheme meta must be declared before the first stylesheet
     * request; that is asserted for five public paths in the theme block above,
     * and a math page is in none of them. The first implementation rendered the
     * link from the post component with React 19's `precedence`, which HOISTS a
     * managed stylesheet to the top of `<head>`, above the meta. It was caught
     * only because the plant that forced the flag true put the sheet on
     * `/blog/ten-years-on-cloudflare`, which IS in that set. Without this line
     * the arrangement would have been correct on twelve posts and inverted on
     * the one with maths.
     */
```

### scripts/check-browser.mjs:3531 (WHY, shortened)

shortened.

```js
/*
     * COLOUR, MEASURED RATHER THAN REASONED ABOUT, and this is the case
     * `check:contrast` cannot carry.
     *
     * That gate computes ratios from token hexes in the stylesheet and says so
     * in its own header: it does not render, so it cannot see a colour that is
     * inherited rather than declared. KaTeX declares none. Its glyphs are text,
     * its rules are borders, and its stretched delimiters are SVG with
     * `fill: currentColor`, so the whole expression takes whatever `.prose` is
     * painting. The way to check an inherited value is to read the COMPUTED one
     * off a rendered page, which is this instrument.
     *
     * Equality against the prose colour is the right assertion rather than a
     * ratio: if they are equal, every contrast fact `check:contrast` already
     * proves about body text is a fact about the maths too, in both themes and
     * under forced-colors, without this gate restating a single threshold.
     */
```

### scripts/check-browser.mjs:3555 (WHY, shortened)

workaround kept; version measurement moved.

```js
/*
     * FORCED COLOURS GOES THROUGH CDP, not through `page.emulateMediaFeatures`.
     *
     * MEASURED 2026-09-06: puppeteer 25.4.0 validates the feature name against
     * its own allowlist and throws `Unsupported media feature: forced-colors`
     * before anything reaches the browser. Chrome supports it perfectly well;
     * it is the wrapper that does not know about it. `Emulation.setEmulatedMedia`
     * is the call puppeteer would have made, so this is the same instrument with
     * one fewer layer, and it is the shape this file already uses for the
     * Preload domain.
     */
```

### scripts/check-browser.mjs:3602 (CONTRACT, shortened)

section marker shortened.

```js
/* ---- and the control: a mathless post links nothing extra ----------- */
```

### scripts/check-browser.mjs:3620 (CONTRACT, shortened)

section marker shortened.

```js
/* ------------------- 4b. THE PLAYGROUND'S DEMOS ANSWER ON THE WIRE ------- */
```

### scripts/check-browser.mjs:3622 (WHY, shortened)

Hard rule 7 kept, shortened.

```js
/*
   * WHY THIS EXISTS ALONGSIDE check:features, which already runs every one of
   * these modules over the same fixtures.
   *
   * That gate imports the modules and compares their return values. It is the
   * right instrument for "does the grammar say this", and it is BLIND to the
   * only thing that can go wrong afterwards: whether a reader who pastes the
   * URL gets the answer. A loader that threw, a section that stopped
   * rendering, a WASM module that will not instantiate in workerd, a
   * `<Form action>` pointing at the wrong path, all of those leave every
   * source-reading assertion green. Hard rule 7: a gate that feeds a module
   * its own stored output cannot see the transport.
   *
   * THE MARKDOWN CASE IS THE ONE THAT EARNS THIS. Its renderer needs the
   * Worker's WASM instantiator, and the Node build has a different one, so
   * check:features CANNOT observe the failure mode that matters here: it
   * would pass on a page that answers every reader with a render failure.
   *
   * EXPECTATIONS ARE THE MANIFEST'S, read from the same file the page renders
   * from, so this case cannot drift from the presets. It asserts the ANSWER
   * appears, not where: these are visible-text checks over the whole document,
   * because asserting a cell position would fail on a restyle rather than on a
   * defect.
   */
```

### scripts/check-browser.mjs:3656 (WHY, shortened)

shortened.

```js
/*
     * SCOPE FIRST. Every assertion below is "this string is present", and a
     * page that failed to render at all would fail them for the wrong reason
     * while a page that rendered an EMPTY demo would pass nothing. Proving the
     * page is the playground, and that the sections exist, is what makes the
     * per-demo results below mean what they say.
     */
```

### scripts/check-browser.mjs:3674 (CONTRACT, shortened)

section marker shortened.

```js
/* -- the key grammar, on the wire -------------------------------------- */
```

### scripts/check-browser.mjs:3707 (WHY, shortened)

shortened.

```js
/*
     * THE CLASSIFIER'S REFUSAL, on the wire. A caught throw that renders
     * nothing is the failure this demo would have, and it looks identical to a
     * working page in every source-reading gate.
     */
```

### scripts/check-browser.mjs:3729 (CONTRACT, shortened)

section marker shortened.

```js
/* -- the theme resolver, on the wire ----------------------------------- */
```

### scripts/check-browser.mjs:3736 (WHY, shortened)

shortened.

```js
/*
       * THE ATTRIBUTE ROW IS THE ASSERTION, not the resolved theme, because
       * "system" appears in the page's prose and would match anywhere. The
       * rendered word for an absent attribute is "omitted", which appears
       * nowhere else, so a preset resolving to the default is checked by a
       * string only this row can produce.
       */
```

### scripts/check-browser.mjs:3751 (CONTRACT, shortened)

section marker shortened.

```js
/* -- the markdown pipeline, on the wire -------------------------------- */
```

### scripts/check-browser.mjs:3753 (WHY, shortened)

shortened.

```js
/*
     * THE WASM CASE. `renderBody` starts a syntax highlighter on an oniguruma
     * WebAssembly module, and workerd refuses `WebAssembly.instantiate()` on
     * raw bytes, which is what the Node default ends up doing. The Worker
     * installs a different instantiator. check:features runs the NODE path and
     * therefore cannot observe this failing; only a real Worker can.
     */
```

### scripts/check-browser.mjs:3784 (WHY, shortened)

shortened.

```js
/*
       * THE HIGHLIGHTER RAN, asserted on the DOM rather than on text: shiki
       * emits per-token spans, and their absence is exactly what a Worker that
       * could not instantiate the WASM module would produce. A snippet with no
       * code fence has none, so this is conditional on the snippet carrying one.
       */
```

### scripts/check-browser.mjs:3803 (WHY, shortened)

shortened.

```js
/*
         * THE DEMOTED URL IS NOT LIVE. The count is check:features' claim; this
         * is the one that matters on a page a reader loads, and it is asserted
         * against the DOM's own links rather than against the source bytes.
         */
```

### scripts/check-browser.mjs:3822 (CONTRACT, shortened)

section marker shortened.

```js
/* ------------------------------------------------- 5. the login skip link */
```

### scripts/check-browser.mjs:3840 (CONTRACT, shortened)

section marker shortened.

```js
/* --------------------- 5b. THE ENHANCEMENTS RUN, and nothing else ships */
```

### scripts/check-browser.mjs:3842 (WHY, shortened)

rule 9 half, Ask exclusion and console check kept; date moved.

```js
/*
   * The public plane stopped hydrating React (2026-08-26), so "works without
   * script" stopped being the risky half of rule 9's standing ruling: the
   * server-rendered page is now also what a scripted reader gets, plus four
   * nonced enhancement bundles. What can silently die is the OTHER half,
   * "fast with it": a bundle the CSP refuses, a selector that moved, or a
   * ?url import gone stale produces a page that renders perfectly and
   * enhances nothing, with every source-reading gate green. These cases run
   * the bundles in a real browser, which is the only instrument that can see
   * that class.
   *
   * WHAT IS DELIBERATELY NOT DRIVEN: the Ask stream. Clicking the trigger
   * bills a Workers AI generation per run, which is why the billed probe
   * lives in verify-live and not in a gate (same ruling as its Ask probes).
   * Asserted here instead: the affordance is visible and bound, which is the
   * half that dies silently.
   *
   * CONSOLE ERRORS ARE COLLECTED ACROSS THESE CASES and asserted empty at the
   * end. A CSP refusal of an un-nonced or mis-pathed bundle surfaces exactly
   * there and nowhere else this gate looks; this assertion is what makes
   * "remove the nonce" a plant this gate can catch by name.
   */
```

### scripts/check-browser.mjs:3875 (WHY, shortened)

shortened.

```js
/*
   * The expected script set, derived from the SOURCE listing rather than the
   * build: an enhancement asset's stem is its module's basename (the ?url
   * asset is dist/<name>.js emitted as <name>-<hash>.js), and app/enhance/ is
   * present in any checkout while build/client may belong to another build.
   * Stems, not names, for the reason chunkStem gives in check-page-payload.
   */
```

### scripts/check-browser.mjs:3895 (WHY, shortened)

shortened.

```js
/*
   * A post that actually carries code blocks, found by walking the listing
   * rather than naming a slug: a slug pinned here goes stale the day the post
   * is retitled, and the corpus is the loader's business. Capped so a corpus
   * with no code posts skips loudly instead of crawling everything.
   */
```

### scripts/check-browser.mjs:3909 (CONTRACT, shortened)

both directions kept; size history moved.

```js
/*
   * THE BLOG BUNDLE IS FOR POSTS, and the index is not a post.
   *
   * Every one of blog.ts's enhancements targets markup the post pipeline
   * renders inside `.prose`: the reading bar, the table-of-contents scrollspy,
   * the code-block buttons, the heading links, the footnote previews and the
   * lightbox. The listing has none of them, and it carried the bundle anyway
   * until 2026-08-27, so 4,514 bytes were downloaded and parsed to find
   * nothing on the site's second most visited page.
   *
   * BOTH DIRECTIONS, and the positive half is the one that matters. Asserting
   * only "absent from the index" would pass on a commit that deleted the
   * component from both routes and quietly turned seven enhancements off.
   *
   * Read off the resource timeline. A source reading can see the component is
   * gone; only this can see what the browser fetched.
   *
   * @param {string} stem
   */
```

### scripts/check-browser.mjs:3992 (CONTRACT, shortened)

section marker shortened.

```js
/* ---- WCAG 2.2 1.4.13, all three parts, on a post with footnotes -------- */
```

### scripts/check-browser.mjs:3994 (WHY, shortened)

why a browser gate and found-post kept; defect story moved.

```js
/*
   * HOVERABLE, DISMISSIBLE, PERSISTENT. All three were missing, and none of
   * them is visible in a screenshot or reachable by a source reading, which is
   * why they are here rather than in check:policy.
   *
   * The bubble appeared BELOW the reference and `mouseleave` hid it
   * immediately, so it vanished the moment the pointer moved toward it: nobody
   * could read a footnote longer than one glance or select text from one. There
   * was no Escape. A `scroll` listener destroyed it, including on the scroll a
   * reader makes to bring a long footnote into view.
   *
   * THE POST IS FOUND, NOT NAMED. A slug pinned here goes stale the day the
   * post is retitled, and the corpus is the loader's business. Skipped loudly
   * when no post carries a footnote, because a case that silently examines
   * nothing is what the lightbox case already does on this corpus.
   */
```

### scripts/check-browser.mjs:4041 (WHY, shortened)

shortened.

```js
/*
     * HOVERABLE. The pointer moves from the reference to the bubble, which is
     * the gesture the old code made impossible. Moved in one step to the
     * bubble's own centre, because that is what a reader does; a step onto the
     * gap between them would test the grace period rather than the property.
     */
```

### scripts/check-browser.mjs:4102 (CONTRACT, shortened)

section marker shortened.

```js
/* ---- WCAG 2.2 4.1.3, the copy controls announce ---------------------- */
```

### scripts/check-browser.mjs:4104 (WHY, shortened)

observable limit kept; defect story moved.

```js
/*
     * All three copy controls said "Copied" VISUALLY and told a screen reader
     * nothing: two swapped their own textContent and the heading permalink set
     * an attribute that CSS renders through `::after`, which is not in the
     * accessibility tree at all.
     *
     * ASSERTED ON THE REGION, not on the announcement. Whether a screen reader
     * SPEAKS is not observable from here; what is observable is that a
     * `role="status"` region exists and that the copy wrote a message into it.
     * That is the mechanism 4.1.3 requires, and it is the honest limit of what
     * a browser gate can see.
     */
```

### scripts/check-browser.mjs:4154 (WHY, shortened)

trap kept; narrative moved.

```js
/*
   * FROM HERE THE PAGE MOVES AGAIN, and the cases below re-navigate for
   * themselves. The first version of this block sat ABOVE the code-copy case
   * and walked the corpus looking for a footnote, which left the page on a
   * different post: the copy-button assertion then reported "0 button(s) on 0
   * block(s)" about a page that has no code blocks. That is this file's own
   * recorded failure shape, from the home health-tile case, repeated.
   */
```

### scripts/check-browser.mjs:4180 (WHY, shortened)

trap kept; plant story moved.

```js
/*
     * WHEN THE BUNDLE IS DEAD THE CLICK REALLY NAVIGATES, because the form
     * is the fallback and it works. That navigation destroys the execution
     * context, and an evaluate racing it throws rather than returning, which
     * on the first plant run crashed this gate instead of failing it. So the
     * evaluate is caught, and a destroyed context IS the finding: the submit
     * was not intercepted.
     */
```

### scripts/check-browser.mjs:4188 (WHY, shortened)

shortened.

```js
/*
     * ONE BUTTON IN THE ACCESSIBILITY TREE, and this is asserted BEFORE the
     * click because it is a property of the control at rest.
     *
     * The single toggle ships TWO buttons and the cascade displays whichever
     * matches the theme in effect. The hidden one must be `display: none`
     * rather than visually hidden: `.sr-only` would keep it in the
     * accessibility tree, so a screen reader would find two buttons offering
     * opposite actions and no way to tell which one does anything.
     *
     * MEASURED THROUGH `offsetParent`, which is null exactly when an ancestor
     * or the element itself is `display: none`, and NOT through a class name:
     * the assertion is about what the browser did with the element, not about
     * which selector was written.
     */
```

### scripts/check-browser.mjs:4218 (WHY, shortened)

serialization trap kept; incident moved.

```js
/*
         * PLAIN NUMBERS, NOT THE DOMRect. Returning the rect itself reads 0x0
         * on this side: puppeteer serializes the evaluate's result and a
         * DOMRect comes back as an empty object, so `box.width` is undefined
         * and `?? 0` turns a 28px button into a failing 0.
         *
         * MEASURED, on this gate's own first run: "0x0px, floor 24x24" against
         * a control that is 28px square in the page. The instrument was wrong,
         * not the button, which is this repo's simulated-element class wearing
         * a serialization boundary instead of an injected probe.
         */
```

### scripts/check-browser.mjs:4261 (WHY, shortened)

shortened.

```js
/*
     * CLICKED BY WHAT IS VISIBLE, not by value. The dark-setting button is the
     * one displayed while the page is light, which is the state this gate
     * arrives in; selecting by value would click whichever the cascade happens
     * to be hiding and puppeteer would refuse it.
     */
```

### scripts/check-browser.mjs:4272 (WHY, shortened)

shortened.

```js
/*
     * NOT a return: this block is at top level, so an early return is illegal
     * and, worse, would skip every case below it, which is the exact failure
     * clickOrFail exists to stop. The click failing is already counted as a
     * failure; the cases that depend on it are SKIPPED by name so the run says
     * what it did not measure rather than silently measuring a page nobody
     * clicked.
     */
```

### scripts/check-browser.mjs:4309 (WHY, shortened)

shortened.

```js
/* THE CONTROL FOLLOWED THE ATTRIBUTE. The button that was showing set
         * dark; the one showing now must offer the way back, which is what
         * proves the cascade re-resolved rather than the script leaving a
         * control that would set dark a second time. */
```

### scripts/check-browser.mjs:4324 (WHY, shortened)

rule 9 fallback and fragment limit kept; history moved.

```js
/*
     * ## THE SAME CONTROL WITH SCRIPT OFF, which is the half rule 9 is about
     *
     * Everything above proves the ENHANCEMENT works. None of it proves the
     * fallback does, and the fallback is the part the law requires: the
     * enhancement removes a round trip and is allowed to fail.
     *
     * Until now the only no-script assertion about this control was a string
     * match on `action="/theme"` in verify-live, which proves the markup and
     * not the behaviour. A form can carry that attribute and still do nothing:
     * `type="button"` on the submit, a `preventDefault` in the markup, or a
     * server that refuses the value would all pass it.
     *
     * So this drives the real thing with JavaScript DISABLED: click what is
     * visible, let the browser post, and read the document that comes back.
     *
     * ## THE FRAGMENT CANNOT SURVIVE, AND THIS CASE IS HOW THAT WAS FOUND
     *
     * It first asserted that the fragment came back too, because
     * `safeReturnTo` echoes `url.hash` from the `Referer` and its comment said
     * that was what returned a scriptless reader to where they were reading.
     *
     * MEASURED HERE 2026-08-29, in real Chrome, on a real form post: the theme
     * changed correctly and the fragment was GONE. The mechanism is not a bug
     * in the echo, it is that `Referer` never carries a fragment; RFC 9110
     * requires it to be stripped. So the hash branch cannot fire on this path,
     * and no server-side fix exists: the fragment is never sent to an origin at
     * all, so /theme cannot know it and cannot redirect to it.
     *
     * The scripted path keeps the reader's position by never navigating, which
     * is where that promise is actually delivered.
     *
     * So this asserts the PATH, which is achievable and required, and the
     * fragment is documented rather than demanded. An assertion nothing can
     * satisfy is worth less than no assertion, because it is a permanent red
     * that teaches a reader to ignore this gate.
     */
```

### scripts/check-browser.mjs:4365 (WHY, shortened)

trimmed.

```js
/*
         * A CLEAN JAR. The scripted case above leaves a theme cookie in this
         * browser, and a case about the DEFAULT state that inherits somebody
         * else's choice is a case about something else. Cleared so this page
         * loads the way a first-time reader's does.
         */
```

### scripts/check-browser.mjs:4393 (WHY, shortened)

mechanism kept; crash incident moved.

```js
/*
         * CLICKED BY THE VALUE JUST READ AS VISIBLE, never by position.
         *
         * This was `.bar-theme button`, the first in the DOM, and it CRASHED
         * the gate with "Node is either not clickable or not an Element": the
         * scripted case above writes a theme cookie through `document.cookie`,
         * this page shares the browser's cookie jar, so the cascade had hidden
         * the first button and puppeteer refused to click a `display: none`
         * element. A crash is not a failure; it took the whole gate down
         * instead of reporting anything, which is how a plant proves nothing.
         *
         * Selecting by the value that was just measured as visible makes the
         * click independent of which theme this page happens to load in, which
         * is the property the case needs anyway.
         */
```

### scripts/check-browser.mjs:4430 (WHY, shortened)

trimmed.

```js
/*
         * REPORTED, NOT ASSERTED. The fragment is unreachable by construction,
         * so a failing assertion here would be permanent and would say nothing
         * about the code. It is printed when it goes missing so the fact stays
         * visible to whoever reads this gate next, rather than being a comment
         * nobody meets.
         */
```

### scripts/check-browser.mjs:4450 (CONTRACT, shortened)

intent kept; retired-shortcut history moved.

```js
/*
     * THE PALETTE. Clicking the trigger must open it, which also proves the
     * hint's honesty contract: the hint is server-rendered `hidden` and
     * unhidden only once the listener exists. This said `"/" must open it`
     * until 2026-09-14; the bare slash was retired in the Part A review and the
     * gesture below is the click every reader has.
     */
```

### scripts/check-browser.mjs:4457 (WHY, shortened)

trap kept; date moved.

```js
// The element must EXIST and be unhidden: a missing hint would make a
    // bare `!hidden` read true and pass on markup that lost the hint.
    //
    // SINCE 2026-08-29 THE HINT IS NOT PAINTED, so this asserts the two
    // surfaces that replaced the badge rather than a visible box: the
    // description is unhidden AND the anchor's `aria-describedby` resolves to
    // it, and the control carries the tooltip. Unhiding alone would pass on a
    // description nothing points at, which is a hint no screen reader reads.
```

### scripts/check-browser.mjs:4473 (WHY, shortened)

mechanism kept; retired-key history moved.

```js
/*
         * THE LIVE CHORD, NOT THE RETIRED ONE. This asked for "/" in the title
         * until 2026-09-14, which was correct when the bare slash was the
         * shortcut and became an assertion about a key bound to nothing the day
         * it was retired. Re-pointed, not relaxed: the title must still NAME
         * the key, and naming the wrong key still fails. `-K` rather than the
         * whole chord because the modifier is spelled Command on a Mac and
         * Control everywhere else, and the gate must not pin a platform.
         */
```

### scripts/check-browser.mjs:4484 (WHY, shortened)

prohibition and hard rule citation kept; six-week story moved.

```js
/*
         * THE ANNOUNCED TEXT MUST NAME THE SAME KEY. Length alone passed on
         * "Press slash to search" for the whole six weeks the slash was gone,
         * which is a description that is present, associated, announced and
         * wrong: the exact shape hard rule 10 calls an unfailable condition.
         */
```

### scripts/check-browser.mjs:4513 (WHY, shortened)

mechanism kept; before-and-after story moved.

```js
/*
     * THE BUNDLE IS NOT ON THE PAGE UNTIL SOMEBODY ASKS FOR IT, since
     * 2026-08-27, and this is the assertion that says so on the wire.
     *
     * The palette is the largest bundle on the public plane and it answers one
     * gesture, so it used to be a script tag on every document: every reader
     * downloaded and parsed a search dialog, and almost none of them opened
     * it. `theme.ts` now holds the gestures and appends a script element for
     * the palette on the first one.
     *
     * Counted from the RESOURCE TIMELINE rather than from the DOM. A missing
     * script tag proves nothing about what was fetched, and a fetch is the
     * thing rule 4 grades. The name is matched loosely because the asset
     * carries a content hash the gate must not restate.
     */
```

### scripts/check-browser.mjs:4544 (WHY, shortened)

trimmed; ruling history moved.

```js
/*
     * CLICKED, NOT TYPED. This pressed "/" until 2026-09-13, when the bare
     * slash was ruled out: it collides with find-in-page and was borrowed from
     * application UIs. Cmd/Ctrl-K survives, but the CLICK is the gesture every
     * reader has, so it is the one the gate drives.
     */
```

### scripts/check-browser.mjs:4555 (WHY, shortened)

trimmed.

```js
/*
     * POLLED, NOT SLEPT. Opening now costs a network round trip for the
     * bundle, so a fixed wait is a race that would pass on this machine and
     * fail on a slower one. Bounded at 5s, which is far longer than a
     * localhost fetch and far shorter than the gate's patience.
     */
```

### scripts/check-browser.mjs:4587 (WHY, shortened)

mechanism kept.

```js
/*
     * THE DIALOG ARRIVES STYLED, which is the half that on-demand CSS can lose.
     *
     * `palette-dialog.css` and `ask.css` are no longer on any page: theme.ts
     * appends them beside the bundle and waits for all three before opening, so
     * that a reader never sees an unstyled modal. Nothing offline can see
     * whether that wait works, and the open assertion above passes either way,
     * since an unstyled `<dialog open>` is still open.
     *
     * Asserted against a token-derived value rather than a literal: the border
     * colour resolves from `--border`, so this is red if the sheet is missing
     * and red if it arrived after the dialog was already on screen.
     */
```

### scripts/check-browser.mjs:4600 (WHY, shortened)

intent kept; 2026-09-13 incident moved.

```js
/*
     * THE QUERY SURVIVES THE GESTURE, and this is the case the whole gate was
     * missing.
     *
     * MEASURED 2026-09-13: build 2 put `data-search-trigger` on a FORM'S SUBMIT
     * BUTTON. `theme.ts` calls preventDefault on that element, which cancels the
     * submission, so with script on the typed query was discarded and the
     * no-bundle fallback navigated to /search with no `q` at all. Every offline
     * gate passed, because the control only worked with script OFF and nothing
     * offline runs script.
     *
     * So the assertion is not 'a search UI appeared'. It is: type a real query,
     * submit it the way a reader would, and prove the URL that results CARRIES
     * THAT QUERY. A control that navigates to a bare /search fails here, which
     * is exactly what shipped.
     */
```

### scripts/check-browser.mjs:4618 (WHY, shortened)

trap kept; incident moved.

```js
/*
       * TYPED THROUGH A HANDLE, not page.type, for the reason clickOrFail
       * exists. MEASURED 2026-09-14 on the first deployed run of this case:
       * page.type asserts internally and THREW on a missing .palette-input,
       * which ended the run and voided every case after it. The click path had
       * already been made soft and this one had not, so the same defect reached
       * the same run twice in one sitting.
       */
```

### scripts/check-browser.mjs:4710 (WHY, shortened)

unasserted cold-query measurement moved.

```js
// Debounce is 140ms and the first D1 query on a cold preview has been
      // measured at 360ms; poll rather than sleep, bounded at 5s.
```

### scripts/check-browser.mjs:4732 (WHY, shortened)

both halves and the raw-comparison trap kept; narration cut.

```js
/*
   * THE IMAGE LINK, both states, because this enhancement has two halves that
   * fail in opposite directions and no source-reading gate can see either.
   *
   * WITHOUT SCRIPT the image's parent must be an anchor, and its href must
   * actually SERVE an image. An href is a string; a 200 with an image
   * content-type is the only thing that distinguishes a working fallback from
   * a plausible one, and the defect this replays produced a URL that was
   * merely well formed.
   *
   * WITH SCRIPT the overlay must show THE ANCHOR'S HREF. That comparison is
   * the whole case: the bug it replays opened `currentSrc`, the rung of the
   * srcset ladder already downloaded, which renders an overlay that looks
   * completely correct while showing the resized copy. Nothing but comparing
   * the two URLs can tell those apart.
   *
   * COMPARED RAW, attribute against attribute, deliberately not as resolved
   * URLs. `currentSrc` is always ABSOLUTE, so the raw form discriminates on
   * any image; a resolved comparison only discriminates on an image that
   * carries a `srcset`, and whether the post that gets found has one is a
   * content accident. The correct implementation assigns the href verbatim,
   * so this asserts exactly that and nothing weaker.
   *
   * The scriptless half runs on its own page with JavaScript disabled rather
   * than on a DOM the bundle has already touched, so "the markup carries the
   * anchor" is a claim about what the SERVER sent.
   */
```

### scripts/check-browser.mjs:4760 (WHY, shortened)

mechanism and boundary kept; crawl history moved.

```js
/*
     * THE SUBJECT COMES FROM THE ARTIFACT, not from crawling the listing.
     *
     * It was a crawl of the same capped `postPaths` the code case uses, and
     * that was wrong in the way this repo keeps paying for: with a planted
     * image in an OLDER post the case skipped, and its skip said "the corpus
     * carries no body image at all" on the strength of a SIX-POST SAMPLE. A
     * silent cap that reads as full coverage is the exact shape FAILURES.md
     * names, and here it was writing the false claim into its own reason.
     *
     * The artifact knows which posts carry the anchor, over the whole corpus
     * and with no crawl, so the skip below is now a measurement rather than an
     * inference. BOUNDARY: it is the artifact on THIS DISK. Driving a deployed
     * origin (PUBLIC_ORIGIN) can therefore name a post the deployment has not
     * got, which is why a named candidate that does not show the anchor in the
     * browser SKIPS naming the discrepancy instead of failing.
     */
```

### scripts/check-browser.mjs:4798 (WHY, shortened)

dated content measurement moved.

```js
/*
       * MEASURED 2026-08-26 against content/posts/: ZERO body images across the
       * 12 posts, by every form the pipeline recognises (`:::figure`, a
       * markdown image, a `/media/` citation, a raw `<img>`). The 2026-08-11
       * record of "6 images across 12 posts" is stale in the numerator: the
       * charts post's figure was removed. So this is a CONTENT fact and not a
       * defect, exactly like the no-code-post skip above, and it is loud
       * because a silent pass here would be indistinguishable from a working
       * anchor.
       */
```

### scripts/check-browser.mjs:4878 (WHY, shortened)

mechanism kept; before-state history moved.

```js
/*
       * IT IS A REAL MODAL DIALOG, since 2026-08-28.
       *
       * It was a `div` with `tabIndex = -1`: no role, no `aria-modal`, no
       * focus trap, no `inert` on the page behind it and no close button.
       * Escape worked only while focus happened to be inside it, and a screen
       * reader was never told a dialog had opened.
       *
       * ASSERTED THROUGH THE PLATFORM'S OWN PROPERTIES, not through attributes
       * the code could set on a div. `matches("dialog:modal")` is true only
       * for an element opened with `showModal()`, so a hand-rolled overlay
       * carrying `role="dialog"` and `aria-modal="true"` fails this while
       * satisfying any attribute check. That distinction is the whole point:
       * the attributes are a claim and modality is a behaviour.
       */
```

### scripts/check-browser.mjs:4964 (CONTRACT, shortened)

trimmed.

```js
/*
   * THE SCRIPT SET, per page: only enhancement bundles, no framework, no
   * modulepreload. This is the wire half of check:page-payload's claim, on
   * the artifact this gate drives; verify-live section 16 makes the same
   * assertion against the deployed origin.
   */
```

### scripts/check-browser.mjs:5002 (CONTRACT, shortened)

section header, capitals dropped.

```js
/* ------------------------------- 6. THE ADMIN PLANE, opt-in, DEPLOYED ONLY */
```

### scripts/check-browser.mjs:5004 (WHY, shortened)

scope warning kept; outage story moved.

```js
/*
   * The class no gate in this repo had ever seen: markup that renders and a
   * component that never MOUNTS. The editor's lazily imported CodeMirror sat
   * behind a Suspense boundary that the enforced CSP broke, and it was down for
   * two days with all twenty-seven gates green, because every one of them reads
   * source or stub-rendered markup.
   *
   * Widened 2026-08-21 from one editor case to the whole plane, because the
   * first session to render the admin with an instrument found two defects on
   * surfaces nobody had ever laid out, and roughly 5,500 lines of the split CSS
   * are admin with no assertion touching any of it.
   *
   * READ THE BANNER. These cases observe ADMIN_ORIGIN, a deployed Worker. Every
   * other case in this file observes the preview build of the working tree.
   */
```

### scripts/check-browser.mjs:5019 (CONTRACT, shortened)

three states kept; narration cut.

```js
/*
   * THREE STATES, AND ONLY THE FIRST IS A SKIP.
   *
   * ABSENT means nobody asked for these cases, so the gate says loudly what it
   * did not cover and moves on. That is the one honest skip here.
   *
   * SUPPLIED BUT NOT USABLE is a FAILURE, every variety of it. A session file
   * on disk is a request for the admin cases, and the operator who wrote it is
   * entitled to be told they did not happen. Skipping instead would be the
   * silent-skip failure wearing the shape of a precondition, and it is what made
   * an expired session read like a broken test.
   *
   * The varieties are told apart because they need DIFFERENT REPAIRS, and a
   * message that cannot tell them apart sends the reader to the wrong one:
   *
   *   malformed  the file exists and its cookie cannot be used. Fix the FORMAT.
   *   no origin  a session was supplied and there is nowhere to send it.
   *   rejected   the format is right and the server said no. REFILL the file.
   *
   * "Rejected" is overwhelmingly an EXPIRED session, so the message leads with
   * that and names the file that explains the refill rather than describing the
   * clicks here, where they would rot next to a second copy of themselves.
   */
```

### scripts/check-browser.mjs:5043 (HISTORY, deleted)

vol 15 story and floor history; the ok() message states the refusal.

```js
/*
     * A FAILURE, NOT A SKIP, since 2026-09-06 (vol 15).
     *
     * This was `skip`, which counts nothing, and the floor then dropped from 236
     * to 172 to accommodate it. So a machine with no credential ran a quarter of
     * this gate and printed a green result, and the smaller floor made that
     * green look measured. The gate's whole admin half was optional in a way
     * nothing announced.
     *
     * The gate now refuses. Everything it could not observe is named below, and
     * the remedy is two commands rather than a mystery, so failing costs a
     * reader nothing they were not going to have to do anyway.
     */
```

### scripts/check-browser.mjs:5111 (WHY, shortened)

trimmed.

```js
/*
     * THE PATH SELECTION IS STATED, BOTH WAYS, and it is the line a reader needs
     * most: these cases now have two completely different principals available,
     * and which one ran decides what the result MEANS. The smoke credential is
     * read-only, so a green run under it says nothing about any write surface;
     * the cookie is Dustin, so a green run under it says nothing about whether
     * CI could have produced it.
     */
```

### scripts/check-browser.mjs:5148 (WHY, shortened)

trimmed.

```js
/*
     * The SHELL is the assertion, not the page title, because a title is set by
     * the route module and survives a body that rendered nothing. The sidebar
     * and the topbar are the two elements every admin route inherits from the
     * layout, so their absence means the layout itself failed.
     *
     * The login page is named explicitly in the failure. A bounced session
     * renders a complete, correct, fully styled page, and without this the
     * failure would read as "the sidebar is missing" on a page that never had
     * one.
     */
```

### scripts/check-browser.mjs:5166 (WHY, shortened)

scope reason kept; ruling 21 date moved.

```js
/*
       * ADDED 2026-09-05 with ruling 21's redesign, and what it asserts is
       * deliberately NOT the redesign.
       *
       * These cases observe ADMIN_ORIGIN, a DEPLOYED Worker, so an assertion
       * written against the new markup would be red from the moment it is
       * committed until the moment it ships, and green for the wrong reason in
       * between. The page's STRUCTURE is check:admin-ui's, which renders the
       * working tree: filter chips, counts, the box a message lands in, the
       * three button weights. What only a browser can say is that the route
       * renders inside the shell at all and that it does not overflow, and that
       * is what this and the width loop below take.
       */
```

### scripts/check-browser.mjs:5200 (WHY, shortened)

mechanism kept; split history moved.

```js
/*
     * app.css split into sixteen files on 2026-08-21 and the only evidence the
     * admin half survived was that the BUILT stylesheet was byte-identical.
     * That is a real check and it cannot see this: the mark's base fill lives in
     * app.css and its header override in styles/public-chrome.css, so the two
     * are separated by a file boundary and by the @import order that decides
     * which one wins.
     *
     * Asserted as RESOLVED COLOUR from getComputedStyle, compared against the
     * TOKEN read off the same document, never against a literal hex. A hex here
     * would be a second statement of a value the palette owns, and it would go
     * red the day the brand is deliberately re-toned.
     *
     * Both halves, on the two planes where each is supposed to win: the admin
     * sidebar mark takes the (0,1,0) base rule, the public header mark takes the
     * (0,2,0) override. Asserting only one would pass with the override deleted.
     */
```

### scripts/check-browser.mjs:5269 (CONTRACT, shortened)

section header, capitals dropped.

```js
/* ----------------------------------------- 6c. THE MOUNT CLASS */
```

### scripts/check-browser.mjs:5301 (CONTRACT, shortened)

section header; history word cut.

```js
/* ------------- 6d. THE MEDIA INTERACTIONS, previously Dustin's clicks --- */
```

### scripts/check-browser.mjs:5303 (WHY, shortened)

read-only prohibition kept; split story moved.

```js
/*
     * FOUR INTERACTIONS ON /admin/media, ASSERTED, and they used to be a list
     * of things for Dustin to click after every media change.
     *
     * ## WHAT THEY ARE, AND WHY EXACTLY THESE
     *
     * The media route split moved 1,699 lines of markup between files, and
     * `check:admin-ui` proved every number identical across the move. That gate
     * renders routes with `.server` imports stubbed AND NO STYLESHEET, so what
     * it cannot see is precisely what these cover: a header that renders but
     * sorts nothing, an inspector that never opens, a bulk bar that appears
     * with the wrong arithmetic in it, and a confirmation ladder that is
     * enforced on the server and silently ungated in the browser.
     *
     * ## THE READ-ONLY BOUNDARY IS VISIBLE HERE AND IT IS NOT A LIMITATION
     *
     * Every case below is a GET or a click on client state. NOTHING SUBMITS.
     * Under the smoke credential a submission would be refused by the
     * middleware anyway, but these are written not to submit under EITHER
     * credential, because the cookie path runs as Dustin and a gate that
     * trashes a file to prove the trash button works is not a gate anybody can
     * afford to run.
     *
     * That boundary is why two of the destructive confirmations are NOT here:
     * see the remaining-human list at the end of this file.
     */
```

### scripts/check-browser.mjs:5333 (WHY, shortened)

trimmed.

```js
/*
     * SORTED BY SIZE, chosen because it is not the default: a header that
     * hardcoded its active column would pass on `sort=name` and fail here.
     * The active column is read back from the DOM and compared against the sort
     * this URL ASKED for, so the assertion cannot be satisfied by whichever
     * column happens to be marked.
     */
```

### scripts/check-browser.mjs:5374 (WHY, shortened)

trap kept; wrong-first-draft story moved.

```js
/*
     * EVERY SORTABLE CELL IS AN ANCHOR, which is the property. NOT "every href
     * carries sort=", which is what this asserted first and which was WRONG.
     *
     * Measured: 4 anchors, 3 carrying `sort=`. The missing one is Added, and it
     * is missing correctly. `hrefWith` omits any parameter equal to its default
     * and `DEFAULTS.sort` is `added`, so the link to the default sort is a
     * shorter URL by design rather than a link that has lost its sort. The
     * first assertion could not tell those apart and reported a defect in code
     * that was behaving exactly as its own URL builder is written to.
     *
     * What actually has to hold is that sorting has an ADDRESS: an anchor with
     * an href, so it is shareable, restored by the back button and usable with
     * scripting off, which a click handler on a cell is none of.
     */
```

### scripts/check-browser.mjs:5402 (WHY, shortened)

trimmed.

```js
/*
     * AND EXACTLY ONE COLUMN ANNOUNCES ITSELF SORTED, to assistive technology.
     * `aria-sort="none"` on the others is not noise: it is what tells a screen
     * reader the column CAN be sorted and currently is not. Two columns claiming
     * to be sorted, or none, are both wrong and both render identically.
     */
```

### scripts/check-browser.mjs:5424 (WHY, shortened)

trimmed.

```js
/*
     * THE KEY COMES OFF THE PAGE, never from a fixture. A hardcoded key would be
     * a second copy of a content hash that the bucket owns, and it would go red
     * the day that object is deleted rather than the day the inspector breaks.
     */
```

### scripts/check-browser.mjs:5485 (WHY, shortened)

trimmed.

```js
/*
     * A CLICK, and the only case here that is not a navigation.
     *
     * Selection is the one piece of client state this page has, so the bulk bar
     * cannot be reached by a URL and `check:admin-ui` reaches it only through a
     * seeded fixture. This is the live version of that fixture: a real click, on
     * a real hydrated page, with the arithmetic read back out.
     *
     * The SIZE is the half worth asserting. A count is hard to get wrong; the
     * size sums a field over the selected subset, and a sum over the wrong
     * subset still renders a plausible number.
     */
```

### scripts/check-browser.mjs:5566 (WHY, shortened)

prohibition and mechanism kept; sub-headings cut.

```js
/*
     * THE EMPTY-TRASH LADDER, which is the ONE destructive confirmation a
     * read-only credential can reach.
     *
     * It opens from a URL (`?confirm=empty-trash`), so it is server-rendered and
     * a GET reaches it. The other two confirmations in this route open from
     * `actionData`, which means reaching them requires the POST the smoke
     * credential is refused: they are unreachable BY CONSTRUCTION, not by any
     * limit of the harness, and they are on the remaining-human list with that
     * reason.
     *
     * ## THE REQUIRED STRING IS READ OFF THE PAGE
     *
     * The modal states what to type, and this reads it from there rather than
     * computing a trash count independently. A gate that derived the expected
     * count itself would be asserting its own arithmetic against the page's, and
     * when they disagreed it could not say which was wrong.
     *
     * ## IT NEVER SUBMITS
     *
     * The button's ENABLED state is the assertion. Pressing it would empty the
     * trash, and the ladder exists precisely because that is not undoable.
     *
     * ## CONDITIONAL, AND THE CONDITION IS REPORTED
     *
     * The modal renders only when the trash is non-empty (`trashedCount > 0`),
     * so on a deployment with an empty bin there is genuinely nothing to
     * measure. That is a SKIP with the reason, never a silent pass: an
     * assertion that quietly examines nothing reports what a working ladder
     * reports.
     */
```

### scripts/check-browser.mjs:5690 (WHY, shortened)

sampling reason kept; measurements and repair narrative moved.

```js
/*
     * THE SAME WIDTH THE PUBLIC PAGES ARE GATED AT, and it had never been
     * applied to this plane. Case 4 above drives every public page at 320 and
     * has since the `.site-header-nav` defect; the admin shell was exempt for
     * no reason beyond needing a session, so it was never measured and it was
     * broken.
     *
     * MEASURED BEFORE THE REPAIR: 23px of overflow at 553, 96 at 480, 176 at
     * 400, 256 at 320. Those four are one number. 553 + 23, 480 + 96,
     * 400 + 176 and 320 + 256 are 576 every time, because `.admin-topbar-user`
     * had a min-content floor it could not shrink past (the operator's email is
     * one unbreakable token, 199px, in a 343px block once the drawer toggle
     * appears) and the document simply grew to meet it.
     *
     * **THE TOPBAR WAS ONE FLOOR AND NOT THE ONLY ONE. THIS ASSERTION IS STILL
     * RED WITH THE TOPBAR REPAIR APPLIED, and the number it reports is the
     * correction to a claim made when the repair landed.**
     *
     * That claim was "0 overflow at 320, 400, 480 and 553", and it was measured
     * by constraining `.admin-topbar` directly and reading its children back. It
     * was true about the topbar and false about the document, which is the
     * instrument seeing only what it was threaded through: the topbar was
     * constrained, so the topbar was what got measured.
     *
     * MEASURED PROPERLY on the deployed page with HEAD's stylesheet swapped into
     * the response and PROVEN in the cascade first: the document floor moves
     * 576 to 542, not below 320. 553 goes green. 480, 400 and 320 stay red at
     * 62, 142 and 222.
     *
     * The chain, at 320: two `.stat-card`s at 234 each hold `.card-grid` at 480,
     * which holds `.panel` at 480 and `.admin-content` at 528 once its padding
     * is added. `.admin-content` sizes the grid track, the track stretches
     * `.admin-topbar` to 528, and `.admin-signout` (correctly refusing to shrink)
     * ends up 14px past that at 542. So the remaining floor is the COCKPIT
     * CONTENT, not the bar, and the bar's own repair did what it claimed: its
     * min-content is no longer the binding constraint.
     *
     * ## RE-READ 2026-08-24 ON A PAGE PROVEN STYLED, AND THE PARAGRAPH ABOVE
     * ## IS A PREDICTION THAT DID NOT HOLD
     *
     * The two assertions above this loop now prove `admin.css` is applied where
     * these numbers are taken, which is what the re-read was for. All EIGHT
     * failures survive, so they were never the artefact of an unstyled page
     * that the public stylesheet assertion's unrelated red made them look like.
     *
     * What did NOT survive is the prediction. Measured against the deployed
     * build, the document floor is **582**, uniform across all four widths:
     *
     *   553 -> 29px over    480 -> 102px over
     *   400 -> 182px over   320 -> 262px over
     *
     * Three specifics differ from what was written above, and each matters to
     * whoever fixes this:
     *
     *   1. **553 did not go green.** It is 29px over, not 0.
     *   2. **The floor is 582, higher than both 576 and the predicted 542.**
     *   3. **The binding chain is the TOPBAR again**, not the cockpit content:
     *      `header.admin-topbar@582` over `div.admin-topbar-user@558`,
     *      `form@558`, `button.admin-signout@558`. No `.stat-card` or
     *      `.card-grid` appears in the widest set at any width; at 400 and 320
     *      the third widest is `span.muted@446`.
     *
     * The earlier reading was taken by swapping a stylesheet into a response
     * rather than by observing the built page, which is the simulated-element
     * class: a probe that is not the element measures the probe. The numbers
     * here come from the deployed build through the same harness that reports
     * them.
     *
     * NOTHING ABOUT THE LAYOUT IS CHANGED HERE. The fix is Dustin's design
     * call, and it now rests on readings whose scope is asserted.
     *
     * This assertion stays exactly as it is. Narrowing it to pass on the half
     * that is fixed would be tuning the assertion to the defect.
     *
     * FOUR WIDTHS, NOT ONE, and that is the point of the arithmetic above. A
     * single assertion at 320 would pass the moment the floor dropped to 320,
     * while 553 still scrolled. The failure was linear in the viewport, so the
     * gate has to sample the line rather than its worst point. 553 is included
     * precisely because it is the shallowest of the four and the first to go
     * green under a partial fix.
     *
     * 1280 is asserted too. Everything here shrinks and truncates, and a fix
     * built out of `min-width: 0` can easily buy the narrow case by collapsing
     * something that was fine at desktop width.
     *
     * The offending element is NAMED, exactly as case 4 names it.
     */
```

### scripts/check-browser.mjs:5777 (WHY, shortened)

scope reason kept; dated re-read moved.

```js
/*
     * THE ADMIN PLANE'S OWN STYLESHEET CHECK, added 2026-08-24.
     *
     * The public check near the top of this file runs on `/blog` and says
     * nothing about these pages: since the CSS split, `/admin/*` loads a SECOND
     * sheet, `app/admin.css`, linked only by `routes/admin.tsx`. Every number
     * the overflow loop below reads is a layout measurement, and a layout
     * measurement on a page missing its stylesheet is a measurement of the
     * browser's defaults. The scope check belongs where the measurement is
     * taken, and it was not here.
     *
     * That gap had a cost. With the public assertion red for an unrelated
     * reason, the eight overflow failures were recorded as INCONCLUSIVE, and
     * the design decision resting on them was parked waiting for a styled
     * re-read. MEASURED 2026-08-24: the admin pages were styled the whole time,
     * 965 rules against the public plane's 351, with `.admin-sidebar`
     * resolving to `display: flex` at 240px. The readings were sound and the
     * instrument that would have said so did not exist.
     *
     * ASSERTED THREE WAYS, because a rule count alone is the weakest of them.
     * A count proves bytes arrived; the computed style proves the cascade
     * applied them to the element the overflow loop is about to measure.
     */
```

### scripts/check-browser.mjs:5842 (NUMBER, shortened)

widths appear in the list below; dates moved.

```js
/*
     * 582 AND 375 ADDED 2026-08-26, and each earns its place.
     *
     * 582 is the MEASURED FLOOR itself, the widest width that scrolled before
     * the fold landed. Every other narrow width in this list is comfortably
     * inside the folded branch; none of them sits on the boundary, and a
     * breakpoint that drifted from 640 down past 582 would go unnoticed by all
     * four. 375 is the common phone width the four skip between 400 and 320.
     */
```

### scripts/check-browser.mjs:5857 (WHY, shortened)

trimmed; ruling reference moved.

```js
/* The mentions queue joined this loop with ruling 21, because the
           redesign puts a row of chips, a quoted excerpt and three buttons on
           one line and every one of those is a thing that pushes past a narrow
           viewport. 375 is the width that matters here and it is already in the
           list. */
```

### scripts/check-browser.mjs:5892 (WHY, shortened)

trimmed.

```js
/*
     * AND THE BAR ITSELF FITS, which is a different claim from the document not
     * scrolling.
     *
     * `.admin-topbar` could stay inside the viewport while its own children
     * overflowed it, if something above it ever gained `overflow: hidden`. Then
     * the document would not scroll, this section's assertions would all pass,
     * and the email and Sign out would simply be clipped off the right edge
     * with nothing reporting it. Asserted at the narrowest width only, because
     * that is where it would happen.
     */
```

### scripts/check-browser.mjs:5937 (WHY, shortened)

three mechanisms kept; found-defect story moved.

```js
/*
     * THE FOLD KEEPS EVERY ACTION, which is the half none of the assertions
     * above can see.
     *
     * Everything before this measures WIDTH. A fold that simply deleted the
     * email and Sign out below the breakpoint would satisfy every one of them:
     * nothing overflows if nothing is there. That is not a hypothetical repair,
     * it is the cheapest one, and it is why the ruling asked for the items to
     * be the same controls rather than a reduced set.
     *
     * SUBSET, NOT EQUAL COUNT, and the reason is that the two widths are not
     * supposed to offer the same things. Narrow legitimately has MORE: the
     * drawer toggle appears, and the Account disclosure exists only when the
     * bar has folded. What must never happen is narrow having FEWER. So the
     * claim is that every action the wide bar offers is still reachable once
     * the disclosure is open, and the failure names the ones that went missing.
     *
     * BY ACCESSIBLE NAME rather than by count, because a count can be held
     * steady by a swap: lose Sign out, gain something else, and the arithmetic
     * agrees while the fold has eaten the one control that matters.
     *
     * The name is APPROXIMATED, `aria-label` then text content, and that is
     * stated because it is not the full accname algorithm: no `aria-labelledby`
     * chase, no `title` fallback, no alt on an image child. It was enough to
     * find a real one on its first run. The folded Sign out was named
     * "Sign outEnds this session. You will need to sign in again with Google.",
     * because the hint span is a CHILD of the button and name-from-content
     * takes descendants. Fixed at the component with an explicit label and a
     * description, so the two variants are now the same control by name as well
     * as by markup.
     *
     * OPENED THROUGH THE `open` PROPERTY, which is what a click on a
     * `<summary>` does with no script running at all. Driving it with a
     * synthetic click would test the enhancement's listeners instead of the
     * markup, and the markup is what rule 9 is about here.
     */
```

### scripts/check-browser.mjs:6055 (WHY, shortened)

floor purpose kept; measurements moved.

```js
/*
 * EXECUTED-COUNT FLOOR, one per MODE.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, 2026-08-21: **15**
 * with the admin cases skipped and **31** with them running. Never summed.
 * Floored at 13 and 29, slack of two either way.
 *
 * **THE PREVIOUS RECORDED FIGURE, 16, WAS WRONG BY ONE**, and it had been in
 * this comment since the gate was written. Counted by hand from the eight
 * non-admin `ok()` sites: one stylesheet, one three-element presence, one
 * alignment, four skip links, one post-link presence, one aria-current, five
 * overflow paths, one login skip link. That is 15, and running it says 15. The
 * old floor of 14 still passed, so the stale number never failed anything,
 * which is exactly why it survived: a recorded count nothing re-measures is a
 * claim, not a property.
 *
 * ONE FLOOR WOULD NOT DO. A single value low enough for the skip mode would let
 * the admin block collapse from sixteen assertions to nothing in the run mode
 * and still clear the bar, which is the failure this floor exists to catch.
 *
 * A gate that drives a browser has more ways to examine nothing than most: a
 * page that 404s, a selector that stopped matching after a class rename, and a
 * server that came up but served an error page all produce assertions that
 * never run rather than assertions that fail.
 */
```

### scripts/check-browser.mjs:6080 (HISTORY, deleted)

dated re-measurement log; floors are asserted in code below.

```js
/*
 * **BOTH FLOORS ARE NOW MEASURED THROUGH THIS GATE'S OWN PIPELINE, by RUNNING
 * it. 15 with the admin cases skipped, 43 with them running.** Never summed.
 * Floored at 13 and 41, slack of two either way.
 *
 * The run-mode figure was DERIVED until 2026-08-22 and said so, because the
 * admin cases need a session and no session had ever been present. It was
 * 29 + 12 counted from the source, and the count that replaced it is 43, so the
 * derivation happened to be right and the floor does not move. **That is the
 * least interesting possible outcome and it is still worth the run**: a summed
 * floor that agrees with the measurement is indistinguishable, before the
 * measurement, from one that does not. The previous figure in this file was
 * wrong by one for years, and the comment above says why nothing noticed.
 *
 * The cross-check that makes 43 credible rather than merely observed: the
 * recorded pre-overflow measurement was 31, twelve assertions were added, and
 * the run reports 43.
 *
 * RE-MEASURED 2026-08-24 by running it: **45** with the admin cases, after the
 * two admin-stylesheet assertions landed beside the overflow loop. The same
 * cross-check holds, 43 plus two. The floor stays at 41, which is about nine
 * percent under and inside the margin this repo uses; it is not raised on every
 * pair of assertions, only when the gap stops meaning anything.
 *
 * ## RE-MEASURED AGAIN 2026-08-24 WITH THE FOUR MEDIA INTERACTIONS: **59**
 *
 * Run through this gate's own pipeline, never summed. Floored at 54, about
 * eight percent under. 45 to 59 is fourteen assertions and the gap at 41 had
 * stopped meaning anything, which is the condition the paragraph above names
 * for raising it.
 *
 * **59 IS THE FLOOR OF THE RANGE, NOT THE MIDDLE OF IT, and that is why the
 * floor is not higher.** The empty-trash ladder is gated on the deployment
 * actually having something in its trash, so it contributes 0 assertions on a
 * clean bin and 5 on a dirty one. The measured 59 is the 0 case. A floor set
 * against a run that happened to catch a full trash would go red on the next
 * clean one and report a collapsed block where nothing had collapsed.
 *
 * The cross-check that makes 59 credible rather than merely observed: 45 was
 * the last measurement, the media block adds three list-header assertions, four
 * inspector, six bulk-bar and one skip, and 45 + 14 is 59.
 *
 * ## RE-MEASURED 2026-08-26 WITH THE PUBLIC ENHANCEMENT CASES: **71**
 *
 * Run through this gate's own pipeline after the public plane stopped
 * hydrating. The unhydration block (5b) adds twelve assertions in both modes:
 * one listing scope, one code-copy, one progress bar, one theme flip, one
 * hint, one palette open, one palette results, one Ask affordance, three
 * script-set pages, one console-error sweep. 59 + 12 is 71 in run mode, and
 * the skip mode moves from 15 to 27 by the same twelve. Floors 65 and 25,
 * about eight percent under, raised because the old gaps stopped meaning
 * anything. The code-copy case can skip on a corpus with no code post, which
 * is why the slack is not smaller.
 *
 * ## RE-MEASURED 2026-08-26 WITH THE TOPBAR FOLD CASES: **78** in run mode
 *
 * Run through this gate's own pipeline against the deployment that carries
 * them. The cross-check: 71 was the last measurement, the fold work adds two
 * overflow widths across two admin paths, which is four, plus three topbar
 * action assertions, and 71 + 7 is 78. Floored at 72, about eight percent
 * under.
 *
 * SKIP MODE IS UNCHANGED at 27, floor 25, because every assertion added here
 * is inside the admin block that skip mode does not reach. A floor that moved
 * in both modes on an admin-only change would be wrong in the mode that never
 * saw it.
 *
 * **THE RUN-MODE FLOOR WAS NOT MOVED IN THE COMMIT THAT ADDED THE SEVEN**, and
 * that is the second time in one day the same convention was missed here and in
 * check-tests.mjs. Both were caught by re-measuring rather than by anything
 * automatic. A floor is the one value in a gate that nothing else can check.
 *
 * ## RE-MEASURED 2026-08-26 WITH THE HOME HEALTH-TILE CASE: **84 to 83**
 *
 * Run through this gate's own pipeline, same two skips as the 78 measurement
 * (no body image in the corpus, empty trash on the deployment). The case adds
 * six assertions: the endpoint answered, the tile is present, its age parses,
 * its age is inside one poll interval, the age got NEWER across the call, and
 * the value is a ratio. 78 + 6 is 84, measured.
 *
 * **IT IS A RANGE, AND 83 IS THE FLOOR OF IT**, on exactly the reasoning the
 * empty-trash entry above records. The differential is skipped when the first
 * read finds no verdict at all, which is what a genuinely empty KV gives on a
 * first-ever run, so that run scores 83. A floor set against the 84 would go
 * red on the next fresh state and report a collapsed block where nothing had
 * collapsed. Floored at 76, about eight percent under 83.
 *
 * **THE CROSS-CHECK, because the first run of this case was RED and the
 * arithmetic is what explains both numbers.** That run reported 82 checks and
 * 1 failure: the case navigated to `/` and did not navigate back, so the
 * column comparisons below it measured the HOME document, found no
 * `.blog-search` and no `.page-head`, and their guarded assertion never ran.
 * 82 plus that one guarded assertion is 83. A count that moved by four when
 * five assertions were added was the signal, not the failure line.
 *
 * **BOTH MODES MOVE THIS TIME**, which is the opposite of the topbar entry
 * above and for the stated reason: this case is in the PUBLIC block, which
 * skip mode reaches in full. Skip mode is 27 + 6 = 33, or 32 when the
 * differential skips; floor 25 to 29. Derived rather than run, on the same
 * basis the 15-to-27 step above was derived: the public block executes
 * identically in both modes and nothing in this case touches a credential.
 *
 * ## RE-MEASURED 2026-08-26 WITH THE BYTE-IDENTITY PRECONDITION: **109 to 108**
 *
 * Run through this gate's own pipeline, same two skips. The case adds one list
 * binding plus three assertions on each of the eight public HTML routes that
 * declare the shared cache headers: a credentialed reader gets identical
 * bytes, the theme changes the bytes at all, and the theme changes ONLY the
 * enumerated diff. 84 + 25 is 109, measured, and 108 when the health
 * differential skips on an empty KV.
 *
 * Both modes again, and for the same reason: the case is in the public block.
 * Skip mode is 33 + 25 = 58, or 57 with the same skip. Floors 76 to 99 and 29
 * to 52, about eight percent under the low end of each range.
 *
 * ## RE-MEASURED 2026-08-26 WITH THE THEMED CACHE CASE: **112 to 111**
 *
 * Three assertions, on one key reused across four requests rather than the
 * cache-busted fetches the byte comparisons use: the entry is stored and
 * served on the second read, a cookied reader never receives a public
 * cache-control on either a miss or a hit, and a light reader is not handed
 * the dark document. 109 + 3 is 112, measured, and 111 when the health
 * differential skips.
 *
 * Both modes, same reason again. Skip mode is 61, or 60 with that skip. Floors
 * 99 to 102 and 52 to 55, about eight percent under the low end of each range.
 *
 * ## RE-MEASURED 2026-08-27 WITH THE NEGOTIATED-REPRESENTATION CASE: **118 to 117**
 *
 * Six assertions, three on each of the two routes that serve a second
 * representation at one URL: the HTML entry is warm before the negotiated read
 * (the precondition, which is the assertion that keeps the other two from
 * being vacuous), the warm entry does not answer the negotiated request, and
 * the negotiated response is not itself served from the cache. 112 + 6 is 118,
 * measured, and 117 when the health differential skips.
 *
 * **THE COUNT IS ALSO THE EVIDENCE THAT THE CASE RAN.** The plant for it lives
 * in `workers/app.ts` rather than here, so the planted run scores the SAME 118
 * with four of them red; a case that had quietly examined nothing would have
 * scored 112 in both runs and gone green in both.
 *
 * Both modes, same reason again: the case is in the public block. Skip mode is
 * 67, or 66 with that skip. Floors 102 to 108 and 55 to 61, about eight percent
 * under the low end of each range.
 *
 * ## RE-MEASURED 2026-08-27 WITH THE LAZY PALETTE: **120 to 119**
 *
 * Two assertions, both on the resource timeline rather than the DOM, either
 * side of the "/" keystroke: the palette bundle is not fetched by a page nobody
 * searched on, and the gesture fetches it exactly once. 118 + 2 is 120,
 * measured, and 119 when the health differential skips.
 *
 * The palette-open assertion beside them changed from a fixed 250ms wait to a
 * bounded poll in the same commit, because opening now costs a network round
 * trip and a fixed wait is a race that passes on this machine and fails on a
 * slower one. It is still one assertion, so the count moves by two.
 *
 * Both modes, same reason again. Skip mode is 69, or 68 with that skip. Floors
 * 108 to 110 and 61 to 62, about eight percent under the low end of each range.
 *
 * ## RE-MEASURED 2026-08-27 WITH THE BLOG-BUNDLE SCOPE CASE: **122**
 *
 * Two more resource-timeline assertions, in opposite directions: the blog
 * reading bundle is not fetched by the listing, and it IS fetched by a post.
 * 120 + 2 is 122, measured.
 *
 * **THE RANGE GREW A SECOND GUARD and the floor is set against the low end of
 * both.** The positive assertion is inside `probedPost !== null`, which is a
 * CONTENT condition: a corpus with no posts skips it, the same way the health
 * differential skips on an empty KV. Two independent skips means the honest low
 * end is 120, not 121.
 *
 * **THE RUN-MODE FLOOR DOES NOT MOVE, and that is arithmetic rather than an
 * oversight.** Eight percent under 120 is 110.4, and the previous floor was
 * eight percent under 119, which is 109.5. Both round to 110. Recorded because
 * a floor that stays put while the count moves is exactly the shape this file
 * has twice caught as a MISSED update, and the way to tell the two apart is to
 * show the arithmetic. Skip mode is 71, low end 69, so that one moves: 62 to 63.
 *
 * ## RE-MEASURED 2026-08-27 WITH THE STYLED-DIALOG CASE: **123**
 *
 * One assertion: the palette dialog's computed border comes from the token
 * rather than from the browser default, by the time it is open. It exists
 * because the dialog's stylesheet is now fetched on the gesture beside its
 * bundle, and the open assertion next to it passes either way, since an
 * unstyled `<dialog open>` is still open. 122 + 1 is 123, measured.
 *
 * Public block, so both modes. Skip mode is 72, low end 70. Floors 110 to 111
 * and 63 to 64, about eight percent under the low end of each range.
 *
 * ## RE-MEASURED 2026-08-30 WITH THE PLAYGROUND WIRE CASES: **232 and 181**
 *
 * **THE NARRATION ABOVE HAD GONE STALE AND THE CONSTANT HAD NOT.** This chain
 * ends at 123 and the floors in code were 159 and 112, so somebody raised the
 * numbers and stopped writing down why. That is the mirror of the failure this
 * comment block keeps recording: usually the count moves and the floor does
 * not, and here the floor moved and the record did not. Both leave a number
 * nobody can check, which is the whole reason a floor gets a paragraph.
 *
 * **BOTH ENDS MEASURED BY RUNNING, INCLUDING THE BASELINE.** The pre-change
 * count was taken by putting HEAD's copy of this file on disk and running it:
 * 212, against 232 with the new block. Twenty assertions, and the delta is
 * measured rather than counted off the source, because the previous figure in
 * this file was wrong by one for years and nothing noticed.
 *
 * The run-mode floor moves from 159 to 214. It is raised rather than left,
 * because 159 against 232 is thirty percent of slack and a gap that wide stops
 * meaning anything, which is the condition the 2026-08-24 entry above names.
 *
 * **THE SKIP-MODE FIGURE IS 181 AND THE PROBE CONTRIBUTED ONE OF IT.** Skip
 * mode was reached by pointing `SMOKE_TOKEN_FILE` at a path that does not
 * exist, and the gate correctly reads a named-but-absent token file as a
 * CONFIGURATION problem rather than as no credential offered, so that run
 * scored 182 with one failing assertion the probe itself created. True skip
 * mode, where no credential is offered at all, emits a skip instead and does
 * not increment. Establish what the instrument contributes before ruling on
 * what it found: the honest figure is 181, floored at 166.
 *
 * **TWO OF THE NEW TWENTY ARE CONTENT-CONDITIONAL**, on the same footing as the
 * blog-bundle case above: the highlighter assertion runs only for a snippet
 * carrying a code fence, and the live-href assertion only for one with a
 * demoted URL. Both conditions are held by `check:features`, which reconciles
 * the snippet set in both directions, so they cannot quietly go absent.
 *
 * ## RE-MEASURED 2026-09-04 WITH THE SEEDED MENTION CASES: **246**
 *
 * **BOTH ENDS MEASURED BY RUNNING**, on the convention the previous entry set
 * and for the reason it gives. The baseline was taken by putting HEAD's copy of
 * this file on disk and running it: 240, against 246 with the new block. Six
 * assertions on the one route that now carries a seeded approved mention: the
 * section renders at all (the precondition, without which the other five and
 * the byte-identity pair beside them are all about a page with no feature on
 * it), the ordinary mention is an anchor carrying the full four-token rel, a
 * script-shaped author name is escaped, no live script element reaches the
 * document, a `javascript:` author URL renders no anchor, and the row whose
 * URLs both failed still renders its text.
 *
 * **THE DELTA WAS THE CROSS-CHECK AND IT CAUGHT A MISCOUNT.** The block was
 * expected to add five; it added six, and the sixth is the degradation
 * assertion. Counting assertions off the source is what the previous entry
 * warns against, and this is the same mistake caught the same way.
 *
 * The run-mode floor moves from 214 to 226, about eight percent under.
 *
 * **SKIP MODE IS 187, DERIVED**, on the basis this file has used since the
 * home-tile entry: these six are in the PUBLIC block, which executes
 * identically in both modes, and skip mode turns on the ADMIN credential
 * rather than on the preview. 181 + 6 = 187, floored at 172.
 *
 * **A `PUBLIC_ORIGIN` RUN SCORES SIX LOWER IN EITHER MODE**, and that is a
 * SKIP rather than a collapse: the deployed site has no approved mention and
 * nothing here may write one, so the block says so and does not increment.
 * 240 against a floor of 226 still passes, which is the slack that mode needs
 * and the reason the floor is not set nearer the measurement.
 *
 * ## RE-MEASURED 2026-09-05 WITH THE MENTIONS QUEUE: **249**
 *
 * Run through this gate's own pipeline, never summed: 241 before, 249 after,
 * and the arithmetic that makes 249 credible rather than merely observed is one
 * surface case plus one overflow case at each of the seven widths. Floored at
 * 234, which is the slack of 15 this floor has always carried.
 *
 * THE PUBLIC_ORIGIN MODE STILL CLEARS IT. That mode scores six lower for the
 * reason above, so it reads 243 against 234 and passes with nine to spare. A
 * floor set nearer the 249 would go red on a run this file already documents as
 * correct, which is the unfailable-floor class inverted.
 */
```

### scripts/check-browser.mjs:6347 (WHY, shortened)

trimmed.

```js
/*
 * THE SUMMARY AND THE FLOOR RUN ONLY IF SOMETHING WAS MEASURED.
 *
 * When the subject never answered, the diagnosis above is the whole result:
 * zero assertions ran, so a summary would print `0 checks, 0 failures`, which
 * reads like a pass, and the floor would refuse with `a block was SKIPPED`,
 * which names the wrong cause. Nothing was skipped; there was nothing to talk
 * to. The exit code is already 1.
 */
```

### scripts/check-browser.mjs:6357 (NUMBER, shortened)

floors asserted below; dated measurements moved.

```js
/*
   * TWO FLOORS, ONE PER MODE, AND THE ADMIN-ABSENT ONE STAYS DELETED.
   *
   * The admin-absent branch went on 2026-09-06 (vol 15) because nothing ever
   * exercised it: this machine always has a credential, the gate is CI-excluded
   * in its preview mode, and an unreachable branch is a mirror of the real one
   * that nobody maintains. That reasoning is unchanged and that branch is gone.
   *
   * **THE MODE SPLIT IS DIFFERENT, because both sides are RUN.**
   * `.github/workflows/browser.yml` runs this gate twice: once with no
   * `PUBLIC_ORIGIN`, against a preview build of the working tree, and once with
   * it set, against the deployed site. So this is ruling 23's per-branch floor
   * rather than the mirror ruling 26 deleted: a single value would be judged
   * against whichever mode ran last, silently.
   *
   * The gap between them is what the deployed mode CANNOT write: six mention
   * assertions (nothing may seed an approved mention on production) and twelve
   * math assertions (the fixture is a draft and nothing here may publish it).
   * Both blocks SKIP with their reason rather than passing quietly.
   *
   * ## RE-MEASURED 2026-09-06 WITH THE MATH CASES, BY RUNNING BOTH MODES
   *
   * Never summed, and the arithmetic is shown only to make the two numbers
   * credible against each other: **261** driving the preview, **243** against
   * `https://dustinedwards.dustin-edwards.workers.dev`, a difference of 18 which
   * is the 6 + 12 above. Before the math cases the figures were 249 and 243.
   *
   * Floored at 248 and 230, which is `check:floors`' own tolerance,
   * `max(3, ceil(count * 0.05))`, applied by hand: 13 under each. By hand
   * because this gate is tiered `network`, so `check:floors` reads the offline
   * tier and never sees these lines. Nothing re-measures them automatically and
   * the trigger is touching this file.
   */
```

### scripts/check-browser.mjs:6396 (WHY, shortened)

trimmed.

```js
/*
   * The summary says WHAT WAS NOT COVERED, not just that something was skipped.
   *
   * A reader who sees "15 checks, 0 failures" and a SKIP line four screens up has
   * been told the admin plane was not looked at, in a way nobody reads. This is
   * the last line before the exit code, which is the one line that gets read.
   */
```

### scripts/check-browser.mjs:6415 (WHY, shortened)

prohibition kept.

```js
/*
   * WHAT STILL NEEDS A HUMAN, PRINTED EVERY RUN, INCLUDING GREEN ONES.
   *
   * The smoke credential moved a list of manual clicks into assertions. It did not
   * empty the list, and a gate that reports only what it covered lets the
   * remainder quietly become "everything is covered". Each line names the reason,
   * because the reasons are different in kind and only one of them is a limit of
   * this harness:
   *
   *   BY CONSTRUCTION  the credential is read-only, so any surface that can only
   *                    be reached THROUGH a write is unreachable to it. Widening
   *                    the credential to reach them would give the machine actor
   *                    the authority the whole design exists to withhold, so
   *                    these stay human on purpose and are not a backlog item.
   *   BY THE HARNESS   Puppeteer cannot express it. These ARE backlog items.
   *   BY JUDGEMENT     it needs an eye rather than a number.
   */
```

### scripts/check-browser.mjs:6450 (WHY, shortened)

trap and hard rule citation kept; date moved.

```js
/*
   * THIS FLOOR COULD NOT FAIL THE GATE UNTIL 2026-09-05, and the defect is the
   * reason the floor sweep exists.
   *
   * The breach set `process.exitCode = 1` and the line immediately below it then
   * assigned `process.exitCode = failures > 0 ? 1 : 0` UNCONDITIONALLY, so a
   * breach with no other failure was overwritten with 0 before the process
   * exited. The gate printed its REFUSED line and exited green. That is hard
   * rule 10's unfailable-condition class, in the gate with the largest and most
   * skippable case set here.
   *
   * The repair is to fold the breach into `failures`, which is the number the
   * exit code is actually computed from, rather than to reorder two assignments
   * and leave the next editor the same trap.
   */
```

### scripts/check-browser.mjs:6465 (WHY, shortened)

trimmed; ruling citation moved.

```js
/*
   * THE FLOOR NAME CARRIES THE MODE, per ruling 23's amendment. One name for
   * two branches would file both readings under one label, and whichever ran
   * last would be judged against a floor measured from the other.
   */
```

## scripts/check-invariants.mjs

### scripts/check-invariants.mjs:1 (CONTRACT, shortened)

usage and boundary kept; section list, B002 and r2_key incident moved.

```js
/**
 * Gate over rules this repo states TWICE and cannot merge into one.
 *
 *   npm run check:invariants
 *   npm run check:invariants -- --remote    adds the live database
 *
 * OBSERVATION BOUNDARY: it compares the two implementations of a rule against
 * each other over a fixture. It does not know whether the rule itself is right,
 * so two implementations that agree on the WRONG answer pass here. What it
 * catches is divergence, which is the failure this repo has actually suffered.
 *
 * Offline by default: no network, no bindings. It bundles TypeScript with
 * esbuild to reach modules the Worker imports, the same technique
 * `check:admin-ui` uses, and runs the SQL halves against an in-memory SQLite
 * from `node:sqlite`. `--remote` adds one read of the deployed D1, which is the
 * only place an unapplied migration or a hand-altered column can be seen.
 *
 * ## What belongs here, and what emphatically does not
 *
 * A pair belongs here when the same rule is expressed twice IN DIFFERENT
 * LANGUAGES OR RUNTIMES, so it cannot be collapsed into one function. Two copies
 * of the same expression in the same language are not an invariant to gate, they
 * are duplication to delete: `bucketFor` was three copies and is now one in
 * `classify.mjs`, and `LANGUAGES` is derived from `GRAMMARS` rather than kept
 * beside it. Asserting a single function agrees with itself proves nothing and
 * would be a gate that can never fail.
 *
 * So this file holds eight sections, and the first is not a comparison:
 *
 *   1. NO SECOND BUCKET SELECTION. Structural. The dedupe is only true while it
 *      stays true, and the failure mode now is a fourth copy appearing in a
 *      file nobody thought to check.
 *   2. publiclyVisible() vs visibilityClause(). Drizzle conditions against a
 *      hand-written SQL string, over the same rule. Hard rule 1 lives in both.
 *   3. The two resolveImage paths. Node and Worker. Since finding B002 both are
 *      pure functions of the key string, which is what makes them comparable at
 *      all; before it, one read the filesystem and the other read R2.
 *   4. THE COLUMN SCHEMA, three ways: schema.ts, the migrations applied to an
 *      empty database, and the live database. Both directions on every pair.
 *   5. EVERY COLUMN NAMED IN RAW SQL EXISTS. Section 4 proves the schema
 *      sources agree with each other; this proves the SQL strings agree with
 *      them, which is the half that actually failed.
 *   6. EVERY POSTS READER COMPOSES THE VISIBILITY PREDICATE. Section 2 proves
 *      the two predicates agree; this proves a reader actually uses one, which
 *      is the half that leaks. Structural, like section 1.
 *
 * Section 4 exists because of hard rule 11 and cost a real defect:
 * `claimMediaKeyForDelete` named `media.r2_key`, which `0007` creates and
 * `0009` renames to `key`, so the statement was guaranteed to throw on the one
 * path it exists to protect. No typecheck reads inside a SQL string, no gate
 * exercised a media delete, and the schema verification in RECOVERY.md compares
 * `sqlite_master` objects by NAME AND TYPE, so columns were outside everything
 * anyone looked at.
 *
 * FAILS CLOSED. Every section asserts its fixture is non-empty and its scan
 * examined files, so "0 problems" can never quietly mean "0 things examined".
 */
```

### scripts/check-invariants.mjs:73 (CONTRACT, shortened)

purpose and limit kept; hoisting and first-draft story moved.

```js
/**
 * Whole-line `#` comments out of a YAML file, replaced with a space.
 *
 * HOISTED TO MODULE SCOPE 2026-08-29, when section 25 became the second reader.
 * It was declared inside the workflow section, so the new reader got a
 * ReferenceError rather than a second copy. That is the good failure: the fix is
 * one definition, not two.
 *
 * Why it exists at all: the first draft of the workflow assertions matched the
 * RAW yaml. Replacing `npm ci` with `npm install` in a run step PASSED, because
 * that step's own comment says "`npm ci` and not `npm install`" and the needle
 * found it there. The assertion was reading prose as though it were
 * configuration.
 *
 * LIMIT, stated: whole-line `#` comments only. A trailing `#` is not attempted,
 * because a naive pass would cut a string containing one, and this is not a yaml
 * parser. A fragment hidden after code on the same line still fires.
 *
 * @param {string} src
 * @returns {string}
 */
```

### scripts/check-invariants.mjs:96 (WHY, shortened)

trap kept, shortened.

```js
/*
 * WHY THE STRING-BLANKING FORM, here specifically: THIS FILE QUOTES THE VERY
 * PATTERNS IT HUNTS, so a scan that kept string literals would flag itself and
 * report its own needles as violations. The general reason comments must go
 * first, and what happens when they do not, is in the helper.
 */
```

### scripts/check-invariants.mjs:131 (WHY, shortened)

section divider shortened.

```js
/* ------------------------------------------------------------------ helpers */
```

### scripts/check-invariants.mjs:157 (WHY, shortened)

exclusion reason kept, shortened.

```js
// The gitignored enhancement bundles: build product, not source, and
      // their presence depends on whether build:enhance has run, so scanning
      // them would make this gate's needle sweeps machine-state-dependent.
      // Excluded by full path, not by name, so a real source directory named
      // dist elsewhere is still walked.
```

### scripts/check-invariants.mjs:192 (WHY, shortened)

mechanism kept, shortened.

```js
// CommonJS, deliberately. An ESM stub can only offer the names it
      // declares, so every named import from a stubbed module is a build
      // error; esbuild resolves named imports from CJS at runtime, which lets
      // one stub stand in for any module's surface.
```

### scripts/check-invariants.mjs:219 (WHY, shortened)

section divider shortened.

```js
/* ------------------------------------------------ 1. no second bucketFor */
```

### scripts/check-invariants.mjs:224 (CONTRACT, shortened)

shape and non-match kept.

```js
/**
 * A bucket selection is a conditional whose two arms are `<x>.OG` and
 * `<x>.MEDIA` in either order.
 *
 * Shape rather than file, because the rule is "there is one of these", and a
 * scan keyed on an allowed-files list would go stale the moment someone adds a
 * file. `rebuild.server.ts` iterating `[env.MEDIA, env.OG]` to walk BOTH buckets
 * is deliberately not this shape and must not be flagged: walking both is not
 * choosing between them.
 */
```

### scripts/check-invariants.mjs:275 (WHY, shortened)

section divider shortened.

```js
/* --------------------------- 2. publiclyVisible vs visibilityClause */
```

### scripts/check-invariants.mjs:279 (CONTRACT, shortened)

fixture intent and clock trap kept; first-version story moved.

```js
/**
 * Post states the two predicates must judge identically.
 *
 * Enumerated rather than sampled: status has two values and publish_at has four
 * interesting cases (null, past, future, exactly now), so eight rows cover the
 * whole space the rule can see. The draft rows matter as much as the published
 * ones, because a predicate that forgot `status` entirely would still pass a
 * fixture made only of published posts.
 *
 * **`NOW` IS TAKEN FROM `publiclyVisible()` ITSELF, not chosen here**, and the
 * first version of this gate was wrong for exactly that reason. The two
 * implementations do not agree on where the current time comes from: the
 * drizzle one calls `new Date()` internally, while the SQL one takes the
 * instant as a bound parameter. Picking a constant here compared them at two
 * different moments and reported a divergence that did not exist. So the
 * reference instant is read out of the rendered drizzle parameters below, and
 * the fixture is built relative to it, which is the only way the comparison is
 * about the RULE rather than about the clock.
 */
```

### scripts/check-invariants.mjs:311 (WHY, shortened)

shortened.

```js
// The drizzle half. `publiclyVisible()` builds a condition from the schema and
  // needs no database to do it, so the dialect can render it to SQL directly.
```

### scripts/check-invariants.mjs:321 (WHY, shortened)

binding mechanism kept, shortened.

```js
/*
   * The reference instant, read out of the rendered parameters.
   *
   * A `timestamp` column is bound as EPOCH SECONDS, not as a Date: drizzle has
   * already applied the column's mapper by the time the dialect renders. So the
   * instant is the one numeric parameter, alongside the string 'published'.
   * Normalising a Date first anyway costs nothing and means a future drizzle
   * that binds the object instead does not silently break the gate.
   */
```

### scripts/check-invariants.mjs:399 (WHY, shortened)

shortened.

```js
// A predicate that admitted everything, or nothing, would agree with a copy
    // of itself and tell us nothing. The rule has to actually discriminate.
```

### scripts/check-invariants.mjs:425 (WHY, shortened)

section divider shortened.

```js
/* ------------------------------------ 3. the two resolveImage paths */
```

### scripts/check-invariants.mjs:429 (CONTRACT, shortened)

scope and placeholder rule kept; B002 narrative moved.

```js
/**
 * Media srcs both resolvers must answer identically.
 *
 * Only `/media/` is comparable, and that is the finding rather than a gap: for
 * `public/` the Node side reads the working tree and the Worker reads the
 * repository over the GitHub API, so neither is a pure function and there is
 * nothing an offline gate can compare. Before B002 that was true of `/media/`
 * too, which is precisely why the dimensions moved into the key.
 *
 * THE PLACEHOLDER IS COMPARED TOO, and for these srcs the assertion is that
 * NEITHER resolver returns one. That is the `/media/` exclusion stated in
 * `rehypeImageSources`, held by a gate rather than by a docblock: a resolver
 * that started inventing a placeholder for an uploaded key would bake a value
 * into the HTML that the other writer could not reproduce, which is B002's
 * shape and the reason this section exists at all. The proxy env below makes it
 * a live assertion rather than a hopeful one, because any attempt to reach a
 * binding to find one throws.
 */
```

### scripts/check-invariants.mjs:452 (WHY, shortened)

shortened.

```js
// Refusals. A key with no dimensions cannot be measured by either side, and
  // both must fail rather than one inventing an answer.
```

### scripts/check-invariants.mjs:490 (WHY, shortened)

shortened.

```js
// Never reached for a /media/ src, and that is the property being asserted:
    // if either resolver starts fetching for these, this env throws and the
    // gate goes red rather than passing on an accidental network read.
```

### scripts/check-invariants.mjs:519 (WHY, shortened)

shortened.

```js
// The whole answer, not just the dimensions: a resolver that agreed on
      // the size and differed on the placeholder would still produce two
      // different documents from one source, which is the thing being refused.
```

### scripts/check-invariants.mjs:533 (WHY, shortened)

shortened.

```js
// AND NEITHER INVENTS ONE. The line above would pass if both resolvers
      // agreed to return a placeholder for an uploaded key, which is exactly
      // the excluded case; agreement is not the same as correctness.
```

### scripts/check-invariants.mjs:555 (WHY, shortened)

rule kept; earlier-version story moved.

```js
// Reports the AGREEMENT COUNT, not a verdict. An earlier version said "both
    // paths in agreement" unconditionally and printed it under six failures,
    // which is the same class of lie as a gate reporting "0 problems" having
    // examined nothing.
```

### scripts/check-invariants.mjs:567 (WHY, shortened)

section divider shortened.

```js
/* ------------------------------------------- 4. the column schema, three ways */
```

### scripts/check-invariants.mjs:571 (CONTRACT, shortened)

three sources and derivation kept; r2_key incident moved.

```js
/**
 * The COLUMN schema, from every source that has an opinion about it.
 *
 * Hard rule 11 exists because nothing checked this. `claimMediaKeyForDelete`
 * named `media.r2_key`, which `0007_media.sql` creates and `0009_media_index.sql`
 * renames to `key`, so the statement was guaranteed to throw on the one path it
 * exists to protect. Nothing caught it: no typecheck reads inside a SQL string,
 * no gate exercises a media delete, and the schema verification in RECOVERY.md
 * compares `sqlite_master` objects by NAME AND TYPE, so columns were outside
 * everything anyone looked at.
 *
 * Three sources, and every one of them is DERIVED:
 *
 *   schema.ts    what the query builder believes, read through `getTableConfig`
 *                rather than by parsing the file
 *   migrations   what `drizzle/*.sql` actually creates, applied to an empty
 *                in-memory database and read back with `PRAGMA table_info`
 *   database     the live D1, same PRAGMA, behind `--remote`
 *
 * There is no column list in this file, which is the entire point: a gate that
 * mirrors the thing it checks fails in exactly the case the mirror is stale.
 *
 * Exclusions are derived too, never named. Virtual tables are the ones whose
 * DDL says `CREATE VIRTUAL TABLE`; shadow tables are the ones prefixed with a
 * virtual table's name and an underscore, which is the same rule `check:backup`
 * uses; and `sqlite_%` is reserved by SQLite for its own bookkeeping.
 */
```

### scripts/check-invariants.mjs:599 (CONTRACT, shortened)

owner pointer kept; lift date moved.

```js
/**
 * Lifted to scripts/lib/sqlite-tables.mjs 2026-08-10, so this file, section 7
 * below and check-backup.mjs all classify by the same rules. The rules were
 * already identical in all three; identical-by-coincidence is what this repo
 * keeps converting into one module with several readers.
 *
 * @param {{name: string, sql: string | null}[]} tables
 */
```

### scripts/check-invariants.mjs:664 (WHY, shortened)

subsection divider shortened.

```js
/* ---- source 1: schema.ts, through drizzle rather than by parsing ---- */
```

### scripts/check-invariants.mjs:689 (WHY, shortened)

subsection divider shortened.

```js
/* ---- source 2: the migrations, applied to an empty database ---- */
```

### scripts/check-invariants.mjs:734 (WHY, shortened)

subsection divider shortened.

```js
/* ---- schema.ts vs migrations, both directions, offline ---- */
```

### scripts/check-invariants.mjs:763 (WHY, shortened)

subsection divider shortened.

```js
/* ---- the INDEXES, both directions, offline -------------------------- */
```

### scripts/check-invariants.mjs:765 (WHY, shortened)

scope and exclusions kept; added date and headings moved.

```js
/*
   * ADDED 2026-08-28. Cheap, because both sources were already open.
   *
   * ## WHY AN INDEX BELONGS IN THIS COMPARISON
   *
   * Hard rule 11 calls schema.ts the source of truth, and until this landed it
   * was the source of truth for COLUMNS and silent about every index. Four
   * posts indexes and three search_docs indexes existed only in
   * `drizzle/*.sql`, so a reader of schema.ts would have concluded that the
   * visibility predicate every public read composes runs as a table scan.
   *
   * The two sides are DERIVED, never listed here: drizzle's own
   * `getTableConfig().indexes` on one side, `PRAGMA index_list` and
   * `PRAGMA index_info` against the already-built in-memory database on the
   * other. There is no index list in this file, which is the same property the
   * column comparison above has.
   *
   * ## WHAT IS COMPARED, AND WHAT IS DELIBERATELY NOT
   *
   * Names, and the ordered column list under each name. ORDER MATTERS in a
   * composite index and comparing an unordered set would pass on a reversed
   * one, which is a different index wearing the same name.
   *
   * NOT compared: partial predicates, collations and directions. SQLite reports
   * `WHERE` clauses and `DESC` through `sqlite_master` text rather than through
   * the pragmas, and drizzle models neither: `media_trashed_idx` is partial in
   * the SQL and unqualified in schema.ts, an asymmetry that file already states
   * at the index itself. Comparing what both sides can express is a real check;
   * comparing what only one side has would fail on every commit.
   *
   * IMPLICIT INDEXES ARE EXCLUDED BY ORIGIN, not by name pattern. SQLite builds
   * one for every UNIQUE constraint and calls it `sqlite_autoindex_<table>_<n>`;
   * `PRAGMA index_list` reports its `origin` as `u` or `pk` rather than `c`,
   * and reading the origin is the derived form of the same exclusion.
   */
```

### scripts/check-invariants.mjs:838 (WHY, shortened)

shortened.

```js
/*
     * SCOPE, ASSERTED, on both sides. An empty map on either one makes every
     * comparison below pass by iterating nothing, and the two failures read
     * completely differently: an empty schema side means the drizzle walk
     * stopped seeing indexes, an empty migration side means the pragma did.
     */
```

### scripts/check-invariants.mjs:908 (WHY, shortened)

exposure kept; section 5 deletion history moved.

```js
/*
     * Not a failure, and NO LONGER COVERED. This used to read "covered by
     * section 5", which was true until section 5 was deleted on 2026-08-16 for
     * being unable to check anything reliably. A table drizzle does not model
     * is reachable only through raw SQL, and nothing asserts its column names
     * now. Printed as an EXPOSURE rather than as reassurance, because the line
     * that named a cover which no longer exists is worse than no line at all.
     */
```

### scripts/check-invariants.mjs:921 (WHY, shortened)

subsection divider shortened.

```js
/* ---- source 3: the live database, behind --remote ---- */
```

### scripts/check-invariants.mjs:925 (WHY, shortened)

Windows traps kept; round-trip timing moved.

```js
/*
     * ONE batched `--command`, passed as a single already-quoted shell string.
     *
     * Every other shape was tried and each fails on Windows for its own reason.
     * An args array with `shell: true` lets the shell split the statement list
     * on its spaces and semicolons, and wrangler reports
     * "Unknown arguments: table_info(account);". `shell: false` cannot run a
     * `.cmd` shim at all and fails EINVAL. And `--file`, which looks like the
     * clean answer, returns only ONE result set under `--json` no matter how
     * many statements the file holds, which silently reduces this check to a
     * single table.
     *
     * Batched rather than a call per table because this runs inside `check:all`
     * and eleven round trips to the edge is most of a minute. The SQL contains
     * no double quote, so wrapping it in one is safe here and asserted below by
     * the count of result sets coming back.
     */
```

### scripts/check-invariants.mjs:945 (WHY, shortened)

throw trap kept; review story moved.

```js
/*
     * RETRIED ONCE. Remote D1 reads have failed with Cloudflare error 10000
     * twice, both clean immediately after. Read only; nothing here writes.
     *
     * THE THROW IS LOAD-BEARING. `spawnSync` RETURNS on a failed command, it
     * does not reject, so wrapping it directly gives retryRead nothing to
     * catch and the retry can never fire: an inert wrapper that reads as
     * protection. Caught in review of this very commit, and it is the same
     * class check:assertions exists to find. The non-zero status is raised
     * deliberately so there is a rejection to retry on.
     */
```

### scripts/check-invariants.mjs:1024 (WHY, shortened)

section divider shortened.

```js
/* ------- 4a. search_docs is modelled for the schema, never queried through it */
```

### scripts/check-invariants.mjs:1026 (WHY, shortened)

ban, reason and exit kept; dates and headings moved.

```js
/*
 * A HOLE THAT DECLARING A TABLE WOULD OTHERWISE OPEN, closed on the same day.
 *
 * `search_docs` joined `schema.ts` on 2026-08-28 so section 4 could compare its
 * columns and its three indexes, which is worth having: this table's column
 * names live inside hand-written SQL strings, the exact shape that produced the
 * `media.r2_key` defect section 4 was built for.
 *
 * But hard rule 1 is enforced for this table by SECTION 8, which reads raw SQL
 * looking for the composed visibility predicate. Section 6, the drizzle-shaped
 * scan, knows only about `posts`. So a query-builder read of `search_docs`
 * would be seen by NEITHER, and it would have become reachable the moment the
 * binding existed.
 *
 * ## WHAT THIS ASSERTS, and why it is a ban rather than a predicate check
 *
 * No source file uses the `searchDocs` binding in a query position. Checking
 * instead that such a read composes the predicate would mean building a second
 * copy of section 6 for one table nothing reads that way, and the second copy
 * is what this whole family of gates exists to avoid.
 *
 * The exit is written down rather than left to be rediscovered: if a drizzle
 * read is ever wanted, teach section 6 about this table FIRST and delete this
 * section in the same commit.
 *
 * ## THE IMPORT IS NOT THE VIOLATION
 *
 * `schema.ts` defines the binding and `check:invariants` itself bundles that
 * file, so both legitimately contain the name. What is banned is a QUERY
 * POSITION: `.from(searchDocs)`, `.into(searchDocs)`, `.update(searchDocs)`,
 * `.delete(searchDocs)`. Comments and strings are stripped first, because this
 * file's own prose names the binding repeatedly and a raw scan would flag the
 * gate for describing the rule.
 */
```

### scripts/check-invariants.mjs:1083 (WHY, shortened)

scope reason kept; unasserted measurement and draft story moved.

```js
/*
   * SCOPE, ASSERTED. A walk that opened nothing reports the same clean result
   * as a repository that genuinely has no such read. FLOOR MEASURED 2026-08-28
   * BY RUNNING THIS WALK: 165 files. The floor is 132, about twenty percent
   * under, so a directory can go missing before this stops meaning anything.
   *
   * The first draft of this comment said 226 against a floor of 180, and both
   * were INVENTED rather than measured. The gate failed on its own author, which
   * is what a scope assertion is for.
   */
```

### scripts/check-invariants.mjs:1100 (WHY, shortened)

shortened.

```js
/*
   * THE NEEDLE IS PROVEN ABLE TO FIRE, on synthetic source, every run. The
   * collection it walks is legitimately allowed to be clean, so without this
   * the assertion below has never been observed doing anything.
   */
```

### scripts/check-invariants.mjs:1125 (WHY, shortened)

retired section divider shortened.

```js
/* ------------------- 5. REMOVED: the raw-SQL column scanner ------------- */
```

### scripts/check-invariants.mjs:1127 (WHY, shortened)

gap and remaining matcher kept; measurements and ruling moved.

```js
/*
 * SECTION 5 WAS DELETED 2026-08-16, and the number is kept so 6 through 9 do
 * not renumber. It matched SQL out of string literals with a regex and then
 * checked every qualified name against `schema.ts`.
 *
 * IT COULD CHECK NOTHING AND PRINT ZERO PROBLEMS. The literal matcher
 * understood quotes but not REGEX LITERALS, so a `/"/` or `/'/` anywhere in a
 * scanned file opened a string that never closed and every quote after it was
 * paired against the wrong partner. MEASURED on 2026-08-16 against the same
 * matcher, read out of this file rather than retyped: 692 desynced matches
 * swallowing 47,495 characters in `check-admin-ui.mjs`, and 19 swallowing 6,739
 * in `search.server.ts`, whose worst single phantom ran 1,523 characters and
 * took the real FTS queries with it. A run that examined nothing looked exactly
 * like a clean one, because the count it printed was of phantoms.
 *
 * RULED: delete rather than patch. Reading SQL out of a host language correctly
 * needs a tokenizer that knows where a regex literal may begin, which in
 * JavaScript is decided by the preceding token, so it needs a parser, not a
 * longer regex. A second regex would be the same instrument with more surface.
 *
 * WHAT IS LOST, stated rather than absorbed: `search_docs` is not modelled in
 * drizzle, and section 4 used to name section 5 as its cover. That cover is
 * gone. Section 4 still reconciles every drizzle-modelled table across
 * `schema.ts`, the migrations and the live database, and section 7 still guards
 * the FTS indexes, but no gate now checks a column name written in raw SQL.
 *
 * THE SAME MATCHER IS STILL LIVE IN TWO PLACES, and it was one instance of a
 * three-instance class rather than a lone defect: section 7 declares it as
 * `LITERAL` and section 8 as `LITERALS`, byte-identical both times. Those guard
 * hard rules 2 and 1, so they were NOT deleted with this one: removing them
 * would drop the guards entirely. They are recorded here as open, because
 * closing a class on one instance is what left three delete paths unguarded
 * this same week.
 */
```

### scripts/check-invariants.mjs:1162 (WHY, shortened)

section divider shortened.

```js
/* ------------------------- 6. every posts READER composes the predicate */
```

### scripts/check-invariants.mjs:1164 (WHY, shortened)

chokepoint, exemption shape and write scope kept; measurements moved.

```js
/*
 * HARD RULE 1, at the CALLER rather than at the predicate.
 *
 * Section 2 proves `publiclyVisible()` and `visibilityClause()` admit the same
 * rows. It says nothing about whether a reader USES either one, and that is the
 * half that actually leaks: a new loader selecting from `posts` directly is
 * invisible to section 2 and would serve drafts and future-dated rows.
 * Backlog item 3.
 *
 * ## TWO ASSERTIONS, and the first is the one section 1's technique gives us
 *
 * **The chokepoint.** Every `.from(posts)` in `app/` lives in `app/db/index.ts`.
 * Measured 2026-08-10: 13 of 13. That single fact is most of the guarantee,
 * because it means the visibility question is decided in one reviewable file
 * rather than wherever someone happened to need a query.
 *
 * **Per function, inside that file.** Every top-level function that queries
 * `posts` must compose `publiclyVisible()`, `visibilityClause()` or
 * `isBlogPost()` (which composes the first), unless it is named below.
 *
 * ## THE EXCLUSION IS A FUNCTION, NOT A FILE, and that distinction is the point
 *
 * The obvious shape is to exclude the module holding the admin reader. It is
 * also useless: `app/db/index.ts` holds the admin reader AND all nine public
 * readers, so a file-level exclusion excludes the entire public read surface
 * and the section passes while asserting nothing. Measured before writing this.
 *
 * ## WRITES ARE OUT OF SCOPE, deliberately
 *
 * `publish.server.ts` carries six raw `FROM posts` occurrences and every one is
 * a DELETE or a subquery resolving an id for a write. A visibility predicate on
 * a write would be wrong: unpublishing a post must still be able to delete its
 * rows. Section 5 already binds those statements' column names to the schema.
 */
```

### scripts/check-invariants.mjs:1201 (CONTRACT, shortened)

shortened.

```js
/**
 * Named functions permitted to query `posts` without the predicate.
 * Each needs a reason, and the reason needs to survive a reader asking "why is
 * it safe for THIS one to see drafts?".
 */
```

### scripts/check-invariants.mjs:1261 (CONTRACT, shortened)

contract kept; 2026-08-11 sweep moved.

```js
/**
 * What `posts` is CALLED in this file, aliases included.
 *
 * THE SCAN USED TO HARDCODE THE NAME, and an import alias walked straight past
 * it. Measured by the pre-audit sweep of 2026-08-11: a file containing
 *
 *     import { posts as postsTable } from "~/db/schema";
 *     return db.select().from(postsTable);        // no predicate
 *
 * left this section reporting 77 checks and 0 failures. The identical file
 * written `import { posts }` and `.from(posts)` reported 77 and 1, naming it.
 * The ONLY difference was the alias, and this is hard rule 1's instrument.
 *
 * It was not hypothetical. `app/lib/operator/api.server.ts` has imported posts
 * under an alias since the operator API shipped, with two live query sites this
 * section had never once looked at.
 *
 * Any named import of `posts` counts, from any module path. There is no other
 * `posts` export in this repo, and scanning a same-named import from somewhere
 * else would cost a false positive, which is the safe direction.
 *
 * @param {string} code comment-stripped source
 * @returns {string[]} local binding names, always including the plain one
 */
```

### scripts/check-invariants.mjs:1286 (WHY, shortened)

trap kept; first-draft story moved.

```js
/*
   * THE MODULE PATH IS ALLOWED TO BE EMPTY, and that is not sloppiness.
   *
   * This file's `stripCommentsAndStrings()` blanks every string literal to `""` so that a
   * later pass can find SQL literals without tripping over an apostrophe in
   * prose. By the time this function sees the source,
   *
   *     import { posts as postsTable } from "~/db/schema";
   *
   * reads `import { posts as postsTable } from "";`. A needle written
   * `["'][^"']+["']` against the RAW form matched nothing here, and the first
   * draft of this resolver scored zero aliased imports in a repo that has one.
   * Measure the needle through the pipeline that feeds it.
   */
```

### scripts/check-invariants.mjs:1335 (WHY, shortened)

prohibition kept; measurement moved.

```js
// stripCommentsAndStrings() ONLY. joinConcatenatedLiterals merges concatenated string
    // literals across lines, which destroys the column-0 brace structure the
    // function extractor below depends on. It exists for the SQL-literal passes
    // and buys nothing here: `.from(posts)` is not a string literal. Using it
    // scored 18 query sites in a file that has 2, and reported isToolName as a
    // posts reader.
```

### scripts/check-invariants.mjs:1343 (WHY, shortened)

shortened.

```js
// NON-EMPTY BY CONSTRUCTION, asserted anyway: an empty alternation
    // collapses to `()` and would match every `.from()` in the repo.
```

### scripts/check-invariants.mjs:1370 (CONTRACT, shortened)

contract and CRLF trap kept; incident moved.

```js
/**
   * Top-level functions, extracted by the file's own brace style: a `function`
   * at column 0, closing at a `}` at column 0.
   *
   * CRLF IS COLLAPSED FIRST, and that is load-bearing rather than tidy. The
   * close test is an exact compare against `"}"`, so on a CRLF file every line
   * reads `"}\r"`, no function ever finds its end, and every body runs to EOF.
   * Measured 2026-08-11 on app/lib/operator/api.server.ts, which is CRLF on
   * disk: NINE functions each swallowed the file's TWO query sites and the
   * accounting read 18 of 2. app/db/index.ts hid this for months by happening
   * to be LF. The accounting assertion is what surfaced it.
   *
   * @param {string} source comment-stripped source
   */
```

### scripts/check-invariants.mjs:1399 (WHY, shortened)

scoping rule kept; discovery moved.

```js
/**
   * Posts readers permitted OUTSIDE the chokepoint file, by FILE AND FUNCTION.
   *
   * FUNCTION-SCOPED, never file-scoped, for the reason section 6 was built with
   * in the first place: a module-scoped exemption would excuse every future
   * reader anyone adds to that file, which is the vacuous form.
   *
   * `syncStatus` was found on 2026-08-11 by fixing the alias blindness above.
   * It had been outside this section's view since the operator API shipped.
   */
```

### scripts/check-invariants.mjs:1467 (WHY, shortened)

shortened.

```js
/*
   * Verified by accounting: every posts query in the file must land inside one
   * of the extracted bodies, and that count is asserted below rather than
   * assumed. If the file's style ever changes, the accounting assertion fails
   * rather than the scan silently missing a function.
   */
```

### scripts/check-invariants.mjs:1489 (WHY, shortened)

floor rationale kept; dated measurements moved.

```js
/*
   * Anti-vacuity floors, RE-MEASURED THROUGH THIS SCAN 2026-08-28 by running
   * the gate: 18 sites, 8 composing.
   *
   * Taken TWICE the same day and it moved between them, which is the argument
   * for taking it rather than carrying it: the first reading was 17 and 7, and
   * `listBlogPostsRendered` landed between them when RSS started carrying the
   * whole post. A measurement is only true of the commit it was taken in.
   *
   * The recorded figures said 14 and 8 and were taken on 2026-08-24, so the
   * site count had drifted three ABOVE its record while the composing count
   * had dropped one below it: `listPublicPosts` was deleted in the same commit
   * as this re-measurement, having lost its only caller when the sitemap's
   * dead `kind = 'page'` arm went. Both directions of drift in one pair, which
   * is the argument for re-measuring rather than adjusting.
   *
   * These floors catch a BROKEN MATCHER reporting zero, not a single deletion,
   * so they sit a little under the measurement rather than on it. A composing
   * floor equal to the count would fail on the next legitimate removal and
   * teach the next person to lower it without looking.
   */
```

### scripts/check-invariants.mjs:1536 (WHY, shortened)

shortened.

```js
// The other direction: an exemption naming a function that no longer exists,
  // or that now composes the predicate, is permission nobody audits.
```

### scripts/check-invariants.mjs:1557 (WHY, shortened)

section divider shortened.

```js
/* ------------------- 7. nothing DELETEs from an FTS index or counts one */
```

### scripts/check-invariants.mjs:1559 (WHY, shortened)

both traps kept; measurements and headings moved.

```js
/*
 * HARD RULE 2's UNGATED HALF. Backlog item 6.
 *
 * `check:backup` derives the table list and excludes fts5 tables from the
 * export. Nothing stopped code from writing to one. Two ways to corrupt or
 * misread an fts5 index, both recorded in hard rule 2 and both enforced by
 * nobody until now:
 *
 *   DELETE FROM <index>   corrupts it. The repair is
 *                         INSERT INTO <index>(<index>) VALUES('rebuild').
 *   COUNT(*) on <index>   reads THROUGH to the content table on an
 *                         external-content index, so it can NEVER detect drift.
 *                         Measured: with the index emptied, COUNT(*) still read
 *                         7 while the docsize shadow read 0.
 *
 * Section 5 explicitly SKIPS virtual tables in its raw-SQL column scan
 * (`${virtualTables.length} fts5 table(s) skipped`), so an added
 * `DELETE FROM posts_fts` passes every other gate in this repo.
 *
 * ## THE SCAN INVERTS SECTION 5's MACHINERY
 *
 * Section 5 STRIPS literals to find code. This scans INSIDE them, because SQL
 * in this codebase only ever exists as a string. Comments are stripped FIRST so
 * prose explaining the rule cannot be read as a statement, which is the trap
 * check:logo, check:contrast, check:features, check:headers, check:urls and
 * check:secrets have each hit.
 *
 * ## THE TABLE LIST IS DERIVED, NEVER NAMED
 *
 * From `drizzle/*.sql` replayed into memory, then classified by the shared
 * `scripts/lib/sqlite-tables.mjs`. It was one index, then two, then three; a
 * hardcoded list is how the fourth gets missed. Shadows come by prefix, so a
 * new index brings its own along.
 */
```

### scripts/check-invariants.mjs:1609 (WHY, shortened)

tripwire reason kept.

```js
/*
   * EXACTLY THREE, and this is a tripwire rather than a preference. A fourth
   * index means the corpus grew and the floors below want re-measuring; zero
   * means the classifier or the migration replay broke, and a broken classifier
   * reports zero violations exactly like a clean repo.
   */
```

### scripts/check-invariants.mjs:1629 (WHY, shortened)

replacement reason kept; plant and measurements moved.

```js
/*
   * NO LITERAL EXTRACTION HERE ANY MORE, replaced 2026-08-21, and this is the
   * third instance of the class that killed section 5.
   *
   * ## WHAT WAS PROVEN, rather than reasoned
   *
   * The old matcher understood quotes but not REGEX LITERALS, so a `/"/`
   * anywhere in a file opened a string that never closed. MEASURED across the
   * 189 files this walk scans: 137 regex literals containing a quote, in 28
   * files, producing 22 phantom "literals" over 800 characters, the longest
   * 21,551. The 1,523-character phantom in `search.server.ts` that the
   * 2026-08-16 audit named is still there.
   *
   * **AND THE GUARD WAS BYPASSED, DEMONSTRATED WITH A PLANT IN BOTH
   * DIRECTIONS.** The identical string, `"DELETE FROM posts_fts WHERE rowid =
   * 1"`, was added to two files. In `app/lib/once.mjs`, which carries no regex
   * literals, this section FIRED and named it. In `app/lib/search/search.server.ts`,
   * which carries three phantoms, it was INVISIBLE and the gate reported 167
   * checks and zero failures. Hard rule 2's guard could be walked past in the
   * one file most likely to contain FTS SQL.
   *
   * ## WHY SCANNING THE SOURCE DIRECTLY IS THE RIGHT REPLACEMENT
   *
   * Section 5 needed literal BOUNDARIES because it extracted column names from
   * inside a statement and compared them to a schema. **This section only asks
   * whether a forbidden pattern OCCURS.** Boundaries buy it nothing and cost it
   * a bypass, so they go. Nothing is skipped, so a false negative of that shape
   * is no longer possible.
   *
   * The trade is a false-positive surface, and it is small and self-announcing:
   * `DELETE FROM posts_fts` is not valid JavaScript outside a string, comments
   * are already stripped, and if it ever fires on something harmless the failure
   * prints the file and the surrounding text.
   */
```

### scripts/check-invariants.mjs:1673 (WHY, shortened)

guard reason kept; discovery moved.

```js
/*
   * `owned` is what DELETE_FTS is built from, so it gets its OWN guard rather
   * than inheriting one. The two assertions above cover `classified.virtual`
   * and `classified.shadow`, which IMPLY this list is non-empty; an implication
   * is not a guard, and it is the first thing that would break if
   * ftsOwnedTables changed what it returns. An empty alternation makes
   * DELETE_FTS match every `DELETE FROM`, so this section would report zero
   * violations by matching everything. Found by check:assertions rule (d).
   */
```

### scripts/check-invariants.mjs:1699 (WHY, shortened)

shortened.

```js
// Self-exclusion, same reason as section 1 and section 5: this file's own
      // failure messages and regexes name the very statements it forbids.
```

### scripts/check-invariants.mjs:1708 (WHY, shortened)

shortened.

```js
/*
       * SCOPE, COUNTED ON THE SOURCE. `sqlLiterals` used to count extracted
       * literals; it now counts SQL-ish MATCHES, which is the honest measure of
       * what this scan has to look at. The floor below moves with it.
       */
```

### scripts/check-invariants.mjs:1717 (WHY, shortened)

guard reason kept; plant moved.

```js
/*
         * Both guarded on a NON-EMPTY derived list. With zero indexes the
         * alternation collapses to `()`, which matches the empty string and so
         * matches EVERY literal: the tripwire above has already failed by then,
         * and without this the same run also reports every DELETE in the repo
         * as an FTS violation. Found by the vacuity plant, which produced two
         * misleading extra failures beside the one it was written to fire.
         */
```

### scripts/check-invariants.mjs:1725 (WHY, shortened)

shortened.

```js
/*
         * A WINDOW AROUND THE MATCH, not the head of the file. `literal` is now
         * the whole source, so slicing from its start printed the import block
         * on the defect-replay run: it named the file and never showed the
         * offence, which is half a failure message.
         */
```

### scripts/check-invariants.mjs:1746 (WHY, shortened)

trap kept; discovery moved.

```js
/*
         * MATCHES, not literals. `sync-content.mjs` builds its health check by
         * concatenating three fragments, and `joinConcatenatedLiterals` merges
         * them into ONE literal carrying all three counts, so counting literals
         * reported 1 where the repo has 3. Found by this assertion failing on
         * its own first run.
         */
```

### scripts/check-invariants.mjs:1760 (WHY, shortened)

scope reason kept; measurements moved.

```js
/*
   * ANTI-VACUITY, RE-MEASURED 2026-08-21 because the counter changed what it
   * counts. It was extracted LITERALS, floored at 45 against a measured 61. It
   * is now SQL-ish MATCHES in the comment-stripped source, which is the honest
   * measure of what this scan looks at now that it no longer extracts anything.
   *
   * MEASURED THROUGH THIS EXACT PIPELINE: 189 files, 175 matches. Floored a
   * quarter under at 131, so ordinary refactoring does not trip it. Carrying
   * the old 45 forward would have been a floor set against a different
   * instrument, satisfied by roughly a quarter of the corpus going dark.
   *
   * A zero means the walk broke, and "0 violations" from a broken walk is
   * indistinguishable from a clean repo. Hard rule 10.
   */
```

### scripts/check-invariants.mjs:1802 (WHY, shortened)

intent kept; enumeration history moved.

```js
/*
   * The companion, and it is the positive half. Enumerated before asserting,
   * and RE-ENUMERATED 2026-08-24 because the old sentence here had gone false:
   * `sync-content.mjs` is no longer the only FTS health check in the repo. The
   * three shadow counts moved into `app/lib/health/checks.server.ts` when the
   * health endpoint landed, `app/lib/operator/api.server.ts` counts one, and
   * sync-content keeps one. If these disappear, the drift check has gone and
   * nothing else would say so.
   */
```

### scripts/check-invariants.mjs:1826 (WHY, shortened)

section divider shortened.

```js
/* --------------- 8. every search_docs READER composes the predicate ------ */
```

### scripts/check-invariants.mjs:1828 (WHY, shortened)

gap and two levels kept; audit story moved.

```js
/*
 * THE OTHER HALF OF HARD RULE 1, and it was uncovered until 2026-08-11.
 *
 * Section 6 asserts that every `posts` reader composes the predicate. But the
 * public search surface does not read `posts`: it reads `search_docs`, in raw
 * SQL, and section 6's scan is for `.from(<posts binding>)`. So the two
 * `zeroState` queries restated the visibility rule inline and nothing looked at
 * them.
 *
 * MEASURED BEFORE FIXING: deleting the entire predicate from the zeroState tag
 * query left check:invariants, check:search, check:content, check:urls and
 * check:policy ALL GREEN. That is the exact shape of a draft leak on /search's
 * zero state, invisible to every offline instrument.
 *
 * The external audit reported this and gave the wrong reason (it said section 6
 * should have covered the file, and that the `d.` alias was the obstacle).
 * Section 6 DOES cover the file: a Drizzle-shaped no-predicate `posts` read
 * planted there fires by name. The alias was only why the queries could not
 * CALL the shared function. The real gap is the one this section closes: a
 * whole TABLE nobody was watching.
 *
 * TWO LEVELS, because two of the four readers compose it indirectly:
 *
 *   direct    `visibilityClause(...)` in the same function
 *   indirect  `filters.clause`, the FilterSql that buildFilters assembles
 *
 * The indirection is only trustworthy if buildFilters itself composes the
 * predicate, so that is asserted separately rather than assumed.
 */
```

### scripts/check-invariants.mjs:1864 (WHY, shortened)

classification traps kept.

```js
/*
   * CLASSIFIED PER SQL LITERAL, not per function body, and both halves of that
   * were learned by getting it wrong first.
   *
   * `DELETE FROM search_docs` CONTAINS the substring `FROM search_docs`, so a
   * body-level `FROM` test reported both of publish.server.ts's write helpers
   * as unpredicated readers. And `runIndex` reaches the table through
   * `JOIN search_docs d`, never `FROM`, so a `FROM`-only test missed the very
   * reader most worth checking.
   *
   * A literal is a READ when it is a SELECT that names the table in either
   * position; it is a WRITE when it names it after a write verb. Writes carry
   * no predicate and must not.
   */
```

### scripts/check-invariants.mjs:1909 (WHY, shortened)

granularity reason kept; first-version story moved.

```js
/*
       * ONE QUERY, not one function, and the difference is the whole assertion.
       *
       * The first version asked whether the FUNCTION composed the predicate.
       * `zeroState` runs TWO queries, so deleting the predicate from one of
       * them left the other satisfying the test and the audit's own repro
       * passed. Per-function granularity is exactly the hole this section
       * exists to close.
       *
       * A `prepare(` argument is one statement. Extracted by counting
       * parentheses from the call, so an interpolation containing parens does
       * not truncate it.
       */
```

### scripts/check-invariants.mjs:1935 (WHY, shortened)

shortened.

```js
/*
         * `prepare(sql)` where `sql` was assembled above is the dominant shape:
         * runIndex and runBrowse both build the string first. Resolving the
         * bare identifier back to its assignment is what makes those two
         * visible; without it this scan saw 2 readers where there are 3, and
         * the two it missed were the ones serving actual search results.
         */
```

### scripts/check-invariants.mjs:1950 (WHY, shortened)

bounded-risk tripwire kept; measurements moved.

```js
/*
         * ============================================================
         * THE SAME DEFECTIVE MATCHER, KEPT HERE ON PURPOSE, WITH A TRIPWIRE.
         * ============================================================
         *
         * `LITERALS` is byte-identical to the matcher deleted from section 5
         * and replaced in section 7 on 2026-08-21, and it does not understand
         * REGEX LITERALS. Section 7's copy was proven bypassable with a plant.
         * This one is kept, and the difference is measured rather than assumed.
         *
         * **Section 7 scanned whole files. This scans one `prepare()` argument**,
         * already bounded by paren counting before the matcher ever runs.
         * MEASURED 2026-08-21 across every `app/` file carrying `search_docs`:
         * 25 prepare() arguments, longest 1,163 characters, and ZERO of them
         * contain a regex literal. The desync has nothing to desync on.
         *
         * It is not replaced the way section 7 was, because section 7 only
         * asked whether a pattern OCCURS while this one must CLASSIFY each
         * literal as a read or a write. Granularity is the assertion here:
         * `DELETE FROM search_docs` contains `FROM search_docs`, so a
         * whole-statement test reported both write helpers as unpredicated
         * readers, and that is recorded above as already having been got wrong.
         *
         * SO THE RISK IS BOUNDED AND MADE TO ANNOUNCE ITSELF. The moment a
         * regex literal appears inside a scanned prepare() argument, the
         * measurement above stops being true and this fails, rather than
         * quietly classifying a desynced region.
         */
```

### scripts/check-invariants.mjs:2009 (WHY, shortened)

scope reason kept; stale count moved.

```js
/*
   * NON-EMPTY SCOPE. Zero readers found means the SQL was reworded and this
   * whole section would report perfect compliance by examining nothing.
   *
   * MEASURED THROUGH THIS SCAN: 4 reader QUERIES. runIndex and runBrowse
   * contribute one each and zeroState contributes two, because the unit here is
   * a `prepare()` call rather than a function. Tight rather than slack, for the
   * same reason as check:secrets' three-file workers floor: a set this small
   * cannot absorb slack without losing the ability to notice one disappearing.
   */
```

### scripts/check-invariants.mjs:2026 (CONTRACT, shortened)

shortened.

```js
/**
   * Readers deliberately without the predicate, each with the reason.
   *
   * A NAMED LIST, on the same rule as every other exemption map here: a pattern
   * would let a new reader match by accident, and a name cannot. Both directions
   * are policed below, so an entry that stops being needed fails rather than
   * standing as a permanent excuse.
   *
   * @type {Record<string, string>}
   */
```

### scripts/check-invariants.mjs:2063 (WHY, shortened)

shortened.

```js
/*
   * THE OTHER DIRECTION. An exemption naming a reader that has since gained the
   * predicate, or that no longer reads search_docs at all, is a stale excuse
   * rather than a standing decision, and a stale excuse is how the next real
   * bypass gets waved through under an old name.
   */
```

### scripts/check-invariants.mjs:2102 (WHY, shortened)

section divider shortened.

```js
/* ------------------- 9. trash hides an asset from the library, not from R2 -- */
```

### scripts/check-invariants.mjs:2104 (WHY, shortened)

both failure directions kept, shortened.

```js
/*
 * **BEHAVIOURAL, not structural, and that is what makes it worth having.**
 *
 * Sections 6 and 8 assert that a reader COMPOSES a predicate. This one asserts
 * what the predicate DOES, by applying the real migrations to an empty SQLite
 * database, inserting a media fixture, and running the predicate `notTrashed()`
 * renders to. The second opinion is not another function, which would be a
 * mirror; it is the DATABASE.
 *
 * It exists because trash on this table is counter-intuitive by design and the
 * two halves fail in opposite directions:
 *
 *   TOO NARROW   a library view that forgets the predicate offers a trashed
 *                asset back to the author, and the role chip that led them
 *                there counted it.
 *   TOO WIDE     a RECONCILIATION reader that applies it sees an object in R2
 *                with no row, and `check:media` backfills the row, which is
 *                trash undone by a gate on the next reconcile. The object is
 *                untouched by trashing, so this direction is not hypothetical.
 *
 * Both directions are asserted, and the anti-vacuity control runs the same
 * queries WITHOUT the predicate first, so a fixture that accidentally contained
 * no trashed row could not report compliance.
 */
```

### scripts/check-invariants.mjs:2159 (WHY, shortened)

shortened.

```js
/*
   * THREE ROWS, and the two brand rows are the point.
   *
   * One live content row, one live brand row and one TRASHED brand row. A
   * fixture with a trashed row of a role nothing else carries would let a
   * broken role count pass, because the role would simply vanish rather than
   * report the wrong number. Two rows sharing a role is what makes the count
   * assertion able to read 2 when it should read 1.
   */
```

### scripts/check-invariants.mjs:2193 (WHY, shortened)

shortened.

```js
/* ANTI-VACUITY FIRST. Without the predicate the fixture must show all three
   * and both brand rows, or the assertions below prove nothing about it. */
```

### scripts/check-invariants.mjs:2219 (WHY, shortened)

shortened.

```js
/* THE OTHER DIRECTION. Reconciliation must still see it, or check:media
   * backfills the row and undoes the trash on the next reconcile. */
```

### scripts/check-invariants.mjs:2229 (WHY, shortened)

shortened.

```js
/*
   * RESTORE PUTS THE ROW BACK IN ITS ROLE COUNT, asserted as a round trip
   * rather than as a second predicate.
   *
   * Trash and restore are one mechanism read in two directions, and the failure
   * worth catching is the asymmetric one: a restore that clears the flag but
   * leaves the row out of the count, which would look to the author like the
   * asset came back and the chip did not. Done by mutating the fixture and
   * re-reading, so it exercises the column rather than a predicate about it.
   */
```

### scripts/check-invariants.mjs:2261 (WHY, shortened)

shortened.

```js
/* The tags column, asserted here because the migration is what creates it and
   * this is the only place the migration is actually executed. */
```

### scripts/check-invariants.mjs:2290 (WHY, shortened)

guard and assertion boundaries kept.

```js
/*
   * THE PERMANENT DELETE STILL REFUSES A CITED OBJECT.
   *
   * Trash does not go near this path and must not: Delete permanently runs the
   * EXISTING refcount-guarded claim, and the whole safety argument of the media
   * library rests on that one statement staying atomic and staying guarded. The
   * risk this section is written against is a later trash-shaped refactor
   * folding `trashed_at` into `claimMediaKeyForDelete` and dropping the
   * `NOT EXISTS` while rewriting the WHERE.
   *
   * TWO ASSERTIONS, and their boundaries differ, which is why they are not one:
   *
   *   STRUCTURAL, over the shipped source. The guard is still composed inside
   *   the claim. This is the one that would catch the refactor.
   *
   *   BEHAVIOURAL, over the fixture. The SQL below is written HERE and is
   *   therefore a MODEL of the guard rather than the guard itself, which is a
   *   weaker claim than the trash assertions above and is stated as such: it
   *   proves the refcount semantics do what the library relies on, not that
   *   this exact statement ships.
   */
```

### scripts/check-invariants.mjs:2349 (WHY, shortened)

reason kept; plant story moved.

```js
/*
   * **EVERY BULK DELETE PATH ACTUALLY CALLS THE GUARD.**
   *
   * FOUND BY A PLANT, and the plant is the only reason this exists. Replacing
   * the call inside Empty trash with `const claimed = true` left this entire
   * gate GREEN: the assertions above prove the guard is still written
   * correctly, and nothing proved anybody still uses it. A guarded function
   * nobody calls is a guard with no subject, and Empty trash is precisely the
   * path where skipping it removes many objects at once.
   *
   * Source level, over the media route, because `check:admin-ui` cannot see
   * this: it stubs every `.server` import, so the action never runs there.
   */
```

### scripts/check-invariants.mjs:2386 (WHY, shortened)

rule kept; plant and media_refs story moved.

```js
/*
   * **TAGS HAVE EXACTLY ONE WRITER, AND EVERY BULK PATH GOES THROUGH IT.**
   *
   * FOUND BY A PLANT, the second time this session's technique has paid:
   * replacing the call inside bulk tagging with a direct
   * `upsertMediaRecord({ tags: ... })` left every gate green. The unit tests
   * prove `serialiseTags` is correct and nothing proved anybody still calls it,
   * so a bulk path could write `,alpha,` by hand, get the wrapping subtly wrong
   * on the empty case, and silently produce rows no tag needle matches.
   *
   * This table has ALREADY been bitten by exactly this shape: `media_refs` is
   * deduplicated with space-joined keys by two shipped writers and NUL by the
   * tested helper, unreachable today only because `form` is a spaceless enum.
   * One writer, gated, is the repair for the class rather than for the instance.
   */
```

### scripts/check-invariants.mjs:2417 (WHY, shortened)

hard rule citation kept; removal narrative moved.

```js
/*
   * A THIRD ASSERTION WAS WRITTEN HERE AND REMOVED, deliberately, and the
   * removal is itself the finding.
   *
   * It read: no writer in this route sets the `tags` column directly. With the
   * plant in place that expression is demonstrably TRUE when evaluated against
   * the same file with the same comment strip, so the assertion should have
   * failed. In the gate it passed, and I could not account for the difference
   * within the session.
   *
   * Hard rule 10 settles what to do about that. An assertion whose firing
   * cannot be demonstrated is worse than no assertion: it reports coverage it
   * does not have and increments the executed count while doing it. So it is
   * removed rather than shipped unproven.
   *
   * The assertion above IS proven, by a plant whose firing line is in the
   * session report, and it catches the same defect from the other direction:
   * bulk tagging must CALL the single writer.
   *
   * OWED: find why the two evaluations disagree, then restore it with a plant
   * that fires.
   */
```

### scripts/check-invariants.mjs:2447 (WHY, shortened)

section divider shortened.

```js
/* ------------------------------------------------------------------ report */
```

### scripts/check-invariants.mjs:2454 (WHY, shortened)

numbering rule kept; deletion story moved.

```js
/*
 * Section 10 (route-level artifact reads go through the shared per-request
 * reader) was DELETED with the committed artifact itself: `loadArtifact`, the
 * memo and the 600KB GitHub round trip it deduplicated no longer exist, and
 * the citation scan reads `posts.body` out of D1. The number is retired, not
 * reused, on the same rule as CLAUDE.md's numbering.
 */
```

### scripts/check-invariants.mjs:2462 (WHY, shortened)

section divider shortened.

```js
/* ---------- 11. the drift badge reads a cache, not the AI Search index ---- */
```

### scripts/check-invariants.mjs:2464 (WHY, shortened)

properties kept; latency measurements and incident moved.

```js
/*
 * THE LAYOUT MUST NOT LIST THE INDEX ON A CACHE HIT.
 *
 * `listAllAskItems` pages AI Search and was measured on production 2026-08-19
 * across 12 direct samples of `/admin.data` at a median of 208ms and a maximum
 * of 2332ms. The admin layout runs on every admin page load, so that tail was
 * reachable from any click in the admin plane. `askDriftCount` serves the badge
 * from KV and only lists on a miss.
 *
 * ## ASSERTED ON STRUCTURE, NOT ON AN INSTRUMENT, AND THAT IS THE POINT
 *
 * The tempting version counts `ask_list_page` marks and asserts none appear on
 * a cached request. This repo already has the counter-example: on 2026-08-19 a
 * mark count reported ONE `artifact_load` while TWO reads were happening,
 * because the second call bypassed the memo the mark sat inside. An instrument
 * can only see what it was threaded through, so an assertion built on one
 * inherits every hole in the threading. Source ORDER cannot be bypassed: if the
 * early return precedes every mention of the index, a hit cannot reach it.
 *
 * ## THREE PROPERTIES
 *
 * 1. `askDriftCount` returns the cached value BEFORE any reference to the
 *    index appears in its body.
 * 2. The admin layout's loader reads the count through `askDriftCount` and does
 *    not call the full status reader. The reader stays on the CONTEXT for
 *    `/admin/posts`, which owns the repair and must be authoritative, so this
 *    is scoped to the loader rather than to the file.
 * 3. CALLER COVERAGE on invalidation: every function that mutates the index
 *    must drop the cached number. Written after the first sweep of this change
 *    missed two of four sites, one because the regex matched a bare `await` and
 *    the site used an assignment, and one because it invalidated nothing at all.
 */
```

### scripts/check-invariants.mjs:2516 (WHY, shortened)

scope-first reason kept; tutorial cut.

```js
/*
   * SCOPE, ASSERTED FIRST. Every assertion below reports success when the
   * extractor returns "", because "no index reference before the return" is
   * trivially true of an empty string. That is the shape of a gate that
   * examined nothing and said so cheerfully.
   */
```

### scripts/check-invariants.mjs:2530 (WHY, shortened)

trimmed.

```js
// ORDER, not presence. Both must exist for the comparison to mean anything,
  // which is why their presence is asserted before their positions are compared.
```

### scripts/check-invariants.mjs:2553 (WHY, shortened)

prohibition kept; measured incident moved.

```js
/*
   * THE LATE WRITE IS REGISTERED ON waitUntil, NOT LEFT FLOATING.
   *
   * The defect this replaces: on a listing slower than DRIFT_BUDGET_MS the
   * write was `void listing.then(...)`, which lands only if the isolate
   * outlives the response. Workers may cancel pending work once a response is
   * returned, so a slow listing never populated the cache, the next request
   * missed for the same reason, and the TTL never got a value to expire.
   * Measured before the fix: 4 misses in 12 samples, and the only two that
   * populated the cache were the two that finished UNDER the budget.
   *
   * Asserted on SOURCE rather than on a mark, for section 11's standing
   * reason: a floating write and a registered one are indistinguishable to any
   * instrument on the request, because the difference is entirely in what
   * happens after the response has gone.
   *
   * BOTH DIRECTIONS. Presence of `ctx.waitUntil(` alone would still pass if a
   * second, floating `void listing` were added beside it, which is exactly the
   * shape the fix removed.
   */
```

### scripts/check-invariants.mjs:2587 (WHY, shortened)

trap kept; three-week incident moved.

```js
/*
   * THE PER-POST UPLOAD ISOLATES EACH RECORD, AND A FAILED KEY STILL COUNTS AS
   * LIVE. The second half is the one that bites.
   *
   * `syncAskPost` used to `await` each upload with no catch, so the first
   * rejection threw out of the function. MEASURED: one post published with nine
   * records, the first upload failed, and all nine were missing for three
   * weeks. The caller catches by design, so a save must not fail because an
   * index write did, and the failure had nowhere to go but the drift badge.
   *
   * Isolating the loop introduces a worse bug if done carelessly. The prune
   * below the loop deletes every key this post owns that is NOT in `live`, so a
   * failed upload whose key never joined `live` would cause the good copy
   * ALREADY in the index to be deleted. The old throw prevented that by never
   * reaching the prune. `live` means "this key should exist", not "this key was
   * just written", so a failed key belongs in it.
   *
   * Asserted on ORDER, which is what the property actually is: the push happens
   * inside the catch and the `live.add` happens after it, unconditionally.
   */
```

### scripts/check-invariants.mjs:2619 (WHY, shortened)

mechanism kept; first-version story moved.

```js
/*
   * **POSITION IS NOT REACHABILITY, and the first version of this assertion got
   * that wrong.** It compared `indexOf("live.add(key)")` against
   * `indexOf("failed.push(")` and asserted the first came later. A `continue`
   * added to the catch block satisfies that comparison perfectly: the text
   * still sits after the push, and the line is now unreachable on the failure
   * path. Planted exactly that, and the gate stayed green.
   *
   * So the assertion reads what is BETWEEN them. Any control-flow escape
   * between the failure being recorded and the key joining `live` skips the
   * `live.add`, whatever order the characters are in.
   */
```

### scripts/check-invariants.mjs:2631 (WHY, shortened)

prohibition and hard rule 12 kept; heredoc story moved.

```js
/*
   * **THE NEEDLE CARRIES NO BACKSLASH, AND THAT IS NOT STYLE.**
   *
   * This was written as a word-boundary regex and the boundary did not survive
   * being written to disk: a shell heredoc ate one backslash, Python read the
   * remaining `\b` as an escape, and the file received a literal BACKSPACE
   * (0x08) on both sides of the alternation. The pattern then asked for
   * "backspace, continue, backspace", which no source file contains, so the
   * test returned false, the negation returned true, and the assertion passed
   * on a planted defect.
   *
   * It was caught only because the plant was run. A green gate over a violation
   * confirmed to have applied is the exact shape hard rule 12 exists for.
   *
   * Built from a character class instead. It says the same thing as a word
   * boundary for this input and contains nothing an escaping layer can eat.
   */
```

### scripts/check-invariants.mjs:2671 (WHY, shortened)

trimmed to one line.

```js
// The layout's LOADER specifically. askStatusContext is still set by the
  // middleware and read by /admin/posts, so a file-level assertion would be
  // wrong in both directions.
```

### scripts/check-invariants.mjs:2697 (WHY, shortened)

trimmed.

```js
/*
   * CALLER COVERAGE. A function that changes what the index holds and leaves
   * the cached number in place makes the badge disagree with an action the
   * operator just took, for up to the TTL.
   */
```

### scripts/check-invariants.mjs:2726 (CONTRACT, shortened)

rule and scope kept; regression history moved.

```js
/*
 * THE SKIP LINK IS UNCONDITIONAL, SO ITS TARGET MUST BE TOO.
 *
 * `root.tsx` renders `<a class="skip-link" href="#main">` on EVERY route. A
 * route that renders a `<main>` without `id="main"` therefore ships a skip
 * link that moves focus nowhere, and it is the first thing a keyboard reader
 * reaches.
 *
 * It regressed twice and neither was noticed: `/login`, the site's only door,
 * and the error boundary, which is the most likely page a stranger reaches by a
 * broken link. Both fixed 2026-08-20.
 *
 * **THIS EXISTS BECAUSE check:browser IS NOT IN THE OFFLINE TIER.** That gate
 * measures the real thing in a real browser and is the better instrument, but
 * it needs a build, a server and a browser, so it is tiered network and `ship`
 * never runs it. This is the cheap source-shaped half that runs before every
 * ship. The two are not redundant: this one cannot see whether the target is
 * REACHABLE, only whether it exists in the source.
 *
 * SCOPED TO ROUTES THAT RENDER A `<main>`. A route rendering into a parent
 * layout's main has no `<main>` of its own and must not be required to invent
 * one; the admin subtree is exactly that shape.
 */
```

### scripts/check-invariants.mjs:2769 (WHY, shortened)

scope reason kept; incident count moved.

```js
/*
   * SCOPE, ASSERTED. "No offenders" is also what an empty walk and a stripper
   * that emptied every file both report, and this gate has been bitten by that
   * shape twice in a week.
   */
```

### scripts/check-invariants.mjs:2791 (CONTRACT, shortened)

rule, builders and exemption policy kept; 2026-08-20 measurement moved.

```js
/*
 * NO PAGE HAND-ASSEMBLES ITS OWN SOCIAL SET.
 *
 * Five public pages each built part of the same meta list by hand and each
 * stopped somewhere different. Measured 2026-08-20: the HOME PAGE, the URL
 * people paste, had `og:image` and `twitter:card` and no canonical, no
 * `og:title`, no `og:description`, no `og:url` and no `og:type`. The colophon
 * and roster had a title and description and nothing else. Projects and
 * playground had canonical and OG text and no image and no card.
 *
 * Nothing was wrong with any single line. The defect is the SHAPE: a copied
 * literal drifts one property at a time and no reviewer diffs five files
 * against each other. So the assertion is structural rather than a checklist of
 * tag names, because a checklist would need updating every time the set grows
 * and would itself become the sixth copy.
 *
 * TWO BUILDERS ARE LEGITIMATE. `pageMeta` for hand-authored pages and
 * `postSocial` for posts, which resolves per-post overrides and the generated
 * card. A route using either is compliant; a route returning a bare array is
 * not.
 *
 * SCOPED TO app/routes AND TO PUBLIC PAGES. `admin.*` is exempt: the admin
 * plane is noindex by ruling, so a canonical and a social card would be
 * describing pages that must never be shared. `login` is exempt for the same
 * reason. The exemption is a NAMED LIST with a reason, not a pattern, so a new
 * public page cannot join it by accident.
 */
```

### scripts/check-invariants.mjs:2850 (WHY, shortened)

scope reason kept; incident count moved.

```js
/*
   * SCOPE, ASSERTED. "Nothing hand-rolled" is also what an empty walk reports,
   * and this gate has been bitten by that shape three times in a fortnight.
   */
```

### scripts/check-invariants.mjs:2878 (CONTRACT, shortened)

decidable rule and why-not-derive kept; 2026-08-20 finding moved.

```js
/*
 * A PAGE ADDED AND FORGOTTEN IS SILENTLY UNLISTED.
 *
 * `sitemap.ts` carries `STATIC_PATHS`, a literal mirroring `routes.ts`. Its own
 * comment said so and left it: "a public page added there and forgotten here is
 * simply absent from the sitemap, silently, and nothing fails". That is not a
 * hypothetical. MEASURED 2026-08-20: `/projects` and `/playground` had been
 * missing since they shipped, both public, both indexable, both in the header
 * nav.
 *
 * ## THE RULE, so the set is decidable rather than a matter of opinion
 *
 * A route is an INDEXABLE PAGE when all three hold:
 *   1. it is declared before the `// Auth` marker, so it is in the public block
 *   2. its module is `.tsx`, which is a page rather than a resource route
 *      returning XML, JSON or a stream
 *   3. its path carries no `:param`, because dynamic pages are emitted from D1
 *      further down the sitemap rather than from this list
 *
 * Anything satisfying all three must be in `STATIC_PATHS` or in
 * `SITEMAP_EXEMPT` below, which is a NAMED LIST WITH A REASON, on the same rule
 * as every other exemption map in this repo. A pattern would let a new page
 * match by accident; a name cannot.
 *
 * ## WHY NOT DERIVE THE ARRAY AT RUNTIME
 *
 * `routes.ts` is a build-time module of nested config objects. Reading it inside
 * the Worker means parsing TypeScript there or shipping a second generated
 * artifact for four strings. This gets the same guarantee at no runtime cost,
 * and it can say WHY a route is absent, which a derivation cannot.
 */
```

### scripts/check-invariants.mjs:2922 (WHY, shortened)

trimmed.

```js
/*
   * The public block only. Everything from the `// Auth` marker down is login
   * and the admin subtree, which are noindex by ruling. Comments are stripped
   * above, so the marker is found on the RAW source rather than the stripped
   * copy.
   */
```

### scripts/check-invariants.mjs:2943 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE, ASSERTED. An empty parse reports "nothing missing", which is the
   * same output as a correct sitemap. The `// Auth` slice is the specific way
   * this can silently shrink to nothing.
   */
```

### scripts/check-invariants.mjs:2973 (WHY, shortened)

binding kept; 2026-08-28 measurement moved.

```js
/*
   * NO WRITER CAN PRODUCE A `kind = 'page'` ROW, which is what licenses the
   * sitemap having no branch for one.
   *
   * The sitemap used to read `posts` a second time and filter for those rows.
   * Measured against the live database on 2026-08-28: twelve rows, every one
   * `post`. Both writers hardcode the literal, the Worker's in
   * `publish.server.ts` and the build's in `sync-content.mjs`, and rule 18
   * makes `renderAndWrite` the one door to a rendered row. The branch was
   * unreachable and cost a D1 read on every crawl.
   *
   * DELETING A DEAD BRANCH IS ONLY SAFE WHILE THE THING THAT MADE IT DEAD IS
   * STILL TRUE, so this asserts it rather than trusting the measurement to
   * stay taken. A writer that starts inserting a page row fails HERE, naming
   * the sitemap, instead of publishing a page nothing lists.
   *
   * The column keeps the option and the schema keeps its CHECK constraint;
   * what is asserted is that nothing uses it today.
   */
```

### scripts/check-invariants.mjs:2992 (WHY, shortened)

mechanism and hard rule 10 kept; first-draft story and counts moved.

```js
/*
   * WRITTEN AS PRESENCE AND ABSENCE, not as a positional read of the VALUES
   * list, and the first draft WAS the positional read.
   *
   * It failed on its own author: `sync-content.mjs` builds its statement by
   * concatenating template pieces, so the column list and the value list are
   * split across several strings and lining them up by index reported
   * `kind <- undefined`. A parser that has to reassemble SQL out of template
   * fragments is a second SQL parser, which is the thing this file exists to
   * avoid owning.
   *
   * The property is available without one. The column carries a CHECK
   * constraint, `kind in ('page', 'post')`, asserted against the schema by
   * section 4, so a writer can only ever store one of two literals. Each writer
   * containing `'post'` and containing no `'page'` at all is therefore
   * equivalent to "this writer cannot produce a page row", and it survives the
   * statement being reformatted.
   *
   * MEASURED 2026-08-28 THROUGH THIS LOOP: one `INSERT INTO posts` in each
   * writer, two in total, and neither file holds a `'page'` literal.
   *
   * The first draft of this comment said three and two, from an ad-hoc count
   * taken outside the gate with an UNANCHORED needle: `INSERT INTO posts` with
   * no word boundary after it also matches `posts_fts`. The floor written from
   * that number failed on the real scan. Hard rule 10 twice in one assertion,
   * the unanchored needle and the floor arrived at by summing instead of by
   * running, and it is recorded here rather than quietly corrected.
   */
```

### scripts/check-invariants.mjs:3034 (WHY, shortened)

scope reason kept; unasserted count moved.

```js
/*
   * SCOPE, ASSERTED. A needle that stopped matching would report no offending
   * writer, which is what a clean sweep reports. MEASURED 2026-08-28 by running
   * this loop: 5 statements across the two writers.
   */
```

### scripts/check-invariants.mjs:3039 (WHY, shortened)

trimmed.

```js
/*
   * FLOOR EQUALS THE MEASUREMENT here, unusually, and it is the right shape for
   * this one: there are exactly two writers and exactly one statement in each,
   * so what is being floored is "the scan opened both files". Slack would mean
   * one writer could vanish from the list unnoticed, which is the whole failure
   * this assertion exists to make impossible.
   */
```

### scripts/check-invariants.mjs:3070 (CONTRACT, shortened)

assertion and stated gap kept with citations; audit history moved.

```js
/*
 * THE CODE CITES THE RULES BY NUMBER, AND NOTHING CHECKED THE NUMBERS.
 *
 * Fourteen source files say things like "hard rule 10's class" or "hard rule 15
 * makes that file off limits". Until 2026-08-21 the rules lived in Capsid, and
 * **Capsid cannot be gated, because every gate verifies disk.** So the one
 * document the code depends on by number was the one document no assertion
 * could reach, which is the mechanism Grok's audit identified behind a month of
 * stale numbers: `MINIMUM_GATES` was 28 and true while Capsid said 24, 26 and
 * 27 and was false.
 *
 * The rules moved into CLAUDE.md for exactly that reason. This binds them.
 *
 * ## WHAT THIS ASSERTS, and it is the weaker of the two things asked for
 *
 * Every `hard rule N` cited anywhere in the repo resolves to a heading
 * `### N.` in CLAUDE.md. A citation of a number that does not exist fails, and
 * so does renumbering a rule out from under a citation.
 *
 * ## WHAT IT DOES NOT ASSERT, stated because the gap is the interesting half
 *
 * **It does not check that the TEXT a comment attributes to a rule matches the
 * rule.** `check-secrets.mjs` says "hard rule 3 says ..." and paraphrases it;
 * `check-features.mjs` says "hard rule 9's second half". Verifying a paraphrase
 * against a source sentence needs to decide when two English sentences say the
 * same thing, which no regex does and which a wrong answer makes worse than no
 * answer: a gate that green-lights a false paraphrase is more dangerous than
 * one that never looked.
 *
 * So the failure this cannot see is a comment that cites rule 8 correctly and
 * then describes rule 9. That class was real: the August drift audit found
 * three rules FALSE AS WRITTEN across two files. What kills it now is having
 * ONE home rather than two, which removes the copy that drifts, plus this
 * binding on the numbers. The residue is stated rather than closed.
 */
```

### scripts/check-invariants.mjs:3111 (WHY, shortened)

trimmed.

```js
/*
   * NORMALIZED for every structural match, RAW for the size. A needle written
   * with `\n` must not silently miss on a CRLF checkout, and the character
   * count has to be what the machine actually holds.
   */
```

### scripts/check-invariants.mjs:3118 (WHY, shortened)

truncation reason kept; absorption history and dropped-check list moved.

```js
/*
   * ## THE SHAPE ASSERTIONS, ABSORBED FROM check:claude-md ON 2026-08-21
   *
   * Audit tier 4.1 ruled that gate out as prompt hygiene rather than a release
   * gate, and that was right about the GATE and wrong about two of its
   * assertions, for a reason the audit could not have seen: it read the repo on
   * 2026-08-16, when CLAUDE.md POINTED at Capsid for the rules and was 8.5 KB.
   * Since 2026-08-21 the rules ARE this file, so silent truncation now deletes
   * the fifteen hard rules themselves rather than a pointer to them. The stake
   * went UP as the gate was being retired.
   *
   * MEASURED 2026-08-07, which is why the limit is not theoretical: the file
   * was 65,489 characters, 39 percent of it past the boundary, and what sat in
   * that 39 percent was the ENTIRE hard-rules section. Nothing in the harness
   * reports truncation, so a rule that scrolled past the boundary does not
   * exist for that session while reading as present to anyone opening the file.
   *
   * ## WHAT WAS DROPPED RATHER THAN MOVED, and why each one earned it
   *
   * - "CLAUDE.md is not a stub", "has a Hard rules section" and "the section is
   *   not empty" are all subsumed by the rule-count assertion below: a stub, a
   *   missing section and an empty one all parse to zero `### N.` headings.
   * - The CHARACTER-OFFSET check on where the section starts. That gate's own
   *   header recorded it as slack on today's file, and the ordinal check below
   *   is the falsifiable form of the same claim.
   * - The LF-endings pin. `.gitattributes` pins the whole tree, this file is
   *   line-ending agnostic by construction above, and 0 of 256 tracked text
   *   files carried a carriage return when measured on 2026-08-20.
   */
```

### scripts/check-invariants.mjs:3161 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE, ASSERTED. With no headings parsed, `ordinal` is -1 and the check
   * below would fail for the wrong reason, sending a reader to the document
   * instead of to this parser.
   */
```

### scripts/check-invariants.mjs:3183 (WHY, shortened)

needle trap kept.

```js
/*
   * APPEND-ONLY survives; FROZEN does not. Moved with the rest, and it is the
   * one thing stopping a renumber silently retargeting fourteen files'
   * citations. Matched on "append-only" rather than on "frozen", because the
   * sentence recording the 2026-08-21 unfreeze CONTAINS the word frozen and a
   * `/frozen/i` needle would have passed on the commit that falsified it.
   */
```

### scripts/check-invariants.mjs:3201 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE, ASSERTED. An empty `defined` set makes every citation below
   * "unresolved" and the failure would read as fourteen broken comments rather
   * than as one broken parse, which sends the next reader to the wrong file.
   */
```

### scripts/check-invariants.mjs:3206 (WHY, shortened)

floor reasoning and both hard rule 10 citations kept; raise history moved.

```js
/*
   * FLOOR RAISED 15 to 19 ON 2026-08-24, when rules 16 to 19 landed.
   *
   * It is a floor rather than an equality because numbering is APPEND-ONLY: a
   * rule is never removed and never renumbered, so the count only ever rises,
   * and an equality here would fail on the commit that adds a rule rather than
   * on the commit that loses one. A floor left at 15 against 19 defined is four
   * rules that could vanish unnoticed, which is hard rule 10's own
   * over-wide-threshold class sitting in the gate that binds hard rule 10.
   */
```

### scripts/check-invariants.mjs:3228 (WHY, shortened)

list-needle reason and citation kept; discovery story moved.

```js
/*
   * PROSE CITES IN LISTS, so the needle reads a list.
   *
   * `VERIFICATION.md` opens with "Hard rules 7, 10 and 12 in CLAUDE.md are the
   * principles". A `(\d+)` needle sees the 7 and NOTHING ELSE, so two of the
   * three citations in the most-cited sentence in the repo would have gone
   * unchecked while the gate reported a clean pass. Found by widening the walk
   * to the root documents and reading what it actually matched.
   *
   * The list form is bounded deliberately: digits joined by commas and the word
   * "and", nothing else. A greedy run would swallow the sentence after it.
   */
```

### scripts/check-invariants.mjs:3242 (WHY, shortened)

trimmed.

```js
/*
   * THE ROOT DOCUMENTS ARE IN SCOPE, not just source. CLAUDE.md and
   * VERIFICATION.md cite these numbers more than any source file does, and a
   * document that sends a reader to a rule that does not exist fails them in
   * exactly the way a comment does. `sourceFiles` walks code, so the root
   * markdown is named rather than walked.
   */
```

### scripts/check-invariants.mjs:3276 (NUMBER, shortened)

floors asserted in code; measurements and plant story moved.

```js
/*
   * BOTH FLOORS RE-MEASURED 2026-08-24 THROUGH THIS WALK: 247 files scanned,
   * 126 citations found, against floors of 40 and 10.
   *
   * The citation floor was the slack one, by 116. Ten citations is cleared by
   * two files, so the walk could have stopped opening `test/` entirely and this
   * assertion would still have passed while reporting a clean resolve for every
   * citation it never read. That is not hypothetical: PLANTED on 2026-08-24 by
   * dropping `workers` and `test` from the directory list, this walk fell to
   * 203 files and 97 citations, which the old floors passed and the new ones
   * fail. Raised to 230 and 118, margins of 17 and 8, stated as counts because
   * the property that matters is how many can vanish before this notices.
   *
   * MEASURED THROUGH THE WALK, never by counting files on disk. A separate
   * count taken with an ad-hoc directory walk said 129 citations across 65
   * files, and it was answering a different question: this walk skips `.d.ts`
   * and carries `sourceFiles`'s own extension filter, so only what it actually
   * OPENS is in scope. The number that lives in the gate is the number the gate
   * produced.
   */
```

### scripts/check-invariants.mjs:3303 (WHY, shortened)

reason and hard rule 10 kept; first-draft story moved.

```js
/*
   * THE SCOPE CHECK ABOVE CANNOT SEE THE ROOT DOCUMENTS DROP OUT, which is the
   * whole reason they were added. Four files out of two hundred and forty-seven
   * is noise against the scanned floor at any value it could sensibly take, so
   * deleting `rootDocs` would leave VERIFICATION.md unchecked while the gate
   * went on reporting a clean pass: hard rule 10's over-wide-threshold class,
   * one line below a threshold written to catch it.
   *
   * ## WHY ONLY VERIFICATION.md IS REQUIRED TO CITE
   *
   * The first draft required CLAUDE.md to contribute citations too, and it
   * FAILED on clean disk with "CLAUDE.md contributed 0". That was the assertion
   * doing its job against its own author. **CLAUDE.md DEFINES the rules and
   * never cites one**: it carries `### N.` headings, and the phrase "hard rule
   * N" appears in it zero times. It is already covered, by the `defined.size`
   * assertion above, which reads it directly.
   *
   * README.md and RECOVERY.md are scanned and required to cite nothing, because
   * there is no reason they should have to.
   */
```

### scripts/check-invariants.mjs:3342 (CONTRACT, shortened)

contract and both-directions reason kept; rule 6 history and per-rule survey moved.

```js
/*
 * **BINDING A RULE'S TEXT TO WHAT THE CODE DOES, for the subset where that is
 * possible at all.**
 *
 * Section 15 binds every cited NUMBER to a heading that exists. That catches a
 * dangling citation and nothing else, and it says so. It cannot see a rule
 * whose text is simply false, which is what rule 6 was until 2026-08-22: it
 * claimed `content/posts/<slug>.md` was stated once and there were three
 * construction sites. Two separate recovery sessions diffed the rules against
 * their old Capsid text, pronounced them restored, and neither noticed, because
 * a rule can be transcribed perfectly and still be wrong about the code.
 *
 * ## WHY ONLY FOUR
 *
 * Most of the fifteen cannot be bound and pretending otherwise would be worse
 * than leaving them. Rule 5 says so in its own text: it would need a
 * hand-maintained selector list, which is the mirror this repo keeps deleting.
 * Rules 7, 10, 12 and 15 are METHOD, claims about how to work rather than about
 * what the code contains. Rules 1, 2, 3, 9 and 11 cite gates, and asserting a
 * gate exists is close to spelling.
 *
 * Four rules make a crisp, falsifiable claim about the tree:
 *
 *   4   CodeMirror is lazy-split, and client auth is imported by /login alone
 *   6   the post path is stated ONCE, by the exported postPath()
 *   13  two justified substitutions, each marked at its call site
 *   14  drizzle-kit is deliberately absent
 *
 * ## BOTH DIRECTIONS, WHICH IS THE WHOLE POINT
 *
 * Each rule gets a pair: the CLAIM is still in the rule's text, and the CODE
 * still has the property. Asserting only the code lets someone rewrite the rule
 * to say the opposite and stay green. Asserting only the text is spelling. Both
 * together can pass only while the two agree, which is the property section 15
 * was missing.
 *
 * The residue, stated rather than closed: this cannot see a rule rewritten to
 * describe a DIFFERENT true property. It can only see the claim leaving, or the
 * property leaving.
 */
```

### scripts/check-invariants.mjs:3396 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE FIRST. If the extractor stops matching, every claim assertion below
   * reports a missing claim and every code assertion still passes, which reads
   * like four rule defects rather than one broken parser.
   */
```

### scripts/check-invariants.mjs:3448 (WHY, shortened)

rule and shape reason kept; old-login story moved.

```js
/*
   * THE DOOR IS ON THE PUBLIC PLANE, and it was the counter-example to its own
   * rule for as long as it existed.
   *
   * `/login` offered exactly one way in: a `type="button"` whose `onClick`
   * called the Better Auth browser client. With script off it rendered, it was
   * ENABLED, and it did nothing. Meanwhile README declared that every public
   * page works with scripting disabled. Rule 9 is the law, the admin plane
   * behind the door is exempt, and the door itself is not.
   *
   * Asserted on SHAPE rather than on the word "form" appearing somewhere: the
   * old file contained a `<form>`-free button and the new one must contain a
   * submit inside a posting form AND a server action to receive it. A page with
   * the form and no action is a door that 405s.
   */
```

### scripts/check-invariants.mjs:3500 (WHY, shortened)

reason kept; plant story moved.

```js
/*
   * OCCURRENCES, NOT FILES, and the plant is why. The first version filtered
   * files containing the pattern and asserted the count was 1. Reintroducing
   * the exact defect rule 6 describes, a second construction in the SAME file,
   * left it green: one file, one match, assertion satisfied. That is rule 10's
   * own "count matches, not containers" discipline broken inside the gate
   * written to bind rule 6.
   */
```

### scripts/check-invariants.mjs:3526 (WHY, shortened)

exclusion reason and prohibition kept; first-run story moved.

```js
/*
   * THIS FILE IS EXCLUDED, and it is the only exclusion. The failure message
   * above contains the marker phrase, so the scan counted the gate itself and
   * reported three where there are two. A gate matching its own prose is the
   * comment-satisfies-an-assertion class pointing the other way, and it fired
   * on the first run.
   *
   * Excluded by exact path, never by pattern: an exclusion that names a
   * directory would hide a real marker added under it later.
   */
```

### scripts/check-invariants.mjs:3573 (CONTRACT, shortened)

derivation and boundary kept; move history moved.

```js
/*
 * MOVED HERE 2026-08-21 FROM check:hooks, WHICH WAS DELETED.
 *
 * Audit tier 4.1 ruled that gate out: it reads `.claude/settings.json`, cannot
 * see whether a hook RAN, and knows one editor. Accepted for the hooks half.
 * These six assertions arrived in it on 2026-08-20 and were never about hooks;
 * they were put there to avoid adding a twenty-eighth gate for one file, which
 * the gate's own header says out loud. They are the half worth keeping and they
 * belong with the other structural claims about this repo.
 *
 * ## WHAT IS WORTH ASSERTING, and it is narrow on purpose
 *
 * Not the yaml's shape: GitHub validates that, and restating its schema would be
 * a mirror of someone else's parser. What can rot silently and LOCALLY is the
 * DERIVATION. The workflow's value is that it runs `npm run check:ci`, which
 * computes the tier from package.json, so a gate added tomorrow is in CI by
 * default and has to be argued OUT rather than remembered IN. Someone
 * "helpfully" replacing that with a list of gate names would keep CI green, keep
 * it looking thorough, and quietly reintroduce the exact failure check-all.mjs
 * exists about: the next gate is forgotten.
 *
 * Same for the Node version. `.nvmrc` says it and `node-version-file` reads it;
 * a literal `node-version: 24` in the yaml would be a second statement of one
 * fact, which is the mirror class this repo has paid for twice this month.
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT READS A FILE.** It cannot see whether GitHub Actions is enabled on the
 * repository, whether a run was triggered, whether it passed, whether a branch
 * protection rule requires it, or whether someone merged past a red one. A green
 * result here is compatible with CI having never executed once. Only the run
 * itself proves that, and the run is not an artifact this repo contains.
 */
```

### scripts/check-invariants.mjs:3610 (HISTORY, deleted)

first-draft plant story; the why moves to the next line, the limit lives at module scope.

```js
/*
   * COMMENTS STRIPPED BEFORE MATCHING, and this was caught by its own plant.
   *
   * The first draft matched the RAW yaml. Replacing `npm ci` with `npm install`
   * in the run step PASSED, because that step's own comment says "`npm ci` and
   * not `npm install`" and the needle found it there. The assertion was reading
   * prose as though it were configuration.
   *
   * LIMIT, stated: whole-line `#` comments only. A trailing `#` is not
   * attempted, because a naive pass would cut a string containing one, and this
   * is not a yaml parser. A fragment hidden after code on the same line still
   * fires.
   */
```

### scripts/check-invariants.mjs:3623 (WHY, shortened)

dated note replaced by the why from the block above.

```js
// Defined at module scope since 2026-08-29; the limit it states is noted there.
```

### scripts/check-invariants.mjs:3636 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE, ASSERTED. Every match below succeeds trivially against an empty
   * string in the negative direction and fails confusingly in the positive one,
   * so the file being non-trivial is established before anything is read.
   */
```

### scripts/check-invariants.mjs:3672 (WHY, shortened)

binding and floor-not-pin kept; 2026-08-23 drift and audit story moved.

```js
/*
   * THE ENGINES FLOOR IS BOUND TO `.nvmrc`, because it had already drifted.
   *
   * Measured 2026-08-23: `.nvmrc` said 24.14.1 and `package.json` engines said
   * `>=22.22.0`. CI installs the `.nvmrc` version, so a contributor on Node 22
   * satisfied `engines`, installed happily, and ran a DIFFERENT runtime from the
   * one every gate result in CI was produced on. Nothing said so.
   *
   * The 2026-08-22 audit reported this and got both halves wrong: it said
   * ".nvmrc says 22.22.0" (it says 24.14.1) and "local development on 24 would
   * silently differ" (24 is what CI runs; 22 and 23 are what differ). The
   * direction was inverted, which is worth recording because acting on the
   * audit's version would have LOWERED the floor.
   *
   * `package.json` is static JSON and cannot read `.nvmrc`, so the two values
   * are unavoidably a mirror. This assertion is what stops a mirror drifting:
   * it does not care what the version IS, only that the floor equals the pin.
   *
   * A FLOOR rather than an exact pin, deliberately. `"node": "24.14.1"` would
   * refuse to install on 24.14.2, which breaks every contributor on the next
   * Node patch release to buy nothing: the defect was a floor two majors low,
   * not a floor one patch loose.
   */
```

### scripts/check-invariants.mjs:3724 (CONTRACT, shortened)

three properties and boundary kept; incident reference moved.

```js
/*
   * **THE ONLY THING ON THIS SITE THAT REACHES A HUMAN WITHOUT A HUMAN
   * LOOKING.** A failing scheduled run is the alert; GitHub emails the owner.
   *
   * Three properties are asserted and each has a specific way of rotting:
   *
   *   - it EXISTS. Deleting it removes all alerting and nothing else notices,
   *     because the absence of an alert is what health looks like.
   *   - it TARGETS the health route. A workflow polling `/` would pass every
   *     run while the Ask index rotted, which is the 31 July failure exactly.
   *   - its checkout is PINNED BY SHA. A tag is a moving pointer, and this
   *     workflow runs on a schedule with the repository's token.
   *
   * OBSERVATION BOUNDARY: this reads a file. It cannot see whether Actions is
   * enabled, whether a run fired, whether GitHub disabled the schedule after
   * 60 days of inactivity, or whether the owner's notification settings deliver
   * the mail. Every one of those is a silent failure this cannot reach, and the
   * workflow's own header says so at length.
   */
```

### scripts/check-invariants.mjs:3777 (WHY, shortened)

trimmed.

```js
/*
   * SHA-PINNED, asserted POSITIVELY and NEGATIVELY.
   *
   * The positive form alone is satisfiable by adding a pinned action beside a
   * floating one, so the negative half is what actually closes it: no `uses:`
   * line in EITHER workflow may end in a version tag. Scoped to `uses:` lines
   * rather than the whole file, because the prose above them names `@v4` while
   * explaining why it is wrong, and a whole-file match would read that comment
   * as the violation it warns about. Comments are stripped first as well.
   */
```

### scripts/check-invariants.mjs:3819 (CONTRACT, shortened)

class, both rules and boundary kept; audit history and measurements moved.

```js
/*
 * THE TENTH VACUITY CLASS, AND THE ONLY TWO RULES OF check:assertions THAT
 * SURVIVED IT. Moved here 2026-08-21; that gate was deleted in audit tier 4.1
 * as a lint of lints.
 *
 * `assert()` was defined SEVEN times across the gates with FOUR argument orders:
 * three took the condition first, four took the label first. An assertion copied
 * between two of them lands a non-empty STRING in the condition slot. A string is
 * truthy, so it can never fail, and the checks counter still increments, so the
 * gate reports MORE coverage than before it went blind. Both directions were
 * demonstrated on 2026-08-11:
 *
 *   assert(1 === 2, "must fail")  in a label-first gate     -> 98 checks, 0 failures
 *   assert("must fail", 1 === 2)  in a condition-first gate ->  7 checks, 0 failures
 *
 * The class lives in the API surface BETWEEN instruments, where a per-file lint
 * cannot look, which is why nine prior classes and a dedicated lint all missed
 * it. It was found by an external audit and by nothing in this repo.
 *
 * ## WHY BOTH RULES, WHEN THE AUDIT ASKED TO KEEP ONE
 *
 * Tier 4.1 says keep the helper-argument-order check. **That is half the
 * repair, and the deleted gate's own comment recorded which half was missing.**
 * Giving the two shapes two names removes the CAUSE, one name meaning two
 * things. It does not stop someone hand-writing
 *
 *     assert(1 === 2, "AUDIT: a false condition that must fail");
 *
 * in a label-first gate. MEASURED AFTER THE RENAME: still 98 checks, 0 failures.
 * So the condition-position argument is examined directly, and which position
 * that is comes from the helper's own definition rather than being assumed.
 *
 * Dropping the other four rules is the accepted half. (a) literal conditions and
 * (d) unguarded derived RegExps were each written after ONE instance and have
 * caught none since; (b) unscoped whole-document matches was enforced by
 * requiring a `SCOPED-BY` comment, which makes a comment satisfy an assertion
 * about code, a defect class this repo has now paid for three times; and (c) was
 * already skipped as unimplementable by its own author.
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT READS SOURCE TEXT.** It cannot execute a condition to see whether it can
 * vary, and it proves an assertion is not a STRING, never that the expression in
 * that slot is meaningful. `ok("x", page.includes(">Roster<"))` passes here and
 * would still be worthless if `>Roster<` appeared on every page. That judgement
 * stays with whoever writes the assertion.
 */
```

### scripts/check-invariants.mjs:3874 (WHY, shortened)

trimmed.

```js
/*
   * FAILS CLOSED. Zero files is a broken directory read reporting the same
   * clean sweep as a clean repo. Floored well under the real count, because
   * this moves by one whenever a gate is added or deleted and both happen.
   */
```

### scripts/check-invariants.mjs:3899 (WHY, shortened)

trimmed to one line.

```js
// NON-EMPTY SCOPE: no definitions found means the matcher stopped matching
  // and every consistency claim below would be about nothing.
```

### scripts/check-invariants.mjs:3977 (NUMBER, shortened)

floor asserted in code; three re-measurement narratives moved.

```js
/*
   * SCOPE, ASSERTED, and this one is not decoration: the absence check below
   * reports the same clean result whether there are no string conditions or no
   * calls at all. Comments are stripped first, so a stripper that emptied every
   * file would look exactly like a clean repo.
   *
   * MEASURED 2026-08-21 BY RUNNING IT: 347 calls across 39 files. Floored at
   * 300, about 13 percent under. The first draft GUESSED 400 and failed on its
   * own first run, which is this assertion working on its author: a floor set by
   * guess is a floor set above what the scan can actually see, and the failure
   * mode it is written to catch is a scan that shrinks rather than one that
   * stops.
   *
   * **THE PROSE ABOVE HAD GONE STALE AGAINST ITS OWN CONSTANT**, which read 510
   * against a documented 300. Rule 17, in the gate that enforces rule 17. Both
   * are re-measured below and the paragraph is kept because the lesson in it is
   * still the right one.
   *
   * ## RE-MEASURED 2026-08-26, AND THE SCAN HAD BEEN BLIND TO A QUARTER OF ITS
   * ## OWN SUBJECT
   *
   * `stripCommentsAndStrings` blanked strings in three independent regex
   * passes, so two apostrophes inside DOUBLE-quoted labels paired up and the
   * single-quote pass swallowed every line between them. Measured through this
   * gate with the old form planted and proven applied, then with the fix, over
   * the same 44 files:
   *
   *     old three-pass form   595 calls examined
   *     one-pass tokenizer    776 calls examined
   *
   * **181 calls, 23 percent, were invisible.** An assertion inside a swallowed
   * span is never examined, which is the vacuity class this section exists to
   * catch, hiding inside this section's own instrument. It also produced the
   * false positive that found it: a boolean condition reported as a string
   * literal because the survivor's argument list had been corrupted.
   *
   * ## AND AGAIN 2026-08-28, IN THE OTHER HALF OF THE SAME MODULE
   *
   * That fix landed in `stripCommentsAndStrings` alone. It CALLS
   * `stripComments`, which still removed comments with a regex, so a `/`
   * followed by a star inside a string literal opened a comment running to the
   * next star-slash anywhere in the file. Measured at HEAD: 347 string literals
   * across 37 files carry one of those sequences.
   *
   * Re-measured through this gate, over the same 44 files:
   *
   *     regex comment stripper   763 calls examined
   *     one shared tokenizer    1284 calls examined
   *
   * **521 more, forty percent of the current total, were invisible.** Every one
   * of the sixteen files whose count changed GAINED; none lost. The largest was
   * `check-features.mjs`, which showed ONE call and shows all of its own.
   *
   * The second half was found by the DIFFERENTIAL rather than by reading:
   * fixing `stripComments` alone made things worse in one file, because the two
   * functions disagreed about regex literals. They are one tokenizer now.
   *
   * Floored at 1117, about 13 percent under 1284, the same proportion the
   * 2026-08-21 entry chose.
   */
```

### scripts/check-invariants.mjs:4044 (WHY, shortened)

reason kept; date moved.

```js
/*
   * PRINTED, since 2026-08-28, because this number is the one the floor above
   * is set from and it was only ever reachable by editing the gate to log it.
   * A floor whose measurement cannot be taken without a temporary edit is a
   * floor that gets re-derived by arithmetic, which is how the prose above went
   * stale against its own constant.
   */
```

### scripts/check-invariants.mjs:4066 (CONTRACT, shortened)

binding and boundary kept; consolidation history moved.

```js
/*
 * A CHECKLIST THAT LOST ITEMS ONCE ALREADY.
 *
 * The DNS cutover steps lived inside current-state paragraphs in Capsid's
 * core.md, and the 2026-08-21 consolidation that cut that file by 87 percent
 * deleted most of them. They survived only in version history. The audit that
 * found it named the mechanism exactly: **the cut asked "is this a number the
 * repo also knows?" and bindings had been filed inside status prose**, so a
 * question that was right for status was wrong for rules.
 *
 * They are in `CUTOVER.md` now, and this is what stops the same thing happening
 * again: an item cannot be dropped from that file without failing here.
 *
 * ## THE ORIGIN IS BOUND, NOT JUST NAMED, and that is the half with teeth
 *
 * Keyword presence proves an item is still WRITTEN. It cannot prove the document
 * is still TRUE. `SITE_ORIGIN` is the one item whose truth is checkable from the
 * repo: the document names the current value, and it is read out of
 * `app/lib/seo.ts` rather than restated. **On the day the origin changes, this
 * goes red until the checklist follows**, which is the same shape as
 * `check:llms` binding the llms.txt contact URL, and it fires on exactly the
 * event the checklist exists for.
 *
 * ## OBSERVATION BOUNDARY
 *
 * **It reads two files.** It cannot tell whether any step was PERFORMED, whether
 * the zone is still gray-clouded, whether the Web Analytics auto-install is
 * still armed, or whether a Google redirect URI exists. Every one of those lives
 * in a Cloudflare or Google console, not in this repo. A green result here means
 * the checklist is complete and its one machine-checkable fact agrees with the
 * code; it means nothing at all about the state of the world.
 */
```

### scripts/check-invariants.mjs:4105 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE, ASSERTED. Against an empty or truncated file every keyword check
   * below fails at once and the report would read as nine missing steps rather
   * than as one missing document.
   */
```

### scripts/check-invariants.mjs:4117 (WHY, shortened)

trimmed.

```js
/*
   * EVERY ITEM THE CONSOLIDATION DELETED, one assertion each, named rather than
   * counted. A count would let one item be swapped for another; a name cannot.
   * The needle is the distinctive token, not the sentence, so the prose stays
   * the writer's.
   */
```

### scripts/check-invariants.mjs:4137 (WHY, shortened)

anchoring reason and hard rule 10 kept; plant and audit story moved.

```js
/*
     * The HSTS revisit. `workers/app.ts` has said "revisit for the apex at DNS
     * cutover" since 2026-08-06 and this checklist did not carry the step, so
     * the instruction pointed at a document that had never heard of it.
     *
     * ## ALL THREE NEEDLES ARE ANCHORED, and the first draft of this was not
     *
     * Written as bare `/includeSubDomains/` and `/preload/i`, and the plant that
     * was supposed to prove it worked went GREEN: renaming the token to
     * `includeSubDomainsXX` still matched, because an unanchored needle matches
     * any string that merely CONTAINS it. That is hard rule 10's unanchored-
     * needle class, caught by planting rather than by reading, which is the
     * whole argument for planting.
     *
     * `\b` on both sides fixes that case. The preload needle gets a different
     * repair, because `preload` is a word this repo will plausibly use again:
     * `<link rel="preload">` on an LCP image is an open suggestion in the
     * 2026-08-22 audit, section 11. A bare match would then be satisfied by an
     * unrelated sentence while the HSTS decision had been deleted. So it is
     * required to appear WITHIN the HSTS step rather than anywhere in the file.
     */
```

### scripts/check-invariants.mjs:4173 (WHY, shortened)

trimmed.

```js
/*
   * THE BINDING. Two independent sources: the value the code uses, and the value
   * the checklist tells an operator to change.
   */
```

### scripts/check-invariants.mjs:4198 (CONTRACT, shortened)

assertions, sha exclusion and boundary kept.

```js
/*
 * THE PAGE'S VALUE IS THAT IT IS SHORT, so its length is asserted.
 *
 * Every shape on it was already written down, at length, when it happened
 * again. The problem was never that the incidents went unrecorded; it was that
 * a pile of stories is not findable and a list is. A page that grows back into
 * stories has become the thing it was written to replace, and nothing else in
 * this repo would notice.
 *
 * ## WHAT IS ASSERTED
 *
 * A ceiling on bytes and on the number of shapes, so growth is a deliberate
 * diff rather than drift. Every shape carries a CITATION. And CLAUDE.md points
 * at the page, because a page nobody reads is precisely the failure it exists
 * to prevent.
 *
 * ## PATHS ARE RESOLVED; COMMIT SHAS ARE NOT, and the reason is CI
 *
 * A path citation is checked against disk, so a shape pointing at a file that
 * has been moved or deleted fails here. A commit sha is NOT resolved, because
 * `actions/checkout@v4` clones at depth 1 and the shas cited are older than
 * that, so `git cat-file` would fail in CI for a reason that has nothing to do
 * with the citation being right. Asserting it locally and not in CI would mean
 * a gate that passes in the place it is reviewed and fails on one machine.
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT CANNOT READ THE SHAPES.** It cannot tell whether a line states a real
 * failure mode, whether the citation supports the claim, or whether two shapes
 * are the same shape written twice. It counts, measures and resolves paths.
 * Whether the page is any GOOD is a human judgement and always will be.
 */
```

### scripts/check-invariants.mjs:4237 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE, ASSERTED. An empty or truncated file parses to zero shapes, and
   * every per-shape assertion below would then pass by iterating nothing.
   */
```

### scripts/check-invariants.mjs:4254 (NUMBER, shortened)

limits asserted in code; 2026-08-21 measurement moved.

```js
/*
   * THE CEILING, and it is the whole point rather than tidiness. Measured
   * 2026-08-21 at 3,567 bytes and 16 shapes. The limits are roughly 60 percent
   * headroom, so ordinary additions land and a page that has started telling
   * stories does not.
   */
```

### scripts/check-invariants.mjs:4276 (WHY, shortened)

trimmed.

```js
/*
   * EVERY SHAPE CITES SOMETHING. A shape with no citation is an assertion about
   * this repo that a reader cannot check, which is the genre of claim this whole
   * page exists to distrust.
   */
```

### scripts/check-invariants.mjs:4303 (WHY, shortened)

prefix rule kept; first-run story moved.

```js
/*
   * PATHS RESOLVE. Not shas: see the header. A cited path that has moved makes
   * the shape unfollowable, and this repo moves files.
   *
   * A `capsid:` prefix marks a citation that lives in the MCP store and is NOT
   * on disk. Those are skipped here, and the prefix is required rather than
   * inferred: this section FAILED on its own first run over a bare
   * `dustinedwards/decisions-vol-7.md`, and inferring "looks like a namespace,
   * skip it" would have silently exempted any repo path that had been deleted.
   * Making the author mark it also tells the READER the citation needs the MCP.
   */
```

### scripts/check-invariants.mjs:4333 (WHY, shortened)

trimmed.

```js
/*
   * REACHABILITY. The page's own thesis is that a recorded lesson nobody meets
   * is not recorded, so the pointer is asserted rather than assumed.
   */
```

### scripts/check-invariants.mjs:4347 (CONTRACT, shortened)

assertion and limit kept; 2026-08-21 measurement moved.

```js
/*
 * THE ONE LOADER NOBODY MARKED WAS THE EXPENSIVE ONE.
 *
 * MEASURED 2026-08-21: `/admin/posts.data` cost 1,420ms median with NOT ONE
 * `timed()` call, while its two D1 queries measure 0.33 to 0.47ms IN D1. About
 * 1,400ms was unattributed. Three separate fixes had landed on the admin
 * LAYOUT, which was the only thing instrumented, and each moved roughly 90ms
 * while the real cost sat one file away with no name.
 *
 * Of fifteen admin route files, TWO carried marks: the layout and the media
 * index. This section is what stops the next one hiding for a month.
 *
 * ## WHAT IS ASSERTED
 *
 * Every `app/routes/admin*` file that exports a `loader` contains at least one
 * `timed(` call, or is named below with a reason.
 *
 * ## WHAT IT CANNOT SEE, and it is the honest half
 *
 * **It counts a CALL, not COVERAGE.** A loader with six awaits and one
 * `timed()` passes here while five of them stay invisible, which is exactly the
 * state `admin.posts.$slug.edit.tsx` was in before this session. Proving every
 * await is wrapped needs to decide which expressions are I/O, which is a
 * parser's job and not a regex's. The floor this sets is "somebody thought
 * about it", and the breakdown SUMMING is what proves coverage; that check is a
 * measurement, not a gate, because it needs a live request.
 */
```

### scripts/check-invariants.mjs:4401 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE, ASSERTED. A glob that stopped matching would report every admin
   * loader instrumented by finding none, which is this repo's most repeated
   * defect class.
   */
```

### scripts/check-invariants.mjs:4443 (WHY, shortened)

trimmed.

```js
/*
   * THE EXEMPTIONS POLICE THEMSELVES, both directions: an entry naming a file
   * that no longer exists exempts nothing, and one naming a file that HAS since
   * gained a timed() call is a stale excuse rather than a standing decision.
   */
```

### scripts/check-invariants.mjs:4466 (HISTORY, deleted)

detached floor re-measurement log; the floor and its why live at the end of the file.

```js
/*
 * EXECUTED-COUNT FLOOR.
 *
 * This gate is EIGHT sections numbered 1 to 9 with 5 REMOVED, several of which
 * are wrapped in try blocks that
 * report a failure and continue, and two of which change shape with --remote.
 * A section that stops running is therefore the most available failure here,
 * and it is invisible: the remaining sections still pass and the total is the
 * only witness.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-16 by RUNNING it: 102
 * offline, AFTER section 5 was removed. Never summed. It was 84 against a floor
 * of 80, then 85 when the draft preview reader took a second visibility
 * exemption, then 105 when section 9 landed with the media trash predicate, its
 * restore round trip and the permanent-delete guard.
 *
 * DELETING SECTION 5 COST THREE ASSERTIONS, 105 to 102, and that ratio is the
 * argument for the deletion rather than against it: 499 lines and a scan
 * reporting 246 column references produced three checks, and the scan could
 * desync on a regex literal and examine nothing while printing the same three.
 *
 * Floored at 97, slack of five, UNCHANGED. The drop is absorbed by the existing
 * slack deliberately: lowering the floor to match would hide the next section
 * that stops running, which is the failure this floor exists for.
 *
 * RE-MEASURED 2026-08-20 by RUNNING it: 105 offline, after section 10 added its
 * three assertions. Floor 97 to 100, slack of five held. Section 10 is three
 * assertions over a walk of every route file, so a walk that stopped finding
 * files would drop the count by three and the floor is what notices.
 *
 * RE-MEASURED AGAIN 2026-08-20 by RUNNING it: 113, after section 11's eight.
 * Floor 100 to 108, slack of five held. Section 11 extracts two function bodies
 * and walks the mutators of one module, so an extractor that returned "" would
 * drop several at once; three of its eight assertions exist to catch exactly
 * that and the floor catches the section vanishing whole.
 */
```

### scripts/check-invariants.mjs:4504 (WHY, shortened)

order property and scoping kept; audit reference moved.

```js
/*
 * **THE ORDER IS THE SAFETY PROPERTY, and it is invisible at a glance.**
 *
 * The repo is the source of truth and D1 is a derived index, so `savePost`
 * commits first and converges the index second. That order is what makes a
 * failure survivable in the direction that matters: a D1 failure AFTER the
 * commit leaves writing safe in git and an index that a rebuild repairs, while
 * a D1 write BEFORE the commit would leave the database describing a post that
 * exists on no commit, with nothing to rebuild from.
 *
 * The 2026-08-22 audit read this as the defect. It is not; "with no record" was
 * the defect and is fixed in `converge.mjs`. This section exists so that a
 * later edit reordering the two, which would look like a harmless tidy, fails
 * instead.
 *
 * SCOPED TO THE FUNCTION BODY, extracted by brace matching rather than a
 * character window, because a window reaches into the next function and this
 * file has several that touch both stores. Comments are stripped first: the
 * prose above `syncPostToD1` in the route names both calls while explaining
 * their order, and a whole-file scan would read that as code.
 */
```

### scripts/check-invariants.mjs:4542 (WHY, shortened)

trimmed to one line.

```js
// Brace matching from the first { after the signature, so the body cannot
    // spill into commitMessage() or syncAskForPost() below it.
```

### scripts/check-invariants.mjs:4587 (WHY, shortened)

trimmed.

```js
/*
   * THE OTHER DIRECTION: no bare D1 write in front of the commit. The ordering
   * assertion above only compares the two calls it knows about; this catches a
   * NEW write being added earlier, which is how the property would actually be
   * lost.
   */
```

### scripts/check-invariants.mjs:4602 (WHY, shortened)

one-owner reason and both directions kept; 2026-08-25 history moved.

```js
/*
   * THE MEDIA-REF DEDUP KEY HAS ONE OWNER, and until 2026-08-25 it did not.
   *
   * `mediaRefKey` carries the whole correctness argument for a NUL separator
   * and `test/media-ref-key.test.mjs` proves it, but the LIVE writer joined on
   * a SPACE and the helper's only caller was `replaceMediaRefsForSource`, which
   * had no caller at all and has since been deleted. The rule was written, tested, and attached to nothing
   * that ran; the tests stayed green with the defect in place, all 441 of them,
   * which is why this assertion is here and not another test.
   *
   * A printable separator merges two distinct refs, so a post citing two images
   * records one, the refcount is short, and the media delete guard can then let
   * a still-cited blob go. That is the failure this binds shut.
   *
   * BOTH DIRECTIONS, because either alone is satisfiable by the defect: the
   * helper must be CALLED, and the body must carry no template join of the
   * three parts. An `import` on its own would pass a check for the name only.
   */
```

### scripts/check-invariants.mjs:4668 (CONTRACT, shortened)

two-halves contract kept; argument trimmed.

```js
/*
 * THE FRONT PAGE MAKES THREE NUMERIC CLAIMS, and rule 17 says each belongs to
 * the instrument that measures it. Nothing owned that until this section: the
 * home route could have carried `<span>25</span>` and every other gate in this
 * repository would have stayed green, because no instrument reads the home
 * page's source and no fixture renders it.
 *
 * That matters more here than almost anywhere else on the site. These tiles are
 * the site's argument that it measures itself, so a hand-typed digit in one is
 * not a stale number, it is a false claim made in the exact place the claim is
 * being advertised.
 *
 * TWO HALVES, because either alone is satisfiable by a defect:
 *
 *   1. Each source is READ. The gate count comes from the stack artifact, the
 *      health verdict from `runHealthChecks`, the post count from the listing.
 *   2. The rendered tile block carries NO NUMERIC LITERAL. A loader that reads
 *      all three correctly and then renders a typed digit passes (1) completely.
 *
 * COMMENT-STRIPPED, because this file's own prose is full of digits and the
 * docblock above the loader legitimately discusses `s-maxage=600`.
 */
```

### scripts/check-invariants.mjs:4707 (WHY, shortened)

invariant kept; 2026-08-26 needle move and timings moved.

```js
/*
   * THE NEEDLE MOVED WITH ITS SUBJECT, 2026-08-26. It read `runHealthChecks(`,
   * which was correct while the loader ran the suite and is the exact call
   * that was removed: the front door was rendering at origin in 1.07 to 3.48 s
   * against 0.32 to 0.90 s for /blog, because it ran the whole health suite
   * before its first byte.
   *
   * The invariant is UNCHANGED and is the same one it always was: this tile
   * REPORTS a measurement and never states one. What changed is where the
   * measurement comes from, so the needle names the reader rather than the
   * runner. `readHealthTile` is the only way to reach the stored verdict, and
   * it cannot compute one: `snapshot.server.ts` has one writer and it is
   * `/api/health`.
   *
   * The negative is asserted too, and it is the half that keeps this honest. A
   * loader that read the snapshot AND ran the suite would satisfy the positive
   * completely while costing exactly what the change was made to stop paying.
   */
```

### scripts/check-invariants.mjs:4738 (WHY, shortened)

invariant kept; ruling 57 needle history moved.

```js
/*
   * THE COUNT COMES FROM A COUNTING QUERY, and this needle moved with ruling 57.
   *
   * It was `/listing\.total/`, which named the variable `listBlogPosts` was
   * assigned to. Ruling 57 replaced that call: home no longer pages four posts
   * and hopes the featured one is among them, it asks `listHomeStartHere` for
   * the featured post, the newest others and the total in one batch, so the
   * binding is now `start.total`.
   *
   * WHAT IS BEING ASSERTED is unchanged, and restating it matters because the
   * old needle read like a claim about a variable name: the tile must count
   * through a QUERY that composes `publiclyVisible()`, never from a literal and
   * never from the length of whatever page happened to be fetched.
   * `listHomeStartHere` composes `isBlogPost()`, which composes
   * `publiclyVisible()`, in all three of its statements.
   *
   * Both spellings are accepted rather than only the new one, because this is a
   * property of where the number comes from; pinning it to one variable name is
   * what made a correct change read as a violation.
   */
```

### scripts/check-invariants.mjs:4767 (WHY, shortened)

trap kept, trimmed.

```js
/*
   * THE TILE BLOCK, extracted by its own element rather than by a character
   * window. A window around an anchor reads its neighbour's compliance, which
   * this repo has been bitten by; the section element bounds the scan to the
   * markup that makes the claims.
   */
```

### scripts/check-invariants.mjs:4781 (WHY, shortened)

needle intent kept, trimmed.

```js
/*
   * A DIGIT IN THE MARKUP IS THE DEFECT. `String(gates)` is fine, `>25<` is
   * not. The needle looks for a number sitting as rendered text or as a
   * complete attribute value, which is the shape a hand-written tile takes,
   * and deliberately ignores digits inside identifiers like `h2` or `sha256`.
   */
```

### scripts/check-invariants.mjs:4801 (CONTRACT, shortened)

composition contract kept; artifact arc history moved.

```js
/*
 * THE DOOR'S COMPOSITION, since the artifact arc. The committed artifact's
 * byte gate used to catch a writer that dropped a derived table, because the
 * artifact carried the records and sync-content wrote them wholesale. With
 * D1 as the only rendered copy, `renderAndWrite` -> `syncPostToD1` is the
 * live writer for a post's row, its search records, its media refs and the
 * FTS rebuilds, and NOTHING ELSE verifies that batch's composition: a
 * dropped `searchStatements` spread would ship a save path whose posts stop
 * entering search, silently, until the next bulk sync papered over it.
 *
 * Source assertions, comments stripped, same instrument shape as section 21.
 * They see a spread ABSENT, not a spread present and wrong; the statement
 * bodies are bound to the schema by section 4 and exercised live by the
 * operator round trip.
 */
```

### scripts/check-invariants.mjs:4902 (CONTRACT, shortened)

scope and blind spots kept; dated arc narrative moved.

```js
/*
 * THE DEFECT CLASS THE UNHYDRATION ARC CREATES (2026-08-26). A public route
 * ships no framework script, so a `useState` in its tree renders once on the
 * server and then NOTHING: no re-render, no effects, no fetchers. The code
 * compiles, the page renders, every gate that reads markup stays green, and
 * the behaviour the hook implemented simply does not exist in the browser.
 * Dead code that looks alive, found only by clicking.
 *
 * So: an unhydrated route module and every module it transitively imports may
 * not import state or lifecycle hooks from "react", nor the client hooks from
 * "react-router" (useFetcher, useNavigation, useSubmit, useNavigate).
 * Render-time hooks (useLoaderData, useRouteLoaderData, useMatches, Link and
 * friends) are deliberately allowed: they resolve during the server render
 * and are exactly what an unhydrated tree is built from.
 *
 * WHAT THIS SEES AND DOES NOT: it reads IMPORT CLAUSES, comments stripped and
 * `import type` ignored. A hook imported and unused still fails, which is the
 * point (the import is the lie). A hook reached through a namespace import
 * (`React.useState`) or re-exported under another name is invisible here;
 * neither shape exists in app/ today and the browser gate's enhancement cases
 * are the behavioural backstop.
 *
 * The unhydrated set is DERIVED: every route file minus the ones carrying
 * `hydrate: true` and minus the admin children, which hydrate through their
 * layout's flag (route nesting in this repo is the admin.* filename prefix
 * and nothing else). check:page-payload pins the flag set to exactly
 * {admin.tsx, login.tsx}, so a third hydrating root fails THERE by name
 * before this derivation could quietly widen.
 */
```

### scripts/check-invariants.mjs:5045 (CONTRACT, shortened)

binding contract kept; 2026-08-29 subject move and measurement moved.

```js
/*
 * RULE 17, SATISFIED BY BINDING RATHER THAN BY DELETION.
 *
 * `HEALTH_POLL_INTERVAL_SECONDS` in app/lib/health/snapshot.mjs is a SECOND
 * statement of the watchdog's schedule. It cannot be derived away: a Worker
 * cannot read another Worker's config, and the home tile needs the number at
 * request time to decide whether a snapshot is worth showing.
 *
 * So the two are compared instead. The cron is PARSED rather than matched as a
 * string, because a step form and an equivalent explicit list are the same
 * schedule and a string compare would fail on a legal rewrite while passing on
 * a cron that means something else entirely.
 *
 * ## THE SUBJECT MOVED 2026-08-29, AND THAT IS THE WHOLE EDIT
 *
 * This used to parse `.github/workflows/health.yml`, which was correct while
 * that workflow was the only thing polling. It is not any more. The GitHub
 * schedule was MEASURED firing 2 times in a day against 96 expected, so
 * `workers/watchdog.ts` took over the fifteen-minute poll and health.yml
 * dropped to hourly as the off-platform second opinion. Leaving this pointed at
 * health.yml would have bound the tile's staleness rule to the SLOWER of the
 * two watchers and called every current snapshot stale for most of each hour.
 *
 * ## WHY THE EXAMPLE AND NOT THE REAL CONFIG
 *
 * `wrangler.watchdog.jsonc` is gitignored, so a clean checkout has one only
 * because `postinstall` copied it. The tracked example is always present and
 * always readable, which keeps this gate honest in CI. The other half of the
 * chain, that the real config agrees with its example, is `check:config`'s and
 * is asserted there in both directions. One link per gate, no link unowned.
 *
 * WHAT GOES WRONG WITHOUT THIS. Slow the watchdog to hourly and the constant
 * still says fifteen minutes, so the tile calls a perfectly current snapshot
 * stale forty five minutes into every hour and tells readers the check has
 * stopped. Speed it up and the tile calls a genuinely dead watchdog fresh. The
 * failure is silent in both directions and it is a lie on the front page.
 */
```

### scripts/check-invariants.mjs:5095 (WHY, shortened)

trap kept, trimmed.

```js
/*
   * PARSED AS JSONC, not matched with a regex. This file is mostly prose and
   * its comments discuss the schedule at length; a needle for a cron string
   * would happily match the sentence explaining what the cron must not be. A
   * comment has both satisfied an assertion and failed one in this repository.
   */
```

### scripts/check-invariants.mjs:5130 (CONTRACT, shortened)

doc trimmed.

```js
/**
   * The cron's period in seconds, or null when it is not a fixed period.
   *
   * Handles the two forms that mean "every N minutes": a step and an
   * explicit evenly spaced list (`0,15,30,45`). Anything else returns null and
   * fails loudly rather than being coerced into a number.
   */
```

### scripts/check-invariants.mjs:5166 (WHY, shortened)

trimmed.

```js
// Evaluated rather than string-matched, so `15 * 60` and `900` are the same
  // answer. The needle above admits only digits, spaces and `*`, so this is
  // arithmetic on a bounded character set and never arbitrary source.
```

### scripts/check-invariants.mjs:5190 (WHY, shortened)

intent kept; commit narrative moved.

```js
/*
   * THE SNAPSHOT MODULE MUST NAME THE WATCHDOG, NOT THE WORKFLOW.
   *
   * The constant's own docblock says where its second statement lives, and that
   * sentence is what a reader follows when the two disagree, and it named
   * health.yml until this commit. That pointer is rule 17's tense-bound state
   * claim waiting to happen: prose about a mechanism, written true, left
   * standing after the mechanism moves. It is updated in the same commit as the
   * schedule and gated here so the next move cannot leave it behind.
   */
```

### scripts/check-invariants.mjs:5209 (WHY, shortened)

prohibition kept, trimmed.

```js
/*
   * AND HEALTH.YML MUST NOT BE ON THE SAME SCHEDULE.
   *
   * Not a style rule. If somebody restores the workflow to a fifteen-minute step the two
   * watchers poll together, which doubles the load on a rate-limited endpoint
   * for no extra coverage, and it re-creates the ambiguity this section just
   * resolved about which cron the tile is measured against. Hourly or slower is
   * the ruling; this asserts the direction rather than the exact value, because
   * the exact value is health.yml's business and the constraint is that it is
   * NOT the watchdog's.
   */
```

### scripts/check-invariants.mjs:5241 (WHY, shortened)

trimmed.

```js
/*
   * The stale threshold is DERIVED from the interval in the module, not typed.
   * Asserted here because the whole binding above is worth nothing if a later
   * edit replaces the multiplication with a literal that happens to agree today.
   */
```

### scripts/check-invariants.mjs:5256 (WHY, shortened)

trimmed.

```js
/*
   * ONE WRITER. The reason the home page is fast is that nothing on it can
   * start a health run, and that property lives in the module boundary rather
   * than in anybody remembering it.
   */
```

### scripts/check-invariants.mjs:5275 (CONTRACT, shortened)

both-directions contract kept; consolidation story moved.

```js
/*
 * THE FACT THAT HAD NO OWNER, GIVEN ONE. 2026-09-04.
 *
 * CLAUDE.md carries the binding NAMES, because a session has to recognise `DB`
 * and `APP_KV` before it can read anything that uses them, and that is what
 * this file is for. Until today it carried the names AND a description of each,
 * which was a hand-maintained second copy of `wrangler.jsonc.example` with
 * nothing comparing them: rule 17's own defect, in the file that states rule 17.
 *
 * The consolidation pass had two options for it, remove or gate. Removing the
 * names would cost a session the vocabulary; the descriptions were the half
 * that rots, so those went to the example and the names stay here, bound.
 *
 * ## BOTH DIRECTIONS, because one direction is the useless one
 *
 * A binding added to the config and not to CLAUDE.md is the likely miss. A
 * binding removed from the config while CLAUDE.md still advertises it is the
 * dangerous one: it sends a session to `getEnv(context).OLD_THING`, which
 * typechecks against a stale generated type and is undefined at runtime.
 *
 * ## WHY IT PARSES THE EXAMPLE AND NOT THE REAL CONFIG
 *
 * `wrangler.jsonc` is gitignored and exists on one machine, so a gate reading
 * it could not run in CI or on a fresh clone. `check:config` already binds the
 * example to the real file in both directions on the one machine that has both,
 * so the chain is complete without this gate needing the secret half.
 */
```

### scripts/check-invariants.mjs:5307 (WHY, shortened)

anchor reason kept, trimmed.

```js
/*
   * The names CLAUDE.md advertises, from the one indented line that lists them.
   * Anchored on the `getEnv` sentence above it rather than on a bare scan for
   * capitals, so prose mentioning a binding by name cannot widen the set.
   */
```

### scripts/check-invariants.mjs:5318 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE, ASSERTED, and this is the assertion that stops the rest being
   * vacuous: an empty set makes "every listed binding exists" trivially true.
   */
```

### scripts/check-invariants.mjs:5329 (WHY, shortened)

trimmed.

```js
/**
   * Every binding the example declares, by the two keys wrangler uses. Derived
   * from the config rather than named here, so a NEW KIND of binding appears in
   * this set without anybody editing this gate.
   */
```

### scripts/check-invariants.mjs:5363 (WHY, shortened)

method and hard rule 10 citations kept; dated re-measurements moved.

```js
/*
 * RE-MEASURED 2026-08-23 BY RUNNING IT: 226 offline.
 *
 * **THIS FLOOR HAD GONE STALE BY 66 AND ITS MESSAGE BY 142.** The constant read
 * 160 while the gate ran 226, and the failure text it would have printed said
 * "Measured: 84 offline", a number from several sections ago. A floor 66 under
 * the truth cannot fail on anything short of a catastrophe: three whole
 * sections could stop running and the count would still clear it, which is the
 * unfailable-condition class in hard rule 10, in the gate that enforces hard
 * rule 10.
 *
 * The same drift was found in `check:headers` on the same day, where the floor
 * read 99 against a measured 143. Two independent instances of one shape, and
 * the shape is this: a floor is raised when a section lands and then never
 * again, so it decays every time an existing section grows an assertion. Both
 * are now re-measured by RUNNING the gate, which is the only method that would
 * have caught either.
 *
 * Floor 160 to 214. RE-MEASURED AGAIN 2026-08-23 after the engines binding
 * landed: 228, so the margin is 14, about six percent. Stated as a margin
 * rather than a percentage because the property that matters is how many
 * assertions can vanish before this notices, and that is a count.
 *
 * RE-MEASURED 2026-08-25 by RUNNING the gate after section 22 and the tools
 * timing exemption landed: 247. Floor 214 to 233, margin held at 14, which is
 * the same count of vanishing assertions this gate could previously absorb.
 * Section 22 is 6 assertions, so losing it whole still fails.
 */
```

### scripts/check-invariants.mjs:5391 (HISTORY, deleted)

dated re-measurement log.

```js
/*
 * RE-MEASURED 2026-08-25 by RUNNING the gate after the artifact arc's phase 2:
 * section 10 deleted, section 23 added, four visibility exemptions gained
 * their reverse checks. 260 executed. Floor 237 to 246, holding the margin at
 * 14, the same count of vanishing assertions this gate has historically been
 * allowed to absorb.
 *
 * RE-MEASURED 2026-08-26 by RUNNING it after section 24 (no client hooks in
 * an unhydrated tree) landed with the unhydration arc: 264 executed. Floor
 * 246 to 250, margin 14 held.
 *
 * RE-MEASURED 2026-08-26 by RUNNING it after section 25 (the health snapshot's
 * poll interval) landed and section 22's health needle followed its subject:
 * 272 executed. Floor 250 to 258, margin 14 held.
 *
 * RE-MEASURED 2026-08-29 by RUNNING it after section 25's subject moved from
 * the GitHub workflow's cron to the watchdog Worker's, gaining four assertions
 * (the config parses, the snapshot module's prose points at the new owner, the
 * workflow still declares one cron, and that cron is SLOWER than the
 * watchdog's): 292 executed. Floor 258 to 278, margin 14 held.
 *
 * The step from 272 to 292 is larger than those four, and that is worth a line
 * rather than a shrug: the 2026-08-28 prose sweep grew other sections after the
 * 272 reading was taken, so 272 was already a stale observation before this
 * change touched anything. Which is the whole reason this number is re-measured
 * through the gate's own pipeline and never adjusted by arithmetic.
 * RE-MEASURED 2026-09-04 by RUNNING it after the CLAUDE.md consolidation and
 * section 26: 296. Floor 278 to 282, margin held at 14. Section 26 is 4
 * assertions, so losing it whole still fails.
 */
```

### scripts/check-invariants.mjs:5421 (HISTORY, deleted)

dated measurement and incident.

```js
/*
 * ONE FLOOR PER BRANCH, measured 2026-09-06 by RUNNING both: 299 offline, 338
 * with --remote, which adds the live-database comparison. Each is its count
 * minus the check:floors tolerance at that count.
 *
 * A single floor here read 284 against the remote branch's 338, a gap of 54
 * against a tolerance of 17, and nothing saw it until check:floors started
 * reading check:all's run (where this gate runs --remote) rather than running
 * it bare. Same shape as check:contrast's build-absent floor.
 */
```

### scripts/check-invariants.mjs:5431 (HISTORY, deleted)

dated re-measurement.

```js
/*
 * RE-MEASURED 2026-09-06 by RUNNING both branches after section 3 gained the
 * placeholder comparison (12 assertions, 6 srcs times two): 305 offline, 344
 * remote. Floors 284 to 290 and 321 to 328, each its count minus the
 * check:floors tolerance at that count.
 */
```

### scripts/check-invariants.mjs:5439 (CONTRACT, shortened)

both-directions contract and needle kept; prompt and RECOVERY.md history moved.

```js
/*
 * THE 2AM PAGE IS BOUND TO THE SECRET LIST, 2026-09-08.
 *
 * `docs/RUNBOOK.md` carries a rotation table: for each secret, where else it
 * lives and what breaks if you rotate it and stop. That table is exactly the
 * kind of hand-maintained mirror rule 17 exists to refuse, and RECOVERY.md has
 * already demonstrated the failure twice: its secrets section said "Seven" for
 * eight days after `ANALYTICS_READ_TOKEN` landed, and said "eight" while the
 * ratified list held nine. Prose counts read nothing.
 *
 * ## THE OWNER IS `REQUIRED_SECRETS`, NOT `wrangler.jsonc.example`
 *
 * The prompt that asked for this gate said to assert the runbook names every
 * secret in `wrangler.jsonc.example`. MEASURED 2026-09-08: that file contains
 * ZERO of the nine names, and cannot contain any, because a secret has never
 * lived in wrangler config and RECOVERY.md section 7 records that as a
 * property worth stating. The file holds BINDINGS, which is section 26's
 * subject. The owner of the secret list is `app/lib/secrets.mjs`, which
 * `check:secrets` already treats as ratified rather than derived.
 *
 * ## BOTH DIRECTIONS
 *
 * A secret added to the list and not to the runbook is the likely miss, and it
 * is the one that costs an outage: the rotation table is what tells a reader
 * that `OPERATOR_TOKEN` has three holders. A name in the runbook that is no
 * longer a secret is the other direction and is asserted too, because it sends
 * somebody to `wrangler secret put` for a value nothing reads.
 *
 * The needle is the name inside a table cell delimited by backticks, not a
 * bare mention, so a secret discussed in a sentence does not satisfy the
 * assertion for a row that is missing. Hard rule 10: a comment, or a
 * neighbouring sentence, has satisfied an assertion in this repo before.
 */
```

### scripts/check-invariants.mjs:5508 (WHY, shortened)

trimmed.

```js
/*
     * The reverse. Restricted to names the runbook presents AS SECRETS, which
     * is its rotation table, because the page legitimately backticks other
     * shouty identifiers (`PRAGMA`, `MEDIA_BACKUP`, `DIR`). The table rows are
     * the claim; anything outside them is prose.
     */
```

### scripts/check-invariants.mjs:5538 (CONTRACT, shortened)

scope and instrument split kept; audit story moved.

```js
/*
 * **AN IMAGE WITH NO `width`/`height` IS A LAYOUT SHIFT, AND THE ONE THAT HAD
 * NONE WAS THE LCP ELEMENT.**
 *
 * Measured in the pre-cutover audit 2026-09-11 (P1-16): the cover `<img>` in
 * `app/routes/blog.$slug.tsx` carried `src`, `alt`, `loading`,
 * `fetchPriority`, `decoding`, `srcset` and `sizes`, and no intrinsic size.
 * The comment beside it called that an unavoidable gap because D1 stores no
 * dimensions, which was true of D1 and false of the KEY: an uploaded object is
 * `<digest>-<width>x<height>.<ext>` and the prose pipeline had been reading
 * that back for every body image since it was written.
 *
 * ## WHY A SOURCE SCAN, when this repo prefers to call the function
 *
 * `test/cover-dimensions.test.mjs` CALLS `coverDimensions` and asserts the
 * numbers it returns, in both directions, over four kinds of src. That is the
 * behaviour, and it is the stronger half. What a test on a pure function
 * cannot see is whether the ROUTE still spreads it onto the element, which is
 * precisely the edit that would reintroduce the defect while every test stayed
 * green. So the two halves are deliberately different instruments: the test
 * owns "the function is right", this owns "the markup still uses it".
 *
 * ## THE SCOPE IS EVERY JSX `<img` UNDER `app/`, NOT JUST THE COVER
 *
 * Naming the cover would be a gate that catches the defect already fixed and
 * nothing else. The audit's finding was one instance of a class, so the scan
 * reads the class and carries a NAMED exemption list, which is the shape rule
 * 10 asks for: an exemption is a decision somebody wrote down, not a silence.
 *
 * Comments are stripped first. This file's own prose, and the route's, discuss
 * `<img>` at length, and a needle satisfied by a sentence about the needle is
 * a shape this repo has hit twice.
 */
```

### scripts/check-invariants.mjs:5572 (WHY, shortened)

trimmed.

```js
/**
   * Directories walked. `app/enhance/` is OUT: those modules build DOM with
   * `createElement`, so there is no JSX `<img` in them to read, and including
   * them would put an empty scope inside a non-empty one where it cannot be
   * seen.
   */
```

### scripts/check-invariants.mjs:5580 (WHY, shortened)

derived-exemption rule and hard rule 5 kept; first-draft story moved.

```js
/**
   * THE EXEMPTION IS DERIVED, NOT A LIST OF NAMES, and that is the whole
   * design of this section.
   *
   * A hand-kept permission list is the mirror anti-pattern hard rule 5 names:
   * it has to be maintained, it goes stale silently, and a reader cannot tell
   * a live entry from one whose subject moved two refactors ago. The FIRST
   * draft of this gate was exactly that list, and running it found the list
   * naming a file that does not exist while missing both images that really
   * are exempt. The list was wrong in both directions on its first run.
   *
   * So the reason an image may omit its intrinsic size is READ OUT OF THE
   * STYLESHEET: an element whose class rule declares BOTH `width` and
   * `height` already reserves an exact box, and its object's own dimensions
   * are the wrong number for that box anyway. Both admin thumbnails are this
   * case, each `5rem` by `3.25rem` with `object-fit: cover`.
   *
   * BOTH PROPERTIES, never one. A rule setting only `width` leaves the height
   * to the intrinsic ratio, which is precisely the shift this section exists
   * to refuse, and it is the shape a half-finished style has.
   *
   * @type {Map<string, string>} class name -> the declaration block
   */
```

### scripts/check-invariants.mjs:5612 (WHY, shortened)

trimmed.

```js
// First declaration wins; a later one for the same class is a
        // different selector context this scan cannot resolve, and taking it
        // would let an unrelated block satisfy the test.
```

### scripts/check-invariants.mjs:5664 (WHY, shortened)

trimmed.

```js
/*
     * Each `<img` up to its closing `>`, non-greedy. JSX has no `<img>...`
     * children, so the first `>` after the tag name ends the element, and an
     * attribute value containing `>` would have to be a string literal, which
     * none of these are.
     */
```

### scripts/check-invariants.mjs:5673 (WHY, shortened)

trimmed.

```js
/*
       * SATISFIED BY THE SPREAD AS WELL AS BY THE LITERAL. `coverDimensions`
       * returns `{ width, height }` and is spread onto the element, so a scan
       * for a literal `width=` would fail on the correct code. The spread is
       * accepted BY NAME rather than as any spread at all, because `{...rest}`
       * would otherwise satisfy this for an element that states nothing.
       */
```

### scripts/check-invariants.mjs:5696 (WHY, shortened)

trimmed; measurement date moved.

```js
/*
   * FLOORED, not zero-checked. A regex that stopped matching `<img` finds no
   * offenders and reports exactly what a clean sweep reports, which is this
   * gate's own vacuity class and the reason every scan here carries one.
   * MEASURED THROUGH THIS LOOP 2026-09-11.
   */
```

### scripts/check-invariants.mjs:5725 (CONTRACT, shortened)

rule and scope kept; three incidents moved.

```js
/*
 * **AN ESCAPE IN PROSE CAN REACH DISK AS A CONTROL BYTE AND STILL LOOK RIGHT.**
 *
 * Three instances before this section existed, all authored through a shell
 * that expanded a backslash escape inside a comment:
 *
 *   `\f` became 0x0C in app/app.css, so `font-display` read `ont-display`
 *   `\b` became 0x08, which is the case hard rule 10 records
 *   `\a` became 0x07 in scripts/check-browser.mjs, so libuv's `src\win\async.c`
 *        read `src\winsync.c`, a plausible path that does not exist
 *
 * Every one of them rendered close enough to correct to survive review, which
 * is the whole reason a person cannot be the instrument here.
 *
 * ## NO STRING-LITERAL PARSING, AND THAT IS NOT A SHORTCUT
 *
 * The tempting shape is "no control characters outside string literals", which
 * needs a parser per language. It is unnecessary: a control character that is
 * MEANT is written as an escape, and a backslash-u escape is six ASCII
 * characters rather than one byte 0x08. So a RAW control byte is a defect wherever it lands,
 * including inside a literal, and the rule needs no idea what language it is
 * reading.
 *
 * ## WHAT COUNTS
 *
 * Everything below 0x20 except tab, LF and CR, plus 0x7F, plus the invisibles
 * that are not control codes but are just as unreadable: the BOM and the
 * zero-width family. They cost nothing to include and they fail the same way,
 * by being absent from the render and present in the bytes.
 *
 * ## SCOPE
 *
 * Tracked files only, via `git ls-files`, so nothing generated or ignored is
 * judged. Binaries are excluded by extension and the count of both halves is
 * asserted, because a scan that skipped everything reports what a clean tree
 * reports. The allowlist is EMPTY and should stay that way: a deliberate raw
 * control byte in this repository has not existed yet.
 */
```

### scripts/check-invariants.mjs:5827 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE, BOTH HALVES. A glob that matched nothing, or a binary rule that
   * swallowed the tree, each report a clean sweep. The floors are the inventory
   * as it stands, measured by running.
   */
```

### scripts/check-invariants.mjs:5851 (CONTRACT, shortened)

rules and mechanism kept; login first-run story moved.

```js
/*
 * **HARD RULE 9 IS A PROPERTY OF THE MARKUP, AND NOTHING READ THE MARKUP.**
 *
 * Section 24 catches a client hook imported into an unhydrated tree, which is
 * the React half. `check:features` reconciles the enhancement INVENTORY, which
 * is the bookkeeping half. Neither reads a control and asks whether a reader
 * with scripting off can operate it, and that is the half the law is about.
 *
 * ADMIN IS EXEMPT, by rule 9. LOGIN IS NOT, ruled 2026-09-13: the door is on
 * the public plane, so it is a public reading route even though everything
 * behind it is exempt and even though it opts into hydration.
 *
 * ## THE FORMS RULE IS NOT "AN ACTION IS REQUIRED", AND THAT MATTERS
 *
 * A form with no `action` submits to the current URL. That is valid HTML, it
 * works with scripting off, and it is what `app/routes/login.tsx` does on
 * purpose: a plain form rather than the router's, so a cross-origin 303 is
 * followed by a native navigation. A gate demanding `action` would have failed
 * the one public form in the repository, on its first run, for being correct.
 *
 * So the rule is that a form must have a NATIVE SUBMISSION PATH: an `onSubmit`
 * with no `method` is script-only submission and fails; a `method` with no
 * `action` passes, because the browser already knows where to send it.
 *
 * A handler on a BUTTON is likewise not a defect. login's submit button carries
 * an onClick that preventDefaults and calls the browser client, with the form
 * post underneath as the fallback. That is the pattern the law asks for. What
 * fails is a handler on an element a keyboard cannot reach.
 *
 * ## HOW IT READS JSX WITHOUT PARSING IT
 *
 * Attribute values contain a closing angle bracket, because an arrow function
 * does. A tag regex ending at the first one therefore truncates on exactly the
 * handlers this section looks for. Two shapes avoid it: handlers are found
 * first and their OWNING TAG is located by scanning backwards, and where a
 * whole opening tag is needed a scanner tracks brace and quote depth.
 */
```

### scripts/check-invariants.mjs:5966 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE. A glob that matched nothing, or a JSX scan that stopped matching,
   * each report a clean sweep. Floors measured by running over the tree.
   */
```

### scripts/check-invariants.mjs:5990 (CONTRACT, shortened)

three rules kept; the revisit note kept as ruling 88 requires; 2026-09-13 measurements moved.

```js
/*
 * **A TOKEN NAME IS A CLAIM ABOUT A DEFINITION SOMEWHERE ELSE, AND NOTHING
 * CHECKED THE OTHER END.** `var(--brand-hovr)` is valid CSS. It falls back to
 * nothing, paints the inherited colour, and looks almost right.
 *
 * Three rules, and the third is the one with teeth over time.
 *
 *   (a) Every `var(--x)` resolves to a declaration.
 *   (b) Every declared token is referenced somewhere.
 *   (c) A component sheet states no raw hex.
 *
 * ## (b) MUST READ JAVASCRIPT, AND THE FIRST MEASUREMENT SAID OTHERWISE
 *
 * Over CSS alone, fourteen tokens read as unreferenced and the gate would have
 * been wrong about all but a handful. The six `--chart-*` tokens are consumed
 * as `var(--chart-cadet)` strings in `app/lib/content/chart.mjs`, which is a
 * reference a CSS-only scan cannot see. Reading `app/` and `scripts/` as well
 * takes the unreferenced set to ZERO, which is why this ships with no allowlist:
 * the tree already satisfies it.
 *
 * ## THE ALLOWLISTS ARE ARGUED, NOT ACCUMULATED
 *
 * Five tokens are referenced and never declared, and all five are injected at
 * runtime rather than declared in a stylesheet, so their absence here is
 * correct. One hex is stated in a component sheet, and its own comment argues
 * why it must not become a theme token. Each entry carries the reason; an entry
 * with no reason is how an allowlist becomes a place to put failures.
 *
 * ## WHAT IS DELIBERATELY NOT HERE, AND WHEN TO REVISIT
 *
 * **No raw numeric `font-weight` (proposed as 3d), and no off-scale spacing,
 * radius or control dimension (proposed as gate 4), are NOT GATED.** Both were
 * scoped, measured and skipped on 2026-09-13 for the same reason: they gate
 * against token scales this repository does not have. Measured that day, 79
 * numeric `font-weight` declarations against a type system whose only tokens are
 * `--font-sans` and `--font-mono`, and 1,769 raw dimensional literals (314 px,
 * 1,455 rem across 29 sheets) against `--r-control`, `--r-panel`, `--site-inset`
 * and `--control-h`. A rule with no compliant alternative at 1,769 sites is a
 * spreadsheet, not a gate.
 *
 * Part A of the redesign is defining the spacing, radius and type-weight scales.
 * **REVISIT BOTH once those land and the sheets are migrated**: the gate is
 * perhaps thirty lines in this section once there is a scale to compare against,
 * and it should be built then rather than forgotten.
 */
```

### scripts/check-invariants.mjs:6060 (CONTRACT, shortened)

trimmed; tag kept.

```js
/**
   * NAMED ANYWHERE, including by a gate. This set answers "is this spelling
   * known", and it is the scope of the referenced-but-undefined assertion
   * below, which must keep seeing a gate's own token names: a gate naming a
   * token nothing declares is a typo worth failing on.
   * @type {Set<string>}
   */
```

### scripts/check-invariants.mjs:6068 (CONTRACT, shortened)

trimmed; tag kept.

```js
/**
   * PAINTED. A narrower set, and the one the dead-token assertion reads.
   * See the block above the source scan for the rule and the argument.
   * @type {Set<string>}
   */
```

### scripts/check-invariants.mjs:6101 (WHY, shortened)

rule and hard rule 10 kept; ruling narrative and plant moved.

```js
/*
   * A GATE NAMING A TOKEN IS NOT A READER OF IT. RULED 2026-09-14.
   *
   * ## THE DEFECT
   *
   * This scan reads scripts/ as well as app/, for a good reason recorded in
   * ruling 87b: six --chart-* tokens are consumed as `var(--chart-cadet)`
   * STRINGS by app/lib/content/chart.mjs, and a CSS-only scan called all six
   * dead. The scan was widened to follow them.
   *
   * It was widened too far. scripts/check-contrast.mjs states every colour
   * token as a literal string, because its matrix pairs are transcribed as
   * NAMES. So this scan saw those names and marked the whole palette read.
   *
   * THAT WAS NOT A NEAR MISS, IT WAS AN UNFAILABLE CONDITION. check:contrast
   * REQUIRES every token declared in all three theme blocks to appear in its
   * MATRIX or in NON_PARTICIPATING; a token in neither fails that gate with
   * "declared but never measured". So a colour token cannot exist in this
   * repository without a mention in scripts/check-contrast.mjs, and this
   * assertion counted that mention as a read. Two gates cancelling each other:
   * one demands the name be written down, the other accepts the writing down
   * as evidence of use. Hard rule 10's unfailable-condition class, spanning a
   * pair of gates rather than sitting inside one.
   *
   * Proven by plant before the fix: a colour token declared in all three
   * blocks and painted by nothing FAILED check:contrast until it was given a
   * NON_PARTICIPATING entry, and the moment it had one this section went green
   * and stopped naming it.
   *
   * ## THE RULE
   *
   * A mention inside `scripts/check-*.mjs` does not make a token consumed. A
   * file whose name says it checks is ASSERTING ABOUT the token, not painting
   * with it, and a colour nothing paints is unconsumed however many pairs
   * measure it.
   *
   * IT IS STRUCTURAL AND NOT A LIST, which is the point. There is no per-token
   * exemption to widen one entry at a time; the question is what kind of file
   * the mention is in. Measured when it landed: every scripts/ file that is
   * not a check-*.mjs and names a token is a real renderer, build-og.mjs,
   * build-icons.mjs, build-diagrams.mjs and lib/mark.mjs, so none of them lose
   * a reference, and check-contrast.mjs was the only gate hiding anything.
   *
   * ## TWO SETS, DELIBERATELY
   *
   * `referenced` still takes the gate mentions, because the
   * referenced-but-undefined assertion below must keep seeing them: a gate
   * naming a token nothing declares is a typo and should fail. `consumed` is
   * the narrower set and is what the dead-token assertion and the carried map
   * read. Narrowing one set would have quietly weakened the other.
   */
```

### scripts/check-invariants.mjs:6158 (WHY, shortened)

trap kept, trimmed.

```js
// THE CARRIED MAP BELOW NAMES EVERY TOKEN IT CARRIES, and this scan reads
    // scripts/ too, so without this the map would mark its own entries as
    // referenced and then fail every one of them for being referenced. The
    // region between the sentinels is a LIST OF NAMES, not a use of them.
```

### scripts/check-invariants.mjs:6196 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE. Each of the three results below is a length, and a length is zero
   * when the scan found nothing at all. Floors measured by running.
   */
```

### scripts/check-invariants.mjs:6223 (CONTRACT, shortened)

self-policing contract kept; redesign build narrative moved.

```js
/*
   * CARRIED TOKENS: declared by one build, consumed by a later one.
   *
   * THIS MAP IS TEMPORARY AND IT IS NOT AN ALLOWLIST. The Paper, Glass, Light
   * redesign lands as four builds, and build 1 is scoped to tokens alone: no
   * components, no routes, no pages. So the type levels, the space and motion
   * scales and the control dimensions are all declared with nothing reading
   * them yet, which is exactly the shape this section fails on and is right to
   * fail on in every other case.
   *
   * IT POLICES ITSELF IN BOTH DIRECTIONS, which is what keeps it from becoming
   * permanent:
   *
   *   - an entry naming a token that is not declared FAILS. A dead entry is a
   *     hole that outlived its reason.
   *   - an entry naming a token that IS now referenced FAILS. The moment a
   *     build consumes a token, the entry must go, so the map shrinks as the
   *     redesign lands rather than being tidied up afterwards by somebody who
   *     remembers.
   *   - after EXPIRES it must be EMPTY, whatever is in it. The per-entry rules
   *     above cannot see a token no build ever consumed, and a date is the only
   *     mechanism available to this gate for "temporary": nothing on disk says
   *     which redesign build has landed. When this fires, the answer is to
   *     finish the build that owed the token or to delete the token, and moving
   *     the date is a ruling rather than a repair.
   */
```

### scripts/check-invariants.mjs:6250 (WHY, shortened)

row format kept; rulings 103 and 104, orphan deletions and counts moved.

```js
/*
   * RULING 103, 2026-09-14. THE CONTRACT IS AN OWNER AND A DATE. IT WAS A
   * BUILD NUMBER AND A BUILD NUMBER IS THE WRONG CONTRACT.
   *
   * Ruling 91 said build 4 must leave this map empty or fail. Build 2 was
   * reverted on 2026-09-14 when Dustin ruled the old header back, Part B is
   * suspended, and four rows went on naming a build whose consumer no longer
   * existed. A deadline that assumes a schedule which is not running is not a
   * deadline. Ruling 92's check:page-payload ceiling raise moves to the same
   * date and the same terms.
   *
   * ## WHAT A ROW SAYS NOW
   *
   * The OWNER: the thing that would paint the token. A component, a page or a
   * scale. Not a build, because a build can be reverted and an owner cannot be
   * reverted into something else; it either exists, is scheduled, or is not
   * there at all.
   *
   *   scale:      a member of a declared scale whose other members are read.
   *               The scale is the unit, not the token. A space scale running
   *               2, 3, 5, 6, 7, 8, 9 is worse than one with unreached steps,
   *               because the design's rule is that nothing uses a value off
   *               the scale, and a scale with holes cannot be that thing.
   *   component:  a named thing that will paint it, which does not exist yet.
   *   NO OWNER:   nothing would paint it and nothing is scheduled to. By
   *               ruling 103 these are DEAD and get deleted. THE LABEL IS
   *               UNUSED, and that is the state to find it in: all nine rows
   *               that carried it were deleted rather than kept. It is a
   *               finding, not a resting place, and a row wearing it is a row
   *               somebody has not finished thinking about.
   *
   * ## WHY THIS MAP GREW FROM 55 ROWS TO 96, AND IT IS NOT A WIDENING
   *
   * Rulings 103 and 104, same day. Section 31 used to count a token's name
   * appearing anywhere under scripts/ as a read. scripts/check-contrast.mjs
   * names every colour token, because its matrix pairs are transcribed as
   * names, and check:contrast REQUIRES every token declared in all three theme
   * blocks to be named there or in NON_PARTICIPATING. So the palette could not
   * exist without a mention that made it look consumed. Forty-one tokens were
   * unpainted and invisible. They are now rows. Nothing was exempted; the
   * measurement got honest and the map got longer.
   *
   * RULING 104, the same defect at its purest: eleven of those forty-one exist
   * nowhere in this repository except an entry in NON_PARTICIPATING saying no
   * contrast pair can be required of them. An exemption from being measured
   * was serving as proof of being used. Covered by the same structural rule,
   * because NON_PARTICIPATING lives in a check-*.mjs.
   *
   * ## SELF-POLICING, BOTH DIRECTIONS, UNCHANGED
   *
   *   - a row naming a token no stylesheet declares FAILS. A dead row is a
   *     hole that outlived its reason.
   *   - a row naming a token something now PAINTS fails. The moment an owner
   *     lands, the row must go, so the map shrinks as the redesign lands
   *     rather than being tidied up afterwards by somebody who remembers.
   *   - after CARRIED_EXPIRES it must be EMPTY, whatever is in it. The
   *     per-row rules cannot see a token no owner ever painted, and a date is
   *     the only mechanism this gate has for "temporary". Moving the date is a
   *     ruling rather than a repair.
   *
   * ## ALL NINE ORPHANS ARE DELETED. FOUR PLUS ONE PLUS FOUR.
   *
   * The fix that built this map exposed nine tokens sitting OUTSIDE the
   * "PAPER, GLASS, LIGHT" block in app.css, among siblings that ARE painted,
   * which is what marked them as orphans rather than as roles waiting for a
   * component. None survived, and the groups are:
   *
   *   4  an owner that shipped and declined them
   * + 1  --lamp-chroma-on-bar, whose owner was the deleted bar
   * + 4  the info role, which the redesign declined
   * = 9
   *
   * THE ARITHMETIC IS WRITTEN OUT BECAUSE THIS BLOCK HAS MISCOUNTED ITSELF
   * TWICE. First it said FIVE of the eight were owner-shipped-without with
   * "the remaining three" the info tokens, which does not close and was four
   * and four. Then its own heading said FIVE DELETED, FOUR AWAITING, which
   * went stale the moment the info four were deleted and read as though five
   * tokens had an owner that shipped without them. Both times the LISTS were
   * right and the COUNTS were wrong, which is the tell: a list can be checked
   * against the rows below and a count cannot, so the count is the half that
   * rots. Anyone editing this block re-derives the three numbers from the
   * groups rather than carrying them forward.
   *
   * FOUR HAD AN OWNER THAT SHIPPED AND DECLINED THEM, AND ARE DELETED:
   * --line-disabled, --surface-hero, --text-accent-lifted and --tint-accent.
   * The disabled control is not pending, it is BUILT and paints --text-disabled
   * in admin-editor.css and admin-posts.css; --text-accent is painted in
   * admin-media-later.css; --surface-popover and --surface-code are painted in
   * admin-editor.css. A component that shipped and declined a token is CLOSED
   * EVIDENCE, not a pending state, which is the distinction ruling 103 did not
   * have a name for.
   *
   * --line-disabled is the sharpest of the four: it carried a MEASURED 1.64:1
   * and a written WCAG 1.4.11 justification for an edge no rule ever drew.
   * MEASURING A THING IS NOT BUILDING IT, which is the same shape as the gate
   * hole described at the top of this section: a token can accumulate
   * paperwork that looks exactly like use.
   *
   * THE FIFTH DELETION, AND IT IS NOT A FIFTH OWNER-SHIPPED-WITHOUT TOKEN,
   * was --lamp-chroma-on-bar, whose owner was the bar that
   * came out of shell.css; ruling 6's missed fifth token, hidden behind the
   * contrast-mention defect while --bar-fill, --glass-fill-bar,
   * --glass-fill-bar-open and --line-on-brand were deleted. Deleting it
   * orphaned --fig-oxide-200, which took a row above in the same commit: a
   * token orphaned by a deletion is not thereby dead.
   *
   * THE LAST FOUR WERE THE INFO ROLE, AND THEY ARE DELETED TOO: --text-info,
   * --tint-info, --border-info and --on-tint-info. They were provisionally
   * kept as a complete definition of a component this site might grow, which
   * is a real argument and it did not survive the history.
   *
   * MEASURED, and it is the measurement rather than the impression that
   * decided it: all four were declared 2026-07-28 in 081ddb2, the Hill Country
   * token system, six weeks before ruling 65 began the redesign. No stylesheet
   * and no component has EVER read one, in any commit. The only file that ever
   * held var(--text-info) is docs/admin-mockups/posts.html, a static mockup,
   * which no longer references them. --on-tint-info was never read by
   * anything, anywhere, ever. And the redesign DID define its own semantic set
   * in 7909c2c: error, warning and success, with no info among them.
   *
   * So the four were not a finished decision waiting for a component. They
   * were a PREVIOUS palette's decision that the redesign looked at and did not
   * adopt, which is Case A with a longer gap: an owner that shipped without
   * them, where the owner is the redesign itself.
   */
```

### scripts/check-invariants.mjs:6526 (HISTORY, deleted)

dated re-measurement log.

```js
/*
 * RE-MEASURED 2026-09-08 BY RUNNING BOTH BRANCHES after section 27 (the runbook
 * is bound to the ratified secret list): 326 offline, 365 remote, against 305
 * and 344 before it. Section 27 is 21 assertions, two of them scope checks, and
 * eighteen of them one per secret in each direction, so the count moves with
 * `REQUIRED_SECRETS` and will move again the next time a secret is added.
 *
 * RE-MEASURED 2026-09-13 BY RUNNING THE OFFLINE BRANCH after sections 30 and 31
 * (no public control depends on script; every token is defined and used): 341,
 * against 337 after section 30 and 335 after 29. check:floors refused at 322:
 * gap 19 against a tolerance of 18, which is the instrument working rather than
 * a new defect. Offline floor 322 to 330, tighter than the 323 the tolerance
 * would allow, and taken by RUNNING rather than by adding four to the old one.
 * The remote floor is untouched: the remote branch was not run in this session.
 *
 * RE-MEASURED 2026-09-12 BY RUNNING THE OFFLINE BRANCH after section 29 (no
 * raw control or invisible characters in a tracked text file): 335, against 330
 * before it. The floor of 322 is 13 under that and the tolerance at 335 is 17,
 * so it still holds and is left alone rather than nudged: a floor moved without
 * a breach is a number nobody needed to change.
 *
 * Floors 290 to 309 and 328 to 346, each its measured count minus the
 * `check:floors` tolerance at that count. Not adjusted by arithmetic from the
 * old numbers: the previous entry in this comment records 272 having been a
 * stale reading before anything touched it, which is why every one of these is
 * taken by running the gate.
 */
```

### scripts/check-invariants.mjs:6553 (HISTORY, deleted)

dated re-measurement and CI incident.

```js
/*
 * RE-MEASURED 2026-09-11 BY RUNNING THE GATE: 330 offline, against a floor of
 * 309 that predates this session. Section 28 raised the count and pushed an
 * already-wide gap past what check:floors allows, which is the gate working as
 * designed rather than a new defect: a floor 21 under its count can lose
 * twenty-one assertions and still pass.
 *
 * Offline: executed 330, tolerance 17, lowest legal 313, set to 322.
 *
 * THE REMOTE FLOOR IS LEFT ALONE, deliberately. It was not measured in this
 * session (the remote branch needs the network), CI reported no breach on it,
 * and moving a number nobody re-ran is the exact habit the paragraph below
 * argues against.
 *
 * **SET THROUGH check:floors' OWN TOLERANCE, 2026-09-11, after CI caught the
 * first attempt.** That attempt read "six percent under" out of a comment in
 * check-headers.mjs and applied it to four gates. The rule is
 * `max(3, ceil(executed * 0.05))` and it belongs to `scripts/check-floors.mjs`,
 * the gate that enforces it. Prose about a gate ages; the gate does not.
 *
 * It went undetected locally because check:floors runs the whole offline tier
 * and therefore runs LAST, and the tier hangs before it on this host
 * (node --test wedges on test/check-all-cleanup.test.mjs, which predates this
 * work and is proven so by differential). CI reached it on the first push.
 */
```

### scripts/check-invariants.mjs:6578 (HISTORY, deleted)

dated re-measurement log; method kept in #287.

```js
/*
 * RE-MEASURED 2026-09-13 for the Paper, Glass, Light token layer, both branches,
 * by RUNNING the gate: 486 offline and 525 with --remote. Section 31's carried
 * map is most of the rise, since it asserts two things per carried token across
 * 72 of them. Floors are those counts minus check:floors' own tolerance,
 * max(3, ceil(n * 0.05)): 25 and 27. Taken from the printed counts, which is
 * the correction the paragraph above records.
 *
 * RE-MEASURED AGAIN 2026-09-13 when build 2 landed the shell: 422 offline and
 * 461 with --remote. Then AGAIN when the header restore returned one token to
 * the carried map: 424 and 463, floors 403 and 440. The map is the reason this
 * moves so often, and it moves in BOTH directions: consuming a token removes
 * two assertions, re-carrying one adds them back. Taken after the map had finished
 * shrinking for this build, not partway through it.
 *
 * RE-MEASURED AGAIN 2026-09-14, the largest single move UPWARD so far, when
 * Dustin's header restore took build 2's bar out of shell.css: NINETEEN tokens
 * lost their only consumer in one commit and came back onto the carried map,
 * which is 38 assertions. BY RUNNING BOTH BRANCHES: 462 offline and 501 with
 * --remote, floors 438 and 475 after check:floors' own tolerance of 24 and 26.
 * Not derived from 424 and 463 by adding 38, even though that happens to give
 * the same answer here: the method is the point, and it is the method
 * check:floors' own failure text demands.
 *
 * **THIS FLOOR MOVES DOWN EVERY TIME THE CARRIED MAP SHRINKS, and that is the
 * design rather than a nuisance.** Each carried token contributes two
 * assertions, so consuming 30 of them removed 60. A floor derived from the old
 * count by arithmetic would be wrong in the direction that matters, since it
 * would sit ABOVE what the gate can now execute and the tier would refuse. Run
 * the gate in both branches and read the printed counts; that is the only
 * method that works here, and the map is designed to empty.
 *
 * RE-MEASURED 2026-09-14, BOTH BRANCHES BY RUNNING THEM, after rulings 103 and
 * 104 re-keyed the carried map to owners and section 31 stopped counting a
 * check-*.mjs mention as a read: 534 offline and 573 remote, against 462 and
 * 501 before.
 *
 * THE MOVE IS UP, WHICH THIS COMMENT HAS NOT SEEN BEFORE. Every earlier entry
 * describes the floor falling as the map empties. Forty-one tokens that were
 * unpainted and invisible became rows, and each row is two assertions, so the
 * map went 55 to 96 and the count went up by 82 in both branches. The
 * paragraph above still holds for the direction of travel; it just did not
 * anticipate a measurement correction adding rows rather than a build removing
 * them.
 *
 * Floors are those counts minus ONE UNDER check:floors' own tolerance,
 * max(3, ceil(n * 0.05)) being 27 and 29: 508 and 545. The remote branch was
 * RUN this time rather than left owed, which the entries above record going
 * wrong twice.
 *
 * RE-MEASURED AGAIN 2026-09-14, BOTH BRANCHES BY RUNNING THEM, after five
 * orphaned tokens were deleted (--line-disabled, --surface-hero,
 * --text-accent-lifted, --tint-accent and --lamp-chroma-on-bar) and
 * --fig-oxide-200 took a row: 526 offline and 565 remote, against 534 and 573.
 * Five rows out and one in is four rows net, which is eight assertions, and
 * the measured move is eight in both branches. THE ARITHMETIC AGREEING IS NOT
 * WHY THESE ARE THE NUMBERS; both branches were run, and the entries above
 * record three separate occasions when the same arithmetic was wrong.
 *
 * Floors one under tolerance again, 27 and 29: 500 and 537.
 *
 * RE-MEASURED 2026-09-14, BOTH BRANCHES BY RUNNING THEM, after the info role's
 * four tokens were deleted: 518 offline and 557 remote, against 526 and 565.
 * Floors one under tolerance, 26 and 28: 493 and 530.
 *
 * FOUR RE-MEASUREMENTS OF THIS FLOOR IN ONE DAY, which is worth naming rather
 * than hiding in a list: the map was re-keyed, then five orphans went, then
 * four more. Each was run. The alternative on offer each time was to subtract
 * two per deleted row from the previous figure, and three entries above this
 * one record that exact habit producing a number nobody had measured.
 */
```

### scripts/check-invariants.mjs:6652 (WHY, shortened)

reason kept; measurements and incident moved.

```js
/*
   * NAMED PER BRANCH, vol 15 binding. --remote adds the live-database
   * comparison and the count moves with it: 299 offline, 338 remote, measured
   * 2026-09-06. One name for both would judge whichever branch ran last
   * against a floor set from the other, which is how check:contrast's
   * build-absent floor sat 32 under its count until CI reached it.
   */
```

## scripts/check-admin-ui.mjs

### scripts/check-admin-ui.mjs:1 (CONTRACT, shortened)

usage and contract kept; redesign story and fixture provenance moved.

```js
/**
 * Gate over what the admin's forms SUBMIT.
 *
 * OBSERVATION BOUNDARY: reduces each page to the set of requests it can SUBMIT.
 * It renders components with stubbed loaders, so it sees no server behaviour, no
 * styling and no layout: a page that submits correctly and is unusable passes.
 * A component that CALLS a stubbed .server export throws here, because the stub
 * is a Proxy with no own keys.
 *
 *   npm run check:admin-ui
 *   npm run check:admin-ui -- --update    (rewrites the baseline, deliberately loud)
 *
 * The admin redesign is a UI-only change running under one hard rule: a control
 * may move anywhere, but pressing it must send exactly what it sent before.
 * Nothing else in the check family can see that. A typecheck cannot: the form
 * fields are strings in JSX. check:content cannot: no content changes. And no
 * gate can reach /admin over HTTP, because it is behind a real Google session.
 *
 * So this renders the three admin routes as components and reads their markup
 * back, reducing each page to the set of requests it can issue:
 *
 *     METHOD action | intent | comma-joined field names
 *
 * That tuple is what the server actually consumes. `handleEditorAction`
 * dispatches on `intent`, and `fieldsFromForm` reads a fixed set of keys, so
 * two different-looking pages with the same tuple set are the same API client.
 *
 * The baseline in scripts/fixtures/admin-ui-payloads.json was generated from
 * the editor as it stood BEFORE the Session 2 redesign, which is the whole
 * point: the fixture is the checkbox era's payload shape, and the gate passing
 * today means the redesign did not change it.
 *
 * FAILS CLOSED. A missing fixture is an error, not an empty pass, and every
 * comparison is paired with a count so "0 differences" can never quietly mean
 * "0 pages rendered".
 *
 * Pure: no database, no network, no session. It does bundle with esbuild, and
 * it stubs the routes' server-only imports rather than running them, so it
 * proves things about components and nothing about loaders or actions.
 */
```

### scripts/check-admin-ui.mjs:51 (WHY, shortened)

trimmed; hard rule 17 kept.

```js
// The retention windows are asserted against the CONSTANTS, not against a copy
// of the sentence, for the same reason CACHE_SENTENCE below is: a paraphrase in
// the route that hard-coded the two numbers would pass a text comparison and
// would be a second owner of a fact hard rule 17 gives to one module.
```

### scripts/check-admin-ui.mjs:59 (WHY, shortened)

trimmed.

```js
// The caveat is asserted against the CONSTANT, not against a copy of its text,
// so a paraphrase in the route fails here rather than becoming a second owner.
```

### scripts/check-admin-ui.mjs:89 (WHY, shortened)

trimmed.

```js
/*
 * THE OPERATOR'S NAMES FOR THE HEALTH CHECKS, read from the module that owns
 * them rather than retyped here. A list of five strings in this file would be a
 * second owner of the mapping, and the two would agree with each other while
 * both drifted from the page.
 *
 * Dynamically imported because this script's tsconfig project does not include
 * the app tree, and a static import would have to be added to that project's
 * file list to typecheck.
 */
```

### scripts/check-admin-ui.mjs:114 (CONTRACT, shortened)

trimmed.

```js
/* -------------------------------------------------------------------------
 * The loader states each route is rendered in.
 *
 * These describe the SHAPES a loader can hand a component, not real data. A
 * state exists here when it changes which controls render: a drafted post and
 * a published one offer different transitions, a drifted Ask index adds an
 * alert that owns a repair, a conflict replaces the feedback slot.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:124 (WHY, shortened)

trimmed.

```js
// FEATURED, and it is the only row that is. The list marks the hero, so the
  // fixture needs one row where the mark appears and rows where it does not:
  // a fixture with the flag on every row, or on none, would satisfy a component
  // that ignored the flag entirely.
```

### scripts/check-admin-ui.mjs:129 (WHY, shortened)

trimmed.

```js
// `scheduledInDays` arrives PRE-COMPUTED, which is the contract the loader
  // owes: the component may not read the clock, so a fixture that made it
  // derive one from the date would be testing a rule the code must not follow.
```

### scripts/check-admin-ui.mjs:136 (CONTRACT, shortened)

trimmed.

```js
/** One object in the media library, overridable per scenario. */
```

### scripts/check-admin-ui.mjs:140 (WHY, shortened)

trimmed.

```js
// The THUMBNAIL url, carrying the transform width. The gate renders it, so a
  // regression that started serving originals into the grid would show here as
  // a changed src.
```

### scripts/check-admin-ui.mjs:155 (WHY, shortened)

row count moved.

```js
// A row WITH an LQIP. The null-placeholder case is its own scenario below,
  // because it is 11 of the 70 real rows and renders a different tile.
```

### scripts/check-admin-ui.mjs:162 (CONTRACT, shortened)

trimmed.

```js
/** Parsed by the loader, so the component never sees the delimited form. */
```

### scripts/check-admin-ui.mjs:164 (CONTRACT, shortened)

trimmed.

```js
/** Rows carrying identical bytes. Exact content identity only. */
```

### scripts/check-admin-ui.mjs:166 (WHY, shortened)

trimmed.

```js
/*
   * THE THIRD USAGE STATE and its evidence, decided by the loader from
   * `media_refs`, the artifact scan and `template-refs.json`. `unattached` is
   * the default because it is the state a fresh upload is in; the roster case is
   * its own scenario below, and it is the one the state exists for.
   */
```

### scripts/check-admin-ui.mjs:177 (CONTRACT, shortened)

stale-fixture incident moved.

```js
/**
 * The loader's non-object fields.
 *
 * One helper so a change to the loader's shape is one edit rather than five.
 * These went stale once already and it was not caught: Phase 3 replaced
 * `cursor`/`truncated`/`unannotated` with `page`/`hasMore`/`counts`, this gate
 * was not run in that session or the next, and every media scenario had been
 * failing with "Cannot read properties of undefined" ever since.
 */
```

### scripts/check-admin-ui.mjs:195 (CONTRACT, shortened)

trimmed.

```js
/* The v1 library's additions. `q` is echoed so the search input, the chips
   * and the pager all carry it; `unusedCount` is the chip's number, from the
   * same predicate the filter uses; `detail` is the `?key=` view, which is
   * where alt editing and delete moved to; `uploaded` and `uploadError` are the
   * flash the upload route redirects back with. */
```

### scripts/check-admin-ui.mjs:204 (WHY, shortened)

session heading moved.

```js
/* ---- media v6 --------------------------------------------------------
   * The whole view state, echoed by the loader so the component can build
   * every link from it. Handed over as an OBJECT rather than spread, because
   * that is what the component receives and what makes `hrefWith(view, ...)`
   * the natural call. */
```

### scripts/check-admin-ui.mjs:228 (WHY, shortened)

wording history moved.

```js
/* INPUT, not an expectation: the loader owns this sentence and the component
     echoes it. It carried the pre-scan wording ("an asset referenced only by
     route code has no citation here") until the repository scan made that false,
     and the component went on rendering it because a fixture is a copy. The
     WORDING is asserted against the route source below, where it actually
     lives; this only has to be a note so the paragraph renders at all. */
```

### scripts/check-admin-ui.mjs:240 (CONTRACT, shortened)

trimmed.

```js
/** The `?key=` view's loader shape, overridable per scenario. */
```

### scripts/check-admin-ui.mjs:267 (HISTORY, deleted)

one-run incident; rest restates the code.

```js
/* Same three the row carries, plus the two the inspector alone shows. These
     went missing for exactly one run and the gate said so by THROWING on
     `templateRefs.length`, which is the failure a shared fixture helper exists
     to make loud rather than silent. */
```

### scripts/check-admin-ui.mjs:278 (CONTRACT, shortened)

trimmed.

```js
/** The unfiltered view: every filter empty, nothing narrowed. */
```

### scripts/check-admin-ui.mjs:287 (WHY, shortened)

roadmap reference moved.

```js
/*
 * READERSHIP FIXTURES. Roadmap G, and there are four because the column has
 * four outcomes and three of them are absences that must not look alike.
 *
 * The whole point of the column is that a missing number is not a zero, so a
 * harness that only ever rendered one of these would be asserting the easy
 * half. `live-complete` and `live-truncated` differ ONLY in `complete`, and the
 * same slug is missing from `byPath` in both, so the two states are a
 * controlled pair: same data, one flag, two different renderings.
 */
```

### scripts/check-admin-ui.mjs:302 (WHY, shortened)

trimmed.

```js
// `live-one` has a count, `soon` has none. `wip` is absent from both this
    // and the truncated fixture below, which is what makes the pair work.
```

### scripts/check-admin-ui.mjs:310 (CONTRACT, shortened)

trimmed.

```js
/** Same rows, cut short. The missing slug is now UNKNOWN rather than zero. */
```

### scripts/check-admin-ui.mjs:322 (CONTRACT, shortened)

trimmed.

```js
/** The ordinary state on a development machine: no token, so no number. */
```

### scripts/check-admin-ui.mjs:336 (WHY, shortened)

B004 crash story moved.

```js
/*
 * THE WHOLE `PostFields` SHAPE, since 2026-09-03.
 *
 * This omitted the seven B004 keys (`featured` through `updated`) for as long
 * as the editor relayed them through hidden inputs, because a hidden input
 * handed `undefined` renders without a value attribute and nothing complains.
 * The moment they became real controls the omission became a crash: a control
 * reads its own value, and `splitReading(undefined)` threw on every state.
 *
 * The loader has always returned all of them, so the fixture was describing a
 * loader that does not exist. The drawer's own docblock states the rule this
 * violated: a loader shape the gate does not supply is a loader shape it is not
 * actually testing.
 */
```

### scripts/check-admin-ui.mjs:374 (WHY, shortened)

trimmed.

```js
/*
 * TWO PREVIEW LINKS, hand-authored. Feature G.
 *
 * The tokens are 43 base64url characters, which is what `mintToken` produces,
 * and they are WRITTEN OUT rather than minted here. Rule 10's fixture
 * independence: a gate whose expected values come from the code under test is a
 * mirror, and a randomly minted token would also make the payload baseline
 * non-deterministic.
 *
 * Their first six characters DIFFER, deliberately. The list prints six and the
 * whole point of printing six is telling two links apart; a pair sharing a
 * prefix would pass a truncation assertion while proving nothing about it.
 */
```

### scripts/check-admin-ui.mjs:390 (CONTRACT, shortened)

trimmed.

```js
/** The origin the loader builds absolute preview URLs against. */
```

### scripts/check-admin-ui.mjs:403 (CONTRACT, shortened)

trimmed.

```js
/** Everything the edit route's loader hands its component. */
```

### scripts/check-admin-ui.mjs:410 (WHY, shortened)

trimmed.

```js
// The Cmd+K palette's corpus. It renders nothing until the palette opens, so
  // it changes no submission here; it is present because the component reads it
  // and a loader shape the gate does not supply is a loader shape it is not
  // actually testing.
```

### scripts/check-admin-ui.mjs:418 (WHY, shortened)

ruling citation moved.

```js
// The drawer's revision list, RENDERED rather than omitted, and that is the
  // point. Ruling 1 says a restore loads and never writes; the way this gate
  // can hold that rule is by rendering the control and observing that the
  // page's submission set does not grow. An empty list would have proved
  // nothing, because a control that is not rendered submits nothing either.
```

### scripts/check-admin-ui.mjs:429 (WHY, shortened)

trimmed.

```js
/*
   * Live preview links. EMPTY by default, which is the state a draft is in
   * until somebody makes one, and the state a published post is permanently in
   * because the publish path revoked them.
   *
   * The loader supplies this and the component decides the section from
   * `state`, not from the array's length: an empty array on a draft still
   * renders the section, with the create control and a sentence saying there
   * are none. Only a non-draft loses the section entirely.
   */
```

### scripts/check-admin-ui.mjs:443 (WHY, shortened)

trimmed.

```js
/*
 * The origin-requests panel's three SourceResult shapes.
 *
 * Hand-authored rather than produced by the source module, per rule 10's
 * fixture-independence clause: a gate whose expected values come out of the
 * code under test is a mirror. `originRequests` differs from `rows` in the live
 * fixture on purpose, so the sampling-weighted path is the one exercised.
 */
```

### scripts/check-admin-ui.mjs:481 (WHY, shortened)

trimmed.

```js
/*
 * THE COCKPIT'S FIXTURES, and every string in them is shaped like what the
 * INSTRUMENT returns rather than like what the page should say.
 *
 * `detail` is the verdict module's own sentence, carrying its own numbers, on
 * both the passing and the failing path. That shape is the whole point of the
 * assertions below: the page is supposed to RENDER the instrument's sentence,
 * not compose its own from the same parts, and the only way to check that is
 * to give it a sentence no page-side template could have produced.
 */
```

### scripts/check-admin-ui.mjs:499 (WHY, shortened)

trimmed.

```js
/** One check failing, the rest passing. A run where everything fails cannot
 *  tell a per-check verdict from a page-wide one. */
```

### scripts/check-admin-ui.mjs:525 (CONTRACT, shortened)

trimmed.

```js
/** D1 behind the artifact, and one commit recorded as not applied. */
```

### scripts/check-admin-ui.mjs:542 (WHY, shortened)

trimmed.

```js
/**
 * One row per status the moderation queue groups by, plus the two hostile
 * shapes the render is the boundary for.
 *
 * `receivedAt` and friends are `Date` objects because that is what the loader
 * hands the component: the columns are drizzle `timestamp` mode, and single
 * fetch preserves a Date across the wire. A string here would render through a
 * different branch than production takes.
 */
```

### scripts/check-admin-ui.mjs:621 (CONTRACT, shortened)

section marker shortened.

```js
// ---- posts index --------------------------------------------------------
```

### scripts/check-admin-ui.mjs:679 (WHY, shortened)

trimmed.

```js
// The two filtered views exist here because they change WHICH CONTROLS
  // RENDER, which is this gate's admission test: a filtered list gains a Clear
  // link, and a filtered list that matched nothing replaces the table with an
  // empty state carrying a second way out. An empty RESULT is not an empty
  // corpus and the two must not collapse into one scenario.
```

### scripts/check-admin-ui.mjs:684 (WHY, shortened)

2026-08-12 gap and session story moved.

```js
/*
   * SELECTION IS A STATE, and until 2026-08-12 this gate could not reach it.
   *
   * The harness renders one static pass and dispatches no events, so the bulk
   * bar never mounted and the three bulk intents contributed NO payload: the
   * most destructive surface in the admin was outside the fixture entirely.
   * Session D shipped with that stated; this closes it.
   *
   * `props` seeds the route's own useState through route-render.mjs. The route
   * takes an optional prop with a production default, so nothing on the wire
   * can set it.
   *
   * TWO selected rather than one, deliberately: a single selection would render
   * "1 selected" and hide any plural or count-formatting defect, and the delete
   * confirmation reads the count.
   */
```

### scripts/check-admin-ui.mjs:700 (WHY, shortened)

trimmed.

```js
/*
   * THE THREE CONFIRMATION STEPS, which are the no-script half of the delete
   * guards. The action refuses an unconfirmed destructive POST and returns what
   * it would have destroyed; these states render that return.
   *
   * They exist because the guards' whole failure mode is being reachable only
   * with script. A confirmation step that never rendered would leave the
   * refusal a dead end, and nothing else here would notice: the submission
   * baseline only sees forms that are on the page.
   */
```

### scripts/check-admin-ui.mjs:737 (WHY, shortened)

session and seam-count narrative moved.

```js
/*
   * FILTERED **AND** SELECTED, the combination D.1 left uncovered and the
   * decisions log folded into this session.
   *
   * Two states existed separately: filtered-with-matches (no selection, so no
   * bulk bar) and two-selected (unfiltered, so the select-all label reads
   * "Select all 3" with no "shown"). Neither could see the ruled behaviour,
   * which only appears where both hold at once: the label must say SHOWN
   * whenever a filter is active, because select-all reaches only the rows on
   * screen and a bare "all" would claim the corpus.
   *
   * TWO posts visible and ONE selected, deliberately. Two so the count is not
   * the degenerate 1, and one selected so `allShown` is false, which is the
   * state where a reader is most likely to mistake the control's reach.
   *
   * No new harness seam: this reuses `initialSelection`, so the seam count
   * stays at ONE against the ruled ceiling of three.
   */
```

### scripts/check-admin-ui.mjs:799 (WHY, shortened)

redesign narrative moved.

```js
// ---- media library ------------------------------------------------------
  //
  // The grid states render the same controls as each other now: the v1 redesign
  // moved alt editing and delete OUT of the tiles and into the `?key=` detail
  // view, so what a grid state proves is the search form, the upload form and
  // the maintenance menu, and what a DETAIL state proves is the two per-asset
  // mutations. Both matter: a regression that put a delete button back on
  // seventy tiles would change every grid state's payload set and fail here.
  //
  // A failed scan is still its own state, because it is what ruling 4 turns on.
```

### scripts/check-admin-ui.mjs:837 (WHY, shortened)

trimmed.

```js
// Ruling 4's state: usage is unknown, so nothing is labelled unused and the
    // action refuses every delete.
```

### scripts/check-admin-ui.mjs:853 (WHY, shortened)

row count moved.

```js
// A DOCUMENT: 31 of the 70 real rows. It has no thumbnail the Images
    // binding can produce, so the tile renders a label instead of an <img>
    // pointed at something that cannot exist.
```

### scripts/check-admin-ui.mjs:880 (WHY, shortened)

trimmed.

```js
// A STATIC row: not deletable through the UI, so it renders the explanation
    // instead of the delete form. The refusal itself lives in the action and is
    // not what this proves; this proves the page stops OFFERING the control, so
    // a regression that put the button back would change this scenario's
    // payload set and fail here.
```

### scripts/check-admin-ui.mjs:895 (WHY, shortened)

404 incident moved.

```js
// A static asset is its OWN url. Prefixing /media/ produced
          // `/media//logo.svg` and 404'd every one of the 58 static rows.
```

### scripts/check-admin-ui.mjs:902 (WHY, shortened)

row count moved.

```js
// EVERY SVG HAS A NULL PLACEHOLDER: the Images binding does not
          // rasterize vectors. 11 of the 70 real rows are in this state, so the
          // tile must degrade to a plain surface rather than a blank hole.
```

### scripts/check-admin-ui.mjs:912 (WHY, shortened)

session heading and counts moved.

```js
/* ---- media v6 session 4 -------------------------------------------------
   *
   * Three states the redesign added, each because it changes what RENDERS.
   *
   * A DOCUMENT IN THE GRID is not the same state as a document in a row: the
   * list gives a PDF a 44px extension chip, and the grid gives it a card with a
   * title, a suggestion of text and a size. 31 of the 70 real rows are here.
   *
   * A SELECTED TILE grows a caption bar carrying the name, the size and the
   * copy control, and the body's copy control goes so the card has exactly one.
   * That swap is invisible to the payload baseline, because a copy button is
   * `type="button"` and submits nothing, so it needs a structural assertion.
   *
   * A SORTED LIST is the state the column headers exist for: one heading is
   * active and carries an arrow, four are not, and one is not a link at all.
   * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:943 (WHY, shortened)

trimmed.

```js
// NULL, which is the real shape: a static PDF has no originalName, so
          // the title has to come off the KEY. A fixture that supplied a tidy
          // name here would test a path the corpus never takes.
```

### scripts/check-admin-ui.mjs:966 (WHY, shortened)

ruling citation moved.

```js
// The harness seam, per admin queue ruling 8. One static render dispatches
    // no events, so without a seeded selection the caption bar never mounts and
    // the state would assert the absence of something that cannot appear.
```

### scripts/check-admin-ui.mjs:982 (HISTORY, deleted)

session heading and narrative.

```js
/* ---- media v6 session 5: the usage model and everything it feeds --------
   *
   * Nine states, each because it changes what RENDERS and none of them visible
   * to the payload baseline on its own. The usage states are the point: the page
   * could express two of them and the third was the one the roster photographs
   * needed.
   * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:990 (WHY, shortened)

before-state moved.

```js
// THE CASE THE THIRD STATE EXISTS FOR. Referenced by repository code, cited
    // by no post. Before this it rendered identically to a genuine orphan.
```

### scripts/check-admin-ui.mjs:1029 (WHY, shortened)

trimmed.

```js
// THE INSPECTOR ON A TEMPLATE-PLACED FILE: the claim, its boundary, and the
    // source file that is the evidence for it.
```

### scripts/check-admin-ui.mjs:1053 (WHY, shortened)

trimmed.

```js
// A DOCUMENT IN THE INSPECTOR. The copy labels change here and nowhere else:
    // an <img> tag pointed at a PDF is a broken page.
```

### scripts/check-admin-ui.mjs:1079 (WHY, shortened)

trimmed.

```js
// THE DUPLICATE SURFACE: the byte-identical sentence and the named trash
    // offer. This is the one place the page proposes removing something on the
    // strength of a comparison, so the copy is what makes it safe to accept.
```

### scripts/check-admin-ui.mjs:1095 (WHY, shortened)

trimmed.

```js
// AN IMAGE WITH ALT ALREADY WRITTEN. The suggestion must NOT be offered
    // here: a suggestion beside somebody's sentence invites overwriting it with
    // a filename. This is the negative half of the suggestion assertion.
```

### scripts/check-admin-ui.mjs:1109 (WHY, shortened)

plant story moved.

```js
/*
     * A LARGE FILE THAT IS CITED, DESCRIBED AND UNIQUE. The flag list is
     * non-empty ("over 1 MB") and the tile precedence selects NOTHING, which is
     * the only shape where "one dot by precedence" and "a dot whenever any flag
     * exists" disagree. A plant proved the previous assertion could not tell
     * them apart.
     */
```

### scripts/check-admin-ui.mjs:1133 (WHY, shortened)

trimmed.

```js
// A NARROWED LENS, which owes the reader the boundary of its own claim.
```

### scripts/check-admin-ui.mjs:1145 (WHY, shortened)

trimmed.

```js
// THE LIBRARY IS EMPTY. The only empty state that gets a heading and an
    // action, because it is the only one where the reader has nothing to undo.
```

### scripts/check-admin-ui.mjs:1159 (WHY, shortened)

trimmed.

```js
// A SEARCH MISS, which is a different thing from an empty library and needs
    // a different next step. It names the query back and says what was searched.
```

### scripts/check-admin-ui.mjs:1168 (WHY, shortened)

trimmed.

```js
// A LENS THAT FOUND NOTHING, which is GOOD NEWS and reads as an error unless
    // it says so.
```

### scripts/check-admin-ui.mjs:1180 (HISTORY, deleted)

session heading.

```js
/* ---- media v6 session 6: the drawer, the modals, the revealed chrome ----
   *
   * Four states for four surfaces that a static render can otherwise not see,
   * two of them destructive.
   * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:1186 (WHY, shortened)

prompt() history moved.

```js
/*
     * THE EMPTY-TRASH CONFIRMATION, which is now a URL rather than a
     * `prompt()`. The destructive submission moved BEHIND this state: the trash
     * view itself no longer carries `intent=empty-trash`, which is the payload
     * change this state accounts for and the gate reported as GONE.
     */
```

### scripts/check-admin-ui.mjs:1204 (WHY, shortened)

trimmed.

```js
/*
     * THE BULK-TRASH CONFIRMATION, reached only through the third harness seam
     * because it opens from client state. It hides many files in one press, so
     * it belongs in the fixture more than almost anything else here.
     */
```

### scripts/check-admin-ui.mjs:1217 (WHY, shortened)

trimmed.

```js
/*
     * A SELECTION, for the floating bar. It carries the bulk intents, the size
     * total and the trash trigger, and the bar does not exist without one.
     */
```

### scripts/check-admin-ui.mjs:1232 (WHY, shortened)

trimmed.

```js
// SEARCH WITH RESULTS. `q` is echoed back, so the input renders its value,
    // the chips carry it and the pager carries it; the Clear link only exists
    // in this state.
```

### scripts/check-admin-ui.mjs:1242 (WHY, shortened)

trimmed.

```js
// SEARCH THAT FOUND NOTHING. A different empty state from an empty bucket:
    // it offers to widen the group or clear the search rather than to upload.
```

### scripts/check-admin-ui.mjs:1269 (WHY, shortened)

2026-08-17 gap moved.

```js
/*
   * TAGS ON THE DETAIL, both branches, because until 2026-08-17 no state
   * carried any and the whole chip region rendered in NO state. A blank
   * submit clearing every tag was invisible here for that reason.
   *
   * Two states, because the chip has two shapes: with several tags a chip
   * carries the remaining list and a separate Clear all appears, and at
   * exactly one tag the chip itself becomes the clear, since an empty `tags`
   * value no longer means clear.
   */
```

### scripts/check-admin-ui.mjs:1300 (WHY, shortened)

trimmed.

```js
// THE DETAIL VIEW, where set-alt and delete now live. Both mutations must
    // appear HERE and nowhere else, which is exactly what comparing this
    // scenario against the grid ones asserts.
```

### scripts/check-admin-ui.mjs:1320 (WHY, shortened)

restates #49.

```js
// A DETAIL for a STATIC row. It is not deletable through the UI, so the
    // page stops OFFERING the control and explains why instead. The action
    // refuses it regardless; this proves the offer is gone, so a regression
    // that put the button back changes this payload set.
```

### scripts/check-admin-ui.mjs:1349 (WHY, shortened)

trimmed.

```js
// A KEY THE INDEX DOES NOT HAVE, which is what a bookmarked detail link
    // becomes after the object is deleted. It must render a way back rather
    // than a blank panel or a crash.
```

### scripts/check-admin-ui.mjs:1362 (WHY, shortened)

trimmed.

```js
// UPLOAD ACCEPTED. The form itself renders in every state; this is the one
    // where the route's redirect has landed, so the flash and its link render.
```

### scripts/check-admin-ui.mjs:1374 (WHY, shortened)

trimmed.

```js
// UPLOAD REFUSED. The route redirects with a CODE and the loader turns it
    // into the sentence; the page renders whatever it was handed.
```

### scripts/check-admin-ui.mjs:1386 (WHY, shortened)

heading moved.

```js
/* ---- media v6: the new structure ---------------------------------------
   *
   * Each of these renders a DIFFERENT CONTROL SET, which is this gate's
   * admission test. A view mode changes a data attribute and no submissions, so
   * the two layout states are here to prove exactly that: one markup tree, two
   * layouts, payload identical. If a future refactor split the list into its
   * own JSX branch, one of the two would drift and the fixture would say so.
   * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:1402 (WHY, shortened)

trimmed.

```js
// FLAT, which is now the non-default. It renders no heading at all, which
    // is what makes a heading a signal when grouping is on.
```

### scripts/check-admin-ui.mjs:1433 (WHY, shortened)

trimmed.

```js
// The Reset link exists ONLY when something is modified, which is what
      // makes this a state rather than a variant of the default one.
```

### scripts/check-admin-ui.mjs:1451 (WHY, shortened)

trimmed.

```js
// A trash view with NOTHING in it. Empty trash must not be offered, and the
    // explanation must still appear: an author arriving at an empty bin still
    // needs to know what putting something in it would do.
```

### scripts/check-admin-ui.mjs:1481 (WHY, shortened)

trimmed.

```js
// A tag that matched nothing. A different empty state from an empty bucket
    // and from an empty search, and it must offer a way out that is not
    // "upload something".
```

### scripts/check-admin-ui.mjs:1496 (WHY, shortened)

trimmed.

```js
// TWINS PRESENT. The only state that offers to remove something on the
    // strength of a comparison, so it is the only one where that copy renders.
```

### scripts/check-admin-ui.mjs:1512 (WHY, shortened)

trimmed.

```js
// A TRASHED row open in the inspector. It offers Restore and must NOT offer
    // Move to trash, which is the pair this fixture pins.
```

### scripts/check-admin-ui.mjs:1527 (HISTORY, deleted)

session heading.

```js
/* ---- media v6 session 3: grouping and bulk tagging ---------------------- */
```

### scripts/check-admin-ui.mjs:1529 (WHY, shortened)

trimmed.

```js
// GROUPED BY FOLDER. Two rows in one folder and one in another, so a
    // grouper that emitted one bucket per ROW would render three headings and
    // this state would fail rather than merely look odd.
```

### scripts/check-admin-ui.mjs:1540 (WHY, shortened)

trimmed.

```js
// The roster photograph, which is the row whose NOTE is the whole
        // reason this grouping exists.
```

### scripts/check-admin-ui.mjs:1549 (WHY, shortened)

trimmed.

```js
// GROUPED BY MONTH, including a row with NO upload date, which gets its own
    // bucket rather than being folded into the nearest month.
```

### scripts/check-admin-ui.mjs:1566 (WHY, shortened)

ruling and incident moved.

```js
/*
     * TWO SELECTED, which is the only state that can issue the bulk intents.
     *
     * Seeded through `initialSelection`, the optional prop with a production
     * default, per queue ruling 8. The harness renders one static pass and
     * dispatches no events, so without this seam the bulk bar never mounts and
     * the two bulk intents contribute NO payload, which is exactly how the
     * posts index left its most destructive surface outside the fixture for a
     * session.
     *
     * TWO rather than one: a single selection renders "1 selected" and hides
     * any plural or count-formatting defect.
     */
```

### scripts/check-admin-ui.mjs:1588 (WHY, shortened)

trimmed.

```js
// role=all is what makes this genuinely UNFILTERED. The default view is
      // filtered to content, so the bare select-all label only ever appears
      // here, which is the distinction the two assertions below pin.
```

### scripts/check-admin-ui.mjs:1599 (WHY, shortened)

trimmed.

```js
// FILTERED AND SELECTED. The select-all label must say SHOWN whenever a
    // filter is active, because it only ever reaches the rows on screen. Same
    // ruled wording the posts index carries, asserted structurally below.
```

### scripts/check-admin-ui.mjs:1618 (CONTRACT, shortened)

section marker shortened.

```js
// ---- new post -----------------------------------------------------------
```

### scripts/check-admin-ui.mjs:1647 (CONTRACT, shortened)

section marker shortened.

```js
// ---- edit ---------------------------------------------------------------
```

### scripts/check-admin-ui.mjs:1682 (WHY, shortened)

trimmed.

```js
/*
     * The action refused an unconfirmed first publication and handed the fields
     * back. Same shape as the delete confirmation above: a `kind` the route
     * turns into a server-rendered second step, on a post whose loader state is
     * the one that can reach it.
     */
```

### scripts/check-admin-ui.mjs:1735 (WHY, shortened)

trimmed.

```js
/*
     * A POST THAT ALREADY HAS FURTHER READING, one external link and one
     * internal, which is the only state where the picker's checkbox is TICKED.
     *
     * Without it `frInternal` never reaches a submission, because an unticked
     * checkbox is not submitted and every other state leaves the list empty. It
     * would then be the one field of the new control that the baseline does not
     * pin, which is the same blindness the fixture exists to remove.
     *
     * `live-one` is the published entry in `editLoader`'s `linkTargets`, so the
     * checkbox this state ticks is a real offer rather than an invented one.
     */
```

### scripts/check-admin-ui.mjs:1747 (WHY, shortened)

trimmed.

```js
/*
     * A FEATURED POST. The negative for the checkbox assertions: every other
     * state has `featured: false`, so without this the "renders unchecked"
     * assertion would be satisfied by a control that is incapable of rendering
     * checked at all.
     */
```

### scripts/check-admin-ui.mjs:1798 (WHY, shortened)

feature heading and table trimmed.

```js
/* ---- draft preview links (feature G) ------------------------------------
   *
   * THREE states, and they are three because the feature has exactly three
   * shapes and each renders a different control set:
   *
   *   a draft with NO links      the create control and a sentence
   *   a draft WITH links         the create control plus one revoke per link
   *   a published post           NEITHER control, which is the ruling
   *
   * The middle one carries TWO links rather than one. One link would render a
   * revoke control and prove the tuple exists; two also proves the tuple is the
   * SAME for both, which is the property the per-link form design was chosen
   * for. If the token ever leaked into the submission set, two links would
   * produce two tuples and this state would fail while a one-link state passed.
   *
   * The published state duplicates "edit, published" in loader shape and is kept
   * separate on purpose: that state exists to prove the publish transitions, and
   * folding a second claim into it would mean a failure there could be either.
   * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:1843 (WHY, shortened)

trimmed.

```js
// The loader would hand back [] for a published post regardless. Handing
      // it the TWO links instead is the stronger fixture: it proves the section
      // is gated on state and not on emptiness, so a future edit that started
      // rendering the list whenever it is non-empty fails here.
```

### scripts/check-admin-ui.mjs:1851 (WHY, shortened)

trimmed.

```js
// ---- origin requests ----------------------------------------------------
  //
  // Three states, and the ERROR one is not hypothetical: the read token is
  // optional by contract and a development machine never carries it, so the
  // error is what this route renders locally every single time. It is covered
  // first for that reason rather than last.
```

### scripts/check-admin-ui.mjs:1878 (WHY, shortened)

trimmed.

```js
/*
   * ---- the webmention moderation queue ------------------------------------
   *
   * FOUR STATES, and the two CONFIRMATION states are the reason this route is
   * here at all rather than being left to a live click. Both destructive
   * intents on this page refuse in the ACTION and render a second step, which
   * is what makes the ceremony real for a reader without JavaScript; a
   * confirmation that only exists in a handler is the exact defect
   * `app/lib/destructive.mjs` was written for, and the only instrument that can
   * see the rendered form is this one.
   *
   * The rows carry a `<script>` in an author name and a very long source URL,
   * because everything on this page came from a stranger and the render is the
   * boundary. Section 3's escaping assertions read the markup back.
   */
```

### scripts/check-admin-ui.mjs:1893 (WHY, shortened)

ruling heading moved.

```js
/*
   * ---- ruling 21: one queue behind a status filter -------------------------
   *
   * `status` ARRIVES IN loaderData because the route resolves the filter in its
   * LOADER rather than from a hook, so a state here declares the filter the
   * same way the server would hand it over. `expiring` arrives for the same
   * reason: the sweep button is LABELLED with the count, so the label is a
   * loader fact and a state can choose it.
   *
   * The populated queue is rendered at `all` rather than at the default,
   * because every escaping assertion below reads MENTIONS[0] and a state that
   * filtered it out would leave those cases green over a row they never saw.
   */
```

### scripts/check-admin-ui.mjs:1920 (WHY, shortened)

ruling and old-page history moved.

```js
/*
   * AN EMPTY FILTER WITH ROWS BEHIND IT, which is the state the old page could
   * not produce at all and the one ruling 21a is about. It must show the quiet
   * line and NOT the four rows that exist under other statuses, so it can fail
   * in both directions: a filter that stopped filtering and a filter that
   * stopped saying why the list is empty.
   */
```

### scripts/check-admin-ui.mjs:1945 (WHY, shortened)

trimmed.

```js
/* Nothing expired, so the sweep control is disabled and still carries its
     count.

     ITS PAYLOAD IS UNCHANGED, and the baseline records that rather than an
     absence: the BUTTON is disabled, the hidden `intent` field beside it is
     not, so the form still reports `intent` here. A browser will not submit it
     at all while the button is the only submitter and it is disabled, which is
     a fact about the browser that this harness does not model and this comment
     must not claim it does. What the state is really for is the LABEL, which
     the structural case below reads. */
```

### scripts/check-admin-ui.mjs:1978 (WHY, shortened)

ruling citation moved.

```js
/*
   * THE TWO FEEDBACK STATES, and they are separate states rather than one,
   * because the property under ruling 21c is that the BOX MATCHES THE OUTCOME.
   * One state could only ever assert that some box rendered. Two can assert
   * that each renders its own and not the other, which is what fails when a
   * success goes back into the error box.
   */
```

### scripts/check-admin-ui.mjs:2001 (HISTORY, deleted)

2026-08-25 coverage gap narrative.

```js
/*
   * ---- the cockpit ---------------------------------------------------------
   *
   * UNCOVERED UNTIL 2026-08-25, and the gap was invisible in exactly the way
   * this gate exists to prevent. `/admin` rendered a hard-coded card whose
   * green dot was a constant, and no state here ever rendered the route, so
   * the page could have said anything at all and this gate would have reported
   * the same 442 checks. It was rewired to real instruments in the same commit
   * as these states; a page that reports on everything else deserves to be
   * reported on itself.
   */
```

### scripts/check-admin-ui.mjs:2054 (CONTRACT, shortened)

separator shortened.

```js
/* ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:2058 (CONTRACT, shortened)

2026-09-03 change narrative moved.

```js
/* -------------------------------------------------------------------------
 * Section 1: the publish state machine, as a table rather than as pixels.
 *
 * Rendering cannot see what a button does when it is clicked, so the mapping
 * from post state to transition lives in a module and is asserted here, exactly
 * as check:policy asserts publish-policy.mjs. `wantsDraft` is the whole
 * contract with the server.
 *
 * SINCE 2026-09-03 THAT CONTRACT IS VISIBLE IN THE MARKUP, which changes what
 * this gate can prove. It used to read: true means the request carries
 * `draft=on`, false means it carries no `draft` key. That field is gone. Each
 * button now submits its transition id as `intent`, and `fieldsFromForm`
 * derives `draft` from it through `draftForIntent`, so section 3 can assert the
 * whole chain off the rendered page instead of taking a click handler on trust.
 * That is the point of the change as much as the no-script path is: the old
 * shape was unassertable by construction, and the three defects it produced
 * lived in the gap.
 *
 * Every rule is paired with its negative, because a table that only ever
 * asserts what SHOULD be there passes just as happily when everything is there.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:2095 (CONTRACT, shortened)

trimmed.

```js
// A draft that was public once and was withdrawn.
```

### scripts/check-admin-ui.mjs:2099 (WHY, shortened)

trimmed.

```js
// The negative that matters: asking twice for a republication is not a
  // ceremony, it is a habit, and habits get clicked through.
```

### scripts/check-admin-ui.mjs:2113 (WHY, shortened)

trimmed.

```js
// Scheduled behaves as published: it is already draft:false.
```

### scripts/check-admin-ui.mjs:2121 (CONTRACT, shortened)

trimmed.

```js
// Exactly one primary, always, and every transition names itself.
```

### scripts/check-admin-ui.mjs:2128 (WHY, shortened)

trimmed.

```js
/*
     * EVERY TRANSITION IS AN INTENT THE SERVER WILL ACCEPT, and it means the
     * same thing on both sides. `fieldsFromForm` reads the draft flag off the
     * intent now, so a transition missing from the map would be refused as
     * unknown, and one present with the wrong value would publish or unpublish
     * against its own label. Both directions, per state.
     */
```

### scripts/check-admin-ui.mjs:2148 (WHY, shortened)

trimmed.

```js
/*
   * THE CONFIRMED PUBLISH, which is the one intent that is not a transition.
   * It has to mean draft:false like the ask it answers; an intent that
   * confirmed a publication and then saved a draft would be the quietest
   * possible failure.
   */
```

### scripts/check-admin-ui.mjs:2161 (WHY, shortened)

trimmed.

```js
/*
   * CMD+S PRESERVES PUBLICATION STATE, per state.
   *
   * The shortcut is the one submit with no submitter, so it names its own
   * intent, and naming the wrong one would publish a draft from a keystroke
   * that has always meant "save". Asserted against `draftForIntent` rather than
   * against the id, because what matters is the flag it produces.
   */
```

### scripts/check-admin-ui.mjs:2187 (WHY, shortened)

trimmed.

```js
/*
   * FAIL CLOSED. An intent nothing recognises is a draft. This is the direction
   * that decides whether a future bug leaks a private post or refuses a save,
   * and only one of those is recoverable.
   */
```

### scripts/check-admin-ui.mjs:2197 (WHY, shortened)

2026-09-03 replay and counts moved.

```js
/* -------------------------------------------------------------------------
 * THE LAST LINK: `fieldsFromForm` ACTUALLY READS THE INTENT.
 *
 * Everything above asserts `draftForIntent`, and everything in section 3
 * asserts the markup. Between them sits the one line that joins the two, and
 * until 2026-09-03 NOTHING reached it: a replay that reverted that line to the
 * old `form.get("draft") === "on"` left this gate at 513 checks and 0 failures
 * and the whole test suite at 630 passing. The mechanism was different from the
 * one this change removed and the blind spot was the same shape, which is the
 * argument for closing it in the commit that found it rather than filing it.
 *
 * Bundled rather than imported: `frontmatter.ts` is TypeScript, so `node:test`
 * cannot reach it, which is why the rule lives here and not in `test/`. It is
 * bundled ALONE because esbuild derives its outbase from the common parent of
 * its entry points, and mixing it with the route entries writes the output into
 * subdirectories the flat name would not find.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:2219 (CONTRACT, shortened)

trimmed.

```js
/** The request a browser sends when a submitter carrying `intent` is pressed. */
```

### scripts/check-admin-ui.mjs:2229 (CONTRACT, shortened)

trimmed.

```js
// Every intent the buttons can send, through the real parser, both directions.
```

### scripts/check-admin-ui.mjs:2239 (WHY, shortened)

trimmed.

```js
// An assertion that can pass by reading nothing is not an assertion: an empty
  // table would have satisfied the loop above without examining one intent.
```

### scripts/check-admin-ui.mjs:2243 (WHY, shortened)

trimmed.

```js
/*
   * AND IT READS NOTHING ELSE. This is the half that actually pins the defect:
   * the assertions above still pass if the parser ALSO honours a `draft` field,
   * which is the state a half-applied revert leaves behind and the one where
   * the two mechanisms disagree about the same request.
   */
```

### scripts/check-admin-ui.mjs:2264 (WHY, shortened)

trimmed.

```js
// The discriminating control. Without it every assertion here would pass on a
  // parser that returned a constant.
```

### scripts/check-admin-ui.mjs:2277 (CONTRACT, shortened)

trimmed.

```js
// stateOf must agree with publiclyVisible(): draft is draft, a future
  // publish_at is scheduled, everything else is published.
```

### scripts/check-admin-ui.mjs:2293 (WHY, shortened)

trimmed.

```js
// The boundary, stated rather than left to chance: publiclyVisible() uses
  // `publish_at <= now`, so a post due exactly now is live, not scheduled.
```

### scripts/check-admin-ui.mjs:2305 (CONTRACT, shortened)

trimmed.

```js
/* -------------------------------------------------------------------------
 * Section 1b: the WELD between the transition table and the policy.
 *
 * publish-transition.mjs decides what the button says and what it sends.
 * publish-policy.mjs decides what the server then does with it. They are
 * separate modules on purpose (one is UI, before the fact; one is server, after
 * it) and they are driven by the same two facts, so they agree today. Nothing
 * structural stops them drifting apart tomorrow.
 *
 * This welds them, in both directions:
 *
 *   Forward.  Every transition in the table is LEGAL under the policy. Pressing
 *             it as the admin must not throw, and the outcome the policy
 *             computes must be the one the table's label promised.
 *   Backward. Every outcome the policy can produce is REACHABLE from some table
 *             state. An outcome no button can cause is either dead policy or a
 *             missing control, and both are worth failing over.
 *
 * The policy is driven through its real entry point with real frontmatter, not
 * a stub, so a change to how `decide` reads a file is caught here too.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:2327 (CONTRACT, shortened)

trimmed.

```js
/**
 * The markdown a save would carry for a given draft flag.
 * @param {boolean} draft
 * @param {string | null} firstPublished
 */
```

### scripts/check-admin-ui.mjs:2348 (CONTRACT, shortened)

trimmed.

```js
/** Every state the table can be asked about, with the prior file it implies. */
```

### scripts/check-admin-ui.mjs:2356 (CONTRACT, shortened)

trimmed.

```js
/** What the table's transition id claims the save will do. */
```

### scripts/check-admin-ui.mjs:2371 (WHY, shortened)

discovery story moved; hard rule 10 kept.

```js
/*
       * ONE assertion whose condition varies, not a pair of literals.
       *
       * This was `assert(label, false, …)` in the catch and
       * `assert(label, true)` on the success path. The success half COULD NOT
       * FAIL: reaching the line was the entire signal, and the literal made the
       * assertion count claim coverage it did not have.
       *
       * Found by check:assertions on the run immediately after its rule (a) was
       * fixed to span lines. It is the eighth instance of hard rule 10's class
       * in this repo and the FIRST found by a machine rather than by a person.
       */
```

### scripts/check-admin-ui.mjs:2411 (WHY, shortened)

trimmed.

```js
// The one fact the whole publish story rests on: draft-ness in the
      // committed file must be what the transition asked for.
```

### scripts/check-admin-ui.mjs:2420 (CONTRACT, shortened)

trimmed.

```js
// Backward: no orphan outcomes in the policy.
```

### scripts/check-admin-ui.mjs:2429 (WHY, shortened)

trimmed.

```js
// And the reverse orphan check, so a table that grew a transition the policy
  // does not model shows up here rather than at runtime.
```

### scripts/check-admin-ui.mjs:2440 (CONTRACT, shortened)

banner trimmed.

```js
/* -------------------------------------------------------------------------
 * Section 2: what the rendered pages can submit.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:2453 (CONTRACT, shortened)

trimmed.

```js
/** Rendered markup per state, kept for the no-script fallback section. */
```

### scripts/check-admin-ui.mjs:2459 (CONTRACT, shortened)

trimmed.

```js
/** Raw markup per state, kept for the structural assertions in section 3. */
```

### scripts/check-admin-ui.mjs:2485 (WHY, shortened)

trimmed.

```js
// An assertion that can pass by reading nothing is not an assertion. A state
  // that rendered an empty string would otherwise report an empty submission
  // set and match a baseline that was also generated from a broken render.
```

### scripts/check-admin-ui.mjs:2506 (WHY, shortened)

trimmed.

```js
// Fail closed. A gate whose expectation is missing must block and say so, never
// pass for want of anything to compare against.
```

### scripts/check-admin-ui.mjs:2544 (WHY, shortened)

dated measurements moved; hard rule 10 kept.

```js
/*
 * Same rule again, one level up: a baseline of empty arrays would compare equal
 * to a render that found no forms at all.
 *
 * **THE FLOOR WAS 20 AGAINST A MEASURED 351, WHICH IS NOT A FLOOR.** It is the
 * shape hard rule 10 calls an unreachable threshold and VERIFICATION.md records
 * as a 10,000-character ceiling on an 8,479-character file: this page's whole
 * submission surface could have gone dark, taking 94% of the comparison with
 * it, and the assertion that exists to notice exactly that would have passed.
 * It was written when the harness compared one route.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE by running it, 2026-09-03: 404.
 * Never summed over the fixtures. The floor is 383, so the slack is 21, which
 * absorbs a state being retired and does not absorb a route going quiet: the
 * media library alone contributes far more than 21.
 *
 * It read 351 against a floor of 330 until 2026-09-03, when splitting the
 * editor's `intent=save` into one intent per transition added 25 submissions
 * and a state. Left alone the floor would still have PASSED, which is why it is
 * moved here rather than noticed later: the number stayed true as a historical
 * measurement and stopped being true as a floor, because the slack this comment
 * calls load-bearing had quietly become 46.
 *
 * It read 388 against a floor of 367 until later the same day, when the posts
 * index grew per-row duplicate and unpublish controls: two tuples on each of
 * the eight states that render at least one row, so 16 submissions. Moved for
 * the reason above rather than left to drift, and the slack is still 21.
 *
 * It read 404 against a floor of 383 until 2026-09-05 and ruling 21, which
 * added five mentions states carrying 38 submissions between them. RE-MEASURED
 * BY RUNNING, never summed: 442. The slack is still 21.
 */
```

### scripts/check-admin-ui.mjs:2582 (WHY, shortened)

dated measurements moved.

```js
/*
 * AND THE STATES THEMSELVES ARE FLOORED, which the baseline cannot do.
 *
 * "baseline covers exactly the states rendered" above looks like it protects
 * this and does not, for one reason: `--update` REWRITES the baseline. A state
 * dropped from STATES and then blessed by an update run leaves that assertion
 * comparing two shortened lists and agreeing. The floor is the copy `--update`
 * cannot reach, which is the whole difference between a fixture and a gate.
 *
 * Measured by running this gate, 2026-09-03: 82. Floor 77. Moved with the
 * submission floor above and for the same reason: the first-publication
 * confirmation step added a state, and a floor whose slack doubles is a floor
 * that has stopped meaning what its own comment says it means.
 *
 * RE-MEASURED BY RUNNING, 2026-09-05: 94. It read 89 against 77 until ruling 21
 * split the mentions page's four states into nine, and a slack of 17 is a floor
 * that would sit through the whole of that section being deleted. Floor 89,
 * slack 5, which is the width it has always had.
 */
```

### scripts/check-admin-ui.mjs:2607 (CONTRACT, shortened)

trimmed.

```js
/* -------------------------------------------------------------------------
 * Section 3: the editor's structure, from the same renders.
 *
 * Not interaction. A focus trap, Escape, Cmd+S and the draft buffer are all
 * browser behaviour and none of them can be observed here; that gap is real and
 * is stated rather than papered over. What CAN be asserted is that the elements
 * those behaviours depend on exist, are the right elements, and carry the
 * names and states assistive technology reads. A <dialog> that is not a
 * <dialog> has no trap to test in the first place.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:2621 (CONTRACT, shortened)

trimmed.

```js
/**
 * React's escaping, mirrored, so a needle taken from a fixture matches the
 * markup it produced.
 *
 * None of today's fixture sentences contain an escapable character, and that
 * is exactly why this exists: an assertion that only works while nobody writes
 * an apostrophe is an assertion waiting to go quietly false.
 *
 * @param {string} text
 * @returns {string}
 */
```

### scripts/check-admin-ui.mjs:2667 (WHY, shortened)

trimmed.

```js
// The one guarantee the feedback slot has always carried: it is in the DOM
  // before it has anything to say, or a screen reader announces nothing.
```

### scripts/check-admin-ui.mjs:2680 (WHY, shortened)

trimmed.

```js
// The primary button's LABEL must be the one the table names. This is the
// bridge between section 1 and the rendered page: the table can be right and
// the component can still show the wrong word.
```

### scripts/check-admin-ui.mjs:2695 (HISTORY, deleted)

2026-09-03 rewrite story; the rule is in #167.

```js
/* -------------------------------------------------------------------------
 * THE DRAFT FLAG, AS THE MARKUP CARRIES IT. Rewritten 2026-09-03.
 *
 * What stood here asserted that the first-publication primary was
 * `type="button"`. It was a faithful description of the code and it PINNED THE
 * DEFECT: a button that does not submit cannot be pressed by a browser with no
 * script, so the gate's green run was the reason nobody looked. The assertion
 * that replaces it holds the property the old one was reaching for, which was
 * never "does not submit" but "cannot publish in one press", and holds it
 * somewhere a no-script reader also lives: the ask and the answer are DIFFERENT
 * intents, and the page only ever offers the ask.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:2708 (WHY, shortened)

trimmed.

```js
// Every transition button submits its own id. This is the whole contract with
// `fieldsFromForm` now, so it is asserted on the rendered page for each state
// rather than inferred from the table it was built from.
```

### scripts/check-admin-ui.mjs:2730 (WHY, shortened)

trimmed.

```js
/*
 * THE NEGATIVE THAT MAKES THE POSITIVES MEAN SOMETHING.
 *
 * The `draft` field is gone from every editor page. Without this, every
 * assertion above would pass just as happily on a page that ALSO still shipped
 * the old hidden input, which is the state a half-applied revert leaves behind
 * and the one where the two mechanisms disagree.
 */
```

### scripts/check-admin-ui.mjs:2750 (WHY, shortened)

trimmed.

```js
// A never-published draft must not publish in one press. The primary sends the
// ASK, and only the ceremony's own submits send the ANSWER.
```

### scripts/check-admin-ui.mjs:2764 (WHY, shortened)

trimmed.

```js
// And the answer exists exactly where the ceremony is, so the ask has somewhere
// to go. Asserted as a count, so "not found" cannot pass as "found nowhere it
// should not be".
```

### scripts/check-admin-ui.mjs:2781 (WHY, shortened)

trimmed.

```js
/*
 * A WITHDRAWN DRAFT CARRIES NO RESCHEDULE DIALOG. It shares the non-ceremony
 * arm with a published post, and that arm's dialog submits the in-place `save`,
 * which on a draft means draft:false. Nothing can open it there, so the only
 * thing an unconditional render would produce is a publication in the markup
 * that no control reaches, which is exactly what this gate reads as the page's
 * request surface.
 */
```

### scripts/check-admin-ui.mjs:2793 (WHY, shortened)

trimmed.

```js
/*
 * THE SERVER-RENDERED SECOND STEP.
 *
 * Asserted by SUBTRACTING the ceremony dialog rather than by extracting the
 * step, because both render the identical button: same type, same intent, same
 * label. An end anchor on the step's own markup would be a needle whose closing
 * `</div>` is one of four, which is the neighbour-satisfies-the-match shape in
 * FAILURES.md. Removing the dialog leaves exactly the submits a scriptless
 * reader can reach, and the count is what makes "found" mean "found here".
 */
```

### scripts/check-admin-ui.mjs:2818 (WHY, shortened)

trimmed.

```js
/*
 * THE NEGATIVE, on the state the step does NOT belong to. Without it the
 * assertion above passes on a component that renders the step unconditionally,
 * which would put a one-press publication on every fresh draft.
 */
```

### scripts/check-admin-ui.mjs:2835 (WHY, shortened)

trimmed.

```js
/* -------------------------------------------------------------------------
 * THE FEATURED MARK ON THE ADMIN LIST.
 *
 * Counted, not merely found. `POSTS` carries exactly one featured row, so a
 * component that marked every row would satisfy "the mark is present" and fail
 * this; that is the whole difference between the assertion and its negative,
 * and it is why the fixture carries both values rather than one.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:2854 (WHY, shortened)

trimmed.

```js
/* -------------------------------------------------------------------------
 * THE ROW ACTIONS, and every property here is one the payload baseline cannot
 * see.
 *
 * The baseline records that this page can POST `intent=unpublish` with a
 * `slug`. It cannot record WHICH ROWS offer it, because the tuple set is
 * DISTINCT by design and one row contributes the same entry as ten. So a
 * regression that put an unpublish control on a draft, or a publish control on
 * the list at all, would move nothing in the fixture.
 *
 * The state fixture carries exactly one published, one scheduled and one draft
 * row, which is what makes counting meaningful: a component that ignored the
 * state entirely would render three of each and fail here, and one that
 * rendered none would fail too.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:2876 (WHY, shortened)

plant story moved.

```js
/*
 * The needle is the ID WITHOUT its attribute, so it matches the form AND any
 * button pointing at it. Anchoring on `id="` was the first cut and it was too
 * narrow, proven by planting: rendering the button on every row while leaving
 * the forms state-gated left the draft row carrying a control aimed at a form
 * that does not exist, and an assertion that read only the form said nothing.
 * A dangling control is the worse defect of the two, because it renders.
 */
```

### scripts/check-admin-ui.mjs:2887 (WHY, shortened)

trimmed.

```js
/*
 * BUTTONS AND FORMS PAIR UP EXACTLY, in both directions.
 *
 * A browser resolves `form="..."` by string equality and says nothing when it
 * fails: the button submits the enclosing form instead, which here is the BULK
 * SELECTION form, so a typo in `rowFormId` turns Unpublish into a bulk
 * submission carrying every ticked slug. Nothing renders differently and
 * nothing throws. This is the assertion that sees it.
 */
```

### scripts/check-admin-ui.mjs:2899 (WHY, shortened)

trimmed; hard rule 10 kept.

```js
// Non-empty scope first: an empty page satisfies "every" vacuously, which is
  // the zero-scope class hard rule 10 names.
```

### scripts/check-admin-ui.mjs:2908 (WHY, shortened)

trimmed.

```js
/*
 * THE CEREMONY IS NOT REACHABLE FROM THIS PAGE, which is the one that would
 * cost something if it broke. First publication is reserved to the editor, and
 * the reservation is worth nothing if a list row can send the transition. The
 * needles are the transition ids `publish-transition.mjs` hands out, anchored
 * on the attribute so a word inside prose cannot satisfy or break them.
 */
```

### scripts/check-admin-ui.mjs:2924 (CONTRACT, shortened)

trimmed.

```js
/* -------------------------------------------------------------------------
 * THE FRONTMATTER CONTROLS, and the two properties the payload cannot show.
 *
 * The baseline pins WHICH fields are submitted. It cannot pin that `featured`
 * is a checkbox paired with a hidden "false", nor that the section is reachable
 * without script, and those are the two things this work is actually about.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:2932 (WHY, shortened)

trimmed.

```js
// Reachable with no script. A <details> opens on its own; a <dialog> does not.
// This is the whole reason the section is not in the settings drawer, so it is
// asserted rather than left to the component's comment.
```

### scripts/check-admin-ui.mjs:2943 (WHY, shortened)

trimmed.

```js
/*
 * THE FEATURED PAIRING, both halves, because either alone is the defect.
 *
 * A lone hidden input is the old relay with no control. A lone checkbox is the
 * B004 loss: unticked, it submits nothing and absence reads as cleared. The
 * order matters too, and is asserted, because `fieldsFromForm` takes the LAST
 * value: a checkbox rendered BEFORE the hidden "false" would be overridden by
 * it and the control would silently do nothing.
 */
```

### scripts/check-admin-ui.mjs:2963 (WHY, shortened)

trimmed.

```js
// And the checkbox reflects the stored value in both directions, or it would
// be a control that always reads false no matter what the post says.
```

### scripts/check-admin-ui.mjs:2974 (WHY, shortened)

trimmed.

```js
/*
 * FURTHER READING. The marker is the field that makes an empty list mean the
 * author's emptiness rather than a form that never offered the control, so its
 * absence is the data-loss bug and it is asserted by name.
 */
```

### scripts/check-admin-ui.mjs:2985 (WHY, shortened)

trimmed.

```js
// One spare row on a post with no links, so a link can be added without script.
```

### scripts/check-admin-ui.mjs:2996 (WHY, shortened)

trimmed.

```js
/*
 * THE PICKER. Its checkbox value carries slug and title together, which is what
 * keeps the tuple one field wide no matter how many posts exist; asserting the
 * shape is what stops that quietly becoming a field per post.
 */
```

### scripts/check-admin-ui.mjs:3007 (WHY, shortened)

trimmed.

```js
// editLoader offers one published post and one draft; only the live one may
  // be offered, because further reading renders to the public.
```

### scripts/check-admin-ui.mjs:3016 (WHY, shortened)

trimmed.

```js
// The OG fields say what happens when they are left empty. A note that does not
// name the fallback is the kind of help that sends somebody to read the source.
```

### scripts/check-admin-ui.mjs:3025 (WHY, shortened)

trimmed.

```js
// The slug is editable in exactly one place: a new post. An existing post
// renders no slug input at all, which is why only the fresh state is asserted.
```

### scripts/check-admin-ui.mjs:3027 (WHY, shortened)

history moved.

```js
/*
 * THE SLUG INPUT'S PATTERN, BOTH DIRECTIONS, and the second direction is the
 * one with a history.
 *
 * The attribute was derived inline from `SLUG_PATTERN.source` by a strip that
 * silently did nothing, so the anchored source shipped as the attribute. An
 * HTML `pattern` anchors implicitly, so this validated identically and no
 * render, typecheck or gate could see it. The POSITIVE assertion alone would
 * still not have seen it, because it was written against a constant that did
 * not exist yet; what catches that exact shape is the negative, which names
 * the anchored form and refuses it.
 *
 * Needles are plain `includes` rather than a built RegExp on purpose: the
 * pattern is full of regex metacharacters, and interpolating it into a RegExp
 * would compile the rule instead of looking for it.
 */
```

### scripts/check-admin-ui.mjs:3055 (WHY, shortened)

trimmed.

```js
// Scope proven non-empty first: with no slug input the negative below is
    // true of the empty string and this passes having examined nothing.
```

### scripts/check-admin-ui.mjs:3060 (WHY, shortened)

trimmed.

```js
/*
 * THE RULED SELECT-ALL LABEL, gated because the fixture structurally cannot
 * see it: the payload baseline records METHOD, intent and field NAMES, and this
 * is text. A ruled behaviour with no instrument is a behaviour that drifts.
 *
 * Both directions, because the positive alone would pass on a label that said
 * "Select all 2 shown all" or that had grown a second, bare copy elsewhere.
 * The negative names the exact bare form the ruling forbids, closed with the
 * element boundary so "Select all 2 shown" cannot satisfy it as a prefix.
 */
```

### scripts/check-admin-ui.mjs:3080 (WHY, shortened)

trimmed.

```js
/* And the unfiltered case keeps the bare form, so the rule above is a
   DISTINCTION rather than a blanket rename. */
```

### scripts/check-admin-ui.mjs:3091 (WHY, shortened)

incident narrative moved.

```js
/* -------------------------------------------------------------------------
 * MEDIA v6: THE PARAMETER THAT MUST NOT EVAPORATE.
 *
 * **THIS IS THE INSTRUMENT THE TWO PREVIOUS INCIDENTS DID NOT HAVE.** `q` fell
 * off the pagination links once and `role` fell off the chips once. Neither was
 * visible to this gate, and that is structural rather than an oversight: the
 * payload baseline records METHOD, action and field names, and every one of
 * these links is a `GET` with no fields at all. `GET /admin/media` is the tuple
 * whether the href carries ten parameters or one.
 *
 * So this reads the rendered HREFS instead. It takes a state where every
 * parameter is set, renders the page, and asserts that each internal link back
 * to this page carries the whole set. A link built by hand, outside `hrefWith`,
 * fails here by name.
 *
 * The needle set is DERIVED from the module's own PARAM_NAMES rather than typed
 * again, because a hand-written list of parameters going stale against the real
 * one is precisely what both incidents were.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:3114 (WHY, shortened)

session history moved.

```js
/*
   * Every parameter non-default, so every one MUST appear in every link.
   *
   * **`view` IS "list" AND THAT IS LOAD BEARING, not a default left alone.**
   * It was "grid", and the column headers introduced in session 4 render only
   * in the list, so the newest link builder on the page was the one link
   * builder this scan could not see. A header that dropped `q` would have been
   * the third instance of the exact bug this block exists for, passing green.
   * The grid loses nothing by not being the scanned view: its tile links are
   * the same links the list draws, and the view toggle emits both either way.
   */
```

### scripts/check-admin-ui.mjs:3181 (WHY, shortened)

discovery story moved.

```js
/*
   * Every href pointing back at this page, which is the set that has to carry
   * the state. External links and the upload endpoint are not view links.
   *
   * THE SEARCH FORM IS CUT OUT FIRST, and that is a real exemption rather than
   * a convenience: the form OWNS `q`, so the Clear control inside it is the one
   * link on the page whose whole job is to drop it. Scanning it would make the
   * assertion below forbid the only correct way to clear a search.
   *
   * Found when the clear control started working: before this design pass the
   * Clear link was built from the role chip helper and CARRIED q, so pressing
   * Clear did not clear. The assertion caught the fix, which is the right way
   * round.
   */
```

### scripts/check-admin-ui.mjs:3200 (WHY, shortened)

trimmed.

```js
// NON-EMPTY SCOPE FIRST. Zero links found would make every assertion below
  // pass by examining nothing, which is this repo's most-repeated defect class.
```

### scripts/check-admin-ui.mjs:3208 (CONTRACT, shortened)

trimmed.

```js
/**
   * Parameters a link is ALLOWED to drop, with the reason.
   *
   * @type {Record<string, string>}
   */
```

### scripts/check-admin-ui.mjs:3214 (WHY, shortened)

trimmed.

```js
// A chip goes back to page one, deliberately: page 3 of one filter is not
    // page 3 of another. So `page` may be absent from any link.
```

### scripts/check-admin-ui.mjs:3217 (WHY, shortened)

trimmed.

```js
// The parameter each control OWNS is the one it changes, and changing it to
    // the default legitimately removes it from the query.
```

### scripts/check-admin-ui.mjs:3235 (WHY, shortened)

trimmed.

```js
/*
   * THE ASSERTION, and it is deliberately about `q` above all.
   *
   * `q` is the one parameter NO control on this page owns: nothing here is a
   * "clear the search" link except the explicit one, so a link that drops it is
   * always the bug. The other parameters each have exactly one owner and are
   * checked as a set instead: at least one link must carry each, which catches
   * a parameter that vanished from the page entirely.
   */
```

### scripts/check-admin-ui.mjs:3262 (CONTRACT, shortened)

session heading moved.

```js
/* -------------------------------------------------------------------------
 * MEDIA v6 session 4: the document card, the caption bar, and the table.
 *
 * NONE OF THIS IS VISIBLE TO THE PAYLOAD BASELINE, and that is why it is here
 * rather than left to the fixture. The baseline records `METHOD action | intent
 * | field names`. A document card is text, a caption bar is text, a column
 * heading is a `GET` link with no fields, and the copy control is a
 * `type="button"` that submits nothing at all. Every one of the four things
 * this session shipped could be deleted outright without moving a single tuple
 * in `admin-ui.json`.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:3274 (CONTRACT, shortened)

trimmed.

```js
/* ---- 1. THE DOCUMENT CARD ---------------------------------------------- */
```

### scripts/check-admin-ui.mjs:3282 (WHY, shortened)

trimmed.

```js
/*
 * THE TITLE IS THE WORDS, and this is the assertion the whole item turns on.
 * The fixture's key is `/publications/edwards-2024-phage-genomics.pdf`, so the
 * expected string is written out HERE rather than produced by calling
 * `docTitle`, per rule 10's fixture-independence clause: a gate whose expected
 * value comes out of the code under test is a mirror.
 */
```

### scripts/check-admin-ui.mjs:3295 (WHY, shortened)

trimmed.

```js
/* BOTH DIRECTIONS. The positive above passes on a card that ALSO printed the
   raw filename somewhere, which is exactly the duplication this design removed:
   `edwards 2024 phage genomics` over `edw...omics.pdf` is the same file twice,
   one of them in the elided form. */
```

### scripts/check-admin-ui.mjs:3313 (WHY, shortened)

trimmed.

```js
/*
 * THE RULED LINES ARE DECORATION AND ARE MARKED AS SUCH. Three empty spans
 * suggesting text is exactly the kind of thing that reads as three blank list
 * items to a screen reader if nobody hides it.
 */
```

### scripts/check-admin-ui.mjs:3324 (WHY, shortened)

mockup story moved.

```js
/*
 * THE PAGE COUNT IS NOT FAKED, and this is the honest half of item 1.
 *
 * The mockup's document card ends with "24 pages". Nothing in this system
 * stores a page count: `media` carries bytes, mime, width and height, and width
 * and height are null for every PDF. The card carries the SIZE instead, and
 * this asserts both halves: the size is there, and no page count was invented
 * to fill the space. A future column can turn this around; until then a gate
 * saying so is what stops somebody adding a plausible number.
 */
```

### scripts/check-admin-ui.mjs:3340 (WHY, shortened)

first-draft story moved.

```js
/*
 * THE CARD DOES NOT REPEAT THE TILE'S OWN META LINE.
 *
 * The card carried a size along its bottom for one render, in the slot the
 * mockup fills with a page count, and the tile's meta line prints the size too,
 * so `1.4 MB` appeared twice inside sixty pixels and read as a bug on a
 * screenshot. The mockup has no such problem because its tile has NO BODY: the
 * card is the whole tile. This one has always had a body.
 *
 * **SCOPED TO THE CARD, and the first draft was not, which cost a red run
 * worth keeping.** It counted the string across the whole tile and expected
 * one, and found three: the list's Size column and its Dims column are in the
 * markup on every render by the one-tree rule and hidden by CSS in the grid.
 * Counting rendered TEXT to prove something about LAYOUT is a category error
 * this gate is especially prone to, because it renders with no stylesheet at
 * all and cannot see `display: none`. The property is about the card, so the
 * assertion reads the card.
 *
 * Paired with a scope check, because a `.media-doc` regex that stopped matching
 * would make the absence below pass over an empty string.
 */
```

### scripts/check-admin-ui.mjs:3366 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 2. THE CAPTION BAR ------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:3382 (WHY, shortened)

negative half kept; approval narrative cut.

```js
/*
 * AN UNSELECTED GRID HAS NO CAPTION. Without this the assertion above passes on
 * a page that draws the bar over all seventy tiles, which is a different design
 * and not the one that was approved.
 */
```

### scripts/check-admin-ui.mjs:3393 (WHY, shortened)

reason kept, shortened.

```js
/*
 * EXACTLY ONE COPY CONTROL PER CARD, in both states.
 *
 * The caption carries the copy button, and the body's copy button is not
 * rendered when it does. Two controls with the same accessible name on one card
 * is read twice by a screen reader and chosen between for no reason by a
 * pointer. The payload baseline cannot see this at all: `type="button"` is not
 * a submission, so a tile with two copy buttons and a tile with one produce
 * byte-identical tuples.
 */
```

### scripts/check-admin-ui.mjs:3414 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 3. THE LIST HEADER, AND THE URLS IT PRODUCES ----------------------- */
```

### scripts/check-admin-ui.mjs:3428 (WHY, shortened)

reason kept, shortened.

```js
/*
 * DIMS IS A LABEL RATHER THAN A DEAD LINK, both directions. There is no `dims`
 * sort key: half the library has no dimensions, so every document and every SVG
 * would pile up at one end of that order. A disabled-looking anchor would still
 * be focusable and still navigate.
 */
```

### scripts/check-admin-ui.mjs:3442 (WHY, shortened)

discrimination reason kept.

```js
/*
 * EXACTLY ONE ACTIVE COLUMN, and it is the one the view is sorted by.
 *
 * The state sorts by size, so Size carries `aria-sort="descending"` and the
 * other three carry `none`. Counting BOTH is what makes this fail on a
 * regression that marked every column active as easily as one that marked none.
 */
```

### scripts/check-admin-ui.mjs:3461 (CONTRACT, shortened)

intent and prohibition kept; quoted spec cut.

```js
/* -------------------------------------------------------------------------
 * THE SORT-LINK TUPLES, and this is the assertion the item was specified on.
 *
 * "Header sorts are GET links producing the same URLs the Display popover
 * already produces, so clicking a header and choosing from the popover must
 * land on identical URLs."
 *
 * READ OFF THE RENDERED MARKUP, both sides, and compared as STRINGS. Nothing
 * here recomputes an expected href: the property is that the page's two sort
 * controls agree with EACH OTHER, so both sides of the comparison have to come
 * out of the page. Calling `sortHref` to produce an expectation would assert
 * that the function equals itself.
 *
 * The active column is exempt and named: a header press on the column you are
 * already sorted by REVERSES it, which every table does and which the popover
 * deliberately does not, so those two hrefs are supposed to differ. Asserting
 * they matched would forbid the toggle.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:3494 (WHY, shortened)

trap kept; incident reference cut.

```js
/*
   * RESOLVED THROUGH `readView`, never read off the query string.
   *
   * `hrefWith` OMITS a parameter equal to its default, so the sort a link MEANS
   * and the sort it SPELLS are different questions, and the loader answers the
   * first one. Asking the second is how the header filter above went wrong.
   */
```

### scripts/check-admin-ui.mjs:3506 (WHY, shortened)

shortened.

```js
/* The header's children are spans and anchors and nothing nests inside it, so
     the first `</div>` is its own. */
```

### scripts/check-admin-ui.mjs:3509 (WHY, shortened)

trap kept, shortened.

```js
/* The popover's SORT group only. The Direction group next to it also emits
     links back to this page, and they resolve to the CURRENT sort key, so
     scanning the whole panel would put a direction link in the name column's
     slot and compare two unrelated controls. */
```

### scripts/check-admin-ui.mjs:3515 (WHY, shortened)

prohibition kept; first-draft story moved.

```js
/*
   * NOT FILTERED ON `sort=` APPEARING IN THE QUERY STRING, and the first draft
   * of this was. That draft cost a red run and was worth it: `hrefWith` OMITS a
   * parameter equal to its default, so the Added column at the default
   * direction produces a BARE `/admin/media` carrying neither token. The filter
   * dropped exactly one column, reported it as MISSING FROM THE HEADER rather
   * than as filtered out of the scan, and would have gone on hiding it. Every
   * anchor in this block is a column heading; there is nothing to filter.
   */
```

### scripts/check-admin-ui.mjs:3527 (WHY, shortened)

scope-first reason kept.

```js
// SCOPE FIRST, BOTH SIDES. Either block failing to match its regex would make
  // every comparison below pass over an empty list, which is this repo's most
  // repeated defect class and the reason rule 10 exists.
```

### scripts/check-admin-ui.mjs:3571 (WHY, shortened)

reason kept, shortened.

```js
/*
   * THE TOGGLE, asserted rather than assumed. The active column's header must
   * REVERSE the direction; the popover's option for the same column must not.
   * Without this the exemption above is a hole somebody could drive the whole
   * header through by making every column non-toggling.
   */
```

### scripts/check-admin-ui.mjs:3589 (CONTRACT, shortened)

intent kept; session label cut.

```js
/* -------------------------------------------------------------------------
 * MEDIA v6 session 5: THE THREE-STATE USAGE MODEL and everything it feeds.
 *
 * **NONE OF THIS IS VISIBLE TO THE PAYLOAD BASELINE.** Three usage states, four
 * lens notes, three empty states, a suggestion, a duplicate sentence and a set
 * of copy labels are all TEXT, and the baseline records `METHOD action | intent
 * | field names`. The whole model could be reverted to the old binary without
 * moving a single tuple.
 *
 * The assertions below are therefore about SENTENCES, and about the one thing
 * that makes a sentence dangerous: a page can say "unattached" truthfully and
 * "unused" falsely with the same layout.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:3606 (WHY, shortened)

derivation reason kept.

```js
/*
   * THE MODEL AND THE RENDER AGREE ON THE VOCABULARY.
   *
   * Derived from the module rather than typed here, for the reason the
   * evaporation needles are derived from PARAM_NAMES: a hand-written list of
   * states going stale against the real one is exactly how a fourth state would
   * ship undocumented, or a retired one keep an assertion alive.
   */
```

### scripts/check-admin-ui.mjs:3626 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 1. THE THIRD STATE, ON EVERY SURFACE ------------------------------- */
```

### scripts/check-admin-ui.mjs:3638 (WHY, shortened)

shortened.

```js
/* THE NEGATIVE, on a row that genuinely has no reference, so the assertion
   above is known to discriminate rather than to match every row. */
```

### scripts/check-admin-ui.mjs:3651 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 2. THE INSPECTOR NAMES ITS EVIDENCE -------------------------------- */
```

### scripts/check-admin-ui.mjs:3654 (WHY, shortened)

reason kept; date cut.

```js
// NARROWED 2026-08-21. "Placed by page code" is the usage STATE and is a
  // fact: it has to agree with the data-usage="template" assertion below.
  // "Found by scanning the repository" was the boundary sentence's WORDING, and
  // pinning wording makes an equally true rephrasing a build failure.
```

### scripts/check-admin-ui.mjs:3662 (WHY, shortened)

shortened.

```js
/*
 * AND IT NAMES THE FILE. A claim with no evidence behind it is the thing the old
 * two-state model had: it said "nothing cites this" and could not say what it
 * had looked at.
 */
```

### scripts/check-admin-ui.mjs:3672 (WHY, shortened)

prohibition kept.

```js
/*
 * THE SENTENCE THE WHOLE FEATURE EXISTS TO STOP. An unattached file must never
 * be described as unused, because the scan cannot see a constructed path and an
 * external site can link anything. Asserted as an ABSENCE, with the positive
 * above proving the panel renders at all.
 */
```

### scripts/check-admin-ui.mjs:3683 (WHY, shortened)

shortened.

```js
/* The paragraph RENDERS on every listing, so a reader who never opens the
   inspector still gets a caveat. */
```

### scripts/check-admin-ui.mjs:3690 (WHY, shortened)

mechanism kept; commit story moved.

```js
/*
 * AND ITS WORDING IS ASSERTED AT SOURCE, not through the fixture.
 *
 * The note is loader data, so the fixture supplies one and the component echoes
 * it: asserting the words through a render would be asserting that the gate's
 * own copy says what the gate expects. The shipped sentence lives in the route,
 * so that is where it is read from.
 *
 * **THE OLD SENTENCE WAS TRUE UNTIL THIS COMMIT AND IS NOW FALSE.** It said an
 * asset referenced only by route code "has no citation here", which was the
 * honest confession of a two-state tracker. The scan sees route code now, so the
 * absence half of this assertion is what stops the confession being restored by
 * a future edit that has forgotten the scan exists.
 */
```

### scripts/check-admin-ui.mjs:3728 (WHY, shortened)

prohibition and scoping kept; screenshot incident moved.

```js
/* -------------------------------------------------------------------------
 * THE FORBIDDEN WORD, guarded on the RENDERED PAGE.
 *
 * The usage ruling says this page may never call a file "unused": the
 * repository scan cannot see a path the code builds at runtime, and nothing
 * here can see an external site linking a file. "unattached" is an absence of
 * evidence and says so; "unused" is a claim about the world that no check here
 * can support.
 *
 * The standing usage-note sentence has been guarded at source since the note
 * was rewritten. **THE TILE META LINE WAS NOT, and it kept the word for two
 * windows**: `cited ? " used" : " unused"` was written when the page had two
 * states, survived the three-state model landing, and rendered
 * `content 189 kB, unused` on the same nine roster photographs the list view
 * beneath it called "in template". Found by looking at a screenshot, not by any
 * gate.
 *
 * ASSERTED OVER MARKUP rather than over source, because the defect was a
 * rendered string. Scoped to the tile's meta element so the word remains legal
 * in the prose that EXPLAINS why it is illegal, which is the trap a bare
 * page-wide search would fall into.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:3761 (WHY, shortened)

shortened.

```js
// SCOPE FIRST: zero meta lines would make the absence below pass by
    // examining nothing, which is this repo's most repeated defect class.
```

### scripts/check-admin-ui.mjs:3768 (WHY, shortened)

trap kept; plant and first-draft story moved.

```js
/*
 * AND THE POSITIVE, so the absence above cannot pass on a tile that stopped
 * printing usage at all. A plant proved it could: deleting the label left the
 * gate green.
 *
 * **THROUGH THE SAME EXTRACTION AS THE NEGATIVE, and the first draft was not.**
 * It matched `class="media-meta">[\s\S]*?unattached[\s\S]*?</p>`, and a
 * non-greedy run of `[\s\S]` happily crosses `</p>` to reach the word in the
 * list view's usage cell further down the document, then finds some later
 * closing tag. The assertion passed on a meta line that said nothing at all.
 * An element-bounded read is the only way to assert about one element.
 */
```

### scripts/check-admin-ui.mjs:3797 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 3. PER-ROW FLAGS AND THE TILE DOT ---------------------------------- */
```

### scripts/check-admin-ui.mjs:3804 (WHY, shortened)

trap kept; first-draft story moved.

```js
/*
 * SCOPED TO THE FLAGS ELEMENT, and the first draft was not.
 *
 * `!h.includes("no alt")` over the whole page matched the no-alt LENS CHIP's own
 * hint, "Images with no alt text written yet", which is present on every render
 * and says nothing about this row. The assertion failed on correct markup, which
 * is the right direction to be wrong in but is still a broken instrument: it
 * would have gone on failing whatever the row did.
 */
```

### scripts/check-admin-ui.mjs:3826 (WHY, shortened)

discrimination reason kept; plant story moved.

```js
/*
 * **AND A TILE WITH NOTHING WORTH FLAGGING CARRIES NO DOT.**
 *
 * The assertion above cannot fail on its own and a plant proved it. Replacing
 * `tileFlagFor` with `flags.length > 0` left it green, because on that fixture
 * both expressions render exactly one dot: the document is over 1 MB, so the
 * flag list is non-empty AND the precedence picks a member.
 *
 * The two only disagree where the flag list is non-empty and the PRECEDENCE
 * selects nothing: a large file that is cited by a post, has alt text and has no
 * twin. `flagsFor` returns ["large"], `tileFlagFor` returns null, and a tile
 * should be quiet. This is that state.
 */
```

### scripts/check-admin-ui.mjs:3844 (WHY, shortened)

shortened.

```js
/* And the flag itself is still REACHABLE on that same row, in the list, so the
   assertion above is about the tile being quiet rather than about the flag
   having been dropped everywhere. */
```

### scripts/check-admin-ui.mjs:3853 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 4. LENS NOTES AND EMPTY STATES ------------------------------------- */
```

### scripts/check-admin-ui.mjs:3856 (WHY, shortened)

reason kept; date and tier cut.

```js
// NARROWED 2026-08-21 to the note's PRESENCE and its escape control. The
  // sentence inside it was pinned word for word, which is the class tier 4.1
  // named. That the note exists at all, and that it offers a way out, are the
  // properties worth holding; its exact phrasing is the writer's.
```

### scripts/check-admin-ui.mjs:3870 (WHY, shortened)

shortened.

```js
/* THE THREE EMPTY STATES, each asserted to be the RIGHT one. A single assertion
   that "an empty state rendered" would pass on any of the three appearing in
   all three situations, which is the defect this replaces. */
```

### scripts/check-admin-ui.mjs:3876 (HISTORY, deleted)

narrowing note; code shows the facts.

```js
// NARROWED 2026-08-21: the state attribute and the call to action are facts.
  // "Nothing here yet" was the headline's wording.
```

### scripts/check-admin-ui.mjs:3883 (WHY, shortened)

reason kept; date cut.

```js
// NARROWED 2026-08-21: echoing the QUERY back is the property, since a miss
  // that does not say what was searched for is the defect. The list of searched
  // FIELDS was prose and is also a claim that ages: adding a searched field
  // would mean editing this gate rather than the page.
```

### scripts/check-admin-ui.mjs:3892 (HISTORY, deleted)

narrowing note; exclusion below explains itself.

```js
// NARROWED 2026-08-21 to the state attribute. Telling the three empty states
  // apart is what the data-empty values do, and the mutual-exclusion assertions
  // directly below are what make that binding load-bearing.
```

### scripts/check-admin-ui.mjs:3897 (WHY, shortened)

shortened.

```js
/* AND THEY ARE MUTUALLY EXCLUSIVE. Without this, one state rendering in all
   three situations would satisfy all three assertions above. */
```

### scripts/check-admin-ui.mjs:3905 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 5. SUGGESTIONS, OFFERED AND NOT APPLIED ---------------------------- */
```

### scripts/check-admin-ui.mjs:3912 (WHY, shortened)

shortened.

```js
/* THE NEGATIVE, and it is the one that matters: a suggestion beside text
   somebody already wrote is an invitation to overwrite their sentence. */
```

### scripts/check-admin-ui.mjs:3924 (WHY, shortened)

reason kept; unasserted counts cut.

```js
/* A DOCUMENT TAKES NO ALT TEXT, so the field is not offered at all. It was on
   all 70 rows, which invents an obligation on the 31 that cannot discharge it. */
```

### scripts/check-admin-ui.mjs:3932 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 6. COPY LABELS THAT ADAPT ------------------------------------------ */
```

### scripts/check-admin-ui.mjs:3945 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 7. THE DUPLICATE SURFACE ------------------------------------------- */
```

### scripts/check-admin-ui.mjs:3960 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 8. THE PALETTE, THE SHORTCUTS AND THE Cmd+K BADGE ------------------ */
```

### scripts/check-admin-ui.mjs:3962 (HISTORY, deleted)

session story; the next blocks carry the rule.

```js
/*
 * THE RULING THIS SATISFIES: an absent shortcut must not be advertised. The
 * badge was held back for a whole session with that reason written down, so
 * asserting it now is asserting that the binding it advertises exists.
 */
```

### scripts/check-admin-ui.mjs:3976 (WHY, shortened)

pointer kept; date cut.

```js
// NARROWED 2026-08-21 to the row COUNT, which is what "documents every
    // binding" means. The two descriptions were prose samples of nine rows and
    // proved nothing the count does not. The real coverage is the assertion
    // below binding the rendered count to MEDIA_SHORTCUTS in both directions.
```

### scripts/check-admin-ui.mjs:3983 (CONTRACT, shortened)

shortened.

```js
/*
 * THE SHORTCUTS PANEL AND THE SHORTCUT TABLE NAME THE SAME SET, so a binding
 * cannot be documented without existing or exist without being documented. The
 * count is read out of the RENDERED markup and compared against the module's own
 * table length, neither of them typed here.
 */
```

### scripts/check-admin-ui.mjs:4000 (WHY, shortened)

rule and mechanism kept; plant story moved.

```js
/*
   * **AND EVERY DOCUMENTED SHORTCUT IS ACTUALLY WIRED.**
   *
   * The assertion above is a tautology on its own and a plant proved it: adding
   * a fake row ("ctrl D, delete everything instantly") increments BOTH counts,
   * so they stayed equal and the gate stayed green. It can only ever catch the
   * panel failing to render, which is not the rule.
   *
   * The rule is that this page must not advertise a binding nobody wired, which
   * is why the Cmd+K badge was withheld for a session with that reason written
   * down. So each row names the expression that implements it and this greps the
   * two islands for it. A fake row has no expression to name.
   */
```

### scripts/check-admin-ui.mjs:4035 (WHY, shortened)

boundary kept; plant story moved.

```js
/* -------------------------------------------------------------------------
 * THE LOADER WIRING, ASSERTED AT SOURCE, because this harness cannot run a
 * loader and says so in its own header.
 *
 * A plant proved the gap: replacing the loader's `templateRefs` lookup with a
 * literal `0` left every assertion green. The states supply `usage` as fixture
 * INPUT, so the component renders whatever it is given and the model can be
 * disconnected without a single rendered byte changing. That is the harness
 * boundary working exactly as documented, and it means the wiring needs a
 * different instrument.
 *
 * These are source greps, which is a weaker instrument than a render and is the
 * strongest one available here. They assert the three joins exist: the artifact
 * is imported, the row usage is computed from it, and BOTH readers of the
 * unattached predicate are handed the same key list.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:4071 (WHY, shortened)

shortened.

```js
/*
   * BOTH READERS OF THE PREDICATE GET THE SAME LIST. The listing and the lens
   * count are separate queries, and the Unused chip already shipped once with a
   * count from one predicate and a filter from another.
   */
```

### scripts/check-admin-ui.mjs:4089 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 8b. THE COCKPIT RENDERS THE INSTRUMENT, NOT ITS OWN ARITHMETIC ------ */
```

### scripts/check-admin-ui.mjs:4091 (WHY, shortened)

rule 17 reason kept, shortened.

```js
/*
 * The page is the human-readable view of the health run and `sync_status`, and
 * rule 17 says a view renders what an instrument reports rather than computing
 * a second answer beside it. These assertions are what make that checkable
 * from outside the file.
 *
 * THE VERDICT SENTENCE IS THE TEST. Each fixture check carries a `detail`
 * string with its own numbers, and the page must put THAT STRING on the page.
 * A page that formatted its own sentence from `expected` and `present` would
 * render something that looks identical today and drifts the first time a
 * verdict is reworded, which is precisely the failure this repo keeps paying
 * for. Asserting the sentence catches it; asserting "a number appears" does
 * not.
 */
```

### scripts/check-admin-ui.mjs:4106 (WHY, shortened)

owner pointer kept.

```js
/*
   * EVERY CHECK IS ON THE PAGE, NAMED IN THE OPERATOR'S WORDS. Ruling 54: the
   * instrument ids are what the source calls these, and four of the five do not
   * name the thing they are about. The mapping is CHECK_COPY, and asserting
   * against it rather than against a list retyped here is what stops this gate
   * becoming a second owner of the names.
   */
```

### scripts/check-admin-ui.mjs:4116 (WHY, shortened)

shortened.

```js
/*
   * AND THE INSTRUMENT IDS ARE GONE. The positive half above would pass on a
   * page that printed both, which is the state this ruling was written against.
   */
```

### scripts/check-admin-ui.mjs:4125 (WHY, shortened)

shortened.

```js
/*
   * THE FIGURES ARE STILL THE INSTRUMENT'S. check-copy.mjs owns nouns and verbs
   * only: a failing check's sentence substitutes from the verdict's own
   * `counts`, and a check that ships none renders its own `detail`. So this
   * asserts the count SURVIVED the rewording, which is the half rule 17 cares
   * about, rather than the wording itself.
   */
```

### scripts/check-admin-ui.mjs:4146 (WHY, shortened)

shortened.

```js
/*
 * A FAILING CHECK IS DISTINGUISHABLE FROM A PASSING ONE, in the markup and not
 * only in a colour. `StatusDot` carries `data-status` plus a visually hidden
 * word, so this asserts the state reaches assistive technology rather than
 * asserting a hue.
 */
```

### scripts/check-admin-ui.mjs:4155 (WHY, shortened)

shortened.

```js
/*
 * ONE ROW IS MARKED FAILING AND EXACTLY ONE. The verdict is a WORD first, then
 * a colour, then a border style, so it survives forced-colors; the check is on
 * the word, because that is the channel that cannot be taken away.
 */
```

### scripts/check-admin-ui.mjs:4165 (WHY, shortened)

shortened.

```js
/*
 * AND ONLY THE FAILING ROW OFFERS A REPAIR. A kebab on a passing row opens onto
 * nothing, which is the empty-Maintenance defect one level down.
 */
```

### scripts/check-admin-ui.mjs:4176 (HISTORY, deleted)

duplicate of the next block.

```js
/*
 * THE STORE COUNTS ARE THE ONES HANDED IN. A page that hard-coded a plausible
 * number would pass every assertion above.
 */
```

### scripts/check-admin-ui.mjs:4180 (WHY, shortened)

reason kept; ruling narrative cut.

```js
/*
 * THE FIGURES ARE THE ONES HANDED IN. A page that hard-coded a plausible number
 * would pass every assertion above.
 *
 * TWO OF THEM ARE ON THE SURFACE since ruling 54, and the other two are under a
 * disclosure: what the repository holds and what the site is serving are the
 * pair that can disagree, and the disagreement is why the panel exists. The
 * search count still has to be PRESENT, which is what stops "moved it under a
 * details" becoming "dropped it".
 */
```

### scripts/check-admin-ui.mjs:4197 (WHY, shortened)

shortened.

```js
/*
 * D1 BEHIND THE ARTIFACT IS SHOWN AS A DISAGREEMENT rather than left for the
 * reader to spot by comparing two cards. Amber, not red: the ship-time sync
 * repairs it, so a gap is usually a window.
 */
```

### scripts/check-admin-ui.mjs:4206 (WHY, shortened)

shortened.

```js
/*
 * DIVERGENCES ARE ABSENT WHEN THERE ARE NONE. An empty list is the normal
 * answer, and a permanently empty panel is furniture that trains a reader to
 * stop looking at the place the real answer will appear.
 */
```

### scripts/check-admin-ui.mjs:4221 (CONTRACT, shortened)

shortened.

```js
/*
 * THE SECRETS AUDIT REPORTS PRESENCE AND NEVER A VALUE, which is the property
 * `test/secrets-audit.test.mjs` asserts on the payload and this asserts on the
 * rendered page: the two together cover the module and its render.
 */
```

### scripts/check-admin-ui.mjs:4236 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 9. THE NO-SCRIPT FLOOR --------------------------------------------- */
```

### scripts/check-admin-ui.mjs:4238 (WHY, shortened)

rule kept, shortened.

```js
/*
 * **EVERY ENHANCEMENT IS ADDITIVE, ASSERTED RATHER THAN CLAIMED.**
 *
 * The palette, the toast and the keyboard navigator all need script, which is
 * accepted for this page. What is NOT accepted is any of them becoming the only
 * way to do something. The harness renders with no script at all, which makes it
 * the right instrument for exactly this: whatever it can see is what a reader
 * with scripting off gets.
 *
 * So the search form must still be a real GET form, and the suggestion and tag
 * chips must still be real submit buttons rather than click handlers.
 */
```

### scripts/check-admin-ui.mjs:4271 (CONTRACT, shortened)

intent kept; session label cut.

```js
/* -------------------------------------------------------------------------
 * MEDIA v6 session 6: THE DRAWER, THE MODALS, AND THE NO-SCRIPT FLOOR UNDER
 * BOTH.
 *
 * The whole point of these surfaces is that they overlay the page, and an
 * overlay is exactly the shape that becomes unreachable or undismissable if one
 * piece is missing. The harness renders with NO script and NO stylesheet, which
 * makes it the right instrument for the half that must not depend on either:
 * the markup, the roles, and whether a control is a real link or a handler.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:4282 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 1. THE DRAWER ------------------------------------------------------ */
```

### scripts/check-admin-ui.mjs:4291 (WHY, shortened)

shortened.

```js
/*
 * THE SCRIM IS A LINK, not a div with a handler, which is the difference
 * between a drawer you can dismiss with no script and one you cannot. Asserted
 * as an ANCHOR carrying an href, because a div would render identically here in
 * every way except the one that matters.
 */
```

### scripts/check-admin-ui.mjs:4313 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 2. THE CONFIRMATIONS ----------------------------------------------- */
```

### scripts/check-admin-ui.mjs:4315 (WHY, shortened)

trap kept.

```js
/*
 * **THE DESTRUCTIVE SUBMISSION MOVED BEHIND A CONFIRMATION, and this pair is
 * what proves it moved rather than vanished.**
 *
 * `prompt()` ran from an `onSubmit` handler, so with scripting off the handler
 * never ran and the form submitted straight through: every trashed object
 * deleted with no confirmation at all. The trash view therefore must NOT carry
 * the intent any more, and the confirmation state MUST.
 */
```

### scripts/check-admin-ui.mjs:4336 (WHY, shortened)

trap kept.

```js
/*
 * AND THE BUTTON IS ENABLED IN THE SERVER RENDER. This looks backwards and is
 * the load-bearing half of the no-script path: rendering it disabled would
 * leave a reader without script unable to ever enable it, because nothing runs
 * to observe what they typed. The ACTION is the gate; the disabled state is
 * earlier feedback once hydrated.
 */
```

### scripts/check-admin-ui.mjs:4354 (WHY, shortened)

shortened.

```js
/*
   * THE NEEDLE IS BUILT FROM CONFIRM_FIELD, not from the literal it happens to
   * equal. The rendered attribute really is the literal, so a hardcoded needle
   * WORKS today; what it cannot survive is a rename. Renaming the constant
   * moves the component and the server together and leaves this assertion
   * looking for a name nothing emits, which passes vacuously in the negative
   * assertion below and fails confusingly here. Derived, a rename moves all
   * three at once.
   */
```

### scripts/check-admin-ui.mjs:4365 (WHY, shortened)

shortened.

```js
/* Cancel is a link, for the same reason the scrim is. */
```

### scripts/check-admin-ui.mjs:4372 (CONTRACT, shortened)

doc and hard rule 10 kept; plant story moved.

```js
/**
 * The MODAL'S OWN form, extracted before anything is asserted about it.
 *
 * The first draft of the assertion below searched the whole page for
 * `name="key" value="..."`, and every tile in the grid renders a form carrying
 * exactly that: a plant that dropped the modal's hidden keys entirely left this
 * green, because the needle was still on the page somewhere else. Only the
 * payload baseline caught it, which is a different assertion doing this one's
 * job. Unanchored needle, hard rule 10, and the fourth of that class here.
 *
 * @param {string} h
 * @returns {string}
 */
```

### scripts/check-admin-ui.mjs:4399 (WHY, shortened)

shortened.

```js
/*
 * AND IT ASKS NO COUNT. The ladder is unchanged: trashing is reversible and
 * touches neither R2 nor a public URL, so the type-the-count ceremony is spent
 * only where the action cannot be undone. A confirmation that asked for a count
 * here would be ceremony people learn to click through, which is what makes the
 * one on empty-trash stop working.
 */
```

### scripts/check-admin-ui.mjs:4412 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 3. THE FLOATING SELECTION BAR -------------------------------------- */
```

### scripts/check-admin-ui.mjs:4429 (CONTRACT, shortened)

section heading shortened.

```js
/* ---- 4. THE TILE CHROME IS IN THE MARKUP AT REST ------------------------ */
```

### scripts/check-admin-ui.mjs:4431 (WHY, shortened)

shortened.

```js
/*
 * The name and the checkbox are HIDDEN BY CSS until hover, focus or selection,
 * and hiding them in the markup instead would be a different and worse thing: a
 * keyboard reader would have nothing to tab to and the evaporation scan would
 * lose the tile links. The harness renders with no stylesheet, so what it sees
 * is exactly what must still be present.
 */
```

### scripts/check-admin-ui.mjs:4438 (WHY, shortened)

trap kept; measurements moved.

```js
/*
 * THE LABEL BELOW SAYS "its checkbox" RATHER THAN "checkbox", and that is not
 * style. `check:invariants` scans string literals for raw SQL, and its scanner
 * does not understand REGEX literals: `/<form[^>]*role="search"...` desyncs its
 * quote matching at stripped index 46569 of this very file, so everything after
 * it is read as one enormous phantom string. Inside that phantom, its bare
 * column extraction reads `AND <word> IN` as a WHERE clause, and the phrase
 * "name link and checkbox in the markup" made `checkbox` a column name that
 * exists in no table. Measured: one failure, 105 checks, from prose.
 *
 * Rewording is the small half. The real defect is the scanner, which can also
 * SWALLOW genuine SQL inside a phantom and check nothing: it consumed 3308
 * characters here. That belongs in the gate backlog, not in a rename.
 */
```

### scripts/check-admin-ui.mjs:4461 (CONTRACT, shortened)

shortened; session label cut.

```js
/* -------------------------------------------------------------------------
 * MEDIA v6 session 3: grouping headings and the ruled select-all wording.
 *
 * The payload fixture cannot see either. Headings are text, and the select-all
 * label is text; both are ruled behaviour, and a ruled behaviour with no
 * instrument drifts.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:4477 (WHY, shortened)

shortened; verdict story moved.

```js
/*
 * THE HEADING IS A TITLE AND THE NOTE IS THE POINT.
 *
 * It used to assert the raw prefix appeared. That was the shipped page's
 * behaviour and it was the thing Dustin's verdict was about: a heading reading
 * `/phage-hunters` explains nothing, and "Cohort photographs, placed by the
 * roster page template" explains everything. So the assertion moved with the
 * design rather than being deleted.
 */
```

### scripts/check-admin-ui.mjs:4501 (WHY, shortened)

shortened.

```js
/*
 * THE COUNT IS PAGE-LOCAL AND SAYS SO. This is the assertion that stops the
 * over-promise coming back: a heading count that read as a library total would
 * be the same defect session 2 shipped and this session was called to close.
 */
```

### scripts/check-admin-ui.mjs:4511 (WHY, shortened)

shortened.

```js
/* Flat renders NO heading at all, which is what makes the heading a signal. */
```

### scripts/check-admin-ui.mjs:4528 (WHY, shortened)

shortened.

```js
/* And the unfiltered case keeps the bare form, so the rule above is a
   DISTINCTION rather than a blanket rename. */
```

### scripts/check-admin-ui.mjs:4536 (WHY, shortened)

reason kept.

```js
/* -------------------------------------------------------------------------
 * Draft preview links: the two rulings the payload fixture cannot see.
 *
 * The baseline records METHOD, intent and field NAMES. It can see that a
 * published post issues neither request, because that is a payload difference.
 * It CANNOT see that the list prints six characters rather than the whole
 * token, because that is text, and a token is a capability: printing it is the
 * difference between a list you can screen-share and one you cannot.
 *
 * Every absence assertion below is PAIRED with the positive that proves its
 * needle can match, on a state where the thing is present. An absence check
 * whose needle is a typo passes on every page ever rendered.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:4552 (WHY, shortened)

reason kept; date cut.

```js
/*
 * THE REVOCATION SENTENCE, gated because it carries a MEASURED BOUND.
 *
 * The payload fixture records METHOD, intent and field names, so it cannot see
 * copy at all. This sentence is not decoration: it tells the author how long a
 * revoked link keeps working, and the number in it was measured on production
 * 2026-08-15 rather than chosen. A ruled behaviour with no instrument drifts,
 * and the specific drift to fear here is somebody tightening the prose back to
 * "the moment you revoke it" because it reads better.
 *
 * BOTH DIRECTIONS. The positive alone passes on a page that says both things;
 * the negative alone passes on a page that says neither. The forbidden phrase
 * is the exact wording that shipped and was measurably false.
 */
```

### scripts/check-admin-ui.mjs:4576 (WHY, shortened)

shortened.

```js
/* Publication IS immediate, because the read path re-asks D1, so that clause
   must survive the correction rather than being softened alongside it. */
```

### scripts/check-admin-ui.mjs:4610 (WHY, shortened)

shortened.

```js
/*
 * THE CAPABILITY IS NOT PRINTED. The absolute URL appears in the markup only
 * on the response that minted it, which is an actionData state and not this
 * one; here it lives in the copy control's handler and nowhere a reader or a
 * screen recording can see it.
 *
 * The token itself IS in the markup, once, as the revoke form's hidden field.
 * That is unavoidable: revoking has to name what it revokes. So this asserts
 * the absence of the URL, which is the thing somebody could paste, rather than
 * the absence of the token, which would be a false claim.
 */
```

### scripts/check-admin-ui.mjs:4626 (WHY, shortened)

shortened.

```js
// The needle validated against the state where it MUST match, so the absence
// above is known to be capable of failing.
```

### scripts/check-admin-ui.mjs:4646 (CONTRACT, shortened)

scope reason kept; audit and ruling history moved.

```js
/* -------------------------------------------------------------------------
 * The origin-requests panel: the copy law, asserted on the RENDERED PAGE.
 *
 * ASSERTED AGAINST MARKUP, NOT SOURCE, and the distinction is the whole point.
 * The module is named `traffic.server.ts`, the type is `TrafficRow` and the
 * stylesheet uses `.traffic-table`, so a grep for the forbidden word over the
 * source finds nine hits and every one of them is an identifier no reader ever
 * sees. The law is about what the page SAYS. Rendering the route and reading
 * the output is the only form of this check that means anything, and it is
 * strictly stronger: it would also catch the word arriving from a component
 * this route merely imports.
 *
 * The needles are word-anchored so "traffic" cannot be matched inside a longer
 * token, and each is validated against a decoy below so a typo in the pattern
 * cannot make the absence vacuous.
 *
 * ## THE CAPTION IS EXEMPT, SINCE 2026-08-21, AND THE AUDIT WAS RIGHT
 *
 * Tier 4.1 ruled this block out entirely, on the grounds that it "rejected the
 * sentence written to explain the metric it polices". That happened and is
 * recorded in `app/lib/admin/origin-requests.mjs`: the first draft of
 * CACHE_SENTENCE said "real traffic is therefore higher" and this gate refused
 * it.
 *
 * DELETING THE BLOCK IS THE WRONG REPAIR, because the defect is not the rule, it
 * is the SCOPE. A word ban cannot tell "this panel counts visits" from "this
 * number is not visits", and those two sentences live in different parts of the
 * page. Labels CLAIM. Prose EXPLAINS.
 *
 * So the ban runs against the markup with the EXPLAINING element removed. Every
 * label surface stays covered: the panel heading, the column headers, the chips,
 * the rows and the empty and error states. The one element whose job is to say
 * what the number is and is not stays free to name the thing it contrasts
 * against.
 *
 * THAT ELEMENT WAS A `<caption>` AND IS NOW A `<details>`, 2026-09-10. Ruling 54
 * took prose out of every admin table, because a caption is announced before
 * EVERY row: this five-sentence caveat was read once per path. It moved under
 * the table and the exemption followed it there, rather than being widened or
 * dropped. Same scope, different element.
 *
 * The positive half below is unchanged and is what actually guarantees the
 * honest label: every state must SAY "origin requests".
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:4691 (CONTRACT, shortened)

trap kept; measurement cut.

```js
/**
 * Whether a menu item with this label is in the markup.
 *
 * ATTRIBUTE ORDER IS NOT SOURCE ORDER. React reorders them, measured on this
 * repo's own render: a button written `type`, `name`, `value`, `className`
 * came back `type`, `value`, `class`, `name`. So the question is asked as "a
 * button element that carries both marks and has this label", never as one
 * literal string.
 *
 * @param {string} html @param {string} label
 */
```

### scripts/check-admin-ui.mjs:4715 (CONTRACT, shortened)

shortened.

```js
/** The rendered markup minus the one element allowed to name what this is not. */
```

### scripts/check-admin-ui.mjs:4719 (WHY, shortened)

shortened.

```js
/*
 * THE EXEMPTION IS ITSELF ASSERTED. A `<caption>` regex that matched nothing
 * would leave the ban exactly as wide as before and this narrowing would be a
 * comment describing a change that did not happen; one that matched too much
 * would exempt the whole panel and every absence check below would pass by
 * examining an empty string.
 */
```

### scripts/check-admin-ui.mjs:4742 (WHY, shortened)

shortened.

```js
// A NEEDLE THAT CANNOT MATCH PROVES NOTHING. Validated against a decoy first,
  // so the absence assertions below are known to be capable of failing.
```

### scripts/check-admin-ui.mjs:4758 (WHY, shortened)

controlled comparison kept; roadmap label cut.

```js
/* -------------------------------------------------------------------------
 * THE READERSHIP COLUMN. Roadmap item G, first half.
 *
 * The payload baseline cannot see any of this: a `<td>` submits nothing, so
 * every one of the three new states records the identical tuple set and the
 * fixture moved only by gaining three names. What is actually at stake here is
 * whether a MISSING number renders as a missing number, and that is a rendering
 * property or it is nothing.
 *
 * ## THE PAIR THAT MAKES IT MEAN SOMETHING
 *
 * `readership live` and `readership truncated` carry the SAME `byPath`, with
 * the same slug absent from both, and differ in one boolean. So the assertions
 * below are a controlled comparison rather than two independent readings: if
 * the component ignored `complete` entirely, one of the two would fail, and a
 * gate that only ever rendered one of them would pass while it did.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:4782 (WHY, shortened)

shortened; ruling narrative moved.

```js
/*
 * The honest label, on every state, including the ones with no number to show.
 *
 * IT IS "Reads counted" SINCE RULING 54, and the change is the meeting point of
 * two rulings rather than a rewording. Ruling 54 takes "origin requests" off the
 * operator's page; the copy law below forbids "views", "visits", "visitors" and
 * "traffic" here, because a cached read never reaches the Worker and any of
 * those would overstate readership. The participle is what satisfies both: it
 * claims only what was counted, and the disclosure under the table says what was
 * not. The forbidden list is UNCHANGED, so the old overstatement is still gated.
 */
```

### scripts/check-admin-ui.mjs:4805 (WHY, shortened)

shortened.

```js
/*
 * THE MEASURED ZERO. `wip` is absent from `byPath` and the source is complete,
 * so zero is the answer and the column says zero.
 */
```

### scripts/check-admin-ui.mjs:4815 (WHY, shortened)

trap kept.

```js
/*
 * THE SAME ABSENCE, NOT ZERO, because the result was cut. This is the assertion
 * ruling 2 exists for and the one a careless implementation fails: the easy
 * version of this feature renders `byPath[path] ?? 0` and passes everything
 * above while failing here.
 */
```

### scripts/check-admin-ui.mjs:4832 (WHY, shortened)

shortened.

```js
/*
 * THE DISCRIMINATION CONTROL. The two states differ only in `complete`, so if
 * their rendered readership cells are identical the flag is not being read and
 * every assertion above is passing for the wrong reason.
 */
```

### scripts/check-admin-ui.mjs:4851 (WHY, shortened)

shortened.

```js
/*
 * THE SOURCE BEING DOWN. Every row carries the reason and NO row carries a
 * number, which is the pair that stops an absence being read as a zero.
 */
```

### scripts/check-admin-ui.mjs:4866 (WHY, shortened)

shortened.

```js
/*
 * THE CAVEAT IS THE SHARED SENTENCE, not a second telling of it. Asserted
 * against the constant itself, so a paraphrase written here later fails rather
 * than quietly becoming a second owner of a measured claim. Rule 17.
 */
```

### scripts/check-admin-ui.mjs:4877 (WHY, shortened)

shortened.

```js
/*
 * THE COPY LAW REACHES THIS PAGE TOO, on the same terms as the panel it takes
 * its number from: labels claim, prose explains, so the caption is exempt and
 * every other surface is not. Enumerating the second site is the point; a rule
 * enforced on one of the two pages showing this number is the "fix in N-1 of N
 * sites" shape.
 */
```

### scripts/check-admin-ui.mjs:4900 (WHY, shortened)

shortened.

```js
// The required half. An absence check alone would pass on a blank page.
```

### scripts/check-admin-ui.mjs:4907 (WHY, shortened)

shortened.

```js
/* The three states are genuinely different pages, not one page three times. */
```

### scripts/check-admin-ui.mjs:4934 (WHY, shortened)

shortened.

```js
/* The error state is visible prose, and the rest of the panel survives it. */
```

### scripts/check-admin-ui.mjs:4951 (WHY, shortened)

both-halves reason kept; probe history moved.

```js
/*
 * THE CACHE SENTENCE, AND THE DAY THIS ASSERTION INVERTED.
 *
 * It read "the unmeasured cache sentence is still declared as a stated
 * absence" and required the placeholder to be PRESENT, so the gap was visible
 * in the product and here rather than quietly forgotten. `scripts/ship.mjs`
 * refused to deploy while it was there, which made ship day loud.
 *
 * `npm run ae-probe` ran on 2026-08-14 and the sentence is now measured, so
 * the assertion turns over: the answer must be present and the placeholder's
 * wording must be gone. BOTH halves, because either alone is satisfiable by a
 * page that says nothing at all.
 */
```

### scripts/check-admin-ui.mjs:4975 (WHY, shortened)

shortened.

```js
/* -------------------------------------------------------------------------
 * The webmention moderation queue.
 *
 * EVERY VALUE ON THIS PAGE CAME FROM A STRANGER, so the render IS the boundary
 * and the fixture carries the hostile shapes on purpose. An assertion that only
 * checked the page renders would make that fixture decoration: the `<script>`
 * in `MENTIONS[0].authorName` has to be read back, in both directions, or a
 * page that stripped it and a page that executed it would score the same.
 * ---------------------------------------------------------------------- */
```

### scripts/check-admin-ui.mjs:4995 (WHY, shortened)

shortened.

```js
/* The other direction, and it is the one that matters: the escaped form
     being present does not by itself prove the live form is absent, because a
     page could render both. */
```

### scripts/check-admin-ui.mjs:5001 (WHY, shortened)

shortened.

```js
/* The source URL is TEXT. An admin page is not a place to put a one-click
     navigation to a URL an unauthenticated POST chose; H2's public render is
     the one that gets an anchor, with rel="nofollow ugc noopener". */
```

### scripts/check-admin-ui.mjs:5007 (WHY, shortened)

shortened.

```js
/* The target IS a link, to the post's editor, because that slug came from
     this site's own corpus rather than from the sender. */
```

### scripts/check-admin-ui.mjs:5012 (WHY, shortened)

ruling label cut.

```js
/* RULING 21b: the excerpt LEADS, and it leads as a quotation. A row whose
     evidence rendered as another paragraph would read as the page's own prose
     rather than as something a stranger wrote. */
```

### scripts/check-admin-ui.mjs:5020 (WHY, shortened)

shortened.

```js
/*
 * THE FILTER ROW, which is ruling 21a and is the whole shape of the redesign.
 *
 * Asserted as five chips WITH THEIR COUNTS rather than as five links, because
 * a row of chips carrying no numbers is the same navigation with the reason to
 * look at it removed, and that is exactly what a refactor drops first.
 */
```

### scripts/check-admin-ui.mjs:5044 (WHY, shortened)

shortened.

```js
/*
 * THE ALL COUNT IS THE WHOLE TABLE, which is what makes the row honest: four
 * status counts plus the unverified chip equals it. MENTIONS carries one row of
 * every status including `unverified`, so an `all` that quietly excluded the
 * unverified row would read 4 here and this would fail. That is the assertion,
 * not the number: the fixture has five rows and the chip says five.
 */
```

### scripts/check-admin-ui.mjs:5057 (WHY, shortened)

shortened.

```js
/* Exactly one chip is current, and it is the one the loader resolved. */
```

### scripts/check-admin-ui.mjs:5071 (WHY, shortened)

ruling label cut.

```js
/* RULING 21f. The unverified count is a chip on the same row, and it is NOT a
   link, because there is no decision to make about a row that has not been
   verified yet. */
```

### scripts/check-admin-ui.mjs:5079 (WHY, shortened)

shortened.

```js
/* And it is ABSENT rather than reading zero. A chip saying 0 is an alarm about
   nothing, which is the rule the media library's lens dots already follow. */
```

### scripts/check-admin-ui.mjs:5087 (WHY, shortened)

shortened.

```js
/*
 * NO PANEL HEADINGS. The four `<h2>` group headings are what ruling 21a
 * removed, and their absence is asserted rather than assumed: a redesign that
 * kept the filter row AND the headings would look finished and would still be
 * the page the operator rejected.
 */
```

### scripts/check-admin-ui.mjs:5099 (HISTORY, deleted)

restates the assertions below.

```js
/*
 * THE EMPTY FILTER IS ONE QUIET LINE. Three properties, because the failure
 * this replaces had three parts: a heading, a box, and rows that should have
 * been filtered out.
 */
```

### scripts/check-admin-ui.mjs:5125 (WHY, shortened)

shortened.

```js
/*
 * RULING 21c: THE BOX MATCHES THE OUTCOME, and both directions are asserted on
 * both states. The defect this closes rendered every message in `panel-error`,
 * so an assertion that only checked "the success text appears" was green
 * throughout it.
 */
```

### scripts/check-admin-ui.mjs:5152 (WHY, shortened)

shortened.

```js
/*
 * RULING 21d: THE ACTION HIERARCHY, read as classes because that is what the
 * weight is made of. `.btn` is the brand fill, `.btn-ghost` is the bordered
 * secondary and `.btn-text` is the text weight; three buttons all wearing
 * `.btn` is the page as it was, where Delete was a filled red control shouting
 * on every row including the ones with nothing wrong with them.
 */
```

### scripts/check-admin-ui.mjs:5174 (WHY, shortened)

shortened.

```js
/* And nothing on a row is the danger fill any more. The confirmation step still
   is, which is why this reads the ordinary queue and not that one. */
```

### scripts/check-admin-ui.mjs:5182 (WHY, shortened)

trap kept; amendment history moved.

```js
/* RULING 21e AS AMENDED 2026-09-06: the clause is stated ONCE, under the filter
   row, on the pending filter. It was rendered per pending row, so a queue of
   twelve said the same sentence twelve times; it states a property of the
   filter rather than of any one mention. The old paragraph is gone with its
   minute count.

   A LITERAL STRING, never a /g regex. A global regex carries lastIndex between
   calls, so the same `.test()` alternates true and false across the four
   assertions below and two of them would be reading the previous one's
   leftovers. */
```

### scripts/check-admin-ui.mjs:5200 (WHY, shortened)

shortened.

```js
/* PLACEMENT, not just presence: it has to sit ABOVE the queue, or "once" would
   also be satisfied by a clause on the single last row. */
```

### scripts/check-admin-ui.mjs:5211 (WHY, shortened)

shortened.

```js
/* BOTH NEGATIVES. A clause on every filter is the essay back in a different
   shape, and one over an empty queue is advice about an action nobody can
   take. */
```

### scripts/check-admin-ui.mjs:5230 (WHY, shortened)

shortened.

```js
/*
 * THE RETENTION FOOTNOTE, which is the essay reduced to one line and a button.
 *
 * The two windows are read from the CONSTANTS, so a paraphrase in the route
 * that hard-coded 30 and 90 would pass and a drift in the constants would fail
 * here rather than shipping a label that disagrees with the sweep.
 */
```

### scripts/check-admin-ui.mjs:5251 (WHY, shortened)

shortened.

```js
/* The button carries the count, which is the whole of ruling 21e's second half:
   a verb with no object became a quantity. 2 failed plus 1 rejected is 3. */
```

### scripts/check-admin-ui.mjs:5265 (WHY, shortened)

shortened.

```js
/*
 * THE VERIFIED STAMP IS GONE and the other three are not. Asserted together,
 * because "verified is absent" alone would pass on a row that rendered no
 * stamps at all.
 */
```

### scripts/check-admin-ui.mjs:5286 (WHY, shortened)

shortened.

```js
/*
 * THE TWO DESTRUCTIVE CONFIRMATIONS, AND THIS IS THE ONLY INSTRUMENT THAT CAN
 * SEE THEM.
 *
 * `check:destructive` proves the ACTION calls `confirmationSatisfied`, and the
 * worker layer proves the action refuses without it. Neither can see whether
 * the refusal renders a form a person without JavaScript can actually complete,
 * which is the whole point of putting the guard in the action rather than in a
 * handler. A refusal with no second step is a dead end, not a ceremony.
 */
```

### scripts/check-admin-ui.mjs:5318 (WHY, shortened)

shortened.

```js
/* And the ordinary page does NOT: a confirmation field rendered before the
   action asked for one would train the operator to type into it and make the
   second step meaningless. */
```

### scripts/check-admin-ui.mjs:5329 (HISTORY, deleted)

floor measurement log; the floor's why is kept at MINIMUM_CHECKS.

```js
/*
 * EXECUTED-COUNT FLOOR.
 *
 * This gate BUNDLES and RENDERS routes, so its failure mode is a whole state
 * dropping out: a route that stops bundling, a render that throws and is
 * caught, a STATES entry quietly removed. Those already fail individually, but
 * the total is the only witness to a structural block that stopped running over
 * states that all still render.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-15 by RUNNING it: 285.
 * Never summed. It was 185 against a floor of 170 until the media library's v1
 * redesign added seven states, and the seven were counted by running the gate
 * rather than by adding up what they looked like they would contribute. The
 * cache sentence inverting from one assertion into two took it to 200, floored
 * at 187. Feature G's three preview-link states and their structural
 * assertions took it to 215, measured the same way.
 *
 * BEFORE and AFTER, both run rather than reasoned:
 *
 *   before  200 checks, 34 state(s), 111 submission(s)   floor 187
 *   after   215 checks, 37 state(s), 128 submission(s)   floor 202
 *   then    218 checks, 37 state(s), 128 submission(s)   floor 204
 *   v6      249 checks, 46 state(s), 169 submission(s)   floor 234
 *   v6.3    280 checks, 50 state(s), 204 submission(s)   floor 263
 *   v6.4    285 checks, 51 state(s), 208 submission(s)   floor 267
 *   v6.5    270 checks, 51 state(s), 208 submission(s)   (deduplicated)
 *   v6.5    302 checks, 54 state(s), 221 submission(s)   floor 283
 *   v6.6    370 checks, 65 state(s), 280 submission(s)   floor 347
 *
 * **THE LAST 11 CHECKS AND THE 65TH STATE ARE WHAT SIX SILENT PLANTS BOUGHT.**
 * Twenty-two plants ran against this session's work and six left the suite
 * green, each naming a real hole: the shortcut cross-check was a tautology (a
 * fake row increments both sides of the count it compared); the one-dot-per-tile
 * assertion could not distinguish precedence from `flags.length > 0`, because on
 * its fixture both render one dot; and the loader wiring is invisible to a
 * harness that supplies loader data as input. The first two are now real
 * assertions, and the third is a set of source greps, which is a weaker
 * instrument and the strongest one available inside this boundary.
 *
 * **v6.6 IS THE USAGE MODEL AND EVERYTHING IT FEEDS.** Ten states and 57
 * assertions: three usage states on four surfaces, per-row flags, the tile dot,
 * four lens notes, three empty states, the two suggestion controls, the adaptive
 * copy labels, the duplicate sentence, the shortcuts panel and the no-script
 * floor. Almost none of it is visible to the payload baseline, which is why the
 * assertion count moved five times as far as the submission count.
 *
 * **THE 59 NEW SUBMISSIONS ARE 55 FROM THE TEN NEW STATES AND FOUR REAL ONES.**
 * The four are the alt-suggestion button appearing on each existing inspector
 * state, and they are a genuine payload addition: a second control that writes
 * through the SAME `set-alt` intent, carrying its value on the button. Nothing
 * was removed and no existing tuple changed, which is the evidence that the rest
 * of this session was presentation over a model that already worked.
 *
 * THREE DEFECTS THIS GATE FOUND, none of which any other instrument could see:
 * the loader gained three fields and the shared fixture did not, so four detail
 * states threw on `templateRefs.length`; the adaptive copy LABELS were computed,
 * passed in and rendered nowhere, because `CopyButton` is glyph-only by design
 * and nobody had asked it to show a word; and the standing usage note still told
 * the reader that an asset referenced only by route code "has no citation here",
 * which the repository scan had just made false.
 *
 * **v6.5 IS TWO MOVEMENTS AND THE FIRST ONE IS DOWNWARD, WHICH IS THE POINT.**
 *
 * The evaporation section existed TWICE in this file, 155 lines duplicated
 * verbatim, confirmed byte-identical by hashing both ranges before either was
 * touched. It rendered the same state twice and applied the same 15 assertions
 * twice, so 15 of the 285 could not fail independently: if the first copy
 * passed, the second was guaranteed to. That is rule 10's own class, "a pass
 * count is not coverage", sitting inside the gate that enforces it, and it had
 * inflated the floor by 15 for two sessions. Removing it read 270.
 *
 * Then session 4 added the document card, the caption bar and the column
 * headers: three states and 32 assertions, taking it to 302. Floored at 283,
 * which is 94 percent.
 *
 * **SUBMISSIONS MOVED 208 TO 221 AND ALL OF IT IS THE THREE NEW STATES.** Not
 * one existing state's tuple changed, and that is the evidence that a redesign
 * this size was presentational: the copy control moved between two parents and
 * is conditionally not rendered, the tile grew a caption, and the list grew a
 * header row of links, and none of it is a submission. The 13 added are the
 * upload form, the wrapping bulk form and rebuild on each new state, plus the
 * two bulk intents on the one state that seeds a selection.
 *
 * v6.4 is the design pass: folder grouping as the default with its notes, the
 * quality lenses replacing the role chips, and one wide search bar. Submissions
 * moved because the search form now carries EVERY view parameter as a hidden
 * field rather than just `role`, which is the evaporation rule applied to a
 * form instead of a link.
 *
 * The v6.3 line is grouping, bulk tagging and the selection surface. The
 * submission jump is real payload: every media state gained the wrapping bulk
 * form, and the two seeded-selection states gained bulk-add-tag and
 * bulk-remove-tag, which are the intents the harness seam exists to reach.
 *
 * The v6 line is the media page rebuilt to the mockup's structure: nine new
 * states plus the evaporation section. Submissions moved 128 to 169 because the
 * page genuinely gained intents (set-tags, trash, restore, empty-trash), which
 * is the one kind of payload growth this baseline exists to record loudly.
 *
 * The third line is the revocation-sentence assertions. **STATES AND
 * SUBMISSIONS DID NOT MOVE, and that is the correct result rather than a
 * suspicious one:** the payload baseline records METHOD, intent and field
 * names, and a corrected sentence changes none of them. A copy change that DID
 * move the submission count would mean the copy was carried in a form field.
 *
 * Floored at 374 against 398 measured through this gate's own pipeline, roughly
 * 94 percent: the count moves in steps of a few per state, and the three
 * origin-requests states once added 34 at once, so the slack has to absorb a
 * state being added mid-session without hiding one being lost.
 *
 * Raised from 347 when the drawer, the two confirmations and the floating
 * selection bar landed with three new states behind them. A floor left at the
 * old measurement is a floor that has stopped being able to notice anything.
 */
```

### scripts/check-admin-ui.mjs:5443 (WHY, shortened)

rule and mechanism kept; ruling date cut.

```js
/* ------------------------------------------------------------------ *
 * NO-SCRIPT FALLBACK: the display axes are REAL LINKS carrying their
 * parameter.
 * ------------------------------------------------------------------ *
 *
 * Standing ruling, 2026-08-16: every control stays a real link or form that
 * works with scripting off, and nothing is built the slow way to preserve that.
 * `view`, `size` and `group` are handled on the CLIENT by the route's
 * `shouldRevalidate`, which is exactly the arrangement where the fallback rots
 * silently: the scripted path keeps working while the anchor behind it decays
 * into a button, and nobody notices until somebody arrives without script.
 *
 * So the anchor is asserted, from RENDERED MARKUP rather than from source. The
 * vocabularies are IMPORTED from view.mjs, never restated, so adding a fourth
 * tile size is covered here the moment it is declared.
 *
 * Defaults are omitted from emitted hrefs by `hrefWith`, deliberately, so the
 * default value is asserted as an anchor to the BARE url and every other value
 * as an anchor carrying `axis=value`. Asserting `view=list` would fail against
 * correct markup.
 */
```

### scripts/check-admin-ui.mjs:5465 (WHY, shortened)

hard rule 10 kept; plant story moved.

```js
/*
 * Each axis is owned by ONE control group, and the assertion is scoped to it.
 *
 * The first version of this section searched every href on the page and was
 * satisfied by any link that happened to carry the axis. A plant that turned
 * the layout toggle into a `<button>` passed it cleanly, because on a state
 * whose URL already has `view=grid` every OTHER link carries `view=grid` too:
 * `hrefWith` preserves the whole state by design. That is hard rule 10's
 * "count matches, not containers" in its most literal form.
 *
 * Both control groups render a `<nav aria-label>`, so the label is the seam.
 */
```

### scripts/check-admin-ui.mjs:5484 (CONTRACT, shortened)

shortened.

```js
/**
 * The markup of the `<nav>` carrying this aria-label, or "" when absent.
 * @param {string} html
 * @param {string} ariaLabel
 */
```

### scripts/check-admin-ui.mjs:5498 (WHY, shortened)

shortened.

```js
/*
 * SCOPED-BY: `navNamed` delimits to the <nav aria-label="Layout"> ELEMENT, so
 * this is a match on the layout control itself and not on the string appearing
 * anywhere in the document (a class name in an inline style block, say).
 */
```

### scripts/check-admin-ui.mjs:5507 (WHY, shortened)

shortened.

```js
/*
 * SCOPE NON-EMPTINESS. Every assertion below reads this list, so a rename of
 * the toggle class would otherwise turn the whole section into 0 findings over
 * 0 states and still pass.
 */
```

### scripts/check-admin-ui.mjs:5529 (WHY, shortened)

shortened.

```js
// The owning control has to EXIST before its options can be asserted.
```

### scripts/check-admin-ui.mjs:5563 (WHY, shortened)

shortened.

```js
/*
 * THE SERVER STILL RESOLVES THE DISPLAY AXES FROM THE URL.
 *
 * The component reads these three from `useSearchParams()` so a client-side
 * flip re-renders without the loader. On the server both sides read the same
 * request URL, so the overlay must be a NO-OP there. If it ever is not, the
 * scripted path keeps working and the no-script path silently renders the
 * default layout for everybody, which is the exact failure this whole section
 * exists to catch. Asserted from the markup the grid actually emits.
 */
```

### scripts/check-admin-ui.mjs:5592 (CONTRACT, shortened)

boundary kept; measurement cut.

```js
/* ------------------------------------------------------------------ *
 * PENDING TRANSITIONS: router-driven, and OFF when nothing is in flight.
 * ------------------------------------------------------------------ *
 *
 * A data-changing control on this plane costs a round trip plus a D1 query,
 * MEASURED at 1629ms median on production, so the results region carries
 * `data-pending` and `aria-busy` while `useNavigation` reports a load.
 *
 * WHAT THIS HARNESS CAN SEE: it renders ONE static pass, so `useNavigation`
 * is always idle here and a genuine in-flight state cannot be produced. What
 * it can prove is the half that actually rots, and the half a reader would
 * suffer: that the mark is CONDITIONAL. A hardcoded `data-pending` dims the
 * grid and swallows every pointer event forever, on every state, and no test
 * that only checks "the attribute exists" would notice.
 *
 * The complement, that the attribute APPEARS while loading, is not observable
 * offline. It is carried by the router's own `navigation.state` and is stated
 * here as a boundary rather than left to look covered.
 */
```

### scripts/check-admin-ui.mjs:5627 (WHY, shortened)

shortened.

```js
/*
 * AND IT COMES FROM THE ROUTER, not from a hand-rolled timer or a useState
 * somebody flips on click. That is the "do not build a spinner system" half.
 */
```

### scripts/check-admin-ui.mjs:5636 (WHY, shortened)

shortened.

```js
// The subject is a MODULE, not a rendered document, so the question is
  // file-level by construction: does this module anywhere set data-pending
  // without anywhere importing useNavigation. Delimiting to one element would
  // let a second, hand-rolled pending mark elsewhere in the file pass unseen.
  // SCOPED-BY: the whole source file, deliberately, per the note above.
```

### scripts/check-admin-ui.mjs:5644 (WHY, shortened)

shortened.

```js
// SCOPED-BY: the whole source file, for the reason given above the match.
```

### scripts/check-admin-ui.mjs:5651 (WHY, shortened)

shortened.

```js
/*
 * AND THE SEARCH FORM IS STILL A FORM. It is the one control on this page that
 * carries free text, so it cannot degrade to a link, and a GET form is the only
 * shape that submits without script.
 */
```

### scripts/check-admin-ui.mjs:5665 (CONTRACT, shortened)

shortened.

```js
/* =========================================================================
 * RULING 54. Five assertions the redesign turns on, and none of them is a
 * restatement of the fixture: each one is a property that was FALSE before
 * this session and would be false again if the code regressed.
 * ====================================================================== */
```

### scripts/check-admin-ui.mjs:5671 (WHY, shortened)

mechanism kept; history cut.

```js
/*
 * (1) THE CONFIRMATION DIALOG.
 *
 * Five properties, and the first is the one that makes the other four
 * possible. A disabled submitter contributes NO name and NO value, so a
 * confirmation whose intent rides on `<button name="intent">` sends no intent
 * the moment that button is disabled: the posts and editor confirmations both
 * did exactly that, which is why neither could adopt disable-until-it-matches
 * while the media modal could. Asserting the intent is a FIELD is therefore
 * asserting that the ceremony is implementable at all.
 */
```

### scripts/check-admin-ui.mjs:5714 (WHY, shortened)

trap kept.

```js
/*
 * THE SERVER RENDERS IT ENABLED AND INLINE, which is the no-script path and is
 * the opposite of what the design does once hydrated.
 *
 * `data-inline` is what gives a dialog a box at all without `showModal()`: a
 * `<dialog>` with neither `open` nor that attribute is `display: none`, so a
 * reader with scripting off would lose the confirmation entirely. And the
 * button must arrive ENABLED, because `typed` never becomes anything without
 * script and a server-disabled button would leave that reader unable to
 * confirm at all. The action re-checks the count either way.
 */
```

### scripts/check-admin-ui.mjs:5737 (WHY, shortened)

shortened.

```js
/*
 * AND THE COMPONENT ACTUALLY MODALISES AND DISABLES. The render above cannot
 * see either, because this harness never dispatches an effect: it reports the
 * server pass only. So these two read the component's source with comments
 * stripped, which is the only place the behaviour exists.
 */
```

### scripts/check-admin-ui.mjs:5763 (WHY, shortened)

shortened.

```js
/*
 * (2) THE DRAWER'S OPENER EXISTS AT 375.
 *
 * This harness has no viewport, so "at 375" is asserted where it is decided:
 * the opener is in the shell's markup unconditionally and the stylesheet
 * reveals it inside the narrow breakpoint. The failure this guards is the one
 * the mockups made first, hiding the rail with `display: none` and leaving a
 * narrow reader with no way to reach any other section.
 */
```

### scripts/check-admin-ui.mjs:5794 (WHY, shortened)

shortened; incident examples moved.

```js
/*
 * (3) THE STATUS SENTENCE AGREES WITH THE NOTICE.
 *
 * Ruling 54 makes this a rule because the two were separate computations and
 * drifted: /admin/posts described itself as "Every post, drafts included"
 * while a drift alert underneath said search was answering from stale text,
 * and /admin said "every check the scheduled poll runs, answered here" over a
 * failing check. Both directions are asserted, because a page that never
 * renders a notice would satisfy the first half trivially.
 */
```

### scripts/check-admin-ui.mjs:5809 (CONTRACT, shortened)

shortened.

```js
/** Whether the page is showing a notice that something is wrong. @param {string} html */
```

### scripts/check-admin-ui.mjs:5835 (WHY, shortened)

shortened.

```js
/* The sentence must not claim everything is fine while a notice says
     otherwise. Matched on the words the clean branches use, because those are
     the ones that would be wrong beside a problem. */
```

### scripts/check-admin-ui.mjs:5846 (WHY, shortened)

shortened.

```js
/*
 * (4) NO PROSE INSIDE A TABLE, ON ANY ADMIN ROUTE.
 *
 * A `<caption>` is announced before EVERY row, so a five-sentence caveat is a
 * five-sentence caveat once per post; a `<p>` in a cell is the same defect one
 * level down. Both were live on /admin/posts and /admin/origin-requests.
 *
 * CROSS-ROUTE BY CONSTRUCTION, over every state this gate rendered, so a table
 * added to a route tomorrow is covered on the day it is written rather than on
 * the day somebody remembers to extend this. The failure NAMES THE ROUTE.
 */
```

### scripts/check-admin-ui.mjs:5871 (WHY, shortened)

scope and trap kept; count cut.

```js
/*
 * (5) NO 0.375rem IN THE STYLESHEETS THIS DESIGN PASS OWNS.
 *
 * Two radii, 0.25rem on controls and 0.5rem on containers, and 0.375rem was a
 * sixth of a scale nobody had written down. COMMENTS ARE STRIPPED FIRST, which
 * is not a formality: this file's own explanation of the rule contains the
 * literal, and a naive scan would fail on the sentence describing the check.
 *
 * SCOPED, and the scope is stated rather than implied. admin-editor.css,
 * admin-media.css and the three others carry 69 more occurrences between them,
 * a third of which are paddings and gaps rather than radii. Sweeping those
 * blind, with no gate that can see admin layout, is the shape FAILURES.md
 * records as "a correct rule applied to a category nobody verified".
 */
```

### scripts/check-admin-ui.mjs:5900 (WHY, shortened)

shortened.

```js
/* The scope is proven non-empty: a search over a file that failed to load
   reports exactly what a clean sweep reports. */
```

### scripts/check-admin-ui.mjs:5910 (NUMBER, shortened)

floor reason kept; measurement log moved.

```js
/*
 * FLOOR RAISED 435 -> 591 by the webmention moderation queue's four states.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-09-04 by RUNNING it: 619,
 * over 89 states. Never summed. It was 435 against 463 over 79 states, measured
 * 2026-08-25. Slack of 28 is kept at the width it has always had, for the
 * reason it was chosen: it absorbs a state being retired, and dropping the
 * whole mentions section is 21 assertions, which still fails.
 *
 * BOTH COPIES OF THE OLD NUMBER WERE STALE, in the same direction. The
 * comment and the message below each said 438 and the gate had been running
 * 439 since before this session; the change that added the 439th did not
 * touch either number. That is the point the previous note tried to make and
 * could not: stating a number TWICE is not a check on it, because the two
 * copies drift together and agreeing with each other is all they can do. The
 * only thing that reads the count is the comparison against MINIMUM_CHECKS,
 * and it passed throughout. Re-measured here rather than carried.
 *
 * RAISED 591 -> 634 by ruling 21's redesign of that same queue, 2026-09-05.
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE BY RUNNING IT: 662, over 94
 * states. Never summed. Slack of 28 is unchanged, and it still absorbs a state
 * being retired: dropping the whole mentions section is now 40 assertions,
 * which fails by a wide margin.
 *
 * RAISED 634 -> 682 by ruling 54's admin design pass, 2026-09-10.
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE BY RUNNING IT: 710, over the same
 * 94 states. Never summed, and never arrived at by adding the new block's
 * assertions to the old floor: the redesign also RETIRED assertions (the
 * caption exemption's shape, the two mentions button weights) and replaced
 * others one-for-two, so arithmetic on 634 would have produced a number that
 * was never true of any run. Slack of 28 is unchanged for the reason it has
 * always had: it absorbs a state being retired without absorbing a section.
 */
```

### scripts/check-admin-ui.mjs:5944 (WHY, shortened)

hard rule 17 kept; plant story moved.

```js
/*
 * The literal "Measured: N" that used to close this message is GONE, and its
 * removal is the point rather than tidying. It went stale here first: plant (d)
 * raised the floor to 202, fired correctly, and printed "Measured: 200" while
 * the docblock said 215. A number a failure prints is an instrument, and that
 * one was reporting a previous session's reading to whoever the gate stopped.
 * `assertFloor` now prints the live count on every passing run instead, so the
 * only copy of the number is the one that re-derives itself (hard rule 17).
 */
```

## scripts/check-features.mjs

### scripts/check-features.mjs:1 (CONTRACT, shortened)

usage, boundaries and anchor rule kept; argument and emphasis cut.

```js
/**
 * Gate over the colophon's HAND-WRITTEN half.
 *
 *   npm run check:features
 *
 * OBSERVATION BOUNDARY, stated plainly because it is narrow: **this gate
 * verifies that the thing each claim is ABOUT still exists. It never verifies
 * that the prose is true.** A feature saying "the editor has a draft buffer with
 * offer, restore and discard" is checked only insofar as the route and the gate
 * it names are still there. Rewrite the sentence to say the opposite and this
 * gate stays green.
 *
 * That is the ruling's design rather than a shortfall (colophon-page.md): the
 * stack half is DERIVABLE and is derived, the feature half is not derivable and
 * is anchored. What anchoring buys is that most rot is caught, because prose
 * usually goes stale by describing something that was removed or renamed, and it
 * gives the page its best property: every claim links to the thing that proves
 * it.
 *
 * **Second boundary, and it will bite someone: the route parser collects
 * DECLARED paths and does NOT compose nested prefixes.** `routes.ts` nests the
 * admin subtree under `route("admin", ...)`, so its children are declared
 * relative to it and this gate sees `/posts/:slug/edit`, never
 * `/admin/posts/:slug/edit`. That is why the four admin features are anchored
 * to their gates rather than to their routes: those paths are behind a session
 * and cannot be linked anyway, so the gate anchor is both verifiable and more
 * useful.
 *
 * The consequence to know about BEFORE it happens: the next feature that
 * anchors to a nested PUBLIC route will fail here, and the failure will read
 * like rot in the anchors file when it is really this parser's limit. Either
 * anchor it to the child segment as declared, or teach the parser to compose
 * prefixes. Do not "fix" it by hardcoding a path list, which is the mirror this
 * whole family of gates exists to prevent.
 *
 * Pure: no network, no database, no bindings.
 *
 * ## Why a decision anchor can never stand alone
 *
 * Four anchor kinds. Three are verifiable here and one is not:
 *
 *   route      a path that must appear in app/routes.ts
 *   gate       a check:* script in package.json whose file exists on disk
 *   assertion  { gate, text } where the text must appear in that script
 *   decision   a dated heading in decisions.md, which lives in Capsid
 *
 * This gate runs offline and cannot reach Capsid, so a decision anchor is
 * carried as CONTEXT and proves nothing. A feature whose only anchor were a
 * decision would therefore be an unverifiable claim wearing the costume of a
 * verified one, and the anchors file would become exactly the place rot
 * collects: the one spot on the page where a sentence can rot with a gate
 * standing over it saying nothing is wrong.
 *
 * So every feature must carry at least one route, gate or assertion anchor, and
 * that is asserted below rather than left to discipline.
 *
 * ## Derived, not restated
 *
 * No route path, gate name or script filename appears in this file as a
 * literal. Routes are parsed out of `app/routes.ts`, gates are read from
 * package.json's `check:*` scripts, and the assertion text is searched in the
 * script the anchor names. Same rule the rest of the family follows.
 *
 * FAILS CLOSED. Zero features, zero anchors, or a routes.ts that parses to
 * nothing are each a failure, so "0 problems" can never mean "0 examined".
 */
```

### scripts/check-features.mjs:83 (WHY, shortened)

reason kept, shortened.

```js
// The roster's derived metrics are computed from these, by the SAME function
// the route calls. A gate deriving the expected value its own way would be two
// implementations that agree until they do not, with nothing able to say which
// is right (hard rule 10, and rule 12's differential discipline).
```

### scripts/check-features.mjs:89 (WHY, shortened)

shortened.

```js
// The key grammar's readers. Imported for the same reason the colour maths and
// the chart renderer are: the playground's claim is that its demos run the real
// module, and a gate that reimplemented the grammar would be checking a second
// answer to the question the module exists to have one answer to.
```

### scripts/check-features.mjs:103 (WHY, shortened)

shortened.

```js
// The theme resolver, for the same reason: the demo's claim is that it runs the
// function the Worker runs, and a gate restating the rules would agree with
// itself while the site disagreed with both.
```

### scripts/check-features.mjs:107 (WHY, shortened)

shortened.

```js
// The three real code paths the playground demos run. Imported rather than
// reimplemented, which is the whole claim the playground section verifies.
```

### scripts/check-features.mjs:133 (CONTRACT, shortened)

contract kept; incident narrative moved.

```js
/**
 * Comments removed, so a match is a property of CODE rather than of prose.
 *
 * ONE implementation, used by ALL THREE readers in this file. It used to exist
 * only inside `declaredRoutes()`, and the assertion-anchor match a hundred lines
 * below ran against raw bytes. The pre-audit sweep defeated that directly:
 * deleting the assertion `worker returned a different fixture count` from
 * check-charts.mjs and leaving its text in a comment left this gate reporting
 * 276 checks and 0 failures. The anchor's entire promise is that a claim on the
 * colophon links to the thing that PROVES it, and the thing was gone.
 *
 * The trap was already named in this file's own header, and the fix already
 * existed twenty lines away. That is the part worth remembering: the gate knew
 * about prose matching, applied the cure to one of its two readers, and shipped
 * the other for a month.
 *
 * **AND THEN IT HAPPENED AGAIN, 2026-08-26.** The enhancement selector sweep
 * was added after this paragraph was written, read raw bytes like the reader
 * this paragraph is about, and this header went on saying "BOTH readers" while
 * there were three. The sentence describing the failure was, once more, sitting
 * directly above the code committing it. A shared helper is not adopted by
 * being documented; count the call sites when you add a reader.
 *
 * LINE STRUCTURE IS PRESERVED. A block comment becomes the same number of
 * newlines it spanned, not a single space, so a MULTI-LINE anchor still matches
 * across code that had a comment between its lines. check:assertions learned
 * this the expensive way when collapsing comments moved every reported line.
 *
 * The `[^:]` guard on line comments keeps `https://` from being read as one.
 *
 * @param {string} source
 */
```

### scripts/check-features.mjs:168 (CONTRACT, shortened)

rule kept; move history cut.

```js
/**
 * Identifier tokens removed before a hard-rule-17 digit scan.
 *
 * A token mixing letters and digits is a NAME (D1, R2, FTS5, workerd), not a
 * measurement. The two forms are letters-then-digits and digits-then-letters,
 * and both are stripped whole, so a name never leaves a digit behind for the
 * scan to find. Stripping them is not a loophole: a measurement is never
 * spelled that way.
 *
 * **MODULE SCOPE SINCE 2026-08-30, and the move is the point.** It lived inside
 * the features block and the projects roster below needed the identical rule.
 * Copying it would have been this file's own recorded failure repeated a third
 * time: `stripped()` was written once, applied to one of two readers, and the
 * header went on saying "BOTH readers" while there were three. One
 * implementation, two callers, counted.
 *
 * @param {string} text
 */
```

### scripts/check-features.mjs:204 (CONTRACT, shortened)

contract and failure direction kept.

```js
/**
 * Every path `routes.ts` declares, parsed rather than listed.
 *
 * `route("blog/:slug", ...)` and `index(...)` are the only two forms this repo
 * uses, and the first argument of `route()` is the path. Nested children carry
 * paths relative to their parent, so an admin child appears as `posts/new`
 * rather than `admin/posts/new`; the colophon's features name public top-level
 * paths, and a relative form is still a real declared path, so both are
 * collected and compared as declared.
 *
 * **This is the most fragile thing in this gate and it is worth saying so.** It
 * reads source with a regex rather than asking the router, so a routes file
 * written in a different style, a path built by concatenation, or a route added
 * through a plugin would be invisible here. The failure direction is safe: an
 * unparsed route makes a feature naming it FAIL rather than pass, which is
 * loud. The unsafe direction would be a hardcoded list, which is what this
 * avoids.
 */
```

### scripts/check-features.mjs:223 (WHY, shortened)

trap kept; list of other gates cut.

```js
// Comments first: this file's own prose names paths like /phage-discovery
  // and /colophon, and a scan that read them would report routes that are only
  // mentioned. Same trap check:logo and check:contrast both hit, and the same
  // one the assertion-anchor match below fell into. One `stripped()` now.
```

### scripts/check-features.mjs:241 (CONTRACT, shortened)

trimmed.

```js
/**
 * The same declarations, keyed path -> module file on disk.
 *
 * A SECOND PASS OVER THE SAME SOURCE rather than a second return value from
 * `declaredRoutes`, so that function's callers and its floor are untouched.
 * The two-argument form is what carries the module: `route("api/operator",
 * "routes/api.operator.ts")`, and `index()` names one too. A route declared
 * with no module, or with one this cannot resolve, is simply absent from the
 * map, and the caller treats an absence as a FAILURE rather than as a skip.
 *
 * @returns {Map<string, string>}
 */
```

### scripts/check-features.mjs:274 (WHY, shortened)

shortened.

```js
// The script FILE, taken out of the command rather than guessed from the
    // gate's name: check:admin-ui runs check-admin-ui.mjs and the mapping is
    // not mechanical.
```

### scripts/check-features.mjs:301 (CONTRACT, shortened)

section heading shortened.

```js
/* --------------------------------------------------------- fail closed first */
```

### scripts/check-features.mjs:308 (NUMBER, shortened)

floor asserted in code; measurement history moved.

```js
/*
 * FLOOR: RE-MEASURED 2026-08-24 through declaredRoutes() by running this gate:
 * 36. Now >= 33, about eight percent under. It was 30 against 34 measured, and
 * before that 10.
 *
 * The original value could not detect the failure most likely to happen here.
 * The admin subtree contributes TWELVE nested children; if the parser ever
 * stopped seeing nested `route()` calls it would return 24, comfortably over
 * 10, and nothing would say so. The admin features anchor to gates rather than
 * routes, so no other assertion would have failed either.
 */
```

### scripts/check-features.mjs:352 (CONTRACT, shortened)

section heading shortened.

```js
/* ------------------------------------------------- the anchors, one at a time */
```

### scripts/check-features.mjs:365 (WHY, shortened)

shortened.

```js
/*
   * THE RULING, enforced rather than trusted. A decision anchor is context and
   * proves nothing offline, so it may accompany a verifiable anchor and may
   * never be a feature's only one.
   */
```

### scripts/check-features.mjs:386 (WHY, shortened)

rule and signals kept; audit measurement and draft story moved.

```js
/*
       * **A ROUTE ANCHOR THAT RENDERS AS A LINK MUST ANSWER AN ANONYMOUS GET.**
       *
       * The colophon's best property, per the ruling, is that every claim
       * links to its evidence. Measured in the pre-cutover audit 2026-09-11
       * (P1-22): a sweep of 203 internal URLs found exactly two non-200s on
       * the whole site, `/api/operator` (401) and `/search/ask` (405), and
       * both were reached as hrefs FROM THIS PAGE. The page's one distinctive
       * feature was also the only source of broken links on the site.
       *
       * So an anchor may carry `anonymousGet: false`, and the page renders
       * that one as `<code>` rather than as a `<Link>`.
       *
       * ## THE FLAG IS ARGUED, NOT TRUSTED
       *
       * A hand-set boolean in a data file is a claim about a route, and a
       * claim about a route ages exactly as fast as the route. So the answer
       * is DERIVED here from the route module and compared, which is the same
       * two-independent-sources shape the assertion anchors above use: the
       * JSON declares, the module decides, and a disagreement fails.
       *
       * THE SIGNALS ARE NAMED rather than inferred, because a general "does
       * this render" predicate is not something a source scan can honestly
       * claim:
       *
       *   A DEFAULT EXPORT IS A PAGE, and it settles the question by itself.
       *   A document route renders its component for a GET whether or not it
       *   has a loader, which `/colophon` demonstrates: it has no loader at
       *   all and renders from imported artifacts. The first draft of this
       *   derivation read "no loader" as "no page" and failed on exactly that
       *   route, which is why the signal is stated this way round.
       *
       *   OTHERWISE IT IS A RESOURCE ROUTE, and then the loader decides. No
       *   loader means nothing answers a GET. A loader returning `status: 405`
       *   refuses the method, which is `/search/ask`. A loader calling
       *   `authenticateOperator` demands a credential a reader does not have,
       *   which is `/api/operator`. None of those is a page.
       *
       * BOTH DIRECTIONS. A page route that starts requiring a credential and
       * keeps its link fails, and so does a flag left on a route that became
       * public, which is the direction a stale exemption always takes.
       *
       * Comments stripped first: this file, and the routes, discuss 405 and
       * authentication in prose.
       */
```

### scripts/check-features.mjs:457 (WHY, shortened)

shortened.

```js
/*
         * A route declared in routes.ts whose module this gate cannot find is
         * not a pass. The assertion above would otherwise be skipped silently,
         * which is the construct-the-scan-does-not-reach class: the subject
         * has no gate and the absence reads as compliance.
         */
```

### scripts/check-features.mjs:488 (WHY, shortened)

trap kept; backlog item and incident moved.

```js
/*
       * BOTH SIDES NORMALIZED, the `check:claude-md` and `check:migrations`
       * form. Gate-backlog item 14.
       *
       * `core.autocrlf` is true on this host, so a file git has not rewritten
       * since `cab1c9e` pinned the tree sits CRLF on disk while its committed
       * blob is LF. Every anchor today is single line, so this changes nothing
       * now; the first MULTI-LINE anchor written against a stale-CRLF disk file
       * would match locally and fail in every fresh checkout and clone. That is
       * exactly the class that bit `check:migrations` on 2026-08-10, caught by
       * `check:head`, and it is cheaper to normalize than to diagnose.
       *
       * The needle is normalized too: a JSON file edited on this host can carry
       * CRLF inside a string just as readily as the script can.
       */
```

### scripts/check-features.mjs:537 (CONTRACT, shortened)

section heading shortened.

```js
/* ------------------------------- hard rule 17, on the prose itself --------- */
```

### scripts/check-features.mjs:539 (WHY, shortened)

rule, boundary and exemptions kept; audit story moved.

```js
/*
 * **THE RULE THIS GATE ENFORCES, AND THE MEASUREMENT THAT FORCED IT.**
 *
 * An external audit read this repository's own prose and found that ten of
 * eighteen checkable claims were FALSE. Most carried no digits at all. They
 * were TENSE-BOUND STATE CLAIMS: present-tense sentences about how the system
 * is built, written true and left standing after the machinery moved. Five
 * entries in this very file described a committed, byte-compared content
 * artifact that had left git on 2026-08-26.
 *
 * Hard rule 17 was extended on 2026-08-28 to cover both halves: prose may carry
 * REASONING, and may not carry a NUMBER or a TENSE-BOUND STATE CLAIM that a
 * gate does not own. This is the one surface where a regex can enforce any of
 * it, so it is enforced here.
 *
 * ## OBSERVATION BOUNDARY, and it is the important paragraph
 *
 * **THIS CANNOT READ TENSE.** It refuses digits and it refuses a named
 * vocabulary. A sentence can still describe machinery deleted this morning, in
 * the present tense, with no number in it, and pass. What this buys is that the
 * two shapes which actually recurred here are now a build failure rather than a
 * reading exercise: a restated measurement, and the specific words of the
 * removed content pipeline.
 *
 * That is the same bargain the anchor checks above make. This gate has never
 * been able to verify that a sentence is TRUE, and it still cannot.
 *
 * ## WHAT COUNTS AS A NUMBER, stated because the naive form is unusable
 *
 * A digit glued to letters inside one token is an IDENTIFIER, not a
 * measurement: D1, R2, FTS5, workerd. Those are stripped before the scan, and
 * stripping them is not a loophole, because a measurement is never spelled that
 * way.
 *
 * What remains is a bare digit run, and exactly one class of those is allowed:
 * PROTOCOL CONSTANTS, listed below with a reason each. A status code is owned
 * by the protocol rather than by this repository, so it cannot drift underneath
 * a sentence, which is the test rule 17 itself states. The list is CLOSED and
 * short so that adding to it is a deliberate diff someone has to justify.
 *
 * ## DATES ARE NOT ALLOWED HERE, because there is nowhere to put one
 *
 * The rule's exception for dated records covers published posts and a dated
 * update field. **This file has no dated field**, so granting a date allowance
 * would be an allowance over nothing, which is the unfailable-condition class
 * in hard rule 10. If an `updated` field is ever added, the allowance is wired
 * HERE and scoped to that field alone, never to the prose.
 *
 * ## ANCHORS ARE EXEMPT, deliberately
 *
 * An anchor's `text` is a machine reference that must match a gate's own
 * assertion label byte for byte, and those labels carry counts. Scanning them
 * would force the gates to be reworded to satisfy a rule about prose.
 */
```

### scripts/check-features.mjs:597 (CONTRACT, shortened)

trimmed.

```js
/**
   * Bare digit runs a feature sentence may carry, each with its reason.
   *
   * CLOSED. A protocol constant is owned by the protocol and cannot go stale;
   * anything else that looks like a number in prose is a measurement, and a
   * measurement belongs in the gate that measures it or nowhere.
   */
```

### scripts/check-features.mjs:614 (HISTORY, deleted)

note about a move.

```js
/* `withoutIdentifiers` is at module scope now; the projects roster below is
     its second caller. See its docblock for why it moved. */
```

### scripts/check-features.mjs:617 (WHY, shortened)

date cut.

```js
/**
   * The vocabulary of the content machinery removed on 2026-08-26.
   *
   * Named rather than inferred: these are the exact phrases the five stale
   * entries used, so a sentence reintroducing one is describing a pipeline that
   * does not exist. Git holds markdown only, D1 holds the only rendered copy,
   * and a save commits ONE file.
   */
```

### scripts/check-features.mjs:633 (WHY, shortened)

shortened.

```js
/*
   * SCOPE, ASSERTED. Every assertion below iterates the feature list, so an
   * empty or unparsed list would report a clean sweep of nothing.
   */
```

### scripts/check-features.mjs:664 (NUMBER, shortened)

floor asserted in code; measurement moved.

```js
/*
   * FLOOR MEASURED 2026-08-28 BY RUNNING THIS LOOP: 114 fields over the feature
   * list, three prose fields each. The floor is 90, about twenty percent under,
   * so a component's worth of entries can go missing and this still notices,
   * while adding or removing one feature does not fail the gate.
   */
```

### scripts/check-features.mjs:677 (WHY, shortened)

shortened.

```js
/*
   * THE SCAN IS PROVEN ABLE TO FIRE, on synthetic input, every run.
   *
   * The collection it walks is legitimately allowed to be clean, and a check
   * that only ever sees clean data is a check nobody has watched work. Same
   * repair as check:secrets' empty allowlist: exercise the predicate directly,
   * on a path that does not depend on the data.
   */
```

### scripts/check-features.mjs:711 (CONTRACT, shortened)

section heading shortened.

```js
/* ---------------------------------- the page's search records, ruling 3 ---- */
```

### scripts/check-features.mjs:713 (HISTORY, deleted)

placement rationale about another gate; nothing binding.

```js
/*
 * Why HERE and not in check:search.
 *
 * These assertions need two things this file already has and that one does not:
 * a parser for `routes.ts`, and the habit of reconciling a hand-written list
 * against reality in both directions. `check:search` is about the query parser
 * and rank fusion over synthetic input; it has no notion of routes, of the
 * artifact, or of what the page renders. Putting a routes parser there would be
 * a second one, which is the shape check:invariants exists to prevent.
 */
```

### scripts/check-features.mjs:733 (WHY, shortened)

ruling citation cut.

```js
// FAIL CLOSED. Zero page records is not an empty result set, it is ruling 3 not
// having happened, and every assertion below would pass vacuously.
```

### scripts/check-features.mjs:746 (CONTRACT, shortened)

trimmed; counts cut.

```js
/*
 * Every page record must live at a route that exists. A record pointing at a
 * removed route returns a hit that 404s, which is worse than no hit.
 *
 * ## THE PAPERS ARE ASSERTED AGAINST THE PARAMETERISED ROUTE, ONCE
 *
 * `declaredRoutes()` reads literal path strings out of routes.ts, which is what
 * makes it honest about the hand-authored pages: each is its own `route()` call
 * and its own record. The 36 paper records are served by ONE declaration,
 * `publications/:slug`, so a literal lookup would demand 36 route lines that
 * cannot exist, and the obvious repair, dropping them from the sweep, would
 * leave the site's largest set of page records unchecked.
 *
 * So the papers are separated by uid and checked against the declaration that
 * actually serves them, with the count of what was separated printed beside it.
 * That keeps the property the sweep exists for: delete
 * `route("publications/:slug", ...)` and every paper record reds here. What it
 * does NOT check is that a given slug resolves, and that is not a gap:
 * `check:publications` reconciles the record set against the corpus in both
 * directions and the sitemap against the same list.
 */
```

### scripts/check-features.mjs:804 (WHY, shortened)

shortened.

```js
/*
 * Anchors, both directions against the DESCRIPTOR.
 *
 * This is the assertion the whole descriptor exists for. A section record whose
 * anchor is not a fragment the page renders still returns a hit, still looks
 * right in a result list, and scrolls nowhere. Nothing else in the repo would
 * notice.
 */
```

### scripts/check-features.mjs:836 (WHY, shortened)

shortened.

```js
/*
 * The page renders FROM the descriptor, asserted structurally.
 *
 * There is no list of ids in the page to compare against, and that is the
 * property being checked: the only `<h2 id=` in the file is the one inside
 * `SectionHead`, which takes its id from the descriptor. A literal id
 * reintroduced anywhere else is a second list, and the next rename splits them.
 */
```

### scripts/check-features.mjs:872 (CONTRACT, shortened)

section heading shortened.

```js
/* ------------------------------------- the not-adopted status labels ------- */
```

### scripts/check-features.mjs:874 (WHY, shortened)

intent kept; 2026-08-05 defect story moved.

```js
/*
 * ONE LABEL MAP, TWO READERS, asserted in both directions.
 *
 * The defect this section was written for, 2026-08-05: `STATUS_LABEL` lived in
 * `colophon.tsx`, so the page rendered `(Refused)` and `(Accepted gap)` while
 * the record body carried the raw enum `(refused)` and `(accepted-gap)`. For
 * `accepted-gap` the hyphen means the indexed token was on the page in NO
 * casing, so a reader who searched the word the index advertises would land on
 * a page that never says it.
 *
 * **No gate could see it, and it is worth being precise about why.**
 * `check:content` compares the generated output against itself (then a byte
 * gate, a determinism pass today), so a wrong output agrees with itself. This gate reconciled section
 * IDS, not the words inside a section. The comparison that was missing is index
 * against PAGE, and the three assertions below are the offline half of it: the
 * label reaches the index, the raw enum does not, and neither reader carries a
 * literal that could drift from the other.
 */
```

### scripts/check-features.mjs:918 (WHY, shortened)

shortened.

```js
// Direction 2: no label for a status nothing declares. An orphan label is the
// same mirror-going-stale shape, caught before it is the one that matters.
```

### scripts/check-features.mjs:928 (WHY, shortened)

shortened.

```js
/*
 * The LABEL reaches the index and the RAW ENUM does not.
 *
 * Read off the gated artifact rather than recomputed, because the artifact is
 * what `sync:content` writes into D1 and therefore what a reader's search
 * actually matches against.
 */
```

### scripts/check-features.mjs:952 (WHY, shortened)

shortened.

```js
// The parenthesised form, so this cannot fire on a status word that happens
    // to appear inside a reason sentence.
```

### scripts/check-features.mjs:963 (WHY, shortened)

trap kept; list of gates cut.

```js
/*
 * Neither reader restates the other's strings.
 *
 * Comments are stripped first. Both files' own prose names these values while
 * explaining the defect, and a scan that read the explanation would report a
 * literal that is not there. That trap has already been hit by check:logo and
 * check:contrast, and by the routes parser at the top of this file.
 *
 * The stripper is shared: scripts/lib/strip-comments.mjs.
 */
```

### scripts/check-features.mjs:994 (WHY, shortened)

shortened.

```js
/*
 * And the descriptor declares each label EXACTLY ONCE, which is what makes it
 * the single source rather than merely one of the places it appears. A second
 * occurrence would mean the emitter had restated what the map already says.
 */
```

### scripts/check-features.mjs:1012 (WHY, shortened)

rule kept; 2026-09-11 incident moved.

```js
/*
 * **NO ENTRY CALLS CONTINUOUS INTEGRATION A GAP, IN EITHER DIRECTION.**
 *
 * Until 2026-09-11 the colophon's "What was not adopted" section printed
 * "Continuous integration (Accepted gap)" with the reason "with no CI, any
 * gate can be skipped indefinitely". `.github/workflows/ci.yml` had been
 * running on every push to main since 2026-08-20 and `scripts/ship.mjs`
 * refuses a HEAD without a green run for that exact sha, so the page whose
 * whole claim is that its sentences are checked against the repository was
 * printing one the repository refutes.
 *
 * NOTHING COULD SEE IT, and that is the reason this exists as an assertion
 * rather than as a one-line deletion. `check:stack` reconciles the entries
 * against the bindings and the gate list; `check:features` reconciles ids and
 * labels. Neither has any way to ask whether a hand-written REASON is true,
 * and in general neither can. This one specific claim is checkable, because
 * the workflow file either exists or it does not.
 *
 * SO IT IS ASSERTED AGAINST THE WORKFLOW RATHER THAN AS A BANNED WORD. A scan
 * for the phrase alone would be a lint that fires on a future entry about
 * something CI genuinely does not cover. The shape is: while a CI workflow
 * runs on main, no not-adopted entry may name continuous integration. Remove
 * `ci.yml` and this assertion stops applying, which is correct.
 *
 * BOTH FIELDS, because the pair can be split. The defect was a `name` of
 * "Continuous integration"; a reason saying "there is no CI" under some other
 * name is the same false sentence with the heading changed.
 */
```

### scripts/check-features.mjs:1072 (CONTRACT, shortened)

section heading shortened.

```js
/* ----------------------------------- the enhancement inventory, item 10 ---- */
```

### scripts/check-features.mjs:1074 (WHY, shortened)

rule and boundary kept.

```js
/*
 * Hard rule 9's second half, which is the half that gets dropped: every
 * enhancement declares a NAMED fallback, EVEN WHEN THE FALLBACK IS NOTHING.
 * All four modules in `app/enhance/` did declare one, in three different
 * prose formats across two files, and no gate could read any of them.
 *
 * BOTH DIRECTIONS. A file in `app/enhance/` with no entry is an enhancement
 * nobody named a fallback for; an entry naming a module that does not exist is
 * an inventory describing a repo that no longer exists.
 *
 * WHAT THIS CANNOT SEE, and it is the more important half: whether a route is
 * genuinely server-complete with script off. That is a claim about the WIRE,
 * hard rule 7 says so, and it belongs in `verify-live`. This gate proves the
 * fallback was NAMED and that the thing it names EXISTS. It cannot prove the
 * fallback works, and a lie written confidently into the prose passes here.
 */
```

### scripts/check-features.mjs:1094 (NUMBER, shortened)

count asserted in code.

```js
/**
 * EXACTLY FOUR TODAY, tripwired rather than bounded.
 *
 * A fifth module is not automatically wrong, but it is an enhancement that
 * arrived without anyone walking this list, which is the omission hard rule 9
 * exists about. Moving this number is a deliberate edit in the same commit.
 */
```

### scripts/check-features.mjs:1103 (NUMBER, shortened)

floor asserted in code; measurement moved.

```js
/**
 * Measured THROUGH this gate's own reading, re-measured 2026-08-24: 10 entries
 * across the 4 modules, because `blog.ts` carries seven. Set under, because the
 * job is catching a file that stopped being read, not tracking growth. At the
 * previous 8 the three modules that are not `blog.ts` could all have stopped
 * being read at once and this would have passed.
 */
```

### scripts/check-features.mjs:1168 (CONTRACT, shortened)

exclusions kept; measurement moved.

```js
/**
 * Every source file under `app/` EXCEPT `app/enhance/`.
 *
 * The exclusion is the whole point. A selector that appears only inside the
 * enhancement module is markup the enhancement CREATES for itself, which is not
 * a fallback; it would make the assertion agree with itself.
 *
 * **STYLESHEETS ARE OUT, since 2026-08-26, and that is a correctness fix rather
 * than a narrowing.** `.css` was in this list, and a stylesheet cannot be the
 * fallback: it STYLES markup, so a rule naming a class is evidence that someone
 * intended the class to exist, never that anything renders it. Measured the day
 * it was removed: with the image anchor deleted from the pipeline and
 * `.image-link` surviving only in `app/styles/post.css`, this gate reported 585
 * checks and 0 failures on markup that had ceased to exist.
 */
```

### scripts/check-features.mjs:1198 (WHY, shortened)

shortened.

```js
// NON-EMPTY SCOPE. A walk that returned nothing would make every selector
// assertion below fail closed rather than pass, but the count is asserted so
// the reason is named rather than inferred from a wall of failures.
```

### scripts/check-features.mjs:1201 (NUMBER, shortened)

floor asserted in code; measurement history moved.

```js
/*
 * FLOOR: RE-MEASURED 2026-08-26 through this gate's own walk by running it:
 * 158. Now >= 145, about eight percent under.
 *
 * IT WENT DOWN, and that is the one direction a floor is never re-measured in
 * by accident, so the reason is written here: the walk stopped taking `.css`
 * on 2026-08-26, which removed fifteen stylesheets. 173 minus those is 158.
 * A floor moving DOWN after a deliberate narrowing is correct; a floor moving
 * down on its own is the walk breaking, which is what this assertion catches.
 *
 * **THIS FLOOR IS ITS OWN CAUTIONARY TALE and the comment is kept for that.**
 * It was raised from 20 to 92 against a measured 105, with the note below
 * about the 81 percent blind zone the old value left. app/ then grew to 173
 * without the floor moving, so by 2026-08-24 the same floor left a 47 percent
 * blind zone: eighty-one files could stop being walked and the selector sweep
 * would still report itself satisfied. **A floor is not repaired once. It goes
 * stale in exactly the direction its own subject grows.**
 *
 * A floor that only catches a walk returning nothing is not catching the
 * failure that actually happens, which is a walk that stops descending.
 */
```

### scripts/check-features.mjs:1229 (WHY, shortened)

trap kept; recurrence story moved.

```js
/*
 * COMMENTS STRIPPED, since 2026-08-26, and this is the THIRD reader to learn it.
 *
 * The header above says "ONE implementation, used by BOTH readers in this
 * file", and that sentence was true when it was written and stopped being true
 * when this sweep was added: it read raw bytes, so any `.tsx` comment
 * mentioning a class name satisfied the fallback that class was supposed to
 * name. The header's own closing line already described this exact outcome
 * about a different reader. It has now happened twice in one file.
 */
```

### scripts/check-features.mjs:1243 (WHY, shortened)

reason kept; defect story and measurement moved.

```js
/*
 * AND WHAT THE SHARED RENDERER EMITS, which is server-rendered markup that no
 * file under `app/` spells.
 *
 * Removing stylesheets and comments above turned `footnote-previews` red, and
 * the red was CORRECT: `footnotes` lived in exactly two places under `app/`, a
 * CSS rule in post.css and a sentence inside a comment in blog-index.css.
 * Neither renders anything. But the fallback is real: `remark-gfm` emits
 * `<section data-footnotes class="footnotes">` with working bidirectional
 * links, and it does so from `app/lib/content/pipeline.mjs`, which is the
 * server and is under `app/`.
 *
 * So the honest repair is not to weaken the entry, it is to ASK THE RENDERER.
 * "Is this markup server-rendered" is a question the server-rendered output
 * answers directly, where a grep over route source can only answer "did
 * somebody type this string".
 *
 * A FIXTURE RATHER THAN THE CORPUS, deliberately. `content/generated/posts.json`
 * is what the corpus happens to contain today, and today it contains ZERO
 * footnotes and ZERO images (measured 2026-08-26), so a corpus-backed sweep
 * would go red the moment an author deleted the last post using a feature. The
 * claim under test is about the RENDERER, which is a property of the code.
 *
 * This is input, not expected values, so it does not offend the
 * fixture-independence discipline: nothing here is compared against something
 * the renderer also produced.
 */
```

### scripts/check-features.mjs:1290 (WHY, shortened)

shortened.

```js
// SCOPE, proven before the blob is trusted. A render that threw or returned
// nothing would quietly narrow the sweep back to where it started, which is the
// failure this whole section is about.
```

### scripts/check-features.mjs:1344 (WHY, shortened)

shortened.

```js
// A selector that yields no checkable token would pass by examining
    // nothing, which is the empty-scope failure this family keeps hitting.
```

### scripts/check-features.mjs:1387 (WHY, shortened)

shortened.

```js
// The selector sweep's denominator, PRINTED. Its floor is set against this
// number, and a floor whose subject is invisible cannot be re-measured.
```

### scripts/check-features.mjs:1397 (CONTRACT, shortened)

section heading shortened.

```js
/* ------------------------------------------------------- the coverage report */
```

### scripts/check-features.mjs:1399 (WHY, shortened)

shortened.

```js
/*
 * REPORTED, NOT FAILED, per the spec. A gate no feature mentions is a coverage
 * signal about the page, not a defect in the repo: plenty of gates protect
 * things a reader does not need described. Failing here would push the next
 * person to write filler prose to silence it, which is worse than the silence.
 */
```

### scripts/check-features.mjs:1421 (WHY, shortened)

intent kept; spec discussion cut.

```js
/* --- The projects roster ---------------------------------------------------
 *
 * WHY HERE AND NOT IN check:content. The spec guessed check:content; measured,
 * that gate proves the GENERATED corpus renders deterministically from
 * content/posts, so it has nothing to regenerate a HAND-AUTHORED file
 * from and a projects section there would be structurally foreign. This gate is
 * already the owner of hand-authored content data: it reads content/, parses
 * routes.ts, knows the gate list, and already reconciles the colophon's page
 * records. The roster is the same kind of object as features.json.
 *
 * BOTH DIRECTIONS, and the pairs are the point. Schema and vocabulary catch a
 * malformed entry; the artifact parity below catches the defect that actually
 * happens, which is editing the roster and forgetting to rebuild, leaving the
 * search index describing projects the page no longer lists or missing ones it
 * does.
 */
```

### scripts/check-features.mjs:1444 (WHY, shortened)

shortened.

```js
/*
 * WHAT THE DERIVED METRICS ARE COMPUTED FROM, assembled the way the route
 * assembles them: from artifacts that already have owners.
 *
 * `content/generated/stack.json` is generated from package.json by
 * `build:stack` and reconciled against its sources by `check:stack`, so the
 * gate count reaches the card through the pipe that already owns it rather
 * than through a second count taken here. `PHAGE_YEARS` is the data the roster page renders.
 *
 * NOT fixture-independent, and it does not need to be: hard rule 10's fixture
 * rule forbids a gate whose EXPECTED value is produced by the code under test,
 * and there is no expected value here. The assertion is that the derivation
 * runs and yields something real, which is a property of the pipeline rather
 * than a comparison against a number this file would otherwise have to restate.
 */
```

### scripts/check-features.mjs:1466 (WHY, shortened)

unasserted measurement moved.

```js
// FAIL CLOSED. An empty roster makes every loop below pass by iterating nothing.
// Measured through this gate 2026-08-24: 6 projects. Floor one under, because
// a roster of this size cannot absorb more slack than that.
```

### scripts/check-features.mjs:1470 (WHY, shortened)

date cut.

```js
/*
 * THROUGH assertFloor SINCE 2026-09-15. The roster only ever gets added to, so
 * this is a scope floor over a GROWING set, which drifts the way an
 * executed-count floor drifts and was invisible to check:floors while it was a
 * bare ok(). See check-tests.mjs's note beside its file floor for the rule and
 * for which scope floors deliberately stay out.
 */
```

### scripts/check-features.mjs:1511 (WHY, shortened)

shortened.

```js
/*
 * CLOSED, and closed in BOTH directions below. The route emits
 * `applicationCategory` for one of these and not the other, so a third value
 * would render structured data nothing decided the shape of.
 */
```

### scripts/check-features.mjs:1517 (WHY, shortened)

shortened.

```js
/*
 * The evidence kinds this gate knows how to VERIFY, which is the only list
 * worth having: a kind nobody checks is a citation nobody checks. Each is
 * verified differently below, and the route refuses to render an unknown one.
 */
```

### scripts/check-features.mjs:1525 (WHY, shortened)

move history cut.

```js
/*
 * THE BUILT CORPUS, read once for the roster and again for the playground.
 *
 * Hoisted here on 2026-08-30 because the evidence checks need it and the
 * playground's citation check already did. It is `content/generated/posts.json`,
 * the gitignored local build product, which is why a roster edited without a
 * rebuild fails here rather than shipping a link to a post that is not there.
 */
```

### scripts/check-features.mjs:1563 (WHY, shortened)

shortened.

```js
// `url` and `repo` are NULLABLE by design: the unlinked tier is a real state,
  // not a gap. What is checked is that a value, when present, is a URL the
  // pipeline's rule-6 allowlist would accept. The predicate is IMPORTED rather
  // than restated, so this cannot drift from what the renderer permits.
```

### scripts/check-features.mjs:1594 (WHY, shortened)

shortened.

```js
/*
   * THE METRIC IS THE PAGE'S WHOLE ARGUMENT, so it is checked hardest.
   *
   * TWO FORMS, MUTUALLY EXCLUSIVE, and the exclusivity is asserted rather than
   * left to convention. A metric carrying both a stored value and a derivation
   * would have TWO owners of its freshness, which is the state hard rule 17
   * names: the stored copy can drift while the derived one stays true, and the
   * page would render whichever the route happened to prefer.
   */
```

### scripts/check-features.mjs:1628 (WHY, shortened)

shortened.

```js
/*
     * RUN THE DERIVATION, through the function the ROUTE calls. This is the
     * assertion that makes a derived metric worth more than a dated one: it
     * proves the value the card renders is producible, non-empty and not a
     * placeholder, on every run, without this gate knowing how it is computed.
     */
```

### scripts/check-features.mjs:1655 (WHY, shortened)

shortened.

```js
/*
   * NOTABLE: optional, and shaped when present.
   *
   * The bound is two or three, and it is a bound rather than a minimum because
   * both failures are real. One sentence is a claim with no support; six is the
   * description field again under another name, and this list sits inside a
   * card in a grid where a long one pushes every sibling's foot down.
   */
```

### scripts/check-features.mjs:1679 (WHY, shortened)

shortened.

```js
/*
   * EVIDENCE: optional, and every entry VERIFIED rather than merely shaped.
   *
   * A citation nobody checks is the silent failure this whole family of gates
   * exists for: it returns a hit, looks correct in a card, and goes nowhere.
   * Each kind is checked against the thing that owns it, and the post label is
   * argued against the corpus rather than trusted, which is the same
   * two-sources-must-agree bargain the chart enums make.
   */
```

### scripts/check-features.mjs:1724 (WHY, shortened)

shortened.

```js
/*
         * THE LABEL IS THE POST'S TITLE, byte for byte.
         *
         * The route cannot read the corpus, so the title has to be restated in
         * the manifest for the card to render it. Restating it is fine; NOT
         * arguing it against the corpus is what would rot, and it would rot
         * invisibly, because a card showing a stale title still links to the
         * right article and nothing about the page looks wrong.
         */
```

### scripts/check-features.mjs:1763 (WHY, shortened)

shortened.

```js
// The vocabulary is closed in BOTH directions. An entry nothing uses is a term
// that can quietly stop meaning anything, which is how a "closed" list becomes
// a suggestion.
```

### scripts/check-features.mjs:1774 (WHY, shortened)

shortened.

```js
/*
 * THE PAGE RENDERS FROM THIS FILE, asserted at the source.
 *
 * The colophon can compare literal `<SectionHead id="...">` against its
 * descriptor because it hand-writes each one. This page MAPS over the roster,
 * so there are no literal ids to compare and the equivalent guarantee is
 * structural: the route must read the roster and derive its anchors from the
 * shared helper. If it ever stops doing either, parity becomes a coincidence.
 */
```

### scripts/check-features.mjs:1783 (WHY, shortened)

rule and exemptions kept.

```js
/*
 * HARD RULE 17 ON THE ROSTER'S PROSE, the same scan the feature sentences get.
 *
 * THIS PAGE NEEDS IT MORE THAN THE COLOPHON DOES, because its entire premise is
 * that the number is in the metric channel, where it carries either a date or a
 * derivation. A digit loose in a description is a measurement with nowhere to
 * say how old it is, sitting on the one page whose argument is that a number
 * without provenance keeps looking authoritative after it stops being true.
 *
 * THE EVIDENCE LABELS ARE EXEMPT FROM THIS SCAN and are exempt for the reason the
 * feature anchors are: a post label is a MACHINE REFERENCE that must equal the
 * post's title byte for byte, and titles carry measurements ("6 ms with Rank
 * Fusion"). Scanning them would force articles to be retitled to satisfy a rule
 * about portfolio prose. The label has a stronger guarantee than the scan
 * anyway: it is argued against the corpus above.
 *
 * METRIC LABELS ARE ALSO OUT. The metric is the number channel; its label says
 * what is counted and sits beside a value that carries its own provenance.
 */
```

### scripts/check-features.mjs:1826 (NUMBER, shortened)

floor asserted in code; measurement moved.

```js
/*
   * SCOPE, ASSERTED, and floored one under the measured count rather than at
   * the roster length: this scan reads two fields per project PLUS every
   * notable sentence, so the count moves with the notable lists and a floor
   * tied to `projects.length` would go stale on the next card that gains one.
   * MEASURED THROUGH THIS LOOP 2026-08-30: 23 fields over seven projects with
   * three notable lists.
   */
```

### scripts/check-features.mjs:1862 (WHY, shortened)

shortened.

```js
/*
 * THE ROUTE IS WIRED TO THE NEW FIELDS, asserted structurally.
 *
 * The manifest checks above prove the DATA is well formed. They say nothing
 * about whether any of it reaches a reader, and a field nothing renders is
 * worse than an absent one: it passes every shape check, it reads as shipped,
 * and the page is unchanged. Each assertion below is a thing only CODE can do,
 * on the lesson this file already carries in its search-anatomy block, where a
 * ban on a string fired against the caption that was supposed to say it.
 */
```

### scripts/check-features.mjs:1901 (WHY, shortened)

shortened.

```js
/*
 * THE PROVENANCE LINE BRANCHES. Without this, a route that dropped the derived
 * branch would render an empty <time> for every derived metric: no date, no
 * sentence, and a card that silently stops saying where its number came from,
 * which is the one thing this page exists to say.
 */
```

### scripts/check-features.mjs:1915 (WHY, shortened)

shortened.

```js
/*
 * Artifact parity, both directions. THIS is the assertion that catches the real
 * defect: a roster edited without `npm run build:content`, leaving the search
 * index and the page describing different sets of projects.
 */
```

### scripts/check-features.mjs:1954 (NUMBER, shortened)

floor asserted in code; measurement history moved.

```js
/*
 * Executed-count floor, MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING
 * it, never by summing the loops. The first number ever written here was 91,
 * guessed by adding up the loops against 154 measured, and it was wrong by two
 * thirds.
 *
 * RE-MEASURED 2026-08-30, after the roster gained evidence, notable sentences,
 * derived metrics and a schema type: **275** over a seven-project roster with a
 * fifteen-term vocabulary. It was 154 over six projects, and nearly all of the
 * growth is per-citation: every evidence entry costs four assertions and a post
 * citation costs six.
 *
 * Floored at 250, the ~8% margin the other gates use. That is deliberately not
 * generous: this count now moves with the EVIDENCE, so removing one card's
 * citations should not silently drop under a slack floor.
 *
 * Not scope-floored. The roster length gates most of the loops above, so a
 * truncated file trips `the roster is non-empty` first; this catches the case
 * where a whole BLOCK stops running, which a length assertion cannot see.
 */
```

### scripts/check-features.mjs:1991 (WHY, shortened)

section intent and boundary kept.

```js
/* --- The playground -------------------------------------------------------
 *
 * SAME OWNER, SAME REASON as the projects roster above: this gate is where
 * hand-authored content JSON is reconciled against the route that renders it.
 *
 * WHAT MAKES THIS SECTION DIFFERENT. A project card is markup, and this gate
 * does not render markup, so the roster above is reconciled structurally. The
 * playground's demos are not markup, they are CODE PATHS, and all three are
 * reachable offline: the colour maths, `fuse()` and the chart renderer are pure
 * modules with no database, no network and no clock. So each demo also gets a
 * BEHAVIOURAL assertion that runs the real module.
 *
 * THE EXPECTED VALUES ARE NOT PRODUCED BY THE CODE UNDER TEST. Ratios come from
 * design-tokens.md, the fusion arithmetic is written longhand, and the mark
 * labels are a fact about Observable Plot's output. Hard rule 10's fixture
 * independence: a gate whose expectations are generated by its subject is a
 * mirror.
 *
 * OBSERVATION BOUNDARY: this section does NOT execute the route's loader, so it
 * cannot see a rendered page. It proves the modules compute what the page
 * claims and that the page is WIRED to them. That a byte reached a browser is
 * verify-live's claim, per hard rule 7.
 */
```

### scripts/check-features.mjs:2032 (WHY, shortened)

reason kept; measurement date cut.

```js
/**
 * The element each mark type must emit, MEASURED 2026-08-14 rather than assumed.
 *
 * `line` and `area` both emit only `<path>`, so the element alone cannot tell
 * them apart and an element-only assertion would pass with the wrong mark drawn.
 * Plot also labels the mark group, and THAT discriminates all four, so both are
 * asserted: the group proves the requested mark reached the renderer, the
 * element proves it drew something of the right kind.
 */
```

### scripts/check-features.mjs:2044 (WHY, shortened)

shortened.

```js
// FAIL CLOSED. An empty roster makes every loop below pass by iterating nothing.
```

### scripts/check-features.mjs:2046 (WHY, shortened)

shortened.

```js
/*
 * THROUGH assertFloor SINCE 2026-09-15, same reason as the roster floor above:
 * the demo set only ever gets added to, so it is a scope floor over a GROWING
 * set and drifts the way an executed-count floor drifts. See check-tests.mjs's
 * note beside its file floor for the rule and for which scope floors stay out.
 */
```

### scripts/check-features.mjs:2094 (CONTRACT, shortened)

section heading shortened.

```js
/* -- manifest and page, BOTH DIRECTIONS ----------------------------------- */
```

### scripts/check-features.mjs:2116 (WHY, shortened)

shortened.

```js
/*
 * THE HEADERS ARE KEYED BY SLUG, NOT BY POSITION, asserted because the failure
 * it prevents is invisible.
 *
 * With a positional index, inserting a demo anywhere but the end renders every
 * section below it under another demo's title, lede and article link. The
 * reconciliation above stays green in both directions the whole time, because
 * both lists are still complete: what changed is which header sits over which
 * form, and no list-membership check can see that.
 */
```

### scripts/check-features.mjs:2196 (WHY, shortened)

hoisting history moved.

```js
/*
 * Every demo cites a PUBLISHED article. Citing a draft would link a reader on
 * the live site to a page that is not there.
 *
 * READS `publishedTitles`, hoisted to the projects section on 2026-08-30 when
 * the roster's evidence checks needed the same corpus. This block used to parse
 * `posts.json` a second time, which was a second reader of one artifact rather
 * than a second copy of a fact, but it is the shape that becomes one: the two
 * would have needed the same draft predicate, and only one of them applied it
 * to titles.
 */
```

### scripts/check-features.mjs:2220 (CONTRACT, shortened)

section heading shortened.

```js
/* -- behavioural: the contrast lab ---------------------------------------- */
```

### scripts/check-features.mjs:2236 (WHY, shortened)

shortened.

```js
// Lc is SIGNED and the page prints the sign, so polarity is asserted in both
// directions. An unsigned implementation would pass a magnitude check.
```

### scripts/check-features.mjs:2249 (CONTRACT, shortened)

section heading shortened.

```js
/* -- behavioural: the fusion arithmetic ----------------------------------- */
```

### scripts/check-features.mjs:2283 (WHY, shortened)

shortened.

```js
// THE RENDERED CELLS. The page formats with toFixed(5), so these are the exact
  // strings a reader sees for this fixture. Precision cannot drift silently.
```

### scripts/check-features.mjs:2301 (WHY, shortened)

trap kept; first-version story cut.

```js
/*
 * The page must READ the decomposition. A route computing the contribution
 * itself would be a second implementation of the fusion rule, which is the one
 * thing the playground exists not to do.
 *
 * ASSERTED ON CODE, NOT ON PROSE. The first version of this check forbade the
 * string "1/(k + rank)" and failed immediately, because the table's CAPTION
 * says exactly that in English and `stripped()` removes comments, not JSX text.
 * A guard that fires on the copy it is supposed to require is worse than no
 * guard. So the three below are all things only code can do: own the constant,
 * divide by a literal 60, or read the value from the payload.
 */
```

### scripts/check-features.mjs:2344 (CONTRACT, shortened)

section heading shortened.

```js
/* -- behavioural: the media key grammar ----------------------------------- */
```

### scripts/check-features.mjs:2346 (WHY, shortened)

shortened.

```js
/*
 * THE EXPECTED ANSWERS ARE HAND-WRITTEN IN THE MANIFEST, never captured from a
 * run. Hard rule 10's fixture independence, and it is load-bearing here rather
 * than ceremonial: this demo's entire claim is that ONE grammar answers for
 * four readers, and a fixture generated by those readers would agree with any
 * grammar they happened to share, including a wrong one.
 *
 * WHAT EACH ROW BUYS, because a table of booleans looks like padding: the two
 * content-key forms pin the optional dimension segment, the leading-zero key
 * pins the strict spelling that the collapsing differential chose over the
 * loose one, the served path pins THREE different argument contracts at once,
 * and the unclassifiable extension pins the classifier's refusal, which is the
 * one branch a passing test suite would otherwise never enter.
 */
```

### scripts/check-features.mjs:2404 (WHY, shortened)

shortened.

```js
/*
   * "refused" IS AN EXPECTED ANSWER, and it has to be tested as one. A gate
   * that only ever asserted successful classifications would never enter the
   * throw branch, and that branch is the module's whole fail-closed design.
   */
```

### scripts/check-features.mjs:2433 (WHY, shortened)

shortened.

```js
/*
 * THE PRESET SET COVERS EVERY BRANCH, asserted rather than trusted to the
 * curator. A preset list can shrink to the easy cases one edit at a time, and
 * every assertion above would keep passing on whatever was left.
 */
```

### scripts/check-features.mjs:2464 (CONTRACT, shortened)

section heading shortened.

```js
/* -- the key demo is WIRED to the module, not to a copy of its answers ----- */
```

### scripts/check-features.mjs:2489 (CONTRACT, shortened)

section heading shortened.

```js
/* -- behavioural: the theme resolver -------------------------------------- */
```

### scripts/check-features.mjs:2491 (WHY, shortened)

shortened.

```js
/*
 * RUN THE REAL RESOLVER OVER A REAL REQUEST, exactly as the demo does and
 * exactly as the Worker does on every request.
 *
 * Expected answers are hand-written in the manifest, never captured. That
 * matters most for the two rows that look identical and are not arrived at the
 * same way: no cookie takes the resolver's first branch, the header-absent
 * test, while a legacy `theme=system` walks the header, decodes, fails the
 * writable-set test and falls through. A captured fixture would record that
 * they agree; a written one asserts that they MUST, which is the property the
 * shared cache entry depends on.
 */
```

### scripts/check-features.mjs:2517 (WHY, shortened)

shortened.

```js
/*
   * NO HEADER AT ALL versus an EMPTY ONE, and the distinction is deliberate.
   * The resolver's first line returns early when the header is absent, so
   * building a request that always carries a `cookie:` header would route the
   * no-cookie preset down the walking path and quietly stop testing that line.
   */
```

### scripts/check-features.mjs:2528 (WHY, shortened)

behaviour kept; plant story moved.

```js
/*
   * A THROW IS A NAMED FAILURE HERE, NOT A CRASH, and this shape was chosen by
   * a plant rather than by foresight.
   *
   * Removing the resolver's URIError guard made this loop die on the malformed
   * escape preset: the gate exited non-zero with a stack trace and recorded NO
   * assertion, which is "EXIT 1 IS NOT EVIDENCE" in its purest form. The gate
   * was right that something was wrong and useless about what.
   *
   * It also matters beyond the plant. The one thing this preset exists to prove
   * is that a malformed cookie costs a reader the default theme and never the
   * page, and a gate that dies on it proves that by dying, which nothing
   * downstream can read. So the throw is caught and reported AS the failure of
   * this preset, with the message, and the loop carries on to the rest.
   */
```

### scripts/check-features.mjs:2577 (WHY, shortened)

shortened.

```js
/*
 * BRANCH COVERAGE, asserted rather than left to the curator, same as the key
 * presets. Each of these is a line in the resolver that nothing else on this
 * page would enter.
 */
```

### scripts/check-features.mjs:2615 (CONTRACT, shortened)

section heading shortened.

```js
/* -- the theme demo is WIRED to the module and to the Worker's own caller -- */
```

### scripts/check-features.mjs:2617 (WHY, shortened)

trap kept; plant story moved.

```js
/*
 * BOTH NEEDLES ARE WORD-ANCHORED, and that was found by a plant rather than by
 * care. The Worker assertion below was written unanchored; the plant renamed
 * `themeFromRequest` to `themeFromRequestLegacy` throughout workers/app.ts and
 * the gate stayed GREEN, because the longer name CONTAINS the shorter one.
 *
 * That is hard rule 10's unanchored-needle class, and it is structural in this
 * repository rather than a one-off: `check:head`/`check:headers` and
 * `check:content`/`check:contrast` are the recorded prefix pairs, and an
 * identifier plus a suffix is the same trap wearing a different hat. Anchor
 * every needle that verifies a NAME.
 */
```

### scripts/check-features.mjs:2635 (WHY, shortened)

shortened.

```js
/*
 * THE DEMO'S CENTRAL CLAIM, ANCHORED. Its lede says this is the function the
 * Worker calls on every request. That is a sentence about another file, so it
 * is checked against that file rather than left as prose: if the Worker ever
 * stops resolving the theme this way, the claim goes red here instead of
 * quietly becoming a boundary note that aged (hard rule 7).
 */
```

### scripts/check-features.mjs:2670 (CONTRACT, shortened)

section heading shortened.

```js
/* -- behavioural: the markdown pipeline ----------------------------------- */
```

### scripts/check-features.mjs:2672 (WHY, shortened)

shortened.

```js
/*
 * RENDER EACH SNIPPET THROUGH `renderBody`, the one call the deploy build makes
 * for every post, the editor preview makes on every keystroke and the operator
 * API makes on every save.
 *
 * ASYNC, so this block is a labelled scope rather than a bare loop: the rest of
 * this gate is synchronous and top-level await is what keeps the executed-count
 * arithmetic below honest about having run.
 *
 * THE EXPECTED VALUES ARE HAND-WRITTEN. Fixture independence again, and the
 * `throws` row is the one that needs it most: a captured fixture would record
 * whatever the pipeline did, including nothing, and the whole point of the
 * third snippet is that the pipeline MUST refuse it.
 *
 * The image resolver REFUSES, exactly as the route's does. A snippet that grows
 * a media citation has to fail here rather than reach a bucket.
 */
```

### scripts/check-features.mjs:2707 (WHY, shortened)

shortened.

```js
/*
     * A SNIPPET MAY NOT CITE MEDIA, asserted on the SOURCE rather than only by
     * the resolver throwing. The resolver's throw arrives as a render failure,
     * which names the wrong cause: it would read as the pipeline refusing the
     * snippet when what happened is that the snippet asked for something this
     * demo will not do.
     */
```

### scripts/check-features.mjs:2742 (WHY, shortened)

shortened.

```js
/*
       * THE REFUSAL NAMES THE CAUSE. A throw alone is not the property: the
       * ruling is that an unimplemented directive is a NAMED build error rather
       * than a silent empty div, and a message that did not name the directive
       * would satisfy a bare throws check while failing the actual promise.
       */
```

### scripts/check-features.mjs:2771 (WHY, shortened)

shortened.

```js
/*
     * A DEMOTED URL MUST NOT SURVIVE AS AN HREF, which is the whole claim and
     * is NOT implied by the count. The demotion renders the markdown that
     * produced it as escaped TEXT, so the URL appears in the document; what
     * must not appear is an attribute carrying it.
     */
```

### scripts/check-features.mjs:2788 (WHY, shortened)

shortened.

```js
/*
   * BRANCH COVERAGE. Each of these is a pipeline behaviour a PUBLISHED ARTICLE
   * cannot demonstrate, which is the demo's entire reason for existing: a
   * published article is by definition one that tripped none of the refusals.
   */
```

### scripts/check-features.mjs:2810 (CONTRACT, shortened)

section heading shortened.

```js
/* -- the markdown demo is WIRED to the pipeline, and bounded -------------- */
```

### scripts/check-features.mjs:2812 (WHY, shortened)

shortened.

```js
/*
 * A TWO-FILE CHAIN, so both links are asserted. The route calls a server
 * wrapper and the wrapper calls the shared renderer; checking only the route
 * would prove it calls SOMETHING, and checking only the wrapper would prove
 * nothing about what the page does.
 */
```

### scripts/check-features.mjs:2846 (WHY, shortened)

shortened.

```js
/*
 * THE BOUND IS THE ENUM, asserted on CODE. This is the assertion that keeps the
 * deferred entry honest: the free-text form is still deferred, and the way that
 * stays true is that the loader selects from the manifest's slugs rather than
 * reading a body out of the query string.
 */
```

### scripts/check-features.mjs:2868 (WHY, shortened)

shortened.

```js
/*
 * THE DEFERRED ENTRY STILL REFUSES THE TEXT BOX. Narrowing an entry is a
 * legitimate move; deleting it because a NEIGHBOURING form shipped is how a
 * stated absence quietly becomes a claim of completeness.
 */
```

### scripts/check-features.mjs:2883 (CONTRACT, shortened)

section heading shortened.

```js
/* -- behavioural: the chart renderer -------------------------------------- */
```

### scripts/check-features.mjs:2936 (WHY, shortened)

shortened.

```js
// A hex here would be a palette bypass check:contrast can never see, because
    // it never reads this SVG.
```

### scripts/check-features.mjs:2951 (CONTRACT, shortened)

section heading shortened.

```js
/* -- copy law -------------------------------------------------------------- */
```

### scripts/check-features.mjs:2963 (HISTORY, deleted)

record of a deleted assertion.

```js
/*
 * DELETED 2026-08-21: the assertion banning the string "WCAG 3" from this page.
 *
 * THE LABELING RULING ABOVE STAYS and is the half that was ever load-bearing.
 * The page must name WCAG 2.2 as its conformance target and must label APCA as
 * not part of any standard. Those say what the page MUST claim, which is the
 * honest form of the rule and is falsified by a real defect.
 *
 * Banning a two-word string said what the page may not SAY, which is a
 * different and worse thing. WCAG 3.0 exists as a W3C working draft and APCA is
 * being developed in its context, so the most accurate sentence this lab could
 * add is one naming that relationship. **The ban made the next TRUE sentence
 * fail the build**, which is a gate holding a page back from being more correct
 * rather than stopping it being wrong.
 *
 * The failure it guarded, a page claiming conformance to a level that has none,
 * is already impossible: the assertion above requires WCAG 2.2 to be named as
 * THE target, so a page claiming WCAG 3 conformance instead would fail there.
 */
```

### scripts/check-features.mjs:2987 (WHY, shortened)

reason kept; refactor story moved.

```js
/*
 * EITHER SPELLING SATISFIES THIS, and the widening is deliberate rather than a
 * loosening. The needle was /SHARED_CACHE_CONTROL/ against this route's source,
 * which stopped matching the day the four identical headers() bodies were
 * replaced by one publicHtmlHeaders() helper: the route still sets an explicit
 * Cache-Control, it just no longer names the constant.
 *
 * The claim being made is "this route sets one", not "this route spells it a
 * particular way", so the assertion now accepts the helper OR the constant and
 * still requires the headers() export. A route that exports nothing fails, which
 * is the state the assertion exists for.
 */
```

### scripts/check-features.mjs:3013 (CONTRACT, shortened)

section heading shortened.

```js
/* -- artifact parity, both directions ------------------------------------- */
```

### scripts/check-features.mjs:3048 (NUMBER, shortened)

floor asserted in code; summing history moved.

```js
/*
 * Executed-count floor, MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING
 * the section, never by adding up the loops. Two recorded failures of summing
 * sit behind that rule: 91 guessed against 154 measured in the projects section
 * above, and 40 against 37 in the icon suite. Floored at the measured count
 * less the ~8% margin the rest of the family uses.
 */
```

### scripts/check-features.mjs:3077 (WHY, shortened)

reason kept; measurements moved.

```js
/*
 * WHOLE-GATE EXECUTED-COUNT FLOOR.
 *
 * The projects and playground sections already floor THEMSELVES, and that is
 * not the same guarantee: a section floor cannot see a DIFFERENT section
 * stopping, and this gate has several unfloored ones ahead of them (the feature
 * roster, the anchors, the enhancement inventory, the colophon page records).
 * Each section floor is a local witness; this is the global one.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it. Never summed, and
 * the habit of summing is why: 91 was guessed against 154 measured for the
 * projects section in this very file.
 *
 * **RE-MEASURED 2026-08-30, twice in one day: 715 after the roster build-out and
 * 801 after the key demo, 854 after the theme demo and 887 after the markdown
 * demo, against 583 on 2026-08-14.**
 *
 * Floored at 660, roughly 7 percent. More slack than the small gates get,
 * because this count moves with the CORPUS: posts, tags, projects and demos all
 * feed it, so ordinary content work shifts it by tens.
 */
```

### scripts/check-features.mjs:3098 (NUMBER, shortened)

floor asserted in code; incident and measurements moved.

```js
/*
 * RE-MEASURED 2026-09-11 BY RUNNING THE GATE, never by adding this session's
 * new assertions to the old number. 909 before the anonymousGet
 * reconciliation and the continuous-integration assertion landed, 936 after.
 * The floor stood at 864, which was 45 under its own count BEFORE either of
 * them and 72 under after: a floor that far below what it measures can lose
 * seventy assertions and still pass, which is the exact shape FAILURES.md
 * calls a limit positioned where it cannot bite.
 *
 * Executed 936, tolerance 47, so the lowest legal floor is 889. This sits at
 * 913, about half the tolerance under the count.
 *
 * **SET THROUGH check:floors' OWN TOLERANCE, 2026-09-11, after CI caught the
 * first attempt.** That attempt read "six percent under" out of a comment in
 * check-headers.mjs and applied it to four gates. The rule is
 * `max(3, ceil(executed * 0.05))` and it belongs to `scripts/check-floors.mjs`,
 * the gate that enforces it. Prose about a gate ages; the gate does not.
 *
 * It went undetected locally because check:floors runs the whole offline tier
 * and therefore runs LAST, and the tier hangs before it on this host
 * (node --test wedges on test/check-all-cleanup.test.mjs, which predates this
 * work and is proven so by differential). CI reached it on the first push.
 */
```

## scripts/verify-live.mjs

### scripts/verify-live.mjs:1 (CONTRACT, shortened)

usage, boundary and harness rules kept; theme-cookie incident moved.

```js
/**
 * Live verification against the deployed Worker.
 *
 *   node scripts/verify-live.mjs [origin]
 *
 * OBSERVATION BOUNDARY: it sees ONE cache state, whichever exists when it runs,
 * and it is normally run seconds after a deploy. The Worker version is part of
 * the cache key, so a deploy empties the cache and every assertion below is
 * answered by the Worker itself. It cannot see a bug that only appears once an
 * entry is WARM unless it is run twice, which is not automatic.
 *
 * Not a gate: it needs the network and a deploy, so it is not in the check
 * family. It exists so a deploy is verified by running assertions rather than
 * by looking at a page and feeling reassured.
 *
 * ## The cold-cache blind spot, recorded because it cost four sessions
 *
 * Enabling Workers Cache on 2026-08-02 made the theme cookie invisible to the
 * cache key, so `/blog` served whichever theme filled the entry. This file
 * asserts the theme persists and DID NOT CATCH IT for four consecutive
 * sessions, because it always ran within seconds of a deploy and therefore
 * always against a cold cache. Every run was answered by the Worker, which was
 * correct the whole time.
 *
 * The tell, when it finally appeared, was that the failure count MOVED between
 * runs: 79/17, then 95/1, then 96/0. A deterministic failure does not do that.
 * **If this file's count varies run to run, suspect the cache before the diff.**
 *
 * RUN IT TWICE after any change to caching or to a `headers` export: once cold,
 * once warm. Passing cold means the Worker is right, which is a smaller claim
 * than it looks.
 *
 * Harness rules, every one learned the hard way on this site:
 *   - Send a browser user-agent. Cloudflare answers 403 error 1010 to some
 *     default clients on this hostname.
 *   - Send Cache-Control: no-cache, and treat an unchanged byte count after a
 *     deploy as a stale read rather than a failed deploy.
 *   - Scope every content assertion to the region that proves it. A check for
 *     "did this query return the post" once passed against a zero-result page,
 *     because the zero state renders a "Recent writing" list carrying the same
 *     link.
 *   - Never bake a content hash into a check. Asset names change.
 *   - React SSR inserts <!-- --> between adjacent text nodes, so comments are
 *     stripped before matching rendered output.
 *   - SSR also ESCAPES. An apostrophe becomes &#x27;, so prose taken from a data
 *     file needs entities decoded before matching, not only comments stripped.
 *     Cost five red runs against a correct page before it was noticed, and the
 *     failure read as missing content rather than as a harness bug.
 */
```

### scripts/verify-live.mjs:55 (WHY, shortened)

imported, never restated.

```js
// The listing shape the site itself uses. Imported, never restated: this
// harness deriving its own copy of the page size is exactly the staleness the
// pagination assertions below were ruled against.
```

### scripts/verify-live.mjs:64 (WHY, shortened)

trimmed.

```js
// The colophon's section list, IMPORTED for the reason POSTS_PER_PAGE is. The
// completeness sweep in section 12b matches each section's descriptor lead
// against the rendered page, and a copy of those leads here would be a third
// mirror to go stale, asserting what this harness remembers rather than what
// the index carries.
```

### scripts/verify-live.mjs:70 (WHY, shortened)

trimmed; owner kept.

```js
// The watchdog's poll interval, IMPORTED for the reason COLOPHON_SECTIONS is.
// Section 17 bounds the live health verdict against it, and the number has one
// owner: the watchdog's cron, bound to this constant by check:invariants
// section 25. A literal here would be the third copy.
```

### scripts/verify-live.mjs:75 (HISTORY, deleted)

refers to removed code.

```js
// The fact needles, and the `statusLabel` call that used to be made here.
```

### scripts/verify-live.mjs:77 (WHY, shortened)

trimmed.

```js
// The walk and the stem rule come from the offline gate, never restated: the
// wire assertion in section 16 must compare against the same set the ceilings
// were measured over, or the two halves drift into asserting different pages.
```

### scripts/verify-live.mjs:83 (WHY, shortened)

trimmed; incident moved.

```js
// The card key, DERIVED with the same function the sync and the uploader use.
// A literal key here survived exactly until the day the hash set changed; see
// the media-cache block for what it cost.
```

### scripts/verify-live.mjs:90 (WHY, shortened)

trimmed.

```js
/*
 * The colophon's two data files, READ rather than restated. This harness
 * listing its own copy of the bindings or the features would be a third mirror
 * to go stale, and the whole point of those assertions is that what the page
 * renders matches what the artifact carries.
 *
 * `readFileSync` rather than an import attribute: `with { type: "json" }` is
 * only legal under a newer `module` setting than this repo's tsconfig uses, and
 * it fails the typecheck rather than the run.
 */
```

### scripts/verify-live.mjs:136 (WHY, shortened)

trap kept; measurement moved.

```js
/**
 * Character references decoded, so prose from a data file can be matched
 * against rendered output.
 *
 * **The second transform SSR applies, and the one that is easy to forget.**
 * Stripping comments is already documented above; escaping is not, and it is the
 * same class of trap. React escapes `'` to `&#x27;`, so an assertion looking for
 * "Every form's submitted payload" in the HTML finds nothing while the page is
 * perfectly correct.
 *
 * Measured, not theorised: two of the thirty-eight colophon features carry an
 * apostrophe, and the completeness assertion below was RED against a correct
 * page in five consecutive runs before this existed. It reported "36 of 38",
 * which reads exactly like missing content rather than like a harness bug.
 *
 * @param {string} s
 */
```

### scripts/verify-live.mjs:165 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 1. Theme resolution, server rendered ------------------------------- */
```

### scripts/verify-live.mjs:172 (WHY, shortened)

shortened.

```js
// THE LEGACY COOKIE, still honoured on read and resolving to the default.
```

### scripts/verify-live.mjs:184 (WHY, shortened)

trimmed.

```js
// The anti-flash claim, stated as an assertion rather than a belief: if no
// script sets the attribute, there is no frame in which it can be wrong.
```

### scripts/verify-live.mjs:193 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 2. Theme persists across navigation ------------------------------- */
```

### scripts/verify-live.mjs:201 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 3. The shipped stylesheet carries the v3 palette ------------------- */
```

### scripts/verify-live.mjs:204 (WHY, shortened)

two-plane assertion intent kept; split history moved.

```js
/*
   * TWO PLANES, TWO STYLESHEETS, SINCE 2026-08-23.
   *
   * This block used to take the FIRST `/assets/*.css` linked on `/` and treat
   * it as "the stylesheet". That was true while `app.css` imported all sixteen
   * parts. The admin sheets then moved to `app/admin.css`, and the very next
   * run failed on `css: .btn-danger uses --fill-danger`, because that rule
   * lives in `admin-posts.css` and had left the public bundle. The instrument
   * was right to fail: it was asserting a property of a file it could no
   * longer see.
   *
   * FOURTH INSTANCE OF ONE CLASS IN A SINGLE CHANGE. `check:contrast`,
   * `check:logo` (through `stylesheetPaths`) and
   * `test/code-block-padding.test.mjs` all narrowed the same way, all failed
   * rather than passing, and all are repaired the same way: follow every
   * stylesheet the site actually serves.
   *
   * `/login` is where the admin bundle is reachable WITHOUT a session, which is
   * what makes this checkable from here at all. It is unauthenticated by design
   * and links both sheets.
   *
   * ## EACH PROPERTY IS ASSERTED WHERE IT BELONGS, IN BOTH DIRECTIONS
   *
   * Concatenating the two and asserting against the union would pass, and would
   * stop distinguishing "the tokens reach every reader" from "the tokens exist
   * somewhere". The palette must be in the PUBLIC sheet; `.btn-danger` must be
   * in the ADMIN one and must NOT have drifted back into the public bundle,
   * because a rule that reappears there is weight every reader pays for and
   * nothing else would notice.
   */
```

### scripts/verify-live.mjs:242 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE, before anything is read. Two DISTINCT stylesheets have to be found
   * or every assertion below is being made about a corpus nobody has proven
   * non-empty, and a split that quietly collapsed back into one bundle would
   * look identical to a healthy one.
   */
```

### scripts/verify-live.mjs:270 (WHY, shortened)

trimmed.

```js
// v3 values, read from the doc rather than from our own source file. These
    // are TOKENS and they are asserted on the PUBLIC sheet, because a token
    // that only reaches the admin plane has not shipped.
```

### scripts/verify-live.mjs:294 (WHY, shortened)

trimmed.

```js
/*
     * `.btn-danger` IS ADMIN-PLANE NOW, and both halves are asserted. The
     * positive proves the delete button still reads its fill from the token;
     * the negative proves the admin bundle has not leaked back into the sheet
     * every public reader downloads.
     */
```

### scripts/verify-live.mjs:308 (WHY, shortened)

scope rule kept; split history moved.

```js
/*
     * THE SEARCH RULES ARE ON /search's OWN SHEET, since the per-route CSS
     * split of 2026-08-27, and this assertion moved with them.
     *
     * It read the sheet linked on `/`, which was every rule on the site until
     * that day and is now the chrome. `.search-snippet mark` went to
     * `search-page.css`, which only `/search` links, so the assertion started
     * failing on a site whose mark is perfectly correct. The split is the
     * thing that made it wrong, and the honest repair is to look where the
     * rule lives rather than to widen the pattern until it passes.
     *
     * The stylesheets `/search` links MINUS the ones `/` links is the route's
     * own set. Asserting that set is non-empty is what keeps the check below
     * from being about nothing: if the split ever collapses back into one
     * bundle, this fails here rather than passing quietly on the chrome sheet.
     */
```

### scripts/verify-live.mjs:341 (WHY, shortened)

trimmed.

```js
/*
     * SITE-WIDE, so it runs against BOTH sheets. Scoping it to the public one
     * would have let an admin focus ring go back to box-shadow unseen, and the
     * rule this asserts is a palette law, not a plane's preference.
     */
```

### scripts/verify-live.mjs:362 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 4. Header: the icon control and the stray slash -------------------- */
```

### scripts/verify-live.mjs:374 (WHY, shortened)

contract kept; dated history moved.

```js
// THE HINT IS NO LONGER PAINTED, ordered 2026-08-29. It was a visible <kbd>
  // inside the anchor; it is now an sr-only description the enhancement
  // unhides, plus a title the enhancement sets. The CONTRACT is unchanged and
  // is what these two assert: nothing on the wire advertises the shortcut,
  // because the wire is the no-JS state and the shortcut does not exist there.
  //
  // A blanket "the anchor contains no <kbd>" assertion used to sit here, was
  // deleted on 2026-07-30 when the badge arrived, and is now TRUE again. It is
  // not restored as a blanket: the specific pair below says the same thing
  // about the element that actually exists, and a blanket needle over the whole
  // document would pass or fail on markup this section does not own.
```

### scripts/verify-live.mjs:394 (WHY, shortened)

trimmed.

```js
// The description is OUTSIDE the anchor and reached by aria-describedby, so
  // the association is what has to hold rather than containment.
```

### scripts/verify-live.mjs:402 (WHY, shortened)

wire half kept; history moved.

```js
/*
   * THE CONTROL IS ONE BUTTON WEARING TWO, since 2026-08-29. It ships a
   * dark-setting and a light-setting submit and the cascade displays whichever
   * matches the theme in effect, which is what lets the no-script post carry
   * the right value without the server knowing a preference it cannot see.
   *
   * ASSERTED ON THE WIRE, where only the markup exists: both buttons present,
   * both writable, and NO pressed state, because a single action button that
   * announced itself as pressed would be describing a control this is not.
   * Whether exactly one is PAINTED is a cascade question and belongs to
   * check:browser, which has a layout engine; this is the half a fetch can see.
   */
```

### scripts/verify-live.mjs:431 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 5. The markdown twin is byte-identical to the repo ----------------- */
```

### scripts/verify-live.mjs:437 (WHY, shortened)

trap kept; measurement moved.

```js
// Compared against the ARTIFACT's markdown field, not the repo file.
  // The twin serves the post BODY; the file on disk also carries 296 bytes of
  // frontmatter, so comparing the two reports a 297 character difference that
  // looks exactly like content drift and is not. Measured, after the first run
  // of this script failed that way.
```

### scripts/verify-live.mjs:454 (WHY, shortened)

chain kept; tautology story moved.

```js
// And the artifact is itself gated against the file by check:content, so the
  // chain from file to served bytes is closed without comparing unlike things.
  //
  // **This assertion was `true`.** A literal, passing unconditionally, inflating
  // the count by one and proving nothing about the header it named. The twin's
  // whole purpose is that an agent can fetch source rather than scrape a page,
  // and an agent decides that from the content-type; serving the right bytes
  // under `text/html` would have failed the reader while this passed.
```

### scripts/verify-live.mjs:470 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 6. Search still works, and marks are gold ------------------------- */
```

### scripts/verify-live.mjs:475 (WHY, shortened)

trimmed.

```js
// Scope to the results list, because the zero state renders a recent-writing
  // list carrying the same links and would pass a naive check.
```

### scripts/verify-live.mjs:489 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 7. Admin is still gated ------------------------------------------- */
```

### scripts/verify-live.mjs:496 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 8. The orphaned static assets ------------------------------------- */
```

### scripts/verify-live.mjs:523 (CONTRACT, shortened)

heading and cap rule kept; leak story moved.

```js
/* --- 9. Drafts reach NONE of the nine public surfaces -------------------- *
 *
 * Regression check for the leak of 2026-07-29: five unpublished drafts were
 * uploaded to the AI index unconditionally, and the public unauthenticated
 * /search/ask answered from one and cited it by slug.
 *
 * The eight keyword surfaces filter at QUERY time and are cheap, so every draft
 * is checked against all of them. Ask is the ninth and it BILLS PER ANSWER, so
 * it is capped and the cap is printed rather than left implicit: a silent cap
 * reads as "covered everything" when it did not.
 *
 * The draft list comes from the gated artifact, so a post added later is swept
 * without anyone remembering to add it here.
 */
```

### scripts/verify-live.mjs:549 (WHY, shortened)

trimmed; ruling history moved.

```js
// The published corpus is present, which is what stops "nothing is listed"
  // passing this whole section for the wrong reason.
  //
  // CORPUS-AWARE, not page-1-naive. This block used to assert that every
  // published post appeared on /blog, which silently meant page 1. It went red
  // the moment the corpus passed POSTS_PER_PAGE, on a site that was paginating
  // correctly, and it would have gone red again every ten posts by
  // construction. Ruled 2026-07-30: derive the expected page from the published
  // count and the page size instead.
  //
  // POSTS_PER_PAGE is IMPORTED rather than restated. The number already existed
  // twice in the app; a third copy here is what the ruling is about.
```

### scripts/verify-live.mjs:568 (WHY, shortened)

intent kept; tautology story moved.

```js
// **This assertion used to be `pages === Math.max(1, Math.ceil(live.length /
  // POSTS_PER_PAGE))`, which is the body of `pageCount` restated.** `pages` IS
  // `pageCount(live.length)`, so it compared an expression to itself and could
  // never fail, while its label claimed the site paginated correctly. It made
  // no request. Second tautology found in this file, after the literal `true`.
  //
  // What it should have asserted is the SITE's boundary against the derived
  // count: the last page in range carries posts, and the first page out of
  // range carries none. That fails if the site paginates at a different size
  // than the app's own constant, which is the thing worth knowing.
```

### scripts/verify-live.mjs:594 (HISTORY, deleted)

tense-bound narrative.

```js
// Pagination is a surface the corpus only just grew, so assert it exists and
  // answers rather than assuming the site kept up.
```

### scripts/verify-live.mjs:608 (WHY, shortened)

trimmed.

```js
// The listing is ordered by publishAt DESC, and SQLite does not promise an
  // order WITHIN a tie. Several posts here share a publish date, so a post's
  // position is a RANGE rather than a number, and pinning it to one page would
  // make this harness flaky the first time a tie group straddled a boundary.
  // The range collapses to a single page for any post whose date is unique,
  // which is the usual case, so the assertion stays exact where exactness means
  // anything.
```

### scripts/verify-live.mjs:637 (WHY, shortened)

trimmed.

```js
// EVERY page, not page 1. This section exists because of the 2026-07-29
    // draft leak, and a leak-regression check that only looks at the first page
    // is the same page-1-naive defect the listing assertions above just shed.
```

### scripts/verify-live.mjs:655 (WHY, shortened)

trimmed.

```js
// Its own title is the query most likely to retrieve it, so a miss here is
    // meaningful rather than an artefact of a weak query.
```

### scripts/verify-live.mjs:665 (CONTRACT, shortened)

key shape kept; first-version story moved.

```js
/**
   * The ninth surface. A citation rides as `item.key`, which is
   * `blog/<slug>.md` or `blog/<slug>__<anchor>.md`, NOT a `/blog/<slug>` URL:
   * the URL is reconstructed client side by ask-keys.mjs. The first version of
   * this check searched the body for `/blog/<slug>` and could therefore never
   * have failed, which is why it was made to fail before being trusted.
   *
   * @param {string} label @param {string} q
   * @returns {Promise<{keys: string[], status: number} | null>} null if refused
   */
```

### scripts/verify-live.mjs:676 (WHY, shortened)

date moved.

```js
// POST since 2026-08-16: Ask bills, so a GET that spends budget was
    // reachable by any crawler or prefetch. The probe follows the endpoint.
```

### scripts/verify-live.mjs:688 (WHY, shortened)

trimmed.

```js
// A refusal is the guard working, not a leak result, and it must not be
    // counted as evidence of absence.
```

### scripts/verify-live.mjs:702 (WHY, shortened)

trimmed.

```js
/**
   * A query MEASURED to retrieve on this corpus. Its job is to prove retrieval
   * is alive, so that the draft probes below are absence of a leak rather than
   * absence of an answer. Ask returns zero chunks for plenty of reasonable
   * questions under the instance's 0.4 score threshold, and without this the
   * whole section would pass on an empty index.
   *
   * If the corpus moves and this stops retrieving, this check fails and someone
   * picks a new probe. That is the intended failure, not a false alarm.
   */
```

### scripts/verify-live.mjs:723 (WHY, shortened)

intent kept; audit story moved.

```js
/*
   * THE INJECTION REPLAY. One probe, and it is the exact question the audit
   * used on 2026-08-27.
   *
   * What that question did on the wire: it returned the system prompt verbatim,
   * with 180 prompt tokens, which is the prompt and the question and
   * essentially no retrieved context. The endpoint then wrote that answer to KV
   * under the question's hash for seven days and served it to anybody who asked
   * the same thing. Output is written with `textContent` everywhere, so this
   * was a spoofed answer rather than script execution.
   *
   * THREE THINGS ARE ASSERTED and each one closes a different half. The answer
   * is the no-answer text, so the reader is not shown something invented. The
   * chunks list is empty, which is WHY it is refused and proves the substitution
   * fired rather than the model happening to decline. And `x-ask-cache` never
   * reports a hit, on this request or on a second identical one: a hit on the
   * second is the cache write the refusal exists to prevent, and it is the only
   * way to see that write from outside.
   *
   * TWO BILLED CALLS, deliberately, and the second is the point. Asserting only
   * the first would pass on a build that answered correctly and cached it
   * anyway, which is exactly the state this replaced.
   */
```

### scripts/verify-live.mjs:805 (NUMBER, shortened)

rate limit not asserted here; cap rule kept.

```js
// Billed per answer and rate limited to five per minute per IP, so this is
  // capped and the cap is printed. A silent cap reads as full coverage.
```

### scripts/verify-live.mjs:820 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 10. The retired routes are bare 404s, and the kept files are not ---- */
```

### scripts/verify-live.mjs:823 (WHY, shortened)

prohibition kept; history moved.

```js
// Never a redirect and never a prefix rule: /publications/* and
  // /phage-hunters/* ARE the 40 kept files, and a gone rule matching either
  // prefix would take them with it.
  // `/phage-discovery` LEFT THIS LIST on 2026-08-02: the Worker serves the
  // Roster page there now, so asserting a 404 would assert the page is broken.
  // It is asserted as a 200 in section 11 instead.
  //
  // `/phage-hunters` STAYS, and the difference is deliberate rather than an
  // oversight. There is no /phage-hunters ROUTE any more, while
  // /phage-hunters/* is still nine static photos that section 8 asserts are
  // reachable. The page prefix and the asset prefix differ on purpose.
```

### scripts/verify-live.mjs:840 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 11. The Roster page at the legacy URL ------------------------------ */
```

### scripts/verify-live.mjs:846 (HISTORY, deleted)

repeats the header rule.

```js
// Comments stripped before matching, per the harness rules: SSR splices
  // <!-- --> between adjacent text nodes, which silently defeats a naive match.
```

### scripts/verify-live.mjs:850 (WHY, shortened)

trap kept; audit story moved.

```js
/*
   * DELIMITED TO THE HEADING, and the unscoped form could not fail.
   *
   * `page.includes("Roster")` matched the word anywhere in the document, and
   * the site header renders `<NavLink to="/phage-discovery">Roster</NavLink>`
   * on EVERY page. Deleting the `<h1>` entirely left this assertion green.
   * Found by the 2026-08-07 audit, fixed here; it is one of the two instances
   * check:assertions was written to catch, and it flagged this exact line on
   * its first run.
   */
```

### scripts/verify-live.mjs:866 (WHY, shortened)

trimmed.

```js
// All nine cohort years. Asserted individually rather than as a count, so a
  // failure names the year that is missing instead of reporting "8 of 9".
```

### scripts/verify-live.mjs:875 (WHY, shortened)

trimmed; history moved.

```js
// An assertion that can pass by reading nothing is not an assertion: if the
  // fetch returned an error page, the loop above would report nine misses, but
  // this states the positive count so "0 missing" cannot mean "0 examined".
  //
  // The first conjunct used to be `years.length === 9`, where `years` is built
  // by `Array.from({ length: 9 })` two lines up. Constant true, and so half of
  // this guard was dead: it asserted the harness's own literal rather than the
  // page. Counting what was FOUND is what actually proves examination.
```

### scripts/verify-live.mjs:890 (WHY, shortened)

trimmed.

```js
// The nav link, from the HOMEPAGE, which is what makes the page reachable
  // rather than merely present.
```

### scripts/verify-live.mjs:900 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 12. The colophon ---------------------------------------------------- */
```

### scripts/verify-live.mjs:906 (HISTORY, deleted)

repeats the header rule.

```js
// Comments stripped AND entities decoded, per the harness rules. Both are
  // transforms SSR applies between the data file and the wire, and matching
  // prose that came out of JSON needs both undone.
```

### scripts/verify-live.mjs:911 (WHY, shortened)

trimmed.

```js
// The TITLE, not the URL. Both are ruled and they deliberately differ: the
  // path takes the IndieWeb convention, the heading takes the legibility.
```

### scripts/verify-live.mjs:919 (WHY, shortened)

trimmed.

```js
// Generated content actually rendered, rather than an empty shell. A POSITIVE
  // count, so "nothing missing" cannot mean "nothing examined".
```

### scripts/verify-live.mjs:930 (WHY, shortened)

trimmed; history moved.

```js
/*
   * The hand-written half, which no generator produces.
   *
   * DELIMITED to the heading element, matching the binding sweep twelve lines
   * above. The unscoped `page.includes(f.name)` was satisfied by a feature name
   * appearing ANYWHERE, including inside another feature's prose, and several
   * of these names are ordinary sentences. Flagged by check:assertions on its
   * first run; the second of the two instances that gate was written to catch.
   */
```

### scripts/verify-live.mjs:948 (WHY, shortened)

trimmed.

```js
// Reachability, not mere existence, and taken from a DIFFERENT page's footer
  // so this proves the site-wide footer carries it rather than the page linking
  // to itself.
```

### scripts/verify-live.mjs:965 (WHY, shortened)

trimmed.

```js
// THE LIVE ROW, not the file. `llms.txt` is served from D1 and the tracked
  // file is only the fallback, so this is the one assertion that catches a
  // committed file whose sync never ran. check:llms --remote reports the same
  // drift offline; this asserts it on the path a reader actually takes.
```

### scripts/verify-live.mjs:978 (WHY, shortened)

trimmed.

```js
// One post carries the pointer line. Ratified as ONE line in the template
  // rather than a section per article, so asserting it on a single post is
  // asserting the template.
```

### scripts/verify-live.mjs:989 (CONTRACT, shortened)

heading kept; commit history moved.

```js
/* --- 12b. The colophon is IN the search corpus, section-grained --------- *
 *
 * The `page` records landed with 49b35d5 and reached production D1 on
 * 2026-08-05, taking search_docs from 93 to 101. Everything below is about the
 * LIVE index, so no offline gate can carry it: `check:content` proves the
 * artifact matches a fresh generation and `check:features` proves the section
 * ids agree, and both are green whether or not a single row was ever synced.
 *
 * **The completeness sweep is the assertion that would have caught the
 * duplication ebde677 fixed**, and it is worth being precise about why. Six of
 * seven sections rendered their descriptor lead and then repeated it in
 * different words. Every gate stayed green: the artifact was byte-identical,
 * the ids reconciled, the types checked. Nothing compared what the INDEX
 * promises a reader against what the PAGE actually shows them, which is the one
 * comparison that fails when a record's body and its page drift apart.
 */
```

### scripts/verify-live.mjs:1007 (WHY, shortened)

trimmed; measurement moved.

```js
/**
   * A section's own slice of the page, from its heading to the next one.
   *
   * SCOPED, per the harness rule at the top of this file, and not as a nicety.
   * Unscoped, `react` matched a modulepreload href in `<head>` and `Ask`
   * matched the palette's Ask row, so the dependencies and features sweeps
   * passed on markup that had nothing to do with the section being checked.
   * Measured before this was scoped: 9 tokens were passing that way.
   *
   * @param {string} html @param {string} id
   */
```

### scripts/verify-live.mjs:1025 (CONTRACT, shortened)

trimmed; history moved.

```js
/**
   * The fact needles, from `scripts/lib/colophon-facts.mjs`.
   *
   * They used to be a closure right here, and that is what made this the
   * colophon's second registration site with no offline reader. A section could
   * be added to the descriptor with its body rule and without its fact list,
   * and the first thing to say so was this harness, crashing after a deploy.
   * That is what happened to `security` in ship window 8.
   *
   * Moved into a module so `test/colophon-facts.test.mjs` can assert the
   * coverage offline. The values are still authored independently of
   * `colophonPageInput`, deliberately; the module's header says why deriving
   * them would make this sweep unable to fail.
   *
   * @param {string} id
   * @returns {string[]}
   */
```

### scripts/verify-live.mjs:1044 (WHY, shortened)

trap kept; measurement moved.

```js
/**
   * A term that exists ONLY on the colophon, so a hit cannot come from a post.
   *
   * **`Vectorize` was the obvious second candidate and it does NOT work**,
   * measured rather than assumed. Both terms are absent from all twelve posts
   * AS WRITTEN, but the prose index stems with porter, so `Vectorize` reduces
   * to `vector` and retrieves two published posts that discuss vectors. A term
   * is corpus-unique only AFTER stemming. `1042` is a Cloudflare error number,
   * survives stemming unchanged, and appears nowhere else on this site.
   */
```

### scripts/verify-live.mjs:1081 (HISTORY, deleted)

restates the code.

```js
// The page as a reader receives it, for the anchor and completeness checks.
```

### scripts/verify-live.mjs:1086 (WHY, shortened)

trimmed.

```js
/**
   * A SECTION-GRAINED hit deep-links to a fragment that exists.
   *
   * This is the failure the descriptor was built to prevent and it is silent:
   * a record pointing at a dead fragment still returns a hit, still looks
   * correct in a result list, and scrolls nowhere. Only the rendered page can
   * settle it.
   */
```

### scripts/verify-live.mjs:1113 (WHY, shortened)

trimmed.

```js
/**
   * The `type` facet stops having one value.
   *
   * Before the page records were synced this reported `post` and nothing else,
   * so a facet with one value is the exact signature of the sync not having
   * run. The query is broad on purpose: it has to match both types.
   */
```

### scripts/verify-live.mjs:1136 (CONTRACT, shortened)

trimmed.

```js
/**
   * EVERY FACT THE INDEX CARRIES IS ON THE PAGE THE READER LANDS ON.
   *
   * Per section, the descriptor lead as one contiguous substring plus every
   * discrete value its record body was assembled from. A miss means the index
   * promises something the page does not show, which is a wrong result rather
   * than an empty one.
   */
```

### scripts/verify-live.mjs:1169 (HISTORY, deleted)

restates the rule above.

```js
// The count, printed rather than implied. "0 missing" across seven sections
  // means nothing without the number of facts that were actually compared.
```

### scripts/verify-live.mjs:1174 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 13. The cache, observed WARM -------------------------------------- */
```

### scripts/verify-live.mjs:1176 (WHY, shortened)

trap kept; story moved.

```js
/**
 * **This section exists because every other one runs cold.**
 *
 * The Worker version is part of the cache key, so a deploy empties the cache
 * and this sweep normally runs seconds later. Every assertion above is
 * therefore answered by the Worker itself, which is a smaller claim than it
 * looks: the theme-cookie bug lived for four sessions behind exactly that,
 * asserting the theme persists while never once reading a cached response.
 *
 * So this section deliberately warms each entry and then asks again.
 *
 * **It does NOT use `get()`.** That helper sends `Cache-Control: no-cache` on
 * every request, which forces revalidation and would make "not a HIT" pass for
 * the wrong reason: the response would be uncached because the REQUEST said so,
 * not because the route is uncacheable. Reusing it here would have produced a
 * green section that proved nothing, which is the failure mode hard rule 10 is
 * about.
 */
```

### scripts/verify-live.mjs:1197 (HISTORY, deleted)

restates #100.

```js
/** A plain GET. No `no-cache`, because cache behaviour is the subject. */
```

### scripts/verify-live.mjs:1210 (WHY, shortened)

trimmed; history moved.

```js
// Every public HTML surface. ALL SIX EXPORT `headers` OF THEIR OWN, so none
  // of them observes the Worker's no-Cache-Control default; the loop below
  // requires `cf === "HIT"` for the cookieless population, which a `no-store`
  // route could never satisfy. This comment used to claim two of them had no
  // `headers` export and reached the default here. That stopped being true as
  // routes gained their own, and it left the default with no wire coverage at
  // all until 2026-08-07. It is asserted on the `/admin` 302 instead, in the
  // security-headers section, which is the one live surface that still reaches
  // it.
```

### scripts/verify-live.mjs:1225 (HISTORY, deleted)

restates the population rule below.

```js
// /colophon has the same `headers` export as home and the Roster page, so
    // it belongs to the same population: shared-cached for cookieless readers,
    // and `private, no-store` plus a bypass for anyone carrying a cookie. Both
    // halves are asserted below.
```

### scripts/verify-live.mjs:1232 (WHY, shortened)

populations kept; history moved.

```js
// TWO POPULATIONS, asserted separately, because the whole design turns on
  // treating them differently.
  //
  //   cookieless    shared-cached. SHOULD hit, and must render the default.
  //   cookie-bearing  never stored. Should BYPASS, and must render its own theme.
  //
  // These assertions are INVERTED from what this section first said. It used to
  // assert HTML is never served from cache, which was right while all HTML was
  // `private, no-store`. Half of it is now the opposite.
```

### scripts/verify-live.mjs:1242 (WHY, shortened)

trimmed.

```js
/*
     * MEASUREMENT (a): A COOKIELESS READER IS SERVED FROM CACHE. Ruling 18.
     *
     * Unchanged in intent from the version this replaces, and it is the one
     * assertion the whole arc had to not break: the readers who were fastest
     * before must not be slower after.
     *
     * The retry loop stays. An entry needs a couple of requests to settle and a
     * BYPASS proves nothing about caching, which was measured on the old layer
     * and is a property of the platform rather than of either design.
     */
```

### scripts/verify-live.mjs:1269 (WHY, shortened)

trimmed; inversion history moved.

```js
/*
     * MEASUREMENT (b): A COOKIED READER IS NOW CACHED TOO, AND THIS ASSERTION
     * IS THE INVERSE OF THE ONE IT REPLACES.
     *
     * What stood here: "a cookie-bearing request must never be served from, or
     * written to, the shared entry", asserting `dark.cf !== "HIT"`. That was
     * correct and load-bearing under `Vary: Cookie`, where the only variant the
     * platform could hold was the cookieless one and a cookied hit would have
     * meant one reader's theme reaching another.
     *
     * The theme is a dimension of the KEY now (rulings 11, 15), so a dark reader
     * and a light reader address different entries and a cookied HIT is the
     * feature rather than the defect. THE OLD ASSERTION WOULD NOW FAIL ON A
     * WORKING SITE, which is exactly why it is rewritten rather than left.
     *
     * FIRST READ MAY BE ANY STATUS, second must be a HIT: the first one is what
     * stores the entry, and this cookie has not been used on this URL in this
     * run.
     */
```

### scripts/verify-live.mjs:1312 (WHY, shortened)

trimmed.

```js
/*
     * AND THE WIRE HEADER IS STILL A REFUSAL. Ruling 16 kept the downgrade as
     * belt and braces and the split moved it to the gateway, which is what lets
     * the stored copy stay public while the copy a cookied reader receives says
     * `private, no-store`. Asserted on the HIT specifically: a downgrade that
     * only applied on a miss would be a downgrade that mostly did not happen.
     */
```

### scripts/verify-live.mjs:1329 (WHY, shortened)

owner kept.

```js
/*
     * MEASUREMENT (c) IS NOT HERE, deliberately. That light and dark differ only
     * by the theme attributes is `check:browser`'s, which owns `maskTheme` and
     * the enumeration under hard rule 8. Naming it here would be a second owner
     * of the one fact that licenses this key being as short as it is.
     */
```

### scripts/verify-live.mjs:1336 (WHY, shortened)

trimmed.

```js
/*
     * AND THE `Vary` IS GONE. The routes that negotiate keep `Accept`; nothing
     * on this site varies on Cookie any more, and a `Vary: Cookie` that came
     * back would fragment every entry on every unrelated cookie value, which is
     * the cost the arc exists to stop paying.
     */
```

### scripts/verify-live.mjs:1351 (HISTORY, deleted)

revert story.

```js
// CASE A, ASSERTED DIRECTLY. This exact ordering served a cached dark document
  // to a cookieless reader when the fix was `Vary: Cookie` alone, and it is the
  // reason that attempt was reverted. A fresh URL per run, so the result cannot
  // be an artifact of whatever happened to populate the cache first.
```

### scripts/verify-live.mjs:1366 (WHY, shortened)

intent kept; measurement moved.

```js
/* CASE B: A SECOND REPRESENTATION MUST NOT COLLAPSE THE COOKIE DIMENSION.
   *
   * The defect, measured 2026-08-05 with a paired control on fresh URLs. Both
   * `/search` and `/blog/:slug` set `Vary: Accept, Cookie`. With only the HTML
   * representation in play, a cookie-bearing request correctly BYPASSes. After
   * ONE request for the alternate representation, the same request got a `HIT`
   * and `public`: the edge answered from the stored cookieless variant, the
   * Worker never ran, the downgrade in `workers/app.ts` never fired, and a
   * `theme=dark` reader received the light document.
   *
   * Repair B: the alternate representations are `private, no-store`, so they
   * are never stored and cannot become that second variant.
   *
   * **BOTH routes, because the first write-up of this said `/search` was the
   * only one.** `/blog/:slug` carries the same two-header `Vary` and reproduced
   * it identically, which means every published post was exposed. A scope claim
   * that was wrong once is asserted here rather than trusted.
   *
   * PAIRED, control and test, so a pass cannot come from the route being
   * uncacheable for some unrelated reason: the control must still HIT
   * cookieless, which proves shared caching is alive on that URL.
   */
```

### scripts/verify-live.mjs:1414 (WHY, shortened)

trimmed.

```js
// CONTROL: HTML only. Establishes that this URL really is shared-cached,
      // so the test below is about the second representation and nothing else.
```

### scripts/verify-live.mjs:1432 (HISTORY, deleted)

restates the code.

```js
// TEST: the alternate representation FIRST, then the same sequence.
      // Run exactly as it was before the fix, so the only variable is the fix.
```

### scripts/verify-live.mjs:1464 (WHY, shortened)

trimmed.

```js
// BOTH ADVERTISED FORMS still reach the markdown twin. llms.txt documents
    // the path AND the Accept header, so dropping either is a broken published
    // contract. The path form's bytes are asserted in section 5; this is the
    // negotiated form, which nothing else covers.
```

### scripts/verify-live.mjs:1480 (HISTORY, deleted)

restates the check.

```js
// AND THE CACHE STILL WORKS WHERE IT IS MEANT TO. The fix above made HTML
  // uncacheable; it must not have disabled the cache it was enabled for. A
  // regression that turned caching off site-wide would satisfy every assertion
  // above and would be invisible without this one.
```

### scripts/verify-live.mjs:1484 (WHY, shortened)

prohibition kept; incident moved.

```js
/*
   * THE KEY IS DERIVED, NOT WRITTEN DOWN, and this cost a run to learn.
   *
   * It was the literal `og/ai-answer-layer-ask-mode-9933971b.png`. On
   * 2026-08-15 the ship window changed what `ogImageKey` hashes, every card key
   * moved, and `build:og --remote` pruned that object minutes after the deploy
   * that made it an orphan. This block then fetched a key nothing has served
   * since, got the Worker's 404, and reported `cf-cache-status BYPASS` and
   * `cache-control private, no-store`.
   *
   * BOTH FAILURES WERE TRUE AND BOTH POINTED AT THE WRONG SUBSYSTEM. Nothing
   * had happened to the cache; a 404 is uncacheable and private, which is
   * correct behaviour. The harness said "caching is broken" when the fact was
   * "this key is gone", and a diagnosis naming the wrong subsystem costs more
   * than a silent pass does.
   *
   * So the key now comes from `ogImageKey` over the artifact, the same function
   * the sync writes into D1 and `build:og` uploads under, and the first
   * assertion checks the response IS the picture before the other two say
   * anything about the cache.
   */
```

### scripts/verify-live.mjs:1531 (CONTRACT, shortened)

heading and parse rule kept; history moved.

```js
/* --- 14. Security headers, on the wire ---------------------------------- *
 *
 * Phase A, ratified 2026-08-06. `check:headers` asserts that `workers/app.ts`
 * DECLARES the ratified set; this asserts the set actually ARRIVES. Neither
 * replaces the other: the gate cannot see the wire, and this cannot run without
 * a deploy.
 *
 * **The expected values are PARSED out of `workers/app.ts`, not restated.**
 * That is deliberate. `check:headers` already binds the source to the
 * ratification in both directions, so parsing here closes the chain
 * ratification -> source -> wire without a third hand-maintained copy to go
 * stale. A literal list here would be exactly the mirror the gate family exists
 * to prevent.
 *
 * TWO SURFACES, and the second is not redundant. A 200 takes the mutable path;
 * `Response.redirect()` returns IMMUTABLE headers, so `/admin`'s 302 goes
 * through the rebuild branch instead. A helper called on only one exit would
 * leave every redirect on the site bare while a 200 looked perfect.
 */
```

### scripts/verify-live.mjs:1552 (WHY, shortened)

trimmed.

```js
// Comments first: the constant's docblock names headers and values while
  // explaining them, and the prose would parse before the code. One owner:
  // scripts/lib/strip-comments.mjs.
```

### scripts/verify-live.mjs:1564 (HISTORY, deleted)

restated by the assertion.

```js
// FAIL CLOSED. If the parse returns nothing every loop below is skipped and
  // this section would silently assert nothing at all.
```

### scripts/verify-live.mjs:1589 (WHY, shortened)

trimmed.

```js
/*
     * THE CACHE-CONTROL DEFAULT, ON THE WIRE, and this is the only place it is
     * observable.
     *
     * `/admin` exports no `headers` and its 302 carries no `Vary`, so it reaches
     * the `if (!headers.has("cache-control"))` branch in `workers/app.ts` and
     * nothing else. Every route in HTML_ROUTES above now sets the header itself,
     * so that section cannot see this. `check:headers` proves the source
     * declares the default; per hard rule 7 that is not the same claim as the
     * default arriving, and a deploy that never happened is invisible to it.
     *
     * It rides on the 302 for a second reason: `Response.redirect()` returns
     * IMMUTABLE headers, so this response is rebuilt on the catch branch. It is
     * the exit where a default applied on only one path would be missing.
     */
```

### scripts/verify-live.mjs:1618 (WHY, shortened)

trimmed; reversal history moved.

```js
/* --- the CSP, Phase B, ENFORCED -------------------------------------- *
   *
   * **THE STATIC-NONCE ASSERTION IS THE ONE THAT MATTERS HERE.** A nonce that
   * never changes renders every page correctly, reports nothing, and protects
   * nothing, because anyone who can read one page learns the value. It is the
   * failure mode that looks exactly like success, and the wire is the only
   * place it can be seen: `check:headers` can prove the source interpolates a
   * variable, not that the variable varies.
   *
   * **REVERSED 2026-08-19, and it was eight failures late.** This block read
   * `Content-Security-Policy-Report-Only` and required the enforcing header to
   * be ABSENT. Enforcement was ruled and shipped on 2026-08-17 in `20c27d6`;
   * `check:headers` flipped in the same commit and this harness did not. Every
   * one of its nonce assertions then read a header that no longer exists, so it
   * compared "" to "" and reported the site broken while the site was correct.
   *
   * The direction of the guard is preserved, not dropped: it used to refuse
   * enforcement so that enforcement could not arrive as a side effect of some
   * other edit, and it now refuses a REVERSION to Report-Only for the same
   * reason. A phase change should be a decision, in both directions.
   */
```

### scripts/verify-live.mjs:1670 (WHY, shortened)

trimmed; cache history moved.

```js
/*
     * TWO RESPONSES, BOTH ACTUALLY RENDERED, and the second half of that is
     * what this case had to learn the hard way.
     *
     * A cookie is sent DELIBERATELY. The public HTML routes are shared-cached
     * for cookieless readers, so two plain requests can both be served the SAME
     * cached response, header and body together, and their nonces would be
     * identical for a reason that has nothing to do with the generator.
     *
     * THE COOKIE USED TO BE ENOUGH AND STOPPED BEING ENOUGH, 2026-08-27, and
     * the same lesson landed twice. The note here first read "a cookie-bearing
     * request bypasses the cache and is rendered fresh", which was true of the
     * PLATFORM cache and became false the day `workers/app.ts` grew a themed
     * cache of its own. The repair was a cache-busting query per probe plus a
     * read-back of `x-theme-cache` to prove both were misses.
     *
     * THE MARKER IS GONE WITH THAT LAYER, 2026-09-05, and the cookie is now
     * enough for even less than it was: every reader is cacheable, so a cookie
     * buys no freshness at all. What survives is the half that never depended
     * on either, the CACHE-BUSTING QUERY: each probe is its own key, so each is
     * its own render whatever the cache does. `cf-cache-status` replaces the
     * marker as the read-back, and it is the platform's own header rather than
     * one this Worker sets, which is a strictly better instrument.
     *
     * An assertion about two generations still fails if it was handed fewer
     * than two.
     */
```

### scripts/verify-live.mjs:1723 (HISTORY, deleted)

incident.

```js
// And it must be the nonce the DOCUMENT actually used. Under Report-Only a
    // mismatch was a report nobody read; under enforcement it is every script on
    // the page refusing to run, which is exactly what happened to the editor.
```

### scripts/verify-live.mjs:1733 (WHY, shortened)

trimmed; measurement and dates moved.

```js
/*
     * THE SOLE ENFORCEMENT BLOCKER, PINNED. This is the other half of the
     * assertion above and nothing committed measured it until 2026-08-09.
     *
     * The block above proves the GENERATOR is per-request, and it has to send a
     * cookie to do that. On the six shared-cached routes the cache then collapses
     * it: the header and the body are stored together, so every cookieless
     * reader gets ONE nonce for up to ten minutes. Measured that day: 4 HITs, 1
     * distinct nonce, against 4 distinct across 4 BYPASS responses.
     *
     * **THIS ASSERTS THE TENSION STILL EXISTS, which means it goes RED when
     * somebody FIXES it.** That is deliberate: the window was ACCEPTED in
     * writing on 2026-08-17 (option A, and it is on the colophon), so it is a
     * standing condition rather than an outstanding bug, and a change to it
     * should be a decision rather than a drift.
     *
     * It could not observe any of that between 2026-08-17 and 2026-08-19,
     * because it read the Report-Only header and enforcement had removed it, so
     * both sides of the comparison were "". It failed rather than passing
     * vacuously, which is the one thing that went right, but a failing
     * assertion that cannot see its subject is not evidence either way.
     *
     * It only runs on a genuine HIT. A cold or bypassed edge says nothing about
     * shared-cache behaviour, and asserting into that would be a check that
     * passes for the wrong reason.
     */
```

### scripts/verify-live.mjs:1788 (CONTRACT, shortened)

heading and gap kept; measurement moved.

```js
/* --- 15. The draft preview route, on the wire --------------------------- *
 *
 * ONE HALF OF THIS FEATURE IS WIRE-ASSERTABLE AND THE OTHER IS NOT. Stating the
 * gap is the point of this comment, and papering it would be worse than leaving
 * it open.
 *
 * WHAT IS ASSERTED: a well-formed token that was never minted returns the boring
 * 404, and that response is `private, no-store`. That covers the failure path,
 * which is the path every stranger who guesses a URL takes, and it covers the
 * cache header on the response a shared cache would most cheaply store.
 *
 * WHAT IS NOT, AND CANNOT BE FROM HERE: the SUCCESS path. Reaching a 200 needs a
 * live token, and minting one means either a signed-in admin session, which this
 * harness does not have and must not carry, or writing directly into production
 * KV, which would be this harness creating a capability against the live site to
 * check that capabilities work. Neither is acceptable, so the 200 is verified on
 * a local dev server against local KV and local D1, and NOT here.
 *
 * The consequence, stated plainly: **`verify-live` cannot see the preview
 * route's own `headers()` at all.** The 404 below is thrown from the loader, so
 * React Router renders the error boundary and the route's headers export never
 * runs; the `private, no-store` this asserts is the Worker's fail-closed default
 * from `workers/app.ts`, which is a different mechanism reaching the same value.
 * MEASURED on a dev server 2026-08-15, not assumed. `check:headers` reads the
 * route's declaration in source and this reads the wire, and on this route
 * neither one is observing what the other does.
 */
```

### scripts/verify-live.mjs:1819 (WHY, shortened)

trimmed.

```js
// A well-formed token from the right alphabet and the right length, and one
  // nobody minted. It has to be well formed: a malformed one is refused on
  // shape before anything is looked up, so it would prove only that the regex
  // runs, not that an unknown token is refused.
```

### scripts/verify-live.mjs:1839 (HISTORY, deleted)

restated by the needle.

```js
// Delimited by the element boundaries the error boundary renders it inside,
    // so a match cannot come from prose elsewhere on the document.
```

### scripts/verify-live.mjs:1857 (HISTORY, deleted)

restated by the message.

```js
// robots.txt, which is hygiene rather than the control, asserted because it
  // was ratified and because a line nobody checks is a line that gets dropped.
```

### scripts/verify-live.mjs:1860 (CONTRACT, shortened)

SCOPED-BY rationale trimmed.

```js
/*
   * SCOPED-BY the newlines around the directive. robots.txt has no elements to
   * delimit with, so the `>needle<` form has nothing to bite on; a whole line
   * bounded by newlines is the equivalent delimitation in a line-oriented
   * document, and it is what stops `Disallow: /preview` matching inside a
   * longer path such as `Disallow: /preview-of-something`.
   */
```

### scripts/verify-live.mjs:1882 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 16. The public script set on the wire is the enhancements alone ---- */
```

### scripts/verify-live.mjs:1884 (WHY, shortened)

trimmed; dates moved.

```js
/*
 * The offline half, check:page-payload, proves the BUILD's shape: the
 * bundles are served verbatim and hydration is opt-in in source. This is the
 * wire half, and since the public plane stopped hydrating (2026-08-26) the
 * claim inverted: the deployed post page must reference the enhancement
 * bundles and NOTHING else. No framework chunks, no modulepreloads at all:
 * a modulepreload reappearing means <Scripts> is back on a public page.
 *
 * The expected stems are the app/enhance/ module basenames (a ?url asset is
 * dist/<name>.js emitted as <name>-<hash>.js), derived from the SOURCE
 * listing rather than the build so a standalone run does not need a fresh
 * build on this disk. Compared by STEM (chunkStem, imported from the gate so
 * the two halves share one definition): same bundles under different hashes
 * is a stale-disk observation; a foreign stem is the defect.
 *
 * The post page is the subject because it carries the largest set (palette,
 * theme, blog); Ask's bundle rides on /search and is covered by the Ask
 * probes' own surface.
 */
```

### scripts/verify-live.mjs:1926 (WHY, shortened)

trimmed.

```js
// Scope, proven non-empty before the comparison is read: a page shape
  // change that removed every match would otherwise agree with any walk.
```

### scripts/verify-live.mjs:1947 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 17. A post image on the wire is a link to its original ------------- */
```

### scripts/verify-live.mjs:1949 (WHY, shortened)

trimmed; measurement moved.

```js
/*
 * The deployed half of the image-link fallback. `check:browser` drives the
 * same claim against a preview build; this asks the DEPLOYED origin, which is
 * the only instrument that can see a href whose target the live bucket does
 * not actually hold.
 *
 * TWO ASSERTIONS, and the second is the one worth the round trip. That the
 * markup carries `class="image-link"` is a build fact the offline gates
 * already cover. That the URL inside it ANSWERS 200 WITH AN IMAGE is a fact
 * about R2 and the transform route on this deployment, and a fallback that
 * 404s is worse than the bare image it replaced.
 *
 * The post is FOUND, never named: a slug pinned here goes stale the day the
 * post is retitled, and which post carries a picture is the corpus's business.
 *
 * WHEN THE CORPUS CARRIES NO IMAGE this REPORTS and does not fail. Measured
 * 2026-08-26: zero body images across the 12 posts, so there is nothing on the
 * wire to look at, and that is a content fact rather than a regression. It is
 * printed rather than silent for the reason every skip in this repo is: an
 * unobserved claim and a satisfied one must not look the same from outside.
 */
```

### scripts/verify-live.mjs:1989 (HISTORY, deleted)

restates the regex.

```js
// The anchor and its image together. The class alone would match a stylesheet
    // reference or a stray attribute; this is the pair the fallback consists of.
```

### scripts/verify-live.mjs:2009 (WHY, shortened)

trimmed.

```js
// Anchored: `?w=` in the href is exactly the defect this replaces, so a
      // "contains the key" test would agree with the bug.
```

### scripts/verify-live.mjs:2023 (CONTRACT, shortened)

section heading shortened.

```js
/* --- 17. The watchdog is firing, read off the home page's health tile --- */
```

### scripts/verify-live.mjs:2025 (WHY, shortened)

mechanism and window kept; essay moved.

```js
/*
 * THE WATCHDOG HAS NO WIRE SURFACE OF ITS OWN, so this reads its SIDE EFFECT.
 *
 * `workers/watchdog.ts` exports `scheduled` and nothing else, and its config
 * sets `workers_dev: false`, so there is no URL to probe and no response to
 * assert on. What it does have is a footprint: every firing calls
 * `/api/health`, and that endpoint rewrites the KV snapshot on the way out, for
 * both verdicts. The home page renders that snapshot's AGE into
 * `data-health-age`. So the tile's freshness IS the watchdog's liveness, which
 * is stated in both docblocks and is the reason this assertion can exist at all.
 *
 * ## WHAT THIS PROVES, AND THE WINDOW IN WHICH IT PROVES LESS
 *
 * Under two poll intervals is the bound. A watchdog that has stopped drifts
 * past it within half an hour and the front page says so before this does.
 *
 * **BUT `/api/health` HAS OTHER CALLERS, AND ONE OF THEM IS `ship`.** Ship's
 * readiness step reads that endpoint between the deploy and the sync, which
 * writes the snapshot. So for THIRTY MINUTES after a ship this assertion is
 * satisfied by ship's own call and proves nothing about the watchdog. The same
 * is true after any manual poll and after an hourly `health.yml` run.
 *
 * That window is stated rather than engineered away, because the honest fix is
 * expensive and the honest statement is not: proving the watchdog specifically
 * means watching the timestamp ADVANCE while nothing calls the endpoint, which
 * costs a wait of up to one full interval and does not belong inside a gate
 * anybody runs. It is done once, by hand, when the watchdog's schedule changes,
 * and the reading goes in the commit message. Outside that window, on every
 * routine run, this assertion is a real one: nothing else polls often enough to
 * keep the snapshot under thirty minutes old.
 *
 * ## THE PAGE MUST BE RENDERED FRESH
 *
 * `/` is `public, s-maxage=600` and the Worker keeps its own themed entry, so a
 * cached copy carries the age it had when it was rendered, which is a frozen
 * number that ages backwards relative to reality. A unique query string forces
 * a MISS, the same instrument ship's poll uses and for the same reason.
 */
```

### scripts/verify-live.mjs:2068 (WHY, shortened)

trimmed.

```js
/*
   * SCOPE FIRST. A page that carries no tile at all makes every comparison
   * below vacuous, and it is a real failure state rather than a harness
   * problem: `missing` is what the tile renders when the snapshot was never
   * written or KV could not be read.
   */
```

### scripts/verify-live.mjs:2091 (WHY, shortened)

trimmed.

```js
/*
   * TWO INTERVALS, not one. One would flap on a single late firing, which a
   * Cron Trigger is still permitted to be; three is the tile's own staleness
   * threshold and would only fail once the front page had already started
   * telling readers the check had stopped. Two fails BEFORE the page lies,
   * which is the point of asserting it here rather than reading the tile.
   */
```

### scripts/verify-live.mjs:2115 (CONTRACT, shortened)

section heading shortened.

```js
/* --- Report ------------------------------------------------------------ */
```

### scripts/verify-live.mjs:2119 (WHY, shortened)

floor rule kept; measurement history moved.

```js
/*
 * THE FLOOR. Same fail-closed shape as MINIMUM_GATES in check-all.mjs.
 *
 * This harness had NO floor on its own pass count until 2026-08-11, so most of
 * its assertions could have stopped executing and the run would still report
 * "0 failed" and exit 0. Whole sections sit inside `if` blocks and loops over
 * fetched data: a route that starts 404ing, an empty corpus, or an early return
 * skips its assertions silently, and a shrinking pass count at zero failures is
 * exactly what that looks like from outside.
 *
 * MEASURED THROUGH A REAL RUN, 2026-08-11: 206 executed, 0 failed, against a
 * 12 post corpus and 40 assets.
 *
 * The first value committed was 90, and it was WRONG in the way this whole
 * session is about. It was derived by counting 99 static `check()` call sites
 * in the source and taking a slack ten percent, without ever running the thing.
 * But the static sites are not the assertions: most sit inside loops over the
 * corpus, the assets and the colophon's seven sections, so the real count is
 * 206. A floor of 90 would have let 116 assertions, more than half of them,
 * vanish in silence while the floor reported itself satisfied.
 *
 * That is the same defect as a threshold set outside its input's reachable
 * range, which is the class check:assertions rule (c) is honest about not being
 * able to see, and it survived review of the commit that introduced it. Measure
 * anti-vacuity floors THROUGH the pipeline they guard, not off the source.
 *
 * 180 leaves 26 for legitimate downward variance: the Ask rate limit SKIPS
 * probes rather than failing them, and several loops take their arity from the
 * corpus. It is a FLOOR, not a target, and it only ever moves on a deliberate
 * edit in the same commit as the change that moves it.
 *
 * TWO data points now, and they agree exactly:
 *
 *   2026-08-11, version c4a9c9db   206 passed, 0 failed
 *   2026-08-11, version d4fee64b   206 passed, 0 failed
 *
 * The first was taken against a 12 post corpus and 40 assets, the second after
 * six gate repairs, and both read 206 with the Ask probes unthrottled. The
 * variance this comment worried about did not appear, so 180 stays rather than
 * being tightened on two identical readings: the downward variance it exists to
 * absorb is the RATE-LIMITED run, and neither measurement was one. A third
 * reading taken while Ask is throttled is what would justify moving it.
 *
 * **MOVED TO 201 ON 2026-08-15, AND THE REFUSAL THAT PRECEDED IT WAS RIGHT.**
 *
 * The build session added section 15 and deliberately left this at 180, writing
 * down that seven new static sites SHOULD read 213 but that 213 was arithmetic
 * rather than a measurement. Ship window 4 ran it:
 *
 *   2026-08-15, version 2bf564fa   214 passed, 0 failed
 *
 * **214, not 213.** The arithmetic was wrong, and it was wrong for the dullest
 * possible reason: it added seven to 206, the figure carried in this comment,
 * while the last clean run before it read 207. A floor committed from that sum
 * would have been one low and nobody would ever have found out, because a floor
 * that is slightly too loose has no symptom. That is the whole argument for
 * measuring, reproduced in miniature on the one file that already documents
 * having made the same mistake at 90 against 206.
 *
 * Floored at 201, which is 94 percent of 214. The 13 of slack absorbs the
 * RATE-LIMITED run, where Ask probes are skipped rather than failed, which
 * remains the only downward variance ever hypothesised here and still has never
 * been observed.
 *
 * **RE-MEASURED 2026-08-29, BY RUNNING IT, at version 7465d07b: 257 passed, 0
 * failed**, unthrottled, with 1 of 1 draft Ask probes taken. Section 17, the
 * watchdog's freshness read, contributed four of those; the rest of the growth
 * from 214 is other work since 2026-08-15.
 *
 * Floor 201 to 241, which is 94 percent of 257, holding the same proportion the
 * two readings above set. **Leaving it at 201 was the tempting option and it is
 * the wrong one**: a floor 56 under the real count lets more than a fifth of the
 * assertions stop executing while the floor reports itself satisfied, which is
 * this comment's own opening complaint about the 90-against-206 draft.
 */
```

### scripts/verify-live.mjs:2198 (WHY, shortened)

trimmed; draft story moved.

```js
/*
 * THE FAILURE LIST PRINTS FIRST, and the floor never short-circuits it.
 *
 * A first draft exited on the floor before reaching this block, so a run that
 * was both short AND failing would report the count and swallow every failing
 * assertion's NAME: the diagnostics thrown away by the very check that exists
 * to make a short run diagnosable. Both conditions are reported, then one exit.
 */
```

## app/routes/admin.media._index.tsx

### app/routes/admin.media._index.tsx:79 (CONTRACT, shortened)

module purpose and no-script fallback kept; v1 redesign narrative moved.

```tsx
/**
 * The media library. Search, browse, copy an address, and manage one asset.
 *
 * The page composes three things that stay separate underneath: the media core
 * (what is in the bucket), the media table (what we know about the image), and
 * the resolver seam (who cites it). Nothing here scans content itself.
 *
 * ## WHAT THE v1 REDESIGN CHANGED, AND WHY
 *
 * SEARCH IS THE PRIMARY CONTROL and the chips are secondary. The page led with
 * six chips and no search box, which is a filing cabinet with no index: it can
 * narrow to a group of twenty and cannot answer "the microscope one". The form
 * is a native GET borrowing the posts list pattern verbatim, so the state is the
 * URL, the back button restores it, and nothing needs script. It filters IN SQL,
 * unlike the posts list, because this page paginates: see `matchesQuery`.
 *
 * THE TILE LOST ITS FORMS AND THE PAGE GAINED A DETAIL VIEW. Every tile carried
 * an alt disclosure and a delete button, which is what made the cards 330px tall
 * and three to a row. Editing alt and deleting are per-asset work, so they moved
 * to `?key=`, and the grid became a grid.
 *
 * COPYING IS THE PAGE'S ONE JOB, so it is one visible button per tile. The old
 * subtitle told the reader to "copy the filename into a post" beside tiles that
 * offered no copy control and showed the ORIGINAL NAME rather than the address a
 * post actually needs. The button emits `object.url`, which is `/media/<key>`
 * for R2 rows and the path itself for static ones.
 *
 * REBUILD MOVED INTO THE MAINTENANCE MENU, the grammar the posts list already
 * ships, and its submission is untouched: same method, same `intent=rebuild`,
 * same empty field set. That identity is what `check:admin-ui` reads, and it is
 * the evidence that the move is presentation.
 *
 * ## THE ONE THING THAT NEEDS SCRIPT, AND ITS FALLBACK
 *
 * The clipboard has no no-script equivalent, and the admin plane is exempt from
 * the progressive enhancement law anyway. The fallback is still cheap and is
 * built rather than skipped: the filename on every tile is a link to the detail
 * view, which renders the same address in a readonly input that selects and
 * copies by hand. So a reader without script loses one click and never meets a
 * dead control.
 */
```

### app/routes/admin.media._index.tsx:125 (CONTRACT, shortened)

vocabulary kept; deleted-array story moved.

```tsx
/**
 * THE filter vocabulary. One list, and now genuinely the only one.
 *
 * A `FILTERS` array sat above this carrying the same four ids plus a label and
 * a hint for each, and its own docblock claimed to be the single place the
 * vocabulary lives. It was read by nothing: not by the chips, not by the URL
 * parse, not by any other file. This set is what both call sites below use.
 *
 * The labels and hints went with it because they were rendered nowhere, and the
 * usage caveat its comment carried is stated where usage is actually computed.
 * Deleted 2026-08-24 under rule 17: a comment is a claim, not an owner.
 *
 * `?role=` values are the role column verbatim.
 */
```

### app/routes/admin.media._index.tsx:141 (WHY, shortened)

cap reason kept, trimmed.

```tsx
/**
 * How many rows the command palette returns.
 *
 * SIX, the mockup's own cap, and a real constraint rather than a round number: a
 * dropdown under a search bar has about six rows before the highlighted one can
 * leave the viewport, and a list the arrow keys cannot walk is a list with no
 * keyboard navigation. The count line says "6+" when there are more, so the cap
 * never reads as the whole answer.
 */
```

### app/routes/admin.media._index.tsx:152 (WHY, shortened)

evidence mechanism kept; plant story moved.

```tsx
/**
 * THE KEYBOARD SHORTCUTS, as data, so the popover cannot document one that does
 * not exist.
 *
 * The previous ruling on this page was that an absent shortcut must not be
 * advertised, which is why the Cmd+K badge was held back for a whole session
 * after the mockup drew it. The same rule applies to this list: every row here
 * is wired, the two global ones in `MediaPalette` and the rest in
 * `MediaKeyboard`, and `check:admin-ui` asserts the rendered panel and this
 * table name the same set.
 *
 * WRITTEN IN WORDS, not glyphs. The mockup uses the arrow, return and delete
 * SYMBOLS, which a screen reader reads as punctuation or skips entirely, and
 * which several fonts render as tofu. A `<kbd>` saying "shift enter" is legible
 * to everything.
 *
 * **`evidence` NAMES THE SOURCE TOKEN THAT IMPLEMENTS THE BINDING, and it is
 * there because a plant proved the first version of this gate was a tautology.**
 * Adding a fake row ("ctrl D, delete everything instantly") left check:admin-ui
 * green: it compared the number of rows DECLARED against the number RENDERED,
 * and a fake row increments both. It could only ever catch the panel failing to
 * render, which is not what the rule is about.
 *
 * The rule is that this page must not advertise a shortcut nobody wired, which
 * is why the Cmd+K badge was held back for an entire session. So each row now
 * points at the expression in `media-palette.tsx` or `media-keyboard.tsx` that
 * handles it, and the gate greps for it. A fake row has no expression to name.
 */
```

### app/routes/admin.media._index.tsx:196 (WHY, shortened)

trimmed.

```tsx
/**
 * THE QUALITY LENSES, with the sentence each one is asking.
 *
 * The hints are the mockup's own framing carried over: a lens is a question,
 * and the answer needs a caveat more often than not. `unattached` gets the
 * longest one because it is the lens most likely to be read as permission to
 * delete, and the mockup says so in as many words.
 */
```

### app/routes/admin.media._index.tsx:222 (WHY, shortened)

build-time import reason kept, trimmed.

```tsx
/**
 * WHICH ASSETS THE REPOSITORY ITSELF PLACES, read once at module scope.
 *
 * A BUILD-TIME IMPORT, exactly as the colophon reads `stack.json`, and the only
 * shape that works: the scan needs a filesystem, and neither a request nor
 * `rebuildMediaIndex` has one, because both run inside the Worker. The artifact
 * ships in the bundle, so the answer cannot drift from the code that produced
 * it, and `check:content` byte-compares it against a fresh scan in the offline
 * tier and again inside ship.
 *
 * `TEMPLATE_REF_KEYS` is the SQL side of it: the `unattached` lens has to
 * exclude these rows, and it excludes them in the query rather than after the
 * read so pagination and the chip count stay honest.
 */
```

### app/routes/admin.media._index.tsx:241 (CONTRACT, shortened)

trimmed.

```tsx
/*
   * INSTRUMENTATION, OFF BY DEFAULT. The collector is created by the /admin
   * middleware on `?timing=1` and already holds the auth marks by the time this
   * runs, so the header this loader emits accounts for the WHOLE request rather
   * than for the part one file can see.
   *
   * Undefined on every other request, and every `timed` call below then
   * degrades to a plain call.
   */
```

### app/routes/admin.media._index.tsx:255 (WHY, shortened)

trimmed.

```tsx
// The picker asks for a flatter, bigger payload from this same loader, which
  // is what makes it the same listing rather than a second one.
```

### app/routes/admin.media._index.tsx:259 (WHY, shortened)

one-definition reason kept; alternatives discussion moved.

```tsx
/*
   * THE COMMAND PALETTE, ON THIS LOADER, for the reason the picker is.
   *
   * It could have been a route of its own, or the client could have filtered a
   * copy of the library shipped into the page. Both are second answers to "what
   * matches this query", and this page has already paid for a second answer
   * once: the Unused chip counted with one predicate and filtered with another.
   *
   * Reaching the SAME `matchesQuery` in SQL means the palette and the plain GET
   * form cannot disagree about what a query matches, which matters because the
   * form is what the palette degrades to. Shipping the corpus to the browser
   * would also stop being viable at exactly the size where search starts to
   * matter, and this page paginates precisely because that size is coming.
   */
```

### app/routes/admin.media._index.tsx:275 (WHY, shortened)

trimmed.

```tsx
// DEFAULT TO CONTENT, which is the whole ordering fix stated as a default.
  // An empty `?role=` is not "no filter", it is the absence of the parameter;
  // `?role=all` is how the reader asks for everything. Anything unrecognised
  // falls back to the default rather than erroring, because a bad URL should
  // show a library rather than a stack trace.
```

### app/routes/admin.media._index.tsx:280 (WHY, shortened)

structural reason kept; incident moved.

```tsx
/*
   * THE WHOLE VIEW STATE, PARSED ONCE, by the module that also builds every
   * link on the page.
   *
   * The parameters used to be read here one at a time and rebuilt in the
   * component one at a time, which is how `q` fell off the pagination links and
   * `role` fell off the chips. One parse and one `hrefWith` is the repair, and
   * it is structural: a link that drops a parameter now has to be written by
   * NOT calling the only function that builds links.
   */
```

### app/routes/admin.media._index.tsx:304 (WHY, shortened)

trimmed.

```tsx
// The reader's Display choices, straight through. The picker branch below
    // ignores them, because the picker is a fixed insertion surface rather than
    // a view somebody configured.
```

### app/routes/admin.media._index.tsx:315 (WHY, shortened)

trimmed.

```tsx
// The unattached lens means "no post cites it AND no repository code
          // references it". Applied in SQL, so a page of 24 is 24 genuinely
          // unattached rows rather than 24 minus however many the roster places.
```

### app/routes/admin.media._index.tsx:320 (WHY, shortened)

prohibition kept, trimmed.

```tsx
// THE PICKER FILTER, applied in SQL rather than in the map below, so an
    // excluded row never crosses the wire. An OG card is 1200x630 of branded
    // chrome built for a social feed; inserting one into a post body would be
    // nonsense, so `r2-derived` is excluded outright. Documents go too: this
    // picker inserts images.
    //
    // Unconditional, and deliberately NOT merged with the `role` filter below:
    // the picker's rule is a constraint on what may be inserted, not a view the
    // reader chose, so a `?role=` in the URL must not be able to widen it.
```

### app/routes/admin.media._index.tsx:333 (WHY, shortened)

trimmed.

```tsx
// THE ROLE FILTER IS SUSPENDED IN THE TRASH VIEW. The bin holds
          // whatever was thrown away, and narrowing it by role would hide rows
          // an author is looking for from a view whose whole job is to find
          // them again.
```

### app/routes/admin.media._index.tsx:357 (WHY, shortened)

restated cap moved; exclusion reason kept.

```tsx
/*
   * THE PALETTE PAYLOAD: small, flat, and capped.
   *
   * SIX, which is the mockup's own cap and a real constraint rather than a
   * round number: the dropdown sits under a search bar with a viewport beneath
   * it, and a list long enough to scroll is a list the arrow keys cannot walk
   * without the highlighted row leaving the screen. `hasMore` is reported so the
   * count can say "6+ matches" rather than claiming six is all there is.
   *
   * NO usage, NO citations, NO twins. Those cost three more queries per
   * keystroke and answer nothing a reader picking a file needs; the palette
   * exists to find an address, and the inspector is one keystroke away for the
   * rest.
   */
```

### app/routes/admin.media._index.tsx:386 (WHY, shortened)

two-source union reason kept, trimmed.

```tsx
// Usage, asked BOTH ways, and a refusal needs only one of them to object.
  //
  // `media_refs` is written by the pipeline at render time, so it is precise:
  // it records what the renderer actually emitted. The resolver scans the
  // posts' markdown out of D1 for the literal URL, so it is a conservative
  // SUPERSET: it will count a mention inside a code fence that the renderer
  // never turned into a link. Neither subsumes the other, and for a delete
  // decision the union is what fails closed.
  // NAMED PER LEG AS WELL AS AS A GROUP. The group time is the wall clock the
  // request actually pays; the legs are what says which one is the long pole.
  // Reporting only the group would leave the next session unable to tell three
  // fast queries from one slow one hiding behind two.
```

### app/routes/admin.media._index.tsx:398 (WHY, shortened)

placement prohibition kept; serial-await story moved.

```tsx
/*
   * SIX CALLS, ONE WALL CLOCK. The three counts below used to be `await`s
   * inside the returned object literal, which evaluates its properties in
   * order, so they ran three round trips deep AFTER this group had finished:
   * five sequential steps where two would do.
   *
   * None of them depends on `keys`, or on each other, or on anything this
   * group produces. They were serial because of where the lines sat, which is
   * the same defect the admin layout loader had.
   *
   * **They join THIS group rather than starting at the top of the loader**, and
   * that is deliberate. The picker and palette branches return before this
   * point; a promise created above them would be created on paths that never
   * await it, which is a wasted query on the picker path and an unhandled
   * rejection waiting to happen on any of them.
   *
   * Named per leg as well as as a group, so the next reading says which of the
   * six is the long pole rather than only how long the slowest was.
   */
```

### app/routes/admin.media._index.tsx:424 (WHY, shortened)

trimmed.

```tsx
// Exact content identity only. See `mediaTwins` for why nothing perceptual
        // is coming.
```

### app/routes/admin.media._index.tsx:433 (WHY, shortened)

unasserted row count moved.

```tsx
/*
   * THE DETAIL VIEW, as a parameter on this page rather than a route of its own.
   *
   * `/admin/media/:key` cannot carry these keys: 58 of the rows are static and
   * their key IS a path beginning with `/`, so it is not one path segment. A
   * parameter also keeps the picker, the listing and the detail on one loader,
   * which is the property the picker was built on.
   *
   * READ BY KEY, not found in `objects`. The detail is reachable by URL, so the
   * row it names may be on any page or on none, and picking it out of the
   * current page would make a bookmarked link work only from the page it was
   * copied on.
   */
```

### app/routes/admin.media._index.tsx:486 (CONTRACT, shortened)

regex replacement story moved.

```tsx
/**
         * The CONTENT HASH, read off the key and never recomputed.
         *
         * Keys are content-addressed, so the hash is already in the filename. A
         * static row's key is a path rather than a hash, so it has none and the
         * inspector says nothing rather than showing a truncated path as if it
         * were a digest. Read through the grammar's one extracting reader: the
         * local regex this replaces could not see the dimension segment, so
         * every uploaded raster showed no hash here.
         */
```

### app/routes/admin.media._index.tsx:507 (WHY, shortened)

trimmed.

```tsx
/**
         * SUGGESTED ALT TEXT, computed here and never applied.
         *
         * The loader offers it; a button accepts it. Writing it automatically
         * would fill the corpus with alt text nobody read, which is worse than
         * an empty field because an empty field is visibly a defect and a
         * filename dressed as a description is not.
         */
```

### app/routes/admin.media._index.tsx:526 (WHY, shortened)

trimmed.

```tsx
/*
   * THE UPLOAD FLASH, read off the URL the upload route redirected to.
   *
   * The code becomes a sentence HERE rather than in the component, on this
   * file's standing rule: the component stays free of anything but its loader
   * data, which is what `check:admin-ui` renders it with.
   */
```

### app/routes/admin.media._index.tsx:536 (WHY, shortened)

unasserted corpus numbers moved.

```tsx
/*
   * THE DUPLICATES LENS IS APPLIED HERE, after the read, and deliberately.
   *
   * Exact content identity is read off the content-addressed key by
   * `mediaTwins`, in JS. Approximating it in SQL to keep the filter uniform
   * with the other three lenses would be a SECOND definition of twin, and this
   * table has already been bitten once by two definitions of one join rule.
   *
   * The cost, stated: this filters the page AFTER pagination, so a duplicates
   * page can hold fewer rows than the page size. At 70 rows and 0 twins that is
   * invisible; it is the first thing to fix if the corpus grows.
   */
```

### app/routes/admin.media._index.tsx:559 (WHY, shortened)

trimmed.

```tsx
/**
       * Decided HERE, not in the component.
       *
       * `core.server` is stubbed when `check:admin-ui` renders these routes, and
       * the stub is a Proxy with no own keys, so a named export that a component
       * CALLS comes back undefined and the render throws. Nothing had called one
       * before, only referenced them from loaders. Keeping the decision in the
       * loader keeps the component free of server imports, which is what the
       * harness assumes and what the split is for anyway.
       */
```

### app/routes/admin.media._index.tsx:577 (WHY, shortened)

trimmed.

```tsx
/**
       * THE THIRD STATE, decided in the loader from three pieces of evidence.
       *
       * Two of them are per-post and already here; the third is the repository
       * scan. `usageStateOf` owns the precedence so the tile, the row, the lens
       * and the inspector cannot each decide it slightly differently, which is
       * how a page ends up saying "unattached" in one place and "used" in
       * another about one file.
       */
```

### app/routes/admin.media._index.tsx:591 (WHY, shortened)

unasserted count and mockup story moved.

```tsx
/**
       * WHICH SOURCE FILES PLACE IT. Empty for everything but the seventeen the
       * scan found. The inspector prints these rather than the mockup's prose
       * labels ("Phage Hunters roster, page template"), because those were
       * authored strings in a fixture and a repo-relative path is a fact the
       * reader can open.
       */
```

### app/routes/admin.media._index.tsx:612 (WHY, shortened)

trimmed.

```tsx
/**
     * THE VIEW STATE, echoed whole so the component can build links from it.
     *
     * Not spread into the payload as loose fields: the component calls
     * `hrefWith(view, {one: override})`, and handing it the object is what makes
     * that the easy thing to do.
     */
```

### app/routes/admin.media._index.tsx:624 (CONTRACT, shortened)

trimmed.

```tsx
/**
     * Tags in use, with counts, for the filter chips.
     *
     * From `mediaTagCounts`, which excludes trashed rows, so a tag carried only
     * by binned assets does not offer a chip leading to an empty grid.
     */
```

### app/routes/admin.media._index.tsx:632 (WHY, shortened)

trimmed.

```tsx
/**
     * THE LENS COUNTS, one query, sharing the filters' own predicates.
     *
     * `duplicates` is added HERE from `mediaTwins` rather than in SQL, because
     * exact content identity is read off the content-addressed key in JS and a
     * SQL approximation would be a second definition of twin.
     */
```

### app/routes/admin.media._index.tsx:640 (WHY, shortened)

incident moved.

```tsx
// THE SAME LIST THE LISTING GOT. The chip and the grid disagreeing is the
      // exact defect the Unused chip shipped with, and passing one array to both
      // readers is what makes agreement structural rather than remembered.
```

### app/routes/admin.media._index.tsx:647 (HISTORY, deleted)

removed-chip narrative.

```tsx
/**
     * THE UNUSED CHIP IS GONE, and the honest sentence it stood for is not.
     *
     * It read "70 of 70" against a corpus with zero image references, so it
     * filtered nothing, narrowed nothing, and alarmed. A permanent alarm is not
     * a signal. What was TRUE about it survives as `usageNote` below, because
     * the limitation is real and dropping the chip must not drop the caveat:
     * usage here means "the renderer emitted a citation", so an asset a route
     * references in CODE reads as uncited by this definition and by no other one
     * available. The nine roster photos are exactly that case.
     */
```

### app/routes/admin.media._index.tsx:658 (WHY, shortened)

limitation kept; rewrite story moved.

```tsx
/*
     * THE STANDING USAGE NOTE, REWRITTEN, because the old one became false in
     * this commit.
     *
     * It said: "An asset referenced only by route code, like the roster photos,
     * has no citation here and is not therefore unused." Every word of that was
     * true while the page had two states, and it was the honest confession of a
     * tracker that could not see route code. The repository scan can, so the
     * roster photographs now read "in template" and the sentence describes a
     * limitation that no longer exists.
     *
     * What survives is the limitation that DOES still exist, and it is a
     * narrower and more useful one: the scan matches literal paths, so a path
     * the code builds at runtime is invisible to it, and nothing here can see an
     * external site linking a file. That is why the third state is called
     * unattached and not unused.
     */
```

### app/routes/admin.media._index.tsx:682 (WHY, shortened)

trimmed.

```tsx
/*
   * SERIALIZATION IS NOT MEASURED HERE, and saying so is the point.
   *
   * What the framework does after this returns is a turbo-stream encode, not a
   * `JSON.stringify`, so timing a stringify of the same object would produce a
   * number that looks like serialization and is not. `payload_build` below is
   * the honest measurement available from inside a loader: everything from the
   * first query to the assembled object.
   *
   * The two costs this instrument still cannot see are the framework's encode
   * and React's render. Both are derivable without touching entry.server.tsx:
   * request the same route as a document and as a `.data` request, and the
   * difference between their totals, with loader_total identical, is the render.
   */
```

### app/routes/admin.media._index.tsx:698 (WHY, shortened)

trimmed.

```tsx
// No header at all unless it was asked for, so the default response is
  // byte-identical to what it was before any of this instrumentation existed.
```

### app/routes/admin.media._index.tsx:708 (WHY, shortened)

trimmed.

```tsx
/*
   * TAGS. Written through `setMediaTags`, which owns the storage form.
   *
   * The action does NOT serialise: it hands over what the human typed and the
   * db function decides what is stored. A route that pre-serialised would be a
   * second author of the delimiter rule, which is the defect that rule exists
   * to prevent.
   *
   * Not gated by `isManagedKey`, unlike alt. A static asset has a row and can
   * legitimately carry organisational labels; what `isManagedKey` protects is
   * WRITING TO THE BUCKET, and this writes only to the index.
   */
```

### app/routes/admin.media._index.tsx:720 (WHY, shortened)

grammar and single-writer prohibition kept.

```tsx
/*
   * BULK TAGGING. The bulk-actions ruling applied UNCHANGED, deliberately.
   *
   * This is the posts index's grammar, verbatim, down to the intent names and
   * the shape of the message: ADD or REMOVE one tag, never replace the set, so
   * a mistake costs one tag rather than all of them; skip a row already in the
   * target state and NAME BOTH COUNTS, because "12 tagged" when nine were
   * already tagged is a different fact from "12 tagged" when none were;
   * continue past failures and report per key.
   *
   * It ITERATES `setMediaTags`, the same per-row writer the inspector uses.
   * There is no bulk SQL path and there must not be: a second writer would be a
   * second author of the delimiter rule, and the whole reason that rule lives
   * in a pure module is that this table has already been bitten by two writers
   * disagreeing about a join character.
   */
```

### app/routes/admin.media._index.tsx:740 (WHY, shortened)

trimmed.

```tsx
// ONE tag, normalised by the module that owns the rule. An input that
    // normalises to nothing is refused rather than treated as a clear.
```

### app/routes/admin.media._index.tsx:789 (WHY, shortened)

prohibition kept; incident moved.

```tsx
/*
     * **AN EMPTY FIELD IS NOT AN INSTRUCTION TO CLEAR.**
     *
     * This used to pass whatever arrived straight to `setMediaTags`, so blanking
     * the text box and pressing Save wiped every tag on the key and reported
     * "Tags cleared" as though that had been asked for. The destructive outcome
     * was the DEFAULT of an empty field, which is the wrong way round: the
     * common accident and the deliberate act produced the same request.
     *
     * Clearing is now its own act, marked by `clear`. Nothing else changes:
     * `setMediaTags` stays the one writer and the one author of the delimiter
     * rule, so a chip still cannot become a second way to format a tag.
     *
     * Not a confirmation ceremony. Tags are retypable, so the fix is to stop
     * the accident being expressible, not to ask twice about it.
     */
```

### app/routes/admin.media._index.tsx:823 (WHY, shortened)

ruling citation and narration moved.

```tsx
/*
   * TRASH AND RESTORE. **NEITHER TOUCHES R2 AND NEITHER TOUCHES A PUBLIC URL.**
   *
   * The messages say so, in full, every time. Ruling 3 of this arc: if any copy
   * could be read as a takedown, rewrite it. An author who trashes an asset and
   * then finds the image still loading on a published post must not conclude
   * the button failed.
   */
```

### app/routes/admin.media._index.tsx:831 (WHY, shortened)

trimmed.

```tsx
/*
   * BULK TRASH. The per-row ruling applied unchanged to many rows.
   *
   * Trashing is REVERSIBLE and touches neither R2 nor any public URL, which is
   * why it takes a plain confirmation rather than the type-the-count ceremony
   * that `empty-trash` owes. The friction ladder is unchanged: the count is
   * spent where the action is irreversible.
   *
   * It ITERATES `trashMediaRecord`, the same per-row writer the inspector uses,
   * and reports per key, exactly as the bulk-tagging ruling requires. There is
   * no bulk SQL path and there must not be: a second writer would be a second
   * author of a rule this table has already been bitten by.
   */
```

### app/routes/admin.media._index.tsx:888 (WHY, shortened)

trimmed.

```tsx
/*
   * EMPTY TRASH. Iterates the EXISTING guarded delete, one key at a time.
   *
   * Per the bulk ruling: continue past failures and report per key. A cited
   * asset is refused by `claimMediaKeyForDelete` in the same single statement
   * that protects a one-off delete, so emptying the bin cannot become a way
   * around the refcount guard. The friction ladder is unchanged: the confirm
   * lives on the control, and this is the same delete it has always been.
   */
```

### app/routes/admin.media._index.tsx:900 (WHY, shortened)

enforcement reason kept; incident moved.

```tsx
/*
     * **THE TYPE-THE-COUNT LADDER, ENFORCED HERE AND NOT ONLY IN THE UI.**
     *
     * It lived in an `onSubmit` handler calling `prompt()`, so with scripting
     * off the handler never ran and this action deleted every trashed object
     * with no confirmation at all. The ceremony was script-only while the
     * destruction was not.
     *
     * The modal now renders its confirm button ENABLED on the server, precisely
     * so a reader without script can reach it, which means the check has to be
     * here. The disabled button is earlier feedback; this is the gate.
     *
     * Compared against the count read in THIS request rather than one the form
     * carried, so a stale page cannot authorise a delete of a different size
     * than the operator was shown.
     */
```

### app/routes/admin.media._index.tsx:955 (WHY, shortened)

ruling number dropped.

```tsx
// Editing alt updates the RECORD and rewrites no post. Ruling 2: alt is
    // contextual as well as intrinsic, so posts keep whatever alt they were
    // written with and only future insertions pick this up.
```

### app/routes/admin.media._index.tsx:963 (WHY, shortened)

two-question distinction kept; 2026-08-02 incident moved.

```tsx
// Replaces the old page-scoped backfill, which only ever saw the objects on
    // the current page and could not touch static assets at all. This one is
    // whole-corpus and idempotent: it re-derives every derived column and
    // preserves every authored one, so it is safe to press at any time.
    //
    // **It reported nothing useful the first time it was pressed, and that was a
    // real defect rather than a cosmetic one.** It wrote all 70 rows and looked
    // like it had done nothing, because the page still listed R2 and so showed
    // exactly what it had shown before. Dustin reported it as broken. A
    // maintenance action whose only evidence is invisible is indistinguishable
    // from one that failed, so the count is now read back OUT OF D1 afterwards
    // rather than trusted from the report, and the listing this redirects to
    // reads D1 too, so the page itself changes.
    // **The row count and the role split answer DIFFERENT questions, and reading
    // one as a proxy for the other sends the next session to debug a correct
    // file.** This cost real time on 2026-08-02, so it is written down here next
    // to the numbers rather than left to be rediscovered:
    //
    //   ROW COUNT   answers "did the rebuild run at all". Backfilling rows from
    //               the buckets is one code path.
    //   ROLE SPLIT  answers "does roleOf() work". Deriving role is a DIFFERENT
    //               code path, and it runs per row after the row exists.
    //
    // They are independent. A rebuild that ran with a completely broken
    // `roleOf()` still produces the full row count, every row simply carrying
    // the column default. So a stale-looking role split does NOT imply the
    // deriver is broken, and a correct role split does not prove the rebuild
    // reached every source. Report both, and read each for what it answers.
```

### app/routes/admin.media._index.tsx:991 (WHY, shortened)

trimmed; ruling date moved.

```tsx
/*
     * **THE CONFIRMATION, CHECKED HERE. Ruled 2026-08-17.**
     *
     * A rebuild is idempotent for rows whose source still exists, and that is
     * what made it look harmless. It is not: `report.removed` DELETES rows
     * whose source is gone, so a rebuild run against a half-populated bucket,
     * or while R2 is returning an error, prunes the index down to whatever it
     * managed to see. Nothing asked before doing that.
     *
     * The count is 1, not the number of rows at risk, and the reason is honest
     * rather than lazy: how many rows a rebuild removes cannot be known without
     * running it, so a typed count would be a number invented to look precise.
     * The confirmation step states the CURRENT size instead, which is the
     * quantity actually at stake.
     */
```

### app/routes/admin.media._index.tsx:1030 (WHY, shortened)

trimmed.

```tsx
// Reported ALONGSIDE the row count, never instead of it. See above: one
      // says the rebuild ran, the other says the deriver worked.
```

### app/routes/admin.media._index.tsx:1052 (WHY, shortened)

incident moved.

```tsx
/*
     * **THE CONFIRMATION IS CHECKED HERE, NOT IN THE FORM'S onSubmit.**
     *
     * It was a `confirm()` in an `onSubmit` handler, so with scripting off the
     * handler never ran and the R2 object went with no confirmation at all.
     * The refcount, static and claim checks below were always server-side and
     * stay exactly as they were; what was missing is the only one that asks
     * whether a HUMAN meant this, and those other checks cannot stand in for it
     * because an uncited object passes every one of them.
     *
     * The key is content-addressed, so a deleted object cannot be restored by
     * re-uploading the same bytes under the same URL. One object, so the count
     * is 1, using the same predicate and field name as empty-trash beside it.
     */
```

### app/routes/admin.media._index.tsx:1071 (WHY, shortened)

trimmed.

```tsx
// STATIC ASSETS ARE NOT DELETABLE HERE, and this is enforced in the ACTION
    // rather than by hiding the button. A hidden button is a UI opinion; a
    // hand-made POST, a stale page or a future refactor all route around it.
    // Removing a static asset means a commit that deletes the file, because the
    // file is in the repo and a Worker cannot write to the assets host at all:
    // deleting the ROW would simply leave check:media red until the next
    // rebuild put it straight back.
```

### app/routes/admin.media._index.tsx:1088 (WHY, shortened)

trimmed.

```tsx
// THE CHECK RUNS HERE, SERVER SIDE, ON A FRESH READ. The page the operator
    // is looking at may be minutes old and a post may have started citing this
    // object since it rendered, so the UI's opinion is never the authority.
```

### app/routes/admin.media._index.tsx:1096 (WHY, shortened)

ruling number dropped.

```tsx
// Ruling 4: FAIL CLOSED. "We could not check" is not "nothing cites it".
```

### app/routes/admin.media._index.tsx:1103 (WHY, shortened)

trimmed.

```tsx
// THE REFCOUNT. Content-addressed keys mean two posts can share one blob,
    // so the question is not "does this post use it" but "does ANYTHING use
    // it". Deleting the object while a second citation survives would break
    // that other post, which is exactly the cost the CAS ruling accepted and
    // this is where it is paid.
```

### app/routes/admin.media._index.tsx:1121 (WHY, shortened)

race reasoning kept; finding id moved.

```tsx
/*
     * THE CLAIM, and it is one statement on purpose. Finding B009: everything
     * above is a check-then-act, so a save that adds a citation after the read
     * and before the delete used to lose its image. `claimMediaKeyForDelete`
     * removes the row only if nothing cites the key AT THAT INSTANT, inside a
     * single D1 statement, and reports whether it won.
     *
     * Losing means something cited it in the meantime, so this refuses, which
     * is the same fail-closed stance the checks above take. The row goes first
     * because R2 wins every conflict: a surviving object with no row is
     * backfilled by the next rebuild, while a row with no object is the case
     * `check:media` calls an error.
     *
     * The residual, stated rather than implied: a save can still land a ref
     * between this claim and the R2 delete below. Closing that needs both paths
     * to take a lock, which the save path does not have. What this removes is
     * the wide window, the one that spanned two awaits and a network round
     * trip; what is left is bounded by a single R2 call and cannot be reached
     * without a concurrent writer on a single-author system.
     */
```

### app/routes/admin.media._index.tsx:1164 (WHY, shortened)

trimmed.

```tsx
// A map entry exists because a citation was pushed into it, so the first
    // is always there. The empty title is unreachable and reads as an untitled
    // post rather than as `undefined` in an admin warning.
```

### app/routes/admin.media._index.tsx:1172 (CONTRACT, shortened)

measurement and ruling date moved.

```tsx
/**
 * DISPLAY CHANGES DO NOT TOUCH THE SERVER.
 *
 * Standing ruling, 2026-08-16: a control that does not change which data comes
 * back must not make a request. `view`, `size` and `group` decide how the
 * fetched page is drawn and never which rows it holds, so flipping one is a URL
 * change and a re-render and nothing else.
 *
 * The URL still updates, which is the half that is easy to lose: the state stays
 * shareable, the back button still walks the display history, and with scripting
 * off the same link is an ordinary link the server honours by parsing the same
 * parameter. Nothing here is built the slow way to preserve that.
 *
 * MEASURED on production 2026-08-16, before this existed: flipping List to Grid
 * fetched 17,889 bytes of loader data in a median 1629ms to redraw rows the
 * browser already had. The admin plane is never edge cached, so that was a full
 * round trip to the origin plus a D1 query for a CSS class change.
 *
 * Anything mixed falls through to the default: a URL that changes `view` AND
 * `sort` revalidates, because `sort` changes which rows page one holds.
 */
```

### app/routes/admin.media._index.tsx:1199 (WHY, shortened)

trimmed.

```tsx
// A submission always revalidates. `onlyDisplayChanged` already returns false
  // for identical URLs, which is the shape an after-action revalidation arrives
  // in, but stating it here means a later edit cannot make a write invisible.
```

### app/routes/admin.media._index.tsx:1210 (WHY, shortened)

seam contract and the ceiling kept (admin queue ruling 8); incident moved.

```tsx
/*
   * HARNESS SEAM, per admin queue ruling 8: an OPTIONAL PROP with a production
   * default, never loaderData, which is the server contract the gate polices.
   *
   * `check:admin-ui` renders one static pass and dispatches no events, so
   * without this the bulk bar never mounts and the two bulk intents contribute
   * NO payload, which is exactly how the posts index left its most destructive
   * surface outside the fixture for a session. Defaulted, wire-unreachable by
   * construction, and this is the SECOND such seam against the ruled ceiling of
   * three: the posts index has the other one, with the same name.
   */
```

### app/routes/admin.media._index.tsx:1222 (WHY, shortened)

trimmed; the ceiling kept.

```tsx
/*
   * THE THIRD AND LAST HARNESS SEAM, at the ruled ceiling of three.
   *
   * The bulk-trash confirmation opens from client state, so a single static
   * render can never reach it and the gate would be asserting the absence of
   * something structurally unreachable. Same shape as `initialSelection`: an
   * optional prop with a production default, never supplied by React Router.
   *
   * This is the surface that permanently hides files from the library in one
   * press, so leaving it outside the fixture is exactly the mistake the posts
   * index made with its bulk bar for a whole session.
   */
```

### app/routes/admin.media._index.tsx:1260 (WHY, shortened)

trimmed.

```tsx
/*
   * THE DISPLAY AXES COME FROM THE URL, not from the loader.
   *
   * `shouldRevalidate` below refuses to refetch when only these three changed,
   * so the loader's copy of them is deliberately stale on that path and the
   * live URL is the only thing that knows. Everything else on `view` is the
   * loader's, because everything else describes rows it actually fetched.
   *
   * On the server both sides read the same request URL, so this overlay is a
   * no-op in the no-script render and the markup is unchanged.
   */
```

### app/routes/admin.media._index.tsx:1274 (WHY, shortened)

measurement moved.

```tsx
/*
   * PENDING STATE, from the router and nothing else.
   *
   * A data-changing control on this plane costs a round trip to the origin plus
   * a D1 query: 1629ms median, MEASURED on production 2026-08-16. Without a
   * signal the page simply sits there, and the second press is the one that
   * makes a bulk action run twice.
   *
   * `useNavigation` already knows. There is no spinner, no timer and no state
   * of our own: one attribute the stylesheet dims, plus `aria-busy` so the
   * announcement is not a visual-only affordance.
   *
   * DISPLAY CHANGES ARE EXCLUDED. They resolve without the loader, so flagging
   * them would flash pending over a re-render that already happened, and would
   * teach the reader the indicator means nothing.
   */
```

### app/routes/admin.media._index.tsx:1304 (WHY, shortened)

trimmed.

```tsx
/*
   * SELECTION, and it is the ONLY client state this page has ever carried.
   *
   * Everything else here is a URL: the view, the sort, the filters, the open
   * inspector. Selection is not, and deliberately: it is transient, it means
   * nothing after a navigation, and putting twelve keys in a query string would
   * make every link on the page unreadable and every back button surprising.
   *
   * With script off there is no bulk bar and no checkboxes render as useful, so
   * the page degrades to exactly what it did before this landed: per-row
   * controls in the inspector. Nothing that only works with script is the only
   * way to do anything here.
   */
```

### app/routes/admin.media._index.tsx:1327 (WHY, shortened)

trimmed.

```tsx
/*
   * SHIFT-RANGE. The last row the reader touched, so shift-click can span.
   *
   * A REF rather than state, and that is the whole point: it is remembered
   * between events and never rendered, so it cannot cause a re-render and
   * cannot differ between the server render and the hydrated one. The seam this
   * enhancement adds to the page is therefore zero new rendered state.
   *
   * Degrades to nothing. Without script no checkbox toggles at all, and a plain
   * click without shift behaves exactly as it did before this existed.
   */
```

### app/routes/admin.media._index.tsx:1361 (WHY, shortened)

incident moved.

```tsx
/*
   * EVERY LINK ON THIS PAGE IS `hrefWith(view, {one override})`.
   *
   * This replaced a hand-rolled merge that listed the parameters it carried,
   * which is precisely how the two evaporation incidents happened: the list in
   * the builder and the set of parameters the page actually had drifted apart,
   * silently, because a missing query parameter is not a payload difference and
   * no gate could see it.
   *
   * `hrefWith` starts from the WHOLE state and overrides one field, and its
   * parameter list is derived from the defaults rather than typed again. There
   * is no longer a place to forget one.
   */
```

### app/routes/admin.media._index.tsx:1382 (HISTORY, deleted)

describes the previous subtitle.

```tsx
// Written for someone looking for a picture, and it now describes the
      // control the page actually has. The previous line told the reader to copy
      // a filename beside tiles that showed a name and offered no copy button.
```

### app/routes/admin.media._index.tsx:1385 (WHY, shortened)

trimmed.

```tsx
/*
        A COUNT LINE, which is what the mockup has, not a sentence of prose.
        "31 files, 0 in trash" tells the reader the size of the thing they are
        about to search; the old sentence told them what a media library is,
        which they knew.
      */
```

### app/routes/admin.media._index.tsx:1392 (WHY, shortened)

layout story moved.

```tsx
/*
        UPLOAD AND MAINTENANCE MOVE BESIDE THE TITLE.

        They were a full-width row of their own directly under the head,
        which cost a whole band of vertical space to say "upload" and was
        one of the seven rows standing between the top of the page and the
        grid, where the design has four. An action belongs on the heading of
        the thing it acts on.
      */
```

### app/routes/admin.media._index.tsx:1403 (CONTRACT, shortened)

trimmed.

```tsx
/*
          UPLOAD, on the page whose job is finding pictures.

          It posts to the same endpoint the two editors use and declares itself
          with a hidden `intent`, which is the ONLY thing that selects the
          redirect branch there; the editors keep the JSON path by sending
          nothing new. Images only, because that is what the endpoint accepts:
          the library's documents arrive as committed static assets.
        */
```

### app/routes/admin.media._index.tsx:1418 (WHY, shortened)

trimmed.

```tsx
/*
            ONE BUTTON, top right, not a bare file input in the content flow.

            The label IS the affordance and it names the enhancement that
            already exists: "Drop files anywhere, or browse". The file input is
            still there and still the keyboard path; it is visually folded into
            the label so the control reads as one thing.
          */
```

### app/routes/admin.media._index.tsx:1426 (WHY, shortened)

duplicate of the comment above, trimmed.

```tsx
/*
            ONE CONTROL. The label is the button and the file input is folded
            inside it, so the head shows a single affordance that names the
            enhancement rather than a bare "Choose File" widget in the content
            flow. The input is still a real input and still the keyboard path.
          */
```

### app/routes/admin.media._index.tsx:1443 (WHY, shortened)

trimmed.

```tsx
/* The intent rides on the SUBMIT BUTTON rather than in a hidden
              field, and the difference is what a gate can see: check:admin-ui
              reduces a form to `METHOD action | intent | fields`, so a hidden
              field lands in the field list as a bare name while a button's
              name/value pins the TOKEN. The payload is identical either way. */
```

### app/routes/admin.media._index.tsx:1453 (WHY, shortened)

trimmed.

```tsx
/* Rebuild is a REPAIR, so it sits where the posts list puts its
            repairs rather than beside the browsing controls. Same form, same
            method, same intent, same empty field set: check:admin-ui compares
            exactly that, which is what makes this a move and not a change. */
```

### app/routes/admin.media._index.tsx:1477 (WHY, shortened)

trimmed.

```tsx
/*
        SEARCH AND FILTER, as a GET form, borrowed from the posts list.

        The filter state lives in the URL, so it survives a reload, is linkable,
        is what the back button restores, and works with scripting off with no
        enhancement at all. A plain <form>, not react-router's <Form>, because
        the browser's own submission already produces the navigation wanted.

        The role rides along as a hidden field so searching does not silently
        widen the group the reader chose.
      */
```

### app/routes/admin.media._index.tsx:1488 (WHY, shortened)

stale Cmd+K note moved.

```tsx
/*
        ONE WIDE BAR. No separate SEARCH label block and no adjacent Search
        button, because the mockup has neither and both were noise: a search
        input needs no label when its placeholder is the instruction, and Enter
        already submits.

        THE PLACEHOLDER CARRIES THE COUNT, which is the mockup's move and a good
        one: it tells you how big the haystack is before you type. The count is
        the library's, from the loader, not a guess.

        NO Cmd+K AFFORDANCE IS RENDERED. The mockup shows one; this page has no
        such shortcut, and the earlier ruling against documenting absent
        shortcuts applies unchanged. It goes in when the shortcut does.
      */
```

### app/routes/admin.media._index.tsx:1512 (WHY, shortened)

trimmed.

```tsx
/* Every other axis rides along as hidden fields, or searching would
            silently drop the reader out of the lens and folder they chose. This
            is the evaporation rule applied to a form rather than a link. */
```

### app/routes/admin.media._index.tsx:1529 (WHY, shortened)

ruling narrative moved.

```tsx
/*
          THE Cmd+K AFFORDANCE, WHICH MAY NOW BE RENDERED.

          The v6.4 pass deliberately left it out with a note: "NO Cmd+K
          AFFORDANCE IS RENDERED. The mockup shows one; this page has no such
          shortcut, and the earlier ruling against documenting absent shortcuts
          applies unchanged. It goes in when the shortcut does." The shortcut
          went in with the palette below, so the badge goes in with it. The
          ruling is satisfied rather than waived.

          aria-hidden: it is a picture of a key combination, and a screen reader
          announcing "command K" beside a search field it can already reach adds
          nothing. The binding itself is listed in the shortcuts popover.
        */
```

### app/routes/admin.media._index.tsx:1547 (WHY, shortened)

trimmed.

```tsx
/*
        THE PALETTE, mounted AFTER the form and rendering nothing on the server.

        It attaches to the input above by id rather than owning it, so with
        scripting off the form is untouched and still navigates. Everything the
        palette adds is additive: live results, arrow keys, Enter to copy.
      */
```

### app/routes/admin.media._index.tsx:1556 (WHY, shortened)

trimmed.

```tsx
/* THE FACET ROW, from the ratified mockup: a label, the chips, and a
          hint that says who owns this axis.

          "assigned by the system" is the line the mockup was approved for, and
          it is doing real work: `role` is DERIVED by `roleOf()` from the key,
          so a reader who thinks it is an editable label will look for an editor
          that does not exist and conclude the page is broken. Saying it once
          here costs a phrase and closes that. */
```

### app/routes/admin.media._index.tsx:1565 (WHY, shortened)

replacement story moved.

```tsx
/*
          THE QUALITY LENSES, which replaced the role chips as the primary row.

          Role was the SYSTEM'S classification (Content / Generated / Brand /
          Icons), and once every section carries a folder heading it says the
          same thing twice. A lens says what a heading cannot: which files
          nothing references, which duplicate each other, which have no alt
          text, which are large. Those are the questions somebody actually has.

          Role stays reachable by URL (?role=brand) and is no longer a row.
        */
```

### app/routes/admin.media._index.tsx:1597 (WHY, shortened)

trimmed.

```tsx
/* THE DOT, only when the count is non-zero, which is the
                    mockup's own rule and a good one: a coloured dot beside a
                    zero is an alarm about nothing. Decoration over a number and
                    a word that both already say it, so it is hidden. */
```

### app/routes/admin.media._index.tsx:1608 (WHY, shortened)

trimmed.

```tsx
/* Trash sits in the same row in the mockup, because it is the same
              kind of question: which files are in which state. */
```

### app/routes/admin.media._index.tsx:1624 (WHY, shortened)

trimmed.

```tsx
/*
        TAG CHIPS, beside the roles rather than inside the Display popover.
        Tags are NAVIGATION: they narrow what you are looking at, exactly as a
        role does. Group, sort and tile size are SETTINGS, which is why they sit
        behind one control instead of competing with these. That split is the
        mockup's own reasoning and it is the reason the toolbar reads calmly.

        Rendered only when tags exist, so an untagged library is not given an
        empty facet to wonder about.
      */
```

### app/routes/admin.media._index.tsx:1655 (WHY, shortened)

trimmed.

```tsx
/*
        THE DISPLAY BAR: the view toggle, the Display popover, and the Trash
        lens. Every control here is a LINK, so the whole thing works with no
        script and every state is a URL somebody can share or bookmark.

        `<details>` carries the popover rather than a button and a state hook,
        for the same reason the drawer is a real `<dialog>`: the open and close
        behaviour, the Escape key and the summary semantics are the platform's.
      */
```

### app/routes/admin.media._index.tsx:1665 (WHY, shortened)

move story removed; prohibition kept.

```tsx
/*
          SELECT ALL SHOWN, IN THE CONTROLS ROW where the mockup has it.

          It was a row of its own between the notes and the grid, which is a
          whole band of vertical space for one checkbox and was one of the seven
          rows above the grid where the design has four. It is a view control
          like the layout toggle beside it, so it belongs in the row of view
          controls.

          Moved OUT of the wrapping bulk form deliberately and safely: it is a
          client-side toggle with no `name`, so it contributed nothing to that
          submission and `check:admin-ui` records no change for it. The
          checkboxes it toggles are still inside the form, which is what the
          bulk action actually reads.

          The ruled wording is unchanged: never the bare word "all" while a
          filter is active, because this only ever reaches the rows on screen.
        */
```

### app/routes/admin.media._index.tsx:1736 (WHY, shortened)

bug narrative moved.

```tsx
/*
                THROUGH `sortHref`, the SAME builder the list header uses.
                It used to be `linkTo({ sort: id, page: 1 })`, which set the key
                and left `dir` at whatever the URL already carried: choosing
                Largest while ascending gave you the SMALLEST file, from a
                control labelled Largest. A sort key is not direction-neutral,
                so the choice carries its direction, and both controls read that
                pairing from one table. No toggle here: a popover option is a
                destination, and reversing is what the Direction group and the
                header press are for.
              */
```

### app/routes/admin.media._index.tsx:1768 (WHY, shortened)

trimmed.

```tsx
/* A LINK to the bare URL, not a button. Resetting is navigation to
                the default view, and the default view has an address. */
```

### app/routes/admin.media._index.tsx:1778 (WHY, shortened)

trimmed.

```tsx
/*
          THE KEYBOARD SHORTCUTS, behind the mockup's "?" control.

          A `<details>` like the Display popover beside it, for the same reason:
          the open and close behaviour, the Escape key and the summary semantics
          are the platform's, and this needs no script at all. That matters more
          here than anywhere else on the page, because a panel documenting
          keyboard access that itself requires a mouse would be a joke at the
          reader's expense.

          THE LIST IS DERIVED FROM `MEDIA_SHORTCUTS`, not typed here, so a
          binding cannot be documented without existing. Everything in that
          table is implemented: the two global ones by the palette, the rest by
          the grid navigator.
        */
```

### app/routes/admin.media._index.tsx:1812 (WHY, shortened)

history; JSX comment cannot be deleted.

```tsx
/* Trash MOVED to the lens row, where the mockup has it: it is the
            same kind of question as the other lenses, which files are in which
            state. Two Trash chips on one page was the duplicate this pass
            found by looking. */
```

### app/routes/admin.media._index.tsx:1818 (WHY, shortened)

session narration moved.

```tsx
/*
        THE LENS NOTE, as its own banner, and it is the thing that stops a lens
        being read as an accusation.

        A narrowed view makes a CLAIM: these files are unattached, these are
        duplicates. Each claim has a boundary, and the boundary is what the
        reader needs before acting on it. The unattached note is the one that
        matters most and the one that could only be written truthfully once the
        repository scan existed: before this session, "no reference was found in
        posts or in repository code" would have described a check nothing ran.

        `Show everything` is a LINK to the unnarrowed view, not a button. The
        lens is a URL, so leaving it is navigation.
      */
```

### app/routes/admin.media._index.tsx:1841 (WHY, shortened)

trimmed.

```tsx
/*
        THE TRASH EXPLANATION, shown WHENEVER the bin is open rather than only
        when it has rows. An author arriving at an empty bin still needs to know
        what putting something in it would do.
      */
```

### app/routes/admin.media._index.tsx:1856 (WHY, shortened)

trimmed.

```tsx
/*
        EMPTY TRASH, the one control on this page that is a real delete, so it
        takes the friction the ladder assigns to a BULK delete: TYPE THE COUNT,
        exactly as bulk post deletion does. Not a plain confirm, because it
        removes many objects at once and the count is the thing a distracted
        person gets wrong.

        The ladder is UNCHANGED by this arc, which is the point: this reuses it
        rather than inventing a fourth level of ceremony.
      */
```

### app/routes/admin.media._index.tsx:1868 (WHY, shortened)

incident moved.

```tsx
/*
            A LINK TO THE CONFIRMATION, not a form with a prompt() handler.

            The old control called `prompt()` from `onSubmit`, so with scripting
            off the handler never ran and the form submitted straight through:
            the ceremony was script-only while the destruction was not. The
            confirmation is a URL now, so it is server-rendered and the ladder
            holds either way.
          */
```

### app/routes/admin.media._index.tsx:1886 (CONTRACT, shortened)

trimmed.

```tsx
/*
        THE EMPTY-TRASH CONFIRMATION, opened by `?confirm=empty-trash`.

        Server-rendered, so it exists with no script; cancel is a link back to
        the same view with the parameter cleared, and confirm is a real submit
        whose typed count the ACTION checks. The disabled button is earlier
        feedback once hydrated, never the gate.
      */
```

### app/routes/admin.media._index.tsx:1916 (WHY, shortened)

trimmed.

```tsx
/* ONE LINE, in words, and it states ONCE what Unused actually means.
          The chip now carries a number, and a number invites the reading
          "nothing uses these", which is stronger than the query can support:
          media_refs records what the RENDERER emitted, so an asset referenced
          by a route rather than by a post is uncited here. */
```

### app/routes/admin.media._index.tsx:1921 (WHY, shortened)

history; JSX comment cannot be deleted.

```tsx
/*
        THE ROLE-SHAPED SUMMARY LINE IS GONE. It read "Showing 20 content items
        of 16" and described an axis that is no longer the primary one, using
        counts that no longer agree with the lens row. The count line in the
        page head says the true thing once, and the section headings say the
        rest.
      */
```

### app/routes/admin.media._index.tsx:1929 (WHY, shortened)

coincidence story moved.

```tsx
/*
        THE USAGE HONESTY LINE. The Unused chip went; this did not.

        It is the one thing on this page standing between a reader and deleting
        a file the site is serving, and it is now UNCONDITIONAL rather than
        appearing only when the uncited count happened to equal the total. That
        condition was a coincidence of the current corpus: the moment one post
        cites one image, the caveat would have vanished while remaining exactly
        as true, and the roster photographs would still have been invisible to
        the tracker.
      */
```

### app/routes/admin.media._index.tsx:1964 (WHY, shortened)

trimmed.

```tsx
/* The usage column is the whole reason this page exists, so when it
          cannot be trusted the page says so rather than showing "unused"
          everywhere and inviting a delete. */
```

### app/routes/admin.media._index.tsx:1995 (WHY, shortened)

cursor history moved.

```tsx
/* PAGE NUMBERS, in the URL, so a page of the library is linkable and
          works with scripting off. The opaque R2 cursor went with the R2
          listing: it could only ever move forward one page at a time, because
          a cursor is a position in a key-ordered iterator and not an index.

          The filter AND the search travel with the page number. Dropping the
          filter was how paging out of a filtered view silently reverted to the
          default, and a search dropped the same way would be the same bug
          wearing a different parameter. */
```

### app/routes/admin.media._index.tsx:2004 (WHY, shortened)

trimmed.

```tsx
/*
        THE TWO PAGE-LEVEL ISLANDS. Both render nothing on the server: the toast
        is an empty live region until something speaks, and the navigator draws
        no markup at all. With scripting off neither exists and the page is
        exactly what it was.
      */
```

### app/routes/admin.media._index.tsx:2010 (WHY, shortened)

trimmed.

```tsx
/*
        THE BULK-TRASH CONFIRMATION, opened from CLIENT STATE rather than a URL.

        That asymmetry with the empty-trash modal is deliberate and is the
        honest one: this acts on the SELECTION, which is client state, inside a
        bulk bar that does not render without script at all. A URL cannot carry
        the selection, and pretending it could would be a no-script path that
        silently acts on nothing.

        The keys are re-rendered as hidden fields here rather than read from the
        grid's checkboxes, because this form is its own submission.
      */
```

### app/routes/admin.media._index.tsx:2041 (WHY, shortened)

trimmed.

```tsx
/*
        THE SINGLE-DELETE CONFIRMATION, opened by the ACTION refusing an
        unconfirmed delete rather than by a URL.

        Empty-trash next door is opened by `?confirm=`, because its target is
        the whole bin and needs no identifying. This one's target is a key the
        action already has in hand, and routing it through the URL would mean a
        second confirm vocabulary and a loader change for no gain. Both end at
        the same place: a server-rendered step whose typed count the action
        checks.

        Cancel is a Link, so it works with no script: it is an ordinary GET back
        to this view, which discards the action result.
      */
```

### app/routes/admin.media._index.tsx:2055 (WHY, shortened)

trimmed.

```tsx
/*
        THE REBUILD CONFIRMATION, opened by the action refusing an unconfirmed
        rebuild. Same shape as the single delete beside it: an unconfirmed
        destructive POST is the confirmation step, not an error.
      */
```

## app/db/index.ts

### app/db/index.ts:50 (CONTRACT, shortened)

trimmed.

```ts
/**
 * The single gate for public content. A row is visible only when it is published
 * and its publish_at is either unset or already in the past. Every public read
 * must apply this predicate.
 */
```

### app/db/index.ts:62 (WHY, shortened)

finding id and incident date moved.

```ts
/**
 * Which of these slugs are still publicly visible, as a Set.
 *
 * One query for the whole list, composing `publiclyVisible()` like every other
 * public read, so there is no second opinion about what "public" means.
 *
 * Exists for finding B010. A cached Ask answer carries its citations, and that
 * cache is invalidated by a KV `list` which is EVENTUALLY CONSISTENT: an answer
 * written moments before a post is unpublished can outlive the invalidation
 * meant to remove it, for as long as the seven day TTL. Replaying it would name
 * and link a post that is no longer public, which is the 2026-07-29 draft leak
 * arriving by a different route. The replay path asks this before it serves.
 */
```

### app/db/index.ts:87 (WHY, shortened)

section header trimmed.

```ts
/* Blog ---------------------------------------------------------------------
 *
 * Blog rows are `kind = 'post'` and carry a source_path, since they are
 * generated from content/posts. Every read below composes publiclyVisible(),
 * which is the only place draft and future publish_at are handled.
 */
```

### app/db/index.ts:113 (WHY, shortened)

reader list and normalisation essay trimmed.

```ts
/**
 * THE TAG PREDICATE, stated once.
 *
 * Four readers now ask "which posts carry this tag": the index's `?tag=`
 * filter, the tag archive, and the archive's two feeds. This was written out
 * inside `listBlogPosts` and copying it three times is how the page and its own
 * feed come to disagree about which posts a tag has, which is the failure a
 * reader notices by subscribing and getting a different list.
 *
 * A SUBQUERY on ids rather than a join, deliberately: joining `post_tags` here
 * would multiply rows by tag count and every caller would have to fold them
 * back. The id list is what the callers already paginate and limit against.
 *
 * The slug is matched exactly, against `tags.slug`, which is the normalisation
 * the write path already produced. Nothing here lowercases or re-slugifies: a
 * second normalisation is a second answer to "what is this tag called".
 */
```

### app/db/index.ts:141 (CONTRACT, shortened)

trimmed.

```ts
/**
 * One tag, by slug, or null when nothing publicly visible carries it.
 *
 * The archive's 404 test. It composes `isBlogPost()` through the same count
 * join `listBlogTags` uses, so "this tag exists" means exactly what the chip
 * list means by it: a tag carried only by drafts or by future-dated posts is
 * absent from both, and the archive for it is a 404 rather than an empty page.
 */
```

### app/db/index.ts:182 (CONTRACT, shortened)

trimmed.

```ts
/**
 * Paginated blog index, optionally filtered to one tag. Filtering happens here
 * rather than in the component, so the HTML that ships is already the filtered
 * list.
 */
```

### app/db/index.ts:204 (WHY, shortened)

trimmed.

```ts
// Both filters are applied in the query, so the HTML that ships is already
  // narrowed rather than hidden in the browser.
```

### app/db/index.ts:207 (WHY, shortened)

trimmed.

```ts
// Through `carriesTag`, which the archive and its two feeds also call, so all
  // four agree on which posts a tag has.
```

### app/db/index.ts:215 (WHY, shortened)

latency measurements and rewrite story moved; subquery and tie-break traps kept.

```ts
// ONE ROUND TRIP, not three.
  //
  // This used to be `count`, then `rows`, then `tagsForPosts(rows.map(id))`,
  // strictly serial because the third needed ids the second had not returned
  // yet. Measured on the deployed Worker: 59 + 56 + 55 = 171ms of loader time,
  // of which D1 reported 0.1471ms as actual SQL for the count. The cost was
  // never the queries. It was three round trips to ENAM/ORD.
  //
  // Two changes, in this order:
  //
  //   1. The tag lookup becomes a LEFT JOIN onto the page of posts, removing
  //      the dependency that forced the third trip to wait.
  //   2. What remains, `count` and `rows`, have no dependency on each other, so
  //      `db.batch` sends both as one round trip.
  //
  // **The page is selected in a SUBQUERY and the join wraps it.** Joining first
  // and paginating after would apply LIMIT to JOINED rows, so a post with four
  // tags would consume four of the ten slots and the page would silently hold
  // fewer posts than it claimed. This is the trap that makes a many-to-many
  // LEFT JOIN wrong by default, and the subquery is what avoids it.
  // `id DESC` as an explicit tie-break, and it is load-bearing.
  //
  // Nine of the eleven published posts share a `publish_at` with at least one
  // other: four on 1785369600 and five on 1785196800. `ORDER BY publish_at DESC`
  // alone leaves their relative order UNSPECIFIED. It happened to come back id
  // DESC, and the listing has always been in that order, but by luck rather
  // than by instruction.
  //
  // That luck cannot survive this rewrite. The outer query below orders by tag
  // slug as its last key, so within a tie the rows of several posts INTERLEAVE
  // and the fold ends up ordering posts by their alphabetically-first tag.
  // Measured: the listing came back ordered by first tag rather than by date.
  // Stating the tie-break fixes it and also removes the original reliance on
  // undefined behaviour.
```

### app/db/index.ts:258 (WHY, shortened)

trimmed.

```ts
// Named one by one because drizzle will not select a subquery as a nested
  // object. A column added to `postCard` and forgotten here does not fail
  // silently: the field disappears from the return type and every consumer of
  // it stops typechecking.
```

### app/db/index.ts:279 (WHY, shortened)

incident narrative moved.

```ts
// ALIASED, and this is not cosmetic. `posts.slug` and `tags.slug` are
          // both named `slug`; D1 returns one flat row per result and drizzle
          // maps it back by COLUMN NAME, so without a distinct alias the two
          // collide: `slug` silently took the TAG's value and `tagSlug` came
          // back undefined. Every post then linked to `/blog/<a-tag-slug>` and
          // every tag rendered as `?tag=undefined`.
          //
          // The page still returned 200 with ten cards, correct titles, correct
          // dates and the right NUMBER of tag chips. It looked completely
          // normal. Caught only by comparing slugs and tag arrays before and
          // after, which is why that comparison is the gate here and not the
          // render.
```

### app/db/index.ts:294 (WHY, shortened)

trimmed.

```ts
// LEFT, so a post carrying no tags keeps its row with a null tag rather
        // than vanishing from the listing. An INNER JOIN here would drop it.
```

### app/db/index.ts:298 (WHY, shortened)

trimmed.

```ts
// Post order FIRST and completely, then tag order. Both post keys must
        // appear before the tag key or a tie lets tag slugs interleave rows
        // from different posts, which is exactly what happened.
```

### app/db/index.ts:305 (WHY, shortened)

trimmed.

```ts
// A COUNT(*) with no GROUP BY always returns exactly one row, so the zero
  // is unreachable. It is also the honest answer if the row ever went missing:
  // no rows counted.
```

### app/db/index.ts:310 (WHY, shortened)

trimmed.

```ts
// Fold the joined rows back into one entry per post, preserving both orders.
  // A Map keyed by id keeps first-seen post order, which the ORDER BY above
  // already fixed, and tags append in the slug order the same clause fixed.
```

### app/db/index.ts:335 (WHY, shortened)

2026-09-10 defect and ruling 57 story moved; hard rule citations kept.

```ts
/**
 * The home page's "Start here": the featured post, then the newest others.
 *
 * ## THE DEFECT THIS REPLACES, measured on production 2026-09-10
 *
 * Home called `listBlogPosts({ perPage: 4 })` and handed the page to
 * `splitFeatured`, which looks for `featured` INSIDE the rows it was given. The
 * only featured post is the flagship, which sorts fifth by `publish_at`, so
 * `featured` came back null and the whole section is behind
 * `{featured ? ... : null}`. The heading, four cards and the "All N posts" link
 * rendered NOTHING on the site's front door, and had done since the home
 * rebuild. A 200 with a correct page is what that looks like from outside.
 *
 * Ruling 57: the lead is FETCHED, not hoped for.
 *
 * ## `posts_featured_idx` ALREADY EXISTED FOR THIS
 *
 * `schema.ts` has carried an index on `(featured, publish_at)` since the column
 * landed, commented "Covers the home page's featured selection". Nothing ever
 * issued the query it covers. This is that query.
 *
 * ## WHAT HAPPENS WITH NO FEATURED POST
 *
 * The section shows the four newest, and the lead is simply the newest. That is
 * ruling 57's own instruction rather than a fallback invented here, and it is
 * not hard rule 13's substituted value: nothing on this page LABELS the lead as
 * featured (unlike `/blog`, which draws a "Featured" chip), so a reader is told
 * only "start here", which the newest post answers honestly. An empty corpus
 * still yields null and the section stays dark, which is the correct dark.
 *
 * ## ONE ROUND TRIP
 *
 * Three statements in one `db.batch`, on `listBlogPosts`'s grounds: none reads
 * what another writes. `total` rides along because home renders it twice, in
 * the proof tile and in the "All N posts" link, and a second call for one
 * integer was the other half of what this replaces.
 *
 * Every statement composes `isBlogPost()`, which composes `publiclyVisible()`.
 * Hard rule 1: a draft cannot lead the front page.
 */
```

### app/db/index.ts:383 (WHY, shortened)

trimmed.

```ts
/*
   * `cards` OTHERS, not `cards - 1`, and the extra row is what makes the
   * no-featured case work: it is the one promoted to lead. Asking for exactly
   * three would leave the section a card short on a corpus with nothing
   * featured, which is the state the plant for this ruling exercises.
   */
```

### app/db/index.ts:407 (WHY, shortened)

trimmed.

```ts
/*
   * THE DECISION IS `startHere`'s, not this function's. The SQL above supplies
   * the two ordered lists; which of them leads is a rule that `check:microformats`
   * has to reproduce offline with no database, so it lives in a pure module both
   * callers import. See its docblock for the two branches.
   */
```

### app/db/index.ts:418 (CONTRACT, shortened)

trimmed.

```ts
/**
 * Publication years with a post count, newest first.
 *
 * Drives the archive route. Computed in SQL rather than by pulling every post
 * and grouping in the loader, so the query cost does not grow with the corpus.
 */
```

### app/db/index.ts:445 (CONTRACT, shortened)

trimmed.

```ts
/**
 * Every series with at least one publicly visible post, with its count.
 *
 * THE TAG LIST'S SHAPE AND THE TAG LIST'S RULE. It composes `isBlogPost()`, so
 * a series carried only by drafts or by future-dated posts is absent here for
 * exactly the reason its archive answers 404 and the sitemap does not list it.
 * That is one predicate serving all three, not three that agree today.
 *
 * `series` is a column on `posts` rather than a table of its own, so this is a
 * GROUP BY where the tag list is a join. The set is tiny by construction: a
 * series is a handful of posts an author wrote on purpose.
 */
```

### app/db/index.ts:466 (WHY, shortened)

unasserted count moved.

```ts
/**
 * One series, by its URL slug, or null when nothing publicly visible carries it.
 *
 * RESOLVED BY SCANNING THE NAMES, because the slug is derived rather than
 * stored (see `series-path.mjs` for why). `listBlogSeries` is already the
 * visible set, so this inherits the visibility rule instead of restating it,
 * and the scan is over a handful of rows.
 *
 * AMBIGUITY IS REFUSED RATHER THAN GUESSED. Two names can slugify to one slug
 * ("Part One" and "part-one"), and picking either would make the archive show a
 * set the author never grouped. There are no series at all today, so this
 * guards a load of zero; it is here because the alternative is a silent wrong
 * answer the day somebody names a second series carelessly.
 */
```

### app/db/index.ts:488 (WHY, shortened)

trimmed.

```ts
/**
 * The posts in one series, as CARDS, oldest part first.
 *
 * NOT `listSeriesParts`, and the difference is what each caller pays for.
 * `listSeriesParts` returns three columns for the in-post navigation and is on
 * the hot post path; a card needs the description, the reading time and the
 * TAGS, which is a second query to fold. Widening the lean one would make every
 * post page pay a tag join for an archive's benefit.
 *
 * Ordered by `part` ascending, which is the order the author numbered them and
 * the order a reader reads them. Every other listing on the site is newest
 * first; a series is the one place that is wrong.
 */
```

### app/db/index.ts:558 (WHY, shortened)

trimmed.

```ts
// Neighbours are computed under the same visibility gate, so an unpublished
  // post can never be reached through a prev/next link.
```

### app/db/index.ts:582 (WHY, shortened)

visibility exemption kept, explanation cut.

```ts
/**
 * ONE DRAFT, by slug, for a preview link. Returns null for anything else.
 *
 * **This is the second read in this file that does not compose
 * `publiclyVisible()`, and it is the only one reachable without a session.** It
 * is therefore worth being exact about what it can and cannot hand back.
 *
 * `status = 'draft'` is not the absence of the visibility predicate, it is its
 * COMPLEMENT, narrowed. `publiclyVisible()` is `status = 'published' AND
 * (publish_at IS NULL OR publish_at <= now)`, so a scheduled post satisfies the
 * status half and fails the date half. This reads neither half loosely: a post
 * that is published, or scheduled, or archived, or absent, produces null. There
 * is no argument to this function that returns a row a reader could have got
 * some other way, and no argument that returns a row the author has not
 * explicitly held back.
 *
 * WHY IT IS SAFE TO CALL FROM A PUBLIC ROUTE. Reaching it requires a 32-byte
 * random token that the author minted for this exact slug, that has not been
 * revoked, and that has not expired. The token is checked BEFORE the slug is
 * known, because the slug comes out of the token's record rather than out of the
 * URL: there is no way to ask this function about a post you were not given a
 * link to.
 *
 * The route is `/preview/:token`, its headers carry no public branch, and its
 * 404 is byte-identical to the post route's, so a token that resolves to
 * nothing tells a caller nothing.
 *
 * Named in `VISIBILITY_EXEMPT` in `scripts/check-invariants.mjs` with this
 * reason, which is the only way a reader gets to skip the predicate.
 */
```

### app/db/index.ts:625 (WHY, shortened)

trimmed.

```ts
// NO NEIGHBOURS, and that is deliberate rather than an omission. `getBlogPost`
  // computes previous and next under the visibility gate; a draft has no place
  // in that sequence, and a preview offering links onward would invite a
  // reviewer to navigate out of the one page the link was for. Both are null,
  // which is a shape the component already renders every day: it is what the
  // oldest and newest posts carry.
```

### app/db/index.ts:639 (WHY, shortened)

exemption kept; old wording story moved.

```ts
/**
 * Every blog post for the admin list, drafts and future-dated included.
 *
 * One of two reads in this file that deliberately do NOT apply
 * publiclyVisible(). It is reachable only behind the admin middleware, and an
 * editor that could not see drafts would be useless. The other is
 * `getDraftPostForPreview`, which is reachable without a session and pays for
 * that with a much narrower predicate; the sentence here used to say "the one"
 * and went false the moment that landed.
 */
```

### app/db/index.ts:649 (WHY, shortened)

deleted-stub story moved; gate visibility, exemption and trash rules kept.

```ts
/**
 * THE TWO COUNTS THE ADMIN NAV CAN HONESTLY CARRY.
 *
 * The mockup badged four sections: Sites, Content, Posts and Media. **Two of
 * them no longer exist.**
 *
 * Both were stubs whose numbers were never real. `/admin/sites` rendered a
 * hardcoded array of six placeholder cards, every status "health check not
 * wired", so the only number available was that array's length.
 * `/admin/content` had `count: null` on all three of its sections, rendering
 * as the words "no data", and two of those sections (protocols, CV) described
 * content types this site does not have. Both were deleted rather than
 * finished, because a numeral in the sidebar is read as a measurement and
 * neither had measured anything.
 *
 * Posts and Media are real rows in D1, so they are real numbers.
 *
 * TWO QUERY-BUILDER READS, CONCURRENT, and deliberately NOT one hand-written
 * statement with two scalar subqueries. The single-statement version was
 * written first and was a real defect: invariants section 6 finds posts readers
 * by matching `.from(posts)`, so a count that reached the table from inside a
 * `sql` template was INVISIBLE to the chokepoint that exists to catch a public
 * read losing its visibility predicate. It would have passed the gate by not
 * being seen, which is this repo's most expensive failure class. One round trip
 * was not worth being unobservable; `Promise.all` gets most of it back anyway.
 *
 * NO `publiclyVisible()`, on purpose, and it is a NAMED EXEMPTION in
 * `check-invariants.mjs` for the same reason `listAllPostsForAdmin` is: this
 * badge counts what the admin can edit, so drafts and future-dated rows are the
 * point. It is reached only from the /admin layout, behind Better Auth.
 *
 * MEDIA EXCLUDES THE TRASH, through `notTrashed()` rather than a second spelling
 * of the same predicate, so this number and the one the media page's own head
 * prints cannot drift apart. Two counts of one library disagreeing by the size
 * of the bin is how somebody spends an afternoon looking for missing files.
 */
```

### app/db/index.ts:702 (WHY, shortened)

trimmed.

```ts
/*
       * SELECTED SO THE LIST CAN SAY WHICH ROW IS THE HERO.
       *
       * The public index promotes one featured post above the rest, and this
       * list, the only place an author sees the whole corpus, could not see
       * which one that was: the flag was editable nowhere and visible nowhere,
       * so the answer lived in twelve markdown files.
       */
```

### app/db/index.ts:717 (WHY, shortened)

artifact history moved.

```ts
/**
 * The corpus facts `withRelated` needs, drafts included, tags attached.
 *
 * Feeds `relatedFor` in publish.server.ts: relatedness is a property of the
 * whole corpus and the corpus lives HERE since the committed artifact left the
 * repository. Drafts are included because `withRelated` does its own draft
 * filtering of candidates while still computing a related list FOR a draft,
 * and pre-filtering here would silently change that half.
 */
```

### app/db/index.ts:733 (WHY, shortened)

trimmed.

```ts
// Carried so a saved post's related list can hold each neighbour's
      // description, the same field the build's `withRelated` reads. It takes
      // no part in scoring; see the comment at the map in pipeline.mjs.
```

### app/db/index.ts:749 (WHY, shortened)

artifact arc and boundary note moved; draft rule kept.

```ts
/**
 * What the media citation scan reads: every post's markdown and cover, drafts
 * included, because a draft citing an image must still refuse its deletion.
 *
 * D1 rather than the repository, since the artifact arc: `posts.body` is the
 * markdown both writers converge to. BOUNDARY, stated: a citation committed
 * from a clone is invisible here until the next sync, save, or content-drift
 * repair lands it, a window the scheduled health check bounds at its poll
 * interval. The committed-artifact read this replaces was ahead of D1 by the
 * same class of window in the other direction.
 */
```

### app/db/index.ts:772 (CONTRACT, shortened)

trimmed.

```ts
/**
 * The operator list_posts projection: every post row, drafts included, with
 * the fields the tool has always reported.
 */
```

### app/db/index.ts:817 (WHY, shortened)

trimmed.

```ts
/**
 * Every post's tags, DRAFTS INCLUDED, for the admin list's tag filter.
 *
 * Deliberately not `listBlogTags`, which filters through `isBlogPost()` and so
 * cannot see a draft's tags. Filtering the admin list by a tag that only drafts
 * carry has to return those drafts, or the filter would quietly disagree with
 * the list it is filtering.
 *
 * Returns one row per (post, tag) pair rather than a grouped string: SQLite's
 * `group_concat` would need raw sql and a delimiter that no tag may contain,
 * and at this corpus size grouping in the loader is clearer and costs nothing.
 */
```

### app/db/index.ts:839 (WHY, shortened)

trimmed.

```ts
/* ---- media annotations ---------------------------------------------------
 *
 * The table describes the IMAGE. It never stores citations, so nothing here can
 * be consulted to decide whether an object is safe to delete; that answer comes
 * from a live scan through the resolver seam every time.
 */
```

### app/db/index.ts:858 (WHY, shortened)

old narrower definition story moved.

```ts
/**
 * "Nothing the renderer emitted cites this", as ONE predicate with two readers.
 *
 * The filter and the chip's COUNT have to mean the same thing or the library
 * says "3 unused" and lists five. Written once here rather than twice, which is
 * the same rule the picker's `insertable` clause below is written under.
 *
 * **IT USED TO BE NARROWER THAN "UNUSED" AND THAT WAS THE WHOLE PROBLEM.** The
 * old comment here said an asset a route references in code "is uncited by this
 * definition and cited by no other one available", which was true and was the
 * reason nine cohort photographs sat in the Unattached lens while the site
 * served them on every visit.
 *
 * There is now a second definition available. `template-refs.json` is built by
 * scanning `app/` and `workers/` for the literal path, and the keys it names are
 * passed in here, so unattached means what it says: **no post cites it AND no
 * repository code references it.** The scan runs at build time because nothing
 * inside the Worker can read the repository; see `template-refs.mjs`.
 *
 * THE KEYS ARE A PARAMETER RATHER THAN A SECOND QUERY, because this predicate
 * has two readers, the listing and the lens count, and they have to mean the
 * same thing or the chip says three and the grid shows five. Passing one list to
 * both is what keeps that true.
 *
 * @param templateKeys keys repository code references, from the build artifact
 */
```

### app/db/index.ts:886 (WHY, shortened)

trimmed.

```ts
// An empty list is not "exclude nothing" in SQL: `NOT IN ()` is a syntax
  // error in SQLite, so the clause is omitted rather than emitted empty. That
  // is also the honest behaviour when the artifact is missing: everything falls
  // back to the old two-state answer rather than the query throwing.
```

### app/db/index.ts:894 (WHY, shortened)

trimmed.

```ts
/**
 * The library's free-text filter, over the four columns a human has words for.
 *
 * `original_name` is what they called the file, `key` is what they pasted into a
 * post, and `alt` and `caption` are the two sentences they wrote. Nothing else
 * on the row is language.
 *
 * `coalesce` on the nullable one, because `lower(NULL) LIKE ...` is NULL rather
 * than false, and a row with no original name would then drop out of an OR that
 * another column satisfies.
 */
```

### app/db/index.ts:914 (WHY, shortened)

unasserted counts moved; reconciliation prohibition kept.

```ts
/**
 * NOT IN THE TRASH. The predicate every ordinary library view composes.
 *
 * Written once with two readers, exactly as `uncited()` is and for the same
 * reason: the listing and the counts have to mean the same thing, or the chips
 * say seventy and the grid shows sixty-eight.
 *
 * **Deliberately NOT applied by the reconciliation readers.** `check:media`
 * compares rows against R2 and `public/` in both directions and the object is
 * untouched by trashing, so `listMediaRecords`, `mediaRecordsFor`,
 * `existingMediaKeys` and `mediaRecord` must all keep seeing trashed rows. If
 * they filtered, the gate would see an object with no row and back it straight
 * into the library, which is trash undone by a gate on the next reconcile.
 */
```

### app/db/index.ts:928 (NUMBER, shortened)

asserted by the constant below.

```ts
/**
 * What counts as a large file, from the mockup's own `BIG`.
 *
 * One mebibyte. Stated once so the lens, its count and its label cannot
 * disagree about the number, which is the shape the Unused chip failed in.
 */
```

### app/db/index.ts:940 (CONTRACT, shortened)

trimmed.

```ts
/**
 * The ORDER BY for a listing, minus the stable tie-break the caller appends.
 *
 * Extracted so the sort is one expression with one fallback rather than a
 * conditional chain inside the query builder. `usage` orders by the citation
 * count from `media_refs`, computed as a correlated subquery: it is the one
 * sort key that is not a column, and it is the one an author actually asks
 * ("what is nothing using?"), so it is worth the subquery at this row count.
 *
 * @param options the listing options, read for sort, dir and trashed
 */
```

### app/db/index.ts:952 (WHY, shortened)

trimmed.

```ts
// MOST RECENTLY TRASHED FIRST in the Trash view, whatever the sort says. What
  // an author wants back is almost always what they just threw away, and the
  // Display control is about the library rather than about the bin.
```

### app/db/index.ts:963 (WHY, shortened)

unasserted count moved.

```ts
// The NAME a human reads, falling back to the key for a static asset that
      // has none. Ordering by `original_name` alone would sort 58 NULLs into a
      // block, which is not "A to Z" by any reading.
```

### app/db/index.ts:983 (WHY, shortened)

ruling narrative and R2 comparison moved.

```ts
/**
 * One page of the library, newest first.
 *
 * **This is the query the whole index was ruled in to make possible.** Listing
 * from R2 could only ever paginate in KEY order, and once keys became content
 * addressed that order carried no meaning at all. Sort by date, filter to a
 * kind, count by storage: each is a query, and none of them can be built on a
 * key-ordered iterator without listing the entire bucket per request.
 *
 * `uploaded_at DESC, key ASC`. SQLite sorts NULL below every other value, so a
 * DESC ordering puts the static rows last, which is right: a build-time asset
 * has no upload event and NULL is the honest value for one. `key` breaks the tie
 * so the order within that block is stable rather than whatever the planner
 * returns, because an unstable sort makes offset pagination skip and repeat
 * rows.
 *
 * OFFSET pagination rather than a cursor. The row count here is dozens; offset's
 * cost is a scan the planner does anyway, and it buys a page NUMBER, which is
 * what a library UI wants and what an opaque R2 cursor could never provide.
 */
```

### app/db/index.ts:1014 (CONTRACT, shortened)

trimmed.

```ts
/**
     * A QUALITY LENS, which is a question a person actually has, as opposed to
     * `role`, which is the system's own classification.
     *
     * 'unattached' | 'duplicates' | 'no-alt' | 'large'. Anything else is no
     * filter, because a hand-edited URL should show a library.
     */
```

### app/db/index.ts:1022 (WHY, shortened)

trimmed.

```ts
/**
     * Keys repository code references, from `content/generated/template-refs.json`.
     *
     * A PARAMETER rather than something this module reads for itself, because
     * the artifact is a build-time import and `app/db` is imported by scripts
     * that have no bundler. The loader owns the import and hands the list down,
     * which also means the lens count and the listing are given the SAME list by
     * construction rather than by two reads agreeing.
     */
```

### app/db/index.ts:1036 (WHY, shortened)

trimmed.

```ts
/**
     * THE TRASH VIEW. The one caller that wants trashed rows and only those.
     *
     * A separate flag rather than a `role` value, because trash is orthogonal
     * to role: a trashed brand asset is still brand, and folding it into the
     * role chips would make the counts lie about what roles exist.
     */
```

### app/db/index.ts:1050 (WHY, shortened)

live-error story and unasserted count moved.

```ts
// THE PICKER FILTER, on `role` rather than on `storage`.
  //
  // The storage-based version was wrong and the error was live: it assumed
  // static+image meant content, and so offered the site logos, every favicon,
  // and BOTH HALVES of every rendered diagram. Picking one half of a diagram
  // pair inserts an image the theme switch cannot swap and bypasses the
  // `:::diagram` directive entirely, which is a broken post rather than noise.
  //
  // `kind='image'` stays alongside it because the two answer different
  // questions: the 31 PDFs are genuinely `role='content'`, they are simply not
  // images and this picker inserts images.
```

### app/db/index.ts:1066 (WHY, shortened)

trimmed.

```ts
/*
   * TRASH FIRST, and it is not optional in either direction.
   *
   * Every ordinary view excludes trashed rows and the Trash view includes only
   * those, so this is a branch rather than a conditional push: there is no
   * caller that legitimately wants both, and leaving the unfiltered case
   * reachable is how a trashed asset reappears in the picker.
   */
```

### app/db/index.ts:1077 (WHY, shortened)

trimmed.

```ts
// NOT EXISTS against media_refs, which is what the PIPELINE recorded. The
  // resolver scan is a second and more conservative opinion and cannot be
  // expressed here, so it still runs per page and the card's own usage line
  // remains the authority. This filter therefore means "nothing the renderer
  // emitted cites it", which is narrower than "unused" and is why the chip
  // carries that wording rather than a bare claim.
```

### app/db/index.ts:1084 (WHY, shortened)

trimmed.

```ts
// SEARCH IN SQL, and this is the one place the library deliberately diverges
  // from the posts list. That page filters an in-memory array of the whole
  // corpus; this one PAGINATES at 24, so a filter applied after the page was
  // fetched would search one page and report a total for another.
```

### app/db/index.ts:1089 (WHY, shortened)

trimmed.

```ts
/*
   * THE EXACT TAG FILTER, and the needle comes from `exactTagNeedle` rather
   * than being built here.
   *
   * The delimiter wrapping is the whole reason an exact match is possible with
   * LIKE, and a needle assembled at the call site is exactly how the two would
   * drift. A tag that normalises to nothing yields null, and null means NO
   * FILTER rather than a `%,,%` needle, which would match every tagged row.
   */
```

### app/db/index.ts:1103 (WHY, shortened)

trimmed.

```ts
/*
   * THE LENSES. Each is one predicate, and each answers a question somebody
   * asks out loud.
   *
   * `duplicates` is deliberately NOT here: exact content identity is computed
   * from the content-addressed key in JS by `mediaTwins`, not in SQL, so the
   * route filters that lens after the read. Putting a fake SQL predicate here
   * to keep the shape uniform would be a second definition of twin.
   */
```

### app/db/index.ts:1122 (HISTORY, deleted)

superseded narrative repeated by the next block.

```ts
// ROLE FIRST, then newest.
    //
    // `uploaded_at DESC` alone put every static row last, because a build-time
    // asset has no upload event and SQLite sorts NULL below everything. The
    // effect was backwards: the 12 generated cards you can neither insert nor
    // delete came first, and the 9 roster photos, the only insertable images in
    // the corpus, landed on pages 2 and 3.
    //
    // So content sorts first as a rank, and only then by date. A CASE rather
    // than a second column: the ordering is a property of this VIEW, not of the
    // asset, and storing a sort key would be storing a UI decision in the index.
```

### app/db/index.ts:1133 (WHY, shortened)

trimmed.

```ts
/*
     * THE SORT, chosen by the reader, with the role rank kept as the DEFAULT
     * rather than as a permanent prefix.
     *
     * The rank exists because `uploaded_at DESC` alone put every static row
     * last (a build-time asset has no upload event and SQLite sorts NULL below
     * everything), which buried the only insertable images on pages two and
     * three. That reasoning applies to the DEFAULT ordering and to nothing
     * else: a reader who asked for "largest first" wants the largest file, not
     * the largest content file followed by the largest brand file.
     *
     * So the rank rides along with `added` and is dropped for every explicit
     * sort. `key ASC` always breaks the tie, because an unstable sort makes
     * offset pagination skip and repeat rows, and that is true of every column
     * here: `bytes` and `uploaded_at` both have duplicates in this corpus.
     */
```

### app/db/index.ts:1153 (WHY, shortened)

trimmed.

```ts
// One extra row is fetched rather than running a second COUNT query: the only
  // question the UI asks is "is there another page", and a row that exists
  // answers it for the cost of one row.
```

### app/db/index.ts:1165 (WHY, shortened)

trimmed.

```ts
// Trashed rows are out, so this number and the grid agree. It is the
    // rebuild's report as well as the library's chips, and the rebuild's
    // question is "what does the library hold", not "how many rows exist".
```

### app/db/index.ts:1173 (WHY, shortened)

trimmed.

```ts
/**
 * The same rows, split by role.
 *
 * A SEPARATE query from `mediaCounts` because it answers a separate question.
 * The row count says whether a rebuild ran; this says whether `roleOf()` did
 * anything. Deriving role happens per row, after the row exists, so a rebuild
 * with a broken deriver still produces every row with the column default and the
 * two numbers disagree in a way that is only legible if both are shown.
 */
```

### app/db/index.ts:1186 (WHY, shortened)

trimmed.

```ts
// Trashed rows are out of every role count, which is what makes the chip
    // numbers add up to what the grid shows. A trashed brand asset is still
    // brand, so without this the Brand chip would count six and list five.
```

### app/db/index.ts:1194 (WHY, shortened)

trash-not-delete and refcount rule kept, explanation cut.

```ts
/**
 * TWINS: rows whose bytes are identical, found by CONTENT HASH ALONE.
 *
 * **EXACT IDENTITY ONLY, and this is a boundary rather than a first pass.** Two
 * rows are twins when the hash embedded in their keys is the same, which means
 * the bytes are the same. There is no perceptual comparison, no resize
 * detection, no similarity score, and none is coming: a "these look alike"
 * feature would put a judgement call in front of a delete button, and the whole
 * safety argument of this library is that deletion decisions are answerable
 * from facts.
 *
 * The hash is READ OFF THE KEY, never recomputed. Keys are content-addressed,
 * so the hash is already there; recomputing would mean reading every object out
 * of R2 to learn something the filename states.
 *
 * WHY THIS IS NOT A DUPLICATE-DELETION FEATURE. Two rows sharing bytes are two
 * separate objects at two separate public URLs, and either may be cited. The
 * page offers to TRASH one, which changes what the library shows and leaves
 * both URLs serving. Anything stronger runs through the ordinary guarded
 * delete, with its refcount refusal intact.
 *
 * Static rows are excluded: their keys are paths rather than hashes, so any
 * grouping over them would be grouping over the wrong string.
 */
```

### app/db/index.ts:1224 (HISTORY, deleted)

old regex defect story.

```ts
// The digest comes from the grammar's one reader in classify.mjs. The local
  // regex this replaces demanded a dot straight after the hex, so a raster key
  // carrying the dimension segment hashed to null and twin detection could not
  // see any uploaded raster.
```

### app/db/index.ts:1251 (WHY, shortened)

Unused chip story moved.

```ts
/**
 * Every lens count, in one query, for the chip row.
 *
 * ONE ROUND TRIP rather than four, and the counts share the predicates the
 * filters use, so a chip and the page it leads to cannot disagree. That
 * agreement is the property the Unused chip lost when its count came from the
 * role histogram while its filter came from `uncited()`.
 *
 * `duplicates` is absent and the caller adds it: twins are computed from the
 * key in JS, and inventing a SQL approximation here would be a second
 * definition of a rule that already has one.
 */
```

### app/db/index.ts:1267 (WHY, shortened)

divergence story moved.

```ts
/*
       * THROUGH `uncited()`, NOT A SECOND COPY OF ITS SQL.
       *
       * This restated the NOT EXISTS inline, which is precisely the shape the
       * predicate's own comment warns about: the chip counted one thing and the
       * filter selected another, and nothing could see them diverge. They did
       * diverge the moment the template scan landed, because widening the
       * predicate would have moved the filter and left the count behind. One
       * call, one definition, both readers.
       */
```

### app/db/index.ts:1291 (WHY, shortened)

trimmed.

```ts
/**
 * How many rows are in the trash. The Trash lens needs a number of its own.
 *
 * Deliberately NOT `mediaRoleCounts` with a `trashed` pseudo-role. Trash is
 * orthogonal to role, and inventing a role for it would make the role counts
 * describe something that is not a role.
 */
```

### app/db/index.ts:1306 (WHY, shortened)

trimmed.

```ts
/**
 * Moves an asset into the library's trash. R2 IS NOT TOUCHED.
 *
 * The object, its public URL and every published page citing it are unaffected;
 * this changes what the library shows and nothing else. Grounds are on the
 * column in `drizzle/0011_media_trash_tags.sql`.
 *
 * IDEMPOTENT BY GUARD rather than by overwrite: trashing an already-trashed row
 * leaves the ORIGINAL timestamp alone, because "when did this go in the trash"
 * must not be reset by a second click on a stale page. Returns whether a row
 * moved, so a bulk caller can report per key.
 */
```

### app/db/index.ts:1347 (WHY, shortened)

trimmed.

```ts
/**
 * Writes an asset's tags. The ONLY writer, so the storage form has one author.
 *
 * The caller hands over whatever the human typed; `serialiseTags` decides what
 * is stored. Passing a raw string through to the column here would be the
 * defect the delimiter rule exists to prevent, so this function does not accept
 * a pre-serialised value and there is no variant that does.
 */
```

### app/db/index.ts:1364 (WHY, shortened)

unasserted row count moved.

```ts
/**
 * Every tag in use, with a count, for the filter chips.
 *
 * Assembled in JS rather than in SQL, and the reason is the storage form: the
 * tags live in one delimited column, so counting them in SQLite would mean a
 * recursive CTE splitting a string. At seventy rows reading the column and
 * counting here is clearer and costs nothing measurable. Trashed rows are
 * excluded, so a tag that only trashed assets carry does not offer a chip that
 * leads to an empty grid.
 */
```

### app/db/index.ts:1390 (CONTRACT, shortened)

trimmed.

```ts
/**
 * One row by key, for the detail view.
 *
 * A separate read rather than a search through the current page: the detail
 * view is reachable by URL, so the row it names may be on any page or on none,
 * and finding it in `objects` would make a bookmarked link work only from the
 * page it was copied on.
 */
```

### app/db/index.ts:1403 (WHY, shortened)

trimmed.

```ts
/**
 * Writes the DERIVED half of a row and leaves the AUTHORED half alone.
 *
 * This is the whole reason a rebuild is not `DELETE` then `INSERT`. Hash, mime,
 * bytes, dimensions and the placeholder are recomputable from the object; alt,
 * caption, focal_x and focal_y are recoverable from NOTHING, and are the only
 * media data in this system that can be permanently lost. A rebuild that
 * reinserted rows would silently destroy every alt text on the site, and would
 * look exactly like a successful rebuild while doing it.
 *
 * So the conflict clause names the derived columns EXPLICITLY and never spreads
 * the caller's object. A column added later is then absent from this list and
 * simply not updated, which is the safe failure; spreading would have made the
 * unsafe direction the default.
 *
 * TWO OF THE DERIVED COLUMNS ARE WRITE-WHEN-PRESENT rather than write-always,
 * `original_name` and `placeholder`, and each earned it the same way: a caller
 * that could not measure the value was blanking one a caller that could had
 * already stored. Recomputable does not mean cheap to recompute, and "leave it
 * alone" is the only answer that is right for both callers.
 */
```

### app/db/index.ts:1464 (WHY, shortened)

queue consumer story moved.

```ts
// WRITTEN WHEN THERE IS ONE, NEVER BLANKED. Same rule as the filename
        // below, and it was found the same way.
        //
        // The queue consumer upserts on every R2 event and passed no
        // placeholder, so `?? null` wrote NULL over whatever the last rebuild
        // had derived: an upload erased its own placeholder moments after the
        // bulk pass computed one, and the only way back was another bulk pass.
        // The consumer now derives one itself, which makes the common case
        // correct, and this makes the CLASS correct: any caller that cannot
        // measure a placeholder leaves the stored one alone rather than
        // destroying it.
        //
        // The cost, taken knowingly: a placeholder cannot be CLEARED through
        // this door. Nothing wants to. It is recomputable from the object, an
        // object is content-addressed and immutable, and a static file that
        // changes shape keeps a stale placeholder only until the next rebuild
        // overwrites it with a real one.
```

### app/db/index.ts:1482 (WHY, shortened)

race story moved.

```ts
// WRITTEN WHEN THERE IS ONE, NEVER BLANKED.
        //
        // The comment here used to say this column was the only surviving copy
        // of the filename and so must only ever be set on INSERT. That was true
        // and it was the bug: the queue consumer inserts from an R2 event, and
        // if it won the race it inserted NULL and nothing could ever fill it,
        // because a content-addressed key carries no name and the upload
        // route's D1 write is deliberately non-fatal.
        //
        // The name now rides in the object's custom metadata, so callers that
        // read the object can supply it and this can safely update. Callers
        // that cannot (a static asset has no metadata) pass null, and null
        // means LEAVE IT ALONE rather than erase, which is what keeps a name
        // already recorded from being lost by a later pass that did not see one.
```

### app/db/index.ts:1501 (CONTRACT, shortened)

trimmed.

```ts
/**
 * Creates or updates the annotation for one object.
 *
 * Upsert on the key, because the row may not exist: an object uploaded before
 * this table shipped has none until a backfill or an edit creates one, and the
 * editing path should not have to care which case it is in.
 */
```

### app/db/index.ts:1564 (WHY, shortened)

trimmed.

```ts
/**
 * Drops the row.
 *
 * Called when the OBJECT is already gone, never as a way of making it go. The
 * conflict rule runs one way only: R2 wins, so a row is deleted because an
 * object is absent, and an object is never deleted because a row is.
 */
```

### app/db/index.ts:1575 (WHY, shortened)

finding id and r2_key incident moved; atomicity, order and query-builder rules kept.

```ts
/**
 * Claims a media key for deletion, atomically, and says whether it won.
 *
 * Finding B009: the delete action read the citations, found none, and then
 * deleted the blob. Between those two steps a concurrent save can insert a
 * `media_refs` row, and the object is removed anyway, leaving the post that
 * just cited it rendering a broken image.
 *
 * This makes the decisive step ONE statement, so the "is it still unreferenced"
 * test and the row removal cannot be separated by anything: D1 executes a
 * single statement atomically, and `NOT EXISTS` is evaluated inside it. A
 * return of false means either the key was already gone or something cited it,
 * and the caller must refuse either way.
 *
 * Deleting the ROW is what claims the key, and it deliberately runs BEFORE the
 * object. The module's conflict rule is that R2 wins, so the failure mode of
 * stopping here is a surviving object with no row, which the next rebuild
 * backfills; the reverse order would leave a row pointing at nothing, which is
 * the direction `check:media` treats as the error.
 *
 * **Built through the query builder, so every table and column name comes from
 * the schema rather than from a string.** The first version of this was raw SQL
 * and named the primary key `r2_key`, which is what `0007_media.sql` creates and
 * NOT what the table has: `0009_media_index.sql` renames it to `key`, because
 * the column stopped holding only R2 keys once static assets were indexed in
 * place. The statement was therefore guaranteed to throw on the one path it
 * exists to protect, and nothing caught it, because no gate and no typecheck
 * reads a SQL string. Reading the migration that CREATES a table is not reading
 * the schema; the migration that last touched it is what counts, and
 * `app/db/schema.ts` is what both agree on.
 *
 * `RETURNING` rather than a rowcount so the outcome is a row this code can see,
 * which does not depend on how a driver reports `changes`.
 */
```

### app/db/index.ts:1628 (WHY, shortened)

fail-open story moved.

```ts
/* ---- media_refs: who cites what --------------------------------------------
 *
 * Written by the PIPELINE at render time, never by a scan. That is what closes
 * the fail-open: a content type whose resolver was never registered used to
 * return no citations, `resolveCitations` reported complete, and the library
 * showed "Unused" beside a working Delete button. Absence is not failure.
 * Anything that goes through the renderer is indexed by construction.
 */
```

### app/db/index.ts:1649 (WHY, shortened)

trimmed.

```ts
/**
 * The columns both feeds carry, minus the body.
 *
 * ONE OWNER, because the two feeds differ in exactly one column and a second
 * hand-kept list is how they start differing in more. The id rides along for
 * the tag join and is stripped before either feed sees a row.
 */
```

### app/db/index.ts:1666 (WHY, shortened)

trimmed.

```ts
/**
 * Every visible post with its markdown body, newest first.
 *
 * Two readers: llms-full.txt takes the whole corpus, and the JSON feed takes
 * the newest `perPage`. The limit is applied IN THE QUERY, not by slicing a
 * full read, because the body column is the heavy one and a feed of 20 must
 * not pay for a corpus of hundreds.
 *
 * The card columns (description, updatedAt, coverImage) ride along for the
 * feed. llms-full.txt ignores them, which costs three narrow columns on a read
 * that already carries every body.
 *
 */
```

### app/db/index.ts:1690 (WHY, shortened)

trimmed.

```ts
/*
   * `tag` and `series` NARROW THE SAME QUERY rather than filtering a full read
   * afterwards. An archive's feed must be that archive's list, and slicing
   * after the fact would cap at `perPage` BEFORE narrowing, so a tag or series
   * whose posts sit outside the newest twenty would feed empty while its page
   * showed them.
   */
```

### app/db/index.ts:1701 (WHY, shortened)

trimmed.

```ts
/*
   * BY PART FOR A SERIES, which is the one ordering on this site that is not
   * newest first. A series is numbered by its author and read from part one, so
   * its feed hands a subscriber part one first; every other feed is a blog and
   * is reverse chronological. `id` breaks a tie so two parts sharing a number
   * cannot come back in an order the database chose.
   */
```

### app/db/index.ts:1721 (WHY, shortened)

trimmed.

```ts
/**
 * The same posts with the RENDERED body instead of the markdown one, for RSS.
 *
 * A SIBLING RATHER THAN A FLAG, and the reason is the return type. A single
 * function selecting `html` conditionally returns a union, so every caller has
 * to narrow a column it explicitly asked for, and the compiler cannot tell the
 * one that asked from the one that did not. Two functions over one shared
 * column set and one shared predicate say the same thing without that.
 *
 * NOT one function selecting both, either. `llms-full.txt` reads the WHOLE
 * corpus through `listBlogPostsFullText` and ignores `html`; carrying it would
 * put a second full copy of every post on that read to serve nobody.
 *
 * Composes `isBlogPost()`, so the feed is visible on exactly the terms the
 * index is.
 */
```

### app/db/index.ts:1748 (WHY, shortened)

duplicate of the full-text reader.

```ts
/*
   * `tag` and `series` NARROW THE SAME QUERY rather than filtering a full read
   * afterwards. An archive's feed must be that archive's list, and slicing
   * after the fact would cap at `perPage` BEFORE narrowing, so a tag or series
   * whose posts sit outside the newest twenty would feed empty while its page
   * showed them.
   */
```

### app/db/index.ts:1759 (WHY, shortened)

duplicate of the full-text reader.

```ts
/*
   * BY PART FOR A SERIES, which is the one ordering on this site that is not
   * newest first. A series is numbered by its author and read from part one, so
   * its feed hands a subscriber part one first; every other feed is a blog and
   * is reverse chronological. `id` breaks a tie so two parts sharing a number
   * cannot come back in an order the database chose.
   */
```

### app/db/index.ts:1798 (WHY, shortened)

item id and gate explanation trimmed.

```ts
/* Webmentions ---------------------------------------------------------------
 *
 * The received-mention queue, item H1. These sit in the chokepoint file with
 * every other reader for one reason: it is where a person looks to find out
 * what this site asks its database. Section 6 of `check:invariants` polices
 * `posts` readers and knows nothing about this table, so nothing here is
 * enforced by that gate; the placement is a convention and the visibility rule
 * is enforced somewhere else, at the one place it applies. `webmentionTarget`
 * below is that place, and it composes `publiclyVisible()` through
 * `isBlogPost()`.
 */
```

### app/db/index.ts:1810 (WHY, shortened)

trimmed.

```ts
/**
 * The statuses the global cap counts: a mention that is still open.
 *
 * Stated once and read by both the counter and the retention sweep, because
 * "open" is a claim about which states are unfinished, and two spellings of it
 * would let the cap and the sweep disagree about what they are bounding.
 */
```

### app/db/index.ts:1819 (WHY, shortened)

trimmed.

```ts
/**
 * Does this slug name a post a stranger is allowed to mention?
 *
 * COMPOSES `publiclyVisible()` through `isBlogPost()`, which is the whole point
 * of the function existing rather than the route reading `posts` itself. Hard
 * rule 1's chokepoint is this file, and a draft or scheduled post must not be a
 * valid webmention target: accepting one would let a sender confirm that an
 * unpublished slug exists by watching which answer they got.
 *
 * Returns a BOOLEAN and never the row, so nothing about the post can escape
 * through the endpoint's answer even by accident.
 */
```

### app/db/index.ts:1840 (WHY, shortened)

trimmed.

```ts
/**
 * How many mentions are still open. The FOURTH bound, measured rather than
 * assumed: the endpoint refuses at the ceiling instead of trusting that the
 * other three bounds add up to one.
 */
```

### app/db/index.ts:1853 (WHY, shortened)

trimmed.

```ts
/**
 * Write or reset the row for one (source, target). Returns its id.
 *
 * A RE-SENT MENTION RESETS RATHER THAN DUPLICATING, which is the third bound.
 * The decision fields go back to null with it: a sender who edits their page
 * after a rejection is making a new claim, and leaving `decided_at` in place
 * would show the admin a rejected row whose evidence had changed underneath the
 * decision.
 *
 * `received_at` is stamped explicitly on the update arm because the column
 * default only applies to an insert, and a mention re-sent a year later is
 * received now.
 */
```

### app/db/index.ts:1893 (WHY, shortened)

trimmed; hard rule 13 kept.

```ts
/*
   * The upsert always writes exactly one row, so the fallback is unreachable.
   * ZERO IS NOT SUBSTITUTED: it would be a valid-looking rowid naming nothing,
   * which is hard rule 13's shape. A negative id cannot be a rowid, so a caller
   * that ever received one would fail on its next statement rather than quietly
   * updating the wrong row.
   */
```

### app/db/index.ts:1913 (WHY, shortened)

trimmed.

```ts
/**
 * Record what the verifier found.
 *
 * SCOPED TO A ROW STILL IN `unverified`. Verification runs in `waitUntil`, so a
 * second POST for the same (source, target) can reset the row while the first
 * fetch is in flight; without this clause the older fetch's verdict would land
 * on the newer row, and the newer fetch would then write on top of a state it
 * never observed. The write that loses is the stale one, which is the correct
 * direction.
 */
```

### app/db/index.ts:1951 (WHY, shortened)

gate investigation narrative moved; both hard rule 1 citations kept.

```ts
/**
 * The APPROVED mentions for one post, for the public render. Item H2.
 *
 * ## IT COMPOSES `publiclyVisible()` EVEN THOUGH NOTHING MADE IT
 *
 * The caller resolves the post through `getBlogPost` first, which composes the
 * predicate, and 404s before reaching this. So the slug handed in is already a
 * publicly visible post's, and a positional argument like that is a real
 * guarantee for exactly as long as the two calls stay in that order.
 *
 * That is the whole problem with it. Hard rule 1 is not "a draft's mentions are
 * unreachable today", it is that every public object derived from a post goes
 * through the predicate, and `check:invariants` sections 6 and 8 were both
 * checked before this was written: section 6 scans for `.from(<posts binding>)`
 * and section 8 knows only `search_docs`, so a read of `webmentions` alone is
 * invisible to both. Neither gate asked for anything.
 *
 * The EXISTS clause below is what makes them ask. It puts a `.from(posts)` in
 * this function, which brings it inside section 6's scan, and section 6 then
 * requires the predicate here forever. A positional guarantee became a gated
 * one for the price of a subquery, which is the trade hard rule 1's second
 * paragraph is describing.
 *
 * **It is not redundant even today.** A row can name a draft: `/admin/mentions`
 * cannot create one, but nothing stops a hand-written row, and H1's endpoint
 * refuses a draft target only at the moment of receipt. A post unpublished
 * AFTER its mentions were approved is the ordinary case, and without this
 * clause the only thing standing between those rows and a reader would be the
 * route's own 404.
 *
 * Ordered by `decided_at` descending: the newest judgement first, which is the
 * order the admin made them in and the order a reader meets them.
 */
```

### app/db/index.ts:2011 (CONTRACT, shortened)

trimmed.

```ts
/**
 * Every mention, for the moderation queue.
 *
 * UNFILTERED, and that is what the page is for: an admin moderating a queue has
 * to see what is in it, failures included. Reached only from `/admin/mentions`,
 * behind the admin layout's middleware.
 *
 * Ordered newest first WITHIN a status; the page does the grouping, because the
 * order the four groups are shown in is a presentation decision and SQLite has
 * no ordering over the status values that would express it.
 */
```

### app/db/index.ts:2026 (WHY, shortened)

trimmed.

```ts
/**
 * The statuses a decision may be made from: a mention whose evidence has been
 * checked. `unverified` has no evidence yet and `failed` has evidence against
 * it, so neither is a thing to approve, and a `where` clause says so rather
 * than the page's button layout saying it.
 */
```

### app/db/index.ts:2034 (WHY, shortened)

trimmed.

```ts
/**
 * Approve or reject one mention.
 *
 * A DECISION IS REVERSIBLE, which is why `approved` and `rejected` are in the
 * decidable set alongside `pending` rather than only `pending` being there. An
 * approve that could not be undone by a reject would be a one-way door on a
 * page whose whole job is judging strangers' claims, and `check:destructive`
 * would be right to call it destructive. It is not: no column is removed, the
 * row keeps its evidence, and the inverse button is on the same row.
 */
```

### app/db/index.ts:2050 (WHY, shortened)

trimmed.

```ts
/*
   * IT RETURNS THE TARGET SLUG, and that is for the cache purge rather than for
   * the caller's convenience. The page that changed is that post's, and
   * `purgePost` needs to name it. Returning it from the write is the only way
   * to be sure the purge names the row the write actually moved: a separate
   * read could answer about a row this statement's `where` refused.
   *
   * NULL when nothing was updated, which is the unverified and failed cases the
   * clause exists to refuse. A null purges nothing, correctly.
   */
```

### app/db/index.ts:2073 (WHY, shortened)

trimmed.

```ts
/**
 * How many rows the sweep WOULD remove right now, by window.
 *
 * Exists so the confirmation step can state the quantity at stake instead of
 * asking an operator to authorise an unknown number. Same predicates as
 * `sweepWebmentions`, which is the property that makes the number honest; a
 * count computed a different way would be a second answer to the same question.
 */
```

### app/db/index.ts:2111 (WHY, shortened)

trimmed.

```ts
/**
 * The retention sweep. Grounds for both windows: app/lib/webmention/retention.mjs.
 *
 * TWO STATEMENTS RATHER THAN ONE WITH AN `OR`, because the two windows are
 * different lengths and a single predicate would have to carry both cutoffs
 * anyway. Two also lets the caller report which window removed what, which is
 * the only part the admin can act on.
 *
 * `unverified` and `pending` are untouched at any age, deliberately: they are
 * exactly what the global cap counts, so expiring them would quietly raise the
 * cap.
 */
```

## scripts/ship.mjs

### scripts/ship.mjs:1 (CONTRACT, shortened)

usage, ordering rules and fail-closed contract kept; incident and prompt history moved.

```js
/**
 * One command that ships: gates, deploy, prove it, sync.
 *
 *   npm run ship
 *
 * OBSERVATION BOUNDARY: this runs the steps and reads their output. It does not
 * know whether a gate is meaningful, and it proves the deploy by POLLING rather
 * than by inspecting the built bundle, so a build that succeeded and shipped the
 * wrong thing looks identical here. Proving WHICH build answered is
 * `verify-live`'s job and is deliberately not folded in: it bills money per Ask
 * probe and must stay a decision, not a side effect.
 *
 * ## THE TWO ORDERING RULES, AND WHY THIS FILE IS NOW WHERE THEY LIVE
 *
 * Both were carried in session prompts six times before this existed. A rule
 * that survives only because someone remembers to type it is not a rule, and
 * the cost of getting either wrong is paid by readers rather than by the person
 * shipping.
 *
 * **1. DEPLOY BEFORE SYNC.** `sync:content --remote` writes the corpus and
 * `llms.txt` into D1, and `llms.txt` advertises URLs. Sync first and the index
 * plus the machine-readable manifest describe pages the running Worker does not
 * serve yet, so every agent that reads `llms.txt` in that window gets a 404 on
 * a URL the site told it to fetch. Deploying first means the worst case is a
 * page that exists and is not yet indexed, which is invisible.
 *
 * **2. `check:content` BEFORE SYNC, EXPLICITLY.** `sync-content.mjs` RUNS NO
 * GATE. Its own header says so in capitals, and it says so because it once
 * implied the opposite. It is the largest write path into production D1 in the
 * repo, and it will happily push a stale or hand-edited artifact. The gate is
 * three seconds; the failure is a corpus that disagrees with the repo and is
 * only found by a byte comparison nobody runs until the next build.
 *
 * ## FAIL CLOSED AT EVERY STEP
 *
 * A dirty tree refuses before building. A red gate refuses to deploy. A failed
 * poll refuses to sync. Each refusal names the step and what to do.
 *
 * The dirty-tree refusal is the one that has actually been needed. **`npm run
 * deploy` builds from the WORKING TREE, not from HEAD**, so a deploy with
 * uncommitted files ships code that exists on no commit and that no clone can
 * reproduce. That happened on 2026-08-07 and ran in production for two days
 * before anyone noticed, because every instrument in the repo reported health.
 *
 * ## A SHIP THAT CANNOT PROVE WHAT IT SHIPPED DID NOT SHIP
 *
 * The Version ID and the sync line are both parsed out of the real output and
 * printed at the end. If either is missing this exits nonzero even when every
 * command succeeded, because "it seemed to work" is not a deploy record.
 */
```

### scripts/ship.mjs:91 (WHY, shortened)

gitignore reasons shortened.

```js
/**
 * Where the transcript goes. GITIGNORED, and `.gitignore` carries the two
 * independent reasons: ship refuses a dirty tree, so an untracked log it wrote
 * itself would make the next ship refuse because of the last one; and the log
 * carries the account-scoped ids wrangler prints in its binding table.
 */
```

### scripts/ship.mjs:99 (WHY, shortened)

age-not-count reason kept in one line.

```js
/**
 * PRUNED BY AGE, NEVER BY COUNT.
 *
 * A count is only a duration if the write rate is fixed, and ship's is not: a
 * bad afternoon writes a dozen runs and a quiet fortnight writes none, so
 * "keep the last twenty" is two weeks in one case and one afternoon in the
 * other, and it is the afternoon that deletes the log somebody wanted. Fourteen
 * days is long enough that a Monday can still read the previous Monday's
 * refusal.
 */
```

### scripts/ship.mjs:111 (CONTRACT, shortened)

re-exec mechanism and boundary kept; origin story moved.

```js
/**
 * Ship writes its own transcript, every run, pass or fail.
 *
 * ## WHY THIS IS A RE-EXEC AND NOT A WRAPPER AROUND `console`
 *
 * Almost everything a person needs from a failed ship is printed by a CHILD
 * rather than by this file: the gate tier, the build, wrangler. `run()` hands
 * those children `stdio: "inherit"` so their output streams live, which means
 * this process never sees the bytes and cannot write them anywhere. Capturing
 * them instead would buy the log at the price of a seven-minute silence during
 * the gate tier, which is the span somebody is most likely to be watching.
 *
 * So the first invocation re-execs itself with stdout and stderr piped, and
 * forwards every chunk to the real stream AND to the file as it arrives.
 * Liveness survives because the forwarding streams; grandchildren are captured
 * because they inherit the pipe rather than the terminal.
 *
 * ## WHY IT HAD TO EXIST
 *
 * The evidence survived only when whoever ran ship remembered to pipe it. Three
 * sessions running diagnosed a refusal out of a log that existed by luck, and
 * one of those refusals named a gate whose failing test name had already been
 * thrown away upstream. A record that depends on being remembered is not a
 * record, and this is the same argument the two ordering rules above make about
 * rules carried in session prompts.
 *
 * ## THE BOUNDARY
 *
 * It records what ship and its children PRINTED. It is not a deploy record and
 * proves nothing about the running Worker; that is still `verify-live`'s job.
 * And a parent killed by the host may leave the child running, which the signal
 * forwarding below reduces and does not eliminate: a killed ship was always
 * able to leave work in flight, and this does not change that either way.
 *
 * @returns {Promise<number>} the child's exit code
 */
```

### scripts/ship.mjs:196 (WHY, shortened)

placement reason shortened.

```js
/*
   * THE PATH IS THE LAST THING PRINTED ON A FAILURE, deliberately after every
   * refusal message. A reader scrolling back from the bottom of a red run finds
   * the transcript before they find anything else, which is the one moment they
   * need it. On success it is not printed: a green ship already said what it
   * did, and a line nobody needs at the end of every good run is how people
   * learn to stop reading the end of the run.
   */
```

### scripts/ship.mjs:217 (WHY, shortened)

import-not-literal reason kept; history moved.

```js
/*
 * THE ORIGIN, IMPORTED rather than restated.
 *
 * It was a literal here and a literal in `app/lib/seo.ts`, and this is the
 * script that polls the deploy it just made: the copy that goes stale is the
 * one that then polls the wrong host and reports a healthy site nobody is
 * looking at. `check:llms` and `check:invariants` both already read the value
 * out of seo.ts to hold other documents to it; this one can simply import it,
 * because Node strips the types and the module has no bindings to resolve.
 *
 * At the DNS cutover this follows seo.ts by construction. Rule 17.
 */
```

### scripts/ship.mjs:234 (WHY, shortened)

gate binding kept.

```js
/**
 * What ship asks whether the deploy is READY, as opposed to merely answering.
 *
 * A named constant rather than an inline path, so the plant that proves this
 * step can fail has one place to point somewhere else. `check:policy` asserts
 * that it is this endpoint and that the step runs between the deploy and the
 * sync, so pointing it elsewhere permanently is a failing gate rather than a
 * quiet downgrade.
 */
```

### scripts/ship.mjs:254 (CONTRACT, shortened)

trimmed.

```js
/**
 * Refuse, loudly, naming the step and the remedy. Never a bare exit.
 *
 * Declared `never` because it genuinely never returns: it exits the process.
 * Saying so lets a caller narrow a value it has just refused on, instead of
 * casting around a check that has already happened.
 *
 * @param {string} why @param {string} remedy
 * @returns {never}
 */
```

### scripts/ship.mjs:288 (WHY, shortened)

token-before-build rule and secrecy kept.

```js
/*
 * THE OPERATOR TOKEN IS CHECKED BEFORE ANYTHING DEPLOYS, and the split is
 * deliberate.
 *
 * Step 10 calls the operator API to bring the Ask index into step, because
 * `sync:content` rebuilds D1 and both FTS indexes and does not touch AI Search.
 * A CONFIGURATION problem is not the same as a failed call: missing the token
 * is fixable in a second and should not cost a deploy, so it refuses here,
 * before the build. A call that FAILS after the deploy is a different thing and
 * is handled where it happens, loudly, with the deploy left standing.
 *
 * Sourced the way `operator-roundtrip.mjs` already sources it: a path in
 * OPERATOR_TOKEN_FILE pointing at a file holding the token. The token itself is
 * never an argument, never an environment value that a child process inherits
 * by name, and never printed. The length floor is the one `auth.server.ts`
 * enforces, so a truncated file is refused here rather than 401ing after a
 * deploy.
 */
```

### scripts/ship.mjs:334 (WHY, shortened)

pull and orphan prohibitions kept; 2026-09-10 incident moved.

```js
/*
 * PULL FIRST, AND REFUSE IF ANYTHING IS STILL RUNNING.
 *
 * Two failures, both measured, both cheap to prevent and expensive to find:
 *
 *   THE PULL. Ship deploys LOCAL HEAD. A seat-side commit this clone does not
 *   have is a deploy of code nobody asked for, and the `ship` skill has said
 *   "git pull --ff-only" as its step 1 since it was written, which means it was
 *   a human's job to remember. `--ff-only` and never a merge: a merge commit
 *   created here would be a commit CI has never seen, and the CI gate three
 *   steps down would then refuse the very thing this step just made.
 *
 *   THE ORPHANS. On 2026-09-10 ship failed with EBUSY on build/client because
 *   `vite preview --port 4173` processes, orphaned by killed `check:all` runs,
 *   still held the directory. `check:all`'s preflight reaper only knows runs it
 *   recorded, and a killed run records nothing. A live `check:all` or
 *   `check:browser` is the same hazard from the other end: it rewrites
 *   build/client under a ship that is reading it.
 *
 * BY COMMAND LINE, BY PID, NEVER BY NAME. Every one of these is `node` or a
 * child of it, so a name match would refuse on this ship's own process and on
 * every unrelated editor. `readProcessTable` supplies the command line, and a
 * process it cannot read a command line for can never satisfy a needle, which
 * is the fail-closed direction: it is left alone rather than killed.
 *
 * REPORTED AND REFUSED, NEVER KILLED. Ship does not know whose run that is.
 */
```

### scripts/ship.mjs:391 (WHY, shortened)

needle owner kept.

```js
/*
   * THE NEEDLES LIVE IN `child-processes.mjs`, not here, so the test can import
   * the list ship actually uses rather than a copy of it. `normaliseCommand`
   * lower-cases and turns every backslash into a forward slash, so one needle
   * matches on both platforms without a second spelling.
   */
```

### scripts/ship.mjs:399 (WHY, shortened)

shortened.

```js
/*
     * CANNOT VERIFY IS NOT CLEAR. The listing failed, so this step proved
     * nothing; said out loud rather than passed over, because a silent skip
     * here is the "zero from a search over an empty scope" shape.
     */
```

### scripts/ship.mjs:423 (WHY, shortened)

shortened.

```js
/*
 * A SECOND DIRTY CHECK, AFTER THE PULL RATHER THAN INSTEAD OF IT. Step 0
 * refuses a dirty tree so the fast-forward is safe to attempt; this one is
 * about what will be BUILT, and the pull between them can fail in ways that
 * leave files behind. Two cheap `git status` calls are worth less than one
 * unreproducible deploy.
 */
```

### scripts/ship.mjs:450 (WHY, shortened)

full-sha trap kept.

```js
// The FULL sha as well: `actions/runs?head_sha=` matches on the 40-character
// form and returns an empty list for an abbreviated one, which would read as
// "no CI run for this commit" on every ship.
```

### scripts/ship.mjs:457 (HISTORY, deleted)

deleted-step narrative.

```js
/*
 * STEP 1b, THE STATED-ABSENCE PLACEHOLDER CHECK, WAS DELETED 2026-08-21.
 *
 * It iterated `const PLACEHOLDERS = []` and printed "no stated-absence
 * placeholders are declared, so nothing was checked here." It had carried
 * exactly one entry, `CACHE_SENTENCE_PENDING_PROBE`, and that entry was
 * resolved on 2026-08-14. It was kept as a mechanism for the next one.
 *
 * **A dead loop kept for a hypothetical successor is not a mechanism, it is a
 * shape.** Re-adding it when a second stated absence appears is six lines and a
 * comment, and writing those six lines with a real subject in hand produces a
 * better check than reviving a generalisation drawn from one case.
 *
 * The property it guarded is NOT lost. `check:admin-ui` asserts both halves on
 * the rendered page: the measured answer is present, and the placeholder
 * wording is gone. That is the assertion with teeth, because it reads the
 * product rather than a list somebody has to remember to add to.
 */
```

### scripts/ship.mjs:478 (WHY, shortened)

path-not-deploy safety argument kept; ruling narrative and timings moved.

```js
/*
 * **RULING 52, 2026-09-09 (Dustin). SHIP TRUSTS CI.**
 *
 * CI already runs the offline tier on a clean checkout of this exact sha, on a
 * machine that has never seen this repo. When it concluded success there, the
 * local build-for-gates and the local offline tier are a second opinion about a
 * question already answered, and they are the expensive half of a ship: about
 * twelve minutes falls to about four, and the local memory peak that killed
 * five `check:all` runs goes with it.
 *
 * ## THIS READ DECIDES A PATH. IT NEVER DECIDES A DEPLOY.
 *
 * That separation is the whole safety argument and it is worth stating plainly.
 * The verdict here chooses between the fast path and the local path, and
 * NOTHING ELSE: a non-green answer, of any kind, takes the local path rather
 * than refusing. The authoritative check is the unchanged step below, which
 * runs on EVERY path and refuses on anything but success. So the worst this
 * read can do when it is wrong is make ship do MORE work, never less.
 *
 * ## WHY THE SECOND READ IS NOT REDUNDANT WITH THIS ONE
 *
 * Because a pending run is the common case, not an edge. Push, run ship, and CI
 * is still in flight: this read says "not green yet", ship runs the local build
 * and tier for ten minutes, and by the time the step below reads again the run
 * has concluded. The two reads are minutes apart on purpose, and the later one
 * is the one with teeth. A run that was FAILED here and re-run to green in the
 * meantime is caught by the same mechanism, in the same direction.
 *
 * ## WHAT IS NOT SKIPPED, AND WHY IT CANNOT BE
 *
 * `build:stack` and `build:enhance` run on BOTH paths. They write gitignored
 * files that `react-router build` imports statically, so the deploy's own build
 * fails on a missing file without them. They are not part of the gate tier's
 * cost; they are preconditions of building at all.
 *
 * ## OBSERVATION BOUNDARY, INHERITED
 *
 * Unchanged from the step below and restated because this read now has a
 * consequence of its own: it reads GitHub's view of a sha. It cannot see
 * whether CI's assertions are meaningful, nor whether the workflow was edited
 * to assert nothing in the same commit. A green CI on a commit that gutted CI
 * would skip the local tier, and the local tier would have run that same gutted
 * workflow's checks. The property is the same on both paths.
 */
```

### scripts/ship.mjs:536 (WHY, shortened)

token requirement kept; measurement moved.

```js
/*
 * **THE TOKEN IS REQUIRED, and the brief that specified this check assumed it
 * was not.** The assumption was that the repository is public, so Actions runs
 * would be readable unauthenticated. MEASURED 2026-08-23: `private=true`. An
 * unauthenticated read answers 404, because GitHub returns 404 rather than 403
 * for a private resource you may not see, so the fallback would refuse every
 * ship while reporting that the repository does not exist.
 *
 * `gh auth token` is the token path. Ship has no token of its own: GITHUB_TOKEN
 * is a wrangler secret and is not in this process's environment. If `gh` is
 * absent or logged out, the step below refuses, which is the correct direction:
 * a check that cannot read CI has not confirmed CI.
 */
```

### scripts/ship.mjs:554 (CONTRACT, shortened)

hard rule 10 citation kept.

```js
/**
 * One read of GitHub's verdict on HEAD. Called twice, minutes apart.
 *
 * Returns rather than refusing, because the two callers want opposite things
 * from the same failure: this one takes the slow path, the one below refuses.
 * A single function with a `shouldRefuse` flag would be one helper with two
 * meanings, which is the shape hard rule 10 names.
 *
 * @returns {Promise<{ verdict: { ok: boolean, why: string, remedy: string } | null, error: string }>}
 */
```

### scripts/ship.mjs:566 (WHY, shortened)

retry rationale kept; incident moved.

```js
/*
     * THROUGH `retryRead`, AND THE THROW INSIDE IS WHAT MAKES THAT WORK.
     *
     * Ruling 52 doubled the number of CI reads a ship makes, and the new early
     * one refused on a transient TWICE in one day. A GitHub API read is the
     * textbook case this helper exists for: it is idempotent, it writes
     * nothing, and a single failed request is not evidence about CI.
     *
     * The failure still lands in the `catch` below rather than throwing out of
     * ship, because both callers want to DECIDE on it: the early one takes the
     * local path, the authoritative one refuses. `retryRead` gives them one
     * more chance to get a real answer first, and prints the transient it
     * swallowed so a retry is never invisible.
     */
```

### scripts/ship.mjs:607 (WHY, shortened)

refuse-not-apply rule kept; ship window 5 story moved.

```js
/*
 * **NO MIGRATION MAY BE PENDING WHEN A DEPLOY GOES OUT.**
 *
 * SHIP WINDOW 5 is why this exists. It deployed with every offline gate green
 * and the media admin page returned a 500 on its first load, because
 * `0011_media_trash_tags.sql` had been pending on the remote database since the
 * session that authored it, four sessions earlier. `trashed_at` and `tags` did
 * not exist, and every media loader query threw.
 *
 * Nothing in the repo could see it. Ship applies no migrations and compares no
 * schema. `check:migrations` compares FILES to a hash manifest and never to a
 * database. `check:admin-ui` renders the route with every `.server` import
 * stubbed, so the loader never runs. Authoring a migration created an
 * obligation in no instrument anywhere.
 *
 * ## IT REFUSES. IT DOES NOT APPLY.
 *
 * `0011` happened to be additive, two `ADD COLUMN` and an index, and ship
 * cannot tell that from a `DROP` or a rewrite without reading and classifying
 * SQL. Being wrong about that once is unrecoverable, and a deploy that silently
 * mutates the production schema is worse than one that stops. The operator
 * decides; this makes sure they are ASKED rather than finding out from a 500.
 *
 * ## BEFORE THE BUILD, not merely before the deploy
 *
 * The ruling says before deploy. This is earlier than it has to be, and that is
 * deliberate: the answer cannot change during a build on a single-operator
 * system, and refusing in five seconds is kinder than refusing after two
 * minutes of build and gates. It sits with the other preconditions about the
 * state of the world, beside the clean-tree check.
 *
 * FAIL CLOSED. Three outcomes, not two: pending refuses naming the files,
 * clean proceeds, and anything unreadable, including a non-zero exit from a
 * network or auth failure, refuses saying so. `readMigrationList` owns that
 * decision and is unit tested against wrangler output recorded from a real
 * database in both states.
 */
```

### scripts/ship.mjs:649 (WHY, shortened)

retry-only-unreadable mechanism kept; incident moved.

```js
/*
 * WRAPPED IN `retryRead`, and this is the EIGHTH incident in that class.
 *
 * The guard refused on its first live use, in SHIP WINDOW 6, with
 * `The given account is not valid or is not authorized to access this service
 * [code: 7403]`. It was not a credential fault: `wrangler whoami` reported the
 * right account with `d1 (write)` scope and no overriding env var, and the
 * identical command re-run immediately returned `No migrations to apply!`. A
 * transient on a Cloudflare control-plane READ, which is exactly the class
 * `retry.mjs` already wraps at 27 other sites, at the one site nobody had
 * wrapped. It cost a ship attempt.
 *
 * A READ, so this is inside the documented policy rather than an exception to
 * it: the wrapper's own header says reads only, never a write, and listing
 * migrations mutates nothing.
 *
 * **ONLY `unreadable` IS RETRIED, and the distinction is the whole implementation.**
 * `readMigrationList` RETURNS its verdict and never throws, so wrapping the
 * spawn alone would have retried nothing at all: a 7403 exits non-zero, the
 * parser reports `unreadable`, and `retryRead` sees a perfectly resolved
 * promise. So the wrapped function throws on that verdict and only that one.
 * `pending` is a real answer about the world, not a transient, and retrying it
 * would spend 90 seconds re-asking a question already correctly answered before
 * a refusal that was always going to happen.
 *
 * The second failure propagates unchanged and lands in the same refusal it
 * would have without this, which is what the `catch` below preserves.
 */
```

### scripts/ship.mjs:731 (WHY, shortened)

shortened.

```js
/*
 * THE STACK ARTIFACT FIRST, and it has to be inside the build step rather than
 * beside build:content at step 12. content/generated/stack.json is gitignored
 * since ruling 39a, and three route modules import it statically, so the Worker
 * bundle carries its bytes. A run that derived it after the deploy would ship
 * whatever a previous run left on disk, or fail the build outright on a clean
 * clone. Deriving it here also serves the two later readers for free: the gates
 * at step 3 and build:content at step 12 both find it already written.
 */
```

### scripts/ship.mjs:743 (WHY, shortened)

shortened.

```js
/*
 * THE ABOUT ARTIFACT, for exactly the reason the stack artifact is above it.
 * content/generated/about.json is gitignored and app/routes/about.tsx imports
 * it statically, so the Worker bundle carries its bytes and a clean clone
 * fails the build without this. It reads content/generated/stack.json, so it
 * goes after build:stack and not before it.
 *
 * This also writes content/generated/posts.json, which step 12 re-derives
 * before the sync. Running it twice is a few seconds and is the honest
 * ordering: the deploy needs the About bytes now, and the sync needs a corpus
 * built from the tree that was actually deployed.
 */
```

### scripts/ship.mjs:758 (WHY, shortened)

silent-404 trap kept; count removed.

```js
/*
 * THE PUBLICATION TWINS, and this one is different from its neighbours in a way
 * worth stating: nothing imports them, so the build does not fail without them.
 * They are gitignored files under public/, which Vite copies into build/client,
 * so a run that skipped this step would deploy a site whose llms.txt advertises
 * 36 markdown twins that answer 404, and every gate would stay green because
 * every gate reads disk. The tier at step 3 does catch it, since
 * check:publications compares the twins on disk against a fresh generation, but
 * only on the path where the tier runs.
 */
```

### scripts/ship.mjs:780 (WHY, shortened)

shortened.

```js
/*
 * THE APP BUILD IS THE GATE TIER'S, not the deploy's, and that is why ruling 52
 * can skip it. `npm run deploy` is `npm run build && wrangler deploy`, so the
 * bundle that ships is built below either way. What this call exists for is
 * `check:page-payload`, which reads `build/client` and is in the tier that the
 * next step runs. Skip the tier and this build has no reader.
 */
```

### scripts/ship.mjs:798 (HISTORY, deleted)

ruling narration; log lines say it.

```js
/*
   * RULING 52. Not "the gates did not run": they ran, on a clean checkout of
   * this sha, on a machine with no local node_modules and no generated types.
   * VERIFICATION.md names those as two different instruments, and this is the
   * stronger of the two for everything except the handful of gates CI excludes.
   */
```

### scripts/ship.mjs:815 (WHY, shortened)

fail-closed table and no-override kept; audit history moved.

```js
/*
 * **CI IS ENFORCED HERE, AT THE DEPLOY PRIMITIVE, AND NOWHERE ELSE.**
 *
 * The 2026-08-22 audit, section 8: "CI runs on push to main, after the fact.
 * Nothing prevents a push that fails CI from being deployed, because deploy is
 * manual and local. The gate tier runs in `ship`, so in practice the same checks
 * run, but CI is advisory only." Verified true: nothing consulted CI before.
 *
 * Branch protection was the obvious alternative and does not solve this. It
 * governs what may MERGE; it has no opinion about a local `npm run deploy`, and
 * this repo is mainline-only until cutover, so there is no merge to protect.
 * The deploy is the primitive that matters, so the check belongs immediately in
 * front of it.
 *
 * ## WHY IT IS NOT REDUNDANT WITH THE LOCAL TIER, WHEN THE LOCAL TIER RAN
 *
 * The local tier runs the offline gates ON THIS DISK, with this machine's
 * node_modules, generated types and real wrangler.jsonc. CI runs them on a
 * clean checkout that has never seen the repo. They answer different questions,
 * and VERIFICATION.md names them as two of the four instruments. A dependency
 * installed locally and absent from the lockfile is invisible to the local tier
 * and fatal in CI.
 *
 * Since ruling 52 the local tier runs only when CI has not already answered for
 * this sha, so on the fast path there is no second opinion to be redundant
 * with, and the reason above is exactly why the fast path is the safe direction
 * to drop: it drops the WEAKER of the two instruments and keeps the stronger.
 *
 * ## FAIL CLOSED, IN EVERY DIRECTION, AND NO OVERRIDE FLAG
 *
 *   no run for this sha    refuse. Unpushed, or CI never triggered.
 *   run still in progress  refuse. A green-so-far run is not a green run.
 *   conclusion not success refuse, naming the conclusion.
 *   API unreachable        refuse. Ship already needs the network to deploy, so
 *                          "the network is down" cannot be a reason to skip a
 *                          safety check and proceed to a step that needs it.
 *
 * There is deliberately no `--force`. A flag would be used, and it would be used
 * on exactly the day the check was right.
 *
 * ## OBSERVATION BOUNDARY
 *
 * It reads GitHub's view of a sha. It cannot see whether CI's assertions are
 * meaningful, whether the workflow was edited to assert nothing in the same
 * commit, or whether a run was re-run until it passed. It proves a green run
 * exists for this exact commit, which is strictly more than nothing knew before.
 */
```

### scripts/ship.mjs:865 (WHY, shortened)

fresh-read rule kept.

```js
/*
 * **THIS IS THE READ WITH TEETH, ON EVERY PATH.** Ruling 52 changed which work
 * runs before it; it did not change this step, and that is the point. The early
 * read at step 2 chose a path. This one decides the deploy, and refuses in the
 * four directions `ciVerdict` names whether or not the tier ran locally.
 *
 * It is a SECOND read rather than the early verdict reused, on BOTH paths, and
 * the uniformity is deliberate. On the local path ten minutes have passed and a
 * run that was pending then may have concluded in either direction; reusing the
 * early answer would refuse a ship whose CI went green while the gates ran, and
 * would be a stale claim besides. On the fast path the two reads are seconds
 * apart and will agree, so the call buys no information and buys something
 * better: this step reads fresh and decides, with no branch, so there is no
 * arrangement of the code in which a deploy is authorised by a verdict that was
 * not re-read here. One extra API call against eight minutes saved is not a
 * trade worth thinking about twice.
 */
```

### scripts/ship.mjs:951 (WHY, shortened)

ordering and body-read reasons kept; narrative moved.

```js
/*
 * FIVE 200s SAY THE WORKER ANSWERS. THEY DO NOT SAY IT IS HEALTHY.
 *
 * The poll above requests `/colophon` and reads a status line. That is a real
 * check and it catches a Worker that failed to boot, a broken route table and
 * a rollout that has not finished. It is blind to every invariant this site
 * actually watches: a drifted Ask index, a media index that lost its rows, D1
 * out of step with the repository, an FTS index that is empty while its
 * content table is full. All five of those serve `/colophon` with a 200.
 *
 * `/api/health` answers exactly those questions and ship has never once asked
 * it, which is the odd half: the scheduled workflow reads that endpoint every
 * fifteen minutes and alerts on it, so the deploy path was the ONLY path that
 * shipped without consulting the instrument the site trusts the rest of the
 * time.
 *
 * ## WHY HERE, BETWEEN THE POLL AND THE SYNC
 *
 * After the poll, because a Worker that is still rolling out would answer this
 * from the previous version and the verdict would be about the wrong build.
 * Before the D1 sync, because the sync is the first thing in this script that
 * WRITES, and a refusal after it has run leaves production half converged.
 * Refusing here costs nothing: the deploy stands and serves, and the index
 * still describes the previous build, which is the same safe direction the
 * poll's own refusal takes.
 *
 * ## THE STATUS LINE IS NOT ENOUGH, AND THAT IS DELIBERATE
 *
 * `ok: true` is read out of the BODY rather than inferred from a 200. The two
 * agree today, and relying on that agreement would make this step depend on a
 * property of the endpoint that lives in a different file. The endpoint's own
 * docblock says the status line is the contract for the WORKFLOW, which reads
 * it with `curl --fail`; this reads a parsed body because it can, and because
 * printing the five verdicts is most of the value when it refuses.
 *
 * A 429 is called out separately. Since the rate limit landed, a burst from
 * this address can refuse the check, and "rate limited" and "unhealthy" need
 * different repairs.
 */
```

### scripts/ship.mjs:1021 (WHY, shortened)

shortened.

```js
/*
   * A DEFERRED CHECK THAT IS FAILING RIGHT NOW IS SAID OUT LOUD, so the table
   * above cannot be read as a clean sweep. It is not a refusal here and it is
   * not forgiven either: the assertion moves to after the sync, which is the
   * step that repairs it.
   */
```

### scripts/ship.mjs:1041 (WHY, shortened)

order and miss-not-refusal kept.

```js
/*
 * THE SECOND DEPLOY, AND IT IS DELIBERATELY NOT A REFUSAL.
 *
 * `workers/watchdog.ts` is a separate Worker with its own config and its own
 * Cron Trigger. It has to be deployed by something, and ship is the only thing
 * that deploys anything here, so a watchdog left to a remembered manual command
 * is a watchdog that silently runs an old build until somebody notices it did
 * not repair something.
 *
 * ## WHY AFTER THE SITE, AND AFTER THE READINESS CHECK
 *
 * Deploy-first ordering, and there are two reasons rather than one.
 *
 * The watchdog binds to the site through a SERVICE BINDING, so the site has to
 * exist for its config to resolve. That alone would only argue for "after the
 * site deploy". It runs after READINESS as well because a watchdog pointed at a
 * Worker this run has not yet proven healthy is a watchdog whose first firing
 * reports a fault it was deployed into, which is noise from a monitor on the
 * day it lands and is exactly the shape that gets monitors muted.
 *
 * ## AND WHY A MISS RATHER THAN A REFUSAL
 *
 * This runs after the deploy has LANDED. Refusing here would abandon the sync
 * with production half converged, and it would do so over the watcher rather
 * than over the thing being watched. The site is serving; a stale watchdog is a
 * degraded monitor, not a degraded site.
 *
 * So it takes the same shape as the Ask and media steps: the deploy STANDS, the
 * record prints, and ship exits nonzero at the very end with the miss named
 * beside any others. LOUD AND LAST, which is the property the ruling asked for.
 *
 * The failure is not silent in the other direction either: the previous
 * watchdog build keeps firing, so the site stays watched by the code that was
 * already there.
 */
```

### scripts/ship.mjs:1094 (WHY, shortened)

shortened.

```js
/*
     * THE VERSION ID IS READ, on the same rule the site deploy applies: a ship
     * that cannot name what it shipped did not ship. A zero exit from wrangler
     * with no version in the output is the shape that would let a no-op deploy
     * report success.
     */
```

### scripts/ship.mjs:1108 (WHY, shortened)

shortened.

```js
/*
       * THE TRIGGER IS READ BACK OUT OF WRANGLER'S OWN OUTPUT, because the
       * config asking for a cron and the platform having registered one are two
       * different facts, and only the second one fires. `check:config` owns the
       * first and cannot see the second: it reads a file. This reads what
       * wrangler says it did.
       *
       * A MISS RATHER THAN A REFUSAL, on this step's own rule. A Worker
       * deployed without its schedule is a Worker that never runs, which is
       * precisely the silent failure the whole arc exists to end, so it must be
       * reported; it is still not worth abandoning a converged sync over.
       */
```

### scripts/ship.mjs:1131 (WHY, shortened)

order and miss rule kept; measurement moved.

```js
/*
 * ## THE EXTERNAL UPTIME MONITORS, POINTED AT WHAT THIS RUN DEPLOYED
 *
 * AFTER READINESS AND AFTER THE WATCHDOG, and the position carries the same
 * argument the watchdog step does: both bind an outside instrument to this
 * site, and neither may be pointed at a build this run has not proven. If the
 * readiness step refused, ship never reaches here and the monitors keep
 * watching the previous deploy, which is the correct behaviour rather than a
 * gap.
 *
 * **THIS IS THE STEP THAT MAKES THE CUTOVER ONE EDIT.** `SITE_ORIGIN` is the
 * one owner of the hostname (rule 17); `uptime-ensure` derives both monitor
 * URLs from it and PATCHes the live monitors to match. So the DNS cutover
 * changes one constant, and the next ship repoints the monitors without anyone
 * opening a dashboard. `check:uptime` is what refuses if that ever stops being
 * true.
 *
 * A MISS, NOT A REFUSAL, on the watchdog step's rule. The deploy STANDS: the
 * site is live and healthy by this point, and an UptimeRobot API failure is a
 * reason to tell somebody, never a reason to unmake a good deploy. It is
 * reported LOUD and ship exits nonzero at the end with it named beside any
 * other miss.
 *
 * IDEMPOTENT, so running it on every ship costs nothing when nothing moved:
 * measured 2026-09-07, a second consecutive run reports "0 change(s) applied"
 * and rewrites the manifest byte-identically.
 */
```

### scripts/ship.mjs:1172 (WHY, shortened)

shortened.

```js
/*
     * THE VERDICT IS READ, NEVER INFERRED FROM EXIT 0, which is the rule this
     * file applies to every operator round trip. `uptime-ensure` prints one
     * line per monitor and a change count; a run that somehow reconciled
     * nothing would still exit 0, and that is the shape worth catching.
     */
```

### scripts/ship.mjs:1192 (WHY, shortened)

shortened.

```js
/*
 * BUILT HERE, EXPLICITLY, even though the gate tier's own build step already
 * ran one: the product is gitignored since the artifact arc, the sync below
 * reads it off disk, and "whatever the last run left behind" is not a
 * provenance. A ship window owns the tree, so this rebuild is byte-identical
 * to the tier's; it exists so the sync's input is the build this ship ran.
 */
```

### scripts/ship.mjs:1220 (WHY, shortened)

discriminator kept.

```js
/*
   * TWO DIFFERENT NONZEROES, told apart by the report the sync prints.
   *
   * A sync that reported RENDER DRIFT finished every write and every
   * verification, exited nonzero as an alarm, and printed the counts line;
   * D1 is converged and the deploy must stand while the run still fails at
   * the end, exactly like an index miss. A sync that failed for any other
   * reason may have left D1 partially written and refuses here as it always
   * has. The discriminator is the drift line's own count, not the exit code,
   * because the exit code carries one bit and this is a two-fault channel.
   */
```

### scripts/ship.mjs:1236 (WHY, shortened)

confirming-sync mechanism kept; ruling story moved.

```js
/*
     * DRIFT ON THE FIRST SYNC IS NOT YET A DEFECT. Ruling 30, vol 15.
     *
     * THE ORDERING ARTIFACT, which is what this usually is. The previously
     * deployed Worker's content-drift poll front-runs the deploy by up to one
     * poll interval: it pulls the new markdown, renders it with the OLD
     * renderer and writes that hash to D1. The sync above then reads a D1 hash
     * the old pipeline produced, compares it against the NEW build, and calls
     * it drift. Proven byte-exact when it was first met, by rendering the
     * flagged slug through the old pipeline and matching the flagged hash.
     * Nothing is wrong: the write the sync just did is the repair.
     *
     * THE SECOND SYNC IS WHAT TELLS THE TWO APART, and it is the same
     * read-back the three index repairs use rather than a new idea. The first
     * sync converged every row to the build, so a second one reads zero UNLESS
     * the converge write did not take, and that is a real defect: a partially
     * applied write, or something else writing render_hash behind us. A report
     * assembled from the first run's own counters cannot see either.
     *
     * So drift confirmed by a second run FAILS the ship, and drift that
     * clears completes it. This used to report every first-run drift as "a
     * pipeline defect to find", which cried wolf on two consecutive ships
     * where the artifact was benign and had already been ruled benign.
     */
```

### scripts/ship.mjs:1290 (WHY, shortened)

shortened.

```js
/*
 * The counts line is the proof, not the exit code. `search_docs` is the derived
 * table and the two FTS indexes are rebuilt from it; if they disagree the index
 * is silently stale, and `COUNT(*)` on either index reads THROUGH to the
 * content table and can never detect that. These are the docsize numbers.
 */
```

### scripts/ship.mjs:1314 (WHY, shortened)

order and miss rule kept; measurements moved.

```js
/*
 * THE ANSWER INDEX IS THE ONE DERIVED STORE `sync:content` DOES NOT REBUILD.
 *
 * D1 and both FTS indexes are rebuilt above. AI Search is not: the only things
 * that ever wrote it were `savePost`, for a post published through the editor,
 * and a human clicking sync-ask in the admin. So every post that landed by
 * COMMIT left the answer index behind, and this site's writing mostly lands by
 * commit.
 *
 * MEASURED 2026-08-23: the scheduled health check went red four polls running
 * at `expected 91, present 90`, and shipping nine post updates widened it to
 * `expected 99, present 90`, tracking search_docs growth exactly. Nothing was
 * broken; nothing was holding the step.
 *
 * ## WHY THIS RUNS AFTER THE DEPLOY AND FAILS THE RUN ANYWAY
 *
 * It cannot run before: it uploads what the DEPLOYED Worker serves, through
 * that Worker's own bindings. So by the time it can run, the deploy has landed
 * and rolling back on its account would be the wrong trade, because a deployed
 * site with a stale answer index is better than no deploy and the same stale
 * index.
 *
 * So the deploy STANDS, the record below still prints, and ship exits nonzero
 * at the very end. Both surfaces then carry the miss: this output, and the
 * scheduled health poll that will read the same drift fifteen minutes later.
 *
 * The operation is idempotent, so a failed run is safe to repeat: rerunning
 * ship, or calling sync_ask directly, writes the same keys again.
 *
 * ## A MISS IS NOT DECLARED ON THE FIRST READING, since 2026-08-24
 *
 * `syncAsk` reads the counts back immediately after its writes and AI Search is
 * eventually consistent, so the first reading can be early rather than wrong.
 * A non-converged write-back now opens a bounded read-only window against
 * `/api/health` before anything is called a miss. The window, the bound and the
 * reason it re-reads health rather than re-running `sync_ask` are all at the
 * poll itself; what matters here is that NOTHING BELOW CHANGED. A miss that
 * survives the window still exits nonzero, still after the deploy stands, still
 * with the record printed.
 */
```

### scripts/ship.mjs:1360 (CONTRACT, shortened)

shortened.

```js
/**
 * Set when convergence arrived during the poll window rather than on the
 * write-back read. It exists so the summary line below cannot report the
 * write-back's counts as if they were the converged ones: those numbers are
 * precisely the stale pair the window was opened to outlive.
 */
```

### scripts/ship.mjs:1368 (CONTRACT, shortened)

shared-helper contract kept; history moved.

```js
/**
 * ONE AUTHENTICATED OPERATOR CALL, and one statement of what a usable answer is.
 *
 * Shared by the Ask step and the media step since 2026-08-24. Both need the
 * same four refusals in the same order, and a second copy of them would be a
 * second answer to "did this operation prove anything", which is the question
 * ship exits nonzero on. Rule 17.
 *
 * Returns the report and a MISS STRING rather than throwing, because every one
 * of these failures happens AFTER the deploy has landed: the caller has to
 * record the miss and let the deploy stand, never abort.
 *
 * @param {string} tool
 * @returns {Promise<{ report: any, miss: string }>}
 */
```

### scripts/ship.mjs:1425 (WHY, shortened)

read-only poll and double bound kept; measurement moved.

```js
/*
     * THE CONVERGENCE WINDOW, ruled 2026-08-24 after a false alarm.
     *
     * `syncAsk` reads `expected` and `present` back IMMEDIATELY after its two
     * writes, and AI Search is eventually consistent, so a drift reported there
     * can be a moment behind rather than a fault. That is not a hypothesis:
     * measured 2026-08-24, ship read drift 1 at 02:20:18Z, NO REMEDY WAS
     * APPLIED, and the scheduled health check read ok 75 seconds later and
     * stayed ok. The index converges on its own inside about a minute, which is
     * upload visibility lag.
     *
     * So the miss is not declared on the first reading. It is declared after
     * the index has been given a window to catch up.
     *
     * ## THE RE-READ IS READ-ONLY, AND THAT IS THE WHOLE DESIGN
     *
     * Polling by calling `sync_ask` again would re-upload the entire corpus,
     * which REPAIRS the thing being measured. A run that then converged could
     * not be distinguished from one that had self-healed, and that exact
     * ambiguity is what the 2026-08-24 watch item recorded as unresolvable.
     *
     * `/api/health` runs `ask-index-drift`, which derives its verdict from the
     * SAME `askIndexStatus()` that `syncAsk` derives `converged` from, and it
     * writes nothing. `publicHealthBody` opts `expected` and `present` onto the
     * wire by name for failing checks, so the counts are readable without a
     * token. Convergence inside this window is therefore evidence of self-heal,
     * not of a remedy this loop applied.
     *
     * ## THE BOUND
     *
     * At most ASK_POLL_ATTEMPTS iterations, AND no iteration begins after the
     * deadline, so the loop cannot outlast the window by more than the single
     * health request already in flight when the deadline passes. Health caps
     * each of its own checks at three seconds. Two independent bounds rather
     * than one, because a `while` on the clock alone would spin without limit
     * if the clock were ever wrong, and a count alone would not honour the
     * stated two minutes if a request hung.
     */
```

### scripts/ship.mjs:1528 (WHY, shortened)

order and no-poll reason kept; history moved.

```js
/*
 * THE MEDIA INDEX IS THE THIRD DERIVED STORE, AND IT WAS THE ONE LEFT MANUAL.
 *
 * D1 and both FTS indexes are rebuilt by `sync:content`. The Ask index is
 * brought into step above. The media index was rebuilt by exactly one thing: a
 * person clicking a button in `/admin/media`. So every ship that added or
 * removed a static asset left the index describing the previous build, and the
 * standing repair was a click that waited weeks. `/fonts/OFL.txt` is the
 * measured instance: one public file with no row, red in `check:media --remote`
 * since the fonts landed.
 *
 * Ruled 2026-08-24 under the AUTOMATE directive. The button STAYS, as manual
 * repair; what changes is that the routine case no longer needs it.
 *
 * ## SAME PLACE IN THE ORDER, AND FOR THE SAME REASON
 *
 * After the deploy, because the rebuild runs inside the deployed Worker through
 * its own bindings: it reads the R2 buckets and the ASSETS binding of the build
 * that is actually serving. Running it before would index the previous build's
 * static assets. So, exactly like the Ask step, this cannot run early enough to
 * roll anything back, and a deployed site with a stale media index is better
 * than no deploy and the same stale index.
 *
 * ## NO POLL HERE, DELIBERATELY, AND IT IS NOT AN OVERSIGHT
 *
 * The Ask step waits out a two minute window because AI Search is a separate
 * eventually consistent service. This store is D1: `rebuildMediaIndex` awaits
 * every upsert and delete, and `mediaIndexStatus` reads back inside the SAME
 * Worker request, which reads its own writes. There is no interval in which a
 * correct rebuild reports drift, so a window would only delay a real failure.
 * The reason is written down because the absence of a poll beside a step that
 * has one looks like an omission, and the next reader deserves to know it was a
 * decision. The evidence is the first ship's own output.
 */
```

### scripts/ship.mjs:1603 (WHY, shortened)

deferral meaning kept; ruling narrative moved.

```js
/*
 * RULING 48, THE OTHER HALF. The readiness step reported `content-drift` and
 * did not gate on it, because the D1 sync is what converges that drift and a
 * step that refuses before its own repair is a deadlock. The assertion is here
 * instead, and moving it changes what a failure MEANS rather than weakening it:
 *
 *   - at readiness, a failing `content-drift` meant "the index is behind the
 *     repository", which is the ordinary state of a corpus that has just been
 *     committed and not yet synced, and is exactly what the next steps fix
 *   - here, after `sync:content` has run and reported its own drift table, it
 *     means THE SYNC RAN AND DID NOT CONVERGE, which is a defect
 *
 * A MISS, NOT A REFUSAL, on the same rule the Ask and media steps take: the
 * deploy has landed and the sync has already written, so there is nothing left
 * to protect by refusing, and abandoning the record would cost the reader the
 * one report that says what happened. The exit code at the bottom carries it.
 */
```

### scripts/ship.mjs:1625 (WHY, shortened)

shortened.

```js
/*
   * ONE READ FOR ALL THREE, not one per check. Each is asserted after ITS
   * repair step, and this point is after all of them, so a single request
   * satisfies every one. Three requests would also be three chances to trip
   * the endpoint's per-IP limiter, which answers 429 and would read as a
   * failure of the checks rather than of the reader.
   */
```

### scripts/ship.mjs:1651 (WHY, shortened)

fts-equality exclusion kept; session note moved.

```js
/*
     * Read with NO deferrals, so every row is the endpoint's own verdict. Only
     * the deferred rows are consulted: the others were gated at readiness, and
     * re-refusing them here would be a second opinion on a question already
     * answered before anything was written.
     *
     * `fts-equality` IS THE CLOSEST CALL AND IS DELIBERATELY NOT HERE. The D1
     * sync rebuilds the FTS index outright, so its repair arguably is a later
     * ship step and the rule above would defer it. Ruling 56 names content,
     * Ask and media, and deferring a fourth check changes what may gate a
     * production write, which is a ruling rather than a session's call. Left
     * gating and raised in the report.
     */
```

### scripts/ship.mjs:1681 (WHY, shortened)

all-misses and no-rollback kept.

```js
/*
 * THE EXIT CODE IS LAST, AND IT IS NONZERO ON ANY MISS.
 *
 * The record above has already printed, because the deploy landed and saying so
 * is true. What did not happen is a derived index catching up, or the two
 * writers proving they render alike, and a pipeline that reported success on
 * either would be the same green-light-meaning-nothing these steps were added
 * to remove.
 *
 * ALL ARE REPORTED, never just the first. The faults are independent, and a
 * run that printed only the Ask miss would send somebody to re-run ship, watch
 * Ask converge, and never learn about the others. That is the N-1-of-N shape
 * FAILURES.md opens with.
 *
 * Nothing is rolled back. The index operations are idempotent and the drift
 * report's D1 side was already converged by the sync. A render-drift miss
 * reaching here has survived that converge AND a second sync, so it is the
 * defect rather than the ordering artifact, and its remedy is finding what
 * wrote the D1 hash rather than a re-run.
 */
```

## scripts/check-contrast.mjs

### scripts/check-contrast.mjs:1 (CONTRACT, shortened)

two-source contract and boundary kept; opacity enumeration and dates moved.

```js
/**
 * Gate over the shipped colour tokens.
 *
 * OBSERVATION BOUNDARY: computes ratios from token values in the stylesheet. It
 * does not render a page, so it cannot see a token applied to the wrong element,
 * text over an image, or a pair that never occurs in the markup. It also skips
 * the built-CSS check when the build is older than app.css, and SAYS SO.
 *
 * **AND IT CANNOT SEE OPACITY.** It reads token hexes; `opacity` is compositing
 * applied by the browser afterwards, so a pair that measures 7:1 here can reach
 * the reader at 4.35:1. That is not hypothetical: it is what `.figure-credit`
 * did until 2026-08-21. EVERY opacity on text is a hole of this shape.
 *
 * ENUMERATED 2026-08-21, all 19 `opacity` declarations in app.css, classified,
 * so the next reader inherits the list rather than the search:
 *
 *   ON TEXT, PERSISTENT, and therefore the ones that matter:
 *     .figure-credit                   FIXED, was 0.8 and 4.35:1 in light
 *     .heading-anchor       0.55       inside @media (hover: none); the permalink
 *                                      glyph is the only thing it paints
 *     .search-why-sep       0.5        a "/" between why-terms. 3.06:1 light,
 *                                      4.18:1 dark. Incidental punctuation, so
 *                                      LEFT, and recorded rather than hidden
 *   ON TEXT, TRANSIENT (a pending state, admin plane, seconds at a time):
 *     .posts-table[data-pending]       0.55
 *     .media-grid[data-pending]        0.55
 *   DISABLED CONTROLS, which WCAG 1.4.3 exempts outright:
 *     .row-action:disabled             0.55
 *     .media-modal-actions .btn-danger[disabled]  0.5
 *   NOT TEXT: two scrims (.media-detail-scrim 0.28, .media-modal-scrim 0.5)
 *   REVEAL PAIRS, 0 then 1, so nothing is ever painted at a partial value:
 *     .heading-anchor, .media-card-body, .media-check-label, .media-toast
 *   KEYFRAMES: two `from { opacity: 0 }` steps
 *
 * NOT GATEABLE HERE, said plainly rather than left as a to-do. Deciding whether
 * a selector paints TEXT needs a rendering, and a hand-maintained list of
 * text-bearing selectors is the mirror this file exists to avoid. The instrument
 * that could measure it is `check:browser`, which renders and can read a
 * COMPUTED colour with the compositing already applied.
 *
 *   npm run check:contrast
 *
 * The point of this script is that it reads TWO INDEPENDENT SOURCES and makes
 * them argue. The hexes come out of the stylesheet that ships. The pairs and
 * their thresholds come from dustinedwards/design-tokens.md, transcribed below
 * as token NAMES rather than values. Nothing here restates a hex, so a hex
 * edited in app.css cannot also edit the expectation: it moves one side of the
 * comparison and the gate fails.
 *
 * A gate that has never been observed failing has not been verified. Plant a
 * violation and watch it fail before trusting a green run: change any hex in
 * app/app.css and this exits 1 naming the pair.
 *
 * WCAG 2.x contrast is what FAILS a run, because it is the ratified compliance
 * target. APCA Lc is computed and printed alongside as advisory only, since it
 * is the model that produced the fills-over-pastels rule and it disagrees with
 * WCAG in exactly the places worth watching.
 *
 * Pure: no database, no network, no build step. Safe to run on a clean
 * checkout, which is why it is in the check family.
 */
```

### scripts/check-contrast.mjs:71 (WHY, shortened)

shared-arithmetic why kept; move narrative dropped.

```js
// The colour maths, on exactly the footing query.mjs has with check:search: the
// Worker imports this module and so does this gate, so /playground's contrast
// lab cannot compute a ratio by a different rule than the one gated here. The
// functions moved out of this file unchanged; the keystone-vector check below
// and the matrix recomputation are what prove the move was lossless.
//
// This does NOT weaken the two-independent-sources design. The hexes still come
// from the shipped stylesheet and the pairs and thresholds are still transcribed
// here from design-tokens.md. Only the arithmetic is shared, and arithmetic is
// not one of the two sources.
// Only the two the gate calls directly. `channels` and `luminance` are exercised
// through them, exactly as they were when all four lived in this file.
```

### scripts/check-contrast.mjs:85 (WHY, shortened)

file-discovery distinction kept, shortened.

```js
/*
 * FILE DISCOVERY ONLY, and that distinction is what keeps this gate's design
 * intact. `tokens.mjs` says this file deliberately keeps its OWN palette
 * parsing, so the two can disagree, and that is unchanged: every hex below is
 * still read by the parser in this file from the block in this file's own
 * CSS_PATH. What is imported is the LIST OF STYLESHEETS, which is not one of
 * the two sources; it is the answer to "which files does the site ship", and
 * having two answers to that would be the drift, not the safeguard.
 */
```

### scripts/check-contrast.mjs:102 (CONTRACT, shortened)

section heading shortened.

```js
/* -------------------------------------------------------------------------
 * Reading the tokens back out of the stylesheet that ships
 * ---------------------------------------------------------------------- */
```

### scripts/check-contrast.mjs:108 (WHY, shortened)

trap kept; first-run incident moved.

```js
/**
 * Comments are stripped before anything is located, because the token block's
 * own comment SPELLS OUT the three selectors it documents. Searching the raw
 * file finds the prose first and then parses whichever block follows it. That
 * is not hypothetical: the first run of this gate read the light block three
 * times and reported the light values as the dark ones, and every dark row
 * passed for the wrong reason.
 */
```

### scripts/check-contrast.mjs:117 (WHY, shortened)

trap kept; checkout incident moved.

```js
// CRLF is normalised FIRST. This repo runs core.autocrlf=true and app.css is
  // not pinned by .gitattributes, so a fresh clone on Windows gets CRLF and
  // every multi-line selector match below silently stops matching. Measured:
  // this gate threw "selector not found in app.css" on the first clean checkout
  // after a merge, having passed on the branch it was written on, purely
  // because the working tree there still had LF.
```

### scripts/check-contrast.mjs:144 (WHY, shortened)

why kept, shortened.

```js
/**
   * EVERY declaration of each name, in source order, because a mixed fill
   * ships TWICE: the composite hex first, then the `color-mix` that produced
   * it. The hex is the source of truth and the fallback; the mix is what a
   * browser with `color-mix` paints. Keeping only the last would make this
   * gate read the recipe where it needs the value.
   * @type {Record<string, string[]>}
   */
```

### scripts/check-contrast.mjs:191 (WHY, shortened)

canary trap kept; incident moved.

```js
/*
 * THE CANARY. Each selector above is located by its literal text and the FIRST
 * match wins, so a theme block added ABOVE the palette would be parsed as the
 * palette and every ratio below would be computed from twelve tokens nobody
 * meant. The file's own comment already records that failure once: the first
 * run of this gate read the light block three times and reported the light
 * values as the dark ones, and every dark row passed for the wrong reason.
 *
 * `--paper` is the page ground and is declared in all three palette blocks and
 * in no other theme block, so its absence means the wrong block was parsed.
 * Non-colour theme blocks are legitimate and exist (the lamp's geometry), which
 * is exactly why this cannot rely on there being only one block per selector.
 */
```

### scripts/check-contrast.mjs:219 (CONTRACT, shortened)

heading shortened.

```js
/* -------------------------------------------------------------------------
 * Assertions
 * ---------------------------------------------------------------------- */
```

### scripts/check-contrast.mjs:242 (WHY, shortened)

trap kept, shortened.

```js
// --- Structural: the two dark blocks and the name parity ------------------
//
// Both theme blocks land on the html element, so they do not cascade into one
// another. A token declared in light and forgotten in dark keeps its LIGHT
// value under a dark theme, which is invisible to every other check here.
```

### scripts/check-contrast.mjs:277 (WHY, shortened)

rule kept; history of the earlier rule moved.

```js
// --- Every token RESOLVES to a literal hex ---------------------------------
//
// A token resolving to var(...) would make this gate read a name where it
// needs a value, and would silently check nothing. That was enforced by
// requiring the DECLARATION to be a hex, which also forbade a legitimate
// shape: the figure palette's ramps are the primitives and the series slots
// are the interface, so `--fig-s1: var(--fig-purple-500)` is one owner for one
// hex. Restating the hex on the slot would be a second owner of the same
// decision, which is the thing rule 17 exists to stop.
//
// So the indirection is RESOLVED, inside the same block, and the RESOLVED
// value must be a literal hex. A name that resolves to nothing, to something
// that is not a hex, or around a cycle still fails: the gate never reads a
// name where it needs a value, which is the whole of the original reason.
```

### scripts/check-contrast.mjs:332 (WHY, shortened)

why kept, shortened.

```js
/* --- A MIXED FILL AND ITS RECIPE ARE MADE TO ARGUE -------------------------
 *
 * A glass fill ships twice: the composite hex, then the `color-mix` that
 * produced it. Both branches paint the same pixel, which is the point, and it
 * is also what makes the second declaration worth shipping rather than
 * leaving in a comment: a comment cannot be checked, and this can.
 *
 * The hex is the SOURCE OF TRUTH and every ratio above is computed from it.
 * What is asserted here is that the recipe beside it still produces it, so a
 * fill retuned by hand and a fill whose recipe was edited both fail, instead
 * of the two drifting apart with the comment quietly becoming fiction.
 *
 * One-unit tolerance per channel, because the rounding of a channel landing
 * exactly on .5 is not worth pinning a browser to.
 */
```

### scripts/check-contrast.mjs:377 (CONTRACT, shortened)

heading shortened.

```js
/* -------------------------------------------------------------------------
 * The APCA implementation, checked against the published vectors
 * ---------------------------------------------------------------------- */
```

### scripts/check-contrast.mjs:381 (WHY, shortened)

source and sign-convention why kept; upstream detail moved.

```js
/**
 * An advisory number nobody has verified is decoration.
 *
 * These are the keystone vectors published with apca-w3, taken from the shipped
 * `test/index.js` of version 0.1.9 (algorithm 0.0.98G-4g) rather than quoted
 * from a write-up, because secondary sources get them wrong. There are EIGHT,
 * not four: every pair appears in both polarities, which makes them a test of
 * the sign convention as well as of the magnitude.
 *
 * Two further pairs (#123 on #234 and its reverse) sit in the same upstream
 * block but are explicitly marked as NOT matching apca-w3, and both return 0
 * under loClip. They are deliberately absent.
 *
 * Positive is dark text on a light background; negative is light on dark.
 */
```

### scripts/check-contrast.mjs:424 (CONTRACT, shortened)

heading shortened.

```js
/* -------------------------------------------------------------------------
 * The matrix, transcribed from design-tokens.md as NAMES
 * ---------------------------------------------------------------------- */
```

### scripts/check-contrast.mjs:428 (WHY, shortened)

why kept; measurements moved.

```js
// A fill is specified as a BUTTON BACKGROUND carrying text, never as a bare
// shape on the page, so there is no --fill-* against --bg row here. Measured:
// gold on caliche is 2.07:1 and dark crimson on prairie night is 2.49:1, and
// neither would ever clear 3:1. Where app.css does use a fill as a shape, the
// status dots, the discernible boundary is the family's --border-* ring, and
// those rows below are what verify it.
```

### scripts/check-contrast.mjs:436 (WHY, shortened)

prohibition kept; date moved.

```js
// DISABLED, a 3.0 house floor, is GONE as of 2026-09-13 and is not coming back
// as an unused constant. WCAG exempts an inactive component outright, and the
// only row that used it has been replaced by a named exemption; see the comment
// where that row was. A threshold nothing applies is a threshold somebody
// re-applies by accident.
```

### scripts/check-contrast.mjs:447 (WHY, shortened)

shortened.

```js
// CodeMirror's syntax colours. The markdown editor paints headings and bold
  // in --text-heading and inline code in --text-accent, on --bg normally and on
  // --surface for the active line, so all four combinations ship. They are
  // drawn from tokens the matrix already knows rather than a syntax theme of
  // their own, which is the whole reason they can be checked here at all.
```

### scripts/check-contrast.mjs:456 (WHY, shortened)

session reference dropped.

```js
// The settings drawer sits on the popover step and puts its own inputs on
  // --surface inside it, so the drawer's field text is body-on-surface, and its
  // borders are the strong ones per the Session 1 elevated-surface rule.
```

### scripts/check-contrast.mjs:460 (WHY, shortened)

why kept; measurements moved.

```js
// No --text-disabled on --surface-popover row, for the same reason there is
  // no --border one: it does not clear the floor there (2.71:1 light, 2.46:1
  // dark) and nothing ships it. The only disabled-coloured text in the editor
  // is the title placeholder, which sits on the canvas. If a placeholder ever
  // lands inside the drawer it needs a token that survives the elevation, and
  // this comment is the reason why rather than a puzzle to re-derive.
```

### scripts/check-contrast.mjs:473 (WHY, shortened)

exemption why kept; ruling narrative moved.

```js
// THE DISABLED ROW IS GONE, and its house floor with it. RULED 2026-09-13.
  //
  // It asserted --text-disabled on --bg at a 3.0 house floor, which WCAG does
  // not ask for: 1.4.3 and 1.4.11 both exempt an inactive component outright.
  // Part A step 6a set the disabled pair deliberately faint and this repo's
  // floor was the only thing arguing with it. The floor lost, because a
  // disabled control that meets 4.5:1 reads as available, which is the failure
  // the faintness exists to avoid.
  //
  // What identifies a disabled control instead is the `disabled` attribute,
  // which takes it out of the tab order and marks it inactive in the
  // accessibility tree; the recess to --paper, below its own page ground; and
  // visible text beside it saying why. None of those is a contrast ratio, and
  // `cursor: not-allowed` is not a cue at all.
  //
  // The two tokens are named in NON_PARTICIPATING with their measured ratios,
  // so they are recorded as failing rather than quietly unmeasured.
```

### scripts/check-contrast.mjs:494 (WHY, shortened)

prohibition kept; measurements and incident moved.

```js
// There is deliberately NO --border on --surface-popover row. It measures
  // 2.66:1 in dark (#746a5f on #322a25) and would fail, which this gate
  // reported the moment the admin's hovered table row was put on the popover
  // surface. --border only just clears on --surface (3.04:1), so it has no
  // headroom left for a third elevation, and anything drawn on the popover step
  // takes --border-strong instead. Asserting the failing pair here would red
  // the gate forever over a combination nothing ships; the two rows below are
  // what actually holds that rule up.
```

### scripts/check-contrast.mjs:514 (WHY, shortened)

project note dropped.

```js
// The admin identity block sits on the shell surface, not the page, so its
  // hover colour lands on a background the public header never puts it on.
  // The only genuinely new pairing the brand-parity pass introduced.
```

### scripts/check-contrast.mjs:529 (WHY, shortened)

why kept; retirement note moved.

```js
// Chrome (v4). The public header and footer are a brand SURFACE, so the text
  // they carry is measured against the chrome and not against the page canvas.
  // Nothing here retires an older row: every pair the pre-v4 header shipped
  // (--brand on --bg for the wordmark, --text-muted on --bg for the nav) is
  // still shipped elsewhere, by .hero-name and .eyebrow respectively, so the
  // rows stay for those.
```

### scripts/check-contrast.mjs:540 (WHY, shortened)

why kept, shortened.

```js
// The INVERTED pair: the pressed theme toggle's icon and the skip link's text,
  // both sitting on an --on-chrome-muted fill laid over the chrome, plus that
  // toggle's inset focus ring. WCAG contrast is symmetric, so this row computes
  // the same ratio as the one two above it and cannot fail alone; it is here
  // because APCA is NOT symmetric and is reported signed, and because a pair
  // that ships should be NAMED in the matrix rather than inferred from its
  // reverse. Read it as documentation with a number attached, not as an
  // independent assertion.
```

### scripts/check-contrast.mjs:549 (WHY, shortened)

opaque-band why kept; measurements moved.

```js
// THE TILE CAPTION SCRIM. The media grid lays a filename, a size and a copy
  // control over the picture on the selected tile, and this is the pair that
  // makes it provable: the band under the text is OPAQUE, so the ratio is a
  // constant rather than a function of whichever photograph is underneath.
  //
  // That opacity is the whole point of the row. The mockup fades its scrim to
  // transparent through the region the text sits in, which means the real
  // backdrop is the image: measured against a white backdrop, a #1a1614 scrim
  // reaches 4.70:1 at alpha 0.60 and 3.42:1 at 0.50, so a gradient through that
  // range crosses the floor at a point no gate can name and no reviewer can
  // see. design-tokens.md reached the same conclusion for the glass extension
  // and put a hard alpha floor on it. Here there is no alpha to floor: the
  // fade is a separate strip ABOVE the band, over which no text is ever drawn.
  //
  // Same values in both themes, deliberately. A scrim is a hole punched in the
  // page rather than a surface the page tints, so a "dark mode scrim" would be
  // a lighter one, which is backwards.
```

### scripts/check-contrast.mjs:568 (WHY, shortened)

exemption kept; measurements moved.

```js
// There is deliberately NO --border-strong on --surface-chrome row for the
  // header and footer seam. Measured 1.80:1 light and 3.22:1 dark, and the
  // ruling is explicit that a surface-to-surface seam carries no 3:1
  // obligation: the seam separates two backgrounds, it is not a control
  // boundary. Asserting it would red the gate forever over a value the ruling
  // already accepted. The dark seam is the one that needed the STRONG border at
  // all, because chrome-to-canvas there is 1.4:1.
```

### scripts/check-contrast.mjs:618 (WHY, shortened)

shortened.

```js
/*
   * DESTRUCTIVE, the v6 rust. A REVERSIBLE removal, not the danger family.
   *
   * Measured on all three surfaces it actually lands on in the media library:
   * the page background under the Trash heading, the card surface under a
   * trashed row, and the popover under the confirm dialog. Its own tint is
   * measured as a ground too, because the hover state puts the two together and
   * a token only ever measured against --bg would miss that pair entirely.
   */
```

### scripts/check-contrast.mjs:632 (CONTRACT, shortened)

heading kept; ruling and build narrative moved.

```js
/* ----------------------------------------------------------------------
   * PAPER, GLASS, LIGHT. Ruling 65, Part A steps 1, 2, 4 and 6a.
   *
   * These pairs are transcribed from the approved handoffs as NAMES, on the
   * same footing as every row above: the handoff supplied the pair and the
   * threshold, this file never restates its hex, and the ratio is recomputed
   * from the shipped stylesheet. Where two handoffs disagreed the later step
   * won, and the superseded value is recorded in the commit rather than here.
   *
   * NOTHING BELOW IS SHIPPED TO A READER YET. The roles are declared and no
   * component reads them until builds 2 to 4, so these rows are what stops
   * the palette being retuned by hand in the meantime.
   * ------------------------------------------------------------------- */
```

### scripts/check-contrast.mjs:653 (WHY, shortened)

shortened.

```js
// The placeholder is NOT --text-secondary and is measured as its own role:
  // secondary text is content a reader is meant to read, a placeholder is a
  // hint that must sit below the value which will replace it.
```

### scripts/check-contrast.mjs:669 (WHY, shortened)

step reference dropped.

```js
// A followed link inside an alert. The tints are the only surfaces a visited
  // link lands on that are neither paper nor raised, and step 2 measured all
  // three rather than assuming the paper ratio carried over.
```

### scripts/check-contrast.mjs:676 (WHY, shortened)

prohibition kept; deletion narrative moved.

```js
// THE BAR HAS NO ROWS. There were six, and the surface all six measured
  // against is gone: --bar-fill, --glass-fill-bar, --glass-fill-bar-open and
  // --line-on-brand were deleted on 2026-09-14 with these rows, because the
  // bar they described came out of shell.css when Dustin ruled the old header
  // back and no queued build reads them.
  //
  // A PAIR AGAINST A SURFACE NOTHING PAINTS IS NOT COVERAGE. It computes, it
  // passes, and it raises this gate's executed count while asserting something
  // about no reader's screen. Rule 10's class: a pass count is not coverage.
  // When a bar comes back, its fill comes back with the rows that measure it,
  // and both arrive in the commit that paints it.
  //
  // --on-brand and --focus-ring-on-brand SURVIVE with their own rows above,
  // against --brand and its states, so neither lost its participation.
```

### scripts/check-contrast.mjs:691 (WHY, shortened)

why kept; measurement moved.

```js
// Lines. --dust has NO row against either paper surface and that is the
  // finding, not an omission: it measures 1.57:1 on limestone, so it can rule
  // and hairline but can never be the thing that identifies a control. That is
  // why --line-strong exists at all, and these two rows are what hold it up.
```

### scripts/check-contrast.mjs:720 (WHY, shortened)

why kept; ruling and measurements moved.

```js
// THE AXIS AND GRID STROKE IS --fig-dust-400, NOT -300. RULED 2026-09-13.
  //
  // Step 4 set `.fig-axis,.fig-grid` to --fig-dust-300 and separately ruled
  // that a figure's strokes must clear 3:1. MEASURED, -300 is 2.33:1 on
  // limestone (#a89d8d on #f4efe6) and 6.74:1 in dark, so the light theme
  // missed step 4's own rule. An axis is a graphical object carrying meaning
  // rather than decoration, so 1.4.11 applies and the stroke moves one step
  // darker: --fig-dust-400 measures 4.11:1 light (#7d7263) and 4.00:1 dark
  // (#82776a). Both themes clear it, so this is one row rather than a comment
  // explaining why there is no row.
```

### scripts/check-contrast.mjs:761 (CONTRACT, shortened)

heading shortened.

```js
/* -------------------------------------------------------------------------
 * Resolution: a token USED and never declared is invisible to everything above
 * ---------------------------------------------------------------------- */
```

### scripts/check-contrast.mjs:765 (WHY, shortened)

trap and exemption rule kept; incidents moved.

```js
/*
 * THIS GATE WALKS DECLARED TOKENS. A token that is USED and never declared is
 * structurally outside every assertion in this file: name parity compares two
 * declaration blocks, the literal-hex pass iterates declarations, and
 * participation starts from declarations. `var(--nothing)` resolves to the
 * empty string, the property is dropped, and the element inherits or falls back
 * to the initial value. Transparent, usually.
 *
 * IT HAS BITTEN TWICE, both caught by a person rather than by anything here:
 * `--surface-2`, the floor every media tile paints on, and `--border-accent`.
 * Both are declared today, which is why this section has no live finding to
 * show; it exists so the third one is not found by eye either.
 *
 * ## THE EXEMPTION MAP IS FOR TOKENS DECLARED SOMEWHERE THIS FILE CANNOT SEE
 *
 * Not every var() is meant to resolve in the stylesheet. Shiki writes its four
 * colour tokens as INLINE STYLE ATTRIBUTES on each highlighted span, one set per
 * token per code block, and app.css reads them back with attribute selectors.
 * They are correctly used and correctly never declared here. Naming them costs
 * four lines; a blanket "ignore anything starting with --shiki" would exempt a
 * future typo in the same family.
 *
 * SELF-POLICING, on the same rule as NON_PARTICIPATING below: an entry naming a
 * token that is no longer USED, or one that has since been DECLARED, fails here
 * rather than quietly widening the hole.
 */
```

### scripts/check-contrast.mjs:817 (WHY, shortened)

scope and strip why kept; measurements moved.

```js
/*
   * THE WHOLE STYLESHEET SET, not app.css alone, since the 2026-08-21 split.
   *
   * `css` above is app.css, which now holds the tokens and the imports and
   * almost no rules. Scanning it alone dropped this from 69 var() uses to 13,
   * and the scope floor below FAILED rather than reporting a clean sweep over a
   * thirteenth of the stylesheet. That failure is the reason this line exists.
   *
   * COMMENTS ARE STRIPPED HERE, and it is not a duplicate of the stripping
   * app.css already gets: `allSourceCss()` returns RAW text for every part. The
   * dependency is load-bearing, because app.css documents the Shiki contract in
   * prose that spells out all four token names, so a scan over raw source reads
   * documentation as though it were CSS and reports every one as a use.
   */
```

### scripts/check-contrast.mjs:838 (WHY, shortened)

both-sides scope why kept; stale measurements moved.

```js
/*
   * SCOPE, ASSERTED, BOTH SIDES. An empty `used` set finds no undeclared token
   * because it looked at nothing, and an empty `declaredAnywhere` set reports
   * every token as undeclared, which fails for the wrong reason and sends the
   * reader to the stylesheet instead of to this parser. Measured 2026-08-21 and
   * unchanged when re-measured 2026-08-24: 69 used, 79 declared. The floors were
   * 50 and 60, roughly a quarter under, and are now about eight percent under.
   *
   * The participation floor further down is DELIBERATELY NOT set this way: it is
   * bound to the token count `design-tokens.md` states, which is an independent
   * source, and moving it to track the measurement would make this gate check
   * its own output.
   */
```

### scripts/check-contrast.mjs:882 (CONTRACT, shortened)

heading shortened.

```js
/* -------------------------------------------------------------------------
 * Participation: a declared token that no pair measures is not proven
 * ---------------------------------------------------------------------- */
```

### scripts/check-contrast.mjs:886 (WHY, shortened)

why kept; incident moved.

```js
// The gap this closes was LIVE AND GREEN. v4's five chrome tokens landed in all
// three theme blocks; name parity passed, the literal-hex pass passed, the
// built-CSS pass found all of them, and this gate printed 587 checks and zero
// failures -- while nothing whatsoever measured the chrome's contrast, because
// MATRIX is a hand-transcribed list and none of the five was on it.
//
// Name parity proves a token is DECLARED twice. It never proved a token is
// MEASURED once. Every previous amendment happened to add its rows by hand, so
// the omission had no way to show itself until an amendment forgot.
//
// The exemption map is CLOSED and self-policing: an entry naming a token that
// no longer exists, or one that has since joined the matrix, fails here rather
// than quietly widening the hole.
```

### scripts/check-contrast.mjs:901 (WHY, shortened)

shortened.

```js
// THE PAPER, GLASS, LIGHT ENTRIES. Every one is a token whose job carries no
  // contrast obligation, not a token nobody got round to measuring.
```

### scripts/check-contrast.mjs:921 (WHY, shortened)

why kept, shortened.

```js
// The ramp steps no series slot resolves through. They are fills, letterbox
  // grounds and spare tints: step 4's rule is that a shape's INTERIOR may sit
  // lighter than 3:1 and only its EDGE may not, and an edge is always a slot.
  // A step that a slot later adopts stops being exempt on that day, because
  // the participation pass walks the slot's chain and this map refuses an
  // entry that has joined the matrix.
```

### scripts/check-contrast.mjs:950 (WHY, shortened)

why kept, shortened.

```js
/*
   * PARTICIPATION IS TRANSITIVE, because a token can ship its hex under
   * another name. `--fig-s1` is declared as `var(--fig-purple-500)`, so the
   * ratio the matrix measures for `--fig-s1` IS the ramp step's ratio: the
   * primitive is measured, by the name that ships it. Counting only the names
   * the matrix spells would have forced every ramp step to restate its hex on
   * a slot, which is the second-owner shape rule 17 forbids.
   *
   * Resolved in BOTH modes, and a token counts if either mode resolves through
   * it, because the two themes point their slots at different ramp steps.
   */
```

### scripts/check-contrast.mjs:970 (NUMBER, shortened)

asserted floor 53 kept.

```js
// A zero-scope search reports zero violations. Floor it against the doc's
  // stated 53 purpose-named tokens per mode, so a parser that stopped finding
  // tokens cannot pass this section by finding nothing to check.
```

### scripts/check-contrast.mjs:993 (CONTRACT, shortened)

heading shortened.

```js
/* -------------------------------------------------------------------------
 * The prefers-contrast: more tier (v3 amendment 3)
 * ---------------------------------------------------------------------- */
```

### scripts/check-contrast.mjs:997 (CONTRACT, shortened)

why shortened; tags kept.

```js
/**
 * The high-contrast tier is a palette too, so it is held to the same matrix.
 *
 * It is narrow by design: only muted text and the default border move. That is
 * exactly why it needs checking rather than eyeballing, because a tier nobody
 * verifies is a tier that can quietly contain a value LOWER than the one it
 * replaced and still look like a high-contrast mode.
 *
 * @param {string} label
 * @param {string} selector
 */
```

### scripts/check-contrast.mjs:1083 (CONTRACT, shortened)

heading shortened.

```js
/* -------------------------------------------------------------------------
 * Shiki syntax tokens against the NEW code surfaces
 * ---------------------------------------------------------------------- */
```

### scripts/check-contrast.mjs:1087 (HISTORY, deleted)

prior-verification narrative; next block states the contract.

```js
/**
 * The prior verification was against the themes' own backgrounds and is void:
 * app.css now drops those and puts code on --surface-code, with the
 * highlighted-line band on --surface-popover. Every token colour the theme can
 * emit is checked against both, in the mode that theme serves.
 */
```

### scripts/check-contrast.mjs:1093 (CONTRACT, shortened)

shortened; tag kept.

```js
/**
 * A theme rule may PAIR a foreground with a background of its own. Those tokens
 * never touch our surfaces, so checking them against one would be measuring a
 * combination no reader sees. They are checked against the background they
 * actually ship on, and everything else against both code surfaces.
 *
 * @param {any} theme
 */
```

### scripts/check-contrast.mjs:1122 (WHY, shortened)

fail-closed exemption kept; upstream measurements moved.

```js
/**
 * Every rule that pairs a background is a VCS scope: the diff markup family
 * and carriage-return. None of them can be emitted here, because `diff` is not
 * a loaded grammar and the content paths are pinned to LF by .gitattributes.
 *
 * Three of them fail against their own backgrounds upstream in
 * github-dark-high-contrast (carriage-return 2.12, markup.deleted 4.35,
 * markup.changed 3.31). They are reported and not counted as failures, but the
 * exemption FAILS CLOSED: it is conditioned on `diff` being absent from
 * LANGUAGES, which is asserted rather than assumed. Add diff as a language and
 * this gate goes red until those colours are dealt with.
 */
```

### scripts/check-contrast.mjs:1186 (CONTRACT, shortened)

heading shortened.

```js
/* -------------------------------------------------------------------------
 * The built stylesheet, when there is one
 * ---------------------------------------------------------------------- */
```

### scripts/check-contrast.mjs:1197 (WHY, shortened)

why kept; narrowing incident moved.

```js
/*
 * THE NEWEST OF EVERY SOURCE STYLESHEET, not app.css alone.
 *
 * This was `statSync(CSS_PATH).mtimeMs` and it narrowed the moment there was a
 * second entry: from 2026-08-23 an edit to `app/admin.css` or any admin part
 * leaves app.css untouched, so a build predating that edit compared as FRESH
 * and the shipped-value section below examined a stylesheet that no longer
 * matched the source. That is the same silence this block was written to end,
 * arriving through a file it could not see.
 *
 * Derived from `stylesheetPaths()`, the one owner of which files the site
 * ships, so a future entry is covered without editing this line.
 */
```

### scripts/check-contrast.mjs:1217 (WHY, shortened)

why kept; audit measurement moved.

```js
/*
   * A STALE BUILD IS NOW A FAILURE, and an ABSENT one is still not. The
   * distinction is the whole finding.
   *
   * This block used to say "skipped as stale" and pass. The external audit
   * measured what that costs: `touch app/app.css` and nothing else drops this
   * gate from 567 checks to 461, EXIT 0. One hundred and six assertions, 18.7
   * percent, gone in silence.
   *
   * And the trigger is the ordinary case. EDITING app.css is what makes it
   * newer than the build, so the section that verifies the SHIPPED stylesheet
   * skipped itself on exactly the runs where a token had just changed, which
   * are the runs it exists for. Absent a build there is genuinely nothing to
   * compare and reporting is right; present-but-stale means someone changed the
   * source and this gate would have told them nothing.
   */
```

### scripts/check-contrast.mjs:1248 (WHY, shortened)

trap kept; first-run incident moved.

```js
// Compare NORMALISED values, never raw text. Lightning CSS rewrites
    // #ffffff to #fff, so a substring match reports three tokens missing from
    // a stylesheet that carries all of them. Measured, not guessed: the first
    // run of this block failed on --on-brand, --on-fill-danger and
    // --on-fill-success, every one of them a white that had been shortened.
```

### scripts/check-contrast.mjs:1272 (WHY, shortened)

trap kept, shortened.

```js
// AND THE INDIRECTIONS. A series slot ships as `--fig-s1:var(--fig-purple-500)`,
    // which the hex pattern above cannot see, so every slot read as "shipped
    // values: none" and failed while being present and correct. The minifier
    // drops the space after the colon, so this matches the built spelling
    // rather than the source's.
```

### scripts/check-contrast.mjs:1303 (CONTRACT, shortened)

heading shortened.

```js
/* -------------------------------------------------------------------------
 * Report
 * ---------------------------------------------------------------------- */
```

### scripts/check-contrast.mjs:1330 (WHY, shortened)

why kept, shortened.

```js
// SIGNED Lc, required by APCA conformance. The sign IS the polarity: positive
// is dark text on a light background, negative is light on dark. Reporting a
// bare magnitude throws that away, and it is the half of the number that says
// which of the two asymmetric curves produced it. Ranked by magnitude, because
// the question is "what is weakest", not "what is most negative".
```

### scripts/check-contrast.mjs:1343 (HISTORY, deleted)

floor measurement narrative; later block owns the floor.

```js
/*
 * A FLOOR ON THIS GATE'S OWN EXECUTED ASSERTIONS.
 *
 * Every other floor in this repo guards a SCOPE: files walked, sites found. A
 * scope floor cannot see control flow skipping a block it already reached, and
 * that is the failure the external audit measured here.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE, 2026-08-13: 599 with the built
 * stylesheet compared, 483 without. Both re-measured by RUNNING the gate, the
 * second by renaming build/client/assets aside and restoring it, never by
 * adding up the sections by hand. Superseded 2026-08-11's 567 and 461: v4 added
 * five chrome pairs (10 checks across two modes), the participation section (2),
 * and ten built-CSS value assertions.
 *
 * CONDITIONAL ON A BUILD BEING PRESENT, and that is not a softening. A fresh
 * checkout has no `build/` at all, because it is gitignored, so a flat floor
 * failed inside check:head's extraction on the first attempt: the gate was
 * green on disk and red against HEAD, which is exactly the divergence check:head
 * exists to surface. It surfaced mine.
 *
 * Absent a build there is genuinely nothing to compare and 483 is the honest
 * full count. Present-but-stale is a failure on its own above; this floor is
 * the second lock on the same door, for the case where that assertion is ever
 * weakened.
 *
 * **RE-MEASURED 2026-08-16, BOTH TIERS, BY RUNNING THEM: 625 with the build
 * present and 501 without.** The scrim pair landed for the media v6 caption
 * bar (`--scrim`, `--on-scrim`), which the participation assertion caught the
 * moment the tokens were declared and before either had a pair.
 *
 * **THE OWED MEASUREMENT IS PAID.** The previous note recorded that renaming
 * `build/` aside had been refused by this filesystem twice, so the no-build
 * tier had never actually been run and 460 was left deliberately loose with the
 * measurement stated as owed rather than done. The rename succeeded this time
 * (`build/client/assets` moved aside, gate run, moved back), and the tier reads
 * 501.
 *
 * **THE ARITHMETIC WOULD HAVE BEEN WRONG AGAIN, THIRD INSTANCE.** Subtracting
 * the previously recorded 132-check gap from 625 predicts 493; the measurement
 * is 501. The two prior instances are on the record in the same class:
 * verify-live's predicted 213 measured 214, and this gate's own prior note
 * carried 599 in its failure message while its prose carried 615. A count is
 * measured or it is a guess with a number attached.
 *
 * Both floors are 94 percent of their own measurement, which is the margin the
 * other gates use: 587 of 625, and 470 of 501.
 */
```

### scripts/check-contrast.mjs:1390 (CONTRACT, shortened)

heading shortened.

```js
/* ---- partial opacity on text is refused ------------------------------- */
```

### scripts/check-contrast.mjs:1392 (WHY, shortened)

reveal-pair and every-member rules kept; narrative moved.

```js
/*
 * THE HOLE THIS CLOSES, and this gate's own header has described it for a week.
 *
 * Everything above reads token hexes and computes ratios. `opacity` is
 * compositing the browser applies AFTERWARDS, so a pair that measures 7:1 here
 * can reach the reader at 4.35:1 and nothing in this file can tell. The header
 * calls every opacity on text "a hole of this shape" and enumerates nineteen
 * declarations by hand. A hand enumeration in a comment is not a gate: it was
 * right when written and could not notice the twentieth.
 *
 * `.heading-anchor` is what made it worth building. Under `(hover: none)` it
 * was `opacity: 0.55` over `--text-muted`, which is a measured token painted at
 * an unmeasured strength, on every heading of every post for every touch
 * reader. It is gone; this is what stops the next one.
 *
 * ## WHAT COUNTS AS PARTIAL, AND WHY 0 AND 1 DO NOT
 *
 * Only `0 < value < 1` is refused. `opacity: 0` and `opacity: 1` are a REVEAL
 * PAIR: the element is either absent or painted at full strength, so nothing is
 * ever composited at a value nobody measured. That is the arrangement
 * `.heading-anchor` now uses inside `@media (hover: hover)`, and refusing it
 * would refuse the fix along with the defect.
 *
 * ## WHAT IT CANNOT DECIDE, WHICH IS WHY THERE IS A LIST
 *
 * Whether a selector paints TEXT needs a rendering, and this gate has none. So
 * the rule is inverted: every partial opacity is refused unless it is named
 * here with a reason. A new one fails until somebody classifies it, which is
 * the direction that cannot go quietly wrong. The reasons below are lifted from
 * the header's own enumeration rather than invented, so there is one
 * classification rather than two.
 *
 * ## KEYED BY PATTERN, NOT BY SELECTOR TEXT, and the first attempt was not
 *
 * The exemptions were written as exact selector strings, and the gate refused
 * `.row-action:disabled` on its first run: the declaration in the file is a
 * comma-separated GROUP of eight disabled-control selectors, and the name I had
 * copied was only its last line. That is the mirror failure in miniature, and
 * the repair is to describe the CLASS rather than transcribe the instance.
 *
 * A group is exempt only when EVERY member of it matches an entry. One
 * unclassified selector in a group of eight is still an unclassified selector,
 * and the alternative rule (exempt if ANY member matches) would let a text
 * selector ride along beside a scrim.
 *
 * @type {Array<{ test: RegExp, why: string }>}
 */
```

### scripts/check-contrast.mjs:1450 (WHY, shortened)

hard rule 10 citation kept.

```js
/*
     * ANCHORED AT THE END, per hard rule 10: a bare `backdrop` would also match
     * a future `.backdrop-blur` or `.admin-backdrop-note`, which is the
     * unanchored-needle class this file has been bitten by before.
     */
```

### scripts/check-contrast.mjs:1505 (WHY, shortened)

shortened.

```js
/*
   * SCOPE FLOOR. A regex that stopped matching would report no partial opacity
   * anywhere, which is exactly what a clean sweep reports. The site has never
   * had fewer than a handful of opacity declarations of any value.
   */
```

### scripts/check-contrast.mjs:1525 (WHY, shortened)

shortened.

```js
/*
   * AND THE LIST DOES NOT ROT. An exemption naming a selector that no longer
   * carries a partial opacity is a licence nobody is using, and the next reader
   * would take it as evidence the pattern is fine.
   */
```

### scripts/check-contrast.mjs:1544 (CONTRACT, shortened)

heading shortened.

```js
/* ---- the theme-color meta tags are a SECOND COPY of two tokens ---------- */
```

### scripts/check-contrast.mjs:1546 (WHY, shortened)

why kept, shortened.

```js
/*
 * `<meta name="theme-color">` paints the browser chrome and the OS task
 * switcher, and neither resolves a custom property, so root.tsx writes the two
 * background hexes out literally. That is a second copy of a value the palette
 * owns, which is exactly what rule 17 forbids leaving unwatched, and the copy
 * is in a file no colour gate reads.
 *
 * So it is watched here. The tags are matched by their media query rather than
 * by position, because two tags differing only in an attribute are the easiest
 * pair in the file to transpose, and a light hex under the dark media query is
 * a defect no page renders differently: it shows up on the phone's chrome and
 * nowhere in any screenshot.
 */
```

### scripts/check-contrast.mjs:1585 (NUMBER, shortened)

asserted floors kept; re-measurement log moved.

```js
/*
 * TWO FLOORS, AND ONLY ONE OF THEM IS REACHABLE ON A DEVELOPER MACHINE.
 *
 * This machine always has build/, so `npm run check` and `check:floors` only
 * ever exercise the build-PRESENT branch. The absent branch runs where nothing
 * has built the client, which in practice means CI, and its floor is therefore
 * the one number here that no local run can observe drifting.
 *
 * That is not hypothetical. On 2026-09-06 the floor sweep re-measured every
 * floor it could REACH, moved seventeen of them, and left this one at 486
 * because reaching it needs build/ moved aside. CI then failed at 3bcf858 with
 * 518 against 486, a gap of 32 against a tolerance of 26. The sweep's own
 * instrument could not see the floor the sweep had missed.
 *
 * RE-MEASURED 2026-09-06 by RUNNING the gate with build/ renamed away, which is
 * the same method the 2026-08-28 entry used and the only one that works: 518
 * absent, 642 present. Floors are those minus the check:floors tolerance at
 * each count, 26 and 33.
 *
 * RE-MEASURED AGAIN 2026-09-08, both branches, by the same method: 520 absent,
 * 644 present. The `:swatch` directive added ONE entry to DECLARED_ELSEWHERE
 * and that map is self-policing, so it contributes two assertions (the token is
 * still used, and it is still not declared) in both branches. Measured rather
 * than added to the old figure, which is the failure the paragraph below
 * describes.
 *
 * When this branch's count moves, CI is the instrument that says so. Re-measure
 * it the same way rather than deriving it from the present-branch number.
 *
 * RE-MEASURED 2026-09-13 for the Paper, Glass, Light token layer, by the same
 * method and in both branches: build/ renamed away gives 792, build/ in place
 * gives 1022, after the disabled exemption and the axis-stroke row. The jump is the new palette's matrix rows, the mix-composites
 * pass and the var()-resolution pass, and it is why the floors below moved by
 * hundreds rather than by a handful.
 *
 * Floors are those counts minus ONE UNDER check:floors' own tolerance at each
 * count, max(3, ceil(n * 0.05)) being 40 and 52: 753 and 971, so each floor
 * sits 39 and 51 under its count. One tighter than the maximum slack allowed,
 * deliberately, because the tolerance is the point at which the gate starts
 * complaining and there is no reason to sit exactly on it. Taken from the
 * printed counts, never by arithmetic on the old floors, which is what the
 * paragraphs above record going wrong twice.
 *
 * RE-MEASURED 2026-09-14, BOTH BRANCHES, BY RUNNING THEM, when the bar's six
 * matrix rows and the four tokens they measured were deleted: 754 with build/
 * renamed away and 976 with it in place, against 792 and 1022 before.
 *
 * THE MOVE IS 46 AND 38, WHICH IS NOT WHAT SIX ROWS LOOK LIKE, and that is the
 * reason to run rather than subtract. A matrix row is not one assertion: it is
 * measured per mode, walked again by the var()-resolution pass, and compared
 * again against the built stylesheet in the present branch. Three of the four
 * deleted tokens also shipped as a hex plus a color-mix recipe, so each took
 * three assertions per mode out of the composite pass as well.
 *
 * BOTH OLD FLOORS WOULD HAVE HELD AND BOTH WERE WRONG TO KEEP. 976 cleared 971
 * by five and 754 cleared 753 by ONE. A floor one under its count fails the
 * next honest change and reports it as "a block was SKIPPED", which is the
 * misleading failure this instrument exists to avoid producing. Reset to the
 * same rule as the line above: tolerance 49 and 38, so 928 and 717.
 *
 * RE-MEASURED 2026-09-14, BOTH BRANCHES BY RUNNING THEM, after the bar's lamp
 * chroma and four orphaned tokens were deleted with their matrix rows and
 * their NON_PARTICIPATING entries: 940 present and 728 absent, against 976 and
 * 754. Three matrix rows and two exemption entries left, and the move is 36
 * and 26, which is again not what five entries look like from the outside and
 * is again why it was RUN.
 *
 * Floors one under tolerance, 47 and 37: 894 and 692.
 *
 * RE-MEASURED 2026-09-14, BOTH BRANCHES BY RUNNING THEM, after the info role's
 * four tokens and their four matrix rows were deleted: 916 present and 712
 * absent, against 940 and 728. Floors one under tolerance, 46 and 36: 871 and
 * 677.
 */
```

## scripts/check-all.mjs

### scripts/check-all.mjs:1 (CONTRACT, shortened)

usage, boundary and run-everything contract kept; the incident and the gate-count story moved.

```js
/**
 * Runs every gate and reports one table.
 *
 *   npm run check         the offline tier: everything that needs no network
 *   npm run check:all     adds the gates that need a deployed database or bucket
 *
 * OBSERVATION BOUNDARY: this runs gates and reports their exit codes. It does
 * not know what any of them checks, cannot tell a gate that passed from one that
 * passed vacuously, and a gate that exits 0 while examining nothing is invisible
 * here. That property belongs to each gate, and it is why every one of them
 * carries its own boundary note.
 *
 * ## Why this exists
 *
 * Two defects shipped in three sessions because a gate was silently not run.
 * `check:admin-ui` was red for two full sessions after a loader-shape change,
 * and nobody noticed because running gates meant remembering which ones the
 * change touched. Remembering is not a mechanism. One command that runs all of
 * them is.
 *
 * ## It runs everything, then reports
 *
 * A runner that stops at the first failure hides every gate behind it, which is
 * exactly how one red gate masks a second. Every gate runs, always, and the
 * table at the end is the whole picture.
 *
 * ## The list is DERIVED
 *
 * Parsed out of package.json's `check:*` scripts, on the same rule
 * `check-backup.mjs` follows for its table list: a hardcoded list is how the
 * next gate gets forgotten. That is not hypothetical here. The instruction that
 * asked for this runner named eleven gates and listed twelve, and the repo has
 * THIRTEEN: `check:llms` appeared in neither count.
 */
```

### scripts/check-all.mjs:48 (WHY, shortened)

read-before-truncate and union whys kept; the 2026-09 kill measurements moved.

```js
/**
 * WHERE THE MEMORY SAMPLES GO, and why this run keeps the previous one's file.
 *
 * The OS killed five `check:all` runs for low memory between 2026-09-05 and
 * 2026-09-09 and rebooted the machine once. An OS kill under memory pressure
 * does not take the tree: it takes the process it picked, so the runner dies
 * and its grandchildren keep their pages. The heaviest of them is not small.
 * Measured 2026-09-09 during `check:browser`: a `vite preview` host holding
 * 952 MB with two `workerd` children beside it.
 *
 * So the previous run's file is READ BEFORE this run truncates it. It is the
 * only record of what that run was holding when it died.
 *
 * The read is a UNION over the last stretch of sampling rather than the final
 * row, and that distinction was paid for on 2026-09-09: a run exhausted the
 * machine, 14 processes holding 1678 MB survived it, and the final row named
 * two of them. The heavy ones came from `check:head` minutes earlier and were
 * still resident. Grounds on `treeSince`.
 */
```

### scripts/check-all.mjs:69 (NUMBER, shortened)

value asserted by the code below; the method stays, the dated 35 to 40 history moved.

```js
/**
 * The floor. Fails closed when fewer gates are discovered than this.
 *
 * A count, not a list, so it cannot go stale in the direction that matters: a
 * gate deleted, a script renamed out of the `check:` namespace, or a glob that
 * quietly stops matching all show up as a smaller number. It only ever moves UP,
 * and moving it is a deliberate edit in the same commit as the gate.
 *
 * MEASURED BY RUNNING, 2026-09-12, which is the only way this number is allowed
 * to move. It read 35 against a discovered 36, so one gate could already have
 * been deleted and the floor would have held: exactly the shape FAILURES.md
 * records as "a limit positioned where it cannot bite". Adding
 * `check:publications` took the count to 37 and the arithmetic answer would
 * have been 36, preserving the gap. The run said 37, so it is 37.
 *
 * `check:fonts` took it to 38 on 2026-09-12, and the number came the same way:
 * the run printed `gates-discovered executed=38`, so it is 38.
 *
 * `check:volumes` took it to 39 on 2026-09-15, by the same method: the run
 * printed `gates-discovered executed=39`. It is the freeze-point gate for the
 * decisions volumes, and it is NETWORK tiered because a volume is a Capsid
 * document with no disk to read.
 *
 * `check:hook-matchers` took it to 40 later the same day, by the same method:
 * the run printed `gates-discovered executed=40`. It reads the PreToolUse
 * matchers against the permission allow lists, so it is offline and IN CI.
 */
```

### scripts/check-all.mjs:98 (WHY, shortened)

shortened to one line.

```js
/**
 * The one gate this runner does not spawn like the others, because its input is
 * the other gates' output. Named once so the hold-out and the feed cannot come
 * to disagree about which gate that is.
 */
```

### scripts/check-all.mjs:105 (WHY, shortened)

the dedupe trap kept, trimmed.

```js
/**
 * Gates whose output the floor reader must NOT be fed, with the reason.
 *
 * `check:head` runs the whole offline tier inside an extraction of HEAD, so its
 * stdout carries a full second set of floor lines belonging to OTHER gates and
 * measured against a different tree. Fed in, they arrive after the same gates'
 * own lines and win the dedupe, so a dirty working tree would be judged by the
 * checkout's counts with nothing saying so. `check-floors.mjs` excludes the same
 * gate from its standalone run, for the recursion reason recorded there; this is
 * the same exclusion arriving by a different road.
 *
 * @type {Record<string, string>}
 */
```

### scripts/check-all.mjs:122 (CONTRACT, shortened)

contract kept; the 2026-08-20 measurement moved.

```js
/**
 * Gates a CLEAN CHECKOUT cannot run, each with the reason it cannot.
 *
 * MEASURED 2026-08-20, not guessed: HEAD was extracted with `git archive`,
 * `npm ci` was run in it, and the offline tier was run there. 22 passed, 4
 * failed. Two of those four are real and permanent, and they are here. The other
 * two, `check:content` and `check:head`, failed only because `git archive`
 * produces no `.git` directory; `actions/checkout` provides a real repository,
 * so both work in CI and neither is excluded for that reason.
 *
 * Same shape and the same discipline as `check-head.mjs`'s own EXCLUDED map:
 * a named reason per entry, so an exclusion has to be argued rather than
 * accumulated.
 *
 * @type {Record<string, string>}
 */
```

### scripts/check-all.mjs:139 (WHY, shortened)

why check:config cannot pass in a checkout, trimmed; verbatim output moved.

```js
/*
   * MEASURED in the clean checkout. It asserts the tracked example DIFFERS from
   * the real `wrangler.jsonc` in the two account-scoped ids. A checkout has no
   * real config, `postinstall` bootstraps one BY COPYING the example, so real
   * equals example by construction and the gate cannot pass. Verbatim:
   *
   *   FAIL  example's database_id is not the real one
   *   FAIL  example's KV id is not the real one
   *
   * That is the gate being CORRECT, not a limitation to work around, and it is
   * why this gate is load-bearing on exactly one machine. `check-head.mjs`
   * excludes it for the identical reason.
   */
```

### scripts/check-all.mjs:153 (WHY, shortened)

why no local D1 is provisioned, trimmed; verbatim error moved.

```js
/*
   * MEASURED in the clean checkout. Defaults to `--local`, which reads
   * miniflare state under `.wrangler/`. That directory is gitignored and absent
   * from a checkout. Verbatim:
   *
   *   SENTRY_DO SQLite failed; dbErrorMess...
   *
   * Provisioning a local D1 in CI to satisfy it would be inventing state to
   * check a backup path against, which asserts nothing about the real database.
   */
```

### scripts/check-all.mjs:164 (WHY, shortened)

vacuity reason kept, trimmed.

```js
/*
   * NOT a capability problem. It would very likely RUN in CI, since
   * `actions/checkout` gives a real repository and node ignores the "junction"
   * link type off Windows.
   *
   * It is excluded because it is VACUOUS there. This gate exists to catch disk
   * disagreeing with HEAD, and CI has only HEAD: it checks out the ref into an
   * empty machine, so there is no working tree to diverge. Running it would
   * extract HEAD from a checkout of HEAD and compare it to itself, then report
   * a green it could not have failed. That is the vacuity class this repo names
   * everywhere else, and running it in CI would be adding an instance.
   */
```

### scripts/check-all.mjs:177 (WHY, shortened)

the tier call and its ground kept; the 2026-08 falsified reason, ruling dates and timings moved.

```js
/*
   * Not runnable in CI as it stands, and since 2026-08-25 for ONE reason, not
   * two. The public cases drive a preview build that reads local D1 state, and
   * that state is gitignored, so the aria-current case would find no post to
   * open.
   *
   * The second reason this entry used to carry, "its admin case needs a real
   * session cookie, which CI has no way to hold without a stored credential
   * nobody has ruled on", was FALSIFIED by the smoke credential: the ruling
   * happened (decisions vol 8, 2026-08-24), SMOKE_TOKEN is a stored CI secret,
   * and the admin cases authenticate with it against the DEPLOYED origin, no
   * session cookie involved. Verified on a live run 2026-08-25: 59 checks, the
   * admin block fully executed under the smoke token.
   *
   * So the admin HALF of this gate is CI-capable today and only the public
   * half is not. Splitting the tiers so CI runs the admin sweep, or wiring the
   * whole gate into ship, was Dustin's recorded open call (vol 8).
   *
   * ## THE CALL IS MADE, 2026-09-14: IT STAYS ON THE NETWORK TIER.
   *
   * NOT ship-capable, and the ground is the readiness wait rather than the
   * minutes. The public cases drive a `vite preview` host: MEASURED 51s to
   * first answer on a clear machine and past the 180s ceiling on a loaded one,
   * so on a busy machine this gate reports a red that says nothing about the
   * site. A ship gate that fails on the state of the laptop is worse than no
   * ship gate, because the first thing it teaches is to re-run it.
   *
   * It runs on the daily schedule instead, where a slow boot costs a retry and
   * not a deploy. The readiness probe now classifies WHY it timed out, so a
   * scheduled red is readable without a second run; that is the half that was
   * missing, and it is what made this gate's reputation "broken on this host"
   * for weeks while the measured answer was a slow boot.
   */
```

### scripts/check-all.mjs:211 (WHY, shortened)

why CI does not build the client, trimmed.

```js
/*
   * Reads build/client, which is gitignored build output; the CI job runs
   * `npm ci` and the gates with no client build in front of them. Building in
   * CI to satisfy it would measure a build nothing deploys, since deploys run
   * from this machine's working tree. Same class as check:backup: the input is
   * state a checkout does not have.
   */
```

### scripts/check-all.mjs:221 (CONTRACT, shortened)

tier contract kept, trimmed.

```js
/**
 * Which gates need something this machine may not have.
 *
 * Every discovered gate MUST appear here or the runner refuses to start. That is
 * the same fail-closed shape as the count above, applied to classification: a
 * new gate that nobody tiered would otherwise be silently dropped from the
 * offline run and never noticed, which is the failure this whole file exists
 * about.
 *
 *   offline  no network, no deployed resources. Safe on a plane.
 *   network  reads a deployed D1 database or R2 bucket.
 *
 * @type {Record<string, "offline" | "network" | undefined>}
 */
```

### scripts/check-all.mjs:236 (WHY, shortened)

offline tiering, delegation and ordering whys kept; the 2026-08-20 incident moved.

```js
/*
   * THE TYPECHECK IS A GATE, ruled 2026-08-20 after the suite certified a build
   * it had never compiled.
   *
   * `tsc -b` was a separate npm script and a Stop hook, and neither is the
   * suite. So `npm run check` reported 25 passed 0 failed over source with two
   * TS7006 errors in it, and `check:head` inherited exactly the same blind spot
   * and certified 32 checks 0 failures against the same red build. A suite that
   * certifies a build it never compiled is this repo's own vacuity class raised
   * to the top level: the runner cannot tell a gate that passed from one that
   * passed over code that cannot run.
   *
   * It made it past four separate checks, which is the part worth recording:
   * tsc was not re-run after the change, `npm run check` does not typecheck,
   * `check:head` runs that same offline tier, and the Stop hook reported "No
   * stderr output" because tsc writes diagnostics to STDOUT.
   *
   * OFFLINE, and that is the load-bearing half rather than a formality:
   * `check:head` derives its list from the offline tier, so tiering this here
   * is what makes an extracted HEAD get typechecked too. The worktree already
   * has node_modules by junction and a bootstrapped wrangler.jsonc, which is
   * what `npm run typecheck` needs.
   *
   * IT DELEGATES rather than restating `wrangler types && react-router typegen
   * && tsc -b`, on the same anti-mirror rule the Stop hook follows:
   * package.json is the one place that defines what a typecheck is, and a
   * mirror drifts. This repo has already run a bare `npx tsc -b` against stale
   * generated types for exactly that reason.
   *
   * ALPHABETICAL, NOT FIRST, and the alternative was considered. Running it
   * first would surface the most fundamental failure earliest in a five minute
   * run. It was rejected because this runner's stated principle is that EVERY
   * gate runs and the table at the end is the whole picture, so position
   * changes only when a watcher sees the line, never whether the failure is
   * reported. Hoisting one name would also cost the derivation property that
   * keeps a new gate from being forgotten, which is a worse trade than a later
   * line in a table that is read whole.
   */
```

### scripts/check-all.mjs:274 (WHY, shortened)

shortened to one line.

```js
/*
   * NETWORK, and it cannot be otherwise: a decisions volume is a Capsid
   * document and there is no disk to read. A clean checkout cannot run it, so
   * --ci does not, which is the same reason check:uptime is tiered here.
   */
```

### scripts/check-all.mjs:282 (WHY, shortened)

offline reason and the pipeline boundary kept, trimmed.

```js
/*
   * OFFLINE, and it is the purest offline gate here: it reads two committed
   * JSON files, regenerates `app/data/publications.ts` in memory and compares.
   * No network, no binding, no clock. The network half of the publication
   * pipeline is `pubs-pipeline`, which lives outside this repo on purpose and
   * is never a gate, because a gate that fetches Crossref fails on Crossref's
   * bad day rather than on ours.
   */
```

### scripts/check-all.mjs:295 (WHY, shortened)

shortened to one line.

```js
/*
   * OFFLINE: it reads font binaries off disk and the stylesheets beside them,
   * and asks nothing of the network. Beside check:logo because they are the two
   * gates that open a binary asset rather than read text about one.
   */
```

### scripts/check-all.mjs:301 (WHY, shortened)

what it reads kept; the drift incident moved (ruling 111 cited).

```js
/*
   * OFFLINE. It reads `.design-sync/build-inputs.mjs`, `app/root.tsx`, the
   * non-admin routes and components, and the stylesheets they name -- all off
   * disk, no network, no binding, so `--ci` runs it too.
   *
   * It exists because NOTES.md predicted this drift in prose and nothing
   * re-checked it: `app/styles/shell.css` was imported by root.tsx, absent
   * from SHEETS, and so never reached the canvas -- and that is the sheet
   * defining `.tracks`, the grid the redesign is built on (ruling 111).
   */
```

### scripts/check-all.mjs:312 (WHY, shortened)

tier caveat and diff-scoring why kept; audit count moved.

```js
/*
   * OFFLINE by tier, and the caveat is in the name of the thing it runs:
   * `npx --yes aislop@latest` FETCHES the package, so a machine with no
   * network cannot run it even though nothing it reads is deployed. It is
   * tiered offline because it reads only the working tree and a git ref, and
   * because the alternative, network, is where the gates that need a deployed
   * database live and this is not one of them.
   *
   * IT SCORES THE DIFF, not the tree (`--changes --base origin/main`). The
   * audit reviewed all 83 in-scope findings and every one opened was a false
   * positive on this codebase, so a gate pointed at the tree would be
   * permanently red on the Workers logging API and on prose containing the
   * word PLACEHOLDER. Scoring the diff makes it a ratchet on new code, which
   * is the only shape that is worth having here.
   */
```

### scripts/check-all.mjs:328 (WHY, shortened)

network reason and purpose kept, trimmed (ruling 109 cited).

```js
/*
   * NETWORK, and it cannot be otherwise for the same reason check:volumes is
   * tiered there: the current `updated_at` it compares against lives in Capsid
   * and there is no disk to read, so a clean checkout cannot run it.
   *
   * It asserts that the Capsid documents shipped to the design agent are still
   * current. An export is a copy, a copy cannot know its source moved, and
   * without this the canvas would be handed a reversed ruling with nothing
   * anywhere saying so (ruling 109).
   */
```

### scripts/check-all.mjs:343 (WHY, shortened)

why it can be offline and its build dependency kept, trimmed.

```js
/*
   * OFFLINE, and it can be because it renders rather than fetches. It bundles
   * the three public route components with esbuild and parses the markup with
   * `microformats-parser`, through the same `scripts/lib/route-render.mjs`
   * check:admin-ui uses, so it needs no D1, no bucket and no deployed site.
   *
   * It DOES build the corpus (`buildArtifact`), which needs
   * `content/generated/stack.json`; the tier's preflight already builds
   * content, so the ordering is satisfied for anyone running the tier and named
   * in the gate's own failure text for anyone running it alone.
   */
```

### scripts/check-all.mjs:354 (WHY, shortened)

shortened to one line.

```js
/*
   * OFFLINE. It reads scripts/ as SOURCE and runs no wrangler command, which is
   * the whole point: the defect it refuses is invisible until a --remote run on
   * a runner, and a gate that had to reproduce it would need the runner.
   */
```

### scripts/check-all.mjs:362 (CONTRACT, shortened)

boundary kept, trimmed.

```js
// Reads the two media modules as source and proves every listing axis
  // `listMediaPage` declares is both READ there and FORWARDED by `listMedia`.
  // It runs no query, so it sees an axis DROPPED and not one built into wrong
  // SQL; the query itself is check:media's and verify-live's subject.
```

### scripts/check-all.mjs:367 (CONTRACT, shortened)

boundary kept, trimmed.

```js
// Reads the build on disk under build/client: the manifest, the chunks, and
  // app/enhance/blog.ts as source. No network, but it measures whatever the
  // last `npm run build` produced, and a stale build is certified as itself;
  // the deployed page's script set is verify-live's assertion.
```

### scripts/check-all.mjs:376 (WHY, shortened)

why it runs in CI kept; date moved.

```js
/*
   * OFFLINE, and it has to be: it replays a PreToolUse hook against constructed
   * payloads and reads exit codes. No network, no build, no deployment, and
   * nothing it does depends on which machine it runs on.
   *
   * IN CI TOO, deliberately not excluded. The hook is the only thing standing
   * between a session and an unreproducible deploy of this Worker, and its
   * scope was narrowed on 2026-09-05; a scope change to a guard fails silently
   * and in the permissive direction, which is exactly the class CI should be
   * watching for rather than one machine.
   */
```

### scripts/check-all.mjs:388 (WHY, shortened)

in-CI reason kept; incident date moved.

```js
/*
   * Runs `bash -n` over every hook and compiles the Python each one embeds. No
   * network, no build. IN CI for the same reason check:hook-scope is: a hook
   * that stops parsing takes the session's guards with it, and twice on
   * 2026-09-05 one did.
   */
```

### scripts/check-all.mjs:395 (WHY, shortened)

in-CI reason kept, trimmed.

```js
/*
   * Reads `.claude/settings.json`, the hooks directory, and the permission allow
   * lists. No network, no build, no spawned hook.
   *
   * IN CI, and the reason is the same as its two siblings with one addition: the
   * local settings file is gitignored, so the CI run reads the tracked half and
   * says which half it read. The half CI CAN see is the one that matters most,
   * because a matcher regressing to a Bash-only spelling is a tracked change.
   */
```

### scripts/check-all.mjs:405 (WHY, shortened)

why it is slow and why check:head excludes it, trimmed.

```js
/*
   * OFFLINE, and it is the slowest gate here by a wide margin because it RUNS
   * the other counting gates to read their floor lines back. That cost is the
   * price of comparing a floor against a count rather than against another
   * number in the same file; the alternatives are argued in the gate's own
   * header. `check-head.mjs` EXCLUDES it, or an extraction would run every
   * counting gate inside a gate that is running every counting gate.
   */
```

### scripts/check-all.mjs:421 (CONTRACT, shortened)

boundary kept, trimmed.

```js
// Reads source text under app/ and workers/ and asserts the secret-handling
  // boundary. It cannot see the emitted bundle, so a secret inlined into a
  // client chunk by a mis-split is invisible here; the header says so.
```

### scripts/check-all.mjs:425 (CONTRACT, shortened)

boundary kept, trimmed.

```js
// sha256s drizzle/*.sql against drizzle/manifest.json, both directions. Reads
  // files and nothing else. It proves the files match the manifest, NOT that
  // the manifest was honest when written and NOT what the live database
  // applied; that half is check:invariants --remote.
```

### scripts/check-all.mjs:430 (CONTRACT, shortened)

boundary kept, trimmed.

```js
// Extracts a ref into a throwaway worktree and runs the offline tier THERE.
  // Offline: git plus a node_modules junction, no network. It is the only gate
  // that observes a CHECKOUT rather than the disk, so it sees uncommitted work
  // and line-ending divergence; it cannot see the deployed build, and it
  // inherits the blindness of the two gates it must exclude.
```

### scripts/check-all.mjs:440 (CONTRACT, shortened)

subject, boundary and the enforced offline guard kept; first-run story moved.

```js
/*
   * The SECOND behavioural gate, and it observes a different subject.
   * `check:tests` imports pure modules into node; this runs the Worker's own
   * modules inside workerd against miniflare-local D1, KV, R2, a Durable
   * Object and the Cache API, so it sees a loader, an action and the entry
   * itself. It cannot see the deployed build or the platform's cache, which
   * are verify-live's and check:browser's.
   *
   * OFFLINE, and asserted rather than asserted-by-hope: `test/worker/setup.ts`
   * installs a `fetch` that THROWS on any outbound call, and
   * `foundation.test.ts` proves it is installed. The layer found its own
   * violation of this on its first run, when /api/health's content-drift check
   * reached api.github.com for real.
   */
```

### scripts/check-all.mjs:464 (WHY, shortened)

shortened to one line.

```js
// NO OFFLINE MODE THAT MEANS ANYTHING. It reconciles D1 against two R2
  // buckets, and --local reads an empty miniflare bucket, so a local run would
  // report drift that does not exist. Network tier, always.
```

### scripts/check-all.mjs:467 (WHY, shortened)

the two reasons it is not offline and the consequence kept; timing and recommendation moved.

```js
/*
   * NETWORK, and the tiering was the hardest call in this gate.
   *
   * It wants to be offline: it drives localhost and asserts nothing about a
   * deployed resource. Two measured facts stop it. Starting the preview server
   * prints "Establishing remote connection" because the AI_SEARCH binding
   * always reaches a real instance even in local dev, so the offline tier's
   * contract, safe on a plane, would be false. And it costs 67s measured,
   * against a 26-gate tier, which is a large tax on every run of the tier ship
   * executes.
   *
   * The consequence is stated rather than hidden: `npm run check` does NOT run
   * this, so neither does `ship`. Layout defects can still ship. Wiring it into
   * ship is a one-line change and is RECOMMENDED, not taken here, because
   * changing what ship refuses is a decision about the release path rather than
   * part of building an instrument.
   */
```

### scripts/check-all.mjs:486 (WHY, shortened)

vacuity reason kept, trimmed.

```js
/*
   * NETWORK, and it could not be anything else. It fetches the transform route
   * and compares what comes back against the origin object, so it needs both a
   * deployed Worker and the R2 objects behind it. `--local` would read an empty
   * bucket and report a clean sweep, which is the vacuity its own floor exists
   * to refuse.
   */
```

### scripts/check-all.mjs:494 (WHY, shortened)

network reason kept, trimmed.

```js
/*
   * NETWORK, and there is no local form of it to fall back to. It reads the
   * monitors off UptimeRobot's API with an operator credential from `.dev.vars`,
   * and a clean checkout has neither the credential nor anything local to read:
   * an "offline" mode could only report that it did not look, which is the
   * vacuity its own fail-closed branches exist to refuse.
   */
```

### scripts/check-all.mjs:503 (WHY, shortened)

why no local form, and why it is weekly, trimmed.

```js
/*
   * NETWORK, and there is no offline form of it that means anything.
   *
   * It creates a real D1 database, applies the migrations to it, loads an
   * export taken from the deployed database, and deletes it again. A `--local`
   * form would restore miniflare state into miniflare state and compare an
   * empty database with an empty database, which is the vacuity every floor in
   * this repo exists to refuse.
   *
   * It is also the most EXPENSIVE gate here by wall clock, because every step
   * is a round trip to the platform rather than a local read. That is why the
   * weekly workflow runs it and `check:all` reaches it only when somebody asks
   * for the whole tier.
   */
```

### scripts/check-all.mjs:532 (WHY, shortened)

what --remote adds kept; the fifteen-day incident moved.

```js
/*
   * Its config-against-example comparison is pure and stays in the offline tier
   * ship runs. `--remote` adds the third source, the cron triggers actually
   * REGISTERED on the two Workers, which is where a trigger that exists on the
   * platform and in no config shows up and nowhere else. One did, hourly, for
   * fifteen days.
   */
```

### scripts/check-all.mjs:549 (WHY, shortened)

one-derivation and self-invocation whys kept; the colophon story moved.

```js
/*
   * ONE DERIVATION, imported rather than restated. This file and
   * `build-stack.mjs` both used to filter `check:*` themselves, agreeing until
   * one of them gained a case: `check:ci` is the second aggregate runner, and
   * the colophon's copy would have listed it as a gate and claimed 28 where 27
   * exist. Excluding a runner here is not tidiness either, it is what stops the
   * runner invoking itself forever.
   */
```

### scripts/check-all.mjs:592 (WHY, shortened)

the errored-gate rule, its test and its licence kept; incidents and the first-attempt story moved (hard rule 12 citation kept).

```js
/*
   * A GATE THAT COULD NOT RUN IS NOT A GATE THAT FAILED, and the table must not
   * say it was.
   *
   * ## MEASURED, and it cost three diagnoses
   *
   * A `ship` run recorded `check:types FAILED (2.5s)`, `check:urls FAILED
   * (0.0s)` and `check:worker FAILED (0.0s)`, each with an EMPTY output
   * section, immediately after a 258.6s `check:head`. Nothing ran, so nothing
   * was asserted about the subject either way. The same shape is recorded in
   * `check-head.mjs` from 2026-08-20, where fourteen consecutive gates
   * "failed" in 0.0 to 0.2s and every one was green when re-run alone.
   *
   * Reported as FAILED, that is a lie in the direction that wastes the most
   * time: somebody goes looking for a defect in a gate's subject when the
   * finding is that the machine ran out of room. It is also the direction that
   * can hide a real regression, because three noisy reds train the reader to
   * re-run rather than read.
   *
   * ## THE TEST IS THE SHAPE, NOT AN EXIT CODE, AND THAT IS THE SECOND ATTEMPT
   *
   * The first version tested for a `spawnSync` error, a null status, a signal,
   * or exit 143. It was proven by planting a gate that exits 143, it passed
   * that plant, AND IT DID NOTHING WHEN THE REAL CASCADE HAPPENED: a killed
   * ship on 2026-08-31 reproduced all sixteen empty gates and the summary still
   * read `9 passed, 16 failed`. The plant had confirmed the model rather than
   * the world, which is hard rule 12's own warning about a dichotomy
   * inheriting its author's frame.
   *
   * The measured signature of the real event is: `error` undefined, `signal`
   * null, `status` a number that is neither 0 nor 143, and BOTH STREAMS EMPTY.
   * Only the last of those distinguishes it from an ordinary failure, so it is
   * the whole test. An exit code list can always be one code short; "it printed
   * nothing at all" cannot.
   *
   * ## WHAT LICENSES THE SHAPE IS A MEASUREMENT, NOT AN ARGUMENT
   *
   * Every offline gate was run and both streams were counted in bytes, on
   * 2026-08-31: 25 of 25 wrote to stdout, none produced zero bytes on both
   * streams, and the quietest wrote 81. So an empty pair cannot be a gate that
   * ran, because no gate in this repo is capable of running silently.
   *
   * BOTH streams, never either: 23 of those 25 wrote nothing to stderr on a
   * clean pass, so testing either one alone would call almost every green gate
   * an error. If a future gate is ever written to succeed silently, this
   * misreports it, and the repair is to make that gate say something, which
   * every other gate here already does.
   *
   * NOT FOLDED INTO `ok`. An errored gate is not a pass, so `ok` stays false and
   * every caller that gates on it, including the two builds above, still
   * refuses.
   */
```

### scripts/check-all.mjs:648 (WHY, shortened)

shortened to one line.

```js
/*
   * The reason REPORTS the disposition; it never decides it. Whatever the exit
   * code turns out to be on the next host, the classification above already
   * happened and this only says what was seen alongside it.
   */
```

### scripts/check-all.mjs:665 (WHY, shortened)

why the status is a field, trimmed.

```js
/*
     * THE STATUS AS A NUMBER, not only inside the reason sentence below.
     * The environment classifier correlates it across gates, and parsing it
     * back out of human prose would make that sentence's wording
     * load-bearing.
     */
```

### scripts/check-all.mjs:675 (CONTRACT, shortened)

null-is-not-zero contract kept, trimmed.

```js
/*
     * Filled in by the caller, which owns the clock: this function cannot see
     * the sample file's window because it IS the window. Null means the
     * sampler did not run or the gate finished inside one sampling interval,
     * and null is deliberately not zero.
     *
     * @type {number | null}
     */
```

### scripts/check-all.mjs:687 (WHY, shortened)

the four conditions and what it does not claim kept; the 2026-09-15 measurements moved (hard rule 10 citation kept).

```js
/*
 * ENVIRONMENT FAILURE: ONE FACT ABOUT THE MACHINE, NOT N FACTS ABOUT THE REPO.
 *
 * MEASURED 2026-09-15, twice on this host. First `check:floors` alone, under a
 * low-memory kill. Then all 32 offline gates at once, immediately after an
 * `npm ci` pushed 760 packages through the filesystem cache and a full build
 * ran. Every one of the 32 ended in 0.0s, wrote nothing to either stream, and
 * carried status 3221225794, which is 0xC0000142 STATUS_DLL_INIT_FAILED: a
 * process that never reached main. The four SEQUENTIAL build steps in the same
 * run spawned fine and a single gate run by hand a minute later passed, so the
 * discriminator was concurrency, not the repo.
 *
 * The tier reported "0 passed, 0 failed, 32 errored" above thirty-two separate
 * no-verdict banners. Every word of that is true and it reads like the repo
 * broke. The paragraph under the summary already said the usual cause is a
 * saturated machine; nobody reaches it after thirty-two banners.
 *
 * ## FOUR CONDITIONS IN CONJUNCTION, AND ONE OF THEM DOES THE SAFETY WORK
 *
 *   1. BOTH STREAMS EMPTY. The existing `errored` test, and the ONLY one that
 *      can keep a real failure out of this branch. Licensed by the measurement
 *      recorded in runGate above: 25 of 25 offline gates wrote to stdout on a
 *      clean pass and the quietest wrote 81 bytes, so no gate here is capable
 *      of running silently. A gate that RAN has something to say.
 *   2. A STATUS AT OR ABOVE 0xC0000000, the NTSTATUS failure range. This is
 *      NOT load-bearing on its own and this comment will not pretend it is: on
 *      Windows a process CAN exit with such a value deliberately, because the
 *      exit code is a full DWORD rather than a byte. What it adds is the
 *      distinction between the OS ending a process at init and an ordinary
 *      nonzero exit. Condition 1 is what makes the pair safe.
 *   3. FASTER THAN ONE SECOND. A process that never reached main cannot have
 *      taken longer. Measured at 0.0s for all 32; the threshold is loose on
 *      purpose, because tightening it toward the measurement would make a
 *      slower host silently stop matching.
 *   4. MORE THAN ONE GATE, SAME STATUS, SAME RUN. This is the condition that
 *      earns the word "environment". One gate erroring is ambiguous and stays
 *      ambiguous. Thirty-two erroring identically at the same instant cannot
 *      be thirty-two independent facts about thirty-two different subjects.
 *
 * ## WHAT IT DELIBERATELY DOES NOT CLAIM
 *
 * It does NOT cover the POSIX shape of the same event, where a process killed
 * before exec arrives with `signal` set or a spawn error rather than an
 * NTSTATUS. That variant has not been measured here, and a branch written for
 * a signature nobody has seen is a condition nobody can show firing, which is
 * the class this repo spent 2026-09-14 closing in check:invariants section 31.
 * The platform-neutral half is `errored` itself, unchanged, and it still
 * catches that case and reports it as an errored gate.
 *
 * It does NOT change the verdict. An unrun gate covers nothing, so the tier
 * still exits nonzero. Only the exit CODE differs, so a caller can tell the
 * machine from the repo without parsing prose.
 *
 * PROVEN IN BOTH DIRECTIONS by test/check-all-environment.test.mjs, and the
 * second direction is the one that matters: a synthetic gate that genuinely
 * failed, with a non-empty stderr and status 1, must still report as a gate
 * failure. A classifier that calls everything the machine agrees with
 * everything, which is hard rule 10's unfailable-condition class.
 */
```

### scripts/check-all.mjs:749 (CONTRACT, shortened)

shortened to one line.

```js
/**
 * The ones seen or expected on this host; anything else prints as bare hex.
 * @type {Record<number, string>}
 */
```

### scripts/check-all.mjs:801 (WHY, shortened)

order why kept; the ruling 39a history moved.

```js
/*
   * THE STACK ARTIFACT, BUILT FIRST, and the order is load-bearing rather than
   * tidy: `build:content` reads content/generated/stack.json to emit the
   * colophon's page records, so a run that built the corpus first would render
   * pages from whatever stack.json a previous run left behind.
   *
   * Gitignored since ruling 39a. It was committed and byte-gated until then,
   * which made every package.json change a two-file change and put every
   * Renovate PR red on check:stack with no defect in it. Same class of step as
   * the two below: not a gate, no table row, no floor.
   */
```

### scripts/check-all.mjs:823 (WHY, shortened)

build-before-read and loud-refusal whys kept, trimmed.

```js
/*
   * THE LOCAL BUILD PRODUCT IS BUILT BEFORE ANY GATE READS IT. Since the
   * artifact arc, content/generated/posts.json is gitignored: git holds
   * markdown, D1 holds the rendered copy, and this file exists on disk only
   * because something built it. Several offline gates read it
   * (check:content's determinism pass builds its own, check:diagrams,
   * check:features and the sync path read the file), so a runner that did
   * not build first would read whatever a previous run left behind, or
   * nothing. Refused loudly rather than left to each gate's own missing-file
   * message, because "the build is broken" and "a gate is red" are different
   * findings and the table below should carry the second kind only.
   *
   * Not a gate: it appears in no table and counts toward no floor. It is the
   * same class of step as `actions/checkout`.
   */
```

### scripts/check-all.mjs:849 (WHY, shortened)

why the twins are built first, trimmed.

```js
/*
   * THE PUBLICATION TWINS, same class again: public/publications/*.md is
   * gitignored build product, and `check:publications` compares what is on disk
   * against a fresh generation. Without this step that comparison reads
   * whatever the last run left, which on a fresh clone is nothing and on a
   * stale tree is the previous corpus. Both are the drift the comparison exists
   * to find, arriving as the comparison's own input. Not a gate: no table row,
   * no floor.
   */
```

### scripts/check-all.mjs:869 (WHY, shortened)

why the bundles are built first, trimmed.

```js
/*
   * THE ENHANCEMENT BUNDLES, same class as build:content: app/enhance/dist/ is
   * gitignored build product, the app build's ?url imports refuse to resolve
   * without it, and a stale bundle on disk would be certified as itself by any
   * gate that reads the build. Built here so the tier never depends on a
   * previous run having left the right bytes behind. Not a gate: no table row,
   * no floor.
   */
```

### scripts/check-all.mjs:888 (WHY, shortened)

derived-exclusion direction kept, trimmed.

```js
/*
   * THE CI TIER IS THE OFFLINE TIER MINUS CI_EXCLUDED, derived rather than
   * listed, so a gate added tomorrow is in CI by default and has to be argued
   * OUT rather than remembered IN. That direction is the whole point: the
   * failure this file exists about is a gate silently not running.
   *
   * `--all` and `--ci` are not combinable, and nothing tries: `--all` adds the
   * network tier, which is exactly what CI has no credentials for.
   */
```

### scripts/check-all.mjs:926 (WHY, shortened)

preflight purpose and the by-pid prohibition kept; the 2026-09-09 measurement moved.

```js
/*
   * PREFLIGHT: WHAT THE LAST RUN LEFT ALIVE.
   *
   * Reads the previous run's final sample and tree-kills anything in it that
   * is still running. This is the half that addresses the actual incident:
   * gates inside one run cannot overlap (the loop below is a blocking
   * `spawnSync`, measured, not assumed), so the memory that accumulates comes
   * from RUNS, not from gates racing each other. A killed run's orphans are
   * still holding their pages when the next run starts, and the next run then
   * starts that much closer to the ceiling.
   *
   * BY PID, NEVER BY NAME. `killTree` is `taskkill /F /T /PID`. A name match
   * for `node` or `chrome` on this machine reaches Dustin's own editor and
   * browser: measured 2026-09-09, a bare name match selects 18 Chrome
   * processes belonging to his session. An absent pid is simply done, and pids
   * are reused, so anything that will not die is reported rather than chased.
   */
```

### scripts/check-all.mjs:945 (WHY, shortened)

one-read liveness why kept; the 47-kill incident moved.

```js
/*
     * LIVENESS FIRST, IN ONE READ. Most recorded pids are already gone: a run
     * that ended normally leaves a full window of them. Calling `killTree` on
     * each would spawn a `taskkill` per dead pid, and a burst of dozens of
     * process creations is the one thing this machine has just demonstrated it
     * handles badly. Measured 2026-09-09: a preflight over 47 recorded pids ran
     * 47 kills and every gate after it failed to start with 0xC0000142, which
     * is Windows refusing to initialise a process.
     *
     * One process table read answers the question for all of them, and it is
     * the same read `descendantPids` already uses.
     */
```

### scripts/check-all.mjs:978 (CONTRACT, shortened)

what it covers and what it cannot, trimmed.

```js
/**
   * KILLS THIS RUN'S OWN TREE. Registered for a normal exit and for both
   * signals, so a Ctrl+C stops leaving the heavy children behind.
   *
   * It cannot cover every case and says so rather than pretending: a
   * `taskkill /F` of this process, and an OS kill under memory pressure, run
   * no handler at all. That is precisely why the preflight above exists, and
   * between the two the orphan either dies now or dies at the start of the
   * next run.
   */
```

### scripts/check-all.mjs:1011 (WHY, shortened)

why check:floors is fed rather than spawned, trimmed; the timing moved.

```js
/*
   * check:floors RUNS LAST AND READS, RATHER THAN RUNNING EVERYTHING AGAIN.
   *
   * It compares each floor against the count the owning gate printed, and every
   * one of those lines is already in the output captured just below. Spawning it
   * as an ordinary gate made it re-run the whole offline tier to reproduce text
   * this loop had already collected: 223.3s of a 1065s tier, measured 2026-09-06,
   * paid on every ship.
   *
   * So it is held out of the loop and fed afterwards. Held out rather than
   * reordered in the list, because the list is DERIVED and sorting it by hand
   * would be a second opinion about what runs.
   */
```

### scripts/check-all.mjs:1028 (WHY, shortened)

the marker, its citation and the partial-map why kept, trimmed.

```js
// JUSTIFIED SUBSTITUTION (hard rule 13). `REMOTE_ARGS` is DELIBERATELY
    // PARTIAL: most gates take no remote arguments, and their absence from the
    // map means exactly that. The empty array is the correct value for a gate
    // with no extra args, not a stand-in for a missing one, so nothing is being
    // masked. Contrast WHY_LABEL and STATUS_LABEL, where every key was supposed
    // to be present and the fallback hid the omission.
```

### scripts/check-all.mjs:1040 (WHY, shortened)

window-closing why kept, trimmed.

```js
/*
     * The window closes AFTER the gate returns, so a sample taken while its
     * children were still dying belongs to the gate that spawned them rather
     * than to whichever gate runs next. The gates cannot overlap, so the
     * windows cannot either.
     */
```

### scripts/check-all.mjs:1059 (WHY, shortened)

why gates are passed and only passes are fed, trimmed.

```js
/*
   * THE FLOOR READER, fed the run that just happened.
   *
   * `gates` is passed separately and is not derivable from the text: the
   * silent-gate assertion asks which gates printed NO floor line, and a gate
   * that printed nothing leaves no trace in a concatenation of what was
   * printed.
   *
   * Only gates that PASSED contribute. A floor line from a gate that then
   * refused is a number the producing gate disowned, and check:all is already
   * reporting that gate as red; letting its floors through would have the same
   * failure argued twice, in two voices, one of them wrong about the cause.
   */
```

### scripts/check-all.mjs:1118 (WHY, shortened)

shortened to one line.

```js
// The failing output, in full, AFTER the run rather than interleaved. A
  // failure buried in the middle of thirteen gates' output is a failure nobody
  // reads.
```

### scripts/check-all.mjs:1126 (WHY, shortened)

shortened to one line.

```js
/*
   * CORRELATED FIRST. When the whole errored set is one machine event, thirty
   * two banners below would bury the finding under its own symptoms.
   */
```

### scripts/check-all.mjs:1133 (WHY, shortened)

trimmed to the rule.

```js
// Errored gates get their own block, and the empty output IS the evidence: a
  // gate that never started has nothing to say, and printing that emptiness
  // under its own heading is what distinguishes it from a silent failure.
  // Gates inside a correlated environment event are listed once, together,
  // under the banner further down instead of once each up here.
```

### scripts/check-all.mjs:1141 (WHY, shortened)

unfailable-branch why kept, trimmed (hard rule 10 citation kept).

```js
/*
     * There is deliberately nothing to print after that line. An errored gate
     * is DEFINED by both its streams being empty, so a branch here for the case
     * where it said something would be a condition that cannot be true, which
     * is hard rule 10's first class. The emptiness IS the evidence.
     */
```

### scripts/check-all.mjs:1164 (WHY, shortened)

trimmed.

```js
/*
   * PEAK MEMORY IN THE SUMMARY LINE, because the number that matters for an
   * out-of-memory kill is the highest point the tier reached, and which gate
   * was holding it. A per-gate table nobody totals is a table nobody reads.
   */
```

### scripts/check-all.mjs:1224 (WHY, shortened)

shortened to one line.

```js
// An errored run exits nonzero too. It did not prove the tier green, and the
  // one thing that must never happen is a ship reading "0 failed" off a tier
  // where three gates never started.
```

### scripts/check-all.mjs:1227 (WHY, shortened)

exitCode-not-exit and the explicit cleanUp why kept; the 2026-09-13 investigation moved.

```js
/*
   * THE EXIT CODE IS SET, NOT TAKEN, on the precedent check-config.mjs records.
   *
   * That gate measured process.exit() tearing its process down while sockets
   * were still closing: it printed a clean table and then exited 127, and its
   * own comment names the consequence, that "check-all.mjs reads exit codes and
   * cannot see the clean table above one". It and check:uptime were converted
   * to process.exitCode for that reason, and check:fonts was written that way.
   * This process writes the tier report every ship reads, and it was the last
   * one still tearing itself down at the end of writing it.
   *
   * NOT CLAIMED TO FIX ANYTHING OBSERVED. Three runs on 2026-09-13 ended after
   * the banner with a partial report and exit 1, and that symptom was NEVER
   * REPRODUCED: not by the tier under the same redirect, not by a controlled
   * 2000-line process.exit() reproduction, and no resource-exhaustion event
   * backs the alternative reading. This change is precedent conformance and
   * hang safety, and nothing more. The symptom is QUEUED rather than diagnosed,
   * with three preserved logs: before-fix.log, check-g3b.log and check-g3c.log.
   *
   * cleanUp() IS CALLED EXPLICITLY, and that is what makes this safe rather
   * than a hang. The sampler is spawned with detached:false and is never
   * unref()d, so the event loop cannot drain while it lives, and the
   * process.on("exit") handler that would stop it never runs, because the
   * process never reaches exiting. The cleanedUp guard makes the later call
   * from that handler a no-op.
   */
```

### scripts/check-all.mjs:1254 (WHY, shortened)

shortened to one line.

```js
/*
   * TWO IS THE MACHINE, ONE IS THE REPO, AND BOTH ARE NONZERO. A real gate
   * failure outranks an environment event: if anything actually reported
   * red, that is the finding and the exit code says so.
   */
```

### scripts/check-all.mjs:1263 (WHY, shortened)

guard purpose and the pathToFileURL trap kept, trimmed.

```js
/*
 * MAIN GUARD, so `TIERS` above can be imported without running the suite.
 *
 * `check:floors` needs the tier map: it runs gates to read their floor lines
 * back, and it must run the OFFLINE ones only, or an offline tier would reach
 * the network through it. Without this guard, importing that map would start a
 * full check run inside the gate that was asking which gates to run.
 *
 * `pathToFileURL` rather than string surgery on process.argv[1], and the reason
 * is measured in `build-stack.mjs`: on Windows the hand-built `file://C:\...`
 * form never equals import.meta.url, so the guard silently never fires.
 */
```
