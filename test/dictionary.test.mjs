import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { findWideDashes } from "../app/lib/content/pipeline.mjs";
import { CONTENT_PAGE_PATHS, contentPageMarkdownBody, contentPageSearchInputs } from "../app/lib/content-pages.mjs";
import { compileDictionaryEntry } from "../app/lib/dictionary/compile.mjs";
import { dictionaryEntryMarkdown, definedTermJsonLd, listenLabel } from "../app/lib/dictionary-entries.mjs";
import { buildDictionary, compileAllDictionary, repoHost } from "../scripts/lib/dictionary.mjs";

/* The validation module every dictionary write runs (app/lib/dictionary/compile.mjs): check:content,
 * build:content, sync:content and the dictionary save. The cases below are the two tests that read the entries
 * when they were code, ported to rules on the files, then one case per rule firing on a real entry with one line
 * changed, so a rule that stopped firing would fail here instead of letting an edit through. */

const PATHS = ["/software/capsid", "/software/enarratio", "/software/carrel"];
const dir = new URL("../content/dictionary/", import.meta.url);
const read = (/** @type {string} */ key) => readFileSync(new URL(`${key}.md`, dir), "utf8");
/** @typedef {Array<{ key: string, path: string }>} Others */
const compile = (/** @type {string} */ key, /** @type {string} */ raw, /** @type {Others} */ others = []) =>
  compileDictionaryEntry({ key, raw, pipeline: { findWideDashes }, host: repoHost, others });
/** Built from its code point, so this file carries no dash of its own. */
const EM_DASH = String.fromCharCode(0x2014);

/**
 * The errors a changed entry raises: asserts it was refused, and returns every message.
 *
 * @param {string} key
 * @param {(raw: string) => string} mutate
 */
async function refusal(key, mutate) {
  const raw = read(key);
  const changed = mutate(raw);
  assert.notEqual(changed, raw, "the mutation changed nothing, so it proves nothing");
  const result = await compile(key, changed);
  assert.equal(result.ok, false, `${key} was accepted after the change`);
  return result.ok ? "" : result.errors.join("\n");
}

async function entries() {
  const all = await compileAllDictionary();
  return all.map((one) => {
    if (!one.compiled.ok) assert.fail(`${one.file}: ${one.compiled.errors.join("; ")}`);
    return one.compiled.entry;
  });
}

test("each named software page has its entry, and each entry is a listed page", async () => {
  const all = await entries();
  assert.deepEqual(all.map((entry) => entry.path).sort(), [...PATHS].sort());
  for (const path of PATHS) assert.ok(/** @type {readonly string[]} */ (CONTENT_PAGE_PATHS).includes(path), path);
});

test("every entry is complete: IPA between slashes, a respelling, two senses and an origin", async () => {
  for (const entry of await entries()) {
    assert.match(entry.ipa, /^\/.+\/$/, entry.term);
    assert.match(entry.respelling, /^[A-Za-z-]+$/, entry.term);
    assert.equal(entry.syllables.replaceAll("·", ""), entry.term.toLowerCase());
    assert.equal(entry.senses.length, 2);
    assert.ok(entry.etymology.length > 0);
    assert.equal(listenLabel(entry.term), `Listen to the pronunciation of ${entry.term}`);
  }
  assert.match(await refusal("capsid", (r) => r.replace(/^ipa: .*$/m, 'ipa: "kap-sid"')), /ipa: sits between slashes/);
  assert.match(await refusal("capsid", (r) => r.replace(/^respelling: .*$/m, "respelling: KAP sid 2")), /respelling: is letters and hyphens/);
  assert.match(await refusal("capsid", (r) => r.replace(/^syllables: .*$/m, 'syllables: "cap·sod"')), /syllables: joined without its dots/);
  assert.match(await refusal("capsid", (r) => r.replace(/^etymology:\n(  - .*\n)+/m, "etymology: []\n")), /etymology: is a list/);
  assert.match(await refusal("capsid", (r) => r.replace(/^senseLabels: .*$/m, "senseLabels: [null, null]")), /senseLabels: is \[null, software\]/);
  assert.match(
    await refusal("capsid", (r) => r.replace(/^senses:\n  - .*\n  - .*\n/m, 'senses:\n  - "Only one."\n')),
    /senses: is exactly two senses/,
  );
  assert.match(await refusal("capsid", (r) => r.replace("  - [la, capsa]", "  - [latin, capsa]")), /etymology\[3\]: is text, or a \[language, word\] pair/);
});

