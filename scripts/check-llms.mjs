/**
 * Gate: `content/llms.txt` is the source of truth for the `llms.txt` settings
 * row, and nothing may drift from it.
 *
 * OBSERVATION BOUNDARY: compares the committed llms.txt against the settings row
 * it seeds. It does not fetch /llms.txt, so it cannot see the route failing to
 * serve what the row holds.
 *
 *   npm run check:llms                 pure checks only
 *   npm run check:llms -- --local      also compare against the local D1 row
 *   npm run check:llms -- --remote     also compare against the remote D1 row
 *
 * Why this exists. Before 2026-08-02 the live row was 2371 bytes of current copy
 * and the ONLY thing that ever wrote it was `0001_init.sql`, which seeds 247
 * bytes of the virology copy retired on 2026-07-27. Nothing re-seeded it, so a
 * rebuilt site would have served a stale, wrong llms.txt and nothing could have
 * noticed. Found while writing RECOVERY.md.
 *
 * The route carried a second copy too, a hand-maintained template literal under
 * a comment reading "If you change one, change the other". It had already
 * drifted: byte-identical to the row except for 62 CRs, because that .ts file is
 * CRLF on a Windows checkout and the row is LF. So the site served different
 * bytes depending on whether the row existed.
 *
 * Three things are asserted, and the first two are PURE so they run everywhere
 * and cannot be skipped:
 *
 *   1. the tracked file exists, is non-empty, and is LF-only
 *   2. the route does not carry its own copy: it imports the file
 *   3. with --local or --remote, the D1 row is byte-identical to the file
 *
 * FAILS CLOSED. A missing file, an unparseable query result or a wrangler
 * failure is a failure, never a skip.
 */

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { retryRead } from "./lib/retry.mjs";
import { createHash } from "node:crypto";

const LLMS_PATH = "content/llms.txt";
const ROUTE_PATH = "app/routes/llms.ts";
const DB_NAME = "dustinedwards";

let checks = 0;
let failures = 0;

/**
 * @param {boolean} ok
 * @param {string} label
 * @param {string} [detail]
 */
function assertThat(ok, label, detail) {
  checks += 1;
  if (ok) return;
  failures += 1;
  console.log(`\n  FAIL  ${label}`);
  if (detail) console.log(`        ${detail}`);
}

/** @param {Buffer} buf */
const sha = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 16);

console.log("\ncheck:llms\n");

if (!existsSync(LLMS_PATH)) {
  console.log(`\n  FAIL  ${LLMS_PATH} is missing. It is the source of the settings row.`);
  process.exit(1);
}

// Read as BYTES and decode explicitly. This file is compared byte for byte and
// the platform text layer is cp1252 on this host.
const fileBytes = readFileSync(LLMS_PATH);
const fileText = fileBytes.toString("utf8");

// ---- 1. the file itself -----------------------------------------------------

assertThat(fileBytes.length > 0, "content/llms.txt is not empty");
// An assertion that can pass by reading nothing is not an assertion.
assertThat(
  fileBytes.length > 200,
  "content/llms.txt is long enough to be the real document",
  `Only ${fileBytes.length} bytes. The retired virology seed was 247 bytes; the ` +
    `real document is far longer, so a short file here is the stale copy.`,
);
assertThat(
  !fileText.includes("\r"),
  "content/llms.txt is LF-only",
  "It is pinned to LF in .gitattributes. CR here would sync CRLF into D1.",
);
assertThat(fileText.endsWith("\n"), "content/llms.txt ends with a newline");

// ---- 2. the route does not keep its own copy --------------------------------

const route = readFileSync(ROUTE_PATH, "utf8");
assertThat(
  /import\s+\w+\s+from\s+["']\.\.\/\.\.\/content\/llms\.txt\?raw["']/.test(route),
  "the route imports content/llms.txt",
  "Without the import the fallback is a second copy that will drift.",
);
// The specific shape that rotted: a multi-line template literal holding the
// document. One line is fine (`const FALLBACK = llmsTxt;`); sixty is the bug.
const literals = route.match(/`[^`]*`/g) ?? [];
const longLiteral = literals.find((l) => l.split("\n").length > 5);
assertThat(
  longLiteral === undefined,
  "the route carries no inline copy of the document",
  longLiteral
    ? `Found a ${longLiteral.split("\n").length}-line template literal. That is the ` +
      `hand-maintained duplicate this gate exists to prevent.`
    : undefined,
);

// ---- 3. the D1 row ----------------------------------------------------------

const target = process.argv.includes("--remote")
  ? "--remote"
  : process.argv.includes("--local")
    ? "--local"
    : null;

if (target) {
  // RETRIED ONCE. Remote D1 reads have failed with Cloudflare error 10000
  // twice, both clean immediately after. Read only.
  const result = await retryRead(
    () => {
      const r = spawnSync(
        `npx wrangler d1 execute ${DB_NAME} ${target} --json --command ` +
          `"SELECT value FROM settings WHERE key = 'llms.txt'"`,
        { encoding: "utf8", shell: true },
      );
      if (r.status !== 0) throw new Error((r.stdout || r.stderr || "no output").slice(0, 200));
      return r;
    },
    { label: `check:llms settings row read (${target})` },
  );
  if (result.status !== 0) {
    console.log(`\n  FAIL  wrangler could not read the settings row (${target}).`);
    console.log(result.stdout ?? "");
    process.exit(1);
  }
  const match = result.stdout.match(/\[[\s\S]*\]/);
  if (!match) {
    console.log(`\n  FAIL  could not parse the query output.`);
    process.exit(1);
  }
  /** @type {any} */
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.log(`\n  FAIL  query output was not JSON: ${detail}`);
    process.exit(1);
  }
  const rows = parsed?.[0]?.results ?? [];
  assertThat(
    rows.length === 1,
    `the ${target.slice(2)} database has an llms.txt settings row`,
    `Found ${rows.length}. Run: npm run sync:content -- ${target}`,
  );
  if (rows.length === 1) {
    const rowBytes = Buffer.from(String(rows[0].value), "utf8");
    assertThat(
      Buffer.compare(rowBytes, fileBytes) === 0,
      `the ${target.slice(2)} row is byte-identical to ${LLMS_PATH}`,
      `file ${fileBytes.length} bytes sha ${sha(fileBytes)}, ` +
        `row ${rowBytes.length} bytes sha ${sha(rowBytes)}. ` +
        `Repair: npm run sync:content -- ${target}`,
    );
  }
  console.log(`  compared against the ${target.slice(2)} database`);
} else {
  console.log("  pure checks only. Pass --local or --remote to compare the D1 row.");
}

console.log(
  `  ${LLMS_PATH}: ${fileBytes.length} bytes, sha ${sha(fileBytes)}`,
);
console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}\n`);
process.exit(failures > 0 ? 1 : 0);
