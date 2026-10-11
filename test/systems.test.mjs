// /systems (app/lib/systems.mjs): the site's check of Capsid's public model, the third line of
// the design's privacy filter (capsid/research/design-system-explorer.md, section 2), and what
// the page and its twins draw from it. Fixtures use invented systems.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { PRIVATE_SYSTEM_KEYS, connectionsOf, loadSystemModel, mapData, parseSystemModel, systemMarkdown, systemsMarkdown, wiresOf } from "../app/lib/systems.mjs";

const fixture = () => ({
  version: 1,
  as_of: "2026-10-11",
  systems: [
    { id: "core", name: "Core", short: "Core", family: "system", ring: "core", private: false, description: "Runs it all.", domain: "core.example.com", repos: ["https://github.com/example/core"] },
    { id: "kit", name: "Kit", short: "Kit", family: "plumbing", ring: "shared", private: false, description: "Shared parts." },
    { id: "app", name: "App", short: "App", family: "product", ring: "used", private: false, description: "What people use.", domain: "app.example.com" },
    { id: "hidden", name: "Hidden", short: "Hidden", domain: "hidden.example.org", family: "product", ring: "used", private: true },
  ],
  containers: [{ id: "core-worker", system: "core", name: "Worker", kind: "worker", technology: "Cloudflare Worker" }],
  relationships: [
    { id: "core--installs--kit", from: "core", to: "kit", kind: "installs" },
    { id: "app--installs--kit", from: "app", to: "kit", kind: "installs" },
    { id: "core--coordinates--hidden", from: "core", to: "hidden", kind: "coordinates" },
  ],
  counts: { systems: 4, public: 3, private: 1, containers: 1, relationships: 3 },
});

const refused = (raw) => {
  const result = parseSystemModel(raw);
  assert.equal(result.ok, false, "a model that should be refused was accepted");
  return result.problems.join("\n");
};

test("the committed model passes, and its private systems carry only the allowed keys", () => {
  const model = loadSystemModel(JSON.parse(readFileSync(new URL("../data/system-model.json", import.meta.url), "utf8")));
  const privates = model.systems.filter((s) => s.private);
  assert.ok(model.systems.length >= 10 && privates.length >= 1, `read ${model.systems.length} systems, ${privates.length} private`);
  for (const s of privates) assert.deepEqual(Object.keys(s).sort(), [...PRIVATE_SYSTEM_KEYS].sort(), `${s.id} carries more than its name and address`);
});

test("a private system carrying anything more is refused, whichever key it is", () => {
  for (const extra of [{ description: "Its internals." }, { repos: ["https://github.com/example/hidden"] }, { secret: "x" }]) {
    const raw = fixture();
    Object.assign(raw.systems[3], extra);
    assert.match(refused(raw), /systems\.3/);
  }
  // Marked private with no domain: neither shape fits.
  const raw = fixture();
  delete raw.systems[3].domain;
  assert.match(refused(raw), /systems\.3/);
});

test("an unknown key anywhere is refused", () => {
  const top = fixture();
  top.extra = 1;
  refused(top);
  const container = fixture();
  container.containers[0].secret = "x";
  refused(container);
  const line = fixture();
  line.relationships[0].note = "x";
  refused(line);
});

test("nothing reaches inside a private system", () => {
  const inside = fixture();
  inside.containers.push({ id: "hidden-db", system: "hidden", name: "DB", kind: "database", technology: "D1" });
  inside.counts.containers = 2;
  assert.match(refused(inside), /inside private system hidden/);
  const titled = fixture();
  titled.relationships[2].title = "What Core does to Hidden";
  assert.match(refused(titled), /a title on a line to a private system/);
  const wired = fixture();
  wired.relationships.push({ id: "core-worker--reads--hidden", from: "core-worker", to: "hidden", kind: "reads" });
  assert.match(refused(wired), /reaches inside a system to a private one/);
});

