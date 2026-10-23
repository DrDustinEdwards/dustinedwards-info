import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";

import { declaredRouteModules } from "../scripts/lib/features/anchors.mjs";
import { firstLineOf, navDataProblems, readLabPlace, readLatestPaper, readNavData, readPosts } from "../scripts/lib/nav-data.mjs";
import { NAV_DATA } from "../app/lib/nav-data.generated.mjs";
import { IDENTITY } from "../app/lib/identity.generated.mjs";
import { longDateUTC } from "../app/lib/long-date.mjs";
import { newestFirst } from "../app/lib/post-order.mjs";
import { seriesSlug } from "../app/lib/series-path.mjs";
import { ROUTED_PATHS, buildNav, isLive, liveMenu, menuLinks, menusAt, visiblePosts } from "../app/lib/nav.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = Date.parse("2026-10-11T12:00:00Z");

/** The panels as the header renders them at NOW, by section id. */
const panels = () => Object.fromEntries(buildNav(NOW).map((item) => [item.menu.id, item.menu]));

/** The non-draft posts, read straight from content/posts and ordered by date, with no help from the nav code. */
function postsOnDisk() {
  const dir = join(root, "content", "posts");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const { data, content } = matter(readFileSync(join(dir, name), "utf8"), {});
      const date = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date);
      return { slug: String(data.slug), title: String(data.title), date, draft: data.draft === true, tags: data.tags ?? [], series: data.series ?? null, body: content };
    });
}

/** The newest paper by the Publications page's own rules, worked out again here from the files. */
function newestPaperOnDisk() {
  const dir = join(root, "content", "publications");
  const papers = readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => ({ ...matter(readFileSync(join(dir, name), "utf8"), {}).data, slug: name.slice(0, -3) }))
    .filter(
      (d) =>
        d.draft !== true &&
        ["article", "review", "chapter", "teaching-resource"].includes(d.type) &&
        d.status !== "submitted",
    )
    .map((d) => ({ ...d, day: d.publishedDate instanceof Date ? d.publishedDate.toISOString().slice(0, 10) : String(d.publishedDate) }));
  papers.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  return papers[0];
}

await test("every page a panel links to outside the markdown set is a route app/routes.ts declares", async () => {
  const routes = await declaredRouteModules();
  assert.deepEqual(
    ROUTED_PATHS.filter((path) => !routes.has(path)),
    [],
  );
});

await test("every link the five panels render resolves: a declared route, a real post, tag, series or paper, or another site", async () => {
  const routes = await declaredRouteModules();
  const posts = postsOnDisk().filter((p) => !p.draft);
  const paper = newestPaperOnDisk();
  let checked = 0;
  for (const item of buildNav(NOW)) {
    assert.ok(routes.has(item.to), `${item.to} is not a declared route`);
    for (const href of menuLinks(item.menu)) {
      checked += 1;
      if (href.startsWith("https://")) continue;
      const path = href.split("#")[0];
      if (routes.has(path)) continue;
      if (path.startsWith("/writing/tags/")) {
        const tag = decodeURIComponent(path.slice("/writing/tags/".length));
        assert.ok(posts.some((p) => p.tags.includes(tag)), `${item.label}: ${href} is a tag no published post has`);
      } else if (path.startsWith("/writing/series/")) {
        const slug = decodeURIComponent(path.slice("/writing/series/".length));
        assert.ok(posts.some((p) => p.series && seriesSlug(p.series) === slug), `${item.label}: ${href} is a series no published post is in`);
      } else if (path.startsWith("/research/publications/")) {
        const slug = path.slice("/research/publications/".length).replace(/\/$/, "");
        assert.ok(existsSync(join(root, "content", "publications", `${slug}.md`)), `${href} has no publication file`);
        assert.equal(slug, paper.slug, "the Research panel links a paper that is not the newest");
      } else if (path.startsWith("/writing/")) {
        assert.ok(posts.some((p) => `/writing/${p.slug}` === path), `${item.label}: ${href} is not a published post`);
      } else {
        assert.fail(`${item.label}: ${href} has no route`);
      }
    }
  }
  assert.ok(checked >= 40, `only ${checked} panel links were examined, so the sweep proves little`);
});

await test("the Lab sign-in link and the 404 page's sections are routes too", async () => {
  const routes = await declaredRouteModules();
  assert.ok(routes.has("/lab"), "the Lab sign-in link (the footer's Workspace group) needs /lab");
  assert.ok(routes.has("/search"));
});

await test("the generated data is current: building it again from the content gives the file the header imports", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(NAV_DATA)), JSON.parse(JSON.stringify(readNavData())));
});

