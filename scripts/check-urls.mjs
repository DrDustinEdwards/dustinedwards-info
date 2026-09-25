import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";

import { frontmatterSchema, isAllowedUrl, renderBody } from "../app/lib/content/pipeline.mjs";
import { postRedirectStatus, postRedirectTarget } from "../app/lib/slug-redirect.mjs";
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

// Behaviour can pass while a field blocks a protocol only by accident, so the source must call the
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
  const definitions = findAll(
    pipelineTree,
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === "isAllowedUrl",
  ).length;
  assert("isAllowedUrl is defined exactly once in pipeline.mjs", definitions === 1, `found ${definitions} definitions`);
}

// A redirect to a 404 is invisible because the gateway resolves the map without the database, and a
// slug that is also a source can never be served, the redirect running before the router.

const REDIRECTS_PATH = join(root, "content", "redirects.json");

if (!existsSync(REDIRECTS_PATH)) {
  console.log("  FAIL  content/redirects.json is missing");
  console.log("        It is this section's whole subject. Restore it from git.\n");
  process.exit(1);
}

/** @type {{ posts: Record<string, string> }} */
const redirects = JSON.parse(readFileSync(REDIRECTS_PATH, "utf8"));
const redirectSources = Object.keys(redirects.posts ?? {});

// A second file, because checking the map's coherence cannot catch deleting an entry from it.
const RETIRED_PATH = join(root, "scripts", "fixtures", "retired-slugs.json");
if (!existsSync(RETIRED_PATH)) {
  console.log("  FAIL  fixture is missing: scripts/fixtures/retired-slugs.json");
  console.log("        Without it, deleting a redirect would pass. Restore it from git.\n");
  process.exit(1);
}
/** @type {{ posts: string[] }} */
const retired = JSON.parse(readFileSync(RETIRED_PATH, "utf8"));
const retiredSlugs = Array.isArray(retired.posts) ? retired.posts : [];

assert(
  "redirects: the retired-slug fixture is non-empty",
  retiredSlugs.length > 0,
  "it parsed to 0 entries, so the both-directions reconciliation below examines nothing",
);

for (const slug of retiredSlugs) {
  assert(
    `redirects: retired slug ${slug} still has a redirect`,
    Object.hasOwn(redirects.posts ?? {}, slug),
    `/blog/${slug} was published and content/redirects.json no longer names it, so that URL ` +
      `now 404s. Entries are append-only: if the post really is gone for good, that is a ` +
      `decision for Dustin, not a deletion from a map.`,
  );
}
for (const from of redirectSources) {
  assert(
    `redirects: redirect source ${from} is recorded as retired`,
    retiredSlugs.includes(from),
    `content/redirects.json redirects /blog/${from} and scripts/fixtures/retired-slugs.json ` +
      `does not list it. Add it there in the same commit, or the next reader cannot tell a ` +
      `real retired URL from a typo.`,
  );
}

/** Counted and reported, never skipped: skipping turns a live redirect target into a missing one. */
const postFiles = readdirSync(join(root, "content", "posts")).filter((f) => f.endsWith(".md"));
/** @type {Map<string, { published: boolean, file: string }>} */
const corpus = new Map();
let unparseable = 0;
const today = new Date().toISOString().slice(0, 10);
for (const file of postFiles) {
  const parsed = matter(readFileSync(join(root, "content", "posts", file), "utf8"));
  const result = frontmatterSchema.safeParse(parsed.data);
  if (!result.success) {
    unparseable += 1;
    continue;
  }
  const fm = result.data;
  // A redirect whose target is a draft is a 404 for every reader, so the file existing is not enough.
  const scheduled = fm.publish_at ? fm.publish_at.slice(0, 10) > today : false;
  corpus.set(fm.slug, { published: fm.draft !== true && fm.date <= today && !scheduled, file });
}

assert(
  "redirects: every post file's frontmatter parsed",
  unparseable === 0,
  `${unparseable} of ${postFiles.length} post file(s) did not parse, so the known-slug set is short ` +
    `and a live redirect target could read as missing`,
);
assert(
  "redirects: the corpus scope is non-empty",
  corpus.size > 0,
  "0 posts read from content/posts; every assertion below would sweep an empty set",
);
assert(
  "redirects: the map scope is non-empty",
  redirectSources.length > 0,
  "content/redirects.json parsed to 0 entries, so the assertions below examine nothing",
);

