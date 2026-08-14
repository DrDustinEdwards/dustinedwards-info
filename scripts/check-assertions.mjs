/**
 * Gate: lint the OTHER gates for assertions that cannot fail.
 *
 *   npm run check:assertions
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT LINTS TEXT PATTERNS. It cannot judge whether a scoped assertion is
 * MEANINGFUL.** `check("x", page.includes(">Roster<"))` passes this lint and
 * would still be worthless if `>Roster<` appeared in the nav on every page. The
 * lint proves an assertion is DELIMITED, not that the delimitation is the right
 * one. That judgement stays with whoever writes the assertion.
 *
 * It reads source text, so it cannot execute a condition to see whether it can
 * vary. Rule (c) below is the honest casualty of that: it is skipped.
 *
 * It scans `scripts/*.mjs` ONLY. `app/` is tsc's jurisdiction: rule (e)'s class
 * there is a typecheck failure once the map is keyed by its union, which is
 * strictly stronger than a lint and was already applied to `WHY_LABEL`.
 *
 * ## Why this exists
 *
 * Hard rule 10, and the ruling in decisions.md 2026-08-10. Seven instances have
 * been measured in this repo, by hand, one at a time:
 *
 *   - three assertions in verify-live that could not fail, found by audit
 *   - `check:claude-md` shipped a 10,000 character ceiling on an 8,479
 *     character file, so the threshold was unreachable
 *   - `check:secrets` had an allowlist loop that iterated zero times
 *   - `check:invariants` section 7 built a RegExp from a derived list with no
 *     non-empty guard, so an empty list matched every literal
 *   - a `grep -c "check:head"` matched `check:headers` and reported a
 *     recursion guard as broken when it was not
 *
 * Every one was found by a person looking. That is not a mechanism.
 *
 * ## THE RULES
 *
 * (a) LITERAL CONDITION. `check(true, …)`, `ok(false, …)`, or a condition
 *     comparing two constants declared in the same file. Cannot vary with the
 *     thing under test.
 *
 * (b) UNSCOPED WHOLE-DOCUMENT MATCH. `X.includes("literal")` where `X` is a
 *     whole document (a `readFileSync` result, or a fetched body). The
 *     delimited form is `>${name}<` or a region slice. Every flagged site is
 *     either fixed or carries a `SCOPED-BY` comment naming the delimitation.
 *     No blanket excludes, because a blanket exclude is how the next one hides.
 *
 * (c) UNREACHABLE THRESHOLD. SKIPPED, DELIBERATELY. Deciding that a threshold
 *     exceeds an input's reachable range needs the input, and the input is
 *     usually a file the gate reads at runtime. A static lint would have to
 *     execute the gate to know, which is a different tool. The class is real
 *     (check:claude-md shipped one) and is left to plants and review.
 *
 * (d) UNGUARDED DERIVED REGEXP. `new RegExp` built by `.join("|")` over a
 *     derived array with no non-empty check between derivation and use. An
 *     empty alternation matches the empty string, so it matches everything.
 *
 * (e) SUBSTITUTING FALLBACK ON A CONST MAP. `CONST_MAP[expr] ?? …` in a gate,
 *     unless the site carries a `JUSTIFIED SUBSTITUTION` comment.
 *
 * FAILS CLOSED. Zero files scanned, or zero assertion sites found, is a
 * failure: a broken matcher reports the same clean sweep as a clean repo.
 *
 * ## It also asserts OBSERVATION BOUNDARY presence (gate-backlog item 11)
 *
 * Every `scripts/check-*.mjs` and `verify-live.mjs` must state what it cannot
 * see, in its header. Same file set, read fresh rather than through the lint's
 * self-exclusion, so this file is not the one gate exempt from the rule.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(root, "scripts");

/**
 * Floors, MEASURED THROUGH THIS GATE'S OWN PIPELINE, after comment-stripping
 * and self-exclusion. A raw count before stripping reads differently, and
 * taking that would put a floor above what the gate can actually see.
 *
 * MINIMUM_SITES: was 360 against a then-measured 484, RE-MEASURED 595 this
 * session, now 520 (about 13 percent under).
 *
 * The old pair was set "well under" on the reasoning that a floor's job is
 * catching a scan that returns zero. That reasoning is half right and the half
 * it misses is the one that bites: 360 against 595 left a 39 percent blind
 * zone, so a third of the gate scripts could stop being read while the floor
 * reported itself satisfied. The failure that actually happens is partial, not
 * total. Same lesson as verify-live's 90-against-206.
 *
 * MINIMUM_FILES stays at 24 against 33: the file list is a directory read
 * rather than a parse, it moves by one when a gate is added, and the count is
 * printed every run.
 */
