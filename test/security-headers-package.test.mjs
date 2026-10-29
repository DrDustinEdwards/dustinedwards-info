// This site's security headers against site-runtime's check and OWASP's suite. The package's own
// builders, check and suite runner are tested in site-runtime, where they live.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import matter from "gray-matter";

import { TDM_RESERVATION_HEADERS } from "@drdustinedwards/site-helpers/robots";

import {
  LOGOUT_HEADERS,
  OWASP_SKIPPED,
  buildSecurityHeaders,
  checkSecurityHeaders,
  failures,
  generateNonce,
  runOshpSuite,
} from "@dustinedwards/site-runtime";
import { SECURITY_HEADERS, SITE_HEADER_OVERRIDES } from "../workers/security-headers.mjs";
import { contentSecurityPolicy } from "../workers/csp.mjs";

const suite = /** @type {any} */ (matter.engines.yaml.parse(readFileSync(new URL("../node_modules/@dustinedwards/site-runtime/oshp-tests-suite.yml", import.meta.url), "utf8")));
const headerOf = (/** @type {string} */ caseName) => caseName.replace(/ \(should not exist\)$/, "");

/** @param {Headers} headers @param {Headers | undefined} [logout] */
const runSuite = (headers, logout) =>
  runOshpSuite(suite, { page: { status: 200, headers }, ...(logout ? { logout: { status: 200, headers: logout } } : {}) });

await test("this site's set is the standard plus its deviations, each with a reason, and the suite names them", async () => {
  assert.deepEqual(SECURITY_HEADERS, { ...buildSecurityHeaders({ overrides: SITE_HEADER_OVERRIDES }), ...TDM_RESERVATION_HEADERS });
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

await test("dustinedwards.info's declared set and policy pass the shared check, beacon included", async () => {
  assert.ok(Object.keys(SECURITY_HEADERS).length > 0);
  for (const nonce of [undefined, generateNonce()]) {
    const headers = new Headers(SECURITY_HEADERS);
    headers.set("Content-Security-Policy", await contentSecurityPolicy("/", nonce));
    assert.deepEqual(failures(checkSecurityHeaders(headers, { standard: SECURITY_HEADERS, cloudflareWebAnalytics: true })), [], nonce ? "admin arm" : "public arm");
  }
});

await test("this site's policy is what it was before the package built it", async () => {
  const policy = await contentSecurityPolicy("/", undefined);
  assert.ok(policy.startsWith("default-src 'self'; script-src 'self' https://static"), policy);
  assert.ok(policy.includes("'self' https://static.cloudflareinsights.com/beacon.min.js https://static.cloudflareinsights.com/beacon.min.js/; style-src 'self'; style-src-attr 'unsafe-inline'; font-src 'self'; img-src 'self' data:; media-src 'self' https://"));
  assert.ok(policy.endsWith("; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; report-uri /api/csp-report; report-to csp-endpoint"));
  const admin = await contentSecurityPolicy("/admin", "0b1c2d3e-aaaa-bbbb-cccc-1234567890ab");
  assert.ok(admin.includes("script-src 'nonce-0b1c2d3e-aaaa-bbbb-cccc-1234567890ab' 'self' https://static"), admin);
  assert.ok(admin.includes("style-src 'self' 'nonce-0b1c2d3e-aaaa-bbbb-cccc-1234567890ab'; style-src-attr"));
});
