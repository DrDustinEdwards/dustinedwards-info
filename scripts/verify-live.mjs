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

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
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
  const { text: home } = await get("/");
  const href = (home.match(/href="(\/assets\/[^"]+\.css)"/) ?? [])[1];
  check("css: a stylesheet is linked", Boolean(href), home.slice(0, 200));

  if (href) {
    const { text: css, status } = await get(href);
    check("css: stylesheet fetches", status === 200);

    // v3 values, read from the doc rather than from our own source file.
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
    check(
      "css: .btn-danger uses --fill-danger",
      /\.btn-danger\{[^}]*background:var\(--fill-danger\)/.test(css),
    );
    check(
      "css: search mark uses --mark-bg, not brand",
      /\.search-snippet mark\{[^}]*background:var\(--mark-bg\)/.test(css),
    );
    check(
      "css: no :focus-visible rule relies on box-shadow",
      !/:focus-visible\{[^}]*box-shadow/.test(css),
    );
    check(
      "css: theme selectors survived minification",
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
    const res = await fetch(`${ORIGIN}/search/ask?q=${encodeURIComponent(q)}`, {
      headers: { "user-agent": UA, "cache-control": "no-cache" },
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

  check("roster: the page says Roster", page.includes("Roster"));

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

/* --- Report ------------------------------------------------------------ */

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
