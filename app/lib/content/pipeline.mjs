/**
 * The markdown pipeline. One definition, two callers.
 *
 * `scripts/build-content.mjs` calls it at build time over files on disk, and the
 * admin editor calls it inside the Worker for preview and for the rows it syncs
 * after a commit. There must never be a second markdown renderer: if the two
 * callers could disagree, the editor would publish HTML that the next build
 * would not reproduce, and `check:content` would fail on content nobody edited.
 *
 * Consequences of running inside a Worker, both deliberate:
 *
 *   1. Nothing here imports `node:fs` or `node:path`. Reading an image to
 *      measure it is the caller's job, injected as `resolveImage`.
 *   2. Highlighting uses `shiki/core` with an explicit language list rather than
 *      the full `shiki` bundle. Measured 2026-07-28: the full bundle ships every
 *      grammar as its own chunk and took the Worker output to 14 MB. The core
 *      build with this list is 615 kB gzip. A fenced block in a language outside
 *      LANGUAGES renders as plain text, in published output as well as preview.
 */

import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
// The one JavaScript owner of "is this post publicly visible". Composed rather
// than restated, for the reason that module's header records: a hand-rolled
// third copy of this rule is what leaked five drafts into Ask on 2026-07-29.
import { longDateUTC } from "../long-date.mjs";
import { isPubliclyVisible, statusForDraft } from "../search/visibility.mjs";
import { transformerMetaHighlight } from "@shikijs/transformers";
import matter from "gray-matter";
import { toString as hastToString } from "hast-util-to-string";
// Imported for VALIDATION, not for rendering: `remarkMathValidate` calls it to
// fail the build, and `rehype-katex` calls it again to produce the markup.
import katex from "katex";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { z } from "zod";

import { ASSET_PREFIX, classify } from "../media/classify.mjs";
import { cardDescription, cardTitle } from "./og-card-text.mjs";
import { gitBlobSha, renderHash } from "./hashes.mjs";
import { CONTENT_SIZES, contentSrcSet } from "../media/widths.mjs";
import { buildChartModel, renderChartHast } from "./chart.mjs";
import { buildDiagramModel, renderDiagramHast } from "./diagram.mjs";
import { KATEX_OPTIONS } from "./math.mjs";

import bash from "shiki/langs/bash.mjs";
import css from "shiki/langs/css.mjs";
import html from "shiki/langs/html.mjs";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import markdown from "shiki/langs/markdown.mjs";
import python from "shiki/langs/python.mjs";
import sql from "shiki/langs/sql.mjs";
import tsx from "shiki/langs/tsx.mjs";
import typescript from "shiki/langs/typescript.mjs";
import githubDarkHighContrast from "shiki/themes/github-dark-high-contrast.mjs";
import githubLightHighContrast from "shiki/themes/github-light-high-contrast.mjs";

import { readingTimeMinutes } from "./reading-time.mjs";

/**
 * The grammars shipped to the highlighter, keyed by the name a fence uses.
 *
 * ONE list, because there used to be two: an exported `LANGUAGES` array of
 * names, read by `check:contrast`, and a separate hardcoded `langs:` array of
 * imported grammars passed to shiki. Adding python meant editing both, and
 * editing only one is invisible: naming a language in `LANGUAGES` that the
 * highlighter was never given makes the gate assert about a grammar that is not
 * loaded, while loading one that `LANGUAGES` omits leaves it unasserted. Two
 * hand-maintained lists mirroring each other is the drift this repo already
 * gated against for backup tables.
 */
const GRAMMARS = {
  bash,
  css,
  html,
  javascript,
  json,
  markdown,
  python,
  sql,
  tsx,
  typescript,
};

/** Languages that get highlighted. Anything else renders as plain text. */
export const LANGUAGES = Object.keys(GRAMMARS);

/** Raised for any content problem. Carries the file so the message can name it. */
export class ContentError extends Error {
  /**
   * @param {string} file
   * @param {string} message
   */
  constructor(file, message) {
    super(`${file}: ${message}`);
    this.name = "ContentError";
    this.file = file;
  }
}

// YAML turns an unquoted 2026-07-27 into a Date, so both spellings arrive here.
/** @param {unknown} value */
const asDateString = (value) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value;

/** @param {unknown} value */
const asDateTimeString = (value) =>
  value instanceof Date ? value.toISOString() : value;

const isoDate = z.preprocess(
  asDateString,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a YYYY-MM-DD date"),
);

const isoDateTime = z.preprocess(
  asDateTimeString,
  z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "must be a parseable date-time"),
);

/**
 * Frontmatter contract. A failure is a build failure at the command line and a
 * rejected save in the editor, both naming the field.
 */
/**
 * What a slug may be, as ONE statement of the rule.
 *
 * Exported because the operator API needs the same predicate on its READ paths,
 * and a hand-copied regex there would be a second statement of a rule that can
 * drift. The write path has always enforced this through the schema below; the
 * read paths interpolated an unvalidated slug straight into a GitHub API path,
 * where `encodeURI` leaves `..`, `/` and `?` intact. Found by the external
 * audit of 2026-08-11.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The longest a slug may be, in characters.
 *
 * **A SECOND RULE RATHER THAN A LONGER PATTERN, deliberately.** A length bound
 * inside `SLUG_PATTERN` would need a lookahead carrying its own end anchor,
 * and `SLUG_ATTRIBUTE_PATTERN` below builds the HTML `pattern` attribute by
 * stripping the anchors off this source. It would strip the wrong one. Two
 * constants, each with one owner, applied wherever the shape rule is applied.
 *
 * ## WHY 120, AND WHY IT IS NOT THIS REPOSITORY'S NUMBER ALONE
 *
 * The MCP wrapper's `slugSchema` (`DrDustinEdwards/dustinedwards-mcp`,
 * `src/tools.ts`) has been `.min(1).max(120).regex(...)` since it was
 * written, and this side had no cap at all. Measured in the pre-cutover audit
 * 2026-09-11 (P2-02b): the admin UI could save a post whose slug the operator
 * tools could not name, so `get_post` and `save_post` would refuse at the
 * wrapper's schema before any request went out, and the only surface left that
 * could touch the post would be the one that created it.
 *
 * The site moved to the wrapper's number rather than the other way round,
 * because 120 is already the smaller bound and shrinking a surface nothing has
 * used is cheaper to reason about than widening a published one.
 *
 * NO GATE HERE CAN SEE THE WRAPPER'S COPY: it is a different repository with a
 * different build, and a restatement of its regex in a test would be a test of
 * the restatement. What `test/slug-length.test.mjs` does instead is pin THIS
 * side exactly at the boundary in both directions, so the cap cannot be
 * widened, narrowed or dropped without a failing test naming the number.
 */
export const SLUG_MAX_LENGTH = 120;

/**
 * The same rule in the shape an HTML `pattern` attribute takes.
 *
 * The attribute ANCHORS IMPLICITLY: the browser compiles it as `^(?:...)$`,
 * so the anchors in `SLUG_PATTERN.source` have to come off rather than being
 * handed over with the rest.
 *
 * ## WHY THIS IS A CONSTANT AND NOT AN EXPRESSION AT THE INPUT
 *
 * It WAS an expression at the input, for about an hour, and it was wrong. The
 * strip was written as a regex whose two anchor characters each needed a
 * backslash, and neither backslash survived the tool that wrote the file. What
 * reached disk was an alternation of two BARE anchors, which are zero-width, so
 * it replaced the empty string with the empty string: a no-op that shipped the
 * anchors it was written to remove.
 *
 * Nothing caught it. It typechecked, and the anchors are harmless inside the
 * browser's own anchoring, so the attribute still validated the same strings
 * and no gate and no render could tell the difference. What WAS false was the
 * comment directly above it, which said the anchors had been stripped.
 *
 * So the strip lives here, with no regex in it at all, and `check:tests`
 * drives it. A derivation that cannot be written wrong is better than one a
 * gate has to watch.
 */
export const SLUG_ATTRIBUTE_PATTERN = unanchor(SLUG_PATTERN.source);

/**
 * A regex source with its start and end anchors removed, if it had them.
 *
 * String methods on purpose: see above. This function is the reason the
 * defect it replaces cannot recur in it.
 *
 * @param {string} source
 * @returns {string}
 */
function unanchor(source) {
  let out = source.startsWith("^") ? source.slice(1) : source;
  if (out.endsWith("$")) out = out.slice(0, -1);
  return out;
}

/**
 * WHERE A POST LIVES IN THE REPOSITORY. Stated once, here.
 *
 * Hard rule 6 says this string is stated ONCE, by the exported `postPath()`.
 * It was not: this module built the same path independently at `sourcePath`
 * below while `publish.server.ts` exported the canonical one, so the rule was
 * true of every consumer except the module that produces the artifact.
 *
 * It lives HERE rather than there because the dependency only runs one way:
 * `publish.server.ts` already imports this module, and this module cannot
 * import a `.server` file without dragging the server boundary into the build
 * scripts. Same neighbourhood as `SLUG_PATTERN` on purpose, which is the same
 * class of rule and was consolidated for the same reason.
 *
 * @param {string} slug
 * @returns {string}
 */
export const postPath = (slug) => `content/posts/${slug}.md`;

