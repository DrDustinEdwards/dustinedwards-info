import { readFileSync, existsSync } from "node:fs";
import { retryRead, spawnSyncBounded } from "../lib/retry.mjs";
import { createHash } from "node:crypto";
import { resolveD1Address } from "../lib/d1-address.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFloor } from "../lib/floor.mjs";

// Repo-relative names for messages; reads go through `fromRoot`, so the cwd does not matter.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fromRoot = (/** @type {string} */ repoPath) => join(ROOT, repoPath);
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

console.log("\n  llms.txt\n");

if (!existsSync(fromRoot(LLMS_PATH))) {
  console.log(`\n  FAIL  ${LLMS_PATH} is missing. It is the source of the settings row.`);
  throw new Error(`${LLMS_PATH} is missing`);
}

// Read as bytes and decode explicitly: the platform text layer is not UTF-8 on this host.
const fileBytes = readFileSync(fromRoot(LLMS_PATH));
const fileText = fileBytes.toString("utf8");

assertThat(fileBytes.length > 0, "content/llms.txt is not empty");
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

const route = readFileSync(fromRoot(ROUTE_PATH), "utf8");
assertThat(
  /import\s+\w+\s+from\s+["']\.\.\/\.\.\/content\/llms\.txt\?raw["']/.test(route),
  "the route imports content/llms.txt",
  "Without the import the fallback is a second copy that will drift.",
);
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

const target = process.argv.includes("--remote")
  ? "--remote"
  : process.argv.includes("--local")
    ? "--local"
    : null;

if (target) {
  const result = await retryRead(
    () => {
      // Bounded on the spawn: retryRead's timer cannot fire while spawnSync blocks the event loop.
      const r = spawnSyncBounded(
        `npx wrangler d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command ` +
          `"SELECT value FROM settings WHERE key = 'llms.txt'"`,
        [],
        { shell: true },
      );
      if (r.status !== 0) throw new Error(r.error || (r.stdout || r.stderr || "no output").slice(0, 200));
      return r;
    },
    { label: `check:machine-readable llms.txt settings row read (${target})` },
  );
  const match = result.stdout.match(/\[[\s\S]*\]/);
  if (!match) {
    console.log(`\n  FAIL  could not parse the query output.`);
    throw new Error("could not parse the llms.txt settings row query output");
  }
  /** @type {any} */
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.log(`\n  FAIL  query output was not JSON: ${detail}`);
    throw new Error(`the llms.txt settings row query output was not JSON: ${detail}`, { cause: error });
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

// A tracked text file cannot import SITE_ORIGIN, so this binds its contact line to it. At DNS
// cutover it goes red until llms.txt follows, which is the point.
{
  const seoSource = readFileSync(fromRoot("app/lib/seo.ts"), "utf8");
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

/* Measured 9 on the pure tier by running this part on 2026-09-24, floor a little under. --local and
   --remote add the D1 comparison on top, so the pure count bounds every mode. */
const floorBreach = assertFloor(
  "check:machine-readable/llms",
  "checks",
  checks,
  8,
  "The runner fails a part only on zero checks, so without this a refactor could drop " +
    "most of its sweeps and still pass.",
);
if (floorBreach) {
  failures += 1;
  console.log(`\n  FAIL  ${floorBreach}`);
}

export const outcome = { checks, failures };
