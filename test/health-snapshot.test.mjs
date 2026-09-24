/* A stored snapshot risks a cached page presenting an old or malformed verdict as current, so
 * every uncertain input must resolve to `missing` rather than a green tile. */

import test from "node:test";
import assert from "node:assert/strict";

import {
  HEALTH_SNAPSHOT_STALE_AFTER_SECONDS,
  formatAge,
  healthTile,
  snapshotFromBody,
} from "../app/lib/health/snapshot.mjs";

const NOW = Date.parse("2026-08-26T14:00:00.000Z");

/** @param {number} secondsAgo */
function snapshotAgedBy(secondsAgo, overrides = {}) {
  return {
    ok: true,
    total: 5,
    failed: 0,
    readAt: new Date(NOW - secondsAgo * 1000).toISOString(),
    ...overrides,
  };
}

test("a snapshot inside the window is fresh and carries its age", () => {
  const tile = healthTile(snapshotAgedBy(120), NOW);
  assert.equal(tile.state, "fresh");
  assert.equal(tile.ageSeconds, 120);
  assert.equal(tile.ok, true);
  assert.equal(tile.total, 5);
  assert.equal(tile.failed, 0);
});

test("THE BOUNDARY IS INCLUSIVE: exactly three intervals old is still fresh", () => {
  assert.equal(healthTile(snapshotAgedBy(HEALTH_SNAPSHOT_STALE_AFTER_SECONDS), NOW).state, "fresh");
  assert.equal(
    healthTile(snapshotAgedBy(HEALTH_SNAPSHOT_STALE_AFTER_SECONDS + 1), NOW).state,
    "stale",
  );
});

test("a FAILING verdict is still shown, with the failed count intact", () => {
  // A snapshot that recorded only healthy runs would let the tile keep showing
  // the last good answer while the site was failing.
  const tile = healthTile(snapshotAgedBy(60, { ok: false, failed: 2 }), NOW);
  assert.equal(tile.state, "fresh");
  assert.equal(tile.ok, false);
  assert.equal(tile.failed, 2);
});

test("absence is missing, in every form KV can hand back", () => {
  for (const value of [null, undefined, "", 0, false, "a string", 42]) {
    assert.equal(healthTile(value, NOW).state, "missing", `for ${JSON.stringify(value)}`);
  }
});

test("FAILS CLOSED on every malformed field, one at a time", () => {
  const cases = {
    "readAt absent": { readAt: undefined },
    "readAt not a string": { readAt: 1787779776701 },
    "readAt unparseable": { readAt: "not a date" },
    "ok not a boolean": { ok: "yes" },
    "total not a number": { total: "5" },
    "failed not a number": { failed: null },
  };
  for (const [name, override] of Object.entries(cases)) {
    assert.equal(healthTile(snapshotAgedBy(60, override), NOW).state, "missing", name);
  }
});

test("A FUTURE TIMESTAMP IS REFUSED, not clamped to zero", () => {
  // It means the writer's clock or the shape is wrong, and neither is a state
  // to render a green tile from. Clamping would show it as freshest of all.
  assert.equal(healthTile(snapshotAgedBy(-60), NOW).state, "missing");
});

test("the discriminating control: the same snapshot at two ages disagrees", () => {
  const fresh = healthTile(snapshotAgedBy(60), NOW);
  const stale = healthTile(snapshotAgedBy(60 * 60 * 24), NOW);
  assert.equal(fresh.state, "fresh");
  assert.equal(stale.state, "stale");
  assert.notEqual(fresh.state, stale.state);
});

test("formatAge never claims a precision the fifteen minute schedule lacks", () => {
  assert.equal(formatAge(0), "under a minute ago");
  assert.equal(formatAge(59), "under a minute ago");
  assert.equal(formatAge(60), "1 minute ago");
  assert.equal(formatAge(119), "1 minute ago");
  assert.equal(formatAge(120), "2 minutes ago");
  assert.equal(formatAge(3599), "59 minutes ago");
  assert.equal(formatAge(3600), "1 hour ago");
  assert.equal(formatAge(7200), "2 hours ago");
  assert.equal(formatAge(86400), "1 day ago");
  assert.equal(formatAge(86400 * 3), "3 days ago");
});

test("snapshotFromBody counts what the endpoint answered with, not a HealthRun", () => {
  const body = {
    ok: false,
    checks: [
      { name: "a", ok: true },
      { name: "b", ok: false },
      { name: "c", ok: true },
      { name: "d", ok: false },
    ],
  };
  const snapshot = snapshotFromBody(body, "2026-08-26T14:00:00.000Z");
  assert.deepEqual(snapshot, {
    ok: false,
    total: 4,
    failed: 2,
    readAt: "2026-08-26T14:00:00.000Z",
  });
});

test("body to snapshot to tile round trips the counts the page renders", () => {
  const body = { ok: true, checks: [{ ok: true }, { ok: true }, { ok: true }] };
  const tile = healthTile(snapshotFromBody(body, new Date(NOW - 30_000).toISOString()), NOW);
  assert.equal(tile.state, "fresh");
  assert.equal(tile.total, 3);
  assert.equal(tile.failed, 0);
  assert.equal(`${tile.total - tile.failed}/${tile.total}`, "3/3");
});
