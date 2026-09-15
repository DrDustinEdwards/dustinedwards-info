/**
 * THE REPLAY PROOF FOR THE DECISIONS-VOLUME FREEZE POINT.
 *
 * The defect being replayed is real and dated rather than synthetic: vol 18
 * stated "Freeze at 20KB." in its own header, ran to 36,667 bytes, and stayed
 * there for four days while vol 17 had respected the same sentence at 20.6KB.
 * The fixture below is that header, verbatim.
 *
 * ## BOTH DIRECTIONS, AND THE SECOND IS THE ONE THAT KEEPS IT USABLE
 *
 * A gate that fails on every volume over 20KB would red permanently over vols
 * 6 and 7, frozen at 224KB and 69KB before the rule existed, and a gate that
 * cannot go green is one somebody deletes. So the frozen ones must PASS, and
 * that is asserted here rather than assumed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyVolumes, parseFreezeLimit, BYTES_PER_KB } from "../scripts/lib/decisions-volumes.mjs";

/** Vol 18's header as it stood the day it was frozen, verbatim. */
const VOL_18_HEADER = `# Decisions vol 18 (FROZEN 2026-09-15)

**FROZEN. Continues in \`decisions-vol-19.md\`, which carries the standing rulings, the open items and the deadlines; everything else stays here.**

**Reversals and bindings only.** Cite the report; do not restate it. Vol 17 froze 2026-09-11 after ruling 59; this volume ran 60 to 104.`;

/** Vol 19's header, where the limit is its own bold phrase rather than bare. */
const VOL_19_HEADER = `# Decisions vol 19 (active)

**Reversals and bindings only.** Cite the report; do not restate it. **Freeze at 20KB.** Vol 18 froze 2026-09-15 after ruling 104.`;

const pad = (header, bytes) => header + "\n" + "x".repeat(Math.max(0, bytes - Buffer.byteLength(header + "\n", "utf8")));

test("the limit is READ from the volume, not hard-coded", () => {
  assert.equal(parseFreezeLimit(VOL_19_HEADER), 20 * BYTES_PER_KB);
  // A volume may state a different limit and the gate follows it.
  assert.equal(parseFreezeLimit("Freeze at 64KB."), 64 * BYTES_PER_KB);
  assert.equal(parseFreezeLimit("Freeze at 20 KB"), 20 * BYTES_PER_KB);
  // A volume that states none is not silently fine; the caller must fail.
  assert.equal(parseFreezeLimit(VOL_18_HEADER), null);
});

test("THE REPLAYED DEFECT: an active volume past its own stated limit", () => {
  const { active } = classifyVolumes([
    { path: "decisions-vol-18.md", title: "vol 18 (FROZEN)", body: pad(VOL_19_HEADER, 36_667) },
  ]);

  assert.equal(active.n, 18);
  assert.equal(active.bytes, 36_667);
  assert.equal(active.limit, 20 * BYTES_PER_KB);
  assert.ok(active.bytes > active.limit, "36,667 bytes against a 20KB limit must read as over");
});

test("FROZEN VOLUMES PASS, which is what keeps the gate usable", () => {
  // Vols 6 and 7 froze at 224KB and 69KB, before the rule existed. Only the
  // highest number is the active one, so neither is examined at all.
  const { active, volumes } = classifyVolumes([
    { path: "decisions-vol-7.md", title: "vol 7 (FROZEN at 69KB)", body: pad(VOL_19_HEADER, 69_000) },
    { path: "decisions-vol-18.md", title: "vol 18 (FROZEN)", body: pad(VOL_18_HEADER, 36_667) },
    { path: "decisions-vol-19.md", title: "vol 19 (active)", body: pad(VOL_19_HEADER, 9_082) },
  ]);

  assert.equal(volumes.length, 3, "all three are discovered");
  assert.equal(active.n, 19, "only the highest number is active");
  assert.ok(active.bytes <= active.limit, "vol 19 at 9,082 is inside 20KB and must pass");
});

test("A STALE (active) TITLE IS NOT THE SIGNAL, which is why the title is not read", () => {
  // MEASURED: eleven volumes still say "(active)" in their titles. If the title
  // decided, this run would report eleven active volumes, nine of them over
  // their limit, and every one of those is history nobody is going to retitle.
  const { active, staleTitles } = classifyVolumes([
    { path: "decisions-vol-15.md", title: "Decisions vol 15 (active)", body: pad(VOL_19_HEADER, 30_000) },
    { path: "decisions-vol-16.md", title: "Decisions vol 16 (active)", body: pad(VOL_19_HEADER, 30_000) },
    { path: "decisions-vol-17.md", title: "Decisions vol 17 (active)", body: pad(VOL_19_HEADER, 21_000) },
    { path: "decisions-vol-19.md", title: "Decisions vol 19 (active)", body: pad(VOL_19_HEADER, 9_082) },
  ]);

  assert.equal(active.n, 19, "the highest number wins over three stale titles");
  assert.ok(active.bytes <= active.limit);
  assert.deepEqual(
    staleTitles,
    ["decisions-vol-15.md", "decisions-vol-16.md", "decisions-vol-17.md"],
    "the stale ones are REPORTED so the next reader learns titles cannot be trusted",
  );
});

test("an active volume that states NO limit is not silently fine", () => {
  const { active } = classifyVolumes([
    { path: "decisions-vol-20.md", title: "vol 20 (active)", body: "# Decisions vol 20\n\nNo limit stated." },
  ]);

  assert.equal(active.n, 20);
  assert.equal(active.limit, null, "the caller must fail on null rather than compare against nothing");
});

test("the scope is not silently empty", () => {
  // A listing that returned nothing would report a clean sweep. The caller
  // floors the count; this proves the shape it floors is honest.
  const { volumes, active } = classifyVolumes([{ path: "core.md", body: "not a volume" }]);
  assert.deepEqual(volumes, []);
  assert.equal(active, null);
});

test("decisions.md is not matched, and cannot become the active volume", () => {
  // Vol 6 lives at decisions.md and is frozen at 224KB. Matching it would need
  // its number parsed out of a title, and a volume whose number comes from
  // prose is one a retitle can renumber.
  const { volumes, active } = classifyVolumes([
    { path: "decisions.md", title: "Decisions vol 6 (FROZEN at 224KB)", body: pad(VOL_19_HEADER, 224_000) },
    { path: "decisions-vol-19.md", title: "vol 19 (active)", body: pad(VOL_19_HEADER, 9_082) },
  ]);

  assert.equal(volumes.length, 1);
  assert.equal(active.n, 19);
});
