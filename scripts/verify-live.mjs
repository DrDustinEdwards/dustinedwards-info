/**
 * Live verification against the deployed Worker.
 *
 *   node scripts/verify-live.mjs [origin]
 *
 * OBSERVATION BOUNDARY: it sees ONE cache state, whichever exists when it runs,
 * and it is normally run seconds after a deploy. The Worker version is part of
 * the cache key, so a deploy empties the cache and every assertion below is
 * answered by the Worker itself. It cannot see a bug that only appears once an
 * entry is WARM unless it is run twice, which is not automatic.
 *
 * Not a gate: it needs the network and a deploy, so it is not in the check
 * family. It exists so a deploy is verified by running assertions rather than
 * by looking at a page and feeling reassured.
 *
 * ## The cold-cache blind spot, recorded because it cost four sessions
 *
 * Enabling Workers Cache on 2026-08-02 made the theme cookie invisible to the
 * cache key, so `/blog` served whichever theme filled the entry. This file
 * asserts the theme persists and DID NOT CATCH IT for four consecutive
 * sessions, because it always ran within seconds of a deploy and therefore
 * always against a cold cache. Every run was answered by the Worker, which was
 * correct the whole time.
 *
 * The tell, when it finally appeared, was that the failure count MOVED between
 * runs: 79/17, then 95/1, then 96/0. A deterministic failure does not do that.
 * **If this file's count varies run to run, suspect the cache before the diff.**
 *
 * RUN IT TWICE after any change to caching or to a `headers` export: once cold,
 * once warm. Passing cold means the Worker is right, which is a smaller claim
 * than it looks.
 *
 * Harness rules, every one learned the hard way on this site:
 *   - Send a browser user-agent. Cloudflare answers 403 error 1010 to some
 *     default clients on this hostname.
 *   - Send Cache-Control: no-cache, and treat an unchanged byte count after a
 *     deploy as a stale read rather than a failed deploy.
 *   - Scope every content assertion to the region that proves it. A check for
 *     "did this query return the post" once passed against a zero-result page,
 *     because the zero state renders a "Recent writing" list carrying the same
 *     link.
 *   - Never bake a content hash into a check. Asset names change.
 *   - React SSR inserts <!-- --> between adjacent text nodes, so comments are
 *     stripped before matching rendered output.
 *   - SSR also ESCAPES. An apostrophe becomes &#x27;, so prose taken from a data
 *     file needs entities decoded before matching, not only comments stripped.
 *     Cost five red runs against a correct page before it was noticed, and the
 *     failure read as missing content rather than as a harness bug.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The listing shape the site itself uses. Imported, never restated: this
// harness deriving its own copy of the page size is exactly the staleness the
// pagination assertions below were ruled against.
import {
  POSTS_PER_PAGE,
  pageCount,
  pageForPosition,
} from "../app/lib/blog-listing.mjs";

// The colophon's section list, IMPORTED for the reason POSTS_PER_PAGE is. The
// completeness sweep in section 12b matches each section's descriptor lead
// against the rendered page, and a copy of those leads here would be a third
// mirror to go stale, asserting what this harness remembers rather than what
// the index carries.
import { COLOPHON_SECTIONS } from "../app/lib/colophon-sections.mjs";
// The fact needles, and the `statusLabel` call that used to be made here.
import { colophonFacts } from "./lib/colophon-facts.mjs";
// The walk and the stem rule come from the offline gate, never restated: the
// wire assertion in section 16 must compare against the same set the ceilings
// were measured over, or the two halves drift into asserting different pages.
import { chunkStem } from "./check-page-payload.mjs";
import { stripComments } from "./lib/strip-comments.mjs";

// The card key, DERIVED with the same function the sync and the uploader use.
// A literal key here survived exactly until the day the hash set changed; see
// the media-cache block for what it cost.
import { ogImageKey } from "../app/lib/content/pipeline.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/*
 * The colophon's two data files, READ rather than restated. This harness
 * listing its own copy of the bindings or the features would be a third mirror
 * to go stale, and the whole point of those assertions is that what the page
 * renders matches what the artifact carries.
 *
 * `readFileSync` rather than an import attribute: `with { type: "json" }` is
 * only legal under a newer `module` setting than this repo's tsconfig uses, and
 * it fails the typecheck rather than the run.
 */
const stack = JSON.parse(
  readFileSync(join(root, "content", "generated", "stack.json"), "utf8"),
);
const features = JSON.parse(
  readFileSync(join(root, "content", "features.json"), "utf8"),
);
const ORIGIN = process.argv[2] ?? "https://dustinedwards.dustin-edwards.workers.dev";
const SLUG = "where-should-a-blog-store-its-words";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

let passed = 0;
/** @type {string[]} */
const failures = [];

/** @param {string} label @param {boolean} ok @param {string} [detail] */
function check(label, ok, detail = "") {
  if (ok) passed += 1;
  else failures.push(`${label}${detail ? `\n      ${detail}` : ""}`);
}

/** @param {string} path @param {Record<string,string>} [headers] */
async function get(path, headers = {}) {
  const res = await fetch(`${ORIGIN}${path}`, {
    headers: { "user-agent": UA, "cache-control": "no-cache", ...headers },
    redirect: "manual",
  });
  const text = res.headers.get("content-type")?.includes("image/") ? "" : await res.text();
  return { res, text, status: res.status };
}

/** SSR splices HTML comments between adjacent text nodes. */
/** @param {string} s */
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, "");

/**
 * Character references decoded, so prose from a data file can be matched
 * against rendered output.
 *
 * **The second transform SSR applies, and the one that is easy to forget.**
 * Stripping comments is already documented above; escaping is not, and it is the
 * same class of trap. React escapes `'` to `&#x27;`, so an assertion looking for
 * "Every form's submitted payload" in the HTML finds nothing while the page is
 * perfectly correct.
 *
 * Measured, not theorised: two of the thirty-eight colophon features carry an
 * apostrophe, and the completeness assertion below was RED against a correct
 * page in five consecutive runs before this existed. It reported "36 of 38",
 * which reads exactly like missing content rather than like a harness bug.
 *
 * @param {string} s
 */
const unescape = (s) =>
  s
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Ampersand LAST, or a double-escaped entity decodes into the wrong thing.
    .replace(/&amp;/g, "&");

console.log(`Verifying ${ORIGIN}\n`);

/* --- 1. Theme resolution, server rendered ------------------------------- */

/** @param {string} s */
const htmlTag = (s) => (s.match(/<html[^>]*>/) ?? [""])[0];

for (const [label, cookie, expected] of [
  ["no cookie renders no attribute (system)", "", null],
  ["theme=system renders no attribute", "theme=system", null],
  ["theme=dark renders the attribute", "theme=dark", "dark"],
  ["theme=light renders the attribute", "theme=light", "light"],
  ["a junk cookie degrades to system", "theme=../../etc", null],
]) {
  const { text, status } = await get("/", cookie ? { cookie } : {});
  const tag = htmlTag(text);
  const got = (tag.match(/data-theme="([a-z]+)"/) ?? [])[1] ?? null;
  check(`theme: ${label}`, status === 200 && got === expected, `got ${status} ${tag}`);
}

// The anti-flash claim, stated as an assertion rather than a belief: if no
// script sets the attribute, there is no frame in which it can be wrong.
{
  const { text } = await get("/");
  const head = text.slice(0, text.indexOf("</head>") + 7);
  const inlineSetsTheme = /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?data-theme[\s\S]*?<\/script>/.test(head);
  check("theme: no inline script sets data-theme (nothing to flash)", !inlineSetsTheme);
}

/* --- 2. Theme persists across navigation ------------------------------- */

for (const path of ["/", "/blog", `/blog/${SLUG}`, "/search?q=blog"]) {
  const { text, status } = await get(path, { cookie: "theme=dark" });
  const got = (htmlTag(text).match(/data-theme="([a-z]+)"/) ?? [])[1] ?? null;
  check(`theme persists on ${path}`, status === 200 && got === "dark", `got ${status} ${got}`);
}

/* --- 3. The shipped stylesheet carries the v3 palette ------------------- */

