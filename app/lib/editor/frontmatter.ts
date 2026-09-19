import matter from "gray-matter";

import { readIntent } from "./intent.mjs";
import { draftForIntent } from "./publish-transition.mjs";

/**
 * Turns editor form fields into a markdown file, and back. The file is the artifact of record, so
 * this has to produce something a person would be content to see in a diff. Scalars that can carry
 * punctuation are emitted as JSON strings, which are valid YAML double-quoted scalars and escape
 * quotes and colons correctly without a YAML serializer.
 */

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
  /**
   * Server-owned, carried through the editor untouched. The editor never offers it and never sets
   * it: `serializePost` writes exactly the keys it knows about, so a value it did not carry would be
   * silently dropped on the next save and a published post would read as never published.
   */
  firstPublished: string;
  /**
   * CARRIED, NOT EDITED. Every key here is a real `frontmatterSchema` key the pair did not know
   * about, and `serializePost` writes exactly what it is handed, so a post committed by hand or by
   * the operator API had those keys ERASED by the next browser save. Nothing warned: the file simply
   * came back smaller.
   *
   * They are preserved rather than exposed as form controls, which is the smallest change that makes
   * the round trip lossless. `furtherReading` is the one that cannot be a scalar: it travels as JSON
   * in a hidden input, so the editor never has to understand its shape to avoid destroying it.
   */
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

/** Splits a comma or newline separated tag input into clean slugs. */
export function parseTags(input: string) {
  return input
    .split(/[,\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The body, exactly as it will be stored: CRLF to LF, then trimmed.
 *
 * Extracted because a SECOND caller needs the identical transform, and the two silently disagreeing
 * is not hypothetical. The admin preview posts its body as multipart, which normalizes every newline
 * to CRLF, so the save path and the preview once produced different bytes from one source.
 *
 * Both callers use this. THERE IS NO THIRD WAY TO PREPARE A BODY.
 */
export function normalizeBody(body: string) {
  return body.replace(/\r\n/g, "\n").trim();
}

/**
 * The `further_reading` list a hidden input is carrying, as objects. Tolerant on purpose: this
 * value crosses a form round trip, and the schema is what judges the CONTENT, so parsing loosely
 * here and validating strictly there keeps one authority over the rule rather than two.
 *
 * Entries missing a title or url are dropped rather than emitted half-formed, because a `- title:`
 * with no `url` is a schema failure that would block the save on data the author never typed.
 */
function parseFurtherReading(raw: string) {
  if (!raw.trim()) return [] as { title: string; url: string }[];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const title = (item as Record<string, unknown>).title;
    const url = (item as Record<string, unknown>).url;
    if (typeof title !== "string" || typeof url !== "string") return [];
    if (!title.trim() || !url.trim()) return [];
    return [{ title: title.trim(), url: url.trim() }];
  });
}

export function serializePost(fields: PostFields) {
  const lines = [
    "---",
    `title: ${JSON.stringify(fields.title)}`,
    `slug: ${fields.slug}`,
    `description: ${JSON.stringify(fields.description)}`,
    `date: ${fields.date}`,
    `tags: [${fields.tags.join(", ")}]`,
    `draft: ${fields.draft ? "true" : "false"}`,
  ];

  if (fields.publishAt.trim()) {
    lines.push(`publish_at: ${JSON.stringify(fields.publishAt.trim())}`);
  }

  if (fields.firstPublished.trim()) {
    lines.push(`first_published: ${fields.firstPublished.trim()}`);
  }

  if (fields.coverSrc.trim()) {
    lines.push("cover:");
    lines.push(`  src: ${fields.coverSrc.trim()}`);
    lines.push(`  alt: ${JSON.stringify(fields.coverAlt)}`);
  }

  /*
   * The carried keys. Each is emitted only when it has a value, so a post that never set one is
   * byte-identical to what it was before this existed.
   */
  if (fields.featured) lines.push("featured: true");
  if (fields.series.trim()) {
    lines.push(`series: ${JSON.stringify(fields.series.trim())}`);
  }
  // Unquoted: `part` is a number in the schema and a quoted scalar is a string.
  if (fields.part.trim()) lines.push(`part: ${fields.part.trim()}`);
  if (fields.ogTitle.trim()) {
    lines.push(`og_title: ${JSON.stringify(fields.ogTitle.trim())}`);
  }
  if (fields.ogDescription.trim()) {
    lines.push(`og_description: ${JSON.stringify(fields.ogDescription.trim())}`);
  }
  if (fields.updated.trim()) lines.push(`updated: ${fields.updated.trim()}`);

  const reading = parseFurtherReading(fields.furtherReading);
  if (reading.length > 0) {
    lines.push("further_reading:");
    for (const item of reading) {
      lines.push(`  - title: ${JSON.stringify(item.title)}`);
      lines.push(`    url: ${JSON.stringify(item.url)}`);
    }
  }

  lines.push("---", "");

  // The body is stored with a single leading blank line after the frontmatter
  // and exactly one trailing newline, so repeated saves do not drift.
  return `${lines.join("\n")}\n${normalizeBody(fields.body)}\n`;
}

/** Parses a stored file back into form fields for editing. */
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
    // Re-serialized to JSON rather than kept as a structure, because this has
    // to survive a form round trip and a FormData value is a string.
    furtherReading: Array.isArray(data.further_reading)
      ? JSON.stringify(data.further_reading)
      : "",
    ogTitle: asString(data.og_title),
    ogDescription: asString(data.og_description),
    updated: asString(data.updated),
  };
}

