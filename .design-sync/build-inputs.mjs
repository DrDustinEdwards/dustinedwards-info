/**
 * Generate the two derived inputs the design-sync converter reads: the
 * flattened stylesheet, and a paths-only tsconfig.
 *
 * ## 1. THE FLATTENED STYLESHEET
 *
 * The public plane's stylesheets, concatenated into ONE file in the site's own
 * cascade order.
 *
 * ## WHY A FLATTENER AND NOT A LIST OF @imports
 *
 * `cfg.cssEntry` is COPIED VERBATIM into `_ds_bundle.css` by the converter, not
 * bundled. An `@import "./styles/reset.css"` inside it would survive into the
 * output as a relative path to a file that was never uploaded, and the rendered
 * design would silently lose that sheet. So the concatenation happens here.
 *
 * ## THE ORDER IS THE SITE'S ORDER AND IS NOT ALPHABETICAL
 *
 * `app/app.css` states at its own tail why the component sheets are JavaScript
 * imports in `app/root.tsx` rather than `@import`s: a late `@import` is invalid
 * and is dropped, and hoisting them to the top would have moved the cascade,
 * putting them BEFORE app.css's rules instead of after. SHEETS below preserves
 * that order exactly. Do not sort it.
 *
 * Route sheets come after the root ones for the same reason they do on the
 * site: a route module's styles load after the root module's.
 *
 * ## WHAT IS LEFT OUT
 *
 * The `admin-*` sheets, because the admin plane is exempt from the progressive
 * enhancement law (hard rule 9) and nothing a design agent builds is an admin
 * page. `katex.generated.css` and `katex-overrides.css`, because they are a
 * generated artifact carrying twenty font faces whose binaries would have to
 * ship for the sheet to mean anything, and math typesetting is not a thing
 * being designed with.
 *
 * ## 2. THE PATHS-ONLY TSCONFIG, and why it is generated rather than written
 *
 * The converter resolves `~/*` through `cfg.tsconfig`, and its reader strips
 * comments with a regex before `JSON.parse`. `tsconfig.cloudflare.json` defeats
 * that reader: its `include` array carries glob patterns like
 * `app/enhance/*.ts`, and the `/*` inside one opens a block comment the
 * stripper then closes somewhere far away, so the parse fails and every `~/`
 * import goes unresolved. MEASURED 2026-09-12: the parse dies at line 36.
 *
 * So this emits a tiny tsconfig carrying `compilerOptions.paths` ALONE, read
 * out of the real one rather than retyped. `tsconfig.cloudflare.json` stays the
 * single owner of the alias; a hand-written copy here would be a second one,
 * free to disagree the day the alias moves.
 *
 * BOTH OUTPUTS ARE GITIGNORED. They are derived from files that are the only
 * owners of their content; a committed copy would be a second one that rots.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const OUT = join(HERE, "ds-styles.css");

/** In cascade order. app.css's own `@import "./styles/reset.css"` is inlined by being listed first. */
const SHEETS = [
  // The reset, which app.css imports on its first line.
  "app/styles/reset.css",
  // The tokens and the base layer.
  "app/app.css",
  // app/root.tsx lines 35-40, in that order. Do not sort.
  "app/styles/public-chrome.css",
  "app/styles/page-shell.css",
  "app/styles/chrome-nav.css",
  "app/styles/skip-link.css",
  "app/styles/motion-print.css",
  "app/styles/search-trigger.css",
  // root.tsx line 52, LAST of the root sheets and deliberately so: its own
  // comment says it "still needs to win where it and page-shell.css touch the
  // same thing". It defines `.tracks`, the redesign grid (ruling 99), and was
  // missing from this list entirely until 2026-09-16, so the canvas was
  // designing against a grid class it had never been sent. check:design-sheets
  // now holds this list against root.tsx and the routes (ruling 111).
  "app/styles/shell.css",
  // Route sheets, which load after the root module's on the site.
  "app/styles/prose.css",
  "app/styles/blog-index.css",
  "app/styles/blog-index-extras.css",
  // The rail track's own sheet and the evidence row's, in blog.$slug.tsx's import order. The
  // evidence row is a site object rather than a route sheet: home and the colophon import the
  // same component, so it sits here once and not per page.
  "app/styles/post-rail.css",
  "app/styles/evidence-row.css",
  "app/styles/post-shell.css",
  "app/styles/post-enhancements.css",
  // The post page's two newest sheets, in blog.$slug.tsx's own import order after
  // post-enhancements.css. post-head-blocks.css shipped one commit before this list
  // learned about it, which is the failure ruling 111 added this gate to catch.
  "app/styles/post-head-blocks.css",
  "app/styles/post-disclosures.css",
  "app/styles/blog-search.css",
  "app/styles/search-page.css",
  "app/styles/search-facets.css",
  "app/styles/ask.css",
  "app/styles/projects.css",
  "app/styles/publications.css",
  "app/styles/palette-dialog.css",
  "app/styles/playground.css",
  "app/styles/playground-ui.css",
];