export const frontmatterSchema = z.object({
  title: z.string().min(1, "must not be empty"),
  slug: z
    .string()
    .regex(SLUG_PATTERN, "must be lowercase kebab-case")
    .max(SLUG_MAX_LENGTH, `must be at most ${SLUG_MAX_LENGTH} characters`),
  date: isoDate,
  tags: z.array(z.string().min(1)).default([]),
  description: z.string().min(1, "must not be empty"),
  draft: z.boolean().default(false),
  publish_at: isoDateTime.optional(),
  cover: z
    .object({
      /**
       * A SITE-ABSOLUTE path: one leading slash, and the next character is not
       * another slash or a backslash.
       *
       * `startsWith("/")` was the entire rule and it let `//evil.com/x.png`
       * through, because a protocol-relative URL also starts with a slash. The
       * admin cover preview uses this value as a real `<img src>`, so it loaded
       * from the external host; the public side prefixes SITE_ORIGIN and
       * produced a broken URL rather than an off-origin one, which is a smaller
       * failure but still not what the message claimed. Finding B008.
       *
       * The backslash is excluded with it: `/\evil.com` is treated as
       * protocol-relative by some parsers and there is no legitimate path that
       * begins that way.
       *
       * BOTH CONSTRAINTS, COMPOSED, and the second one is the rule.
       *
       * The site-absolute regex was the whole check here until 2026-08-07, and
       * it blocked `javascript:` only as a SIDE EFFECT of demanding a leading
       * slash. The ruling says both frontmatter URL fields call `isAllowedUrl`,
       * the same predicate the render layer uses, rather than reimplementing
       * the rule; this field reimplemented it and the audit found the drift.
       * The outcome was accidentally right and the mechanism was wrong, which
       * is the harder defect: the next person to relax the path rule for a
       * legitimate reason would have silently reopened the protocol hole.
       *
       * The regex is NOT dropped for it. It is the stricter of the two and it
       * exists for a different finding (B008, protocol-relative `//evil.com`),
       * so removing it would trade one hole for another. Zod runs the regex
       * first and short-circuits, so a blocked protocol still reports the path
       * message; the refinement is what makes the shared predicate real.
       */
      src: z
        .string()
        .regex(/^\/(?![/\\])/, "must be a site-absolute path, not //host or a full URL")
        .refine(isAllowedUrl, "protocol is not allowed (https, http, mailto or relative only)"),
      alt: z.string().min(1, "is required when cover is set"),
    })
    .optional(),
  /** Marks a post for the featured slot on the index. */
  featured: z.boolean().default(false),
  /** Multi-part writing. Both fields travel together or neither does. */
  series: z.string().min(1).optional(),
  part: z.number().int().min(1, "must be 1 or greater").optional(),
  /**
   * THE AUTHOR-SET HEAD BLOCKS, all three optional and most posts carrying none.
   *
   * NOT `status`: that name is the row's draft/published column. A post may be published and
   * still be a draft in prose, which is what `writing_status: draft` says.
   *
   * A CLOSED SET, not a free string. gwern's five words are the whole vocabulary, and the point of
   * a status tag is that a reader learns the five once and then reads them at a glance; a free
   * field turns it into a second dek written in a different voice on every post. An unknown value
   * is a build failure at the post that set it, which is where it can be fixed.
   *
   * NONE OF THE THREE IS A BYLINE. The missing byline is deliberate: there is one author, the site
   * is his name, and a hidden p-author h-card carries it for microformats. A line naming a person
   * here would reintroduce by accident what was removed on purpose.
   */
  writing_status: z.enum(["notes", "draft", "in progress", "finished", "obsolete"]).optional(),
  /**
   * WHO THE POST IS FOR, in one sentence the author writes. It replaces a depth tag, because
   * "advanced" tells a reader less than a sentence does.
   *
   * Capped so it stays a line rather than becoming a second dek. A longer one belongs in the prose.
   */
  assumed_audience: z.string().min(1).max(200).optional(),
  /**
   * THE ANSWER, THE QUALIFICATION, AND WHAT TO DO NEXT, in that order, author-written.
   *
   * NOT A TEMPLATE FEATURE and not generated: a summary the author did not write is a summary
   * nobody checked. Long technical posts only, where the dek does not already give the answer.
   *
   * Two to four items, because one is a dek and five is the post.
   */
  key_takeaways: z.array(z.string().min(1).max(300)).min(2).max(4).optional(),
  /**
   * THE POST HISTORY, author-written, one line per revision.
   *
   * `updated_at` on the row already says WHEN and cannot say WHAT; it is also rewritten by every
   * sync, which is why the page puts a 24-hour threshold in front of it. This says what changed,
   * and only the author knows that.
   *
   * THE DATE IS `isoDate`, the same preprocessor the post's own `date` uses, because YAML parses a
   * bare 2026-08-15 into a Date object and a hand-rolled string regex would reject every unquoted
   * one. A revision is a day and not an instant. Ordering is the renderer's, so an author may
   * append a line rather than prepend one.
   */
  changelog: z
    .array(
      z.object({
        date: isoDate,
        note: z.string().min(1).max(300),
      }),
    )
    .min(1)
    .max(20)
    .optional(),
  /** Curated outbound links, rendered at the end of the post. */
  further_reading: z
    .array(
      z.object({
        title: z.string().min(1, "must not be empty"),
        /**
         * THE PROTOCOL ALLOWLIST APPLIES HERE TOO, and it did not.
         *
         * `z.url()` accepts `javascript:`, `data:`, `vbscript:` and `file:`:
         * they are well-formed absolute URLs. This value is rendered as a live
         * `<a href>` on the public post page, and `rehypeUrlProtocols` never
         * sees it, because that plugin walks the hast tree `renderBody`
         * produces and frontmatter is not in it. So the allowlist that closed
         * the markdown XSS did not bind the one field that bypasses markdown
         * entirely. Finding B001.
         *
         * Latent only because no corpus post sets `further_reading`. Both write
         * paths, the operator API and a hand-edited commit, were open.
         *
         * `isAllowedUrl` is the SAME predicate the render layer uses, called
         * here rather than reimplemented, so the two can never drift apart.
         * It is declared below in this file and hoists.
         */
        /**
         * TWO SHAPES ONLY: an absolute http(s) URL, or a `/blog/` path.
         *
         * It was `z.string().url()`, which is absolute-only, so an internal
         * link had to carry a hostname. **THE ORIGIN CHANGES AT CUTOVER AND A
         * PATH SURVIVES IT** (`CUTOVER.md`): every absolute internal link
         * written before the apex move would point at the old host afterwards,
         * in committed markdown, with nothing to notice. A path has no host to
         * go stale. That is the whole reason for the widening, recorded here
         * because a later reader would otherwise see only a loosened rule.
         *
         * `/blog/` rather than any site-absolute path, deliberately. This field
         * renders as a live `<a href>` on the public post, so the set of things
         * it may name is kept to the one thing the editor's picker can produce.
         * `//evil.com` and `/\evil.com` do not start with `/blog/` and are
         * refused by the same test, so the B008 protocol-relative hole this
         * schema closed elsewhere cannot open here.
         *
         * NARROWED IN ONE DIRECTION WHILE WIDENING IN ANOTHER: absolute now
         * means http or https, where `z.url()` also accepted `mailto:`. No
         * corpus post sets `further_reading` at all, so nothing is invalidated
         * today, and "further reading" naming an email address was never the
         * intent. `isAllowedUrl` still runs and is still the shared predicate,
         * kept composed rather than folded in for the reason the B001 note
         * below gives: it must not be reimplemented here.
         */
        url: z
          .string()
          .refine(isFurtherReadingUrl, "must be an absolute http(s) URL or a /blog/ path")
          .refine(isAllowedUrl, "protocol is not allowed (https, http, mailto or relative only)"),
      }),
    )
    .default([]),
  /** Social overrides. Absent means the title and description are used. */
  og_title: z.string().min(1).optional(),
  og_description: z.string().min(1).optional(),
  /**
   * Last meaningful revision, as a date.
   *
   * A date rather than a timestamp on purpose. The build derives it from the
   * last git commit touching the file; the editor writes the current UTC date
   * on save. Those are the same day, because the editor's commit is created in
   * the same request, so the two callers agree and the byte-comparison gate
   * stays green. A timestamp would not agree, since the editor cannot know the
   * commit time it is about to create.
   */
  updated: isoDate.optional(),
  /**
   * The date this post first went public. SERVER-OWNED: stamped once, by the
   * save path, the first time a post is committed with draft:false, and never
   * read from what a caller submitted.
   *
   * It exists because the operator publish policy needs a durable answer to
   * "has this post ever been published", and current state cannot give one: a
   * post sitting at draft:true is either brand new or previously published and
   * withdrawn, and an agent may do the second but not the first.
   *
   * It is declared here so the format is validated, but renderPost deliberately
   * does NOT copy it into the record. Keeping it out of the artifact means the
   * gated file does not churn, and the file stays the only place it lives,
   * which is the same place the policy reads it from.
   */
  first_published: isoDate.optional(),
}).superRefine((value, ctx) => {
  if (value.series && value.part === undefined) {
    ctx.addIssue({ code: "custom", path: ["part"], message: "is required when series is set" });
  }
  if (value.part !== undefined && !value.series) {
    ctx.addIssue({ code: "custom", path: ["series"], message: "is required when part is set" });
  }
});

/**
 * Wide dash characters, written as escapes so this file stays clean under the
 * house rule and stays greppable. U+2010 to U+2015 plus U+2212.
 */
const WIDE_DASH = /[\u2010-\u2015\u2212]/g;

/**
 * Finds every wide dash with its line and column.
 *
 * This is the server-side half of the no-em-dash rule. The PreToolUse hook only
 * fires on a developer machine; a commit created through the GitHub API never
 * touches it, so without this check the rule would not reach anything written in
 * the editor.
 *
 * @param {string} text
 * @returns {Array<{ line: number, column: number, char: string, excerpt: string }>}
 */
export function findWideDashes(text) {
  /** @type {Array<{ line: number, column: number, char: string, excerpt: string }>} */
  const hits = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    WIDE_DASH.lastIndex = 0;
    let match;
    while ((match = WIDE_DASH.exec(line)) !== null) {
      hits.push({
        line: i + 1,
        column: match.index + 1,
        char: `U+${match[0].codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}`,
        excerpt: line.slice(Math.max(0, match.index - 30), match.index + 30).trim(),
      });
    }
  });
  return hits;
}

/**
 * Estimated reading time in whole minutes, never less than one.
 *
 * Re-exported rather than implemented here, so every existing caller keeps its
 * import. The arithmetic moved to `reading-time.mjs` when the editor started
 * showing a live count as the author types: the editor CANNOT import this
 * module, because it carries shiki and its grammars and would have taken the
 * whole markdown renderer into a browser bundle. One derivation, two consumers,
 * the same rule `records.mjs` lives under.
 */
export { readingTimeMinutes };

/** @type {any} */
let highlighterPromise = null;

/**
 * How the oniguruma WASM gets loaded. Injected, because the two callers cannot
 * load it the same way.
 *
 * Node reads it from disk, which `import("shiki/wasm")` does. A Worker cannot:
 * `WebAssembly.instantiate()` on bytes throws "Wasm code generation disallowed
 * by embedder", measured 2026-07-28 on a real save. Workers only accept a WASM
 * module that was imported statically, so the Worker passes an instantiator
 * closing over that module instead.
 *
 * The ENGINE is identical either way. Only the loading differs, so both callers
 * still produce byte-identical HTML, which is the whole point.
 *
 * @type {any}
 */
let wasmLoader = () => import("shiki/wasm");

/** @param {any} loader */
export function setWasmLoader(loader) {
  wasmLoader = loader;
  highlighterPromise = null;
}

/**
 * Bumped whenever the card TEMPLATE changes: colours, type, layout.
 *
 * The key is what makes the object safe to serve immutable, and the key is a
 * hash of the card's inputs. The template was not one of those inputs, so
 * restyling the card produced a byte-different PNG under an identical key,
 * which an immutable cache is entitled to ignore forever. Bumping this is how
 * a template change actually reaches a reader.
 *
 * 2: the Hill Country tokens, 2026-07-28. Background, body and muted moved off
 * the old cool neutrals onto caliche and mesquite; brand purple is unchanged.
 *
 * 3: purple chrome v4, 2026-08-14. The card gains a brand-surface band carrying
 * the real mark, the wordmark and the tags, matching what the site header
 * became at v4; the title stays on the canvas per binding rule 7, at 72px, and
 * it is now the only thing on the canvas. The description was dropped rather
 * than shortened, for the reasons recorded in build-og.mjs. The colours are now
 * RESOLVED from app.css rather than restated there, so this number is the only
 * thing standing between a retuned token and a fleet of immutable cards still
 * serving the old one.
 *
 * THE HASH SET WAS PUT RIGHT IN THE SAME WINDOW, ruled 2026-08-14. The v3 note
 * above recorded the drift and left it, because changing what the key hashes is
 * a ruling rather than a tidy-up: the description was hashed and not rendered,
 * and the tags were rendered and not hashed. Both are fixed below. The version
 * is NOT bumped again for it, because changing the inputs already moves every
 * key, and nothing has ever been served at 3.
 *
 * 4: the full-bleed plum card, 2026-08-30. The band and the canvas are gone and
 * the whole card is `--surface-chrome`; the mark sits alone in the top corner,
 * and the title, a two-line description, an accent rule and a byline of the
 * site name and the publication date hang off the foot. The title is FITTED to
 * its length rather than pinned at one size (`og-card-text.mjs`). Tags are no
 * longer drawn.
 *
 * THE HASH SET MOVES WITH IT, by the same law the v3 note states rather than by
 * a new one: hash what is drawn. Tags leave the input because they left the
 * card. The description and the publication date join it because they are on
 * the card now, and they join it AS DRAWN, through the same clamp the template
 * paints with, so an edit past the cut does not mint a key for a picture that
 * did not change.
 */
const OG_TEMPLATE_VERSION = 4;

