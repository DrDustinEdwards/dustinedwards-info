/**
 * Gate over the `:::diagram` directive and the assets it references.
 *
 *   npm run check:diagrams
 *
 * BOUNDARY: the contract, asset coverage and a colour audit over committed bytes. It does NOT run
 * mermaid and does not open a browser, so a diagram that renders as tangled spaghetti passes as
 * long as its key, its alt and its colours are right.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildDiagramModel,
  diagramAssetPath,
  diagramKey,
  DIAGRAM_ASSET_DIR,
  DIAGRAM_THEME_TOKENS,
  DIAGRAM_THEMES,
  normalizeDiagramSource,
  renderDiagramHast,
} from "../app/lib/content/diagram.mjs";
import { KNOWN_DIRECTIVES } from "../app/lib/content/pipeline.mjs";
import { auditDiagramSvg } from "./lib/diagram-audit.mjs";
import { resolveTokens, THEME_SELECTORS, tokenBlock } from "./lib/tokens.mjs";
import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIAGRAM_DIR = join(root, "public", DIAGRAM_ASSET_DIR);
const ARTIFACT = join(root, "content", "generated", "posts.json");

let checks = 0;
/** @type {string[]} */
const failures = [];

/** @param {string} label @param {boolean} ok */
function assert(label, ok) {
  checks += 1;
  if (!ok) failures.push(label);
}

/** Asserts that a call throws, and that the message names the problem. */
function assertThrows(/** @type {string} */ label, /** @type {() => unknown} */ fn, /** @type {RegExp} */ pattern) {
  checks += 1;
  try {
    fn();
    failures.push(`${label}: expected a throw, got none`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!pattern.test(message)) {
      failures.push(`${label}: threw "${message}", which does not match ${pattern}`);
    }
  }
}

const SOURCE = "flowchart LR\n  A[one] --> B[two]\n";

/* 1. The contract */

// The directive has to be KNOWN, or the fail-closed unknown-directive rule rejects the syntax this
// module implements.
assert("diagram is in KNOWN_DIRECTIVES", KNOWN_DIRECTIVES.includes("diagram"));

// alt, and its negative
assertThrows(
  "a diagram with no alt fails",
  () => buildDiagramModel({}, SOURCE),
  /requires an alt attribute/,
);
assertThrows(
  "a diagram with a blank alt fails",
  () => buildDiagramModel({ alt: "   " }, SOURCE),
  /requires an alt attribute/,
);
assert(
  "a diagram with an alt builds",
  buildDiagramModel({ alt: "two boxes" }, SOURCE).alt === "two boxes",
);

// source, and its negative
assertThrows(
  "an empty diagram source fails",
  () => buildDiagramModel({ alt: "x" }, "   \n  \n"),
  /source is empty/,
);
assert(
  "a diagram source survives into the model",
  buildDiagramModel({ alt: "x" }, SOURCE).source === normalizeDiagramSource(SOURCE),
);

// keys
assert("a key is eight hex characters", /^[0-9a-f]{8}$/.test(diagramKey(SOURCE)));
assert("the same source gives the same key", diagramKey(SOURCE) === diagramKey(SOURCE));
assert(
  "a changed source gives a different key",
  diagramKey(SOURCE) !== diagramKey(`${SOURCE}  B --> C\n`),
);
// The repo checks content out as LF and everything else as CRLF, so a line-ending-dependent key
// would differ between clones and each would believe the other's asset missing.
assert(
  "line endings do not change a key",
  diagramKey(SOURCE) === diagramKey(SOURCE.replace(/\n/g, "\r\n")),
);
assert(
  "surrounding blank lines do not change a key",
  diagramKey(SOURCE) === diagramKey(`\n\n${SOURCE}\n\n`),
);
assert(
  "the asset path is site-absolute and names the theme",
  diagramAssetPath("abcd1234", "dark") === `/${DIAGRAM_ASSET_DIR}/abcd1234-dark.svg`,
);

