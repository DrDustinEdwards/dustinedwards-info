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
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(root, "scripts");

/**
 * Floors, MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-11: 32 scripts
 * and 484 assertion sites, after comment-stripping and self-exclusion. A raw
 * count before stripping reads differently, and taking that would put the floor
 * above what the gate can actually see.
 *
 * Set well under, because their job is catching a BROKEN SCAN, which reports
 * zero or near-zero, not tracking growth. A tight floor would fail on ordinary
 * refactoring while detecting nothing extra.
 */
const MINIMUM_FILES = 24;
const MINIMUM_SITES = 360;

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
const files = readdirSync(SCRIPTS)
  .filter((f) => f.endsWith(".mjs"))
  .sort()
  .map((name) => ({ name, path: join(SCRIPTS, name) }))
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
const ASSERTERS = /\b(check|ok|assert|eq)\s*\(/;

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
  /\b(?:check|ok|assert|eq)\s*\(\s*(?:(?:"[^"]*"|'[^']*'|`[^`]*`)\s*,\s*)?true\s*[,)]/g;

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
      if ((docNames.has(root) || DOC_VARS.test(root)) && !/^(?:key|prefix)$/.test(needle)) {
        record("b:unscoped-document-match");
      }
    }

    // (d) RegExp from a joined derived list with no guard nearby
    if (/new RegExp\([^)]*\.join\(\s*["'`]\|["'`]\s*\)/.test(line)) {
      const window = lines.slice(Math.max(0, i - 12), i).join("\n");
      const guarded = /\.length\s*(>|>=|===|!==)/.test(window) || /length\s*>\s*0/.test(line);
      if (!guarded) record("d:unguarded-derived-regexp");
    }

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

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
