import test from "node:test";
import assert from "node:assert/strict";

import { SITE, personJsonLd, personNode } from "../app/lib/seo.ts";

const ORIGIN = "https://example.test";

test("home identity is professor and virologist, under one name", () => {
  assert.equal(SITE.name, "Dustin Edwards");
  assert.equal(SITE.role, "Professor and Virologist");
  assert.equal(SITE.eyebrow, "Professor and Virologist");
  assert.match(SITE.description, /^Professor and Virologist, /);
  assert.match(SITE.description, /Department of Biological Sciences/);
  assert.match(SITE.description, /Tarleton State University/);
  assert.match(SITE.description, /retroviruses/);
  assert.match(SITE.description, /bacteriophages/);
  assert.match(SITE.description, /Cloudflare/);
  assert.doesNotMatch(`${SITE.role} ${SITE.eyebrow} ${SITE.description} ${SITE.tagline}`, /full-stack|department head/i);

  for (const person of [personJsonLd(ORIGIN), personNode(ORIGIN)]) {
    assert.equal(person.name, "Dustin Edwards");
    assert.equal(person.jobTitle, "Virologist, Professor, and Department Head");
    assert.equal(person.jobTitle, SITE.jobTitle);
    assert.equal(person.honorificSuffix, "Ph.D.");
    // The photo is on this site, square first, never hotlinked from another server.
    assert.equal(person.image.length, 2);
    assert.equal(person.image[0].width, person.image[0].height);
    for (const image of person.image) assert.ok(image.url.startsWith(`${ORIGIN}/media/dustin-edwards-headshot`), image.url);
    assert.equal(person.description, SITE.description);
    assert.equal("alternateName" in person, false);
    assert.equal(person.worksFor.department.name, SITE.department);
  }
});
