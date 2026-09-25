// Section-grained: a reader lands on the matching heading, and fusion needs more than one hit per
// index to do anything. Pure: no clock, filesystem or git, so a record never carries a revision date.

import { PUBLISHED_STATUS, statusForDraft } from "./visibility.mjs";

/**
 * Fenced code is kept: the identifiers readers search for live in code blocks as often as in prose.
 *
 * @param {string} markdown
 * @returns {string}
 */
function plainText(markdown) {
  return (
    markdown
      // Fence markers, keeping the code between them.
      .replace(/^\s{0,3}(?:```|~~~).*$/gm, "")
      // Container directives (:::figure ... :::) and their attribute lines.
      .replace(/^\s{0,3}:::.*$/gm, "")
      // Images first, so the alt text of an image does not survive as prose.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      // Links keep their text, drop their target.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Reference-style link labels and footnote markers.
      .replace(/\[\^([^\]]+)\]/g, "")
      .replace(/^\s{0,3}\[[^\]]+\]:.*$/gm, "")
      // Leading block markers: heading hashes, quotes, list bullets.
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, "")
      // Table pipes and separator rows.
      .replace(/^\s{0,3}\|?[\s:|-]+\|[\s:|-]*$/gm, "")
      .replace(/\|/g, " ")
      // Inline code and emphasis markers; the words they wrap stay.
      .replace(/`+/g, "")
      .replace(/\*+/g, "")
      // Underscores only as emphasis: intra-word ones are identifiers (posts_fts), as in CommonMark.
      .replace(/(?<![A-Za-z0-9])_+|_+(?![A-Za-z0-9])/g, "")
      // Whitespace last, so every rule above can leave blank lines behind.
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Headings inside fences are skipped. Zipped with toc BY INDEX, since toc carries the ids rehype-slug
 * generated and re-deriving them here would drift on punctuation.
 *
 * @param {string} markdown post body with frontmatter already stripped
 * @param {Array<{ depth: number, id: string, text: string }>} toc
 * @returns {{ intro: string, sections: Array<{ anchor: string, title: string, depth: number, body: string }> }}
 */
function splitSections(markdown, toc) {
  const lines = markdown.split(/\r?\n/);
  /*
   * @type {Array<{ line: number, depth: number }>}
   */
  const headings = [];

  let fence = "";
  for (const [i, line] of lines.entries()) {
    const fenceMatch = line.match(/^\s{0,3}(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1]?.[0];
      if (marker) {
        if (!fence) fence = marker;
        else if (fence === marker) fence = "";
      }
      continue;
    }
    if (fence) continue;
    const heading = line.match(/^\s{0,3}(#{2,3})\s+\S/);
    if (heading?.[1]) headings.push({ line: i, depth: heading[1].length });
  }

  // Fail closed: if this slicer and the renderer disagree on heading count, every later anchor is wrong.
  if (headings.length !== toc.length) {
    throw new Error(
      `heading count disagrees with the rendered outline: markdown has ${headings.length}, ` +
        `the pipeline collected ${toc.length}. Records would carry wrong anchors.`,
    );
  }

  const introEnd = headings[0]?.line ?? lines.length;
  const intro = plainText(lines.slice(0, introEnd).join("\n"));

  /** @type {Array<{ anchor: string, title: string, depth: number, body: string }>} */
  const sections = [];
  for (const [s, heading] of headings.entries()) {
    const entry = toc[s];
    if (!entry) throw new Error(`no toc entry for heading ${s}`);
    const start = heading.line + 1;
    const end = headings[s + 1]?.line ?? lines.length;
    sections.push({
      anchor: entry.id,
      title: entry.text,
      depth: heading.depth,
      body: plainText(lines.slice(start, end).join("\n")),
    });
  }

  return { intro, sections };
}

/**
 * One index record. A document's own record has no anchor and ordinal 0; a section's record takes
 * the document's uid and url with its anchor appended. Key order is fixed: the output is compared
 * across runs.
 *
 * @param {{ uid: string, url: string, type: "post" | "page", title: string, docTags: string,
 *           status: string, publishAt: any }} doc
 * @param {{ title: string, body: string, tags?: string,
 *           section?: { anchor: string, ordinal: number } }} part
 * @returns {Record<string, any>}
 */
function record(doc, { title, body, tags = "", section }) {
  return {
    uid: section ? `${doc.uid}#${section.anchor}` : doc.uid,
    url: section ? `${doc.url}#${section.anchor}` : doc.url,
    type: doc.type,
    title,
    body,
    tags,
    docTags: doc.docTags,
    docUid: doc.uid,
    docTitle: doc.title,
    docUrl: doc.url,
    anchor: section ? section.anchor : null,
    ordinal: section ? section.ordinal : 0,
    status: doc.status,
    publishAt: doc.publishAt,
  };
}

/**
 * @param {any} post a rendered post record from the shared pipeline
 * @returns {Array<Record<string, any>>}
 */
export function recordsForPost(post) {
  const tags = post.tags.join(" ");
  // Pipe-delimited on both ends so a filter can test for an exact tag with
  // instr(doc_tags, '|d1|') and never match `d1` inside `d10`.
  const docTags = post.tags.length > 0 ? `|${post.tags.join("|")}|` : "";
  const { intro, sections } = splitSections(post.markdown, post.toc);
  const doc = {
    uid: `post:${post.slug}`,
    url: `/blog/${post.slug}`,
    type: /** @type {const} */ ("post"),
    title: post.title,
    docTags,
    status: statusForDraft(post.draft),
    publishAt: post.publishAt,
  };

  /** @type {Array<Record<string, any>>} */
  const records = [
    record(doc, {
      title: post.title,
      body: [post.description, intro].filter(Boolean).join(" "),
      tags,
    }),
  ];

  sections.forEach((section, i) => {
    // A heading with no prose of its own would match nothing and only pad the facet counts.
    if (!section.body) return;
    // Tags stay on the document: repeated per section, section count would drive identity ranking.
    records.push(
      record(doc, {
        title: section.title,
        body: section.body,
        section: { anchor: section.anchor, ordinal: i + 1 },
      }),
    );
  });

  return records;
}

/**
 * @param {any[]} posts
 * @returns {Array<Record<string, any>>}
 */
export function recordsForPosts(posts) {
  return [...posts]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .flatMap((post) => recordsForPost(post));
}

/**
 * publishAt null and status published by design: the visibility predicate admits a null date, and
 * inventing one would put an untrue fact in the index.
 *
 * @param {{ url: string, uid: string, title: string, description: string,
 *           intro: string,
 *           sections: Array<{ anchor: string, title: string, body: string }> }} page
 * @returns {Array<Record<string, any>>}
 */
function recordsForPage(page) {
  // Fail closed: no sections loses every deep link, and a duplicate anchor collides on uid.
  if (page.sections.length === 0) {
    throw new Error(
      `page ${page.url} produced no section records. A page indexed without ` +
        `its sections loses every deep link, which is not an empty result, it ` +
        `is a wrong one.`,
    );
  }
  const anchors = new Set(page.sections.map((s) => s.anchor));
  if (anchors.size !== page.sections.length) {
    throw new Error(
      `page ${page.url} has duplicate section anchors, so two records would ` +
        `share a uid.`,
    );
  }

  // No tags: a page would appear under a tag nothing else on the site shares.
  const doc = {
    uid: page.uid,
    url: page.url,
    type: /** @type {const} */ ("page"),
    title: page.title,
    docTags: "",
    status: PUBLISHED_STATUS,
    publishAt: null,
  };

  /** @type {Array<Record<string, any>>} */
  const records = [
    record(doc, { title: page.title, body: [page.description, page.intro].filter(Boolean).join(" ") }),
  ];

  page.sections.forEach((section, i) => {
    if (!section.body) return;
    records.push(
      record(doc, {
        title: section.title,
        body: section.body,
        section: { anchor: section.anchor, ordinal: i + 1 },
      }),
    );
  });

  return records;
}

/**
 * Sorted by uid: the output is compared across runs, so call order must not leak into it.
 *
 * @param {any[]} pages page inputs, as `recordsForPage` takes them
 * @returns {Array<Record<string, any>>}
 */
export function recordsForPages(pages) {
  return [...pages]
    .sort((a, b) => String(a.uid).localeCompare(String(b.uid)))
    .flatMap((page) => recordsForPage(page));
}

/**
 * One record per paper, not recordsForPage: a paper has no deep links to lose, and some have no abstract.
 * type "page" because a CHECK constraint allows only post or page, and a facet label is not worth a migration.
 *
 * @param {Array<{ uid: string, url: string, title: string, body: string }>} papers
 * @returns {Array<Record<string, any>>}
 */
export function recordsForPapers(papers) {
  for (const paper of papers) {
    // Fail closed: an empty body would match only its own title and still look healthy.
    if (!paper.body || paper.body.trim().length === 0) {
      throw new Error(
        `paper ${paper.url} produced an empty search body. A record with no ` +
          `text is not a small record, it is one that cannot be found by ` +
          `anything except its own title.`,
      );
    }
  }
  return [...papers]
    .sort((a, b) => String(a.uid).localeCompare(String(b.uid)))
    .map((paper) =>
      // No tags: the tag facet is the blog's, and its archive would not list a paper.
      record(
        {
          uid: paper.uid,
          url: paper.url,
          type: "page",
          title: paper.title,
          docTags: "",
          status: PUBLISHED_STATUS,
          publishAt: null,
        },
        { title: paper.title, body: paper.body },
      ),
    );
}
