/**
 * Generate the Design System pane's PREVIEW CARDS from the site's own stylesheets and components.
 *
 *   node .design-sync/build-cards.mjs     (build-inputs.mjs runs it; so does design:resync)
 *
 * ## WHY CARDS
 *
 * Claude Design builds the pane's visual index from preview cards: an HTML file whose FIRST LINE is
 * `<!-- @dsCard group="..." -->`, compiled into `_ds_manifest.json`. The converter emits one per
 * synced component, and this site syncs two (the logo crops), so the pane showed two logos and a
 * README. These cards are the rest of the system: colors, type and the public components, grouped
 * the way the approved visual system (`templates/visual-system/` in the design system project) is.
 *
 * ## WHERE EACH CARD'S TRUTH COMES FROM
 *
 *   Colors      every swatch is painted by `var(--token)` inside a `data-theme` cell, so the
 *               synced stylesheet paints it; the hex printed beside it is read from `app/app.css`
 *               through `scripts/lib/tokens.mjs`, and a token that is missing or not a plain hex
 *               fails the build. The names and one-line jobs are the visual system's.
 *   Type        each specimen is the site's own markup and class, so the synced stylesheet sets it;
 *               the size line under it is MEASURED in the card by `getComputedStyle`, so it cannot
 *               disagree with the CSS the way a typed number would (hard rule 17).
 *   Components  `cards.tsx`, server-rendered from the real components; see its header.
 *
 * ## OUTPUT
 *
 * `.design-sync/.cache/cards/<group>/<slug>/<slug>.html`, gitignored with the rest of the cache.
 * ONE CARD PER DIRECTORY, because the pane's self-check keeps the first @dsCard file per
 * directory. `scripts/ds-resync.mjs` copies the tree to the bundle's `cards/`, where the upload
 * scope allows it (`scripts/lib/ds-upload-scope.mjs`). The returned digest rides the README, so a
 * changed card flips the sync's docs partition and the cards upload with it.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { bundleRoutes } from "../scripts/lib/route-render.mjs";
import { resolveTokens, THEME_SELECTORS, tokenBlock } from "../scripts/lib/tokens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
export const CARDS_CACHE = join(HERE, ".cache", "cards");

/** Pane groups, in the order the visual system draws them. The folder is the group, lowercased. */
const GROUPS = { colors: "Colors", type: "Type", components: "Components" };

/** @param {string} s */
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The frame every card shares. It uses only tokens, draws no box, radius or shadow (the README's
 * avoid list), and each themed panel sets both its ground and its ink, because a `data-theme`
 * container that sets one inherits the other from the page.
 */
const FRAME_CSS = `
    body { margin: 0; background: var(--paper); color: var(--text); }
    .ds-panel { background: var(--paper); color: var(--text); padding: 24px; }
    .ds-panel + .ds-panel { border-top: var(--line-w) solid var(--dust); }
    .ds-label { margin: 0 0 16px; font: 12px/1.5 var(--font-mono); color: var(--text-secondary); }`;

/**
 * @param {{ group: string, title: string, viewport?: string, body: string, css?: string, script?: string }} card
 */
function page({ group, title, viewport, body, css = "", script = "" }) {
  const vp = viewport ? ` viewport="${esc(viewport)}"` : "";
  return `<!-- @dsCard group="${esc(group)}"${vp} -->
<!doctype html>
<html lang="en"><head><meta charset="utf-8">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="../../../styles.css">
  <style>${FRAME_CSS}${css}
  </style>
</head><body>
${body}${script ? `\n<script>${script}</script>` : ""}
</body></html>
`;
}

/** @param {string} theme @param {string} inner */
const panel = (theme, inner) =>
  `<section class="ds-panel" data-theme="${theme}">\n  <p class="ds-label">${theme === "light" ? "Light" : "Dark"}</p>\n${inner}\n</section>`;

// ---------------------------------------------------------------------------------------------
// Colors

/**
 * The closed set, as the visual system names it. A row with two tokens takes the first in light
 * and the second in dark, which is how the figure series step between themes.
 */
const PAGE_COLORS = [
  ["Paper", "--paper", "--paper", "The ground of every page, header and footer included."],
  ["Ink", "--text", "--text", "Body text, titles, row titles and the wordmark."],
  ["Quiet ink", "--text-secondary", "--text-secondary", "Dates, deks, summaries, captions and labels."],
  ["Dust", "--dust", "--dust", "Every rule and hairline. Never text, never the edge that identifies a control."],
  ["Brand", "--brand", "--brand", "Anything a reader can click, and the focus ring. Nothing else."],
  ["Brand hover", "--brand-hover", "--brand-hover", "A link under the pointer."],
  ["Visited", "--visited", "--visited", "A link the reader has already followed."],
  ["Error", "--error", "--error", "Form error text. The one color allowed to fill."],
];

