import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { findWideDashes } from "../app/lib/content/pipeline.mjs";
import { mateOf, pairProduct, primerRow, primerRows } from "../app/kb/registry/catalog.mjs";
import { compileRegistryItem, registrySetErrors } from "../app/kb/registry/compile.mjs";
import { PRIMER } from "../app/kb/registry/primer.mjs";
import { buildRegistry } from "../scripts/lib/registry.mjs";

/* The primer kind (docs/REGISTRY.md): the twelve records the lab's protocols state, what is computed from them, and the
 * guard that holds a protocol's own primer list equal to the registry's until the protocols read their tables from it. */

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");

const built = await buildRegistry();
const primers = built.items.filter((item) => item.kind === "primer");
const rows = primers.map(primerRow);
const byId = new Map(rows.map((row) => [row.id, row]));

await test("the REV 3' LTR forward primer is CATACTGAGCCAATGGTT and its pair's product is computed as 281 bp, as the protocol stated", () => {
  const forward = byId.get("rev-3-ltr-forward");
  assert.equal(forward?.sequence, "CATACTGAGCCAATGGTT");
  assert.equal(forward?.length, 18);
  const reverse = byId.get("rev-3-ltr-reverse");
  assert.equal(reverse?.sequence, "AATGTTGTACCGAAGTACT");
  assert.equal(mateOf(forward, rows)?.id, "rev-3-ltr-reverse");
  for (const primer of [forward, reverse]) {
    // The product is computed for the pair and shown on both, from both LTRs of DQ387450.1; nothing stores it.
    assert.deepEqual(
      pairProduct(primer, rows)?.products.map((p) => [p.length, p.start, p.end]),
      [
        [281, 258, 538],
        [281, 8000, 8280],
      ],
    );
  }
});

await test("the compile refuses what a protocol may not say about a primer, and refuses a registry it was not given", async () => {
  const { compileProcedure } = await import("../app/kb/procedures/compile.mjs");
  const pipeline = await import("../app/lib/content/pipeline.mjs");
  const { registryHost } = await import("../scripts/lib/registry.mjs");
  const original = await text("content/procedures/coi-primers.md");
  const compile = (raw, registry = registryHost()) =>
    compileProcedure({ slug: "coi-primers", raw, pipeline, registry });
  assert.equal((await compile(original)).ok, true);

  const unknown = await compile(original.replace("primer: hco2198", "primer: no-such-primer"));
  assert.match(
    unknown.errors.join("\n"),
    /primers\[no-such-primer\] names no primer in the lab registry/,
  );
  const twice = await compile(original.replace("primer: hco2198", "primer: lco1490"));
  assert.match(twice.errors.join("\n"), /primers\[lco1490\] is listed twice/);
  const inline = await compile(
    original.replace(
      "  - { primer: hco2198 }",
      "  - { primer: hco2198, sequence: TAAACTTCAGGGTGACCAAAAAATCA }",
    ),
  );
  assert.match(inline.errors.join("\n"), /\.sequence is not a protocol field/);
  const old = await compile(
    original.replace(
      "  - { primer: hco2198 }",
      "  - { direction: reverse, sequence: TAAACTTCAGGGTGACCAAAAAATCA }",
    ),
  );
  assert.match(old.errors.join("\n"), /is \{ primer: <id> \}/);
  const none = await compileProcedure({ slug: "coi-primers", raw: original, pipeline });
  assert.equal(none.ok, false);
  assert.match(none.errors.join("\n"), /no lab registry/);
});

/* The sizes the protocols STATED before they were computed (the text of the three primer protocols at 2026-10-05, from the
 * papers and the lab's gels). They are kept here as the test that the computed sizes agree with what each protocol states
 * today: a change to a primer, a reference or the alignment code that moves one fails this. Where a stated size is a
 * paper's rounded figure or a gel's reading, the table records it as such and the computed size is held to its own number. */
const STATED_TODAY = [
  { set: "PCR REV 3′ LTR", stated: 281, computed: [281, 281] },
  { set: "PCR REV pol (protease and reverse transcriptase)", stated: 574, computed: [574] },
  { set: "PCR REV pol (reverse transcriptase and integrase)", stated: 801, computed: [801] },
  { set: "PCR LPDV p31/CA", stated: 458, computed: [458] },
  { set: "Pan-avian GAPDH PCR", stated: 534, computed: [534] },
  // Folmer et al. state "about 710 bp" and the lab's gels read about 708 bp; the computed product on X03240.1 is 709 bp, with
  // three mismatches in the forward primer. Reported to the seat 2026-10-05; the protocol keeps its stated 710 and 708.
  { set: "COI primers: LCO1490 and HCO2198", stated: 710, computed: [709], rounded: true },
];

