import test from "node:test";
import assert from "node:assert/strict";

import { THEME_SELECTORS, tokenBlock } from "../scripts/lib/tokens.mjs";

test("a token declared twice reads as its first declaration, the hex", () => {
  // app.css declares --text-disabled, --placeholder and --glass-fill-paper as a hex and then the
  // color-mix() recipe that reproduces it. check:contrast and build-tokens keep the first; a
  // last-wins reader handed consumers the recipe, which resolveTokens refuses as not a hex.
  for (const [mode, selector] of Object.entries(THEME_SELECTORS)) {
    const block = tokenBlock(mode, selector);
    for (const name of ["--text-disabled", "--placeholder"]) {
      if (!(name in block)) continue;
      assert.match(block[name], /^#[0-9a-f]{3,8}$/i, `${mode} ${name} is ${block[name]}`);
    }
  }
  assert.match(tokenBlock("light", THEME_SELECTORS.light)["--glass-fill-paper"], /^#[0-9a-f]{3,8}$/i);
});
