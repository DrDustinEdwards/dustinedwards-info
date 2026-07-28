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
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";

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

/** Built once per isolate. Creating it is the expensive part, not using it. */
function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = buildHighlighter();
  }
  return highlighterPromise;
}

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
      themes: { light: "github-light", dark: "github-dark" },
      // Emits both palettes as CSS variables per token, so a code block follows
      // the page theme with no client script.
      defaultColor: false,
      // An unlisted language renders as plain text rather than throwing.
      fallbackLanguage: "text",
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
    readingTimeMinutes: readingTimeMinutes(parsed.content),
    toc,
    markdown: parsed.content,
    html,
    sourcePath: `content/posts/${fm.slug}.md`,
  };
}