for (const [from, to] of Object.entries(redirects.posts ?? {})) {
  const target = corpus.get(to);
  assert(
    `redirects: /blog/${from} points at a post that exists`,
    target !== undefined,
    `the map sends it to /blog/${to}, and no file in content/posts declares that slug. ` +
      `That is a 301 into a 404.`,
  );
  assert(
    `redirects: /blog/${to} is published, so the 301 lands on a 200`,
    target !== undefined && target.published,
    target === undefined
      ? "the target does not exist at all, which the assertion above reports"
      : `${target.file} is a draft or is dated in the future, so a reader following this ` +
        `redirect gets a 404. The visibility rule.`,
  );
  assert(
    `redirects: ${from} is not also a live post slug`,
    !corpus.has(from),
    `the post file ${corpus.get(from)?.file ?? "?"} declares slug "${from}", which this map ` +
      `redirects away. The gateway runs before the router, so that post would be UNREACHABLE: ` +
      `every request for it 301s to /blog/${to}.`,
  );
  assert(
    `redirects: ${from} and ${to} are different slugs`,
    from !== to,
    "a redirect to itself is a loop at the gateway",
  );
}

for (const from of redirectSources) {
  assert(
    `redirects: the predicate resolves /blog/${from}`,
    postRedirectTarget(`/blog/${from}`, redirects.posts) === `/blog/${redirects.posts[from]}`,
    `got ${JSON.stringify(postRedirectTarget(`/blog/${from}`, redirects.posts))}`,
  );
  assert(
    `redirects: the predicate resolves the markdown twin /blog/${from}.md`,
    postRedirectTarget(`/blog/${from}.md`, redirects.posts) === `/blog/${redirects.posts[from]}.md`,
    `got ${JSON.stringify(postRedirectTarget(`/blog/${from}.md`, redirects.posts))}`,
  );
}

/*
 * PERMANENT NEGATIVES: a sibling route under the same prefix, and a lookup shape that would
 * answer from the prototype. Removing one is removing the check.
 */
for (const path of [
  "/blog",
  "/blog/",
  "/blog/tags/cloudflare",
  "/blog/series/ten-years",
  "/blog/constructor",
  "/blog/toString",
  "/blog/__proto__",
  "/blog/hasOwnProperty.md",
  "/",
  "/projects",
]) {
  assert(
    `redirects: PERMANENT NEGATIVE, the predicate declines ${path}`,
    postRedirectTarget(path, redirects.posts) === null,
    `it claimed ${JSON.stringify(postRedirectTarget(path, redirects.posts))}`,
  );
}

assert(
  "redirects: no live post slug is claimed by the predicate",
  [...corpus.keys()].every((slug) => postRedirectTarget(`/blog/${slug}`, redirects.posts) === null),
  `${[...corpus.keys()]
    .filter((slug) => postRedirectTarget(`/blog/${slug}`, redirects.posts) !== null)
    .join(", ")} would be redirected away from its own URL`,
);

assert(
  "redirects: 301 for GET and HEAD, 308 otherwise",
  postRedirectStatus("GET") === 301 &&
    postRedirectStatus("HEAD") === 301 &&
    postRedirectStatus("POST") === 308,
  `GET ${postRedirectStatus("GET")}, HEAD ${postRedirectStatus("HEAD")}, POST ${postRedirectStatus("POST")}`,
);

// Asserted by position: asserting a stage exists passes on an arrangement that runs it too late.
// Positions are of the CALLS on the syntax tree, so a mention in a string or comment cannot move them.
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
  const callAt = firstAt(callTo("postRedirectTarget"));
  const loopbackAt = firstAt(
    (n) => ts.isPropertyAccessExpression(n) && n.getText(workerTree).replace(/\s+/g, "") === "ctx.exports.Renderer",
  );
  const httpsAt = firstAt(callTo("httpsRedirectTarget"));
  assert(
    "redirects: the gateway calls postRedirectTarget",
    callAt !== -1,
    "it is not called anywhere in workers/app.ts, so the map is decoration",
  );
  assert("redirects: the cache loopback was located", loopbackAt !== -1, "ctx.exports.Renderer not found");
  assert("redirects: the HTTPS redirect was located", httpsAt !== -1, "httpsRedirectTarget is not called");
  assert(
    "redirects: THE REDIRECT IS DECIDED BEFORE THE CACHE LOOPBACK",
    callAt !== -1 && loopbackAt !== -1 && callAt < loopbackAt,
    "a redirect resolved after the loopback is one the cache can outlive, and it would have " +
      "cost a render and a database read to discover",
  );
  assert(
    "redirects: the HTTPS redirect still runs first",
    httpsAt !== -1 && callAt !== -1 && httpsAt < callAt,
    "a plaintext request must reach HTTPS before anything else decides anything",
  );
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

// Measured by running it, with slack smaller than one redirect entry, so deleting a redirect cannot
// hide inside the tolerance.
const MINIMUM_CHECKS = 188;
tally.floor("check:urls", "checks", MINIMUM_CHECKS);

if (tally.failures > 0) {
  console.log(`\n${tally.failures} FAILED of ${tally.checks} checks\n`);
  process.exit(1);
}
console.log(`\n${tally.checks} checks, 0 failures\n`);
