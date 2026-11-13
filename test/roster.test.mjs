import test from "node:test";
import assert from "node:assert/strict";

import { stringifyMatter } from "@drdustinedwards/site-helpers/matter";

import { findWideDashes } from "../app/lib/content/pipeline.mjs";
import {
  compileCohort,
  rosterFacts,
  rosterPath,
  rosterSetErrors,
  sortCohorts,
} from "../app/lib/roster/compile.mjs";
import { buildRoster, compileAllRoster } from "../scripts/lib/roster.mjs";

/* The roster validator is the one rule CI and the Carrel save share (docs/ROSTER.md). Everything here that
 * needs a person's name uses a placeholder: the real names live in content/roster/ and nowhere else. */

const PIPELINE = { findWideDashes };
const PHOTO = {
  src: "/media/dustin-edwards-example-0123456789abcdef-1080x720.webp",
  width: 1080,
  height: 720,
  alt: "Group photo of the 2031 cohort",
};
const NAMES = ["Example Person One", "Example Person Two"];

/** @param {Record<string, unknown>} data @param {string} [body] */
const file = (data, body = "") => stringifyMatter(body, data);
const GOOD = { year: 2031, photo: PHOTO, researchers: NAMES };

/** @param {string} raw @param {{ slug?: string, photo?: boolean }} [options] */
const compile = (raw, { slug = "2031", photo = true } = {}) =>
  compileCohort({ slug, raw, host: { photo: async () => photo }, pipeline: PIPELINE });

await test("a well-formed cohort compiles to exactly the three fields the data file carried", async () => {
  const result = await compile(file(GOOD));
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.deepEqual(result.cohort, GOOD);
  assert.deepEqual(Object.keys(JSON.parse(result.record)), ["year", "photo", "researchers"]);
  assert.equal(result.sourcePath, "content/roster/2031.md");
  assert.match(result.sourceBlobSha, /^[0-9a-f]{40}$/);
});

await test("a cohort with no photograph and no names is allowed (the page says the roster is to be added)", async () => {
  const result = await compile(file({ year: 2031, photo: null, researchers: [] }));
  assert.equal(result.ok, true, result.errors.join("\n"));
});

await test("REFUSES any field that is not in the existing shape, so no new personal data can enter", async () => {
  for (const extra of ["email", "phone", "location", "sample_location", "draft", "notes"]) {
    const result = await compile(file({ ...GOOD, [extra]: "x" }));
    assert.equal(result.ok, false, `${extra} was accepted`);
    assert.match(result.errors.join("\n"), new RegExp(`${extra} is not a roster field`));
  }
  const inPhoto = await compile(file({ ...GOOD, photo: { ...PHOTO, credit: "x" } }));
  assert.equal(inPhoto.ok, false);
  assert.match(inPhoto.errors.join("\n"), /photo\.credit is not a roster field/);
});

await test("REFUSES names that are not plain strings (a person is a name and nothing else)", async () => {
  const mapped = await compile(
    file({ ...GOOD, researchers: [{ name: "Example Person", email: "x" }] }),
  );
  assert.equal(mapped.ok, false);
  assert.match(mapped.errors.join("\n"), /researchers\[0\] is/);
  const padded = await compile(file({ ...GOOD, researchers: [" Example Person "] }));
  assert.equal(padded.ok, false);
  assert.match(padded.errors.join("\n"), /stray whitespace/);
  const repeated = await compile(
    file({ ...GOOD, researchers: ["Example Person", "Example Person"] }),
  );
  assert.equal(repeated.ok, false);
  assert.match(repeated.errors.join("\n"), /repeats a name/);
});

await test("REFUSES a body, a missing file, a wrong year and a slug that is not a year, with every message", async () => {
  assert.match(
    (await compile(file(GOOD, "A paragraph.\n"))).errors.join("\n"),
    /body must be empty/,
  );
  assert.match(
    (await compile(file(GOOD), { photo: false })).errors.join("\n"),
    /is not in the media library/,
  );
  assert.match(
    (await compile(file({ ...GOOD, year: 2030 }))).errors.join("\n"),
    /file is named for its year/,
  );
  assert.match(
    (await compile(file(GOOD), { slug: "notes" })).errors.join("\n"),
    /not a cohort file key/,
  );
  assert.match((await compile("no front matter\n")).errors.join("\n"), /front matter/);

  const many = await compile(
    file({
      year: "2031",
      photo: { src: "/elsewhere/x.png", width: 0, height: "1", alt: "" },
      researchers: "x",
    }),
  );
  assert.equal(many.ok, false);
  assert.ok(many.errors.length >= 5, `every message, got ${many.errors.length}`);
});

