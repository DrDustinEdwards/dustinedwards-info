/* Form fields are written into YAML frontmatter, so a value carrying YAML punctuation must not be
 * able to add a key or end a list. Unquoted keys refuse such a value by name; tags are quoted. */

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  EMPTY_FIELDS,
  FrontmatterError,
  parsePost,
  serializePost,
} from "../app/lib/editor/frontmatter.ts";

const fields = (overrides) => ({
  ...EMPTY_FIELDS,
  title: "A title",
  slug: "a-post",
  description: "A description.",
  date: "2026-01-01",
  body: "Body.",
  ...overrides,
});

test("A TAG CARRYING YAML PUNCTUATION STAYS ONE TAG and adds no key", () => {
  const hostile = ["plain", "a], draft: false, x: [y", "has # hash", 'quote "in" it'];
  const parsed = parsePost(serializePost(fields({ tags: hostile, draft: true })));
  assert.deepEqual(parsed.tags, hostile);
  assert.equal(parsed.draft, true);
});

test("a plain tag is still written bare, so existing files keep their bytes", () => {
  const raw = serializePost(fields({ tags: ["cloudflare", "machine learning", "d1"] }));
  assert.match(raw, /^tags: \[cloudflare, machine learning, d1\]$/m);
});

test("AN UNQUOTED KEY WITH A NEWLINE OR YAML PUNCTUATION IS REFUSED BY NAME", () => {
  const cases = [
    { slug: "a-post\nfeatured: true" },
    { date: "2026-01-01 # note" },
    { coverSrc: "/media/x.png\ndraft: false", coverAlt: "alt" },
    { part: "1\nseries: x" },
    { updated: "[2026-01-01]" },
    { firstPublished: "2026-01-01: x" },
  ];
  for (const overrides of cases) {
    assert.throws(
      () => serializePost(fields(overrides)),
      (error) => error instanceof FrontmatterError && error.field === Object.keys(overrides)[0],
      JSON.stringify(overrides),
    );
  }
});

test("every committed post still serializes, with the same slug, date and tags", () => {
  const dir = join(import.meta.dirname, "..", "content", "posts");
  const files = readdirSync(dir).filter((name) => name.endsWith(".md"));
  assert.ok(files.length > 0, "no committed posts were read");
  for (const name of files) {
    const before = parsePost(readFileSync(join(dir, name), "utf8"));
    const after = parsePost(serializePost(before));
    assert.equal(after.slug, before.slug, name);
    assert.equal(after.date, before.date, name);
    assert.deepEqual(after.tags, before.tags, name);
  }
});

test("A FURTHER READING VALUE THAT IS NOT A JSON LIST IS REFUSED, never saved as empty", () => {
  for (const furtherReading of ["{not json", '{"title":"x"}']) {
    assert.throws(
      () => serializePost(fields({ furtherReading })),
      (error) => error instanceof FrontmatterError && error.field === "furtherReading",
      furtherReading,
    );
  }
});
