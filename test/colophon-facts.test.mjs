/**
 * `colophonFacts` is otherwise read only by verify-live, after a deploy. This asserts COVERAGE,
 * not equality: the lists are authored independently, since values derived from the checked code cannot fail.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { COLOPHON_SECTIONS } from "../app/lib/colophon-sections.mjs";
import { colophonFacts } from "../scripts/lib/colophon-facts.mjs";

/** @param {string} rel */
const json = (rel) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

// stack.json is a gitignored build product, so `npm test` needs build:stack to have run.
const stack = json("../content/generated/stack.json");
const features = json("../content/features.json");

test("EVERY colophon section has a fact list", () => {
  const missing = [];
  for (const section of COLOPHON_SECTIONS) {
    try {
      colophonFacts(stack, features, section.id);
    } catch (error) {
      // The message is kept: a TypeError in the lookup is not the same defect as a missing list.
      missing.push(`${section.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    "these sections would crash verify-live AFTER a deploy, which is where this was found",
  );
});

test("no section's fact list is empty", () => {
  const empty = COLOPHON_SECTIONS.filter(
    (section) => colophonFacts(stack, features, section.id).length === 0,
  ).map((section) => section.id);
  assert.deepEqual(empty, [], "a section swept with zero facts proves nothing about its content");
});

test("every fact is a non-empty string", () => {
  const bad = [];
  for (const section of COLOPHON_SECTIONS) {
    for (const fact of colophonFacts(stack, features, section.id)) {
      if (typeof fact !== "string" || fact.trim() === "") bad.push(section.id);
    }
  }
  assert.deepEqual(bad, [], "an empty needle matches every page and cannot fail");
});

test("an UNKNOWN section still fails closed", () => {
  assert.throws(
    () => colophonFacts(stack, features, "no-such-section"),
    /no fact list for colophon section "no-such-section"/,
  );
});
