/**
 * Gate over the URL protocol allowlist.
 *
 *   npm run check:urls
 *
 * BOUNDARY: the allowlist predicate over crafted inputs. It never fetches a URL and never scans
 * the live corpus. The finding it exists for: a `javascript:` href rendered LIVE and reached the
 * stored HTML, the artifact, D1 and the published page, agent-reachable with no human click.
 * TWO LEVELS: the PREDICATE, which can express obfuscations markdown would percent-encode, and
 * the RENDERER end to end, because a right predicate is worth nothing if the plugin is wired in
 * after the one that emits the href. FAILS CLOSED, and the `javascript` fixture entries are
 * PERMANENT NEGATIVES: removing one is removing the gate.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";

import { frontmatterSchema, isAllowedUrl, renderBody } from "../app/lib/content/pipeline.mjs";
import { postRedirectStatus, postRedirectTarget } from "../app/lib/slug-redirect.mjs";
import { assertFloor } from "./lib/floor.mjs";

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

/* The predicate */

for (const probe of fixture.predicateCases) {
  assert(
    `predicate: ${JSON.stringify(probe.url)} is ${probe.allowed ? "allowed" : "blocked"}`,
    isAllowedUrl(probe.url) === probe.allowed,
  );
}

/**
 * Obfuscations are built from CODE POINTS rather than escapes, so this file holds no control
 * characters: writing them literally corrupted the module into a binary file more than once.
 */
for (const probe of fixture.obfuscationCases) {
  const url = probe.codes.map((code) => String.fromCodePoint(code)).join("");
  assert(
    `obfuscation: ${probe.label} is ${probe.allowed ? "allowed" : "blocked"}`,
    isAllowedUrl(url) === probe.allowed,
  );
}

/* The renderer, end to end */

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

/*
 * FRONTMATTER, which the render layer never sees: the plugin walks the tree `renderBody`
 * produces, so the allowlist did not bind the two frontmatter fields that reach a URL context,
 * one of which renders as a live public href. These bind the SCHEMA, the only thing in that path,
 * asserted against the object both writers import so they cannot pass against a copy.
 */

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

/*
 * THE SHARED PREDICATE, ASSERTED ON THE SOURCE. Everything above tests BEHAVIOUR, and the rule is
 * not "these fields refuse bad protocols" but "these fields call the same predicate the renderer
 * uses". Those come apart: one field was a regex that blocked the protocol only as a side effect
 * of demanding a leading slash, and every behavioural case was green. The mechanism is what
 * survives the next edit. COMMENTS ARE STRIPPED FIRST, both docblocks discussing the predicate in
 * prose; only BLOCK comments, the line form truncating a `//host` inside a message string.
 */

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

/*
 * THE REDIRECT MAP: every old slug goes somewhere that exists, and no post claims a slug the map
 * redirects away from. A REDIRECT TO A 404 is invisible because the gateway resolves the map
 * without touching the database; A SLUG THAT IS ALSO A SOURCE is sharper, the redirect running
 * before the router, so the post can never be served while looking fine on disk. READ FROM THE
 * MARKDOWN, NOT THE BUILD PRODUCT, which is the fixture independence hard rule 10 names.
 */

const REDIRECTS_PATH = join(root, "content", "redirects.json");

if (!existsSync(REDIRECTS_PATH)) {
  console.log("  FAIL  content/redirects.json is missing");
  console.log("        It is this section's whole subject. Restore it from git.\n");
  process.exit(1);
}

/** @type {{ posts: Record<string, string> }} */
const redirects = JSON.parse(readFileSync(REDIRECTS_PATH, "utf8"));
const redirectSources = Object.keys(redirects.posts ?? {});

/*
 * THE RETIRED SET, AND WHY IT IS A SECOND FILE: everything below checks that what is IN the map
 * is coherent, which cannot catch DELETING an entry. So the expected set comes from a file the
 * map cannot edit, reconciled BOTH DIRECTIONS. Not two owners of one fact, which hard rule 17
 * forbids, but two facts: that a URL was ONCE PUBLIC, and WHERE IT GOES NOW.
 */
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

/**
 * A post whose frontmatter does not parse is counted and reported, never skipped: skipping turns
 * a live redirect target into a missing one this gate calls fine.
 */
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
  /*
   * PUBLISHED, on the same three conditions the public read applies. A redirect whose target is a
   * draft is a 404 for every reader, and hard rule 1 is why this cannot soften to "the file exists".
   */
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
        `redirect gets a 404. Hard rule 1.`,
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

/*
 * THE PREDICATE ITSELF, over the real map. The loop above proves the DATA is
 * coherent; this proves the CODE that reads it agrees, which is the same
 * two-level split the rest of this file uses.
 */
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

/*
 * THE GATEWAY ACTUALLY CALLS IT, AND IN THE RIGHT PLACE, asserted by POSITION in its own body:
 * asserting a stage EXISTS passes on an arrangement that runs it too late. Comments stripped.
 */
{
  const workerSource = readFileSync(join(root, "workers", "app.ts"), "utf8");
  const workerCode = workerSource
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
  assert(
    "redirects: the comment stripper ran on workers/app.ts",
    workerSource.includes("THE GATEWAY. Cache disabled") &&
      !workerCode.includes("THE GATEWAY. Cache disabled"),
    "the docblock phrase survived stripping, so the assertions below could be reading prose",
  );
  const callAt = workerCode.indexOf("postRedirectTarget(");
  const loopbackAt = workerCode.indexOf("ctx.exports.Renderer");
  const httpsAt = workerCode.indexOf("httpsRedirectTarget(");
  assert(
    "redirects: the gateway calls postRedirectTarget",
    callAt !== -1,
    "it is not called anywhere in workers/app.ts, so the map is decoration",
  );
  assert("redirects: the cache loopback was located", loopbackAt !== -1, "ctx.exports.Renderer not found");
  assert("redirects: the HTTPS redirect was located", httpsAt !== -1, "httpsRedirectTarget not found");
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

/* Counts, so a green run cannot mean an empty one */

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
 * EXECUTED-COUNT FLOOR. Every case comes from a committed fixture, which fails quietly: one that
 * parsed to an empty list runs zero cases and reports a clean sweep. MEASURED BY RUNNING IT, with
 * slack deliberately smaller than one redirect entry's worth, so deleting a redirect cannot hide
 * inside the tolerance. The prose here once claimed a floor the constant disagreed with, which is
 * hard rule 17's rot in its ordinary form.
 */
const MINIMUM_CHECKS = 188;
const floorBreach = assertFloor("check:urls", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) assert("this gate executed its assertions", false, floorBreach);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