/**
 * The R2 key for a post's generated social image.
 *
 * DETERMINISTIC FROM WHAT THE CARD RENDERS, which is the property that makes
 * generation idempotent and lets the object be served immutable. The key must
 * change exactly when the card would look different and never otherwise, and
 * until 2026-08-14 it did neither:
 *
 *   DESCRIPTION was hashed and is not drawn. The v3 template removed it from
 *   the card, so editing a description minted a new key for a byte-identical
 *   picture and abandoned the old object. Wasted work in one direction.
 *
 *   TAGS are drawn, on the chrome band, and were not hashed. Retagging a post
 *   changed what the card should say while the key stood still, so the
 *   immutable object nobody would re-request stayed correct forever and wrong
 *   forever. A stale card in the other direction, which is the worse half.
 *
 * AT v4 THE SAME LAW MOVED THE SET AGAIN, in the direction it always points.
 * Tags left the card, so they leave the hash. The description and the
 * publication date arrived on the card, so they join it.
 *
 * EVERY TEXT INPUT IS HASHED AS DRAWN, through the very functions the template
 * paints with, which is `slice(0, 3)`'s principle generalised. `cardTitle` and
 * `cardDescription` cut on a word boundary; `longDateUTC` is the one owner of a
 * timestamp as a date a person reads, and it is the STRING it returns that is
 * hashed rather than the timestamp, because two instants in the same UTC day
 * draw the same card and must not mint two keys. Hashing the raw fields instead
 * would put back exactly the defect the v3 note above records: an edit past the
 * cut minting a new key for a byte-identical picture.
 *
 * The title's fitted SIZE is not hashed and does not need to be: it is a pure
 * function of the drawn title, which is hashed, so it cannot move on its own.
 *
 * The slug stays in the input even though it is not drawn. It costs nothing,
 * the key template puts it in the object name anyway, and dropping it would be
 * a second change riding along with a ruling that did not ask for one.
 *
 * The separator is a newline, and every field is now free text, so it is worth
 * saying why that is still safe: the fields are joined in a FIXED ORDER and the
 * count is fixed, so a newline inside a description shifts nothing into another
 * field's position. A collision would need two posts whose whole joined input
 * matched, which is the same string.
 *
 * FNV-1a rather than a crypto hash: pure JS, identical in Node and in a Worker,
 * no imports, and this is a cache-busting key rather than a security boundary.
 *
 * Only the KEY is deterministic. The PNG bytes are not, and are deliberately
 * kept out of the gated artifact: font rasterisation is exactly the kind of
 * thing that varies between runs, and the shiki engine incident showed what a
 * byte-comparison gate does with a non-deterministic input.
 *
 * The TEMPLATE is an input too, via OG_TEMPLATE_VERSION above.
 *
 * @param {{
 *   slug: string,
 *   title: string,
 *   description?: string | null,
 *   publishAt?: string | null,
 * }} post
 */

export function ogImageKey(post) {
  /*
   * An absent or unreadable date contributes NOTHING to the input, because it
   * contributes nothing to the card: the template assembles its byline from a
   * filtered list and simply omits the date. This is not hard rule 13's
   * substitution class, which is a fallback standing IN for a value that failed
   * to arrive. There is nothing standing in here; drawn-nothing hashes as
   * nothing, and the two stay in step by saying so out loud rather than by a
   * bare `??` a reader has to interpret.
   */
  const drawnDate = longDateUTC(post.publishAt);
  const input =
    `${OG_TEMPLATE_VERSION}\n${post.slug}\n${cardTitle(post.title)}\n` +
    `${cardDescription(post.description)}\n${drawnDate === null ? "" : drawnDate}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `og/${ASSET_PREFIX}${post.slug}-${hash.toString(16).padStart(8, "0")}.png`;
}

/** How many related posts each post carries. */
const RELATED_LIMIT = 3;

/**
 * Fills in each post's `related` list from tag overlap, across the whole corpus.
 *
 * Must run over ALL posts, in both callers, for the same reason the renderer is
 * shared: relatedness is a property of the set, not of one post. Adding a post
 * changes the related list of every post it shares a tag with, so a writer
 * that recomputed one entry against a stale view of the rest would disagree
 * with the next full build. Both writers therefore run it over the complete
 * corpus: the build over the files, the editor over the D1 corpus plus the
 * saved post (`relatedFor`).
 *
 * Ordering is fully determined: shared tags descending, then newest, then slug.
 * No ties are left to array order, because array order is not stable input.
 *
 * ## VISIBILITY, AND WHY `!draft` WAS NOT IT
 *
 * The filter was `!other.draft`, which is one of the TWO facts that make a post
 * public. A SCHEDULED post is not a draft: its status is published and its
 * `publish_at` is in the future, so it passed this filter and its title and
 * slug could appear in the related list of a post that is already live. That is
 * a title and a URL for something nobody is meant to see yet, rendered into a
 * public page, which is the 2026-07-29 draft leak arriving down a third road.
 *
 * `isPubliclyVisible` is the one JavaScript owner of the rule and is what the
 * Ask upload path composes for the same reason. `statusForDraft` is the mapping
 * between the artifact's boolean and the row's string, so this asks the shared
 * predicate rather than restating half of it.
 *
 * THE READER FILTERS AGAIN, and that is not belt and braces. This list is
 * computed at WRITE time and stored; a post can be unpublished after a related
 * list naming it has already been written. `blog.$slug.tsx` therefore checks
 * the stored list against the live rows before rendering it.
 *
 * @param {any[]} posts
 */
export function withRelated(posts) {
  const now = Date.now();
  return posts.map((post) => {
    const tags = new Set(post.tags);
    const scored = posts
      .filter(
        (other) =>
          other.slug !== post.slug &&
          isPubliclyVisible(
            { status: statusForDraft(other.draft), publishAt: other.publishAt },
            now,
          ),
      )
      .map((other) => ({
        slug: other.slug,
        title: other.title,
        // Carried so the related list can say what each post IS. It takes no
        // part in scoring: the sort below reads `shared`, `publishAt` and
        // `slug`, and nothing else, so the ranking is byte-identical to what it
        // was before this field existed.
        description: other.description ?? null,
        shared: other.tags.filter((/** @type {string} */ t) => tags.has(t)).length,
        publishAt: other.publishAt,
      }))
      .filter((other) => other.shared > 0);

    scored.sort(
      (a, b) =>
        b.shared - a.shared ||
        (a.publishAt < b.publishAt ? 1 : a.publishAt > b.publishAt ? -1 : 0) ||
        (a.slug < b.slug ? -1 : 1),
    );

    return {
      ...post,
      related: scored
        .slice(0, RELATED_LIMIT)
        .map(({ slug, title, description, shared }) => ({ slug, title, description, shared })),
    };
  });
}

/**
 * Every post on this site that a rendered body links to, as slugs.
 *
 * READ FROM THE RENDERED HTML, not the markdown. Markdown has inline links, reference links and
 * raw HTML, and the renderer turns all three into one shape; scanning the source would mean a
 * second, worse parser for the same fact.
 *
 * THE CAPTURE IS DELIBERATELY LOOSE AND THE CORPUS IS THE FILTER. Anchoring the pattern on a slug
 * grammar would put a second copy of that grammar here; instead this returns whatever sits in the
 * path and `withBacklinks` keeps only what is a post. That is also what makes `/blog/tags/x` and
 * `/blog/some-post.md` fall out for free rather than by exclusion, which is hard rule 10's
 * over-wide-exclusion class.
 *
 * @param {string} html
 * @returns {Set<string>}
 */
export function outgoingPostLinks(html) {
  const found = new Set();
  for (const match of html.matchAll(/href="\/blog\/([^"#?]+)(?:[#?][^"]*)?"/g)) {
    found.add(match[1]);
  }
  return found;
}

/**
 * Fills in each post's `backlinks`: the posts on this site that link TO it.
 *
 * THE SAME SHAPE AS `withRelated` AND FOR THE SAME REASON. A backlink is a property of the SET:
 * publishing one post changes the backlink list of every post it links to, so a writer that
 * recomputed one entry against a stale view of the rest would disagree with the next full build.
 * Both writers therefore run this over the complete corpus.
 *
 * IT IS NOT THE MENTIONS SECTION. Webmentions are other people's sites saying they linked here and
 * are approved one at a time; this is this site linking to itself, and it is derived.
 *
 * THE SOURCE IS FILTERED FOR VISIBILITY, not the target. A draft or scheduled post linking to a
 * published one must not put its own title on that public page, which is the same road the related
 * list's `!draft` filter left open. `isPubliclyVisible` is the one JavaScript owner of that rule.
 *
 * THE READER FILTERS AGAIN. This is computed at write time and stored, and a linking post can be
 * unpublished afterwards, so `blog.$slug.tsx` re-checks the stored list against the live rows in
 * the same query it already runs for `related`.
 *
 * NO LIMIT. A cap here would silently drop a real link, and a cap that never fires is an assertion
 * that cannot fail. The list is titles at the foot of the page and it grows with the corpus.
 *
 * @param {any[]} posts
 */
export function withBacklinks(posts) {
  const now = Date.now();
  const isPost = new Set(posts.map((post) => post.slug));
  /** @type {Map<string, Array<{ slug: string, title: string, publishAt: string }>>} */
  const incoming = new Map();

  for (const post of posts) {
    if (
      !isPubliclyVisible(
        { status: statusForDraft(post.draft), publishAt: post.publishAt },
        now,
      )
    ) {
      continue;
    }
    for (const target of outgoingPostLinks(post.html ?? "")) {
      // A post linking to itself is a table of contents, not a backlink.
      if (target === post.slug || !isPost.has(target)) continue;
      const list = incoming.get(target) ?? [];
      list.push({ slug: post.slug, title: post.title, publishAt: post.publishAt });
      incoming.set(target, list);
    }
  }

  return posts.map((post) => {
    // Newest first, then slug. No tie is left to array order, because array order is not stable
    // input: the same corpus read in a different order would otherwise produce a different page.
    const list = (incoming.get(post.slug) ?? []).sort(
      (a, b) =>
        (a.publishAt < b.publishAt ? 1 : a.publishAt > b.publishAt ? -1 : 0) ||
        (a.slug < b.slug ? -1 : 1),
    );
    return {
      ...post,
      backlinks: list.map(({ slug, title }) => ({ slug, title })),
    };
  });
}

/** Built once per isolate. Creating it is the expensive part, not using it. */
function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = buildHighlighter();
  }
  return highlighterPromise;
}

/**
 * Syntax themes, chosen by measurement against the ratified code surfaces.
 *
 * Code blocks no longer carry a theme's own background: they sit on
 * --paper, with the highlighted-line band on --surface-popover. That
 * voided the previous verification, and re-running it condemned the plain
 * github themes: against the warm surfaces, github-light failed four token
 * colours (comments 4.06, strings 3.90, keywords 3.86, constants 2.94) and
 * github-dark failed comments at 3.34. The high-contrast variants clear every
 * one, so the fix is a theme swap rather than hand-mixed hexes.
 *
 * Comments are the single exception, still 4.25 in light after the swap, so
 * they are repointed at the ratified MUTED TEXT colour. That is not a new hex:
 * it is --text-secondary from design-tokens.md, which is what a comment is, and it
 * keeps the one hand-set syntax colour inside the ratified palette.
 *
 * Measured and gated by `npm run check:contrast`.
 */
const COMMENT_LIGHT = "#5C5248";
const COMMENT_DARK = "#B3A99C";

/** @param {any} theme @param {string} colour */
function withCommentColour(theme, colour) {
  /** @type {any[]} */
  const rules = theme.settings ?? theme.tokenColors ?? [];
  return {
    ...theme,
    settings: rules.map((/** @type {any} */ rule) => {
      const scope = Array.isArray(rule?.scope) ? rule.scope : [rule?.scope];
      if (!scope.includes("comment")) return rule;
      return { ...rule, settings: { ...rule.settings, foreground: colour } };
    }),
  };
}

const githubLight = withCommentColour(githubLightHighContrast, COMMENT_LIGHT);
const githubDark = withCommentColour(githubDarkHighContrast, COMMENT_DARK);

/**
 * Exported so `check:contrast` verifies the themes this module actually
 * highlights with. A gate that imported the themes by name would still pass
 * after a swap here, which is the drift it exists to catch.
 */
export const SHIKI_THEMES = { light: githubLight, dark: githubDark };

async function buildHighlighter() {
  return createHighlighterCore({
    themes: [githubLight, githubDark],
    langs: Object.values(GRAMMARS),
      // Oniguruma, not the JavaScript regex engine.
      //
      // The JS engine avoids shipping a WASM binary, which is why it was chosen
      // first, but it is NOT deterministic: measured 2026-07-28, eight renders
      // of the same TypeScript snippet in one process produced two different
      // outputs, and separate processes coloured the `=` operator #D73A49,
      // #005CC5 and #24292E on different runs. Token boundaries were stable;
      // only scope resolution moved.
      //
      // That is fatal here specifically. `check:content` compares the committed
      // artifact against a fresh generation byte for byte, so a non-deterministic
      // highlighter makes the gate fail at random on any post containing code,
      // and makes the editor's rows disagree with the build's for no reason.
      // Oniguruma was deterministic over the same test. The WASM binary is the
      // price of a gate that means something.
    engine: await createOnigurumaEngine(await wasmLoader()),
  });
}

/**
 * A directive's attributes as plain strings.
 *
 * `mdast-util-directive` types an attribute value as `string | null | undefined`,
 * because `:::figure{src}` with no value is legal markdown. Every consumer here
 * wants strings, and an attribute written with no value is indistinguishable
 * from one that was not written, so those keys are DROPPED rather than carried
 * through as null and stringified into markup later.
 *
 * @param {{ attributes?: Record<string, string | null | undefined> | null | undefined }} node
 * @returns {Record<string, string>}
 */
function attributesOf(node) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries(node.attributes ?? {})) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * Turns `:::figure{src= alt= credit=}` into real figure markup.
 * @param {string} file
 */
function remarkFigure(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "containerDirective" || node.name !== "figure") return;

      const attrs = node.attributes ?? {};
      if (!attrs.src) {
        throw new ContentError(file, ":::figure requires a src attribute");
      }
      if (!attrs.alt) {
        // WCAG 2.2 AA. A figcaption is announced separately and describes the
        // image rather than replacing it, so it is not a substitute for alt.
        throw new ContentError(file, `:::figure ${attrs.src} requires an alt attribute`);
      }

      /** @type {any[]} */
      const captionChildren = [...(node.children ?? [])];

      /** @type {any[]} */
      const figureChildren = [
        {
          type: "paragraph",
          data: { hName: "img", hProperties: { src: attrs.src, alt: attrs.alt } },
          children: [],
        },
      ];

      if (captionChildren.length > 0 || attrs.credit) {
        /** @type {any[]} */
        const caption = [...captionChildren];
        if (attrs.credit) {
          caption.push({
            type: "paragraph",
            data: { hName: "span", hProperties: { className: ["figure-credit"] } },
            children: [{ type: "text", value: attrs.credit }],
          });
        }
        figureChildren.push({
          type: "paragraph",
          data: { hName: "figcaption" },
          children: caption,
        });
      }

      node.data = { ...node.data, hName: "figure" };
      node.children = figureChildren;
    });
  };
}

/**
 * The colours `:swatch` accepts, and the enumeration IS the policy.
 *
 * `#RGB`, `#RRGGBB`, `#RRGGBBAA` and nothing else. A named colour, `rgb()`,
 * `color-mix()` and `currentColor` are all refused, because each of them makes
 * the rendered artifact depend on something outside the source: a name resolves
 * through the UA's colour table, `color-mix()` through the cascade,
 * `currentColor` through whatever the chip happens to inherit. The html this
 * pipeline writes is a pure function of the markdown, and a chip that renders
 * differently in two engines is a chip no gate can hold to anything.
 *
 * ANCHORED AT BOTH ENDS, per hard rule 10. Without `^` and `$` this accepts
 * `#6B4FBBZZ` by matching its prefix, which is the unanchored-needle class.
 */
const SWATCH_HEX = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

/**
 * Turns `:swatch[#6B4FBB]` and `:swatch[Brand purple]{color=#6B4FBB}` into a
 * colour chip beside its own label.
 *
 * ## VALIDATION IS IN REMARK, which is the placement `remarkMathValidate`
 * states and the reason is the same: a bad colour fails the build naming the
 * file and the line, before anything renders, rather than painting a square
 * nobody chose onto a published page.
 *
 * ## IT ALSO RENDERS HERE, which is where it differs from the chart split
 *
 * `remarkChart` splits into a rehype half because a chart needs a MODEL built
 * between the two. A swatch needs no model: the output is markup plus one
 * attribute value, so this takes `remarkFigure`'s shape, validating and setting
 * `hName` in one pass, rather than inventing a rehype half with nothing to
 * carry across.
 *
 * ## THE INLINE STYLE IS THE ONLY PER-INSTANCE VALUE
 *
 * Size, radius and the 1px border live in `prose.css`. The colour cannot: it
 * differs at every call site and comes from the post. `style-src-attr
 * 'unsafe-inline'` is already the policy for exactly this shape (measured at
 * 117 inline `--shiki-*` attributes on one post, plus the LQIP placeholder),
 * and `workers/csp.mjs` declares it unconditionally on both planes, so this
 * needs no CSP change.
 *
 * ## THE HEX IS UPPERCASED, in the attribute and in the label
 *
 * So `#6b4fbb` and `#6B4FBB` are the same bytes downstream. Two spellings of
 * one colour rendering as two different pages would make the html a function of
 * how the author held the shift key, which `check:content`'s determinism pass
 * would be right to call drift.
 *
 * ## THE LABEL IS THE SECOND CHANNEL, which is why the chip is aria-hidden
 *
 * Binding usage rule 1 of the ratified palette: colour is never the only
 * channel. The chip is the colour; the code span beside it is the text. A
 * screen reader, a forced-colors reader and a reader with any CVD all get the
 * value rather than a square they cannot price. Announcing the empty decorative
 * square as well would be noise on top of the answer.
 *
 * @param {string} file
 */
function remarkSwatch(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "textDirective" || node.name !== "swatch") return;

      const attrs = /** @type {Record<string, string>} */ (node.attributes ?? {});
      /*
       * Text children only. A swatch label is a word or a hex, and letting it
       * carry nested markup would put an element inside the `<code>` below,
       * which is not what a code span in this position is for.
       */
      const label = (node.children ?? [])
        .map((child) => (child.type === "text" ? child.value : ""))
        .join("")
        .trim();
      /*
       * "OF THE BODY", for the reason `remarkMathValidate` records rather than
       * as a hedge: this tree is parsed from the frontmatter-stripped content,
       * so the number is a line of the body. Saying which it is a line OF is
       * correct for the build and for the editor preview, which is handed a
       * body with no file around it and cannot be given a file-absolute number.
       */
      const line = node.position?.start?.line;
      const where = `:swatch${line ? ` on line ${line} of the body` : ""}`;

      const raw = (attrs.color ?? label).trim();
      if (raw.length === 0) {
        throw new ContentError(
          file,
          `${where} carries no colour. Write :swatch[#RRGGBB], or ` +
            `:swatch[a label]{color=#RRGGBB} when the label is not the hex.`,
        );
      }
      if (!SWATCH_HEX.test(raw)) {
        throw new ContentError(
          file,
          `${where} cannot use ${JSON.stringify(raw)} as a colour. Only #RGB, ` +
            `#RRGGBB and #RRGGBBAA are accepted: a named colour, rgb() or ` +
            `color-mix() would make the rendered page depend on something ` +
            `outside this file.`,
        );
      }

      const hex = raw.toUpperCase();
      // Uppercased WHEREVER it is shown, so a label that IS the hex agrees with
      // the attribute. A prose label is left exactly as the author wrote it.
      const text = attrs.color ? label : hex;

      node.data = {
        ...node.data,
        hName: "span",
        hProperties: { className: ["swatch"] },
      };
      node.children = /** @type {any} */ ([
        {
          /*
           * `emphasis` carries no meaning here and never reaches the output:
           * `hName` replaces the tag before it is serialised. It is the inline
           * counterpart of the `paragraph`-with-hName that `remarkFigure` uses
           * for its `<img>`, chosen because an inline node type is what belongs
           * inside a text directive's children.
           */
          type: "emphasis",
          data: {
            hName: "span",
            hProperties: {
              className: ["swatch-chip"],
              style: `--swatch:${hex}`,
              "aria-hidden": "true",
            },
          },
          children: [],
        },
        {
          type: "inlineCode",
          value: text,
          data: { hProperties: { className: ["swatch-label"] } },
        },
      ]);
    });
  };
}

