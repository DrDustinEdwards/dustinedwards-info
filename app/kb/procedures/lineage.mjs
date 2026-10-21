// A variant's lineage (docs/KNOWLEDGE-BASE.md, P3): the procedure it was copied from with the editor's Duplicate, as the
// page, the twin and the JSON-LD name it. The file holds only `forked_from: { slug, version }`; the parent's title and
// address are its own facts, read from its row when the page is served, so a renamed parent reads right everywhere.

import { BASES } from "../bases.mjs";
import { versionPath } from "./cite.mjs";

/**
 * @typedef {{ title: string, href: string | null, version: string | null }} Lineage
 */

/**
 * Where a variant points: the frozen copy of the version it was copied at when there is one, else the parent's live page,
 * else (a parent not published) its name with no link.
 *
 * @param {{ slug: string, version: string | null } | null} forkedFrom
 * @param {string} profile
 * @param {{ live: { title: string, path: string } | null, frozen: { title: string } | null }} parent
 * @returns {Lineage | null}
 */
export function resolveLineage(forkedFrom, profile, parent) {
  if (!forkedFrom) return null;
  const root = BASES.find((b) => b.profile === profile)?.entryRoot ?? "/research/protocols/";
  const path = `${root}${forkedFrom.slug}`;
  if (forkedFrom.version && parent.frozen) return { title: parent.frozen.title, href: versionPath(path, forkedFrom.version), version: forkedFrom.version };
  if (parent.live) return { title: parent.live.title, href: parent.live.path, version: forkedFrom.version };
  return { title: forkedFrom.slug, href: null, version: forkedFrom.version };
}

/** "Phage DNA extraction, version 2": the words the lineage is shown in. @param {Lineage} lineage */
export const lineageText = (lineage) => `${lineage.title}${lineage.version ? `, version ${lineage.version}` : ""}`;

/** The twin's fact line for a lineage, as the page's fact reads. @param {Lineage} lineage @param {string} origin */
const lineageMarkdown = (lineage, origin) => `- Based on: ${lineage.href ? `[${lineageText(lineage)}](${origin}${lineage.href})` : lineageText(lineage)}`;

/**
 * The fact the stored twin carries for a variant: the parent's file name and version, all the compile knows. The twin's
 * routes swap it for the parent's title and address when they serve it (`withLineage`).
 *
 * @param {{ slug: string, version: string | null }} forkedFrom
 */
export const storedLineage = (forkedFrom) => `${forkedFrom.slug}${forkedFrom.version ? `, version ${forkedFrom.version}` : ""}`;

/**
 * A twin with its stored lineage fact read out in full: the parent's title, linked to the copy it was taken from.
 *
 * @param {string} markdown
 * @param {{ forkedFrom: { slug: string, version: string | null } | null }} record
 * @param {Lineage | null} lineage
 * @param {string} origin
 */
export function withLineage(markdown, record, lineage, origin) {
  if (!record.forkedFrom || !lineage) return markdown;
  return markdown.replace(`- Based on: ${storedLineage(record.forkedFrom)}\n`, `${lineageMarkdown(lineage, origin)}\n`);
}

/**
 * What is wrong with a variant's `forked_from` against the procedures in the repository (P3): the parent is a file
 * here, of the same profile, and the version named is one the parent states (its current version or one in its history),
 * which is a version that is or will be frozen. The shape is validate.mjs's; this is the corpus check:protocols runs.
 *
 * @param {{ forkedFrom: { slug: string, version: string | null } | null, profile: string }} record
 * @param {Map<string, { profile: string, version: string | null, history: Array<{ version: string }> }>} procedures by slug
 * @returns {string[]}
 */
export function lineageErrors(record, procedures) {
  const from = record.forkedFrom;
  if (!from) return [];
  const parent = procedures.get(from.slug);
  if (!parent) return [`forked_from names ${from.slug}, which is not a procedure here`];
  if (parent.profile !== record.profile) return [`forked_from names ${from.slug}, a ${parent.profile}; a variant keeps its parent's profile (${record.profile})`];
  if (!from.version) return [];
  const stated = new Set([parent.version, ...parent.history.map((h) => h.version)].filter(Boolean));
  return stated.has(from.version) ? [] : [`forked_from names version ${from.version} of ${from.slug}, which states ${[...stated].join(", ") || "no version"}`];
}
