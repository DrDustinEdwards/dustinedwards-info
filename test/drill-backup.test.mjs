import assert from "node:assert/strict";
import { test } from "node:test";

import { runPrefixFor } from "../scripts/drill-backup.mjs";

await test("the run is found from health's last_ok the way d1-dump names it", () => {
  assert.equal(
    runPrefixFor({ last_ok: "2026-10-15T05:00:01.234Z", age_hours: 2 }),
    "backups/json/2026-10-15T05-00-01-234Z/",
  );
});

await test("a missing or stale dump is refused", () => {
  assert.throws(
    () => runPrefixFor({ last_ok: null, age_hours: null }),
    /no complete dump/,
  );
  assert.throws(() => runPrefixFor(undefined), /no complete dump/);
  assert.throws(
    () => runPrefixFor({ last_ok: "2026-10-13T05:00:00.000Z", age_hours: 48 }),
    /over 30/,
  );
});
