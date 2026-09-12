/**
 * Turns content into the one record shape the search index stores.
 *
 * Imported by BOTH the build scripts and the Worker, for the same reason
 * app/lib/content/pipeline.mjs is: there must not be a second indexer. The
 * editor's save path and `npm run build:content` derive records from identical
 * bytes through this module, so a post saved in the browser and the same post
 * committed from a clone produce byte-identical records.
 *
 * RECORDS ARE SECTION-GRAINED. One post yields a document record plus one
 * record per heading. A reader searching for a phrase that appears under one
 * heading lands on that heading rather than on the top of a long post, and the
 * result carries the anchor to prove it. This also gives fusion something to
 * fuse: with document-level records a one-post corpus produces at most one hit
 * per index, and reciprocal rank fusion over two single-item lists is
 * indistinguishable from doing nothing.
 *
 * Nothing here reads the clock, the filesystem, or git. Records are a pure
 * function of the post record, which is what lets them live in the gated
 * artifact. Revision dates are deliberately NOT part of a record: a git date in
 * the artifact makes `check:content` fail on every content commit, per the
 * ruling in decisions.md.
 */

/** Record types. `page` is a hand-authored route, `post` is content/posts. */
export const RECORD_TYPES = /** @type {const} */ (["post", "page"]);

/**
 * Strips markdown to the plain text a snippet should show.
 *
 * Fenced code is KEPT, deliberately. On a site whose posts are about D1, fts5
 * and wrangler, the identifiers a reader searches for live as often in a code
 * block as in a sentence. Only the fence markers go.
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
      // Inline emphasis and code markers. The characters are dropped, the words
      // they wrap are not.
      .replace(/`+/g, "")
      .replace(/\*+/g, "")
      // Underscores only where they are actually emphasis. An underscore with
      // alphanumerics on BOTH sides is part of an identifier, and CommonMark
      // agrees: `_` cannot open or close emphasis intra-word. Stripping them
      // blindly turned posts_fts into postsfts, which would have made every
      // identifier on this site unfindable by the name it is written under.
      .replace(/(?<![A-Za-z0-9])_+|_+(?![A-Za-z0-9])/g, "")
      // Whitespace last, so every rule above can leave blank lines behind.
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Splits a post's markdown at its headings, in document order.
 *
 * Headings inside fenced code are not headings. A line reading `## not a
 * heading` inside a fence would otherwise split the document somewhere the
 * renderer did not, and every anchor after it would be wrong.
 *
 * The result is zipped with the pipeline's `toc` BY INDEX rather than by
 * matching heading text, because the toc entries carry the ids rehype-slug
 * actually generated. Re-deriving ids here would be a second implementation of
 * slugging and would drift from the renderer the first time a heading contained
 * punctuation.
 *
 * @param {string} markdown post body with frontmatter already stripped
 * @param {Array<{ depth: number, id: string, text: string }>} toc
 * @returns {{ intro: string, sections: Array<{ anchor: string, title: string, depth: number, body: string }> }}
 */