const MINIMUM_FILES = 24;
const MINIMUM_SITES = 520;

let checks = 0;
let failures = 0;

/** @param {string} label @param {boolean} condition @param {string} [detail] */
function ok(label, condition, detail = "") {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

/**
 * Comments stripped before anything is matched. This file's own prose quotes
 * every pattern it forbids, and so do several gate headers. A matcher reading
 * prose would report the explanation as the violation, which is the trap
 * check:logo, check:contrast, check:features, check:headers, check:urls,
 * check:secrets and check:invariants have each hit.
 *
 * @param {string} source
 */
function stripped(source) {
  return source
    /*
     * LINE STRUCTURE IS PRESERVED. A block comment is replaced by the SAME
     * NUMBER OF NEWLINES it spanned, not by a single space.
     *
     * The first draft collapsed them, so stripped line indices drifted from raw
     * ones by the height of every docblock above. Two consequences, both seen
     * on this lint's own second run: every reported line number was wrong (the
     * Roster site reported as 475 and is at 596), and the `SCOPED-BY` and
     * `JUSTIFIED SUBSTITUTION` lookups read the wrong raw lines, so
     * check-all.mjs's REMOTE_ARGS was reported despite carrying its marker
     * since 73fc7af.
     */
    .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) ?? []).length))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

console.log("\ncheck:assertions\n");

if (!existsSync(SCRIPTS)) {
  console.log("  FAIL  scripts/ is missing.\n");
  process.exit(1);
}

/*
 * Read as BYTES first. A file carrying a NUL is invisible to text tooling, and
 * this lint exists to notice things other tools miss; skipping the file class
 * most likely to hide something would be the joke writing itself.
 */
/**
 * RECURSIVE, since 2026-08-11. `scripts/lib/` was outside this lint entirely,
 * because `readdirSync` does not descend and nobody had said so.
 *
 * Ten modules with twenty-two importers sat there unlinted, including
 * `sqlite-tables.mjs`, the single table classifier that `check:backup` and
 * `check:invariants` section 7 both depend on. The external audit proved it:
 * identical unguarded-alternation code was flagged in `check-logo.mjs` and
 * invisible in `lib/sqlite-tables.mjs`.
 */
/** @param {string} dir @param {{name: string, path: string}[]} out */
function scriptFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) scriptFiles(path, out);
    else if (entry.name.endsWith(".mjs")) out.push({ name: relative(SCRIPTS, path).split(sep).join("/"), path });
  }
  return out;
}

const files = scriptFiles(SCRIPTS)
  .sort((a, b) => a.name.localeCompare(b.name))
  // Self-exclusion: this file's failure messages and regexes name every
  // pattern it forbids. Same shape as check-invariants section 1 and 5.
  .filter((f) => f.name !== "check-assertions.mjs");

/** @type {{rule: string, file: string, line: number, text: string}[]} */
const findings = [];
let sitesScanned = 0;
let filesScanned = 0;

