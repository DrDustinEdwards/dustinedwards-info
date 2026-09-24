/**
 * `retryRead()`, replaying the two symptoms it was written for.
 *
 * The replay rule: a new mechanism is tested by REPLAYING THE DEFECT, not only by
 * planted variants. The class is five measured transient failures on Cloudflare
 * read paths across four gates, wearing TWO OPPOSITE SYMPTOMS:
 *
 *   FAST DEATH  check:backup's remote sqlite_master read died in seconds with
 *               SQLITE_CANTOPEN; check:llms and check:invariants died with
 *               Cloudflare error 10000. All clean on an immediate retry.
 *   HANG        check:media's R2 list returned a 400 with no CF-R2-Error
 *               header and never settled, taking check:all past a ten minute
 *               timeout against a 116-160s norm. Clean on retry at 27s.
 *
 * A wrapper that caught only the rejection would leave the worst-behaved
 * instance untouched, so the timeout arm is replayed here as its own case.
 *
 * The third property is the one with a real incident behind it: on 2026-08-09 a
 * run reported "17 passed, 1 failed" and the failing gate NAME was never
 * captured, so the instance is recorded in core.md as undiagnosed. A silent
 * retry converts a diagnosable transient into an invisible one. The label and
 * the first error MUST reach stderr before the second attempt.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { retryRead } from "../scripts/lib/retry.mjs";

/** Captures stderr for the duration of `fn`. */
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
        // The R2 incident HUNG rather than failing. Catching only rejections
        // would leave exactly this instance untouched.
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
  // spawnSync returns rather than rejecting, so every wrangler call site raises
  // its own non-zero status. This asserts the wrapper does not require a
  // promise; the raising is the call site's job and is checked in the gates.
  const { value } = await capturingStderr(() =>
    retryRead(() => ({ status: 0, stdout: "[]" }), { label: "sync" }),
  );
  assert.deepEqual(value, { status: 0, stdout: "[]" });
});
