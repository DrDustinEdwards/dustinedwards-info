/*
 * The running head over every public page but the home page (capsomer/manual.css, .cap-running-head): the
 * section's number and trail on the left, as the NASA Graphics Standards Manual heads its pages, and a folio on
 * the right. The numbers are the home page's parts (1 Research to 7 About), with 0 for the site's own pages.
 * The longest matching prefix wins.
 */
type Section = { prefix: string; no: string; trail: string[] };

const SECTIONS: Section[] = [
  { prefix: "/research", no: "1", trail: ["Research"] },
  // A hub's pages carry the hub's part they are listed under, as the lab's pages do (Dustin, 2026-10-26).
  { prefix: "/research/retroviruses", no: "1.1", trail: ["Research", "Research areas"] },
  { prefix: "/research/bacteriophages", no: "1.1", trail: ["Research", "Research areas"] },
  { prefix: "/research/science-education", no: "1.1", trail: ["Research", "Research areas"] },
  { prefix: "/research/publications", no: "2", trail: ["Research", "Publications"] },
  { prefix: "/research/protocols", no: "3.1", trail: ["Research", "Lab", "Protocols"] },
  { prefix: "/research/lab", no: "3.2", trail: ["Research", "Lab", "Registry"] },
  { prefix: "/research/phages", no: "3.3", trail: ["Research", "Lab", "Phages"] },
  { prefix: "/research/tools", no: "3.4", trail: ["Research", "Lab", "Calculators"] },
  { prefix: "/teaching", no: "4", trail: ["Teaching"] },
  { prefix: "/teaching/phage-discovery", no: "4.2", trail: ["Teaching", "Courses"] },
  { prefix: "/teaching/virus-isolation", no: "4.2", trail: ["Teaching", "Courses"] },
  { prefix: "/teaching/phage-bioinformatics", no: "4.2", trail: ["Teaching", "Courses"] },
  { prefix: "/teaching/central-dogma", no: "4.3", trail: ["Teaching", "Tutorials"] },
  { prefix: "/teaching/study-skills", no: "4.3", trail: ["Teaching", "Tutorials"] },
  { prefix: "/writing", no: "5", trail: ["Writing"] },
  { prefix: "/software", no: "6", trail: ["Software"] },
  { prefix: "/software/foxhound", no: "6.1", trail: ["Software", "Products"] },
  { prefix: "/software/foxing", no: "6.1", trail: ["Software", "Products"] },
  { prefix: "/software/foxing-edu", no: "6.1", trail: ["Software", "Products"] },
  { prefix: "/software/germomics", no: "6.2", trail: ["Software", "Sites"] },
  { prefix: "/software/capsid", no: "6.3", trail: ["Software", "Infrastructure"] },
  { prefix: "/software/enarratio", no: "6.3", trail: ["Software", "Infrastructure"] },
  { prefix: "/software/carrel", no: "6.3", trail: ["Software", "Infrastructure"] },
  { prefix: "/software/capsomer", no: "6.3", trail: ["Software", "Infrastructure"] },
  { prefix: "/systems", no: "6.3", trail: ["Software", "Infrastructure", "Systems"] },
  { prefix: "/about", no: "7", trail: ["About"] },
  { prefix: "/contact", no: "7.1", trail: ["About", "Contact"] },
  { prefix: "/cv", no: "7.2", trail: ["About", "Curriculum vitae"] },
  { prefix: "/recipes", no: "7.3", trail: ["About", "Recipes"] },
  { prefix: "/search", no: "0", trail: ["Site", "Search"] },
  { prefix: "/site-map", no: "0", trail: ["Site", "Site map"] },
  { prefix: "/colophon", no: "0", trail: ["Site", "Colophon"] },
  { prefix: "/privacy", no: "0", trail: ["Site", "Privacy"] },
  { prefix: "/terms", no: "0", trail: ["Site", "Terms"] },
  { prefix: "/accessibility", no: "0", trail: ["Site", "Accessibility"] },
];

const SITE_SECTION: Section = { prefix: "/", no: "0", trail: ["Site"] };

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** The section a path sits in, for the running head and the letterhead's folio. */
export function sectionOf(pathname: string): Section {
  let best = SITE_SECTION;
  for (const section of SECTIONS) {
    if (under(pathname, section.prefix) && section.prefix.length > best.prefix.length) best = section;
  }
  return best;
}

/**
 * A route's folio for the running head's right side, from its loader data: `export const handle = { folio }`.
 * Without one the right side carries the site's name.
 */
export type RunningHeadHandle = { folio?: (data: unknown) => string | null | undefined };

/* The word under a patch's number, for each part whose pages wear one. */
const PATCH_UNITS: Record<string, string> = {
  "1.1": "Area",
  "4.2": "Course",
  "4.3": "Tutorial",
  "6.1": "Product",
  "6.2": "Site",
  "6.3": "System",
};

/**
 * A mission patch for a page that is one of its part's members (capsomer/manual.css .cap-patch), as each
 * Apollo crew wore its mission's number: the page's name round the top, the part's name round the foot, its
 * number within the part on the disc. Null for every other page.
 */
export function patchOf(pathname: string): { id: string; name: string; foot: string; count: number; unit: string } | null {
  const section = SECTIONS.find((s) => s.prefix === pathname);
  const unit = section ? PATCH_UNITS[section.no] : undefined;
  if (!section || !unit) return null;
  const members = SECTIONS.filter((s) => s.no === section.no && s.trail.length === section.trail.length);
  const slug = pathname.slice(pathname.lastIndexOf("/") + 1);
  return {
    id: slug,
    name: slug.replaceAll("-", " "),
    foot: section.trail[section.trail.length - 1] ?? "",
    count: members.indexOf(section) + 1,
    unit,
  };
}