{
  /*
   * TWO PLANES, TWO STYLESHEETS, SINCE 2026-08-23.
   *
   * This block used to take the FIRST `/assets/*.css` linked on `/` and treat
   * it as "the stylesheet". That was true while `app.css` imported all sixteen
   * parts. The admin sheets then moved to `app/admin.css`, and the very next
   * run failed on `css: .btn-danger uses --fill-danger`, because that rule
   * lives in `admin-posts.css` and had left the public bundle. The instrument
   * was right to fail: it was asserting a property of a file it could no
   * longer see.
   *
   * FOURTH INSTANCE OF ONE CLASS IN A SINGLE CHANGE. `check:contrast`,
   * `check:logo` (through `stylesheetPaths`) and
   * `test/code-block-padding.test.mjs` all narrowed the same way, all failed
   * rather than passing, and all are repaired the same way: follow every
   * stylesheet the site actually serves.
   *
   * `/login` is where the admin bundle is reachable WITHOUT a session, which is
   * what makes this checkable from here at all. It is unauthenticated by design
   * and links both sheets.
   *
   * ## EACH PROPERTY IS ASSERTED WHERE IT BELONGS, IN BOTH DIRECTIONS
   *
   * Concatenating the two and asserting against the union would pass, and would
   * stop distinguishing "the tokens reach every reader" from "the tokens exist
   * somewhere". The palette must be in the PUBLIC sheet; `.btn-danger` must be
   * in the ADMIN one and must NOT have drifted back into the public bundle,
   * because a rule that reappears there is weight every reader pays for and
   * nothing else would notice.
   */
  const { text: home } = await get("/");
  const publicHref = (home.match(/href="(\/assets\/[^"]+\.css)"/) ?? [])[1];
  check("css: a stylesheet is linked on /", Boolean(publicHref), home.slice(0, 200));

  const { text: login } = await get("/login");
  const loginHrefs = [...login.matchAll(/href="(\/assets\/[^"]+\.css)"/g)].map((m) => m[1]);
  const adminHref = loginHrefs.find((h) => h !== publicHref);

  /*
   * SCOPE, before anything is read. Two DISTINCT stylesheets have to be found
   * or every assertion below is being made about a corpus nobody has proven
   * non-empty, and a split that quietly collapsed back into one bundle would
   * look identical to a healthy one.
   */
  check(
    "css: /login links the public stylesheet and a second, admin one",
    Boolean(adminHref) && loginHrefs.includes(publicHref),
    `linked: ${loginHrefs.join(", ") || "(none)"}`,
  );
  check(
    "css: / does NOT link the admin stylesheet",
    Boolean(adminHref) && !home.includes(adminHref ?? " "),
    "the admin bundle is back on the public plane, which is the split undone",
  );

  if (publicHref && adminHref) {
    const { text: css, status } = await get(publicHref);
    check("css: public stylesheet fetches", status === 200);
    const { text: adminCss, status: adminStatus } = await get(adminHref);
    check("css: admin stylesheet fetches", adminStatus === 200);
    check(
      "css: the admin stylesheet is not empty",
      adminCss.length > 10000,
      `${adminCss.length} bytes`,
    );

    // v3 values, read from the doc rather than from our own source file. These
    // are TOKENS and they are asserted on the PUBLIC sheet, because a token
    // that only reaches the admin plane has not shipped.
    for (const [label, needle] of [
      ["dark sage locked to #93B29B", "93b29b"],
      ["dark body text #E3DBD0", "e3dbd0"],
      ["dark heading #EDE6DC", "ede6dc"],
      ["light bg caliche #FAF7F2", "faf7f2"],
      ["dark bg prairie night #1A1614", "1a1614"],
      ["prefers-contrast tier present", "prefers-contrast"],
      ["forced-colors policy present", "forced-colors"],
      ["prefers-contrast light muted #4A423A", "4a423a"],
      ["prefers-contrast dark muted #C6BDAF", "c6bdaf"],
      ["mark is prairie gold #F3E3B8", "f3e3b8"],
      ["danger fill #8E1024", "8e1024"],
    ]) {
      check(`css: ${label}`, css.toLowerCase().includes(needle) === true);
    }

    // Rule 2 and the delete button, asserted on the shipped bytes.
    check(
      "css: base anchor rule underlines",
      /a\{[^}]*text-decoration:underline/.test(css),
    );
    /*
     * `.btn-danger` IS ADMIN-PLANE NOW, and both halves are asserted. The
     * positive proves the delete button still reads its fill from the token;
     * the negative proves the admin bundle has not leaked back into the sheet
     * every public reader downloads.
     */
    check(
      "css: .btn-danger uses --fill-danger, in the admin stylesheet",
      /\.btn-danger\{[^}]*background:var\(--fill-danger\)/.test(adminCss),
    );
    check(
      "css: .btn-danger is NOT in the public stylesheet",
      !/\.btn-danger\{[^}]*background:var\(--fill-danger\)/.test(css),
    );
    check(
      "css: search mark uses --mark-bg, not brand",
      /\.search-snippet mark\{[^}]*background:var\(--mark-bg\)/.test(css),
    );
    /*
     * SITE-WIDE, so it runs against BOTH sheets. Scoping it to the public one
     * would have let an admin focus ring go back to box-shadow unseen, and the
     * rule this asserts is a palette law, not a plane's preference.
     */
    check(
      "css: no :focus-visible rule relies on box-shadow, public",
      !/:focus-visible\{[^}]*box-shadow/.test(css),
    );
    check(
      "css: no :focus-visible rule relies on box-shadow, admin",
      !/:focus-visible\{[^}]*box-shadow/.test(adminCss),
    );
    check(
      "css: theme selectors survived minification",
      // SCOPED-BY: the whole stylesheet is the scope. These are selectors, which exist only in CSS rule position; there is no narrower region to name.
      css.includes(":root:not([data-theme])") && css.includes("[data-theme=dark]"),
    );
  }
}

/* --- 4. Header: the icon control and the stray slash -------------------- */

{
  const { text } = await get("/");
  const anchorsToSearch = (text.match(/href="\/search"/g) ?? []).length;
  check("header: exactly one anchor to /search", anchorsToSearch === 1, `found ${anchorsToSearch}`);

  const start = text.indexOf('<a class="search-trigger"');
  const end = text.indexOf("</a>", start);
  const anchor = start === -1 ? "" : text.slice(start, end);
  check("header: the search anchor is present", start !== -1);
  check("header: the search anchor has an accessible name", anchor.includes('aria-label="Search"'));
  // The keyboard hint lives INSIDE the anchor, shipped hidden and aria-hidden
  // and revealed by the palette script. That is the ratified progressive
  // enhancement: the hint is present in the markup and its visibility is the
  // capability signal.
  //
  // A blanket "the anchor contains no <kbd>" assertion used to sit here. It
  // predated the hint, asserted the old state, and directly contradicted the
  // assertion below it, so it failed on a header that was correct. Ruled
  // 2026-07-30: the specific assertion wins, the blanket one goes.
  check(
    "header: the hint is hidden and aria-hidden in the no-JS state",
    /<kbd[^>]*data-search-hint[^>]*aria-hidden="true"[^>]*hidden/.test(text),
  );
  check("header: the hint sits inside the search anchor", anchor.includes("data-search-hint"));
  check("header: theme toggle is a real form posting to /theme", text.includes('action="/theme"'));
  check(
    "header: exactly one theme option is pressed",
    (text.match(/aria-pressed="true"/g) ?? []).length === 1,
  );
}

/* --- 5. The markdown twin is byte-identical to the repo ----------------- */

{
  const { res: liveRes, text: live, status } = await get(`/blog/${SLUG}.md`);
  check(`md twin: /blog/${SLUG}.md serves`, status === 200);

  // Compared against the ARTIFACT's markdown field, not the repo file.
  // The twin serves the post BODY; the file on disk also carries 296 bytes of
  // frontmatter, so comparing the two reports a 297 character difference that
  // looks exactly like content drift and is not. Measured, after the first run
  // of this script failed that way.
  const artifact = JSON.parse(
    readFileSync(join(root, "content", "generated", "posts.json"), "utf8"),
  );
  const record = artifact.posts.find((/** @type {any} */ p) => p.slug === SLUG);
  const norm = (/** @type {string} */ s) => s.replace(/\r\n/g, "\n").trim();

  check("md twin: the post is in the artifact", Boolean(record));
  check(
    "md twin: byte-identical to the artifact (tokens did not touch content)",
    Boolean(record) && norm(live) === norm(record.markdown),
    `live ${norm(live).length} chars, artifact ${record ? norm(record.markdown).length : 0} chars`,
  );
  // And the artifact is itself gated against the file by check:content, so the
  // chain from file to served bytes is closed without comparing unlike things.
  //
  // **This assertion was `true`.** A literal, passing unconditionally, inflating
  // the count by one and proving nothing about the header it named. The twin's
  // whole purpose is that an agent can fetch source rather than scrape a page,
  // and an agent decides that from the content-type; serving the right bytes
  // under `text/html` would have failed the reader while this passed.
  const twinType = liveRes.headers.get("content-type") ?? "";
  check(
    "md twin: content-type is text/markdown",
    twinType.includes("text/markdown"),
    `got ${twinType || "(none)"}`,
  );
}

/* --- 6. Search still works, and marks are gold ------------------------- */

{
  const { text, status } = await get("/search?q=blog");
  check("search: page renders", status === 200);
  // Scope to the results list, because the zero state renders a recent-writing
  // list carrying the same links and would pass a naive check.
  const results = strip(text).match(/<ol class="search-results"[\s\S]*?<\/ol>/) ?? [""];
  check("search: results list present", results[0].includes("search-result"));
  check("search: a mark is rendered", results[0].includes("<mark>"));

  const json = await get("/search?q=blog", { accept: "application/json" });
  check(
    "search: JSON twin negotiates",
    (json.res.headers.get("content-type") ?? "").includes("json"),
  );
  check("search: Vary: Accept is set", (json.res.headers.get("vary") ?? "").includes("Accept"));
}

/* --- 7. Admin is still gated ------------------------------------------- */

for (const path of ["/admin", "/admin/posts", `/admin/posts/${SLUG}/edit`]) {
  const { status } = await get(path);
  check(`admin: ${path} redirects unauthenticated`, status === 302, `got ${status}`);
}

/* --- 8. The orphaned static assets ------------------------------------- */

{
  const pdfs = readdirSync(join(root, "public", "publications")).filter((f) => f.endsWith(".pdf"));
  const photos = readdirSync(join(root, "public", "phage-hunters"));
  let ok = 0;
  for (const f of pdfs) {
    const r = await fetch(`${ORIGIN}/publications/${encodeURIComponent(f)}`, {
      method: "HEAD",
      headers: { "user-agent": UA },
    });
    if (r.status === 200) ok += 1;
    else failures.push(`asset 404: /publications/${f} (${r.status})`);
  }
  for (const f of photos) {
    const r = await fetch(`${ORIGIN}/phage-hunters/${encodeURIComponent(f)}`, {
      method: "HEAD",
      headers: { "user-agent": UA },
    });
    if (r.status === 200) ok += 1;
    else failures.push(`asset 404: /phage-hunters/${f} (${r.status})`);
  }
  const total = pdfs.length + photos.length;
  check(`assets: ${ok}/${total} PDFs and photos serve 200`, ok === total);
  console.log(`  assets checked: ${ok}/${total}`);
}

/* --- 9. Drafts reach NONE of the nine public surfaces -------------------- *
 *
 * Regression check for the leak of 2026-07-29: five unpublished drafts were
 * uploaded to the AI index unconditionally, and the public unauthenticated
 * /search/ask answered from one and cited it by slug.
 *
 * The eight keyword surfaces filter at QUERY time and are cheap, so every draft
 * is checked against all of them. Ask is the ninth and it BILLS PER ANSWER, so
 * it is capped and the cap is printed rather than left implicit: a silent cap
 * reads as "covered everything" when it did not.
 *
 * The draft list comes from the gated artifact, so a post added later is swept
 * without anyone remembering to add it here.
 */

const ASK_PROBE_LIMIT = 3;

