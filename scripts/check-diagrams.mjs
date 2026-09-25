import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
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
import { createTally } from "./lib/tally.mjs";

const fileName = (/** @type {string} */ key, /** @type {string} */ theme) =>
  basename(diagramAssetPath(key, theme));

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIAGRAM_DIR = join(root, "public", DIAGRAM_ASSET_DIR);
const ARTIFACT = join(root, "content", "generated", "posts.json");

let declarations = 0;
const tally = createTally({ print: false });
const { ok: assert, failed: failures } = tally;

function assertThrows(/** @type {string} */ label, /** @type {() => unknown} */ fn, /** @type {RegExp} */ pattern) {
  let message = null;
  try {
    fn();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  if (message === null) assert(`${label}: expected a throw, got none`, false);
  else assert(`${label}: threw "${message}", which does not match ${pattern}`, pattern.test(message));
}

const SOURCE = "flowchart LR\n  A[one] --> B[two]\n";

// The directive has to be KNOWN, or the fail-closed unknown-directive rule rejects the syntax this
// module implements.
assert("diagram is in KNOWN_DIRECTIVES", KNOWN_DIRECTIVES.includes("diagram"));

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

assertThrows(
  "an empty diagram source fails",
  () => buildDiagramModel({ alt: "x" }, "   \n  \n"),
  /source is empty/,
);
assert(
  "a diagram source survives into the model",
  buildDiagramModel({ alt: "x" }, SOURCE).source === normalizeDiagramSource(SOURCE),
);

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
  diagramAssetPath("abcd1234", "dark") === `/${DIAGRAM_ASSET_DIR}/dustin-edwards-abcd1234-dark.svg`,
);

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

const themeBlocks = {
  light: tokenBlock("light", THEME_SELECTORS.light),
  dark: tokenBlock("dark", THEME_SELECTORS.dark),
  darkSystem: tokenBlock("dark (system)", THEME_SELECTORS.darkSystem),
};

for (const [key, token] of Object.entries(DIAGRAM_THEME_TOKENS)) {
  assert(`${key} names a token, not a color`, /^--[a-z0-9-]+$/.test(token));
  // Both theme blocks land on the same element and do not cascade into one another, so a token
  // forgotten in dark keeps its LIGHT value and the diagram is drawn light on a dark page.
  assert(`${key} (${token}) exists in the light theme`, token in themeBlocks.light);
  assert(`${key} (${token}) exists in the dark theme`, token in themeBlocks.dark);
  assert(
    `${key} (${token}) agrees across both dark blocks`,
    themeBlocks.dark[token] === themeBlocks.darkSystem[token],
  );
}

/** @param {"light" | "dark"} theme */
function paletteFor(theme) {
  try {
    const palette = resolveTokens(DIAGRAM_THEME_TOKENS, themeBlocks[theme], theme);
    assert(`the ${theme} palette resolves`, true);
    return palette;
  } catch (error) {
    assert(error instanceof Error ? error.message : String(error), false);
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
    // Committed and hand-editable, so a hand-edited key would point at an asset drawn from other source.
    assert(
      `${key} is the key its own source hashes to (${posts.join(", ")})`,
      diagramKey(source) === key,
    );
    for (const theme of DIAGRAM_THEMES) {
      const file = join(DIAGRAM_DIR, fileName(key, theme));
      const present = existsSync(file);
      assert(
        `${posts.join(", ")} references ${fileName(key, theme)}, which is on disk`,
        present,
      );
      if (!present) continue;

      const svg = readFileSync(file, "utf8");
      // An <img> needs an intrinsic size or the browser falls back to 300x150.
      assert(
        `${fileName(key, theme)} carries an explicit width and height`,
        /<svg\b[^>]*\swidth="\d+"[^>]*\sheight="\d+"/.test(svg.slice(0, 4000)),
      );
      // foreignObject is not rendered when an SVG is loaded through <img>, so a
      // diagram carrying one comes out with blank labels on the page while
      // looking correct in a standalone viewer.
      assert(`${fileName(key, theme)} has no foreignObject`, !svg.includes("foreignObject"));

      const audit = auditDiagramSvg(svg, Object.values(palettes[theme]));
      // Tallied apart from `checks`: added in, a few hundred declarations hid a skipped block from the floor.
      declarations += audit.checked;
      assert(
        `${fileName(key, theme)} uses only ratified token colors` +
          (audit.problems.length > 0 ? `: ${audit.problems.join("; ")}` : ""),
        audit.problems.length === 0,
      );
      assert(`${fileName(key, theme)} had colors to check`, audit.checked > 0);
    }
  }

  const onDisk = existsSync(DIAGRAM_DIR)
    ? readdirSync(DIAGRAM_DIR).filter((n) => n.endsWith(".svg"))
    : [];
  const live = new Set(
    [...referenced.keys()].flatMap((k) => DIAGRAM_THEMES.map((t) => fileName(k, t))),
  );
  for (const name of onDisk) {
    assert(`${name} is referenced by a post (run build:diagrams to prune)`, live.has(name));
  }

  // Not set just under the measurement: these counts are content, and a post may drop a diagram.
  assert(`the artifact yielded diagrams to check (${referenced.size} referenced)`, referenced.size >= 2);
  assert(`the diagram directory yielded assets to check (${onDisk.length} on disk)`, onDisk.length >= 4);

  console.log(
    `check:diagrams ${referenced.size} diagrams referenced, ${onDisk.length} assets on disk`,
  );
}

// Measured by running it, never summed: 221 checks and 202 declarations on 2026-09-24, over 3 diagrams.
const MINIMUM_CHECKS = 210;
const floorBreach = assertFloor("check:diagrams", "checks", tally.checks, MINIMUM_CHECKS);
if (floorBreach) failures.push(floorBreach);
const MINIMUM_DECLARATIONS = 150;
const declarationBreach = assertFloor(
  "check:diagrams",
  "declarations",
  declarations,
  MINIMUM_DECLARATIONS,
  "The color audit examined fewer declarations than the committed diagrams carry.",
);
if (declarationBreach) failures.push(declarationBreach);

if (failures.length > 0) {
  console.error(`check:diagrams FAILED ${tally.failures} of ${tally.checks} assertions\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`check:diagrams passed ${tally.checks} assertions`);