test("lines name things that exist, ids are unique and the counts agree", () => {
  const dangling = fixture();
  dangling.relationships[0].to = "nowhere";
  assert.match(refused(dangling), /no element nowhere/);
  const twice = fixture();
  twice.systems.push({ ...twice.systems[1] });
  assert.match(refused(twice), /an id is used twice/);
  for (const key of ["systems", "public", "private", "containers", "relationships"]) {
    const miscounted = fixture();
    miscounted.counts[key] += 1;
    assert.match(refused(miscounted), /counts/, `counts.${key} off by one was accepted`);
  }
});

test("the map draws every system once, each linking to its page, with no private description", () => {
  const model = loadSystemModel(fixture());
  const data = mapData(model);
  assert.deepEqual(data.systems.map((s) => s.id), ["core", "kit", "app", "hidden"]);
  assert.deepEqual(data.systems.map((s) => s.href), ["/systems/core", "/systems/kit", "/systems/app", "/systems/hidden"]);
  assert.deepEqual(data.systems.map((s) => s.tag), [undefined, "shared", "product", "product"]);
  const hidden = data.systems.find((s) => s.id === "hidden");
  assert.equal(hidden.private, true);
  assert.equal(hidden.description, undefined);
  assert.equal(data.relationships.length, 3);
  // The box under a part names its kind; the longer technology is on the page and in the twin.
  assert.deepEqual(data.containers, [{ id: "core-worker", system: "core", name: "Worker", kind: "worker" }]);
});

test("a system's connections read from its own end", () => {
  const model = loadSystemModel(fixture());
  const read = (id) => connectionsOf(model, id).map((c) => `${c.verb} ${c.name}`);
  assert.deepEqual(read("kit"), ["Is installed by Core", "Is installed by App"]);
  assert.deepEqual(read("hidden"), ["Is coordinated by Core"]);
  assert.deepEqual(read("core"), ["Installs Kit", "Coordinates Hidden"]);
});

test("the twins hold every system, and a private one only as its name", () => {
  const model = loadSystemModel(fixture());
  const all = systemsMarkdown(model, "https://example.com");
  for (const s of model.systems) assert.ok(all.includes(`[${s.name}](https://example.com/systems/${s.id}.md)`), `${s.id} missing from /systems.md`);
  assert.match(all, /\[Hidden\]\(https:\/\/example\.com\/systems\/hidden\.md\) \(private\)\n/);
  const one = systemMarkdown(model, "hidden", "https://example.com");
  assert.match(one, /^# Hidden\n\nPrivate: its name and address only\.\n/);
  assert.match(one, /- Address: https:\/\/hidden\.example\.org/);
  assert.doesNotMatch(one, /Source:/);
  assert.equal(systemMarkdown(model, "nowhere", "https://example.com"), null);
  const core = systemMarkdown(model, "core", "https://example.com");
  assert.match(core, /- Source: https:\/\/github\.com\/example\/core/);
  assert.match(core, /## Inside\n\n- Worker \(Cloudflare Worker\)\n/);
  // A name that also appears in the verb is linked as the name, not inside the verb.
  const named = fixture();
  named.systems[1].name = "Installs";
  assert.match(systemMarkdown(loadSystemModel(named), "core", "https://example.com"), /^- Installs \[Installs\]\(https:\/\/example\.com\/systems\/kit\.md\)$/m);
  // A private system with no address says so.
  const bare = fixture();
  bare.systems[3].domain = "";
  assert.match(systemMarkdown(loadSystemModel(bare), "hidden", "https://example.com"), /^# Hidden\n\nPrivate: its name only\.\n/);
  assert.doesNotMatch(systemMarkdown(model, "kit", "https://example.com"), /## Inside/);
});

test("the lines between a system's parts are facts on its page and in its twin", () => {
  const raw = fixture();
  raw.containers.push({ id: "core-db", system: "core", name: "Store", kind: "database", technology: "D1" });
  raw.relationships.push({ id: "core-worker--writes--core-db", from: "core-worker", to: "core-db", kind: "writes" });
  raw.counts.containers = 2;
  raw.counts.relationships = 4;
  const model = loadSystemModel(raw);
  assert.deepEqual(wiresOf(model, "core"), ["Worker writes to Store"]);
  assert.deepEqual(wiresOf(model, "kit"), []);
  assert.match(systemMarkdown(model, "core", "https://example.com"), /How they connect:\n\n- Worker writes to Store\n/);
});
