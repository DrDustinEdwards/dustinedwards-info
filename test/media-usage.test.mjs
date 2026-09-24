/**
 * The three-state usage model, the per-row flags, and the surfaces that depend
 * on knowing which of the three a file is in.
 *
 * The property under test is not "the function returns a string". It is that
 * the model can express the case the old binary could not: a file the SITE
 * places and no POST cites. Nine cohort photographs are that case, and reading
 * them as unattached beside a delete button is the falsehood this exists to
 * correct.
 *
 * @see app/lib/media/usage.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  LARGE_FILE_BYTES,
  LENS_NOTES,
  USAGE_ORDER,
  USAGE_STATES,
  copySnippetsFor,
  flagsFor,
  suggestedAlt,
  suggestedTags,
  tileFlagFor,
  usageDescriptor,
  usageRank,
  usageStateOf,
} from "../app/lib/media/usage.mjs";

/* ---- the three states ---------------------------------------------------- */

test("a post citation makes a file used", () => {
  assert.equal(usageStateOf({ postRefs: 1, citations: 0, templateRefs: 0 }), "used");
  assert.equal(usageStateOf({ postRefs: 0, citations: 1, templateRefs: 0 }), "used");
});

test("THE CASE THAT DID NOT EXIST: repository code alone makes it in template", () => {
  // The nine roster photographs. Before this model they returned the same
  // answer as a genuine orphan.
  assert.equal(usageStateOf({ postRefs: 0, citations: 0, templateRefs: 1 }), "template");
});

test("no evidence at all is unattached", () => {
  assert.equal(usageStateOf({ postRefs: 0, citations: 0, templateRefs: 0 }), "unattached");
});

test("used beats in template, because it is the claim that names a post", () => {
  assert.equal(usageStateOf({ postRefs: 1, citations: 0, templateRefs: 3 }), "used");
  assert.equal(usageStateOf({ postRefs: 0, citations: 2, templateRefs: 9 }), "used");
});

test("every state carries a title and a note, and they are all different", () => {
  const ids = Object.keys(USAGE_STATES);
  assert.deepEqual(ids.sort(), ["template", "unattached", "used"]);
  const titles = new Set();
  const notes = new Set();
  for (const id of ids) {
    const d = usageDescriptor(id);
    assert.equal(d.id, id);
    assert.ok(d.label.length > 0, `${id} has no label`);
    assert.ok(d.title.length > 0, `${id} has no title`);
    assert.ok(d.note.length > 20, `${id} note is too short to say anything`);
    titles.add(d.title);
    notes.add(d.note);
  }
  // A dot with the same sentence beside it in every state is a dot with no
  // sentence beside it.
  assert.equal(titles.size, 3, "two states share a title");
  assert.equal(notes.size, 3, "two states share a note");
});

test("the unattached note never claims the file is unused", () => {
  // Beside a delete button, "unused" reads as permission; the note has to leave the doubt in.
  const note = usageDescriptor("unattached").note;
  assert.doesNotMatch(note, /\bis unused\b/i, "the note claims the file is unused");
  assert.notEqual(note, usageDescriptor("used").note);
});

test("an unknown state degrades to unattached rather than throwing", () => {
  // A row whose state came from a stale column must render a card, not a stack
  // trace, and the safe default is the one that tells you to check.
  assert.equal(usageDescriptor("nonsense").id, "unattached");
  assert.equal(usageRank("nonsense"), USAGE_ORDER.length);
});

test("the usage sort orders most attached first", () => {
  assert.ok(usageRank("used") < usageRank("template"));
  assert.ok(usageRank("template") < usageRank("unattached"));
});

/* ---- flags --------------------------------------------------------------- */

const row = (over = {}) => ({ viewable: true, alt: "", size: 100, twinCount: 0, ...over });

test("the three flags fire on their own conditions", () => {
  assert.deepEqual(flagsFor(row({ twinCount: 1 })).map((f) => f.id), ["duplicate", "no-alt"]);
  assert.deepEqual(flagsFor(row({ alt: "described" })).map((f) => f.id), []);
  assert.deepEqual(
    flagsFor(row({ alt: "x", size: LARGE_FILE_BYTES + 1 })).map((f) => f.id),
    ["large"],
  );
});

test("a document is never flagged for missing alt", () => {
  // 31 of 70 rows are documents. Flagging them would put a permanent warning on
  // nearly half the library for an obligation that does not exist.
  assert.deepEqual(flagsFor(row({ viewable: false, alt: "" })).map((f) => f.id), []);
});

test("whitespace is not alt text", () => {
  assert.deepEqual(flagsFor(row({ alt: "   " })).map((f) => f.id), ["no-alt"]);
});

test("exactly on the boundary is not over it", () => {
  assert.deepEqual(flagsFor(row({ alt: "x", size: LARGE_FILE_BYTES })).map((f) => f.id), []);
});

test("all three can hold at once, which is why flags are a list", () => {
  assert.deepEqual(
    flagsFor(row({ twinCount: 2, alt: "", size: LARGE_FILE_BYTES + 1 })).map((f) => f.id),
    ["duplicate", "no-alt", "large"],
  );
});

/* ---- the one dot a tile shows -------------------------------------------- */

