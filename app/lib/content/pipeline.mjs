// The only markdown renderer, shared by the build and the Worker: if they could disagree, check:content
// would fail on content nobody edited. Runs in a Worker, so no node:fs. The pipeline is Prelum's
// (@drdustinedwards/site-helpers/render); this module holds what stays with the site: the frontmatter,
// the media rules and the post record.

import { ContentError, render } from "@drdustinedwards/site-helpers/render";
import { createHighlight } from "@drdustinedwards/site-helpers/render/highlight";
import { editorialPack } from "@drdustinedwards/site-helpers/render/packs";
import { isAllowedUrl } from "@drdustinedwards/site-helpers/render/url";
import matter from "gray-matter";
import { z } from "zod";

import { ASSET_PREFIX, classify } from "../media/classify.mjs";
import { gitBlobSha, renderHash } from "./hashes.mjs";
import { CONTENT_SIZES, contentSrcSet } from "../media/widths.mjs";
import { SLUG_MAX_LENGTH, SLUG_PATTERN, postPath } from "./slug.mjs";

import { readingTimeMinutes } from "./reading-time.mjs";
import { withBacklinks, withRelated } from "./corpus.mjs";
import { internalLinkSlug, isFurtherReadingUrl } from "./url-policy.mjs";

export { LANGUAGES, SHIKI_THEMES } from "@drdustinedwards/site-helpers/render/highlight";

// Re-exported: build scripts, gates and tests import these from here, the renderer's one door.
export { ContentError, internalLinkSlug, isAllowedUrl, withBacklinks, withRelated };

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
         * accepts javascript:, and rehypeUrlProtocols never sees frontmatter. Internal links are /writing/ paths, not absolute URLs, so they survive the origin change at cutover.
         */
        url: z
          .string()
          .refine(isFurtherReadingUrl, "must be an absolute http(s) URL or a /writing/ path")
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

export { findWideDashes } from "./wide-dash.mjs";

export { readingTimeMinutes };

// Isolate-wide: one highlighter, the same for every request.
/** @type {ReturnType<typeof createHighlight> | null} */
let highlight = null;

/**
 * Injected: a Worker refuses WebAssembly.instantiate() on bytes, so it passes an instantiator over a
 * statically imported module. The engine is the same, so the HTML is byte-identical.
 *
 * @type {() => any}
 */
let wasmLoader = () => import("shiki/wasm");

/** @param {() => any} loader */
export function setWasmLoader(loader) {
  wasmLoader = loader;
  highlight = null;
}

// Awaited here, before shiki sees it: shiki keeps its first wasm load for the isolate, a rejected one
// included, so one failed load would otherwise fail every later render.
async function getHighlight() {
  if (!highlight) {
    const wasm = await wasmLoader();
    highlight ??= createHighlight({ wasm: () => wasm });
  }
  return highlight;
}

// The card key lives beside the card text it hashes, so a route can name a card without this renderer.
export { ogImageKey } from "./og-card-text.mjs";

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
 * Only /media/ keys are responsive: static assets never pass through the transform route, so their
 * widths would 404. The link goes to the unsized original, which srcset never serves.
 *
 * @param {string} src
 */
function imageProps(src) {
  if (!src.startsWith("/media/")) return null;
  const key = src.slice("/media/".length);
  return { srcSet: contentSrcSet(key), sizes: CONTENT_SIZES, href: `/media/${key}` };
}

const SITE_OPTIONS = {
  media: { keyOf: mediaKeyOf, imageProps },
  packs: [editorialPack({ assetPrefix: ASSET_PREFIX })],
};

/**
 * @param {object} options
 * @param {string} options.file label used in error messages
 * @param {string} options.body markdown with frontmatter already stripped
 * @param {(src: string) => Promise<{ width: number, height: number }>} options.resolveImage
 */
export async function renderBody({ file, body, resolveImage }) {
  const { html, toc, hasMath, diagrams, mediaRefs, blockedUrls } = await render({
    file,
    body,
    resolveImage,
    options: { ...SITE_OPTIONS, highlight: await getHighlight() },
  });
  return { html, toc, hasMath, diagrams, mediaRefs, blockedUrls };
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
