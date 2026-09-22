/**
 * `excludedFromAssets()` names two files and swallows nothing else.
 *
 * WHAT THIS PROTECTS. `public/_headers` landed on 2026-08-16 and jammed
 * `build:assets`, because `classify()` throws on an extension it does not know
 * and a deploy-time control file has no extension at all. The file shipped
 * anyway: `npm run build` is `react-router build` and never regenerates the
 * manifest, so nothing in the offline tier ran the walk. `check:media` named it
 * on the next remote run, which is one deploy too late.
 *
 * THE FIX IS NOT THE INTERESTING PART. The interesting part is the fix that was
 * NOT taken. "Skip anything with no extension" would have cleared the build in
 * one line and would have made every future extensionless file vanish from the
 * manifest silently, which is the failure mode the throw in `classify()` exists
 * to prevent. So the exclusion is a NAMED map with a stated reason, and the
 * cases below are what stop it drifting back into a rule: an unrecognised
 * extensionless path must still be excluded from NOTHING and must still throw.
 *
 * THE ANCHORING CASE IS LOAD-BEARING TOO. Cloudflare reads `_headers` at the
 * ROOT of the assets directory and nowhere else, so a `_headers` in a
 * subdirectory is an ordinary unrecognised file. Matching on the site-absolute
 * path rather than the basename is what makes that true, and it is one
 * character away from being false.
 */

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
  // The one-line fix that was refused. Every path here has no extension and
  // none of them is a Cloudflare control file.
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
