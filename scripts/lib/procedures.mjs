// Every procedure file compiled the one way the operator API's save_procedure compiles it
// (app/lib/procedures/compile.mjs), for build:content, sync:content and check:protocols.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { imageSize } from "image-size";

import * as pipeline from "../../app/lib/content/pipeline.mjs";
import { compileProcedure } from "../../app/lib/procedures/compile.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PROCEDURES_SOURCE_DIR = path.join("content", "procedures");
/** The recipe and computational fixtures: validated and tested, never synced or published. */
export const PROCEDURE_FIXTURES_DIR = path.join("test", "fixtures", "procedures");
export const PROCEDURES_ARTIFACT_PATH = path.join("content", "generated", "procedures.json");

/**
 * A step photo's size, read from the repository's public/ copy as a post's images are. A recipe fixture
 * names a photo that is not in the repository; it is measured as absent rather than failing its test.
 *
 * @param {string} src
 */
async function resolveImage(src) {
  const bytes = await readFile(path.join(ROOT, "public", src)).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (!bytes) throw new Error(`the image ${src} is not in the repository at public${src}`);
  const size = imageSize(bytes);
  if (!size.width || !size.height) throw new Error(`the image ${src} has no readable dimensions`);
  return { width: size.width, height: size.height };
}

/**
 * @param {string} dir repository-relative
 * @param {{ measureImages?: boolean }} [options]
 */
export async function compileDirectory(dir, options = {}) {
  const names = (await readdir(path.join(ROOT, dir))).filter((n) => n.endsWith(".md")).sort();
  const out = [];
  for (const name of names) {
    const slug = name.slice(0, -3);
    const raw = await readFile(path.join(ROOT, dir, name), "utf8");
    const compiled = await compileProcedure({
      slug,
      raw,
      pipeline,
      resolveImage: options.measureImages === false ? undefined : resolveImage,
    });
    out.push({ file: path.join(dir, name).replaceAll("\\", "/"), slug, compiled });
  }
  return out;
}

/**
 * The published procedures' rows, as sync:content writes them, and their search inputs. Throws on the
 * first file that does not compile: a build never ships a procedure CI would refuse.
 */
export async function buildProcedures() {
  const compiled = await compileDirectory(PROCEDURES_SOURCE_DIR);
  const rows = [];
  const searchInputs = [];
  const paths = new Set();
  for (const { file, slug, compiled: c } of compiled) {
    if (!c.ok) throw new Error(`${file} does not compile:\n  ${c.errors.join("\n  ")}`);
    if (paths.has(c.record.path)) throw new Error(`${file}: two procedures claim ${c.record.path}`);
    paths.add(c.record.path);
    rows.push({
      slug,
      path: c.record.path,
      profile: c.record.profile,
      title: c.record.title,
      description: c.record.description,
      status: c.record.draft ? "draft" : "published",
      version: c.record.version,
      updated: c.record.updated,
      record: JSON.stringify(c.record),
      markdown: c.markdown,
      sourcePath: c.sourcePath,
      sourceBlobSha: c.sourceBlobSha,
    });
    if (!c.record.draft) {
      const { markdown: _twin, ...input } = c.searchInput;
      searchInputs.push(input);
    }
  }
  return { rows, searchInputs };
}
