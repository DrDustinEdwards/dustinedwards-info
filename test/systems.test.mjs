// /systems (app/lib/systems.mjs): the site's check of Capsid's public model, and what the page
// and its twins draw from it. Fixtures use invented systems.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { systemMapHtml } from "capsomer/behaviour/system-map";

import { chooseInMapHtml, chosenSystem, connectionsOf, explorerLabel, explorerUrl, outsideOf, partsOf, loadSystemModel, mapData, parseSystemModel, systemHref, systemSectionMarkdown, sameModel, systemsMarkdown, wiresOf } from "../app/lib/systems.mjs";

const fixture = () => ({
  version: 1,
  as_of: "2026-10-11",
  systems: [
    { id: "core", name: "Core", short: "Core", family: "system", ring: "core", private: false, description: "Runs it all.", domain: "core.example.com", repos: ["https://github.com/example/core"] },
    { id: "kit", name: "Kit", short: "Kit", family: "plumbing", ring: "shared", private: false, description: "Shared parts." },
    { id: "app", name: "App", short: "App", family: "product", ring: "used", private: false, description: "What people use.", domain: "app.example.com" },
    { id: "hidden", name: "Hidden", short: "Hidden", family: "product", ring: "used", private: true, description: "Kept private.", domain: "hidden.example.org" },
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

await test("the committed model passes, and a private system names no repo", () => {
  const model = loadSystemModel(JSON.parse(readFileSync(new URL("../data/system-model.json", import.meta.url), "utf8")));
  assert.ok(model.systems.length >= 10 && model.systems.some((s) => s.private), `read ${model.systems.length} systems`);
  const linked = fixture();
  linked.systems[3].repos = ["https://github.com/example/hidden"];
  assert.match(refused(linked), /systems\.3/);
});

await test("an unknown key anywhere is refused", () => {
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

await test("lines name things that exist, ids are unique and the counts agree", () => {
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

await test("the map draws every system once, linking to no page of its own", () => {
  const model = loadSystemModel(fixture());
  const data = mapData(model);
  assert.deepEqual(data.systems.map((s) => s.id), ["core", "kit", "app", "hidden"]);
  // One page: choosing a system shows it in place, so no system links away.
  assert.deepEqual(data.systems.map((s) => s.href), [undefined, undefined, undefined, undefined]);
  assert.deepEqual(data.systems.map((s) => s.tag), [undefined, "shared", "product", "product"]);
  const hidden = data.systems.find((s) => s.id === "hidden");
  assert.equal(hidden.private, true);
  assert.equal(hidden.description, "Kept private.");
  assert.equal(data.relationships.length, 3);
  // The box under a part names its kind; the longer technology is on the page and in the twin.
  assert.deepEqual(data.containers, [{ id: "core-worker", system: "core", name: "Worker", kind: "worker" }]);
});

await test("a system's connections read from its own end", () => {
  const model = loadSystemModel(fixture());
  const read = (id) => connectionsOf(model, id).map((c) => `${c.verb} ${c.name}`);
  assert.deepEqual(read("kit"), ["Is installed by Core", "Is installed by App"]);
  assert.deepEqual(read("hidden"), ["Is coordinated by Core"]);
  assert.deepEqual(read("core"), ["Installs Kit", "Coordinates Hidden"]);
});

await test("a chosen system lives in the query, and a value naming no system chooses nothing", () => {
  const model = loadSystemModel(fixture());
  assert.equal(systemHref("kit"), "/systems?system=kit");
  assert.equal(chosenSystem(model, "kit"), "kit");
  for (const value of [null, undefined, "", "nowhere", "Kit", "kit "]) assert.equal(chosenSystem(model, value), null, String(value));
});

await test("the server draws a chosen system's wiring as the controller would, and changes nothing else", () => {
  const model = loadSystemModel(fixture());
  const html = systemMapHtml(mapData(model), { id: "family" });
  const chosen = chooseInMapHtml(html, "kit");
  assert.match(chosen, /<figure class="cap-system-map" data-cap="system-map" data-selected /);
  assert.match(chosen, /class="cap-system-map-tile" data-id="kit" aria-pressed="true"/);
  // Kit's lines run to Core and App: both are linked and both lines are on; Hidden is not.
  assert.match(chosen, /class="cap-system-map-tile" data-id="core" data-linked/);
  assert.match(chosen, /class="cap-system-map-tile" data-id="app" data-linked/);
  assert.doesNotMatch(chosen, /data-id="hidden" data-linked/);
  const on = [...chosen.matchAll(/<path class="cap-system-map-edge" data-from="([^"]+)" data-to="([^"]+)" [^>]*data-on/g)].map((m) => `${m[1]}-${m[2]}`);
  assert.deepEqual(on.sort(), ["app-kit", "core-kit"]);
  // Only attributes are added: take them away and the drawing is Capsomer's, byte for byte.
  const stripped = chosen
    .replace(/ data-selected /, " ")
    .replace(/(data-id="kit") aria-pressed="true"/, "$1")
    .replace(/(class="cap-system-map-tile" data-id="[^"]+") data-linked/g, "$1")
    .replace(/(class="cap-system-map-edge" [^>]*?) data-on/g, "$1");
  assert.equal(stripped, html);
});

await test("the twin holds every system's facts, a private one without its source", () => {
  const model = loadSystemModel(fixture());
  const all = systemsMarkdown(model, "https://example.com");
  for (const s of model.systems) assert.ok(all.includes(`### ${s.name}`), `${s.id} missing from /systems.md`);
  assert.match(all, /^### Hidden \(private\)\n\nKept private\. Its repo is private\.\n/m);
  // No system twin of its own any more: every link goes to the page with that system chosen.
  assert.doesNotMatch(all, /\/systems\/[a-z]/);
  assert.match(all, /^- On the map: https:\/\/example\.com\/systems\?system=kit$/m);
  const one = systemSectionMarkdown(model, "hidden", "https://example.com");
  assert.match(one, /^### Hidden \(private\)\n\nKept private\. Its repo is private\.\n/);
  assert.match(one, /- Address: https:\/\/hidden\.example\.org/);
  assert.doesNotMatch(one, /Source:/);
  assert.equal(systemSectionMarkdown(model, "nowhere", "https://example.com"), null);
  const core = systemSectionMarkdown(model, "core", "https://example.com");
  assert.match(core, /- Source: https:\/\/github\.com\/example\/core/);
  assert.match(core, /#### Inside\n\n- Worker \(Cloudflare Worker\)\n/);
  // A name that also appears in the verb is linked as the name, not inside the verb.
  const named = fixture();
  named.systems[1].name = "Installs";
  assert.match(systemSectionMarkdown(loadSystemModel(named), "core", "https://example.com"), /^- Installs \[Installs\]\(https:\/\/example\.com\/systems\?system=kit\)$/m);
  assert.doesNotMatch(systemSectionMarkdown(model, "kit", "https://example.com"), /#### Inside/);
});

await test("every system's section of the twin links to the same system in the Capsid explorer, and the twin to the explorer", () => {
  const model = loadSystemModel(fixture());
  for (const s of model.systems) {
    assert.match(systemSectionMarkdown(model, s.id, "https://example.com") ?? "", new RegExp(`^- In the Capsid explorer: https://capsid\\.dustinedwards\\.info/s/${s.id}/$`, "m"));
  }
  assert.equal(explorerUrl("hidden"), "https://capsid.dustinedwards.info/s/hidden/");
  assert.equal(explorerLabel("hidden"), "capsid.dustinedwards.info/s/hidden");
  assert.match(systemsMarkdown(model, "https://example.com"), /^Capsid explorer: https:\/\/capsid\.dustinedwards\.info\/$/m);
});

await test("the lines between a system's parts are facts on its page and in its twin", () => {
  const raw = fixture();
  raw.containers.push({ id: "core-db", system: "core", name: "Store", kind: "database", technology: "D1" });
  raw.relationships.push({ id: "core-worker--writes--core-db", from: "core-worker", to: "core-db", kind: "writes" });
  raw.counts.containers = 2;
  raw.counts.relationships = 4;
  const model = loadSystemModel(raw);
  assert.deepEqual(wiresOf(model, "core"), ["Worker writes to Store"]);
  assert.deepEqual(wiresOf(model, "kit"), []);
  assert.match(systemSectionMarkdown(model, "core", "https://example.com"), /How they connect:\n\n- Worker writes to Store\n/);
});

// Capsid's flows (design section 4). Fixture flows ride the fixture's edges.
const withFlows = () => {
  const raw = fixture();
  raw.containers.push({ id: "core-agents", system: "core", name: "Agents", kind: "external", technology: "Sample sessions" });
  raw.relationships.push({ id: "core-worker--serves--core-agents", from: "core-worker", to: "core-agents", kind: "serves" });
  raw.counts.containers = 2;
  raw.counts.relationships = 4;
  raw.flows = [
    {
      id: "sample-life",
      name: "A sample's life",
      steps: [
        { relationship: "core-worker--serves--core-agents", toward: "core-worker", text: "Posted.", lights: ["core-worker"] },
        { relationship: "core--installs--kit", toward: "kit", text: "Installed." },
      ],
    },
  ];
  return raw;
};

await test("a model with flows passes, and a flow off the model's edges is refused", () => {
  assert.equal(loadSystemModel(withFlows()).flows?.length, 1);
  const bad = withFlows();
  bad.containers.push({ id: "app-worker", system: "app", name: "App worker", kind: "worker", technology: "Sample" });
  bad.counts.containers = bad.containers.length;
  bad.flows?.push({
    id: "sample-life",
    name: "Bad",
    steps: [
      { relationship: "core--reads--app", toward: "app", text: "No such edge." },
      { relationship: "core--installs--kit", toward: "app", text: "Wrong end." },
      { relationship: "core--coordinates--hidden", toward: "hidden", text: "Not a part.", lights: ["kit"] },
      { relationship: "core--installs--kit", toward: "kit", text: "Lit elsewhere.", lights: ["core-agents", "app-worker"] },
    ],
  });
  const problems = refused(bad);
  assert.match(problems, /flows\.sample-life: the id is used twice/);
  assert.match(problems, /steps\.1: rides core--reads--app, which is not a relationship in the model/);
  assert.match(problems, /steps\.2: goes toward app, which is not an end of core--installs--kit/);
  assert.match(problems, /steps\.3: lights kit, which is not a container/);
  assert.match(problems, /steps\.4: lights app-worker, a part of app, which the step does not run in/);
  assert.doesNotMatch(problems, /steps\.4: lights core-agents/, "core-agents is a part of core, which the step runs in");
  const extra = withFlows();
  extra.flows[0].steps[0].secret = "x";
  assert.match(refused(extra), /flows\.0\.steps\.0/);
});

await test("an external container is outside the system: not a part, but its lines are drawn", () => {
  const model = loadSystemModel(withFlows());
  assert.deepEqual(partsOf(model, "core").map((c) => c.id), ["core-worker"]);
  assert.deepEqual(outsideOf(model, "core").map((c) => c.id), ["core-agents"]);
  assert.deepEqual(wiresOf(model, "core"), ["Worker serves Agents"]);
  assert.match(systemSectionMarkdown(model, "core", "https://example.com") ?? "", /#### Inside\n\n- Worker \(Cloudflare Worker\)\n\n#### Outside it\n\n- Agents \(Sample sessions\)\n\nHow they connect:\n\n- Worker serves Agents\n/);
  // A system whose only containers are outside it still lists them and their lines.
  const bare = withFlows();
  bare.containers = bare.containers.filter((c) => c.kind === "external");
  bare.containers.push({ id: "core-github", system: "core", name: "GitHub", kind: "external", technology: "Sample host" });
  bare.relationships = bare.relationships.filter((r) => !r.id.startsWith("core-worker"));
  bare.relationships.push({ id: "core-agents--reads--core-github", from: "core-agents", to: "core-github", kind: "reads" });
  bare.flows = [];
  bare.counts.relationships = bare.relationships.length;
  const twin = systemSectionMarkdown(loadSystemModel(bare), "core", "https://example.com") ?? "";
  assert.match(twin, /#### Outside it\n\n- Agents \(Sample sessions\)\n- GitHub \(Sample host\)\n/);
  assert.doesNotMatch(twin, /#### Inside|How they connect|Agents reads GitHub/);
});

await test("a model that differs only in its date is the same model", () => {
  const a = loadSystemModel(fixture());
  const b = loadSystemModel({ ...fixture(), as_of: "2026-10-12" });
  assert.equal(sameModel(a, b), true);
  const c = fixture();
  c.systems[1].description = "Shared parts, renamed.";
  assert.equal(sameModel(a, loadSystemModel(c)), false);
});

await test("the daily refresh writes only a checked model that says something new", async () => {
  const { createServer } = await import("node:http");
  const { execFile } = await import("node:child_process");
  const { mkdtempSync, writeFileSync, readFileSync: read } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  let served = fixture();
  // Core's repo, example/core, as the raw host serves it; every other path there is a 404.
  let wrangler = { name: "core", d1_databases: [] };
  const server = createServer((req, res) => {
    if (req.url?.startsWith("/raw/")) {
      res.statusCode = req.url === "/raw/example/core/HEAD/wrangler.jsonc" ? 200 : 404;
      return res.end(`// A comment, as in the real ones.\n${JSON.stringify(wrangler)}`);
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(served));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
  const address = server.address();
  const url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/`;
  const file = join(mkdtempSync(join(tmpdir(), "system-model-")), "model.json");
  const committed = `${JSON.stringify(fixture(), null, 2)}\n`;
  writeFileSync(file, committed);
  const script = new URL("../scripts/refresh-system-model.mjs", import.meta.url).pathname;
  const refresh = (/** @type {Record<string, string>} */ extra = {}) =>
    new Promise((resolve) =>
      execFile(process.execPath, [script, url], { env: { ...process.env, SYSTEM_MODEL_FILE: file, GITHUB_OUTPUT: "", OPEN_MODEL: "", SYSTEM_REPOS_RAW: `${url}raw`, ...extra } }, (error, stdout, stderr) =>
        resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr }),
      ),
    );
  try {
    served = { ...fixture(), as_of: "2026-10-12" };
    let run = await refresh();
    assert.equal(run.code, 0, run.stderr);
    assert.match(run.stdout, /changed=false/);
    assert.equal(read(file, "utf8"), committed, "a new date alone rewrote the file");

    served = fixture();
    served.systems[2].description = "What people use, now with more.";
    run = await refresh();
    assert.match(run.stdout, /changed=true/);
    assert.match(run.stdout, /same_as_open=false/);
    assert.match(read(file, "utf8"), /now with more/);

    // The open pull request already carries this model: a new date alone leaves it alone.
    const open = join(mkdtempSync(join(tmpdir(), "system-model-open-")), "open.json");
    writeFileSync(open, read(file, "utf8"));
    writeFileSync(file, committed);
    served = { ...served, as_of: "2026-10-13" };
    run = await refresh({ OPEN_MODEL: open });
    assert.match(run.stdout, /changed=true/);
    assert.match(run.stdout, /same_as_open=true/);

    const before = read(file, "utf8");
    served = fixture();
    served.systems[3].repos = ["https://github.com/example/hidden"];
    run = await refresh();
    assert.notEqual(run.code, 0, "a model the site refuses was accepted");
    assert.equal(read(file, "utf8"), before, "a refused model was written");

    // A Worker's cron expressions are one schedule, and a Worker drawn as its schedule counts as
    // the Worker: a second Worker that only runs a cron passes as one cron container.
    served = fixture();
    served.systems[0].description = "Runs it all, on a schedule.";
    served.containers.push({ id: "core-tick", system: "core", name: "Tick", kind: "cron", technology: "Cron Trigger" });
    served.counts = { ...served.counts, containers: served.containers.length };
    wrangler = { ...wrangler, triggers: { crons: ["*/5 * * * *", "0 9 * * *"] } };
    run = await refresh();
    assert.equal(run.code, 0, run.stderr);
    writeFileSync(file, before);
    wrangler = { name: "core", d1_databases: [] };

    // A part core's Wrangler config declares that the model does not list fails the run, named.
    served = fixture();
    served.systems[0].description = "Runs it all, and a bucket.";
    wrangler = { ...wrangler, r2_buckets: [{ binding: "MEDIA", bucket_name: "core-media" }] };
    run = await refresh();
    assert.notEqual(run.code, 0, "a part the model leaves out was accepted");
    assert.match(run.stderr, /core: 1 bucket in Wrangler \(core-media\), 0 in the model/);
    assert.equal(read(file, "utf8"), before, "a model missing a part was written");
  } finally {
    server.close();
  }
});
