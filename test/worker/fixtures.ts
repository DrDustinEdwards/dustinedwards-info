/* Fixtures go through `frontmatterSchema` and the real render pipeline, so no case downstream
 * tests a document this site would refuse. */

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

export { postPath } from "~/lib/content/pipeline.mjs";