{
  const artifact = JSON.parse(
    readFileSync(join(root, "content", "generated", "posts.json"), "utf8"),
  );
  /** @type {any[]} */
  const drafts = artifact.posts.filter((/** @type {any} */ p) => p.draft === true);
  const live = artifact.posts.filter((/** @type {any} */ p) => p.draft !== true);
  console.log(`  corpus: ${live.length} published, ${drafts.length} draft`);

  // The published corpus is present, which is what stops "nothing is listed"
  // passing this whole section for the wrong reason.
  //
  // CORPUS-AWARE, not page-1-naive. This block used to assert that every
  // published post appeared on /blog, which silently meant page 1. It went red
  // the moment the corpus passed POSTS_PER_PAGE, on a site that was paginating
  // correctly, and it would have gone red again every ten posts by
  // construction. Ruled 2026-07-30: derive the expected page from the published
  // count and the page size instead.
  //
  // POSTS_PER_PAGE is IMPORTED rather than restated. The number already existed
  // twice in the app; a third copy here is what the ruling is about.
  const pages = pageCount(live.length);
  const fetched = await Promise.all(
    Array.from({ length: pages }, (_, i) => get(i === 0 ? "/blog" : `/blog?page=${i + 1}`)),
  );

  check("blog: index renders", fetched[0].status === 200);

  // **This assertion used to be `pages === Math.max(1, Math.ceil(live.length /
  // POSTS_PER_PAGE))`, which is the body of `pageCount` restated.** `pages` IS
  // `pageCount(live.length)`, so it compared an expression to itself and could
  // never fail, while its label claimed the site paginated correctly. It made
  // no request. Second tautology found in this file, after the literal `true`.
  //
  // What it should have asserted is the SITE's boundary against the derived
  // count: the last page in range carries posts, and the first page out of
  // range carries none. That fails if the site paginates at a different size
  // than the app's own constant, which is the thing worth knowing.
  const onPage = (/** @type {string} */ body) =>
    live.filter((/** @type {any} */ p) => body.includes(`/blog/${p.slug}"`)).length;

  check(
    `blog: the last page (${pages} of ${pages}) carries posts`,
    onPage(fetched[pages - 1].text) > 0,
    `page ${pages} listed ${onPage(fetched[pages - 1].text)} of ${live.length} published`,
  );

  const overflow = await get(`/blog?page=${pages + 1}`);
  check(
    `blog: page ${pages + 1} is past the end and lists nothing`,
    onPage(overflow.text) === 0,
    `listed ${onPage(overflow.text)} post(s) beyond the ${pages}-page corpus`,
  );

  // Pagination is a surface the corpus only just grew, so assert it exists and
  // answers rather than assuming the site kept up.
  if (live.length > POSTS_PER_PAGE) {
    check("blog: page 2 exists and renders", fetched[1]?.status === 200, `got ${fetched[1]?.status}`);
    check(
      "blog: page 1 links to page 2",
      // SCOPED-BY: the whole document is the scope. `page=2` is a query parameter that occurs only inside an href, so the document already delimits it.
      fetched[0].text.includes("page=2"),
    );
  }
  for (const [i, page] of fetched.entries()) {
    check(`blog: page ${i + 1} renders`, page.status === 200, `got ${page.status}`);
  }

  // The listing is ordered by publishAt DESC, and SQLite does not promise an
  // order WITHIN a tie. Several posts here share a publish date, so a post's
  // position is a RANGE rather than a number, and pinning it to one page would
  // make this harness flaky the first time a tie group straddled a boundary.
  // The range collapses to a single page for any post whose date is unique,
  // which is the usual case, so the assertion stays exact where exactness means
  // anything.
  const at = (/** @type {any} */ p) => String(p.publishAt);
  for (const p of live) {
    const after = live.filter((/** @type {any} */ o) => at(o) > at(p)).length;
    const atOrAfter = live.filter((/** @type {any} */ o) => at(o) >= at(p)).length;
    const first = pageForPosition(after + 1);
    const last = pageForPosition(atOrAfter);
    const candidates = Array.from({ length: last - first + 1 }, (_, i) => first + i);
    const found = candidates.filter((n) => fetched[n - 1]?.text.includes(`/blog/${p.slug}`));
    check(
      `blog: /blog/${p.slug} is listed on page ${candidates.join(" or ")}`,
      found.length > 0,
    );
  }

  const [rss, feed, sitemap] = await Promise.all([
    get("/blog/rss.xml"),
    get("/blog/feed.json"),
    get("/sitemap.xml"),
  ]);

  for (const p of drafts) {
    const slug = p.slug;
    // EVERY page, not page 1. This section exists because of the 2026-07-29
    // draft leak, and a leak-regression check that only looks at the first page
    // is the same page-1-naive defect the listing assertions above just shed.
    check(
      `draft ${slug}: absent from all ${pages} page(s) of /blog`,
      fetched.every((page) => !page.text.includes(`/blog/${slug}`)),
    );

    const page = await get(`/blog/${slug}`);
    check(`draft ${slug}: /blog/${slug} is 404`, page.status === 404, `got ${page.status}`);

    const twin = await get(`/blog/${slug}.md`);
    check(`draft ${slug}: the markdown twin is 404`, twin.status === 404, `got ${twin.status}`);

    check(`draft ${slug}: absent from rss.xml`, !rss.text.includes(slug));
    check(`draft ${slug}: absent from feed.json`, !feed.text.includes(slug));
    check(`draft ${slug}: absent from sitemap.xml`, !sitemap.text.includes(slug));

    // Its own title is the query most likely to retrieve it, so a miss here is
    // meaningful rather than an artefact of a weak query.
    const q = encodeURIComponent(`"${p.title}"`);
    const html = await get(`/search?q=${q}`);
    check(`draft ${slug}: absent from /search results`, !html.text.includes(`/blog/${slug}`));

    const json = await get(`/search?q=${q}`, { accept: "application/json" });
    check(`draft ${slug}: absent from the search JSON`, !json.text.includes(`/blog/${slug}`));
  }

  /**
   * The ninth surface. A citation rides as `item.key`, which is
   * `blog/<slug>.md` or `blog/<slug>__<anchor>.md`, NOT a `/blog/<slug>` URL:
   * the URL is reconstructed client side by ask-keys.mjs. The first version of
   * this check searched the body for `/blog/<slug>` and could therefore never
   * have failed, which is why it was made to fail before being trusted.
   *
   * @param {string} label @param {string} q
   * @returns {Promise<{keys: string[], status: number} | null>} null if refused
   */
  async function askKeys(label, q) {
    // POST since 2026-08-16: Ask bills, so a GET that spends budget was
    // reachable by any crawler or prefetch. The probe follows the endpoint.
    const res = await fetch(`${ORIGIN}/search/ask`, {
      method: "POST",
      headers: {
        "user-agent": UA,
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ q }),
    });
    const body = await res.text();
    // A refusal is the guard working, not a leak result, and it must not be
    // counted as evidence of absence.
    if (res.status === 429) {
      console.log(`  ask: ${label} refused by the rate limit, not probed`);
      return null;
    }
    const m = body.match(/event: chunks\ndata: (.*)/);
    check(`ask: ${label} returned a parseable chunks event`, Boolean(m), `status ${res.status}`);
    if (!m) return { keys: [], status: res.status };
    /** @type {any[]} */
    const chunks = JSON.parse(m[1]);
    return { keys: chunks.map((c) => String(c?.item?.key ?? "")), status: res.status };
  }

  /**
   * A query MEASURED to retrieve on this corpus. Its job is to prove retrieval
   * is alive, so that the draft probes below are absence of a leak rather than
   * absence of an answer. Ask returns zero chunks for plenty of reasonable
   * questions under the instance's 0.4 score threshold, and without this the
   * whole section would pass on an empty index.
   *
   * If the corpus moves and this stops retrieving, this check fails and someone
   * picks a new probe. That is the intended failure, not a false alarm.
   */
  const positive = await askKeys("positive control", "d1");
  if (positive) {
    check("ask: the positive control retrieves at least one chunk", positive.keys.length > 0);
    for (const key of positive.keys) {
      check(
        `ask: retrieved key ${key} belongs to a published post`,
        live.some((/** @type {any} */ p) => key.startsWith(`blog/${p.slug}`)),
      );
    }
  }

  // Billed per answer and rate limited to five per minute per IP, so this is
  // capped and the cap is printed. A silent cap reads as full coverage.
  const probes = drafts.slice(0, ASK_PROBE_LIMIT);
  for (const p of probes) {
    const got = await askKeys(`draft ${p.slug}`, p.title);
    if (!got) continue;
    const leaked = got.keys.filter((k) => k.startsWith(`blog/${p.slug}`));
    check(`draft ${p.slug}: Ask cites nothing from it`, leaked.length === 0, leaked.join(", "));
  }
  console.log(
    `  ask probes: ${probes.length} of ${drafts.length} drafts (billed per answer, ` +
      `${drafts.length - probes.length} not probed)`,
  );
}

/* --- 10. The retired routes are bare 404s, and the kept files are not ---- */

{
  // Never a redirect and never a prefix rule: /publications/* and
  // /phage-hunters/* ARE the 40 kept files, and a gone rule matching either
  // prefix would take them with it.
  // `/phage-discovery` LEFT THIS LIST on 2026-08-02: the Worker serves the
  // Roster page there now, so asserting a 404 would assert the page is broken.
  // It is asserted as a 200 in section 11 instead.
  //
  // `/phage-hunters` STAYS, and the difference is deliberate rather than an
  // oversight. There is no /phage-hunters ROUTE any more, while
  // /phage-hunters/* is still nine static photos that section 8 asserts are
  // reachable. The page prefix and the asset prefix differ on purpose.
  for (const path of ["/research", "/publications", "/teaching", "/phage-hunters"]) {
    const { status } = await get(path);
    check(`retired: ${path} is a bare 404`, status === 404, `got ${status}`);
  }
}

/* --- 11. The Roster page at the legacy URL ------------------------------ */

{
  const { status, text } = await get("/phage-discovery");
  check("roster: /phage-discovery returns 200", status === 200, `got ${status}`);

  // Comments stripped before matching, per the harness rules: SSR splices
  // <!-- --> between adjacent text nodes, which silently defeats a naive match.
  const page = strip(text);

  /*
   * DELIMITED TO THE HEADING, and the unscoped form could not fail.
   *
   * `page.includes("Roster")` matched the word anywhere in the document, and
   * the site header renders `<NavLink to="/phage-discovery">Roster</NavLink>`
   * on EVERY page. Deleting the `<h1>` entirely left this assertion green.
   * Found by the 2026-08-07 audit, fixed here; it is one of the two instances
   * check:assertions was written to catch, and it flagged this exact line on
   * its first run.
   */
  check(
    "roster: the page's own heading says Roster",
    />Roster<\/h1>/.test(page),
    "the <h1> is missing or renamed; the nav link alone must not satisfy this",
  );

  // All nine cohort years. Asserted individually rather than as a count, so a
  // failure names the year that is missing instead of reporting "8 of 9".
  const years = Array.from({ length: 9 }, (_, i) => 2017 + i);
  const missing = years.filter((y) => !page.includes(`id="year-${y}"`));
  check(
    `roster: all nine ids year-2017 through year-2025 are present`,
    missing.length === 0,
    missing.length > 0 ? `missing ${missing.map((y) => `year-${y}`).join(", ")}` : "",
  );
  // An assertion that can pass by reading nothing is not an assertion: if the
  // fetch returned an error page, the loop above would report nine misses, but
  // this states the positive count so "0 missing" cannot mean "0 examined".
  //
  // The first conjunct used to be `years.length === 9`, where `years` is built
  // by `Array.from({ length: 9 })` two lines up. Constant true, and so half of
  // this guard was dead: it asserted the harness's own literal rather than the
  // page. Counting what was FOUND is what actually proves examination.
  const found = years.length - missing.length;
  check(
    "roster: nine year ids were actually examined",
    found === 9 && page.length > 500,
    `found ${found} of ${years.length} year ids, page ${page.length} bytes`,
  );

  // The nav link, from the HOMEPAGE, which is what makes the page reachable
  // rather than merely present.
  const home = await get("/");
  check(
    "roster: the homepage links to /phage-discovery",
    strip(home.text).includes('href="/phage-discovery"'),
    `home ${home.status}`,
  );
}