// the emitted structure
{
  const model = buildDiagramModel(
    { alt: "two boxes, one arrow", title: "A title" },
    SOURCE,
  );
  const caption = [{ type: "element", tagName: "p", properties: {}, children: [] }];
  const children = renderDiagramHast(model, caption);
  const images = children.filter((/** @type {any} */ c) => c.tagName === "img");

  assert("one image per theme", images.length === DIAGRAM_THEMES.length);
  assert(
    "every image carries the alt as its accessible name",
    images.every((/** @type {any} */ i) => i.properties.alt === "two boxes, one arrow"),
  );
  // The contract names the element that IS the graphic, never the figure: for an `<img>` that is
  // `alt`, and a role plus a label would be a redundant override of a native mechanism.
  assert(
    "no image redeclares role or aria-label",
    images.every(
      (/** @type {any} */ i) => i.properties.role === undefined && i.properties["aria-label"] === undefined,
    ),
  );
  assert(
    "the images are the two themes, in order",
    images.map((/** @type {any} */ i) => i.properties.src).join(" ") ===
      DIAGRAM_THEMES.map((t) => diagramAssetPath(model.key, t)).join(" "),
  );
  assert(
    "each image is classed for the theme switch",
    DIAGRAM_THEMES.every((t, i) =>
      /** @type {any} */ (images[i]).properties.className.includes(`diagram-${t}`),
    ),
  );
  // No width or height: the pipeline may not touch the filesystem and the asset may not exist yet.
  assert(
    "no image claims a size the pipeline could not have measured",
    images.every(
      (/** @type {any} */ i) => i.properties.width === undefined && i.properties.height === undefined,
    ),
  );
  // A heading here would land in the table of contents, which scans h2 and h3.
  const title = children.find((/** @type {any} */ c) => c.tagName !== "img" && c.tagName !== "figcaption");
  assert("the title is a paragraph, not a heading", title?.tagName === "p");
  assert(
    "the caption is last and is a figcaption",
    /** @type {any} */ (children[children.length - 1]).tagName === "figcaption",
  );
}
{
  const children = renderDiagramHast(buildDiagramModel({ alt: "x" }, SOURCE), []);
  assert(
    "an untitled, uncaptioned diagram emits only its images",
    children.every((/** @type {any} */ c) => c.tagName === "img"),
  );
}

/* 2. The token map */

const themeBlocks = {
  light: tokenBlock("light", THEME_SELECTORS.light),
  dark: tokenBlock("dark", THEME_SELECTORS.dark),
  darkSystem: tokenBlock("dark (system)", THEME_SELECTORS.darkSystem),
};

for (const [key, token] of Object.entries(DIAGRAM_THEME_TOKENS)) {
  assert(`${key} names a token, not a colour`, /^--[a-z0-9-]+$/.test(token));
  // Both theme blocks land on the same element and do not cascade into one another, so a token
  // forgotten in dark keeps its LIGHT value and the diagram is drawn light on a dark page.
  assert(`${key} (${token}) exists in the light theme`, token in themeBlocks.light);
  assert(`${key} (${token}) exists in the dark theme`, token in themeBlocks.dark);
  assert(
    `${key} (${token}) agrees across both dark blocks`,
    themeBlocks.dark[token] === themeBlocks.darkSystem[token],
  );
}

/**
 * Resolution is the same call the build makes, so a map this gate accepts is a map that renders.
 * It THROWS on a bad token, so it is caught here and reported like every other assertion.
 *
 * @param {"light" | "dark"} theme
 */
function paletteFor(theme) {
  checks += 1;
  try {
    return resolveTokens(DIAGRAM_THEME_TOKENS, themeBlocks[theme], theme);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
    return {};
  }
}

/** @type {Record<string, Record<string, string>>} */
const palettes = { light: paletteFor("light"), dark: paletteFor("dark") };
assert(
  "the two palettes differ, so the pair is not two copies of one drawing",
  Object.keys(palettes.light).length > 0 &&
    JSON.stringify(palettes.light) !== JSON.stringify(palettes.dark),
);

/* 3. Coverage and colour over what is actually committed */

