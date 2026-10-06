// What the Worker reads from the repository for the registry, which is what CI reads too: a field that names a paper means
// a paper this site has a file for, and a protocol that names a primer means a primer the registry holds a file for. Asking
// the repository rather than D1 keeps a save and a sync independent of whether the derived rows have been written yet.
// A module of its own so the procedure save can read primers without importing the registry save, which imports it.

import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { readFile } from "~/lib/editor/github.server";
import { procedurePath } from "~/lib/procedures/parse.mjs";
import { PUBLICATIONS_DIR } from "~/lib/publications/parse.mjs";
import type { StoredPrimer, StoredReagent, StoredStrain } from "~/lib/procedures/render.mjs";

import { compileRegistryItem, registryPath, registrySlug } from "./compile.mjs";
import { KINDS, type KindSpec } from "./kinds.mjs";
import { storedPrimer } from "./primer.mjs";
import { storedReagent } from "./reagent.mjs";
import { storedStrain } from "./strain.mjs";

type RegistryEnv = Env & { GITHUB_TOKEN?: string };

export function githubHost(env: RegistryEnv) {
  return {
    paper: async (slug: string) => (await readFile(env, `${PUBLICATIONS_DIR}/${slug}.md`)) !== null,
    // A recipe is a procedure file whose front matter says profile: recipe.
    recipe: async (slug: string) => /^profile:\s*recipe\s*$/m.test(((await readFile(env, procedurePath(slug)))?.content ?? "").split(/^---\s*$/m)[1] ?? ""),
  };
}

/** The one compile door for a registry file: the save, get_registry, sync_registry and the primer reads go through it. */
export async function compile(env: RegistryEnv, slug: string, raw: string, kinds: Readonly<Record<string, KindSpec>> = KINDS) {
  const { findWideDashes } = await loadPipeline();
  return compileRegistryItem({ slug, raw, host: githubHost(env), pipeline: { findWideDashes }, kinds });
}

/**
 * The primers a protocol names, as the repository holds them, for the procedure compile. An id with no file, or a file that
 * does not compile, is left out of the answer, so the validator reports it as a primer the registry does not hold.
 */
export async function readPrimers(env: RegistryEnv, ids: string[]): Promise<Map<string, StoredPrimer>> {
  const found = new Map<string, StoredPrimer>();
  for (const id of ids) {
    const slug = registrySlug("primer", id);
    const file = await readFile(env, registryPath(slug));
    if (!file) continue;
    const compiled = await compile(env, slug, file.content);
    if (compiled.ok) found.set(id, storedPrimer(compiled.item));
  }
  return found;
}

/** The host strains a protocol names, as the repository holds them; an id with no compiling file is left out, and the validator names it. */
export async function readStrains(env: RegistryEnv, ids: string[]): Promise<Map<string, StoredStrain>> {
  const found = new Map<string, StoredStrain>();
  for (const id of ids) {
    const slug = registrySlug("strain", id);
    const file = await readFile(env, registryPath(slug));
    if (!file) continue;
    const compiled = await compile(env, slug, file.content);
    if (compiled.ok) found.set(id, storedStrain(compiled.item));
  }
  return found;
}

/** The reagents a protocol's materials name, as the repository holds them; an id with no compiling file is left out, and the validator names it. */
export async function readReagents(env: RegistryEnv, ids: string[]): Promise<Map<string, StoredReagent>> {
  const found = new Map<string, StoredReagent>();
  for (const id of ids) {
    const slug = registrySlug("reagent", id);
    const file = await readFile(env, registryPath(slug));
    if (!file) continue;
    const compiled = await compile(env, slug, file.content);
    if (compiled.ok) found.set(id, storedReagent(compiled.item));
  }
  return found;
}
