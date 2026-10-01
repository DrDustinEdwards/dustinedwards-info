/**
 * The CV resolved: app/data/cv.ts joined to the publication records (content/publications/), one flat list
 * every surface renders. The page (app/routes/cv.tsx), the markdown twin (app/lib/cv/markdown.mjs, written by
 * build:content) and the PDF (scripts/build-cv-pdf.mjs, from the twin) all resolve it with `buildCv`, so they
 * cannot say different things. Pure and clock-free, so the twin and the PDF fingerprint are reproducible.
 */

import { CV_EDITION, CV_ENTRIES, CV_PERSON, CV_PRESENTATIONS } from "../../data/cv.ts";
import { canonicalAuthor } from "../publications/authors.mjs";
import { decodeEntities } from "../publications/entities.mjs";
import { paperPath, paperPdfPath } from "../publications/paths.mjs";
import { areaLabel, foldText, formatDollars, roleLabel, typeLabel } from "./view.mjs";

export { formatDollars };

/** @typedef {import("../../data/cv.ts").CvType} CvType */
/** @typedef {import("../../data/cv.ts").CvArea} CvArea */
/** @typedef {import("../../data/cv.ts").CvRole} CvRole */
/** @typedef {import("../../data/cv.ts").CvLink} CvLink */
/** @typedef {import("../../data/cv.ts").CvSourceEntry} CvSourceEntry */
/** @typedef {import("../publications/types.ts").Publication} Publication */
/** @typedef {import("../publications/types.ts").TopicId} TopicId */

/**
 * @typedef {object} CvPaper
 * @property {string[]} authors as the record lists them, the owner included
 * @property {string} venue journal, volume(issue):pages
 * @property {string | null} doi
 * @property {string | null} pagePath the site's page for the paper, which carries the abstract
 * @property {string | null} pdfPath
 * @property {string | null} pmid
 * @property {string | null} pmcUrl
 * @property {boolean} hasAbstract
 * @property {string} citation the plain citation a reader copies
 * @property {string | null} bibtexPath the site's .bib export, or null when the text is inline
 * @property {string | null} risPath
 * @property {string | null} bibtex inline BibTeX, for a paper the site has no record for
 * @property {string | null} ris
 * @property {Publication | null} record the site record, for JSON-LD
 */

/**
 * @typedef {object} CvEntry
 * @property {string} id a stable anchor, unique across the CV
 * @property {CvType} type
 * @property {string | null} section the subsection it sits under when grouped by type
 * @property {number | null} year when it started
 * @property {number | "present" | null} endYear null for a single year
 * @property {string} when the dates as printed: "2019", "2014-2020", "2015-present", or ""
 * @property {CvArea[]} areas
 * @property {CvRole | null} role
 * @property {string} title the entry's first line
 * @property {string[]} meta the lines after it
 * @property {string | null} note
 * @property {CvLink[]} links
 * @property {CvPaper | null} paper
 * @property {number | null} amount a grant's US dollars
 * @property {number | null} students how many students a mentoring line counts
 * @property {boolean} cohort a mentoring count that belongs to its start year alone
 * @property {{ heading: string, items: string[] }[]} duties
 * @property {string} search folded text the search box matches
 */

/** The PDF's public path, served from public/ like the paper PDFs. */
export const CV_PDF_PATH = "/dustin-edwards-cv.pdf";

export const CV_PAGE = {
  path: "/cv",
  title: "Curriculum Vitae",
  seoTitle: "Dustin Edwards CV: Professor and Virologist, Tarleton",
  description:
    "Dustin Edwards's CV: Professor and Virologist at Tarleton State University. Appointments, education, publications, grants, teaching and service.",
};

/** @type {Record<TopicId, CvArea>} */
const TOPIC_AREA = {
  "human-simian-retroviruses": "retroviruses",
  "avian-retroviruses": "retroviruses",
  bacteriophages: "bacteriophages",
  "science-education": "science-education",
};

const OWNER = "Dustin Edwards";

/** @param {string} value */
function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

/**
 * @param {number | null} year
 * @param {number | "present" | undefined} endYear
 */
export function formatWhen(year, endYear) {
  if (year === null) return "";
  if (endYear === undefined || endYear === year) return String(year);
  return `${year}-${endYear}`;
}

/**
 * @param {string | null} journal
 * @param {string | null | undefined} volume
 * @param {string | null | undefined} issue
 * @param {string | null | undefined} pages
 */
function venueOf(journal, volume, issue, pages) {
  let out = decodeEntities(journal ?? "");
  if (volume) out += ` ${volume}${issue ? `(${issue})` : ""}`;
  if (pages) out += `${volume ? ":" : ", "}${pages}`;
  return out.trim();
}