if (!existsSync(ARTIFACT)) {
  failures.push(`the artifact is missing at ${ARTIFACT}; run build:content`);
} else {
  const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
  /** @type {Map<string, { source: string, posts: string[] }>} */
  const referenced = new Map();
  for (const post of artifact.posts ?? []) {
    for (const diagram of post.diagrams ?? []) {
      const found = referenced.get(diagram.key);
      if (found) found.posts.push(post.slug);
      else referenced.set(diagram.key, { source: diagram.source, posts: [post.slug] });
    }
  }

  for (const [key, { source, posts }] of referenced) {
    // The artifact is generated, but it is also COMMITTED and hand-editable,
    // and a hand-edited key would point at an asset drawn from other source.
    assert(
      `${key} is the key its own source hashes to (${posts.join(", ")})`,
      diagramKey(source) === key,
    );
    for (const theme of DIAGRAM_THEMES) {
      const file = join(DIAGRAM_DIR, `${key}-${theme}.svg`);
      const present = existsSync(file);
      assert(
        `${posts.join(", ")} references ${key}-${theme}.svg, which is on disk`,
        present,
      );
      if (!present) continue;

      const svg = readFileSync(file, "utf8");
      // An <img> needs an intrinsic size or the browser falls back to 300x150.
      assert(
        `${key}-${theme}.svg carries an explicit width and height`,
        /<svg\b[^>]*\swidth="\d+"[^>]*\sheight="\d+"/.test(svg.slice(0, 4000)),
      );
      // foreignObject is not rendered when an SVG is loaded through <img>, so a
      // diagram carrying one comes out with blank labels on the page while
      // looking correct in a standalone viewer.
      assert(`${key}-${theme}.svg has no foreignObject`, !svg.includes("foreignObject"));

      const audit = auditDiagramSvg(svg, Object.values(palettes[theme]));
      checks += audit.checked;
      if (audit.problems.length > 0) {
        failures.push(
          `${key}-${theme}.svg uses colours that are not ratified tokens: ` +
            audit.problems.join("; "),
        );
      }
      // An assertion that can pass by reading nothing is not an assertion.
      assert(`${key}-${theme}.svg had colours to check`, audit.checked > 0);
    }
  }

  const onDisk = existsSync(DIAGRAM_DIR)
    ? readdirSync(DIAGRAM_DIR).filter((n) => n.endsWith(".svg"))
    : [];
  const live = new Set(
    [...referenced.keys()].flatMap((k) => DIAGRAM_THEMES.map((t) => `${k}-${t}.svg`)),
  );
  for (const name of onDisk) {
    assert(`${name} is referenced by a post (run build:diagrams to prune)`, live.has(name));
  }

  /*
   * SCOPE FLOORS. Both counts were PRINTED and neither asserted, which is a number on the console
   * that no run can fail on. Every loop above iterates one of these, and the executed-count floor
   * cannot see them empty, the per-diagram assertions being a small share of the total. **These are
   * the one place where the floor is not set just under the measurement, because these counts are
   * CONTENT, not scope**: a post may legitimately drop a diagram, and what they must catch is the
   * walk collapsing.
   */
  assert(`the artifact yielded diagrams to check (${referenced.size} referenced)`, referenced.size >= 2);
  assert(`the diagram directory yielded assets to check (${onDisk.length} on disk)`, onDisk.length >= 4);

  console.log(
    `check:diagrams ${referenced.size} diagrams referenced, ${onDisk.length} assets on disk`,
  );
}

/*
 * EXECUTED-COUNT FLOOR. Almost every assertion sits inside a loop over a discovered set, so an
 * empty discovery, a changed extension or a renamed directory all report a clean audit of nothing.
 * MEASURED BY RUNNING IT, never summed.
 */
const MINIMUM_CHECKS = 390;
const floorBreach = assertFloor("check:diagrams", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) failures.push(floorBreach);

if (failures.length > 0) {
  console.error(`check:diagrams FAILED ${failures.length} of ${checks} assertions\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`check:diagrams passed ${checks} assertions`);
