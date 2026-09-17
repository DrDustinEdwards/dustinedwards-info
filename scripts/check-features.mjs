/**
 * Gate over the colophon's hand-written half: `npm run check:features`.
 *
 * It verifies that what each claim is about still exists, never that the prose is true.
 * The route parser does not compose nested prefixes: anchor a nested route to its declared
 * segment, never to a hardcoded path list. Every feature needs a route, gate or assertion
 * anchor; a decision anchor lives in Capsid and proves nothing offline. Fails closed on zero
 * features, zero anchors, or an unparsed routes.ts.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import rehypeStringify from "rehype-stringify";
import { unified } from "unified";

import { COLOPHON_ANCHORS, STATUS_LABEL } from "../app/lib/colophon-sections.mjs";
import { PLAYGROUND_URL, demoAnchor } from "../app/lib/playground-page.mjs";
import {
  METRIC_DERIVATIONS,
  PROJECTS_URL,
  metricValue,
  projectAnchor,
} from "../app/lib/projects-page.mjs";
// Same function the route calls, so the gate cannot agree only with itself (hard rule 10).
import { PHAGE_YEARS } from "../app/data/phage-hunters.ts";
import { isAllowedUrl, renderBody } from "../app/lib/content/pipeline.mjs";
// The key grammar's readers, so the demos are checked against the real module.
import {
  classify,
  cropSafe,
  digestFromKey,
  dimensionsFromKey,
  isContentKey,
  isRaster,
  roleOf,
  storageOf,
} from "../app/lib/media/classify.mjs";
// The theme resolver, for the same reason.
import { colorSchemeMeta, themeAttribute, themeFromRequest } from "../app/lib/theme.ts";
// The demos' real code paths, imported rather than reimplemented.
import { apca, contrast } from "../app/lib/contrast.mjs";
import { RRF_K, fuse } from "../app/lib/search/query.mjs";
import { stripComments } from "./lib/strip-comments.mjs";
import {
  CHART_TYPES,
  buildChartModel,
  renderChartHast,
} from "../app/lib/content/chart.mjs";
import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEATURES_PATH = join(root, "content", "features.json");
const PROJECTS_PATH = join(root, "content", "projects.json");
const PROJECTS_ROUTE_PATH = join(root, "app", "routes", "projects.tsx");
const PLAYGROUND_PATH = join(root, "content", "playground.json");
const PLAYGROUND_ROUTE_PATH = join(root, "app", "routes", "playground.tsx");
const ROUTES_PATH = join(root, "app", "routes.ts");

let checks = 0;
let failures = 0;

/** CRLF collapsed to LF, so a match is a property of CONTENT, not of a host. */
const normalizeEol = (/** @type {string} */ text) => text.replace(/\r\n/g, "\n");

/**
 * Comments removed, line structure kept, so a match is a property of code. Every reader here
 * uses it.
 *
 * @param {string} source
 */
const stripped = (/** @type {string} */ source) =>
  stripComments(source, { preserveLines: true });

/**
 * Letter-digit tokens (D1, FTS5) are names, removed before a hard-rule-17 digit scan.
 *
 * @param {string} text
 */
const withoutIdentifiers = (text) =>
  text
    .replace(/\b[A-Za-z]+[0-9][A-Za-z0-9]*\b/g, " ")
    .replace(/\b[0-9]+[A-Za-z][A-Za-z0-9]*\b/g, " ");

/**
 * @param {string} label
 * @param {boolean} condition
 * @param {string} [detail]
 */
function ok(label, condition, detail = "") {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ""}`);
  }
}

/** Every path `routes.ts` declares, by regex. A route it cannot parse fails, the safe direction. */
function declaredRoutes() {
  // Comments first: this file's prose names paths.
  const source = stripped(readFileSync(ROUTES_PATH, "utf8"));

  /** @type {Set<string>} */
  const paths = new Set();
  // index() declares the site root and carries no path argument.
  if (/\bindex\s*\(/.test(source)) paths.add("/");
  for (const [, path] of source.matchAll(
    /\broute\s*\(\s*["'`]([^"'`]+)["'`]/g,
  )) {
    paths.add(path.startsWith("/") ? path : `/${path}`);
  }
  return paths;
}

/**
 * Path to module file; an unresolvable module is absent and the caller fails it.
 *
 * @returns {Map<string, string>}
 */
function declaredRouteModules() {
  const source = stripped(readFileSync(ROUTES_PATH, "utf8"));
  /** @type {Map<string, string>} */
  const out = new Map();
  const index = source.match(/\bindex\s*\(\s*["'`]([^"'`]+)["'`]/);
  if (index) out.set("/", join(root, "app", index[1]));
  for (const [, path, module] of source.matchAll(
    /\broute\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*["'`]([^"'`]+)["'`]/g,
  )) {
    out.set(path.startsWith("/") ? path : `/${path}`, join(root, "app", module));
  }
  return out;
}

/** Every gate package.json declares, minus the aggregate runners. */
function declaredGates() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    if (!name.startsWith("check:") || name === "check:all") continue;
    // Taken from the command: gate names do not map to files mechanically.
    const file = String(command).match(/([\w./-]+\.mjs)/)?.[1];
    out.set(name, file ? join(root, file) : "");
  }
  return out;
}

console.log("\ncheck:features\n");

if (!existsSync(FEATURES_PATH)) {
  console.log("  FAIL  content/features.json is missing.\n");
  process.exit(1);
}

const features = JSON.parse(readFileSync(FEATURES_PATH, "utf8")).features ?? [];

/** The gated artifact's records, for the page-record section below. */
const artifactRecords =
  JSON.parse(
    readFileSync(join(root, "content", "generated", "posts.json"), "utf8"),
  ).records ?? [];
const routes = declaredRoutes();
const routeModules = declaredRouteModules();
const gates = declaredGates();

/* fail closed first */

ok(
  "the feature list is not empty",
  features.length > 0,
  "no features, so every check below would pass vacuously",
);
/* Catches a parser that stops seeing nested `route()` calls. */
ok(
  "routes.ts parsed to a plausible number of routes",
  routes.size >= 33,
  `parsed ${routes.size}, floor 33, measured 36. The parser has stopped matching this ` +
    `file's style, most likely for the nested children under the admin subtree.`,
);
ok(
  "package.json declares gates",
  gates.size > 0,
  "no check:* scripts found",
);
ok(
  "every feature carries a component and a name",
  features.every(
    (/** @type {any} */ f) => f.component && f.name && f.what,
  ),
  features
    .filter((/** @type {any} */ f) => !f.component || !f.name || !f.what)
    .map((/** @type {any} */ f) => f.name ?? "(unnamed)")
    .join(", "),
);

const anchorCount = features.reduce(
  (/** @type {number} */ sum, /** @type {any} */ f) =>
    sum + (f.anchors?.length ?? 0),
  0,
);
ok(
  "the features carry anchors at all",
  anchorCount > 0,
  "every feature is unanchored, so this gate would examine nothing",
);

/* the anchors */

const VERIFIABLE = ["route", "gate", "assertion"];
/** Gates some feature points at, for the coverage report at the end. */
const referencedGates = new Set();
let verified = 0;

