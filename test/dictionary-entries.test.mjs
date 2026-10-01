import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

import { CONTENT_PAGE_PATHS, contentPageMarkdownBody, contentPageSearchInputs } from "../app/lib/content-pages.mjs";
import {
  DICTIONARY_ENTRIES,
  definedTermJsonLd,
  dictionaryEntryFor,
  dictionaryEntryMarkdown,
  listenLabel,
} from "../app/lib/dictionary-entries.mjs";

const PATHS = ["/software/capsid", "/software/enarratio", "/software/carrel"];

/** Built from its code point so this file carries no dash of its own. */
const EM_DASH = String.fromCharCode(0x2014);

test("each named software page has its entry, and each entry is a listed page", () => {
  assert.deepEqual(
    DICTIONARY_ENTRIES.map((entry) => entry.path),
    PATHS,
  );
  for (const path of PATHS) assert.ok(/** @type {readonly string[]} */ (CONTENT_PAGE_PATHS).includes(path), path);
});

test("every entry is complete: IPA between slashes, a respelling, two senses and an origin", () => {
  for (const entry of DICTIONARY_ENTRIES) {
    assert.match(entry.ipa, /^\/.+\/$/, entry.term);
    assert.match(entry.respelling, /^[A-Za-z-]+$/, entry.term);
    assert.equal(entry.syllables.replaceAll("·", ""), entry.term.toLowerCase());
    assert.equal(entry.senses.length, 2);
    assert.ok(entry.etymology.length > 0);
    assert.equal(listenLabel(entry.term), `Listen to the pronunciation of ${entry.term}`);
  }
});

test("the entries say nothing possessive about the owner and carry no em dash", () => {
  const text = JSON.stringify(DICTIONARY_ENTRIES);
  assert.ok(!text.includes("Dustin"));
  assert.ok(!text.includes(EM_DASH));
});

test("each clip is a small MP3 served from the site's own origin", () => {
  for (const entry of DICTIONARY_ENTRIES) {
    assert.match(entry.audio, /^\/audio\/[a-z]+\.mp3$/);
    const file = new URL(`../public${entry.audio}`, import.meta.url);
    const bytes = readFileSync(file);
    // An MPEG audio frame sync, not an HTML error page saved under an .mp3 name.
    assert.equal(bytes[0], 0xff, entry.audio);
    assert.equal((bytes[1] ?? 0) & 0xe0, 0xe0, entry.audio);
    assert.ok(statSync(file).size < 32 * 1024, `${entry.audio} is ${statSync(file).size} bytes`);
  }
});

test("the markdown twin carries the same entry under its title", () => {
  const twin = contentPageMarkdownBody({ path: "/software/enarratio", title: "Enarratio", markdown: "Body.\n" });
  assert.ok(twin.startsWith("# Enarratio\n\n**e·nar·ra·ti·o** /ˌɛn.ɑˈrɑ.ti.oʊ/ (en-ar-RAH-tee-oh), *noun*."), twin);
  assert.ok(twin.includes("[Pronunciation audio](/audio/enarratio.mp3)"));
  assert.ok(twin.includes("1. In ancient grammar, a teacher’s detailed explanation"));
  assert.ok(twin.includes("2. *software.* An open-source toolkit"));
  assert.ok(twin.includes("Etymology: Latin, from *enarrare*, “to explain in detail”"));
  assert.ok(twin.endsWith("Body.\n"));
  const plain = contentPageMarkdownBody({ path: "/software/foxing", title: "Foxing", markdown: "Body.\n" });
  assert.equal(plain, "# Foxing\n\nBody.\n");
});

test("the search record leads with the entry, so the definition is findable", () => {
  const [record] = contentPageSearchInputs([
    { path: "/software/carrel", title: "Carrel", description: "d", markdown: "Intro.\n", toc: [] },
  ]);
  assert.ok(record?.intro.startsWith("Carrel (car·rel), /ˈkɛr.əl/, KAIR-uhl, noun."), record?.intro);
});

test("the DefinedTerm describes the software (sense 2) and sits in the Software set", () => {
  const entry = dictionaryEntryFor("/software/capsid");
  assert.ok(entry);
  const ld = definedTermJsonLd(entry, "https://example.test");
  assert.equal(ld["@type"], "DefinedTerm");
  assert.equal(ld.name, "Capsid");
  assert.equal(ld.description, entry.senses[1]);
  assert.equal(ld.inDefinedTermSet.url, "https://example.test/software");
});

test("the colophon links the Carrel page", () => {
  const page = readFileSync(new URL("../content/pages/software-carrel.md", import.meta.url), "utf8");
  assert.ok(!page.includes("carrel.dustinedwards.info"));
  // Nor its code (Dustin, 2026-09-28): the repository is public only for now, so a link would rot.
  assert.ok(!/github\.com\/DrDustinEdwards\/carrel/i.test(page), "the Carrel page links its code repository");
  const colophon = readFileSync(new URL("../app/routes/colophon.tsx", import.meta.url), "utf8");
  assert.ok(colophon.includes("<Link to={CARREL_PAGE_PATH}>{CARREL_NAME}</Link>"));
});

test("sense 2 of each entry is Dustin's wording, labelled software. (2026-09-28)", () => {
  const want = {
    Capsid: "A system that stores the instructions and decisions of AI agents and coordinates their work within and across projects.",
    Enarratio:
      "An open-source toolkit that renders scientific figures on the server and makes each readable by people, screen readers, and AI agents.",
    Carrel: "A private workspace for writing, in which drafts are composed, revised, and published.",
  };
  for (const entry of DICTIONARY_ENTRIES) {
    assert.equal(entry.senses[1], want[entry.term], entry.term);
    assert.deepEqual(entry.senseLabels, [null, "software"], entry.term);
    const lines = dictionaryEntryMarkdown(entry).split("\n");
    assert.ok(lines.includes(`2. *software.* ${want[entry.term]}`), `${entry.term}: the twin's sense 2 line`);
    assert.equal(definedTermJsonLd(entry, "https://example.test").description, want[entry.term]);
  }
});

