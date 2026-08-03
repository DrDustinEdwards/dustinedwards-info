/**
 * Gate over the URL protocol allowlist.
 *
 * OBSERVATION BOUNDARY: the allowlist predicate over crafted inputs. It never
 * fetches a URL and never scans the live corpus, so it proves the rule and not
 * that every published href obeys it.
 *
 *   npm run check:urls
 *
 * Ruling: dustinedwards/url-protocol-allowlist.md, 2026-08-01. The finding it
 * exists for: `[x](javascript:alert(1))` rendered as a LIVE href and reached
 * the stored HTML, the gated artifact, D1 and the published page. The operator
 * API writes posts, so it was agent-reachable on a public surface with no human
 * click in the path.
 *
 * This imports `app/lib/content/pipeline.mjs`, the module the Worker imports,
 * on the same principle as check:search and check:policy. Testing a copy of the
 * rule would prove the copy correct and say nothing about what ships.
 *
 * Two levels, deliberately:
 *
 *   The PREDICATE, `isAllowedUrl`, tested directly. Fast, and it can express
 *   obfuscations that markdown would percent-encode before the renderer ever
 *   saw them, which is the only way to check the figure directive's raw path.
 *
 *   The RENDERER, end to end. The predicate being right is worth nothing if the
 *   plugin is not wired in, or is wired in before the plugin that emits the
 *   href. Every case is rendered and the markup is read back.
 *
 * FAILS CLOSED. A missing fixture is an error, never an empty pass, and every
 * comparison is paired with a count so "0 failures" cannot mean "0 cases read".
 *
 * The javascript entries in the fixture are PERMANENT NEGATIVES. They are not
 * examples; they are the regression this gate exists to prevent, and removing
 * one is removing the gate.
 *
 * Pure: no database, no network, no build.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isAllowedUrl, renderBody } from "../app/lib/content/pipeline.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(root, "scripts", "fixtures", "url-protocol-cases.json");

console.log("\ncheck:urls\n");

// Fail closed. A gate whose expectation is missing must block and say so.
if (!existsSync(FIXTURE)) {
  console.log("  FAIL  fixture is missing: scripts/fixtures/url-protocol-cases.json");
  console.log("        This gate cannot pass without it. Restore it from git.\n");
  process.exit(1);
}

/**
 * @type {{
 *   cases: Array<{ label: string, markdown: string, expect: "allowed" | "blocked", url?: string }>,
 *   predicateCases: Array<{ url: string, allowed: boolean }>,
 *   obfuscationCases: Array<{ label: string, codes: number[], allowed: boolean }>,
 * }}
 */
const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));

let checks = 0;
let failures = 0;
/** @param {string} label @param {boolean} ok @param {string} [detail] */
function assert(label, ok, detail = "") {
  checks += 1;
  if (!ok) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

/* -------------------------------------------------------------------------
 * The predicate
 * ---------------------------------------------------------------------- */

for (const probe of fixture.predicateCases) {
  assert(
    `predicate: ${JSON.stringify(probe.url)} is ${probe.allowed ? "allowed" : "blocked"}`,
    isAllowedUrl(probe.url) === probe.allowed,
  );
}

/**
 * Obfuscations are built from CODE POINTS rather than written as escapes.
 *
 * The source file then contains no control characters at all, which matters
 * more than it sounds: writing them literally corrupted pipeline.mjs into a
 * binary file three times while this was being built, and an escape sequence in
 * a JSON fixture would have been decoded by whichever tool wrote the file.
 */
for (const probe of fixture.obfuscationCases) {
  const url = probe.codes.map((code) => String.fromCodePoint(code)).join("");
  assert(
    `obfuscation: ${probe.label} is ${probe.allowed ? "allowed" : "blocked"}`,
    isAllowedUrl(url) === probe.allowed,
  );
}

/* -------------------------------------------------------------------------
 * The renderer, end to end
 * ---------------------------------------------------------------------- */

/** Images are measured without touching R2; dimensions are not what is tested. */
const resolveImage = async () => ({ width: 8, height: 8 });

let blockedSeen = 0;
let allowedSeen = 0;

for (const probe of fixture.cases) {
  let html = "";
  /** @type {Array<{ url: string }>} */
  let blocked = [];
  try {
    const out = await renderBody({ file: "gate.md", body: probe.markdown, resolveImage });
    html = out.html;
    blocked = out.blockedUrls;
  } catch (error) {
    assert(`render: ${probe.label}`, false, error instanceof Error ? error.message : String(error));
    continue;
  }

  const urls = [...html.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1]);

  if (probe.expect === "allowed") {
    allowedSeen += 1;
    assert(
      `render: ${probe.label} keeps its url`,
      urls.includes(probe.url ?? ""),
      `expected ${JSON.stringify(probe.url)}, got ${JSON.stringify(urls)}`,
    );
    assert(`render: ${probe.label} reports nothing blocked`, blocked.length === 0);
  } else {
    blockedSeen += 1;
    // The url must not survive in ANY attribute, which is stronger than
    // "the href is empty": an emptied href still reads as a working link.
    assert(
      `render: ${probe.label} emits no url attribute`,
      urls.length === 0,
      `got ${JSON.stringify(urls)}`,
    );
    // Ruling point 2: visible, not silent. The markdown has to come back as
    // text carrying the offending url, so the author can see what happened.
    assert(
      `render: ${probe.label} renders the source as visible text`,
      html.includes("]("),
      `markup was ${JSON.stringify(html.slice(0, 120))}`,
    );
    assert(`render: ${probe.label} is reported to the caller`, blocked.length > 0);
  }
}

/* -------------------------------------------------------------------------
 * Counts, so a green run cannot mean an empty one
 * ---------------------------------------------------------------------- */

assert(
  "the fixture still carries its permanent negatives",
  fixture.cases.filter((c) => c.label.startsWith("PERMANENT NEGATIVE")).length >= 6,
  `${fixture.cases.filter((c) => c.label.startsWith("PERMANENT NEGATIVE")).length} found, expected at least 6`,
);
assert("blocked cases were actually rendered", blockedSeen >= 8, `${blockedSeen}`);
assert("allowed cases were actually rendered", allowedSeen >= 8, `${allowedSeen}`);
assert("the predicate was actually exercised", fixture.predicateCases.length >= 10);
assert("the obfuscations were actually exercised", fixture.obfuscationCases.length >= 5);

console.log(
  `  ${fixture.cases.length} rendered case(s), ` +
    `${fixture.predicateCases.length} predicate case(s), ` +
    `${fixture.obfuscationCases.length} obfuscation(s)`,
);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
