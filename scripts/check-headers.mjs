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
const source = readFileSync(APP_PATH, "utf8");
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

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

console.log(
  `\n  ${Object.keys(declared).length} static header(s) declared, ${applications - 1} application site(s)`,
);
console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