/**
 * The media key a URL points at, or null.
 *
 * Two shapes, because the index holds two storage tiers in one key space. An R2
 * object is cited as `/media/<key>`; a static asset IS its public path and is
 * indexed under that path, so `/publications/paper.pdf` cites the row keyed
 * `/publications/paper.pdf`.
 *
 * An absolute URL works through the same code, because a post that hardcodes the
 * site origin is making a citation nobody should be able to lose by having
 * written it the long way.
 *
 * A path whose extension `classify()` does not recognise returns null, and that
 * is the right refusal: `/blog/something` is a page link, not a media citation,
 * and counting it would fill `media_refs` with rows that can never join.
 *
 * @param {string} raw
 * @returns {string | null}
 */
function mediaKeyOf(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;

  let path = raw;
  const origin = path.match(/^(?:[a-z][a-z0-9+.-]*:)?\/\/[^/]+(\/.*)$/i);
  // The capture group cannot be absent when the match succeeded; falling back
  // to the unchanged path is what the `if` already meant.
  if (origin) path = origin[1] ?? path;
  // Query and fragment are not part of the key: `?w=320` is a transform request.
  // `split` always yields a first element, so the fallback is unreachable, and
  // an empty path fails the `startsWith` on the next line either way.
  path = path.split(/[?#]/)[0] ?? "";
  if (!path.startsWith("/")) return null;

  if (path.startsWith("/media/")) {
    const key = path.slice("/media/".length);
    return key.length > 0 ? key : null;
  }

  try {
    classify(path);
  } catch {
    return null;
  }
  return path;
}

/**
 * Records every media citation the renderer is about to emit.
 *
 * **This runs at RENDER time, and that is the whole point.** A scan asks "does
 * this text contain the URL"; this asks "did the renderer emit a reference to
 * it", which is a different and better question. The fail-open it closes: a
 * content type whose resolver was never registered returned no citations,
 * `resolveCitations` reported `complete: true`, and the library showed "Unused"
 * beside a working Delete button. Absence is not failure. Anything that goes
 * through this pipeline is now indexed by construction, and anything that does
 * not is an enumerable gap rather than a silent one.
 *
 * Placed BEFORE `remarkFigure` deliberately. Once that has run, a figure's image
 * is a paragraph carrying `hName: "img"` and the directive is gone, so the form
 * would collapse to `markdown-image`. Running first is what lets
 * `figure-directive` be distinguished at all.
 *
 * @param {any[]} sink
 */
function remarkCollectMedia(sink) {
  return (/** @type {import("mdast").Root} */ tree) => {
    /** @param {string | null | undefined} url @param {string} form @param {any} node */
    const add = (url, form, node) => {
      const key = mediaKeyOf(url ?? "");
      if (!key) return;
      sink.push({
        key,
        form,
        detail: node?.position?.start?.line ? `line ${node.position.start.line}` : null,
      });
    };

    visit(tree, (node) => {
      switch (node.type) {
        case "image":
          add(node.url, "markdown-image", node);
          break;
        case "link":
          add(node.url, "link", node);
          break;
        // Reference-style definitions: `[label]: /media/x.png`. The link that
        // uses one carries no URL of its own, so the definition is where the
        // citation actually lives.
        case "definition":
          add(node.url, "link", node);
          break;
        case "containerDirective":
          if (node.name === "figure") add(node.attributes?.src, "figure-directive", node);
          break;
        // Raw HTML written into a post. Matched by regex rather than parsed,
        // deliberately: this catches every attribute that could carry a URL,
        // where a parser would have to be taught each one. Over-detection is
        // safe here because the only consequence is refusing a delete.
        case "html": {
          const text = String(node.value ?? "");
          for (const match of text.matchAll(/["'\s(]((?:https?:)?\/[^"'\s)>]+)/g)) {
            add(match[1], "html", node);
          }
          break;
        }
        default:
          break;
      }
    });
  };
}

/**
 * Turns an inline directive whose name begins with a digit back into text.
 *
 * `remark-directive` accepts digits in a directive name, so ordinary prose is
 * parsed as markup: `4.5:1` yields a text directive named `1`, `12:30` yields
 * one named `30`, and `localhost:8080` yields one named `8080`. Each rendered as
 * an empty `<div>`, silently eating the rest of the token. The palette article
 * shipped with its contrast ratios wrapped in code spans to dodge this.
 *
 * Nothing legitimate is lost. A directive is an authoring construct and every
 * one this pipeline defines is a word (`figure`, `chart`, `diagram`), so a name
 * that starts with a digit is always prose that got captured.
 *
 * Reconstructed by slicing the ORIGINAL SOURCE at the node's offsets rather than
 * rebuilding `:` + name, so a directive that also carried a label or attributes
 * comes back exactly as written instead of being silently truncated.
 *
 * Only inline directives are treated this way. Measured: `::30` does not parse
 * as a leaf directive at all, and a numeric CONTAINER needs a deliberate `:::99`
 * at the start of a line, which prose does not produce by accident.
 *
 * @param {string} source the markdown these positions refer to
 */
function remarkNumericTextDirectives(source) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, "textDirective", (node, index, parent) => {
      if (!parent || index === undefined || index === null) return;
      if (!/^\d/.test(node.name ?? "")) return;
      const { start, end } = node.position ?? {};
      if (start?.offset === undefined || end?.offset === undefined) return;
      parent.children[index] = {
        type: "text",
        value: source.slice(start.offset, end.offset),
        position: node.position,
      };
    });
  };
}

/**
 * Fails the build on an expression KaTeX cannot render, naming the post.
 *
 * The remark half of the split `remarkChart` uses and for the reason recorded
 * there: validation belongs in remark, so a bad expression fails the build
 * naming the post before anything is rendered. `math.mjs` owns WHY an option
 * cannot do this job, and throws a plain Error; this wraps it in the file, the
 * line and the expression, because "KaTeX parse error" on its own sends the
 * reader hunting through a post for a dollar sign.
 *
 * Also the AST-side owner of `hasMath`. The html-side reader is `htmlHasMath`,
 * and `check:content` makes the two argue over the whole corpus.
 *
 * @param {string} file
 * @param {{ value: boolean }} sink set to true when the post carries any math
 */
function remarkMathValidate(file, sink) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "inlineMath" && node.type !== "math") return;
      sink.value = true;

      const expression = String(/** @type {any} */ (node).value ?? "");
      const line = node.position?.start?.line;
      try {
        /*
         * The rendered string is discarded: this call is about whether it
         * throws. `KATEX_OPTIONS` is the SAME object rehype-katex is handed
         * below, which is what makes surviving this pass a proof that its
         * catch branch is unreachable.
         */
        katex.renderToString(expression, {
          ...KATEX_OPTIONS,
          displayMode: node.type === "math",
          throwOnError: true,
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        /*
         * "OF THE BODY", and the qualifier is a correction rather than pedantry.
         *
         * The plant on 2026-09-06 put a malformed expression on line 21 of the
         * file and this said "line 13", because the tree was parsed from
         * `parsed.content`, which has the frontmatter stripped. Adding the
         * offset back is not available: `renderBody` is also the editor's
         * preview renderer and is handed a body with no file around it, so the
         * number would be right for the build and wrong for the pane. Saying
         * which line it is a line OF is correct for both callers.
         */
        throw new ContentError(
          file,
          `KaTeX cannot render ${node.type === "math" ? "the display" : "the inline"} ` +
            `expression${line ? ` on line ${line} of the body` : ""}: ${detail}. ` +
            `The expression is: ${expression.trim()}`,
        );
      }
    });
  };
}