/**
 * THE FIELD NAMES THE FURTHER-READING CONTROLS SUBMIT, stated once. The component renders them and
 * the parser reads them, so a second spelling would be a control that submits into nothing.
 * `FR_CONTROL` is the MARKER and the load-bearing one; see `furtherReadingFromForm`.
 */
export const FR_CONTROL = "frControl";
export const FR_TITLE = "frTitle";
export const FR_URL = "frUrl";
export const FR_INTERNAL = "frInternal";

/** The `/blog/` prefix the internal picker writes. Mirrors the schema's rule. */
const INTERNAL_PREFIX = "/blog/";

/** An item as it travels in the `further_reading` JSON. */
type ReadingItem = { title: string; url: string };

/** The stored JSON, parsed, or an empty list if it is absent or malformed. */
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

/** Splits stored further reading into the two controls that own it. */
export function splitReading(raw: string) {
  const items = parseReadingJson(raw);
  return {
    external: items.filter((item) => !item.url.startsWith(INTERNAL_PREFIX)),
    internal: items.filter((item) => item.url.startsWith(INTERNAL_PREFIX)),
  };
}

/**
 * REBUILDS `further_reading` FROM THE CONTROLS, or leaves it exactly as it came.
 *
 * A list control has a genuinely ambiguous empty state: "the author removed every row" and "this
 * form never rendered the control" both arrive as no fields at all. So the control renders a hidden
 * MARKER. Present means an empty result is the author's emptiness and is honoured; absent means
 * nothing was offered, so the carried JSON is passed through untouched.
 *
 * The marker is a hidden input rather than an inference from the row fields, because inferring it is
 * the same ambiguity one level down.
 *
 * ORDERING: external rows in document order, then internal picks. A mixed list NORMALISES to
 * externals-first on its first save and is stable after that. A row with neither title nor url is
 * dropped; a row with one of the two is KEPT, so the schema refuses it by name.
 */
export function furtherReadingFromForm(form: FormData, carried: string): string {
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

  /*
   * The picker submits ONE checked box per chosen post, and the box's VALUE carries the slug and the
   * title as JSON. A parallel hidden title field per post would put one field NAME per corpus post
   * into the submission tuple `check:admin-ui` pins, so the fixture would grow with the blog.
   *
   * The title is a SNAPSHOT taken when the box was ticked. Retitling the target does not rewrite links
   * that already point at it; `check:content` guards the link resolving, which is the half that can
   * break silently.
   */
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
      // A value this parser cannot read is dropped rather than guessed at. The
      // only producer is the picker below, so this is a malformed request.
      continue;
    }
    if (!slug) continue;
    items.push({ title: title.trim() || slug, url: `${INTERNAL_PREFIX}${slug}` });
  }

  return items.length > 0 ? JSON.stringify(items) : "";
}

/** Reads a submitted form into fields, without validating them. */
export function fieldsFromForm(form: FormData): PostFields {
  const get = (key: string) => String(form.get(key) ?? "");
  return {
    title: get("title"),
    slug: get("slug").trim().toLowerCase(),
    description: get("description"),
    date: get("date"),
    tags: parseTags(get("tags")),
    /*
     * FROM THE BUTTON THAT WAS PRESSED, not from a field. Reading a hidden input each button flipped in
     * its own handler made every publication transition script-dependent: with scripting off the request
     * described the post's CURRENT state rather than the one the author asked for.
     *
     * Fails closed on an intent this table does not know: unknown means draft.
     */
    draft: draftForIntent(readIntent(form)),
    publishAt: get("publishAt"),
    coverSrc: get("coverSrc"),
    coverAlt: get("coverAlt"),
    body: get("body"),
    // Round-tripped through a hidden input so a browser save preserves it.
    firstPublished: get("firstPublished"),
    // The carried keys, all through hidden inputs. A checkbox is absent from a FormData when unchecked,
    // so `featured` is carried as an explicit "true"/"false" rather than by presence: presence semantics
    // would turn "the form did not carry it" into "the author cleared it".
    /*
     * THE LAST `featured` WINS, and that is what makes a checkbox safe here. The field is submitted
     * TWICE when the box is ticked: a hidden "false" the form always carries, then the checkbox's own
     * "true". An unticked box submits nothing, so the hidden value stands alone.
     *
     * Reading the LAST value is the whole of it, and it changes nothing for a payload with one value
     * present. `form.get()` returns the FIRST, so keeping it would make the hidden "false" permanently
     * win and the control silently do nothing. Absent entirely still reads false, exactly as before.
     */
    featured: (() => {
      const all = form.getAll("featured").map((v) => String(v));
      return all.length > 0 && all[all.length - 1] === "true";
    })(),
    series: get("series"),
    part: get("part"),
    // Rebuilt from the controls when they were on the page, passed through
    // untouched when they were not. The marker is what tells the two apart.
    furtherReading: furtherReadingFromForm(form, get("furtherReading")),
    ogTitle: get("ogTitle"),
    ogDescription: get("ogDescription"),
    updated: get("updated"),
  };
}