const FIGURE_COLORS = [
  ["Oxide", "--fig-oxide-400", "--fig-oxide-300", "Figure and plate numbers, leaders and labels. Series 1."],
  ["Leaf", "--fig-leaf-400", "--fig-leaf-300", "Figure series 2."],
  ["Cadet", "--chart-cadet", "--chart-cadet", "Figure series 3."],
  ["Lawn", "--fig-lawn", "--fig-lawn", "The plate's lawn. A figure fill, never a page surface."],
  ["Turbid", "--fig-turbid", "--fig-turbid", "A turbid plaque, the tone between lawn and clearing."],
  ["Texture", "--fig-dust-300", "--fig-dust-300", "Dashed halos and stipple. Never a series, never a label."],
];

const COLOR_CSS = `
    .ds-colors { display: grid; grid-template-columns: 132px 132px minmax(0, 1fr); }
    .ds-colors > * { border-bottom: var(--line-w) solid var(--dust); }
    .ds-colors .ds-head { padding: 8px 14px; font: 12px/1.5 var(--font-mono); color: var(--text-secondary); }
    .ds-swatch { background: var(--paper); padding: 14px; display: flex; flex-direction: column; gap: 8px; }
    .ds-chip { height: 52px; border: var(--line-w) solid var(--dust); }
    .ds-hex { font: 12px/1.5 var(--font-mono); color: var(--text-secondary); }
    .ds-what { padding: 14px 0 14px 20px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .ds-name { font: 700 15px/1.3 var(--font-sans); }
    .ds-token { font: 12px/1.5 var(--font-mono); color: var(--text-secondary); }
    .ds-job { font: 16px/1.45 var(--font-serif); }`;

/**
 * @param {string} title
 * @param {string[][]} rows
 * @param {{ light: Record<string, string>, dark: Record<string, string> }} blocks
 */
function colorCard(title, rows, blocks) {
  const light = resolveTokens(Object.fromEntries(rows.map((r) => [r[0], r[1]])), blocks.light, `${title}, light`);
  const dark = resolveTokens(Object.fromEntries(rows.map((r) => [r[0], r[2]])), blocks.dark, `${title}, dark`);
  const cells = rows
    .map(([name, lt, dt, job]) => {
      const token = lt === dt ? lt : `${lt} / ${dt.replace(/^--.*-(\d+)$/, "-$1")}`;
      return `  <div class="ds-swatch" data-theme="light"><div class="ds-chip" style="background: var(${lt})"></div><span class="ds-hex">${light[name]}</span></div>
  <div class="ds-swatch" data-theme="dark"><div class="ds-chip" style="background: var(${dt})"></div><span class="ds-hex">${dark[name]}</span></div>
  <div class="ds-what"><span class="ds-name">${esc(name)}</span><span class="ds-token">${esc(token)}</span><span class="ds-job">${esc(job)}</span></div>`;
    })
    .join("\n");
  return `<section class="ds-panel" data-theme="light">
<div class="ds-colors">
  <span class="ds-head">Light</span><span class="ds-head">Dark</span><span class="ds-head"></span>
${cells}
</div>
</section>`;
}

// ---------------------------------------------------------------------------------------------
// Type

/**
 * Each specimen is the site's markup, and `target` is the element whose computed style the card
 * reports. A container is part of the markup where the site's selector is scoped by it
 * (`.post-head h1`, `.post-body .prose p`), and left out where the class stands alone.
 */
