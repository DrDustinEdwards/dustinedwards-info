/**
 * Gate over the security headers the Worker stamps on every response.
 *
 *   npm run check:headers
 *
 * BOUNDARY: IT CANNOT SEE THE WIRE. It asserts what workers/app.ts DECLARES, which is this
 * file's reading of hard rule 7; the wire is verify-live's.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ALLOWED } from "../app/lib/media/upload-contract.mjs";
import { contentSecurityPolicy, isAdminPath } from "../workers/csp.mjs";
import { UNPOLICED_TYPES, isFeed } from "../workers/feed-types.mjs";
import { stripComments } from "./lib/strip-comments.mjs";
import { assertFloor } from "./lib/floor.mjs";

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
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), display-capture=()",
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

/* Comments stripped first: this file's prose names headers while explaining why they are wrong. */
/* One owner: scripts/lib/strip-comments.mjs carries the trap, the guard and the boundary. */

const source = readFileSync(APP_PATH, "utf8");
const code = stripComments(source);

/* fail closed first */

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

/* both directions, name by name */

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

/* the two values that look tightenable */

/* Named individually, because these two are what a future session is most likely to "fix". */
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

/* applied on BOTH branches */

/*
 * Declaring the set and applying it differ: app.ts has two exits, and one helper call means
 * redirects ship bare.
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

/* the cache-control DEFAULT */

/*
 * THIS GUARDS AN AUTH BYPASS: with no Cache-Control an /admin render is stored under heuristic
 * freshness under a cookieless key. BOTH EXITS.
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

/* the CSP (Phase B, ENFORCED) */

/*
 * unsafe-inline IS THE ASSERTION THAT MATTERS: it silences the report, breaks nothing, and is
 * what an injected script needs. strict-dynamic makes browsers ignore it until it is dropped.
 */

console.log("\n  content security policy");

/*
 * THE POLICY IS CALLED, NOT PARSED: a regex sees both branches exist, not which one a request
 * gets. The builder is imported and the nonce is fixed here, which is fixture independence.
 */
const NONCE = "gate-fixture-nonce-not-a-real-one";
const publicCsp = contentSecurityPolicy(NONCE, false);
const adminCsp = contentSecurityPolicy(NONCE, true);

/** @param {string} csp */
const directivesOf = (csp) => csp.split("; ").filter(Boolean);
/**
 * @param {string} csp
 * @param {string} name
 */
const directiveIn = (csp, name) =>
  directivesOf(csp).find((d) => d === name || d.startsWith(name + " ")) ?? "";

const directives = directivesOf(publicCsp);
ok(
  "the policy builder returns directives",
  directives.length > 0,
  "parsed zero, so every directive assertion below would pass vacuously",
);
ok(
  "the two branches actually differ",
  publicCsp !== adminCsp,
  "contentSecurityPolicy returns the same string for both arms, so the styleNonce " +
    "argument is being ignored and every branch assertion below compares one policy " +
    "with itself.",
);

// The ratified directive NAMES, not their values, or this becomes a mirror of workers/csp.mjs.
// BOTH BRANCHES: a directive dropped from one arm is what a single-arm sweep calls clean.
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
  for (const [arm, csp] of [
    ["public", publicCsp],
    ["admin", adminCsp],
  ]) {
    ok(
      "the " + arm + " policy declares " + name,
      Boolean(directiveIn(csp, name)),
      "parsed: " +
        (directivesOf(csp)
          .map((d) => d.split(" ")[0])
          .join(", ") || "(none)"),
    );
  }
}

/* the feeds get NO policy at all */

/*
 * EVERY FEED ROUTE'S DECLARED CONTENT-TYPE IS ONE isFeed() EXEMPTS. The two owners had already
 * drifted. The types are READ OUT OF THE ROUTE FILES and isFeed is CALLED, not spelled.
 */
{
  /** Named rather than globbed: the assertion is about THESE THREE, and a glob quietly shrinks. */
  const FEED_ROUTES = [
    "blog.rss[.xml].ts",
    "blog.atom[.xml].ts",
    "blog.feed[.json].ts",
  ];

  for (const file of FEED_ROUTES) {
    const routePath = join(root, "app", "routes", file);
    if (!existsSync(routePath)) {
      ok(`the feed route ${file} exists`, false, "not on disk");
      continue;
    }
    // Comments stripped first: this repo has had a needle satisfied by a
    // sentence and a needle failed by one, in the same week.
    const source = stripComments(readFileSync(routePath, "utf8"));
    const declared = source.match(/"content-type":\s*"([^"]+)"/);
    ok(
      `${file} declares a content-type this gate can read`,
      Boolean(declared),
      "no `\"content-type\": \"...\"` literal found, so the next assertion would " +
        "have nothing to test and would pass",
    );
    if (!declared) continue;
    ok(
      `${file} serves "${declared[1]}", which isFeed() exempts from the CSP`,
      isFeed(declared[1]),
      `isFeed("${declared[1]}") is false, so this feed is served a policy with a ` +
        `per-request nonce on a shared-cached body. Exempt types: ` +
        `${[...UNPOLICED_TYPES].join(", ")}`,
    );
  }

  /* THE NEGATIVE, so the three above cannot pass by isFeed() having become a constant true. */
  for (const type of ["text/html", "text/html; charset=utf-8", "image/svg+xml", ""]) {
    ok(
      `isFeed(${JSON.stringify(type)}) is false, so a document still gets a policy`,
      !isFeed(type),
      "isFeed() exempts a type a browser renders as a browsing context",
    );
  }
  ok("isFeed(null) is false", !isFeed(null));
}

