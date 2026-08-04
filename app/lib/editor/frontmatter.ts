import matter from "gray-matter";

/**
 * Turns editor form fields into a markdown file, and back.
 *
 * The file is the artifact of record, so this has to produce something a person
 * would be content to see in a diff and that the build pipeline parses without
 * special cases. Scalars that can carry punctuation (titles, descriptions, alt
 * text) are emitted as JSON strings, which are valid YAML double-quoted scalars
 * and escape quotes and colons correctly without a YAML serializer.
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
   * Server-owned, carried through the editor untouched.
   *
   * The editor never offers this as a field and never sets it. It is here only
   * so a browser save PRESERVES it: serializePost writes exactly the keys it
   * knows about, so a value it did not carry would be silently dropped on the
   * next edit, and a published post would read as never published.
   */
  firstPublished: string;
  /**
   * CARRIED, NOT EDITED. Finding B004.
   *
   * Everything below is a real key in `frontmatterSchema` that this pair did
   * not know about, and the consequence was silent data loss: `serializePost`
   * writes exactly the keys it is handed, so a post committed by hand or by the
   * operator API with `featured`, `series`/`part`, `further_reading`, an OG
   * override or an explicit `updated` had those keys ERASED by the next browser
   * save. Nothing warned, because the save was valid: the file simply came back
   * smaller. Revision restore lost them the same way, since it loads a
   * historical file through `parsePost`.
   *
   * They are preserved rather than exposed as form controls, which is the same
   * treatment `firstPublished` gets and the smallest change that makes the round
   * trip lossless. Giving them editors is a feature and can be decided on its
   * own; losing them is a bug either way.
   *
   * `furtherReading` is the one that cannot be a scalar. It travels as JSON in a
   * hidden input and is re-emitted as a YAML block, so the editor never has to
   * understand its shape to avoid destroying it.
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
 * The body, exactly as it will be stored.
 *
 * CRLF to LF, then trimmed. Extracted from `serializePost`, where it was
 * inline, because a SECOND caller needs the identical transform and the two
 * silently disagreeing is not hypothetical: it shipped.
 *
 * The admin preview posts its body with `fetch` and a `FormData`, which encodes
 * as multipart, and multipart serialization normalizes every newline to CRLF.
 * The save path stripped them here and the preview route did not, so the
 * preview rendered CRLF inside paragraph text where the published artifact had
 * LF. Same source, different bytes, which is precisely the claim ruling 3
 * exists to make true. Found on the live deploy 2026-08-01, invisible to the
 * offline parity check because that feeds the renderer straight from the
 * artifact and never crosses a form encoding.
 *
 * Both callers now use this. There is no third way to prepare a body.
 */
export function normalizeBody(body: string) {
  return body.replace(/\r\n/g, "\n").trim();
}

/**
 * The `further_reading` list a hidden input is carrying, as objects.
 *
 * Tolerant on purpose. This value crosses a form round trip, so the honest
 * failure mode is "the input was empty or malformed", and the schema is what
 * judges the CONTENT: `frontmatterSchema` rejects a bad url with the protocol
 * allowlist, and it runs on the serialized file server side either way. Parsing
 * loosely here and validating strictly there keeps one authority over the rule
 * rather than two that can disagree.
 *
 * Entries missing a title or url are dropped rather than emitted half-formed,
 * because a `- title:` with no `url` is a schema failure that would block the
 * save on data the author never typed.
 */
export function parseFurtherReading(raw: string) {
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
   * The B004 keys. Each is emitted only when it has a value, so a post that
   * never set one is byte-identical to what it was before this existed: adding
   * `featured: false` to twelve files would have churned the artifact for a
   * default nobody wrote.
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

/** Reads a submitted form into fields, without validating them. */
export function fieldsFromForm(form: FormData): PostFields {
  const get = (key: string) => String(form.get(key) ?? "");
  return {
    title: get("title"),
    slug: get("slug").trim().toLowerCase(),
    description: get("description"),
    date: get("date"),
    tags: parseTags(get("tags")),
    draft: form.get("draft") === "on",
    publishAt: get("publishAt"),
    coverSrc: get("coverSrc"),
    coverAlt: get("coverAlt"),
    body: get("body"),
    // Round-tripped through a hidden input so a browser save preserves it.
    firstPublished: get("firstPublished"),
    // The B004 keys, all through hidden inputs for the same reason. A checkbox
    // is absent from a FormData when unchecked, so `featured` is carried as an
    // explicit "true"/"false" string rather than by presence: the editor is not
    // offering a control here, it is relaying a committed value, and presence
    // semantics would turn "the form did not carry it" into "the author cleared
    // it", which is the exact class of loss this finding is about.
    featured: get("featured") === "true",
    series: get("series"),
    part: get("part"),
    furtherReading: get("furtherReading"),
    ogTitle: get("ogTitle"),
    ogDescription: get("ogDescription"),
    updated: get("updated"),
  };
}
