/**
 * Gate over the security headers the Worker stamps on every response.
 *
 *   npm run check:headers
 *
 * ## OBSERVATION BOUNDARY, and it is the whole point of reading this first
 *
 * **THIS GATE CANNOT SEE THE WIRE.** It reads `workers/app.ts` and asserts what
 * the source DECLARES and that both code paths apply it. It cannot tell you a
 * single header actually arrived at a browser. A deploy that never happened, a
 * Cloudflare feature that strips a header, a route that returns before the
 * entry handler: all invisible here and all green.
 *
 * That is hard rule 7 restated for this file. The wire is `verify-live`'s job,
 * and it asserts every header by EXACT VALUE on both a 200 and the `/admin`
 * 302, because the immutable-headers rebuild is a different branch. Neither
 * file replaces the other and neither is sufficient alone.
 *
 * What this gate IS for: stopping a later edit from silently dropping a header
 * or loosening a value. That failure has no symptom a human would notice, on a
 * site with no CI, which is precisely the class the gate family exists for.
 *
 * ## Two independent sources argue
 *
 * The EXPECTED set below is transcribed from the ratification (2026-08-06,
 * Phase A). The ACTUAL set is parsed out of `workers/app.ts`. Nothing here
 * reads its expectation from the file it is checking, so a changed value moves
 * one side of the comparison and fails. Same construction as `check:contrast`,
 * which takes thresholds from the design doc and hexes from the stylesheet.
 *
 * **Changing a header therefore means editing this file too, in the same
 * commit. That is the design, not friction.** These seven values were each
 * ruled on, and two of them (CORP, COOP) are deliberately NOT the restrictive
 * choice; a one-sided edit is exactly what must not pass quietly.
 *
 * Pure: no network, no database, no bindings. Offline tier.
 *
 * FAILS CLOSED. An empty constant, a missing constant, or a file that stops
 * parsing are each a failure, so "0 problems" can never mean "0 examined".
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP_PATH = join(root, "workers", "app.ts");

/**
 * The ratified set, transcribed from the ruling. NOT read from the source.
 *
 * @type {Record<string, string>}
 */
const RATIFIED = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

let checks = 0;
let failures = 0;

