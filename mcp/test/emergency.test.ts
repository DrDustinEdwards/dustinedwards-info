/**
 * The emergency return kit in mcp/emergency must stay deployable over the live
 * Worker. Cloudflare refuses a deploy that drops a registered Durable Object
 * class without a deleting migration, and refuses a rollback across a class
 * change, so the kit has to carry every class and every migration the main
 * config has, under the same Worker name and the same storage bindings. Each
 * expectation is read from the main config, so a migration added there later
 * fails here until the kit carries it too.
 */
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

function config(path: string) {
  const text = readFileSync(new URL(path, import.meta.url), "utf8");
  return JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""));
}

const main = config("../wrangler.jsonc.example");
const kit = config("../emergency/wrangler.jsonc.example");
const kitIndex = readFileSync(new URL("../emergency/src/index.ts", import.meta.url), "utf8");

describe("the emergency return kit", () => {
  test("deploys over the same Worker", () => {
    assert.equal(kit.name, main.name);
    assert.equal(kit.main, "src/index.ts");
  });

  test("carries every migration the main config has, in order", () => {
    assert.deepEqual(kit.migrations, main.migrations);
  });

  test("binds every Durable Object class the main config binds, under the same names", () => {
    const shape = (c: { durable_objects?: { bindings?: Array<{ name: string; class_name: string }> } }) =>
      (c.durable_objects?.bindings ?? []).map((b) => `${b.name}:${b.class_name}`).sort();
    assert.deepEqual(shape(kit), shape(main));
  });

  test("its entry exports every bound class", () => {
    for (const binding of kit.durable_objects.bindings as Array<{ class_name: string }>) {
      assert.match(kitIndex, new RegExp(`export \\{ ${binding.class_name} \\}`), binding.class_name);
    }
  });

  test("keeps the same KV namespaces, so grants and captures survive", () => {
    const kv = (c: { kv_namespaces?: Array<{ binding: string }> }) => (c.kv_namespaces ?? []).map((n) => n.binding).sort();
    assert.deepEqual(kv(kit), kv(main));
  });

  test("answers on workers.dev again and keeps the custom domain", () => {
    assert.equal(kit.workers_dev, true);
    assert.deepEqual(kit.routes, main.routes);
  });

  test("names the old address for ship's checks", () => {
    assert.equal(kit.vars.PUBLIC_ORIGIN, "https://dustinedwards-mcp.dustin-edwards.workers.dev");
  });
});
