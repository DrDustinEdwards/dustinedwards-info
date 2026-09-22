/**
 * WHICH ASSETS THE REPOSITORY ITSELF REFERENCES, and where.
 *
 * PURE and `.mjs`, so the build script, the gate and the unit tests all run the
 * same code. The scan itself is the only thing that touches a filesystem, and it
 * lives in `scripts/build-template-refs.mjs`; everything that DECIDES anything
 * is here.
 *
 * ## WHY THIS EXISTS
 *
 * The media library knew two things about usage and both were about POSTS:
 * `media_refs`, which the publish pipeline writes when a renderer emits a
 * citation, and `resolveCitations`, which scans the posts artifact for a literal
 * URL. Neither can see an asset placed by ROUTE CODE, so the nine cohort
 * photographs on the roster page read as unreferenced, and the page said so on
 * every one of them.
 *
 * That is not a cosmetic problem. It is the page telling its only reader that
 * nine files nothing cites are sitting in the bucket, next to a delete button.
 * The honest answer needs a third state, and the third state needs evidence.
 *
 * ## WHERE IT CAN RUN, WHICH IS NOT WHERE YOU WOULD EXPECT
 *
 * **Not at request time.** The Worker has no repository. It has an ASSETS
 * binding whose entire API is `fetch()`, so it can serve a path and cannot
 * discover one, which is the same constraint that made `assets.json` necessary.
 *
 * **Not at rebuild time either, and this is the part worth writing down.**
 * `rebuildMediaIndex` reads like the natural home for it, and it is not: that
 * function runs INSIDE the Worker. It has DB, MEDIA, IMAGES and ASSETS, and it
 * has no more access to `app/data/phage-hunters.ts` than any other request does.
 * Storing the answer in D1 does not help, because something still has to compute
 * it, and nothing inside the Worker can.
 *
 * **So it runs at BUILD time and ships as a committed artifact**, the pattern
 * `assets.json` follows: generated, committed, imported at build time and
 * reconciled by a gate. `content/generated/template-refs.json` is committed
 * because it is a repo fact with no database owner, and so is `assets.json`.
 * (Two former members of that set are local build products now: the post
 * corpus, because D1 holds the rendered copy, and `stack.json` as of ruling
 * 39a, because everything it derives from is tracked and committing it made
 * every package.json edit a two-file change no bot could complete.)
 * A build-time import also means the answer cannot drift from the code that
 * produced it: they ship in the same bundle.
 *
 * ## THE MATCH IS LITERAL, AND THAT IS A CHOICE WITH A COST
 *
 * A reference is found by searching source text for the asset path as a LITERAL
 * STRING, the same way `resolveCitations` searches the posts artifact. The
 * alternative, a regex for anything path-shaped, invents references: it matches
 * a route pattern, a comment, a redirect target and a string that merely looks
 * like a file. Starting from the KNOWN asset list and asking "does this exact
 * path appear" cannot produce a reference to a file that does not exist.
 *
 * **THE COST, STATED: a constructed path is invisible.** `/diagrams/${id}.svg`
 * references a real file and this scan will never see it, so those assets read
 * as unattached. That is a false negative in the safe direction (it under-claims
 * usage rather than over-claiming it), and it is the reason the unattached copy
 * says "no reference found" rather than "unused". Closing it would mean
 * evaluating template literals, which is a different and much larger tool.
 */

/**
 * Source roots the scan reads, repo-relative.
 *
 * `content/posts` IS DELIBERATELY ABSENT. Posts are the OTHER tracker's
 * jurisdiction: an asset cited by a post is `used`, not `in template`, and
 * letting this scan see post markdown would make every cited asset claim both
 * states at once. The split is the whole point of having two of them.
 *
 * `public/` is absent for a different reason: a file in `public/` referencing
 * another file in `public/` is real (the webmanifest cites the icons), so
 * `site.webmanifest` is named explicitly below rather than the whole tree being
 * walked, which would have `og-image.png` referenced by nothing but itself.
 */
export const SOURCE_ROOTS = ["app", "workers"];

/** Individual files outside the roots that genuinely cite assets. */
export const SOURCE_FILES = ["public/site.webmanifest", "content/features.json"];