/** @param {string} label @param {boolean} condition @param {string} [detail] */
function ok(label, condition, detail = "") {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ""}`);
  }
}

console.log("\ncheck:headers\n");

if (!existsSync(APP_PATH)) {
  console.log("  FAIL  workers/app.ts is missing.\n");
  process.exit(1);
}

/*
 * Comments are stripped before anything is located. This file's own header and
 * the constant's docblock both spell out header names and values while
 * explaining WHY they are what they are, and a parser that read the prose would
 * find `same-origin` in the sentence saying same-origin is wrong. That trap has
 * already been hit by check:logo, check:contrast and check:features.
 */
/** @param {string} s */
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

const source = readFileSync(APP_PATH, "utf8");
const code = stripComments(source);

/* ------------------------------------------------------- fail closed first */

const block = code.match(/const\s+SECURITY_HEADERS\s*:[^=]*=\s*\{([\s\S]*?)\}\s*;/);
ok(
  "workers/app.ts declares a SECURITY_HEADERS constant",
  Boolean(block),
  "not found after stripping comments. Without it nothing below examines anything.",
);

/** @type {Record<string, string>} */
const declared = {};
if (block) {
  for (const m of block[1].matchAll(/"([A-Za-z-]+)"\s*:\s*"([^"]*)"/g)) {
    declared[m[1]] = m[2];
  }
}

ok(
  "the constant is not empty",
  Object.keys(declared).length > 0,
  "SECURITY_HEADERS parsed to zero entries, so every value assertion would pass vacuously",
);
ok(
  `the constant declares all ${Object.keys(RATIFIED).length} ratified headers`,
  Object.keys(declared).length === Object.keys(RATIFIED).length,
  `declares ${Object.keys(declared).length}: ${Object.keys(declared).join(", ") || "(none)"}`,
);

/* ------------------------------------------- both directions, name by name */

for (const [name, expected] of Object.entries(RATIFIED)) {
  ok(
    `${name} is declared`,
    name in declared,
    `the ratified set includes it and workers/app.ts does not`,
  );
  if (name in declared) {
    ok(
      `${name} carries its ratified value`,
      declared[name] === expected,
      `expected ${JSON.stringify(expected)}, source has ${JSON.stringify(declared[name])}`,
    );
    ok(
      `${name} has a non-empty value`,
      declared[name].trim().length > 0,
      "an empty value is a header that does nothing while looking present",
    );
  }
}

// The other direction: a header in the source that nobody ratified.
for (const name of Object.keys(declared)) {
  ok(
    `${name} is a ratified header`,
    name in RATIFIED,
    `workers/app.ts declares it and the ratification does not. Add it here in the same commit, or remove it.`,
  );
}

/* ------------------------------------- the two values that look tightenable */

/*
 * Called out individually rather than left to the value comparison above,
 * because these are the two a future session is most likely to "fix", and a
 * failure that NAMES the reason is worth more than one that just prints a diff.
 */
ok(
  "Cross-Origin-Resource-Policy is cross-origin, not same-origin",
  declared["Cross-Origin-Resource-Policy"] === "cross-origin",
  "same-origin would block social platforms fetching og:image from /media/og/*. " +
    "The failure is off-site, silent, and invisible from this repo.",
);
ok(
  "Cross-Origin-Opener-Policy allows popups",
  declared["Cross-Origin-Opener-Policy"] === "same-origin-allow-popups",
  "plain same-origin would break Better Auth's Google flow if it uses a popup, " +
    "which was deliberately not verified. allow-popups is correct either way.",
);

/* ------------------------------------------------ applied on BOTH branches */

/*
 * Declaring the set and applying it are different things, and the second is
 * where it would actually break. `workers/app.ts` has two exits: the normal
 * mutable one and the rebuild for immutable headers (`Response.redirect()`).
 * A helper called on only one of them means redirects ship bare, and `/admin`
 * returning 302 is a live example.
 */
const applications = [...code.matchAll(/applySecurityHeaders\s*\(/g)].length;
ok(
  "applySecurityHeaders is defined",
  /function\s+applySecurityHeaders\s*\(/.test(code),
  "the constant is declared but nothing applies it",
);
ok(
  "applySecurityHeaders is called on BOTH exits (mutable and the immutable rebuild)",
  applications >= 3,
  `found ${applications} occurrence(s) including the definition; expected the definition ` +
    `plus one call per exit. A redirect that misses it ships with no security headers.`,
);
ok(
  "the immutable rebuild exists and stamps a fresh Headers copy",
  /new\s+Headers\s*\(\s*response\.headers\s*\)/.test(code) &&
    /new\s+Response\s*\(\s*response\.body/.test(code),
  "the Response.redirect() path must be rebuilt, not silently skipped",
);

/* ------------------------------------------- the cache-control DEFAULT ---- */

/*
 * **THIS IS THE ASSERTION THAT WAS MISSING, AND IT GUARDS AN AUTH BYPASS.**
 *
 * Workers Cache is on, and a response carrying no `Cache-Control` is CACHED
 * under RFC 9111 heuristic freshness, not skipped. The cache key does not
 * include cookies. `workers/app.ts` therefore stamps `private, no-store` on any
 * response that did not set the header itself, and that default is the only
 * thing standing between an authenticated `/admin` render and a shared cache
 * entry served to anyone who asks for that path for the next two hours.
 *
 * Audited 2026-08-07: those lines could be deleted and EVERY gate stayed green.
 * `check:config` compared the two config files to each other, which passes with
 * the cache turned off in both. `verify-live` observed only the cookie-downgrade
 * branch, never the no-header default, because all six routes it sweeps now
 * export `headers` of their own. Nothing looked at this.
 *
 * The value is transcribed from the ruling, like RATIFIED above, so a changed
 * default moves one side of the comparison. The BOTH-EXITS assertion is the
 * same shape as the one for applySecurityHeaders and for the same reason: the
 * immutable rebuild is a separate branch, and `/admin`'s 302 is the live case
 * that goes through it.
 */

console.log("\n  cache-control default");

const RATIFIED_UNCACHED = "private, no-store";

const uncached = code.match(/const\s+UNCACHED\s*=\s*"([^"]*)"\s*;/);
ok(
  "workers/app.ts declares an UNCACHED constant",
  Boolean(uncached),
  "not found after stripping comments. Without it nothing below examines anything.",
);
ok(
  `the uncached default is exactly "${RATIFIED_UNCACHED}"`,
  uncached !== null && uncached[1] === RATIFIED_UNCACHED,
  `source has ${JSON.stringify(uncached ? uncached[1] : null)}. ` +
    `\`private\` alone satisfies Cloudflare's edge; \`no-store\` is what makes ` +
    `intermediaries and the browser treat it the same way.`,
);

