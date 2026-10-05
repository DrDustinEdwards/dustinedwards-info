import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { findWideDashes } from "../app/lib/content/pipeline.mjs";
import {
  ID_PATTERN,
  compileRegistryItem,
  isGap,
  itemFromRow,
  parseRegistrySlug,
  registryPath,
  registrySetErrors,
  registrySlug,
  sortRegistry,
} from "../app/lib/registry/compile.mjs";
import { KINDS } from "../app/lib/registry/kinds.mjs";
import { registryDriftVerdict } from "../app/lib/health/verdicts.mjs";
import { buildRegistry, compileAllRegistry } from "../scripts/lib/registry.mjs";

/* The registry framework (docs/REGISTRY.md), judged with a kind of its own: the registry ships with none, so every
 * case brings a "widget". What each case holds is one rule a kind's records rely on. */

const WIDGET = {
  singular: "widget",
  plural: "widgets",
  fields: {
    color: { required: true, check: (value) => (["red", "blue"].includes(String(value)) ? null : `${JSON.stringify(value)} is not red or blue`) },
    paper: { check: async (value, { host }) => ((await host.paper(String(value))) ? null : `paper ${value} is not a publication of this site`) },
  },
  setErrors: (items) => (items.length > 3 ? ["a widget kind holds at most three items"] : []),
};
const kinds = { widget: WIDGET, gadget: { singular: "gadget", plural: "gadgets", fields: {} } };
const host = { paper: async (slug) => slug === "real-paper" };
const pipeline = { findWideDashes };
const WIDE = String.fromCharCode(0x2014);

const compile = (slug, raw) => compileRegistryItem({ slug, raw, host, pipeline, kinds });
const file = (lines) => `---\n${lines.join("\n")}\n---\n`;

test("every kind the registry defines is a kind with fields and a plural to address it by", () => {
  for (const [kind, spec] of Object.entries(KINDS)) {
    assert.match(kind, /^[a-z][a-z-]*$/, kind);
    assert.ok(spec.singular && spec.plural && Object.keys(spec.fields).length > 0, kind);
  }
});

test("an item compiles to shared columns and the kind's own record, with a name stored once", async () => {
  const result = await compile("widget/a-red", file(["name: A red widget", "color: red", "paper: real-paper"]));
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.item, { kind: "widget", id: "a-red", name: "A red widget", status: "published", fields: { color: "red", paper: "real-paper" } });
  assert.deepEqual(JSON.parse(result.record), { color: "red", paper: "real-paper" });
  assert.equal(result.sourcePath, "content/registry/widget/a-red.md");
  assert.match(result.sourceBlobSha, /^[0-9a-f]{40}$/);
  assert.deepEqual(itemFromRow({ kind: "widget", id: "a-red", name: "A red widget", status: "published", record: result.record }), result.item);
});

test("draft: true is the draft status, and anything else but a boolean is refused", async () => {
  const draft = await compile("widget/a-draft", file(["name: A draft widget", "color: red", "draft: true"]));
  assert.equal(draft.ok && draft.item.status, "draft");
  const bad = await compile("widget/a-draft", file(["name: A draft widget", "color: red", "draft: yes"]));
  assert.equal(bad.ok, false);
  assert.match(bad.errors.join("\n"), /draft is "yes"; it is true or false/);
});

test("a value nobody has is MISSING with a reason: accepted and returned as a gap, never a guess", async () => {
  const result = await compile("widget/a-gap", file(["name: A gap widget", "color: red", 'paper: "MISSING: Dustin has not named the paper"']));
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.gaps, [{ field: "paper", reason: "Dustin has not named the paper" }]);
  const required = await compile("widget/a-gap", file(["name: A gap widget", 'color: "MISSING: not recorded"']));
  assert.equal(required.ok && required.gaps.length, 1, "a required field may be a recorded gap");
  const bare = await compile("widget/a-gap", file(["name: A gap widget", "color: red", "paper: MISSING"]));
  assert.equal(bare.ok, false);
  assert.match(bare.errors.join("\n"), /write MISSING: and the reason it is missing/);
  assert.equal(isGap("MISSING: why"), true);
  assert.equal(isGap("MISSING"), false);
});

test("every message the file has is returned together: a field the kind lacks, a missing required one, a body, a wide dash", async () => {
  const raw = `---\nname: A bad widget ${WIDE} here\nstock: 40\npaper: nope\n---\nA body.\n`;
  const result = await compile("widget/a-bad", raw);
  assert.equal(result.ok, false);
  const text = result.errors.join("\n");
  assert.match(text, /wide dash/);
  assert.match(text, /stock is not a widget field; a widget carries name, draft, color, paper and nothing else/);
  assert.match(text, /color is required for a widget/);
  assert.match(text, /paper: paper nope is not a publication of this site/);
  assert.match(text, /the body must be empty/);
});

test("a name is one line, trimmed and bounded", async () => {
  for (const name of ['""', '" padded"', `"${"x".repeat(121)}"`]) {
    const result = await compile("widget/a-name", file([`name: ${name}`, "color: red"]));
    assert.equal(result.ok, false, name);
    assert.match(result.errors.join("\n"), /name is /);
  }
});

