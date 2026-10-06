import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import matter from "gray-matter";

import {
  CLOUDFLARE_WEB_ANALYTICS,
  LOGOUT_HEADERS,
  OWASP_RECOMMENDED,
  OWASP_REMOVE,
  OWASP_SKIPPED,
  OWASP_SOURCE,
  STANDARD_SECURITY_HEADERS,
  applyHeaderSet,
  buildContentSecurityPolicy,
  buildPolicy,
  buildSecurityHeaders,
  checkSecurityHeaders,
  failures,
  generateNonce,
  runOshpSuite,
  scriptHash,
} from "../packages/security-headers/index.mjs";
import { ENHANCE_LOADER } from "../app/lib/enhance-loader.mjs";
import { SECURITY_HEADERS, SITE_HEADER_OVERRIDES } from "../workers/security-headers.mjs";
import { contentSecurityPolicy, enhanceLoaderHash } from "../workers/csp.mjs";

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
  ["a missing OSHP header (X-DNS-Prefetch-Control)", { "X-DNS-Prefetch-Control": null }, /^X-DNS-Prefetch-Control is present$/],
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
  assert.equal(headers.get("X-Frame-Options"), STANDARD_SECURITY_HEADERS["X-Frame-Options"]);
});

test("generateNonce is fresh per call and long enough; buildPolicy refuses an empty directive", () => {
  const a = generateNonce();
  assert.ok(a.length >= 22);
  assert.notEqual(a, generateNonce());
  assert.throws(() => buildPolicy(["default-src 'self'", " "]));
});

/* ---------------------------------------------------------------------------------------------- the defaults */

