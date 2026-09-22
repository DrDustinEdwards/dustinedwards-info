/**
 * Every colophon section has a fact list, asserted OFFLINE.
 *
 * REPLAYS THE DEFECT, per hard rule 12. The colophon has two registration
 * sites. `colophonPageInput` builds each section's indexed body and throws on a
 * section it has no rule for, offline, on every build. `colophonFacts` builds
 * the needles `verify-live` matches against the rendered page and throws the
 * same way, and NOTHING READ IT UNTIL A DEPLOY EXISTED.
 *
 * So the `security` section shipped in ship window 8 with its body rule and
 * without its fact list. Both throws are correct and neither is early: adding a
 * section touched two places and only one of them could fail before the deploy.
 * `verify-live` then crashed on `no fact list for colophon section "security"`,
 * and re-running it bills an Ask probe.
 *
 * This is the offline half. It asserts COVERAGE of the section set, not
 * equality of the values, and that distinction is the whole design: the two
 * lists are authored independently on purpose, because a gate whose expected
 * values are produced by the process it checks cannot fail. See the header of
 * `scripts/lib/colophon-facts.mjs` for why deriving one from the other was
 * rejected.
 *
 * ## OBSERVATION BOUNDARY
 *
 * This proves every section HAS needles and that they are non-empty strings. It
 * does NOT prove a needle appears on the live page, which is `verify-live`'s
 * job and needs a deploy, and it does not prove the needles are the right facts.
 * A section whose fact list is present but wrong passes here.
 *
 * @see scripts/lib/colophon-facts.mjs, app/lib/colophon-sections.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { COLOPHON_SECTIONS } from "../app/lib/colophon-sections.mjs";
import { colophonFacts, el } from "../scripts/lib/colophon-facts.mjs";

/** @param {string} rel */
const json = (rel) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

// The artifacts the page itself renders from. Reading them rather than
// fabricating a stack keeps this honest about the real shapes. stack.json is a
// gitignored build product since ruling 39a, so `npm test` needs build:stack to
// have run; check-all builds it before the tier that runs check:tests.
const stack = json("../content/generated/stack.json");
const features = json("../content/features.json");

test("the descriptor has sections at all", () => {
  // Scope check. Every assertion below iterates this list, so all of them are
  // vacuous if it is empty, and "0 sections missing a fact list" would pass.
  assert.ok(COLOPHON_SECTIONS.length > 0, "no sections, so nothing below checks anything");
});

test("EVERY colophon section has a fact list", () => {
  const missing = [];
  for (const section of COLOPHON_SECTIONS) {
    try {
      colophonFacts(stack, features, section.id);
    } catch {
      missing.push(section.id);
    }
  }
  assert.deepEqual(
    missing,
    [],
    "these sections would crash verify-live AFTER a deploy, which is where this was found",
  );
});

test("no section's fact list is empty", () => {
  // A section registered with `return []` would satisfy the test above and
  // sweep nothing, which is the "assertion that can pass by reading nothing"
  // class. The count is what makes the sweep mean something.
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
  // The throw is the guarantee this test is the early warning for. Losing it
  // would mean an unregistered section is swept as its lead alone and passes.
  assert.throws(
    () => colophonFacts(stack, features, "no-such-section"),
    /no fact list for colophon section "no-such-section"/,
  );
});

test("the security section sweeps the tradeoff sentences the page renders", () => {
  // The section that shipped without a fact list. Named rather than left to the
  // loop above, because "every section has one" would go green again the moment
  // someone registered `security` with the wrong content.
  const facts = colophonFacts(stack, features, "security");
  assert.ok(facts.length >= 4, `expected the tradeoff sentences, got ${facts.length} needle(s)`);
  // Element-delimited, matching how the page renders each sentence as its own
  // paragraph. A bare substring would pass on a neighboring node.
  for (const fact of facts) {
    assert.ok(fact.startsWith(">") && fact.endsWith("<"), `needle is not element-delimited: ${fact}`);
  }
});

test("el delimits, so a token cannot pass on a neighbor's substring", () => {
  // `react` is a substring of `react-dom`; this is why the needles are wrapped.
  assert.equal(el("react"), ">react<");
  assert.ok(!">react-dom<".includes(el("react")));
});