/* the style nonce is ADMIN ONLY */

/*
 * THE PUBLIC BRANCH IS THE ASSERTION THAT MATTERS: true everywhere fixes a violation report and
 * breaks nothing visible, while header and body share one public entry for the cache lifetime.
 * BOTH DIRECTIONS, since refusing it publicly is equally satisfied by a broken editor.
 */
const publicStyleSrc = directiveIn(publicCsp, "style-src");
const adminStyleSrc = directiveIn(adminCsp, "style-src");

ok(
  "the PUBLIC style-src carries no nonce source",
  !publicStyleSrc.includes("nonce-"),
  "public style-src is " +
    JSON.stringify(publicStyleSrc) +
    ". Every shared-cached public HTML route is edge-cached, so its nonce is stable " +
      "for up to ten minutes and a nonce source there widens the accepted script-src " +
      "exposure to styles. " +
    "Nothing public injects an inline stylesheet, so it buys nothing and costs that.",
);
ok(
  "the PUBLIC style-src is exactly 'self'",
  publicStyleSrc === "style-src 'self'",
  "public style-src is " +
    JSON.stringify(publicStyleSrc) +
    ", expected \"style-src 'self'\". Anything else is a widening of the public policy.",
);
ok(
  "the PUBLIC style-src carries no 'unsafe-inline'",
  !publicStyleSrc.includes("'unsafe-inline'"),
  "that is the easy way to silence the CodeMirror report, and it would apply to every " +
    "public page, which is the opposite of what the admin-only branch is for",
);
ok(
  "the ADMIN style-src carries the nonce source",
  adminStyleSrc.includes("'nonce-" + NONCE + "'"),
  "admin style-src is " +
    JSON.stringify(adminStyleSrc) +
    ". Without a nonce source the nonce CodeMirror puts on its injected <style> authorises " +
    "nothing, and the StyleModule is dropped on every editor load, which is the defect " +
    "this branch exists for.",
);
ok(
  "the ADMIN style-src still carries 'self'",
  adminStyleSrc.includes("'self'"),
  "admin style-src is " +
    JSON.stringify(adminStyleSrc) +
    ". There is no 'strict-dynamic' for styles, so 'self' keeps applying and the linked " +
    "stylesheet needs it.",
);
ok(
  "style-src-attr is identical on both branches",
  directiveIn(publicCsp, "style-src-attr") === directiveIn(adminCsp, "style-src-attr"),
  "the style nonce changed what ATTRIBUTES are permitted, which it must not: the 117 " +
    "inline style attributes the highlighter emits are a public-page concern, and nonces " +
    "do not apply to attributes at all",
);

/* WHAT DECIDES THE BRANCH, on real paths rather than on the caller's if, which would mirror it. */
for (const path of [
  "/",
  "/blog",
  "/blog/some-post",
  "/colophon",
  "/projects",
  "/playground",
  "/search",
  "/login",
  "/media/thing.png",
  "/api/csp-report",
  "/administrator",
  "/admin-tools",
  "/admin.data",
]) {
  ok(
    path + " is NOT an admin path, so it gets the absolute style-src",
    !isAdminPath(path),
    "isAdminPath(" +
      JSON.stringify(path) +
      ") is true, so this route would be served a policy carrying a style nonce.",
  );
}
for (const path of [
  "/admin",
  "/admin/",
  "/admin/posts",
  "/admin/posts/a-slug/edit",
  // A child route's single-fetch URL. It matches the slash arm, unlike the
  // layout's own `/admin.data`, which does not. Both are JSON either way.
  "/admin/posts.data",
]) {
  ok(
    path + " IS an admin path, so the editor's StyleModule is accepted",
    isAdminPath(path),
    "isAdminPath(" +
      JSON.stringify(path) +
      ") is false, so CodeMirror's injected stylesheet is refused on that route.",
  );
}