/** Extensions worth reading. Anything else in those trees is not source. */
export const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", ".css", ".json", ".webmanifest"];

/**
 * Paths that reference themselves and must never count as a reference.
 *
 * `assets.json` is the asset INVENTORY, so it contains every asset path by
 * construction. Counting it would mark all 58 static files as referenced by
 * repository code and make the entire third state meaningless.
 *
 * **THIS GUARD IS CHECKED FIRST BECAUSE OF WHERE IT HAS TO WIN, and a plant
 * proved it was doing nothing at all.** Removing the whole check left the gate
 * green, because `content/generated/assets.json` is under `content/`, which is
 * not a source root, so the root rule below already rejected it. The guard was
 * an assertion that could not fail: rule 10's own class, in the module that
 * feeds the usage model.
 *
 * It is load-bearing for `SOURCE_FILES`, not for the roots. Those entries are
 * named individually and BYPASS the root rule entirely, so a self-referential
 * file added there would be read unless this ran first. `assets.json` stays
 * listed as the worked example of what must never be scanned, and the test
 * exercises the guard through a `SOURCE_FILES` member, which is the only path
 * where it can actually decide anything.
 */
export const SELF_REFERENTIAL = ["content/generated/assets.json"];

/**
 * Does this file path belong to the scan.
 *
 * @param {string} file repo-relative, forward slashes
 * @returns {boolean}
 */
export function isSourceFile(file) {
  if (SELF_REFERENTIAL.includes(file)) return false;
  if (SOURCE_FILES.includes(file)) return true;
  /*
   * The enhancement bundles are BUILD PRODUCT, not source, and they are
   * gitignored, so counting them would make `filesRead` in the committed
   * artifact depend on whether build:enhance has run on this machine: the
   * byte-compare in check:content would then disagree with itself across
   * checkouts. The exclusion is this one path, not a name pattern, so a future
   * source directory that happens to be called dist is still scanned.
   */
  if (file.startsWith("app/enhance/dist/")) return false;
  // `split` always yields a first element, so the fallback is unreachable and
  // an empty root is not in SOURCE_ROOTS, which is the refusal either way.
  const root = file.split("/")[0] ?? "";
  if (!SOURCE_ROOTS.includes(root)) return false;
  return SOURCE_EXTENSIONS.some((ext) => file.endsWith(ext));
}

/**
 * SOURCE WITH ITS COMMENTS REMOVED, because prose about an asset is not a
 * reference to it.
 *
 * **THIS MODULE CAUGHT ITSELF.** The first run reported `/dustin-edwards-logo.svg`,
 * `/dustin-edwards-favicon.svg`, `/dustin-edwards-logo-dark.svg`, `/dustin-edwards-logo-header.svg`, `/favicon.ico` and
 * `/site.webmanifest` as referenced by `app/lib/media/template-refs.mjs`, which
 * places no asset anywhere: they appear in the doc comment above, explaining the
 * prefix-collision problem. `folders.mjs` did the same thing. Six brand files
 * would have shipped claiming "placed by page code" on the strength of a
 * sentence describing the scanner.
 *
 * That is hard rule 10's comment-satisfied-anchor class, in the instrument
 * rather than in a gate, and it is the reason this is a tokenizer rather than a
 * regex. **A regex CANNOT do this job**: stripping from `//` to end of line
 * destroys every `https://` inside a string literal, and those strings are
 * exactly where real references live. So the scanner tracks whether it is
 * inside a string, a template literal or a comment, and only the comments go.
 *
 * Quotes inside comments and comment markers inside strings are both handled by
 * construction, because the state machine can only be in one of them at a time.
 *
 * @param {string} text
 * @param {boolean} [cssOnly] true for `.css`, which has no line comments
 * @returns {string} the same length, with comment bytes blanked to spaces
 */