/** @param {Publication} p @returns {CvRole} */
function authorRole(p) {
  const at = p.authors.findIndex((name) => canonicalAuthor(name) === OWNER);
  if (at < 0) {
    throw new Error(`cv: ${p.doi} does not list ${OWNER} among its authors, so the CV cannot claim it.`);
  }
  if (at === 0) return "first-author";
  if (at === p.authors.length - 1) return "senior-author";
  return "co-author";
}

/**
 * @param {string[]} authors
 * @param {number | null} year
 * @param {string} title
 * @param {string} venue
 * @param {string | null} doi
 */
function plainCitation(authors, year, title, venue, doi) {
  const names = authors.map((name) => canonicalAuthor(name)).join(", ");
  const end = /[.?!]$/.test(title) ? "" : ".";
  return `${names}. ${year ?? "n.d."}. ${title}${end} ${venue}.${doi ? ` https://doi.org/${doi}` : ""}`;
}

/**
 * @param {CvSourceEntry} source
 * @param {Map<string, Publication>} byDoi the publication records by lower-cased DOI
 * @returns {Omit<CvEntry, "id" | "search">}
 */
function resolveOne(source, byDoi) {
  const base = {
    section: null,
    note: null,
    links: /** @type {CvLink[]} */ ([]),
    paper: null,
    amount: null,
    students: null,
    cohort: false,
    duties: /** @type {{ heading: string, items: string[] }[]} */ ([]),
  };

  if (source.type === "publication" && "doi" in source) {
    const p = byDoi.get(source.doi.toLowerCase());
    if (!p) {
      throw new Error(`cv: no publication record for DOI ${source.doi}; add its file to content/publications/ first.`);
    }
    const title = decodeEntities(p.title);
    const venue = venueOf(p.journal, p.volume, p.issue, p.pages);
    const { slug } = p;
    const areas = [...new Set(p.topics.map((t) => TOPIC_AREA[t]))];
    /** @type {CvLink[]} */
    const links = [{ label: "DOI", href: `https://doi.org/${p.doi}` }];
    if (p.pmid) links.push({ label: "PubMed", href: `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/` });
    if (p.pmcUrl) links.push({ label: "PMC", href: p.pmcUrl });
    return {
      ...base,
      type: "publication",
      year: p.year,
      endYear: null,
      when: String(p.year),
      areas,
      role: authorRole(p),
      title,
      meta: [venue],
      links,
      paper: {
        authors: p.authors.map((name) => decodeEntities(name)),
        venue,
        doi: p.doi,
        pagePath: paperPath(slug),
        pdfPath: p.access === "self-hosted" && p.pdfPath ? paperPdfPath(slug) : null,
        pmid: p.pmid,
        pmcUrl: p.pmcUrl,
        hasAbstract: Boolean(p.abstract),
        citation: plainCitation(p.authors, p.year, title, venue, p.doi),
        bibtexPath: `/research/publications/${slug}.bib`,
        risPath: `/research/publications/${slug}.ris`,
        bibtex: null,
        ris: null,
        record: p,
      },
    };
  }

  const when = formatWhen(source.year, source.endYear);
  const common = {
    ...base,
    year: source.year,
    endYear: source.endYear ?? null,
    when,
    areas: source.areas,
    role: source.role,
    links: source.links ?? [],
  };

  switch (source.type) {
    case "publication": {
      const venue = venueOf(source.journal, source.volume, source.issue, source.pages);
      const key = `${slugify(source.authors[0]?.split(" ").pop() ?? "cv")}-${source.year}-${slugify(source.title).split("-").slice(0, 3).join("-")}`;
      const bibtex = [
        `@article{${key},`,
        `  title = {${source.title}},`,
        `  author = {${source.authors.join(" and ")}},`,
        `  journal = {${source.journal}},`,
        `  year = {${source.year}},`,
        ...(source.volume ? [`  volume = {${source.volume}},`] : []),
        ...(source.issue ? [`  number = {${source.issue}},`] : []),
        ...(source.pages ? [`  pages = {${source.pages.replace("-", "--")}},`] : []),
        "}",
      ].join("\n");
      const pages = source.pages?.split("-") ?? [];
      const ris = [
        "TY  - JOUR",
        `TI  - ${source.title}`,
        ...source.authors.map((name) => `AU  - ${name}`),
        `JO  - ${source.journal}`,
        `PY  - ${source.year}`,
        ...(source.volume ? [`VL  - ${source.volume}`] : []),
        ...(source.issue ? [`IS  - ${source.issue}`] : []),
        ...(pages[0] ? [`SP  - ${pages[0]}`] : []),
        ...(pages[1] ? [`EP  - ${pages[1]}`] : []),
        "ER  - ",
      ].join("\n");
      return {
        ...common,
        type: "publication",
        title: source.title,
        meta: [venue],
        paper: {
          authors: source.authors,
          venue,
          doi: null,
          pagePath: null,
          pdfPath: null,
          pmid: null,
          pmcUrl: null,
          hasAbstract: false,
          citation: plainCitation(source.authors, source.year, source.title, venue, null),
          bibtexPath: null,
          risPath: null,
          bibtex,
          ris,
          record: null,
        },
      };
    }
    case "appointment":
      return {
        ...common,
        type: "appointment",
        section: source.section,
        title: source.title,
        meta: [source.org, ...(source.detail ? [source.detail] : [])],
        duties: source.duties ?? [],
      };
    case "education":
      return {
        ...common,
        type: "education",
        title: source.title,
        meta: [source.org, ...(source.detail ? [source.detail] : [])],
      };
    case "grant":
      return {
        ...common,
        type: "grant",
        title: source.title,
        meta: [source.funder ?? ""].filter(Boolean),
        note: source.note ?? null,
        amount: source.amount,
      };
    case "award":
      return {
        ...common,
        type: "award",
        title: source.title,
        meta: [[source.org, source.place].filter(Boolean).join(", ")].filter(Boolean),
      };
    case "talk":
      return {
        ...common,
        type: "talk",
        title: source.title,
        meta: [source.venue, ...(source.presenters.length > 1 ? [`With ${source.presenters.slice(1).join(", ")}`] : [])],
      };
    case "course":
      return {
        ...common,
        type: "course",
        title: `${source.code}: ${source.title}`,
        meta: [`${source.org}, ${source.term}`],
      };
    case "mentoring": {
      const counted = `${source.count} ${source.unit === "awards" ? (source.count === 1 ? "award" : "awards") : source.count === 1 ? "student" : "students"}`;
      return {
        ...common,
        type: "mentoring",
        section: source.section,
        title: `${counted}: ${source.level}`,
        meta: [source.program, source.org, ...(source.detail ? [source.detail] : [])],
        students: source.unit === "students" ? source.count : null,
        cohort: source.cohort,
      };
    }
    case "service":
      return {
        ...common,
        type: "service",
        section: source.section,
        title: source.title,
        meta: [[source.org, source.place].filter(Boolean).join(", ")].filter(Boolean),
      };
    case "development":
      return {
        ...common,
        type: "development",
        title: source.title,
        meta: [[source.org, source.place].filter(Boolean).join(", ")].filter(Boolean),
      };
    default:
      throw new Error(`cv: an entry has no known type: ${JSON.stringify(source)}`);
  }
}

