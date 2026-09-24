/* `classify()` throws on an unknown extension on purpose, so exclusions are a NAMED map and never
 * "skip anything extensionless". Cloudflare reads `_headers` only at the ROOT of the assets
 * directory, so the match is on the site-absolute path, not the basename. */

import test from "node:test";
import assert from "node:assert/strict";

import { classify, excludedFromAssets } from "../app/lib/media/classify.mjs";

test("_headers is excluded, with a reason", () => {
  const reason = excludedFromAssets("/_headers");
  assert.equal(typeof reason, "string");
  // A blank reason is an exclusion nobody has to justify, which is the state
  // this map exists to make impossible.
  assert.ok(reason.length > 20, `reason too thin to be one: ${JSON.stringify(reason)}`);
});

test("_redirects is excluded, with a reason", () => {
  const reason = excludedFromAssets("/_redirects");
  assert.equal(typeof reason, "string");
  assert.ok(reason.length > 20, `reason too thin to be one: ${JSON.stringify(reason)}`);
});

test("the exclusion is a list, not an extensionless catch-all", () => {
  // Every path here has no extension and none of them is a Cloudflare control file.
  for (const p of ["/LICENSE", "/robots", "/_worker", "/Dockerfile", "/CNAME"]) {
    assert.equal(excludedFromAssets(p), null, `${p} was quietly excluded`);
  }
});

test("an unrecognised extensionless file still stops the build", () => {
  assert.throws(() => classify("/LICENSE"), /unclassified asset/);
  // The message has to name the file and say where to fix it, because the
  // person reading it is mid-build and has no other context.
  assert.throws(() => classify("/CNAME"), /classify\.mjs/);
});

test("the exclusion is anchored at the root of public/", () => {
  // Cloudflare's contract is root-only. A control file one directory down is
  // not a control file, and must fail the way any other unknown file fails.
  assert.equal(excludedFromAssets("/publications/_headers"), null);
  assert.equal(excludedFromAssets("/diagrams/_redirects"), null);
  assert.throws(() => classify("/publications/_headers"), /unclassified asset/);
});

test("a real asset is not excluded", () => {
  // The direction that catches an over-broad match: if these ever start
  // returning a reason, the manifest has silently lost files.
  for (const p of ["/favicon.ico", "/dustin-edwards-og-image.png", "/site.webmanifest", "/dustin-edwards-logo.svg"]) {
    assert.equal(excludedFromAssets(p), null, `${p} was excluded from the manifest`);
  }
});