for (const feature of features) {
  const label = `${feature.component} / ${feature.name}`;
  const anchors = feature.anchors ?? [];

  ok(`${label} carries at least one anchor`, anchors.length > 0);

  /* A decision anchor proves nothing offline, so it may never stand alone. */
  ok(
    `${label} carries a verifiable anchor, not only a decision`,
    anchors.some((/** @type {any} */ a) => VERIFIABLE.includes(a.kind)),
    `its anchors are ${anchors.map((/** @type {any} */ a) => a.kind).join(", ") || "(none)"}. ` +
      `A decision anchor cannot be verified offline, so it cannot be the only one.`,
  );

  for (const anchor of anchors) {
    if (anchor.kind === "route") {
      verified += 1;
      ok(
        `${label} names a route that exists: ${anchor.path}`,
        routes.has(anchor.path),
        `routes.ts declares no ${anchor.path}`,
      );

      /*
       * An anchor rendered as a link must answer an anonymous GET, else `anonymousGet: false`.
       * Derived here: a default export is a page; else no loader, `status: 405` or
       * `authenticateOperator` means not a page.
       */
      const routeFile = routeModules.get(anchor.path);
      if (routeFile && existsSync(routeFile)) {
        const routeSource = stripComments(readFileSync(routeFile, "utf8"));
        const isPage = /export\s+default\s+function\b/.test(routeSource);
        const hasLoader = /export\s+(?:async\s+)?function\s+loader\b/.test(routeSource);
        const loaderRefuses = /status:\s*405/.test(routeSource);
        const loaderAuthenticates = /\bauthenticateOperator\s*\(/.test(routeSource);
        const derived = isPage || (hasLoader && !loaderRefuses && !loaderAuthenticates);
        const declared = anchor.anonymousGet !== false;
        const why = !hasLoader
          ? "exports neither a component nor a loader"
          : loaderRefuses
            ? "returns 405 from its loader"
            : "authenticates in its loader";
        ok(
          `${label}: the anonymousGet flag on ${anchor.path} matches the route`,
          declared === derived,
          declared
            ? `the anchor renders as a link, but ${routeFile.slice(root.length + 1)} ` +
                `${why}, so a reader following it gets an error rather than a page. ` +
                `Add "anonymousGet": false.`
            : `the anchor is marked not-followable, but ${routeFile.slice(root.length + 1)} ` +
                `${isPage ? "exports a component" : "has a loader that neither refuses nor authenticates"}. ` +
                `The route became a page and the flag outlived it. Remove "anonymousGet": false.`,
        );
      } else {
        /* A declared route with no module on disk fails rather than skips. */
        ok(
          `${label}: the module for ${anchor.path} is on disk`,
          false,
          `routes.ts declares ${anchor.path} and this gate could not resolve it to ` +
            `a file, so its followability was never checked.`,
        );
      }
    } else if (anchor.kind === "gate") {
      verified += 1;
      referencedGates.add(anchor.gate);
      const file = gates.get(anchor.gate) ?? "";
      ok(
        `${label} names a gate that exists: ${anchor.gate}`,
        gates.has(anchor.gate),
        `package.json declares no ${anchor.gate}`,
      );
      ok(
        `${label}: the script for ${anchor.gate} is on disk`,
        Boolean(file) && existsSync(file),
        `${anchor.gate} maps to ${file || "(no .mjs in its command)"}, which does not exist`,
      );
    } else if (anchor.kind === "assertion") {
      verified += 1;
      referencedGates.add(anchor.gate);
      const file = gates.get(anchor.gate) ?? "";
      /* Both sides LF-normalized, or a multi-line anchor passes only on a CRLF disk. */
      const present =
        Boolean(file) && existsSync(file)
          ? stripped(normalizeEol(readFileSync(file, "utf8"))).includes(normalizeEol(anchor.text))
          : false;
      ok(
        `${label}: ${anchor.gate} still asserts "${anchor.text}"`,
        present,
        !file || !existsSync(file)
          ? `${anchor.gate} has no script on disk`
          : `that exact text is not in ${anchor.gate}'s script. It was reworded or removed.`,
      );
    } else if (anchor.kind === "decision") {
      ok(
        `${label} decision anchor is dated: ${anchor.id ?? "(none)"}`,
        typeof anchor.id === "string" && /^\d{4}-\d{2}-\d{2}/.test(anchor.id),
        `a decision anchor is context and is not verified here, but it must at ` +
          `least name a dated entry so a reader can find it`,
      );
    } else {
      ok(
        `${label} has a known anchor kind`,
        false,
        `${JSON.stringify(anchor.kind)} is not one of route, gate, assertion, decision`,
      );
    }
  }
}

ok(
  "verifiable anchors were actually checked",
  verified > 0,
  "every anchor was a decision, so nothing was verified",
);

/* hard rule 17, on the prose */

/*
 * Hard rule 17 on the feature prose: no digit a gate does not own, no removed-pipeline
 * words. Cannot read tense. Only protocol constants are allowed; a date allowance would cover
 * no field here (hard rule 10). Anchor text is exempt.
 */

console.log("\n  hard rule 17: the prose carries no number a gate does not own");

{
  /** Bare digits prose may carry. Closed: a protocol constant cannot go stale. */
  const PROTOCOL_CONSTANTS = new Map([
    ["403", "HTTP status: the first-publish refusal names it"],
    ["404", "HTTP status: the URL transform interface answers with it"],
    ["429", "HTTP status: the Ask refusal names it"],
    ["1042", "Cloudflare error code returned alongside that 404"],
  ]);

  /** The prose fields. `anchors` is machine reference and is exempt above. */
  const PROSE_FIELDS = ["component", "name", "what"];


  /** Removed-pipeline phrases; a sentence using one describes nothing real. */
  const REMOVED_VOCABULARY = [
    "committed artifact",
    "byte-comparison gate",
    "byte-compared",
    "regenerated artifact",
    "single commit carrying both",
  ];

  /* Scope asserted below, or an empty list sweeps nothing. */
  let sentencesScanned = 0;
  /** @type {string[]} */
  const numbered = [];
  /** @type {string[]} */
  const removedWords = [];

  for (const feature of features) {
    const label = `${feature.component} / ${feature.name}`;
    for (const field of PROSE_FIELDS) {
      const text = String(feature[field] ?? "");
      if (!text) continue;
      sentencesScanned += 1;

      for (const run of withoutIdentifiers(text).match(/[0-9]+/g) ?? []) {
        if (PROTOCOL_CONSTANTS.has(run)) continue;
        numbered.push(`${label} (${field}): "${run}"`);
      }

      const lower = text.toLowerCase();
      for (const phrase of REMOVED_VOCABULARY) {
        if (lower.includes(phrase)) {
          removedWords.push(`${label} (${field}): "${phrase}"`);
        }
      }
    }
  }

  /* Floored under the measured field count. */
  ok(
    "the prose scan had fields to read",
    sentencesScanned >= 90,
    `scanned ${sentencesScanned} field(s), floor 90, measured 114 on 2026-08-28. ` +
      `A zero-scope scan reports a clean sweep of nothing.`,
  );

  /* Proves the predicate can fire, since the real data may be clean. */
  ok(
    "the digit scan can fire: a bare measurement survives the stripper",
    (withoutIdentifiers("rendered 200 times").match(/[0-9]+/g) ?? []).length === 1,
    "the identifier stripper is eating bare numbers, so nothing can ever fail here",
  );
  ok(
    "the digit scan does not fire on an identifier",
    (withoutIdentifiers("D1 and R2 and FTS5").match(/[0-9]+/g) ?? []).length === 0,
    "a product name is being read as a measurement, which makes the rule unusable",
  );

  ok(
    "no feature sentence carries a number the gate does not own",
    numbered.length === 0,
    `${numbered.join("; ")}. Hard rule 17: a measured value lives in the gate that ` +
      `measures it, or nowhere. Point at the gate instead of restating its value.`,
  );

  ok(
    "no feature sentence uses the vocabulary of the removed content machinery",
    removedWords.length === 0,
    `${removedWords.join("; ")}. That machinery left git on 2026-08-26. Git holds ` +
      `markdown only, D1 holds the only rendered copy, and a save commits one file.`,
  );
}

/* page search records */


console.log("\n  page records for /colophon");

const pageRecords = artifactRecords.filter(
  (/** @type {any} */ r) => r.type === "page",
);
const colophonRecords = pageRecords.filter(
  (/** @type {any} */ r) => r.docUid === "page:colophon",
);

// Fail closed: zero records would pass everything below.
ok(
  "the artifact carries page records",
  pageRecords.length > 0,
  "no type='page' records. Run build:stack then build:content.",
);
ok(
  "the colophon has exactly one document record",
  colophonRecords.filter((/** @type {any} */ r) => r.anchor === null).length === 1,
  `found ${colophonRecords.filter((/** @type {any} */ r) => r.anchor === null).length}`,
);

/* Every page record lives at a declared route; papers share one parameterised route. */
const PAPER_ROUTE = "/publications/:slug";
const paperRecords = pageRecords.filter((/** @type {any} */ r) =>
  String(r.uid).startsWith("paper:"),
);
const otherPageRecords = pageRecords.filter(
  (/** @type {any} */ r) => !String(r.uid).startsWith("paper:"),
);

ok(
  `the paper records are served by ${PAPER_ROUTE} (${paperRecords.length} record(s))`,
  paperRecords.length > 0 && routes.has(PAPER_ROUTE),
  paperRecords.length === 0
    ? "no paper records in the artifact, so this assertion read nothing"
    : `routes.ts declares no ${PAPER_ROUTE}`,
);
ok(
  `every paper record is under the paper route (${paperRecords.length} checked)`,
  paperRecords.every((/** @type {any} */ r) =>
    /^\/publications\/[a-z0-9-]+\/$/.test(String(r.url)),
  ),
  `a paper record whose URL is not /publications/<slug>/ is not served by ` +
    `${PAPER_ROUTE}: ` +
    paperRecords
      .filter((/** @type {any} */ r) => !/^\/publications\/[a-z0-9-]+\/$/.test(String(r.url)))
      .map((/** @type {any} */ r) => r.url)
      .join(", "),
);

for (const record of otherPageRecords) {
  const path = String(record.url).split("#")[0];
  ok(
    `page record ${record.uid} resolves to a declared route: ${path}`,
    routes.has(path),
    `routes.ts declares no ${path}`,
  );
}

/* Section anchors both ways: an unrendered anchor is a hit that scrolls nowhere. */
const sectionRecords = colophonRecords.filter(
  (/** @type {any} */ r) => r.anchor !== null,
);
ok(
  "the colophon has section records, not just a document record",
  sectionRecords.length > 0,
  "section-grained records are the point; a document record alone loses every deep link",
);
for (const record of sectionRecords) {
  ok(
    `section record anchor is in the descriptor: ${record.anchor}`,
    COLOPHON_ANCHORS.includes(String(record.anchor)),
    `the descriptor declares ${COLOPHON_ANCHORS.join(", ")}`,
  );
}
const unrecorded = COLOPHON_ANCHORS.filter(
  (id) => !sectionRecords.some((/** @type {any} */ r) => r.anchor === id),
);
ok(
  "every descriptor section has a record",
  unrecorded.length === 0,
  `no record for ${unrecorded.join(", ")}. Regenerate the artifact.`,
);

/* The only `<h2 id=` is in `SectionHead`, so any literal id is a second list. */
const pageSource = readFileSync(
  join(root, "app", "routes", "colophon.tsx"),
  "utf8",
);
const literalHeadings = [
  ...pageSource.matchAll(/<h2\s+id="([^"]+)"/g),
].map((m) => m[1]);
ok(
  "colophon.tsx declares no literal section id",
  literalHeadings.length === 0,
  `found ${literalHeadings.join(", ")}. Those ids exist in the descriptor too, ` +
    `so they are a second list and will drift.`,
);
const rendered = [...pageSource.matchAll(/<SectionHead\s+id="([^"]+)"/g)].map(
  (m) => m[1],
);
ok(
  "the page renders one section per descriptor entry, in order",
  rendered.length === COLOPHON_ANCHORS.length &&
    rendered.every((id, i) => id === COLOPHON_ANCHORS[i]),
  `page renders [${rendered.join(", ")}], descriptor declares [${COLOPHON_ANCHORS.join(", ")}]`,
);

console.log(
  `     ${colophonRecords.length} colophon record(s), ${sectionRecords.length} section(s), ` +
    `${COLOPHON_ANCHORS.length} descriptor anchor(s), ${rendered.length} rendered`,
);

/* not-adopted labels */

/* The index carries the page's label, never the raw enum, and no reader holds a copy. */

console.log("\n  not-adopted status labels");

const stackJson = JSON.parse(
  readFileSync(join(root, "content", "generated", "stack.json"), "utf8"),
);
const notAdopted = stackJson.notAdopted ?? [];

// FAIL CLOSED before anything else, so "0 problems" cannot mean "0 entries".
ok(
  "stack.json carries not-adopted entries",
  notAdopted.length > 0,
  "no entries, so every label assertion below would pass vacuously",
);

const usedStatuses = [...new Set(notAdopted.map((/** @type {any} */ n) => String(n.status)))];

