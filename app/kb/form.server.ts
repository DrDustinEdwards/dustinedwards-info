// The Knowledge Base form editor's server half (docs/KNOWLEDGE-BASE.md): the form a file opens as, with the lists its
// pickers choose from; the file a submitted form describes, which then goes through the same Check and Save as the raw
// editor (editor.server.ts); and Duplicate, a new draft copied from an entry that records where it came from.

import matter from "gray-matter";

import { listRegistry } from "~/db/registry";
import type { Actor } from "~/lib/editor/publish-policy.mjs";
import { TOOLS } from "~/lib/phage-tools.mjs";

import { BASES } from "./bases.mjs";
import type { KbFile } from "./editor.server";
import { entryFields, gapReason, itemFields, type FieldSpec } from "./form-fields.mjs";
import { fileToForm, formToFile, STEP_FLAGS, type FormModel } from "./form.mjs";
import { compile as compileProcedure, saveProcedure } from "./procedures/save.server";
import { KINDS } from "./registry/kinds.mjs";


type FormEnv = Env & { GITHUB_TOKEN?: string };

export type Choice = { value: string; label: string };

/** A field as the page draws it: its spec, and for a YAML field the text it opens with. */
export type FormField = FieldSpec & { yaml?: string; gap?: string | null };

export type KbForm = {
  model: FormModel;
  fields: FormField[];
  /** The registry's items, by kind, for the pickers. */
  registry: Record<"reagent" | "equipment" | "primer" | "strain", Choice[]>;
  flags: readonly string[];
  /** What a step note or a reagent can point at, by name: the troubleshooting table's rows, the calculators, the solutions. */
  references: Record<"troubleshooting" | "calculators" | "solutions", Choice[]>;
};

/** A value as YAML text, for a field the form edits as YAML. */
function yamlText(value: unknown): string {
  if (value === undefined || value === null) return "";
  return matter
    .stringify("", { v: value })
    .replace(/^---\n/, "")
    .replace(/\n---\n*$/, "")
    .replace(/^v:\s?/, "")
    .replace(/^ {2}/gm, "")
    .trim();
}

/** YAML text back into a value; the text is what a person typed, so a mistake is said, not thrown. */
function readYaml(key: string, text: string): { value: unknown } | { error: string } {
  if (text.trim() === "") return { value: undefined };
  try {
    const indented = text.split("\n").map((line) => `  ${line}`).join("\n");
    return { value: (matter(`---\nv:\n${indented}\n---\n`).data as { v: unknown }).v };
  } catch (error) {
    return { error: `${key} is not valid YAML: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}` };
  }
}

/** The form a file opens as. */
export async function formFor(env: FormEnv, file: KbFile): Promise<KbForm> {
  const items = await listRegistry(env);
  const of = (kind: string) => items.filter((i) => i.kind === kind).map((i) => ({ value: i.id, label: i.status === "draft" ? `${i.name} (draft)` : i.name }));
  const registry = { reagent: of("reagent"), equipment: of("equipment"), primer: of("primer"), strain: of("strain") };
  const model = fileToForm(file.raw, { body: file.target.type === "entry" });
  const specs =
    file.target.type === "entry"
      ? entryFields(String(model.data.profile ?? "protocol"), model.data, registry.strain)
      : itemFields(Object.keys(KINDS[file.target.kind]?.fields ?? {}), model.data);
  const fields = specs.map((spec) => ({
    ...spec,
    gap: gapReason(model.data[spec.key]),
    // A gap opens empty, its reason beside it, like any other input; left empty, it keeps the gap (rawFromForm).
    ...(spec.kind === "yaml" || spec.kind === "readonly" ? { yaml: gapReason(model.data[spec.key]) ? "" : yamlText(model.data[spec.key]) } : {}),
  }));
  return { model, fields, registry, flags: STEP_FLAGS, references: referencesOf(model.data) };
}

/** The rows of a list field that have an id. */
function rowsOf(rows: unknown): Array<Record<string, unknown>> {
  return Array.isArray(rows) ? rows.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object" && typeof (r as { id?: unknown }).id === "string") : [];
}