/**
 * Every assertion helper defined in this repo's gates.
 *
 * `eq` is here because check-logo.mjs defines its own. The first draft knew
 * only check/ok/assert and was therefore blind to that entire file's
 * assertions, which the rule-(a) plant exposed.
 */
const ASSERTERS = /\b(check|ok|assert|assertThat|eq)\s*\(/;

/**
 * (a) A literal `true` as the CONDITION. Matched across lines.
 *
 * The dominant call shape here is multi-line:
 *
 *     ok(
 *       "label",
 *       condition,
 *     );
 *
 * A per-line rule sees `ok(` and `true,` on different lines and matches
 * neither. Both plants written for this rule PASSED against the line-scoped
 * first draft, which is the exit-1-is-not-evidence trap aimed at the lint
 * itself. It now scans the whole source and maps the match index to a line.
 *
 * ONLY `true`. A literal `false` is an unconditional FAILURE report, the
 * opposite of vacuous, and both sites in this repo sit in a catch block
 * reporting a caught error.
 */
const LITERAL_TRUE =
  /\b(?:check|ok|assert|assertThat|eq)\s*\(\s*(?:(?:"[^"]*"|'[^']*'|`[^`]*`)\s*,\s*)?true\s*[,)]/g;

/** Whole-document variable names: fetched bodies and whole-file reads. */
const DOC_VARS =
  /\b(page|body|text|html|css|source|contents?|sitemap|llms|colophon|home|post|raw|code|doc)\b/;

for (const { name, path } of files) {
  const source = readFileSync(path).toString("utf8");
  const code = stripped(source);
  const lines = code.split("\n");
  /*
   * The RAW lines are kept alongside the stripped ones, and the marker lookups
   * below use RAW. `stripped()` removes comments, and `SCOPED-BY` and
   * `JUSTIFIED SUBSTITUTION` are comments: looking for them in stripped code
   * finds nothing, so every properly-annotated site reported as a violation.
   * Found on this lint's first run, which flagged check-all.mjs's REMOTE_ARGS
   * despite it carrying the marker since 73fc7af.
   */
  const rawLines = source.split("\n");
  filesScanned += 1;

  /** Names assigned from a whole-file read or a fetched body, in this file. */
  const docNames = new Set();
  for (const m of code.matchAll(
    /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:readFileSync|res\.text\(\)|response\.text\(\))/g,
  )) {
    docNames.add(m[1]);
  }
  for (const m of code.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?get\(/g)) {
    docNames.add(m[1]);
  }

  // (a) runs over the WHOLE source, because the calls span lines.
  for (const m of code.matchAll(LITERAL_TRUE)) {
    findings.push({
      rule: "a:literal-condition",
      file: name,
      line: (code.slice(0, m.index ?? 0).match(/\n/g) ?? []).length + 1,
      text: m[0].replace(/\s+/g, " ").slice(0, 110),
    });
  }

  /*
   * (d) also spans lines, and for the same reason rule (a) did. The real
   * construction in check-invariants section 7 is:
   *
   *     const COUNT_INDEX = new RegExp(
   *       `COUNT…(${classified.virtual.join("|")})\\b`,
   *       "i",
   *     );
   *
   * `new RegExp(` and `.join("|")` sit on different lines, so a per-line rule
   * matched NEITHER construction in the one file this rule was written about,
   * and the plant for it passed. Same defect as rule (a), found the same way.
   *
   * THE GUARD LOOKUP IS EXACT, NOT PROXIMITY. The first fix asked whether any
   * `.length` comparison sat within 600 characters, and reported the real
   * check-invariants as unguarded: its guards are genuine and sit twenty-eight
   * lines up, past two multi-line detail strings. Widening the window until
   * that one passed would have been tuning the rule to the file.
   *
   * So the base being joined is extracted and looked up by NAME:
   *
   *     classified.virtual.join("|")   ->  base `classified.virtual`
   *     owned.map(…).join("|")         ->  base `owned`
   *
   * and the guard must be a `.length` COMPARISON on that base, anywhere earlier
   * in the file. An array guarded by some other array's length is not guarded.
   */
  /*
   * Every `<base>.join("|")` in the file, and the variable it was assigned to
   * when it was assigned to one. BOTH forms occur in the one file this rule was
   * written about, on consecutive lines:
   *
   *     const owningAlternation = owned.map(…).join("|");          assigned
   *     const DELETE_FTS = new RegExp(`…(${owningAlternation})…`)  used later
   *     const COUNT_INDEX = new RegExp(`…(${classified.virtual.join("|")})…`)
   *
   * A rule that saw only the direct form would miss DELETE_FTS entirely.
   */
  /*
   * The base must sit ADJACENT to `.join(`, optionally through one chained call
   * such as `.map(…)`. A looser "identifier, then anything, then .join(" read
   * `new` out of `new RegExp(` itself and `owned.map` out of `owned.map(…)`,
   * reporting guards on `new.length` and `owned.map.length`, neither of which
   * is a thing. Two false positives from one sloppy capture.
   */
  const JOINED =
    /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)(?:\.[A-Za-z_$]\w*\([\s\S]{0,200}?\))?\.join\(\s*["'`]\|["'`]\s*\)/g;

  /*
   * NO LITERAL-ARRAY EXEMPTION, and that is a decision rather than an omission.
   *
   * A draft exempted bases assigned from an array literal, on the reasoning
   * that `const SECRETS = ["GOOGLE_CLIENT_ID", …]` cannot go empty behind your
   * back. It was written because check:secrets' join was reported and looked
   * like a false positive. It was not one: check-secrets.mjs:139 already
   * asserts `SECRETS.length > 0`, so the site passes on its own merits and the
   * exemption was never what saved it.
   *
   * Enumerated before removing it: THREE join-into-RegExp sites exist in this
   * repo, all three are genuinely guarded, and ZERO depended on the exemption.
   * An exclusion that excludes nothing today can only ever hide the next
   * finding, so it is gone and the rule is strictly stronger without it.
   */

  /** @type {Map<string, string>} variable name -> the base joined into it */
  const alternationVars = new Map();
  for (const m of code.matchAll(new RegExp(`(?:const|let)\\s+(\\w+)\\s*=\\s*${JOINED.source}`, "g"))) {
    alternationVars.set(m[1], m[2]);
  }

  /** @param {string} base @param {number} index @param {string} how */
  function checkGuard(base, index, how) {
    // Escaped for the lookup: the base carries dots, which are regex wildcards.
    const guard = new RegExp(
      `${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.length\\s*(?:>|>=|===|!==|<)`,
    );
    if (guard.test(code.slice(0, index))) return;
    findings.push({
      rule: "d:unguarded-derived-regexp",
      file: name,
      line: (code.slice(0, index).match(/\n/g) ?? []).length + 1,
      text: `${how}, with no ${base}.length guard above it`,
    });
  }

  for (const m of code.matchAll(/new RegExp\(/g)) {
    const open = m.index ?? 0;
    /*
     * The construction runs to the end of its statement. Bounded rather than
     * brace-matched: this is a lint over text, and a 400 character reach covers
     * every construction in this repo without running into the next one.
     */
    const region = code.slice(open, open + 400).split(";")[0];

    // Direct: the join happens inside the construction.
    for (const j of region.matchAll(new RegExp(JOINED.source, "g"))) {
      checkGuard(j[1], open, `${j[1]} joined into a RegExp`);
    }
    // Indirect: the construction interpolates a variable that was joined above.
    for (const v of region.matchAll(/\$\{\s*(\w+)\s*\}/g)) {
      const base = alternationVars.get(v[1]);
      if (base) checkGuard(base, open, `${v[1]} (joined from ${base}) interpolated into a RegExp`);
    }
  }

  lines.forEach((line, i) => {
    const at = i + 1;
    /** @param {string} rule */
    const record = (rule) => findings.push({ rule, file: name, line: at, text: line.trim().slice(0, 110) });

    // Count assertion sites, which is the anti-vacuity denominator.
    if (ASSERTERS.test(line)) sitesScanned += 1;

    /*
     * (b) Unscoped whole-document match, with a LITERAL or a VARIABLE needle.
     *
     * The variable form is the one that matters and the first draft missed it:
     * `page.includes(f.name)` sweeping a list of names against a whole document
     * is exactly the colophon defect, and it carries no string literal to
     * match on. The delimited form is `page.includes(`>${b.name}<`)`.
     */
    const litMatch = line.match(/\b(\w+(?:\.\w+)?)\s*\.\s*includes\s*\(\s*(["'`])([^"'`]{2,})\2\s*\)/);
    const varMatch = line.match(/\b(\w+(?:\.\w+)?)\s*\.\s*includes\s*\(\s*([A-Za-z_$][\w.$]*)\s*\)/);
    const excused = /SCOPED-BY/.test(rawLines[i - 1] ?? "") || /SCOPED-BY/.test(rawLines[i] ?? "");
    /*
     * A NEGATED match is exempt, and that is not a convenience.
     * `!doc.includes(x)` asserts ABSENCE, and absence over a WHOLE document is
     * strictly STRONGER than absence within a region: scoping it would weaken
     * the claim. The vacuity risk runs the other way, on positive matches,
     * where a hit from anywhere on the page satisfies an assertion about one
     * element. Four of this lint's first-run findings were correct-by-design
     * negatives.
     */
    const negated = /[!(]\s*\w+(?:\.\w+)?\s*\.\s*includes\s*\(/.test(line);
    if (litMatch && !excused && !negated) {
      const [, subject, , needle] = litMatch;
      const scoped = /^[>[]/.test(needle) || /[<\]]$/.test(needle) || needle.includes("${");
      const root = subject.split(".")[0];
      if ((docNames.has(root) || DOC_VARS.test(root)) && !scoped) {
        record("b:unscoped-document-match");
      }
    }
    if (varMatch && !litMatch && !excused && !negated) {
      const [, subject, needle] = varMatch;
      const root = subject.split(".")[0];
      // A bare identifier needle carries no delimiter by construction.
      /*
       * NO NEEDLE-NAME EXEMPTION. A draft excused needles literally named `key`
       * or `prefix`, on the theory that those are keys rather than page text.
       * The pre-audit sweep tested it by removal and the result was IDENTICAL:
       * nothing in this repo depended on it. An exclusion that excludes nothing
       * is surface area, and this one would have silently excused a genuine
       * unscoped match the day someone named a variable `key`.
       */
      if (docNames.has(root) || DOC_VARS.test(root)) {
        record("b:unscoped-document-match");
      }
    }

    /*
     * (d) IS NOT HERE. It runs over the whole source above, because the
     * constructions span lines.
     *
     * The per-line version lived here until 2026-08-11 and was SUPERSEDED, not
     * kept as a second opinion. It survived this long by accident: the
     * source-wide rewrite was reverted by a restore during plant 7b and the
     * re-apply added the new block without removing the old one, so both sat in
     * the file for a commit. Two implementations of one rule means either a
     * duplicated finding or, as measured here, a real construction reported
     * once because the old rule's twelve-line proximity window found an
     * unrelated `.length` and called it guarded. That window is the heuristic
     * the rewrite replaced with an exact base-identifier lookup.
     */

    // (e) const-map fallback in a gate. Marker read from RAW lines: it is a
    // comment, and stripped() would have removed it.
    if (/\b[A-Z][A-Z0-9_]{2,}\s*\[[^\]]+\]\s*(\?\?|\|\|)/.test(line)) {
      const window = rawLines.slice(Math.max(0, i - 8), i + 1).join("\n");
      if (!/JUSTIFIED SUBSTITUTION/.test(window)) record("e:const-map-fallback");
    }
  });
}

/* ------------------------------------------------------- anti-vacuity ---- */

ok(
  "the lint examined a plausible number of gate scripts",
  filesScanned >= MINIMUM_FILES,
  `${filesScanned} scanned; expected at least ${MINIMUM_FILES}`,
);
ok(
  "the lint found assertion sites to examine",
  sitesScanned >= MINIMUM_SITES,
  `${sitesScanned} check/ok/assert site(s) found; expected at least ${MINIMUM_SITES}. ` +
    `A broken matcher reports the same clean sweep as a clean repo.`,
);


/** @type {Map<string, {file: string, params: string}[]>} */
const signatures = new Map();
for (const { name, path } of files) {
  const src = readFileSync(path).toString("utf8").replace(/\r\n/g, "\n");
  for (const m of src.matchAll(
    /^(?:export\s+)?(?:function|const)\s+(ok|check|assert|assertThat|eq|fail)\b[^\n]*?\(([^)]*)\)/gm,
  )) {
    const first = m[2].split(",")[0].trim().replace(/\s*=.*$/, "");
    const list = signatures.get(m[1]) ?? [];
    list.push({ file: name, params: first });
    signatures.set(m[1], list);
  }
}


/* ----------------------- (g) a STRING LITERAL in the condition slot -------- */

/*
 * The other half of the tenth class, and the half the rename does not reach.
 *
 * Giving the two shapes two names removes the CAUSE (one name meaning two
 * things). It does not stop someone hand-writing
 *
 *     assert(1 === 2, "AUDIT: a false condition that must fail");
 *
 * in a label-first gate. Measured after the rename: still 98 checks, 0
 * failures. The string lands in the condition slot, is truthy, and the check
 * count goes UP. Rule (a) matches the literal `true` and never saw it.
 *
 * So the condition-position argument is examined directly. Which position that
 * is comes from the helper's own definition, harvested above, rather than being
 * assumed: label-first helpers are checked at argument 2, condition-first at
 * argument 1.
 */

/** Splits a call's arguments at top level, ignoring commas inside nesting. */
function topLevelArgs(/** @type {string} */ inner) {
  const args = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (let i = 0; i < inner.length; i += 1) {
    const c = inner[i];
    if (quote) {
      current += c;
      if (c === quote && inner[i - 1] !== "\\") quote = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; current += c; continue; }
    if ("([{".includes(c)) depth += 1;
    if (")]}".includes(c)) depth -= 1;
    if (c === "," && depth === 0) { args.push(current.trim()); current = ""; continue; }
    current += c;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

/** helper name -> index of the argument that carries the CONDITION. */
const conditionIndex = new Map();
for (const [helper, defs] of signatures) {
  const first = defs[0]?.params ?? "";
  if (helper === "fail") continue; // reports, takes no condition
  conditionIndex.set(helper, /^(ok|condition)$/.test(first) ? 0 : 1);
}

for (const { name, path } of files) {
  const code = stripped(readFileSync(path).toString("utf8").replace(/\r\n/g, "\n"));
  for (const m of code.matchAll(/\b(check|ok|assert|assertThat|eq)\s*\(/g)) {
    const idx = conditionIndex.get(m[1]);
    if (idx === undefined) continue;
    const open = (m.index ?? 0) + m[0].length - 1;
    let depth = 0;
    let end = open;
    for (let i = open; i < code.length; i += 1) {
      if (code[i] === "(") depth += 1;
      else if (code[i] === ")") { depth -= 1; if (depth === 0) { end = i; break; } }
    }
    const arg = topLevelArgs(code.slice(open + 1, end))[idx];
    if (!arg) continue;
    if (!/^["'`]/.test(arg)) continue;
    findings.push({
      rule: "g:string-literal-condition",
      file: name,
      line: (code.slice(0, m.index ?? 0).match(/\n/g) ?? []).length + 1,
      text: `${m[1]}(...) argument ${idx + 1} is a string literal, which is always truthy`,
    });
  }
}

/* ------------------------------- helper signature consistency (f) --------- */

/*
 * ONE HELPER NAME, ONE ARGUMENT ORDER. The tenth vacuity class, found by the
 * external audit of 2026-08-11 and not by anything here.
 *
 * `assert()` was defined SEVEN times across the gates with FOUR argument
 * orders: three took the condition first, four took the label first. An
 * assertion copied between two of them lands a non-empty STRING in the
 * condition slot. A string is truthy, so the assertion can never fail, and the
 * `checks` counter still increments, so the gate reports MORE coverage than
 * before. Both directions were demonstrated:
 *
 *   assert(1 === 2, "must fail")  in a label-first gate  -> 98 checks, 0 failures
 *   assert("must fail", 1 === 2)  in a condition-first gate -> 7 checks, 0 failures
 *
 * Rule (a) did not see either, because it matches the literal `true` and these
 * conditions are strings.
 *
 * THE REPAIR WAS A RENAME, not an argument swap. Swapping 58 call sites at the
 * end of a long session is exactly the operation that silently inverts an
 * assertion, which is the failure this whole file exists to prevent. The three
 * condition-first helpers are now `assertThat`, so the two shapes have two
 * names and a copy between them is a ReferenceError rather than a silent pass.
 *
 * This assertion is what keeps it that way: it does not care WHICH order a name
 * uses, only that every definition of that name agrees.
 */
// NON-EMPTY SCOPE: no helper definitions found means the matcher stopped
// matching and every consistency claim below would be about nothing.
ok(
  "the signature scan found assertion helpers to compare",
  signatures.size >= 4,
  `${signatures.size} helper name(s) found across ${files.length} file(s); the ` +
    `definition matcher has stopped reading this repo's style.`,
);

for (const [helper, defs] of [...signatures].sort()) {
  const orders = new Set(defs.map((d) => d.params));
  ok(
    `${helper}() takes the same first argument everywhere it is defined`,
    orders.size === 1,
    defs.map((d) => `${d.file}: ${helper}(${d.params}, ...)`).join("\n        ") +
      `\n        ${orders.size} different first arguments for one name. An assertion ` +
      `copied between these files puts a truthy STRING in the condition slot, can ` +
      `never fail, and still increments the check count. Give the shapes different ` +
      `names, or make them agree.`,
  );
}

/* -------------------------------------- OBSERVATION BOUNDARY presence ----- */

/*
 * Gate-backlog item 11. Every gate script and `verify-live` states what it
 * CANNOT see, in its header. That has been true by discipline since the
 * practice started, and discipline is what this file exists to replace.
 *
 * Hard rule 7 is the reason: a gate that feeds a module its own stored output
 * cannot see what the transport does to the input, and a gate that byte-compares
 * an artifact against a fresh generation compares the wrong output to itself and
 * agrees. A gate shipped without that note is a gate whose blind spot nobody
 * wrote down, and the blind spot is the part that bites.
 *
 * SCOPE, and why it is not the lint's own file list: the lint above EXCLUDES
 * check-assertions.mjs, because its failure messages quote every pattern it
 * forbids. That exclusion must not leak into this assertion, or this file would
 * be the one gate allowed to ship without a boundary note. Read fresh.
 *
 * `check-all.mjs` is a RUNNER rather than a gate and is included anyway: it
 * carries a note, and the note it carries is a real one (it cannot tell a gate
 * that passed from one that passed vacuously).
 */

/** MEASURED 2026-08-11: the deepest occurrence across 25 files is line 7. */
const HEADER_LINES = 60;

/** Floor. 25 files carry it today; below this the scan has stopped matching. */
const MINIMUM_BOUNDARY_FILES = 23;

const BOUNDARY_MARKER = "OBSERVATION BOUNDARY";

const boundaryFiles = readdirSync(SCRIPTS)
  .filter((name) => (name.startsWith("check-") || name === "verify-live.mjs") && name.endsWith(".mjs"))
  .sort();

ok(
  "the boundary scan found gate scripts to examine",
  boundaryFiles.length >= MINIMUM_BOUNDARY_FILES,
  `${boundaryFiles.length} file(s) matched; expected at least ${MINIMUM_BOUNDARY_FILES}. ` +
    `An empty list would report every gate compliant by examining none.`,
);

let boundaryCarrying = 0;
for (const name of boundaryFiles) {
  // BYTES first, same reason as the lint above: a file carrying a NUL is
  // invisible to text tooling, and that is the file most likely to hide one.
  const header = readFileSync(join(SCRIPTS, name))
    .toString("utf8")
    .split("\n")
    .slice(0, HEADER_LINES)
    .join("\n");
  const carries = header.includes(BOUNDARY_MARKER);
  if (carries) boundaryCarrying += 1;
  ok(
    `boundary: ${name} states what it cannot see`,
    carries,
    `no ${BOUNDARY_MARKER} note in the first ${HEADER_LINES} lines. Hard rule 7: a gate ` +
      `that ships without naming its blind spot is a gate whose blind spot nobody wrote down.`,
  );
}

/* ------------------------------------------------------------- findings -- */

const RULES = {
  "a:literal-condition":
    "a condition that is a literal cannot vary with the thing under test",
  "b:unscoped-document-match":
    "an unscoped whole-document match passes on text from anywhere on the page. " +
    "Delimit it (the `>${name}<` form) or add a SCOPED-BY comment naming the delimitation",
  "d:unguarded-derived-regexp":
    "an empty alternation matches the empty string, so it matches everything. " +
    "Guard the derived list non-empty between derivation and construction",
  "g:string-literal-condition":
    "a string literal in the condition slot is always truthy, so the assertion cannot " +
    "fail while still incrementing the check count. Check the helper argument order",
  "e:const-map-fallback":
    "a substituting fallback on a const map hides a missing key. Type the map by its " +
    "union, or mark the site JUSTIFIED SUBSTITUTION with the reason",
};

for (const [rule, why] of Object.entries(RULES)) {
  const hits = findings.filter((f) => f.rule === rule);
  ok(
    `no ${rule} findings`,
    hits.length === 0,
    hits.map((h) => `${h.file}:${h.line}  ${h.text}`).join("\n        ") + `\n        ${why}`,
  );
}

console.log(
  `  ${filesScanned} script(s), ${sitesScanned} assertion site(s), ` +
    `${findings.length} finding(s), rule (c) skipped by design`,
);

/*
 * EXECUTED-COUNT FLOOR, and this gate is the one that most needs one.
 *
 * MINIMUM_SITES and MINIMUM_FILES above floor the SCOPE: how much source was
 * read. This floors how much was ASSERTED about it, and the two catch different
 * bugs. Measured while retrofitting this floor: emptying the per-file scan loop
 * left `checks` at 41, unchanged, because the scan feeds the scope counters
 * rather than the assertion counter. The scope floors caught that plant
 * correctly, and this floor would not have. The reverse case, an assertion
 * block that stops running over a scope that is still full, is the one only
 * this can see.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 41.
 * Never summed. Floored at 38, slack of three: most of the count is the
 * per-file OBSERVATION BOUNDARY assertion, so it steps by one when a gate
 * script is added.
 */
const MINIMUM_CHECKS = 38;
if (checks < MINIMUM_CHECKS) {
  ok(
    "this gate executed its assertions",
    false,
    `only ${checks} ran, expected at least ${MINIMUM_CHECKS}. A block was SKIPPED ` +
      `rather than failing. Measured: 41.`,
  );
}

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
