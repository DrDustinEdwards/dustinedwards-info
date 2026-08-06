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

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { COLOPHON_ANCHORS } from "../app/lib/colophon-sections.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEATURES_PATH = join(root, "content", "features.json");
const ROUTES_PATH = join(root, "app", "routes.ts");

let checks = 0;
let failures = 0;

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
  const source = readFileSync(ROUTES_PATH, "utf8")
    // Comments first: this file's own prose names paths like /phage-discovery
    // and /colophon, and a scan that read them would report routes that are
    // only mentioned. Same trap check:logo and check:contrast both hit.
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

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
ok(
  "routes.ts parsed to a plausible number of routes",
  routes.size >= 10,
  `parsed ${routes.size}; the parser has probably stopped matching this file's style`,
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
      const present =
        Boolean(file) && existsSync(file)
          ? readFileSync(file, "utf8").includes(anchor.text)
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
