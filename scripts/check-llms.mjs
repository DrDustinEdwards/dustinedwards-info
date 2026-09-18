/**
 * Gate: `content/llms.txt` is the source of truth for the `llms.txt` settings row.
 *
 *   npm run check:llms                 pure checks only
 *   npm run check:llms -- --local      also compare against the local D1 row
 *   npm run check:llms -- --remote     also compare against the remote D1 row
 *
 * BOUNDARY: it compares the committed file against the row it seeds and against the route that
 * serves it, but it does not fetch `/llms.txt`, so it cannot see the route failing to serve what
 * the row holds.
 */

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { retryRead } from "./lib/retry.mjs";
import { createHash } from "node:crypto";
import { assertFloor } from "./lib/floor.mjs";

const LLMS_PATH = "content/llms.txt";
const ROUTE_PATH = "app/routes/llms.ts";
import { resolveD1Address } from "./lib/d1-address.mjs";

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

// Read as BYTES and decode explicitly: this file is compared byte for byte and the platform text
// layer is not UTF-8 on this host.
const fileBytes = readFileSync(LLMS_PATH);
const fileText = fileBytes.toString("utf8");

// 1. the file itself

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

// 2. the route does not keep its own copy

const route = readFileSync(ROUTE_PATH, "utf8");
assertThat(
  /import\s+\w+\s+from\s+["']\.\.\/\.\.\/content\/llms\.txt\?raw["']/.test(route),
  "the route imports content/llms.txt",
  "Without the import the fallback is a second copy that will drift.",
);
// The specific shape that rotted: a multi-line template literal holding the document. One line is
// fine; sixty is the bug.
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

// 3. the D1 row

const target = process.argv.includes("--remote")
  ? "--remote"
  : process.argv.includes("--local")
    ? "--local"
    : null;

if (target) {
  // RETRIED ONCE: remote D1 reads have failed transiently and been clean immediately after. Read
  // only.
  const result = await retryRead(
    () => {
      const r = spawnSync(
        `npx wrangler d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command ` +
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
/*
 * EXECUTED-COUNT FLOOR, MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, never summed.
 * Slack of ZERO, and the zero is the point: this gate is SMALL, so one skipped assertion is a
 * sixth of it and there is no natural movement to absorb. The remote tier only ADDS a comparison,
 * so a floor set on the offline figure holds for both.
 */
/*
 * THE CONTACT URL IS BOUND TO SITE_ORIGIN, in both directions. A tracked literal cannot import
 * anything, so its contact line was typed by hand and pointed the one machine-readable file whose
 * whole audience is crawlers at a host this site is not served from. The gate is the binding a
 * literal file cannot express, and at DNS cutover it goes red until llms.txt follows, which is the
 * point. The heading is deliberately NOT checked: it is the site's NAME, not a claim about where
 * anything is served from.
 */
{
  const seoSource = readFileSync("app/lib/seo.ts", "utf8");
  const origin = (seoSource.match(/export const SITE_ORIGIN = "([^"]+)"/) ?? [])[1] ?? "";

  assertThat(
    origin.startsWith("https://"),
    "SITE_ORIGIN was read out of seo.ts",
    `parsed ${JSON.stringify(origin)}; without it the comparison below is vacuous`,
  );

  const contact = (fileText.match(/## Contact\s*\n\s*\n(\S+)/) ?? [])[1] ?? "";
  assertThat(
    contact.startsWith("https://"),
    "llms.txt has a contact URL to compare",
    `parsed ${JSON.stringify(contact)} from the Contact section`,
  );
  assertThat(
    contact === origin,
    "the llms.txt contact URL is SITE_ORIGIN",
    `llms.txt says ${contact} and SITE_ORIGIN is ${origin}. The file crawlers read ` +
      `points somewhere this site is not served from.`,
  );
}

const MINIMUM_CHECKS = 9;
const floorBreach = assertFloor(
  "check:llms",
  /*
   * NAMED PER BRANCH even though one VALUE covers both, the offline figure being the stricter of
   * the two and kept for both: a single name would let whichever branch ran last be judged against
   * the other's reading.
   */
  target === "--remote" ? "checks-remote" : "checks-offline",
  checks,
  MINIMUM_CHECKS,
  "The offline branch is the smaller one; --remote adds the live comparison.",
);
if (floorBreach) assertThat(false, "this gate executed its assertions", floorBreach);

console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}\n`);
process.exit(failures > 0 ? 1 : 0);