/**
 * Turns `:::details{summary="Raw counts"}` into a native `<details>`.
 *
 * SUPPLEMENTARY MATERIAL ONLY: long methods, raw data, an appendix. Never the main argument, and
 * that is not left to a comment. A heading inside is REFUSED, because a heading is how this site
 * spells "section of the argument": it goes in the table of contents, it is a link target, and a
 * section that is in the contents and invisible until somebody clicks is the exact failure the rule
 * is about. Prose, tables, code and lists are all fine.
 *
 * NATIVE `details`, so the text is IN THE HTML whether or not anything runs. A reader with no
 * script opens it; a reader who prints gets it open; a search engine and the markdown twin have it
 * either way. No enhancement is registered for this, because there is nothing to enhance.
 *
 * THE SUMMARY IS REQUIRED. A disclosure with no label is a triangle, and a reader deciding whether
 * to open it is deciding blind.
 *
 * @param {string} file
 */
function remarkDetails(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "containerDirective" || node.name !== "details") return;

      const summary = (node.attributes ?? {}).summary;
      if (!summary) {
        throw new ContentError(file, ":::details requires a summary attribute");
      }

      const heading = (node.children ?? []).find((child) => child.type === "heading");
      if (heading) {
        const line = heading.position?.start?.line;
        throw new ContentError(
          file,
          `:::details holds a heading${line ? ` on line ${line}` : ""}, which makes it a section ` +
            "of the argument rather than supplementary material. A heading is in the table of " +
            "contents and is a link target, so collapsing it hides a section a reader was sent " +
            "to. Use it for long methods, raw data or an appendix, and leave the argument open.",
        );
      }

      node.data = { ...node.data, hName: "details", hProperties: { className: ["post-details"] } };
      node.children = [
        {
          type: "paragraph",
          data: { hName: "summary" },
          children: [{ type: "text", value: String(summary) }],
        },
        .../** @type {any[]} */ (node.children ?? []),
      ];
    });
  };
}

/** At most this many pull quotes on a page. The third one is a design with no hierarchy left. */
const PULL_QUOTE_LIMIT = 2;

/**
 * `:::sidenote{kind="Fallback"}` puts a short note in the rail beside the paragraph it follows.
 *
 * IT STAYS IN THE PROSE FLOW AND IS FLOATED INTO THE RAIL, which is the one arrangement that
 * aligns without measuring. The handoff sketches it inside `.post-rail`, but a note in that
 * container can only line up with its paragraph if something reads the paragraph's position, and
 * that is JavaScript on a plane that does not hydrate. Left where the author wrote it, the note
 * aligns because it is a sibling of the paragraph it annotates, and `post-rail.css` floats it into
 * the rail's column. At one column the float is dropped and it reads inline, in reading order.
 *
 * THE KIND IS REQUIRED, like `:::details`'s summary: the label is what tells a reader whether the
 * note is an aside, a caveat or a measurement before they decide to read it.
 *
 * AN `aside`, so a screen reader can skip it and so it is announced as tangential, which is what a
 * sidenote is.
 *
 * @param {string} file
 */
function remarkSidenote(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    /* Per document, so the numbering restarts on every post and `#sn-1` is always its first. */
    let noteIndex = 0;
    visit(tree, (node) => {
      if (node.type !== "containerDirective" || node.name !== "sidenote") return;

      const kind = (node.attributes ?? {}).kind;
      if (!kind) {
        throw new ContentError(
          file,
          ':::sidenote requires a kind attribute, for example :::sidenote{kind="Fallback"}. ' +
            "The label is the reader's only cue about what the note is before they read it.",
        );
      }

      const heading = (node.children ?? []).find((child) => child.type === "heading");
      if (heading) {
        const line = heading.position?.start?.line;
        throw new ContentError(
          file,
          `:::sidenote holds a heading${line ? ` on line ${line}` : ""}. A heading is a section ` +
            "of the argument: it lands in the table of contents and is a link target, and the " +
            "rail is not where a section goes. Keep a note to prose.",
        );
      }

      /*
       * AN ID, SO A MARKER CAN ANCHOR TO IT. Numbered in source order, which is the order a reader
       * meets them, so `#sn-1` is the page's first note and stays that for whoever links to it.
       * Without one a note is unreferenceable, and adding markers later would have to migrate
       * every note that had already shipped.
       */
      noteIndex += 1;
      node.data = {
        ...node.data,
        hName: "aside",
        hProperties: { className: ["post-note"], id: `sn-${noteIndex}` },
      };
      node.children = [
        {
          type: "paragraph",
          data: { hName: "b", hProperties: { className: ["post-note-kind"] } },
          children: [{ type: "text", value: String(kind) }],
        },
        .../** @type {any[]} */ (node.children ?? []),
      ];
    });
  };
}

/**
 * A pull quote is a glance, so it is capped at roughly one line of display type. Longer than this
 * and a reader reads it twice instead of once, which is the failure the aria-hidden is about in the
 * other direction.
 */
const PULL_QUOTE_MAX_CHARS = 160;

/**
 * `:pullquote[a sentence already in the prose]` raises a visual copy of that sentence above its
 * paragraph.
 *
 * IT MARKS THE PROSE, IT DOES NOT DUPLICATE IT, and that is the whole design. Written the obvious
 * way, as a block the author types the sentence into, the sentence would exist TWICE in the source
 * and therefore twice in the markdown twin, which serves the source verbatim. Marking the sentence
 * where it already lives means the twin has it once, the reader of the twin gets the prose
 * unchanged, and the quote cannot drift from the line it quotes because it IS the line.
 *
 * VISUAL ONLY. The raised copy is `aria-hidden`, so a screen reader hears the sentence once, in the
 * paragraph, in order. It is not a `blockquote`: a blockquote is a quotation from somewhere else,
 * and this is the page quoting itself.
 *
 * BEFORE THE PARAGRAPH, never after, because a pull quote a reader meets after reading the sentence
 * is a repetition rather than an invitation.
 *
 * The marker is unwrapped from the prose, so the paragraph renders exactly as it would have.
 *
 * @param {string} file
 */
function remarkPullQuote(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    let raised = 0;
    visit(tree, (node, index, parent) => {
      if (node.type !== "paragraph" || parent?.type !== "root" || index === undefined) return;

      /** @type {any[]} */
      const marks = [];
      visit(node, "textDirective", (child) => {
        if (child.name === "pullquote") marks.push(child);
      });
      if (marks.length === 0) return;

      const line = marks[0].position?.start?.line;
      const where = `:pullquote${line ? ` on line ${line} of the body` : ""}`;

      if (marks.length > 1) {
        throw new ContentError(
          file,
          `${where}: one paragraph carries ${marks.length} pull quotes. A paragraph has one ` +
            "sentence worth raising, and two raised above the same paragraph read as a list.",
        );
      }

      const mark = marks[0];
      const text = (mark.children ?? [])
        .map((/** @type {any} */ child) => (child.type === "text" ? child.value : ""))
        .join("")
        .trim();

      if (text.length === 0) {
        throw new ContentError(
          file,
          `${where} is empty. Wrap the sentence it should raise: :pullquote[the sentence].`,
        );
      }
      if (text.length > PULL_QUOTE_MAX_CHARS) {
        throw new ContentError(
          file,
          `${where} is ${text.length} characters and the limit is ${PULL_QUOTE_MAX_CHARS}. ` +
            "A pull quote is read at a glance; mark the clause rather than the sentence.",
        );
      }

      const at = (node.children ?? []).indexOf(mark);
      if (at === -1) {
        throw new ContentError(
          file,
          `${where} is nested inside other markup. It must sit directly in the paragraph, so the ` +
            "sentence it raises is the sentence a reader reads.",
        );
      }

      raised += 1;
      if (raised > PULL_QUOTE_LIMIT) {
        throw new ContentError(
          file,
          `${where} is pull quote number ${raised} and the limit is ${PULL_QUOTE_LIMIT}. ` +
            "A third one is a page with no emphasis left to spend.",
        );
      }

      // The marker leaves the prose, and its own children stay: the paragraph renders unchanged.
      node.children.splice(at, 1, .../** @type {any[]} */ (mark.children ?? []));

      parent.children.splice(index, 0, {
        type: "paragraph",
        data: {
          hName: "p",
          hProperties: { className: ["pull-quote"], "aria-hidden": "true" },
        },
        children: [{ type: "text", value: text }],
      });

      // Past the quote just inserted and past the paragraph it was read from.
      return index + 2;
    });
  };
}

/**
 * Every directive this pipeline understands. Adding one means adding it here.
 */
export const KNOWN_DIRECTIVES = [
  "chart",
  "details",
  "diagram",
  "figure",
  "pullquote",
  "sidenote",
  "swatch",
];

/**
 * Fails the build on any directive this pipeline does not implement.
 *
 * Ruled 2026-07-30. An unhandled directive is not inert: remark-rehype turns it
 * into a bare `<div>`, so `:::figrue` publishes a silent empty element where a
 * figure was meant to be, and the author's caption disappears. Silent wrong
 * output is the class this repo forbids everywhere else, and a typo is exactly
 * the case that never gets noticed in review.
 *
 * Verified before it was switched on: a scan of all 11 posts found 2 directives
 * in total, both `:::chart`, and zero unknown ones, so nothing existing had to
 * be fixed to turn this on.
 *
 * Runs AFTER remarkNumericTextDirectives, so prose that only looked like a
 * directive (`4.5:1`, `12:30`, `localhost:8080`) is already text and never
 * reaches here. A numeric CONTAINER (`:::99`) does reach here and is an error,
 * which is right: three colons at the start of a line is deliberate syntax.
 *
 * @param {string} file
 */