// Matches both `!response.headers.has(...)` on the mutable exit and
// `!headers.has(...)` on the rebuilt copy.
const guards = [...code.matchAll(/if\s*\(\s*!\s*(?:\w+\.)?headers\.has\(\s*"cache-control"\s*\)\s*\)/g)];
ok(
  "the no-Cache-Control default is applied on BOTH exits (mutable and the immutable rebuild)",
  guards.length >= 2,
  `found ${guards.length} guard(s); expected one per exit. A redirect that misses it ` +
    `is stored in a shared cache, and /admin returns 302.`,
);

// A guard that tests the condition and then sets something else, or nothing, is
// worse than no guard: it reads as protection in review.
let guardsSettingUncached = 0;
for (const guard of guards) {
  const after = code.slice(guard.index, guard.index + 160);
  if (/headers\.set\(\s*"cache-control"\s*,\s*UNCACHED\s*\)/.test(after)) guardsSettingUncached += 1;
}
ok(
  "every one of those guards sets UNCACHED",
  guards.length > 0 && guardsSettingUncached === guards.length,
  `${guardsSettingUncached} of ${guards.length} guards set it`,
);

/* ------------------------------------------------- the CSP (Phase B, RO) --- */

/*
 * REPORT-ONLY, and the assertion that matters most here is the one about
 * `'unsafe-inline'`.
 *
 * When a violation report lands, the cheapest way to make it stop is to add
 * `'unsafe-inline'` to `script-src`. That silences the report, keeps every page
 * working, and reduces the policy to decoration, because `'unsafe-inline'` is
 * exactly what an injected `<script>` needs. It is the single most likely wrong
 * fix during the observation window, it is invisible in review, and nothing
 * else in the repo would notice. Hence a named assertion rather than trusting
 * the value comparison to catch it.
 *
 * Note `'strict-dynamic'` makes browsers IGNORE `'unsafe-inline'` when both are
 * present, so a future session could add it, see no behaviour change, and
 * conclude it was harmless. It is not harmless: it is what the policy falls
 * back to the moment `'strict-dynamic'` is dropped or a browser does not
 * support it.
 */

console.log("\n  content security policy");

const cspFn = code.match(/function\s+contentSecurityPolicy[\s\S]*?\n\}/);
ok(
  "a contentSecurityPolicy builder exists",
  Boolean(cspFn),
  "not found after stripping comments",
);

const cspBody = cspFn ? cspFn[0] : "";
// BOTH quote styles. `script-src` is a TEMPLATE literal because it interpolates
// the nonce, and a regex that only read double quotes would silently skip the
// one directive this gate most needs to see. Measured: it did, and reported
// script-src as missing on a policy that declares it.
const directives = [...cspBody.matchAll(/[`"]([a-z-]+ [^`"]*)[`"]/g)].map((m) => m[1]);
ok(
  "the policy declares directives",
  directives.length > 0,
  "parsed zero, so every directive assertion below would pass vacuously",
);

// The ratified directive names. Values are deliberately NOT all asserted here:
// the point of Report-Only is that some of them may have to change. The NAMES
// are asserted so a directive cannot be quietly dropped.
for (const name of [
  "default-src",
  "script-src",
  "style-src",
  "style-src-attr",
  "font-src",
  "img-src",
  "connect-src",
  "object-src",
  "base-uri",
  "form-action",
  "frame-ancestors",
]) {
  ok(
    `the policy declares ${name}`,
    directives.some((d) => d.startsWith(`${name} `)),
    `parsed: ${directives.map((d) => d.split(" ")[0]).join(", ") || "(none)"}`,
  );
}