export function stripComments(text, cssOnly = false) {
  let out = "";
  let i = 0;
  /** @type {"code"|"line"|"block"|"'"|"\""|"`"} */
  let mode = "code";
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (mode === "code") {
      if (c === "/" && next === "*") { mode = "block"; out += "  "; i += 2; continue; }
      if (!cssOnly && c === "/" && next === "/") { mode = "line"; out += "  "; i += 2; continue; }
      if (!cssOnly && (c === "'" || c === '"' || c === "`")) { mode = c; out += c; i += 1; continue; }
      if (cssOnly && (c === "'" || c === '"')) { mode = c; out += c; i += 1; continue; }
      out += c; i += 1; continue;
    }
    if (mode === "line") {
      if (c === "\n") { mode = "code"; out += c; i += 1; continue; }
      // Blanked rather than deleted, so offsets stay comparable and a newline
      // inside a stripped region cannot join two unrelated lines.
      out += " "; i += 1; continue;
    }
    if (mode === "block") {
      if (c === "*" && next === "/") { mode = "code"; out += "  "; i += 2; continue; }
      out += c === "\n" ? c : " "; i += 1; continue;
    }
    // Inside a string or template literal. An escape consumes the next
    // character, so an escaped quote cannot end the string early.
    if (c === "\\") { out += text.slice(i, i + 2); i += 2; continue; }
    if (c === mode) { mode = "code"; out += c; i += 1; continue; }
    out += c; i += 1;
  }
  return out;
}

/**
 * Every asset path that appears literally in one file's text.
 *
 * **THE BOUNDARY CHECK IS WHAT MAKES THIS USABLE, AND IT IS NEEDED ON BOTH
 * SIDES.** Each side was found by a false positive rather than reasoned out.
 *
 * TRAILING, the prefix collision: a bare `indexOf` reports `/dustin-edwards-logo.svg` as
 * referenced whenever `/dustin-edwards-logo-dark.svg` appears, because the shorter path is a
 * prefix of the longer one, and this asset set is full of such pairs.
 *
 * LEADING, the suffix collision, and this one actually fired: the first run with
 * a trailing check alone reported `/site.webmanifest` as referenced by this very
 * module, because the string `"public/site.webmanifest"` in `SOURCE_FILES`
 * ENDS with the asset path. The trailing character was a quote, so the trailing
 * check passed it. What disqualifies it is the character BEFORE, `c`, which is
 * part of a longer path.
 *
 * Both are hard rule 10's unanchored-needle class. A reference is a whole path,
 * so both of its ends have to be ends.
 *
 * @param {string} text the file contents
 * @param {string[]} assetPaths every known asset path
 * @returns {string[]} the subset referenced, in the order given
 */
export function referencesIn(text, assetPaths) {
  return assetPaths.filter((asset) => {
    let from = 0;
    for (;;) {
      const at = text.indexOf(asset, from);
      if (at < 0) return false;
      // What brackets a genuine reference is a quote, a backtick, a bracket,
      // whitespace or the edge of the file. What brackets a COLLISION is another
      // path character on one side or the other.
      const before = at === 0 ? undefined : text[at - 1];
      const after = text[at + asset.length];
      /** @param {string | undefined} ch */
      const bounded = (ch) => ch === undefined || !/[A-Za-z0-9._~/-]/.test(ch);
      if (bounded(before) && bounded(after)) return true;
      from = at + 1;
    }
  });
}

/**
 * Fold per-file results into the artifact shape.
 *
 * SORTED, both the keys and each list, because a generated artifact that churns
 * with directory order cannot be byte-compared by a gate. Same reasoning as
 * `walkPublic` in `build-assets.mjs`.
 *
 * @param {Array<{ file: string, assets: string[] }>} scanned
 * @returns {{ generated: number, refs: Record<string, string[]> }}
 */
export function foldRefs(scanned) {
  /** @type {Record<string, string[]>} */
  const refs = {};
  for (const { file, assets } of scanned) {
    for (const asset of assets) {
      if (!refs[asset]) refs[asset] = [];
      if (!refs[asset].includes(file)) refs[asset].push(file);
    }
  }
  /** @type {Record<string, string[]>} */
  const sorted = {};
  // The keys come from `refs` itself, so the empty array is unreachable.
  for (const asset of Object.keys(refs).sort()) sorted[asset] = (refs[asset] ?? []).slice().sort();
  return { generated: Object.keys(sorted).length, refs: sorted };
}
