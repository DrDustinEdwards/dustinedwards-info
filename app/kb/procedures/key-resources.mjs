// A protocol's Key Resources Table (docs/KNOWLEDGE-BASE.md, step 6), in the shape Cell Press's STAR Methods ask for:
// each resource with its source and identifier, grouped by type. Computed from the record, never stored or typed: the
// strains, reagents, primers and equipment a protocol names are the lab registry's, baked into the record when it is
// compiled, so the table, the page's own tables and the twin print the same facts. A fact the registry records as a gap
// reads "Not recorded", and an identifier a resource does not have reads "N/A", as STAR tables write it.

const NOT_RECORDED = "Not recorded";
const NONE = "N/A";

/**
 * @typedef {{ resource: string, sequence?: string, href: string | null, source: string, identifier: string }} KeyResource
 * @typedef {{ id: string, heading: string, rows: KeyResource[] }} KeyResourceGroup
 */

/**
 * The table's groups, in STAR's order, each holding at least one row; empty for a record that is not a protocol or names
 * nothing from the registry.
 *
 * @param {import("./render.mjs").ProcedureRecord} record
 * @returns {KeyResourceGroup[]}
 */
export function keyResources(record) {
  if (record.profile !== "protocol") return [];

  const strains = record.hostStrains.map((s) => ({
    resource: s.name,
    href: s.path,
    source: s.collection ?? NOT_RECORDED,
    // The registry stores the collection and its number apart ("ATCC", "700084"); a table names the deposit with both.
    identifier: s.collectionNumber ? [s.collection, s.collectionNumber].filter(Boolean).join(" ") : NONE,
  }));

  // A reagent once, however many materials name it, in the order the protocol first names it.
  const seen = new Set();
  const chemicals = [];
  for (const m of record.materials) {
    const r = m.reagent;
    if (!r || seen.has(r.id)) continue;
    seen.add(r.id);
    chemicals.push({
      resource: r.name,
      href: null,
      source: r.preparedInLab ? "Prepared in the lab" : (r.supplier ?? NOT_RECORDED),
      identifier: r.preparedInLab ? NONE : r.catalogNumber ? `Cat# ${r.catalogNumber}` : NOT_RECORDED,
    });
  }

  // A primer's sequence, 5′ to 3′, is a part of the row, as STAR tables give it, kept apart from its name so the page can set
  // it in monospace and let it break anywhere.
  const oligos = record.primers.map((p) => ({
    resource: p.name,
    ...(p.sequence ? { sequence: `5′-${p.sequence}-3′` } : {}),
    href: `/research/lab/primers/${p.id}`,
    source: p.publishedIn ?? NOT_RECORDED,
    identifier: NONE,
  }));

  const other = record.equipment.flatMap((e) =>
    e.item ? [{ resource: e.item.name, href: null, source: e.item.manufacturer ?? NOT_RECORDED, identifier: NONE }] : [],
  );

  return [
    { id: "strains", heading: "Bacterial and virus strains", rows: strains },
    { id: "chemicals", heading: "Chemicals, peptides, and recombinant proteins", rows: chemicals },
    { id: "oligonucleotides", heading: "Oligonucleotides", rows: oligos },
    { id: "other", heading: "Other", rows: other },
  ].filter((group) => group.rows.length > 0);
}

/** A cell's text for a markdown table: pipes escaped, so a citation with one cannot split the row. @param {string} text */
const cell = (text) => text.replace(/\|/g, "\\|");

/**
 * The table as the twin prints it: one markdown table, each group a bold row above its resources.
 *
 * @param {KeyResourceGroup[]} groups
 * @returns {string[]} lines, ending with a blank one; none when there is nothing to list
 */
export function keyResourcesMarkdown(groups) {
  if (groups.length === 0) return [];
  const out = ["## Key resources", "", "| Reagent or resource | Source | Identifier |", "| --- | --- | --- |"];
  for (const group of groups) {
    out.push(`| **${cell(group.heading)}** | | |`);
    for (const row of group.rows) {
      const name = row.href ? `[${cell(row.resource)}](${row.href})` : cell(row.resource);
      const sequence = row.sequence ? `: \`${row.sequence}\`` : "";
      out.push(`| ${name}${sequence} | ${cell(row.source)} | ${cell(row.identifier)} |`);
    }
  }
  out.push("");
  return out;
}
