import test from "node:test";
import assert from "node:assert/strict";

import {
  STANDARD_SECURITY_HEADERS,
  applyHeaderSet,
  buildPolicy,
  checkSecurityHeaders,
  failures,
  generateNonce,
  scriptHash,
} from "../packages/security-headers/index.mjs";
import { declaredSecurityHeaders } from "../scripts/lib/header-constants.mjs";
import { contentSecurityPolicy, enhanceLoaderHash } from "../workers/csp.mjs";
import { ENHANCE_LOADER } from "../app/lib/enhance-loader.mjs";

const GOOD_POLICY = buildPolicy([
  "default-src 'self'",
  "script-src 'sha256-abc' 'strict-dynamic'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "report-uri /csp",
]);

/** @param {Record<string, string | null>} [changes] a header's new value, or null to remove it */
function response(changes = {}) {
  const headers = new Headers();
  applyHeaderSet(headers);
  headers.set("Content-Security-Policy", GOOD_POLICY);
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  }
  return headers;
}

const failed = (/** @type {Headers} */ headers) => failures(checkSecurityHeaders(headers)).map((r) => r.name);

test("a response with the standard set and a strict enforced policy passes every check", () => {
  const results = checkSecurityHeaders(response());
  assert.ok(results.length >= 14, `only ${results.length} checks ran`);
  assert.deepEqual(failures(results), []);
});

/*
 * Each check seen red once: one planted defect per case, and that check (and only that check) fails.
 * The regexes are on the check's name, so a renamed check cannot pass by failing something else.
 */
const PLANTED = [
  ["no HSTS", { "Strict-Transport-Security": null }, /^Strict-Transport-Security is present$/],
  ["a short HSTS", { "Strict-Transport-Security": "max-age=300" }, /^Strict-Transport-Security lasts/],
  ["sniffing allowed", { "X-Content-Type-Options": null }, /^X-Content-Type-Options is present$/],
  ["a leaky Referrer-Policy", { "Referrer-Policy": "unsafe-url" }, /^Referrer-Policy is a strict policy$/],
  ["framing allowed", { "X-Frame-Options": "ALLOW-FROM https://x" }, /^X-Frame-Options refuses framing$/],
  ["the camera allowed", { "Permissions-Policy": "microphone=(), geolocation=(), payment=()" }, /^Permissions-Policy denies/],
  ["a report-only policy", { "Content-Security-Policy": null, "Content-Security-Policy-Report-Only": GOOD_POLICY }, /^the Content-Security-Policy is enforced/],
  ["no script directive", { "Content-Security-Policy": "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; report-uri /csp" }, /^the policy governs scripts/],
  ["'unsafe-inline' scripts", { "Content-Security-Policy": GOOD_POLICY.replace("'strict-dynamic'", "'unsafe-inline'") }, /^scripts: no 'unsafe-inline'$/],
  ["'unsafe-eval' scripts", { "Content-Security-Policy": GOOD_POLICY.replace("'strict-dynamic'", "'unsafe-eval'") }, /^scripts: no 'unsafe-eval'$/],
  ["a wildcard script source", { "Content-Security-Policy": GOOD_POLICY.replace("'strict-dynamic'", "https:") }, /^scripts: no wildcard/],
  ["plugins allowed", { "Content-Security-Policy": GOOD_POLICY.replace("object-src 'none'", "object-src 'self'") }, /^object-src is 'none'$/],
  ["no base-uri", { "Content-Security-Policy": GOOD_POLICY.replace("base-uri 'none'; ", "") }, /^base-uri is/],
  ["no frame-ancestors", { "Content-Security-Policy": GOOD_POLICY.replace("frame-ancestors 'none'; ", "") }, /^frame-ancestors is set$/],
  ["no report sink", { "Content-Security-Policy": GOOD_POLICY.replace("; report-uri /csp", "") }, /^violations are reported/],
];

for (const [label, changes, expected] of PLANTED) {
  test(`red once: ${label}`, () => {
    const names = failed(response(/** @type {Record<string, string | null>} */ (changes)));
    assert.equal(names.length, 1, `expected exactly one failure, got ${JSON.stringify(names)}`);
    assert.match(names[0] ?? "", /** @type {RegExp} */ (expected));
  });
}

test("a response with no security headers at all fails every header check (foxing and txasm today)", () => {
  const names = failed(new Headers({ "content-type": "text/html" }));
  for (const name of Object.keys(STANDARD_SECURITY_HEADERS)) {
    assert.ok(names.includes(`${name} is present`), name);
  }
  assert.ok(names.some((n) => n.startsWith("the Content-Security-Policy is enforced")));
});

test("applyHeaderSet overwrites by default and merges when asked", () => {
  const headers = new Headers({ "X-Frame-Options": "SAMEORIGIN" });
  applyHeaderSet(headers, STANDARD_SECURITY_HEADERS, { overwrite: false });
  assert.equal(headers.get("X-Frame-Options"), "SAMEORIGIN");
  applyHeaderSet(headers);
  assert.equal(headers.get("X-Frame-Options"), "DENY");
});

test("generateNonce is fresh per call and long enough; buildPolicy refuses an empty directive", () => {
  const a = generateNonce();
  assert.ok(a.length >= 22);
  assert.notEqual(a, generateNonce());
  assert.throws(() => buildPolicy(["default-src 'self'", " "]));
});

/* The adoption: this site's own set and both arms of its policy meet the package's floor. */
test("dustinedwards.info's declared set and policy pass the shared check", async () => {
  const declared = declaredSecurityHeaders();
  assert.ok(declared && Object.keys(declared).length > 0);
  for (const nonce of [undefined, "an-admin-nonce"]) {
    const headers = new Headers(declared);
    headers.set("Content-Security-Policy", await contentSecurityPolicy("/", nonce));
    assert.deepEqual(failures(checkSecurityHeaders(headers)), [], nonce ? "admin arm" : "public arm");
  }
  assert.equal(await enhanceLoaderHash(), await scriptHash(ENHANCE_LOADER));
});