function remarkUnknownDirectives(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      /*
       * THE THREE DIRECTIVE TYPES ARE NAMED rather than matched on a suffix.
       *
       * `String(node.type).endsWith("Directive")` is true of exactly these
       * three nodes, and no compiler can narrow a union through it, so
       * `node.name` was being read off the whole union and needed an `any`.
       * Naming them narrows, and the marker below already enumerated two of
       * the three anyway.
       */
      if (
        node.type !== "containerDirective" &&
        node.type !== "leafDirective" &&
        node.type !== "textDirective"
      ) {
        return;
      }
      const type = node.type;
      const name = node.name ?? "";
      if (KNOWN_DIRECTIVES.includes(name)) return;

      const marker =
        type === "containerDirective" ? ":::" : type === "leafDirective" ? "::" : ":";
      const line = node.position?.start?.line;
      throw new ContentError(
        file,
        `unknown directive "${marker}${name}"${line ? ` on line ${line}` : ""}. ` +
          `Known directives: ${KNOWN_DIRECTIVES.join(", ")}. ` +
          "If this is ordinary prose, escape the colon as \\: or wrap it in a code span.",
      );
    });
  };
}

/**
 * Validates `:::chart` and hands the model to the rehype half.
 *
 * The work is split across the two phases on purpose. Validation belongs in
 * remark, so a bad chart fails the build naming the post before anything is
 * rendered; but the caption is author-written markdown, and it only becomes hast
 * after remark-rehype has run. Building the figure here would mean either
 * dropping caption formatting or re-implementing markdown rendering.
 *
 * @param {string} file
 * @param {any[]} sink models, indexed by the marker written onto the node
 */
function remarkChart(file, sink) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "containerDirective" || node.name !== "chart") return;

      const children = node.children ?? [];
      // NARROWED BY THE FILTER, so `.value` below is a string rather than a
      // property read off the whole block-content union.
      const dataNodes = children.filter((c) => c.type === "code");
      const data = dataNodes[0];
      if (dataNodes.length !== 1 || !data) {
        throw new ContentError(
          file,
          `:::chart requires exactly one fenced code block of data, found ${dataNodes.length}`,
        );
      }

      /** @type {any} */
      let model;
      try {
        model = buildChartModel(attributesOf(node), data.value);
      } catch (error) {
        throw new ContentError(
          file,
          error instanceof Error ? error.message : String(error),
        );
      }

      const index = sink.push(model) - 1;
      node.data = {
        ...node.data,
        hName: "figure",
        hProperties: { className: ["chart-figure"], "data-chart": String(index) },
      };
      // Everything that is not the data block is the caption.
      node.children = children.filter((/** @type {any} */ c) => c.type !== "code");
    });
  };
}

/**
 * Wraps every table in a scroll container, so a table wider than the reading column scrolls
 * ITSELF instead of scrolling the document.
 *
 * MEASURED, not assumed: at 320 the table in ten-years-on-cloudflare is 431px against a 320px
 * viewport and put 135px of horizontal scroll on the whole page. Ruling 118 item 4 is the rule it
 * breaks, and 6f259704 is the last time this shape shipped.
 *
 * WHY A WRAPPER RATHER THAN `display: block` ON THE TABLE, which needs no markup at all: display
 * is what the implicit table role is mapped from, so blocking the table can strip its semantics
 * from a screen reader. The wrapper leaves the table a table.
 *
 * `tabindex` is on the wrapper because a scroll container reachable only by pointer is a keyboard
 * trap in reverse. It carries no `role="region"`: an unnamed region announces itself and says
 * nothing, which is worse than a plain focusable box.
 */
function rehypeTableScroll() {
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "table" || !parent || index === undefined) return;
      if (parent.type === "element" && parent.properties?.className?.includes?.("table-scroll")) return;
      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["table-scroll"], tabIndex: 0 },
        children: [node],
      };
    });
  };
}

/**
 * Replaces each marked figure's children with the rendered chart.
 *
 * @param {any[]} models
 */
function rehypeChart(models) {
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (node) => {
      const marker = node.properties?.["data-chart"];
      if (marker === undefined) return;
      const model = models[Number(marker)];
      delete node.properties["data-chart"];
      node.children = renderChartHast(model, node.children ?? []);
    });
  };
}

/**
 * Validates `:::diagram` and hands the model to the rehype half.
 *
 * Split across the two phases for the same reason `:::chart` is: validation
 * belongs in remark so a bad diagram fails the build naming the post, while the
 * caption is author-written markdown that only becomes hast after remark-rehype
 * has run.
 *
 * @param {string} file
 * @param {any[]} sink models, indexed by the marker written onto the node
 */
function remarkDiagram(file, sink) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "containerDirective" || node.name !== "diagram") return;

      const children = node.children ?? [];
      // NARROWED BY THE FILTER, same reason as the chart directive above.
      const sourceNodes = children.filter((c) => c.type === "code");
      const source = sourceNodes[0];
      if (sourceNodes.length !== 1 || !source) {
        throw new ContentError(
          file,
          `:::diagram requires exactly one fenced code block of mermaid source, found ${sourceNodes.length}`,
        );
      }
      // The fence language is checked rather than ignored. An author who writes
      // ```js inside a diagram has made a mistake worth naming, and the fence is
      // also what makes the source render as mermaid in the .md twin, on GitHub
      // and anywhere else that reads the markdown instead of the page.
      const lang = source.lang ?? "";
      if (lang !== "mermaid") {
        throw new ContentError(
          file,
          `:::diagram source must be a \`\`\`mermaid fenced block, found \`\`\`${lang || "(none)"}`,
        );
      }

      /** @type {any} */
      let model;
      try {
        model = buildDiagramModel(attributesOf(node), source.value);
      } catch (error) {
        throw new ContentError(
          file,
          error instanceof Error ? error.message : String(error),
        );
      }

      const index = sink.push(model) - 1;
      node.data = {
        ...node.data,
        hName: "figure",
        hProperties: { className: ["diagram-figure"], "data-diagram": String(index) },
      };
      // Everything that is not the source block is the caption.
      node.children = children.filter((/** @type {any} */ c) => c.type !== "code");
    });
  };
}

/**
 * Replaces each marked figure's children with the diagram's asset references.
 *
 * @param {any[]} models
 */
function rehypeDiagram(models) {
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (node) => {
      const marker = node.properties?.["data-diagram"];
      if (marker === undefined) return;
      const model = models[Number(marker)];
      delete node.properties["data-diagram"];
      node.children = renderDiagramHast(model, node.children ?? []);
    });
  };
}

/* -------------------------------------------------------------------------
 * URL protocol allowlist
 *
 * Ruled 2026-08-01 (dustinedwards/url-protocol-allowlist.md), on a finding
 * measured the day before: `[x](javascript:alert(1))` rendered as a LIVE href
 * and reached the stored HTML, the gated artifact, D1 and the published page.
 * The operator API writes posts, so it was agent-reachable on a public surface
 * with no human click anywhere in the path.
 *
 * It lives at the render layer, and that placement is the whole point. There is
 * one renderer on this site, so one guard here binds every writer identically:
 * the build script, an editor save, an operator save, and the admin preview all
 * call `renderBody`. A check in the editor would have protected the one path
 * that already has a human looking at it and missed the one that does not.
 * ---------------------------------------------------------------------- */

/** https, http, mailto, and anything with no scheme at all. */
const ALLOWED_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

/**
 * Strips what a browser strips, and then some, before the scheme is read.
 *
 * The URL spec has a user agent remove ASCII tab and newline from ANYWHERE in a
 * URL and trim leading and trailing C0 controls and space. That is what makes
 * `java\tscript:` live: the browser removes the tab and is left with a
 * javascript URL. Measured on this pipeline, and it is not theoretical here,
 * because `:::figure{src=...}` passes its value through raw where markdown
 * would have percent-encoded the tab.
 *
 * Every other C0 control and DEL is removed too, which is STRICTER than the
 * spec. That direction is deliberate: removing characters can only turn an
 * unrecognised string into a recognised scheme, so being aggressive can only
 * ever block more, never allow more. A NUL inside the scheme is the case that
 * matters. Left in place it makes the scheme pattern fail to match, and the URL
 * then falls through as "relative", which is the one outcome we cannot afford
 * to get wrong.
 *
 * Percent escapes are deliberately NOT decoded. `%09` and `%20` are not valid
 * in a scheme, so a browser already treats `java%09script:` as a relative path
 * and it is inert; decoding it here would buy no safety and would start
 * rejecting legitimate relative paths that merely contain an encoded colon.
 *
 * @param {string} raw
 * @returns {string}
 */
function normalizeForProtocolTest(raw) {
  let out = "";
  for (const character of raw) {
    const code = character.codePointAt(0) ?? 0;
    // C0 controls, space, and DEL. Compared by code point rather than
    // matched by an escape sequence, so this line stays plain ASCII.
    if (code <= 0x20 || code === 0x7f) continue;
    // U+FFFD, the replacement character. It is what a NUL inside a link
    // destination becomes by the time markdown has parsed it, measured on this
    // pipeline. Nothing legitimate carries one: its presence means the input
    // was already malformed, so removing it can only expose a scheme somebody
    // was hiding.
    if (code === 0xfffd) continue;
    out += character;
  }
  return out.toLowerCase();
}

/**
 * The scheme a browser would read, or null when there is none.
 * @param {string} value
 * @returns {string | null}
 */
function protocolOf(value) {
  const match = /^([a-z][a-z0-9+.-]*):/.exec(normalizeForProtocolTest(value));
  return match ? `${match[1]}:` : null;
}

/**
 * Percent-decodes without throwing on a malformed escape.
 *
 * A URL is allowed to contain a stray `%`, and `decodeURIComponent` throws on
 * one. Throwing here would turn a typo into a build failure, so a value that
 * cannot be decoded is simply tested in the form it arrived in.
 *
 * @param {string} value
 * @returns {string}
 */
