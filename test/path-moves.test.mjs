import test from "node:test";
import assert from "node:assert/strict";

import { movedPathTarget } from "../app/lib/path-moves.mjs";

await test("/blog and everything under it moves to /writing", () => {
  assert.equal(movedPathTarget("/blog"), "/writing");
  assert.equal(movedPathTarget("/blog/"), "/writing/");
  assert.equal(movedPathTarget("/blog/site-search-on-d1"), "/writing/site-search-on-d1");
  assert.equal(movedPathTarget("/blog/site-search-on-d1.md"), "/writing/site-search-on-d1.md");
  assert.equal(movedPathTarget("/blog/tags/cloudflare"), "/writing/tags/cloudflare");
  assert.equal(movedPathTarget("/blog/series/ten-years"), "/writing/series/ten-years");
});

await test("/publications and everything beside or under it moves to /research/publications", () => {
  assert.equal(movedPathTarget("/publications"), "/research/publications");
  assert.equal(movedPathTarget("/publications.bib"), "/research/publications.bib");
  assert.equal(movedPathTarget("/publications.ris"), "/research/publications.ris");
  assert.equal(movedPathTarget("/publications.json"), "/research/publications.json");
  assert.equal(movedPathTarget("/publications/10-3390-v3101815/"), "/research/publications/10-3390-v3101815/");
  assert.equal(
    movedPathTarget("/publications/10-3390-v3101815/dustin-edwards-10-3390-v3101815.pdf"),
    "/research/publications/10-3390-v3101815/dustin-edwards-10-3390-v3101815.pdf",
  );
});

await test("/software/abscissa, renamed Enarratio, moves to /software/enarratio with its twin", () => {
  assert.equal(movedPathTarget("/software/abscissa"), "/software/enarratio");
  assert.equal(movedPathTarget("/software/abscissa/"), "/software/enarratio/");
  assert.equal(movedPathTarget("/software/abscissa.md"), "/software/enarratio.md");
  assert.equal(movedPathTarget("/software/abscissas"), null);
  assert.equal(movedPathTarget("/software/enarratio"), null);
});

await test("the old feed addresses do not move: they keep answering with the feed", () => {
  for (const path of [
    "/blog/rss.xml",
    "/blog/feed.json",
    "/blog/atom.xml",
    "/blog/tags/cloudflare/rss.xml",
    "/blog/tags/cloudflare/feed.json",
    "/blog/series/ten-years/rss.xml",
    "/blog/series/ten-years/feed.json",
  ]) {
    assert.equal(movedPathTarget(path), null, path);
  }
});

await test("/projects moves to /software, and only as a whole path", () => {
  assert.equal(movedPathTarget("/projects"), "/software");
  assert.equal(movedPathTarget("/projects/"), "/software");
  assert.equal(movedPathTarget("/projects/foxhound"), null);
  assert.equal(movedPathTarget("/software"), null);
});

await test("/phage-discovery moves to the roster anchor on every host", () => {
  assert.equal(movedPathTarget("/phage-discovery"), "/teaching/phage-discovery#roster");
  assert.equal(movedPathTarget("/phage-discovery/"), "/teaching/phage-discovery#roster");
  assert.equal(movedPathTarget("/teaching/phage-discovery"), null);
});

await test("/playground and everything under it is retired to the home page", () => {
  for (const path of [
    "/playground",
    "/playground/",
    "/playground/ui",
    "/playground/ui/",
    "/playground/anything/deeper",
    "/playground.md",
  ]) {
    assert.equal(movedPathTarget(path), "/", path);
  }
  // One hop: the home page is not itself moved.
  assert.equal(movedPathTarget("/"), null);
});

await test("a path that only starts with the same letters is not a moved section", () => {
  for (const path of [
    "/blogs",
    "/blogroll",
    "/publicationsx",
    "/playgrounds",
    "/playground-ui",
    "/writing",
    "/research/publications",
    "/",
    "/about",
  ]) {
    assert.equal(movedPathTarget(path), null, path);
  }
  // A post whose slug happens to be named like a feed file is still a post and still moves.
  assert.equal(movedPathTarget("/blog/tags/atom.xml"), "/writing/tags/atom.xml");
});

await test("each old system page moves to /systems with that system chosen, and its twin to /systems.md", () => {
  assert.equal(movedPathTarget("/systems/capsid"), "/systems?system=capsid");
  assert.equal(movedPathTarget("/systems/dustinedwards-info"), "/systems?system=dustinedwards-info");
  assert.equal(movedPathTarget("/systems/capsid.md"), "/systems.md");
  // One page, so the page and its twin themselves do not move.
  for (const path of ["/systems", "/systems.md", "/systems/", "/systems/Capsid", "/systems/capsid/parts", "/systemsx/capsid"]) {
    assert.equal(movedPathTarget(path), null, path);
  }
});
