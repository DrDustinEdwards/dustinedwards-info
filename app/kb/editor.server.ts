// The admin's Knowledge Base editor (docs/KNOWLEDGE-BASE.md, step 3): one file at a time, an entry (a procedure) or a
// lab registry item, read from the repository as it stands and saved back through the save the operator API and Carrel
// already use (saveProcedure, saveRegistryItem). It adds no write path and no second validator: Check runs the save's
// own checks and commits nothing, and Save is that save, refused when the file changed since it was opened.

import matter from "gray-matter";

import { ContentInvalid } from "~/lib/carrel/errors.server";
import { GitHubError, readFile } from "~/lib/editor/github.server";
import { PolicyError, type Actor } from "~/lib/editor/publish-policy.mjs";

import { NEEDS_INFO, tabHref } from "./admin.mjs";
import { BASES } from "./bases.mjs";
import { procedurePath } from "./procedures/parse.mjs";
import { compile as compileProcedure, saveProcedure } from "./procedures/save.server";
import { hasItemPage, itemPath, kindPath } from "./registry/catalog.mjs";
import { registryPath } from "./registry/compile.mjs";
import { KINDS } from "./registry/kinds.mjs";
import { checkRegistryItem, saveRegistryItem } from "./registry/save.server";

type EditorEnv = Env & { GITHUB_TOKEN?: string };

/** What is being edited: an entry by its slug, or a registry item by its kind and id. */
export type KbTarget = { type: "entry"; slug: string } | { type: "item"; kind: string; id: string };

export type KbGap = { field: string; reason: string };

/** The file as the editor opens it, with what the save's checks say of it now. */
export type KbFile = {
  target: KbTarget;
  /** The repository path, shown so the reader knows which file this is. */
  file: string;
  /** The entry's title or the item's name, else its address. */
  title: string;
  /** Which list it belongs to: a base's name, or the registry kind's plural. */
  group: string;
  /** The admin list it is reached from: its base's tab, or Needs info for a registry item (Inventory waits with step 4). */
  listHref: string;
  /** Where its public page or table is, when it has one. */
  publicHref: string | null;
  raw: string;
  /** The git blob sha it was read at: Save is refused if the file has moved on since. */
  sha: string;
  errors: string[];
  gaps: KbGap[];
};

export type CheckResult = { ok: boolean; errors: string[]; gaps: KbGap[] };

export type SaveResult =
  | { outcome: "saved"; commitSha: string; unchanged: boolean }
  | { outcome: "refused"; errors: string[] }
  | { outcome: "conflict"; message: string };

const slugOf = (target: Extract<KbTarget, { type: "item" }>) => `${target.kind}/${target.id}`;

/** The repository path a target names, or null when it names nothing the Knowledge Base holds. */
export function targetFile(target: KbTarget): string | null {
  if (target.type === "entry") return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target.slug) ? procedurePath(target.slug) : null;
  return KINDS[target.kind] && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target.id) ? registryPath(slugOf(target)) : null;
}

/** What Save's checks say of `raw`, without committing anything. */
export async function checkFile(env: EditorEnv, target: KbTarget, raw: string): Promise<CheckResult> {
  if (target.type === "entry") {
    const compiled = await compileProcedure(env, target.slug, raw);
    return { ok: compiled.ok, errors: compiled.ok ? [] : compiled.errors, gaps: compiled.gaps ?? [] };
  }
  const compiled = await checkRegistryItem(env, slugOf(target), raw);
  return { ok: compiled.ok, errors: compiled.ok ? [] : compiled.errors, gaps: compiled.ok ? compiled.gaps : [] };
}

/** The file from the repository and its checks, or null when there is no such file. */
export async function loadFile(env: EditorEnv, target: KbTarget): Promise<KbFile | null> {
  const file = targetFile(target);
  if (!file) return null;
  const read = await readFile(env, file);
  if (!read) return null;
  const checked = await checkFile(env, target, read.content);
  // The front matter as written, for the heading only: a file that fails its checks still opens, with its errors.
  let data: Record<string, unknown> = {};
  try {
    data = matter(read.content, {}).data;
  } catch {
    data = {};
  }
  const text = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value : null);

  if (target.type === "entry") {
    const base = BASES.find((b) => b.profile === data.profile);
    return {
      target,
      file,
      title: text(data.title) ?? target.slug,
      group: base?.name ?? "Entries",
      listHref: tabHref(base?.id ?? NEEDS_INFO),
      publicHref: text(data.path),
      raw: read.content,
      sha: read.sha,
      ...checked,
    };
  }
  const spec = KINDS[target.kind];
  return {
    target,
    file,
    title: text(data.name) ?? slugOf(target),
    group: spec ? spec.plural.charAt(0).toUpperCase() + spec.plural.slice(1) : target.kind,
    listHref: tabHref(NEEDS_INFO),
    publicHref: hasItemPage(target.kind) ? itemPath(target.kind, target.id) : kindPath(target.kind),
    raw: read.content,
    sha: read.sha,
    ...checked,
  };
}

/** Save through the one save for the target's kind, refused if the file moved since `expectedBlobSha` was read. */
export async function saveFile(env: EditorEnv, target: KbTarget, raw: string, expectedBlobSha: string, actor: Actor): Promise<SaveResult> {
  try {
    const saved =
      target.type === "entry"
        ? await saveProcedure(env, { slug: target.slug, raw, expectedBlobSha, isNew: false, actor })
        : await saveRegistryItem(env, { slug: slugOf(target), raw, expectedBlobSha, isNew: false, actor });
    return { outcome: "saved", commitSha: saved.commitSha, unchanged: saved.unchanged };
  } catch (error) {
    if (error instanceof ContentInvalid) return { outcome: "refused", errors: error.errors };
    if (error instanceof PolicyError) return { outcome: "refused", errors: [error.message] };
    if (error instanceof GitHubError && error.conflict) return { outcome: "conflict", message: error.message };
    throw error;
  }
}
