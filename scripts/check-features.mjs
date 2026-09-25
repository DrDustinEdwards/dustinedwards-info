// Routes are read by importing app/routes.ts and walking its children, so a nested route is known by
// its full path (/admin/tools) and never by its child segment alone (/tools).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
import { PHAGE_YEARS } from "../app/data/phage-hunters.ts";
import { isAllowedUrl, renderBody } from "../app/lib/content/pipeline.mjs";
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
import { colorSchemeMeta, themeAttribute, themeFromRequest } from "../app/lib/theme.ts";
import { apca, contrast } from "../app/lib/contrast.mjs";
import { RRF_K, fuse } from "../app/lib/search/query.mjs";
import { stripComments, stripTsxComments } from "./lib/strip-comments.mjs";
import { functionBody } from "./lib/source-body.mjs";
import {
  CHART_TYPES,
  buildChartModel,
  renderChartHast,
} from "../app/lib/content/chart.mjs";
import { assertFloor } from "./lib/floor.mjs";
import { createTally } from "./lib/tally.mjs";
import { readArtifact } from "./lib/artifact.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEATURES_PATH = join(root, "content", "features.json");
const PROJECTS_PATH = join(root, "content", "projects.json");
const PROJECTS_ROUTE_PATH = join(root, "app", "routes", "projects.tsx");
const PLAYGROUND_PATH = join(root, "content", "playground.json");
const PLAYGROUND_ROUTE_PATH = join(root, "app", "routes", "playground.tsx");
/* Each demo is a loader module and a section component in these, so the page's source is all of them. */
const PLAYGROUND_DEMO_DIRS = [
  join(root, "app", "lib", "playground"),
  join(root, "app", "components", "playground"),
];
const ROUTES_PATH = join(root, "app", "routes.ts");

const tally = createTally({ separator: ": " });
const { ok } = tally;

const normalizeEol = (/** @type {string} */ text) => text.replace(/\r\n/g, "\n");

/** @param {string} source */
const stripped = (/** @type {string} */ source) =>
  stripComments(source, { preserveLines: true });

/**
 * A source file with its comments gone, by the parser for TSX: the tokenizer reads an apostrophe in
 * JSX text as a string opener and can keep every comment after it, which then satisfies a check.
 *
 * @param {string} file
 */
const codeOf = (file) => {
  const source = normalizeEol(readFileSync(file, "utf8"));
  return file.endsWith(".tsx") ? stripTsxComments(source) : stripped(source);
};

/**
 * Letter-digit tokens (D1, FTS5) are names, removed before the digit scan.
 *
 * @param {string} text
 */
const withoutIdentifiers = (text) =>
  text
    .replace(/\b[A-Za-z]+[0-9][A-Za-z0-9]*\b/g, " ")
    .replace(/\b[0-9]+[A-Za-z][A-Za-z0-9]*\b/g, " ");

/**
 * Every URL path routes.ts declares, with the module that renders it. Read by IMPORTING the config
 * and walking children with their parent's prefix: a regex over the file saw `route("tools", ...)`
 * under /admin as a top-level /tools, and anchors to that nonexistent URL passed.
 *
 * @returns {Promise<Map<string, string>>}
 */
async function declaredRouteModules() {
  const { default: config } = await import(pathToFileURL(ROUTES_PATH).href);
  /** @type {Map<string, string>} */
  const out = new Map();
  const walk = (/** @type {any[]} */ entries, /** @type {string} */ prefix) => {
    for (const entry of entries) {
      const path = entry.index ? prefix || "/" : `${prefix}/${entry.path}`.replace(/\/+/g, "/");
      // An index child renders at its parent's path, so its module is the page there.
      if (entry.index || !out.has(path)) out.set(path, join(root, "app", entry.file));
      if (entry.children) walk(entry.children, path === "/" ? "" : path);
    }
  };
  walk(config, "");
  return out;
}

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

const artifactRecords = readArtifact().records ?? [];

/**
 * A page's search records against the list the page is built from, both ways: one document record,
 * a section record for every item, and no section record for an item the list no longer carries.
 *
 * @param {string} docUid
 * @param {{ kind: string, page: string, item: string, list: string }} words for the labels
 * @param {Array<{ slug: string, anchor: string }>} items
 * @returns {any[]} the page's records
 */
