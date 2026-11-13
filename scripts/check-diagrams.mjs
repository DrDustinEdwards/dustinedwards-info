import { errorMessage } from "@dustinedwards/site-runtime/log";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DIAGRAM_ASSET_DIR,
  DIAGRAM_THEMES,
  diagramAssetPath,
} from "@drdustinedwards/site-helpers/render/diagram";
import {
  auditDiagramSvg,
  DIAGRAM_ROLE_NAMES,
} from "@drdustinedwards/site-helpers/render/diagram-draw";

import { escapeHtml } from "@dustinedwards/site-runtime/html";

import {
  BLOG_DIAGRAMS,
  BLOG_DIAGRAM_KEYS,
  inlineAssetNames,
} from "../app/lib/content/blog-diagrams.mjs";
import { DIAGRAM_ROLE_TOKENS } from "../app/lib/content/diagram.mjs";
import { ASSET_PREFIX } from "../app/lib/media/classify.mjs";
import { renderBody } from "../app/lib/content/pipeline.mjs";
import { resolveTokens, THEME_SELECTORS, tokenBlock } from "./lib/tokens.mjs";
import { assertFloor } from "@dustinedwards/devkit/node";
import { createTally } from "@dustinedwards/devkit/node";

const fileName = (/** @type {string} */ key, /** @type {string} */ theme) =>
  basename(diagramAssetPath(key, theme, ASSET_PREFIX));

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIAGRAM_DIR = join(root, "public", DIAGRAM_ASSET_DIR);
const ARTIFACT = join(root, "content", "generated", "posts.json");

let declarations = 0;
const tally = createTally({ print: false });
const { ok: assert, failed: failures } = tally;

// The model and its markup are Prelum's and tested there; this holds the site's configured renderer to the alt rule.
{
  const body = ':::diagram{title="T"}\n```mermaid\nflowchart LR\n  A --> B\n```\n:::\n';
  const refused = await renderBody({
    file: "gate.md",
    body,
    resolveImage: async () => ({ width: 1, height: 1 }),
  }).then(
    () => false,
    (error) => /requires an alt attribute/.test(String(error?.message)),
  );
  assert("a diagram with no alt fails", refused);
}

const themeBlocks = {
  light: tokenBlock("light", THEME_SELECTORS.light),
  dark: tokenBlock("dark", THEME_SELECTORS.dark),
  darkSystem: tokenBlock("dark (system)", THEME_SELECTORS.darkSystem),
};

