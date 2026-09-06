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
 * or loosening a value. That failure has no symptom a human would notice, which
 * is precisely the class the gate family exists for.
 *
 * ("On a site with no CI", until 2026-08-20. CI landed and runs this gate on
 * every push, which changes who notices a red result, not whether a dropped
 * header has a symptom. The argument never depended on the missing half.)
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

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ALLOWED } from "../app/lib/media/upload-contract.mjs";
import { contentSecurityPolicy, isAdminPath } from "../workers/csp.mjs";
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

/*
 * Comments are stripped before anything is located. This file's own header and
 * the constant's docblock both spell out header names and values while
 * explaining WHY they are what they are, and a parser that read the prose would
 * find `same-origin` in the sentence saying same-origin is wrong. That trap has
 * already been hit by check:logo, check:contrast and check:features.
 */
/* One owner: scripts/lib/strip-comments.mjs carries the trap, the guard and the boundary. */

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

/* ------------------------------------------ the CSP (Phase B, ENFORCED) --- */

/*
 * The assertion that matters most here is the one about `'unsafe-inline'`, and
 * ENFORCEMENT made it matter more, not less.
 *
 * When something breaks, the cheapest way to make it stop is to add
 * `'unsafe-inline'` to `script-src`. That silences it, keeps every page working,
 * and reduces the policy to decoration, because `'unsafe-inline'` is exactly
 * what an injected `<script>` needs. It is invisible in review and nothing else
 * in the repo would notice. Hence a named assertion rather than trusting the
 * value comparison to catch it.
 *
 * This paragraph used to say "the single most likely wrong fix DURING THE
 * OBSERVATION WINDOW", which dated the risk to a phase that ended on
 * 2026-08-17. The risk did not end with the phase. It got sharper: under
 * Report-Only a wrong fix silenced a report, and under enforcement it unbreaks
 * a page a reader is looking at, which is a far stronger reason to reach for
 * it.
 *
 * Note `'strict-dynamic'` makes browsers IGNORE `'unsafe-inline'` when both are
 * present, so a future session could add it, see no behaviour change, and
 * conclude it was harmless. It is not harmless: it is what the policy falls
 * back to the moment `'strict-dynamic'` is dropped or a browser does not
 * support it.
 */

console.log("\n  content security policy");

/*
 * THE POLICY IS CALLED, NOT PARSED, since the admin-only style nonce landed.
 *
 * This section used to match `function contentSecurityPolicy` out of the Worker
 * source and regex the directives out of the text. That worked while the
 * builder returned one string, and stopped being adequate the moment it
 * returned two: a regex can see that both branches EXIST, and cannot see which
 * one a request gets, so the strongest assertion it supports is "a nonce
 * appears somewhere in the function" rather than "the public policy has none".
 * Those two differ by exactly the defect worth catching.
 *
 * So the builder moved to `workers/csp.mjs` and is IMPORTED here. Same module
 * the Worker runs, so there is no second copy to drift. The nonce below is a
 * fixed string written in this file and never generator output, per hard rule
 * 10's fixture-independence discipline.
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

// The ratified directive names. Values are deliberately NOT all asserted here,
// and the reason CHANGED on 2026-08-17 without the code moving.
//
// It used to be "the point of Report-Only is that some of them may have to
// change", which expired with the phase. What holds now is narrower and is the
// real argument: this gate transcribes the ratification, and pinning every
// VALUE would make it a mirror of workers/csp.mjs, so a deliberate widening
// would fail here for no reason beyond having been made. The NAMES are asserted
// so a directive cannot be quietly dropped, and the values that carry the whole
// policy have named assertions of their own.
//
// BOTH BRANCHES, because a directive dropped from one arm only is exactly what
// a single-arm sweep reports as clean.
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

/* ------------------------------------ the style nonce is ADMIN ONLY ------- */

