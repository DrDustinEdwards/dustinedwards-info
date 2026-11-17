/* The model must express a file the SITE places and no POST cites: reading those as unattached
 * beside a delete button is the falsehood this corrects. */

import test from "node:test";
import assert from "node:assert/strict";

import {
  LARGE_FILE_BYTES,
  copySnippetsFor,
  flagsFor,
  suggestedTags,
  tileFlagFor,
  usageStateOf,
} from "../app/lib/media/usage.mjs";

await test("a post citation makes a file used", () => {
  assert.equal(usageStateOf({ postRefs: 1, citations: 0, templateRefs: 0 }), "used");
  assert.equal(usageStateOf({ postRefs: 0, citations: 1, templateRefs: 0 }), "used");
});

await test("THE CASE THAT DID NOT EXIST: repository code alone makes it in template", () => {
  assert.equal(usageStateOf({ postRefs: 0, citations: 0, templateRefs: 1 }), "template");
});

const row = (over = {}) => ({ viewable: true, alt: "", size: 100, twinCount: 0, ...over });

await test("the three flags fire on their own conditions", () => {
  assert.deepEqual(
    flagsFor(row({ twinCount: 1 })).map((f) => f.id),
    ["duplicate", "no-alt"],
  );
  assert.deepEqual(
    flagsFor(row({ alt: "described" })).map((f) => f.id),
    [],
  );
  assert.deepEqual(
    flagsFor(row({ alt: "x", size: LARGE_FILE_BYTES + 1 })).map((f) => f.id),
    ["large"],
  );
});

await test("a document is never flagged for missing alt", () => {
  // 31 of 70 rows are documents. Flagging them would put a permanent warning on
  // nearly half the library for an obligation that does not exist.
  assert.deepEqual(
    flagsFor(row({ viewable: false, alt: "" })).map((f) => f.id),
    [],
  );
});

await test("a tile shows ONE flag, in the ruled precedence", () => {
  const flags = flagsFor(row({ twinCount: 1, alt: "", size: LARGE_FILE_BYTES + 1 }));
  assert.equal(tileFlagFor({ flags, usage: "unattached", twin: "/a.png" }).id, "duplicate");
  const noDup = flagsFor(row({ alt: "", size: 10 }));
  assert.equal(tileFlagFor({ flags: noDup, usage: "unattached", twin: null }).id, "unattached");
  assert.equal(tileFlagFor({ flags: noDup, usage: "used", twin: null }).id, "no-alt");
});

await test("suggested tags read the directory, the year and the season", () => {
  assert.deepEqual(suggestedTags("/phage-hunters/2019-fall-cohort.webp"), [
    "phage hunters",
    "2019",
    "fall",
  ]);
});

await test("a content-addressed key suggests no directory, because it has none", () => {
  // The first segment of `1234abcd.png` is a hash. Offering it as a tag would
  // suggest the reader label a file with its own digest.
  assert.deepEqual(suggestedTags("1234abcd5678ef90.png"), []);
});

await test("an image offers an img tag and carries its alt into the snippets", () => {
  const out = copySnippetsFor({ url: "/a.png", viewable: true, alt: "A plate", base: "a.png" });
  assert.deepEqual(
    out.map((s) => s.label),
    ["Copy address", "Markdown", "HTML tag"],
  );
  assert.equal(out[1].value, "![A plate](/a.png)");
  assert.equal(out[2].value, '<img src="/a.png" alt="A plate">');
});

await test("a document offers an anchor, and the LABEL says so", () => {
  // The distinction the mockup draws: an <img> pointed at a PDF is a broken
  // page, and the label is what stops somebody pressing it.
  const out = copySnippetsFor({
    url: "/p/edwards-2024-phage-genomics.pdf",
    viewable: false,
    alt: "",
    base: "edwards-2024-phage-genomics.pdf",
  });
  assert.deepEqual(
    out.map((s) => s.label),
    ["Copy address", "Markdown", "HTML link"],
  );
  assert.equal(out[1].value, "[edwards 2024 phage genomics](/p/edwards-2024-phage-genomics.pdf)");
  assert.ok(out[2].value.startsWith("<a href="), "a document must not get an img tag");
  assert.ok(!out.some((s) => s.value.includes("<img")), "an img tag reached a document");
});
