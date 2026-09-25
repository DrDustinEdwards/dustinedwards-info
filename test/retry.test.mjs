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

test("a first-attempt success returns the value and does NOT retry", async () => {
  let calls = 0;
  const { value, lines } = await capturingStderr(() =>
    retryRead(
      () => {
        calls += 1;
        return "ok";
      },
      { label: "unused" },
    ),
  );
  assert.equal(value, "ok");
  assert.equal(calls, 1, "a healthy read must be attempted exactly once");
  assert.deepEqual(lines, [], "nothing is printed when nothing went wrong");
});

test("REPLAY fast death: one rejection, then the retry's value", async () => {
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

test("IT PRINTS BEFORE IT RETRIES: the label and the first error reach stderr", async () => {
  const { lines } = await capturingStderr(() => {
    let calls = 0;
    return retryRead(
      () => {
        calls += 1;
        if (calls === 1) throw new Error("SQLITE_CANTOPEN: unable to open database file");
        return "recovered";
      },
      { label: "check:backup sqlite_master read (--remote)" },
    );
  });
  const printed = lines.join("\n");
  assert.match(
    printed,
    /check:backup sqlite_master read \(--remote\)/,
    "the LABEL must be printed, or the transient is undiagnosable",
  );
  assert.match(printed, /SQLITE_CANTOPEN/, "the first error must be printed, not swallowed");
});

test("a SECOND failure propagates the original error unchanged", async () => {
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

test("REPLAY hang: a read that never settles becomes a rejection, and is retried", async () => {
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

test("a hang on BOTH attempts rejects, naming the timeout rather than hanging the gate", async () => {
  await capturingStderr(async () => {
    await assert.rejects(
      () => retryRead(() => new Promise(() => {}), { label: "permanent hang", timeoutMs: 30 }),
      /timed out after 30ms/,
    );
  });
});

test("a SYNCHRONOUS read is accepted, because the wrangler spawns are sync", async () => {
  // spawnSync returns rather than rejecting; raising on a non-zero status is each call site's job.
  const { value } = await capturingStderr(() =>
    retryRead(() => ({ status: 0, stdout: "[]" }), { label: "sync" }),
  );
  assert.deepEqual(value, { status: 0, stdout: "[]" });
});

test("THE PLANT: a hung child spawned synchronously fails at its bound instead of hanging", () => {
  const started = Date.now();
  const r = spawnSyncBounded(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { timeoutMs: 1000 });
  assert.ok(Date.now() - started < 30_000, "the bound fired, rather than the child's own minute");
  assert.equal(r.status, null, "a timeout is never a clean exit");
  assert.match(r.error, /timed out after 1000ms/);
});

test("a bounded spawn that finishes reports its status and output with no error", () => {
  const r = spawnSyncBounded(process.execPath, ["-e", "process.stdout.write('hi'); process.exit(3)"], {
    timeoutMs: 30_000,
  });
  assert.equal(r.status, 3);
  assert.equal(r.stdout, "hi");
  assert.equal(r.error, "");
});

test("a bounded spawn that cannot start says so, and has no status", () => {
  const r = spawnSyncBounded("definitely-not-a-command-ohnine", [], { timeoutMs: 5000 });
  assert.equal(r.status, null);
  assert.match(r.error, /could not run/);
});
