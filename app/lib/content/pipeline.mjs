// The only markdown renderer, shared by the build and the Worker: if they could disagree, check:content
// would fail on content nobody edited. Runs in a Worker, so no node:fs. shiki/core with an explicit
// language list because the full bundle took the Worker output to 14 MB.

import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { longDateUTC } from "../long-date.mjs";
import { fnv1a32 } from "../bytes.mjs";
import { transformerMetaHighlight } from "@shikijs/transformers";
import matter from "gray-matter";
import { toString as hastToString } from "hast-util-to-string";
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
import { KATEX_OPTIONS } from "./math.mjs";
import { SLUG_MAX_LENGTH, SLUG_PATTERN, postPath } from "./slug.mjs";

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
import { errorMessage } from "../error-message.mjs";
import { ContentError } from "./content-error.mjs";
import { withBacklinks, withRelated } from "./corpus.mjs";
import {
  KNOWN_DIRECTIVES,
  rehypeChart,
  rehypeDiagram,
  remarkChart,
  remarkDetails,
  remarkDiagram,
  remarkFigure,
  remarkNumericTextDirectives,
  remarkPullQuote,
  remarkSidenote,
  remarkSwatch,
  remarkUnknownDirectives,
} from "./directives.mjs";
import { internalLinkSlug, isAllowedUrl, isFurtherReadingUrl } from "./url-policy.mjs";

// Re-exported: build scripts, gates and tests import these from here, the renderer's one door.
export { ContentError, KNOWN_DIRECTIVES, internalLinkSlug, isAllowedUrl, withBacklinks, withRelated };

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

export const LANGUAGES = Object.keys(GRAMMARS);

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

export { SLUG_ATTRIBUTE_PATTERN, SLUG_PATTERN, postPath } from "./slug.mjs";

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
       * The regex refuses protocol-relative paths; isAllowedUrl is the shared protocol check and
       * must be called, not reimplemented. Both are needed.
       */
      src: z
        .string()
        .regex(/^\/(?![/\\])/, "must be a site-absolute path, not //host or a full URL")
        .refine(isAllowedUrl, "protocol is not allowed (https, http, mailto or relative only)"),
      alt: z.string().min(1, "is required when cover is set"),
    })
    .optional(),
  featured: z.boolean().default(false),
  series: z.string().min(1).optional(),
  part: z.number().int().min(1, "must be 1 or greater").optional(),
  // Not `status`, which is the row's draft/published column. A closed set so readers learn it once.
  writing_status: z.enum(["notes", "draft", "in progress", "finished", "obsolete"]).optional(),
  assumed_audience: z.string().min(1).max(200).optional(),
  key_takeaways: z.array(z.string().min(1).max(300)).min(2).max(4).optional(),
  // isoDate because YAML parses a bare 2026-08-15 into a Date object.
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
  further_reading: z
    .array(
      z.object({
        title: z.string().min(1, "must not be empty"),
        /**
         * isAllowedUrl is the SAME predicate the render layer uses (check:urls reads this phrase): z.url()
         * accepts javascript:, and rehypeUrlProtocols never sees frontmatter. Internal links are /blog/ paths, not absolute URLs, so they survive the origin change at cutover.
         */
        url: z
          .string()
          .refine(isFurtherReadingUrl, "must be an absolute http(s) URL or a /blog/ path")
          .refine(isAllowedUrl, "protocol is not allowed (https, http, mailto or relative only)"),
      }),
    )
    .default([]),
  og_title: z.string().min(1).optional(),
  og_description: z.string().min(1).optional(),
  /**
   * A date, not a timestamp: the build derives it from git and the editor cannot know the time of
   * the commit it is about to create, so only a date lets the two agree.
   */
  updated: isoDate.optional(),
  // Server-owned, stamped on first publish. renderPost deliberately keeps it out of the record.
  first_published: isoDate.optional(),
}).superRefine((value, ctx) => {
  if (value.series && value.part === undefined) {
    ctx.addIssue({ code: "custom", path: ["part"], message: "is required when series is set" });
  }
  if (value.part !== undefined && !value.series) {
    ctx.addIssue({ code: "custom", path: ["series"], message: "is required when part is set" });
  }
});

// Escapes, so this file stays clean under the no-em-dash rule. U+2010 to U+2015 plus U+2212.
const WIDE_DASH = /[\u2010-\u2015\u2212]/g;

/**
 * Server-side half of the no-em-dash rule: a commit through the GitHub API never meets the local hook.
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

export { readingTimeMinutes };

/** @type {any} */
let highlighterPromise = null;

/**
 * Injected: a Worker refuses WebAssembly.instantiate() on bytes, so it passes an instantiator over a
 * statically imported module. The engine is the same, so the HTML is byte-identical.
 *
 * @type {any}
 */
