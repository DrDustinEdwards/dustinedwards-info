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

import { frontmatterSchema, isAllowedUrl, renderBody } from "../app/lib/content/pipeline.mjs";

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
 *   frontmatterCases: Array<{ label: string, field: string, value: string, expect: "allowed" | "blocked" }>,
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
      // SCOPED-BY: the whole fragment is the scope. The question is whether the blocked markdown survived as TEXT anywhere in the output, not where.
      html.includes("]("),
      `markup was ${JSON.stringify(html.slice(0, 120))}`,
    );
    assert(`render: ${probe.label} is reported to the caller`, blocked.length > 0);
  }
}

/* -------------------------------------------------------------------------
 * FRONTMATTER, which the render layer never sees
 *
 * `rehypeUrlProtocols` walks the hast tree `renderBody` produces. Frontmatter is
 * not in that tree, so the allowlist that closed the markdown XSS did not bind
 * the two frontmatter fields that reach a URL context. `further_reading[].url`
 * is rendered as a live public `<a href>` and was validated with `z.url()`,
 * which accepts `javascript:`, `data:`, `vbscript:` and `file:`. Findings B001
 * and B008.
 *
 * These bind the SCHEMA, because the schema is the only thing in that path.
 * Asserted against `frontmatterSchema` itself, the object both writers import,
 * so it cannot pass against a copy of the rule.
 * ---------------------------------------------------------------------- */

const FM_BASE = { title: "t", slug: "a-slug", date: "2026-01-01", description: "d" };

/** @param {string} field @param {string} value */
function frontmatterFor(field, value) {
  if (field === "further_reading") {
    return { ...FM_BASE, further_reading: [{ title: "x", url: value }] };
  }
  if (field === "cover") return { ...FM_BASE, cover: { src: value, alt: "a" } };
  throw new Error(`unknown frontmatter field in fixture: ${field}`);
}

let fmBlocked = 0;
let fmAllowed = 0;
for (const probe of fixture.frontmatterCases) {
  const result = frontmatterSchema.safeParse(frontmatterFor(probe.field, probe.value));
  if (probe.expect === "blocked") {
    fmBlocked += 1;
    assert(
      `frontmatter: ${probe.label} is REFUSED`,
      result.success === false,
      `the schema ACCEPTED ${JSON.stringify(probe.value)} for ${probe.field}`,
    );
  } else {
    fmAllowed += 1;
    assert(
      `frontmatter: ${probe.label} is accepted`,
      result.success === true,
      result.success
        ? ""
        : result.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "),
    );
  }
}

/* -------------------------------------------------------------------------
 * THE SHARED PREDICATE, asserted on the SOURCE
 *
 * Everything above tests BEHAVIOUR, and behaviour is not enough here. The rule
 * is not "these fields refuse bad protocols", it is "these fields call
 * `isAllowedUrl`, the same predicate the renderer uses, rather than
 * reimplementing the rule". Those come apart, and on 2026-08-07 they had:
 * `cover.src` was a site-absolute regex that blocked `javascript:` only as a
 * side effect of demanding a leading slash. Every behavioural case above was
 * green, because every fixture outcome the regex produces is the outcome the
 * predicate produces. A green gate, a correct outcome, and the wrong mechanism.
 *
 * That matters because the mechanism is what survives the next edit. Relax the
 * path rule for a legitimate reason and the protocol hole reopens silently,
 * with no fixture case failing. So the property is asserted directly, against
 * the source text, the way check:headers binds `workers/app.ts` to its
 * ratification rather than inferring it from a response.
 *
 * COMMENTS ARE STRIPPED FIRST. Both docblocks in `pipeline.mjs` discuss
 * `isAllowedUrl` in prose, one of them saying in so many words that it is the
 * same predicate called rather than reimplemented. A parser that read the prose
 * would find the claim instead of the code and pass on a field that does not
 * call it. That trap has already been hit by check:logo, check:contrast,
 * check:features and check:headers; it is the default failure here, not an edge
 * case. Only BLOCK comments are stripped: the line-comment form would truncate
 * the `//host` inside a message string, and the prose trap is entirely in the
 * docblocks.
 * ---------------------------------------------------------------------- */

