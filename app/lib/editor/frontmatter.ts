import matter from "gray-matter";

import { readIntent } from "./intent.mjs";
import { draftForIntent } from "./publish-transition.mjs";
import { errorMessage } from "~/lib/error-message.mjs";

// Punctuation-bearing scalars are written as JSON strings: valid YAML double-quoted scalars that
// escape quotes and colons without a YAML serializer.

export type PostFields = {
  title: string;
  slug: string;
  description: string;
  date: string;
  tags: string[];
  draft: boolean;
  publishAt: string;
  coverSrc: string;
  coverAlt: string;
  body: string;
  /** Server-owned but carried: a dropped value would make a published post read as never published. */
  firstPublished: string;
  /** Carried through hidden inputs so a browser save cannot erase keys set by hand or by the API. */
  featured: boolean;
  series: string;
  part: string;
  furtherReading: string;
  ogTitle: string;
  ogDescription: string;
  updated: string;
};

export const EMPTY_FIELDS: PostFields = {
  title: "",
  slug: "",
  description: "",
  date: "",
  tags: [],
  draft: true,
  publishAt: "",
  coverSrc: "",
  coverAlt: "",
  body: "",
  firstPublished: "",
  featured: false,
  series: "",
  part: "",
  furtherReading: "",
  ogTitle: "",
  ogDescription: "",
  updated: "",
};

export function parseTags(input: string) {
  return input
    .split(/[,\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** Multipart posts turn every newline into CRLF, so save and preview must both normalize here. */
export function normalizeBody(body: string) {
  return body.replace(/\r\n/g, "\n").trim();
}

/**
 * Loose on purpose, since the schema judges the content. A half entry is dropped: it would fail
 * the save on data the author never typed. A value that is not a JSON array is refused, not read as
 * empty: written as empty, the save would erase the post's further reading.
 */
function parseFurtherReading(raw: string) {
  if (!raw.trim()) return [] as { title: string; url: string }[];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = errorMessage(error);
    throw new FrontmatterError(
      `The further reading list did not arrive as JSON (${detail}), so nothing was saved rather ` +
        `than saving the post without it.`,
      "furtherReading",
    );
  }
  if (!Array.isArray(parsed)) {
    throw new FrontmatterError(
      "The further reading list did not arrive as a list, so nothing was saved rather than saving " +
        "the post without it.",
      "furtherReading",
    );
  }
  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const title = (item as Record<string, unknown>).title;
    const url = (item as Record<string, unknown>).url;
    if (typeof title !== "string" || typeof url !== "string") return [];
    if (!title.trim() || !url.trim()) return [];
    return [{ title: title.trim(), url: url.trim() }];
  });
}

/** A field value that cannot be written into frontmatter without changing its structure. */
export class FrontmatterError extends Error {
  field: string;

  constructor(message: string, field: string) {
    super(message);
    this.name = "FrontmatterError";
    this.field = field;
  }
}

// What would end or reshape a plain YAML scalar: a newline, a leading indicator, `: ` or ` #`, or edge
// whitespace. These keys stay unquoted because quoting changes their type (a date, a number), so an
// unsafe value is refused by name rather than written.
const UNSAFE_PLAIN = /[\r\n]|^[\s\-?:,[\]{}#&*!|>'"%@`]|:\s|\s#|:$|\s$/;

function plain(field: keyof PostFields, key: string, value: string) {
  if (UNSAFE_PLAIN.test(value)) {
    throw new FrontmatterError(
      `The ${key} ${JSON.stringify(value)} cannot be written into the frontmatter as it is: it ` +
        `contains a newline or YAML punctuation that would change the file's structure.`,
      field,
    );
  }
  return value;
}

// A tag inside the flow sequence stays bare when it is plainly a word, so existing files keep their
// bytes; anything else (a comma, a bracket, a `#`, a quote) is written as a JSON string.
const BARE_TAG = /^[a-z0-9][a-z0-9._+-]*( [a-z0-9._+-]+)*$/;

function tagScalar(tag: string) {
  return BARE_TAG.test(tag) ? tag : JSON.stringify(tag);
}

export function serializePost(fields: PostFields) {
  const lines = [
    "---",
    `title: ${JSON.stringify(fields.title)}`,
    `slug: ${plain("slug", "slug", fields.slug)}`,
    `description: ${JSON.stringify(fields.description)}`,
    `date: ${plain("date", "date", fields.date)}`,
    `tags: [${fields.tags.map(tagScalar).join(", ")}]`,
    `draft: ${fields.draft ? "true" : "false"}`,
  ];

  if (fields.publishAt.trim()) {
    lines.push(`publish_at: ${JSON.stringify(fields.publishAt.trim())}`);
  }

  if (fields.firstPublished.trim()) {
    lines.push(
      `first_published: ${plain("firstPublished", "first_published", fields.firstPublished.trim())}`,
    );
  }

  if (fields.coverSrc.trim()) {
    lines.push("cover:");
    lines.push(`  src: ${plain("coverSrc", "cover src", fields.coverSrc.trim())}`);
    lines.push(`  alt: ${JSON.stringify(fields.coverAlt)}`);
  }

  // Carried keys are emitted only when set, so a post that never used one is byte-identical.
  if (fields.featured) lines.push("featured: true");
  if (fields.series.trim()) {
    lines.push(`series: ${JSON.stringify(fields.series.trim())}`);
  }
  // Unquoted: `part` is a number in the schema and a quoted scalar is a string.
  if (fields.part.trim()) lines.push(`part: ${plain("part", "part", fields.part.trim())}`);
  if (fields.ogTitle.trim()) {
    lines.push(`og_title: ${JSON.stringify(fields.ogTitle.trim())}`);
  }
  if (fields.ogDescription.trim()) {
    lines.push(`og_description: ${JSON.stringify(fields.ogDescription.trim())}`);
  }
  if (fields.updated.trim()) {
    lines.push(`updated: ${plain("updated", "updated", fields.updated.trim())}`);
  }

  const reading = parseFurtherReading(fields.furtherReading);
  if (reading.length > 0) {
    lines.push("further_reading:");
    for (const item of reading) {
      lines.push(`  - title: ${JSON.stringify(item.title)}`);
      lines.push(`    url: ${JSON.stringify(item.url)}`);
    }
  }

  lines.push("---", "");

  // One blank line after the frontmatter and one trailing newline, so repeated saves do not drift.
  return `${lines.join("\n")}\n${normalizeBody(fields.body)}\n`;
}

export function parsePost(raw: string): PostFields {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;

  const asString = (value: unknown) => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return value === undefined || value === null ? "" : String(value);
  };

  const cover = (data.cover ?? {}) as Record<string, unknown>;

  return {
    title: asString(data.title),
    slug: asString(data.slug),
    description: asString(data.description),
    date: asString(data.date),
    tags: Array.isArray(data.tags) ? data.tags.map((t) => String(t)) : [],
    draft: data.draft === true,
    publishAt: data.publish_at instanceof Date
      ? data.publish_at.toISOString()
      : asString(data.publish_at),
    coverSrc: asString(cover.src),
    coverAlt: asString(cover.alt),
    body: parsed.content.replace(/^\n+/, ""),
    firstPublished: asString(data.first_published),
    featured: data.featured === true,
    series: asString(data.series),
    part: asString(data.part),
    // JSON, because a FormData value is a string.
    furtherReading: Array.isArray(data.further_reading)
      ? JSON.stringify(data.further_reading)
      : "",
    ogTitle: asString(data.og_title),
    ogDescription: asString(data.og_description),
    updated: asString(data.updated),
  };
}

