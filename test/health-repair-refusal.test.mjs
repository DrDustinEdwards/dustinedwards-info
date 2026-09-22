/**
 * A CONTENT REFUSAL IS NOT A DRIFT, and the repair loop has to say which it got.
 *
 * The defect this replays, measured 2026-09-09: `585b32f` added the `:swatch`
 * directive to the pipeline and used it in two posts, and was committed without
 * being deployed. `content-drift` correctly reported `expected 16, present 14`,
 * and the self-repair fetched those two files and re-rendered them through the
 * DEPLOYED pipeline, which did not know `:swatch` and refused. The operator API
 * answered 422, which is `EditorError`: nothing happened, correct the request.
 *
 * Two things were wrong with what the workflow did next, and both are asserted
 * here rather than described:
 *
 *   - **The server's own sentence was thrown away.** `repair()` had already
 *     parsed the body and then reported `sync_posts answered 422`, so the run
 *     log named a status code and not the unknown directive or its line. Every
 *     reader after that inherits the status code.
 *   - **The rest of the plan ran anyway.** `sync_ask` reads `search_docs`,
 *     which `sync_posts` had just failed to rewrite, so the next call uploads a
 *     corpus already known to be stale. `REPAIRABLE`'s own ordering comment
 *     says content must land before the Ask upload; that argument applies
 *     harder when the content repair REFUSED.
 *
 * A 422 cannot be repaired by repeating it. The repair for a corpus ahead of
 * the deployed renderer is a deploy, and the alert has to say so, because a
 * fifteen minute cadence repeating "answered 422" is how a monitor stops being
 * read.
 *
 * The stub answers the shape `app/routes/api.operator.ts` really sends on a
 * refusal, `{ ok, error, detail }` at the top level, so a change to that shape
 * fails here rather than silently passing.
 *
 * @see scripts/health-repair.mjs
 * @see app/lib/health/repair.mjs
 * @see test/health-repair.test.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { refusalMiss } from "../app/lib/health/repair.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/health-repair.mjs", import.meta.url));

/**
 * The refusal the operator API really sends: `EditorError` becomes 422 with the
 * gate's message and its line (`app/lib/operator/api.server.ts`, the
 * `EditorError` branch), serialized by `api.operator.ts` as `{ ok, error,
 * detail }`.
 */
const REFUSAL = {
  ok: false,
  error:
    'unknown directive ":swatch" on line 12. Known directives: chart, diagram, figure, footnote. ' +
    "If this is ordinary prose, escape the colon or wrap it in a code span.",
  detail: { field: null, line: 12 },
};

/** An operator stub that refuses every tool and records which were called. */
function refusingOperator() {
  const calls = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      if ((request.url ?? "").startsWith("/api/operator")) {
        let tool = "";
        try {
          tool = JSON.parse(body || "{}").tool ?? "";
        } catch {
          tool = "";
        }
        calls.push(tool);
        response.writeHead(422, { "content-type": "application/json" });
        response.end(JSON.stringify(REFUSAL));
        return;
      }
      // The re-poll, which this case must never reach.
      calls.push("health");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, checks: [] }));
    });
  });
  return { server, calls };
}

/** Runs the script as the workflow runs it and captures both streams. */
function runScript(origin, bodyPath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, "--origin", origin, "--body", bodyPath], {
      env: { ...process.env, OPERATOR_TOKEN: "test-token" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("a 422 names the server's reason, abandons the plan, and still alerts", async () => {
  const { server, calls } = refusingOperator();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const bodyPath = join(mkdtempSync(join(tmpdir(), "health-repair-")), "body.json");
  writeFileSync(
    bodyPath,
    JSON.stringify({
      ok: false,
      checks: [
        { name: "content-drift", ok: false, expected: 16, present: 14 },
        { name: "ask-index-drift", ok: false },
      ],
    }),
  );

  const result = await runScript(origin, bodyPath);
  await new Promise((resolve) => server.close(resolve));

  const log = `${result.stdout}${result.stderr}`;

  // A refusal is still a broken site: somebody has to look at it.
  assert.equal(result.code, 1, "a content refusal still fails the run");

  // (1) The server's own sentence, which is the whole diagnosis.
  assert.match(log, /unknown directive/, "the gate's message reaches the log");
  assert.match(log, /line 12/, "the gate's line reaches the log");

  // (2) The plan stops. sync_ask reads what sync_posts just failed to write.
  assert.deepEqual(
    calls,
    ["sync_posts"],
    "no further repair runs after an unrepairable refusal, and the re-poll is not reached",
  );

  // The alert names the repair that would actually work.
  assert.match(log, /deploy/i, "the annotation names a deploy as the repair");
});

/*
 * THE CLASSIFICATION ITSELF, and the guard that keeps both callers on it.
 *
 * The test above drives the script end to end, which is the behavior that
 * matters. These cover the half the WATCHDOG runs: it makes the identical
 * operator call on a fifteen minute cron and had its own copy of this logic,
 * so a fix planted only through the script would have left the more frequent
 * caller reporting a bare status code.
 */

test("refusalMiss carries the server's sentence and marks 422 unrepairable", () => {
  const refused = refusalMiss("sync_posts", 422, REFUSAL);
  assert.match(refused.miss, /unknown directive/, "the gate's message survives");
  assert.match(refused.miss, /line 12/, "the line survives");
  assert.equal(refused.unrepairable, true, "422 cannot be repaired by repeating it");

  // Every other status is a failure the next poll may legitimately retry.
  for (const status of [500, 502, 409, 0]) {
    assert.equal(
      refusalMiss("sync_posts", status, { error: "upstream fell over" }).unrepairable,
      false,
      `${status} stays retryable`,
    );
  }

  // A body that carried nothing still names the tool and the status.
  assert.equal(refusalMiss("sync_ask", 500, null).miss, "sync_ask answered 500");
});

test("both repair callers use the shared classification, not their own copy", () => {
  const callers = ["scripts/health-repair.mjs", "workers/watchdog.ts"];

  for (const path of callers) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

    // Scope proof: a path that stopped existing would read as empty and pass.
    assert.ok(source.length > 500, `${path} was read and is non-empty`);
    assert.match(source, /refusalMiss/, `${path} imports and uses the shared classification`);

    /*
     * The defect's exact shape: building the miss string from the status alone.
     * Matching the SHAPE rather than the old spelling, so a third caller
     * reintroducing it in its own words is caught too.
     */
    assert.doesNotMatch(
      source,
      /answered \$\{(?:response\.)?status\}`/,
      `${path} does not rebuild the status-only miss string`,
    );
  }
});
