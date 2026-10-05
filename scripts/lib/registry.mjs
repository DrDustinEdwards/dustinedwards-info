// Every registry file compiled the one way the Carrel adapter's registry save compiles it
// (app/lib/registry/compile.mjs), for build:content, sync:content, the gates and the tests.

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findWideDashes } from "../../app/lib/content/pipeline.mjs";
import { REGISTRY_DIR, compileRegistryItem, registrySetErrors, registrySlug, sortRegistry } from "../../app/lib/registry/compile.mjs";
import { KINDS } from "../../app/lib/registry/kinds.mjs";
import { storedPrimer } from "../../app/lib/registry/primer.mjs";
import { storedReagent } from "../../app/lib/registry/reagent.mjs";
import { storedStrain } from "../../app/lib/registry/strain.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
/** The D1 rows sync:content writes. */
export const REGISTRY_ARTIFACT_PATH = path.join("content", "generated", "registry.json");

/** The repository's papers, read from content/publications as a clone has them. */
export const repoHost = {
  /** @param {string} slug a publication's file key */
  async paper(slug) {
    const info = await stat(path.join(ROOT, "content", "publications", `${slug}.md`)).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    return info !== null && info.isFile();
  },
};

/**
 * The names in a directory, or none when it does not exist: a kind is defined before its first file is written, and
 * the registry has no directory at all until then.
 *
 * @param {string} dir
 */
async function namesIn(dir) {
  try {
    return await readdir(dir);
  } catch (error) {
    if (/** @type {any} */ (error)?.code === "ENOENT") return [];
    throw error;
  }
}

/**
 * Compiles every file in content/registry/<kind>/ for every kind. A file that does not compile is returned with its
 * errors, never skipped: the caller decides what that means. A directory that is not a kind is an error too, so a
 * misspelt kind cannot hide its files.
 *
 * @param {{ host?: import("../../app/lib/registry/kinds.mjs").RegistryHost, kinds?: Readonly<Record<string, import("../../app/lib/registry/kinds.mjs").KindSpec>>, root?: string }} [options]
 */
export async function compileAllRegistry(options = {}) {
  const host = options.host ?? repoHost;
  const kinds = options.kinds ?? KINDS;
  const root = options.root ?? ROOT;
  const compiled = [];
  /** @type {string[]} */
  const strays = [];
  const dirs = (await namesIn(path.join(root, REGISTRY_DIR))).sort();
  for (const dir of dirs) {
    if (!Object.hasOwn(kinds, dir)) strays.push(`${REGISTRY_DIR}/${dir}`);
  }
  for (const kind of Object.keys(kinds)) {
    const names = (await namesIn(path.join(root, REGISTRY_DIR, kind))).filter((n) => n.endsWith(".md")).sort();
    for (const name of names) {
      const slug = registrySlug(kind, name.slice(0, -3));
      const raw = await readFile(path.join(root, REGISTRY_DIR, kind, name), "utf8");
      compiled.push({
        file: `${REGISTRY_DIR}/${kind}/${name}`,
        slug,
        raw,
        compiled: await compileRegistryItem({ slug, raw, host, pipeline: { findWideDashes }, kinds }),
      });
    }
  }
  return { compiled, strays };
}

/**
 * The D1 rows sync:content writes. Throws on the first file that does not compile: a build never ships an item CI
 * would refuse. An empty registry is valid and yields no rows.
 *
 * @param {Parameters<typeof compileAllRegistry>[0]} [options]
 */
export async function buildRegistry(options = {}) {
  const kinds = options?.kinds ?? KINDS;
  const { compiled, strays } = await compileAllRegistry(options);
  if (strays.length > 0) {
    throw new Error(`${strays.join(", ")} is not a registry kind directory; the kinds are ${Object.keys(kinds).join(", ") || "none yet"}`);
  }
  const failed = compiled.filter((c) => !c.compiled.ok);
  if (failed.length > 0) {
    throw new Error(failed.map((c) => `${c.file} does not compile:\n  ${c.compiled.errors.join("\n  ")}`).join("\n"));
  }
  const ok = compiled.flatMap((c) => (c.compiled.ok ? [c.compiled] : []));
  const setErrors = registrySetErrors(ok.map((c) => c.item), kinds);
  if (setErrors.length > 0) throw new Error(`${REGISTRY_DIR} is not a registry:\n  ${setErrors.join("\n  ")}`);
  const items = sortRegistry(ok.map((c) => c.item), kinds);
  const rows = ok.map((c) => ({
    kind: c.item.kind,
    id: c.item.id,
    name: c.item.name,
    status: c.item.status,
    record: c.record,
    sourcePath: c.sourcePath,
    sourceBlobSha: c.sourceBlobSha,
  }));
  return { rows, items, gaps: ok.flatMap((c) => c.gaps.map((g) => ({ slug: registrySlug(c.item.kind, c.item.id), ...g }))) };
}

/**
 * The lab registry as the procedure compile reads it from a clone (docs/REGISTRY.md): the primers a protocol names, as the
 * stated facts the protocol's record carries. Built once from the same compile the registry save runs, so a primer CI
 * refuses cannot be printed by a protocol; an id the registry does not hold is left out, and the validator names it.
 *
 * @param {Parameters<typeof buildRegistry>[0]} [options]
 */
export function registryHost(options) {
  /** @type {Promise<Map<string, import("../../app/lib/procedures/render.mjs").StoredPrimer>> | undefined} */
  let primers;
  /** @type {Promise<Map<string, import("../../app/lib/procedures/render.mjs").StoredStrain>> | undefined} */
  let strains;
  /** @type {Promise<Map<string, import("../../app/lib/procedures/render.mjs").StoredReagent>> | undefined} */
  let reagents;
  return {
    /** @param {string[]} ids */
    async primers(ids) {
      primers ??= buildRegistry(options).then(({ items }) => new Map(items.filter((item) => item.kind === "primer").map((item) => [item.id, storedPrimer(item)])));
      const all = await primers;
      return new Map(ids.flatMap((id) => (all.has(id) ? [[id, /** @type {any} */ (all.get(id))]] : [])));
    },
    /** @param {string[]} ids */
    async reagents(ids) {
      reagents ??= buildRegistry(options).then(({ items }) => new Map(items.filter((item) => item.kind === "reagent").map((item) => [item.id, storedReagent(item)])));
      const all = await reagents;
      return new Map(ids.flatMap((id) => (all.has(id) ? [[id, /** @type {any} */ (all.get(id))]] : [])));
    },
    /** @param {string[]} ids */
    async strains(ids) {
      strains ??= buildRegistry(options).then(({ items }) => new Map(items.filter((item) => item.kind === "strain").map((item) => [item.id, storedStrain(item)])));
      const all = await strains;
      return new Map(ids.flatMap((id) => (all.has(id) ? [[id, /** @type {any} */ (all.get(id))]] : [])));
    },
  };
}