/*
 * **THE PUBLIC BRANCH IS THE ASSERTION THAT MATTERS.**
 *
 * The admin plane gets a style nonce so CodeMirror's injected StyleModule is
 * accepted. The entire value of scoping it that way is that the public side
 * stays ABSOLUTE, and nothing in the code stops a later edit from passing
 * `true` everywhere: doing so would fix a violation report, read as a
 * simplification, leave every comment in place describing a policy that no
 * longer exists, and break nothing a reader could see.
 *
 * The seven edge-cached public routes are why it would matter. Header and body
 * are cached together for cookieless readers, so one nonce is valid there for
 * up to ten minutes. That exposure is accepted in writing for `script-src`;
 * extending it to styles as a side effect is not.
 *
 * Asserted in BOTH DIRECTIONS. The public arm must carry no nonce source, and
 * the admin arm must carry one, because an assertion that only refuses the
 * nonce publicly is equally satisfied by a build where the editor is broken
 * again.
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

/*
 * WHAT DECIDES THE BRANCH, asserted on real paths rather than on the caller's
 * `if`, which would be a mirror of the caller.
 *
 * The public list is taken from `routes.ts` and includes the cases that would
 * catch a bare `startsWith("/admin")`: a hypothetical `/administrator`, and the
 * `.data` serialisations React Router actually emits.
 */
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
 * PHASE B IS ENFORCED, ruled 2026-08-17 (option A). This assertion REVERSED on
 * that date: it used to require Report-Only and to refuse the enforcing header,
 * so that enforcement could not happen as a side effect of some other edit. The
 * ruling is made, so the direction flips and the guard stays: enforcement must
 * not be silently REVERTED either, which is the more likely accident now.
 *
 * A revert would be invisible in every other way. The page still works, the
 * header is still present, the reports still arrive, and the only difference is
 * that nothing is blocked, which is exactly the state this spent eleven days in.
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
/*
 * REPORTING SURVIVES ENFORCEMENT. Enforcing and reporting are independent: a
 * policy can block silently. Losing the reports would remove the only signal
 * that the policy is refusing something a reader needed.
 */
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
 * THE SPECULATION BLOCK, and since 2026-08-28 there is exactly ONE.
 *
 * `speculationrules` IS gated by script-src while `application/ld+json` is NOT.
 * Both are non-executable data blocks, so this is counter-intuitive and was
 * settled by the browser, not by argument. Asserted so nobody "consistently"
 * removes it.
 *
 * `SiteSpeculation` rides in `SiteHeader`, so it renders on every public page.
 * Under an ENFORCED policy an un-nonced `type="speculationrules"` element is
 * refused by `script-src` on every one of them, SILENTLY: the page renders
 * identically, nothing is logged where anyone looks, and the enhancement is
 * simply absent.
 *
 * `BlogSpeculation` was the second block, on the two blog routes, and its
 * assertions lived here beside these. It was deleted when the rules became
 * document rules; its subject is inside the document rule now. Its file no
 * longer exists, so a `readFileSync` of it would throw rather than pass, which
 * is the loud direction.
 *
 * WHAT THIS DOES NOT ASSERT: that the rules name the right paths or exclude the
 * right ones. That is `test/header-speculation.test.mjs` for the derivation and
 * `check:browser` for the payload a browser actually parses, which is why this
 * gate carries no second copy of either list.
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
 * of the same shape, and sets `SHARED_CACHE_CONTROL`. Someone reaching for the
 * neighbouring file's version of this function would produce a route that
 * renders perfectly, passes every other gate, and publishes drafts to anyone
 * who asks for the path.
 *
 * Two independent sources argue, as above: RATIFIED_PREVIEW is transcribed from
 * the ruling and the actual set is parsed out of the route. The parse accepts an
 * IDENTIFIER as a value as well as a string literal, deliberately: had it only
 * matched quoted values, swapping in `SHARED_CACHE_CONTROL` would have read as
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
   * The value check above catches `"Cache-Control": SHARED_CACHE_CONTROL`. This
   * catches the subtler shape: the constant staying correct while a conditional
   * somewhere else in the file hands back the public value on some path. The
   * rule is that the identifier does not appear in this file AT ALL.
   */
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

