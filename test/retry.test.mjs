import test from "node:test";
import assert from "node:assert/strict";

import { retryRead, spawnSyncBounded } from "../scripts/lib/retry.mjs";

async function capturingStderr(fn) {
  const original = console.error;
  /** @type {string[]} */
  const lines = [];
  console.error = (...args) => lines.push(args.join(" "));
  try {
    return { value: await fn(), lines };
  } finally {
    console.error = original;
  }
}

await test("REPLAY fast death: one rejection, then the retry's value", async () => {
  let calls = 0;
  const { value } = await capturingStderr(() =>
    retryRead(
      () => {
        calls += 1;
        if (calls === 1) throw new Error("D1_ERROR: Error 10000");
        return { status: 0 };
      },
      { label: "check:llms settings row read (--remote)" },
    ),
  );
  assert.deepEqual(value, { status: 0 });
  assert.equal(calls, 2, "exactly one retry, never more");
});

await test("a SECOND failure propagates the original error unchanged", async () => {
  await capturingStderr(async () => {
    await assert.rejects(
      () =>
        retryRead(
          () => {
            throw new Error("R2 error response does not contain the CF-R2-Error header");
          },
          { label: "check:media R2 list (dustinedwards-media)" },
        ),
      /does not contain the CF-R2-Error header/,
      "the gate must fail exactly as it would have without the wrapper",
    );
  });
});

await test("REPLAY hang: a read that never settles becomes a rejection, and is retried", async () => {
  let calls = 0;
  const { value } = await capturingStderr(() =>
    retryRead(
      () => {
        calls += 1;
        if (calls === 1) return new Promise(() => {});
        return "recovered after the hang";
      },
      { label: "check:media R2 list (hang replay)", timeoutMs: 40 },
    ),
  );
  assert.equal(value, "recovered after the hang");
  assert.equal(calls, 2);
});

await test("a hang on BOTH attempts rejects, naming the timeout rather than hanging the gate", async () => {
  await capturingStderr(async () => {
    await assert.rejects(
      () => retryRead(() => new Promise(() => {}), { label: "permanent hang", timeoutMs: 30 }),
      /timed out after 30ms/,
    );
  });
});

await test("THE PLANT: a hung child spawned synchronously fails at its bound instead of hanging", () => {
  const started = Date.now();
  const r = spawnSyncBounded(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], {
    timeoutMs: 1000,
  });
  assert.ok(Date.now() - started < 30_000, "the bound fired, rather than the child's own minute");
  assert.equal(r.status, null, "a timeout is never a clean exit");
  assert.match(r.error, /timed out after 1000ms/);
});