/* --- 12. The colophon ---------------------------------------------------- */

{
  const { status, text } = await get("/colophon");
  check("colophon: /colophon returns 200", status === 200, `got ${status}`);

  // Comments stripped AND entities decoded, per the harness rules. Both are
  // transforms SSR applies between the data file and the wire, and matching
  // prose that came out of JSON needs both undone.
  const page = unescape(strip(text));

  // The TITLE, not the URL. Both are ruled and they deliberately differ: the
  // path takes the IndieWeb convention, the heading takes the legibility.
  check(
    "colophon: the h1 reads How this site is built",
    /<h1[^>]*>How this site is built<\/h1>/.test(page),
    `h1 not found in ${page.length} bytes`,
  );

  // Generated content actually rendered, rather than an empty shell. A POSITIVE
  // count, so "nothing missing" cannot mean "nothing examined".
  const bindingsShown = stack.bindings.filter((/** @type {any} */ b) =>
    page.includes(`>${b.name}<`),
  ).length;
  check(
    "colophon: every binding in the artifact is on the page",
    bindingsShown === stack.bindings.length && bindingsShown > 0,
    `${bindingsShown} of ${stack.bindings.length} binding names found`,
  );

  /*
   * The hand-written half, which no generator produces.
   *
   * DELIMITED to the heading element, matching the binding sweep twelve lines
   * above. The unscoped `page.includes(f.name)` was satisfied by a feature name
   * appearing ANYWHERE, including inside another feature's prose, and several
   * of these names are ordinary sentences. Flagged by check:assertions on its
   * first run; the second of the two instances that gate was written to catch.
   */
  const featuresShown = features.features.filter((/** @type {any} */ f) =>
    page.includes(`>${f.name}<`),
  ).length;
  check(
    "colophon: every feature in the anchors file is on the page",
    featuresShown === features.features.length && featuresShown > 0,
    `${featuresShown} of ${features.features.length} feature names found`,
  );

  // Reachability, not mere existence, and taken from a DIFFERENT page's footer
  // so this proves the site-wide footer carries it rather than the page linking
  // to itself.
  const home = await get("/");
  check(
    "colophon: the footer links to /colophon",
    strip(home.text).includes('href="/colophon"'),
    `home ${home.status}`,
  );

  const sitemap = await get("/sitemap.xml");
  check(
    "colophon: /colophon is in the sitemap",
    sitemap.text.includes(`${ORIGIN}/colophon<`),
    `sitemap ${sitemap.status}, ${sitemap.text.length} bytes`,
  );

  // THE LIVE ROW, not the file. `llms.txt` is served from D1 and the tracked
  // file is only the fallback, so this is the one assertion that catches a
  // committed file whose sync never ran. check:llms --remote reports the same
  // drift offline; this asserts it on the path a reader actually takes.
  const llms = await get("/llms.txt");
  check(
    "colophon: the live llms.txt mentions /colophon",
    // SCOPED-BY: llms.txt is a flat manifest with no elements to scope to. Presence anywhere in it IS the assertion.
    llms.text.includes("/colophon"),
    `llms.txt ${llms.status}, ${llms.text.length} bytes. ` +
      `If this fails, sync:content -- --remote has not run since the file changed.`,
  );

  // One post carries the pointer line. Ratified as ONE line in the template
  // rather than a section per article, so asserting it on a single post is
  // asserting the template.
  const post = await get(`/blog/${SLUG}`);
  check(
    "colophon: a post links to /colophon in its footer line",
    strip(post.text).includes('href="/colophon"'),
    `post ${post.status}`,
  );
}

/* --- 12b. The colophon is IN the search corpus, section-grained --------- *
 *
 * The `page` records landed with 49b35d5 and reached production D1 on
 * 2026-08-05, taking search_docs from 93 to 101. Everything below is about the
 * LIVE index, so no offline gate can carry it: `check:content` proves the
 * artifact matches a fresh generation and `check:features` proves the section
 * ids agree, and both are green whether or not a single row was ever synced.
 *
 * **The completeness sweep is the assertion that would have caught the
 * duplication ebde677 fixed**, and it is worth being precise about why. Six of
 * seven sections rendered their descriptor lead and then repeated it in
 * different words. Every gate stayed green: the artifact was byte-identical,
 * the ids reconciled, the types checked. Nothing compared what the INDEX
 * promises a reader against what the PAGE actually shows them, which is the one
 * comparison that fails when a record's body and its page drift apart.
 */

{
  /**
   * A section's own slice of the page, from its heading to the next one.
   *
   * SCOPED, per the harness rule at the top of this file, and not as a nicety.
   * Unscoped, `react` matched a modulepreload href in `<head>` and `Ask`
   * matched the palette's Ask row, so the dependencies and features sweeps
   * passed on markup that had nothing to do with the section being checked.
   * Measured before this was scoped: 9 tokens were passing that way.
   *
   * @param {string} html @param {string} id
   */
  const sectionRegion = (html, id) => {
    const start = html.indexOf(`<h2 id="${id}"`);
    if (start === -1) return "";
    const next = html.indexOf('<h2 id="', start + 1);
    return html.slice(start, next === -1 ? html.length : next);
  };

  /**
   * The fact needles, from `scripts/lib/colophon-facts.mjs`.
   *
   * They used to be a closure right here, and that is what made this the
   * colophon's second registration site with no offline reader. A section could
   * be added to the descriptor with its body rule and without its fact list,
   * and the first thing to say so was this harness, crashing after a deploy.
   * That is what happened to `security` in ship window 8.
   *
   * Moved into a module so `test/colophon-facts.test.mjs` can assert the
   * coverage offline. The values are still authored independently of
   * `colophonPageInput`, deliberately; the module's header says why deriving
   * them would make this sweep unable to fail.
   *
   * @param {string} id
   * @returns {string[]}
   */
  const factsFor = (id) => colophonFacts(stack, features, id);

  /**
   * A term that exists ONLY on the colophon, so a hit cannot come from a post.
   *
   * **`Vectorize` was the obvious second candidate and it does NOT work**,
   * measured rather than assumed. Both terms are absent from all twelve posts
   * AS WRITTEN, but the prose index stems with porter, so `Vectorize` reduces
   * to `vector` and retrieves two published posts that discuss vectors. A term
   * is corpus-unique only AFTER stemming. `1042` is a Cloudflare error number,
   * survives stemming unchanged, and appears nowhere else on this site.
   */
  const UNIQUE = "1042";

  const json = await get(`/search?q=${UNIQUE}`, { accept: "application/json" });
  /** @type {any} */
  let payload = null;
  try {
    payload = JSON.parse(json.text);
  } catch {
    payload = null;
  }
  check(`colophon search: "${UNIQUE}" returns parseable JSON`, payload !== null, `status ${json.status}`);

  /** @type {any[]} */
  const results = payload?.results ?? [];
  check(
    `colophon search: "${UNIQUE}" retrieves the page`,
    results.length > 0,
    `total ${payload?.total ?? "(none)"}`,
  );
  // A POSITIVE count on both sides, so "no foreign hits" cannot mean "no hits".
  const foreign = results.filter((r) => !new URL(r.url).pathname.startsWith("/colophon"));
  check(
    `colophon search: all ${results.length} hit(s) for "${UNIQUE}" are the colophon`,
    results.length > 0 && foreign.length === 0,
    foreign.map((r) => r.url).join(", "),
  );

  // The page as a reader receives it, for the anchor and completeness checks.
  const { text: colophonHtml, status: colophonStatus } = await get("/colophon");
  const colophon = unescape(strip(colophonHtml));
  check("colophon search: the page fetches for comparison", colophonStatus === 200 && colophon.length > 1000);

  /**
   * A SECTION-GRAINED hit deep-links to a fragment that exists.
   *
   * This is the failure the descriptor was built to prevent and it is silent:
   * a record pointing at a dead fragment still returns a hit, still looks
   * correct in a result list, and scrolls nowhere. Only the rendered page can
   * settle it.
   */
  const deep = results.filter((r) => r.anchor);
  check(
    `colophon search: at least one "${UNIQUE}" hit is section-grained`,
    deep.length > 0,
    `${deep.length} of ${results.length} carry an anchor`,
  );
  for (const r of deep) {
    check(
      `colophon search: anchor #${r.anchor} exists as an id on the page`,
      colophon.includes(`id="${r.anchor}"`),
      `${r.url} points at a fragment the page does not render`,
    );
    check(
      `colophon search: the URL for #${r.anchor} carries its fragment`,
      r.url.endsWith(`#${r.anchor}`),
      `got ${r.url}`,
    );
  }

  /**
   * The `type` facet stops having one value.
   *
   * Before the page records were synced this reported `post` and nothing else,
   * so a facet with one value is the exact signature of the sync not having
   * run. The query is broad on purpose: it has to match both types.
   */
  const spread = await get("/search?q=cloudflare", { accept: "application/json" });
  /** @type {any[]} */
  let types = [];
  try {
    types = JSON.parse(spread.text).facets?.types ?? [];
  } catch {
    types = [];
  }
  check(
    "colophon search: the type facet reports both post and page, not one value",
    types.length === 2 &&
      types.some((t) => t.value === "post" && t.count > 0) &&
      types.some((t) => t.value === "page" && t.count > 0),
    `facet types: ${JSON.stringify(types)}`,
  );

  /**
   * EVERY FACT THE INDEX CARRIES IS ON THE PAGE THE READER LANDS ON.
   *
   * Per section, the descriptor lead as one contiguous substring plus every
   * discrete value its record body was assembled from. A miss means the index
   * promises something the page does not show, which is a wrong result rather
   * than an empty one.
   */
  let sweptFacts = 0;
  for (const section of COLOPHON_SECTIONS) {
    const region = sectionRegion(colophon, section.id);
    check(
      `colophon ${section.id}: the section renders`,
      region.length > 0,
      `no <h2 id="${section.id}"> in ${colophon.length} bytes`,
    );
    check(
      `colophon ${section.id}: the descriptor lead is on the page verbatim`,
      region.includes(section.lead),
      `lead absent from the ${region.length}-byte region`,
    );

    const facts = factsFor(section.id);
    const missing = facts.filter((v) => !region.includes(v));
    sweptFacts += facts.length;
    check(
      `colophon ${section.id}: all ${facts.length} indexed facts are on the page`,
      facts.length > 0 && missing.length === 0,
      missing.length > 0
        ? `${missing.length} missing, first: ${JSON.stringify(missing[0].slice(0, 120))}`
        : "",
    );
  }
  // The count, printed rather than implied. "0 missing" across seven sections
  // means nothing without the number of facts that were actually compared.
  console.log(`  colophon: ${sweptFacts} indexed facts swept across ${COLOPHON_SECTIONS.length} sections`);
}

