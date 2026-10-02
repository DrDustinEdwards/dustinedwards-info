import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { findWideDashes, renderBody } from "../app/lib/content/pipeline.mjs";
import { CONTENT_PAGE_SECTIONS, CONTENT_PAGES_FROM_DATA, PAGE_FILE_PATHS } from "../app/lib/content-pages.mjs";
import { compilePage, pageSlug } from "../app/lib/pages/compile.mjs";
import { idsIn, pageLinkErrors } from "../app/lib/pages/links.mjs";
import { buildPhages } from "../scripts/lib/phages.mjs";

/* The validation module every page write runs (app/lib/pages/compile.mjs): build:content, sync:content and
 * the page save. These cases show each rule firing, on the real page files with one line changed, so a rule
 * that stopped firing would fail here instead of letting an edit through. */

const pipeline = { renderBody, findWideDashes };
const dir = new URL("../content/pages/", import.meta.url);
const read = (/** @type {string} */ slug) => readFileSync(new URL(`${slug}.md`, dir), "utf8");
/** The phage page draws its table from the phage files (docs/PHAGES.md; test/phages.test.mjs holds those rules). */
const { phages } = await buildPhages();
const compile = (/** @type {string} */ slug, /** @type {string} */ raw) => compilePage({ slug, raw, pipeline, phages });
/** Built from its code point, so this file carries no literal wide dash. */
const WIDE_DASH = String.fromCharCode(0x2014);

/**
 * The errors a changed page raises: asserts it was refused, and returns every message.
 *
 * @param {string} slug
 * @param {(raw: string) => string} mutate
 */
async function refusal(slug, mutate) {
  const raw = read(slug);
  const changed = mutate(raw);
  assert.notEqual(changed, raw, "the mutation changed nothing, so it proves nothing");
  const result = await compile(slug, changed);
  assert.equal(result.ok, false, `${slug} was accepted after the change`);
  return result.ok ? "" : result.errors.join("\n");
}

test("every page file compiles, and every registered path has its file", async () => {
  const files = readdirSync(dir).filter((name) => name.endsWith(".md"));
  const registered = PAGE_FILE_PATHS.filter((path) => !CONTENT_PAGES_FROM_DATA.includes(path)).map(pageSlug);
  assert.deepEqual(files.map((name) => name.slice(0, -3)).sort(), [...registered].sort());
  for (const slug of registered) {
    const result = await compile(slug, read(slug));
    assert.equal(result.ok, true, `${slug}: ${result.ok ? "" : result.errors.join("; ")}`);
  }
});

test("About is a page file: it compiles, and its front matter and its render are held to what check:content and check:links held", async () => {
  const ok = await compile("about", read("about"));
  assert.equal(ok.ok, true, ok.ok ? "" : ok.errors.join("; "));
  assert.match(await refusal("about", (r) => r.replace(/^seo_title: .*$/m, "seo_title: ")), /seo_title is required/);
  assert.match(await refusal("about", (r) => r.replace(/^description: .*$/m, "description: ")), /description is required/);
  assert.match(await refusal("about", (r) => r.replace("path: /about", "path: /elsewhere")), /path is "\/elsewhere"/);
  assert.match(await refusal("about", (r) => `${r}\n![a picture](/media/x.jpg)\n`), /image/);
  assert.match(await refusal("about", (r) => `${r}\n[bad](javascript:alert(1))\n`), /allowlist refused|javascript/i);
  assert.match(await refusal("about", (r) => `${r}\nA sentence ${WIDE_DASH} with a dash.\n`), /wide dash/);
  // The floor: an About with a title and a description but no prose is a blank page that looks like a success.
  assert.match(await refusal("about", (r) => `${r.split("\n---\n")[0]}\n---\n\nToo short.\n`), /floor 200/);
});

test("a path outside the registry is refused, and the message says a save cannot create one", async () => {
  const result = await compile("research-new-thing", read("research-phages"));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /cannot create a new path/);
});

test("front matter: path, required fields, lengths and draft are checked", async () => {
  assert.match(await refusal("research-phages", (r) => r.replace("path: /research/phages", "path: /research/other")), /path is "\/research\/other"/);
  assert.match(await refusal("research-phages", (r) => r.replace(/^title: .*$/m, "title: ")), /title is required/);
  assert.match(await refusal("research-phages", (r) => r.replace(/^description: .*$/m, `description: ${"x".repeat(400)}`)), /description is 400 characters/);
  assert.match(await refusal("research-phages", (r) => r.replace(/^---\n/, "---\ndraft: maybe\n")), /draft is "maybe"/);
});

