// Section-grained: a reader lands on the matching heading, and fusion needs more than one hit per
// index to do anything. Pure: no clock, filesystem or git, so a record never carries a revision date.

export const RECORD_TYPES = /** @type {const} */ (["post", "page"]);

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
export function splitSections(markdown, toc) {
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
 * @param {any} post a rendered post record from the shared pipeline
 * @returns {Array<Record<string, any>>}
 */
export function recordsForPost(post) {
  const url = `/blog/${post.slug}`;
  const docUid = `post:${post.slug}`;
  const tags = post.tags.join(" ");
  // Pipe-delimited on both ends so a filter can test for an exact tag with
  // instr(doc_tags, '|d1|') and never match `d1` inside `d10`.
  const docTags = post.tags.length > 0 ? `|${post.tags.join("|")}|` : "";
  const status = post.draft ? "draft" : "published";
  const { intro, sections } = splitSections(post.markdown, post.toc);

  /** @type {Array<Record<string, any>>} */
  const records = [
    {
      uid: docUid,
      url,
      type: "post",
      title: post.title,
      body: [post.description, intro].filter(Boolean).join(" "),
      tags,
      docTags,
      docUid,
      docTitle: post.title,
      docUrl: url,
      anchor: null,
      ordinal: 0,
      status,
      publishAt: post.publishAt,
    },
  ];

  sections.forEach((section, i) => {
    // A heading with no prose of its own would match nothing and only pad the facet counts.
    if (!section.body) return;
    records.push({
      uid: `${docUid}#${section.anchor}`,
      url: `${url}#${section.anchor}`,
      type: "post",
      title: section.title,
      body: section.body,
      // Tags stay on the document: repeated per section, section count would drive identity ranking.
      tags: "",
      docTags,
      docUid,
      docTitle: post.title,
      docUrl: url,
      anchor: section.anchor,
      ordinal: i + 1,
      status,
      publishAt: post.publishAt,
    });
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
export function recordsForPage(page) {
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

  /** @type {Array<Record<string, any>>} */
  const records = [
    {
      uid: page.uid,
      url: page.url,
      type: "page",
      title: page.title,
      body: [page.description, page.intro].filter(Boolean).join(" "),
      // No tags: a page would appear under a tag nothing else on the site shares.
      tags: "",
      docTags: "",
      docUid: page.uid,
      docTitle: page.title,
      docUrl: page.url,
      anchor: null,
      ordinal: 0,
      status: "published",
      publishAt: null,
    },
  ];

  page.sections.forEach((section, i) => {
    if (!section.body) return;
    records.push({
      uid: `${page.uid}#${section.anchor}`,
      url: `${page.url}#${section.anchor}`,
      type: "page",
      title: section.title,
      body: section.body,
      tags: "",
      docTags: "",
      docUid: page.uid,
      docTitle: page.title,
      docUrl: page.url,
      anchor: section.anchor,
      ordinal: i + 1,
      status: "published",
      publishAt: null,
    });
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
    .map((paper) => ({
      uid: paper.uid,
      url: paper.url,
      type: "page",
      title: paper.title,
      body: paper.body,
      // No tags: the tag facet is the blog's, and its archive would not list a paper.
      tags: "",
      docTags: "",
      docUid: paper.uid,
      docTitle: paper.title,
      docUrl: paper.url,
      anchor: null,
      ordinal: 0,
      status: "published",
      publishAt: null,
    }));
}
