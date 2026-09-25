// Runs at BUILD time and ships as a committed artifact: the Worker has no repository, and its ASSETS
// binding can only fetch. The match is LITERAL, so a constructed path like `/diagrams/${id}.svg` is
// invisible; that is why the library says "no reference found" rather than "unused".

// `content/posts` is absent: post citations belong to the other tracker, and an asset must not claim both.
export const SOURCE_ROOTS = ["app", "workers"];

export const SOURCE_FILES = ["public/site.webmanifest", "content/features.json"];

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", ".css", ".json", ".webmanifest"];

// Checked first because `SOURCE_FILES` bypass the root rule. `assets.json` lists every asset path.
const SELF_REFERENTIAL = ["content/generated/assets.json"];

/**
 * @param {string} file repo-relative, forward slashes
 * @returns {boolean}
 */
export function isSourceFile(file) {
  if (SELF_REFERENTIAL.includes(file)) return false;
  if (SOURCE_FILES.includes(file)) return true;
  // Gitignored build product: counting it would make the committed artifact depend on whether
  // build:enhance has run on this machine.
  if (file.startsWith("app/enhance/dist/")) return false;
  const root = file.split("/")[0] ?? "";
  if (!SOURCE_ROOTS.includes(root)) return false;
  return SOURCE_EXTENSIONS.some((ext) => file.endsWith(ext));
}

/**
 * Prose about an asset is not a reference. A tokenizer, not a regex: stripping from `//` to end of line
 * would destroy every `https://` inside a string literal, which is where real references live.
 *
 * @param {string} text
 * @param {boolean} [cssOnly] true for `.css`, which has no line comments
 * @returns {string} the same length, with comment bytes blanked to spaces
 */
export function stripComments(text, cssOnly = false) {
  let out = "";
  let i = 0;
  /** @type {"code"|"line"|"block"|"'"|"\""|"`"} */
  let mode = "code";
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (mode === "code") {
      if (c === "/" && next === "*") { mode = "block"; out += "  "; i += 2; continue; }
      if (!cssOnly && c === "/" && next === "/") { mode = "line"; out += "  "; i += 2; continue; }
      if (!cssOnly && (c === "'" || c === '"' || c === "`")) { mode = c; out += c; i += 1; continue; }
      if (cssOnly && (c === "'" || c === '"')) { mode = c; out += c; i += 1; continue; }
      out += c; i += 1; continue;
    }
    if (mode === "line") {
      if (c === "\n") { mode = "code"; out += c; i += 1; continue; }
      // Blanked rather than deleted, so offsets stay comparable and lines cannot join.
      out += " "; i += 1; continue;
    }
    if (mode === "block") {
      if (c === "*" && next === "/") { mode = "code"; out += "  "; i += 2; continue; }
      out += c === "\n" ? c : " "; i += 1; continue;
    }
    if (c === "\\") { out += text.slice(i, i + 2); i += 2; continue; }
    if (c === mode) { mode = "code"; out += c; i += 1; continue; }
    out += c; i += 1;
  }
  return out;
}

/**
 * Both ends must be boundaries: `/dustin-edwards-logo.svg` is a prefix of `/dustin-edwards-logo-dark.svg`,
 * and `"public/site.webmanifest"` ends with `/site.webmanifest`.
 *
 * @param {string} text the file contents
 * @param {string[]} assetPaths every known asset path
 * @returns {string[]} the subset referenced, in the order given
 */
export function referencesIn(text, assetPaths) {
  return assetPaths.filter((asset) => {
    let from = 0;
    for (;;) {
      const at = text.indexOf(asset, from);
      if (at < 0) return false;
      const before = at === 0 ? undefined : text[at - 1];
      const after = text[at + asset.length];
      /** @param {string | undefined} ch */
      const bounded = (ch) => ch === undefined || !/[A-Za-z0-9._~/-]/.test(ch);
      if (bounded(before) && bounded(after)) return true;
      from = at + 1;
    }
  });
}

/**
 * Sorted, so the generated artifact does not churn with directory order and a gate can byte-compare it.
 *
 * @param {Array<{ file: string, assets: string[] }>} scanned
 * @returns {{ generated: number, refs: Record<string, string[]> }}
 */
export function foldRefs(scanned) {
  /** @type {Record<string, string[]>} */
  const refs = {};
  for (const { file, assets } of scanned) {
    for (const asset of assets) {
      if (!refs[asset]) refs[asset] = [];
      if (!refs[asset].includes(file)) refs[asset].push(file);
    }
  }
  /** @type {Record<string, string[]>} */
  const sorted = {};
  for (const asset of Object.keys(refs).sort()) sorted[asset] = (refs[asset] ?? []).slice().sort();
  return { generated: Object.keys(sorted).length, refs: sorted };
}