const scriptSrc = directives.find((d) => d.startsWith("script-src ")) ?? "";
ok(
  "script-src carries a nonce placeholder, not a literal",
  scriptSrc.includes("${nonce}"),
  `script-src is ${JSON.stringify(scriptSrc)}. A literal nonce is a static nonce, ` +
    `which renders correctly and protects nothing.`,
);
ok(
  "script-src carries 'strict-dynamic'",
  scriptSrc.includes("'strict-dynamic'"),
  `script-src is ${JSON.stringify(scriptSrc)}`,
);
ok(
  "script-src does NOT carry 'unsafe-inline'",
  !scriptSrc.includes("'unsafe-inline'"),
  "adding it is the easy way to silence a violation report and it reduces the " +
    "policy to decoration. 'strict-dynamic' makes browsers ignore it, so this " +
    "change would look harmless and would not be.",
);
ok(
  "script-src does NOT carry 'unsafe-eval'",
  !scriptSrc.includes("'unsafe-eval'"),
  "nothing on this site evals, and adding it would be silencing a report rather than fixing it",
);

// PHASE B IS REPORT-ONLY. Switching to enforcing is a separate ruling, and it
// must not happen as a side effect of some other edit.
ok(
  "the CSP is applied as Report-Only, not enforcing",
  code.includes('"Content-Security-Policy-Report-Only"') &&
    !/headers\.set\(\s*"Content-Security-Policy"/.test(code),
  "Phase B ships Report-Only. Enforcing needs its own ruling, and the " +
    "nonce-with-a-shared-cache question has to be settled first.",
);
ok(
  "the CSP is applied on BOTH exits, like the static set",
  [...code.matchAll(/Content-Security-Policy-Report-Only/g)].length >= 2,
  "a redirect that misses it reports nothing, which reads as a clean surface",
);
ok(
  "a report destination is declared (report-to AND the legacy report-uri)",
  cspBody.includes("report-to ") && cspBody.includes("report-uri "),
  "a CSP with no report destination is a header nobody reads. Both are sent " +
    "because report-to is Baseline 2026 and report-uri still carries older browsers.",
);
ok(
  "Reporting-Endpoints is sent alongside report-to",
  code.includes('"Reporting-Endpoints"'),
  "report-to names an endpoint that Reporting-Endpoints has to define",
);

console.log(
  `     ${directives.length} directive(s), Report-Only, ` +
    `${[...code.matchAll(/Content-Security-Policy-Report-Only/g)].length} application site(s)`,
);

/* -------------------------------------- the nonce reaches every script ---- */

/*
 * TWO SCRIPT CLASSES THAT DO NOT GET THE NONCE FOR FREE, both found by the
 * browser rather than by reading, and both invisible to every other gate.
 *
 * A source-level check only. Whether the attribute reaches the wire is
 * verify-live's job, and whether the browser accepts it is the browser's. What
 * this stops is a later edit silently dropping either one, which produces a
 * page that renders perfectly and would fail closed the moment the policy is
 * enforced.
 */

console.log("\n  the nonce reaches every script");

const entryServer = stripComments(
  readFileSync(join(root, "app", "entry.server.tsx"), "utf8"),
);

/*
 * `ServerRouter` passes its `nonce` prop BOTH into FrameworkContext and
 * directly to `StreamTransfer`, which stamps React Router's two streaming
 * scripts. Without the prop those ship bare on every page, and the `enqueue`
 * one carries the hydration payload. Measured 2026-08-06: 10 violation
 * reports, all script-src-elem/inline, all on the document's last line.
 */
ok(
  "entry.server.tsx passes a nonce to <ServerRouter>",
  /<ServerRouter[^>]*\snonce=\{/.test(entryServer),
  "without it StreamTransfer gets none and both streaming scripts ship bare, " +
    "so an enforcing CSP would stop the hydration payload on every page",
);
ok(
  "entry.server.tsx reads the nonce from the request context, not a literal",
  /getNonce\s*\(/.test(entryServer),
  "a literal or derived value here is a static nonce, which renders perfectly and protects nothing",
);
ok(
  "entry.server.tsx accepts the loadContext argument the nonce arrives on",
  /RouterContextProvider/.test(entryServer),
  "the fifth argument to handleRequest is the RouterContextProvider; without it there is nothing to read",
);

/*
 * `speculationrules` IS gated by script-src while `application/ld+json` is NOT.
 * Both are non-executable data blocks, so this is counter-intuitive and was
 * settled by the browser, not by argument. Asserted so nobody "consistently"
 * removes it.
 */
const speculation = stripComments(
  readFileSync(join(root, "app", "components", "blog-speculation.tsx"), "utf8"),
);
ok(
  "BlogSpeculation stamps a nonce on its speculationrules script",
  /nonce=\{/.test(speculation),
  "script-src gates type=\"speculationrules\" (measured), unlike application/ld+json, " +
    "so this element needs one and the JSON-LD does not",
);
ok(
  "BlogSpeculation takes the nonce from the root loader, not its own source",
  /useRouteLoaderData/.test(speculation),
  "one source in workers/app.ts, several readers; a second generator would drift",
);

/* ------------------------------- the draft preview route (feature G) ------ */

/*
 * **THE ONE ROUTE WHOSE HEADERS ARE THE ACCESS CONTROL.**
 *
 * `/preview/:token` serves an UNPUBLISHED post to a caller with no session.
 * Workers Cache is in front of this Worker and its key does not include
 * cookies; the cookieless downgrade in `workers/app.ts` is what keeps the
 * public post route safe, and a preview reviewer is exactly the request shape
 * that downgrade never fires for. So the route's own `Cache-Control` is not a
 * performance choice, it is the thing standing between a draft and a shared
 * cache entry.
 *
 * The failure this is written for is SPECIFIC and it is a copy-paste:
 * `blog.$slug.tsx` sits next to it in the same directory, exports a `headers()`
 * of the same shape, and sets `PUBLIC_CACHE_CONTROL`. Someone reaching for the
 * neighbouring file's version of this function would produce a route that
 * renders perfectly, passes every other gate, and publishes drafts to anyone
 * who asks for the path.
 *
 * Two independent sources argue, as above: RATIFIED_PREVIEW is transcribed from
 * the ruling and the actual set is parsed out of the route. The parse accepts an
 * IDENTIFIER as a value as well as a string literal, deliberately: had it only
 * matched quoted values, swapping in `PUBLIC_CACHE_CONTROL` would have read as
 * "Cache-Control is not declared" rather than as the wrong value, and the
 * failure would name the wrong problem on the one edit most likely to happen.
 */

console.log("\n  the draft preview route");

const PREVIEW_PATH = join(root, "app", "routes", "preview.$token.tsx");

/** Transcribed from the feature G ratification. NOT read from the route. */
const RATIFIED_PREVIEW = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  Vary: "Cookie",
};

ok(
  "app/routes/preview.$token.tsx exists",
  existsSync(PREVIEW_PATH),
  "the route that serves drafts is gone, or was renamed. Nothing below examines anything.",
);

if (existsSync(PREVIEW_PATH)) {
  const previewSource = readFileSync(PREVIEW_PATH, "utf8");
  const preview = stripComments(previewSource);

  const previewBlock = preview.match(/const\s+PREVIEW_HEADERS\s*(?::[^=]*)?=\s*\{([\s\S]*?)\}\s*;/);
  ok(
    "the route declares a PREVIEW_HEADERS constant",
    Boolean(previewBlock),
    "not found after stripping comments. Without it every value assertion below is vacuous.",
  );

  /**
   * Name to raw value text. The value may be a string literal OR a bare
   * identifier, and both are captured so a swapped-in constant is reported as a
   * WRONG VALUE rather than as an absent header.
   *
   * @type {Record<string, string>}
   */
  const previewDeclared = {};
  if (previewBlock) {
    for (const m of previewBlock[1].matchAll(
      /(?:"([A-Za-z-]+)"|([A-Za-z][A-Za-z-]*))\s*:\s*(?:"([^"]*)"|([A-Za-z_$][\w$]*))/g,
    )) {
      previewDeclared[m[1] ?? m[2]] = m[3] !== undefined ? m[3] : `<identifier ${m[4]}>`;
    }
  }

  ok(
    "PREVIEW_HEADERS is not empty",
    Object.keys(previewDeclared).length > 0,
    "parsed to zero entries, so every value assertion would pass vacuously",
  );
  ok(
    `PREVIEW_HEADERS declares all ${Object.keys(RATIFIED_PREVIEW).length} ratified headers`,
    Object.keys(previewDeclared).length === Object.keys(RATIFIED_PREVIEW).length,
    `declares ${Object.keys(previewDeclared).length}: ${Object.keys(previewDeclared).join(", ") || "(none)"}`,
  );

  for (const [name, expected] of Object.entries(RATIFIED_PREVIEW)) {
    ok(
      `preview route declares ${name}`,
      name in previewDeclared,
      "the feature G ratification includes it and the route does not",
    );
    if (name in previewDeclared) {
      ok(
        `preview route's ${name} carries its ratified value`,
        previewDeclared[name] === expected,
        `expected ${JSON.stringify(expected)}, source has ${JSON.stringify(previewDeclared[name])}`,
      );
    }
  }

  // The other direction: a header on this route that nobody ratified.
  for (const name of Object.keys(previewDeclared)) {
    ok(
      `${name} is a ratified preview header`,
      name in RATIFIED_PREVIEW,
      "the route declares it and the ratification does not. Add it here in the same commit, or remove it.",
    );
  }

  /*
   * NO PUBLIC BRANCH, named rather than left to the value comparison.
   *
   * The value check above catches `"Cache-Control": PUBLIC_CACHE_CONTROL`. This
   * catches the subtler shape: the constant staying correct while a conditional
   * somewhere else in the file hands back the public value on some path. The
   * rule is that the identifier does not appear in this file AT ALL.
   */
  ok(
    "the preview route never references PUBLIC_CACHE_CONTROL",
    !/\bPUBLIC_CACHE_CONTROL\b/.test(preview),
    "blog.$slug.tsx is the neighbouring file and exports a headers() of the same " +
      "shape using it. On this route it would put an unpublished post into a " +
      "shared cache entry keyed by path alone.",
  );
  ok(
    "the preview route's headers() returns the declared constant",
    /export\s+function\s+headers\s*\([^)]*\)\s*\{[^}]*PREVIEW_HEADERS/.test(preview),
    "headers() must hand back PREVIEW_HEADERS, or the constant is documentation",
  );
  ok(
    "the preview route also declares noindex in the markup",
    /"?robots"?\s*[,:]/.test(preview) && preview.includes("noindex, nofollow"),
    "the header is the control and the meta tag is the belt; both were ratified",
  );

  console.log(
    `     ${Object.keys(previewDeclared).length} header(s) declared on /preview/:token`,
  );
}

console.log(
  `\n  ${Object.keys(declared).length} static header(s) declared, ${applications - 1} application site(s)`,
);
/*
 * EXECUTED-COUNT FLOOR.
 *
 * A pass count is not coverage. An assertion block that stops running reports
 * green, and a green run with nothing in it looks exactly like a green run that
 * checked everything.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-15 by RUNNING it: 82.
 * Never summed. It was 66 against a floor of 62 until the draft preview route's
 * section landed, and the 16 that section adds were counted by RUNNING the gate
 * rather than by adding up what they looked like they would contribute.
 *
 * Floored at 77, roughly 6 percent: the count tracks the header sets declared
 * in workers/app.ts and in the preview route plus their application sites, so
 * it moves when a header is added, which should be a deliberate diff rather
 * than drift.
 */
const MINIMUM_CHECKS = 77;
if (checks < MINIMUM_CHECKS) {
  ok(
    "this gate executed its assertions",
    false,
    `only ${checks} ran, expected at least ${MINIMUM_CHECKS}. A block was SKIPPED ` +
      `rather than failing. Measured: 66.`,
  );
}

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