function decodeOrSelf(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Whether a URL may be emitted as a live href or src.
 *
 * No scheme means relative, which covers `/blog/x`, `./notes.md`, `#heading`
 * and `//example.com/x`. Fragments matter more than they look: the heading
 * autolinks and every footnote reference are `#...`, so a guard that rejected
 * schemeless URLs would strip the entire footnote apparatus off every post.
 *
 * BOTH the raw form and the percent-decoded form have to pass. Measured on this
 * pipeline: markdown percent-encodes whitespace inside a link destination, so
 * `[x](<  javascript:alert(1)>)` arrives as `%20%20javascript:alert(1)`. That
 * form is inert in a browser today, because `%` cannot begin a scheme and the
 * URL therefore resolves as a relative path. It is rejected anyway, on the
 * grounds that no author writes it by accident: it only appears when somebody
 * is trying to smuggle a scheme past a check, and "inert in today's URL parser"
 * is a thinner guarantee than "never emitted".
 *
 * The cost is a false positive on a relative path whose first segment carries
 * an encoded colon, as in `foo%3Abar`. The corpus was checked for that shape
 * before this landed and has none.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isAllowedUrl(value) {
  for (const form of [value, decodeOrSelf(value)]) {
    const protocol = protocolOf(form);
    if (protocol !== null && !ALLOWED_PROTOCOLS.has(protocol)) return false;
  }
  return true;
}

/** The `/blog/` prefix a `further_reading` internal link must carry. */
export const INTERNAL_LINK_PREFIX = "/blog/";

/**
 * The two shapes a `further_reading` url may take. See the field's own comment
 * for why a path is permitted at all: the origin changes at cutover.
 *
 * COMPOSED WITH `isAllowedUrl`, never instead of it. This answers "is the
 * SHAPE one of the two allowed" and says nothing about protocols; the schema
 * runs both, so a value has to pass this and the shared allowlist.
 *
 * The internal arm demands a non-empty slug segment after the prefix and
 * refuses a second leading slash, so `/blog/` alone and `/blog//evil.com` are
 * both out. The external arm parses with the URL constructor and then checks
 * the protocol explicitly rather than trusting the parse, because
 * `new URL("mailto:a@b")` succeeds and mailto is not further reading.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isFurtherReadingUrl(value) {
  if (value.startsWith(INTERNAL_LINK_PREFIX)) {
    const slug = value.slice(INTERNAL_LINK_PREFIX.length);
    return SLUG_PATTERN.test(slug);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" || parsed.protocol === "http:";
}

/**
 * The slug a `further_reading` internal link names, or null for an external one.
 *
 * Exported so `check:content` can resolve every internal link against the
 * corpus without re-deriving the prefix rule: a deleted post must fail the
 * build rather than ship a dead link, and a second copy of "what counts as
 * internal" is how the gate and the schema would come to disagree.
 *
 * @param {string} value
 * @returns {string | null}
 */
export function internalLinkSlug(value) {
  if (!value.startsWith(INTERNAL_LINK_PREFIX)) return null;
  const slug = value.slice(INTERNAL_LINK_PREFIX.length);
  return SLUG_PATTERN.test(slug) ? slug : null;
}

/**
 * Demotes a link or image with a disallowed protocol to plain text.
 *
 * It renders as the markdown that produced it rather than as a stripped href or
 * an empty one, because those two both LOOK like the author's link worked. The
 * ruling asks for the failure to be visible in preview, and un-rendered
 * markdown is the one signal every markdown author already reads as "this did
 * not become what I meant". The offending URL stays in the text, so the reason
 * is legible without opening a console.
 *
 * The text is emitted as a text node, so rehype-stringify escapes it on the way
 * out and the blocked URL cannot re-enter the document as markup.
 *
 * Runs LAST in the chain, deliberately, so it sees every href and src the
 * pipeline can emit no matter which plugin produced it: markdown links and
 * images, the `:::figure` directive, diagram assets, heading autolinks and
 * footnote references. A guard placed earlier would only cover the sources that
 * existed when it was written.
 *
 * @param {string} file
 * @param {Array<{ file: string, tag: string, url: string }>} sink
 */
function rehypeUrlProtocols(file, sink) {
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (node, index, parent) => {
      const isLink = node.tagName === "a";
      const isImage = node.tagName === "img";
      if (!isLink && !isImage) return;

      const attribute = isLink ? "href" : "src";
      const raw = node.properties?.[attribute];
      if (raw === undefined || raw === null) return;

      const url = String(raw);
      if (isAllowedUrl(url)) return;

      sink.push({ file, tag: node.tagName, url });

      const text = isLink
        ? `[${textOf(node)}](${url})`
        : `![${String(node.properties?.alt ?? "")}](${url})`;

      if (parent && typeof index === "number") {
        parent.children[index] = { type: "text", value: text };
      }
    });
  };
}

/**
 * The visible text inside a node, for reconstructing link markdown.
 *
 * @param {import("hast").Nodes} node
 */
function textOf(node) {
  let out = "";
  visit(node, "text", (child) => {
    out += child.value;
  });
  return out;
}

/**
 * Everything a body image needs that the markdown did not say: the responsive
 * sources, the intrinsic dimensions, the lazy-loading hints, and the anchor to
 * the ORIGINAL file that wraps the whole thing.
 *
 * The four are written HERE, in one visitor, on purpose. The anchor's href and
 * the `srcset` are two statements about the same object and they are derived
 * from the same `mediaKey`; splitting them into two plugins would let one learn
 * about a storage tier the other had not, and the way that fails is an anchor
 * pointing at a URL the transform route refuses.
 *
 * ## THE FIRST IMAGE IN A POST IS NOT LAZY
 *
 * `loading="lazy"` on every image is right for every image except the one the
 * reader is already looking at. On a post that opens with a figure, that image
 * is the LCP element, and lazy loading it means the browser deliberately waits
 * for layout before it will even request the largest thing on the page.
 *
 * So the first body image is `loading="eager"` with `fetchpriority="high"` and
 * every later one keeps `lazy`. The counter is per RENDER, held in the closure
 * below rather than on the tree, because a single pipeline run renders one
 * document and "first" means first in that document.
 *
 * BOTH WRITERS GET THIS BY CONSTRUCTION, which is the whole reason it is here
 * and not in a route. The repository build and the operator API's publish path
 * are two callers of one `renderAndWrite`, and a rule applied in either one of
 * them would be a rule the other silently lacked. `test/post-image-eager.test.mjs`
 * runs the pipeline over a fixture and asserts the split.
 *
 * DIAGRAMS ARE OUT, and so they cannot claim the eager slot: they return before
 * the counter is touched, on the same class test that excludes them from
 * measurement.
 *
 * ## THE PLACEHOLDER IS STATIC ONLY, AND `/media/` KEYS ARE EXCLUDED
 *
 * A `public/` content image gets an LQIP background; an uploaded object does
 * not, and the asymmetry is deliberate rather than unfinished.
 *
 * This plugin is a PURE function of the src plus whatever the injected
 * `resolveImage` returns, and that is finding B002's repair: the rendered HTML
 * is byte-compared by `check:content`, so anything baked into it must be
 * reproducible from a clone with no bindings and no network. A `public/`
 * placeholder is: `build:assets` derives it with sharp and commits it to
 * `content/generated/assets.json`, and both resolvers read that one file. A
 * `/media/` placeholder is not. The bytes live only in R2, nothing in the
 * repository can derive one, and the key cannot carry it the way it carries
 * dimensions, because a data URI is hundreds of bytes and the key is an
 * address. Three other candidates were considered and refused: writing the
 * attribute in a route (a second place that writes img attributes, rule 17),
 * fetching it at render time (a race against the image it stands in for), and
 * reading it from D1 (which inverts rule 18, the index deriving the artifact).
 *
 * QUEUED, not built: a dominant colour carried in the `/media/` key grammar at
 * upload time, which WOULD be pure from the key. That is a change to the key
 * grammar and to every uploaded object, so it is its own decision.
 *
 * WHAT IT COSTS, measured 2026-09-06 on `images-in-prose-fixture` by stripping
 * exactly these two attributes from the rendered HTML and compressing both: 483
 * bytes raw, 370 brotli, per image. Base64 is already high entropy, so brotli
 * takes almost nothing off it. A dated observation, not a property: there is no
 * ceiling on this and nothing recomputes it.
 *
 * @param {string} file
 * @param {(src: string) => Promise<{ width: number, height: number, placeholder?: string }>} resolveImage
 * @param {Array<Promise<void>>} pending
 */
function rehypeImageSources(file, resolveImage, pending) {
  let seen = 0;
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "img") return;
      // A diagram's asset is rendered by a LATER build step and legitimately may
      // not exist yet, so measuring it here would make the artifact depend on the
      // filesystem and would fail the build on a diagram that has simply not been
      // rendered. The pair is sized by CSS instead. Checked by class rather than
      // by plugin order, so moving this plugin cannot silently re-enable it.
      const classes = node.properties?.className ?? [];
      if (Array.isArray(classes) && classes.includes("diagram-image")) return;
      const src = String(node.properties?.src ?? "");

      // RESPONSIVE SOURCES, for images the transform route can actually serve.
      //
      // The prose column is 44rem, so a full-width slot needs 1408 physical
      // pixels on a 2x display, and the largest width available before the
      // content ladder existed was 640. Every content image was therefore being
      // served at under half the resolution a modern screen asks for.
      //
      // Safe in the gated artifact because it is a PURE function of the src: no
      // filesystem, no database, no measurement. `sizes` and the device pixel
      // ratio do the choosing in the browser, with no JavaScript.
      //
      // Only `/media/` keys get this. A static asset is served straight from the
      // assets host and never passes through the transform route, so offering
      // widths for one would advertise URLs that 404.
      const mediaKey = src.startsWith("/media/") ? src.slice("/media/".length) : null;
      const responsive = mediaKey
        ? { srcSet: contentSrcSet(mediaKey), sizes: CONTENT_SIZES }
        : {};

      /*
       * THE IMAGE IS A LINK TO ITS ORIGINAL.
       *
       * `srcset` above hands the browser a closed ladder of widths and it picks
       * the smallest one that fills the slot, so what a reader has actually
       * downloaded is never the file the author uploaded. Until 2026-08-26 the
       * only way to see the original was the lightbox, which opened
       * `currentSrc`: the enhancement promised the full size and delivered the
       * same resized copy that was already on screen, and a reader without
       * script had no route to the original at all.
       *
       * The href is the UNSIZED source, derived from the same `mediaKey` that
       * built `srcset` two lines up rather than by unpicking the `src` string a
       * second time. An R2 object is `/media/<key>` with no `?w=`; a static
       * asset never passes through the transform route, so its own path IS the
       * original.
       *
       * DIAGRAM ASSETS ARE OUT, by the same class test that excludes them from
       * measurement above. A diagram renders as a PAIR of images with one
       * hidden by `display: none`, and post.css chose that property precisely
       * so the hidden half leaves the accessibility tree. Wrapping them would
       * put an anchor AROUND the hidden image, where `display: none` on the
       * child does not apply, leaving a focusable link with no accessible name
       * in every article that carries a diagram.
       *
       * An image the author already wrapped in a markdown link keeps the
       * author's link. Their href is a decision; this one is a default.
       */
      const wrappable =
        src.length > 0 &&
        parent &&
        typeof index === "number" &&
        parent.children[index] === node &&
        !(parent.type === "element" && parent.tagName === "a");
      if (wrappable) {
        parent.children[index] = {
          type: "element",
          tagName: "a",
          properties: { className: ["image-link"], href: mediaKey ? `/media/${mediaKey}` : src },
          children: [node],
        };
      }

      // Counted AFTER every exclusion above, so the first image that actually
      // gets these attributes is the one that gets the eager pair.
      seen += 1;
      const first = seen === 1;

      pending.push(
        resolveImage(src).then(({ width, height, placeholder }) => {
          node.properties = {
            ...node.properties,
            ...responsive,
            width,
            height,
            loading: first ? "eager" : "lazy",
            decoding: "async",
            // Only on the first. `fetchpriority="high"` is a budget, not a
            // dial: marking several images high is the same as marking none.
            ...(first ? { fetchpriority: "high" } : {}),
            /*
             * THE PLACEHOLDER, as a background the real image covers.
             *
             * A class carries the sizing (`post.css`, `.has-lqip`) and the
             * inline style carries only the URL, which is per image and cannot
             * live in a stylesheet. `style-src-attr 'unsafe-inline'` and
             * `img-src 'self' data:` are already the policy, so this needs no
             * CSP change; a background is not an `<img>` and is governed by
             * `img-src` either way.
             *
             * No layout shift, because `width` and `height` are set two lines
             * up and always have been. Nothing here depends on script.
             */
            ...(placeholder
              ? {
                  /*
                   * MEASURED, not assumed: no image reaching this line carries
                   * a class today. The figure directive sets none, raw HTML is
                   * stripped before it gets here, and the diagram pair returns
                   * above on the class test. The spread is what keeps that
                   * true if one ever does, and it is the same
                   * `Array.isArray(className)` idiom the two exclusions above
                   * use rather than a fourth spelling of it. A string form is
                   * NOT handled: nothing produces one, and a branch nothing can
                   * reach is hard rule 10's unfailable condition.
                   */
                  className: [
                    ...(Array.isArray(node.properties?.className) ? node.properties.className : []),
                    "has-lqip",
                  ],
                  // The serializer escapes the quotes to `&#x22;`, and single
                  // quotes are escaped just the same, so this is the plain
                  // spelling rather than a saving. Nothing can break out of it:
                  // the payload is base64, whose alphabet holds no quote,
                  // parenthesis or space.
                  style: `background-image:url("${placeholder}")`,
                }
              : {}),
          };
        }),
      );
    });
  };
}

/**
 * Collects h2 and h3 headings into a table of contents.
 * @param {Array<{ depth: number, id: string, text: string }>} sink
 */
function rehypeCollectToc(sink) {
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "h2" && node.tagName !== "h3") return;
      const id = String(node.properties?.id ?? "");
      if (!id) return;
      // remark-gfm emits a visually hidden "Footnotes" heading to label its
      // section. It is not part of the outline a reader navigates.
      const classes = node.properties?.className ?? [];
      if (Array.isArray(classes) && classes.includes("sr-only")) return;
      sink.push({
        depth: node.tagName === "h2" ? 2 : 3,
        id,
        text: hastToString(node).replace(/#$/, "").trim(),
      });
    });
  };
}

