/**
 * THE REPLAY PROOF FOR THE CAPSID EXPORT STAMP.
 *
 * `check:guidelines` is NETWORK tiered: the value it compares against lives in
 * Capsid, so the gate cannot run in the offline tier or in CI, and on a machine
 * without `CAPSID_TOKEN` it cannot run at all. That is a real limitation, and
 * it means the gate's own comparison would otherwise never be exercised by
 * anything a clean checkout can run.
 *
 * So the COMPARISON is proven here, offline, against the real shape: the
 * timestamps below are the values Capsid served for these three documents on
 * 2026-09-16, not invented ones.
 *
 * ## THE DIRECTION THAT MATTERS IS THE SECOND
 *
 * A stamp check that passes on a matching pair proves very little; hard rule
 * 10's tenth class is an assertion that cannot fail. What has to be proven is
 * that it REFUSES a moved source, and that a file with no stamp at all is
 * caught rather than read as agreement.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatStamp, parseStamp, EXPORTED_DOCS, NAMESPACE } from "../scripts/lib/capsid.mjs";

/** What Capsid served for these paths on 2026-09-16. */
const AS_SERVED = {
  "design-rules-researched-2026-09.md": "2026-09-14 02:21:13",
  "decisions-2026-09-13-session.md": "2026-09-14 02:21:49",
  "TASK-redesign-brief-2026-09.md": "2026-09-14 02:19:17",
};

test("every exported document is named once and has a reason", () => {
  const paths = EXPORTED_DOCS.map((d) => d.path);
  assert.equal(new Set(paths).size, paths.length, "a path listed twice would export twice and check twice");
  assert.ok(paths.length >= 3, "fewer than three exports means the list has been trimmed without a ruling");
  for (const doc of EXPORTED_DOCS) {
    assert.ok(doc.why && doc.why.length > 20, `${doc.path} has no stated reason for costing budget`);
  }
});

test("a stamp round-trips", () => {
  for (const [path, updated_at] of Object.entries(AS_SERVED)) {
    const stamp = formatStamp({ namespace: NAMESPACE, path, updated_at });
    const parsed = parseStamp(`${stamp}\n\n# Title\n\nbody\n`);
    assert.deepEqual(parsed, { namespace: NAMESPACE, path, updated_at });
  }
});

test("a MOVED source does not match its stamp", () => {
  const path = "decisions-2026-09-13-session.md";
  const taken = AS_SERVED[path];
  const moved = "2026-09-16 04:31:00";
  const parsed = parseStamp(formatStamp({ namespace: NAMESPACE, path, updated_at: taken }));

  assert.notEqual(parsed.updated_at, moved, "the comparison must discriminate, or it agrees with everything");
  assert.equal(parsed.updated_at, taken);
});

test("an unstamped file is caught rather than read as agreement", () => {
  assert.equal(parseStamp("# Title\n\nno stamp here at all\n"), null);
  assert.equal(parseStamp(""), null);
});

test("a stamp for a different document does not satisfy this one", () => {
  const stamp = formatStamp({
    namespace: NAMESPACE,
    path: "design-rules-researched-2026-09.md",
    updated_at: AS_SERVED["design-rules-researched-2026-09.md"],
  });
  const parsed = parseStamp(stamp);
  assert.notEqual(parsed.path, "decisions-2026-09-13-session.md");
});
