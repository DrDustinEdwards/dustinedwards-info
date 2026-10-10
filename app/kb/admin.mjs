// The admin's Knowledge Base page (docs/KNOWLEDGE-BASE.md, step 2), the part that needs no runtime: its tabs and their
// counts, the search over a base's entries, and the Needs info list, every recorded gap of every entry and registry item
// on one screen. Pure, so node:test holds it; the route passes in the rows it read from D1. Read-only: nothing here writes.

import { foldText } from "../lib/cv/view.mjs";
import { BASES } from "./bases.mjs";
import { labelGaps } from "./gap-labels.mjs";
import { hasItemPage, itemPath, kindPath } from "./registry/catalog.mjs";
import { isGap } from "./registry/compile.mjs";
import { KINDS } from "./registry/kinds.mjs";

export const KB_ADMIN_PATH = "/admin/kb";

/** Where an entry's file is edited (step 3). @param {string} slug */
export const entryEditHref = (slug) => `${KB_ADMIN_PATH}/entry/${slug}`;

/** Where a registry item's file is edited (step 3). @param {string} kind @param {string} id */
export const itemEditHref = (kind, id) => `${KB_ADMIN_PATH}/item/${kind}/${id}`;

/** The tab that lists every gap, beside one tab per base. */
export const NEEDS_INFO = "needs-info";

/**
 * @typedef {{
 *   slug: string,
 *   path: string,
 *   profile: string,
 *   title: string,
 *   description: string,
 *   draft: boolean,
 *   version: string | null,
 *   updated: string | null,
 *   gaps: Array<{ field: string, reason: string, where?: string[], section?: string }>,
 * }} KbEntry
 *
 * @typedef {{ kind: string, id: string, name: string, status: string, fields: Record<string, unknown> }} KbItem
 *
 * @typedef {{ what: string, kindLabel: string, href: string, editHref: string, field: string, label: string, reason: string }} KbGap
 */

/** The tab a `?tab=` value names, else the first base. @param {string | null} value */
export function resolveTab(value) {
  if (value === NEEDS_INFO || BASES.some((base) => base.id === value)) return /** @type {string} */ (value);
  return /** @type {string} */ (BASES[0]?.id);
}

/** A tab's address, keeping the search only where it still applies (a base's list). @param {string} tab @param {string} [q] */
export function tabHref(tab, q = "") {
  const params = new URLSearchParams({ tab });
  if (q && tab !== NEEDS_INFO) params.set("q", q);
  return `${KB_ADMIN_PATH}?${params}`;
}

/**
 * Every tab with its count, read from the same rows the lists are drawn from: one per base, then Needs info.
 *
 * @param {KbEntry[]} entries
 * @param {KbGap[]} gaps
 */
export function kbTabs(entries, gaps) {
  return [
    ...BASES.map((base) => ({ id: base.id, label: base.name, count: entries.filter((e) => e.profile === base.profile).length })),
    { id: NEEDS_INFO, label: "Needs info", count: gaps.length },
  ];
}

/**
 * A base's entries, narrowed by a search over the title, description and slug (case and accents folded), in title order.
 *
 * @param {KbEntry[]} entries
 * @param {string} tab
 * @param {string} [q]
 */
export function baseEntries(entries, tab, q = "") {
  const base = BASES.find((b) => b.id === tab);
  if (!base) return [];
  const needle = foldText(q);
  return entries
    .filter((e) => e.profile === base.profile)
    .filter((e) => needle === "" || foldText(`${e.title} ${e.description} ${e.slug}`).includes(needle))
    .sort((a, b) => foldText(a.title).localeCompare(foldText(b.title), "en", { numeric: true }));
}

/** Where an item is read: its own page, or its kind's table where the kind has no item pages. @param {KbItem} item */
function itemHref(item) {
  return hasItemPage(item.kind) ? itemPath(item.kind, item.id) : kindPath(item.kind);
}

/**
 * Every recorded gap (`MISSING: <why>`), entries first in title order, then registry items in the registry's order, each
 * with the field and the reason as written.
 *
 * @param {KbEntry[]} entries
 * @param {KbItem[]} items
 * @returns {KbGap[]}
 */
export function needsInfo(entries, items) {
  const profileName = Object.fromEntries(BASES.map((base) => [base.profile, base.singular]));
  const fromEntries = [...entries]
    .sort((a, b) => foldText(a.title).localeCompare(foldText(b.title), "en", { numeric: true }))
    .flatMap((e) =>
      labelGaps(e.gaps, e.profile).map((gap) => ({
        what: e.title,
        kindLabel: profileName[e.profile] ?? e.profile,
        href: e.path,
        editHref: `${entryEditHref(e.slug)}#${gap.anchor}`,
        field: gap.field,
        label: gap.label,
        reason: gap.reason,
      })),
    );
  const fromItems = items.flatMap((item) =>
    labelGaps(
      Object.entries(item.fields)
        .filter(([, value]) => isGap(value))
        .map(([field, value]) => ({ field, reason: String(value).replace(/^MISSING:\s*/, "") })),
      null,
    ).map((gap) => ({
      what: item.name,
      kindLabel: capitalise(KINDS[item.kind]?.singular ?? item.kind),
      href: itemHref(item),
      editHref: `${itemEditHref(item.kind, item.id)}#${gap.anchor}`,
      field: gap.field,
      label: gap.label,
      reason: gap.reason,
    })),
  );
  return [...fromEntries, ...fromItems];
}

/** @param {string} word */
function capitalise(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