test("a tile shows ONE flag, in the ruled precedence", () => {
  const flags = flagsFor(row({ twinCount: 1, alt: "", size: LARGE_FILE_BYTES + 1 }));
  assert.equal(tileFlagFor({ flags, usage: "unattached", twin: "/a.png" }).id, "duplicate");
  const noDup = flagsFor(row({ alt: "", size: 10 }));
  assert.equal(tileFlagFor({ flags: noDup, usage: "unattached", twin: null }).id, "unattached");
  assert.equal(tileFlagFor({ flags: noDup, usage: "used", twin: null }).id, "no-alt");
});

test("a clean tile shows no dot at all", () => {
  assert.equal(tileFlagFor({ flags: [], usage: "used", twin: null }), null);
});

test("the duplicate dot names its twin when there is one", () => {
  const flags = flagsFor(row({ twinCount: 1, alt: "x" }));
  assert.equal(tileFlagFor({ flags, usage: "used", twin: "/b.png" }).title, "Duplicate of /b.png");
  assert.equal(tileFlagFor({ flags, usage: "used", twin: null }).title, "Duplicate");
});

/* ---- lens notes ---------------------------------------------------------- */

test("every lens that narrows has a note explaining what it claims", () => {
  for (const id of ["unattached", "duplicates", "no-alt", "large"]) {
    assert.ok((LENS_NOTES[id] ?? "").length > 30, `${id} has no usable note`);
  }
});

/* ---- suggestions --------------------------------------------------------- */

test("suggested alt is the words, matching the document card exactly", () => {
  assert.equal(suggestedAlt("edwards-2024-phage-genomics.pdf"), "edwards 2024 phage genomics");
  assert.equal(suggestedAlt("2019.webp"), "2019");
  assert.equal(suggestedAlt(""), "");
});

test("suggested tags read the directory, the year and the season", () => {
  assert.deepEqual(suggestedTags("/phage-hunters/2019-fall-cohort.webp"), [
    "phage hunters",
    "2019",
    "fall",
  ]);
});

test("a content-addressed key suggests no directory, because it has none", () => {
  // The first segment of `1234abcd.png` is a hash. Offering it as a tag would
  // suggest the reader label a file with its own digest.
  assert.deepEqual(suggestedTags("1234abcd5678ef90.png"), []);
});

test("suggested tags are deduplicated and lowercased", () => {
  const out = suggestedTags("/Talks/2026/asm-2026-fall.pdf");
  assert.deepEqual(out, ["talks", "2026", "fall"]);
  assert.equal(new Set(out).size, out.length);
});

/* ---- copy snippets, whose labels adapt ----------------------------------- */

test("an image offers an img tag and carries its alt into the snippets", () => {
  const out = copySnippetsFor({ url: "/a.png", viewable: true, alt: "A plate", base: "a.png" });
  assert.deepEqual(out.map((s) => s.label), ["Copy address", "Markdown", "HTML tag"]);
  assert.equal(out[1].value, "![A plate](/a.png)");
  assert.equal(out[2].value, '<img src="/a.png" alt="A plate">');
});

test("a document offers an anchor, and the LABEL says so", () => {
  // The distinction the mockup draws: an <img> pointed at a PDF is a broken
  // page, and the label is what stops somebody pressing it.
  const out = copySnippetsFor({
    url: "/p/edwards-2024-phage-genomics.pdf",
    viewable: false,
    alt: "",
    base: "edwards-2024-phage-genomics.pdf",
  });
  assert.deepEqual(out.map((s) => s.label), ["Copy address", "Markdown", "HTML link"]);
  assert.equal(out[1].value, "[edwards 2024 phage genomics](/p/edwards-2024-phage-genomics.pdf)");
  assert.ok(out[2].value.startsWith("<a href="), "a document must not get an img tag");
  assert.ok(!out.some((s) => s.value.includes("<img")), "an img tag reached a document");
});

test("an image with no alt still produces a snippet, with an empty alt attribute", () => {
  const out = copySnippetsFor({ url: "/a.png", viewable: true, alt: null, base: "a.png" });
  assert.equal(out[2].value, '<img src="/a.png" alt="">');
});

test("every snippet carries an accessible name that is not its visible label", () => {
  // The visible label sits under a heading that supplies the verb for a sighted
  // reader and supplies nothing to anyone else.
  for (const viewable of [true, false]) {
    const out = copySnippetsFor({ url: "/a", viewable, alt: "", base: "a.png" });
    for (const s of out) {
      assert.ok(s.name.trim().length > 0, `${s.id} has no accessible name`);
      assert.notEqual(s.name, s.label, `${s.id} name and label are the same string`);
    }
    assert.equal(new Set(out.map((s) => s.name)).size, out.length, "two snippets share a name");
  }
});

test("the accessible names say which FORM they copy, not just that they copy", () => {
  const img = copySnippetsFor({ url: "/a", viewable: true, alt: "", base: "a.png" });
  const doc = copySnippetsFor({ url: "/a.pdf", viewable: false, alt: "", base: "a.pdf" });
  assert.ok(img[2].name.includes("image"), img[2].name);
  assert.ok(doc[2].name.includes("link"), doc[2].name);
});
