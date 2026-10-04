// The closed lists a procedure's `method`, `organism` and `course` are chosen from, so the protocol library can
// filter by them (docs/PROCEDURES.md): a value is an id from here or the save is refused, which keeps "PCR" from
// being "pcr", "PCR" and "polymerase chain reaction" on three pages. A procedure's `target` (the gene or region it
// amplifies, the sample it works on) is free text, because targets are as many as the experiments.
//
// The organism ids are the phages' host keys (app/lib/phages/compile.mjs HOSTS) where a host exists, so a protocol's
// organism and a phage's host are the same word. When the lab registry holds host strains, these become records
// and this list is read from them.

/** What a procedure is mostly doing: the library's "method" facet. */
export const METHODS = Object.freeze({
  pcr: "PCR",
  plating: "Plating and titering",
  culture: "Culture",
  extraction: "Nucleic acid extraction",
  sequencing: "Sequencing",
  annotation: "Genome annotation",
  media: "Media and reagents",
  microscopy: "Microscopy",
});

/** The organism a procedure works with or on. */
export const ORGANISMS = Object.freeze({
  smegmatis: "Mycobacterium smegmatis",
  foliorum: "Microbacterium foliorum",
  avian: "Birds",
});

/** The courses a procedure is taught in, each with the page that describes it. */
export const COURSES = Object.freeze({
  "phage-discovery": { label: "Phage Discovery Program", path: "/teaching/phage-discovery" },
  "virus-isolation": { label: "Virus Isolation Course", path: "/teaching/virus-isolation" },
  "phage-bioinformatics": { label: "Phage Bioinformatics Course", path: "/teaching/phage-bioinformatics" },
});

/** The words for an id in a closed list, or the id itself when the list does not know it. */
export function methodLabel(/** @type {string} */ id) {
  return /** @type {Record<string, string>} */ (METHODS)[id] ?? id;
}
export function organismLabel(/** @type {string} */ id) {
  return /** @type {Record<string, string>} */ (ORGANISMS)[id] ?? id;
}
export function courseLabel(/** @type {string} */ id) {
  return /** @type {Record<string, { label: string }>} */ (COURSES)[id]?.label ?? id;
}

/** The protocol library's address; its filters are query parameters on it, so the canonical stays this path. */
export const LIBRARY_PATH = "/research/protocols";