await test("a link whose page is not written stays out, with the tile, row or spotlight it empties, and returns once the page exists", () => {
  const menus = menusAt(NOW);
  const unwritten = new Set(["/teaching/virus-isolation", "/teaching/study-skills", "/contact", "/teaching#join-the-lab"]);
  const before = liveMenu(menus.teaching, (to) => isLive(to, NOW) && !unwritten.has(to));
  assert.ok(before);
  const gone = menuLinks(before);
  for (const to of unwritten) assert.ok(!gone.includes(to), `${to} is still in the Teaching panel`);
  assert.equal(before.tiles.length, 2);
  assert.equal(before.spotlight, undefined, "the spotlight links a page that is gone, so it goes too");
  // Study help keeps Tutorials; "Questions about a course" lost its only link, so the row went.
  assert.deepEqual(before.rows.map((row) => row.title), ["Study help"]);
  const after = liveMenu(menus.teaching, (to) => isLive(to, NOW));
  assert.ok(after);
  for (const to of unwritten) assert.ok(menuLinks(after).includes(to), `${to} is missing once it is live`);
  assert.equal(after.rows.length, 2);
});

await test("an anchor is live only when its heading is listed, never on its page alone", () => {
  assert.equal(isLive("/teaching"), true);
  assert.equal(isLive("/teaching#join-the-lab"), true);
  assert.equal(isLive("/teaching#courses"), false);
  assert.equal(isLive("/research/publications#2024"), false);
});

await test("Recipes and Software how-tos are links only while their library has a published entry, because an empty library answers 404", () => {
  const published = (profile) =>
    readdirSync(join(root, "content", "procedures"))
      .filter((name) => name.endsWith(".md"))
      .map((name) => matter(readFileSync(join(root, "content", "procedures", name), "utf8"), {}).data)
      .filter((d) => d.profile === profile && d.draft !== true).length;
  assert.equal(isLive("/recipes", NOW), published("recipe") > 0);
  assert.equal(isLive("/software/how-tos", NOW), published("computational") > 0);
  // Protocols is a listed page and always live.
  assert.equal(isLive("/research/protocols", NOW), true);
  // The panels follow: no dead link today, and the row appears the day an entry does.
  const live = (to) => to !== "/recipes" || published("recipe") > 0;
  const about = liveMenu(menusAt(NOW).about, live);
  assert.equal(about.rows.some((r) => r.title === "Interests"), published("recipe") > 0);
  assert.equal(
    buildNav(NOW).find((i) => i.menu.id === "about").menu.rows.some((r) => r.title === "Interests"),
    published("recipe") > 0,
  );
  assert.equal(
    buildNav(NOW).find((i) => i.menu.id === "software").menu.rows.some((r) => r.title === "Software how-tos"),
    published("computational") > 0,
  );
});

await test("a tag, a series or a post nobody published is not live", () => {
  assert.equal(isLive("/writing/tags/no-such-tag", NOW), false);
  assert.equal(isLive("/writing/series/no-such-series", NOW), false);
  assert.equal(isLive("/writing/no-such-post", NOW), false);
  assert.equal(isLive("/research/publications/no-such-paper/", NOW), false);
  assert.equal(isLive("/interests/recipes", NOW), false);
});