export function splitSections(markdown, toc) {
  const lines = markdown.split(/\r?\n/);
  /*
   * ONE ARRAY OF PAIRS, not two arrays zipped by index.
   *
   * The line number and the depth were collected into parallel arrays and read
   * back with `headingLines[s]` and `headingDepths[s]`, which is a shape that
   * can only be right while nothing ever pushes to one and not the other.
   * `noUncheckedIndexedAccess` is what surfaced it, but the array-pair is the
   * real defect and a non-null assertion would have preserved it.
   *
   * @type {Array<{ line: number, depth: number }>}
   */
  const headings = [];

  let fence = "";
  for (const [i, line] of lines.entries()) {
    const fenceMatch = line.match(/^\s{0,3}(```+|~~~+)/);
    if (fenceMatch) {
      // The capture group cannot be absent when the match succeeded, so the
      // guard is unreachable rather than a fallback: it substitutes nothing and
      // the `continue` below still runs for every fence line either way.
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

  // Fail closed. If this slicer and the real renderer disagree about how many
  // headings the document has, every anchor after the disagreement is wrong and
  // the records would deep-link readers to fragments that do not exist. A build
  // failure naming the counts is the only safe outcome.
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
    // Unreachable: the lengths were compared above and the loop walks the
    // shorter-or-equal one. Thrown rather than defaulted, because an anchor
    // invented here is the exact failure the count comparison exists to stop.
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
 * Builds every search record for one post.
 *
 * The document record carries the description and the intro, so a query that
 * matches the post as a whole still has somewhere to land. Section records
 * carry only their own text, so their snippets are about the section.
 *
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
    // A section with no prose of its own (a heading immediately followed by
    // another heading) is skipped rather than indexed as an empty body. It
    // would match nothing and would only pad the facet counts.
    if (!section.body) return;
    records.push({
      uid: `${docUid}#${section.anchor}`,
      url: `${url}#${section.anchor}`,
      type: "post",
      title: section.title,
      body: section.body,
      // Tags belong to the document. Repeating them on every section would make
      // one tagged post outrank a differently tagged post by section count
      // alone in the identity index.
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
 * Every record for every post, in a stable order.
 *
 * @param {any[]} posts
 * @returns {Array<Record<string, any>>}
 */
export function recordsForPosts(posts) {
  return [...posts]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .flatMap((post) => recordsForPost(post));
}

/**
 * Builds every search record for a hand-authored PAGE.
 *
 * Ruling 3 of colophon-page.md: a page belongs in the search corpus like any
 * other content. `RECORD_TYPES` has declared `page` since the index was built
 * and this is its first population, so there is no schema change and no
 * migration; the `type` facet simply stops having one value.
 *
 * **It lives here, beside `recordsForPost`, because this module's rule is that
 * there must not be a second indexer.** A page emitter in a build script or in
 * its own module would be exactly the mirror `check:invariants` exists to
 * prevent: two things deriving the same record shape, drifting the first time
 * one gains a column.
 *
 * Section-grained for the same reason posts are. A reader searching for
 * "error 1042" should land on the binding that mentions it, not on the top of a
 * long page.
 *
 * **`publishAt` is null and `status` is "published", and neither is a
 * workaround.** The visibility predicate is
 * `status = 'published' AND (publish_at IS NULL OR publish_at <= ?)`, so a null
 * date is already visible by design. Inventing a publication date to satisfy a
 * filter that does not need one would put a fact in the index that is not true
 * of the page.
 *
 * @param {{ url: string, uid: string, title: string, description: string,
 *           intro: string,
 *           sections: Array<{ anchor: string, title: string, body: string }> }} page
 * @returns {Array<Record<string, any>>}
 */
export function recordsForPage(page) {
  // Fail closed, twice. A page with no sections would index as a single
  // document record and quietly lose every deep link, and a duplicate anchor
  // would make two records share a uid and collide on insert.
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
      // A page carries no tags. The facet is per-post and a page inventing one
      // would appear under a tag nothing else on the site shares.
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
 * Every record for every page, in a stable order.
 *
 * Sorted by uid rather than left in call order, for the reason
 * `recordsForPosts` sorts by slug: the outputs are compared (determinism in
 * check:content, drift at ship), so an order that depends on how a caller
 * happened to assemble its list would read as a difference on unrelated runs.
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
 * Every search record for the publication corpus: ONE PER PAPER, no sections.
 *
 * ## WHY IT IS NOT `recordsForPage`
 *
 * That builder THROWS on a page with no sections, and it is right to: a page
 * indexed without them loses every deep link, which is a wrong result rather
 * than an empty one. A paper has no deep links to lose. Its page is one
 * bibliographic record and one abstract under one heading, so the honest
 * decomposition is one document, and three of the 36 have no abstract at all,
 * which under the page builder would be an exception rather than a record.
 *
 * It lives HERE, beside the other two, because this module's rule is that there
 * is not a second indexer. What lives outside it is how a paper's indexable
 * text is assembled, exactly as `colophon-sections.mjs` owns the colophon's:
 * this function must not learn the corpus's field names.
 *
 * ## `type: "page"`, WHICH IS NOT QUITE WHAT A PAPER IS
 *
 * `search_docs.type` is `'post' | 'page'`, enforced by a CHECK constraint in
 * SQLite, so a third value is a table rebuild and a migration. A facet label is
 * not worth one. `page` is the closer of the two: a paper page is a document
 * this site serves that is not a blog post, which is what the value has always
 * meant here. The reader still sees "page" beside a paper in the type facet,
 * and that is the honest cost of not migrating.
 *
 * ## VISIBILITY
 *
 * `status: "published"` and `publishAt: null`, for the reason `recordsForPage`
 * states and not as a shortcut: the predicate is
 * `status = 'published' AND (publish_at IS NULL OR publish_at <= ?)`, so a null
 * date is visible by design. A paper has no draft state and no schedule; it is
 * published by being in the corpus, and inventing a date would put a fact in
 * the index that is not true of the record.
 *
 * @param {Array<{ uid: string, url: string, title: string, body: string }>} papers
 * @returns {Array<Record<string, any>>}
 */
export function recordsForPapers(papers) {
  for (const paper of papers) {
    // Fail closed. An empty body would index a title with nothing behind it,
    // matching only its own words and reporting as a healthy record.
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
      // No tags, for the reason a page carries none: the tag facet is the blog's
      // and a paper appearing under one would link to an archive that does not
      // list it. Topics are the publication index's own filter and stay there.
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