/* --- 13. The cache, observed WARM -------------------------------------- */

/**
 * **This section exists because every other one runs cold.**
 *
 * The Worker version is part of the cache key, so a deploy empties the cache
 * and this sweep normally runs seconds later. Every assertion above is
 * therefore answered by the Worker itself, which is a smaller claim than it
 * looks: the theme-cookie bug lived for four sessions behind exactly that,
 * asserting the theme persists while never once reading a cached response.
 *
 * So this section deliberately warms each entry and then asks again.
 *
 * **It does NOT use `get()`.** That helper sends `Cache-Control: no-cache` on
 * every request, which forces revalidation and would make "not a HIT" pass for
 * the wrong reason: the response would be uncached because the REQUEST said so,
 * not because the route is uncacheable. Reusing it here would have produced a
 * green section that proved nothing, which is the failure mode hard rule 10 is
 * about.
 */
{
  const UA_ONLY = { "user-agent": UA };

  /** A plain GET. No `no-cache`, because cache behaviour is the subject. */
  const warm = async (/** @type {string} */ path, /** @type {string} */ cookie) => {
    const res = await fetch(`${ORIGIN}${path}`, {
      headers: cookie ? { ...UA_ONLY, cookie } : UA_ONLY,
      redirect: "manual",
    });
    const body = res.headers.get("content-type")?.includes("image/") ? "" : await res.text();
    return { res, body, cf: res.headers.get("cf-cache-status") ?? "(none)" };
  };

  const themeOf = (/** @type {string} */ html) =>
    (htmlTag(html).match(/data-theme="(\w+)"/) ?? [])[1] ?? "(none)";

  // Every public HTML surface. ALL SIX EXPORT `headers` OF THEIR OWN, so none
  // of them observes the Worker's no-Cache-Control default; the loop below
  // requires `cf === "HIT"` for the cookieless population, which a `no-store`
  // route could never satisfy. This comment used to claim two of them had no
  // `headers` export and reached the default here. That stopped being true as
  // routes gained their own, and it left the default with no wire coverage at
  // all until 2026-08-07. It is asserted on the `/admin` 302 instead, in the
  // security-headers section, which is the one live surface that still reaches
  // it.
  const HTML_ROUTES = [
    "/",
    "/blog",
    `/blog/${SLUG}`,
    "/search?q=d1",
    "/phage-discovery",
    // /colophon has the same `headers` export as home and the Roster page, so
    // it belongs to the same population: shared-cached for cookieless readers,
    // and `private, no-store` plus a bypass for anyone carrying a cookie. Both
    // halves are asserted below.
    "/colophon",
  ];

  // TWO POPULATIONS, asserted separately, because the whole design turns on
  // treating them differently.
  //
  //   cookieless    shared-cached. SHOULD hit, and must render the default.
  //   cookie-bearing  never stored. Should BYPASS, and must render its own theme.
  //
  // These assertions are INVERTED from what this section first said. It used to
  // assert HTML is never served from cache, which was right while all HTML was
  // `private, no-store`. Half of it is now the opposite.
  for (const path of HTML_ROUTES) {
    // Cookieless first, repeatedly: the entry needs a couple of requests to
    // settle, and a BYPASS proves nothing about caching. Measured: after a
    // cookie-bearing request the next cookieless one can read BYPASS, then MISS,
    // then HIT.
    let cookieless = await warm(path, "");
    for (let i = 0; i < 4 && cookieless.cf !== "HIT"; i += 1) {
      cookieless = await warm(path, "");
    }

    check(
      `cache: ${path} is shared-cached for cookieless readers`,
      cookieless.cf === "HIT",
      `cf-cache-status ${cookieless.cf}, cache-control ${cookieless.res.headers.get("cache-control")}`,
    );
    check(
      `cache: ${path} cookieless renders the default theme`,
      themeOf(cookieless.body) === "(none)",
      `rendered ${themeOf(cookieless.body)} with no cookie sent (cf ${cookieless.cf})`,
    );

    // A cookie-bearing request must never be served from, or written to, the
    // shared entry. `private, no-store` is what guarantees the second half.
    const dark = await warm(path, "theme=dark");
    check(
      `cache: ${path} bypasses the cache for a cookie-bearing reader`,
      dark.cf !== "HIT" &&
        (dark.res.headers.get("cache-control") ?? "").includes("no-store"),
      `cf ${dark.cf}, cache-control ${dark.res.headers.get("cache-control")}`,
    );
    check(
      `cache: ${path} renders the theme the cookie asked for`,
      themeOf(dark.body) === "dark",
      `sent theme=dark, rendered ${themeOf(dark.body)} (cf ${dark.cf})`,
    );

    /*
     * AND THE COOKIED READER IS NOW SERVED FROM THE EDGE, which is the half
     * the four assertions above cannot see.
     *
     * All four remain exactly as true as they were: a cookie-bearing request
     * still bypasses the PLATFORM cache and still receives `private, no-store`.
     * That is what made them compatible with a fix and also what made them
     * blind to it. `cf-cache-status` describes the layer in FRONT of the
     * Worker, and the themed cache is inside it, so a reader answered from
     * `caches.default` in a few milliseconds and a reader who paid a full
     * render both read BYPASS.
     *
     * `x-theme-cache` is the only way to tell those apart from outside, which
     * is why the Worker sets it. The second read must be a hit: the first one
     * stored the entry.
     */
    const darkAgain = await warm(path, "theme=dark");
    check(
      `cache: ${path} serves a cookie-bearing reader from the themed cache`,
      (darkAgain.res.headers.get("x-theme-cache") ?? "").startsWith("hit"),
      `second cookied read marked ${JSON.stringify(darkAgain.res.headers.get("x-theme-cache"))}, ` +
        `expected a hit. Before this layer existed every one of these was a full ` +
        `origin render, which is what made the theme toggle cost a reader the ` +
        `edge cache for every page on the site.`,
    );
    check(
      `cache: ${path} still refuses to hand a cookied reader a public policy`,
      (darkAgain.res.headers.get("cache-control") ?? "").includes("no-store"),
      `a themed-cache hit sent ${darkAgain.res.headers.get("cache-control")}. The ` +
        `stored copy is public so it can be stored at all; serving that header to ` +
        `a cookie-bearing reader lets the platform keep it under a theme-blind ` +
        `key, which is the bug the whole layer exists to prevent.`,
    );
    check(
      `cache: ${path} themed-cache hit still renders the requested theme`,
      themeOf(darkAgain.body) === "dark",
      `a hit rendered ${themeOf(darkAgain.body)} for theme=dark. The key has ` +
        `stopped separating the themes.`,
    );
  }

  // CASE A, ASSERTED DIRECTLY. This exact ordering served a cached dark document
  // to a cookieless reader when the fix was `Vary: Cookie` alone, and it is the
  // reason that attempt was reverted. A fresh URL per run, so the result cannot
  // be an artifact of whatever happened to populate the cache first.
  {
    const cold = `/?verify=${Math.random().toString(36).slice(2)}${Date.now()}`;
    await warm(cold, "theme=dark");
    const after = await warm(cold, "");
    check(
      "cache: a cookie-bearing request cannot poison the cookieless variant",
      themeOf(after.body) === "(none)",
      `cookie-first then cookieless rendered ${themeOf(after.body)} (cf ${after.cf})`,
    );
  }

  /* CASE B: A SECOND REPRESENTATION MUST NOT COLLAPSE THE COOKIE DIMENSION.
   *
   * The defect, measured 2026-08-05 with a paired control on fresh URLs. Both
   * `/search` and `/blog/:slug` set `Vary: Accept, Cookie`. With only the HTML
   * representation in play, a cookie-bearing request correctly BYPASSes. After
   * ONE request for the alternate representation, the same request got a `HIT`
   * and `public`: the edge answered from the stored cookieless variant, the
   * Worker never ran, the downgrade in `workers/app.ts` never fired, and a
   * `theme=dark` reader received the light document.
   *
   * Repair B: the alternate representations are `private, no-store`, so they
   * are never stored and cannot become that second variant.
   *
   * **BOTH routes, because the first write-up of this said `/search` was the
   * only one.** `/blog/:slug` carries the same two-header `Vary` and reproduced
   * it identically, which means every published post was exposed. A scope claim
   * that was wrong once is asserted here rather than trusted.
   *
   * PAIRED, control and test, so a pass cannot come from the route being
   * uncacheable for some unrelated reason: the control must still HIT
   * cookieless, which proves shared caching is alive on that URL.
   */
  {
    /** @param {string} path @param {{cookie?: string, accept?: string}} [opts] */
    const req = async (path, opts = {}) => {
      /** @type {Record<string,string>} */
      const headers = { "user-agent": UA };
      if (opts.cookie) headers.cookie = opts.cookie;
      if (opts.accept) headers.accept = opts.accept;
      const res = await fetch(`${ORIGIN}${path}`, { headers, redirect: "manual" });
      const body = await res.text();
      return {
        res,
        body,
        cf: res.headers.get("cf-cache-status") ?? "(none)",
        cc: res.headers.get("cache-control") ?? "(none)",
        type: (res.headers.get("content-type") ?? "").split(";")[0],
      };
    };

    const bust = () => `${Math.random().toString(36).slice(2)}${Date.now()}`;

    for (const [label, base, accept, altType] of [
      ["/search", "/search?q=d1", "application/json", "application/json"],
      [`/blog/:slug`, `/blog/${SLUG}`, "text/markdown", "text/markdown"],
    ]) {
      const join = base.includes("?") ? "&" : "?";

      // CONTROL: HTML only. Establishes that this URL really is shared-cached,
      // so the test below is about the second representation and nothing else.
      const controlUrl = `${base}${join}vb=c${bust()}`;
      await req(controlUrl);
      let control = await req(controlUrl);
      for (let i = 0; i < 3 && control.cf !== "HIT"; i += 1) control = await req(controlUrl);
      check(
        `variant ${label}: control is shared-cached cookieless`,
        control.cf === "HIT",
        `cf ${control.cf}. Without this the test below proves nothing.`,
      );
      const controlDark = await req(controlUrl, { cookie: "theme=dark" });
      check(
        `variant ${label}: control cookie-bearing bypasses`,
        controlDark.cf !== "HIT" && controlDark.cc.includes("no-store"),
        `cf ${controlDark.cf}, cache-control ${controlDark.cc}`,
      );

      // TEST: the alternate representation FIRST, then the same sequence.
      // Run exactly as it was before the fix, so the only variable is the fix.
      const testUrl = `${base}${join}vb=t${bust()}`;
      const alt = await req(testUrl, { accept });
      check(
        `variant ${label}: the alternate representation still serves ${altType}`,
        alt.res.status === 200 && alt.type === altType,
        `got ${alt.res.status} ${alt.type || "(none)"}`,
      );
      check(
        `variant ${label}: the alternate representation is never stored`,
        alt.cc.includes("no-store"),
        `cache-control ${alt.cc}. If this is public it can become a second variant.`,
      );

      await req(testUrl);
      let after = await req(testUrl);
      for (let i = 0; i < 3 && after.cf !== "HIT"; i += 1) after = await req(testUrl);
      const dark = await req(testUrl, { cookie: "theme=dark" });
      check(
        `variant ${label}: cookie-bearing bypasses AFTER the alternate representation`,
        dark.cf !== "HIT" && dark.cc.includes("no-store"),
        `cf ${dark.cf}, cache-control ${dark.cc}. This is the 2026-08-05 defect: ` +
          `a second variant collapsed the Cookie dimension.`,
      );
      check(
        `variant ${label}: renders the requested theme AFTER the alternate representation`,
        themeOf(dark.body) === "dark",
        `sent theme=dark, rendered ${themeOf(dark.body)} (cf ${dark.cf})`,
      );
    }

    // BOTH ADVERTISED FORMS still reach the markdown twin. llms.txt documents
    // the path AND the Accept header, so dropping either is a broken published
    // contract. The path form's bytes are asserted in section 5; this is the
    // negotiated form, which nothing else covers.
    const negotiated = await req(`/blog/${SLUG}`, { accept: "text/markdown" });
    const byPath = await req(`/blog/${SLUG}.md`);
    check(
      "variant: the Accept form and the .md path return the same markdown",
      negotiated.type === "text/markdown" &&
        byPath.type === "text/markdown" &&
        negotiated.body === byPath.body &&
        negotiated.body.length > 100,
      `accept ${negotiated.type} ${negotiated.body.length}b, path ${byPath.type} ${byPath.body.length}b`,
    );
  }

  // AND THE CACHE STILL WORKS WHERE IT IS MEANT TO. The fix above made HTML
  // uncacheable; it must not have disabled the cache it was enabled for. A
  // regression that turned caching off site-wide would satisfy every assertion
  // above and would be invisible without this one.
  /*
   * THE KEY IS DERIVED, NOT WRITTEN DOWN, and this cost a run to learn.
   *
   * It was the literal `og/ai-answer-layer-ask-mode-9933971b.png`. On
   * 2026-08-15 the ship window changed what `ogImageKey` hashes, every card key
   * moved, and `build:og --remote` pruned that object minutes after the deploy
   * that made it an orphan. This block then fetched a key nothing has served
   * since, got the Worker's 404, and reported `cf-cache-status BYPASS` and
   * `cache-control private, no-store`.
   *
   * BOTH FAILURES WERE TRUE AND BOTH POINTED AT THE WRONG SUBSYSTEM. Nothing
   * had happened to the cache; a 404 is uncacheable and private, which is
   * correct behaviour. The harness said "caching is broken" when the fact was
   * "this key is gone", and a diagnosis naming the wrong subsystem costs more
   * than a silent pass does.
   *
   * So the key now comes from `ogImageKey` over the artifact, the same function
   * the sync writes into D1 and `build:og` uploads under, and the first
   * assertion checks the response IS the picture before the other two say
   * anything about the cache.
   */
  const thumbPost = JSON.parse(
    readFileSync(join(root, "content", "generated", "posts.json"), "utf8"),
  ).posts.find((/** @type {any} */ p) => !p.cover);
  const THUMB = `/media/${ogImageKey(thumbPost)}?w=320`;
  await warm(THUMB, "");
  const cachedThumb = await warm(THUMB, "");
  check(
    "cache: the /media/* probe is fetching an object that exists",
    cachedThumb.res.status === 200 &&
      (cachedThumb.res.headers.get("content-type") ?? "").startsWith("image/"),
    `${THUMB} answered ${cachedThumb.res.status} ` +
      `${cachedThumb.res.headers.get("content-type")}. A missing object makes the two ` +
      `cache assertions below fail for a reason that has nothing to do with the cache.`,
  );
  check(
    "cache: /media/* still HITs on a second request",
    cachedThumb.cf === "HIT",
    `cf-cache-status ${cachedThumb.cf}`,
  );
  check(
    "cache: /media/* is still served immutable",
    (cachedThumb.res.headers.get("cache-control") ?? "").includes("immutable"),
    `cache-control ${cachedThumb.res.headers.get("cache-control")}`,
  );
}