test("prose rules: a wide dash and a refused link fail", async () => {
  assert.match(await refusal("research-phages", (r) => `${r}\nA sentence ${WIDE_DASH} with a dash.\n`), /wide dash/);
  assert.match(await refusal("research-phages", (r) => `${r}\n[a link](javascript:alert(1))\n`), /allowlist refused|javascript/i);
});

test("structured data: an unknown schema_type fails", async () => {
  assert.match(await refusal("software-capsid", (r) => r.replace(/^schema_type: .*$/m, "schema_type: Spaceship")), /schema_type "Spaceship"/);
});

test("the calculator pages must still state what the calculator prints", async () => {
  assert.match(
    await refusal("research-tools-titer", (r) => r.replace("The titer is", "The titer might be")),
    /the page lacks the calculator's answer/,
  );
  assert.match(
    await refusal("research-tools", (r) => r.replace("](/research/tools/moi)", "](/research/tools/nothing)")),
    /lacks a link to the calculator at \/research\/tools\/moi/,
  );
  assert.match(
    await refusal("teaching-virus-isolation-faq", (r) => r.replace("1.01 x 10^-3", "1.02 x 10^-3")),
    /lysate-per-plate sum/,
  );
});

test("the phage page must say where its table and sections are drawn", async () => {
  assert.match(await refusal("research-phages", (r) => r.replace("<!-- phages:table -->", "")), /exactly once.*it has 0/);
  assert.match(await refusal("research-phages", (r) => r.replace("<!-- phages:sections -->", "")), /exactly once.*it has 0/);
});

test("the named software pages keep their name sections and their two exclusions", async () => {
  assert.match(await refusal("software-capsid", (r) => r.replace(/^## Why the name$/m, "## Origin")), /no "Why the name" section/);
  assert.match(
    await refusal("software-capsid", (r) => r.replace("Its dashboard, the Capsid Portal, is named for the portal protein", "Its dashboard is named")),
    /Capsid Portal/,
  );
  assert.match(await refusal("software-carrel", (r) => `${r}\nSee carrel.dustinedwards.info.\n`), /names the app by its address/);
});

test("the header menu's anchors must stay on their page", async () => {
  const anchored = CONTENT_PAGE_SECTIONS[0];
  assert.ok(anchored, "the registry lists at least one section");
  const [path = "", id = ""] = anchored.split("#");
  const slug = pageSlug(path);
  const result = await compile(slug, read(slug).replace(new RegExp(`^#{2,3} ${id.replaceAll("-", " ")}$`, "im"), () => "## Renamed so the anchor is gone"));
  assert.equal(result.ok, false, `${anchored} was accepted with its heading renamed`);
  assert.match(result.ok ? "" : result.errors.join(" "), new RegExp(`no heading has the id "${id}"`));
});

/** An address book that lists a procedure, one live post and one draft. */
const book = {
  procedurePaths: new Set(["/research/protocols/phage-dna-extraction"]),
  posts: new Map([
    ["/writing/live", true],
    ["/writing/hidden", false],
  ]),
  idsOf: (/** @type {string} */ path) => (path === "/research/phages" ? idsIn('<h3 id="Acorn15">Acorn15</h3>') : null),
};

test("links: a link that provably goes nowhere is refused, and an address the module cannot list passes", () => {
  const errors = pageLinkErrors(
    {
      html: [
        '<a href="/research/nothing-here">a</a>',
        '<a href="/writing/hidden">b</a>',
        '<a href="/research/phages#Nope">c</a>',
        '<a href="/research/phages#Acorn15">fine anchor</a>',
        '<a href="/research/protocols/phage-dna-extraction.md">procedure twin</a>',
        '<a href="/writing/live">live post</a>',
        '<a href="/contact">unlisted namespace</a>',
        '<a href="https://example.org/x">external</a>',
      ].join(""),
    },
    book,
  );
  assert.equal(errors.length, 3, errors.join("\n"));
  assert.ok(errors.some((e) => e.includes("/research/nothing-here")));
  assert.ok(errors.some((e) => e.includes("draft or scheduled post")));
  assert.ok(errors.some((e) => e.includes("#Nope")));
});