export const FR_CONTROL = "frControl";
export const FR_TITLE = "frTitle";
export const FR_URL = "frUrl";
export const FR_INTERNAL = "frInternal";

/** Mirrors the schema's rule for internal links. */
const INTERNAL_PREFIX = "/blog/";

type ReadingItem = { title: string; url: string };

function parseReadingJson(raw: string): ReadingItem[] {
  if (!raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const { title, url } = item as Record<string, unknown>;
      if (typeof title !== "string" || typeof url !== "string") return [];
      return [{ title, url }];
    });
  } catch {
    return [];
  }
}

export function splitReading(raw: string) {
  const items = parseReadingJson(raw);
  return {
    external: items.filter((item) => !item.url.startsWith(INTERNAL_PREFIX)),
    internal: items.filter((item) => item.url.startsWith(INTERNAL_PREFIX)),
  };
}

/**
 * The hidden marker separates "the author removed every row" from "the control never rendered",
 * which both arrive as no fields. A half row is kept so the schema refuses it by name.
 */
function furtherReadingFromForm(form: FormData, carried: string): string {
  if (form.get(FR_CONTROL) === null) return carried;

  const titles = form.getAll(FR_TITLE).map((v) => String(v));
  const urls = form.getAll(FR_URL).map((v) => String(v));
  const items: ReadingItem[] = [];

  for (let i = 0; i < Math.max(titles.length, urls.length); i += 1) {
    const title = (titles[i] ?? "").trim();
    const url = (urls[i] ?? "").trim();
    if (!title && !url) continue;
    items.push({ title, url });
  }

  // Each checkbox value carries slug and title as JSON, so the form's field names do not grow with
  // the blog. The title is a snapshot from when the box was ticked.
  for (const value of form.getAll(FR_INTERNAL)) {
    let slug = "";
    let title = "";
    try {
      const parsed: unknown = JSON.parse(String(value));
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        slug = typeof record.slug === "string" ? record.slug : "";
        title = typeof record.title === "string" ? record.title : "";
      }
    } catch {
      continue;
    }
    if (!slug) continue;
    items.push({ title: title.trim() || slug, url: `${INTERNAL_PREFIX}${slug}` });
  }

  return items.length > 0 ? JSON.stringify(items) : "";
}

export function fieldsFromForm(form: FormData): PostFields {
  const get = (key: string) => String(form.get(key) ?? "");
  return {
    title: get("title"),
    slug: get("slug").trim().toLowerCase(),
    description: get("description"),
    date: get("date"),
    tags: parseTags(get("tags")),
    // From the button pressed, not a hidden field, so it works without script. Unknown means draft.
    draft: draftForIntent(readIntent(form)),
    publishAt: get("publishAt"),
    coverSrc: get("coverSrc"),
    coverAlt: get("coverAlt"),
    body: get("body"),
    firstPublished: get("firstPublished"),
    // The hidden "false" always submits and a ticked box adds "true" after it, so the LAST value wins;
    // form.get() returns the first, which would make the checkbox do nothing.
    featured: (() => {
      const all = form.getAll("featured").map((v) => String(v));
      return all.length > 0 && all[all.length - 1] === "true";
    })(),
    series: get("series"),
    part: get("part"),
    furtherReading: furtherReadingFromForm(form, get("furtherReading")),
    ogTitle: get("ogTitle"),
    ogDescription: get("ogDescription"),
    updated: get("updated"),
  };
}
