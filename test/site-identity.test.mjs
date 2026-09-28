import test from "node:test";
import assert from "node:assert/strict";

import { SITE, personJsonLd, personNode } from "../app/lib/seo.ts";

const ORIGIN = "https://example.test";

test("home identity is virologist and department head, under one name", () => {
  assert.equal(SITE.name, "Dustin Edwards");
  assert.match(SITE.role, /Department Head/);
  assert.match(SITE.eyebrow, /virologist/i);
  assert.match(SITE.description, /Department of Biological Sciences/);
  assert.match(SITE.description, /Tarleton State University/);
  assert.match(SITE.description, /retroviruses/);
  assert.match(SITE.description, /bacteriophages/);
  assert.match(SITE.description, /Cloudflare/);
  assert.doesNotMatch(`${SITE.role} ${SITE.eyebrow} ${SITE.description} ${SITE.tagline}`, /full-stack/i);

  for (const person of [personJsonLd(ORIGIN), personNode(ORIGIN)]) {
    assert.equal(person.name, "Dustin Edwards");
    assert.equal(person.jobTitle, SITE.role);
    assert.equal(person.description, SITE.description);
    assert.equal("alternateName" in person, false);
    assert.equal(person.worksFor.department.name, SITE.department);
  }
});