/* --- 14. Security headers, on the wire ---------------------------------- *
 *
 * Phase A, ratified 2026-08-06. `check:headers` asserts that `workers/app.ts`
 * DECLARES the ratified set; this asserts the set actually ARRIVES. Neither
 * replaces the other: the gate cannot see the wire, and this cannot run without
 * a deploy.
 *
 * **The expected values are PARSED out of `workers/app.ts`, not restated.**
 * That is deliberate. `check:headers` already binds the source to the
 * ratification in both directions, so parsing here closes the chain
 * ratification -> source -> wire without a third hand-maintained copy to go
 * stale. A literal list here would be exactly the mirror the gate family exists
 * to prevent.
 *
 * TWO SURFACES, and the second is not redundant. A 200 takes the mutable path;
 * `Response.redirect()` returns IMMUTABLE headers, so `/admin`'s 302 goes
 * through the rebuild branch instead. A helper called on only one exit would
 * leave every redirect on the site bare while a 200 looked perfect.
 */

{
  // Comments first: the constant's docblock names headers and values while
  // explaining them, and the prose would parse before the code. One owner:
  // scripts/lib/strip-comments.mjs.
  const appSource = stripComments(readFileSync(join(root, "workers", "app.ts"), "utf8"));
  const declBlock = appSource.match(
    /const\s+SECURITY_HEADERS\s*:[^=]*=\s*\{([\s\S]*?)\}\s*;/,
  );
  /** @type {[string, string][]} */
  const expected = declBlock
    ? [...declBlock[1].matchAll(/"([A-Za-z-]+)"\s*:\s*"([^"]*)"/g)].map((m) => [m[1], m[2]])
    : [];

  // FAIL CLOSED. If the parse returns nothing every loop below is skipped and
  // this section would silently assert nothing at all.
  check(
    "security: the ratified header set was parsed from workers/app.ts",
    expected.length > 0,
    "SECURITY_HEADERS did not parse; the assertions below would examine nothing",
  );

  /** @type {Array<[string, string, number]>} */
  const SURFACES = [
    ["200", "/", 200],
    ["302", "/admin", 302],
  ];
  for (const [label, path, wantStatus] of SURFACES) {
    const { res, status } = await get(path);
    check(`security: ${path} still returns ${wantStatus}`, status === wantStatus, `got ${status}`);
    for (const [name, value] of expected) {
      const got = res.headers.get(name);
      check(
        `security (${label}) ${path}: ${name} is exactly "${value}"`,
        got === value,
        `got ${got === null ? "ABSENT" : JSON.stringify(got)}`,
      );
    }

    /*
     * THE CACHE-CONTROL DEFAULT, ON THE WIRE, and this is the only place it is
     * observable.
     *
     * `/admin` exports no `headers` and its 302 carries no `Vary`, so it reaches
     * the `if (!headers.has("cache-control"))` branch in `workers/app.ts` and
     * nothing else. Every route in HTML_ROUTES above now sets the header itself,
     * so that section cannot see this. `check:headers` proves the source
     * declares the default; per hard rule 7 that is not the same claim as the
     * default arriving, and a deploy that never happened is invisible to it.
     *
     * It rides on the 302 for a second reason: `Response.redirect()` returns
     * IMMUTABLE headers, so this response is rebuilt on the catch branch. It is
     * the exit where a default applied on only one path would be missing.
     */
    if (label === "302") {
      const cc = res.headers.get("cache-control");
      check(
        `cache: ${path} reaches the Worker's uncached default`,
        (cc ?? "").includes("no-store") && (cc ?? "").includes("private"),
        `cache-control ${cc === null ? "ABSENT" : JSON.stringify(cc)}. A response with no ` +
          `Cache-Control is heuristically cached, and this one is authenticated.`,
      );
    }
  }
  console.log(
    `  security headers: ${expected.length} asserted by exact value on a 200 and the /admin 302`,
  );

  /* --- the CSP, Phase B, ENFORCED -------------------------------------- *
   *
   * **THE STATIC-NONCE ASSERTION IS THE ONE THAT MATTERS HERE.** A nonce that
   * never changes renders every page correctly, reports nothing, and protects
   * nothing, because anyone who can read one page learns the value. It is the
   * failure mode that looks exactly like success, and the wire is the only
   * place it can be seen: `check:headers` can prove the source interpolates a
   * variable, not that the variable varies.
   *
   * **REVERSED 2026-08-19, and it was eight failures late.** This block read
   * `Content-Security-Policy-Report-Only` and required the enforcing header to
   * be ABSENT. Enforcement was ruled and shipped on 2026-08-17 in `20c27d6`;
   * `check:headers` flipped in the same commit and this harness did not. Every
   * one of its nonce assertions then read a header that no longer exists, so it
   * compared "" to "" and reported the site broken while the site was correct.
   *
   * The direction of the guard is preserved, not dropped: it used to refuse
   * enforcement so that enforcement could not arrive as a side effect of some
   * other edit, and it now refuses a REVERSION to Report-Only for the same
   * reason. A phase change should be a decision, in both directions.
   */
  {
    const ENFORCED = "content-security-policy";
    const RO = "content-security-policy-report-only";

    for (const [label, path, wantStatus] of SURFACES) {
      const { res } = await get(path);
      const policy = res.headers.get(ENFORCED) ?? "";
      check(
        `csp (${label}) ${path}: the ENFORCING header is present`,
        policy.length > 0,
        "ABSENT. Ruled 2026-08-17: this policy is enforced, not merely reported.",
      );
      check(
        `csp (${label}) ${path}: Report-Only is gone (both at once is a half-migration)`,
        res.headers.get(RO) === null,
        `got ${JSON.stringify(res.headers.get(RO))}. Two policies means a browser ` +
          `enforces one and reports the other, and nobody can say which is the ruling.`,
      );
      check(
        `csp (${label}) ${path}: Reporting-Endpoints names the sink`,
        (res.headers.get("reporting-endpoints") ?? "").includes("/api/csp-report"),
        `got ${JSON.stringify(res.headers.get("reporting-endpoints"))}`,
      );
      check(
        `csp (${label}) ${path}: script-src has no 'unsafe-inline'`,
        !/script-src[^;]*'unsafe-inline'/.test(policy),
        "the easy way to silence a report, and it reduces the policy to decoration",
      );
      void wantStatus;
    }

    /*
     * TWO RESPONSES, BOTH ACTUALLY RENDERED, and the second half of that is
     * what this case had to learn the hard way.
     *
     * A cookie is sent DELIBERATELY. The public HTML routes are shared-cached
     * for cookieless readers, so two plain requests can both be served the SAME
     * cached response, header and body together, and their nonces would be
     * identical for a reason that has nothing to do with the generator.
     *
     * THE COOKIE USED TO BE ENOUGH AND STOPPED BEING ENOUGH, 2026-08-27. The
     * note here read "a cookie-bearing request bypasses the cache and is
     * rendered fresh", which was true of the PLATFORM cache and became false
     * the day `workers/app.ts` grew a themed cache of its own: a cookied reader
     * is exactly the reader that layer was built to serve, so the second
     * request was a hit replaying the first one's stored nonce and this
     * assertion went red against a site doing precisely what it was designed to
     * do. That is hard rule 7's shape, a boundary note ageing into a false
     * claim, and it is fixed by measuring rather than by assuming: each probe
     * carries its own cache-busting query, so each is its own key, and
     * `x-theme-cache` is READ BACK to prove both were misses. An assertion
     * about two generations now fails if it was handed fewer than two.
     */
    const nonceOf = (/** @type {string} */ p) => (p.match(/'nonce-([^']+)'/) ?? [])[1] ?? "";
    const nonceProbe = (/** @type {number} */ n) =>
      get(`/?nonce-probe=${Date.now()}-${n}`, { cookie: "theme=dark" });
    const first = await nonceProbe(1);
    const second = await nonceProbe(2);
    const n1 = nonceOf(first.res.headers.get(ENFORCED) ?? "");
    const n2 = nonceOf(second.res.headers.get(ENFORCED) ?? "");
    const m1 = first.res.headers.get("x-theme-cache") ?? "";
    const m2 = second.res.headers.get("x-theme-cache") ?? "";

    check("csp: the header carries a nonce", n1.length >= 16, `got ${JSON.stringify(n1)}`);
    check(
      "csp: both nonce probes were rendered, not replayed from the themed cache",
      m1.startsWith("miss") && m2.startsWith("miss"),
      `markers ${JSON.stringify(m1)} and ${JSON.stringify(m2)}. The assertion below ` +
        `compares two GENERATIONS; served a stored copy it would compare one ` +
        `generation with itself and report a static nonce on a correct site.`,
    );
    check(
      "csp: THE NONCE VARIES between two Worker-rendered responses",
      n1.length > 0 && n2.length > 0 && n1 !== n2,
      `both responses carried ${JSON.stringify(n1)}. A static nonce renders perfectly ` +
        `and protects nothing.`,
    );
    // And it must be the nonce the DOCUMENT actually used. Under Report-Only a
    // mismatch was a report nobody read; under enforcement it is every script on
    // the page refusing to run, which is exactly what happened to the editor.
    check(
      "csp: the header nonce matches the one stamped on the document's scripts",
      n1.length > 0 && first.text.includes(`nonce="${n1}"`),
      `header nonce ${JSON.stringify(n1)} does not appear as a nonce attribute in the body`,
    );
    console.log(`  csp: ENFORCED, nonce varies (${n1.slice(0, 8)}… then ${n2.slice(0, 8)}…)`);

    /*
     * THE SOLE ENFORCEMENT BLOCKER, PINNED. This is the other half of the
     * assertion above and nothing committed measured it until 2026-08-09.
     *
     * The block above proves the GENERATOR is per-request, and it has to send a
     * cookie to do that. On the six shared-cached routes the cache then collapses
     * it: the header and the body are stored together, so every cookieless
     * reader gets ONE nonce for up to ten minutes. Measured that day: 4 HITs, 1
     * distinct nonce, against 4 distinct across 4 BYPASS responses.
     *
     * **THIS ASSERTS THE TENSION STILL EXISTS, which means it goes RED when
     * somebody FIXES it.** That is deliberate: the window was ACCEPTED in
     * writing on 2026-08-17 (option A, and it is on the colophon), so it is a
     * standing condition rather than an outstanding bug, and a change to it
     * should be a decision rather than a drift.
     *
     * It could not observe any of that between 2026-08-17 and 2026-08-19,
     * because it read the Report-Only header and enforcement had removed it, so
     * both sides of the comparison were "". It failed rather than passing
     * vacuously, which is the one thing that went right, but a failing
     * assertion that cannot see its subject is not evidence either way.
     *
     * It only runs on a genuine HIT. A cold or bypassed edge says nothing about
     * shared-cache behaviour, and asserting into that would be a check that
     * passes for the wrong reason.
     */
    let warm = await get("/");
    for (let i = 0; i < 5 && (warm.res.headers.get("cf-cache-status") ?? "") !== "HIT"; i += 1) {
      warm = await get("/");
    }
    const warmCf = warm.res.headers.get("cf-cache-status") ?? "(none)";
    if (warmCf === "HIT") {
      const again = await get("/");
      const c1 = nonceOf(warm.res.headers.get(ENFORCED) ?? "");
      const c2 = nonceOf(again.res.headers.get(ENFORCED) ?? "");
      check(
        "csp: cookieless readers on a cache HIT SHARE one nonce (the enforcement blocker, pinned)",
        c1.length > 0 && c1 === c2,
        `two cookieless HITs carried ${JSON.stringify(c1)} and ${JSON.stringify(c2)}. ` +
          `If these now DIFFER the shared-cache tension is gone, which is good news and ` +
          `means the enforcement ruling is unblocked: update workers/app.ts and remove ` +
          `this assertion in the same commit as the decision.`,
      );
      console.log(`  csp: shared-cache nonce reused across cookieless HITs (${c1.slice(0, 8)}…)`);
    } else {
      check(
        "csp: the shared-cache nonce case was actually observed",
        false,
        `never reached a cache HIT on / after 6 attempts (last cf-cache-status ${warmCf}). ` +
          `The blocker assertion examined nothing rather than passing quietly.`,
      );
    }
  }
}

