/* JSON Feed 1.1 requires every item to carry content_html or content_text. */

import test from "node:test";
import assert from "node:assert/strict";

import { feedItem } from "../app/lib/json-feed.mjs";

const ORIGIN = "https://example.test";

const FULL = {
  slug: "a-post",
  title: "A post",
  body: "The whole markdown body.\n\nTwo paragraphs of it.",
  description: "One sentence about it.",
  publishAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-20T00:00:00.000Z"),
  coverImage: "/images/cover.webp",
  tags: ["cloudflare", "d1"],
};

test("content_text is the body, verbatim", () => {
  const item = feedItem(FULL, ORIGIN);
  assert.equal(item.content_text, FULL.body);
});

test("a full item carries every field the feed emits, and only those", () => {
  const item = feedItem(FULL, ORIGIN);

  // Sorted and counted, so a field added or dropped fails here by name. The JSON Feed 1.1
  // REQUIRED pair is id and content_text.
  const fields = Object.keys(item).sort();
  assert.deepEqual(fields, [
    "content_text",
    "date_modified",
    "date_published",
    "id",
    "image",
    "summary",
    "tags",
    "title",
    "url",
  ]);

  assert.equal(item.id, `${ORIGIN}/blog/a-post`);
  assert.equal(item.url, `${ORIGIN}/blog/a-post`);
  assert.equal(item.title, "A post");
  assert.equal(item.summary, "One sentence about it.");
  assert.equal(item.date_published, "2026-08-01T00:00:00.000Z");
  assert.equal(item.date_modified, "2026-08-20T00:00:00.000Z");
  assert.deepEqual(item.tags, ["cloudflare", "d1"]);
  assert.equal(item.image, `${ORIGIN}/images/cover.webp`);
});

test("optional fields serialize away rather than emitting null", () => {
  const item = feedItem(
    { ...FULL, description: null, updatedAt: null, coverImage: null, tags: [] },
    ORIGIN,
  );
  const wire = JSON.parse(JSON.stringify(item));
  for (const absent of ["summary", "date_modified", "image", "tags"]) {
    assert.ok(!(absent in wire), `${absent} should be absent from the wire, not null`);
  }
  // The required pair survives the same round trip.
  assert.equal(wire.content_text, FULL.body);
  assert.equal(wire.id, `${ORIGIN}/blog/a-post`);
});