function pageRecordParity(docUid, { kind, page, item, list }, items) {
  const records = artifactRecords.filter((/** @type {any} */ r) => r.docUid === docUid);
  ok(`the artifact carries ${kind} page records`, records.length > 0, "none found. Run build:content.");
  ok(
    `the ${page} page has exactly one document record`,
    records.filter((/** @type {any} */ r) => r.anchor === null).length === 1,
  );
  const recordAnchors = new Set(
    records
      .filter((/** @type {any} */ r) => r.anchor !== null)
      .map((/** @type {any} */ r) => String(r.anchor)),
  );
  for (const { slug, anchor } of items) {
    ok(
      `${slug} has a section record in the artifact`,
      recordAnchors.has(anchor),
      `no record anchored ${anchor}. The ${list} changed without a rebuild.`,
    );
  }
  const listed = new Set(items.map((i) => i.anchor));
  for (const anchor of recordAnchors) {
    ok(
      `artifact record ${anchor} corresponds to a ${item} in the ${list}`,
      listed.has(anchor),
      `the index describes a ${item} the ${list} no longer lists`,
    );
  }
  return records;
}

/**
 * A page reads its list from content/ and its anchors from the module the indexer uses, so neither
 * can be a second copy.
 *
 * @param {string} source the route, comments stripped
 * @param {{ route: string, list: string, json: string, reads: RegExp, noun: string, anchorFn: string, anchorModule: RegExp }} page
 */
function pageReadsItsList(source, { route, list, json, reads, noun, anchorFn, anchorModule }) {
  ok(`the page imports the ${list} rather than restating it`, reads.test(source), `app/routes/${route} must read content/${json}`);
  ok(
    `the page derives ${noun} anchors from ${anchorFn}`,
    source.includes(`${anchorFn}(`) && anchorModule.test(source),
    "anchors must come from the module the indexer uses, or a record can cite a fragment nothing renders",
  );
}
const routeModules = await declaredRouteModules();
const routes = new Set(routeModules.keys());
const gates = declaredGates();

