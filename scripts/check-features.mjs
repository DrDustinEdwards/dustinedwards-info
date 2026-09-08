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
import {
  METRIC_DERIVATIONS,
  PROJECTS_URL,
  metricValue,
  projectAnchor,
} from "../app/lib/projects-page.mjs";
// The roster's derived metrics are computed from these, by the SAME function
// the route calls. A gate deriving the expected value its own way would be two
// implementations that agree until they do not, with nothing able to say which
// is right (hard rule 10, and rule 12's differential discipline).
import { PHAGE_YEARS } from "../app/data/phage-hunters.ts";
import { isAllowedUrl, renderBody } from "../app/lib/content/pipeline.mjs";
// The key grammar's readers. Imported for the same reason the colour maths and
// the chart renderer are: the playground's claim is that its demos run the real
// module, and a gate that reimplemented the grammar would be checking a second
// answer to the question the module exists to have one answer to.
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
// The theme resolver, for the same reason: the demo's claim is that it runs the
// function the Worker runs, and a gate restating the rules would agree with
// itself while the site disagreed with both.
import { colorSchemeMeta, themeAttribute, themeFromRequest } from "../app/lib/theme.ts";
// The three real code paths the playground demos run. Imported rather than
// reimplemented, which is the whole claim the playground section verifies.
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
 * Comments removed, so a match is a property of CODE rather than of prose.
 *
 * ONE implementation, used by ALL THREE readers in this file. It used to exist
 * only inside `declaredRoutes()`, and the assertion-anchor match a hundred lines
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
 * **AND THEN IT HAPPENED AGAIN, 2026-08-26.** The enhancement selector sweep
 * was added after this paragraph was written, read raw bytes like the reader
 * this paragraph is about, and this header went on saying "BOTH readers" while
 * there were three. The sentence describing the failure was, once more, sitting
 * directly above the code committing it. A shared helper is not adopted by
 * being documented; count the call sites when you add a reader.
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
const stripped = (/** @type {string} */ source) =>
  stripComments(source, { preserveLines: true });

/**
 * Identifier tokens removed before a hard-rule-17 digit scan.
 *
 * A token mixing letters and digits is a NAME (D1, R2, FTS5, workerd), not a
 * measurement. The two forms are letters-then-digits and digits-then-letters,
 * and both are stripped whole, so a name never leaves a digit behind for the
 * scan to find. Stripping them is not a loophole: a measurement is never
 * spelled that way.
 *
 * **MODULE SCOPE SINCE 2026-08-30, and the move is the point.** It lived inside
 * the features block and the projects roster below needed the identical rule.
 * Copying it would have been this file's own recorded failure repeated a third
 * time: `stripped()` was written once, applied to one of two readers, and the
 * header went on saying "BOTH readers" while there were three. One
 * implementation, two callers, counted.
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
 * FLOOR: RE-MEASURED 2026-08-24 through declaredRoutes() by running this gate:
 * 36. Now >= 33, about eight percent under. It was 30 against 34 measured, and
 * before that 10.
 *
 * The original value could not detect the failure most likely to happen here.
 * The admin subtree contributes TWELVE nested children; if the parser ever
 * stopped seeing nested `route()` calls it would return 24, comfortably over
 * 10, and nothing would say so. The admin features anchor to gates rather than
 * routes, so no other assertion would have failed either.
 */
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

/* ------------------------------- hard rule 17, on the prose itself --------- */