/**
 * Strip `@import` statements. The only one in the set is app.css's reset, which
 * SHEETS already carries as its own entry; leaving it in would emit a dangling
 * relative path. Throws on an unrecognised one rather than dropping a sheet
 * quietly, because a silently missing stylesheet is the failure this whole file
 * exists to prevent.
 */
function stripImports(css, rel) {
  return css.replace(/^\s*@import\s+[^;]+;/gm, (stmt) => {
    if (stmt.includes("./styles/reset.css")) return "";
    throw new Error(`${rel}: unhandled @import, add it to SHEETS: ${stmt.trim()}`);
  });
}

/**
 * Repoint a sheet's `url()` targets so they resolve from THIS directory.
 *
 * The converter's font extractor resolves every `url()` against the directory
 * holding `cfg.cssEntry`, which is this one, not against the sheet the rule was
 * written in. `app/app.css` says `url("./fonts/inter-latin-normal.woff2")`
 * meaning `app/fonts/`, and left alone that resolves to `.design-sync/fonts/`,
 * which does not exist: the extractor then copies nothing and emits the rule
 * with its original path into `fonts/fonts.css`, where `./fonts/x` means
 * `fonts/fonts/x`. Nothing errors and the family silently becomes a system
 * font, so the rewrite is the difference between shipping Inter and not.
 */
/**
 * Strip CSS comments.
 *
 * Not cosmetic. `app/app.css` carries a long comment explaining why
 * `@import "tailwindcss"` was REMOVED, and the converter's validator greps
 * `_ds_bundle.css` for `@import` without stripping comments first, so that
 * prose reads as a real import of a package that was never uploaded and fails
 * the gate. This repo's own hard rule 10 names the discipline the validator is
 * missing, "strip comments before matching"; doing it on this side is the fix
 * that needs no fork.
 *
 * The comments are worth keeping where they were written and worthless in a
 * bundle a design agent consumes, so nothing is lost by dropping them here.
 */
function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Remove the `prefers-contrast: more` tier from the bundle.
 *
 * ## THE DEFECT, and it is in the READER rather than in the CSS
 *
 * `app/app.css` promotes exactly two tokens under `prefers-contrast: more`, and
 * the `@media` wrapper survives into `_ds_bundle.css`, so RENDERING was always
 * correct: the promoted values apply only under the query. What is not correct
 * is the manifest. Claude Design's self-check scrapes tokens by flattening the
 * stylesheet WITHOUT media context and taking the last value, so the promoted
 * values were reported as the base palette.
 *
 * MEASURED 2026-09-12 in the uploaded `_ds_manifest.json`: `--text-muted` read
 * `#4a423a` against a base of `#5c5248`, and `--border` read `#6e6459` against
 * a base of `#8a7d6e`. The second one is the expensive half. `#6e6459` is what
 * `--border-strong` already is, so the two tokens arrived at the design agent
 * as THE SAME COLOUR, and hard rule 5, popover elevation and pinned bars take
 * `--border-strong` and never `--border`, became unfollowable: the agent cannot
 * honour a distinction it cannot see.
 *
 * ## WHY STRIP RATHER THAN REORDER
 *
 * A media block adds no specificity, so the tier only works because it comes
 * AFTER the base declarations. Moving it earlier to win the scraper's
 * last-wins would break it at runtime, trading a wrong manifest for a wrong
 * render. Stripping is the honest trade: the design agent gets the true base
 * palette, and the high-contrast tier stays a property of the SITE, which is
 * where it is implemented and gated, rather than of designs built from the
 * bundle. Nothing the agent authors was going to carry the tier anyway.
 */
function stripContrastTier(css) {
  let out = "";
  let i = 0;
  let removed = 0;
  while (i < css.length) {
    const at = css.indexOf("@media", i);
    if (at === -1) { out += css.slice(i); break; }
    const brace = css.indexOf("{", at);
    if (brace === -1) { out += css.slice(i); break; }
    if (!/prefers-contrast/.test(css.slice(at, brace))) {
      out += css.slice(i, brace + 1);
      i = brace + 1;
      continue;
    }
    let depth = 1;
    let j = brace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    out += css.slice(i, at);
    i = j;
    removed++;
  }
  return { css: out, removed };
}

