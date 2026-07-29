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
import { transformerMetaHighlight } from "@shikijs/transformers";
import matter from "gray-matter";
import { toString as hastToString } from "hast-util-to-string";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { z } from "zod";

import bash from "shiki/langs/bash.mjs";
import css from "shiki/langs/css.mjs";
import html from "shiki/langs/html.mjs";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import markdown from "shiki/langs/markdown.mjs";
import sql from "shiki/langs/sql.mjs";
import tsx from "shiki/langs/tsx.mjs";
import typescript from "shiki/langs/typescript.mjs";
import githubDarkHighContrast from "shiki/themes/github-dark-high-contrast.mjs";
import githubLightHighContrast from "shiki/themes/github-light-high-contrast.mjs";

/** Languages that get highlighted. Anything else renders as plain text. */
export const LANGUAGES = [
  "bash",
  "css",
  "html",
  "javascript",
  "json",
  "markdown",
  "sql",
  "tsx",
  "typescript",
];

const WORDS_PER_MINUTE = 200;

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
export const frontmatterSchema = z.object({
  title: z.string().min(1, "must not be empty"),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lowercase kebab-case"),
  date: isoDate,
  tags: z.array(z.string().min(1)).default([]),
  description: z.string().min(1, "must not be empty"),
  draft: z.boolean().default(false),
  publish_at: isoDateTime.optional(),
  cover: z
    .object({
      src: z.string().startsWith("/", "must be a site-absolute path"),
      alt: z.string().min(1, "is required when cover is set"),
    })
    .optional(),
  /** Marks a post for the featured slot on the index. */
  featured: z.boolean().default(false),
  /** Multi-part writing. Both fields travel together or neither does. */
  series: z.string().min(1).optional(),
  part: z.number().int().min(1, "must be 1 or greater").optional(),
  /** Curated outbound links, rendered at the end of the post. */
  further_reading: z
    .array(
      z.object({
        title: z.string().min(1, "must not be empty"),
        url: z.string().url("must be an absolute URL"),
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
 * @param {string} markdownText
 */
export function readingTimeMinutes(markdownText) {
  const words = markdownText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

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
 */
const OG_TEMPLATE_VERSION = 2;

/**
 * The R2 key for a post's generated social image.
 *
 * Deterministic from the content that appears on the card, so the key changes
 * exactly when the card would look different and never otherwise. That is what
 * makes generation idempotent and lets the object be served immutable.
 *
 * FNV-1a rather than a crypto hash: pure JS, identical in Node and in a Worker,
 * no imports, and this is a cache-busting key rather than a security boundary.
 *
 * Only the KEY is deterministic. The PNG bytes are not, and are deliberately
 * kept out of the gated artifact: font rasterisation is exactly the kind of
 * thing that varies between runs, and the shiki engine incident showed what a
 * byte-comparison gate does with a non-deterministic input.
 *
 * The TEMPLATE is an input too, via OG_TEMPLATE_VERSION below.
 *
 * @param {{ slug: string, title: string, description: string }} post
 */

export function ogImageKey(post) {
  const input = `${OG_TEMPLATE_VERSION}\n${post.slug}\n${post.title}\n${post.description}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `og/${post.slug}-${hash.toString(16).padStart(8, "0")}.png`;
}

/** How many related posts each post carries. */
const RELATED_LIMIT = 3;

/**
 * Fills in each post's `related` list from tag overlap, across the whole corpus.
 *
 * Must run over ALL posts, in both callers, for the same reason the renderer is
 * shared: relatedness is a property of the set, not of one post. Adding a post
 * changes the related list of every post it shares a tag with, so an editor save
 * that spliced one entry and left the rest would make the committed artifact
 * disagree with the next build. The editor therefore calls this after splicing,
 * over the complete list.
 *
 * Ordering is fully determined: shared tags descending, then newest, then slug.
 * No ties are left to array order, because array order is not stable input.
 *
 * @param {any[]} posts
 */
export function withRelated(posts) {
  return posts.map((post) => {
    const tags = new Set(post.tags);
    const scored = posts
      .filter((other) => other.slug !== post.slug && !other.draft)
      .map((other) => ({
        slug: other.slug,
        title: other.title,
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
        .map(({ slug, title, shared }) => ({ slug, title, shared })),
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
 * --surface-code, with the highlighted-line band on --surface-popover. That
 * voided the previous verification, and re-running it condemned the plain
 * github themes: against the warm surfaces, github-light failed four token
 * colours (comments 4.06, strings 3.90, keywords 3.86, constants 2.94) and
 * github-dark failed comments at 3.34. The high-contrast variants clear every
 * one, so the fix is a theme swap rather than hand-mixed hexes.
 *
 * Comments are the single exception, still 4.25 in light after the swap, so
 * they are repointed at the ratified MUTED TEXT colour. That is not a new hex:
 * it is --text-muted from design-tokens.md, which is what a comment is, and it
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
    langs: [typescript, tsx, javascript, json, bash, sql, html, css, markdown],
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
 * Turns `:::figure{src= alt= credit=}` into real figure markup.
 * @param {string} file
 */
function remarkFigure(file) {
  return (/** @type {any} */ tree) => {
    visit(tree, (/** @type {any} */ node) => {
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
 * Writes intrinsic width and height onto every img, plus lazy-loading hints.
 *
 * @param {string} file
 * @param {(src: string) => Promise<{ width: number, height: number }>} resolveImage
 * @param {Array<Promise<void>>} pending
 */
function rehypeImageDimensions(file, resolveImage, pending) {
  return (/** @type {any} */ tree) => {
    visit(tree, "element", (/** @type {any} */ node) => {
      if (node.tagName !== "img") return;
      const src = String(node.properties?.src ?? "");
      pending.push(
        resolveImage(src).then(({ width, height }) => {
          node.properties = {
            ...node.properties,
            width,
            height,
            loading: "lazy",
            decoding: "async",
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
  return (/** @type {any} */ tree) => {
    visit(tree, "element", (/** @type {any} */ node) => {
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

  const highlighter = await getHighlighter();

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkFigure, file)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeCollectToc, toc)
    .use(rehypeAutolinkHeadings, {
      // aria-hidden must carry the literal string. As a boolean it stringifies
      // to a bare attribute, which is not valid ARIA and is read as unset.
      properties: { className: ["heading-anchor"], ariaHidden: "true", tabIndex: -1 },
      behavior: "append",
      content: { type: "text", value: "#" },
    })
    .use(rehypeImageDimensions, file, resolveImage, pending)
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
    .use(rehypeStringify);

  const tree = processor.parse(body);
  const transformed = await processor.run(tree);
  await Promise.all(pending);

  return { html: processor.stringify(transformed), toc };
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

  const { html, toc } = await renderBody({
    file,
    body: parsed.content,
    resolveImage,
  });

  let cover = null;
  if (fm.cover) {
    const { width, height } = await resolveImage(fm.cover.src);
    cover = { src: fm.cover.src, alt: fm.cover.alt, width, height };
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
    furtherReading: fm.further_reading,
    ogTitle: fm.og_title ?? null,
    ogDescription: fm.og_description ?? null,
    updated: fm.updated ?? null,
    readingTimeMinutes: readingTimeMinutes(parsed.content),
    toc,
    markdown: parsed.content,
    html,
    sourcePath: `content/posts/${fm.slug}.md`,
  };
}
