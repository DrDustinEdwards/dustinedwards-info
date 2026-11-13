import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  firstLineOf,
  navDataProblems,
  readLabPlace,
  readLatestPaper,
  readPosts,
} from "../scripts/lib/nav-data.mjs";
import { NAV_DATA } from "../app/lib/nav-data.generated.mjs";
import { newestFirst } from "../app/lib/post-order.mjs";
import { buildNav, isLive, liveMenu, menuLinks, menusAt, visiblePosts } from "../app/lib/nav.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = Date.parse("2026-10-11T12:00:00Z");

/** The panels as the header renders them at NOW, by section id. */
const panels = () => Object.fromEntries(buildNav(NOW).map((item) => [item.menu.id, item.menu]));

await test("a link whose page is not written stays out, with the tile, row or spotlight it empties, and returns once the page exists", () => {
  const menus = menusAt(NOW);
  const unwritten = new Set([
    "/teaching/virus-isolation",
    "/teaching/study-skills",
    "/contact",
    "/teaching#join-the-lab",
  ]);
  const before = liveMenu(menus.teaching, (to) => isLive(to, NOW) && !unwritten.has(to));
  assert.ok(before);
  const gone = menuLinks(before);
  for (const to of unwritten) assert.ok(!gone.includes(to), `${to} is still in the Teaching panel`);
  assert.equal(before.tiles.length, 2);
  assert.equal(
    before.spotlight,
    undefined,
    "the spotlight links a page that is gone, so it goes too",
  );
  // Study help keeps Tutorials; "Questions about a course" lost its only link, so the row went.
  assert.deepEqual(
    before.rows.map((row) => row.title),
    ["Study help"],
  );
  const after = liveMenu(menus.teaching, (to) => isLive(to, NOW));
  assert.ok(after);
  for (const to of unwritten)
    assert.ok(menuLinks(after).includes(to), `${to} is missing once it is live`);
  assert.equal(after.rows.length, 2);
});

await test("an anchor is live only when its heading is listed, never on its page alone", () => {
  assert.equal(isLive("/teaching"), true);
  assert.equal(isLive("/teaching#join-the-lab"), true);
  assert.equal(isLive("/teaching#courses"), false);
  assert.equal(isLive("/research/publications#2024"), false);
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
      writeFileSync(
        join(dir, `${slug}.md`),
        `---\ntitle: "T ${slug}"\nslug: ${slug}\ndate: 2030-01-01\ndescription: "d"\ntags: [a]\n${extra}\n---\n\nFirst line of ${slug}. More.\n`,
      );
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

await test("a first line is the first sentence of the first paragraph of prose, without markdown", () => {
  assert.equal(
    firstLineOf("# Title\n\n:::chart\nx\n:::\n\nA **bold** claim with [a link](/x). Then more."),
    "A bold claim with a link.",
  );
  assert.equal(
    firstLineOf("![alt](a.png)\n\n- a list\n\nThe real start.\nSecond line of it."),
    "The real start.",
  );
  const long = `${"word ".repeat(60)}end.`;
  const cut = firstLineOf(long);
  assert.ok(cut.length <= 160 && cut.endsWith("..."), cut);
  assert.equal(firstLineOf("# Only a heading"), "");
});

await test("a first paragraph that opens with emphasis is prose, and footnote markers and links are taken off", () => {
  assert.equal(firstLineOf("*Italic* opening, then more. Next."), "Italic opening, then more.");
  assert.equal(
    firstLineOf("**Bold** opening with a note[^1] and a [link](/x). Next."),
    "Bold opening with a note and a link.",
  );
  assert.equal(
    firstLineOf("* a list item\n\n*Real* start."),
    "Real start.",
    "a bullet is still not prose",
  );
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
    writeFileSync(
      join(empty, "bad-post.md"),
      '---\ntitle: "t"\nslug: bad-post\ndate: 2030-01-01\npublish_at: not-a-date\n---\n\nBody.\n',
    );
    const postProblems = [];
    assert.deepEqual(readPosts(empty, postProblems), []);
    assert.ok(postProblems.some((line) => line.startsWith("bad-post.md:")));
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
  assert.equal(readLabPlace("A University Nobody Worked At"), null);
  // The real content is whole: nothing was left out of this build.
  assert.deepEqual(navDataProblems(), []);
  assert.ok(
    NAV_DATA.latestPaper && NAV_DATA.lab.place,
    "the snapshot is missing the newest paper or the lab's town",
  );
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
  const listing = newestFirst(
    rows.filter((r) => !r.draft),
    (r) => r.id,
  ).map((r) => r.slug);
  assert.deepEqual(
    NAV_DATA.posts.map((p) => p.slug),
    listing,
  );
  assert.equal(panels().writing.spotlight?.to, `/writing/${listing[0]}`);
  assert.deepEqual(
    panels().writing.tiles.map((t) => t.to),
    listing.slice(0, 3).map((slug) => `/writing/${slug}`),
  );
});
