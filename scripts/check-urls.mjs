import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { frontmatterSchema, isAllowedUrl, renderBody } from "../app/lib/content/pipeline.mjs";
import { parseSource, ts } from "./lib/syntax.mjs";
import { createTally } from "./lib/tally.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(root, "scripts", "fixtures", "url-protocol-cases.json");

console.log("\ncheck:urls\n");

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

const tally = createTally();
const { ok: assert } = tally;

for (const probe of fixture.predicateCases) {
  assert(
    `predicate: ${JSON.stringify(probe.url)} is ${probe.allowed ? "allowed" : "blocked"}`,
    isAllowedUrl(probe.url) === probe.allowed,
  );
}

/** Built from code points: written literally, control characters corrupted this module into a binary file. */
for (const probe of fixture.obfuscationCases) {
  const url = probe.codes.map((code) => String.fromCodePoint(code)).join("");
  assert(
    `obfuscation: ${probe.label} is ${probe.allowed ? "allowed" : "blocked"}`,
    isAllowedUrl(url) === probe.allowed,
  );
}

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
    // Visible, not silent: the markdown comes back as text carrying the offending url, so the author sees it.
    assert(
      `render: ${probe.label} renders the source as visible text`,
      html.includes("]("),
      `markup was ${JSON.stringify(html.slice(0, 120))}`,
    );
    assert(`render: ${probe.label} is reported to the caller`, blocked.length > 0);
  }
}

// Frontmatter never reaches the render layer's plugin, so these bind the schema, asserted against the
// object both writers import.

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

// Behavior can pass while a field blocks a protocol only by accident, so the source must call the
// shared predicate. Read off the syntax tree: the old regexes ended a block at its first `})`, so a
// nested object cut the scan short, and prose could not be told from code without a stripper.

/** @param {ts.Node} root @param {(n: ts.Node) => boolean} test @returns {ts.Node[]} */
function findAll(root, test) {
  /** @type {ts.Node[]} */
  const out = [];
  /** @param {ts.Node} n */
  const visit = (n) => {
    if (test(n)) out.push(n);
    ts.forEachChild(n, visit);
  };
  visit(root);
  return out;
}

/** `.refine(isAllowedUrl, ...)` */
const refinesWithPredicate = (/** @type {ts.Node} */ n) =>
  ts.isCallExpression(n) &&
  ts.isPropertyAccessExpression(n.expression) &&
  n.expression.name.text === "refine" &&
  n.arguments.length > 0 &&
  ts.isIdentifier(n.arguments[0]) &&
  n.arguments[0].text === "isAllowedUrl";

const PIPELINE = join(root, "app", "lib", "content", "pipeline.mjs");
const pipelineTree = parseSource(PIPELINE, readFileSync(PIPELINE, "utf8"));

/** Schema properties by name: `name: z....`, the zod definition rather than any other use of the name. */
const SCHEMA_FIELDS = [
  ["cover.src", "cover"],
  ["further_reading[].url", "further_reading"],
];

for (const [label, property] of SCHEMA_FIELDS) {
  const blocks = findAll(
    pipelineTree,
    (n) =>
      ts.isPropertyAssignment(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === property &&
      /^z\s*\./.test(n.initializer.getText(pipelineTree)),
  );
  // Fail closed: a block that stopped parsing must not pass as a block with no problems in it.
  assert(
    `schema: the ${label} block was located in pipeline.mjs`,
    blocks.length === 1,
    `found ${blocks.length} zod definition(s) of ${property}; the next assertion needs exactly one`,
  );
  if (blocks.length !== 1) continue;
  assert(
    `schema: ${label} calls isAllowedUrl, not a reimplementation`,
    findAll(blocks[0], refinesWithPredicate).length > 0,
    `the block validates the value without calling the shared predicate. ` +
      `A field that merely happens to refuse bad protocols is not this rule.`,
  );
}

{
  /* The predicate is Prelum's (render/url) and the site never defines its own: one definition across the family. */
  const URL_POLICY = join(root, "app", "lib", "content", "url-policy.mjs");
  const urlPolicyTree = parseSource(URL_POLICY, readFileSync(URL_POLICY, "utf8"));
  const definitionsIn = (/** @type {ts.SourceFile} */ tree) =>
    findAll(tree, (n) => ts.isFunctionDeclaration(n) && n.name?.text === "isAllowedUrl").length;
  const inPolicy = definitionsIn(urlPolicyTree);
  const inPipeline = definitionsIn(pipelineTree);
  assert(
    "isAllowedUrl is Prelum's, defined in neither url-policy.mjs nor pipeline.mjs",
    inPolicy === 0 && inPipeline === 0,
    `found ${inPolicy} definition(s) in url-policy.mjs and ${inPipeline} in pipeline.mjs`,
  );
}

// Asserted by position: asserting a stage exists passes on an arrangement that runs it too late.
// Positions are of the CALLS on the syntax tree, so a mention in a string or comment cannot move them.
// The gateway's redirects (the WordPress map, the paper slash form) are decided without the database,
// so none of them may run after the cache loopback, where a stored response could outlive the fix.
{
  const workerPath = join(root, "workers", "app.ts");
  const workerTree = parseSource(workerPath, readFileSync(workerPath, "utf8"));
  /** @param {(n: ts.Node) => boolean} test */
  const firstAt = (test) => {
    const hits = findAll(workerTree, test).map((n) => n.getStart(workerTree));
    return hits.length > 0 ? Math.min(...hits) : -1;
  };
  /** @param {string} name */
  const callTo = (name) => (/** @type {ts.Node} */ n) =>
    ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === name;
  const loopbackAt = firstAt(
    (n) => ts.isPropertyAccessExpression(n) && n.getText(workerTree).replace(/\s+/g, "") === "ctx.exports.Renderer",
  );
  const httpsAt = firstAt(callTo("httpsRedirectTarget"));
  assert("redirects: the cache loopback was located", loopbackAt !== -1, "ctx.exports.Renderer not found");
  assert("redirects: the HTTPS redirect was located", httpsAt !== -1, "httpsRedirectTarget is not called");
  for (const name of ["wordpressDisposition", "paperSlashTarget"]) {
    const callAt = firstAt(callTo(name));
    assert(
      `redirects: the gateway calls ${name}`,
      callAt !== -1,
      `it is not called anywhere in workers/app.ts, so that redirect is decoration`,
    );
    assert(
      `redirects: ${name} IS DECIDED BEFORE THE CACHE LOOPBACK`,
      callAt !== -1 && loopbackAt !== -1 && callAt < loopbackAt,
      "a redirect resolved after the loopback is one the cache can outlive, and it would have " +
        "cost a render and a database read to discover",
    );
    assert(
      `redirects: the HTTPS redirect still runs before ${name}`,
      httpsAt !== -1 && callAt !== -1 && httpsAt < callAt,
      "a plaintext request must reach HTTPS before anything else decides anything",
    );
  }
}

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

// Measured by running it, with slack smaller than one fixture case, so deleting a case cannot hide
// inside the tolerance.
const MINIMUM_CHECKS = 109;
tally.floor("check:urls", "checks", MINIMUM_CHECKS);

if (tally.failures > 0) {
  console.log(`\n${tally.failures} FAILED of ${tally.checks} checks\n`);
  process.exit(1);
}
console.log(`\n${tally.checks} checks, 0 failures\n`);