/**
 * @param {Publication[]} publications
 * @returns {CvEntry[]}
 */
function resolveAll(publications) {
  /** @type {Map<string, Publication>} */
  const byDoi = new Map(publications.flatMap((p) => (p.doi ? [[p.doi.toLowerCase(), p]] : [])));
  const seen = new Map();
  return CV_ENTRIES.map((source) => {
    const entry = resolveOne(source, byDoi);
    const stem = `${entry.type}-${entry.year ?? "undated"}-${slugify(entry.title)}`;
    const n = (seen.get(stem) ?? 0) + 1;
    seen.set(stem, n);
    const id = n === 1 ? stem : `${stem}-${n}`;
    const search = foldText(
      [
        entry.title,
        ...entry.meta,
        entry.note ?? "",
        entry.when,
        ...(entry.paper ? entry.paper.authors : []),
        ...entry.duties.flatMap((d) => [d.heading, ...d.items]),
      ].join(" "),
    );
    return { ...entry, id, search };
  });
}

/**
 * @param {Publication[]} publications the published records, from the build (scripts/lib/publications.mjs) or
 *   the generated records file the CV page imports (app/lib/cv/current.ts)
 */
export function buildCv(publications) {
  return {
    edition: CV_EDITION,
    person: CV_PERSON,
    presentations: CV_PRESENTATIONS,
    entries: resolveAll(publications),
  };
}

/** @typedef {ReturnType<typeof buildCv>} Cv */

/**
 * What filtering reads from each entry (app/lib/cv/view.mjs). The search text also carries the type,
 * role and area labels the page prints beside the entry, so a word a reader can see is a word the
 * search finds, on the server and in the browser alike.
 *
 * @param {CvEntry[]} entries
 * @returns {import("./view.mjs").Facts[]}
 */
export function cvFacts(entries) {
  return entries.map((e, order) => ({
    id: e.id,
    type: e.type,
    section: e.section,
    areas: e.areas,
    role: e.role,
    year: e.year,
    endYear: e.endYear,
    students: e.students,
    cohort: e.cohort,
    amount: e.amount,
    order,
    search: foldText(
      [e.search, typeLabel(e.type), e.role ? roleLabel(e.role) : "", ...e.areas.map(areaLabel)].join(" "),
    ),
  }));
}