/** What a step note or a reagent row can name, each by its words: a row's step and problem, a calculator's title, a solution's name. */
export function referencesOf(data: Record<string, unknown>): KbForm["references"] {
  return {
    troubleshooting: rowsOf(data.troubleshooting).map((row) => ({ value: String(row.id), label: `Step ${String(row.step ?? "?")}: ${String(row.problem ?? row.id)}` })),
    calculators: Object.entries(TOOLS).map(([value, tool]) => ({ value, label: tool.title })),
    solutions: rowsOf(data.solutions).map((row) => ({ value: String(row.id), label: String(row.name ?? row.id) })),
  };
}

/**
 * The file a submitted form describes, written over the file it was opened from. A field the form sent as YAML text
 * ({ "$yaml": text }) is read here; text that is not YAML is a refusal with its reason, and nothing is written.
 */
export function rawFromForm(original: string, posted: string): { raw: string } | { errors: string[] } {
  let model: FormModel;
  try {
    model = JSON.parse(posted) as FormModel;
  } catch {
    return { errors: ["The form could not be read. Reload the page and make the edit again."] };
  }
  const errors: string[] = [];
  const data: Record<string, unknown> = {};
  let before: Record<string, unknown> | null = null;
  for (const [key, value] of Object.entries(model.data ?? {})) {
    if (value && typeof value === "object" && !Array.isArray(value) && "$yaml" in value) {
      const read = readYaml(key, String((value as { $yaml: unknown }).$yaml ?? ""));
      before ??= fileToForm(original, { body: false }).data;
      if ("error" in read) errors.push(read.error);
      // Left empty, a field that held a gap keeps it: an empty box is not an answer.
      else data[key] = read.value === undefined && gapReason(before[key]) ? before[key] : read.value;
    } else data[key] = value;
  }
  if (errors.length > 0) return { errors };
  try {
    return { raw: formToFile(original, { ...model, data }) };
  } catch (error) {
    return { errors: [error instanceof Error ? error.message : String(error)] };
  }
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A slug from a title: lower-case words joined by hyphens. */
export function slugFor(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

export type DuplicateResult = { outcome: "created"; slug: string } | { outcome: "refused"; errors: string[] };

/**
 * A new draft entry copied from `from`: the same profile and steps, a new title and address, and `forked_from` naming the
 * entry and version it was copied at. What belongs to the original alone is left behind: its versions and their history,
 * its place in the Start here list, and the papers and phages that prove it, since the variant has none of them yet.
 */
export async function duplicateEntry(
  env: FormEnv,
  from: { slug: string; raw: string },
  wanted: { title: string; slug: string },
  actor: Actor,
): Promise<DuplicateResult> {
  const title = wanted.title.trim();
  const slug = (wanted.slug.trim() || slugFor(title)).toLowerCase();
  const errors: string[] = [];
  if (!title) errors.push("The copy needs a title.");
  if (!SLUG.test(slug)) errors.push(`"${slug}" is not a file name: use lower-case letters, digits and hyphens.`);
  if (slug === from.slug) errors.push("The copy needs a file name of its own.");
  if (errors.length > 0) return { outcome: "refused", errors };

  const model = fileToForm(from.raw);
  const profile = String(model.data.profile ?? "protocol");
  const base = BASES.find((b) => b.profile === profile);
  const version = typeof model.data.version === "string" && !gapReason(model.data.version) ? model.data.version : null;
  const data: Record<string, unknown> = {
    ...model.data,
    title,
    seo_title: title,
    path: `${base?.entryRoot ?? "/research/protocols/"}${slug}`,
    draft: true,
    version: "MISSING: A new variant; no version has been assigned yet.",
    forked_from: version ? { slug: from.slug, version } : { slug: from.slug },
    history: undefined,
    start_here: undefined,
    proof_of_use: undefined,
  };
  const raw = formToFile(from.raw, { ...model, data });
  const checked = await compileProcedure(env, slug, raw);
  if (!checked.ok) return { outcome: "refused", errors: checked.errors };
  try {
    await saveProcedure(env, { slug, raw, isNew: true, actor });
  } catch (error) {
    const listed = (error as { errors?: string[] }).errors;
    if (Array.isArray(listed)) return { outcome: "refused", errors: listed };
    throw error;
  }
  return { outcome: "created", slug };
}
