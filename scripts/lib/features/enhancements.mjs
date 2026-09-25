// The enhancement inventory: every module in app/enhance/ names a fallback this gate can verify.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { renderBody } from "../../../app/lib/content/pipeline.mjs";
import { codeOf, root } from "./shared.mjs";

const ENHANCEMENTS_PATH = join(root, "content", "enhancements.json");
const ENHANCE_DIR = join(root, "app", "enhance");

/** A tripwire: a new module means walking this list. */
const EXPECTED_ENHANCE_MODULES = 9;

/** Set under measured, to catch a module that stopped being read. */
const MINIMUM_ENHANCEMENT_ENTRIES = 9;

/** Sources under `app/` except `app/enhance/` and stylesheets: neither renders a fallback. */
function serverRenderedSources(/** @type {string} */ dir, /** @type {string[]} */ out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (full === ENHANCE_DIR) continue;
      serverRenderedSources(full, out);
    } else if (/\.(ts|tsx|mjs)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/* Plus the shared renderer's output (remark-gfm footnotes), from a fixture: the claim is about the
   renderer, not the corpus. */
const RENDERER_FIXTURE = [
  "A paragraph with a footnote reference[^1].",
  "",
  "[^1]: The note itself, which is a real bidirectional link.",
  "",
  "```ts",
  "const highlighted = true;",
  "```",
  "",
  "## A heading, which gets an autolink",
  "",
  "![An image, which gets an anchor to its original](/dustin-edwards-og-image.png)",
].join("\n");

/** Short tokens are skipped as too generic. */
function selectorTokens(/** @type {string} */ selector) {
  return (selector.match(/[A-Za-z][\w-]{3,}/g) ?? []).filter(
    (token, index, all) => all.indexOf(token) === index,
  );
}

/** @param {import("./shared.mjs").FeaturesContext} ctx */
export async function checkEnhancements({ ok, routes }) {
  ok(
    "content/enhancements.json exists",
    existsSync(ENHANCEMENTS_PATH),
    "the inventory is missing, so every assertion below would examine nothing",
  );

  /** @type {any[]} */
  let inventory = [];
  if (existsSync(ENHANCEMENTS_PATH)) {
    inventory = JSON.parse(readFileSync(ENHANCEMENTS_PATH, "utf8")).enhancements ?? [];
  }

  const enhanceFiles = existsSync(ENHANCE_DIR)
    ? readdirSync(ENHANCE_DIR)
        // Every script extension, or a .tsx or .mjs enhancement escapes the count and the inventory.
        .filter((name) => /\.(?:ts|tsx|mjs|js)$/.test(name))
        .sort()
    : [];

  ok(
    "app/enhance/ holds the expected number of modules",
    enhanceFiles.length === EXPECTED_ENHANCE_MODULES,
    `found ${enhanceFiles.length} (${enhanceFiles.join(", ") || "none"}), expected ` +
      `${EXPECTED_ENHANCE_MODULES}. A new enhancement module needs a row in ` +
      `content/enhancements.json and this number moved in the same commit.`,
  );
  ok(
    "the enhancement inventory is not empty",
    inventory.length >= MINIMUM_ENHANCEMENT_ENTRIES,
    `${inventory.length} entr(ies), expected at least ${MINIMUM_ENHANCEMENT_ENTRIES}; ` +
      `below that the per-entry assertions stop examining anything`,
  );

  const inventoryModules = new Set(
    inventory.map((/** @type {any} */ e) => String(e.module ?? "")),
  );

  for (const name of enhanceFiles) {
    const relPath = `app/enhance/${name}`;
    ok(
      `enhancements: ${relPath} appears in the inventory`,
      inventoryModules.has(relPath),
      `no entry names ${relPath}, so an enhancement shipped without a named fallback`,
    );
  }

  for (const modulePath of [...inventoryModules].sort()) {
    ok(
      `enhancements: ${modulePath || "(unnamed)"} exists on disk`,
      Boolean(modulePath) && existsSync(join(root, modulePath)),
      `the inventory names ${modulePath || "(nothing)"}, which is not in the repo`,
    );
  }

  const serverSources = serverRenderedSources(join(root, "app"));

  /* Catches a walk that stops descending; re-measure by running the gate. */
  ok(
    "the server-rendered source scope is non-empty and complete",
    serverSources.length >= 145,
    `walked ${serverSources.length} file(s) under app/ excluding app/enhance/, floor 145, ` +
      `measured 158. The walker has stopped matching this tree, or stopped descending into it.`,
  );

  /* Comments stripped, so a comment cannot satisfy a fallback. */
  const sourceBlobs = serverSources.map((file) => codeOf(file));

  const renderedMarkup = await renderBody({
    file: "check-features fixture",
    body: RENDERER_FIXTURE,
    resolveImage: async () => ({ width: 1200, height: 630 }),
  }).then((result) => result.html);

  // Scope first: a failed render would narrow the sweep.
  ok(
    "the renderer fixture produced markup for the selector sweep",
    renderedMarkup.length > 0 && /<section[^>]*class="footnotes"/.test(renderedMarkup),
    `the shared renderer emitted ${renderedMarkup.length} byte(s) and no footnotes ` +
      `section. Either the fixture stopped exercising remark-gfm, or the pipeline ` +
      `stopped emitting the markup this sweep is about to search.`,
  );
  sourceBlobs.push(renderedMarkup);

  let fallbacksNamed = 0;
  let selectorTokensChecked = 0;
  const kindCounts = { route: 0, selector: 0, none: 0 };

  for (const entry of inventory) {
    const id = String(entry.id ?? "(unnamed)");
    const kind = String(entry.fallbackKind ?? "");

    ok(
      `enhancements ${id}: names a fallback`,
      typeof entry.fallback === "string" && entry.fallback.trim().length > 0,
      "the progressive-enhancement rule: an enhancement with no named fallback is a dependency, not an enhancement",
    );
    if (typeof entry.fallback === "string" && entry.fallback.trim().length > 0) {
      fallbacksNamed += 1;
    }

    ok(
      `enhancements ${id}: fallbackKind is one this gate can verify`,
      kind === "route" || kind === "selector" || kind === "none",
      `${JSON.stringify(kind)} is not route, selector or none`,
    );

    if (kind === "route") {
      kindCounts.route += 1;
      const path = String(entry.fallbackAt ?? "");
      ok(
        `enhancements ${id}: the fallback route ${path} is declared`,
        routes.has(path),
        `routes.ts declares no ${path}, so the fallback points at nothing`,
      );
    } else if (kind === "selector") {
      kindCounts.selector += 1;
      const selector = String(entry.fallbackAt ?? "");
      const tokens = selectorTokens(selector);
      // No checkable token would mean examining nothing.
      ok(
        `enhancements ${id}: the selector ${selector} yields a checkable identifier`,
        tokens.length > 0,
        `nothing in ${JSON.stringify(selector)} is long enough to search for without ` +
          `matching half the tree`,
      );
      for (const token of tokens) {
        selectorTokensChecked += 1;
        // DELIMITED, so `prose` cannot be satisfied by `proseWidth`.
        const needle = new RegExp(
          `(^|[^\\w-])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w-]|$)`,
        );
        ok(
          `enhancements ${id}: ${token} is server-rendered, outside app/enhance/`,
          sourceBlobs.some((blob) => needle.test(blob)),
          `${token} appears as a whole token in NONE of the ${serverSources.length} ` +
            `.ts/.tsx/.mjs file(s) under app/ outside app/enhance/ (comments stripped), ` +
            `and the shared renderer does not emit it either. Markup the enhancement ` +
            `creates for itself is not a fallback, and neither is a class named only ` +
            `by a stylesheet or a comment.`,
        );
      }
    } else if (kind === "none") {
      kindCounts.none += 1;
      ok(
        `enhancements ${id}: a fallback of nothing carries its reason`,
        typeof entry.why === "string" && entry.why.trim().length > 0,
        "the law requires the nothing to be WRITTEN DOWN, because that is what " +
          "distinguishes a decision from an omission",
      );
    }
  }

  console.log(
    `     ${inventory.length} enhancement(s) over ${inventoryModules.size} module(s), ` +
      `${fallbacksNamed} fallback(s) named`,
  );
  console.log(
    `     kinds: ${kindCounts.route} route, ${kindCounts.selector} selector ` +
      `(${selectorTokensChecked} identifier(s) checked), ${kindCounts.none} deliberate nothing`,
  );
  // Printed so its floor can be re-measured.
  console.log(
    `     ${serverSources.length} server-rendered file(s) searched, excluding app/enhance/`,
  );
  console.log(
    `     NOT asserted here: that any route is server-complete with script off. ` +
      `That is a claim about the wire.`,
  );
}