/* ------------------------------- the analytics capture (feature F.1 + G) --- */

/*
 * **NOTHING GATED THIS UNTIL 2026-08-15, and the belief that something did is
 * itself worth recording.**
 *
 * F.1 proved the capture's exclusions by querying the LIVE DATASET after a
 * deploy: admin 0, assets 0, query strings 0, referer paths 0. That is a strong
 * measurement and it is not a gate. It ran once, against one deploy, and
 * nothing has re-asserted it since; deleting the `/admin` skip would have left
 * every gate in this repo green while the operator's own page views started
 * flowing into the panel that exists to exclude them.
 *
 * This section lives in `check:headers` because this is the only gate that
 * parses `workers/app.ts`, and the capture is in `workers/app.ts`. The name is
 * a poor fit and the alternative was worse: a new gate would have to be tiered
 * in `check-all.mjs` and would duplicate this file's whole parsing setup to
 * read the same source. The OBSERVATION BOUNDARY at the top of this file
 * already says what it can and cannot see, and it covers this identically.
 *
 * SOURCE-LEVEL ONLY. It sees what the capture DECLARES. Whether a row reaches
 * the dataset is `ae-probe`'s question and needs a deploy plus a read token.
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

/*
 * THE THREE EXCLUSIONS F.1 RULED, each named individually rather than left to
 * one "does it look right" check, because a failure that says WHICH exclusion
 * went is worth more than one that says the function changed.
 */
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
 * **THE REDACTION, AND IT IS AN ACCESS CONTROL RATHER THAN A DATA CHOICE.**
 *
 * `/preview/<token>` carries a 43-character capability in its PATH. Writing
 * `url.pathname` verbatim stored it in Analytics Engine and rendered it in full
 * on /admin/origin-requests, defeating the drawer's six-character truncation.
 * Measured on production 2026-08-15 on the first real use of the feature.
 *
 * BOTH SLOTS, asserted separately. The path is written twice: into `blobs` and
 * into `indexes`, which is the sampling key. Redacting one and not the other
 * leaves the token in the dataset, and the `indexes` slot is the easier of the
 * two to forget because it is three lines further down behind a comment.
 *
 * Asserted as the ABSENCE of the raw expression as well as the presence of the
 * redacted one. Presence alone passes on a capture that computes `path` and
 * then writes `url.pathname` anyway.
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
 * EXECUTED-COUNT FLOOR.
 *
 * A pass count is not coverage. An assertion block that stops running reports
 * green, and a green run with nothing in it looks exactly like a green run that
 * checked everything.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-15 by RUNNING it: 94.
 * Never summed. It was 66 against a floor of 62 until the draft preview route's
 * section landed, then 82 against 77, and the analytics capture section took it
 * to 94. Every one of those steps was counted by RUNNING the gate rather than
 * by adding up what the new block looked like it would contribute, which is the
 * discipline verify-live's floor proved the value of on this same feature: the
 * arithmetic there was one low against the measurement.
 *
 * Floored at 88, roughly 6 percent: the count tracks the header sets declared
 * in workers/app.ts and in the preview route, their application sites, and now
 * the capture's exclusions, so it moves when one is added, which should be a
 * deliberate diff rather than drift.
 */