/* --- 15. The draft preview route, on the wire --------------------------- *
 *
 * ONE HALF OF THIS FEATURE IS WIRE-ASSERTABLE AND THE OTHER IS NOT. Stating the
 * gap is the point of this comment, and papering it would be worse than leaving
 * it open.
 *
 * WHAT IS ASSERTED: a well-formed token that was never minted returns the boring
 * 404, and that response is `private, no-store`. That covers the failure path,
 * which is the path every stranger who guesses a URL takes, and it covers the
 * cache header on the response a shared cache would most cheaply store.
 *
 * WHAT IS NOT, AND CANNOT BE FROM HERE: the SUCCESS path. Reaching a 200 needs a
 * live token, and minting one means either a signed-in admin session, which this
 * harness does not have and must not carry, or writing directly into production
 * KV, which would be this harness creating a capability against the live site to
 * check that capabilities work. Neither is acceptable, so the 200 is verified on
 * a local dev server against local KV and local D1, and NOT here.
 *
 * The consequence, stated plainly: **`verify-live` cannot see the preview
 * route's own `headers()` at all.** The 404 below is thrown from the loader, so
 * React Router renders the error boundary and the route's headers export never
 * runs; the `private, no-store` this asserts is the Worker's fail-closed default
 * from `workers/app.ts`, which is a different mechanism reaching the same value.
 * MEASURED on a dev server 2026-08-15, not assumed. `check:headers` reads the
 * route's declaration in source and this reads the wire, and on this route
 * neither one is observing what the other does.
 */

{
  console.log("\n  draft preview links");

  // A well-formed token from the right alphabet and the right length, and one
  // nobody minted. It has to be well formed: a malformed one is refused on
  // shape before anything is looked up, so it would prove only that the regex
  // runs, not that an unknown token is refused.
  const UNMINTED = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";
  check(
    "the probe token is the shape a real one has",
    UNMINTED.length === 43 && /^[A-Za-z0-9_-]+$/.test(UNMINTED),
    `${UNMINTED.length} characters. A malformed token is refused on shape, which ` +
      `would make the assertions below prove something weaker than they claim.`,
  );

  const preview = await get(`/preview/${UNMINTED}`);
  check(
    "an unminted preview token is a 404",
    preview.status === 404,
    `status ${preview.status}`,
  );
  check(
    "the preview 404 is the post route's boring one",
    // Delimited by the element boundaries the error boundary renders it inside,
    // so a match cannot come from prose elsewhere on the document.
    preview.text.includes(">The requested page could not be found.<"),
    "a distinguishable 404 tells a caller whether a token ever existed",
  );
  check(
    "the preview 404 is private, no-store",
    (preview.res.headers.get("cache-control") ?? "").includes("no-store"),
    `cache-control is ${JSON.stringify(preview.res.headers.get("cache-control"))}. ` +
      `Workers Cache does not key on cookies, so a cacheable response on this ` +
      `path is a draft in a shared cache entry.`,
  );
  check(
    "the preview 404 is not publicly cacheable",
    !/public/i.test(preview.res.headers.get("cache-control") ?? ""),
    "a copy-paste of blog.$slug.tsx's headers() is the exact edit this catches",
  );

  // robots.txt, which is hygiene rather than the control, asserted because it
  // was ratified and because a line nobody checks is a line that gets dropped.
  const robots = await get("/robots.txt");
  /*
   * SCOPED-BY the newlines around the directive. robots.txt has no elements to
   * delimit with, so the `>needle<` form has nothing to bite on; a whole line
   * bounded by newlines is the equivalent delimitation in a line-oriented
   * document, and it is what stops `Disallow: /preview` matching inside a
   * longer path such as `Disallow: /preview-of-something`.
   */
  check(
    "robots.txt disallows /preview",
    // SCOPED-BY the newlines bounding one whole directive line.
    robots.text.includes("\nDisallow: /preview\n"),
    "advisory, not the control. The header is the control.",
  );
  check(
    "robots.txt still disallows /admin",
    // SCOPED-BY the newlines bounding one whole directive line.
    robots.text.includes("\nDisallow: /admin\n"),
    "the paired assertion: a robots.txt that lost both would satisfy neither, and " +
      "an added line is the likeliest way to break the existing one",
  );
}