test("the address is <kind>/<id> and nothing else, and a kind the registry lacks is refused", async () => {
  assert.deepEqual(parseRegistrySlug("widget/a-red"), { kind: "widget", id: "a-red" });
  for (const bad of ["widget", "widget/", "/a-red", "widget/a/red", "widget/A-red", "Widget/a-red", "widget/a_red", "../pages/about", "widget/..", ""]) {
    assert.equal(parseRegistrySlug(bad), null, JSON.stringify(bad));
  }
  assert.ok(ID_PATTERN.test("m13-forward") && !ID_PATTERN.test("-lead"));
  assert.equal(registryPath(registrySlug("widget", "a-red")), "content/registry/widget/a-red.md");
  const nowhere = await compile("sprocket/a-red", file(["name: A red sprocket"]));
  assert.equal(nowhere.ok, false);
  assert.match(nowhere.errors.join("\n"), /"sprocket" is not a registry kind; the kinds are widget, gadget/);
  const malformed = await compile("widget", file(["name: x", "color: red"]));
  assert.match(malformed.errors.join("\n"), /is not a registry address/);
});

test("front matter must open the file and parse", async () => {
  const noMatter = await compile("widget/a-red", "name: A red widget\ncolor: red\n");
  assert.equal(noMatter.ok, false);
  assert.match(noMatter.errors.join("\n"), /must start with a --- front matter block/);
  const notYaml = await compile("widget/a-red", "---\nname: [unclosed\n---\n");
  assert.equal(notYaml.ok, false);
  assert.match(notYaml.errors.join("\n"), /not valid YAML/);
});

test("the set refuses two items of a kind with one name, folded, and runs the kind's own set rules", async () => {
  const item = (id, name) => ({ kind: "widget", id, name, status: "published", fields: {} });
  assert.deepEqual(registrySetErrors([item("a", "Taq"), item("b", "Phusion")], kinds), []);
  assert.match(registrySetErrors([item("a", "Taq"), item("b", "TAQ")], kinds).join("\n"), /widget\/b and widget\/a are both named "TAQ"/);
  // The same name under another kind is another thing.
  assert.deepEqual(registrySetErrors([item("a", "Taq"), { ...item("a", "Taq"), kind: "gadget" }], kinds), []);
  assert.deepEqual(registrySetErrors([], kinds), [], "an empty registry is valid");
  assert.match(registrySetErrors([item("a", "A"), item("b", "B"), item("c", "C"), item("d", "D")], kinds).join("\n"), /at most three/);
});

test("items sort by kind as defined, then by name folded", () => {
  const item = (kind, name) => ({ kind, id: name.toLowerCase(), name, status: "published", fields: {} });
  const sorted = sortRegistry([item("gadget", "Zed"), item("widget", "Émile"), item("widget", "Adam"), item("gadget", "Abe")], kinds);
  assert.deepEqual(sorted.map((i) => `${i.kind}:${i.name}`), ["widget:Adam", "widget:Émile", "gadget:Abe", "gadget:Zed"]);
});

test("registry-drift reads files and rows by address, and names sync_registry", () => {
  const ok = registryDriftVerdict([{ slug: "widget/a", sha: "1" }], [{ slug: "widget/a", source_blob_sha: "1" }]);
  assert.equal(ok.ok, true);
  const empty = registryDriftVerdict([], []);
  assert.equal(empty.ok, true, "no files and no rows is converged");
  const drifted = registryDriftVerdict([{ slug: "widget/a", sha: "2" }], [{ slug: "widget/a", source_blob_sha: "1" }]);
  assert.equal(drifted.ok, false);
  assert.match(drifted.detail, /sync_registry/);
});

test("the build reads content/registry/<kind>/ for every kind, treats a missing directory as empty and refuses a stray one", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "registry-"));
  try {
    const empty = await buildRegistry({ kinds, root, host });
    assert.deepEqual(empty.rows, []);

    await mkdir(path.join(root, "content/registry/widget"), { recursive: true });
    await writeFile(path.join(root, "content/registry/widget/a-red.md"), file(["name: A red widget", "color: red"]));
    await writeFile(path.join(root, "content/registry/widget/a-gap.md"), file(["name: A gap widget", "color: red", 'paper: "MISSING: not named"']));
    const built = await buildRegistry({ kinds, root, host });
    assert.deepEqual(built.rows.map((r) => `${r.kind}/${r.id}`).sort(), ["widget/a-gap", "widget/a-red"]);
    assert.deepEqual(built.gaps, [{ slug: "widget/a-gap", field: "paper", reason: "not named" }]);
    assert.equal(built.items.length, 2);

    await writeFile(path.join(root, "content/registry/widget/a-bad.md"), file(["name: A bad widget", "color: green"]));
    await assert.rejects(buildRegistry({ kinds, root, host }), /a-bad\.md does not compile[\s\S]*color: "green" is not red or blue/);
    await rm(path.join(root, "content/registry/widget/a-bad.md"));

    await mkdir(path.join(root, "content/registry/sprocket"), { recursive: true });
    await writeFile(path.join(root, "content/registry/sprocket/x.md"), file(["name: X"]));
    const { strays } = await compileAllRegistry({ kinds, root, host });
    assert.deepEqual(strays, ["content/registry/sprocket"]);
    await assert.rejects(buildRegistry({ kinds, root, host }), /content\/registry\/sprocket is not a registry kind directory/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the real registry builds, and every row belongs to a kind it defines", async () => {
  const built = await buildRegistry();
  assert.ok(built.rows.length > 0);
  for (const row of built.rows) assert.ok(Object.hasOwn(KINDS, row.kind), `${row.kind}/${row.id}`);
});
