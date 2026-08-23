/**
 * Gate over the colophon's HAND-WRITTEN half.
 *
 *   npm run check:features
 *
 * OBSERVATION BOUNDARY, stated plainly because it is narrow: **this gate
 * verifies that the thing each claim is ABOUT still exists. It never verifies
 * that the prose is true.** A feature saying "the editor has a draft buffer with
 * offer, restore and discard" is checked only insofar as the route and the gate
 * it names are still there. Rewrite the sentence to say the opposite and this
 * gate stays green.
 *
 * That is the ruling's design rather than a shortfall (colophon-page.md): the
 * stack half is DERIVABLE and is derived, the feature half is not derivable and
 * is anchored. What anchoring buys is that most rot is caught, because prose
 * usually goes stale by describing something that was removed or renamed, and it
 * gives the page its best property: every claim links to the thing that proves
 * it.
 *
 * **Second boundary, and it will bite someone: the route parser collects
 * DECLARED paths and does NOT compose nested prefixes.** `routes.ts` nests the
 * admin subtree under `route("admin", ...)`, so its children are declared
 * relative to it and this gate sees `/posts/:slug/edit`, never
 * `/admin/posts/:slug/edit`. That is why the four admin features are anchored
 * to their gates rather than to their routes: those paths are behind a session
 * and cannot be linked anyway, so the gate anchor is both verifiable and more
 * useful.
 *
 * The consequence to know about BEFORE it happens: the next feature that
 * anchors to a nested PUBLIC route will fail here, and the failure will read
 * like rot in the anchors file when it is really this parser's limit. Either
 * anchor it to the child segment as declared, or teach the parser to compose
 * prefixes. Do not "fix" it by hardcoding a path list, which is the mirror this
 * whole family of gates exists to prevent.
 *
 * Pure: no network, no database, no bindings.
 *
 * ## Why a decision anchor can never stand alone
 *
 * Four anchor kinds. Three are verifiable here and one is not:
 *
 *   route      a path that must appear in app/routes.ts
 *   gate       a check:* script in package.json whose file exists on disk
 *   assertion  { gate, text } where the text must appear in that script
 *   decision   a dated heading in decisions.md, which lives in Capsid
 *
 * This gate runs offline and cannot reach Capsid, so a decision anchor is
 * carried as CONTEXT and proves nothing. A feature whose only anchor were a
 * decision would therefore be an unverifiable claim wearing the costume of a
 * verified one, and the anchors file would become exactly the place rot
 * collects: the one spot on the page where a sentence can rot with a gate
 * standing over it saying nothing is wrong.
 *
 * So every feature must carry at least one route, gate or assertion anchor, and
 * that is asserted below rather than left to discipline.
 *
 * ## Derived, not restated
 *
 * No route path, gate name or script filename appears in this file as a
 * literal. Routes are parsed out of `app/routes.ts`, gates are read from
 * package.json's `check:*` scripts, and the assertion text is searched in the
 * script the anchor names. Same rule the rest of the family follows.
 *
 * FAILS CLOSED. Zero features, zero anchors, or a routes.ts that parses to
 * nothing are each a failure, so "0 problems" can never mean "0 examined".
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import rehypeStringify from "rehype-stringify";
import { unified } from "unified";

import { COLOPHON_ANCHORS, STATUS_LABEL } from "../app/lib/colophon-sections.mjs";
import { PLAYGROUND_URL, demoAnchor } from "../app/lib/playground-page.mjs";
import { PROJECTS_URL, projectAnchor } from "../app/lib/projects-page.mjs";
import { isAllowedUrl } from "../app/lib/content/pipeline.mjs";
// The three real code paths the playground demos run. Imported rather than
// reimplemented, which is the whole claim the playground section verifies.
import { apca, contrast } from "../app/lib/contrast.mjs";
import { RRF_K, fuse } from "../app/lib/search/query.mjs";
import {
  CHART_TYPES,
  buildChartModel,
  renderChartHast,
} from "../app/lib/content/chart.mjs";

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
 * Comments removed, so a match is a property of CODE rather than of prose.
 *
 * ONE implementation, used by BOTH readers in this file. It used to exist only
 * inside `declaredRoutes()`, and the assertion-anchor match a hundred lines
 * below ran against raw bytes. The pre-audit sweep defeated that directly:
 * deleting the assertion `worker returned a different fixture count` from
 * check-charts.mjs and leaving its text in a comment left this gate reporting
 * 276 checks and 0 failures. The anchor's entire promise is that a claim on the
 * colophon links to the thing that PROVES it, and the thing was gone.
 *
 * The trap was already named in this file's own header, and the fix already
 * existed twenty lines away. That is the part worth remembering: the gate knew
 * about prose matching, applied the cure to one of its two readers, and shipped
 * the other for a month.
 *
 * LINE STRUCTURE IS PRESERVED. A block comment becomes the same number of
 * newlines it spanned, not a single space, so a MULTI-LINE anchor still matches
 * across code that had a comment between its lines. check:assertions learned
 * this the expensive way when collapsing comments moved every reported line.
 *
 * The `[^:]` guard on line comments keeps `https://` from being read as one.
 *
 * @param {string} source
 */