/*
 * **THE RULE THIS GATE ENFORCES, AND THE MEASUREMENT THAT FORCED IT.**
 *
 * An external audit read this repository's own prose and found that ten of
 * eighteen checkable claims were FALSE. Most carried no digits at all. They
 * were TENSE-BOUND STATE CLAIMS: present-tense sentences about how the system
 * is built, written true and left standing after the machinery moved. Five
 * entries in this very file described a committed, byte-compared content
 * artifact that had left git on 2026-08-26.
 *
 * Hard rule 17 was extended on 2026-08-28 to cover both halves: prose may carry
 * REASONING, and may not carry a NUMBER or a TENSE-BOUND STATE CLAIM that a
 * gate does not own. This is the one surface where a regex can enforce any of
 * it, so it is enforced here.
 *
 * ## OBSERVATION BOUNDARY, and it is the important paragraph
 *
 * **THIS CANNOT READ TENSE.** It refuses digits and it refuses a named
 * vocabulary. A sentence can still describe machinery deleted this morning, in
 * the present tense, with no number in it, and pass. What this buys is that the
 * two shapes which actually recurred here are now a build failure rather than a
 * reading exercise: a restated measurement, and the specific words of the
 * removed content pipeline.
 *
 * That is the same bargain the anchor checks above make. This gate has never
 * been able to verify that a sentence is TRUE, and it still cannot.
 *
 * ## WHAT COUNTS AS A NUMBER, stated because the naive form is unusable
 *
 * A digit glued to letters inside one token is an IDENTIFIER, not a
 * measurement: D1, R2, FTS5, workerd. Those are stripped before the scan, and
 * stripping them is not a loophole, because a measurement is never spelled that
 * way.
 *
 * What remains is a bare digit run, and exactly one class of those is allowed:
 * PROTOCOL CONSTANTS, listed below with a reason each. A status code is owned
 * by the protocol rather than by this repository, so it cannot drift underneath
 * a sentence, which is the test rule 17 itself states. The list is CLOSED and
 * short so that adding to it is a deliberate diff someone has to justify.
 *
 * ## DATES ARE NOT ALLOWED HERE, because there is nowhere to put one
 *
 * The rule's exception for dated records covers published posts and a dated
 * update field. **This file has no dated field**, so granting a date allowance
 * would be an allowance over nothing, which is the unfailable-condition class
 * in hard rule 10. If an `updated` field is ever added, the allowance is wired
 * HERE and scoped to that field alone, never to the prose.
 *
 * ## ANCHORS ARE EXEMPT, deliberately
 *
 * An anchor's `text` is a machine reference that must match a gate's own
 * assertion label byte for byte, and those labels carry counts. Scanning them
 * would force the gates to be reworded to satisfy a rule about prose.
 */

console.log("\n  hard rule 17: the prose carries no number a gate does not own");