ok(
  "the feature list is not empty",
  features.length > 0,
  "no features, so every check below would pass vacuously",
);
ok(
  "routes.ts parsed to a plausible number of routes",
  routes.size >= 50,
  `read ${routes.size}, floor 50, measured 55 with nested paths composed. The walk has ` +
    `stopped descending into children, or routes.ts has lost routes.`,
);
ok(
  "routes.ts: a nested route is known by its full path, never by its child segment alone",
  routes.has("/admin/tools") && !routes.has("/tools"),
  "the walk is flattening children to the top level again, so an anchor to a URL that " +
    "does not exist would pass",
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

const VERIFIABLE = ["route", "gate", "assertion"];
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

      const routeFile = routeModules.get(anchor.path);
      if (routeFile && existsSync(routeFile)) {
        const routeSource = codeOf(routeFile);
        const isPage = /export\s+default\s+function\b/.test(routeSource);
        const hasLoader = /export\s+(?:async\s+)?function\s+loader\b/.test(routeSource);
        /* The LOADER's own body: a 405 from an action on a GET-able route is not the loader refusing. */
        const loaderBody = functionBody(routeSource, /export\s+(?:async\s+)?function\s+loader\b/);
        const loaderRefuses = /status:\s*405/.test(loaderBody);
        const loaderAuthenticates = /\bauthenticateOperator\s*\(/.test(loaderBody);
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
      /* `file` names the module or test the gate runs when the text is not in its entry script. */
      const file = anchor.file
        ? join(root, String(anchor.file))
        : (gates.get(anchor.gate) ?? "");
      ok(
        `${label}: ${anchor.gate} is a gate that exists`,
        gates.has(anchor.gate),
        `package.json declares no ${anchor.gate}`,
      );
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

console.log("\n  the one-owner rule: the prose carries no number a gate does not own");

{
  /** Bare digits prose may carry: protocol constants only, which cannot go stale. */
  const PROTOCOL_CONSTANTS = new Map([
    ["403", "HTTP status: the first-publish refusal names it"],
    ["404", "HTTP status: the URL transform interface answers with it"],
    ["429", "HTTP status: the Ask refusal names it"],
    ["1042", "Cloudflare error code returned alongside that 404"],
  ]);

  const PROSE_FIELDS = ["component", "name", "what"];


  const REMOVED_VOCABULARY = [
    "committed artifact",
    "byte-comparison gate",
    "byte-compared",
    "regenerated artifact",
    "single commit carrying both",
  ];

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
    `${numbered.join("; ")}. The one-owner rule: a measured value lives in the gate that ` +
      `measures it, or nowhere. Point at the gate instead of restating its value.`,
  );

  ok(
    "no feature sentence uses the vocabulary of the removed content machinery",
    removedWords.length === 0,
    `${removedWords.join("; ")}. That machinery left git on 2026-08-26. Git holds ` +
      `markdown only, D1 holds the only rendered copy, and a save commits one file.`,
  );
}


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

/* Every page record lives at a declared route; papers share one parameterized route. */
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

for (const status of usedStatuses) {
  ok(
    `status "${status}" has a label`,
    Boolean(STATUS_LABEL[status]),
    `STATUS_LABEL declares ${Object.keys(STATUS_LABEL).join(", ")}. ` +
      `Without a label the page and the index would disagree about what it is called.`,
  );
}
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

const pageCode = stripTsxComments(normalizeEol(pageSource));
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

const ENHANCEMENTS_PATH = join(root, "content", "enhancements.json");
const ENHANCE_DIR = join(root, "app", "enhance");

/** A tripwire: a new module means walking this list. */
const EXPECTED_ENHANCE_MODULES = 8;

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

const enhanceFiles = existsSync(ENHANCE_DIR)
  ? readdirSync(ENHANCE_DIR)
      // Every script extension, or a .tsx or .mjs enhancement escapes the count and the inventory.
      .filter((name) => /\.(?:ts|tsx|mjs|js)$/.test(name))
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

for (const name of enhanceFiles) {
  const relPath = `app/enhance/${name}`;
  ok(
    `enhancements: ${relPath} appears in the inventory`,
    inventoryModules.has(relPath),
    `no entry names ${relPath}, so an enhancement shipped without a named fallback`,
  );
}

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

/* Catches a walk that stops descending; re-measure by running the gate. */
ok(
  "the server-rendered source scope is non-empty and complete",
  serverSources.length >= 145,
  `walked ${serverSources.length} file(s) under app/ excluding app/enhance/, floor 145, ` +
    `measured 158. The walker has stopped matching this tree, or stopped descending into it.`,
);

/* Comments stripped, so a comment cannot satisfy a fallback. */
const sourceBlobs = serverSources.map((file) => codeOf(file));

/* Plus the shared renderer's output (remark-gfm footnotes), from a fixture: the claim is about the
   renderer, not the corpus. */
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
  "![An image, which gets an anchor to its original](/dustin-edwards-og-image.png)",
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

/** Short tokens are skipped as too generic. */
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
    "the progressive-enhancement rule: an enhancement with no named fallback is a dependency, not an enhancement",
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
    `That is a claim about the wire.`,
);

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
const projectsChecksBefore = tally.checks;

const METRIC_INPUTS = {
  stack: JSON.parse(
    readFileSync(join(root, "content", "generated", "stack.json"), "utf8"),
  ),
  phageYears: PHAGE_YEARS,
};

// Fail closed: an empty roster passes every loop below.
const MINIMUM_PROJECTS = 5;
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

// The route must be the one the page module names, not a string typed here.
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
const EVIDENCE_KINDS = ["post", "page", "repo"];
const seenSlugs = new Set();

const artifactPostRows = readArtifact().posts ?? [];
/** PUBLISHED only: a draft citation would link the live site to a 404. */
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
    `${projectNumbers.join("; ")}. The one-owner rule: this page has exactly one place ` +
      `for a number, the metric, and it carries a date or a derivation beside it.`,
  );
}

