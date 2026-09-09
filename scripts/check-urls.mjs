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
 * THE REDIRECT MAP: every old slug goes somewhere that exists, and no post
 * claims a slug the map is still redirecting away from.
 *
 * Ruling 47, 2026-09-09. Nine posts were reslugged and every old URL keeps
 * answering with a 301. Two things can go wrong with that, and neither is
 * visible until a reader hits it:
 *
 *   A REDIRECT TO A 404. The gateway resolves the map without touching the
 *   database, deliberately (the grounds are on `slug-redirect.mjs`), so it
 *   CANNOT know whether the target exists. Nothing else looks either: a post
 *   body's internal links are not corpus-checked, and `check:content` reads
 *   `further_reading` only. So the target's existence is this gate's to own,
 *   and it is a build-time property, because the corpus is on disk.
 *
 *   A SLUG THAT IS ALSO A SOURCE. If a post ever took the name
 *   `letting-an-agent-publish` again, that post would be UNREACHABLE: the
 *   redirect runs in the gateway, before the router, so the 301 fires and the
 *   post at that slug can never be served. It is the sharper of the two,
 *   because the post looks completely fine on disk and in D1.
 *
 * READ FROM `content/posts/*.md`, NOT FROM THE BUILD PRODUCT.
 * `content/generated/posts.json` is gitignored, so a CI checkout does not have
 * it, and a gate whose expected values come out of the pipeline it is checking
 * is the fixture-independence failure hard rule 10 names. The frontmatter is
 * parsed with the same `frontmatterSchema` the Worker uses, so "published"
 * means here exactly what it means there.
 *
 * PAIRED WITH COUNTS, like every other section in this file: a map that parsed
 * to nothing and a corpus that read nothing both report a clean sweep.
 * ---------------------------------------------------------------------- */

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
 * THE RETIRED SET, AND WHY IT IS A SECOND FILE.
 *
 * Everything below this point reads `content/redirects.json` and checks that
 * what is IN it is coherent. That cannot catch the failure that matters most:
 * DELETING an entry. A map with an entry removed is perfectly coherent, it just
 * silently stops redirecting a URL that is already published, and the gate
 * would report a clean sweep over a smaller set. Same shape as the empty-scope
 * failure this file guards everywhere else, one level up.
 *
 * So the expected set comes from a file the map cannot edit, and the two are
 * reconciled in BOTH DIRECTIONS: every retired slug has a redirect, and every
 * redirect source is a retired slug. That is the same arrangement
 * `check:features` uses for `content/enhancements.json`.
 *
 * This is not two owners of one fact (hard rule 17), because they are two
 * different facts. `retired-slugs.json` records that a URL was ONCE PUBLIC,
 * which is history and is append-only. `redirects.json` records WHERE IT GOES
 * NOW, which is a current decision and can change. Retiring a tenth post edits
 * both, in the same commit, which is what the reconciliation forces.
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
 * The corpus, as slug to frontmatter, straight off disk.
 *
 * A post whose frontmatter does not parse is NOT skipped, it is counted and
 * reported. Skipping would let a malformed post drop out of the known set and
 * turn a live redirect target into a missing one that this gate calls fine.
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
   * PUBLISHED, on the same three conditions the public read applies: not a
   * draft, dated today or earlier, and not holding a future `publish_at`. A
   * redirect whose target is a draft is a redirect to a 404 for every reader,
   * and hard rule 1 is why this cannot be softened to "the file exists".
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
    `content/posts/${corpus.get(from)?.file ?? "?"} declares slug "${from}", which this map ` +
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
 * PERMANENT NEGATIVES for the predicate. Each is a path it must never claim:
 * a sibling route under the same prefix, or a lookup shape that would answer
 * from `Object.prototype` rather than from the map. Removing one is removing
 * the check.
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
 * THE GATEWAY ACTUALLY CALLS IT, AND CALLS IT IN THE RIGHT PLACE.
 *
 * Everything above is about a predicate that nothing has to invoke. This is the
 * wiring, asserted by POSITION in the gateway's own body, which is the same
 * reasoning `check:policy` uses for the money path: asserting that a stage
 * merely EXISTS passes on an arrangement that runs it too late. Comments are
 * stripped first, because in this repo a comment has both satisfied and failed
 * an assertion about code.
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
 * Never summed. The count is a fixed function of the fixture's case lists, so
 * it moves only when a case is added.
 *
 * The prose here said "floored at 92" while the constant below read 97, which
 * is hard rule 17's rot in its ordinary form: the constant was raised to the
 * measured value and the sentence justifying it was not. Corrected 2026-09-09
 * rather than left for the next reader to trip over.
 *
 * RE-MEASURED THE SAME WAY on 2026-09-09, after the redirect section landed:
 * 197. Floored at 188, a slack of nine. The redirect half contributes six
 * assertions per map entry plus the reconciliation's two, so the slack is
 * deliberately smaller than one entry's worth: deleting a single redirect has
 * to be caught by the both-directions reconciliation going RED, and it must not
 * be able to hide inside the floor's tolerance instead.
 */
const MINIMUM_CHECKS = 188;
const floorBreach = assertFloor("check:urls", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) assert("this gate executed its assertions", false, floorBreach);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
