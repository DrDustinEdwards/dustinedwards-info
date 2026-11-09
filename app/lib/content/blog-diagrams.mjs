// The three architecture posts keep their :::diagram mermaid in the markdown, because Carrel owns
// that source. Mermaid's drawing is a light/dark <img> pair, and an SVG loaded as an image cannot
// see the page's custom properties, so the pair cannot follow the theme. These keys are Prelum's
// hash of that mermaid. The renderer swaps the pair for one inline figure. A changed source hashes
// to a new key and the swap misses it: check:diagrams fails until the drawing here is updated.

import { escapeHtml } from "@dustinedwards/site-runtime/html";

import { ASSET_PREFIX } from "../media/classify.mjs";

/** @param {string} id */
function marker(id) {
  return (
    `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">` +
    `<path d="M0 0L10 5L0 10Z" fill="var(--diagram-arrow)"/></marker></defs>`
  );
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {"neutral" | "accent" | "success" | "warning" | "info"} tone
 */
function rect(x, y, w, h, tone) {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="var(--diagram-${tone})" ` +
    `stroke="var(--diagram-${tone}-line)" stroke-width="1.5"/>`
  );
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {"neutral" | "accent" | "success" | "warning" | "info"} tone
 * @param {string[]} lines
 * @param {number} [size]
 */
function node(x, y, w, h, tone, lines, size = 12) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const step = 16;
  const text = lines
    .map((line, i) => {
      const dy = (i - (lines.length - 1) / 2) * step;
      return label(cx, cy + dy, line, size, tone);
    })
    .join("");
  return rect(x, y, w, h, tone) + text;
}

/** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {string} id */
function arrow(x1, y1, x2, y2, id) {
  return (
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--diagram-arrow)" ` +
    `stroke-width="1.5" marker-end="url(#${id})"/>`
  );
}

/** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 */
function hairline(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--diagram-neutral-line)" stroke-width="1"/>`;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {string} text
 * @param {number} [size]
 * @param {"neutral" | "accent" | "success" | "warning" | "info"} [tone]
 */
function label(x, y, text, size = 11, tone = "neutral") {
  return (
    `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="var(--font-sans)" font-size="${size}" fill="var(--diagram-${tone}-ink)">${escapeHtml(text)}</text>`
  );
}

/**
 * Four callers, one door. The MCP server reaches the API and has no arrow of its own to the commit.
 * @returns {string}
 */
function policyDoor() {
  const id = "bd-803ab50b-arrow";
  return [
    marker(id),
    node(20, 8, 150, 40, "neutral", ["AI assistant"], 13),
    node(20, 68, 150, 52, "info", ["MCP server", "translation only"]),
    node(182, 80, 150, 40, "neutral", ["Script or CI job"], 13),
    node(344, 80, 150, 40, "neutral", ["Browser editor"], 13),
    node(506, 80, 150, 40, "neutral", ["Scheduled task"], 13),
    node(20, 148, 636, 52, "accent", ["HTTP API", "auth, authorization, limits"]),
    node(188, 228, 300, 52, "warning", ["Gates", "schema, style, first publish"]),
    node(198, 308, 280, 44, "success", ["One atomic git commit"], 13),
    node(70, 388, 180, 40, "neutral", ["D1 rows"], 13),
    node(400, 388, 230, 40, "neutral", ["Search and answer index"], 13),
    arrow(95, 48, 95, 68, id),
    arrow(95, 120, 95, 148, id),
    arrow(257, 120, 257, 148, id),
    arrow(419, 120, 419, 148, id),
    arrow(581, 120, 581, 148, id),
    arrow(338, 200, 338, 228, id),
    arrow(338, 280, 338, 308, id),
    arrow(300, 352, 160, 388, id),
    arrow(376, 352, 515, 388, id),
  ].join("");
}

/**
 * OAuth answers who is operating (401). The bearer request answers what operators may do (403).
 * @returns {string}
 */