// Direction 1: every status the data uses has a label.
for (const status of usedStatuses) {
  ok(
    `status "${status}" has a label`,
    Boolean(STATUS_LABEL[status]),
    `STATUS_LABEL declares ${Object.keys(STATUS_LABEL).join(", ")}. ` +
      `Without a label the page and the index would disagree about what it is called.`,
  );
}
// Direction 2: no label for an undeclared status.
for (const status of Object.keys(STATUS_LABEL)) {
  ok(
    `label "${status}" is used by at least one entry`,
    usedStatuses.includes(status),
    `nothing in stack.json declares status "${status}"`,
  );
}

/* The artifact is what search matches, so it is read, not recomputed. */
const notAdoptedRecord = colophonRecords.find(
  (/** @type {any} */ r) => r.anchor === "not-adopted",
);
ok(
  "the not-adopted section has a record",
  Boolean(notAdoptedRecord),
  "without it the two assertions below would examine nothing",
);
if (notAdoptedRecord) {
  const body = String(notAdoptedRecord.body);
  for (const status of usedStatuses) {
    const label = STATUS_LABEL[status];
    ok(
      `the index carries the label "(${label})" for status "${status}"`,
      body.includes(`(${label})`),
      `the not-adopted record body does not contain "(${label})". Regenerate the artifact.`,
    );
    // Parenthesised, so a reason sentence cannot fire this.
    ok(
      `the index does NOT carry the raw enum "(${status})"`,
      !body.includes(`(${status})`),
      `the record body still carries the raw enum, which is the exact defect ` +
        `this section exists for: the page renders "(${label})".`,
    );
  }
}

/* Comments stripped: both files name these values in prose. */

