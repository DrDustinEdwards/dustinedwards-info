/* `post()` only writes the markdown and validates nothing itself. A case that saves it sends it
 * through the real save path, where `frontmatterSchema` and the render pipeline refuse what the
 * site would refuse. */

export function post(
  slug: string,
  overrides: Partial<{
    title: string;
    description: string;
    date: string;
    tags: string;
    draft: boolean;
    first_published: string | null;
    /** The series title and this post's part in it. */
    series: [string, number];
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
    series,
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
    ...(series ? [`series: "${series[0]}"`, `part: ${series[1]}`] : []),
    "---",
    "",
    body,
  ];
  return lines.join("\n");
}