function twoCredentials() {
  const id = "bd-e2394abb-arrow";
  return [
    marker(id),
    ...[95, 257, 419, 581].map((x) => hairline(x, 56, x, 456)),
    arrow(95, 80, 257, 80, id),
    label(176, 68, "call a tool"),
    arrow(257, 112, 95, 112, id),
    label(176, 100, "authorization challenge"),
    arrow(95, 144, 419, 144, id),
    label(338, 132, "OAuth walk"),
    arrow(419, 176, 95, 176, id),
    label(338, 164, "identity, owner only"),
    arrow(95, 208, 257, 208, id),
    label(176, 184, "call a tool,"),
    label(176, 196, "with identity"),
    node(182, 228, 150, 32, "info", ["verify per request"], 11),
    node(20, 272, 312, 32, "warning", ["who is operating? 401"], 12),
    arrow(257, 324, 581, 324, id),
    label(500, 304, "the request a script"),
    label(500, 316, "would make"),
    node(182, 344, 474, 32, "warning", ["what may operators do? 403"], 12),
    arrow(581, 408, 257, 408, id),
    label(500, 388, "200, or refusal"),
    label(500, 400, "+ policy name"),
    arrow(257, 440, 95, 440, id),
    label(176, 428, "verbatim"),
    node(20, 8, 150, 40, "neutral", ["AI client"], 13),
    node(182, 8, 150, 40, "info", ["MCP server"], 13),
    node(344, 8, 150, 40, "neutral", ["Identity provider"], 12),
    node(506, 8, 150, 40, "accent", ["Publish API"], 13),
  ].join("");
}

/**
 * One save. First publication is refused before anything is written. Every other save commits,
 * records the hash, syncs the rows, and only then answers.
 * @returns {string}
 */
function oneSave() {
  const id = "bd-b54765cf-arrow";
  return [
    marker(id),
    ...[95, 257, 419, 581].map((x) => hairline(x, 56, x, 196)),
    arrow(95, 76, 257, 76, id),
    label(176, 64, "save_post + token"),
    node(182, 96, 150, 32, "accent", ["authenticate, limit"], 11),
    arrow(257, 148, 419, 148, id),
    label(338, 136, "read committed file"),
    arrow(419, 180, 257, 180, id),
    label(338, 168, "first_published?"),
    rect(20, 214, 312, 196, "warning"),
    rect(348, 214, 312, 196, "success"),
    arrow(338, 198, 176, 222, id),
    arrow(338, 198, 504, 222, id),
    label(176, 242, "First publication", 13, "warning"),
    label(176, 266, "403 first-publish-requires-admin", 11, "warning"),
    label(176, 288, "nothing written", 12, "warning"),
    label(176, 310, "no commit, no row", 11, "warning"),
    label(504, 242, "Everything else", 13, "success"),
    label(504, 266, "field from file, not payload", 11, "success"),
    label(504, 288, "one commit: markdown", 12, "success"),
    label(504, 310, "sha", 12, "success"),
    label(504, 332, "sync rows", 12, "success"),
    label(504, 354, "200 + sha", 12, "success"),
    node(20, 8, 150, 40, "neutral", ["Agent"], 13),
    node(182, 8, 150, 40, "accent", ["Publish API"], 13),
    node(344, 8, 150, 40, "info", ["GitHub"], 13),
    node(506, 8, 150, 40, "neutral", ["D1"], 13),
  ].join("");
}

/**
 * @type {Record<string, { title: string, alt: string, width: number, height: number, body: string }>}
 */
export const BLOG_DIAGRAMS = {
  "803ab50b": {
    title: "Every kind of author enters through the same door",
    alt:
      "A flow diagram with four callers on the left: an AI assistant, a script or CI job, the browser editor, and a scheduled task. " +
      "The AI assistant goes first to an MCP server marked translation only, no policy. All four paths then converge on one box, the HTTP API, " +
      "which holds authentication, authorization and rate limiting. From there a single path runs through the gates, which check schema, style and " +
      "the first-publish policy, and on to one atomic git commit, which then fans out to the D1 rows and the search and answer indexes. " +
      "The MCP server has no arrow of its own to the gates or the commit.",
    width: 680,
    height: 440,
    body: policyDoor(),
  },
  e2394abb: {
    title: "Two credentials, two questions, two different failures",
    alt:
      "A sequence diagram with four participants: the AI client, the MCP server, the identity provider, and the publish API. " +
      "The client calls a tool and the MCP server answers with an authorization challenge. The client completes an OAuth walk at the identity provider, " +
      "which returns an identity restricted to the site owner, and calls the tool again carrying it. The MCP server verifies that identity on the request " +
      "rather than trusting a session, and a note across those two participants records that this leg answers who is operating and that its failure is a 401. " +
      "The MCP server then makes the same bearer-authenticated request a script would make to the publish API, and a second note across those two records " +
      "that this leg answers what operators may do and that its failure is a 403 naming the policy. The API answers either 200 or a refusal carrying its " +
      "policy name, and the MCP server passes it back verbatim.",
    width: 680,
    height: 468,
    body: twoCredentials(),
  },
  b54765cf: {
    title: "One save, and the single point where it can be refused",
    alt:
      "A sequence diagram with four participants: the agent, the publish API, GitHub, and the D1 database. " +
      "The agent sends a save request carrying a bearer token. The API authenticates it and applies its rate limit, then reads the post's existing " +
      "committed file from GitHub to learn whether that post has ever been published. The diagram then branches. On the first branch the post has " +
      "never been published and the save asks for draft false, so the API answers 403 with the code first-publish-requires-admin, and a note across " +
      "GitHub and the database records that nothing is written: no commit, no row. On the second branch the API overwrites the first-publication field " +
      "from the committed file rather than from the payload, lands one atomic commit carrying the markdown, receives the commit hash, writes the " +
      "database rows, and only then answers 200 with that hash.",
    width: 680,
    height: 424,
    body: oneSave(),
  },
};

