/* A scheduled post goes live with no write to purge on, so a page listing posts must expire at the
 * next publish_at rather than a day after it was rendered. */

import test from "node:test";
import assert from "node:assert/strict";

import {
  EDGE_CACHE_CONTROL,
  HOME_EDGE_FRESH_SECONDS,
  scheduledEdgeCacheControl,
} from "../app/lib/seo.ts";

const NOW = new Date(Date.UTC(2026, 8, 27, 12, 0, 0));
const inSeconds = (s) => new Date(NOW.getTime() + s * 1000);
const maxAge = (header) => Number(/\bmax-age=(\d+)/.exec(header)?.[1]);

test("WITH NOTHING SCHEDULED the policy is exactly the plain edge policy", () => {
  assert.equal(scheduledEdgeCacheControl(NOW, null), EDGE_CACHE_CONTROL);
});

test("a post five minutes out caps the lifetime at five minutes", () => {
  assert.equal(maxAge(scheduledEdgeCacheControl(NOW, inSeconds(300))), 300);
});

test("only max-age moves: stale-while-revalidate is kept", () => {
  const capped = scheduledEdgeCacheControl(NOW, inSeconds(300));
  assert.equal(capped.replace(/max-age=\d+/, ""), EDGE_CACHE_CONTROL.replace(/max-age=\d+/, ""));
});

test("a post further out than the normal lifetime changes nothing", () => {
  assert.equal(scheduledEdgeCacheControl(NOW, inSeconds(3 * 86_400)), EDGE_CACHE_CONTROL);
});

test("a fraction of a second rounds up, so the page never expires before the post is live", () => {
  assert.equal(maxAge(scheduledEdgeCacheControl(NOW, inSeconds(299.2))), 300);
});

test("NEVER BELOW THE FLOOR, however close or already past the publish_at is", () => {
  for (const s of [59, 1, 0, -30]) {
    assert.equal(maxAge(scheduledEdgeCacheControl(NOW, inSeconds(s))), 60, `${s}s out`);
  }
});

test("a shorter normal lifetime wins over a later publish_at, as on the home page", () => {
  assert.equal(
    maxAge(scheduledEdgeCacheControl(NOW, null, HOME_EDGE_FRESH_SECONDS)),
    HOME_EDGE_FRESH_SECONDS,
  );
  assert.equal(
    maxAge(scheduledEdgeCacheControl(NOW, inSeconds(3600), HOME_EDGE_FRESH_SECONDS)),
    HOME_EDGE_FRESH_SECONDS,
  );
  assert.equal(maxAge(scheduledEdgeCacheControl(NOW, inSeconds(120), HOME_EDGE_FRESH_SECONDS)), 120);
});
