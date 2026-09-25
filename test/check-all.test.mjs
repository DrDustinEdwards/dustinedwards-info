// check:changed imports check-all for its tables, so importing it must do nothing but define them.

import test from "node:test";
import assert from "node:assert/strict";

import { WINDOWS_CRASH_CODES } from "../scripts/lib/tier-outcome.mjs";

test("importing check-all with --all on the command line does not set SCHEMA_LIVE", async () => {
  const before = process.env.SCHEMA_LIVE;
  delete process.env.SCHEMA_LIVE;
  process.argv.push("--all");
  try {
    await import("../scripts/check-all.mjs");
    assert.equal(process.env.SCHEMA_LIVE, undefined, "only running the tier may point the schema test at production");
  } finally {
    process.argv.pop();
    if (before === undefined) delete process.env.SCHEMA_LIVE;
    else process.env.SCHEMA_LIVE = before;
  }
});

test("check-all names every crash code ship's verdict names, from the same table", async () => {
  const { ntstatusName } = await import("../scripts/check-all.mjs");
  for (const [code, name] of WINDOWS_CRASH_CODES) {
    assert.match(ntstatusName(code), new RegExp(name));
  }
  assert.equal(ntstatusName(0xc0000374), "0xC0000374 STATUS_HEAP_CORRUPTION");
  assert.equal(ntstatusName(0xc0000001), "0xC0000001", "an unnamed code is still printed, unnamed");
});