const TYPE_CARDS = [
  {
    slug: "name-and-wordmark",
    title: "Name and wordmark",
    specimens: [
      ["Name", `<main class="tracks home-tracks"><section class="home-intro"><h1 class="intro-name">Dustin Edwards</h1></section></main>`, ".intro-name"],
      ["Wordmark", `<a class="site-header-brand" href="/">Dustin Edwards</a>`, ".site-header-brand"],
    ],
  },
  {
    slug: "titles-and-reading",
    title: "Titles and reading text",
    specimens: [
      ["Page title", `<main class="tracks post-tracks"><header class="post-head"><h1>Ten years on Cloudflare</h1></header></main>`, ".post-head h1"],
      ["Heading in a post", `<main class="tracks post-tracks"><article class="post post-body"><div class="prose"><h2>What the numbers say</h2></div></article></main>`, ".prose h2"],
      ["Dek", `<main class="tracks post-tracks"><header class="post-head"><p class="post-dek">Professor by training. I build on Cloudflare and publish the numbers.</p></header></main>`, ".post-dek"],
      ["Row title", `<span class="home-row-title">Ten years on Cloudflare</span>`, ".home-row-title"],
      ["Reading text", `<main class="tracks post-tracks"><article class="post post-body"><div class="prose"><p>Dustin Edwards, professor and full-stack engineer. Building on Cloudflare Workers, D1, R2 and KV, with the measurements.</p></div></article></main>`, ".prose p"],
      ["Section label", `<h2 class="home-section-heading">Writing</h2>`, ".home-section-heading"],
    ],
  },
  {
    slug: "interface",
    title: "Interface",
    specimens: [
      ["Navigation", `<nav class="site-header-nav" aria-label="Sample"><a href="/about">About</a><a href="/blog">Blog</a><a href="/publications">Publications</a></nav>`, ".site-header-nav a"],
      ["Summary and caption", `<span class="home-row-summary">Complete lysis; lytic.</span>`, ".home-row-summary"],
      ["Footer heading", `<h2 class="footer-heading">Research</h2>`, ".footer-heading"],
    ],
  },
  {
    slug: "values",
    title: "Values",
    specimens: [
      ["Value", `<span class="home-row-date">2026-09-14</span>`, ".home-row-date"],
      [
        "Plate label",
        `<figure class="home-plate" style="margin: 0"><svg class="plate plate--wide" viewBox="0 0 240 24" style="inline-size: 240px"><text x="0" y="18" class="plate-label">iv · halo</text></svg></figure>`,
        ".plate-label",
      ],
    ],
  },
];

const TYPE_CSS = `
    .ds-spec { display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr); gap: 12px 32px; align-items: baseline; padding-block: 22px; border-bottom: var(--line-w) solid var(--dust); }
    .ds-spec:first-of-type { border-top: var(--line-w) solid var(--dust); }
    .ds-role { display: flex; flex-direction: column; gap: 4px; }
    .ds-role b { font: 700 14px/1.3 var(--font-sans); }
    .ds-measured { font: 12px/1.5 var(--font-mono); color: var(--text-secondary); }
    .ds-sample { min-width: 0; overflow-wrap: anywhere; }
    .ds-sample main, .ds-sample header, .ds-sample article { display: block; margin: 0; padding: 0; min-height: 0; }
    /* Block spacing belongs to the page, not the face, and would space the rows unevenly. */
    .ds-sample :is(h1, h2, p, section, figure) { margin-block: 0; }`;

/**
 * Fills each role's measured line from the specimen as the synced stylesheet sets it. Before it
 * runs, or with script off, the line names the selector, which is still true.
 */
const MEASURE_SCRIPT = `
(function () {
  function family(f) {
    var first = f.split(",")[0].replace(/["']/g, "").trim();
    if (/^Inter/.test(first)) return "Inter";
    if (/^Source Serif/.test(first)) return "Source Serif";
    if (/mono|SFMono|Menlo|Consolas/i.test(first)) return "Mono";
    return first;
  }
  function px(v) { var n = parseFloat(v); return Math.round(n * 10) / 10; }
  document.querySelectorAll("[data-measure]").forEach(function (line) {
    var el = line.closest(".ds-spec").querySelector(line.getAttribute("data-measure"));
    if (!el) { line.textContent += " (not found)"; return; }
    var s = getComputedStyle(el);
    var parts = [family(s.fontFamily) + " " + s.fontWeight, px(s.fontSize) + "/" + (s.lineHeight === "normal" ? "normal" : px(s.lineHeight))];
    if (s.letterSpacing !== "normal" && parseFloat(s.letterSpacing) !== 0) {
      parts.push((parseFloat(s.letterSpacing) / parseFloat(s.fontSize)).toFixed(3).replace("-", "\\u2212") + "em");
    }
    line.textContent = parts.join(" \\u00b7 ");
  });
})();`;

/** @param {(typeof TYPE_CARDS)[number]} card */
function typeCard(card) {
  const rows = card.specimens
    .map(
      ([role, markup, target]) => `  <div class="ds-spec">
    <div class="ds-role"><b>${esc(role)}</b><span class="ds-measured" data-measure="${esc(target)}">${esc(target)}</span></div>
    <div class="ds-sample">${markup}</div>
  </div>`,
    )
    .join("\n");
  return `<section class="ds-panel" data-theme="light">\n${rows}\n</section>`;
}

// ---------------------------------------------------------------------------------------------
// Components

/**
 * Enhancement bundles never run in a card; see cards.tsx. React's server renderer also emits a
 * `<link rel="preload">` per image, which in a card only fetches a root-relative path that 404s.
 */