/**
 * Renders markdown body text to HTML, collecting a table of contents.
 *
 * @param {object} options
 * @param {string} options.file label used in error messages
 * @param {string} options.body markdown with frontmatter already stripped
 * @param {(src: string) => Promise<{ width: number, height: number }>} options.resolveImage
 */
export async function renderBody({ file, body, resolveImage }) {
  /** @type {Array<{ depth: number, id: string, text: string }>} */
  const toc = [];
  /** @type {Array<Promise<void>>} */
  const pending = [];
  /** @type {any[]} */
  const charts = [];
  /** @type {any[]} */
  const diagrams = [];
  /**
   * Media citations, collected as the renderer walks the body.
   * @type {Array<{ key: string, form: string, detail: string | null }>}
   */
  const mediaRefs = [];
  /**
   * Every URL the allowlist demoted, so a caller can report it.
   *
   * Collected rather than thrown, because a blocked link is a content problem
   * the AUTHOR has to see, not a build failure: throwing would make one bad
   * href in one post fail the whole site build, and the ruling asks for the
   * failure to be visible in preview instead.
   * @type {Array<{ file: string, tag: string, url: string }>}
   */
  const blockedUrls = [];
  /**
   * Whether this post carries any math, set from the AST by the validator.
   * @type {{ value: boolean }}
   */
  const math = { value: false };

  const highlighter = await getHighlighter();

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    // Before remarkDirective, and it does not matter which side it sits on:
    // `$` and `:::` are disjoint syntaxes and neither extension can consume the
    // other's opener. Placed with the other syntax extensions rather than with
    // the handlers so the reading order matches what micromark is doing.
    .use(remarkMath)
    .use(remarkDirective)
    // Runs before any directive is interpreted, so prose that only LOOKS like a
    // directive is text again before remarkFigure or remarkChart can see it.
    .use(remarkNumericTextDirectives, body)
    // Fails closed on anything the pipeline does not implement, before any
    // handler runs, so a typo is a named build error rather than a silent div.
    .use(remarkUnknownDirectives, file)
    // Same footing, for the same reason: a malformed expression is a named
    // build error here rather than a red error box rendered onto the page.
    .use(remarkMathValidate, file, math)
    // Before remarkFigure, so a `:::figure` is still a directive and its form
    // can be told apart from an ordinary markdown image.
    .use(remarkCollectMedia, mediaRefs)
    .use(remarkFigure, file)
    .use(remarkDetails, file)
    // No ordering constraint of its own: `swatch` is an INLINE directive and
    // shares no syntax with the three block ones, so nothing upstream can
    // consume its opener and it consumes nobody else's. Placed here so the
    // handlers read in the order KNOWN_DIRECTIVES lists them.
    .use(remarkPullQuote, file)
    /* No ordering constraint: `sidenote` shares no syntax with the others and consumes nothing
       they open. Placed in the order KNOWN_DIRECTIVES lists it, like the rest. */
    .use(remarkSidenote, file)
    .use(remarkSwatch, file)
    .use(remarkChart, file, charts)
    .use(remarkDiagram, file, diagrams)
    .use(remarkRehype)
    /* Before anything that reads table structure, and after remark-rehype has made the tables. */
    .use(rehypeTableScroll)
    .use(rehypeChart, charts)
    .use(rehypeDiagram, diagrams)
    .use(rehypeSlug)
    .use(rehypeCollectToc, toc)
    .use(rehypeAutolinkHeadings, {
      // aria-hidden must carry the literal string. As a boolean it stringifies
      // to a bare attribute, which is not valid ARIA and is read as unset.
      /*
       * REACHABLE, DELIBERATELY, and this reverses the previous markup.
       *
       * It emitted `aria-hidden="true"` and `tabIndex: -1`, which removes the
       * link from the tab order AND from the accessibility tree, while app.css
       * carried a `.heading-anchor:focus-visible` rule and a comment saying the
       * anchors "stay reachable by keyboard". Both cannot be true: the CSS rule
       * could never fire, because nothing could ever focus the element.
       *
       * Resolved toward REACHABLE rather than toward honestly-decorative,
       * because the affordance exists to be used and hiding it from keyboard and
       * from assistive tech left it working for pointer users only, which is the
       * smallest audience a "link to this section" control could have. That is
       * the tier 3.5 class, a control that looks live and does nothing, reached
       * from the other direction.
       *
       * THE COST IS STATED: this adds one tab stop per h2, h3 and h4 in an
       * article. If that is judged too noisy the alternative is the opposite
       * repair, keep the attributes and delete the CSS rule and its comment, and
       * this decision is the reversible half.
       *
       * The name is on the link because "#" is not one.
       */
      properties: { className: ["heading-anchor"], "aria-label": "Link to this section" },
      behavior: "append",
      content: { type: "text", value: "#" },
    })
    /*
     * AFTER rehypeSlug, rehypeCollectToc AND the heading autolinks, and the
     * order is the whole decision rather than a placement.
     *
     * All three of those read a heading's TEXT. Until this plugin runs, an
     * expression in a heading is still its TeX source sitting in a span, so
     * `## Solving $x^2 + 1 = 0$` gives the id `solving-x2--1--0` and a table of
     * contents entry a person can read. Run KaTeX first and the same three read
     * the RENDERED tree instead, whose text is the MathML annotation and the
     * HTML layout layer CONCATENATED: the id and the toc entry both become the
     * expression twice over, and neither is recoverable afterwards.
     *
     * Nothing downstream cares. Shiki matches `pre code`, and rehypeUrlProtocols
     * matches `a` and `img`; KaTeX emits none of those, only spans, an `svg`
     * for stretched delimiters, and one `math` element per expression.
     */
    .use(rehypeKatex, KATEX_OPTIONS)
    .use(rehypeImageSources, file, resolveImage, pending)
    .use(rehypeShikiFromHighlighter, highlighter, {
      themes: {
        light: "github-light-high-contrast",
        dark: "github-dark-high-contrast",
      },
      // Emits both palettes as CSS variables per token, so a code block follows
      // the page theme with no client script.
      defaultColor: false,
      // An unlisted language renders as plain text rather than throwing.
      fallbackLanguage: "text",
      transformers: [
        // Line highlighting from fence meta, as in ```ts {2,5-7}. Done here so
        // the marked lines are in the stored HTML rather than applied by client
        // script: a reader with JavaScript off still sees which lines matter.
        transformerMetaHighlight(),
        {
          // The language label and the copy button are rendered by the
          // enhancement script from this attribute, so the label is data the
          // pipeline already knows rather than something guessed in the browser.
          name: "language-label",
          pre(node) {
            node.properties["data-lang"] = this.options.lang ?? "text";
          },
        },
      ],
    })
    // LAST, on purpose. Every href and src the pipeline can emit has been
    // written by now: markdown links and images, the figure directive, diagram
    // assets, heading autolinks and footnote references. A guard placed
    // earlier would only cover the sources that existed when it was written.
    .use(rehypeUrlProtocols, file, blockedUrls)
    .use(rehypeStringify);

  const tree = processor.parse(body);
  const transformed = await processor.run(tree);
  await Promise.all(pending);

  return {
    html: processor.stringify(transformed),
    toc,
    /*
     * From the AST, not from the html. It is the same fact `htmlHasMath` reads
     * off the rendered output, derived independently, and `check:content` makes
     * the two argue over the whole corpus. Not a durable field on the record:
     * the route reads the html-side function, so nothing here has to be stored,
     * migrated or synced. See `htmlHasMath`.
     */
    hasMath: math.value,
    // The keys and sources every diagram in this post resolved to. `build:diagrams`
    // reads them off the artifact rather than parsing markdown a second time, on
    // the same principle as `withRelated` and `records.mjs`: anything two callers
    // need is computed once, by the module both of them already import.
    diagrams: diagrams.map((/** @type {any} */ d) => ({ key: d.key, source: d.source })),
    // Every media citation this render emitted. Rides in the record for the
    // same reason `diagrams` and `records` do: both writers produce it from one
    // module, so the editor and the build cannot disagree, and the determinism
    // pass covers it like everything else.
    mediaRefs,
    // Deliberately NOT part of the record's durable fields. It is a fact
    // about one render, not about the post, and folding it into what the
    // hashes cover would make a blocked URL churn them. The preview reads it to
    // tell the author; the build script reads it to warn.
    blockedUrls,
  };
}

/**
 * Validates frontmatter and renders one post into the row shape D1 stores.
 *
 * @param {object} options
 * @param {string} options.file path or label, used in error messages
 * @param {string} options.raw the whole file including frontmatter
 * @param {string} options.expectedSlug slug the filename implies
 * @param {(src: string) => Promise<{ width: number, height: number }>} options.resolveImage
 */
export async function renderPost({ file, raw, expectedSlug, resolveImage }) {
  const parsed = matter(raw);
  const result = frontmatterSchema.safeParse(parsed.data);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
      .join("; ");
    throw new ContentError(file, `invalid frontmatter: ${detail}`);
  }
  const fm = result.data;

  if (fm.slug !== expectedSlug) {
    throw new ContentError(
      file,
      `slug "${fm.slug}" does not match the filename "${expectedSlug}"`,
    );
  }

  const { html, toc, diagrams, mediaRefs, hasMath } = await renderBody({
    file,
    body: parsed.content,
    resolveImage,
  });

  let cover = null;
  if (fm.cover) {
    const { width, height } = await resolveImage(fm.cover.src);
    cover = { src: fm.cover.src, alt: fm.cover.alt, width, height };
    // The cover is a citation the BODY renderer can never see, because it comes
    // from frontmatter and is emitted by the page template rather than by the
    // markdown. Added here so a cover image is not reported as unused, which is
    // the label that would invite deleting it.
    const coverKey = mediaKeyOf(fm.cover.src);
    if (coverKey) {
      mediaRefs.push({ key: coverKey, form: "frontmatter-cover", detail: "cover image" });
    }
  }

  return {
    slug: fm.slug,
    title: fm.title,
    description: fm.description,
    date: fm.date,
    // Explicit publish_at wins; otherwise the post goes live at the start of its
    // date, which is what a reader means by a publication date.
    publishAt: fm.publish_at ?? `${fm.date}T00:00:00.000Z`,
    draft: fm.draft,
    tags: fm.tags,
    cover,
    featured: fm.featured,
    series: fm.series ?? null,
    part: fm.part ?? null,
    writingStatus: fm.writing_status ?? null,
    assumedAudience: fm.assumed_audience ?? null,
    keyTakeaways: fm.key_takeaways ?? null,
    changelog: fm.changelog ?? null,
    furtherReading: fm.further_reading,
    ogTitle: fm.og_title ?? null,
    ogDescription: fm.og_description ?? null,
    updated: fm.updated ?? null,
    readingTimeMinutes: readingTimeMinutes(parsed.content),
    /*
     * RIDES ON THE RECORD, IS NEVER STORED, and both halves are the point.
     *
     * No writer maps it to a column and none should: the route answers this
     * question with `htmlHasMath` off the row it already has, which is why
     * there is no migration here. What it rides for is `check:content`, which
     * compares this AST-derived value against that html-derived one for every
     * post in the corpus. Two derivations that can disagree are worth more than
     * one that is trusted, and this is the cheap half of the pair.
     */
    hasMath,
    toc,
    diagrams,
    mediaRefs,
    markdown: parsed.content,
    html,
    sourcePath: postPath(fm.slug),
    /*
     * The two provenance hashes, computed HERE so both writers carry them by
     * construction rather than by each remembering to. `sourceBlobSha` is over
     * `raw`, the whole file including frontmatter, because that is the blob
     * git stores; content-addressing is what makes it equal the sha GitHub
     * reports for the committed file with no API call. `renderHash` is over
     * the html this very call produced, which is what makes a mismatch
     * against a fresh Node build MEAN Worker-versus-Node render drift.
     */
    sourceBlobSha: await gitBlobSha(raw),
    renderHash: await renderHash(html),
  };
}