const projectsSource = codeOf(PROJECTS_ROUTE_PATH);
pageReadsItsList(projectsSource, {
  route: "projects.tsx",
  list: "roster",
  json: "projects.json",
  reads: /import\s+projectsData\s+from\s+["'][^"']*content\/projects\.json["']/,
  noun: "card",
  anchorFn: "projectAnchor",
  anchorModule: /from\s+["']~\/lib\/projects-page\.mjs["']/,
});

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

const projectRecords = pageRecordParity(
  "page:projects",
  { kind: "project", page: "projects", item: "project", list: "roster" },
  projects.map((/** @type {any} */ p) => ({ slug: p.slug, anchor: projectAnchor(p.slug) })),
);

/* Executed-count floor, measured by running the gate, never by summing. */
const projectsChecks = tally.checks - projectsChecksBefore;
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

console.log("\n  playground");

const playgroundDoc = JSON.parse(readFileSync(PLAYGROUND_PATH, "utf8"));
const demos = playgroundDoc.demos ?? [];
const deferredDemos = playgroundDoc.deferred ?? [];
const swatches = playgroundDoc.swatches ?? [];
const datasets = playgroundDoc.datasets ?? {};
const keyPresets = playgroundDoc.keyPresets ?? [];
const cookiePresets = playgroundDoc.cookiePresets ?? [];
const snippets = playgroundDoc.markdownSnippets ?? [];
const playgroundChecksBefore = tally.checks;

/** Serialized the way the content pipeline does, so this sees the artifact's HTML. */
const serializeHast = (/** @type {any[]} */ children) =>
  unified()
    .use(rehypeStringify)
    .stringify(/** @type {any} */ ({ type: "root", children }));

/** `line` and `area` both emit `<path>`, so the mark group label is asserted too. */
/** @type {Record<string, string>} */
const MARK_ELEMENT = { bar: "rect", line: "path", dot: "circle", area: "path" };

// Fail closed: an empty list passes every loop.
const MINIMUM_DEMOS = 3;
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
  "an empty list makes every behavioral key assertion below iterate nothing",
);
ok(
  "cookie presets are declared",
  cookiePresets.length > 0,
  "an empty list makes every behavioral theme assertion below iterate nothing",
);
ok(
  "markdown snippets are declared",
  snippets.length > 0,
  "an empty list makes every behavioral render assertion below iterate nothing",
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

const playgroundFiles = [
  PLAYGROUND_ROUTE_PATH,
  ...PLAYGROUND_DEMO_DIRS.flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => /\.(tsx?|mjs)$/.test(name))
      .sort()
      .map((name) => join(dir, name)),
  ),
];
ok(
  "the playground's demo modules were found",
  playgroundFiles.length >= 1 + 2 * demos.length,
  `read ${playgroundFiles.length} file(s) for ${demos.length} demo(s), each a loader module and a ` +
    `component: a check below would pass or fail on a file it never read`,
);
const playgroundSource = playgroundFiles.map((file) => codeOf(file)).join("\n");

/**
 * @param {string} demo the label prefix naming the demo, or empty for the page's own
 * @param {RegExp} statement
 */
const statesInputCap = (demo, statement) =>
  ok(
    `${demo}the page states the input cap it enforces`,
    statement.test(playgroundSource),
    "a cap enforced in the loader and unstated in the UI is a silent truncation",
  );

