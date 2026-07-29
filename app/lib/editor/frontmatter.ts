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
};

/** Splits a comma or newline separated tag input into clean slugs. */
export function parseTags(input: string) {
  return input
    .split(/[,\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
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

  lines.push("---", "");

  // The body is stored with a single leading blank line after the frontmatter
  // and exactly one trailing newline, so repeated saves do not drift.
  return `${lines.join("\n")}\n${fields.body.replace(/\r\n/g, "\n").trim()}\n`;
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
  };
}
