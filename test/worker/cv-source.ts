import { CV_FILES, cvSourcePath } from "~/lib/cv/parse.mjs";

/* The CV's committed files as the repository holds them, for the cases that stub the source. */

const FILES = import.meta.glob("../../content/cv/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const rawOf = (slug: string) => {
  const found = FILES[`../../content/cv/${slug}.md`];
  if (found === undefined) throw new Error(`no content/cv/${slug}.md`);
  return found;
};

export const repository = () =>
  Object.fromEntries(CV_FILES.map(({ slug }) => [cvSourcePath(slug), rawOf(slug)]));

/** The grants file with one more entry at the top. */
export const withGrant = (title: string, amount: number) =>
  rawOf("grants").replace(
    "entries:\n",
    `entries:\n  - year: 2026\n    amount: ${amount}\n    title: ${title}\n    funder: Example Foundation\n    areas: []\n    role: recipient\n`,
  );
