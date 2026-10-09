import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import matter from "gray-matter";

import { findWideDashes } from "../app/lib/content/pipeline.mjs";
import {
  STRAINS,
  itemPath,
  phageYearsText,
  protocolsUsingStrain,
  strainMarkdown,
  strainRow,
  strainRows,
  strainsMarkdown,
} from "../app/kb/registry/catalog.mjs";
import { compileRegistryItem, registrySetErrors } from "../app/kb/registry/compile.mjs";
import { KINDS } from "../app/kb/registry/kinds.mjs";
import { registrySearchInput } from "../app/kb/registry/search-inputs.mjs";
import { STRAIN, designationOf } from "../app/kb/registry/strain.mjs";
import { HOSTS } from "../app/lib/phages/compile.mjs";
import { buildRegistry } from "../scripts/lib/registry.mjs";

/* The strain kind (docs/REGISTRY.md): the two bacterial hosts of the lab's phage work, what is computed from them, and the
 * guard that holds a protocol's host strain to the registry's, so a collection number is stored once. */

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");

const built = await buildRegistry();
const strains = built.items.filter((item) => item.kind === "strain");

test("the registry holds the two host strains the lab's pages name, each stating only what the pages state", () => {
  assert.deepEqual(strains.map((s) => s.id).sort(), ["foliorum", "smegmatis"]);
  const smegmatis = strainRows(strains, []).find((s) => s.id === "smegmatis");
  const foliorum = strainRows(strains, []).find((s) => s.id === "foliorum");
  assert.deepEqual(
    [smegmatis?.name, smegmatis?.organism, smegmatis?.strain, smegmatis?.collection, smegmatis?.collectionNumber, smegmatis?.designation],
    ["Mycobacterium smegmatis mc²155", "Mycobacterium smegmatis", "mc²155", "ATCC", "700084", "mc²155"],
  );
  // The lab's pages give NRRL B-24224 as the designation, with no other: the designation is the collection and its number.
  assert.deepEqual(
    [foliorum?.name, foliorum?.organism, foliorum?.strain, foliorum?.collection, foliorum?.collectionNumber, foliorum?.designation],
    ["Microbacterium foliorum NRRL B-24224", "Microbacterium foliorum", null, "NRRL", "B-24224", "NRRL B-24224"],
  );
  assert.match(smegmatis?.guideUrl ?? "", /helpdocsonline\.com\/4-1-msmegmatis$/);
  assert.match(foliorum?.guideUrl ?? "", /helpdocsonline\.com\/4-1-mfoliorum$/);
});

test("the biosafety level is Dustin's word (decisions.md, 2026-10-05): both strains are BSL-1, and a strain has no gap", () => {
  assert.deepEqual(built.gaps.filter((gap) => gap.slug.startsWith("strain/")), []);
  for (const row of strainRows(strains, [])) assert.equal(row.biosafetyLevel, "BSL-1");
});

test("a strain's id is the phages' host key, both ways, so a phage's host and a strain are one word", () => {
  assert.deepEqual(Object.keys(HOSTS).sort(), strains.map((s) => s.id).sort());
});

test("the kind refuses what is wrong, with the field named, and a name that says a different strain than its fields", async () => {
  const kinds = { strain: STRAIN };
  const host = { paper: async () => false };
  const compile = (lines) => compileRegistryItem({ slug: "strain/x", raw: `---\n${lines.join("\n")}\n---\n`, host, pipeline: { findWideDashes }, kinds });
  const good = ["name: Genus species ATCC 1", "organism: Genus species", "collection: ATCC", 'collection_number: "1"', 'biosafety_level: "MISSING: not set"'];
  assert.equal((await compile(good)).ok, true);
  const bad = await compile(["name: X", "organism: ", "guide_url: http://nope", "biosafety_level: BSL-9"]);
  assert.equal(bad.ok, false);
  const message = bad.errors.join("\n");
  for (const field of ["organism", "collection", "collection_number", "guide_url", "biosafety_level"]) assert.ok(message.includes(field), field);
  const renamed = registrySetErrors(
    [{ kind: "strain", id: "x", name: "Genus other ATCC 1", status: "published", fields: { organism: "Genus species", collection: "ATCC", collection_number: "1" } }],
    kinds,
  );
  assert.match(renamed.join("\n"), /the name is computed from them/);
  assert.equal(designationOf({ strain: "mc²155", collection: "ATCC", collection_number: "700084" }), "mc²155");
  assert.equal(designationOf({ collection: "NRRL", collection_number: "B-24224" }), "NRRL B-24224");
  assert.equal(designationOf({ collection: "NRRL", collection_number: "MISSING: not stated" }), null);
});

