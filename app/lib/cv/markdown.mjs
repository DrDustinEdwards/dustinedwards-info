/**
 * The CV as markdown, from the same resolved entries the page renders (app/lib/cv/entries.mjs).
 * build:content turns it into the /cv.md twin through the content-page pipeline, and
 * scripts/build-cv-pdf.mjs renders the same markdown into the PDF, so the three surfaces say the same
 * thing. Traditional order and no filtering: this is the version a committee reads start to finish.
 */

import { ORGANISM_PATTERN } from "../../data/organisms.ts";
import { CV_PAGE, CV_PDF_PATH, formatDollars } from "./entries.mjs";
import { TYPES } from "./view.mjs";

/**
 * Markdown-significant characters in data text are escaped, and a colon before a letter is escaped
 * because the pipeline reads `:word` as a directive and fails closed on unknown ones.
 *
 * @param {string} text
 */
function esc(text) {
  return String(text)
    .replace(/([\\`*_[\]<>#|])/g, "\\$1")
    .replace(/:(?=[A-Za-z])/g, "\\:");
}

const OWNER_NAMES = new Set(["Dustin Edwards", "Dustin C. Edwards", "Dustin Cole Edwards", "D. Edwards"]);

/** @param {string[]} authors */
function authorLine(authors) {
  return authors.map((name) => (OWNER_NAMES.has(name) ? `**${esc(name)}**` : esc(name))).join(", ");
}

/** @param {import("./entries.mjs").CvEntry} e */
function paperItem(e) {
  const p = e.paper;
  if (!p) throw new Error(`cv markdown: ${e.id} is a publication with no paper`);
  const end = /[.?!]$/.test(e.title) ? "" : ".";
  const links = [];
  if (p.doi) links.push(`[doi:${esc(p.doi)}](https://doi.org/${p.doi})`);
  if (p.pmid) links.push(`[PubMed ${p.pmid}](https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/)`);
  // Genus and species italic, as the paper pages set them (app/lib/scientific-names.tsx).
  const title = esc(e.title).replace(ORGANISM_PATTERN, (name) => `*${name}*`);
  return `${authorLine(p.authors)}. ${e.year}. ${title}${end} *${esc(p.venue)}*.${links.length ? ` ${links.join(", ")}` : ""}`;
}

/** @param {import("./entries.mjs").CvEntry} e */
function lineItem(e) {
  const lead = e.when ? `**${e.when}** ` : "";
  switch (e.type) {
    case "grant": {
      const parts = [formatDollars(e.amount ?? 0), e.title, ...e.meta, ...(e.note ? [e.note] : [])];
      return `${lead}${esc(parts.join(", "))}`;
    }
    case "course":
      return esc(`${e.title}, ${e.meta.join(", ")}`);
    case "talk":
      return `${lead}${esc(e.title)}. ${esc(e.meta.join(". "))}`;
    default: {
      const rest = e.meta.filter(Boolean);
      return `${lead}${esc(e.title)}${rest.length ? `. ${esc(rest.join(". "))}` : ""}`;
    }
  }
}

/**
 * @param {import("./entries.mjs").Cv} CV the resolved CV (buildCv)
 * @param {{ pdf?: boolean }} [options] the PDF leaves out the opening lines, which it sets as a letterhead
 * @returns {string} markdown body, no frontmatter
 */
export function cvMarkdownBody(CV, options = {}) {
  const { person, entries, presentations } = CV;
  const out = [];
  // The PDF sets its own letterhead (scripts/build-cv-pdf.mjs), so it starts at the first section.
  if (!options.pdf) {
    out.push(`${person.name}, ${person.degree} ${person.title}, ${person.department}, ${esc(person.org)}.`);
    out.push("");
    out.push(
      `This is the ${CV.edition} CV. The same entries are at [/cv](/cv), where they can be filtered, and as a [PDF](${CV_PDF_PATH}). Each paper also has its own page under [Publications](/research/publications).`,
    );
  }

  for (const [type, , plural] of TYPES) {
    const list = entries.filter((e) => e.type === type);
    if (list.length === 0) continue;
    out.push(...(out.length ? [""] : []), `## ${plural}`);
    if (type === "talk") {
      out.push(
        "",
        `The CV lists ${presentations.international} international and ${presentations.national} national and regional presentations, ${presentations.from}-${presentations.to}, most of them posters and talks given by students with Dustin as senior author. Invited talks, seminars and roundtables where Dustin is the lead or only author:`,
      );
    }
    if (type === "mentoring") {
      out.push("", "Shown as counts; the CV names each student.");
    }
    if (type === "grant") {
      const total = list.reduce((sum, e) => sum + (e.amount ?? 0), 0);
      out.push("", `${list.length} awards totaling ${formatDollars(total)}, newest first. Where a student shares an award, this says "with a student researcher" instead of a name.`);
    }

    /** @type {Map<string, typeof list>} */
    const sections = new Map();
    for (const e of list) {
      const key = e.section ?? "";
      if (!sections.has(key)) sections.set(key, []);
      sections.get(key)?.push(e);
    }
    for (const [section, items] of sections) {
      if (section) out.push("", `### ${esc(section)}`);
      if (type === "publication") {
        out.push("");
        items.forEach((e, i) => out.push(`${i + 1}. ${paperItem(e)}`));
        continue;
      }
      let listOpen = false;
      for (const e of items) {
        if (e.duties.length === 0) {
          if (!listOpen) out.push("");
          listOpen = true;
          out.push(`- ${lineItem(e)}`);
          continue;
        }
        listOpen = false;
        out.push("", `#### ${esc(`${e.when}: ${e.title}`)}`, "", `${esc(e.meta.join(". "))}.`);
        for (const duty of e.duties) {
          out.push("", `${esc(duty.heading)}:`, "");
          for (const item of duty.items) out.push(`- ${esc(item)}`);
        }
      }
    }
  }

  return `${out.join("\n")}\n`;
}

/** The whole source file build:content reads for /cv, frontmatter included. */
/** @param {import("./entries.mjs").Cv} CV the resolved CV (buildCv) */
export function cvMarkdownDocument(CV) {
  const fm = [
    "---",
    `path: ${CV_PAGE.path}`,
    `title: ${JSON.stringify(CV_PAGE.title)}`,
    `seo_title: ${JSON.stringify(CV_PAGE.seoTitle)}`,
    `description: ${JSON.stringify(CV_PAGE.description)}`,
    "schema_type: WebPage",
    "---",
    "",
  ].join("\n");
  return `${fm}${cvMarkdownBody(CV)}`;
}
