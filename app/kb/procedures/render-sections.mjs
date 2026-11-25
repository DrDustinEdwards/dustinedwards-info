/** The ids and table of contents of a procedure's sections, with prose headings made unique across the page. */

import GithubSlugger from "github-slugger";

/** A heading as the pipeline writes it: rehype-slug's id, then the autolink inside. */
const HEADING = /<h([1-6]) id="([^"]+)">([\s\S]*?)<\/h\1>/g;

/**
 * The ids of the sections the components draw from the front matter (ProcedureView), so a prose
 * heading with the same words takes the -1 suffix rather than the fixed section's id.
 *
 * @param {unknown} profile
 */
export function fixedSectionIds(profile) {
  const materials =
    profile === "recipe"
      ? "ingredients"
      : profile === "computational"
        ? "software-and-data"
        : "reagents";
  const fixed = [
    materials,
    "equipment",
    "primers",
    "troubleshooting",
    "expected-results",
    "limitations",
    "references",
    "proof-of-use",
    "version-history",
    "cite-this-procedure",
    "key-resources",
  ];
  // A how-to's own sections (S2, S1), after the shared ones so no protocol's prose heading changes its id.
  return profile === "computational"
    ? [...fixed, "overview", "questions", "objectives", "key-points", "explanation"]
    : fixed;
}

/**
 * Renders each section's prose and steps. One slugger serves the whole page, as rehype-slug does for a post: each
 * prose block is rendered alone, so a heading repeated across blocks would otherwise keep one id twice. The sections
 * the components draw themselves take their ids first.
 *
 * @template T
 * @param {{
 *   parsed: import("./parse.mjs").ParsedProcedure,
 *   file: string,
 *   renderBody: import("./render.mjs").RenderBody,
 *   refuseImage: (src: string) => Promise<any>,
 *   renderStep: (step: import("./parse.mjs").Step) => Promise<T>,
 * }} input
 */
export async function renderSections({ parsed, file, renderBody, refuseImage, renderStep }) {
  const slugger = new GithubSlugger();
  for (const id of fixedSectionIds(parsed.data.profile)) slugger.slug(id);
  /** @type {Array<{ depth: number, id: string, text: string }>} */
  const toc = [];
  /** @type {Array<{ id: string, title: string, blocks: Array<{ type: "prose", html: string } | { type: "steps", steps: T[] }> }>} */
  const sections = [];
  for (const section of parsed.sections) {
    const sectionId = section.custom ? section.id : slugger.slug(section.title);
    toc.push({ depth: 2, id: sectionId, text: section.title });
    /** @type {(typeof sections)[number]["blocks"]} */
    const blocks = [];
    for (const block of section.blocks) {
      if (block.type === "prose") {
        const out = await renderBody({ file, body: block.markdown, resolveImage: refuseImage });
        if (out.blockedUrls.length > 0) {
          throw new Error(
            `${file}: the URL allowlist refused ${out.blockedUrls.map((b) => b.url).join(", ")}`,
          );
        }
        const html = out.html.replace(HEADING, (_all, level, id, inner) => {
          const text = String(inner)
            .replace(/<[^>]+>/g, "")
            .replace(/#$/, "")
            .trim();
          const unique = slugger.slug(text);
          if (Number(level) === 3) toc.push({ depth: 3, id: unique, text });
          return `<h${level} id="${unique}">${String(inner).replace(`href="#${id}"`, `href="#${unique}"`)}</h${level}>`;
        });
        blocks.push({ type: "prose", html });
      } else {
        blocks.push({ type: "steps", steps: await Promise.all(block.steps.map(renderStep)) });
      }
    }
    sections.push({ id: sectionId, title: section.title, blocks });
  }
  return { sections, toc };
}