const pageCode = stripComments(pageSource);
for (const status of usedStatuses) {
  const label = STATUS_LABEL[status];
  ok(
    `colophon.tsx carries no literal status "${status}"`,
    !pageCode.includes(`"${status}"`) && !pageCode.includes(`'${status}'`),
    `the page must render through statusLabel(), not its own copy`,
  );
  ok(
    `colophon.tsx carries no literal label "${label}"`,
    !pageCode.includes(`"${label}"`) && !pageCode.includes(`>${label}<`),
    `the page must render through statusLabel(), not its own copy`,
  );
}
ok(
  "colophon.tsx renders the status through statusLabel()",
  /statusLabel\s*\(/.test(pageCode),
  "the page does not call statusLabel, so it is getting the word from somewhere else",
);

/* Each label declared exactly once keeps the descriptor the single source. */
const descriptorCode = stripComments(
  readFileSync(join(root, "app", "lib", "colophon-sections.mjs"), "utf8"),
);
for (const status of usedStatuses) {
  const label = STATUS_LABEL[status];
  const occurrences = descriptorCode.split(`"${label}"`).length - 1;
  ok(
    `the descriptor declares label "${label}" exactly once`,
    occurrences === 1,
    `found ${occurrences}. One is the STATUS_LABEL map; a second is a restatement that will drift.`,
  );
}

/* While CI runs on main, no not-adopted entry may name continuous integration. */
{
  const ciWorkflow = join(root, ".github", "workflows", "ci.yml");
  const ciRuns = existsSync(ciWorkflow);
  ok(
    "there is a CI workflow for the next assertion to be about",
    ciRuns,
    ".github/workflows/ci.yml is absent, so the CI claim below proved nothing. " +
      "If CI really is gone, this assertion and the colophon both need a decision.",
  );
  if (ciRuns) {
    /** @param {string} text */
    const namesCi = (text) =>
      /\bcontinuous integration\b/i.test(text) || /\bno CI\b/i.test(text) || /\bCI\b/.test(text);
    for (const entry of notAdopted) {
      const name = String(entry.name ?? "");
      const reason = String(entry.reason ?? "");
      ok(
        `not-adopted entry "${name}" does not call CI missing`,
        !namesCi(name) && !namesCi(reason),
        `ci.yml runs on every push to main and ship refuses a HEAD without a green ` +
          `run for its sha, so an entry under "What was not adopted" naming continuous ` +
          `integration is a false sentence on the page. Entry: ${JSON.stringify({ name, status: entry.status })}`,
      );
    }
  }
}

console.log(
  `     ${notAdopted.length} entr(ies), ${usedStatuses.length} distinct status(es), ` +
    `${Object.keys(STATUS_LABEL).length} label(s)`,
);

/* enhancement inventory */

/*
 * Hard rule 9: every enhancement names a fallback, both directions against `app/enhance/`.
 * Whether it works is a wire claim (hard rule 7).
 */

const ENHANCEMENTS_PATH = join(root, "content", "enhancements.json");
const ENHANCE_DIR = join(root, "app", "enhance");

/** A tripwire: a new module means walking this list (hard rule 9). */
const EXPECTED_ENHANCE_MODULES = 4;

/** Set under measured, to catch a module that stopped being read. */
const MINIMUM_ENHANCEMENT_ENTRIES = 9;

ok(
  "content/enhancements.json exists",
  existsSync(ENHANCEMENTS_PATH),
  "the inventory is missing, so every assertion below would examine nothing",
);

/** @type {any[]} */
let inventory = [];
if (existsSync(ENHANCEMENTS_PATH)) {
  inventory = JSON.parse(readFileSync(ENHANCEMENTS_PATH, "utf8")).enhancements ?? [];
}

/** Every module file that actually exists, read off disk rather than listed. */
const enhanceFiles = existsSync(ENHANCE_DIR)
  ? readdirSync(ENHANCE_DIR)
      .filter((name) => name.endsWith(".ts"))
      .sort()
  : [];

ok(
  "app/enhance/ holds the expected number of modules",
  enhanceFiles.length === EXPECTED_ENHANCE_MODULES,
  `found ${enhanceFiles.length} (${enhanceFiles.join(", ") || "none"}), expected ` +
    `${EXPECTED_ENHANCE_MODULES}. A new enhancement module needs a row in ` +
    `content/enhancements.json and this number moved in the same commit.`,
);
ok(
  "the enhancement inventory is not empty",
  inventory.length >= MINIMUM_ENHANCEMENT_ENTRIES,
  `${inventory.length} entr(ies), expected at least ${MINIMUM_ENHANCEMENT_ENTRIES}; ` +
    `below that the per-entry assertions stop examining anything`,
);

const inventoryModules = new Set(
  inventory.map((/** @type {any} */ e) => String(e.module ?? "")),
);

// Direction A: every module on disk is named by at least one entry.
for (const name of enhanceFiles) {
  const relPath = `app/enhance/${name}`;
  ok(
    `enhancements: ${relPath} appears in the inventory`,
    inventoryModules.has(relPath),
    `no entry names ${relPath}, so an enhancement shipped without a named fallback`,
  );
}

// Direction B: every module named by an entry is on disk.
for (const modulePath of [...inventoryModules].sort()) {
  ok(
    `enhancements: ${modulePath || "(unnamed)"} exists on disk`,
    Boolean(modulePath) && existsSync(join(root, modulePath)),
    `the inventory names ${modulePath || "(nothing)"}, which is not in the repo`,
  );
}

/** Sources under `app/` except `app/enhance/` and stylesheets: neither renders a fallback. */
function serverRenderedSources(/** @type {string} */ dir, /** @type {string[]} */ out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (full === ENHANCE_DIR) continue;
      serverRenderedSources(full, out);
    } else if (/\.(ts|tsx|mjs)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const serverSources = serverRenderedSources(join(root, "app"));

// Scope asserted so an empty walk fails by name.
/* Catches a walk that stops descending; re-measure by running the gate. */
ok(
  "the server-rendered source scope is non-empty and complete",
  serverSources.length >= 145,
  `walked ${serverSources.length} file(s) under app/ excluding app/enhance/, floor 145, ` +
    `measured 158. The walker has stopped matching this tree, or stopped descending into it.`,
);

/* Comments stripped, so a comment cannot satisfy a fallback. */
const sourceBlobs = serverSources.map((file) =>
  stripped(normalizeEol(readFileSync(file, "utf8"))),
);

/*
 * Plus what the shared renderer emits (remark-gfm footnotes), from a fixture, since the
 * claim is about the renderer and not the corpus.
 */
const RENDERER_FIXTURE = [
  "A paragraph with a footnote reference[^1].",
  "",
  "[^1]: The note itself, which is a real bidirectional link.",
  "",
  "```ts",
  "const highlighted = true;",
  "```",
  "",
  "## A heading, which gets an autolink",
  "",
  "![An image, which gets an anchor to its original](/og-image.png)",
].join("\n");

const renderedMarkup = await renderBody({
  file: "check-features fixture",
  body: RENDERER_FIXTURE,
  resolveImage: async () => ({ width: 1200, height: 630 }),
}).then((result) => result.html);

// Scope first: a failed render would narrow the sweep.
ok(
  "the renderer fixture produced markup for the selector sweep",
  renderedMarkup.length > 0 && /<section[^>]*class="footnotes"/.test(renderedMarkup),
  `the shared renderer emitted ${renderedMarkup.length} byte(s) and no footnotes ` +
    `section. Either the fixture stopped exercising remark-gfm, or the pipeline ` +
    `stopped emitting the markup this sweep is about to search.`,
);
sourceBlobs.push(renderedMarkup);

/** Identifiers worth checking, out of a selector. Short ones are too generic. */
function selectorTokens(/** @type {string} */ selector) {
  return (selector.match(/[A-Za-z][\w-]{3,}/g) ?? []).filter(
    (token, index, all) => all.indexOf(token) === index,
  );
}

let fallbacksNamed = 0;
let selectorTokensChecked = 0;
const kindCounts = { route: 0, selector: 0, none: 0 };

for (const entry of inventory) {
  const id = String(entry.id ?? "(unnamed)");
  const kind = String(entry.fallbackKind ?? "");

  ok(
    `enhancements ${id}: names a fallback`,
    typeof entry.fallback === "string" && entry.fallback.trim().length > 0,
    "hard rule 9: an enhancement with no named fallback is a dependency, not an enhancement",
  );
  if (typeof entry.fallback === "string" && entry.fallback.trim().length > 0) {
    fallbacksNamed += 1;
  }

  ok(
    `enhancements ${id}: fallbackKind is one this gate can verify`,
    kind === "route" || kind === "selector" || kind === "none",
    `${JSON.stringify(kind)} is not route, selector or none`,
  );

  if (kind === "route") {
    kindCounts.route += 1;
    const path = String(entry.fallbackAt ?? "");
    ok(
      `enhancements ${id}: the fallback route ${path} is declared`,
      routes.has(path),
      `routes.ts declares no ${path}, so the fallback points at nothing`,
    );
  } else if (kind === "selector") {
    kindCounts.selector += 1;
    const selector = String(entry.fallbackAt ?? "");
    const tokens = selectorTokens(selector);
    // No checkable token would mean examining nothing.
    ok(
      `enhancements ${id}: the selector ${selector} yields a checkable identifier`,
      tokens.length > 0,
      `nothing in ${JSON.stringify(selector)} is long enough to search for without ` +
        `matching half the tree`,
    );
    for (const token of tokens) {
      selectorTokensChecked += 1;
      // DELIMITED, so `prose` cannot be satisfied by `proseWidth`.
      const needle = new RegExp(
        `(^|[^\\w-])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w-]|$)`,
      );
      ok(
        `enhancements ${id}: ${token} is server-rendered, outside app/enhance/`,
        sourceBlobs.some((blob) => needle.test(blob)),
        `${token} appears as a whole token in NONE of the ${serverSources.length} ` +
          `.ts/.tsx/.mjs file(s) under app/ outside app/enhance/ (comments stripped), ` +
          `and the shared renderer does not emit it either. Markup the enhancement ` +
          `creates for itself is not a fallback, and neither is a class named only ` +
          `by a stylesheet or a comment.`,
      );
    }
  } else if (kind === "none") {
    kindCounts.none += 1;
    ok(
      `enhancements ${id}: a fallback of nothing carries its reason`,
      typeof entry.why === "string" && entry.why.trim().length > 0,
      "the law requires the nothing to be WRITTEN DOWN, because that is what " +
        "distinguishes a decision from an omission",
    );
  }
}

console.log(
  `     ${inventory.length} enhancement(s) over ${inventoryModules.size} module(s), ` +
    `${fallbacksNamed} fallback(s) named`,
);
console.log(
  `     kinds: ${kindCounts.route} route, ${kindCounts.selector} selector ` +
    `(${selectorTokensChecked} identifier(s) checked), ${kindCounts.none} deliberate nothing`,
);
// Printed so its floor can be re-measured.
console.log(
  `     ${serverSources.length} server-rendered file(s) searched, excluding app/enhance/`,
);
console.log(
  `     NOT asserted here: that any route is server-complete with script off. ` +
    `That is a claim about the wire (hard rule 7).`,
);

/* coverage report */

/* Reported, not failed: failing would invite filler prose. */
const unreferenced = [...gates.keys()]
  .filter((name) => !referencedGates.has(name))
  .sort();

console.log(
  `  ${features.length} feature(s), ${anchorCount} anchor(s), ${verified} verifiable, ` +
    `${routes.size} route(s) parsed, ${gates.size} gate(s) known`,
);
if (unreferenced.length > 0) {
  console.log(
    `  REPORT  ${unreferenced.length} gate(s) no feature references: ${unreferenced.join(", ")}`,
  );
} else {
  console.log("  every gate is referenced by at least one feature");
}

/* The projects roster; parity catches a roster edited without a rebuild. */
console.log("\n  projects roster");

const projectsDoc = JSON.parse(readFileSync(PROJECTS_PATH, "utf8"));
const projects = projectsDoc.projects ?? [];
const vocabulary = projectsDoc.stackVocabulary ?? [];
const projectsChecksBefore = checks;

/* Metric inputs, from the artifacts that own them; no expected value (hard rule 10). */
const METRIC_INPUTS = {
  stack: JSON.parse(
    readFileSync(join(root, "content", "generated", "stack.json"), "utf8"),
  ),
  phageYears: PHAGE_YEARS,
};

// Fail closed: an empty roster passes every loop below.
const MINIMUM_PROJECTS = 5;
/* A scope floor over a growing set; see check-tests.mjs. */
const projectsBreach = assertFloor(
  "check:features",
  "projects",
  projects.length,
  MINIMUM_PROJECTS,
  "A shorter list means the file was truncated, not curated.",
);
ok("the roster is non-empty", projectsBreach === null, projectsBreach ?? "");
ok(
  "the stack vocabulary is non-empty",
  vocabulary.length > 0,
  "an empty vocabulary would make every tag check pass vacuously",
);

// The route the roster describes must exist, and it must be the one the page
// module names, not a string typed here.
ok(
  `routes.ts declares ${PROJECTS_URL}`,
  routes.has(PROJECTS_URL),
  `parsed routes: ${[...routes].join(", ")}`,
);

const REQUIRED = [
  "slug",
  "name",
  "oneLiner",
  "description",
  "schemaType",
  "role",
  "status",
  "stack",
  "metric",
];
const STATUSES = ["live", "building", "internal"];
/* Closed: the route shapes structured data for these only. */
const SCHEMA_TYPES = ["SoftwareApplication", "WebPage"];
/* The kinds this gate verifies; the route refuses others. */
const EVIDENCE_KINDS = ["post", "page", "repo"];
const seenSlugs = new Set();

/* The built corpus; a roster edited without a rebuild fails here. */
const artifactPostRows =
  JSON.parse(readFileSync(join(root, "content", "generated", "posts.json"), "utf8")).posts ??
  [];
/** slug to title, PUBLISHED only. A draft citation would link the live site to a 404. */
const publishedTitles = new Map(
  artifactPostRows
    .filter((/** @type {any} */ p) => p.draft !== true)
    .map((/** @type {any} */ p) => [p.slug, p.title]),
);

for (const project of projects) {
  const id = project.slug ?? "(no slug)";

  for (const field of REQUIRED) {
    ok(
      `${id} declares ${field}`,
      project[field] !== undefined && project[field] !== null && project[field] !== "",
      `missing or empty`,
    );
  }

  ok(`${id} has a unique slug`, !seenSlugs.has(project.slug), "duplicated in the roster");
  seenSlugs.add(project.slug);

  ok(
    `${id} status is one of ${STATUSES.join(", ")}`,
    STATUSES.includes(project.status),
    `got ${project.status}`,
  );

  // Nullable by design; a value must pass the imported rule-6 predicate.
  for (const field of ["url", "repo"]) {
    const value = project[field];
    if (value === null || value === undefined) continue;
    ok(
      `${id} ${field} passes the URL protocol allowlist`,
      isAllowedUrl(String(value)),
      `${value} is not an allowed protocol (rule 6)`,
    );
  }

  const stack = Array.isArray(project.stack) ? project.stack : [];
  ok(`${id} declares at least one stack tag`, stack.length > 0);
  for (const tag of stack) {
    ok(
      `${id} stack tag is in the closed vocabulary: ${tag}`,
      vocabulary.includes(tag),
      `not in stackVocabulary`,
    );
  }

  ok(
    `${id} schemaType is one of ${SCHEMA_TYPES.join(", ")}`,
    SCHEMA_TYPES.includes(project.schemaType),
    `got ${JSON.stringify(project.schemaType)}; the route emits this as the item's ` +
      `@type and branches on it, so an unknown value is structured data nobody designed`,
  );

  /* Stored or derived, never both (hard rule 17: one owner). */
  const metric = project.metric ?? {};
  ok(`${id} metric has a label`, typeof metric.label === "string" && metric.label.length > 0);

  const isDerived = metric.derived !== undefined;
  ok(
    `${id} metric declares a value or a derivation, never both`,
    isDerived !== (metric.value !== undefined),
    isDerived && metric.value !== undefined
      ? `it declares both, so two things own how fresh this number is`
      : `it declares neither, so the card has no number to lead with`,
  );

  if (isDerived) {
    ok(
      `${id} metric names a derivation that exists`,
      Object.hasOwn(METRIC_DERIVATIONS, metric.derived),
      `got ${JSON.stringify(metric.derived)}; METRIC_DERIVATIONS implements ` +
        `${Object.keys(METRIC_DERIVATIONS).join(", ")}`,
    );
    ok(
      `${id} metric carries no asOf date, because a derived value cannot rot`,
      metric.asOf === undefined,
      `a date beside a value this build recomputed records when a human last ` +
        `looked, which is the tense-bound claim rule 17 was extended to cover`,
    );
    /* Runs the route's derivation: producible, not a placeholder. */
    if (Object.hasOwn(METRIC_DERIVATIONS, metric.derived)) {
      const derivedValue = metricValue(metric, METRIC_INPUTS);
      ok(
        `${id} metric derives a non-empty value: ${metric.derived}`,
        typeof derivedValue === "string" && derivedValue.length > 0 && derivedValue !== "0",
        `derived ${JSON.stringify(derivedValue)}; zero or empty means the input ` +
          `collection is gone, and the card would render a number that is really an absence`,
      );
    }
  } else {
    ok(
      `${id} metric has a value`,
      typeof metric.value === "string" && metric.value.length > 0,
    );
    ok(
      `${id} metric carries an ISO asOf date`,
      typeof metric.asOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(metric.asOf),
      `got ${JSON.stringify(metric.asOf)}; a number without a date is the thing this page refuses`,
    );
  }

  /* Optional; two or three sentences when present. */
  if (project.notable !== undefined) {
    const notable = Array.isArray(project.notable) ? project.notable : [];
    ok(
      `${id} notable carries two or three sentences`,
      notable.length >= 2 && notable.length <= 3,
      `${notable.length} present; the field is optional, so an entry with nothing ` +
        `derivable omits it rather than padding it`,
    );
    for (const [index, point] of notable.entries()) {
      ok(
        `${id} notable[${index}] is a non-empty string`,
        typeof point === "string" && point.trim().length > 0,
      );
    }
  }

  /* Optional; every entry verified against its owner. */
  if (project.evidence !== undefined) {
    const evidence = Array.isArray(project.evidence) ? project.evidence : [];
    ok(
      `${id} evidence is non-empty when declared`,
      evidence.length > 0,
      `an empty list renders nothing and means nothing; omit the field instead`,
    );
    const seenRefs = new Set();
    for (const item of evidence) {
      const ref = String(item?.ref ?? "(no ref)");
      ok(
        `${id} evidence ${ref} declares a known kind`,
        EVIDENCE_KINDS.includes(item?.kind),
        `got ${JSON.stringify(item?.kind)}; the route throws on anything but ` +
          `${EVIDENCE_KINDS.join(", ")}`,
      );
      ok(
        `${id} evidence ${ref} carries a label`,
        typeof item?.label === "string" && item.label.trim().length > 0,
        `a citation with no label renders as a link with no text`,
      );
      ok(
        `${id} evidence ${ref} is cited once`,
        !seenRefs.has(`${item?.kind}:${ref}`),
        `duplicated within this card, which the route would render as two ` +
          `identical links and React would key identically`,
      );
      seenRefs.add(`${item?.kind}:${ref}`);

      if (item?.kind === "post") {
        ok(
          `${id} evidence cites a published post: ${ref}`,
          publishedTitles.has(ref),
          `no published post has that slug. A draft or a typo here is a link to ` +
            `a page the live site does not serve.`,
        );
        /* Must equal the post's title; a stale one would still link. */
        if (publishedTitles.has(ref)) {
          ok(
            `${id} evidence label matches the post's title: ${ref}`,
            item.label === publishedTitles.get(ref),
            `card says ${JSON.stringify(item.label)}, the corpus says ` +
              `${JSON.stringify(publishedTitles.get(ref))}`,
          );
        }
      }

      if (item?.kind === "page") {
        ok(
          `${id} evidence cites a declared route: ${ref}`,
          routes.has(ref),
          `routes.ts declares no such path, so this citation is a link to nothing. ` +
            `parsed: ${[...routes].join(", ")}`,
        );
      }

      if (item?.kind === "repo") {
        ok(
          `${id} evidence repo passes the URL protocol allowlist: ${ref}`,
          isAllowedUrl(ref),
          `not an allowed protocol (rule 6)`,
        );
      }
    }
  }
}

// Closed both ways: an unused term stops meaning anything.
for (const term of vocabulary) {
  ok(
    `vocabulary term is used by at least one project: ${term}`,
    projects.some((/** @type {any} */ p) => (p.stack ?? []).includes(term)),
    `nothing declares it`,
  );
}

/* The route must read the roster and derive anchors from the shared helper. */
/* Hard rule 17 on roster prose; evidence and metric labels are exempt. */
{
  const PROJECT_PROSE_FIELDS = ["oneLiner", "description"];
  let projectFieldsScanned = 0;
  /** @type {string[]} */
  const projectNumbers = [];

  for (const project of projects) {
    const id = project.slug ?? "(no slug)";
    const texts = [
      ...PROJECT_PROSE_FIELDS.map((field) => [field, String(project[field] ?? "")]),
      ...(project.notable ?? []).map((/** @type {string} */ point, /** @type {number} */ i) => [
        `notable[${i}]`,
        String(point),
      ]),
    ];
    for (const [field, text] of texts) {
      if (!text) continue;
      projectFieldsScanned += 1;
      for (const run of withoutIdentifiers(text).match(/[0-9]+/g) ?? []) {
        projectNumbers.push(`${id} (${field}): "${run}"`);
      }
    }
  }

  /* Floored under measured; notable sentences move the count. */
  ok(
    "the roster prose scan had fields to read",
    projectFieldsScanned >= 14,
    `scanned ${projectFieldsScanned} field(s), floor 14, measured 23 on 2026-08-30. ` +
      `Two per project is the floor even with every notable list removed; below ` +
      `that the roster itself did not parse and this reports a clean sweep of nothing.`,
  );
  ok(
    "no roster sentence carries a number outside the metric channel",
    projectNumbers.length === 0,
    `${projectNumbers.join("; ")}. Hard rule 17: this page has exactly one place ` +
      `for a number, the metric, and it carries a date or a derivation beside it.`,
  );
}

const projectsSource = stripped(readFileSync(PROJECTS_ROUTE_PATH, "utf8"));
ok(
  "the page imports the roster rather than restating it",
  /import\s+projectsData\s+from\s+["'][^"']*content\/projects\.json["']/.test(projectsSource),
  "app/routes/projects.tsx must read content/projects.json",
);
ok(
  "the page derives card anchors from projectAnchor",
  /projectAnchor\(/.test(projectsSource) &&
    /from\s+["']~\/lib\/projects-page\.mjs["']/.test(projectsSource),
  "anchors must come from the module the indexer uses, or a record can cite a fragment nothing renders",
);

/* Asserted on code: a field nothing renders passes every shape check. */
ok(
  "the page computes derived metrics through metricValue",
  /metricValue\(/.test(projectsSource),
  "app/routes/projects.tsx must call the shared derivation, or a derived metric " +
    "renders as undefined and the gate above is checking a value nobody sees",
);
ok(
  "the page does not implement a derivation itself",
  !/METRIC_DERIVATIONS/.test(projectsSource),
  "the route names METRIC_DERIVATIONS, so it holds a second way to compute a value " +
    "the shared function already owns",
);
ok(
  "the page renders the notable list",
  /project\.notable/.test(projectsSource),
  "the manifest carries notable sentences the page never reads",
);
ok(
  "the page renders the evidence list",
  /project\.evidence/.test(projectsSource),
  "the manifest carries citations the page never reads",
);
ok(
  "the page emits the declared schema type rather than a literal",
  /"@type":\s*project\.schemaType/.test(projectsSource) &&
    !/"@type":\s*"SoftwareApplication"/.test(projectsSource),
  "the item's @type must come from the entry, or the roster page is emitted as an " +
    "application again and the field is decoration",
);
/* Unbranched, a derived metric renders an empty `<time>`. */
ok(
  "the page renders a provenance line for both metric forms",
  /metric\.derived\s*!==\s*undefined/.test(projectsSource) &&
    /dateTime=\{metric\.asOf\}/.test(projectsSource),
  "both branches must be present: a derived metric says it was derived, a dated " +
    "one renders its <time>",
);

/* Parity both ways: catches a roster edited without a rebuild. */
const projectRecords = artifactRecords.filter(
  (/** @type {any} */ r) => r.docUid === "page:projects",
);
ok(
  "the artifact carries project page records",
  projectRecords.length > 0,
  "none found. Run build:content.",
);
ok(
  "the projects page has exactly one document record",
  projectRecords.filter((/** @type {any} */ r) => r.anchor === null).length === 1,
);

const recordAnchors = new Set(
  projectRecords
    .filter((/** @type {any} */ r) => r.anchor !== null)
    .map((/** @type {any} */ r) => String(r.anchor)),
);
for (const project of projects) {
  ok(
    `${project.slug} has a section record in the artifact`,
    recordAnchors.has(projectAnchor(project.slug)),
    `no record anchored ${projectAnchor(project.slug)}. The roster changed without a rebuild.`,
  );
}
const rosterAnchors = new Set(projects.map((/** @type {any} */ p) => projectAnchor(p.slug)));
for (const anchor of recordAnchors) {
  ok(
    `artifact record ${anchor} corresponds to a project in the roster`,
    rosterAnchors.has(anchor),
    `the index describes a project the roster no longer lists`,
  );
}

/* Executed-count floor, measured by running the gate, never by summing. */
const projectsChecks = checks - projectsChecksBefore;
const MINIMUM_PROJECT_CHECKS = 281;
const projectsFloorBreach = assertFloor(
  "check:features",
  "projects-checks",
  projectsChecks,
  MINIMUM_PROJECT_CHECKS,
);
if (projectsFloorBreach) {
  ok("the projects section executed its assertions", false, projectsFloorBreach);
}

console.log(
  `  ${projects.length} project(s), ${vocabulary.length} vocabulary term(s), ` +
    `${projectRecords.length} artifact record(s), ${projectsChecks} assertion(s)`,
);

/*
 * The playground: each demo runs the real module against expectations it did not produce
 * (hard rule 10). A rendered page is verify-live's claim (hard rule 7).
 */
console.log("\n  playground");

const playgroundDoc = JSON.parse(readFileSync(PLAYGROUND_PATH, "utf8"));
const demos = playgroundDoc.demos ?? [];
const deferredDemos = playgroundDoc.deferred ?? [];
const swatches = playgroundDoc.swatches ?? [];
const datasets = playgroundDoc.datasets ?? {};
const keyPresets = playgroundDoc.keyPresets ?? [];
const cookiePresets = playgroundDoc.cookiePresets ?? [];
const snippets = playgroundDoc.markdownSnippets ?? [];
const playgroundChecksBefore = checks;

/** Serialised exactly as check:charts does, so both see the artifact's HTML. */
const serializeHast = (/** @type {any[]} */ children) =>
  unified()
    .use(rehypeStringify)
    .stringify(/** @type {any} */ ({ type: "root", children }));

/** `line` and `area` both emit `<path>`, so the mark group label is asserted too. */
/** @type {Record<string, string>} */
const MARK_ELEMENT = { bar: "rect", line: "path", dot: "circle", area: "path" };

// Fail closed: an empty list passes every loop.
const MINIMUM_DEMOS = 3;
/* Scope floor, as for the roster. */
const demosBreach = assertFloor(
  "check:features",
  "demos",
  demos.length,
  MINIMUM_DEMOS,
  "An empty roster makes every loop below pass by iterating nothing.",
);
ok("the demo roster is non-empty", demosBreach === null, demosBreach ?? "");
ok("swatch presets are declared", swatches.length > 0, "an empty list checks nothing");
ok(
  "chart datasets are declared",
  Object.keys(datasets).length > 0,
  "an empty map checks nothing",
);
ok(
  "key presets are declared",
  keyPresets.length > 0,
  "an empty list makes every behavioural key assertion below iterate nothing",
);
ok(
  "cookie presets are declared",
  cookiePresets.length > 0,
  "an empty list makes every behavioural theme assertion below iterate nothing",
);
ok(
  "markdown snippets are declared",
  snippets.length > 0,
  "an empty list makes every behavioural render assertion below iterate nothing",
);
ok(
  "deferred demos are stated rather than omitted",
  deferredDemos.length > 0,
  "a deferred demo is a stated absence; an empty list means the page claims completeness",
);
ok(
  `routes.ts declares ${PLAYGROUND_URL}`,
  routes.has(PLAYGROUND_URL),
  `parsed routes: ${[...routes].join(", ")}`,
);

const playgroundSource = stripped(readFileSync(PLAYGROUND_ROUTE_PATH, "utf8"));

/* manifest and page */

ok(
  "the page imports the manifest rather than restating it",
  /import\s+playgroundData\s+from\s+["'][^"']*content\/playground\.json["']/.test(
    playgroundSource,
  ),
  "app/routes/playground.tsx must read content/playground.json",
);
ok(
  "the page derives demo anchors from demoAnchor",
  /demoAnchor\(/.test(playgroundSource) &&
    /from\s+["']~\/lib\/playground-page\.mjs["']/.test(playgroundSource),
  "anchors must come from the module the indexer uses, or a record can cite a fragment nothing renders",
);
ok(
  "the page takes its presets and fixtures from the manifest",
  /playgroundData\.swatches/.test(playgroundSource) &&
    /playgroundData\.datasets/.test(playgroundSource) &&
    /playgroundData\.keyPresets/.test(playgroundSource),
  "if the route restated them, the behavioural checks below would be checking a copy of the input",
);
/* Keyed by slug: a position index shifts headers while list checks stay green. */
ok(
  "demo headers are keyed by slug rather than by list position",
  /<DemoHeader\s+slug=/.test(playgroundSource) && !/<DemoHeader\s+index=/.test(playgroundSource),
  "a positional header couples the page's order to the manifest's, and a demo " +
    "inserted in the middle silently retitles every section under it",
);

const renderedAnchors = new Set(
  [...playgroundSource.matchAll(/demoAnchor\(\s*["']([\w-]+)["']\s*\)/g)].map((m) => m[1]),
);
ok(
  "the page renders at least one demo section",
  renderedAnchors.size > 0,
  "no demoAnchor(...) literals found, so the reverse direction would pass vacuously",
);
for (const demo of demos) {
  ok(
    `${demo.slug} is rendered by the page`,
    renderedAnchors.has(demo.slug),
    `the manifest declares it and the page renders no demoAnchor("${demo.slug}")`,
  );
}
const manifestSlugs = new Set(demos.map((/** @type {any} */ d) => d.slug));
for (const anchor of renderedAnchors) {
  ok(
    `page section ${anchor} is declared in the manifest`,
    manifestSlugs.has(anchor),
    "the page renders it and the manifest omits it, so it is unindexed",
  );
}

// The chart demo's enum is the RENDERER's list, argued both directions.
const chartDemo = demos.find((/** @type {any} */ d) => d.slug === "chart-options");
ok("the chart demo is declared", Boolean(chartDemo), "the enum checks below need it");
if (chartDemo) {
  const inputs = chartDemo.inputs ?? [];
  const markInput = inputs.find((/** @type {any} */ i) => i.name === "mark");
  const dataInput = inputs.find((/** @type {any} */ i) => i.name === "data");
  ok("the chart demo declares a mark input", Boolean(markInput));
  ok("the chart demo declares a dataset input", Boolean(dataInput));
  for (const value of markInput?.values ?? []) {
    ok(
      `manifest mark "${value}" is a real CHART_TYPE`,
      CHART_TYPES.includes(value),
      `the renderer accepts ${CHART_TYPES.join(", ")}`,
    );
  }
  for (const type of CHART_TYPES) {
    ok(
      `CHART_TYPE "${type}" is offered by the demo`,
      (markInput?.values ?? []).includes(type),
      "the renderer supports it and the manifest omits it",
    );
  }
  for (const value of dataInput?.values ?? []) {
    ok(
      `manifest dataset "${value}" is defined`,
      Object.hasOwn(datasets, value),
      "the enum offers it and no dataset defines it",
    );
  }
  for (const key of Object.keys(datasets)) {
    ok(
      `dataset "${key}" is reachable from the form`,
      (dataInput?.values ?? []).includes(key),
      "defined and not offered by the enum",
    );
  }
}

/* Demos cite published articles; a draft link is a missing page. */
ok(
  "the artifact carries published posts",
  publishedTitles.size > 0,
  "otherwise the citation checks below pass vacuously",
);
for (const demo of demos) {
  ok(
    `${demo.slug} cites a published article`,
    publishedTitles.has(demo.homeArticle?.slug),
    `homeArticle ${JSON.stringify(demo.homeArticle?.slug)} is not a published post`,
  );
}

/* contrast lab */

for (const swatch of swatches) {
  const actual = contrast(swatch.fg, swatch.bg);
  ok(
    `contrast lab: ${swatch.label} computes ${swatch.ratio} to 1`,
    Math.abs(actual - swatch.ratio) < 0.05,
    `app/lib/contrast.mjs returned ${actual.toFixed(2)}, design-tokens.md records ${swatch.ratio}`,
  );
  const expectedVerdict = swatch.ratio >= 4.5;
  ok(
    `contrast lab: ${swatch.label} AA normal-text verdict is ${expectedVerdict ? "Pass" : "Fail"}`,
    (actual >= 4.5) === expectedVerdict,
    "the module and the recorded ratio disagree across the 4.5 to 1 threshold",
  );
}
// Lc is signed, so polarity is asserted both ways.
ok(
  "contrast lab: APCA is positive for dark text on a light ground",
  apca("#2B2320", "#FAF7F2") > 0,
  "polarity dropped; the sign is the only thing distinguishing the two cases",
);
ok(
  "contrast lab: APCA is negative for light text on a dark ground",
  apca("#E3DBD0", "#1A1614") < 0,
  "polarity reversed or dropped",
);

/* fusion arithmetic */

// Fixture lists, real fuse(). "a" ranks 1 in both layers, "c" ranks 2 in one.
const fusionFixture = fuse([
  [{ uid: "a" }, { uid: "b" }],
  [{ uid: "a" }, { uid: "c" }],
]);
ok("search anatomy: k is 60", RRF_K === 60, `RRF_K is ${RRF_K}`);
const rowA = fusionFixture.find((/** @type {any} */ r) => r.item.uid === "a");
const rowC = fusionFixture.find((/** @type {any} */ r) => r.item.uid === "c");
ok("search anatomy: the fixture produces a row for the doc in both layers", Boolean(rowA));
ok("search anatomy: the fixture produces a row for the doc in one layer", Boolean(rowC));
if (rowA && rowC) {
  const oneOverSixtyOne = 1 / 61;
  ok(
    "search anatomy: rank 1 contributes 1/61",
    Math.abs(rowA.contributions[0] - oneOverSixtyOne) < 1e-12,
    `got ${rowA.contributions[0]}`,
  );
  ok(
    "search anatomy: a doc in both layers records both ranks",
    rowA.ranks.length === 2 && rowA.ranks[0] === 1 && rowA.ranks[1] === 1,
    `ranks ${JSON.stringify(rowA.ranks)}`,
  );
  ok(
    "search anatomy: the fused total is the sum of the contributions",
    Math.abs(rowA.score - oneOverSixtyOne * 2) < 1e-12,
    `score ${rowA.score}`,
  );
  ok(
    "search anatomy: sources, ranks and contributions stay parallel",
    rowC.sources.length === 1 && rowC.ranks.length === 1 && rowC.contributions.length === 1,
    "a length mismatch would render a value against the wrong layer",
  );
  // The exact strings toFixed(5) renders.
  ok(
    "search anatomy: rank 1 renders as 0.01639",
    rowA.contributions[0].toFixed(5) === "0.01639",
    `renders ${rowA.contributions[0].toFixed(5)}`,
  );
  ok(
    "search anatomy: the two-layer fused total renders as 0.03279",
    rowA.score.toFixed(5) === "0.03279",
    `renders ${rowA.score.toFixed(5)}`,
  );
  ok(
    "search anatomy: rank 2 in one layer renders as 0.01613",
    rowC.score.toFixed(5) === "0.01613",
    `renders ${rowC.score.toFixed(5)}`,
  );
}
/* The page reads the decomposition, never computes it; asserted on code, not JSX text. */
ok(
  "search anatomy: the page reads the per-layer contribution",
  /identityContribution/.test(playgroundSource),
  "the table must render what fuse() recorded",
);
ok(
  "search anatomy: the page does not own the fusion constant",
  !/RRF_K/.test(playgroundSource),
  "app/routes/playground.tsx imports RRF_K, so it holds a second copy of k",
);
ok(
  "search anatomy: the page does not divide by a literal k",
  !/1\s*\/\s*\(\s*60/.test(playgroundSource),
  "a literal 1/(60 + ...) in the route is the fusion rule implemented twice",
);
ok(
  "search anatomy: k is rendered from the payload",
  /explain\.k/.test(playgroundSource),
  "the caption's k must come from the fused result, not from a number typed here",
);
ok(
  "search anatomy: the page requests the decomposition explicitly",
  /explain:\s*true/.test(playgroundSource),
  "without the flag the table would have nothing to render",
);
ok(
  "search anatomy: the caption states that cross-index values are not comparable",
  /not\s+comparable/.test(playgroundSource) && /bm25/.test(playgroundSource),
  "the sentence explaining why fusion is over ranks is the answer to why there is no score column",
);

/* media key grammar */

/* Hand-written expectations (hard rule 10's fixture independence). */
for (const preset of keyPresets) {
  const label = preset.label ?? preset.key;
  const expect = preset.expect ?? {};

  ok(
    `media key: ${label} declares a key`,
    typeof preset.key === "string" && preset.key.length > 0,
  );
  ok(
    `media key: ${label} declares a note`,
    typeof preset.note === "string" && preset.note.trim().length > 0,
    "each preset's note is what the reader gets instead of a table of booleans",
  );

  ok(
    `media key: ${label} isContentKey is ${expect.contentKey}`,
    isContentKey(preset.key) === expect.contentKey,
    `the module says ${isContentKey(preset.key)}`,
  );
  ok(
    `media key: ${label} digest is ${JSON.stringify(expect.digest)}`,
    digestFromKey(preset.key) === expect.digest,
    `the module says ${JSON.stringify(digestFromKey(preset.key))}`,
  );

  const measured = dimensionsFromKey(preset.key);
  const measuredText = measured ? `${measured.width}x${measured.height}` : null;
  ok(
    `media key: ${label} dimensions are ${JSON.stringify(expect.dimensions)}`,
    measuredText === expect.dimensions,
    `the module says ${JSON.stringify(measuredText)}`,
  );

  ok(
    `media key: ${label} storage tier is ${expect.storage}`,
    storageOf(preset.key) === expect.storage,
    `the module says ${storageOf(preset.key)}`,
  );
  ok(
    `media key: ${label} role is ${expect.role}`,
    roleOf(preset.key) === expect.role,
    `the module says ${roleOf(preset.key)}`,
  );

  /* "refused" is an answer, so the throw branch runs. */
  let actualKind;
  try {
    actualKind = classify(preset.key).kind;
  } catch {
    actualKind = "refused";
  }
  ok(
    `media key: ${label} classifies as ${expect.kind}`,
    actualKind === expect.kind,
    `the module says ${actualKind}`,
  );

  ok(
    `media key: ${label} isRaster is ${expect.raster}`,
    isRaster(preset.key) === expect.raster,
    `the module says ${isRaster(preset.key)}`,
  );
  ok(
    `media key: ${label} cropSafe is ${expect.cropSafe}`,
    cropSafe(preset.key) === expect.cropSafe,
    `the module says ${cropSafe(preset.key)}`,
  );
}

/* Presets must cover every branch. */
const presetKinds = new Set(keyPresets.map((/** @type {any} */ p) => p.expect?.kind));
const presetStorage = new Set(keyPresets.map((/** @type {any} */ p) => p.expect?.storage));
const presetRoles = new Set(keyPresets.map((/** @type {any} */ p) => p.expect?.role));
ok(
  "media key: a preset exercises the classifier's refusal",
  presetKinds.has("refused"),
  "without one, the throw branch is never entered and the fail-closed design is untested",
);
ok(
  "media key: a preset exercises each storage tier",
  ["static", "r2", "r2-derived"].every((tier) => presetStorage.has(tier)),
  `covered: ${[...presetStorage].join(", ")}`,
);
ok(
  "media key: presets exercise more than one role",
  presetRoles.size >= 2,
  `covered: ${[...presetRoles].join(", ")}`,
);
ok(
  "media key: a preset carries a dimension segment and another does not",
  keyPresets.some((/** @type {any} */ p) => p.expect?.dimensions !== null) &&
    keyPresets.some((/** @type {any} */ p) => p.expect?.dimensions === null),
  "the optional segment is the part of the grammar that drifted, so both forms " +
    "have to be present or the pin is on the easy half",
);

/* key demo wiring */

ok(
  "media key: the page imports the grammar's readers",
  /from\s+["']~\/lib\/media\/classify\.mjs["']/.test(playgroundSource),
  "the demo must run the module, not a parser written here",
);
ok(
  "media key: the page carries no content-key regex of its own",
  !/\[0-9a-f\]\{16\}/.test(playgroundSource),
  "a second spelling of the grammar in this route is exactly the defect the " +
    "demo exists to describe",
);
ok(
  "media key: the page renders the classifier's refusal rather than swallowing it",
  /classifyRefusal/.test(playgroundSource),
  "a caught throw that renders nothing turns the module's loudest behaviour into " +
    "a blank row",
);
ok(
  "media key: the page states the input cap it enforces",
  /Up to \{KEY_CAP\} characters/.test(playgroundSource),
  "a cap enforced in the loader and unstated in the UI is a silent truncation",
);

/* theme resolver */

/* Real resolver, real request, hand-written expectations. */
for (const preset of cookiePresets) {
  const label = preset.label ?? JSON.stringify(preset.cookie);
  const expect = preset.expect ?? {};

  ok(
    `theme: ${label} declares a cookie header`,
    typeof preset.cookie === "string",
    "the empty string is a legal and important value here; undefined is not",
  );
  ok(
    `theme: ${label} declares a note`,
    typeof preset.note === "string" && preset.note.trim().length > 0,
  );

  /* No header differs from an empty one: the resolver returns early. */
  const request = new Request(
    "https://example.invalid/",
    preset.cookie ? { headers: { cookie: preset.cookie } } : undefined,
  );

  /* A throw is this preset's named failure, and the loop continues. */
  let theme;
  try {
    theme = themeFromRequest(request);
  } catch (error) {
    ok(
      `theme: ${label} resolves without throwing`,
      false,
      `the resolver threw ${error instanceof Error ? error.message : String(error)}. ` +
        `A bad cookie must cost a reader the default theme, never the page, and ` +
        `this function runs on the cache-key path before anything renders.`,
    );
    continue;
  }
  ok(
    `theme: ${label} resolves to ${expect.theme}`,
    theme === expect.theme,
    `the module says ${theme}`,
  );

  const attribute = themeAttribute(theme) ?? null;
  ok(
    `theme: ${label} data-theme is ${JSON.stringify(expect.attribute)}`,
    attribute === expect.attribute,
    `the module says ${JSON.stringify(attribute)}; the ABSENCE is what hands the ` +
      `decision to prefers-color-scheme, so null and a value are different answers`,
  );

  ok(
    `theme: ${label} color-scheme meta is ${JSON.stringify(expect.colorScheme)}`,
    colorSchemeMeta(theme) === expect.colorScheme,
    `the module says ${JSON.stringify(colorSchemeMeta(theme))}`,
  );
}

/* Branch coverage for the resolver. */
const cookieValues = cookiePresets.map((/** @type {any} */ p) => String(p.cookie ?? ""));
ok(
  "theme: a preset sends no cookie at all",
  cookieValues.includes(""),
  "the header-absent branch is the default every first-time reader takes, and it " +
    "is the one an always-send-a-header fixture stops testing",
);
ok(
  "theme: a preset carries the legacy system value",
  cookieValues.some((/** @type {string} */ v) => /(^|;\s*)theme=system(\s*;|$)/.test(v)),
  "those cookies exist in readers' browsers for a year and must keep resolving " +
    "to the no-cookie document, or the two split into separate cache entries",
);
ok(
  "theme: a preset carries a malformed percent escape",
  cookieValues.some((/** @type {string} */ v) => v.includes("%%%")),
  "decoding it raises a URIError on the cache-key path, which was a server error " +
    "on every page for that reader until it was guarded",
);
ok(
  "theme: a preset carries the theme among other cookies",
  cookieValues.some((/** @type {string} */ v) => v.includes(";") && v.includes("theme=")),
  "the header is walked rather than matched whole, and only a multi-cookie " +
    "fixture exercises that",
);
ok(
  "theme: presets cover both writable values",
  ["light", "dark"].every((value) =>
    cookiePresets.some((/** @type {any} */ p) => p.expect?.theme === value),
  ),
  "the endpoint accepts exactly these two and both must resolve",
);

/* theme demo wiring */

/* Word-anchored: a suffixed name contains the shorter one (hard rule 10). */
ok(
  "theme: the page imports the resolver",
  /from\s+["']~\/lib\/theme["']/.test(playgroundSource) &&
    /\bthemeFromRequest\b/.test(playgroundSource),
  "the demo must call the real resolver, not restate its rules",
);
/* The lede's claim about the Worker, checked there (hard rule 7). */
ok(
  "theme: the Worker still resolves the theme through this function",
  /\bthemeFromRequest\b/.test(stripped(readFileSync(join(root, "workers", "app.ts"), "utf8"))),
  "the demo's lede claims workers/app.ts calls it on every request, and it no longer does",
);
ok(
  "theme: the page keys the demo on parameter PRESENCE, not on a non-empty value",
  /params\.has\(["']cookie["']\)/.test(playgroundSource),
  "the empty cookie header is this demo's most important case, and a truthiness " +
    "test would make it unreachable by URL",
);
ok(
  "theme: the page refuses a header shape a browser could not send",
  /PRINTABLE_ASCII/.test(playgroundSource),
  "an unguarded control character makes new Request throw, and a demo whose input " +
    "can crash its own loader answers some readers with a stack trace",
);
ok(
  "theme: the page states the input cap it enforces",
  /Up to \{COOKIE_CAP\} printable characters/.test(playgroundSource),
  "a cap enforced in the loader and unstated in the UI is a silent truncation",
);
ok(
  "theme: the page renders the absent attribute as a word rather than a blank",
  /"omitted"/.test(playgroundSource),
  "an empty cell reads as a bug; the absence IS the answer for a reader on system",
);

/* markdown pipeline */

/* Snippets render through `renderBody`; the image resolver refuses media. */
{
  const refuseImages = async (/** @type {string} */ src) => {
    throw new Error(`the markdown snippets cite no media, and one cites ${src}`);
  };

  for (const snippet of snippets) {
    const label = snippet.label ?? snippet.slug;
    const expect = snippet.expect ?? {};

    ok(
      `markdown: ${label} declares a slug, a source and a note`,
      typeof snippet.slug === "string" &&
        typeof snippet.source === "string" &&
        snippet.source.length > 0 &&
        typeof snippet.note === "string" &&
        snippet.note.trim().length > 0,
    );

    /* On the source: the resolver's throw names the wrong cause. */
    ok(
      `markdown: ${label} cites no media`,
      !/!\[[^\]]*\]\(/.test(snippet.source) && !/\/media\//.test(snippet.source),
      "the demo hands the renderer a resolver that refuses, so a media citation " +
        "would surface as a render failure naming the wrong cause",
    );

    let rendered = null;
    let refusal = null;
    try {
      rendered = await renderBody({
        file: `playground/${snippet.slug}.md`,
        body: snippet.source,
        resolveImage: refuseImages,
      });
    } catch (error) {
      refusal = error instanceof Error ? error.message : String(error);
    }

    ok(
      `markdown: ${label} ${expect.throws ? "is refused" : "renders"}`,
      (refusal !== null) === expect.throws,
      expect.throws
        ? `the pipeline accepted a snippet the demo says it must refuse`
        : `the pipeline refused it: ${refusal}`,
    );

    if (expect.throws) {
      /* A bare throw is not enough; the directive must be named. */
      ok(
        `markdown: ${label} refusal names the unknown directive`,
        typeof refusal === "string" && /unknown directive/i.test(refusal),
        `the message was ${JSON.stringify(refusal)}`,
      );
      continue;
    }
    if (!rendered) continue;

    const anchors = rendered.toc.map((/** @type {any} */ h) => h.id);
    ok(
      `markdown: ${label} collects ${JSON.stringify(expect.toc)}`,
      JSON.stringify(anchors) === JSON.stringify(expect.toc),
      `the pipeline collected ${JSON.stringify(anchors)}`,
    );
    ok(
      `markdown: ${label} demotes ${expect.blockedCount} URL(s)`,
      rendered.blockedUrls.length === expect.blockedCount,
      `the pipeline demoted ${JSON.stringify(
        rendered.blockedUrls.map((/** @type {any} */ b) => b.url),
      )}`,
    );

    /* Escaped text is fine; an attribute is not. */
    for (const blocked of rendered.blockedUrls) {
      ok(
        `markdown: ${label} demotes ${blocked.url} out of every attribute`,
        !new RegExp(`(?:href|src)="[^"]*${blocked.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(
          rendered.html,
        ),
        "the allowlist counted it and the document still carries it as a live URL",
      );
    }
  }

  /* Branches no published article can show. */
  ok(
    "markdown: a snippet is refused outright",
    snippets.some((/** @type {any} */ s) => s.expect?.throws === true),
    "without one, the fail-closed directive branch is never entered",
  );
  ok(
    "markdown: a snippet has a URL demoted",
    snippets.some((/** @type {any} */ s) => (s.expect?.blockedCount ?? 0) > 0),
    "without one, hard rule 6's allowlist is never exercised here",
  );
  ok(
    "markdown: a snippet renders headings into the table of contents",
    snippets.some((/** @type {any} */ s) => (s.expect?.toc ?? []).length > 0),
    "without one, the ordinary path is untested and only the refusals are shown",
  );
}

/* markdown demo wiring */

/* Both links of the chain are asserted. */
const snippetRendererSource = stripped(
  readFileSync(join(root, "app", "lib", "content", "render-snippet.server.ts"), "utf8"),
);
ok(
  "markdown: the page renders through the server wrapper",
  /\brenderSnippet\b/.test(playgroundSource) &&
    /from\s+["']~\/lib\/content\/render-snippet\.server["']/.test(playgroundSource),
  "the demo must go through the wrapper that installs the WASM instantiator",
);
ok(
  "markdown: the wrapper calls the renderer every post goes through",
  /\brenderBody\b/.test(snippetRendererSource) &&
    /from\s+["']\.\/pipeline\.mjs["']/.test(snippetRendererSource),
  "a second renderer here would demonstrate nothing: it would keep working " +
    "while the thing it claims to show was broken",
);
ok(
  "markdown: the wrapper loads the Worker's WASM instantiator",
  /\.\/wasm\.server/.test(snippetRendererSource),
  "without it the highlighter cannot start in a Worker, and the demo answers " +
    "every reader with a render failure",
);
ok(
  "markdown: the wrapper's image resolver refuses",
  /resolveImage:\s*async/.test(snippetRendererSource) && /throw new Error/.test(snippetRendererSource),
  "a resolver that reached a bucket on behalf of fixture text is a door this " +
    "demo has no reason to open",
);
/* The loader picks from manifest slugs, never a body from the URL. */
ok(
  "markdown: the snippet is chosen from the manifest, never taken from the URL",
  /SNIPPET_SLUGS\.includes\(/.test(playgroundSource),
  "an unbounded body reaching renderBody is the surface the deferred entry " +
    "says needs a threat model first",
);
ok(
  "markdown: the loader passes no request text to the renderer",
  !/body:\s*(?:md|mdParam|params\.get)/.test(playgroundSource),
  "the renderer's body must come from a committed snippet and nothing else",
);
ok(
  "markdown: the page reports an unknown snippet rather than silently correcting",
  /Unknown snippet/.test(playgroundSource),
  "a hand-edited URL must say what happened, the same rule the chart demo follows",
);
/* A shipped neighbour does not complete the deferred entry. */
ok(
  "markdown: the free-text form is still stated as deferred",
  deferredDemos.some(
    (/** @type {any} */ d) =>
      /markdown/i.test(d.slug ?? "") && /threat model/i.test(d.reason ?? ""),
  ),
  "the fixed-snippet demo shipping does not settle arbitrary text into the " +
    "highlighter, and the page must keep saying so",
);

/* chart renderer */

for (const [key, dataset] of Object.entries(datasets)) {
  for (const type of CHART_TYPES) {
    let svg = "";
    try {
      const model = buildChartModel(
        {
          type,
          x: dataset.x,
          y: dataset.y,
          ...(dataset.labels ? { labels: dataset.labels } : {}),
          title: dataset.title,
          alt: `${type} chart. ${dataset.alt}`,
        },
        dataset.csv,
      );
      svg = serializeHast(renderChartHast(model, []));
    } catch (error) {
      ok(
        `chart options: ${key}/${type} renders without throwing`,
        false,
        String(error instanceof Error ? error.message : error),
      );
      continue;
    }

    ok(`chart options: ${key}/${type} emits an svg`, /<svg[\s>]/.test(svg));
    ok(
      `chart options: ${key}/${type} labels the mark group "${type}"`,
      new RegExp(`<g[^>]*aria-label="${type}"`).test(svg),
      "the requested mark type did not reach the renderer",
    );
    const element = MARK_ELEMENT[type];
    ok(
      `chart options: ${key}/${type} draws a <${element}>`,
      new RegExp(`<${element}[\\s>]`).test(svg),
      `no <${element}> in the output`,
    );
    ok(
      `chart options: ${key}/${type} carries role="img" on the svg`,
      /<svg[^>]*role="img"/.test(svg),
      "the accessible role belongs on the svg, never on the figure",
    );
    ok(
      `chart options: ${key}/${type} carries a non-empty accessible name`,
      /<svg[^>]*aria-label="[^"]+"/.test(svg),
    );
    ok(
      `chart options: ${key}/${type} emits the data table`,
      /class="chart-data"/.test(svg) && /<table/.test(svg),
      "the text equivalent is mandatory for every chart",
    );
    // check:contrast never reads this SVG.
    ok(
      `chart options: ${key}/${type} contains no hex colour literal`,
      !/#[0-9a-fA-F]{6}\b/.test(svg),
      `found ${(svg.match(/#[0-9a-fA-F]{6}\b/g) ?? []).join(", ")}`,
    );
    ok(
      `chart options: ${key}/${type} colours from chart tokens`,
      /var\(--chart-/.test(svg),
      "series colours must be custom properties so one render serves both themes",
    );
  }
}

/* copy law */

ok(
  "the lab names WCAG 2.2 as the conformance target",
  /WCAG 2\.2/.test(playgroundSource),
  "the ratio is the conformance number and the page must say which standard it is",
);
ok(
  "the lab labels APCA as not part of any standard",
  /not part of any standard/.test(playgroundSource),
  "Lc is advisory and the page must not imply otherwise",
);
ok(
  "the page states the input cap it enforces",
  /up to \{QUERY_CAP\} characters|up to 100 characters/i.test(playgroundSource),
  "a cap enforced in the loader and unstated in the UI is a silent truncation",
);
/* The claim is that Cache-Control is set, by helper or constant. */
ok(
  "the route sets an explicit Cache-Control",
  /publicHtmlHeaders|SHARED_CACHE_CONTROL/.test(playgroundSource) &&
    /export function headers/.test(playgroundSource),
  "hard rule 8: with the Workers cache on, no header means CACHED rather than skipped",
);
// The page's own law. A result that depended on anything but the query string
// would stop being a shareable URL.
ok(
  "the page renders no wall-clock timing",
  !/tookMs/.test(playgroundSource),
  "a timing readout is the one value that differs between two fetches of one URL",
);

/* artifact parity */

const playgroundRecords = artifactRecords.filter(
  (/** @type {any} */ r) => r.docUid === "page:playground",
);
ok(
  "the artifact carries playground page records",
  playgroundRecords.length > 0,
  "none found. Run build:content.",
);
ok(
  "the playground page has exactly one document record",
  playgroundRecords.filter((/** @type {any} */ r) => r.anchor === null).length === 1,
);
const playgroundRecordAnchors = new Set(
  playgroundRecords
    .filter((/** @type {any} */ r) => r.anchor !== null)
    .map((/** @type {any} */ r) => String(r.anchor)),
);
for (const demo of demos) {
  ok(
    `${demo.slug} has a section record in the artifact`,
    playgroundRecordAnchors.has(demoAnchor(demo.slug)),
    `no record anchored ${demoAnchor(demo.slug)}. The manifest changed without a rebuild.`,
  );
}
const manifestAnchors = new Set(demos.map((/** @type {any} */ d) => demoAnchor(d.slug)));
for (const anchor of playgroundRecordAnchors) {
  ok(
    `artifact record ${anchor} corresponds to a demo in the manifest`,
    manifestAnchors.has(anchor),
    "the index describes a demo the manifest no longer lists",
  );
}

/* Measured by running the section, never by summing. */
const playgroundChecks = checks - playgroundChecksBefore;
const MINIMUM_PLAYGROUND_CHECKS = 294;
const playgroundFloorBreach = assertFloor(
  "check:features",
  "playground-checks",
  playgroundChecks,
  MINIMUM_PLAYGROUND_CHECKS,
  "This count steps sharply per demo: it was 278 before the markdown demo, 226 " +
    "before the theme demo and 142 before the key demo.",
);
if (playgroundFloorBreach) {
  ok("the playground section executed its assertions", false, playgroundFloorBreach);
}

console.log(
  `  ${demos.length} demo(s), ${Object.keys(datasets).length} dataset(s), ` +
    `${swatches.length} swatch(es), ${keyPresets.length} key preset(s), ` +
    `${cookiePresets.length} cookie preset(s), ${snippets.length} snippet(s), ` +
    `${deferredDemos.length} deferred, ` +
    `${playgroundRecords.length} artifact record(s), ${playgroundChecks} assertion(s)`,
);

/* Whole-gate floor: section floors cannot see another section stopping. */
/* Within the tolerance `scripts/check-floors.mjs` owns; re-measure by running the gate. */
const MINIMUM_CHECKS = 913;
const floorBreach = assertFloor(
  "check:features",
  "checks",
  checks,
  MINIMUM_CHECKS,
  "A SECTION was skipped rather than failing.",
);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