let wasmLoader = () => import("shiki/wasm");

/** @param {any} loader */
export function setWasmLoader(loader) {
  wasmLoader = loader;
  highlighterPromise = null;
}

// Bump on any card template change: the key hashes only the card's inputs, and an immutable cache
// ignores a restyled PNG under an unchanged key forever.
const OG_TEMPLATE_VERSION = 4;

/**
 * Hashes exactly what the card draws, AS DRAWN (through cardTitle, cardDescription, longDateUTC), so
 * the key changes when the picture would and never otherwise. FNV-1a: identical in Node and a Worker,
 * and this is a cache-busting key, not a security boundary.
 *
 * @param {{
 *   slug: string,
 *   title: string,
 *   description?: string | null,
 *   publishAt?: string | null,
 * }} post
 */

export function ogImageKey(post) {
  const drawnDate = longDateUTC(post.publishAt);
  const input =
    `${OG_TEMPLATE_VERSION}\n${post.slug}\n${cardTitle(post.title)}\n` +
    `${cardDescription(post.description)}\n${drawnDate === null ? "" : drawnDate}`;
  return `og/${ASSET_PREFIX}${post.slug}-${fnv1a32(input)}.png`;
}

// A rejection is not cached: one failed wasm load would otherwise fail every render in the isolate.
// The caller still sees this render's failure; the next render tries again.
function getHighlighter() {
  if (!highlighterPromise) {
    const building = buildHighlighter();
    highlighterPromise = building;
    building.catch(() => {
      if (highlighterPromise === building) highlighterPromise = null;
    });
  }
  return highlighterPromise;
}

// High-contrast themes because the plain github ones failed contrast on --paper; comments are
// repointed at --text-secondary. Gated by check:contrast.
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

// Exported so check:contrast verifies the themes actually used, not ones it imported by name.
export const SHIKI_THEMES = { light: githubLight, dark: githubDark };

async function buildHighlighter() {
  return createHighlighterCore({
    themes: [githubLight, githubDark],
    langs: Object.values(GRAMMARS),
      // Oniguruma, not the JS regex engine: the JS engine was measured non-deterministic, which makes
      // check:content's byte comparison fail at random on any post with code.
    engine: await createOnigurumaEngine(await wasmLoader()),
  });
}

/**
 * R2 objects are keyed after /media/, static assets by their public path. An unrecognized extension
 * returns null: a page link is not a media citation and would never join.
 *
 * @param {string} raw
 * @returns {string | null}
 */
