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
import { newestFirst } from "../../app/lib/post-order.mjs";
import { frontmatterSchema } from "../../app/lib/content/pipeline.mjs";
import { plainText } from "../../app/lib/search/records.mjs";
import { readIdentity } from "./identity.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const POSTS_DIR = path.join(ROOT, "content", "posts");
const PUBLICATIONS_DIR = path.join(ROOT, "content", "publications");
const CV_DIR = path.join(ROOT, "content", "cv");
const PROCEDURES_DIR = path.join(ROOT, "content", "procedures");
const PAGES_DIR = path.join(ROOT, "content", "pages");
export const NAV_DATA_PATH = path.join(ROOT, "app", "lib", "nav-data.generated.mjs");

/** The longest first line a spotlight carries. */
export const FIRST_LINE_MAX = 160;

/** A block that is not prose: heading, directive, fence, image, raw HTML, quote, table, list or math. */
const NOT_PROSE = /^(#|:::|```|~~~|!\[|<|>|\||\$|[-+*]\s|\d+[.)]\s)/;

/**
 * The first line of a post's prose: its first paragraph of plain text, in its first sentence. The block is
 * chosen here (headings, directives, lists and the rest are not prose) and its marks are taken off by the
 * search index's own plainText (app/lib/search/records.mjs), so emphasis, links and footnote markers read as
 * they do there. Cut at a word when it runs past FIRST_LINE_MAX.
 *
 * @param {string} body
 * @returns {string}
 */
export function firstLineOf(body) {
  for (const block of body.split(/\r?\n\s*\r?\n/)) {
    const text = block.trim();
    if (text === "" || NOT_PROSE.test(text)) continue;
    const plain = plainText(text);
    if (plain === "") continue;
    const sentence = plain.split(/(?<=[.!?])\s+/)[0] ?? plain;
    if (sentence.length <= FIRST_LINE_MAX) return sentence;
    const cut = sentence.slice(0, FIRST_LINE_MAX - 3);
    return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length)}...`;
  }
  return "";
}

/**
 * Every post that is not a draft, newest first. A file's front matter is judged by the same schema the build
 * and the editor use (frontmatterSchema) and its publish instant by the same rule (`publish_at`, else the date
 * at midnight UTC, as renderPost states it), so a bad file cannot give the header a different post than the
 * site has. A file that fails is left out and named in `problems`, for a gate to report; the build goes on.
 *
 * Order: the listings' rule (app/lib/post-order.mjs): publish instant descending; posts sharing an instant
 * and a series, latest part first; otherwise the later row first. The listings break that last tie by row id,
 * the rows are inserted in the build artifact's order (slug ascending), and a build cannot see ids, so slug
 * descending stands in for it (test/nav.test.mjs pins the result against the artifact).
 *
 * @param {string} [dir]
 * @param {string[]} [problems] filled with one line per file that did not parse
 */
export function readPosts(dir = POSTS_DIR, problems = []) {
  const posts = readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .flatMap((name) => {
      const { data, content } = matter(readFileSync(path.join(dir, name), "utf8"), {});
      const parsed = frontmatterSchema.safeParse(data);
      if (!parsed.success) {
        problems.push(`${name}: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"} ${i.message}`).join("; ")}`);
        return [];
      }
      const fm = parsed.data;
      if (fm.draft) return [];
      return [
        {
          slug: fm.slug,
          title: fm.title,
          date: fm.date,
          publishAt: new Date(fm.publish_at ?? `${fm.date}T00:00:00.000Z`).toISOString(),
          firstLine: firstLineOf(content),
          series: fm.series ?? null,
          part: fm.part ?? null,
          tags: fm.tags,
        },
      ];
    });
  return newestFirst(posts, (post) => post.slug);
}

/**
 * The newest paper the Publications page lists as published: its showcase types, not a submitted
 * manuscript, not a draft; newest by publication day, then by title.
 *
 * Null when there is none, or when a file cannot be read as a record (named in `problems`): the Research panel
 * then has no spotlight and the install goes on; navDataProblems says why, and a test fails on it.
 *
 * @param {string} [dir]
 * @param {string[]} [problems]
 */
export function readLatestPaper(dir = PUBLICATIONS_DIR, problems = []) {
  const records = readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .flatMap((name) => {
      try {
        const { data } = matter(readFileSync(path.join(dir, name), "utf8"), {});
        if (data.draft === true) return [];
        const plain = JSON.parse(JSON.stringify(data, (_key, value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value)));
        const record = recordFromData(plain, name.slice(0, -3));
        return SHOWCASE_TYPES.has(record.type) && record.stage === "published" ? [record] : [];
      } catch (error) {
        problems.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    });
  records.sort((a, b) => {
    const x = a.publishedDate ?? `${a.year}-01-01`;
    const y = b.publishedDate ?? `${b.year}-01-01`;
    if (x !== y) return x < y ? 1 : -1;
    return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
  });
  const top = records[0];
  if (!top) return null;
  return {
    slug: top.slug,
    title: decodeEntities(top.title),
    journal: top.journal ? decodeEntities(top.journal) : null,
    year: top.year,
  };
}

/**
 * The town of the lab: the newest appointment at the current university that states one ("..., Stephenville, TX, ...").
 * Null when none does (the About spotlight then names the university alone).
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
  return null;
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

/**
 * The front matter `description` of every page under /teaching/, by path, read from content/pages (the field the
 * page's meta description uses). The Teaching panel's course tiles take their line from here by their own address,
 * so the tiles name the courses once, in app/lib/nav.ts, and test/nav.test.mjs fails a tile whose page has no
 * description. A page without one is left out.
 *
 * @param {string} [dir]
 * @returns {Record<string, string>}
 */
export function readTeachingDescriptions(dir = PAGES_DIR) {
  /** @type {Record<string, string>} */
  const found = {};
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".md")).sort()) {
    const { data } = matter(readFileSync(path.join(dir, name), "utf8"), {});
    if (typeof data.path === "string" && data.path.startsWith("/teaching/") && typeof data.description === "string" && data.description.trim() !== "") {
      found[data.path] = data.description.trim();
    }
  }
  return found;
}

/**
 * What the build had to leave out, for the gate to report (test/nav.test.mjs): posts that fail the front matter
 * schema, a paper file that cannot be read, no published paper, no town for the lab. The build itself only warns.
 *
 * @returns {string[]}
 */
export function navDataProblems() {
  /** @type {string[]} */
  const problems = [];
  readPosts(POSTS_DIR, problems);
  if (readLatestPaper(PUBLICATIONS_DIR, problems) === null) problems.push("content/publications has no published paper for the Research panel's Latest paper");
  if (readLabPlace(readIdentity().affiliation) === null) problems.push("content/cv/appointments.md names no town for the university, so the About spotlight has no place");
  return problems;
}

export function readNavData() {
  const identity = readIdentity();
  return {
    latestPaper: readLatestPaper(),
    posts: readPosts(),
    libraries: readLibraryCounts(),
    courses: readTeachingDescriptions(),
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