export const BLOG_DIAGRAM_KEYS = new Set(Object.keys(BLOG_DIAGRAMS));

/** Light and dark filenames Prelum would have written. They are unused once the figure is inline. */
export function inlineAssetNames() {
  return [...BLOG_DIAGRAM_KEYS].flatMap((id) =>
    ["light", "dark"].map((theme) => `${ASSET_PREFIX}${id}-${theme}.svg`),
  );
}

/** Sizes passed to Prelum so it does not warn that these three drawings were never rendered to files. */
export function inlineDiagramSizes() {
  /** @type {Record<string, { width: number, height: number }>} */
  const sizes = {};
  for (const [id, diagram] of Object.entries(BLOG_DIAGRAMS)) {
    for (const theme of ["light", "dark"]) {
      sizes[`${ASSET_PREFIX}${id}-${theme}.svg`] = {
        width: diagram.width,
        height: diagram.height,
      };
    }
  }
  return sizes;
}

/**
 * @param {string} key
 * @param {string} caption already-rendered figcaption, or ""
 */
function figureFor(key, caption) {
  const diagram = BLOG_DIAGRAMS[key];
  if (!diagram) return "";
  const titleId = `bd-${key}-title`;
  const descId = `bd-${key}-desc`;
  return (
    `<figure class="blog-diagram" role="img" aria-labelledby="${titleId}" aria-describedby="${descId}">` +
    `<p class="diagram-title">${escapeHtml(diagram.title)}</p>` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${diagram.width} ${diagram.height}" ` +
    `width="${diagram.width}" height="${diagram.height}" preserveAspectRatio="xMidYMid meet">` +
    `<title id="${titleId}">${escapeHtml(diagram.title)}</title>` +
    `<desc id="${descId}">${escapeHtml(diagram.alt)}</desc>` +
    diagram.body +
    `</svg>${caption}</figure>`
  );
}

const FIGURE = /<figure\b[^>]*\bclass="diagram-figure"[^>]*>[\s\S]*?<\/figure>/g;

/**
 * Replace a known mermaid pair with its inline figure. Any other diagram is left as Prelum wrote it.
 *
 * @param {string} html
 */
export function inlineBlogDiagrams(html) {
  return html.replace(FIGURE, (figure) => {
    const key = new RegExp(`/diagrams/${ASSET_PREFIX}([0-9a-f]{8})-light\\.svg`).exec(figure)?.[1];
    if (!key || !BLOG_DIAGRAM_KEYS.has(key)) return figure;
    const caption = /<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/.exec(figure)?.[0] ?? "";
    return figureFor(key, caption);
  });
}

/**
 * The inlined drawings are not files, so a media citation of the old asset would point at nothing.
 * Generic so the citation's other fields survive the filter.
 *
 * @template {{ key?: string }} T
 * @param {T[]} refs
 * @returns {T[]}
 */
export function withoutInlinedDiagramRefs(refs) {
  return refs.filter((ref) => {
    const key = typeof ref?.key === "string" ? ref.key : "";
    return ![...BLOG_DIAGRAM_KEYS].some((id) => key.includes(`${ASSET_PREFIX}${id}-`));
  });
}