{
  /**
   * Bare digit runs a feature sentence may carry, each with its reason.
   *
   * CLOSED. A protocol constant is owned by the protocol and cannot go stale;
   * anything else that looks like a number in prose is a measurement, and a
   * measurement belongs in the gate that measures it or nowhere.
   */
  const PROTOCOL_CONSTANTS = new Map([
    ["403", "HTTP status: the first-publish refusal names it"],
    ["404", "HTTP status: the URL transform interface answers with it"],
    ["429", "HTTP status: the Ask refusal names it"],
    ["1042", "Cloudflare error code returned alongside that 404"],
  ]);

  /** The prose fields. `anchors` is machine reference and is exempt above. */
  const PROSE_FIELDS = ["component", "name", "what"];

  /* `withoutIdentifiers` is at module scope now; the projects roster below is
     its second caller. See its docblock for why it moved. */

  /**
   * The vocabulary of the content machinery removed on 2026-08-26.
   *
   * Named rather than inferred: these are the exact phrases the five stale
   * entries used, so a sentence reintroducing one is describing a pipeline that
   * does not exist. Git holds markdown only, D1 holds the only rendered copy,
   * and a save commits ONE file.
   */
  const REMOVED_VOCABULARY = [
    "committed artifact",
    "byte-comparison gate",
    "byte-compared",
    "regenerated artifact",
    "single commit carrying both",
  ];

  /*
   * SCOPE, ASSERTED. Every assertion below iterates the feature list, so an
   * empty or unparsed list would report a clean sweep of nothing.
   */
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

  /*
   * FLOOR MEASURED 2026-08-28 BY RUNNING THIS LOOP: 114 fields over the feature
   * list, three prose fields each. The floor is 90, about twenty percent under,
   * so a component's worth of entries can go missing and this still notices,
   * while adding or removing one feature does not fail the gate.
   */
  ok(
    "the prose scan had fields to read",
    sentencesScanned >= 90,
    `scanned ${sentencesScanned} field(s), floor 90, measured 114 on 2026-08-28. ` +
      `A zero-scope scan reports a clean sweep of nothing.`,
  );

  /*
   * THE SCAN IS PROVEN ABLE TO FIRE, on synthetic input, every run.
   *
   * The collection it walks is legitimately allowed to be clean, and a check
   * that only ever sees clean data is a check nobody has watched work. Same
   * repair as check:secrets' empty allowlist: exercise the predicate directly,
   * on a path that does not depend on the data.
   */
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
 * `check:content` compares the generated output against itself (then a byte
 * gate, a determinism pass today), so a wrong output agrees with itself. This gate reconciled section
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
 *
 * The stripper is shared: scripts/lib/strip-comments.mjs.
 */

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
 * Measured THROUGH this gate's own reading, re-measured 2026-08-24: 10 entries
 * across the 4 modules, because `blog.ts` carries seven. Set under, because the
 * job is catching a file that stopped being read, not tracking growth. At the
 * previous 8 the three modules that are not `blog.ts` could all have stopped
 * being read at once and this would have passed.
 */
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

/**
 * Every source file under `app/` EXCEPT `app/enhance/`.
 *
 * The exclusion is the whole point. A selector that appears only inside the
 * enhancement module is markup the enhancement CREATES for itself, which is not
 * a fallback; it would make the assertion agree with itself.
 *
 * **STYLESHEETS ARE OUT, since 2026-08-26, and that is a correctness fix rather
 * than a narrowing.** `.css` was in this list, and a stylesheet cannot be the
 * fallback: it STYLES markup, so a rule naming a class is evidence that someone
 * intended the class to exist, never that anything renders it. Measured the day
 * it was removed: with the image anchor deleted from the pipeline and
 * `.image-link` surviving only in `app/styles/post.css`, this gate reported 585
 * checks and 0 failures on markup that had ceased to exist.
 */
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

// NON-EMPTY SCOPE. A walk that returned nothing would make every selector
// assertion below fail closed rather than pass, but the count is asserted so
// the reason is named rather than inferred from a wall of failures.
/*
 * FLOOR: RE-MEASURED 2026-08-26 through this gate's own walk by running it:
 * 158. Now >= 145, about eight percent under.
 *
 * IT WENT DOWN, and that is the one direction a floor is never re-measured in
 * by accident, so the reason is written here: the walk stopped taking `.css`
 * on 2026-08-26, which removed fifteen stylesheets. 173 minus those is 158.
 * A floor moving DOWN after a deliberate narrowing is correct; a floor moving
 * down on its own is the walk breaking, which is what this assertion catches.
 *
 * **THIS FLOOR IS ITS OWN CAUTIONARY TALE and the comment is kept for that.**
 * It was raised from 20 to 92 against a measured 105, with the note below
 * about the 81 percent blind zone the old value left. app/ then grew to 173
 * without the floor moving, so by 2026-08-24 the same floor left a 47 percent
 * blind zone: eighty-one files could stop being walked and the selector sweep
 * would still report itself satisfied. **A floor is not repaired once. It goes
 * stale in exactly the direction its own subject grows.**
 *
 * A floor that only catches a walk returning nothing is not catching the
 * failure that actually happens, which is a walk that stops descending.
 */
ok(
  "the server-rendered source scope is non-empty and complete",
  serverSources.length >= 145,
  `walked ${serverSources.length} file(s) under app/ excluding app/enhance/, floor 145, ` +
    `measured 158. The walker has stopped matching this tree, or stopped descending into it.`,
);

/*
 * COMMENTS STRIPPED, since 2026-08-26, and this is the THIRD reader to learn it.
 *
 * The header above says "ONE implementation, used by BOTH readers in this
 * file", and that sentence was true when it was written and stopped being true
 * when this sweep was added: it read raw bytes, so any `.tsx` comment
 * mentioning a class name satisfied the fallback that class was supposed to
 * name. The header's own closing line already described this exact outcome
 * about a different reader. It has now happened twice in one file.
 */
const sourceBlobs = serverSources.map((file) =>
  stripped(normalizeEol(readFileSync(file, "utf8"))),
);

/*
 * AND WHAT THE SHARED RENDERER EMITS, which is server-rendered markup that no
 * file under `app/` spells.
 *
 * Removing stylesheets and comments above turned `footnote-previews` red, and
 * the red was CORRECT: `footnotes` lived in exactly two places under `app/`, a
 * CSS rule in post.css and a sentence inside a comment in blog-index.css.
 * Neither renders anything. But the fallback is real: `remark-gfm` emits
 * `<section data-footnotes class="footnotes">` with working bidirectional
 * links, and it does so from `app/lib/content/pipeline.mjs`, which is the
 * server and is under `app/`.
 *
 * So the honest repair is not to weaken the entry, it is to ASK THE RENDERER.
 * "Is this markup server-rendered" is a question the server-rendered output
 * answers directly, where a grep over route source can only answer "did
 * somebody type this string".
 *
 * A FIXTURE RATHER THAN THE CORPUS, deliberately. `content/generated/posts.json`
 * is what the corpus happens to contain today, and today it contains ZERO
 * footnotes and ZERO images (measured 2026-08-26), so a corpus-backed sweep
 * would go red the moment an author deleted the last post using a feature. The
 * claim under test is about the RENDERER, which is a property of the code.
 *
 * This is input, not expected values, so it does not offend the
 * fixture-independence discipline: nothing here is compared against something
 * the renderer also produced.
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

// SCOPE, proven before the blob is trusted. A render that threw or returned
// nothing would quietly narrow the sweep back to where it started, which is the
// failure this whole section is about.
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
 * that gate proves the GENERATED corpus renders deterministically from
 * content/posts, so it has nothing to regenerate a HAND-AUTHORED file
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

/*
 * WHAT THE DERIVED METRICS ARE COMPUTED FROM, assembled the way the route
 * assembles them: from artifacts that already have owners.
 *
 * `content/generated/stack.json` is generated from package.json by
 * `build:stack` and reconciled against its sources by `check:stack`, so the
 * gate count reaches the card through the pipe that already owns it rather
 * than through a second count taken here. `PHAGE_YEARS` is the data the roster page renders.
 *
 * NOT fixture-independent, and it does not need to be: hard rule 10's fixture
 * rule forbids a gate whose EXPECTED value is produced by the code under test,
 * and there is no expected value here. The assertion is that the derivation
 * runs and yields something real, which is a property of the pipeline rather
 * than a comparison against a number this file would otherwise have to restate.
 */
const METRIC_INPUTS = {
  stack: JSON.parse(
    readFileSync(join(root, "content", "generated", "stack.json"), "utf8"),
  ),
  phageYears: PHAGE_YEARS,
};

// FAIL CLOSED. An empty roster makes every loop below pass by iterating nothing.
// Measured through this gate 2026-08-24: 6 projects. Floor one under, because
// a roster of this size cannot absorb more slack than that.
const MINIMUM_PROJECTS = 5;
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
/*
 * CLOSED, and closed in BOTH directions below. The route emits
 * `applicationCategory` for one of these and not the other, so a third value
 * would render structured data nothing decided the shape of.
 */
const SCHEMA_TYPES = ["SoftwareApplication", "WebPage"];
/*
 * The evidence kinds this gate knows how to VERIFY, which is the only list
 * worth having: a kind nobody checks is a citation nobody checks. Each is
 * verified differently below, and the route refuses to render an unknown one.
 */
const EVIDENCE_KINDS = ["post", "page", "repo"];
const seenSlugs = new Set();

/*
 * THE BUILT CORPUS, read once for the roster and again for the playground.
 *
 * Hoisted here on 2026-08-30 because the evidence checks need it and the
 * playground's citation check already did. It is `content/generated/posts.json`,
 * the gitignored local build product, which is why a roster edited without a
 * rebuild fails here rather than shipping a link to a post that is not there.
 */
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

  ok(
    `${id} schemaType is one of ${SCHEMA_TYPES.join(", ")}`,
    SCHEMA_TYPES.includes(project.schemaType),
    `got ${JSON.stringify(project.schemaType)}; the route emits this as the item's ` +
      `@type and branches on it, so an unknown value is structured data nobody designed`,
  );

  /*
   * THE METRIC IS THE PAGE'S WHOLE ARGUMENT, so it is checked hardest.
   *
   * TWO FORMS, MUTUALLY EXCLUSIVE, and the exclusivity is asserted rather than
   * left to convention. A metric carrying both a stored value and a derivation
   * would have TWO owners of its freshness, which is the state hard rule 17
   * names: the stored copy can drift while the derived one stays true, and the
   * page would render whichever the route happened to prefer.
   */
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
    /*
     * RUN THE DERIVATION, through the function the ROUTE calls. This is the
     * assertion that makes a derived metric worth more than a dated one: it
     * proves the value the card renders is producible, non-empty and not a
     * placeholder, on every run, without this gate knowing how it is computed.
     */
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

  /*
   * NOTABLE: optional, and shaped when present.
   *
   * The bound is two or three, and it is a bound rather than a minimum because
   * both failures are real. One sentence is a claim with no support; six is the
   * description field again under another name, and this list sits inside a
   * card in a grid where a long one pushes every sibling's foot down.
   */
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

  /*
   * EVIDENCE: optional, and every entry VERIFIED rather than merely shaped.
   *
   * A citation nobody checks is the silent failure this whole family of gates
   * exists for: it returns a hit, looks correct in a card, and goes nowhere.
   * Each kind is checked against the thing that owns it, and the post label is
   * argued against the corpus rather than trusted, which is the same
   * two-sources-must-agree bargain the chart enums make.
   */
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
        /*
         * THE LABEL IS THE POST'S TITLE, byte for byte.
         *
         * The route cannot read the corpus, so the title has to be restated in
         * the manifest for the card to render it. Restating it is fine; NOT
         * arguing it against the corpus is what would rot, and it would rot
         * invisibly, because a card showing a stale title still links to the
         * right article and nothing about the page looks wrong.
         */
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
/*
 * HARD RULE 17 ON THE ROSTER'S PROSE, the same scan the feature sentences get.
 *
 * THIS PAGE NEEDS IT MORE THAN THE COLOPHON DOES, because its entire premise is
 * that the number is in the metric channel, where it carries either a date or a
 * derivation. A digit loose in a description is a measurement with nowhere to
 * say how old it is, sitting on the one page whose argument is that a number
 * without provenance keeps looking authoritative after it stops being true.
 *
 * THE EVIDENCE LABELS ARE EXEMPT FROM THIS SCAN and are exempt for the reason the
 * feature anchors are: a post label is a MACHINE REFERENCE that must equal the
 * post's title byte for byte, and titles carry measurements ("6 ms with Rank
 * Fusion"). Scanning them would force articles to be retitled to satisfy a rule
 * about portfolio prose. The label has a stronger guarantee than the scan
 * anyway: it is argued against the corpus above.
 *
 * METRIC LABELS ARE ALSO OUT. The metric is the number channel; its label says
 * what is counted and sits beside a value that carries its own provenance.
 */
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

  /*
   * SCOPE, ASSERTED, and floored one under the measured count rather than at
   * the roster length: this scan reads two fields per project PLUS every
   * notable sentence, so the count moves with the notable lists and a floor
   * tied to `projects.length` would go stale on the next card that gains one.
   * MEASURED THROUGH THIS LOOP 2026-08-30: 23 fields over seven projects with
   * three notable lists.
   */
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

/*
 * THE ROUTE IS WIRED TO THE NEW FIELDS, asserted structurally.
 *
 * The manifest checks above prove the DATA is well formed. They say nothing
 * about whether any of it reaches a reader, and a field nothing renders is
 * worse than an absent one: it passes every shape check, it reads as shipped,
 * and the page is unchanged. Each assertion below is a thing only CODE can do,
 * on the lesson this file already carries in its search-anatomy block, where a
 * ban on a string fired against the caption that was supposed to say it.
 */
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
/*
 * THE PROVENANCE LINE BRANCHES. Without this, a route that dropped the derived
 * branch would render an empty <time> for every derived metric: no date, no
 * sentence, and a card that silently stops saying where its number came from,
 * which is the one thing this page exists to say.
 */
ok(
  "the page renders a provenance line for both metric forms",
  /metric\.derived\s*!==\s*undefined/.test(projectsSource) &&
    /dateTime=\{metric\.asOf\}/.test(projectsSource),
  "both branches must be present: a derived metric says it was derived, a dated " +
    "one renders its <time>",
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
 * Executed-count floor, MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING
 * it, never by summing the loops. The first number ever written here was 91,
 * guessed by adding up the loops against 154 measured, and it was wrong by two
 * thirds.
 *
 * RE-MEASURED 2026-08-30, after the roster gained evidence, notable sentences,
 * derived metrics and a schema type: **275** over a seven-project roster with a
 * fifteen-term vocabulary. It was 154 over six projects, and nearly all of the
 * growth is per-citation: every evidence entry costs four assertions and a post
 * citation costs six.
 *
 * Floored at 250, the ~8% margin the other gates use. That is deliberately not
 * generous: this count now moves with the EVIDENCE, so removing one card's
 * citations should not silently drop under a slack floor.
 *
 * Not scope-floored. The roster length gates most of the loops above, so a
 * truncated file trips `the roster is non-empty` first; this catches the case
 * where a whole BLOCK stops running, which a length assertion cannot see.
 */
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
const keyPresets = playgroundDoc.keyPresets ?? [];
const cookiePresets = playgroundDoc.cookiePresets ?? [];
const snippets = playgroundDoc.markdownSnippets ?? [];
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
    /playgroundData\.datasets/.test(playgroundSource) &&
    /playgroundData\.keyPresets/.test(playgroundSource),
  "if the route restated them, the behavioural checks below would be checking a copy of the input",
);
/*
 * THE HEADERS ARE KEYED BY SLUG, NOT BY POSITION, asserted because the failure
 * it prevents is invisible.
 *
 * With a positional index, inserting a demo anywhere but the end renders every
 * section below it under another demo's title, lede and article link. The
 * reconciliation above stays green in both directions the whole time, because
 * both lists are still complete: what changed is which header sits over which
 * form, and no list-membership check can see that.
 */
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

/*
 * Every demo cites a PUBLISHED article. Citing a draft would link a reader on
 * the live site to a page that is not there.
 *
 * READS `publishedTitles`, hoisted to the projects section on 2026-08-30 when
 * the roster's evidence checks needed the same corpus. This block used to parse
 * `posts.json` a second time, which was a second reader of one artifact rather
 * than a second copy of a fact, but it is the shape that becomes one: the two
 * would have needed the same draft predicate, and only one of them applied it
 * to titles.
 */
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

/* -- behavioural: the media key grammar ----------------------------------- */

/*
 * THE EXPECTED ANSWERS ARE HAND-WRITTEN IN THE MANIFEST, never captured from a
 * run. Hard rule 10's fixture independence, and it is load-bearing here rather
 * than ceremonial: this demo's entire claim is that ONE grammar answers for
 * four readers, and a fixture generated by those readers would agree with any
 * grammar they happened to share, including a wrong one.
 *
 * WHAT EACH ROW BUYS, because a table of booleans looks like padding: the two
 * content-key forms pin the optional dimension segment, the leading-zero key
 * pins the strict spelling that the collapsing differential chose over the
 * loose one, the served path pins THREE different argument contracts at once,
 * and the unclassifiable extension pins the classifier's refusal, which is the
 * one branch a passing test suite would otherwise never enter.
 */
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

  /*
   * "refused" IS AN EXPECTED ANSWER, and it has to be tested as one. A gate
   * that only ever asserted successful classifications would never enter the
   * throw branch, and that branch is the module's whole fail-closed design.
   */
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

/*
 * THE PRESET SET COVERS EVERY BRANCH, asserted rather than trusted to the
 * curator. A preset list can shrink to the easy cases one edit at a time, and
 * every assertion above would keep passing on whatever was left.
 */
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

/* -- the key demo is WIRED to the module, not to a copy of its answers ----- */

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

/* -- behavioural: the theme resolver -------------------------------------- */

/*
 * RUN THE REAL RESOLVER OVER A REAL REQUEST, exactly as the demo does and
 * exactly as the Worker does on every request.
 *
 * Expected answers are hand-written in the manifest, never captured. That
 * matters most for the two rows that look identical and are not arrived at the
 * same way: no cookie takes the resolver's first branch, the header-absent
 * test, while a legacy `theme=system` walks the header, decodes, fails the
 * writable-set test and falls through. A captured fixture would record that
 * they agree; a written one asserts that they MUST, which is the property the
 * shared cache entry depends on.
 */
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

  /*
   * NO HEADER AT ALL versus an EMPTY ONE, and the distinction is deliberate.
   * The resolver's first line returns early when the header is absent, so
   * building a request that always carries a `cookie:` header would route the
   * no-cookie preset down the walking path and quietly stop testing that line.
   */
  const request = new Request(
    "https://example.invalid/",
    preset.cookie ? { headers: { cookie: preset.cookie } } : undefined,
  );

  /*
   * A THROW IS A NAMED FAILURE HERE, NOT A CRASH, and this shape was chosen by
   * a plant rather than by foresight.
   *
   * Removing the resolver's URIError guard made this loop die on the malformed
   * escape preset: the gate exited non-zero with a stack trace and recorded NO
   * assertion, which is "EXIT 1 IS NOT EVIDENCE" in its purest form. The gate
   * was right that something was wrong and useless about what.
   *
   * It also matters beyond the plant. The one thing this preset exists to prove
   * is that a malformed cookie costs a reader the default theme and never the
   * page, and a gate that dies on it proves that by dying, which nothing
   * downstream can read. So the throw is caught and reported AS the failure of
   * this preset, with the message, and the loop carries on to the rest.
   */
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

/*
 * BRANCH COVERAGE, asserted rather than left to the curator, same as the key
 * presets. Each of these is a line in the resolver that nothing else on this
 * page would enter.
 */
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

/* -- the theme demo is WIRED to the module and to the Worker's own caller -- */

/*
 * BOTH NEEDLES ARE WORD-ANCHORED, and that was found by a plant rather than by
 * care. The Worker assertion below was written unanchored; the plant renamed
 * `themeFromRequest` to `themeFromRequestLegacy` throughout workers/app.ts and
 * the gate stayed GREEN, because the longer name CONTAINS the shorter one.
 *
 * That is hard rule 10's unanchored-needle class, and it is structural in this
 * repository rather than a one-off: `check:head`/`check:headers` and
 * `check:content`/`check:contrast` are the recorded prefix pairs, and an
 * identifier plus a suffix is the same trap wearing a different hat. Anchor
 * every needle that verifies a NAME.
 */
ok(
  "theme: the page imports the resolver",
  /from\s+["']~\/lib\/theme["']/.test(playgroundSource) &&
    /\bthemeFromRequest\b/.test(playgroundSource),
  "the demo must call the real resolver, not restate its rules",
);
/*
 * THE DEMO'S CENTRAL CLAIM, ANCHORED. Its lede says this is the function the
 * Worker calls on every request. That is a sentence about another file, so it
 * is checked against that file rather than left as prose: if the Worker ever
 * stops resolving the theme this way, the claim goes red here instead of
 * quietly becoming a boundary note that aged (hard rule 7).
 */
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

/* -- behavioural: the markdown pipeline ----------------------------------- */

/*
 * RENDER EACH SNIPPET THROUGH `renderBody`, the one call the deploy build makes
 * for every post, the editor preview makes on every keystroke and the operator
 * API makes on every save.
 *
 * ASYNC, so this block is a labelled scope rather than a bare loop: the rest of
 * this gate is synchronous and top-level await is what keeps the executed-count
 * arithmetic below honest about having run.
 *
 * THE EXPECTED VALUES ARE HAND-WRITTEN. Fixture independence again, and the
 * `throws` row is the one that needs it most: a captured fixture would record
 * whatever the pipeline did, including nothing, and the whole point of the
 * third snippet is that the pipeline MUST refuse it.
 *
 * The image resolver REFUSES, exactly as the route's does. A snippet that grows
 * a media citation has to fail here rather than reach a bucket.
 */
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

    /*
     * A SNIPPET MAY NOT CITE MEDIA, asserted on the SOURCE rather than only by
     * the resolver throwing. The resolver's throw arrives as a render failure,
     * which names the wrong cause: it would read as the pipeline refusing the
     * snippet when what happened is that the snippet asked for something this
     * demo will not do.
     */
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
      /*
       * THE REFUSAL NAMES THE CAUSE. A throw alone is not the property: the
       * ruling is that an unimplemented directive is a NAMED build error rather
       * than a silent empty div, and a message that did not name the directive
       * would satisfy a bare throws check while failing the actual promise.
       */
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

    /*
     * A DEMOTED URL MUST NOT SURVIVE AS AN HREF, which is the whole claim and
     * is NOT implied by the count. The demotion renders the markdown that
     * produced it as escaped TEXT, so the URL appears in the document; what
     * must not appear is an attribute carrying it.
     */
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

  /*
   * BRANCH COVERAGE. Each of these is a pipeline behaviour a PUBLISHED ARTICLE
   * cannot demonstrate, which is the demo's entire reason for existing: a
   * published article is by definition one that tripped none of the refusals.
   */
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

/* -- the markdown demo is WIRED to the pipeline, and bounded -------------- */

/*
 * A TWO-FILE CHAIN, so both links are asserted. The route calls a server
 * wrapper and the wrapper calls the shared renderer; checking only the route
 * would prove it calls SOMETHING, and checking only the wrapper would prove
 * nothing about what the page does.
 */
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
/*
 * THE BOUND IS THE ENUM, asserted on CODE. This is the assertion that keeps the
 * deferred entry honest: the free-text form is still deferred, and the way that
 * stays true is that the loader selects from the manifest's slugs rather than
 * reading a body out of the query string.
 */
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
/*
 * THE DEFERRED ENTRY STILL REFUSES THE TEXT BOX. Narrowing an entry is a
 * legitimate move; deleting it because a NEIGHBOURING form shipped is how a
 * stated absence quietly becomes a claim of completeness.
 */
ok(
  "markdown: the free-text form is still stated as deferred",
  deferredDemos.some(
    (/** @type {any} */ d) =>
      /markdown/i.test(d.slug ?? "") && /threat model/i.test(d.reason ?? ""),
  ),
  "the fixed-snippet demo shipping does not settle arbitrary text into the " +
    "highlighter, and the page must keep saying so",
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
/*
 * EITHER SPELLING SATISFIES THIS, and the widening is deliberate rather than a
 * loosening. The needle was /SHARED_CACHE_CONTROL/ against this route's source,
 * which stopped matching the day the four identical headers() bodies were
 * replaced by one publicHtmlHeaders() helper: the route still sets an explicit
 * Cache-Control, it just no longer names the constant.
 *
 * The claim being made is "this route sets one", not "this route spells it a
 * particular way", so the assertion now accepts the helper OR the constant and
 * still requires the headers() export. A route that exports nothing fails, which
 * is the state the assertion exists for.
 */
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

/*
 * WHOLE-GATE EXECUTED-COUNT FLOOR.
 *
 * The projects and playground sections already floor THEMSELVES, and that is
 * not the same guarantee: a section floor cannot see a DIFFERENT section
 * stopping, and this gate has several unfloored ones ahead of them (the feature
 * roster, the anchors, the enhancement inventory, the colophon page records).
 * Each section floor is a local witness; this is the global one.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it. Never summed, and
 * the habit of summing is why: 91 was guessed against 154 measured for the
 * projects section in this very file.
 *
 * **RE-MEASURED 2026-08-30, twice in one day: 715 after the roster build-out and
 * 801 after the key demo, 854 after the theme demo and 887 after the markdown
 * demo, against 583 on 2026-08-14.**
 *
 * Floored at 660, roughly 7 percent. More slack than the small gates get,
 * because this count moves with the CORPUS: posts, tags, projects and demos all
 * feed it, so ordinary content work shifts it by tens.
 */
const MINIMUM_CHECKS = 864;
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
