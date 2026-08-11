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

import { COLOPHON_ANCHORS, STATUS_LABEL } from "../app/lib/colophon-sections.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEATURES_PATH = join(root, "content", "features.json");
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

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
