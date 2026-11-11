// /systems (app/lib/systems.mjs): the site's check of Capsid's public model, and what the page
// and its twins draw from it. Fixtures use invented systems.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { modelMarkdown } from "capsomer/behavior/system-model";

import { loadSystemModel, mapData, systemPath, twinOptions } from "../app/lib/systems.mjs";

const fixture = () => ({
  version: 1,
  as_of: "2026-10-11",
  systems: [
    {
      id: "core",
      name: "Core",
      short: "Core",
      family: "system",
      ring: "core",
      private: false,
      description: "Runs it all.",
      domain: "core.example.com",
      repos: ["https://github.com/example/core"],
    },
    {
      id: "kit",
      name: "Kit",
      short: "Kit",
      family: "plumbing",
      ring: "shared",
      private: false,
      description: "Shared parts.",
    },
    {
      id: "app",
      name: "App",
      short: "App",
      family: "product",
      ring: "used",
      private: false,
      description: "What people use.",
      domain: "app.example.com",
    },
    {
      id: "hidden",
      name: "Hidden",
      short: "Hidden",
      family: "product",
      ring: "used",
      private: true,
      description: "Kept private.",
      domain: "hidden.example.org",
    },
  ],
  containers: [
    {
      id: "core-worker",
      system: "core",
      name: "Worker",
      kind: "worker",
      technology: "Cloudflare Worker",
    },
  ],
  relationships: [
    { id: "core--installs--kit", from: "core", to: "kit", kind: "installs" },
    { id: "app--installs--kit", from: "app", to: "kit", kind: "installs" },
    { id: "core--coordinates--hidden", from: "core", to: "hidden", kind: "coordinates" },
  ],
  counts: { systems: 4, public: 3, private: 1, containers: 1, relationships: 3 },
});

await test("the committed model passes, and a private system names no repo", () => {
  const model = loadSystemModel(
    JSON.parse(readFileSync(new URL("../data/system-model.json", import.meta.url), "utf8")),
  );
  assert.ok(
    model.systems.length >= 10 && model.systems.some((s) => s.private),
    `read ${model.systems.length} systems`,
  );
  const linked = fixture();
  linked.systems[3].repos = ["https://github.com/example/hidden"];
  assert.throws(
    () => loadSystemModel(linked),
    /data\/system-model\.json is refused[\s\S]*systems\.3/,
  );
});

await test("the map draws every system once, each linking to its own page here", () => {
  const data = mapData(loadSystemModel(fixture()));
  assert.deepEqual(
    data.systems.map((s) => s.href),
    ["/systems/core", "/systems/kit", "/systems/app", "/systems/hidden"],
  );
  assert.equal(systemPath("a b"), "/systems/a%20b");
});

await test("the twin says this site's words: its title, intro and ring headings, and each system's page here", () => {
  const model = loadSystemModel(fixture());
  const all = modelMarkdown(model, twinOptions(model, "https://example.com"));
  assert.match(
    all,
    /^# Systems\n\nThe systems Dustin Edwards runs\. Public model of 2026-10-11\.\n/,
  );
  assert.match(all, /^## Runs everything$/m);
  assert.match(all, /^- Its page: https:\/\/example\.com\/systems\/kit$/m);
  assert.doesNotMatch(all, /Source: .*hidden/);
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
      execFile(
        process.execPath,
        [script, url],
        {
          env: {
            ...process.env,
            SYSTEM_MODEL_FILE: file,
            GITHUB_OUTPUT: "",
            OPEN_MODEL: "",
            SYSTEM_REPOS_RAW: `${url}raw`,
            ...extra,
          },
        },
        (error, stdout, stderr) => resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr }),
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
    served.containers.push({
      id: "core-tick",
      system: "core",
      name: "Tick",
      kind: "cron",
      technology: "Cron Trigger",
    });
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
