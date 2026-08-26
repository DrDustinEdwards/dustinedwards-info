/**
 * The key grammar has ONE spelling, and this is the differential that collapsed
 * the second one and now stops a third.
 *
 * ## What this replays
 *
 * `test/media-key-grammar.test.mjs` pins the READERS: three files that carried
 * private copies of the grammar must not regrow one. It could not see the copy
 * that lived INSIDE classify.mjs itself. After the 2026-08-26 key-grammar fix
 * the module held two internal spellings of one grammar: `CONTENT_KEY_SHAPE`,
 * used by `isContentKey` and `digestFromKey`, and a private regex inside
 * `dimensionsFromKey`. A sweep looking for copies in OTHER files is blind to
 * two copies in the same file, which is the shape hard rule 17 is about.
 *
 * ## The measurement that justified the collapse
 *
 * Hard rule 12: a refactor proves equivalence by DIFFERENTIAL, not by reading.
 * Run 2026-08-26 over the cases below: 232 agreed, 2 DISAGREED, and the two
 * were real. The old inline spelling read `\d{1,5}` per axis and rejected zero
 * numerically afterwards, so it measured `-0800x600` as 800 by 600 while
 * `isContentKey` was calling that same key not-a-content-key and
 * `digestFromKey` was returning no digest for it. One key, three readers, two
 * answers, shipped.
 *
 * The strict spelling won because the other two readers had always used it: a
 * key that delete and set-alt refuse is not a key the resolver should measure.
 *
 * ## Why this stays a test rather than being deleted with the second spelling
 *
 * The differential is the thing that can fail when a fourth reader arrives with
 * its own regex, or when someone "simplifies" the shared pattern in a way that
 * changes what it accepts. Deleting it would leave only prose saying the
 * grammar has one owner, and prose about a gate ages (FAILURES.md).
 *
 * @see app/lib/media/classify.mjs, CONTENT_KEY_SHAPE
 * @see test/media-key-grammar.test.mjs for the reader sweep
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  contentKey,
  digestFromKey,
  dimensionsFromKey,
  isContentKey,
} from "../app/lib/media/classify.mjs";

/** A fixed 32-byte digest, the same one the reader sweep uses. */
const DIGEST = Uint8Array.from({ length: 32 }, (_, i) => i).buffer;
const HEX16 = "0001020304050607";

/**
 * Every extension `classify()` accepts, restated here on purpose.
 *
 * A test that imported the map would agree with it by construction and could
 * not notice an extension being dropped. This is the fixture-independence
 * discipline: the expected values are not produced by the process under test.
 * The FIRST assertion below is what keeps this honest, by failing when the two
 * lists diverge in either direction.
 */
const EXTENSIONS = [
  "png", "jpg", "jpeg", "webp", "avif", "gif", "svg", "ico",
  "pdf", "webmanifest", "txt",
];

const DIMENSIONS = [
  null,
  { width: 1, height: 1 },
  { width: 1600, height: 900 },
  { width: 99999, height: 99999 },
];

/** Keys the writer really emits, in every form a reader is handed. */
function generatedInputs() {
  const out = [];
  for (const extension of EXTENSIONS) {
    for (const dimensions of DIMENSIONS) {
      const key = contentKey(DIGEST, extension, dimensions);
      out.push(key, `/media/${key}`, `/media/${key}?w=320`, `og/${key}`, `../${key}`);
    }
  }
  return out;
}

/**
 * The negatives, including the two inputs that separated the old spellings.
 *
 * Keeping `-0800x600` and `-800x0600` here is the point of the whole exercise:
 * they are the only inputs in 234 that told the two spellings apart, so a
 * future edit that reintroduces the loose form is caught by exactly these rows
 * and by nothing else.
 */
const NEGATIVES = [
  "og/some-post-65777080.png",
  "/publications/paper.pdf",
  HEX16,
  "",
  `${HEX16}-0800x600.webp`,
  `${HEX16}-800x0600.webp`,
  `${HEX16}-0x0.webp`,
  `${HEX16}-000000x1.webp`,
  `${HEX16}-100000x1.webp`,
  `${HEX16}-1600x900.WEBP`,
  `${HEX16}-1600x900`,
  `${HEX16.toUpperCase()}-1600x900.webp`,
  "photo-800x600.webp",
  `${HEX16}-1600x900.webp?w=1024#frag`,
];

const INPUTS = [...generatedInputs(), ...NEGATIVES];

/**
 * The OLD spelling, lifted VERBATIM from `dimensionsFromKey` as it stood before
 * the collapse, at `f0527a3`. Hard rule 12: lift the old body, do not
 * paraphrase it, or the differential compares the new code against a memory of
 * the old code.
 */
