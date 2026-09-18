/**
 * Derives the math stylesheet and its faces from the installed `katex` package.
 *
 *   npm run build:katex
 *
 * `import "katex/dist/katex.min.css"` is wrong twice over. FIRST, a CSS import from a component
 * lands in that ROUTE's stylesheet, and `/blog/:slug` is one route serving every post, most of
 * which carry no math; hard rule 4 asks for the bytes a reader downloads, so the sheet has to be
 * separately addressable and linked conditionally. SECOND, upstream declares each face three
 * times and Vite emits every referenced url, so importing it verbatim shipped three formats where
 * every supported browser reads woff2.
 *
 * UNDER `app/` AND NOT `public/`, because a file under `public/` is walked into the asset
 * manifest and indexed as media, and a webfont is not media.
 *
 * THE OUTPUT IS COMMITTED AND `check:content` BYTE-COMPARES IT, which makes a katex bump that
 * nobody regenerated a NAMED gate failure. The version is read from the installed package.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const KATEX_DIR = join(root, "node_modules", "katex", "dist");
export const KATEX_CSS_PATH = join("app", "styles", "katex.generated.css");
export const KATEX_FONT_DIR = join("app", "fonts", "katex");
/** The site's hand-written half, appended to the derived upstream CSS. */
export const KATEX_OVERRIDES_PATH = join("app", "styles", "katex-overrides.css");

/** Where the derived upstream CSS stops and this repo's own rules begin. */
export const OVERRIDES_MARKER = "/* ---- site overrides ---- */\n";

/** The installed version, read rather than restated. Rule 17. */
export function installedKatexVersion() {
  const pkg = JSON.parse(
    readFileSync(join(root, "node_modules", "katex", "package.json"), "utf8"),
  );
  return String(pkg.version);
}

/**
 * A `src:` list with everything but woff2 removed. ANCHORED on the format keyword rather than on
 * the extension, which appears inside the filename too, and hard rule 10 spends a paragraph on
 * the unanchored needle. A face declaring NO woff2 source is left ALONE and reported by the
 * caller: dropping every source it has would be a silent removal of the face.
 *
 * @param {string} src the contents of one `src:` declaration
 * @returns {string | null} the trimmed list, or null when there is no woff2
 */
