// Reads the repository's own content/ (markdown and JSON in git) and returns plain objects.
// Nothing here is typed by hand: every number the prototype shows is read or computed from content/.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const C = (...p) => join(ROOT, "content", ...p);

export function splitFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text };
  return { data: YAML.parse(m[1]) ?? {}, body: m[2] };
}
const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
export const unent = (s) => (typeof s === "string" ? s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENT[m]) : s);
const readMd = (file) => splitFrontMatter(readFileSync(file, "utf8"));
const dirMd = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ slug: f.replace(/\.md$/, ""), ...readMd(join(dir, f)) }));

// ---------- CV ----------
const cv = Object.fromEntries(dirMd(C("cv")).map((x) => [x.slug, x.data]));

const positions = cv.appointments.entries.filter((e) => e.section === "Positions");
const admin = cv.appointments.entries.filter((e) => e.section !== "Positions");
const currentAdmin = admin.filter((e) => e.endYear === "present").map((e) => e.title);
const person = cv.profile.person;

export const identity = {
  name: person.name,
  degree: person.degree,
  discipline: person.discipline,
  disciplineLower: person.discipline.toLowerCase(),
  rank: positions[0].title,
  adminTitle: currentAdmin[0],
  department: person.department,
  departmentSubject: person.department.replace(/^Department of /, ""),
  org: person.org,
  affiliation: person.org.split(",")[0],
  joined: Math.min(...positions.filter((p) => /Tarleton/.test(p.org)).map((p) => p.year)),
  town: "Stephenville, Texas",
};

// ---------- Phages ----------
export const phages = dirMd(C("phages"))
  .map(({ slug, data }) => ({
    slug,
    name: data.name,
    year: data.year,
    host: data.host,
    county: data.county,
    phagesdb: data.phagesdb,
    paper: data.paper ?? null,
    formerly: data.formerly ?? null,
    bp: data.genome_bp ?? null,
    genes: data.genes ?? null,
  }))
  .sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));

export const HOSTS = {
  smegmatis: { label: "M. smegmatis", full: "Mycobacterium smegmatis" },
  foliorum: { label: "M. foliorum", full: "Microbacterium foliorum" },
};
export const phageYears = [...new Set(phages.map((p) => p.year))].sort();

// ---------- Publications ----------
const citedBy = JSON.parse(readFileSync(join(ROOT, "data", "publications.cited-by.json"), "utf8"));
export const citedByFetchedAt = citedBy.fetchedAt;
export const TOPICS = {
  "human-simian-retroviruses": "Human and simian retroviruses",
  "avian-retroviruses": "Avian retroviruses",
  bacteriophages: "Bacteriophages",
  "science-education": "Science education",
};
export const publications = dirMd(C("publications"))
  .filter(({ data }) => data.draft !== true)
  .map(({ slug, data }) => {
    const doiKey = String(data.doi ?? "").toLowerCase();
    const cb = Object.entries(citedBy.works).find(([k]) => k.toLowerCase() === doiKey)?.[1];
    return {
      slug,
      doi: data.doi,
      title: unent(data.title),
      authors: data.authors ?? [],
      journal: unent(data.journal ?? data.venue ?? data["container-title"] ?? ""),
      date: data.publishedDate ?? data.date ?? null,
      year: Number(data.year ?? String(data.publishedDate ?? "").slice(0, 4)),
      volume: data.volume ?? null,
      issue: data.issue ?? null,
      pages: data.pages ?? null,
      type: data.type,
      topics: data.topics ?? [],
      summary: unent(data.summary ?? ""),
      abstract: unent(data.abstract ?? ""),
      pmid: data.pmid ?? null,
      pmcid: data.pmcid ?? null,
      pmcUrl: data.pmcUrl ?? null,
      license: data.license ?? null,
      openAccess: data.isOpenAccess ?? null,
      pdf: data.pdfPath ?? null,
      accessions: data.accessions ?? [],
      citedBy: cb ? cb.total : null,
      citing: cb ? cb.citing : [],
    };
  })
  .sort((a, b) => b.year - a.year || String(b.date).localeCompare(String(a.date)));

// ---------- Posts ----------
export const posts = dirMd(C("posts"))
  .filter(({ data }) => data.draft !== true)
  .map(({ slug, data, body }) => ({
    slug,
    title: data.title,
    description: data.description,
    date: String(data.date).slice(0, 10),
    tags: data.tags ?? [],
    series: data.series ?? null,
    part: data.part ?? null,
    audience: data.assumed_audience ?? null,
    takeaways: data.key_takeaways ?? [],
    body,
    words: body.replace(/```[\s\S]*?```/g, "").split(/\s+/).filter(Boolean).length,
  }))
  .sort((a, b) => b.date.localeCompare(a.date) || (b.part ?? 0) - (a.part ?? 0));

// ---------- Pages, procedures, projects ----------
export const pages = Object.fromEntries(dirMd(C("pages")).map((p) => [p.slug, p]));
export const procedures = dirMd(C("procedures"))
  .map(({ slug, data }) => ({ slug, title: data.title, description: data.description, order: data.start_here ?? 99, path: data.path }))
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
export const projects = JSON.parse(readFileSync(C("projects.json"), "utf8")).projects;

export { cv };

// ---------- Template variables used by content/pages ----------
export function resolveTemplate(text) {
  const vars = {
    "phages.count": phages.length,
    "phages.firstYear": phageYears[0],
    "phages.lastYear": phageYears.at(-1),
  };
  for (const h of Object.keys(HOSTS)) {
    const list = phages.filter((p) => p.host === h);
    vars[`phages.host.${h}.count`] = list.length;
    const ys = [...new Set(list.map((p) => p.year))];
    vars[`phages.host.${h}.years`] = ys.length === 1 ? ys[0] : `${ys[0]} to ${ys.at(-1)}`;
  }
  for (const p of phages) {
    vars[`phage.${p.slug}.county`] = p.county;
    vars[`phage.${p.slug}.bp`] = p.bp?.toLocaleString("en-US");
    vars[`phage.${p.slug}.genes`] = p.genes;
  }
  for (const [k, v] of Object.entries(identity)) vars[`identity.${k}`] = v;
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => (vars[k] ?? m));
}
