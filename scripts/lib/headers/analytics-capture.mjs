// The analytics capture in workers/app.ts: the operator excluded, HTML 200s only, and the preview
// token redacted from every slot of the data point.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { stripComments } from "../strip-comments.mjs";
import { ok, root } from "./gate.mjs";

/** @param {string} code workers/app.ts with its comments stripped */
export function run(code) {
  /*
   * A LIVE MEASUREMENT IS NOT A GATE: dropping the /admin skip would leave every gate green while
   * the operator's own views flowed into the panel that exists to exclude them.
   */

  console.log("\n  the analytics capture");

  const capture = code.match(/function\s+recordTraffic[\s\S]*?\n\}/);
  ok(
    "workers/app.ts declares a recordTraffic capture",
    Boolean(capture),
    "not found after stripping comments. Without it nothing below examines anything.",
  );

  const captureBody = capture ? capture[0] : "";

  ok(
    "the capture body is not empty",
    captureBody.length > 200,
    `parsed ${captureBody.length} characters, so every assertion below would be vacuous`,
  );

  const adminRule =
    stripComments(readFileSync(join(root, "workers", "csp.mjs"), "utf8")).match(
      /function\s+isAdminPath[\s\S]*?\n\}/,
    )?.[0] ?? "";
  ok(
    "the capture excludes the /admin plane",
    /isAdminPath\(\s*url\.pathname\s*\)/.test(captureBody) &&
      /pathname\s*===\s*"\/admin"/.test(adminRule) &&
      /pathname\.startsWith\(\s*"\/admin\/"\s*\)/.test(adminRule),
    "THE OPERATOR IS NOT AN AUDIENCE. Both forms are needed: the bare /admin and " +
      "the subtree. A panel that counts its own author is worse than no panel.",
  );
  ok(
    "the capture records HTML responses only",
    /text\/html/.test(captureBody),
    "assets, feeds, markdown twins, /media and the API routes are traffic and none " +
      "of them is a page view",
  );
  ok(
    "the capture records 200s only",
    /status\s*!==\s*200/.test(captureBody),
    "errors and redirects are not reads",
  );
  ok(
    "the referer is reduced to a hostname before it is stored",
    /\.hostname/.test(captureBody),
    "a full referer URL carries paths and query strings from other people's sites",
  );

  /*
   * THE REDACTION IS AN ACCESS CONTROL: /preview/<token> carries a capability in its PATH. BOTH
   * SLOTS separately, and the ABSENCE of the raw expression, or a capture computes the safe path
   * and writes the raw one anyway.
   */
  ok(
    "the capture imports the analyticsPath redaction",
    /\banalyticsPath\b/.test(code.split("function recordTraffic")[0] ?? ""),
    "the helper must be imported at module scope; a local copy would drift from " +
      "the unit-tested rule in app/lib/analytics-path.mjs",
  );
  ok(
    "the capture computes a redacted path",
    /=\s*analyticsPath\(\s*url\.pathname\s*\)/.test(captureBody),
    "the preview token must be stripped before anything is written",
  );

  const writeCall = captureBody.match(/writeDataPoint\(\{[\s\S]*?\}\)/);
  ok(
    "the capture calls writeDataPoint",
    Boolean(writeCall),
    "not found, so the two slot assertions below would be vacuous",
  );

  const writeBody = writeCall ? writeCall[0] : "";
  ok(
    "blobs carries the redacted path, not url.pathname",
    /blobs:\s*\[\s*path\b/.test(writeBody) && !/blobs:\s*\[\s*url\.pathname/.test(writeBody),
    `blobs is ${JSON.stringify(writeBody.match(/blobs:\s*\[[^\]]*\]/)?.[0] ?? "(unparsed)")}. ` +
      `A preview URL carries a capability in its path.`,
  );
  ok(
    "indexes carries the redacted path, not url.pathname",
    /indexes:\s*\[\s*path\s*\]/.test(writeBody) && !/indexes:\s*\[\s*url\.pathname/.test(writeBody),
    `indexes is ${JSON.stringify(writeBody.match(/indexes:\s*\[[^\]]*\]/)?.[0] ?? "(unparsed)")}. ` +
      `This is the SAMPLING KEY, and it is the slot most easily left behind.`,
  );
  ok(
    "url.pathname is not written into the data point at all",
    writeBody.length > 0 && !/url\.pathname/.test(writeBody),
    "the raw pathname must not appear inside writeDataPoint in any slot. Computing " +
      "a redacted path and then writing the raw one is the shape this catches.",
  );

  console.log(
    `     ${[...captureBody.matchAll(/\breturn;/g)].length} exclusion(s), path redacted in ${
      [...writeBody.matchAll(/\bpath\b/g)].length
    } slot(s)`,
  );
}