const scriptSrc = directiveIn(publicCsp, "script-src");
ok(
  "script-src carries the per-request nonce, not a literal",
  scriptSrc.includes("'nonce-" + NONCE + "'"),
  "script-src is " +
    JSON.stringify(scriptSrc) +
    ". A literal nonce is a static nonce, which renders correctly and protects nothing.",
);
ok(
  "script-src is identical on both branches",
  scriptSrc === directiveIn(adminCsp, "script-src"),
  "the style branch changed script-src, which it has no business touching",
);
ok(
  "script-src carries 'strict-dynamic'",
  scriptSrc.includes("'strict-dynamic'"),
  "script-src is " + JSON.stringify(scriptSrc),
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

/*
 * ENFORCED, NOT REPORT-ONLY: a revert leaves the page working, the header present and the
 * reports arriving, with nothing blocked.
 */
ok(
  "the CSP is applied as ENFORCED, not Report-Only",
  /headers\.set\(\s*"Content-Security-Policy"/.test(code) &&
    !code.includes('"Content-Security-Policy-Report-Only"'),
  "the header reverted to Report-Only. Ruled 2026-08-17: the existing nonce " +
    "plus strict-dynamic policy is ENFORCED, keeping shared caching on the " +
    "seven HTML routes and accepting the ten-minute nonce window.",
);
ok(
  "the CSP is applied on BOTH exits, like the static set",
  [...code.matchAll(/headers\.set\(\s*"Content-Security-Policy"/g)].length >= 2,
  "a redirect that misses it is UNPROTECTED, not merely unreported",
);
/* REPORTING SURVIVES ENFORCEMENT: a policy blocks silently, so the reports are the only signal. */
ok(
  "reporting is still on after the switch to enforcing",
  publicCsp.includes("report-uri ") && publicCsp.includes("report-to "),
  "the policy blocks but reports nothing, so a false positive would be invisible",
);
ok(
  "a report destination is declared (report-to AND the legacy report-uri)",
  adminCsp.includes("report-to ") && adminCsp.includes("report-uri "),
  "a CSP with no report destination is a header nobody reads. Both are sent " +
    "because report-to is Baseline 2026 and report-uri still carries older browsers.",
);
ok(
  "Reporting-Endpoints is sent alongside report-to",
  code.includes('"Reporting-Endpoints"'),
  "report-to names an endpoint that Reporting-Endpoints has to define",
);

console.log(
  `     ${directives.length} directive(s), ENFORCED, ` +
    `${[...code.matchAll(/headers\.set\(\s*"Content-Security-Policy"/g)].length} application site(s)`,
);

/* the nonce reaches every script */

/*
 * TWO SCRIPT CLASSES THAT DO NOT GET THE NONCE FOR FREE, both found by the browser rather than
 * by reading. What this stops is a later edit dropping either one.
 */

console.log("\n  the nonce reaches every script");

const entryServer = stripComments(
  readFileSync(join(root, "app", "entry.server.tsx"), "utf8"),
);

/*
 * ServerRouter passes its nonce prop both into FrameworkContext and to StreamTransfer; without
 * it React Router's two streaming scripts ship bare, one of them carrying the payload.
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
 * THE SPECULATION BLOCK, and there is exactly ONE: speculationrules is gated by script-src, so
 * an un-nonced element is refused SILENTLY and the page renders identically without it.
 */
const siteSpeculation = stripComments(
  readFileSync(join(root, "app", "components", "site-speculation.tsx"), "utf8"),
);
ok(
  "SiteSpeculation stamps a nonce on its speculationrules script",
  /nonce=\{/.test(siteSpeculation),
  "this block renders on every public page, so an un-nonced one is refused site-wide " +
    "under the enforced policy and the loss is invisible in a render",
);
ok(
  "SiteSpeculation takes the nonce from the root loader, not its own source",
  /useRouteLoaderData/.test(siteSpeculation),
  "one source in workers/app.ts, several readers; a second generator would drift",
);
ok(
  "SiteHeader renders SiteSpeculation, which is what puts it on every public page",
  /<SiteSpeculation\s*\/>/.test(
    stripComments(readFileSync(join(root, "app", "components", "site-header.tsx"), "utf8")),
  ),
  "an imported-but-unrendered component is the shape that passes both assertions " +
    "above while shipping nothing to any reader",
);

/* the draft preview route (feature G) */

/*
 * THE ONE ROUTE WHOSE HEADERS ARE THE ACCESS CONTROL: /preview/:token serves an unpublished
 * post to a caller with no session, and the cookieless downgrade never fires for it. An
 * IDENTIFIER counts as a value, so the shared constant fails as wrong rather than as absent.
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

  /* NO PUBLIC BRANCH, named: the rule is that the identifier does not appear in this file AT ALL. */
  ok(
    "the preview route never references SHARED_CACHE_CONTROL",
    !/\bSHARED_CACHE_CONTROL\b/.test(preview),
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

/* the analytics capture (feature F.1 + G) */

/*
 * A LIVE MEASUREMENT IS NOT A GATE: dropping the /admin skip would leave every gate green while
 * the operator's own views flowed into the panel that exists to exclude them.
 */

console.log("\n  the analytics capture");

const capture = code.match(/function\s+recordTraffic[\s\S]*?\n\}/);
ok(
  "workers/app.ts declares a recordTraffic capture",
  Boolean(capture),
  "not found after stripping comments. Without it nothing below examines anything.",
);

const captureBody = capture ? capture[0] : "";

ok(
  "the capture body is not empty",
  captureBody.length > 200,
  `parsed ${captureBody.length} characters, so every assertion below would be vacuous`,
);

/* Each exclusion named individually, because a failure saying WHICH one went is worth more. */
ok(
  "the capture excludes the /admin plane",
  /pathname\s*===\s*"\/admin"/.test(captureBody) &&
    /pathname\.startsWith\(\s*"\/admin\/"\s*\)/.test(captureBody),
  "THE OPERATOR IS NOT AN AUDIENCE. Both forms are needed: the bare /admin and " +
    "the subtree. A panel that counts its own author is worse than no panel.",
);
ok(
  "the capture records HTML responses only",
  /text\/html/.test(captureBody),
  "assets, feeds, markdown twins, /media and the API routes are traffic and none " +
    "of them is a page view",
);
ok(
  "the capture records 200s only",
  /status\s*!==\s*200/.test(captureBody),
  "errors and redirects are not reads",
);
ok(
  "the referer is reduced to a hostname before it is stored",
  /\.hostname/.test(captureBody),
  "a full referer URL carries paths and query strings from other people's sites",
);

/*
 * THE REDACTION IS AN ACCESS CONTROL: /preview/<token> carries a capability in its PATH. BOTH
 * SLOTS separately, and the ABSENCE of the raw expression, or a capture computes the safe path
 * and writes the raw one anyway.
 */
ok(
  "the capture imports the analyticsPath redaction",
  /\banalyticsPath\b/.test(code.split("function recordTraffic")[0] ?? ""),
  "the helper must be imported at module scope; a local copy would drift from " +
    "the unit-tested rule in app/lib/analytics-path.mjs",
);
ok(
  "the capture computes a redacted path",
  /=\s*analyticsPath\(\s*url\.pathname\s*\)/.test(captureBody),
  "the preview token must be stripped before anything is written",
);

const writeCall = captureBody.match(/writeDataPoint\(\{[\s\S]*?\}\)/);
ok(
  "the capture calls writeDataPoint",
  Boolean(writeCall),
  "not found, so the two slot assertions below would be vacuous",
);

const writeBody = writeCall ? writeCall[0] : "";
ok(
  "blobs carries the redacted path, not url.pathname",
  /blobs:\s*\[\s*path\b/.test(writeBody) && !/blobs:\s*\[\s*url\.pathname/.test(writeBody),
  `blobs is ${JSON.stringify(writeBody.match(/blobs:\s*\[[^\]]*\]/)?.[0] ?? "(unparsed)")}. ` +
    `A preview URL carries a capability in its path.`,
);
ok(
  "indexes carries the redacted path, not url.pathname",
  /indexes:\s*\[\s*path\s*\]/.test(writeBody) && !/indexes:\s*\[\s*url\.pathname/.test(writeBody),
  `indexes is ${JSON.stringify(writeBody.match(/indexes:\s*\[[^\]]*\]/)?.[0] ?? "(unparsed)")}. ` +
    `This is the SAMPLING KEY, and it is the slot most easily left behind.`,
);
ok(
  "url.pathname is not written into the data point at all",
  writeBody.length > 0 && !/url\.pathname/.test(writeBody),
  "the raw pathname must not appear inside writeDataPoint in any slot. Computing " +
    "a redacted path and then writing the raw one is the shape this catches.",
);

console.log(
  `     ${[...captureBody.matchAll(/\breturn;/g)].length} exclusion(s), path redacted in ${
    [...writeBody.matchAll(/\bpath\b/g)].length
  } slot(s)`,
);

console.log(
  `\n  ${Object.keys(declared).length} static header(s) declared, ${applications - 1} application site(s)`,
);
/*
 * EXECUTED-COUNT FLOOR. A green run with nothing in it looks like a green run that checked
 * everything. MEASURED BY RUNNING THIS GATE, never summed.
 */
/*
 * UPLOADED SVG IS SERVED AS AN ATTACHMENT: it can carry script and /media/* is the site's own
 * origin. Kept even though the CSP blocks it, because it does not depend on the policy.
 */
{
  const mediaRoute = readFileSync(join(root, "app/routes/media.$.ts"), "utf8");

  const helperAt = mediaRoute.search(/function attachIfActive/);
  ok("media: the svg attachment helper exists", helperAt !== -1,
    "nothing sets Content-Disposition, so an uploaded SVG renders inline");

  // SCOPED to the helper's own body. Asserting the FILE mentions attachment
  // would pass on a comment, which is the mistake the media axis gate made.
  const helperBody = helperAt === -1 ? "" : mediaRoute.slice(helperAt, helperAt + 700);
  /* DERIVED FROM THE UPLOAD ALLOWLIST, never restated, or a NEW capable type joins with no rule. */
  const CAPABLE = ["image/svg+xml", "text/html", "application/xhtml+xml", "text/xml", "application/xml"];
  const uploadableCapable = [...ALLOWED.keys()].filter((t) => CAPABLE.includes(t));

  ok("media: some uploadable type can carry script, so this block has scope",
    uploadableCapable.length > 0,
    "no script-capable type is uploadable; if that is now true, delete this block " +
      "deliberately rather than leaving it asserting nothing");

  for (const type of uploadableCapable) {
    ok(`media: the helper refuses ${type} inline`,
      helperBody.includes(type),
      `${type} is uploadable and this route does not attach it, so it is served ` +
        `inline from our own origin`);
  }
  ok("media: it sets content-disposition attachment",
    /content-disposition"?,\s*"attachment/.test(helperBody),
    "the helper exists but does not set the disposition");
  ok("media: it sets nosniff alongside",
    /x-content-type-options/.test(helperBody),
    "an attachment a browser sniffs back to SVG defeats the disposition");

  /* AND APPLIED ON EVERY PATH THAT SERVES THE STORED BYTES, the half a helper check cannot see. */
  const bodyReturns = [...mediaRoute.matchAll(/new Response\(object\.body/g)].length;
  const applications = [...mediaRoute.matchAll(/attachIfActive\(headers\)/g)].length;
  ok("media: some path serves the stored bytes", bodyReturns > 0,
    "no `new Response(object.body` found; this block is asserting nothing");
  ok("media: every stored-bytes response applies the helper",
    applications >= bodyReturns,
    `${bodyReturns} response(s) return the object body but the helper is ` +
      `applied ${applications} time(s). A path serves an SVG inline.`);
}

/*
 * ASSET CACHE RULES in public/_headers. The immutable year is scoped to /assets/*, whose names
 * carry a content hash; the danger is the glob widening over stable paths. Asserted as the
 * PROPERTY and read PER BLOCK, since a file-wide reading cannot attribute a directive.
 */
const HEADERS_FILE = "public/_headers";
const headersPath = join(root, HEADERS_FILE);

ok(`${HEADERS_FILE} exists`, existsSync(headersPath),
  "Workers Assets falls back to max-age=0 for every asset without it");

/**
 * The longest freshness an UNHASHED path may declare, in seconds. Nothing recalls a stored
 * entry and there is no purge door here, which hard rule 20 records. /assets/* is exempt.
 */
const MAX_UNHASHED_FRESHNESS = 3600;

if (existsSync(headersPath)) {
  const raw = readFileSync(headersPath, "utf8");
  // Path lines start at column 0; header lines are indented. Comments are '#'.
  const lines = raw
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"));

  /* PARSED INTO BLOCKS, so every directive is attributed to the path it sits under. */
  /** @type {Array<{ path: string, directives: string[] }>} */
  const blocks = [];
  for (const raw_line of lines) {
    const line = raw_line.trim();
    if (/^\s/.test(raw_line)) {
      // A directive before any path line is malformed; counted so it cannot be
      // silently dropped into nothing.
      if (blocks.length === 0) blocks.push({ path: "(no path line)", directives: [] });
      blocks[blocks.length - 1].directives.push(line);
    } else {
      blocks.push({ path: line, directives: [] });
    }
  }
  const paths = blocks.map((b) => b.path);

  ok("the rule file declares at least one path", blocks.length > 0,
    `parsed ${blocks.length} block(s) from ${HEADERS_FILE}`);

  ok("every declared block carries at least one header",
    blocks.every((b) => b.directives.length > 0),
    `a path with no directives under it sets nothing. Found: ` +
      `${blocks.filter((b) => b.directives.length === 0).map((b) => b.path).join(", ")}`);

  const hashed = blocks.filter((b) => b.path === "/assets/*");
  ok("the hashed build output has a rule", hashed.length === 1,
    `expected exactly one /assets/* block, found ${hashed.length}. ` +
      `Without it every asset revalidates on every load.`);

  const immutable = hashed.flatMap((b) =>
    b.directives.filter((d) => /immutable|max-age=\d{5,}/i.test(d)),
  );
  ok("an immutable rule is declared", immutable.length > 0,
    "the file exists but pins nothing, so every asset still revalidates");

  /* THE PROPERTY, per block, and both max-age and s-maxage: a year at the edge is as un-revokable. */
  const unhashed = blocks.filter((b) => b.path !== "/assets/*");
  const overFresh = unhashed.flatMap((b) =>
    b.directives.flatMap((d) => {
      if (/immutable/i.test(d)) return [`${b.path}: ${d} (immutable)`];
      return [...d.matchAll(/\b(?:s-maxage|max-age)=(\d+)/gi)]
        .filter((m) => Number(m[1]) > MAX_UNHASHED_FRESHNESS)
        .map((m) => `${b.path}: ${m[0]}`);
    }),
  );
  ok(
    `no unhashed path is fresh for more than ${MAX_UNHASHED_FRESHNESS}s ` +
      `(${unhashed.length} unhashed block(s) read)`,
    overFresh.length === 0,
    `a long-lived rule on an unhashed path cannot be revoked before it ` +
      `expires: ${overFresh.join("; ")}`,
  );

  ok("the paths declared here are the ones this site means to declare",
    paths.every((p) => p === "/assets/*" || p === "/publications/*.md"),
    `an unrecognised rule path is a decision nobody argued. Found: ${paths.join(", ")}`);
}

/* the health endpoint's own headers */

/*
 * A HEALTH CHECK SERVED FROM CACHE IS NOT A HEALTH CHECK: no Cache-Control means heuristic
 * freshness (hard rule 8). SCOPED STRUCTURALLY by counting the ONE Response construction,
 * because "the file mentions no-store" passes on a comment.
 */

console.log("\n  the health endpoint");

const HEALTH_PATH = join(root, "app", "routes", "api.health.ts");

/** Transcribed from the ruling. NOT read from the route. */
const RATIFIED_HEALTH = { "Cache-Control": "no-store" };

ok(
  "app/routes/api.health.ts exists",
  existsSync(HEALTH_PATH),
  "the health route is gone or was renamed, so nothing below examines anything",
);

if (existsSync(HEALTH_PATH)) {
  const health = stripComments(readFileSync(HEALTH_PATH, "utf8"));

  const healthBlock = health.match(/const\s+HEALTH_HEADERS\s*(?::[^=]*)?=\s*\{([\s\S]*?)\}\s*;/);
  ok(
    "the route declares a HEALTH_HEADERS constant",
    Boolean(healthBlock),
    "not found after stripping comments. Without it every assertion below is vacuous.",
  );

  /** @type {Record<string, string>} */
  const healthDeclared = {};
  if (healthBlock) {
    // Identifiers are captured as values too, so swapping in a constant reads as
    // a WRONG VALUE rather than as an absent header. Same reason as the preview
    // route's parse above.
    for (const m of healthBlock[1].matchAll(
      /(?:"([A-Za-z-]+)"|([A-Za-z][A-Za-z-]*))\s*:\s*(?:"([^"]*)"|([A-Za-z_$][\w$]*))/g,
    )) {
      healthDeclared[m[1] ?? m[2]] = m[3] !== undefined ? m[3] : `<identifier ${m[4]}>`;
    }
  }

  ok(
    "HEALTH_HEADERS is not empty",
    Object.keys(healthDeclared).length > 0,
    "parsed to zero entries, so the value assertion below would pass vacuously",
  );

  for (const [name, expected] of Object.entries(RATIFIED_HEALTH)) {
    ok(
      `the health route declares ${name}`,
      name in healthDeclared,
      `the ratification includes it and the route does not. Absent, the response ` +
        `is heuristically cached for two hours and reports stale health.`,
    );
    ok(
      `the health route's ${name} is exactly "${expected}"`,
      healthDeclared[name] === expected,
      `declared ${JSON.stringify(healthDeclared[name] ?? "(absent)")}`,
    );
  }

  /* THE APPLICATION SITE, counted: one construction is what makes the header provably universal. */
  const constructions = [
    ...health.matchAll(/\bnew\s+Response\s*\(|\bResponse\s*\.\s*json\s*\(/g),
  ];
  ok(
    "the health route constructs exactly one Response",
    constructions.length === 1,
    `found ${constructions.length}. Every health response must go through the one ` +
      `helper that applies HEALTH_HEADERS; a second exit is a response that can be ` +
      `cached, and on a 503 that means alerting after the site recovered.`,
  );

  const helperAt = health.search(/function\s+healthJson\b/);
  ok(
    "the route defines the healthJson helper",
    helperAt !== -1,
    "the single-construction assertion above has nothing to be scoped to",
  );

  if (helperAt !== -1) {
    // Bounded to the helper's own body: the closing brace at column 0. Not a
    // character window, which is what read a neighbour's compliance in df99bf1.
    const helperEnd = health.indexOf("\n}", helperAt);
    const helperBody = helperEnd === -1 ? "" : health.slice(helperAt, helperEnd + 2);

    /* new Headers(HEALTH_HEADERS), not a bare mention, so the one site is built FROM the constant. */
    ok(
      "healthJson seeds its headers from HEALTH_HEADERS",
      /new\s+Headers\(\s*HEALTH_HEADERS\s*\)/.test(helperBody),
      "the one construction site does not build from the constant, so the headers " +
        "are declared and unused",
    );
    ok(
      "the single Response construction is inside healthJson",
      constructions.length === 1 &&
        constructions[0].index > helperAt &&
        constructions[0].index < helperAt + helperBody.length,
      "a Response is built outside the helper, so it carries whatever headers its own call site set",
    );
  }
}


console.log("");
console.log("  plaintext requests are upgraded before anything else runs");

{
  /*
   * MEASURED ON THE WIRE: plain http returned the full page, and a warmed path came back a HIT
   * carrying the same nonce. Asserted on POSITION: a redirect after the router is not a redirect.
   */
  /*
   * SCOPED TO THE GATEWAY, because a position assertion must know which body it reads, and before
   * the LOOPBACK, so before anything could be answered from cache.
   */
  const appCode = stripComments(readFileSync(APP_PATH, "utf8"));
  const gatewayAt = appCode.search(/export\s+default\s*\{/);
  ok("the Worker exports a default gateway", gatewayAt !== -1, "nothing below examines anything");
  const fetchBody = gatewayAt === -1 ? "" : appCode.slice(gatewayAt);
  ok("the gateway body is non-empty", fetchBody.length > 200, `${fetchBody.length} chars`);

  const redirectAt = fetchBody.indexOf("httpsRedirectTarget(");
  const loopbackAt = fetchBody.indexOf("ctx.exports.Renderer");
  ok(
    "the gateway takes an https redirect decision",
    redirectAt !== -1,
    "plaintext would reach the renderer and be answered 200, which is what was measured live",
  );
  ok(
    "THE UPGRADE RUNS BEFORE THE LOOPBACK, so plaintext never reaches a cache lookup",
    redirectAt !== -1 && loopbackAt !== -1 && redirectAt < loopbackAt,
    "a redirect decided after the response exists is not a redirect, and one decided after " +
      "the loopback could be answered from a cache entry the scheme is not part of",
  );
  /*
   * AND THE RENDERER DOES NOT REDIRECT, or the assertion above is satisfied by a copy that runs
   * on a miss only.
   */
  const rendererAt = appCode.search(/export\s+class\s+Renderer\b/);
  const rendererBody =
    rendererAt === -1 || gatewayAt === -1 ? "" : appCode.slice(rendererAt, gatewayAt);
  ok(
    "the Renderer body was located",
    rendererBody.length > 200,
    `${rendererBody.length} chars between the class and the default export`,
  );
  ok(
    "the https upgrade lives in the gateway ONLY",
    !rendererBody.includes("httpsRedirectTarget("),
    "the renderer runs on a cache miss only, so an upgrade decided there is skipped on a hit",
  );

  /* The redirect's own caching is a safety property: the scheme is NOT in the cache key. */
  const redirectBlock = redirectAt === -1 ? "" : fetchBody.slice(redirectAt, redirectAt + 420);
  ok(
    "the redirect block was located",
    redirectBlock.includes("Location"),
    "the assertion below would examine the wrong bytes",
  );
  ok(
    "THE REDIRECT IS no-store, so it cannot be cached under a scheme-blind key",
    /no-store/.test(redirectBlock),
    "hard rule 8: with no Cache-Control it is CACHED, and a cached redirect loops HTTPS readers",
  );
  ok(
    "the redirect predicate is imported rather than restated",
    /from\s+"~\/lib\/https-redirect\.mjs"/.test(appCode),
    "a second copy of the loopback exemption is how local development breaks",
  );
}

/* every public HTML route sets the shared policy */

/*
 * A public page exporting no headers() falls through to hard rule 8's uncached default with no
 * symptom a human meets. Asserted on the ROUTE FILES, comment-stripped, not on the helper.
 */

console.log("");
console.log("  public HTML routes share one headers()");

{
  const PUBLIC_HTML = [
    "home.tsx",
    // The About page. Shared-cached like every other hand-written page, and
    // it carries no reader-specific anything: the prose is a build artifact
    // and the only per-request value on it is the CSP nonce every page has.
    "about.tsx",
    "colophon.tsx",
    "phage-discovery.tsx",
    "playground.tsx",
    "projects.tsx",
    /*
     * The publication index: its QUERY STRING is part of the key rather than a reason to refuse,
     * since the chips and the sort are GET parameters and nothing on it is reader-specific.
     */
    "publications.tsx",
    /* One paper's page, same policy: every byte is a function of the committed corpus. */
    "publications.$slug.tsx",
    "privacy.tsx",
    // The tag archive. It calls `publicHtmlHeaders()` and negotiates nothing:
    // its feeds are separate URLs rather than representations of this one, so
    // it belongs here and not with the Accept-negotiating routes below.
    "blog.tags.$tag.tsx",
    // The series archive, on the tag archive's terms: `publicHtmlHeaders()`,
    // and its feeds are separate URLs rather than representations of this one.
    "blog.series.$series.tsx",
    // /blog is here rather than with the negotiating routes: no twin representation, and with the
    // theme in the cache key it has no reason for a Vary at all.
    "blog._index.tsx",
  ];

  ok(
    "the public HTML route list is not empty",
    PUBLIC_HTML.length >= 5,
    "an empty list would make every assertion below pass by examining nothing",
  );

  /*
   * THE ACCEPT-NEGOTIATING PAIR, on the string rather than the helper: the only Vary left on this
   * site is one naming a real second representation.
   */
  const ACCEPT_NEGOTIATED = ["blog.$slug.tsx", "search.tsx"];
  for (const name of ACCEPT_NEGOTIATED) {
    const routePath = join(root, "app", "routes", name);
    const routeCode = existsSync(routePath) ? stripComments(readFileSync(routePath, "utf8")) : "";
    ok(
      name + " is shared-cacheable with its own Vary",
      routeCode.includes("SHARED_CACHE_CONTROL") && /Vary|HTML_VARY/.test(routeCode),
      "this route is counted in the shared-cache nonce exposure; if it stops being " +
        "shared-cacheable the exposure narrows and the narration in workers/app.ts must follow",
    );
  }

  /*
   * EVERY SHARED-CACHEABLE ROUTE ALSO SETS A CACHE TAG, or a stored response stays wrong silently
   * at both ends. THE PAIRING is asserted, from the same derived list, and the needle is the CALL
   * or the header name, never the tag's VALUE, which hard rule 17 gives one owner.
   */
  const TAG_NEEDLE = /publicHtmlHeaders\s*\(|"Cache-Tag"|cacheTags\s*\(/;
  const untagged = [];
  let taggedSeen = 0;
  for (const name of [...PUBLIC_HTML, ...ACCEPT_NEGOTIATED]) {
    const routePath = join(root, "app", "routes", name);
    if (!existsSync(routePath)) continue;
    const routeCode = stripComments(readFileSync(routePath, "utf8"));
    if (!routeCode.includes("SHARED_CACHE_CONTROL") && !routeCode.includes("publicHtmlHeaders")) {
      continue;
    }
    if (TAG_NEEDLE.test(routeCode)) taggedSeen += 1;
    else untagged.push(name);
  }

  /*
   * SCOPE, ASSERTED: an empty walk reports what a compliant tree reports. MEASURED THROUGH THIS
   * LOOP, having come out wrong by one when counted off the literals, hard rule 10's own example.
   */
  ok(
    "the cache-tag walk examined the shared-cacheable routes",
    taggedSeen >= 10,
    `${taggedSeen} route(s) carried a tag, floor 10, measured 11. A zero-scope walk ` +
      `agrees with anything.`,
  );
  ok(
    "every shared-cacheable route also sets a Cache-Tag",
    untagged.length === 0,
    `${untagged.join(", ")} declare SHARED_CACHE_CONTROL and set no Cache-Tag. A ` +
      `response that can be stored and cannot be purged stays wrong until s-maxage ` +
      `expires, and neither the write nor the purge reports anything, because a purge ` +
      `for a tag nothing carries succeeds by doing nothing.`,
  );

  /*
   * CLOSURE, WHICH MAKES THESE LISTS AN OWNER RATHER THAN A SECOND COPY: a new shared-cached page
   * cannot ship unlisted, and workers/app.ts can state the nonce exposure without a count, which
   * once stood in three copies and was wrong in all three; hard rule 8 carries the same lesson.
   * Comments stripped, because one route NAMES the constant while explaining why it refuses it.
   */
  {
    const listed = new Set([...PUBLIC_HTML, ...ACCEPT_NEGOTIATED]);
    const found = readdirSync(join(root, "app", "routes"))
      .filter((f) => f.endsWith(".tsx"))
      .filter((f) => {
        const code = stripComments(readFileSync(join(root, "app", "routes", f), "utf8"));
        return code.includes("SHARED_CACHE_CONTROL") || code.includes("publicHtmlHeaders");
      });
    ok(
      "the closure scan examined a non-empty set of routes",
      found.length >= listed.size,
      `only ${found.length} routes matched; a scan finding nothing reports what a clean sweep reports`,
    );
    const unlisted = found.filter((f) => !listed.has(f));
    ok(
      "every shared-cached HTML route is named in one of the two lists",
      unlisted.length === 0,
      `unlisted: ${unlisted.join(", ")}. A new shared-cached page widens the shared-cache ` +
        `nonce exposure described in workers/app.ts, so it joins a list here`,
    );
    const missing = [...listed].filter((f) => !found.includes(f));
    ok(
      "every listed route still references the shared string",
      missing.length === 0,
      `listed but not found: ${missing.join(", ")}. A stale name here is an assertion ` +
        `above examining a file that no longer does this`,
    );
  }

  for (const name of PUBLIC_HTML) {
    const routePath = join(root, "app", "routes", name);
    ok(
      name + " exists",
      existsSync(routePath),
      "the route was renamed or removed, so the assertions below examine nothing",
    );
    if (!existsSync(routePath)) continue;

    const routeCode = stripComments(readFileSync(routePath, "utf8"));
    ok(
      name + " exports headers()",
      /export function headers/.test(routeCode),
      "with no headers() export it falls through to the uncached default, which is what left /projects the only public page never edge-cached",
    );
    ok(
      name + " returns the shared publicHtmlHeaders()",
      /publicHtmlHeaders/.test(routeCode),
      "a hand-written pair here is how the Vary line gets dropped: the shared string without Vary: Cookie serves one reader theme to another",
    );
  }
}
/*
 * FLOOR RE-MEASURED BY RUNNING THIS GATE, never summed: this one was once far enough under for
 * two sections to stop running while it still cleared, which is hard rule 10's class.
 */
const MINIMUM_CHECKS = 213;
const floorBreach = assertFloor("check:headers", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