test("the entries say nothing possessive about the owner and carry no em dash", async () => {
  const text = JSON.stringify(await entries());
  assert.ok(!text.includes("Dustin"));
  assert.ok(!text.includes(EM_DASH));
  assert.match(await refusal("carrel", (r) => r.replace("A private workspace", "Dustin's private workspace")), /names the site's owner/);
  assert.match(await refusal("carrel", (r) => `${r}\nA sentence ${EM_DASH} with a dash.\n`), /wide dash/);
});

test("each clip is a small MP3 served from the site's own origin, and a referenced clip must exist", async () => {
  // The repository's own clips: the host reads their first bytes, so the frame sync is judged here (CI), as the
  // old test judged it. A clip that is missing, oversized or not MPEG is refused by the compile.
  for (const entry of await entries()) {
    assert.match(entry.audio, /^\/audio\/[a-z]+\.mp3$/);
    const clip = await repoHost.audio(entry.audio);
    assert.ok(clip, `${entry.audio} is in public/`);
    assert.equal(clip.head?.[0], 0xff, entry.audio);
    assert.equal((clip.head?.[1] ?? 0) & 0xe0, 0xe0, entry.audio);
    assert.ok(clip.size < 32 * 1024, `${entry.audio} is ${clip.size} bytes`);
  }
  assert.match(await refusal("capsid", (r) => r.replace("/audio/capsid.mp3", "/audio/nothing.mp3")), /not in the repository/);
  assert.match(await refusal("capsid", (r) => r.replace("/audio/capsid.mp3", "https://elsewhere.test/capsid.mp3")), /is not a clip under \/audio\//);

  const raw = read("capsid");
  const withClip = (/** @type {{ size: number, head?: number[] }} */ clip) =>
    compileDictionaryEntry({ key: "capsid", raw, pipeline: { findWideDashes }, host: { audio: async () => clip } });
  const big = await withClip({ size: 40_000, head: [0xff, 0xfb] });
  assert.match(big.ok ? "" : big.errors.join(" "), /is 40000 bytes/);
  const notAudio = await withClip({ size: 100, head: [0x3c, 0x21] });
  assert.match(notAudio.ok ? "" : notAudio.errors.join(" "), /does not start with an MPEG audio frame/);
  const workerSide = await withClip({ size: 100 });
  assert.equal(workerSide.ok, true, "the Worker's host cannot read bytes, so the frame sync is judged in CI only");
});

test("the path is a registered Software page, named by the file, and one entry opens it", async () => {
  assert.match(await refusal("capsid", (r) => r.replace("path: /software/capsid", "path: /research/phages")), /not a registered Software page/);
  assert.match(await refusal("capsid", (r) => r.replace("path: /software/capsid", "path: /software/nothing")), /not a registered Software page/);
  assert.match(await refusal("capsid", (r) => r.replace("path: /software/capsid", "path: /software/carrel")), /belongs in content\/dictionary\/carrel\.md/);
  const taken = await compile("capsid", read("capsid"), [{ key: "elder", path: "/software/capsid" }]);
  assert.equal(taken.ok, false);
  assert.match(taken.ok ? "" : taken.errors.join(" "), /already has an entry \(elder\)/);
});

test("front matter: an unknown field and a bad draft flag are refused, and a draft flag is read", async () => {
  assert.match(await refusal("capsid", (r) => r.replace("term: Capsid", "term: Capsid\nspelling: oops")), /spelling: is not a field/);
  assert.match(await refusal("capsid", (r) => r.replace("audio: /audio/capsid.mp3", "audio: /audio/capsid.mp3\ndraft: maybe")), /draft: is "maybe"/);
  const draft = await compile("capsid", read("capsid").replace("audio: /audio/capsid.mp3", "audio: /audio/capsid.mp3\ndraft: true"));
  assert.equal(draft.ok && draft.draft, true);
});

test("the markdown twin carries the same entry under its title", async () => {
  const enarratio = (await entries()).find((entry) => entry.term === "Enarratio");
  assert.ok(enarratio);
  const twin = contentPageMarkdownBody({ path: "/software/enarratio", title: "Enarratio", markdown: "Body.\n" }, enarratio);
  assert.ok(twin.startsWith("# Enarratio\n\n**e·nar·ra·ti·o** /ˌɛn.ɑˈrɑ.ti.oʊ/ (en-ar-RAH-tee-oh), *noun*."), twin);
  assert.ok(twin.includes("[Pronunciation audio](/audio/enarratio.mp3)"));
  assert.ok(twin.includes("1. In ancient grammar, a teacher’s detailed explanation"));
  assert.ok(twin.includes("2. *software.* An open-source toolkit"));
  assert.ok(twin.includes("Etymology: Latin, from *enarrare*, “to explain in detail”"));
  assert.ok(twin.endsWith("Body.\n"));
  // No entry given, no lead: a page without one keeps its plain twin.
  const plain = contentPageMarkdownBody({ path: "/software/foxing", title: "Foxing", markdown: "Body.\n" });
  assert.equal(plain, "# Foxing\n\nBody.\n");
});

test("the search record leads with the entry, so the definition is findable", async () => {
  const carrel = (await entries()).find((entry) => entry.term === "Carrel");
  const page = { path: "/software/carrel", title: "Carrel", description: "d", markdown: "Intro.\n", toc: [] };
  const [record] = contentPageSearchInputs([page], (path) => (path === page.path ? carrel : undefined));
  assert.ok(record?.intro.startsWith("Carrel (car·rel), /ˈkɛr.əl/, KAIR-uhl, noun."), record?.intro);
  const [bare] = contentPageSearchInputs([page]);
  assert.ok(!bare?.intro.includes("KAIR-uhl"), "a page given no entry has no lead in its record");
});

test("the DefinedTerm describes the software (sense 2) and sits in the Software set", async () => {
  const entry = (await entries()).find((e) => e.path === "/software/capsid");
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
  // Nor its code: the repository is public only for now, so a link would rot.
  assert.ok(!/github\.com\/DrDustinEdwards\/carrel/i.test(page), "the Carrel page links its code repository");
  const colophon = readFileSync(new URL("../app/routes/colophon.tsx", import.meta.url), "utf8");
  assert.ok(colophon.includes("<Link to={CARREL_PAGE_PATH}>{CARREL_NAME}</Link>"));
});

test("sense 2 of each entry is the software, labelled software., in the page's twin and its JSON-LD", async () => {
  // The old test pinned each sense to the owner's exact wording, which no Carrel edit could ever change. What
  // survives an edit is the structure: the label, the twin's own line for it and the DefinedTerm's description.
  for (const entry of await entries()) {
    assert.deepEqual(entry.senseLabels, [null, "software"], entry.term);
    const lines = dictionaryEntryMarkdown(entry).split("\n");
    assert.ok(lines.includes(`2. *software.* ${entry.senses[1]}`), `${entry.term}: the twin's sense 2 line`);
    assert.equal(definedTermJsonLd(entry, "https://example.test").description, entry.senses[1]);
  }
});

test("the build rows carry each file's blob sha and hand the pages their published entries", async () => {
  const built = await buildDictionary();
  assert.deepEqual(built.rows.map((row) => row.key).sort(), ["capsid", "carrel", "enarratio"]);
  assert.ok(built.rows.every((row) => row.status === "published" && /^[0-9a-f]{40}$/.test(row.sourceBlobSha)));
  assert.equal(built.entryFor("/software/capsid")?.term, "Capsid");
  assert.equal(built.entryFor("/software/foxing"), undefined);
});
