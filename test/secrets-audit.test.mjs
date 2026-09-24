/* Behavioural, not a source scan: a regex over the source cannot see a leak arriving through a
 * spread, a rename or a debug field, so the returned value is inspected. */

import test from "node:test";
import assert from "node:assert/strict";

import { REQUIRED_SECRETS } from "../app/lib/secrets.mjs";

/* The SHIPPED TypeScript is imported under strip-types, because a reimplementation would pass
 * while the real one leaks. Where that is unavailable the import throws and the test FAILS. */
const { auditSecrets } = await import("../app/lib/admin/secrets.server.ts");

/* Z and digits only, so no window of it can match the payload's own words ("sent" is inside
 * `present`). The collision guard below asserts that rather than assuming it. */
const SENTINEL = "ZZZZ" + "9174630852".repeat(4);

test("the ratified list is non-empty, so nothing below passes vacuously", () => {
  assert.ok(REQUIRED_SECRETS.length >= 8, `only ${REQUIRED_SECRETS.length} secret(s) listed`);
});

test("the sentinel cannot collide with the payload's own structure", () => {
  /* Audit with every secret ABSENT: if any window of the sentinel appears in that scaffolding,
   * the leak test would fail on a bad needle rather than on a leak. */
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

  /* A masked or truncated value would not match the whole sentinel. Four characters catches a
   * "first 4 then dots" mask and is long enough not to collide with the field names. */
  for (let i = 0; i + 4 <= SENTINEL.length; i += 1) {
    const window = SENTINEL.slice(i, i + 4);
    assert.ok(
      !serialised.includes(window),
      `a ${window.length}-character run of the value ("${window}") reached the result`,
    );
  }

  /* A length has nowhere to travel once the key check forbids every field but name and
   * present; searching the payload for "56" would collide with anything. */
  assert.ok(
    !serialised.includes(String(SENTINEL.length)),
    "the value's length appears in the result",
  );
});
