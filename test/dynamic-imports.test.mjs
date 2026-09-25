/* The dynamic-import finder: a dynamic import splits nothing when some module in the same graph
 * imports the same module statically, however either side spells it. */

import test from "node:test";
import assert from "node:assert/strict";

import { findIneffectiveDynamicImports, moduleKey } from "../scripts/lib/dynamic-imports.mjs";

test("a module spelled two ways is one module to the dynamic-import finder", () => {
  // Relative with an extension on one side, ~/ without one on the other: the old key cut at
  // "/app/", which a repo-relative path never contains, so these never matched.
  const found = findIneffectiveDynamicImports([
    { path: "app/lib/content/load.ts", source: 'import { run } from "./pipeline.mjs";' },
    { path: "app/routes/x.tsx", source: 'const p = await import("~/lib/content/pipeline");' },
  ]);
  assert.deepEqual(
    found.map((f) => f.module),
    ["app/lib/content/pipeline"],
  );
  assert.equal(moduleKey("../lib/x/index.ts", "app/routes/y.tsx"), "app/lib/x");
  assert.equal(moduleKey("react-router", "app/root.tsx"), null);
});

test("an import() in a type position is not a dynamic import", () => {
  const found = findIneffectiveDynamicImports([
    { path: "app/lib/a.ts", source: 'import { t } from "./typed";' },
    {
      path: "app/lib/b.ts",
      source: 'let a: Promise<typeof import("./typed")>;\ntype T = import("./typed").T;',
    },
  ]);
  assert.deepEqual(found, []);
});

test("the gate's self-test fixture reports the two defeated imports and nothing else", () => {
  const found = findIneffectiveDynamicImports([
    { path: "app/a.tsx", source: 'import { x } from "~/lib/thing";\nconst y = import("~/lib/thing");' },
    { path: "app/b.tsx", source: 'const z = import("~/lib/only-dynamic");' },
    { path: "app/lib/c.ts", source: 'import { p } from "./spelled.mjs";' },
    { path: "app/d.tsx", source: 'const w = import("~/lib/spelled");' },
  ]);
  assert.deepEqual(
    found.map((f) => [f.path, f.module]),
    [
      ["app/a.tsx", "app/lib/thing"],
      ["app/d.tsx", "app/lib/spelled"],
    ],
  );
});

test("every static importer of a defeated module is named", () => {
  const found = findIneffectiveDynamicImports([
    { path: "app/one.tsx", source: 'import { a } from "~/lib/shared";' },
    { path: "app/lib/two.ts", source: 'import { b } from "./shared.ts";' },
    { path: "app/three.tsx", source: 'const s = await import("~/lib/shared");' },
  ]);
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].importers, ["app/one.tsx", "app/lib/two.ts"]);
});

test("a package or a static import named only in a comment defeats nothing", () => {
  const found = findIneffectiveDynamicImports([
    { path: "app/a.tsx", source: 'import { h } from "react";\nconst r = import("react");' },
    { path: "app/b.tsx", source: '// import { x } from "~/lib/lazy";\nconst l = import("~/lib/lazy");' },
  ]);
  assert.deepEqual(found, []);
});