test("the defaults are OWASP's: read from the project, dated, and recorded in the README with the page", () => {
  assert.match(OWASP_SOURCE.page, /^https:\/\/owasp\.org\/www-project-secure-headers\/$/);
  assert.match(OWASP_SOURCE.readOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(OWASP_SOURCE.lastUpdateUtc, "OSHP states when its list was last updated");
  assert.ok(Object.keys(OWASP_RECOMMENDED).length >= 10 && OWASP_REMOVE.length > 10);
  const readme = readFileSync(new URL("../packages/security-headers/README.md", import.meta.url), "utf8");
  assert.ok(readme.includes(OWASP_SOURCE.page) && readme.includes(`**${OWASP_SOURCE.readOn}**`), "the README names the page and the date the generated module says");
  // Every value of the standard is OSHP's own string, never a retyped one.
  for (const [name, value] of Object.entries(STANDARD_SECURITY_HEADERS)) assert.equal(value, OWASP_RECOMMENDED[name], name);
});

test("what OSHP recommends and the standard leaves out is exactly the skipped list, each with its reason", () => {
  const left = Object.keys(OWASP_RECOMMENDED).filter((name) => !(name in STANDARD_SECURITY_HEADERS));
  assert.deepEqual(left.sort(), Object.keys(OWASP_SKIPPED).sort());
  assert.deepEqual(Object.keys(OWASP_SKIPPED).sort(), ["Cache-Control", "Clear-Site-Data", "Content-Security-Policy", "Cross-Origin-Embedder-Policy"]);
  for (const [name, reason] of Object.entries(OWASP_SKIPPED)) assert.ok(reason.length > 60, `${name} says why`);
  assert.equal(LOGOUT_HEADERS["Clear-Site-Data"], OWASP_RECOMMENDED["Clear-Site-Data"]);
});

test("a site's overrides each carry a reason and change something", () => {
  assert.deepEqual(buildSecurityHeaders(), { ...STANDARD_SECURITY_HEADERS });
  const set = buildSecurityHeaders({ overrides: { "Referrer-Policy": { value: "same-origin", reason: "a documented reason" } } });
  assert.equal(set["Referrer-Policy"], "same-origin");
  const added = buildSecurityHeaders({ overrides: { "X-Extra": { value: "1", reason: "a header this site adds itself" } } });
  assert.equal(added["X-Extra"], "1");
  assert.equal(buildSecurityHeaders({ overrides: { "X-Permitted-Cross-Domain-Policies": { value: null, reason: "this site serves a flash policy file" } } })["X-Permitted-Cross-Domain-Policies"], undefined);
  assert.throws(() => buildSecurityHeaders({ overrides: { "Referrer-Policy": { value: "same-origin", reason: "" } } }), /no reason/);
  assert.throws(() => buildSecurityHeaders({ overrides: { "X-Frame-Options": { value: STANDARD_SECURITY_HEADERS["X-Frame-Options"] ?? "", reason: "the same as the standard" } } }), /already says/);
  assert.throws(() => buildSecurityHeaders({ overrides: { "X-Frame-Options": { value: " ", reason: "an empty value, wrongly" } } }), /empty/);
  assert.throws(() => buildSecurityHeaders({ overrides: { "X-Nothing": { value: null, reason: "removing what is not there" } } }), /does not send/);
});

/* ---------------------------------------------------------------------------------- the policy, from a site's list */

const SITE = { sources: { img: ["data:"], media: ["https://media.example.com"] }, scriptHashes: ["sha256-abcdef"], cloudflareWebAnalytics: true, reportUri: "/csp", reportTo: "csp-endpoint" };

test("the policy is built from the site's list, with the fixed parts and the beacon written once", () => {
  const { name, value } = buildContentSecurityPolicy(SITE);
  assert.equal(name, "Content-Security-Policy");
  assert.equal(
    value,
    [
      "default-src 'self'",
      "script-src 'sha256-abcdef' 'self' https://static.cloudflareinsights.com/beacon.min.js https://static.cloudflareinsights.com/beacon.min.js/",
      "style-src 'self'",
      "font-src 'self'",
      "img-src 'self' data:",
      "media-src 'self' https://media.example.com",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "report-uri /csp",
      "report-to csp-endpoint",
    ].join("; "),
  );
  assert.deepEqual([...CLOUDFLARE_WEB_ANALYTICS.script], ["https://static.cloudflareinsights.com/beacon.min.js", "https://static.cloudflareinsights.com/beacon.min.js/"]);
});

test("a nonce goes on scripts and styles, report-only changes the header's name, frames are listed only when asked", () => {
  const nonce = generateNonce();
  const { value } = buildContentSecurityPolicy({ ...SITE, nonce, styleAttributesInline: true, sources: { ...SITE.sources, frame: ["https://embed.example.com"] } });
  assert.ok(value.includes(`script-src 'nonce-${nonce}' 'sha256-abcdef' 'self'`));
  assert.ok(value.includes(`style-src 'self' 'nonce-${nonce}'`));
  assert.ok(value.includes("style-src-attr 'unsafe-inline'"));
  assert.ok(value.includes("frame-src 'self' https://embed.example.com"));
  assert.equal(buildContentSecurityPolicy({ ...SITE, reportOnly: true }).name, "Content-Security-Policy-Report-Only");
  assert.ok(!buildContentSecurityPolicy(SITE).value.includes("frame-src"));
});

test("the builder refuses a list the check would fail", () => {
  assert.throws(() => buildContentSecurityPolicy({ ...SITE, sources: { script: ["*"] } }), /not an acceptable script source/);
  assert.throws(() => buildContentSecurityPolicy({ ...SITE, sources: { script: ["https:"] } }), /not an acceptable script source/);
  assert.throws(() => buildContentSecurityPolicy({ ...SITE, sources: { script: ["'unsafe-inline'"] } }), /not an acceptable script source/);
  assert.throws(() => buildContentSecurityPolicy({ ...SITE, sources: { img: ["a b"] } }), /not a CSP source/);
  assert.throws(() => buildContentSecurityPolicy({ ...SITE, reportUri: undefined, reportTo: undefined }), /report sink/);
  assert.throws(() => buildContentSecurityPolicy({ ...SITE, nonce: "short" }), /nonce/);
  assert.throws(() => buildContentSecurityPolicy({ ...SITE, scriptHashes: ["md5-xyz"] }), /hash source/);
});

test("a built policy on the standard set passes the check, beacon included", () => {
  const headers = new Headers(STANDARD_SECURITY_HEADERS);
  headers.set("Content-Security-Policy", buildContentSecurityPolicy(SITE).value);
  assert.deepEqual(failures(checkSecurityHeaders(headers, { cloudflareWebAnalytics: true })), []);
});

/* Seen failing, for the beacon: a policy that names the file but not its versioned path, and one that cannot report. */
test("red once: a policy without the beacon's path prefix", () => {
  const headers = new Headers(STANDARD_SECURITY_HEADERS);
  headers.set("Content-Security-Policy", buildContentSecurityPolicy({ ...SITE, cloudflareWebAnalytics: false, sources: { script: [CLOUDFLARE_WEB_ANALYTICS.script[0] ?? ""] } }).value);
  const names = failures(checkSecurityHeaders(headers, { cloudflareWebAnalytics: true })).map((r) => r.name);
  assert.deepEqual(names, ["the policy lets the Cloudflare Web Analytics beacon run: its script path prefix"]);
});

test("red once: a policy whose connect-src is not the site itself", () => {
  const headers = new Headers(STANDARD_SECURITY_HEADERS);
  headers.set("Content-Security-Policy", buildContentSecurityPolicy(SITE).value.replace("connect-src 'self'", "connect-src https://elsewhere.example.com"));
  const names = failures(checkSecurityHeaders(headers, { cloudflareWebAnalytics: true })).map((r) => r.name);
  assert.deepEqual(names, ["the policy lets the beacon report: connect-src includes the site itself"]);
});

/* ------------------------------------------------------------------------------------------ OWASP's own suite */

const suite = /** @type {any} */ (matter.engines.yaml.parse(readFileSync(new URL("../packages/security-headers/oshp-tests-suite.yml", import.meta.url), "utf8")));
const headerOf = (/** @type {string} */ caseName) => caseName.replace(/ \(should not exist\)$/, "");

/** @param {Headers} headers @param {Headers | undefined} [logout] */
const runSuite = (headers, logout) =>
  runOshpSuite(suite, { page: { status: 200, headers }, ...(logout ? { logout: { status: 200, headers: logout } } : {}) });

const standardResponse = () => {
  const headers = new Headers(STANDARD_SECURITY_HEADERS);
  headers.set("Content-Security-Policy", buildContentSecurityPolicy(SITE).value);
  return headers;
};
const logoutResponse = () => {
  const headers = standardResponse();
  for (const [name, value] of Object.entries(LOGOUT_HEADERS)) headers.set(name, value);
  return headers;
};

test("OWASP's suite is read whole, and the runner understands every operator in it", () => {
  assert.ok(suite.testcases.length >= 15, "the suite has its test cases");
  const results = runSuite(standardResponse(), logoutResponse());
  assert.equal(results.length, suite.testcases.length);
  assert.throws(() => runOshpSuite({ testcases: [{ name: "x", steps: [{ assertions: ["result.headers.X ShouldBeBlue"] }] }] }, { page: { status: 200, headers: new Headers() } }), /unsupported operator/);
  assert.throws(() => runOshpSuite({ testcases: [] }, { page: { status: 200, headers: new Headers() } }), /no test cases/);
});

test("OWASP's suite against the package's output: it fails the cases for the headers the package skips on every response, and no others", () => {
  const failing = runSuite(standardResponse(), logoutResponse()).filter((r) => !r.pass).map((r) => headerOf(r.name));
  assert.deepEqual(failing.sort(), ["Cache-Control", "Cross-Origin-Embedder-Policy"], "Cache-Control and COEP are skipped, with their reasons, in OWASP_SKIPPED");
  assert.ok("Cache-Control" in OWASP_SKIPPED && "Cross-Origin-Embedder-Policy" in OWASP_SKIPPED);
});

test("Clear-Site-Data belongs to the logout response: the suite passes it there and fails it on a page", () => {
  const onLogout = runSuite(standardResponse(), logoutResponse()).find((r) => r.name === "Clear-Site-Data");
  assert.equal(onLogout?.pass, true);
  const noLogout = runSuite(standardResponse()).find((r) => r.name === "Clear-Site-Data");
  assert.equal(noLogout?.pass, false);
});

test("red once: OWASP's suite names the header a response lacks", () => {
  const headers = standardResponse();
  headers.delete("X-Content-Type-Options");
  const failing = runSuite(headers, logoutResponse()).filter((r) => !r.pass).map((r) => headerOf(r.name));
  assert.ok(failing.includes("X-Content-Type-Options"), JSON.stringify(failing));
  const wrong = standardResponse();
  wrong.set("Referrer-Policy", "unsafe-url");
  assert.ok(runSuite(wrong, logoutResponse()).some((r) => !r.pass && r.name === "Referrer-Policy"));
});

/* ----------------------------------------------------------------------------------------------- this site */

test("this site's set is the standard plus its deviations, each with a reason, and the suite names them", async () => {
  assert.deepEqual(SECURITY_HEADERS, buildSecurityHeaders({ overrides: SITE_HEADER_OVERRIDES }));
  for (const [name, { reason }] of Object.entries(SITE_HEADER_OVERRIDES)) assert.ok(reason.length > 40, `${name} says why`);
  const headers = new Headers(SECURITY_HEADERS);
  headers.set("Content-Security-Policy", await contentSecurityPolicy("/", undefined));
  const logout = new Headers(headers);
  for (const [name, value] of Object.entries(LOGOUT_HEADERS)) logout.set(name, value);
  const failing = runSuite(headers, logout).filter((r) => !r.pass).map((r) => headerOf(r.name));
  // The cases this site fails are the headers it skips, the headers it deviates on, and its policy (style attributes).
  const expected = new Set([...Object.keys(OWASP_SKIPPED).filter((n) => n !== "Clear-Site-Data"), ...Object.keys(SITE_HEADER_OVERRIDES)]);
  assert.deepEqual([...new Set(failing)].sort(), [...expected].sort());
});

test("dustinedwards.info's declared set and policy pass the shared check, beacon included", async () => {
  assert.ok(Object.keys(SECURITY_HEADERS).length > 0);
  for (const nonce of [undefined, generateNonce()]) {
    const headers = new Headers(SECURITY_HEADERS);
    headers.set("Content-Security-Policy", await contentSecurityPolicy("/", nonce));
    assert.deepEqual(failures(checkSecurityHeaders(headers, { standard: SECURITY_HEADERS, cloudflareWebAnalytics: true })), [], nonce ? "admin arm" : "public arm");
  }
  assert.equal(await enhanceLoaderHash(), await scriptHash(ENHANCE_LOADER));
});

test("this site's policy is what it was before the package built it", async () => {
  const loader = await scriptHash(ENHANCE_LOADER);
  const policy = await contentSecurityPolicy("/", undefined);
  assert.ok(policy.startsWith(`default-src 'self'; script-src '${loader}' '`), policy);
  assert.ok(policy.includes("'self' https://static.cloudflareinsights.com/beacon.min.js https://static.cloudflareinsights.com/beacon.min.js/; style-src 'self'; style-src-attr 'unsafe-inline'; font-src 'self'; img-src 'self' data:; media-src 'self' https://"));
  assert.ok(policy.endsWith("; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; report-uri /api/csp-report; report-to csp-endpoint"));
  const admin = await contentSecurityPolicy("/admin", "0b1c2d3e-aaaa-bbbb-cccc-1234567890ab");
  assert.ok(admin.includes("script-src 'nonce-0b1c2d3e-aaaa-bbbb-cccc-1234567890ab' 'sha256-"));
  assert.ok(admin.includes("style-src 'self' 'nonce-0b1c2d3e-aaaa-bbbb-cccc-1234567890ab'; style-src-attr"));
});