function stripScripts(html) {
  const out = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<link\b[^>]*\brel="preload"[^>]*\/?>/g, "");
  if (/<script\b/i.test(out)) throw new Error("a script tag survived the strip");
  return out;
}

/**
 * A root-relative image (`src="/dustin-edwards-orcid-id.svg"`) names the site's `public/`, which
 * the design system project does not have, so it is inlined from that folder. A source that is not
 * there fails the build rather than shipping a broken image.
 */
function inlinePublicImages(html) {
  return html.replace(/\ssrc="\/([^"/][^"]*\.svg)"/g, (_, file) => {
    const abs = join(REPO, "public", file);
    if (!existsSync(abs)) throw new Error(`card image /${file} is not in public/`);
    return ` src="data:image/svg+xml;base64,${readFileSync(abs).toString("base64")}"`;
  });
}

async function componentCards() {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createRoutesStub } = await import("react-router");

  const bundle = await bundleRoutes([".design-sync/cards.tsx"]);
  try {
    /** @type {{ COMPONENT_CARDS: Array<{ slug: string, title: string, viewport?: string, body: () => unknown, enhance?: (h: string) => string }> }} */
    const mod = await import(pathToFileURL(bundle.files[0]).href);
    if (!Array.isArray(mod.COMPONENT_CARDS) || mod.COMPONENT_CARDS.length === 0) {
      throw new Error("cards.tsx exported no COMPONENT_CARDS");
    }
    return mod.COMPONENT_CARDS.map((card) => {
      const render = () => {
        const Stub = createRoutesStub([{ path: "/", Component: () => card.body() }]);
        const html = inlinePublicImages(stripScripts(renderToStaticMarkup(createElement(/** @type {any} */ (Stub), { initialEntries: ["/"] }))));
        if (/\s(?:src|href)="\/[^/"]*\.(?:svg|png|jpe?g|webp)"/.test(html)) {
          throw new Error(`${card.slug}: a root-relative asset survived; it will not load in the pane`);
        }
        if (html.trim() === "") throw new Error(`${card.slug}: rendered nothing`);
        return card.enhance ? card.enhance(html) : html;
      };
      const body = ["light", "dark"].map((theme) => panel(theme, render())).join("\n");
      return { group: "components", slug: card.slug, title: card.title, viewport: card.viewport, body };
    });
  } finally {
    await bundle.cleanup();
  }
}

// ---------------------------------------------------------------------------------------------

/**
 * Build every card into the cache. Rebuilt from empty, so a card removed from the lists cannot
 * survive as a stale file.
 *
 * @returns {Promise<{ files: string[], digest: string }>} paths relative to the cache root
 */
export async function buildCards() {
  const blocks = {
    light: tokenBlock("light", THEME_SELECTORS.light),
    dark: tokenBlock("dark", THEME_SELECTORS.dark),
  };

  /** @type {Array<{ group: string, slug: string, title: string, viewport?: string, body: string, css?: string, script?: string }>} */
  const cards = [
    { group: "colors", slug: "page-colors", title: "Page colors", body: colorCard("Page colors", PAGE_COLORS, blocks), css: COLOR_CSS },
    { group: "colors", slug: "figure-colors", title: "Figure colors", body: colorCard("Figure colors", FIGURE_COLORS, blocks), css: COLOR_CSS },
    ...TYPE_CARDS.map((c) => ({
      group: "type",
      slug: c.slug,
      title: c.title,
      viewport: "1200x" + (180 + c.specimens.length * 130),
      body: typeCard(c),
      css: TYPE_CSS,
      script: MEASURE_SCRIPT,
    })),
    ...(await componentCards()),
  ];

  rmSync(CARDS_CACHE, { recursive: true, force: true });
  const hash = createHash("sha256");
  /** @type {string[]} */
  const files = [];
  for (const card of cards) {
    const rel = `${card.group}/${card.slug}/${card.slug}.html`;
    const html = page({ ...card, group: GROUPS[/** @type {keyof typeof GROUPS} */ (card.group)] });
    if (!/^<!--\s*@dsCard\s+group="[^"]+"[^>]*-->$/.test(html.split("\n", 1)[0])) {
      throw new Error(`${rel}: first line is not a @dsCard marker`);
    }
    const abs = join(CARDS_CACHE, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, html);
    files.push(rel);
    hash.update(rel).update("\0").update(html);
  }
  return { files, digest: hash.digest("hex").slice(0, 12) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { files, digest } = await buildCards();
  console.error(`cards: ${files.length} written to ${CARDS_CACHE.slice(REPO.length + 1)}, digest ${digest}`);
  for (const f of files) console.error(`  ${f}`);
}
