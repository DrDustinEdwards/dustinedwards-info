// The one judgement of content/llms.txt, shared by check:machine-readable (scripts/machine-readable/llms.mjs)
// and the save (app/lib/llms/save.server.ts), so a file CI passes is the file a save accepts
// (docs/LLMS.md). Pure: the caller supplies what the file is judged against.

/** The repository file, which is the source (hard rule 18). */
export const LLMS_PATH = "content/llms.txt";

/** The `settings` row /llms.txt is served from: derived from the file, never edited by hand. */
export const LLMS_SETTING_KEY = "llms.txt";

/** Every /llms.txt response carries it, and a save purges it (app/routes/llms.ts). */
export const LLMS_CACHE_TAG = "llms";

/** The file's whole size, far above today's and far below anything a crawler would read to the end. */
export const LLMS_MAX_BYTES = 65_536;

/** A file shorter than this is the retired 247-byte virology seed, not the real document. */
const LLMS_MIN_BYTES = 200;

/**
 * What the file must document, as the exact text an agent is told. Each is a URL pattern or a header an
 * agent acts on, so a rewrite that drops one has taken a capability away from every agent that read it.
 */
export const LLMS_REQUIRED_MENTIONS = [
  "/llms-full.txt",
  "/writing/rss.xml",
  "/writing/feed.json",
  "/writing/<slug>.md",
  "Accept: text/markdown",
  "/research/publications/<doi-slug>/",
  "/research/publications/<doi-slug>.md",
  "/research/publications.bib",
  "/research/publications.ris",
  "/research/publications.json",
  "/colophon",
];

/*
 * The llmstxt.org shape: a page is a list item whose link carries an absolute URL, `- [Title](https://host/path): note`.
 * The collection hub /research/publications and the lab registry under /research/lab are routes and not content pages, so
 * they are not read as ones.
 */
const LISTED_PAGE =
  /^- \[[^\]]+\]\(https?:\/\/[^/\s)]+(?!\/research\/(?:publications|lab)\b)(\/(?:research|teaching|software|cv|terms)(?:\/[a-z0-9-]+)*)\)/gm;
const LISTED_TWIN = /^- \[[^\]]+\]\(https?:\/\/[^/\s)]+(\/research\/publications\/[a-z0-9-]+\.md)\)/gm;

/** The page paths the file lists, one per list link. @param {string} text */
function listedPagePaths(text) {
  return new Set([...text.matchAll(LISTED_PAGE)].map((m) => m[1] ?? ""));
}

/** The paper twin URLs the file lists, as paths, one per list link. @param {string} text */
export function listedPaperTwins(text) {
  return new Set([...text.matchAll(LISTED_TWIN)].map((m) => m[1] ?? ""));
}

/**
 * Listed twins no paper produces: the one rule check:machine-readable's twin gate and a save share. A paper
 * added later is not in the list until it is written there, so the reverse is not a rule.
 *
 * @param {string} text
 * @param {Iterable<string>} twinUrls the `/research/publications/<slug>.md` URLs the corpus produces
 */
export function overAdvertisedTwins(text, twinUrls) {
  const known = new Set(twinUrls);
  return [...listedPaperTwins(text)].filter((url) => !known.has(url));
}

/**
 * @typedef {{ name: string, ok: boolean, detail?: string }} LlmsCheck
 *
 * @param {string} text the whole file
 * @param {{
 *   pagePaths: readonly string[],
 *   origin: string,
 *   findWideDashes: (text: string) => Array<{ line: number, char: string, excerpt: string }>,
 *   twinUrls?: Iterable<string>,
 * }} options pagePaths is every Research, Teaching and Software path, the procedures' included; twinUrls
 *   is every paper twin the corpus produces, left out where the corpus is judged elsewhere
 * @returns {LlmsCheck[]} every rule, passed or failed, in the order they read
 */
