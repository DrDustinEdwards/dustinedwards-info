/* A 422 cannot be repaired by repeating it: a corpus ahead of the deployed renderer needs a
 * deploy, and the alert must say so. The stub answers the real `{ ok, error, detail }` refusal
 * shape, so a change to it fails here. */

import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { refusalMiss } from "../app/lib/health/repair.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/health-repair.mjs", import.meta.url));

const REFUSAL = {
  ok: false,
  error:
    'unknown directive ":swatch" on line 12. Known directives: chart, diagram, figure, footnote. ' +
    "If this is ordinary prose, escape the colon or wrap it in a code span.",
  detail: { field: null, line: 12 },
};

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

/* The watchdog makes the identical operator call on a fifteen minute cron, so the
 * classification is asserted for it directly too. */

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
