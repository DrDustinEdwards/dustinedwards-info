/**
 * The analytics path redaction: a preview token never reaches the dataset.
 *
 * REPLAYS THE DEFECT, per hard rule 12. Measured on production 2026-08-15, in
 * the first real use of a draft preview link: the capture wrote `url.pathname`
 * verbatim, so the full 43-character capability landed in Analytics Engine and
 * `/admin/origin-requests` printed it as a row label.
 *
 * The token used below is the ACTUAL one from that incident. It was revoked
 * before this file existed and its seven day TTL has it expiring anyway, so it
 * is inert; it is used rather than a synthetic string because a replay should
 * replay, and because a fixture that differs from the real value in some way
 * nobody noticed is how a replay passes without covering the defect.
 *
 * @see app/lib/analytics-path.mjs
 * @see workers/app.ts, the recordTraffic capture
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  PREVIEW_PATH_LABEL,
  analyticsPath,
  carriesPreviewToken,
} from "../app/lib/analytics-path.mjs";
import { mintToken } from "../app/lib/preview-token.mjs";

/** The token from the 2026-08-15 incident. Revoked, and expired by TTL. */
const INCIDENT_TOKEN = "CPWahe1WuFGSMh0pOltNbJBwYLxzJzAuRvpSyOBLstI";

test("THE DEFECT: the incident path is recorded without its token", () => {
  const recorded = analyticsPath(`/preview/${INCIDENT_TOKEN}`);
  assert.equal(recorded, "/preview/:token");
  assert.ok(!recorded.includes(INCIDENT_TOKEN), "the token must not survive");
  assert.ok(!carriesPreviewToken(recorded), "no 43-character segment may remain");
});

test("REPLAY: the shipped expression stored the token verbatim", () => {
  // What `workers/app.ts` did before this landed, so the test proves the two
  // expressions differ rather than merely proving the new one looks right.
  const asItWas = (/** @type {string} */ p) => p;
  const path = `/preview/${INCIDENT_TOKEN}`;
  assert.ok(carriesPreviewToken(asItWas(path)), "the old expression leaked it");
  assert.ok(!carriesPreviewToken(analyticsPath(path)), "the current one must not");
});

test("no minted token survives, over many tokens", () => {
  // Not a randomness test. It catches a redaction keyed to something incidental
  // about one token, such as its first character or a substring.
  for (let i = 0; i < 200; i += 1) {
    const token = mintToken();
    const recorded = analyticsPath(`/preview/${token}`);
    assert.equal(recorded, PREVIEW_PATH_LABEL);
    assert.ok(!recorded.includes(token));
  }
});

test("the label is a route pattern and carries no token shape of its own", () => {
  assert.equal(PREVIEW_PATH_LABEL, "/preview/:token");
  assert.ok(!carriesPreviewToken(PREVIEW_PATH_LABEL));
});

test("ONE ROW PER REQUEST IS UNCHANGED: only the identifier goes", () => {
  // Every preview read collapses to the SAME label, which is the property that
  // keeps the count meaningful while making the rows indistinguishable.
  const a = analyticsPath(`/preview/${mintToken()}`);
  const b = analyticsPath(`/preview/${mintToken()}`);
  assert.equal(a, b);
});

test("every other path passes through completely unchanged", () => {
  // The narrowness is the design. A scrubber that guessed which segments look
  // secret would be wrong in both directions and silently.
  for (const path of [
    "/",
    "/blog",
    "/blog/where-should-a-blog-store-its-words",
    "/colophon",
    "/projects",
    "/playground",
    "/phage-discovery",
    "/search",
    "/admin",
    "/admin/origin-requests",
    "/media/1234abcd5678ef90.png",
    "/previews/something",
    "/preview",
    "/not-preview/abc",
  ]) {
    assert.equal(analyticsPath(path), path, `${path} must not be rewritten`);
  }
});

test("the prefix requires the trailing slash, so /preview alone is untouched", () => {
  // `/preview` has no route and carries no capability, so there is nothing to
  // redact and nothing to hide. Asserted so a future widening to `/preview` is
  // a deliberate diff.
  assert.equal(analyticsPath("/preview"), "/preview");
  assert.equal(analyticsPath("/previewer"), "/previewer");
  assert.equal(analyticsPath("/preview/"), PREVIEW_PATH_LABEL);
});

test("a malformed or truncated token is redacted too", () => {
  // The redaction is by PREFIX, not by token validity, which is the fail-closed
  // reading: anything under the preview route is treated as a capability even
  // if it could never have been one.
  assert.equal(analyticsPath("/preview/short"), PREVIEW_PATH_LABEL);
  assert.equal(analyticsPath("/preview/aaaa/bbbb"), PREVIEW_PATH_LABEL);
  assert.equal(analyticsPath(`/preview/${INCIDENT_TOKEN}extra`), PREVIEW_PATH_LABEL);
});

test("FAILS CLOSED on a non-string", () => {
  // A thrown TypeError inside the capture would be swallowed by its own catch,
  // so the row would silently vanish. An empty string keeps the row and loses
  // only the path, which is the lesser failure.
  assert.equal(analyticsPath(undefined), "");
  assert.equal(analyticsPath(null), "");
  assert.equal(analyticsPath(42), "");
});

test("the checker can actually fire, so the absence assertions are not vacuous", () => {
  // A needle that never matches would make every `!carriesPreviewToken(...)`
  // above pass on anything at all.
  assert.ok(carriesPreviewToken(`/preview/${INCIDENT_TOKEN}`));
  assert.ok(carriesPreviewToken(`/preview/${mintToken()}`));
  assert.ok(!carriesPreviewToken("/preview/short"));
  assert.ok(!carriesPreviewToken("/blog/a-post"));
});