export function llmsChecks(text, { pagePaths, origin, findWideDashes, twinUrls }) {
  /** @type {LlmsCheck[]} */
  const checks = [];
  /** @param {string} name @param {boolean} ok @param {string} [detail] */
  const check = (name, ok, detail) => checks.push({ name, ok, detail: ok ? undefined : detail });

  const bytes = new TextEncoder().encode(text).length;
  check("llms.txt is not empty", bytes > 0, "the file is empty");
  check(
    "llms.txt is long enough to be the real document",
    bytes > LLMS_MIN_BYTES,
    `Only ${bytes} bytes. The retired virology seed was 247 bytes; the real document is far longer, so a ` +
      "short file here is the stale copy.",
  );
  check(
    `llms.txt is at most ${LLMS_MAX_BYTES} bytes`,
    bytes <= LLMS_MAX_BYTES,
    `${bytes} bytes. An agent reads this file first and whole; a file this long is no longer a map.`,
  );
  check(
    "llms.txt is LF-only",
    !text.includes("\r"),
    "It is pinned to LF in .gitattributes. CR here would sync CRLF into D1.",
  );
  check("llms.txt ends with a newline", text.endsWith("\n"), "the last byte is not a newline");
  check(
    "llms.txt opens with its H1 title",
    text.startsWith("# dustinedwards.info\n"),
    'the first line must be "# dustinedwards.info", as agents read the first heading as the site name',
  );

  // What PageSpeed's agent-discoverability audit reads: the summary, and links it can follow.
  check(
    "llms.txt has a blockquote summary under its title",
    /^# [^\n]+\n\n> \S/.test(text),
    'the llmstxt.org format puts a "> summary" line after the H1 and one blank line',
  );
  const relative = [...text.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);
  check(
    "every markdown link in llms.txt is absolute",
    relative.length === 0,
    `relative link(s): ${relative.slice(0, 5).join(", ")}. A crawler reading the file alone has no origin to resolve them against.`,
  );

  const dashes = findWideDashes(text);
  check(
    "llms.txt has no wide dash",
    dashes.length === 0,
    dashes
      .slice(0, 5)
      .map((d) => `line ${d.line} ${d.char}: ${d.excerpt}`)
      .join("; ") + "; use a comma, period, parentheses or colon",
  );

  const missing = LLMS_REQUIRED_MENTIONS.filter((mention) => !text.includes(mention));
  check(
    `llms.txt documents the ${LLMS_REQUIRED_MENTIONS.length} URL patterns and headers an agent acts on`,
    missing.length === 0,
    `absent: ${missing.join(", ")}`,
  );

  // Both ways, derived from the list the routes and the sitemap read: a page missing here is a page an
  // agent is not told about, twin or not.
  const listed = listedPagePaths(text);
  const unlisted = pagePaths.filter((path) => !listed.has(path));
  check(
    `llms.txt lists every Research, Teaching and Software page (${pagePaths.length})`,
    unlisted.length === 0,
    `absent from ${LLMS_PATH}: ${unlisted.join(", ")}`,
  );
  const known = new Set(pagePaths);
  const stray = [...listed].filter((path) => !known.has(path));
  check(
    "llms.txt lists no Research, Teaching or Software page that is neither in CONTENT_PAGE_PATHS nor a procedure",
    stray.length === 0,
    `listed but not a page: ${stray.join(", ")}`,
  );

  if (twinUrls) {
    const over = overAdvertisedTwins(text, twinUrls);
    check(
      "llms.txt lists no paper twin the corpus does not produce",
      over.length === 0,
      `advertised with no paper: ${over.join(", ")}`,
    );
  }

  // A tracked text file cannot import SITE_ORIGIN, so this binds its contact line to it. At DNS cutover
  // it goes red until llms.txt follows, which is the point.
  const contact = (text.match(/## Contact\s*\n\s*\n(?:- \[[^\]]*\]\()?(https?:\/\/[^\s)]+)/) ?? [])[1] ?? "";
  check(
    "llms.txt has a contact URL to compare",
    contact.startsWith("https://"),
    `parsed ${JSON.stringify(contact)} from the Contact section`,
  );
  check(
    "the llms.txt contact URL is SITE_ORIGIN",
    contact === origin,
    `llms.txt says ${contact} and SITE_ORIGIN is ${origin}. The file crawlers read points somewhere this ` +
      "site is not served from.",
  );

  return checks;
}

/**
 * The messages of every failed rule, or an empty list: what a save refuses with.
 *
 * @param {LlmsCheck[]} checks
 */
export function llmsErrors(checks) {
  return checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`);
}