/* --- 16. The public script set on the wire is the enhancements alone ---- */

/*
 * The offline half, check:page-payload, proves the BUILD's shape: the
 * bundles are served verbatim and hydration is opt-in in source. This is the
 * wire half, and since the public plane stopped hydrating (2026-08-26) the
 * claim inverted: the deployed post page must reference the enhancement
 * bundles and NOTHING else. No framework chunks, no modulepreloads at all:
 * a modulepreload reappearing means <Scripts> is back on a public page.
 *
 * The expected stems are the app/enhance/ module basenames (a ?url asset is
 * dist/<name>.js emitted as <name>-<hash>.js), derived from the SOURCE
 * listing rather than the build so a standalone run does not need a fresh
 * build on this disk. Compared by STEM (chunkStem, imported from the gate so
 * the two halves share one definition): same bundles under different hashes
 * is a stale-disk observation; a foreign stem is the defect.
 *
 * The post page is the subject because it carries the largest set (palette,
 * theme, blog); Ask's bundle rides on /search and is covered by the Ask
 * probes' own surface.
 */
{
  const { text, status } = await get(`/blog/${SLUG}`);
  check("payload: post page fetched for the script-set comparison", status === 200);

  const enhanceStems = new Set(
    readdirSync(join(root, "app", "enhance"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => f.replace(/\.ts$/, "")),
  );
  check(
    "payload: the enhancement module listing is non-empty",
    enhanceStems.size > 0,
    "app/enhance/ lists no modules, so the comparison below would expect nothing",
  );

  /** @type {string[]} */
  const scriptSrcs = [];
  for (const script of text.match(/<script[^>]*\bsrc="\/assets\/[^"]+\.js"[^>]*>/g) ?? []) {
    const src = script.match(/src="\/assets\/([^"]+\.js)"/);
    if (src) scriptSrcs.push(src[1]);
  }
  const preloads = text.match(/<link[^>]*rel="modulepreload"[^>]*>/g) ?? [];

  // Scope, proven non-empty before the comparison is read: a page shape
  // change that removed every match would otherwise agree with any walk.
  check(
    "payload: the live page references at least one script",
    scriptSrcs.length > 0,
    "zero script-src references found; the enhancement tags vanished or this extraction moved",
  );
  check(
    "payload: the live post page carries no modulepreload",
    preloads.length === 0,
    `${preloads.length} modulepreload link(s) on a public page: the framework is ` +
      `riding on the public plane again`,
  );
  const foreign = scriptSrcs.map(chunkStem).filter((stem) => !enhanceStems.has(stem)).sort();
  check(
    "payload: every live script src is an enhancement bundle",
    foreign.length === 0,
    `non-enhancement stem(s) on the wire: [${foreign.join(", ")}]`,
  );
}

/* --- 17. A post image on the wire is a link to its original ------------- */

/*
 * The deployed half of the image-link fallback. `check:browser` drives the
 * same claim against a preview build; this asks the DEPLOYED origin, which is
 * the only instrument that can see a href whose target the live bucket does
 * not actually hold.
 *
 * TWO ASSERTIONS, and the second is the one worth the round trip. That the
 * markup carries `class="image-link"` is a build fact the offline gates
 * already cover. That the URL inside it ANSWERS 200 WITH AN IMAGE is a fact
 * about R2 and the transform route on this deployment, and a fallback that
 * 404s is worse than the bare image it replaced.
 *
 * The post is FOUND, never named: a slug pinned here goes stale the day the
 * post is retitled, and which post carries a picture is the corpus's business.
 *
 * WHEN THE CORPUS CARRIES NO IMAGE this REPORTS and does not fail. Measured
 * 2026-08-26: zero body images across the 12 posts, so there is nothing on the
 * wire to look at, and that is a content fact rather than a regression. It is
 * printed rather than silent for the reason every skip in this repo is: an
 * unobserved claim and a satisfied one must not look the same from outside.
 */
{
  const artifact = JSON.parse(
    readFileSync(join(root, "content", "generated", "posts.json"), "utf8"),
  );
  const slugs = artifact.posts
    .filter((/** @type {any} */ p) => p.draft !== true)
    .map((/** @type {any} */ p) => p.slug);

  check(
    "image-link: the published corpus is non-empty",
    slugs.length > 0,
    "no published post to search, so the search below would report a clean absence",
  );

  /** @type {{ slug: string, href: string } | null} */
  let found = null;
  for (const slug of slugs) {
    const { text, status } = await get(`/blog/${slug}`);
    if (status !== 200) continue;
    // The anchor and its image together. The class alone would match a stylesheet
    // reference or a stray attribute; this is the pair the fallback consists of.
    const match = text.match(/<a class="image-link" href="([^"]+)"><img\b/);
    if (match) {
      found = { slug, href: match[1] };
      break;
    }
  }

  if (found === null) {
    console.log(
      `  REPORT  no body image in the live corpus (${slugs.length} published post(s) ` +
        `searched), so the image-link fallback has no instance on the wire. The ` +
        `pipeline wrap is covered by test/post-image-links.test.mjs.`,
    );
  } else {
    const { res, status } = await get(found.href);
    const type = res.headers.get("content-type") ?? "";
    check(
      `image-link: /blog/${found.slug} wraps its image in an anchor to ${found.href}`,
      // Anchored: `?w=` in the href is exactly the defect this replaces, so a
      // "contains the key" test would agree with the bug.
      !found.href.includes("?"),
      `the href carries a query, so it is a transform of the original rather than ` +
        `the original: ${found.href}`,
    );
    check(
      `image-link: ${found.href} serves an image`,
      status === 200 && type.startsWith("image/"),
      `answered ${status} ${JSON.stringify(type)}`,
    );
  }
}

/* --- Report ------------------------------------------------------------ */

console.log(`\n${passed} passed, ${failures.length} failed`);

/*
 * THE FLOOR. Same fail-closed shape as MINIMUM_GATES in check-all.mjs.
 *
 * This harness had NO floor on its own pass count until 2026-08-11, so most of
 * its assertions could have stopped executing and the run would still report
 * "0 failed" and exit 0. Whole sections sit inside `if` blocks and loops over
 * fetched data: a route that starts 404ing, an empty corpus, or an early return
 * skips its assertions silently, and a shrinking pass count at zero failures is
 * exactly what that looks like from outside.
 *
 * MEASURED THROUGH A REAL RUN, 2026-08-11: 206 executed, 0 failed, against a
 * 12 post corpus and 40 assets.
 *
 * The first value committed was 90, and it was WRONG in the way this whole
 * session is about. It was derived by counting 99 static `check()` call sites
 * in the source and taking a slack ten percent, without ever running the thing.
 * But the static sites are not the assertions: most sit inside loops over the
 * corpus, the assets and the colophon's seven sections, so the real count is
 * 206. A floor of 90 would have let 116 assertions, more than half of them,
 * vanish in silence while the floor reported itself satisfied.
 *
 * That is the same defect as a threshold set outside its input's reachable
 * range, which is the class check:assertions rule (c) is honest about not being
 * able to see, and it survived review of the commit that introduced it. Measure
 * anti-vacuity floors THROUGH the pipeline they guard, not off the source.
 *
 * 180 leaves 26 for legitimate downward variance: the Ask rate limit SKIPS
 * probes rather than failing them, and several loops take their arity from the
 * corpus. It is a FLOOR, not a target, and it only ever moves on a deliberate
 * edit in the same commit as the change that moves it.
 *
 * TWO data points now, and they agree exactly:
 *
 *   2026-08-11, version c4a9c9db   206 passed, 0 failed
 *   2026-08-11, version d4fee64b   206 passed, 0 failed
 *
 * The first was taken against a 12 post corpus and 40 assets, the second after
 * six gate repairs, and both read 206 with the Ask probes unthrottled. The
 * variance this comment worried about did not appear, so 180 stays rather than
 * being tightened on two identical readings: the downward variance it exists to
 * absorb is the RATE-LIMITED run, and neither measurement was one. A third
 * reading taken while Ask is throttled is what would justify moving it.
 *
 * **MOVED TO 201 ON 2026-08-15, AND THE REFUSAL THAT PRECEDED IT WAS RIGHT.**
 *
 * The build session added section 15 and deliberately left this at 180, writing
 * down that seven new static sites SHOULD read 213 but that 213 was arithmetic
 * rather than a measurement. Ship window 4 ran it:
 *
 *   2026-08-15, version 2bf564fa   214 passed, 0 failed
 *
 * **214, not 213.** The arithmetic was wrong, and it was wrong for the dullest
 * possible reason: it added seven to 206, the figure carried in this comment,
 * while the last clean run before it read 207. A floor committed from that sum
 * would have been one low and nobody would ever have found out, because a floor
 * that is slightly too loose has no symptom. That is the whole argument for
 * measuring, reproduced in miniature on the one file that already documents
 * having made the same mistake at 90 against 206.
 *
 * Floored at 201, which is 94 percent of 214. The 13 of slack absorbs the
 * RATE-LIMITED run, where Ask probes are skipped rather than failed, which
 * remains the only downward variance ever hypothesised here and still has never
 * been observed.
 */
const MINIMUM_CHECKS = 201;
const executed = passed + failures.length;
const short = executed < MINIMUM_CHECKS;

/*
 * THE FAILURE LIST PRINTS FIRST, and the floor never short-circuits it.
 *
 * A first draft exited on the floor before reaching this block, so a run that
 * was both short AND failing would report the count and swallow every failing
 * assertion's NAME: the diagnostics thrown away by the very check that exists
 * to make a short run diagnosable. Both conditions are reported, then one exit.
 */
if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(`  - ${f}`);
}

if (short) {
  console.error(
    `\nREFUSED: only ${executed} assertion(s) executed, expected at least ${MINIMUM_CHECKS}.\n` +
      `  Sections were SKIPPED rather than failing. A pass count is not coverage:\n` +
      `  count the assertions that ran, not the ones that passed.`,
  );
}

process.exit(failures.length > 0 || short ? 1 : 0);
