import test from "node:test";
import assert from "node:assert/strict";

import { cssRelativeImports, moduleCssImports } from "../scripts/lib/tokens.mjs";

test("every spelling of a relative @import is followed", () => {
  const css = [
    '@import "./a.css";',
    "@import './b.css';",
    '@import url("./c.css");',
    "@import url(./d.css) screen;",
  ].join("\n");
  assert.deepEqual(cssRelativeImports(css), ["./a.css", "./b.css", "./c.css", "./d.css"]);
});

test("a commented-out @import and a package import are not followed", () => {
  const css = '/* @import "./gone.css"; */\n@import "tailwindcss";\n@import "./kept.css";';
  assert.deepEqual(cssRelativeImports(css), ["./kept.css"]);
});

test("module CSS imports in either quote, with or without a semicolon, with ?url", () => {
  const source = [
    'import "./a.css";',
    "import './b.css'",
    'import href from "~/styles/c.css?url";',
  ].join("\n");
  assert.deepEqual(moduleCssImports(source), ["./a.css", "./b.css", "~/styles/c.css"]);
});
