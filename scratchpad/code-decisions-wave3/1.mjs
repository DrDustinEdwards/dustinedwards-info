// Chunk 1: workers/app.ts, blocks 0-38. The Worker's two entrypoints.
//
// Written at the calibration waves 1 and 2 settled: a body block is one to two lines, an export
// summary carries its purpose and its boundary and nothing else, and the arcs go to the history
// document. This file is the densest in the wave, four blocks over 1.5 KB and one over 9 KB,
// almost all of it the story of a cache layer that was deleted.
//
// TWO PROHIBITIONS ARE KEPT WORD FOR WORD because they are the whole reason those blocks exist:
// the platform cache is the only cache, and clipboard-write must never be denied.
export default {
  "workers/app.ts#0": [
    "CONTRACT",
    "why the import sits here; the grounds stay on the predicate",
    `The redirect map, imported here rather than inside the predicate: a bare JSON import is what
compiles in this repo and what Node ESM refuses, so the \`.mjs\` module \`node --test\` loads cannot
do it and this one can.`,
  ],
  "workers/app.ts#1": [
    "CONTRACT",
    "why it is re-exported; the measurement goes to the history document",
    `Re-exported so the runtime can find the class its binding names. The Ask spend ceiling is a
Durable Object rather than KV because it has to be exact.`,
  ],
  "workers/app.ts#2": [
    "WHY",
    "the prohibition and what it guards; the binding's history and the measured cache behaviour go to the history document",
    `What a response gets when it never said what it wanted.

OMITTING Cache-Control IS NOT OPTING OUT: the platform stores such a response under heuristic
freshness and COOKIES ARE NOT IN THE KEY, so without this an authenticated /admin render would be
served to anyone asking for that path. The default is the refusal and a route opts IN.`,
  ],
  "workers/app.ts#3": [
    "CONTRACT",
    "what the key carries and the one prohibition; the deleted layer, its measurements, the rulings and the dates go to the history document",
    `WHAT THE CACHE KEY IS: the path, and the theme, which is the only thing read off the cookie and
rides in both the props and the custom key.

**THE PLATFORM CACHE IS THE ONLY CACHE.** \`caches.default\` is used nowhere here, and if you are
about to add a second one, the first was deleted on purpose.

What licenses a key this short is \`check:browser\`, which proves a credentialed reader gets
byte-identical HTML and that the theme moves only \`data-theme\` and the meta.`,
  ],
  "workers/app.ts#4": [
    "CONTRACT",
    "what it returns, why pure, and where the dimension is added; the outlived detail goes to the history document",
    `The cache key and the props for one request. PURE, so it can be tested.

THE THEME DIMENSION IS ADDED ONLY WHERE A DOCUMENT COULD CARRY IT: a GET, not an admin path, not
a request negotiating away from HTML. Admin responses are \`private, no-store\` by their own
declaration, so it is belt and braces there; the negotiated case is not, and the grounds are on
\`negotiatesAwayFromHtml\`.

@param url     the request URL, already parsed by the caller
@param request the incoming request, for its method and Accept
@param theme   the resolved theme, one of the three \`Theme\` values`,
  ],
  "workers/app.ts#5": [
    "WHY",
    "the five prohibitions, each in one line; the ratification dates, the sweep and the copied-snippet story go to the history document",
    `Security headers, on EVERY response: one constant applied on the way out, so a route added later
is covered without anyone remembering.

Four look tightenable and are not:

- **\`Cross-Origin-Resource-Policy: cross-origin\`, NOT \`same-origin\`**, which would stop social
  platforms fetching \`og:image\` and break link previews off-site, where nothing here sees it.
- **\`Cross-Origin-Opener-Policy: same-origin-allow-popups\`. Do not tighten.** The notch is
  insurance against dependency drift in the auth client, on the one door into the private plane.
- **No \`includeSubDomains\`, no \`preload\`**: the parent domain is not ours to assert a policy for.
- **\`X-Frame-Options: DENY\` is a legacy mirror of \`frame-ancestors\`.** Delete it only once the
  CSP is enforcing, or the site spends that window framable.

**THE SITE USES \`clipboard-write\` AND IT MUST NEVER BE DENIED HERE.** It is on the PUBLIC plane,
behind the copy-code, permalink and copy-markdown controls, and the enhancement swallows a
refusing clipboard, so denying it breaks them SILENTLY.`,
  ],
  "workers/app.ts#6": [
    "WHY",
    "the prohibition and what it would do; the sibling gate's instance goes to the history document",
    `ONE STRING LITERAL, never a concatenation: two gates parse this object with a
\`"name": "value"\` regex, so a \`+\`-joined value would parse as its FIRST fragment only and the
gate would compare half a header.`,
  ],
  "workers/app.ts#7": ["HISTORY", "a deleted function's obituary; the principle it carries is stated where the downgrade now lives", null],
  "workers/app.ts#8": ["CONTRACT", "the parameter note; type annotation only"],
  "workers/app.ts#9": [
    "WHY",
    "what is enforced, the live exposure, the two prohibitions and where the builder lives; the eighteen-route walk, the three resolved questions, the falsified option and every date go to the history document",
    `The Phase B policy, and it BLOCKS: \`Content-Security-Policy\`, not \`-Report-Only\`.

**THE SHARED-CACHE NONCE EXPOSURE IS LIVE AND ACCEPTED**: header and body are cached together, so
one nonce is valid for the cache lifetime. Accepted publicly on /colophon rather than in a
comment, a showcase listing only its wins being an advertisement.

\`style-src-attr 'unsafe-inline'\` is deliberate and must not be "fixed"; the measurement is on the
directive in \`./csp.mjs\`, the only copy. **THE ROUTE LIST IS NOT REPEATED HERE**, hard rule 8's
habit: \`check:headers\` owns it both ways, and the paragraph that restated it was wrong three
times, once calling a route \`private, no-store\` when it fell through to hard rule 8's default.

THE BUILDER IS IN \`./csp.mjs\` AS A GATE REQUIREMENT: source text can see two branches exist but
not which one a request gets, and a module can be imported and called.`,
  ],
  "workers/app.ts#10": [
    "CONTRACT",
    "what it writes and the structural claim, with the correction that claim already needed; the dates and the guard reasoning go to the history document",
    `One traffic row per HTML response, into Analytics Engine.

NO CLIENT IDENTIFIER, structurally rather than as a promise: no cookie, no IP, no user agent,
nothing derived from them. THAT CLAIM WAS FALSE FOR ONE ROUTE, a preview URL carrying a
capability in its PATH, so it is written down as a claim that already aged once.

THIS CANNOT FAIL A RESPONSE: never awaited, and wrapped anyway, because "returns immediately" is
not "never throws". The catch is silent so a failed write is neither an error page nor log noise.

@param request  the incoming request
@param response the finished response, read for status and content type
@param env      the Worker environment carrying the ANALYTICS binding
@param url      already parsed by the caller, so this parses nothing twice`,
  ],
  "workers/app.ts#11": [
    "CONTRACT",
    "what is counted; one line already",
    `HTML only. The assets, feeds, twins, /media and the API routes are traffic and not page views.`,
  ],
  "workers/app.ts#12": ["CONTRACT", "what is not a read; one line already"],
  "workers/app.ts#13": [
    "WHY",
    "the rule and why at write time; one line",
    `THE OPERATOR IS NOT AN AUDIENCE, skipped at write time rather than left for a query to filter:
a panel that counts its own author is worse than no panel.`,
  ],
  "workers/app.ts#14": [
    "WHY",
    "what the redaction is and that the old rows cannot be fixed; the date, the token length and the ruling go to the history document",
    `THE PATH IS REDACTED BEFORE THE WRITE, a security control rather than a data choice:
\`/preview/<token>\` puts a CAPABILITY in the URL, and writing it verbatim stored and displayed it.

**AE ROWS ARE IMMUTABLE**, so earlier rows age out rather than being fixed. Bounded on two sides
and accepted on that basis: a token expires whatever the dataset remembers, and reading the
dataset needs a Worker secret.`,
  ],
  "workers/app.ts#15": [
    "WHY",
    "why path, and why the redacted one; the fragmentation measurement goes to the history document",
    `Indexes are the SAMPLING KEY, and path is the right one: it keeps the per-path counts this
exists to produce meaningful under sampling. The REDACTED path necessarily, a distinct index per
token also being the worst possible shape for a sampling key.`,
  ],
  "workers/app.ts#16": ["WHY", "the rule; one line already", `Analytics must never cost a reader their page.`],
  "workers/app.ts#17": [
    "CONTRACT",
    "the export summary, the split, and what it must not do; the ruling, the date and the previous arrangement go to the history document",
    `THE RENDERER: everything that produces a document, and the entrypoint the platform may cache.

Cache is per entrypoint and this Worker's two jobs want opposite answers, so \`default\` is cache
DISABLED and runs always while this is ENABLED and runs on a miss; \`check:config\` compares the
two files that say so.

IT MUST NOT WRITE THE TRAFFIC ROW: on a hit this does not run, so a count here would become a
count of MISSES, looking like readership while moving with cache behaviour.

It owns what belongs to the DOCUMENT, the nonce, render, timing and security headers, the CSP and
hard rule 8's uncached default, because a header stamped after the cache is absent from every hit.`,
  ],
  "workers/app.ts#18": [
    "CONTRACT",
    "parsed once and who reads it; the deleted lookup goes to the history document",
    `Parsed once: the CSP's \`Reporting-Endpoints\` and the admin branch of the policy both read it.`,
  ],
  "workers/app.ts#19": [
    "WHY",
    "why it is generated here and the failure that looks like success; the grounds pointer stays",
    `THE NONCE, GENERATED BEFORE THE RENDER, which is the deviation: everything else here is stamped
onto a finished response, and a nonce cannot be, because the identical value has to reach the
header AND every \`<script>\` in the body. Grounds on \`nonceContext\`.

**A STATIC OR DERIVED NONCE IS THE FAILURE MODE THAT LOOKS EXACTLY LIKE SUCCESS:** every page
renders, nothing reports, and the policy is worth nothing. verify-live asserts two responses
differ, which is the only place that can be seen.`,
  ],
  "workers/app.ts#20": [
    "WHY",
    "why here and not in a loader; the production samples, the route names and the date go to the history document",
    `THE TIMING HEADER IS STAMPED HERE BECAUSE EVERY OTHER PLACE RACES: \`timings\` is ONE shared array
and a matched route's loaders run CONCURRENTLY, so a loader stamping it stamped whatever had
accumulated when IT finished. Here the handler has returned, so the array is complete.

Creating the array stays in the admin middleware, which confines timing to that subtree: a
request that never asked carries \`undefined\` and this block is skipped.`,
  ],
  "workers/app.ts#21": [
    "WHY",
    "what the mark is for and what it is not; the twelve-sample residual goes to the history document",
    `\`worker_total\` BOUNDS EVERYTHING and is the only mark this file adds. It is not an instrument
for the response path, which does not own real time; it is an outer bound, so the residual can be
read off the header rather than reconstructed from a browser.`,
  ],
  "workers/app.ts#22": ["HISTORY", "a deleted rule's obituary; the surviving downgrade states its own reason where it now lives", null],
  "workers/app.ts#23": [
    "WHY",
    "the property and why the rebuild is the catch branch",
    `ALL response-level policy in ONE place with ONE immutable fallback. \`Response.redirect()\` and
friends return immutable headers, so a \`set\` throws and rebuilding is the only way to stamp
them; rebuilding stays on the catch branch because routing every response through a new one is
pointless work on the routes that stream.

The property is that the security headers reach EVERY response, including one whose headers
refuse a \`set\`, so both branches apply the same set.`,
  ],
  "workers/app.ts#24": [
    "CONTRACT",
    "why absolute and why derived; the parse-once detail goes to the history document",
    `Absolute, because \`Reporting-Endpoints\` takes a URL and a non-secure endpoint is ignored.
Derived from the request, so it is right on workers.dev today and on the apex after cutover with
nothing to add to the cutover list.`,
  ],
  "workers/app.ts#25": [
    "CONTRACT",
    "which plane gets the style nonce; the grounds stay on the predicate",
    `The style nonce is emitted for the ADMIN PLANE ONLY, keyed on the path. \`isAdminPath\` owns the
exact-or-slash test and what an unauthenticated request to an admin path gets.`,
  ],
  "workers/app.ts#26": ["HISTORY", "an obituary for a call that moved; the gateway states why it lives there now", null],
  "workers/app.ts#27": [
    "CONTRACT",
    "what the platform now answers and the one rule that survives; the deleted block's three conditions and the date go to the history document",
    `The three conditions a hand-written store block used to check are the platform's own answers
now: the response says whether it is storable, the cache takes GET and HEAD only, and a
\`Set-Cookie\` response is an automatic bypass. What survives as this file's rule is hard rule 8's
default below, which is what makes a route that says nothing refuse.`,
  ],
  "workers/app.ts#28": [
    "CONTRACT",
    "the export summary, the four steps and why the order is load bearing; the ruling, the date and the billing argument go to the history document",
    `THE GATEWAY. Cache disabled, so it runs on every request, doing only the four things that must
not be skipped and handing the rest to the \`Renderer\` through a loopback the platform may answer
from cache.

  1. the HTTPS redirect, before anything is parsed
  2. the theme cookie read, which becomes the cache key's one dimension
  3. the loopback, with that key and those props
  4. the traffic row, AFTER the response comes back, hit or miss

THE ORDER IS LOAD BEARING: the redirect is first because a plaintext request must never reach a
lookup keyed on a path that ignores the scheme, and the row is last so it is written from the
finished thing. What a hit skips is the RENDERER, not this Worker, which is what lets the count
see every page view.`,
  ],
  "workers/app.ts#29": [
    "WHY",
    "the rule, why no-store is load bearing and why the header stays; the live measurement and its date go to the history document",
    `PLAINTEXT GOES TO HTTPS BEFORE ANYTHING ELSE HAPPENS; the grounds are on the predicate.

\`no-store\` is load-bearing: the scheme is NOT in the cache key, so a stored redirect would be
handed to HTTPS readers and send them where they already asked. Hard rule 8 makes an absent
Cache-Control a CACHED response. It stays even though the gateway is cache disabled, because the
property should not depend on which entrypoint somebody moves this to.`,
  ],
  "workers/app.ts#30": [
    "WHY",
    "the position and why; the ruling and the D1-query detail go to the history document. The source's hard rule 8 citation was split across a line break and is restored to one line here",
    `RENAMED POSTS GO TO THEIR NEW URL, BEFORE ANY DATABASE READ.

The position is the design: after the HTTPS redirect, and before the cache loopback, because
everything past that line either stores a response or renders one. Both representations are
handled by the predicate. \`no-store\` for the reason the redirect above states, hard rule 8
making an absent Cache-Control a CACHED response.`,
  ],
  "workers/app.ts#31": [
    "CONTRACT",
    "what the resolution prevents; one line already",
    `Resolved against this request's own origin, so the Location can never name another host.`,
  ],
  "workers/app.ts#32": [
    "WHY",
    "the ordering rule between the two maps and why neither fires on a live file",
    `THE PUBLICATION PDFs AND THE PAPER PAGE'S TRAILING SLASH, beside the post redirects and for the
same reasons.

ORDER MATTERS BETWEEN THESE TWO: the PDF map is consulted FIRST because its keys end in \`.pdf\`,
and \`paperSlashTarget\` refuses anything with a dot in the final segment precisely so it can never
claim an asset path, which makes that refusal a second line of defence rather than the only one.

Neither fires on a file that still exists: the asset handler serves those ahead of this Worker.`,
  ],
  "workers/app.ts#33": [
    "CONTRACT",
    "which spelling is canonical and why; one line",
    `\`/publications/<slug>\` to its trailing-slash form. Both spellings render, which is two URLs for
one document, and the slash form is canonical because it puts the page in the same subdirectory
as its PDF, which is Scholar's stated condition for honouring \`citation_pdf_url\`.`,
  ],
  "workers/app.ts#34": [
    "CONTRACT",
    "what is read and where the grounds are; one line already",
    `THE ONE THING READ OFF THE COOKIE, and it becomes the key's one dimension.
Grounds on \`cacheDimensions\`.`,
  ],
  "workers/app.ts#35": [
    "CONTRACT",
    "what the loopback is and what it does on a hit; the compatibility date and the preview measurement go to the history document",
    `THE LOOPBACK, and where the platform cache sits. \`ctx.exports.Renderer\` is a loopback service
binding to the class above, which is a cacheable invocation: on a hit the Renderer does not run
and this returns a stored response, on a miss it runs and its response is stored under this key.`,
  ],
  "workers/app.ts#36": [
    "WHY",
    "why it cannot live in the Renderer, what it is for now, and the fail-closed key; the ruling goes to the history document",
    `THE COOKIE DOWNGRADE, kept as belt and braces, and it cannot live in the Renderer: that response
is the one the platform STORES, so writing \`private, no-store\` there for a cookied reader would
mean cookied readers were never cached.

Keyed on the PRESENCE of any cookie, the fail-closed reading, since a request holding only a
session cookie must not read as cookieless. Wrapped, because a cached response can have immutable
headers and a throw would cost the reader their page for one header.`,
  ],
  "workers/app.ts#37": [
    "CONTRACT",
    "what it counts and that the refusals are unchanged; the ruling goes to the history document",
    `THE TRAFFIC ROW, from the gateway, so it reads the FINISHED response and runs whether that came
from the cache or from a render. Every refusal it carries is unchanged and on the function.`,
  ],
  "workers/app.ts#38": [
    "CONTRACT",
    "what it consumes and why it is on this entrypoint; the idempotency pointer stays",
    `R2 event notifications, deriving the D1 index. Separate from \`fetch\` on purpose: no HTTP request
triggers it and no reader waits on it, and the grounds are in \`media-events.ts\`. ON THE GATEWAY
because queue invocations bypass the cache entirely, so an entrypoint that exists to be cached is
the wrong home for one.`,
  ],
};