await test("the computed product sizes agree with what each protocol states today, and the one that differs is recorded as differing", () => {
  const primerRowsWithProducts = primerRows(primers);
  for (const { set, stated, computed, rounded } of STATED_TODAY) {
    const forward = primerRowsWithProducts.find(
      (row) => row.set === set && row.direction === "forward",
    );
    assert.ok(forward, set);
    assert.deepEqual(
      forward.product?.products.map((p) => p.length),
      computed,
      `${set}: computed`,
    );
    if (rounded) {
      assert.notEqual(
        computed[0],
        stated,
        `${set}: if this now agrees, drop the exception and the prose figure`,
      );
      assert.ok(
        Math.abs(computed[0] - stated) <= 2,
        `${set}: within a base or two of the stated figure`,
      );
    } else {
      for (const size of computed)
        assert.equal(size, stated, `${set}: the computed size equals the stated one`);
    }
  }
});

await test("the kind refuses what is wrong, with the field named", async () => {
  const kinds = { primer: PRIMER };
  const host = { paper: async (slug) => slug === "real-paper" };
  const compile = (slug, lines) =>
    compileRegistryItem({
      slug,
      raw: `---\n${lines.join("\n")}\n---\n`,
      host,
      pipeline: { findWideDashes },
      kinds,
    });
  const good = [
    "name: X forward",
    "sequence: ACGTACGTACGT",
    "direction: forward",
    "target: X",
    "published_in: A paper",
    "published_name: X",
    "published_sequence: ACGTACGTACGT",
  ];
  assert.equal((await compile("primer/x-forward", good)).ok, true);
  const bad = await compile("primer/x-forward", [
    "name: X forward",
    "sequence: acgtacgtacgt",
    "direction: sideways",
    "target: X",
    "published_product: 12 base pairs",
    "published_url: http://nope",
    "published_doi: nope",
    "reference: NOT_A_REFERENCE.1",
    "published_sequence: tttt",
  ]);
  assert.equal(bad.ok, false);
  const message = bad.errors.join("\n");
  for (const field of [
    "sequence:",
    "direction:",
    "published_product:",
    "published_url:",
    "published_doi:",
    "reference:",
    "published_sequence:",
  ])
    assert.ok(message.includes(field), field);
  const short = await compile("primer/x-forward", [
    "name: X",
    "sequence: ACGT",
    "direction: forward",
    "target: X",
    "published_in: A paper",
    "published_name: X",
    "published_sequence: ACGTACGTACGT",
  ]);
  assert.match(short.errors.join("\n"), /is 10 to 80 bases/);
  const gap = await compile("primer/x-forward", [
    "name: X",
    'sequence: "MISSING: not recorded"',
    "direction: forward",
    "target: X",
    "published_in: A paper",
    "published_name: X",
    "published_sequence: ACGTACGTACGT",
  ]);
  assert.equal(gap.ok, true);
  assert.equal(primerRow({ ...gap.item }).tm, null, "a gap has no Tm");
});

await test("the set rules: a sequence is stored once, a set has one forward and one reverse, a product is on the forward primer", () => {
  const item = (id, fields) => ({
    kind: "primer",
    id,
    name: id,
    status: "published",
    fields: { target: "T", ...fields },
  });
  const set = (...items) => registrySetErrors(items, { primer: PRIMER }).join("\n");
  assert.match(
    set(
      item("a", { sequence: "ACGTACGTACGT", direction: "forward" }),
      item("b", { sequence: "ACGTACGTACGT", direction: "reverse" }),
    ),
    /hold the same sequence/,
  );
  assert.match(
    set(
      item("a", { sequence: "ACGTACGTACGT", direction: "forward", set: "S" }),
      item("b", { sequence: "TTGGCCAATTGG", direction: "forward", set: "S" }),
    ),
    /2 forward primers/,
  );
  assert.match(
    set(item("a", { sequence: "ACGTACGTACGT", direction: "reverse", published_product: "100 bp" })),
    /stated on its forward primer/,
  );
  assert.match(
    set(
      item("a", {
        sequence: "ACGTACGTACGT",
        direction: "forward",
        set: "S",
        reference: "DQ387450.1",
      }),
      item("b", {
        sequence: "TTGGCCAATTGG",
        direction: "reverse",
        set: "S",
        reference: "U09568.1",
      }),
    ),
    /names 2 references/,
  );
  assert.equal(
    set(
      item("a", {
        sequence: "ACGTACGTACGT",
        direction: "forward",
        set: "S",
        published_product: "100 bp",
        reference: "DQ387450.1",
      }),
      item("b", {
        sequence: "TTGGCCAATTGG",
        direction: "reverse",
        set: "S",
        reference: "DQ387450.1",
      }),
    ),
    "",
  );
});
