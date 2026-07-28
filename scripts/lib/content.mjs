/**
 * Markdown to HTML core for content/posts.
 *
 * Deliberately framework-agnostic: nothing here imports React Router, the app,
 * or any Cloudflare binding. It takes file bytes in and returns plain data, so
 * it survives a later change of rendering layer.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { imageSize } from "image-size";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import rehypeShiki from "@shikijs/rehype";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { toString as hastToString } from "hast-util-to-string";
import { z } from "zod";

/** Where referenced images are resolved from. Site-absolute paths only. */
const PUBLIC_DIR = "public";

/** Words per minute used for the reading estimate. */
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
// Normalizing means a post does not have to quote its own date to be valid.
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
 * Frontmatter contract. A failure here is a build failure that names the file
 * and the offending field, per the content-model ruling.
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
      // Required whenever a cover is present. A decorative cover is not an
      // option here: it carries meaning in the card and the social preview.
      alt: z.string().min(1, "is required when cover is set"),
    })
    .optional(),
});

/** @typedef {z.infer<typeof frontmatterSchema>} Frontmatter */

/**
 * Probes an image's intrinsic size so every img tag can carry width and height.
 * A missing or unreadable file is a build failure, never a silently absent
 * attribute, because the whole point is preventing layout shift.
 *
 * @param {string} file source markdown path, for the error message
 * @param {string} src site-absolute path such as /media/foo.webp
 * @returns {Promise<{ width: number, height: number }>}
 */
async function probeImage(file, src) {
  if (!src.startsWith("/")) {
    throw new ContentError(file, `image src "${src}" must be site-absolute`);
  }
  const onDisk = path.join(PUBLIC_DIR, src.slice(1));
  /** @type {Buffer} */
  let bytes;
  try {
    bytes = await readFile(onDisk);
  } catch {
    throw new ContentError(file, `image "${src}" not found at ${onDisk}`);
  }
  const size = imageSize(bytes);
  if (!size.width || !size.height) {
    throw new ContentError(file, `image "${src}" has no readable dimensions`);
  }
  return { width: size.width, height: size.height };
}

/**
 * Turns `:::figure{src=... alt=... credit=...}` into real figure markup.
 *
 * Runs on the mdast side so the caption body keeps its inline markdown. The
 * image itself is left as a plain element for the dimension pass to fill in.
 *
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
        // WCAG 2.2 AA. A figcaption is not a substitute for alt text: it is
        // announced separately and describes, rather than replaces, the image.
        throw new ContentError(file, `:::figure ${attrs.src} requires an alt attribute`);
      }

      /** @type {any[]} */
      const captionChildren = [];
      for (const child of node.children ?? []) {
        captionChildren.push(child);
      }

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
 * Writes intrinsic width and height onto every img, plus the lazy-loading
 * attributes. Runs on hast so it catches both markdown images and figures.
 *
 * @param {string} file
 * @param {Array<Promise<void>>} pending collects the async probes
 */
function rehypeImageDimensions(file, pending) {
  return (/** @type {any} */ tree) => {
    visit(tree, "element", (/** @type {any} */ node) => {
      if (node.tagName !== "img") return;
      const src = String(node.properties?.src ?? "");
      pending.push(
        probeImage(file, src).then(({ width, height }) => {
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
 * Collects h2 and h3 headings into a table of contents. Runs after rehype-slug,
 * so the ids it records are the ones actually rendered.
 *
 * @param {Array<{ depth: number, id: string, text: string }>} sink
 */
function rehypeCollectToc(sink) {
  return (/** @type {any} */ tree) => {
    visit(tree, "element", (/** @type {any} */ node) => {
      if (node.tagName !== "h2" && node.tagName !== "h3") return;
      const id = String(node.properties?.id ?? "");
      if (!id) return;
      // remark-gfm emits a visually hidden "Footnotes" heading to label its
      // section. It is not part of the outline a reader navigates, so it stays
      // out of the table of contents.
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
 * Estimated reading time in whole minutes, never less than one.
 *
 * @param {string} markdown
 */
export function readingTimeMinutes(markdown) {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/**
 * Renders one markdown file into the row shape the database stores.
 *
 * @param {string} file path relative to the repo root
 * @param {string} raw file contents
 */
export async function renderPost(file, raw) {
  const parsed = matter(raw);
  const result = frontmatterSchema.safeParse(parsed.data);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
      .join("; ");
    throw new ContentError(file, `invalid frontmatter: ${detail}`);
  }
  const fm = result.data;

  const expectedSlug = path.basename(file, ".md");
  if (fm.slug !== expectedSlug) {
    throw new ContentError(
      file,
      `slug "${fm.slug}" does not match the filename "${expectedSlug}"`,
    );
  }

  /** @type {Array<{ depth: number, id: string, text: string }>} */
  const toc = [];
  /** @type {Array<Promise<void>>} */
  const pending = [];

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkFigure, file)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeCollectToc, toc)
    .use(rehypeAutolinkHeadings, {
      behavior: "append",
      // aria-hidden must carry the literal string. As a boolean it stringifies
      // to a bare attribute, which is not valid ARIA and is read as unset.
      properties: { className: ["heading-anchor"], ariaHidden: "true", tabIndex: -1 },
      content: { type: "text", value: "#" },
    })
    .use(rehypeImageDimensions, file, pending)
    .use(rehypeShiki, {
      themes: { light: "github-light", dark: "github-dark" },
      // Emits both palettes as CSS variables on each span. The stylesheet picks
      // one, so a code block follows the page theme with no client script.
      defaultColor: false,
    })
    .use(rehypeStringify);

  const tree = processor.parse(parsed.content);
  const transformed = await processor.run(tree);
  // The dimension probes are queued during the transform and settle after it.
  await Promise.all(pending);
  const html = processor.stringify(transformed);

  let cover = null;
  if (fm.cover) {
    const { width, height } = await probeImage(file, fm.cover.src);
    cover = { src: fm.cover.src, alt: fm.cover.alt, width, height };
  }

  return {
    slug: fm.slug,
    title: fm.title,
    description: fm.description,
    date: fm.date,
    // Explicit publish_at wins; otherwise the post goes live at the start of
    // its date, which is what a reader means by a publication date.
    publishAt: fm.publish_at ?? `${fm.date}T00:00:00.000Z`,
    draft: fm.draft,
    tags: fm.tags,
    cover,
    readingTimeMinutes: readingTimeMinutes(parsed.content),
    toc,
    markdown: parsed.content,
    html,
    sourcePath: file.split(path.sep).join("/"),
  };
}

/** @typedef {Awaited<ReturnType<typeof renderPost>>} RenderedPost */