function rewriteUrls(css, rel) {
  const sheetDir = dirname(join(REPO, rel));
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, quote, target) => {
    if (/^(?:https?:|data:|#)/.test(target) || target === "") return whole;
    const abs = resolve(sheetDir, target);
    const fromHere = relative(HERE, abs).split(sep).join("/");
    return `url("${fromHere.startsWith(".") ? fromHere : `./${fromHere}`}")`;
  });
}

const parts = [
  "/*\n * GENERATED by .design-sync/build-inputs.mjs from dustinedwards.info's own\n * stylesheets, in app/root.tsx cascade order. Do not edit: edit the source\n * sheets and re-run the generator.\n */\n",
];
let contrastRemoved = 0;

for (const rel of SHEETS) {
  const css = readFileSync(join(REPO, rel), "utf8");
  // Comments come out FIRST, so stripImports and the contrast strip only ever
  // judge real statements rather than prose that mentions one.
  const bare = stripCssComments(css);
  const { css: noContrast, removed } = stripContrastTier(bare);
  contrastRemoved += removed;
  parts.push(`\n/* ===== ${rel} ===== */\n${rewriteUrls(stripImports(noContrast, rel), rel)}`);
}

const out = parts.join("");
writeFileSync(OUT, out);

// Assert every rewritten target is a file that EXISTS, rather than trusting the
// rewrite. A dead src is worse than no face: the family degrades to a system
// font and nothing anywhere reports it.
const urls = [...out.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]);
const bad = urls.filter((u) => u && !/^(?:https?:|data:|#)/.test(u) && !existsSync(resolve(HERE, u)));
if (bad.length) throw new Error(`url() targets that do not exist on disk: ${bad.join(", ")}`);

// No @import may survive into the bundle: nothing resolves it there, and the
// sheet it names would be silently absent from every rendered design. Counted
// on the OUTPUT rather than trusted from the strip, because the strip running
// is not evidence that it ran everywhere.
const leftover = out.match(/@import[^;]*;/g);
if (leftover) throw new Error(`@import survived into the bundle: ${leftover.join(", ")}`);

// Prove the comment strip did not eat the stylesheets along with the comments:
// a runaway `/* ... */` match collapses the rule count and ships a bundle that
// renders unstyled, with nothing erroring anywhere.
//
// The floor is MEASURED from the source sheets on this line, read raw off disk,
// rather than written down as a number this file chose. A literal would be a
// value produced by the very process it is checking, and it would have to be
// re-picked every time a sheet is added.
// The contrast tier is GONE, and the expected count is counted in the SOURCE
// sheets rather than reported by the strip that removed them: a process must
// not supply the number that checks it.
const expectedContrast = SHEETS.reduce(
  (n, rel) => n + (stripCssComments(readFileSync(join(REPO, rel), "utf8")).match(/@media[^{]*prefers-contrast/g) ?? []).length,
  0,
);
if (contrastRemoved !== expectedContrast) {
  throw new Error(`removed ${contrastRemoved} prefers-contrast block(s), the sources declare ${expectedContrast}`);
}
if (/prefers-contrast/.test(out)) throw new Error("a prefers-contrast block survived into the bundle");

/**
 * Read a token the way the self-check's scraper does: flatten, ignore media
 * context, last value wins. This is the number that lands in the manifest, so
 * it is the one worth printing beside the base the sheet declares.
 */
function flattenedValue(css, token) {
  // Scope matters and media context does not, which is exactly the scraper's
  // shape: the manifest files dark values under their own `scope`, so the BASE
  // reading is the last one under a bare `:root` or `[data-theme="light"]`.
  // `:root:not([data-theme])` is the system-theme selector and is not the base.
  let last = "(absent)";
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().split(/\s*,\s*/).map((s) => s.trim());
    const isBase = sel.some((s) => s === ":root" || s === '[data-theme="light"]');
    if (!isBase) continue;
    const hit = m[2].match(new RegExp(`${token}\\s*:\\s*([^;]+)`));
    if (hit) last = hit[1].trim();
  }
  return last;
}
const APP_CSS = stripCssComments(readFileSync(join(REPO, "app/app.css"), "utf8"));
const baseOf = (token) => {
  // The base block is the first `:root, [data-theme="light"]` rule in app.css.
  const block = APP_CSS.match(/:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\}/);
  return block?.[1].match(new RegExp(`${token}\\s*:\\s*([^;]+)`))?.[1].trim() ?? "(not in base block)";
};
console.error("  token proof (what the manifest scraper will read, beside app.css's base block):");
for (const token of ["--text-muted", "--border", "--border-strong"]) {
  const flat = flattenedValue(out, token);
  const base = baseOf(token);
  console.error(`    ${token.padEnd(16)} bundle ${flat.padEnd(10)} base ${base.padEnd(10)} ${flat === base ? "match" : "MISMATCH"}`);
}

const rawBraces = SHEETS.reduce((n, rel) => n + (readFileSync(join(REPO, rel), "utf8").match(/\{/g) ?? []).length, 0);
const braces = (out.match(/\{/g) ?? []).length;
if (braces < rawBraces * 0.95) {
  throw new Error(`only ${braces} of ${rawBraces} rule blocks survived, the strip ate the stylesheets`);
}

console.error(`ds-styles.css: ${SHEETS.length} sheets, ${(out.length / 1024).toFixed(0)} KB, ${urls.length} url() target(s)`);

/**
 * Strip JSONC comments while RESPECTING STRING LITERALS. A regex cannot do this
 * and that is the whole defect being worked around: `"app/enhance/*.ts"` holds
 * a slash-star that only a scanner tracking whether it is inside a string can
 * tell from a comment opener.
 */
function stripJsonc(src) {
  let outText = "";
  let i = 0;
  let inStr = false;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (inStr) {
      outText += c;
      if (c === "\\") { outText += d ?? ""; i += 2; continue; }
      if (c === '"') inStr = false;
      i++;
      continue;
    }
    if (c === '"') { inStr = true; outText += c; i++; continue; }
    if (c === "/" && d === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    outText += c;
    i++;
  }
  // Trailing commas, which JSONC permits and JSON.parse does not.
  return outText.replace(/,(\s*[}\]])/g, "$1");
}

const TS_SRC = "tsconfig.cloudflare.json";
const tsJson = JSON.parse(stripJsonc(readFileSync(join(REPO, TS_SRC), "utf8")));
const tsPaths = tsJson.compilerOptions?.paths;
if (!tsPaths || !Object.keys(tsPaths).length) {
  throw new Error(`${TS_SRC}: no compilerOptions.paths to derive from`);
}
// baseUrl is relative to THIS file's directory, so ".." is the repo root, which
// is what the alias targets in the source tsconfig are relative to.
writeFileSync(
  join(HERE, "tsconfig.paths.json"),
  JSON.stringify(
    { $comment: `GENERATED from ${TS_SRC} by build-inputs.mjs. Do not edit.`, compilerOptions: { baseUrl: "..", paths: tsPaths } },
    null,
    2,
  ) + "\n",
);
console.error(`tsconfig.paths.json: ${Object.keys(tsPaths).length} alias(es) from ${TS_SRC}, ${Object.keys(tsPaths).join(", ")}`);

/**
 * readme-header.md, the ONE file `cfg.readmeHeader` points at.
 *
 * ## WHY IT IS ASSEMBLED RATHER THAN AUTHORED
 *
 * The skill takes a single header path and prepends it to the generated README,
 * and the app inlines only the FIRST 32,000 characters of that README into the
 * agent prompt. So the header is the only text the design agent is guaranteed to
 * read, and two committed files have to share it:
 *
 *   canvas-constraints.md  what is already decided and may not be re-decided
 *   conventions.md         the vocabulary: tokens, class names, how to compose
 *
 * Constraints go FIRST. Truncation eats the tail, so the half that must survive
 * a long README is the half that says what not to do.
 *
 * Both halves stay committed and single-owner; only the concatenation is
 * derived, which is why this file is gitignored beside ds-styles.css. It is
 * built HERE, in `cfg.buildCmd`, because that is the command the skill actually
 * runs before the converter reads the header.
 */
const HEADER_PARTS = ["canvas-constraints.md", "conventions.md"];
const headerText = HEADER_PARTS.map((name) => {
  const path = join(HERE, name);
  if (!existsSync(path)) throw new Error(`readme-header: ${name} is missing; the header would ship half its content`);
  return readFileSync(path, "utf8").trim();
}).join("\n\n");
writeFileSync(join(HERE, "readme-header.md"), `${headerText}\n`);
// The skill warns above 31,900 for the header plus the generated body together.
// Naming the remaining room here means a header that has quietly eaten the
// budget is visible at build time rather than in a truncated prompt.
console.error(
  `readme-header.md: ${headerText.length} chars from ${HEADER_PARTS.join(" + ")}, ` +
    `${31900 - headerText.length} left for the generated README body`,
);
