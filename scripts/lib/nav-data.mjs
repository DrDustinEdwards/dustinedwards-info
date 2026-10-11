// The facts the header's panels show that come from the repository's content: the newest paper, the posts
// (for the Writing panel, its tags and its series), which libraries have an entry, and the lab's town. Read from the markdown sources
// (content/posts, content/publications, content/cv), never from a database, because the header is on every page
// and this plane does not hydrate (CLAUDE.md rule 18: the repository is the source). build-nav-data writes the
// result to app/lib/nav-data.generated.mjs, which app/lib/nav.ts imports. build:content and the install step
// both call it, the same way they call the identity build.
//
// Posts carry their publish instant so the header can leave out a scheduled post until its time has come, by
// the same test the listings use (status published, publish_at null or past); drafts never enter the file.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";

import { decodeEntities } from "../../app/lib/publications/entities.mjs";
import { recordFromData } from "../../app/lib/publications/record.mjs";
import { SHOWCASE_TYPES } from "../../app/lib/publications/listing.mjs";
import { readIdentity } from "./identity.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const POSTS_DIR = path.join(ROOT, "content", "posts");
const PUBLICATIONS_DIR = path.join(ROOT, "content", "publications");
const CV_DIR = path.join(ROOT, "content", "cv");
const PROCEDURES_DIR = path.join(ROOT, "content", "procedures");
export const NAV_DATA_PATH = path.join(ROOT, "app", "lib", "nav-data.generated.mjs");

/** The longest first line a spotlight carries. */
export const FIRST_LINE_MAX = 160;

/**
 * The first line of a post's prose: its first paragraph of plain text, in its first sentence, with the
 * markdown marks taken off. Headings, directives, lists, tables, quotes, images and raw HTML are not prose
 * and are skipped. Cut at a word when it runs past FIRST_LINE_MAX.
 *
 * @param {string} body
 * @returns {string}
 */
export function firstLineOf(body) {
  for (const block of body.split(/\r?\n\s*\r?\n/)) {
    const text = block.trim();
    if (text === "" || /^(#|:::|!|<|>|\||-|\*|`|\$|\d+[.)]\s)/.test(text)) continue;
    const plain = text
      .replace(/\s*\r?\n\s*/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]+/g, "")
      .trim();
    if (plain === "") continue;
    const sentence = plain.split(/(?<=[.!?])\s+/)[0] ?? plain;
    if (sentence.length <= FIRST_LINE_MAX) return sentence;
    const cut = sentence.slice(0, FIRST_LINE_MAX - 3);
    return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length)}...`;
  }
  return "";
}

/** @param {unknown} value @returns {string} an ISO day */
const day = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? ""));

/**
 * Every post that is not a draft, newest first (publish instant, then slug descending: the listings break a tie by row id, and rows are inserted in slug order).
 *
 * @param {string} [dir]
 */
export function readPosts(dir = POSTS_DIR) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const { data, content } = matter(readFileSync(path.join(dir, name), "utf8"), {});
      const date = day(data.date);
      const publishAt = data.publish_at ? new Date(data.publish_at).toISOString() : `${date}T00:00:00.000Z`;
      return {
        draft: data.draft === true,
        slug: String(data.slug),
        title: String(data.title),
        date,
        publishAt,
        firstLine: firstLineOf(content),
        series: typeof data.series === "string" ? data.series : null,
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      };
    })
    .filter((post) => !post.draft)
    .map(({ draft: _draft, ...post }) => post)
    .sort((a, b) => (a.publishAt === b.publishAt ? (a.slug < b.slug ? 1 : -1) : a.publishAt < b.publishAt ? 1 : -1));
}

/**
 * The newest paper the Publications page lists as published: its showcase types, not a submitted
 * manuscript, not a draft; newest by publication day, then by title.
 *
 * @param {string} [dir]
 */
export function readLatestPaper(dir = PUBLICATIONS_DIR) {
  const records = readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .flatMap((name) => {
      const { data } = matter(readFileSync(path.join(dir, name), "utf8"), {});
      if (data.draft === true) return [];
      const plain = JSON.parse(JSON.stringify(data, (_key, value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value)));
      const record = recordFromData(plain, name.slice(0, -3));
      return SHOWCASE_TYPES.has(record.type) && record.stage === "published" ? [record] : [];
    });
  records.sort((a, b) => {
    const x = a.publishedDate ?? `${a.year}-01-01`;
    const y = b.publishedDate ?? `${b.year}-01-01`;
    if (x !== y) return x < y ? 1 : -1;
    return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
  });
  const top = records[0];
  if (!top) throw new Error("content/publications has no published paper for the Research panel's Latest paper");
  return {
    slug: top.slug,
    title: decodeEntities(top.title),
    journal: top.journal ? decodeEntities(top.journal) : null,
    year: top.year,
  };
}

/**
 * The town of the lab: the newest appointment at the current university that states one ("..., Stephenville, TX, ...").
 *
 * @param {string} university
 * @param {string} [dir]
 */
export function readLabPlace(university, dir = CV_DIR) {
  const { data } = matter(readFileSync(path.join(dir, "appointments.md"), "utf8"), {});
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const mine = entries
    .filter((e) => typeof e.org === "string" && e.org.includes(university))
    .sort((a, b) => Number(b.year) - Number(a.year));
  for (const entry of mine) {
    const place = /,\s*([A-Z][A-Za-z.' ]+,\s*[A-Z]{2})\b/.exec(entry.org)?.[1];
    if (place) return place;
  }
  throw new Error(`content/cv/appointments.md names no town for ${university}, so the About panel's lab has no place`);
}

/**
 * How many published procedures each profile has. A library with none is not a page: Recipes and Software how-tos
 * answer 404 to the public until their first entry is published (app/routes/kb-library.tsx), so the panels leave
 * their links out until then.
 *
 * @param {string} [dir]
 * @returns {Record<string, number>}
 */
export function readLibraryCounts(dir = PROCEDURES_DIR) {
  /** @type {Record<string, number>} */
  const counts = { protocol: 0, recipe: 0, computational: 0 };
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".md"))) {
    const { data } = matter(readFileSync(path.join(dir, name), "utf8"), {});
    if (data.draft === true || typeof data.profile !== "string") continue;
    counts[data.profile] = (counts[data.profile] ?? 0) + 1;
  }
  return counts;
}

export function readNavData() {
  const identity = readIdentity();
  return {
    latestPaper: readLatestPaper(),
    posts: readPosts(),
    libraries: readLibraryCounts(),
    lab: { department: identity.department, university: identity.affiliation, place: readLabPlace(identity.affiliation) },
  };
}

/** @param {ReturnType<typeof readNavData>} data */
export function navDataModule(data) {
  return (
    "// Generated by scripts/build-nav-data.mjs from content/posts, content/publications and content/cv. Do not edit:\n" +
    "// change the content, and build:content (or the next install) writes this again. See scripts/lib/nav-data.mjs.\n" +
    `export const NAV_DATA = Object.freeze(${JSON.stringify(data, null, 2)});\n`
  );
}

/** Writes the module, and only when it changed. */
export function writeNavData() {
  const data = readNavData();
  const text = navDataModule(data);
  let before = "";
  try {
    before = readFileSync(NAV_DATA_PATH, "utf8");
  } catch {
    mkdirSync(path.dirname(NAV_DATA_PATH), { recursive: true });
  }
  if (before !== text) writeFileSync(NAV_DATA_PATH, text, "utf8");
  return { data, changed: before !== text };
}