export function woff2Only(src) {
  const entries = src
    .split(/,(?![^(]*\))/)
    .map((e) => e.trim())
    .filter(Boolean);
  const kept = entries.filter((e) => /format\(\s*["']?woff2["']?\s*\)/.test(e));
  return kept.length > 0 ? kept.join(",") : null;
}

/**
 * The stylesheet, with the legacy formats stripped and the font urls pointed at the copies this
 * script writes.
 *
 * @param {string} css the contents of katex.min.css
 * @returns {{ css: string, faces: string[], untrimmed: string[] }}
 */
export function trimStylesheet(css) {
  /** Every woff2 file the trimmed stylesheet still names. */
  const faces = new Set();
  /**
   * Faces that declared no woff2 source, so nothing could be trimmed.
   * @type {string[]}
   */
  const untrimmed = [];

  const out = css.replace(/@font-face\s*\{([^}]*)\}/g, (block, body) => {
    const src = body.match(/src\s*:\s*([^;}]+)/);
    if (!src) return block;
    const trimmed = woff2Only(src[1]);
    if (trimmed === null) {
      untrimmed.push(body.match(/font-family\s*:\s*([^;]+)/)?.[1]?.trim() ?? body.slice(0, 40));
      return block;
    }
    return block.replace(src[1], trimmed);
  });

  /*
   * The url rewrite runs over the WHOLE stylesheet after trimming, so a woff2 url surviving outside
   * an @font-face block is caught too, and every match is recorded, which is what makes the
   * copied-every-font assertion below a measurement rather than a hope.
   */
  const rewritten = out.replace(/url\(\s*["']?fonts\/([^"')]+\.woff2)["']?\s*\)/g, (_m, file) => {
    faces.add(file);
    return `url("../fonts/katex/${file}")`;
  });

  return { css: rewritten, faces: [...faces].sort(), untrimmed };
}

/**
 * The stylesheet exactly as it should be on disk, header included. Exported so `check:content`
 * can derive it and byte-compare without shelling out to this script.
 */
export function generateKatexCss() {
  const version = installedKatexVersion();
  const source = readFileSync(join(KATEX_DIR, "katex.min.css"), "utf8");
  const { css, faces, untrimmed } = trimStylesheet(source);

  if (untrimmed.length > 0) {
    throw new Error(
      `katex ${version} declares ${untrimmed.length} @font-face block(s) with no woff2 ` +
        `source (${untrimmed.join(", ")}). Trimming them would drop the face entirely, so ` +
        `this stops rather than shipping math that renders in a fallback font.`,
    );
  }
  if (faces.length === 0) {
    throw new Error(
      `the trimmed stylesheet references no woff2 font at all, which cannot be right for ` +
        `katex ${version}. The url rewrite matched nothing, so its needle is wrong.`,
    );
  }

  const header =
    `/* GENERATED by scripts/build-katex.mjs from katex ${version}. Do not edit.\n` +
    ` *\n` +
    ` * The upstream katex.min.css with the woff and truetype sources removed and\n` +
    ` * the font urls repointed at app/fonts/katex/. Grounds, including why this is\n` +
    ` * derived, committed, and not under public/, are in that script. Regenerate\n` +
    ` * with \`npm run build:katex\`; check:content byte-compares it against a fresh\n` +
    ` * derivation, so a katex bump that nobody regenerated is a named failure.\n` +
    ` *\n` +
    ` * Everything below the site-overrides marker at the end of this file is\n` +
    ` * app/styles/katex-overrides.css, which is hand written and is where a site\n` +
    ` * rule goes. The marker is not quoted here: a CSS comment ends at the first\n` +
    ` * close sequence, so reproducing it inside this one terminated the header\n` +
    ` * early and lightningcss refused the whole stylesheet (measured 2026-09-06).\n` +
    ` */\n`;

  /*
   * The overrides are APPENDED rather than left as a second link, so a math post costs one request,
   * and they are read from their own file so the hand-written rules have one editable home.
   */
  const overrides = readFileSync(join(root, KATEX_OVERRIDES_PATH), "utf8");

  return { css: `${header}${css}\n${OVERRIDES_MARKER}${overrides}`, faces, version };
}

/** sha256 of a buffer, for the copy report. @param {Buffer} buf */
const sha = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 12);

function main() {
  const { css, faces, version } = generateKatexCss();

  const fontDir = join(root, KATEX_FONT_DIR);
  /*
   * The font directory is REPLACED, not merged: a face removed upstream would otherwise stay on
   * disk forever, and the next reader could not tell whether it mattered.
   */
  rmSync(fontDir, { recursive: true, force: true });
  mkdirSync(fontDir, { recursive: true });

  let bytes = 0;
  for (const face of faces) {
    const buf = readFileSync(join(KATEX_DIR, "fonts", face));
    writeFileSync(join(fontDir, face), buf);
    bytes += buf.length;
  }

  writeFileSync(join(root, KATEX_CSS_PATH), css, "utf8");

  /*
   * BOTH DIRECTIONS: the loop above proves every named face was copied, this proves nothing else is
   * in the directory, and a one-directional copy is how a stale face survives a version bump.
   */
  const onDisk = readdirSync(fontDir).sort();
  const orphans = onDisk.filter((f) => !faces.includes(f));
  if (orphans.length > 0) {
    throw new Error(`copied faces the stylesheet does not name: ${orphans.join(", ")}`);
  }

  console.log(
    `build:katex ok. katex ${version}: ${KATEX_CSS_PATH} ${Buffer.byteLength(css)} bytes ` +
      `(sha ${sha(Buffer.from(css))}), ${faces.length} woff2 face(s) ${bytes} bytes into ` +
      `${KATEX_FONT_DIR}/.`,
  );
}

/*
 * `pathToFileURL`, not a hand-rolled comparison: on this host the two spellings differ in their
 * slashes, so the hand-rolled form is false forever and the build step exits 0 having written
 * nothing.
 */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(
      `build:katex failed. ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