test("no record stores what is computed: the phages isolated on a strain, the protocols that use it, its designation", async () => {
  const names = (await readdir(new URL("content/registry/strain/", root))).filter((n) => n.endsWith(".md"));
  assert.equal(names.length, 2);
  for (const name of names) {
    const data = matter(await text(`content/registry/strain/${name}`), {}).data;
    for (const field of ["phages", "protocols", "designation", "phage_count", "first_year", "last_year", "host"]) assert.equal(Object.hasOwn(data, field), false, `${name} stores ${field}`);
  }
});

test("the phages isolated on a strain are read from the phages table by the strain's id, and counted, never copied", () => {
  const phages = [
    { name: "Zeta", year: 2023, host: "foliorum" },
    { name: "Acorn15", year: 2017, host: "smegmatis" },
    { name: "Beta2", year: 2018, host: "foliorum" },
    { name: "Beta10", year: 2018, host: "foliorum" },
    { name: "Unknown", year: 2026, host: null },
  ];
  const foliorum = strainRow(strains.find((s) => s.id === "foliorum"), phages);
  assert.deepEqual(foliorum.phages.map((p) => p.name), ["Beta2", "Beta10", "Zeta"], "oldest first, then by name in natural order");
  assert.equal(foliorum.phages[0].path, "/research/phages#beta2");
  assert.equal(phageYearsText(foliorum), "2018 to 2023");
  const smegmatis = strainRow(strains.find((s) => s.id === "smegmatis"), phages);
  assert.equal(phageYearsText(smegmatis), "2017");
  assert.equal(phageYearsText(strainRow(strains[0], [])), null);
  assert.equal(STRAINS.fields.find((f) => f.key === "phages").value(foliorum), 3);
});

test("a protocol uses a strain when it names its id; none is listed on the strain", () => {
  const foliorum = { id: "foliorum" };
  const protocols = [
    { path: "/research/protocols/a", title: "A", hostStrains: [{ id: "foliorum" }, { id: "smegmatis" }] },
    { path: "/research/protocols/b", title: "B", hostStrains: [] },
    { path: "/research/protocols/c", title: "C" },
  ];
  assert.deepEqual(protocolsUsingStrain(foliorum, protocols), [{ path: "/research/protocols/a", title: "A" }]);
});

test("the twin states what the page states, and a biosafety level nobody has set is said with its reason, never left out", () => {
  const smegmatis = strains.find((s) => s.id === "smegmatis");
  const row = strainRow(smegmatis, [{ name: "Acorn15", year: 2017, host: "smegmatis" }]);
  const unset = strainRow({ ...smegmatis, fields: { ...smegmatis.fields, biosafety_level: "MISSING: Waiting on Dustin." } }, []);
  assert.ok(strainMarkdown(unset, [], "https://example.com").includes("- Biosafety level: not found (Waiting on Dustin.)"));
  const md = strainMarkdown(row, [{ path: "/research/protocols/phage-isolation", title: "Phage Isolation" }], "https://example.com");
  for (const line of [
    "# Mycobacterium smegmatis mc²155",
    "- Collection: ATCC 700084",
    "- Biosafety level: BSL-1",
    "1 phage, found 2017, counted from the phages table.",
    "- [Acorn15](https://example.com/research/phages#acorn15), 2017",
    "- Used in: [Phage Isolation](https://example.com/research/protocols/phage-isolation)",
  ]) assert.ok(md.includes(line), line);
  assert.ok(strainsMarkdown([row], "https://example.com").includes("| [Mycobacterium smegmatis mc²155](https://example.com/research/lab/strains/smegmatis) |"));
  assert.equal(itemPath("strain", "smegmatis"), "/research/lab/strains/smegmatis");
  assert.equal(KINDS.strain, STRAIN);
});

test("a strain is found by its organism, designation and collection number", () => {
  const found = registrySearchInput(strains.find((s) => s.id === "foliorum"));
  assert.equal(found?.uid, "registry:strain/foliorum");
  assert.equal(found?.url, "/research/lab/strains/foliorum");
  for (const word of ["Microbacterium foliorum", "NRRL", "B-24224", "NRRL B-24224"]) assert.ok(found?.body.includes(word), word);
});