/* ------------------------------------------------------------------ *
 * UPLOADED SVG IS SERVED AS AN ATTACHMENT.
 * ------------------------------------------------------------------ *
 *
 * An SVG is a document, not a picture: it can carry script. `image/svg+xml` is
 * on the upload allowlist, and `/media/*` serves from the SITE'S OWN ORIGIN, so
 * inline it is script running as the site.
 *
 * The CSP has BLOCKED that since 2026-08-17 rather than merely reporting it, and
 * this assertion is kept regardless: it does not depend on the policy, so it
 * survives a loosened directive and covers any client that ignores CSP. Same
 * reasoning as the comment on `attachIfActive` itself.
 *
 * OBSERVATION BOUNDARY: source only. This proves the route SETS the header on
 * the paths that serve the stored bytes; it does not fetch an object, so it
 * cannot see R2 or a cache layer dropping it on the way out.
 */
{
  const mediaRoute = readFileSync(join(root, "app/routes/media.$.ts"), "utf8");

  const helperAt = mediaRoute.search(/function attachIfActive/);
  ok("media: the svg attachment helper exists", helperAt !== -1,
    "nothing sets Content-Disposition, so an uploaded SVG renders inline");

  // SCOPED to the helper's own body. Asserting the FILE mentions attachment
  // would pass on a comment, which is the mistake the media axis gate made.
  const helperBody = helperAt === -1 ? "" : mediaRoute.slice(helperAt, helperAt + 700);
  /*
   * DERIVED FROM THE UPLOAD ALLOWLIST, never restated. The pairing is the
   * invariant: a script-capable type is uploadable only while this route
   * refuses to serve it inline. Restating "svg" here would let a NEW capable
   * type be added to the allowlist with no corresponding attachment rule,
   * which is the exact shape of the N-1-of-N misses this repo keeps paying for.
   * The allowlist end of the pairing is asserted in test/upload-contract.test.mjs.
   */
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

  /*
   * AND IT IS APPLIED ON EVERY PATH THAT SERVES THE STORED BYTES, which is the
   * half that rots: a new branch returning `object.body` would be invisible to
   * a check that only asserted the helper exists. Counted, both directions.
   */
  const bodyReturns = [...mediaRoute.matchAll(/new Response\(object\.body/g)].length;
  const applications = [...mediaRoute.matchAll(/attachIfActive\(headers\)/g)].length;
  ok("media: some path serves the stored bytes", bodyReturns > 0,
    "no `new Response(object.body` found; this block is asserting nothing");
  ok("media: every stored-bytes response applies the helper",
    applications >= bodyReturns,
    `${bodyReturns} response(s) return the object body but the helper is ` +
      `applied ${applications} time(s). A path serves an SVG inline.`);
}

/* ------------------------------------------------------------------ *
 * ASSET CACHE RULES: `public/_headers`.
 * ------------------------------------------------------------------ *
 *
 * Workers Assets defaults every asset to `max-age=0, must-revalidate`.
 * MEASURED on production 2026-08-16, one full document load of /admin/media:
 * 14 asset requests, all 14 on the network, every one headers-only
 * (transferSize 300 against encoded bodies up to 60 kB, so a 304 with the body
 * already on disk), median 689ms and 1204ms for the slowest.
 *
 * The rule is scoped to `/assets/*`, whose filenames carry their content hash,
 * so a year is safe by construction. THE DANGER IS THE GLOB WIDENING. A rule
 * over `/*` would pin `favicon.ico`, `logo.svg` and the icon suite for a year
 * at stable paths, and this repo has already recorded a browser holding a stale
 * favicon hard enough to look like a failed deploy. That is what this asserts.
 *
 * OBSERVATION BOUNDARY: this reads the tracked FILE. It does not fetch an
 * asset, so it cannot see Workers Assets failing to apply a rule it parsed.
 * The served header was proven separately with `wrangler dev` and is owed a
 * re-measure on the next deploy.
 */
const HEADERS_FILE = "public/_headers";
const headersPath = join(root, HEADERS_FILE);

ok(`${HEADERS_FILE} exists`, existsSync(headersPath),
  "Workers Assets falls back to max-age=0 for every asset without it");

if (existsSync(headersPath)) {
  const raw = readFileSync(headersPath, "utf8");
  // Path lines start at column 0; header lines are indented. Comments are '#'.
  const lines = raw
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"));
  const paths = lines.filter((l) => !/^\s/.test(l)).map((l) => l.trim());
  const directives = lines.filter((l) => /^\s/.test(l)).map((l) => l.trim());

  ok("the rule file declares at least one path", paths.length > 0,
    `parsed ${paths.length} path line(s) from ${HEADERS_FILE}`);

  ok("every declared path is scoped to the hashed build output",
    paths.every((p) => p === "/assets/*"),
    `only /assets/* carries a content hash in its filename. Found: ${paths.join(", ")}`);

  const immutable = directives.filter((d) => /immutable|max-age=\d{5,}/i.test(d));
  ok("an immutable rule is declared", immutable.length > 0,
    "the file exists but pins nothing, so every asset still revalidates");

  ok("nothing outside /assets/* is given a long max-age",
    !paths.some((p) => p !== "/assets/*") || immutable.length === 0,
    `a long-lived rule on an unhashed path cannot be revoked before it expires`);
}

/* --------------------------------- the health endpoint's own headers ------ */

/*
 * **A HEALTH CHECK THAT CAN BE SERVED FROM CACHE IS NOT A HEALTH CHECK.**
 *
 * `/api/health` returned `Response.json({ ok: true })` with no `Cache-Control`.
 * Hard rule 8: that is CACHED, not skipped. Workers Cache is in front of this
 * Worker and Cloudflare applies heuristic freshness to a 200 carrying neither
 * `Cache-Control` nor `Expires`, storing it for two hours. The endpoint could
 * therefore report health measured two hours ago, identically whether the
 * Worker was fine or on fire, which is the reassuring silence a monitor exists
 * to break.
 *
 * ## SCOPED STRUCTURALLY, NOT BY A WINDOW
 *
 * The tempting assertion is "the file mentions no-store", and it is worthless:
 * it passes on a comment, and this repo has had a comment both satisfy an
 * assertion and fail one in the same week. The next temptation is a window
 * around each `new Response`, and that is the shape that read the NEXT
 * function's compliance in `df99bf1`.
 *
 * So the property asserted is structural: the route constructs a Response in
 * EXACTLY ONE place, that place is inside `healthJson`, and `healthJson`
 * applies the constant. A second exit added later without the headers moves the
 * count and fails here, which is the case that matters once the endpoint grows
 * a 503 path. Comments are stripped before any of it.
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

  /*
   * THE APPLICATION SITE, counted rather than searched for. One construction is
   * the invariant: it is what makes "the header is on every response" provable
   * without inspecting each response.
   */
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

    /*
     * THE NEEDLE FOLLOWED THE HELPER, 2026-08-26. It read
     * `headers: HEALTH_HEADERS`, which was exact while the helper passed the
     * object straight through. The rate limit gave the route one response that
     * needs a `Retry-After` no other response wants, so the helper now seeds a
     * `Headers` from the constant and overlays the caller's extras.
     *
     * `new Headers(HEALTH_HEADERS)` is asserted rather than a bare mention of
     * the identifier, and the difference matters: a bare `HEALTH_HEADERS`
     * anywhere in the body would be satisfied by a line that merely READS the
     * constant without seeding from it, which is exactly the shape a refactor
     * that stopped applying it would leave behind. The invariant is unchanged:
     * the one construction site is built FROM the constant.
     */
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
   * MEASURED ON THE WIRE, 2026-08-23, and it is why this section exists: plain
   * http:// returned 200 with the full page, and the first plaintext request to
   * a path already warmed over HTTPS came back CF-Cache-Status: HIT carrying the
   * SAME CSP nonce. The two schemes shared one cache entry, so the nonce that
   * the enforced policy relies on was being handed out in the clear.
   *
   * Asserted on POSITION, not presence. A redirect that runs after the router
   * has already produced a response is not a redirect, and presence alone would
   * pass on exactly that.
   */
  /*
   * RE-SCOPED TO THE GATEWAY, 2026-09-05, and the re-scope is a finding.
   *
   * This block used to take the FIRST `async fetch(` in the file and assert
   * that `httpsRedirectTarget` appeared before `RouterContextProvider` inside
   * it. After the entrypoint split the first `async fetch(` is the RENDERER's,
   * which constructs the router and never redirects, so the needle was pointing
   * at the wrong handler and this gate went red. It was right to: an assertion
   * about POSITION has to know which body it is reading, and this one silently
   * changed subject when the file's shape changed.
   *
   * The property is now stated against the shape that exists, and it is
   * STRONGER than the old claim. The redirect must be in the GATEWAY and must
   * come before the loopback: before the loopback means before anything could
   * be answered from cache, where the old one only meant before a render.
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
   * AND THE RENDERER DOES NOT REDIRECT, which is the other direction. Without
   * it the assertion above could be satisfied by a copy of the redirect having
   * moved into the entrypoint that runs on a miss only, where it would be
   * skipped on every hit.
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

  /*
   * The redirect's own caching, and this one is a safety property rather than
   * hygiene. The scheme is NOT part of the cache key, which is the whole defect
   * this closes; a cacheable redirect stored under a shared key would be served
   * to HTTPS readers too and send them to the URL they already requested.
   */
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

/* ------------------------- every public HTML route sets the shared policy - */

/*
 * **THE GAP THIS CLOSES EXISTED BECAUSE NOTHING ASSERTED IT.**
 *
 * /projects exported no headers() at all and so fell through to hard rule 8's
 * uncached default: the one public page never edge-cached, every reader paying
 * an origin hit for a body identical to everyone's. It sat in core.md as a
 * known gap for weeks, because a missing export has no symptom a human meets
 * and no gate was looking.
 *
 * Asserted on the ROUTE FILES rather than on the helper, because the helper
 * being correct proves nothing about who calls it. Comments are stripped
 * first: three of these files discuss headers() in prose while explaining the
 * Vary pairing, and a raw match would read the explanation as the code.
 *
 * The routes that negotiate on Accept are deliberately absent: blog.$slug,
 * blog._index and search take loaderHeaders or HTML_VARY_ACCEPT and are their
 * own shape. preview.$token is absent for the opposite reason and has its own
 * section above.
 */

console.log("");
console.log("  public HTML routes share one headers()");

{
  const PUBLIC_HTML = [
    "home.tsx",
    "colophon.tsx",
    "phage-discovery.tsx",
    "playground.tsx",
    "projects.tsx",
    "privacy.tsx",
    // The tag archive. It calls `publicHtmlHeaders()` and negotiates nothing:
    // its feeds are separate URLs rather than representations of this one, so
    // it belongs here and not with the Accept-negotiating routes below.
    "blog.tags.$tag.tsx",
    // The series archive, on the tag archive's terms: `publicHtmlHeaders()`,
    // and its feeds are separate URLs rather than representations of this one.
    "blog.series.$series.tsx",
    // MOVED HERE FROM THE ACCEPT-NEGOTIATING LIST, 2026-09-05. `/blog` was in
    // that list because it set its own `Vary`, and the Vary it set was
    // `Cookie` rather than `Accept`: it has no twin representation and never
    // did. With the theme in the cache key instead, it has no reason for a Vary
    // at all and calls the helper like every other listing page.
    "blog._index.tsx",
  ];

  ok(
    "the public HTML route list is not empty",
    PUBLIC_HTML.length >= 5,
    "an empty list would make every assertion below pass by examining nothing",
  );

  /*
   * THE ACCEPT-NEGOTIATING PAIR, asserted on the string rather than on the
   * helper. They cannot call publicHtmlHeaders(): each pairs the shared
   * Cache-Control with its own Vary, because each has a twin representation
   * (markdown, or JSON) that Accept selects between.
   *
   * IT WAS THREE UNTIL 2026-09-05. `/blog` was here for a `Vary: Cookie` it no
   * longer sets, and it never negotiated on Accept; the theme is a cache key
   * dimension now, so the only Vary left on this site is the one that names a
   * real second representation.
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
   * EVERY SHARED-CACHEABLE ROUTE ALSO SETS A CACHE TAG. Ruling 17, 2026-09-05.
   *
   * ## WHY THIS IS A GATE AND NOT A CONVENTION
   *
   * A response that can be stored and cannot be purged is a page that stays
   * wrong for ten minutes after a write that was supposed to fix it, and the
   * failure is SILENT in both directions: the write reports success, and
   * `cache.purge` reports `success: true` for a tag that matches nothing,
   * because there is nothing for it to report. Neither end says anything. The
   * only place the omission is visible is here, in the source, before it ships.
   *
   * ## IT IS THE PAIRING THAT IS ASSERTED
   *
   * `publicHtmlHeaders` returns both halves together, so a route that calls it
   * passes by construction. The two Accept-negotiating routes build their
   * headers by hand and are exactly where a half can go missing, which is why
   * this is checked FROM the same derived list the section above closes over
   * rather than from a hand-kept set of route names.
   *
   * The needle is the CALL or the header name, never the tag's VALUE. What the
   * tag should say is `cacheTags`' business and hard rule 17 gives that one
   * owner; a gate that restated the vocabulary would be the second owner.
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
   * SCOPE, ASSERTED. An empty walk reports no untagged routes, which is exactly
   * what a compliant tree reports.
   *
   * MEASURED THROUGH THIS LOOP on 2026-09-05 by RUNNING the gate: 11. The first
   * figure written here was 10, counted off the two list literals above rather
   * than run, and it was wrong by one. Hard rule 10's own example, in the commit
   * that added the assertion: a floor arrived at by reading is not a floor.
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
   * CLOSURE, AND IT IS THE HALF THAT MAKES THESE LISTS AN OWNER RATHER THAN A
   * SECOND COPY.
   *
   * The lists are checked FROM the tree, not against it: every .tsx route that
   * references the shared string must appear in one of them. A new shared-cached
   * page therefore cannot ship unlisted, which is how /projects went the other
   * way and sat uncached for weeks with nothing looking.
   *
   * THIS IS WHAT LETS workers/app.ts STATE THE NONCE EXPOSURE WITHOUT A COUNT.
   * That count read seven, was written when the true value was six, and became
   * eight the morning /projects gained headers(). Three copies of it existed, in
   * two files, and all three were wrong at once. A number in prose beside a gate
   * is a second copy of the gate; hard rule 8 carries the same lesson, and this
   * is where the habit has cost the most.
   *
   * Comments stripped first: preview.$token.tsx NAMES the shared constant in
   * prose to explain why it refuses it, and an unstripped scan would read that
   * sentence as a reference and demand the route join the list.
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
 * FLOOR RE-MEASURED 2026-08-23 BY RUNNING THIS GATE, never summed.
 *
 * **THE OLD VALUE HAD GONE STALE BY 44 AND NOBODY WOULD HAVE NOTICED.** It read
 * 99, its comment said "Measured: 99", and the gate was in fact running 143
 * before this section landed. A floor 44 under the truth is not a floor: two
 * whole sections could have stopped running and the count would still have
 * cleared it, which is precisely the failure this assertion exists to catch.
 * It was a floor that could not fail, hard rule 10's own class, sitting inside
 * the gate family that names it.
 *
 * That is the argument for measuring THROUGH the pipeline every time rather
 * than adding up what a new block looks like it will contribute: the arithmetic
 * drifts silently, and only running it says so. I first wrote 108 here by
 * reasoning from the stale 99, and running the gate is what corrected it.
 *
 * Measured now: 184, by RUNNING it. Floored at 173, roughly
 * six percent under, matching the convention the preview-route floor set.
 *
 * **AND THE 174 THIS PARAGRAPH USED TO CARRY HAD ALREADY DRIFTED BY SEVEN.**
 * Measured 2026-08-23 by extracting HEAD's copy of this gate and running it
 * against the current tree: 181, before the three SiteSpeculation assertions
 * above landed. So the value was stale within the same day it was written, by
 * ordinary commits doing ordinary work, which is the whole argument for the
 * floor being a floor rather than an equality. The delta is stated as a
 * measurement of two runs, never as arithmetic on the new block.
 */
const MINIMUM_CHECKS = 187;
const floorBreach = assertFloor("check:headers", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