function stripped(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) ?? []).length))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

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

/**
 * Every path `routes.ts` declares, parsed rather than listed.
 *
 * `route("blog/:slug", ...)` and `index(...)` are the only two forms this repo
 * uses, and the first argument of `route()` is the path. Nested children carry
 * paths relative to their parent, so an admin child appears as `posts/new`
 * rather than `admin/posts/new`; the colophon's features name public top-level
 * paths, and a relative form is still a real declared path, so both are
 * collected and compared as declared.
 *
 * **This is the most fragile thing in this gate and it is worth saying so.** It
 * reads source with a regex rather than asking the router, so a routes file
 * written in a different style, a path built by concatenation, or a route added
 * through a plugin would be invisible here. The failure direction is safe: an
 * unparsed route makes a feature naming it FAIL rather than pass, which is
 * loud. The unsafe direction would be a hardcoded list, which is what this
 * avoids.
 */
function declaredRoutes() {
  // Comments first: this file's own prose names paths like /phage-discovery
  // and /colophon, and a scan that read them would report routes that are only
  // mentioned. Same trap check:logo and check:contrast both hit, and the same
  // one the assertion-anchor match below fell into. One `stripped()` now.
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

/** Every gate package.json declares, minus the aggregate runners. */
function declaredGates() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    if (!name.startsWith("check:") || name === "check:all") continue;
    // The script FILE, taken out of the command rather than guessed from the
    // gate's name: check:admin-ui runs check-admin-ui.mjs and the mapping is
    // not mechanical.
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
const gates = declaredGates();

/* --------------------------------------------------------- fail closed first */

ok(
  "the feature list is not empty",
  features.length > 0,
  "no features, so every check below would pass vacuously",
);
/*
 * FLOOR: was >= 10, MEASURED 34 this session through declaredRoutes(), now
 * >= 30 (about 12 percent under).
 *
 * The old value could not detect the failure most likely to happen here. The
 * admin subtree contributes TWELVE nested children; if the parser ever stopped
 * seeing nested `route()` calls it would return 22, comfortably over 10, and
 * nothing would say so. The admin features anchor to gates rather than routes,
 * so no other assertion would have failed either.
 */
ok(
  "routes.ts parsed to a plausible number of routes",
  routes.size >= 30,
  `parsed ${routes.size}; expected at least 30. The parser has stopped matching this ` +
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

/* ------------------------------------------------- the anchors, one at a time */

const VERIFIABLE = ["route", "gate", "assertion"];
/** Gates some feature points at, for the coverage report at the end. */
const referencedGates = new Set();
let verified = 0;

for (const feature of features) {
  const label = `${feature.component} / ${feature.name}`;
  const anchors = feature.anchors ?? [];

  ok(`${label} carries at least one anchor`, anchors.length > 0);

  /*
   * THE RULING, enforced rather than trusted. A decision anchor is context and
   * proves nothing offline, so it may accompany a verifiable anchor and may
   * never be a feature's only one.
   */
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
      /*
       * BOTH SIDES NORMALIZED, the `check:claude-md` and `check:migrations`
       * form. Gate-backlog item 14.
       *
       * `core.autocrlf` is true on this host, so a file git has not rewritten
       * since `cab1c9e` pinned the tree sits CRLF on disk while its committed
       * blob is LF. Every anchor today is single line, so this changes nothing
       * now; the first MULTI-LINE anchor written against a stale-CRLF disk file
       * would match locally and fail in every fresh checkout and clone. That is
       * exactly the class that bit `check:migrations` on 2026-08-10, caught by
       * `check:head`, and it is cheaper to normalize than to diagnose.
       *
       * The needle is normalized too: a JSON file edited on this host can carry
       * CRLF inside a string just as readily as the script can.
       */
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

/* ---------------------------------- the page's search records, ruling 3 ---- */

/*
 * Why HERE and not in check:search.
 *
 * These assertions need two things this file already has and that one does not:
 * a parser for `routes.ts`, and the habit of reconciling a hand-written list
 * against reality in both directions. `check:search` is about the query parser
 * and rank fusion over synthetic input; it has no notion of routes, of the
 * artifact, or of what the page renders. Putting a routes parser there would be
 * a second one, which is the shape check:invariants exists to prevent.
 */

console.log("\n  page records for /colophon");

const pageRecords = artifactRecords.filter(
  (/** @type {any} */ r) => r.type === "page",
);
const colophonRecords = pageRecords.filter(
  (/** @type {any} */ r) => r.docUid === "page:colophon",
);

// FAIL CLOSED. Zero page records is not an empty result set, it is ruling 3 not
// having happened, and every assertion below would pass vacuously.
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

// Every page record must live at a route that exists. A record pointing at a
// removed route returns a hit that 404s, which is worse than no hit.
for (const record of pageRecords) {
  const path = String(record.url).split("#")[0];
  ok(
    `page record ${record.uid} resolves to a declared route: ${path}`,
    routes.has(path),
    `routes.ts declares no ${path}`,
  );
}

/*
 * Anchors, both directions against the DESCRIPTOR.
 *
 * This is the assertion the whole descriptor exists for. A section record whose
 * anchor is not a fragment the page renders still returns a hit, still looks
 * right in a result list, and scrolls nowhere. Nothing else in the repo would
 * notice.
 */
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

/*
 * The page renders FROM the descriptor, asserted structurally.
 *
 * There is no list of ids in the page to compare against, and that is the
 * property being checked: the only `<h2 id=` in the file is the one inside
 * `SectionHead`, which takes its id from the descriptor. A literal id
 * reintroduced anywhere else is a second list, and the next rename splits them.
 */
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

/* ------------------------------------- the not-adopted status labels ------- */

/*
 * ONE LABEL MAP, TWO READERS, asserted in both directions.
 *
 * The defect this section was written for, 2026-08-05: `STATUS_LABEL` lived in
 * `colophon.tsx`, so the page rendered `(Refused)` and `(Accepted gap)` while
 * the record body carried the raw enum `(refused)` and `(accepted-gap)`. For
 * `accepted-gap` the hyphen means the indexed token was on the page in NO
 * casing, so a reader who searched the word the index advertises would land on
 * a page that never says it.
 *
 * **No gate could see it, and it is worth being precise about why.**
 * `check:content` byte-compares the artifact against a fresh generation, so it
 * compares the wrong output to itself and agrees. This gate reconciled section
 * IDS, not the words inside a section. The comparison that was missing is index
 * against PAGE, and the three assertions below are the offline half of it: the
 * label reaches the index, the raw enum does not, and neither reader carries a
 * literal that could drift from the other.
 */

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
// Direction 2: no label for a status nothing declares. An orphan label is the
// same mirror-going-stale shape, caught before it is the one that matters.
for (const status of Object.keys(STATUS_LABEL)) {
  ok(
    `label "${status}" is used by at least one entry`,
    usedStatuses.includes(status),
    `nothing in stack.json declares status "${status}"`,
  );
}

/*
 * The LABEL reaches the index and the RAW ENUM does not.
 *
 * Read off the gated artifact rather than recomputed, because the artifact is
 * what `sync:content` writes into D1 and therefore what a reader's search
 * actually matches against.
 */
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
    // The parenthesised form, so this cannot fire on a status word that happens
    // to appear inside a reason sentence.
    ok(
      `the index does NOT carry the raw enum "(${status})"`,
      !body.includes(`(${status})`),
      `the record body still carries the raw enum, which is the exact defect ` +
        `this section exists for: the page renders "(${label})".`,
    );
  }
}

/*
 * Neither reader restates the other's strings.
 *
 * Comments are stripped first. Both files' own prose names these values while
 * explaining the defect, and a scan that read the explanation would report a
 * literal that is not there. That trap has already been hit by check:logo and
 * check:contrast, and by the routes parser at the top of this file.
 */
const stripComments = (/** @type {string} */ s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

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

/*
 * And the descriptor declares each label EXACTLY ONCE, which is what makes it
 * the single source rather than merely one of the places it appears. A second
 * occurrence would mean the emitter had restated what the map already says.
 */
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

console.log(
  `     ${notAdopted.length} entr(ies), ${usedStatuses.length} distinct status(es), ` +
    `${Object.keys(STATUS_LABEL).length} label(s)`,
);

/* ----------------------------------- the enhancement inventory, item 10 ---- */

/*
 * Hard rule 9's second half, which is the half that gets dropped: every
 * enhancement declares a NAMED fallback, EVEN WHEN THE FALLBACK IS NOTHING.
 * All four modules in `app/enhance/` did declare one, in three different
 * prose formats across two files, and no gate could read any of them.
 *
 * BOTH DIRECTIONS. A file in `app/enhance/` with no entry is an enhancement
 * nobody named a fallback for; an entry naming a module that does not exist is
 * an inventory describing a repo that no longer exists.
 *
 * WHAT THIS CANNOT SEE, and it is the more important half: whether a route is
 * genuinely server-complete with script off. That is a claim about the WIRE,
 * hard rule 7 says so, and it belongs in `verify-live`. This gate proves the
 * fallback was NAMED and that the thing it names EXISTS. It cannot prove the
 * fallback works, and a lie written confidently into the prose passes here.
 */

const ENHANCEMENTS_PATH = join(root, "content", "enhancements.json");
const ENHANCE_DIR = join(root, "app", "enhance");

/**
 * EXACTLY FOUR TODAY, tripwired rather than bounded.
 *
 * A fifth module is not automatically wrong, but it is an enhancement that
 * arrived without anyone walking this list, which is the omission hard rule 9
 * exists about. Moving this number is a deliberate edit in the same commit.
 */
const EXPECTED_ENHANCE_MODULES = 4;

/**
 * Measured THROUGH this gate's own reading on 2026-08-11: 10 entries across the
 * 4 modules, because `blog.ts` carries seven. Set under, because the job is
 * catching a file that stopped being read, not tracking growth.
 */
const MINIMUM_ENHANCEMENT_ENTRIES = 8;

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

/**
 * Every source file under `app/` EXCEPT `app/enhance/`.
 *
 * The exclusion is the whole point. A selector that appears only inside the
 * enhancement module is markup the enhancement CREATES for itself, which is not
 * a fallback; it would make the assertion agree with itself.
 */
function serverRenderedSources(/** @type {string} */ dir, /** @type {string[]} */ out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (full === ENHANCE_DIR) continue;
      serverRenderedSources(full, out);
    } else if (/\.(ts|tsx|mjs|css)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const serverSources = serverRenderedSources(join(root, "app"));

// NON-EMPTY SCOPE. A walk that returned nothing would make every selector
// assertion below fail closed rather than pass, but the count is asserted so
// the reason is named rather than inferred from a wall of failures.
/*
 * FLOOR: was > 20, MEASURED 105 this session through this gate's own walk, now
 * >= 92 (about 12 percent under).
 *
 * The old value left an 81 percent blind zone: four fifths of app/ could stop
 * being walked and the selector sweep would still report itself satisfied. A
 * floor that only catches a walk returning nothing is not catching the failure
 * that actually happens, which is a walk that stops descending.
 */
ok(
  "the server-rendered source scope is non-empty and complete",
  serverSources.length >= 92,
  `walked ${serverSources.length} file(s) under app/ excluding app/enhance/; expected at ` +
    `least 92. The walker has stopped matching this tree, or stopped descending into it.`,
);

const sourceBlobs = serverSources.map((file) => normalizeEol(readFileSync(file, "utf8")));

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
    // A selector that yields no checkable token would pass by examining
    // nothing, which is the empty-scope failure this family keeps hitting.
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
        `no file under app/ except app/enhance/ contains ${token} as a whole token. ` +
          `Markup the enhancement creates for itself is not a fallback.`,
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
// The selector sweep's denominator, PRINTED. Its floor is set against this
// number, and a floor whose subject is invisible cannot be re-measured.
console.log(
  `     ${serverSources.length} server-rendered file(s) searched, excluding app/enhance/`,
);
console.log(
  `     NOT asserted here: that any route is server-complete with script off. ` +
    `That is a claim about the wire (hard rule 7).`,
);

/* ------------------------------------------------------- the coverage report */

/*
 * REPORTED, NOT FAILED, per the spec. A gate no feature mentions is a coverage
 * signal about the page, not a defect in the repo: plenty of gates protect
 * things a reader does not need described. Failing here would push the next
 * person to write filler prose to silence it, which is worse than the silence.
 */
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

/* --- The projects roster ---------------------------------------------------
 *
 * WHY HERE AND NOT IN check:content. The spec guessed check:content; measured,
 * that gate byte-compares the GENERATED posts.json against a fresh generation
 * from content/posts, so it has nothing to regenerate a HAND-AUTHORED file
 * from and a projects section there would be structurally foreign. This gate is
 * already the owner of hand-authored content data: it reads content/, parses
 * routes.ts, knows the gate list, and already reconciles the colophon's page
 * records. The roster is the same kind of object as features.json.
 *
 * BOTH DIRECTIONS, and the pairs are the point. Schema and vocabulary catch a
 * malformed entry; the artifact parity below catches the defect that actually
 * happens, which is editing the roster and forgetting to rebuild, leaving the
 * search index describing projects the page no longer lists or missing ones it
 * does.
 */
console.log("\n  projects roster");

const projectsDoc = JSON.parse(readFileSync(PROJECTS_PATH, "utf8"));
const projects = projectsDoc.projects ?? [];
const vocabulary = projectsDoc.stackVocabulary ?? [];
const projectsChecksBefore = checks;

// FAIL CLOSED. An empty roster makes every loop below pass by iterating nothing.
const MINIMUM_PROJECTS = 4;
ok(
  "the roster is non-empty",
  projects.length >= MINIMUM_PROJECTS,
  `${projects.length} project(s), expected at least ${MINIMUM_PROJECTS}; ` +
    `a shorter list means the file was truncated, not curated.`,
);
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

const REQUIRED = ["slug", "name", "oneLiner", "description", "role", "status", "stack", "metric"];
const STATUSES = ["live", "building", "internal"];
const seenSlugs = new Set();

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

  // `url` and `repo` are NULLABLE by design: the unlinked tier is a real state,
  // not a gap. What is checked is that a value, when present, is a URL the
  // pipeline's rule-6 allowlist would accept. The predicate is IMPORTED rather
  // than restated, so this cannot drift from what the renderer permits.
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

  // THE METRIC IS THE PAGE'S WHOLE ARGUMENT, so it is checked hardest. A value
  // without a date is the failure this asserts against: an undated number rots
  // silently and keeps looking authoritative.
  const metric = project.metric ?? {};
  ok(`${id} metric has a label`, typeof metric.label === "string" && metric.label.length > 0);
  ok(`${id} metric has a value`, typeof metric.value === "string" && metric.value.length > 0);
  ok(
    `${id} metric carries an ISO asOf date`,
    typeof metric.asOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(metric.asOf),
    `got ${JSON.stringify(metric.asOf)}; a number without a date is the thing this page refuses`,
  );
}

// The vocabulary is closed in BOTH directions. An entry nothing uses is a term
// that can quietly stop meaning anything, which is how a "closed" list becomes
// a suggestion.
for (const term of vocabulary) {
  ok(
    `vocabulary term is used by at least one project: ${term}`,
    projects.some((/** @type {any} */ p) => (p.stack ?? []).includes(term)),
    `nothing declares it`,
  );
}

/*
 * THE PAGE RENDERS FROM THIS FILE, asserted at the source.
 *
 * The colophon can compare literal `<SectionHead id="...">` against its
 * descriptor because it hand-writes each one. This page MAPS over the roster,
 * so there are no literal ids to compare and the equivalent guarantee is
 * structural: the route must read the roster and derive its anchors from the
 * shared helper. If it ever stops doing either, parity becomes a coincidence.
 */
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

/*
 * Artifact parity, both directions. THIS is the assertion that catches the real
 * defect: a roster edited without `npm run build:content`, leaving the search
 * index and the page describing different sets of projects.
 */
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

/*
 * Executed-count floor, MEASURED THROUGH THIS GATE'S OWN PIPELINE on
 * 2026-08-14 by RUNNING it: this section executes 154 assertions over a
 * six-project roster with a fifteen-term vocabulary. The first number written
 * here was 91, guessed by adding up the loops, and it was wrong by two thirds.
 * Floored at 140, the ~8% margin the other gates use.
 *
 * Not scope-floored. The roster length gates most of the loops above, so a
 * truncated file trips `the roster is non-empty` first; this catches the case
 * where a whole BLOCK stops running, which a length assertion cannot see.
 */
const projectsChecks = checks - projectsChecksBefore;
const MINIMUM_PROJECT_CHECKS = 140;
if (projectsChecks < MINIMUM_PROJECT_CHECKS) {
  ok(
    "the projects section executed its assertions",
    false,
    `only ${projectsChecks} ran, expected at least ${MINIMUM_PROJECT_CHECKS}. ` +
      `A block was SKIPPED rather than failing. Measured: 154.`,
  );
}

console.log(
  `  ${projects.length} project(s), ${vocabulary.length} vocabulary term(s), ` +
    `${projectRecords.length} artifact record(s), ${projectsChecks} assertion(s)`,
);

/* --- The playground -------------------------------------------------------
 *
 * SAME OWNER, SAME REASON as the projects roster above: this gate is where
 * hand-authored content JSON is reconciled against the route that renders it.
 *
 * WHAT MAKES THIS SECTION DIFFERENT. A project card is markup, and this gate
 * does not render markup, so the roster above is reconciled structurally. The
 * playground's demos are not markup, they are CODE PATHS, and all three are
 * reachable offline: the colour maths, `fuse()` and the chart renderer are pure
 * modules with no database, no network and no clock. So each demo also gets a
 * BEHAVIOURAL assertion that runs the real module.
 *
 * THE EXPECTED VALUES ARE NOT PRODUCED BY THE CODE UNDER TEST. Ratios come from
 * design-tokens.md, the fusion arithmetic is written longhand, and the mark
 * labels are a fact about Observable Plot's output. Hard rule 10's fixture
 * independence: a gate whose expectations are generated by its subject is a
 * mirror.
 *
 * OBSERVATION BOUNDARY: this section does NOT execute the route's loader, so it
 * cannot see a rendered page. It proves the modules compute what the page
 * claims and that the page is WIRED to them. That a byte reached a browser is
 * verify-live's claim, per hard rule 7.
 */
console.log("\n  playground");

const playgroundDoc = JSON.parse(readFileSync(PLAYGROUND_PATH, "utf8"));
const demos = playgroundDoc.demos ?? [];
const deferredDemos = playgroundDoc.deferred ?? [];
const swatches = playgroundDoc.swatches ?? [];
const datasets = playgroundDoc.datasets ?? {};
const playgroundChecksBefore = checks;

/** Serialised exactly as check:charts does, so both see the artifact's HTML. */
const serializeHast = (/** @type {any[]} */ children) =>
  unified()
    .use(rehypeStringify)
    .stringify(/** @type {any} */ ({ type: "root", children }));

/**
 * The element each mark type must emit, MEASURED 2026-08-14 rather than assumed.
 *
 * `line` and `area` both emit only `<path>`, so the element alone cannot tell
 * them apart and an element-only assertion would pass with the wrong mark drawn.
 * Plot also labels the mark group, and THAT discriminates all four, so both are
 * asserted: the group proves the requested mark reached the renderer, the
 * element proves it drew something of the right kind.
 */
/** @type {Record<string, string>} */
const MARK_ELEMENT = { bar: "rect", line: "path", dot: "circle", area: "path" };

// FAIL CLOSED. An empty roster makes every loop below pass by iterating nothing.
const MINIMUM_DEMOS = 3;
ok(
  "the demo roster is non-empty",
  demos.length >= MINIMUM_DEMOS,
  `${demos.length} demo(s), expected at least ${MINIMUM_DEMOS}`,
);
ok("swatch presets are declared", swatches.length > 0, "an empty list checks nothing");
ok(
  "chart datasets are declared",
  Object.keys(datasets).length > 0,
  "an empty map checks nothing",
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

/* -- manifest and page, BOTH DIRECTIONS ----------------------------------- */

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
    /playgroundData\.datasets/.test(playgroundSource),
  "if the route restated them, the behavioural checks below would be checking a copy of the input",
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

// Every demo cites a PUBLISHED article. Citing a draft would link a reader on
// the live site to a page that is not there.
const artifactPosts =
  JSON.parse(readFileSync(join(root, "content", "generated", "posts.json"), "utf8"))
    .posts ?? [];
const publishedSlugs = new Set(
  artifactPosts
    .filter((/** @type {any} */ p) => p.draft !== true)
    .map((/** @type {any} */ p) => p.slug),
);
ok(
  "the artifact carries published posts",
  publishedSlugs.size > 0,
  "otherwise the citation checks below pass vacuously",
);
for (const demo of demos) {
  ok(
    `${demo.slug} cites a published article`,
    publishedSlugs.has(demo.homeArticle?.slug),
    `homeArticle ${JSON.stringify(demo.homeArticle?.slug)} is not a published post`,
  );
}

/* -- behavioural: the contrast lab ---------------------------------------- */

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
// Lc is SIGNED and the page prints the sign, so polarity is asserted in both
// directions. An unsigned implementation would pass a magnitude check.
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

/* -- behavioural: the fusion arithmetic ----------------------------------- */

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
  // THE RENDERED CELLS. The page formats with toFixed(5), so these are the exact
  // strings a reader sees for this fixture. Precision cannot drift silently.
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
/*
 * The page must READ the decomposition. A route computing the contribution
 * itself would be a second implementation of the fusion rule, which is the one
 * thing the playground exists not to do.
 *
 * ASSERTED ON CODE, NOT ON PROSE. The first version of this check forbade the
 * string "1/(k + rank)" and failed immediately, because the table's CAPTION
 * says exactly that in English and `stripped()` removes comments, not JSX text.
 * A guard that fires on the copy it is supposed to require is worse than no
 * guard. So the three below are all things only code can do: own the constant,
 * divide by a literal 60, or read the value from the payload.
 */
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

/* -- behavioural: the chart renderer -------------------------------------- */

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
    // A hex here would be a palette bypass check:contrast can never see, because
    // it never reads this SVG.
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

/* -- copy law -------------------------------------------------------------- */

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
/*
 * DELETED 2026-08-21: the assertion banning the string "WCAG 3" from this page.
 *
 * THE LABELING RULING ABOVE STAYS and is the half that was ever load-bearing.
 * The page must name WCAG 2.2 as its conformance target and must label APCA as
 * not part of any standard. Those say what the page MUST claim, which is the
 * honest form of the rule and is falsified by a real defect.
 *
 * Banning a two-word string said what the page may not SAY, which is a
 * different and worse thing. WCAG 3.0 exists as a W3C working draft and APCA is
 * being developed in its context, so the most accurate sentence this lab could
 * add is one naming that relationship. **The ban made the next TRUE sentence
 * fail the build**, which is a gate holding a page back from being more correct
 * rather than stopping it being wrong.
 *
 * The failure it guarded, a page claiming conformance to a level that has none,
 * is already impossible: the assertion above requires WCAG 2.2 to be named as
 * THE target, so a page claiming WCAG 3 conformance instead would fail there.
 */
ok(
  "the page states the input cap it enforces",
  /up to \{QUERY_CAP\} characters|up to 100 characters/i.test(playgroundSource),
  "a cap enforced in the loader and unstated in the UI is a silent truncation",
);
ok(
  "the route sets an explicit Cache-Control",
  /SHARED_CACHE_CONTROL/.test(playgroundSource) &&
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

/* -- artifact parity, both directions ------------------------------------- */

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

/*
 * Executed-count floor, MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING
 * the section, never by adding up the loops. Two recorded failures of summing
 * sit behind that rule: 91 guessed against 154 measured in the projects section
 * above, and 40 against 37 in the icon suite. Floored at the measured count
 * less the ~8% margin the rest of the family uses.
 */
const playgroundChecks = checks - playgroundChecksBefore;
const MINIMUM_PLAYGROUND_CHECKS = 130;
if (playgroundChecks < MINIMUM_PLAYGROUND_CHECKS) {
  ok(
    "the playground section executed its assertions",
    false,
    `only ${playgroundChecks} ran, expected at least ${MINIMUM_PLAYGROUND_CHECKS}. ` +
      `A block was SKIPPED rather than failing. Measured: 142.`,
  );
}

console.log(
  `  ${demos.length} demo(s), ${Object.keys(datasets).length} dataset(s), ` +
    `${swatches.length} swatch(es), ${deferredDemos.length} deferred, ` +
    `${playgroundRecords.length} artifact record(s), ${playgroundChecks} assertion(s)`,
);

/*
 * WHOLE-GATE EXECUTED-COUNT FLOOR.
 *
 * The projects and playground sections already floor THEMSELVES, and that is
 * not the same guarantee: a section floor cannot see a DIFFERENT section
 * stopping, and this gate has several unfloored ones ahead of them (the feature
 * roster, the anchors, the enhancement inventory, the colophon page records).
 * Each section floor is a local witness; this is the global one.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 583.
 * Never summed, and the habit of summing is why: 91 was guessed against 154
 * measured for the projects section in this very file.
 *
 * Floored at 540, roughly 7 percent. More slack than the small gates get,
 * because this count moves with the CORPUS: posts, tags, projects and demos all
 * feed it, so ordinary content work shifts it by tens.
 */
const MINIMUM_CHECKS = 540;
if (checks < MINIMUM_CHECKS) {
  ok(
    "this gate executed its assertions",
    false,
    `only ${checks} ran, expected at least ${MINIMUM_CHECKS}. A section was SKIPPED ` +
      `rather than failing. Measured: 583.`,
  );
}

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
