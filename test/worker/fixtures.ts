/**
 * Post fixtures, and the one rule they follow.
 *
 * They go through `frontmatterSchema` and the whole render pipeline for real,
 * so they carry exactly the fields a real post carries and nothing invented.
 * A fixture that skipped validation would make every case downstream of it a
 * test of a document this site would refuse.
 */

/** @param overrides frontmatter lines to add or replace, by key */
export function post(
  slug: string,
  overrides: Partial<{
    title: string;
    description: string;
    date: string;
    tags: string;
    draft: boolean;
    first_published: string | null;
    body: string;
  }> = {},
) {
  const {
    title = `Test post ${slug}`,
    description = `A description for ${slug} that is long enough to read like real frontmatter.`,
    date = "2026-07-01",
    tags = "[testing]",
    draft = true,
    first_published = null,
    body = `This is the body of ${slug}. It has a paragraph so the renderer has prose to work on.\n\n## A heading\n\nAnd a second paragraph under it.\n`,
  } = overrides;

  const lines = [
    "---",
    `title: "${title}"`,
    `slug: ${slug}`,
    `description: "${description}"`,
    `date: ${date}`,
    `tags: ${tags}`,
    `draft: ${draft}`,
    ...(first_published ? [`first_published: ${first_published}`] : []),
    "---",
    "",
    body,
  ];
  return lines.join("\n");
}

/** Where a post's markdown lives. Stated once, by `postPath`, and mirrored nowhere. */
export { postPath } from "~/lib/content/pipeline.mjs";