const PIPELINE = join(root, "app", "lib", "content", "pipeline.mjs");
const pipelineSource = readFileSync(PIPELINE, "utf8");
const pipelineCode = pipelineSource.replace(/\/\*[\s\S]*?\*\//g, " ");

// Fail closed on the stripper itself. This phrase lives in the further_reading
// docblock, so if it survives, the strip did not run and every assertion below
// could be reading prose.
assert(
  "the comment stripper actually ran on pipeline.mjs",
  pipelineSource.includes("is the SAME predicate") && !pipelineCode.includes("is the SAME predicate"),
  "the docblock phrase is still present after stripping; the assertions below would read prose",
);

/** @type {Array<[string, string, RegExp]>} */
const SCHEMA_FIELDS = [
  ["cover.src", "cover", /cover:\s*z\s*\.object\(\s*\{([\s\S]*?)\}\s*\)/],
  [
    "further_reading[].url",
    "further_reading",
    /further_reading:\s*z\s*\.array\(([\s\S]*?)\)\s*\.default\(/,
  ],
];

for (const [label, , pattern] of SCHEMA_FIELDS) {
  const block = pipelineCode.match(pattern);
  // Fail closed: a block that stopped parsing must not pass as a block with no
  // problems in it.
  assert(
    `schema: the ${label} block was located in pipeline.mjs`,
    block !== null && block[1].trim().length > 0,
    "not found after stripping comments; the next assertion would examine nothing",
  );
  if (!block) continue;
  assert(
    `schema: ${label} calls isAllowedUrl, not a reimplementation`,
    /\.refine\(\s*isAllowedUrl\b/.test(block[1]),
    `the block validates the value without calling the shared predicate. ` +
      `A field that merely happens to refuse bad protocols is not this rule.`,
  );
}

// One definition, so "the same predicate" is a fact about the module and not
// two functions that agree today.
assert(
  "isAllowedUrl is defined exactly once in pipeline.mjs",
  [...pipelineCode.matchAll(/function\s+isAllowedUrl\s*\(/g)].length === 1,
  `found ${[...pipelineCode.matchAll(/function\s+isAllowedUrl\s*\(/g)].length} definitions`,
);

/* -------------------------------------------------------------------------
 * Counts, so a green run cannot mean an empty one
 * ---------------------------------------------------------------------- */

assert(
  "the frontmatter fixture still carries its permanent negatives",
  fixture.frontmatterCases.filter((c) => c.label.startsWith("PERMANENT NEGATIVE")).length >= 10,
  `${fixture.frontmatterCases.filter((c) => c.label.startsWith("PERMANENT NEGATIVE")).length} found`,
);
assert("frontmatter blocked cases were exercised", fmBlocked >= 10, `${fmBlocked}`);
assert("frontmatter allowed cases were exercised", fmAllowed >= 5, `${fmAllowed}`);
// BOTH fields, so a fixture that quietly lost one cannot pass.
for (const field of ["further_reading", "cover"]) {
  assert(
    `frontmatter: ${field} has both blocked and allowed coverage`,
    fixture.frontmatterCases.some((c) => c.field === field && c.expect === "blocked") &&
      fixture.frontmatterCases.some((c) => c.field === field && c.expect === "allowed"),
  );
}

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

/*
 * EXECUTED-COUNT FLOOR.
 *
 * Every case here comes from a committed fixture, which is exactly the shape
 * that fails quietly: a fixture that parsed to an empty list would run zero
 * cases and report a clean sweep of the protocol allowlist, which is hard rule
 * 6's enforcement.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 97.
 * Never summed. Floored at 92, roughly 5 percent: the count is a fixed function
 * of the fixture's case lists, so it moves only when a case is added.
 */
const MINIMUM_CHECKS = 92;
if (checks < MINIMUM_CHECKS) {
  assert(
    "this gate executed its assertions",
    false,
    `only ${checks} ran, expected at least ${MINIMUM_CHECKS}. A block was SKIPPED ` +
      `rather than failing. Measured: 97.`,
  );
}

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
