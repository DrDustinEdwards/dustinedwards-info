/**
 * The secrets audit's two properties, both of which are security properties.
 *
 * WHY THIS IS A BEHAVIOURAL TEST AND NOT A SOURCE SCAN. "Reports presence
 * honestly" and "leaks nothing" are claims about what the function RETURNS. A
 * regex over the source can see that no `value` key is written today; it cannot
 * see a leak arriving through a spread, a rename, a debug field, or a helper
 * that starts returning more than it did. Calling it with a known env and
 * inspecting the result catches all of those.
 *
 * The audit reads `env[name]` and nothing else, so it runs under `node:test`
 * with a plain object standing in for the bindings. That is the same reason
 * `upload-contract.mjs` is a plain module: no bundler, no Worker.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { REQUIRED_SECRETS } from "../app/lib/secrets.mjs";

/*
 * The audit is TypeScript, so it cannot be imported here directly. Its body is
 * four lines and reimplementing it would be a mirror that passes while the real
 * one leaks, which is the anti-pattern this repo keeps converting into one
 * module with several readers.
 *
 * So the test drives the SHIPPED function, compiled on the fly. `node:test`
 * runs with `--experimental-strip-types` in this repo's check:tests script;
 * where that is unavailable the import throws and the test FAILS rather than
 * skipping, because a security assertion that silently does not run is worse
 * than one that is absent.
 */
const { auditSecrets } = await import("../app/lib/admin/secrets.server.ts");

/**
 * A stand-in value chosen so it CANNOT COLLIDE with the payload's own words.
 *
 * The first version read "QQQZZZ-sentinel-value-must-never-be-returned-…" and
 * the sliding-window check below failed on the run "sent", which is a substring
 * of the legitimate field name `present`. An unanchored needle matching the
 * scaffolding rather than the secret is this repo's most repeated gate defect,
 * and it fired here on the first run.
 *
 * Z and digits only. No ratified secret name contains either, and neither do
 * `name`, `present`, `true` or `false`, so no window can match the structure.
 * The collision guard below asserts that property instead of assuming it.
 */
const SENTINEL = "ZZZZ" + "9174630852".repeat(4);

test("the ratified list is non-empty, so nothing below passes vacuously", () => {
  assert.ok(REQUIRED_SECRETS.length >= 8, `only ${REQUIRED_SECRETS.length} secret(s) listed`);
});

test("the sentinel cannot collide with the payload's own structure", () => {
  /*
   * THE GUARD ON THE INSTRUMENT. Audit an env with every secret ABSENT, which
   * produces the scaffolding (field names, the secret names, false) and no
   * value at all. If any window of the sentinel appears in THAT, the leak test
   * below would fail on the structure rather than on a leak, and would read as
   * a security finding when it is a bad needle.
   */
  const scaffolding = JSON.stringify(auditSecrets({}));
  for (let i = 0; i + 4 <= SENTINEL.length; i += 1) {
    const window = SENTINEL.slice(i, i + 4);
    assert.ok(
      !scaffolding.includes(window),
      `the sentinel shares the run "${window}" with the payload structure, so the ` +
        `leak assertion below would fire on a collision rather than on a leak`,
    );
  }
});

test("a secret that is set reports present", () => {
  const env = Object.fromEntries(REQUIRED_SECRETS.map((n) => [n, SENTINEL]));
  const rows = auditSecrets(env);
  assert.equal(rows.length, REQUIRED_SECRETS.length);
  assert.ok(rows.every((r) => r.present === true), "a set secret reported absent");
});

test("a MISSING secret cannot report present", () => {
  // Every secret set except one. This is the plant the audit exists to fail.
  for (const missing of REQUIRED_SECRETS) {
    const env = Object.fromEntries(
      REQUIRED_SECRETS.filter((n) => n !== missing).map((n) => [n, SENTINEL]),
    );
    const rows = auditSecrets(env);
    const row = rows.find((r) => r.name === missing);
    assert.ok(row, `${missing} vanished from the result instead of reporting absent`);
    assert.equal(row.present, false, `${missing} is unset and the audit reported it present`);
  }
});

test("an EMPTY secret is absence, not presence", () => {
  const env = Object.fromEntries(REQUIRED_SECRETS.map((n) => [n, ""]));
  assert.ok(
    auditSecrets(env).every((r) => r.present === false),
    "an empty string reported present, which is absence wearing the type of presence",
  );
});

test("the result carries EXACTLY name and present, and nothing else", () => {
  const env = Object.fromEntries(REQUIRED_SECRETS.map((n) => [n, SENTINEL]));
  for (const row of auditSecrets(env)) {
    assert.deepEqual(
      Object.keys(row).sort(),
      ["name", "present"],
      `extra key on ${row.name}: any field beyond these two is a channel for a value, ` +
        `a prefix or a length`,
    );
    assert.equal(typeof row.present, "boolean", "present must be a boolean, not a value");
    assert.equal(typeof row.name, "string");
  }
});

test("NO VALUE, NO PARTIAL VALUE, NO LENGTH reaches the result", () => {
  const env = Object.fromEntries(REQUIRED_SECRETS.map((n) => [n, SENTINEL]));
  const serialised = JSON.stringify(auditSecrets(env));

  assert.ok(!serialised.includes(SENTINEL), "the whole value was returned");

  /*
   * PARTIALS, by sliding window. A masked or truncated value would not match
   * the whole sentinel, so the whole-string check above would pass it. Four
   * characters is short enough to catch a "first 4 then dots" mask and long
   * enough not to collide with the field names.
   */
  for (let i = 0; i + 4 <= SENTINEL.length; i += 1) {
    const window = SENTINEL.slice(i, i + 4);
    assert.ok(
      !serialised.includes(window),
      `a ${window.length}-character run of the value ("${window}") reached the result`,
    );
  }

  /*
   * LENGTH. Asserted structurally rather than by hunting for the number: the
   * key check above already forbids any field other than name and present, and
   * a length has nowhere else to travel. Searching the payload for "56" would
   * be the fuzzy version and would collide with anything.
   */
  assert.ok(
    !serialised.includes(String(SENTINEL.length)),
    "the value's length appears in the result",
  );
});