pageReadsItsList(playgroundSource, {
  route: "playground.tsx",
  list: "manifest",
  json: "playground.json",
  reads: /import\s+playgroundData\s+from\s+["'][^"']*content\/playground\.json["']/,
  noun: "demo",
  anchorFn: "demoAnchor",
  anchorModule: /from\s+["']~\/lib\/playground-page\.mjs["']/,
});
ok(
  "the page takes its presets and fixtures from the manifest",
  /playgroundData\.swatches/.test(playgroundSource) &&
    /playgroundData\.datasets/.test(playgroundSource) &&
    /playgroundData\.keyPresets/.test(playgroundSource),
  "if the route restated them, the behavioral checks below would be checking a copy of the input",
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

for (const swatch of swatches) {
  const actual = contrast(swatch.fg, swatch.bg);
  ok(
    `contrast lab: ${swatch.label} computes ${swatch.ratio} to 1`,
    Math.abs(actual - swatch.ratio) < 0.05,
    `app/lib/contrast.mjs returned ${actual.toFixed(2)}, content/playground.json records ${swatch.ratio}`,
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

  /* "refused" is an answer, so the throw branch runs. Only the classifier's own refusal counts: any
     other exception is a crash, and reading it as "refused" would pass every refusal preset. */
  let actualKind;
  try {
    actualKind = classify(preset.key).kind;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    actualKind = message.startsWith("unclassified asset ") ? "refused" : `a crash: ${message}`;
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
  "a caught throw that renders nothing turns the module's loudest behavior into " +
    "a blank row",
);
statesInputCap("media key: ", /Up to \{KEY_CAP\} characters/);

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

/* Word-anchored: a suffixed name contains the shorter one. */
ok(
  "theme: the page imports the resolver",
  /from\s+["']~\/lib\/theme["']/.test(playgroundSource) &&
    /\bthemeFromRequest\b/.test(playgroundSource),
  "the demo must call the real resolver, not restate its rules",
);
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
statesInputCap("theme: ", /Up to \{COOKIE_CAP\} printable characters/);
ok(
  "theme: the page renders the absent attribute as a word rather than a blank",
  /"omitted"/.test(playgroundSource),
  "an empty cell reads as a bug; the absence IS the answer for a reader on system",
);

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
      ok(
        `markdown: ${label} refusal names the unknown directive`,
        typeof refusal === "string" && /unknown directive/i.test(refusal),
        `the message was ${JSON.stringify(refusal)}`,
      );
      continue;
    }
    if (!rendered) {
      ok(
        `markdown: ${label} rendered to something`,
        false,
        `renderBody resolved to ${JSON.stringify(rendered)} without throwing, so every ` +
          `per-snippet check below would have been skipped`,
      );
      continue;
    }

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

  ok(
    "markdown: a snippet is refused outright",
    snippets.some((/** @type {any} */ s) => s.expect?.throws === true),
    "without one, the fail-closed directive branch is never entered",
  );
  ok(
    "markdown: a snippet has a URL demoted",
    snippets.some((/** @type {any} */ s) => (s.expect?.blockedCount ?? 0) > 0),
    "without one, the URL allowlist is never exercised here",
  );
  ok(
    "markdown: a snippet renders headings into the table of contents",
    snippets.some((/** @type {any} */ s) => (s.expect?.toc ?? []).length > 0),
    "without one, the ordinary path is untested and only the refusals are shown",
  );
}

/* The wrapper reaches the pipeline through `loadPipeline()`, the Worker's one door to the renderer,
   and that door is where the WASM instantiator is installed. */
const snippetRendererSource = stripped(
  readFileSync(join(root, "app", "lib", "content", "render-snippet.server.ts"), "utf8"),
);
const pipelineDoorSource = stripped(
  readFileSync(join(root, "app", "lib", "content", "load-pipeline.server.ts"), "utf8"),
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
    /from\s+["']\.\/load-pipeline\.server["']/.test(snippetRendererSource) &&
    /\bloadPipeline\s*\(/.test(snippetRendererSource) &&
    /import\(\s*["']\.\/pipeline\.mjs["']\s*\)/.test(pipelineDoorSource),
  "a second renderer here would demonstrate nothing: it would keep working " +
    "while the thing it claims to show was broken",
);
ok(
  "markdown: the wrapper loads the Worker's WASM instantiator",
  /import\(\s*["']\.\/wasm\.server["']\s*\)/.test(pipelineDoorSource) &&
    /\bsetWasmLoader\s*\(/.test(pipelineDoorSource),
  "without it the highlighter cannot start in a Worker, and the demo answers " +
    "every reader with a render failure",
);
ok(
  "markdown: the wrapper's image resolver refuses",
  /* Inside the resolver itself: a throw anywhere in the file is not this resolver refusing. */
  /resolveImage:\s*async\s*\([^)]*\)\s*=>\s*\{\s*throw new Error\(/.test(snippetRendererSource),
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
ok(
  "markdown: the free-text form is still stated as deferred",
  deferredDemos.some(
    (/** @type {any} */ d) =>
      /markdown/i.test(d.slug ?? "") && /threat model/i.test(d.reason ?? ""),
  ),
  "the fixed-snippet demo shipping does not settle arbitrary text into the " +
    "highlighter, and the page must keep saying so",
);

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
      `chart options: ${key}/${type} contains no hex color literal`,
      !/#[0-9a-fA-F]{6}\b/.test(svg),
      `found ${(svg.match(/#[0-9a-fA-F]{6}\b/g) ?? []).join(", ")}`,
    );
    ok(
      `chart options: ${key}/${type} colors from chart tokens`,
      /var\(--chart-/.test(svg),
      "series colors must be custom properties so one render serves both themes",
    );
  }
}

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
/* Never restore a ban on the string "WCAG 3": it refused a true sentence (WCAG 3.0 is the working
   draft APCA is developed in), and WCAG 2.2 is already required above as the target. */
/* Through the constant only: a literal "100" would pass on stale text once the cap moved. */
statesInputCap("", /up to \{QUERY_CAP\} characters/i);
ok(
  "the route sets an explicit Cache-Control",
  /publicHtmlHeaders|SHARED_CACHE_CONTROL/.test(playgroundSource) &&
    /export function headers/.test(playgroundSource),
  "the cache-header rule: with the Workers cache on, no header means CACHED rather than skipped",
);
// A result that depended on anything but the query string would stop being a shareable URL.
ok(
  "the page renders no wall-clock timing",
  !/tookMs/.test(playgroundSource),
  "a timing readout is the one value that differs between two fetches of one URL",
);

const playgroundRecords = pageRecordParity(
  "page:playground",
  { kind: "playground", page: "playground", item: "demo", list: "manifest" },
  demos.map((/** @type {any} */ d) => ({ slug: d.slug, anchor: demoAnchor(d.slug) })),
);

/* Measured by running the section, never by summing. */
const playgroundChecks = tally.checks - playgroundChecksBefore;
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
/* Re-measure by running the gate. */
const MINIMUM_CHECKS = 930;
tally.floor("check:features", "checks", MINIMUM_CHECKS, "A SECTION was skipped rather than failing.");

console.log(`\n${tally.checks} checks, ${tally.failures} failures\n`);
process.exit(tally.failures > 0 ? 1 : 0);