function mediaKeyOf(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;

  let path = raw;
  const origin = path.match(/^(?:[a-z][a-z0-9+.-]*:)?\/\/[^/]+(\/.*)$/i);
  if (origin) path = origin[1] ?? path;
  // Query and fragment are not part of the key: ?w=320 is a transform request.
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
 * Runs at render time so every citation the renderer emits is indexed by construction. Must run BEFORE
 * remarkFigure, which erases the directive and would turn figure-directive into markdown-image.
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
        // A reference definition: the link that uses it carries no URL of its own.
        case "definition":
          add(node.url, "link", node);
          break;
        case "containerDirective":
          if (node.name === "figure") add(node.attributes?.src, "figure-directive", node);
          break;
        // Regex, not a parser, so every URL-carrying attribute is caught; over-detection only
        // refuses a delete.
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
 * The AST-side owner of hasMath; check:content compares it with htmlHasMath over the corpus.
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
        // The same KATEX_OPTIONS rehype-katex gets, so passing here proves its catch branch unreachable.
        katex.renderToString(expression, {
          ...KATEX_OPTIONS,
          displayMode: node.type === "math",
          throwOnError: true,
        });
      } catch (error) {
        const detail = errorMessage(error);
        // A line of the BODY: the tree is parsed without frontmatter, and the editor preview has no file.
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
 * A wrapper, not display: block on the table, which can strip the table role from a screen reader.
 * tabindex so keyboard users can scroll it; no role=region, because an unnamed region is noise.
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
 * Renders as the original markdown so a blocked link visibly fails, as a text node so it is escaped.
 * Runs LAST so it sees every href and src any plugin emits.
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
 * The anchor and srcset come from one mediaKey in one visitor so they cannot disagree about a storage
 * tier. The first image is eager with fetchpriority=high: it is usually the LCP. Only public/ images get
 * an LQIP, because the HTML is byte-compared and a /media/ placeholder exists only in R2.
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
      // A diagram's asset is rendered by a later build step and may not exist yet. Checked by class, not
      // plugin order, so moving this plugin cannot re-enable it.
      const classes = node.properties?.className ?? [];
      if (Array.isArray(classes) && classes.includes("diagram-image")) return;
      const src = String(node.properties?.src ?? "");

      // Only /media/ keys: static assets never pass through the transform route, so their widths would 404.
      const mediaKey = src.startsWith("/media/") ? src.slice("/media/".length) : null;
      const responsive = mediaKey
        ? { srcSet: contentSrcSet(mediaKey), sizes: CONTENT_SIZES }
        : {};

      /*
       * Links to the unsized original, which srcset never serves. Diagrams are excluded: an anchor around
       * the display: none half would be a focusable link with no name. An author's own link wins.
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

      // Counted after every exclusion, so the first image that gets attributes gets the eager pair.
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
            // fetchpriority=high is a budget: several images marked high is the same as none.
            ...(first ? { fetchpriority: "high" } : {}),
            // The inline style carries only the per-image URL, which CSP already allows
            // (style-src-attr 'unsafe-inline', img-src data:).
            ...(placeholder
              ? {
                  className: [
                    ...(Array.isArray(node.properties?.className) ? node.properties.className : []),
                    "has-lqip",
                  ],
                  // Cannot break out: base64 holds no quote, parenthesis or space.
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
   * @type {Array<{ key: string, form: string, detail: string | null }>}
   */
  const mediaRefs = [];
  /**
   * Collected, not thrown: one bad href must not fail the whole build; the preview shows it.
   * @type {Array<{ file: string, tag: string, url: string }>}
   */
  const blockedUrls = [];
  /**
   * @type {{ value: boolean }}
   */
  const math = { value: false };

  const highlighter = await getHighlighter();

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    // Before any directive is interpreted, so prose such as 12:30 is text again.
    .use(remarkNumericTextDirectives, body)
    .use(remarkUnknownDirectives, file)
    .use(remarkMathValidate, file, math)
    // Before remarkFigure, which erases the directive the media form is read from.
    .use(remarkCollectMedia, mediaRefs)
    .use(remarkFigure, file)
    .use(remarkDetails, file)
    .use(remarkPullQuote, file)
    .use(remarkSidenote, file)
    .use(remarkSwatch, file)
    .use(remarkChart, file, charts)
    .use(remarkDiagram, file, diagrams)
    .use(remarkRehype)
    .use(rehypeTableScroll)
    .use(rehypeChart, charts)
    .use(rehypeDiagram, diagrams)
    .use(rehypeSlug)
    .use(rehypeCollectToc, toc)
    .use(rehypeAutolinkHeadings, {
      /*
       * Keyboard-reachable on purpose; the aria-label is the name, because # is not one. It carries
       * the heading, so a links list is not a column of identical "Link to this section" entries.
       * Called before the # is appended, so the text is the heading's alone.
       */
      properties: (/** @type {any} */ heading) => ({
        className: ["heading-anchor"],
        "aria-label": `Link to section: ${hastToString(heading).trim()}`,
      }),
      behavior: "append",
      content: { type: "text", value: "#" },
    })
    /*
     * After rehypeSlug, rehypeCollectToc and the autolinks: they read heading text, and after KaTeX
     * that text is the expression twice over (MathML plus HTML), ruining ids and the toc.
     */
    .use(rehypeKatex, KATEX_OPTIONS)
    .use(rehypeImageSources, file, resolveImage, pending)
    .use(rehypeShikiFromHighlighter, highlighter, {
      themes: {
        light: "github-light-high-contrast",
        dark: "github-dark-high-contrast",
      },
      // Both palettes as CSS variables per token, so code follows the page theme with no script.
      defaultColor: false,
      fallbackLanguage: "text",
      transformers: [
        // Marked lines are in the stored HTML, so they show with JavaScript off.
        transformerMetaHighlight(),
        {
          name: "language-label",
          pre(node) {
            node.properties["data-lang"] = this.options.lang ?? "text";
          },
        },
      ],
    })
    // LAST, so it sees every href and src any plugin emits.
    .use(rehypeUrlProtocols, file, blockedUrls)
    .use(rehypeStringify);

  const tree = processor.parse(body);
  const transformed = await processor.run(tree);
  await Promise.all(pending);

  return {
    html: processor.stringify(transformed),
    toc,
    hasMath: math.value,
    diagrams: diagrams.map((/** @type {any} */ d) => ({ key: d.key, source: d.source })),
    mediaRefs,
    // Not a durable field: a fact about one render, and hashing it would churn on a blocked URL.
    blockedUrls,
  };
}

/**
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
    // The body renderer never sees a frontmatter cover; without this it would be listed as unused.
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
    // Never stored: it rides only so check:content can compare it with htmlHasMath.
    hasMath,
    toc,
    diagrams,
    mediaRefs,
    markdown: parsed.content,
    html,
    sourcePath: postPath(fm.slug),
    // Over the whole raw file, frontmatter included, because that is the blob git stores.
    sourceBlobSha: await gitBlobSha(raw),
    renderHash: await renderHash(html),
  };
}
