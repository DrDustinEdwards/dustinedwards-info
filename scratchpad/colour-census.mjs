/*
 * An independent census of the colour system, for the second-reader audit.
 *
 *   node colour-census.mjs <repo> > census.json
 *
 * It does not read the other audit. Every number here comes from the files.
 *
 * WHAT COUNTS AS A CONSUMER, stated before anything is counted, because this is the whole
 * measurement: a declaration whose PROPERTY paints and whose VALUE reads the token. A custom
 * property assignment (`--a: var(--b)`) is an ALIAS and is counted separately, because a token
 * that is only ever assigned into another name paints nothing by itself. Comments are stripped
 * first: a token named in a comment is a mention, not a consumer (hard rule 10's tenth class).
 * Gate files are not read at all; a file whose name says it checks is asserting about a token
 * rather than painting with it (ruling 104).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repo = process.argv[2];

const PAINT = [
  "color", "background", "background-color", "background-image", "border", "border-color",
  "border-top", "border-right", "border-bottom", "border-left", "border-top-color",
  "border-right-color", "border-bottom-color", "border-left-color", "border-block",
  "border-block-start", "border-block-end", "border-inline", "border-inline-start",
  "border-inline-end", "border-block-color", "border-inline-color", "border-block-start-color",
  "border-block-end-color", "border-inline-start-color", "border-inline-end-color",
  "outline", "outline-color", "fill", "stroke", "box-shadow", "text-shadow", "text-decoration",
  "text-decoration-color", "caret-color", "accent-color", "column-rule", "column-rule-color",
  "text-emphasis-color", "-webkit-text-fill-color", "stop-color", "flood-color", "lighting-color",
  "scrollbar-color", "border-image", "mask-image", "filter", "backdrop-filter",
];
const PAINT_SET = new Set(PAINT);

const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      walk(p, out);
    } else out.push(p);
  }
  return out;
}

/* app/ and workers/ only: the pages and the Worker. scripts/ is gates and build steps. */
const files = [...walk(join(repo, "app")), ...walk(join(repo, "workers"))].filter((f) =>
  /\.(css|ts|tsx|mjs|js)$/.test(f),
);

/** @type {Record<string, {paint: number, files: Set<string>, alias: number, paintIn: Record<string, number>}>} */
const use = {};
const bump = (token, kind, file) => {
  use[token] ??= { paint: 0, files: new Set(), alias: 0, paintIn: {} };
  if (kind === "paint") {
    use[token].paint += 1;
    use[token].files.add(file);
    const f = relative(repo, file).replace(/\\/g, "/");
    use[token].paintIn[f] = (use[token].paintIn[f] ?? 0) + 1;
  } else use[token].alias += 1;
};

for (const file of files) {
  const text = strip(readFileSync(file, "utf8"));
  /* Declarations: a property, a colon, a value that ends at ; } or newline-brace. */
  for (const m of text.matchAll(/(^|[\s;{])(-{0,2}[a-zA-Z][a-zA-Z0-9-]*)\s*:\s*([^;{}]*)/g)) {
    const prop = m[2];
    const value = m[3];
    const tokens = [...value.matchAll(/var\(\s*(--[a-z][a-z0-9-]*)/g)].map((v) => v[1]);
    if (tokens.length === 0) continue;
    const kind = prop.startsWith("--") ? "alias" : PAINT_SET.has(prop) ? "paint" : null;
    if (!kind) continue;
    for (const t of tokens) bump(t, kind, file);
  }
  /* A JS/TS string that names a token is a paint only in the files that emit style attributes. */
  if (/\.(ts|tsx|mjs|js)$/.test(file)) {
    for (const m of text.matchAll(/["'`](--[a-z][a-z0-9-]*)["'`]/g)) bump(m[1], "paint", file);
    for (const m of text.matchAll(/var\(\s*(--[a-z][a-z0-9-]*)/g)) bump(m[1], "paint", file);
  }
}

/* The palette: every custom property declared in app.css with a colour-ish value, and the same
   from the sheets. First declaration wins, which is how check:contrast reads it. */
const appCss = strip(readFileSync(join(repo, "app/app.css"), "utf8"));
/** @type {Record<string, {light?: string, dark?: string}>} */
const palette = {};
const LITERAL = (v) =>
  /^#[0-9a-f]{3,8}$/i.test(v.trim()) || /^(rgb|hsl|oklch|oklab|color-mix|color)\(/i.test(v.trim());
/* A token that points at another token is a colour only if THAT one is, so the type scale, which
   is full of var(--font-sans), does not enter the palette. Resolved in a second pass below. */
const POINTER = (v) => (v.trim().match(/^var\(\s*(--[a-z][a-z0-9-]*)\s*\)$/) ?? [])[1] ?? null;
const isColour = (v) => LITERAL(v) || POINTER(v) !== null;

/* Three blocks, in the order check:contrast reads them. */
const blocks = [];
for (const m of appCss.matchAll(/(:root[^{]*|\[data-theme="(?:light|dark)"\][^{]*|@media \(prefers-color-scheme: dark\)[^{]*)\{/g)) {
  blocks.push({ sel: m[1].trim(), start: m.index + m[0].length });
}
for (const b of blocks) {
  const chunk = appCss.slice(b.start, b.start + 6000);
  const dark = /dark/.test(b.sel);
  for (const d of chunk.matchAll(/(--[a-z][a-z0-9-]*)\s*:\s*([^;]+);/g)) {
    const [, name, raw] = d;
    if (!isColour(raw)) continue;
    palette[name] ??= {};
    if (dark) palette[name].dark ??= raw.trim();
    else palette[name].light ??= raw.trim();
  }
}

/* Keep a token only if it resolves to a literal colour, directly or through pointers. */
const literalNames = new Set(
  Object.entries(palette).filter(([, v]) => LITERAL(v.light ?? v.dark ?? "")).map(([k]) => k),
);
for (let pass = 0; pass < 6; pass += 1) {
  for (const [name, v] of Object.entries(palette)) {
    if (literalNames.has(name)) continue;
    const target = POINTER(v.light ?? v.dark ?? "");
    if (target && literalNames.has(target)) literalNames.add(name);
  }
}
for (const name of Object.keys(palette)) if (!literalNames.has(name)) delete palette[name];

const rows = Object.entries(palette)
  .map(([name, v]) => ({
    token: name,
    light: v.light ?? null,
    dark: v.dark ?? null,
    paint: use[name]?.paint ?? 0,
    files: use[name]?.files.size ?? 0,
    alias: use[name]?.alias ?? 0,
    where: Object.entries(use[name]?.paintIn ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4),
  }))
  .sort((a, b) => b.paint - a.paint);

const zero = rows.filter((r) => r.paint === 0);
const dupes = [];
for (let i = 0; i < rows.length; i += 1)
  for (let j = i + 1; j < rows.length; j += 1)
    if (rows[i].light && rows[i].light === rows[j].light && rows[i].dark === rows[j].dark)
      dupes.push([rows[i].token, rows[j].token, rows[i].light, rows[i].dark]);

console.log(
  JSON.stringify(
    {
      filesRead: files.length,
      declared: rows.length,
      zeroConsumers: zero.length,
      zeroList: zero.map((r) => r.token),
      exactDuplicates: dupes,
      rows,
    },
    null,
    1,
  ),
);