await test("REFUSES a photograph that is not a media library .webp whose address matches its size, and one with no alt text", async () => {
  const key = "dustin-edwards-example-0123456789abcdef-1080x720";
  for (const src of [
    "/media/x.webp",
    "/phage-hunters/x.webp",
    `/media/${key}.jpg`,
    `https://example.com/media/${key}.webp`,
    `/media/../${key}.webp`,
  ]) {
    assert.equal((await compile(file({ ...GOOD, photo: { ...PHOTO, src } }))).ok, false, src);
  }
  const wrongSize = await compile(file({ ...GOOD, photo: { ...PHOTO, width: 540 } }));
  assert.match(wrongSize.errors.join("\n"), /its address says 1080x720/);
  const noAlt = await compile(file({ ...GOOD, photo: { ...PHOTO, alt: " " } }));
  assert.match(noAlt.errors.join("\n"), /photo\.alt is required/);
});

await test("REFUSES a wide dash, as every content file does", async () => {
  const wide = String.fromCharCode(0x2014);
  const result = await compile(file({ ...GOOD, researchers: [`Example${wide}Person`] }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /wide dash/);
});

await test("the set rules: it cannot be empty and two files cannot be one year", () => {
  assert.match(rosterSetErrors([]).join("\n"), /cannot be empty/);
  assert.match(rosterSetErrors([GOOD, GOOD]).join("\n"), /two files are the 2031 cohort/);
  assert.deepEqual(rosterSetErrors([GOOD, { ...GOOD, year: 2030 }]), []);
});

await test("cohorts list newest first, whatever order they are read in", () => {
  const years = (list) => list.map((c) => c.year);
  const cohorts = [2019, 2025, 2021].map((year) => ({ ...GOOD, year }));
  assert.deepEqual(years(sortCohorts(cohorts)), [2025, 2021, 2019]);
  assert.deepEqual(years(cohorts), [2019, 2025, 2021], "the input is not reordered in place");
});

await test("the home page's counts are counted from the cohorts, never typed", () => {
  const cohorts = [
    { year: 2024, photo: null, researchers: ["A One", "B Two", "C Three"] },
    { year: 2021, photo: null, researchers: ["D Four"] },
    { year: 2023, photo: null, researchers: [] },
  ];
  assert.deepEqual(rosterFacts(cohorts), { researchers: 4, cohorts: 3, since: 2021 });
  assert.throws(() => rosterFacts([]), /no cohorts/);
});

await test("the committed roster compiles, in the shape the data file had, and every photograph is a media library address", async () => {
  const compiled = await compileAllRoster();
  assert.ok(
    compiled.length >= 9,
    `the roster has ${compiled.length} files; it had nine cohorts when it moved to files`,
  );
  const failed = compiled
    .filter((c) => !c.compiled.ok)
    .map((c) => `${c.file}: ${c.compiled.errors.join("; ")}`);
  assert.deepEqual(failed, []);

  const { rows, cohorts } = await buildRoster();
  assert.equal(rows.length, compiled.length);
  assert.deepEqual(
    cohorts.map((c) => c.year),
    cohorts.map((c) => c.year).sort((a, b) => b - a),
    "newest first",
  );
  for (const c of cohorts) {
    assert.ok(
      c.photo,
      `the ${c.year} cohort has its group photograph, as every cohort had when it moved`,
    );
    assert.match(
      c.photo.src,
      /^\/media\/dustin-edwards-/,
      "a cohort photograph is a media library file",
    );
  }
  // The file key is the year, and the file is where rosterPath says.
  for (const row of rows) assert.equal(row.sourcePath, rosterPath(row.slug));
});