await test("the spotlights read real data: the newest paper, the newest article, the lab as the CV states it", () => {
  const all = panels();
  const paper = newestPaperOnDisk();
  assert.equal(all.research.spotlight?.eyebrow, "Latest paper");
  assert.equal(all.research.spotlight?.title, paper.title);
  assert.match(all.research.spotlight?.body ?? "", new RegExp(`${String(paper.publishedDate instanceof Date ? paper.publishedDate.getUTCFullYear() : paper.publishedDate).slice(0, 4)}$`));
  assert.match(all.research.spotlight?.body ?? "", /Journal of Microbiology & Biology Education/);
  // Paper pages take a trailing slash (app/lib/publications/paths.mjs): the address the route serves, with no redirect.
  assert.equal(all.research.spotlight?.to, `/research/publications/${paper.slug}/`);

  const published = postsOnDisk().filter((p) => !p.draft && Date.parse(`${p.date}T00:00:00Z`) <= NOW);
  const newest = published.map((p) => p.date).sort().at(-1);
  const newestPosts = published.filter((p) => p.date === newest);
  assert.equal(all.writing.spotlight?.eyebrow, "Newest");
  const spot = newestPosts.find((p) => p.title === all.writing.spotlight?.title);
  assert.ok(spot, `the Newest spotlight "${all.writing.spotlight?.title}" is not a post dated ${newest}`);
  assert.equal(all.writing.spotlight?.to, `/writing/${spot.slug}`);
  assert.equal(all.writing.spotlight?.body, firstLineOf(spot.body));
  assert.ok(spot.body.replace(/[*_`]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").includes((all.writing.spotlight?.body ?? "").replace(/\.\.\.$/, "").slice(0, 40)));

  assert.equal(all.about.spotlight?.eyebrow, "The lab");
  assert.equal(all.about.spotlight?.title, IDENTITY.department);
  assert.equal(all.about.spotlight?.body, "Tarleton State University, Stephenville, TX");
  const cv = readFileSync(join(root, "content", "cv", "appointments.md"), "utf8");
  assert.ok(cv.includes("Stephenville, TX"), "the town the lab spotlight prints is no longer in the CV");
});

await test("the Writing tiles are the three newest published articles, with their dates, and no draft or future post", () => {
  const tiles = panels().writing.tiles;
  const onDisk = postsOnDisk();
  const drafts = new Set(onDisk.filter((p) => p.draft).map((p) => p.slug));
  assert.ok(drafts.size > 0, "no draft in content/posts, so the exclusion below proves nothing");
  const live = onDisk.filter((p) => !p.draft && Date.parse(`${p.date}T00:00:00Z`) <= NOW);
  const newestThree = live.map((p) => p.date).sort().reverse().slice(0, 3);
  assert.equal(tiles.length, 3);
  for (const tile of tiles) {
    const slug = tile.to.slice("/writing/".length);
    assert.ok(!drafts.has(slug), `${slug} is a draft`);
    const post = live.find((p) => p.slug === slug);
    assert.ok(post, `${slug} is not a published post`);
    assert.equal(tile.label, post.title);
    assert.equal(tile.description, longDateUTC(`${post.date}T00:00:00Z`));
    assert.ok(newestThree.includes(post.date), `${slug} (${post.date}) is not among the three newest dates`);
  }
});

await test("a post scheduled for later is left out until its time, as the listings leave it out", () => {
  const newest = NAV_DATA.posts[0];
  const before = Date.parse(newest.publishAt) - 1000;
  assert.ok(!visiblePosts(before).some((p) => p.slug === newest.slug));
  assert.ok(visiblePosts(Date.parse(newest.publishAt)).some((p) => p.slug === newest.slug));
  const early = buildNav(before).find((item) => item.menu.id === "writing");
  assert.ok(early);
  assert.ok(!menuLinks(early.menu).includes(`/writing/${newest.slug}`));
  assert.equal(isLive(`/writing/${newest.slug}`, before), false);
  assert.equal(isLive(`/writing/${newest.slug}`, before + 2000), true);
});

await test("a draft is never in the nav data even when it is the newest file, and a scheduled post keeps its instant", () => {
  const dir = mkdtempSync(join(tmpdir(), "nav-posts-"));
  try {
    const post = (slug, extra) =>
      writeFileSync(join(dir, `${slug}.md`), `---\ntitle: "T ${slug}"\nslug: ${slug}\ndate: 2030-01-01\ndescription: "d"\ntags: [a]\n${extra}\n---\n\nFirst line of ${slug}. More.\n`);
    post("a-draft", "draft: true");
    post("a-live", "draft: false\nfirst_published: 2029-12-31");
    post("a-scheduled", "draft: false\npublish_at: 2030-06-01T09:00:00Z");
    const posts = readPosts(dir);
    assert.deepEqual(posts.map((p) => p.slug).sort(), ["a-live", "a-scheduled"]);
    assert.equal(posts[0].slug, "a-scheduled", "the later instant leads");
    assert.equal(posts[0].publishAt, "2030-06-01T09:00:00.000Z");
    assert.equal(posts[1].firstLine, "First line of a-live.");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

await test("the Writing panel lists the most-used tags as links, and only series that exist", () => {
  const writing = panels().writing;
  const tags = writing.rows.find((r) => r.title === "Tags");
  assert.ok(tags && tags.links && tags.links.length >= 3);
  const counts = new Map();
  for (const post of NAV_DATA.posts) for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, tags.links.length);
  assert.deepEqual(tags.links.map((l) => l.label), top.map(([name]) => name));
  assert.ok(tags.links.every((l) => l.to === `/writing/tags/${l.label}`));
  // No post is in a series today, so there is no Series row; one appears the day a series does.
  const anySeries = NAV_DATA.posts.some((p) => p.series);
  assert.equal(writing.rows.some((r) => r.title === "Series"), anySeries);
  assert.deepEqual(writing.footer.map((l) => l.to), ["/writing", "/writing/rss.xml", "/search"]);
});

await test("a first line is the first sentence of the first paragraph of prose, without markdown", () => {
  assert.equal(firstLineOf("# Title\n\n:::chart\nx\n:::\n\nA **bold** claim with [a link](/x). Then more."), "A bold claim with a link.");
  assert.equal(firstLineOf("![alt](a.png)\n\n- a list\n\nThe real start.\nSecond line of it."), "The real start.");
  const long = `${"word ".repeat(60)}end.`;
  const cut = firstLineOf(long);
  assert.ok(cut.length <= 160 && cut.endsWith("..."), cut);
  assert.equal(firstLineOf("# Only a heading"), "");
});

await test("a first paragraph that opens with emphasis is prose, and footnote markers and links are taken off", () => {
  assert.equal(firstLineOf("*Italic* opening, then more. Next."), "Italic opening, then more.");
  assert.equal(firstLineOf("**Bold** opening with a note[^1] and a [link](/x). Next."), "Bold opening with a note and a link.");
  assert.equal(firstLineOf("* a list item\n\n*Real* start."), "Real start.", "a bullet is still not prose");
  assert.equal(firstLineOf("1. numbered\n\nAfter it."), "After it.");
});

await test("a content edit that breaks the data does not stop the build: the pieces come back empty, and this test names the problem", () => {
  const empty = mkdtempSync(join(tmpdir(), "nav-empty-"));
  try {
    assert.equal(readLatestPaper(empty), null);
    writeFileSync(join(empty, "broken.md"), "---\ntype: article\ntitle: x\n---\n");
    const problems = [];
    assert.equal(readLatestPaper(empty, problems), null);
    assert.equal(problems.length, 1, "a paper file that cannot be read is named, not thrown");
    // A post with a bad publish_at and a missing field is left out and named, never a RangeError.
    writeFileSync(join(empty, "bad-post.md"), '---\ntitle: "t"\nslug: bad-post\ndate: 2030-01-01\npublish_at: not-a-date\n---\n\nBody.\n');
    const postProblems = [];
    assert.deepEqual(readPosts(empty, postProblems), []);
    assert.ok(postProblems.some((line) => line.startsWith("bad-post.md:")));
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
  assert.equal(readLabPlace("A University Nobody Worked At"), null);
  // The real content is whole: nothing was left out of this build.
  assert.deepEqual(navDataProblems(), []);
  assert.ok(NAV_DATA.latestPaper && NAV_DATA.lab.place, "the snapshot is missing the newest paper or the lab's town");
});

await test("the Newest post and the tile order are the /writing listing's order for posts that share a day", () => {
  // The listing is publish_at desc, then a series together with its latest part first, then row id desc
  // (app/lib/post-order.mjs, app/db/posts.ts); rows are inserted in the build artifact's order (slug
  // ascending, scripts/build-content.mjs), so the id of a post is its place in that artifact.
  const artifact = join(root, "content", "generated", "posts.json");
  if (!existsSync(artifact)) return;
  const rows = JSON.parse(readFileSync(artifact, "utf8")).posts.map((p, i) => ({
    slug: p.slug,
    publishAt: new Date(p.publishAt).toISOString(),
    draft: p.draft,
    series: p.series ?? null,
    part: p.part ?? null,
    id: i + 1,
  }));
  const listing = newestFirst(rows.filter((r) => !r.draft), (r) => r.id).map((r) => r.slug);
  assert.deepEqual(NAV_DATA.posts.map((p) => p.slug), listing);
  assert.equal(panels().writing.spotlight?.to, `/writing/${listing[0]}`);
  assert.deepEqual(panels().writing.tiles.map((t) => t.to), listing.slice(0, 3).map((slug) => `/writing/${slug}`));
});

await test("each Teaching course tile carries its page's own description, read from the page's front matter", () => {
  const tiles = panels().teaching.tiles;
  // Every course tile the menu shows, so a new tile whose page has no description fails here.
  assert.ok(tiles.length > 0 && tiles.every((t) => t.to.startsWith("/teaching/")));
  for (const tile of tiles) {
    const file = join(root, "content", "pages", `teaching-${tile.to.split("/").pop()}.md`);
    const { data } = matter(readFileSync(file, "utf8"), {});
    assert.equal(data.path, tile.to);
    assert.ok(typeof data.description === "string" && data.description !== "", `${tile.to} has no front matter description`);
    assert.equal(tile.description, data.description, `${tile.to}: the tile's line is not the page's description`);
  }
});