assert(
  "every diagram color role has a token",
  DIAGRAM_ROLE_NAMES.every((role) => role in DIAGRAM_ROLE_TOKENS),
);
for (const [key, token] of Object.entries(DIAGRAM_ROLE_TOKENS)) {
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
    const palette = resolveTokens(DIAGRAM_ROLE_TOKENS, themeBlocks[theme], theme);
    assert(`the ${theme} palette resolves`, true);
    return palette;
  } catch (error) {
    assert(errorMessage(error), false);
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

const TONES = ["neutral", "accent", "success", "warning", "info"];
const PAINT = new Set([
  ...TONES.flatMap((tone) => [
    `var(--diagram-${tone})`,
    `var(--diagram-${tone}-line)`,
    `var(--diagram-${tone}-ink)`,
  ]),
  "var(--diagram-arrow)",
]);

const proseCss = readFileSync(join(root, "app/styles/prose.css"), "utf8");
for (const tone of TONES) {
  assert(`prose.css defines --diagram-${tone}`, proseCss.includes(`--diagram-${tone}:`));
}
// The SVG is sized by Capsomer's prose blocks (the `.blog-diagram` rule's nested `& svg`), which prose.css imports.
const blocksCss = readFileSync(
  join(root, "node_modules/capsomer/components/prose-blocks/prose-blocks.css"),
  "utf8",
);
const svgRule = blocksCss.match(/:where\(\.blog-diagram\)\s*\{[^]*?& svg\s*\{([^}]*)\}/)?.[1] ?? "";
assert(
  "an inline diagram keeps its natural width and only shrinks",
  proseCss.includes('@import "capsomer/prose-blocks.css"') &&
    /max-inline-size:\s*100%/.test(svgRule) &&
    /block-size:\s*auto/.test(svgRule) &&
    !/(?<![\w-])(inline-size|width):\s*100%/.test(svgRule),
);

/**
 * @param {string} slug
 * @param {string} html
 * @param {string} key
 */
function auditInline(slug, html, key) {
  const diagram = BLOG_DIAGRAMS[key];
  const name = `${slug} ${key}`;
  const figure = html.match(
    new RegExp(
      `<figure class="blog-diagram" role="img"[^>]*aria-labelledby="bd-${key}-title"[\\s\\S]*?</figure>`,
    ),
  )?.[0];
  assert(`${name} is an inline blog-diagram`, Boolean(figure));
  if (!figure || !diagram) return;

  assert(
    `${name} names itself from its title`,
    figure.includes(`<title id="bd-${key}-title">${escapeHtml(diagram.title)}</title>`),
  );
  assert(
    `${name} describes itself`,
    figure.includes(`<desc id="bd-${key}-desc">${escapeHtml(diagram.alt)}</desc>`),
  );
  assert(
    `${name} points its accessible name at that title and description`,
    figure.includes(`aria-describedby="bd-${key}-desc"`),
  );
  assert(`${name} still shows its caption`, figure.includes("<figcaption"));
  assert(
    `${name} is not a mermaid image`,
    !figure.includes("/diagrams/") && !html.includes(`/diagrams/${fileName(key, "light")}`),
  );

  const svg = figure.match(/<svg\b[\s\S]*<\/svg>/)?.[0] ?? "";
  assert(
    `${name} has one fixed viewBox at its natural size`,
    svg.includes(`viewBox="0 0 ${diagram.width} ${diagram.height}"`) &&
      svg.includes(`width="${diagram.width}"`) &&
      svg.includes(`height="${diagram.height}"`) &&
      diagram.width <= 680 &&
      svg.includes('preserveAspectRatio="xMidYMid meet"'),
  );
  assert(`${name} has no foreignObject`, !svg.includes("foreignObject"));
  assert(`${name} has no style attribute`, !svg.includes("style="));
  assert(`${name} has no hex color`, !/#[0-9a-fA-F]{3,8}\b/.test(svg));

  /** @type {Set<string>} */
  const tones = new Set();
  for (const tag of svg.matchAll(/<(rect|line|path|text)\b[^>]*>/g)) {
    const open = tag[0];
    for (const attr of open.matchAll(/\b(?:fill|stroke)="([^"]+)"/g)) {
      declarations += 1;
      const paint = attr[1] ?? "";
      assert(`${name} paints with a diagram token (${paint})`, PAINT.has(paint));
    }
    if (tag[1] !== "text") continue;
    const size = /\bfont-size="(\d+)"/.exec(open)?.[1];
    declarations += 1;
    assert(`${name} text is 11 to 13px`, size === "11" || size === "12" || size === "13");
    assert(`${name} text uses the site font`, /\bfont-family="var\(--ui\)"/.test(open));
  }
  for (const tone of svg.matchAll(
    /fill="var\(--diagram-(neutral|accent|success|warning|info)\)"/g,
  )) {
    if (tone[1]) tones.add(tone[1]);
  }
  assert(`${name} uses more than one semantic fill`, tones.size >= 2);
}

if (!existsSync(ARTIFACT)) {
  failures.push(`the artifact is missing at ${ARTIFACT}; run build:content`);
} else {
  const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
  /** @type {Map<string, { posts: string[] }>} */
  const referenced = new Map();
  for (const post of artifact.posts ?? []) {
    for (const diagram of post.diagrams ?? []) {
      const found = referenced.get(diagram.key);
      if (found) found.posts.push(post.slug);
      else referenced.set(diagram.key, { posts: [post.slug] });
    }
  }

  for (const post of artifact.posts ?? []) {
    for (const diagram of post.diagrams ?? []) {
      if (BLOG_DIAGRAM_KEYS.has(diagram.key)) {
        auditInline(post.slug, post.html, diagram.key);
        continue;
      }
      for (const theme of DIAGRAM_THEMES) {
        const file = join(DIAGRAM_DIR, fileName(diagram.key, theme));
        const present = existsSync(file);
        assert(
          `${post.slug} references ${fileName(diagram.key, theme)}, which is on disk`,
          present,
        );
        if (!present) continue;

        const svg = readFileSync(file, "utf8");
        // An <img> needs an intrinsic size or the browser falls back to 300x150.
        assert(
          `${fileName(diagram.key, theme)} carries an explicit width and height`,
          /<svg\b[^>]*\swidth="\d+"[^>]*\sheight="\d+"/.test(svg.slice(0, 4000)),
        );
        // foreignObject is not rendered when an SVG is loaded through <img>, so a
        // diagram carrying one comes out with blank labels on the page while
        // looking correct in a standalone viewer.
        assert(
          `${fileName(diagram.key, theme)} has no foreignObject`,
          !svg.includes("foreignObject"),
        );

        const audit = auditDiagramSvg(svg, Object.values(palettes[theme]));
        declarations += audit.checked;
        assert(
          `${fileName(diagram.key, theme)} uses only ratified token colors` +
            (audit.problems.length > 0 ? `: ${audit.problems.join("; ")}` : ""),
          audit.problems.length === 0,
        );
        assert(`${fileName(diagram.key, theme)} had colors to check`, audit.checked > 0);
      }
    }
  }

  const onDisk = existsSync(DIAGRAM_DIR)
    ? readdirSync(DIAGRAM_DIR).filter((n) => n.endsWith(".svg"))
    : [];
  const mermaidKeys = [...referenced.keys()].filter((key) => !BLOG_DIAGRAM_KEYS.has(key));
  const live = new Set(mermaidKeys.flatMap((k) => DIAGRAM_THEMES.map((t) => fileName(k, t))));
  for (const name of onDisk) {
    assert(`${name} is referenced by a post (run build:diagrams to prune)`, live.has(name));
  }
  for (const name of inlineAssetNames()) {
    assert(`${name} is not a leftover mermaid asset`, !onDisk.includes(name));
  }
  for (const key of BLOG_DIAGRAM_KEYS) {
    assert(`${key} is still a diagram in the corpus`, referenced.has(key));
  }

  // Not set just under the measurement: these counts are content, and a post may drop a diagram.
  assert(
    `the artifact yielded diagrams to check (${referenced.size} referenced)`,
    referenced.size >= BLOG_DIAGRAM_KEYS.size,
  );

  console.log(
    `check:diagrams ${referenced.size} diagrams referenced, ${onDisk.length} mermaid assets on disk`,
  );
}

// Measured by running it, never summed: 322 checks and 179 declarations on 2026-11-09.
// The declarations are fill, stroke and font-size on the three inline drawings. A mermaid
// drawing that is still an image adds its own color declarations on top of that.
const MINIMUM_CHECKS = 320;
const floorBreach = assertFloor("check:diagrams", "checks", tally.checks, MINIMUM_CHECKS);
if (floorBreach) failures.push(floorBreach);
const MINIMUM_DECLARATIONS = 179;
const declarationBreach = assertFloor(
  "check:diagrams",
  "declarations",
  declarations,
  MINIMUM_DECLARATIONS,
  "The inline drawings exposed fewer fill, stroke and font-size attributes than they carry.",
);
if (declarationBreach) failures.push(declarationBreach);

if (failures.length > 0) {
  console.error(`check:diagrams FAILED ${tally.failures} of ${tally.checks} assertions\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`check:diagrams passed ${tally.checks} assertions`);