const OLD_DIMENSIONS_REGEX = /^[0-9a-f]{16}-(\d{1,5})x(\d{1,5})\.[a-z0-9]+$/;

function oldDimensionsFromKey(/** @type {string} */ keyOrPath) {
  if (typeof keyOrPath !== "string") return null;
  const path = keyOrPath.split(/[?#]/)[0];
  const key = path.startsWith("/media/") ? path.slice("/media/".length) : path;
  const match = key.match(OLD_DIMENSIONS_REGEX);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

test("the extension list here still matches the one classify() accepts", () => {
  // Both directions, so neither list can grow or shrink unnoticed. Read as
  // source because the map is module-private and exporting it to satisfy a
  // test would make the test agree with it by construction.
  const source = readFileSync(
    new URL("../app/lib/media/classify.mjs", import.meta.url),
    "utf8",
  );
  const block = source.slice(source.indexOf("const TYPES = new Map("));
  const declared = [...block.slice(0, block.indexOf("]);")).matchAll(/\["([a-z0-9]+)",/g)]
    .map((m) => m[1]);
  assert.ok(declared.length > 0, "the TYPES map was not found; this test is aimed at the wrong thing");
  assert.deepEqual([...declared].sort(), [...EXTENSIONS].sort());
});

test("the case set is the size the collapse was measured over", () => {
  // 11 extensions x 4 dimension shapes x 5 forms = 220, plus 14 negatives.
  // Restated so a generator that stopped early is a failure rather than a
  // smaller clean run, which is the pass-count-is-not-coverage rule.
  assert.equal(generatedInputs().length, 220);
  assert.equal(NEGATIVES.length, 14);
  assert.equal(INPUTS.length, 234);
});

test("CONTROL: the comparison can tell two implementations apart", () => {
  // A differential that cannot discriminate agrees with everything. Run a
  // knowingly different implementation through the same comparison and watch
  // it disagree, before believing any agreement below.
  const broken = () => ({ width: 7, height: 7 });
  let disagreements = 0;
  for (const input of INPUTS) {
    if (JSON.stringify(dimensionsFromKey(input)) !== JSON.stringify(broken(input))) {
      disagreements += 1;
    }
  }
  assert.equal(
    disagreements,
    INPUTS.length,
    "the comparison agreed with a knowingly wrong implementation somewhere",
  );
});

test("the collapsed spelling agrees with the old one except where it was wrong", () => {
  /** Inputs where the two are allowed to differ, each with the reason. */
  const EXPECTED_DIFFERENCES = new Map([
    [`${HEX16}-0800x600.webp`, "leading zero on the width"],
    [`${HEX16}-800x0600.webp`, "leading zero on the height"],
  ]);

  let agreed = 0;
  const surprises = [];
  for (const input of INPUTS) {
    const now = JSON.stringify(dimensionsFromKey(input));
    const before = JSON.stringify(oldDimensionsFromKey(input));
    if (now === before) {
      agreed += 1;
      assert.ok(
        !EXPECTED_DIFFERENCES.has(input),
        `${input} was expected to differ (${EXPECTED_DIFFERENCES.get(input)}) and did not`,
      );
    } else if (!EXPECTED_DIFFERENCES.has(input)) {
      surprises.push(`${input}: was ${before}, now ${now}`);
    }
  }

  assert.deepEqual(surprises, [], "the collapse changed behaviour somewhere it was not meant to");
  assert.equal(agreed, INPUTS.length - EXPECTED_DIFFERENCES.size);
  assert.equal(agreed, 232);
});

test("on the two inputs that differ, all three readers now give one answer", () => {
  // This is what the collapse bought, and it is worth asserting directly rather
  // than inferring from the counts above. Before it, one key got three answers.
  for (const key of [`${HEX16}-0800x600.webp`, `${HEX16}-800x0600.webp`]) {
    assert.equal(isContentKey(key), false, `isContentKey(${key})`);
    assert.equal(digestFromKey(key), null, `digestFromKey(${key})`);
    assert.equal(dimensionsFromKey(key), null, `dimensionsFromKey(${key})`);
  }
});

test("classify.mjs states the key grammar exactly once", () => {
  // The reader sweep in media-key-grammar.test.mjs watches OTHER files. Two
  // copies inside this one file is what it could not see, and is what actually
  // happened.
  const source = readFileSync(
    new URL("../app/lib/media/classify.mjs", import.meta.url),
    "utf8",
  );
  const spellings = (source.match(/\[0-9a-f\]\{16/g) ?? []).length;
  assert.equal(
    spellings,
    1,
    `classify.mjs spells the 16-hex key grammar ${spellings} time(s). One statement, ` +
      `three readers: isContentKey tests CONTENT_KEY_SHAPE, digestFromKey takes group 1, ` +
      `dimensionsFromKey takes groups 2 and 3.`,
  );
});