test("STORED ONCE: no protocol types a strain's designation or collection number, and every host strain a protocol names is an id the registry holds", async () => {
  const { compileDirectory } = await import("../scripts/lib/procedures.mjs");
  const compiled = await compileDirectory("content/procedures");
  const ids = new Set(strains.map((s) => s.id));
  const typed = strains.flatMap((s) => [s.fields.collection_number, s.fields.strain].filter(Boolean));
  const names = (await readdir(new URL("content/procedures/", root))).filter((n) => n.endsWith(".md"));
  const used = new Set();
  for (const name of names) {
    const raw = await text(`content/procedures/${name}`);
    for (const value of typed) assert.ok(!raw.includes(value), `${name} types "${value}"; a strain is stored once, in content/registry/strain`);
    const data = matter(raw, {}).data;
    if (!Array.isArray(data.host_strain)) continue;
    for (const entry of data.host_strain) {
      assert.deepEqual(Object.keys(entry), ["strain"], `${name}: a protocol names a host strain by id and nothing else`);
      assert.ok(ids.has(entry.strain), `${name}: ${entry.strain} is not in the registry`);
      used.add(entry.strain);
    }
  }
  assert.deepEqual([...ids].filter((id) => !used.has(id)), [], "a registry strain no protocol uses");
  for (const name of (await readdir(new URL("content/pages/", root))).filter((n) => n.endsWith(".md"))) {
    const raw = await text(`content/pages/${name}`);
    for (const value of typed) assert.ok(!raw.includes(value), `${name} types "${value}"; link the strain record at /research/lab/strains/<id> instead`);
  }
  const isolation = compiled.find((c) => c.slug === "phage-isolation")?.compiled;
  assert.ok(isolation?.ok, JSON.stringify(isolation?.errors));
  assert.deepEqual(isolation.record.hostStrains.map((s) => s.id), ["smegmatis", "foliorum"]);
  assert.equal(isolation.record.hostStrains[1].path, "/research/lab/strains/foliorum");
  assert.equal(isolation.record.hostStrain, "Mycobacterium smegmatis mc²155; Microbacterium foliorum NRRL B-24224");
  assert.ok(isolation.markdown.includes("[Microbacterium foliorum NRRL B-24224](/research/lab/strains/foliorum)"), "the twin links the strain");
});

test("the compile refuses what a protocol may not say about a host strain", async () => {
  const { compileProcedure } = await import("../app/kb/procedures/compile.mjs");
  const pipeline = await import("../app/lib/content/pipeline.mjs");
  const { registryHost } = await import("../scripts/lib/registry.mjs");
  const original = await text("content/procedures/phage-isolation.md");
  const compile = (raw, registry = registryHost()) => compileProcedure({ slug: "phage-isolation", raw, pipeline, registry });
  assert.equal((await compile(original)).ok, true);
  const unknown = await compile(original.replace("strain: foliorum", "strain: no-such-strain"));
  assert.match(unknown.errors.join("\n"), /host_strain\[no-such-strain\] names no strain in the lab registry/);
  const twice = await compile(original.replace("strain: foliorum", "strain: smegmatis"));
  assert.match(twice.errors.join("\n"), /host_strain\[smegmatis\] is listed twice/);
  const typed = await compile(original.replace("  - strain: foliorum", "  - Microbacterium foliorum NRRL B-24224"));
  assert.match(typed.errors.join("\n"), /is \{ strain: <id> \}/);
  const extra = await compile(original.replace("  - strain: foliorum", "  - { strain: foliorum, atcc: 1 }"));
  assert.match(extra.errors.join("\n"), /\.atcc is not a protocol field/);
  const none = await compileProcedure({ slug: "phage-isolation", raw: original, pipeline });
  assert.equal(none.ok, false);
  assert.match(none.errors.join("\n"), /no lab registry/);
});

test("a protocol's organism is a non-strain organism or a strain of the registry, and the words come from the registry", async () => {
  const { compileProcedure } = await import("../app/kb/procedures/compile.mjs");
  const pipeline = await import("../app/lib/content/pipeline.mjs");
  const { registryHost } = await import("../scripts/lib/registry.mjs");
  const { NON_STRAIN_ORGANISMS, organismLabel } = await import("../app/kb/procedures/taxonomy.mjs");
  const original = await text("content/procedures/phage-isolation.md");
  const compile = (raw) => compileProcedure({ slug: "phage-isolation", raw, pipeline, registry: registryHost() });
  const ok = await compile(original);
  assert.ok(ok.ok, JSON.stringify(ok.errors));
  assert.deepEqual(ok.record.organismNames, { smegmatis: "Mycobacterium smegmatis", foliorum: "Microbacterium foliorum" });
  assert.deepEqual(Object.keys(NON_STRAIN_ORGANISMS), ["avian"], "only what is not a strain is typed in taxonomy.mjs");
  const unknown = await compile(original.replace("organism: [smegmatis, foliorum]", "organism: [smegmatis, mouse]"));
  assert.match(unknown.errors.join("\n"), /organism "mouse" is neither one of: avian .* nor a strain in the lab registry/);
  const avian = await compile(original.replace("organism: [smegmatis, foliorum]", "organism: [avian]"));
  assert.ok(avian.ok, JSON.stringify(avian.errors));
  assert.deepEqual(avian.record.organismNames, { avian: "Birds" });
  assert.equal(organismLabel("avian"), "Birds");
});
